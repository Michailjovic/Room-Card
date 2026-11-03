#!/usr/bin/env node
/**
 * Reproduction probe for ANALYSIS_v7.0.0-beta.3.md (2026-11-03). Not wired into `npm test`.
 * Every check prints PASS when the card behaves as it should; on 7.0.0-beta.3 the listed
 * findings FAIL. Usage: node tests/probes/probe_v7_0_0b3.js [path-to-card.js]
 */
'use strict';
const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path');
const code=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','..','room-overlay-card.js'),'utf8');
function make(){
  const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
  const w=dom.window;w.innerWidth=1920;w.innerHeight=1080;w.requestIdleCallback=f=>setTimeout(f,0);
  w.IntersectionObserver=class{constructor(cb){this.cb=cb;}observe(t){Promise.resolve().then(()=>this.cb([{target:t,isIntersecting:true}],this));}unobserve(){}disconnect(){}};
  w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.console.info=()=>{};w.console.warn=()=>{};
  w.eval(code);
  const mkHass=s=>({states:s||{},calls:[],callService(d,sv,data,t){this.calls.push([d,sv,data,t]);},user:{is_admin:true},locale:{language:'en'},language:'en',
    connection:{subscribeMessage(){return Promise.resolve(()=>{});}}});
  const mkCard=(cfg,s)=>{const c=w.document.createElement('room-overlay-card');w.document.body.appendChild(c);let err=null;try{c.setConfig(cfg);c.hass=mkHass(s);}catch(e){err=e;}return{c,err};};
  return{w,mkCard};
}
const tick=()=>new Promise(r=>setTimeout(r,40));
const IMG='/local/x.webp';
const st=(id,s,a)=>({[id]:{entity_id:id,state:String(s),attributes:a||{}}});
let fails=0;const t=(n,ok)=>{console.log((ok?'PASS ':'FAIL ')+n);if(!ok)fails++;};
(async()=>{
  // #3 actions without an explicit entity use the element's entity (HA convention, doc example)
  {const {mkCard,w}=make();
    const r=mkCard({base_image:IMG,layout:{},icons:[{id:'i',entity:'light.a',icon:'mdi:x',top:'10%',left:'10%',tap_action:{action:'toggle'}}]},st('light.a','on'));
    await tick();r.c.shadowRoot.querySelector('[data-ico="i"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
    t('#3 icon {action: toggle} without entity toggles the icon\'s entity',r.c._hass.calls.length===1);}
  {const {mkCard,w}=make();let got=null;
    const r=mkCard({base_image:IMG,layout:{},sections:[{id:'s',name:'S',tiles:[{entity:'switch.wm',name:'WM',tap_action:{action:'more-info'}}]}],
      icons:[{id:'i',icon:'mdi:x',top:'10%',left:'10%',tap_action:{action:'open-section',section:'s'}}]},st('switch.wm','on'));
    await tick();r.c.addEventListener('hass-more-info',e=>got=e.detail);
    r.c.shadowRoot.querySelector('[data-ico="i"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
    const tile=r.c.shadowRoot.querySelector('.roc-tile');if(tile)tile.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await tick();
    t('#3 section tile {action: more-info} (CONFIGURATION.md example) opens the tile entity',!!(got&&got.entityId==='switch.wm'));}
  // #4 HA-style numeric conditions
  {const {w}=make();
    const r=w.eval('[evalCond({entity:"sensor.t",above:25},{"sensor.t":{state:"20",attributes:{}}}),evalCond({entity:"sensor.t",below:10},{"sensor.t":{state:"20",attributes:{}}})]');
    t('#4 {above: 25} at 20 is false (not silently true)',r[0]===false);
    t('#4 {below: 10} at 20 is false (not silently true)',r[1]===false);}
  // #5 a scalar/object where a list is expected must not kill the whole card
  {const {mkCard}=make();
    const r=mkCard({base_image:IMG,layout:{},brightness_model:{source:{entity:'sensor.lux'},filter_gradient:[{value:0,filter:'brightness(.3)'},{value:100,filter:'none'}]}},st('sensor.lux',50));
    t('#5 brightness_model.source as one object renders (or shows an error card)',!r.err);}
  {const {mkCard}=make();
    const r=mkCard({base_image:IMG,layout:{},gauges:{id:'g',entity:'sensor.x'}},st('sensor.x',5));
    t('#5 gauges: as an object renders (or shows an error card)',!r.err);}
  // #6 blind without attribute: docs say "omit to use entity state (open/closed)"
  {const {mkCard}=make();
    const r=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'30%'}]},st('cover.x','closed',{current_position:0}));
    await tick();await tick();const f=Object.values(r.c._gaugeFills||{})[0];
    t('#6 blind on a closed cover without attribute: shows closed (fill 100 %)',!!f&&f.style.height==='100%');}
  // #7 cover control follows current_position while the state stays "open"
  {const {mkCard}=make();
    const s=p=>st('cover.x','open',{current_position:p,supported_features:15});
    const r=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',attribute:'current_position',top:'10%',left:'10%',width:'10%',height:'30%',control:true}]},s(40));
    await tick();await tick();const h=r.c._hass;r.c.hass=Object.assign({},h,{states:s(75)});await tick();await tick();
    const rec=r.c._ccEls&&r.c._ccEls.b;
    t('#7 cover control shows 75 % after position 40→75 with state unchanged',!!rec&&rec.pct&&rec.pct.textContent==='75 %');}
  {const {mkCard}=make();
    const s=p=>st('cover.x','open',{current_position:p,supported_features:15});
    const r=mkCard({base_image:IMG,layout:{},blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'30%',control:true}]},s(40));
    await tick();await tick();const h=r.c._hass;r.c.hass=Object.assign({},h,{states:s(75)});await tick();await tick();
    const rec=r.c._ccEls&&r.c._ccEls.b;
    t('#7 same, blind without attribute: (control reads current_position anyway)',!!rec&&rec.pct&&rec.pct.textContent==='75 %');}
  // #8 a card made only of a floor plan page / overview page
  {const {mkCard}=make();
    const r=mkCard({layout:{},rooms:[{id:'plan',floorplan:{rooms:[{name:'A',polygon:[[0,0],[4,0],[4,3],[0,3]]}]}}]},{});
    t('#8 card with only a floor plan page is accepted',!r.err);}
  // #9 stale value when the entity disappears
  {const {mkCard}=make();
    const r=mkCard({base_image:IMG,layout:{},labels:[{id:'l',entity:'sensor.t',suffix:'°',top:'10%',left:'10%'}]},st('sensor.t','21.5'));
    await tick();const el=r.c._lblEls.l;const h=r.c._hass;r.c.hass=Object.assign({},h,{states:{}});await tick();
    t('#9 label of a removed entity stops showing the last value',el.textContent!=='22°');}
  // #2 safety: default taps never toggle a siren or a garage door
  {const {w}=make();const tap=w.eval('rocOvChipDefaultTap("siren.alarm")');
    t('#2 overview chip with a siren: default tap is more-info, not toggle',tap.action==='more-info');}
  console.log(fails?('\n'+fails+' FAIL'):'\nALL PASS');
})();
