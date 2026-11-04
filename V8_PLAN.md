# Room Card v8 — Furniture on the floor plan — Idea

Status: **idea, not decided (2026-11-04).** The author wants to think about it further. Nothing in
this file is a closed decision. No card code is written before Phase 0 (a visual prototype on the
author's own plan) says the idea is worth building. Not before 7.0.0 ships. Phase 0 prototype built
the same day (§2a); the decision is the author's.

Builds on the floor plan page of [`V7_PLAN.md`](docs/archive/V7_PLAN.md) / [`docs/FLOORPLAN.md`](docs/FLOORPLAN.md)
and changes nothing there.

---

## 0. Where this comes from

- The author would like furniture on the vector floor plan (2026-11-04). The plan today has floors,
  walls, doors and windows, light / heating / media glows, presence, the vacuum and `items`
  markers, but no furniture.
- **His requirement:** the things on the plan should be controllable, not decoration only.
- **His doubt:** it is not clear how good it will look or whether this is the direction the card
  should take. He has seen many "room builders" online and does not like most of them.

The doubt is the main risk, so it comes first (§1) and decides the first step (§2).

## 1. The risk: looking like a room builder

Why most room builders look wrong (analysis, not agreed):

- **Realism on a budget** — generic stock 3D models and plastic shading give a game-like,
  slightly uncanny look.
- **Everything equally loud** — furniture competes with the information the plan exists for.
- **Clutter** — every chair, plant and lamp is drawn because the catalogue has it.
- **A style of its own** — unrelated to the rest of the dashboard.

Proposed principles if this goes ahead (not agreed):

| # | Principle |
|---|---|
| P1 | **Furniture is the quiet backdrop, state is the hero.** Low contrast, theme-tinted, no textures. Lights, heating, presence and open windows stay the loudest things on the plan. |
| P2 | **Stylised, never realistic.** Architectural symbols top-down, simple blocks in projected views, each theme drawing them in its own language (blueprint lines, clay blocks, neon edges). No 3D models, no images. |
| P3 | **Few pieces.** Only what helps orientation or carries a device: bed, sofa, table, desk, wardrobe, kitchen counter, bath / shower, WC, TV. A full furniture catalogue is a non-goal. |
| P4 | **Control through the object, not on top of it.** Tapping the lamp toggles it, tapping the TV opens its controller — the same actions `items` markers have today. |
| P5 | **Off by default.** A plan without furniture renders exactly as today (`layers.furniture`). |

## 2. Phase 0 — visual prototype (decision gate)

A standalone page like `prototypes/floorplan-prototype.html`, no card changes:

- the author's real plan (`flat_main`, the AnyVac import), 6–8 hand-placed pieces;
- three themes (`night`, `clay`, `blueprint`), top-down and iso;
- one variant with controls on the objects (a lamp that toggles, a TV that opens a controller);
- judged on the wall tablet, next to the same plan without furniture.

It has to answer: does it help or clutter; which themes it suits (possibly not all); whether the
projected views work with the low cut-away walls (§3.3); whether control through objects is better
than today's markers. Outcome: **go / go with changes / drop.**

### 2a. Phase 0 results (2026-11-04) — decision still open

Prototype: `Claude outputs/v8-furniture-prototype/` (`proto.html` + the 7.0.0-beta.4 renderer with
`furn-lib.js` / `furn-methods.js` wired in). The author's real plan (`flat_main`), 25 pieces at
**guessed** positions, five themes, tablet landscape and phone; screenshots `nabytek-1..3-*.png`.
Pieces show state (a playing TV lights the floor in front of it, a running washer glows); they are
not tappable yet.

**Look (analysis, the author judges):** top-down themes (`blueprint`, `sketch`) read as an
architect's plan; `clay` / `neon` read as a dollhouse — closest to a room builder; `night` gets
dark blocks over the glowing heating loops, the heaviest change; on a phone the pieces become noise.

**Problems found and solved in the prototype:**

1. The cut-away has to cut furniture too: a piece at a cut-down front wall is cut to that wall's
   height, otherwise a tall piece (the projection screen, a TV) rebuilds the front wall.
2. Painter's order against the walls: centre depth is wrong next to side walls; a piece goes after
   the last wall it stands in front of (half-plane test) and overlaps on screen (`_furnMerge`).
3. Glows under the plan transform must blur in plan metres (0.12), not pixels — a px value there
   is a blur of several metres.

**Performance** (container Chromium, software rendering; ×4 = CPU throttled 4×, closer to a tablet):

| | without | with 25 pieces |
|---|---|---|
| SVG nodes (night / blueprint) | 287 / 191 | 628 / 334 |
| full redraw — opening the page, resize, theme (night, ×1 / ×4) | 5.1 / ~21–26 ms | 8.2 / 36 ms |
| one HA state update (night, ×1 / ×4) | 0.2 / 1.0–1.6 ms | 0.3 / 1.8 ms |
| frame time while the heating flows, `night` (p50, ×1 / ×4) | 16.7 / 16.6 ms | 16.7 / 16.7 ms |
| frame time while the heating flows, `clay` (p50, ×1 / ×4) | 18.5 / 21.3 ms | 22.6 / 29.2 ms (20.6 / 24.4 without the blurred glows) |
| floor plan file (lazy-loaded only), minified / gzip | 80.4 / 26.8 KB | +11.5 / +3.4 KB |

Conclusions: CPU and download are not the problem — the main card does not change, a state update
does not touch furniture. Two conditions if it goes ahead: glows without blur filters (gradients),
and furniture kept out of what the heating animation repaints (or animations paused under it).
`clay` is already under 60 fps here without furniture — re-measure both on the wall tablet. The
real cost is the matrix to design and maintain (types × themes × projections, studio tool, schema,
docs), not runtime.

## 3. Sketch, only if Phase 0 says go

### 3.1 Model

A per-room list in plan coordinates (metres, like the polygons):

```yaml
      rooms:
        - room: bedroom
          furniture:
            - {type: bed, at: [1.9, 1.3], size: [1.8, 2.0], rotate: 90}
            - {type: wardrobe, at: [3.6, 0.3], size: [2.4, 0.6]}
            - {type: tv, at: [2.0, 3.9], size: [1.4, 0.4], entity: media_player.bedroom_tv}
            - {type: box, at: [0.4, 3.6], size: [0.5, 0.5], name: Lamp, entity: light.floor_lamp}
```

`at` is the centre, `size` is width × depth, `rotate` in degrees. Optional: `height`, `name`,
`entity`, `tap_action`, `hold_action`.

### 3.2 Drawing

- **Top-down:** a parametric symbol per type — it is laid out for the given size, not stretched
  (a 140 and a 180 cm bed get the same pillows, spaced differently; a longer counter gets more
  doors). This is why vectors suit it better than images.
- **Oblique / iso:** the footprint extruded into one or two blocks (sofa = seat + backrest,
  bed = mattress + headboard), the symbol on the top face.
- **Theme:** supplies fill / stroke / glow only. One library serves every theme.
- **First library:** ~10 types + a generic `box` with a label for everything else.

### 3.3 Height in projected views

Walls are cut at `wall.height` (0.42 m by default) in the cut-away views. A 2 m wardrobe would
tower over them, so furniture has to be cut at the same plane (or use heights relative to the
wall), and it has to be depth-sorted together with the walls. The only non-trivial geometry here.

### 3.4 Control

A piece with an `entity` behaves like an `items` marker: lit while on / `active_state`; tap uses
the same safe defaults (toggle lights, switches, fans, window covers; more-info for everything
else, never toggle a lock, valve, siren, garage door or gate); hold opens more-info;
`tap_action` / `hold_action` override. Optional later: a lamp as a point light source (its glow
centred on the lamp instead of the room-wide glow).

### 3.5 Studio

A **Furniture** tool: palette, click to place, handles with dimensions in cm, rotation, snap to
the nearest wall. Same mechanics as the existing Marker and Window tools.

### 3.6 AnyVac hints (optional, last)

The import's clean-up (`rfpCleanOutline`, closing 0.8 m) removes the notches furniture bites into
the vacuum outline. Those notches are where something stands along a wall; the studio could offer
them as drafts ("something 2.1 × 0.6 m stands here — wardrobe? counter?"). Only floor-standing
pieces show up; the robot drives under tables, chairs and high beds.

## 4. Phasing (only after Phase 0)

| Phase | Content | Size |
|---|---|---|
| 1 | model, top-down symbols, ~10 types + `box`, studio tool, `layers.furniture` | M |
| 2 | projected views: blocks, cut height, depth sort; per-theme styles | M |
| 3 | entities and actions; lamp as a point light | S |
| 4 | AnyVac notch hints | S–M |

## 5. Open questions

1. Is this the direction at all? (Phase 0)
2. All 7 themes, or only some (`thermal` and `tiles` probably none)?
3. Furniture with an entity vs. `items` markers — keep both, or does a piece replace a marker?
4. A per-room list, or one plan-level list (pieces in a hall, or across a doorway)?
5. Projected views: real heights cut at the wall plane, or flat symbolic slabs?
6. Should overview tiles show furniture? (Probably not.)
7. Later relation to device packs (COCKPIT_PLAN D14): could an appliance piece share its drawing?

## 6. Non-goals

- Realistic 3D models, textures, photo furniture, generated images.
- An interior-design tool or a furniture catalogue (the room builders this is meant not to become).
- Any in-card AI (rejected by the author 2026-11-04).
