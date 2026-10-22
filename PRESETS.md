# Preset Gallery

Copy-paste recipes for common looks. Combine freely — all snippets are plain
config fragments for `custom:room-overlay-card` (put them at room level when
using `rooms:`). Every key is in the [reference](docs/REFERENCE.md); pages:
[cockpit](#cockpit-sections), [overview](#overview-page-v6300),
[floor plan](#floor-plan-page-v6470).

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

## Zoom into a large picture

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

# Responsive & layout

Two layout profiles, `portrait` and `landscape`, picked by the shape of the space the card gets.
Guide: [Layout — two profiles](docs/CONFIGURATION.md#layout--two-profiles-on-a--grid). (The v3
tier keys — `mobile:` / `tablet:` / `desktop:` / `ultrawide:`, `max_height`, `breakpoints` — are
still migrated on load, but write the profile form.)

## One card, every screen — crop per profile

```yaml
# Full width everywhere; a taller crop on phones.
aspect_ratio:
  portrait: 4/3
  landscape: 16/9
```

## A wall tablet that never rotates the layout

```yaml
layout:
  height: viewport
  orientation:
    by_browser: { kitchen_tablet: landscape }   # browser_mod browser id
    default: auto
```

## Nudge one element on phones

```yaml
labels:
  - id: temp
    top: 10%
    left: 80%
    font_size: 2%
    portrait: { top: 6%, left: 70%, font_size: 4% }
```

## Companion cards on phones only

```yaml
# Full HA cards stacked below the image, shown only in the portrait profile.
cards_below:
  - card: { type: thermostat, entity: climate.bedroom }
    media: portrait
  - card:
      type: entities
      entities: [light.bedroom_ceiling, fan.bedroom]
    media: portrait
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

---

## Lamps that actually light the room (v6.6.0)

Three glows on one photo: a warm bedside lamp, a cyan LED strip behind the TV, and an
under-cabinet wash. Each follows its own light's colour and brightness.

```yaml
glows:
  - id: bedside
    entity: light.bedside_lamp
    top: 46%
    left: 14%
    size: 24%
    intensity: 0.8            # colour + brightness come from the lamp itself

  - id: tv_bias
    entity: light.tv_backlight
    shape: ellipse
    top: 38%
    left: 62%
    width: 30%
    height: 12%
    falloff: tight
    intensity: 0.7

  - id: kitchen_under_cabinet
    entity: light.under_cabinet
    shape: wash
    anchor: corner
    top: 30%
    left: 55%
    width: 38%
    height: 30%
    angle: 180deg             # spills downward from the cabinet
    falloff: wide
    color: 3000K
    intensity: 0.65
```

## A fireplace that flickers

```yaml
glows:
  - id: fireplace
    entity: switch.fireplace
    top: 72%
    left: 50%
    size: 30%
    color: "#ff8a3c"
    falloff: soft
    intensity: 0.85
    animation: flicker
    animation_speed: 2.6s
```

---

## Things that move (v6.7.0)

Each of these needs a PNG of **just the moving part**, sitting over a base image where the rest of
the scene (frame, opening, wall) is already drawn.

```yaml
overlays:
  # A door that swings on its hinge
  - id: door_leaf
    image: /local/dvere_kridlo.png
    z_index: 2
    conditions: { opacity: [{ value: 1 }] }
    transform:
      entity: binary_sensor.vchodove_dvere
      origin: 22% 55%              # the hinge, in % of the photo
      perspective: 1100px
      transition: 0.9s ease
      map:
        "off": rotateY(0deg)
        "on": rotateY(-68deg)

  # A garage door that slides up with its position
  - id: garage_door
    image: /local/vrata.png
    z_index: 2
    conditions: { opacity: [{ value: 1 }] }
    transform:
      entity: cover.garaz
      attribute: current_position
      transition: 1.4s ease
      from: { value: 0, transform: "translateY(0%)" }
      to:   { value: 100, transform: "translateY(-92%)" }

  # A ceiling fan whose blades follow its speed
  - id: fan_blades
    image: /local/lopatky.png
    z_index: 3
    conditions: { opacity: [{ value: 1 }] }
    transform:
      entity: fan.obyvak
      attribute: percentage
      origin: 76% 43%              # the axle
      spin: { min_duration: 0.4s, max_duration: 2.5s }
```

A drawer or an oven flap is the same `from`/`to` recipe with `translateX(...)` or `rotateX(...)`.


---

# Overview page (v6.30.0)

## Whole home on one screen

A page that shows every room as a live tile, your alert ticker and two status pills on top,
weather and calendar on the left (a compact weather card on phones) and the cockpit sections as a
dock. Tap a room and it zooms open. Paste it as the **first** entry of `rooms:` to open the card
on it; keep `nav.cards` holding your ticker — the header reuses it.

```yaml
rooms:
  - id: overview
    name: Přehled
    icon: mdi:view-dashboard
    overview:
      header:
        items:
          - pill: { entity: sensor.dhw_temperature, icon: mdi:water-boiler, prefix: "DHW " }
          - pill: { entity: sensor.house_power, icon: mdi:flash }
          - nav_cards: true                  # the alert ticker from nav.cards
      left:
        width: 26%
        cards:
          - card: { type: weather-forecast, entity: weather.home, forecast_type: hourly }
            media: landscape
          - card: { type: calendar, entities: [calendar.family], initial_view: listWeek }
            media: landscape
          - card: { type: weather-forecast, entity: weather.home, show_forecast: false }
            media: portrait                  # phones: one compact line above the rooms
      grid:
        columns: { landscape: 3, portrait: 2 }
        style: { portrait: card }            # or row — list rows on the phone
      dock: {}                               # one launcher per section
  # … your rooms follow
```

Per room, choose which part of the photo the tile shows and what its round buttons do:

```yaml
  - id: bedroom
    overview_tile:
      focus: 50% 35%
      chips:
        - light.bedroom_ceiling
        - cover.bedroom
        - entity: media_player.bedroom_tv
          icon: mdi:television
```

---

# Cockpit (sections)

## A whole-house cockpit

Pop-up panels of tiles, opened from launcher icons on the photo that show what is running inside.
One section collects tiles tagged on elements in the rooms (the dishwasher where it stands in the
kitchen photo), the others fill themselves from a domain. On an overview page, `dock: {}` puts one
launcher per section under the room grid. Guide:
[Sections & panels](docs/CONFIGURATION.md#sections--panels-cockpit-tiles).

```yaml
type: custom:room-overlay-card
sections:
  - id: appliances
    title: Appliances
    icon: mdi:washing-machine
    placement: sheet-right
    columns: 2
  - id: heating
    title: Heating
    icon: mdi:radiator
    source: auto
    domain: climate
  - id: blinds
    title: Blinds
    icon: mdi:blinds
    source: auto
    domain: cover
    placement: sheet-bottom
  - id: media
    title: Media
    icon: mdi:cast
    source: auto
    domain: media_player
rooms:
  - id: kitchen
    name: Kitchen
    base_image: /local/kitchen.webp
    zones:
      - id: dishwasher
        top: 62%
        left: 40%
        width: 12%
        height: 18%
        section: appliances              # its tile appears in the Appliances panel
        tile:
          name: Dishwasher
          entity: sensor.dishwasher_operation_state
          icon: mdi:dishwasher
          active_state: run                # "running" = this state
          progress: sensor.dishwasher_program_progress
    icons:
      - id: launch_appliances
        icon: mdi:washing-machine
        chip: true
        top: 6%
        left: 88%
        tap_action: { action: open-section, section: appliances }   # ring + badge while something runs
      - id: launch_heating
        icon: mdi:radiator
        chip: true
        top: 18%
        left: 88%
        tap_action: { action: open-section, section: heating }
```

---

# Floor plan page (v6.47.0)

## The home from the vacuum's map

Add the page in Room Card Studio (*Add a floor plan page* → **AnyVac**) — the import writes the
rooms, doors and the source for you; this is what to set around it. Without
[AnyVac](https://github.com/Michailjovic/anyvac) draw or trace the rooms instead and leave out
`vacuums:`. Guide: [docs/FLOORPLAN.md](docs/FLOORPLAN.md).

```yaml
rooms:
  - id: home
    name: Floor plan
    icon: mdi:floor-plan
    floorplan:
      theme: night
      theme_by: { portrait: tiles, light: clay }   # a lighter look on phones and light themes
      rotate: { landscape: 0, portrait: 90 }       # long side along the screen
      presence: [sensor.anna_area, sensor.tom_area]
      vacuums:
        - entity: sensor.downstairs_anyvac_map
          color: "#03a9f4"
      trail_mode: cleaning                          # the trail only while a vacuum cleans
      layers: { cleaning: true }                    # "vacuumed 5 h · mopped 2 d" on each room
      rooms:
        - room: living_room
          polygon: [[0,0.4],[5.35,0.4],[5.35,4.55],[0,4.55]]
          floor: wood
          lights: [light.living_ceiling, light.living_lamp]
          climate: climate.living_floor
          temperature: sensor.living_temperature
          media: media_player.living_tv
      openings:
        - { type: door, at: [5.35, 2.2], width: 0.9, entity: binary_sensor.living_door }
        - { type: window, at: [2.5, 0.4], width: 1.4, entity: binary_sensor.living_window,
            cover: cover.living_blind, blind_type: roller }
      items:
        - { entity: switch.coffee_machine, icon: mdi:coffee-maker, at: [4.6, 1.0] }
        - { type: label, entity: sensor.outdoor_temperature, suffix: "°", at: [2.5, 0.1] }
```

## A floor plan for one purpose

A second plan page can show only what one screen needs — say a cleaning view by the front door:
one vacuum, no presence, no media, the rooms' last-cleaned times and the clean buttons.

```yaml
rooms:
  - id: cleaning
    name: Cleaning
    icon: mdi:robot-vacuum
    floorplan:
      theme: blueprint
      vacuums: [sensor.downstairs_anyvac_map]
      clean_mode: both
      layers: { presence: false, media: false, lights: false, heating: false, attention: false, cleaning: true }
      rooms:
        - room: living_room
          polygon: [[0,0.4],[5.35,0.4],[5.35,4.55],[0,4.55]]
```

