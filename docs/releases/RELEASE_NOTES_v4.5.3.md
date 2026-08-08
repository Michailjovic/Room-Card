# Room Overlay Card v4.5.3

Fix for the blind-control preset buttons reading in the wrong direction on the horizontal cover bar.

## 🐛 Bug fix

### Cover-control presets read backwards on the horizontal bar

`control.presets` is a single ordered list shared by both layout profiles:

- On the **vertical rail** (landscape dock in a side column) it renders top → bottom exactly as authored — typically open at the top, closed at the bottom, matching the up/close direction of the slider.
- On the **horizontal bar** (portrait dock, or the portrait float bottom bar) it previously rendered in that *same* array order, left → right — which put "closed" and "open" on the wrong ends and read open → closed instead of closed → open.

Because it's one list feeding two different reading directions, there was no way to fix the horizontal bar in YAML without reversing the vertical rail.

**Fix:** the horizontal bar now sorts a copy of `presets` by `position` ascending purely for its own left-to-right rendering. The vertical rail is untouched and still renders the config order exactly as written.

**No config changes needed** — existing `control.presets` lists now render correctly in both profiles at once.

## ⬆️ Upgrade
Drop-in replacement for 4.5.2. No config changes, no breaking changes.
