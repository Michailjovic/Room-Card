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
const mkEd=(cfg)=>{const ed=w.document.createElement('room-overlay-card-editor');ed.setConfig(JSON.parse(JSON.stringify(cfg)));ed.hass={states:{},user:{name:'x'}};w.document.body.appendChild(ed);return ed;};
(async()=>{
  // G) Duplicate twice -> duplicate ids
  const ed=mkEd({base_image:'/local/x.webp',layout:LY,icons:[{id:'lamp',icon:'mdi:x',top:'5%',left:'5%'}]});
  ed.querySelector('[data-dup-ico="0"]').click();await sleep(5);
  ed.querySelector('[data-dup-ico="0"]').click();await sleep(5);
  const ids=ed._config.icons.map(i=>i.id);
  console.log('  icon ids after duplicating the original twice:',ids);
  t('Duplicate never produces a duplicate id (BUG if FAIL)',new Set(ids).size===ids.length);

  // J) every drag-drop in Edit mode rebuilds the whole editor + remounts the preview card
  const ed2=mkEd({base_image:'/local/x.webp',layout:LY,test_mode:true,icons:[{id:'i',icon:'mdi:x',top:'5%',left:'5%'}]});
  await sleep(10);
  const before=ed2._prevCard;const beforeInput=ed2.querySelector('[data-ico-top="0"]');
  const nc=JSON.parse(JSON.stringify(ed2._prevCard._config));nc.icons[0].top='20%';
  w.dispatchEvent(new w.CustomEvent('roc-pos-update',{detail:{config:Object.assign({type:'custom:room-overlay-card'},nc)}}));
  await sleep(10);
  console.log('  preview card identity changed:',before!==ed2._prevCard,'| input element identity changed:',beforeInput!==ed2.querySelector('[data-ico-top="0"]'));
  t('drag-drop keeps the preview card instance (remount = flicker/perf) (UX issue if FAIL)',before===ed2._prevCard);

  // P) docs: badge label conditional with a Jinja value renders literally
  const el=w.document.createElement('room-overlay-card');
  el.setConfig({base_image:'/local/x.webp',layout:LY,badges:[{id:'b',icon:'mdi:x',label:[{value:"{{ states('sensor.t') }} °C"}]}]});
  el.hass={states:{'sensor.t':st('21')},callService(){},user:{name:'x'}};w.document.body.appendChild(el);
  await sleep(30);
  const txt=el.shadowRoot.querySelector('[data-bl="b"]').textContent;
  console.log('  badge label text:',JSON.stringify(txt));
  t('badge label conditional value with {{ }} is rendered (doc example) (DOC BUG if FAIL)',txt.indexOf('{{')<0);

  // dead nav fields
  console.log('  auto_breakpoint used in render path?', /auto_breakpoint/.test(code.split('class RoomOverlayCardEditor')[0].replace(/delete c\.nav\.auto_breakpoint;/,'')));
  process.exit(fails?1:0);
})();
