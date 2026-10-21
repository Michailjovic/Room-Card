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
  S._setTab('all'); // these checks are about the hosted editor (v6.44.0: the All settings tab)
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
  // Escape guard (v6.44.0: the canvas drag above selected the zone — Escape would clear that first)
  S.deselect();
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
  let rtBad=[],propsForms=0;
  for(const [f,cfg] of cards){
    const e=d.createElement('room-overlay-card-editor');e.setConfig(clone(cfg));e.hass=hass;d.body.appendChild(e);
    const fired=[];e.addEventListener('config-changed',x=>fired.push(x));
    const b=J(e._config),collected=J(e._collectConfig());
    let s;try{s=await C._rocStudio.open({from:'editor',editor:e,hass});}catch(err){rtBad.push(f+': open '+err.message);e.remove();continue;}
    await wait(30);
    if(J(s._ed._collectConfig())!==collected)rtBad.push(f+': hosted editor collects differently');
    if(s._dirty())rtBad.push(f+': dirty right after open');
    // v6.44.0: the Properties form builds for every room and every element, and never writes on its own
    s._setTab('props');
    const nr=s._rooms().length;
    for(let ri=nr?-1:0;ri<Math.max(1,nr);ri++){
      if(nr)s._setRoom(Math.max(0,ri),ri<0,'toolbar');
      try{s._syncProps(true);if(!s._propsPane.querySelector('.pf-head'))rtBad.push(f+': no room/card form');}catch(err){rtBad.push(f+': room form '+err.message);}
      for(const b of [...s._olList.querySelectorAll('.ol-el[data-type]')]){
        try{s._select(b.dataset.type,b.dataset.id,'outline');s._syncProps(true);if(!s._propsPane.querySelector('.pf-field[data-key="_rest"]'))rtBad.push(f+': '+b.dataset.id+' form incomplete');}
        catch(err){rtBad.push(f+': '+b.dataset.type+' '+b.dataset.id+': '+err.message);}
        propsForms++;
      }
      s.deselect();
    }
    for(const cs of [['card'],['nav']].concat((s.work.sections||[]).map(x=>['section',x&&x.id]))){
      try{s.selectCard(cs[0],cs[1]);s._syncProps(true);propsForms++;if(!s._propsPane.querySelector('.pf-head'))rtBad.push(f+': no form for '+cs.join(':'));}catch(err){rtBad.push(f+': '+cs.join(':')+': '+err.message);}
    }
    s.deselect();
    if(s._dirty())rtBad.push(f+': browsing the Properties forms changed the config');
    s._setTab('all');
    await s.save();
    if(fired.length||J(e._config)!==b)rtBad.push(f+': apply without edits changed the config');
    if(dialogs().length)rtBad.push(f+': studio left open');
    e.remove();
  }
  check('round-trip: '+cards.length+' reference configs open → Apply unchanged; hosted editor collects identically; '+propsForms+' Properties forms build without writing',cards.length>=4&&propsForms>20&&!rtBad.length,rtBad.join('\n     '));

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
  S6._setTab('all'); // the Phase 3 checks below follow the selection into the classic editor (All settings)
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

  w.localStorage.removeItem('roc-studio-tab'); // back to the default (Properties)
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

  // ---- 8. Phase 4a (v6.44.0): the Properties form --------------------------------------------
  w.localStorage.removeItem('roc-studio-tab');
  const hass8=Object.assign({},hass,{
    states:{'light.x':{state:'on',attributes:{friendly_name:'Lamp X'}},'cover.blind':{state:'open',attributes:{friendly_name:'Blind'}},'sensor.t':{state:'21.5',attributes:{friendly_name:'Temp',unit_of_measurement:'°C'}}},
    entities:{'sensor.t':{area_id:'kitchen'}},areas:{kitchen:{name:'Kitchen'}},devices:{},services:{script:{turn_on:{}},light:{toggle:{}}}});
  const P8=()=>({type:'custom:room-overlay-card',card_id:'p8',base_image:IMG,
    rooms:[{id:'a',name:'A',base_image:IMG+'a',zr_custom:1,
      zones:[{id:'z1',top:'10%',left:'10%',width:'20%',height:'20%',foo:{bar:1},portrait:{top:'5%'},tap_action:{action:'more-info',entity:'light.x',confirmation:{text:'Sure?'}}},{id:'zbad',top:'5x',left:'50%',width:'10%',height:'10%'}],
      icons:[{id:'i1',icon:'mdi:lamp',top:'50%',left:'50%',size:24,entity:'light.x'}]},
     {id:'b',name:'B',base_image:IMG+'b'}]});
  const E8=d.createElement('room-overlay-card-editor');E8.setConfig(P8());E8.hass=hass8;d.body.appendChild(E8);
  const S8=await C._rocStudio.open({from:'editor',editor:E8,hass:hass8});await wait(200);
  const pane=S8._propsPane,fld=k=>pane.querySelector('.pf-field[data-key="'+k+'"]');
  const inp=k=>fld(k)&&fld(k).querySelector('input,select,textarea');
  const change=(el,v)=>{el.value=v;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
  check('Properties is the default inspector tab, the editor sits under All settings',S8.tab==='props'&&!pane.hidden&&S8._edPane.hidden&&S8._edPane.contains(S8._ed)&&!!S8._tabBtns.all);
  check('nothing selected in a room → the room form',/^A/.test(pane.querySelector('.pf-title').textContent)&&!!fld('name')&&!!fld('base_image')&&!!fld('area_match'));
  check('…the room\'s unknown keys are offered as YAML, its element lists are not',!!fld('_rest')&&/zr_custom/.test(fld('_rest').querySelector('textarea').value)&&!/zones/.test(fld('_rest').querySelector('textarea').value));
  change(inp('name'),'Alpha');
  check('a room field writes only its key',S8.work.rooms[0].name==='Alpha'&&S8.work.rooms[0].zr_custom===1&&S8._roomSel.options[1].text==='Alpha');
  S8.undo();
  S8._select('zone','z1','canvas');await wait(10);
  check('selecting an element shows its form (id, position, actions, YAML for the rest)',pane.querySelector('.pf-title').textContent==='z1'&&inp('id').value==='z1'&&inp('top').value==='10%'&&!!fld('tap_action')&&!!fld('_rest'));
  const restTxt=fld('_rest').querySelector('textarea').value;
  check('…profile overrides and unknown keys are in Advanced, untouched',/foo/.test(restTxt)&&/portrait/.test(restTxt)&&!/width/.test(restTxt));
  const form1=pane.firstChild,u0=S8.undoStack.length;
  change(inp('width'),'25%');
  check('a field change commits that key only (KEEP: other keys, key order)',S8.work.rooms[0].zones[0].width==='25%'&&J(Object.keys(S8.work.rooms[0].zones[0]))===J(Object.keys(P8().rooms[0].zones[0]))&&J(S8.work.rooms[0].zones[0].foo)===J({bar:1}));
  check('…the form is not rebuilt under the cursor',pane.firstChild===form1);
  check('…the canvas shows it',cv8w()==='25%');
  function cv8w(){const el=S8._card.shadowRoot.querySelector('[data-z="z1"]');return el&&el.style.width;}
  S8.lastCommit=Date.now(); // jsdom re-renders the hosted editor slowly — pretend the second change came at once
  change(inp('width'),'26%');
  check('two quick changes of the same key are one undo step',S8.undoStack.length===u0+1);
  S8.lastCommit=Date.now();change(inp('left'),'11%');
  check('…another key is a step of its own',S8.undoStack.length===u0+2);S8.undo();
  change(inp('height'),'');
  check('clearing a field removes the key',!('height' in S8.work.rooms[0].zones[0]));
  S8.undo();
  check('undo rebuilds the form with the restored value',inp('height').value==='20%'&&pane.firstChild!==form1);
  // canvas drag → the form follows
  const nc8=JSON.parse(J(S8._card._config));nc8.rooms[0].zones[0].top='30%';S8._card._posOut(Object.assign({type:'custom:room-overlay-card'},nc8));await wait(40);
  check('a canvas drag updates the position fields',inp('top').value==='30%');
  S8.deselect();
  const nc8b=S8._canvasCfg();nc8b.rooms[0].icons[0].left='55%';S8._card._posOut(Object.assign({type:'custom:room-overlay-card'},nc8b));await wait(40);
  check('dragging an element that was not selected selects it',S8.sel&&S8.sel.id==='i1'&&inp('left').value==='55%',J(S8.sel)+' '+(inp('left')&&inp('left').value)+' '+S8.work.rooms[0].icons[0].left);
  S8.undo();S8._select('zone','z1','outline');
  // action builder
  const act=fld('tap_action'),asel=act.querySelector('select');
  check('action builder reads the action (type, entity)',asel.value==='more-info'&&act.querySelector('.pf-actbody input').value==='light.x');
  asel.value='navigate';asel.dispatchEvent(new w.Event('change'));
  check('switching the type keeps confirmation, drops the old type\'s keys',J(S8.work.rooms[0].zones[0].tap_action)===J({action:'navigate',confirmation:{text:'Sure?'}}),J(S8.work.rooms[0].zones[0].tap_action));
  change(act.querySelector('.pf-actbody input'),'/lovelace/2');
  check('…and its own field writes navigation_path',S8.work.rooms[0].zones[0].tap_action.navigation_path==='/lovelace/2');
  const hsel=fld('hold_action').querySelector('select');hsel.value='perform-action';hsel.dispatchEvent(new w.Event('change'));
  const hb=fld('hold_action').querySelectorAll('.pf-actbody input');
  change(hb[0],'script.turn_on');
  check('perform-action: action name + services offered from hass',S8.work.rooms[0].zones[0].hold_action.perform_action==='script.turn_on'&&!!fld('hold_action').querySelector('datalist option[value="light.toggle"]'));
  const dta=fld('hold_action').querySelector('.pf-actbody textarea');change(dta,'brightness: 50');
  check('…data as YAML',J(S8.work.rooms[0].zones[0].hold_action.data)===J({brightness:50}));
  change(dta,'a: [');
  check('…invalid YAML is reported, not committed',J(S8.work.rooms[0].zones[0].hold_action.data)===J({brightness:50})&&!!fld('hold_action').querySelector('.pf-yaml .pf-msg.error').textContent);
  // the Advanced YAML: edit and keep
  S8._syncProps(true);
  const rt=fld('_rest').querySelector('textarea');
  change(rt,'foo:\n  bar: 2\nportrait:\n  top: 5%\nnew_key: x');
  const z8=S8.work.rooms[0].zones[0];
  check('Advanced YAML changes its keys in place and adds new ones last',z8.foo.bar===2&&z8.new_key==='x'&&Object.keys(z8).indexOf('foo')<Object.keys(z8).indexOf('portrait')&&Object.keys(z8).slice(-1)[0]==='new_key'&&z8.width==='26%');
  change(fld('_rest').querySelector('textarea'),'portrait:\n  top: 5%');
  check('…and removing a key there removes it',!('foo' in S8.work.rooms[0].zones[0])&&!('new_key' in S8.work.rooms[0].zones[0]));
  // rename keeps the selection
  change(inp('id'),'zone_main');
  check('renaming keeps the element selected (form, canvas, outline)',S8.sel.id==='zone_main'&&S8.work.rooms[0].zones[0].id==='zone_main'&&pane.querySelector('.pf-title').textContent==='zone_main'&&S8._card._selectedTM&&S8._card._selectedTM.id==='zone_main');
  change(inp('id'),'zbad');
  check('…a taken id gets a unique suffix',S8.sel.id!=='zbad'&&S8.work.rooms[0].zones[0].id===S8.sel.id&&S8.work.rooms[0].zones[1].id==='zbad');
  // pinned validation
  S8._select('zone','zbad','outline');S8._renderValidation();
  check('validation is pinned to the field',/expected len/.test((fld('top').querySelector('.pf-msg.v.error')||{}).textContent||'')&&fld('top').classList.contains('has-error'));
  check('…marked in the outline',!!S8._olList.querySelector('[data-id="zbad"] .vd.error')&&!S8._olList.querySelector('[data-id="i1"] .vd'));
  check('…ringed on the canvas (studio view only)',/\[data-z="zbad"\][^{]*\{box-shadow/.test(S8._card._rocExtraCss)&&J(S8.work).indexOf('box-shadow')<0);
  change(inp('top'),'5%');S8._renderValidation();
  check('…and gone once fixed',!fld('top').querySelector('.pf-msg.v')&&!S8._olList.querySelector('[data-id="zbad"] .vd')&&!/zbad/.test(S8._card._rocExtraCss||''));
  // entity picker
  S8._select('icon','i1','outline');await wait(10);
  const ein=inp('entity');
  check('entity field shows the live state',/Lamp X · on/.test(fld('entity').querySelector('.pf-sub').textContent));
  ein.dispatchEvent(new w.Event('focus'));await wait(10);
  const eopts=[...fld('entity').querySelectorAll('.rs-opt .o-sub')].map(x=>x.textContent);
  check('entity picker lists HA entities, the type\'s domains first, with areas',eopts[0].indexOf('light.x')===0&&eopts.some(x=>x==='sensor.t · Kitchen'),J(eopts));
  ein.value='kitch';ein.dispatchEvent(new w.Event('input'));await wait(10);
  const kopt=fld('entity').querySelector('.rs-opt');
  check('…searches by area / name',fld('entity').querySelectorAll('.rs-opt').length===1&&/sensor\.t/.test(kopt.textContent));
  check('Escape closes an open picker first (selection and studio stay)',(S8._dlg.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})),!fld('entity').querySelector('.rs-pick.open')&&S8.sel&&S8.sel.id==='i1'&&dialogs().length===1));
  ein.dispatchEvent(new w.Event('focus'));ein.value='kitch';ein.dispatchEvent(new w.Event('input'));await wait(10);
  fld('entity').querySelector('.rs-opt').dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,cancelable:true}));
  check('…a pick writes the entity',S8.work.rooms[0].icons[0].entity==='sensor.t'&&/21\.5 °C/.test(fld('entity').querySelector('.pf-sub').textContent));
  change(ein,'light.nope');
  check('…an unknown entity is flagged',fld('entity').querySelector('.pf-sub').classList.contains('warn'));
  check('a number stays a number (len)',(change(inp('size'),'30'),S8.work.rooms[0].icons[0].size===30));
  // icon picker (Home Assistant's own MDI list)
  let fetched=0;w.fetch=u=>{fetched++;return Promise.resolve({ok:u==='/static/mdi/iconList.json',json:()=>Promise.resolve([{name:'lamp',keywords:['light']},{name:'lightbulb',keywords:[]},{name:'sofa',keywords:['couch']}])});};
  const iin=fld('icon').querySelector('.pf-icon input');
  iin.dispatchEvent(new w.Event('focus'));iin.value='couch';iin.dispatchEvent(new w.Event('input'));await wait(20);
  check('icon picker searches HA\'s icon list by name and keyword',fetched===1&&[...fld('icon').querySelectorAll('.rs-opt .o-main')].map(x=>x.textContent).join()==='mdi:sofa');
  fld('icon').querySelector('.rs-opt').dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,cancelable:true}));
  check('…a pick writes the icon and the preview',S8.work.rooms[0].icons[0].icon==='mdi:sofa'&&fld('icon').querySelector('.pf-icprev').getAttribute('icon')==='mdi:sofa');
  iin.dispatchEvent(new w.Event('focus'));await wait(20);
  check('…the list is fetched once',fetched===1);
  // union fields: conditional colour as YAML, and back
  const cl=fld('color');
  check('a union key offers its simple widget and a switch to conditions',!!cl.querySelector('input[type="color"]')&&!!cl.querySelector('.pf-link'));
  cl.querySelector('.pf-link').click();
  check('…which writes a condition list and shows it as YAML',Array.isArray(S8.work.rooms[0].icons[0].color)&&!!fld('color').querySelector('textarea'));
  fld('color').querySelector('.pf-link').click();
  check('…and back to one value',S8.work.rooms[0].icons[0].color===undefined&&!!fld('color').querySelector('input[type="color"]'));
  // Escape in a field gives up the focus, it does not clear the selection
  const tin=inp('top');tin.focus();
  tin.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,composed:true}));
  check('Escape in a Properties field keeps the selection',S8.sel&&S8.sel.id==='i1');
  // Delete / Backspace typed in a field never deletes the element
  const nIcons=S8.work.rooms[0].icons.length;
  tin.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true,composed:true}));
  check('Backspace in a field does not delete the element',S8.work.rooms[0].icons.length===nIcons);
  // Global → the card form (shared defaults); All settings reveals the element
  S8.deselect();S8._setRoom(0,true,'toolbar');
  check('Global → the card form with the shared defaults',/Global/.test(pane.querySelector('.pf-title').textContent)&&inp('base_image').value===IMG&&!fld('name'));
  S8._setRoom(0,false,'toolbar');S8._select('icon','i1','outline');
  check('while Properties is shown the hidden editor is not rebuilt',S8._edStale===true&&S8._ed._config.rooms[0].icons[0].icon!==S8.work.rooms[0].icons[0].icon);
  pane.querySelector('[data-act="open-all"]').click();
  check('…opening All settings brings it up to date',!S8._edStale&&S8._ed._config.rooms[0].icons[0].icon===S8.work.rooms[0].icons[0].icon);
  check('Open in All settings switches the tab and opens the element there',S8.tab==='all'&&S8._propsPane.hidden&&!!S8._ed.querySelector('details[data-panel="ico-0"]').open);
  check('the tab choice is remembered',w.localStorage.getItem('roc-studio-tab')==='all');
  S8._setTab('props');
  check('back on Properties the form shows the selection again',pane.querySelector('.pf-title').textContent==='i1');
  // multi-selection: the form edits the primary element and says so
  S8._toggleSel('zone','zbad','test');
  check('multi-selection: the form edits the primary one and says so',/2 selected/.test(pane.textContent)&&pane.querySelector('.pf-title').textContent==='zbad');
  // single-room card → the card form
  S8.requestClose();if(layerBtn(S8,'discard'))layerBtn(S8,'discard').click();E8.remove();
  const E9=d.createElement('room-overlay-card-editor');E9.setConfig({type:'custom:room-overlay-card',base_image:IMG,badges:[{id:'b1',position:'top-left',label:'Hi'}]});E9.hass=hass8;d.body.appendChild(E9);
  const S9=await C._rocStudio.open({from:'editor',editor:E9,hass:hass8});await wait(40);
  check('single-room card, nothing selected → the card form',S9._propsPane.querySelector('.pf-title').textContent==='Card'&&!!S9._propsPane.querySelector('.pf-field[data-key="base_image"]'));
  S9._select('badge','b1','outline');
  const pos=S9._propsPane.querySelector('.pf-field[data-key="position"] select');
  check('an element off the canvas (badge) has a form too; enums are selects',!!pos&&pos.value==='top-left'&&[...pos.options].map(o=>o.value).join()===',top-left,top-right,bottom-left,bottom-right');
  pos.value='bottom-right';pos.dispatchEvent(new w.Event('change'));
  check('…and write their value',S9.work.badges[0].position==='bottom-right');
  S9.requestClose();if(layerBtn(S9,'discard'))layerBtn(S9,'discard').click();E9.remove();
  check('card internals expose the action types for the builder',Array.isArray(C._rocInternals.actTypes)&&C._rocInternals.actTypes.some(x=>x[0]==='perform-action'));

  // ---- 9. Phase 4b (v6.45.0): sub-forms, lists, card-level forms -------------------------------
  w.localStorage.removeItem('roc-studio-tab');
  const P10=()=>({type:'custom:room-overlay-card',card_id:'p10',base_image:IMG,
    light_controls:{entities:['light.x'],columns:2},
    sections:[{id:'media',title:'Media',tiles:[{name:'TV',entity:'light.x'}]},{id:'heat',title:'Heat'}],
    groups:[{id:'grp',visible:false}],
    rooms:[{id:'a',name:'A',base_image:IMG+'a',
        zones:[{id:'z1',top:'10%',left:'10%',width:'20%',height:'20%',section:'media',group:'grp',tap_action:{action:'open-section',section:'media'}}],
        blinds:[{id:'b1',top:'10%',left:'60%',width:'10%',height:'30%',entity:'cover.blind'}]},
      {id:'b',name:'B',base_image:IMG+'b',overview:true,light_controls:{entities:['light.x',{entity:'light.x',name:'Lamp'}]}}],
    nav:{style:'tabs'}});
  const E10=d.createElement('room-overlay-card-editor');E10.setConfig(P10());E10.hass=hass8;d.body.appendChild(E10);
  const S10=await C._rocStudio.open({from:'editor',editor:E10,hass:hass8});await wait(100);
  const pn=S10._propsPane,f10=k=>pn.querySelector('.pf-field[data-key="'+k+'"]');
  const lc0=J(S10.work.light_controls);
  check('the outline lists Card settings, Navigation and every section (with how many elements it holds)',!!S10._olCard.querySelector('[data-card="card"]')&&!!S10._olCard.querySelector('[data-card="nav"]')&&[...S10._olCard.querySelectorAll('[data-card^="section:"]')].map(b=>b.dataset.card).join()==='section:media,section:heat'&&S10._olCard.querySelector('[data-card="section:media"] .sub').textContent==='1');
  // room form: inherited light controls
  S10._propsOpen.add('lights');S10._syncProps(true);
  check('a room that inherits the shared light controls says so',!!f10('light_controls').querySelector('.pf-inh')&&!!f10('light_controls').querySelector('[data-act="inh-copy"]'));
  f10('light_controls').querySelector('[data-act="inh-copy"]').click();
  check('…"own copy" copies them into the room, Global untouched',J(S10.work.rooms[0].light_controls)===lc0&&J(S10.work.light_controls)===lc0);
  // light entities: a list; a plain entity string stays a string
  S10._setRoom(1,false,'toolbar');S10._propsOpen.add('lights');S10._propsOpen.add('n:light_controls');S10._syncProps(true);
  const rows=()=>[...f10('light_controls').querySelectorAll('.pf-list > .pf-item')];
  check('light entities are a list (string and object items)',rows().length===2&&rows()[0].querySelector('summary .nl').textContent==='light.x'&&rows()[1].querySelector('summary .nl').textContent==='Lamp');
  const nm0=rows()[0].querySelector('.pf-field[data-key="name"] input');change(nm0,'Ceiling');
  check('naming a plain entity turns it into {entity, name}',J(S10.work.rooms[1].light_controls.entities[0])===J({entity:'light.x',name:'Ceiling'}));
  change(rows()[0].querySelector('.pf-field[data-key="name"] input'),'');
  check('…and back to a plain string when only the entity is left',S10.work.rooms[1].light_controls.entities[0]==='light.x');
  rows()[1].querySelector('[data-act="up"]').click();
  check('move up reorders the list',S10.work.rooms[1].light_controls.entities[0].name==='Lamp');
  f10('light_controls').querySelector('.pf-list > [data-act="add-item"]').click();
  check('Add appends an item (a plain value in a list of plain values… here mixed: an object) and opens it',S10.work.rooms[1].light_controls.entities.length===3&&rows().length===3&&rows()[2].open);
  rows()[2].querySelector('[data-act="remove"]').click();
  check('remove takes it out',S10.work.rooms[1].light_controls.entities.length===2);
  const colIn=f10('light_controls').querySelector('.pf-field[data-key="columns"] input');change(colIn,'3');
  check('a sub-form field writes inside the object only',S10.work.rooms[1].light_controls.columns===3&&J(S10.work.rooms[1].light_controls.entities)===J([{entity:'light.x',name:'Lamp'},'light.x']));
  // overview room: bool|obj grows
  S10._propsOpen.add('overview');S10._syncProps(true);
  const ov=f10('overview');
  check('overview: true is a checkbox with "More options…"',ov.querySelector('input[type="checkbox"]').checked&&!!ov.querySelector('[data-act="more-options"]'));
  ov.querySelector('[data-act="more-options"]').click();
  check('…which turns it into an object (still on) and opens its form',J(S10.work.rooms[1].overview)==='{}'&&!!f10('overview').querySelector('.pf-nest[open] .pf-field[data-key="grid"]'));
  f10('overview').querySelector('[data-act="as-simple"]').click();
  check('…and back to plain on',S10.work.rooms[1].overview===true);
  // YAML switch
  f10('light_controls').querySelector('[data-act="as-yaml"]').click();
  check('a sub-form can be edited as YAML',!!f10('light_controls').querySelector('textarea')&&!!f10('light_controls').querySelector('[data-act="as-form"]'));
  f10('light_controls').querySelector('[data-act="as-form"]').click();
  check('…and back as a form',!!f10('light_controls').querySelector('.pf-nest'));
  // pinned validation inside a sub-form
  const cbad=JSON.parse(J(S10.work));cbad.rooms[1].light_controls.columns='three';S10._commit(cbad,'test');S10._renderValidation();S10._syncProps(true);S10._renderValidation();
  const colF=f10('light_controls').querySelector('.pf-field[data-key="columns"]');
  check('a problem deep in a sub-form is pinned to its field, and its collapsed parents are marked',/expected num/.test((colF.querySelector('.pf-msg.v')||{}).textContent||'')&&f10('light_controls').querySelector('.pf-nest').classList.contains('has-err')&&pn.querySelector('[data-sec="lights"]').classList.contains('has-err'));
  S10.undo();
  // element: section / group suggestions, tile sub-form, cover control
  S10._setRoom(0,false,'toolbar');S10._select('zone','z1','outline');S10._propsOpen.add('visibility');S10._syncProps(true);
  check('Section / Group fields suggest the ids in the card',[...f10('section').querySelectorAll('datalist option')].map(o=>o.value).join()==='media,heat'&&[...f10('group').querySelectorAll('datalist option')].map(o=>o.value).join()==='grp');
  const tileName=f10('tile').querySelector('.pf-field[data-key="name"] input');change(tileName,'Main light');
  check('an element\'s tile is a sub-form; a field creates the object',J(S10.work.rooms[0].zones[0].tile)===J({name:'Main light'}));
  S10._select('blind','b1','outline');S10._syncProps(true);
  const ctl=f10('control');ctl.querySelector('input[type="checkbox"]').click();
  check('cover control: the checkbox turns it on',S10.work.rooms[0].blinds[0].control===true);
  f10('control').querySelector('[data-act="more-options"]').click();
  change(f10('control').querySelector('.pf-field[data-key="name"] input'),'Blind');
  check('…More options gives its form',J(S10.work.rooms[0].blinds[0].control)===J({name:'Blind'}));
  const pl=f10('control').querySelector('.pf-field[data-key="presets"]');
  pl.querySelector('[data-act="add-item"]').click();
  change(f10('control').querySelector('.pf-field[data-key="presets"] .pf-field[data-key="position"] input'),'40');
  check('…with its presets as a list',J(S10.work.rooms[0].blinds[0].control.presets)===J([{position:40}]));
  // sections
  S10.selectCard('section','media');
  check('a section in the outline opens its form (no element selected)',!S10.sel&&pn.querySelector('.pf-title').textContent==='Media'&&S10._olCard.querySelector('[data-card="section:media"]').getAttribute('aria-current')==='true');
  check('…listing the elements tagged into it',[...pn.querySelectorAll('.pf-members [data-member]')].map(b=>b.dataset.member).join()==='zone:z1');
  S10._propsOpen.add('content');S10._syncProps(true);
  check('…and its tiles as a list',[...f10('tiles').querySelectorAll('.pf-item summary .nl')].map(x=>x.textContent).join()==='TV');
  change(pn.querySelector('.pf-idrow input'),'tv');
  const z10=S10.work.rooms[0].zones[0];
  check('renaming a section takes its references along (element tag, open-section action)',S10.work.sections[0].id==='tv'&&z10.section==='tv'&&z10.tap_action.section==='tv'&&S10.cardSel.id==='tv');
  pn.querySelector('[data-act="sec-down"]').click();
  check('sections reorder',S10.work.sections.map(x=>x.id).join()==='heat,tv'&&pn.querySelector('.pf-title').textContent==='Media');
  pn.querySelector('[data-act="sec-del"]').click();
  check('…and delete (Undo brings it back)',S10.work.sections.map(x=>x.id).join()==='heat'&&!S10.cardSel&&(S10.undo(),S10.work.sections.length===2));
  S10._showAddSection();
  check('Add section offers the editor\'s recipes (one needing a missing card is disabled)',!!S10._sr.querySelector('.layer [data-recipe="media"]')&&S10._sr.querySelector('.layer [data-recipe="electricity"]').disabled);
  S10._sr.querySelector('.layer [data-recipe="heating"]').click();
  const ns=S10.work.sections.slice(-1)[0];
  check('…a recipe makes a section with the editor\'s defaults, selected',ns.id==='heating'&&ns.domain==='climate'&&ns.source==='auto'&&S10.cardSel.id==='heating');
  // group rename takes element refs
  S10._setRoom(0,true,'toolbar');S10._select('group','grp','outline');change(pn.querySelector('.pf-idrow input'),'grp2');
  check('renaming a group updates the elements in it',S10.work.groups[0].id==='grp2'&&S10.work.rooms[0].zones[0].group==='grp2');
  // nav and card settings
  S10.selectCard('nav');
  check('Navigation opens the nav form',pn.querySelector('.pf-title').textContent==='Navigation'&&f10('style').querySelector('select').value==='tabs');
  const nst=f10('style').querySelector('select');nst.value='';nst.dispatchEvent(new w.Event('change'));
  check('…clearing its last key removes `nav:` (no empty object left)',!('nav' in S10.work));
  S10.undo();
  S10.selectCard('card');S10._propsOpen.add('card');S10._syncProps(true);
  check('Card settings: card-wide keys (aspect ratio, follow mode…)',!!f10('aspect_ratio')&&!!f10('follow_mode')&&!!f10('base_image'));
  const fm=f10('follow_mode').querySelector('select');fm.value='manual';fm.dispatchEvent(new w.Event('change'));
  check('…write to the top level',S10.work.follow_mode==='manual');
  S10.deselect();
  check('Escape / deselect leaves the card-level form for the room form',!S10.cardSel&&S10.global===true&&/Global/.test(pn.querySelector('.pf-title').textContent));
  // weather_overlay: an entity grows into {entity}
  S10._setRoom(0,false,'toolbar');S10._propsOpen.add('image');S10._syncProps(true);
  change(f10('weather_overlay').querySelector('input'),'weather.home');
  f10('weather_overlay').querySelector('[data-act="more-options"]').click();
  check('an entity value grows into {entity: …} with More options',J(S10.work.rooms[0].weather_overlay)===J({entity:'weather.home'}));
  S10.requestClose();if(layerBtn(S10,'discard'))layerBtn(S10,'discard').click();E10.remove();

  console.log(fails?('\n'+fails+' STUDIO TEST(S) FAILED'):'\nALL STUDIO TESTS PASSED');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
