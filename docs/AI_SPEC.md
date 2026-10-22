# Room Overlay Card — spec for AI assistants

[← Back to README](../README.md) · [Reference](REFERENCE.md) · [Configuration](CONFIGURATION.md) · [`llms.txt`](../llms.txt)

This page is written for language models (and people) who write `custom:room-overlay-card`
configs for someone else's Home Assistant. It has the model of the card, the rules that keep a
config valid, task recipes, and — at the end — the complete key grammar generated from the
card's schema. If a key is not in the grammar, the card does not know it.

---

## 1. The model

- **The card** (`type: custom:room-overlay-card`) shows one **room photo** (`base_image`, or a
  camera with `base_camera`) and **elements** placed on it. Positions are in **% of the image**
  (`top: "40%"`, `left: "22%"`); sizes in % or px.
- **Element lists** (each item has a unique `id` within its list): `zones` (invisible tap / slider
  areas), `icons`, `labels`, `badges` (corner chips), `gauges`, `blinds`, `glows` (light spill),
  `overlays` (PNG layers), `elements` (embedded Lovelace cards), `vacuum_widgets`, `groups`.
- **Rooms:** with `rooms:`, one card holds the whole home. Each room has its own image and
  element lists. Keys marked *room-scoped* in the grammar can also sit at the top level as the
  default for every room. A room can instead be a **page**: `overview:` (every room as a tile) or
  `floorplan:` (a vector plan of the home).
- **The photo reacts:** `filter_conditions` (CSS filter per condition) and `brightness_model`
  (filter stops blended by a sensor) dim and tint it; `glows` light up lamps in it.
- **Layout:** two profiles, `portrait` and `landscape`, chosen by the shape of the space the card
  gets. Any element can override its keys per profile (`portrait: {top: "60%"}`). The `layout:`
  block places the image, nav strip, light controls and companion cards on a % grid.
- **Sections** (`sections:` at the top level) are pop-up panels of tiles. Elements join one with
  `section: <id>` and a `tile:`; a section can also fill itself (`source: auto`, `domain:`) or
  declare `tiles:`. `tap_action: {action: open-section, section: <id>}` opens it.
- **Actions** follow Home Assistant's (`toggle`, `more-info`, `navigate`, `perform-action`, `url`,
  `none`, `fire-dom-event`) plus the card's own: `switch-room`, `next-room`, `prev-room`,
  `follow-room`, `open-section`, `close-section`, `toggle-group`, `show-group`, `hide-group`,
  `browser-mod-popup`.

## 2. Rules

1. **Never invent entity ids.** Use the ids the user gave you, or say which ones they need to fill
   in. The same for image paths: `/local/<file>` is `/config/www/<file>`.
2. Every element needs an **`id`**, unique in its list (`[A-Za-z0-9_-]`, no spaces). Section and
   group ids are referenced elsewhere — keep them consistent.
3. Lengths are strings with a unit (`"40%"`, `"24px"`) or plain numbers (px). Quote `%` values.
4. Conditions are objects: `{entity: sun.sun, state: below_horizon}`, `{entity: x, state_not: off}`,
   `{entity: x, operator: ">", value: 25}`, combined with `and:` / `or:`.
5. Templates are Home Assistant Jinja strings (`"{{ states('sensor.x') }}"`) and only work in the
   keys typed *tmpl* in the grammar (`label.template`, `visible_template`, `tile.value`, …).
6. Use the newest form: `layout:` (not `max_height` / `breakpoints`, which are v3 keys);
   `perform-action` with `perform_action:` (not `call-service`); leave out `test_mode`.
7. The page-type rooms (`overview`, `floorplan`) take no `base_image` and no elements.
8. A floor plan from a vacuum map needs the **AnyVac** integration
   (`sensor.<vacuum>_anyvac_map`); geometry is in metres and is best made by the studio's import,
   not by hand. Without AnyVac, rooms are drawn as polygons.
9. Prefer telling the user to build or adjust it in **Room Card Studio** (Edit card → Open
   Studio) when the task is about positions on the photo: they can drag elements there.
10. Check the result against the grammar below; the studio's status bar runs the same check.

## 3. Recipes

**A room with a lamp you can toggle by tapping it on the photo.**

```yaml
type: custom:room-overlay-card
base_image: /local/living.webp
aspect_ratio: "16/9"
icons:
  - id: floor_lamp
    entity: light.floor_lamp
    icon: mdi:floor-lamp
    top: "58%"
    left: "22%"
    tap_action: { action: toggle }
glows:
  - id: floor_lamp_glow
    entity: light.floor_lamp
    top: "52%"
    left: "22%"
    size: "26%"
```

**Darken the photo at night.**

```yaml
filter_conditions:
  - condition: { entity: sun.sun, state: below_horizon }
    filter: brightness(0.35) saturate(0.5)
  - filter: brightness(1)
```

**A temperature on the furniture, red above 25 °C.**

```yaml
labels:
  - id: temp
    entity: sensor.living_temperature
    suffix: " °C"
    decimals: 1
    top: "30%"
    left: "70%"
    color:
      - condition: { entity: sensor.living_temperature, operator: ">", value: 25 }
        value: "#ef4444"
      - value: "#ffffff"
```

**Drag up and down on a lamp to dim it.**

```yaml
zones:
  - id: dimmer
    top: "20%"
    left: "60%"
    width: "12%"
    height: "45%"
    slider: { entity: light.ceiling, direction: vertical }
    tap_action: { action: toggle, entity: light.ceiling }
```

**A blind that comes down with the cover.**

```yaml
blinds:
  - id: window_blind
    entity: cover.living_blind
    attribute: current_position
    blind_type: roller
    top: "12%"
    left: "40%"
    width: "20%"
    height: "45%"
    control: true
```

**The whole home, following the person around.**

```yaml
type: custom:room-overlay-card
room_entity: sensor.anna_area
nav: { style: thumbnails, position: bottom }
rooms:
  - id: living
    name: Living room
    area_match: [living_room]
    base_image: /local/living.webp
  - id: bedroom
    name: Bedroom
    area_match: [bedroom]
    base_image: /local/bedroom.webp
```

**Move an element on phones only.**

```yaml
icons:
  - id: tv
    entity: media_player.tv
    icon: mdi:television
    top: "40%"
    left: "50%"
    portrait: { top: "55%", left: "45%" }
```

**Show an element only when something is on.**

```yaml
badges:
  - id: washer_running
    position: top-right
    icon: mdi:washing-machine
    label: Washing
    visible: { entity: sensor.washer_state, state: run }
```

**A panel of all thermostats, opened from an icon.**

```yaml
sections:
  - id: heating
    title: Heating
    icon: mdi:radiator
    source: auto
    domain: climate
icons:
  - id: open_heating
    icon: mdi:radiator
    chip: true
    top: "8%"
    left: "90%"
    tap_action: { action: open-section, section: heating }
```

**An overview page first.**

```yaml
rooms:
  - id: overview
    name: Home
    icon: mdi:home
    overview:
      grid: { columns: { landscape: 3, portrait: 2 } }
      dock: {}
  - id: living
    name: Living room
    base_image: /local/living.webp
```

**A floor plan page** (geometry from the studio's AnyVac import, or drawn there):

```yaml
rooms:
  - id: plan
    name: Floor plan
    icon: mdi:floor-plan
    floorplan:
      theme: night
      rooms:
        - room: living
          polygon: [[0,0],[5.2,0],[5.2,4.4],[0,4.4]]
          lights: light.living_ceiling
          temperature: sensor.living_temperature
      openings:
        - { type: door, at: [5.2, 2.0], width: 0.8 }
  - id: living
    name: Living room
    base_image: /local/living.webp
```

**Any Lovelace card on the photo.**

```yaml
elements:
  - id: thermostat_card
    top: "60%"
    left: "5%"
    width: "30%"
    card: { type: thermostat, entity: climate.living }
```

## 4. Grammar (generated)

<!-- BEGIN GENERATED: schema -->
```text
// Generated from src/schema/roc-schema.js by tools/gen-docs.js — do not edit by hand.
// key!  = required · key = default · @x.y.z = since · room-scoped keys (R) also work at the top level
// str num bool len(number or CSS length) url entity tmpl(may hold a Jinja template) color any
// card(Lovelace card config) map(free object) prof<T>(T or {portrait: T, landscape: T}) T[] = list
// Every element type also takes portrait: / landscape: with its own keys (per-profile overrides).

// ---- Card and rooms
card {
  type!: str;
  card_id: str;
  layout: layout;
  aspect_ratio: prof<str>;
  lock_aspect: str | bool;
  border_radius: prof<len>;
  image_fit: prof<"cover"|"contain">;
  image_align: prof<"top"|"center"|"bottom">;
  filter_transition: str = "2s ease";
  rooms: room[];
  nav: nav;
  sections: section[];
  room_entity: entity | roomEntity;
  room_state_entity: entity | roomEntity;
  follow_mode: "always"|"initial"|"manual" = "always";
  follow_hold: num = 60;
  url_sync: bool | str;
  test_mode: bool = false;
  zoom: bool = false;
  parallax: bool | parallax;
  haptic: bool = true;
  hold_feedback: bool = true;
  hold_color: color;
  weather_nav_mini: bool;
  grid_options: map;
  view_layout: map;
  card_mod: map;
}
room {
  id: str;
  name: str;
  icon: str;
  area_match: str[] | str;
  chips: navChip[];
  nav_hidden: bool;
  nav_mini: bool;
  overview: bool | overview @6.30.0;
  overview_tile: overviewTile @6.30.0;
  floorplan: bool | floorplan @6.47.0;
  weather_nav_mini: bool;
  base_image: url (R);
  base_camera: entity (R);
  camera_refresh: num = 10 (R);
  base_image_conditions: baseImageCond[] (R);
  weather_overlay: entity | weather (R);
  filter_conditions: filterCond[] (R);
  brightness_model: brightnessModel (R);
  overlays: overlay[] (R);
  zones: zone[] (R);
  badges: badge[] (R);
  elements: element[] (R);
  icons: icon[] (R);
  labels: label[] (R);
  gauges: gauge[] (R);
  vacuum_widgets: vacuumWidget[] (R);
  glows: glow[] (R);
  blinds: blind[] (R);
  groups: group[] (R);
  tap_action: action (R);
  cards_above: companion[] (R);
  cards_below: companion[] (R);
  light_controls: lightControls (R);
}
roomEntity {
  default: entity;
  by_browser: map;
  by_user: map;
}
parallax {
  source: "auto"|"orientation"|"pointer" = "auto";
  strength: num = 6;
  scale: num = 1.04;
}

// ---- Layout
layout {
  height: len | "viewport"|"fill"|"container" = "viewport";
  orientation: "auto"|"portrait"|"landscape" | orientation = "auto";
  threshold: num = 1;
  gap: len;
  portrait: layoutProfile;
  landscape: layoutProfile;
}
orientation {
  default: "auto"|"portrait"|"landscape";
  by_browser: map;
}
layoutProfile {
  rows: len[];
  columns: len[];
  gap: len;
  place: place;
}
place {
  nav: region;
  cards_above: region;
  image: region;
  lights: region;
  cards_below: region;
  cover: region;
}
region {
  row: num | str;
  col: num | str;
  align: "stretch"|"start"|"center"|"end";
  overflow: "hidden"|"auto";
}

// ---- Shared values
cond {
  entity: entity;
  attribute: str;
  state: any;
  state_not: any;
  operator: "<"|">"|"<="|">="|"=="|"!=";
  value: any;
  and: cond;
  or: cond;
}
condVal {
  condition: cond;
  value: any;
}
action {
  action: "none"|"navigate"|"url"|"more-info"|"toggle"|"call-service"|"perform-action"|"browser-mod-popup"|"toggle-group"|"show-group"|"hide-group"|"switch-room"|"next-room"|"prev-room"|"follow-room"|"open-section"|"close-section"|"fire-dom-event";
  entity: entity;
  entity_id: entity;
  navigation_path: str;
  path: str;
  url: str;
  url_path: str;
  new_tab: bool;
  service: str;
  perform_action: str;
  data: map;
  service_data: map;
  target: map;
  title: str;
  size: str;
  content: card;
  room: str | num;
  section: str;
  group: str;
  confirmation: bool | map;
  haptic: str;
  condition: cond;
  then: action;
  else: action;
}
transform {
  entity: entity;
  attribute: str;
  origin: str;
  transition: str;
  perspective: len;
  map: map;
  from: map;
  to: map;
  spin: spin;
}
spin {
  min_duration: num | str;
  max_duration: num | str;
  axis: "x"|"y"|"z";
  reverse: bool;
  min_value: num;
  max_value: num;
}
gradStop {
  value: num;
  color: color;
}
baseImageCond {
  image: url;
  condition: cond;
  value: any;
}
filterCond {
  condition: cond;
  filter: str;
}
weather {
  entity: entity;
  effect: "auto"|"rain"|"snow"|"fog"|"lightning";
  opacity: num;
  z_index: num;
  angle: num | str;
}
brightnessModel {
  source: bmSource[];
  filter_gradient: bmStop[];
}
bmSource {
  entity: entity;
  attribute: str;
  min_input: num = 0;
  max_input: num = 100;
  condition: cond;
}
bmStop {
  value: num;
  filter: str;
}
companion {
  card: card;
  media: str;
  height: len;
  type: str;
}

// ---- Elements on the image
overlay {
  id!: str;
  image: url;
  state_images: stateImage[];
  conditions: overlayConds;
  transition: str;
  z_index: num;
  animation: "none"|"pulse"|"blink";
  color_from: entity;
  transform: transform @6.7.0;
  className: str;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
stateImage {
  entity: entity;
  attribute: str;
  state: any;
  image: url;
}
overlayConds {
  opacity: condVal[];
  filter: condVal[];
}
zone {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
  slider: slider;
}
slider {
  entity: entity;
  action: str;
  attribute: str;
  direction: "horizontal"|"vertical";
  min: num;
  max: num;
  step: num;
  live: bool;
  invert: bool;
  color: color;
  service: str;
  data: map;
}
badge {
  id!: str;
  position: "top-left"|"top-right"|"bottom-left"|"bottom-right";
  icon: str;
  icon_color: color | condVal[];
  label: str | condVal[];
  label_template: tmpl;
  animation: "none"|"pulse"|"blink";
  animation_color: color;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
icon {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  icon: str | condVal[];
  entity: entity;
  attribute: str;
  size: len;
  color: color | condVal[];
  background: color;
  chip: bool;
  section_status: bool @6.16.0;
  animation: str;
  animation_color: color;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
label {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  entity: entity;
  attribute: str;
  template: tmpl;
  text: str;
  prefix: str;
  suffix: str;
  unit: str;
  decimals: num;
  format: str;
  unavailable_text: str;
  color: color | condVal[];
  color_gradient: gradStop[];
  background: color;
  padding: str;
  border_radius: len;
  font_size: len;
  font_weight: str | num;
  font_family: str;
  text_shadow: str;
  orientation: str;
  animation: str;
  animation_color: color;
  alert_conditions: cond;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
gauge {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  entity: entity;
  attribute: str;
  min: num;
  max: num;
  orientation: "vertical"|"top"|"horizontal"|"left"|"right"|"radial";
  color: color;
  color_gradient: gradStop[];
  background: color;
  border_radius: len;
  arc: num;
  thickness: len;
  target: num | entity;
  target_color: color;
  animation: str;
  animation_color: color;
  alert_conditions: cond;
  transition: str;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
blind {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  entity: entity;
  attribute: str;
  min: num;
  max: num;
  blind_type: "roller"|"venetian"|"day_night";
  slat_color: color;
  slat_count: num;
  slat_gap: len;
  slat_width: len;
  gap_color: color;
  top_offset: num @5.1.0;
  shift_turns: num;
  shift_start: num;
  shift_snap: bool;
  shift_legacy: bool;
  icon: str;
  label: str;
  label_template: tmpl;
  value: any;
  animation: str;
  animation_color: color;
  control: bool | coverControl;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
coverControl {
  placement: prof<bool | "off"|"float"|"dock">;
  slider: bool;
  presets: coverPreset[];
  buttons: any;
  name: str;
  top: len;
  left: len;
  width: len;
  height: len;
  position: str;
}
coverPreset {
  position: num;
  icon: str;
  color: color;
  name: str;
}
element {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  card: card;
  overflow: str;
  border_radius: len;
  background: color;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
glow {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  entity: entity;
  size: len;
  shape: "circle"|"ellipse"|"wash";
  angle: num | str;
  intensity: num;
  falloff: "soft"|"tight"|"wide";
  color: color;
  fallback_color: color;
  blend: str;
  animation: "none"|"flicker"|"pulse";
  animation_speed: str;
  min_brightness: num;
  anchor: "center"|"corner";
  transition: str;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
group {
  id!: str;
  grouping_code: str | num;
  style: map;
  visible: bool;
}
vacuumWidget {
  id!: str;
  top: len;
  left: len;
  bottom: len;
  right: len;
  width: len;
  height: len;
  z_index: num;
  size: len;
  vacuums: vacuumRef[];
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  group: str;
  visible: cond | cond[];
  visible_conditions: cond | cond[];
  visible_template: tmpl;
  fade: bool | str;
  slide: bool | str;
  nav_mini: bool;
  section: str;
  tile: tile;
}
vacuumRef {
  entity: entity;
  name: str;
}
lightControls {
  entities: lightEntity[];
  style: "native";
  columns: num;
  height: prof<len>;
  lux_sensor: entity;
  lux_max: num;
  color_low: color;
  color_high: color;
  bg_off: color;
  top: len;
  left: len;
}
lightEntity (or a bare entity string) {
  entity: entity;
  name: str;
  icon: str;
}

// ---- Navigation
nav {
  style: "thumbnails"|"tabs"|"dots"|"none";
  position: "top"|"bottom"|"left"|"right";
  live: "off"|"composite"|"full"|"custom";
  height: len;
  width: len;
  mobile_height: len;
  rows: prof<num>;
  cards_position: prof<"side"|"below">;
  wheel: bool | "horizontal"|"vertical"|"both";
  follow_button: bool;
  dim_inactive: bool;
  chips: navChip[];
  cards: companion[];
  mini: navMini;
}
navMini {
  width_ref: num;
  templates: bool;
  camera_refresh: num;
}
navChip (or a bare entity string) {
  entity: entity;
  attribute: str;
  template: tmpl;
  icon: str;
  prefix: str;
  suffix: str;
  decimals: num;
  format: str;
  color: color;
  color_gradient: gradStop[];
  background: color;
  border_radius: len;
  padding: str;
  active_state: any;
  tap_action: action;
  hold_action: action;
}

// ---- Sections (cockpit tiles)
section {
  id!: str;
  title: str;
  icon: str;
  subtitle: str;
  placement: "sheet-right"|"sheet-bottom"|"full"|"dialog";
  placement_portrait: "screen"|"inline";
  size: len;
  columns: num;
  badge: "auto"|"none";
  backdrop: bool;
  visible_template: tmpl;
  source: "auto";
  domain: str;
  card: card;
  tiles: tile[];
}
tile {
  id: str;
  name: str;
  entity: entity;
  icon: str;
  icon_animation: "none"|"spin"|"pulse"|"blink";
  state: tmpl;
  state_class: "auto"|"run"|"done"|"";
  active_state: any;
  value: tmpl;
  progress: entity;
  progress_always: bool;
  quick: quick[];
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
  image: url;
  image_ratio: str;
  overlays: tileOverlay[];
}
quick {
  name: str;
  icon: str;
  service: str;
  data: map;
  target: map;
}
tileOverlay {
  id: str;
  image: url;
  state_images: stateImage[];
  conditions: overlayConds;
  transition: str;
  transform: transform;
}

// ---- Overview page
overview {
  background: url;
  transition: "zoom"|"fade"|"none";
  transition_duration: num | str;
  gap: len;
  padding: len;
  header: ovHeader;
  left: ovSide;
  right: ovSide;
  grid: ovGrid;
  dock: ovDock;
  signals: bool | ovSignals @6.48.0;
}
ovSignals {
  presence: bool | entity | fpEntity[];
  attention: bool = true;
  vacuum: bool = true;
}
ovHeader {
  height: len;
  items: ovHeaderItem[];
}
ovHeaderItem {
  pill: ovPill;
  nav_cards: bool;
  card: card;
  width: len;
  media: "landscape"|"portrait"|"all";
  type: str;
}
ovPill {
  entity: entity;
  attribute: str;
  template: tmpl;
  icon: str;
  prefix: str;
  suffix: str;
  decimals: num;
  format: str;
  color: color;
  text: str;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
}
ovSide {
  width: len;
  portrait: "top"|"bottom"|"hidden";
  cards: ovSideCard[];
}
ovSideCard {
  card: card;
  height: len;
  media: "landscape"|"portrait"|"all";
  type: str;
}
ovGrid {
  rooms: str[];
  columns: prof<num>;
  style: prof<"card"|"row">;
  live: "inherit"|"full"|"custom"|"composite"|"off";
  width_ref: num | "auto";
  chips_max: prof<num>;
  info: bool;
  names: bool @6.31.0;
  gap: len;
  fill: bool;
  min_height: len;
  aspect_ratio: str;
}
ovDock {
  sections: str[];
  size: len;
}
overviewTile {
  name: str;
  hidden: bool;
  focus: str;
  chips: "auto"|"none" | ovChip[];
  show_name: bool @6.31.0;
  tap_action: action;
  hold_action: action;
  double_tap_action: action;
  hold_delay: num;
}
ovChip (or a bare entity string) {
  entity: entity;
  icon: str;
  active_state: any;
  tap_action: action;
  hold_action: action;
}

// ---- Floor plan page
floorplan {
  theme: "night"|"clay"|"neon"|"blueprint"|"thermal"|"tiles"|"sketch" = "night";
  theme_by: fpThemeBy;
  projection: "auto"|"top"|"oblique"|"iso" = "auto";
  rotate: prof<num | "auto"> = "auto";
  mirror: "none"|"horizontal"|"vertical"|"both" = "none" @6.49.0;
  quality: "auto"|"high"|"low" = "auto";
  wall: fpWall;
  temperature_range: num[];
  overrides: map;
  transition: "zoom"|"fade"|"none";
  transition_duration: num | str;
  source: fpSource;
  trace: fpTrace;
  rooms: fpRoom[];
  openings: fpOpening[];
  presence: bool | entity | fpEntity[] @6.48.0;
  layers: fpLayers @6.48.0;
  items: fpItem[] @6.48.0;
  vacuums: fpVacuum[] @6.50.0;
  attention_sections: str[] @6.50.0;
  clean_mode: "dry"|"wet"|"both" = "dry" @6.50.0;
  trail_mode: "always"|"cleaning" = "always" @6.50.0;
  background: fpBackground @6.50.0;
}
fpRoom {
  room: str;
  name: str;
  polygon: any[];
  floor: "wood"|"vinyl"|"tile"|"carpet"|"concrete"|"none" = "wood";
  floor_color: color @6.49.0;
  label_at: num[] @6.50.0;
  anyvac_room: str;
  lights: entity | fpLight[];
  climate: entity;
  temperature: entity;
  humidity: entity;
  media: entity | fpEntity[] @6.48.0;
  tap_action: action;
  hold_action: action;
}
fpLight (or a bare entity string) {
  entity: entity;
}
fpOpening {
  type: "door"|"window" = "door";
  at: num[];
  width: num = 0.8;
  entity: entity @6.49.0;
  cover: entity @6.49.0;
  blind_type: "roller"|"venetian"|"day_night" = "roller" @6.49.0;
  invert: bool @6.49.0;
  mirror: bool @6.49.0;
  outward: bool @6.49.0;
  tap_action: action @6.49.0;
  hold_action: action @6.49.0;
}
fpItem {
  type: "marker"|"label" = "marker";
  at: num[];
  entity: entity;
  attribute: str;
  icon: str;
  name: str;
  show_state: bool;
  prefix: str;
  suffix: str;
  decimals: num;
  active_state: any;
  color: color;
  size: len;
  text: str;
  tap_action: action;
  hold_action: action;
}
fpVacuum (or a bare entity string) {
  entity: entity;
  transform: fpTransform;
  color: color @6.51.0;
  mop_color: color @6.51.0;
  mop_opacity: num @6.51.0;
}
fpTransform {
  rotation: num;
  x: num;
  y: num;
  rooms: num;
  rms: num;
}
fpLayers {
  lights: bool = true;
  heating: bool = true;
  labels: bool = true;
  presence: bool = true;
  media: bool = true;
  attention: bool = true;
  vacuum: bool = true;
  items: bool = true;
  openings: bool = true @6.49.0;
  cleaning: bool = false @6.50.0;
  trail: bool = true @6.50.0;
}
fpEntity (or a bare entity string) {
  entity: entity;
}
fpBackground {
  image: url;
  x: num;
  y: num;
  scale: num;
  width_px: num;
  height_px: num;
  rotation: num;
  opacity: num;
  floors: bool;
  fiducials: any[];
  frame: str;
}
fpThemeBy {
  portrait: "night"|"clay"|"neon"|"blueprint"|"thermal"|"tiles"|"sketch";
  landscape: "night"|"clay"|"neon"|"blueprint"|"thermal"|"tiles"|"sketch";
  dark: "night"|"clay"|"neon"|"blueprint"|"thermal"|"tiles"|"sketch";
  light: "night"|"clay"|"neon"|"blueprint"|"thermal"|"tiles"|"sketch";
}
fpWall {
  height: num;
}
fpSource {
  anyvac: entity;
  frame: str;
  imported: str;
  origin_px: num[];
  mm_per_px: num;
}
fpTrace {
  image: url;
  x: num;
  y: num;
  scale: num;
  width_px: num;
  height_px: num;
  opacity: num;
}

```
<!-- END GENERATED: schema -->
