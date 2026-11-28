// ---- Lenses on the floor plan + the house heating panel (7.3.0, HEATING_PLAN.md decision 10) -----
// The floor plan page is the hub: one plan, switchable lenses. A lens is a preset over the plan's
// layers — what is emphasised, what a tap on a room does, which panel its dock button opens:
//   overview (default) — the plan as it always was, a tap switches to the room;
//   heating — loops and thermostats in front, now → target on every label, a tap opens the room's
//             heating controller (A, 67-heat-control.js) beside the plan.
// The lenses sit in a dock under the plan, next to optional section launchers (floorplan.dock).
// Every lens button carries a badge in every lens, so an event is seen without switching; a lens
// never switches by itself. A tap on the active lens's button opens its panel — for heating the
// house panel (C): rooms, the house mode (Versatile Thermostat's central mode), the boiler, the
// tariff and the main supply. A banner on the plan says when the central mode stopped the heating.
// Config: floorplan.lenses / lens / dock / pause_banner; the house entities in the card's
// `heating:` block (central_mode, boiler, tariff, supply), the VTherm ones found by themselves.
const ROC_LENSES={overview:{icon:'mdi:floor-plan'},lights:{icon:'mdi:lightbulb-group'},heating:{icon:'mdi:heating-coil'},cleaning:{icon:'mdi:broom'}}; // 7.4.0: lights, cleaning (69-lights-clean.js)
const ROC_HP_STR={
  en:{lens_overview:'Overview',lens_heating:'Heating',house:'Heating · house',mode:'House mode',boiler:'Heating boiler',b_on:'running',b_off:'off',
    hot_water:'Hot water',hw_heat:'heating',hw_target:'target {t}',
    tariff:'Tariff',high:'high (VT)',low:'low (NT)',supply:'Main supply',rooms:'Rooms',close:'Close',
    ban_central:'Heating paused by the central mode',ban_mode:'mode: {m}',since:'since {t}',
    heat_n:'{n} heating',none_heat:'Nothing heats',warn:'Check: {r}',
    m_Auto:'Auto','m_Stopped':'Stopped','m_Heat only':'Heat only','m_Cool only':'Cool only','m_Frost protection':'Frost protection'},
  cs:{lens_overview:'Přehled',lens_heating:'Topení',house:'Topení · dům',mode:'Režim domu',boiler:'Kotel',b_on:'běží',b_off:'stojí',
    hot_water:'Teplá voda',hw_heat:'ohřívá',hw_target:'cíl {t}',
    tariff:'Tarif',high:'vysoký (VT)',low:'nízký (NT)',supply:'Hlavní přívod',rooms:'Místnosti',close:'Zavřít',
    ban_central:'Topení pozastaveno centrálním režimem',ban_mode:'režim: {m}',since:'od {t}',
    heat_n:'Topí {n}',none_heat:'Nic netopí',warn:'Zkontroluj: {r}',
    m_Auto:'Automaticky','m_Stopped':'Zastaveno','m_Heat only':'Jen topení','m_Cool only':'Jen chlazení','m_Frost protection':'Proti mrazu'},
};
function rocHpT(lang,k,v){const t=ROC_HP_STR[lang]||ROC_HP_STR.en;let s=t[k]!=null?t[k]:(ROC_HP_STR.en[k]!=null?ROC_HP_STR.en[k]:k);if(v)for(const x in v)s=s.split('{'+x+'}').join(v[x]);return s;}
// The lenses of a plan page: floorplan.lenses (known names, in order), else overview, then lights
// (a plan room with lights), heating (a thermostat) and cleaning (AnyVac on the plan) — each when
// the plan has something for it. One lens = no lens buttons.
function rocFpLenses(def){
  if(!def)return[];
  let l=Array.isArray(def.lenses)?def.lenses.map(String).filter(function(x,i,a){return ROC_LENSES[x]&&a.indexOf(x)===i;}):null;
  if(!l){
    const R=(Array.isArray(def.rooms)?def.rooms:[]).filter(function(r){return r&&typeof r==='object';});
    l=['overview'];
    if(R.some(function(r){return Array.isArray(r.lights)?r.lights.length:!!r.lights;}))l.push('lights');
    if(R.some(function(r){return r.climate;}))l.push('heating');
    if((def.source&&def.source.anyvac)||(Array.isArray(def.vacuums)&&def.vacuums.length)||R.some(function(r){return r.anyvac_room;}))l.push('cleaning');
  }
  return l;
}
// The lens shown now: the one picked on this page, else floorplan.lens, else the first. Null on a
// page with fewer than two lenses (the plan then draws as before 7.3.0).
function rocFpLensCur(card,def,idx){
  const l=rocFpLenses(def);if(l.length<2)return null;
  const by=card._fpLensBy||{},k=idx==null?card._roomIdx:idx;
  if(by[k]&&l.indexOf(by[k])>=0)return by[k];
  return l.indexOf(def.lens)>=0?def.lens:l[0];
}
// The thermostats the house panel lists: the plan's rooms (of this page, else the first plan in the
// card), then heating.rooms; each with the name the user knows the room by.
function rocHpRooms(cAll,def){
  const rooms=Array.isArray(cAll&&cAll.rooms)?cAll.rooms:[];
  if(!def){const r=rooms.find(function(x){return x&&x.floorplan&&!x.overview&&typeof x.floorplan==='object';});def=r?r.floorplan:null;}
  const out=[],seen={};
  const add=function(e,nm){if(!e||seen[e])return;seen[e]=1;const c=rocHcCfg(cAll,e);out.push({entity:e,name:c.name||nm||''});};
  (def&&Array.isArray(def.rooms)?def.rooms:[]).forEach(function(r){
    if(!r||!r.climate)return;
    const cr=r.room!=null?rooms.find(function(x){return x&&String(x.id)===String(r.room);}):null;
    add(String(r.climate),r.name||(cr&&cr.overview_tile&&cr.overview_tile.name)||(cr&&cr.name)||'');
  });
  const H=cAll&&cAll.heating&&typeof cAll.heating==='object'?cAll.heating:{};
  (Array.isArray(H.rooms)?H.rooms:[]).forEach(function(r){if(r&&r.climate)add(String(r.climate),r.name);});
  return out;
}
function rocHpName(hass,r){const st=hass&&hass.states[r.entity];return r.name||(st&&st.attributes&&st.attributes.friendly_name)||r.entity;}
// House entities: the card's heating.central_mode / boiler, else Versatile Thermostat's own (its
// central configuration: a select with Auto / Stopped, the central boiler binary sensor).
function rocHpHouse(hass,cAll){
  const H=cAll&&cAll.heating&&typeof cAll.heating==='object'?cAll.heating:{},E=(hass&&hass.entities)||{},S=(hass&&hass.states)||{};
  const vt=function(test){return Object.keys(E).find(function(id){return E[id]&&E[id].platform==='versatile_thermostat'&&S[id]&&test(id,S[id],E[id]);})||'';};
  const mode=typeof H.central_mode==='string'?H.central_mode:(H.central_mode===false?'':vt(function(id,st){const o=st.attributes&&st.attributes.options;return id.indexOf('select.')===0&&Array.isArray(o)&&o.indexOf('Auto')>=0&&o.indexOf('Stopped')>=0;}));
  const boiler=typeof H.boiler==='string'?H.boiler:(H.boiler===false?'':vt(function(id,st,e){return id.indexOf('binary_sensor.')===0&&(e.translation_key==='central_boiler_state'||/central_boiler/.test(id));}));
  const tf=H.tariff&&typeof H.tariff==='object'&&H.tariff.entity?{entity:String(H.tariff.entity),high:String(H.tariff.high_state!=null?H.tariff.high_state:'on')}:null;
  // 7.4.0: the hot water (a water_heater — not the heating boiler): heating.water_heater, else the only one there is
  const whs=Object.keys(S).filter(function(id){return id.indexOf('water_heater.')===0;});
  const wh=typeof H.water_heater==='string'?H.water_heater:(H.water_heater===false?'':(whs.length===1?whs[0]:''));
  const sup=(Array.isArray(H.supply)?H.supply:[]).map(function(x){return x&&typeof x==='object'?{entity:String(x.entity||''),name:x.name||''}:{entity:String(x||''),name:''};}).filter(function(x){return x.entity;});
  return{mode:mode,boiler:boiler,tariff:tf,supply:sup,water:wh};
}
// What the heating lens's badge and the banner say, from the thermostats' states (pure).
function rocHeatSum(hass,rooms,house){
  const S=(hass&&hass.states)||{};
  const o={heat:0,pw:0,pause:false,since:'',warn:[],high:false};
  rooms.forEach(function(r){
    const st=S[r.entity],m=rocHcModel(st);
    const a=(st&&st.attributes)||{},hf=a.heating_failure_detection_manager&&typeof a.heating_failure_detection_manager==='object'?a.heating_failure_detection_manager:null;
    if(!st||m.na||m.safety||(hf&&hf.heating_failure_state==='on'))o.warn.push(rocHpName(hass,r));
    if(m.on&&(m.action==='heating'||m.action==='preheating')){o.heat++;if(isFinite(m.pw))o.pw=Math.max(o.pw,m.pw);}
    if(m.pause&&/central/.test(m.reason)){o.pause=true;const lc=st.last_changed||'';if(lc&&(!o.since||lc<o.since))o.since=lc;}
  });
  if(house&&house.tariff){const t=S[house.tariff.entity];o.high=!!t&&String(t.state)===house.tariff.high;}
  // one badge: ! (a thermostat to check) > ❚❚ (paused) > VT (high tariff) > how many heat
  o.badge=o.warn.length?{t:'!',c:'var(--roc-alert-c)'}:(o.pause?{t:'II',c:'#f5b041'}:(o.high?{t:'VT',c:'#9aa3ad'}:(o.heat?{t:String(o.heat),c:''}:null)));
  return o;
}
const ROC_FPD_CSS='.roc-fp-dk{position:absolute;left:0;right:0;bottom:0;height:var(--roc-fpd-h,60px);display:flex;align-items:center;justify-content:safe center;gap:var(--roc-ov-dgap,clamp(6px,2.2vw,14px));padding:0 10px;box-sizing:border-box;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;z-index:2;}.roc-fp-dk::-webkit-scrollbar{display:none}.roc-fp-dk>*{flex:none}'
  +'.roc-fp-dk .ico{position:relative!important;}.roc-fp-dk .ico.roc-lens-on{box-shadow:0 0 0 2px var(--roc-active-c);}'
  +'.roc-fp-sep{width:1px;height:26px;background:rgba(255,255,255,.18);}'
  +'.roc-fp-ban{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:3;max-width:calc(100% - 24px);box-sizing:border-box;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:16px;background:rgba(40,30,10,.82);border:1px solid #f5b041;color:#ffe2b0;font:600 13px/1.3 var(--paper-font-body1_-_font-family,system-ui,sans-serif);cursor:pointer;flex-wrap:wrap;justify-content:center;text-align:center;-webkit-tap-highlight-color:transparent;}'
  +'.roc-fp-ban[hidden]{display:none;}.roc-fp-ban b{font-weight:800;letter-spacing:1px;}.roc-fp-ban span{opacity:.8;font-weight:500;}';
// The dock under the plan: lens buttons, then (floorplan.dock) section launchers. Its buttons go
// through the card's icon pipeline (listeners, section ring and badge), like the overview's dock.
function rocFpDockBuild(card,cAll,def){
  const lenses=rocFpLenses(def),lang=rocHcLang(card._hass),icons=[];
  const lensName=function(l){return l==='lights'||l==='cleaning'?rocLcT(lang,'lens_'+l):rocHpT(lang,'lens_'+l);};
  const cur=rocFpLensCur(card,def);
  const dk=def.dock&&typeof def.dock==='object'?def.dock:(def.dock===true?{}:null);
  const isz=(dk&&dk.size)||'24px';
  const btn=function(id,ic,ttl,extra){
    return'<div class="ico ico-chip'+(extra||'')+'" data-ico="'+escA(id)+'" tabindex="0" role="button" aria-label="'+escA(ttl)+'" title="'+escA(ttl)+'" style="position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;border-radius:50%;padding:9px;box-sizing:content-box;">'
      +'<ha-icon data-icoicon="'+escA(id)+'" icon="'+escA(ic)+'" style="'+escA('--mdc-icon-size:'+isz+';width:'+isz+';height:'+isz+';display:flex;color:var(--roc-icon-color,#fff);pointer-events:none;position:relative;z-index:2;')+'"></ha-icon>'
      +'<span class="ico-ring" data-ico-ring></span><span class="ico-badge" data-ico-badge></span></div>';
  };
  let h='';
  if(lenses.length>1)lenses.forEach(function(l){
    const id='__fplens_'+l,ttl=lensName(l);
    icons.push({id:id,icon:ROC_LENSES[l].icon,size:isz,chip:true,tap_action:{action:'fp-lens',lens:l},_ovDock:true,_fpLens:l});
    h+=btn(id,ROC_LENSES[l].icon,ttl,l===cur?' roc-lens-on':'').replace('role="button"','role="button" aria-pressed="'+(l===cur)+'"');
  });
  if(dk){
    const all=card._getSections(cAll).map(function(sx){return sx.def;});
    const list=Array.isArray(dk.sections)?dk.sections.map(function(id){return all.find(function(d){return d.id===id;});}).filter(Boolean):all;
    if(h&&list.length)h+='<span class="roc-fp-sep" aria-hidden="true"></span>';
    list.forEach(function(d){
      const id='__fpdock_'+d.id,ic=d.icon||'mdi:view-dashboard';
      icons.push({id:id,icon:ic,size:isz,chip:true,tap_action:{action:'open-section',section:d.id},_ovDock:true});
      h+=btn(id,ic,d.title||d.id);
    });
  }
  const ban=def.pause_banner!==false&&lenses.indexOf('heating')>=0?'<div class="roc-fp-ban" data-fp-ban role="status" hidden></div>':'';
  return{html:(h?'<div class="roc-fp-dk" data-fp-dock>'+h+'</div>':'')+ban,icons:icons,dock:!!h};
}
// Badges, ring, the active lens and the banner — every state update while the plan page shows.
function rocFpDockUpdate(card){
  const sr=card.shadowRoot,cAll=card._config,hass=card._hass;if(!sr||!hass)return;
  const def=rocFpCfg(cAll,card._roomIdx);if(!def)return;
  const lenses=rocFpLenses(def),cur=rocFpLensCur(card,def),lang=rocHcLang(hass);
  const rooms=rocHpRooms(cAll,def),house=rocHpHouse(hass,cAll),sum=rocHeatSum(hass,rooms,house);
  const other=lenses.some(function(l){return l==='lights'||l==='cleaning';})?rocFpLensBadges(card,def,lang):{};
  lenses.forEach(function(l){
    const el=sr.querySelector('[data-ico="__fplens_'+l+'"]');if(!el)return;
    el.classList.toggle('roc-lens-on',l===cur);el.setAttribute('aria-pressed',String(l===cur));
    // 7.4.0: lights — how many rooms are lit; cleaning — ! / how many vacuums clean (ring: the room's progress) / how many rooms queued
    const o=other[l];
    if(o){
      const b=el.querySelector('[data-ico-badge]'),ring=el.querySelector('[data-ico-ring]'),ic=el.querySelector('ha-icon'),bt=o.badge?o.badge.t:'';
      if(b){if(b.textContent!==bt)b.textContent=bt;b.style.background=o.badge&&o.badge.c?o.badge.c:'';b.style.color=o.badge&&o.badge.c&&o.badge.t!=='!'?'#fff':'';}
      if(ring){const on=o.ring>=0;ring.style.display=on?'block':'none';if(on)ring.style.setProperty('--p',Math.round(o.ring)+'%');}
      if(ic)ic.style.color=o.active?'var(--roc-active-c)':'';
      el.setAttribute('title',o.title);el.setAttribute('aria-label',o.title);
      return;
    }
    if(l!=='heating')return;
    const b=el.querySelector('[data-ico-badge]'),ring=el.querySelector('[data-ico-ring]'),ic=el.querySelector('ha-icon');
    const bt=sum.badge?sum.badge.t:'';
    if(b){if(b.textContent!==bt)b.textContent=bt;b.style.background=sum.badge&&sum.badge.c?sum.badge.c:'';b.style.color=sum.badge&&sum.badge.c&&sum.badge.t!=='!'?'#1a1206':'';}
    if(ring){ring.style.display=sum.heat?'block':'none';ring.style.setProperty('--p',Math.round(sum.pw||0)+'%');}
    if(ic)ic.style.color=sum.heat?'var(--roc-active-c)':'';
    const ttl=rocHpT(lang,'lens_heating')+' · '+(sum.heat?rocHpT(lang,'heat_n',{n:sum.heat}):rocHpT(lang,'none_heat'))+(sum.warn.length?' · '+rocHpT(lang,'warn',{r:sum.warn.join(', ')}):'');
    el.setAttribute('title',ttl);el.setAttribute('aria-label',ttl);
  });
  const ban=sr.querySelector('[data-fp-ban]');
  if(ban){
    if(!sum.pause){ban.hidden=true;return;}
    const ms=house.mode&&hass.states[house.mode],d=sum.since?new Date(sum.since):null;
    const parts=[ms?rocHpT(lang,'ban_mode',{m:rocHpT(lang,'m_'+ms.state)}):'',d&&!isNaN(d)?rocHpT(lang,'since',{t:d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}):''].filter(Boolean);
    const html='<b>II</b>'+rocHcEsc(rocHpT(lang,'ban_central'))+(parts.length?'<span>· '+rocHcEsc(parts.join(' · '))+'</span>':'');
    if(ban.innerHTML!==html)ban.innerHTML=html;
    ban.hidden=false;
  }
}
// A lens button: another lens → switch to it; the active one → open its panel.
function rocFpLensTap(card,lens){
  const def=rocFpCfg(card._config,card._roomIdx);if(!def)return;
  const cur=rocFpLensCur(card,def);
  if(lens===cur){if(lens==='heating')rocHpOpen(card);else if(lens==='lights'||lens==='cleaning')rocXpOpen(card,lens);return;}
  if(rocFpLenses(def).indexOf(lens)<0)return;
  card._fpLensBy=Object.assign({},card._fpLensBy||{});card._fpLensBy[card._roomIdx]=lens;
  if(card._fpInst&&card._fpInst.setOptions)card._fpInst.setOptions({lens:lens});
  rocFpDockUpdate(card);
}
// ---- the house panel (C) ----
const ROC_HP_CSS='.roc-hp-bd{position:absolute;inset:0;z-index:408;background:rgba(0,0,0,.35);}'
  +'.roc-hp{position:absolute;z-index:409;left:0;right:0;bottom:0;max-height:78%;overflow-y:auto;box-sizing:border-box;background:var(--card-background-color,#1c1f24);color:var(--primary-text-color,#f2f3f5);border-radius:14px 14px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.45);padding:14px 18px 18px;display:flex;flex-direction:column;gap:14px;font:14px/1.4 var(--paper-font-body1_-_font-family,system-ui,sans-serif);}'
  +'.hp-hd{display:flex;align-items:center;gap:10px}.hp-hd h3{flex:1;margin:0;font-size:16px;font-weight:600}.hp-x{background:none;border:0;color:inherit;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1}'
  +'.hp-lbl{font-size:11px;color:var(--secondary-text-color,#9aa3ad);margin-bottom:-8px;text-transform:uppercase;letter-spacing:.04em}'
  +'.hp-modes{display:flex;flex-wrap:wrap;gap:8px}.hp-modes button{flex:1 1 0;min-width:84px;min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;cursor:pointer}'
  +'.hp-modes button.on{background:rgba(255,122,92,.18);border-color:#ff7a5c;color:#ffd6cb}'
  +'.hp-facts{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px}.hp-facts span{color:var(--secondary-text-color,#9aa3ad)}.hp-facts b{font-weight:600}.hp-facts b.hot{color:#ffb35c}.hp-facts:empty{display:none}'
  +'.hp-rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}'
  +'.hp-room{text-align:left;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font:inherit;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;min-height:44px}'
  +'.hp-room .n{font-size:12px;font-weight:600;color:var(--secondary-text-color,#9aa3ad)}.hp-room .t{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}.hp-room .t small{font-size:13px;font-weight:400;color:var(--secondary-text-color,#9aa3ad);margin-left:6px}'
  +'.hp-room .s{display:flex;align-items:center;gap:6px;font-size:12px}.hp-room .s i{width:8px;height:8px;border-radius:50%;background:#7d8590;flex:none}'
  +'.hp-room.heat{border-color:rgba(255,122,92,.55)}.hp-room.heat .s i{background:#ff7a5c;box-shadow:0 0 6px #ff7a5c}.hp-room.pause .s i,.hp-room.warn .s i{background:#f5b041}.hp-room.off .s i,.hp-room.na .s i{background:#4b5260}'
  +'.hp-ad{display:flex;gap:8px;border-top:1px solid rgba(255,255,255,.08);padding-top:12px}.hp-ad button{flex:1;min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:none;color:inherit;font:inherit;cursor:pointer}.hp-ad b{display:inline-block;min-width:18px;margin-left:6px;border-radius:9px;background:#f5b041;color:#1c1f24;font-size:11px;line-height:18px}'
  +'.roc-hp button:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}';
function rocHpOpen(card){
  if(!card||!card._hass)return;
  rocHpClose(card);if(card._heat)rocHcClose(card);if(card._lc)rocLcClose(card);if(card._xp)rocXpClose(card);if(card._hs)rocHsClose(card);if(card._ad)rocAdClose(card);
  const sr=card.shadowRoot,wrap=sr&&sr.querySelector('.wrap');if(!wrap)return;
  const lang=rocHcLang(card._hass),T=function(k,v){return rocHcEsc(rocHpT(lang,k,v));};
  const bd=document.createElement('div');bd.className='roc-hp-bd';bd.addEventListener('click',function(){rocHpClose(card);});
  const el=document.createElement('div');el.className='roc-hp';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',rocHpT(lang,'house'));
  el.innerHTML='<style>'+ROC_HP_CSS+'</style><div class="hp-hd"><h3>'+T('house')+'</h3><button class="hp-x" data-hp="close" aria-label="'+T('close')+'">×</button></div>'
    +'<div data-hp-modew><div class="hp-lbl">'+T('mode')+'</div><div class="hp-modes" data-hp-modes style="margin-top:14px"></div></div>'
    +'<div class="hp-facts" data-hp-facts></div>'
    +'<div class="hp-lbl">'+T('rooms')+'</div><div class="hp-rooms" data-hp-rooms></div>'
    +(rocAdAllowed(card._hass,card._config)?'<div class="hp-ad"><button data-hp="admin" data-v="check" data-hp-ck>'+rocHcEsc(rocAdT(lang,'t_check'))+'</button><button data-hp="admin" data-v="log">'+rocHcEsc(rocAdT(lang,'t_log'))+'</button></div>':''); // 7.5.0: admins only
  el.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('[data-hp]');if(!b)return;
    const k=b.getAttribute('data-hp');
    if(k==='close')rocHpClose(card);
    else if(k==='mode'){const P=card._hp;if(P&&P.house.mode)card._hass.callService('select','select_option',{entity_id:P.house.mode,option:b.getAttribute('data-v')});}
    else if(k==='room'){const ent=b.getAttribute('data-v');rocHpClose(card);rocHeatOpen(card,ent);} // 7.5.0: B on a phone when heating.simple says so
    else if(k==='admin'){const v=b.getAttribute('data-v');rocHpClose(card);rocAdOpen(card,v);} // 7.5.0: the administration
  });
  wrap.appendChild(bd);wrap.appendChild(el);
  card._hp={el:el,bd:bd,lang:lang,sig:''};
  if(!card._hpKey){card._hpKey=function(e){if(e.key==='Escape'&&card._hp)rocHpClose(card);};document.addEventListener('keydown',card._hpKey);}
  rocHpUpdate(card);
  const x=el.querySelector('[data-hp="close"]');if(x)try{x.focus();}catch(_){}
}
function rocHpClose(card){
  const P=card&&card._hp;if(!P)return;
  if(P.el&&P.el.parentNode)P.el.parentNode.removeChild(P.el);
  if(P.bd&&P.bd.parentNode)P.bd.parentNode.removeChild(P.bd);
  card._hp=null;
  if(card._hpKey){document.removeEventListener('keydown',card._hpKey);card._hpKey=null;}
}
function rocHpUpdate(card){
  const P=card._hp;if(!P)return;
  if(!P.el.isConnected){rocHpClose(card);return;} // the card re-rendered: the panel goes with the old DOM
  const hass=card._hass,S=hass.states,lang=P.lang,cAll=card._config;
  const rooms=rocHpRooms(cAll,rocFpCfg(cAll,card._roomIdx)),house=rocHpHouse(hass,cAll);P.house=house;
  const q=function(s){return P.el.querySelector(s);};
  // house mode
  const ms=house.mode&&S[house.mode],opts=ms&&Array.isArray(ms.attributes&&ms.attributes.options)?ms.attributes.options:[];
  const cool=rooms.some(function(r){const st=S[r.entity];return st&&Array.isArray(st.attributes.hvac_modes)&&st.attributes.hvac_modes.indexOf('cool')>=0;});
  q('[data-hp-modew]').style.display=opts.length?'':'none';
  const mh=opts.filter(function(o){return o!=='Cool only'||cool;}).map(function(o){return'<button data-hp="mode" data-v="'+rocHcEsc(o)+'"'+(ms.state===o?' class="on" aria-pressed="true"':' aria-pressed="false"')+'>'+rocHcEsc(rocHpT(lang,'m_'+o))+'</button>';}).join('');
  if(q('[data-hp-modes]').innerHTML!==mh)q('[data-hp-modes]').innerHTML=mh;
  // boiler · tariff · main supply
  const facts=[];
  const bs=house.boiler&&S[house.boiler];
  if(bs)facts.push('<div><span>'+rocHcEsc(rocHpT(lang,'boiler'))+'</span> <b'+(bs.state==='on'?' class="hot"':'')+'>'+rocHcEsc(rocHpT(lang,bs.state==='on'?'b_on':'b_off'))+'</b></div>');
  const ws=house.water&&S[house.water];
  if(ws){const wa=ws.attributes||{},wc=rocHcNum(wa.current_temperature),wt=rocHcNum(wa.temperature),wh=wa.hvac_action==='heating'||ws.state==='heating';
    facts.push('<div><span>'+rocHcEsc(rocHpT(lang,'hot_water'))+'</span> <b'+(wh?' class="hot"':'')+'>'+rocHcEsc(rocHcFmt(lang,wc))+' °C</b>'+(isFinite(wt)?' <span>'+rocHcEsc(rocHpT(lang,'hw_target',{t:rocHcFmt(lang,wt,0)+' °C'}))+'</span>':'')+'</div>');}
  const ts=house.tariff&&S[house.tariff.entity];
  if(ts){const hi=String(ts.state)===house.tariff.high;facts.push('<div><span>'+rocHcEsc(rocHpT(lang,'tariff'))+'</span> <b'+(hi?' class="hot"':'')+'>'+rocHcEsc(rocHpT(lang,hi?'high':'low'))+'</b></div>');}
  house.supply.forEach(function(x){
    const st=S[x.entity];if(!st)return;
    const nm=x.name||(st.attributes&&st.attributes.friendly_name)||x.entity;
    const n=rocHcNum(st.state),u=(st.attributes&&st.attributes.unit_of_measurement)||'';
    facts.push('<div><span>'+rocHcEsc(nm)+'</span> <b>'+rocHcEsc(isFinite(n)?n.toLocaleString(lang,{maximumFractionDigits:n<10?1:0}):st.state)+(u?' '+rocHcEsc(u):'')+'</b></div>');
  });
  const fh=facts.join('');if(q('[data-hp-facts]').innerHTML!==fh)q('[data-hp-facts]').innerHTML=fh;
  // the rooms: now, target, status — a tap opens the room's controller
  const rh=rooms.map(function(r){
    const st=S[r.entity],m=rocHcModel(st),s=rocHcStatus(lang,m,m.target);
    return'<button class="hp-room '+s.cls+'" data-hp="room" data-v="'+rocHcEsc(r.entity)+'"><span class="n">'+rocHcEsc(rocHpName(hass,r))+'</span>'
      +'<span class="t">'+rocHcEsc(rocHcFmt(lang,m.cur))+'°'+(isFinite(m.target)?'<small>→ '+rocHcEsc(rocHcFmt(lang,m.target))+'°</small>':'')+'</span>'
      +'<span class="s"><i></i>'+rocHcEsc(s.text)+'</span></button>';
  }).join('');
  if(q('[data-hp-rooms]').innerHTML!==rh)q('[data-hp-rooms]').innerHTML=rh;
  // 7.5.0: how many findings the settings check has (admins)
  const ckb=q('[data-hp-ck]');
  if(ckb){const n=rocAdCheck(hass,cAll,lang).checks.filter(function(c){return c.lvl==='warn'||c.lvl==='alert';}).length,ch=rocHcEsc(rocAdT(lang,'t_check'))+(n?'<b>'+n+'</b>':'');if(ckb.innerHTML!==ch)ckb.innerHTML=ch;}
}
