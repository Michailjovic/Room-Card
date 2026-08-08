# Room Overlay Card v4.6.2

## Edit mode fixed: actions bar visible without scrolling, no more "breathing" size loop

Follow-up to v4.6.1, diagnosed live in a running dashboard — edit mode was entered in a real browser session, the oscillation reproduced, and every layout pass logged until the cycle was fully decoded.

### The breathing loop

After a room swipe (and especially in edit mode) the card could start rhythmically growing and shrinking at about 1 Hz, never settling. The chain: Home Assistant's own styles give `ha-card` a `transition: 0.3s ease-out`, so every height pin *animated* for 300 ms. Any measurement taken inside that window — the image budget-fit, the overflow absorption — read a mid-flight rectangle and computed the next wrong value from it. The page scrollbar appearing and disappearing with each wrong value then acted as a metronome, re-triggering the cycle forever.

**Fixed by:** giving our `ha-card` `transition: none` (the card owns its height entirely — animating it only breaks measurement), and, as a second line of defence, computing the budget-fit from the card's *intended* inline height instead of the animated rect.

### Edit-mode actions bar below the fold

The Edit / Move / Delete bar under the card always needed a scroll to reach. `_editBarHeight` searched for HA's `.card-actions` element inside an `HA-CARD` ancestor's shadowRoot — in current Home Assistant the bar lives in `hui-card-options`' shadowRoot, so the probe silently returned 0 and no space was reserved.

**Fixed by:** finding the bar in `hui-card-options` (the legacy location is still checked) and reserving the bar block's **own** height plus vertical margins. Deliberately *not* a position difference against our card — that measurement is circular (it reads a layout our own height just changed) and over-reserves.

### Leaving edit mode left the card short

Exiting edit mode removes the actions bar without resizing the scroller or recreating the card — no observer fires, so the card stayed pinned at the shorter edit-mode height. A throttled (1 s) root-height re-check now piggybacks on regular Home Assistant state updates; it early-outs when nothing changed, making it effectively free.

### Compatibility

- No config changes required.
- Verified live: edit mode stable (zero layout churn over multiple seconds, logged), actions bar visible without scrolling, room swipe inside edit mode keeps the letterboxed image and visible corner chips, and leaving edit mode restores the full height on the next state tick.
