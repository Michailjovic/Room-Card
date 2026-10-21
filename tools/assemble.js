#!/usr/bin/env node
/**
 * Assembles the shipped files from the ordered parts listed in src/manifest.json.
 *
 * v6.40.0 (V7_PLAN.md Phase 1): the source lives in src/ as plain script parts that share ONE
 * scope once concatenated — exactly the scope the single file always had. No module syntax, no
 * transpiling: the assembled file is the same JavaScript the card has always shipped, which is
 * what keeps the compatibility contract (V7_PLAN §2a) trivially true for this step.
 *
 * v6.41.0 (Phase 2): the manifest lists BUNDLES — the card (room-overlay-card.js) and the
 * lazy-loaded studio (room-overlay-card-studio.js). A part may appear in more than one bundle
 * (the schema registry is bundled into the studio and is also used by the tests on its own).
 *
 * The assembled root files stay committed: every test tier, the compat harness and anyone
 * installing straight from the repo keep using them unchanged. build.js then minifies them.
 *
 * Usage: node tools/assemble.js           write every bundle
 *        node tools/assemble.js --check   exit 1 if any bundle differs from src/
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const SRC=path.join(ROOT,'src');
const man=JSON.parse(fs.readFileSync(path.join(SRC,'manifest.json'),'utf8'));
const bundles=man.bundles||[{output:man.output,parts:man.parts}];
// `standalone` files are not part of any bundle (kept for the manifest format of v6.40.0)
const listed=new Set([].concat(...bundles.map(b=>b.parts),man.standalone||[]));
// every .js under src/ must be listed — a forgotten part would silently drop code
(function walk(dir){for(const f of fs.readdirSync(dir)){const p=path.join(dir,f);
  if(fs.statSync(p).isDirectory())walk(p);
  else if(f.endsWith('.js')){const rel=path.relative(SRC,p).split(path.sep).join('/');
    if(!listed.has(rel)){console.error('assemble: src/'+rel+' is not listed in src/manifest.json');process.exit(1);}}}})(SRC);
const check=process.argv.includes('--check');
let bad=0;
for(const b of bundles){
  let out='';
  for(const part of b.parts){
    const txt=fs.readFileSync(path.join(SRC,part),'utf8');
    if(!txt.endsWith('\n')){console.error('assemble: src/'+part+' must end with a newline');process.exit(1);}
    out+=txt;
  }
  const target=path.join(ROOT,b.output);
  if(check){
    const cur=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
    if(cur!==out){console.error('assemble --check: '+b.output+' is out of date — run `npm run assemble`');bad++;}
    else console.log('assemble --check: '+b.output+' matches src/ ('+b.parts.length+' parts)');
  }else{
    fs.writeFileSync(target,out);
    console.log('assembled '+b.output+' from '+b.parts.length+' parts ('+Buffer.byteLength(out)+' bytes)');
  }
}
process.exit(bad?1:0);
