// Real-renderer geometry tests (Playwright) against tests/harness/ha-shell.html.
// jsdom has no layout engine — these assert PIXELS: the whole 4.6.x saga
// (card taller than viewport, clipped corner badge, letterboxing, edit-mode
// transitions, breathing loop) stays fixed.
// Run: npm run test:e2e   (npx playwright install chromium first)
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');

const HARNESS='file://'+path.join(__dirname,'harness','ha-shell.html').replace(/\\/g,'/');

async function geo(page){return page.evaluate(()=>window.__harness.geo());}
async function settle(page,ms){await page.waitForTimeout(ms||400);}

test.beforeEach(async({page})=>{
  await page.goto(HARNESS);
  await page.waitForFunction(()=>window.__harness&&window.__harness.geo().rendered===true);
  await settle(page,600); // post-render settle re-pin (250ms) + slack
});

test('card fills the viewport exactly, no page overflow, badge visible',async({page})=>{
  const g=await geo(page);
  expect(g.pageOverflow).toBeLessThanOrEqual(1);
  expect(Math.abs(g.card.b-g.innerH)).toBeLessThanOrEqual(2); // card bottom == viewport bottom
  expect(g.badge).not.toBeNull();
  expect(g.badge.b).toBeLessThanOrEqual(g.innerH);            // corner badge fully visible
  expect(g.badge.t).toBeGreaterThanOrEqual(0);
});

test('short window: image letterboxes (aspect kept, centred), badge stays visible',async({page})=>{
  await page.setViewportSize({width:1280,height:520});
  await settle(page,600);
  const g=await geo(page);
  expect(g.pageOverflow).toBeLessThanOrEqual(1);
  // wrap keeps the design aspect within 2%
  const aspect=g.wrap.w/g.wrap.h;
  expect(Math.abs(aspect-1720/914)).toBeLessThan(0.04);
  // letterbox: wrap narrower than viewport and centred within 3px
  expect(g.wrap.w).toBeLessThan(g.innerW-10);
  expect(Math.abs(g.wrap.l-(g.innerW-g.wrap.r))).toBeLessThanOrEqual(3);
  expect(g.badge.b).toBeLessThanOrEqual(g.innerH);
});

test('light glow: real blended layer, centred on its point, no filter over it',async({page})=>{
  const g=await page.evaluate(()=>{
    const card=document.querySelector('room-overlay-card');
    const el=card.shadowRoot.querySelector('[data-glow="lamp"]');
    if(!el)return null;
    const fx=el.querySelector('.glow-fx');
    const cs=getComputedStyle(el),fcs=getComputedStyle(fx);
    const r=el.getBoundingClientRect();
    const wr=card.shadowRoot.querySelector('.wrap').getBoundingClientRect();
    return{blend:cs.mixBlendMode,opacity:parseFloat(cs.opacity),w:r.width,h:r.height,
      cx:((r.left+r.right)/2-wr.left)/wr.width,cy:((r.top+r.bottom)/2-wr.top)/wr.height,
      bg:fcs.backgroundImage,filters:cs.filter+'|'+fcs.filter,
      inWrap:card.shadowRoot.querySelector('.content').contains(el)};
  });
  expect(g).not.toBeNull();
  expect(g.blend).toBe('screen');            // really blending in Chromium, not just declared
  expect(g.opacity).toBeGreaterThan(0.8);    // light on at full brightness → intensity 0.85
  expect(g.w).toBeGreaterThan(10);
  expect(Math.abs(g.w-g.h)).toBeLessThanOrEqual(1);   // circle, height derived from width
  expect(Math.abs(g.cx-0.30)).toBeLessThan(0.01);     // top/left is the CENTRE of the glow
  expect(Math.abs(g.cy-0.45)).toBeLessThan(0.01);
  expect(g.bg).toContain('radial-gradient');
  expect(g.filters).toBe('none|none');       // never a filter over a blended layer (v6.5.1)
  expect(g.inWrap).toBe(true);               // same stacking context as the photo it blends with
});

test('edit enter: actions bar fully visible without scrolling',async({page})=>{
  await page.evaluate(()=>window.__harness.toggle());
  await settle(page,600);
  const g=await geo(page);
  expect(g.bar).not.toBeNull();
  expect(g.bar.b).toBeLessThanOrEqual(g.innerH+1); // bar reachable without scroll
  expect(g.badge.b).toBeLessThanOrEqual(g.innerH);
});

test('edit exit: card re-expands to full height without reload or swipe',async({page})=>{
  const before=await geo(page);
  await page.evaluate(()=>window.__harness.toggle());   // enter
  await settle(page,600);
  const inEdit=await geo(page);
  expect(inEdit.cardH).toBeLessThan(before.cardH);      // edit reserves space
  await page.evaluate(()=>window.__harness.toggle());   // exit
  await settle(page,600);
  const after=await geo(page);
  expect(Math.abs(after.cardH-before.cardH)).toBeLessThanOrEqual(2);
  expect(Math.abs(after.card.b-after.innerH)).toBeLessThanOrEqual(2);
  expect(after.pageOverflow).toBeLessThanOrEqual(1);
});

test('no breathing: height is stable over idle time',async({page})=>{
  const samples=[];
  for(let i=0;i<6;i++){samples.push((await geo(page)).cardH);await settle(page,450);}
  const uniq=[...new Set(samples)];
  expect(uniq.length).toBe(1); // pinned height never oscillates
});

test('window resize re-pins',async({page})=>{
  const g1=await geo(page);
  await page.setViewportSize({width:1280,height:900});
  await settle(page,600);
  const g2=await geo(page);
  expect(g2.cardH).not.toBe(g1.cardH);
  expect(Math.abs(g2.card.b-g2.innerH)).toBeLessThanOrEqual(2);
  expect(g2.pageOverflow).toBeLessThanOrEqual(1);
});
