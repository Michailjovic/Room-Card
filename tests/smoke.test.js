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

// ---- v1.5: legacy mobile block (v4: read via the portrait profile) -----------
const mi={top:'10%',left:'20%',size:'20px',mobile:{top:'50%',size:'30px'}};
const ma=g.tApply(mi,'portrait');
t('tApply legacy mobile via portrait',ma.top==='50%'&&ma.size==='30px'&&ma.left==='20%');
t('tApply null profile inactive',g.tApply(mi,null).top==='10%');
t('tApply no override key',g.tApply({top:'1%'},'portrait').top==='1%');

// ---- v3.0.7: rocRatio, escSel, Jinja YAML guard ------------------------------
t('rocRatio W/H string',Math.abs(g.rocRatio('16/9')-16/9)<1e-9);
t('rocRatio number',g.rocRatio(1.78)===1.78);
t('rocRatio numeric string',g.rocRatio('1.5')===1.5);
t('rocRatio invalid',g.rocRatio('abc')===null&&g.rocRatio('0/9')===null&&g.rocRatio(null)===null&&g.rocRatio('')===null);
t('rocRatio negative',g.rocRatio(-2)===null);
t('escSel plain id untouched',g.escSel('plain_id-1')==='plain_id-1');
t('escSel escapes double quote',/\\/.test(g.escSel('a"b')));
t('yaml Jinja scalar kept as string',g._yParseScalar("{{ states('sensor.x') == 'on' }}")==="{{ states('sensor.x') == 'on' }}");
t('yaml Jinja statement kept as string',g._yParseScalar('{% if x %}1{% endif %}')==='{% if x %}1{% endif %}');
t('yaml inline map still parses',JSON.stringify(g._yParseScalar('{a: 1}'))==='{"a":1}');
t('yaml Jinja roundtrip via parse',(function(){const o=g._yParse('visible_template: {{ is_state(\'light.a\',\'on\') }}');return o&&o.visible_template==="{{ is_state('light.a','on') }}";})());

// ---- v3.1.0: bmFilter (brightness model → CSS filter) ------------------------
const bmStates={'sensor.lux':{state:'50',attributes:{}},'sun.sun':{state:'below_horizon',attributes:{}}};
const bm={source:[{entity:'sensor.lux',min_input:0,max_input:100}],filter_gradient:[{value:0,filter:'brightness(0.4)'},{value:100,filter:'brightness(1)'}]};
t('bmFilter null when model absent',g.bmFilter(null,bmStates)===null&&g.bmFilter({source:[]},bmStates)===null);
t('bmFilter interpolates midpoint',g.bmFilter(bm,bmStates)==='brightness(0.7)');
t('bmFilter none when no source matches',g.bmFilter({source:[{entity:'sensor.missing'}],filter_gradient:bm.filter_gradient},bmStates)==='none');
t('bmFilter respects source condition',g.bmFilter({source:[{entity:'sensor.lux',condition:{entity:'sun.sun',state:'above_horizon'}}],filter_gradient:bm.filter_gradient},bmStates)==='none');
t('bmFilter clamps below min',g.bmFilter({source:[{entity:'sensor.lux',min_input:60,max_input:160}],filter_gradient:bm.filter_gradient},bmStates)==='brightness(0.4)');

// ---- v4.0: layout profiles ---------------------------------------------------
t('rocProfile portrait by ratio',g.rocProfile({},390,750)==='portrait');
t('rocProfile landscape by ratio',g.rocProfile({},1920,1000)==='landscape');
t('rocProfile threshold',g.rocProfile({layout:{threshold:1.4}},1300,1000)==='portrait');
t('rocProfile force portrait',g.rocProfile({layout:{orientation:'portrait'}},1920,1000)==='portrait');
t('rocProfile force landscape',g.rocProfile({layout:{orientation:'landscape'}},390,750)==='landscape');
t('rocProfile zero dims → landscape',g.rocProfile({},0,0)==='landscape');
t('rocProfile by_browser default auto',g.rocProfile({layout:{orientation:{by_browser:{tabX:'landscape'},default:'auto'}}},390,750)==='portrait');
g.browser_mod={browserID:'tab1'};
t('rocProfile by_browser pin wins',g.rocProfile({layout:{orientation:{by_browser:{tab1:'landscape'}}}},390,750)==='landscape');
delete g.browser_mod;
const _ti={top:'10%',size:'20px',portrait:{top:'8%'},desktop:{top:'12%',size:'30px'}};
t('tApply portrait merges over base',g.tApply(_ti,'portrait').top==='8%'&&g.tApply(_ti,'portrait').size==='20px');
t('tApply landscape reads legacy desktop',g.tApply(_ti,'landscape').top==='12%'&&g.tApply(_ti,'landscape').size==='30px');
t('tApply null = base',g.tApply(_ti,null).top==='10%');
t('tVal scalar passthrough',g.tVal('16/9','portrait')==='16/9');
t('tVal per-profile exact',g.tVal({portrait:'4/3',landscape:'16/9'},'portrait')==='4/3');
t('tVal legacy mobile→portrait',g.tVal({mobile:'4/3',desktop:'16/9'},'portrait')==='4/3');
t('tVal legacy desktop→landscape',g.tVal({mobile:'4/3',desktop:'16/9'},'landscape')==='16/9');
t('tVal cross-profile fallback',g.tVal({landscape:'21/9'},'portrait')==='21/9');
t('tVal empty → undefined',g.tVal({},'portrait')===undefined);
t('tVal null profile → landscape',g.tVal({desktop:'16/9',mobile:'4/3'},null)==='16/9');
// grid + stage helpers
t('rocGridCss tracks',(function(){const s=g.rocGridCss({columns:[85,15],rows:[10,90]},'');return s.indexOf('grid-template-columns:85% 15%;')>=0&&s.indexOf('grid-template-rows:10% 90%;')>=0;})());
t('rocGridCss gap',/gap:8px;/.test(g.rocGridCss({rows:[100]},'8px')));
t('rocGridCss default 100%',/grid-template-columns:100%;/.test(g.rocGridCss({},'')));
t('rocRegionCss row/col',g.rocRegionCss({row:'1/6',col:2}).indexOf('grid-row:1/6;grid-column:2;')===0);
t('rocRegionCss default col 1',/grid-column:1;/.test(g.rocRegionCss({row:3})));
t('rocRegionCss overflow auto',/overflow:auto/.test(g.rocRegionCss({row:1,overflow:'auto'})));
t('rocRegionCss default hidden',/overflow:hidden/.test(g.rocRegionCss({row:1})));
t('containStage letterboxes',(function(){const s=g.containStage(1000,1000,2);return s.w===1000&&s.h===500&&s.top===250&&s.left===0;})());
t('coverStage covers',(function(){const s=g.coverStage(1000,1000,2);return s.h===1000&&s.w===2000&&s.left===-500;})());
// v3 → v4 auto-migration
const _m=g.rocMigrateLayout({base_image:'/local/x.webp',aspect_ratio:{mobile:'4/3',desktop:'16/9'},max_height:'70vh',breakpoints:{mobile:500},mobile_breakpoint:600,cards_above:[{type:'x',media:'mobile'}],zones:[{id:'z',mobile:{top:'5%'},ultrawide:{top:'7%'}}],light_controls:{entities:['light.a'],height:{mobile:20,desktop:60}}});
t('mig adds layout',!!_m.layout&&!!_m.layout.portrait&&!!_m.layout.landscape);
t('mig height viewport',_m.layout.height==='viewport');
t('mig scalar → per-profile',_m.aspect_ratio.portrait==='4/3'&&_m.aspect_ratio.landscape==='16/9');
t('mig drops max_height/breakpoints',_m.max_height===undefined&&_m.breakpoints===undefined&&_m.mobile_breakpoint===undefined);
t('mig strip media',_m.cards_above[0].media==='portrait');
t('mig element blocks',_m.zones[0].portrait.top==='5%'&&_m.zones[0].landscape.top==='7%'&&_m.zones[0].mobile===undefined&&_m.zones[0].ultrawide===undefined);
t('mig lc height',_m.light_controls.height.portrait===20&&_m.light_controls.height.landscape===60);
t('mig image placed',_m.layout.landscape.place.image.row>=1);
t('mig rows sum ≤100',_m.layout.landscape.rows.reduce(function(a,b){return a+b;},0)<=100);
t('mig respects existing layout',(function(){const c={base_image:'x',layout:{portrait:{rows:[100]}}};return g.rocMigrateLayout(c)===c;})());
t('mig nav side rail',(function(){const c=g.rocMigrateLayout({rooms:[{id:'a',base_image:'x'},{id:'b',base_image:'y'}],nav:{position:'left'}});return c.layout.landscape.columns.length===2&&c.layout.landscape.place.nav.col===1&&c.layout.portrait.columns.length===1;})());
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

// ---- v3.2.0: light_controls lux ring ----------------------------------------
t('rgbToHsl blue',(function(){const h=g.rgbToHsl(38,26,102);return Math.round(h[0])===249&&Math.round(h[1])===59&&Math.round(h[2])===25;})());
t('toHslParts hex',(function(){const h=g.toHslParts('#f4c025');return Math.round(h[0])===45&&Math.round(h[1])===90&&Math.round(h[2])===55;})());
t('toHslParts passes hsl through',(function(){const h=g.toHslParts('hsl(200,50%,20%)');return h[0]===200&&h[1]===50&&h[2]===20;})());
t('toHslParts null on garbage',g.toHslParts('not-a-color')===null&&g.toHslParts(null)===null);
t('lcBorderColor low anchor (lux 0)',g.lcBorderColor(0,{lux_max:50})==='hsl(249.5,59.4%,25.1%)');
t('lcBorderColor midpoint (lux 25)',g.lcBorderColor(25,{lux_max:50})==='hsl(147.2,74.9%,40.1%)');
t('lcBorderColor high anchor (lux 50)',g.lcBorderColor(50,{lux_max:50})==='hsl(44.9,90.4%,55.1%)');
t('lcBorderColor clamps above max',g.lcBorderColor(999,{lux_max:50})===g.lcBorderColor(50,{lux_max:50}));
t('lcBorderColor clamps below 0',g.lcBorderColor(-10,{lux_max:50})===g.lcBorderColor(0,{lux_max:50}));
t('lcBorderColor custom anchors',g.lcBorderColor(50,{lux_max:100,color_low:'hsl(200,50%,20%)',color_high:'#ff0000'})==='hsl(100,75%,35%)');
t('lcBorderColor bad/missing lux is low anchor',g.lcBorderColor(undefined,{lux_max:50})===g.lcBorderColor(0,{lux_max:50}));
t('lcNormEnts strings + objects',JSON.stringify(g.lcNormEnts({entities:['light.a',{entity:'light.b',name:'B'}]}))==='[{"entity":"light.a"},{"entity":"light.b","name":"B"}]');
t('lcNormEnts drops entryless items',g.lcNormEnts({entities:[{name:'x'},null,'light.c']}).length===1);
t('lcNormEnts empty/absent',g.lcNormEnts({}).length===0&&g.lcNormEnts(null).length===0);

t('lcResolveHeight px number',g.lcResolveHeight(20,'desktop')===20);
t('lcResolveHeight px string',g.lcResolveHeight('40px','desktop')===40);
t('lcResolveHeight vh (800 vp fallback)',g.lcResolveHeight('5vh','desktop')===40);
t('lcResolveHeight % of screen height',g.lcResolveHeight('10%','desktop')===80);
t('lcResolveHeight per-profile object',g.lcResolveHeight({portrait:20,landscape:60},'landscape')===60&&g.lcResolveHeight({mobile:20,desktop:60},'landscape')===60);
t('lcResolveHeight default when empty',g.lcResolveHeight(null,'desktop')===20&&g.lcResolveHeight('','desktop')===20);
t('lcResolveHeight garbage falls back',g.lcResolveHeight('abc','desktop')===20);

t('lcSliderCss bg + border !important',(function(){const c=g.lcSliderCss('#000000','hsl(45,90%,55%)');return c.indexOf('--bsc-background:#000000 !important')>=0&&c.indexOf('--bsc-border-color:hsl(45,90%,55%) !important')>=0&&c.indexOf('#container')>=0;})());
t('lcSliderCss omits empty border',g.lcSliderCss('#111','').indexOf('--bsc-border-color')<0);

// ---- v3.3.0: cover control (roleta) ----------------------------------------
t('ccColor HA name',g.ccColor('indigo')==='#4e5cb5'&&g.ccColor('blue-grey')==='#607d8b');
t('ccColor passthrough css',g.ccColor('#abcdef')==='#abcdef'&&g.ccColor('rgba(1,2,3,0.5)')==='rgba(1,2,3,0.5)');
t('ccColor empty',g.ccColor('')===''&&g.ccColor(null)==='');
t('coverControlNorm none',g.coverControlNorm({id:'b',entity:'cover.x'})===null);
t('coverControlNorm off',g.coverControlNorm({id:'b',entity:'cover.x',control:{display:'off'}})===null);
t('coverControlNorm no entity',g.coverControlNorm({id:'b',control:{display:'dock'}})===null);
const _ccn=g.coverControlNorm({id:'b1',entity:'cover.x',control:{display:'dock',dock_side:'left',slider:false,presets:[{position:150,icon:'mdi:sun',color:'amber',name:'Open'},{position:-5}]}});
t('coverControlNorm normalizes',_ccn&&_ccn.placement==='dock'&&_ccn.side==='left'&&_ccn.slider===false);
t('coverControlNorm clamps presets',_ccn.presets[0].position===100&&_ccn.presets[1].position===0);
t('coverControlNorm defaults',(function(){const n=g.coverControlNorm({id:'b',entity:'cover.x',control:true});return n.placement==='float'&&n.side==='right'&&n.slider===true&&n.buttons.join(',')==='up,stop,down';})());
t('coverControlNorm legacy display popover',g.coverControlNorm({id:'b',entity:'cover.x',control:{display:'popover'}}).placement==='float');
t('coverControlNorm legacy display dock',g.coverControlNorm({id:'b',entity:'cover.x',control:{display:'dock'}}).placement==='dock');
t('coverCtlHtml horizontal (mobile) class',g.coverCtlHtml(g.coverControlNorm({id:'h',entity:'cover.x',control:{placement:'float'}}),true).indexOf('cc-h')>=0);
t('coverCtlHtml icon-only (no label span)',g.coverCtlHtml(g.coverControlNorm({id:'r',entity:'cover.x',control:{placement:'float',presets:[{position:50,icon:'mdi:blinds',name:'Half'}]}})).indexOf('cc-preset-lbl')<0);
const _cch=g.coverCtlHtml(g.coverControlNorm({id:'roll',entity:'cover.x',name:'Bedroom',control:{display:'popover',presets:[{position:65,icon:'mdi:sun',color:'orange',name:'Day'}]}}));
t('coverCtlHtml structure',/data-cc="roll"/.test(_cch)&&_cch.indexOf('data-cc-rail')>=0&&_cch.indexOf('data-cc-up')>=0&&_cch.indexOf('data-cc-down')>=0&&_cch.indexOf('data-cc-stop')>=0);
t('coverCtlHtml preset',/data-pos="65"/.test(_cch)&&_cch.indexOf('mdi:sun')>=0&&_cch.indexOf('#ff9800')>=0);
// v4: packed tracks + intrinsic image row
t('grid packs from top',/align-content:start;/.test(g.rocGridCss({rows:['auto','auto']},'')));
t('imgAutoRow true',g.rocImgAutoRow({rows:['auto','auto','auto'],place:{image:{row:2}}})===true);
t('imgAutoRow false for %',g.rocImgAutoRow({rows:[10,70,20],place:{image:{row:2}}})===false);
t('imgAutoRow false for 1fr',g.rocImgAutoRow({rows:['auto','1fr'],place:{image:{row:2}}})===false);
t('imgAutoRow span uses start line',g.rocImgAutoRow({rows:['auto',10],place:{image:{row:'1/3'}}})===true);
// v4: dock orientation from the grid definition
t('coverHoriz bottom row full width',g.rocCoverHoriz({columns:[100],rows:[10,80,10],place:{cover:{row:3}}})===true);
t('coverHoriz side column',g.rocCoverHoriz({columns:['1fr','auto'],rows:[10,90],place:{cover:{row:'1/3',col:2}}})===false);
t('coverHoriz single row in side col',g.rocCoverHoriz({columns:[85,15],rows:[100],place:{cover:{row:1,col:2}}})===false);
t('coverHoriz col span all = bar',g.rocCoverHoriz({columns:[50,50],rows:[10,90],place:{cover:{row:1,col:'1/3'}}})===true);
t('coverHoriz direction override',g.rocCoverHoriz({columns:[100],rows:[100],place:{cover:{row:1,direction:'vertical'}}})===false&&g.rocCoverHoriz({columns:['1fr','auto'],rows:[100],place:{cover:{row:1,col:2,direction:'horizontal'}}})===true);
t('coverHoriz no cover',g.rocCoverHoriz({columns:[100],rows:[100],place:{image:{row:1}}})===false);
// v4: per-profile cover placement + dock mode
const _ccP=g.coverControlNorm({id:'b',entity:'cover.x',control:{placement:{portrait:'dock',landscape:'float'}}},'portrait');
t('ccNorm per-profile dock',!!_ccP&&_ccP.placement==='dock');
const _ccL=g.coverControlNorm({id:'b',entity:'cover.x',control:{placement:{portrait:'dock',landscape:'float'}}},'landscape');
t('ccNorm per-profile float',!!_ccL&&_ccL.placement==='float');
t('ccNorm per-profile off',g.coverControlNorm({id:'b',entity:'cover.x',control:{placement:{portrait:'off',landscape:'dock'}}},'portrait')===null);
t('ccHtml dock always visible',(function(){const h=g.coverCtlHtml(_ccP,false,'dock');return h.indexOf('display:none')<0&&h.indexOf('data-cc-mode="dock"')>=0;})());
t('ccHtml float tap-reveal hidden',(function(){const h=g.coverCtlHtml(_ccL,false,'float');return h.indexOf('display:none')>=0&&h.indexOf('data-cc-mode="float"')>=0;})());
t('coverCtlHtml no rail when slider off',g.coverCtlHtml(g.coverControlNorm({id:'r',entity:'cover.x',control:{display:'dock',slider:false}})).indexOf('data-cc-rail')<0);

// ---- version single-source check (v5.0 C5) --------------------------------
// ROC_VERSION in the card source must match package.json — the two used to be
// bumped by hand independently and could drift.
(function(){
  try{
    // package.json lives next to the card file under test (repo root), which
    // may differ from this test's own directory when a copy is tested.
    let pkgPath=path.join(path.dirname(file),'package.json');
    if(!fs.existsSync(pkgPath))pkgPath=path.join(__dirname,'..','package.json');
    const pkg=JSON.parse(fs.readFileSync(pkgPath,'utf8'));
    const m=code.match(/const ROC_VERSION='([^']+)'/);
    t('ROC_VERSION matches package.json version',!!m&&m[1]===pkg.version);
  }catch(e){t('ROC_VERSION matches package.json version (readable)',false);}
})();

console.log(fails?('FAILURES: '+fails):'ALL TESTS PASSED ('+(fails===0)+')');
process.exit(fails?1:0);
