#!/usr/bin/env node
/**
 * v6.16.0 design-refresh tests (jsdom): the shared value formatter
 * (rocFmtState) behind labels / nav chips / cockpit tiles, neutral idle tile
 * states, progress only while running, section-launcher status (ring + badge),
 * nav chip pill + inactive-thumbnail dimming, plus the five small logic fixes
 * from ANALYSIS_v6.15.9.md (state lists, per-room grouping_code, toggle-group
 * default, warn-once, fire-dom-event).
 *
 * Usage: node tests/design.test.js [path-to-card.js]   (requires: npm i -D jsdom)
 */
'use strict';
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.log('jsdom not installed - skipping design tests (npm i -D jsdom)');process.exit(0);}
const fs=require('fs');
const path=require('path');
const code=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','room-overlay-card.js'),'utf8');
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.innerWidth=1920;w.innerHeight=1080;
w.requestIdleCallback=f=>setTimeout(f,0);
w.loadCardHelpers=undefined;
const warns=[];w.console.warn=function(m){warns.push(String(m));};
w.eval(code);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;const t=(n,c,info)=>{console.log((c?'PASS ':'FAIL ')+n+(!c&&info!==undefined?'   → '+JSON.stringify(info):''));if(!c)fails++;};
const LY={portrait:{rows:[100],place:{image:{row:1}}},landscape:{rows:[100],place:{image:{row:1}}}};
const LYN={portrait:{rows:[15,85],place:{nav:{row:1},image:{row:2}}},landscape:{rows:[15,85],place:{nav:{row:1},image:{row:2}}}}; // nav must be placed or it isn't rendered
const st=(state,attrs,id)=>({entity_id:id||'x.x',state,attributes:Object.assign({friendly_name:'n'},attrs||{})});
// A minimal stand-in for HA's own formatters: capitalises, appends the unit.
const fmtState=function(s){
  const u=s.attributes&&s.attributes.unit_of_measurement;
  if(/^-?\d+(\.\d+)?$/.test(s.state))return s.state+(u?' '+u:'');
  if(s.attributes&&s.attributes.device_class==='door')return s.state==='on'?'Open':'Closed';
  return s.state.charAt(0).toUpperCase()+s.state.slice(1);
};
const mkHass=(states,extra)=>Object.assign({states,callService(){},user:{name:'x'},locale:{language:'en',number_format:'language'},formatEntityState:fmtState,formatEntityAttributeValue:(s,a)=>'attr:'+s.attributes[a]},extra||{});
const mount=async(cfg,states,extra)=>{const el=w.document.createElement('room-overlay-card');el.setConfig(cfg);el.hass=mkHass(states,extra);w.document.body.appendChild(el);await sleep(30);return el;};

(async()=>{
  // ---- 1. rocFmtState unit tests ------------------------------------------
  const F=w.rocFmtState;
  t('rocFmtState is a global function',typeof F==='function');
  const H=mkHass({});
  t('unavailable → "—" (no prefix/suffix)',F(H,st('unavailable'),{prefix:'T ',suffix:'°'})==='—');
  t('unknown → custom unavailable_text',F(H,st('unknown'),{unavailable_text:'n/a'})==='n/a');
  t('numeric + decimals → formatted, suffix kept',F(H,st('21.63'),{decimals:1,suffix:'°'})==='21.6°');
  t('numeric + suffix, no decimals → rounded (pre-v6.16.0 behaviour kept)',F(H,st('57.7'),{suffix:'%'})==='58%');
  t('suffix: auto → unit of measurement',F(H,st('57.7',{unit_of_measurement:'%'}),{suffix:'auto'})==='58 %');
  t('Czech locale → decimal comma',F(mkHass({},{locale:{language:'cs',number_format:'language'}}),st('21.63'),{decimals:1})==='21,6');
  t('number_format comma_decimal overrides language',F(mkHass({},{locale:{language:'cs',number_format:'comma_decimal'}}),st('21.63'),{decimals:1})==='21.6');
  t('ISO timestamp is never parsed into a number',F(mkHass({},{formatEntityState:undefined}),st('2026-10-01T05:00:00+00:00'),{suffix:'x'})==='2026-10-01T05:00:00+00:00');
  t('"12:30" is never parsed into 12',F(mkHass({},{formatEntityState:undefined}),st('12:30'),{})==='12:30');
  t('no explicit formatting → hass.formatEntityState (translated / device class)',F(H,st('on',{device_class:'door'}),{})==='Open');
  t('no explicit formatting, numeric → formatEntityState keeps precision + unit',F(H,st('21.6',{unit_of_measurement:'°C'}),{})==='21.6 °C');
  t('attribute → formatEntityAttributeValue',F(H,st('on',{brightness:128}),{attribute:'brightness'})==='attr:128');
  t('format: raw → exact legacy output',F(H,st('2026-10-01'),{format:'raw'})==='2026');
  t('no HA formatter → raw state string fallback',F(mkHass({},{formatEntityState:undefined}),st('heat'),{})==='heat');

  // ---- 2. labels + nav chips use it --------------------------------------
  const el=await mount({base_image:'/local/x.webp',layout:LY,labels:[
      {id:'l1',entity:'sensor.t',suffix:'°',decimals:1,top:'1%',left:'1%'},
      {id:'l2',entity:'binary_sensor.door',top:'5%',left:'1%'},
      {id:'l3',entity:'sensor.dead',suffix:'%',top:'9%',left:'1%'}]},
    {'sensor.t':st('21.04'),'binary_sensor.door':st('on',{device_class:'door'}),'sensor.dead':st('unavailable')});
  const L=id=>el.shadowRoot.querySelector('[data-lbl="'+id+'"]').textContent;
  t('label: numeric with decimals',L('l1')==='21.0°',L('l1'));
  t('label: binary sensor shows HA wording, not "on"',L('l2')==='Open',L('l2'));
  t('label: unavailable shows "—", not "unavailable%"',L('l3')==='—',L('l3'));

  const nav=await mount({base_image:'/local/x.webp',layout:LYN,nav:{chips:[{entity:'sensor.{room}_t',decimals:1,suffix:'°'},{entity:'sensor.{room}_h',suffix:'%'}]},
      rooms:[{id:'a',base_image:'/local/a.webp'},{id:'b',base_image:'/local/b.webp'}]},
    {'sensor.a_t':st('21.0'),'sensor.a_h':st('unavailable'),'sensor.b_t':st('19.24'),'sensor.b_h':st('55.4')});
  nav._updateNav();
  const chips=[...nav.shadowRoot.querySelectorAll('[data-thumb-chips] span')];
  t('nav chips rendered',chips.length===4,chips.length);
  t('nav chip: unavailable → "—"',chips[1]&&chips[1].textContent==='—',chips[1]&&chips[1].textContent);
  t('nav chip: numeric formatting kept',chips[2]&&chips[2].textContent==='19.2°',chips[2]&&chips[2].textContent);
  t('nav chip gets the default pill class',chips.every(c=>c.classList.contains('roc-navchip')));
  t('nav chip container no longer forces a monospace font',!/monospace/.test(nav.shadowRoot.querySelector('[data-thumb-chips]').getAttribute('style')));
  t('nav: inactive thumbnails dimmed by default (roc-dim + data-act on the active one)',
    nav.shadowRoot.querySelector('.roc-nav').classList.contains('roc-dim')&&nav.shadowRoot.querySelectorAll('.roc-thumb[data-act]').length===1);
  const nav2=await mount({base_image:'/local/x.webp',layout:LYN,nav:{dim_inactive:false},rooms:[{id:'a'},{id:'b'}]},{});
  t('nav.dim_inactive: false turns the dimming off',!nav2.shadowRoot.querySelector('.roc-nav').classList.contains('roc-dim'));

  // ---- 3. cockpit tiles ---------------------------------------------------
  const secCfg={base_image:'/local/x.webp',layout:LY,
    sections:[{id:'appl',title:'Appliances',tiles:[
      {id:'wash',name:'Washer',entity:'sensor.washer',active_state:['washing','drying'],progress:'sensor.washer_p'},
      {id:'oven',name:'Oven',entity:'sensor.oven',active_state:'run',progress:'sensor.oven_p'},
      {id:'fan',name:'Fan',entity:'sensor.fan',active_state:'on',progress:'sensor.fan_p',progress_always:true},
      {id:'tv',name:'TV',entity:'media_player.tv'}]}],
    icons:[{id:'launch',icon:'mdi:washing-machine',chip:true,top:'80%',left:'5%',tap_action:{action:'open-section',section:'appl'}},
           {id:'quiet',icon:'mdi:washing-machine',top:'80%',left:'15%',section_status:false,tap_action:{action:'open-section',section:'appl'}}]};
  const states={'sensor.washer':st('drying'),'sensor.washer_p':st('64'),'sensor.oven':st('inactive'),'sensor.oven_p':st('100'),
    'sensor.fan':st('off'),'sensor.fan_p':st('30'),'media_player.tv':st('unavailable')};
  const sc=await mount(secCfg,states);
  sc._openSection('appl');sc._updateSectionTiles();
  const tile=id=>sc.shadowRoot.querySelectorAll('[data-section-panel="appl"] .roc-tile')[['wash','oven','fan','tv'].indexOf(id)];
  const stTxt=id=>tile(id).querySelector('[data-tile-state]');
  const prog=id=>tile(id).querySelector('.roc-tile-progress');
  t('tile: running state via active_state list',tile('wash').classList.contains('is-active')&&stTxt('wash').classList.contains('ts-run'));
  t('tile: state text is HA-formatted ("Drying", not "drying")',stTxt('wash').textContent==='Drying',stTxt('wash').textContent);
  t('tile: idle state is neutral — no green "done" class in auto mode',!stTxt('oven').classList.contains('ts-done')&&!stTxt('oven').classList.contains('ts-run'));
  t('tile: idle tile hides its progress bar',prog('oven').style.display==='none');
  t('tile: running tile shows its progress bar',prog('wash').style.display!=='none');
  t('tile: progress_always keeps the bar on an idle tile',prog('fan').style.display!=='none');
  t('tile: unavailable entity shows "—"',stTxt('tv').textContent==='—',stTxt('tv').textContent);
  t('panel badge counts running tiles',sc.shadowRoot.querySelector('[data-section-panel="appl"] [data-section-badge]').textContent==='1');

  // ---- 4. section launcher status ------------------------------------------
  sc._update();
  const ico=sc.shadowRoot.querySelector('[data-ico="launch"]');
  const ring=ico.querySelector('[data-ico-ring]'),badge=ico.querySelector('[data-ico-badge]');
  t('launcher: ring markup present on an open-section icon',!!ring&&!!badge);
  t('launcher: one running tile with progress → ring at 64 %, no badge',ring.style.display==='block'&&ring.style.getPropertyValue('--p')==='64%'&&badge.textContent==='',[ring.style.display,ring.style.getPropertyValue('--p'),badge.textContent]);
  t('launcher: active class + active colour on the icon',ico.classList.contains('ico-active')&&/roc-active-c/.test(ico.querySelector('ha-icon').style.color));
  t('launcher: section_status:false → no ring/badge markup',!sc.shadowRoot.querySelector('[data-ico="quiet"] [data-ico-ring]'));
  // second tile starts running → badge 2
  sc.hass=mkHass(Object.assign({},states,{'sensor.oven':st('run')}));sc._update();
  t('launcher: two running tiles → badge "2"',badge.textContent==='2',badge.textContent);
  // nothing running → idle
  sc.hass=mkHass(Object.assign({},states,{'sensor.washer':st('idle'),'sensor.oven':st('inactive')}));sc._update();
  t('launcher: nothing running → no ring, no badge, neutral colour',ring.style.display==='none'&&badge.textContent===''&&!ico.classList.contains('ico-active'));

  // ---- 5. small logic fixes (ANALYSIS_v6.15.9.md #3–#7) ---------------------
  const ov=await mount({base_image:'/local/x.webp',layout:LY,overlays:[{id:'o',image:'/local/o.webp',conditions:{opacity:[{condition:{entity:'climate.x',state:['heat','heat_cool']},value:1},{value:0}]}}]},{'climate.x':st('heat')});
  t('#3 condition state: [list] matches',ov.shadowRoot.querySelector('[data-ov="o"]').style.opacity==='1');
  const gr=await mount({base_image:'/local/x.webp',layout:LY,rooms:[{id:'r1',groups:[{id:'g1',grouping_code:'a',visible:true},{id:'g2',grouping_code:'a'}],
    icons:[{id:'i1',icon:'mdi:x',group:'g1',top:'1%',left:'1%'}]}]},{});
  gr._exec({action:'show-group',group:'g2'});
  t('#4 grouping_code works with per-room groups',gr._groupState.g1===false&&gr._groupState.g2===true,gr._groupState);
  const tg=await mount({base_image:'/local/x.webp',layout:LY,icons:[{id:'i1',icon:'mdi:x',group:'undeclared',top:'1%',left:'1%'}]},{});
  tg._exec({action:'toggle-group',group:'undeclared'});
  t('#5 first toggle-group on an undeclared group hides it',tg._groupState.undeclared===false);
  warns.length=0;
  for(let i=0;i<3;i++)await mount({base_image:'/local/x.webp',layout:LY,icons:[{id:'bad id 2',icon:'mdi:x',top:'1%',left:'1%'}]},{});
  t('#6 config warning printed once per page',warns.filter(m=>m.indexOf('bad id 2')>=0).length===1);
  let got=null;const fe=await mount({base_image:'/local/x.webp',layout:LY},{});
  fe.addEventListener('ll-custom',e=>{got=e.detail;});
  fe._exec({action:'fire-dom-event',browser_mod:{service:'browser_mod.popup'}});
  t('#7 fire-dom-event dispatches ll-custom with the action as detail',!!got&&got.browser_mod&&got.browser_mod.service==='browser_mod.popup');

  // ---- 6. editor round-trip of an active_state list ---------------------------
  const ed=w.document.createElement('room-overlay-card-editor');
  ed.setConfig(JSON.parse(JSON.stringify(secCfg)));ed.hass={states:{},user:{name:'x'}};w.document.body.appendChild(ed);
  ed._tab='sections';ed._render();await sleep(10);
  const actIn=ed.querySelector('[data-tf-active="0:0"]'); // declared tile 0 of section 0 (icons also carry tile fields, keyed ico:N)
  t('editor: active_state list shown comma-separated',!!actIn&&actIn.value==='washing, drying',actIn&&actIn.value);
  const out=ed._collectConfig();
  t('editor: active_state list survives a save unchanged',JSON.stringify(out.sections[0].tiles[0].active_state)===JSON.stringify(['washing','drying']),out.sections[0].tiles[0].active_state);
  actIn.value='on';const out2=ed._collectConfig();
  t('editor: a single active_state stays a plain string',out2.sections[0].tiles[0].active_state==='on');

  // ---- 7. v6.17.0 native light pills -----------------------------------------
  const calls=[];
  const lcStates={
    'light.a':Object.assign(st('on',{brightness:128,rgb_color:[255,170,80],supported_color_modes:['brightness']}),{entity_id:'light.a'}),
    'light.b':Object.assign(st('off',{supported_color_modes:['color_temp']}),{entity_id:'light.b'}),
    'light.c':Object.assign(st('on',{supported_color_modes:['onoff']}),{entity_id:'light.c'}),
    'switch.d':Object.assign(st('on'),{entity_id:'switch.d'}),
    'light.e':Object.assign(st('unavailable'),{entity_id:'light.e'}),
    'sensor.lux':st('25')};
  const lcCfg={base_image:'/local/x.webp',
    layout:{portrait:{rows:[10,90],place:{lights:{row:1},image:{row:2}}},landscape:{rows:[10,90],place:{lights:{row:1},image:{row:2}}}},
    light_controls:{style:'native',height:30,lux_sensor:'sensor.lux',lux_max:50,
      entities:[{entity:'light.a',name:'Levá'},{entity:'light.b',name:'Střed'},{entity:'light.c',name:'Onoff'},{entity:'switch.d',name:'Zásuvka'},{entity:'light.e'}]}};
  const lc=await mount(lcCfg,lcStates,{callService:function(d,sv,data){calls.push([d,sv,data]);}});
  lc._update();
  const P=i=>lc.shadowRoot.querySelector('[data-lcp="'+i+'"]');
  t('pills: native style renders built-in pills, no material-slider-card hosts',!!P(0)&&!lc.shadowRoot.querySelector('[data-lc-card]'));
  t('pills: keep the configured height (no extra space)',P(0).style.height==='30px');
  t('pills: dimmable light at brightness 128 → 50 % fill + "50 %"',P(0).querySelector('[data-lcp-fill]').style.width==='50%'&&P(0).querySelector('[data-lcp-val]').textContent==='50 %',[P(0).querySelector('[data-lcp-fill]').style.width,P(0).querySelector('[data-lcp-val]').textContent]);
  t('pills: fill uses the light\'s own colour',/255,\s*170,\s*80/.test(P(0).style.getPropertyValue('--lcp-col')),P(0).style.getPropertyValue('--lcp-col'));
  t('pills: on → class on + filled bulb icon',P(0).classList.contains('on')&&P(0).querySelector('[data-lcp-icon]').getAttribute('icon')==='mdi:lightbulb');
  t('pills: off → HA-formatted value, empty fill, outline icon',P(1).querySelector('[data-lcp-val]').textContent==='Off'&&P(1).querySelector('[data-lcp-fill]').style.width==='0%'&&P(1).querySelector('[data-lcp-icon]').getAttribute('icon')==='mdi:lightbulb-outline');
  t('pills: on/off-only light → full fill, "On"',P(2).querySelector('[data-lcp-fill]').style.width==='100%'&&P(2).querySelector('[data-lcp-val]').textContent==='On');
  t('pills: switch → pill with power icon',P(3).querySelector('[data-lcp-icon]').getAttribute('icon')==='mdi:power');
  t('pills: unavailable → "—" + dimmed',P(4).classList.contains('unavailable')&&P(4).querySelector('[data-lcp-val]').textContent==='—');
  t('pills: name falls back to friendly_name',P(4).querySelector('.roc-lcp-nm').textContent==='n');
  t('pills: lux ring colours the border',/^(hsl|rgb)/.test(P(0).style.borderColor),P(0).style.borderColor);
  const pe=(el,type,x,y)=>el.dispatchEvent(new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y||10,button:0}));
  calls.length=0;pe(P(1),'pointerdown',50);pe(P(1),'pointerup',50);
  t('pills: tap toggles',calls.length===1&&calls[0][0]==='homeassistant'&&calls[0][1]==='toggle'&&calls[0][2].entity_id==='light.b',calls);
  P(0).getBoundingClientRect=()=>({left:0,top:0,width:200,height:30,right:200,bottom:30});
  calls.length=0;pe(P(0),'pointerdown',20);pe(P(0),'pointermove',60);pe(P(0),'pointermove',150);pe(P(0),'pointerup',150);
  t('pills: horizontal drag sets brightness (75 %) and does not toggle',calls.length===1&&calls[0][0]==='light'&&calls[0][1]==='turn_on'&&calls[0][2].brightness_pct===75,calls);
  calls.length=0;pe(P(0),'pointerdown',150);pe(P(0),'pointermove',100);pe(P(0),'pointermove',-30);pe(P(0),'pointerup',-30);
  t('pills: drag to the left edge turns the light off',calls.length===1&&calls[0][1]==='turn_off',calls);
  P(2).getBoundingClientRect=()=>({left:0,top:0,width:200,height:30,right:200,bottom:30});
  calls.length=0;pe(P(2),'pointerdown',20);pe(P(2),'pointermove',120);pe(P(2),'pointerup',120);
  t('pills: on/off-only light ignores a drag (no dim, no accidental toggle)',calls.length===0,calls);
  calls.length=0;pe(P(1),'pointerdown',20,10);pe(P(1),'pointermove',22,60);pe(P(1),'pointerup',22,60);
  t('pills: vertical swipe (page scroll) does nothing',calls.length===0,calls);
  // editor
  const ed2=w.document.createElement('room-overlay-card-editor');
  const edCfg=JSON.parse(JSON.stringify(lcCfg));edCfg.light_controls.entities[0].icon='mdi:ceiling-light';
  ed2.setConfig(edCfg);ed2.hass={states:{},user:{name:'x'}};w.document.body.appendChild(ed2);ed2._tab='elements';ed2._render();await sleep(10);
  const sty=ed2.querySelector('#lc-style');
  t('editor: Style select shows "native"',!!sty&&sty.value==='native',sty&&sty.value);
  const lout=ed2._collectConfig().light_controls;
  t('editor: style survives a save',lout&&lout.style==='native');
  t('editor: an entity\'s icon: (no GUI field) survives a save',lout&&lout.entities[0].icon==='mdi:ceiling-light'&&lout.entities[0].name==='Levá',lout&&lout.entities[0]);
  sty.value='';const lout2=ed2._collectConfig().light_controls;
  t('editor: choosing material-slider-card removes style',lout2&&lout2.style===undefined);

  // ---- 8. v6.17.0 cover control uses the design tokens ---------------------------
  const cv=await mount({base_image:'/local/x.webp',layout:LY,blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'20%',control:{placement:'float'}}]},{'cover.x':st('open',{current_position:40})});
  const ccEl=cv.shadowRoot.querySelector('.roc-cc');
  t('cover control: surface + border tokens',!!ccEl&&/--roc-surface-c/.test(ccEl.getAttribute('style'))&&/--roc-border-c/.test(ccEl.getAttribute('style')));

  // ---- 9. v6.17.1 horizontal dock sizes to its buttons ----------------------------
  w.innerWidth=390;w.innerHeight=844;
  const dk=await mount({base_image:'/local/x.webp',
    layout:{height:'fill',portrait:{rows:['auto','auto','1fr'],place:{image:{row:1},cover:{row:2}}},landscape:{rows:[100],columns:[85,15],place:{image:{row:1,col:1},cover:{row:1,col:2}}}},
    blinds:[{id:'b',entity:'cover.x',top:'10%',left:'10%',width:'10%',height:'20%',control:{placement:'dock'}}]},{'cover.x':st('open',{current_position:40})});
  const dkEl=dk.shadowRoot.querySelector('.roc-cc[data-cc-mode="dock"]');
  t('portrait dock is a horizontal bar',!!dkEl&&dkEl.classList.contains('cc-h'));
  t('horizontal dock does not collapse below its buttons (flex:0 0 auto, not flex-basis 0)',!!dkEl&&/flex:\s*0 0 auto/.test(dkEl.getAttribute('style')),dkEl&&dkEl.getAttribute('style'));
  w.innerWidth=1920;w.innerHeight=1080;
  // jsdom's CSS parser drops the `flex:1 1 0` shorthand, so check the generated markup itself
  const vHtml=w.coverCtlHtml({id:'b',entity:'cover.x',buttons:['up','stop','down'],presets:[],slider:true,top:'1%',left:'1%',height:'10%',width:'52px',name:''},false,'dock');
  t('vertical dock still fills its column (flex:1 1 0)',/flex:1 1 0;/.test(vHtml)&&!/flex:0 0 auto/.test(vHtml));

  // ---- 10. v6.18.0 action builder ---------------------------------------------
  const abCfg={base_image:'/local/x.webp',layout:LY,
    sections:[{id:'clean',title:'Úklid'},{id:'media',title:'Média'}],
    rooms:[{id:'obyvak',name:'Obývák',base_image:'/local/a.webp',
      groups:[{id:'svetla'}],
      tap_action:{action:'navigate',navigation_path:'/x/room'},
      zones:[{id:'z1',top:'1%',left:'1%',width:'5%',height:'5%',
        tap_action:{action:'toggle',entity:'light.a',confirmation:{text:'Sure?'}},
        hold_action:{action:'call-service',service:'script.turn_on',service_data:{variables:{x:1}},target:{entity_id:'script.go'}},
        double_tap_action:{action:'fire-dom-event',browser_mod:{service:'browser_mod.popup'}}}],
      icons:[{id:'i1',icon:'mdi:robot',top:'1%',left:'1%',tap_action:{action:'open-section',section:'clean'}}]},
      {id:'loznice',name:'Ložnice',base_image:'/local/b.webp'}]};
  const ab=w.document.createElement('room-overlay-card-editor');
  ab.setConfig(JSON.parse(JSON.stringify(abCfg)));ab.hass={states:{},user:{name:'x'}};w.document.body.appendChild(ab);ab._tab='elements';ab._render();await sleep(10);
  const row=(k)=>ab.querySelector('[data-act="'+k+'"]');
  const typ=(k)=>row(k)&&row(k).querySelector('[data-act-type]');
  const fld=(k,f)=>{const r=row(k);const tv=typ(k).value;return r&&r.querySelector('[data-act-fs="'+tv+'"] [data-act-f="'+f+'"]');};
  t('builder: zone rows for tap / double tap / hold',!!row('z:0|tap')&&!!row('z:0|double_tap')&&!!row('z:0|hold'));
  t('builder: no raw zone action textareas left',!ab.querySelector('[data-z-tap],[data-z-hold],[data-z-dtap]'));
  t('builder: toggle prefilled',typ('z:0|tap').value==='toggle'&&fld('z:0|tap','entity').value==='light.a');
  t('builder: call-service shown as Perform action',typ('z:0|hold').value==='perform-action'&&fld('z:0|hold','perform_action').value==='script.turn_on'&&fld('z:0|hold','target').value==='script.go');
  t('builder: fire-dom-event falls back to Custom (YAML)',typ('z:0|double_tap').value==='custom'&&/fire-dom-event/.test(fld('z:0|double_tap','yaml').value));
  t('builder: icon open-section prefilled with the section select',typ('ico:0|tap').value==='open-section'&&fld('ico:0|tap','section').value==='clean');
  t('builder: room-level Tap on image row',!!row('room|tap')&&typ('room|tap').value==='navigate'&&fld('room|tap','navigation_path').value==='/x/room');
  t('builder: custom YAML box is not hidden as "advanced"',!fld('z:0|double_tap','yaml').parentElement.classList.contains('roc-adv'));
  // untouched rows return the exact original objects (no call-service rewrite)
  let ao=ab._collectConfig();const az=ao.rooms[0].zones[0];
  t('builder: untouched save keeps every action byte-for-byte',
    JSON.stringify(az.hold_action)===JSON.stringify(abCfg.rooms[0].zones[0].hold_action)&&
    JSON.stringify(az.tap_action)===JSON.stringify(abCfg.rooms[0].zones[0].tap_action)&&
    JSON.stringify(az.double_tap_action)===JSON.stringify(abCfg.rooms[0].zones[0].double_tap_action)&&
    JSON.stringify(ao.rooms[0].tap_action)===JSON.stringify(abCfg.rooms[0].tap_action),az);
  // editing the entity keeps confirmation
  fld('z:0|tap','entity').value='light.b';
  ao=ab._collectConfig();
  t('builder: editing the entity keeps extra keys (confirmation)',ao.rooms[0].zones[0].tap_action.entity==='light.b'&&ao.rooms[0].zones[0].tap_action.confirmation&&ao.rooms[0].zones[0].tap_action.confirmation.text==='Sure?',ao.rooms[0].zones[0].tap_action);
  // editing a call-service action modernises it and keeps data + target
  fld('z:0|hold','perform_action').value='script.other';
  ao=ab._collectConfig();const ah=ao.rooms[0].zones[0].hold_action;
  t('builder: edited call-service becomes perform-action with data + target kept',
    ah.action==='perform-action'&&ah.perform_action==='script.other'&&ah.service===undefined&&ah.service_data===undefined&&
    ah.data&&ah.data.variables&&ah.data.variables.x===1&&ah.target.entity_id==='script.go',ah);
  // switch type → fresh object
  typ('ico:0|tap').value='switch-room';typ('ico:0|tap').dispatchEvent(new w.Event('change'));
  t('builder: changing the type shows that type\'s fields only',row('ico:0|tap').querySelector('[data-act-fs="switch-room"]').style.display==='flex'&&row('ico:0|tap').querySelector('[data-act-fs="open-section"]').style.display==='none');
  fld('ico:0|tap','room').value='loznice';
  ao=ab._collectConfig();
  t('builder: new type writes a fresh action',JSON.stringify(ao.rooms[0].icons[0].tap_action)===JSON.stringify({action:'switch-room',room:'loznice'}),ao.rooms[0].icons[0].tap_action);
  // not set → key removed
  typ('room|tap').value='';
  ao=ab._collectConfig();
  t('builder: "not set" removes the key',ao.rooms[0].tap_action===undefined);
  // switching back to the original type + values restores the original object
  typ('room|tap').value='navigate';
  ao=ab._collectConfig();
  t('builder: back to the rendered state → original object',JSON.stringify(ao.rooms[0].tap_action)===JSON.stringify({action:'navigate',navigation_path:'/x/room'}));
  // custom YAML edit + invalid YAML keeps the previous value
  fld('z:0|double_tap','yaml').value='action: none';
  ao=ab._collectConfig();
  t('builder: custom YAML edit is parsed',JSON.stringify(ao.rooms[0].zones[0].double_tap_action)===JSON.stringify({action:'none'}));
  // group select lists the room's groups
  typ('z:0|tap').value='toggle-group';
  const gs=row('z:0|tap').querySelector('[data-act-fs="toggle-group"] [data-act-f="group"]');
  t('builder: group select lists the room groups',!!gs&&Array.from(gs.options).some(o=>o.value==='svetla'));
  gs.value='svetla';
  ao=ab._collectConfig();
  t('builder: toggle-group written',JSON.stringify(ao.rooms[0].zones[0].tap_action)===JSON.stringify({action:'toggle-group',group:'svetla'}),ao.rooms[0].zones[0].tap_action);
  // perform-action from scratch with data YAML + entity list
  typ('z:0|tap').value='perform-action';
  fld('z:0|tap','perform_action').value='light.turn_on';
  fld('z:0|tap','target').value='light.a, light.b';
  fld('z:0|tap','data').value='brightness_pct: 40';
  ao=ab._collectConfig();
  t('builder: perform-action from scratch (target list + data)',JSON.stringify(ao.rooms[0].zones[0].tap_action)===JSON.stringify({action:'perform-action',perform_action:'light.turn_on',target:{entity_id:['light.a','light.b']},data:{brightness_pct:40}}),ao.rooms[0].zones[0].tap_action);
  // tile builder (tagged zone) defaults more-info entity to the tile entity
  const tb=w.document.createElement('room-overlay-card-editor');
  tb.setConfig({base_image:'/local/x.webp',layout:LY,sections:[{id:'s',title:'S'}],zones:[{id:'z',top:'1%',left:'1%',width:'5%',height:'5%',section:'s',tile:{name:'Pračka',entity:'sensor.pracka'}}]});
  tb.hass={states:{},user:{name:'x'}};w.document.body.appendChild(tb);tb._tab='elements';tb._render();await sleep(10);
  const tr=tb.querySelector('[data-act="tf:z:0|tap"]');
  t('builder: tile rows exist',!!tr);
  t('builder: tile more-info defaults to the tile entity',tr&&tr.querySelector('[data-act-fs="more-info"] [data-act-f="entity"]').value==='sensor.pracka');
  let to=tb._collectConfig();
  t('builder: untouched tile has no actions added',to.zones[0].tile.tap_action===undefined&&to.zones[0].tile.hold_action===undefined);
  tr.querySelector('[data-act-type]').value='more-info';
  to=tb._collectConfig();
  t('builder: tile more-info written with the default entity',JSON.stringify(to.zones[0].tile.tap_action)===JSON.stringify({action:'more-info',entity:'sensor.pracka'}),to.zones[0].tile.tap_action);
  t('builder: tile leftover YAML box does not carry tap_action',!/tap_action/.test(tb.querySelector('[data-sec-tile="z:0"]').value));

  // ---- 11. v6.19.0 entity suggestions, entity / id hints, narrow editor ----------
  const eh=w.document.createElement('room-overlay-card-editor');
  eh.setConfig({base_image:'/local/x.webp',layout:LY,
    zones:[{id:'z1',top:'1%',left:'1%',width:'5%',height:'5%'},{id:'z1',top:'1%',left:'1%',width:'5%',height:'5%'}],
    blinds:[{id:'b1',entity:'cover.okno',top:'1%',left:'1%',width:'5%',height:'5%'}],
    glows:[{id:'g1',entity:'light.neni'}]});
  w.document.body.appendChild(eh);eh._tab='elements';eh._render();await sleep(10);
  t('entity lists: empty before hass arrives',!!eh.querySelector('#roc-ent-cover')&&!eh.querySelector('#roc-ent-cover').hasChildNodes());
  eh.hass=mkHass({'cover.okno':st('open',{friendly_name:'Okno ložnice'},'cover.okno'),'light.a':st('on',{friendly_name:'Lampa'},'light.a'),'sensor.t':st('21',{friendly_name:'Teplota'},'sensor.t')});
  t('entity lists: still empty until a field using them is focused',!eh.querySelector('#roc-ent-cover').hasChildNodes()&&!eh.querySelector('#roc-entities').hasChildNodes());
  const focus=el=>el.dispatchEvent(new w.FocusEvent('focusin',{bubbles:true}));
  focus(eh.querySelector('[data-bl-entity="0"]'));focus(eh.querySelector('[data-gw-ent="0"]'));focus(eh.querySelector('input[list="roc-entities"]'));
  const allOpts=Array.from(eh.querySelectorAll('#roc-entities option'));
  t('entity lists: the full list carries friendly names as labels',allOpts.length===3&&allOpts.some(o=>o.value==='light.a'&&o.getAttribute('label')==='Lampa'),allOpts.map(o=>o.outerHTML));
  const covOpts=Array.from(eh.querySelectorAll('#roc-ent-cover option')).map(o=>o.value);
  t('entity lists: the cover list holds only covers',covOpts.length===1&&covOpts[0]==='cover.okno',covOpts);
  t('entity lists: light/switch list holds only lights',Array.from(eh.querySelectorAll('#roc-ent-light_switch option')).map(o=>o.value).join()==='light.a');
  const blEnt=eh.querySelector('[data-bl-entity="0"]');
  t('blind entity field suggests covers',blEnt.getAttribute('list')==='roc-ent-cover');
  const blHint=blEnt.nextElementSibling;
  t('entity hint: friendly name shown under the field (after hass arrives)',!!blHint&&blHint.classList.contains('roc-ent-hint')&&blHint.textContent==='Okno ložnice'&&blHint.style.display==='block');
  const gwEnt=eh.querySelector('[data-gw-ent="0"]');
  t('entity hint: unknown entity flagged',gwEnt.hasAttribute('data-roc-ent-bad')&&/Not found/.test(gwEnt.nextElementSibling.textContent),gwEnt.nextElementSibling&&gwEnt.nextElementSibling.textContent);
  gwEnt.value='light.a';gwEnt.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('entity hint: fixing the entity clears the warning',!gwEnt.hasAttribute('data-roc-ent-bad')&&gwEnt.nextElementSibling.textContent==='Lampa'&&gwEnt.style.borderColor==='');
  gwEnt.value='{{ states("x") }}';gwEnt.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('entity hint: templates are not checked',!gwEnt.hasAttribute('data-roc-ent-bad')&&gwEnt.nextElementSibling.style.display==='none');
  t('entity hint: the hint never ends up in the saved config',eh._collectConfig().blinds[0].entity==='cover.okno');
  const z0=eh.querySelector('[data-z-id="0"]'),z1=eh.querySelector('[data-z-id="1"]');
  const errOf=el=>{const n=el.nextElementSibling;return n&&n.classList.contains('roc-id-err')&&n.style.display==='block'?n.textContent:'';};
  t('id check: duplicate zone ids flagged on both',/Duplicate/.test(errOf(z0))&&/Duplicate/.test(errOf(z1)));
  z1.value='z 2';z1.dispatchEvent(new w.Event('input',{bubbles:true}));
  t('id check: typing re-checks — duplicate gone, bad characters flagged',errOf(z0)===''&&/letters, digits/.test(errOf(z1)),[errOf(z0),errOf(z1)]);
  z1.value='z2';z1.dispatchEvent(new w.Event('input',{bubbles:true}));
  t('id check: valid ids → no message',errOf(z0)===''&&errOf(z1)==='');
  z1.value='';z1.dispatchEvent(new w.Event('input',{bubbles:true}));
  t('id check: empty id flagged',/required/.test(errOf(z1)));
  t('id check: blind ids are checked too (other list, no clash)',errOf(eh.querySelector('[data-bl-id="0"]'))==='');
  const edCss=Array.from(eh.querySelectorAll('style')).map(x=>x.textContent).join('');
  t('narrow editor: container query folds 4/3-column rows',/container-type:inline-size/.test(edCss)&&/@container \(max-width:500px\)/.test(edCss)&&/@container \(max-width:300px\)/.test(edCss));

  // ---- 12. v6.20.0 preview follows every edit, is not remounted; Remove → Undo toast --
  const pv=w.document.createElement('room-overlay-card-editor');
  w.document.body.appendChild(pv);
  pv.setConfig({base_image:'/local/x.webp',layout:LY,test_mode:true,card_id:'pvt',
    zones:[{id:'z1',top:'10%',left:'10%',width:'5%',height:'5%'},{id:'z2',top:'20%',left:'20%',width:'5%',height:'5%'}]});
  pv.hass=mkHass({});pv._tab='elements';pv._render();await sleep(20);
  const pc0=pv._prevCard;
  t('preview: mounted',!!pc0);
  let scCount=0;const _sc=pc0.setConfig.bind(pc0);pc0.setConfig=function(c){scCount++;return _sc(c);};
  const zTop=pv.querySelector('[data-z-top="0"]');zTop.value='33%';zTop.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('preview: a plain field edit reaches the preview (old #7)',pv._prevCard===pc0&&pc0._config.zones[0].top==='33%',pc0._config.zones[0].top);
  pv._render();
  t('preview: a full editor render keeps the same preview instance (old #15)',pv._prevCard===pc0&&pv.querySelector('#roc-prev-host').contains(pc0));
  const scBefore=scCount;pv._render();
  t('preview: re-render with an unchanged config does not reconfigure it',scCount===scBefore);
  const dragged=JSON.parse(JSON.stringify(pc0._config));dragged.zones[1].left='44%';
  const scDrag=scCount;
  w.dispatchEvent(new w.CustomEvent('roc-pos-update',{detail:{config:dragged}}));
  t('preview: a drag inside the preview lands in the config…',pv._config.zones[1].left==='44%'&&pv._config._roc_preview===undefined);
  t('…without rebuilding or reconfiguring the preview',pv._prevCard===pc0&&scCount===scDrag);
  // Remove → toast → Undo
  pv.querySelector('details[data-panel="z-1"]')&&(pv.querySelector('details[data-panel="z-1"]').open=true);
  pv.querySelector('[data-rm-z="1"]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const toast=pv.querySelector('.roc-toast');
  t('remove: zone gone, preview updated in place',pv._config.zones.length===1&&pv._prevCard===pc0&&pc0._config.zones.length===1);
  t('remove: toast names the removed item and offers Undo',!!toast&&/Removed Zone: z2/.test(toast.textContent)&&!!toast.querySelector('[data-toast-undo]'),toast&&toast.textContent);
  t('remove: toast is the last child of the editor root (sticky bottom)',!!toast&&toast.parentElement===pv.querySelector('.roc-ed')&&toast.style.position==='sticky');
  pv._render();
  t('remove: toast survives an editor re-render',!!pv.querySelector('.roc-toast'));
  pv.querySelector('[data-toast-undo]').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  t('undo: the zone is back (config + preview), toast gone',pv._config.zones.length===2&&pv._config.zones[1].id==='z2'&&pv._prevCard._config.zones.length===2&&!pv.querySelector('.roc-toast'));
  // a click on a non-remove button shows nothing
  const addZ=pv.querySelector('#add-z');if(addZ)addZ.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  t('add: no toast for non-remove buttons',!pv.querySelector('.roc-toast'));
  // Edit mode off → preview dropped
  const tmB=pv.querySelector('#test_mode');tmB.checked=false;tmB.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('preview: Edit mode off unmounts it',!pv._prevCard&&!pv.querySelector('#roc-prev-host'));
  // multi-room: picking another room in the editor rebuilds the preview on that room
  const pm=w.document.createElement('room-overlay-card-editor');
  w.document.body.appendChild(pm);
  pm.setConfig({layout:LY,test_mode:true,card_id:'pvm',rooms:[{id:'a',name:'A',base_image:'/a.webp'},{id:'b',name:'B',base_image:'/b.webp'}]});
  pm.hass=mkHass({});pm._render();await sleep(20);
  const pmc=pm._prevCard;
  const rsel=pm.querySelector('#room-select');rsel.value='1';rsel.dispatchEvent(new w.Event('change',{bubbles:true}));
  t('preview: switching the edited room shows that room',!!pm._prevCard&&pm._prevCard._roomIdx===1);

  console.log(fails?('FAILURES: '+fails):'ALL DESIGN TESTS PASSED');
  process.exit(fails?1:0);
})();
