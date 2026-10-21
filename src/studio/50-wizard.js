// ---- New-card wizard (Phase 4c, v6.46.0, V7_PLAN §5.7) --------------------------------------
// Builds a card from what Home Assistant already knows: one room per area (name, icon, picture,
// aliases), the area's lights as light controls, its devices as icons to arrange later, the
// editor's section recipes, the nav and an optional overview page. Nothing is invented: every id,
// name, icon and picture comes from the area / entity registries or from the editor's own
// defaults. On an existing card the same wizard adds rooms for the areas it does not have yet.
//
// rsWizBuild(state, base, I, recipes) is pure (tested on its own): state is the wizard's answers,
// base the current config. The result replaces a fresh (placeholder) card, or extends an existing
// one — every key it does not touch stays as it was (KEEP).

const RS_WIZ_STEPS=['rooms','images','contents','nav','review'];
// slug for a room id — the same rule as the editor's "Create a room for each area"
function rsSlug(s){return String(s||'room').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'room';}
// the areas of Home Assistant, by floor (level), each with its usable entities
function rsWizAreas(hass){
  const areas=(hass&&hass.areas)||{},floors=(hass&&hass.floors)||{},ents=(hass&&hass.entities)||{},devs=(hass&&hass.devices)||{},st=(hass&&hass.states)||{};
  const byArea={};
  Object.keys(ents).forEach(function(eid){
    const e=ents[eid]||{};
    if(e.hidden||e.entity_category||!st[eid])return;   // diagnostics / config entities and hidden ones are not room devices
    const a=e.area_id||(e.device_id&&devs[e.device_id]&&devs[e.device_id].area_id);
    if(!a)return;
    (byArea[a]=byArea[a]||[]).push({id:eid,dom:eid.split('.')[0],name:(st[eid].attributes&&st[eid].attributes.friendly_name)||eid});
  });
  return Object.keys(areas).map(function(id){
    const a=areas[id]||{},f=a.floor_id&&floors[a.floor_id];
    return{area:id,name:String(a.name||id),icon:a.icon||null,picture:a.picture||null,aliases:Array.isArray(a.aliases)?a.aliases.filter(Boolean):[],
      floor:f?String(f.name||f.floor_id):'',level:f&&typeof f.level==='number'?f.level:(f?0:999),ents:(byArea[id]||[]).sort(function(x,y){return x.id.localeCompare(y.id);})};
  }).sort(function(x,y){return x.level-y.level||x.floor.localeCompare(y.floor)||x.name.localeCompare(y.name);});
}
// is this area already a room of the card (by id, name or area_match)?
function rsWizHasArea(cfg,a){
  const rooms=Array.isArray(cfg&&cfg.rooms)?cfg.rooms:[];
  const keys=[a.area,a.name].concat(a.aliases).map(function(x){return String(x).toLowerCase();});
  return rooms.some(function(r){
    if(!r)return false;
    const rk=[r.id,r.name].concat(Array.isArray(r.area_match)?r.area_match:(r.area_match?[r.area_match]:[])).filter(function(x){return x!=null;}).map(function(x){return String(x).toLowerCase();});
    return rk.some(function(x){return keys.indexOf(x)>=0;});
  });
}
function rsWizBuild(st,base,I,recipes){
  const fresh=!!st.fresh;
  const c=fresh?(function(){
    // a placeholder card: keep only what identifies it on the dashboard and its frame
    const o={};['type','card_id','grid_options','view_layout','card_mod','layout','aspect_ratio','border_radius'].forEach(function(k){if(base[k]!==undefined)o[k]=JSON.parse(rsJ(base[k]));});
    if(!o.type)o.type='custom:room-overlay-card';
    return o;
  })():JSON.parse(rsJ(base));
  const domIcon=(I&&I.domainIcon)||{};
  const stub=I&&I.stubImg;
  const iconDef=RS_TYPES.icon.def;
  // one room's own keys from an answer
  const roomBody=function(r,taken){
    const o={};
    if(r.image)o.base_image=r.image;
    if(r.camera)o.base_camera=r.camera;
    if(st.lights){
      const ls=(r.ents||[]).filter(function(e){return e.dom==='light';}).map(function(e){return e.id;});
      if(ls.length)o.light_controls={entities:ls};
    }
    if(st.icons){
      const icons=[];let col=0,row=0;
      (r.ents||[]).forEach(function(e){
        if(!domIcon[e.dom])return;   // the domains the card has an icon for (ROC_DOMAIN_ICON)
        const id=rsUniqueId(icons.concat(taken||[]),'icon_',e.id.replace(/[^A-Za-z0-9_-]/g,'_'));
        icons.push({id:id,entity:e.id,icon:domIcon[e.dom],top:rsPct(6+row*12),left:rsPct(6+col*12),size:iconDef.size});
        col++;if(col>=7){col=0;row++;}
      });
      if(icons.length)o.icons=icons;
    }
    return o;
  };
  const chosen=(st.rooms||[]).filter(function(r){return r.on!==false;});
  if(st.mode==='single'){
    const r=chosen[0]||{};
    const o=roomBody(r);
    if(!o.base_image&&!o.base_camera&&!c.base_image&&!c.base_camera&&stub)o.base_image=stub;
    Object.keys(o).forEach(function(k){c[k]=o[k];});
  }else{
    // an existing single-room card becomes the first room (same move as the editor's "convert")
    if(!Array.isArray(c.rooms)||!c.rooms.length){
      const had=(I&&I.ROOM_KEYS||[]).some(function(k){return c[k]!==undefined&&!(k==='base_image'&&I.isStubImg&&I.isStubImg(c[k]));});
      c.rooms=[];
      if(!fresh&&had){
        const first={id:'room_1',name:'Room 1'};
        (I.ROOM_KEYS||[]).forEach(function(k){if(c[k]!==undefined){first[k]=c[k];delete c[k];}});
        c.rooms.push(first);
      }
    }
    if(st.overview&&!c.rooms.some(function(r){return r&&r.overview;}))
      c.rooms.unshift({id:rsUniqueId(c.rooms,'overview','overview'),name:st.overviewName||'Overview',icon:'mdi:view-dashboard-outline',overview:true});
    chosen.forEach(function(r){
      const id=rsUniqueId(c.rooms,'room_',/^[a-z0-9_]+$/.test(r.area||'')?r.area:rsSlug(r.name));
      const room={id:id,name:String(r.name||id)};
      if(r.icon)room.icon=r.icon;
      if(r.aliases&&r.aliases.length)room.area_match=r.aliases.slice();
      Object.assign(room,roomBody(r));
      c.rooms.push(room);
    });
    // a room without a picture or camera falls back to the shared image: the placeholder sketch
    const bare=c.rooms.some(function(r){return r&&!r.overview&&!r.base_image&&!r.base_camera;});
    if(bare&&!c.base_image&&!c.base_camera&&stub)c.base_image=stub;
    if(fresh||!c.nav){
      const nav=Object.assign({},c.nav||{});
      if(st.navStyle)nav.style=st.navStyle;
      if(st.navPos)nav.position=st.navPos;
      if(Object.keys(nav).length)c.nav=nav;
    }
    if(st.roomEntity)c.room_entity=st.roomEntity;
  }
  (st.sections||[]).forEach(function(kind){
    const def=recipes&&recipes[kind];if(!def)return;
    if(!Array.isArray(c.sections))c.sections=[];
    c.sections.push(Object.assign({id:rsUniqueId(c.sections,'section_',kind)},JSON.parse(rsJ(def))));
  });
  return c;
}

// ---- the wizard UI ---------------------------------------------------------------------------
// recipes offered: the editor's own list (room-overlay-card-editor: _recipeDef); a recipe that
// auto-fills from a domain is offered only when Home Assistant has entities of that domain
const RS_WIZ_RECIPES=[['appliances','mdi:washing-machine','Appliances'],['cleaning','mdi:robot-vacuum','Cleaning'],['media','mdi:cast','Media'],['heating','mdi:radiator','Heating'],
  ['covers','mdi:window-shutter','Covers'],['electricity','mdi:flash','Electricity'],['weather','mdi:weather-partly-cloudy','Weather']];
function rsUploadImage(hass,file){
  if(!hass||typeof hass.fetchWithAuth!=='function')return Promise.reject(new Error('no upload'));
  const fd=new FormData();fd.append('file',file);
  // Home Assistant's own image store (what area pictures use); served without auth
  return hass.fetchWithAuth('/api/image/upload',{method:'POST',body:fd}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
    .then(function(j){if(!j||!j.id)throw new Error('no id');return'/api/image/serve/'+j.id+'/original';});
}
RocStudio.prototype._wizRecipes=function(){
  const ed=this._ed,out={};
  RS_WIZ_RECIPES.forEach(function(k){let d=null;if(ed&&typeof ed._recipeDef==='function')try{d=ed._recipeDef(k[0]);}catch(_){d=null;}if(d)out[k[0]]=d;});
  return out;
};
RocStudio.prototype.openWizard=function(opts){
  opts=opts||{};
  if(this._wiz)return;
  const self=this,I=this.I;
  const fresh=opts.fresh!=null?!!opts.fresh:!!(I.isStubCfg&&I.isStubCfg(this.work));
  const areas=rsWizAreas(this.hass);
  const recipes=this._wizRecipes();
  const doms=new Set(Object.keys((this.hass&&this.hass.states)||{}).map(function(e){return e.split('.')[0];}));
  const st={fresh:fresh,mode:'rooms',step:0,lights:true,icons:false,sections:[],navStyle:fresh?'thumbnails':null,navPos:fresh?'bottom':null,overview:false,roomEntity:null,
    rooms:areas.map(function(a){const has=!fresh&&rsWizHasArea(self.work,a);
      return{area:a.area,name:a.name,icon:a.icon,image:a.picture||'',camera:'',aliases:a.aliases,ents:a.ents,floor:a.floor,on:!has,has:has};})};
  if(!st.rooms.length)st.rooms.push({name:this.t('wiz_room_n',{n:1}),image:'',camera:'',ents:[],on:true,manual:true});
  this._wiz=st;
  const layer=rsEl('div',{class:'layer wiz-layer'});
  const p=rsEl('div',{class:'panel wiz',role:'dialog','aria-modal':'true','aria-label':this.t('wiz_title')});
  const head=rsEl('div',{class:'wiz-head'});
  const body=rsEl('div',{class:'wiz-body'});
  const foot=rsEl('div',{class:'pf wiz-foot'});
  p.appendChild(head);p.appendChild(body);p.appendChild(foot);layer.appendChild(p);
  const close=function(){const i=self._layers.indexOf(close);if(i>=0)self._layers.splice(i,1);layer.remove();self._wiz=null;};
  st.close=close;
  const steps=function(){return RS_WIZ_STEPS.filter(function(s){return!(s==='nav'&&(st.mode==='single'||!fresh));});};
  const btn=function(label,cls,act,fn,dis){return rsEl('button',{class:'btn'+(cls?' '+cls:''),type:'button','data-act':act,disabled:dis?true:null,onclick:fn},[label]);};
  const chosen=function(){return st.rooms.filter(function(r){return r.on;});};
  const render=function(){
    const ss=steps();if(st.step>=ss.length)st.step=ss.length-1;
    const step=ss[st.step];
    head.innerHTML='';
    head.appendChild(rsEl('h2',null,[rsIcon('mdi:auto-fix'),rsEl('span',{text:self.t(fresh?'wiz_title':'wiz_title_add')})]));
    const dots=rsEl('div',{class:'wiz-steps'});
    ss.forEach(function(s,i){dots.appendChild(rsEl('span',{class:'wiz-step'+(i===st.step?' cur':'')+(i<st.step?' done':''),'data-step':s,text:(i+1)+' '+self.t('wiz_s_'+s)}));});
    head.appendChild(dots);
    body.innerHTML='';
    self['_wiz_'+step](body,st,{areas:areas,recipes:recipes,doms:doms,fresh:fresh,render:render,chosen:chosen});
    foot.innerHTML='';
    foot.appendChild(btn(self.t('cancel'),'','wiz-cancel',close));
    foot.appendChild(rsEl('span',{class:'sp'}));
    if(st.step>0)foot.appendChild(btn(self.t('wiz_back'),'','wiz-back',function(){st.step--;render();}));
    const n=chosen().length;
    if(step==='review')foot.appendChild(btn(self.t(fresh?'wiz_create':'wiz_add'),'primary','wiz-create',function(){self._wizFinish(st,recipes);}));
    else foot.appendChild(btn(self.t('wiz_next'),'primary','wiz-next',function(){st.step++;render();},step==='rooms'&&!n&&!st.sections.length&&st.mode!=='single'&&fresh));
    st.render=render;
  };
  render();
  this._app.appendChild(layer);
  this._layers.push(close);
};
// step 1 — which rooms: one per area (by floor), or one room only
RocStudio.prototype._wiz_rooms=function(body,st,o){
  const self=this;
  if(o.fresh){
    const seg=rsEl('div',{class:'seg wiz-mode',role:'group'});
    [['rooms','wiz_mode_rooms'],['single','wiz_mode_single']].forEach(function(m){
      seg.appendChild(rsEl('button',{type:'button','data-mode':m[0],'aria-pressed':String(st.mode===m[0]),onclick:function(){st.mode=m[0];o.render();}},[self.t(m[1])]));
    });
    body.appendChild(seg);
  }
  if(st.mode==='single'){
    body.appendChild(rsEl('p',{text:this.t('wiz_single_body')}));
    const list=rsEl('div',{class:'wiz-list'});
    st.rooms.forEach(function(r,i){
      list.appendChild(rsEl('label',{class:'wiz-row'},[rsEl('input',{type:'radio',name:'wiz-single',checked:r.on&&st.rooms.findIndex(function(x){return x.on;})===i?true:null,onchange:function(){st.rooms.forEach(function(x,j){x.on=j===i;});}}),
        rsIcon(r.icon||'mdi:door'),rsEl('span',{class:'nm',text:r.name}),rsEl('span',{class:'sub',text:r.manual?'':self.t('wiz_n_dev',{n:r.ents.length})})]));
    });
    // radio semantics: exactly one room
    if(st.rooms.filter(function(x){return x.on;}).length!==1){st.rooms.forEach(function(x,j){x.on=j===0;});o.render();return;}
    body.appendChild(list);
    return;
  }
  body.appendChild(rsEl('p',{text:this.t(o.areas.length?(o.fresh?'wiz_rooms_body':'wiz_rooms_add_body'):'wiz_no_areas')}));
  const tools=rsEl('div',{class:'wiz-tools'},[
    rsEl('button',{class:'btn sm',type:'button','data-act':'wiz-all',onclick:function(){st.rooms.forEach(function(r){if(!r.has)r.on=true;});o.render();}},[this.t('wiz_all')]),
    rsEl('button',{class:'btn sm',type:'button','data-act':'wiz-none',onclick:function(){st.rooms.forEach(function(r){r.on=false;});o.render();}},[this.t('wiz_none')]),
  ]);
  body.appendChild(tools);
  const list=rsEl('div',{class:'wiz-list'});
  let floor=null;
  st.rooms.forEach(function(r){
    if(!r.manual&&r.floor!==floor){floor=r.floor;if(floor)list.appendChild(rsEl('div',{class:'wiz-floor',text:floor}));}
    const cb=rsEl('input',{type:'checkbox','data-area':r.area||'',disabled:r.has?true:null,onchange:function(){r.on=cb.checked;o.render();}});cb.checked=!!r.on;
    const row=rsEl('label',{class:'wiz-row'+(r.has?' has':'')},[cb,rsIcon(r.icon||'mdi:door')]);
    if(r.manual){
      const nm=rsEl('input',{type:'text',class:'pf-in','data-act':'wiz-manual-name',value:r.name,onchange:function(){r.name=nm.value.trim()||r.name;}});
      row.appendChild(nm);
    }else row.appendChild(rsEl('span',{class:'nm',text:r.name}));
    row.appendChild(rsEl('span',{class:'sub',text:r.has?self.t('wiz_has'):(r.manual?'':self.t('wiz_n_dev',{n:r.ents.length}))}));
    if(r.image)row.appendChild(rsEl('span',{class:'pf-thumb wiz-th',style:'background-image:url("'+String(r.image).replace(/"/g,'%22')+'")'}));
    list.appendChild(row);
  });
  body.appendChild(list);
  body.appendChild(rsEl('button',{class:'pf-add',type:'button','data-act':'wiz-add-room',onclick:function(){st.rooms.push({name:self.t('wiz_room_n',{n:st.rooms.filter(function(x){return x.manual;}).length+1}),image:'',camera:'',ents:[],on:true,manual:true});o.render();}},[rsIcon('mdi:plus'),rsEl('span',{text:this.t('wiz_add_room')})]));
};
// step 2 — a picture (or a camera) for each room
RocStudio.prototype._wiz_images=function(body,st,o){
  const self=this;
  body.appendChild(rsEl('p',{text:this.t('wiz_images_body')}));
  const canUp=!!(this.hass&&typeof this.hass.fetchWithAuth==='function');
  const ctx={t:function(k,v){return self.t(k,v);},get hass(){return self.hass;}};
  o.chosen().forEach(function(r){
    const row=rsEl('div',{class:'wiz-img','data-room':r.area||r.name});
    const th=rsEl('div',{class:'pf-thumb wiz-big'});
    const setTh=function(){th.style.backgroundImage=r.image?'url("'+String(r.image).replace(/"/g,'%22')+'")':'';th.classList.toggle('cam',!r.image&&!!r.camera);};
    setTh();
    const col=rsEl('div',{class:'wiz-imgcol'});
    const nm=rsEl('input',{type:'text',class:'pf-in','data-act':'wiz-name',value:r.name,onchange:function(){r.name=nm.value.trim()||r.name;}});
    col.appendChild(rsEl('div',{class:'wiz-nmrow'},[rsIcon(r.icon||'mdi:door'),nm]));
    const url=rsEl('input',{type:'text',class:'pf-in','data-act':'wiz-image',placeholder:'/local/'+(/^[a-z0-9_]+$/.test(r.area||'')?r.area:rsSlug(r.name))+'.webp',value:r.image||'',onchange:function(){r.image=url.value.trim();setTh();}});
    const line=rsEl('div',{class:'wiz-urlrow'},[url]);
    const msg=rsEl('span',{class:'pf-sub'});
    if(canUp){
      const file=rsEl('input',{type:'file',accept:'image/*',style:'display:none',onchange:function(){
        const f=file.files&&file.files[0];if(!f)return;
        msg.textContent=self.t('wiz_uploading');
        rsUploadImage(self.hass,f).then(function(u){r.image=u;url.value=u;setTh();msg.textContent='';},function(e){msg.textContent=self.t('wiz_upload_err',{m:String(e&&e.message||e)});});
      }});
      line.appendChild(file);
      line.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'wiz-upload',title:self.t('wiz_upload_hint'),onclick:function(){file.click();}},[rsIcon('mdi:upload'),rsEl('span',{class:'lbl',text:self.t('wiz_upload')})]));
    }
    col.appendChild(line);
    const cam=rsEntityInput(ctx,r.camera,['camera'],function(v){r.camera=v||'';setTh();},self.t('wiz_camera_ph'));
    cam.classList.add('wiz-cam');
    col.appendChild(cam);
    col.appendChild(msg);
    row.appendChild(th);row.appendChild(col);
    body.appendChild(row);
  });
  body.appendChild(rsEl('p',{class:'pf-note',text:this.t('wiz_images_note')}));
};
// step 3 — what goes into the rooms and the card
RocStudio.prototype._wiz_contents=function(body,st,o){
  const self=this;
  const ch=o.chosen();
  const nL=ch.reduce(function(a,r){return a+r.ents.filter(function(e){return e.dom==='light';}).length;},0);
  const domIcon=this.I.domainIcon||{};
  const nD=ch.reduce(function(a,r){return a+r.ents.filter(function(e){return!!domIcon[e.dom];}).length;},0);
  const opt=function(key,label,sub,act){
    const cb=rsEl('input',{type:'checkbox','data-act':act,onchange:function(){st[key]=cb.checked;}});cb.checked=!!st[key];
    return rsEl('label',{class:'wiz-row wiz-opt'},[cb,rsEl('span',{class:'nm',text:label}),rsEl('span',{class:'sub',text:sub})]);
  };
  body.appendChild(rsEl('h3',{text:this.t('wiz_c_rooms')}));
  body.appendChild(opt('lights',this.t('wiz_lights'),this.t('wiz_found',{n:nL}),'wiz-lights'));
  body.appendChild(opt('icons',this.t('wiz_icons'),this.t('wiz_found',{n:nD}),'wiz-icons'));
  body.appendChild(rsEl('h3',{text:this.t('wiz_c_sections')}));
  body.appendChild(rsEl('p',{text:this.t('wiz_sections_body')}));
  const grid=rsEl('div',{class:'wiz-recipes'});
  RS_WIZ_RECIPES.forEach(function(k){
    const def=o.recipes[k[0]];
    const ok=!!def&&(!def.domain||o.doms.has(def.domain));
    const cb=rsEl('input',{type:'checkbox','data-recipe':k[0],disabled:ok?null:true,onchange:function(){
      st.sections=st.sections.filter(function(x){return x!==k[0];});if(cb.checked)st.sections.push(k[0]);
    }});cb.checked=ok&&st.sections.indexOf(k[0])>=0;
    grid.appendChild(rsEl('label',{class:'wiz-row wiz-recipe'+(ok?'':' off'),title:ok?null:self.t(def?'wiz_recipe_none':'sec_needs')},[cb,rsIcon(k[1]),rsEl('span',{class:'nm',text:k[2]})]));
  });
  body.appendChild(grid);
};
// step 4 — navigation, overview page, presence (a new multi-room card)
RocStudio.prototype._wiz_nav=function(body,st,o){
  const self=this,S=RocSchema.ROC_SCHEMA;
  const sel=function(key,enumT,act){
    const s=rsEl('select',{class:'pf-in','data-act':act,onchange:function(){st[key]=s.value||null;}});
    enumT.slice(5).split('|').forEach(function(v){s.appendChild(rsEl('option',{value:v,text:v}));});
    s.value=st[key]||'';return s;
  };
  body.appendChild(rsEl('p',{text:this.t('wiz_nav_body')}));
  const g=rsEl('div',{class:'pf-grid'});
  const f=function(label,w){const b=rsEl('div',{class:'pf-field'});b.appendChild(rsEl('label',{class:'pf-l',text:label}));b.appendChild(w);return b;};
  g.appendChild(f(this.t('wiz_nav_style'),sel('navStyle',S.nav.keys.style.t,'wiz-nav-style')));
  g.appendChild(f(this.t('wiz_nav_pos'),sel('navPos',S.nav.keys.position.t,'wiz-nav-pos')));
  body.appendChild(g);
  const ov=rsEl('input',{type:'checkbox','data-act':'wiz-overview',onchange:function(){st.overview=ov.checked;}});ov.checked=!!st.overview;
  body.appendChild(rsEl('label',{class:'wiz-row wiz-opt'},[ov,rsEl('span',{class:'nm',text:this.t('wiz_overview')}),rsEl('span',{class:'sub',text:this.t('wiz_overview_sub')})]));
  const ctx={t:function(k,v){return self.t(k,v);},get hass(){return self.hass;}};
  const pe=rsEntityInput(ctx,st.roomEntity,['sensor','input_select','select'],function(v){st.roomEntity=v||null;},'sensor.current_room');
  body.appendChild(f(this.t('wiz_presence'),pe));
  body.appendChild(rsEl('p',{class:'pf-note',text:this.t('wiz_presence_note')}));
};
// step 5 — what will be created, and the YAML
RocStudio.prototype._wiz_review=function(body,st,o){
  const c=rsWizBuild(st,this.work,this.I,o.recipes);
  st.preview=c;
  const ul=rsEl('ul',{class:'wiz-sum'});
  const li=function(t){ul.appendChild(rsEl('li',{text:t}));};
  const rooms=Array.isArray(c.rooms)?c.rooms:[];
  if(st.mode==='single')li(this.t('wiz_sum_single'));
  else li(this.t('wiz_sum_rooms',{n:rooms.length,names:rooms.map(function(r){return r.name||r.id;}).join(', ')}));
  const all=[c].concat(rooms);
  const nLc=all.filter(function(r){return r&&r.light_controls;}).length,nIc=all.reduce(function(a,r){return a+((r&&r.icons)||[]).length;},0);
  if(st.lights&&nLc)li(this.t('wiz_sum_lights',{n:nLc}));
  if(st.icons&&nIc)li(this.t('wiz_sum_icons',{n:nIc}));
  if(st.sections.length)li(this.t('wiz_sum_sections',{s:st.sections.join(', ')}));
  if(c.base_image&&this.I.isStubImg&&this.I.isStubImg(c.base_image))li(this.t('wiz_sum_stub'));
  body.appendChild(ul);
  const ta=rsEl('textarea',{readonly:true,spellcheck:'false',class:'wiz-yaml'});ta.value=this.I.yaml.s(c);
  body.appendChild(ta);
  body.appendChild(rsEl('p',{class:'pf-note',text:this.t(st.fresh?'wiz_review_note':'wiz_review_note_add')}));
};
RocStudio.prototype._wizFinish=function(st,recipes){
  const c=rsWizBuild(st,this.work,this.I,recipes);
  st.close();
  this.sel=null;this.multi=[];this.cardSel=null;
  this._commit(c,'wizard');
  const rooms=this._rooms();
  if(rooms.length){
    const i=rooms.findIndex(function(r){return r&&!r.overview;});
    this._setRoom(Math.max(0,i),false,'wizard');
  }
  this._syncProps(true);
};
