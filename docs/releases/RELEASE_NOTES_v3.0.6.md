# Room Overlay Card v3.0.6

Patch release. Removes a quick flash after swiping between rooms.

## 🐛 Fixed
- **Quick flash on the left edge after swiping to the next room (mobile).** When a
  swipe committed, `_switchRoom` placed a crossfade clone of the old room on top
  and faded it out. With `lock_aspect` the content is a cover-stage wider than the
  visible box, so the clone's horizontal translate didn't move it fully
  off-screen and a sliver flashed on the left during the fade. The swipe commit
  now re-renders **without** that crossfade clone — the drag preview already
  covers the transition — so the flash is gone.
- Nav clicks, mouse-wheel, and presence-driven room changes still use the
  crossfade as before (only the finger-swipe commit skips it).

## 🔄 Compatibility
- No config changes. Verified against Home Assistant 2026.6.
