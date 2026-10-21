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
    const map={'/':path.join(__dirname,'harness','studio-shell.html'),'/switch':path.join(__dirname,'harness','switch-shell.html'),'/room-overlay-card.js':CARD,'/room-overlay-card-studio.js':STUDIO};
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
    const p=S._propsPane.querySelector('.pf-field[data-key="left"] input');const pl=p&&p.value;   // the Properties form follows the drag
    S._setTab('all');                                                                                // the hidden editor catches up when shown
    return{pl,top:parseFloat(S.work.rooms[0].zones[0].top),left:parseFloat(S.work.rooms[0].zones[0].left),ed:S._ed._config.rooms[0].zones[0].left,w:S.work.rooms[0].zones[0].left,dirty:S._dirty(),studio:S.work._roc_studio,undo:S.undoStack.length};});
  expect(r.left).toBeGreaterThan(36);expect(r.left).toBeLessThan(44);   // +20 % of the width, scale-independent
  expect(r.top).toBeGreaterThan(26);expect(r.top).toBeLessThan(34);
  expect(r.ed).toBe(r.w);
  expect(r.dirty).toBe(true);expect(r.studio).toBeUndefined();expect(r.undo).toBe(1);
  expect(r.pl).toBe(r.w);
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
  await page.evaluate(()=>customElements.get('room-overlay-card')._rocStudio.Studio.current._setTab('all'));   // the classic editor (v6.44.0: All settings)
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

// ---- Phase 3 (v6.42.0) -------------------------------------------------------------------------
const CUR='customElements.get("room-overlay-card")._rocStudio.Studio.current';
async function centreOf(page,sel){return page.evaluate(([C,sel])=>{const S=eval(C);const r=S._card.shadowRoot.querySelector(sel).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};},[CUR,sel]);}
async function contentRect(page){return page.evaluate(C=>{const S=eval(C);const r=S._card.shadowRoot.querySelector('.content').getBoundingClientRect();return{l:r.left,t:r.top,w:r.width,h:r.height};},CUR);}

test('click on the canvas selects the element and opens it in the inspector; inspector → canvas too',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(C=>eval(C)._setTab('all'),CUR);
  const ic=await centreOf(page,'[data-ico="i1"]');
  await page.mouse.click(ic.x,ic.y);await page.waitForTimeout(500);
  const a=await page.evaluate(C=>{const S=eval(C);const d=S._ed.querySelector('details[data-panel="ico-0"]');const r=d.getBoundingClientRect(),ir=S._insp.getBoundingClientRect();
    return{sel:S.sel,open:d.open,visible:r.top<ir.bottom&&r.bottom>ir.top,outline:[...S._olList.querySelectorAll('[aria-current="true"]')].map(x=>x.dataset.id)};},CUR);
  expect(a).toEqual({sel:{type:'icon',id:'i1'},open:true,visible:true,outline:['i1']});
  // a click on another item's header in the inspector moves the selection on the canvas
  await page.click('dialog.roc-studio >> details[data-panel="gauges"] > summary');   // open the Gauges section first
  await page.click('dialog.roc-studio >> details[data-panel="g-0"] > summary');await page.waitForTimeout(300);
  expect(await page.evaluate(C=>{const S=eval(C);return{sel:S.sel,cv:S._card._selectedTM&&S._card._selectedTM.id};},CUR)).toEqual({sel:{type:'gauge',id:'g1'},cv:'g1'});
});

test('Add → click places a new element where clicked; Add zone → drag draws its box',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  const cr=await contentRect(page);
  await page.evaluate(C=>eval(C)._showAdd(),CUR);
  await page.click('dialog.roc-studio >> .addbtn[data-type="label"]');
  await page.mouse.click(cr.l+cr.w*0.25,cr.t+cr.h*0.45);await page.waitForTimeout(300);
  const a=await page.evaluate(C=>{const S=eval(C);const l=S.work.rooms[0].labels;return{sel:S.sel,l:l&&l.map(x=>[x.id,parseFloat(x.top),parseFloat(x.left)])};},CUR);
  expect(a.sel.type).toBe('label');expect(a.l.map(x=>x[0])).toContain(a.sel.id);
  const nl=a.l.find(x=>x[0]===a.sel.id);a.l[1]=nl;
  expect(Math.abs(a.l[1][1]-45)).toBeLessThan(0.6);expect(Math.abs(a.l[1][2]-25)).toBeLessThan(0.6);
  await page.evaluate(C=>eval(C).add('zone'),CUR);
  await page.mouse.move(cr.l+cr.w*0.6,cr.t+cr.h*0.5);await page.mouse.down();
  await page.mouse.move(cr.l+cr.w*0.75,cr.t+cr.h*0.7,{steps:6});await page.mouse.up();await page.waitForTimeout(300);
  const z=await page.evaluate(C=>{const S=eval(C);return S.work.rooms[0].zones.slice(-1)[0];},CUR);
  expect(Math.abs(parseFloat(z.width)-15)).toBeLessThan(0.6);expect(Math.abs(parseFloat(z.height)-20)).toBeLessThan(0.6);
  expect(await page.evaluate(C=>eval(C)._card._selectedTM.id,CUR)).toBe(z.id);
});

test('snap guides: a dragged icon snaps its centre to another element\'s edge',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  const cr=await contentRect(page);
  const z=await page.evaluate(C=>{const S=eval(C);const r=S._card.shadowRoot.querySelector('[data-z="z1"]').getBoundingClientRect();return{right:r.right};},CUR);
  const ic=await centreOf(page,'[data-ico="i1"]');
  // aim the icon's centre 0.3 % of the width right of the zone's right edge
  const tx=z.right+cr.w*0.003;
  await page.mouse.move(ic.x,ic.y);await page.mouse.down();
  await page.mouse.move((ic.x+tx)/2,ic.y-20,{steps:4});await page.mouse.move(tx,ic.y-40,{steps:4});
  const guide=await page.evaluate(C=>{const S=eval(C);const g=S._card._gdV;return g&&g.style.display;},CUR);
  await page.mouse.up();await page.waitForTimeout(200);
  const after=await centreOf(page,'[data-ico="i1"]');
  expect(guide).toBe('block');
  expect(Math.abs(after.x-z.right)/cr.w*100).toBeLessThan(0.15);
});

test('arrow keys typed in an inspector field do not move the selected element; embedded cards move by their grip',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(C=>eval(C)._setTab('all'),CUR);
  const ic=await centreOf(page,'[data-ico="i1"]');
  await page.mouse.click(ic.x,ic.y);await page.waitForTimeout(300);
  const before=await page.evaluate(C=>eval(C).work.rooms[0].icons[0].top,CUR);
  await page.click('dialog.roc-studio >> details[data-panel="ico-0"] input[type="text"] >> nth=0');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.waitForTimeout(400);
  expect(await page.evaluate(C=>eval(C).work.rooms[0].icons[0].top,CUR)).toBe(before);
  // the embedded card: select, then drag the grip
  const el=await centreOf(page,'[data-el="e1"]');
  await page.mouse.click(el.x,el.y);await page.waitForTimeout(300);
  const g=await page.evaluate(C=>{const S=eval(C);const gr=S._card.shadowRoot.querySelector('[data-el="e1"] .roc-grip');const r=gr.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,shown:getComputedStyle(gr).display};},CUR);
  expect(g.shown).toBe('block');
  const cr=await contentRect(page);
  await page.mouse.move(g.x,g.y);await page.mouse.down();await page.mouse.move(g.x+cr.w*0.1,g.y,{steps:6});await page.mouse.up();await page.waitForTimeout(300);
  const left=await page.evaluate(C=>parseFloat(eval(C).work.rooms[0].elements[0].left),CUR);
  expect(left).toBeGreaterThan(13);expect(left).toBeLessThan(17);
});

// ---- Phase 3b (v6.43.0) ------------------------------------------------------------------------
test('Shift-click builds a multi-selection; dragging one moves them all; align and distribute',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(async C=>{const S=eval(C);S._setFrame('landscape');await new Promise(r=>setTimeout(r,300));},CUR);
  const z=await centreOf(page,'[data-z="z1"]'),i=await centreOf(page,'[data-ico="i1"]'),g=await centreOf(page,'[data-gauge="g1"]');
  await page.mouse.click(z.x,z.y);
  await page.keyboard.down('Shift');await page.mouse.click(i.x,i.y);await page.mouse.click(g.x,g.y);await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  const a=await page.evaluate(C=>{const S=eval(C);return{set:S._selSet().map(x=>x.id),chip:S._selBar.querySelector('.chip').textContent,aligns:!!S._selBar.querySelector('[data-act="al-left"]'),dist:!!S._selBar.querySelector('[data-act="dist-h"]'),
    marked:S._card._rocMarked.length};},CUR);
  expect(a.set.sort()).toEqual(['g1','i1','z1']);expect(a.chip).toBe('3 selected');expect(a.aligns&&a.dist).toBe(true);expect(a.marked).toBe(2);
  // drag the zone: the icon and the gauge follow by the same amount
  const before=await page.evaluate(C=>{const S=eval(C);const r=S.work.rooms[0];return{z:parseFloat(r.zones[0].left),i:parseFloat(r.icons[0].left),g:parseFloat(r.gauges[0].left)};},CUR);
  const cr=await contentRect(page);
  await page.mouse.move(z.x,z.y);await page.mouse.down();await page.mouse.move(z.x+cr.w*0.05,z.y,{steps:6});await page.mouse.up();await page.waitForTimeout(300);
  const after=await page.evaluate(C=>{const S=eval(C);const r=S.work.rooms[0];return{z:parseFloat(r.zones[0].left),i:parseFloat(r.icons[0].left),g:parseFloat(r.gauges[0].left),set:S._selSet().length};},CUR);
  const dz=after.z-before.z;
  expect(dz).toBeGreaterThan(3);
  expect(Math.abs((after.i-before.i)-dz)).toBeLessThan(0.11);expect(Math.abs((after.g-before.g)-dz)).toBeLessThan(0.11);
  expect(after.set).toBe(3);
  // align the top edges, measured on screen
  await page.evaluate(C=>{const S=eval(C);S._selBar.querySelector('[data-act="al-top"]').click();},CUR);await page.waitForTimeout(300);
  const tops=await page.evaluate(C=>{const S=eval(C);return['[data-z="z1"]','[data-ico="i1"]','[data-gauge="g1"]'].map(q=>S._card.shadowRoot.querySelector(q).getBoundingClientRect().top);},CUR);
  expect(Math.max(...tops)-Math.min(...tops)).toBeLessThan(cr.h*0.002+1);
  // distribute horizontally: equal gaps between the three boxes
  await page.evaluate(C=>{const S=eval(C);S._selBar.querySelector('[data-act="dist-h"]').click();},CUR);await page.waitForTimeout(300);
  const gaps=await page.evaluate(C=>{const S=eval(C);const b=['[data-z="z1"]','[data-ico="i1"]','[data-gauge="g1"]'].map(q=>S._card.shadowRoot.querySelector(q).getBoundingClientRect()).sort((p,q)=>p.left-q.left);return[b[1].left-b[0].right,b[2].left-b[1].right];},CUR);
  expect(Math.abs(gaps[0]-gaps[1])).toBeLessThan(cr.w*0.002+1);
  // one undo per operation
  const u=await page.evaluate(C=>eval(C).undoStack.length,CUR);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(C=>eval(C).undoStack.length,CUR)).toBe(u-1);
});

test('hide and lock a layer on the canvas; Ctrl+A skips them',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.click('dialog.roc-studio >> [data-act="hide-icon"]');
  const h=await page.evaluate(C=>{const S=eval(C);const e=S._card.shadowRoot.querySelector('[data-ico="i1"]');return{disp:getComputedStyle(e).display,cfg:S.work.rooms[0].icons.length,dirty:S._dirty()};},CUR);
  expect(h).toEqual({disp:'none',cfg:1,dirty:false});           // view only — nothing changes in the config
  await page.click('dialog.roc-studio >> [data-act="lock-zone"]');
  const z=await centreOf(page,'[data-z="z1"]');
  await page.mouse.click(z.x,z.y);await page.waitForTimeout(200);
  expect(await page.evaluate(C=>{const S=eval(C);return S.sel&&S.sel.id;},CUR)).not.toBe('z1');
  await page.evaluate(C=>eval(C)._dlg.focus(),CUR);
  await page.keyboard.press('Control+a');
  const all=await page.evaluate(C=>eval(C)._selSet().map(x=>x.type),CUR);
  expect(all).not.toContain('icon');expect(all).not.toContain('zone');expect(all).toContain('gauge');
  // survives a canvas re-render (room switch and back)
  await page.evaluate(C=>{const S=eval(C);S._setRoom(1,false,'toolbar');S._setRoom(0,false,'toolbar');},CUR);
  expect(await page.evaluate(C=>{const S=eval(C);return getComputedStyle(S._card.shadowRoot.querySelector('[data-ico="i1"]')).display;},CUR)).toBe('none');
});

test('duplicate, copy / paste and delete a room from the outline',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.click('dialog.roc-studio >> [data-act="room-dup"]');
  const a=await page.evaluate(C=>{const S=eval(C);return{rooms:S.work.rooms.map(r=>[r.id,r.name]),idx:S.roomIdx,zones:(S.work.rooms[1].zones||[]).length};},CUR);
  expect(a.rooms.map(r=>r[0])).toEqual(['a','a_2','b']);expect(a.rooms[1][1]).toBe('Living (copy)');expect(a.idx).toBe(1);expect(a.zones).toBe(1);
  await page.click('dialog.roc-studio >> [data-act="room-copy"]');
  await page.click('dialog.roc-studio >> [data-act="room-paste"]');
  expect(await page.evaluate(C=>eval(C).work.rooms.map(r=>r.id),CUR)).toEqual(['a','a_2','b','a_3']);
  await page.click('dialog.roc-studio >> [data-act="room-del"]');
  await page.click('dialog.roc-studio >> [data-act="room-del-ok"]');
  expect(await page.evaluate(C=>eval(C).work.rooms.map(r=>r.id),CUR)).toEqual(['a','a_2','b']);
});

test('gauges and blinds can be clicked and resized on the canvas (they ignore the pointer outside Edit mode)',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  const bl=await centreOf(page,'[data-gauge="__bl_b1"]');
  await page.mouse.click(bl.x,bl.y);await page.waitForTimeout(200);
  expect(await page.evaluate(C=>eval(C).sel,CUR)).toEqual({type:'blind',id:'b1'});
  const h=await page.evaluate(C=>{const S=eval(C);const hs=[...S._card.shadowRoot.querySelectorAll('[data-gauge="__bl_b1"] .roc-rh')].map(x=>x.getBoundingClientRect());const se=hs.reduce((a,b)=>b.right+b.bottom>a.right+a.bottom?b:a);return{x:se.left+se.width/2,y:se.top+se.height/2};},CUR);
  const cr=await contentRect(page);
  const w0=await page.evaluate(C=>parseFloat(eval(C).work.rooms[0].blinds[0].width),CUR);
  await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x+cr.w*0.05,h.y+cr.h*0.05,{steps:5});await page.mouse.up();await page.waitForTimeout(300);
  const w1=await page.evaluate(C=>parseFloat(eval(C).work.rooms[0].blinds[0].width),CUR);
  expect(w1-w0).toBeGreaterThan(3);
});

// ---- room switch (v6.43.0 fix) -----------------------------------------------------------------
test('wheel room switch: the old room does not linger and the slide is never cut short (slow embedded cards)',async({page})=>{
  await page.goto(base+'/switch');
  await page.waitForFunction(()=>window.__card&&window.__card._rendered);await page.waitForTimeout(600);
  const r=await page.evaluate(async()=>{
    window.__heavy=150;const c=window.__card;const made0=window.__made;
    const out=[];let run=true;const t0=performance.now();
    (function f(){const cs=[...c.shadowRoot.querySelectorAll('.wrap > .content')];
      const g=cs.find(x=>x.style.zIndex==='600'),n=cs.find(x=>x.style.zIndex!=='600');
      const tx=e=>{if(!e)return null;const t=getComputedStyle(e).transform;return t==='none'?0:new DOMMatrix(t).m41;};
      out.push({t:performance.now()-t0,g:tx(g),n:tx(n)});if(run)requestAnimationFrame(f);})();
    const wr=c.shadowRoot.querySelector('.wrap').getBoundingClientRect();
    c.shadowRoot.querySelector('.wrap').dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true,composed:true,clientX:wr.left+50,clientY:wr.top+50}));
    await new Promise(r=>setTimeout(r,1000));run=false;
    return{out,room:c._roomIdx,made:window.__made-made0,w:wr.width};
  });
  expect(r.room).toBe(1);
  // embedded cards are built once for the new room — the ghost no longer builds a second copy
  expect(r.made).toBe(1);
  // the slide is already well under way at the first frame after the slow card blocked the page
  const firstMoved=r.out.find(x=>x.n!==null&&x.n<r.w*0.98);
  expect(firstMoved.t).toBeLessThan(280);
  // the ghost never disappears before the new room has arrived
  const cut=r.out.find(x=>x.g===null&&x.n!==null&&Math.abs(x.n)>1);
  expect(cut).toBeUndefined();
});

// ---- Phase 4a (v6.44.0): the Properties form -----------------------------------------------------
const PF='dialog.roc-studio >> .props';
test('Properties: a canvas click shows the element\'s form; a typed value moves it on the canvas; Tab keeps the form',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  const ic=await centreOf(page,'[data-ico="i1"]');
  await page.mouse.click(ic.x,ic.y);await page.waitForTimeout(200);
  const a=await page.evaluate(C=>{const S=eval(C);return{tab:S.tab,title:S._propsPane.querySelector('.pf-title').textContent,edHidden:S._edPane.hidden};},CUR);
  expect(a).toEqual({tab:'props',title:'i1',edHidden:true});
  await page.evaluate(C=>{window.__form=eval(C)._propsPane.firstChild;},CUR);
  await page.fill(PF+' .pf-field[data-key="top"] input','30%');await page.keyboard.press('Tab');await page.waitForTimeout(300);
  const b=await page.evaluate(C=>{const S=eval(C);const ae=S._sr.activeElement;const f=ae&&ae.closest('.pf-field');
    return{top:S.work.rooms[0].icons[0].top,same:S._propsPane.firstChild===window.__form,focus:f&&f.dataset.key};},CUR);
  expect(b).toEqual({top:'30%',same:true,focus:'left'});
  const after=await centreOf(page,'[data-ico="i1"]'),cr=await contentRect(page);
  expect(after.y).toBeLessThan(ic.y-cr.h*0.2);                     // 60 % → 30 %: it moved up on the canvas
  await page.keyboard.press('Control+z');await page.waitForTimeout(200);
  // Ctrl+Z in a field with nothing typed = the studio's undo; the form follows, the focus stays put
  expect(await page.evaluate(C=>{const S=eval(C);const ae=S._sr.activeElement;return[S.work.rooms[0].icons[0].top,S._propsPane.querySelector('.pf-field[data-key="top"] input').value,ae&&ae.closest('.pf-field')&&ae.closest('.pf-field').dataset.key];},CUR)).toEqual(['60%','60%','left']);
});

test('entity picker: type to search, arrows + Enter pick; Escape closes the list, then leaves the field, then clears the selection',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(C=>eval(C)._select('gauge','g1','outline'),CUR);
  const ent=PF+' .pf-field[data-key="entity"] input';
  await page.click(ent);await page.fill(ent,'cov');await page.waitForTimeout(100);
  const l=await page.evaluate(C=>{const S=eval(C);const list=S._propsPane.querySelector('.pf-field[data-key="entity"] .rs-list');const r=list.getBoundingClientRect(),ir=S._insp.getBoundingClientRect();
    return{shown:r.height>20,inside:r.left>=ir.left-1&&r.right<=ir.right+1,rows:[...list.querySelectorAll('.o-sub')].map(x=>x.textContent)};},CUR);
  expect(l).toEqual({shown:true,inside:true,rows:['cover.x']});
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.waitForTimeout(150);
  expect(await page.evaluate(C=>eval(C).work.rooms[0].gauges[0].entity,CUR)).toBe('cover.x');
  await page.fill(ent,'la');await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  const e1=await page.evaluate(C=>{const S=eval(C);return{open:!!S._sr.querySelector('.rs-pick.open'),sel:S.sel&&S.sel.id,focus:!!(S._sr.activeElement&&S._sr.activeElement.closest('.pf-field'))};},CUR);
  expect(e1).toEqual({open:false,sel:'g1',focus:true});
  await page.keyboard.press('Escape');
  expect(await page.evaluate(C=>{const S=eval(C);return{sel:S.sel&&S.sel.id,focus:!!(S._sr.activeElement&&S._sr.activeElement.closest('.pf-field'))};},CUR)).toEqual({sel:'g1',focus:false});
  await page.keyboard.press('Escape');
  expect(await page.evaluate(C=>{const S=eval(C);return{sel:S.sel,dlg:!!document.querySelector('dialog.roc-studio')};},CUR)).toEqual({sel:null,dlg:true});
});

test('icon picker searches Home Assistant\'s own icon list; the action builder writes a valid action',async({page})=>{
  let hits=0;
  await page.route('**/static/mdi/iconList.json',r=>{hits++;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{name:'lamp',keywords:['light']},{name:'sofa',keywords:['couch']},{name:'sofa-outline',keywords:['couch']}])});});
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(C=>eval(C)._select('icon','i1','outline'),CUR);
  const ii=PF+' .pf-field[data-key="icon"] input';
  await page.click(ii);await page.fill(ii,'couch');await page.waitForTimeout(150);
  expect(await page.evaluate(C=>[...eval(C)._propsPane.querySelectorAll('.pf-field[data-key="icon"] .rs-opt .o-main')].map(x=>x.textContent),CUR)).toEqual(['mdi:sofa','mdi:sofa-outline']);
  await page.click(PF+' .pf-field[data-key="icon"] .rs-opt >> nth=1');await page.waitForTimeout(150);
  expect(await page.evaluate(C=>eval(C).work.rooms[0].icons[0].icon,CUR)).toBe('mdi:sofa-outline');
  expect(hits).toBe(1);
  await page.click(PF+' details[data-sec="actions"] > summary');
  await page.selectOption(PF+' .pf-field[data-key="tap_action"] select >> nth=0','toggle');
  const ent=PF+' .pf-field[data-key="tap_action"] .pf-actbody input';
  await page.fill(ent,'light.x');await page.keyboard.press('Tab');await page.waitForTimeout(150);
  expect(await page.evaluate(C=>eval(C).work.rooms[0].icons[0].tap_action,CUR)).toEqual({action:'toggle',entity:'light.x'});
});

test('validation is pinned: the field says what is wrong and the element is ringed on the canvas',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(C=>{const S=eval(C);const c=JSON.parse(JSON.stringify(S.work));c.rooms[0].zones[0].width='wide';S._commit(c,'test');S._select('zone','z1','outline');},CUR);
  await page.waitForTimeout(400);
  const r=await page.evaluate(C=>{const S=eval(C);const f=S._propsPane.querySelector('.pf-field[data-key="width"]');const m=f.querySelector('.pf-msg.v');
    return{msg:m&&m.textContent,visible:!!m&&m.getBoundingClientRect().height>0,dot:!!S._olList.querySelector('[data-id="z1"] .vd.error'),ring:getComputedStyle(S._card.shadowRoot.querySelector('[data-z="z1"]')).boxShadow};},CUR);
  expect(r.msg).toMatch(/expected len/);expect(r.visible).toBe(true);expect(r.dot).toBe(true);
  expect(r.ring).toContain('rgb(219, 68, 55)');
  await page.fill(PF+' .pf-field[data-key="width"] input','25%');await page.keyboard.press('Tab');await page.waitForTimeout(400);
  const r2=await page.evaluate(C=>{const S=eval(C);return{msg:!!S._propsPane.querySelector('.pf-field[data-key="width"] .pf-msg.v'),ring:getComputedStyle(S._card.shadowRoot.querySelector('[data-z="z1"]')).boxShadow};},CUR);
  expect(r2.msg).toBe(false);expect(r2.ring).not.toContain('rgb(219, 68, 55)');
});


test('screenshot: the Properties form (visual check, not an assertion)',async({page})=>{
  await page.goto(base+'/');await ready(page);await openFromCard(page);
  await page.evaluate(C=>{const S=eval(C);const c=JSON.parse(JSON.stringify(S.work));c.rooms[0].gauges[0].height='tall';S._commit(c,'test');S._select('gauge','g1','outline');S._propsOpen.add('actions');S._syncProps(true);},CUR);
  await page.waitForTimeout(400);
  const ent=PF+' .pf-field[data-key="entity"] input';await page.click(ent);await page.fill(ent,'x');await page.waitForTimeout(150);
  if(process.env.ROC_SHOT)await page.screenshot({path:process.env.ROC_SHOT});
});
