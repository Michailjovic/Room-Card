#!/usr/bin/env node
/**
 * Production build: minify room-overlay-card.js → dist/room-overlay-card.js
 *                   and room-overlay-card-studio.js → dist/room-overlay-card-studio.js (v6.41.0)
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
 * The studio is a second release asset (V7_PLAN D5): the card import()s it from its own URL the
 * first time someone opens the studio. Both files must carry the same version — the card warns
 * about a mismatch, and this build refuses to produce one.
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
const OUTDIR=path.join(ROOT,'dist');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
const kb=(n)=>(n/1024).toFixed(1)+' KB';
const pct=(a,b)=>((b-a)/b*100).toFixed(1)+'%';
const CHECK=process.argv.includes('--check');

// name, version constant, what a healthy bundle must contain, minimum plausible size
const TARGETS=[
  {file:'room-overlay-card.js',ver:/ROC_VERSION\s*=\s*'([^']+)'/,min:50000,must:[
    [out=>out.indexOf('room-overlay-card-editor')>=0,'editor element registration missing from the bundle'],
    [out=>/customElements\.define\(["']room-overlay-card["']/.test(out),'card element registration missing from the bundle'],
    [out=>out.indexOf('room-overlay-card-studio.js')>=0,'studio loader missing from the bundle'],
  ]},
  {file:'room-overlay-card-studio.js',ver:/ROC_STUDIO_VERSION\s*=\s*'([^']+)'/,min:15000,must:[
    [out=>out.indexOf('_rocStudio')>=0,'studio registration missing from the bundle'],
    [out=>out.indexOf('rocValidate')>=0,'schema registry missing from the studio bundle'],
  ]},
];

(async()=>{
  fs.mkdirSync(OUTDIR,{recursive:true});
  for(const T of TARGETS){
    const SRC=path.join(ROOT,T.file);
    const OUT=path.join(OUTDIR,T.file);
    const src=fs.readFileSync(SRC,'utf8');
    const m=src.match(T.ver);
    if(!m){console.error('could not find the version constant in '+T.file);process.exit(1);}
    const version=m[1];
    if(version!==pkg.version){
      console.error('version mismatch: '+T.file+' says '+version+' but package.json='+pkg.version);
      process.exit(1);
    }
    const banner='/*! '+T.file.replace(/\.js$/,'')+' v'+version+' | MIT | https://github.com/Michailjovic/Room-Card */';
    const result=await terser.minify({[T.file]:src},{
      ecma:2020,
      compress:{passes:2},
      mangle:{properties:false},   // NEVER enable — see the header note
      format:{comments:false,preamble:banner},
      sourceMap:{filename:T.file,url:T.file+'.map'},
    });
    if(result.error){console.error(result.error);process.exit(1);}
    fs.writeFileSync(OUT,result.code);
    fs.writeFileSync(OUT+'.map',result.map);

    const rawB=Buffer.byteLength(src),minB=Buffer.byteLength(result.code);
    const rawGz=zlib.gzipSync(src).length,minGz=zlib.gzipSync(result.code).length;
    console.log(T.file.replace(/\.js$/,'')+' v'+version);
    console.log('  raw   '+kb(rawB).padStart(9)+'  →  '+kb(minB).padStart(9)+'   (-'+pct(minB,rawB)+')');
    console.log('  gzip  '+kb(rawGz).padStart(9)+'  →  '+kb(minGz).padStart(9)+'   (-'+pct(minGz,rawGz)+')');
    console.log('  out   dist/'+T.file+' (+ .map)');

    // --check: guard against a silently broken or truncated build
    if(CHECK){
      const out=fs.readFileSync(OUT,'utf8');
      const fail=(msg)=>{console.error('BUILD CHECK FAILED ('+T.file+'): '+msg);process.exit(1);};
      if(minB<T.min)fail('output is implausibly small ('+minB+' B) — likely truncated');
      if(minB>=rawB)fail('output is not smaller than the source');
      if(out.indexOf(version)<0)fail('version string '+version+' missing from the bundle');
      for(const [ok,msg] of T.must)if(!ok(out))fail(msg);
      console.log('  check OK');
    }
  }
})();
