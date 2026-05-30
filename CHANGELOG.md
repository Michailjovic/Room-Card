# Changelog

## [1.0.9] – 2026-05-29

### Fix: element `bottom` positioning works correctly through GUI editor

- **Fixed: `top` field in GUI editor was overwriting `bottom`** — when an element used
  `bottom` positioning, opening the GUI editor would save an empty `top` value, causing
  conflicts. Now `top` and `bottom` are mutually exclusive: setting one clears the other.
- **New: `Bottom` field in element GUI panel** — elements now have a dedicated
  "Bottom (alternative to Top)" input field. Fill in either `top` or `bottom`, leave
  the other empty.

## [1.0.8] – 2026-05-29

### New: `bottom` positioning for elements

- Elements now support `bottom` as an alternative to `top`. Use `bottom: 0%` to anchor
  an embedded card to the bottom edge of the room image — works correctly across all
  screen sizes regardless of card pixel height.

## [1.0.7] – 2026-05-29

### Fix: browser-mod popup no longer broadcasts to all devices

- `browser-mod-popup` action now automatically reads the current browser's ID from
  `window.browser_mod.browserID` and passes it as `browser_id` to the service call.
  The popup will only open on the device that triggered the action.
  No YAML changes required — existing configs benefit automatically.

## [1.0.6] – 2026-05-29

### New: icon background (circle style)

- **`background` field on icons** — optional CSS background string; when set, the icon
  is rendered inside a circle (`border-radius: 50%`, `padding: 7px`). Useful for making
  tappable icons visually distinct from the room image.
  Example: `background: rgba(0,0,0,0.55)`
- GUI editor updated with a "Background (circle, optional)" input field in the icon panel.

## [1.0.5] – 2026-05-29

### Refactoring — no functional changes

- **Removed dead code**: `_lblItem()`, `_gaugeItem()`, and `_blindItem()` existed as
  identical copies in both `RoomOverlayCard` and `RoomOverlayCardEditor`. The copies
  in `RoomOverlayCard` were never called (the main card builds all HTML inline in
  `_render()`). Removed 98 lines of unreachable code; only the editor copies remain.
- **Removed `orientation: left`**: was functionally identical to `orientation: horizontal`
  in both `_render()` and `_update()`. Removed from rendering logic entirely. No existing
  config used this value.

## [1.0.3.1] – 2026-05-29

### Hotfix

- **Fixed: day/night (zebra) blind invisible** — a typo introduced in v1.0.3 inserted the
  slat color into the transparent band of the `_gradDN` CSS gradient, producing invalid CSS
  and making all `blind_type: day_night` blinds disappear entirely. Rolled back to the
  correct gradient string.

## [1.0.3] – 2026-05-29

### Bug fixes and performance improvements

- **Fixed: `rgba()` colors treated as white** — `parseCssColor` and `_toHex` only matched
  `rgb(...)` syntax; any color specified as `rgba(...)` in `color_gradient`, `animation_color`,
  or similar fields fell back to `#ffffff`. Both functions now accept `rgba?` pattern.
- **Fixed: `alert_conditions` with `attribute` not triggering updates** — `_extractAttrSources`
  tracked the main gauge `attribute` but not `alert_conditions.attribute`; attribute-based
  alert conditions now register for change tracking properly.
- **Fixed: always-on gauge animation skipped when entity unavailable** — animation logic was
  placed after the `if(!ent) continue` guard, so a gauge with `animation: pulse` and no
  `alert_conditions` never animated if the entity had no state. Animation is now evaluated
  before the entity check.
- **Fixed: preloaded images immediately garbage-collected** — `_preloadImages` created
  `Image` objects that were never stored, so browsers GC'd them before caching. Images are
  now retained on the instance.
- **Perf: `.gfill` element cached at render time** — `_update()` no longer calls
  `el.querySelector('.gfill')` on every tick; fill elements are stored in `_gaugeFills`
  during `_render()`.
- **Perf: `color_gradient` stops sorted once at render time** — `lerpColorGradient` was
  calling `.slice().sort()` on every update cycle; sorted arrays are now cached in
  `_sortedGrads` during `_render()`.
- **Perf: `parseFilterStr` regex precompiled** — `FILTER_PROPS` regex patterns are now
  compiled once at startup instead of inside every `parseFilterStr` call.
- **Fixed: day/night blind gradient broken in initial v1.0.3 build** — a typo in the
  `_gradDN` CSS string inserted the slat color into the transparent band, producing invalid
  CSS and making zebra blinds invisible.

## [1.0.2] – 2026-05-28

### Gauge animation editor fixes

- **Fixed: alert condition fields unwritable in GUI** — `data-g-anim`, `data-g-alert-ent`,
  `data-g-alert-attr`, `data-g-alert-op`, `data-g-alert-val` were missing from the
  `_listen()` change-event registration; any re-render triggered by another gauge field
  (entity, min, max, …) would wipe the partially-filled condition row
- **Fixed: `alert_conditions` leaked into YAML textarea** — the field was not stripped
  from `cp` in `_gaugeItem()`, causing `Object.assign` from the YAML textarea to silently
  overwrite the dedicated condition fields on every save cycle
- **New: attribute support in alert condition** — added optional "Attribute" field to the
  GUI condition row (entity / attribute / operator / value); saves as `alert_conditions.attribute`
  and evaluated by the existing `evalCond` attribute path

## [1.0.1] – 2026-05-28

### Gauge border animations

- **Gauge alert animations**: gauge bars can now display a pulsing or blinking
  colored border when a condition is met (e.g. temperature above threshold).
- New CSS keyframes `roc-border-pulse` and `roc-border-blink` use an inset
  `box-shadow` so the effect renders correctly inside the clipped overlay container.
- New YAML fields on each gauge:
  - `animation`: `pulse` | `blink` — animation style (always-on if no condition set)
  - `animation_color`: CSS color string — border/glow color (default `#ff4444`)
  - `alert_conditions`: condition object `{entity, operator, value}` — when present,
    animation is shown only while the condition is true; removed as soon as it clears
- GUI editor updated in the gauge panel: animation dropdown, color picker, and a
  three-field condition row (entity / operator / value) — no YAML required
- The alert entity is tracked automatically by the existing `_extractEntities`
  recursive scanner, so state changes trigger a live update without re-render

## [1.0.0] – 2026-05-28

### Release milestone — first public version

This release marks the project as production-ready for HACS publication.
All core features are stable, the GUI editor is complete, and the codebase
has no known bugs.

#### Feature summary
- Base image with configurable aspect ratio and border-radius
- CSS filter engine with conditional states and smooth transitions
- Brightness model — multi-stop filter interpolation driven by sensor values
- Overlay layers — conditional opacity and state-driven image switching
- Gauges — animated progress bars, 6 fill directions, color gradients
- Blinds — roller, venetian slat, and day/night (zebra) blind animations
- Clickable zones — navigate, more-info, toggle, call-service, browser-mod
- Status badges — corner chips with conditional icon color and label
- Embedded HA cards at absolute coordinates
- Test mode for layout debugging
- Full GUI editor — no YAML required

#### Also in this release
- README rewritten with full documentation for all sections
- Screenshot paths changed to relative (branch-agnostic)
- `package.json` bumped to 1.0.0

## [0.7.15] – 2026-05-27

### Fixed
- **GUI editor – brightness model section collapses while typing entity name**

  Three cooperating bugs caused the section to disappear mid-edit:

  1. `_collectConfig` skipped any source row whose entity field was empty
     (`if(!el.value.trim())return`) — so a row being actively typed was treated
     as non-existent.
  2. `brightness_model` was deleted from the collected config whenever either
     `source` or `filter_gradient` was empty (`&&` condition). A freshly added
     source with no filter stops yet wiped the whole model.
  3. Entity inputs had `input` event listeners that fired `_fire()` on every
     keystroke, causing HA to call `setConfig()` again; the length mismatch
     triggered a full `_render()` that destroyed the in-progress input.

  Fixes: (1) source rows are preserved regardless of entity value, (2) `&&`
  changed to `||` — model is kept as long as any row exists, (3) `input`
  listeners removed from brightness model fields (values are committed on
  `change` / blur, consistent with all other text fields in the editor).

## [0.7.14] – 2026-05-27

### Fixed
- **GUI editor – `min`/`max` fields no longer overwrite zero values**

  `parseFloat("0") || 100` evaluates to `100` in JavaScript because `0` is falsy.
  Setting `max: 0` (inverted motor, e.g. 0 = closed) was silently reset to `100` on
  every editor save.  Fixed for both `blinds[]` and `gauges[]` min/max fields by
  using `isNaN()` guard instead of the `|| fallback` pattern.

## [0.7.13] – 2026-05-27

### Fixed
- **`blind_type: day_night` – fully closed at 100 %**

  For even `slat_count` (e.g. 8) the cycling formula `pct × N × period/2` ended at
  `N × period/2 ≡ 0 (mod period)` — the gradient wrapped back to its open phase.
  Fix: when `pct ≥ 1` the offset is clamped to `period/2` (fully closed) regardless
  of `slat_count` parity.  The CSS transition animates smoothly to this final position.

## [0.7.12] – 2026-05-27

### Changed
- **`blind_type: day_night` – phase shift cycles `slat_count` times across full travel**

  Previous formula `offset = pct × (period/2)` did one open→closed transition over
  0–100 % travel.  New formula:
  ```
  offset = pct × slat_count × (period/2)
  ```
  With `slat_count: 8` the phase completes 8 half-cycles as the blind deploys, matching
  the physical behaviour where each band pair individually cycles through its open/closed
  state.  The CSS `background-position-y` transition animates smoothly between positions.

- **GUI editor – `day_night` fields simplified to `slat_count` only**

  For `blind_type: day_night` the editor now shows a single *Slat count* field instead
  of the old Slat width / Slat gap / Slat pitch inputs.  `venetian` still shows Slat
  width, Slat gap and Gap color.  `slat_pitch` removed from editor entirely.

## [0.7.11] – 2026-05-27

### Changed
- **`blind_type: day_night` – simplified to single `slat_count` parameter**

  `slat_width`, `slat_gap`, `slat_pitch` are no longer used and can be removed from
  config.  All geometry is now derived from the container at render time:

  ```
  period    = containerHeight / slat_count   (px, dynamic)
  slat_width = period / 2                    (symmetric 50/50 opaque/transparent)
  offset     = pct × (period / 2)            (linear, 0 = open, 1 = closed)
  ```

  Minimal YAML:
  ```yaml
  blind_type: day_night
  slat_count: 8          # number of band pairs; default 6
  slat_color: rgba(0,0,0,0.9)   # optional
  ```

  The band pattern is always visible at every position between 0 % and 100 %
  (open = aligned gaps, closed = gaps fully covered).  The previous
  `Math.min` formula that caused the blind to look fully solid beyond the
  first slat has been removed.

## [0.7.10] – 2026-05-27

### Fixed
- **`blind_type: day_night` – phase shift rate corrected**

  Previous formula `offset = pct × (period/2)` spread the full half-period shift over
  the entire 0–100 % travel, so the bands moved imperceptibly slowly.

  New formula:
  ```
  offset = min(pct × containerHeight, period) / 2
  ```
  The full half-period shift now completes within the first single slat's height of
  travel (`pct = period / containerHeight = 1 / slat_count`); from that point onward
  the offset stays at `period/2` (fully closed) and only the covered height continues
  to grow.  The band motion is visible and fast, matching physical zebra-blind behaviour.

## [0.7.9] – 2026-05-27

### Changed
- **`blind_type: day_night` – rewritten as single-element two-CSS-layer model**

  Root cause of the missing motion effect: the previous two-gauge-div approach had the
  overlay gauge container with `background: rgba(0,0,0,0.5)`.  Through the transparent
  bands of the overlay fill, the browser rendered *the overlay's own background*, not the
  gauge behind it — so the base layer was effectively invisible, and the only visible
  change was the `height` growing.

  New model — one gauge div (`background: transparent`), one `.gfill` div with **two
  CSS gradient layers** on `background-image`:

  ```
  background-image: <gradient shifted by −offset>, <gradient at 0>;
  background-position-y: -offset px, 0px;
  ```

  where `offset = pct × (period / 2)`.

  | pct | offset | layer 1 opaque | layer 2 opaque | combined transparent |
  |---|---|---|---|---|
  | 0 | 0 | [0, sw) | [0, sw) | [sw, period) — max gap |
  | 0.5 | sw/2 | [0, sw/2) | [0, sw) | [sw, 3sw/2) — half gap |
  | 1.0 | sw | [sw, 2sw) | [0, sw) | ∅ — fully closed |

  Because the front gradient layer physically shifts, the opaque bands visibly scroll
  upward relative to the container as `pct` increases — the classic rolling zebra-blind
  motion.  Through the transparent window you see the room image behind (no background
  colour blocks it).

  Transition: `height` + `background-position-y` both animated.

- **`slat_pitch`, `_dnBase`, `_dnOverlay` removed** — internal props cleaned up; only
  `_dayNight` remains.  `slat_count` and `slat_width`/`slat_gap` still supported.

## [0.7.8] – 2026-05-27

### Changed
- **`blind_type: day_night` – front layer now carries the motion (visible band sliding)**

  Previous versions moved the *behind* layer (`_dnBase`, z-index 6) while the *front* layer
  (`_dnOverlay`, z-index 7) was fixed.  Because the dominant visible stripes always belong
  to the front layer, those appeared stationary — only the narrow transparent gaps of the
  front layer changed, which looked like the gap was just squeezing shut rather than bands
  physically moving.

  Fix — formulas swapped:

  | layer | role | `background-position-y` |
  |---|---|---|
  | `_dnBase` (z, behind) | static reference | `0` px (fixed) |
  | `_dnOverlay` (z+1, front) | moving fabric | `−(pct × period/2)` px (slides up) |

  The front layer's opaque bands now physically scroll upward as `pct` increases — the
  leading edge of each band exits above the container top while the next band's leading
  edge enters from below.  Through the front layer's transparent windows you see the
  fixed back layer for contrast.  The combined gap closes to zero at `pct = 1`.  The
  sliding is visible in the **static state** at every pct value, not just during animation.

- **New parameter `slat_count`** — number of slat pairs visible when the blind is fully
  extended.  The period is computed dynamically from `el.offsetHeight / slat_count` each
  render tick, so the gradient always scales to the actual container height:
  ```yaml
  blind_type: day_night
  slat_width: 10   # px — width of each opaque band
  slat_count: 8    # total opaque+transparent pairs in full height
  ```
  `slat_gap` is still accepted (overrides auto-derived gap).  If both `slat_count` and
  `slat_gap` are absent, `slat_gap` defaults to `slat_width` (symmetric bands).

- **`slat_pitch` removed** — parameter no longer has any effect and is silently ignored.
  Remove it from existing configs.

- **`slat_gap` default changed** from the old hardcoded `6` px to `slat_width` (symmetric
  bands by default: equal opaque and transparent stripe widths).

---

## [0.7.7] – 2026-05-27

### Fixed
- **`blind_type: day_night` – band sliding effect now visible in static state**

  v0.7.6 tied layer 1's `background-position-y` to `el.offsetHeight` (the container's
  rendered pixel height).  For any container whose height happens to be a multiple of the
  gradient period (e.g. a 180 px container with a 20 px period), the scroll offset at
  every integer-pct value was a multiple of the period → net phase = 0 → visually
  identical to the unshifted state.  The bands only appeared to move during the 0.5 s CSS
  transition after each entity update, not at rest.

  New formula — container-height-independent:

  | layer | `background-position-y` |
  |---|---|
  | layer 1 `_dnBase` | `pct × period/2` px |
  | layer 2 `_dnOverlay` | `0` px (fixed) |

  Layer 2 acts as a fixed grid/mask.  Layer 1 slides through it by exactly half a period
  (`slat_gap` pixels) as `pct` goes from 0 → 1.  At every intermediate `pct` value the
  opaque band of layer 1 is at a different position relative to layer 2's transparent
  window, so the sliding effect is **visible in the static (resting) state**, not just
  during animation.  Full closure at `pct = 1` is guaranteed: layer 1 phase = `period/2`,
  which means its opaque bands align exactly with layer 2's transparent windows → no gap.

---

## [0.7.6] – 2026-05-27

### Changed
- **`blind_type: day_night` – both fabric layers now scroll together (physical unroll effect)**

  Previously only layer 2 shifted its `background-position-y` while layer 1 stayed fixed
  at offset 0.  The result was a gap that simply squeezed shut — the bands themselves never
  appeared to move.

  New model — two independent but coordinated offsets:

  | layer | `background-position-y` |
  |---|---|
  | layer 1 (base, `_dnBase`) | `pct × container_height` px |
  | layer 2 (overlay, `_dnOverlay`) | `pct × container_height − pct × period/2` px |

  Both layers scroll downward at the same rate (by the full container height as the blind
  goes from 0 → 100 %).  Layer 2 carries the additional `−pct × period/2` tilt that
  progressively shifts the two layers out of phase, closing the gaps.  The result is:
  - The striped fabric **physically slides** as the blind extends — every visible band
    moves downward, like a striped carpet being pulled across the floor.
  - Simultaneously the bands tilt from fully open (phase 0) to fully closed (phase
    `period/2`) at 100 %, exactly as in v0.7.5.

  Implementation: layer 1 is now marked `_dnBase: true` so `_update()` handles it
  independently from the generic gauge path (which would reset `backgroundPositionY` via
  the `background` shorthand).  Both `_dnBase` and `_dnOverlay` share the same initial
  CSS in `_render()` (`transition: height Xs ease, background-position-y Xs ease`).

---

## [0.7.5] – 2026-05-27

### Fixed
- **`blind_type: day_night` – CSS transition for `background-position-y` was broken** –
  the transition string was built as `transition: height Xs ease, background-position-y
  height Xs ease` (the property name `height` leaked into the timing definition for the
  second property).  Browsers silently discarded the invalid `background-position-y`
  transition, so the slat phase jumped instantly on every hass update while only `height`
  animated smoothly.  Fixed by stripping the property-name prefix from `_dtr` before
  appending it to the `background-position-y` entry, e.g.:
  ```
  height 0.5s ease  →  background-position-y 0.5s ease   ✓
  ```

### Changed
- **`blind_type: day_night` – single-pass linear band tilt model** – replaced both the
  oscillating formula (v0.7.4) and the two-phase "lower then tilt" model (v0.7.5 initial)
  with a simple single-pass progressive shift:

  ```
  background-position-y (layer 2) = −(pct × period / 2)  px
  ```

  At `pct = 0`: both layers are in phase → transparent gaps visible (day / open bands).
  At `pct = 1`: layer 2 is offset by exactly `period/2` → opaque bands cover every gap
  of layer 1 → fully solid (night / closed bands). ✓

  The tilt is distributed **across the entire blind travel** — as the blind extends, the
  bands visibly rotate throughout (like pulling striped fabric across a surface), rather
  than staying static during the lowering phase and only moving in the final segment.
  No oscillations, no two-phase split. Guaranteed closure at exactly 100 %.

- **`slat_pitch` default changed from `2` to `30`** – the parameter is kept in the config
  schema but is not used in the current tilt formula; it may serve future extensions.
  Default updated to `30` as a more descriptive placeholder value.

---

## [0.7.4] – 2026-05-27

### Changed
- **`blind_type: day_night` – physical two-layer CSS model** – replaced the opacity-toggle
  approach with a correct simulation of the actual day/night blind mechanism:

  A day/night blind has two identical striped fabric layers.  As the blind extends, the
  front layer shifts relative to the back layer, cyclically aligning and misaligning the
  transparent gaps:

  | relative offset | visual result |
  |---|---|
  | 0 (aligned) | transparent — gaps of both layers line up |
  | ½ period | solid — slats of layer 2 cover gaps of layer 1 |
  | 1 period | transparent again |

  **Implementation**: both layers carry the same `repeating-linear-gradient`.  Layer 1
  has `background-position-y: 0` (fixed).  Layer 2's position is updated every hass tick:
  ```
  backgroundPositionY = -(pct × 100 × (slat_width + slat_gap) / slat_pitch) px
  ```
  Both `height` and `background-position-y` are included in the CSS transition
  (`height Xs ease, background-position-y Xs ease`), so both animate smoothly and in sync.
  No opacity switches, no background re-paints, no binary jumps — pure CSS geometry.

  The formula includes a fixed `−period/2` offset so that `pct = 0` starts at phase 0.5
  (SOLID, but invisible because height is 0) and every whole-cycle boundary (`pct = n ×
  slat_pitch / 100`) also lands on SOLID.  With `slat_pitch: 4` and range 0–100 the
  sequence is: 0 % → invisible · 4 % → SOLID · 8 % → transparent · … · 100 % → SOLID ✓

---

## [0.7.3] – 2026-05-27

### Fixed
- **`blind_type: day_night` – correct cyclic solid/stripe model** – the v0.7.2 solid
  overlay used `min = midpoint` which produced "solid on top, stripes on bottom" and did
  not use `slat_pitch` at all.  Replaced with:
  - Both layers always have **identical height** (= current position %)
  - The solid overlay's **opacity** cycles between `0` and `1` based on `slat_pitch`:
    ```
    cycle_pos = (pct × 100 % slat_pitch) / slat_pitch   // 0→1 per cycle
    opacity   = cycle_pos ≥ 0.5 ? 1 : 0
    ```
  - With `slat_pitch: 2` this produces one full stripes↔solid cycle every 2 % of travel,
    so at e.g. 25 % closed the entire covered area is solid, at 26 % it shows stripes again.
  - The solid layer config is marked with `_dnOverlay: true` and carries `_sp` (slat_pitch);
    the `_update()` loop detects this and applies opacity instead of the standard height
    formula.

---

## [0.7.2] – 2026-05-27

### Changed
- **`blind_type: day_night` now renders as two stacked gauge layers** – this correctly
  models the physical mechanism of a day/night blind, which has two fabric layers (striped +
  solid) that shift relative to each other as the blind closes:

  | position | stripe layer | solid overlay | visual result |
  |---|---|---|---|
  | 0 % (open) | 0 % height | 0 % height | fully transparent |
  | 50 % | 50 % stripes | 0 % solid | half-height stripes visible |
  | 75 % | 75 % stripes | 50 % solid on top | solid upper half + stripes lower quarter |
  | 100 % (closed) | 100 % | 100 % | fully opaque |

  The solid overlay layer uses `z_index + 1` and `min = midpoint` of the configured
  min/max range so it only starts filling from the halfway point.  Both layers are
  generated automatically from a single `blinds[]` config entry — no duplicate YAML needed.

- `blindToGaugeConfig()` now returns an **array** of gauge configs (`flatMap` used at all
  call sites).  `_blindGaugeCfgs` cache is flat and covers all generated layers.

---

## [0.7.1] – 2026-05-27

### Fixed
- **Choppy / unnatural blind animation** – four root causes identified and resolved:
  1. **`background` CSS transition removed from default** – the browser cannot interpolate
     between `repeating-linear-gradient()` values, so `background 1s ease` produced
     jarring flashes on every update. Default transition is now `height 0.5s ease` /
     `width 0.5s ease` (position-only). Background changes are now instant, which is
     correct: only the fill size should animate.
  2. **Sub-percent height precision** – `Math.round(pct*100)` truncated to whole integer
     percentages, causing visible 1 % step-jumps in the fill height. Now uses
     `Math.round(pct*1000)/10` (one decimal place, 0.1 % resolution).
  3. **`slat_pitch` cyclic background switch removed** – the binary solid↔gradient
     alternation every 1 % created a strobe effect when combined with the CSS transition.
     Removed from the update loop; the `repeating-linear-gradient` itself already renders
     the slat pattern correctly as the height grows.
  4. **`blindToGaugeConfig` now cached** – result stored as `this._blindGaugeCfgs` in
     `_render()` and reused in `_update()` instead of rebuilding gradient strings on every
     hass state update.

---

## [0.7.0] – 2026-05-27

### Added
- **`blinds[]` section** – dedicated first-class config section for window blinds / roller
  shades, rendered internally through the existing gauge pipeline via a new module-level
  `blindToGaugeConfig(b)` helper.  All blind elements use `orientation: top` (fills
  top → bottom) automatically.

  Three blind types selectable via `blind_type`:

  | `blind_type` | description | extra properties |
  |---|---|---|
  | `roller` | solid fill, single colour | — |
  | `day_night` | repeating stripe (slat + transparent gap) with cyclic solid overlay | `slat_width`, `slat_gap`, `slat_pitch` |
  | `venetian` | repeating stripe (slat + coloured gap) with optional cyclic overlay | `slat_width`, `slat_gap`, `gap_color`, `slat_pitch` |

  Example – day/night blind over a bedroom window:
  ```yaml
  blinds:
    - id: blind_bedroom
      entity: cover.roller_motor_bedroom_curtain
      attribute: current_position
      min: 0
      max: 100
      top: "13%"
      left: "38%"
      width: "24%"
      height: "45%"
      z_index: 5
      blind_type: day_night
      slat_color: "rgba(10,10,10,0.9)"
      slat_width: 7
      slat_gap: 6
      slat_pitch: 2
  ```

- **GUI editor for `blinds[]`** – new *Window blinds* collapsible section with:
  - Position / size fields (top, left, width, height, z-index)
  - Entity, attribute, min, max
  - **Blind type** dropdown (`roller` / `day/night` / `venetian`)
  - **Slat / roller color** text field (accepts any CSS color, including `rgba(…)`)
  - **Slat width**, **Slat gap**, **Slat pitch** fields (visible for `day_night` and
    `venetian` only)
  - **Gap color** field (visible for `venetian` only)
  - YAML textarea for `background`, `border_radius`, `transition`,
    `visible`, `visible_conditions`
  - Add / Remove blind buttons

### Changed
- `_gaugeEls` cache, `_update()` loop, `_extractAttrSources()` and the `setConfig`
  same-check all extended to cover `blinds[]` entries transparently.

---

## [0.6.0] – 2026-05-26

### Added
- **Four fill directions for `gauges[]`** – the `orientation` property now supports all four
  cardinal directions in addition to the original two:

  | value | fill direction | typical use |
  |---|---|---|
  | `vertical` | bottom → top (default) | level / progress |
  | `top` | top → bottom | roller blind / shade |
  | `horizontal` | left → right | existing alias |
  | `right` | right → left | mirrored bar |

  `bottom` and `left` are accepted as aliases for `vertical` and `horizontal`.

- **CSS gradient support in `color`** – any valid CSS `background` value is accepted,
  including `repeating-linear-gradient(...)`. Combined with `orientation: top` this enables a
  convincing day/night roller blind simulation directly over a window area:
  ```yaml
  gauges:
    - id: blind_bedroom
      entity: cover.roller_motor_bedroom_curtain
      attribute: current_position
      min: 0
      max: 100
      orientation: top          # fills top → bottom like a real shade
      top: "13%"
      left: "38%"
      width: "24%"
      height: "45%"
      z_index: 5
      background: "transparent"
      color: >
        repeating-linear-gradient(
          to bottom,
          rgba(10,10,10,0.90) 0px,
          rgba(10,10,10,0.90) 7px,
          rgba(200,200,200,0.12) 7px,
          rgba(200,200,200,0.12) 13px
        )
  ```
  The transparent background lets the room photo show through the open portion; the gradient
  fills downward as the blind closes, mimicking actual slats.

- **GUI dropdown updated** with all four orientation options and descriptive labels.

---

## [0.5.0.1] – 2026-05-26

### Fixed
- **Attribute-based `brightness_model` sources not reacting to changes** – `_prevStates` only
  tracked entity `.state` strings, so a source like `light.living_room` with
  `attribute: brightness` would only trigger a filter update when the light was turned on/off,
  not when its brightness level changed. Added `_extractAttrSources()` which builds a list of
  all `{entity, attribute}` pairs used across `brightness_model.source`, `gauges[]`,
  `labels[]`, and `icons[]`. The change-detection guard in `set hass` and the end-of-update
  snapshot in `_update()` now track these attribute values in addition to entity states.
- **GUI editor not re-rendering when only `brightness_model` was added/modified** – the
  `setConfig` optimisation that skips re-rendering when array lengths are unchanged did not
  account for `brightness_model`. Adding or removing sources or filter-gradient stops on an
  existing card would leave the editor showing stale content. The `same` check now also
  compares `brightness_model.source.length` and `brightness_model.filter_gradient.length`.

---

## [0.5.0] – 2026-05-26

### Added
- **Redesigned `brightness_model`** – replaced the v0.4.3 additive brightness approach with a
  full **filter gradient interpolator** that blends between any number of named CSS filter stops
  (brightness, contrast, saturate, sepia, hue-rotate, blur, opacity, grayscale, invert) based
  on a normalised 0–100 % sensor value.  
  When `brightness_model` is active it **replaces** `filter_conditions` entirely — no stacking,
  no multiplicative conflicts.
  ```yaml
  brightness_model:
    source:
      - condition:                          # optional — use this source only when…
          entity: light.living_room
          operator: "="
          value: "on"
        entity: light.living_room
        attribute: brightness               # 0–255
        min_input: 0
        max_input: 255
      - entity: sensor.living_room_lux      # fallback (no condition = always matches)
        min_input: 0
        max_input: 800
    filter_gradient:
      - value: 0                            # 0 % → very dark / blue-ish
        filter: "brightness(0.25) sepia(0.3) hue-rotate(200deg)"
      - value: 50                           # 50 % → natural daylight
        filter: "brightness(1.0)"
      - value: 100                          # 100 % → overexposed / warm
        filter: "brightness(1.15) saturate(1.2)"
  ```
- **`source[]` array with per-entry conditions** – define multiple sensor/attribute sources;
  the first source whose `condition` evaluates to `true` (or whose condition is omitted) is
  used to derive the percentage.  Supports both light entity brightness attributes and
  arbitrary numeric sensors (lux, CO₂, temperature, …).
- **`lerpFilterGradient(stops, pct)`** – new module-level helper that parses each filter stop
  with the existing `parseFilterStr` / `buildFilterStr` / `FILTER_PROPS` infrastructure and
  linearly interpolates every CSS filter component between the two surrounding stops.
- **GUI editor for the redesigned `brightness_model`** – two collapsible sub-sections:
  - *Value sources* – entity, optional attribute, min/max input range, optional condition YAML
    (add/remove rows dynamically).
  - *Filter gradient stops* – value (0–100 %), filter string, add/remove rows.

### Changed
- `brightness_model` no longer adds a `brightness()` filter on top of `filter_conditions`.
  It now **replaces** `filter_conditions` when at least one source entity and one gradient
  stop are configured.  Leaving `brightness_model` empty (or unconfigured) falls back to the
  normal `filter_conditions` behaviour.

### Removed
- The v0.4.3 `brightness_model` fields (`entity`, `attribute`, `min_input`, `max_input`,
  `min_brightness`, `max_brightness`) are superseded by the new `source[]` /
  `filter_gradient[]` structure. Old configs using those fields will silently fall back to
  `filter_conditions` (the new code checks for `source` and `filter_gradient`).

---

## [0.4.3] – 2026-05-26

### Added
- **`brightness_model`** – maps a sensor value (lux, light brightness, etc.) to a CSS
  `filter: brightness()` applied on top of the base image in real time, making the room
  photo automatically darken at night and brighten during the day.
  Uses linear interpolation identical to `color_gradient`.
  Composes with `filter_conditions` — both run independently and their brightness factors
  stack in the CSS filter chain. Disabled automatically in FLIP test mode.
  ```yaml
  brightness_model:
    entity: sensor.living_room_lux
    min_input: 0          # lux → darkest
    max_input: 800        # lux → brightest
    min_brightness: 0.3   # CSS brightness() at min_input
    max_brightness: 1.1   # CSS brightness() at max_input
  ```
  Or using a light entity's brightness attribute (0–255):
  ```yaml
  brightness_model:
    entity: light.living_room
    attribute: brightness
    min_input: 0
    max_input: 255
    min_brightness: 0.25
    max_brightness: 1.0
  ```
- **GUI editor for `brightness_model`** – dedicated *Brightness model* section with fields
  for entity, attribute, min/max input range, and min/max brightness. Leave entity empty
  to disable.

---

## [0.4.2] – 2026-05-26

### Added
- **`orientation: horizontal` for `gauges[]`** – horizontal bar that fills left-to-right
  instead of the default bottom-to-top vertical bar. The `transition` default adjusts
  automatically (`width` instead of `height`).
  ```yaml
  gauges:
    - id: brightness_bar
      entity: light.living_room
      attribute: brightness
      min: 0
      max: 255
      orientation: horizontal
      width: "40%"
      height: "6px"
      top: "85%"
      left: "5%"
  ```
- Orientation dropdown added to the gauge GUI editor (`vertical` / `horizontal`).

---

## [0.4.1] – 2026-05-26

### Added
- **`visible_conditions` for `labels[]` and `gauges[]`** – show/hide an element based on
  entity state using the standard condition array syntax (first match wins).
  Falls back to the existing `visible` property if `visible_conditions` is not set.
  Gauges previously had no visibility control at all; both `visible` and `visible_conditions`
  are now supported for them.
  ```yaml
  labels:
    - id: frost_warning
      entity: sensor.outdoor_temp
      visible_conditions:
        - entity: sensor.outdoor_temp
          operator: "<"
          value: 2
          result: true
        - result: false

  gauges:
    - id: co2_bar
      visible_conditions:
        - entity: sensor.co2
          operator: ">"
          value: 800
          result: true
        - result: false
  ```
  Configured via the YAML textarea in the GUI editor (field label updated to include
  `visible` / `visible_conditions`).

---

## [0.4.0] – 2026-05-26

### Added
- **`animation` for `overlays[]`, `badges[]`, `labels[]`** – two CSS animation modes:
  - `pulse` – smooth opacity fade (1 → 0.25 → 1, 2 s, ease-in-out)
  - `blink` – hard on/off (1 s, step-end)
- **`animation_color`** – for `badges[]` and `labels[]`, adds a colored glow
  (`filter: drop-shadow`) when `pulse` is active; creates a "glowing badge/label" effect.
  ```yaml
  overlays:
    - id: alarm_overlay
      color: "rgba(255,0,0,0.35)"
      animation: pulse          # fades when overlay is visible

  badges:
    - id: alarm_badge
      icon: mdi:alarm-light
      animation: pulse
      animation_color: "#ff2222"   # red glow

  labels:
    - id: temp_label
      animation: blink             # hard blink (use sparingly)
  ```
- **GUI editor for animations** – dropdown `none / pulse / blink` on `overlays[]`,
  `badges[]` and `labels[]`; color picker for glow color on `badges[]` and `labels[]`.

---

## [0.4.x] – planned

- **`visible_conditions`** for `labels[]` and `gauges[]` – show/hide based on entity state
- **`orientation: horizontal`** for `gauges[]` – horizontal bar variant
- **`brightness_model`** – lux sensor or light entity brightness attribute →
  CSS `filter: brightness()` with linear interpolation (similar to `color_gradient`)

---

## [0.3.19] – 2026-05-25

### Added
- **`background`, `padding`, `border_radius`, `text_shadow` for `labels[]`** – labels can now
  be styled as a dark badge/chip overlay without needing external card types.

---

## [0.3.18] – 2026-05-25

### Fixed
- The `color_gradient` GUI editor for gauges was accidentally applied only to the dead copy of
  `_gaugeItem` on `RoomOverlayCard`, not to the actual editor class `RoomOverlayCardEditor`.
  The *Color Gradient Stops* section was therefore invisible in the GUI. Fixed — both copies of
  `_gaugeItem` and `_lblItem` are now identical and contain the correct gradient editor.

---

## [0.3.17] – 2026-05-25

### Added
- **`color_gradient` for `gauges[]` and `labels[]`** – smooth color interpolation based on
  entity value. Instead of discrete conditions, define a linear gradient between any number
  of color stops:
  ```yaml
  gauges:
    - id: temp_gauge
      entity: water_heater.boiler
      attribute: current_temperature
      min: 30
      max: 80
      color_gradient:
        - value: 30
          color: "#2196f3"   # blue (cold)
        - value: 55
          color: "#4caf50"   # green (optimal)
        - value: 70
          color: "#ff9800"   # orange (warm)
        - value: 80
          color: "#f44336"   # red (hot)
  ```
- **GUI editor for `color_gradient`** – both `gauges[]` and `labels[]` have a
  *Color Gradient Stops* section with rows (value + `<input type="color">` + remove button)
  and a **+ Stop** button to add new stops.

### Changed
- Internal helper functions `parseCssColor()` and `lerpColorGradient()` moved to module scope
  (shared between gauges and labels).

### Fixed
- Removed duplicate `const self` declaration inside `_collectConfig()` that caused a
  `SyntaxError` on card load.

---

## [0.3.16] – 2026-05-24

### Added
- **`attribute` support in `evalCond`** – conditions in `filter_conditions`, `overlays`,
  `zones`, `badges`, `labels` and `gauges` can now compare entity attributes instead of state:
  ```yaml
  conditions:
    - entity: water_heater.boiler
      attribute: current_temperature
      operator: ">"
      value: 60
      result: "orange"
  ```
- **Native `labels[]`** – text overlays positioned over the image; supports `entity`,
  `attribute`, `template`, `prefix`, `suffix`, `color`, `color_gradient`, `font_size`,
  `font_weight`, `position` (top/left as percentages).
- **Native `gauges[]`** – vertical value bars without dependency on `custom:button-card`
  (fixes broken height inheritance through shadow DOM); supports `entity`, `attribute`,
  `min`, `max`, `width`, `height`, `position`, `color`, `color_gradient`, `background`.

---

## [0.3.15] – 2026-05-23

### Added
- Initial `labels[]` and `gauges[]` sections (basic implementation without `color_gradient`).

### Fixed
- Embedded `custom:button-card` inside `elements[]` did not work as a gauge due to broken
  CSS height chain through the shadow DOM. Native `gauges[]` bypasses this issue.

---

## [0.3.14] – 2026-05-22

### Added
- **FLIP button in test mode** – toggles all overlays to their opposite state and applies
  the alternative base image filter; state persists across GUI editor changes.

### Fixed
- FLIP state was not reset on config edits (intentional — see 0.3.13 fix).

---

## [0.3.13] – 2026-05-22

### Fixed
- Syntax error (stray `i` character at end of file) causing
  *"Custom element doesn't exist: room-overlay-card"* after HACS installation.

---

## [0.3.12] – 2026-05-21

### Added
- Extended test mode with **⇄ FLIP** button – shows all overlays and the base image filter
  in the opposite state for quick visual testing without changing entity states.
