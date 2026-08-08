# v3.2.0 — Light controls with a lux ring

A new room-scoped option turns the hand-written `material-slider-card` + `card_mod` light strip into a GUI-configurable feature:

```yaml
light_controls:
  entities:
    - light.panel_bedroom_1
    - light.panel_bedroom_2
    - light.panel_bedroom_3
  columns: 3
  height: 20
  lux_sensor: sensor.kitchen_illuminance
  lux_max: 50
  color_low: "#261a66"     # dark (low lux)
  color_high: "#f4c025"    # bright (high lux)
  bg_off: "#000000"
```

Each slider's **border colour tracks the lux sensor** — a smooth gradient interpolated in HSL between the two colours you pick. It replaces the old `card_mod` + Jinja template entirely: the colour is computed in JS and pushed through `material-slider-card`'s own CSS variables, so there's **no `card_mod` dependency** for the ring and it recomputes cheaply (one HSL calc, applied only when the colour changes).

Everything is editable from the GUI — under the **Elements** tab → *Light controls*: add or remove lights (each with an optional name), set the columns, slider height, lux sensor, `lux_max`, the two anchor colours and the off-state background.

When a light is on, the slider's `colorize` takes over the fill with the light's real colour and brightness, so `bg_off` only shows when the light is off. Requires the `material-slider-card` resource.

**Full Changelog**: https://github.com/Michailjovic/Room-Card/blob/main/CHANGELOG.md
