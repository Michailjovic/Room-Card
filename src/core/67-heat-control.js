// ---- Heating controller (7.2.0, HEATING_PLAN.md) -----------------------------------------------
// One room's thermostat in degrees: status, target with − / +, quick temperatures, a ruler, how
// long the change holds, a 24 h chart. Opened by the `heating` action ({action: heating, entity:
// climate.x}) from anything with a tap_action; works with any climate, and uses Versatile
// Thermostat's extras when they are there (power, pause reason, temperature slope, timed preset).
// A time-limited temperature is VTherm's timed preset: the °C goes into the thermostat's boost
// preset (its number entity) and set_timed_preset runs it; VTherm restores the previous target.
// Settings: `heating:` at the card's top level (quick, step, range, durations, evening, morning,
// rooms: [{climate, name, quick, step, range}]).
const ROC_HC_STR={
  en:{close:'Close',target:'target',heat:'Heating',heat_pw:'Heating · {pw} %',eta:'target in ~{t}',hold:'Holding {t}',wait:'Not heating now',
    pause:'Paused',pause_central:'Paused by the central mode',pause_window:'Paused — window open',off:'Off',na:'Unavailable',safety:'Sensor silent — running at {pw} %',
    always:'Keep',h2:'For 2 h',evening:'Until {t}',morning:'Until morning',timed:'Temporarily until {t}',cancel:'Cancel',turn_off:'Turn off',turn_on:'Turn on',more:'Details',
    ago:'24 h ago',now:'now',quick:'Quick temperatures',ruler:'Target temperature',dur:'How long',min:'{n} min',hr:'{h} h {m} min',hr0:'{h} h'},
  cs:{close:'Zavřít',target:'cíl',heat:'Topí',heat_pw:'Topí · {pw} %',eta:'cíl za ~{t}',hold:'Drží {t}',wait:'Teď netopí',
    pause:'Pozastaveno',pause_central:'Pozastaveno centrálním režimem',pause_window:'Pozastaveno – otevřené okno',off:'Vypnuto',na:'Nedostupné',safety:'Čidlo mlčí – nouzový chod {pw} %',
    always:'Trvale',h2:'Na 2 h',evening:'Do {t}',morning:'Do rána',timed:'Dočasně do {t}',cancel:'Zrušit',turn_off:'Vypnout',turn_on:'Zapnout',more:'Podrobnosti',
    ago:'před 24 h',now:'teď',quick:'Rychlé teploty',ruler:'Cílová teplota',dur:'Jak dlouho',min:'{n} min',hr:'{h} h {m} min',hr0:'{h} h'},
};
function rocHcLang(h){return String((h&&((h.locale&&h.locale.language)||h.language))||'en').split('-')[0];}
function rocHcT(lang,k,v){const t=ROC_HC_STR[lang]||ROC_HC_STR.en;let s=t[k]!=null?t[k]:ROC_HC_STR.en[k];if(v)for(const x in v)s=s.split('{'+x+'}').join(v[x]);return s;}
function rocHcNum(v){const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)?n:NaN;}
function rocHcFmt(lang,v,d){return isFinite(v)?v.toLocaleString(lang,{minimumFractionDigits:d==null?1:d,maximumFractionDigits:d==null?1:d}):'—';}
// The settings for one thermostat: its room entry over the card's heating defaults.
function rocHcCfg(cAll,entity){
  const H=cAll&&cAll.heating&&typeof cAll.heating==='object'?cAll.heating:{};
  const r=(Array.isArray(H.rooms)?H.rooms:[]).find(function(x){return x&&x.climate===entity;})||{};
  const nums=function(v){return Array.isArray(v)?v.map(rocHcNum).filter(isFinite):null;};
  const q=nums(r.quick)||nums(H.quick);
  const rg=nums(r.range)||nums(H.range);
  const st=rocHcNum(r.step)>0?rocHcNum(r.step):(rocHcNum(H.step)>0?rocHcNum(H.step):0.5);
  const du=Array.isArray(H.durations)?H.durations.filter(function(d){return['always','2h','evening','morning'].indexOf(d)>=0;}):null;
  const tm=function(v,d){return typeof v==='string'&&/^\d{1,2}:\d{2}$/.test(v)?v:d;};
  return{name:r.name||'',quick:q&&q.length?q:[21,22,22.5,23],step:st,range:rg&&rg.length===2&&rg[1]>rg[0]?rg:[16,26],
    durations:du&&du.length?du:['always','2h','evening','morning'],evening:tm(r.evening||H.evening,'22:00'),morning:tm(r.morning||H.morning,'06:00')};
}
// A climate state → what the controller shows (pure).
function rocHcModel(st){
  if(!st)return{na:true};
  const a=st.attributes||{},ss=a.specific_states&&typeof a.specific_states==='object'?a.specific_states:{};
  const rq=a.requested_state&&typeof a.requested_state==='object'?a.requested_state.hvac_mode:null;
  const m={na:st.state==='unavailable'||st.state==='unknown',cur:rocHcNum(a.current_temperature),target:rocHcNum(a.temperature),hum:rocHcNum(a.current_humidity),
    action:a.hvac_action||'',on:st.state!=='off'&&st.state!=='unavailable',min:rocHcNum(a.min_temp),max:rocHcNum(a.max_temp),vtherm:!!a.specific_states};
  m.pause=st.state==='off'&&!!rq&&rq!=='off';
  m.reason=String(ss.hvac_off_reason||'');
  const pp=rocHcNum(a.power_percent),op=rocHcNum(a.on_percent);
  m.pw=isFinite(pp)?pp:(isFinite(op)?op*100:NaN);
  m.slope=rocHcNum(ss.temperature_slope);
  const tp=a.timed_preset_manager&&typeof a.timed_preset_manager==='object'?a.timed_preset_manager:null;
  m.timed=tp&&tp.is_active&&tp.end_time?String(tp.end_time):'';
  m.safety=!!(a.safety_manager&&a.safety_manager.safety_state==='on');
  return m;
}
function rocHcDur(lang,min){if(!(min>0))return'';const h=Math.floor(min/60),mm=Math.round(min%60);return h?(mm?rocHcT(lang,'hr',{h:h,m:mm}):rocHcT(lang,'hr0',{h:h})):rocHcT(lang,'min',{n:Math.max(1,mm)});}
function rocHcStatus(lang,m,target){
  if(m.na)return{cls:'na',text:rocHcT(lang,'na')};
  if(m.safety)return{cls:'warn',text:rocHcT(lang,'safety',{pw:isFinite(m.pw)?Math.round(m.pw):'?'})};
  if(m.pause)return{cls:'pause',text:/central/.test(m.reason)?rocHcT(lang,'pause_central'):(/window/.test(m.reason)?rocHcT(lang,'pause_window'):rocHcT(lang,'pause'))};
  if(!m.on)return{cls:'off',text:rocHcT(lang,'off')};
  if(m.action==='heating'||m.action==='preheating'){
    let s=isFinite(m.pw)?rocHcT(lang,'heat_pw',{pw:Math.round(m.pw)}):rocHcT(lang,'heat');
    const t=isFinite(target)?target:m.target;
    if(isFinite(m.slope)&&m.slope>0.05&&isFinite(t)&&isFinite(m.cur)&&t>m.cur)s+=' · '+rocHcT(lang,'eta',{t:rocHcDur(lang,(t-m.cur)/m.slope*60)});
    return{cls:'heat',text:s};
  }
  if(isFinite(m.cur)&&isFinite(m.target)&&m.cur>=m.target-0.15)return{cls:'idle',text:rocHcT(lang,'hold',{t:rocHcFmt(lang,m.target)+' °C'})};
  return{cls:'idle',text:rocHcT(lang,'wait')};
}
// Minutes until `kind` ('2h' | 'evening' | 'morning') from `now` (a Date); evening / morning are HH:MM.
function rocHcUntil(kind,cfg,now){
  now=now||new Date();
  if(kind==='2h')return 120;
  const hm=String(kind==='evening'?cfg.evening:cfg.morning).split(':'),d=new Date(now.getTime());
  d.setHours(+hm[0],+hm[1],0,0);
  if(d.getTime()<=now.getTime()+60000)d.setDate(d.getDate()+1);
  return Math.max(1,Math.min(1440,Math.round((d.getTime()-now.getTime())/60000)));
}
// VTherm's boost preset number entity of the same device (null without one: no time limits).
function rocHcBoost(hass,entity){
  const E=hass&&hass.entities;if(!E||!E[entity])return null;
  const dev=E[entity].device_id;if(!dev)return null;
  const id=Object.keys(E).find(function(k){return E[k]&&E[k].device_id===dev&&/^number\..*_preset_boost_temp$/.test(k);});
  return id&&hass.states[id]?id:null;
}
// Set the target: kept (set_temperature, a running timed preset cancelled first) or for a while.
function rocHcCommit(hass,entity,t,dur,cfg,model){
  const call=function(d,s,data){try{const p=hass.callService(d,s,data);return p&&p.then?p:Promise.resolve();}catch(e){return Promise.reject(e);}};
  const boost=dur&&dur!=='always'?rocHcBoost(hass,entity):null;
  if(boost)return call('number','set_value',{entity_id:boost,value:t}).then(function(){return call('versatile_thermostat','set_timed_preset',{entity_id:entity,preset:'boost',duration_minutes:rocHcUntil(dur,cfg)});});
  const first=model&&model.timed?call('versatile_thermostat','cancel_timed_preset',{entity_id:entity}):Promise.resolve();
  return first.then(function(){return call('climate','set_temperature',{entity_id:entity,temperature:t});});
}
const ROC_HC_CSS='.roc-hc-bd{position:absolute;inset:0;z-index:410;background:rgba(0,0,0,.4);}.roc-hc-bd.hc-lite{background:rgba(0,0,0,.12);}'
  +'.roc-hc{position:absolute;z-index:411;top:0;right:0;bottom:0;width:min(380px,92%);box-sizing:border-box;overflow-y:auto;background:var(--card-background-color,#1c1f24);color:var(--primary-text-color,#f2f3f5);border-radius:14px 0 0 14px;box-shadow:0 8px 30px rgba(0,0,0,.5);padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px;font:14px/1.4 var(--paper-font-body1_-_font-family,system-ui,sans-serif);}'
  +'.roc-hc.hc-bottom{top:auto;left:0;width:auto;max-height:88%;border-radius:14px 14px 0 0;}'
  +'.hc-hd{display:flex;align-items:flex-start;gap:10px}.hc-hd>div{flex:1;min-width:0}.hc-room{font-size:13px;color:var(--secondary-text-color,#9aa3ad);font-weight:600}'
  +'.hc-cur{font-size:30px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1.15}.hc-cur small{font-size:14px;font-weight:400;color:var(--secondary-text-color,#9aa3ad);margin-left:8px}'
  +'.hc-x{background:none;border:0;color:inherit;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1}'
  +'.hc-st{display:flex;align-items:center;gap:8px;font-size:13px}.hc-st i{width:9px;height:9px;border-radius:50%;background:#7d8590;flex:none}'
  +'.hc-st.heat i{background:#ff7a5c;box-shadow:0 0 8px #ff7a5c}.hc-st.pause i,.hc-st.warn i{background:#f5b041}.hc-st.off i,.hc-st.na i{background:#4b5260}'
  +'.hc-tgt{display:flex;align-items:center;justify-content:center;gap:18px}.hc-tgt button{width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:inherit;font-size:26px;cursor:pointer}'
  +'.hc-val{text-align:center;min-width:120px}.hc-val b{font-size:44px;font-weight:600;font-variant-numeric:tabular-nums;line-height:1}.hc-val span{font-size:18px;margin-left:2px}.hc-val small{display:block;font-size:12px;color:var(--secondary-text-color,#9aa3ad)}'
  +'.hc-val.pend b{color:#ffb35c}'
  +'.hc-row{display:flex;flex-wrap:wrap;gap:8px}.hc-row button{flex:1 1 0;min-width:64px;min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}'
  +'.hc-row button.on{background:rgba(255,122,92,.18);border-color:#ff7a5c;color:#ffd6cb}'
  +'.hc-rng{width:100%;accent-color:#ff7a5c;margin:0}.hc-rl{display:flex;justify-content:space-between;font-size:11px;color:var(--secondary-text-color,#9aa3ad);margin-top:-8px}'
  +'.hc-lbl{font-size:11px;color:var(--secondary-text-color,#9aa3ad);margin-bottom:-6px}'
  +'.hc-timed{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13px;background:rgba(255,179,92,.1);border-radius:10px;padding:8px 10px}.hc-timed:empty{display:none}'
  +'.hc-timed button{background:none;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:inherit;padding:5px 10px;cursor:pointer;min-height:32px}'
  +'.hc-ch svg{display:block;width:100%;height:90px}.hc-chl{display:flex;justify-content:space-between;font-size:11px;color:var(--secondary-text-color,#9aa3ad)}'
  +'.hc-ft{display:flex;gap:8px}.hc-ft button{flex:1;min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:none;color:inherit;font:inherit;cursor:pointer}'
  +'.roc-hc button:focus-visible,.roc-hc input:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}';
function rocHcEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function rocHcOpen(card,entity){
  if(!card||!entity||!card._hass)return;
  rocHcClose(card);
  if(card._hp)rocHpClose(card); // 7.3.0: the house panel gives way to the room
  if(card._lc)rocLcClose(card);if(card._xp)rocXpClose(card); // 7.4.0: and so do the light controller and the lens panels
  card._heat={entity:entity,dur:'always',pend:NaN,pendT:0,hist:null,histAt:0};
  if(!card._heatKey){card._heatKey=function(e){if(e.key==='Escape'&&card._heat)rocHcClose(card);};document.addEventListener('keydown',card._heatKey);}
  rocHcMount(card);rocHcUpdate(card);rocHcHistory(card);
  if(card._fpInst&&card._fpInst.setFocus)card._fpInst.setFocus(entity); // 7.3.0: outlined on the plan
}
function rocHcClose(card){
  const H=card&&card._heat;if(!H)return;
  clearTimeout(H.t);
  if(H.el&&H.el.parentNode)H.el.parentNode.removeChild(H.el);
  if(H.bd&&H.bd.parentNode)H.bd.parentNode.removeChild(H.bd);
  card._heat=null;
  if(card._fpInst&&card._fpInst.setFocus)card._fpInst.setFocus('');
  if(card._heatKey){document.removeEventListener('keydown',card._heatKey);card._heatKey=null;}
}
function rocHcMount(card){
  const H=card._heat,sr=card.shadowRoot,wrap=sr&&sr.querySelector('.wrap');if(!wrap)return;
  const lang=rocHcLang(card._hass),cfg=rocHcCfg(card._config,H.entity);
  const bd=document.createElement('div');bd.className='roc-hc-bd'+(card._fpActive?' hc-lite':'');bd.addEventListener('click',function(){rocHcClose(card);});
  const el=document.createElement('div');el.className='roc-hc'+(wrap.clientWidth&&wrap.clientWidth<600?' hc-bottom':'');
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  const T=function(k,v){return rocHcEsc(rocHcT(lang,k,v));};
  const durLbl={always:T('always'),'2h':T('h2'),evening:T('evening',{t:cfg.evening}),morning:T('morning')};
  el.innerHTML='<style>'+ROC_HC_CSS+'</style>'
    +'<div class="hc-hd"><div><div class="hc-room" data-hc-name></div><div class="hc-cur" data-hc-cur></div></div><button class="hc-x" data-hc="close" aria-label="'+T('close')+'">×</button></div>'
    +'<div class="hc-st" data-hc-st><i></i><span></span></div>'
    +'<div class="hc-tgt"><button data-hc="minus" aria-label="−">−</button><div class="hc-val" data-hc-val><b></b><span>°C</span><small>'+T('target')+'</small></div><button data-hc="plus" aria-label="+">+</button></div>'
    +'<div class="hc-lbl">'+T('quick')+'</div><div class="hc-row" data-hc-quick>'+cfg.quick.map(function(q){return'<button data-hc="q" data-v="'+q+'">'+rocHcEsc(rocHcFmt(lang,q))+'°</button>';}).join('')+'</div>'
    +'<input class="hc-rng" type="range" data-hc-rng min="'+cfg.range[0]+'" max="'+cfg.range[1]+'" step="'+cfg.step+'" aria-label="'+T('ruler')+'"><div class="hc-rl"><span>'+rocHcEsc(rocHcFmt(lang,cfg.range[0],0))+'°</span><span>'+rocHcEsc(rocHcFmt(lang,cfg.range[1],0))+'°</span></div>'
    +'<div data-hc-durw><div class="hc-lbl">'+T('dur')+'</div><div class="hc-row" data-hc-dur style="margin-top:12px">'+cfg.durations.map(function(d){return'<button data-hc="d" data-v="'+d+'">'+durLbl[d]+'</button>';}).join('')+'</div></div>'
    +'<div class="hc-timed" data-hc-timed></div>'
    +'<div class="hc-ch"><svg data-hc-ch viewBox="0 0 300 90" preserveAspectRatio="none" aria-hidden="true"></svg><div class="hc-chl"><span>'+T('ago')+'</span><span>'+T('now')+'</span></div></div>'
    +'<div class="hc-ft"><button data-hc="power"></button><button data-hc="more">'+T('more')+'</button></div>';
  el.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('[data-hc]');if(!b)return;
    const k=b.getAttribute('data-hc'),m=rocHcModel(card._hass.states[H.entity]);
    const cur=isFinite(H.pend)?H.pend:m.target;
    if(k==='close')rocHcClose(card);
    else if(k==='minus'||k==='plus')rocHcSet(card,(isFinite(cur)?cur:cfg.quick[0])+(k==='plus'?cfg.step:-cfg.step));
    else if(k==='q')rocHcSet(card,rocHcNum(b.getAttribute('data-v')));
    else if(k==='d'){H.dur=b.getAttribute('data-v');rocHcSet(card,isFinite(cur)?cur:cfg.quick[0],true);}
    else if(k==='cancel')card._hass.callService('versatile_thermostat','cancel_timed_preset',{entity_id:H.entity});
    else if(k==='power')card._hass.callService('climate','set_hvac_mode',{entity_id:H.entity,hvac_mode:m.on||m.pause?'off':'heat'});
    else if(k==='more'){const ev=new Event('hass-more-info',{bubbles:true,composed:true});ev.detail={entityId:H.entity};card.dispatchEvent(ev);rocHcClose(card);}
  });
  const rng=el.querySelector('[data-hc-rng]');
  rng.addEventListener('input',function(){rocHcSet(card,rocHcNum(rng.value));});
  wrap.appendChild(bd);wrap.appendChild(el);
  H.el=el;H.bd=bd;H.cfg=cfg;H.lang=lang;
  const x=el.querySelector('[data-hc="close"]');if(x)try{x.focus();}catch(_){}
}
// A new target: shown at once, sent after a short pause (one call for a run of taps).
function rocHcSet(card,v,now){
  const H=card._heat;if(!H||!isFinite(v))return;
  const m=rocHcModel(card._hass.states[H.entity]),cfg=H.cfg;
  const lo=isFinite(m.min)?Math.max(m.min,cfg.range[0]):cfg.range[0],hi=isFinite(m.max)?Math.min(m.max,cfg.range[1]):cfg.range[1];
  H.pend=Math.round(Math.max(lo,Math.min(hi,v))*10)/10;
  rocHcUpdate(card);
  clearTimeout(H.t);
  H.t=setTimeout(function(){
    if(card._heat!==H)return;
    const t=H.pend;H.pendT=Date.now();
    rocHcCommit(card._hass,H.entity,t,H.dur,cfg,rocHcModel(card._hass.states[H.entity])).catch(function(e){console.warn('[room-overlay-card] heating',e);});
  },now?0:900);
}
function rocHcUpdate(card){
  const H=card._heat;if(!H)return;
  const sr=card.shadowRoot;
  if(!H.el||!H.el.isConnected){if(sr&&sr.querySelector('.wrap')){H.el=null;rocHcMount(card);}if(!H.el)return;}
  const el=H.el,lang=H.lang,st=card._hass.states[H.entity],m=rocHcModel(st);
  // a sent target counts as arrived once the thermostat reports it (or after 15 s)
  if(isFinite(H.pend)&&H.pendT&&(Math.abs(m.target-H.pend)<0.05||Date.now()-H.pendT>15000)){H.pend=NaN;H.pendT=0;}
  const tgt=isFinite(H.pend)?H.pend:m.target;
  const nm=H.cfg.name||(st&&st.attributes&&st.attributes.friendly_name)||H.entity;
  const q=function(s){return el.querySelector(s);};
  q('[data-hc-name]').textContent=nm;
  el.setAttribute('aria-label',nm);
  q('[data-hc-cur]').innerHTML=rocHcEsc(rocHcFmt(lang,m.cur))+' °C'+(isFinite(m.hum)?'<small>'+rocHcEsc(rocHcFmt(lang,m.hum,0))+' %</small>':'');
  const s=rocHcStatus(lang,m,tgt),sb=q('[data-hc-st]');sb.className='hc-st '+s.cls;sb.querySelector('span').textContent=s.text;
  const v=q('[data-hc-val]');v.classList.toggle('pend',isFinite(H.pend));v.querySelector('b').textContent=rocHcFmt(lang,tgt);
  [].forEach.call(el.querySelectorAll('[data-hc="q"]'),function(b){b.classList.toggle('on',Math.abs(rocHcNum(b.getAttribute('data-v'))-tgt)<0.05);});
  const rng=q('[data-hc-rng]');if(isFinite(tgt)&&card.shadowRoot.activeElement!==rng)rng.value=String(tgt);
  const boost=rocHcBoost(card._hass,H.entity);
  q('[data-hc-durw]').style.display=boost?'':'none';
  [].forEach.call(el.querySelectorAll('[data-hc="d"]'),function(b){b.classList.toggle('on',b.getAttribute('data-v')===H.dur);});
  const tm=q('[data-hc-timed]');
  if(m.timed){const d=new Date(m.timed);tm.innerHTML='<span>'+rocHcEsc(rocHcT(lang,'timed',{t:isNaN(d)?'':d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}))+'</span><button data-hc="cancel">'+rocHcEsc(rocHcT(lang,'cancel'))+'</button>';}
  else tm.innerHTML='';
  q('[data-hc="power"]').textContent=rocHcT(lang,m.on||m.pause?'turn_off':'turn_on');
  if(H.hist&&Date.now()-H.histAt>300000)rocHcHistory(card);
}
// The last 24 h: temperature, target (dashed) and when it heated (bands).
function rocHcHistory(card){
  const H=card._heat;if(!H||!card._hass||typeof card._hass.callWS!=='function')return;
  H.histAt=Date.now();
  const start=new Date(Date.now()-86400000).toISOString();
  Promise.resolve(card._hass.callWS({type:'history/history_during_period',start_time:start,entity_ids:[H.entity],minimal_response:false,no_attributes:false,significant_changes_only:false})).then(function(r){
    if(card._heat!==H)return;
    const rows=(r&&r[H.entity])||[];let last={};
    H.hist=rows.map(function(x){const a=x.a||last;last=a;return{t:(x.lu||x.last_updated||0)*(typeof x.lu==='number'?1000:1),c:rocHcNum(a.current_temperature),g:rocHcNum(a.temperature),h:a.hvac_action==='heating'};}).filter(function(p){return p.t;});
    rocHcChart(card);
  }).catch(function(){});
}
function rocHcChart(card){
  const H=card._heat;if(!H||!H.el||!H.hist)return;
  const svg=H.el.querySelector('[data-hc-ch]');if(!svg)return;
  const now=Date.now(),t0=now-86400000,P=H.hist.filter(function(p){return isFinite(p.c);});
  if(P.length<2){svg.innerHTML='';return;}
  let lo=Infinity,hi=-Infinity;H.hist.forEach(function(p){[p.c,p.g].forEach(function(v){if(isFinite(v)&&v>5){lo=Math.min(lo,v);hi=Math.max(hi,v);}});});
  lo=Math.floor(lo-0.3);hi=Math.ceil(hi+0.3);
  const X=function(t){return Math.max(0,Math.min(300,(t-t0)/86400000*300)).toFixed(1);},Y=function(v){return(86-(v-lo)/(hi-lo||1)*80).toFixed(1);};
  let bands='',tl='',gl='',prevG=null;
  H.hist.forEach(function(p,i){
    const n=H.hist[i+1],te=n?n.t:now;
    if(p.h)bands+='<rect x="'+X(p.t)+'" y="0" width="'+Math.max(0.5,X(te)-X(p.t)).toFixed(1)+'" height="90" fill="#ff7a5c" opacity=".14"/>';
    if(isFinite(p.g)&&p.g>5){gl+=(prevG==null?'M':'L')+X(p.t)+' '+Y(p.g)+'H'+X(te);prevG=p.g;}
  });
  P.forEach(function(p,i){tl+=(i?'L':'M')+X(p.t)+' '+Y(p.c);});
  tl+='H300';
  svg.innerHTML=bands+'<path d="'+gl+'" fill="none" stroke="#9aa3ad" stroke-width="1.2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>'
    +'<path d="'+tl+'" fill="none" stroke="#ffb35c" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
}
