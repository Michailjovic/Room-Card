// ---- Properties panel (Phase 4a, v6.44.0, V7_PLAN §5.7) -------------------------------------
// The studio's own forms for the selected element (or the room), generated from the schema
// registry: every key the schema lists for that element type gets a field of the right kind.
// Our own small components only — no HA Lit elements inside the studio (the v6.15.x lesson):
// entity picker (name / area / domain search, live state), icon picker (Home Assistant's own MDI
// list), colour, length, action builder, and YAML for the structured keys.
// KEEP rule (D4): a change rewrites only its own key; keys the form does not show (or the schema
// does not know) stay byte for byte.
const RS_SCHEMA_OF={zone:'zone',icon:'icon',label:'label',gauge:'gauge',glow:'glow',blind:'blind',element:'element',
  vacuum_widget:'vacuumWidget',badge:'badge',overlay:'overlay',group:'group'};
const RS_POS_KEYS=['top','left','bottom','right','width','height','size','z_index'];
const RS_ACT_KEYS=['tap_action','double_tap_action','hold_action','hold_delay'];
const RS_VIS_KEYS=['group','visible','visible_conditions','visible_template','fade','slide','nav_mini','section','tile'];
const RS_PROF_KEYS=['portrait','landscape','mobile','tablet','desktop','ultrawide'];
// Entity domains listed first in the picker (any entity can still be chosen).
const RS_DOMAINS={blind:['cover'],glow:['light'],gauge:['sensor','number','input_number','cover','light','climate'],
  label:['sensor','binary_sensor','climate','weather','input_number'],icon:['light','switch','binary_sensor','cover','fan','lock','media_player','climate'],
  zone:['light','switch','cover','scene','script'],vacuum_widget:['vacuum']};
// Room form (no element selected in a multi-room card); the card form (single-room card, or
// Global) edits the shared defaults the rooms fall back to
const RS_ROOM_KEYS=['name','id','icon','base_image','base_camera','camera_refresh','area_match'];
const RS_CARD_KEYS=['base_image','base_camera','camera_refresh'];
const RS_ACT_FALLBACK=[['','— not set —'],['custom','Custom (YAML)']];
function rsActTypes(ctx){return(ctx.I&&Array.isArray(ctx.I.actTypes)&&ctx.I.actTypes.length)?ctx.I.actTypes:RS_ACT_FALLBACK;}

function rsLabel(k){const s=String(k).replace(/_/g,' ');return s.charAt(0).toUpperCase()+s.slice(1);}
// 'enum:a|b|obj:x' → ['enum:a|b','obj:x'] (same rule as the schema registry)
function rsAlts(t){
  const parts=String(t).split('|'),out=[];
  for(const p of parts){
    const prev=out.length?out[out.length-1]:'';
    if(prev.indexOf('enum:')===0&&!/^(enum|obj|list|prof):/.test(p))out[out.length-1]+='|'+p;
    else out.push(p);
  }
  return out;
}
const RS_SIMPLE=['str','num','bool','len','url','entity','tmpl','color'];
function rsIsSimple(a){return RS_SIMPLE.indexOf(a)>=0||a.indexOf('enum:')===0;}
// the simple alternative of a union that fits the value now set (null → only YAML can show it)
function rsPickSimple(alts,v){
  const s=alts.filter(rsIsSimple);
  if(!s.length)return null;
  if(v===undefined||v===null)return s[0];
  const ty=typeof v;
  if(ty==='boolean')return s.indexOf('bool')>=0?'bool':null;
  if(ty==='number')return s.find(function(a){return a==='num'||a==='len';})||s.find(function(a){return a==='str';})||null;
  if(ty==='string'){
    const en=s.find(function(a){return a.indexOf('enum:')===0&&a.slice(5).split('|').indexOf(v)>=0;});
    if(en)return en;
    return s.find(function(a){return a!=='bool'&&a!=='num'&&a.indexOf('enum:')!==0;})||s.find(function(a){return a.indexOf('enum:')===0;})||null;
  }
  return null;
}

// ---- shared data: icon list (from Home Assistant itself), entity index ----------------------
let rsIconList=null,rsIconP=null;
function rsLoadIcons(){
  if(rsIconList)return Promise.resolve(rsIconList);
  if(rsIconP)return rsIconP;
  if(typeof fetch!=='function')return Promise.resolve(null);
  rsIconP=fetch('/static/mdi/iconList.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
    .then(function(l){rsIconList=(Array.isArray(l)?l:[]).map(function(x){return{n:'mdi:'+x.name,k:(x.keywords||[]).join(' ').toLowerCase()};});return rsIconList;})
    .catch(function(){rsIconP=null;return null;});
  return rsIconP;
}
function rsEntityIndex(hass){
  const st=(hass&&hass.states)||{},ents=(hass&&hass.entities)||{},devs=(hass&&hass.devices)||{},areas=(hass&&hass.areas)||{};
  return Object.keys(st).map(function(id){
    const s=st[id],a=s.attributes||{};
    const reg=ents[id]||{};
    const aid=reg.area_id||(reg.device_id&&devs[reg.device_id]&&devs[reg.device_id].area_id)||'';
    const area=aid&&areas[aid]?(areas[aid].name||''):'';
    return{id:id,dom:id.split('.')[0],name:a.friendly_name||'',area:area,state:s.state,unit:a.unit_of_measurement||''};
  });
}

// ---- field shell ------------------------------------------------------------------------------
function rsFieldBox(label,key,wide,msgs){
  const box=rsEl('div',{class:'pf-field'+(wide?' wide':''),'data-key':key});
  box.appendChild(rsEl('label',{class:'pf-l',text:label}));
  return box;
}
// pinned validation: the schema's findings for this key, under the field (refreshed in place)
function rsMsgs(box,msgs){
  Array.prototype.slice.call(box.children).forEach(function(c){if(c.classList.contains('v'))c.remove();});
  box.classList.toggle('has-error',(msgs||[]).some(function(m){return m.level==='error';}));
  (msgs||[]).forEach(function(m){box.appendChild(rsEl('div',{class:'pf-msg v '+m.level,text:m.msg}));});
}

// ---- pickers (dropdown list under an input, inside the studio's shadow root) ------------------
function rsPicker(input,getItems,onPick,render){
  const wrap=rsEl('div',{class:'rs-pick'});
  input.parentNode&&input.parentNode.replaceChild(wrap,input);
  wrap.appendChild(input);
  const list=rsEl('div',{class:'rs-list',role:'listbox'});
  wrap.appendChild(list);
  let items=[],act=-1;
  const close=function(){wrap.classList.remove('open');act=-1;};
  const paint=function(){
    list.innerHTML='';
    items.slice(0,60).forEach(function(it,i){
      const row=rsEl('div',{class:'rs-opt'+(i===act?' act':''),role:'option'});
      render(row,it);
      row.addEventListener('mousedown',function(e){e.preventDefault();onPick(it);close();});
      list.appendChild(row);
    });
    if(!items.length)list.appendChild(rsEl('div',{class:'rs-opt none',text:'—'}));
  };
  // on focus the whole list (the value already set is not a search); typing filters it
  const refresh=function(q){Promise.resolve(getItems(q)).then(function(r){items=r||[];act=-1;paint();});};
  input.addEventListener('focus',function(){wrap.classList.add('open');refresh('');});
  input.addEventListener('input',function(){wrap.classList.add('open');refresh(input.value);});
  input.addEventListener('blur',function(){setTimeout(close,120);});
  input.addEventListener('keydown',function(e){
    if(!wrap.classList.contains('open'))return;
    if(e.key==='ArrowDown'){e.preventDefault();act=Math.min(items.length-1,act+1);paint();}
    else if(e.key==='ArrowUp'){e.preventDefault();act=Math.max(0,act-1);paint();}
    else if(e.key==='Enter'&&act>=0&&items[act]){e.preventDefault();onPick(items[act]);close();}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
  });
  wrap._rsClose=close;
  return wrap;
}
// entity picker: search id / friendly name / area, preferred domains first, live state shown
function rsEntityInput(ctx,value,domains,onChange,ph){
  const inp=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false',placeholder:ph||((domains&&domains[0]||'light')+'.living_room')});
  inp.value=value||'';
  const hint=rsEl('div',{class:'pf-sub'});
  const showHint=function(){
    const v=inp.value.trim();
    const st=v&&ctx.hass&&ctx.hass.states&&ctx.hass.states[v];
    hint.className='pf-sub'+(v&&!st?' warn':'');
    hint.textContent=!v?'':(st?((st.attributes&&st.attributes.friendly_name?st.attributes.friendly_name+' · ':'')+st.state+(st.attributes&&st.attributes.unit_of_measurement?' '+st.attributes.unit_of_measurement:'')):ctx.t('ent_missing'));
  };
  const box=rsEl('div',{class:'pf-ent'});box.appendChild(inp);
  rsPicker(inp,function(q){
    q=String(q||'').trim().toLowerCase();
    const idx=rsEntityIndex(ctx.hass);
    const pref=domains||[];
    return idx.filter(function(e){return!q||e.id.toLowerCase().indexOf(q)>=0||e.name.toLowerCase().indexOf(q)>=0||e.area.toLowerCase().indexOf(q)>=0;})
      .sort(function(a,b){const pa=pref.indexOf(a.dom)<0?99:pref.indexOf(a.dom),pb=pref.indexOf(b.dom)<0?99:pref.indexOf(b.dom);return pa-pb||a.id.localeCompare(b.id);});
  },function(e){inp.value=e.id;showHint();onChange(e.id);},function(row,e){
    row.appendChild(rsEl('span',{class:'o-main',text:e.name||e.id}));
    row.appendChild(rsEl('span',{class:'o-sub',text:e.id+(e.area?' · '+e.area:'')}));
    row.appendChild(rsEl('span',{class:'o-st',text:e.state+(e.unit?' '+e.unit:'')}));
  });
  inp.addEventListener('change',function(){showHint();onChange(inp.value.trim()||undefined);});
  box.appendChild(hint);showHint();
  return box;
}
function rsIconInput(ctx,value,onChange){
  const box=rsEl('div',{class:'pf-icon'});
  const prev=rsIcon(value||'mdi:help-circle-outline');prev.classList.add('pf-icprev');
  const inp=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false',placeholder:'mdi:lightbulb'});
  inp.value=value||'';
  box.appendChild(prev);box.appendChild(inp);
  rsPicker(inp,function(q){
    q=String(q||'').trim().toLowerCase().replace(/^mdi:/,'');
    return rsLoadIcons().then(function(list){
      if(!list)return[];
      if(!q)return list.slice(0,60);
      const a=[],b=[];
      for(const x of list){if(x.n.indexOf(q)>=0)a.push(x);else if(x.k.indexOf(q)>=0)b.push(x);if(a.length>60)break;}
      return a.concat(b).slice(0,60);
    });
  },function(x){inp.value=x.n;prev.setAttribute('icon',x.n);onChange(x.n);},function(row,x){
    row.classList.add('ic');row.appendChild(rsIcon(x.n));row.appendChild(rsEl('span',{class:'o-main',text:x.n}));
  });
  inp.addEventListener('change',function(){const v=inp.value.trim();prev.setAttribute('icon',v||'mdi:help-circle-outline');onChange(v||undefined);});
  return box;
}

// ---- simple widgets ----------------------------------------------------------------------------
function rsSimpleWidget(ctx,a,value,onChange,o){
  o=o||{};
  if(a==='bool'){
    const cb=rsEl('input',{type:'checkbox',class:'pf-cb'});cb.checked=value===true;
    cb.addEventListener('change',function(){onChange(cb.checked?true:(o.dflt===true?false:undefined));});
    return cb;
  }
  if(a.indexOf('enum:')===0){
    const sel=rsEl('select',{class:'pf-in'});
    sel.appendChild(rsEl('option',{value:'',text:o.ph?'— '+o.ph+' —':(o.dflt!==undefined?'— '+ctx.t('dflt')+' ('+o.dflt+') —':'— '+ctx.t('not_set')+' —')}));
    a.slice(5).split('|').forEach(function(v){sel.appendChild(rsEl('option',{value:v,text:v===''?'(empty)':v}));});
    if(value!==undefined&&value!==null&&a.slice(5).split('|').indexOf(String(value))<0)sel.appendChild(rsEl('option',{value:String(value),text:String(value)+' ?'}));
    sel.value=value==null?'':String(value);
    sel.addEventListener('change',function(){onChange(sel.value===''?undefined:sel.value);});
    return sel;
  }
  if(a==='entity')return rsEntityInput(ctx,value,o.domains,onChange,o.ph);
  if(a==='color'){
    const box=rsEl('div',{class:'pf-color'});
    const sw=rsEl('input',{type:'color'});
    const tx=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false',placeholder:'#ffb35c / rgba(…) / var(--…)'});
    tx.value=value||'';
    if(/^#[0-9a-f]{6}$/i.test(value||''))sw.value=value;else sw.classList.add('unset'); // no colour set: not a black swatch
    sw.addEventListener('input',function(){sw.classList.remove('unset');tx.value=sw.value;});
    sw.addEventListener('change',function(){tx.value=sw.value;onChange(sw.value);});
    tx.addEventListener('change',function(){const v=tx.value.trim();const hex=/^#[0-9a-f]{6}$/i.test(v);if(hex)sw.value=v;sw.classList.toggle('unset',!hex);onChange(v||undefined);});
    box.appendChild(sw);box.appendChild(tx);
    return box;
  }
  if(a==='tmpl'){
    const ta=rsEl('textarea',{class:'pf-in mono',rows:'2',spellcheck:'false',placeholder:'{{ states(\'sensor.x\') }}'});ta.value=value==null?'':String(value);
    ta.addEventListener('change',function(){onChange(ta.value===''?undefined:ta.value);});
    return ta;
  }
  if(o.icon)return rsIconInput(ctx,value,onChange);
  const inp=rsEl('input',{type:a==='num'?'number':'text',class:'pf-in',spellcheck:'false'});
  if(a==='num')inp.step='any';
  if(a==='len')inp.placeholder='10% · 24px';
  if(a==='url')inp.placeholder='/local/…';
  if(o.ph)inp.placeholder=o.ph; // the value a room inherits from the shared defaults
  inp.value=value==null?'':String(value);
  // suggestions grounded in the config or Home Assistant (section / group / room ids, areas…);
  // any other value can still be typed
  if(o.choices&&o.choices.length&&a!=='num'){
    const dl=rsEl('datalist',{id:'rs-dl-'+Math.random().toString(36).slice(2)});
    o.choices.forEach(function(c){dl.appendChild(rsEl('option',{value:c[0],label:c[1]!==c[0]?c[1]:null}));});
    inp.setAttribute('list',dl.id);
    const box=rsEl('div',{class:'pf-dl'});box.appendChild(inp);box.appendChild(dl);
    inp.addEventListener('change',function(){const v=inp.value.trim();if(v===''){onChange(undefined);return;}onChange(v);});
    return box;
  }
  inp.addEventListener('change',function(){
    const v=inp.value.trim();
    if(v===''){onChange(undefined);return;}
    onChange((a==='num'||typeof value==='number')&&isFinite(Number(v))?Number(v):v); // a number stays a number
  });
  if(a==='url'){
    const box=rsEl('div',{class:'pf-url'});box.appendChild(inp);
    const img=rsEl('div',{class:'pf-thumb'});
    const set=function(){img.style.backgroundImage=inp.value.trim()?'url("'+inp.value.trim().replace(/"/g,'%22')+'")':'';};
    inp.addEventListener('change',set);set();
    box.appendChild(img);
    return box;
  }
  return inp;
}
// YAML for structured values (lists, objects, conditions, cards…): committed only when it parses
function rsYamlWidget(ctx,value,onChange,rows){
  const box=rsEl('div',{class:'pf-yaml'});
  const ta=rsEl('textarea',{class:'pf-in mono',rows:String(rows||3),spellcheck:'false'});
  ta.value=value===undefined?'':ctx.I.yaml.s(value);
  const err=rsEl('div',{class:'pf-msg error'});
  ta.addEventListener('change',function(){
    const s=ta.value;
    if(!s.trim()){err.textContent='';onChange(undefined);return;}
    const r=ctx.I.yaml.pe(s);
    if(r.err){err.textContent=r.err;return;}
    err.textContent='';onChange(r.val);
  });
  box.appendChild(ta);box.appendChild(err);
  return box;
}

// ---- action builder (same types and keys as the editor's, ROC_ACT_TYPES) ----------------------
function rsActType(ctx,a){
  if(a===undefined||a===null||a==='')return'';
  if(typeof a!=='object'||Array.isArray(a)||'condition'in a)return'custom';
  const t=a.action;
  if(t==='call-service')return(a.service||a.perform_action)?'perform-action':'custom';
  return rsActTypes(ctx).some(function(x){return x[0]===t;})?t:'custom';
}
function rsActionWidget(ctx,value,onChange,o){
  const box=rsEl('div',{class:'pf-act'});
  const t0=rsActType(ctx,value);
  const sel=rsEl('select',{class:'pf-in'});
  rsActTypes(ctx).forEach(function(x){sel.appendChild(rsEl('option',{value:x[0],text:x[1]}));});
  sel.value=t0;
  box.appendChild(sel);
  const body=rsEl('div',{class:'pf-actbody'});box.appendChild(body);
  let cur=value;
  const A=function(){return(cur&&typeof cur==='object'&&!Array.isArray(cur))?cur:{};};
  // KEEP: same type → start from the old object; another type → a new one (confirmation / haptic carried)
  const base=function(t){
    const a=A();
    if(rsActType(ctx,cur)===t)return JSON.parse(rsJ(a));
    const n={action:t};
    ['confirmation','haptic'].forEach(function(k){if(a[k]!==undefined)n[k]=JSON.parse(rsJ(a[k]));});
    return n;
  };
  const commit=function(v){cur=v;onChange(v);};
  const field=function(label,w){const f=rsEl('div',{class:'pf-sub2'});f.appendChild(rsEl('label',{class:'pf-l',text:label}));f.appendChild(w);body.appendChild(f);};
  const opts=function(list,val,cb){
    const s=rsEl('select',{class:'pf-in'});s.appendChild(rsEl('option',{value:'',text:'— '+ctx.t('choose')+' —'}));
    list.forEach(function(x){s.appendChild(rsEl('option',{value:x[0],text:x[1]}));});
    if(val&&!list.some(function(x){return x[0]===String(val);}))s.appendChild(rsEl('option',{value:String(val),text:val+' ?'}));
    s.value=val==null?'':String(val);s.addEventListener('change',function(){cb(s.value);});return s;
  };
  const set=function(t,k,v){const n=base(t);n.action=t;if(v===undefined||v==='')delete n[k];else n[k]=v;commit(n);};
  const draw=function(t){
    body.innerHTML='';
    const a=A(),same=rsActType(ctx,cur)===t;
    if(t==='more-info'||t==='toggle')field(ctx.t('f_entity'),rsEntityInput(ctx,same?a.entity:(o&&o.entity)||'',null,function(v){set(t,'entity',v);}));
    else if(t==='navigate'){const i=rsSimpleWidget(ctx,'str',same?(a.navigation_path!==undefined?a.navigation_path:a.path):'',function(v){const n=base(t);delete n.path;if(v)n.navigation_path=v;else delete n.navigation_path;commit(n);});i.placeholder='/lovelace/0';field(ctx.t('f_path'),i);}
    else if(t==='url'){const i=rsSimpleWidget(ctx,'str',same?(a.url_path!==undefined?a.url_path:a.url):'',function(v){const n=base(t);delete n.url;if(v)n.url_path=v;else delete n.url_path;commit(n);});i.placeholder='https://…';field('URL',i);}
    else if(t==='perform-action'){
      const svc=rsSimpleWidget(ctx,'str',same?(a.perform_action!==undefined?a.perform_action:a.service):'',function(v){const n=base(t);delete n.service;if(n.service_data!==undefined&&n.data===undefined)n.data=n.service_data;delete n.service_data;if(v)n.perform_action=v;else delete n.perform_action;commit(n);});
      svc.placeholder='script.turn_on';
      const dl=rsEl('datalist',{id:'rs-svc-'+Math.random().toString(36).slice(2)});
      const sv=(ctx.hass&&ctx.hass.services)||{};Object.keys(sv).forEach(function(d){Object.keys(sv[d]).forEach(function(s){dl.appendChild(rsEl('option',{value:d+'.'+s}));});});
      svc.setAttribute('list',dl.id);body.appendChild(dl);
      field(ctx.t('f_service'),svc);
      const te=same&&a.target&&typeof a.target==='object'&&typeof a.target.entity_id==='string'?a.target.entity_id:'';
      field(ctx.t('f_target'),rsEntityInput(ctx,te,null,function(v){const n=base(t);const tg=(n.target&&typeof n.target==='object')?Object.assign({},n.target):{};if(v)tg.entity_id=v;else delete tg.entity_id;if(Object.keys(tg).length)n.target=tg;else delete n.target;commit(n);}));
      field(ctx.t('f_data'),rsYamlWidget(ctx,same?(a.data!==undefined?a.data:a.service_data):undefined,function(v){const n=base(t);delete n.service_data;if(v&&typeof v==='object')n.data=v;else delete n.data;commit(n);},2));
    }
    else if(t==='open-section')field(ctx.t('f_section'),opts(((ctx.work.sections)||[]).map(function(s){return[String(s.id||''),String(s.title||s.id||'')];}),same?a.section:'',function(v){set(t,'section',v);}));
    else if(t==='switch-room')field(ctx.t('room'),opts(((ctx.work.rooms)||[]).map(function(r){return[String(r.id||''),String(r.name||r.id||'')];}),same?a.room:'',function(v){set(t,'room',v);}));
    else if(t==='toggle-group'||t==='show-group'||t==='hide-group'){
      const ids=[];[].concat(ctx.scope.groups||[],ctx.work.groups||[]).forEach(function(g){if(g&&g.id&&ids.indexOf(g.id)<0)ids.push(g.id);});
      field(ctx.t('f_group'),opts(ids.map(function(g){return[g,g];}),same?a.group:'',function(v){set(t,'group',v);}));
    }
    else if(t==='custom')field('YAML',rsYamlWidget(ctx,cur,function(v){commit(v);},3));
  };
  sel.addEventListener('change',function(){
    const t=sel.value;
    if(t===''){commit(undefined);draw('');return;}
    if(t==='custom'){draw('custom');return;}
    const n=base(t);n.action=t;
    if((t==='more-info'||t==='toggle')&&!n.entity&&o&&o.entity)n.entity=o.entity;
    commit(n);draw(t);
  });
  draw(t0);
  return box;
}


// ---- nested objects and lists (Phase 4b, v6.45.0) -------------------------------------------------
// `obj:X` and `list:X` keys whose schema X the registry knows get a sub-form / a list editor, so
// sections and their tiles, the nav, light controls, the overview page, cover controls… are forms
// too. Schemas built on conditions stay YAML (a form would not be simpler). Depth is capped.
const RS_YAML_SCHEMAS=['cond','condVal','baseImageCond','filterCond','companion','ovSideCard'];
const RS_MAX_DEPTH=4;
function rsFormSchema(name){const S=RocSchema.ROC_SCHEMA;return(name&&S[name]&&RS_YAML_SCHEMAS.indexOf(name)<0)?S[name]:null;}
// a shared value shown as a placeholder: the card's placeholder sketch by name, long values cut
function rsShort(ctx,v){
  const s=String(v);
  if(ctx.I&&ctx.I.isStubImg&&ctx.I.isStubImg(s))return ctx.t('stub_img');
  return s.length>48?s.slice(0,45)+'…':s;
}
function rsIsObj(v){return!!v&&typeof v==='object'&&!Array.isArray(v);}
function rsCount(v){return rsIsObj(v)?Object.keys(v).length:(Array.isArray(v)?v.length:0);}
// a short name for a list item: its title / name / id / entity…
function rsItemLabel(it,i){
  if(it==null||it==='')return'#'+(i+1);
  if(typeof it!=='object')return String(it);
  const v=it.title||it.name||it.id||it.entity||(it.pill&&(it.pill.entity||it.pill.text))||(it.card&&it.card.type)||it.type||(it.position!=null?String(it.position)+' %':'')||(it.value!=null?String(it.value):'');
  return v?String(v):'#'+(i+1);
}
function rsNest(ctx,label,openKey,count,body,extra){
  const d=rsEl('details',{class:'pf-nest','data-nest':openKey});
  if(ctx.open.has(openKey))d.open=true;
  d.addEventListener('toggle',function(){if(d.open)ctx.open.add(openKey);else ctx.open.delete(openKey);});
  const sm=rsEl('summary',null,[rsEl('span',{class:'nl',text:label}),rsEl('span',{class:'n',text:count?String(count):''})]);
  (extra||[]).forEach(function(x){sm.appendChild(x);});
  d.appendChild(sm);d.appendChild(body);
  return d;
}
// the fields of one object of schema `name`; keys the schema does not know stay (YAML box)
function rsObjForm(ctx,name,obj,onChange,o){
  const sch=rsFormSchema(name);
  let cur=rsIsObj(obj)?obj:{};
  const grid=rsEl('div',{class:'pf-grid pf-subgrid'});
  const set=function(k,v){const n=Object.assign({},cur);if(v===undefined)delete n[k];else n[k]=v;cur=n;onChange(Object.keys(n).length?n:undefined);};
  Object.keys(sch.keys).forEach(function(k){
    const def=sch.keys[k];if(def.legacy&&cur[k]===undefined)return;
    grid.appendChild(rsKeyField(ctx,k,def,cur[k],function(v){set(k,v);},{depth:o.depth,rel:o.rel+'.'+k,item:cur,schema:name}));
  });
  const other={};Object.keys(cur).forEach(function(k){if(!sch.keys[k]&&!(sch.hide&&sch.hide.indexOf(k)>=0))other[k]=cur[k];});
  if(Object.keys(other).length){
    const ob=rsFieldBox(ctx.t('other_keys'),'_other',true);
    ob.appendChild(rsYamlWidget(ctx,other,function(v){
      if(v===undefined)v={};if(!rsIsObj(v))return;
      const n=Object.assign({},cur);Object.keys(other).forEach(function(k){if(!(k in v))delete n[k];});Object.assign(n,v);cur=n;onChange(n);
    },2));
    grid.appendChild(ob);
  }
  return grid;
}
// a list of objects of schema `name`: one collapsible row per item, add / move / remove.
// A schema with `scalar` (light entities, nav chips…) keeps a plain string item a string.
function rsListWidget(ctx,name,arr,onChange,o){
  const sch=rsFormSchema(name);
  let cur=Array.isArray(arr)?arr:[];
  const box=rsEl('div',{class:'pf-list'});
  const sk=sch.scalar;
  const commit=function(n,rebuild){cur=n;onChange(n.length?n:undefined);if(rebuild)ctx.rerender();};
  cur.forEach(function(it,i){
    const rel=o.rel+'['+i+']';
    const scalar=sk&&(it==null||typeof it!=='object');
    const obj=scalar?(function(){const x={};if(it!=null&&it!=='')x[sk]=it;return x;})():it;
    const btn=function(icon,act,title,fn,dis){return rsEl('button',{type:'button',class:'pf-ib','data-act':act,title:title,'aria-label':title,disabled:dis?true:null,onclick:function(e){e.preventDefault();e.stopPropagation();fn();}},[rsIcon(icon)]);};
    const tools=rsEl('span',{class:'pf-tools'},[
      btn('mdi:arrow-up','up',ctx.t('move_up'),function(){const n=cur.slice();n.splice(i-1,0,n.splice(i,1)[0]);commit(n,true);},i===0),
      btn('mdi:arrow-down','down',ctx.t('move_down'),function(){const n=cur.slice();n.splice(i+1,0,n.splice(i,1)[0]);commit(n,true);},i===cur.length-1),
      btn('mdi:delete-outline','remove',ctx.t('remove'),function(){const n=cur.slice();n.splice(i,1);commit(n,true);}),
    ]);
    let body;
    if(!rsIsObj(obj)||o.depth>=RS_MAX_DEPTH)body=rsYamlWidget(ctx,it,function(v){const n=cur.slice();n[i]=v;commit(n);},3);
    else body=rsObjForm(ctx,name,obj,function(v){
      let nv=v===undefined?{}:v;
      if(scalar&&Object.keys(nv).every(function(k){return k===sk;}))nv=nv[sk]!==undefined?nv[sk]:''; // still just the entity: stays a plain string
      const n=cur.slice();n[i]=nv;commit(n);
    },{depth:o.depth+1,rel:rel});
    const row=rsNest(ctx,rsItemLabel(obj,i),'n:'+rel,0,body,[tools]);
    row.classList.add('pf-item');
    ctx.pin(row,rel,true);
    box.appendChild(row);
  });
  box.appendChild(rsEl('button',{type:'button',class:'pf-add','data-act':'add-item',onclick:function(){
    const n=cur.slice();n.push(sk&&cur.every(function(x){return x==null||typeof x!=='object';})?'':{});
    const k='n:'+o.rel+'['+(n.length-1)+']';ctx.open.add(k);if(ctx.focusNest)ctx.focusNest(k);commit(n,true);
  }},[rsIcon('mdi:plus'),rsEl('span',{text:ctx.t('add_item')})]));
  return box;
}
// a list of plain values (list:str / list:len): one input per value
function rsScalarList(ctx,a,arr,onChange,o){
  let cur=Array.isArray(arr)?arr.slice():[];
  const box=rsEl('div',{class:'pf-slist'});
  const commit=function(n,rebuild){cur=n;onChange(n.length?n:undefined);if(rebuild)ctx.rerender();};
  cur.forEach(function(v,i){
    const w=rsSimpleWidget(ctx,a,v,function(nv){const n=cur.slice();if(nv===undefined)n.splice(i,1);else n[i]=nv;commit(n,nv===undefined);},{choices:o.choices});
    box.appendChild(rsEl('div',{class:'pf-srow'},[w,rsEl('button',{type:'button',class:'pf-ib','data-act':'remove',title:ctx.t('remove'),'aria-label':ctx.t('remove'),onclick:function(){const n=cur.slice();n.splice(i,1);commit(n,true);}},[rsIcon('mdi:close')])]));
  });
  const add=rsSimpleWidget(ctx,a,undefined,function(nv){if(nv===undefined)return;commit(cur.concat([nv]),true);},{choices:o.choices,ph:ctx.t('add_value')});
  box.appendChild(rsEl('div',{class:'pf-srow add'},[add]));
  return box;
}

// ---- one field for a schema key ----------------------------------------------------------------
// prof:X → X, or {portrait, landscape} of X; unions pick the alternative that fits the value:
// a simple widget, a sub-form (obj:X), a list editor (list:X) — anything else is YAML.
// o: {depth, rel (path below the form's target, for pinned messages), item, inherit, schema}
function rsKeyField(ctx,key,def,value,onChange,o){
  o=o||{};const depth=o.depth||0,rel=o.rel||key;
  const t=String(def.t);
  const isProf=t.indexOf('prof:')===0;
  const inner=isProf?t.slice(5):t;
  const alts=rsAlts(inner);
  const simple=rsPickSimple(alts,isProf&&rsIsObj(value)?(value.portrait!==undefined?value.portrait:value.landscape):value);
  const hasStruct=alts.some(function(a){return!rsIsSimple(a);});
  const objName=(alts.find(function(a){return a.indexOf('obj:')===0&&rsFormSchema(a.slice(4));})||'').slice(4);
  const listName=(alts.find(function(a){return a.indexOf('list:')===0&&rsFormSchema(a.slice(5));})||'').slice(5);
  const sList=alts.find(function(a){return a==='list:str'||a==='list:len';});
  const iconKey=key==='icon'&&simple==='str';
  const choices=ctx.choices?ctx.choices(key,o.schema):null;
  const inh=o.inherit;
  const kd=RS_KEY_DOMAINS[(o.schema||'')+'.'+key];
  const wo={dflt:def.d,domains:kd||(key==='base_camera'?['camera']:(key==='entity'||/entity$/.test(key)?ctx.domains:null)),icon:iconKey,choices:choices,
    ph:inh!==undefined&&inh!==null&&typeof inh!=='object'?ctx.t('shared_ph',{v:rsShort(ctx,inh)}):null};
  const yamlMode=ctx.yamlKeys&&ctx.yamlKeys.has(rel);
  const canDeep=depth<RS_MAX_DEPTH;
  const asObj=!yamlMode&&canDeep&&objName&&(rsIsObj(value)||(value===undefined&&!simple));
  const asList=!yamlMode&&canDeep&&!isProf&&listName&&(Array.isArray(value)||(value===undefined&&!simple));
  const asSList=!yamlMode&&!isProf&&sList&&!listName&&(value===undefined?!simple:(Array.isArray(value)&&value.every(function(x){return x==null||typeof x!=='object';})));
  const isAct=t==='action';
  const label=ctx.labels[key]||rsLabel(key);
  const wide=isAct||asObj||asList||asSList||!simple||simple==='tmpl'||simple==='entity'||simple==='url'||iconKey||(hasStruct&&(Array.isArray(value)||(rsIsObj(value)&&!isProf)));
  const box=rsFieldBox(label,key,wide);
  const links=rsEl('div',{class:'pf-links'});
  const link=function(txt,fn,act){links.appendChild(rsEl('button',{type:'button',class:'pf-link','data-act':act||null,text:txt,onclick:fn}));};
  const done=function(exact){if(links.childNodes.length)box.appendChild(links);ctx.pin(box,rel,exact);return box;};
  // a room that only inherits a structured value: say so, edit it in Global or copy it here
  if(value===undefined&&inh!==undefined&&inh!==null&&typeof inh==='object'){
    box.appendChild(rsEl('div',{class:'pf-inh'},[rsEl('span',{text:ctx.t('inh_shared')})]));
    link(ctx.t('inh_edit'),function(){ctx.goGlobal();},'inh-edit');
    link(ctx.t('inh_copy'),function(){onChange(JSON.parse(rsJ(inh)));ctx.open.add('n:'+rel);ctx.rerender();},'inh-copy');
    return done(false);
  }
  if(isAct){box.appendChild(rsActionWidget(ctx,value,onChange,{entity:o.item&&o.item.entity}));return done(false);}
  const perProf=isProf&&rsIsObj(value)&&(('portrait'in value)||('landscape'in value));
  if(perProf){
    ['portrait','landscape'].forEach(function(p){
      const row=rsEl('div',{class:'pf-prof'});row.appendChild(rsEl('span',{class:'pf-tag',text:p}));
      row.appendChild(simple?rsSimpleWidget(ctx,simple,value[p],function(v){const n=Object.assign({},value);if(v===undefined)delete n[p];else n[p]=v;value=n;onChange(Object.keys(n).length?n:undefined);},wo):rsYamlWidget(ctx,value[p],function(v){const n=Object.assign({},value);if(v===undefined)delete n[p];else n[p]=v;value=n;onChange(n);}));
      box.appendChild(row);
    });
    link(ctx.t('one_value'),function(){onChange(value.landscape!==undefined?value.landscape:value.portrait);ctx.rerender();});
    return done(false);
  }
  if(asObj){
    box.appendChild(rsNest(ctx,ctx.t('n_options',{n:rsCount(value)}),'n:'+rel,0,rsObjForm(ctx,objName,value,onChange,{depth:depth+1,rel:rel})));
    const sAlt=alts.find(rsIsSimple);
    if(sAlt)link(ctx.t('as_simple'),function(){onChange(sAlt==='bool'?true:undefined);ctx.rerender();},'as-simple');
    link(ctx.t('as_yaml'),function(){ctx.yamlKeys.add(rel);ctx.rerender();},'as-yaml');
    return done(true);
  }
  if(asList){
    box.appendChild(rsListWidget(ctx,listName,value,onChange,{depth:depth+1,rel:rel}));
    link(ctx.t('as_yaml'),function(){ctx.yamlKeys.add(rel);ctx.rerender();},'as-yaml');
    return done(true);
  }
  if(asSList){box.appendChild(rsScalarList(ctx,sList.slice(5),value,onChange,{choices:choices}));return done(false);}
  const structured=!simple||(value!==undefined&&value!==null&&typeof value==='object');
  if(structured){
    box.appendChild(rsYamlWidget(ctx,value,onChange,Array.isArray(value)&&value.length>2?4:3));
    if(yamlMode&&(objName||listName)&&canDeep)link(ctx.t('as_form'),function(){ctx.yamlKeys.delete(rel);ctx.rerender();},'as-form');
    else if(alts.some(rsIsSimple)&&hasStruct)link(ctx.t('as_simple'),function(){onChange(undefined);ctx.rerender();},'as-simple');
    return done(false);
  }
  // a value that can grow into an object: show / hide "More options…" as soon as it is set / cleared
  const grows=objName&&canDeep&&(simple==='bool'||simple==='entity');
  box.appendChild(rsSimpleWidget(ctx,simple,value,grows?function(v){onChange(v);if((value===undefined||value===false)!==(v===undefined||v===false))ctx.rerender();}:onChange,wo));
  if(isProf)link(ctx.t('per_profile'),function(){onChange({portrait:value,landscape:value});ctx.rerender();});
  if(alts.indexOf('list:condVal')>=0)link(ctx.t('as_conditions'),function(){onChange([{condition:{entity:'',state:'on'},value:value===undefined?'':value},{value:value===undefined?'':value}]);ctx.rerender();},'as-conditions');
  // a simple value that can grow into an object: `true` → {} (still on), an entity → {entity: …}
  if(objName&&canDeep&&value!==undefined){
    const ok=rsFormSchema(objName).keys;
    const grow=simple==='bool'&&value===true?{}:(simple==='entity'&&value?(ok.entity?{entity:value}:(ok.default?{default:value}:null)):null);
    if(grow)link(ctx.t('more_options'),function(){onChange(grow);ctx.open.add('n:'+rel);ctx.rerender();},'more-options');
  }
  return done(false);
}

// ---- the panel -----------------------------------------------------------------------------------
// target.kind: element | room | card (single-room card, Global, or "Card settings") | section | nav
// ctx: {t, I, hass, work, scope, item, path, findings, domains, labels, open:Set, yamlKeys:Set,
//       inherited, multi, shared (the top level a room falls back to), set(k,v), setRest(keys,obj),
//       rename(id), rerender(), openAll(), goGlobal(), choices(key), select(type,id,roomIdx),
//       sectionAct(act)}
// root._rsRefresh(findings) re-pins the validation messages without rebuilding the form.
// Entity pickers that suggest only the domains a key can use (schema.key)
const RS_KEY_DOMAINS={'fpRoom.lights':['light','switch'],'fpLight.entity':['light','switch'],'fpRoom.climate':['climate'],'fpRoom.temperature':['sensor'],'fpRoom.humidity':['sensor'],'fpSource.anyvac':['sensor'],'fpRoom.media':['media_player'],'fpPage.presence':['sensor','person','device_tracker','input_select'],'floorplan.presence':['sensor','person','device_tracker','input_select'],'ovSignals.presence':['sensor','person','device_tracker','input_select'],'fpOpening.entity':['binary_sensor'],'fpOpening.cover':['cover'],'fpVacuum.entity':['sensor']};
const RS_CARD_ONLY=['aspect_ratio','border_radius','image_fit','image_align','filter_transition','room_entity','room_state_entity','follow_mode','follow_hold','url_sync','zoom','parallax','haptic','hold_feedback','hold_color','weather_nav_mini'];
function rsFormSpec(ctx,target){
  const S=RocSchema.ROC_SCHEMA;
  const item=ctx.item;
  if(target.kind==='element'){
    const T=RS_TYPES[target.type];
    const keys=(S[RS_SCHEMA_OF[target.type]]||{keys:{}}).keys;
    const order=Object.keys(keys);
    const isIn=function(l){return function(k){return l.indexOf(k)>=0;};};
    return{keys:keys,title:String(item.id),icon:T.icon,type:ctx.t('t_'+target.type),idRow:true,rest:'element',groups:[
      ['main',order.filter(function(k){return!isIn(RS_POS_KEYS)(k)&&!isIn(RS_ACT_KEYS)(k)&&!isIn(RS_VIS_KEYS)(k)&&!isIn(RS_PROF_KEYS)(k)&&k!=='id';})],
      ['position',order.filter(isIn(RS_POS_KEYS))],
      ['actions',order.filter(isIn(RS_ACT_KEYS))],
      ['visibility',order.filter(isIn(RS_VIS_KEYS))],
    ]};
  }
  const roomGroups=[
    ['image',['base_image_conditions','weather_overlay','filter_conditions','brightness_model']],
    ['lights',['light_controls']],
    ['cards',['cards_above','cards_below']],
    ['room_tap',['tap_action']],
  ];
  if(target.kind==='room'&&item.floorplan&&!item.overview){
    // v6.47.0: a floor plan page — its own settings; the plan's rooms and doors are edited on the canvas
    return{keys:Object.assign({},S.room.keys,{floorplan:{t:'bool|obj:fpPage'}}),title:String(item.name||item.id||''),icon:'mdi:floor-plan',type:ctx.t('fp_page'),rest:'room',groups:[['main',['id','name','icon']],['floorplan',['floorplan']],['room_nav',['nav_hidden']]]};
  }
  if(target.kind==='fproom'){
    const lk=(ctx.work.rooms||[]).find(function(r){return r&&item.room!=null&&String(r.id)===String(item.room);});
    return{keys:S.fpRoom.keys,schema:'fpRoom',title:String(item.name||(lk&&((lk.overview_tile&&lk.overview_tile.name)||lk.name))||item.room||('#'+(target.idx+1))),icon:'mdi:vector-square',type:ctx.t('t_fproom'),rest:'object',groups:[
      ['main',['name','room','floor','floor_color']],['fp_states',['lights','climate','temperature','humidity','media']],['fp_actions',['tap_action','hold_action']],['fp_geom',['label_at','polygon','anyvac_room']]]};
  }
  if(target.kind==='fpitem'){
    const lab=item.type==='label';
    return{keys:S.fpItem.keys,schema:'fpItem',title:String(item.name||item.text||item.entity||ctx.t(lab?'fp_label_n':'fp_marker_n',{n:target.idx+1})),icon:lab?'mdi:format-text':'mdi:map-marker',type:ctx.t(lab?'fp_label':'fp_marker'),rest:'object',groups:[
      ['main',['type','entity','attribute','name','icon','text']],['fp_shows',['show_state','prefix','suffix','decimals','active_state','color','size']],['fp_actions',['tap_action','hold_action']],['fp_geom',['at']]]};
  }
  if(target.kind==='fpdoor'){
    const win=item.type==='window';
    return{keys:S.fpOpening.keys,schema:'fpOpening',title:ctx.t(win?'fp_window_n':'fp_door_n',{n:target.n||target.idx+1}),icon:win?'mdi:window-closed-variant':'mdi:door',type:ctx.t(win?'t_fpwindow':'t_fpdoor'),rest:'object',groups:[
      ['main',['type','width','at']],['fp_shows',win?['entity','cover','blind_type','invert']:['entity','mirror','outward']],['fp_actions',['tap_action','hold_action']]]};
  }
  if(target.kind==='room'){
    return{keys:S.room.keys,title:String(item.name||item.id||''),icon:'mdi:door',type:ctx.t('room'),rest:'room',groups:[['main',RS_ROOM_KEYS],
      ['room_nav',['nav_hidden','nav_mini','weather_nav_mini','chips']],['overview',['overview','overview_tile']]].concat(roomGroups)};
  }
  if(target.kind==='card'){
    const keys=Object.assign({},S.room.keys,S.card.keys);
    const multi=Array.isArray(ctx.work.rooms)&&ctx.work.rooms.length>0;
    const cardKeys=RS_CARD_ONLY.filter(function(k){return multi||['room_entity','room_state_entity','follow_mode','follow_hold','url_sync','weather_nav_mini'].indexOf(k)<0;});
    return{keys:keys,title:ctx.t(target.settings?'card_settings':(ctx.global?'global':'card_form')),icon:target.settings?'mdi:cog-outline':(ctx.global?'mdi:earth':'mdi:image-outline'),type:'',rest:null,
      groups:[[multi?'defaults':'main',RS_CARD_KEYS]].concat(roomGroups).concat([['card',cardKeys]])};
  }
  if(target.kind==='section'){
    return{keys:S.section.keys,title:String(item.title||item.id),icon:item.icon&&/^mdi:/.test(item.icon)?item.icon:'mdi:view-dashboard-outline',type:ctx.t('t_section'),idRow:true,rest:'object',groups:[
      ['main',['title','icon','subtitle']],['panel',['placement','placement_portrait','size','columns','badge','backdrop']],
      ['content',['source','domain','tiles','card']],['visibility',['visible_template']]]};
  }
  if(target.kind==='nav'){
    return{keys:S.nav.keys,title:ctx.t('nav_form'),icon:'mdi:dots-horizontal-circle-outline',type:'',rest:'object',groups:[
      ['main',['style','position','live','height','width','mobile_height','rows','cards_position']],['behaviour',['wheel','follow_button','dim_inactive']],
      ['nav_chips',['chips']],['nav_cards',['cards']],['nav_mini',['mini']]]};
  }
  return null;
}
function rsBuildProps(ctx,target){
  const root=rsEl('div',{class:'props'});
  const spec=rsFormSpec(ctx,target);
  if(!spec){root.appendChild(rsEl('div',{class:'pf-empty',text:ctx.t('props_empty')}));return root;}
  const item=ctx.item,schemaKeys=spec.keys;
  const prefix=ctx.path||'';
  const rel=function(p){return prefix?p.slice(prefix.length+1):p;};
  const under=function(p){return!prefix||p===prefix||p.indexOf(prefix+'.')===0||p.indexOf(prefix+'[')===0;};
  let findings=(ctx.findings||[]).filter(function(f){return under(f.path);});
  // pinned validation: a leaf field shows its own findings and those below it; a sub-form or a
  // list row (exact) only its own — its fields show the rest
  const pinned=[];
  const msgsFor=function(r,exact){return findings.filter(function(f){const x=rel(f.path);return x===r||(!exact&&(x.indexOf(r+'.')===0||x.indexOf(r+'[')===0));});};
  ctx.pin=function(box,r,exact){const fn=function(){return msgsFor(r,exact);};pinned.push([box,fn]);rsMsgs(box,fn());return box;};
  const head=rsEl('div',{class:'pf-head'},[rsIcon(spec.icon),rsEl('span',{class:'pf-title',text:spec.title}),rsEl('span',{class:'pf-type',text:spec.type||''})]);
  if(ctx.inherited)head.appendChild(rsEl('span',{class:'tag',text:ctx.t('inherited')}));
  const hb=rsEl('span',{class:'pf-hbtns'});
  const hbtn=function(icon,act,title,fn,dis){hb.appendChild(rsEl('button',{type:'button',class:'btn sm','data-act':act,title:title,'aria-label':title,disabled:dis?true:null,onclick:fn},[rsIcon(icon)]));};
  if(target.kind==='section'){
    hbtn('mdi:arrow-up','sec-up',ctx.t('move_up'),function(){ctx.sectionAct('up');},target.idx===0);
    hbtn('mdi:arrow-down','sec-down',ctx.t('move_down'),function(){ctx.sectionAct('down');},target.idx>=((ctx.work.sections||[]).length-1));
    hbtn('mdi:delete-outline','sec-del',ctx.t('sec_del'),function(){ctx.sectionAct('delete');});
  }
  hbtn('mdi:open-in-new','open-all',ctx.t('open_all'),function(){ctx.openAll();});
  head.appendChild(hb);
  root.appendChild(head);
  if(ctx.multi>1)root.appendChild(rsEl('div',{class:'pf-note',text:ctx.t('props_multi',{n:ctx.multi,id:spec.title})}));
  // id: renaming keeps the selection (sections and groups take their references along)
  if(spec.idRow){
    const idBox=rsFieldBox('ID','id',false);
    const inp=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false'});inp.value=String(item.id==null?'':item.id);
    inp.addEventListener('change',function(){const v=inp.value.trim();if(v&&v!==String(item.id))ctx.rename(v);else inp.value=String(item.id);});
    idBox.appendChild(inp);
    root.appendChild(rsEl('div',{class:'pf-grid pf-idrow'},[ctx.pin(idBox,'id',false)]));
  }
  // a section: the elements tagged into it, anywhere in the card
  if(target.kind==='section'&&ctx.members){
    const m=ctx.members(item.id);
    const mb=rsEl('div',{class:'pf-members'},[rsEl('span',{class:'pf-l',text:ctx.t('sec_members',{n:m.length})})]);
    m.forEach(function(x){mb.appendChild(rsEl('button',{type:'button',class:'pf-chip','data-member':x.type+':'+x.id,onclick:function(){ctx.select(x.type,x.id,x.room);}},[rsIcon(RS_TYPES[x.type].icon),rsEl('span',{text:x.id+(x.roomName?' · '+x.roomName:'')})]));});
    if(!m.length)mb.appendChild(rsEl('span',{class:'pf-sub',text:ctx.t('sec_members_none')}));
    root.appendChild(mb);
  }
  const shown=new Set(['id']);
  groups:
  for(const g of spec.groups){
    const keys=g[1].filter(function(k){return schemaKeys[k]&&!(schemaKeys[k].legacy&&item[k]===undefined);});
    if(!keys.length)continue groups;
    const sec=rsEl('details',{class:'pf-sec','data-sec':g[0]});
    if(ctx.open.has(g[0]))sec.open=true;
    sec.addEventListener('toggle',function(){if(sec.open)ctx.open.add(g[0]);else ctx.open.delete(g[0]);});
    const nset=keys.filter(function(k){return item[k]!==undefined;}).length;
    sec.appendChild(rsEl('summary',null,[rsEl('span',{text:ctx.t('g_'+g[0])}),rsEl('span',{class:'n',text:nset?String(nset):''})]));
    const grid=rsEl('div',{class:'pf-grid'});
    keys.forEach(function(k){
      shown.add(k);
      const inh=ctx.shared&&schemaKeys[k].room?ctx.shared[k]:undefined;
      grid.appendChild(rsKeyField(ctx,k,schemaKeys[k],item[k],function(v){ctx.set(k,v);},{depth:0,rel:k,item:item,inherit:item[k]===undefined?inh:undefined,schema:spec.schema}));
    });
    sec.appendChild(grid);
    root.appendChild(sec);
  }
  // keys the form does not list: elements — profile overrides and unknown keys; rooms, sections,
  // the nav — keys the schema does not know. YAML, kept exactly as they are (KEEP)
  const rest={};
  if(spec.rest)Object.keys(item).forEach(function(k){
    if(shown.has(k))return;
    if(spec.rest==='element'||!schemaKeys[k])rest[k]=item[k];
  });
  const nrest=Object.keys(rest).length;
  if(spec.rest==='element'||nrest){
    const roomish=spec.rest!=='element';
    const adv=rsEl('details',{class:'pf-sec','data-sec':'advanced'});
    if(ctx.open.has('advanced'))adv.open=true;
    adv.addEventListener('toggle',function(){if(adv.open)ctx.open.add('advanced');else ctx.open.delete('advanced');});
    adv.appendChild(rsEl('summary',null,[rsEl('span',{text:ctx.t(roomish?'g_room_more':'g_advanced')}),rsEl('span',{class:'n',text:nrest?String(nrest):''})]));
    const ab=rsEl('div',{class:'pf-grid'});
    const advBox=rsFieldBox(ctx.t(roomish?'adv_room_hint':'adv_hint'),'_rest',true);
    advBox.appendChild(rsYamlWidget(ctx,nrest?rest:undefined,function(v){if(v===undefined)v={};if(!rsIsObj(v))return;ctx.setRest(Object.keys(rest),v);},4));
    pinned.push([advBox,function(){return findings.filter(function(f){const r=rel(f.path).split(/[.[]/)[0];return Object.prototype.hasOwnProperty.call(rest,r);});}]);
    rsMsgs(advBox,pinned[pinned.length-1][1]());
    ab.appendChild(advBox);adv.appendChild(ab);
    root.appendChild(adv);
  }
  if(target.kind==='room')root.appendChild(rsEl('div',{class:'pf-note',text:ctx.t('room_more_hint')}));
  if(target.kind==='card'&&!target.settings)root.appendChild(rsEl('div',{class:'pf-note',text:ctx.t(ctx.global?'props_global_hint':'props_card_hint')}));
  root._rsRefresh=function(all){
    findings=(all||[]).filter(function(f){return under(f.path);});
    pinned.forEach(function(p){rsMsgs(p[0],p[1]());});
    rsMarkNests(root);
  };
  return root;
}
// a collapsed section / sub-form / list row says when something inside it has a problem
function rsMarkNests(root){
  root.querySelectorAll('details.pf-nest,details.pf-sec').forEach(function(d){
    const e=!!d.querySelector('.pf-msg.v.error');
    d.classList.toggle('has-err',e);d.classList.toggle('has-warn',!e&&!!d.querySelector('.pf-msg.v.warn'));
  });
}
