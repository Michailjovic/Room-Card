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

  // ---- 6. Phase 3 (v6.42.0): selection, outline, add / copy / delete, Edit mode retired ------
  const P3=()=>({type:'custom:room-overlay-card',card_id:'p3',
    labels:[{id:'l_shared',top:'80%',left:'10%',entity:'light.x'}],
    rooms:[{id:'a',name:'A',base_image:IMG+'a',zones:[{id:'z1',top:'10%',left:'10%',width:'20%',height:'20%'}],icons:[{id:'i1',icon:'mdi:lamp',top:'50%',left:'50%'}],
             blinds:[{id:'b1',top:'10%',left:'60%',width:'10%',height:'30%',entity:'cover.x'}]},
           {id:'b',name:'B',base_image:IMG+'b'}]});
  const E6=d.createElement('room-overlay-card-editor');E6.setConfig(P3());E6.hass=hass;d.body.appendChild(E6);
  const S6=await C._rocStudio.open({from:'editor',editor:E6,hass});await wait(40);
  const cv6=S6._card,ed6=S6._ed;
  check('canvas card exposes programmatic selection',typeof cv6._rocSelect==='function');
  // canvas → studio → inspector
  const icoEl=cv6.shadowRoot.querySelector('[data-ico="i1"]');
  icoEl.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,composed:true}));
  check('a click on an element selects it in the studio',S6.sel&&S6.sel.type==='icon'&&S6.sel.id==='i1',J(S6.sel));
  check('…and opens exactly its panel in the inspector',ed6.querySelector('[data-roctab="elements"]')&&!!ed6.querySelector('details[data-panel="icons"]').open&&!!ed6.querySelector('details[data-panel="ico-0"]').open);
  check('…and marks it in the outline',[...S6._olList.querySelectorAll('[aria-current="true"]')].map(x=>x.dataset.id).join()==='i1');
  check('selection bar offers duplicate / copy / delete',!!S6._selBar.querySelector('[data-act="dup"]')&&!!S6._selBar.querySelector('[data-act="del"]'));
  // outline → canvas
  S6._olList.querySelector('[data-id="b1"]').click();
  check('outline click selects on the canvas (blinds included)',cv6._selectedTM&&cv6._selectedTM.type==='blind'&&cv6._selectedTM.id==='b1'&&!!ed6.querySelector('details[data-panel="bl-0"]').open);
  // inspector → canvas (a click on an item header)
  const zsum=ed6.querySelector('details[data-panel="z-0"] > summary');
  zsum.click();await wait(10);
  check('opening an item in the inspector selects it on the canvas',S6.sel.type==='zone'&&cv6._selectedTM&&cv6._selectedTM.id==='z1');
  // an element the room inherits is edited in Global
  cv6.shadowRoot.querySelector('[data-lbl="l_shared"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,composed:true}));
  check('an inherited element switches the studio to Global and opens it there',S6.global===true&&S6.sel.id==='l_shared'&&!!ed6.querySelector('details[data-panel="lbl-0"]').open);
  S6._setRoom(0,false,'toolbar');S6.deselect();
  // search
  S6._olSearch.value='cover';S6._olSearch.dispatchEvent(new w.Event('input'));
  check('outline search filters by entity / id / type',[...S6._olList.querySelectorAll('.ol-el')].map(x=>x.dataset.id).join()==='b1');
  S6._olSearch.value='';S6._olSearch.dispatchEvent(new w.Event('input'));
  // duplicate / delete / copy-paste across rooms (with undo)
  S6._select('zone','z1','test');S6.duplicateSel();
  const zs=S6.work.rooms[0].zones;
  check('duplicate: unique id, offset, selected',zs.length===2&&zs[1].id!=='z1'&&zs[1].top==='12.0%'&&S6.sel.id===zs[1].id,J(zs[1]));
  S6.deleteSel();
  check('delete removes it and clears the selection',S6.work.rooms[0].zones.length===1&&!S6.sel);
  S6.undo();
  check('…undo brings it back',S6.work.rooms[0].zones.length===2);
  S6.undo();
  S6._select('icon','i1','test');S6.copySel();S6._setRoom(1,false,'toolbar');S6.paste();
  check('copy + paste into another room',Array.isArray(S6.work.rooms[1].icons)&&S6.work.rooms[1].icons[0].id==='i1'&&S6.work.rooms[1].icons[0].icon==='mdi:lamp'&&S6.sel.id==='i1');
  S6.paste();
  check('pasting again gives a new id and a shifted position',S6.work.rooms[1].icons.length===2&&S6.work.rooms[1].icons[1].id!=='i1'&&S6.work.rooms[1].icons[1].top==='52.0%',J(S6.work.rooms[1].icons[1]));
  // keyboard
  const key=(k,o)=>S6._dlg.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true,cancelable:true},o||{})));
  key('Delete');
  check('Del deletes the selected element',S6.work.rooms[1].icons.length===1&&!S6.sel);
  S6._select('icon','i1','test');key('d',{ctrlKey:true});
  check('Ctrl+D duplicates',S6.work.rooms[1].icons.length===2);
  key('Escape');
  check('Escape first clears the selection (studio stays open)',!S6.sel&&dialogs().length===1);
  // add: a canvas type is placed, a non-canvas type is created straight away
  S6._setRoom(0,false,'toolbar');
  S6._create('gauge',{top:'40.0%',left:'40.0%'});
  const gN=S6.work.rooms[0].gauges;
  check('a new gauge gets the editor\'s defaults, a unique id and the clicked position',gN&&gN.length===1&&gN[0].id==='gauge_1'&&gN[0].top==='40.0%'&&gN[0].width==='2%'&&gN[0].max===100,J(gN));
  check('…and is selected and opened in the inspector',S6.sel.type==='gauge'&&!!ed6.querySelector('details[data-panel="g-0"]').open);
  S6._create('zone',{top:'5.0%',left:'5.0%',width:'30.0%',height:'15.0%'});
  check('a drawn box keeps its size',S6.work.rooms[0].zones.slice(-1)[0].width==='30.0%');
  S6.add('overlay');
  check('a type that is not on the image is added at once',S6.work.rooms[0].overlays&&S6.work.rooms[0].overlays[0].id==='overlay_1'&&S6.sel.type==='overlay');
  S6.add('icon');
  check('a canvas type waits for a click on the image',S6._placeType==='icon'&&!!S6._sr.querySelector('.place'));
  key('Escape');
  check('Escape cancels placing',!S6._placeType&&!S6._sr.querySelector('.place'));
  S6._setRoom(1,false,'toolbar');S6._create('label',{top:'20.0%',left:'20.0%'});
  const rB=S6.work.rooms[1];
  check('adding to a room that inherited a list copies the shared items first (nothing disappears)',rB.labels&&rB.labels.length===2&&rB.labels[0].id==='l_shared');
  S6.requestClose();if(layerBtn(S6,'discard'))layerBtn(S6,'discard').click();
  E6.remove();
  // card: a drag on an inherited element edits it in the shared list (used to hide them all)
  const ci=d.createElement('room-overlay-card');ci.setConfig(Object.assign(P3(),{test_mode:true}));ci.hass=hass;d.body.appendChild(ci);await wait(20);
  let relayed=null;ci._rocSink=c=>{relayed=c;};
  const arr=ci._roomArr(JSON.parse(J(ci._config)),'labels');
  check('_roomArr returns the shared list for an inherited element',arr.length===1&&arr[0].id==='l_shared');
  ci.remove();
  // dashboard edit mode → Studio button on the card; Edit mode toggle retired
  const dashRoot=d.createElement('hui-root');dashRoot.lovelace={config:{views:[]},mode:'storage'};d.body.appendChild(dashRoot);
  const cd=d.createElement('room-overlay-card');cd.setConfig({type:'custom:room-overlay-card',base_image:IMG});cd.hass=hass;dashRoot.appendChild(cd);await wait(10);
  check('no Studio button outside HA\'s edit mode',!cd.shadowRoot.querySelector('.roc-studio-chip'));
  cd.editMode=true;
  check('HA\'s edit mode shows a Studio button on a dashboard card',!!cd.shadowRoot.querySelector('.roc-studio-chip')&&cd.editMode===true);
  const looseCard=d.createElement('room-overlay-card');looseCard.setConfig({type:'custom:room-overlay-card',base_image:IMG});looseCard.hass=hass;d.body.appendChild(looseCard);await wait(10);looseCard.editMode=true;
  check('…but not on a card outside a dashboard (HA\'s editor preview is in edit mode too)',!looseCard.shadowRoot.querySelector('.roc-studio-chip'));
  looseCard.remove();
  cd.editMode=false;
  check('…and it goes away with it',!cd.shadowRoot.querySelector('.roc-studio-chip'));
  const nonAdmin=Object.assign({},hass,{user:{name:'v',is_admin:false}});cd.hass=nonAdmin;cd.editMode=true;
  check('no Studio button for a non-admin',!cd.shadowRoot.querySelector('.roc-studio-chip'));
  cd.remove();dashRoot.remove();
  const eNew=d.createElement('room-overlay-card-editor');eNew.setConfig({type:'custom:room-overlay-card',base_image:IMG});eNew.hass=hass;d.body.appendChild(eNew);
  const eOld=d.createElement('room-overlay-card-editor');eOld.setConfig({type:'custom:room-overlay-card',base_image:IMG,test_mode:true});eOld.hass=hass;d.body.appendChild(eOld);
  check('Edit mode toggle is gone for cards without it',!eNew.querySelector('#test_mode'));
  check('…but stays on a card that has it on, so it can be switched off',!!eOld.querySelector('#test_mode')&&eOld.querySelector('#test_mode').checked);
  eNew.remove();eOld.remove();

  // ---- 7. Phase 3b (v6.43.0): multi-select, group move, layers, rooms; room-switch ghost --------
  const E7=d.createElement('room-overlay-card-editor');E7.setConfig(P3());E7.hass=hass;d.body.appendChild(E7);
  const S7=await C._rocStudio.open({from:'editor',editor:E7,hass});await wait(40);
  const cv7=S7._card;
  S7._select('zone','z1','test');
  cv7.shadowRoot.querySelector('[data-ico="i1"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,composed:true,shiftKey:true}));
  check('Shift-click on the canvas adds to the selection',J(S7._selSet())===J([{type:'icon',id:'i1'},{type:'zone',id:'z1'}]),J(S7._selSet()));
  check('…the others are marked on the canvas',cv7._rocMarked.length===1);
  check('…the selection bar counts them',/2 selected/.test(S7._selBar.textContent)&&!!S7._selBar.querySelector('[data-act="al-left"]')&&!S7._selBar.querySelector('[data-act="dist-h"]'));
  S7._olList.querySelector('[data-id="b1"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));
  check('Ctrl-click in the outline adds too (3 → distribute offered)',S7._selSet().length===3&&!!S7._selBar.querySelector('[data-act="dist-h"]'));
  S7._toggleSel('icon','i1','test');
  check('toggling a selected element takes it out',S7._selSet().length===2&&!S7._isSel('icon','i1'));
  // group move: a canvas drag of one selected element moves the others by the same amount
  const nc7=JSON.parse(J(cv7._config));nc7.rooms[0].zones[0].top='15%';nc7.rooms[0].zones[0].left='12%';
  cv7._posOut(Object.assign({type:'custom:room-overlay-card'},nc7));await wait(40);
  const b7=S7.work.rooms[0].blinds[0];
  check('dragging one selected element moves the selection',b7.top==='15.0%'&&b7.left==='62.0%',J(b7));
  check('…as one undo step',(S7.undo(),S7.work.rooms[0].blinds[0].top==='10%'&&S7.work.rooms[0].zones[0].top==='10%'));
  S7.redo();
  // multi delete / duplicate / copy-paste
  S7.duplicateSel();
  check('duplicate copies the whole selection and selects the copies',S7.work.rooms[0].zones.length===2&&S7.work.rooms[0].blinds.length===2&&S7._selSet().length===2&&S7._selSet().every(x=>x.id!=='z1'&&x.id!=='b1'));
  S7.deleteSel();
  check('delete removes the whole selection',S7.work.rooms[0].zones.length===1&&S7.work.rooms[0].blinds.length===1&&!S7.sel);
  S7._selectMany([{type:'zone',id:'z1'},{type:'icon',id:'i1'}]);S7.copySel();
  check('the clipboard holds every selected element',J(JSON.parse(w.localStorage.getItem('roc-studio-clip')).items.map(x=>x.item.id))===J(['z1','i1']));
  S7._setRoom(1,false,'toolbar');S7.paste();
  check('paste puts them all into the room shown, selected',S7.work.rooms[1].zones.length===1&&S7.work.rooms[1].icons.length===1&&S7._selSet().length===2);
  w.localStorage.setItem('roc-studio-clip',J({type:'icon',item:{id:'old',icon:'mdi:lamp',top:'1%',left:'1%'}}));S7._clip=null;
  S7.paste();
  check('a v6.42.0 clipboard still pastes',S7.work.rooms[1].icons.some(x=>x.id==='old'));
  // select all skips hidden / locked layers
  S7._setRoom(0,false,'toolbar');S7.toggleLayer('icon','hide');S7.toggleLayer('zone','lock');
  const w7=J(S7.work);
  check('hide / lock live in the canvas stylesheet, not in the config',/\[data-ico\][^{]*\{display:none!important;\}/.test(cv7._rocExtraCss)&&/\[data-z\][^{]*\{pointer-events:none!important;\}/.test(cv7._rocExtraCss)&&J(S7.work)===w7);
  check('…a style element is in the card',!!cv7.shadowRoot.querySelector('style.roc-xcss'));
  S7.selectAll();
  check('Ctrl+A selects the visible, unlocked elements only (inherited ones included)',S7._selSet().map(x=>x.id).sort().join()==='b1,l_shared',J(S7._selSet()));
  S7.toggleLayer('icon','hide');S7.toggleLayer('zone','lock');
  check('…and showing / unlocking again removes the stylesheet',!cv7.shadowRoot.querySelector('style.roc-xcss')&&cv7._rocExtraCss==='');
  // rooms
  S7.duplicateRoom(0);
  check('duplicate room: unique id, (copy) name, no area_match, selected',S7.work.rooms[1].id==='a_2'&&S7.work.rooms[1].name==='A (copy)'&&S7.roomIdx===1);
  S7.copyRoom(1);S7.pasteRoom();
  check('copy / paste room appends a copy',S7.work.rooms.length===4&&S7.work.rooms[3].id==='a_3');
  S7.deleteRoom(3);
  check('delete room',S7.work.rooms.length===3);
  S7.requestClose();if(layerBtn(S7,'discard'))layerBtn(S7,'discard').click();
  E7.remove();
  // room switch ghost: custom elements become plain boxes (no second construction)
  let constructed=0;
  w.customElements.define('probe-card',class extends w.HTMLElement{constructor(){super();constructed++;}});
  const src=d.createElement('div');src.innerHTML='<div class="elcont" style="left:5%"><probe-card class="x" style="top:1px"></probe-card></div><ha-icon icon="mdi:lamp"></ha-icon>';
  const before7=constructed;const gh=w.eval('rocGhostClone')(src);
  check('the room-switch ghost does not construct embedded cards again',constructed===before7&&!gh.querySelector('probe-card')&&gh.querySelector('.elcont > div.x').getAttribute('style')==='top:1px'&&!!gh.querySelector('ha-icon'));

  console.log(fails?('\n'+fails+' STUDIO TEST(S) FAILED'):'\nALL STUDIO TESTS PASSED');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
