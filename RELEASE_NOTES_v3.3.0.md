# v3.3.0 — Cover control (roleta): interactive GUI for covers

Blinds are no longer just a visualization — they can now **control** the cover.

Add a `control:` block to any `blind` and its overlay becomes a slim, **icon-only** controller: a draggable **position rail** (`cover.set_cover_position`, live + throttled), **up / stop / down** buttons, and quick-jump **presets** (position + icon + colour), each shown as a single icon (the `name` is a tooltip). Up/Down do a full travel (`open_cover` / `close_cover`); `Stop` (`stop_cover`) highlights while the cover is moving.

The controller is **hidden until you tap the window** (the blind graphic), and only one shows at a time — so it never permanently takes up space.

Two placements, chosen per blind:

- **`placement: float`** — place it freely with `top` / `left`; it's sized to the window's height.
- **`placement: dock`** — a slim rail pinned to the image edge (`dock_side: left | right`), filling the full height with minimal width.

On the `mobile` tier the controller flips to a **horizontal bar at the bottom**, and `touch-action: none` keeps drags from leaking to the room swipe or page scroll.

Covers that report no `current_position` (assumed-state) hide the rail and keep the buttons + presets. Preset colours accept Home Assistant names (`indigo`, `amber`, `blue-grey`, …) or any CSS colour.

The editor’s **Elements → Blinds** section gained a **Control** sub-panel (placement, float top / left / width, dock side, slider, and a preset row editor).

Backward compatible: a blind with no `control:` renders exactly as before.

```yaml
blinds:
  - id: bedroom_roller
    entity: cover.roller_motor_bedroom
    top: "6%"
    left: "8%"
    width: "22%"
    height: "30%"
    blind_type: roller
    control:
      placement: float        # float (place via top/left) | dock (edge rail)
      top: "12%"              # float position — sized to the window height
      left: "34%"
      dock_side: right        # left | right   (dock only)
      slider: true
      presets:
        - {position: 100, icon: mdi:blinds-open,         color: amber,     name: Open}
        - {position: 65,  icon: mdi:blinds,              color: orange,    name: Day}
        - {position: 2,   icon: mdi:roller-shade,        color: blue-grey, name: Peek}
        - {position: 0,   icon: mdi:roller-shade-closed, color: indigo,    name: Closed}
```

**Full Changelog**: https://github.com/Michailjovic/Room-Card/blob/main/CHANGELOG.md
