# Room Overlay Card 7.0.0

The first stable release of v7. Your rooms as photos that react to their lights, an overview of all
of them and a plan of the whole home — built in a full-screen editor, without YAML.

**▶ [Live demo](https://michailjovic.github.io/Room-Card/)** — the real card and studio in your browser, against a mock Home Assistant.

If you install only stable releases, the last one you got was **6.25.1**: everything from 6.30.0 to
7.0.0-beta.4 was published as pre-releases and is new to you.

## What's new since 6.25.1

- **Room Card Studio** — the card's own full-screen editor: the live card on a canvas in a tablet
  or phone frame, an outline of every element with search, a form generated from the config schema
  with entity and icon pickers and an action builder. Add elements by clicking or drawing on the
  picture, select several, align them, copy rooms; undo / redo, a YAML view, history, and saving
  straight to the dashboard. A **wizard** builds a new card from your Home Assistant areas.
  [Guide](https://github.com/Michailjovic/Room-Card/blob/master/docs/STUDIO.md)
- **Overview page** — every room as a live tile with state chips, an optional header, card columns
  and a dock of section launchers; tap a tile and the room zooms open. Tiles can show who is where,
  what needs attention and which room is being cleaned. [Guide](https://github.com/Michailjovic/Room-Card/blob/master/docs/OVERVIEW.md)
- **Floor plan page** — your home as a plan in seven themes (top-down, oblique or isometric):
  lights as glows in their colour, floor heating, temperature and humidity, who is where, what
  plays, doors and windows with their sensors and blinds, any entity as a marker.
  **With [AnyVac](https://github.com/Michailjovic/anyvac)** the rooms come from your Roborock
  vacuum's map and the vacuums are drawn live — trails, when each room was last cleaned, a *clean
  this room* button. Without AnyVac you draw or trace the plan. [Guide](https://github.com/Michailjovic/Room-Card/blob/master/docs/FLOORPLAN.md)
- **Documentation**: Getting started, Studio, Overview, Floor plan, Troubleshooting, a
  configuration reference generated from the schema, and an AI spec
  ([`docs/AI_SPEC.md`](https://github.com/Michailjovic/Room-Card/blob/master/docs/AI_SPEC.md), [`llms.txt`](https://github.com/Michailjovic/Room-Card/blob/master/llms.txt)) so an AI assistant can
  configure the card for you.

Every version in detail: [CHANGELOG](https://github.com/Michailjovic/Room-Card/blob/master/CHANGELOG.md).

## Upgrading

- Existing configs render as before.
- Home Assistant's card editor now opens a **launcher**: Open Studio, the wizard, the basics and
  YAML. The 6.x tabbed editor stays behind **Classic editor** until 7.1.
- **Three files**: `room-overlay-card.js`, `room-overlay-card-studio.js` and
  `room-overlay-card-floorplan.js`, in one folder. The Marketplace and HACS install all three; a
  manual install needs all three, and only the first as a dashboard resource.
- After updating, reload the browser (`Ctrl+Shift+R`); on a tablet, reload the dashboard.

## Installing

- **Home Assistant 2026.11 and newer:** Settings → Marketplace → **Add from link** →
  `Michailjovic/Room-Card` → open it → **Install**.
- **Older Home Assistant:** HACS → ⋮ → Custom repositories → `https://github.com/Michailjovic/Room-Card`,
  type Dashboard → Download.
- **Manual:** the three files from this release into `/config/www/` — see the
  [README](https://github.com/Michailjovic/Room-Card/blob/master/README.md#installation).
