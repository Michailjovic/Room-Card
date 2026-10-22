# Overview page

[← Back to README](../README.md) · [Configuration](CONFIGURATION.md) · [Reference](REFERENCE.md#t-overview) · [Floor plan](FLOORPLAN.md) · [Room Card Studio](STUDIO.md)

Since v6.30.0. Every key of `overview:`, `overview_tile:` and their parts is listed in the
[generated reference](REFERENCE.md#t-overview).

One room in `rooms:` can be an **overview page**: every other room as a tile, plus the house-level
things around them. Tap a tile and that room opens in its normal view, growing out of its tile.

```
landscape                              portrait (phone)
┌──────────────── header ───────────────┐  ┌────── header ──────┐
│  left  │        room grid      │ right │  │ left (compact)     │
│ (cards)│  ┌─────┐┌─────┐┌─────┐│(cards)│  │ ┌──────┐┌──────┐   │
│        │  │tile ││tile ││tile ││       │  │ │ tile ││ tile │   │ ← only the grid
│        │  └─────┘└─────┘└─────┘│       │  │ └──────┘└──────┘   │   scrolls
├──────────────── dock ─────────────────┤  ├────── dock ────────┤
```

- It is **a page, not a mode**: an ordinary entry in `rooms:` with an `overview:` block. Put it
  first if you want the card to open on it. Swipe, wheel, `next-room`/`prev-room`, `url_sync`
  (`#room=overview`) and the editor's room picker treat it like any room.
- **Presence follow never targets it** (it has no `area_match`) and works exactly as before.
- **Every region except the grid is optional.** Leave one out and it collapses — the grid takes
  its space. No left column → the grid is full width; no header and no dock → full height.
- The page shows **no nav strip** (the grid *is* the navigation). Every other room shows the
  overview page in its strip as an icon thumbnail (`icon:` of the overview room); hide it with
  `nav_hidden: true` if you reach the page some other way.
- Nothing here changes a config without an overview room — its rendering stays byte-identical.

## Minimal

```yaml
rooms:
  - id: overview
    name: Přehled
    icon: mdi:view-dashboard
    overview: true          # just the room grid
  - id: bedroom
    …
```

## Everything

```yaml
rooms:
  - id: overview
    name: Přehled
    icon: mdi:view-dashboard          # its thumbnail in the other rooms' strip
    # nav_hidden: true                # keep it out of that strip
    overview:
      background: /local/overview_bg.webp
      transition: zoom                # zoom (default) | fade | none
      transition_duration: 450        # ms (or "0.45s")
      gap: 12px                       # between regions (and the default for the grid)
      padding: 12px                   # around the whole page

      header:                         # the top bar
        height: auto                  # or a length — cards then fill it
        items:                        # left → right
          - pill:
              entity: sensor.dhw_temperature
              icon: mdi:water-boiler
              prefix: "DHW "
          - pill:
              template: "{{ states('sensor.svatek') }}"
              icon: mdi:cake-variant
          - nav_cards: true           # the same cards as nav.cards (e.g. your alert ticker)
            width: 45%
          - card: { type: custom:mushroom-chips-card, chips: [ … ] }
            media: landscape          # landscape | portrait — show on one profile only

      left:                           # a column of cards (clock, weather, calendar…)
        width: 28%                    # landscape width
        portrait: top                 # top (default) | bottom | hidden — where it goes on phones
        cards:                        # card | {card, height, media}
          - card: { type: custom:atmo-weather-card, entity: weather.home }
            media: landscape
          - card: { type: custom:atmo-weather-card, entity: weather.home, compact: true }
            media: portrait
          - card: { type: calendar, entities: [calendar.family] }
            media: landscape
      right: { … }                    # same keys as left

      grid:
        rooms: [bedroom, kitchen, living]   # default: every room in config order
        columns: { landscape: 3, portrait: 2 }
        style:   { landscape: card, portrait: row }   # card = photo tile, row = list row
        live: inherit                 # inherit | full | custom | composite | off
        width_ref: auto               # live tiles: render at the tile's own width (default)
        chips_max: { landscape: 4, portrait: 3 }
        info: true                    # the rooms' thumbnail chips (temperature, humidity…)
        names: true                   # v6.31.0: false hides the room names on the tiles
        gap: 12px
        # fill: false                 # landscape photo tiles stop stretching to the height
        # min_height: 110px           # smallest row before the grid scrolls (landscape)
        # aspect_ratio: 4/3           # photo tile shape where tiles don't fill (portrait)

      dock:                           # section launchers
        sections: [heating, media]    # default: every section, in order
        size: 24px                    # icon size
```

| Key | Default | Meaning |
|---|---|---|
| `overview` | — | `true` or an object — this room is an overview page |
| `nav_hidden` | `false` | (room key) keep the overview page out of the other rooms' strip |
| `background` | — | image behind the page |
| `transition` | `zoom` | tile ↔ room: `zoom`, `fade` or `none`; reduced-motion users get a short fade |
| `transition_duration` | `450` | ms |
| `gap` / `padding` | `12px` | spacing between / around the regions |
| `header.items[]` | — | `pill:`, `nav_cards: true` or `card:` (or a plain card config); each with optional `width` and `media` |
| `header.height` | `auto` | a fixed height makes the cards fill it |
| `left` / `right` | — | `width` (landscape), `portrait: top \| bottom \| hidden`, `cards:` |
| `grid.rooms` | all | room ids, in display order — independent of the nav strip, which follows `rooms:` |
| `grid.columns` | 3 / 2 | per profile; `row` style is always one column |
| `grid.style` | `card` | `card` (photo tile) or `row` (list row), per profile |
| `grid.live` | `inherit` | tile picture tier — `inherit` follows `nav.live`; `row` tiles default to `composite` |
| `grid.width_ref` | `auto` | reference width of a live tile mini (px), `auto` = the tile's own width |
| `grid.chips_max` | 4 / 3 | state chips per tile, per profile (3 keeps a 44 px touch target on a phone) |
| `grid.info` | `true` | show `nav.chips` / the room's `chips:` on its tile |
| `grid.names` | `true` | `false` hides the room names on the tiles (v6.31.0) |
| `dock.sections` | all | section ids, in order |
| `dock.size` | `24px` | launcher icon size |

**Pill keys.** `entity` (+ `attribute`), or `template:` (Jinja, live); `icon`, `prefix`, `suffix`,
`decimals`, `format` — the same value formatter as labels and nav chips, so `47.4` with a `°C`
unit shows as HA shows it. `color`, `text` (static), `tap_action` (default: more-info of the
entity), `hold_action`, `double_tap_action`.

## Room tiles

Each other room becomes a tile: its picture, its name, its info chips and up to `chips_max`
**state chips**. Tap the tile → the room opens. Chips act on their own and never open the room.

```yaml
rooms:
  - id: bedroom
    overview_tile:
      name: Ložnice                # default: the room's name
      show_name: false             # v6.31.0: hide (or with true: show) the name on this tile, whatever grid.names says
      hidden: false                # leave the room out of the grid
      focus: 50% 40%               # which part of the photo the tile shows (like object-position)
      chips: auto                  # auto (default) | none | a list:
      # chips:
      #   - light.bedroom_ceiling            # tap toggles (light, switch, fan, cover…)
      #   - entity: media_player.bedroom_tv  # tap = more-info for anything else
      #     icon: mdi:television
      #   - entity: climate.bedroom
      #     active_state: [heat, cool]       # when the chip lights up
      #     tap_action: { action: navigate, navigation_path: /dum/topeni }
      # hold_action: …             # long-press on the tile body (optional)
```

**Automatic chips** — what the room already has:

1. **Lights** — one chip for all `light_controls` lights and switches: lit while any is on; tap
   turns them all off (any on) or all on.
2. **Blinds** — one chip per blind with a cover `control:`; lit while not closed; tap toggles.
3. **Media** — one chip per `media_player` mentioned anywhere in the room; lit while playing;
   tap opens more-info (never switches a TV off by accident).

A chip lights up for any state except `off`, `closed`, `idle`, `standby`, `paused`, `docked`,
`unavailable`, `unknown` — or exactly the states in its `active_state`. Hold = more-info.

**The tile picture** follows `nav.live` (or `grid.live`): with `full`/`custom` it is the same live
mini as the nav thumbnail — lit lamps, glows, blind positions, labels — just bigger, and the
nav's *Show in mini* choices apply. `width_ref: auto` renders each mini at the width its tile
really needs (in 40 px steps), so a large tile is never an upscaled 480 px render. `composite`
stacks the active overlay images on the photo; `off` is the photo with the room's filter. Row
tiles default to `composite` — at ~90 px a full live room shows nothing more.

## Cross-room signals (v6.48.0)

Opt-in: `signals: true` in the `overview:` block shows what happens across the home on the tiles.

```yaml
overview:
  signals: true                    # or pick:
  # signals:
  #   presence: [sensor.michael_area, sensor.eva_area]   # default: the card's room_entity
  #   attention: true
  #   vacuum: false
```

- **presence** — the tile of the room someone is in gets a ring. The entities are presence
  sensors whose state names a room (Bermuda area sensors, the card's `room_entity`), matched like
  presence follow; `false` turns it off.
- **attention** — a badge with the count on a room whose collected section tiles are in their
  `active_state` (the washing machine runs → a badge on the hall). The badge shows the first
  tile's icon.
- **vacuum** — a robot badge on the room an **[AnyVac](https://github.com/Michailjovic/anyvac)**
  vacuum is cleaning (`in_cleaning`, `vacuum_room_name`).

Without `signals` the overview is exactly as before. The floor plan page shows the same signals
([FLOORPLAN.md](FLOORPLAN.md#across-rooms)).

## Phones

On the portrait profile the page fills the screen height (like `layout.height: fill`; a
`container` or fixed `layout.height` is respected):
the header and dock stay put and **only the grid scrolls**. Side columns move above or below the
grid (`portrait:`), and a card's `media: portrait` lets you give phones a compact weather card
and tablets the full one. Choose photo tiles or list rows with `grid.style.portrait`. Section
launchers in the dock open their panels as full-screen sheets, as everywhere on phones.

## The zoom

With `transition: zoom` the room grows out of its tile: the real full-size room is scaled down to
the tile and animated up (transform + clip-path only, GPU-composited), so it is sharp in every
frame and its first frame is exactly the tile. The room's own nav strip, light pills and cover
control then slide in from their edges. Going back to the overview (its thumbnail,
`switch-room`, next/prev) shrinks the room back into its tile. A swipe keeps its own drag preview;
a switch you didn't make (presence follow) fades instead of zooming. A second tap mid-animation jumps to the end.

Coming back from the overview costs no re-mount: the strip of live minis is parked while the
overview is shown and put back as it was.
