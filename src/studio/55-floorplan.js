// ---- Floor plan editing (v6.47.0, V7_PLAN §6.3) ------------------------------------------------
// When the room shown is a floor plan page, the canvas edits its geometry: select / move rooms,
// drag, add (edge midpoint) and delete corners, draw rooms as rectangles or polygons, place and
// slide doors along walls. Geometry comes from AnyVac (import), a drawing, or a traced image.
// Everything is plan metres in `floorplan.rooms[].polygon`; the renderer (room-overlay-card-
// floorplan.js) draws it and lends its projection, so editing works in every projection.
const RS_FP_TOOLS=[['select','mdi:cursor-default-outline'],['rect','mdi:vector-rectangle'],['poly','mdi:vector-polygon'],['door','mdi:door'],['window','mdi:window-closed-variant'],['marker','mdi:map-marker-plus']];
const RS_FP_ACCENT='#03a9f4';
function rsFpR(v){return Math.round(v*100)/100;}
function rsFpNorm(s){return String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'');}
// AnyVac map sensors: schema_version ≥ 3 with a home frame and rooms (V7_PLAN §7a)
function rsFpSensors(hass){
  const S=(hass&&hass.states)||{};
  return Object.keys(S).filter(function(id){
    const a=S[id]&&S[id].attributes||{};
    return id.indexOf('sensor.')===0&&Number(a.schema_version)>=3&&a.home_frame&&typeof a.home_frame==='object'&&Array.isArray(a.rooms);
  }).sort();
}
// The Home Assistant area of a card room: its id, else an area_match entry (id, name or alias).
function rsFpArea(hass,room){
  const A=(hass&&hass.areas)||{};if(!room)return null;
  if(room.id!=null&&A[room.id])return A[room.id];
  const cands=[room.id,room.name].concat(Array.isArray(room.area_match)?room.area_match:(room.area_match?[room.area_match]:[])).map(rsFpNorm).filter(Boolean);
  for(const k in A){
    const a=A[k],names=[k,a.name].concat(a.aliases||[]).map(rsFpNorm);
    if(cands.some(function(c){return names.indexOf(c)>=0;}))return Object.assign({area_id:k},a);
  }
  return null;
}
function rsFpEntArea(hass,eid){
  const E=(hass&&hass.entities)||{},D=(hass&&hass.devices)||{};const e=E[eid];if(!e)return null;
  return e.area_id||(e.device_id&&D[e.device_id]&&D[e.device_id].area_id)||null;
}
// What a plan room shows, taken from the card room it is linked to: its light controls (the
// lights the user already picked), the area's heating thermostat (a climate that can `heat`),
// temperature / humidity sensors the card's nav chips already use for that room ({room}), else
// the area's own. Nothing is invented: every id comes from the config or from Home Assistant.
function rsFpEntities(hass,cAll,room){
  const S=(hass&&hass.states)||{},E=(hass&&hass.entities)||{},out={};
  const lc=room&&room.light_controls;
  const lcl=lc&&Array.isArray(lc.entities)?lc.entities:(Array.isArray(lc)?lc:[]);
  let lights=lcl.map(function(x){return typeof x==='string'?x:(x&&x.entity);}).filter(function(x){return x&&/^(light|switch)\./.test(x);});
  const area=rsFpArea(hass,room),aid=area&&(area.area_id||Object.keys(hass.areas||{}).find(function(k){return hass.areas[k]===area;}));
  const inArea=function(dom){
    if(!aid)return[];
    return Object.keys(S).filter(function(id){
      if(id.split('.')[0]!==dom)return false;
      const r=E[id];if(r&&(r.hidden||r.entity_category))return false;
      return rsFpEntArea(hass,id)===aid;
    });
  };
  if(!lights.length){
    const ls=inArea('light');const groups=ls.filter(function(id){const a=S[id].attributes||{};return Array.isArray(a.entity_id)&&a.entity_id.length>1;});
    lights=(groups.length?groups:ls).slice(0,4);
  }
  if(lights.length)out.lights=lights.length===1?lights[0]:lights;
  const clim=inArea('climate').filter(function(id){const m=(S[id].attributes||{}).hvac_modes;return Array.isArray(m)&&m.indexOf('heat')>=0;});
  if(clim.length)out.climate=clim[0];
  const dc=function(id){return S[id]&&(S[id].attributes||{}).device_class;};
  const chips=(cAll&&cAll.nav&&Array.isArray(cAll.nav.chips))?cAll.nav.chips:[];
  chips.forEach(function(ch){
    const t=ch&&typeof ch==='object'?ch.entity:ch;if(typeof t!=='string'||t.indexOf('{room}')<0||!room||room.id==null)return;
    const id=t.replace(/\{room\}/g,String(room.id));
    if(!S[id])return;
    if(dc(id)==='temperature'&&!out.temperature)out.temperature=id;
    if(dc(id)==='humidity'&&!out.humidity)out.humidity=id;
  });
  if(!out.temperature&&!(out.climate&&isFinite(Number((S[out.climate].attributes||{}).current_temperature)))){const t=inArea('sensor').filter(function(id){return dc(id)==='temperature';});if(t.length)out.temperature=t[0];}
  if(!out.humidity){const h=inArea('sensor').filter(function(id){return dc(id)==='humidity';});if(h.length)out.humidity=h[0];}
  // v6.48.0: media players — the ones the room's own config uses, else the area's
  const mp=[];
  JSON.stringify(room||{}).replace(/media_player\.[a-z0-9_]+/g,function(m){if(S[m]&&mp.indexOf(m)<0)mp.push(m);return m;});
  const media=(mp.length?mp:inArea('media_player')).slice(0,3);
  if(media.length)out.media=media.length===1?media[0]:media;
  return out;
}
// v6.49.0: a new window's sensor (device_class window) and blind (a cover), from the Home Assistant
// area of the plan room the wall belongs to — ones not used by another opening of the plan. Doors
// get nothing: appliance doors (dishwasher, oven, fridge, washer) are device_class door too and sit
// in the same areas, so a guess would usually be wrong. Nothing found → nothing set.
function rsFpOpeningGuess(hass,cAll,fp,ri,type){
  const S=(hass&&hass.states)||{},E=(hass&&hass.entities)||{},out={};
  const pr=fp&&Array.isArray(fp.rooms)?fp.rooms[ri]:null;if(!pr||type!=='window')return out;
  const cr=pr.room!=null?((cAll&&cAll.rooms)||[]).find(function(x){return x&&String(x.id)===String(pr.room);}):null;
  const area=rsFpArea(hass,cr||{name:pr.name});
  const aid=area&&(area.area_id||Object.keys((hass&&hass.areas)||{}).find(function(k){return hass.areas[k]===area;}));
  if(!aid)return out;
  const used=new Set();(fp.openings||[]).forEach(function(o){if(o&&o.entity)used.add(o.entity);if(o&&o.cover)used.add(o.cover);});
  const pick=function(dom,ok){
    return Object.keys(S).sort().find(function(id){
      if(id.split('.')[0]!==dom||used.has(id))return false;
      const r=E[id];if(r&&(r.hidden||r.entity_category))return false;
      return rsFpEntArea(hass,id)===aid&&ok((S[id].attributes||{}));
    });
  };
  const c=pick('binary_sensor',function(a){return a.device_class==='window';});
  if(c)out.entity=c;
  const cv=pick('cover',function(a){return!a.device_class||['blind','shade','shutter','curtain','awning'].indexOf(a.device_class)>=0;});
  if(cv)out.cover=cv;
  return out;
}
function rsFpPageRooms(cAll){return(Array.isArray(cAll&&cAll.rooms)?cAll.rooms:[]).map(function(r,i){return{r:r,i:i};}).filter(function(x){return x.r&&!x.r.overview&&!x.r.floorplan;});}
// The card room an AnyVac room most likely is: its area (A5), else the names (id, name, the
// overview tile's name, area_match, the area's name and aliases), compared without case,
// accents and separators ("Living room" = living_room).
function rsFpAutoLink(hass,cAll,vr){
  const rooms=rsFpPageRooms(cAll);
  if(vr.area_id){const m=rooms.find(function(x){const a=rsFpArea(hass,x.r);return a&&(a.area_id===vr.area_id||x.r.id===vr.area_id);});if(m)return String(m.r.id);}
  const n=rsFpNorm(vr.name);if(!n)return'';
  const m=rooms.find(function(x){
    const r=x.r,a=rsFpArea(hass,r);
    const names=[r.id,r.name,r.overview_tile&&r.overview_tile.name].concat(Array.isArray(r.area_match)?r.area_match:(r.area_match?[r.area_match]:[])).concat(a?[a.name].concat(a.aliases||[]):[]);
    return names.some(function(v){return rsFpNorm(v)===n;});
  });
  return m&&m.r.id!=null?String(m.r.id):'';
}
// AnyVac → floorplan (pure; the import panel and the tests use it).
// st: the sensor's state object; o: {links: {home_room_id: card room id | '' (plan only) | null
// (skip)}, clean, doors, entities, today}; prev: the current floorplan block (re-import keeps
// every room's own settings and only replaces its polygon).
function rsFpImport(G,hass,cAll,sensorId,st,o,prev){
  o=o||{};prev=prev&&typeof prev==='object'?prev:{};
  const a=(st&&st.attributes)||{},hf=a.home_frame||{};
  const mmpp=(Number(hf.cell_mm)>0&&Number(hf.scale)>0)?Number(hf.cell_mm)/Number(hf.scale):12.5;
  const vrs=(a.rooms||[]).filter(function(r){return r&&typeof r==='object';});
  // origin: the top-left of everything, so the plan starts near 0,0
  let ox=Infinity,oy=Infinity;
  const ptsOf=function(r){
    const ol=G.poly(r.outline_home_px),b=r.bbox_home_px;
    const bb=b&&isFinite(b.x0)?[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]]:null;
    // an outline that covers under a quarter of its own bbox is a broken trace (AnyVac A1): bbox
    if(ol.length>=3&&(!bb||Math.abs(G.area(ol))>=0.25*Math.abs(G.area(bb))))return ol;
    return bb||[];
  };
  vrs.forEach(function(r){ptsOf(r).forEach(function(p){ox=Math.min(ox,p[0]);oy=Math.min(oy,p[1]);});});
  if(!isFinite(ox)){ox=0;oy=0;}
  const toM=function(p){return[rsFpR((p[0]-ox)*mmpp/1000),rsFpR((p[1]-oy)*mmpp/1000)];};
  const links=o.links||{};
  const prevRooms=Array.isArray(prev.rooms)?prev.rooms:[];
  const out=[];const used=new Set();
  vrs.forEach(function(vr){
    const key=String(vr.home_room_id||vr.segment_id||vr.name||'');
    const link=Object.prototype.hasOwnProperty.call(links,key)?links[key]:rsFpAutoLink(hass,cAll,vr);
    if(link===null)return; // skipped
    let poly=ptsOf(vr).map(toM);if(poly.length<3)return;
    if(o.clean!==false)poly=G.clean(poly);
    const old=prevRooms.findIndex(function(r,i){return r&&!used.has(i)&&String(r.anyvac_room||'')===key&&key;});
    let r;
    if(old>=0){used.add(old);r=JSON.parse(JSON.stringify(prevRooms[old]));r.polygon=poly;if(link&&!r.room)r.room=link;}
    else{
      r={};
      if(link)r.room=link;else r.name=String(vr.name||key);
      r.polygon=poly;
      r.floor=/kitch|kuch|bath|koupel|wc|toilet|hall|corrid|chodb|vchod|entr|foyer|predsin/i.test(rsFpNorm(vr.name)+' '+rsFpNorm(link))?'tile':'wood';
      r.anyvac_room=key;
      if(link&&o.entities!==false){
        const cr=(cAll.rooms||[]).find(function(x){return x&&String(x.id)===String(link);});
        Object.assign(r,rsFpEntities(hass,cAll,cr));
      }
    }
    out.push(r);
  });
  // rooms that were not imported from this map (drawn by hand, another vacuum) stay
  prevRooms.forEach(function(r,i){if(!used.has(i)&&!(r&&r.anyvac_room&&vrs.some(function(v){return String(v.home_room_id||v.segment_id||v.name)===String(r.anyvac_room);})))out.push(r);});
  const fp=JSON.parse(JSON.stringify(prev));
  fp.rooms=out;
  if(o.doors!==false){
    const paths=[].concat(a.path_dry_home_px||[],a.path_wet_home_px||[]).map(function(seg){return G.poly(seg).map(toM);});
    const old=(Array.isArray(prev.openings)?prev.openings:[]).filter(function(o){return o&&typeof o==='object';});
    fp.openings=rsFpMergeDoors(G,G.doors(out.map(function(r){return G.poly(r.polygon);}),paths),old);
    if(!fp.openings.length)delete fp.openings;
  }
  fp.source=Object.assign({},fp.source&&typeof fp.source==='object'?fp.source:{},{anyvac:sensorId,frame:String(hf.id||''),imported:o.today||new Date().toISOString().slice(0,10),origin_px:[ox,oy],mm_per_px:mmpp});
  if(!fp.theme)fp.theme='night';
  return fp;
}

// Proposed doors replace the old doors; windows stay; an old door within 0.6 m of a proposed one is
// kept instead (with its sensor, mirror / outward and width).
function rsFpMergeDoors(G,proposed,old){
  const oldDoors=old.filter(function(o){return o.type!=='window';}),used=new Set();
  const doors=proposed.map(function(d){
    let best=-1,bd=0.6;
    oldDoors.forEach(function(o,i){const at=G.poly([o.at])[0];if(!at||used.has(i))return;const dd=Math.hypot(at[0]-d.at[0],at[1]-d.at[1]);if(dd<bd){bd=dd;best=i;}});
    if(best>=0){used.add(best);return JSON.parse(JSON.stringify(oldDoors[best]));}
    return{type:'door',at:d.at,width:d.width};
  });
  return doors.concat(old.filter(function(o){return o.type==='window';}).map(function(o){return JSON.parse(JSON.stringify(o));}));
}
RocStudio.prototype._fpIdx=function(){
  if(this.global)return-1;
  const r=this._rooms()[this.roomIdx];
  return r&&r.floorplan&&!r.overview?this.roomIdx:-1;
};
RocStudio.prototype._fpState=function(){if(!this.fp)this.fp={tool:'select',sel:null,door:null,item:null,vtx:null,draft:null,room:-1};return this.fp;};
RocStudio.prototype._fpCfg=function(w){
  const i=this._fpIdx();if(i<0)return{};
  const r=(w||this.work).rooms[i];return r&&typeof r.floorplan==='object'?r.floorplan:{};
};
RocStudio.prototype._fpEdit=function(mut,src){
  const i=this._fpIdx();if(i<0)return false;
  const c=JSON.parse(rsJ(this.work));const r=c.rooms[i];
  if(!r.floorplan||typeof r.floorplan!=='object')r.floorplan={};
  if(mut(r.floorplan,c)===false)return false;
  this._commit(c,src||'studio');
  return true;
};
RocStudio.prototype._fpGeom=function(){
  const self=this;
  if(this.G)return Promise.resolve(this.G);
  const F=this.C&&this.C._rocFloorplan;if(F){this.G=F.geom;return Promise.resolve(this.G);}
  return this.I.loadFloorplan().then(function(F2){self.G=F2.geom;return self.G;});
};
// the canvas card mounted / re-rendered its plan
RocStudio.prototype._fpOnView=function(v){
  this._fpView=v;
  if(this.C&&this.C._rocFloorplan)this.G=this.C._rocFloorplan.geom;
  if(v.svg!==this._fpSvg){this._fpSvg=v.svg;this._fpBind(v.svg);}
  this._fpDraw();
};
RocStudio.prototype._fpActive=function(){return this.mode==='arrange'&&this._fpIdx()>=0&&!!this._fpView&&!!this.G;};
// ---- selection, after config changes ----
RocStudio.prototype._fpSync=function(){
  const st=this._fpState(),i=this._fpIdx();
  if(i!==st.room){st.room=i;st.sel=null;st.door=null;st.item=null;st.vtx=null;st.draft=null;if(st.tool==='calib')st.tool='select';}
  const fp=this._fpCfg();
  if(st.sel!=null&&!(Array.isArray(fp.rooms)&&fp.rooms[st.sel]))st.sel=null;
  if(st.door!=null&&!(Array.isArray(fp.openings)&&fp.openings[st.door]))st.door=null;
  if(st.item!=null&&!(Array.isArray(fp.items)&&fp.items[st.item]))st.item=null;
  if(st.sel==null)st.vtx=null;
};
RocStudio.prototype._fpSelect=function(kind,idx){
  const st=this._fpState();
  st.sel=kind==='room'?idx:null;st.door=kind==='door'?idx:null;st.item=kind==='item'?idx:null;st.vtx=null;
  this.sel=null;this.multi=[];this.cardSel=null;
  this._renderOutlineList();this._syncProps(true);this._fpDraw();this._fpChrome();
};
// ---- the toolbar over the canvas ----
RocStudio.prototype._fpChrome=function(){
  const self=this;
  this._fpSync();
  const on=this._fpIdx()>=0;
  if(!this._fpBar){
    if(!on||!this._cvInfo)return;
    const bar=rsEl('span',{class:'fpbar',role:'toolbar','aria-label':this.t('fp_tools')});
    const seg=rsEl('span',{class:'seg'});this._fpToolBtns={};
    RS_FP_TOOLS.forEach(function(x){
      const b=rsEl('button',{type:'button','data-fptool':x[0],title:self.t('fp_tool_'+x[0]),'aria-label':self.t('fp_tool_'+x[0]),onclick:function(){self._fpTool(x[0]);}},[rsIcon(x[1])]);
      self._fpToolBtns[x[0]]=b;seg.appendChild(b);
    });
    bar.appendChild(seg);
    const act=function(icon,id,fn){const b=rsEl('button',{type:'button',class:'btn sm','data-act':id,title:self.t(id),'aria-label':self.t(id),onclick:fn},[rsIcon(icon),rsEl('span',{class:'lbl',text:self.t(id+'_l')})]);bar.appendChild(b);return b;};
    act('mdi:robot-vacuum','fp_import',function(){self._fpImport();});
    act('mdi:image-outline','fp_trace',function(){self._fpTrace();});
    act('mdi:door-open','fp_doors',function(){self._fpAutoDoors();});
    this._fpDelBtn=act('mdi:delete-outline','fp_delete',function(){self._fpDel();});
    this._fpHint=rsEl('span',{class:'fphint'});bar.appendChild(this._fpHint);
    this._fpBar=bar;this._cvInfo.appendChild(bar);
  }
  this._fpBar.hidden=!on||this.mode!=='arrange';
  if(!on)return;
  const st=this._fpState();
  for(const k in this._fpToolBtns)this._fpToolBtns[k].setAttribute('aria-pressed',String(st.tool===k));
  this._fpDelBtn.disabled=st.sel==null&&st.door==null&&st.item==null;
  const fp=this._fpCfg();
  this._fpHint.textContent=this.t('fp_hint_'+st.tool,{n:Array.isArray(fp.rooms)?fp.rooms.length:0})+(st.tool==='select'&&!(Array.isArray(fp.rooms)&&fp.rooms.length)?' '+this.t('fp_hint_empty'):'');
};
RocStudio.prototype._fpTool=function(k){
  const st=this._fpState();st.tool=k;st.draft=null;
  if(k!=='select'){st.vtx=null;}
  this._fpChrome();this._fpDraw();
};
// ---- the outline: the plan's rooms and doors ----
RocStudio.prototype._fpOutline=function(box){
  const self=this,fp=this._fpCfg(),st=this._fpState(),rooms=this._rooms();
  const head=rsEl('div',{class:'ol-row ol-kindrow'});
  head.appendChild(rsEl('button',{class:'ol-item ol-kind',type:'button','data-act':'fp-page',onclick:function(){self._fpSelect(null,null);}},[rsIcon('mdi:floor-plan'),rsEl('span',{text:this.t('fp_page')})]));
  box.appendChild(head);
  const prs=Array.isArray(fp.rooms)?fp.rooms:[];
  box.appendChild(rsEl('div',{class:'ol-row ol-kindrow'},[rsEl('span',{class:'ol-item ol-kind'},[rsIcon('mdi:vector-square'),rsEl('span',{text:this.t('fp_rooms')}),rsEl('span',{class:'n',text:String(prs.length)})])]));
  prs.forEach(function(r,i){
    if(!r||typeof r!=='object')return;
    const cr=r.room!=null?rooms.find(function(x){return x&&String(x.id)===String(r.room);}):null;
    const nm=r.name||(cr&&((cr.overview_tile&&cr.overview_tile.name)||cr.name))||r.room||('#'+(i+1));
    box.appendChild(rsEl('button',{class:'ol-item ol-el',type:'button','data-fproom':String(i),'aria-current':String(st.sel===i),onclick:function(){self._fpSelect('room',i);}},
      [rsEl('span',{class:'nm',text:String(nm)}),rsEl('span',{class:'sub',text:cr?String(cr.id):(r.room?self.t('fp_badlink',{r:String(r.room)}):self.t('fp_planonly'))})]));
  });
  const ops=Array.isArray(fp.openings)?fp.openings:[];
  if(ops.length){
    box.appendChild(rsEl('div',{class:'ol-row ol-kindrow'},[rsEl('span',{class:'ol-item ol-kind'},[rsIcon('mdi:door'),rsEl('span',{text:this.t('fp_openings_h')}),rsEl('span',{class:'n',text:String(ops.length)})])]));
    const cnt={door:0,window:0};
    ops.forEach(function(o,k){
      const win=o&&o.type==='window';cnt[win?'window':'door']++;
      box.appendChild(rsEl('button',{class:'ol-item ol-el',type:'button','data-fpdoor':String(k),'aria-current':String(st.door===k),onclick:function(){self._fpSelect('door',k);}},
        [rsEl('span',{class:'nm',text:self.t(win?'fp_window_n':'fp_door_n',{n:cnt[win?'window':'door']})}),rsEl('span',{class:'sub',text:Array.isArray(o&&o.at)?o.at.join(', ')+' m':''})]));
    });
  }
  const its=Array.isArray(fp.items)?fp.items:[];
  if(its.length){
    box.appendChild(rsEl('div',{class:'ol-row ol-kindrow'},[rsEl('span',{class:'ol-item ol-kind'},[rsIcon('mdi:map-marker'),rsEl('span',{text:this.t('fp_items_h')}),rsEl('span',{class:'n',text:String(its.length)})])]));
    its.forEach(function(it,k){
      if(!it||typeof it!=='object')return;
      const nm=it.name||it.text||it.entity||self.t(it.type==='label'?'fp_label_n':'fp_marker_n',{n:k+1});
      box.appendChild(rsEl('button',{class:'ol-item ol-el',type:'button','data-fpitem':String(k),'aria-current':String(st.item===k),onclick:function(){self._fpSelect('item',k);}},
        [rsEl('span',{class:'nm',text:String(nm)}),rsEl('span',{class:'sub',text:self.t(it.type==='label'?'fp_label':'fp_marker')})]));
    });
  }
  if(!prs.length)box.appendChild(rsEl('div',{class:'ol-empty',text:this.t('fp_ol_empty')}));
};
// ---- Properties: a plan room / a door ----
RocStudio.prototype._fpTarget=function(){
  const i=this._fpIdx();if(i<0)return null;
  this._fpSync();
  const st=this._fpState(),fp=this._fpCfg();
  if(st.sel!=null&&Array.isArray(fp.rooms)&&fp.rooms[st.sel])return{kind:'fproom',id:String(st.sel),idx:st.sel,item:fp.rooms[st.sel],path:'rooms['+i+'].floorplan.rooms['+st.sel+']'};
  if(st.door!=null&&Array.isArray(fp.openings)&&fp.openings[st.door]){
    const ty=fp.openings[st.door].type==='window'?'window':'door';
    const n=fp.openings.slice(0,st.door+1).filter(function(o){return o&&(o.type==='window'?'window':'door')===ty;}).length;
    return{kind:'fpdoor',id:String(st.door),idx:st.door,n:n,item:fp.openings[st.door],path:'rooms['+i+'].floorplan.openings['+st.door+']'};
  }
  if(st.item!=null&&Array.isArray(fp.items)&&fp.items[st.item])return{kind:'fpitem',id:String(st.item),idx:st.item,item:fp.items[st.item],path:'rooms['+i+'].floorplan.items['+st.item+']'};
  return null;
};
RocStudio.prototype._fpItem=function(c,tg){
  const i=this._fpIdx();const r=c.rooms&&c.rooms[i];const fp=r&&r.floorplan;if(!fp||typeof fp!=='object')return null;
  return tg.kind==='fproom'?(fp.rooms||[])[tg.idx]:(tg.kind==='fpitem'?(fp.items||[])[tg.idx]:(fp.openings||[])[tg.idx]);
};
// ---- drawing the edit overlay (in the plan's own SVG, screen px) ----
RocStudio.prototype._fpDraw=function(){
  const v=this._fpView;if(!v||!v.edit||!v.F)return;
  const g=v.edit;
  if(!this._fpActive()){g.innerHTML='';return;}
  const G=this.G,st=this._fpState(),fp=this._fpTmp||this._fpCfg();
  const P=function(p){const q=v.toLocal(p[0],p[1],0);return rsFpR(q[0])+','+rsFpR(q[1]);};
  let s='';
  (Array.isArray(fp.rooms)?fp.rooms:[]).forEach(function(r,i){
    const poly=G.poly(r&&r.polygon);if(poly.length<3)return;
    const sel=st.sel===i;
    s+='<polygon points="'+poly.map(P).join(' ')+'" fill="'+(sel?'rgba(3,169,244,.10)':'none')+'" stroke="'+(sel?RS_FP_ACCENT:'rgba(255,255,255,.55)')+'" stroke-width="'+(sel?2:1)+'"'+(sel?'':' stroke-dasharray="5 4"')+' pointer-events="none"/>';
  });
  (Array.isArray(fp.openings)?fp.openings:[]).forEach(function(o,k){
    const at=G.poly([o&&o.at])[0];if(!at)return;
    const q=v.toLocal(at[0],at[1],0),sel=st.door===k,win=o.type==='window';
    s+='<rect x="'+rsFpR(q[0]-(win?8:6))+'" y="'+rsFpR(q[1]-(win?4:6))+'" width="'+(win?16:12)+'" height="'+(win?8:12)+'" rx="'+(win?2:3)+'" fill="'+(sel?RS_FP_ACCENT:(win?'#bfe3ff':'#fff'))+'" stroke="#0b0e12" stroke-width="1.5" pointer-events="none"/>';
  });
  (Array.isArray(fp.items)?fp.items:[]).forEach(function(it,k){
    const at=G.poly([it&&it.at])[0];if(!at)return;
    const q=v.toLocal(at[0],at[1],0),sel=st.item===k;
    s+='<circle cx="'+rsFpR(q[0])+'" cy="'+rsFpR(q[1])+'" r="21" fill="'+(sel?'rgba(3,169,244,.18)':'none')+'" stroke="'+(sel?RS_FP_ACCENT:'rgba(255,255,255,.7)')+'" stroke-width="'+(sel?2:1)+'"'+(sel?'':' stroke-dasharray="4 3"')+' pointer-events="none"/>';
  });
  if(st.sel!=null&&fp.rooms&&fp.rooms[st.sel]){
    const poly=G.poly(fp.rooms[st.sel].polygon);
    poly.forEach(function(p,i){
      const n=poly[(i+1)%poly.length],m=v.toLocal((p[0]+n[0])/2,(p[1]+n[1])/2,0);
      s+='<circle cx="'+rsFpR(m[0])+'" cy="'+rsFpR(m[1])+'" r="3.5" fill="'+RS_FP_ACCENT+'" opacity=".75" pointer-events="none"/>';
    });
    poly.forEach(function(p,i){const q=v.toLocal(p[0],p[1],0);s+='<circle cx="'+rsFpR(q[0])+'" cy="'+rsFpR(q[1])+'" r="5.5" fill="'+(st.vtx===i?RS_FP_ACCENT:'#fff')+'" stroke="'+RS_FP_ACCENT+'" stroke-width="2" pointer-events="none"/>';});
    if(poly.length>=3){
      const b=G.bbox(poly),top=v.toLocal((b[0]+b[2])/2,b[1],0);
      s+='<text x="'+rsFpR(top[0])+'" y="'+rsFpR(top[1]-10)+'" text-anchor="middle" font-size="12" font-family="system-ui,sans-serif" fill="#fff" stroke="#0b0e12" stroke-width="3" paint-order="stroke" pointer-events="none">'
        +rsFpR(b[2]-b[0])+' × '+rsFpR(b[3]-b[1])+' m · '+rsFpR(Math.abs(G.area(poly)))+' m²</text>';
    }
  }
  const d=st.draft;
  if(d&&d.kind==='rect'&&d.a&&d.b){
    const pts=[[d.a[0],d.a[1]],[d.b[0],d.a[1]],[d.b[0],d.b[1]],[d.a[0],d.b[1]]];
    s+='<polygon points="'+pts.map(P).join(' ')+'" fill="rgba(3,169,244,.15)" stroke="'+RS_FP_ACCENT+'" stroke-width="2" pointer-events="none"/>';
  }
  if(d&&(d.kind==='poly'||d.kind==='calib')&&d.pts.length){
    const pts=d.pts.concat(d.hover?[d.hover]:[]);
    s+='<polyline points="'+pts.map(P).join(' ')+'" fill="none" stroke="'+(d.kind==='calib'?'#ffd166':RS_FP_ACCENT)+'" stroke-width="2" stroke-dasharray="6 4" pointer-events="none"/>';
    d.pts.forEach(function(p,i){const q=v.toLocal(p[0],p[1],0);s+='<circle cx="'+rsFpR(q[0])+'" cy="'+rsFpR(q[1])+'" r="'+(i===0?7:4.5)+'" fill="'+(d.kind==='calib'?'#ffd166':RS_FP_ACCENT)+'" stroke="#fff" stroke-width="1.5" pointer-events="none"/>';});
  }
  g.innerHTML=s;
};
// ---- pointer input ----
RocStudio.prototype._fpBind=function(svg){
  const self=this;
  const on=function(){return self._fpActive()&&self._fpView&&self._fpView.svg===svg;};
  svg.addEventListener('pointerdown',function(e){
    if(!on()||e.button>0)return;e.stopPropagation();e.preventDefault();
    try{svg.setPointerCapture(e.pointerId);}catch(_){}
    // preventDefault keeps the focus where it was — often a Properties field the edit then
    // rebuilds, leaving it on <body>, outside the dialog that listens for Delete / Esc / Ctrl+Z
    try{
      const a2=self._sr.activeElement;if(a2&&/^(INPUT|SELECT|TEXTAREA)$/.test(a2.tagName))a2.blur(); // a field's change commits first
      const h=self._sr.host;if(!h.hasAttribute('tabindex'))h.setAttribute('tabindex','-1');
      if(self._sr.activeElement==null||self._sr.activeElement===a2)h.focus({preventScroll:true});
    }catch(_){}
    self._fpDown(e);
  });
  svg.addEventListener('pointermove',function(e){if(!on())return;self._fpMove(e);});
  svg.addEventListener('pointerup',function(e){if(!on())return;e.stopPropagation();self._fpUp(e);});
  svg.addEventListener('dblclick',function(e){if(!on())return;e.stopPropagation();e.preventDefault();const st=self._fpState();if(st.draft&&st.draft.kind==='poly')self._fpFinishPoly();});
  // a click must not reach the card (Arrange mode selects elements on click)
  svg.addEventListener('click',function(e){if(on())e.stopPropagation();});
};
RocStudio.prototype._fpAt=function(e){const v=this._fpView,lp=v.clientToLocal(e.clientX,e.clientY);return{lp:lp,p:v.toPlan(lp[0],lp[1])};};
// Snap: to the x / y of any corner within 10 px (walls line up), else to 5 cm. Alt = free.
RocStudio.prototype._fpSnap=function(p,e,ex){
  if(e&&e.altKey)return[rsFpR(p[0]),rsFpR(p[1])];
  const v=this._fpView,G=this.G,fp=this._fpTmp||this._fpCfg(),tol=10/(v.F.S||50);
  let x=p[0],y=p[1],bx=null,by=null,dx=tol,dy=tol;
  (fp.rooms||[]).forEach(function(r,ri){G.poly(r&&r.polygon).forEach(function(q,qi){
    if(ex&&ri===ex.room&&(ex.v==null||qi===ex.v))return;
    const ax=Math.abs(q[0]-x),ay=Math.abs(q[1]-y);
    if(ax<dx){dx=ax;bx=q[0];}if(ay<dy){dy=ay;by=q[1];}
  });});
  return[rsFpR(bx!=null?bx:Math.round(x/0.05)*0.05),rsFpR(by!=null?by:Math.round(y/0.05)*0.05)];
};
// the wall point nearest to p over every room: {at, d, room, edge}
RocStudio.prototype._fpWallAt=function(p,fp){
  const G=this.G;let best=null;
  (fp.rooms||[]).forEach(function(r,ri){
    const poly=G.poly(r&&r.polygon);
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(!l2)continue;
      let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2;t=Math.max(0,Math.min(1,t));
      const q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(p[0]-q[0],p[1]-q[1]);
      if(!best||d<best.d)best={at:[rsFpR(q[0]),rsFpR(q[1])],d:d,room:ri,edge:i};
    }
  });
  return best;
};
RocStudio.prototype._fpDown=function(e){
  const st=this._fpState(),v=this._fpView,G=this.G,fp=this._fpCfg(),a=this._fpAt(e);
  const near=function(p,px){const q=v.toLocal(p[0],p[1],0);return Math.hypot(q[0]-a.lp[0],q[1]-a.lp[1])<=px;};
  this._fpDrag=null;
  if(st.tool==='calib'){
    const d=st.draft&&st.draft.kind==='calib'?st.draft:(st.draft={kind:'calib',pts:[]});
    d.pts.push([rsFpR(a.p[0]),rsFpR(a.p[1])]);
    if(d.pts.length>=2)this._fpCalibAsk(d.pts[0],d.pts[1]);
    this._fpDraw();return;
  }
  if(st.tool==='rect'){st.draft={kind:'rect',a:this._fpSnap(a.p,e),b:this._fpSnap(a.p,e)};this._fpDrag={kind:'rect'};this._fpDraw();return;}
  if(st.tool==='poly'){
    const p=this._fpSnap(a.p,e);
    if(!st.draft||st.draft.kind!=='poly')st.draft={kind:'poly',pts:[p]};
    else if(st.draft.pts.length>=3&&near(st.draft.pts[0],10)){this._fpFinishPoly();return;}
    else st.draft.pts.push(p);
    this._fpDraw();return;
  }
  if(st.tool==='door'||st.tool==='window'){
    const w=this._fpWallAt(a.p,fp);
    if(!w||w.d>0.6){this._fpFlash('fp_door_nowall');return;}
    const self=this,type=st.tool;let k=-1;
    const op=Object.assign({type:type,at:w.at,width:type==='window'?1:0.8},rsFpOpeningGuess(this.hass,this.work,fp,w.room,type));
    this._fpEdit(function(f){if(!Array.isArray(f.openings))f.openings=[];f.openings.push(op);k=f.openings.length-1;});
    st.tool='select';self._fpSelect('door',k);return;
  }
  if(st.tool==='marker'){
    const p=this._fpSnap(a.p,e),self=this;let k=-1;
    this._fpEdit(function(f){if(!Array.isArray(f.items))f.items=[];f.items.push({type:'marker',at:p});k=f.items.length-1;});
    st.tool='select';self._fpSelect('item',k);return;
  }
  // select tool: markers first (they sit on top), then corners of the selected room, doors, rooms
  const its=Array.isArray(fp.items)?fp.items:[];
  for(let k=its.length-1;k>=0;k--){const at=G.poly([its[k]&&its[k].at])[0];if(at&&near(at,20)){if(st.item!==k)this._fpSelect('item',k);this._fpDrag={kind:'item',k:k,start:a.p,orig:at};return;}}
  const rooms=Array.isArray(fp.rooms)?fp.rooms:[];
  if(st.sel!=null&&rooms[st.sel]){
    const poly=G.poly(rooms[st.sel].polygon);
    for(let i=0;i<poly.length;i++)if(near(poly[i],9)){st.vtx=i;this._fpDrag={kind:'vtx',i:i,start:a.p};this._fpDraw();this._fpChrome();return;}
    for(let i=0;i<poly.length;i++){
      const n=poly[(i+1)%poly.length],m=[(poly[i][0]+n[0])/2,(poly[i][1]+n[1])/2];
      if(near(m,8)){
        // a new corner in the middle of the edge, dragged right away
        const tmp=JSON.parse(rsJ(fp));tmp.rooms[st.sel].polygon=poly.map(function(q){return q.slice();});tmp.rooms[st.sel].polygon.splice(i+1,0,[rsFpR(m[0]),rsFpR(m[1])]);
        this._fpTmp=tmp;st.vtx=i+1;this._fpDrag={kind:'vtx',i:i+1,start:a.p,moved:true};this._fpPreview();return;
      }
    }
  }
  const ops=Array.isArray(fp.openings)?fp.openings:[];
  for(let k=ops.length-1;k>=0;k--){const at=G.poly([ops[k]&&ops[k].at])[0];if(at&&near(at,9)){this._fpSelect('door',k);this._fpDrag={kind:'door',k:k,start:a.p};return;}}
  for(let i=rooms.length-1;i>=0;i--){
    const poly=G.poly(rooms[i]&&rooms[i].polygon);
    if(poly.length>=3&&G.inPoly(a.p[0],a.p[1],poly)){
      if(st.sel!==i)this._fpSelect('room',i);else{st.vtx=null;this._fpDraw();}
      this._fpDrag={kind:'room',i:i,start:a.p,orig:poly};return;
    }
  }
  if(st.sel!=null||st.door!=null||st.item!=null)this._fpSelect(null,null);
};
RocStudio.prototype._fpMove=function(e){
  const st=this._fpState(),d=this._fpDrag,a=this._fpAt(e);
  if(!d){if(st.draft&&(st.draft.kind==='poly'||st.draft.kind==='calib')){st.draft.hover=st.draft.kind==='poly'?this._fpSnap(a.p,e):a.p;this._fpDraw();}return;}
  if(d.kind==='rect'){st.draft.b=this._fpSnap(a.p,e);this._fpDraw();return;}
  const base=this._fpTmp||this._fpCfg(),fp=JSON.parse(rsJ(this._fpCfg()));
  if(d.kind==='vtx'){
    const r=(this._fpTmp||fp).rooms[st.sel];if(!r)return;
    const tmp=JSON.parse(rsJ(base));
    tmp.rooms[st.sel].polygon=this.G.poly(r.polygon);
    tmp.rooms[st.sel].polygon[d.i]=this._fpSnap(a.p,e,{room:st.sel,v:d.i});
    this._fpTmp=tmp;d.moved=true;this._fpPreview();return;
  }
  if(d.kind==='room'){
    const dx=a.p[0]-d.start[0],dy=a.p[1]-d.start[1];
    if(!d.moved&&Math.hypot(dx,dy)*(this._fpView.F.S||50)<4)return;
    // snap the room's first corner, move every corner by the same amount
    const p0=this._fpSnap([d.orig[0][0]+dx,d.orig[0][1]+dy],e,{room:d.i});
    const sx=p0[0]-d.orig[0][0],sy=p0[1]-d.orig[0][1];
    fp.rooms[d.i].polygon=d.orig.map(function(q){return[rsFpR(q[0]+sx),rsFpR(q[1]+sy)];});
    this._fpTmp=fp;d.moved=true;this._fpPreview();return;
  }
  if(d.kind==='door'){
    const w=this._fpWallAt(a.p,fp);if(!w)return;
    fp.openings[d.k].at=w.at;this._fpTmp=fp;d.moved=true;this._fpPreview();
  }
  if(d.kind==='item'){
    const dx=a.p[0]-d.start[0],dy=a.p[1]-d.start[1];
    if(!d.moved&&Math.hypot(dx,dy)*(this._fpView.F.S||50)<4)return;
    if(!fp.items||!fp.items[d.k])return;
    fp.items[d.k].at=this._fpSnap([d.orig[0]+dx,d.orig[1]+dy],e);this._fpTmp=fp;d.moved=true;this._fpPreview();
  }
};
RocStudio.prototype._fpUp=function(e){
  const st=this._fpState(),d=this._fpDrag;this._fpDrag=null;
  if(!d)return;
  if(d.kind==='rect'){
    const a=st.draft&&st.draft.a,b=st.draft&&st.draft.b;st.draft=null;
    if(!a||!b||Math.abs(a[0]-b[0])<0.3||Math.abs(a[1]-b[1])<0.3){this._fpDraw();return;}
    const x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),y0=Math.min(a[1],b[1]),y1=Math.max(a[1],b[1]);
    this._fpAddRoom([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);return;
  }
  const tmp=this._fpTmp;this._fpTmp=null;
  if(tmp&&d.moved){
    this._fpEdit(function(f){f.rooms=tmp.rooms;if(tmp.openings)f.openings=tmp.openings;if(tmp.items)f.items=tmp.items;});
  }else this._fpDraw();
};
RocStudio.prototype._fpPreview=function(){
  const v=this._fpView;if(!v)return;
  try{v.setOptions({cfg:this._fpTmp||this._fpCfg()});}catch(_){}
};
RocStudio.prototype._fpAddRoom=function(poly){
  const st=this._fpState(),self=this;let k=-1;
  const n=(this._fpCfg().rooms||[]).length+1;
  this._fpEdit(function(f){if(!Array.isArray(f.rooms))f.rooms=[];f.rooms.push({name:self.t('fp_room_n',{n:n}),polygon:poly.map(function(p){return[rsFpR(p[0]),rsFpR(p[1])];}),floor:'wood'});k=f.rooms.length-1;});
  st.tool='select';st.draft=null;
  this._fpSelect('room',k);
};
RocStudio.prototype._fpFinishPoly=function(){
  const st=this._fpState(),d=st.draft;
  if(!d||d.kind!=='poly'||d.pts.length<3){st.draft=null;this._fpDraw();return;}
  const pts=d.pts.slice();st.draft=null;
  this._fpAddRoom(pts);
};
RocStudio.prototype._fpFlash=function(k){
  if(!this._fpHint)return;const h=this._fpHint,self=this;
  h.textContent=this.t(k);h.classList.add('warn');
  clearTimeout(this._fpFlashT);this._fpFlashT=setTimeout(function(){h.classList.remove('warn');self._fpChrome();},2500);
};
// Delete: the selected corner (a room keeps at least 3), else the door, else the room
RocStudio.prototype._fpDel=function(){
  if(this._fpIdx()<0)return false;
  const st=this._fpState(),fp=this._fpCfg(),G=this.G;
  if(st.sel!=null&&st.vtx!=null&&fp.rooms&&fp.rooms[st.sel]&&G&&G.poly(fp.rooms[st.sel].polygon).length>3){
    const i=st.sel,v=st.vtx;st.vtx=null;
    this._fpEdit(function(f){f.rooms[i].polygon=G.poly(f.rooms[i].polygon);f.rooms[i].polygon.splice(v,1);});
    this._fpDraw();return true;
  }
  if(st.item!=null&&fp.items&&fp.items[st.item]){
    const k=st.item;st.item=null;
    this._fpEdit(function(f){f.items.splice(k,1);if(!f.items.length)delete f.items;});
    this._fpSelect(null,null);return true;
  }
  if(st.door!=null&&fp.openings&&fp.openings[st.door]){
    const k=st.door;st.door=null;
    this._fpEdit(function(f){f.openings.splice(k,1);if(!f.openings.length)delete f.openings;});
    this._fpSelect(null,null);return true;
  }
  if(st.sel!=null&&fp.rooms&&fp.rooms[st.sel]){
    const i=st.sel;st.sel=null;
    this._fpEdit(function(f){f.rooms.splice(i,1);});
    this._fpSelect(null,null);return true;
  }
  return false;
};
RocStudio.prototype._fpEnter=function(){
  if(this._fpIdx()<0)return false;
  const st=this._fpState();
  if(st.draft&&st.draft.kind==='poly'){this._fpFinishPoly();return true;}
  return false;
};
RocStudio.prototype._fpEsc=function(){
  if(this._fpIdx()<0)return false;
  const st=this._fpState();
  if(st.draft){st.draft=null;if(st.tool==='calib')st.tool='select';this._fpDraw();this._fpChrome();return true;}
  if(st.tool!=='select'){this._fpTool('select');return true;}
  if(st.vtx!=null){st.vtx=null;this._fpDraw();return true;}
  if(st.sel!=null||st.door!=null||st.item!=null){this._fpSelect(null,null);return true;}
  return false;
};
// ---- add a floor plan page ----
RocStudio.prototype.addFloorplan=function(){
  const self=this;
  const c=JSON.parse(rsJ(this.work));
  if(!Array.isArray(c.rooms)||!c.rooms.length){this._panel(this.t('fp_add'),[this.t('fp_add_norooms')],[{label:this.t('ok'),cls:'primary',id:'cancel'}]);return;}
  let id='floorplan',n=1;while(c.rooms.some(function(r){return r&&r.id===id;})){n++;id='floorplan_'+n;}
  const at=c.rooms[0]&&c.rooms[0].overview?1:0;
  c.rooms.splice(at,0,{id:id,name:this.t('fp_page_name'),icon:'mdi:floor-plan',floorplan:{theme:'night'}});
  this.sel=null;this.multi=[];this.cardSel=null;this.fp=null;
  this._commit(c,'studio');
  this._setRoom(at,false,'outline');
  this._fpGeom().then(function(){if(rsFpSensors(self.hass).length)self._fpImport();},function(e){console.warn('[room-overlay-card] floorplan:',e);});
};
// ---- AnyVac import (V7_PLAN §6.3) ----
RocStudio.prototype._fpImport=function(){
  const self=this;
  if(this._fpIdx()<0)return;
  this._fpGeom().then(function(G){self._fpImportPanel(G);},function(e){self._panel(self.t('fp_import'),[String(e&&e.message||e)],[{label:self.t('ok'),cls:'primary',id:'cancel'}]);});
};
RocStudio.prototype._fpImportPanel=function(G){
  const self=this,hass=this.hass,S=(hass&&hass.states)||{};
  const ids=rsFpSensors(hass);
  if(!ids.length){this._panel(this.t('fp_import'),[this.t('fp_imp_none')],[{label:this.t('ok'),cls:'primary',id:'cancel'}]);return;}
  const fp0=this._fpCfg();
  const prefer=fp0.source&&fp0.source.anyvac&&ids.indexOf(fp0.source.anyvac)>=0?fp0.source.anyvac:
    (ids.find(function(id){const r=S[id].attributes.registration;return r&&r.status==='reference';})||ids[0]);
  const st={id:prefer,links:{},clean:true,doors:!(Array.isArray(fp0.openings)&&fp0.openings.length),entities:true};
  const body=rsEl('div',{class:'fpimp'});
  const sel=rsEl('select',{class:'pf-in','data-fp':'sensor',onchange:function(){st.id=sel.value;st.links={};draw();}});
  ids.forEach(function(id){sel.appendChild(rsEl('option',{value:id,text:(S[id].attributes.friendly_name||id)+' · '+id}));});
  sel.value=st.id;
  const info=rsEl('div',{class:'pf-sub'});
  const prev=rsEl('div',{class:'fpimp-prev'});
  const map=rsEl('div',{class:'fpimp-map'});
  const opt=function(k){const cb=rsEl('input',{type:'checkbox','data-fp':k});cb.checked=!!st[k];cb.addEventListener('change',function(){st[k]=cb.checked;draw();});return rsEl('label',{class:'fpimp-opt'},[cb,rsEl('span',{text:self.t('fp_imp_'+k)})]);};
  body.appendChild(rsEl('label',{class:'pf-l',text:this.t('fp_imp_sensor')}));body.appendChild(sel);body.appendChild(info);
  body.appendChild(prev);
  body.appendChild(rsEl('div',{class:'pf-l',text:this.t('fp_imp_links')}));body.appendChild(map);
  body.appendChild(rsEl('div',{class:'fpimp-opts'},[opt('clean'),opt('doors'),opt('entities')]));
  if(Array.isArray(fp0.rooms)&&fp0.rooms.length)body.appendChild(rsEl('div',{class:'pf-note',text:this.t('fp_imp_reimport')}));
  let ok=null;
  const build=function(){return rsFpImport(G,hass,self.work,st.id,S[st.id],{links:st.links,clean:st.clean,doors:st.doors,entities:st.entities},fp0);};
  const draw=function(){
    const a=S[st.id]&&S[st.id].attributes||{},reg=a.registration||{};
    const usable=!reg.status||reg.status==='reference'||reg.status==='aligned';
    info.textContent=self.t('fp_imp_info',{n:(a.rooms||[]).length,s:reg.status||'—',f:a.home_frame?(a.home_frame.width_px+' × '+a.home_frame.height_px+' px · '+(Number(a.home_frame.cell_mm)/Number(a.home_frame.scale||1))+' mm/px'):'—'})+(usable?'':' '+self.t('fp_imp_unaligned'));
    if(ok)ok.disabled=!usable;
    // links
    map.innerHTML='';
    const cardRooms=rsFpPageRooms(self.work);
    (a.rooms||[]).forEach(function(vr){
      const key=String(vr.home_room_id||vr.segment_id||vr.name||'');
      if(!(key in st.links))st.links[key]=rsFpAutoLink(hass,self.work,vr);
      const s2=rsEl('select',{class:'pf-in','data-fplink':key,onchange:function(){st.links[key]=s2.value==='__skip'?null:s2.value;draw();}});
      s2.appendChild(rsEl('option',{value:'',text:self.t('fp_planonly')}));
      cardRooms.forEach(function(x){s2.appendChild(rsEl('option',{value:String(x.r.id),text:String((x.r.overview_tile&&x.r.overview_tile.name)||x.r.name||x.r.id)+' ('+x.r.id+')'}));});
      s2.appendChild(rsEl('option',{value:'__skip',text:self.t('fp_imp_skip')}));
      s2.value=st.links[key]===null?'__skip':(st.links[key]||'');
      map.appendChild(rsEl('div',{class:'fpimp-row'},[rsEl('span',{text:String(vr.name||key)}),rsIcon('mdi:arrow-right'),s2]));
    });
    // preview: the cleaned rooms, top view
    let fp;try{fp=build();}catch(e){prev.textContent=String(e&&e.message||e);return;}
    const polys=(fp.rooms||[]).map(function(r){return G.poly(r.polygon);}).filter(function(p){return p.length>=3;});
    const all=[];polys.forEach(function(p){p.forEach(function(q){all.push(q);});});
    if(!all.length){prev.innerHTML='';return;}
    const F=G.fit(all,'top',0,520,200,12,0);
    let sv='<svg viewBox="0 0 520 200" width="100%" style="display:block;background:#0e1116;border-radius:8px">';
    (fp.rooms||[]).forEach(function(r,i){
      const p=G.poly(r.polygon);if(p.length<3)return;
      sv+='<polygon points="'+p.map(function(q){const s=G.P(F,q[0],q[1],0);return rsFpR(s[0])+','+rsFpR(s[1]);}).join(' ')+'" fill="rgba(3,169,244,.18)" stroke="#8ecbff" stroke-width="1.5"/>';
      const c=G.pole(p),s=G.P(F,c[0],c[1],0);
      sv+='<text x="'+rsFpR(s[0])+'" y="'+rsFpR(s[1]+4)+'" text-anchor="middle" font-size="11" font-family="system-ui" fill="#e8eaed">'+String(r.name||r.room||'').replace(/[<&]/g,'')+'</text>';
    });
    (fp.openings||[]).forEach(function(o){const s=G.P(F,o.at[0],o.at[1],0);sv+='<circle cx="'+rsFpR(s[0])+'" cy="'+rsFpR(s[1])+'" r="4" fill="#7ee0b5"/>';});
    prev.innerHTML=sv+'</svg>';
  };
  draw();
  this._panel(this.t('fp_import'),[body],[
    {label:this.t('fp_imp_go'),cls:'primary',id:'fp-import-ok',fn:function(){
      const fp=build();
      self._fpEdit(function(f){Object.keys(f).forEach(function(k){delete f[k];});Object.assign(f,fp);});
      self.fp=null;self._fpChrome();self._renderOutlineList();self._syncProps(true);
    }},
    {label:this.t('cancel'),id:'cancel'}]);
  ok=this._app.querySelector('[data-act="fp-import-ok"]');
  draw();
};
// ---- doors where rooms touch ----
RocStudio.prototype._fpAutoDoors=function(){
  const self=this;
  this._fpGeom().then(function(G){
    const fp=self._fpCfg(),S=(self.hass&&self.hass.states)||{};
    const polys=(fp.rooms||[]).map(function(r){return G.poly(r&&r.polygon);});
    let paths=[];
    const src=fp.source&&fp.source.anyvac&&S[fp.source.anyvac];
    if(src&&Array.isArray(fp.source.origin_px)&&Number(fp.source.mm_per_px)>0){
      const o=fp.source.origin_px,k=Number(fp.source.mm_per_px)/1000,a=src.attributes||{};
      paths=[].concat(a.path_dry_home_px||[],a.path_wet_home_px||[]).map(function(seg){return G.poly(seg).map(function(p){return[(p[0]-o[0])*k,(p[1]-o[1])*k];});});
    }
    const old=(Array.isArray(fp.openings)?fp.openings:[]).filter(function(o){return o&&typeof o==='object';});
    const next=rsFpMergeDoors(G,G.doors(polys,paths),old);
    const nDoors=old.filter(function(o){return o.type!=='window';}).length,mDoors=next.filter(function(o){return o.type!=='window';}).length;
    const go=function(){self._fpEdit(function(f){if(next.length)f.openings=next;else delete f.openings;});self._fpSelect(null,null);};
    if(nDoors)self._panel(self.t('fp_doors'),[self.t('fp_doors_replace',{n:nDoors,m:mDoors})],[{label:self.t('fp_doors_go'),cls:'primary',id:'fp-doors-ok',fn:go},{label:self.t('cancel'),id:'cancel'}]);
    else go();
  });
};
// ---- tracing over an image (a floor plan picture, a scan) ----
RocStudio.prototype._fpTrace=function(){
  const self=this,fp=this._fpCfg(),tr=fp.trace&&typeof fp.trace==='object'?fp.trace:{};
  const body=rsEl('div',{class:'fpimp'});
  const url=rsEl('input',{type:'text',class:'pf-in','data-fp':'trace-url',placeholder:'/local/floorplan.png'});url.value=tr.image||'';
  const file=rsEl('input',{type:'file',accept:'image/*',style:'display:none'});
  const msg=rsEl('div',{class:'pf-sub'});
  const up=rsEl('button',{type:'button',class:'btn sm',onclick:function(){file.click();}},[rsIcon('mdi:upload'),rsEl('span',{text:self.t('fp_trace_upload')})]);
  file.addEventListener('change',function(){const f=file.files&&file.files[0];if(!f)return;msg.textContent=self.t('fp_trace_uploading');
    rsUploadImage(self.hass,f).then(function(u){url.value=u;msg.textContent='';},function(e){msg.textContent=self.t('wiz_upload_err',{m:String(e&&e.message||e)});});});
  body.appendChild(rsEl('p',{text:this.t('fp_trace_body')}));
  body.appendChild(rsEl('div',{class:'fpimp-row'},[url,up,file]));body.appendChild(msg);
  const set=function(u){
    if(!u){self._fpEdit(function(f){delete f.trace;});return;}
    const img=new Image();
    img.onload=function(){
      const w=img.naturalWidth||1000,h=img.naturalHeight||700;
      const G=self.G,all=[];(fp.rooms||[]).forEach(function(r){(G?G.poly(r.polygon):[]).forEach(function(p){all.push(p);});});
      const span=all.length&&G?Math.max(2,G.bbox(all)[2]-G.bbox(all)[0]):12;
      self._fpEdit(function(f){f.trace=Object.assign({opacity:0.5,x:0,y:0},f.trace&&f.trace.image===u?f.trace:{},{image:u,width_px:w,height_px:h});if(!(Number(f.trace.scale)>0))f.trace.scale=rsFpR(span/w*1000)/1000;});
      self._fpTool('calib');self._fpFlash('fp_trace_calib');
    };
    img.onerror=function(){self._panel(self.t('fp_trace'),[self.t('fp_trace_err')],[{label:self.t('ok'),cls:'primary',id:'cancel'}]);};
    img.src=u;
  };
  const btns=[{label:this.t('fp_trace_go'),cls:'primary',id:'fp-trace-ok',fn:function(){set(url.value.trim());}}];
  if(tr.image)btns.push({label:this.t('fp_trace_calib_btn'),id:'fp-trace-calib',fn:function(){self._fpTool('calib');}},{label:this.t('fp_trace_remove'),cls:'danger',id:'fp-trace-del',fn:function(){set('');}});
  btns.push({label:this.t('cancel'),id:'cancel'});
  this._panel(this.t('fp_trace'),[body],btns);
};
// two points clicked on the traced image: their real distance sets the image's scale
RocStudio.prototype._fpCalibAsk=function(a,b){
  const self=this,st=this._fpState();
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const inp=rsEl('input',{type:'number',step:'0.01',min:'0.1',class:'pf-in','data-fp':'calib-m'});inp.value=String(rsFpR(d));
  const done=function(){st.draft=null;st.tool='select';self._fpChrome();self._fpDraw();};
  this._panel(this.t('fp_trace_calib_t'),[this.t('fp_trace_calib_q',{d:rsFpR(d)}),inp],[
    {label:this.t('ok'),cls:'primary',id:'fp-calib-ok',fn:function(){
      const real=parseFloat(inp.value);
      if(real>0&&d>0)self._fpEdit(function(f){if(f.trace){const k=real/d;f.trace.scale=Number(f.trace.scale)*k;f.trace.x=rsFpR((Number(f.trace.x)||0)*k);f.trace.y=rsFpR((Number(f.trace.y)||0)*k);}});
      done();
    }},{label:this.t('cancel'),id:'cancel',fn:done}]);
};
