#!/usr/bin/env node
/**
 * Reproduction probe for ANALYSIS_v7.0.0.md (2026-11-10). Not wired into `npm test`.
 * Every check prints PASS when the card behaves as it should; on 7.0.0 the listed findings FAIL.
 * Put it in tests/probes/ and run:  node tests/probes/probe_v7_0_0.js [card.js] [studio.js]
 * (jsdom only. The two Chromium-only findings — #12 HQ thumbnail cache, and the real-keyboard
 *  variant of #9 — are described in the analysis.)
 */
'use strict';
const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const pick=(arg,name)=>arg||[path.join(ROOT,name),path.join(process.cwd(),name)].find(p=>fs.existsSync(p));
const code=fs.readFileSync(pick(process.argv[2],'room-overlay-card.js'),'utf8');
const studio=fs.readFileSync(pick(process.argv[3],'room-overlay-card-studio.js'),'utf8');
function make(opts){
  opts=opts||{};
  const dom=new JSDOM('<html><body></body></html>',{url:opts.url||'https://ha.local/lovelace/0',pretendToBeVisual:true,runScripts:'outside-only'});
  const w=dom.window;w.innerWidth=1920;w.innerHeight=1080;w.requestIdleCallback=f=>setTimeout(f,0);
  w.IntersectionObserver=class{constructor(cb){this.cb=cb;}observe(t){Promise.resolve().then(()=>this.cb([{target:t,isIntersecting:true}],this));}unobserve(){}disconnect(){}};
  w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.matchMedia=w.matchMedia||(q=>({matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
  const DP=w.HTMLDialogElement.prototype;if(!DP.showModal)DP.showModal=function(){this.setAttribute('open','');};if(!DP.close)DP.close=function(){this.removeAttribute('open');};
  w.console.info=()=>{};w.console.warn=()=>{};w.console.error=()=>{};
  w.eval(code+'\n;window.__roc={evalCond,roomMatch};');
  if(opts.studio)w.eval(studio);
  const calls=[],subs=[];
  const mkHass=s=>({states:s||{},callService(d,sv,data,t){calls.push([d,sv,data,t]);return Promise.resolve();},user:{is_admin:true,name:'x'},locale:{language:'en'},language:'en',
    connection:{subscribeMessage(cb,msg){subs.push(msg);if(opts.tmpl!==undefined)Promise.resolve().then(()=>cb({result:opts.tmpl}));return Promise.resolve(()=>{});}}});
  const mkCard=(cfg,s)=>{const c=w.document.createElement('room-overlay-card');w.document.body.appendChild(c);let err=null;try{c.setConfig(cfg);c.hass=mkHass(s);}catch(e){err=e;}return{c,err};};
  return{w,mkCard,mkHass,calls,subs};
}
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||60));
const IMG='/local/x.webp';
const st=(id,s,a)=>({[id]:{entity_id:id,state:String(s),attributes:a||{}}});
let fails=0;const t=(n,ok)=>{console.log((ok?'PASS ':'FAIL ')+n);if(!ok)fails++;};
const hidden=el=>!el||el.style.display==='none'||el.style.visibility==='hidden';
(async()=>{
  // ---- #1 confirmation dialog: its document-level key handler outlives the dialog -------------
  {const S=Object.assign(st('cover.garage','closed'),st('input_select.room','a'));
    const cfg={type:'custom:room-overlay-card',layout:{},room_entity:'input_select.room',rooms:[
      {id:'a',base_image:IMG,icons:[{id:'g',icon:'mdi:garage',top:'10%',left:'10%',tap_action:{action:'call-service',service:'cover.open_cover',target:{entity_id:'cover.garage'},confirmation:{text:'Open?'}}}]},
      {id:'b',base_image:IMG}]};
    {const env=make();const r=env.mkCard(cfg,S);await tick(80);
      r.c.shadowRoot.querySelector('[data-ico="g"]').dispatchEvent(new env.w.MouseEvent('click',{bubbles:true}));await tick(30);
      r.c.hass=env.mkHass(Object.assign({},S,st('input_select.room','b')));await tick(700); // presence follow re-renders the card: the dialog is gone
      const inp=env.w.document.createElement('input');env.w.document.body.appendChild(inp);
      inp.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await tick(30);
      t('#1 Enter typed elsewhere after the confirm dialog vanished (room follow) does NOT run the action',env.calls.length===0);}
    {const env=make();const r=env.mkCard(cfg,S);await tick(80);
      r.c.shadowRoot.querySelector('[data-ico="g"]').dispatchEvent(new env.w.MouseEvent('click',{bubbles:true}));await tick(30);
      r.c.remove();await tick(30);
      env.w.document.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await tick(30);
      t('#1 Enter after the card left the DOM with the dialog open does NOT run the action',env.calls.length===0);}}

  // ---- #2 native light pills follow brightness / colour while the light stays on --------------
  {const env=make();const LY={rows:['1fr','auto'],columns:['100%'],place:{image:{row:1},lights:{row:2}}};
    const L=(b,rgb)=>st('light.a','on',{brightness:b,rgb_color:rgb,supported_color_modes:['rgb'],color_mode:'rgb'});
    const r=env.mkCard({type:'custom:room-overlay-card',layout:{landscape:LY,portrait:LY},base_image:IMG,light_controls:{entities:['light.a'],style:'native'}},L(255,[255,0,0]));
    await tick(120);r.c.hass=env.mkHass(L(51,[0,0,255]));await tick(120);
    const p=(r.c._lcPills||[])[0];
    t('#2 light pill shows 20 % after the light was dimmed elsewhere (state stays "on")',!!p&&p.val.textContent==='20 %'&&p.fill.style.width==='20%');
    t('#2 light pill takes the new colour',!!p&&p.el.style.getPropertyValue('--lcp-solid')==='rgb(0,0,255)');}

  // ---- #3 visibility keys the reference promises on every element -----------------------------
  {const S=Object.assign(st('light.a','on'),st('sensor.t','20'),st('vacuum.v','docked'));
    const on={entity:'light.a',state:'on'},off={entity:'light.a',state:'off'};
    {const env=make();const r=env.mkCard({type:'custom:room-overlay-card',layout:{},base_image:IMG,
        icons:[{id:'i',icon:'mdi:x',top:'1%',left:'1%',visible:[on]}],zones:[{id:'z',top:'5%',left:'5%',width:'5%',height:'5%',visible:[on]}],
        labels:[{id:'l',entity:'sensor.t',top:'9%',left:'9%',visible:[on]}]},S);await tick(80);
      t('#3 visible: [cond] (list form, REFERENCE / AI_SPEC) shows the element when the condition holds',!hidden(r.c._icoEls.i)&&!hidden(r.c._zoneEls.z)&&!hidden(r.c._lblEls.l));}
    {const env=make();const r=env.mkCard({type:'custom:room-overlay-card',layout:{},base_image:IMG,
        icons:[{id:'i',icon:'mdi:x',top:'1%',left:'1%',visible_conditions:off}],zones:[{id:'z',top:'5%',left:'5%',width:'5%',height:'5%',visible_conditions:off}],
        overlays:[{id:'o',image:IMG,visible:off}]},S);await tick(80);
      t('#3 visible_conditions hides an icon / a zone (works only on labels, gauges, blinds)',hidden(r.c._icoEls.i)&&hidden(r.c._zoneEls.z));
      t('#3 visible: on an overlay is honoured',hidden(r.c._ovEls.o));}
    {const env=make({tmpl:'False'});const r=env.mkCard({type:'custom:room-overlay-card',layout:{},base_image:IMG,
        labels:[{id:'l',entity:'sensor.t',top:'9%',left:'9%',visible_template:'{{ false }}'}],
        vacuum_widgets:[{id:'v',top:'5%',left:'5%',vacuums:[{entity:'vacuum.v'}],visible_template:'{{ false }}'}]},S);await tick(80);
      r.c.hass=env.mkHass(Object.assign({},S,st('sensor.t','21')));await tick(80);
      t('#3 visible_template hides a label and a vacuum widget',hidden(r.c._lblEls.l)&&hidden(r.c._vwEls.v));}}

  // ---- #4 studio: changing a room id keeps what points at the room ----------------------------
  {const env=make({studio:true});const C=env.w.customElements.get('room-overlay-card');
    const cfg={type:'custom:room-overlay-card',layout:{},rooms:[
      {id:'ov',overview:{grid:{rooms:['kitchen','hall']}}},
      {id:'plan',floorplan:{rooms:[{room:'kitchen',polygon:[[0,0],[3,0],[3,3],[0,3]]}]}},
      {id:'kitchen',name:'Kitchen',base_image:IMG},{id:'hall',name:'Hall',base_image:IMG,icons:[{id:'i',icon:'mdi:x',top:'1%',left:'1%',tap_action:{action:'switch-room',room:'kitchen'}}]}]};
    let S=null;try{S=await C._rocStudio.open({config:cfg,hass:env.mkHass({})});}catch(e){console.log('     studio did not open in jsdom: '+e.message);}
    if(S){
      S._setRoom(2,false,'x');S.sel=null;S.cardSel=null;S._renderChrome();await tick(200);
      const inp=[...S._propsPane.querySelectorAll('input')].find(i=>i.value==='kitchen');
      if(inp){inp.value='kuchyn';inp.dispatchEvent(new env.w.Event('change',{bubbles:true}));await tick(200);}
      else S._propsSet({kind:'room'},function(it){it.id='kuchyn';},'id');
      const w=S.work;
      t('#4 room id kitchen → kuchyn: overview.grid.rooms follows',w.rooms[0].overview.grid.rooms.includes('kuchyn'));
      t('#4 … floorplan.rooms[].room follows',w.rooms[1].floorplan.rooms[0].room==='kuchyn');
      t('#4 … switch-room actions follow',w.rooms[3].icons[0].tap_action.room==='kuchyn');
      // #9 Ctrl+S while a Properties field still holds uncommitted text
      S._setRoom(3,false,'x');S._select('icon','i','outline');await tick(200);
      const f=[...S._propsPane.querySelectorAll('input[type=text],input:not([type])')].find(i=>i.value==='mdi:x');
      if(f){f.focus();f.value='mdi:y';f.dispatchEvent(new env.w.Event('input',{bubbles:true}));
        const before=JSON.stringify(S.work);
        S._dlg.dispatchEvent(new env.w.KeyboardEvent('keydown',{key:'s',ctrlKey:true,bubbles:true,cancelable:true,composed:true}));await tick(100);
        t('#9 Ctrl+S commits the field being typed in before it saves',JSON.stringify(S.work)!==before&&/mdi:y/.test(JSON.stringify(S.work)));}
      try{S.close();}catch(_){}
    }}

  // ---- #5 CSS-valued config strings go into style="…" unescaped -------------------------------
  {const env=make();const r=env.mkCard({type:'custom:room-overlay-card',layout:{},base_image:IMG,
      labels:[{id:'l1',entity:'sensor.t',top:'10%',left:'10%',font_family:'"Roboto Mono", monospace'}],
      zones:[{id:'z',top:'1%',left:'1%',width:'5%',height:'"><img src=x data-inj=1><i x="',tap_action:{action:'none'}}]},st('sensor.t','21'));
    await tick(80);
    const l1=r.c._lblEls.l1;
    t('#5 font_family: \'"Roboto Mono", monospace\' is applied (a double quote does not cut the style)',!!l1&&/Roboto Mono/.test(l1.style.fontFamily)&&l1.attributes.length<=3);
    t('#5 a config string cannot inject markup',!r.c.shadowRoot.querySelector('img[data-inj]'));}

  // ---- #6 forms the reference documents that the card does not read ---------------------------
  {const env=make();
    t('#6 area_match: kitchen (a plain string, "list of string or string") matches',env.w.__roc.roomMatch({rooms:[{id:'a'},{id:'b',area_match:'kitchen'}]},'kitchen')===1);
    t('#6 a condition with a YAML 1.1 boolean (state: on → true) matches "on"',env.w.__roc.evalCond({entity:'light.a',state:true},st('light.a','on'))===true);}
  {const env=make();const r=env.mkCard({type:'custom:room-overlay-card',layout:{},base_image:IMG,
      overlays:[{id:'o',state_images:[{entity:'sensor.n',state:3,image:'/local/three.webp'},{image:'/local/default.webp'}]}],
      labels:[{id:'l',text:'Static text',top:'20%',left:'10%'}],
      gauges:[{id:'g',entity:'sensor.n',orientation:'radial',thickness:'12px',target:2,top:'30%',left:'30%',width:'10%',height:'10%'}]},st('sensor.n','3'));
    await tick(80);
    t('#6 state_images: state: 3 (a number) matches the state "3"',/three\.webp/.test(r.c._ovEls.o.style.backgroundImage));
    t('#6 label text: "Static text" is shown (the studio form offers the field)',r.c._lblEls.l.textContent==='Static text');
    t('#6 radial gauge with thickness: "12px" (type "length") draws without NaN',!/NaN/.test(r.c._gaugeEls.g?r.c._gaugeEls.g.innerHTML:'NaN'));}

  // ---- #7 stale values / unhandled errors -----------------------------------------------------
  {const env=make();const LY={rows:['auto','1fr'],columns:['100%'],place:{nav:{row:1},image:{row:2}}};
    const r=env.mkCard({type:'custom:room-overlay-card',layout:{landscape:LY,portrait:LY},rooms:[{id:'a',name:'A',base_image:IMG,chips:[{entity:'sensor.t'}]},{id:'b',name:'B',base_image:IMG}]},st('sensor.t','21'));
    await tick(80);r.c.hass=env.mkHass({});await tick(80);
    t('#7 a nav chip whose entity disappeared shows — (not its last value)',(r.c._navChipEls||[]).every(c=>c.el.textContent!=='21'));}
  {const env=make({url:'https://ha.local/lovelace/0#%E0%A4%A=1'});
    const r=env.mkCard({type:'custom:room-overlay-card',layout:{},url_sync:true,rooms:[{id:'a',base_image:IMG},{id:'b',base_image:IMG}]},{});await tick(60);
    t('#7 url_sync: a malformed %-escape in the URL hash does not replace the card with an error',!/configuration error/.test(r.c.shadowRoot.innerHTML));}
  {const env=make();let unhandled=0;const h=()=>{unhandled++;};process.on('unhandledRejection',h);
    const r=env.mkCard({type:'custom:room-overlay-card',layout:{},base_image:IMG,icons:[{id:'i',icon:'mdi:x',entity:'light.a',top:'9%',left:'9%',tap_action:{action:'toggle'}}]},st('light.a','on'));
    await tick(60);r.c._hass.callService=()=>Promise.reject(new Error('Service not found'));
    r.c.shadowRoot.querySelector('[data-ico="i"]').dispatchEvent(new env.w.MouseEvent('click',{bubbles:true}));await tick(60);
    process.removeListener('unhandledRejection',h);
    t('#7 a rejected toggle is caught (like call-service is)',unhandled===0);}

  console.log(fails?('\n'+fails+' check(s) FAIL'):'\nall checks PASS');
  process.exit(0);
})();
