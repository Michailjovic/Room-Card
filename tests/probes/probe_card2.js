// Card probes: panel click -> room tap_action, icon hold-only, glow visible, badge touch-scroll, same-room progress, Czech string
const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.innerWidth=1920;w.innerHeight=1080;w.requestIdleCallback=f=>setTimeout(f,0);w.loadCardHelpers=undefined;
w.eval(code);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const LY={portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}};
const st=(state,attrs)=>({state,attributes:Object.assign({friendly_name:'n'},attrs||{})});
const mk=(cfg,states,calls)=>{const el=w.document.createElement('room-overlay-card');el.setConfig(cfg);el.hass={states,callService(d,s,data){calls&&calls.push([d,s,data]);},user:{name:'x'}};w.document.body.appendChild(el);return el;};

(async()=>{
  // 1) section panel / backdrop click bubbles into the room-level tap_action
  const calls=[];
  const el=mk({base_image:'/local/x.webp',layout:LY,tap_action:{action:'toggle',entity:'light.room'},
    sections:[{id:'app',title:'App'}],
    icons:[{id:'o',icon:'mdi:x',top:'5%',left:'5%',tap_action:{action:'open-section',section:'app'}}],
    zones:[{id:'z',top:'10%',left:'10%',width:'10%',height:'10%',section:'app',tile:{name:'Washer',entity:'sensor.w'}}]},
    {'sensor.w':st('idle'),'light.room':st('off')},calls);
  el._openSection('app');await sleep(20);
  const panel=el.shadowRoot.querySelector('[data-section-panel="app"]');
  const hd=panel.querySelector('.roc-panel-hd-txt');
  calls.length=0;
  hd.dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));
  await sleep(10);
  console.log('  calls after clicking panel header:',JSON.stringify(calls));
  t('clicking inside an open section panel does NOT fire the room tap_action (BUG if FAIL)',calls.length===0);
  calls.length=0;
  const tile=panel.querySelector('.roc-tile');
  tile.dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));
  await sleep(10);
  t('clicking a tile without tap_action does NOT fire the room tap_action (BUG if FAIL)',calls.length===0);
  calls.length=0;
  const bd=el.shadowRoot.querySelector('[data-section-backdrop]');
  bd.dispatchEvent(new w.MouseEvent('click',{bubbles:true,composed:true}));
  await sleep(10);
  console.log('  calls after backdrop click:',JSON.stringify(calls),'open:',el._sectionOpen);
  t('closing via backdrop does NOT fire the room tap_action (BUG if FAIL)',calls.length===0);

  // 2) icon with hold_action only
  const el2=mk({base_image:'/local/x.webp',layout:LY,icons:[{id:'h',icon:'mdi:x',top:'5%',left:'5%',hold_action:{action:'toggle',entity:'light.a'}}],zones:[{id:'zh',top:'1%',left:'1%',width:'5%',height:'5%',hold_action:{action:'toggle',entity:'light.b'}}]},{'light.a':st('off'),'light.b':st('off')});
  const ico=el2.shadowRoot.querySelector('[data-ico="h"]');
  const zone=el2.shadowRoot.querySelector('[data-z="zh"]');
  console.log('  icon tabindex:',ico.getAttribute('tabindex'),'cursor:',ico.style.cursor,'| zone tabindex:',zone.getAttribute('tabindex'));
  // detect whether a hold ring can be started: mousedown should create .roc-hold after the grace delay
  ico.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true}));
  zone.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true}));
  await sleep(200);
  const icoRing=!!ico.querySelector('.roc-hold'),zoneRing=!!zone.querySelector('.roc-hold');
  console.log('  hold ring icon:',icoRing,'zone:',zoneRing);
  t('icon with ONLY hold_action is wired for hold (BUG if FAIL)',icoRing);
  t('control: zone with ONLY hold_action is wired',zoneRing);

  // 3) glow `visible:` condition
  const el3=mk({base_image:'/local/x.webp',layout:LY,glows:[{id:'g',entity:'light.g',top:'50%',left:'50%',size:'20%',visible:{entity:'binary_sensor.home',state:'on'}}]},{'light.g':st('on',{brightness:255}),'binary_sensor.home':st('off')});
  await sleep(30);
  const gl=el3.shadowRoot.querySelector('[data-glow="g"]');
  console.log('  glow display:',JSON.stringify(gl.style.display),'opacity:',gl.style.opacity);
  t('glow honours visible: condition (BUG if FAIL)',gl.style.display==='none'||gl.style.visibility==='hidden');

  // 4) badge: touch scroll starting on it still fires tap
  const calls4=[];
  const el4=mk({base_image:'/local/x.webp',layout:LY,badges:[{id:'b',icon:'mdi:x',label:'x',tap_action:{action:'toggle',entity:'light.b'}}]},{'light.b':st('off')},calls4);
  const bel=el4.shadowRoot.querySelector('[data-b="b"]');
  const mkTouch=(type,x,y)=>{const e=new w.Event(type,{bubbles:true,cancelable:true});e.touches=[{clientX:x,clientY:y}];e.changedTouches=e.touches;return e;};
  bel.dispatchEvent(mkTouch('touchstart',10,10));
  bel.dispatchEvent(mkTouch('touchmove',10,120));
  bel.dispatchEvent(mkTouch('touchend',10,120));
  await sleep(10);
  console.log('  badge calls after a 110px finger drag:',JSON.stringify(calls4));
  t('badge: a finger scroll starting on it does NOT fire tap_action (BUG if FAIL)',calls4.length===0);

  // 5) same-room tile with progress sensor
  const el5=mk({base_image:'/local/x.webp',layout:LY,sections:[{id:'app',title:'App'}],zones:[{id:'z',top:'10%',left:'10%',width:'10%',height:'10%',section:'app',tile:{name:'W',entity:'sensor.w',progress:'sensor.wp'}}]},{'sensor.w':st('run'),'sensor.wp':st('10')});
  el5._openSection('app');await sleep(20);
  const pEl=el5.shadowRoot.querySelector('[data-tile-progress]');
  el5.hass={states:{'sensor.w':st('run'),'sensor.wp':st('80')},callService(){},user:{name:'x'}};
  await sleep(60);
  console.log('  progress width:',pEl.style.width,'relevant:',el5._relevantEntities);
  t('same-room tile progress sensor drives updates (BUG if FAIL)',pEl.style.width==='80%');

  // 6) hardcoded Czech string in an empty section panel
  const el6=mk({base_image:'/local/x.webp',layout:LY,sections:[{id:'empty',title:'E'}]},{});
  const emptyTxt=el6.shadowRoot.querySelector('.roc-panel-empty').textContent;
  console.log('  empty-panel text:',emptyTxt);
  t('empty-panel copy is English (BUG if FAIL)',!/Zatím|přidej|místnosti/.test(emptyTxt));

  // 7) section panel Escape after HA moves the card (dis/connect)
  const el7=mk({base_image:'/local/x.webp',layout:LY,sections:[{id:'s',title:'S'}],zones:[{id:'z',top:'1%',left:'1%',width:'5%',height:'5%',section:'s'}]},{});
  el7._openSection('s');
  const wrapper=w.document.createElement('div');w.document.body.appendChild(wrapper);wrapper.appendChild(el7); // HA edit-mode move
  await sleep(10);
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  await sleep(10);
  console.log('  after move+Escape: open=',el7._sectionOpen,'keyHandler=',!!el7._secKeyHandler);
  t('Escape still closes an open panel after HA moved the card (BUG if FAIL)',el7._sectionOpen===null);
  process.exit(fails?1:0);
})();
