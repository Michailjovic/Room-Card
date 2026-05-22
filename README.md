# Room Overlay Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Michailjovic/Room-Card.svg)](https://github.com/Michailjovic/Room-Card/releases)

A Home Assistant Lovelace card for room visualization — base image with conditional CSS filters, overlay image layers, clickable zones, floating status badges, and embedded HA cards. Includes a full GUI editor.

![Room Overlay Card preview](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/preview.png)

---

## Features

- **Base image** — any aspect ratio, configurable border-radius
- **CSS filter engine** — brightness, saturate, sepia, … driven by entity states with smooth transitions
- **Overlay layers** — transparent PNG layers with conditional `opacity` and `filter`; dynamic image selection based on entity state
- **Clickable zones** — invisible hit areas over the image; navigate / more-info / call-service / toggle / browser-mod-popup
- **Status badges** — floating chips in card corners with MDI icon, conditional icon color and conditional label text
- **Embedded HA cards** — any HA card placed at absolute coordinates (tile, gauge, custom:mini-graph-card, …)
- **Test mode** — red outlines on zones + blue outlines on elements for debugging positions
- **GUI editor** — full configuration without writing YAML

---

## Installation

### Via HACS (recommended)

1. Open HACS → Frontend → ⋮ → **Custom repositories**
2. Add `https://github.com/Michailjovic/Room-Card` as type **Lovelace**
3. Search for **Room Overlay Card** and install
4. Hard-refresh your browser (Ctrl+F5)

### Manual installation

1. Download `room-overlay-card.js` from the [latest release](https://github.com/Michailjovic/Room-Card/releases/latest)
2. Copy to `/config/www/room-overlay-card.js`
3. In HA: Settings → Dashboards → ⋮ → **Manage resources** → add `/local/room-overlay-card.js` (type: JavaScript module)
4. Hard-refresh your browser

---

## Basic configuration

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: "16/9"
border_radius: 12px
```

---

## Full configuration reference

### Top-level options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `base_image` | `string` | **required** | Path to the base room image |
| `aspect_ratio` | `string` | `16/9` | Card aspect ratio (`width/height`) |
| `border_radius` | `string` | `12px` | Card corner radius |
| `filter_transition` | `string` | `2s ease` | CSS transition for the base image filter |
| `filter_conditions` | `list` | `[]` | CSS filters driven by entity states |
| `overlays` | `list` | `[]` | Overlay image layers |
| `zones` | `list` | `[]` | Clickable zones |
| `badges` | `list` | `[]` | Status badge chips |
| `elements` | `list` | `[]` | Embedded HA cards |
| `test_mode` | `bool` | `false` | Show zone and element outlines for debugging |
| `tap_action` | `action` | — | Action when clicking the card background |

---

### Conditions (`StateCondition`)

Conditions are used throughout the configuration to drive visual state.

```yaml
# Exact state match
entity: binary_sensor.window
state: "on"

# State must not equal
entity: light.bedroom
state_not: "unavailable"

# Numeric comparison
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

Supported operators: `<` `>` `<=` `>=` `==` `!=`

---

### Base image CSS filters

```yaml
filter_conditions:
  - condition:
      entity: binary_sensor.night_mode
      state: "on"
    filter: brightness(0.3) saturate(0.2)
  - filter: brightness(1.0)   # default (no condition)
```

---

### Overlay layers

```yaml
overlays:
  - id: lights_on
    image: /local/images/bedroom_lights.png
    transition: "1.5s ease"
    conditions:
      opacity:
        - condition:
            entity: light.bedroom
            state: "on"
          value: 1
        - value: 0   # default

  - id: fan_state
    state_images:
      - entity: fan.bedroom
        state: "on"
        image: /local/images/fan_on.png
      - image: /local/images/fan_off.png   # default
    conditions:
      opacity:
        - value: 1
```

---

### Clickable zones

```yaml
zones:
  - id: light_switch
    top: "60%"
    left: "10%"
    width: "20%"
    height: "15%"
    tap_action:
      action: toggle
      entity: light.bedroom

  - id: tv_zone
    top: "20%"
    left: "50%"
    width: "35%"
    height: "40%"
    tap_action:
      action: more-info
      entity: media_player.tv

  # Conditional action
  - id: smart_switch
    top: "70%"
    left: "5%"
    width: "15%"
    height: "10%"
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

| Action | Parameters | Description |
|--------|------------|-------------|
| `navigate` | `path` | Navigate to a dashboard path |
| `more-info` | `entity` | Open entity more-info dialog |
| `call-service` | `service`, `service_data` | Call a HA service |
| `toggle` | `entity` | Toggle an entity |
| `browser-mod-popup` | `title`, `size`, `content` | Open a browser-mod popup |
| `none` | — | Do nothing |

---

### Status badges

```yaml
badges:
  - id: temp_chip
    position: bottom-right    # bottom-left / bottom-right / top-left / top-right
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
      - value: "OK"
    visible:
      entity: binary_sensor.someone_home
      state: "on"
    tap_action:
      action: more-info
      entity: sensor.temperature
```

---

### Embedded HA cards (elements)

```yaml
elements:
  - id: mini_graph
    top: "5%"
    left: "65%"
    width: "30%"
    height: "25%"
    z_index: 4
    border_radius: "8px"
    overflow: hidden
    visible:
      entity: binary_sensor.show_graph
      state: "on"
    card:
      type: custom:mini-graph-card
      entities:
        - sensor.temperature
      hours_to_show: 6
      line_width: 2
      show:
        labels: false
        icon: false

  - id: weather_tile
    top: "75%"
    left: "70%"
    width: "28%"
    height: "20%"
    card:
      type: tile
      entity: weather.home
      show_entity_picture: true
```

---

## Full example

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: "16/9"
border_radius: "12px"
filter_transition: "2s ease"
test_mode: false

filter_conditions:
  - condition:
      entity: binary_sensor.night_mode
      state: "on"
    filter: brightness(0.25) saturate(0.1)
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
      - value: "Humidity"
    visible:
      entity: sensor.bedroom_humidity
      state_not: "unavailable"

elements:
  - id: climate
    top: "3%"
    left: "3%"
    width: "35%"
    height: "18%"
    border_radius: "10px"
    card:
      type: tile
      entity: climate.bedroom
```

---

## Development

```bash
# Install dependencies
npm install

# Development build with source map
npm run build

# Production build (minified)
npm run build:prod

# Watch mode
npm run watch
```

Source code is in `src/room-overlay-card.ts` (TypeScript).  
The distributed `room-overlay-card.js` is vanilla JS with no external runtime dependencies.

---

## License

MIT © 2024 Michailjovic
