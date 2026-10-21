// Studio shell (v6.41.0, V7_PLAN.md §5.3–5.5, Phase 2) — jsdom tier.
//
// Loads the assembled card and the assembled studio into one jsdom window and checks:
//  1. the card ↔ studio handshake (internals handle, registration, the studio URL the loader
//     derives from the card's own <script src>, HACS cache tag kept);
//  2. editor-hosted path (a): the studio edits a COPY, the HA editor underneath stays untouched
//     until Apply, then gets exactly one config-changed; undo/redo; canvas drags come back with
//     every render-only override removed; editors underneath ignore canvas relays while open;
//     the unsaved-changes guard on Escape;
//  3. round-trip for every reference config: open → Apply without edits changes nothing, and the
//     hosted editor reads the config exactly like the editor does on its own;
//  4. dashboard path (b) on a fake Lovelace DOM: located by object identity despite a duplicate
//     card_id, only that card is replaced, a concurrent change is detected, non-admin and
//     YAML-mode dashboards fall back to copy-YAML;
//  5. canvas details: device frames drive the layout profile, Arrange/Live, test-mode buttons.
//
// Usage: node tests/studio.test.js [path/to/room-overlay-card.js] [path/to/room-overlay-card-studio.js]
'use strict';
const fs=require('fs');
const path=require('path');
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.error('jsdom is not installed — run: npm i -D jsdom');process.exit(1);}
const ROOT=path.join(__dirname,'..');
const cardFile=process.argv[2]||path.join(ROOT,'room-overlay-card.js');
const studioFile=process.argv[3]||path.join(ROOT,'room-overlay-card-studio.js');
const VERSION=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;

let fails=0;
function check(name,ok,extra){console.log((ok?'PASS ':'FAIL ')+name+(ok||extra==null?'':'\n     '+extra));if(!ok)fails++;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://ha.local/lovelace/0',pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.requestIdleCallback=f=>setTimeout(f,0);
// jsdom has <dialog> but no modal behaviour — enough for the studio's DOM logic
const DP=w.HTMLDialogElement.prototype;
if(!DP.showModal)DP.showModal=function(){this.setAttribute('open','');};
if(!DP.close)DP.close=function(){this.removeAttribute('open');};
w.eval(fs.readFileSync(cardFile,'utf8')+'\n;window.__rocY=rocJsYaml;');
w.eval(fs.readFileSync(studioFile,'utf8'));
const d=w.document;
const C=w.customElements.get('room-overlay-card');
const J=o=>JSON.stringify(o);
const clone=o=>JSON.parse(J(o));
const hass={states:{'light.x':{state:'on',attributes:{}}},callService(){},language:'en',user:{name:'x',is_admin:true}};
const IMG='data:image/svg+xml;utf8,x';
const multi=()=>({type:'custom:room-overlay-card',card_id:'flat',test_mode:true,url_sync:'room',
  rooms:[{id:'a',name:'A',base_image:IMG+'a',zones:[{id:'z1',top:'10%',left:'10%',width:'20%',height:'20%'}]},{id:'b',name:'B',base_image:IMG+'b'}]});
const dialogs=()=>[...d.querySelectorAll('dialog.roc-studio')];
const layerBtn=(S,act)=>S._sr.querySelector('.layer [data-act="'+act+'"]');

(async()=>{
  // ---- 1. handshake ---------------------------------------------------------------------
  check('card exposes the internals handle',!!C._rocInternals&&C._rocInternals.version===VERSION);
  check('studio registered on the card class',!!C._rocStudio&&C._rocStudio.version===VERSION&&typeof C._rocStudio.open==='function');
  check('studio does not leak globals (schema stays private)',typeof w.rocValidate==='undefined'&&typeof w.ROC_SCHEMA==='undefined'&&typeof w.RocStudio==='undefined');
  const sc=d.createElement('script');sc.setAttribute('src','https://ha.local/hacsfiles/Room-Card/room-overlay-card.js?hacstag=12345');d.head.appendChild(sc);
  check('studio URL = card URL with the file swapped, HACS tag kept, version added',
    C._rocInternals.studioUrl()==='https://ha.local/hacsfiles/Room-Card/room-overlay-card-studio.js?hacstag=12345&v='+VERSION,C._rocInternals.studioUrl());
  sc.remove();

  // ---- 2. editor-hosted path (a) ----------------------------------------------------------
  const E=d.createElement('room-overlay-card-editor');
  E.setConfig(multi());E.hass=hass;d.body.appendChild(E);await wait(20);
  const eFired=[];E.addEventListener('config-changed',e=>eFired.push(e.detail.config));
  check('HA editor shows the Studio button',!!E.querySelector('#roc-studio'));
  const before=J(E._config);
  const S=await C._rocStudio.open({from:'editor',editor:E,hass});
  await wait(80);
  check('studio is a <dialog> on <body>, open',dialogs().length===1&&dialogs()[0].parentNode===d.body&&dialogs()[0].hasAttribute('open'));
  check('studio marks itself open on the card class',C._rocStudioOpen===true);
  const ed=S._ed;
  check('inspector hosts today\'s editor (many inputs)',!!ed&&ed.tagName==='ROOM-OVERLAY-CARD-EDITOR'&&ed.querySelectorAll('input,select,textarea').length>10,ed&&ed.querySelectorAll('input').length);
  check('hosted editor has no Studio / undo / redo buttons and no own preview',!ed.querySelector('#roc-studio')&&!ed.querySelector('#roc-undo')&&!ed.querySelector('#roc-prev-host'));
  check('a second open returns the same studio',(await C._rocStudio.open({from:'editor',editor:E,hass}))===S&&dialogs().length===1);
  const cv=S._card;
  check('canvas renders the real card',!!cv&&cv._rendered===true&&!!cv.shadowRoot.querySelector('.wrap'));
  check('canvas config carries the render-only overrides',cv._config._roc_studio===true&&cv._config.test_mode===true&&cv._config.url_sync===undefined&&cv._config.follow_mode==='manual');
  check('canvas has no Save / profile-flip / Studio buttons',!cv.shadowRoot.querySelector('.tm-save')&&!cv.shadowRoot.querySelector('.tm-prof')&&!cv.shadowRoot.querySelector('.tm-studio'));
  // an edit through a real editor field
  const nm=ed.querySelector('#room-name');
  nm.value='Kitchen';nm.dispatchEvent(new w.Event('change',{bubbles:true}));
  await wait(80);
  check('editor field edit lands in the studio copy',S.work.rooms[0].name==='Kitchen'&&S._dirty());
  check('HA editor underneath is untouched, nothing fired to HA',J(E._config)===before&&eFired.length===0);
  check('canvas follows the edit',cv._config.rooms[0].name==='Kitchen');
  check('status shows unsaved changes',S._dirtyEl.textContent===S.t('dirty'));
  S.undo();await wait(60);
  check('undo restores the config and the editor field',S.work.rooms[0].name==='A'&&ed.querySelector('#room-name').value==='A'&&!S._dirty());
  S.redo();await wait(60);
  check('redo re-applies',S.work.rooms[0].name==='Kitchen'&&ed.querySelector('#room-name').value==='Kitchen');
  // a drag on the canvas comes back through the sink, overrides stripped
  const nc=clone(cv._config);nc.rooms[0].zones[0].top='42%';
  cv._posOut(Object.assign({type:'custom:room-overlay-card'},nc));await wait(60);
  check('canvas drag lands in the studio copy',S.work.rooms[0].zones[0].top==='42%');
  check('render-only overrides never reach the config',S.work._roc_studio===undefined&&S.work.url_sync==='room'&&S.work.follow_mode===undefined&&S.work.test_mode===true&&S.work.layout&&S.work.layout.height===undefined,J({s:S.work._roc_studio,u:S.work.url_sync,f:S.work.follow_mode,h:S.work.layout&&S.work.layout.height}));
  check('hosted editor shows the dragged position',ed._config.rooms[0].zones[0].top==='42%');
  check('one undo step per canvas drag',(S.undo(),S.work.rooms[0].zones[0].top==='10%')&&(S.redo(),S.work.rooms[0].zones[0].top==='42%'));
  // an editor underneath must ignore canvas relays while the studio is open
  w.dispatchEvent(new w.CustomEvent('roc-pos-update',{detail:{config:Object.assign(clone(E._config),{aspect_ratio:'1/1'})}}));
  check('editors underneath ignore roc-pos-update while the studio is open',J(E._config)===before&&eFired.length===0);
  // room sync: canvas nav → outline + inspector
  cv._rocRoomSink(1);
  check('canvas room switch moves the inspector and outline',S.roomIdx===1&&ed._editRoomIdx===1&&S._roomSel.value==='1');
  S._setRoom(0,false,'toolbar');
  check('toolbar room switch moves inspector and canvas',ed._editRoomIdx===0&&cv._roomIdx===0);
  // validation status
  S._commit(Object.assign(clone(S.work),{fooo:1}),'test');await wait(160);
  check('status bar reports schema findings',/warning/.test(S._vBtn.textContent),S._vBtn.textContent);
  S.undo();await wait(160);
  check('…and clears them',S._vBtn.textContent===S.t('valid_ok'),S._vBtn.textContent);
  // Escape guard
  S._dlg.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  check('Escape with unsaved changes opens the guard, studio stays open',!!layerBtn(S,'discard')&&dialogs().length===1);
  layerBtn(S,'keep').click();
  check('"Keep editing" closes only the guard',!S._sr.querySelector('.layer')&&dialogs().length===1);
  // Ctrl+Z on the studio (outside fields) = studio undo
  const top=S.undoStack.length;
  S._dlg.dispatchEvent(new w.KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
  check('Ctrl+Z undoes in the studio',S.undoStack.length===top-1);
  S._dlg.dispatchEvent(new w.KeyboardEvent('keydown',{key:'y',ctrlKey:true,bubbles:true,cancelable:true}));
  // Apply
  const want=J(S.work);
  await S.save();
  check('Apply hands the config back through ONE config-changed',eFired.length===1&&J(Object.assign({},eFired[0]))===J(Object.assign({type:'custom:room-overlay-card'},JSON.parse(want))),eFired.length);
  check('HA editor shows the applied config',E._config.rooms[0].name==='Kitchen'&&E.querySelector('#room-name').value==='Kitchen');
  check('studio closed and cleaned up',dialogs().length===0&&C._rocStudioOpen===false);
  // Escape without changes closes straight away; guard → Discard drops the edit
  const S2=await C._rocStudio.open({from:'editor',editor:E,hass});
  S2._dlg.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  check('Escape without changes closes',dialogs().length===0);
  const S3=await C._rocStudio.open({from:'editor',editor:E,hass});
  S3._commit(Object.assign(clone(S3.work),{aspect_ratio:'1/1'}),'test');
  const n0=eFired.length,e0=J(E._config);
  S3.requestClose();layerBtn(S3,'discard').click();
  check('Discard closes without touching the HA editor',dialogs().length===0&&eFired.length===n0&&J(E._config)===e0);
  E.remove();

  // ---- 3. round-trip on every reference config --------------------------------------------
  const files=['example-bedroom.yaml','flat-multiroom.yaml','flat-multiroom-v4.yaml']
    .concat(fs.existsSync(path.join(ROOT,'Claude outputs'))?fs.readdirSync(path.join(ROOT,'Claude outputs')).filter(f=>/^room-card-.*\.yaml$/.test(f)).map(f=>'Claude outputs/'+f):[]);
  const cards=[];
  for(const f of files){const p=path.join(ROOT,f);if(!fs.existsSync(p))continue;
    JSON.stringify(w.__rocY.load(fs.readFileSync(p,'utf8')),(k,v)=>{if(v&&typeof v==='object'&&String(v.type||'').includes('room-overlay-card'))cards.push([f,v]);return v;});}
  let rtBad=[];
  for(const [f,cfg] of cards){
    const e=d.createElement('room-overlay-card-editor');e.setConfig(clone(cfg));e.hass=hass;d.body.appendChild(e);
    const fired=[];e.addEventListener('config-changed',x=>fired.push(x));
    const b=J(e._config),collected=J(e._collectConfig());
    let s;try{s=await C._rocStudio.open({from:'editor',editor:e,hass});}catch(err){rtBad.push(f+': open '+err.message);e.remove();continue;}
    await wait(30);
    if(J(s._ed._collectConfig())!==collected)rtBad.push(f+': hosted editor collects differently');
    if(s._dirty())rtBad.push(f+': dirty right after open');
    await s.save();
    if(fired.length||J(e._config)!==b)rtBad.push(f+': apply without edits changed the config');
    if(dialogs().length)rtBad.push(f+': studio left open');
    e.remove();
  }
  check('round-trip: '+cards.length+' reference configs open → Apply unchanged; hosted editor collects identically',cards.length>=4&&!rtBad.length,rtBad.join('\n     '));

  // ---- 4. dashboard path (b) on a fake Lovelace DOM ----------------------------------------
  const CARD=extra=>Object.assign({type:'custom:room-overlay-card',card_id:'dup',base_image:IMG,test_mode:true},extra||{});
  let server={title:'Flat',views:[{title:'Home',path:'home',cards:[CARD({aspect_ratio:'16/9'}),CARD({aspect_ratio:'4/3'})]}]};
  const saves=[];
  function mkDash(mode,admin){
    const lc=JSON.parse(J(server));
    (function fr(o){if(o&&typeof o==='object'){Object.values(o).forEach(fr);Object.freeze(o);}})(lc);
    const root=d.createElement('hui-root');
    root.lovelace={config:lc,rawConfig:lc,urlPath:'flat',mode:mode||'storage',saveConfig:async c=>{saves.push(clone(c));server=clone(c);}};
    const view=d.createElement('hui-masonry-view');view.attachShadow({mode:'open'});root.appendChild(view);
    const hcs=[0,1].map(i=>{const hc=d.createElement('hui-card');hc.config=lc.views[0].cards[i];view.shadowRoot.appendChild(hc);
      const c=d.createElement('room-overlay-card');c.setConfig(hc.config);hc.appendChild(c);return c;});
    const h=Object.assign({},hass,{user:{name:'x',is_admin:admin!==false},callWS:async m=>{if(m.type==='lovelace/config'&&m.url_path==='flat')return clone(server);throw{code:'not_found'};}});
    hcs.forEach(c=>{c.hass=h;});
    d.body.appendChild(root);
    return{root,cards:hcs,h};
  }
  const D=mkDash();await wait(30);
  check('dashboard card in Edit mode shows the Studio button',!!D.cards[1].shadowRoot.querySelector('.tm-studio'));
  const T=await C._rocStudio.open({from:'dashboard',card:D.cards[1],hass:D.h});
  check('located by object identity despite a duplicate card_id',T.target.kind==='dashboard'&&J(T.target.path)===J(['views',0,'cards',1])&&T.target.urlPath==='flat',J(T.target.path));
  check('status names the save target',/Flat/.test(T._tgtEl.textContent)&&/views\/0\/cards\/1/.test(T._tgtEl.textContent),T._tgtEl.textContent);
  T._commit(Object.assign(clone(T.work),{aspect_ratio:'3/2'}),'test');
  check('save reports success',await T.save()===true);
  check('only that card was replaced',saves.length===1&&saves[0].views[0].cards[1].aspect_ratio==='3/2'&&saves[0].views[0].cards[0].aspect_ratio==='16/9');
  check('after a save the studio is clean and says so',!T._dirty()&&/Saved/.test(T._dirtyEl.textContent));
  check('the save is kept in the browser history (restore list)',JSON.parse(w.localStorage.getItem(T.histKey)||'[]').length===1);
  // a second tab changes the same card → the next save must refuse
  server.views[0].cards[1]=Object.assign({},server.views[0].cards[1],{aspect_ratio:'5/4'});
  T._commit(Object.assign(clone(T.work),{aspect_ratio:'9/9'}),'test');
  check('a concurrent change is detected (no save)',await T.save()===false&&saves.length===1&&!!layerBtn(T,'overwrite'));
  layerBtn(T,'overwrite').click();await wait(20);
  check('"Overwrite anyway" saves on request',saves.length===2&&saves[1].views[0].cards[1].aspect_ratio==='9/9');
  // restore from history
  T._showHistory();
  const rb=[...T._sr.querySelectorAll('.layer .hl button')];
  check('history lists the saved versions',rb.length===2,rb.length);
  rb[1].click();
  check('restore loads an older version as a normal (undoable) change',T.work.aspect_ratio==='3/2'&&T._dirty()&&T.undoStack.length>0);
  T.close();D.root.remove();
  // non-admin / YAML mode / not found → copy-YAML
  const D2=mkDash('storage',false);
  const T2=await C._rocStudio.open({from:'dashboard',card:D2.cards[0],hass:D2.h});
  check('non-admin → read-only, copy YAML',T2.target.kind==='yaml'&&T2.target.reason==='r_admin');
  await T2.save();
  const ta=T2._sr.querySelector('.layer textarea');
  check('Copy YAML shows the card YAML',!!ta&&/card_id: dup/.test(ta.value));
  T2.close();D2.root.remove();
  const D3=mkDash('yaml');
  const T3=await C._rocStudio.open({from:'dashboard',card:D3.cards[0],hass:D3.h});
  check('YAML-mode dashboard → copy YAML',T3.target.kind==='yaml'&&T3.target.reason==='r_yaml');
  T3.close();D3.root.remove();
  const loose=d.createElement('room-overlay-card');loose.setConfig(CARD());loose.hass=hass;d.body.appendChild(loose);
  const T4=await C._rocStudio.open({from:'dashboard',card:loose,hass});
  check('card outside a dashboard → copy YAML',T4.target.kind==='yaml'&&T4.target.reason==='r_notfound');
  T4.close();loose.remove();

  // ---- 5. canvas details ------------------------------------------------------------------
  const E5=d.createElement('room-overlay-card-editor');E5.setConfig({type:'custom:room-overlay-card',base_image:IMG});E5.hass=hass;d.body.appendChild(E5);
  const S5=await C._rocStudio.open({from:'editor',editor:E5,hass});
  S5._setFrame('portrait');await wait(20);
  check('Tablet portrait frame → card renders the portrait profile',J(S5._card._rocVp)===J({w:800,h:1280})&&S5._card._profile==='portrait',S5._card._profile);
  S5._setFrame('landscape');await wait(20);
  check('Tablet frame → landscape profile, viewport height becomes the frame',S5._card._profile==='landscape'&&S5._card._config.layout.height==='container');
  S5._setFrame('phone');await wait(20);
  check('Phone frame → portrait profile, natural height kept',S5._card._profile==='portrait'&&(S5._card._config.layout.height||'viewport')==='viewport');
  check('Arrange mode puts the canvas in Edit mode',S5._card._config.test_mode===true);
  S5._setMode('live');
  check('Live mode renders the card as on the dashboard',S5._card._config.test_mode===undefined&&!S5._card.shadowRoot.querySelector('.tm-info'));
  S5._commit({type:'custom:room-overlay-card'},'test');await wait(80);
  check('a config the card cannot render shows a message instead of breaking',!!S5._sr.querySelector('.cv-err')&&S5._card.style.display==='none');
  S5.undo();await wait(80);
  check('…and recovers',!S5._sr.querySelector('.cv-err')&&S5._card.style.display==='');
  S5.close();E5.remove();
  const pv=d.createElement('room-overlay-card');pv.setConfig({type:'custom:room-overlay-card',base_image:IMG,test_mode:true,_roc_preview:true});pv.hass=hass;d.body.appendChild(pv);
  check('editor preview card has no Studio button',!pv.shadowRoot.querySelector('.tm-studio'));
  pv.remove();
  const plain=d.createElement('room-overlay-card');plain.setConfig({type:'custom:room-overlay-card',base_image:IMG});plain.hass=hass;d.body.appendChild(plain);
  check('a card outside Edit mode has no Studio button',!plain.shadowRoot.querySelector('.tm-studio'));
  plain.remove();

  console.log(fails?('\n'+fails+' STUDIO TEST(S) FAILED'):'\nALL STUDIO TESTS PASSED');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
