# Room Overlay Card v4.5.1

Fix for a stray empty scroll strip appearing under the card in viewport-height layout.

## 🐛 Bug fix

### Empty scroll gap under the card (viewport height mode)

`layout: height: viewport` (the default) pins the card's height in JS from `innerHeight − <card top offset>`. That pin was only recalculated on a genuine `window` resize. Two common situations shifted the card's available space *without* firing that event:

- The Home Assistant header rendering/settling to its final height *after* the card's first paint.
- The edit-mode bottom bar appearing/disappearing when entering or leaving dashboard edit mode.

In both cases the card kept its stale pinned height, and the page picked up a real (and unwanted) scrollbar — an empty strip roughly the size of the header appeared below the card.

**Fix:** the card now also watches `document.body` with a `ResizeObserver`. When the page becomes scrollable, `body`'s own content box grows or shrinks by that same amount — that's the actual mechanism behind the scrollbar — so this reacts directly to the real cause (header settling, tabs appearing, the edit-mode bar) the instant it happens. No polling, no timers, and no interference with the room-swipe gesture.

## ⬆️ Upgrade
Drop-in replacement for 4.5.0. No config changes, no breaking changes.
