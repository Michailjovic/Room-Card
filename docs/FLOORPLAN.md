# The floor plan page

*Since v6.47.0.* A room in `rooms:` with a `floorplan:` block is a **page** that draws the home as
a vector plan instead of a photo: floors, walls with door openings, the room names, and the live
state of every room — lights, floor heating, temperature and humidity. Since v6.48.0 it also shows
what happens **across rooms** — who is where, what plays, the vacuum, running appliances — and any
entity as a marker. It works like the overview page:

- it takes the whole card; the room strip and the other regions are hidden;
- in the other rooms' strip it shows as an icon;
- **tap** a room on the plan → that room opens, growing out of its place on the plan (and
  shrinking back into it when you return to the plan);
- **hold** a room → its lights toggle.

> **AnyVac is needed for the import from the vacuum's map and for the vacuum on the plan.** The
> fastest way to get the plan is from a Roborock vacuum's map through
> **[AnyVac](https://github.com/Michailjovic/anyvac)**, a Home Assistant integration that publishes
> the map as `sensor.<vacuum>_anyvac_map` (its frontend is
> [anyvac-card](https://github.com/Michailjovic/anyvac-card)). Without AnyVac the plan can still be
> drawn in the studio or traced over a picture of your floor plan; everything else on this page
> works the same, only the vacuum badge is missing.

The renderer is a separate file, `room-overlay-card-floorplan.js`. The card loads it from its own
URL the first time a floor plan page is shown. HACS installs it with every release; for a manual
install copy it next to `room-overlay-card.js`. A dashboard without a floor plan never downloads it.

## Getting the plan

Everything is done in **Room Card Studio** ([editor guide](EDITOR.md#room-card-studio)):
**Add a floor plan page** at the bottom of the Rooms list, then:

1. **AnyVac** (toolbar above the canvas) — the import:
   - pick the map sensor. Only a map that is the reference of the home frame or aligned to it
     can be imported (AnyVac's `registration`);
   - for each room of the map pick the card room it is. The guess compares names, ids, the
     overview tile name, `area_match` and the Home Assistant area with its aliases ("Living room"
     = `living_room`). A room can also be *plan only* (no card room; tap opens its thermostat or
     light) or left out;
   - **Clean up the outlines**: the robot maps the floor it reached, so furniture bites notches
     into a room and the edge steps in 5 cm cells. The clean-up closes gaps up to 0.8 m,
     removes slivers under 0.2 m and jogs up to 0.2 m, and gives straight, square walls (for
     example 45 points → 10 for an L-shaped kitchen);
   - **Propose doors** where two rooms touch, placed where the robot drove between them;
   - **Fill in** each room's lights (its light controls, else the area's lights), its heating
     thermostat (a `climate` of the area that can `heat`), and temperature / humidity sensors
     (the ones the card's nav chips use for that room, else the area's).

   Importing again later replaces each room's outline and keeps everything you set on it; rooms
   you drew yourself stay.
2. **Draw** — rectangles or rooms corner by corner; move rooms and corners, add corners from the
   middle of a wall, place doors and slide them along the wall. Corners snap to 5 cm and line up
   with other corners (Alt = free).
3. **Image** — trace over a picture of your floor plan (URL or upload); click two points whose real
   distance you know to scale it. The picture is shown in the studio only.

Everything is stored in the card's config as metres (the vacuum map is read once, not live): a
re-mapped room never changes the plan until you import again, and the plan keeps working if the
vacuum or AnyVac is gone.

## Themes

| Theme | Projection | Look |
|---|---|---|
| `night` *(default)* | oblique cut-away | dark; wood, tiles and carpet, low walls, warm light pools, glowing heating loops |
| `clay` | isometric | a light pastel model; soft shadow |
| `neon` | isometric | glowing edges on black: warm = lit, red = heating |
| `blueprint` | top | technical drawing: overall dimensions, m² per room, door swings, hatched light, dashed heating |
| `thermal` | top | rooms coloured by temperature (scale `temperature_range`, default 21–24 °C), big readings, legend |
| `tiles` | top (abstract) | each room a tile with light and heating buttons — good on phones |
| `sketch` | top | hand-drawn on paper |

- `theme_by` picks a theme per layout profile and per Home Assistant dark / light mode:
  `theme_by: {portrait: tiles, dark: night, light: clay}` (the profile wins over dark / light,
  both over `theme`).
- `overrides` replaces single theme tokens by their path: `'floor.wood': '#6b4a33'`,
  `'wall.h': 0.6`, `'label.c': '#fff'`, `'lightColor': '#ffd08a'`.
- `projection` (`top`, `oblique`, `iso`) overrides the theme's own; `auto` keeps it. The isometric
  view puts a long flat on a diagonal — `oblique` keeps it horizontal.
- `rotate`: degrees, or `auto` (default) — a quarter turn when that makes the plan clearly bigger,
  e.g. a long flat on an upright phone.
- `quality: low` draws without SVG filters (paper, rough lines, soft shadow) for a weak tablet;
  animations stop when the plan is off screen and with *reduce motion*.

## What a room shows

| Key | From | Drawn as |
|---|---|---|
| `lights` | one or more `light.*` / `switch.*` | a glow in the room: colour from `rgb_color` (or the colour temperature), strength from the brightness; any light on = lit |
| `climate` | a thermostat | the floor heating loop: glowing and flowing while `hvac_action: heating`, faint while idle, none when off; also the temperature / humidity if the room has no sensors |
| `temperature`, `humidity` | sensors | the values on the room's label |
| `media` *(6.48)* | one or more `media_player.*` | what plays (app, else source, else title) on the label, ▶ / ❚❚; the room glows softly while playing |

## Across rooms

*Since v6.48.0.* The plan shows the "relationships across rooms" a strip of photos cannot:

- **Presence** — a round token with the person's initial in the room they are in. `presence:`
  lists the entities (Bermuda area sensors, or any sensor / `person` / `device_tracker` whose
  state names a room); without it the card's `room_entity` is used. The state is matched like
  presence follow (room id, name, `area_match`); a plan-only room matches by its name. A person
  who moves glides to the new room.
- **Attention** — an orange badge with the count on a room whose collected **section tiles** are
  in their `active_state` (the washing machine runs → the hall).
- **Vacuum** — a blue robot badge on the room an AnyVac vacuum is cleaning (`in_cleaning`,
  `vacuum_room_name`, matched to the plan room by its `anyvac_room`, else by name). All AnyVac map
  sensors are watched; the plan's own `source.anyvac` first.

The overview page can show the same signals on its tiles — opt-in with `overview.signals`
([CONFIGURATION.md](CONFIGURATION.md#cross-room-signals-v6480)).

## Markers and labels

*Since v6.48.0.* `items:` puts any entity on the plan at a point (metres, like the polygons):

- **`type: marker`** (default) — an icon chip (`icon`, else one for the entity's domain); lit
  while the entity is on (or in `active_state`); `name` and `show_state: true` add a line of
  text under it;
- **`type: label`** — a text pill with the live value (`prefix`, `suffix`, `decimals`,
  `attribute`), or a fixed `text`.

Tap toggles a `light`, `switch`, `fan`, `input_boolean`, `cover` or `humidifier` and opens
more-info for everything else (a lock or a valve is never toggled by a tap); hold opens more-info. `tap_action` / `hold_action` take any card action. `color`
sets the lit colour, `size` the chip size (`34px`). In the studio the **Marker** tool places one.

## Layers

`layers:` switches parts of the plan off — `lights`, `heating`, `labels`, `presence`, `media`,
`attention`, `vacuum`, `items` (all `true` by default). A layer that is off is neither drawn nor
watched for changes.

## Reference

```yaml
rooms:
  - id: home
    name: Floor plan
    icon: mdi:floor-plan
    floorplan:
      theme: night                 # night | clay | neon | blueprint | thermal | tiles | sketch
      theme_by: {portrait: tiles}  # portrait / landscape / dark / light → theme
      projection: auto             # auto | top | oblique | iso
      rotate: auto                 # auto | degrees
      quality: auto                # auto | high | low
      wall: {height: 0.42}         # metres (projected views)
      temperature_range: [21, 24]  # thermal theme
      presence: [sensor.michael_area, sensor.eva_area]   # default: the card's room_entity
      layers: {vacuum: true, attention: true}           # every layer on by default
      overrides: {'floor.wood': '#6b4a33'}
      transition: zoom             # zoom | fade | none — plan ↔ room
      transition_duration: 450
      rooms:
        - room: living_room        # a room of this card (tap opens it); omit for a plan-only room
          name: Obývák             # label (default: the room's overview tile name / name)
          polygon: [[0,0.4],[5.35,0.4],[5.35,1.7],[5.95,1.7],[5.95,3.45],[5.35,3.45],[5.35,4.55],[0,4.55]]
          floor: wood              # wood | tile | carpet | concrete | none
          lights: [light.panel_living_room_1, light.panel_living_room_2]
          climate: climate.versatile_living_room
          temperature: sensor.living_room_temperature
          humidity: sensor.living_room_humidity
          media: media_player.living_room_tv
          tap_action: {action: more-info, entity: climate.versatile_living_room}   # optional
          hold_action: {action: toggle, entity: light.panel_living_room_1}       # optional
          anyvac_room: 7bUI4dOp7O1qnECi7UfFW3_16   # set by the import (matches it on re-import)
      openings:
        - {type: door, at: [5.98, 2.25], width: 0.8}
      items:
        - {entity: light.desk_lamp, at: [3.1, 1.2]}                       # marker
        - {entity: sensor.co2, icon: mdi:molecule-co2, show_state: true, at: [1.0, 3.9]}
        - {type: label, entity: sensor.balcony_temperature, suffix: '°', at: [2.5, 0.1]}
      source:                      # set by the import
        anyvac: sensor.kitchen_s8_maxv_ultra_anyvac_map
        frame: d4e87578-…
        imported: 2026-10-21
        origin_px: [800, 752]      # the map pixel at plan 0,0
        mm_per_px: 12.5
      trace: {image: /api/image/serve/…/original, x: 0, y: 0, scale: 0.012, width_px: 1400, height_px: 400, opacity: 0.5}
```

Coordinates are metres, x to the right and y down, as on the vacuum's map. Default actions:
tap → the linked room (else more-info of the thermostat or the first light); hold → toggle the
room's lights.

## Coming next

Window and blind openings on the walls, the vacuum itself (live position, trail, cleaning
coverage) and a calibrated photo-real render behind the vector layers — see
[V7_PLAN.md](../V7_PLAN.md) §6.
