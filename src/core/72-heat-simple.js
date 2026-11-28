// ---- The quick heating mode (B, 7.5.0) — for phones and for everyone at home ---------------------
// One question per room: how warm. Four answers worked out from the room's usual temperature
// (heating.normal / the room's normal, 21.5 °C): warmer (+1 °C for 3 h, through VTherm's timed
// preset when the thermostat has the slot), usual, saving (−1.5 °C) and guard (heating.guard,
// 16 °C: no heating, only kept from cooling down). A sentence says what the floor does now — it
// heats, holds, saves, waits for the central mode, or runs on an estimate because its thermometer
// is silent; a line under it what the loop does (open how long of each cycle). At the bottom the
// house: "We are leaving" puts the central mode on Frost protection (a second tap confirms), and
// back. "More" opens the full controller (A).
// heating.simple decides when the `heating` action opens B instead of A: never (default), phone
// (a card or a screen narrower than 600 px) or always; view: simple | controller on the action wins.
const ROC_HS_STR={
  en:{how:'How warm do you want it',warm:'warmer for 3 hours',normal:'usual',eco:'saving',guard:'no heating, only guarding',more:'More',close:'Close',
    s_alert:'Heating on an estimate, without measuring.',x_alert:'The thermometer last reported {a}. Replace its battery or restart it.',
    s_guard:'No heating here now.',x_guard:'The heating starts only if it falls below {t}.',
    s_warm:'Warming up — about a degree warmer {eta}.',x_warm_eta:'in ~{t}',x_warm_slow:'in a while',x_warm:'Floor heating is slow, the change shows only later.',x_warm_end:'At {t} back to the previous temperature.',
    s_eco:'Saving — slowly down to {t}.',x_eco:'The floor keeps warming on its own for a few hours.',
    s_ok:'Warm, as it should be.',x_ok:'Holding {t}.',s_up:'Heating up to {t}.',x_up:'Now {c}.',s_hold:'Holding {t}.',
    s_pause:'The heating waits.',x_pause_central:'The central mode stopped it (high tariff, cooking or overload); it continues by itself.',x_pause_window:'A window is open.',x_pause:'Paused.',
    s_off:'The heating is off here.',x_off:'Pick a temperature to turn it on.',s_na:'The thermostat does not respond.',x_na:'Check it in Home Assistant.',
    f_full:'Loop open all the time',f_full_x:'The boiler heats the whole cycle.',f_some:'Heating gently',f_some_x:'The loop is open {on} of every {cyc} minutes.',f_shut:'Loop closed',f_shut_x:'It opens again when the room falls to its target.',
    f_safety:'Safety mode',f_safety_x:'The loop runs at {pw} % so the room neither cools down nor overheats.',f_wait:'Loop waits',f_wait_x:'It opens as soon as the central mode lets it.',
    away:'We are leaving — the whole home on frost protection',away_sure:'Tap again to confirm',home:'We are home — heat as usual',away_on:'The whole home is on frost protection.'},
  cs:{how:'Kolik stupňů chceš',warm:'tepleji na 3 hodiny',normal:'běžně',eco:'úspora',guard:'netopit, jen hlídat',more:'Víc možností',close:'Zavřít',
    s_alert:'Topí se zatím odhadem, bez měření.',x_alert:'Teploměr se naposledy ozval {a}. Vyměň v něm baterii nebo ho restartuj.',
    s_guard:'Tady se teď netopí.',x_guard:'Topení naskočí jen kdyby teplota klesla pod {t}.',
    s_warm:'Přitápím, o stupeň tepleji bude {eta}.',x_warm_eta:'za ~{t}',x_warm_slow:'za chvíli',x_warm:'Podlahovka je pomalá – změna se projeví až za chvíli.',x_warm_end:'V {t} zpět na předchozí teplotu.',
    s_eco:'Šetřím, pomalu klesne na {t}.',x_eco:'Podlaha ještě pár hodin hřeje sama.',
    s_ok:'Je tu teplo, jak má být.',x_ok:'Drží se {t}.',s_up:'Ohřívám na {t}.',x_up:'Teď je {c}.',s_hold:'Drží se {t}.',
    s_pause:'Topení čeká.',x_pause_central:'Zastavil ho centrální režim (VT, vaření nebo přetížení); pokračuje samo.',x_pause_window:'Je otevřené okno.',x_pause:'Pozastaveno.',
    s_off:'Topení je tu vypnuté.',x_off:'Vyber teplotu a zapne se.',s_na:'Termostat neodpovídá.',x_na:'Zkontroluj ho v Home Assistantu.',
    f_full:'Okruh otevřený naplno',f_full_x:'Kotel topí celý cyklus.',f_some:'Topí mírně',f_some_x:'Okruh je otevřený {on} z každých {cyc} minut.',f_shut:'Okruh zavřený',f_shut_x:'Znovu se otevře, až teplota klesne k cíli.',
    f_safety:'Nouzový režim',f_safety_x:'Okruh jede na {pw} % výkonu, aby místnost nevychladla ani se nepřetopila.',f_wait:'Okruh čeká',f_wait_x:'Otevře se, jakmile ho centrální režim pustí.',
    away:'Odjíždíme – celý byt na útlum',away_sure:'Klepni znovu pro potvrzení',home:'Jsme doma – topit normálně',away_on:'Celý byt je na útlumu (proti mrazu).'},
};
function rocHsT(lang,k,v){const t=ROC_HS_STR[lang]||ROC_HS_STR.en;let s=t[k]!=null?t[k]:(ROC_HS_STR.en[k]!=null?ROC_HS_STR.en[k]:k);if(v)for(const x in v)s=s.split('{'+x+'}').join(v[x]);return s;}
// B's settings for a thermostat (pure)
function rocHsCfg(cAll,entity){
  const H=cAll&&cAll.heating&&typeof cAll.heating==='object'?cAll.heating:{};
  const r=(Array.isArray(H.rooms)?H.rooms:[]).find(function(x){return x&&x.climate===entity;})||{};
  const nm=rocHcNum(r.normal),hn=rocHcNum(H.normal),g=rocHcNum(H.guard);
  const normal=isFinite(nm)?nm:(isFinite(hn)?hn:21.5);
  return{show:['never','phone','always'].indexOf(H.simple)>=0?H.simple:'never',normal:normal,warm:normal+1,eco:normal-1.5,guard:isFinite(g)?g:16};
}
// Which answer the thermostat's target is (pure): warm (only while it runs for a while) | normal | eco | guard | ''
function rocHsMode(t,c,timed){
  const eq=function(a,b){return isFinite(a)&&Math.abs(a-b)<0.05;};
  if(eq(t,c.warm)&&timed)return'warm';
  if(eq(t,c.normal))return'normal';if(eq(t,c.eco))return'eco';if(eq(t,c.guard))return'guard';
  return'';
}
// The sentence, its line and the loop's state (pure).
function rocHsText(lang,st,c,mode,tgt,now){
  now=now||Date.now();
  const T=function(k,v){return rocHsT(lang,k,v);},F=function(v){return rocHcFmt(lang,v)+' °C';};
  const m=rocHcModel(st),a=(st&&st.attributes)||{},ss=a.specific_states&&typeof a.specific_states==='object'?a.specific_states:{};
  const cf=a.configuration&&typeof a.configuration==='object'?a.configuration:{},sm=a.safety_manager&&typeof a.safety_manager==='object'?a.safety_manager:{};
  const lt=Date.parse(ss.last_temperature_datetime||''),lim=(rocHcNum(sm.safety_delay_min)>0?rocHcNum(sm.safety_delay_min):60)*60000;
  const o={alert:false,s:'',x:'',ft:'',fx:''};
  if(m.na){o.s=T('s_na');o.x=T('x_na');return o;}
  if(m.safety||!isFinite(m.cur)||(isFinite(lt)&&now-lt>lim)){o.alert=true;o.s=T('s_alert');o.x=T('x_alert',{a:rocAdAgo(lang,lt,now)});}
  else if(m.pause){o.s=T('s_pause');o.x=T(/central/.test(m.reason)?'x_pause_central':(/window/.test(m.reason)?'x_pause_window':'x_pause'));}
  else if(!m.on){o.s=T('s_off');o.x=T('x_off');}
  else if(mode==='guard'){o.s=T('s_guard');o.x=T('x_guard',{t:F(c.guard)});}
  else if(mode==='warm'){
    const eta=isFinite(m.slope)&&m.slope>0.05&&isFinite(m.cur)&&tgt>m.cur?T('x_warm_eta',{t:rocHcDur(lang,(tgt-m.cur)/m.slope*60)}):T('x_warm_slow');
    o.s=T('s_warm',{eta:eta});
    const d=m.timed?new Date(m.timed):null;
    o.x=d&&!isNaN(d)?T('x_warm_end',{t:d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'})}):T('x_warm');
  }
  else if(mode==='eco'&&isFinite(m.cur)&&m.cur>tgt+0.15){o.s=T('s_eco',{t:F(tgt)});o.x=T('x_eco');}
  else if(isFinite(m.cur)&&isFinite(tgt)&&m.cur<tgt-0.3){o.s=T('s_up',{t:F(tgt)});o.x=T('x_up',{c:F(m.cur)});}
  else if(mode==='normal'||mode==='eco'){o.s=T('s_ok');o.x=T('x_ok',{t:F(tgt)});}
  else{o.s=T('s_hold',{t:F(tgt)});o.x='';}
  // the loop
  const pw=isFinite(m.pw)?m.pw:(m.action==='heating'?100:0),cyc=rocHcNum(cf.cycle_min);
  if(m.safety){o.ft=T('f_safety');o.fx=T('f_safety_x',{pw:Math.round(pw)});}
  else if(m.pause){o.ft=T('f_wait');o.fx=T('f_wait_x');}
  else if(!m.on){o.ft='';o.fx='';}
  else if(pw>=99){o.ft=T('f_full');o.fx=T('f_full_x');}
  else if(pw>0.5){o.ft=T('f_some');o.fx=isFinite(cyc)&&cyc>0?T('f_some_x',{on:Math.max(1,Math.round(pw/100*cyc)),cyc:Math.round(cyc)}):rocHcT(lang,'heat_pw',{pw:Math.round(pw)});}
  else{o.ft=T('f_shut');o.fx=T('f_shut_x');}
  return o;
}
// The `heating` action: B, A or the administration, by view and heating.simple.
function rocHeatOpen(card,entity,view){
  if(!card||!card._hass)return;
  if(view==='check'||view==='log'){if(rocAdAllowed(card._hass,card._config))rocAdOpen(card,view);else console.warn('[room-overlay-card] heating '+view+': for admins only');return;}
  const rooms=rocHpRooms(card._config,rocFpCfg(card._config,card._roomIdx));
  if(!entity&&rooms.length)entity=rooms[0].entity;
  if(!entity)return;
  if(view==='controller'){rocHcOpen(card,entity);return;}
  const c=rocHsCfg(card._config,entity);
  const wrap=card.shadowRoot&&card.shadowRoot.querySelector('.wrap'),w=wrap&&wrap.clientWidth;
  const phone=(w&&w<600)||(typeof window!=='undefined'&&window.innerWidth&&window.innerWidth<600);
  if(view==='simple'||c.show==='always'||(c.show==='phone'&&phone))rocHsOpen(card,entity);else rocHcOpen(card,entity);
}
const ROC_HS_CSS='.roc-hs{position:absolute;z-index:411;top:0;right:0;bottom:0;width:min(400px,94%);box-sizing:border-box;overflow-y:auto;background:#0b0e13;color:var(--primary-text-color,#f2f3f5);border-radius:14px 0 0 14px;box-shadow:-8px 0 30px rgba(0,0,0,.45);display:flex;flex-direction:column;font:15px/1.4 var(--paper-font-body1_-_font-family,system-ui,sans-serif);}'
  +'.roc-hs.hs-bottom{top:auto;left:0;width:auto;max-height:94%;border-radius:14px 14px 0 0;}'
  +'.hs-hero{padding:12px 18px 22px;display:flex;flex-direction:column;gap:8px;background:radial-gradient(120% 80% at 50% 110%,rgba(255,150,60,.35) 0%,rgba(255,120,40,.08) 45%,rgba(11,14,19,0) 75%),linear-gradient(180deg,#1c2433 0%,#121722 70%,#0b0e13 100%)}'
  +'.hs-hero.al{background:linear-gradient(180deg,#2a1d12 0%,#1a140f 60%,#0b0e13 100%)}'
  +'.hs-top{display:flex;align-items:center;gap:8px}.hs-tabs{display:flex;gap:6px;flex:1;min-width:0;overflow-x:auto}'
  +'.hs-tabs button{min-height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(11,14,19,.45);color:inherit;font:inherit;font-size:13px;padding:0 14px;cursor:pointer;white-space:nowrap}.hs-tabs button.on{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.45)}'
  +'.hs-x{background:none;border:0;color:inherit;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1;flex:none}'
  +'.hs-cur{font-size:64px;font-weight:300;line-height:1;font-variant-numeric:tabular-nums;text-align:center;margin-top:10px}.hs-cur span{font-size:26px;vertical-align:top;margin-left:2px}'
  +'.hs-s{font-size:18px;font-weight:600;text-align:center}.hs-hero.al .hs-s{color:#ffb877}.hs-x2{font-size:13px;text-align:center;color:var(--secondary-text-color,#9aa3ad)}.hs-x2:empty{display:none}'
  +'.hs-body{padding:14px 18px 18px;display:flex;flex-direction:column;gap:12px}.hs-lbl{font-size:12px;color:var(--secondary-text-color,#9aa3ad)}'
  +'.hs-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.hs-modes button{min-height:64px;border-radius:12px;border:1px solid #253041;background:#121820;color:inherit;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}'
  +'.hs-modes button b{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}.hs-modes button small{font-size:12px;color:var(--secondary-text-color,#9aa3ad)}.hs-modes button.on{background:rgba(255,162,76,.16);border-color:#ffa24c}'
  +'.hs-ft{border-radius:12px;background:#121820;padding:10px 14px}.hs-ft:empty{display:none}.hs-ft b{display:block;font-weight:600}.hs-ft span{font-size:13px;color:var(--secondary-text-color,#9aa3ad)}'
  +'.hs-away{min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:none;color:inherit;font:inherit;cursor:pointer;padding:0 12px}.hs-away.sure{border-color:#ffa24c;color:#ffd0a0}.hs-away.home{border-color:#6aa8ff}'
  +'.hs-on{font-size:13px;color:#9ec5ff;text-align:center}.hs-on:empty{display:none}'
  +'.hs-more{align-self:center;background:none;border:0;color:var(--secondary-text-color,#9aa3ad);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer;min-height:36px}'
  +'.roc-hs button:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}';
function rocHsOpen(card,entity){
  if(!card||!entity||!card._hass)return;
  rocHsClose(card);if(card._heat)rocHcClose(card);if(card._hp)rocHpClose(card);if(card._ad)rocAdClose(card);if(card._lc)rocLcClose(card);if(card._xp)rocXpClose(card);
  const sr=card.shadowRoot,wrap=sr&&sr.querySelector('.wrap');if(!wrap)return;
  const lang=rocHcLang(card._hass),T=function(k,v){return rocHcEsc(rocHsT(lang,k,v));};
  const bd=document.createElement('div');bd.className='roc-hc-bd'+(card._fpActive?' hc-lite':'');bd.addEventListener('click',function(){rocHsClose(card);});
  const el=document.createElement('div');el.className='roc-hs'+(wrap.clientWidth&&wrap.clientWidth<600?' hs-bottom':'');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.innerHTML='<style>'+ROC_HS_CSS+'</style><div class="hs-hero" data-hs-hero><div class="hs-top"><div class="hs-tabs" data-hs-tabs></div><button class="hs-x" data-hs="close" aria-label="'+T('close')+'">×</button></div>'
    +'<div class="hs-cur" data-hs-cur></div><div class="hs-s" data-hs-s></div><div class="hs-x2" data-hs-x></div></div>'
    +'<div class="hs-body"><div class="hs-lbl">'+T('how')+'</div><div class="hs-modes" data-hs-modes></div><div class="hs-ft" data-hs-ft></div>'
    +'<div class="hs-on" data-hs-on></div><button class="hs-away" data-hs="away"></button><button class="hs-more" data-hs="more">'+T('more')+'</button></div>';
  el.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('[data-hs]');if(!b)return;
    const k=b.getAttribute('data-hs'),B=card._hs;if(!B)return;
    if(k==='close')rocHsClose(card);
    else if(k==='room'){B.entity=b.getAttribute('data-v');B.pend='';B.sig='';rocHsUpdate(card);if(card._fpInst&&card._fpInst.setFocus)card._fpInst.setFocus(B.entity);}
    else if(k==='mode')rocHsPick(card,b.getAttribute('data-v'));
    else if(k==='more'){const ent=B.entity;rocHsClose(card);rocHcOpen(card,ent);}
    else if(k==='away')rocHsAway(card);
  });
  wrap.appendChild(bd);wrap.appendChild(el);
  card._hs={el:el,bd:bd,lang:lang,entity:entity,pend:'',pendT:0,sure:0,sig:''};
  if(!card._hsKey){card._hsKey=function(e){if(e.key==='Escape'&&card._hs)rocHsClose(card);};document.addEventListener('keydown',card._hsKey);}
  rocHsUpdate(card);
  if(card._fpInst&&card._fpInst.setFocus)card._fpInst.setFocus(entity);
  const x=el.querySelector('[data-hs="close"]');if(x)try{x.focus();}catch(_){}
}
function rocHsClose(card){
  const B=card&&card._hs;if(!B)return;
  clearTimeout(B.st);
  if(B.el&&B.el.parentNode)B.el.parentNode.removeChild(B.el);
  if(B.bd&&B.bd.parentNode)B.bd.parentNode.removeChild(B.bd);
  card._hs=null;
  if(card._fpInst&&card._fpInst.setFocus)card._fpInst.setFocus('');
  if(card._hsKey){document.removeEventListener('keydown',card._hsKey);card._hsKey=null;}
}
function rocHsPick(card,mode){
  const B=card._hs;if(!B)return;
  const hass=card._hass,c=rocHsCfg(card._config,B.entity),st=hass.states[B.entity],m=rocHcModel(st);
  const t=c[mode];if(!isFinite(t))return;
  B.pend=mode;B.pendT=Date.now();B.sig='';rocHsUpdate(card);
  const go=function(){return rocHcCommit(hass,B.entity,t,mode==='warm'?'3h':'always',rocHcCfg(card._config,B.entity),m);};
  const p=!m.on&&!m.pause?Promise.resolve(hass.callService('climate','set_hvac_mode',{entity_id:B.entity,hvac_mode:'heat'})).then(go):go();
  p.catch(function(e){console.warn('[room-overlay-card] heating',e);});
}
// The house: Frost protection while away (second tap within 4 s), back to Heat only / Auto.
function rocHsAway(card){
  const B=card._hs;if(!B)return;
  const hass=card._hass,house=rocHpHouse(hass,card._config),ms=house.mode&&hass.states[house.mode];if(!ms)return;
  const opts=(ms.attributes&&ms.attributes.options)||[];
  if(ms.state==='Frost protection'){const back=opts.indexOf('Heat only')>=0?'Heat only':'Auto';hass.callService('select','select_option',{entity_id:house.mode,option:back});return;}
  if(!B.sure||Date.now()-B.sure>4000){B.sure=Date.now();B.sig='';rocHsUpdate(card);clearTimeout(B.st);B.st=setTimeout(function(){if(card._hs===B){B.sure=0;B.sig='';rocHsUpdate(card);}},4000);return;}
  B.sure=0;clearTimeout(B.st);
  hass.callService('select','select_option',{entity_id:house.mode,option:'Frost protection'});
}
function rocHsUpdate(card){
  const B=card._hs;if(!B)return;
  if(!B.el.isConnected){rocHsClose(card);return;}
  const hass=card._hass,S=hass.states,lang=B.lang,T=function(k,v){return rocHcEsc(rocHsT(lang,k,v));};
  const rooms=rocHpRooms(card._config,rocFpCfg(card._config,card._roomIdx));
  if(!rooms.some(function(r){return r.entity===B.entity;}))rooms.unshift({entity:B.entity,name:rocHcCfg(card._config,B.entity).name});
  const st=S[B.entity],m=rocHcModel(st),c=rocHsCfg(card._config,B.entity);
  let mode=rocHsMode(m.target,c,!!m.timed);
  // a picked answer shows at once; it counts as arrived once the thermostat reports it (or after 15 s)
  if(B.pend&&(mode===B.pend||Date.now()-B.pendT>15000))B.pend='';
  if(B.pend)mode=B.pend;
  const tgt=B.pend?c[B.pend]:m.target;
  const tx=rocHsText(lang,st,c,mode,tgt);
  const house=rocHpHouse(hass,card._config),ms=house.mode&&S[house.mode],opts=ms&&Array.isArray(ms.attributes&&ms.attributes.options)?ms.attributes.options:[];
  const H=card._config.heating&&typeof card._config.heating==='object'?card._config.heating:{};
  const away=!!ms&&opts.indexOf('Frost protection')>=0&&H.away!==false;
  const frost=!!ms&&ms.state==='Frost protection';
  const nm=rocHpName(hass,rooms.find(function(r){return r.entity===B.entity;})||{entity:B.entity});
  const sig=[B.entity,mode,tgt,m.cur,tx.s,tx.x,tx.ft,tx.fx,away,frost,B.sure,rooms.length].join('|');
  if(sig===B.sig)return;B.sig=sig;
  B.el.setAttribute('aria-label',nm);
  const q=function(s){return B.el.querySelector(s);};
  q('[data-hs-hero]').classList.toggle('al',tx.alert);
  q('[data-hs-tabs]').innerHTML=rooms.length>1?rooms.map(function(r){const on=r.entity===B.entity;return'<button data-hs="room" data-v="'+rocHcEsc(r.entity)+'"'+(on?' class="on" aria-pressed="true"':' aria-pressed="false"')+'>'+rocHcEsc(rocHpName(hass,r))+'</button>';}).join(''):'<span style="font-weight:600">'+rocHcEsc(nm)+'</span>';
  q('[data-hs-cur]').innerHTML=tx.alert||!isFinite(m.cur)?'—':rocHcEsc(rocHcFmt(lang,m.cur))+'<span>°C</span>';
  q('[data-hs-s]').textContent=tx.s;q('[data-hs-x]').textContent=tx.x;
  q('[data-hs-modes]').innerHTML=['warm','normal','eco','guard'].map(function(k){return'<button data-hs="mode" data-v="'+k+'"'+(mode===k?' class="on" aria-pressed="true"':' aria-pressed="false"')+'><b>'+rocHcEsc(rocHcFmt(lang,c[k]))+' °C</b><small>'+T(k)+'</small></button>';}).join('');
  q('[data-hs-ft]').innerHTML=tx.ft?'<b>'+rocHcEsc(tx.ft)+'</b><span>'+rocHcEsc(tx.fx)+'</span>':'';
  q('[data-hs-on]').textContent=frost?rocHsT(lang,'away_on'):'';
  const ab=q('[data-hs="away"]');ab.style.display=away?'':'none';
  ab.className='hs-away'+(frost?' home':(B.sure?' sure':''));ab.textContent=rocHsT(lang,frost?'home':(B.sure?'away_sure':'away'));
}
