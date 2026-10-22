# Room Overlay Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Michailjovic/Room-Card.svg)](https://github.com/Michailjovic/Room-Card/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Your home in one Home Assistant card.** Take a photo of each room and bring it to life: it dims
with the lights, the blinds come down, live values and controls sit on the furniture. Add an
**overview page** with every room as a live tile, and a **floor plan page** that draws the whole
home from your robot vacuum's map. Everything is built in **Room Card Studio**, a full-screen
editor with the live card on a canvas — no YAML needed.

![Room Overlay Card – hero screenshot](screenshots/hero.png)

- **Install:** [HACS or manual](#installation) · **First room in two minutes:** [Getting started](docs/GETTING_STARTED.md)
- **Guides:** [Studio](docs/STUDIO.md) · [Configuration](docs/CONFIGURATION.md) · [Overview page](docs/OVERVIEW.md) · [Floor plan](docs/FLOORPLAN.md) · [Presets](PRESETS.md) · [Troubleshooting](docs/TROUBLESHOOTING.md)
- **Every key:** [generated reference](docs/REFERENCE.md) · for AI assistants: [AI spec](docs/AI_SPEC.md) and [`llms.txt`](llms.txt)

---

## Installation

### Via HACS (recommended)

1. **HACS → ⋮ → Custom repositories** → add `https://github.com/Michailjovic/Room-Card`, type
   **Dashboard**. (Once the card is in HACS's default store, searching for *Room Overlay Card* is
   enough.)
2. Open **Room Overlay Card** in HACS and **Download**.
3. Hard-refresh the browser (`Ctrl+Shift+R`); on a tablet or phone, reload the dashboard.

HACS installs all three files (the card, the studio and the floor plan renderer). To install a
specific version — a beta, or to roll back — open the card in HACS → **⋮ → Redownload**, tick
*Show beta versions* if you want one, and pick the version.

### Manual

1. Download `room-overlay-card.js`, `room-overlay-card-studio.js` **and**
   `room-overlay-card-floorplan.js` from the [latest release](https://github.com/Michailjovic/Room-Card/releases/latest).
2. Copy all three to `/config/www/` — the same folder. The studio file is loaded only when someone
   opens the studio, the floor plan file only when a floor plan page is shown.
3. **Settings → Dashboards → ⋮ → Manage resources** → add `/local/room-overlay-card.js` (type
   *JavaScript module*). The other two files need no resource of their own.
4. Hard-refresh.

---

## Getting started

1. **Add the card** to a dashboard — *Add card → Custom: Room Overlay Card*.
2. Home Assistant's card editor shows the **launcher**. Press **Start with the wizard**: it builds
   the card from your Home Assistant areas — one room each, with the area's name, icon and
   picture, its lights as light controls, sections from recipes and the room strip.
3. **Open Studio**: the card fills the screen on a live canvas. **Add** an icon, label, zone,
   gauge, light glow, blind or embedded card and click where it belongs on the image; select
   anything to get its form — entity and icon pickers, the tap action — or drag it into place.
4. **Apply & close**, then **Save**. You never had to touch YAML.

On the dashboard itself, Home Assistant's edit mode (the pencil) puts a **✎ Studio** button on the
card, which saves straight to the dashboard — handy on a wall tablet. The whole walkthrough:
**[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)**.

The smallest card in YAML:

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: "16/9"
```

---

## What it does

| Feature | What it does |
|---|---|
| **Room Card Studio** | The editor: the card full-screen on a live canvas — select, drag, resize, draw, a form for every element, multi-select and align, copy rooms, undo, a wizard from your HA areas ([guide](docs/STUDIO.md)) |
| **Layout profiles** | Two % grid layouts (portrait / landscape) picked by the viewport's shape — one card for the wall tablet, the PC and the phone; per-device pinning via browser_mod |
| **Base image** | Any room photo or a live camera, per-profile aspect, cover / contain fit, weather overlay |
| **CSS filter engine** | Brightness, saturation, sepia, blur… driven by entity states, with smooth transitions; a brightness model blends filter stops (day / night / cinema) |
| **Overlay layers** | Transparent PNG layers with conditional opacity and filters, state-driven image switching, and a transform engine — a door swinging on its hinge, a fan spinning with its speed |
| **Light glow** | Soft pools of light on the photo — colour from the light, strength from its brightness |
| **Controls on the image** | Clickable and slider zones, state-aware icons and labels, status badges, gauges, roller / venetian / day-night blinds with a cover control, embedded HA cards, groups |
| **Light controls** | A slider strip per light or switch, its border tracking a lux sensor |
| **Cockpit sections** | Pop-up panels of status and control tiles (device photos with moving parts, quick buttons), opened from launcher icons that show what's running inside |
| **Multi-room** | One card for the whole home — rooms, swipe, presence follow, an automatic room strip with live thumbnails |
| **Overview page** | Every room on one screen as a live tile with state chips, plus your header, side cards and a dock of section launchers; tap a tile and the room zooms open ([guide](docs/OVERVIEW.md)) |
| **Floor plan page** | Your home as a live vector plan, imported from the vacuum's map (AnyVac) or drawn in the studio: lit rooms glow, floor heating flows, windows, blinds and doors, who is where, what plays, the vacuums live with their trails, any entity as a marker; seven themes ([guide](docs/FLOORPLAN.md)) |

---

## Screenshots

| | |
|---|---|
| ![Responsive — one card across devices](screenshots/responsive.png) | ![Night scene](screenshots/night.png) |
| *One card, every screen — the same card at different widths* | *Night mode — dim filter active* |
| ![Day scene](screenshots/day.png) | ![Blinds](screenshots/blinds.png) |
| *Day scene — full brightness* | *Day/night zebra blind at 60 %* |
| ![Gauges](screenshots/gauges.png) | ![Tabbed form](screenshots/editor-image-tab.png) |
| *Gauges — temperature, humidity, CO₂* | *The tabbed form (the studio's All settings)* |

---

## The overview page

One more "room" that is an **overview**: every room on one screen as a live tile — its picture,
temperature and chips for its lights, blinds and media — with an optional header, a column of
cards (clock, weather, calendar) and a dock of section launchers. Tap a tile and the room zooms
open. Since v6.48.0 the tiles can also show who is where, what needs attention and which room the
vacuum is cleaning.

```yaml
rooms:
  - id: overview
    name: Overview
    icon: mdi:home
    overview:
      header: { items: [ { nav_cards: true } ] }
      left: { cards: [ { type: weather-forecast, entity: weather.home } ] }
      grid: { columns: { landscape: 3, portrait: 2 } }
      dock: {}
  - id: bedroom
    name: Bedroom
    base_image: /local/bedroom.webp
```

Guide: [docs/OVERVIEW.md](docs/OVERVIEW.md).

---

## The floor plan page

A page that draws your home as a **plan**: floors, walls, doors and windows, each room's lights
as a glow in their colour, floor heating, temperature and humidity; who is where, what plays,
running appliances, any entity as a marker; open windows and blinds by their position. Tap a room
and it zooms open; hold it to switch its lights.

- **From your robot vacuum:** in the studio, *Add a floor plan page* → **AnyVac** reads the room
  outlines from the vacuum's map, straightens the walls, links each room to your card's rooms,
  fills in their lights, thermostats and sensors and proposes the doors.
  **This needs [AnyVac](https://github.com/Michailjovic/anyvac)**, a Home Assistant integration
  for Roborock vacuums (its own map card is [anyvac-card](https://github.com/Michailjovic/anyvac-card)).
  AnyVac also puts the vacuums on the plan live, with their trails and when each room was last
  cleaned.
- **Without a vacuum:** draw the rooms (rectangles, polygons, doors, windows) or trace over a
  picture of your floor plan. Everything except the vacuums works the same.
- **Seven themes:** `night`, `clay`, `neon`, `blueprint`, `thermal`, `tiles`, `sketch` — per layout
  profile and dark / light mode if you like.

```yaml
rooms:
  - id: home
    name: Floor plan
    icon: mdi:floor-plan
    floorplan:
      theme: night
      rooms:
        - room: bedroom
          polygon: [[11.95,0.25],[15.85,0.25],[15.85,4.45],[11.95,4.45]]
          floor: carpet
          lights: light.bedroom
          climate: climate.bedroom
      openings:
        - { type: door, at: [11.9, 2.1], width: 0.8 }
```

Guide: [docs/FLOORPLAN.md](docs/FLOORPLAN.md).

---

## Documentation

| Doc | What's in it |
|---|---|
| **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** | Install, the wizard, your first room, first light, a floor plan — step by step |
| **[docs/STUDIO.md](docs/STUDIO.md)** | Room Card Studio: the launcher, the wizard, the workspace, Properties, the canvas, saving, floor plan tools |
| **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** | The YAML guide with examples: layout, filters, overlays, gauges, blinds and cover control, zones, badges, icons and labels, embedded cards, light controls, sections, multi-room, theming |
| **[docs/REFERENCE.md](docs/REFERENCE.md)** | Every key, its type, default and since which version — generated from the config schema |
| **[docs/OVERVIEW.md](docs/OVERVIEW.md)** | The overview page |
| **[docs/FLOORPLAN.md](docs/FLOORPLAN.md)** | The floor plan page: AnyVac import, drawing and tracing, themes, bindings, vacuums, the photo background |
| **[PRESETS.md](PRESETS.md)** | Copy-paste recipes — day / night filters, dimmer zones, door portals, presence multi-room, a cockpit, an overview page, a floor plan |
| **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | Updates that don't show, the studio or floor plan file missing, saving, AnyVac |
| **[docs/EDITOR.md](docs/EDITOR.md)** | The tabbed form of 6.x (the studio's *All settings*; the Classic editor until 7.1) |
| **[docs/AI_SPEC.md](docs/AI_SPEC.md)** | A compact spec and recipes for AI assistants writing configs |
| **[LAYOUT.md](LAYOUT.md)** | The layout engine's design, for the curious or contributing |
| **[CHANGELOG.md](CHANGELOG.md)** | Every release |

---

## Development

The source lives in `src/` as plain-JavaScript parts (no framework, no transpiling) that
`npm run assemble` concatenates, in the order listed in `src/manifest.json`, into
`room-overlay-card.js` and the lazy-loaded `room-overlay-card-studio.js` and
`room-overlay-card-floorplan.js`. The assembled files stay committed — they are what a manual or
local install loads and what every test tier runs against — and CI fails when they are out of
date with `src/`. `npm run build` then produces the minified release assets (terser, property
mangling off) that HACS installs.

```
src/core/      shared helpers: layout, glow, transform, migration, rooms, sections, overview, signals, formatting…
src/card/      the card element (room-overlay-card)
src/editor/    HA's card editor element: the launcher and the tabbed form, YAML helpers, the studio loader
src/studio/    Room Card Studio → room-overlay-card-studio.js (loaded on demand)
src/floorplan/ the floor plan renderer → room-overlay-card-floorplan.js (loaded on demand)
src/schema/    the config schema registry — every key, its type and scope
tools/         assemble.js, gen-docs.js (docs/REFERENCE.md and the AI spec from the schema)
```

```bash
npm run assemble        # src/ → the three bundles (run after every edit in src/)
npm run docs            # regenerate docs/REFERENCE.md and the AI spec's schema block
npm test                # assemble + docs check, smoke, render, lifecycle, design, overview, schema, floorplan, studio tiers (jsdom)
npm run test:e2e        # Playwright: geometry regression, studio and floor plan tests, real Chromium
npm run test:compat     # render every reference config with the last release and this build, compare
npm run test:ha         # real Home Assistant in Docker: editor dialog, studio, dashboard save paths
npm run build           # build the minified dist/ bundles
npm run build:verify    # build, then run the test tiers against the minified bundles
```

---

## License

MIT © 2025–2026 Michailjovic

The card embeds [js-yaml](https://github.com/nodeca/js-yaml) 4.3.2 (MIT, © Vitaly Puzrin) for the
editor's YAML fields; its license text is reproduced in `room-overlay-card.js`.
