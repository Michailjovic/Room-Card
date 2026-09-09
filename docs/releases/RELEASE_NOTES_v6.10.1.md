# v6.10.1 — Section sheet stole room-swipe gestures

A cockpit section panel (`.roc-panel`, opened via `open-section`) sits as a sibling of the room's
`.content` layer inside `.wrap` — so a `pointerdown` anywhere in an *open* sheet still bubbled up to
`_attachRoomDrag()`'s room-swipe listener on `.wrap`. Dragging a native HA tile card's percentage
slider (added in v6.10.0 for the covers section) read as a horizontal room-swipe gesture underneath
the sheet: the room content dragged along with the slider.

The room-swipe pointerdown handler already exempted `[data-roc-slider]` zones and `.elcont` (embedded
`elements:` cards) from engaging the gesture — an open `.roc-panel` just wasn't on that list. Added.

```js
// before (v6.10.0)
if(path.some(n => (n.dataset&&n.dataset.rocSlider) || (n.classList&&n.classList.contains('elcont'))))return;

// after (v6.10.1)
if(path.some(n => (n.dataset&&n.dataset.rocSlider) || (n.classList&&(n.classList.contains('elcont')||n.classList.contains('roc-panel')))))return;
```

Anything inside an open section sheet — tiles, an embedded card's own slider, scrolling the panel
body — now owns its own gestures; the room canvas behind it stays put until the sheet is closed.

No config changes. No migration needed.
