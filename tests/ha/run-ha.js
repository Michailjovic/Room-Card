#!/usr/bin/env node
/**
 * HA-in-the-loop test tier (V7_PLAN.md §10, spike S4): starts a real Home Assistant in Docker,
 * onboards it, installs the assembled card as a dashboard resource and runs tests/ha/ha.spec.js
 * against the real frontend (editor dialog, dashboard save over the Lovelace WebSocket API).
 *
 * Requirements: Docker, the npm dev dependencies (Playwright + Chromium).
 * Usage: npm run test:ha            (HA_IMAGE / HA_PORT env vars override the defaults)
 *        node tests/ha/run-ha.js --keep   leave the container running afterwards
 *
 * The image is pinned to the Home Assistant version the author runs; bump it deliberately.
 */
'use strict';
const cp=require('child_process');
const fs=require('fs');
const path=require('path');
const os=require('os');
const IMAGE=process.env.HA_IMAGE||'ghcr.io/home-assistant/home-assistant:2026.10.2';
const PORT=process.env.HA_PORT||'8123';
const NAME='roc-ha-test';
const B='http://localhost:'+PORT;
const ROOT=path.join(__dirname,'..','..');
const sh=(c,o)=>cp.execSync(c,Object.assign({stdio:'pipe'},o||{})).toString();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function main(){
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'roc-ha-'));
  const cfg=path.join(work,'config');
  fs.mkdirSync(path.join(cfg,'www'),{recursive:true});
  fs.copyFileSync(path.join(__dirname,'ha-configuration.yaml'),path.join(cfg,'configuration.yaml'));
  // the card AND the lazy-loaded studio and floor plan files, side by side as HACS installs them (ROC_CARD_DIR=dist
  // runs the tier against the minified release assets)
  const SRCDIR=process.env.ROC_CARD_DIR?path.resolve(ROOT,process.env.ROC_CARD_DIR):ROOT;
  for(const f of ['room-overlay-card.js','room-overlay-card-studio.js','room-overlay-card-floorplan.js'])fs.copyFileSync(path.join(SRCDIR,f),path.join(cfg,'www',f));
  try{sh('docker rm -f '+NAME);}catch(_){}
  console.log('starting '+IMAGE+' …');
  sh('docker run -d --name '+NAME+' -p '+PORT+':8123 -v "'+cfg+':/config" -e TZ=Europe/Prague '+IMAGE);
  let up=false;
  for(let i=0;i<120&&!up;i++){await sleep(2000);try{up=(await fetch(B+'/api/onboarding')).ok;}catch(_){}}
  if(!up)throw new Error('Home Assistant did not come up on '+B);
  // onboarding → admin token
  const cid=B+'/';
  const post=(p,body,tok,form)=>fetch(B+p,{method:'POST',headers:Object.assign({'Content-Type':form?'application/x-www-form-urlencoded':'application/json'},tok?{Authorization:'Bearer '+tok}:{}),body:form?body:JSON.stringify(body)}).then(r=>r.json());
  const u=await post('/api/onboarding/users',{client_id:cid,name:'Admin',username:'admin',password:'admin12345',language:'en'});
  const t=await post('/auth/token','grant_type=authorization_code&code='+u.auth_code+'&client_id='+encodeURIComponent(cid),null,true);
  await post('/api/onboarding/core_config',{},t.access_token);
  await post('/api/onboarding/analytics',{},t.access_token);
  await post('/api/onboarding/integration',{client_id:cid,redirect_uri:cid+'?auth_callback=1'},t.access_token);
  const tokFile=path.join(work,'tokens.json');
  fs.writeFileSync(tokFile,JSON.stringify({access_token:t.access_token,refresh_token:t.refresh_token,expires_in:t.expires_in}));
  console.log('Home Assistant ready, running tests …');
  let code=0;
  try{cp.execSync('npx playwright test -c tests/ha/playwright.ha.config.js',{cwd:ROOT,stdio:'inherit',env:Object.assign({},process.env,{ROC_HA_URL:B,ROC_HA_TOKENS:tokFile})});}
  catch(e){code=e.status||1;}
  if(!process.argv.includes('--keep')){try{sh('docker rm -f '+NAME);}catch(_){}}
  else console.log('container '+NAME+' left running on '+B+' (admin / admin12345)');
  process.exit(code);
}
main().catch(e=>{console.error(e.message);try{sh('docker rm -f '+NAME);}catch(_){}process.exit(1);});
