#!/usr/bin/env node
/**
 * The heating controller (7.2.0, HEATING_PLAN.md) — jsdom tests: the pure parts (settings,
 * status, time limits) and the panel in the card (open, target, quick, ruler, durations through
 * VTherm's timed preset, pause, off, the 24 h chart, closing).
 * Usage: node tests/heat.test.js [card.js]   (requires jsdom)
 */
'use strict';
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.log('jsdom not installed - skipping heating controller tests (npm i -D jsdom)');process.exit(0);}
const fs=require('fs'),path=require('path');
const cardCode=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.requestIdleCallback=f=>setTimeout(f,0);w.loadCardHelpers=undefined;
w.eval(cardCode);
let fails=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pure=n=>w.eval(n);
const calls=[];
const vt=(o)=>Object.assign({state:'heat',attributes:{current_temperature:21.6,temperature:22,current_humidity:47,hvac_action:'heating',min_temp:10,max_temp:30,
  power_percent:64,on_percent:0.64,friendly_name:'Versatile Bedroom',specific_states:{temperature_slope:0.8,hvac_off_reason:null},requested_state:{hvac_mode:'heat'},
  timed_preset_manager:{is_active:false},safety_manager:{safety_state:'off'}}},o||{});
const states=()=>({'climate.bed':vt(),'number.bed_preset_boost_temp':{state:'10',attributes:{}},'climate.plain':{state:'heat',attributes:{current_temperature:20,temperature:21,hvac_action:'idle'}}});
const mkHass=st=>({states:st||states(),entities:{'climate.bed':{device_id:'d1'},'number.bed_preset_boost_temp':{device_id:'d1'},'climate.plain':{device_id:'d2'}},
  callService(d,s,data){calls.push([d,s,data]);return Promise.resolve();},
  callWS(m){calls.push(['ws',m.type]);const n=Date.now()/1000;return Promise.resolve({'climate.bed':[{s:'heat',lu:n-80000,a:{current_temperature:21,temperature:22,hvac_action:'heating'}},{s:'heat',lu:n-40000,a:{current_temperature:21.8,temperature:22,hvac_action:'idle'}},{s:'heat',lu:n-100,a:{current_temperature:21.6,temperature:22,hvac_action:'heating'}}]});},
  language:'cs',locale:{language:'cs'},user:{name:'x',is_admin:true},themes:{darkMode:true}});
const CFG={type:'custom:room-overlay-card',base_image:'/x.png',heating:{quick:[21,22,22.5,23],rooms:[{climate:'climate.bed',name:'Ložnice',quick:[20,21,21.5,22]}]},
  icons:[{id:'h',icon:'mdi:radiator',top:'10%',left:'10%',tap_action:{action:'heating',entity:'climate.bed'}}]};
(async()=>{
  // ---- pure parts
  {
    const cfg=pure('rocHcCfg')(CFG,'climate.bed'),def=pure('rocHcCfg')(CFG,'climate.other'),none=pure('rocHcCfg')({},'climate.x');
    t('settings: a room\'s own quick temperatures win, the defaults fill the rest',JSON.stringify(cfg.quick)==='[20,21,21.5,22]'&&cfg.name==='Ložnice'&&cfg.step===0.5&&cfg.range[1]===26);
    t('settings: another thermostat gets the card\'s defaults; no heating block → built-in ones',JSON.stringify(def.quick)==='[21,22,22.5,23]'&&none.durations.length===4&&none.evening==='22:00');
    const M=pure('rocHcModel'),S=pure('rocHcStatus');
    const m=M(vt());
    t('status: heating with power and the time to the target',S('cs',m,22).text==='Topí · 64 % · cíl za ~30 min'&&S('cs',m,22).cls==='heat');
    t('status: off with a heating request = paused by the central mode',S('cs',M(vt({state:'off',attributes:Object.assign({},vt().attributes,{hvac_action:'off',specific_states:{hvac_off_reason:'hvac_off_central_mode'}})})),NaN).text==='Pozastaveno centrálním režimem');
    t('status: off, idle at target, unavailable, silent sensor',S('cs',M({state:'off',attributes:{}}),NaN).text==='Vypnuto'&&S('en',M(vt({attributes:Object.assign({},vt().attributes,{hvac_action:'idle',current_temperature:22})})),NaN).text==='Holding 22.0 °C'
      &&S('cs',M({state:'unavailable',attributes:{}}),NaN).cls==='na'&&S('cs',M(vt({attributes:Object.assign({},vt().attributes,{safety_manager:{safety_state:'on'},power_percent:25})})),NaN).text==='Čidlo mlčí – nouzový chod 25 %');
    const U=pure('rocHcUntil'),c={evening:'22:00',morning:'06:00'};
    t('time limits: 2 h; until 22:00 from 20:30; until morning from 23:00 runs past midnight',U('2h',c)===120&&U('evening',c,new w.Date(2026,10,28,20,30))===90&&U('morning',c,new w.Date(2026,10,28,23,0))===420);
    t('time limits: an evening already past means tomorrow evening',U('evening',c,new w.Date(2026,10,28,22,30))===1410);
    t('the boost preset number of the same device',pure('rocHcBoost')(mkHass(),'climate.bed')==='number.bed_preset_boost_temp'&&pure('rocHcBoost')(mkHass(),'climate.plain')===null);
  }
  // ---- the panel in the card
  const el=w.document.createElement('room-overlay-card');el.setConfig(JSON.parse(JSON.stringify(CFG)));
  const h=mkHass();el.hass=h;w.document.body.appendChild(el);await sleep(30);
  el._execAct({action:'heating',entity:'climate.bed'});await sleep(20);
  const S=el.shadowRoot,P=()=>S.querySelector('.roc-hc'),q=s=>P().querySelector(s);
  t('the heating action opens the controller over the card',!!P()&&!!S.querySelector('.roc-hc-bd')&&P().getAttribute('role')==='dialog');
  t('it names the room, shows now / status / target',q('[data-hc-name]').textContent==='Ložnice'&&/21,6 °C/.test(q('[data-hc-cur]').textContent)&&/47 %/.test(q('[data-hc-cur]').textContent)
    &&q('[data-hc-st] span').textContent.indexOf('Topí · 64 %')===0&&q('[data-hc-val] b').textContent==='22,0');
  t('quick temperatures from the room\'s settings; the current one is marked',[...P().querySelectorAll('[data-hc="q"]')].map(b=>b.textContent).join(' ')==='20,0° 21,0° 21,5° 22,0°'&&P().querySelector('[data-hc="q"].on').getAttribute('data-v')==='22');
  t('the 24 h chart is drawn from the history',calls.some(c=>c[0]==='ws'&&c[1]==='history/history_during_period')&&/<path/.test(q('[data-hc-ch]').innerHTML)&&/<rect/.test(q('[data-hc-ch]').innerHTML));
  // + + → one call, 23.0 kept
  calls.length=0;
  q('[data-hc="plus"]').click();q('[data-hc="plus"]').click();
  t('− / + change the shown target at once (marked as pending)',q('[data-hc-val] b').textContent==='23,0'&&q('[data-hc-val]').classList.contains('pend')&&calls.length===0);
  await sleep(1000);
  t('…and send one set_temperature after the pause',calls.length===1&&calls[0][0]==='climate'&&calls[0][1]==='set_temperature'&&calls[0][2].temperature===23);
  // a duration: boost number + timed preset
  calls.length=0;
  q('[data-hc="d"][data-v="2h"]').click();await sleep(30);
  t('a duration writes the °C into the boost preset and runs the timed preset',calls[0]&&calls[0][1]==='set_value'&&calls[0][2].entity_id==='number.bed_preset_boost_temp'&&calls[0][2].value===23
    &&calls[1]&&calls[1][1]==='set_timed_preset'&&calls[1][2].preset==='boost'&&calls[1][2].duration_minutes===120);
  // the thermostat reports a running timed preset
  const st2=states();st2['climate.bed']=vt({attributes:Object.assign({},vt().attributes,{temperature:23,timed_preset_manager:{is_active:true,end_time:'2026-11-28T03:30:00+01:00'}})});
  const h2=mkHass(st2);el.hass=h2;await sleep(10);
  t('a running timed preset shows until when, with Cancel',/Dočasně do/.test(q('[data-hc-timed]').textContent)&&!!q('[data-hc="cancel"]')&&!q('[data-hc-val]').classList.contains('pend'));
  calls.length=0;q('[data-hc="cancel"]').click();
  t('Cancel ends the timed preset',calls.length===1&&calls[0][1]==='cancel_timed_preset');
  // keep: a running timed preset is cancelled first, then set_temperature
  calls.length=0;q('[data-hc="d"][data-v="always"]').click();await sleep(30);
  t('"keep" over a timed preset: cancel it first, then set the target',calls.map(c=>c[1]).join()==='cancel_timed_preset,set_temperature');
  // the ruler
  calls.length=0;const r=q('[data-hc-rng]');r.value='19.5';r.dispatchEvent(new w.Event('input'));
  t('the ruler sets the target (within the room\'s range)',q('[data-hc-val] b').textContent==='19,5');
  await sleep(1000);
  // power
  calls.length=0;q('[data-hc="power"]').click();
  t('Turn off sets hvac_mode off',calls[0]&&calls[0][1]==='set_hvac_mode'&&calls[0][2].hvac_mode==='off');
  // closing
  q('[data-hc="close"]').click();
  t('× closes it',!P()&&!S.querySelector('.roc-hc-bd')&&!el._heat);
  el._execAct({action:'heating',entity:'climate.plain'});await sleep(10);
  t('a plain thermostat: no durations (no boost preset), defaults for quick',q('[data-hc-durw]').style.display==='none'&&P().querySelectorAll('[data-hc="q"]').length===4&&q('[data-hc="q"]').getAttribute('data-v')==='21');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));
  t('Escape closes it',!P());
  el._execAct({action:'heating',entity:'climate.bed'});await sleep(10);
  S.querySelector('.roc-hc-bd').click();
  t('a tap beside it closes it',!P());
  // 7.4.1: the 24 h chart — the wanted target (VTherm drops its own to 10 °C in the safety mode and
  // when the central mode stops it), power as bars, pauses and the safety mode as strips
  {
    const n=Date.now()/1000,rq={hvac_mode:'heat',target_temperature:22};
    const rows=[{s:'heat',lu:n-80000,a:{current_temperature:21.5,temperature:22,hvac_action:'heating',power_percent:100,requested_state:rq,preset_mode:'none'}},
      {s:'heat',lu:n-60000,a:{current_temperature:21.7,temperature:10,hvac_action:'heating',power_percent:0,on_percent:0.25,requested_state:rq,preset_mode:'safety'}},
      {s:'heat',lu:n-58000,a:{current_temperature:21.8,temperature:22,hvac_action:'heating',power_percent:60,requested_state:rq,preset_mode:'none'}},
      {s:'off',lu:n-40000,a:{current_temperature:21.9,temperature:10,hvac_action:'off',power_percent:0,requested_state:rq,preset_mode:'none'}},
      {s:'heat',lu:n-30000,a:{current_temperature:21.4,temperature:22,hvac_action:'heating',power_percent:80,requested_state:rq,preset_mode:'none'}}];
    const h3=mkHass();h3.callWS=function(){return Promise.resolve({'climate.bed':rows});};
    el.hass=h3;el._execAct({action:'heating',entity:'climate.bed'});await sleep(30);
    const svg=q('[data-hc-ch]').innerHTML;
    const dashed=(svg.match(/stroke-dasharray="4 3"[^>]*>|d="([^"]*)"[^>]*stroke-dasharray/)||[''])[0];
    const gPath=(/<path d="([^"]*)" fill="none" stroke="#9aa3ad"/.exec(svg)||[])[1]||'';
    const ys=gPath.match(/ ([\d.]+)H/g)||[];
    {const rows2=[{s:'heat',lu:n-7200,a:{current_temperature:21.1,temperature:10,hvac_action:'idle',power_percent:0,requested_state:{hvac_mode:'heat',target_temperature:10},preset_mode:'none'}},
        {s:'heat',lu:n-3600,a:{current_temperature:21.2,temperature:22,hvac_action:'heating',power_percent:100,requested_state:{hvac_mode:'heat',target_temperature:10},preset_mode:'boost'}}];
      const h4=mkHass();h4.callWS=function(){return Promise.resolve({'climate.bed':rows2});};
      el.hass=h4;el._execAct({action:'heating',entity:'climate.bed'});await sleep(30);
      t('chart: a timed preset draws the target it holds (22 °C), not the requested one it goes back to',q('[data-hc-yhi]').textContent==='22,5°'||q('[data-hc-yhi]').textContent==='23,0°');
      S.querySelector('.roc-hc-bd').click();el.hass=h3;el._execAct({action:'heating',entity:'climate.bed'});await sleep(30);}
    t('chart: the target is the wanted 22 °C throughout — no dive to 10 °C in the safety mode or the pause',ys.length>=3&&new Set(ys.map(x=>x.trim())).size===1);
    t('chart: the range follows the temperature and the target (at least 2 °C, not down to 10)',q('[data-hc-ylo]').textContent==='20,5°'&&q('[data-hc-yhi]').textContent==='22,5°');
    t('chart: power as bars, the pause and the safety mode as strips, named in the legend',/fill="#ff7a5c"/.test(svg)&&/fill="#6d7480"/.test(svg)&&/fill="#f5b041"/.test(svg)
      &&!q('[data-lg="z"]').hidden&&!q('[data-lg="s"]').hidden);
    t('chart: bars per quarter hour, not one per state row',(svg.match(/fill="#ff7a5c"/g)||[]).length<=96);
    S.querySelector('.roc-hc-bd').click();
  }
  // ---- 7.5.0: the settings check, the event log, the quick mode (B)
  {
    const now=Date.now(),iso=ms=>new Date(ms).toISOString();
    const vtx=(o)=>({state:'heat',attributes:Object.assign({current_temperature:21.7,temperature:22,hvac_action:'heating',power_percent:100,on_percent:1,min_temp:10,max_temp:30,friendly_name:'Versatile Bedroom',
      requested_state:{hvac_mode:'heat'},timed_preset_manager:{is_active:false},
      specific_states:{hvac_off_reason:null,temperature_slope:0.11,last_temperature_datetime:iso(now-120000),ext_current_temperature:-1.1,unavailable_underlying_entities:[],messages:[],auto_tpi_state:'on',
        auto_tpi_learning:{coeff_indoor_heat:1.1,coeff_outdoor_heat:0.06,total_cycles:6,learning_start_date:iso(now-86400000),last_learning_status:'power_out_of_range(100.0% vs Saturation 100.0%)',autolearn_enabled:true}},
      configuration:{cycle_min:45,is_controlled_by_central_mode:true},preset_temperatures:{frost_temp:10,eco_temp:10,boost_temp:10,comfort_temp:10},
      is_safety_configured:true,safety_manager:{safety_state:'off',safety_delay_min:60,safety_default_on_percent:0.25},
      is_heating_failure_detection_configured:false,heating_failure_detection_manager:{heating_failure_state:'off',detection_delay_min:120},
      is_window_configured:true,window_manager:{window_state:'off'},power_manager:{device_power:0.01}},o||{})});
    const st={'climate.bed':vtx(),'number.bed_preset_boost_temp':{state:'10',attributes:{}},
      'climate.liv':vtx({friendly_name:'Living',temperature:22.5,current_temperature:22.6,power_percent:22,hvac_action:'heating',is_heating_failure_detection_configured:true,
        specific_states:Object.assign({},vtx().attributes.specific_states,{last_temperature_datetime:iso(now-3*3600000),auto_tpi_learning:{coeff_indoor_heat:0.79,coeff_outdoor_heat:0.013,total_cycles:44,last_learning_status:'ok'}})}),
      'select.central_mode':{state:'Heat only',attributes:{options:['Auto','Stopped','Heat only','Cool only','Frost protection']}},'switch.hdo':{state:'on',attributes:{}},
      'binary_sensor.cook':{state:'off',attributes:{friendly_name:'Cooking'}},
      'sensor.l1':{state:'6.1',attributes:{}},'sensor.l2':{state:'4.7',attributes:{}},'sensor.l3':{state:'23',attributes:{}},'sensor.b1':{state:'4.2',attributes:{}},'sensor.b2':{state:'4.3',attributes:{}},'sensor.b3':{state:'4.1',attributes:{}}};
    const ent={'climate.bed':{device_id:'d1'},'number.bed_preset_boost_temp':{device_id:'d1'},'climate.liv':{device_id:'d3'},'select.central_mode':{platform:'versatile_thermostat'}};
    const C2={type:'custom:room-overlay-card',base_image:'/x.png',heating:{central_mode:'select.central_mode',tariff:{entity:'switch.hdo',high_state:'off'},simple:'always',normal:21.5,
      rooms:[{climate:'climate.bed',name:'Ložnice',normal:21},{climate:'climate.liv',name:'Obývák'}],log:{cooking:['binary_sensor.cook'],phases:['sensor.l1','sensor.l2','sensor.l3'],boiler_phases:['sensor.b1','sensor.b2','sensor.b3'],breaker:25,boiler_amps:12.8}}};
    const ck=pure('rocAdCheck')({states:st,entities:ent,user:{is_admin:true}},C2,'cs',now);
    const titles=ck.checks.map(c=>c.lvl+':'+c.title);
    t('check: the presets left at 10 °C, the stuck learning, no failure detection, a silent sensor — named per room',
      titles.includes('warn:Ložnice, Obývák: presety mají všude 10 °C')&&titles.includes('warn:Ložnice: učení auto-TPI stojí')&&titles.includes('warn:Ložnice: detekce poruchy topení je vypnutá')&&titles.includes('warn:Obývák: teploměr se neozývá'));
    t('check: what is fine is said too, the info last; no ok line for what failed',titles.includes('ok:Nouzový režim všude')&&titles.includes('ok:Všechny místnosti poslouchají centrální režim')
      &&!titles.some(x=>/Detekce poruchy topení všude|Všechny teploměry/.test(x))&&titles.includes('info:Obývák: bez slotu pro dočasnou teplotu')&&ck.checks[ck.checks.length-1].lvl==='info'
      &&ck.checks.findIndex(c=>c.lvl==='ok')>ck.checks.findIndex(c=>c.lvl==='warn'));
    const reg=ck.cards[0].rows.map(r=>r.k+'='+r.v).join('|');
    t('check: the cards — auto-TPI per room (learning since…), the cycle, sensors, safety, the house',/Ložnice=učí se od .* · 6 cyklů/.test(reg)&&/Obývák=0,79 \/ 0,013 · 44 cyklů/.test(reg)&&/Cyklus=45 min/.test(reg)
      &&ck.cards[1].rows.some(r=>r.k==='Venku'&&r.v==='-1,1 °C'||r.v==='−1,1 °C')&&ck.cards[2].rows[0].v==='60 min → 25 % · bez detekce poruchy · okno'&&ck.cards[3].rows[0].v==='Jen topení');
    t('admins only; heating.admin: false hides it',pure('rocAdAllowed')({user:{is_admin:true}},C2)&&!pure('rocAdAllowed')({user:{is_admin:false}},C2)&&!pure('rocAdAllowed')({user:{is_admin:true}},{heating:{admin:false}}));
    // the event log from logbook entries (the shape of logbook/get_events)
    const s0=now/1000-7200,src=e=>({context_event_type:'automation_triggered',context_source:'state of '+e,context_entity_id:'automation.x'});
    const LB=[
      {entity_id:'switch.hdo',state:'off',when:s0-0.5},
      Object.assign({entity_id:'select.central_mode',state:'Stopped',when:s0},src('switch.hdo')),
      Object.assign({entity_id:'select.central_mode',name:'Topení',message:'změna HDO → pozastaveno (VT (HDO)) · kuchyň 0,0 kW · L1 4,3 A · L2 0,9 A · L3 6,1 A',when:s0+0.002},src('switch.hdo')),
      {entity_id:'climate.bed',state:'off',when:s0+1},
      Object.assign({entity_id:'select.central_mode',state:'Heat only',when:s0+2400},src('switch.hdo')),
      Object.assign({entity_id:'select.central_mode',name:'Topení',message:'změna HDO → topení obnoveno · kuchyň 0,0 kW',when:s0+2400.003},src('switch.hdo')),
      {entity_id:'climate.bed',state:'heat',when:s0+2430},
      {entity_id:'binary_sensor.cook',state:'on',when:s0+3600},
      Object.assign({entity_id:'select.central_mode',state:'Stopped',when:s0+3602},src('binary_sensor.cook')),
      Object.assign({entity_id:'select.central_mode',name:'Topení',message:'začalo vaření → pozastaveno (vaří se) · kuchyň 2,4 kW · L1 3,1 A · L2 6,3 A · L3 16,8 A',when:s0+3602.01},src('binary_sensor.cook')),
      {entity_id:'climate.liv',state:'unavailable',when:s0+4000},{entity_id:'climate.liv',state:'heat',when:s0+4900},{entity_id:'climate.bed',state:'unavailable',when:s0+4950},{entity_id:'climate.bed',state:'off',when:s0+4951},
      {entity_id:'select.central_mode',state:'Frost protection',when:s0+5000,context_user_id:'u1'}];
    const ctx={mode:'select.central_mode',tariff:'switch.hdo',cooking:['binary_sensor.cook'],overload:[],rooms:{'climate.bed':'Ložnice','climate.liv':'Obývák'}};
    const ev=pure('rocHlBuild')(LB,ctx);
    t('log: one event per pause, newest first; its cause from the triggering entity',ev.length===3&&ev.map(e=>e.type).join(',')==='sensor,cooking,tariff'&&ev[2].steps.length===7);
    t('log: the pause by hand into Frost protection ends the cooking pause (no separate mode event)',ev[1].kind==='pause'&&Math.round(ev[1].min)===23);
    t('log: duration, reaction, kW and phase currents out of the message',Math.round(ev[2].min)===40&&Math.round(ev[1].react)===2&&ev[1].kw===2.4&&ev[1].ph.join()==='3.1,6.3,16.8');
    t('log: titles and subs',pure('rocHlTitle')('cs',ev[1])==='Vaří se → kotel pozastaven'&&pure('rocHlSub')('cs',ev[1])==='pauza 23 min · reakce 2 s · kuchyň 2,4 kW'&&pure('rocHlTitle')('cs',ev[0])==='Obývák: termostat nedostupný'&&pure('rocHlSub')('cs',ev[0])==='na 15 min');
    t('log: a thermostat unavailable for a second (a restart, a reload) is no event',!ev.some(e=>e.room==='Ložnice'));
    const k=pure('rocHlKpi')(ev,now);
    t('log: KPIs over the pauses',k.n===2&&Math.round(k.sum)===63&&Math.round(k.max)===40);
    const ev2=pure('rocHlBuild')(LB.slice(0,-1).concat([{entity_id:'select.central_mode',state:'Heat only',when:s0+5000},{entity_id:'select.central_mode',state:'Frost protection',when:s0+5100,context_user_id:'u1'}]),ctx);
    const tie=[Object.assign({entity_id:'select.central_mode',name:'Topení',message:'změna HDO → pozastaveno (VT) · L1 1 A',when:s0},src('switch.hdo')),Object.assign({entity_id:'select.central_mode',state:'Stopped',when:s0},src('switch.hdo'))];
    const ev3=pure('rocHlBuild')(tie,ctx),ev4=pure('rocHlBuild')([Object.assign({},tie[0],{when:s0-1}),tie[1]],ctx);
    t('log: a message logged with (or a moment before) the change is the pause\'s, not an event of its own',ev3.length===1&&ev3[0].kind==='pause'&&/pozastaveno/.test(ev3[0].msg)&&ev4.length===1&&ev4[0].steps.length===2);
    t('log: the house mode set by hand is its own event',ev2[0].kind==='mode'&&pure('rocHlTitle')('cs',ev2[0])==='Režim domu → Proti mrazu · ručně');
    t('log: the entities read — central mode, tariff, rooms, cooking',JSON.stringify(pure('rocHlEntities')({states:st,entities:ent},C2))==='["select.central_mode","switch.hdo","climate.bed","climate.liv","binary_sensor.cook"]');
    t('log: phase bars with the boiler\'s share and the breaker',/stroke-dasharray="3 2"/.test(pure('rocHlPhaseSvg')('cs',[3.1,6.3,16.8],{breaker:25,boilerA:12.8}))&&/jistič 25 A/.test(pure('rocHlPhaseSvg')('cs',[3.1,6.3,16.8],{breaker:25,boilerA:12.8})));
    // the sheet in the card
    const ws=[];
    const hA={states:st,entities:ent,user:{is_admin:true},language:'cs',locale:{language:'cs'},themes:{darkMode:true},callService(d,s2,data){calls.push([d,s2,data]);return Promise.resolve();},
      callWS(m){ws.push(m);if(m.type==='logbook/get_events')return Promise.resolve(LB);if(m.type==='history/history_during_period')return Promise.resolve({'sensor.l1':[{s:'3.1'},{s:'5'}],'sensor.l2':[{s:'6'}],'sensor.l3':[{s:'18.2'},{s:'12'}]});return Promise.resolve({});}};
    const e2=w.document.createElement('room-overlay-card');e2.setConfig(JSON.parse(JSON.stringify(C2)));e2.hass=hA;w.document.body.appendChild(e2);await sleep(30);
    e2._execAct({action:'heating',view:'check'});await sleep(20);
    const AD=()=>e2.shadowRoot.querySelector('.roc-ad');
    t('view: check opens the administration on the settings check; its tab counts the warnings',!!AD()&&AD().querySelector('[data-v="check"]').classList.contains('on')&&/Kontrola nastavení<b>4<\/b>/.test(AD().querySelector('[data-v="check"]').innerHTML)
      &&AD().querySelectorAll('.ad-card').length===4&&AD().querySelectorAll('.ad-ck.warn').length===4);
    AD().querySelector('[data-v="log"]').click();await sleep(30);
    t('the log tab reads the logbook once, of 7 days, for the house entities',ws.filter(m=>m.type==='logbook/get_events').length===1&&ws[0].entity_ids.includes('binary_sensor.cook')
      &&Math.round((Date.parse(ws[0].end_time)-Date.parse(ws[0].start_time))/86400000)===7);
    t('the log: KPIs, filters by what happened, a list by day',AD().querySelectorAll('.hl-kpi div').length===3&&[...AD().querySelectorAll('[data-ad="filter"]')].map(b=>b.getAttribute('data-v')).join()==='all,cooking,tariff,sensor'
      &&AD().querySelectorAll('.hl-ev').length===3&&!!AD().querySelector('.hl-day'));
    {const mt=AD().querySelector('.hl-mt'),cs=mt?mt.querySelectorAll('.mt-c'):[];
      t('7.5.1: the meters on top — the main supply with the boiler\'s share and the breaker, the boiler beside it',cs.length===2&&/Hlavní přívod/.test(cs[0].textContent)&&/nejvíc 23,0 A z 25 A/.test(cs[0].textContent)
        &&cs[0].querySelectorAll('.mt-b').length===3&&!!cs[0].querySelector('.mt-o.hot')&&cs[0].querySelectorAll('.mt-br').length===3&&/Kotel/.test(cs[1].textContent)&&/12,6 A na třech fázích/.test(cs[1].textContent));}
    AD().querySelector('[data-ad="filter"][data-v="cooking"]').click();await sleep(5);
    t('a filter keeps its events',AD().querySelectorAll('.hl-ev').length===1);
    AD().querySelector('.hl-ev').click();await sleep(30);
    const dt=AD().querySelector('.hl-dt');
    t('the detail: the message, the steps, the phase maxima from the history with the boiler and the breaker',!!dt&&/začalo vaření/.test(dt.textContent)&&dt.querySelectorAll('.hl-st time').length>=3
      &&ws.some(m=>m.type==='history/history_during_period'&&m.entity_ids.length===3)&&/18,2 A/.test(dt.innerHTML)&&/nejvyšší fáze ~31,0 A/.test(dt.textContent)&&/jistič 25 A/.test(dt.innerHTML));
    AD().querySelector('[data-ad="close"]').click();
    t('a non-admin gets nothing',(e2.hass=Object.assign({},hA,{user:{is_admin:false}}),e2._execAct({action:'heating',view:'log'}),!AD()));
    e2.hass=hA;
    // the house panel has the admin buttons
    pure('rocHpOpen')(e2);await sleep(5);
    const HP=e2.shadowRoot.querySelector('.roc-hp');
    t('the house panel: settings check (with its count) and event log for admins',!!HP.querySelector('[data-hp="admin"][data-v="log"]')&&/<b>4<\/b>/.test(HP.querySelector('[data-hp-ck]').innerHTML));
    HP.querySelector('[data-hp="admin"][data-v="log"]').click();await sleep(20);
    t('…which opens the administration on that tab',!e2.shadowRoot.querySelector('.roc-hp')&&AD().querySelector('[data-v="log"]').classList.contains('on'));
    AD().querySelector('[data-ad="close"]').click();
    // 7.5.1: in the controller, admins find the log under the footer's second button; Keep is not lit during a timed target
    e2.hass=Object.assign({},hA,{states:Object.assign({},st,{'climate.bed':vtx({timed_preset_manager:{is_active:true,end_time:iso(now+3600000)}})})});
    e2._execAct({action:'heating',entity:'climate.bed',view:'controller'});await sleep(10);
    const HC=()=>e2.shadowRoot.querySelector('.roc-hc');
    t('7.5.1: a running time-limited target lights no duration; the second button says Záznam a kontrola',!HC().querySelector('[data-hc="d"].on')&&HC().querySelector('[data-hc="more"]').textContent==='Záznam a kontrola');
    HC().querySelector('[data-hc="d"][data-v="2h"]').click();await sleep(10);
    t('…a picked duration is lit',HC().querySelector('[data-hc="d"].on').getAttribute('data-v')==='2h');
    HC().querySelector('[data-hc="more"]').click();await sleep(20);
    t('…which opens the event log for an admin',!HC()&&!!AD()&&AD().querySelector('[data-v="log"]').classList.contains('on'));
    AD().querySelector('[data-ad="close"]').click();e2.hass=hA;
    {const got=[];e2.addEventListener('hass-more-info',x=>got.push(x.detail.entityId));e2.hass=Object.assign({},hA,{user:{is_admin:false}});
      e2._execAct({action:'heating',entity:'climate.bed',view:'controller'});await sleep(10);
      t('…and for everyone else Podrobnosti is Home Assistant\'s more-info',HC().querySelector('[data-hc="more"]').textContent==='Podrobnosti'&&(HC().querySelector('[data-hc="more"]').click(),got[0]==='climate.bed')&&!AD());
      e2.hass=hA;}
    // ---- B
    const c=pure('rocHsCfg')(C2,'climate.bed'),c2=pure('rocHsCfg')(C2,'climate.liv'),c3=pure('rocHsCfg')({},'climate.x');
    t('B: the answers from the room\'s usual temperature',c.normal===21&&c.warm===22&&c.eco===19.5&&c.guard===16&&c2.normal===21.5&&c3.show==='never'&&c3.normal===21.5);
    const HM=pure('rocHsMode');
    t('B: which answer the target is',HM(22,c,true)==='warm'&&HM(21,c,false)==='normal'&&HM(19.5,c)==='eco'&&HM(16,c)==='guard'&&HM(23,c)===''&&HM(22,c,false)==='');
    const TX=pure('rocHsText');
    const t1=TX('cs',st['climate.liv'],c2,'normal',21.5,now);
    t('B: a silent thermometer → on an estimate, with when it last reported',t1.alert&&t1.s==='Topí se zatím odhadem, bez měření.'&&/před 3 h/.test(t1.x));
    const okSt=vtx({current_temperature:21,temperature:21,power_percent:22});
    const t2=TX('cs',okSt,c,'normal',21,now),t3=TX('cs',vtx({temperature:16,current_temperature:19,power_percent:0,hvac_action:'idle'}),c,'guard',16,now);
    t('B: holding — the loop open 10 of 45 min; guard — no heating',t2.s==='Je tu teplo, jak má být.'&&t2.ft==='Topí mírně'&&t2.fx==='Okruh je otevřený 10 z každých 45 minut.'&&t3.s==='Tady se teď netopí.'&&t3.x==='Topení naskočí jen kdyby teplota klesla pod 16,0 °C.'&&t3.ft==='Okruh zavřený');
    const t4=TX('cs',Object.assign(vtx({hvac_action:'off',specific_states:Object.assign({},vtx().attributes.specific_states,{hvac_off_reason:'hvac_off_central_mode'})}),{state:'off'}),c,'normal',21,now);
    t('B: paused by the central mode',t4.s==='Topení čeká.'&&/centrální režim/.test(t4.x)&&t4.ft==='Okruh čeká');
    // in the card: heating.simple: always → B
    calls.length=0;
    e2._execAct({action:'heating',entity:'climate.bed'});await sleep(10);
    const HS=()=>e2.shadowRoot.querySelector('.roc-hs');
    t('heating.simple: always → the action opens B with room tabs and four answers',!!HS()&&!e2.shadowRoot.querySelector('.roc-hc')&&HS().querySelectorAll('[data-hs="room"]').length===2&&HS().querySelectorAll('[data-hs="mode"]').length===4
      &&[...HS().querySelectorAll('[data-hs="mode"] b')].map(b=>b.textContent).join('|')==='22,0 °C|21,0 °C|19,5 °C|16,0 °C');
    HS().querySelector('[data-hs="mode"][data-v="warm"]').click();await sleep(20);
    t('B: warmer = the boost slot + 3 h of the timed preset',calls.some(x=>x[0]==='number'&&x[2].value===22)&&calls.some(x=>x[1]==='set_timed_preset'&&x[2].duration_minutes===180)&&HS().querySelector('[data-hs="mode"].on').getAttribute('data-v')==='warm');
    calls.length=0;
    HS().querySelector('[data-hs="away"]').click();await sleep(5);
    t('B: "we are leaving" asks for a second tap first',!calls.length&&HS().querySelector('[data-hs="away"]').classList.contains('sure'));
    HS().querySelector('[data-hs="away"]').click();await sleep(5);
    t('…then puts the central mode on Frost protection',calls.some(x=>x[0]==='select'&&x[2].option==='Frost protection'));
    HS().querySelector('[data-hs="room"][data-v="climate.liv"]').click();await sleep(5);
    t('B: a room tab switches the room',HS().querySelector('[data-hs="room"].on').getAttribute('data-v')==='climate.liv'&&HS().classList.length>0&&e2.shadowRoot.querySelector('.hs-hero').classList.contains('al'));
    HS().querySelector('[data-hs="more"]').click();await sleep(10);
    t('B: "More" opens the full controller of that room',!HS()&&!!e2.shadowRoot.querySelector('.roc-hc'));
    e2._execAct({action:'heating',entity:'climate.bed',view:'controller'});await sleep(10);
    t('view: controller wins over heating.simple',!HS()&&!!e2.shadowRoot.querySelector('.roc-hc'));
  }
  console.log(fails?'\n'+fails+' FAILED':'\nall heating controller tests passed');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
