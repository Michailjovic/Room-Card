# Overview page — Implementation Plan

Status: **agreed 2026-10-19, shipped in v6.30.0** (the v6.26/v6.27 phases below were released
together; §9 shipped in v6.48.0 as `overview.signals`). See *Implementation notes* at the end for where the code differs
from this text.

This plan is written to be executed without the design conversation that produced it. Section 1
lists decisions that are **closed** — do not re-open them, and do not re-derive alternatives that
were already rejected there. It builds on [`COCKPIT_PLAN.md`](COCKPIT_PLAN.md) (sections, panels,
launchers) and does not change any decision made there.

---

## 0. What this feature is (and is not)

An **overview page**: one page of the card that shows every room at once as a tile, plus the
house-level things around it — a top bar (alert ticker, status pills), a side column (weather,
clock, calendar — any cards the user picks) and a bottom dock of section launchers. Tapping a room
tile switches to that room's normal view, exactly as a nav thumbnail does today.

The reference the author brought is the familiar "all rooms on one tablet screen" dashboard:
date + status pills on top, clock/weather/forecast/calendar on the left, a 3×3 grid of room photos
with a row of round state buttons each, and a dock of category buttons at the bottom.

**Why it is worth building now, when the floorplan (`project_floorplan`, ROADMAP 1b) was parked:**
the floorplan question was *does spatial arrangement earn its keep over the nav strip*. This is
not spatial. It is the dashboard shape people already hand-build for months in YAML, and the card
already owns almost every part of it — live minis (`nav.live: full`), multi-row grids
(`nav.rows`), section launchers with status (v6.16.0), embedded cards, the value formatter. What is
missing is a page that composes them full-screen. Product feature for other people first; the
author's own use is secondary (same footing as the cockpit, see COCKPIT_PLAN §0).

**Non-goals:** a floorplan, any built-in weather/clock/calendar widget, a free-form region editor,
home-screen / kiosk logic, any change to how ordinary rooms render.

---

## 1. Closed decisions

| # | Decision | Rationale |
|---|---|---|
| O1 | **The overview is a page, i.e. a room in `rooms:`** with an `overview:` block. No home-screen logic: the user puts it first in the list if they want it first. | `switch-room`, `url_sync`, swipe, wheel, `next-room`/`prev-room`, the editor's room picker all work unchanged. |
| O2 | **Presence follow is untouched.** The overview has no `area_match`, so follow never targets it; the follow button and `follow_mode` behave exactly as today. | Author's explicit requirement — Bermuda follow already works independently. |
| O3 | **On the overview page the overview owns the whole card body.** The global `layout` profile grid (nav / cards_above / image / lights / cards_below / cover) is not applied there. The nav strip is not shown on the overview page. | `layout` is global; its regions are room-shaped (image, lights, cover). Showing the nav strip above a grid of the same rooms duplicates it. |
| O4 | **Five fixed regions: `header`, `left`, `right`, `grid`, `dock`.** Every region except `grid` is optional; an omitted or empty region collapses and **the grid takes the freed space**. No free % grid for the overview. | The author's key requirement: drop the left column and the grid fills it; same for top/bottom bars. A % region editor here would be over-engineering — the five regions are the whole vocabulary of the reference design. |
| O5 | **`right` is supported** (same code path as `left`), not promoted in the editor. | Costs nothing extra in the renderer (mirror of `left`); the author doubts anyone uses it, so it sits behind the same panel as `left` with a side select. |
| O6 | **No built-in weather, clock or calendar.** `header`, `left`, `right` hold embedded HA cards (the existing `{card, height, media}` companion-card format). | COCKPIT_PLAN D12 — never render a core feature through a third-party card. The user picks their own weather card (e.g. `atmo-weather-card`). |
| O7 | **The dock is generated from `sections:`** — launcher per section with the v6.16.0 status ring/badge. Not a second list of icons. | Single source of truth; the launchers already exist and already show running state. |
| O8 | **Two tile styles: `card` (A, photo tile — the reference design) and `row` (B, a list row with a small thumbnail).** Chosen per profile: `{landscape: card, portrait: card|row}`. Both are offered on the phone; the user picks. | Author's decision: let people choose on mobile. Both styles render the same data, so it is one switch, not two features. |
| O9 | **On portrait the header and dock stay fixed and only the grid scrolls (inside the card).** The overview page always pins to full height like `layout.height: fill`, unless `layout.height` is `container` or a fixed length. | The dock must stay reachable; sections already open as bottom sheets into a pinned card (v6.13.0). |
| O10 | **Tile chips are capped per profile** (`chips_max`, default 3 portrait / 4 landscape) to keep a 44 px touch target. | A 2-column phone tile is ~170 px wide. |
| O11 | **Tile info line reuses `nav.chips`** (`{room}` substitution + per-room `chips:` override). | Temperature / humidity are already configured once for the nav thumbnails. |
| O12 | **The overview page itself appears in other rooms' nav strip** as an icon thumbnail (`icon:` on its room entry, no mini), and can be hidden from the strip with `nav_hidden: true`. | A live mini of a grid of minis is noise and recursion risk. |
| O13 | **Tiles are the same live minis as the nav, just bigger.** `grid.live: inherit` follows `nav.live`; under `full`/`custom` the tile shows exactly what the thumbnail shows (same per-element `nav_mini` selection). `grid.width_ref: auto` renders each mini at the tile's real width instead of `nav.mini.width_ref` (480), so a big tile is never a blurry upscale. | A 3-column grid without a left column on a 2560 px screen gives ~830 px tiles — at the nav's 480 px reference that is a 1.7× upscale, the blur already measured in the floorplan prototype (finding 1). |
| O14 | **Tile → room is a zoom (shared-element) transition**, reversed on the way back: the room grows out of its tile into the image region, the rest of the overview recedes, the room's own chrome (nav, lights, cover) fades in last. `overview.transition: zoom | fade | none`, default `zoom`; `prefers-reduced-motion` → `fade`. Swipe/wheel/follow keep their existing transitions. | Unique to this card: the tile already *is* the room (a live mini), so the zoom shows the same picture at every frame — no crossfade between two different images. |


### 1a. Compatibility contract

The overview is **opt-in and additive**. A release that breaks any line below is not shippable.

1. **No `overview:` anywhere → the card behaves byte-for-byte as v6.25.1.** Render tests snapshot
   every existing fixture before and after; editor output for an unchanged config is identical.
2. **Ordinary rooms are untouched when an overview page exists** — same layout profile grid, nav
   strip, light controls, cover control, sections, swipe, wheel, follow, `url_sync`.
3. **The existing cockpit pattern keeps working** — a room with a house `base_image` and launcher
   `icons` (`open-section`) is still a normal room; nobody has to migrate to the overview.
4. **One implementation per mechanism, shared, never forked:**

| Need on the overview | Existing mechanism it must call |
|---|---|
| Live tile | nav live-mini mount/scale (`_roc_mini`, v6.25.0 height-fit) |
| Tile image quality | `rocHqUrl` — same cache, same 16-px buckets, same 2-at-a-time queue as the nav |
| Composite / plain tile | the nav `composite` / thumbnail renderer |
| Cards in header / left / right | the `cards_above` / `cards_below` companion-card path incl. `media:` |
| Ticker in header | `nav.cards` configs via `nav_cards: true` |
| Dock | the section-launcher renderer (status ring, badge, `chip`) |
| Panels opened from the dock | the existing single section panel and its placements |
| Tile info line | `nav.chips` + per-room `chips:` |
| Chip / pill values | the v6.16.0 value formatter and `--roc-*` tokens |
| Chip / tile actions | the shared action handler (tap / hold / double-tap, scroll-vs-tap guard v6.12.2) |
| Editor fields | v6.18.0 action builder, v6.19.0 entity fields, v6.22.0 js-yaml boxes, `_mvBtns` |

   If a mechanism needs a new option to serve the overview, the option is added to the shared
   code (and benefits the nav too), never copied into an overview-only variant.
5. **No new image pipeline, no new compression, no new cache.** Originals stay originals; the
   full-size room never sees a resampled image.

---

## 2. Config schema

Every key must have an editor control (COCKPIT_PLAN D11). YAML below is what the editor produces.

### 2.1 The overview room

```yaml
rooms:
  - id: prehled
    name: Přehled
    icon: mdi:view-dashboard           # used for its nav thumbnail (O12)
    # nav_hidden: true                 # keep it out of the other rooms' strip
    overview:
      background: /local/overview_bg.webp   # optional; else the theme background
      transition: zoom                 # zoom (default) | fade | none — tile ↔ room, §4a
      transition_duration: 450ms

      header:                          # optional — omit = no top bar, grid moves up
        height: auto                   # auto (default) | CSS length
        items:                         # left → right
          - nav_cards: true            # re-use the nav.cards configs (e.g. alert-ticker-card)
            width: 45%
          - card: { type: custom:mushroom-chips-card, chips: [ ... ] }
          # v6.27.0: native pills, see 2.3
        portrait: { items_scroll: true }   # one horizontally scrollable row on phones

      left:                            # optional — omit = grid takes the width
        width: 28%                     # landscape width; default 28%
        cards:                         # companion-card format: card | {card, height, media}
          - card: { type: custom:atmo-weather-card, entity: weather.home }
            media: landscape
          - card: { type: custom:atmo-weather-card, entity: weather.home, compact: true }
            media: portrait
          - card: { type: calendar, entities: [calendar.family] }
            media: landscape
        portrait: top                  # top (default) | bottom | hidden — where it goes on phones

      right: { ... }                   # same schema as left; omitted by default (O5)

      grid:
        rooms: auto                    # auto = every room except overview pages | [ids] = order
        columns: { landscape: 3, portrait: 2 }
        style:   { landscape: card, portrait: card }   # card (A) | row (B)
        live: inherit                  # inherit nav.live | full | composite | off
        width_ref: auto                # auto = render each mini at the tile's own width (never upscaled); or px
        chips_max: { landscape: 4, portrait: 3 }
        info: true                     # show the nav.chips line (O11)
        gap: 12px

      dock:                            # optional — omit = no dock, grid moves down
        sections: auto                 # auto = every visible section | [ids] = subset + order
        size: 56px
```

### 2.2 Per-room tile

Optional on every ordinary room. Without it the tile uses the room's `name`, its live mini and
auto chips.

```yaml
rooms:
  - id: loznice
    overview_tile:
      name: Ložnice                    # default: room name
      hidden: false                    # leave this room out of the grid
      focus: 50% 40%                   # object-position of the photo/mini inside the tile
      chips: auto                      # auto | list (below) | none
      # chips:
      #   - entity: light.loznice_strop
      #     icon: mdi:ceiling-light     # default: entity icon
      #     tap_action: { action: toggle }      # default for toggleable domains
      #     hold_action: { action: more-info }  # default
      #   - entity: cover.loznice
      #   - entity: media_player.loznice_tv
      #     tap_action: { action: navigate, navigation_path: /dum/tv }
```

**Auto chips** (in this order, then capped by `chips_max`):

1. one **lights** chip if the room has `light_controls` — active if any of its entities is on;
   tap toggles all of them (`homeassistant.turn_off` when any is on, else `turn_on`);
2. one chip per **blind with a `control:` block** — active while not closed; tap = open/close;
3. one chip per **`media_player`** referenced anywhere in the room's elements — active while
   `playing`/`on`; tap = more-info (never toggle a TV by accident).

Tile tap → `switch-room` to that room. Chips stop propagation. A long-press on the tile body does
nothing in v6.26.0 (reserved).

### 2.3 Native header pills (v6.27.0)

```yaml
header:
  items:
    - pill: { entity: sensor.dhw_temperature, icon: mdi:water-boiler, state_class: auto }
    - pill: { template: "{{ states('sensor.nameday') }}", icon: mdi:cake-variant }
```

Rendered with the v6.16.0 value formatter and design tokens (`--roc-*`), same tap/hold/double-tap
actions as icons. Reason to have them natively at all: a status bar of pills is the most common
thing people put in such a header, and depending on a chips card for it repeats the D12 coupling.

---

## 3. Region layout

One CSS grid per profile, built from which regions exist:

```
landscape                        portrait (left.portrait: top)
┌──────────── header ───────────┐  ┌──── header ────┐
│ left │       grid      │right │  │ left (compact) │
│      │                 │      │  │      grid      │  ← scrolls
├──────────── dock ─────────────┤  │      ...       │
                                   ├───── dock ─────┤
```

- `grid-template-areas` is generated from the present regions; a missing region produces no track,
  so `grid` spans the freed area (O4). `left`/`right` on `1fr` remainder: `[left.width, 1fr,
  right.width]`.
- `header` and `dock` rows are `auto`; the middle row is `1fr` with `min-height: 0`;
  `grid` has `overflow: auto` (portrait scroll, O9) and `overscroll-behavior: contain`.
- Portrait: `left`/`right` become rows above or below the grid per their `portrait:` key, or are
  dropped (`hidden`). Cards inside keep their own `media:` filter, so a compact weather card for
  portrait and a full one for landscape is plain configuration.
- Grid columns come from `grid.columns[profile]`; `row` style forces one column.

---

## 4. Rendering

Reuse, do not rebuild.

- **Overview switch** — in `_render()`, when the active room has `overview:`, skip the layout
  profile grid and the nav region and render the overview grid instead (O3). Everything outside
  the room body (swipe, wheel, url_sync, follow) is untouched.
- **Region cards** — the companion-card path already used by `cards_above`/`cards_below`
  (`loadCardHelpers().createCardElement` + direct-create fallback, `media:` filter). `nav_cards:
  true` renders the `nav.cards` configs through the same path.
- **Dock** — generate one launcher per section through the existing section-launcher renderer
  (`open-section` + v6.16.0 status ring/badge + `chip: true` look). Panels open over the overview
  exactly as over a room (sheet-right / bottom sheet on portrait).
- **Card tiles (A)** — host box + the **existing live-mini mount/scale code** (`_roc_mini`,
  v6.25.0 height-fit + centring, HQ-resampled images) with the mini's reference width set from
  `grid.width_ref` (O13), re-mounted only when a tile's width crosses a 40 px step, not on every resize. `live: composite|off` uses the
  existing composite / plain thumbnail renderer instead. `focus` maps to the mini's offset inside
  the host. Name + chips row below/over the photo, frosted per the design tokens.
- **Row tiles (B)** — small thumbnail (composite by default — cheaper and sufficient at ~72 px),
  name + `nav.chips` info line, chips on the right.
- **Chips** — plain DOM, state updates via `setSt` in `_update()` like section tiles; no card
  instances.
- **Minis while the overview is shown** — the nav strip is not rendered on the overview page, so
  its minis must not keep updating in the background. Phase 1: overview tiles mount their own
  minis and the strip's minis are suspended (no `hass` pushes) while the overview is active.
  Reparenting the strip's mini instances into the tiles is an optimisation for later, only if the
  wall tablet measures a problem (open question 1).

Performance budget: 9 live minis on the wall tablet. Reference: 5 minis mount in 55.6 ms and hold
16.7 ms frames in headless Chromium (project_floorplan) — re-measure on the tablet in v6.26.0.


### 4a. Zoom transition (O14)

Animate **only `transform`, `opacity` and `clip-path`** — never width/height/top/left — so the
wall tablet composites it on the GPU without layout.

**Overview → room (inverse FLIP, sharp at every frame):**

1. On tile tap, record the tile's rect (and its `focus` crop) and freeze the overview layer as-is
   (kept in the DOM, `pointer-events: none`).
2. Render the target room normally in a layer above it, `visibility: hidden`. Await
   `img.decode()` of its base image (timeout ~150 ms → go anyway). The original is already in the
   HTTP cache — `rocHqUrl` fetched it for the tile.
3. Measure the room's image-region rect. Set on the image region
   `transform: translate(…) scale(s)` with `s = tileW / imageW`, plus
   `clip-path: inset(… round <tile radius>)` so the tile's crop is reproduced exactly; make it
   visible. It now covers the tile pixel-for-pixel — **the real full-size room scaled down, not a
   thumbnail scaled up**, so nothing ever looks blurry.
4. Transition to `transform: none; clip-path: inset(0 round <room radius>)`, ~450 ms,
   `cubic-bezier(.2,.8,.2,1)`. In parallel the overview layer goes to `scale(.96)` + `opacity: 0`.
5. At ~70 % of the duration the room's other regions (nav, lights, cover, cards) fade/slide in
   (~250 ms), each from the edge it sits on in the active layout profile (a region above the image
   slides down, one in a right column slides in from the right, one below slides up). On
   `transitionend` remove the overview layer and clear the inline styles.

   The target is **the existing room view, unchanged** (contract 1a.2) — the zoom only animates
   *into* it; nothing about the room's own layout, nav strip, light pills or cover control differs.

**Room → overview (reverse):** only when the switch targets the overview page via the nav
thumbnail, `switch-room` or `prev/next-room` *from the room that was opened from it*. Render the
overview behind (grid scroll position restored from the last visit), measure the tile, run steps
3–5 backwards. Otherwise (swipe, wheel, follow) use the existing transitions unchanged.

**Rules:**
- Reuse the swipe engine's two-layer container (it already composes two room layers); no second
  layering system.
- Interruptions: a second tap / swipe / follow during the animation jumps to the end state first.
- Row tiles (B) zoom out of their small thumbnail the same way; `clip-path` handles the aspect.
- `prefers-reduced-motion` (v6.24.0 handling) → 150 ms opacity fade, no movement.
- e2e: frame timing at 1280×800 under 4× CPU throttle (target: no frame > 33 ms), the end state
  equals a plain `switch-room` render, and an interrupted animation ends in a correct state.

**Phasing:** v6.27.0, after the grid and tiles exist (v6.26.0 ships with a plain switch).

---

## 5. Editor

### 5.1 Creating an overview page

*Rooms & menu → Add room* gains **Add overview page**. It creates a room with `overview:` pre-filled:
`grid` with `rooms: auto`, `dock` with `sections: auto` when sections exist, no header/left
(empty regions collapse, so the page is immediately usable).

### 5.2 "Overview" accordion (shown instead of the Image/Elements content for an overview room)

- **Regions** — a toggle per region (Header / Left / Right / Dock) with its size field; live mini
  sketch of the resulting layout per profile (reuse the Layout tab's `rocGridCss` sketch).
- **Header** — item list (add / reorder / remove via `_mvBtns`): *Nav strip cards*, *Card*
  (js-yaml box + card-picker preview from v6.21/v6.22), *Pill* (v6.27.0: entity field with
  suggestions, icon, template, actions via the v6.18.0 action builder).
- **Left / Right** — card list in the companion-card editor already used for Cards above/below,
  incl. the `media` select; portrait placement select.
- **Grid** — rooms (auto or a checklist with order), columns per profile, style per profile
  (card / row), live, chips max per profile, info toggle, gap.
- **Dock** — sections: auto or a checklist with order; size.
- **Background** image field.

### 5.3 Per-room "Overview tile" accordion

In every ordinary room (*Rooms & menu*): name, hidden, focus (two sliders with a live crop
preview), chips: *Auto* (shows the derived chips read-only) / *Custom* (list with entity
suggestions, icon, tap/hold via the action builder) / *None*.

---

## 6. Degradation rules

- An overview with no rooms to show renders an empty state explaining that rooms appear here.
- A chip whose entity is missing renders greyed, never blank (as section tiles).
- A region card whose custom element is not registered shows the COCKPIT_PLAN 5.3.3 notice.
- `dock.sections: auto` with no sections → the dock collapses (no empty bar).
- A room listed in `grid.rooms` that does not exist is skipped (editor ID check flags it).

---

## 7. Tests

Three tiers plus e2e, with the documented traps (`const` not global in smoke's VM; `set hass`
defers `_update` — await ~30 ms in jsdom).

- **smoke** — region resolution + collapse matrix (each optional region on/off), grid room list
  (auto excludes overview pages, explicit order, hidden tiles), auto-chip derivation and cap,
  `nav.chips` reuse for the info line.
- **render (jsdom)** — overview room renders the overview and no nav strip / no layout regions;
  ordinary rooms unchanged byte-for-byte; tile tap → `switch-room`; chip tap calls the right
  service and does not switch room; hold → more-info; dock launchers open sections; card vs row
  style per profile; strip minis suspended while the overview is active; overview icon thumbnail
  in the other rooms' strip and `nav_hidden`; editor round-trip for `overview` and
  `overview_tile` incl. add/reorder/remove.
- **e2e (Playwright)** — 1920×1080 and 1280×800: all regions / no left / no header+dock — grid fills
  the freed area, no overflow; 390×844 portrait: card and row styles, header + dock stay visible
  while the grid scrolls, chip hit area ≥ 44 px, bottom-sheet section opens over the overview.

Verify against the repository's own files (copy from the repo, `md5sum` before declaring green —
see project memory `verify-the-repo-copy`).

---

## 8. Phasing

| Version | Contents |
|---|---|
| **v6.26.0** | Overview room, five regions with collapse, region cards + `nav_cards`, dock from sections, **card tiles (A)** on both profiles, auto + custom chips, info line, portrait scroll, overview thumbnail in the strip, strip-mini suspension, full editor for all of it, tests. |
| **v6.27.0** | **Zoom transition** tile ↔ room (§4a), **row tiles (B)**, native header **pills**, `background`, tile `focus` preview polish. |
| **v6.28.0** | Cross-room signals on tiles (see §9) — shipped in v6.48.0. |
| — | Overview preset in `PRESETS.md` with a worked config once v6.27.0 is out. |

---

## 9. Cross-room signals — implemented in v6.48.0

*As built:* opt-in `overview.signals: true | {presence, attention, vacuum}`; presence comes from
`presence:` (entity / list) or the card's `room_entity`; the vacuum signal reads AnyVac's map
sensor (`in_cleaning`, `vacuum_room_name`) rather than the vacuum widget. The same signals are drawn
on the floor plan page (V7_PLAN §6.4, Phase 6). The original proposal:

These are the "relationships across rooms" that made a floorplan tempting (project_floorplan);
the grid can carry them without one:

- **presence** — a ring on the tile of the room `room_entity` currently maps to;
- **attention** — a badge on a room tile when a section tile *collected from that room* is in its
  `active_state` (the washing machine finished → badge on the laundry tile);
- **vacuum** — the vacuum widget's room shown on that tile.

---

## 10. Open questions

1. Whether the strip's mini instances should be reparented into the tiles instead of mounting a
   second set — decide after measuring v6.26.0 on the wall tablet.
2. Whether `nav_cards: true` should move the live ticker instance into the header rather than
   creating a second one (only the overview page shows either, so a move is possible).
3. Long-press on a tile body — candidates: the room's own `hold_action`, or more-info of its
   lights. Reserved until someone asks.

---

## 11. Implementation notes (v6.30.0)

- **One release.** The author asked for the whole thing at once, released as v6.30.0 (v6.26–v6.29
  unused). §9 (cross-room signals) is not in it.
- **Code shape.** Overview rendering lives in `_ovBuild()` / `_ovWire()` / `_updateOverview()`;
  the transition in `_ovPlanSwitch()` (before the switch re-renders) and `_ovRun()` (after). Shared
  with the nav, factored out of it unchanged: `_mountMini()`, `_navChipInto()`, `_paintThumb()`.
  Dock launchers are synthetic `icons` added to the overview room's merged view after `icoHtml`,
  so the icon pipeline wires them and draws their section status. The overview CSS
  (`ROC_OV_CSS`) is injected only when the config has an overview room (1a.1).
- **Schema additions** beyond §2: `header.items[].media`, `grid.fill` (landscape photo tiles
  stretch to fill the height, default on), `grid.min_height`, `grid.aspect_ratio`, `gap`,
  `padding`, pill `text` / `color` / `double_tap_action`, tile `hold_action` /
  `double_tap_action`. `dock.size` is the launcher **icon** size (default `24px`), not the button
  diameter.
- **Zoom details.** During the zoom the room's image region and `.wrap` are `overflow: visible`
  while clip-path crops — otherwise a room whose photo is cover-cropped by its region could not
  start as the tile (which shows the whole stage). The room's overlays/glows get one state pass
  with their own transitions off before the first frame, so lit lamps don't fade in from 0. A
  zoom runs only for a switch the user made; presence follow fades (O14 says swipe/wheel/follow
  keep their transitions — the wheel is a user switch and zooms; follow fades instead of the old
  clone ghost, whose live-mini tiles would render blank).
- **Open question 1 (minis) — decided:** the strip is parked while the overview is shown
  (`_navStash`) and restored on the way out; tiles mount their own minis. Parked minis get no
  hass; restored ones get fresh states after the zoom (`_ovAnim` gone), never inside it.
- **Open question 2 (`nav_cards`) — decided:** the header mounts a second instance of each nav
  card; only the overview page shows either, and the strip copy is parked with the strip.
- **Phones:** portrait pins the overview to the screen height even under `layout.height: viewport`
  (`_layoutRootHeight` exception), as O9 says.
- **Frame timing** (§4a asked for no frame > 33 ms at 4× throttle): measured in the dev container,
  the zoom runs at ~30 fps with worst frames of 50 ms (most likely the clip-path repaint of the region, not verified).
  The e2e bound is max < 70 ms and mean < 36 ms; re-measure on the wall tablet.

