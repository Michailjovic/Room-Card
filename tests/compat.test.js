// Compatibility harness (V7_PLAN.md §2a): renders the same configs with a baseline build and the
// current build and compares the card's DOM and the editor's output byte for byte.
//
// A release must not change how an existing config renders unless that change is the point of
// the release. Every config in the repo's reference YAML files is rendered at a desktop and a
// phone viewport, switched to the next room and back, and opened in the editor (its HTML and
// its collected config are compared too). Version strings are normalised.
//
// Usage:
//   node tests/compat.test.js                    baseline = the latest git tag
//   node tests/compat.test.js --ref v6.31.0      baseline = that git ref
//   node tests/compat.test.js --base old.js      baseline = a file
//   … [--cand path/to/room-overlay-card.js]      candidate (default: the repo's assembled file)
//   … [--strip 'regex']   remove an EXPECTED change from both sides before comparing (repeatable),
//                         e.g. a new editor button — the rest must still be identical
'use strict';
const fs=require('fs');
const path=require('path');
const cp=require('child_process');
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.error('jsdom is not installed — run: npm i -D jsdom');process.exit(1);}
const ROOT=path.join(__dirname,'..');
const arg=n=>{const i=process.argv.indexOf(n);return i>0?process.argv[i+1]:null;};

function baselineCode(){
  if(arg('--base'))return fs.readFileSync(arg('--base'),'utf8');
  const ref=arg('--ref')||cp.execSync('git describe --tags --abbrev=0',{cwd:ROOT}).toString().trim();
  console.log('baseline: '+ref);
  return cp.execSync('git show '+ref+':room-overlay-card.js',{cwd:ROOT,maxBuffer:64*1024*1024}).toString();
}
const candCode=fs.readFileSync(arg('--cand')||path.join(ROOT,'room-overlay-card.js'),'utf8');

function load(code){
  const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
  const w=dom.window;w.innerWidth=1920;w.innerHeight=1080;w.requestIdleCallback=f=>setTimeout(f,0);w.loadCardHelpers=undefined;
  w.eval(code+'\n;window.__rocYaml=rocJsYaml;');
  {const _E=w.customElements.get('room-overlay-card-editor');if(_E)_E.rocDefaultView='classic';} // v7: the classic tabs are tested here; the launcher has its own tests
  return w;
}

// ---- configs: every room-overlay-card in the reference YAML files + synthetic nav variants
function collectConfigs(w){
  const cfgs=[];
  const files=['example-bedroom.yaml','flat-multiroom.yaml','flat-multiroom-v4.yaml']
    .concat(fs.existsSync(path.join(ROOT,'Claude outputs'))?fs.readdirSync(path.join(ROOT,'Claude outputs')).filter(f=>/^room-card-.*\.yaml$/.test(f)).map(f=>'Claude outputs/'+f):[]);
  for(const f of files){
    const p=path.join(ROOT,f);if(!fs.existsSync(p))continue;
    const d=w.__rocYaml.load(fs.readFileSync(p,'utf8'));
    JSON.stringify(d,(k,v)=>{if(v&&typeof v==='object'&&String(v.type||'').includes('room-overlay-card'))cfgs.push([f+'#'+cfgs.length,v]);return v;});
  }
  const img=c=>'data:image/svg+xml;utf8,x'+c;
  const rooms=['a','b','c'].map((id,i)=>({id,name:id.toUpperCase(),base_image:img(i),overlays:[{id:'o'+i,image:img('o'+i),conditions:{opacity:[{condition:{entity:'light.x',state:'on'},value:1},{value:0}]}}],light_controls:{entities:['light.x']},chips:[{entity:'sensor.{room}_t',suffix:'°'}]}));
  for(const live of [undefined,'composite','full','custom'])for(const style of ['thumbnails','tabs','dots'])
    cfgs.push(['synthetic '+live+' '+style,{type:'custom:room-overlay-card',nav:{style,live,chips:[{entity:'sensor.{room}_t'}],rows:{portrait:2}},rooms:JSON.parse(JSON.stringify(rooms)),sections:[{id:'s1',title:'S',icon:'mdi:tv'}]}]);
  return cfgs;
}
const hass={states:{'light.x':{state:'on',attributes:{}},'sensor.a_t':{state:'21.5',attributes:{}}},callService(){},user:{name:'x'}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function snapshot(code,cfgs){
  const w=load(code);const out=[];
  for(const [name,cfg] of cfgs){
    for(const [iw,ih] of [[1920,1080],[390,800]]){
      w.innerWidth=iw;w.innerHeight=ih;
      const el=w.document.createElement('room-overlay-card');
      try{el.setConfig(JSON.parse(JSON.stringify(cfg)));el.hass=hass;w.document.body.appendChild(el);}catch(e){out.push(name+' ERR '+e.message);continue;}
      await wait(40);
      out.push(name+' '+iw+' :: '+el.shadowRoot.innerHTML.replace(/blob:[^'")]+/g,'blob'));
      if(Array.isArray(cfg.rooms)&&cfg.rooms.length>1){
        // 700 ms: past the slide's cleanup (rAF + 420 ms since v6.43.0) — 450 ms raced it and the
        // snapshot caught the transient transition style on either side at random
        el._switchRoom(1,1,true);await wait(700);out.push(name+' '+iw+' switched :: '+el.shadowRoot.innerHTML);
        el._switchRoom(0,-1,true);await wait(700);out.push(name+' '+iw+' back :: '+el.shadowRoot.innerHTML);
      }
      const ed=w.document.createElement('room-overlay-card-editor');
      try{ed.setConfig(JSON.parse(JSON.stringify(cfg)));ed.hass=hass;w.document.body.appendChild(ed);await wait(20);
        out.push(name+' editor :: '+ed.innerHTML);out.push(name+' collect :: '+JSON.stringify(ed._collectConfig()));}
      catch(e){out.push(name+' editor ERR '+e.message);}
      el.remove();ed.remove();
    }
  }
  const strips=process.argv.map((a,i)=>a==='--strip'?new RegExp(process.argv[i+1],'g'):null).filter(Boolean);
  return out.map(s=>{s=s.replace(/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?/g,'vX');for(const r of strips)s=s.replace(r,'');return s;});
}

(async()=>{
  const base=baselineCode();
  const cfgs=collectConfigs(load(candCode));
  const a=await snapshot(base,cfgs),b=await snapshot(candCode,cfgs);
  let diff=0;
  for(let i=0;i<Math.max(a.length,b.length);i++){
    if(a[i]===b[i])continue;
    diff++;const x=a[i]||'',y=b[i]||'';let k=0;while(k<x.length&&x[k]===y[k])k++;
    if(diff<=10)console.log('DIFF '+(x.split(' :: ')[0])+'\n  base: …'+x.slice(Math.max(0,k-120),k+160)+'\n  cand: …'+y.slice(Math.max(0,k-120),k+160));
  }
  console.log('configs '+cfgs.length+' · snapshots '+a.length+' · diffs '+diff);
  console.log(diff?'COMPAT: DIFFERENCES FOUND':'COMPAT: IDENTICAL');
  process.exit(diff?1:0);
})();
