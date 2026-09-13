// Probe: do cockpit section tiles update live when their entity lives in ANOTHER room,
// comes from source:auto, or is a `progress:` sensor? (change detection in `set hass`)
const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.innerWidth=1920;w.innerHeight=1080;w.requestIdleCallback=f=>setTimeout(f,0);w.loadCardHelpers=undefined;
w.eval(code);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};

const mk=(cfg,states)=>{const el=w.document.createElement('room-overlay-card');el.setConfig(cfg);el.hass={states,callService(){},user:{name:'x'}};w.document.body.appendChild(el);return el;};
const st=(state,attrs)=>({state,attributes:Object.assign({friendly_name:'n'},attrs||{})});

(async()=>{
  // Two rooms; the washer zone (tagged into section) lives in room 2; card shows room 1.
  const cfg={
    sections:[{id:'app',title:'Appliances',placement:'sheet-right'},{id:'heat',title:'Heat',source:'auto',domain:'climate'}],
    rooms:[
      {id:'r1',base_image:'/local/a.webp',icons:[{id:'open',icon:'mdi:washing-machine',top:'10%',left:'10%',tap_action:{action:'open-section',section:'app'}}]},
      {id:'r2',base_image:'/local/b.webp',zones:[{id:'washer',top:'10%',left:'10%',width:'10%',height:'10%',section:'app',tile:{name:'Washer',entity:'sensor.washer',active_state:'run',progress:'sensor.washer_progress'}}]}
    ],
    layout:{portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}}
  };
  const states={
    'sensor.washer':st('idle'),
    'sensor.washer_progress':st('10'),
    'climate.living':st('heat',{friendly_name:'Living',current_temperature:21}),
  };
  const el=mk(cfg,states);
  el._openSection('app');
  await sleep(30);
  const panel=el.shadowRoot.querySelector('[data-section-panel="app"]');
  const stateEl=panel.querySelector('[data-tile-state]');
  const progEl=panel.querySelector('[data-tile-progress]');
  t('panel open + tile rendered',panel.classList.contains('open')&&!!stateEl);
  t('initial state text = idle',stateEl.textContent==='idle');
  t('initial progress = 10%',progEl.style.width==='10%');
  console.log('relevantEntities:',el._relevantEntities);
  console.log('navEntities:',el._navEntities);

  // --- change the washer state (entity from room 2) ---
  let upd=0;const orig=el._update.bind(el);el._update=function(){upd++;return orig();};
  const s2=Object.assign({},states,{'sensor.washer':st('run')});
  el.hass={states:s2,callService(){},user:{name:'x'}};
  await sleep(60);
  t('cross-room tile state updated to run (BUG if FAIL)',stateEl.textContent==='run');
  console.log('  _update calls after washer change:',upd);

  // --- change only the progress sensor ---
  const s3=Object.assign({},s2,{'sensor.washer_progress':st('75')});
  el.hass={states:s3,callService(){},user:{name:'x'}};
  await sleep(60);
  t('progress bar updated to 75% (BUG if FAIL)',progEl.style.width==='75%');

  // --- auto tile: climate in section heat ---
  el._closeSection();el._openSection('heat');
  await sleep(30);
  const hp=el.shadowRoot.querySelector('[data-section-panel="heat"]');
  const hst=hp.querySelector('[data-tile-state]');
  t('auto tile rendered with state heat',!!hst&&hst.textContent==='heat');
  const s4=Object.assign({},s3,{'climate.living':st('off',{friendly_name:'Living'})});
  el.hass={states:s4,callService(){},user:{name:'x'}};
  await sleep(60);
  t('auto tile state updated to off (BUG if FAIL)',hst.textContent==='off');

  // --- control: same but the tagged element lives in the ACTIVE room ---
  const cfg2=JSON.parse(JSON.stringify(cfg));cfg2.rooms[0].zones=cfg2.rooms[1].zones;delete cfg2.rooms[1].zones;
  const el2=mk(cfg2,states);el2._openSection('app');await sleep(30);
  const st2=el2.shadowRoot.querySelector('[data-section-panel="app"] [data-tile-state]');
  el2.hass={states:Object.assign({},states,{'sensor.washer':st('run')}),callService(){},user:{name:'x'}};
  await sleep(60);
  t('control: same-room tile updates',st2.textContent==='run');
  process.exit(fails?1:0);
})();
