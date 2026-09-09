# Cockpit — Sections & Panels — Implementation Plan

Status: **agreed 2026-09-09**, not started. Target: v6.8.0 onwards, on top of v6.7.1.

This plan is written to be executed without the design conversation that produced it. Section 1
lists decisions that are **closed** — do not re-open them, and do not re-derive alternatives that
were already rejected there.

---

## 0. What this feature is (and is not)

The feature is **sections** and **panels**. A section is a user-defined bucket of things that do not
belong to a single room — appliances, cleaning, media, heating, covers, electricity, weather. A
panel is the surface a section renders into: a sheet that slides over the image, with a header and a
close button.

The **"cockpit"** — a whole-house view with a console of buttons that open those panels — is **not
code**. It is a configuration built from sections plus what the card already has (`base_image`,
`icons`, `zones`, `glows`, `labels`). It ships as a preset in `PRESETS.md`.

**Why this exists.** The card is excellent at one room, because a photo gives you spatial memory:
you tap the lamp, not a list item. But some things are not room-shaped — the washing machine cycle,
what is playing where, the electricity panel, a comparison of every room's temperature. Today those
live outside the card and you navigate away to reach them. Sections bring them in without breaking
the room model.

**Non-goals for this plan:** a floorplan renderer, per-room layout overrides, a live mini-room grid,
anything that reads data out of another card, and any change to how rooms work.

---

## 1. Closed decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Sections are user-defined buckets.** The card attaches no semantics to a section id. | The user has sections we would never guess (e.g. `outside` for weather). A fixed enum would be wrong for everyone but us. |
| D2 | **Section content is collected by tagging existing elements in rooms**, not defined a second time. | Single source of truth. Tag the washing machine once, in the room where it physically is; the panel updates itself when a room changes. |
| D3 | **Two tile schemes only: (a) animated icon + state, (b) user-supplied image + its own overlays/animation.** | (a) works with zero assets so the feature is usable on install; (b) is the wow. |
| D4 | **No cropping the tile image out of the room photo.** Rejected. | Click zones are deliberately oversized for touch, and real appliances are not axis-aligned in a photo taken at an angle — a rectangle never selects them cleanly. Deeper reason: the room photo is data about the *room*, not about the device. A rotatable crop tool was considered and dropped as a large editor tool serving a thin gap between (a) and (b). |
| D5 | **Two levels.** The panel is informational plus whatever we can read/control natively (target temperature, play/pause, vacuum start). The full controller is a **drill-through** — the user's existing subview, `universal-remote-card`, `anyvac`, `electricity-panel-card`. | Keeps the panel calm and avoids re-implementing controllers that already exist. |
| D6 | **Default panel placement is `sheet-right`.** `full` is the exception for dense content (the electricity panel). Placement is configurable per section. | On a wide screen a full-surface panel with light content hides the house and wastes half the area. A sheet keeps the house visible while you act. |
| D7 | **One panel open at a time. Closing the view closes the panel.** | It is a console, not windows. A panel is not state you return to. |
| D8 | **Mobile is not excluded.** On a narrow viewport the panel is a bottom sheet. | Verified in the mockup at 430 px: the house stays visible above and two-column tiles still fit. |
| D9 | **Vacuums get their own section**, not "appliances". | A vacuum is the only appliance that is spatial — it moves through the flat, and its position can later appear on the house image. |
| D10 | **No security/doors section for now.** | No use case for the author; add it when someone asks on GitHub. |
| D11 | **Everything is configurable from the GUI. No key is reachable only through YAML.** | This is the product thesis: people currently spend months hand-writing YAML and SVG to get these dashboards. The editor is the deliverable, not the renderer. |
| D12 | **Core features never render *through* a third-party card.** Sections may only *embed* one. | `light_controls` renders through `material-slider-card` and pushes CSS variables into it — if that card breaks, our feature breaks. Do not create a second such coupling. Embedding is a soft dependency: one panel breaks, the card does not. |
| D13 | **`groups` stays exactly as it is.** Sections are a new, separate concept. | `groups` are in-room popups with absolutely-positioned children; sections are house-level buckets with flow-laid-out collected tiles. Merging them risks existing configs for no gain. A later consolidation is possible but is not this plan. (This supersedes an earlier proposal to add a `panel:` block to `groups`.) |
| D14 | **Shareable device visuals ("device packs") are parked.** | Genuinely promising — one person draws a washing machine with a rotating drum, everyone reuses it and binds their own entity — but it needs a distribution mechanism and is its own project. |

---

## 2. Concepts

- **Section** — a named bucket. Has an id, title, icon, placement, and a content source.
- **Panel** — the UI surface a section renders into. Header (icon, title, subtitle, close), scrollable
  body, one of four placements.
- **Tile** — one item inside a panel. Either an icon tile (scheme a) or an image tile (scheme b).
- **Drill-through** — the full controller behind a tile, opened by tapping it. Either a `navigate`
  action to an existing view, or a second level rendered inside the panel with an embedded card.

Content reaches a panel from up to three sources, and a section may use more than one:

1. **Collected** — elements across all rooms tagged with `section: <id>`.
2. **Auto** — derived from `hass` by domain when nothing is tagged (`source: auto` + `domain:`).
3. **Card** — the section *is* one embedded HA card (`card:`).

---

## 3. Config schema

Every key below must have an editor control (D11). The YAML shown here is what the editor produces,
not what users are expected to type.

### 3.1 Top level: `sections`

```yaml
sections:
  - id: appliances                 # required, unique, [a-z0-9_-]
    title: Spotřebiče              # required, shown in the panel header
    icon: mdi:washing-machine      # required, shown on the console button
    placement: sheet-right         # sheet-right (default) | sheet-bottom | full | dialog
    size: 420px                    # sheet width / dialog max-width. default: 420px sheet, 620px dialog
    columns: 2                     # tile grid columns on a wide panel. default 2; 1 below 640px
    subtitle: stroje s cyklem      # optional, small text under the title
    badge: auto                    # auto (default) = count of tiles in an "attention" state | none
    backdrop: true                 # default true — tap outside closes
    visible_template: "{{ ... }}"  # optional, hide the whole section (e.g. heating in summer)

  - id: electricity
    title: Elektřina
    icon: mdi:flash
    placement: full
    card:                          # source 3 — the section IS this card
      type: custom:electricity-panel-card

  - id: heating
    title: Topení
    icon: mdi:radiator
    source: auto                   # source 2
    domain: climate                # climate | cover | media_player | vacuum | fan | light | switch
```

Resolution order when several sources are present: collected tiles first, then auto tiles for
entities not already collected, then the embedded card at the bottom.

### 3.2 Tagging an element into a section

Any `zone`, `icon`, `element` or `blind` in any room may carry:

```yaml
zones:
  - id: pracka
    top: 42%
    left: 18%
    width: 14%
    height: 26%
    section: appliances            # NEW — the entire collection mechanism
    tile:                          # NEW — how this thing looks in the panel
      name: Pračka                 # default: the element id
      entity: sensor.pracka_stav   # what the tile reads
      icon: mdi:washing-machine    # scheme (a)
      icon_animation: spin         # none (default) | spin | pulse | blink — while `active_state` holds
      image: /local/pracka.webp    # scheme (b) — presence of this switches the tile to image mode
      overlays:                    # scheme (b) — same renderer as room overlays, incl. transform:
        - id: buben
          image: /local/pracka_buben.png
          transform:
            entity: sensor.pracka_stav
            origin: 50% 58%
            spin: { min_duration: 1.2s, max_duration: 3s }
      state: "{{ ... }}"           # optional template for the state chip; default: the entity state
      state_class: auto            # auto | run | done | idle — colours the chip
      active_state: running        # which state counts as "active" for badges/animation
      value: "{{ ... }}"           # the large line, e.g. "38 min zbývá"
      progress: sensor.pracka_pct  # optional 0–100 for the bar
      quick:                       # native quick actions, stay inside the panel
        - { icon: mdi:pause, service: vacuum.pause, target: { entity_id: vacuum.a } }
      tap_action:                  # the drill-through (D5)
        action: navigate
        navigation_path: /dum/pracka
```

`tile:` is optional. Without it, the element is collected with sensible defaults derived from its
own `id`, `icon` and `entity`.

### 3.3 Where the console lives

Nothing new. The cockpit view is a room whose `base_image` is the house graphic, with `icons` whose
`tap_action` is a new action verb:

```yaml
tap_action: { action: open-section, section: appliances }
```

`open-section` also works from any room, so the same panel is reachable from the kitchen and from
the house view (this is the "logical groups usable in rooms too" requirement).

---

## 4. Rendering

Reuse, do not rebuild.

- **Panel chrome** — new. A single panel element per card instance, reused for whichever section is
  open (not one element per section). Header, body, backdrop, four placement styles, open/close
  transition, Escape and backdrop-click to close, focus moved into the panel on open and restored on
  close.
- **Collection** — on render, walk every room's `zones`/`icons`/`elements`/`blinds`, keep those with
  a matching `section`, preserve room order then element order. Cache per config; recompute only when
  the config changes, never per state tick.
- **Icon tiles** — plain DOM, no card instances. `icon_animation` maps to the existing
  `roc-pulse`/`roc-blink` keyframes and the `roc-tf-spin` keyframes added in v6.7.0.
- **Image tiles** — reuse the overlay + transform + glow renderers. The tile is a small stage: a
  `base_image` box with absolutely-positioned overlays inside it, exactly like a room, at tile size.
  Do **not** mount a nested `room-overlay-card` for a tile — the elements render directly.
- **Embedded cards** (`card:`, and drill-through level 2) — `window.loadCardHelpers()
  .createCardElement`, the same path `elements` already uses, with the existing direct-create
  fallback.
- **Auto tiles** — read `hass.states`, filter by domain, skip entities already collected, sort by
  friendly name.

Performance rules: no card instances for icon tiles; the panel body is built once per open, not per
state tick; state updates mutate existing tile nodes through `setSt`, following the pattern in
`_update()`.

---

## 5. Editor (the larger half of the work)

### 5.1 New "Sections" tab

Alongside Image / Elements / Layout / Rooms & menu. Contains the `sections` list with:

- add / remove / reorder / duplicate (reuse `_mvBtns` and the `_mvKinds` map)
- per section: id, title, icon (with live preview), placement select, size, columns, subtitle,
  badge, source select (collected / auto+domain / card), embedded card YAML for the `card:` source
- a live preview of the panel at its chosen placement
- a read-only list of what is currently collected into this section, with the room each item comes
  from — so the user can see the effect of tagging without leaving the tab

### 5.2 Per-element "Section" control

Every zone, icon, element and blind panel in the Elements tab gains one select: **Section — none /
…**. Choosing a section reveals the `tile:` sub-panel (name, entity, icon, animation, image, state,
value, progress, quick actions, drill-through action). The overlays inside a tile reuse the existing
overlay editor UI, scoped to the tile.

### 5.3 Onboarding automations

These exist so the user does not have to invent the configuration:

1. **Bootstrap rooms from HA areas.** On an empty config, offer *"I found N areas in Home Assistant
   — create a room for each?"* Creates rooms with names and pre-assigned entities; the user only adds
   photos. (`hass.areas` / the area registry via websocket.)
2. **Find untagged devices.** Scan `hass` for `vacuum.*`, `climate.*`, `cover.*`, `media_player.*`
   and appliance-like sensors that are not tagged into any section, and offer to add them.
3. **Recipes.** *Add section →* Appliances / Cleaning / Media / Heating / Covers / Electricity /
   Weather / Empty. A recipe pre-fills id, title, icon, placement and — where a known third-party
   card fits — an embedded card. Before embedding, check `customElements.get('<card>')`; if missing,
   the panel renders a legible notice with a link rather than an empty box (D12).

---

## 6. Degradation rules

- A tile whose entity is missing renders greyed with "unavailable", never blank.
- A section that collects nothing and has no auto source and no card renders an empty state
  explaining how to tag elements — it never renders an empty panel.
- An embedded card whose custom element is not registered renders the notice from 5.3.3.
- `visible_template` failures fall back to visible.

---

## 7. Tests

Follow the existing three tiers plus e2e. Note the two traps already documented in project memory:
`const` declarations are not reachable as globals in smoke's VM sandbox (only function
declarations), and `set hass` defers `_update` through the idle callback — await ~30 ms in jsdom
before asserting anything state-driven.

- **smoke** — section resolution (collect order, auto-source filtering, dedupe against collected,
  visible_template), tile defaults derivation, badge counting.
- **render (jsdom)** — panel opens/closes via `open-section`; one panel at a time; closes on room
  switch; placement classes; collected tiles appear in room-then-element order; icon vs image tile
  branch; drill-through fires; empty-state and missing-entity degradation; editor round-trip for
  `sections` and for the per-element `section`/`tile` fields, including add/remove/reorder.
- **e2e (Playwright, real Chromium)** — panel geometry at each placement at a wide and a narrow
  viewport; the panel does not overflow the card; the house remains visible behind `sheet-right`;
  Escape closes.

**Verify against the repository's own files.** Playwright browsers are absent on the author's
machine, so the suite runs in a cloud container — copy the files *from the repo* into the run
directory and check `md5sum` before declaring a run green. A green run of a file the repo does not
contain is worthless; this cost v6.7.1.

---

## 8. Phasing

| Version | Contents |
|---|---|
| **v6.8.0** | `sections` (collected + card sources), the panel with four placements, icon tiles, `open-section`, Sections tab, per-element Section select, degradation rules, full test coverage. Ships usable with zero images. |
| **v6.9.0** | Image tiles: `tile.image` + `tile.overlays` with the transform engine, tile overlay editor. This is where the wow arrives. |
| **v6.10.0** | Onboarding: areas bootstrap, untagged scan, recipes. `source: auto`. |
| — | Cockpit preset added to `PRESETS.md` once v6.9.0 is out, with a worked house-view config. |

Each version is independently shippable and independently useful.

---

## 9. Documentation, including for machines

A stated goal of this project is that **another AI can read the repository and tell a user how to
achieve what they want**, without the user learning YAML. That makes the schema documentation part
of the product, not an afterthought.

- `README.md` stays as it is: a human landing page, first thing seen on GitHub.
- `docs/CONFIGURATION.md` stays the human reference.
- **New: a machine-oriented specification** — every key with its type, default, allowed values and a
  minimal example, no prose that assumes context, no "see above". Proposed location: `docs/AI_SPEC.md`,
  with a short `llms.txt` at the repository root pointing to it (an emerging convention for
  LLM-readable project summaries).
- The README should say plainly that the project is documented this way and that users are
  encouraged to point an assistant at it.

Backfilling `AI_SPEC.md` for the existing configuration surface is a separate task, not a blocker
for v6.8.0. New keys from this plan go in from the start.

---

## 10. Open questions

1. Whether `groups` should eventually be expressed as sections (D13 keeps them separate for now).
2. Whether a tile should be able to show a live mini of the room it lives in, as an alternative to a
   device image — cheap, since the nav mini mount/scale mechanism exists, but it may read as noise at
   tile size. Not in scope; revisit after v6.9.0.
3. How the author's existing weather dashboard is adopted into an `outside` section — embed whole, or
   pull a few elements out. Decide when that section is actually built.
