#!/usr/bin/env node
/**
 * Smoke tests for room-overlay-card pure functions.
 * Runs the card source in a sandboxed VM with stubbed browser globals,
 * then exercises the exported-by-declaration helper functions.
 *
 * Usage: node tests/smoke.test.js [path-to-card.js]
 */
'use strict';
const vm=require('vm');
const fs=require('fs');
const path=require('path');

const file=process.argv[2]||path.join(__dirname,'..','room-overlay-card.js');
const code=fs.readFileSync(file,'utf8');

const sandbox={
  console:console,
  document:{createElement:()=>({style:{},appendChild(){},setAttribute(){}})},
  customElements:{define(){},get(){const f=function(){};return f;},whenDefined(){return Promise.resolve();}},
  HTMLElement:class{},
  CustomEvent:class{constructor(t,o){this.type=t;Object.assign(this,o);}},
  Image:class{},
  Promise:Promise,
  setTimeout,clearTimeout,setInterval,clearInterval,
};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(code,sandbox);
const g=sandbox;

let fails=0;
function t(name,cond){
  if(cond)console.log('PASS',name);
  else{fails++;console.log('FAIL',name);}
}

// ---- evalCond -------------------------------------------------------------
const states={'sensor.t':{state:'21.5',attributes:{hum:55}},'light.a':{state:'on',attributes:{}}};
t('evalCond state',g.evalCond({entity:'light.a',state:'on'},states)===true);
t('evalCond op >',g.evalCond({entity:'sensor.t',operator:'>',value:20},states)===true);
t('evalCond attr',g.evalCond({entity:'sensor.t',attribute:'hum',operator:'>=',value:55},states)===true);
t('evalCond and',g.evalCond({entity:'light.a',state:'on',and:{entity:'sensor.t',operator:'<',value:20}},states)===false);
t('evalCond or-fallback',g.evalCond({entity:'light.a',state:'off',or:{entity:'sensor.t',operator:'>',value:20}},states)===true);
t('evalCond missing entity',g.evalCond({entity:'x.y',state:'on'},states)===false);

// ---- gradients ------------------------------------------------------------
const grad=[{value:0,color:'#000000'},{value:100,color:'#ffffff'}];
t('lerp mid',g.lerpColorGradient(grad,50)==='rgb(128,128,128)');
t('lerp clamp low',g.lerpColorGradient(grad,-5)==='#000000');
t('lerp presorted',g.lerpColorGradient(grad,100,true)==='#ffffff');

// ---- CSS filter parse/build ------------------------------------------------
const pf=g.parseFilterStr('brightness(0.5) sepia(0.3)');
t('parseFilterStr',Math.abs(pf.brightness-0.5)<1e-9&&Math.abs(pf.sepia-0.3)<1e-9);
t('buildFilterStr none',g.buildFilterStr({brightness:1,sepia:0})==='none');

// ---- YAML subset ------------------------------------------------------------
const y1=g._yParse('action: navigate\nnavigation_path: /lovelace/2');
t('yaml simple map',y1&&y1.action==='navigate'&&y1.navigation_path==='/lovelace/2');
const y2=g._yParse('opacity:\n  - condition:\n      entity: light.a\n      state: "on"\n    value: 0.9\n  - value: 0');
t('yaml nested list',y2&&Array.isArray(y2.opacity)&&y2.opacity[0].condition.entity==='light.a'&&y2.opacity[0].condition.state==='on'&&y2.opacity[0].value===0.9&&y2.opacity[1].value===0);
const y3=g._yParse('entity: light.bed\ndirection: vertical\nlive: true\nmin: 0\nmax: 100');
t('yaml slider cfg',y3&&y3.live===true&&y3.max===100);
const y4=g._yParse('- condition:\n    entity: sun.sun\n    state: below_horizon\n  image: /local/night.png\n- image: /local/day.png');
t('yaml top list',Array.isArray(y4)&&y4[0].condition.entity==='sun.sun'&&y4[1].image==='/local/day.png');
const obj={action:'call-service',service:'light.turn_on',target:{entity_id:'light.a'},data:{brightness_pct:60},list:[{a:1},{b:'x y'}]};
t('yaml roundtrip',JSON.stringify(g._yParse(g._yDump(obj,0)))===JSON.stringify(obj));
const y5=g._yParse('{action: toggle, entity: light.a}');
t('yaml flow map',y5&&y5.action==='toggle'&&y5.entity==='light.a');

// ---- sizing / misc -----------------------------------------------------------
t('resolveSize pct',g.resolveSize('10%',300)==='30px');
t('resolveSize px',g.resolveSize('14px',300)==='14px');
const bg=g.blindToGaugeConfig({id:'b1',entity:'cover.x',blind_type:'roller'});
t('blind roller',bg.length===1&&bg[0].id==='__bl_b1'&&bg[0].orientation==='top');
const bgVt=g.blindToGaugeConfig({id:'b2',entity:'cover.x',blind_type:'roller',visible_template:'{{ 1 }}'});
t('blind passes visible_template',bgVt[0].visible_template==='{{ 1 }}');
t('escA',g.escA('a"b<c>')==='a&quot;b&lt;c&gt;');

// ---- v1.4: tmplTruthy ----------------------------------------------------------
t('tmplTruthy true',g.tmplTruthy(true)===true);
t('tmplTruthy "on"',g.tmplTruthy('on')===true);
t('tmplTruthy number',g.tmplTruthy(22.5)===true);
t('tmplTruthy false',g.tmplTruthy(false)===false);
t('tmplTruthy "off"',g.tmplTruthy('off')===false);
t('tmplTruthy "0"',g.tmplTruthy('0')===false);
t('tmplTruthy unavailable',g.tmplTruthy('unavailable')===false);
t('tmplTruthy empty',g.tmplTruthy('')===false);
t('tmplTruthy null',g.tmplTruthy(null)===false);

// ---- v1.4: relTime ---------------------------------------------------------------
const fiveMinAgo=new Date(Date.now()-5*60*1000).toISOString();
const rt=g.relTime(fiveMinAgo,'en');
t('relTime 5 min ago',typeof rt==='string'&&/5/.test(rt)&&/min/i.test(rt));
const twoHrs=new Date(Date.now()-2*3600*1000).toISOString();
t('relTime hours',/2/.test(g.relTime(twoHrs,'en')));
t('relTime invalid input',g.relTime('not-a-date','en')==='not-a-date');

console.log(fails?('FAILURES: '+fails):'ALL TESTS PASSED ('+(fails===0)+')');
process.exit(fails?1:0);
