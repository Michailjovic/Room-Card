#!/usr/bin/env node
/**
 * Lifecycle & config-shape regression tests (jsdom).
 *
 * This tier exists because render.test.js only ever asserts on a card that was
 * rendered once and left alone. Every bug fixed in v5.9.14 lived outside that
 * window: what happens when HA MOVES the card element (dashboard edit-mode
 * toggle → disconnectedCallback + connectedCallback), and what happens when a
 * config field is written in its scalar shorthand form.
 *
 * Two setup details are load-bearing:
 *  - IntersectionObserver / ResizeObserver are POLYFILLED below. jsdom ships
 *    neither, so without them "the observer is gone" and "the API never existed"
 *    are indistinguishable — which produces a false PASS on the _io assertions
 *    and a false FAIL on _ro.
 *  - They live in their own file (not render.test.js) precisely so those
 *    polyfills don't perturb the 179 assertions over there.
 *
 * Usage: node tests/lifecycle.test.js [path-to-card.js]   (requires: npm i -D jsdom)
 */
'use strict';
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.log('jsdom not installed - skipping lifecycle tests (npm i -D jsdom)');process.exit(0);}
const fs=require('fs');
const path=require('path');
const code=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','room-overlay-card.js'),'utf8');

const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.innerWidth=1920;w.innerHeight=1080;
w.requestIdleCallback=f=>setTimeout(f,0);
w.loadCardHelpers=undefined;
// A real IntersectionObserver delivers an INITIAL observation asynchronously
// as soon as you observe() a target — that is what un-freezes a card whose
// _visible went stale. The polyfill must do the same or the recovery assertion
// below tests a browser that doesn't exist. jsdom has no layout, so "visible"
// is the only sane default (and matches _visible's own initial value).
w.IntersectionObserver=class{
  constructor(cb){this.cb=cb;this.targets=[];}
  observe(t){this.targets.push(t);const self=this;Promise.resolve().then(function(){
    if(self.targets.indexOf(t)>=0)self.cb([{target:t,isIntersecting:true}],self);
  });}
  unobserve(t){const i=this.targets.indexOf(t);if(i>=0)this.targets.splice(i,1);}
  disconnect(){this.targets=[];}
};
w.ResizeObserver=class{constructor(cb){this.cb=cb;}observe(){}unobserve(){}disconnect(){}};
w.eval(code);
{const _E=w.customElements.get('room-overlay-card-editor');if(_E)_E.rocDefaultView='classic';} // v7: the classic tabs are tested here; the launcher has its own tests

let fails=0;
const t=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};

// Records every template subscription so we can assert on them.
let subs=[];
const mkHass=(states)=>({
  states:states||{},callService(){},user:{name:'x'},locale:{language:'en'},
  connection:{subscribeMessage(cb,msg){subs.push(msg.template);return Promise.resolve(function(){});}}
});
const mkCard=(cfg,states)=>{
  const el=w.document.createElement('room-overlay-card');
  el.setConfig(cfg);el.hass=mkHass(states);
  w.document.body.appendChild(el);return el;
};

// =====================================================================
// 1. Scalar shorthand must never throw (resolveVal / resolveFilter*).
//    Before v5.9.14 a bare string hit `conds.find(...)` and the TypeError
//    escaped `set hass` — card rendered once, then dead.
// =====================================================================
const scalarCases=[
  ['badge label',            {badges:[{id:'b',position:'top-left',icon:'mdi:x',label:'Kitchen'}]}],
  ['badge icon_color',       {badges:[{id:'b',position:'top-left',icon:'mdi:x',icon_color:'red'}]}],
  ['icon color',             {icons:[{id:'i',entity:'sensor.a',icon:'mdi:x',color:'#fff',top:'1%',left:'1%'}]}],
  ['overlay opacity',        {overlays:[{id:'o',image:'/local/o.png',conditions:{opacity:0.5}}]}],
  ['overlay filter',         {overlays:[{id:'o',image:'/local/o.png',conditions:{filter:'blur(2px)'}}]}],
  ['label color',            {labels:[{id:'l',entity:'sensor.a',color:'red',top:'1%',left:'1%'}]}],
  ['gauge color',            {gauges:[{id:'g',entity:'sensor.a',color:'red',top:'1%',left:'1%',width:'5%',height:'20%'}]}],
  ['filter_conditions',      {filter_conditions:'brightness(0.5)'}],
];
const st={'sensor.a':{state:'21',attributes:{unit_of_measurement:'°C'}}};
for(const [name,extra] of scalarCases){
  let err=null;
  try{mkCard(Object.assign({base_image:'/local/x.webp'},extra),st);}catch(e){err=e.message;}
  t('scalar shorthand renders: '+name+(err?' — '+err:''),!err);
}
// ...and the scalar value is actually APPLIED, not just survived
const scalarBadge=mkCard({base_image:'/local/x.webp',
  badges:[{id:'b',position:'top-left',icon:'mdi:x',label:'Kitchen'}]},st);
const _blbl=scalarBadge.shadowRoot.querySelector('[data-b="b"] .blabel,[data-b="b"] span');
t('scalar badge label text is rendered',!!_blbl&&/Kitchen/.test(scalarBadge.shadowRoot.textContent));

// the conditional (array) form still wins where both are possible
const condBadge=mkCard({base_image:'/local/x.webp',badges:[{id:'b',position:'top-left',icon:'mdi:x',
  label:[{condition:{entity:'sensor.a',operator:'>',value:10},value:'HOT'},{value:'cold'}]}]},st);
t('conditional label form still resolves',/HOT/.test(condBadge.shadowRoot.textContent));

// =====================================================================
// 2. HA edit-mode DOM move: every hook must come back alive.
// =====================================================================
const lc=mkCard({base_image:'/local/x.webp',parallax:true,
  labels:[{id:'l1',entity:'sensor.a',format:'relative',top:'10%',left:'10%'}]},
  {'sensor.a':{state:'2024-01-01T00:00:00Z',attributes:{}}});
const alive=(el)=>({io:!!el._io,ro:!!el._ro,hl:!!el._hlHandler,rel:!!el._relTimer});
const before=alive(lc);
t('baseline: all hooks live after first render',before.io&&before.ro&&before.hl&&before.rel);

const mover=w.document.createElement('div');
w.document.body.appendChild(mover);
mover.appendChild(lc);                       // HA's atomic move: disconnect + connect
const after=alive(lc);
t('IntersectionObserver survives the DOM move',after.io);
t('ResizeObserver survives the DOM move',after.ro);
t('roc-highlight handler survives the DOM move',after.hl);
t('relative-time ticker survives the DOM move',after.rel);
t('IntersectionObserver is re-observing the card',lc._io.targets.indexOf(lc)>=0);

// Environments without IntersectionObserver must never suppress updates:
// _visible can never be corrected there, so it must not gate anything.
// Asserted behaviourally, not by matching source text — this file also runs
// against the minified bundle, where a source regex would be meaningless.
const noIo=mkCard({base_image:'/local/x.webp',labels:[{id:'q',entity:'sensor.a',top:'1%',left:'1%'}]},st);
noIo._io=null;noIo._visible=false;     // simulate "no IO available at all"
let noIoUpdated=false;
const _noIoU=noIo._update.bind(noIo);
noIo._update=function(){noIoUpdated=true;return _noIoU();};
const _rafSave=w.requestAnimationFrame;w.requestAnimationFrame=f=>f();
noIo.hass=mkHass({'sensor.a':{state:'77',attributes:{}}});
w.requestAnimationFrame=_rafSave;
t('without an IntersectionObserver, updates are never suppressed',noIoUpdated);

(async()=>{

// A card that was off-screen when HA moved it must not stay frozen. The
// re-observe() in connectedCallback is what saves it: the fresh initial
// observation flips _visible back to true.
const frozen=mkCard({base_image:'/local/x.webp',
  labels:[{id:'l',entity:'sensor.a',top:'1%',left:'1%'}]},st);
frozen._visible=false;                       // scrolled out of view
const mover2=w.document.createElement('div');
w.document.body.appendChild(mover2);
mover2.appendChild(frozen);                  // disconnect + connect
await new Promise(r=>setTimeout(r,0));       // let the IO deliver its initial observation
t('off-screen card recovers _visible after a DOM move',frozen._visible===true);
let updated=false;
const _origUpd=frozen._update.bind(frozen);
frozen._update=function(){updated=true;return _origUpd();};
w.requestAnimationFrame=f=>f();              // run the scheduled frame inline
frozen.hass=mkHass({'sensor.a':{state:'99',attributes:{}}});
t('...and state updates reach it again',updated);

// =====================================================================
// 3. Per-room templates subscribe from the MERGED room view.
// =====================================================================
subs=[];
mkCard({rooms:[
  {id:'kitchen',base_image:'/local/k.webp',labels:[{id:'kl',template:'{{ states("sensor.k") }}',top:'5%',left:'5%'}]},
  {id:'bath',base_image:'/local/b.webp',labels:[{id:'bl',template:'{{ states("sensor.b") }}',top:'5%',left:'5%'}]}
]});
t('per-room label template subscribes (1 sub for the active room)',subs.length===1&&/sensor\.k/.test(subs[0]));

subs=[];
mkCard({rooms:[{id:'a',base_image:'/local/a.webp',
  badges:[{id:'ab',position:'top-left',icon:'mdi:x',label_template:'{{ 1 }}'}],
  zones:[{id:'az',top:'1%',left:'1%',width:'5%',height:'5%',visible_template:'{{ true }}'}]}]});
t('per-room badge label_template + zone visible_template subscribe',subs.length===2);

subs=[];
mkCard({base_image:'/local/x.webp',labels:[{id:'tl',template:'{{ 2 }}',top:'5%',left:'5%'}]});
t('top-level template still subscribes (no regression)',subs.length===1);

// switching rooms re-subscribes to the NEW room's templates
subs=[];
const multi=mkCard({rooms:[
  {id:'r1',base_image:'/local/1.webp',labels:[{id:'x',template:'{{ ROOM1 }}',top:'5%',left:'5%'}]},
  {id:'r2',base_image:'/local/2.webp',labels:[{id:'x',template:'{{ ROOM2 }}',top:'5%',left:'5%'}]}
]});
subs=[];
multi._switchRoom(1,1,true,true);
t('room switch subscribes the new room\'s template',subs.some(s=>/ROOM2/.test(s)));

// =====================================================================
// 4. Editor must not leak window listeners.
// =====================================================================
const listeners={};
const _wAdd=w.addEventListener.bind(w),_wRm=w.removeEventListener.bind(w);
w.addEventListener=function(ty,f,o){if(/^roc-/.test(ty))(listeners[ty]=listeners[ty]||new Set()).add(f);return _wAdd(ty,f,o);};
w.removeEventListener=function(ty,f,o){if(listeners[ty])listeners[ty].delete(f);return _wRm(ty,f,o);};
const countRoc=()=>Object.keys(listeners).reduce((n,k)=>n+listeners[k].size,0);

const edBase=countRoc();
for(let i=0;i<3;i++){
  const ed=w.document.createElement('room-overlay-card-editor');
  ed.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',
    rooms:[{id:'a',base_image:'/local/a.webp'},{id:'b',base_image:'/local/b.webp'}]});
  ed.hass=mkHass();
  w.document.body.appendChild(ed);
  ed.remove();
}
t('editor open/close leaks no roc-* window listeners',countRoc()===edBase,);
w.addEventListener=_wAdd;w.removeEventListener=_wRm;

// =====================================================================
// 5. Hot-path budget. These are ceilings, not exact numbers — they exist so
//    that reintroducing an uncached DOM query or a forced layout read in a
//    per-item loop fails CI instead of being noticed months later.
// =====================================================================
const perf=mkCard({base_image:'/local/x.webp',
  icons:Array.from({length:20},(_,i)=>({id:'i'+i,entity:'sensor.a',icon:'mdi:home',top:'1%',left:'1%',size:'20px'})),
  labels:Array.from({length:20},(_,i)=>({id:'pl'+i,entity:'sensor.a',top:'1%',left:'1%'}))},st);
const counters={qs:0,offW:0};
const _q=w.Element.prototype.querySelector;
w.Element.prototype.querySelector=function(...a){counters.qs++;return _q.apply(this,a);};
const _ow=Object.getOwnPropertyDescriptor(w.HTMLElement.prototype,'offsetWidth');
Object.defineProperty(w.HTMLElement.prototype,'offsetWidth',{..._ow,get(){counters.offW++;return _ow.get.call(this);}});
perf._update();
const updOps={...counters};
counters.qs=0;counters.offW=0;
perf._applyResizeStyles();
const rezOps={...counters};
w.Element.prototype.querySelector=_q;
Object.defineProperty(w.HTMLElement.prototype,'offsetWidth',_ow);
console.log('     (40 items → _update: '+updOps.qs+' querySelector, '+updOps.offW+' offsetWidth'
  +'  |  _applyResizeStyles: '+rezOps.qs+' / '+rezOps.offW+')');
t('_update() does not scale querySelector with item count',updOps.qs===0);
t('_update() skips the offsetWidth reflow when no item is %-sized',updOps.offW===0);
t('resize restyle is free when nothing is %-sized',rezOps.qs===0&&rezOps.offW===0);

// ...but a %-sized icon MUST still resolve against the real card width
const pct=mkCard({base_image:'/local/x.webp',
  icons:[{id:'pi',entity:'sensor.a',icon:'mdi:home',top:'1%',left:'1%',size:'10%'}]},st);
t('%-sized icon sets _needsCardWidth',pct._needsCardWidth===true);
// ...and actually resolves to px. This is the real risk of the lazy-offsetWidth
// change: a %-size that silently stops resolving would look fine in jsdom
// unless the computed value is asserted.
Object.defineProperty(pct,'offsetWidth',{configurable:true,get(){return 400;}});
pct._update();
const _pcIcon=pct._icoIconEls['pi'];
t('%-sized icon resolves against card width (10% of 400 = 40px)',
  !!_pcIcon&&_pcIcon.style.getPropertyValue('--mdc-icon-size')==='40px');
Object.defineProperty(pct,'offsetWidth',{configurable:true,get(){return 800;}});
pct._applyResizeStyles();
t('...and _applyResizeStyles re-resolves it on resize (10% of 800 = 80px)',
  _pcIcon.style.getPropertyValue('--mdc-icon-size')==='80px');
t('non-%-sized config leaves _needsCardWidth false',perf._needsCardWidth===false);
// per-profile override must be detected too (tApply pulls size from it)
const pctProf=mkCard({base_image:'/local/x.webp',
  icons:[{id:'pp',entity:'sensor.a',icon:'mdi:home',top:'1%',left:'1%',size:'20px',portrait:{size:'12%'}}]},st);
t('%-size hidden in a per-profile override is detected',pctProf._needsCardWidth===true);

// the ResizeObserver must NOT run a full state pass any more
const noUpd=mkCard({base_image:'/local/x.webp',
  icons:[{id:'n',entity:'sensor.a',icon:'mdi:home',top:'1%',left:'1%',size:'20px'}]},st);
let fullPasses=0;
const _origU=noUpd._update.bind(noUpd);
noUpd._update=function(){fullPasses++;return _origU();};
noUpd._applyResizeStyles();
t('resize restyle does not trigger a full _update() pass',fullPasses===0);

// coalescing: many layout requests in one task collapse to a single pass
const coal=mkCard({base_image:'/local/x.webp'},st);
let fits=0,stages=0;
coal._layoutFitWrap=function(){fits++;};
coal._layoutStage=function(){stages++;};
for(let i=0;i<50;i++)coal._requestLayout();
await Promise.resolve();await Promise.resolve();
t('50 layout requests in one task coalesce into one pass',fits===1&&stages===1);

// =====================================================================
// 6. Template subscription failures must not become unhandled rejections.
// =====================================================================
let unhandled=0;
process.on('unhandledRejection',()=>{unhandled++;});
const badEl=w.document.createElement('room-overlay-card');
badEl.setConfig({base_image:'/local/x.webp',labels:[{id:'l',template:'{{ nope }}',top:'1%',left:'1%'}]});
badEl.hass={states:{},callService(){},user:{},locale:{},
  connection:{subscribeMessage(){return Promise.reject(new Error('template error'));}}};
w.document.body.appendChild(badEl);

// =====================================================================
// 7. Editor honesty: no control may exist that the card cannot act on.
//    dock_side was such a control — the editor offered a left/right select,
//    coverControlNorm turned it into `side`, and nothing ever read it (a
//    docked control is flex:1 1 0 and fills its whole cover region).
// =====================================================================
const edDock=w.document.createElement('room-overlay-card-editor');
edDock.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',
  blinds:[{id:'b1',entity:'cover.x',top:'1%',left:'1%',width:'10%',height:'20%',
    control:{placement:'dock',slider:true,presets:[{position:50,icon:'mdi:blinds'}]}}]});
edDock.hass=mkHass();
w.document.body.appendChild(edDock);
t('editor no longer offers a Dock side control',!edDock.querySelector('[data-bl-ccside]'));
t('...and does not write dock_side back into the config',
  !JSON.stringify(edDock._collectConfig()).includes('dock_side'));
// an existing dock_side in an old config must not break anything
const edLegacy=w.document.createElement('room-overlay-card-editor');
let legacyErr=null;
try{
  edLegacy.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp',
    blinds:[{id:'b1',entity:'cover.x',top:'1%',left:'1%',width:'10%',height:'20%',
      control:{placement:'dock',dock_side:'left',slider:true}}]});
  edLegacy.hass=mkHass();w.document.body.appendChild(edLegacy);
  edLegacy._collectConfig();
}catch(e){legacyErr=e.message;}
t('legacy dock_side in an existing config is harmless'+(legacyErr?' — '+legacyErr:''),!legacyErr);

// =====================================================================
// 8. Editor escaping matches the card's (escA), including nullish handling.
//    The editor's own _e() used String(s), so an unset field rendered the
//    literal text "undefined" into its input box.
// =====================================================================
const edEsc=w.document.createElement('room-overlay-card-editor');
edEsc.setConfig({type:'custom:room-overlay-card',base_image:'/local/x.webp'});
edEsc.hass=mkHass();
w.document.body.appendChild(edEsc);
t('unset editor fields never render the literal "undefined"',
  !/value="undefined"|>undefined</.test(edEsc.innerHTML));
t('unset editor fields never render the literal "null"',
  !/value="null"|>null</.test(edEsc.innerHTML));
t('_e escapes apostrophes like escA does',edEsc._e("it's")==="it&#39;s");
t('_e maps nullish to empty string',edEsc._e(undefined)===''&&edEsc._e(null)==='');

// =====================================================================
// 9. 7.0.0-beta.4 — findings of ANALYSIS_v7.0.0-beta.3.md (each was a FAIL
//    in tests/probes/probe_v7_0_0b3.js on beta.3).
// =====================================================================
{
  const tick=()=>new Promise(r=>setTimeout(r,40));
  const IMG='/local/x.webp';
  const st=(id,v,a)=>({[id]:{entity_id:id,state:String(v),attributes:a||{}}});
  const callsOf=(el)=>{const c=[];el._hass.callService=function(d,sv,data,tg){c.push([d,sv,data,tg]);return Promise.resolve();};return c;};
  // actions take the element's entity (HA convention)
  {const el=mkCard({base_image:IMG,layout:{},icons:[{id:'i',entity:'light.a',icon:'mdi:x',top:'10%',left:'10%',tap_action:{action:'toggle'}}]},st('light.a','on'));
    await tick();const calls=callsOf(el);
    el.shadowRoot.querySelector('[data-ico="i"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    t('beta.4: {action: toggle} without entity toggles the icon\'s entity',calls.length===1&&calls[0][2].entity_id==='light.a');}
  {let got=null;
    const el=mkCard({base_image:IMG,layout:{},sections:[{id:'s',name:'S',tiles:[{entity:'switch.wm',name:'WM',tap_action:{action:'more-info'}}]}],
      icons:[{id:'i',icon:'mdi:x',top:'10%',left:'10%',tap_action:{action:'open-section',section:'s'}}]},st('switch.wm','on'));
    await tick();el.addEventListener('hass-more-info',e=>got=e.detail);
    el.shadowRoot.querySelector('[data-ico="i"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
    const tile=el.shadowRoot.querySelector('.roc-tile');if(tile)tile.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
    t('beta.4: tile {action: more-info} opens the tile entity (the documented example)',!!(got&&got.entityId==='switch.wm'));}
  {let got=null;const el=mkCard({base_image:IMG,layout:{},zones:[{id:'z',top:'1%',left:'1%',width:'9%',height:'9%',tap_action:{action:'more-info',entity_id:'light.b'}}]},{});
    await tick();el.addEventListener('hass-more-info',e=>got=e.detail);
    el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    t('beta.4: more-info with entity_id (HA spelling) works',!!(got&&got.entityId==='light.b'));}
  {const el=mkCard({base_image:IMG,layout:{},zones:[{id:'z',entity:'light.a',top:'1%',left:'1%',width:'9%',height:'9%',hold_action:{action:'toggle'}}]},st('light.a','on'));
    await tick();const calls=callsOf(el);
    el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    t('beta.4: keyboard Enter runs the hold action of a hold-only element',calls.length===1);}
  // HA numeric_state conditions
  {const S={'sensor.t':{state:'20',attributes:{}},'sensor.u':{state:'unavailable',attributes:{}}};
    t('beta.4: {above: 25} at 20 is false',w.eval('evalCond')({entity:'sensor.t',above:25},S)===false);
    t('beta.4: {below: 10} at 20 is false',w.eval('evalCond')({entity:'sensor.t',below:10},S)===false);
    t('beta.4: {above: 15, below: 25} at 20 is true',w.eval('evalCond')({entity:'sensor.t',above:15,below:25},S)===true);
    t('beta.4: above on a non-numeric state is false',w.eval('evalCond')({entity:'sensor.u',above:1},S)===false);}
  // a single object where a list belongs
  {let err=null,el=null;try{el=mkCard({base_image:IMG,layout:{},brightness_model:{source:{entity:'sensor.lux'},filter_gradient:[{value:0,filter:'brightness(0.3)'},{value:100,filter:'none'}]}},st('sensor.lux',0));}catch(e){err=e;}
    await tick();
    t('beta.4: brightness_model.source as one object renders and filters',!err&&el._rendered&&!el._rocErr&&/brightness\(0\.3/.test(el._baseEl.style.filter));}
  {const el=mkCard({base_image:IMG,layout:{},gauges:{id:'g',entity:'sensor.x',top:'1%',left:'1%',width:'2%',height:'20%'}},st('sensor.x',50));await tick();
    t('beta.4: gauges: as an object is read as a list of one',!!el._gaugeEls.g&&!el._rocErr);}
  {const raw={base_image:IMG,layout:{},gauges:{id:'g',entity:'sensor.x'}};const el=mkCard(raw,{});
    t('beta.4: the config object HA handed in is not mutated',!Array.isArray(raw.gauges));}
  {const el=w.document.createElement('room-overlay-card');w.document.body.appendChild(el);
    el.setConfig({base_image:IMG,layout:{},icons:[{id:'i',icon:'mdi:x',tap_action:{action:'toggle'}}]});
    const orig=el._renderInner;el._renderInner=function(){throw new Error('boom');};
    el.hass=mkHass({});
    t('beta.4: a render failure shows an error card instead of an empty one',!!el._rocErr&&/configuration error/.test(el.shadowRoot.textContent)&&/boom/.test(el.shadowRoot.textContent));
    el.hass=mkHass({'x.y':{state:'1',attributes:{}}});
    t('beta.4: …and does not retry the render on every state change',el._rocErr&&el._rocErr.message==='boom');
    el._renderInner=orig;el.setConfig({base_image:IMG,layout:{},zones:[]});
    t('beta.4: …a new config renders normally again',!el._rocErr&&!!el.shadowRoot.querySelector('.wrap'));}
  // blinds on covers
  {const el=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'30%'}]},st('cover.x','open',{current_position:25}));
    await tick();await tick();const f=Object.values(el._gaugeFills)[0];
    t('beta.4: blind on a cover without attribute reads current_position, 100 = open (25 % open → 75 % covered)',!!f&&f.style.height==='75%');}
  {const el=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'30%'}]},st('cover.x','closed'));
    await tick();await tick();const f=Object.values(el._gaugeFills)[0];
    t('beta.4: blind on a cover without a position: closed → fully covered',!!f&&f.style.height==='100%');}
  {const el=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'30%',min:100,max:0,attribute:'current_position'}]},st('cover.x','open',{current_position:25}));
    await tick();await tick();const f=Object.values(el._gaugeFills)[0];
    t('beta.4: explicit attribute + min/max unchanged (legacy configs keep their look)',!!f&&f.style.height==='75%');}
  {const s=p=>st('cover.x','open',{current_position:p,supported_features:15});
    const el=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'30%',control:true}]},s(40));
    await tick();await tick();el.hass=mkHass(s(75));await tick();await tick();
    const rec=el._ccEls&&el._ccEls.b;
    t('beta.4: cover control follows current_position while the state stays "open"',!!rec&&rec.pct&&rec.pct.textContent==='75 %');}
  // pages without a picture
  {let err=null;try{mkCard({layout:{},rooms:[{id:'plan',floorplan:{rooms:[{name:'A',polygon:[[0,0],[4,0],[4,3],[0,3]]}]}}]},{});}catch(e){err=e;}
    t('beta.4: a card made only of a floor plan page is accepted',!err);}
  {let err=null;try{mkCard({layout:{},rooms:[{id:'home',overview:{}}]},{});}catch(e){err=e;}
    t('beta.4: a card made only of an overview page is accepted',!err);}
  {let err=null;try{mkCard({layout:{},rooms:[{id:'a',name:'A'}]},{});}catch(e){err=e;}
    t('beta.4: a room with no picture and no page is still refused',!!err);}
  // stale values
  {const el=mkCard({base_image:IMG,layout:{},labels:[{id:'l',entity:'sensor.t',suffix:'°',top:'10%',left:'10%'}]},st('sensor.t','21.5'));
    await tick();const lb=el._lblEls.l,a=lb.textContent;el.hass=mkHass({'sensor.other':{state:'1',attributes:{}}});await tick();
    t('beta.4: a label whose entity disappeared shows — instead of the last value',a!=='—'&&lb.textContent==='—');}
  {const el=mkCard({base_image:IMG,layout:{},gauges:[{id:'g',entity:'sensor.x',top:'1%',left:'1%',width:'2%',height:'20%'}]},st('sensor.x','40'));
    await tick();el.hass=mkHass(st('sensor.x','unavailable'));await tick();
    t('beta.4: an unavailable gauge is greyed, not left looking live',el._gaugeEls.g.dataset.rocNa==='1');
    el.hass=mkHass(st('sensor.x','60'));await tick();
    t('beta.4: …and back to normal with a value',!el._gaugeEls.g.dataset.rocNa);}
  // safe default taps
  {const tap=w.eval('rocOvChipDefaultTap');
    t('beta.4: overview chip of a siren: more-info, not toggle',tap('siren.alarm').action==='more-info');
    const S={'cover.garage':{state:'closed',attributes:{device_class:'garage'}},'cover.blind':{state:'open',attributes:{device_class:'blind'}}};
    const el=mkCard({base_image:IMG,layout:{}},S);
    t('beta.4: overview chip of a garage door: more-info',el._resolveAct(tap('cover.garage')).action==='more-info');
    t('beta.4: overview chip of a blind: toggle',el._resolveAct(tap('cover.blind')).action==='toggle');}
  // next-room wraps with a slide; confirmation in the card
  {const rooms=[0,1,2,3].map(i=>({id:'r'+i,base_image:IMG}));const el=mkCard({layout:{},rooms},{});await tick();
    el._roomIdx=3;el._render();
    el._lastRoomDragEnd=0;el._exec({action:'next-room'}); // rAF runs inline in this file: the slide has already started
    const cs=[...el.shadowRoot.querySelectorAll('.content')];
    t('beta.4: next-room from the last room slides (no crossfade)',el._roomIdx===0&&cs.length===2&&cs[1].style.transform==='translateX(-100%)');}
  {const el=mkCard({base_image:IMG,layout:{},zones:[{id:'z',top:'1%',left:'1%',width:'9%',height:'9%',tap_action:{action:'toggle',entity:'light.a',confirmation:{text:'Sure?'}}}]},st('light.a','on'));
    await tick();const calls=callsOf(el);let nat=0;w.confirm=()=>{nat++;return true;};
    el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    const dlg=el.shadowRoot.querySelector('.roc-confirm');
    t('beta.4: confirmation uses the card\'s own dialog (not window.confirm), nothing runs yet',!!dlg&&nat===0&&calls.length===0&&dlg.textContent.indexOf('Sure?')>=0);
    dlg.querySelector('[data-yes]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
    t('beta.4: …OK runs the action and closes the dialog',calls.length===1&&!el.shadowRoot.querySelector('.roc-confirm'));
    el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();
    t('beta.4: …Escape cancels',calls.length===1&&!el.shadowRoot.querySelector('.roc-confirm'));}
  {const el=mkCard({base_image:IMG,layout:{},zones:[{id:'z',top:'1%',left:'1%',width:'9%',height:'9%',tap_action:{action:'navigate',navigation_path:'/x',navigation_replace:true}}]},{});
    await tick();let rep=null,how='';w.addEventListener('location-changed',e=>{rep=e.detail&&e.detail.replace;},{once:true});
    const hp=w.history.pushState,hr=w.history.replaceState;w.history.pushState=function(){how='push';};w.history.replaceState=function(a,b,u){how='replace:'+u;};
    el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    w.history.pushState=hp;w.history.replaceState=hr;
    t('beta.4: navigate honours navigation_replace',how==='replace:/x'&&rep===true);}
}

await new Promise(r=>setTimeout(r,300));
t('rejected template subscription is caught, not unhandled',unhandled===0);

  // =====================================================================
  // 7.0.1 — the analysis of 7.0.0 (ANALYSIS_v7.0.0.md, tests/probes/probe_v7_0_0.js)
  // =====================================================================
  {
  const tick=()=>new Promise(r=>setTimeout(r,40));
  const IMG='/local/x.webp';
  const st=(id,v,a)=>({[id]:{entity_id:id,state:String(v),attributes:a||{}}});
  const callsOf=(el)=>{const c=[];el._hass.callService=function(d,sv,data,tg){c.push([d,sv,data,tg]);return Promise.resolve();};return c;};
  // (1) the confirmation dialog's key handler must not outlive the dialog
  {const cfg={layout:{},room_entity:'input_select.room',rooms:[
      {id:'a',base_image:IMG,zones:[{id:'z',top:'1%',left:'1%',width:'9%',height:'9%',tap_action:{action:'call-service',service:'cover.open_cover',target:{entity_id:'cover.g'},confirmation:true}}]},
      {id:'b',base_image:IMG}]};
    const S=Object.assign(st('cover.g','closed'),st('input_select.room','a'));
    {const el=mkCard(cfg,S);await tick();const calls=callsOf(el);
      el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
      const h2=mkHass(Object.assign({},S,st('input_select.room','b')));h2.callService=el._hass.callService;el.hass=h2;await tick();await tick();
      t('7.0.1: a re-render (room follow) closes an open confirmation',el._roomIdx===1&&!el.shadowRoot.querySelector('.roc-confirm')&&!el._confirmDone);
      w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();
      t('7.0.1: …and Enter pressed afterwards does not run the action',calls.length===0);el.remove();}
    {const el=mkCard(cfg,S);await tick();const calls=callsOf(el);
      el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
      el.remove();await tick();
      w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await tick();
      t('7.0.1: a confirmation is cancelled when the card leaves the page',calls.length===0&&!el._confirmDone);}
    {const el=mkCard(cfg,S);await tick();const calls=callsOf(el);
      const tap=()=>el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
      tap();
      const inp=w.document.createElement('input');w.document.body.appendChild(inp);
      inp.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await tick();
      t('7.0.1: Enter typed outside the dialog does not confirm it',calls.length===0&&!!el.shadowRoot.querySelector('.roc-confirm'));
      el.shadowRoot.querySelector('.roc-confirm [data-no]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await tick();
      t('7.0.1: Enter on Cancel cancels',calls.length===0&&!el.shadowRoot.querySelector('.roc-confirm'));
      tap();
      el.shadowRoot.querySelector('.roc-confirm [data-yes]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true}));await tick();
      t('7.0.1: Enter on OK confirms',calls.length===1&&!el.shadowRoot.querySelector('.roc-confirm'));
      inp.remove();el.remove();}}
  // (2) native light pills follow brightness / colour while the light stays on
  {const LY={rows:['1fr','auto'],columns:['100%'],place:{image:{row:1},lights:{row:2}}};
    const L=(b,rgb)=>st('light.a','on',{brightness:b,rgb_color:rgb,supported_color_modes:['rgb'],color_mode:'rgb'});
    const el=mkCard({base_image:IMG,layout:{landscape:LY,portrait:LY},light_controls:{entities:['light.a',{entity:'light.b'}],style:'native'}},Object.assign(L(255,[255,0,0]),st('light.b','off')));
    await tick();
    t('7.0.1: light_controls entities are watched for brightness and colour',['brightness','rgb_color','color_temp_kelvin'].every(a=>el._relevantAttrSources.some(x=>x.entity==='light.a'&&x.attr===a))&&el._relevantAttrSources.some(x=>x.entity==='light.b'&&x.attr==='brightness'));
    el.hass=mkHass(Object.assign(L(51,[0,0,255]),st('light.b','off')));await tick();
    const p=(el._lcPills||[])[0];
    t('7.0.1: a light dimmed elsewhere (state stays on) moves its pill',!!p&&p.val.textContent==='20 %'&&p.fill.style.width==='20%'&&p.el.style.getPropertyValue('--lcp-solid')==='rgb(0,0,255)');el.remove();}
  // (3) visibility: one rule for every element
  {const S=Object.assign(st('light.a','on'),st('sensor.t','20'),st('cover.c','open',{current_position:50}),st('vacuum.v','docked'));
    const on={entity:'light.a',state:'on'},off={entity:'light.a',state:'off'};
    const gone=e=>!e||e.style.display==='none'||e.style.visibility==='hidden';
    const all=v=>({base_image:IMG,layout:{},
      zones:[Object.assign({id:'e',top:'1%',left:'1%',width:'5%',height:'5%'},v)],icons:[Object.assign({id:'e',icon:'mdi:x',top:'1%',left:'9%'},v)],
      badges:[Object.assign({id:'e',icon:'mdi:x',label:'L'},v)],labels:[Object.assign({id:'e',entity:'sensor.t',top:'9%',left:'1%'},v)],
      gauges:[Object.assign({id:'e',entity:'sensor.t',top:'9%',left:'9%',width:'3%',height:'9%'},v)],blinds:[Object.assign({id:'b',entity:'cover.c',top:'20%',left:'1%',width:'5%',height:'9%'},v)],
      glows:[Object.assign({id:'e',entity:'light.a',top:'30%',left:'30%',size:'10%'},v)],elements:[Object.assign({id:'e',top:'40%',left:'1%',width:'9%',height:'9%',card:{type:'custom:x-none'}},v)],
      overlays:[Object.assign({id:'e',image:IMG},v)],vacuum_widgets:[Object.assign({id:'e',top:'50%',left:'1%',vacuums:[{entity:'vacuum.v'}]},v)]});
    const els=el=>({zone:el._zoneEls.e,icon:el._icoEls.e,badge:el._bcontEls.e,label:el._lblEls.e,gauge:el._gaugeEls.e,blind:Object.keys(el._gaugeEls).filter(k=>k!=='e').map(k=>el._gaugeEls[k])[0],glow:el._glowEls.e,element:el._contEls.e,overlay:el._ovEls.e,vacuum:el._vwEls.e});
    const which=(el,f)=>Object.entries(els(el)).filter(([k,e])=>!f(e)).map(x=>x[0]).join(',');
    for(const [name,v,hide] of [['visible: [cond] that holds',{visible:[on]},false],['visible: [cond, cond] one fails',{visible:[on,off]},true],['visible: cond that fails',{visible:off},true],
        ['visible_conditions: cond that fails',{visible_conditions:off},true],['visible_conditions: [cond] that holds',{visible_conditions:[on]},false]]){
      const el=mkCard(all(v),S);await tick();
      const bad=which(el,hide?gone:e=>!gone(e));
      t('7.0.1: '+name+' → every element '+(hide?'hidden':'shown')+(bad?'   (not: '+bad+')':''),!bad);el.remove();}
    // visible_template on a label and a vacuum widget
    {const el=w.document.createElement('room-overlay-card');
      const h=mkHass(S);h.connection.subscribeMessage=function(cb){Promise.resolve().then(function(){cb({result:'False'});});return Promise.resolve(function(){});};
      el.setConfig({base_image:IMG,layout:{},labels:[{id:'l',entity:'sensor.t',top:'1%',left:'1%',visible_template:'{{ false }}'}],vacuum_widgets:[{id:'v',top:'9%',left:'1%',vacuums:[{entity:'vacuum.v'}],visible_template:'{{ false }}'}]});
      el.hass=h;w.document.body.appendChild(el);await tick();
      const h2=mkHass(Object.assign({},S,st('sensor.t','21')));h2.connection=h.connection;el.hass=h2;await tick();
      t('7.0.1: visible_template hides a label and a vacuum widget, and a state update does not show them again',gone(el._lblEls.l)&&gone(el._vwEls.v));el.remove();}
    t('7.0.1: a list condition is an AND; a non-condition never hides',w.eval('[evalCond([{entity:"light.a",state:"on"}],{"light.a":{state:"on",attributes:{}}}),evalCond([{entity:"light.a",state:"on"},{entity:"light.a",state:"off"}],{"light.a":{state:"on",attributes:{}}}),rocVisOk({visible:true},{}),rocVisOk({},{})].join()')==='true,false,true,true');}
  // (5) config values in style="…" are escaped: quotes survive, nothing can add markup
  {const el=mkCard({base_image:IMG,layout:{},
      labels:[{id:'l',entity:'sensor.t',top:'10%',left:'10%',font_family:'"Roboto Mono", monospace',background:'url("/local/chip.png")'}],
      zones:[{id:'z',top:'1%',left:'1%',width:'5%',height:'"><img src=x data-inj=1><i x="',tap_action:{action:'none'}}],
      icons:[{id:'i',icon:'mdi:x',top:'20%',left:'"><img src=x data-inj=2><i x="',size:'"><img src=x data-inj=3><i x="'}],
      gauges:[{id:'g',entity:'sensor.t',orientation:'radial',thickness:'"><img src=x data-inj=4><i x="',top:'30%',left:'30%',width:'10%',height:'10%'}]},st('sensor.t','21'));
    await tick();
    const l=el._lblEls.l;
    t('7.0.1: a CSS value with double quotes is applied whole (font_family, url("…"))',!!l&&/Roboto Mono/.test(l.style.fontFamily)&&/chip\.png/.test(l.style.background)&&l.style.fontWeight==='bold'&&l.attributes.length===3);
    t('7.0.1: a config string cannot add markup to the card',!el.shadowRoot.querySelector('[data-inj]'));el.remove();}
  // V2: number formatters are built once per (locale, decimals)
  {const r=w.eval('(function(){const N=Intl.NumberFormat;let n=0;Intl.NumberFormat=function(a,b){n++;return new N(a,b);};try{const h={locale:{language:"pl",number_format:"language"}};return[rocFmtNum(h,1.5,3),rocFmtNum(h,2.25,3),rocFmtNum(h,2,4),rocFmtNum(h,3,4),rocFmtNum(h,9.5,3)].join("|")+"#"+n;}finally{Intl.NumberFormat=N;}})()');
    t('7.0.1: rocFmtNum reuses one Intl.NumberFormat per locale + decimals ('+r+')',r==='1,500|2,250|2,0000|3,0000|9,500#2');}
  }

  // =====================================================================
  // 7.0.2 — the rest of the 7.0.0 review (points 6, 7 and 9 of ANALYSIS_v7.0.0.md)
  // =====================================================================
  {
  const tick=()=>new Promise(r=>setTimeout(r,40));
  const IMG='/local/x.webp';
  const st=(id,v,a)=>({[id]:{entity_id:id,state:String(v),attributes:a||{}}});
  // forms the reference documents
  t('7.0.2: area_match as one string matches (it was read only as a list)',w.eval('[roomMatch({rooms:[{id:"a"},{id:"b",area_match:"Kitchen"}]},"kitchen"),roomMatch({rooms:[{id:"a"},{id:"b",area_match:["x","Kitchen"]}]},"kitchen"),roomMatch({rooms:[{id:"a"},{id:"b"}]},"kitchen")].join()')==='1,1,-1');
  t('7.0.2: a condition written with an unquoted on / off (a boolean in a YAML-mode dashboard) matches the state',w.eval('(function(){const s={"light.a":{state:"on",attributes:{}},"light.b":{state:"off",attributes:{}}};return[evalCond({entity:"light.a",state:true},s),evalCond({entity:"light.b",state:false},s),evalCond({entity:"light.a",state:false},s),evalCond({entity:"light.a",state_not:true},s),evalCond({entity:"light.b",state:[true,"idle"]},s)].join();})()')==='true,true,false,false,false');
  t('7.0.2: …and a boolean still matches a boolean attribute and the state "true" (it always did)',w.eval('(function(){const s={"media_player.m":{state:"playing",attributes:{is_volume_muted:true}},"sensor.s":{state:"true",attributes:{}}};return[evalCond({entity:"media_player.m",attribute:"is_volume_muted",state:true},s),evalCond({entity:"media_player.m",attribute:"is_volume_muted",state:false},s),evalCond({entity:"sensor.s",state:true},s),evalCond({entity:"sensor.s",state_not:true},s)].join();})()')==='true,false,true,false');
  {const el=mkCard({base_image:IMG,layout:{},
      overlays:[{id:'o',state_images:[{entity:'sensor.n',state:3,image:'/local/three.webp'},{image:'/local/default.webp'}]},{id:'o2',state_images:[{entity:'light.a',state:true,image:'/local/on.webp'},{image:'/local/off.webp'}]}],
      labels:[{id:'l',text:'Static',prefix:'[',suffix:']',top:'20%',left:'10%'}],
      gauges:[{id:'g',entity:'sensor.n',orientation:'radial',thickness:'12px',target:2,top:'30%',left:'30%',width:'10%',height:'10%'},{id:'g2',entity:'sensor.n',orientation:'radial',target:'sensor.nope',top:'50%',left:'30%',width:'10%',height:'10%'}],
      zones:[{id:'z',top:'1%',left:'1%',width:'5%',height:'5%',z_index:77}],
      elements:[{id:'e',top:'50%',left:'1%',width:'9%',height:'9%',background:'rgb(1, 2, 3)',card:{type:'custom:x-none'}}]},Object.assign(st('sensor.n','3'),st('light.a','on')));
    await tick();
    t('7.0.2: state_images match a number and an unquoted on (compared as text)',/three\.webp/.test(el._ovEls.o.style.backgroundImage)&&/on\.webp/.test(el._ovEls.o2.style.backgroundImage));
    t('7.0.2: a label with text: shows it (with prefix / suffix)',el._lblEls.l.textContent==='[Static]');
    t('7.0.2: a radial gauge draws without NaN for thickness: "12px" and for a target that is not a number',!/NaN/.test(el._gaugeEls.g.innerHTML)&&!/NaN/.test(el._gaugeEls.g2.innerHTML)&&/stroke-width="12"/.test(el._gaugeEls.g.innerHTML));
    t('7.0.2: a zone takes z_index; an embedded card takes background',el._zoneEls.z.style.zIndex==='77'&&/rgb\(1, 2, 3\)/.test(el._contEls.e.style.background));el.remove();}
  // stale values
  {const LY={rows:['auto','1fr'],columns:['100%'],place:{nav:{row:1},image:{row:2}}};
    const el=mkCard({layout:{landscape:LY,portrait:LY},rooms:[{id:'a',name:'A',base_image:IMG,chips:[{entity:'sensor.t'}]},{id:'b',name:'B',base_image:IMG}]},st('sensor.t','21'));
    await tick();const had=el._navChipEls.some(c=>c.el.textContent==='21');
    el.hass=mkHass({});await tick();
    t('7.0.2: a nav chip whose entity is gone shows — , not its last value',had&&el._navChipEls.every(c=>c.el.textContent==='—'));el.remove();}
  {const C=p=>st('cover.x','open',{current_position:p,supported_features:15});
    const el=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',attribute:'current_position',min:100,max:0,top:'10%',left:'10%',width:'10%',height:'30%',control:true}]},C(40));
    await tick();const rec=Object.values(el._ccEls||{})[0];const before=rec&&rec.pct&&rec.pct.textContent;
    el.hass=mkHass({});await tick();
    t('7.0.2: a cover control whose entity is gone drops the position ('+before+' → '+(rec&&rec.pct&&rec.pct.textContent)+')',before==='40 %'&&rec.pct.textContent==='—');el.remove();}
  // errors that used to escape
  {const old=w.location.hash;w.location.hash='#%E0%A4%A=1&room=b';
    const el=mkCard({layout:{},url_sync:true,rooms:[{id:'a',base_image:IMG},{id:'b',base_image:IMG}]},{});await tick();
    t('7.0.2: a malformed %-escape in the URL hash neither breaks the card nor hides the room key',!/configuration error/.test(el.shadowRoot.innerHTML)&&el._roomIdx===1);
    el.remove();w.location.hash=old||'';}
  {const u0=unhandled;
    const el=mkCard({base_image:IMG,layout:{},icons:[{id:'i',icon:'mdi:x',entity:'lock.a',top:'9%',left:'9%',tap_action:{action:'toggle'}}]},st('lock.a','locked'));
    await tick();el._hass.callService=()=>Promise.reject(new Error('Service not found'));
    el.shadowRoot.querySelector('[data-ico="i"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();await tick();
    t('7.0.2: a rejected toggle is caught, not an unhandled rejection',unhandled===u0);el.remove();}
  }

  // 7.0.4 — a navigation runs the card's location handler once
  {
  const tick=()=>new Promise(r=>setTimeout(r,40));
  const el=mkCard({base_image:'/local/x.webp',layout:{},zones:[{id:'z',top:'1%',left:'1%',width:'9%',height:'9%',tap_action:{action:'navigate',navigation_path:'/lovelace/x'}}]},{});
  await tick();
  let pins=0;const rp=el._requestPin.bind(el);el._requestPin=function(r){if(r==='location-changed')pins++;return rp(r);};
  let pops=0;const onPop=()=>{pops++;};w.addEventListener('popstate',onPop);
  const hp=w.history.pushState;w.history.pushState=function(){}; // this window is about:blank, where a real pushState throws
  el.shadowRoot.querySelector('[data-z="z"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
  w.history.pushState=hp;w.removeEventListener('popstate',onPop);
  t('7.0.4: a navigate action runs the location handler once (location-changed + popstate are one navigation), popstate still fires for others',pins===1&&pops===1);
  w.dispatchEvent(new w.Event('location-changed'));await tick();
  t('7.0.4: …and the next navigation runs it again',pins===2);
  el.remove();
  }

  // 7.0.5 — a room switch does its state pass once, reuses its pictures and keeps its scroller
  {
  const tick=()=>new Promise(r=>setTimeout(r,40));
  const st=(id,v,a)=>({[id]:{entity_id:id,state:String(v),attributes:a||{}}});
  const el=mkCard({layout:{},rooms:[{id:'a',base_image:'/local/a.webp',overlays:[{id:'o',image:'/local/ao.webp'}]},{id:'b',base_image:'/local/b.webp'},{id:'c',base_image:'/local/c.webp'}]},{});
  await tick();
  let ups=0;const up=el._update.bind(el);el._update=function(){ups++;return up();};
  const imgs0={};(el._preloadImgs||[]).forEach(function(im){imgs0[im._rocUrl]=im;});
  const sc=w.document.body;el._scrollEl=sc;
  el._switchRoom(1,1,true);await tick();
  t('7.0.5: a room switch runs one state pass (the visibility observer re-observing the card no longer adds a second)',ups===1);
  const same=(el._preloadImgs||[]).filter(function(im){return imgs0[im._rocUrl]===im;}).length;
  t('7.0.5: …reuses the pictures the last render already preloaded ('+same+' of '+(el._preloadImgs||[]).length+')',same>=3&&same===(el._preloadImgs||[]).length);
  t('7.0.5: …and keeps the scroll container it found (no style read up the dashboard)',el._scrollEl===sc);
  ups=0;el._io.cb([{target:el,isIntersecting:false}],el._io);el._io.cb([{target:el,isIntersecting:true}],el._io);
  t('7.0.5: scrolled back into view, the card still catches up with one state pass',ups===1);
  el.remove();
  }
  {
  const tick=()=>new Promise(r=>setTimeout(r,40));
  const st=(id,v,a)=>({[id]:{entity_id:id,state:String(v),attributes:a||{}}});
  const S=Object.assign({},st('cover.c','open',{current_position:40}),st('sensor.t','21'));
  const blind=function(x){return Object.assign({id:'bl',entity:'cover.c',top:'10%',left:'10%',width:'10%',height:'30%'},x||{});};
  // a blind in a group hides with the group, and its actions run (without a float control)
  let el=mkCard({base_image:'/local/x.webp',layout:{},groups:[{id:'g',visible:false}],blinds:[blind({group:'g'})]},S);await tick();
  const g0=el._gaugeEls.__bl_bl;
  t('7.0.5: a blind in a hidden group is hidden with it (the group was dropped on the way to the drawing)',!!g0&&g0.style.visibility==='hidden');
  el.remove();
  const calls=[];
  el=mkCard({base_image:'/local/x.webp',layout:{},blinds:[blind({tap_action:{action:'toggle'}})]},S);await tick();
  el._hass.callService=function(d,sv,data){calls.push(d+'.'+sv+':'+JSON.stringify(data));return Promise.resolve();};
  el._gaugeEls.__bl_bl.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
  t('7.0.5: a blind\'s tap_action runs',calls.length===1&&/cover\.c/.test(calls[0]));
  el.remove();calls.length=0;
  el=mkCard({base_image:'/local/x.webp',layout:{},blinds:[blind({control:true,tap_action:{action:'toggle'}})]},S);await tick();
  el._hass.callService=function(d,sv,data){calls.push(d+'.'+sv);return Promise.resolve();};
  el._gaugeEls.__bl_bl.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
  const pop=el.shadowRoot.querySelector('[data-cc-root],.roc-cc,[data-cc]');
  t('7.0.5: …but with a float cover control the tap still reveals the controller and runs nothing else',calls.length===0&&!!el._ccEls&&!!el._ccEls.bl);
  el.remove();
  // a badge with label and label_template: the template wins once it answers
  let cb=null;
  el=w.document.createElement('room-overlay-card');
  el.setConfig({base_image:'/local/x.webp',layout:{},badges:[{id:'b',position:'top-left',icon:'mdi:x',label:'wait',label_template:'{{ 1 }}'}]});
  el.hass=Object.assign(mkHass(S),{connection:{subscribeMessage(f){cb=f;return Promise.resolve(function(){});}}});
  w.document.body.appendChild(el);await tick();
  const bl=function(){return el.shadowRoot.querySelector('[data-bl="b"]').textContent;};
  const before=bl();cb({result:'21 °C'});
  el._update();await tick(); // any state pass (the badge watches no entity of its own here)
  t('7.0.5: a badge label is the placeholder until its label_template answers, then the template stays ('+before+' → '+bl()+')',before==='wait'&&bl()==='21 °C');
  el.remove();
  // icon animation (it was in the schema and the studio, never drawn); a gauge with animation: none does not pulse
  el=mkCard({base_image:'/local/x.webp',layout:{},icons:[{id:'i1',icon:'mdi:x',top:'1%',left:'1%',animation:'blink'},{id:'i2',icon:'mdi:x',top:'1%',left:'9%',animation:'pulse',animation_color:'#f00'}],
    gauges:[{id:'g',entity:'sensor.t',top:'1%',left:'20%',width:'5%',height:'20%',animation:'none'}]},S);await tick();
  const i1=el.shadowRoot.querySelector('[data-ico="i1"]').getAttribute('style'),i2=el.shadowRoot.querySelector('[data-ico="i2"]').getAttribute('style');
  t('7.0.5: an icon blinks / pulses in its animation_color like a label',/roc-blink/.test(i1)&&/roc-glow/.test(i2)&&/--roc-ac:\s*#f00/.test(i2));
  t('7.0.5: a gauge with animation: none does not pulse',!el._gaugeEls.g.style.animation);
  el.remove();
  }

console.log(fails?('FAILURES: '+fails):'ALL LIFECYCLE TESTS PASSED');
process.exit(fails?1:0);

})();
