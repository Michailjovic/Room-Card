# Layout Engine Specification (v4.0.0)

Status: **IMPLEMENTED in v4.0.0 (2026-07-10)** — agreed 2026-07-09.

Implementation deviations from this spec:

- Strip `media:` on cards_above/below entries is kept (values `all | portrait |
  landscape`; legacy `mobile`/`desktop` map) — region placement can't hide
  *individual* cards of a strip per profile, `media` can.
- The test-mode FLIP button keeps its v3 meaning (day/night filter flip); the
  profile switch is a separate ⇅ button showing the active profile.
- `image_fit` is a top-level (per-profile capable) option, not a `place.image`
  property.
- Editor previews (`_roc_preview`) render at a fixed 420 px height.
- `nav.position` survives as *strip orientation only* (`left`/`right` = column
  list); its placement comes from the grid.

## Goal

Replace the four-tier responsive system (mobile / tablet / desktop / ultrawide,
width breakpoints, per-tier scalars, per-element responsive hacks) with **two
user-designed layout profiles** — `portrait` and `landscape` — where every
block of the card is placed on a percentage grid of the **currently available
viewport**. The user owns the layout; the card stops guessing.

## Terminology

- **Profile** — one of `portrait` / `landscape`. Selected by the aspect ratio
  of the available viewport, not by device type.
- **Region** — a named block of the card placed into the grid:
  `nav`, `cards_above`, `image`, `lights`, `cards_below`, `cover`.
- **Available viewport** — `100dvw` × (`100dvh` − HA header). Header height is
  read from the `--header-height` CSS variable (0 in kiosk mode); `dvh` is used
  so mobile browser chrome (URL bar) is accounted for, with `vh` fallback.

## Profile selection

```
ratio = viewportWidth / availableHeight
ratio < threshold  → portrait
ratio ≥ threshold  → landscape
```

- `threshold` configurable, default `1.0`.
- `orientation: auto | portrait | landscape` — force override.
- `orientation` also accepts a per-device map reusing the existing
  `room_entity.by_browser` pattern (browser_mod browser ID; the editor's
  "Map this device" flow can be reused). Unlisted devices use `default`:

  ```yaml
  orientation:
    by_browser:
      kitchen_tablet: landscape   # pinned even when rotated
    default: auto
  ```

- Test mode FLIP button switches profile (replaces the current tier flip).
- Re-evaluated on resize/orientationchange (debounced, reuse existing
  ResizeObserver plumbing).

## Height source

The card is a **view-filling room dashboard**. Root height:

```
height: calc(100dvh - var(--header-height, 56px))
```

Options under `layout:`:

- `height: viewport` (default) — formula above.
- `height: container` — fill the parent element (for embedding scenarios).
- `height: <css length>` — fixed (e.g. `800px`, `90vh`).
- `header_offset: auto | <px>` — default `auto` (`--header-height`).

## Config schema

```yaml
layout:
  height: viewport          # viewport | container | <css length>
  header_offset: auto       # auto | <px>
  orientation: auto         # auto | portrait | landscape
  threshold: 1.0            # w/h ratio; below => portrait
  gap: 0px                  # grid gap, optional

  landscape:
    columns: [88%, 12%]     # percentages of available width
    rows: [10%, 10%, 70%, 5%, 5%]   # percentages of available height
    place:
      nav:         {row: 1, col: 1}
      cards_above: {row: 2, col: 1}
      image:       {row: 3, col: 1}
      lights:      {row: 4, col: 1}
      cards_below: {row: 5, col: 1}
      cover:       {row: "1/6", col: 2}     # spans: "start/end" (CSS grid line syntax)

  portrait:
    columns: [100%]
    rows: [8%, 8%, 55%, 6%, 6%, 17%]
    place:
      nav:         {row: 1}
      cards_above: {row: 2}
      image:       {row: 3}
      lights:      {row: 4}
      cards_below: {row: 5}
      cover:       {row: 6}                 # controller moves to the bottom
```

Rules:

- Rendered as a CSS Grid (`grid-template-columns/rows` from the % lists,
  regions via `grid-row` / `grid-column`).
- **The user is responsible for percentages summing to ≤ 100 %.** The card
  does not normalize or clamp; test mode visualizes the result (see below).
- A region **not listed in `place`** of a profile is **hidden** in that
  profile.
- Per-region options: `overflow: hidden | auto` (default `hidden`),
  `align: start | center | end | stretch` (default `stretch`).
- `col` defaults to `1` when omitted.

## Image region

Inverts the current relationship (image no longer dictates card height):

- The grid gives the image region a fixed box.
- Inside it, the existing **lock_aspect cover-stage** machinery renders the
  image at its design aspect (`aspect_ratio` remains as *design aspect* only)
  with `fit: cover | contain` (default `cover`).
- Zones, icons, labels, badges, gauges keep their % positions **on the
  stage**, so all existing element configs remain valid unchanged.

## Cover region (blind control)

The v3.3.0 `control.placement: float | dock` model is lifted to a
**per-profile choice** (agreed 2026-07-09):

- `float` — tap-reveal overlay **inside the image region**, positioned next to
  the blind graphic (left/right + top/left offsets), exactly as in v3.3.0.
  Takes **no grid space**; the `cover` region must NOT be placed in that
  profile.
- `dock` — the controller is **permanently visible** as the `cover` grid
  region. Its side (top/right/bottom/left) follows where the region is placed
  in the profile's grid; its size is the % width/height of its column/row,
  like any other region. Replaces the v3.3.0 fixed ~52px rail; orientation
  (vertical rail vs horizontal bar) is derived from the region's own aspect.

Profiles choose independently — e.g. landscape: dock in a right column,
portrait: float tap-reveal (or dock in a bottom row). GUI: per-profile select
`off | float (tap-reveal) | dock`; when `dock`, placement/size are edited in
the Layout tab like any region.

## Per-profile scalars

`tVal` / `tApply` are rewritten from 4 tiers to 2 profiles:

```yaml
border_radius: {portrait: 8px, landscape: 12px}
```

Applies everywhere per-tier objects are accepted today (elements' per-tier
blocks, blinds/cover placement, light_controls sizing, …).

## Removed (v3 → v4)

| Removed                             | Replaced by                          |
|-------------------------------------|--------------------------------------|
| tiers `tablet`, `ultrawide`         | two profiles                         |
| `breakpoints`, `mobile_breakpoint`  | `layout.threshold` (aspect ratio)    |
| `nav.position: auto` + `auto_breakpoint` | explicit `place.nav` per profile |
| `max_height` (per-tier)             | image region % height                |
| `media: mobile|desktop|<tiers>` on cards_above/below | per-profile `place` |
| light_controls per-tier height      | lights region % height               |

## Migration (auto, on config load)

Configs without a `layout:` block are converted in memory and a console notice
is logged; the editor offers a one-click "Save migrated config".

- `mobile` tier values → `portrait`; `desktop` → `landscape`.
- `tablet` / `ultrawide` values → dropped with a console warning.
- `nav.position: top/bottom` → nav row placement; `left/right` → nav column.
- Default generated layout mirrors today's visual order:
  nav / cards_above / lights / image / cards_below stacked at 100 % width,
  image row sized from its aspect ratio at current width (best effort).
- No frozen legacy engine is kept — clean cut.

## GUI editor (Layout tab)

First version: **form + live preview** (no drag & drop).

- Profile switcher (Portrait / Landscape) at the top.
- Editable % lists for rows and columns (add/remove row/column).
- Per-region row/col/span selects + overflow/align.
- Live preview pane with region outlines and their % labels.
- Test mode on the card itself gains a **region overlay**: outlines + name +
  % of each region, plus the current profile and viewport ratio (extends the
  existing px/tier info box).

## Known risks & mitigations

1. **Embedded cards vs tight regions** — cards_above/below host arbitrary HA
   cards with intrinsic heights; a small % region may not fit them.
   Per-region `overflow: hidden | auto` (+ consider `fit: scale` — transform
   scale of the whole strip). The user owns sensible percentages.
2. **Real available height ≠ calc** — view padding / safe-area insets make
   `calc(100dvh - header)` overshoot by a few px → page scrollbar. Primary:
   measure the card's top offset (`innerHeight - rect.top`), calc as
   fallback. Use `svh` rather than `dvh` so mobile URL-bar show/hide doesn't
   make the layout jump.
3. **Editor previews** — a viewport-filling card inside the editor dialog is
   unusable. `_roc_preview` forces container/fixed height and gets a
   simulated-profile switcher.
4. **Swipe ghost** — `_renderNeighbourPreview` + per-room strip stripping
   broke three times before (3.0.5 / 3.2.3 / 3.3.0 pattern); mount points
   move into grid regions, so the ghost must be rebuilt with the engine and
   covered by jsdom tests first.
5. **lock_aspect stage listens to width only** — in the grid the image
   region's height changes independently; the stage needs its own
   ResizeObserver on the region.
6. **Migration leftovers** — per-element `tablet:`/`ultrawide:` blocks live
   in catch-all YAML textareas and would survive as dead keys; migration must
   actively strip them. Generated % rows approximate (not pixel-match) the
   old aspect-driven look.

## Implementation phases

1. **Spec** — this document. ✔
2. **Engine** — profile detection, grid renderer, mount existing blocks into
   regions (block internals unchanged, only wrappers/mount points move).
3. **Image region** — grid-driven box + cover-stage reuse, `fit` option.
4. **Scalars** — `tVal`/`tApply` 4 tiers → 2 profiles; blinds/cover placement
   per profile.
5. **GUI** — Layout tab + live preview + test-mode region overlay.
6. **Migration & release** — auto-migration, jsdom tests (profile selection,
   grid generation, migration mapping, hidden regions), README/CHANGELOG,
   English release notes, **v4.0.0**.
