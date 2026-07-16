# Room Overlay Card v4.6.0

## Viewport height engine rebuilt — scroll-container measurement

**One root cause, three symptoms.** If you ever saw (a) the card end up taller than the screen after Home Assistant's header settled, (b) no recalculation when entering dashboard edit mode (forcing you to scroll), or (c) a corner badge — say a bottom-left vacuum chip — sliding below the visible edge on *some* rooms after a swipe: they were all the same bug.

The `viewport` height pin measured the card's top offset **relative to the viewport** and skipped the measurement whenever the page was scrolled or the offset looked unusual. But a card pinned too tall is exactly what *causes* the page to scroll — so a single bad measurement locked itself in and could never recover. On top of that, every room switch re-rendered the card and reset its height to the CSS first-paint fallback (`calc(100svh - var(--header-height, 56px))`), which never matches HA's real header and view padding exactly — each switch rolled the dice again, which is why only *some* rooms looked broken.

### What changed

- **Scroll-independent measurement.** The card resolves HA's actual scroll container (nearest scrollable ancestor across shadow DOM boundaries, falling back to `documentElement`) and measures its offset against the scroller's *content* — rect diff plus `scrollTop` — instead of the viewport. The math stays valid while scrolled, in edit mode, and while the header settles. All bail-out conditions are gone.
- **The right ResizeObserver.** HA keeps `document.body` at a fixed height — the app scrolls *inside* it — so the 4.5.1 body observer never fired for header or toolbar changes. The card now observes the scroll container itself: header settling and edit-mode toolbars change its box and trigger an immediate re-pin. Two delayed re-pins (250 ms / 1.2 s) after each render catch late-settling fonts and HA's per-card edit bar.
- **Pinned height survives room switches.** Swipe, nav clicks and presence-follow now re-render at the previously pinned pixel height instead of the CSS fallback — no flash, no per-room lottery, corner chips stay exactly where they belong.
- **Residual overflow absorbed.** View wrappers add bottom padding below the card inside the scroller, invisible to any top-offset math. After pinning, the card measures what actually overflows and absorbs it into its height (capped at 160 px so a genuinely tall dashboard keeps its scrollbar). This ends the family of scroll-gap bugs chased in 4.5.1 and 4.5.2.

### Compatibility

- No config changes required.
- Portrait natural-height behaviour (4.5.2) is untouched; `layout: height: container` and fixed heights are unaffected.
- New jsdom render tests cover scroller resolution, corner-badge pinning across room switches, and height persistence.
