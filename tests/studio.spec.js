// Studio shell in a real browser (v6.41.0, V7_PLAN §10 e2e row). jsdom (tests/studio.test.js)
// covers the logic; this covers what only a renderer can show: the lazy import from the card's
// own URL, the modal top layer, frame geometry, a real mouse drag on the canvas, the phone layout.
// Run: npm run test:e2e
'use strict';
const {test,expect}=require('@playwright/test');
const http=require('http');
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const CARD=process.env.ROC_CARD||path.join(ROOT,'room-overlay-card.js');
const STUDIO=process.env.ROC_STUDIO||path.join(ROOT,'room-overlay-card-studio.js');
let server,base;
const requests=[];
test.beforeAll(async()=>{
  server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://x');requests.push(u.pathname+u.search);
    const map={'/':path.join(__dirname,'harness','studio-shell.html'),'/room-overlay-card.js':CARD,'/room-overlay-card-studio.js':STUDIO};
    const f=map[u.pathname];
    if(!f||!fs.existsSync(f)){res.writeHead(404);res.end('nope');return;}
    res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':'text/javascript','Cache-Control':'no-store'});
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  base='http://127.0.0.1:'+server.address().port;
});
test.afterAll(()=>server&&server.close());
const ready=page=>page.waitForFunction(()=>window.__h&&window.__h.card._rendered===true);
const studio=page=>page.waitForFunction(()=>{const C=customElements.get('room-overlay-card');const S=C&&C._rocStudio&&C._rocStudio.Studio.current;return !!(S&&S._card&&S._card._rendered);});
async function openFromCard(page){
  await page.evaluate(()=>window.__h.card.shadowRoot.querySelector('.tm-studio').click());
  await studio(page);
}

test('Studio button lazy-loads the studio from the card\'s URL and opens a modal above the page',async({page})=>{
  requests.length=0;
  await page.goto(base+'/');await ready(page);
  expect(requests.some(r=>r.startsWith('/room-overlay-card-studio.js'))).toBe(false);   // not loaded for viewing
  await openFromCard(page);
  const st=requests.find(r=>r.startsWith('/room-overlay-card-studio.js'));
  expect(st).toBe('/room-overlay-card-studio.js?hacstag=777&v='+require('../package.json').version);
  const r=await page.evaluate(()=>{
    const d=document.querySelector('dialog.roc-studio');
    const cx=innerWidth/2,cy=innerHeight/2;let t=document.elementFromPoint(cx,cy);while(t&&t.shadowRoot){const n=t.shadowRoot.elementFromPoint(cx,cy);if(!n||n===t)break;t=n;}
    let inDlg=false;for(let n=t;n;n=n.parentNode||n.host)if(n===d){inDlg=true;break;}
    const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;
    const fb=S._fbox.getBoundingClientRect(),wr=S._card.shadowRoot.querySelector('.wrap').getBoundingClientRect();
    return{modal:d.matches(':modal'),inDlg,fb:{w:fb.width,h:fb.height},wr:{w:wr.width,h:wr.height,l:wr.left-fb.left,t:wr.top-fb.top},kind:S.target.kind,
      insp:S._ed.querySelectorAll('input').length,vw:innerWidth,vh:innerHeight};
  });
  expect(r.modal).toBe(true);expect(r.inDlg).toBe(true);
  expect(r.kind).toBe('yaml');                       // no Lovelace around the harness card
  expect(r.insp).toBeGreaterThan(10);
  expect(r.wr.w).toBeGreaterThan(200);
  expect(r.wr.w).toBeLessThanOrEqual(r.fb.w+1);expect(r.wr.h).toBeLessThanOrEqual(r.fb.h+1);
});

test('device frames: portrait frame keeps its aspect, scales to fit and switches the profile',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  const r=await page.evaluate(async()=>{
    const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;
    S._frameBtns.portrait.click();await new Promise(r=>setTimeout(r,300));
    const fb=S._fbox.getBoundingClientRect(),stg=S._stage.getBoundingClientRect();
    return{ratio:fb.width/fb.height,fits:fb.height<=stg.height+1&&fb.width<=stg.width+1,prof:S._card._profile,vp:S._card._rocVp,scale:S._scale};
  });
  expect(Math.abs(r.ratio-800/1280)).toBeLessThan(0.01);
  expect(r.fits).toBe(true);expect(r.prof).toBe('portrait');expect(r.vp).toEqual({w:800,h:1280});expect(r.scale).toBeLessThan(1);
});

test('a real mouse drag on the scaled canvas moves the zone in the studio config and the inspector',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(async()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;S._setFrame('landscape');await new Promise(r=>setTimeout(r,300));});
  const z=await page.evaluate(()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;const b=S._card.shadowRoot.querySelector('.zone').getBoundingClientRect();const c=S._card.shadowRoot.querySelector('.content').getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2,cw:c.width,ch:c.height};});
  await page.mouse.move(z.x,z.y);await page.mouse.down();
  for(let i=1;i<=10;i++)await page.mouse.move(z.x+z.cw*0.2*i/10,z.y+z.ch*0.1*i/10);
  await page.mouse.up();await page.waitForTimeout(200);
  const r=await page.evaluate(()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;
    return{top:parseFloat(S.work.rooms[0].zones[0].top),left:parseFloat(S.work.rooms[0].zones[0].left),ed:S._ed._config.rooms[0].zones[0].left,w:S.work.rooms[0].zones[0].left,dirty:S._dirty(),studio:S.work._roc_studio,undo:S.undoStack.length};});
  expect(r.left).toBeGreaterThan(36);expect(r.left).toBeLessThan(44);   // +20 % of the width, scale-independent
  expect(r.top).toBeGreaterThan(26);expect(r.top).toBeLessThan(34);
  expect(r.ed).toBe(r.w);
  expect(r.dirty).toBe(true);expect(r.studio).toBeUndefined();expect(r.undo).toBe(1);
});

test('Escape guards unsaved changes; Escape closes the guard first; Discard closes',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;S._commit(Object.assign(JSON.parse(JSON.stringify(S.work)),{aspect_ratio:'4/3'}),'test');});
  await page.keyboard.press('Escape');
  const g=await page.evaluate(()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;return{open:!!document.querySelector('dialog.roc-studio[open]'),guard:!!S._sr.querySelector('.layer [data-act="discard"]')};});
  expect(g).toEqual({open:true,guard:true});
  await page.keyboard.press('Escape');               // Escape closes the guard first
  expect(await page.evaluate(()=>!!customElements.get('room-overlay-card')._rocStudio.Studio.current._sr.querySelector('.layer'))).toBe(false);
  await page.keyboard.press('Escape');
  await page.evaluate(()=>customElements.get('room-overlay-card')._rocStudio.Studio.current._sr.querySelector('.layer [data-act="discard"]').click());
  expect(await page.evaluate(()=>!!document.querySelector('dialog.roc-studio'))).toBe(false);
});

test('editor path: Apply hands the edit to the HA editor and closes',async({page})=>{
  await page.goto(base+'/?editor=1');await ready(page);
  await page.waitForFunction(()=>window.__h.editor&&window.__h.editor.querySelector('#roc-studio'));
  await page.evaluate(()=>{window.__fired=[];window.__h.editor.addEventListener('config-changed',e=>window.__fired.push(e.detail.config));window.__h.editor.querySelector('#roc-studio').click();});
  await studio(page);
  await page.click('dialog.roc-studio >> [data-roctab="rooms"]');   // Playwright pierces the studio's shadow root
  const sel='dialog.roc-studio >> #room-name';
  await page.fill(sel,'Lounge');await page.press(sel,'Tab');
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__fired.length)).toBe(0);
  await page.keyboard.press('Control+s');            // Ctrl+S = the primary action (Apply & close)
  await page.waitForFunction(()=>!document.querySelector('dialog.roc-studio'));
  const r=await page.evaluate(()=>({n:window.__fired.length,name:window.__fired[0]&&window.__fired[0].rooms[0].name,ed:window.__h.editor._config.rooms[0].name}));
  expect(r).toEqual({n:1,name:'Lounge',ed:'Lounge'});
});

test('phone: canvas full width, inspector is a bottom sheet behind a toggle',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  const vis=()=>page.evaluate(()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;const r=S._insp.getBoundingClientRect();const c=S._stage.getBoundingClientRect();return{inspTop:r.top,vh:innerHeight,stageW:c.width,vw:innerWidth};});
  const a=await vis();
  expect(a.inspTop).toBeGreaterThanOrEqual(a.vh-1);    // off screen
  expect(a.stageW).toBeGreaterThan(a.vw-2);
  await page.evaluate(()=>customElements.get('room-overlay-card')._rocStudio.Studio.current._inToggle.click());
  await page.waitForTimeout(400);
  const b=await vis();
  expect(b.inspTop).toBeLessThan(b.vh*0.5);
});

test('a missing studio file gives a clear message instead of failing silently',async({page})=>{
  await page.route('**/room-overlay-card-studio.js*',r=>r.fulfill({status:404,body:'x'}));
  await page.goto(base+'/');await ready(page);
  await page.evaluate(()=>window.__h.card.shadowRoot.querySelector('.tm-studio').click());
  await page.waitForFunction(()=>/not found/.test(window.__h.card.shadowRoot.querySelector('.tm-studio').textContent));
  expect(await page.evaluate(()=>!!document.querySelector('dialog.roc-studio'))).toBe(false);
});
