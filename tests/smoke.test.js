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

// ---- v1.5: mobile profiles, tint, kelvin ------------------------------------
const mi={top:'10%',left:'20%',size:'20px',mobile:{top:'50%',size:'30px'}};
const ma=g.mApply(mi,true);
t('mApply active',ma.top==='50%'&&ma.size==='30px'&&ma.left==='20%');
t('mApply inactive',g.mApply(mi,false).top==='10%');
t('mApply no mobile key',g.mApply({top:'1%'},true).top==='1%');

// ---- v1.13: responsive tiers ------------------------------------------------
t('rocTier mobile',g.rocTier(500,{})==='mobile');
t('rocTier tablet',g.rocTier(800,{})==='tablet');
t('rocTier desktop',g.rocTier(1200,{})==='desktop');
t('rocTier ultrawide',g.rocTier(1800,{})==='ultrawide');
t('rocTier boundary 600=tablet',g.rocTier(600,{})==='tablet');
t('rocTier zero width → desktop',g.rocTier(0,{})==='desktop');
t('rocTier legacy mobile_breakpoint',g.rocTier(550,{mobile_breakpoint:600})==='mobile'&&g.rocTier(650,{mobile_breakpoint:600})==='tablet');
t('rocTier custom breakpoints',g.rocTier(900,{breakpoints:{mobile:500,tablet:800,desktop:1200}})==='desktop');
const _ti={top:'10%',size:'20px',tablet:{top:'8%'},ultrawide:{top:'12%',size:'30px'}};
t('tApply tablet merges over base',g.tApply(_ti,'tablet').top==='8%'&&g.tApply(_ti,'tablet').size==='20px');
t('tApply ultrawide merges',g.tApply(_ti,'ultrawide').top==='12%'&&g.tApply(_ti,'ultrawide').size==='30px');
t('tApply desktop (no block) = base',g.tApply(_ti,'desktop').top==='10%');
t('tApply null = base',g.tApply(_ti,null).top==='10%');
t('tApply legacy mobile block',g.tApply({top:'1%',mobile:{top:'9%'}},'mobile').top==='9%');
t('tVal scalar passthrough',g.tVal('16/9','mobile')==='16/9');
t('tVal per-tier exact',g.tVal({mobile:'4/3',desktop:'16/9'},'mobile')==='4/3');
t('tVal fallback smaller-first',g.tVal({mobile:'4/3',ultrawide:'21/9'},'tablet')==='4/3');
t('tVal fallback larger when no smaller',g.tVal({ultrawide:'21/9'},'tablet')==='21/9');
t('tVal empty → undefined',g.tVal({},'mobile')===undefined);
t('tVal null tier → desktop',g.tVal({desktop:'16/9',mobile:'4/3'},null)==='16/9');
const warm=g.kelvinToRgb(2700),cold=g.kelvinToRgb(6500);
t('kelvin warm is reddish',warm[0]===255&&warm[2]<warm[0]);
t('kelvin cold has blue',cold[2]>200);
const tf=g.tintFilter([255,0,0]);
t('tintFilter format',/sepia\(1\) saturate\([\d.]+\) hue-rotate\(-?\d+deg\) brightness\([\d.]+\)/.test(tf));
const tfB=g.tintFilter([0,0,255]);
t('tintFilter blue rotates further',tfB.includes('hue-rotate(202deg)'));

// ---- v1.6: multiroom helpers -------------------------------------------------
const mc={aspect_ratio:'16/9',haptic:false,rooms:[{id:'livingroom',name:'Obývák',base_image:'/local/a.webp',zones:[{id:'z1'}]},{id:'bedroom',name:'Bedroom',base_image:'/local/b.webp',area_match:['Ložnice','Bed Room']}]};
const m0=g.roomMerge(mc,0),m1=g.roomMerge(mc,1);
t('roomMerge room 0 inherits shared keys',m0.base_image==='/local/a.webp'&&m0.aspect_ratio==='16/9'&&m0.haptic===false&&m0.zones.length===1);
t('roomMerge room 1 does not leak room 0',m1.base_image==='/local/b.webp'&&m1.zones===undefined);
t('roomMerge passthrough without rooms',g.roomMerge({base_image:'/x.png'},0).base_image==='/x.png');
t('roomMerge clamps index',g.roomMerge(mc,99).base_image==='/local/b.webp');
t('roomMatch by id',g.roomMatch(mc,'bedroom')===1);
t('roomMatch by name',g.roomMatch(mc,'Obývák')===0);
t('roomMatch by area alias (ci)',g.roomMatch(mc,'ložnice')===1);
t('roomMatch miss',g.roomMatch(mc,'garage')===-1);
t('roomMatch empty/null',g.roomMatch(mc,'')===-1&&g.roomMatch(mc,null)===-1);
t('cfgKey from rooms[0]',g.cfgKey(mc)==='img:/local/a.webp|');
t('cfgKey card_id wins',g.cfgKey({card_id:'flat1',base_image:'/x'})==='id:flat1');
t('cfgKey single-room',g.cfgKey({base_image:'/x.png'})==='img:/x.png|');
t('shared defaults: top-level zones inherited by rooms',g.roomMerge({zones:[{id:'s'}],rooms:[{id:'a',base_image:'/a'}]},0).zones[0].id==='s');

// ---- v2.1: coverStage (lock_aspect) ----------------------------------------
// Box wider than design → scaled by width, overflows vertically (top/bottom crop)
const cs1=g.coverStage(1000,400,1); // da=1 (square design) in a 1000x400 box
t('coverStage wide box: width fills',cs1.w===1000&&cs1.h===1000);
t('coverStage wide box: centered vertically',cs1.left===0&&cs1.top===-300);
// Box taller than design → scaled by height, overflows horizontally
const cs2=g.coverStage(400,1000,1);
t('coverStage tall box: height fills',cs2.h===1000&&cs2.w===1000);
t('coverStage tall box: centered horizontally',cs2.top===0&&cs2.left===-300);
// Exact match → no crop, no offset
const cs3=g.coverStage(1600,900,1600/900);
t('coverStage exact: no offset',Math.abs(cs3.left)<1e-6&&Math.abs(cs3.top)<1e-6&&Math.round(cs3.w)===1600&&Math.round(cs3.h)===900);
t('coverStage guards bad input',g.coverStage(0,100,1)===null&&g.coverStage(100,100,0)===null&&g.coverStage(100,100,-1)===null);

console.log(fails?('FAILURES: '+fails):'ALL TESTS PASSED ('+(fails===0)+')');
process.exit(fails?1:0);
