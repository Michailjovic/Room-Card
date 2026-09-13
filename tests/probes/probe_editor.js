// Editor probes: migration button, element per-profile data loss, badge nav_mini, stale preview, YAML multiline
const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.innerWidth=1920;w.innerHeight=1080;w.requestIdleCallback=f=>setTimeout(f,0);w.loadCardHelpers=undefined;
w.eval(code+';window.__y=_yaml;');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const errors=[];
w.addEventListener('error',e=>{errors.push(String(e.error||e.message));});
const mkEd=(cfg)=>{const ed=w.document.createElement('room-overlay-card-editor');ed.setConfig(JSON.parse(JSON.stringify(cfg)));ed.hass={states:{},user:{name:'x'}};w.document.body.appendChild(ed);return ed;};
const LY={portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}};

(async()=>{
  // 1) "Save migrated config" button
  const ed1=mkEd({base_image:'/local/x.webp',aspect_ratio:{mobile:'4/3',desktop:'16/9'},zones:[{id:'z1',top:'1%',left:'1%',width:'5%',height:'5%'}]});
  const btn=ed1.querySelector('#roc-mig-save');
  let fired=0;ed1.addEventListener('config-changed',()=>fired++);
  errors.length=0;
  let threw=null;
  try{btn.click();}catch(e){threw=e;}
  await sleep(10);
  console.log('  errors:',errors,'threw:',threw&&threw.message,'config-changed fired:',fired);
  t('"Save migrated config" works without ReferenceError (BUG if FAIL)',!threw&&errors.length===0&&fired>0);

  // 2) elements: per-profile overrides survive a collect
  const ed2=mkEd({base_image:'/local/x.webp',layout:LY,elements:[{id:'e1',top:'10%',left:'10%',width:'20%',height:'20%',card:{type:'markdown',content:'x'},landscape:{width:'40%'},portrait:{top:'50%'},visible_template:'{{ true }}'}]});
  const c2=ed2._collectConfig();
  console.log('  collected element:',JSON.stringify(c2.elements[0]));
  t('element keeps landscape: override after editor collect (BUG if FAIL)',!!c2.elements[0].landscape);
  t('element keeps portrait: override after editor collect (BUG if FAIL)',!!c2.elements[0].portrait);
  t('element keeps visible_template',c2.elements[0].visible_template==='{{ true }}');

  // 3) badge nav_mini checkbox vs YAML box under nav.live:full
  const ed3=mkEd({rooms:[{id:'a',base_image:'/local/a.webp',badges:[{id:'b1',icon:'mdi:x',label:'hi',nav_mini:false}]},{id:'b',base_image:'/local/b.webp'}],nav:{live:'full'},layout:LY});
  const cb=ed3.querySelector('[data-b-nav-mini="0"]');
  t('badge nav_mini checkbox rendered + checked (hide from full)',!!cb&&cb.checked);
  cb.checked=false; // user un-hides it
  const c3=ed3._collectConfig();
  console.log('  badge after uncheck:',JSON.stringify(c3.rooms[0].badges[0]));
  t('unchecking badge "Hide from mini" removes nav_mini:false (BUG if FAIL)',c3.rooms[0].badges[0].nav_mini===undefined);

  // 4) Edit-mode preview receives scalar edits?
  const ed4=mkEd({base_image:'/local/x.webp',layout:LY,test_mode:true,icons:[{id:'i1',icon:'mdi:lamp',top:'10%',left:'10%',color:'#fff'}]});
  await sleep(20);
  t('preview card mounted',!!ed4._prevCard);
  const icoIn=ed4.querySelector('[data-ico-icon="0"]');
  icoIn.value='mdi:sofa';
  icoIn.dispatchEvent(new w.Event('change',{bubbles:true}));
  icoIn.dispatchEvent(new w.Event('input',{bubbles:true}));
  await sleep(300);
  // simulate HA echoing the config back to the editor (what HA does after config-changed)
  let last=null;ed4.addEventListener('config-changed',e=>last=e.detail.config);
  icoIn.dispatchEvent(new w.Event('change',{bubbles:true}));
  await sleep(300);
  if(last){const echo=JSON.parse(JSON.stringify(last));delete echo.type;ed4.setConfig(echo);}
  await sleep(50);
  console.log('  editor icon:',ed4._config.icons[0].icon,'| preview icon:',ed4._prevCard&&ed4._prevCard._config.icons[0].icon);
  t('Edit-mode preview reflects an icon change (BUG if FAIL)',ed4._prevCard&&ed4._prevCard._config.icons[0].icon==='mdi:sofa');

  // 5) YAML subset: multi-line string round trip through a YAML box
  const tpl="{{ states('sensor.a') }}\n{{ states('sensor.b') }}";
  const dumped=w.__y.s({visible_template:tpl});
  console.log('  dumped:',JSON.stringify(dumped));
  const parsed=w.__y.p(dumped);
  console.log('  parsed back:',JSON.stringify(parsed));
  t('multi-line string survives _yaml.s -> _yaml.p (BUG if FAIL)',!!parsed&&parsed.visible_template===tpl);
  // nested flow mapping
  const p2=w.__y.p('visible: { entity: light.a, state: "on", and: { entity: light.b, state: "on" } }');
  console.log('  nested flow parsed:',JSON.stringify(p2));
  t('nested flow mapping parses correctly (BUG if FAIL)',!!p2&&p2.visible&&p2.visible.and&&p2.visible.and.entity==='light.b');
  // block scalar
  const p3=w.__y.p('template: >-\n  {{ states("sensor.a") }}\n  °C');
  console.log('  block scalar parsed:',JSON.stringify(p3));
  t('block scalar >- parses (BUG if FAIL)',!!p3&&typeof p3.template==='string'&&p3.template.indexOf('states')>=0);
  // inline comment
  const p4=w.__y.p('entity: light.a # the lamp\nstate: "on"');
  console.log('  inline comment parsed:',JSON.stringify(p4));
  t('inline comment stripped (BUG if FAIL)',!!p4&&p4.entity==='light.a');
  process.exit(fails?1:0);
})();
