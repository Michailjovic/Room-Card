# Room Overlay Card v3.0.5

Patch release. Fixes companion cards being dragged during the room swipe.

## 🐛 Fixed
- **Finger-swipe between rooms dragged the incoming room's `cards_above` /
  `cards_below`.** The neighbour preview is a full card instance. It stripped the
  top-level `cards_above` / `cards_below`, but those keys are **room-scoped** (in
  `rooms[]`), so the previewed room pulled its own strips from `rooms[idx]` and
  rendered them above/below the preview image — and they slid in with it. The
  preview now also strips `cards_above` / `cards_below` from **every room**, so
  during the swipe only the room image moves and the companion cards switch when
  the swipe commits.

## 🔄 Compatibility
- No config changes. Verified against Home Assistant 2026.6.
