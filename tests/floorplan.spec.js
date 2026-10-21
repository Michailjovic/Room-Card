// Floor plan page in a real browser (v6.47.0, V7_PLAN §10 e2e row). jsdom (tests/floorplan.test.js)
// covers geometry, themes, bindings and the import logic; this covers what only a renderer can show:
// the lazy import of room-overlay-card-floorplan.js from the card's own URL, real layout and SVG
// text measuring, pointer taps / holds on the plan, the zoom into a room and back, and editing the
// plan on the studio's canvas (select, drag a corner, draw, doors, delete, undo, the AnyVac import).
// Run: npm run test:e2e
'use strict';
const {test,expect}=require('@playwright/test');
const http=require('http');
const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..');
const CARD=process.env.ROC_CARD||path.join(ROOT,'room-overlay-card.js');
const STUDIO=process.env.ROC_STUDIO||path.join(ROOT,'room-overlay-card-studio.js');
const FLOOR=process.env.ROC_FLOORPLAN||path.join(ROOT,'room-overlay-card-floorplan.js');
const VER=require('../package.json').version;
let server,base;
const requests=[];
test.beforeAll(async()=>{
  server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://x');requests.push(u.pathname+u.search);
    const map={'/':path.join(__dirname,'harness','floorplan-shell.html'),'/floorplan-data.json':path.join(__dirname,'harness','floorplan-data.json'),
      '/room-overlay-card.js':CARD,'/room-overlay-card-studio.js':STUDIO,'/room-overlay-card-floorplan.js':FLOOR};
    const f=map[u.pathname];
    if(!f||!fs.existsSync(f)){res.writeHead(404);res.end('nope');return;}
    res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':(f.endsWith('.json')?'application/json':'text/javascript'),'Cache-Control':'no-store'});
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  base='http://127.0.0.1:'+server.address().port;
});
test.afterAll(()=>server&&server.close());
const plan=page=>page.waitForFunction(()=>{const c=window.__h&&window.__h.card;return!!(c&&c._fpInst&&c._fpInst.W>2&&c.shadowRoot.querySelector('[data-rfp-hit]'));});
// the client point of plan coordinates (metres) on the dashboard card
const ptCard=(page,x,y)=>page.evaluate(([x,y])=>{const v=window.__h.card._fpInst;const l=v.toLocal(x,y,0);const r=v.svg.getBoundingClientRect();return{x:r.left+l[0]*r.width/v.W,y:r.top+l[1]*r.height/v.H};},[x,y]);
const center=(page,k)=>page.evaluate(k=>{const v=window.__h.card._fpInst;const p=v.M.rooms[k].pole;const l=v.toLocal(p[0],p[1],0);const r=v.svg.getBoundingClientRect();return{x:r.left+l[0]*r.width/v.W,y:r.top+l[1]*r.height/v.H+30};},k);
const SG='customElements.get("room-overlay-card")._rocStudio.Studio.current';
async function openStudio(page){
  await page.evaluate(async v=>{await import('/room-overlay-card-studio.js?hacstag=777&v='+v);await customElements.get('room-overlay-card')._rocStudio.open({card:window.__h.card,hass:window.__h.hass});},VER);
  await page.waitForFunction(()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;return!!(S&&S._fpView&&S.G&&S._fpView.W>2);});
}
const ptStudio=(page,x,y)=>page.evaluate(([x,y])=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;const v=S._fpView;const l=v.toLocal(x,y,0);const r=v.svg.getBoundingClientRect();return{x:r.left+l[0]*r.width/v.W,y:r.top+l[1]*r.height/v.H};},[x,y]);
const fpc=page=>page.evaluate(()=>JSON.parse(JSON.stringify(customElements.get('room-overlay-card')._rocStudio.Studio.current._fpCfg())));

test('the renderer is imported from the card\'s URL only when a floor plan page is shown',async({page})=>{
  requests.length=0;
  await page.goto(base+'/?start=living_room');
  await page.waitForFunction(()=>window.__h&&window.__h.card._rendered===true);
  await page.waitForTimeout(200);
  expect(requests.some(r=>r.startsWith('/room-overlay-card-floorplan.js'))).toBe(false);
  await page.evaluate(()=>window.__h.card._switchRoom(0,-1,true));
  await plan(page);
  await page.waitForFunction(()=>!window.__h.card._ovAnim); // the old room's frozen layer (with its strip) is gone
  expect(requests.filter(r=>r.startsWith('/room-overlay-card-floorplan.js'))).toEqual(['/room-overlay-card-floorplan.js?hacstag=777&v='+VER]);
  const r=await page.evaluate(()=>{const c=window.__h.card,S=c.shadowRoot;return{nav:!!S.querySelector('.roc-nav'),hits:S.querySelectorAll('[data-rfp-hit]').length,
    svg:S.querySelector('svg.rfp-svg').getBoundingClientRect().width,ver:customElements.get('room-overlay-card')._rocFloorplan.version};});
  expect(r).toMatchObject({nav:false,hits:5,ver:VER});expect(r.svg).toBeGreaterThan(1100);
});

test('live state: lights glow, heating pipes, labels sized to their text',async({page})=>{
  await page.goto(base+'/');await plan(page);
  const r=await page.evaluate(()=>{const S=window.__h.card.shadowRoot;const o=k=>parseFloat(S.querySelector('[data-rfp-light="'+k+'"]').getAttribute('opacity'));
    const chip=S.querySelector('[data-rfp-chip="0"]'),name=S.querySelector('[data-rfp-name="0"]');
    return{living:o(0),bed:o(4),heat:S.querySelector('[data-rfp-heat="0"]').getAttribute('class'),idle:S.querySelector('[data-rfp-heat="3"]').getAttribute('class'),
      chipW:parseFloat(chip.getAttribute('width')),textW:name.getComputedTextLength(),val:S.querySelector('[data-rfp-val="0"]').textContent};});
  expect(r.living).toBeGreaterThan(0.9);expect(r.bed).toBe(0);
  expect(r.heat).toBe('rfp-heat is-heat');expect(r.idle).toBe('rfp-heat is-idle');
  expect(r.chipW).toBeGreaterThan(r.textW);expect(r.chipW).toBeLessThan(r.textW+60);
  expect(r.val).toBe('23.1° · 53 %');
  await page.evaluate(()=>{const h=window.__h.hass,c=window.__h.card;const st=Object.assign({},h.states);st['light.bed']={state:'on',attributes:{brightness:255}};c.hass=Object.assign({},h,{states:st});});
  await page.waitForFunction(()=>parseFloat(window.__h.card.shadowRoot.querySelector('[data-rfp-light="4"]').getAttribute('opacity'))===1);
});

test('tap a room zooms into it; the nav thumbnail zooms back; hold toggles the lights',async({page})=>{
  await page.goto(base+'/');await plan(page);
  const c=await center(page,4);
  await page.mouse.click(c.x,c.y);
  await page.waitForTimeout(120);
  const mid=await page.evaluate(()=>{const c=window.__h.card;const img=c.shadowRoot.querySelector('.roc-reg[data-reg="image"]');return{idx:c._roomIdx,anim:!!c._ovAnim,tf:img.style.transform};});
  expect(mid.idx).toBe(5);expect(mid.anim).toBe(true);expect(mid.tf).toMatch(/scale/);
  await page.waitForTimeout(900);
  expect(await page.evaluate(()=>!window.__h.card._ovAnim&&!window.__h.card._fpActive)).toBe(true);
  await page.evaluate(()=>window.__h.card.shadowRoot.querySelector('.roc-thumb[data-thumb="0"]').click());
  await page.waitForTimeout(100);
  expect(await page.evaluate(()=>{const c=window.__h.card;return c._roomIdx===0&&c._fpActive&&!!c._ovAnim;})).toBe(true);
  await page.waitForTimeout(900);await plan(page);
  const h=await center(page,0);
  await page.mouse.move(h.x,h.y);await page.mouse.down();await page.waitForTimeout(700);await page.mouse.up();
  const calls=await page.evaluate(()=>window.__calls);
  expect(calls).toEqual([['homeassistant','toggle',{},{entity_id:'light.living'}]]);
  expect(await page.evaluate(()=>window.__h.card._roomIdx)).toBe(0);
});

test('every theme renders in the browser without errors',async({page})=>{
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto(base+'/');await plan(page);
  for(const th of ['night','clay','neon','blueprint','thermal','tiles','sketch']){
    const n=await page.evaluate(th=>{const c=window.__h.card;const cfg=JSON.parse(JSON.stringify(window.__h.cfg));cfg.rooms[0].floorplan.theme=th;c.setConfig(cfg);
      const S=c.shadowRoot;const b=S.querySelector('svg.rfp-svg').getBBox();return{hit:S.querySelectorAll(th==='tiles'?'[data-rfp-tile]':'[data-rfp-hit]').length,w:b.width,h:b.height};},th);
    expect(n.hit,th).toBe(5);expect(n.w,th).toBeGreaterThan(300);
  }
  expect(errs).toEqual([]);
});

test('studio: select, drag a corner, draw a room, place and delete a door, undo',async({page})=>{
  await page.goto(base+'/');await plan(page);await openStudio(page);
  const ol=await page.evaluate(SG=>{const S=eval(SG);return{rooms:S._olList.querySelectorAll('[data-fproom]').length,doors:S._olList.querySelectorAll('[data-fpdoor]').length,bar:!S._fpBar.hidden};},SG);
  expect(ol).toEqual({rooms:5,doors:4,bar:true});
  // select the living room on the canvas → its form
  let q=await ptStudio(page,2.5,3.5);await page.mouse.click(q.x,q.y);
  expect(await page.evaluate(SG=>{const S=eval(SG);return[S.fp.sel,S._propsTarget().kind,S._propsPane.querySelector('.pf-title').textContent];},SG)).toEqual([0,'fproom','Obývák']);
  // drag its top-left corner 0.5 m to the left
  const p0=(await fpc(page)).rooms[0].polygon[7];
  q=await ptStudio(page,p0[0],p0[1]);const q2=await ptStudio(page,p0[0]-0.5,p0[1]);
  await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q2.x,q2.y,{steps:6});await page.mouse.up();
  expect((await fpc(page)).rooms[0].polygon[7]).toEqual([-0.5,0.4]);
  await page.keyboard.press('Control+z');
  expect((await fpc(page)).rooms[0].polygon[7]).toEqual([0,0.4]);
  // draw a rectangle (snaps to 5 cm and to other corners)
  await page.evaluate(SG=>eval(SG)._fpTool('rect'),SG);
  q=await ptStudio(page,1.02,5.03);const q3=await ptStudio(page,3.98,6.21);
  await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q3.x,q3.y,{steps:6});await page.mouse.up();
  let f=await fpc(page);
  expect(f.rooms.length).toBe(6);expect(f.rooms[5].polygon).toEqual([[1,5.05],[4,5.05],[4,6.2],[1,6.2]]);
  expect(await page.evaluate(SG=>[eval(SG).fp.sel,eval(SG).fp.tool],SG)).toEqual([5,'select']);
  // a door on its top wall, then Delete removes it, Delete again the room
  await page.evaluate(SG=>eval(SG)._fpTool('door'),SG);
  q=await ptStudio(page,2.5,5.1);await page.mouse.click(q.x,q.y);
  f=await fpc(page);expect(f.openings.length).toBe(5);expect(f.openings[4]).toEqual({type:'door',at:[2.5,5.05],width:0.8});
  await page.keyboard.press('Delete');
  expect((await fpc(page)).openings.length).toBe(4);
  await page.evaluate(SG=>eval(SG)._fpSelect('room',5),SG);await page.keyboard.press('Delete');
  expect((await fpc(page)).rooms.length).toBe(5);
  // the canvas card shows the change (re-rendered from the config)
  expect(await page.evaluate(SG=>eval(SG)._card.shadowRoot.querySelectorAll('[data-rfp-hit]').length,SG)).toBe(5);
  // Escape: first leaves a tool, then clears the selection — the studio stays open
  await page.evaluate(SG=>eval(SG)._fpTool('poly'),SG);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(SG=>[eval(SG).fp.tool,!!document.querySelector('dialog.roc-studio')],SG)).toEqual(['select',true]);
});

test('markers and people (v6.48.0): a marker taps its light; studio places, drags, deletes a marker',async({page})=>{
  await page.goto(base+'/?items=1');await plan(page);
  const it=page.locator('room-overlay-card [data-rfp-item="0"]');
  await expect(it).toBeVisible();
  await expect(page.locator('room-overlay-card [data-rfp-item="1"]')).toHaveText(/^\d+[.,]\d°$/);
  // the person token sits in the kitchen
  const inKitchen=await page.evaluate(()=>{const c=window.__h.card,v=c._fpInst;const t=c.shadowRoot.querySelector('[data-rfp-person="0"]');const b=t.getBoundingClientRect(),r=v.roomRect(3),x=b.left+b.width/2,y=b.top+b.height/2;return t.getAttribute('opacity')==='1'&&x>r.left&&x<r.left+r.width&&y>r.top&&y<r.top+r.height;});
  expect(inKitchen).toBe(true);
  await page.evaluate(()=>{window.__calls.length=0;});
  await it.click();
  expect(await page.evaluate(()=>window.__calls.map(c=>c[1]+':'+(c[2]&&c[2].entity_id)))).toEqual(['toggle:light.hall']);
  expect(await page.evaluate(()=>window.__h.card._roomIdx)).toBe(0);
  // studio: the marker tool places one, select drags it, Delete removes it, Ctrl+Z brings it back
  await openStudio(page);
  expect(await page.evaluate(SG=>eval(SG)._olList.querySelectorAll('[data-fpitem]').length,SG)).toBe(2);
  await page.evaluate(SG=>eval(SG)._fpTool('marker'),SG);
  // Alt = no snapping (corners line up within 10 px otherwise)
  await page.keyboard.down('Alt');
  let q=await ptStudio(page,3,3);await page.mouse.click(q.x,q.y);
  let f=await fpc(page);
  expect(f.items.length).toBe(3);expect(f.items[2].type).toBe('marker');
  expect(Math.abs(f.items[2].at[0]-3)<0.03&&Math.abs(f.items[2].at[1]-3)<0.03).toBe(true);
  expect(await page.evaluate(SG=>[eval(SG).fp.item,eval(SG)._propsTarget().kind],SG)).toEqual([2,'fpitem']);
  await page.waitForTimeout(400); // the Properties pane opened: the canvas may re-fit
  q=await ptStudio(page,3,3);const q2=await ptStudio(page,3.5,3);
  await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q2.x,q2.y,{steps:6});await page.mouse.up();
  await page.keyboard.up('Alt');
  f=await fpc(page);
  expect(Math.abs(f.items[2].at[0]-3.5)<0.05&&Math.abs(f.items[2].at[1]-3)<0.05).toBe(true);
  await page.keyboard.press('Delete');
  expect((await fpc(page)).items.length).toBe(2);
  await page.keyboard.press('Control+z');
  expect((await fpc(page)).items.length).toBe(3);
});

test('studio: import an empty floor plan from the AnyVac map',async({page})=>{
  await page.goto(base+'/?empty=1');
  await page.waitForFunction(()=>window.__h&&window.__h.card._fpInst);
  await page.evaluate(async v=>{await import('/room-overlay-card-studio.js?hacstag=777&v='+v);await customElements.get('room-overlay-card')._rocStudio.open({card:window.__h.card,hass:window.__h.hass});},VER);
  await page.waitForFunction(()=>{const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;return!!(S&&S._fpView);});
  await page.evaluate(SG=>eval(SG)._fpImport(),SG);
  await page.waitForFunction(SG=>!!eval(SG)._app.querySelector('[data-fplink]'),SG);
  const links=await page.evaluate(SG=>[...eval(SG)._app.querySelectorAll('[data-fplink]')].map(s=>s.value),SG);
  expect(links).toEqual(['kitchen','bedroom','living_room','','bathroom']);
  await page.evaluate(SG=>{const s=eval(SG)._app.querySelector('[data-fplink$="_18"]');s.value='hall';s.dispatchEvent(new Event('change'));},SG);
  expect(await page.evaluate(SG=>eval(SG)._app.querySelectorAll('.fpimp-prev polygon').length,SG)).toBe(5);
  await page.evaluate(SG=>eval(SG)._app.querySelector('[data-act="fp-import-ok"]').click(),SG);
  const f=await fpc(page);
  expect(f.rooms.map(r=>r.room)).toEqual(['kitchen','bedroom','living_room','hall','bathroom']);
  expect(f.rooms.map(r=>r.polygon.length)).toEqual([10,10,8,4,4]);
  expect(f.rooms[2]).toMatchObject({lights:'light.living',climate:'climate.living',humidity:'sensor.living_room_h_humidity',floor:'wood'});
  expect(f.openings.length).toBe(4);
  expect(f.source).toMatchObject({anyvac:'sensor.kitchen_s8_anyvac_map',frame:'d4e8',origin_px:[800,752],mm_per_px:12.5});
  await page.waitForFunction(SG=>eval(SG)._card.shadowRoot.querySelectorAll('[data-rfp-hit]').length===5,SG);
  await page.keyboard.press('Control+z');
  expect((await fpc(page)).rooms).toBeUndefined();
});
