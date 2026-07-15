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

console.log(fails?('FAILURES: '+fails):'ALL RENDER TESTS PASSED');
process.exit(fails?1:0);
