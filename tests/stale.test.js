#!/usr/bin/env node
/**
 * Incremental update = fresh render (7.0.5).
 *
 * For every page of the demo card (demo/config.json + demo/scenario.json — the author's own rooms)
 * and every entity of the scenario, two cards are compared after the entity changes:
 *   A) rendered with the old states, then given the new ones (what a dashboard sees), and
 *   B) rendered fresh with the new states.
 * Any difference in the settled DOM is an update the incremental path misses — an entity or an
 * attribute the card shows but does not watch (7.0.1: the light pills kept their old brightness
 * while the light stayed on). Each section panel of the cockpit is checked open, too. The floor
 * plan page is left out here: jsdom cannot lay it out (it is checked in a browser).
 *
 * A mutation that does not change the fresh render is not relevant to that page and is skipped.
 * About five minutes for the whole card; ROC_STALE_PAGES=bedroom,kitchen runs only those pages.
 * Usage: node tests/stale.test.js [path/to/room-overlay-card.js] [path/to/room-overlay-card-floorplan.js]
 */
'use strict';
const fs=require('fs');
const path=require('path');
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.error('jsdom is not installed — run: npm i -D jsdom');process.exit(1);}
const ROOT=path.join(__dirname,'..');
const cardFile=process.argv[2]||path.join(ROOT,'room-overlay-card.js');
const fpFile=process.argv[3]||path.join(ROOT,'room-overlay-card-floorplan.js');
const CFG=JSON.parse(fs.readFileSync(path.join(ROOT,'demo','config.json'),'utf8'));
const SCN=JSON.parse(fs.readFileSync(path.join(ROOT,'demo','scenario.json'),'utf8'));

const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://ha.local/lovelace/0',pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;
w.innerWidth=1280;w.innerHeight=800;
w.requestIdleCallback=f=>setTimeout(f,0);
w.IntersectionObserver=class{constructor(cb){this.cb=cb;}observe(t){Promise.resolve().then(()=>this.cb([{target:t,isIntersecting:true,intersectionRatio:1}],this));}unobserve(){}disconnect(){}};
w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
w.console.info=()=>{};w.console.warn=()=>{};
w.eval(fs.readFileSync(cardFile,'utf8'));
if(fs.existsSync(fpFile))w.eval(fs.readFileSync(fpFile,'utf8'));

let fails=0;
const t=(n,ok,extra)=>{console.log((ok?'PASS ':'FAIL ')+n+(ok||!extra?'':'\n     '+extra));if(!ok)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clone=o=>JSON.parse(JSON.stringify(o));
const errors=[];
w.addEventListener('error',e=>errors.push(String(e.message)));

const STAMP='2026-11-10T06:00:00+00:00';
const S0={};
for(const id of Object.keys(SCN.states))S0[id]=Object.assign({entity_id:id,last_changed:STAMP,last_updated:STAMP},SCN.states[id],{attributes:Object.assign({},SCN.states[id].attributes||{})});
const mkHass=states=>({states,callService(){return Promise.resolve();},user:{name:'demo',is_admin:true},language:'en',
  locale:{language:'en',number_format:'language'},themes:{darkMode:true},areas:SCN.areas,entities:SCN.entities,
  connection:{subscribeMessage(cb){Promise.resolve().then(()=>cb({result:''}));return Promise.resolve(()=>{});}}});

// One changed value per entity: the state flipped (or a number moved), and — separately — only
// attributes changed while the state stays (brightness / colour / position / readings).
function mutState(id,o){
  const dom=id.split('.')[0],a=Object.assign({},o.attributes);let s=o.state;
  if(/^-?[\d.]+$/.test(s))s=String(Math.round((parseFloat(s)+7.3)*10)/10);
  else if(s==='on'){s='off';if(dom==='light')a.brightness=null;}
  else if(s==='off'){s='on';if(dom==='light'){a.brightness=180;a.rgb_color=[10,200,30];}}
  else if(dom==='cover'){s=s==='open'?'closed':'open';a.current_position=s==='open'?100:0;}
  else if(dom==='climate'){s=s==='off'?'heat':'off';a.hvac_action=s==='off'?'off':'heating';a.current_temperature=(a.current_temperature||20)+3;}
  else if(dom==='media_player'){s=s==='playing'?'off':'playing';a.media_title='Fz title';a.app_name='FzApp';}
  else if(dom==='vacuum'){s=s==='cleaning'?'docked':'cleaning';}
  else if(dom==='person'||dom==='device_tracker'){s=s==='home'?'not_home':'home';}
  else if(dom==='weather'){s=s==='rainy'?'sunny':'rainy';}
  else s=s==='unavailable'?'idle':'unavailable';
  return Object.assign({},o,{state:s,attributes:a});
}
function mutAttr(id,o){
  const dom=id.split('.')[0],a=Object.assign({},o.attributes);
  if(dom==='light'&&o.state==='on'){a.brightness=(a.brightness||200)>120?40:250;a.rgb_color=[20,40,250];}
  else if(dom==='cover'){a.current_position=(+a.current_position||0)>50?10:90;}
  else if(dom==='climate'){a.current_temperature=(a.current_temperature||20)+4;a.temperature=(a.temperature||21)+2;a.hvac_action=a.hvac_action==='heating'?'idle':'heating';}
  else if(dom==='media_player'){a.media_title='Fz other';a.source='FzSrc';a.app_name='FzApp2';a.volume_level=0.9;}
  else return null;
  return Object.assign({},o,{attributes:a});
}

// Settled DOM as text: every attribute sorted, style declarations sorted (transitions dropped),
// nested shadow roots (navigation minis, overview tiles) included.
function ser(root){
  let out='';
  const walk=n=>{
    if(n.nodeType===3){const v=n.nodeValue.replace(/\s+/g,' ');if(v.trim())out+=v;return;}
    if(n.nodeType!==1)return;
    const tag=n.tagName.toLowerCase();
    if(tag==='style')return;
    out+='<'+tag;
    for(const a of[...n.attributes].sort((x,y)=>x.name<y.name?-1:1)){
      let v=a.value;
      if(a.name==='style')v=v.split(/;(?![^(]*\))/).map(x=>x.trim()).filter(x=>x&&!/^(transition|will-change)/.test(x)).sort().join('; ');
      out+=' '+a.name+'="'+v+'"';
    }
    out+='>';
    if(n.shadowRoot){out+='#shadow(';for(const c of n.shadowRoot.childNodes)walk(c);out+=')';}
    for(const c of n.childNodes)walk(c);
    out+='</'+tag+'>';
  };
  for(const c of root.childNodes)walk(c);
  return out;
}

async function render(ri,states,push,section){
  const c=w.document.createElement('room-overlay-card');
  c._roomIdx=ri;c._hashInit=true;
  const cfg=clone(CFG);cfg.url_sync=false;
  c.setConfig(cfg);c.hass=mkHass(states);w.document.body.appendChild(c);
  await sleep(50);
  if(section){c._openSection(section);await sleep(30);}
  if(push){c.hass=mkHass(push);await sleep(50);}
  const s=ser(c.shadowRoot);
  c.remove();
  return s;
}
function firstDiff(a,b){let i=0;const n=Math.min(a.length,b.length);while(i<n&&a[i]===b[i])i++;return'…'+a.slice(Math.max(0,i-90),i+90)+'\n       fresh …'+b.slice(Math.max(0,i-90),i+90);}

(async()=>{
  const t0=Date.now();
  const rooms=CFG.rooms.map((r,i)=>({i,id:r.id,fp:!!(r.floorplan&&!r.overview)}));
  const pages=[];
  for(const r of rooms)if(!r.fp)pages.push({ri:r.i,label:r.id,section:null});
  const cockpit=rooms.find(r=>r.id==='cockpit');
  for(const s of(CFG.sections||[]))pages.push({ri:cockpit?cockpit.i:0,label:(cockpit?cockpit.id:'room 0')+' + panel '+s.id,section:s.id});
  const ids=Object.keys(S0);
  // ROC_STALE_PAGES=bedroom,kitchen limits the run to those pages (by label prefix)
  const only=(process.env.ROC_STALE_PAGES||'').split(',').map(x=>x.trim()).filter(Boolean);
  let tested=0;
  for(const pg of pages){
    if(only.length&&!only.some(o=>pg.label===o||pg.label.indexOf(o+' ')===0))continue;
    const base=await render(pg.ri,S0,null,pg.section);
    const base2=await render(pg.ri,S0,null,pg.section);
    if(base!==base2){t(pg.label+': two renders of the same states are identical',false,firstDiff(base,base2));continue;}
    let n=0;const stale=[];
    for(const id of ids){
      for(const [kind,m] of[['state',mutState(id,S0[id])],['attributes',mutAttr(id,S0[id])]]){
        if(!m)continue;
        const S1=Object.assign({},S0,{[id]:m});
        const fresh=await render(pg.ri,S1,null,pg.section);
        if(fresh===base)continue; // not shown on this page
        n++;
        const inc=await render(pg.ri,S0,S1,pg.section);
        if(inc!==fresh)stale.push(kind+' of '+id+' ('+S0[id].state+' → '+m.state+')\n       incremental '+firstDiff(inc,fresh));
      }
    }
    tested+=n;
    t(pg.label+': the incremental update matches a fresh render for all '+n+' changes it shows',stale.length===0,stale.join('\n     '));
  }
  t('no page without a single change it shows (the test would be blind)',tested>0);
  t('no errors in the window',errors.length===0,errors.slice(0,3).join(' | '));
  console.log('\n'+tested+' changes compared in '+Math.round((Date.now()-t0)/1000)+' s');
  console.log(fails?('\n'+fails+' STALE TEST(S) FAILED'):'\nALL STALE TESTS PASSED');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
