# Room Overlay Card v3.0.3

Patch release. Fixes the day/night blind with the correct zebra model.

## 🐛 Fixed
- **Day/night blind animation now matches a real zebra blind.** A `day_night`
  blind is two layers of alternating opaque/sheer bands; the motor position
  controls how the two layers are **aligned**, not a descending height. The blind
  stays fully down (height 100 %) and the position drives the offset between the
  two layers:
  - `0 %` (open) → bands behind each other → **see-through**.
  - `100 %` (closed) → bands stacked half a slat apart → **fully opaque**.

  The offset now sweeps linearly **once** across the travel
  (`position × slat_pitch / 2`) — no `slat_count` multiplier and no end-snap,
  which previously made the alignment wrap several times so the bands oscillated
  open/closed ("drift").

## ↩️ Reverted
- The descending-fabric approach from 3.0.1 and the `gap_color` workaround from
  3.0.2 — both based on a wrong mental model. `day_night` config is back to
  `slat_count` + `slat_color`. `gap_color` is no longer used for `day_night`
  (still used by `venetian`).

```yaml
blinds:
  - id: bedroom_blind
    blind_type: day_night
    entity: cover.bedroom
    min: 0             # 0 % = open (see-through)
    max: 100           # 100 % = closed (opaque)
    slat_count: 17
    slat_color: rgba(0,0,0,0.9)
```

## 🔄 Compatibility
- No config changes required. Verified against Home Assistant 2026.6.
