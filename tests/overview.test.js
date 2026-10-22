#!/usr/bin/env node
/**
 * Overview page (v6.30.0, OVERVIEW_PLAN.md §7) — jsdom render + editor tests.
 * Usage: node tests/overview.test.js [path-to-card.js]  (requires: npm i -D jsdom)
 */
'use strict';
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.log('jsdom not installed - skipping overview tests (npm i -D jsdom)');process.exit(0);}
const fs=require('fs');
const path=require('path');
const code=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.innerWidth=1920;w.innerHeight=1080;
w.requestIdleCallback=f=>setTimeout(f,0);
w.loadCardHelpers=undefined;
w.eval(code);
{const _E=w.customElements.get('room-overlay-card-editor');if(_E)_E.rocDefaultView='classic';} // v7: the classic tabs are tested here; the launcher has its own tests
let fails=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=o=>JSON.parse(JSON.stringify(o));

const calls=[];
const hass=()=>({states:{
  'light.a':{state:'on',attributes:{}},'light.a2':{state:'off',attributes:{}},'cover.a':{state:'closed',attributes:{}},
  'light.b':{state:'off',attributes:{}},'sensor.a_t':{state:'21.5',attributes:{}},'sensor.b_t':{state:'19',attributes:{}},
  'sensor.dhw':{state:'47.4',attributes:{unit_of_measurement:'°C'}},'media_player.tv':{state:'playing',attributes:{}}},
  callService(d,s,data,tg){calls.push([d,s,data,tg]);},user:{name:'x'}});
const BASE={type:'custom:room-overlay-card',
  layout:{landscape:{rows:['auto','1fr'],place:{nav:{row:1},image:{row:2}}},portrait:{rows:['auto','auto'],place:{nav:{row:1},image:{row:2}}}},
  nav:{style:'thumbnails',chips:[{entity:'sensor.{room}_t',suffix:'°'}],cards:[{card:{type:'markdown',content:'ticker'}}]},
  sections:[{id:'heat',title:'Heat',icon:'mdi:radiator'},{id:'media',title:'Media',icon:'mdi:music'}],
  rooms:[
    {id:'ov',name:'Overview',icon:'mdi:view-dashboard',overview:{
      header:{items:[{pill:{entity:'sensor.dhw',icon:'mdi:water-boiler',prefix:'DHW '}},{pill:{template:'{{ 1 }}'}},{nav_cards:true}]},
      left:{width:'25%',cards:[{card:{type:'markdown',content:'weather'},media:'landscape'},{card:{type:'markdown',content:'compact'},media:'portrait'}]},
      grid:{columns:{landscape:3,portrait:2}},dock:{},transition:'none'}},
    {id:'a',name:'A',base_image:'/a.png',light_controls:{entities:['light.a','light.a2']},blinds:[{id:'bl',entity:'cover.a',top:'1%',left:'1%',width:'5%',height:'5%',control:{placement:'float'}}],
      elements:[{id:'tv',top:'1%',left:'1%',width:'1%',height:'1%',card:{type:'media-control',entity:'media_player.tv'}}]},
    {id:'b',name:'B',base_image:'/b.png',light_controls:{entities:['light.b']},overview_tile:{name:'Bee',focus:'20% 80%'}},
    {id:'c',name:'C',base_image:'/c.png',overview_tile:{hidden:true}}
  ]};
const mk=(cfg)=>{const el=w.document.createElement('room-overlay-card');el.setConfig(clone(cfg));el.hass=hass();w.document.body.appendChild(el);return el;};
const sr=el=>el.shadowRoot;

(async()=>{
  // ---- 1. a config without an overview room injects nothing -----------------
  {
    const plain=clone(BASE);plain.rooms=plain.rooms.slice(1);
    const el=mk(plain);await sleep(40);
    t('no overview room → no overview CSS',sr(el).querySelector('style').textContent.indexOf('.roc-ov')<0);
    t('no overview room → no overview DOM',!sr(el).querySelector('.roc-ov,.roc-thumb-ov'));
    el.remove();
  }
  // ---- 2. the overview page --------------------------------------------------
  const el=mk(BASE);await sleep(60);
  const S=sr(el);
  t('overview renders its root',!!S.querySelector('[data-ov-root]'));
  t('_ovActive flag',el._ovActive===true);
  t('no nav strip on the overview page',!S.querySelector('.roc-nav'));
  t('only the image region is placed (O3)',[...S.querySelectorAll('.roc-reg')].map(r=>r.dataset.reg).join(',')==='image');
  t('.content fills the box (no photo stage)',/inset:\s*0/.test(S.querySelector('.content').getAttribute('style')||''));
  const tiles=[...S.querySelectorAll('.roc-ovt')].map(x=>x.dataset.ovt);
  t('tiles: every room except overview + hidden, in order',tiles.join(',')==='1,2');
  t('tile name: overview_tile.name wins',S.querySelector('.roc-ovt[data-ovt="2"] .roc-ovt-name').textContent==='Bee');
  t('tile focus becomes the photo position',/--roc-ov-focus:\s*20% 80%/.test(S.querySelector('[data-ovt-ph="2"]').getAttribute('style')));
  t('off tier: photo tile carries its base image',/a\.png/.test(S.querySelector('[data-ovt-ph="1"]').getAttribute('style')));
  t('grid columns (landscape 3)',/--roc-ov-cols:\s*3/.test(S.querySelector('[data-ov-grid]').getAttribute('style')));
  t('landscape photo tiles fill the height',S.querySelector('[data-ov-grid]').classList.contains('roc-ov-fill'));
  const root=S.querySelector('[data-ov-root]').getAttribute('style');
  t('regions: header / left+grid / dock',/grid-template-areas:\s*'hd hd' 'lt gr' 'dk dk'/.test(root)||/grid-template-areas:\s*"hd hd" "lt gr" "dk dk"/.test(root));
  t('left width on the column track',/grid-template-columns:\s*25% minmax\(0(px)?, ?1fr\)/.test(root));
  t('left column: only the landscape card',S.querySelectorAll('.roc-ov-left [data-ovc-card]').length===1);
  t('header: pill, pill, nav strip card',S.querySelectorAll('.roc-ov-hd .roc-ovp').length===2&&S.querySelectorAll('.roc-ov-hd [data-ovc-card]').length===1);
  t('pill value: entity through the shared formatter',S.querySelector('[data-ovp="0"] [data-ovp-v]').textContent.indexOf('DHW 47')===0);
  const chipsA=[...S.querySelectorAll('.roc-ovt[data-ovt="1"] .roc-ovc')];
  t('auto chips for room A: lights, blind, media',chipsA.length===3);
  t('lights chip lit (one light on)',chipsA[0].classList.contains('on')&&chipsA[0].getAttribute('aria-pressed')==='true');
  t('closed blind chip not lit',!chipsA[1].classList.contains('on'));
  t('info chips are registered nav chips and formatted',S.querySelector('[data-ovt-info="1"]').textContent==='22°'&&el._navChipEls.length===2);
  t('dock: one launcher per section',S.querySelectorAll('.roc-ov-dock [data-ico]').length===2);
  t('dock launchers join the icon pipeline',el._roomCfg.icons.length===2&&el._roomCfg.icons[0].tap_action.action==='open-section');
  t('chip/pill entities drive full updates',el._relevantEntities.indexOf('light.a2')>=0&&el._relevantEntities.indexOf('sensor.dhw')>=0&&el._relevantEntities.indexOf('media_player.tv')>=0);
  // chip tap: service call, no room switch
  calls.length=0;
  chipsA[0].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  t('lights chip tap → turn_off all (one was on), no room switch',calls.length===1&&calls[0][0]==='homeassistant'&&calls[0][1]==='turn_off'&&JSON.stringify(calls[0][3].entity_id)==='["light.a","light.a2"]'&&el._roomIdx===0);
  // dock opens a section
  S.querySelector('[data-ico="__ovdock_media"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  t('dock launcher opens its section',el._sectionOpen==='media');
  el._closeSection();
  // state update reaches chips
  const h2=hass();h2.states['light.a']={state:'off',attributes:{}};el.hass=h2;await sleep(60);
  t('state change: lights chip goes dark',!S.querySelector('.roc-ovt[data-ovt="1"] .roc-ovc').classList.contains('on'));
  // tile tap → room A (transition none → plain switch)
  S.querySelector('.roc-ovt[data-ovt="1"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  await sleep(40);
  t('tile tap switches to its room',el._roomIdx===1&&el._ovActive===false);
  t('room view is the ordinary one again (nav strip back)',!!sr(el).querySelector('.roc-nav')&&!sr(el).querySelector('[data-ov-root]'));
  t('overview page shows as an icon thumbnail in the strip',!!sr(el).querySelector('.roc-thumb-ov[data-thumb="0"]'));
  t('no frozen layers left behind',sr(el).querySelector('ha-card').children.length===1);
  el.remove();

  // ---- 3. nav_hidden, ghost placeholder ----------------------------------------
  {
    const c=clone(BASE);c.rooms[0].nav_hidden=true;
    const el2=mk(c);el2._switchRoom(1,1,true);await sleep(40);
    t('nav_hidden keeps the overview page out of the strip',!sr(el2).querySelector('.roc-thumb-ov')&&sr(el2).querySelectorAll('.roc-thumb').length===3);
    el2.remove();
    const g=clone(BASE);g._roc_ghost=true;g._roc_preview=true;
    const gh=mk(g);await sleep(30);
    t('swipe ghost of the overview draws a placeholder, never the grid',!!sr(gh).querySelector('.roc-ov-ph')&&!sr(gh).querySelector('[data-ov-root]'));
    gh.remove();
  }

  // ---- 4. live minis, persistent strip across the overview ---------------------
  {
    const c=clone(BASE);c.nav.live='full';c.rooms[0].overview.transition='none';
    const el3=mk(c);await sleep(60);
    t('live tier: tiles mount live minis',Object.keys(el3._ovMiniEls).length===2&&!!sr(el3).querySelector('[data-ovt-mini="1"] room-overlay-card'));
    t('live minis get hass forwarded',!!el3._ovMiniEls[1].el._hass);
    el3._switchRoom(1,1,true);await sleep(40);
    const mini=el3._navMiniEls[2]&&el3._navMiniEls[2].el;
    el3._switchRoom(0,-1,true);await sleep(40);
    t('entering the overview parks the strip',!!el3._navStash&&Object.keys(el3._navMiniEls).length===0);
    el3._switchRoom(2,1,true);await sleep(40);
    t('leaving it puts the SAME strip back (no re-mount)',!!mini&&el3._navMiniEls[2]&&el3._navMiniEls[2].el===mini&&mini.isConnected);
    t('stash consumed',!el3._navStash);
    el3.setConfig(clone(c));await sleep(30);
    t('a config change drops any parked strip',!el3._navStash);
    el3.remove();
  }

  // ---- 5. composite tier + row style on portrait -----------------------------------
  {
    w.innerWidth=390;w.innerHeight=844;
    const c=clone(BASE);c.rooms[0].overview.grid={style:{portrait:'row'},live:'composite'};
    c.rooms[1].overlays=[{id:'lamp',image:'/lamp.png',conditions:{opacity:[{condition:{entity:'light.a',state:'on'},value:1},{value:0}]}}];
    const el4=mk(c);await sleep(60);
    const S4=sr(el4);
    t('portrait: row tiles',S4.querySelectorAll('.roc-ovt-row').length===2&&!S4.querySelector('.roc-ovt-card'));
    t('portrait: single column',/--roc-ov-cols:\s*1/.test(S4.querySelector('[data-ov-grid]').getAttribute('style')));
    t('portrait: left column above the grid, portrait card only',/'hd' 'lt' 'gr' 'dk'|"hd" "lt" "gr" "dk"/.test(S4.querySelector('[data-ov-root]').getAttribute('style'))&&S4.querySelectorAll('.roc-ov-left [data-ovc-card]').length===1);
    t('portrait: big chips class',S4.querySelector('[data-ov-root]').classList.contains('roc-ov-pm'));
    t('composite tier: thumbs painted with base + active overlay',/lamp\.png.*a\.png/.test(S4.querySelector('[data-ovt-ph="1"]').style.backgroundImage||''));
    t('composite tier: other rooms\' overlay entities tracked',el4._navEntities.indexOf('light.a')>=0||el4._relevantEntities.indexOf('light.a')>=0);
    el4.remove();
    w.innerWidth=1920;w.innerHeight=1080;
  }

  // ---- 6. templates ---------------------------------------------------------------
  {
    const subs=[];
    const el5=w.document.createElement('room-overlay-card');el5.setConfig(clone(BASE));
    const h=hass();h.connection={subscribeMessage(cb,msg){subs.push([cb,msg]);return Promise.resolve(()=>{});}};
    el5.hass=h;w.document.body.appendChild(el5);await sleep(60);
    const s=subs.find(x=>x[1].template==='{{ 1 }}');
    if(s)s[0]({result:'Michael'});
    t('pill template subscribed and rendered',!!s&&sr(el5).querySelector('[data-ovp="1"] [data-ovp-v]').textContent==='Michael');
    el5.remove();
  }

  // ---- 7. editor ------------------------------------------------------------------
  {
    const cfg=clone(BASE);
    cfg.rooms[0].overview.unknown_key=42;
    cfg.rooms[0].overview.grid={columns:{landscape:3,portrait:2},style:{portrait:'row'},chips_max:{portrait:2}};
    cfg.rooms[0].overview.dock={sections:['media']};
    cfg.rooms[2].overview_tile={focus:'30% 70%',chips:[{entity:'light.b',icon:'mdi:lamp'},'media_player.tv'],extra:1};
    const ed=w.document.createElement('room-overlay-card-editor');
    ed.setConfig(clone(cfg));ed.hass=hass();w.document.body.appendChild(ed);
    ed._editRoomIdx=0;ed._editGlobal=false;ed._render();
    t('editor: overview accordion on the overview room',!!ed.querySelector('details[data-panel="room-overview"]')&&!ed.querySelector('details[data-panel="room-ovtile"]'));
    t('editor: image tab explains the overview page',/overview page/.test(ed.innerHTML));
    t('editor: one row per header item',ed.querySelectorAll('[data-ovhd-kind]').length===3);
    t('editor: dock checklist reflects the config',ed.querySelector('[data-ovd-sec="media"]').checked&&!ed.querySelector('[data-ovd-sec="heat"]').checked);
    let out=ed._collectConfig();
    t('editor: untouched overview round-trips unchanged (incl. unknown keys)',JSON.stringify(out.rooms[0])===JSON.stringify(cfg.rooms[0]));
    ed.querySelector('#ovf-lt-on').checked=false;out=ed._collectConfig();
    t('editor: switching the left column off removes it',!out.rooms[0].overview.left);
    ed.querySelector('#ovf-lt-on').checked=true;
    ed.querySelector('#ovf-g-cols-l').value='4';out=ed._collectConfig();
    t('editor: columns per profile',JSON.stringify(out.rooms[0].overview.grid.columns)==='{"landscape":4,"portrait":2}');
    ed.querySelector('#ovf-g-style-p').value='card';out=ed._collectConfig();
    t('editor: default tile style is not written',out.rooms[0].overview.grid.style===undefined);
    ed._editRoomIdx=2;ed._render();
    t('editor: tile accordion on an ordinary room',!!ed.querySelector('details[data-panel="room-ovtile"]'));
    out=ed._collectConfig();
    t('editor: untouched tile round-trips unchanged',JSON.stringify(out.rooms[2].overview_tile)===JSON.stringify(cfg.rooms[2].overview_tile));
    ed.querySelector('#ovt-fx').value='50';ed.querySelector('#ovt-fy').value='50';out=ed._collectConfig();
    t('editor: centred focus is not written',out.rooms[2].overview_tile.focus===undefined);
    ed.querySelector('[data-ovtc-ent="0"]').value='light.a';out=ed._collectConfig();
    t('editor: custom chip entity edit',out.rooms[2].overview_tile.chips[0].entity==='light.a'&&out.rooms[2].overview_tile.chips[0].icon==='mdi:lamp');
    let fired=null;ed.addEventListener('config-changed',e=>{fired=e.detail.config;});
    ed.querySelector('#ovt-mode').value='none';ed.querySelector('#ovt-mode').dispatchEvent(new w.Event('change'));
    t('editor: chips "none"',fired&&fired.rooms[2].overview_tile.chips==='none');
    ed._editRoomIdx=3;ed._render();fired=null;
    ed.querySelector('#add-ovpage').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    t('editor: + Overview adds an overview page',!!fired&&fired.rooms.length===5&&!!fired.rooms[4].overview&&fired.rooms[4].id==='overview_2'.replace('_2','')||(!!fired&&fired.rooms[4].id.indexOf('overview')===0));
    ed.remove();
  }

  // ---- 8. v6.31.0: room names on/off, grid order in the GUI ----------------------
  {
    const c=clone(BASE);c.rooms[0].overview.grid={names:false};c.rooms[2].overview_tile={show_name:true};
    const el6=mk(c);await sleep(40);
    t('grid.names: false hides the tile names',!sr(el6).querySelector('.roc-ovt[data-ovt="1"] .roc-ovt-name'));
    t('overview_tile.show_name: true still shows that one',!!sr(el6).querySelector('.roc-ovt[data-ovt="2"] .roc-ovt-name'));
    t('a hidden name keeps the info chips (aria-label keeps the name)',!!sr(el6).querySelector('[data-ovt-info="1"]')&&sr(el6).querySelector('.roc-ovt[data-ovt="1"]').getAttribute('aria-label')==='A');
    el6.remove();
    const c2=clone(BASE);c2.rooms[0].overview.grid={rooms:['b','a']};
    const el7=mk(c2);await sleep(40);
    t('grid.rooms sets the grid order independently of rooms:',[...sr(el7).querySelectorAll('.roc-ovt')].map(x=>x.dataset.ovt).join(',')==='2,1');
    el7.remove();
    const ed=w.document.createElement('room-overlay-card-editor');
    ed.setConfig(clone(c2));ed.hass=hass();w.document.body.appendChild(ed);
    ed._editRoomIdx=0;ed._editGlobal=false;ed._render();
    const ids=()=>[...ed.querySelectorAll('[data-ovg-room]')].map(x=>x.dataset.ovgRoom+(x.checked?'+':'-')).join(',');
    t('editor: shown rooms first in grid order, the rest unticked below',ids()==='b+,a+,c-');
    t('editor: ▲ disabled on the first, ▼ on the last shown room',ed.querySelector('[data-ovg-mv="0:-1"]').disabled&&ed.querySelector('[data-ovg-mv="1:1"]').disabled&&!ed.querySelector('[data-ovg-mv="2:-1"]'));
    let fired=null;ed.addEventListener('config-changed',e=>{fired=e.detail.config;});
    ed.querySelector('[data-ovg-mv="0:1"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    t('editor: ▼ moves a room later in the grid',!!fired&&JSON.stringify(fired.rooms[0].overview.grid.rooms)==='["a","b"]'&&ids()==='a+,b+,c-');
    t('editor: the nav order (rooms:) is untouched',fired.rooms.map(r=>r.id).join(',')==='ov,a,b,c');
    ed.querySelector('#ovf-g-names').checked=false;let out=ed._collectConfig();
    t('editor: "Show room names" off writes grid.names: false',out.rooms[0].overview.grid.names===false);
    ed.querySelector('#ovf-g-names').checked=true;out=ed._collectConfig();
    t('editor: on again removes the key',out.rooms[0].overview.grid.names===undefined);
    ed._editRoomIdx=1;ed._render();
    t('editor: tile name select defaults to "as the overview page sets it"',ed.querySelector('#ovt-showname').value==='');
    ed.querySelector('#ovt-showname').value='hide';out=ed._collectConfig();
    t('editor: tile "hide" writes show_name: false',out.rooms[1].overview_tile.show_name===false);
    ed.remove();
  }

  console.log(fails?('FAILURES: '+fails):'ALL OVERVIEW TESTS PASSED');
  process.exit(fails?1:0);
})();
