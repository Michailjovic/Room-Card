#!/usr/bin/env node
/**
 * Every key the schema offers does something (7.0.5).
 *
 * The schema (src/schema/roc-schema.js) is what Room Card Studio's forms, docs/REFERENCE.md and
 * docs/AI_SPEC.md offer. For every key of every element type this tier renders a minimal card
 * once without the key and once per sample value of it, gives it a state update, taps the
 * element, and compares: the rendered DOM plus what the tap did (service calls, more-info, …).
 * A key that changes nothing is either a promise the card does not keep — the 7.0.0 review found
 * a dozen (label `text`, slider `step`, `bottom` / `right` everywhere…) — or it acts in a way a
 * static render cannot show (a hold gesture, a swipe, a real layout). The second kind is listed
 * in ALLOW below with the reason; anything else fails. Adding a key to the schema therefore
 * means making it work, or saying here why it cannot be seen.
 *
 * Usage: node tests/keys.test.js [path/to/room-overlay-card.js]
 *        ROC_KEYS_REPORT=1 … prints the keys without effect as an ALLOW skeleton
 *        node tests/keys.test.js card.js zone icon …   (only those types)
 */
'use strict';
const fs=require('fs');
const path=require('path');
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.error('jsdom is not installed — run: npm i -D jsdom');process.exit(1);}
const ROOT=path.join(__dirname,'..');
const args=process.argv.slice(2);
const cardFile=args[0]&&/\.js$/.test(args[0])?args.shift():path.join(ROOT,'room-overlay-card.js');
const ONLY=args;
const REPORT=!!process.env.ROC_KEYS_REPORT;
const {ROC_SCHEMA:S}=require(path.join(ROOT,'src','schema','roc-schema.js'));

// ---- keys that act, but not in a way one static render can show ---------------------------------
const GESTURE='a gesture with timing (hold / double tap) — tests/render.test.js and lifecycle.test.js';
const ACTION='what the action does is checked by the action tests (lifecycle, render)';
const GEOM='needs a real layout engine (sizes, aspect, scrolling) — tests/e2e.spec.js';
const RUNTIME='acts over time or on input (presence follow, URL, swipe, wheel, sensors) — lifecycle / render / e2e tiers';
const HA='read by Home Assistant itself, not by the card';
const TAG='tags the element into a cockpit section: shows in the section panel — render tier';
const MINI='only changes a navigation mini (nav.live) — render / design tiers';
const STUDIO='read by the studio (editing aids, import data), not drawn by the card';
const TEMPLATE='a Jinja template: rendered by Home Assistant over the WebSocket — lifecycle tier';
const PORTRAIT='only in the portrait (phone) profile — e2e / design tiers';
const DECIDE='PENDING: the card does not read it yet — implement or remove is an open decision (ROADMAP)';
const ALLOW={
  card:{type:HA,card_id:'identifies the card for the studio and the editor (cfgKey) — studio tier',grid_options:HA,view_layout:HA,card_mod:HA,
    lock_aspect:GEOM,aspect_ratio:GEOM,image_fit:GEOM,image_align:GEOM,
    room_entity:RUNTIME,room_state_entity:RUNTIME,follow_mode:RUNTIME,follow_hold:RUNTIME,url_sync:RUNTIME,zoom:RUNTIME,
    haptic:RUNTIME,hold_feedback:GESTURE,hold_color:GESTURE,weather_nav_mini:MINI,rooms:'the room list itself — every tier',nav:'its keys are checked as type nav',
    },
  layout:{portrait:'the portrait profile — e2e geometry tests'},
  zone:{hold_action:GESTURE,hold_delay:GESTURE,tile:TAG,nav_mini:MINI},
  slider:{entity:'a drag gesture sets this entity — render tier',min:'range of the drag — render tier',max:'range of the drag — render tier',live:'sends while dragging — render tier',invert:'drag direction — render tier'},
  blind:{slat_count:'day_night slats are drawn from the measured height — e2e tier',shift_turns:GEOM,shift_start:GEOM,shift_snap:GEOM,shift_legacy:GEOM,
    icon:'the tile icon when the blind is collected into a section — render tier'},
  element:{tap_action:DECIDE,hold_action:DECIDE,double_tap_action:DECIDE,hold_delay:DECIDE},
  vacuumWidget:{hold_action:GESTURE,double_tap_action:GESTURE},
  group:{grouping_code:'opening one group closes the others with the same code — render tier'},
  vacuumRef:{name:DECIDE},
  nav:{mobile_height:PORTRAIT,wheel:RUNTIME,follow_button:'needs presence follow (room_entity) — lifecycle tier',mini:MINI},
  navMini:{templates:MINI,camera_refresh:MINI},
  navChip:{template:DECIDE,icon:DECIDE,active_state:DECIDE,tap_action:DECIDE,hold_action:DECIDE},
  section:{placement_portrait:PORTRAIT,source:'collects tiles from Home Assistant\'s area and entity registries — design tier',domain:'with source: auto — design tier'},
  tile:{hold_delay:GESTURE},
};
// keys every element shares that act only as listed above
// (hold / double tap make an element focusable and fade / slide set its transition, so those show in a render)
const SHARED={hold_delay:GESTURE,section:TAG,tile:TAG,nav_mini:MINI};
for(const t of['badge','icon','label','gauge','blind','element','glow','vacuumWidget','overlay']){
  const own={};for(const k in SHARED)if(S[t]&&S[t].keys[k])own[k]=SHARED[k];
  ALLOW[t]=Object.assign(own,ALLOW[t]||{});
}

const IMG='/local/a.webp',IMG2='/local/b.webp',IMG3='/local/c.webp';
const st=(id,s,a)=>({[id]:{entity_id:id,state:String(s),attributes:a||{},last_changed:'2026-11-10T06:00:00+00:00',last_updated:'2026-11-10T06:00:00+00:00'}});
const STATES=Object.assign({},
  st('light.a','on',{brightness:128,rgb_color:[255,0,0],friendly_name:'Light A',supported_color_modes:['rgb']}),
  st('light.b','off',{friendly_name:'Light B'}),
  st('switch.s','on',{friendly_name:'Switch'}),
  st('sensor.t','20.5',{unit_of_measurement:'°C',friendly_name:'Temp',device_class:'temperature'}),
  st('sensor.t2','55',{unit_of_measurement:'%'}),
  st('sensor.lux','30',{unit_of_measurement:'lx'}),
  st('sensor.vs','segment_cleaning',{}),
  st('light.w','on',{brightness:200,friendly_name:'Light W'}),
  st('sensor.na','unavailable',{}),
  st('cover.c','open',{current_position:40,supported_features:15,device_class:'blind',friendly_name:'Blind'}),
  st('cover.d','open',{current_position:80,supported_features:15,device_class:'blind',friendly_name:'Blind D'}),
  st('climate.k','heat',{hvac_action:'heating',current_temperature:21,temperature:22,min_temp:7,max_temp:35}),
  st('media_player.m','playing',{volume_level:0.4,media_title:'Song',app_name:'App'}),
  st('vacuum.v','cleaning',{battery_level:80,friendly_name:'Vac'}),
  st('weather.w','rainy',{temperature:10}),
  st('camera.cam','idle',{entity_picture:'/api/camera_proxy/camera.cam?token=1'}));
const STATES2=Object.assign({},STATES,st('sensor.t','22.5',{unit_of_measurement:'°C',friendly_name:'Temp',device_class:'temperature'}));
const condT={entity:'light.a',state:'on'},condF={entity:'light.a',state:'off'};
const ENT_FOR={climate:'climate.k',temperature:'sensor.t',humidity:'sensor.t2',lux_sensor:'sensor.lux',cover:'cover.c',color_from:'light.a',progress:'sensor.t2',base_camera:'camera.cam'};

// sample values for a schema type
function variants(t,key,type){
  const ov=VAL[type+'.'+key]||VAL[key];
  if(ov)return ov;
  const out=[];
  const alts=(t.startsWith('prof:')?t.slice(5):t).split('|');
  const A=[];for(const p of alts){if(A.length&&A[A.length-1].startsWith('enum:')&&!/^(enum|obj|list|prof|str|num|bool|len|url|entity|tmpl|color|any|card|action|cond|map)(:|$)/.test(p))A[A.length-1]+='|'+p;else A.push(p);}
  for(const a of A){
    if(a==='str')out.push(key==='icon'?'mdi:fz-icon':key==='id'?'fzid':key==='group'?'g':key==='section'?'s':'zzfz');
    else if(a==='url')out.push(IMG3);
    else if(a==='entity')out.push(ENT_FOR[key]||(type==='blind'?'cover.c':(type==='vacuumRef'?'sensor.vs':'sensor.t2')));
    else if(a==='tmpl')out.push('{{ fz }}');
    else if(a==='color')out.push('#123456');
    else if(a==='num')out.push(7,37);
    else if(a==='bool')out.push(true,false);
    else if(a==='len')out.push('37%','37px');
    else if(a==='any')out.push('zzany',7);
    else if(a==='map')out.push({fzk:'fzv'});
    else if(a==='card')out.push({type:'custom:fz-card',entity:'light.b'});
    else if(a==='action')out.push({action:'toggle',entity:'light.b'});
    else if(a==='cond')out.push(condF,condT);
    else if(a.startsWith('enum:'))a.slice(5).split('|').forEach(v=>out.push(v));
    else if(a.startsWith('list:')){const it=a.slice(5);
      if(it==='cond')out.push([condF],[condT]);
      else if(it==='condVal')out.push([{condition:condT,value:key.includes('color')?'#123456':key==='opacity'?0.37:key==='filter'?'blur(3px)':'zzfz'}]);
      else if(it==='gradStop')out.push([{value:0,color:'#123456'},{value:100,color:'#654321'}]);
      else if(it==='str')out.push(['zzfz']);
      else if(it==='len')out.push(['37%']);
      else if(it==='num')out.push([7,37]);
      else if(it==='any')out.push(['zzany']);
      else if(S[it])out.push([BASE[it]?BASE[it]():{}]);
      out.push([]);}
    else if(a.startsWith('obj:')){const it=a.slice(4);out.push(BASE[it]?BASE[it]():{});}
  }
  return out;
}
// sample values where the schema type alone (str / any) gives no working value
const VAL={
  animation:['pulse','blink'],format:['raw','relative'],padding:['9px'],image_ratio:['2/1'],animation_speed:['9s'],
  buttons:[['up','down']],min_brightness:[200],visible_template:['{{ false }}'],active_state:['on'],
  'transform.map':[{'40':'rotate(9deg)','*':'rotate(1deg)'}],'companion.type':['custom:fz-card'],
  'blind.entity':['cover.d'],'vacuumRef.entity':['sensor.t'],'icon.entity':['light.b'],
};
// keys that act only together with another key: both renders (without / with the key) get these
const NEED={
  'badge.animation_color':{animation:'pulse'},
  'icon.animation_color':{animation:'pulse'},'icon.entity':{tap_action:{action:'more-info'}},'icon.section_status':{tap_action:{action:'open-section',section:'s'}},
  'overlay.state_images':{image:undefined},'tileOverlay.state_images':{image:undefined},
  'label.text':{entity:undefined},'label.unavailable_text':{entity:'sensor.na'},'label.animation_color':{animation:'pulse'},
  'gauge.arc':{orientation:'radial'},'gauge.thickness':{orientation:'radial'},'gauge.target':{orientation:'radial'},
  'gauge.target_color':{orientation:'radial',target:50},'gauge.animation_color':{animation:'pulse'},'gauge.alert_conditions':{animation:'pulse'},
  'blind.slat_count':{blind_type:'day_night'},'blind.shift_turns':{blind_type:'day_night'},'blind.shift_start':{blind_type:'day_night'},
  'blind.shift_snap':{blind_type:'day_night'},'blind.shift_legacy':{blind_type:'day_night'},
  'blind.slat_gap':{blind_type:'venetian'},'blind.slat_width':{blind_type:'venetian'},'blind.gap_color':{blind_type:'venetian'},
  'blind.animation_color':{animation:'pulse'},
  'glow.width':{shape:'ellipse'},'glow.height':{shape:'ellipse'},'glow.angle':{shape:'wash'},'glow.fallback_color':{entity:'light.w'},
  'glow.animation_speed':{animation:'pulse'},
  'transform.map':{from:undefined,to:undefined},'companion.type':{card:undefined,entity:'light.a'},
  'section.badge':{tiles:[{entity:'switch.s',name:'T',active_state:'on'}]},
  'tile.progress_always':{progress:'sensor.t2',active_state:'off'},'tile.image_ratio':{image:IMG3},'tile.overlays':{image:IMG3},
  'lightControls.height':{style:'native'},'lightControls.lux_sensor':{style:'native'},'lightControls.bg_off':{style:'native'},
  'lightControls.lux_max':{style:'native',lux_sensor:'sensor.lux'},'lightControls.color_low':{style:'native',lux_sensor:'sensor.lux'},
  'lightControls.color_high':{style:'native',lux_sensor:'sensor.lux'},
};
// a minimal working object per type
const BASE={
  overlay:()=>({id:'e',image:IMG2}),
  stateImage:()=>({entity:'light.a',state:'on',image:'/local/d.webp'}),
  overlayConds:()=>({opacity:[{condition:condT,value:0.8}]}),
  transform:()=>({entity:'cover.c',attribute:'current_position',from:{value:0,transform:'rotate(0deg)'},to:{value:100,transform:'rotate(90deg)'}}),
  spin:()=>({}),
  zone:()=>({id:'e',top:'10%',left:'10%',width:'20%',height:'20%',tap_action:{action:'toggle',entity:'light.a'}}),
  slider:()=>({entity:'light.a'}),
  badge:()=>({id:'e',icon:'mdi:a',label:'Lbl'}),
  icon:()=>({id:'e',icon:'mdi:a',entity:'light.a',top:'10%',left:'10%'}),
  label:()=>({id:'e',entity:'sensor.t',top:'10%',left:'10%'}),
  gauge:()=>({id:'e',entity:'sensor.t',top:'10%',left:'10%',width:'5%',height:'30%'}),
  blind:()=>({id:'e',entity:'cover.c',attribute:'current_position',min:100,max:0,top:'10%',left:'10%',width:'10%',height:'30%'}),
  coverControl:()=>({}),
  coverPreset:()=>({position:50}),
  element:()=>({id:'e',top:'10%',left:'10%',width:'20%',height:'20%',card:{type:'custom:fz-card',entity:'light.a'}}),
  glow:()=>({id:'e',entity:'light.a',top:'30%',left:'30%',size:'20%'}),
  group:()=>({id:'g'}),
  vacuumWidget:()=>({id:'e',top:'10%',left:'10%',vacuums:[{entity:'sensor.vs'}]}),
  vacuumRef:()=>({entity:'sensor.vs'}),
  weather:()=>({entity:'weather.w'}),
  brightnessModel:()=>({source:[{entity:'sensor.lux'}],filter_gradient:[{value:0,filter:'brightness(0.3)'},{value:100,filter:'brightness(1)'}]}),
  bmSource:()=>({entity:'sensor.lux'}),
  bmStop:()=>({value:50,filter:'brightness(0.6)'}),
  navChip:()=>({entity:'sensor.t'}),
  section:()=>({id:'s',title:'Sec',tiles:[{entity:'switch.s',name:'T'}]}),
  tile:()=>({entity:'switch.s',name:'T'}),
  quick:()=>({name:'Q',icon:'mdi:q',service:'switch.toggle',target:{entity_id:'switch.s'}}),
  tileOverlay:()=>({id:'to',image:IMG2}),
  lightEntity:()=>({entity:'light.a'}),
  companion:()=>({card:{type:'custom:fz-card',entity:'light.a'}}),
  baseImageCond:()=>({condition:condT,image:IMG2}),
  filterCond:()=>({condition:condT,filter:'brightness(0.5)'}),
  condVal:()=>({condition:condT,value:'zz'}),
  gradStop:()=>({value:0,color:'#111111'}),
};
const LY={rows:['auto','auto','1fr','auto','auto'],columns:['100%'],place:{nav:{row:1},cards_above:{row:2},image:{row:3},lights:{row:4},cards_below:{row:5},cover:{row:5}}};
const LAYOUT={landscape:LY,portrait:LY};
const card=extra=>Object.assign({type:'custom:room-overlay-card',base_image:IMG,layout:LAYOUT},extra);
const two=(extra,r0)=>Object.assign({type:'custom:room-overlay-card',layout:LAYOUT,rooms:[Object.assign({id:'a',name:'A',base_image:IMG},r0||{}),{id:'b',name:'B',base_image:IMG2}]},extra||{});
const opener={id:'i',icon:'mdi:a',top:'1%',left:'1%',tap_action:{action:'open-section',section:'s'}};
// each type inside a card; `tap` finds the element to tap (its actions are part of the result)
const HOST={
  overlay:o=>card({overlays:[o],groups:[{id:'g'}]}),
  stateImage:o=>card({overlays:[{id:'e',state_images:[o]}]}),
  overlayConds:o=>card({overlays:[{id:'e',image:IMG2,conditions:o}]}),
  transform:o=>card({overlays:[{id:'e',image:IMG2,transform:o}]}),
  spin:o=>card({overlays:[{id:'e',image:IMG2,transform:{entity:'sensor.t2',spin:o}}]}),
  zone:o=>card({zones:[o],groups:[{id:'g'}],sections:[{id:'s',title:'S'}]}),
  slider:o=>card({zones:[{id:'e',top:'10%',left:'10%',width:'20%',height:'20%',slider:o}]}),
  badge:o=>card({badges:[o],groups:[{id:'g'}]}),
  icon:o=>card({icons:[o],groups:[{id:'g'}]}),
  label:o=>card({labels:[o],groups:[{id:'g'}]}),
  gauge:o=>card({gauges:[o],groups:[{id:'g'}]}),
  blind:o=>card({blinds:[o],groups:[{id:'g'}]}),
  coverControl:o=>card({blinds:[Object.assign(BASE.blind(),{control:o})]}),
  coverPreset:o=>card({blinds:[Object.assign(BASE.blind(),{control:{presets:[o]}})]}),
  element:o=>card({elements:[o],groups:[{id:'g'}]}),
  glow:o=>card({glows:[o],groups:[{id:'g'}]}),
  group:o=>card({groups:[o],icons:[{id:'i',icon:'mdi:a',top:'1%',left:'1%',group:'g'}]}),
  vacuumWidget:o=>card({vacuum_widgets:[o],groups:[{id:'g'}]}),
  vacuumRef:o=>card({vacuum_widgets:[{id:'e',top:'10%',left:'10%',vacuums:[o]}]}),
  weather:o=>card({weather_overlay:o}),
  brightnessModel:o=>card({brightness_model:o}),
  bmSource:o=>card({brightness_model:{source:[o],filter_gradient:[{value:0,filter:'brightness(0.3)'},{value:100,filter:'brightness(1)'}]}}),
  bmStop:o=>card({brightness_model:{source:[{entity:'sensor.lux'}],filter_gradient:[{value:0,filter:'brightness(0.3)'},o]}}),
  lightControls:o=>card({light_controls:Object.assign({entities:['light.a','light.b']},o)}),
  lightEntity:o=>card({light_controls:{style:'native',entities:[o]}}),
  nav:o=>two({nav:o}),
  navMini:o=>two({nav:{live:'full',mini:o}}),
  navChip:o=>two({},{chips:[o]}),
  section:o=>card({sections:[o],icons:[Object.assign({},opener,{tap_action:{action:'open-section',section:o.id||'s'}})]}),
  tile:o=>card({sections:[{id:'s',title:'Sec',tiles:[o]}],icons:[opener]}),
  quick:o=>card({sections:[{id:'s',title:'Sec',tiles:[{entity:'switch.s',name:'T',quick:[o]}]}],icons:[opener]}),
  tileOverlay:o=>card({sections:[{id:'s',title:'Sec',tiles:[{entity:'switch.s',name:'T',image:IMG3,overlays:[o]}]}],icons:[opener]}),
  companion:o=>card({cards_above:[o]}),
  baseImageCond:o=>card({base_image_conditions:[o]}),
  filterCond:o=>card({filter_conditions:[o]}),
  card:o=>Object.assign(card({icons:[{id:'i',icon:'mdi:a',top:'1%',left:'1%',entity:'light.a',tap_action:{action:'toggle'},hold_action:{action:'more-info'}}],zones:[{id:'z',top:'40%',left:'40%',width:'10%',height:'10%',tap_action:{action:'toggle',entity:'light.a'}}]}),o),
  layout:o=>two({layout:Object.assign({},LAYOUT,o)}),
};
const TAP={zone:c=>c._zoneEls.e,icon:c=>c._icoEls.e,badge:c=>c._bcontEls.e,label:c=>c._lblEls.e,gauge:c=>c._gaugeEls.e,
  blind:c=>c._gaugeEls.e,element:c=>c._contEls.e,vacuumWidget:c=>(c._vwEls||{}).e,tile:c=>c.shadowRoot.querySelector('.roc-tile'),
  quick:c=>c.shadowRoot.querySelector('[data-quick]'),navChip:c=>c.shadowRoot.querySelector('.roc-navchip'),card:c=>c._icoEls.i};

// ---- one window for the whole run ---------------------------------------------------------------
const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://ha.local/lovelace/0',pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.innerWidth=1280;w.innerHeight=800;
w.requestIdleCallback=f=>setTimeout(f,0);
w.IntersectionObserver=class{constructor(cb){this.cb=cb;}observe(t){Promise.resolve().then(()=>this.cb([{target:t,isIntersecting:true,intersectionRatio:1}],this));}unobserve(){}disconnect(){}};
w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
w.console.info=()=>{};w.console.warn=()=>{};w.console.error=()=>{};
w.history.pushState=function(){};w.history.replaceState=function(){};
w.eval("customElements.define('fz-card',class extends HTMLElement{setConfig(c){this._c=c;this.textContent='fz:'+(c.entity||'');}set hass(h){}getCardSize(){return 1;}});");
w.eval(fs.readFileSync(cardFile,'utf8'));
const errors=[];
w.addEventListener('error',e=>errors.push(String(e.message)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=[];
for(const ev of['hass-more-info','ll-custom'])w.document.addEventListener(ev,e=>log.push(ev+':'+JSON.stringify(e.detail)),true);
w.addEventListener('location-changed',()=>log.push('navigate'));
const mkHass=states=>({states,callService(d,s,data,tg){log.push('call:'+d+'.'+s+':'+JSON.stringify(data)+':'+JSON.stringify(tg||null));return Promise.resolve();},
  user:{name:'x',is_admin:true},language:'en',locale:{language:'en'},themes:{darkMode:true},
  connection:{subscribeMessage(cb,msg){Promise.resolve().then(()=>cb({result:/false/.test((msg&&msg.template)||'')?'False':'TMPL:'+((msg&&msg.template)||'')}));return Promise.resolve(()=>{});}}});

async function run(type,cfg){
  log.length=0;
  const c=w.document.createElement('room-overlay-card');
  let err='';
  try{c.setConfig(JSON.parse(JSON.stringify(cfg)));c.hass=mkHass(STATES);w.document.body.appendChild(c);}catch(e){err='ERR:'+e.message;}
  await sleep(40);
  if(!err&&cfg.sections&&cfg.sections.length){try{c._openSection(cfg.sections[0].id);}catch(_){}await sleep(20);}
  if(!err){c.hass=mkHass(STATES2);await sleep(40);}
  let snap=err||((c.getAttribute('style')||'')+'|'+c.shadowRoot.innerHTML.replace(/\s+/g,' '));
  const el=!err&&TAP[type]?TAP[type](c):null;
  if(el){el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));await sleep(10);}
  snap+='\n#'+log.join('|');
  c.remove();
  return snap;
}

(async()=>{
  const t0=Date.now();
  let fails=0;const report={};let checked=0;
  const types=Object.keys(HOST).filter(t=>!ONLY.length||ONLY.includes(t));
  for(const type of types){
    const T=S[type];
    if(!T){console.log('FAIL schema type '+type+' (used by this test) does not exist');fails++;continue;}
    const base=BASE[type]?BASE[type]():{};
    const b=await run(type,HOST[type](base));
    const quiet=[];
    for(const k of Object.keys(T.keys)){
      const d=T.keys[k];
      if(d.t==='self'||d.legacy)continue;
      if(k==='id'&&type!=='section')continue;
      let fx=false;
      const need=NEED[type+'.'+k];
      const kb=need?JSON.parse(JSON.stringify(Object.assign({},base,need))):base;
      const kRef=need?await run(type,HOST[type](kb)):b;
      for(const v of variants(d.t,k,type)){
        if(JSON.stringify(kb[k])===JSON.stringify(v))continue;
        if((await run(type,HOST[type](Object.assign({},kb,{[k]:v}))))!==kRef){fx=true;break;}
      }
      checked++;
      if(!fx)quiet.push(k);
    }
    const allow=ALLOW[type]||{};
    const bad=quiet.filter(k=>!allow[k]);
    const nowWork=Object.keys(allow).filter(k=>T.keys[k]&&!quiet.includes(k));
    if(REPORT&&quiet.length)report[type]=quiet;
    if(bad.length){fails++;console.log('FAIL '+type+': no effect — '+bad.join(', '));}
    else{const pend=quiet.filter(k=>allow[k]===DECIDE);
      console.log('PASS '+type+': every key does something'+(quiet.length>pend.length?' ('+(quiet.length-pend.length)+' act outside a render — ALLOW)':'')+(pend.length?' — PENDING DECISION: '+pend.join(', '):''));}
    const gone=Object.keys(allow).filter(k=>!T.keys[k]);
    if(gone.length){fails++;console.log('FAIL '+type+': ALLOW lists keys the schema no longer has — '+gone.join(', '));}
    if(nowWork.length)console.log('     note: '+type+': '+nowWork.join(', ')+' now change the render — the ALLOW entry can go');
  }
  if(REPORT)console.log('\nALLOW skeleton:\n'+JSON.stringify(report,null,1));
  if(errors.length){fails++;console.log('FAIL errors in the window: '+errors.slice(0,3).join(' | '));}
  console.log('\n'+checked+' keys in '+types.length+' types, '+Math.round((Date.now()-t0)/1000)+' s');
  console.log(fails?('\n'+fails+' KEY TEST(S) FAILED'):'\nALL KEY TESTS PASSED');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
