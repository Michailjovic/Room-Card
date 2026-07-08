# v3.3.0 — Cover control (roleta): interactive GUI for covers

Blinds are no longer just a visualization — they can now **control** the cover.

Add a `control:` block to any `blind` and its overlay becomes a full controller: a vertical glass module with a draggable **position rail** (`cover.set_cover_position`, live + throttled), **up / stop / down** buttons, and configurable **presets** that jump straight to a position (e.g. `0 / 2 / 65 / 100`), each with its own icon, colour and name. `Stop` stays visible at all times and lights up while the cover is moving, next to an “Opening… / Closing…” state line.

Two placements, chosen per blind:

- **`display: popover`** — tap the blind graphic on the floor-plan and the module pops out anchored at the window; the plan stays clean.
- **`display: dock`** — the module is permanently visible on a side rail *outside* the image (`dock_side: left | right`).

Covers that report no `current_position` (assumed-state) automatically hide the rail and `%` readout and keep the buttons + presets. Preset colours accept Home Assistant names (`indigo`, `amber`, `blue-grey`, …) or any CSS colour.

The editor’s **Elements → Blinds** section gained a **Control** sub-panel (display mode, dock side, slider toggle, and a preset row editor).

Backward compatible: a blind with no `control:` renders exactly as before.

```yaml
blinds:
  - id: bedroom_roller
    entity: cover.roller_motor_bedroom
    top: 6%
    left: 8%
    width: 22%
    height: 30%
    blind_type: roller
    control:
      display: popover       # popover (tap window) | dock (side rail)
      dock_side: right       # left | right   (dock only)
      slider: true           # draggable position rail
      presets:
        - {position: 100, icon: mdi:brightness-up,        color: amber,     name: Open}
        - {position: 65,  icon: mdi:sun,                  color: orange,    name: Day}
        - {position: 2,   icon: mdi:arrow-collapse-down,  color: blue-grey, name: Peek}
        - {position: 0,   icon: mdi:moon-waning-crescent, color: indigo,    name: Closed}
```

**Full Changelog**: https://github.com/Michailjovic/Room-Card/blob/main/CHANGELOG.md
