# Room Overlay Card v3.0.1

Patch release. Fixes the day/night blind animation.

## 🐛 Fixed
- **Day/night blind drifted as it closed.** The `day_night` blind rendered its
  stripes with two gradient layers, the second offset by
  `position × slat_count × (slat_pitch / 2)`. That offset is several tiles wide,
  so the two layers' alignment wrapped around multiple times over the travel and
  the bands visibly oscillated open/closed instead of closing once (with an extra
  snap right at 100 %). The blind is now a **single, top-anchored striped layer**
  whose covered height tracks the motor position — a descending striped fabric:
  stripes stay put, the leading edge descends smoothly, and a fully closed blind
  shows exactly `slat_count` slats.

## ✨ Added
- **`slat_snap: true`** (per-blind, optional) — rounds the covered height to whole
  slats so the leading edge lands on a slat boundary instead of cutting one
  mid-band. Off by default (smooth motion).

```yaml
blinds:
  - id: bedroom_blind
    blind_type: day_night
    entity: cover.bedroom
    slat_count: 6
    slat_snap: true        # optional — snap to whole slats
```

## 🔄 Compatibility
- No config changes required. Existing `day_night` blinds animate correctly with
  no edits. Verified against Home Assistant 2026.6.

## Note on motor position
In Home Assistant a cover's `current_position` is `100 = open`, `0 = closed`. If
you want a fully closed blind to show all slats, map it so the fill is full at
the closed end — either invert with `min: 100` / `max: 0`, or point the blind at
a position that already reads 0 when closed. `current_position` is an integer
(1 % steps), so with N slats each slat spans `100 / N` % of travel — use
`slat_snap` if you want the edge to rest exactly on a slat.
