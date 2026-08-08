# Room Overlay Card v4.6.1

## Intrinsic image box now respects the height budget — letterbox instead of clipping

Follow-up to v4.6.0, diagnosed live against a real dashboard. The v4.6.0 height pin was already doing its job — the card ended exactly at the viewport edge — yet a bottom-left badge could still vanish. The remaining overflow was **inside** the card: with the image region on an `auto` grid row, CSS `aspect-ratio` sizes the image box from its **width alone** (height = width ÷ aspect), completely blind to the card's pinned height. On short viewports the grid total exceeded the card, `ha-card` clipped the excess, and anything anchored to the image's bottom edge fell below the visible area. In edit mode the same mismatch appeared inverted — a black band where the mis-fitted image should have been.

### What changed

- **Budget-fit for the intrinsic image box.** When the width-derived height doesn't fit the remaining budget (card height minus the rows above/below the image, taken from the layout definition rather than from the geometry of an already-overflowing grid), the box shrinks to fit the **height**, keeps the exact design aspect, and centres itself. The image letterboxes — side bars — instead of being cropped or clipped. Every stage-glued element (zones, icons, labels, gauges) scales with it, corner badges stay pinned to the visible box, and the box grows back automatically when space returns (window resize, leaving edit mode). Runs on every layout trigger: height pin, window resize, ResizeObserver, render.
- **Fix: an absorbed height could get stuck short.** The v4.6.0 residual-overflow absorption kept its shrunken height for as long as the raw measurement was unchanged — even after the overflow it reacted to had disappeared. The pin now re-expands whenever the pinned height stops matching the raw one and nothing overflows anymore.
- **Self-heal for transient rects.** Heights measured while Home Assistant shuffles its DOM (edit-mode reparenting into `hui-card-options`, header mount) can be transiently wrong, and a ResizeObserver event could pin a bogus value with no follow-up trigger. Every pin that changes the value now schedules a single delayed re-check (300 ms) against settled rects; a stable pin never reschedules, so there is no steady-state polling.

### Compatibility

- No config changes required; applies to layouts with the image region on an `auto` row (intrinsic sizing). Image regions on `%`/`1fr` rows keep their cover/contain behaviour.
- Portrait natural-height mode (4.5.2) is untouched.
- New jsdom render tests cover the budget-fit method (presence, safety without layout boxes, portrait no-op).

Verified live: on a 770 px-tall window the image shrank from 645 px (width-derived) to the 593 px budget, centred with side bars, with the vacuum chip fully visible and zero page overflow — matching the intended "black on the sides, never crop the bottom" behaviour.
