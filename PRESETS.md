# Preset Gallery

Copy-paste recipes for common looks. Combine freely — all snippets are plain
config fragments for `custom:room-overlay-card` (put them at room level when
using `rooms:`).

---

## Day / night base filters

```yaml
filter_conditions:
  - condition:
      entity: sun.sun
      state: below_horizon
    filter: brightness(0.3) saturate(0.35) sepia(0.25) hue-rotate(200deg)
  - filter: brightness(1.0)
```

## Smooth dusk (lux-driven brightness model)

```yaml
brightness_model:
  source:
    - entity: sensor.living_room_lux
      min_input: 0
      max_input: 800
  filter_gradient:
    - {value: 0,   filter: "brightness(0.25) saturate(0.3) sepia(0.3)"}
    - {value: 40,  filter: "brightness(0.65) saturate(0.8)"}
    - {value: 100, filter: "brightness(1.0)"}
```

## Cozy evening (warm tint)

```yaml
filter_conditions:
  - condition:
      entity: input_select.scene
      state: Movie
    filter: brightness(0.45) sepia(0.55) saturate(1.2) hue-rotate(-15deg)
  - filter: brightness(1.0)
```

## Seasons via weather entity

```yaml
weather_overlay:
  entity: weather.home        # rain/snow/fog/lightning automatically
  opacity: 0.6
  angle: 112deg               # windy look
```

Manual moods: `effect: snow-heavy` (blizzard), `effect: fog` (mysterious),
`effect: rain-lightning` (storm).

## Temperature gauge palette (CZ comfort range)

```yaml
color_gradient:
  - {value: 16, color: "#2196F3"}
  - {value: 21, color: "#4CAF50"}
  - {value: 24, color: "#FF9800"}
  - {value: 28, color: "#FF5722"}
```

## Humidity radial ring

```yaml
gauges:
  - id: hum_ring
    entity: sensor.bedroom_humidity
    orientation: radial
    top: "6%"
    left: "84%"
    width: "12%"
    height: "21%"
    arc: 270
    thickness: 10
    target: 50
    color_gradient:
      - {value: 25, color: "#FF9800"}
      - {value: 45, color: "#4CAF50"}
      - {value: 65, color: "#2196F3"}
```

## Dimmer slider on a lamp zone

```yaml
zones:
  - id: floor_lamp
    top: "38%"
    left: "12%"
    width: "10%"
    height: "30%"
    slider: {entity: light.floor_lamp, direction: vertical}
    tap_action: {action: toggle, entity: light.floor_lamp}
```

## Door portal (multi-room)

```yaml
zones:
  - id: door_to_bedroom
    top: "28%"
    left: "71%"
    width: "9%"
    height: "42%"
    tap_action: {action: switch-room, room: bedroom}
    fade: true
```

## RGB strip glow that follows the light colour

```yaml
overlays:
  - id: tv_strip_glow
    image: /local/strip_glow.png    # white/grayscale glow PNG
    color_from: light.tv_strip
    conditions:
      opacity:
        - condition: {entity: light.tv_strip, state: "on"}
          value: 1
        - value: 0
```

## Last motion label

```yaml
labels:
  - id: last_motion
    entity: binary_sensor.bedroom_motion
    attribute: last_changed_ts
    format: relative
    prefix: "Pohyb: "
    top: "92%"
    left: "2%"
```

## Presence-driven multiroom (Bermuda)

```yaml
room_entity: sensor.phone_alice_area
follow_hold: 60
rooms:
  - id: bedroom
    area_match: [Bedroom, Ložnice]
    ...
```

## Floorplan mode (large plans)

```yaml
zoom: true          # pinch 1–4×, double-tap reset, Ctrl+wheel
parallax: false     # parallax and zoom are mutually exclusive
```

## Subtle 3D tilt (wall tablet eye-candy)

```yaml
parallax:
  strength: 5       # degrees
  scale: 1.04
  source: auto      # pointer on desktop, orientation where permitted
```

---

# Responsive & layout (v2.0.0)

## One card, every screen — crop per device

```yaml
# Full width on each device, image cropped top/bottom to a different shape.
aspect_ratio:
  mobile: 4/3
  tablet: 16/10
  desktop: 16/9
  ultrawide: 21/9
```

## Cap the image height on big screens

```yaml
# Stops the image growing huge on FHD/2K — caps height, centers, letterboxes sides.
max_height:
  desktop: 70vh
  ultrawide: 80vh
```

## Custom tier thresholds

```yaml
# Each value is the exclusive upper bound (px); ultrawide is the rest.
# Tip: turn on Test mode to read the live width + active tier on the card.
breakpoints:
  mobile: 600
  tablet: 1280
  desktop: 1920
```

## Nudge one element per tier

```yaml
labels:
  - id: temp
    top: 10%
    left: 80%
    font_size: 2%
    mobile:    { top: 6%,  left: 70%, font_size: 4% }
    ultrawide: { top: 12%, left: 85%, font_size: 1.5% }
```

## Companion cards on mobile only

```yaml
# Full HA cards stacked below the image, shown only on phones.
cards_below:
  - card: { type: thermostat, entity: climate.bedroom }
    media: mobile
  - card:
      type: entities
      entities: [light.bedroom_ceiling, fan.bedroom]
    media: mobile
```

## Hold feedback ring colour

```yaml
hold_color: "#03a9f4"   # in-progress ring; turns green when the hold registers
# hold_feedback: false  # disable the ring entirely
```

## Pop-up control panel (group)

```yaml
icons:
  - id: open_controls
    icon: mdi:tune
    top: 84%
    left: 92%
    tap_action: { action: toggle-group, group: controls }

groups:
  - id: controls
    visible: false
    style: { top: 58%, left: 58%, width: 40%, height: 38%, background: "rgba(0,0,0,0.6)", border_radius: 12px }

elements:
  - id: light_tile
    group: controls
    top: 60%
    left: 60%
    width: 36%
    height: 14%
    card: { type: tile, entity: light.bedroom }
```
