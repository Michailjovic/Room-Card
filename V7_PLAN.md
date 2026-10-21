# Room Card v7 — Studio, Floorplan, AnyVac — Implementation Plan

Status: **agreed 2026-10-21** (versions from v6.40.0). Phase 0 (spikes) in progress. Written to be executed
without the conversation that produced it: §1 lists decisions that are **closed** — do not re-open
them and do not re-derive alternatives already rejected there. §3 lists spikes that must be done
**before** any phase that depends on them.

Builds on, and does not change, [`COCKPIT_PLAN.md`](COCKPIT_PLAN.md) (sections, panels,
launchers) and [`OVERVIEW_PLAN.md`](OVERVIEW_PLAN.md) (overview page, zoom transition). Replaces
the parked "living floorplan" idea (ROADMAP 1b) and the old v7.0.0 plan ("debugged overview + AI
README"), which is folded into §4 Phase 10.

The visual concept this plan targets was prototyped from the author's real data (AnyVac geometry
from `sensor.kitchen_s8_maxv_ultra_anyvac_map`, real temperatures, heating and dock):
**"Živý půdorys" artifact**, plus `prototypes/floorplan-prototype.html` (2026-09, live-mini slots).

---

## 0. What v7 is (and is not)

Three things, in this order, each standing on the previous one:

1. **Studio** — the card's own full-screen editor. Everything that is edited today in Home
   Assistant's narrow editor panel (forms *and* spatial work) moves into a full-screen workspace
   that edits the card directly on its own canvas, with undo, search and validation. HA's editor
   panel stays only as the entry point (+ raw YAML as the escape hatch).
2. **Floorplan** — a new page type (a room with a `floorplan:` block, like the overview page) that
   draws the home as a vector plan, top-down or isometric, generated from the vacuum map via
   **AnyVac** — or drawn by hand in the studio for people without a Roborock. Lights, floor
   heating, temperature, presence, windows with blinds, doors and any other entity are placed on it.
3. **Documentation & launch** — a rebuilt GitHub presence: README landing page, guides for the
   studio and the floorplan, a configuration reference generated from the schema, an AI-readable
   spec (`docs/AI_SPEC.md` + `llms.txt`), a live demo, HACS default-repository submission.

**The product thesis stays the same** (ROADMAP, cockpit debate): people hand-write YAML for months
to build these dashboards; the card should let them only know their goal. **The GUI is the
deliverable, not the renderer** — the studio is therefore the core of v7, and the floorplan is its
first big feature, not the other way round.

**Non-goals for v7:**

- Generating images (AI or otherwise) inside the card. The plan is vector; a photo-real look is the
  user's own render, calibrated via AnyVac (§6.6).
- Vacuum control UI. AnyVac + anyvac-card own cleaning; the floorplan *shows* the vacuum and may
  offer one optional "clean this room" quick action (§6.5).
- A general-purpose Lovelace dashboard editor. The studio edits **this card** only.
- Changing how existing configs render. See §2a.

---

## 1. Closed decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **The studio is full-screen and owns forms as well as spatial editing.** HA's editor panel keeps: an *Open Studio* button, a handful of basics, the YAML box. | Author: the HA panel width is a hard limit and the GUI is still "a fight"; the studio is the chance to change *how* things are edited, not just where. |
| D2 | **The studio edits a local copy of the config and renders the card itself** — no round-trip through HA's live preview. | Every hard editor bug so far (v6.15.4–6.15.8 `<ha-yaml-editor>` revert, `#room=` hash sync, `_mountPreview`, Save-overlay workaround) traces back to the preview being recreated on every `config-changed`. |
| D3 | **Two save paths.** (a) Studio opened from HA's editor → returns the config through the editor's own `config-changed` (official API, HA saves). (b) Studio opened from the dashboard (card edit mode) → saves through `lovelace/config` + `lovelace/config/save` with a conflict check, the same WS calls the test-mode Save button already uses. YAML-mode dashboards → copy-YAML only. | (a) needs no internal API or admin rights; (b) is what makes the studio usable on the wall tablet. Formatting is not lost: storage-mode dashboards are JSON and HA regenerates YAML on every "Edit in YAML" anyway. |
| D4 | **The studio never drops what it does not understand.** KEEP pattern everywhere (start from the old object), unknown keys round-trip byte-for-byte. | Same rule the editor follows since v6.18.0; a full-screen editor that silently eats keys would be worse than the panel. |
| D5 | **The studio is lazy-loaded.** Dashboards that only view the card do not download or parse it. | The source is ~790 KB (10.7k lines, ~4.6k of them the editor) and every wall tablet loads the whole minified file today. |
| D6 | **The floorplan is a page, i.e. a room in `rooms:` with a `floorplan:` block** — same model as the overview (OVERVIEW_PLAN O1). Swipe, `switch-room`, `url_sync`, nav strip, presence follow behave as for the overview page. | Proven model; no home-screen logic. |
| D7 | **Geometry is a snapshot in the config.** AnyVac geometry is imported once (and re-imported on demand) into `floorplan.rooms[].polygon` in metres; only *live* data (robot position, trail, coverage) is read from the AnyVac sensor at runtime. | A vacuum re-mapping a room must never break the plan; the plan must work with AnyVac uninstalled. |
| D8 | **AnyVac owns geometry truth, Room Card owns rendering, bindings and editing.** Anything that derives geometry from the map (outlines, walls, doors, floors) is requested from AnyVac (§7), never re-implemented in the card. | AnyVac's own canon is backend-first (its docs/14); two implementations of map parsing would drift. |
| D9 | **The floorplan works without AnyVac**: rooms drawn as polygons in the studio, optionally traced over an uploaded floorplan image. | Product feature for everyone, not only Roborock owners. |
| D10 | **Vector renderer (SVG), two projections: `top` and `iso`.** One coordinate space (plan metres) for every floorplan element; the renderer projects it. Walls are generated from room polygons; floors get textures; effects are clipped to room polygons. | Prototype: the iso view is an affine transform of the floor plane plus generated wall quads — cheap, sharp, theme-able. |
| D11 | **A photo-real look is an optional background**, not a renderer mode: the user's own render (e.g. AI-regenerated from the AnyVac snapshot) is calibrated to plan metres via AnyVac fiducials / `home_anchors`, and the vector effects draw on top. | Author's `cockpit_view1.jpg` is exactly this; calibration already exists in AnyVac (docs/40 §5). |
| D12 | **Room tap on the floorplan opens the room's normal view with the zoom transition** (OVERVIEW_PLAN O14 machinery, room polygon instead of tile rect). | One mental model across overview and floorplan. |
| D13 | **Every entity can be placed on the plan.** Dedicated visuals for: light, floor heating (`climate`), temperature/humidity, presence, window, cover (blind), door, media player, vacuum. Everything else is a generic marker (icon + state + actions) using the existing action builder. | "More or less everything I control in HA" — honest scope: control for all, bespoke graphics for the common types. |
| D14 | **Compatibility contract holds for the whole of v7** (§2a). v7.0.0 is a major version because the *editing experience* changes, not the config. | Existing users upgrade without touching their YAML. |
| D15 | **Published artifacts stay English** (code comments, CHANGELOG, release notes, docs); the studio UI is translatable (EN first, CS second, §5.8). | Project convention; the studio is user-facing so it needs i18n from the start. |

### 2a. Compatibility contract

A release that breaks any line below is not shippable.

1. A config without `floorplan:` and without studio-only keys renders **byte-identical** to v6.31.0
   (the existing compat harness — 15 reference configs + the author's live config, version string
   normalised).
2. HA's own editor keeps working for every existing config until v7.0.0, and keeps the YAML box
   after it.
3. Opening a config in the studio and saving without edits produces **the same config object**
   (deep-equal, key order preserved).
4. The viewer bundle (what a dashboard loads) does not grow by more than **+5 % minified** across
   all of v7 outside the floorplan renderer, which itself loads only when a floorplan room exists.

---

## 3. Spikes (Phase 0 — no release, go/no-go before Phase 1)

Each spike ends with a short note appended to §11 and a decision. Spikes run against the author's
**real HA in a browser**, not only jsdom (lesson: `feedback_ha_editor_patterns`, v6.15.8 revert;
v6.31.0 Lit `ha-card` slot timing).

| # | Question | Done when |
|---|---|---|
| S1 | **Can the studio sit above HA's editor dialog?** If HA's dialog lives in the browser top layer (native `<dialog>` / modal), a `position:fixed` overlay on `<body>` renders *under* it — check which HA uses today. Candidate: the studio is its own `<dialog>` opened with `showModal()` (later top-layer entries stack on top), or the Popover API. Also: focus trap, Escape, scroll lock, phone companion app. | Studio shell opens from the HA editor, is on top, takes focus, closes back into the editor with its state intact, on desktop Chrome + Android companion app. |
| S2 | **Lazy-loading a second file through HACS.** Does HACS install additional release assets next to `room-overlay-card.js` (e.g. `room-overlay-card-studio.js`)? If not: the studio stays in the one file but behind a factory function that is only *parsed* on open (download cost remains, parse cost goes). | Measured: viewer download size and parse time on the wall tablet for both variants; decision recorded. |
| S3 | **Save from the dashboard.** `lovelace/config/save` for (a) masonry, (b) sections view, (c) a card nested in a stack, (d) two cards with the same type; conflict detection via re-read + hash compare; non-admin user → read-only studio with copy-YAML. | All four cases save the right card; a concurrent edit in another tab is detected and reported instead of overwritten. |
| S4 | **HA-in-the-loop test tier.** A real Home Assistant container in CI (or locally scripted) with the card as a resource and a seeded dashboard, driven by Playwright. | One smoke test: open dashboard, open editor, open studio, change one field, save, reload, value is there. |
| S5 | **Floorplan performance on the wall tablet.** The prototype's iso SVG (5 rooms, textures, glows, animated heating pipes, robot) — frame times during a state burst and during the top↔iso transition. | Median ≤ 16.7 ms, worst ≤ 50 ms on the tablet; otherwise decide what moves to canvas or gets simplified. |
| S6 | **AnyVac contract read.** Which attributes, which `schema_version`, which frame, behaviour when the sensor is unavailable or `home_frame` is `null`. | A written list in §7 confirmed against AnyVac `README.md` and a live sensor. |

---

## 4. Phasing

v7 work starts at **v6.40.0** (author's decision, 2026-10-21); v6.32–v6.39 stay free for fixes and
small features on the current line. Never reuse a version; strict A.B.C. Each phase is releasable on
its own and field-tested before the next one starts.

| Phase | Contents | Size | Release |
|---|---|---|---|
| **0** | Spikes S1–S6 (§3). | M | none |
| **1** | **Foundation** (§5.1): source split into modules + bundler producing the same single viewer file (+ lazy studio chunk per S2); config **schema registry** (§5.2) covering every existing key; HA-in-the-loop tier (S4) in CI; compat harness extended with the author's config. No user-visible change. | L | 6.40.0 |
| **2** | **Studio shell** (§5.3–5.5): full-screen workspace, live canvas (the card rendered directly), today's editor tabs hosted unchanged in a side panel, both save paths, undo/redo, unsaved-changes guard, *Open Studio* button in HA's editor and in card edit mode. Opt-in; HA editor untouched. | L | 6.41.0 |
| **3** | **Canvas editing** (§5.6): select on canvas → inspector, drag/resize/rotate, snap guides (old E4), draw-to-create for every element type (E3), search/filter (E5), inline save errors (E6), multi-select, copy/paste of elements and whole rooms, keyboard shortcuts, touch gestures. Split in two releases: **3a** (selection, outline + search, add on the image, copy/paste/delete, snap guides, Edit mode retired) and **3b** (multi-select, align/distribute, layers, room copy). | L | 6.42.0–6.43.0 |
| **4** | **Forms rebuilt** (§5.7) where the fight is biggest, on our own components (no HA Lit components inside our DOM): entity picker with friendly names and live state, action builder, sections/tiles, overview; **new-card wizard** (rooms from HA areas, images, recipes); validation messages pinned to the element on the canvas. | XL | 6.44.0–6.45.0 |
| **5** | **Floorplan core** (§6.1–6.3): `floorplan:` page, geometry model, top + iso renderers, walls/floors/doors, room tap → zoom into the room, AnyVac import, manual drawing and image tracing in the studio. | L | 6.46.0 |
| **6** | **Bindings** (§6.4): lights (colour + brightness glow), floor heating, temperature tint, humidity, presence, media, generic entity markers, labels; **cross-room signals** (OVERVIEW_PLAN §9 — presence ring, attention badge, vacuum room) on both the floorplan and overview tiles. | M | 6.47.0 |
| **7** | **Wall elements** (§6.5): windows (contact), blinds (cover position; roller/venetian/day_night renderers reused), doors (contact, swing), all snapped to walls and drawn on wall faces in iso. | L | 6.48.0 |
| **8** | **AnyVac live** (§6.6): robot position + heading, trail, coverage/last-cleaned layer, optional "clean this room" quick action, frame/floor picker, calibrated photo background (fiducials / `home_anchors`). | M | 6.49.0 |
| **9** | **Studio becomes the default editor** (§8): HA editor reduced to launcher + basics + YAML; beta pre-releases (HACS "show beta"), ≥ 2 weeks field test on desktop, wall tablet and phone with no regression. | M | 7.0.0-beta.N |
| **10** | **Documentation & launch** (§9): README, guides, generated reference, AI spec + `llms.txt`, PRESETS refresh incl. cockpit + floorplan presets, screenshots/GIFs, live demo, repo cleanup, HACS default submission. | L | **7.0.0** |

Sizes are relative (S < M < L < XL), not calendar estimates; the editor phases (2–4) are the
majority of the work, as expected for this project.

**Gates (author decides, nothing proceeds silently):**

- **G1** after Phase 0 — studio hosting (S1) and loading (S2) work; otherwise re-plan D1/D5.
- **G2** after Phase 2 — the shell is better than the panel on the author's PC *and* tablet.
- **G3** after Phase 5 — the generated look is good enough. Includes the "one simple controller"
  test from the cockpit debate: a household member who ignores overviews should be able to use it.
- **G4** before 7.0.0 — beta period clean, docs (Phase 10) complete.

---

## 5. Studio

### 5.1 Code structure (Phase 1)

- Source moves from one 10.7k-line file to modules (`src/card/…`, `src/studio/…`,
  `src/floorplan/…`, `src/shared/…`); a bundler (esbuild — single dependency, fast, already
  Node-based like `build.js`) emits `dist/room-overlay-card.js` (viewer) and, per S2, the studio
  chunk. `build.js --check` and `build:verify` keep running every test tier against the **built**
  files.
- The release workflow uploads every built asset with the existing retry + verification logic.
- Tests import modules directly where useful; the existing tiers keep passing a bundle path.

### 5.2 Config schema registry (Phase 1, used everywhere after)

One declarative description of every config key: type, default, allowed values, which entity
domains fit, help text, since-version, room-scoped or global. It drives:

- **validation** in the studio (messages pinned to the element),
- **form generation** for simple fields (Phase 4 does not hand-write 300 inputs),
- the **configuration reference** in the docs (Phase 10, generated, never hand-synced again),
- **`docs/AI_SPEC.md`** (generated part) — the "another AI must be able to configure it" goal.

Enum values and identifiers come from the code, never invented (`feedback_ground_ui_in_hard_data`).

### 5.3 Workspace layout (Phase 2)

```
┌ toolbar: room ▾ · profile (landscape/portrait/phone preview) · undo/redo · search · Save ┐
│ outline (rooms › elements, layers)  │        canvas — the real card, live hass        │ inspector │
│                                     │   select / drag / draw on it, zoom & pan         │ (forms)   │
└ status bar: validation messages · unsaved changes · save target (editor / dashboard / YAML) ┘
```

Phone width: outline and inspector become bottom sheets; the canvas stays full-width.

### 5.4 Save paths and safety (Phase 2)

Per D3: editor-hosted → `config-changed`; dashboard-hosted → WS save with conflict check (S3);
non-admin or YAML-mode → copy YAML. Plus: undo/redo across everything (command stack, not
snapshots of the DOM), unsaved-changes guard on close, and a **"restore previous version"** list
(last 10 saved configs kept in `localStorage` of that browser — a convenience, not a backup).

### 5.5 Hosting today's editor (Phase 2)

The existing tabs (`_render`/`_collectConfig` HTML-string forms) are mounted unchanged inside the
inspector. Their `config-changed` is intercepted and applied to the studio's local copy. This gives
the full-screen benefit on day one and lets Phases 3–4 replace sections one at a time.

### 5.6 Canvas editing (Phase 3)

Select by click/tap (cycle through stacked elements with repeated clicks), handles for move/resize,
arrow-key nudge (Shift = 10×), snap to grid / edges / centres / other elements with visible guides,
draw-to-create for zones, icons, labels, gauges, glows, blinds, embedded cards; hide/lock per layer;
multi-select + align/distribute; copy/paste across rooms; duplicate room. Pointer events only, so
mouse, pen and touch share one code path.

### 5.7 Forms rebuilt (Phase 4)

Priority by pain, from the issues log: actions, entity fields, sections/tiles, overview, light
controls, cover control, nav. Our own small components (no HA Lit elements inside the studio — the
v6.15.x lesson): entity picker (search by name/area/domain, live state, "not found" hint), icon
picker (MDI names from HA's own icon list, never invented), colour, length/percentage, action
builder. A **wizard** for a new card: pick HA areas → rooms with names and `area_match`, pick images,
optionally import a floorplan (§6.3), choose a preset.

### 5.8 Cross-cutting

- **i18n:** string table from Phase 2 (EN), CS added before 7.0.0; language from `hass.language`.
- **Accessibility:** full keyboard path through outline → canvas → inspector, visible focus,
  reduced motion respected.
- **Performance:** the canvas card re-renders only the touched room; no full re-render per keystroke
  (debounce as `_fireDebounced`, 150 ms).

---

## 6. Floorplan

### 6.1 Config shape (Phase 5, names final at implementation)

```yaml
rooms:
  - id: home
    name: Byt
    icon: mdi:floor-plan
    floorplan:
      projection: iso              # top | iso — the user can switch in the view too
      source:                      # optional; omit for a hand-drawn plan
        anyvac: sensor.kitchen_s8_maxv_ultra_anyvac_map
        imported: 2026-10-21       # snapshot date (D7)
      wall: {height: 0.6, thickness: 0.15}     # metres; low cut-away walls in iso
      background: /local/plan-render.webp      # optional photo/AI render (D11)
      rooms:                       # geometry snapshot, plan metres
        - room: bedroom            # links to rooms[].id → tap opens that room
          polygon: [[12.4,0.1],[15.7,0.1],…]
          floor: wood              # wood | tile | carpet | concrete | none
          anyvac_room: 7bUI4d…_19  # home_room_id, for live data and re-import
      openings:                    # doors and windows on walls
        - {type: door, at: [9.15, 2.9], width: 0.8, entity: binary_sensor.…}
        - {type: window, at: [14.0, 0.1], width: 1.1, entity: binary_sensor.versatile_bedroom_window_state,
           cover: cover.roller_motor_bedroom}
      items:                       # anything placed on the plan (§6.4)
        - {type: light, room: bedroom, entity: light.light_group_bedroom}
        - {type: heating, room: bedroom, entity: climate.versatile_bedroom}
        - {type: marker, at: [3.1, 1.2], entity: media_player.…, icon: mdi:television}
      layers: {lights: true, heating: true, temperature: false, presence: true, vacuum: true}
```

### 6.2 Rendering (Phase 5)

- SVG, one floor group in plan metres; `top` = identity, `iso` = rotate + squash (affine) for the
  floor plane; walls generated as quads from polygon edges minus openings, painter-sorted by depth;
  labels and markers projected to screen space so they never skew.
- Floors: built-in textures (generated SVG patterns, theme tokens for light/dark).
- Transition top ↔ iso animates the floor transform; walls fade in after it.
- Room tap → zoom into the room page (D12). Nav strip shows the floorplan page as an icon thumb,
  like the overview page (OVERVIEW_PLAN O12).
- Degradation: AnyVac sensor missing → plan still renders from the snapshot, vacuum layer hidden;
  a room id that no longer exists → its polygon renders greyed, tap disabled, studio warns.

### 6.3 Getting the geometry (Phase 5)

1. **Import from AnyVac** (studio): choose the vacuum/frame, preview, map AnyVac rooms to card
   rooms (`home_room_id` preferred over names — "Corridor" ≠ "Hall"), clean-up is applied: close
   gaps up to 0.5 m (furniture inside the outline), orthogonalise near-right angles, merge collinear
   edges. Prototype: 60-point outlines → 6–10-point rooms. Doors are proposed where two rooms touch.
2. **Draw by hand**: rectangle and polygon tools in metres, wall snapping, dimensions shown.
3. **Trace over an image**: upload a floorplan picture, set scale with one known distance, draw.

### 6.4 Bindings (Phase 6)

| Type | Entity | Visual |
|---|---|---|
| light | `light.*`, `switch.*` | glow clipped to the room, colour from `rgb_color`, strength from `brightness`; tap toggles, hold more-info |
| heating | `climate.*` | serpentine pipes clipped to the room; flowing + warm while `hvac_action: heating`, cool and still otherwise |
| temperature / humidity | `sensor.*` | room tint on a gradient (reuses `color_gradient`) + value on the room label |
| presence | Bermuda `*_area`, `room_entity` | pulse in the room the person is in |
| media | `media_player.*` | screen glow, app/source label |
| marker | anything | icon + state + the standard tap/hold/double-tap actions |
| label | sensor / template | text on the plan (the existing label engine) |

Cross-room signals (OVERVIEW_PLAN §9) are implemented once and shown on both the floorplan and the
overview tiles.

### 6.5 Wall elements (Phase 7)

Openings snap to the nearest wall and store `at` + `width`. Window: frame + pane, open state from a
contact sensor. Blind: the cover position fills the opening (roller / venetian / `day_night`
renderers reused, scaled to the opening); in iso it is drawn on the wall face. Door: swing arc,
open state from a contact. Optional "clean this room" quick action calls `anyvac.clean` with that
room (only when AnyVac is installed).

### 6.6 AnyVac live and the photo background (Phase 8)

Robot position + heading (`vacuum_position_home_px`, or `live.pos_home_px` while cleaning), trail
(`path_dry_home_px` / `path_wet_home_px`), coverage and last-cleaned per room. Mapping home px →
plan metres is fixed at import (1 px = `cell_mm / scale` mm, frame origin stored with the snapshot).
**Photo background:** the user runs `anyvac.snapshot_map_as_floorplan` with `fiducials: true`, makes
the render, and the studio calls `anyvac.detect_floorplan_fiducials` (or lets the user click 4–6
points snapped with `anyvac.snap_wall_corner`) to get `home_anchors` → background placed under the
vector layers.

---

## 7. AnyVac — requests and contract

Room Card reads AnyVac; it never changes it. Requests go to the AnyVac project as issues. Each has a
fallback so Room Card does not block on it.

| # | Request to AnyVac | Fallback in Room Card |
|---|---|---|
| A1 | **Fix `outline_home_px` for rooms split into several mask components** (reported 2026-10-21: Kitchen traced as a 0.75 × 0.25 m island because `outline_from_mask` seeds from the topmost pixel). | Use `bbox_home_px` as a rectangle and let the user adjust it in the studio. |
| A2 | Publish **clean wall polygons** (gap closing + orthogonalisation) per room, or per frame. | Room Card applies the same clean-up at import (§6.3). |
| A3 | **Door candidates** from robot traversal between rooms (where paths cross room boundaries). | Doors proposed where rooms touch; user confirms. |
| A4 | A short **consumer contract** section (attributes, units, `schema_version` guarantees) so Room Card can check compatibility. | Room Card checks `schema_version ≥ 3` and `home_frame != null`, else hides live layers. |
| A5 | Optional `rooms[].area_id` (HA area) per segment. | Mapping done once in the import step. |
| A6 | Multi-floor: one frame per floor with a stable label. | Frame picker by id in the studio. |

### 7a. Consumer contract (spike S6, read 2026-10-21 against AnyVac 1.51.4 README + live sensor)

Room Card reads one sensor per vacuum: `sensor.<vacuum>_anyvac_map`. Everything below is an
attribute of it.

| Attribute | Unit / shape | Used for | When missing |
|---|---|---|---|
| `schema_version` | int; `3` = home-frame contract | gate for every live layer | `< 3` → live layers hidden, snapshot plan still renders |
| `home_frame` | `{id, cell_mm, scale, width_px, height_px}`; 1 home px = `cell_mm / scale` mm (12.5 mm today) | import scale + origin, stored with the snapshot | `null` (just restarted / unaligned) → live layers wait, nothing else changes |
| `registration` | `{status: reference \| aligned \| unaligned, rotation_deg, score, iou}` | import picks a `reference`/`aligned` vacuum | `unaligned` → that vacuum is not offered for import/live |
| `rooms[]` | `{segment_id, name, bbox_home_px, outline_home_px[[x,y]…≤60], home_room_id}` | import geometry, room mapping (`home_room_id`) | `outline_home_px` null/degenerate → `bbox_home_px` (see A1) |
| `vacuum_position_home_px`, `charger_home_px` | `{x, y, a}`; `a` = image-px atan2 (0° = +x, 90° = +y) | robot + dock | `null` → robot hidden |
| `live` | `{pos_home_px, dry_home_px, wet_home_px, …}` while cleaning, else `null` | smoother live position/trail | fall back to `vacuum_position_home_px` / `path_*_home_px` |
| `path_dry_home_px`, `path_wet_home_px` | list of segments, each a list of `{x, y}` | trail | `[]` → no trail |
| `vacuum_room_name`, `in_cleaning` | room name, bool | "cleaning now" state on the room | ignored |
| `rooms_coverage`, `rooms_last_cleaned` | `{room: {dry, wet, …}}`, `{room: {any, dry, wet}}` ISO time | cleaning layer | layer hidden |

Services used only from the studio (never from the viewer): `anyvac.snapshot_map_as_floorplan`
(`frame: "home"`, `fiducials: true`), `anyvac.detect_floorplan_fiducials`, `anyvac.snap_wall_corner`;
`anyvac.clean` only for the optional "clean this room" quick action.

Observed in the author's install (2026-10-21): three vacuums, three frames — S6 + S7 Bunker share
one (`aligned`), S7 MaxV and S8 have their own. S8's frame covers all five rooms and is the right
import source for the flat.

---

## 8. Transition to the studio as default (Phase 9)

- HA's editor panel shows: *Open Studio* (primary), card type basics, YAML. Old tabs remain
  reachable behind "Classic editor" for one minor release after 7.0.0, then are removed.
- Migration notes in the release: nothing to change in configs; where things moved in the UI.
- Beta channel via GitHub pre-releases (HACS "Show beta versions").
- Field-test checklist: desktop Chrome, wall tablet (kiosk), Android companion app, iOS Safari
  (if available); sections view and masonry; admin and non-admin user.

---

## 9. Documentation & launch (Phase 10)

1. **README** as a landing page: one hero GIF (floorplan → room zoom), what the card is in three
   sentences, install, "first room in 2 minutes" via the wizard, links. The current README claims a
   *HACS Default* badge although the default-repo submission is still open — fix the badge or land
   the submission first.
2. **docs/** restructure:
   - `GETTING_STARTED.md` (wizard, first room, first light),
   - `STUDIO.md` (replaces `EDITOR.md`; tool-by-tool, with short GIFs),
   - `FLOORPLAN.md` (AnyVac import, hand drawing, tracing, bindings, photo background),
   - `OVERVIEW.md` (moved out of CONFIGURATION),
   - `CONFIGURATION.md` = generated reference from the schema (§5.2) + hand-written concepts,
   - `AI_SPEC.md` (generated reference + task recipes "user wants X → config Y") and root `llms.txt`,
   - `TROUBLESHOOTING.md` (cache after update — wait for the release asset before updating in HACS,
     non-admin save, YAML-mode dashboards, AnyVac not found).
3. **PRESETS.md** refresh: cockpit preset (open since v6.10.0), overview preset, floorplan preset.
4. **Live demo** on GitHub Pages from the test harness with mock `hass` (the studio included).
5. **Repo cleanup:** move analysis and finished plan files (`ANALYSIS_*`, `BUG_UX_*`, `CODE_ANALYSIS_*`,
   `V5_PLAN`, `NAV_LIVE_FULL_PLAN`, `COCKPIT_PLAN`, `OVERVIEW_PLAN`, this plan when done) to
   `docs/archive/`; ROADMAP rewritten for post-v7.
6. **GitHub:** repo topics (`home-assistant`, `lovelace`, `custom-card`, `hacs`, `floorplan`,
   `roborock`), issue templates, release notes for 7.0.0 (English), screenshots refreshed.
7. **HACS default submission:** re-verify the `hacs/default` checklist, submit the PR.
8. Cross-links with AnyVac's README (both directions).

---

## 10. Tests

| Tier | Adds in v7 |
|---|---|
| smoke / render / lifecycle / design / overview (jsdom) | schema registry tests; floorplan geometry (projection, wall generation, opening subtraction, clean-up) as pure functions |
| e2e (Playwright, harness) | studio shell: open, select, drag, undo, save path (a); floorplan: top/iso frame times, room tap zoom, layers; **Lit-like `ha-card`** stays the default harness card |
| compat | +author's live config; studio round-trip (open → save without edits → deep-equal) for all reference configs |
| HA-in-the-loop (S4) | dashboard save path (b), editor-hosted path (a), non-admin read-only, sections view |
| real devices | checklist per release (§8) — wall tablet, phone app, desktop |

Rule carried over: a green jsdom suite is not proof for anything that touches HA's own DOM; every
such change is verified in the real browser before release.

---

## 11. Open questions

1. ~~S2 outcome~~ — resolved: two files (§13).
2. Floor textures: generated only, or allow user images per floor material?
3. Should the floorplan be offered as an alternative to the overview's room grid (a region option),
   or stay its own page only?
4. Multi-floor UI: one floorplan page per floor, or one page with a floor switcher?
5. How long to keep the "Classic editor" after 7.0.0 (proposed: one minor release).
6. Whether the studio should also manage `sections:` content collected from other cards
   (COCKPIT_PLAN) or only the card's own config.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| HA changes its dialog/top-layer or internal `lovelace/config` API | S1/S3 spikes; editor-hosted save path uses only the official `config-changed`; watch-list in ROADMAP already covers the WS API |
| Two editors in parallel for months | Phase 2 hosts the old forms instead of duplicating them; sections are replaced, never forked |
| Studio size slows wall tablets | D5 lazy loading; +5 % viewer budget (§2a.4) checked by `build --check` |
| Generated floorplan looks "technical" | G3 gate; photo background path (D11); textures and theme tokens tuned on the real tablet |
| AnyVac data quirks (A1) | Every AnyVac input has a fallback (§7); geometry is a snapshot the user can fix in the studio |
| Scope creep into a dashboard editor | Non-goal stated in §0; the studio edits this card only |
| jsdom-only confidence | HA-in-the-loop tier (S4) + real-device checklist |

---

## 13. Phase 0 results (2026-10-21)

All spikes run against **Home Assistant 2026.10.2** — the author's live instance (read-only, nothing
saved) and an identical version in Docker for anything that writes. Spike code:
[`prototypes/v7-spikes/`](prototypes/v7-spikes/).

| Spike | Result | Consequence for the plan |
|---|---|---|
| **S1** studio above HA's editor | HA's card editor is `hui-dialog-edit-card` → `ha-dialog` → `wa-dialog` → a **native modal `<dialog>` in the top layer**; everything else on the page is inert while it is open. A second `<dialog>` appended to **`document.body`** and opened with `showModal()` stacks above it, takes focus, receives input; HA's dialog stays open underneath. Inside it, today's `room-overlay-card-editor` and a live `room-overlay-card` both render and work (70 inputs, `config-changed` intercepted, round-trip deep-equal). **A dialog placed inside the editor's own DOM is destroyed by the editor's next re-render** — never host the studio there. Escape: preventing `cancel` is ignored without fresh user activation; a capture-phase `keydown` handler that prevents Escape is reliable. | D1/D2 confirmed. Studio = `<dialog>` on `document.body`, `showModal()`; Escape handled on `keydown` (unsaved-changes guard). Android companion app still to check by the author (G1). |
| **S2** second file through HACS | HACS source (`repositories/base.py`, `gather_files_to_download`): for a plugin installed from a release, **every release asset is downloaded**, not only `filename` (that is why `room-overlay-card.js.map` is installed today). The card is loaded as `<script type="module" src="/hacsfiles/Room-Card/room-overlay-card.js?hacstag=…">`, so it can find its own URL from that tag and `import()` a sibling. | D5 mechanism: **`room-overlay-card-studio.js` as a second release asset**, loaded with `import()` from the card's own URL + `?v=ROC_VERSION`. Manual installs must copy both files; if the import fails, the classic editor stays and the user gets a one-line hint. |
| **S3** save from the dashboard | `lovelace/config/save` works for masonry, sections and a card nested in a `vertical-stack`. **`card_id` is not unique in practice** — the author's own dashboard has `flat_main` twice (views `test` and `cockpit2`); the current test-mode Save refuses in that case. **Object identity solves it:** the card's parent `hui-card.config` is the very (frozen) object inside `lovelace.config`, so its exact path (`views/7/cards/0`) is found by reference. Conflict check = re-read, compare that path with what the studio opened, refuse on difference — verified with a simulated second tab. Non-admin: `lovelace/config` read OK, save → `unauthorized`. | D3 path (b) locates the card **by reference identity**, never by `card_id`; same fix applies to today's test-mode Save (candidate for a v6.3x patch). Non-admin → read-only studio + copy YAML. |
| **S4** HA in the loop | Real HA 2026.10.2 in Docker: scripted onboarding, dashboard + resource via WS, token injected into the frontend, Playwright drives the real editor dialog. 7 tests, ~17 s after the container is up. | Becomes the new test tier in Phase 1 (CI job with the HA image pinned to the version the author runs). |
| **S5** floorplan performance | Concept renderer (5 rooms, textures, glows, animated heating, robot), 4 s of state bursts (10/s) + two top↔iso transitions, headless Chromium: median **16.7 ms** at 1×, 4× and 6× CPU throttle; p95 16.8 / 33.3 / 33.3 ms; worst 50 / 66.7 / 49.9 ms. | Within budget on desktop-class CPU even throttled. Wall-tablet number pending: the concept artifact has a *Změřit výkon* button for that. |
| **S6** AnyVac contract | Written up in §7a. Live sensor confirmed `schema_version: 3`, frame 2828 × 1908 px at 12.5 mm/px, 5 rooms with outlines; Kitchen outline defect (A1) reported to AnyVac. | Nothing blocks Phase 5; A1 has a fallback. |

**G1 status:** S1 and S2 pass on desktop. Open before Phase 2 starts: the studio dialog in the Android
companion app (author), and the tablet run of the S5 probe.

---

## 14. Implementation notes

### Phase 1 — v6.40.0

- **§5.1 changed: ordered script parts, not ES modules (yet).** The card is one 10.7k-line
  classic script whose top-level helpers all share one scope. Converting it to ES modules means
  generating import/export lists for ~300 top-level names with circular references between them —
  a large, risky change with no user benefit at this point. Phase 1 instead splits the file into
  15 ordered parts under `src/` that `tools/assemble.js` concatenates back into
  `room-overlay-card.js`, identical JavaScript (compat harness: 0 differences). The two classes stay
  whole (`src/card/room-overlay-card.js` ~4.5k lines, `src/editor/room-overlay-card-editor.js`
  ~4.6k lines). New code (the studio, Phase 2) can be written as ES modules and bundled on its own;
  it reaches the card's internals through an explicit internal handle, not through shared scope.
- **The assembled root file stays committed** (manual installs, every test tier read it);
  `assemble --check` guards drift in `npm test`, `build` and `build:verify`.
- **Schema (§5.2) is a standalone file** (`src/schema/roc-schema.js`, listed as `standalone` in
  `src/manifest.json`), not part of what a dashboard loads. Unknown keys are warnings, not errors:
  the registry is new and a false "error" on a working dashboard would be worse than a gap. Its
  coverage is enforced from three sides by `tests/schema.test.js` (reference configs, documented
  examples, keys the code reads).
- **CI:** `.github/workflows/test.yml` needs two additions (the workflow folder is edited by the
  author): the schema test in the jsdom job and a new `ha` job running `npm run test:ha` (Docker is
  available on `ubuntu-latest`). Snippet in the v6.40.0 release conversation.

### Phase 2 — v6.41.0

- **Two bundles, still plain script.** `src/manifest.json` lists `bundles`: the card (16 parts,
  now including the loader `src/editor/90-studio-hook.js`) and the studio (`src/studio/*` plus
  the schema registry). The studio bundle is one closure, so nothing leaks to `window`. The schema
  is wrapped so that its UMD footer exports into the closure.
- **Handshake in both directions, never shared scope.**
  - The card publishes `RoomOverlayCard._rocInternals` (version, YAML, clone, migrate, profile,
    cfgKey, studio URL).
  - The studio registers `RoomOverlayCard._rocStudio`.
  - The loader finds the card's own `<script src>` (fallback: resource timing), swaps the file
    name, keeps the query (HACS' `?hacstag=`) and adds `?v=`.
  - `clone` is a wrapper because the native `structuredClone` throws "Illegal invocation" when
    called as a method. A real Chromium run caught this; jsdom has no `structuredClone`.
- **Card hooks** (compat: card DOM identical to v6.40.0, the editor differs only by the Studio
  button):
  - `_rocRaw`: the object HA handed in, used for identity lookup;
  - `_rocVp`: viewport override for the profile choice;
  - `_rocSink` / `_rocRoomSink`: drags and room switches go to the studio instead of window
    events;
  - `_roc_studio`: a render-only marker that hides Save / profile flip.
- **Editor hooks:**
  - `_rocHosted` / `_rocHost`: hide Studio/undo/redo and the editor's own preview; undo/redo are
    delegated to the studio; the URL hash is not written;
  - `_rocStudioLoad(cfg)`: a forced re-render (its `setConfig` skips renders when only values
    change);
  - editors outside the studio ignore `roc-pos-update` / `roc-room-switch` while
    `_rocStudioOpen` is set.
- **Canvas config = working config + render-only overrides** (`_roc_studio`, Edit mode in
  *Arrange*, no `url_sync`, `follow_mode: manual`, `layout.height` viewport/fill → container
  when the frame is landscape). `_restore` removes all of them before a canvas change becomes a
  commit.
  - *Global* editing strips the previewed room's own keys, like the editor's preview.
  - A v3 config is migrated once at open (in memory). Without that, every canvas push re-ran the
    migration and logged it.
- **Undo** is the studio's own snapshot stack, not the editor's. A typing burst (< 800 ms
  between commits from the editor) is one step. §5.4 said "command stack": snapshots are enough
  until canvas editing (Phase 3) needs finer granularity.
- **Dashboard save (D3 b)** follows the S3 recipe: identity path → re-read → compare → replace →
  `lovelace.saveConfig` (updates the open dashboard; WS save as the fallback). Read-only
  fallbacks: non-admin, YAML mode, generated (strategy) dashboard, card not found.
- **Default frame:** *Tablet* on a landscape screen, *Fit* on a portrait screen. With outline and
  inspector beside it, the canvas column of a laptop is squarish, and *Fit* would show a desktop
  layout as portrait.
- **HA tier:** HA's service worker reloads the page once it finishes installing in a fresh browser
  context (`controllerchange` → `location.reload()`, ~10 s in). Longer tests failed at random, so
  the tier runs with `serviceWorkers: 'block'`.
- **Not in Phase 2:** search (moves to Phase 3 with selection) and the Czech string table (before
  7.0.0, §5.8).
- **G2 gate** (author): the studio on the PC and the wall tablet. The companion-app check (S1)
  happens on this build.
- **Release workflow** (author-edited): it must upload `dist/room-overlay-card-studio.js` (+ map)
  and verify it like the card.

### Phase 3a — v6.42.0

- **Phase 3 is split** (2026-10-21; the author continued with 3b as v6.43.0): 3a = v6.42.0, 3b = v6.43.0 (multi-select,
  align/distribute, hide/lock per layer, duplicate/copy whole rooms). Phases 4–8 move one minor
  version later (table in §4).
- **One selection, three views.**
  - The card's existing Edit-mode selection reports through `_rocSelSink(type,id)`, and
    `_rocSelect(type,id)` selects without echoing back.
  - The studio maps the type to its config list and to the editor's item panel
    (`details[data-panel="<pre>-<index>"]`) through one table, `RS_TYPES` in
    `src/studio/35-elements.js`.
  - Inspector → canvas listens to *clicks on item headers*, not to `toggle`. Panels that re-open
    on an editor re-render fire `toggle` too and would move the selection.
- **Inherited lists.** An element a room inherits lives in the top-level list.
  - The card's `_roomArr` now edits it there. Before, it created an empty room list, which hid
    every shared element of that type after one drag: a latent Edit-mode bug, fixed.
  - New elements use copy-on-write (`_roomArrNew` in the card, `rsListForNew` in the studio): the
    room gets its own copy of the shared list first, so nothing on screen disappears.
  - Selecting an inherited element switches the studio to Global, where its panel is.
- **Snapping (E4)** measures what is on screen. Candidates are the DOM boxes of the other
  elements (edges and centres) plus the image's edges and centre. The dragged element contributes
  its own box offset, so anchoring per type (centred icons and glows, top-left zones) needs no
  special cases.
- **Add (E3)** places through a pointer layer over the stage, using pointer events, so touch works.
  Defaults are the editor's own "+ Add" values, copied in `RS_TYPES`. If the editor's defaults
  change, change both.
- **Edit mode retired as a setting.** HA sets `editMode` / `preview` on every card while a
  dashboard is in edit mode (probed on HA 2026.10.2: masonry, panel, sections). The card shows a
  Studio button from it, with these conditions:
  - only with a `lovelace` ancestor: HA's editor-dialog preview is in edit mode too;
  - not under `hui-card-edit-mode`: a sections view covers the card with HA's click-to-edit
    layer, so there the way in is the card editor;
  - for administrators only.

  `test_mode` keeps working (compatibility contract). The editor shows its toggle only while it is
  on.
- **Not done, on purpose:**
  - *Rotate*: the card has no rotation key for elements. The plan's "drag/resize/rotate" needs a
    config key first, which belongs to a later phase.
  - *Inline save errors (E6)*: covered by the studio for its own save paths (conflict and failure
    panels). The legacy test-mode Save keeps its overlay.

### Phase 3b — v6.43.0

- **Multi-selection** is studio state: `sel` is the primary element (handles, inspector) and
  `multi` holds the others.
  - The card reports Shift / Ctrl / ⌘ on a click through `_rocSelSink(type,id,{add})` and draws
    the others' outline with `_rocMark(list)`.
  - **Group move** needs no card support: after a canvas drag, `_movedItem` finds the single
    element whose `top`/`left` changed. If it is selected, the others get the same delta before
    the commit (one undo step). The others jump at the drop rather than following live — accepted
    for now.
- **Align / distribute** measure the DOM boxes (`_rocBox`, % of `.content`) like the snapping
  does, and shift `top` / `left` by the difference. Non-"%" positions are skipped and counted:
  the same "measure on screen, write config" rule as E4.
- **Layers** are a stylesheet inside the canvas card: `_rocExtraCss`, rendered as
  `<style class="roc-xcss">` and also patched in place. Hidden = `display:none`, locked =
  `pointer-events:none`, scoped to `.content`. Nothing goes into the config, so `_restore` needs
  no new rules.
- **Rooms:** duplicate / copy / paste / delete through `rsRoomCopy`: unique id, "(copy)" name,
  `area_match` dropped so presence keeps following the original. Paste needs a card that already
  has `rooms:`.
- **Room-switch fix** (author's report: the old room stuck ~1/3 s after a wheel switch, with a
  black strip). Reproduced with a deliberately slow embedded card (`tests/harness/switch-shell.html`).
  - `rocGhostClone` copies custom elements as plain boxes (a deep `cloneNode` constructed them
    all a second time).
  - Both layers get `will-change` during the slide.
  - The ghost is removed on its own `transitionend` (fallback timers count from the slide's
    start).
  - New embedded cards wait for the slide to start (`rocCardGate`, released one task after the
    rAF that starts the transition, 600 ms at most).
  - The regression test asserts one construction per switch and no cut slide; it fails on v6.42.0.
- **Gauges / blinds** have `pointer-events:none` outside Edit mode (they pass taps through to the
  image). Edit mode now switches them to `auto`, otherwise their v6.42.0 handles could not be
  grabbed.
- **Phase 3 closed.** Rotate stays open (no config key yet). Touch is covered by pointer events
  for placing and by the card's touch handlers for dragging; pinch-zoom of the canvas is not done.
