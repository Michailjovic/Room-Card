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

// --- editor: Layout tab — Portrait/Landscape sub-tabs + illustrative mini grid preview ---
t('layout sub-tab buttons present',!!ed.querySelector('[data-rocsub="portrait"]')&&!!ed.querySelector('[data-rocsub="landscape"]'));
t('portrait sub-panel visible by default',ed.querySelector('[data-rocsubpanel="portrait"]').style.display==='block');
t('landscape sub-panel hidden by default',ed.querySelector('[data-rocsubpanel="landscape"]').style.display==='none');
ed.querySelector('[data-rocsub="landscape"]').dispatchEvent(new w.Event('click',{bubbles:true}));
t('clicking Landscape sub-tab shows it',ed.querySelector('[data-rocsubpanel="landscape"]').style.display==='block');
t('clicking Landscape sub-tab hides Portrait',ed.querySelector('[data-rocsubpanel="portrait"]').style.display==='none');
t('mini preview divs present for both profiles',!!ed.querySelector('#ly-preview__portrait')&&!!ed.querySelector('#ly-preview__landscape'));
t('landscape preview pre-filled from migrated config (image region block present)',/Image/.test(ed.querySelector('#ly-preview__landscape').innerHTML));
const _lyNavRow=ed.querySelector('#ly-r__landscape__nav');
_lyNavRow.value='1';
_lyNavRow.dispatchEvent(new w.Event('input',{bubbles:true}));
t('typing a region row repaints its mini preview live (no full re-render)',/Nav/.test(ed.querySelector('#ly-preview__landscape').innerHTML));
t('...and the field that was typed into keeps its value (no re-render/focus loss)',ed.querySelector('#ly-r__landscape__nav').value==='1');
t('sub-tab buttons carry a portrait/landscape mdi icon',/mdi:crop-portrait/.test(ed.querySelector('[data-rocsub="portrait"]').innerHTML)&&/mdi:crop-landscape/.test(ed.querySelector('[data-rocsub="landscape"]').innerHTML));
t('Image fit is a dropdown, not a free-text field',ed.querySelector('#image_fit__landscape').tagName==='SELECT'&&ed.querySelector('#image_fit__portrait').tagName==='SELECT');
t('Image fit dropdown offers cover/contain options',['cover','contain'].every(function(v){return!!ed.querySelector('#image_fit__landscape option[value="'+v+'"]');}));

// --- editor: Rooms & menu tab — sub-accordions ---
(function(){
  const edRm=w.document.createElement('room-overlay-card-editor');
  edRm.setConfig({base_image:'/local/x.webp',rooms:[
    {id:'living',name:'Living room',base_image:'/local/x.webp'},
    {id:'bedroom',name:'Bedroom',base_image:'/local/x.webp'}
  ]});
  edRm.hass={states:{},user:{name:'x'}};
  const _roomsTabBtn=edRm.querySelector('[data-roctab="rooms"]');
  if(_roomsTabBtn)_roomsTabBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
  t('Rooms & menu renders 4 accordion sections',
    !!edRm.querySelector('[data-panel="room-identity"]')&&!!edRm.querySelector('[data-panel="room-presence"]')&&!!edRm.querySelector('[data-panel="room-nav"]')&&!!edRm.querySelector('[data-panel="room-deeplink"]'));
  t('Room identity section is open by default on first render',edRm.querySelector('[data-panel="room-identity"]').hasAttribute('open'));
  t('Presence & follow section starts closed',!edRm.querySelector('[data-panel="room-presence"]').hasAttribute('open'));
  t('all field ids still present, just regrouped (room-id, room_entity, nav-style, url-sync)',
    !!edRm.querySelector('#room-id')&&!!edRm.querySelector('#room_entity')&&!!edRm.querySelector('#nav-style')&&!!edRm.querySelector('#url-sync'));
  t('room-id lives inside the Room identity panel',!!edRm.querySelector('[data-panel="room-identity"] #room-id'));
  t('nav-style lives inside the Navigation menu panel',!!edRm.querySelector('[data-panel="room-nav"] #nav-style'));
  t('url-sync lives inside the Deep-linking panel',!!edRm.querySelector('[data-panel="room-deeplink"] #url-sync'));
})();
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
  // Version read at RUNTIME from the customCards registration, not by matching
  // `const ROC_VERSION='…'` in the source: this file also runs against the
  // minified bundle (npm run build:verify), where that identifier is gone.
  const _regCard=(w.customCards||[]).find(c=>c&&c.type==='room-overlay-card');
  const _verM=_regCard&&/\(v([0-9][^)]*)\)/.exec(_regCard.description||'');
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

// --- top_offset fix: corrects the OPEN end of the visual fill, leaves CLOSED
// untouched, regardless of the blind's raw motor direction (min/max) — v5.9.7
// bug: was previously applied to the raw entity value pre-normalization, which
// broke the closed state for any inverted (min:100/max:0) blind ---
{
  const cfgTO={type:'custom:room-overlay-card',base_image:'/local/x.webp',
    blinds:[{id:'b1',entity:'cover.roleta',attribute:'current_position',min:100,max:0,top_offset:20,
      top:'10%',left:'10%',width:'20%',height:'40%',blind_type:'roller'}]};
  const cardTO=mkCard(cfgTO);
  const fillTO=cardTO.shadowRoot.querySelector('[data-gauge="__bl_b1"] .gfill');
  cardTO.hass={states:{'cover.roleta':{state:'open',attributes:{current_position:0}}},callService(){},user:{name:'x'}};
  cardTO._update(); // hass setter only schedules a rAF-batched update — force it synchronously for the test
  t('top_offset: fully closed (current_position:0, inverted min/max) stays 100% fill, unaffected',
    !!fillTO&&fillTO.style.height==='100%');
  cardTO.hass={states:{'cover.roleta':{state:'open',attributes:{current_position:100}}},callService(){},user:{name:'x'}};
  cardTO._update();
  t('top_offset: fully open (current_position:100) shows the residual coverage instead of 0%',
    !!fillTO&&fillTO.style.height==='20%');
  cardTO.hass={states:{'cover.roleta':{state:'open',attributes:{current_position:50}}},callService(){},user:{name:'x'}};
  cardTO._update();
  t('top_offset: midpoint interpolates between residual and fully-closed',
    !!fillTO&&fillTO.style.height==='60%');
}

// --- day_night phase calibration (v6.1.0). Pre-6.1.0 the stripe phase was driven
// by the top_offset-CORRECTED position, so an un-retracted reserve slid the whole
// phase curve sideways ("celkově posun"): with 17 pairs + top_offset 7.6 the fully
// OPEN residual already sat at 0.646 of a period instead of 0. The phase now comes
// from the raw travel, with shift_turns/shift_start/shift_snap to calibrate it.
// jsdom has no layout engine (offsetHeight is always 0), which would make the
// `if(_perDN>0)` guard skip the whole block — so offsetHeight is mocked on the
// gauge element itself BEFORE the .hass=/_update() cycle that reads it. And jsdom
// re-serializes assigned style strings, so background-position-y is compared
// numerically via parseFloat, never as a string. ---
{
  const mkDN=(extra)=>{
    const cfg={type:'custom:room-overlay-card',base_image:'/local/x.webp',
      blinds:[Object.assign({id:'dn',entity:'cover.zebra',attribute:'current_position',
        top:'0%',left:'0%',width:'50%',height:'50%',blind_type:'day_night',slat_count:17,
        top_offset:7.6},extra||{})]};
    const card=mkCard(cfg);
    const gEl=card.shadowRoot.querySelector('[data-gauge="__bl_dn"]');
    // 340 / 17 pairs = a 20px period, so every expectation below is a round number
    Object.defineProperty(gEl,'offsetHeight',{value:340,configurable:true});
    return {card,fill:gEl.querySelector('.gfill')};
  };
  const at=(o,pos)=>{o.card.hass={states:{'cover.zebra':{state:'open',attributes:{current_position:pos}}},
    callService(){},user:{name:'x'}};o.card._update();return parseFloat(o.fill.style.backgroundPositionY);};
  const frac=x=>x-Math.floor(x);

  const dnDef=mkDN();
  t('day_night: fully open has zero phase offset (the reserve no longer shifts it)',
    Math.abs(at(dnDef,0))<0.001);
  t('day_night: fully open still shows the top_offset residual coverage',
    dnDef.fill.style.height==='7.6%');
  t('day_night: fully closed lands on anti-phase = blackout',
    Math.abs(frac(Math.abs(at(dnDef,100))/20)-0.5)<0.001);
  t('day_night: default turns is slat_count/2 (unchanged sweep rate)',
    Math.abs(Math.abs(at(dnDef,100))-8.5*20)<0.001);
  t('day_night: phase is linear in the RAW position, not the corrected one',
    Math.abs(Math.abs(at(dnDef,50))-4.25*20)<0.001);

  const dnTurns=mkDN({shift_turns:3});
  t('day_night: measured shift_turns is snapped up to land on blackout when closed',
    Math.abs(Math.abs(at(dnTurns,100))-3.5*20)<0.001);
  const dnRaw=mkDN({shift_turns:3,shift_snap:false});
  t('day_night: shift_snap:false keeps the measured turns verbatim',
    Math.abs(Math.abs(at(dnRaw,100))-3*20)<0.001);

  const dnStart=mkDN({shift_turns:3,shift_start:0.25});
  t('day_night: shift_start sets the phase at fully open',
    Math.abs(Math.abs(at(dnStart,0))-0.25*20)<0.001);
  t('day_night: shift_start still ends on blackout when closed',
    Math.abs(frac(Math.abs(at(dnStart,100))/20)-0.5)<0.001);

  // legacy escape hatch must reproduce the pre-6.1.0 numbers exactly:
  // open  -> pct=0.076 -> 0.076*17*(20/2) = 12.92px   (the old sideways slide)
  // closed-> the hard pct>=1 snap to half a period = 10px
  const dnLeg=mkDN({shift_legacy:true});
  t('day_night: shift_legacy reproduces the pre-6.1.0 open-end offset',
    Math.abs(Math.abs(at(dnLeg,0))-12.92)<0.01);
  t('day_night: shift_legacy reproduces the pre-6.1.0 pct>=1 snap',
    Math.abs(Math.abs(at(dnLeg,100))-10)<0.001);

  // Editor round-trip: the new fields must survive setConfig -> _collectConfig,
  // and the defaults must stay OUT of the saved YAML (no config noise).
  const edDn=w.document.createElement('room-overlay-card-editor');
  edDn.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},
    blinds:[{id:'dn',entity:'cover.zebra',blind_type:'day_night',slat_count:17,
      shift_turns:6.5,shift_start:0.4,shift_snap:false,shift_legacy:true}]});
  edDn.hass={states:{},user:{name:'x'}};
  const bDn=edDn._collectConfig().blinds[0];
  t('editor round-trips shift_turns / shift_start',bDn.shift_turns===6.5&&bDn.shift_start===0.4);
  t('editor round-trips shift_snap:false and shift_legacy',bDn.shift_snap===false&&bDn.shift_legacy===true);
  const edDnBare=w.document.createElement('room-overlay-card-editor');
  edDnBare.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},
    blinds:[{id:'dn',entity:'cover.zebra',blind_type:'day_night',slat_count:17}]});
  edDnBare.hass={states:{},user:{name:'x'}};
  const bBare=edDnBare._collectConfig().blinds[0];
  t('editor keeps defaults out of the saved config',
    bBare.shift_turns===undefined&&bBare.shift_start===undefined
    &&bBare.shift_snap===undefined&&bBare.shift_legacy===undefined);
  // switching away from day_night must not leave the phase keys behind
  const edRoller=w.document.createElement('room-overlay-card-editor');
  edRoller.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',layout:{},
    blinds:[{id:'dn',entity:'cover.zebra',blind_type:'roller',shift_turns:6.5,shift_start:0.4,
      shift_snap:false,shift_legacy:true}]});
  edRoller.hass={states:{},user:{name:'x'}};
  const bRoller=edRoller._collectConfig().blinds[0];
  t('editor drops stale shift_* keys when the blind is not day_night',
    bRoller.shift_turns===undefined&&bRoller.shift_start===undefined
    &&bRoller.shift_snap===undefined&&bRoller.shift_legacy===undefined);
}

// --- fix: nav thumbnail wrapper filter must NOT apply when nav.live is full/custom — the real
// mounted mini instance already applies its own brightness_model/filter_conditions internally
// (same render code path as the main card); a CSS filter on the outer wrapper stacked ON TOP of
// that, double-exposing/double-dimming the thumbnail. Reported live: composite thumbnails looked
// correct, full/custom looked overexposed — v5.9.10 bug ---
{
  const _fcRooms=[{id:'r0',base_image:'/a.webp',filter_conditions:[{filter:'brightness(1.6)'}]},{id:'r1',base_image:'/b.webp'}];
  const cardFullFc=mkCard({type:'custom:room-overlay-card',nav:{style:'thumbnails',live:'full'},rooms:_fcRooms});
  cardFullFc.hass={states:{},callService(){},user:{name:'x'}};
  cardFullFc._update();
  t('nav.live:full — thumbnail wrapper stays filter-free (mini instance applies its own filter)',
    cardFullFc._navThumbEls[0].style.filter==='');
  const cardCustomFc=mkCard({type:'custom:room-overlay-card',nav:{style:'thumbnails',live:'custom'},rooms:_fcRooms});
  cardCustomFc.hass={states:{},callService(){},user:{name:'x'}};
  cardCustomFc._update();
  t('nav.live:custom — thumbnail wrapper also stays filter-free',
    cardCustomFc._navThumbEls[0].style.filter==='');
  const cardCompositeFc=mkCard({type:'custom:room-overlay-card',nav:{style:'thumbnails',live:'composite'},rooms:_fcRooms});
  cardCompositeFc.hass={states:{},callService(){},user:{name:'x'}};
  cardCompositeFc._update();
  t('nav.live:composite — unaffected, still applies filter_conditions to the wrapper (no mini instance to double up with)',
    cardCompositeFc._navThumbEls[0].style.filter==='brightness(1.6)');
  const cardOffFc=mkCard({type:'custom:room-overlay-card',nav:{style:'thumbnails'},rooms:_fcRooms});
  cardOffFc.hass={states:{},callService(){},user:{name:'x'}};
  cardOffFc._update();
  t('nav.live off (classic static thumbs) — also unaffected, filter_conditions still applies',
    cardOffFc._navThumbEls[0].style.filter==='brightness(1.6)');
}

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

  // editor: Layout-tab edit (input, no blur) reaches the mounted Edit-mode
  // preview card (_prevCard) — layout.* is invisible to the item-count `same`
  // check in setConfig(), so this needs _lyDebouncedUpdate()'s direct push
  // rather than the normal _fireDebounced() + editor setConfig() round trip.
  const edLive=w.document.createElement('room-overlay-card-editor');
  edLive.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',test_mode:true,
    layout:{portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}}});
  edLive.hass={states:{},user:{name:'x'}};
  w.document.body.appendChild(edLive);
  t('editor Edit-mode preview card is mounted (_prevCard)',!!edLive._prevCard);
  const _lyBefore=JSON.stringify((edLive._prevCard._config.layout||{}).landscape);
  const _lyRowsInput=edLive.querySelector('#ly-rows__landscape');
  _lyRowsInput.value='20, 80';
  _lyRowsInput.dispatchEvent(new w.Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,220));
  const _lyAfter=JSON.stringify((edLive._prevCard._config.layout||{}).landscape);
  t('...and the debounced update reaches _prevCard.setConfig() with the new rows',_lyBefore!==_lyAfter&&/20/.test(_lyAfter));

  // --- vacuum widget: GUI editor (add/remove/duplicate, field round-trip, drag wiring) ---
  {
    const vwEdCfg={type:'custom:room-overlay-card',base_image:'/local/x.webp',test_mode:true,
      vacuum_widgets:[{id:'vac1',icon:'mdi:robot-vacuum',size:'50px',top:'80%',left:'5%',z_index:9,group:'g1',
        vacuums:[{entity:'sensor.a_status'}],
        tap_action:{action:'navigate',navigation_path:'/dashboard-various/vacuum'}}]};
    const edVw=w.document.createElement('room-overlay-card-editor');
    w.document.body.appendChild(edVw);
    edVw.setConfig(vwEdCfg);
    edVw.hass={states:{},user:{name:'x'}};
    edVw._render();
    t('editor renders a vacuum widget panel',!!edVw.querySelector('[data-vw-id="0"]'));
    t('editor vacuum widget id field prefilled',edVw.querySelector('[data-vw-id="0"]').value==='vac1');
    t('editor vacuum widget size field prefilled',edVw.querySelector('[data-vw-size="0"]').value==='50px');
    t('editor vacuum widget top/left fields prefilled',edVw.querySelector('[data-vw-top="0"]').value==='80%'&&edVw.querySelector('[data-vw-left="0"]').value==='5%');
    const vwYamlBox=edVw.querySelector('[data-vw-yaml="0"]');
    t('editor vacuum widget YAML box carries tap_action but not vacuums/id (those have dedicated fields)',/tap_action:/.test(vwYamlBox.value)&&!/vacuums:/.test(vwYamlBox.value)&&!/^id:/m.test(vwYamlBox.value));
    t('editor renders a dedicated entity row for the configured vacuum',!!edVw.querySelector('[data-vw-vac="0-0"]')&&edVw.querySelector('[data-vw-vac="0-0"]').value==='sensor.a_status');

    // round-trip through _collectConfig(): dedicated fields + entity rows + YAML box together
    edVw.querySelector('[data-vw-id="0"]').value='vac_renamed';
    edVw.querySelector('[data-vw-size="0"]').value='60px';
    const collectedVw=edVw._collectConfig().vacuum_widgets[0];
    t('collectConfig round-trips renamed id + edited size',collectedVw.id==='vac_renamed'&&collectedVw.size==='60px');
    t('collectConfig keeps vacuums from the dedicated entity rows',Array.isArray(collectedVw.vacuums)&&collectedVw.vacuums[0].entity==='sensor.a_status');
    t('collectConfig keeps tap_action from the YAML box',!!collectedVw.tap_action&&collectedVw.tap_action.action==='navigate');
    t('collectConfig keeps group from its dedicated field',collectedVw.group==='g1');

    // + Entity / remove-entity row buttons
    const addVwvBtn=edVw.querySelector('[data-add-vwv="0"]');
    t('Add vacuum-entity button present',!!addVwvBtn);
    let outAddVwv=null;
    edVw.addEventListener('config-changed',e=>{outAddVwv=e.detail.config;});
    addVwvBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
    t('Add vacuum-entity appends a second (empty) entity row',!!outAddVwv&&outAddVwv.vacuum_widgets[0].vacuums.length===2);
    const rmVwvBtn=edVw.querySelector('[data-rm-vwv="0-1"]');
    t('Remove vacuum-entity button present for the new row',!!rmVwvBtn);
    let outRmVwv=null;
    edVw.addEventListener('config-changed',e=>{outRmVwv=e.detail.config;});
    rmVwvBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
    t('Remove vacuum-entity restores the list to one entity',!!outRmVwv&&outRmVwv.vacuum_widgets[0].vacuums.length===1);

    // Add button creates a new, uniquely-defaulted entry
    let outAddVw=null;
    edVw.addEventListener('config-changed',e=>{outAddVw=e.detail.config;});
    const addVwBtn=edVw.querySelector('#add-vw');
    t('Add vacuum widget button present',!!addVwBtn);
    addVwBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
    t('Add vacuum widget appends a second entry',!!outAddVw&&outAddVw.vacuum_widgets.length===2);

    // Remove button removes the targeted entry (handler re-renders internally)
    const rmVwBtn=edVw.querySelector('[data-rm-vw="1"]');
    t('Remove vacuum widget button present for the new entry',!!rmVwBtn);
    let outRmVw=null;
    edVw.addEventListener('config-changed',e=>{outRmVw=e.detail.config;});
    rmVwBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
    t('Remove vacuum widget restores the list to one entry',!!outRmVw&&outRmVw.vacuum_widgets.length===1);

    // Duplicate button clones with an offset position and an _2 id suffix
    const dupVwBtn=edVw.querySelector('[data-dup-vw="0"]');
    t('Duplicate vacuum widget button present',!!dupVwBtn);
    let outDupVw=null;
    edVw.addEventListener('config-changed',e=>{outDupVw=e.detail.config;});
    dupVwBtn.dispatchEvent(new w.Event('click',{bubbles:true}));
    t('Duplicate vacuum widget appends a clone with _2 suffix',!!outDupVw&&outDupVw.vacuum_widgets.length===2&&outDupVw.vacuum_widgets[1].id.endsWith('_2'));
  }

  // --- vacuum widget: draggable in the editor's live (test_mode) preview, and the
  // roc-pos-update relay updates the real config exactly like icons/labels/zones ---
  {
    const edVwDrag=w.document.createElement('room-overlay-card-editor');
    w.document.body.appendChild(edVwDrag);
    edVwDrag.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',test_mode:true,
      vacuum_widgets:[{id:'vacd',top:'50%',left:'50%',vacuums:[]}]});
    edVwDrag.hass={states:{},user:{name:'x'}};
    edVwDrag._render();
    const prevCard=edVwDrag._prevCard;
    t('editor test-mode preview mounts a draggable vacuum widget element',
      !!prevCard&&!!prevCard._vwEls&&!!prevCard._vwEls['vacd']&&prevCard._vwEls['vacd'].style.cursor==='grab');
    const draggedCfg=JSON.parse(JSON.stringify(prevCard._config));
    draggedCfg.vacuum_widgets[0].top='12.0%';draggedCfg.vacuum_widgets[0].left='34.0%';
    w.dispatchEvent(new w.CustomEvent('roc-pos-update',{detail:{config:draggedCfg}}));
    t('dragging the vacuum widget in the preview relays the new position into the real config',
      edVwDrag._config.vacuum_widgets[0].top==='12.0%'&&edVwDrag._config.vacuum_widgets[0].left==='34.0%');
  }

  // --- editor setConfig() "same" fast-path must not ignore vacuum_widgets count changes
  // (would otherwise leave the panel showing a stale item count/list after an
  // external YAML edit that only touches vacuum_widgets) ---
  {
    const edVwSame=w.document.createElement('room-overlay-card-editor');
    w.document.body.appendChild(edVwSame);
    const baseVwCfg={type:'custom:room-overlay-card',base_image:'/local/x.webp',vacuum_widgets:[{id:'only',vacuums:[]}]};
    edVwSame.setConfig(baseVwCfg);
    edVwSame.hass={states:{},user:{name:'x'}};
    edVwSame._render();
    const grownVwCfg=JSON.parse(JSON.stringify(baseVwCfg));
    grownVwCfg.vacuum_widgets.push({id:'second',vacuums:[]});
    edVwSame.setConfig(grownVwCfg);
    t('setConfig refreshes the panel when only vacuum_widgets grew (same-check is not blind to it)',
      !!edVwSame.querySelector('[data-vw-id="1"]'));
  }


// --- vacuum status widget: classification, aggregation, mini exclusion ---
const mkVW=(cfg,states)=>{
  const el=w.document.createElement('room-overlay-card');
  el.setConfig(cfg);
  el._hass={states:states||{},callService(){},user:{name:'x'}};
  w.document.body.appendChild(el);
  el._render();
  el._hass={states:states||{}};
  el._update();
  return el;
};
const vwCfg={base_image:'/local/x.webp',vacuum_widgets:[{id:'vac',top:'90%',left:'4%',
  tap_action:{action:'navigate',navigation_path:'/dashboard-various/vacuum'},
  vacuums:[{entity:'sensor.a_status'},{entity:'sensor.b_status'},{entity:'sensor.c_status'}]}]};

let elVW=mkVW(vwCfg,{'sensor.a_status':{state:'idle'},'sensor.b_status':{state:'charging'},'sensor.c_status':{state:'charging_complete'}});
let vwDiv=elVW.shadowRoot.querySelector('[data-vw="vac"]');
t('vacuum widget: all idle/charging -> vw-rest',!!vwDiv&&vwDiv.classList.contains('vw-rest'));
t('vacuum widget: count badge hidden at rest',elVW.shadowRoot.querySelector('[data-vwc="vac"]').style.display==='none');

elVW=mkVW(vwCfg,{'sensor.a_status':{state:'cleaning'},'sensor.b_status':{state:'idle'},'sensor.c_status':{state:'idle'}});
t('vacuum widget: one vacuuming -> vw-dry',elVW.shadowRoot.querySelector('[data-vw="vac"]').classList.contains('vw-dry'));
t('vacuum widget: count hidden with only 1 active',elVW.shadowRoot.querySelector('[data-vwc="vac"]').style.display==='none');

elVW=mkVW(vwCfg,{'sensor.a_status':{state:'cleaning'},'sensor.b_status':{state:'segment_mopping'},'sensor.c_status':{state:'idle'}});
vwDiv=elVW.shadowRoot.querySelector('[data-vw="vac"]');
t('vacuum widget: dry+wet on different robots at once -> vw-both',vwDiv.classList.contains('vw-both'));
const vwCount=elVW.shadowRoot.querySelector('[data-vwc="vac"]');
t('vacuum widget: count badge shows 2',vwCount.style.display==='inline-flex'&&vwCount.textContent==='2');

elVW=mkVW(vwCfg,{'sensor.a_status':{state:'idle'},'sensor.b_status':{state:'clean_mop_mopping'},'sensor.c_status':{state:'idle'}});
t('vacuum widget: single combined vac+mop job -> vw-both',elVW.shadowRoot.querySelector('[data-vw="vac"]').classList.contains('vw-both'));

elVW=mkVW(vwCfg,{'sensor.a_status':{state:'cleaning'},'sensor.b_status':{state:'error'},'sensor.c_status':{state:'idle'}});
t('vacuum widget: error overrides an otherwise-active fleet -> vw-error',elVW.shadowRoot.querySelector('[data-vw="vac"]').classList.contains('vw-error'));

elVW=mkVW(vwCfg,{'sensor.a_status':{state:'idle'},'sensor.b_status':{state:'washing_the_mop'},'sensor.c_status':{state:'idle'}});
vwDiv=elVW.shadowRoot.querySelector('[data-vw="vac"]');
t('vacuum widget: dock mop-washing maintenance is generic active, NOT wet',vwDiv.classList.contains('vw-active')&&!vwDiv.classList.contains('vw-wet'));

elVW=mkVW(vwCfg,{'sensor.a_status':{state:'cleaning'}});
const vwTapEl=elVW.shadowRoot.querySelector('[data-vw="vac"]');
let _vwNavPath=null;
const _origPushState=w.history.pushState.bind(w.history);
w.history.pushState=(_s,_t,p)=>{_vwNavPath=p;};
vwTapEl.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
w.history.pushState=_origPushState;
t('vacuum widget: tap navigates via the standard navigate action',_vwNavPath==='/dashboard-various/vacuum');

const miniEl=w.document.createElement('room-overlay-card');
miniEl.setConfig(Object.assign({},vwCfg,{_roc_mini:true}));
miniEl._hass={states:{'sensor.a_status':{state:'cleaning'}},callService(){}};
w.document.body.appendChild(miniEl);
miniEl._render();
t('vacuum widget: absent from nav.live full/custom mini instances',!miniEl.shadowRoot.querySelector('[data-vw]'));

  console.log(fails?('FAILURES: '+fails):'ALL RENDER TESTS PASSED');
  process.exit(fails?1:0);
})();
