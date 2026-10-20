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

    // v6.24.1: a narrow (portrait-profile) viewport opens every panel over the WHOLE screen —
    // the image region there is often a strip a few hundred px tall. The pre-v6.24.1 contract
    // (panel inside the image) is still there, opt-in per section: placement_portrait: inline.
    test(placement+': panel covers the whole screen (narrow viewport, portrait default)',async({page})=>{
      await page.setViewportSize({width:375,height:700});
      await settle(page,500);
      await clickShadow(page,'[data-ico="'+launcher+'"]');
      const g=await panelGeo(page,secId);
      const ov=await geo(page);
      expect(g.open).toBe(true);
      expect(Math.abs(g.panel.l)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.panel.t)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.panel.r-375)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.panel.b-700)).toBeLessThanOrEqual(1);
      expect(ov.pageOverflow).toBeLessThanOrEqual(1);
    });

    test(placement+': placement_portrait: inline keeps the panel within the room image (narrow viewport)',async({page})=>{
      await page.setViewportSize({width:375,height:700});
      await settle(page,500);
      await page.evaluate(()=>{
        const card=window.__harness.card;
        const c=JSON.parse(JSON.stringify(card._config));
        (c.sections||[]).forEach(function(s){s.placement_portrait='inline';});
        card.setConfig(c);
      });
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

// Overview page (v6.30.0, OVERVIEW_PLAN.md §7) — real-layout checks: the five
// regions collapse into the grid, phones keep header + dock in view while the
// grid scrolls, and the tile ↔ room zoom ends exactly in the plain room view.
test.describe('overview page (v6.30.0)',()=>{
  // Turn the harness config into one with an overview page in front.
  async function ovConfig(page,ov,extra){
    await page.evaluate(({ov,extra})=>{
      const card=window.__harness.card;
      const c=JSON.parse(JSON.stringify(card._config));
      c.layout={landscape:{rows:['auto','1fr'],place:{nav:{row:1},image:{row:2}}},portrait:{rows:['auto','auto'],place:{nav:{row:1},image:{row:2}}}};
      c.nav={style:'thumbnails',live:'full'};
      c.rooms=c.rooms.filter(r=>!r.overview);
      c.rooms.forEach(r=>{r.light_controls={entities:['light.harness']};});
      // four rooms so the grid has two rows on a phone
      c.rooms.push(Object.assign(JSON.parse(JSON.stringify(c.rooms[1])),{id:'hall',name:'Hall'}));
      c.rooms.push(Object.assign(JSON.parse(JSON.stringify(c.rooms[1])),{id:'bath',name:'Bath'}));
      c.rooms.unshift({id:'overview',name:'Overview',overview:ov});
      Object.assign(c,extra||{});
      card._roomIdx=0;
      card.setConfig(c);
    },{ov,extra});
    await settle(page,700);
  }
  const geoOv=page=>page.evaluate(()=>{
    const sr=window.__harness.card.shadowRoot;
    const rb=el=>{if(!el)return null;const b=el.getBoundingClientRect();return{t:b.top,b:b.bottom,l:b.left,r:b.right,w:b.width,h:b.height};};
    const grid=sr.querySelector('[data-ov-grid]');
    return{innerW:window.innerWidth,innerH:window.innerHeight,
      pageOverflow:document.documentElement.scrollHeight-window.innerHeight,
      card:rb(sr.querySelector('ha-card')),root:rb(sr.querySelector('[data-ov-root]')),grid:rb(grid),
      hd:rb(sr.querySelector('.roc-ov-hd')),left:rb(sr.querySelector('.roc-ov-left')),dock:rb(sr.querySelector('.roc-ov-dock')),
      tiles:[...sr.querySelectorAll('.roc-ovt')].map(rb),chip:rb(sr.querySelector('.roc-ovc')),
      gridScroll:grid?{sh:grid.scrollHeight,ch:grid.clientHeight}:null};
  });
  const ALL={header:{items:[{pill:{entity:'light.harness',icon:'mdi:lightbulb'}}]},left:{width:'25%',cards:[{card:{type:'markdown',content:'x'},height:'120px'}]},grid:{},dock:{}};

  test('wide: all regions inside the card, tiles inside the grid, dock fully visible',async({page})=>{
    await page.setViewportSize({width:1920,height:1080});
    await ovConfig(page,ALL);
    const g=await geoOv(page);
    expect(g.pageOverflow).toBeLessThanOrEqual(1);
    expect(Math.abs(g.card.b-g.innerH)).toBeLessThanOrEqual(2);
    expect(g.root.b).toBeLessThanOrEqual(g.card.b+1);
    expect(g.dock.b).toBeLessThanOrEqual(g.innerH);
    expect(g.left.r).toBeLessThanOrEqual(g.grid.l);
    for(const t of g.tiles){expect(t.l).toBeGreaterThanOrEqual(g.grid.l-1);expect(t.r).toBeLessThanOrEqual(g.grid.r+1);expect(t.b).toBeLessThanOrEqual(g.grid.b+1);}
    expect(g.tiles.length).toBe(4);
  });

  test('wide: a region switched off gives its space to the grid',async({page})=>{
    await page.setViewportSize({width:1920,height:1080});
    await ovConfig(page,ALL);
    const a=await geoOv(page);
    await ovConfig(page,{grid:{}});
    const b=await geoOv(page);
    expect(b.left).toBeNull();expect(b.hd).toBeNull();expect(b.dock).toBeNull();
    expect(b.grid.w).toBeGreaterThan(a.grid.w+300);           // the left column's width
    expect(b.grid.h).toBeGreaterThan(a.grid.h+40);            // header + dock heights
    expect(Math.abs(b.grid.l-b.root.l)).toBeLessThanOrEqual(13); // only the padding left of it
  });

  for(const style of ['card','row']){
    test('phone ('+style+'): header and dock stay in view while the grid scrolls',async({page})=>{
      await page.setViewportSize({width:390,height:520});
      await ovConfig(page,Object.assign({},ALL,{grid:{style:{portrait:style}}}));
      const g=await geoOv(page);
      expect(g.pageOverflow).toBeLessThanOrEqual(1);
      expect(g.hd.t).toBeGreaterThanOrEqual(0);
      expect(g.dock.b).toBeLessThanOrEqual(g.innerH);
      expect(g.gridScroll.sh).toBeGreaterThan(g.gridScroll.ch);   // content scrolls inside the grid…
      await page.evaluate(()=>{window.__harness.card.shadowRoot.querySelector('[data-ov-grid]').scrollTop=9999;});
      const g2=await geoOv(page);
      expect(g2.dock.b).toBeCloseTo(g.dock.b,0);                // …and the dock does not move
      expect(g.chip.w).toBeGreaterThanOrEqual(44);              // touch target
      expect(g.chip.h).toBeGreaterThanOrEqual(44);
    });
  }

  test('phone: a dock launcher opens its section as a full-screen sheet over the overview',async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await ovConfig(page,ALL);
    await clickShadow(page,'[data-ico="__ovdock_sec_bottom"]');
    const p=await panelGeo(page,'sec_bottom');
    expect(p.open).toBe(true);
  });

  const roomState=page=>page.evaluate(()=>{
    const card=window.__harness.card,sr=card.shadowRoot;
    const reg=sr.querySelector('.roc-reg[data-reg="image"]');const r=reg.getBoundingClientRect();
    return{room:card._roomIdx,ov:card._ovActive,anim:!!card._ovAnim,kids:sr.querySelector('ha-card').children.length,
      reg:[r.left,r.top,r.width,r.height].map(Math.round),style:reg.style.cssText,
      wrapOverflow:getComputedStyle(sr.querySelector('.wrap')).overflow};
  });

  test('zoom: tile → room ends exactly in the plain room view, and back',async({page})=>{
    await page.setViewportSize({width:1600,height:900});
    // reference: the plain switch (no transition)
    await ovConfig(page,Object.assign({},ALL,{transition:'none'}));
    await clickShadow(page,'.roc-ovt[data-ovt="1"]');
    const ref=await roomState(page);
    await ovConfig(page,Object.assign({},ALL,{transition_duration:300}));
    await page.evaluate(()=>window.__harness.card.shadowRoot.querySelector('.roc-ovt[data-ovt="1"]').click());
    await settle(page,900);
    const z=await roomState(page);
    expect(z.room).toBe(1);expect(z.anim).toBe(false);
    expect(z.kids).toBe(1);                        // frozen overview removed
    expect(z.reg).toEqual(ref.reg);                // same geometry as a plain switch
    expect(z.style).toBe(ref.style);               // every inline style the zoom set is gone
    expect(z.wrapOverflow).toBe('hidden');
    // back to the overview through its thumbnail: shrink into the tile
    await page.evaluate(()=>window.__harness.card.shadowRoot.querySelector('.roc-thumb[data-thumb="0"]').click());
    await settle(page,900);
    const back=await page.evaluate(()=>{const card=window.__harness.card,sr=card.shadowRoot;
      const ph=sr.querySelector('.roc-ovt[data-ovt="1"] .roc-ovt-ph');const root=sr.querySelector('[data-ov-root]');
      return{ov:card._ovActive,kids:sr.querySelector('ha-card').children.length,phVis:getComputedStyle(ph).visibility,rootStyle:root.style.opacity+'|'+root.style.transform};});
    expect(back.ov).toBe(true);expect(back.kids).toBe(1);
    expect(back.phVis).toBe('visible');
    expect(back.rootStyle).toBe('|');
  });

  test('zoom: a second switch mid-animation lands in a clean final state',async({page})=>{
    await page.setViewportSize({width:1600,height:900});
    await ovConfig(page,Object.assign({},ALL,{transition_duration:2000}));
    await page.evaluate(()=>window.__harness.card.shadowRoot.querySelector('.roc-ovt[data-ovt="1"]').click());
    await settle(page,300);
    await page.evaluate(()=>window.__harness.card._switchRoom(2,1,true));
    await settle(page,500);
    const s=await roomState(page);
    expect(s.room).toBe(2);expect(s.anim).toBe(false);expect(s.kids).toBe(1);
    expect(s.style).not.toContain('clip-path');expect(s.style).not.toContain('scale(');
  });

  // Measured in the dev container at 4x throttle: ~30 fps during the zoom, worst
  // frames 50 ms (two missed vsyncs). The bound below catches a real regression
  // (a re-render or a mini re-mount inside the animation) without flaking.
  test('zoom: smooth on a slow device (4x CPU throttle) — no stall, ~30 fps or better',async({page})=>{
    await page.setViewportSize({width:1280,height:800});
    await ovConfig(page,Object.assign({},ALL,{transition_duration:450}));
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const frames=await page.evaluate(()=>new Promise(res=>{
      const card=window.__harness.card;
      card.shadowRoot.querySelector('.roc-ovt[data-ovt="1"]').click();
      // measure from the first animated frame (the switch's own render is a
      // one-off cost before the zoom starts, same as any room switch)
      const t0=performance.now();const d=[];let last=0,started=false;
      const tick=now=>{
        if(!started){if(card._ovAnim&&card.shadowRoot.querySelector('.roc-reg[data-reg="image"]').style.clipPath){started=true;last=now;}}
        else{d.push(now-last);last=now;if(!card._ovAnim){res(d);return;}}
        if(now-t0<3000)requestAnimationFrame(tick);else res(d);
      };
      requestAnimationFrame(tick);
    }));
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    expect(frames.length).toBeGreaterThan(5);
    console.log('zoom frames (ms):',frames.map(x=>Math.round(x)).join(' '));
    expect(Math.max(...frames)).toBeLessThan(70);
    expect(frames.reduce((a,b)=>a+b,0)/frames.length).toBeLessThan(36);
  });
});

// v6.31.0: HA's <ha-card> is a Lit element — right after the card's innerHTML
// its shadow <slot> does not exist yet, so the children have no style/geometry
// and a transition started then jumps straight to its end (fade "did nothing").
// This stub reproduces that: the slot appears one task later, like Lit's update.
test.describe('overview transitions under a Lit-like ha-card (v6.31.0)',()=>{
  test.beforeEach(async({page})=>{
    await page.addInitScript(()=>{
      class LitLikeCard extends HTMLElement{
        constructor(){super();this.attachShadow({mode:'open'});
          let r;this.updateComplete=new Promise(x=>{r=x;});this._r=r;}
        connectedCallback(){
          if(this._done)return;this._done=true;const self=this;
          setTimeout(function(){self.shadowRoot.innerHTML='<style>:host{display:block}</style><slot></slot>';self._r(true);},20);
        }
      }
      customElements.define('ha-card',LitLikeCard);
    });
    await page.goto(HARNESS);
    await page.waitForFunction(()=>window.__harness&&window.__harness.geo().rendered===true);
    await settle(page,600);
  });
  async function ovCfg(page,ov){
    await page.evaluate(ov=>{
      const card=window.__harness.card;
      const c=JSON.parse(JSON.stringify(card._config));
      c.layout={landscape:{rows:['auto','1fr'],place:{nav:{row:1},image:{row:2}}},portrait:{rows:['auto','auto'],place:{nav:{row:1},image:{row:2}}}};
      c.nav={style:'thumbnails',live:'full'};
      c.rooms=c.rooms.filter(r=>!r.overview);
      c.rooms.unshift({id:'overview',name:'Overview',overview:ov});
      card._roomIdx=0;card.setConfig(c);
    },ov);
    await settle(page,700);
  }
  // Sample a value every frame while the animation runs.
  const sample=(page,fnSrc,start)=>page.evaluate(({fnSrc,start})=>new Promise(res=>{
    const card=window.__harness.card;const read=new Function('card','sr',fnSrc);
    new Function('card',start)(card);
    const out=[];const t0=performance.now();
    const tick=()=>{out.push(read(card,card.shadowRoot));
      if(performance.now()-t0<1600)requestAnimationFrame(tick);else res(out);};
    requestAnimationFrame(tick);
  }),{fnSrc,start});
  const mid=a=>a.filter(v=>typeof v==='number'&&v>0.08&&v<0.92).length;

  test('fade: tile → room actually fades (intermediate opacities)',async({page})=>{
    await page.setViewportSize({width:1600,height:900});
    await ovCfg(page,{grid:{},transition:'fade',transition_duration:800});
    const op=await sample(page,
      "const l=[...sr.querySelector('ha-card').children].find(e=>e.style&&e.style.zIndex==='5');return l?parseFloat(getComputedStyle(l).opacity):null;",
      "card.shadowRoot.querySelector('.roc-ovt[data-ovt=\"1\"]').click();");
    expect(mid(op)).toBeGreaterThan(5);
    await settle(page,400);
    const s=await page.evaluate(()=>{const c=window.__harness.card;return{room:c._roomIdx,anim:!!c._ovAnim,kids:c.shadowRoot.querySelector('ha-card').children.length};});
    expect(s).toEqual({room:1,anim:false,kids:1});
  });

  test('zoom: room → overview actually animates the overview in',async({page})=>{
    await page.setViewportSize({width:1600,height:900});
    await ovCfg(page,{grid:{},transition:'zoom',transition_duration:800});
    await page.evaluate(()=>window.__harness.card.shadowRoot.querySelector('.roc-ovt[data-ovt="1"]').click());
    await settle(page,1500);
    const op=await sample(page,
      "const r=sr.querySelector('[data-ov-root]');return r?parseFloat(getComputedStyle(r).opacity):null;",
      "card.shadowRoot.querySelector('.roc-thumb[data-thumb=\"0\"]').click();");
    expect(mid(op)).toBeGreaterThan(5);
    await settle(page,400);
    const s=await page.evaluate(()=>{const c=window.__harness.card,sr=c.shadowRoot;const r=sr.querySelector('[data-ov-root]');
      return{ov:c._ovActive,anim:!!c._ovAnim,kids:sr.querySelector('ha-card').children.length,rs:r.style.opacity+'|'+r.style.transform};});
    expect(s).toEqual({ov:true,anim:false,kids:1,rs:'|'});
  });

  test('zoom: tile → room scales the room up from the tile',async({page})=>{
    await page.setViewportSize({width:1600,height:900});
    await ovCfg(page,{grid:{},transition:'zoom',transition_duration:800});
    const sc=await sample(page,
      "const i=sr.querySelector('.roc-reg[data-reg=\"image\"]');if(!i||!card._ovAnim)return null;const m=new DOMMatrix(getComputedStyle(i).transform);return m.a;",
      "card.shadowRoot.querySelector('.roc-ovt[data-ovt=\"1\"]').click();");
    expect(sc.filter(v=>typeof v==="number"&&Math.abs(v-1)>0.002).length).toBeGreaterThan(5);   // scale animates from the tile size to 1
  });

  // A touchpad swipe is one long stream of wheel events (tiny ones first,
  // then momentum). Every one must be cancelled — Chrome turns an uncancelled
  // horizontal stream into a browser Back swipe (left the dashboard view in
  // v6.30.x when the swipe crossed the overview) — and one swipe = one room.
  test('wheel: a touchpad swipe across the overview is fully caught, one room per swipe',async({page})=>{
    await page.setViewportSize({width:1600,height:900});
    await ovCfg(page,{grid:{},transition:'zoom',transition_duration:450});
    await page.evaluate(()=>{const c=window.__harness.card;const cfg=JSON.parse(JSON.stringify(c._config));cfg.nav.wheel='horizontal';
      cfg.rooms.push(Object.assign(JSON.parse(JSON.stringify(cfg.rooms[1])),{id:'r3',name:'R3'}));c._roomIdx=1;c.setConfig(cfg);
      window.__wl=[];window.addEventListener('wheel',e=>{window.__wl.push(e.cancelable&&e.defaultPrevented);},{passive:true});});
    await settle(page,900);
    await page.mouse.move(900,500);
    const swipe=async dir=>{for(const d of [1,2,3,5,8,12,18,25,30,30,28,24,20,15,10,6,4,2,1,1,1,1]){await page.mouse.wheel(d*dir,0);await page.waitForTimeout(16);}};
    // (Playwright's wheel sign is the inverse of a touchpad's — only the
    // direction matters here: one swipe each way, through the overview)
    await swipe(-1);                                // room 1 → overview
    expect(await page.evaluate(()=>window.__harness.card._roomIdx)).toBe(0);
    await settle(page,700);
    await swipe(1);                                    // overview → room 1 (zoom out of the tile)
    expect(await page.evaluate(()=>window.__harness.card._roomIdx)).toBe(1);
    await settle(page,700);
    const wl=await page.evaluate(()=>window.__wl);
    expect(wl.length).toBeGreaterThan(30);
    expect(wl.filter(x=>!x).length).toBe(0);           // every event cancelable AND cancelled
    // a mouse wheel: separate notches still switch one room each
    await page.mouse.wheel(100,0);await settle(page,500);
    await page.mouse.wheel(100,0);await settle(page,500);
    expect(await page.evaluate(()=>window.__harness.card._roomIdx)).toBe(3);
    // over the nav strip: no room switch, but nothing reaches the page either
    const nb=await page.evaluate(()=>{const r=window.__harness.card.shadowRoot.querySelector('.roc-reg[data-reg="nav"]').getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};});
    await page.mouse.move(nb.x,nb.y);
    await page.evaluate(()=>{window.__wl=[];});
    await swipe(1);
    expect(await page.evaluate(()=>window.__harness.card._roomIdx)).toBe(3);
    expect(await page.evaluate(()=>window.__wl.filter(x=>!x).length)).toBe(0);
  });
});
