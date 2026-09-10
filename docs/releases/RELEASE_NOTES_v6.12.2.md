# v6.12.2 — fix: scrolling on touch could fire a tap_action

Reported on mobile: a cockpit view stacked with other cards (a status banner, a thumbnail nav
strip) is often taller than the screen, so getting to the bottom means scrolling — and scrolling
with a finger that happens to land on a tappable zone/icon/tile/vacuum_widget kept firing that
element's `tap_action`, typically navigating away mid-scroll.

## Root cause

`_addZoneListeners()` — the shared touch/mouse handler behind every tappable element (zones, icons,
labels, gauges, vacuum_widgets, and, since v6.12.0, tiles) — already cancelled the *hold* timer on
`touchmove`, but did nothing to stop the *tap* itself: `touchend` unconditionally ran `onTap()`
regardless of whether the finger had travelled in between. Press-drag-release — exactly what a
scroll gesture is — was indistinguishable from a plain tap.

## The fix

The handler now records where the touch started and, on `touchmove`, checks how far it has
travelled. Once that exceeds a small jitter threshold (~10px — enough to absorb an ordinary finger
tremor on a genuine tap, small enough to catch a real drag almost immediately), the touch is marked
as a scroll and `touchend` no longer fires the tap:

```
touchstart → record (x, y)
touchmove  → moved > ~10px? → mark as scroll, cancel hold (as before)
touchend   → marked as scroll? → do nothing
             else             → run the tap exactly as before
```

Nothing about tap, hold or double-tap behavior changes for an actual tap or long-press — only a
real drag/scroll starting on the element is now correctly ignored.

No configuration involved — this is a pure bug fix, not a new option, and applies uniformly to
every element type that goes through `_addZoneListeners` (zones, icons, labels, gauges,
vacuum_widgets, tiles).

Verified: 3 new render tests (a plain tap with no movement still fires, a few pixels of finger
jitter still counts as a tap, a real ~90px drag starting on the element does not fire) — smoke/
render/lifecycle all passing against source and the minified `dist/` build.
