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

// no-IntersectionObserver environments must never suppress updates
t('_visible guard only applies while an IO exists',/!this\._visible&&this\._io/.test(code));

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

await new Promise(r=>setTimeout(r,300));
t('rejected template subscription is caught, not unhandled',unhandled===0);

console.log(fails?('FAILURES: '+fails):'ALL LIFECYCLE TESTS PASSED');
process.exit(fails?1:0);

})();
