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
    // The card lives inside hui-panel-view's shadow root in this harness, so it
    // is NOT reachable from document.querySelector — use the handle the harness
    // exposes, like every other test here does through geo().
    const card=window.__harness.card;
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

// Cockpit sections & panels (v6.8.0) — COCKPIT_PLAN.md kap.7 "e2e (Playwright, real Chromium)":
// panel geometry at each placement at a wide and a narrow viewport; the panel does not overflow
// the card; the house remains visible behind sheet-right; Escape closes. The harness's shared
// CONFIG carries one launcher icon + one declared section per placement (sec_right/sec_bottom/
// sec_full/sec_dialog) — see tests/harness/ha-shell.html.
async function clickShadow(page,sel){
  await page.evaluate((s)=>{window.__harness.card.shadowRoot.querySelector(s).click();},sel);
  await settle(page,400);
}
async function panelGeo(page,secId){
  return page.evaluate((id)=>{
    const sr=window.__harness.card.shadowRoot;
    const rb=el=>{if(!el)return null;const b=el.getBoundingClientRect();
      return{t:b.top,b:b.bottom,l:b.left,r:b.right,w:b.width,h:b.height};};
    const panel=sr.querySelector('[data-section-panel="'+id+'"]');
    return{panel:rb(panel),open:panel?panel.classList.contains('open'):null,wrap:rb(sr.querySelector('.wrap'))};
  },secId);
}

const PLACEMENTS=[
  ['open_right','sec_right','sheet-right'],
  ['open_bottom','sec_bottom','sheet-bottom'],
  ['open_full','sec_full','full'],
  ['open_dialog','sec_dialog','dialog'],
];

test.describe('cockpit sections & panels (v6.8.0)',()=>{
  for(const[launcher,secId,placement]of PLACEMENTS){
    test(placement+': panel opens and stays within the room image (wide viewport)',async({page})=>{
      await clickShadow(page,'[data-ico="'+launcher+'"]');
      const g=await panelGeo(page,secId);
      const ov=await geo(page);
      expect(g.open).toBe(true);
      expect(g.panel).not.toBeNull();
      // never spills past the room image box (.wrap) — the panel's own containing block
      expect(g.panel.l).toBeGreaterThanOrEqual(g.wrap.l-1);
      expect(g.panel.r).toBeLessThanOrEqual(g.wrap.r+1);
      expect(g.panel.t).toBeGreaterThanOrEqual(g.wrap.t-1);
      expect(g.panel.b).toBeLessThanOrEqual(g.wrap.b+1);
      expect(ov.pageOverflow).toBeLessThanOrEqual(1);
    });

    test(placement+': panel opens and stays within the room image (narrow viewport)',async({page})=>{
      await page.setViewportSize({width:375,height:700});
      await settle(page,500);
      await clickShadow(page,'[data-ico="'+launcher+'"]');
      const g=await panelGeo(page,secId);
      const ov=await geo(page);
      expect(g.open).toBe(true);
      expect(g.panel.l).toBeGreaterThanOrEqual(g.wrap.l-1);
      expect(g.panel.r).toBeLessThanOrEqual(g.wrap.r+1);
      expect(g.panel.t).toBeGreaterThanOrEqual(g.wrap.t-1);
      expect(g.panel.b).toBeLessThanOrEqual(g.wrap.b+1);
      expect(ov.pageOverflow).toBeLessThanOrEqual(1);
    });
  }

  test('sheet-right: the house stays visible beside the panel, not covered by it',async({page})=>{
    await clickShadow(page,'[data-ico="open_right"]');
    const g=await panelGeo(page,'sec_right');
    expect(g.panel.l).toBeGreaterThan(g.wrap.l+40); // a real strip of the photo remains uncovered
  });

  test('sheet-bottom: the house stays visible above the panel, not covered by it',async({page})=>{
    await clickShadow(page,'[data-ico="open_bottom"]');
    const g=await panelGeo(page,'sec_bottom');
    expect(g.panel.t).toBeGreaterThan(g.wrap.t+40);
  });

  test('full: panel fills the whole room image, edge to edge',async({page})=>{
    await clickShadow(page,'[data-ico="open_full"]');
    const g=await panelGeo(page,'sec_full');
    expect(Math.abs(g.panel.l-g.wrap.l)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.panel.r-g.wrap.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.panel.t-g.wrap.t)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.panel.b-g.wrap.b)).toBeLessThanOrEqual(1);
  });

  test('Escape closes the open panel',async({page})=>{
    await clickShadow(page,'[data-ico="open_dialog"]');
    expect((await panelGeo(page,'sec_dialog')).open).toBe(true);
    await page.keyboard.press('Escape');
    await settle(page,400);
    expect((await panelGeo(page,'sec_dialog')).open).toBe(false);
  });

  test('only one panel is open at a time',async({page})=>{
    await clickShadow(page,'[data-ico="open_right"]');
    await clickShadow(page,'[data-ico="open_full"]');
    expect((await panelGeo(page,'sec_right')).open).toBe(false);
    expect((await panelGeo(page,'sec_full')).open).toBe(true);
  });
});

// Cockpit image tiles (v6.9.0) — real Chromium check that a tile overlay's
// transform/animation actually computes, not just an inline style string
// jsdom would accept uncritically (the harness's sec_right panel carries an
// image tile with a spin-transform overlay — see tests/harness/ha-shell.html).
test.describe('cockpit image tiles (v6.9.0)',()=>{
  test('an image tile stage renders with real geometry and its overlay actually spins',async({page})=>{
    await clickShadow(page,'[data-ico="open_right"]');
    const g=await page.evaluate(()=>{
      const sr=window.__harness.card.shadowRoot;
      const panel=sr.querySelector('[data-section-panel="sec_right"]');
      const stage=panel.querySelector('.roc-tile-img-stage');
      const base=panel.querySelector('.roc-tile-img-base');
      const ov=panel.querySelector('.roc-tile-ov');
      const sb=stage.getBoundingClientRect();
      const cs=getComputedStyle(ov);
      return{
        stageW:sb.width,stageH:sb.height,
        baseBg:getComputedStyle(base).backgroundImage,
        animName:cs.animationName,
        animDur:cs.animationDuration,
        transform:cs.transform
      };
    });
    expect(g.stageW).toBeGreaterThan(10);
    expect(g.stageH).toBeGreaterThan(10);
    expect(g.baseBg).toContain('data:image/svg+xml');
    expect(g.animName).toBe('roc-tf-spin');
    expect(g.animDur).toBe('0.5s');
  });
});
