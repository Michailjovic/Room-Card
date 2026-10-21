#!/usr/bin/env node
/**
 * Floor plan page (v6.47.0, V7_PLAN.md §6) — jsdom tests: geometry, themes, the page inside the
 * card, state bindings, actions, and the AnyVac import (the studio's pure part).
 * Usage: node tests/floorplan.test.js [card.js] [floorplan.js] [studio.js]   (requires jsdom)
 * The plan is the author's flat: the S8 MaxV Ultra map via AnyVac (tests/harness/floorplan-data.json).
 */
'use strict';
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.log('jsdom not installed - skipping floor plan tests (npm i -D jsdom)');process.exit(0);}
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const read=(a,d)=>fs.readFileSync(a||path.join(ROOT,d),'utf8');
const cardCode=read(process.argv[2],'room-overlay-card.js');
const fpCode=read(process.argv[3],'room-overlay-card-floorplan.js');
const studioCode=read(process.argv[4],'room-overlay-card-studio.js');
const DATA=JSON.parse(fs.readFileSync(path.join(__dirname,'harness','floorplan-data.json'),'utf8'));
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.innerWidth=1920;w.innerHeight=1080;
w.requestIdleCallback=f=>setTimeout(f,0);
w.loadCardHelpers=undefined;
w.eval(cardCode);
let fails=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=o=>JSON.parse(JSON.stringify(o));
const C=w.customElements.get('room-overlay-card');

const C0=DATA.clean;
const PLAN={theme:'night',rooms:[
  {room:'living_room',polygon:C0.Living,floor:'wood',lights:'light.living',climate:'climate.living'},
  {room:'hall',polygon:C0.Corridor,floor:'tile',lights:'light.hall',temperature:'sensor.hall_t',humidity:'sensor.hall_h'},
  {room:'bathroom',polygon:C0.Bathroom,floor:'tile',lights:['light.bath'],temperature:'sensor.bath_t'},
  {room:'kitchen',polygon:C0.Kitchen,floor:'tile',lights:[{entity:'light.kitchen'}],climate:'climate.kitchen'},
  {room:'bedroom',name:'Sleep',polygon:C0.Bedroom,floor:'carpet',lights:'light.bed',climate:'climate.bed'},
  {name:'Broken',polygon:[[0,0],[1,1]]}],
  openings:[{type:'door',at:[11.93,1.48]},{type:'door',at:[8.65,2.3]},{type:'door',at:[5.98,2.25]},{type:'door',at:[7.03,2.8],width:0.75}]};
const calls=[];
const states=()=>({
  'light.living':{state:'on',attributes:{brightness:230,rgb_color:[255,180,100]}},
  'light.kitchen':{state:'on',attributes:{brightness:128,color_temp_kelvin:3000}},
  'light.bath':{state:'on',attributes:{}},'light.bed':{state:'off',attributes:{}},'light.hall':{state:'off',attributes:{}},
  'climate.living':{state:'heat',attributes:{hvac_action:'heating',current_temperature:23.1,current_humidity:53}},
  'climate.kitchen':{state:'heat',attributes:{hvac_action:'idle',current_temperature:22.6}},
  'climate.bed':{state:'off',attributes:{hvac_action:'off',current_temperature:20}},
  'sensor.hall_t':{state:'23.6',attributes:{}},'sensor.hall_h':{state:'52',attributes:{}},'sensor.bath_t':{state:'21.6',attributes:{}},
});
const mkHass=(st)=>({states:st||states(),callService(d,s,data,tg){calls.push([d,s,data,tg]);},language:'en',locale:{language:'en'},user:{name:'x'},themes:{darkMode:true}});
const ROOMS=[{id:'plan',name:'Plan',icon:'mdi:floor-plan',floorplan:PLAN}].concat(['living_room','hall','bathroom','kitchen','bedroom'].map((id,i)=>({id,name:id,base_image:'/'+id+'.png',overview_tile:{name:'T'+i}})));
const BASE={type:'custom:room-overlay-card',layout:{height:'container',landscape:{rows:['auto','1fr'],place:{nav:{row:1},image:{row:2}}},portrait:{rows:['auto','auto'],place:{nav:{row:1},image:{row:2}}}},nav:{style:'thumbnails'},rooms:ROOMS};
const mk=(cfg,h)=>{const el=w.document.createElement('room-overlay-card');el.setConfig(clone(cfg));el.hass=h||mkHass();w.document.body.appendChild(el);return el;};
const sr=el=>el.shadowRoot;
const ev=(el,type,o)=>el.dispatchEvent(new w.MouseEvent(type,Object.assign({bubbles:true,cancelable:true,composed:true,clientX:10,clientY:10,button:0},o||{})));

(async()=>{
  // ---- 0. without a floor plan room nothing changes -------------------------------------------
  {
    const plain=clone(BASE);plain.rooms=plain.rooms.slice(1);
    const el=mk(plain);await sleep(40);
    t('no floorplan room → no floor plan CSS',sr(el).querySelector('style').textContent.indexOf('.roc-fp{')<0);
    t('no floorplan room → no renderer, no page',!sr(el).querySelector('[data-fp-root]')&&!el._fpInst&&!el._fpActive);
    el.remove();
  }
  // ---- 1. the page before the renderer is loaded: the loader is asked for it ------------------
  {
    const el=mk(BASE);await sleep(40);
    t('floor plan page: root host, no photo stage, no nav strip',!!sr(el).querySelector('[data-fp-root]')&&!sr(el).querySelector('.roc-nav')&&/inset:\s*0/.test(sr(el).querySelector('.content').getAttribute('style')||''));
    t('_fpActive flag; only the image region is placed',el._fpActive===true&&[...sr(el).querySelectorAll('.roc-reg')].map(r=>r.dataset.reg).join(',')==='image');
    // jsdom has no import(): the loader fails and says so in the page — the card itself keeps working
    await sleep(60);
    const msg=sr(el).querySelector('.roc-fp-msg');
    t('a failed renderer import is shown in the page, not thrown',!!msg&&/floor plan/i.test(msg.textContent));
    el.remove();
  }
  // ---- 2. load the renderer (what the import would do) ------------------------------------------
  w.eval(fpCode);
  const F=C._rocFloorplan;
  t('the renderer registers on the card class',!!F&&F.version===require('../package.json').version);
  const G=F.geom;
  // geometry
  const raw=DATA.anyvac.attributes.rooms;
  const toM=p=>[(p[0]-800)/80,(p[1]-752)/80];
  const counts={};raw.forEach(r=>{const m=r.outline_home_px.map(toM);const c=G.clean(m);counts[r.name]=[m.length,c.length,Math.abs(G.area(m)),Math.abs(G.area(c))];});
  t('clean-up: Living room 14 → 8 points',counts['Living room'][1]===8);
  t('clean-up: Corridor 21 → 4, Bathroom 20 → 4',counts.Corridor[1]===4&&counts.Bathroom[1]===4);
  t('clean-up: Kitchen 45 → 10 (the L stays), Bedroom 32 → 10',counts.Kitchen[1]===10&&counts.Bedroom[1]===10);
  t('clean-up: every area within 12 % of the robot\'s',Object.values(counts).every(c=>Math.abs(c[3]-c[2])/c[2]<0.12));
  t('clean-up output is rectilinear',Object.keys(counts).every(k=>{const c=G.clean(raw.find(r=>r.name===k).outline_home_px.map(toM));return c.every((p,i)=>{const n=c[(i+1)%c.length];return p[0]===n[0]||p[1]===n[1];});}));
  const polys=[C0.Living,C0.Corridor,C0.Bathroom,C0.Kitchen,C0.Bedroom];
  const doors=G.doors(polys,[]);
  t('doors: one per pair of touching rooms (4)',doors.length===4);
  t('doors: living ↔ corridor on the shared wall',doors.some(d=>d.rooms.join()==='0,1'&&Math.abs(d.at[0]-5.98)<0.05));
  const path0=[[[5,2.3],[6.5,2.3],[7,2.3]]];
  const dp=G.doors(polys,path0).find(d=>d.rooms.join()==='0,1');
  t('doors: a robot path moves the door to where it crossed',dp&&Math.abs(dp.at[1]-2.3)<0.02&&dp.traced===true);
  const dq=G.doors(polys,[[[5,1.75],[7,1.75]]]).find(d=>d.rooms.join()==='0,1');
  t('doors: …but never out of the shared wall (the door still fits)',dq&&Math.abs(dq.at[1]-2.15)<0.02);
  const segs=G.wallSegs(C0.Living,[{at:[5.98,2.25],width:0.8}]);
  const gap=segs.filter(s=>Math.abs(s.a[0]-5.95)<0.01&&Math.abs(s.b[0]-5.95)<0.01);
  t('walls: a door cuts the wall it sits on (two pieces left)',gap.length===2&&gap.every(s=>Math.max(s.a[1],s.b[1])<=1.85+1e-6||Math.min(s.a[1],s.b[1])>=2.65-1e-6));
  const L=C0.Kitchen,pl=G.pole(L);
  t('label spot of the L-shaped kitchen is inside it, in the big arm',G.inPoly(pl[0],pl[1],L)&&pl[0]>9.45);
  const all=[].concat(...polys);
  ['top','oblique','iso'].forEach(pj=>{
    const fit=G.fit(all,pj,0,1200,600,20,0.45);
    const ok=all.every(p=>{const s=G.P(fit,p[0],p[1],0);return s[0]>=19.9&&s[0]<=1180.1&&s[1]>=19.9&&s[1]<=580.1;});
    const back=G.inv(fit,...G.P(fit,3.2,1.7,0));
    t('fit '+pj+': the plan fits the box and screen → plan inverts',ok&&Math.abs(back[0]-3.2)<1e-6&&Math.abs(back[1]-1.7)<1e-6);
  });
  const r90=G.fit(all,'top',90,600,1200,10,0);
  t('rotate 90: the long flat stands up in a portrait box',r90.S>G.fit(all,'top',0,600,1200,10,0).S*1.5);
  // themes
  t('seven themes',F.themeNames.join()==='night,clay,neon,blueprint,thermal,tiles,sketch');
  t('theme_by: profile beats dark/light beats theme',F.themeName({theme:'clay',theme_by:{portrait:'tiles',dark:'neon'}},'portrait',true)==='tiles'&&F.themeName({theme:'clay',theme_by:{portrait:'tiles',dark:'neon'}},'landscape',true)==='neon'&&F.themeName({theme:'clay',theme_by:{dark:'neon'}},'landscape',false)==='clay');
  t('unknown theme falls back to night',F.themeName({theme:'nope'},'landscape',false)==='night');
  const tk=F.theme({theme:'night',overrides:{'floor.wood':'#123456','label.c':'red'},wall:{height:0.3}},'landscape',true);
  t('overrides replace single tokens; wall.height sets the wall',tk.floor.wood==='#123456'&&tk.label.c==='red'&&tk.wall.h===0.3&&F.themes.night.floor.wood!=='#123456');
  t('kelvin: warm white is warm',/^rgb\(255,1[6-9]\d,1[0-4]\d\)$/.test(G.kelvin(3000)));

  // ---- 3. the page with the renderer ---------------------------------------------------------
  F.View.prototype._size=function(){return[1200,600];}; // jsdom has no layout
  const el=mk(BASE);await sleep(60);
  const S=sr(el);
  const v=el._fpInst;
  t('the view is mounted into the page',!!v&&!!S.querySelector('[data-fp-root] svg.rfp-svg'));
  t('rooms with a polygon are drawn (the broken one is left out)',S.querySelectorAll('[data-rfp-hit]').length===5&&v.M.rooms.length===5);
  t('names: the linked room\'s tile name, else name; plan name wins',[...S.querySelectorAll('[data-rfp-name]')].map(x=>x.textContent.replace(/\s.*$/,'')).join(',')==='T0,T1,T2,T3,Sleep'||[...S.querySelectorAll('[data-rfp-name] tspan:first-child,[data-rfp-name]')].length>0);
  const nm=[...S.querySelectorAll('[data-rfp-label]')].map(g=>g.querySelector('[data-rfp-name]')).map(n=>(n.querySelector('tspan')||n).textContent);
  t('label names in order',nm.join(',')==='T0,T1,T2,T3,Sleep');
  const val=k=>S.querySelector('[data-rfp-val="'+k+'"]').textContent.trim();
  t('values: climate temperature + humidity',val(0)==='23.1° · 53 %');
  t('values: sensors win; hall 23.6° · 52 %',val(1)==='23.6° · 52 %');
  const lo=k=>parseFloat(S.querySelector('[data-rfp-light="'+k+'"]').getAttribute('opacity'));
  t('lights: lit rooms glow, the dark bedroom does not',lo(0)>0.9&&lo(2)>0.9&&lo(4)===0);
  t('lights: brightness sets the strength (kitchen at 50 %)',Math.abs(lo(3)-(0.35+0.65*128/255))<0.01);
  t('lights: rgb_color tints the pool',S.querySelector('[data-rfp-stop="0"]').getAttribute('stop-color')==='rgb(255,180,100)');
  t('lights: colour temperature tints the kitchen',/^rgb\(255,/.test(S.querySelector('[data-rfp-stop="3"]').getAttribute('stop-color')));
  const hc=k=>S.querySelector('[data-rfp-heat="'+k+'"]').getAttribute('class');
  t('heating: hvac_action heating → is-heat; idle → is-idle; off → is-off',hc(0)==='rfp-heat is-heat'&&hc(3)==='rfp-heat is-idle'&&hc(4)==='rfp-heat is-off');
  t('no climate → no heating loop',!S.querySelector('[data-rfp-heat="1"]'));
  t('walls are drawn as projected faces (oblique theme default)',S.querySelectorAll('polygon').length>40);
  // state update: only changed rooms are touched
  const before=S.querySelector('[data-rfp-light="0"]');
  const h2=mkHass();h2.states['light.bed']={state:'on',attributes:{brightness:255,rgb_color:[10,20,30]}};
  h2.states['climate.living']={state:'heat',attributes:{hvac_action:'idle',current_temperature:23.4,current_humidity:53}};
  el.hass=h2;await sleep(20);
  t('update: the bedroom lights up with its colour',lo(4)===1&&S.querySelector('[data-rfp-stop="4"]').getAttribute('stop-color')==='rgb(10,20,30)');
  t('update: living stops heating, its value follows',hc(0)==='rfp-heat is-idle'&&val(0)==='23.4° · 53 %');
  t('update: no re-render (same nodes)',S.querySelector('[data-rfp-light="0"]')===before&&el._fpInst===v);
  // tap → the linked room (switch-room through the card's runner); hold → toggle the lights
  calls.length=0;
  const hit=S.querySelector('[data-rfp-hit="4"]');
  ev(hit,'pointerdown');ev(hit,'pointerup');await sleep(30);
  t('tap a room → the card switches to it',el._roomIdx===5&&!el._fpActive);
  el._switchRoom(0,-1,true);await sleep(40);
  t('back on the plan the renderer is mounted again (synchronously)',el._fpActive&&!!el._fpInst&&el._fpInst!==v);
  const hit0=sr(el).querySelector('[data-rfp-hit="0"]');
  ev(hit0,'pointerdown');await sleep(650);ev(hit0,'pointerup');await sleep(20);
  t('hold a room → its lights toggle',calls.length===1&&calls[0][0]==='homeassistant'&&calls[0][1]==='toggle'&&calls[0][3].entity_id==='light.living'&&el._roomIdx===0);
  const hit1=sr(el).querySelector('[data-rfp-hit="1"]');
  ev(hit1,'pointerdown');ev(hit1,'pointermove',{clientX:60});ev(hit1,'pointerup',{clientX:60});await sleep(20);
  t('a drag is not a tap',el._roomIdx===0);
  // own actions win; an unlinked room opens more-info of its thermostat
  {
    const c=clone(BASE);c.rooms[0].floorplan.rooms[1].tap_action={action:'toggle',entity:'light.hall'};c.rooms[0].floorplan.rooms[4].room='nope';
    const e2=mk(c);await sleep(40);
    const more=[];e2.addEventListener('hass-more-info',x=>more.push(x.detail.entityId));
    calls.length=0;
    const hb=sr(e2).querySelector('[data-rfp-hit="1"]');ev(hb,'pointerdown');ev(hb,'pointerup');await sleep(20);
    t('a plan room\'s own tap_action wins',calls.length===1&&calls[0][3]===undefined&&calls[0][2].entity_id==='light.hall'&&e2._roomIdx===0);
    const hb4=sr(e2).querySelector('[data-rfp-hit="4"]');ev(hb4,'pointerdown');ev(hb4,'pointerup');await sleep(20);
    t('an unlinked room → more-info of its thermostat',more[0]==='climate.bed'&&e2._roomIdx===0);
    e2.remove();
  }
  // nav strip on a room: the plan is an icon thumbnail
  el._switchRoom(1,1,true);await sleep(40);
  const th=sr(el).querySelector('.roc-thumb[data-thumb="0"]');
  t('the floor plan page is an icon thumbnail in the strip',!!th&&th.classList.contains('roc-thumb-ov')&&th.querySelector('ha-icon').getAttribute('icon')==='mdi:floor-plan');
  t('leaving the page drops the view',!el._fpInst&&!el._fpActive);
  el.remove();
  // an overview page next to a floor plan page: the plan is not a tile, the switch is a fade
  {
    const c=clone(BASE);c.rooms.unshift({id:'ov',name:'Overview',overview:{transition:'zoom'}});
    const e3=mk(c);await sleep(40);
    const tiles=[...sr(e3).querySelectorAll('.roc-ovt')].map(x=>x.dataset.ovt);
    t('overview grid leaves the floor plan page out',tiles.join(',')==='2,3,4,5,6');
    const plan=e3._ovPlanSwitch(1,true);
    t('overview → floor plan: a plain fade',plan&&plan.kind==='fade-out');
    e3.remove();
  }
  // a room that is both: the overview wins
  {
    const c=clone(BASE);c.rooms[0].overview=true;
    const e4=mk(c);await sleep(40);
    t('overview + floorplan on one room → the overview',e4._ovActive&&!e4._fpActive&&!sr(e4).querySelector('[data-fp-root]'));
    e4.remove();
  }
  // every theme draws (each mode), low quality drops the filters
  for(const th2 of F.themeNames){
    const c=clone(BASE);c.rooms[0].floorplan.theme=th2;c.rooms[0].floorplan.quality='low';
    const e5=mk(c);await sleep(30);
    const s5=sr(e5),n=th2==='tiles'?s5.querySelectorAll('[data-rfp-tile]').length:s5.querySelectorAll('[data-rfp-hit]').length;
    t('theme '+th2+': five rooms, no SVG filters at low quality',n===5&&!s5.querySelector('filter'));
    if(th2==='thermal'){
      const f=[0,1,2].map(k=>s5.querySelector('[data-rfp-thermo="'+k+'"]').getAttribute('fill'));
      t('thermal: colour follows the temperature (21.6° ≠ 23.6°)',f[0]!==f[1]&&f[1]!==f[2]&&s5.querySelector('[data-rfp-tt="0"]').textContent==='23.1°');
    }
    if(th2==='tiles'){
      calls.length=0;
      const lc=s5.querySelector('[data-rfp-ctl="light:4"]');
      ev(lc,'pointerdown');ev(lc,'pointerup');await sleep(20);
      t('tiles: the light chip toggles that room\'s lights',calls.length===1&&calls[0][3].entity_id==='light.bed'&&e5._roomIdx===0);
    }
    if(th2==='blueprint')t('blueprint: dimensions and m²',/16[.,]15 m/.test(s5.querySelector('svg').textContent)&&/m²/.test(s5.querySelector('svg').textContent));
    e5.remove();
  }
  {
    const c=clone(BASE);c.rooms[0].floorplan.theme_by={dark:'neon',light:'clay'};
    const e8=mk(c);await sleep(30);
    t('theme_by.dark in dark mode',e8._fpInst.T.name==='neon');
    const h=mkHass();h.themes={darkMode:false};e8.hass=h;await sleep(30);
    t('switching Home Assistant to light mode re-draws with theme_by.light',e8._fpInst.T.name==='clay');
    e8.remove();
  }
  {
    const c=clone(BASE);c.rooms[0].floorplan.theme='sketch';
    const e6=mk(c);await sleep(30);
    t('sketch at auto quality: rough + paper filters',sr(e6).querySelectorAll('filter').length===2);
    e6.remove();
  }
  {
    const c=clone(BASE);c.rooms[0].floorplan={};
    const e7=mk(c);await sleep(30);
    t('an empty plan says how to fill it',/No floor plan yet/.test(sr(e7).querySelector('svg').textContent));
    e7.remove();
  }
  // ---- the classic editor keeps the floor plan as it is ------------------------------------------
  {
    const ed=w.document.createElement('room-overlay-card-editor');
    ed.setConfig(clone(BASE));ed.hass=mkHass();w.document.body.appendChild(ed);
    ed._editRoomIdx=0;ed._editGlobal=false;ed._render();
    t('editor: the image tab says the room is a floor plan page (edited in the Studio)',/floor plan page/.test(ed.innerHTML)&&/Studio/.test(ed.innerHTML));
    const out=ed._collectConfig();
    t('editor: an untouched floor plan room round-trips unchanged',JSON.stringify(out.rooms[0])===JSON.stringify(BASE.rooms[0]));
    ed._editRoomIdx=2;ed._render();
    const out2=ed._collectConfig();
    t('editor: editing another room keeps the floor plan',JSON.stringify(out2.rooms[0].floorplan)===JSON.stringify(BASE.rooms[0].floorplan));
    ed.remove();
  }
  // ---- 4. the AnyVac import (the studio's pure part) ------------------------------------------
  w.eval(studioCode);
  const ST=C._rocStudio;
  const hass={states:{'sensor.s8_anyvac_map':DATA.anyvac,
      'light.lr':{state:'on',attributes:{}},'light.lr_seg':{state:'on',attributes:{}},'climate.lr':{state:'heat',attributes:{hvac_modes:['heat','off'],current_temperature:22}},
      'climate.lr_dehum':{state:'dry',attributes:{hvac_modes:['dry','off']}},'sensor.living_room_h':{state:'50',attributes:{device_class:'humidity'}},
      'sensor.lr_chip_temp':{state:'40',attributes:{device_class:'temperature'}},'sensor.k_t':{state:'22',attributes:{device_class:'temperature'}},'light.k':{state:'off',attributes:{}}},
    areas:{living_room:{name:'Living Room',aliases:['Obývák']},kitchen:{name:'Kitchen',aliases:[]},hall:{name:'Hall',aliases:['Vchod']}},
    entities:{'light.lr':{area_id:'living_room'},'light.lr_seg':{area_id:'living_room',hidden:true},'climate.lr':{area_id:'living_room'},'climate.lr_dehum':{area_id:'living_room'},
      'sensor.lr_chip_temp':{area_id:'living_room',entity_category:'diagnostic'},'sensor.living_room_h':{area_id:'living_room'},'sensor.k_t':{device_id:'d1'},'light.k':{area_id:'kitchen'}},
    devices:{d1:{area_id:'kitchen'}}};
  const card={rooms:[{id:'plan',floorplan:{}},{id:'living_room',name:'Living room'},{id:'hall',name:'Hall',overview_tile:{name:'Chodba'}},{id:'kitchen',name:'Kuchyň',area_match:['Kitchen'],light_controls:{entities:[{entity:'light.k'}]}},{id:'bathroom',name:'Bathroom'},{id:'bedroom',name:'Ložnice'}],
    nav:{chips:[{entity:'sensor.{room}_h'}]}};
  t('AnyVac sensors are found by their contract (schema_version ≥ 3, home_frame, rooms)',ST.fpSensors(hass).join()==='sensor.s8_anyvac_map');
  const fp=ST.fpImport(G,hass,card,'sensor.s8_anyvac_map',DATA.anyvac,{today:'2026-10-21'},{});
  const byKey=k=>fp.rooms.find(r=>r.anyvac_room==='7bUI4dOp7O1qnECi7UfFW3_'+k);
  t('import: five rooms, cleaned',fp.rooms.length===5&&byKey(16).polygon.length===8&&byKey(18).polygon.length===4);
  t('import: names link rooms ("Living room" = living_room, Kitchen via area_match)',byKey(16).room==='living_room'&&byKey(19).room==='kitchen'&&byKey(17).room==='bathroom');
  t('import: "Corridor" matches no room → plan only, keeps its name',!byKey(18).room&&byKey(18).name==='Corridor');
  t('import: the plan starts at 0,0 in metres',Math.min(...[].concat(...fp.rooms.map(r=>r.polygon)).map(p=>p[0]))===0&&byKey(16).polygon.some(p=>p[0]===5.95));
  t('import: lights from the area (hidden ones left out), the thermostat that can heat',byKey(16).lights==='light.lr'&&byKey(16).climate==='climate.lr');
  t('import: humidity from the nav chips ({room}), no temperature sensor next to a thermostat',byKey(16).humidity==='sensor.living_room_h'&&!byKey(16).temperature);
  t('import: light controls win over the area; a device\'s area counts',byKey(19).lights==='light.k'&&byKey(19).temperature==='sensor.k_t');
  t('import: kitchen / bathroom tiled, living room wood',byKey(19).floor==='tile'&&byKey(17).floor==='tile'&&byKey(16).floor==='wood');
  t('import: doors proposed, one where the robot crossed',fp.openings.length===4&&fp.openings.some(o=>Math.abs(o.at[1]-(930-752)*0.0125)<0.06));
  t('import: the source is recorded (sensor, frame, date, origin, scale)',fp.source.anyvac==='sensor.s8_anyvac_map'&&fp.source.frame==='d4e8'&&fp.source.imported==='2026-10-21'&&fp.source.origin_px.join()==='800,752'&&fp.source.mm_per_px===12.5&&fp.theme==='night');
  const linked=ST.fpImport(G,hass,card,'sensor.s8_anyvac_map',DATA.anyvac,{links:{'7bUI4dOp7O1qnECi7UfFW3_18':'hall','7bUI4dOp7O1qnECi7UfFW3_20':null},doors:false,clean:false},{});
  t('import: links override the guess; null leaves a room out; no doors, no clean-up',linked.rooms.length===4&&linked.rooms.find(r=>r.anyvac_room.endsWith('_18')).room==='hall'&&!linked.openings&&linked.rooms.find(r=>r.anyvac_room.endsWith('_16')).polygon.length===14);
  const prev=clone(fp);prev.rooms.find(r=>r.anyvac_room.endsWith('_16')).name='Obývák';prev.rooms.find(r=>r.anyvac_room.endsWith('_16')).polygon=[[0,0],[1,0],[1,1]];
  prev.rooms.push({name:'Balcony',polygon:[[0,5],[2,5],[2,6],[0,6]]});prev.openings=[{type:'door',at:[1,1]}];prev.theme='clay';
  const re=ST.fpImport(G,hass,card,'sensor.s8_anyvac_map',DATA.anyvac,{doors:false},prev);
  const lr=re.rooms.find(r=>r.anyvac_room&&r.anyvac_room.endsWith('_16'));
  t('re-import: a room keeps its own settings, gets the new outline',lr.name==='Obývák'&&lr.polygon.length===8&&lr.lights==='light.lr');
  t('re-import: a drawn room and the doors stay, theme kept',re.rooms.some(r=>r.name==='Balcony')&&re.openings.length===1&&re.theme==='clay'&&re.rooms.length===6);
  // the A1 guard: an outline far smaller than its box falls back to the box
  const broken=clone(DATA.anyvac);broken.attributes.rooms[0].outline_home_px=[[1588,1092],[1648,1092],[1648,1100],[1588,1100]];
  const fb=ST.fpImport(G,hass,card,'sensor.s8_anyvac_map',broken,{clean:false,doors:false},{});
  const k=fb.rooms.find(r=>r.anyvac_room.endsWith('_19'));
  t('a broken outline (AnyVac A1) falls back to the room\'s bbox',k.polygon.length===4&&Math.abs(Math.abs(G.area(k.polygon))-3.2*4.4)<0.05);
  console.log(fails?'\n'+fails+' FAILED':'\nall floor plan tests passed');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
