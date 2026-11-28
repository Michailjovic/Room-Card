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
  console.log(fails?'\n'+fails+' FAILED':'\nall heating controller tests passed');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
