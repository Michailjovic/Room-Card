// Reproductions for ANALYSIS_v6.15.9.md (not part of `npm test`). Run: node tests/probes/probe_v6_15_9.js
const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.innerWidth=1920;w.innerHeight=1080;w.requestIdleCallback=f=>setTimeout(f,0);w.loadCardHelpers=undefined;
const warns=[];const ow=w.console.warn;w.console.warn=function(m){warns.push(String(m));};
w.eval(code);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const t=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(info!==undefined?'   → '+JSON.stringify(info):''));if(!c)fails++;};
const LY={portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}};
const st=(state,attrs)=>({state,attributes:Object.assign({friendly_name:'n'},attrs||{})});
const mount=async(cfg,states)=>{const el=w.document.createElement('room-overlay-card');el.setConfig(cfg);el.hass={states,callService(){},user:{name:'x'},locale:{language:'cs'}};w.document.body.appendChild(el);await sleep(30);return el;};
(async()=>{
  // A1) label: timestamp / time-of-day states are parsed with parseFloat → truncated to a number
  const el=await mount({base_image:'/local/x.webp',layout:LY,labels:[
    {id:'ts',entity:'sensor.ts',top:'1%',left:'1%'},
    {id:'tm',entity:'sensor.tm',top:'5%',left:'1%'},
    {id:'un',entity:'sensor.un',suffix:'°',top:'9%',left:'1%'},
    {id:'dec',entity:'sensor.dec',top:'13%',left:'1%'}]},
    {'sensor.ts':st('2026-10-01T05:00:00+00:00'),'sensor.tm':st('12:30'),'sensor.un':st('unavailable'),'sensor.dec':st('21.6')});
  const L=id=>el.shadowRoot.querySelector('[data-lbl="'+id+'"]').textContent;
  t('label shows an ISO timestamp state as-is (not "2026")',L('ts')!=='2026',L('ts'));
  t('label shows a "12:30" state as-is (not "12")',L('tm')!=='12',L('tm'));
  t('label does not glue a unit onto "unavailable"',!/^unavailable°$/.test(L('un')),L('un'));
  t('label without decimals:/suffix: keeps the entity precision (formatEntityState when HA provides it, else the number as-is — not "22")',L('dec').indexOf('22')<0,L('dec'));

  // A2) evalCond: state: [list] (HA-style) is not supported
  const el2=await mount({base_image:'/local/x.webp',layout:LY,overlays:[{id:'o',image:'/local/o.webp',conditions:{opacity:[{condition:{entity:'climate.x',state:['heat','heat_cool']},value:1},{value:0}]}}]},
    {'climate.x':st('heat')});
  const op=el2.shadowRoot.querySelector('[data-ov="o"]').style.opacity;
  t('condition state: [heat, heat_cool] matches state "heat"',op==='1',op);

  // A3) grouping_code exclusivity reads top-level groups, not the active room's groups
  const el3=await mount({base_image:'/local/x.webp',layout:LY,rooms:[{id:'r1',groups:[{id:'g1',grouping_code:'a',visible:true},{id:'g2',grouping_code:'a'}],
    icons:[{id:'i1',icon:'mdi:x',group:'g1',top:'1%',left:'1%'},{id:'i2',icon:'mdi:x',group:'g2',top:'9%',left:'1%'}]}]},{});
  el3._exec({action:'show-group',group:'g2'});await sleep(10);
  t('show-group g2 hides g1 (same grouping_code, groups declared per room)',el3._groupState.g1===false,el3._groupState);

  // A4) toggle-group on a group used by elements but not declared in groups[] needs two taps
  const el4=await mount({base_image:'/local/x.webp',layout:LY,icons:[{id:'i1',icon:'mdi:x',group:'undeclared',top:'1%',left:'1%'}]},{});
  el4._exec({action:'toggle-group',group:'undeclared'});await sleep(10);
  const d=el4.shadowRoot.querySelector('[data-ico="i1"]');
  t('first toggle-group on an undeclared (default-visible) group hides it',el4._groupState.undeclared===false,el4._groupState);

  // A5) "warn once" warnings repeat on every setConfig/instance
  warns.length=0;
  for(let i=0;i<3;i++)await mount({base_image:'/local/x.webp',layout:LY,icons:[{id:'bad id',icon:'mdi:x',top:'1%',left:'1%'}]},{});
  const n=warns.filter(m=>m.indexOf('bad id')>=0).length;
  t('invalid-id warning is printed once per page, not per instance/setConfig',n<=1,n+' warnings');

  // A6) editor YAML subset round-trip of a multi-line template and an inline comment
  const _a=code.indexOf('function _yScalar'),_b=code.indexOf('const FILTER_PROPS');const _m={exports:{}};new Function('module','window',code.slice(_a,_b)+';module.exports=_yaml;')(_m,{});const p=_m.exports;
  const dump=p.s({template:'{{ a }}\nline2'});
  t('editor YAML: own dump of a multi-line string parses back',JSON.stringify(p.p(dump))===JSON.stringify({template:'{{ a }}\nline2'}),p.p(dump));
  t('editor YAML: "action: toggle # note" → action "toggle"',(p.p('action: toggle # note')||{}).action==='toggle',p.p('action: toggle # note'));
  t('editor YAML: block scalar (|) parses',p.p('template: |\n  {{ x }}\n  y')!==null,p.p('template: |\n  {{ x }}\n  y'));

  // A7) exec: fire-dom-event / assist are not handled
  const el7=await mount({base_image:'/local/x.webp',layout:LY},{});let got=null;
  el7.addEventListener('ll-custom',e=>{got=e.detail;});
  el7._exec({action:'fire-dom-event',browser_mod:{service:'browser_mod.popup'}});
  t('fire-dom-event dispatches ll-custom (browser_mod 2 / custom actions)',!!got);
  process.exit(fails?1:0);
})();
