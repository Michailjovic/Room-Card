# Configuration reference

[← Back to README](../README.md) · See also: [Editor guide](EDITOR.md) · [Layout engine spec](../LAYOUT.md) · [Preset gallery](../PRESETS.md)

Full YAML reference for `custom:room-overlay-card`. Everything here is also reachable from the
GUI editor — see [`EDITOR.md`](EDITOR.md) for the tab-by-tab walkthrough.

---

## Top-level

| Key | Type | Default | Description |
|---|---|---|---|
| `base_image` | string | **required**¹ | Path to the room photo |
| `base_camera` | string | — | Camera entity used as live background (¹makes `base_image` optional) |
| `camera_refresh` | number | `10` | Camera snapshot refresh interval in seconds |
| `base_image_conditions` | list | — | Swap the base image by entity state |
| `weather_overlay` | object/string | — | Animated rain/snow layer (`entity`, `effect`, `opacity`, `z_index`) |
| `aspect_ratio` | string / object | `16/9` | Design aspect of the image — single `width/height` or `{portrait, landscape}` |
| `border_radius` | string / object | `12px` | Card corner radius — single value or `{portrait, landscape}` |
| `layout` | object | generated | Layout engine — height source, orientation, threshold and the two profile grids (see [Layout](#layout--two-profiles-on-a--grid)) |
| `image_fit` | string / object | `cover` | `cover` (crop) or `contain` (letterbox) — single value or `{portrait, landscape}` |
| `filter_transition` | string | `2s ease` | CSS transition for the base image filter |
| `filter_conditions` | list | `[]` | Discrete CSS filter states |
| `brightness_model` | object | — | Multi-stop filter interpolation |
| `overlays` | list | `[]` | Overlay image layers |
| `gauges` | list | `[]` | Progress gauge bars (linear or radial) |
| `blinds` | list | `[]` | Window blind visualizations |
| `zones` | list | `[]` | Clickable hit areas / sliders |
| `badges` | list | `[]` | Corner status chips |
| `icons` | list | `[]` | Icon overlays with actions |
| `labels` | list | `[]` | Value/template text labels |
| `elements` | list | `[]` | Embedded HA cards |
| `cards_above` / `cards_below` | list | `[]` | Companion HA cards stacked above/below the image |
| `light_controls` | object | — | Strip of light sliders with a lux-tracking border |
| `groups` | list | `[]` | Client-side element groups (toggle/show/hide) |
| `rooms` | list | — | Multi-room definitions (see [Multi-room](#multi-room-one-card--whole-home)) |
| `nav` | object | — | Multi-room navigation strip |
| `test_mode` | bool | `false` | Edit mode — outlines, click-to-select, resize handles, editor's live preview |
| `tap_action` | action | — | Action on card background click |
| `hold_feedback` | bool | `true` | Show the hold-gesture progress ring |
| `hold_color` | string | — | Color of the in-progress hold ring |
| `zoom` | bool | `false` | Pinch-zoom + pan (floorplan mode) |
| `parallax` | bool/object | — | Subtle tilt on pointer/device orientation |
| `haptic` | bool | `true` | Haptic feedback on actions (companion app), and the moment a hold action registers |

---

## Layout — two profiles on a % grid

Two **layout profiles** — **`portrait`** and **`landscape`** — chosen by the **shape of the
available viewport** (width/height ratio), not by device type. Rotate a tablet and the card
switches profile automatically; pin a specific device if you never want it to switch.

Each profile is a **CSS grid in % of the available screen**. Every block of the card is a
**region** you place on that grid: `nav`, `cards_above`, `image`, `lights`, `cards_below`,
`cover` (the blind controller in dock mode). You own the percentages — rows should sum to ≤ 100.

```yaml
layout:
  height: viewport      # viewport (default, full view minus HA header) | container | 90vh / 800px
  threshold: 1.0        # w/h ratio below which the card is portrait
  # orientation: landscape          # optional: force one profile
  # orientation:                    # …or pin per device (browser_mod ID)
  #   by_browser: { kitchen_tablet: landscape }
  #   default: auto

  landscape:
    columns: [88, 12]
    rows: [10, 10, 70, 5, 5]
    place:
      nav:         { row: 1 }
      cards_above: { row: 2 }
      image:       { row: 3 }
      lights:      { row: 4 }
      cards_below: { row: 5 }
      cover:       { row: 1/6, col: 2 }   # blind controller docked in the right column

  portrait:
    columns: [100]
    rows: [8, 8, 55, 6, 6, 17]
    place:
      nav:         { row: 1 }
      cards_above: { row: 2 }
      image:       { row: 3 }
      lights:      { row: 4 }
      cards_below: { row: 5 }
      cover:       { row: 6 }             # …and at the bottom on portrait
```

Rules and notes:

- A region **not listed** in a profile's `place:` is **hidden** in that profile.
- `row`/`col` take a grid line number (`3`) or a span (`"1/6"` = rows 1–5). Per-region options:
  `overflow: hidden|auto` (default hidden), `align`.
- Tracks accept `%`, `auto` (size to content), `1fr` (take the remainder) and any CSS length —
  mix freely, e.g. `rows: [75px, auto, 1fr, auto]`. Rows always **pack from the top**; leftover
  height stays at the bottom.
- Put the **image on an `auto` row** and its box sizes itself from the image's aspect — exact
  fit with no crop and no letterbox (ideal when you have controls at the image edges). Use a
  fixed `%` row + `image_fit` when you want to dictate the height instead.
- The card is designed for **panel-view / full-screen** dashboards. `height: viewport` measures
  the real available height (HA header, view padding and safe-areas accounted for). Use
  `container` or a fixed value when embedding.
- The **image region** gets a fixed box from the grid; the image renders inside it at its design
  aspect with `image_fit: cover` (crop, default) or `contain` (letterbox). **Element `%`
  positions stay glued to the image.**
- **Edit mode** shows region outlines with names, a live viewport + profile badge, and a
  **profile switch button** to preview the other profile.
- Everything is editable in the GUI **Layout tab**: height source, orientation/threshold,
  per-device pin, both profile grids and all region placements — see [`EDITOR.md`](EDITOR.md#the-four-tabs).

### Per-element profile overrides

Every element accepts `portrait:` / `landscape:` blocks merging over the base:

```yaml
labels:
  - id: temp
    top: 10%
    left: 80%
    font_size: 2%
    portrait: { top: 6%, left: 70%, font_size: 4% }
```

`aspect_ratio`, `border_radius` and `image_fit` accept a single value or `{portrait, landscape}`.

### Migrating from v3

Old configs (tiers, `breakpoints`, `max_height`, `media: mobile|desktop`, per-element
`mobile:`/`tablet:`/`desktop:`/`ultrawide:` blocks) are **auto-migrated in memory** when loaded:
`mobile` → `portrait`, `desktop` → `landscape`, `tablet`/`ultrawide` dropped, and a starter
`layout:` block is generated mirroring the old stacked look. Open the editor and press **Save
migrated config** to persist it, then tune the percentages. Full spec, terminology and
implementation notes: [`LAYOUT.md`](../LAYOUT.md).

---

## Conditions

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

## CSS filter engine

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

## Brightness model

Define named filter stops and let the card interpolate smoothly between them based on a sensor
value — continuous ambient-light simulation.

```yaml
brightness_model:
  source:
    - entity: sensor.living_room_lux
      min_input: 0
      max_input: 1000
  filter_gradient:
    - { value: 0,   filter: "brightness(0.3) saturate(0.5) sepia(0.3)" }
    - { value: 50,  filter: "brightness(1.0)" }
    - { value: 100, filter: "brightness(1.2) saturate(1.1)" }
```

The source value is normalized to 0–100 % and the matching `filter:` CSS string is interpolated
across the stops. When set, the brightness model replaces `filter_conditions`. Use any CSS
filter functions (`brightness`, `contrast`, `saturate`, `sepia`, `hue-rotate`, `blur`, `opacity`,
`grayscale`, `invert`).

---

## Overlays

Transparent PNG layers stacked over the base image.

```yaml
overlays:
  # Conditional opacity
  - id: ceiling_light
    image: /local/images/bedroom_light_on.png
    transition: "1.5s ease"
    conditions:
      opacity:
        - condition: { entity: light.bedroom_ceiling, state: "on" }
          value: 1
        - value: 0      # default

  # State-driven image switching
  - id: fan_visual
    state_images:
      - { entity: fan.bedroom, state: "on", image: /local/images/fan_on.png }
      - { image: /local/images/fan_off.png }    # default
    conditions:
      opacity:
        - value: 1

  # Tint a glow PNG from a light's live color
  - id: rgb_strip
    image: /local/strip_glow.png
    color_from: light.tv_strip   # follows rgb_color / color_temp
```

---

## Gauges

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
    color_gradient:
      - { value: 15, color: "#2196F3" }   # blue — cold
      - { value: 22, color: "#4CAF50" }   # green — comfortable
      - { value: 30, color: "#FF5722" }   # red — hot
    visible_conditions: { entity: binary_sensor.show_gauges, state: "on" }
```

### `orientation` values

| Value | Fill direction |
|---|---|
| `vertical` | bottom → top (default) |
| `top` | top → bottom |
| `horizontal` / `left` | left → right |
| `right` | right → left |
| `radial` | circular SVG arc gauge |

### Radial gauges

```yaml
gauges:
  - id: humidity_ring
    entity: sensor.bedroom_humidity
    orientation: radial
    top: "8%"
    left: "80%"
    width: "14%"
    height: "24%"
    min: 0
    max: 100
    arc: 270          # arc length in degrees (default 270)
    thickness: 10     # stroke width in viewBox units
    target: 55        # optional target tick mark
    color_gradient:
      - { value: 30, color: "#FF9800" }
      - { value: 50, color: "#4CAF50" }
      - { value: 70, color: "#2196F3" }
```

Discrete color based on state (instead of a smooth gradient):

```yaml
color:
  - condition: { entity: sensor.co2, operator: ">", value: 1000 }
    value: "rgba(255,50,50,0.9)"
  - value: "rgba(100,200,100,0.8)"
```

---

## Blinds

Visualize window covers directly on the room image.

```yaml
blinds:
  - id: bedroom_blind
    entity: cover.bedroom_blind
    attribute: current_position   # omit to use entity state (open/closed)
    min: 0      # entity value = fully open
    max: 100    # entity value = fully closed
    top_offset: 3.4  # real/visual coverage % at fully OPEN — see note below
    top: "10%"
    left: "30%"
    width: "25%"
    height: "50%"
    z_index: 6
    blind_type: day_night         # roller | venetian | day_night
    slat_color: "rgba(0,0,0,0.85)"
    slat_count: 8
    # day_night phase calibration — see "Calibrating a day_night blind" below
    shift_turns: 4      # optional, default slat_count/2
    shift_start: 0      # optional, phase in periods at fully open
    shift_snap: true    # optional, default true
```

- **`roller`** — solid fill that grows from the top as the blind closes.
- **`venetian`** — horizontal slats with gaps (`slat_width`, `slat_gap`, `gap_color`).
- **`day_night`** — zebra / dual-layer blind. Two identical striped layers are composited; how
  far they sit apart decides whether you see through the sheer bands or get a blackout, and that
  offset sweeps as the blind travels. Calibrate it with `shift_turns` / `shift_start` — see below.

> **Inverted motor direction** — if your cover reports `0` = closed and `100` = open, swap:
> `min: 100`, `max: 0`.

> **`top_offset`** — many motors keep a deliberate safety margin at their own fully-**open**
> limit, so the blind never actually retracts all the way — a sliver of material always stays
> visible. Fully **closed** is normally accurate and needs no correction. If you never see this
> in person and just want the on-screen blind to match reality, set `top_offset` to the
> real/visual coverage (%) that remains when the cover reports fully open (e.g. `3.4`); fully
> closed always stays 100% and is never touched. Works regardless of which raw direction your
> motor reports — the correction is applied to open/closed, not to raw `0`/`100`. This only
> corrects the **visual overlay** on the image — the cover-control widget (rail/presets) keeps
> showing and sending the motor's raw position, unchanged. Default `0` = no correction.
>
> `top_offset` only controls the **coverage amount** (fill height/percentage). For
> `blind_type: day_night` the striped pattern's phase is a separate axis with its own settings —
> see below. Since 6.1.0 the two no longer interfere: the reserve moves the fill, not the phase.

### Calibrating a `day_night` blind

A zebra blind is one continuous loop of striped fabric running over the roller tube, so raising
and lowering it also slides the front layer against the back layer. When their sheer bands line
up you see through; half a band period apart and the solids cover the sheers, giving a blackout.
The card reproduces that with two gradient layers and sweeps their offset as the cover moves.

| key | default | what it does |
| --- | --- | --- |
| `shift_turns` | `slat_count / 2` | How many times the overlap sweeps *see-through → blackout → see-through* across the full travel. Not derivable from `slat_count`: it depends on tube diameter, fabric thickness and band pitch, so it has to be measured. |
| `shift_start` | `0` | Phase, in periods (`0`–`1`), at fully **open**. `0` = the layers are aligned, so the leftover reserve shows its sheer bands. |
| `shift_snap` | `true` | Nudge `shift_turns` so fully closed lands exactly on anti-phase, i.e. a real blackout. Set `false` to keep your measured value verbatim. |
| `shift_legacy` | `false` | Restore the pre-6.1.0 formula exactly (phase driven by the `top_offset`-corrected position, plus a hard snap on the last percent). Ignores the three keys above. |

**How to measure it.** Run the blind from fully closed to fully open and count how many times it
goes dark → light → dark; that count is `shift_turns`. Then park it at fully open and adjust
`shift_start` until the leftover reserve on screen matches what you see on the window. Both
fields are in the GUI editor's blind panel, so you can dial them in against the live preview.

> **Before 6.1.0** the phase was computed from the position *after* `top_offset` was applied, so
> an un-retracted reserve slid the whole phase curve sideways — with 17 band pairs and
> `top_offset: 7.6` the fully-open residual sat at 71 % overlap instead of 0 %, and no
> `top_offset` value could sync it. The phase now comes from the raw travel. If you had tuned
> around the old behaviour, set `shift_legacy: true`.

### Cover control (roleta)

Add a `control:` block to a blind to turn its visualization into a slim, **icon-only**
controller — a draggable position rail, up / stop / down buttons, and quick-jump **presets**.
The controller is **hidden until you tap the window** (the blind graphic); only one shows at a
time.

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
      placement: float        # float (place freely via top/left) | dock (edge rail)
      top: "12%"              # float position — sized to the window height
      left: "34%"
      slider: true            # draggable position rail (auto-hidden for assumed-state covers)
      presets:
        - {position: 100, icon: mdi:blinds-open,         color: amber,     name: Open}
        - {position: 65,  icon: mdi:blinds,              color: orange,    name: Day}
        - {position: 2,   icon: mdi:roller-shade,        color: blue-grey, name: Peek}
        - {position: 0,   icon: mdi:roller-shade-closed, color: indigo,    name: Closed}
```

- **`placement`** — `float` (place freely with `top` / `left`; the controller is sized to the
  window height) or `dock` (a rail that fills the `cover` layout region — put that region
  wherever you want the rail, per profile, in the Layout tab).
- **`float`** (default): tap the blind to reveal / hide the controller next to it (horizontal
  bottom bar on portrait). **`dock`**: the controller is permanently visible in the `cover`
  layout region — its side and size come from where you place that region in each profile.
  `placement` accepts `{portrait, landscape}` (e.g. dock on landscape, float on portrait).
- **`slider`** — show the draggable position rail (`cover.set_cover_position`). Auto-hidden when
  the cover reports no `current_position` (assumed-state).
- **Up / Stop / Down** are always shown — a tap does a full `open_cover` / `close_cover`; `Stop`
  (`stop_cover`) highlights while the cover is moving.
- **`presets`** — one-tap jumps to a position. Each takes `position` (0–100) and optional `icon`
  (use real MDI names, e.g. `mdi:roller-shade`, `mdi:blinds` — see
  [materialdesignicons.com](https://pictogrammers.com/library/mdi/)), `color` (HA name like
  `indigo` / `amber` / `blue-grey`, or any CSS colour) and `name` (shown as a tooltip). Presets
  render as **icons only**.

![Editor — Cover control (roleta) panel](../screenshots/editor-cover-control.png)

*The same `control:` block from the GUI, on a `dock — edge rail` blind with four presets
(Otevřeno / Den / Skulina / Zavřeno — Open / Day / Gap / Closed). The live preview highlights the
selected blind so you can see exactly which window you're editing.*

---

## Clickable zones

Invisible hit areas over any part of the card.

```yaml
zones:
  - id: light_zone
    top: "55%"
    left: "8%"
    width: "20%"
    height: "18%"
    tap_action: { action: toggle, entity: light.bedroom }
```

### Slider zones

Drag across a zone to control an entity. Domains: `light` (brightness), `cover` (position),
`fan` (speed), `media_player` (volume), `climate` (temperature), `number` / `input_number`.

```yaml
zones:
  - id: dimmer
    top: "20%"
    left: "60%"
    width: "12%"
    height: "45%"
    slider:
      entity: light.bedroom_ceiling
      direction: vertical    # vertical | horizontal
      live: false            # true = send while dragging (throttled)
      color: "rgba(255,255,255,0.28)"
    tap_action: { action: toggle, entity: light.bedroom_ceiling }
```

### Action types

| Action | Required params | Description |
|---|---|---|
| `navigate` | `path` | Navigate to a dashboard path |
| `url` | `url_path` | Open a URL (`new_tab: false` for same tab) |
| `more-info` | `entity` | Open entity more-info dialog |
| `toggle` | `entity` | Toggle entity on/off |
| `call-service` / `perform-action` | `service` / `perform_action` | Call any HA action; supports `data:` and `target:` |
| `browser-mod-popup` | `title`, `size`, `content` | Open a browser-mod popup |
| `toggle-group` / `show-group` / `hide-group` | `group` | Control element groups |
| `switch-room` / `next-room` / `prev-room` / `follow-room` | — / `room` | Multi-room navigation |
| `none` | — | Do nothing |

Any action may carry `confirmation: true` (or `confirmation: {text: "..."}`). A `hold_action`
shows a **progress ring** while you press, which turns green the moment the hold registers.

```yaml
tap_action:
  action: perform-action
  perform_action: climate.set_temperature
  target: { entity_id: climate.bedroom }
  data: { temperature: 21.5 }
  confirmation: { text: Set bedroom to 21.5 °C? }
```

---

## Status badges

Floating chips anchored to card corners.

```yaml
badges:
  - id: temp_chip
    position: bottom-right    # top-left | top-right | bottom-left | bottom-right
    icon: mdi:thermometer
    icon_color:
      - condition: { entity: sensor.temperature, operator: ">", value: 26 }
        value: "orange"
      - value: "white"
    label:
      - condition: { entity: sensor.temperature, operator: ">", value: 26 }
        value: "Hot!"
      - value: "{{ states('sensor.temperature') | round(1) }} °C"
    visible: { entity: binary_sensor.someone_home, state: "on" }
    tap_action: { action: more-info, entity: sensor.temperature }
```

---

## Icons & labels

State-aware MDI icons and text values placed anywhere on the image.

```yaml
icons:
  - id: lamp
    icon: mdi:lamp
    top: "30%"
    left: "62%"
    size: "22px"            # % of card width also works (responsive)
    color:
      - condition: { entity: light.lamp, state: "on" }
        value: "#FFD54F"
      - value: "#888"
    tap_action: { action: toggle, entity: light.lamp }

labels:
  # Entity value with automatic unit
  - id: temp_label
    entity: sensor.bedroom_temperature
    top: "12%"
    left: "10%"
    decimals: 1
    suffix: auto           # appends the entity's unit_of_measurement
    font_size: "2.2%"      # % of card width — responsive
    color_gradient:
      - { value: 18, color: "#2196F3" }
      - { value: 26, color: "#FF5722" }

  # Jinja template (rendered live via WebSocket)
  - id: summary
    template: >-
      {{ states('sensor.bedroom_temperature') | round(1) }} °C ·
      {{ states('sensor.bedroom_humidity') | round(0) }} %
    top: "5%"
    left: "10%"

  # Relative time
  - id: last_motion
    entity: binary_sensor.bedroom_motion
    attribute: last_changed_ts
    format: relative         # "5 minutes ago", localized, refreshes every 30 s
    prefix: "Motion: "
```

---

## Vacuum status widget

A compact, cross-room informational badge for a multi-vacuum home — **not** a controller. Tap
fires a normal `tap_action` (typically `navigate` to wherever your real vacuum dashboard lives);
there's no start/stop/dock built in on purpose. Like `badges`/`icons`/`gauges`, `vacuum_widgets` is
a `ROOM_KEYS` entry: define it once at the top level to apply it to every room, or inside a specific
room to override/replace it just there.

```yaml
vacuum_widgets:
  - id: vac_status
    top: "90%"
    left: "4%"
    size: 44px                      # optional, default 44px; accepts % of card width too
    icon: mdi:robot-vacuum          # optional, default mdi:robot-vacuum
    tap_action:
      action: navigate
      navigation_path: /dashboard-various/vacuum
    vacuums:
      - entity: sensor.s6_kitchen_status
      - entity: sensor.s7_maxv_status
      - entity: sensor.s8_maxv_ultra_status
    # Per-profile overrides (same mechanism as icons/labels/zones) — handy for
    # bumping the widget up on the phone layout without touching the desktop one:
    portrait:
      size: 56px
      top: "92%"
      left: "6%"
```

The widget renders as a frosted-glass disc (blurred glass centre, thin coloured accent ring, drop
shadow for depth against the room photo) rather than a flat filled circle, with a tap-press
scale-down for tactile feedback — matching the look already used for badges/hold-indicators
elsewhere in this card. `size` supports the same per-profile overrides (`portrait`/`landscape`, or
legacy `mobile`/`desktop`) as `icons`/`labels`, so a phone-specific size (and position) no longer
requires a second, separately-configured widget.

Each entry under `vacuums` needs a **status sensor** (`device_class: enum` — the `sensor.*_status`
kind some Roborock/Xiaomi integrations expose, with values like `cleaning`, `segment_mopping`,
`clean_mop_mopping`, `error`…), not the `vacuum.*` domain entity itself. The real-time status string
is classified per vacuum, then combined across the whole list into one result:

| Result | When | Look |
|---|---|---|
| rest | every vacuum idle/charging/docked | dim icon, no animation |
| error | any vacuum reports `error`/`charging_problem` | red, blinking — overrides everything else |
| dry | vacuum(s) actively vacuuming, none mopping | amber, spinning icon |
| wet | vacuum(s) actively mopping, none vacuuming | blue, expanding ripple |
| both | a combined vac+mop job, *or* different vacuums doing dry and wet at once | split amber/blue accent ring |
| active | something's happening with no confident dry/wet claim (docking, mapping, manual driving, the mop's own dock-side wash/dry cycle, …) | neutral glow |

When 2+ configured vacuums are active at once, a small numeral badge appears in the icon's corner.
An unrecognised future status string is treated as `active`, never silently as `rest`.

This widget is intentionally left out of `nav.live: full`/`custom` mini thumbnails — it summarises
*multiple* vacuums at once, which doesn't reduce to thumbnail scale the way a single-entity badge
does. There's no dedicated GUI editor panel yet; configure it via YAML (it survives opening/saving
the visual editor like any other config key).

---

## Embedded HA cards

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
    visible: { entity: binary_sensor.show_graph, state: "on" }
    card:
      type: custom:mini-graph-card
      entities: [sensor.bedroom_temperature]
      hours_to_show: 6
```

### Companion cards (above / below the image)

Stack full HA cards above or below the room image — handy on mobile where positioned overlays
get cramped. Per room. Each entry is a card config, or `{card, height, media}`.

```yaml
cards_below:
  - type: entities
    entities: [light.bedroom_ceiling, fan.bedroom]
  - card: { type: thermostat, entity: climate.bedroom }
    height: 180px
    media: portrait        # all | portrait | landscape (legacy mobile/desktop still map)
```

In the GUI these live in the **Image** tab as *Cards above image* / *Cards below image* — paste
a card config you built elsewhere.

---

## Light controls (sliders with lux ring)

A GUI-configurable strip of [`material-slider-card`](https://github.com/PRProd/lovelace-slider-button-card)
sliders rendered above the image, one per light or switch. Each slider's **border colour tracks
a lux sensor**: a smooth gradient interpolated in HSL between two colours you pick — dark for
low lux, bright for high lux. This replaces hand-written `card_mod` + Jinja templates; the ring
colour is computed in JS and pushed through the card's own CSS variables (no `card_mod`
dependency for the ring). Per room.

```yaml
light_controls:
  entities:
    - light.panel_bedroom_1
    - entity: light.panel_bedroom_2
      name: Middle            # optional per-slider name
    - light.panel_bedroom_3
  columns: 3                  # grid columns (default: number of lights)
  height: 20                  # px number, or "4vh" / "5%" of screen height, or {portrait, landscape}
  lux_sensor: sensor.kitchen_illuminance
  lux_max: 50                 # lux value that maps to the "bright" colour
  color_low: "#261a66"        # border colour at 0 lux (dark)
  color_high: "#f4c025"       # border colour at/above lux_max (bright)
  bg_off: "#000000"           # slider background while the light is off
```

`color_low` / `color_high` accept any CSS colour (`#hex`, `rgb(...)`, `hsl(...)`); the gradient
is interpolated in HSL so a blue→amber ramp travels through vivid hues rather than a muddy RGB
midpoint.

`height` accepts a plain number (px), a **viewport unit** (`4vh`, or `5%` of the screen height)
or a **per-profile** object (e.g. `{portrait: 20, landscape: 60}`) — a fixed px looks tiny on
desktop, so a `vh` value scales across screens (resolved to px at render). When a light is
**on**, `material-slider-card`'s `colorize` takes over the fill with the light's real colour and
brightness, so `bg_off` is only visible when the light is off. Non-light entities (switches) get
a toggle pill sharing the same lux ring instead of a brightness slider.

Requires the `material-slider-card` resource to be installed. In the GUI these live in the
**Elements** tab under *Light controls*.

![Editor — Light & switch controls panel](../screenshots/editor-light-controls.png)

*Three lights with per-slider names, a lux sensor driving the gradient, and the live gradient
preview — the same blue→amber ramp `color_low`/`color_high` produce, rendered so you can check it
before saving instead of guessing at hex values.*

---

## Camera background & weather effects

```yaml
type: custom:room-overlay-card
base_camera: camera.living_room      # base_image becomes optional
camera_refresh: 5                    # seconds (paused off-screen)
weather_overlay:
  entity: weather.home               # auto: rainy→rain, pouring→heavy rain,
                                     # snowy→snow, fog→fog, lightning-rainy→rain+flashes
  # effect: rain                     # manual: rain | rain-heavy | snow | snow-heavy | fog | lightning
  angle: 115deg                      # optional — tilt rain (wind)
  opacity: 0.45
```

---

## Template visibility

Any zone, icon, badge, overlay, embedded card, gauge or blind can be driven by a Jinja2 template
(rendered live over WebSocket). `visible_template` takes precedence over `visible` /
`visible_conditions`:

```yaml
zones:
  - id: tv_zone
    visible_template: "{{ is_state('media_player.tv', 'on') and now().hour >= 18 }}"

badges:
  - id: power_chip
    icon: mdi:flash
    label_template: "{{ states('sensor.power') | round(0) }} W"
```

---

## Groups (pop-up control panels)

Bundle several elements under a named group and show/hide them together — e.g. a control panel
that appears when you tap an icon. Each element gets `group: <name>`; the `groups:` section
defines the panel's background/position and default visibility; actions (`toggle-group` /
`show-group` / `hide-group`) flip it.

```yaml
icons:
  - id: open_panel
    icon: mdi:tune
    top: 80%
    left: 90%
    tap_action: { action: toggle-group, group: controls }

groups:
  - id: controls
    visible: false
    style: { top: 60%, left: 60%, width: 38%, height: 35%, background: "rgba(0,0,0,0.6)", border_radius: 12px }

elements:
  - id: light_tile
    group: controls
    top: 62%
    left: 62%
    width: 34%
    height: 14%
    card: { type: tile, entity: light.bedroom }
```

---

## Multi-room (one card = whole home)

Define your rooms and the card **builds the navigation menu for you automatically** — you don't
lay out a single button. From the `rooms:` list it generates a switcher in the style you pick
(`thumbnails`, `tabs`, `dots`, or `none`): the thumbnails are live, filtered copies of each room
(so a dimmed room looks dimmed in the menu too), and you can drop `{room}` chips on them to show
each room's temperature, humidity, etc. Position it top, bottom, a side rail on ultrawide, or let
it choose with `position: auto`.

```yaml
type: custom:room-overlay-card
aspect_ratio: "16/9"            # card-level keys are shared by all rooms
card_id: flat_main              # pairing key (editor/save matching)
room_entity:                    # string, or per-device mapping:
  default: sensor.phone_alice_area       # Bermuda area sensor / input_select
  by_user:                      # logged-in HA user (case-insensitive)
    Alice: sensor.phone_alice_area
  by_browser:                   # browser_mod browser ID (wall tablets)
    wall_tablet_living: sensor.phone_alice_area
follow_hold: 60                 # s — manual navigation outranks presence
follow_mode: always             # always | initial (only on load) | manual (button only)
room_state_entity: input_text.active_room   # card mirrors the active room here
url_sync: true                  # opt-in: keep the active room in the URL → #room=<id>
nav:
  style: thumbnails             # thumbnails | tabs | dots | none
  position: auto                # top | bottom | left | right | auto
  auto_breakpoint: 1100         # auto: side rail above this card width (ultrawide)
  height: 64px
  live: composite               # thumbnails become MINI-ROOMS: base + active overlays + filters
  chips:                        # {room} → room id; per-room `chips:` overrides
    - { entity: sensor.{room}_temperature, decimals: 1, suffix: "°" }
rooms:
  - id: livingroom
    name: Obývák
    icon: mdi:sofa              # only shown when nav style = tabs
    base_image: /local/livingroom.webp
    area_match: [Living room]   # states of room_entity mapping here
    zones:
      - id: door_bedroom        # a door as a portal to another room
        top: "30%"
        left: "70%"
        width: "10%"
        height: "40%"
        tap_action: { action: switch-room, room: bedroom }
  - id: bedroom
    name: Bedroom
    base_image: /local/bedroom.webp
    area_match: [Bedroom, Ložnice]
```

With **`nav.live: composite`** every thumbnail becomes a **live mini-room**: it stacks the
room's currently *active* overlay images (lit lamps, open windows, …) over its base image,
applies the room's conditional base image and its `filter_conditions` / `brightness_model`
filter — so the menu really is a scaled-down copy of each room's current look, updating live.
It's pure CSS background compositing (no extra card instances or subscriptions), with two
approximations: an overlay shows whenever its opacity resolves above 0, and grouped (pop-up
panel) or `visible_template`-driven overlays are skipped.

With **`nav.live: full`** every thumbnail becomes a real, independent, non-interactive copy of
the room — gauges, labels, icons, badges, blinds, embedded cards, everything, not just image
layers. Each mini renders at a fixed reference width (`nav.mini.width_ref`) and is scaled down as
a whole, so fonts/icons/gauge strokes keep the exact same proportions as the full-size card, just
smaller. It shows everything unconditionally — there's no per-element filtering (that's what
`custom` is for, below). Configurable in the editor (*Rooms & menu* tab → *Live thumbnails* →
*full*, reveals a *Mini-room settings* panel) or directly in YAML:

```yaml
nav:
  style: thumbnails
  live: full
  mini:
    templates: false     # opt-in — label/colour templates cost a WS subscription per mini
    camera_refresh: 30    # seconds, clamped >= 30 regardless of the room's own setting
    width_ref: 480         # px — reference width each mini renders at before scaling down
```

Templates and camera streams are extra per-instance subscriptions, so they default off. This is
heavier than `composite` (real DOM trees + scaled compositing layers, one per room) — test on
your actual tablet before enabling on more than a couple of rooms.

With **`nav.live: custom`** every mini uses that exact same real-instance mechanism, but instead
of showing everything, it starts **empty** — only elements you opt in appear. Add
`nav_mini: true` to any gauge, label, icon, badge, blind, or embedded card to include it, and
`weather_nav_mini: true` (top-level or per room) for the weather overlay:

```yaml
nav:
  style: thumbnails
  live: custom
gauges:
  - id: temp_gauge
    entity: sensor.bedroom_temp
    nav_mini: true   # shows in the mini; omit or set false to hide it there
weather_nav_mini: true
```

The editor has a matching "Show in mini" checkbox on every element's panel (and a weather toggle
in the Basic tab) once `live: custom` is selected. Useful when a room is too busy to look good
shrunk down in full, or one specific embedded card doesn't belong at thumbnail scale.

Switching works several ways: nav thumbnails/tabs, the **follow button** (crosshair that lights
up when you're away from your presence room; `{action: follow-room}`), **finger-attached swipe**
(the room follows your finger; release past 25 % or fling to commit), **mouse-wheel** on desktop
(`nav.wheel: horizontal | vertical | both`), the `switch-room` / `next-room` / `prev-room`
actions, and automatic **presence follow** via `room_entity`. With **`url_sync: true`** the
active room is written to the page URL as `#room=<id>` (set `url_sync: <key>` for a custom hash
key), so rooms become **bookmarkable and shareable** — opening a `#room=bedroom` link jumps
straight there, and browser back/forward navigates rooms. Updates, templates and camera refresh
run only for the active room. Top-level room-scoped keys act as defaults for every room. Without
`rooms:` the card behaves as a single room; the editor has a one-click **Convert to multi-room**
button, and you can **reorder rooms** with the ▲▼ buttons in the *Rooms & menu* tab.

---

## Complete example

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: { portrait: 4/3, landscape: 16/9 }
border_radius: "12px"

filter_conditions:
  - condition: { entity: binary_sensor.night_mode, state: "on" }
    filter: brightness(0.25) saturate(0.1) sepia(0.3)
  - filter: brightness(1.0)

overlays:
  - id: ceiling_light
    image: /local/images/bedroom_ceiling_on.png
    transition: "1.5s ease"
    conditions:
      opacity:
        - condition: { entity: light.bedroom_ceiling, state: "on" }
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
      - { value: 16, color: "#2196F3" }
      - { value: 22, color: "#4CAF50" }
      - { value: 30, color: "#FF5722" }

zones:
  - id: ceiling_switch
    top: "55%"
    left: "8%"
    width: "18%"
    height: "20%"
    tap_action: { action: toggle, entity: light.bedroom_ceiling }
    hold_action: { action: more-info, entity: light.bedroom_ceiling }

badges:
  - id: humidity
    position: bottom-left
    icon: mdi:water-percent
    label:
      - value: "{{ states('sensor.bedroom_humidity') | round(0) }} %"
    tap_action: { action: more-info, entity: sensor.bedroom_humidity }
```

See **[PRESETS.md](../PRESETS.md)** for a gallery of copy-paste recipes (day/night filters,
weather moods, dimmer zones, door portals, Bermuda presence multiroom…).

---

## Positioning tips

All `top`, `left`, `width`, `height` values are percentage strings relative to the card. Enable
**Edit mode** to position by eye: click an element to select it, drag to move (snaps to 0.5 %,
Alt = free), drag handles to resize, arrow keys to nudge, or draw a new zone on an empty area.
The live viewport/profile badge shows which layout profile is active. Full Edit-mode walkthrough:
[`EDITOR.md`](EDITOR.md#edit-mode).
