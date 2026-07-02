# Code, GUI & UX analysis — v3.0.6

Full-source review of `room-overlay-card.js` (4,075 lines, runtime card + GUI editor).
Every finding below was verified against the actual code (line numbers refer to v3.0.6).

> **Status (v3.0.7, 2026-07-02):** implemented — A1, A2, A4–A11, both cheap B items
> (`location-changed`, Jinja YAML guard), C1–C2, D1–D6, E1 (focus part), E2.
> **Declined:** A3 (badge keyboard access — impractical in real use, per Michael).
> **Left as documented trade-offs:** `window.confirm` styling, editor length-only
> staleness check. **Still open ideas:** E3–E8, D7 full editor round-trip harness
> (basic tests for the new helpers were added).

**Summary:** 1 high, 4 medium, 6 low bugs · 2 dead-code items · 7 optimizations · 8 UX ideas.
Overall the codebase is in very good shape: teardown/cleanup is thorough (observers, timers,
template subscriptions, window listeners all cleaned in `disconnectedCallback` and on re-render),
change detection is smart (`_relevantEntities` + attr sources + rAF batching), and the editor's
non-destructive YAML handling (`_pYaml`) is a genuinely good pattern.

---

## A. Bugs

### A1 · HIGH — Per-room `base_camera` never refreshes
`_startCamera()` (line ~1356) reads `this._config.base_camera`, but `base_camera` /
`camera_refresh` are room-scoped keys (`ROOM_KEYS`). In a multi-room config where the camera
is defined inside `rooms[i]`, `this._config.base_camera` is `undefined` → the timer never starts
and the room shows no background at all (unless `base_image` is also set). Note the asymmetry:
`_update()` line ~1858 already uses the room-merged `c.base_camera` correctly.
**Fix:** use `this._roomCfg || this._config` inside `_startCamera` (both the guard and the tick).

### A2 · MEDIUM — Keyboard focus is invisible on zones
Zones get `tabindex="0" role="button"` (good) but the inline style hard-codes `outline:none`,
so keyboard users can't see which zone has focus. **Fix:** add
`.zone:focus-visible,.ico:focus-visible,.lbl:focus-visible,.gauge:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px;}`
to the shadow stylesheet (`:focus-visible` doesn't affect touch/mouse, so the current clean look stays).

### A3 · MEDIUM — Badges with `tap_action` aren't keyboard-accessible
Zones, icons, labels and gauges route through `_addZoneListeners` (keydown Enter/Space, hold ring,
a11y attributes). Badges instead attach raw `click` + `touchend` listeners (line ~782) — no
`tabindex`, no `role`, no keyboard path, no hold support. **Fix:** give badges the same
`_addZoneListeners` treatment (also unlocks `hold_action`/`double_tap_action` on badges for free).

### A4 · MEDIUM — Element IDs are injected unescaped into HTML and selectors
Inconsistent escaping: zones/icons escape ids with `escA`, but overlays (`data-ov="${ov.id}"`),
badges, labels and linear gauges interpolate raw. All the `querySelector('[data-…="'+id+'"]')`
lookups also break on ids containing `"` or `]` — elements silently stop updating. Same class of
issue: `base_image` URL goes into `url('…')` unescaped (a `'` in a filename breaks the style).
**Fix:** validate/normalize ids in `setConfig` (warn on `[^\w-]`), or escape consistently and use
`CSS.escape()` on the selector side; escape quotes in image URLs like `_startCamera` already does.

### A5 · MEDIUM — Resize handles are mouse-only
`_makeResizable` binds only `mousedown` — resizing in test mode is impossible on a tablet,
while dragging supports touch (`_makeDraggable` has a `touchstart` path). **Fix:** switch the
handles to Pointer Events (one listener set covers mouse + touch + pen).

### A6 · LOW — Embedded cards go stale while off-screen
In `set hass`, the `if(!this._visible)return;` gate sits *before* the loop that forwards `hass`
to embedded cards (`elements`, nav cards, strip cards). After scrolling back into view they show
stale state until the next state change arrives. **Fix:** forward hass to embedded cards before
the visibility check (they do their own dirty-checking, so it's cheap), or re-forward the last
hass in the IntersectionObserver callback.

### A7 · LOW — Numeric `aspect_ratio` silently ignored
`_pad()` and the `max_height` width-cap only parse `"W/H"` strings; `aspect_ratio: 1.78`
(a number, also possible per tier via `tVal`) falls back to 56.25% without warning.
**Fix:** accept numbers (`if(typeof r==='number'&&r>0)return(100/r).toFixed(4)+'%'`).

### A8 · LOW — Slider defaults are dangerous for `climate`
`_attachSlider` defaults `min:0, max:100` for every domain. On a climate entity a careless drag
can request 87 °C. **Fix:** domain-aware defaults — for climate read `min_temp`/`max_temp`
attributes (fall back to 7–35); consider the same for `number` (`min`/`max` attributes).

### A9 · LOW — Swallowed tap after `pointercancel` in room drag
`_attachRoomDrag`'s `moved` flag is only reset by the next click. If the drag ends via
`pointercancel` (notification shade, browser gesture), `moved` stays `true` and the next
legitimate tap on the card is swallowed once. **Fix:** reset `moved=false` in the
`pointercancel` handler.

### A10 · LOW — Swipe ghost is expensive on template-heavy rooms
`_renderNeighbourPreview` builds a full card instance on every swipe engage — and again on every
mid-drag direction flip. Each instance opens all `render_template` WS subscriptions and (per A1's
fix) camera timers, then lives < 400 ms. **Fix:** strip `visible_template`/`template`/`label_template`
keys and `camera_refresh` from the ghost config (visual fidelity for half a second doesn't need
live templates), and/or cache one ghost instance per direction during a single drag.

### A11 · LOW — Stale async card mounts after a fast re-render
`makeHACard` resolves async (card helpers promise). If `_render()` runs twice quickly
(tier change, room switch), callbacks from the first render push orphaned card elements into the
*new* `_cardEls`/`_navCardEls`/`_stripCardEls` arrays — not in the DOM, but still receiving hass
forever. **Fix:** a render-generation counter; callbacks compare their generation and bail.

---

## B. API / robustness notes (no action required, worth knowing)

- **`navigate` action** dispatches `PopStateEvent('popstate')`; HA's canonical event is
  `location-changed`. Works today — consider firing both for future-proofing.
- **`window.confirm`** blocks the JS thread and isn't themed. Fine functionally (companion app
  shows a native dialog); a HA-styled dialog would be nicer polish.
- **Editor staleness by design:** the editor's `setConfig` "same" check compares only array
  *lengths* — external YAML edits that change contents but not counts leave open GUI fields
  stale. Known trade-off for focus preservation; a "reload from config" button would close the gap.
- **Built-in YAML parser vs Jinja:** with no `window.YAML` present, an *unquoted* template like
  `visible_template: {{ states('x') }}` in a YAML textarea is parsed as an inline map and mangled —
  and because parsing "succeeds", the red-border warning never fires. Cheap guard: if a scalar
  starts with `{{`, treat it as a plain string.

---

## C. Dead code

| Item | Where | Note |
|---|---|---|
| `mApply()` | line ~86 | defined, never called (superseded by `tApply`) |
| `this._mobActive` | lines ~272/492 | assigned, never read |

---

## D. Optimizations

1. **Entity-scope of change detection** — `_extractEntities(this._config)` collects entities from
   *all* rooms, so any state change anywhere re-runs `_update()` for the active room. It's needed
   for nav thumbnail filters/chips, but splitting into "active room set" (full update) vs
   "other rooms set" (nav-thumbs-only update) would skip most no-op work on large multi-room configs.
2. **GPU layers** — every overlay carries permanent `will-change:opacity,transform` +
   `translateZ(0)`; each becomes a persistent compositor layer. With many large PNGs this costs
   real GPU memory on tablets. Promote only during transitions (add/remove `will-change` around
   opacity changes) or drop `translateZ`.
3. **Preload strategy** — `_preloadImages` fetches every image of every room at load. Smoother:
   active room + neighbours immediately, the rest via `requestIdleCallback`.
4. **Editor datalist** — the `#roc-entities` options string (every entity id) is rebuilt on every
   editor `_render()`; with thousands of entities that's ~100 KB of string work per re-render.
   Cache the built string and invalidate on `Object.keys(hass.states).length` change.
5. **`structuredClone`** — replace the many `JSON.parse(JSON.stringify(…))` clones; native, faster,
   and preserves more types.
6. **Config bloat on save** — `_collectConfig` always writes `filter_transition`, `test_mode:false`,
   gauge `min:0/max:100`, icon `size`, and materializes empty arrays (`overlays: []`, …) even when
   untouched. Prune values equal to defaults for cleaner saved YAML.
7. **Test coverage** — smoke tests cover pure helpers only. A VM-harness round-trip test
   (fixture config → editor `_render()` → `_collectConfig()` → deep-equal) would catch the whole
   config-bloat/`KEEP`-list class of regressions cheaply.

---

## E. GUI / UX ideas

1. **Focus-visible styling** (A2) plus documented keyboard behaviour; consider keyboard access to
   hold actions (e.g. long Enter press).
2. **Slider value bubble** — during drag show the numeric value ("72 %", "21.5 °C") near the
   pointer; the fill alone is hard to read precisely.
3. **Draw-to-create palette** — after rubber-banding a rectangle, offer a mini palette
   (zone / icon / label / gauge / element) instead of always creating a zone.
4. **Smarter snap candidates** — guides currently match other items' `top`/`left` only; adding
   right/bottom edges (top+height, left+width) and canvas centerlines would noticeably improve alignment.
5. **Editor list ergonomics** — sections with 15+ items would benefit from a filter box; panel
   summaries could show position (`kitchen_light · 22/54`) for faster scanning.
6. **Haptic on hold-registered** — the ring turns green; firing `haptic: medium` at that moment
   gives parity with tap feedback on mobile.
7. **`getCardSize()`** returns static 4 — deriving from aspect ratio + nav strip would improve
   masonry/section layout estimates. Low priority.
8. **Nav thumbnails** currently render base image + filter + 3 chips — superseded by the
   **live mini-room** roadmap item (see ROADMAP.md → v3.1 vision).

---

## Suggested fix order

| Batch | Items | Risk |
|---|---|---|
| 1 (quick wins) | A1, A2, A9, C1–C2 | trivial, isolated |
| 2 (input/a11y) | A3, A5, A7, A8, E1–E2 | small, testable in test mode |
| 3 (robustness) | A4, A6, A10, A11, B-notes | needs care around re-render paths |
| 4 (perf) | D1–D6 | measurable on large configs; do after batch 1–3 |
