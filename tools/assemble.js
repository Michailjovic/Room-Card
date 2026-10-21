#!/usr/bin/env node
/**
 * Assembles room-overlay-card.js from the ordered parts listed in src/manifest.json.
 *
 * v6.40.0 (V7_PLAN.md Phase 1): the source lives in src/ as plain script parts that share ONE
 * scope once concatenated — exactly the scope the single file always had. No module syntax, no
 * transpiling: the assembled file is the same JavaScript the card has always shipped, which is
 * what keeps the compatibility contract (V7_PLAN §2a) trivially true for this step.
 *
 * The assembled root file stays committed: every test tier, the compat harness and anyone
 * installing straight from the repo keep using it unchanged. build.js then minifies it.
 *
 * Usage: node tools/assemble.js           write room-overlay-card.js
 *        node tools/assemble.js --check   exit 1 if room-overlay-card.js differs from src/
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const SRC=path.join(ROOT,'src');
const man=JSON.parse(fs.readFileSync(path.join(SRC,'manifest.json'),'utf8'));
// `parts` are concatenated into the card; `standalone` files are used as they are (the schema
// registry is not part of what a dashboard loads — tests and, later, the studio use it).
const listed=new Set(man.parts.concat(man.standalone||[]));
// every .js under src/ must be listed — a forgotten part would silently drop code
(function walk(dir){for(const f of fs.readdirSync(dir)){const p=path.join(dir,f);
  if(fs.statSync(p).isDirectory())walk(p);
  else if(f.endsWith('.js')){const rel=path.relative(SRC,p).split(path.sep).join('/');
    if(!listed.has(rel)){console.error('assemble: src/'+rel+' is not listed in src/manifest.json');process.exit(1);}}}})(SRC);
let out='';
for(const part of man.parts){
  const txt=fs.readFileSync(path.join(SRC,part),'utf8');
  if(!txt.endsWith('\n')){console.error('assemble: src/'+part+' must end with a newline');process.exit(1);}
  out+=txt;
}
const target=path.join(ROOT,man.output);
if(process.argv.includes('--check')){
  const cur=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';
  if(cur!==out){console.error('assemble --check: '+man.output+' is out of date — run `npm run assemble`');process.exit(1);}
  console.log('assemble --check: '+man.output+' matches src/ ('+man.parts.length+' parts)');
}else{
  fs.writeFileSync(target,out);
  console.log('assembled '+man.output+' from '+man.parts.length+' parts ('+Buffer.byteLength(out)+' bytes)');
}
