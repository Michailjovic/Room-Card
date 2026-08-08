# v3.2.3 — Fix: light sliders dragged during room swipes

**Fixed.** The `light_controls` slider strip is room-scoped, so during a room swipe the incoming room's neighbour-preview pulled in its own sliders and dragged them across with the image — the same class of bug previously fixed for `cards_above` / `cards_below`. The swipe preview now strips `light_controls` from the ghost, so only the room image (and the elements inside it) move during the swipe; the sliders are recomputed once the swipe commits.

**Full Changelog**: https://github.com/Michailjovic/Room-Card/blob/main/CHANGELOG.md
