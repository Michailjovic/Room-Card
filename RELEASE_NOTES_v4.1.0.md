# Room Overlay Card v4.1.0

Light controls now handle plain on/off entities, and the editor gained a live gradient preview for the lux ring.

## ✨ What's new

### Switches in `light_controls`
`light_controls` used to mount every entity as a `material-slider-card` brightness slider, which only works for `light.*`. Now the entity domain is detected per row:

- `light.*` → brightness slider (unchanged).
- `switch.*`, `input_boolean.*`, `fan.*`, `script.*`, … → an **on/off toggle pill** with the same pill shape, height and `bg_off` background as the sliders, and the same **lux-driven border ring**. Tap toggles the entity (`homeassistant.toggle`); when on, the pill fills with the current lux colour and flips its icon (`mdi:power` ↔ `mdi:power-off`).

No config migration required — just add the entity:

```yaml
light_controls:
  entities:
    - entity: light.panel_bedroom_1
      name: Left
    - entity: switch.bedroom_lamp   # ← now works, renders as a toggle
      name: Lamp
  lux_sensor: sensor.presence_sensor_living
  lux_max: 50
```

### Editor: live gradient preview
The Light controls editor section now shows a preview of the border-colour gradient below the lux settings, sampled from the exact same HSL ramp the sliders use, with tick marks at **¼, ½, ¾** and `0 lx … lux_max` end labels. It updates live while you drag the colour pickers or change **Lux max** — so you can see where a given lux level lands on the colour before saving.

## 🧪 Tests
159 smoke + 31 jsdom render tests pass.

## ⬆️ Upgrade
Drop-in replacement for 4.0.0. No breaking changes.
