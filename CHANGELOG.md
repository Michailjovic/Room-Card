# Changelog

## [0.6.0] – 2026-05-26

### Added
- **Four fill directions for `gauges[]`** – the `orientation` property now supports all four
  cardinal directions in addition to the original two:

  | value | fill direction | typical use |
  |---|---|---|
  | `vertical` | bottom → top (default) | level / progress |
  | `top` | top → bottom | roller blind / shade |
  | `horizontal` | left → right | existing alias |
  | `right` | right → left | mirrored bar |

  `bottom` and `left` are accepted as aliases for `vertical` and `horizontal`.

- **CSS gradient support in `color`** – any valid CSS `background` value is accepted,
  including `repeating-linear-gradient(...)`. Combined with `orientation: top` this enables a
  convincing day/night roller blind simulation directly over a window area:
  ```yaml
  gauges:
    - id: blind_bedroom
      entity: cover.roller_motor_bedroom_curtain
      attribute: current_position
      min: 0
      max: 100
      orientation: top          # fills top → bottom like a real shade
      top: "13%"
      left: "38%"
      width: "24%"
      height: "45%"
      z_index: 5
      background: "transparent"
      color: >
        repeating-linear-gradient(
          to bottom,
          rgba(10,10,10,0.90) 0px,
          rgba(10,10,10,0.90) 7px,
          rgba(200,200,200,0.12) 7px,
          rgba(200,200,200,0.12) 13px
        )
  ```
  The transparent background lets the room photo show through the open portion; the gradient
  fills downward as the blind closes, mimicking actual slats.

- **GUI dropdown updated** with all four orientation options and descriptive labels.

---

## [0.5.0.1] – 2026-05-26

### Fixed
- **Attribute-based `brightness_model` sources not reacting to changes** – `_prevStates` only
  tracked entity `.state` strings, so a source like `light.living_room` with
  `attribute: brightness` would only trigger a filter update when the light was turned on/off,
  not when its brightness level changed. Added `_extractAttrSources()` which builds a list of
  all `{entity, attribute}` pairs used across `brightness_model.source`, `gauges[]`,
  `labels[]`, and `icons[]`. The change-detection guard in `set hass` and the end-of-update
  snapshot in `_update()` now track these attribute values in addition to entity states.
- **GUI editor not re-rendering when only `brightness_model` was added/modified** – the
  `setConfig` optimisation that skips re-rendering when array lengths are unchanged did not
  account for `brightness_model`. Adding or removing sources or filter-gradient stops on an
  existing card would leave the editor showing stale content. The `same` check now also
  compares `brightness_model.source.length` and `brightness_model.filter_gradient.length`.

---

## [0.5.0] – 2026-05-26

### Added
- **Redesigned `brightness_model`** – replaced the v0.4.3 additive brightness approach with a
  full **filter gradient interpolator** that blends between any number of named CSS filter stops
  (brightness, contrast, saturate, sepia, hue-rotate, blur, opacity, grayscale, invert) based
  on a normalised 0–100 % sensor value.  
  When `brightness_model` is active it **replaces** `filter_conditions` entirely — no stacking,
  no multiplicative conflicts.
  ```yaml
  brightness_model:
    source:
      - condition:                          # optional — use this source only when…
          entity: light.living_room
          operator: "="
          value: "on"
        entity: light.living_room
        attribute: brightness               # 0–255
        min_input: 0
        max_input: 255
      - entity: sensor.living_room_lux      # fallback (no condition = always matches)
        min_input: 0
        max_input: 800
    filter_gradient:
      - value: 0                            # 0 % → very dark / blue-ish
        filter: "brightness(0.25) sepia(0.3) hue-rotate(200deg)"
      - value: 50                           # 50 % → natural daylight
        filter: "brightness(1.0)"
      - value: 100                          # 100 % → overexposed / warm
        filter: "brightness(1.15) saturate(1.2)"
  ```
- **`source[]` array with per-entry conditions** – define multiple sensor/attribute sources;
  the first source whose `condition` evaluates to `true` (or whose condition is omitted) is
  used to derive the percentage.  Supports both light entity brightness attributes and
  arbitrary numeric sensors (lux, CO₂, temperature, …).
- **`lerpFilterGradient(stops, pct)`** – new module-level helper that parses each filter stop
  with the existing `parseFilterStr` / `buildFilterStr` / `FILTER_PROPS` infrastructure and
  linearly interpolates every CSS filter component between the two surrounding stops.
- **GUI editor for the redesigned `brightness_model`** – two collapsible sub-sections:
  - *Value sources* – entity, optional attribute, min/max input range, optional condition YAML
    (add/remove rows dynamically).
  - *Filter gradient stops* – value (0–100 %), filter string, add/remove rows.

### Changed
- `brightness_model` no longer adds a `brightness()` filter on top of `filter_conditions`.
  It now **replaces** `filter_conditions` when at least one source entity and one gradient
  stop are configured.  Leaving `brightness_model` empty (or unconfigured) falls back to the
  normal `filter_conditions` behaviour.

### Removed
- The v0.4.3 `brightness_model` fields (`entity`, `attribute`, `min_input`, `max_input`,
  `min_brightness`, `max_brightness`) are superseded by the new `source[]` /
  `filter_gradient[]` structure. Old configs using those fields will silently fall back to
  `filter_conditions` (the new code checks for `source` and `filter_gradient`).

---

## [0.4.3] – 2026-05-26

### Added
- **`brightness_model`** – maps a sensor value (lux, light brightness, etc.) to a CSS
  `filter: brightness()` applied on top of the base image in real time, making the room
  photo automatically darken at night and brighten during the day.
  Uses linear interpolation identical to `color_gradient`.
  Composes with `filter_conditions` — both run independently and their brightness factors
  stack in the CSS filter chain. Disabled automatically in FLIP test mode.
  ```yaml
  brightness_model:
    entity: sensor.living_room_lux
    min_input: 0          # lux → darkest
    max_input: 800        # lux → brightest
    min_brightness: 0.3   # CSS brightness() at min_input
    max_brightness: 1.1   # CSS brightness() at max_input
  ```
  Or using a light entity's brightness attribute (0–255):
  ```yaml
  brightness_model:
    entity: light.living_room
    attribute: brightness
    min_input: 0
    max_input: 255
    min_brightness: 0.25
    max_brightness: 1.0
  ```
- **GUI editor for `brightness_model`** – dedicated *Brightness model* section with fields
  for entity, attribute, min/max input range, and min/max brightness. Leave entity empty
  to disable.

---

## [0.4.2] – 2026-05-26

### Added
- **`orientation: horizontal` for `gauges[]`** – horizontal bar that fills left-to-right
  instead of the default bottom-to-top vertical bar. The `transition` default adjusts
  automatically (`width` instead of `height`).
  ```yaml
  gauges:
    - id: brightness_bar
      entity: light.living_room
      attribute: brightness
      min: 0
      max: 255
      orientation: horizontal
      width: "40%"
      height: "6px"
      top: "85%"
      left: "5%"
  ```
- Orientation dropdown added to the gauge GUI editor (`vertical` / `horizontal`).

---

## [0.4.1] – 2026-05-26

### Added
- **`visible_conditions` for `labels[]` and `gauges[]`** – show/hide an element based on
  entity state using the standard condition array syntax (first match wins).
  Falls back to the existing `visible` property if `visible_conditions` is not set.
  Gauges previously had no visibility control at all; both `visible` and `visible_conditions`
  are now supported for them.
  ```yaml
  labels:
    - id: frost_warning
      entity: sensor.outdoor_temp
      visible_conditions:
        - entity: sensor.outdoor_temp
          operator: "<"
          value: 2
          result: true
        - result: false

  gauges:
    - id: co2_bar
      visible_conditions:
        - entity: sensor.co2
          operator: ">"
          value: 800
          result: true
        - result: false
  ```
  Configured via the YAML textarea in the GUI editor (field label updated to include
  `visible` / `visible_conditions`).

---

## [0.4.0] – 2026-05-26

### Added
- **`animation` for `overlays[]`, `badges[]`, `labels[]`** – two CSS animation modes:
  - `pulse` – smooth opacity fade (1 → 0.25 → 1, 2 s, ease-in-out)
  - `blink` – hard on/off (1 s, step-end)
- **`animation_color`** – for `badges[]` and `labels[]`, adds a colored glow
  (`filter: drop-shadow`) when `pulse` is active; creates a "glowing badge/label" effect.
  ```yaml
  overlays:
    - id: alarm_overlay
      color: "rgba(255,0,0,0.35)"
      animation: pulse          # fades when overlay is visible

  badges:
    - id: alarm_badge
      icon: mdi:alarm-light
      animation: pulse
      animation_color: "#ff2222"   # red glow

  labels:
    - id: temp_label
      animation: blink             # hard blink (use sparingly)
  ```
- **GUI editor for animations** – dropdown `none / pulse / blink` on `overlays[]`,
  `badges[]` and `labels[]`; color picker for glow color on `badges[]` and `labels[]`.

---

## [0.4.x] – planned

- **`visible_conditions`** for `labels[]` and `gauges[]` – show/hide based on entity state
- **`orientation: horizontal`** for `gauges[]` – horizontal bar variant
- **`brightness_model`** – lux sensor or light entity brightness attribute →
  CSS `filter: brightness()` with linear interpolation (similar to `color_gradient`)

---

## [0.3.19] – 2026-05-25

### Added
- **`background`, `padding`, `border_radius`, `text_shadow` for `labels[]`** – labels can now
  be styled as a dark badge/chip overlay without needing external card types.

---

## [0.3.18] – 2026-05-25

### Fixed
- The `color_gradient` GUI editor for gauges was accidentally applied only to the dead copy of
  `_gaugeItem` on `RoomOverlayCard`, not to the actual editor class `RoomOverlayCardEditor`.
  The *Color Gradient Stops* section was therefore invisible in the GUI. Fixed — both copies of
  `_gaugeItem` and `_lblItem` are now identical and contain the correct gradient editor.

---

## [0.3.17] – 2026-05-25

### Added
- **`color_gradient` for `gauges[]` and `labels[]`** – smooth color interpolation based on
  entity value. Instead of discrete conditions, define a linear gradient between any number
  of color stops:
  ```yaml
  gauges:
    - id: temp_gauge
      entity: water_heater.boiler
      attribute: current_temperature
      min: 30
      max: 80
      color_gradient:
        - value: 30
          color: "#2196f3"   # blue (cold)
        - value: 55
          color: "#4caf50"   # green (optimal)
        - value: 70
          color: "#ff9800"   # orange (warm)
        - value: 80
          color: "#f44336"   # red (hot)
  ```
- **GUI editor for `color_gradient`** – both `gauges[]` and `labels[]` have a
  *Color Gradient Stops* section with rows (value + `<input type="color">` + remove button)
  and a **+ Stop** button to add new stops.

### Changed
- Internal helper functions `parseCssColor()` and `lerpColorGradient()` moved to module scope
  (shared between gauges and labels).

### Fixed
- Removed duplicate `const self` declaration inside `_collectConfig()` that caused a
  `SyntaxError` on card load.

---

## [0.3.16] – 2026-05-24

### Added
- **`attribute` support in `evalCond`** – conditions in `filter_conditions`, `overlays`,
  `zones`, `badges`, `labels` and `gauges` can now compare entity attributes instead of state:
  ```yaml
  conditions:
    - entity: water_heater.boiler
      attribute: current_temperature
      operator: ">"
      value: 60
      result: "orange"
  ```
- **Native `labels[]`** – text overlays positioned over the image; supports `entity`,
  `attribute`, `template`, `prefix`, `suffix`, `color`, `color_gradient`, `font_size`,
  `font_weight`, `position` (top/left as percentages).
- **Native `gauges[]`** – vertical value bars without dependency on `custom:button-card`
  (fixes broken height inheritance through shadow DOM); supports `entity`, `attribute`,
  `min`, `max`, `width`, `height`, `position`, `color`, `color_gradient`, `background`.

---

## [0.3.15] – 2026-05-23

### Added
- Initial `labels[]` and `gauges[]` sections (basic implementation without `color_gradient`).

### Fixed
- Embedded `custom:button-card` inside `elements[]` did not work as a gauge due to broken
  CSS height chain through the shadow DOM. Native `gauges[]` bypasses this issue.

---

## [0.3.14] – 2026-05-22

### Added
- **FLIP button in test mode** – toggles all overlays to their opposite state and applies
  the alternative base image filter; state persists across GUI editor changes.

### Fixed
- FLIP state was not reset on config edits (intentional — see 0.3.13 fix).

---

## [0.3.13] – 2026-05-22

### Fixed
- Syntax error (stray `i` character at end of file) causing
  *"Custom element doesn't exist: room-overlay-card"* after HACS installation.

---

## [0.3.12] – 2026-05-21

### Added
- Extended test mode with **⇄ FLIP** button – shows all overlays and the base image filter
  in the opposite state for quick visual testing without changing entity states.
