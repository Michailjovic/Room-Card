// ---- Heating administration (7.5.0, HEATING_PLAN.md decision 8) -----------------------------------
// For admins only (hass.user.is_admin; heating.admin: false hides it): a sheet over the card with
// two tabs, opened from the house panel's footer or the `heating` action with view: check | log.
//   Settings check — what Versatile Thermostat reports about every room: regulation (auto-TPI),
//     sensors, safety / heating failure detection / window, the house; then a list of findings
//     (warnings first) worked out from the same attributes.
//   Event log — the HA logbook of the last days (heating.log.days, 7): every time the central mode
//     stopped the heating is ONE event with its cause (high tariff, cooking, overload, by hand),
//     how long it lasted and the steps around it (the logbook entries of the house entities, the
//     rooms and heating.log's entities); a message an automation wrote with logbook.log on the
//     central mode (`… · kuchyň 2,4 kW · L1 4,3 A …`) is the event's summary, its kW and phase
//     currents are read out of it. The detail draws the highest current of each phase during the
//     pause (history of heating.log.phases), with the boiler's share (heating.log.boiler_amps) and
//     the main breaker (heating.log.breaker).
// Everything here only reads; nothing is changed from the sheet.
const ROC_AD_STR={
  en:{title:'Heating · administration',t_check:'Settings check',t_log:'Event log',close:'Close',back:'Back',reload:'Reload',
    c_reg:'Regulation',c_sens:'Sensors (temperature)',c_safe:'Safety',c_house:'House',findings:'Findings',
    cyc:'Cycle',cyc_v:'{n} min',out:'Outside',tpi_v:'{i} / {e} · {n} cycles',tpi_learn:'learning since {d} · {n} cycles',tpi_fix:'TPI {i} / {e}',no_vt:'not a Versatile Thermostat',
    ago_m:'{n} min ago',ago_h:'{n} h ago',ago_d:'{n} d ago',never:'—',
    sf_v:'{d} min → {p} %',sf_on:'SAFETY MODE',sf_none:'no safety',hf_v:'failure {d}',hf_none:'no failure detection',hf_on:'HEATING FAILURE',win:'window',win_open:'window open',
    h_mode:'Central mode',h_boiler:'Boiler',h_tariff:'Tariff',h_cook:'Cooking',h_over:'Overload',on:'on',off:'off',
    w_presets:'{r}: all presets at {t} °C',w_presets_x:'The time-limited temperature runs through the boost preset and Frost protection holds the frost preset — now {f} °C. Set the presets in the thermostat\'s options.',
    w_learn:'{r}: auto-TPI learning stands still',w_learn_x:'The loop runs at full power ({s}); such cycles do not count. It moves on once the room gets close to its target.',
    w_learn0:'{r}: auto-TPI learning stands still',w_learn0_x:'The loop stays closed (target {t} °C, the room {c} °C); cycles without heating do not count. It moves on once the room needs heat.',
    w_hf:'{r}: heating failure detection is off',w_hf_x:'For floor heating turn it on with a delay of 2–3 h — it also catches a boiler that dropped out.',
    a_hf:'{r}: heating failure',a_hf_x:'The room did not warm up although it heated. Check the boiler, the pump and the loop\'s valve.',
    w_sf:'{r}: no safety mode',w_sf_x:'Without it a silent sensor leaves the loop as it was.',
    a_sf:'{r}: running in safety mode',a_sf_x:'The thermometer is silent; the loop runs at {p} % until it reports again.',
    w_old:'{r}: the thermometer is silent',w_old_x:'Last value {a}. Replace the battery or restart it.',
    w_central:'{r}: ignores the central mode',w_central_x:'High tariff, cooking or an overload will not stop this loop.',
    w_under:'{r}: a switch is unavailable',w_under_x:'{e}',
    i_boost:'{r}: no slot for a time-limited temperature',i_boost_x:'The controller then only keeps a temperature (For 2 h / Until evening are hidden).',
    i_win:'{r}: no window detection',i_win_x:'An open window does not pause the heating.',
    i_pow:'{r}: device power {p} kW',i_pow_x:'Only VTherm\'s energy statistics; it does not change the regulation.',
    i_msg:'{r}: {m}',
    o_hf:'Heating failure detection everywhere',o_hf_x:'After {d} without warming up a room reports a failure.',
    o_sf:'Safety mode everywhere',o_sf_x:'{d} min without data → {p} % power.',
    o_central:'Every room follows the central mode',o_central_x:'Stopped at high tariff, cooking and overload, heating otherwise.',
    o_sens:'Every thermometer reports',o_sens_x:'The newest value of each is younger than its safety delay.',
    k_n:'Pauses',k_sum:'Stopped in total',k_max:'Longest',f_all:'All',f_cooking:'Cooking',f_overload:'Overload',f_tariff:'High tariff',f_sensor:'Sensors',f_manual:'By hand',f_other:'Other',
    today:'Today',loading:'Loading…',err:'The logbook could not be read: {e}',empty:'Nothing in the last {n} days.',pick:'Pick an event.',
    e_cooking:'Cooking → boiler paused',e_overload:'Supply overload → boiler off',e_tariff:'High tariff → heating stopped',e_manual:'Stopped by hand',e_other:'Heating paused',
    e_mode:'House mode → {m}',e_by_hand:'by hand',e_na:'{r}: thermostat unavailable',e_back:'{r}: thermostat back',e_off_hand:'{r}: turned off by hand',e_on_hand:'{r}: turned on by hand',
    pause:'pause {d}',lasts:'lasts {d}',react:'reaction {s} s',kw:'kitchen {v} kW',
    steps:'Steps',phases:'Highest phase current during the pause',ph_msg:'Phase currents when it was written',ph_load:'Reading the currents…',with_b:'With the boiler running the highest phase would be ~{v} A.',breaker:'breaker {v} A',
    s_on:'on',s_off:'off',s_unavailable:'unavailable',s_heat:'heats',s_idle:'idle'},
  cs:{title:'Topení · správa',t_check:'Kontrola nastavení',t_log:'Záznam událostí',close:'Zavřít',back:'Zpět',reload:'Načíst znovu',
    c_reg:'Regulace',c_sens:'Čidla (teplota)',c_safe:'Bezpečnost',c_house:'Dům',findings:'Kontrola nastavení',
    cyc:'Cyklus',cyc_v:'{n} min',out:'Venku',tpi_v:'{i} / {e} · {n} cyklů',tpi_learn:'učí se od {d} · {n} cyklů',tpi_fix:'TPI {i} / {e}',no_vt:'není Versatile Thermostat',
    ago_m:'před {n} min',ago_h:'před {n} h',ago_d:'před {n} dny',never:'—',
    sf_v:'{d} min → {p} %',sf_on:'NOUZOVÝ REŽIM',sf_none:'bez nouzového režimu',hf_v:'porucha {d}',hf_none:'bez detekce poruchy',hf_on:'PORUCHA TOPENÍ',win:'okno',win_open:'okno otevřené',
    h_mode:'Centrální režim',h_boiler:'Kotel',h_tariff:'Tarif',h_cook:'Vaření',h_over:'Přetížení',on:'zapnuto',off:'vypnuto',
    w_presets:'{r}: presety mají všude {t} °C',w_presets_x:'Dočasná teplota jede přes preset boost a Proti mrazu drží preset frost – teď {f} °C. Presety se nastavují v možnostech termostatu.',
    w_learn:'{r}: učení auto-TPI stojí',w_learn_x:'Okruh jede na plný výkon ({s}); takové cykly se nepočítají. Pohne se, až se místnost přiblíží k cíli.',
    w_learn0:'{r}: učení auto-TPI stojí',w_learn0_x:'Okruh zůstává zavřený (cíl {t} °C, v místnosti {c} °C); cykly bez topení se nepočítají. Pohne se, až bude místnost potřebovat teplo.',
    w_hf:'{r}: detekce poruchy topení je vypnutá',w_hf_x:'Pro podlahovku zapnout se zpožděním 2–3 h – chytí i vypadlý kotel.',
    a_hf:'{r}: porucha topení',a_hf_x:'Místnost se neohřála, přestože topila. Zkontroluj kotel, čerpadlo a ventil okruhu.',
    w_sf:'{r}: chybí nouzový režim',w_sf_x:'Bez něj nechá umlklé čidlo okruh tak, jak byl.',
    a_sf:'{r}: běží nouzový režim',a_sf_x:'Teploměr mlčí; okruh jede na {p} %, dokud se znovu neozve.',
    w_old:'{r}: teploměr se neozývá',w_old_x:'Poslední hodnota {a}. Vyměň baterii nebo ho restartuj.',
    w_central:'{r}: neposlouchá centrální režim',w_central_x:'Vysoký tarif, vaření ani přetížení tenhle okruh nezastaví.',
    w_under:'{r}: spínač je nedostupný',w_under_x:'{e}',
    i_boost:'{r}: bez slotu pro dočasnou teplotu',i_boost_x:'Ovladač pak teplotu jen drží (Na 2 h / Do večera se skryjí).',
    i_win:'{r}: bez detekce okna',i_win_x:'Otevřené okno topení nepozastaví.',
    i_pow:'{r}: výkon zařízení {p} kW',i_pow_x:'Jen statistika energie ve VTherm, na regulaci nemá vliv.',
    i_msg:'{r}: {m}',
    o_hf:'Detekce poruchy topení všude',o_hf_x:'Po {d} bez ohřevu místnost ohlásí poruchu.',
    o_sf:'Nouzový režim všude',o_sf_x:'{d} min bez dat → {p} % výkonu.',
    o_central:'Všechny místnosti poslouchají centrální režim',o_central_x:'Stopped při VT, vaření a přetížení, jinak topí.',
    o_sens:'Všechny teploměry hlásí',o_sens_x:'Poslední hodnota každého je mladší než jeho nouzová prodleva.',
    k_n:'Pauzy',k_sum:'Stálo celkem',k_max:'Nejdelší',f_all:'Vše',f_cooking:'Vaření',f_overload:'Přetížení',f_tariff:'VT',f_sensor:'Čidla',f_manual:'Ručně',f_other:'Ostatní',
    today:'Dnes',loading:'Načítám…',err:'Logbook se nepodařilo načíst: {e}',empty:'Za posledních {n} dní nic.',pick:'Vyber událost.',
    e_cooking:'Vaří se → kotel pozastaven',e_overload:'Přetížení přívodu → kotel vypnut',e_tariff:'VT → topení stojí',e_manual:'Zastaveno ručně',e_other:'Topení pozastaveno',
    e_mode:'Režim domu → {m}',e_by_hand:'ručně',e_na:'{r}: termostat nedostupný',e_back:'{r}: termostat znovu hlásí',e_off_hand:'{r}: vypnuto ručně',e_on_hand:'{r}: zapnuto ručně',
    pause:'pauza {d}',lasts:'trvá {d}',react:'reakce {s} s',kw:'kuchyň {v} kW',
    steps:'Průběh',phases:'Nejvyšší proud fází během pauzy',ph_msg:'Proudy fází v okamžiku zápisu',ph_load:'Načítám proudy…',with_b:'Kdyby běžel kotel, měla by nejvyšší fáze ~{v} A.',breaker:'jistič {v} A',
    s_on:'zapnuto',s_off:'vypnuto',s_unavailable:'nedostupné',s_heat:'topí',s_idle:'nečinný'},
};
function rocAdT(lang,k,v){const t=ROC_AD_STR[lang]||ROC_AD_STR.en;let s=t[k]!=null?t[k]:(ROC_AD_STR.en[k]!=null?ROC_AD_STR.en[k]:k);if(v)for(const x in v)s=s.split('{'+x+'}').join(v[x]);return s;}
// The administration is for admins, unless heating.admin is false.
function rocAdAllowed(hass,cAll){
  const H=cAll&&cAll.heating&&typeof cAll.heating==='object'?cAll.heating:{};
  return H.admin!==false&&!!(hass&&hass.user&&hass.user.is_admin);
}
function rocAdLog(cAll){
  const H=cAll&&cAll.heating&&typeof cAll.heating==='object'?cAll.heating:{},L=H.log&&typeof H.log==='object'?H.log:{};
  const ents=function(v){return(Array.isArray(v)?v:(v?[v]:[])).map(function(x){return String(x&&typeof x==='object'?x.entity||'':x);}).filter(function(x){return/^[a-z_]+\.[a-z0-9_]+$/.test(x);});};
  const n=rocHcNum(L.days);
  return{days:n>0?Math.min(30,Math.round(n)):7,cooking:ents(L.cooking),overload:ents(L.overload),phases:ents(L.phases),entities:ents(L.entities),
    breaker:rocHcNum(L.breaker)>0?rocHcNum(L.breaker):NaN,boilerA:rocHcNum(L.boiler_amps)>0?rocHcNum(L.boiler_amps):NaN};
}
// "{n} min / h / days ago" for a time in ms
function rocAdAgo(lang,ms,now){
  if(!(ms>0))return rocAdT(lang,'never');
  const m=Math.max(0,((now||Date.now())-ms)/60000);
  return m<90?rocAdT(lang,'ago_m',{n:Math.round(m)}):(m<2880?rocAdT(lang,'ago_h',{n:Math.round(m/60)}):rocAdT(lang,'ago_d',{n:Math.round(m/1440)}));
}
function rocAdDur(lang,min){return min>0?rocHcDur(lang,min):rocHcT(lang,'min',{n:0});}
// One room's VTherm facts the check needs (pure). auto_tpi_learning sits in specific_states on
// VTherm 10.6, at the top on older ones.
function rocAdRoom(st,now){
  const a=(st&&st.attributes)||{},ss=a.specific_states&&typeof a.specific_states==='object'?a.specific_states:{};
  const cf=a.configuration&&typeof a.configuration==='object'?a.configuration:{};
  const o=function(v){return v&&typeof v==='object'?v:{};};
  const sm=o(a.safety_manager),hf=o(a.heating_failure_detection_manager),wm=o(a.window_manager),pm=o(a.power_manager),sw=o(a.vtherm_over_switch);
  const at=o(ss.auto_tpi_learning&&typeof ss.auto_tpi_learning==='object'?ss.auto_tpi_learning:a.auto_tpi_learning);
  const pt=o(a.preset_temperatures);
  const lt=Date.parse(ss.last_temperature_datetime||'');
  return{vt:!!a.specific_states,cur:rocHcNum(a.current_temperature),target:rocHcNum(a.temperature),pw:rocHcNum(a.power_percent),
    cycle:rocHcNum(cf.cycle_min),central:cf.is_controlled_by_central_mode,
    tpiOn:ss.auto_tpi_state==='on'||at.autolearn_enabled===true,ci:rocHcNum(at.coeff_indoor_heat),co:rocHcNum(at.coeff_outdoor_heat),cycles:rocHcNum(at.total_cycles),
    learnFrom:Date.parse(at.learning_start_date||''),learn:String(at.last_learning_status||''),ti:rocHcNum(sw.tpi_coef_int),te:rocHcNum(sw.tpi_coef_ext),
    tempAt:isFinite(lt)?lt:NaN,ext:rocHcNum(ss.ext_current_temperature),
    sfCfg:a.is_safety_configured,sfOn:sm.safety_state==='on',sfDelay:rocHcNum(sm.safety_delay_min),sfPct:rocHcNum(sm.safety_default_on_percent),
    hfCfg:a.is_heating_failure_detection_configured,hfOn:hf.heating_failure_state==='on',hfDelay:rocHcNum(hf.detection_delay_min),
    winCfg:a.is_window_configured,winOpen:wm.window_state==='on',
    devPow:rocHcNum(pm.device_power),under:Array.isArray(ss.unavailable_underlying_entities)?ss.unavailable_underlying_entities.map(String):[],
    msgs:Array.isArray(ss.messages)?ss.messages.map(String).filter(Boolean):[],
    presets:['frost','eco','comfort','boost'].map(function(k){return rocHcNum(pt[k+'_temp']);}),now:now||Date.now()};
}
// The settings check (pure): cards of facts and the findings, alert > warn > ok > info.
function rocAdCheck(hass,cAll,lang,now){
  now=now||Date.now();
  const S=(hass&&hass.states)||{},rooms=rocHpRooms(cAll,null),house=rocHpHouse(hass,cAll),L=rocAdLog(cAll);
  const T=function(k,v){return rocAdT(lang,k,v);},F=function(v,d){return rocHcFmt(lang,v,d);};
  const R=rooms.map(function(r){return{name:rocHpName(hass,r),entity:r.entity,f:rocAdRoom(S[r.entity],now),st:S[r.entity]};});
  const V=R.filter(function(x){return x.f.vt;});
  const ok='ok',warn='warn',n='';
  const reg=[],sens=[],safe=[];
  R.forEach(function(x){
    const f=x.f;
    if(!f.vt){reg.push({k:x.name,v:T('no_vt'),c:n});return;}
    if(f.tpiOn&&isFinite(f.ci))reg.push({k:x.name,v:isFinite(f.learnFrom)&&f.cycles<20?T('tpi_learn',{d:new Date(f.learnFrom).toLocaleDateString(lang,{day:'numeric',month:'numeric'}),n:f.cycles||0}):T('tpi_v',{i:F(f.ci,2),e:F(f.co,3),n:isFinite(f.cycles)?f.cycles:0}),c:/^power_out_of_range/.test(f.learn)?warn:n});
    else if(isFinite(f.ti))reg.push({k:x.name,v:T('tpi_fix',{i:F(f.ti,2),e:F(f.te,3)}),c:n});
    const lim=(isFinite(f.sfDelay)&&f.sfDelay>0?f.sfDelay:60)*60000;
    sens.push({k:x.name,v:rocAdAgo(lang,f.tempAt,now),c:!isFinite(f.tempAt)?n:(now-f.tempAt>lim?warn:ok)});
    const p=[];
    p.push(f.sfOn?T('sf_on'):(f.sfCfg?T('sf_v',{d:isFinite(f.sfDelay)?f.sfDelay:'?',p:isFinite(f.sfPct)?Math.round(f.sfPct*100):'?'}):T('sf_none')));
    p.push(f.hfOn?T('hf_on'):(f.hfCfg?T('hf_v',{d:rocAdDur(lang,f.hfDelay)}):T('hf_none')));
    if(f.winCfg)p.push(T(f.winOpen?'win_open':'win'));
    safe.push({k:x.name,v:p.join(' · '),c:f.sfOn||f.hfOn?'alert':(f.sfCfg&&f.hfCfg?ok:warn)});
  });
  // the cycle: the usual one, the rooms with another named
  const cy=V.filter(function(x){return isFinite(x.f.cycle);});
  if(cy.length){
    const cnt={};cy.forEach(function(x){cnt[x.f.cycle]=(cnt[x.f.cycle]||0)+1;});
    const top=+Object.keys(cnt).sort(function(a,b){return cnt[b]-cnt[a];})[0];
    reg.push({k:T('cyc'),v:[T('cyc_v',{n:F(top,0)})].concat(cy.filter(function(x){return x.f.cycle!==top;}).map(function(x){return x.name+' '+T('cyc_v',{n:F(x.f.cycle,0)});})).join(' · '),c:n});
  }
  const ex=V.map(function(x){return x.f.ext;}).find(isFinite);
  if(isFinite(ex))sens.push({k:T('out'),v:F(ex)+' °C',c:n});
  const hs=[];
  const stv=function(id){const s=S[id];return s?String(s.state):'';};
  if(house.mode&&S[house.mode])hs.push({k:T('h_mode'),v:rocHpT(lang,'m_'+stv(house.mode)),c:stv(house.mode)==='Stopped'?warn:ok});
  if(house.boiler&&S[house.boiler])hs.push({k:T('h_boiler'),v:rocHpT(lang,stv(house.boiler)==='on'?'b_on':'b_off'),c:n});
  if(house.tariff&&S[house.tariff.entity])hs.push({k:T('h_tariff'),v:rocHpT(lang,stv(house.tariff.entity)===house.tariff.high?'high':'low'),c:n});
  const lst=function(ids,k){ids.forEach(function(id){if(!S[id])return;const a=S[id].attributes||{};hs.push({k:T(k)+' · '+(a.friendly_name||id),v:rocAdState(lang,S[id].state),c:S[id].state==='on'&&k==='h_over'?warn:n});});};
  lst(L.cooking,'h_cook');lst(L.overload,'h_over');
  const cards=[{title:T('c_reg'),rows:reg},{title:T('c_sens'),rows:sens},{title:T('c_safe'),rows:safe}].filter(function(c){return c.rows.length;});
  if(hs.length)cards.push({title:T('c_house'),rows:hs});
  // findings: one per kind, naming every room it applies to
  const out=[];
  const add=function(lvl,k,test,vals){
    const hit=V.filter(function(x){return test(x.f,x);});if(!hit.length)return false;
    const v=Object.assign({r:hit.map(function(x){return x.name;}).join(', ')},vals?vals(hit[0].f,hit[0]):{});
    out.push({lvl:lvl,title:T(k,v),text:T(k+'_x',v)});return true;
  };
  const icon={alert:'!',warn:'!',ok:'✓',info:'i'};
  add('alert','a_hf',function(f){return f.hfOn;});
  add('alert','a_sf',function(f){return f.sfOn;},function(f){return{p:isFinite(f.pw)?Math.round(f.pw):'?'};});
  const old=add('warn','w_old',function(f){return!f.sfOn&&isFinite(f.tempAt)&&now-f.tempAt>(isFinite(f.sfDelay)&&f.sfDelay>0?f.sfDelay:60)*60000;},function(f){return{a:rocAdAgo(lang,f.tempAt,now)};});
  add('warn','w_presets',function(f){return f.presets.every(isFinite)&&f.presets.every(function(p){return p===f.presets[0];});},function(f){return{t:F(f.presets[0],0),f:F(f.presets[0],0)};});
  // learning stands still: power_out_of_range(100.0% …) = full power, (0.0% …) = the loop closed
  const lp=function(f){const m=/^power_out_of_range\((\d+(?:\.\d+)?)%/.exec(f.learn);return m?+m[1]:NaN;};
  add('warn','w_learn',function(f){return f.tpiOn&&lp(f)>=50;},function(f){return{s:isFinite(f.target)?F(f.cur)+' → '+F(f.target)+' °C':'100 %'};});
  add('warn','w_learn0',function(f){return f.tpiOn&&lp(f)<50;},function(f){return{t:F(f.target),c:F(f.cur)};});
  const hfOff=add('warn','w_hf',function(f){return f.hfCfg===false;});
  const sfOff=add('warn','w_sf',function(f){return f.sfCfg===false;});
  const cOff=house.mode?add('warn','w_central',function(f){return f.central===false;}):true;
  add('warn','w_under',function(f){return f.under.length>0;},function(f){return{e:f.under.join(', ')};});
  if(V.length&&!hfOff&&V.every(function(x){return x.f.hfCfg;}))out.push({lvl:ok,title:T('o_hf'),text:T('o_hf_x',{d:rocAdDur(lang,V[0].f.hfDelay)})});
  if(V.length&&!sfOff&&V.every(function(x){return x.f.sfCfg;}))out.push({lvl:ok,title:T('o_sf'),text:T('o_sf_x',{d:isFinite(V[0].f.sfDelay)?V[0].f.sfDelay:'?',p:isFinite(V[0].f.sfPct)?Math.round(V[0].f.sfPct*100):'?'})});
  if(V.length&&!cOff&&V.every(function(x){return x.f.central===true;}))out.push({lvl:ok,title:T('o_central'),text:T('o_central_x')});
  if(V.length&&!old&&V.every(function(x){return isFinite(x.f.tempAt);}))out.push({lvl:ok,title:T('o_sens'),text:T('o_sens_x')});
  add('info','i_boost',function(f,x){return!rocHcBoost(hass,x.entity);});
  add('info','i_win',function(f){return f.winCfg===false;});
  add('info','i_pow',function(f){return isFinite(f.devPow)&&f.devPow>0&&f.devPow<=0.05;},function(f){return{p:F(f.devPow,2)};});
  V.forEach(function(x){x.f.msgs.forEach(function(m){out.push({lvl:'info',title:T('i_msg',{r:x.name,m:m}),text:''});});});
  const ord={alert:0,warn:1,ok:2,info:3};
  out.sort(function(a,b){return ord[a.lvl]-ord[b.lvl];});
  out.forEach(function(c){c.icon=icon[c.lvl];});
  return{cards:cards,checks:out};
}
function rocAdState(lang,s){const k='s_'+s;return ROC_AD_STR.en[k]!=null?rocAdT(lang,k):String(s);}
// ---- the event log (pure parts) ----
// The entities whose logbook entries make the log: the central mode, the boiler, the tariff, the
// rooms, heating.log's cooking / overload / entities.
function rocHlEntities(hass,cAll){
  const house=rocHpHouse(hass,cAll),L=rocAdLog(cAll),out=[];
  const add=function(e){if(e&&out.indexOf(e)<0)out.push(e);};
  add(house.mode);add(house.boiler);if(house.tariff)add(house.tariff.entity);
  rocHpRooms(cAll,null).forEach(function(r){add(r.entity);});
  L.cooking.concat(L.overload,L.entities).forEach(add);
  return out;
}
// kW and phase currents out of a message: "… kuchyň 2,4 kW · L1 4,3 A · L2 0,9 A …"
function rocHlParse(msg){
  const s=String(msg||''),num=function(x){return parseFloat(String(x).replace(',','.'));};
  const k=/(-?\d+(?:[.,]\d+)?)\s*kW\b/.exec(s),ph=[];
  const re=/\bL([123])\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*A\b/g;let m;
  while((m=re.exec(s)))ph[+m[1]-1]=num(m[2]);
  return{kw:k?num(k[1]):NaN,ph:ph.length?[0,1,2].map(function(i){return isFinite(ph[i])?ph[i]:NaN;}):null};
}
// The entity whose change triggered the automation that wrote an entry ("state of switch.hdo").
function rocHlCause(e){const m=/^state of ([a-z_]+\.[a-z0-9_]+)/.exec(String(e&&e.context_source||''));return m?m[1]:'';}
function rocHlWhen(e){const w=e&&e.when;return typeof w==='number'?w*1000:Date.parse(w||'');}
// Logbook entries → events, newest first (pure). ctx: {mode, tariff, cooking, overload, rooms:{entity: name}}
function rocHlBuild(entries,ctx){
  const E=(Array.isArray(entries)?entries:[]).map(function(e){return Object.assign({t:rocHlWhen(e)},e);}).filter(function(e){return isFinite(e.t);}).sort(function(a,b){return a.t-b.t||((a.message!=null&&a.state==null)-(b.message!=null&&b.state==null));}); // same time: the state change before the message written with it
  const out=[],recent=[];let open=null,last=null,mode=null,id=0,pendNote=null;
  const rooms=ctx.rooms||{},roomSt={};
  const step=function(ev,e){ev.steps.push(e);};
  const typeOf=function(e){
    const c=rocHlCause(e);
    if(ctx.tariff&&c===ctx.tariff)return'tariff';
    if((ctx.cooking||[]).indexOf(c)>=0)return'cooking';
    if((ctx.overload||[]).indexOf(c)>=0)return'overload';
    if(e.context_user_id)return'manual';
    return'other';
  };
  E.forEach(function(e){
    const isMsg=e.message!=null&&e.state==null;
    if(e.entity_id===ctx.mode&&!isMsg){
      const s=String(e.state);
      if(s==='unavailable'||s==='unknown'){if(open)step(open,e);return;}
      if(s==='Stopped'&&mode!=='Stopped'){
        open={id:'e'+(++id),kind:'pause',type:typeOf(e),t:e.t,end:NaN,steps:[],msg:'',cause:rocHlCause(e),react:NaN};
        // what happened just before: the cause's own change, anything in the last 10 s
        recent.forEach(function(r){if(e.t-r.t<=60000&&(r.entity_id===open.cause||e.t-r.t<=10000))step(open,r);});
        const cz=recent.filter(function(r){return r.entity_id===open.cause&&e.t-r.t<=60000;}).pop();
        if(cz)open.react=(e.t-cz.t)/1000;
        step(open,e);out.push(open);
        // a message written a moment before the change (same automation run) belongs to it
        if(pendNote&&e.t-pendNote.t<=2000){out.splice(out.indexOf(pendNote),1);open.steps.push(pendNote.steps[0]);open.msg=pendNote.msg;if(open.type==='other'&&typeOf(pendNote.steps[0])!=='other')open.type=typeOf(pendNote.steps[0]);}
        pendNote=null;
      }else if(s!=='Stopped'&&open){open.end=e.t;step(open,e);last=open;open=null;}
      else if(s!==mode&&mode!=null&&e.context_user_id){out.push({id:'e'+(++id),kind:'mode',type:'manual',t:e.t,end:NaN,steps:[e],msg:'',state:s});}
      mode=s;recent.length=0;return;
    }
    if(isMsg){
      const tgt=open||(last&&e.t-last.end<=10000?last:null);
      if(tgt){step(tgt,e);if(!tgt.msg&&tgt.kind==='pause')tgt.msg=String(e.message);if(tgt.type==='other'&&typeOf(e)!=='other')tgt.type=typeOf(e);}
      else{const nt={id:'e'+(++id),kind:'note',type:'other',t:e.t,end:NaN,steps:[e],msg:String(e.message),name:e.name||''};out.push(nt);pendNote=nt;}
      return;
    }
    // a room: unavailable / back and a change by hand are events of their own, also inside a pause
    if(rooms[e.entity_id]!=null){
      const s=String(e.state),prev=roomSt[e.entity_id];roomSt[e.entity_id]=s;
      if(s==='unavailable'&&prev!=='unavailable')out.push({id:'e'+(++id),kind:'room',type:'sensor',t:e.t,end:NaN,steps:[e],msg:'',room:rooms[e.entity_id],what:'na'});
      else if(prev==='unavailable'&&s!=='unavailable')out.push({id:'e'+(++id),kind:'room',type:'sensor',t:e.t,end:NaN,steps:[e],msg:'',room:rooms[e.entity_id],what:'back'});
      else if(e.context_user_id&&(s==='off'||prev==='off'))out.push({id:'e'+(++id),kind:'room',type:'manual',t:e.t,end:NaN,steps:[e],msg:'',room:rooms[e.entity_id],what:s==='off'?'off':'on'});
      else if(open)step(open,e);
      else if(last&&e.t-last.end<=120000)step(last,e);
      return;
    }
    // any other entity: a step of the pause around it, or the cause of the next one
    if(open){step(open,e);return;}
    if(last&&e.t-last.end<=120000){step(last,e);return;}
    recent.push(e);if(recent.length>20)recent.shift();
  });
  out.forEach(function(ev){
    const p=rocHlParse(ev.msg||(ev.steps.find(function(s){return s.message;})||{}).message);
    ev.kw=p.kw;ev.ph=p.ph;
    ev.min=isFinite(ev.end)?(ev.end-ev.t)/60000:NaN;
  });
  return out.sort(function(a,b){return b.t-a.t;});
}
// KPIs over the pauses (pure)
function rocHlKpi(events,now){
  const P=events.filter(function(e){return e.kind==='pause';});
  const d=P.map(function(e){return((isFinite(e.end)?e.end:(now||Date.now()))-e.t)/60000;});
  return{n:P.length,sum:d.reduce(function(a,b){return a+b;},0),max:d.length?Math.max.apply(null,d):0};
}
function rocHlTitle(lang,ev){
  const T=function(k,v){return rocAdT(lang,k,v);};
  if(ev.kind==='pause')return T('e_'+ev.type);
  if(ev.kind==='mode')return T('e_mode',{m:rocHpT(lang,'m_'+ev.state)})+' · '+T('e_by_hand');
  if(ev.kind==='room')return T(ev.what==='na'?'e_na':(ev.what==='back'?'e_back':(ev.what==='off'?'e_off_hand':'e_on_hand')),{r:ev.room});
  return String(ev.msg||'').split(' · ')[0]||ev.name||'';
}
function rocHlSub(lang,ev,now){
  const T=function(k,v){return rocAdT(lang,k,v);},p=[];
  if(ev.kind==='pause'){
    p.push(isFinite(ev.min)?T('pause',{d:rocAdDur(lang,ev.min)}):T('lasts',{d:rocAdDur(lang,((now||Date.now())-ev.t)/60000)}));
    if(isFinite(ev.react))p.push(T('react',{s:Math.round(ev.react)}));
    if(isFinite(ev.kw)&&ev.kw>0.05)p.push(T('kw',{v:rocHcFmt(lang,ev.kw)}));
  }else if(ev.kind==='note'&&ev.name)p.push(ev.name);
  return p.join(' · ');
}
// One step's line: the time, what happened, where it came from
function rocHlStep(lang,e,ctx,hass){
  const tm=new Date(e.t).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  if(e.message!=null&&e.state==null)return{t:tm,what:String(e.message),src:String(e.name||e.entity_id||'')};
  const st=hass&&hass.states&&hass.states[e.entity_id];
  const nm=(ctx.rooms&&ctx.rooms[e.entity_id])||e.name||(st&&st.attributes&&st.attributes.friendly_name)||e.entity_id;
  const lbl=e.entity_id===ctx.mode?rocHpT(lang,'m_'+e.state):rocAdState(lang,e.state);
  return{t:tm,what:nm+' → '+lbl,src:e.entity_id+' → '+e.state};
}
// The phase bars (pure SVG): max current per phase, the boiler's share on top, the breaker line.
function rocHlPhaseSvg(lang,ph,L){
  const v=ph.map(function(x){return isFinite(x)?x:0;}),bA=isFinite(L.boilerA)?L.boilerA:0;
  const top=Math.max(isFinite(L.breaker)?L.breaker*1.15:0,Math.max.apply(null,v)+bA,1)*1.05;
  const W=300,X0=26,BW=W-X0-4,row=24,H=row*3+(isFinite(L.breaker)?14:4),x=function(a){return X0+a/top*BW;};
  let s='';
  v.forEach(function(a,i){
    const y=4+i*row,hot=isFinite(L.breaker)&&a>=L.breaker*0.9;
    s+='<text x="0" y="'+(y+13)+'" class="hl-tx">L'+(i+1)+'</text>';
    s+='<rect x="'+X0+'" y="'+y+'" width="'+(x(a)-X0).toFixed(1)+'" height="16" rx="3" fill="'+(hot?'#ff6b5c':'#6aa8ff')+'"/>';
    if(bA)s+='<rect x="'+x(a).toFixed(1)+'" y="'+(y+.5)+'" width="'+(x(a+bA)-x(a)).toFixed(1)+'" height="15" rx="3" fill="none" stroke="#ffb35c" stroke-dasharray="3 2"/>';
    const lx=x(a+bA)+4,txt=rocHcEsc(rocHcFmt(lang,a))+' A';
    s+=lx<=W-36?'<text x="'+lx.toFixed(1)+'" y="'+(y+13)+'" class="hl-tx">'+txt+'</text>'
      :'<text x="'+Math.max(X0+30,x(a)-4).toFixed(1)+'" y="'+(y+12)+'" text-anchor="end" class="hl-tx in">'+txt+'</text>';
  });
  if(isFinite(L.breaker)){const bx=x(L.breaker).toFixed(1);s+='<line x1="'+bx+'" x2="'+bx+'" y1="0" y2="'+(row*3+2)+'" stroke="#ff6b5c" stroke-dasharray="4 3"/><text x="'+bx+'" y="'+(H-2)+'" text-anchor="middle" class="hl-tx r">'+rocHcEsc(rocAdT(lang,'breaker',{v:rocHcFmt(lang,L.breaker,0)}))+'</text>';}
  return'<svg viewBox="0 0 '+W+' '+H+'" aria-hidden="true">'+s+'</svg>';
}
// ---- the sheet ----
const ROC_AD_CSS='.roc-ad-bd{position:absolute;inset:0;z-index:412;background:rgba(0,0,0,.4);}'
  +'.roc-ad{position:absolute;z-index:413;left:0;right:0;bottom:0;max-height:92%;height:92%;box-sizing:border-box;background:var(--card-background-color,#1c1f24);color:var(--primary-text-color,#f2f3f5);border-radius:14px 14px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.45);display:flex;flex-direction:column;font:14px/1.4 var(--paper-font-body1_-_font-family,system-ui,sans-serif);}'
  +'.ad-hd{display:flex;align-items:center;gap:8px 8px;padding:10px 14px 0 18px;flex-wrap:wrap}.ad-hd h3{margin:0 8px 0 0;font-size:16px;font-weight:600;flex:1 1 auto}.ad-tabs{display:flex;gap:6px;order:3;flex:1 1 100%;min-width:0;overflow-x:auto}'
  +'.ad-tabs button,.ad-chip{min-height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;font:inherit;font-size:13px;padding:0 14px;cursor:pointer;white-space:nowrap}'
  +'.ad-tabs button.on,.ad-chip.on{background:rgba(106,168,255,.16);border-color:#6aa8ff}.ad-tabs b{display:inline-block;min-width:18px;margin-left:6px;border-radius:9px;background:#f5b041;color:#1c1f24;font-size:11px;line-height:18px}'
  +'.ad-x{background:none;border:0;color:inherit;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1}'
  +'.ad-bd{flex:1;min-height:0;overflow-y:auto;padding:12px 18px 18px;display:flex;flex-direction:column;gap:14px}'
  +'.ad-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.ad-card{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.03)}'
  +'.ad-card h4{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--secondary-text-color,#9aa3ad);text-transform:uppercase;letter-spacing:.04em}'
  +'.ad-row{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:3px 0}.ad-row span{color:var(--secondary-text-color,#9aa3ad)}.ad-row b{font-weight:500;text-align:right;font-variant-numeric:tabular-nums}'
  +'.ad-row b.ok{color:#8fd9a6}.ad-row b.warn{color:#ffb877}.ad-row b.alert{color:#ff7a6c}'
  +'.ad-lbl{font-size:11px;color:var(--secondary-text-color,#9aa3ad);text-transform:uppercase;letter-spacing:.04em;margin-bottom:-6px}'
  +'.ad-ck{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid rgba(255,255,255,.06)}.ad-ck i{flex:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:13px}'
  +'.ad-ck.alert i{background:rgba(255,107,92,.2);color:#ff7a6c}.ad-ck.warn i{background:rgba(255,162,76,.18);color:#ffb877}.ad-ck.ok i{background:rgba(90,200,120,.18);color:#8fd9a6}.ad-ck.info i{background:rgba(255,255,255,.08);color:#9aa3ad}'
  +'.ad-ck b{display:block;font-weight:600}.ad-ck span{font-size:13px;color:var(--secondary-text-color,#9aa3ad)}'
  +'.hl-kpi{display:flex;gap:10px;flex-wrap:wrap}.hl-kpi div{flex:1 1 90px;border-radius:12px;background:rgba(255,255,255,.04);padding:8px 12px}.hl-kpi span{display:block;font-size:11px;color:var(--secondary-text-color,#9aa3ad)}.hl-kpi b{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}'
  +'.hl-f{display:flex;gap:6px;flex-wrap:wrap}.ad-chip{min-height:32px;padding:0 12px}.ad-chip small{opacity:.7;margin-left:4px}'
  +'.hl-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:14px;align-items:start}.hl-main.one{grid-template-columns:minmax(0,1fr)}'
  +'.hl-day{font-size:11px;color:var(--secondary-text-color,#9aa3ad);text-transform:uppercase;letter-spacing:.04em;padding:10px 0 4px}'
  +'.hl-ev{display:flex;gap:10px;width:100%;text-align:left;border:0;border-radius:10px;background:none;color:inherit;font:inherit;padding:8px;cursor:pointer;align-items:flex-start}.hl-ev.on{background:rgba(255,255,255,.06)}'
  +'.hl-ev i{flex:none;width:9px;height:9px;border-radius:50%;margin-top:6px}.hl-ev time{flex:none;font-variant-numeric:tabular-nums;color:var(--secondary-text-color,#9aa3ad);font-size:13px;min-width:40px}.hl-ev b{display:block;font-weight:500}.hl-ev span{font-size:12px;color:var(--secondary-text-color,#9aa3ad)}'
  +'.hl-dt{border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;position:sticky;top:0}.hl-dt h4{margin:0;font-size:16px}.hl-dt .w{font-size:12px;color:var(--secondary-text-color,#9aa3ad)}.hl-dt p{margin:0;font-size:13px}'
  +'.hl-st{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:13px}.hl-st time{font-variant-numeric:tabular-nums;color:var(--secondary-text-color,#9aa3ad)}.hl-st small{display:block;font-size:11px;color:var(--secondary-text-color,#9aa3ad);font-family:ui-monospace,monospace;word-break:break-all}'
  +'.hl-ph svg{display:block;width:100%;max-width:440px;height:auto}.hl-tx{font-size:11px;fill:var(--primary-text-color,#f2f3f5)}.hl-tx.in{fill:#0b1a33;font-weight:600}.hl-tx.r{fill:#ff7a6c}'
  +'.hl-back{align-self:flex-start;background:none;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:inherit;font:inherit;padding:5px 10px;cursor:pointer;min-height:32px}'
  +'.ad-msg{color:var(--secondary-text-color,#9aa3ad);padding:16px 0}'
  +'.roc-ad button:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}';
const ROC_HL_C={cooking:'#ffc97a',overload:'#ff9b7a',tariff:'#6aa8ff',sensor:'#ffb877',manual:'#a3afbf',other:'#7d8590'};
function rocAdOpen(card,tab){
  if(!card||!card._hass)return;
  if(!rocAdAllowed(card._hass,card._config))return;
  rocAdClose(card);if(card._hp)rocHpClose(card);if(card._heat)rocHcClose(card);if(card._hs)rocHsClose(card);if(card._lc)rocLcClose(card);if(card._xp)rocXpClose(card);
  const sr=card.shadowRoot,wrap=sr&&sr.querySelector('.wrap');if(!wrap)return;
  const lang=rocHcLang(card._hass),T=function(k,v){return rocHcEsc(rocAdT(lang,k,v));};
  const bd=document.createElement('div');bd.className='roc-ad-bd';bd.addEventListener('click',function(){rocAdClose(card);});
  const el=document.createElement('div');el.className='roc-ad';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',rocAdT(lang,'title'));
  el.innerHTML='<style>'+ROC_AD_CSS+'</style><div class="ad-hd"><h3>'+T('title')+'</h3><div class="ad-tabs" role="tablist"><button data-ad="tab" data-v="check" role="tab"></button><button data-ad="tab" data-v="log" role="tab">'+T('t_log')+'</button></div>'
    +'<button class="ad-x" data-ad="close" aria-label="'+T('close')+'">×</button></div><div class="ad-bd" data-ad-bd></div>';
  el.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('[data-ad]');if(!b)return;
    const k=b.getAttribute('data-ad'),A=card._ad;if(!A)return;
    if(k==='close')rocAdClose(card);
    else if(k==='tab'){A.tab=b.getAttribute('data-v');A.sig='';if(A.tab==='log'&&!A.log)rocHlLoad(card);rocAdUpdate(card);}
    else if(k==='filter'){A.filter=b.getAttribute('data-v');A.sig='';rocAdUpdate(card);}
    else if(k==='ev'){A.sel=b.getAttribute('data-v');A.detail=true;A.sig='';rocAdUpdate(card);rocHlPhases(card);}
    else if(k==='back'){A.detail=false;A.sig='';rocAdUpdate(card);}
    else if(k==='reload'){A.log=null;A.ph={};rocHlLoad(card);}
  });
  wrap.appendChild(bd);wrap.appendChild(el);
  card._ad={el:el,bd:bd,lang:lang,tab:tab==='log'?'log':'check',filter:'all',sel:'',detail:false,log:null,err:'',ph:{},sig:''};
  if(!card._adKey){card._adKey=function(e){if(e.key==='Escape'&&card._ad)rocAdClose(card);};document.addEventListener('keydown',card._adKey);}
  if(card._ad.tab==='log')rocHlLoad(card);
  rocAdUpdate(card);
  const x=el.querySelector('[data-ad="close"]');if(x)try{x.focus();}catch(_){}
}
function rocAdClose(card){
  const A=card&&card._ad;if(!A)return;
  if(A.el&&A.el.parentNode)A.el.parentNode.removeChild(A.el);
  if(A.bd&&A.bd.parentNode)A.bd.parentNode.removeChild(A.bd);
  card._ad=null;
  if(card._adKey){document.removeEventListener('keydown',card._adKey);card._adKey=null;}
}
function rocHlCtx(hass,cAll){
  const house=rocHpHouse(hass,cAll),L=rocAdLog(cAll),rooms={};
  rocHpRooms(cAll,null).forEach(function(r){rooms[r.entity]=rocHpName(hass,r);});
  return{mode:house.mode,tariff:house.tariff?house.tariff.entity:'',cooking:L.cooking,overload:L.overload,rooms:rooms,L:L};
}
// Reads the logbook of the last days (one call), then rebuilds the events.
function rocHlLoad(card){
  const A=card._ad;if(!A)return;
  const hass=card._hass;A.loading=true;A.err='';A.sig='';
  if(!hass||typeof hass.callWS!=='function'){A.loading=false;A.err='callWS';rocAdUpdate(card);return;}
  const L=rocAdLog(card._config),end=new Date(),start=new Date(end.getTime()-L.days*86400000);
  Promise.resolve(hass.callWS({type:'logbook/get_events',start_time:start.toISOString(),end_time:end.toISOString(),entity_ids:rocHlEntities(hass,card._config)})).then(function(r){
    if(card._ad!==A)return;
    A.log=rocHlBuild(Array.isArray(r)?r:[],rocHlCtx(card._hass,card._config));A.loading=false;A.sig='';
    if(!A.sel&&A.log.length)A.sel=A.log[0].id;
    rocAdUpdate(card);rocHlPhases(card);
  }).catch(function(e){if(card._ad!==A)return;A.loading=false;A.err=String((e&&(e.message||e.code))||e);A.sig='';rocAdUpdate(card);});
  rocAdUpdate(card);
}
// The highest current of each phase during the selected pause (history), once per event.
function rocHlPhases(card){
  const A=card._ad;if(!A||!A.log)return;
  const ev=A.log.find(function(e){return e.id===A.sel;});if(!ev||ev.kind!=='pause'||A.ph[ev.id])return;
  const L=rocAdLog(card._config),hass=card._hass;
  if(L.phases.length<1||typeof hass.callWS!=='function')return;
  A.ph[ev.id]={loading:true};
  const end=isFinite(ev.end)?ev.end:Date.now();
  Promise.resolve(hass.callWS({type:'history/history_during_period',start_time:new Date(ev.t-30000).toISOString(),end_time:new Date(end).toISOString(),entity_ids:L.phases,minimal_response:true,no_attributes:true,significant_changes_only:false})).then(function(r){
    if(card._ad!==A)return;
    const mx=L.phases.slice(0,3).map(function(id){const rows=(r&&r[id])||[];let m=NaN;rows.forEach(function(x){const v=rocHcNum(x.s!=null?x.s:x.state);if(isFinite(v)&&!(v<=m))m=v;});return m;});
    A.ph[ev.id]={v:mx.some(isFinite)?mx:null};A.sig='';rocAdUpdate(card);
  }).catch(function(){if(card._ad!==A)return;A.ph[ev.id]={v:null};A.sig='';rocAdUpdate(card);});
}
function rocAdUpdate(card){
  const A=card._ad;if(!A)return;
  if(!A.el.isConnected){rocAdClose(card);return;}
  const hass=card._hass,lang=A.lang,cAll=card._config,T=function(k,v){return rocHcEsc(rocAdT(lang,k,v));};
  const ck=rocAdCheck(hass,cAll,lang);
  const nw=ck.checks.filter(function(c){return c.lvl==='warn'||c.lvl==='alert';}).length;
  const tb=A.el.querySelector('[data-v="check"]');
  const th=T('t_check')+(nw?'<b>'+nw+'</b>':'');if(tb.innerHTML!==th)tb.innerHTML=th;
  [].forEach.call(A.el.querySelectorAll('[data-ad="tab"]'),function(b){const on=b.getAttribute('data-v')===A.tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');});
  let h='';
  if(A.tab==='check'){
    h='<div class="ad-cards">'+ck.cards.map(function(c){return'<div class="ad-card"><h4>'+rocHcEsc(c.title)+'</h4>'+c.rows.map(function(r){return'<div class="ad-row"><span>'+rocHcEsc(r.k)+'</span><b class="'+r.c+'">'+rocHcEsc(r.v)+'</b></div>';}).join('')+'</div>';}).join('')+'</div>'
      +'<div class="ad-lbl">'+T('findings')+'</div><div>'+ck.checks.map(function(c){return'<div class="ad-ck '+c.lvl+'"><i>'+c.icon+'</i><div><b>'+rocHcEsc(c.title)+'</b>'+(c.text?'<span>'+rocHcEsc(c.text)+'</span>':'')+'</div></div>';}).join('')+'</div>';
  }else h=rocHlHtml(card);
  if(h!==A.sig){A.sig=h;A.el.querySelector('[data-ad-bd]').innerHTML=h;}
  if(A.tab==='log')rocHlPhases(card);
}
function rocHlHtml(card){
  const A=card._ad,lang=A.lang,hass=card._hass,T=function(k,v){return rocHcEsc(rocAdT(lang,k,v));};
  const L=rocAdLog(card._config);
  if(A.err)return'<div class="ad-msg">'+T('err',{e:A.err})+'</div><button class="hl-back" data-ad="reload">'+T('reload')+'</button>';
  if(!A.log)return'<div class="ad-msg">'+T('loading')+'</div>';
  const now=Date.now(),k=rocHlKpi(A.log,now);
  let h='<div class="hl-kpi"><div><span>'+T('k_n')+'</span><b>'+k.n+'</b></div><div><span>'+T('k_sum')+'</span><b>'+rocHcEsc(rocAdDur(lang,k.sum))+'</b></div><div><span>'+T('k_max')+'</span><b>'+rocHcEsc(rocAdDur(lang,k.max))+'</b></div></div>';
  const cnt={};A.log.forEach(function(e){cnt[e.type]=(cnt[e.type]||0)+1;});
  h+='<div class="hl-f">'+['all','cooking','overload','tariff','sensor','manual','other'].filter(function(f){return f==='all'||cnt[f];}).map(function(f){
    return'<button class="ad-chip'+(A.filter===f?' on':'')+'" data-ad="filter" data-v="'+f+'" aria-pressed="'+(A.filter===f)+'">'+T('f_'+f)+'<small>'+(f==='all'?A.log.length:cnt[f])+'</small></button>';}).join('')
    +'<button class="ad-chip" data-ad="reload" aria-label="'+T('reload')+'">↻</button></div>';
  const vis=A.log.filter(function(e){return A.filter==='all'||e.type===A.filter;});
  if(!vis.length)return h+'<div class="ad-msg">'+T('empty',{n:L.days})+'</div>';
  if(!vis.some(function(e){return e.id===A.sel;}))A.sel=vis[0].id;
  const wide=(A.el.clientWidth||0)>=700;
  const today=new Date(now).toDateString();
  let list='',day='';
  vis.forEach(function(e){
    const d=new Date(e.t),ds=d.toDateString();
    if(ds!==day){day=ds;const lbl=d.toLocaleDateString(lang,{weekday:'short',day:'numeric',month:'numeric'});list+='<div class="hl-day">'+rocHcEsc(ds===today?rocAdT(lang,'today')+' · '+lbl:lbl)+'</div>';}
    const sub=rocHlSub(lang,e,now);
    list+='<button class="hl-ev'+(e.id===A.sel?' on':'')+'" data-ad="ev" data-v="'+e.id+'"><i style="background:'+ROC_HL_C[e.type]+'"></i><time>'+rocHcEsc(d.toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'}))+'</time><div><b>'+rocHcEsc(rocHlTitle(lang,e))+'</b>'+(sub?'<span>'+rocHcEsc(sub)+'</span>':'')+'</div></button>';
  });
  const ev=vis.find(function(e){return e.id===A.sel;});
  const dt=rocHlDetail(card,ev,L,now);
  if(wide)return h+'<div class="hl-main"><div>'+list+'</div>'+dt+'</div>';
  return h+(A.detail?'<button class="hl-back" data-ad="back">← '+T('back')+'</button>'+dt:'<div class="hl-main one"><div>'+list+'</div></div>');
}
function rocHlDetail(card,ev,L,now){
  const A=card._ad,lang=A.lang,hass=card._hass,T=function(k,v){return rocHcEsc(rocAdT(lang,k,v));};
  if(!ev)return'<div class="hl-dt"><div class="ad-msg">'+T('pick')+'</div></div>';
  const ctx=rocHlCtx(hass,card._config),f=function(t){return new Date(t).toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'});};
  const d=new Date(ev.t),when=d.toLocaleDateString(lang,{weekday:'short',day:'numeric',month:'numeric'})+' '+f(ev.t)+(isFinite(ev.end)?' – '+f(ev.end):'');
  let h='<div class="hl-dt"><div class="w">'+rocHcEsc(when)+'</div><h4>'+rocHcEsc(rocHlTitle(lang,ev))+'</h4>';
  const sub=rocHlSub(lang,ev,now);if(sub)h+='<div class="w">'+rocHcEsc(sub)+'</div>';
  if(ev.msg&&ev.kind==='pause')h+='<p>'+rocHcEsc(ev.msg)+'</p>';
  if(ev.steps.length)h+='<div class="ad-lbl">'+T('steps')+'</div><div class="hl-st">'+ev.steps.map(function(s){const x=rocHlStep(lang,s,ctx,hass);return'<time>'+rocHcEsc(x.t)+'</time><div>'+rocHcEsc(x.what)+'<small>'+rocHcEsc(x.src)+'</small></div>';}).join('')+'</div>';
  if(ev.kind==='pause'){
    const P=A.ph[ev.id];
    let ph=null,lbl='phases';
    if(P&&P.v)ph=P.v;else if(!(P&&P.loading)&&ev.ph){ph=ev.ph;lbl='ph_msg';}
    if(ph)h+='<div class="ad-lbl">'+T(lbl)+'</div><div class="hl-ph">'+rocHlPhaseSvg(lang,ph,L)+'</div>'
      +(isFinite(L.boilerA)?'<div class="w">'+T('with_b',{v:rocHcFmt(lang,Math.max.apply(null,ph.map(function(x){return isFinite(x)?x:0;}))+L.boilerA)})+'</div>':'');
    else if(P&&P.loading)h+='<div class="w">'+T('ph_load')+'</div>';
  }
  return h+'</div>';
}
