#!/usr/bin/env node
/**
 * v4 layout engine render tests (jsdom): grid + regions, profile switching,
 * v3 auto-migration, cover dock/float, test-mode overlay, editor Layout tab.
 * Usage: node tests/render.test.js [path-to-card.js]  (requires: npm i -D jsdom)
 */
// v4 jsdom render sanity: grid, regions, profile switch, migration, cover dock
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.log('jsdom not installed - skipping render tests (npm i -D jsdom)');process.exit(0);}
const fs=require('fs');
const path=require('path');
const code=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.innerWidth=1920;w.innerHeight=1080;
w.requestIdleCallback=f=>setTimeout(f,0);
w.loadCardHelpers=undefined;
w.eval(code);
let fails=0;const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};

const mkCard=(cfg)=>{const el=w.document.createElement('room-overlay-card');el.setConfig(cfg);el.hass={states:{},callService(){},user:{name:'x'}};w.document.body.appendChild(el);return el;};

// --- v3 config auto-migrates and renders a grid ---
const v3cfg={base_image:'/local/x.webp',aspect_ratio:{mobile:'4/3',desktop:'16/9'},max_height:'70vh',cards_above:[{type:'markdown',content:'hi'}],blinds:[{id:'bl',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'20%',control:{placement:{portrait:'float',landscape:'dock'},presets:[{position:50,icon:'mdi:blinds'}]}}]};
const el=mkCard(v3cfg);
t('migrated layout present',!!el._config.layout&&!!el._config.layout.landscape);
t('profile landscape @1920x1080',el._profile==='landscape');
const grid=el.shadowRoot.querySelector('.roc-grid');
t('grid rendered',!!grid&&/display:grid/.test(grid.getAttribute('style')));
t('rows are %',/grid-template-rows:[^;]*%/.test(grid.getAttribute('style')));
const regs=[...el.shadowRoot.querySelectorAll('.roc-reg')].map(r=>r.dataset.reg);
t('image region',regs.includes('image'));
t('cards_above region',regs.includes('cards_above'));
t('cover region (dock on landscape)',regs.includes('cover'));
t('dock controller visible',(function(){const cc=el.shadowRoot.querySelector('.roc-cc[data-cc-mode="dock"]');return!!cc&&!/display:none/.test(cc.getAttribute('style'));})());
t('no float popover on landscape',!el.shadowRoot.querySelector('.roc-cc[data-cc-mode="float"]'));
t('ha-card has height',/height:/.test(el.shadowRoot.querySelector('ha-card').getAttribute('style')));
t('wrap fills region (no padding-bottom)',!/padding-bottom/.test(el.shadowRoot.querySelector('style').textContent.match(/\.wrap\{[^}]*\}/)[0]));

// --- portrait switch ---
w.innerWidth=390;w.innerHeight=800;
el._rendered=false;el._render();
t('profile portrait @390x800',el._profile==='portrait');
t('float popover on portrait',!!el.shadowRoot.querySelector('.roc-cc[data-cc-mode="float"]'));
t('no cover region on portrait (float takes no grid space)',![...el.shadowRoot.querySelectorAll('.roc-reg')].some(r=>r.dataset.reg==='cover'&&r.innerHTML.trim()!==''&&r.querySelector('.roc-cc')));

// --- portrait, default viewport height → NATURAL (content) height, not a forced pin ---
t('portrait default height → ha-card auto (not forced pin)',/height:\s*auto\s*;/.test(el.shadowRoot.querySelector('ha-card').getAttribute('style')));
const elPortNat=(()=>{const c=mkCard({base_image:'/local/x.webp',aspect_ratio:'4/3',layout:{portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}}});return c;})();
t('portrait natural height forces wrap aspect-ratio even for a plain % row (not literal auto)',/aspect-ratio:1.3333/.test(elPortNat.shadowRoot.querySelector('.wrap').getAttribute('style')||''));
const elPortContainer=mkCard({base_image:'/local/x.webp',layout:{height:'container',portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}}});
t('portrait explicit layout.height:container is honoured (not overridden to natural)',/height:\s*100%\s*;/.test(elPortContainer.shadowRoot.querySelector('ha-card').getAttribute('style')));
t('_editBarHeight is a safe no-op with no edit-mode ancestor',el._editBarHeight()===0);

// --- v4 explicit layout: hidden region + span ---
w.innerWidth=1920;w.innerHeight=1080;
const el2=mkCard({base_image:'/local/x.webp',cards_above:[{type:'markdown',content:'hi'}],layout:{landscape:{columns:[85,15],rows:[10,90],place:{image:{row:2,col:1},nav:{row:1,col:'1/3'}}},portrait:{rows:[100],place:{image:{row:1}}}}});
const regs2=[...el2.shadowRoot.querySelectorAll('.roc-reg')].map(r=>r.dataset.reg);
t('unplaced cards_above hidden',!regs2.includes('cards_above'));
t('image placed row2',/grid-row:2/.test(el2.shadowRoot.querySelector('[data-reg="image"]').getAttribute('style')));

// --- empty placed regions are skipped (rooms share cells / auto rows collapse) ---
const el2b=mkCard({base_image:'/local/x.webp',layout:{landscape:{rows:['auto','1fr'],place:{lights:{row:1},cards_above:{row:1},image:{row:2}}},portrait:{rows:[100],place:{image:{row:1}}}}});
t('empty lights+cards_above regions skipped',[...el2b.shadowRoot.querySelectorAll('.roc-reg')].map(r=>r.dataset.reg).join(',')==='image');
t('auto/1fr tracks pass through',/grid-template-rows:auto 1fr;/.test(el2b.shadowRoot.querySelector('.roc-grid').getAttribute('style')));

// --- dock orientation follows grid placement ---
const ccCfg={id:'bl',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'20%',control:{placement:'dock'}};
const elBottom=mkCard({base_image:'/local/x.webp',blinds:[JSON.parse(JSON.stringify(ccCfg))],layout:{landscape:{rows:['1fr','auto'],place:{image:{row:1},cover:{row:2}}},portrait:{rows:[100],place:{image:{row:1}}}}});
t('bottom dock is horizontal (cc-h)',(function(){const cc=elBottom.shadowRoot.querySelector('.roc-cc[data-cc-mode="dock"]');return!!cc&&cc.classList.contains('cc-h');})());
t('bottom dock wrapper stacks vertically',elBottom.shadowRoot.querySelector('.roc-ccdock').classList.contains('ccd-h'));
const elSide=mkCard({base_image:'/local/x.webp',blinds:[JSON.parse(JSON.stringify(ccCfg))],layout:{landscape:{columns:['1fr','auto'],rows:[100],place:{image:{row:1},cover:{row:1,col:2}}},portrait:{rows:[100],place:{image:{row:1}}}}});
t('side dock is vertical (no cc-h)',(function(){const cc=elSide.shadowRoot.querySelector('.roc-cc[data-cc-mode="dock"]');return!!cc&&!cc.classList.contains('cc-h');})());

// --- packed grid + intrinsic image row ---
const elPack=mkCard({base_image:'/local/x.webp',aspect_ratio:'16/9',layout:{landscape:{rows:['auto','auto'],place:{image:{row:1},cards_below:{row:2}}},portrait:{rows:[100],place:{image:{row:1}}}}});
t('grid align-content start',/align-content:start/.test(elPack.shadowRoot.querySelector('.roc-grid').getAttribute('style')));
t('auto image row → wrap aspect-ratio',/aspect-ratio:1.7778/.test(elPack.shadowRoot.querySelector('.wrap').getAttribute('style')||''));
const elFr=mkCard({base_image:'/local/x.webp',layout:{landscape:{rows:['auto','1fr'],place:{lights:{row:1},image:{row:2}}},portrait:{rows:[100],place:{image:{row:1}}}}});
t('1fr image row → no wrap aspect',!/aspect-ratio/.test(elFr.shadowRoot.querySelector('.wrap').getAttribute('style')||''));

// --- test mode: region tags + profile button ---
const el3=mkCard({base_image:'/local/x.webp',test_mode:true,layout:{landscape:{rows:[10,90],place:{image:{row:2},lights:{row:1}}},portrait:{rows:[100],place:{image:{row:1}}}}});
t('region tag rendered',!!el3.shadowRoot.querySelector('.roc-regtag'));
t('profile button rendered',!!el3.shadowRoot.querySelector('.tm-prof'));
t('tm-info shows profile',/profile: landscape/.test(el3.shadowRoot.querySelector('.tm-info').innerHTML));
el3.shadowRoot.querySelector('.tm-prof').click();
t('profile button flips to portrait',el3._profile==='portrait'&&/PORTRAIT/.test(el3.shadowRoot.querySelector('.tm-prof').innerHTML));

// --- ghost renders image-only ---
const g4=w.document.createElement('room-overlay-card');
const gcfg=JSON.parse(JSON.stringify(el._config));gcfg._roc_ghost=true;gcfg.test_mode=false;
g4.setConfig(gcfg);g4.hass={states:{},callService(){}};w.document.body.appendChild(g4);
const gregs=[...g4.shadowRoot.querySelectorAll('.roc-reg')].map(r=>r.dataset.reg);
t('ghost = image region only',gregs.length===1&&gregs[0]==='image');
t('ghost ha-card 100%',/height:100%/.test(g4.shadowRoot.querySelector('ha-card').getAttribute('style')));

// --- editor: migration banner + layout tab ---
const ed=w.document.createElement('room-overlay-card-editor');
ed.setConfig({base_image:'/local/x.webp',aspect_ratio:{mobile:'4/3',desktop:'16/9'},zones:[{id:'z1',top:'1%',left:'1%',width:'5%',height:'5%'}]});
ed.hass={states:{},user:{name:'x'}};
t('editor migrated flag',ed._wasMigrated===true);
t('editor banner',!!ed.querySelector('#roc-mig-save'));
t('editor layout inputs',!!ed.querySelector('#ly-hmode')&&!!ed.querySelector('#ly-rows__portrait')&&!!ed.querySelector('#ly-r__landscape__cover'));
t('editor per-profile aspect inputs',!!ed.querySelector('#aspect_ratio__portrait')&&!ed.querySelector('#aspect_ratio__mobile'));
t('editor rows prefilled from migration',ed.querySelector('#ly-rows__landscape').value.length>0);
t('base_image label has no bare unexplained asterisk',!/Base image URL \*/.test(ed.innerHTML));
t('base_image field has a /local/ placeholder',ed.querySelector('#base_image').placeholder.indexOf('/local/')===0);
t('Companion cards YAML intro text only shows in Advanced/YAML mode',
  (()=>{const introEl=[...ed.querySelectorAll('label.roc-l')].find(l=>l.textContent.indexOf('Companion cards')===0);
    return !!introEl&&introEl.closest('.roc-adv')!==null;})());

// --- Background mode toggle (Image/Camera) — mutually exclusive, panes swap, refresh label is honest ---
{
  const edImg=w.document.createElement('room-overlay-card-editor');
  edImg.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{}});
  edImg.hass={states:{},user:{name:'x'}};
  t('bg-mode defaults to "image" when only base_image is set',edImg.querySelector('#bg-mode').value==='image');
  t('image pane visible, camera pane hidden by default',
    edImg.querySelector('#bg-pane-image').style.display==='block'&&edImg.querySelector('#bg-pane-camera').style.display==='none');
  t('camera refresh label clarifies it is a snapshot, not a live stream',
    /not a continuous video stream/.test(edImg.innerHTML));

  const edCam=w.document.createElement('room-overlay-card-editor');
  edCam.setConfig({type:'custom:room-overlay-card',base_camera:'camera.living_room',layout:{}});
  edCam.hass={states:{},user:{name:'x'}};
  t('bg-mode defaults to "camera" when only base_camera is set',edCam.querySelector('#bg-mode').value==='camera');
  t('camera pane visible, image pane hidden when base_camera is set',
    edCam.querySelector('#bg-pane-camera').style.display==='grid'&&edCam.querySelector('#bg-pane-image').style.display==='none');

  // Pre-existing config with BOTH set (the exact footgun reported) — collecting
  // (any save) must enforce exclusivity per the active mode, not silently keep both.
  const edBoth=w.document.createElement('room-overlay-card-editor');
  edBoth.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',base_camera:'camera.living_room',layout:{}});
  edBoth.hass={states:{},user:{name:'x'}};
  t('mode defaults to camera when both are already set (matches runtime precedence)',edBoth.querySelector('#bg-mode').value==='camera');
  const collected=edBoth._collectConfig();
  t('collecting a stale both-set config drops base_image, keeps base_camera',
    collected.base_camera==='camera.living_room'&&collected.base_image===undefined);

  // Switching the toggle swaps panes live and clears the other field on save
  let outToggle=null;
  edImg.addEventListener('config-changed',e=>{outToggle=e.detail.config;});
  const bgSel=edImg.querySelector('#bg-mode');
  bgSel.value='camera';
  bgSel.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('switching to camera mode swaps pane visibility without a full re-render needed',
    edImg.querySelector('#bg-pane-camera').style.display==='grid'&&edImg.querySelector('#bg-pane-image').style.display==='none');
  t('switching to camera mode clears base_image from the fired config',
    !!outToggle&&outToggle.base_image===undefined);

  // Pan & pinch-zoom and Filter transition still round-trip correctly after moving
  const edZm=w.document.createElement('room-overlay-card-editor');
  edZm.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},zoom:true,filter_transition:'1s linear'});
  edZm.hass={states:{},user:{name:'x'}};
  t('zoom checkbox prefilled next to the bg-mode toggle',edZm.querySelector('#zoom').checked===true);
  t('filter_transition field prefilled (now living in Image filters)',edZm.querySelector('#filter_transition').value==='1s linear');
  const collectedZm=edZm._collectConfig();
  t('zoom + filter_transition still round-trip through collect',collectedZm.zoom===true&&collectedZm.filter_transition==='1s linear');
}

// collect round-trip
let out=null;
ed.addEventListener('config-changed',e=>{out=e.detail.config;});
ed._collectConfig?ed._collectConfig():null;
ed.querySelector('#ly-rows__landscape').value='10, 20, 70';
ed.querySelector('#ly-r__landscape__image').value='3';
const ev=new w.Event('change',{bubbles:true});
ed.querySelector('#ly-rows__landscape').dispatchEvent(ev);
t('collect wrote layout rows',out&&out.layout&&JSON.stringify(out.layout.landscape.rows)==='[10,20,70]');
t('collect wrote image row',out&&out.layout.landscape.place.image.row===3);
t('collect kept aspect per-profile',out&&out.aspect_ratio&&out.aspect_ratio.portrait==='4/3');
t('collect dropped legacy keys',out&&out.max_height===undefined&&out.breakpoints===undefined);

// --- editor: nav.live:full option + mini-room settings sub-panel ---
// (nav.* settings only render for multi-room configs — single-room cards get
// the "Convert to multi-room" prompt instead — so this needs its own
// multi-room editor instance, separate from the single-room `ed` above.)
const edNav=w.document.createElement('room-overlay-card-editor');
let outNav=null;
edNav.addEventListener('config-changed',e=>{outNav=e.detail.config;});
edNav.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},rooms:[{id:'living',name:'Living'},{id:'hall',name:'Hall'}]});
edNav.hass={states:{},user:{name:'x'}};
t('nav-live select offers a full option',!!edNav.querySelector('#nav-live option[value="full"]'));
t('mini panel hidden by default (live not full)',/display:none/.test(edNav.querySelector('#nav-mini-panel').getAttribute('style')||''));
edNav.querySelector('#nav-live').value='full';
edNav.querySelector('#nav-live').dispatchEvent(new w.Event('change',{bubbles:true}));
t('mini panel shown once live:full picked',!/display:none/.test(edNav.querySelector('#nav-mini-panel').getAttribute('style')||''));
t('picking live:full fired the config change',outNav&&outNav.nav&&outNav.nav.live==='full');
edNav.querySelector('#nav-mini-templates').checked=true;
edNav.querySelector('#nav-mini-templates').dispatchEvent(new w.Event('change',{bubbles:true}));
edNav.querySelector('#nav-mini-camera-refresh').value='45';
edNav.querySelector('#nav-mini-camera-refresh').dispatchEvent(new w.Event('change',{bubbles:true}));
edNav.querySelector('#nav-mini-width-ref').value='360';
edNav.querySelector('#nav-mini-width-ref').dispatchEvent(new w.Event('change',{bubbles:true}));
t('collect wrote nav.mini.templates',outNav&&outNav.nav&&outNav.nav.mini&&outNav.nav.mini.templates===true);
t('collect wrote nav.mini.camera_refresh',outNav&&outNav.nav&&outNav.nav.mini&&outNav.nav.mini.camera_refresh===45);
t('collect wrote nav.mini.width_ref',outNav&&outNav.nav&&outNav.nav.mini&&outNav.nav.mini.width_ref===360);
// round-trip: re-open the editor on a config that already has nav.mini set
const edMini=w.document.createElement('room-overlay-card-editor');
edMini.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},rooms:[{id:'living',name:'Living'},{id:'hall',name:'Hall'}],nav:{live:'full',mini:{templates:true,camera_refresh:45,width_ref:360}}});
edMini.hass={states:{},user:{name:'x'}};
t('mini panel pre-shown when loaded config already has live:full',!/display:none/.test(edMini.querySelector('#nav-mini-panel').getAttribute('style')||''));
t('mini fields prefilled from loaded config',edMini.querySelector('#nav-mini-templates').checked===true&&edMini.querySelector('#nav-mini-camera-refresh').value==='45'&&edMini.querySelector('#nav-mini-width-ref').value==='360');

// --- editor: nav.live:custom per-element "Show in mini" checkboxes (plan §13) ---
t('nav-live select offers a custom option',!!edNav.querySelector('#nav-live option[value="custom"]'));
const edCustom=w.document.createElement('room-overlay-card-editor');
let outCustom=null;
edCustom.addEventListener('config-changed',e=>{outCustom=e.detail.config;});
edCustom.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},
  rooms:[{id:'living',name:'Living',
    gauges:[{id:'g1',entity:'sensor.g'}],labels:[{id:'l1',entity:'sensor.l'}],icons:[{id:'i1',icon:'mdi:x'}],
    badges:[{id:'bd1',icon:'mdi:y'}],blinds:[{id:'bl1',entity:'cover.x'}],elements:[{id:'el1',card:{type:'markdown'}}]},
    {id:'hall',name:'Hall'}]});
edCustom.hass={states:{},user:{name:'x'}};
t('no "Show in mini" checkboxes when live is not custom',!edCustom.querySelector('[data-g-nav-mini]')&&!edCustom.querySelector('[data-lbl-nav-mini]'));
edCustom.querySelector('#nav-live').value='custom';
edCustom.querySelector('#nav-live').dispatchEvent(new w.Event('change',{bubbles:true}));
t('picking custom fired the config change',outCustom&&outCustom.nav&&outCustom.nav.live==='custom');
t('mini panel also shown for custom (nav.mini.* still applies)',!/display:none/.test(edCustom.querySelector('#nav-mini-panel').getAttribute('style')||''));
t('"Show in mini" checkbox appears on gauge/label/icon/badge/blind/element panels once custom is picked',
  !!edCustom.querySelector('[data-g-nav-mini="0"]')&&!!edCustom.querySelector('[data-lbl-nav-mini="0"]')&&
  !!edCustom.querySelector('[data-ico-nav-mini="0"]')&&!!edCustom.querySelector('[data-b-nav-mini="0"]')&&
  !!edCustom.querySelector('[data-bl-nav-mini="0"]')&&!!edCustom.querySelector('[data-el-nav-mini="0"]'));
t('zones do NOT get a "Show in mini" checkbox (not visual room content, per plan)',!edCustom.querySelector('[data-z-nav-mini]'));
edCustom.querySelector('[data-g-nav-mini="0"]').checked=true;
edCustom.querySelector('[data-g-nav-mini="0"]').dispatchEvent(new w.Event('change',{bubbles:true}));
t('collect wrote nav_mini:true on the checked gauge',outCustom&&outCustom.rooms&&outCustom.rooms[0].gauges[0].nav_mini===true);
t('collect left the unchecked label without nav_mini',outCustom&&outCustom.rooms&&outCustom.rooms[0].labels[0].nav_mini===undefined);
// weather toggle lives in the Basic tab, not an element panel
t('weather "Show in mini" toggle appears in Basic tab once custom is picked',!!edCustom.querySelector('#weather-nav-mini'));
edCustom.querySelector('#weather-nav-mini').checked=true;
edCustom.querySelector('#weather-nav-mini').dispatchEvent(new w.Event('change',{bubbles:true}));
t('collect wrote weather_nav_mini:true (room-scoped, since editor is showing that room)',outCustom&&outCustom.rooms&&outCustom.rooms[0].weather_nav_mini===true);
// round-trip: reopening on a config with nav_mini already set shows it checked
const edCustom2=w.document.createElement('room-overlay-card-editor');
edCustom2.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},nav:{live:'custom'},
  rooms:[{id:'living',name:'Living',weather_nav_mini:true,gauges:[{id:'g1',entity:'sensor.g',nav_mini:true}]}]});
edCustom2.hass={states:{},user:{name:'x'}};
t('nav_mini checkbox pre-checked when loaded config already has it',edCustom2.querySelector('[data-g-nav-mini="0"]').checked===true);
t('weather toggle pre-checked when loaded config already has weather_nav_mini',edCustom2.querySelector('#weather-nav-mini').checked===true);

// --- editor's Room select follows room switches made inside its own live preview ---
{
  const edRoomSync=w.document.createElement('room-overlay-card-editor');
  w.document.body.appendChild(edRoomSync);
  let outRoomSync=null;
  edRoomSync.addEventListener('config-changed',e=>{outRoomSync=e.detail.config;});
  edRoomSync.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},test_mode:true,
    rooms:[{id:'living',name:'Living',base_image:'/a.webp'},{id:'kitchen',name:'Kitchen',base_image:'/b.webp'}]});
  edRoomSync.hass={states:{},user:{name:'x'}};
  edRoomSync._render();
  t('preview mounts when Edit mode is on',!!edRoomSync._prevCard);
  t('editor starts on room 0',edRoomSync._editRoomIdx===0);
  if(edRoomSync._prevCard)edRoomSync._prevCard._switchRoom(1,1,true); // simulates a click in the preview's own nav strip
  t('editor follows the room switched to inside the preview',edRoomSync._editRoomIdx===1);
  const roomSelAfter=edRoomSync.querySelector('#room-select');
  t('Room select reflects the synced room',!!roomSelAfter&&roomSelAfter.value==='1');
  const roomIdField=edRoomSync.querySelector('#room-id');
  if(roomIdField){roomIdField.value='kitchen-edited';roomIdField.dispatchEvent(new w.Event('change',{bubbles:true}));}
  t('edit made after preview room-switch lands on the room now shown, not room 0',
    !!outRoomSync&&Array.isArray(outRoomSync.rooms)&&outRoomSync.rooms[1]&&outRoomSync.rooms[1].id==='kitchen-edited'&&outRoomSync.rooms[0].id==='living');
}

// --- v5.9.0: Test mode + Drag-edit preview merged into a single "Edit mode" toggle ---
{
  const edEdit=w.document.createElement('room-overlay-card-editor');
  w.document.body.appendChild(edEdit);
  let outEdit=null;
  edEdit.addEventListener('config-changed',e=>{outEdit=e.detail.config;});
  edEdit.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',
    rooms:[{id:'living',name:'Living'},{id:'kitchen',name:'Kitchen'}]});
  edEdit.hass={states:{},user:{name:'x'}};
  t('no separate Drag-edit preview checkbox remains',!edEdit.querySelector('#prev-on'));
  t('Edit mode checkbox present, off by default',!!edEdit.querySelector('#test_mode')&&edEdit.querySelector('#test_mode').checked===false);
  t('preview not mounted while Edit mode is off',!edEdit._prevCard&&!edEdit.querySelector('#roc-prev-host'));
  t('Room, Edit mode, Haptics and YAML all carry an icon',
    !!edEdit.querySelector('ha-icon[icon="mdi:door"]')&&!!edEdit.querySelector('ha-icon[icon="mdi:cursor-move"]')&&!!edEdit.querySelector('ha-icon[icon="mdi:vibrate"]')&&!!edEdit.querySelector('ha-icon[icon="mdi:code-braces"]'));
  const advBtn=edEdit.querySelector('#roc-adv-toggle');
  t('YAML toggle lives in the title row as an icon button right before Undo/Redo, not a labelled checkbox',
    advBtn&&advBtn.tagName==='BUTTON'&&!!advBtn.nextElementSibling&&advBtn.nextElementSibling.id==='roc-undo');
  const _verM=code.match(/const ROC_VERSION='([^']+)'/);
  const titleSpan=edEdit.querySelector('#roc-adv-toggle').parentElement.parentElement.firstElementChild;
  t('version number sits next to the "Room Overlay Card" title, not the button row',
    !!_verM&&!!titleSpan&&titleSpan.textContent.indexOf('Room Overlay Card')>=0&&titleSpan.textContent.indexOf('v'+_verM[1])>=0);
  t('YAML toggle off by default (advanced fields hidden)',
    !!edEdit.querySelector('.roc-ed').classList.contains('roc-hideadv'));
  advBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
  t('clicking YAML toggle reveals advanced fields',
    !edEdit.querySelector('.roc-ed').classList.contains('roc-hideadv'));
  advBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
  t('clicking YAML toggle again hides them',
    edEdit.querySelector('.roc-ed').classList.contains('roc-hideadv'));
  const tmBox=edEdit.querySelector('#test_mode');
  tmBox.checked=true;
  tmBox.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('checking Edit mode mounts the live preview immediately (no extra _render needed)',!!edEdit._prevCard&&!!edEdit.querySelector('#roc-prev-host'));
  t('checking Edit mode persists test_mode:true to the fired config',!!outEdit&&outEdit.test_mode===true);
  const tmBox2=edEdit.querySelector('#test_mode');
  tmBox2.checked=false;
  tmBox2.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('unchecking Edit mode unmounts the preview',!edEdit._prevCard&&!edEdit.querySelector('#roc-prev-host'));
  t('unchecking Edit mode deletes test_mode from the fired config',!!outEdit&&outEdit.test_mode===undefined);
}

// --- drag/resize edits relayed from the editor preview must not leak the preview's
// forced/stripped fields (test_mode, _roc_preview, url_sync, follow_mode) into the
// real saved config ---
{
  const edPos=w.document.createElement('room-overlay-card-editor');
  w.document.body.appendChild(edPos);
  let outPos=null;
  edPos.addEventListener('config-changed',e=>{outPos=e.detail.config;});
  edPos.setConfig({type:'custom:room-overlay-card',card_id:'possync',base_image:'/local/x.webp',layout:{},
    test_mode:true,url_sync:true,follow_mode:'initial',
    rooms:[{id:'living',name:'Living'},{id:'kitchen',name:'Kitchen'}]});
  edPos.hass={states:{},user:{name:'x'}};
  edPos._render();
  t('preview mounts for pos-relay test',!!edPos._prevCard);
  const previewCfg=edPos._prevCard?JSON.parse(JSON.stringify(edPos._prevCard._config)):null;
  t('sanity: mounted preview config lacks url_sync',!!previewCfg&&previewCfg.url_sync===undefined);
  t('sanity: mounted preview config forces follow_mode manual',!!previewCfg&&previewCfg.follow_mode==='manual');
  t('sanity: mounted preview config forces test_mode true',!!previewCfg&&previewCfg.test_mode===true);
  if(previewCfg)w.dispatchEvent(new w.CustomEvent('roc-pos-update',{detail:{config:previewCfg}}));
  t('drag/resize relay restores url_sync from the real config',edPos._config.url_sync===true);
  t('drag/resize relay restores follow_mode from the real config',edPos._config.follow_mode==='initial');
  t('drag/resize relay strips the _roc_preview marker',edPos._config._roc_preview===undefined);
  t('drag/resize relay keeps test_mode true (Edit mode is the real config value here)',edPos._config.test_mode===true);
  t('fired config also carries the restored url_sync/follow_mode',!!outPos&&outPos.url_sync===true&&outPos.follow_mode==='initial');
}

// --- editor preview (_roc_preview) root height: aspect-derived, not a guessed fixed px
// (was hardcoded 420px regardless of actual nav/lights/image content -> blank gap below) ---
{
  const prevCfg={type:'custom:room-overlay-card',_roc_preview:true,base_image:'/local/x.webp',aspect_ratio:'16/9',
    layout:{landscape:{rows:[15,85],place:{nav:{row:1},image:{row:2}}},portrait:{rows:[100],place:{image:{row:1}}}}};
  const cardPrev=mkCard(prevCfg);
  const haCardPrev=cardPrev.shadowRoot.querySelector('ha-card');
  t('editor preview ha-card height is auto, not a fixed guessed px',haCardPrev.style.height==='auto');
  const wrapPrev=cardPrev.shadowRoot.querySelector('.wrap');
  t('editor preview .wrap gets an aspect-ratio lock matching aspect_ratio',(wrapPrev.getAttribute('style')||'').indexOf('aspect-ratio:'+(16/9).toFixed(4))>=0);
}

// --- editor opens on the room the card was showing (in-memory store) ---
const _memCfg={type:'custom:room-overlay-card',card_id:'memcard',base_image:'/local/m.webp',layout:{},rooms:[{id:'living',name:'Living'},{id:'hall',name:'Hall'}]};
const cardM=w.document.createElement('room-overlay-card');
cardM._config=_memCfg;cardM._roomIdx=1;cardM._rememberRoom();
const edM=w.document.createElement('room-overlay-card-editor');
w.document.body.appendChild(edM);
edM.setConfig(_memCfg);
t('editor opens on the card-viewed room (in-memory, no url_sync)',edM._editRoomIdx===1);
// a fresh card rendering at room 0 (HA recreates cards entering edit) must NOT clobber
const cardC=w.document.createElement('room-overlay-card');
cardC.setConfig(_memCfg);
w.document.body.appendChild(cardC);
cardC.hass={states:{},user:{name:'x'}};
const edC=w.document.createElement('room-overlay-card-editor');
w.document.body.appendChild(edC);
edC.setConfig(_memCfg);
t('passive card render does not clobber remembered room',edC._editRoomIdx===1);
// --- url_sync hash fallback when the store has no entry ---
try{w.location.hash='#room=hall';}catch(_){}
const edH=w.document.createElement('room-overlay-card-editor');
w.document.body.appendChild(edH);
edH.setConfig({type:'custom:room-overlay-card',card_id:'hashcard',url_sync:true,layout:{},rooms:[{id:'living',name:'Living'},{id:'hall',name:'Hall'}]});
t('editor falls back to url_sync hash',edH._editRoomIdx===1);
edH._editRoomIdx=0;edH.setConfig({type:'custom:room-overlay-card',card_id:'hashcard',url_sync:true,layout:{},rooms:[{id:'living',name:'Living'},{id:'hall',name:'Hall'}]});
t('room picker choice survives later setConfig',edH._editRoomIdx===0);
// --- nothing to go on -> first room ---
try{w.location.hash='';}catch(_){}
const edN=w.document.createElement('room-overlay-card-editor');
w.document.body.appendChild(edN);
edN.setConfig({type:'custom:room-overlay-card',card_id:'nocard',layout:{},rooms:[{id:'living'},{id:'hall'}]});
t('no store + no url_sync -> editor stays on first room',edN._editRoomIdx===0);
// --- editor writes url_sync hash to drive HA's native preview ---
const _hwCfg={type:'custom:room-overlay-card',card_id:'hwcard',url_sync:'room',base_image:'/local/x.webp',layout:{},rooms:[{id:'living'},{id:'hall'}]};
const cardHW=w.document.createElement('room-overlay-card');cardHW._config=_hwCfg;cardHW._roomIdx=1;cardHW._rememberRoom();
try{w.location.hash='';}catch(_){}
const edHW=w.document.createElement('room-overlay-card-editor');w.document.body.appendChild(edHW);
edHW.setConfig(_hwCfg);
t('editor opens on remembered room and writes url_sync hash',edHW._editRoomIdx===1&&/(^|[#&])room=hall(&|$)/.test(String(w.location.hash)));

// --- v4.6.0 root-height engine: scroll-container pin ---
const _rhCfg={type:'custom:room-overlay-card',aspect_ratio:'1720/914',lock_aspect:true,
  layout:{portrait:{rows:['auto','1fr'],place:{nav:{row:1},image:{row:2}}},landscape:{rows:['auto','1fr'],place:{nav:{row:1},image:{row:2}}}},
  rooms:[{id:'r1',base_image:'/a.png',badges:[{id:'vac',position:'bottom-left',icon:'mdi:x',label:[{value:'A'}]}]},
         {id:'r2',base_image:'/b.png',badges:[{id:'vac2',position:'bottom-left',icon:'mdi:x',label:[{value:'B'}]}]}]};
const cardRH=mkCard(_rhCfg);
t('scrollParent falls back to documentElement',cardRH._scrollParent()===w.document.documentElement);
// corner badges stay pinned to the visible .wrap (not the cover stage)
const _b1=cardRH.shadowRoot.querySelector('[data-b="vac"]');
t('corner badge pinned to .wrap',!!_b1&&_b1.parentElement.classList.contains('wrap'));
// a previously pinned px height survives the re-render a room switch causes
cardRH._rootHPx=777;
cardRH._switchRoom(1,1,true);
const _rhCard=cardRH.shadowRoot.querySelector('ha-card');
t('pinned root height survives room switch',_rhCard.getAttribute('style').indexOf('height:777px')>=0);
const _b2=cardRH.shadowRoot.querySelector('[data-b="vac2"]');
t('corner badge pinned to .wrap after switch',!!_b2&&_b2.parentElement.classList.contains('wrap'));
// _layoutRootHeight must not throw without layout boxes (jsdom rects are 0)
let _rhThrew=false;try{cardRH._layoutRootHeight();}catch(_){_rhThrew=true;}
t('layoutRootHeight safe without layout boxes',!_rhThrew);
// v4.6.1 budget-fit: present, safe without boxes, and skipped in natural portrait
t('layoutFitWrap exists',typeof cardRH._layoutFitWrap==='function');
let _fwThrew=false;try{cardRH._layoutFitWrap();}catch(_){_fwThrew=true;}
t('layoutFitWrap safe without layout boxes',!_fwThrew);
const _fwWrap=cardRH.shadowRoot.querySelector('.wrap');
const _fwProf=cardRH._profile;cardRH._profile='portrait';
const _fwH=_fwWrap.style.height;cardRH._layoutFitWrap();
t('layoutFitWrap no-op in natural portrait',_fwWrap.style.height===_fwH);
cardRH._profile=_fwProf;
// v4.6.4: observer wiring is a method (rewired on reconnect), edit transitions covered
t('wireLayoutObservers exists',typeof cardRH._wireLayoutObservers==='function');
t('location-changed listener installed',typeof cardRH._locHandler==='function');
let _rcThrew=false;
try{
  const _par=cardRH.parentNode;
  _par.removeChild(cardRH);   // HA-style move: disconnect…
  _par.appendChild(cardRH);   // …and reconnect — must rewire, not crash
}catch(_){_rcThrew=true;}
t('disconnect/reconnect cycle safe',!_rcThrew&&cardRH._rendered===true);
t('listener survives reconnect',typeof cardRH._locHandler==='function');

// --- nav.live:full Phase 0: _roc_mini shares the ghost's collapsed grid but
// NOT its 100%-stretch height — a mini renders at a fixed reference width
// with its OWN aspect-derived height (auto, via an aspect-ratio'd .wrap),
// never stretched to fit an externally-dictated box, or it'd distort when
// scaled (NAV_LIVE_FULL_PLAN.md §3/§6 — corrected mid-session, see project
// memory). This jsdom fixture has no ResizeObserver and no HUI-PANEL-VIEW
// ancestor, so _ro/_scRo/_bodyRo/_pvMo creation itself isn't observable here
// for ANY card (restricted or not) — that part is verified by code reading,
// same as other browser-API-gated paths in this suite. What IS observable
// and discriminating: the render-shape (grid/root-height/wrap aspect) and
// the plain window-event _locHandler wiring, no special browser API needed.
const _miniCfg={type:'custom:room-overlay-card',_roc_mini:true,base_image:'/local/x.webp'};
const cardMini=mkCard(_miniCfg);
t('mini gets auto root height (aspect-derived, not stretched)',/height:auto/.test(cardMini.shadowRoot.querySelector('ha-card').getAttribute('style')));
t('mini wrap gets an aspect-ratio lock',/aspect-ratio:/.test(cardMini.shadowRoot.querySelector('.wrap').getAttribute('style')||''));
const _miniRegs=[...cardMini.shadowRoot.querySelectorAll('.roc-reg')].map(r=>r.dataset.reg);
t('mini collapses to image-only grid',_miniRegs.length===1&&_miniRegs[0]==='image');
t('mini skips location-changed listener',!cardMini._locHandler);
// ghost (unaffected by the correction — still stretches to 100%, its real use case)
const cardGhostShape=mkCard({type:'custom:room-overlay-card',_roc_ghost:true,base_image:'/local/x.webp'});
t('ghost still gets 100% root height (fills its exact-fit swipe container)',/height:100%/.test(cardGhostShape.shadowRoot.querySelector('ha-card').getAttribute('style')));
// same restriction applies to the existing swipe-ghost/preview flags
const cardGhost=mkCard({type:'custom:room-overlay-card',_roc_ghost:true,_roc_preview:true,base_image:'/local/x.webp'});
t('ghost also skips location-changed listener',!cardGhost._locHandler);
// a normal (unrestricted) card is unaffected — still installs it (pre-existing
// assertion above, 'location-changed listener installed', covers this too)
t('normal card still installs location-changed listener',typeof cardRH._locHandler==='function');

// --- nav.live:full step 3: mount + scale wrapper (NAV_LIVE_FULL_PLAN.md §6) ---
const _navFullCfg={type:'custom:room-overlay-card',card_id:'navfull',
  nav:{style:'thumbnails',live:'full'},
  rooms:[{id:'r0',base_image:'/a.webp'},{id:'r1',base_image:'/b.webp'}]};
const cardNavFull=mkCard(_navFullCfg);
const _mini0=cardNavFull.shadowRoot.querySelector('[data-thumb-mini="0"] room-overlay-card');
const _mini1=cardNavFull.shadowRoot.querySelector('[data-thumb-mini="1"] room-overlay-card');
t('nav.live:full mounts one nested room-overlay-card per thumbnail',!!_mini0&&!!_mini1);
t('each mini is pinned to its OWN room index',_mini0._roomIdx===0&&_mini1._roomIdx===1);
t('mini instances tracked in _navMiniEls, keyed by room index',cardNavFull._navMiniEls[0].el===_mini0&&cardNavFull._navMiniEls[1].el===_mini1);
t('mini config is restricted (_roc_mini) and never shows its own nav',_mini0._config._roc_mini===true&&_mini0._config.nav.style==='none');
// hass forwarding reaches mounted minis (hass is a setter-only property —
// no getter — so compare against the internal _hass field, not cardNavFull.hass)
cardNavFull.hass={states:{},callService(){},user:{name:'x'}};
t('hass forwarding reaches mounted minis',_mini0._hass===cardNavFull._hass);
// nav.live:'composite' (existing, unaffected) never mounts mini instances
const cardComposite=mkCard({type:'custom:room-overlay-card',nav:{style:'thumbnails',live:'composite'},rooms:[{id:'r0',base_image:'/a.webp'},{id:'r1',base_image:'/b.webp'}]});
t('nav.live:composite does not mount mini instances (unaffected by this feature)',!cardComposite.shadowRoot.querySelector('[data-thumb-mini]'));

// --- nav.live:custom — shares full's mount mechanism, filters by nav_mini (plan §13) ---
const _navCustomCfg={type:'custom:room-overlay-card',card_id:'navcustom',
  nav:{style:'thumbnails',live:'custom'},
  gauges:[{id:'g1',entity:'sensor.g',nav_mini:true},{id:'g2',entity:'sensor.g2'}],
  rooms:[{id:'r0',base_image:'/a.webp'},{id:'r1',base_image:'/b.webp'}]};
const cardNavCustom=mkCard(_navCustomCfg);
const _miniC0=cardNavCustom.shadowRoot.querySelector('[data-thumb-mini="0"] room-overlay-card');
t('nav.live:custom mounts a mini too (same mechanism as full)',!!_miniC0);
t('nav.live:custom mini config is pre-filtered to only nav_mini:true elements',_miniC0._config.gauges.length===1&&_miniC0._config.gauges[0].id==='g1');

// v5.0: coalesced pin entry + shared row-span helpers
t('requestPin exists',typeof cardRH._requestPin==='function');
let _rpThrew=false;try{cardRH._requestPin('test');cardRH._requestPin('test2');}catch(_){_rpThrew=true;}
t('requestPin coalesces without throwing',!_rpThrew&&cardRH._pinQueued===true);
t('rocRowStart parses spans',w.eval('rocRowStart("3/6")')===3&&w.eval('rocRowStart(2)')===2);
t('rocRowEnd parses spans',w.eval('rocRowEnd("3/6")')===6&&w.eval('rocRowEnd(2)')===3);

// --- haptic on hold-registered (ROADMAP E7) — fires the MOMENT a hold
// threshold is reached, distinct from _exec()'s existing execute-time haptic
// ---
(async function(){
  const hapticCfg={type:'custom:room-overlay-card',base_image:'/local/x.webp',test_mode:false,
    zones:[{id:'hz',top:'10%',left:'10%',width:'10%',height:'10%',hold_delay:20,
      hold_action:{action:'toggle',entity:'light.x'}}]};
  const hapticCard=mkCard(hapticCfg);
  const seen=[];
  const onHaptic=(e)=>seen.push(e.detail);
  w.addEventListener('haptic',onHaptic);
  const zEl=hapticCard._zoneEls['hz'];
  zEl.dispatchEvent(new w.Event('mousedown',{bubbles:true}));
  await new Promise(r=>setTimeout(r,60));
  w.removeEventListener('haptic',onHaptic);
  t('haptic fires on hold-registered (default on)',seen.includes('medium'));

  // opt-out: top-level haptic:false suppresses BOTH the hold-registered tick
  // and the existing execute-time haptic
  const hapticOffCfg=JSON.parse(JSON.stringify(hapticCfg));hapticOffCfg.haptic=false;
  const hapticCardOff=mkCard(hapticOffCfg);
  const seenOff=[];
  const onHapticOff=(e)=>seenOff.push(e.detail);
  w.addEventListener('haptic',onHapticOff);
  const zElOff=hapticCardOff._zoneEls['hz'];
  zElOff.dispatchEvent(new w.Event('mousedown',{bubbles:true}));
  await new Promise(r=>setTimeout(r,60));
  w.removeEventListener('haptic',onHapticOff);
  t('haptic:false suppresses the hold-registered tick',!seenOff.includes('medium'));

  // editor: "Haptic feedback" checkbox in the persistent header, default checked
  const edHaptic=w.document.createElement('room-overlay-card-editor');
  edHaptic.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp'});
  edHaptic.hass={states:{},user:{name:'x'}};
  t('haptic checkbox present and checked by default',!!edHaptic.querySelector('#haptic')&&edHaptic.querySelector('#haptic').checked===true);
  let outHaptic=null;
  edHaptic.addEventListener('config-changed',e=>{outHaptic=e.detail.config;});
  edHaptic.querySelector('#haptic').checked=false;
  edHaptic.querySelector('#haptic').dispatchEvent(new w.Event('change',{bubbles:true}));
  t('unchecking haptic writes haptic:false',outHaptic&&outHaptic.haptic===false);
  const edHapticOff=w.document.createElement('room-overlay-card-editor');
  edHapticOff.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',haptic:false});
  edHapticOff.hass={states:{},user:{name:'x'}};
  t('haptic checkbox unchecked when config already has haptic:false',edHapticOff.querySelector('#haptic').checked===false);

  console.log(fails?('FAILURES: '+fails):'ALL RENDER TESTS PASSED');
  process.exit(fails?1:0);
})();
