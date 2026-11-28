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
{const _E=w.customElements.get('room-overlay-card-editor');if(_E)_E.rocDefaultView='classic';} // v7: the classic tabs are tested here; the launcher has its own tests
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
  // 7.0.0-beta.4: the wall network — one wall where two rooms meet, no slivers, doors cut only their own wall
  {
    const A=[[0,0],[4,0],[4,3],[0,3]],B=[[4.08,0],[7,0],[7,3],[4.08,3]];           // 8 cm apart, facing
    const net=G.wallNet([A,B],[]);
    const shared=net.filter(w=>w.shared);
    t('wall net: two rooms 8 cm apart share ONE wall on the middle line',shared.length===1&&Math.abs(shared[0].a[0]-4.04)<1e-6&&Math.abs(shared[0].b[0]-4.04)<1e-6);
    t('wall net: …and neither room keeps its own copy of it',!net.some(w=>!w.shared&&Math.abs(w.a[0]-w.b[0])<1e-6&&(Math.abs(w.a[0]-4)<1e-6||Math.abs(w.a[0]-4.08)<1e-6)));
    t('wall net: 7 walls for two boxes (3 + 3 + the shared one)',net.length===7);
    const C=[[0,0],[2,0],[2,2],[0,2]],D=[[0,2.25],[2,2.25],[2,4],[0,4]];
    t('wall net: walls 25 cm apart stay two walls (thicker than a partition)',G.wallNet([C,D],[]).filter(w=>w.shared).length===0);
    const sideBySide=[[0,0],[3,0],[3,2],[0,2]],same=[[0.5,0.1],[2.5,0.1],[2.5,1.5],[0.5,1.5]];
    t('wall net: rooms on the same side of a line are not merged',G.wallNet([sideBySide,same],[]).filter(w=>w.shared).length===0);
    const H=[[0,0],[2.9,0],[2.9,2],[0,2]],K=[[3,0.1],[5,0.1],[5,2.1],[3,2.1]];
    const nk=G.wallNet([H,K],[]);
    t('wall net: a 10 cm overhang at the end joins the shared wall (no stub left)',nk.filter(w=>w.shared).length===1&&!nk.some(w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1])<0.15));
    const cut=G.wallSegs([[2,0],[2.9,0],[2.9,1.2]],[{at:[2.75,0.25],width:0.8,u:[1,0]}],0.3,true);
    t('walls: a door near a corner cuts its own wall only, not the perpendicular one',cut.some(w=>Math.abs(w.a[0]-2.9)<1e-6&&Math.abs(w.b[0]-2.9)<1e-6&&Math.abs(w.a[1])<1e-6));
    const sl=G.wallSegs([[0,0],[1,0]],[{at:[0.5,0],width:0.84,u:[1,0]}],0.3,true);
    t('walls: an 8 cm sliver next to a door is not drawn as a post',sl.length===0);
    const mu=G.wallSegs([[0,0],[3,0]],[{at:[0.9,0],width:0.9,u:[1,0]},{at:[1.83,0],width:0.9,u:[1,0]}],0.3,true);
    t('walls: a 3 cm mullion between two windows stays',mu.some(w=>Math.abs(w.a[0]-1.35)<1e-6&&Math.abs(w.b[0]-1.38)<1e-6));
  }
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
  // 7.1.0: the loops are drawn by the heating layer (data-rfp-hx); colour / grey by state
  const hx=k=>S.querySelector('[data-rfp-hx="'+k+'"]');
  const hcol=k=>parseFloat(hx(k).querySelector('.rfp-hc').style.opacity),hgr=k=>parseFloat(hx(k).querySelector('.rfp-hg').style.opacity);
  const hc=k=>hx(k).classList.contains('is-flow')?'heat':(hcol(k)>0?'idle':'off');
  t('heating: heating → coloured with flow; idle → faint; off → grey',hc(0)==='heat'&&hcol(0)===1&&hc(3)==='idle'&&Math.abs(hcol(3)-0.25)<1e-6&&hc(4)==='off'&&hgr(4)===1);
  t('no climate → no heating loop',!hx(1)&&!S.querySelector('[data-rfp-heat="1"]'));
  t('heating: a loop is two pipes (supply + return) inside the room',hx(0).querySelectorAll('.rfp-hg').length===2);
  t('walls are drawn as projected faces (oblique theme default)',S.querySelectorAll('polygon').length>40);
  // state update: only changed rooms are touched
  const before=S.querySelector('[data-rfp-light="0"]');
  const h2=mkHass();h2.states['light.bed']={state:'on',attributes:{brightness:255,rgb_color:[10,20,30]}};
  h2.states['climate.living']={state:'heat',attributes:{hvac_action:'idle',current_temperature:23.4,current_humidity:53}};
  el.hass=h2;await sleep(20);
  t('update: the bedroom lights up with its colour',lo(4)===1&&S.querySelector('[data-rfp-stop="4"]').getAttribute('stop-color')==='rgb(10,20,30)');
  t('update: living stops heating, its value follows',hc(0)==='idle'&&val(0)==='23.4° · 53 %');
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
    if(th2==='night')t('7.0.1: low quality runs the plan\'s animations in steps (rfp-eco)',!!s5.querySelector('svg.rfp-svg.rfp-eco')&&/\.rfp-eco \.rfp-flow\{animation-timing-function:steps\(30\)\}/.test(s5.innerHTML+[...s5.querySelectorAll('style')].map(x=>x.textContent).join('')));
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
    t('sketch at auto quality: rough + paper filters (+ the heating glow)',!!sr(e6).querySelector('filter[id$="-rough"]')&&!!sr(e6).querySelector('filter[id$="-paper"]')&&sr(e6).querySelectorAll('filter').length===3);
    t('7.0.4: auto quality runs the animations in steps too (rfp-eco is the default)',!!sr(e6).querySelector('svg.rfp-eco'));
    e6.remove();
    const ch=clone(BASE);ch.rooms[0].floorplan.quality='high';
    const eh=mk(ch);await sleep(30);
    t('7.0.4: quality high keeps them smooth (no rfp-eco) and keeps the filters',!sr(eh).querySelector('svg.rfp-eco')&&!!sr(eh).querySelector('svg.rfp-svg'));
    eh.remove();
  }
  {
    const c=clone(BASE);c.rooms[0].floorplan={};
    const e7=mk(c);await sleep(30);
    t('an empty plan says how to fill it',/No floor plan yet/.test(sr(e7).querySelector('svg').textContent));
    e7.remove();
  }
  // ---- 3b. cross-room signals, media, markers, layers (v6.48.0) -----------------------------------
  {
    const c=clone(BASE);
    c.sections=[{id:'appl',title:'Appliances'}];
    c.rooms[2].icons=[{id:'washer',entity:'sensor.washer',icon:'mdi:washing-machine',section:'appl',tile:{active_state:'running'}}];
    const fp=c.rooms[0].floorplan;
    fp.presence=['sensor.michael_area','sensor.eva_area','sensor.nobody_area'];
    fp.rooms[0].media='media_player.tv';
    fp.rooms[3].anyvac_room='7bUI4dOp7O1qnECi7UfFW3_19';
    fp.items=[{entity:'light.desk',at:[2,2]},{type:'label',entity:'sensor.hall_t',at:[8,3],suffix:'°'},{entity:'sensor.co2',icon:'mdi:molecule-co2',show_state:true,at:[1,1]},{type:'label',text:'Balcony',at:[3,0.2]}];
    const st=states();
    Object.assign(st,{'sensor.michael_area':{state:'kitchen',attributes:{friendly_name:'Michael area'}},'sensor.eva_area':{state:'Sleep',attributes:{friendly_name:'Eva'}},
      'sensor.nobody_area':{state:'not_home',attributes:{}},'sensor.washer':{state:'running',attributes:{}},
      'media_player.tv':{state:'playing',attributes:{app_name:'Netflix',media_title:'Film'}},'light.desk':{state:'on',attributes:{}},'sensor.co2':{state:'612.4',attributes:{unit_of_measurement:'ppm'}}});
    const av=clone(DATA.anyvac);av.attributes.in_cleaning=true;av.attributes.vacuum_room_name='Kitchen';
    st['sensor.s8_anyvac_map']=av;
    const e9=mk(c,mkHass(st));await sleep(40);
    const s9=sr(e9),v9=e9._fpInst;
    const pt=i=>s9.querySelector('[data-rfp-person="'+i+'"]');
    t('presence: a token per person, in the room its sensor names (by card room)',pt(0)&&pt(0).getAttribute('opacity')==='1'&&s9.querySelector('[data-rfp-pinit="0"]').textContent==='M');
    t('presence: a state that names a plan room (not a card room) still places it',pt(1).getAttribute('opacity')==='1'&&e9._fpInst._signals().where[1].k===4);
    t('presence: nowhere → hidden',pt(2).getAttribute('opacity')==='0');
    const att=s9.querySelector('[data-rfp-att="1"]');
    t('attention: the running washing machine marks the hall',att&&att.getAttribute('opacity')==='1'&&s9.querySelector('[data-rfp-attn="1"]').textContent==='1'&&s9.querySelector('[data-rfp-att="0"]').getAttribute('opacity')==='0');
    t('vacuum: AnyVac cleaning the kitchen → the robot on the kitchen (anyvac_room)',s9.querySelector('[data-rfp-vac="3"]').getAttribute('opacity')==='1'&&s9.querySelector('[data-rfp-vac="1"]').getAttribute('opacity')==='0');
    t('media: what plays is on the living room label, the room glows',/Netflix/.test(s9.querySelector('[data-rfp-media="0"]').textContent)&&s9.querySelector('[data-rfp-mglow="0"]').getAttribute('opacity')==='1');
    const it=k=>s9.querySelector('[data-rfp-item="'+k+'"]');
    t('items: markers and labels are drawn over the plan',s9.querySelectorAll('[data-rfp-item]').length===4&&it(0).querySelector('ha-icon').getAttribute('icon')==='mdi:lightbulb');
    t('items: a light that is on lights its marker',it(0).classList.contains('is-on')&&!it(2).classList.contains('is-on'));
    t('items: a label shows the state with its suffix; a marker with show_state its value + unit',it(1).textContent==='23.6°'&&it(2).textContent==='612 ppm');
    t('items: a plain text label',it(3).textContent==='Balcony');
    // change detection: presence, media, AnyVac and markers are watched
    const rel=e9._relevantEntities;
    t('change detection watches presence, media, the vacuum map, markers and the collected tiles',['sensor.michael_area','media_player.tv','sensor.s8_anyvac_map','light.desk','sensor.co2','sensor.washer'].every(x=>rel.includes(x))&&e9._relevantAttrSources.some(a=>a.entity==='sensor.s8_anyvac_map'&&a.attr==='vacuum_room_name'));
    // updates move the tokens and badges, without a re-render
    const st2=Object.assign({},st,{'sensor.michael_area':{state:'living_room',attributes:{friendly_name:'Michael area'}},'sensor.washer':{state:'idle',attributes:{}},'light.desk':{state:'off',attributes:{}}});
    st2['sensor.s8_anyvac_map']=clone(DATA.anyvac);
    e9.hass=mkHass(st2);await sleep(20);
    t('update: the person moves, attention and the robot go away, the marker goes dark',e9._fpInst===v9&&v9._signals().where[0].k===0&&att.getAttribute('opacity')==='0'&&s9.querySelector('[data-rfp-vac="3"]').getAttribute('opacity')==='0'&&!it(0).classList.contains('is-on'));
    // tap a marker: a light toggles; a sensor opens more-info; hold → more-info
    const more=[];e9.addEventListener('hass-more-info',x=>more.push(x.detail.entityId));
    calls.length=0;
    ev(it(0),'pointerdown');ev(it(0),'pointerup');await sleep(20);
    t('tap a light marker → toggle',calls.length===1&&calls[0][2].entity_id==='light.desk'&&e9._roomIdx===0);
    ev(it(2),'pointerdown');ev(it(2),'pointerup');await sleep(20);
    t('tap a sensor marker → more-info',more[0]==='sensor.co2');
    ev(it(0),'pointerdown');await sleep(650);ev(it(0),'pointerup');await sleep(20);
    t('hold a marker → more-info',more[1]==='light.desk'&&calls.length===1);
    e9.remove();
    // layers switch parts off
    const c2=clone(c);c2.rooms[0].floorplan.layers={presence:false,items:false,attention:false,media:false,vacuum:false};
    const e10=mk(c2,mkHass(st));await sleep(30);
    const s10=sr(e10);
    t('layers: presence, markers, attention, vacuum and media off',!s10.querySelector('[data-rfp-person]')&&!s10.querySelector('[data-rfp-item]')&&!s10.querySelector('[data-rfp-att]')&&!s10.querySelector('[data-rfp-vac]')&&!s10.querySelector('[data-rfp-mglow]'));
    t('layers off → the vacuum map is not watched',!e10._relevantEntities.includes('sensor.s8_anyvac_map'));
    e10.remove();
    // presence defaults to the card's room_entity
    const c3=clone(BASE);c3.room_entity='sensor.michael_area';c3.follow_mode='manual';
    const e11=mk(c3,mkHass(st));await sleep(30);
    t('presence defaults to the card\'s room_entity',sr(e11).querySelectorAll('[data-rfp-person]').length===1);
    e11.remove();
    // tiles theme keeps the badges in the tile corner
    const c4=clone(c);c4.rooms[0].floorplan.theme='tiles';
    const e12=mk(c4,mkHass(st));await sleep(30);
    t('tiles theme: attention badge fixed in the tile',sr(e12).querySelector('[data-rfp-att="1"][data-rfp-fixed]').getAttribute('opacity')==='1');
    e12.remove();
    // ---- overview signals (opt-in) ----
    const ov=clone(c);ov.rooms.unshift({id:'ov',name:'Overview',overview:{signals:true}});ov.room_entity='sensor.michael_area';ov.follow_mode='manual';
    const e13=mk(ov,mkHass(st));await sleep(40);
    const s13=sr(e13),tile=ri=>s13.querySelector('.roc-ovt[data-ovt="'+ri+'"]');
    t('overview signals: CSS only when a page turns them on',/roc-ovt-sig/.test(s13.querySelector('style').textContent));
    t('overview signals: the presence room\'s tile is ringed',tile(5).classList.contains('roc-ovt-here')&&!tile(2).classList.contains('roc-ovt-here'));
    t('overview signals: attention and vacuum badges on their tiles',!!tile(3).querySelector('.roc-sig-att')&&!!tile(5).querySelector('.roc-sig-vac')&&!tile(2).querySelector('.roc-sig-b'));
    const st3=Object.assign({},st2);
    e13.hass=mkHass(st3);await sleep(20);
    t('overview signals: they follow the states',tile(2).classList.contains('roc-ovt-here')&&!tile(5).classList.contains('roc-ovt-here')&&!tile(3).querySelector('.roc-sig-att')&&!tile(5).querySelector('.roc-sig-vac'));
    e13.remove();
    const ov2=clone(ov);ov2.rooms[0].overview={};
    const e14=mk(ov2,mkHass(st));await sleep(40);
    t('overview without signals: no badges, no ring, no CSS (unchanged)',!sr(e14).querySelector('.roc-ovt-sig')&&!sr(e14).querySelector('.roc-ovt-here')&&!/roc-ovt-sig/.test(sr(e14).querySelector('style').textContent));
    e14.remove();
    const ov3=clone(ov);ov3.rooms[0].overview={signals:{presence:false,vacuum:false}};
    const e15=mk(ov3,mkHass(st));await sleep(40);
    t('overview signals: presence / vacuum can be left out',!sr(e15).querySelector('.roc-ovt-here')&&!sr(e15).querySelector('.roc-sig-vac')&&!!sr(e15).querySelector('.roc-sig-att'));
    e15.remove();
  }
  // ---- 3c. doors and windows (v6.49.0) -------------------------------------------------------------
  {
    const c=clone(BASE);const fp=c.rooms[0].floorplan;
    fp.openings[0].entity='binary_sensor.door0';
    fp.openings.push({type:'window',at:[2.5,0.4],width:1.2,entity:'binary_sensor.lr_window',cover:'cover.lr_blind'});
    fp.openings.push({type:'window',at:[14,0.25],cover:'cover.bed_blind',blind_type:'venetian',invert:true});
    fp.openings.push({type:'window',at:[2.6,4.55]});
    const st=Object.assign(states(),{'binary_sensor.door0':{state:'off',attributes:{device_class:'door'}},'binary_sensor.lr_window':{state:'on',attributes:{device_class:'window'}},
      'cover.lr_blind':{state:'open',attributes:{current_position:30}},'cover.bed_blind':{state:'open',attributes:{current_position:100}}});
    const e1=mk(c,mkHass(st));await sleep(40);
    const S1=sr(e1),q=(a,k)=>S1.querySelector('['+a+'="'+k+'"]'),qa=(a,k)=>[...S1.querySelectorAll('['+a+'="'+k+'"]')];
    t('windows: glass on the wall face (oblique), the open one in the open colour',q('data-rfp-glass',4).getAttribute('fill')==='#5eead4'&&q('data-rfp-glass',5).getAttribute('fill')==='#7fb6e6');
    t('windows: a front wall keeps only the sill, its edge in the glass colour',qa('data-rfp-glass',6).length===1&&q('data-rfp-glass',6).tagName.toLowerCase()==='line'&&q('data-rfp-glass',6).getAttribute('stroke')==='#7fb6e6');
    const bl=q('data-rfp-blind',4);
    t('blinds: position 30 % → the blind is 70 % down the glass',!!bl&&bl.getAttribute('points').split(' ').length===4);
    t('blinds: invert (a fully open motor = closed blind) and the venetian pattern',q('data-rfp-blind',5).getAttribute('points').split(' ').length===4&&/-ven\)$/.test(q('data-rfp-blind',5).getAttribute('fill')));
    const leaf0=q('data-rfp-leaf',0).getAttribute('points');
    t('doors: a door with a contact sensor gets a panel (closed in the gap)',!!leaf0&&leaf0.split(' ').length===4);
    t('doors: a door without a sensor stays a gap',!q('data-rfp-leaf',1));
    t('openings: tap targets only where there is something to show or do',S1.querySelectorAll('[data-rfp-open]').length===3&&!q('data-rfp-open',6));
    t('change detection: contacts and blinds (position) are watched',['binary_sensor.door0','binary_sensor.lr_window','cover.lr_blind','cover.bed_blind'].every(x=>e1._relevantEntities.includes(x))&&e1._relevantAttrSources.some(a=>a.entity==='cover.lr_blind'&&a.attr==='current_position'));
    // updates
    const st2=Object.assign({},st,{'binary_sensor.door0':{state:'on',attributes:{}},'binary_sensor.lr_window':{state:'off',attributes:{}},'cover.lr_blind':{state:'open',attributes:{current_position:100}}});
    const v1=e1._fpInst;e1.hass=mkHass(st2);await sleep(20);
    t('update: the window closes (glass colour), the blind goes up, the door swings open — no re-render',e1._fpInst===v1&&q('data-rfp-glass',4).getAttribute('fill')==='#7fb6e6'&&q('data-rfp-blind',4).getAttribute('points')===''&&q('data-rfp-leaf',0).getAttribute('points')!==leaf0);
    // actions
    const more=[];e1.addEventListener('hass-more-info',x=>more.push(x.detail.entityId));
    const ho=q('data-rfp-open',4);ev(ho,'pointerdown');ev(ho,'pointerup');await sleep(20);
    t('tap a window → its blind\'s more-info (not the room)',more[0]==='cover.lr_blind'&&e1._roomIdx===0);
    ev(ho,'pointerdown');await sleep(650);ev(ho,'pointerup');await sleep(20);
    t('hold a window → its contact sensor\'s more-info',more[1]==='binary_sensor.lr_window');
    const hd=q('data-rfp-open',0);ev(hd,'pointerdown');ev(hd,'pointerup');await sleep(20);
    t('tap a door → its sensor',more[2]==='binary_sensor.door0'&&e1._roomIdx===0);
    e1.remove();
    // top view (blueprint): frame + pane, blind line, door leaf and arc
    const c2=clone(c);c2.rooms[0].floorplan.theme='blueprint';
    const e2=mk(c2,mkHass(st));await sleep(40);
    const S2=sr(e2),q2=(a,k)=>S2.querySelector('['+a+'="'+k+'"]');
    t('top view: the open window\'s pane shows, glass in the open colour',q2('data-rfp-pane',4).getAttribute('opacity')==='1'&&q2('data-rfp-glass',4).getAttribute('stroke')==='#ffd166');
    t('top view: the blind on the room side, stronger the more it is down',Math.abs(parseFloat(q2('data-rfp-blind',4).getAttribute('opacity'))-(0.3+0.7*0.7))<0.01&&q2('data-rfp-blind',5).getAttribute('stroke-dasharray')==='0.03 0.025');
    const l0=q2('data-rfp-leaf',0);
    t('top view: a closed door — the leaf lies in the gap, its arc is hidden',l0&&q2('data-rfp-arc',0).getAttribute('opacity')==='0'&&Math.abs(parseFloat(l0.getAttribute('x2'))-parseFloat(l0.getAttribute('x1')))+Math.abs(parseFloat(l0.getAttribute('y2'))-parseFloat(l0.getAttribute('y1')))>0.7);
    t('top view: a door without a sensor keeps its arc',[...S2.querySelectorAll('svg path')].filter(p=>/^M[^A]+A0\.(8|75) /.test(p.getAttribute('d')||'')&&!p.hasAttribute('data-rfp-arc')).length===3);
    e2.remove();
    // mirror / outward move the hinge / the swing
    const c3=clone(c2);c3.rooms[0].floorplan.openings[0].mirror=true;c3.rooms[0].floorplan.openings[0].outward=true;
    const st3=Object.assign({},st,{'binary_sensor.door0':{state:'on',attributes:{}}});
    const e3=mk(c3,mkHass(st3));await sleep(30);
    const e3b=mk(c2,mkHass(st3));await sleep(30);
    const lf=e=>{const l=sr(e).querySelector('[data-rfp-leaf="0"]');return[l.getAttribute('x1'),l.getAttribute('y1'),l.getAttribute('x2'),l.getAttribute('y2')].join();};
    t('mirror + outward: another hinge and the other side',lf(e3)!==lf(e3b));
    e3.remove();e3b.remove();
    // a theme override of the window colours
    const c4=clone(c);c4.rooms[0].floorplan.overrides={'win.glass':'#123456'};
    const e4=mk(c4,mkHass(st2));await sleep(30);
    t('overrides: win.glass',sr(e4).querySelector('[data-rfp-glass="4"]').getAttribute('fill')==='#123456');
    e4.remove();
    // the openings layer off: plain windows, no state, nothing watched
    const c5=clone(c);c5.rooms[0].floorplan.layers={openings:false};
    const e5=mk(c5,mkHass(st));await sleep(30);
    t('layers.openings off: windows drawn plain, no blinds / leaves / targets, not watched',!!sr(e5).querySelector('[data-rfp-glass="4"]')&&!sr(e5).querySelector('[data-rfp-blind],[data-rfp-leaf],[data-rfp-open]')&&!e5._relevantEntities.includes('cover.lr_blind'));
    e5.remove();
  }
  // ---- 3d. the vacuum on the plan, mirror (v6.49.0) ------------------------------------------------
  {
    const c=clone(BASE);const fp=c.rooms[0].floorplan;fp.theme='blueprint';
    fp.source={anyvac:'sensor.s8_anyvac_map',frame:'d4e87578-c982-4eb4-8ae1-a2e0c5be2547',origin_px:[800,752],mm_per_px:12.5};
    const av=clone(DATA.anyvac);
    av.attributes.home_frame=Object.assign({},av.attributes.home_frame,{id:'d4e87578-c982-4eb4-8ae1-a2e0c5be2547'});
    Object.assign(av.attributes,{vacuum_position_home_px:{x:1200,y:900,a:0},in_cleaning:true,vacuum_room_name:'Living room',path_wet_home_px:[[{x:900,y:800},{x:1000,y:800},{x:1000,y:900}]],path_dry_home_px:[]});
    const st=Object.assign(states(),{'sensor.s8_anyvac_map':av});
    const e1=mk(c,mkHass(st));await sleep(40);
    const S1=sr(e1),v=e1._fpInst,rb=S1.querySelector('[data-rfp-robot="0"]');
    const want=F.geom.P(v.F,5,1.85,0.03);
    const m=/translate\(([-\d.]+)px, *([-\d.]+)px\)/.exec(rb&&rb.style.transform||'');
    t('robot: at its home-frame position converted to plan metres',!!m&&Math.abs(+m[1]-want[0])<0.05&&Math.abs(+m[2]-want[1])<0.05&&rb.getAttribute('opacity')==='1');
    t('robot: heading 0° → facing right (top view)',S1.querySelector('[data-rfp-rhead="0"]').getAttribute('transform')==='rotate(0)');
    t('robot: cleaning → ping ring and the mop\'s trail (plan metres)',S1.querySelector('[data-rfp-rping="0"]').getAttribute('opacity')==='1'&&/^M1\.25 0\.6L2\.5 0\.6L2\.5 1\.85$/.test(S1.querySelector('[data-rfp-trail] path').getAttribute('d')));
    t('change detection: the robot\'s position and trail',['vacuum_position_home_px','path_wet_home_px'].every(x=>e1._relevantAttrSources.some(a=>a.entity==='sensor.s8_anyvac_map'&&a.attr===x)));
    const av2=clone(av);Object.assign(av2.attributes,{vacuum_position_home_px:{x:1300,y:900,a:90},in_cleaning:false});
    e1.hass=mkHass(Object.assign({},st,{'sensor.s8_anyvac_map':av2}));await sleep(20);
    t('update: the robot moves and turns, docked → no ring; the last run\'s trail stays (like AnyVac); no re-render',e1._fpInst===v&&S1.querySelector('[data-rfp-rhead="0"]').getAttribute('transform')==='rotate(90)'&&S1.querySelector('[data-rfp-rping="0"]').getAttribute('opacity')==='0'&&!!S1.querySelector('[data-rfp-trail] path')&&rb.getAttribute('opacity')==='0.85');
    const av2b=clone(av2);av2b.attributes.view_layers={dry:true,wet:false};
    e1.hass=mkHass(Object.assign({},st,{'sensor.s8_anyvac_map':av2b}));await sleep(20);
    t('trail: AnyVac\'s shared wet / dry toggles apply',!S1.querySelector('[data-rfp-trail] path'));
    const cT=clone(c);cT.rooms[0].floorplan.trail_mode='cleaning';
    const eT=mk(cT,mkHass(Object.assign({},st,{'sensor.s8_anyvac_map':av2})));await sleep(30);
    t('trail_mode: cleaning — no trail once the vacuum is back',!sr(eT).querySelector('[data-rfp-trail] path'));
    eT.hass=mkHass(st);await sleep(20);
    t('trail_mode: cleaning — the trail while it cleans',!!sr(eT).querySelector('[data-rfp-trail] path'));
    eT.remove();
    e1.remove();
    const c2=clone(c);c2.rooms[0].floorplan.source.frame='another-frame';
    const e2=mk(c2,mkHass(st));await sleep(30);
    t('robot: a map in another home frame is not drawn',!sr(e2).querySelector('[data-rfp-robot]'));
    e2.remove();
    const c3=clone(c);c3.rooms[0].floorplan.layers={vacuum:false};
    const e3=mk(c3,mkHass(st));await sleep(30);
    t('robot: the vacuum layer off hides it',!sr(e3).querySelector('[data-rfp-robot]')&&!sr(e3).querySelector('[data-rfp-trail]'));
    e3.remove();
    const e4=mk(BASE,mkHass(st));await sleep(30);
    t('robot: a plan without an AnyVac source has none',!sr(e4).querySelector('[data-rfp-robot]'));
    const F0=e4._fpInst.F;
    e4.remove();
    {// 7.0.0-beta.4: wall joints — no square caps sticking out; a full wall that meets a cut-away one ends in a post
      const ci=clone(BASE);ci.rooms[0].floorplan.projection='iso';ci.rooms[0].floorplan.theme='night';
      const ei=mk(ci,mkHass(st));await sleep(30);
      const svg=ei._fpInst.svg.innerHTML,top=ei._fpInst.T.wall.top;
      const tops=[...svg.matchAll(/<line [^>]*stroke="([^"]+)"[^>]*stroke-linecap="(\w+)"/g)].filter(m=>m[1]===top);
      t('walls (iso): every top edge ends flush (no square caps)',tops.length>0&&tops.every(m=>m[2]==='butt'));
      const posts=[...svg.matchAll(/<line x1="([\d.-]+)" y1="[\d.-]+" x2="([\d.-]+)" y2="[\d.-]+" stroke="([^"]+)"/g)].filter(m=>m[3]===top&&m[1]===m[2]);
      t('walls (iso): a full wall meeting a cut-away one shows its end (a post)',posts.length>0);
      ei.remove();}
    const c5=clone(BASE);c5.rooms[0].floorplan.mirror='horizontal';c5.rooms[0].floorplan.theme='blueprint';
    const e5=mk(c5,mkHass(st));await sleep(30);
    const F5=e5._fpInst.F,Pg=F.geom.P;
    t('mirror horizontal: the living room ends up on the right, the plan still fits',Pg(F5,1,1,0)[0]>Pg(F5,14,1,0)[0]&&Pg(F0,1,1,0)[0]<Pg(F0,14,1,0)[0]);
    const back=F.geom.inv(F5,...Pg(F5,3.2,1.7,0));
    {const cr=clone(c5);delete cr.rooms[0].floorplan.mirror;cr.rooms[0].floorplan.rotate={landscape:0,portrait:90};const er=mk(cr,mkHass(st));await sleep(30);
      const rl=er._fpInst.rot;er._fpInst.o.profile='portrait';er._fpInst.render();
      t('rotate per layout profile: landscape 0°, portrait 90°',rl===0&&er._fpInst.rot===90);er.remove();}
    {const cb=clone(c5);cb.rooms[0].floorplan.mirror='both';const eb=mk(cb,mkHass(st));await sleep(30);const Fb=eb._fpInst.F;
      t('mirror both: left ↔ right and top ↔ bottom',Pg(Fb,1,1,0)[0]>Pg(Fb,14,1,0)[0]&&Pg(Fb,1,1,0)[1]>Pg(Fb,1,4,0)[1]);eb.remove();}
    t('mirror: screen → plan still inverts (the studio edits a mirrored plan)',Math.abs(back[0]-3.2)<1e-6&&Math.abs(back[1]-1.7)<1e-6);
    e5.remove();
  }
  // ---- 3e. floor covering per room (v6.49.0) ---------------------------------------------------------
  {
    const c=clone(BASE);const r3=c.rooms[0].floorplan.rooms[3];r3.floor='vinyl';r3.floor_color='#7a5a43';c.rooms[0].floorplan.rooms[2].floor='vinyl';
    const e1=mk(c);await sleep(30);const S1=sr(e1),id=e1._fpInst.uid;
    const own=S1.querySelector('pattern[id="'+id+'-f3"]');
    t('floor_color: the room gets its own pattern of its material in its colour',!!own&&own.querySelector('rect').getAttribute('fill')==='#7a5a43'&&own.getAttribute('width')==='1.2');
    const fills=[...S1.querySelectorAll('g[transform^="matrix"] > polygon')].map(p=>p.getAttribute('fill'));
    t('vinyl: the theme\'s vinyl pattern; floor_color: the room\'s own',fills.includes('url(#'+id+'-vinyl)')&&fills.includes('url(#'+id+'-f3)'));
    e1.remove();
    const c2=clone(c);c2.rooms[0].floorplan.theme='neon';
    const e2=mk(c2);await sleep(30);
    t('neon: floor_color is the room\'s flat colour',[...sr(e2).querySelectorAll('polygon')].some(p=>p.getAttribute('fill')==='#7a5a43'));
    e2.remove();
    const c3=clone(c);c3.rooms[0].floorplan.rooms[3].floor_color='red;stroke:url(x)';
    const e3=mk(c3);await sleep(30);
    t('floor_color: anything that is not a colour is ignored',!sr(e3).querySelector('pattern[id$="-f3"]'));
    e3.remove();
  }
  // ---- 3f. v6.50.0: vacuums from other frames, cleaning layer, background ----------------------------
  {
    const c=clone(BASE);const fp=c.rooms[0].floorplan;fp.theme='blueprint';
    fp.source={anyvac:'sensor.s8_anyvac_map',frame:'d4e8',origin_px:[800,752],mm_per_px:12.5};
    fp.rooms[3].anyvac_room='7bUI4dOp7O1qnECi7UfFW3_19';
    fp.vacuums=['sensor.s8_anyvac_map',{entity:'sensor.s7_anyvac_map',transform:{rotation:90,x:1,y:2}}];
    fp.layers={cleaning:true};
    const av=clone(DATA.anyvac);
    const now=Date.now(),iso=ms=>new Date(now-ms).toISOString();
    av.attributes.rooms.forEach(r=>{if(r.name==='Kitchen'){r.last_dry=iso(2*3600e3);r.last_wet=iso(3*86400e3);}});
    Object.assign(av.attributes,{vacuum_position_home_px:{x:1200,y:900,a:0},in_cleaning:false,path_points:100});
    const s7={state:'ok',attributes:{schema_version:3,home_frame:{id:'other',cell_mm:50,scale:4},rooms:[],vacuum_position_home_px:{x:100,y:200,a:0},in_cleaning:false}};
    const s6={state:'ok',attributes:{schema_version:3,home_frame:{id:'d4e8',cell_mm:50,scale:4},rooms:[],vacuum_position_home_px:{x:900,y:800,a:0}}};
    const st=Object.assign(states(),{'sensor.s8_anyvac_map':av,'sensor.s7_anyvac_map':s7,'sensor.s6_anyvac_map':s6});
    w.confirm=()=>true;
    const e1=mk(c,mkHass(st));await sleep(40);
    const S1=sr(e1),v=e1._fpInst;
    t('vacuums: only the listed ones (s6 shares the frame but is not listed)',S1.querySelectorAll('[data-rfp-robot]').length===2&&v._robots().join()==='sensor.s8_anyvac_map,sensor.s7_anyvac_map');
    const r1=S1.querySelector('[data-rfp-robot="1"]'),m=/translate\(([-\d.]+)px, *([-\d.]+)px\)/.exec(r1.style.transform),want=F.geom.P(v.F,-1.5,3.25,0.03);
    t('vacuums: another frame through its transform (rotation + shift), heading turned with it',Math.abs(+m[1]-want[0])<0.05&&Math.abs(+m[2]-want[1])<0.05&&S1.querySelector('[data-rfp-rhead="1"]').getAttribute('transform')==='rotate(90)');
    const cl=S1.querySelector('[data-rfp-clean="3"]');
    t('cleaning layer: when the room was last vacuumed / mopped',!!cl&&cl.textContent==='vacuumed 2 h · mopped 3 d'&&!S1.querySelector('[data-rfp-clean="0"]'));
    const btn=S1.querySelector('[data-rfp-cleanbtn="3"]');
    t('cleaning layer: a clean button next to the label',!!btn&&btn.style.left!=='-100px');
    calls.length=0;ev(btn,'pointerdown');ev(btn,'pointerup');await sleep(20);
    t('clean button: asks first in the card\'s own dialog, nothing runs yet',calls.length===0&&!!e1.shadowRoot.querySelector('.roc-confirm'));
    {const y=e1.shadowRoot.querySelector('.roc-confirm [data-yes]');if(y)y.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));}await sleep(20);
    t('clean button → anyvac.clean with the room\'s name on the map (after a confirmation)',calls.length===1&&calls[0][0]==='anyvac'&&calls[0][1]==='clean'&&JSON.stringify(calls[0][2])==='{"rooms":["Kitchen"],"mode":"dry"}'&&e1._roomIdx===0);
    // AnyVac's live update while cleaning: position and progress
    const av2=clone(av);av2.attributes.in_cleaning=true;av2.attributes.live={base_points:100,seq:4,pos_home_px:{x:1300,y:900,a:0},dry_home_px:[],wet_home_px:[[{x:1300,y:900},{x:1320,y:900}]]};
    av2.attributes.rooms.forEach(r=>{if(r.name==='Kitchen')r.progress_pct=45;});
    e1.hass=mkHass(Object.assign({},st,{'sensor.s8_anyvac_map':av2}));await sleep(20);
    const r0=S1.querySelector('[data-rfp-robot="0"]'),m0=/translate\(([-\d.]+)px/.exec(r0.style.transform);
    t('live: the 3-second position wins while it belongs to the snapshot',Math.abs(+m0[1]-F.geom.P(v.F,6.25,1.85,0.03)[0])<0.05&&cl.textContent==='cleaning 45 %'&&!!S1.querySelector('[data-rfp-trail] path'));
    const av3=clone(av2);av3.attributes.live.base_points=99;
    e1.hass=mkHass(Object.assign({},st,{'sensor.s8_anyvac_map':av3}));await sleep(20);
    t('live: a stale live update (another snapshot) is ignored',Math.abs(+/translate\(([-\d.]+)px/.exec(r0.style.transform)[1]-F.geom.P(v.F,5,1.85,0.03)[0])<0.05);
    t('change detection: AnyVac live and rooms',['live','rooms'].every(x=>e1._relevantAttrSources.some(a=>a.entity==='sensor.s8_anyvac_map'&&a.attr===x))&&!e1._relevantEntities.includes('sensor.s6_anyvac_map'));
    e1.remove();
    // attention only from the listed sections
    const c2=clone(BASE);c2.sections=[{id:'appl'},{id:'other'}];
    c2.rooms[2].icons=[{id:'washer',entity:'sensor.washer',icon:'mdi:washing-machine',section:'appl',tile:{active_state:'running'}},{id:'tv',entity:'sensor.tv',section:'other',tile:{active_state:'on'}}];
    c2.rooms[0].floorplan.attention_sections=['other'];
    const e2=mk(c2,mkHass(Object.assign(states(),{'sensor.washer':{state:'running',attributes:{}},'sensor.tv':{state:'on',attributes:{}}})));await sleep(30);
    t('attention_sections: only the listed sections count',sr(e2).querySelector('[data-rfp-attn="1"]').textContent==='1');
    e2.remove();
    // a label moved by hand (label_at)
    const c4=clone(BASE);c4.rooms[0].floorplan.theme='blueprint';c4.rooms[0].floorplan.rooms[0].label_at=[2,3];
    const e4=mk(c4);await sleep(30);
    const lg=sr(e4).querySelector('[data-rfp-label="0"]'),want4=F.geom.P(e4._fpInst.F,2,3,0),m4=/translate\(([-\d.]+),([-\d.]+)\)/.exec(lg.getAttribute('transform'));
    t('label_at: the label sits where it was dragged',!!m4&&Math.abs(+m4[1]-want4[0])<0.02&&Math.abs(+m4[2]-want4[1])<0.02);
    e4.remove();
    // the photo background
    const c3=clone(BASE);c3.rooms[0].floorplan.background={image:'/local/x.png',x:1,y:2,scale:0.01,width_px:500,height_px:300,rotation:5,opacity:0.8};
    const e3=mk(c3);await sleep(30);
    const im=sr(e3).querySelector('image[data-rfp-bg]');
    t('background: the image in plan metres, turned, under the plan; the floors give way to it',!!im&&im.getAttribute('width')==='5'&&im.getAttribute('height')==='3'&&im.getAttribute('transform')==='rotate(5 1 2)'
      &&![...sr(e3).querySelectorAll('polygon')].some(p=>/^url\(#.*-(wood|vinyl|tile|carpet|concrete)\)$/.test(p.getAttribute('fill')||'')));
    e3.remove();
  }
  // ---- 3g. v6.51.0: vacuum colours ------------------------------------------------------------------
  {
    const c=clone(BASE);const fp=c.rooms[0].floorplan;fp.theme='night';
    fp.source={anyvac:'sensor.s8_anyvac_map',frame:'d4e8',origin_px:[800,752],mm_per_px:12.5};
    const av=clone(DATA.anyvac);
    Object.assign(av.attributes,{vacuum_position_home_px:{x:1200,y:900,a:0},in_cleaning:true,vacuum_room_name:'Kitchen',path_points:3,
      path_wet_home_px:[[{x:900,y:800},{x:1000,y:800}]],path_dry_home_px:[[{x:900,y:820},{x:1000,y:820}]]});
    const s7={state:'ok',attributes:{schema_version:3,home_frame:{id:'other',cell_mm:50,scale:4},rooms:[],vacuum_position_home_px:{x:100,y:200,a:0},in_cleaning:true,
      path_wet_home_px:[[{x:100,y:200},{x:150,y:200}]],path_dry_home_px:[]}};
    const st=Object.assign(states(),{'sensor.s8_anyvac_map':av,'sensor.s7_anyvac_map':s7});
    fp.vacuums=['sensor.s8_anyvac_map',{entity:'sensor.s7_anyvac_map',transform:{rotation:0,x:1,y:1}}];
    const e1=mk(c,mkHass(st));await sleep(40);const S1=sr(e1);
    const ring=i=>S1.querySelector('[data-rfp-rhead="'+i+'"] circle').getAttribute('stroke');
    t('colours: two vacuums get two palette colours (robot ring)',ring(0)==='#03a9f4'&&ring(1)==='#f59e0b');
    t('colours: each trail in its vacuum\'s colour',S1.querySelector('[data-rfp-dry="sensor.s8_anyvac_map"]').getAttribute('stroke')==='#03a9f4'&&S1.querySelector('[data-rfp-wet="sensor.s7_anyvac_map"]').getAttribute('stroke')==='#f59e0b');
    t('colours: the room badge in the cleaning vacuum\'s colour',S1.querySelector('[data-rfp-vac="3"] circle').getAttribute('fill')==='#03a9f4');
    e1.remove();
    const c2=clone(c);c2.rooms[0].floorplan.vacuums=[{entity:'sensor.s8_anyvac_map',color:'#e11d48',mop_color:'#facc15',mop_opacity:0.4}];
    const e2=mk(c2,mkHass(st));await sleep(40);const S2=sr(e2);
    const wet=S2.querySelector('[data-rfp-wet="sensor.s8_anyvac_map"]');
    t('colours: color and mop_color / mop_opacity per vacuum',S2.querySelector('[data-rfp-rhead="0"] circle').getAttribute('stroke')==='#e11d48'&&S2.querySelector('[data-rfp-dry="sensor.s8_anyvac_map"]').getAttribute('stroke')==='#e11d48'&&wet.getAttribute('stroke')==='#facc15'&&wet.getAttribute('stroke-opacity')==='0.4');
    e2.remove();
    const c3=clone(c);c3.rooms[0].floorplan.vacuums=['sensor.s8_anyvac_map'];c3.rooms[0].floorplan.overrides={'vac.wet':'#ffffff','vac.wetOpacity':0.1};
    const e3=mk(c3,mkHass(st));await sleep(40);const w3=sr(e3).querySelector('[data-rfp-wet="sensor.s8_anyvac_map"]');
    t('colours: one vacuum → the theme\'s mop colour, overridable (vac.wet, vac.wetOpacity)',w3.getAttribute('stroke')==='#ffffff'&&w3.getAttribute('stroke-opacity')==='0.1');
    e3.remove();
    const c4=clone(c3);delete c4.rooms[0].floorplan.overrides;
    const e4=mk(c4,mkHass(st));await sleep(40);
    t('colours: the night theme\'s mop band is light blue (reads as water on wood)',sr(e4).querySelector('[data-rfp-wet="sensor.s8_anyvac_map"]').getAttribute('stroke')==='#7dd3fc');
    // 7.0.0-beta.3: the band lies on an underlay in the theme's background, drawn first
    const tg4=sr(e4).querySelector('[data-rfp-trail]'),u4=tg4.querySelector('[data-rfp-wetu="sensor.s8_anyvac_map"]'),b4=tg4.querySelector('[data-rfp-wet="sensor.s8_anyvac_map"]');
    t('colours: the mop band keeps its hue — an underlay in the theme background under it, the band stronger',!!u4&&u4.getAttribute('stroke')==='#0b0e12'&&u4.getAttribute('stroke-opacity')==='0.55'
      &&b4.getAttribute('stroke-opacity')==='0.45'&&[...tg4.children].indexOf(u4)<[...tg4.children].indexOf(b4));
    e4.remove();
    // 7.0.0-beta.3: a vacuum whose map sensor shows up after the plan was drawn keeps its own colour
    const stA=Object.assign({},st);delete stA['sensor.s8_anyvac_map'];
    const e5=mk(c,mkHass(stA));await sleep(40);const S5=sr(e5),v5=e5._fpInst;
    t('robots: drawn for the vacuums there are (s8 not loaded yet)',S5.querySelectorAll('[data-rfp-robot]').length===1);
    e5.hass=mkHass(st);await sleep(30);
    const ring5=i=>S5.querySelector('[data-rfp-rhead="'+i+'"] circle').getAttribute('stroke');
    t('robots: a vacuum that appears later is added and every robot keeps its own colour (was: the colour of the robot before it)',e5._fpInst===v5&&S5.querySelectorAll('[data-rfp-robot]').length===2
      &&v5._robots().every((id,i)=>ring5(i)===v5._vacColors(id).robot)&&ring5(1)==='#f59e0b');
    const r5=S5.querySelector('[data-rfp-robot="0"]'),m5=/translate\(([-\d.]+)px, *([-\d.]+)px\)/.exec(r5.style.transform),want5=F.geom.P(v5.F,...v5._toPlan({x:1200,y:900},'sensor.s8_anyvac_map'),0.03);
    t('robots: …and sits where its own map says',!!m5&&Math.abs(+m5[1]-want5[0])<0.05&&Math.abs(+m5[2]-want5[1])<0.05);
    e5.remove();
    // 7.0.0-beta.3: a small room (compact label) shows when it was cleaned too, and gets a clean button
    const c6=clone(c);c6.rooms[0].floorplan.layers={cleaning:true};
    const e6a=mk(c6,mkHass(st));await sleep(40);
    const kc=e6a._fpInst.M.rooms.findIndex(r=>r.compact);e6a.remove();
    if(kc<0)t('compact room present in the test plan',false);
    else{
      c6.rooms[0].floorplan.rooms[kc].anyvac_room='7bUI4dOp7O1qnECi7UfFW3_19';
      const av6=clone(av);av6.attributes.rooms.forEach(r=>{if(r.name==='Kitchen'){r.last_dry=new Date(Date.now()-2*3600e3).toISOString();r.last_wet=new Date(Date.now()-3*86400e3).toISOString();}});
      const e6=mk(c6,mkHass(Object.assign({},st,{'sensor.s8_anyvac_map':av6})));await sleep(40);
      const cl6=sr(e6).querySelector('[data-rfp-clean="'+kc+'"]'),ch6=sr(e6).querySelector('[data-rfp-chip="'+kc+'"]');
      t('cleaning layer: a compact label gets the "vacuumed … · mopped …" line under it, its chip grows',!!cl6&&/vacuumed 2 h/.test(cl6.textContent)&&+ch6.getAttribute('height')>e6._fpInst.fs*2.2);
      t('cleaning layer: …and a clean button',!!sr(e6).querySelector('[data-rfp-cleanbtn]'));
      e6.remove();
    }
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
  // v6.49.0: a new opening's sensors from the room's area; re-proposed doors keep windows and nearby old doors
  {
    const h2={states:{'binary_sensor.lr_win':{state:'off',attributes:{device_class:'window'}},'binary_sensor.lr_win2':{state:'off',attributes:{device_class:'window'}},
        'binary_sensor.lr_door':{state:'off',attributes:{device_class:'door'}},'cover.lr_roller':{state:'closed',attributes:{current_position:0}},'cover.k_roller':{state:'closed',attributes:{}}},
      areas:{living_room:{name:'Living Room'},kitchen:{name:'Kitchen'}},
      entities:{'binary_sensor.lr_win':{area_id:'living_room'},'binary_sensor.lr_win2':{area_id:'living_room'},'binary_sensor.lr_door':{area_id:'living_room'},'cover.lr_roller':{area_id:'living_room'},'cover.k_roller':{area_id:'kitchen'}}};
    const fp2={rooms:[{room:'living_room',polygon:C0.Living},{name:'Kitchen',polygon:C0.Kitchen}],openings:[{type:'window',at:[1,0.4],entity:'binary_sensor.lr_win'}]};
    const g1=ST.fpOpeningGuess(h2,card,fp2,0,'window');
    t('a new window: the area\'s next unused window contact and its blind',g1.entity==='binary_sensor.lr_win2'&&g1.cover==='cover.lr_roller');
    t('a new door: no guess (appliance doors are device_class door too)',JSON.stringify(ST.fpOpeningGuess(h2,card,fp2,0,'door'))==='{}');
    t('a plan-only room matches its area by name',ST.fpOpeningGuess(h2,card,fp2,1,'window').cover==='cover.k_roller');
    const old=[{type:'door',at:[5.95,2.1],width:0.9,entity:'binary_sensor.lr_door',mirror:true},{type:'door',at:[20,20]},{type:'window',at:[1,0.4],cover:'cover.lr_roller'}];
    const m=ST.fpMergeDoors(G,[{at:[5.98,2.25],width:0.8},{at:[8.65,2.3],width:0.8}],old);
    t('re-proposed doors: an old door nearby is kept (sensor, mirror), a far one goes, windows stay',m.length===3&&m[0].entity==='binary_sensor.lr_door'&&m[0].mirror===true&&m[1].at.join()==='8.65,2.3'&&m[2].type==='window');
    const prevW=clone(fp);prevW.openings.push({type:'window',at:[2,0.4],cover:'cover.x'});
    const reW=ST.fpImport(G,hass,card,'sensor.s8_anyvac_map',DATA.anyvac,{},prevW);
    t('re-import with doors: windows stay',reW.openings.filter(o=>o.type==='window').length===1&&reW.openings.filter(o=>o.type!=='window').length===4);
  }
  // v6.50.0: aligning another vacuum's frame by the rooms both maps share; the background's place
  {
    const src={anyvac:'sensor.s8_anyvac_map',frame:'d4e8',origin_px:[800,752],mm_per_px:12.5};
    const rot=p=>[-p[1]+3000,p[0]+500]; // the other map: turned 90° and shifted (home px)
    const other=clone(DATA.anyvac);other.attributes.home_frame={id:'zz',cell_mm:50,scale:4};
    other.attributes.rooms.forEach(r=>{if(r.outline_home_px)r.outline_home_px=r.outline_home_px.map(rot);if(r.bbox_home_px){const b=r.bbox_home_px,a=rot([b.x0,b.y0]),c=rot([b.x1,b.y1]);r.bbox_home_px={x0:Math.min(a[0],c[0]),y0:Math.min(a[1],c[1]),x1:Math.max(a[0],c[0]),y1:Math.max(a[1],c[1])};}});
    const hz={states:{'sensor.s8_anyvac_map':DATA.anyvac,'sensor.zz_anyvac_map':other}};
    // 7.4.0: fitted to the plan's own rooms (here: the source map's outlines in metres, by name)
    const planRooms=DATA.anyvac.attributes.rooms.map(r=>({name:r.name,polygon:r.outline_home_px.map(p=>[(p[0]-800)*0.0125,(p[1]-752)*0.0125])}));
    const fit=ST.fpVacuumFit(G,hz,{source:src,rooms:planRooms},'sensor.zz_anyvac_map');
    const T0=fit.transform,th=T0.rotation*Math.PI/180,k=0.0125;
    const map=p=>{const q=[p[0]*k,p[1]*k];return[Math.cos(th)*q[0]-Math.sin(th)*q[1]+T0.x,Math.sin(th)*q[0]+Math.cos(th)*q[1]+T0.y];};
    const back=map(rot([1600,1000]));
    t('vacuum fit: another frame (turned 90°) is found by its 5 rooms, ± 0, and remembers the frame',T0.rooms===5&&T0.rms<0.02&&T0.frame==='zz'&&Math.abs(Math.abs(T0.rotation)-90)<0.5&&Math.abs(back[0]-10)<0.05&&Math.abs(back[1]-3.1)<0.05);
    t('vacuum fit: the plan\'s own frame needs none; a plan without rooms cannot align',ST.fpVacuumFit(G,hz,{source:src,rooms:planRooms},'sensor.s8_anyvac_map').same===true&&ST.fpVacuumFit(G,hz,{},'sensor.zz_anyvac_map').err==='few');
    const one=clone(other);one.attributes.rooms=one.attributes.rooms.slice(0,1);
    t('vacuum fit: one shared room is not enough',ST.fpVacuumFit(G,{states:{'sensor.s8_anyvac_map':DATA.anyvac,'sensor.zz_anyvac_map':one}},{source:src,rooms:planRooms},'sensor.zz_anyvac_map').err==='few');
    const bg=ST.fpSnapshotBg({source:src},{path:'/local/anyvac/room_card_plan.png?t=1',frame_id:'d4e8',crop:{x0:780,y0:732,x1:2100,y1:1150},fiducials:[{id:'tl'}]});
    t('snapshot: the crop box in home px is the background\'s place in metres',bg.x===-0.25&&bg.y===-0.25&&bg.scale===0.0125&&bg.width_px===1320&&bg.height_px===418&&bg.fiducials.length===1&&bg.frame==='d4e8');
    const an=[{home_px:{x:800,y:752},floor_pct:{x:10,y:10}},{home_px:{x:1600,y:752},floor_pct:{x:90,y:10}},{home_px:{x:800,y:1152},floor_pct:{x:10,y:90}}];
    const af=ST.fpAnchorFit({source:src},an,1000,500);
    t('markers: anchors → scale, rotation and place of the edited image',Math.abs(af.scale-0.0125)<1e-9&&Math.abs(af.rotation)<0.01&&Math.abs(af.x+1.25)<0.01&&Math.abs(af.y+0.625)<0.01);
  }
  // ---- floor heating loops and feeds (7.1.0, HEATING_PLAN.md) -----------------------------------
  {
    const G=C._rocFloorplan.geom;
    const A=[[0,0],[4,0],[4,3],[0,3]],B=[[0,3],[4,3],[4,6],[0,6]],Cr=[[4.1,0],[6,0],[6,3],[4.1,3]];
    const f=G.maxRect(A,0.25);
    t('loop field: the biggest rectangle 25 cm off the walls',f&&Math.abs(f[0]-0.25)<0.051&&Math.abs(f[2]-3.75)<0.051&&Math.abs(f[3]-2.75)<0.051);
    const sp=G.spiralIn(3,2,0.4);
    t('spiral: runs inwards and stays in its box',sp.length>8&&sp.every(q=>q[0]>=-1e-9&&q[0]<=3+1e-9&&q[1]>=-1e-9&&q[1]<=2+1e-9));
    const loops=[{k:0,poly:A},{k:1,poly:B}];
    const c0=G.heatCircuits([A,B,Cr],loops,{pitch:0.2,manifold:[1,1],passes:[]});
    const byK=k=>c0.find(c=>c.k===k);
    t('feeds: the manifold\'s own room is reached, a room behind a wall without a pass is not',byK(0).routed&&!byK(0).missing&&byK(1).missing&&!byK(1).routed);
    t('feeds: a loop without a feed still has its supply and return',byK(1).sup.length>4&&byK(1).ret.length>4);
    const c1=G.heatCircuits([A,B,Cr],loops,{pitch:0.2,manifold:[1,1],passes:[[2,3]]});
    const r1=c1.find(c=>c.k===1);
    t('feeds: a pass in the wall opens the way — the pipe crosses the wall at the pass',r1.routed&&!r1.missing);
    const seg=[];for(let i=1;i<r1.sup.length;i++){const a=r1.sup[i-1],b=r1.sup[i];if((a[1]-3)*(b[1]-3)<=0&&a[1]!==b[1])seg.push(a[0]);}
    t('feeds: …within 35 cm of the pass',seg.length>0&&seg.every(x=>Math.abs(x-2)<=0.35+0.15));
    t('feeds: supply starts and return ends at the manifold',Math.hypot(r1.sup[0][0]-1,r1.sup[0][1]-1)<0.2&&Math.hypot(r1.ret[r1.ret.length-1][0]-1,r1.ret[r1.ret.length-1][1]-1)<0.2);
    const c2=G.heatCircuits([A,B,Cr],loops,{pitch:0.2});
    t('no manifold → loops only, no routing',c2.length===2&&c2.every(c=>!c.routed&&!c.missing));
    // the page: power, pause, loop: false, the manifold
    const c=clone(BASE);const fp=c.rooms[0].floorplan;
    fp.heating={manifold:[C0.Living[0][0]+1,C0.Living[0][1]+1],passes:[{at:[5.98,2.25]}],pitch:0.25};
    fp.rooms[4].loop=false;
    const h=mkHass();
    h.states['climate.living']={state:'heat',attributes:{hvac_action:'heating',current_temperature:23.1,power_percent:40}};
    h.states['climate.kitchen']={state:'off',attributes:{hvac_action:'off',current_temperature:22.6,requested_state:{hvac_mode:'heat'}}};
    const e=mk(c,h);await sleep(30);const S=sr(e);
    const X=k=>S.querySelector('[data-rfp-hx="'+k+'"]');
    t('loop: false → that room gets no loop',!!X(0)&&!!X(3)&&!X(4));
    t('power 40 %: flow runs, glow at 0.08 + 0.42 × 0.4',X(0).classList.contains('is-flow')&&Math.abs(parseFloat(X(0).querySelector('.rfp-hglow').style.opacity)-0.248)<1e-6&&X(0).style.getPropertyValue('--rfp-hs')==='2.64s');
    t('off with a standing heat request (VTherm central mode) → paused, not off',X(3).classList.contains('is-pause')&&!X(3).classList.contains('is-flow')&&parseFloat(X(3).querySelector('.rfp-hc').style.opacity)===0.55);
    t('the manifold is drawn where it was placed',!!S.querySelector('[data-rfp-manifold]'));
    const hl=c.rooms[0].floorplan;hl.layers={heating:false};
    const e2=mk(c,h);await sleep(30);
    t('layers.heating: false → no loops at all',!sr(e2).querySelector('[data-rfp-hx]')&&!sr(e2).querySelector('[data-rfp-heatlayer]'));
  }
  // ---- AnyVac's maps after a change of home frame (7.4.0) ------------------------------------
  {
    // the author's case: AnyVac moved every vacuum into one shared home frame — the plan's source
    // frame and the vacuums' stored transforms no longer apply
    const c=clone(BASE);const fp=c.rooms[0].floorplan;
    fp.source={anyvac:'sensor.s8_anyvac_map',frame:'d4e8',origin_px:[800,752],mm_per_px:12.5};
    const ids={0:'7bUI4dOp7O1qnECi7UfFW3_16',1:'7bUI4dOp7O1qnECi7UfFW3_18',2:'7bUI4dOp7O1qnECi7UfFW3_17',3:'7bUI4dOp7O1qnECi7UfFW3_19',4:'7bUI4dOp7O1qnECi7UfFW3_20'};
    Object.keys(ids).forEach(k=>{fp.rooms[k].anyvac_room=ids[k];});
    fp.vacuums=['sensor.s8_anyvac_map',{entity:'sensor.s7_anyvac_map',transform:{rotation:91.75,x:14.57,y:-9.33,rooms:5,rms:0.19}}];
    // the shared frame: the old one turned by 90° and shifted (home px, 12.5 mm)
    const turn=(x,y)=>[3000-y,x+200];
    const mv=a=>{a.home_frame={id:'shared',cell_mm:50,scale:4};a.rooms.forEach(r=>{
      if(r.outline_home_px)r.outline_home_px=r.outline_home_px.map(p=>turn(p[0],p[1]));
      const b=r.bbox_home_px;if(b){const A=turn(b.x0,b.y0),B=turn(b.x1,b.y1);r.bbox_home_px={x0:Math.min(A[0],B[0]),y0:Math.min(A[1],B[1]),x1:Math.max(A[0],B[0]),y1:Math.max(A[1],B[1])};}});return a;};
    const av=clone(DATA.anyvac);mv(av.attributes);
    const kit=DATA.anyvac.attributes.rooms.find(r=>r.name==='Kitchen').bbox_home_px,kc=[(kit.x0+kit.x1)/2,(kit.y0+kit.y1)/2],kt=turn(kc[0],kc[1]);
    Object.assign(av.attributes,{vacuum_position_home_px:{x:kt[0],y:kt[1],a:0},in_cleaning:false});
    const s7=clone(av);Object.assign(s7.attributes,{vacuum_position_home_px:{x:kt[0]+8,y:kt[1],a:0}});
    const st=Object.assign(states(),{'sensor.s8_anyvac_map':av,'sensor.s7_anyvac_map':s7});
    const e=mk(c,mkHass(st));await sleep(40);const v=e._fpInst,S=sr(e);
    const xf=v._vacXf('sensor.s8_anyvac_map'),x7=v._vacXf('sensor.s7_anyvac_map');
    t('a map in another frame than the plan\'s source is fitted by its rooms (keys from the plan)',xf&&xf.how==='rooms'&&xf.n===5&&xf.rms<0.4&&Math.abs(Math.abs(xf.r*180/Math.PI)-90)<3);
    t('a stored transform without its frame (before 7.4.0) gives way to the fit',x7&&x7.how==='rooms');
    const kp=v._toPlan(av.attributes.vacuum_position_home_px,'sensor.s8_anyvac_map'),kr=v.M.rooms[3].poly;
    t('…so the robot in the kitchen lands in the plan\'s kitchen',!!kp&&F.geom.inPoly(kp[0],kp[1],kr));
    t('both robots drawn',S.querySelectorAll('[data-rfp-robot]').length===2&&v._robots().length===2);
    e.remove();
    // a transform fitted in the frame the map has now wins; no rooms to pair → the old transform
    const c2=clone(c);c2.rooms[0].floorplan.vacuums=[{entity:'sensor.s8_anyvac_map',transform:{rotation:0,x:1,y:2,frame:'shared'}},{entity:'sensor.s7_anyvac_map',transform:{rotation:0,x:3,y:4}}];
    const s7b=clone(s7);s7b.attributes.rooms=[];
    const e2=mk(c2,mkHass(Object.assign(states(),{'sensor.s8_anyvac_map':av,'sensor.s7_anyvac_map':s7b})));await sleep(40);
    t('a transform with the current frame is used as it is; without rooms an old transform still is',e2._fpInst._vacXf('sensor.s8_anyvac_map').how==='transform'&&e2._fpInst._vacXf('sensor.s8_anyvac_map').x===1
      &&e2._fpInst._vacXf('sensor.s7_anyvac_map').x===3);
    e2.remove();
    // the plan's own frame: the source mapping, exactly as before
    const c3=clone(c);c3.rooms[0].floorplan.vacuums=['sensor.s8_anyvac_map'];
    const e3=mk(c3,mkHass(Object.assign(states(),{'sensor.s8_anyvac_map':clone(DATA.anyvac)})));await sleep(40);
    t('a map still in the plan\'s source frame uses the source mapping',e3._fpInst._vacXf('sensor.s8_anyvac_map').how==='source');
    e3.remove();
  }
  // ---- lenses on the plan + the house panel (7.3.0) -----------------------------------------
  {
    const vt=(o,a)=>Object.assign({state:'heat',attributes:Object.assign({hvac_modes:['heat','off'],hvac_action:'heating',current_temperature:21.4,temperature:22,power_percent:55,
      specific_states:{hvac_off_reason:null},requested_state:{hvac_mode:'heat'},safety_manager:{safety_state:'off'}},a||{})},o||{});
    const hs=()=>{const st=states();
      st['climate.living']=vt();
      st['climate.kitchen']=vt({},{hvac_action:'idle',current_temperature:22.1,power_percent:0});
      st['climate.bed']=vt({},{hvac_action:'heating',current_temperature:20.2,temperature:21.5,power_percent:80});
      st['select.central_mode']={state:'Auto',attributes:{options:['Auto','Stopped','Heat only','Cool only','Frost protection']}};
      st['binary_sensor.central_configuration_central_boiler']={state:'on',attributes:{}};
      st['switch.hdo']={state:'on',attributes:{}};
      st['sensor.supply_power']={state:'3250',attributes:{unit_of_measurement:'W',friendly_name:'Supply'}};
      return st;};
    const mkH=st=>Object.assign(mkHass(st||hs()),{language:'cs',locale:{language:'cs'},
      entities:{'select.central_mode':{platform:'versatile_thermostat'},'binary_sensor.central_configuration_central_boiler':{platform:'versatile_thermostat',translation_key:'central_boiler_state'}}});
    const L=w.eval('rocFpLenses');
    t('lenses: a plan with lights and thermostats gets overview + lights + heating (+ cleaning with AnyVac); without them only overview; floorplan.lenses picks and orders',
      L(PLAN).join()==='overview,lights,heating'&&L(Object.assign({},PLAN,{vacuums:['sensor.x']})).join()==='overview,lights,heating,cleaning'&&L({rooms:[{polygon:[]}]}).join()==='overview'&&L({lenses:['heating','overview','x','heating']}).join()==='heating,overview');
    const c=clone(BASE);c.heating={tariff:{entity:'switch.hdo',high_state:'off'},supply:[{entity:'sensor.supply_power',name:'Přívod'}]};
    c.rooms[0].floorplan.dock={sections:['s1']};c.sections=[{id:'s1',title:'Spotřebiče',icon:'mdi:washing-machine',tiles:[]}];
    const h=mkH();calls.length=0;
    const e=mk(c,h);await sleep(40);const S=sr(e),v=()=>e._fpInst;
    const btn=l=>S.querySelector('[data-ico="__fplens_'+l+'"]');
    t('the dock under the plan: the lens buttons, then the section launchers',!!S.querySelector('[data-fp-dock]')&&!!btn('overview')&&!!btn('heating')&&!!S.querySelector('[data-ico="__fpdock_s1"]')&&!!S.querySelector('.roc-fp-sep')
      &&S.querySelector('[data-fp-root]').style.bottom!=='');
    t('the default lens is overview: its button is on, the plan draws as before',btn('overview').classList.contains('roc-lens-on')&&v().o.lens==='overview'&&v().svg.getAttribute('data-rfp-lens')==='overview'&&v().L.lights===true);
    const badge=()=>btn('heating').querySelector('[data-ico-badge]').textContent;
    t('the heating button\'s badge counts the rooms that heat (in every lens), its ring is on',badge()==='2'&&btn('heating').querySelector('[data-ico-ring]').style.display==='block'&&/Topí 2/.test(btn('heating').getAttribute('title')));
    // a room tap in the overview lens still switches rooms
    btn('heating').dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));await sleep(20); // the dock button through the icon pipeline
    t('a lens button switches the lens: heating on, layers of other topics off (no panel yet)',!S.querySelector('.roc-hp')&&v().o.lens==='heating'&&btn('heating').classList.contains('roc-lens-on')&&!btn('overview').classList.contains('roc-lens-on')
      &&v().L.lights===false&&v().L.heating===true&&v().svg.getAttribute('data-rfp-lens')==='heating');
    const val=k=>S.querySelector('[data-rfp-val="'+k+'"]').textContent;
    t('the heating lens labels say now → target; a room without a thermostat only its temperature',/21,4° → 22°/.test(val(0))&&/20,2° → 21,5°/.test(val(4))&&!/→/.test(val(1)));
    t('…the label is outlined in the state\'s colour; a room without a thermostat steps back',S.querySelector('[data-rfp-chip="0"]').getAttribute('stroke')!==null&&S.querySelector('[data-rfp-label="1"]').getAttribute('opacity')==='0.6'
      &&S.querySelectorAll('.rfp-lens-dim').length===2);
    // a tap on a room opens its controller beside the plan, the room outlined
    const hit=S.querySelector('[data-rfp-hit="4"]');ev(hit,'pointerdown');ev(hit,'pointerup');await sleep(30);
    const hc=S.querySelector('.roc-hc');
    t('heating lens: a tap on a room opens its heating controller, the room is outlined, the plan stays visible',!!hc&&e._heat&&e._heat.entity==='climate.bed'
      &&S.querySelector('[data-rfp-focus="4"]').getAttribute('opacity')==='1'&&S.querySelector('[data-rfp-focus="0"]').getAttribute('opacity')==='0'&&S.querySelector('.roc-hc-bd').classList.contains('hc-lite'));
    // 7.4.1: the tap that opened it does not leave the room swipe armed (the mouse dragged the card to another room)
    const wrap=S.querySelector('.wrap');
    wrap.dispatchEvent(new w.MouseEvent('pointermove',{bubbles:true,composed:true,clientX:400,clientY:10,buttons:1}));
    t('the tap that opens a controller leaves no room swipe armed',!e._roomDragActive&&!S.querySelector('.wrap > div[style*="z-index:590"]'));
    hc.querySelector('[data-hc="close"]').click();await sleep(10);
    t('closing it clears the outline',!e._heat&&S.querySelector('[data-rfp-focus="4"]').getAttribute('opacity')==='0');
    // the active lens's button opens the house panel
    btn('heating').dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));await sleep(20);
    const P=S.querySelector('.roc-hp');
    t('the active heating button opens the house panel (C)',!!P&&P.getAttribute('role')==='dialog'&&v().o.lens==='heating');
    const modes=[...P.querySelectorAll('[data-hp="mode"]')].map(b=>b.textContent);
    t('house mode from VTherm\'s central mode (found by itself; no cooling without a cooling thermostat), the current one marked',modes.join('|')==='Automaticky|Zastaveno|Jen topení|Proti mrazu'&&P.querySelector('[data-hp="mode"].on').getAttribute('data-v')==='Auto');
    const facts=P.querySelector('[data-hp-facts]').textContent;
    t('boiler, tariff and the main supply as rows',/Kotel běží/.test(facts)&&/Tarif nízký \(NT\)/.test(facts)&&/Přívod 3[\s ]?250 W/.test(facts));
    const rooms=[...P.querySelectorAll('[data-hp="room"]')];
    t('every thermostat of the plan, with now → target and its status',rooms.length===3&&rooms[0].querySelector('.n').textContent==='T0'&&/21,4°/.test(rooms[0].textContent)&&/→ 22,0°/.test(rooms[0].textContent)
      &&rooms[0].classList.contains('heat')&&/Topí · 55 %/.test(rooms[0].textContent)&&rooms[2].querySelector('.n').textContent==='Sleep');
    calls.length=0;P.querySelector('[data-hp="mode"][data-v="Frost protection"]').click();
    t('a house mode sets the central mode',calls.length===1&&calls[0][0]==='select'&&calls[0][1]==='select_option'&&calls[0][2].option==='Frost protection'&&calls[0][2].entity_id==='select.central_mode');
    rooms[1].click();await sleep(20);
    t('a room in the panel opens its controller instead',!S.querySelector('.roc-hp')&&e._heat&&e._heat.entity==='climate.kitchen');
    S.querySelector('.roc-hc [data-hc="close"]').click();
    // the central mode stops the heating → banner + badge
    const st=hs();
    ['climate.living','climate.kitchen','climate.bed'].forEach(id=>{st[id]=vt({state:'off',last_changed:'2026-11-28T01:59:36+01:00'},{hvac_action:'off',power_percent:0,specific_states:{hvac_off_reason:'hvac_off_central_mode'}});});
    st['select.central_mode']={state:'Stopped',attributes:st['select.central_mode'].attributes};st['switch.hdo']={state:'off',attributes:{}};
    e.hass=mkH(st);await sleep(30);
    const ban=S.querySelector('[data-fp-ban]');
    t('paused by the central mode: a banner on the plan with the mode and since when',!!ban&&!ban.hidden&&/Topení pozastaveno centrálním režimem/.test(ban.textContent)&&/režim: Zastaveno/.test(ban.textContent)&&/od /.test(ban.textContent));
    t('…and the heating button shows II (before VT), no ring',badge()==='II'&&btn('heating').querySelector('[data-ico-ring]').style.display==='none');
    ban.click();await sleep(10);
    t('the banner opens the house panel',!!S.querySelector('.roc-hp'));
    S.querySelector('.roc-hp [data-hp="close"]').click();
    const st2=hs();st2['switch.hdo']={state:'off',attributes:{}};st2['climate.kitchen']={state:'unavailable',attributes:{}};
    e.hass=mkH(st2);await sleep(30);
    t('a silent thermostat → ! (before everything else); the banner goes',badge()==='!'&&S.querySelector('[data-fp-ban]').hidden&&/Zkontroluj/.test(btn('heating').getAttribute('title')));
    const st3=hs();st3['switch.hdo']={state:'off',attributes:{}};['climate.living','climate.bed'].forEach(id=>{st3[id]=vt({},{hvac_action:'idle',power_percent:0});});
    e.hass=mkH(st3);await sleep(30);
    t('nothing heats in the high tariff → VT',badge()==='VT');
    // the lens is kept for the page; the overview lens taps switch rooms again
    e._execAct({action:'fp-lens',lens:'overview'});await sleep(20);
    t('back to overview: the plan as before',v().o.lens==='overview'&&v().L.lights===true);
    e.remove();
    // floorplan.lenses: [overview] → no lens buttons; floorplan.lens: heating → starts there
    const c1=clone(BASE);c1.rooms[0].floorplan.lenses=['overview'];
    const e1=mk(c1,mkH());await sleep(30);
    t('one lens: no dock, the plan draws as before 7.3.0',!sr(e1).querySelector('[data-fp-dock]')&&e1._fpInst.o.lens===null&&!e1._fpInst.svg.getAttribute('data-rfp-lens')&&!sr(e1).querySelector('[data-fp-ban]'));
    e1.remove();
    const c2=clone(BASE);c2.rooms[0].floorplan.lens='heating';
    const e2=mk(c2,mkH());await sleep(30);
    t('floorplan.lens: heating → the page opens in the heating lens',e2._fpInst.o.lens==='heating'&&sr(e2).querySelector('[data-ico="__fplens_heating"]').classList.contains('roc-lens-on'));
    e2.remove();
  }
  // ---- 7.4.0: the lights lens + light controller, the cleaning lens, hot water ------------------
  {
    const st=states();
    st['light.living']={state:'on',attributes:{brightness:204,rgb_color:[255,180,100],supported_color_modes:['color_temp','hs'],min_color_temp_kelvin:2200,max_color_temp_kelvin:6500,friendly_name:'Living lamp'}};
    st['light.kitchen']={state:'on',attributes:{brightness:128,color_temp_kelvin:3000,supported_color_modes:['color_temp'],friendly_name:'Kitchen panel'}};
    st['light.bed']={state:'off',attributes:{supported_color_modes:['onoff'],friendly_name:'Bed lamp'}};
    st['water_heater.bojler']={state:'eco',attributes:{current_temperature:47.5,temperature:53,friendly_name:'Bojler'}};
    const av=clone(DATA.anyvac);Object.assign(av.attributes,{vacuum_position_home_px:{x:1600,y:900,a:0},in_cleaning:false,selected_rooms:['Kitchen'],battery:88,status_state:'charging',friendly_name:'S8 - Kitchen AnyVac Map'});
    st['sensor.s8_anyvac_map']=av;
    const h=Object.assign(mkHass(st),{language:'cs',locale:{language:'cs'}});
    const c=clone(BASE);const fp=c.rooms[0].floorplan;
    fp.source={anyvac:'sensor.s8_anyvac_map',frame:'d4e8',origin_px:[800,752],mm_per_px:12.5};
    const ids={0:'7bUI4dOp7O1qnECi7UfFW3_16',1:'7bUI4dOp7O1qnECi7UfFW3_18',2:'7bUI4dOp7O1qnECi7UfFW3_17',3:'7bUI4dOp7O1qnECi7UfFW3_19',4:'7bUI4dOp7O1qnECi7UfFW3_20'};
    Object.keys(ids).forEach(k=>{fp.rooms[k].anyvac_room=ids[k];});
    fp.vacuums=['sensor.s8_anyvac_map'];
    c.rooms[1].light_controls={entities:[{entity:'light.living',name:'Lampa'}]};
    calls.length=0;
    const e=mk(c,h);await sleep(40);const S=sr(e),v=()=>e._fpInst;
    const btn=l=>S.querySelector('[data-ico="__fplens_'+l+'"]'),badge=l=>btn(l).querySelector('[data-ico-badge]').textContent;
    t('four lenses with AnyVac on the plan: overview, lights, heating, cleaning',['overview','lights','heating','cleaning'].every(l=>!!btn(l)));
    t('lights badge: how many rooms are lit; cleaning badge: the queued rooms',badge('lights')==='3'&&badge('cleaning')==='1'&&/Ve frontě 1/.test(btn('cleaning').getAttribute('title')));
    btn('lights').dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));await sleep(20);
    const val=k=>S.querySelector('[data-rfp-val="'+k+'"]').textContent;
    t('lights lens: lights and windows in front, heating and vacuums hidden; labels say on (how bright) / off',v().o.lens==='lights'&&v().L.lights&&v().L.openings&&!v().L.heating&&!v().L.vacuum
      &&/zap\. 80 %/.test(val(0))&&/vyp\./.test(val(4)));
    // tap: the light controller beside the plan, names from the card room's light_controls
    const hit=S.querySelector('[data-rfp-hit="0"]');ev(hit,'pointerdown');ev(hit,'pointerup');await sleep(30);
    const L=S.querySelector('.roc-lc');
    t('lights lens: a tap opens the room\'s light controller, the room outlined, the plan visible',!!L&&e._lc&&e._lc.ents.join()==='light.living'&&S.querySelector('[data-rfp-focus="0"]').getAttribute('opacity')==='1'&&S.querySelector('.roc-lc-bd').classList.contains('lc-lite'));
    t('…named as in light_controls, with brightness, colour temperatures and colours',L.querySelector('.lc-lt b').textContent==='Lampa'&&/Svítí 1 z 1/.test(L.querySelector('[data-lc-sum]').textContent)
      &&L.querySelector('[data-lc-bri]').value==='80'&&L.querySelectorAll('[data-lc="ct"]').length===3&&L.querySelectorAll('[data-lc="rgb"]').length===6);
    calls.length=0;L.querySelector('[data-lc="ct"]').click();
    t('a colour temperature → light.turn_on with color_temp_kelvin',calls.length===1&&calls[0][0]==='light'&&calls[0][1]==='turn_on'&&calls[0][2].color_temp_kelvin===2700&&calls[0][2].entity_id==='light.living');
    calls.length=0;const br=L.querySelector('[data-lc-bri]');br.value='35';br.dispatchEvent(new w.Event('change',{bubbles:true}));
    t('the brightness slider sends on release',calls.length===1&&calls[0][2].brightness_pct===35);
    calls.length=0;L.querySelector('[data-lc="all"]').click();
    t('all off',calls.length===1&&calls[0][0]==='homeassistant'&&calls[0][1]==='turn_off');
    L.querySelector('[data-lc="close"]').click();
    t('closing clears the outline',!e._lc&&S.querySelector('[data-rfp-focus="0"]').getAttribute('opacity')==='0');
    // the action on its own: a card room's light_controls
    e._execAct({action:'lights',room:'living_room'});await sleep(10);
    t('{action: lights, room} opens the room\'s light controls',e._lc&&e._lc.ents.join()==='light.living'&&e._lc.name==='T0');
    S.querySelector('.roc-lc [data-lc="close"]').click();
    // the lens's panel
    btn('lights').dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));await sleep(20);
    const X=S.querySelector('.roc-xp');
    t('the active lights button opens the house lights panel: lit rooms, all off',!!X&&X.querySelectorAll('[data-xp="lroom"]').length===5&&X.querySelectorAll('.xp-room.lit').length===3&&!X.querySelector('[data-xp="alloff"]').disabled);
    X.querySelector('[data-xp="lroom"]').click();await sleep(10);
    t('a room in the panel opens its light controller',!S.querySelector('.roc-xp')&&!!e._lc);
    S.querySelector('.roc-lc [data-lc="close"]').click();
    // cleaning lens
    btn('cleaning').dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));await sleep(20);
    t('cleaning lens: vacuums, trails and when cleaned in front; lights and heating hidden; the queued room says so',v().o.lens==='cleaning'&&v().L.vacuum&&v().L.cleaning&&!v().L.lights&&!v().L.heating
      &&/ve frontě/.test(val(3))&&S.querySelector('[data-rfp-chip="3"]').getAttribute('stroke')==='#03a9f4');
    calls.length=0;const hk=S.querySelector('[data-rfp-hit="3"]');ev(hk,'pointerdown');ev(hk,'pointerup');await sleep(20);
    t('cleaning lens: a tap queues / unqueues the room in AnyVac\'s shared selection',calls.length===1&&calls[0][0]==='anyvac'&&calls[0][1]==='select_rooms'&&JSON.stringify(calls[0][2])==='{"rooms":["Kitchen"],"mode":"toggle"}');
    btn('cleaning').dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));await sleep(20);
    const C=S.querySelector('.roc-xp');
    t('the cleaning panel: the vacuum with its state and battery, the mode, the queue',!!C&&/S8/.test(C.querySelector('.xp-vac b').textContent)&&/nabíjí · 88 %/.test(C.querySelector('.xp-vac span').textContent)
      &&C.querySelectorAll('[data-xp="mode"]').length===3&&C.querySelectorAll('.xp-room.q').length===1&&/Uklidit 1 místnost/.test(C.querySelector('[data-xp="go"]').textContent));
    calls.length=0;C.querySelector('[data-xp="mode"][data-v="both"]').click();C.querySelector('[data-xp="go"]').click();
    t('start: anyvac.clean with the queued rooms and the mode',calls.length===1&&calls[0][1]==='clean'&&JSON.stringify(calls[0][2])==='{"rooms":["Kitchen"],"mode":"both"}');
    C.querySelector('[data-xp="close"]').click();
    // a vacuum cleans → its count; an error → !
    const st2=clone(st);Object.assign(st2['sensor.s8_anyvac_map'].attributes,{in_cleaning:true,vacuum_room_name:'Kitchen'});
    e.hass=Object.assign(mkHass(st2),{language:'cs',locale:{language:'cs'}});await sleep(30);
    t('cleaning badge: how many vacuums clean',badge('cleaning')==='1'&&/Uklízí 1/.test(btn('cleaning').getAttribute('title')));
    const st3=clone(st2);st3['sensor.s8_anyvac_map'].attributes.vacuum_error='main brush jammed';
    e.hass=Object.assign(mkHass(st3),{language:'cs',locale:{language:'cs'}});await sleep(30);
    t('…and ! on a vacuum error',badge('cleaning')==='!');
    // the house panel: the heating boiler is the "Kotel", the hot water its own row
    e._execAct({action:'fp-lens',lens:'heating'});await sleep(10);e._execAct({action:'fp-lens',lens:'heating'});await sleep(20);
    const HP=S.querySelector('.roc-hp');
    t('house panel: hot water from the only water heater, with its target',!!HP&&/Teplá voda 47,5 °C cíl 53 °C/.test(HP.querySelector('[data-hp-facts]').textContent.replace(/\s+/g,' ')));
    e.remove();
  }
  console.log(fails?'\n'+fails+' FAILED':'\nall floor plan tests passed');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
