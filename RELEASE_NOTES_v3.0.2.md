# Room Overlay Card v3.0.2

Patch release. Makes a closed day/night blind actually look closed.

## 🐛 Fixed
- **Day/night blind read as open even when fully closed.** The covered region was
  drawn with transparent gaps between the slats, so the room image showed through
  and the blind looked airy/open. The gap is now an **opaque colour** by default,
  so the covered part renders as a real closed striped blind — dark slats over an
  opaque band — while the covered height still follows the motor position
  (`0 % = open`, `100 % = closed`).

## ✨ Added
- **`gap_color` for `day_night` blinds** (with an editor field). Colour of the
  band between slats:
  - Default `rgba(120,120,120,0.92)` — opaque → closed look.
  - `gap_color: transparent` — restores the old see-through zebra style.

```yaml
blinds:
  - id: bedroom_blind
    blind_type: day_night
    entity: cover.bedroom
    min: 0            # 0 % = open
    max: 100          # 100 % = closed
    slat_count: 17
    slat_color: rgba(0,0,0,0.9)
    gap_color: rgba(120,120,120,0.92)   # opaque = looks closed
```

## 🔄 Compatibility
- Existing `day_night` blinds now default to the opaque (closed) look. To keep
  the previous see-through rendering, add `gap_color: transparent`. Verified
  against Home Assistant 2026.6.
