#!/usr/bin/env node
/**
 * Production build: minify room-overlay-card.js → dist/room-overlay-card.js
 *
 * Why a build step at all: the raw file is ~413 KB and every dashboard load
 * pulls it. Terser cuts that by ~30 % raw / ~35 % gzipped. The source stays
 * readable in the repo; only the RELEASE ASSET is minified, which is the copy
 * HACS actually installs (hacs.json's "filename" is resolved against release
 * assets).
 *
 * Safety notes:
 *  - Property mangling is OFF (terser's default). Mangling properties would
 *    rename `setConfig`, `hass`, `getCardSize`… and break every HA integration
 *    point instantly. Do not enable it.
 *  - Class/function names are manglable: the custom elements are registered by
 *    STRING ('room-overlay-card'), and nothing in the card reads
 *    constructor.name or Function.prototype.toString.
 *  - The banner is preserved so an installed copy can still be identified.
 *
 * Verification lives in `npm run build:verify`, which runs all three test tiers
 * against the MINIFIED bundle — the tests accept a path argument precisely so
 * the shipped artifact, not just the source, is the thing under test.
 *
 * Usage: node build.js [--check]
 *   --check  build, report sizes, and fail if the output looks wrong
 */
'use strict';
const fs=require('fs');
const path=require('path');
const zlib=require('zlib');

let terser;
try{terser=require('terser');}
catch(_){console.error('terser is not installed — run: npm i -D terser');process.exit(1);}

const ROOT=__dirname;
const SRC=path.join(ROOT,'room-overlay-card.js');
const OUTDIR=path.join(ROOT,'dist');
const OUT=path.join(OUTDIR,'room-overlay-card.js');
const MAP=OUT+'.map';

const src=fs.readFileSync(SRC,'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));

const m=src.match(/ROC_VERSION\s*=\s*'([^']+)'/);
if(!m){console.error('could not find ROC_VERSION in the source');process.exit(1);}
const version=m[1];
if(version!==pkg.version){
  console.error('version mismatch: ROC_VERSION='+version+' but package.json='+pkg.version);
  process.exit(1);
}

const banner='/*! room-overlay-card v'+version+' | MIT | https://github.com/Michailjovic/Room-Card */';

(async()=>{
  const result=await terser.minify({'room-overlay-card.js':src},{
    ecma:2020,
    compress:{passes:2},
    mangle:{properties:false},   // NEVER enable — see the header note
    format:{comments:false,preamble:banner},
    sourceMap:{filename:'room-overlay-card.js',url:'room-overlay-card.js.map'},
  });
  if(result.error){console.error(result.error);process.exit(1);}

  fs.mkdirSync(OUTDIR,{recursive:true});
  fs.writeFileSync(OUT,result.code);
  fs.writeFileSync(MAP,result.map);

  const rawB=Buffer.byteLength(src);
  const minB=Buffer.byteLength(result.code);
  const rawGz=zlib.gzipSync(src).length;
  const minGz=zlib.gzipSync(result.code).length;
  const pct=(a,b)=>((b-a)/b*100).toFixed(1)+'%';
  const kb=(n)=>(n/1024).toFixed(1)+' KB';

  console.log('room-overlay-card v'+version);
  console.log('  raw   '+kb(rawB).padStart(9)+'  →  '+kb(minB).padStart(9)+'   (-'+pct(minB,rawB)+')');
  console.log('  gzip  '+kb(rawGz).padStart(9)+'  →  '+kb(minGz).padStart(9)+'   (-'+pct(minGz,rawGz)+')');
  console.log('  out   dist/room-overlay-card.js (+ .map)');

  // --check: guard against a silently broken or truncated build
  if(process.argv.includes('--check')){
    const out=fs.readFileSync(OUT,'utf8');
    const fail=(msg)=>{console.error('BUILD CHECK FAILED: '+msg);process.exit(1);};
    if(minB<50000)fail('output is implausibly small ('+minB+' B) — likely truncated');
    if(minB>=rawB)fail('output is not smaller than the source');
    if(out.indexOf(version)<0)fail('version string '+version+' missing from the bundle');
    if(out.indexOf('room-overlay-card-editor')<0)fail('editor element registration missing from the bundle');
    if(!/customElements\.define\(["']room-overlay-card["']/.test(out))fail('card element registration missing from the bundle');
    console.log('  check OK');
  }
})();
