# Room Overlay Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Michailjovic/Room-Card.svg)](https://github.com/Michailjovic/Room-Card/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A Home Assistant Lovelace card for **room visualization** — place a photo of your room and bring it to life with conditional CSS filters, transparent overlay layers, clickable zones, status badges, progress gauges, animated window blinds, and embedded HA cards. Everything configurable from a full GUI editor — no YAML required.

![Room Overlay Card – hero screenshot](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/screenshots/hero.png)

---

## Features at a glance

| Feature | What it does |
|---|---|
| **Base image** | Any room photo, any aspect ratio, configurable border-radius |
| **CSS filter engine** | Brightness, saturation, sepia, blur… driven by entity states with smooth transitions |
| **Brightness model** | Multi-stop filter interpolation: define named stops (day / night / cinema…) and blend automatically |
| **Overlay layers** | Transparent PNG layers with conditional opacity/filter; state-driven image switching |
| **Gauges** | Animated progress bars in 6 fill directions, color gradients, per-gauge visibility conditions |
| **Blinds** | Roller, venetian slat, and day/night (zebra) blind animations driven by cover entities |
| **Clickable zones** | Invisible hit areas — navigate, more-info, toggle, call-service, browser-mod popup |
| **Status badges** | Floating chips in any corner — MDI icon, conditional color, conditional label |
| **Embedded HA cards** | Any card (tile, mini-graph, button…) placed at absolute coordinates |
| **Test mode** | Red outlines on zones, blue on elements — for precise positioning |
| **GUI editor** | Full configuration without writing YAML |

---

## Screenshots

| | |
|---|---|
| ![Day scene](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/screenshots/day.png) | ![Night scene](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/screenshots/night.png) |
| *Day scene — full brightness* | *Night mode — dim filter active* |
| ![Gauges](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/screenshots/gauges.png) | ![Blinds](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/screenshots/blinds.png) |
| *Gauges — temperature, humidity, CO₂* | *Day/night zebra blind at 60 %* |
| ![Editor](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/screenshots/editor.png) | |
| *GUI editor — no YAML needed* | |

---

## Installation

### Via HACS (recommended)

1. Open **HACS → Frontend → ⋮ → Custom repositories**
2. Add `https://github.com/Michailjovic/Room-Card` — type **Lovelace**
3. Search for **Room Overlay Card** → Install
4. Hard-refresh your browser (`Ctrl+Shift+R`)

### Manual

1. Download `room-overlay-card.js` from the [latest release](https://github.com/Michailjovic/Room-Card/releases/latest)
2. Copy to `/config/www/room-overlay-card.js`
3. **Settings → Dashboards → ⋮ → Manage resources** → add `/local/room-overlay-card.js` (type: JavaScript module)
4. Hard-refresh

---

## Minimal configuration

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: "16/9"
```

---

## Configuration reference

### Top-level

| Key | Type | Default | Description |
|---|---|---|---|
| `base_image` | string | **required** | Path to the room photo |
| `aspect_ratio` | string | `16/9` | Card aspect ratio (`width/height`) |
| `border_radius` | string | `12px` | Card corner radius |
| `filter_transition` | string | `2s ease` | CSS transition for the base image filter |
| `filter_conditions` | list | `[]` | Discrete CSS filter states |
| `brightness_model` | object | — | Multi-stop filter interpolation |
| `overlays` | list | `[]` | Overlay image layers |
| `gauges` | list | `[]` | Progress gauge bars |
| `blinds` | list | `[]` | Window blind visualizations |
| `zones` | list | `[]` | Clickable hit areas |
| `badges` | list | `[]` | Corner status chips |
| `elements` | list | `[]` | Embedded HA cards |
| `test_mode` | bool | `false` | Show outlines for debugging |
| `tap_action` | action | — | Action on card background click |

---

### Conditions

Used throughout the config to drive visual state.

```yaml
# Simple state match
entity: binary_sensor.window
state: "on"

# Negation
entity: light.bedroom
state_not: "unavailable"

# Numeric comparison  (operators: < > <= >= == !=)
entity: sensor.temperature
operator: ">"
value: 25

# AND / OR chaining
entity: sensor.temperature
operator: ">"
value: 22
and:
  entity: binary_sensor.night_mode
  state: "off"
```

---

### CSS filter engine

Apply conditional CSS filters to the base image.

```yaml
filter_conditions:
  - condition:
      entity: binary_sensor.night_mode
      state: "on"
    filter: brightness(0.3) saturate(0.2) sepia(0.4)
  - filter: brightness(1.0)    # default — no condition
```

---

### Brightness model

Define named filter stops and let the card interpolate smoothly between them based on a sensor value. Useful for continuous ambient light simulation.

```yaml
brightness_model:
  sources:
    - entity: sensor.living_room_lux
      min_input: 0
      max_input: 1000
  stops:
    - name: dark
      value: 0
      filters:
        brightness: 0.3
        saturate: 0.5
        sepia: 0.3
    - name: normal
      value: 50
      filters:
        brightness: 1.0
        saturate: 1.0
        sepia: 0.0
    - name: bright
      value: 100
      filters:
        brightness: 1.2
        saturate: 1.1
```

Supported filter keys: `brightness`, `contrast`, `saturate`, `sepia`, `hue-rotate`, `blur`, `opacity`, `grayscale`, `invert`.

---

### Overlays

Transparent PNG layers stacked over the base image.

```yaml
overlays:
  # Conditional opacity
  - id: ceiling_light
    image: /local/images/bedroom_light_on.png
    transition: "1.5s ease"
    conditions:
      opacity:
        - condition:
            entity: light.bedroom_ceiling
            state: "on"
          value: 1
        - value: 0      # default

  # State-driven image switching
  - id: fan_visual
    state_images:
      - entity: fan.bedroom
        state: "on"
        image: /local/images/fan_on.png
      - image: /local/images/fan_off.png    # default
    conditions:
      opacity:
        - value: 1
```

---

### Gauges

Animated progress bars positioned anywhere on the card.

```yaml
gauges:
  - id: temperature_bar
    entity: sensor.bedroom_temperature
    top: "5%"
    left: "2%"
    width: "6%"
    height: "40%"
    min: 15
    max: 35
    orientation: vertical      # see table below
    background: "rgba(0,0,0,0.4)"
    border_radius: "4px"
    transition: "height 1s ease"
    color_gradient:
      - value: 15
        color: "#2196F3"    # blue — cold
      - value: 22
        color: "#4CAF50"    # green — comfortable
      - value: 30
        color: "#FF5722"    # red — hot
    visible_conditions:
      entity: binary_sensor.show_gauges
      state: "on"
```

#### `orientation` values

| Value | Fill direction |
|---|---|
| `vertical` | bottom → top (default) |
| `top` | top → bottom |
| `horizontal` / `left` | left → right |
| `right` | right → left |

#### Discrete color based on state

```yaml
color:
  - condition:
      entity: sensor.co2
      operator: ">"
      value: 1000
    value: "rgba(255,50,50,0.9)"
  - value: "rgba(100,200,100,0.8)"
```

---

### Blinds

Visualize window covers directly on the room image.

```yaml
blinds:
  - id: bedroom_blind
    entity: cover.bedroom_blind
    attribute: current_position   # omit to use entity state (open/closed)
    min: 0      # entity value = fully open
    max: 100    # entity value = fully closed
    top: "10%"
    left: "30%"
    width: "25%"
    height: "50%"
    z_index: 6
    blind_type: day_night         # roller | venetian | day_night
    slat_color: "rgba(0,0,0,0.85)"
    slat_count: 8
```

#### Blind types

**`roller`** — solid fill that grows from the top as the blind closes.

```yaml
blind_type: roller
slat_color: "rgba(80,60,40,0.9)"
```

**`venetian`** — horizontal slats with visible gaps between them.

```yaml
blind_type: venetian
slat_color: "rgba(200,180,150,0.9)"
slat_width: 8     # px — slat thickness
slat_gap: 4       # px — gap between slats
gap_color: "rgba(180,160,140,0.35)"
```

**`day_night`** — zebra / dual-layer fabric blind. Two CSS gradient layers animate an authentic rolling-band open/close transition. The band pattern cycles `slat_count` times as the blind travels from fully open to fully closed.

```yaml
blind_type: day_night
slat_color: "rgba(0,0,0,0.9)"
slat_count: 8     # number of band pairs — controls density and animation speed
```

> **Inverted motor direction** — if your cover reports `0` = closed and `100` = open, swap the values: `min: 100` and `max: 0`. The card handles it automatically.

---

### Clickable zones

Invisible hit areas over any part of the card.

```yaml
zones:
  - id: light_zone
    top: "55%"
    left: "8%"
    width: "20%"
    height: "18%"
    tap_action:
      action: toggle
      entity: light.bedroom

  # Conditional action
  - id: smart_zone
    top: "70%"
    left: "5%"
    width: "15%"
    height: "12%"
    tap_action:
      condition:
        entity: input_boolean.guest_mode
        state: "on"
      then:
        action: navigate
        path: /lovelace/guest
      else:
        action: toggle
        entity: light.bedroom_main
```

#### Action types

| Action | Required params | Description |
|---|---|---|
| `navigate` | `path` | Navigate to a dashboard path |
| `more-info` | `entity` | Open entity more-info dialog |
| `toggle` | `entity` | Toggle entity on/off |
| `call-service` | `service`, `service_data` | Call any HA service |
| `browser-mod-popup` | `title`, `size`, `content` | Open a browser-mod popup |
| `none` | — | Do nothing |

---

### Status badges

Floating chips anchored to card corners.

```yaml
badges:
  - id: temp_chip
    position: bottom-right    # top-left | top-right | bottom-left | bottom-right
    icon: mdi:thermometer
    icon_color:
      - condition:
          entity: sensor.temperature
          operator: ">"
          value: 26
        value: "orange"
      - value: "white"
    label:
      - condition:
          entity: sensor.temperature
          operator: ">"
          value: 26
        value: "Hot!"
      - value: "{{ states('sensor.temperature') | round(1) }} °C"
    visible:
      entity: binary_sensor.someone_home
      state: "on"
    tap_action:
      action: more-info
      entity: sensor.temperature
```

---

### Embedded HA cards

Place any Lovelace card at absolute coordinates over the room image.

```yaml
elements:
  - id: temp_graph
    top: "3%"
    left: "65%"
    width: "32%"
    height: "22%"
    z_index: 4
    border_radius: "8px"
    overflow: hidden
    visible:
      entity: binary_sensor.show_graph
      state: "on"
    card:
      type: custom:mini-graph-card
      entities:
        - sensor.bedroom_temperature
      hours_to_show: 6
      line_width: 2
      show:
        labels: false
        icon: false

  - id: weather_tile
    top: "75%"
    left: "68%"
    width: "30%"
    height: "22%"
    card:
      type: tile
      entity: weather.home
```

---

## Complete example

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: "16/9"
border_radius: "12px"
filter_transition: "2s ease"

filter_conditions:
  - condition:
      entity: binary_sensor.night_mode
      state: "on"
    filter: brightness(0.25) saturate(0.1) sepia(0.3)
  - filter: brightness(1.0)

overlays:
  - id: ceiling_light
    image: /local/images/bedroom_ceiling_on.png
    transition: "1.5s ease"
    conditions:
      opacity:
        - condition:
            entity: light.bedroom_ceiling
            state: "on"
          value: 1
        - value: 0

gauges:
  - id: temp_gauge
    entity: sensor.bedroom_temperature
    top: "5%"
    left: "2%"
    width: "5%"
    height: "35%"
    min: 16
    max: 30
    color_gradient:
      - value: 16
        color: "#2196F3"
      - value: 22
        color: "#4CAF50"
      - value: 30
        color: "#FF5722"

blinds:
  - id: bedroom_blind
    entity: cover.bedroom_blind
    attribute: current_position
    min: 0
    max: 100
    top: "8%"
    left: "35%"
    width: "22%"
    height: "48%"
    z_index: 6
    blind_type: day_night
    slat_color: "rgba(0,0,0,0.88)"
    slat_count: 8

zones:
  - id: ceiling_switch
    top: "55%"
    left: "8%"
    width: "18%"
    height: "20%"
    tap_action:
      action: toggle
      entity: light.bedroom_ceiling

badges:
  - id: humidity
    position: bottom-left
    icon: mdi:water-percent
    label:
      - value: "{{ states('sensor.bedroom_humidity') | round(0) }} %"
    tap_action:
      action: more-info
      entity: sensor.bedroom_humidity
```

---

## Positioning tips

All `top`, `left`, `width`, `height` values are percentage strings relative to the card dimensions. Enable `test_mode: true` to show red outlines on zones and blue outlines on elements while you fine-tune positions.

```yaml
test_mode: true
```

---

## Development

```bash
npm install          # install dependencies
npm run build        # production build
npm run watch        # watch mode with source maps
```

Source: `src/room-overlay-card.ts` (TypeScript).
Distributed file: `room-overlay-card.js` — single file, zero external runtime dependencies.

---

## License

MIT © 2025 Michailjovic
