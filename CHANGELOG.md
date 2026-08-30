# Changelog

## [6.4.0] - 2026-08-30

### `vacuum_widgets` GUI editor panel + drag-to-position

`vacuum_widgets` gets a proper editor panel, closing the last gap between it and the other visual
primitives (`icons`/`badges`/`gauges`/`labels`):

- New "Vacuum status widgets" section in the editor's Elements tab, with fields for id, icon
  (with live preview), size, z-index, top/left, and group.
- With the editor's Interactive preview (`test_mode`) on, the widget can be dragged directly on the
  room image to place it anywhere — including any corner — the same way icons/labels/zones already
  work; the panel's Top/Left fields update to match.
- Add / duplicate / remove / reorder (▲▼) buttons, matching every other element list.
- `vacuums`, `tap_action`, `hold_action`, `double_tap_action`, `visible`, `fade`/`slide` and the
  per-profile `portrait:`/`landscape:` overrides (added in 6.3.0) are edited as one YAML block
  inside the panel — that combination doesn't reduce to a clean form the way a handful of scalar
  fields does, and the project's HA-power-user audience is already comfortable with the YAML side.
- Fixed a latent bug found while wiring this up: the editor's `setConfig()` fast-path (which skips
  a full re-render when nothing "elementful" changed) never counted `vacuum_widgets` — an external
  YAML edit that only added/removed a vacuum widget could leave the open panel showing a stale
  count/list until some other array also changed size.

No behaviour change for existing YAML-only configs — this is purely an additive editor surface.

## [6.3.0] - 2026-08-30

### Redesigned `vacuum_widgets` look, and per-profile sizing

The widget was a flat filled circle, sized with a single fixed pixel value — too small on phones,
and visually flat next to the room photo. Two changes:

- **Per-profile overrides.** `vacuum_widgets` entries now go through the same `tApply()` mechanism
  as `icons`/`labels`/`zones`, so `top`/`left`/`size` (or any other field) can be overridden per
  layout profile (`portrait`/`landscape`, legacy `mobile`/`desktop`). This is the direct fix for the
  widget reading too small on a phone: give it a bigger `size` (and adjusted position) under a
  `portrait:` block without needing a second widget or a global size bump that then oversizes it on
  desktop.
- **New visual treatment.** The widget is now a frosted-glass disc — blurred glass centre, a thin
  coloured accent ring for the active state (instead of a full solid fill), a drop shadow for depth
  against the room photo, and a `:active` press-scale for tap feedback — matching the frosted-glass
  chip look and hold-indicator depth-shadow already used elsewhere in this card (`badges`,
  `roc-hold`). The "both" (simultaneous dry+wet) state is now a split amber/blue ring rather than a
  split-fill background. Default `size` is bumped from `32px` to `44px`.
- `size` now also accepts a `%` value (resolved against card width), same as `icons`/`labels`, and
  responds live to card width changes without a full re-render.

No config keys were renamed or removed — existing `vacuum_widgets` entries keep working unchanged
and simply render with the new look at the new default size.

## [6.2.1] - 2026-08-30

### Fix: `vacuum_widgets` rest state was nearly invisible over a photo

The at-rest look ("nobody's cleaning") only dimmed the icon itself
(`opacity:.6`) and never gave the widget its own background — it fell
through to the shared `.vw-bg` base rule, a barely-there
`rgba(255,255,255,0.14)` tint. A white icon at reduced opacity on a
near-transparent white circle, sitting over an arbitrary room photo,
reads as a faint ghost rather than a dimmed vacuum icon — confirmed live
against a real room background.

Rest now gets its own dark chip (`rgba(0,0,0,0.5)`), matching the
`.badge{background:rgba(0,0,0,0.6)}` convention already used elsewhere in
the card for exactly this reason (legible over any photo), with the icon
backed off to `.75` opacity instead of `.6` so the glyph stays
recognisable while still reading as calmer than an active state.

## [6.2.0] - 2026-08-30

### New `vacuum_widgets` — a compact, cross-room vacuum status badge (informational only, not a controller)

Requested use case: a single glance-level indicator for a multi-vacuum home, reusable across every
room via `ROOM_KEYS`'s existing global-default/per-room-override merge (top-level `vacuum_widgets`
applies to all rooms; a room's own `vacuum_widgets` key replaces it just for that room — same
mechanism `badges`/`icons`/`gauges` already use, nothing new to learn). It deliberately does **not**
control anything — tap only fires a normal `tap_action` (typically `navigate` to wherever the
user's real vacuum dashboard lives); start/stop/dock actions are out of scope on purpose.

**Config:**

```yaml
vacuum_widgets:
  - id: vac_status
    top: '90%'
    left: '4%'
    size: 32px                     # optional, default 32px
    icon: mdi:robot-vacuum          # optional, default mdi:robot-vacuum
    tap_action:
      action: navigate
      navigation_path: /dashboard-various/vacuum
    vacuums:
      - entity: sensor.s6_kitchen_status
      - entity: sensor.s7_maxv_status
      - entity: sensor.s8_maxv_ultra_status
```

Each item under `vacuums` needs a status **sensor** entity (`device_class: enum`, the
`sensor.*_status` kind some Roborock/Xiaomi integrations expose) — not the `vacuum.*` domain entity
and not a `select.*_cleaning_mode` helper. The `select` was tried first and rejected: it reflects a
*configured* mode, not what's happening right now, and its `custom`/`smart_mode` values are
meaningless without knowing the user's own routine. The status sensor's real-time enum is both
simpler (one entity per robot, no per-robot special-casing) and actually correct.

**States.** Each configured vacuum's status string is classified into one of six categories, then
combined across every vacuum in the list into a single result for the icon:

- **rest** — `idle`, `charging`, `charging_complete`, `charger_disconnected`, `device_offline`,
  `locked`, `shutting_down`, `unavailable`, `unknown`. Dim icon, no animation, no count badge.
- **error** — `error`, `charging_problem`. Overrides every other state (red, blinking) — this is the
  one thing worth interrupting the glance for.
- **dry** — actively vacuuming the floor right now (`cleaning`, `segment_cleaning`,
  `zoned_cleaning`, `spot_cleaning`). Amber background, spinning icon.
- **wet** — actively mopping the floor right now (`segment_mopping`, `zoned_mopping`,
  `robot_status_mopping`). Blue background, expanding ripple ring.
- **both** — a combined vacuum+mop job. Covers two situations the same way: one robot running
  `clean_mop_cleaning`/`clean_mop_mopping`/`segment_clean_mop_*`/`zoned_clean_mop_*` (the sub-state
  just says which phase it's in *right now* — the job as a whole does both), or two different
  robots doing dry and wet at the same moment. Both read as "dry and wet cleaning is happening in my
  home right now", which is the useful fact — the icon shows a split amber/blue background rather
  than trying to enumerate which robot is doing what.
- **active** — something's happening with no confident dry/wet claim: starting, returning to dock,
  manual/remote-control driving, paused, mapping, patrolling, and — deliberately — the mop's own
  dock-side maintenance (`washing_the_mop`, `attaching_the_mop`, `air_drying_stopping`,
  `back_to_dock_washing_duster`, …). A robot laundering its own mop pad at the dock is not mopping
  the user's floor, so it does *not* light up as "wet" — that would misreport "still cleaning" well
  after cleaning actually finished.

An unrecognised future status string falls through to **active**, not **rest** — a false "something's
happening" is a far safer failure mode than silently hiding real activity behind "all clear".

When 2 or more configured vacuums are active at once (any category except rest), a small numeral
badge appears in the icon's corner — deliberately just a count, not one icon per robot, to keep the
whole thing compact.

**Excluded from nav thumbnails.** Unlike every other visual primitive (`badges`, `icons`, `gauges`,
…), `vacuum_widgets` never renders inside a `nav.live: full`/`custom` mini thumbnail instance, with
no opt-in to turn it back on. Reasoning: it aggregates *multiple* vacuums into one glance-level icon
by design — that doesn't reduce sensibly to thumbnail scale the way a single-entity badge does, and
duplicating a whole-home indicator into every room's mini-preview would just be noise.

**Not yet in the GUI editor** — this ships as a YAML-only option for now (same posture that other
now-editor-backed features, like `blinds[].control`, originally shipped with). `roomMerge`/the
single-room→multi-room migration already treat it as a normal `ROOM_KEYS` entry, and the editor's
`config-changed` save round-trips the whole config object, so a `vacuum_widgets` block written by
hand survives opening and saving the visual editor untouched — it just has no dedicated panel to
edit it with yet.

## [6.1.0] - 2026-08-19

### `day_night` blind — the striped pattern's phase is now calibratable, and the reserve no longer shifts it

Reported live: with a real zebra blind (17 band pairs) that keeps an un-retracted reserve at its
motor's fully-open limit, the striped overlay had "a shift overall" and could not be synced at any
`top_offset` value.

**Root cause.** The phase of the scrolling gradient layer was computed from `pct` *after*
`rocApplyTopOffset` had floored it, so the reserve slid the entire phase curve sideways. With 17
pairs and `top_offset: 7.6` the fully-open residual already sat at **0.646 of a period — 71 %
overlap — instead of 0 %**, and every position downstream inherited that offset. The reserve
changes how much of the window is *covered*; it says nothing about where the fabric's own printed
pattern sits, so it never belonged in the phase term. On top of that the sweep rate was hard-coded
to `slat_count/2`, a number with no physical meaning: how many times a real zebra sweeps
see-through → blackout → see-through across its travel depends on tube diameter, fabric thickness
and band pitch, not on how many bands happen to be visible when closed.

**Fix.** New pure helper `rocDayNightShift(raw, start, turns, snap)` returns the front layer's
offset in pattern periods, driven by `raw` — the min/max-normalized position *before* `top_offset`.
Three new optional per-blind keys expose it:

- **`shift_turns`** — how many times the overlap sweeps see-through → blackout → see-through across
  the full travel. Defaults to `slat_count/2`, i.e. the pre-6.1.0 rate, so nothing changes for
  blinds that never set `top_offset`.
- **`shift_start`** — phase in periods (0–1) at fully open, for lining the leftover reserve up with
  what the real blind shows at 0 %.
- **`shift_snap`** (default `true`) — nudges `shift_turns` so fully closed lands exactly on
  anti-phase. This replaces the old `pct>=1` special case, which forced the same blackout but as a
  visible jump inside the last percent; the curve is now continuous all the way to closed.

**`shift_legacy: true`** restores the pre-6.1.0 formula bit-for-bit (phase from the corrected `pct`,
including the `pct>=1` snap) for anyone who had tuned around the old behaviour.

All four keys are in the GUI editor's blind panel behind `blind_type: day_night`, so the two
measurements can be dialled in against the live Edit-mode preview instead of by YAML round-trips.
Defaults stay out of the saved config.

**Verification.** 19 new smoke tests for `rocDayNightShift` (endpoints, linearity, clamping, the
snap's blackout guarantee and its composition with a non-zero `shift_start`) plus
`blindToGaugeConfig` passthrough. 14 new render tests, including the editor round-trip and two that
pin the `shift_legacy` numbers to the exact pre-6.1.0 values. Because jsdom has no layout engine,
those render tests mock `offsetHeight` on the gauge element and compare `background-position-y`
numerically. Additionally live-verified in real Chromium against a mounted card: at fully open the
new path reads offset `0.00` / overlap `0.000` where the legacy path reads `12.81px` / `0.708`, and
both reach a full blackout when closed.

This unparks the narrow phase question from `ROADMAP.md` — the broader "does the two-layer look
match real zebra optics" question stays parked.

## [6.0.0] - 2026-08-08

### Documentation overhaul + editor UX rebuild milestone

**README split into a landing page + two focused docs.** The README had grown to ~860 lines,
most of it the configuration reference and the editor walkthrough — useful, but it buried the
pitch, install steps and quick start under a wall of YAML examples. It's now a short landing page
(pitch, feature table, screenshots, install, quick start, links out) plus:

- **[`docs/CONFIGURATION.md`](docs/CONFIGURATION.md)** — the full YAML reference: every top-level
  key, the layout engine, conditions, filters, overlays, gauges, blinds & cover control, zones,
  badges, icons/labels, embedded cards, companion cards, light controls, camera/weather, template
  visibility, groups, multi-room, and the complete example. Moved verbatim from the README, not
  rewritten — no behaviour or documented-key changes.
- **[`docs/EDITOR.md`](docs/EDITOR.md)** — the GUI editor tab by tab (Image / Elements / Layout /
  Rooms & menu), Edit mode in full, and a new summary section rolling up what the editor UX
  rebuild (below) actually changed and why.

`LAYOUT.md` and `PRESETS.md` are unchanged and now cross-linked from both new docs.

**Live screenshots, captured against this release.** The old `editor.png` showed a `v1.15.2`
editor with a "Responsive" tab and mobile/tablet/desktop breakpoint fields — none of which exist
any more (superseded by the v4.0.0 layout engine and the v5.9.x editor rebuild). Seven new
screenshots were captured directly against a live `v6.0.0` install: the Image tab (replaces
`editor.png` in the README), the Elements tab overview, the Layout tab and its live region
preview, the Rooms & menu "Live thumbnails" (`nav.live`) setting, and the Cover control and Light
controls panels — the latter two now sit next to their matching YAML in
`docs/CONFIGURATION.md` instead of only existing as abstract examples.

**Marks the editor GUI/UX revalidation as done.** v5.9.0–v5.10.1 shipped four changes from the
`EDITOR_UX_REVALIDATION.md` review, discussed and decided incrementally rather than implemented
wholesale: the header's *Test mode* + *Drag-edit preview* merged into one **Edit mode** toggle
(v5.9.0); the **Layout tab** gained Portrait/Landscape sub-tabs with a live mini grid preview,
plus a real fix so Layout edits reach the mounted Edit-mode preview card (v5.9.11); the **Rooms &
menu tab** split into four accordions matching the Elements tab's pattern (v5.9.13); and the dead
`dock_side` blind-editor control, found by the code audit, was removed (v5.10.1). Two proposals
from the same review were explicitly rejected after discussion — reordering Elements sections by
intent (alphabetical-with-icons stays) and a per-section text filter (low value at typical room
sizes). Full history in `ROADMAP.md` and `EDITOR_UX_REVALIDATION.md`.

### Roadmap re-scope

`ROADMAP.md` had reserved v6.0.0 for the HACS default-repository submission milestone (decided
2026-08-05), with the version bump meant to land only after a `hacs/default` PR is accepted. That
plan changed today: v6.0.0 now marks this documentation overhaul instead, and the HACS submission
becomes its own later milestone with a version number chosen at that time — so v6.0.0 isn't
reserved-then-reused, it just means something different than originally planned. `ROADMAP.md`
updated to reflect this and to correct its stale "current release" line (it still said v5.4.0).

### Not done

No code, config keys, or behaviour changed in this release — documentation and versioning only.
`ROC_VERSION` and `package.json` bumped to match.

## [5.10.1] - 2026-08-08

### Editor honesty & repo tidy-up (closes the code audit)

**The "Dock side" select did nothing — removed.** The blind editor offered a left/right dropdown that wrote `control.dock_side`; `coverControlNorm()` turned it into a `side` field that **nothing ever read**. It could not have worked: a docked cover control is `flex:1 1 0` and therefore *fills* its `cover` grid region, so there is no free space to align it within — the side comes entirely from where the `cover` region sits in the Layout tab, per profile. (The README already said exactly that, one bullet below the line documenting `dock_side`.) Removed rather than reimplemented: a knob that cannot affect anything is worse than no knob, because it sends you hunting for a layout bug that isn't there. **No visual impact** — it never had an effect. An existing `dock_side:` key is ignored exactly as before and is dropped the next time the blind is saved from the editor. README corrected; historical CHANGELOG entries left as-is.

**Editor escaping unified with the card's.** The editor carried its own escaping helper that differed from `escA()` in two ways, both bugs: it did not escape `'` (harmless today — all 136 call sites were checked and every one lands in a double-quoted attribute or a text node — but a trap for the next single-quoted attribute anyone adds), and it used `String(s)` rather than `String(s ?? '')`, so an unset field rendered the literal text `undefined` (or `null`) into its input box. `_e()` now delegates to `escA()`; verified beforehand that the editor uses no inline `on*` handlers, so escaping apostrophes can't break anything.

**Housekeeping.** 54 `RELEASE_NOTES_v*.md` files moved from the repo root to `docs/releases/` — they were crowding out the documents people actually open (README, LAYOUT, PRESETS, ROADMAP). Moved with `git mv`, so `git log --follow` still works on each; `CHANGELOG.md` stays the canonical history. Stale `test-results/` artifacts deleted — they recorded six "failures" that were only ever a missing Chromium install in a sandbox, and made the suite look broken at a glance.

### Testing

8 new assertions in `tests/lifecycle.test.js` (43 total). Four of them fail against v5.10.0 — they reproduce the bugs rather than just describing the fixes; the other four are regression nets around nullish rendering. Also covered: a legacy `dock_side:` key in an existing config still loads and saves without error. Full suite green against both the source and the minified bundle.

### Not done: the structural refactor

Step 4 of `CODE_ANALYSIS_v5.9.13.md` (splitting the file into `src/`) is **dropped**, and the report's recommendation there was wrong on two counts. It claimed the split would make the pure helpers unit-testable — they already are, via `smoke.test.js` loading the file with `vm.runInContext` and exercising them off the sandbox global (100+ assertions). And `src/` already existed once as TypeScript + rollup, drifted out of sync with the shipped JS, and was deliberately removed in v1.3.0 with the note that `room-overlay-card.js` is now the single source of truth; re-splitting would recreate precisely that failure mode. The editor's real problem — 101 fields described three times across `_render`/`_collectConfig`/`_listen`, 1633 lines — is genuine but currently *correct*: an audit of all 101 ids found no dead or drifted controls. Future maintenance risk, not a present defect; better as a deliberate incremental project than on refactor momentum.

## [5.10.0] - 2026-08-08

### Minified release build (step 3 of the code audit)

The release asset is now minified: **413.8 → 284.8 KB raw, 110.1 → 69.8 KB gzipped (−36.5 %)**, on a file every dashboard load pulls. The repo keeps the readable source — only the published artifact is compressed, so manual installs from the repo and HACS installs from the release differ in size but not behaviour.

`build.js` runs terser with **property mangling explicitly off**, which is the one setting that must never change: mangling properties would rename `setConfig`, `hass`, `getCardSize` and break every HA integration point at once. Class and function names are manglable — custom elements register by string and nothing reads `constructor.name`. `--check` fails the build if the output is truncated, not smaller than the source, or missing the version string / element registrations.

`npm run build:verify` runs all three test tiers **against the minified bundle**. The tiers already accepted a path argument, so this cost nothing to add — and it's the check that matters, since the bundle is what users install. Source and bundle produce byte-for-byte identical pass/fail output across all 213 assertions. Two tests had to change: the version checks in `smoke.test.js` and `render.test.js` matched `const ROC_VERSION='…'` in the source text, which doesn't survive minification; both now read the version at runtime from the `customCards` registration.

The release workflow builds before uploading and then **downloads the asset back and byte-compares it** against the freshly built file, instead of only checking that an asset with the right name exists. v4.6.2 shipped an asset-less release after a transient GitHub 503 and failed in HACS with "unknown error" — an asset with wrong or truncated contents would fail just as opaquely, and name-only verification wouldn't catch it. The sourcemap ships as a second asset. CI builds and verifies on every push, so a terser setting that silently breaks the card fails the PR.

### Hot-path performance (step 2 of the code audit)

Pure optimisation — no new features, no config changes, no visible behaviour change. Measured against v5.9.14 on a 3-room config (6 overlays + 5 zones + 8 icons + 8 labels + 4 gauges per room): **300× `_update()` went from 234 ms / 2 400 `querySelector` / 300 `offsetWidth` to 148 ms / 0 / 0 (−37 % time)**, and a **60-frame resize drag from 32 ms / 480 `querySelector` / 120 `offsetWidth` to 1.3 ms / 0 / 60 (−96 % time)**. jsdom timings aren't browser timings — the percentages are the signal, the DOM-op counts are exact.

**`_update()` no longer touches the DOM to find nodes.** Each icon's inner `<ha-icon>` was re-queried every tick — 20 icons = 20 `querySelector` calls per state change, for a node that cannot change between renders. Now cached at render time in `_icoIconEls`, the same pattern badges already used for `_biconEls`/`_blabelEls`.

**Forced layout is now conditional.** `_update()` read `this.offsetWidth` unconditionally to resolve `%`-based icon sizes and label font sizes, even for configs that use none. A per-render `_needsCardWidth` flag records whether any item actually sizes in `%` — including sizes hidden in per-profile overrides (`portrait: {size: "12%"}`) and legacy tier keys. Detection is deliberately conservative (a non-string value counts as "yes"): a false positive costs one reflow, a false negative would break sizing.

**Geometry events no longer run a state pass.** The ResizeObserver called the full `_update()` — every condition on every overlay, zone, badge, icon, label and gauge re-evaluated — once per frame during a window drag or an opening keyboard. Only three things in `_update()` depend on the box, so resize now runs a narrow `_applyResizeStyles()`. The one entangled case (day/night blind gauges, whose slat gradient derives from both their own height and the state value) still delegates to the full pass, gated on `_hasDayNightGauge`.

**Layout passes coalesce.** Several observers can fire in one frame, each previously running its own fit+stage sequence. All now funnel through `_requestLayout()`, collapsing a burst into one microtask pass — same pattern as the existing `_requestPin()`. Stage-only requests (`.wrap` resized but not the card) upgrade to a full fit if a full request lands in the same microtask, mirroring `_schedule()`'s nav-only/full upgrade.

**Layout element refs cached.** `_layoutFitWrap()`, `_layoutStage()` and `_layoutRootHeight()` each re-queried `.wrap`, `.content` and `ha-card` per call — 11 `querySelector` calls per observer callback. Now behind `_elWrap()`/`_elContent()`/`_elCard()`, which re-resolve only when the cached node has left the current shadow tree (`getRootNode()!==this.shadowRoot` — exactly what `innerHTML` replacement does to it), so no manual invalidation is needed.

New instance fields are declared in the constructor, restoring the "constructor documents the instance shape" contract the audit flagged.

### Testing

`tests/lifecycle.test.js` → 35 assertions. The hot-path budget is now a hard ceiling: `_update()` must do **zero** `querySelector` calls and **zero** `offsetWidth` reads on a 40-item card, so an uncached query or forced read reintroduced in a per-item loop fails CI. The riskiest failure mode of this change — a `%` size silently ceasing to resolve — is covered behaviourally rather than structurally: a `10%` icon on a 400 px card must compute to `40px` and re-compute to `80px` at 800 px. Coalescing (50 requests → 1 pass) and the absence of `_update()` from the resize path are asserted directly. Render (178) and smoke tiers unchanged and passing; render output diffed line-by-line against v5.9.14 and identical.

## [5.9.14] - 2026-08-08

### Lifecycle & config-shape hardening (full code audit)

Six real defects found by a full audit of the card, three of which could leave a card permanently dead until a page reload. No new features, no config migrations — all fixes are backwards compatible.

**Scalar config values crashed the card.** `resolveVal()` assumed its argument was always a `[{condition,value}]` list. A bare scalar — `label: Kitchen`, `icon_color: red`, `color: "#fff"`, `conditions: {opacity: 0.5}`, `conditions: {filter: "blur(2px)"}` — reached `conds.find(...)` and threw a `TypeError` out of `set hass`: the card rendered once, then never updated again, with a console error on every state change. Two call sites (label colour, gauge colour) had been hardened with `Array.isArray` at some point; five had not. The guard now lives in `resolveVal` / `resolveFilter` / `resolveFilterInverted` themselves, so the scalar form is a supported shorthand everywhere and every future call site is covered. Reachable from the GUI editor, not just hand-written YAML — badges are edited through a free-form `label / visible / icon_color / tap_action / group (YAML)` textarea.

**Four hooks died on every dashboard edit-mode toggle.** HA moves the card element when entering/leaving edit mode → `disconnectedCallback` + `connectedCallback`. `_io`, `_hlHandler`, `_relTimer` and `_orientHandler` were nulled on the way out and revived with `if(this._x)…` on the way back in — dead code once null. Result after one toggle: no IntersectionObserver, no `roc-highlight` listener (editor→card flash broken), no 30 s ticker (`format: relative` labels frozen), no device-orientation parallax. Worst case: `_visible` is set *only* by the IntersectionObserver, so a card that was off-screen when HA moved it kept `_visible=false` with nothing alive to flip it back — `set hass` bailed forever and **the card was frozen until a page reload**. Revivable handles are now detached rather than nulled; `_wireVisibility()` and `_wireRelTimer()` (re)build the observer and the ticker from both `_render()` and `connectedCallback()`; and `set hass` now only trusts `_visible` while an observer actually exists to correct it, so no future regression of this class can freeze a card. Same defect class as the v4.6.4 layout-observer fix — four siblings were missed then.

**Per-room templates never subscribed.** `_setupTemplates()` read `this._config` while the rest of `_render()` worked on the merged room view (`this._roomCfg`). `labels`/`badges`/`zones`/`icons`/`overlays`/`elements`/`gauges` are all `ROOM_KEYS`, so `roomMerge()` replaces them with the active room's copies — meaning in any `rooms:` config the element ids never matched and every template lookup silently `continue`d. Affected `label.template`, `badge.label_template` and `visible_template` on every element type. `_startCamera()` already handled this correctly; `_setupTemplates` was the one that was missed.

**`label_template` did nothing on its own.** The badge text span was only emitted when `label` was defined, so a badge using only `label_template` — the exact form documented in the README — had no element to write into. Now emitted for either key.

**Editor leaked a window listener per open.** `disconnectedCallback` removed `roc-pos-update` but not `roc-room-switch`; every open/close left a live listener pinning the dead editor instance and still firing on room switches. The mounted `_prevCard` preview is released too. Also dropped the unused `_lyPvT` field.

**Unhandled promise rejections from invalid templates.** HA rejects the subscription for a bad Jinja template; with no `.catch` this surfaced as a bare console error with no card or template context. Now caught and logged with the offending template string.

### Testing

New `tests/lifecycle.test.js` (27 assertions) covering the blind spot all six bugs lived in: the existing suite only ever asserted on a card rendered once and left alone, never on one that gets **moved**. It polyfills `IntersectionObserver` and `ResizeObserver` — jsdom ships neither, and without them "the observer is gone" is indistinguishable from "the API never existed", which produces a false PASS on the `_io` assertions and a false FAIL on `_ro`. Kept in its own file so those polyfills don't perturb `render.test.js`. Also enforces a hot-path budget (`_update()` must not scale `querySelector` calls with item count) so perf regressions fail CI. Wired into `npm test` and the CI workflow; the 178 existing render assertions and the smoke tier are unchanged and still pass.

Full audit report, including the performance and structural findings deferred to later releases: `CODE_ANALYSIS_v5.9.13.md`.

## [5.9.13] - 2026-08-08

### Editor: Rooms & menu tab — sub-accordions (proposal 4 from the editor GUI/UX revalidation)

The Rooms & menu tab was one unbroken flat block — roughly 15 distinct concerns back to back with no sub-headers, the densest tab in the editor. Split into 4 collapsible `sec()` accordions (the same pattern already used on the Elements tab), decided after comparing a 5-section and a 4-section mockup with the user — 4 won out:

- **Room identity** — Room id, Name, Room icon, Area match, Thumbnail chips override. Open by default the first time the editor ever renders (same one-time nudge the Image tab's "Background & basics" section already gets), since it's the section most people reach for first.
- **Presence & follow** — room_entity, Follow hold, card_id, Follow mode, room_state_entity, and the "This device" browser_mod mapping (kept here rather than split out — it's just another way of resolving the active room).
- **Navigation menu** — style, position, live thumbnails + the conditional Mini-room settings panel, height/width/mobile height, auto breakpoint, wheel switch, follow button, and the Chips/Cards YAML lists. Still the biggest section, but now fenced off from room identity and presence, and collapsible on its own.
- **Deep-linking** — the Sync-room-to-URL checkbox + hash key, now with a one-line explanation of what it actually does (`#room=<id>` in the address bar) that didn't fit anywhere before.

Every field keeps its exact same id — this is a pure DOM regrouping, `_collectConfig()` needed zero changes.

### Testing

7 new render tests: all 4 accordion panels present, Room identity open by default on first render (others closed), and the right fields land inside the right panel (spot-checked room-id / nav-style / url-sync). Full smoke + render suites green (0 FAIL).

## [5.9.12] - 2026-08-08

### Editor: Layout tab — two small follow-ups to v5.9.11, per live user feedback on the rendered result

**Portrait/Landscape sub-tab buttons now carry an icon** (`mdi:crop-portrait` / `mdi:crop-landscape`) alongside the label, so which profile is which is visible at a glance instead of relying on reading the word.

**Image fit is now a dropdown, not a free-text field.** `cover`/`contain` was previously typed as plain text per profile (placeholder `cover|contain`) — easy to typo silently (the render falls back to `cover` for anything that isn't exactly `contain`, so a typo just fails silently rather than erroring). Replaced with a `<select>` per profile: `— same as landscape —` / `— default: cover —`, `cover — crop to fill`, `contain — letterbox`. Same underlying config keys and parsing (`_collProf` already worked generically off `.value`, so no parsing changes were needed) — purely removes the chance of a bad string.

### Testing

3 new render tests: sub-tab buttons contain the right mdi icon each, Image fit renders as `<select>` for both profiles, and the dropdown offers both `cover`/`contain` options. Full smoke + render suites green (0 FAIL).

## [5.9.11] - 2026-08-08

### Editor: Layout tab — Portrait/Landscape sub-tabs, live mini grid preview, and a real live-preview fix

Part of the ongoing editor GUI/UX revalidation ([`EDITOR_UX_REVALIDATION.md`](EDITOR_UX_REVALIDATION.md)) — this pass covers the Layout tab specifically (proposal 7, "Live preview for the Layout tab"), plus two smaller usability wins for the same tab. The Elements tab's alphabetical-with-icons section ordering (proposal 1) was reviewed and kept as-is — it reads fine and is out of scope for this round.

**1. Portrait / Landscape as sub-tabs, not stacked boxes.** The two profile editors used to render one after another, doubling the tab's length and making it easy to edit the wrong profile by mistake. They're now behind a small Portrait/Landscape pill toggle (same pattern as the top-level Image/Elements/Layout/Rooms&menu tabs); both profiles stay mounted underneath so field values and focus survive switching, only visibility toggles.

**2. Illustrative mini grid preview per profile.** Each profile box now shows a small color-coded diagram of its regions (Nav/Cards↑/Image/Lights/Cards↓/Cover), built from the exact same `rocGridCss`/`rocRegionCss` functions the real card render path uses — so it can't drift out of sync with the actual CSS Grid semantics (including the `1/6` grid-line span syntax). It repaints on every keystroke via a direct `innerHTML` swap of just the preview box (the same technique already used for the Light Controls gradient preview), so typing in a field never loses focus or triggers a full editor re-render. Purely a visual aid inside the editor form — it does not touch the real card.

**3. Fix: Layout tab edits didn't actually reach the Edit-mode live preview card.** Investigated whether the existing Edit-mode preview (the real, interactive `<room-overlay-card>` instance mounted in the editor when Edit mode is on) already reflected Layout tab changes, as the roadmap note suggested checking before building anything new. It didn't — not even on blur. Root cause: the editor's own `setConfig()` only re-mounts that preview instance when an item-count diff (`same` check — zones/icons/labels/badges/etc. array lengths) says something changed; `layout` was never part of that comparison, so a Layout-only edit could never trigger a remount, at any point, before this fix. Added a dedicated debounced path (`_lyDebouncedUpdate`, 150ms, mirroring the existing `_fireDebounced` used elsewhere) that pushes the freshly-collected config straight into the mounted preview card's `setConfig()`, bypassing the editor's own DOM re-render entirely — so typing in a Layout field now updates the live preview almost immediately, without any risk to input focus.

### Testing

9 new jsdom render tests: sub-tab buttons present and default to Portrait, clicking Landscape shows/hides the right panel, both mini-preview divs render, the landscape preview is pre-filled from an auto-migrated config, typing a region's row live-repaints its mini preview without losing the field's own value, and — with fake timers advanced past the debounce — a Layout tab edit (input, no blur) reaches the mounted Edit-mode preview card's `_config.layout`. Full smoke + render suites green (0 FAIL). Playwright e2e suite unaffected by this change (none of the 6 geometry specs touch the editor) but could not be executed in this environment — the Chromium binary failed to install offline; unrelated to this diff.

## [5.9.10] - 2026-08-05

### Fix: `nav.live: full`/`custom` thumbnails were overexposed vs. `composite`

`_updateNav()` applied each room's `brightness_model`/`filter_conditions`-derived CSS `filter`
directly to the thumbnail **wrapper** element (`.roc-thumb`), regardless of `nav.live` mode. For
`composite` (and classic static thumbnails) that's correct — the wrapper paints the room's
background/overlay stack itself, so it needs its own filter. But for `full`/`custom`, the wrapper
instead hosts a **real, independently-rendering `<room-overlay-card>` mini instance**, which
already applies its own `brightness_model`/`filter_conditions` internally (the exact same render
code path as the main card). Setting a CSS `filter` on the wrapper composited it on top of the
mini's already-correct rendering — brightness stacking on brightness — producing a visibly
overexposed/washed-out thumbnail. Reported live: composite thumbnails looked normal, full/custom
looked overexposed.

Fixed by skipping the wrapper filter entirely when `nav.live` is `full` or `custom` — the mounted
mini instance is fully self-sufficient for its own lighting/filter state. `composite` and classic
static thumbnails are unaffected.

### Testing

4 new render tests (full/custom stay filter-free; composite and classic-static are confirmed
unaffected, still applying `filter_conditions` to the wrapper as before). Full smoke + render
suites pass.

## [5.9.9] - 2026-08-05

### Revert: v5.9.8's `day_night` phase change broke the fully-closed look

User-caught regression, tested live the same day: after v5.9.8, a `day_night` blind at fully
closed (even with `top_offset: 0`, i.e. no correction at all) rendered visibly "a bit open"
instead of solid. Root cause: the old formula's `pct>=1 → offset = one half-period` special case
wasn't an arbitrary discontinuity as v5.9.8 assumed — it was the **load-bearing anchor** that
keeps the two striped background layers in anti-phase at fully closed, which is what makes the
blind render fully opaque (no see-through gaps) when drawn. v5.9.8's "continuous, no special-case"
replacement reached offset `0` at fully closed instead — aligning the two layers instead of
anti-phasing them, letting the gaps show through everywhere, including at 100% coverage.

**Reverted the render formula to its exact pre-5.9.8 behavior.** Removed the `rocDayNightOffset`
helper and its tests (smoke + render) added in 5.9.8, since they encoded the incorrect model.

### Structural finding (kept for any future attempt — see ROADMAP.md 🅿️ `day_night` blind model)

While reverting, traced the two-layer compositing precisely: one gradient layer is permanently
fixed at background-position `0`, the other scrolls with `pct`. Because the fixed layer's pattern
always starts **solid** at position `0`, and the fill area always starts at row `0` (top-anchored),
**the very first visible row of any `day_night` fill is unconditionally opaque, at any `pct`, at any
phase** — the fixed layer guarantees it whenever the scrolling layer happens to be transparent
there. This means a residual sliver that is *purely* transparent (as opposed to "mostly transparent
with an always-present opaque cap row") is not achievable via phase-tuning alone with the current
two-fixed/one-scrolling rendering approach — it would need a structurally different mechanism. This
is exactly the kind of finding the ROADMAP's parked note asks for before any further `day_night`
redesign is attempted; documented there for whoever (likely the same author) picks this up next.
`top_offset` continues to correctly control **coverage amount** for `day_night` blinds (that part
of v5.9.7 is unaffected and still correct) — it just doesn't (and currently can't cleanly) also
control the striped pattern's exact phase.

### Testing

Full smoke + render suites green (0 FAIL) after the revert.

## [5.9.8] - 2026-08-05

### Fix: `day_night` blind phase drift — now composes correctly with `top_offset`

The `blind_type: day_night` striped background scrolls its pattern as the blind opens/closes
(`backgroundPositionY`), to simulate the two-layer day/night fabric look. The old formula
(`pct * slat_count * period/2`, with a hard-coded special case at fully closed) had no defined
relationship to `top_offset`'s floored range — so once `top_offset` stopped `pct` from ever
reaching exactly 0, the residual sliver still visible at fully open showed an arbitrary, unsyncable
mix of the striped pattern. No value of `top_offset` could reliably line it up with reality.

Replaced with a continuous, physically-derived model: the striped pattern is fixed along the
fabric's own length, measured from the **bottom-rail end** (the end that's always visible last —
the header/roll swallows the opposite end first as the blind retracts). So whatever's currently
hanging below the header is always the *last* `pct × height` pixels of the full pattern. Because
the full height is by construction an exact multiple of the slat period, this makes the residual
sliver's appearance at fully open **fully determined** by `top_offset` and `slat_count` alone — no
separate phase parameter needed, and no more discontinuity at fully closed (the old special case is
gone; the new formula is naturally continuous, reaching exactly 0 offset at `pct = 1`).

Practical result: to get a *specific* residual look (e.g. "exactly one transparent half-slat
remains visible at fully open"), set `top_offset = 50 / slat_count` (as a %) — this lands the
residual exactly on a slat boundary. More generally, `top_offset = (residual slat-pairs / slat_count)
× 100` predicts the residual coverage in slat-pair units.

### Testing

6 new smoke tests for the new `rocDayNightOffset` pure function (continuity at both ends, midpoint,
clamping, and the exact real-world scenario: 17 band pairs, `top_offset = 50/17`, verifying the
residual lands exactly on the transparent side of a slat boundary). 3 new render tests (jsdom has no
real layout engine, so `offsetHeight` is mocked to a concrete value) confirming the DOM-level
`backgroundPositionY`/fill-height output matches. Full smoke + render suites green.

## [5.9.7] - 2026-08-05

### Fix: `top_offset` corrected the wrong end of the blind (broke fully-closed)

`top_offset` was applied to the **raw entity value**, before `min`/`max` normalization — so it
implicitly assumed raw `0` was always the end needing correction and raw `100` always needed
none. That only happens to hold for the card's own default (`min: 0`/`max: 100`) convention. Any
blind using the documented **"Inverted motor direction"** setup (`min: 100`/`max: 0` — i.e. a
cover that reports the standard `current_position: 0 = closed`) got the correction applied to
its **closed** end instead of its open end: fully closed stopped rendering as fully closed, and
the actual problem (a residual, un-retracted sliver at fully open) was never addressed at all.

Fixed by moving `top_offset` to apply **after** `min`/`max` normalization, to the gauge's already
open(0)/closed(1) fill percentage rather than the raw motor value. This is direction-agnostic —
it now works the same regardless of which way your motor's `min`/`max` are configured. Fully
closed is always left untouched (100%); only the open end is floored to the residual coverage.

Editor tooltip and README rewritten to describe `top_offset` in terms of open/closed, not raw
`0`/`100`, to avoid the same confusion going forward.

3 new render tests covering the exact reported scenario (inverted min/max, closed stays 100%,
open shows the residual, midpoint interpolates correctly). Full smoke and render test suites
pass.

## [5.9.6] - 2026-08-05

### Fix: Companion cards YAML intro text stayed visible with Advanced/YAML off

The explanatory paragraph above the Cards above/below YAML boxes ("Companion cards — paste
card YAML...") wasn't wrapped in the same `.roc-adv` visibility class as the two textareas it
describes, so it stayed on screen even with YAML mode off — an orphaned description for fields
that weren't there. Now hidden/shown together with the fields it explains.

1 new render test. Full smoke and render test suites pass.

## [5.9.5] - 2026-08-05

### Background & basics reorganized: Image/Camera mode toggle, moved fields

**Fix (real bug, not just UX):** it was possible to fill in both `base_image` and `base_camera`
at once. At runtime `base_camera` silently won (its snapshot polling overwrites the background
every refresh, `base_image` only ever flashed briefly on first paint) — confusing, and the
editor gave no indication of this precedence. Replaced with a **Background: Image / Camera**
mode toggle. Only the active mode's fields are shown; switching modes (or simply saving a config
that already had both set from before) now clears the inactive one from the saved config, so the
two can never coexist again.

**Camera refresh** relabeled to **Snapshot refresh** with an explicit note: *"a periodic photo,
not a continuous video stream."* This is accurate to how it already works — `base_camera` polls
the camera entity's `entity_picture` and swaps the background image every `camera_refresh`
seconds; it was never a live HLS/WebRTC stream. Chosen deliberately over embedding HA's native
live-stream player: it works with any camera entity regardless of stream support, has near-zero
overhead, and avoids the same native-component-lifecycle fragility that already broke
`ha-entity-picker` once in this editor's innerHTML-rebuild-per-render architecture.

**Reorganized the rest of the panel** per user feedback: **Pan & pinch-zoom** now sits next to
the new Image/Camera toggle at the top; **Filter transition** moved into the **Image filters**
tab (it's a filter-behavior setting, not a background setting); **Weather overlay** moved to the
very bottom of the panel.

9 new render tests (mode defaults from existing config, pane visibility swapping, mutual-exclusion
enforcement on both toggle-switch and stale-config-save paths, relabeled refresh copy, and
regression coverage for zoom/filter_transition after their move). Full smoke and render test
suites pass.

## [5.9.4] - 2026-08-05

### Clarify the Base image URL field

The bare `*` on "Base image URL" had no legend anywhere explaining it — replaced with an inline
note matching the style already used by its sibling fields: **Base image URL (required, unless
using a camera below)**. Also added a `/local/images/room.webp`-style placeholder so the expected
path format is clear at a glance, same as Base camera's `camera.living_room` placeholder.

2 new render tests. Full smoke and render test suites pass.

## [5.9.3] - 2026-08-05

### Title row rebalanced — version by the title, YAML/Undo/Redo grouped and highlighted

The version number moved from the far right of the title row to sit right next to "Room
Overlay Card". Undo/Redo (and the YAML toggle right before them) now anchor the right side of
the row on their own. All three — YAML, Undo, Redo — get a brighter, consistent border so
they read as a clear button group instead of blending into the background; the undo/redo
arrow glyphs already matched YAML's off-state text colour, now made explicit and consistent
across all three.

2 render tests updated/added (button order, version placement next to the title). Full smoke
and render test suites pass.

## [5.9.2] - 2026-08-05

### Move the YAML toggle up next to Undo/Redo

`YAML` (formerly "Advanced (YAML)") moved out of the Room/Edit mode/Haptics row and into the
title row, right next to the Undo/Redo buttons — grouping it with the editor's other
meta/utility controls instead of the config-toggle row below. It's now an icon-only button
(`mdi:code-braces`, no visible text, matching Undo/Redo's compact style) that highlights when
active.

5 render tests updated/added: it's confirmed to sit right after Redo, defaults to off/hidden,
and toggles the advanced-fields visibility class on click (was a checkbox `change` handler,
now a button `click` handler with its own inline active-state styling since this is a lightweight
CSS-class toggle, not a full re-render). Full smoke and render test suites pass.

## [5.9.1] - 2026-08-05

### Fix: blank gap under the editor's live preview + Advanced (YAML) gets an icon and shorter label

**Fix:** the editor's live preview (`_roc_preview`) card had its root height hardcoded to a
guessed `420px`, regardless of how tall its actual content (nav strip, lights row, image, cover
rail) needed to be — leaving a blank gap below shorter content. It now sizes the same way mini
nav thumbnails already do: `height:auto` on the card, with the `.wrap` locked to the room's design
`aspect_ratio` (resolved from its rendered width) instead of a fixed guess.

**Advanced (YAML)** stays in the header (decided against relocating it near each YAML-capable
panel, per further discussion) — it now has an icon (`mdi:code-braces`) and a shortened label,
just **YAML**, matching Room/Edit mode/Haptics.

2 new render tests for the preview height fix, 2 more for the YAML icon/label. Full smoke and
render test suites pass.

## [5.9.0] - 2026-08-05

### Editor GUI/UX revalidation, part 1 — merge Test mode + Drag-edit preview into "Edit mode"

First shipped step of the editor GUI/UX revalidation (see `EDITOR_UX_REVALIDATION.md`), tracked as
its own **v5.9.x** line, separate from v6.0.0.

**Test mode** and **Drag-edit preview** were two separate header checkboxes doing almost the same
thing slightly differently — confusing, and worse, easy to get wrong: Test mode was a persisted
config field that could be left on and silently disable real tap/hold actions on your live
dashboard card, while Drag-edit preview was editor-only and never saved. They're now **one field**:
**Edit mode** (still `test_mode` in YAML, unchanged). Checking it in the editor both persists
`test_mode: true` to the saved config *and* immediately shows the live, draggable preview panel
right there in the header — no separate toggle, no waiting for Home Assistant to echo the config
back before the preview appears.

Also added icons to the header's **Room** picker (`mdi:door`), **Edit mode** (`mdi:cursor-move`)
and **Haptics** (`mdi:vibrate`, shortened from "Haptic feedback") — first step toward fitting the
whole row on one line instead of wrapping awkwardly.

`Advanced (YAML)` stays in the header for now — relocating it to live next to the fields it
actually affects is a separate, still-undecided step in the same revalidation effort.

12 new/updated render tests (checkbox removed, Edit mode toggling mounts/unmounts the preview
synchronously, persists/removes `test_mode` correctly, icons present, room-switch and drag-relay
tests from v5.8.1/v5.8.2 updated for the merged field). Full smoke and render test suites pass.

## [5.8.2] - 2026-08-05

### Fix: dragging/resizing in the editor's live preview wiped `url_sync` and forced `follow_mode`

Any drag or resize made inside the editor's **Drag-edit preview** silently reset `url_sync` (the
"Sync room to URL" checkbox + hash key on the *Rooms & menu* tab) and, on multi-room cards,
overwrote `follow_mode` with `manual` — even if you'd never touched either field yourself. It kept
happening on every subsequent drag, so anything you'd explicitly set there never survived.

Root cause: the preview is a separate `room-overlay-card` instance mounted from a clone of the
real config with `test_mode` forced on, `url_sync` deleted (so the preview can't hijack the
dashboard's own URL) and, for multi-room, `follow_mode` forced to `manual` (so it doesn't jump
rooms on its own). When you drag/resize something in that preview, it relays its *own* config back
to the editor (`roc-pos-update`) so the position sticks — but the relay handler only undid the
`test_mode` override, not the `url_sync` deletion or the `follow_mode` override, so both leaked
into the real config on every drag.

Fixed by restoring `url_sync` and `follow_mode` from the editor's real config whenever a
preview-relayed update comes in, alongside the existing `test_mode`/`_roc_preview` cleanup.

5 new render tests: the mounted preview is confirmed to lack `url_sync` / force `follow_mode` /
force `test_mode` (sanity), and a simulated drag-relay update is confirmed to restore both
`url_sync` and `follow_mode` to the real config's values (and still correctly strip the preview-only
markers). Full smoke and render test suites pass.

## [5.8.1] - 2026-08-05

### Fix: editor's Room select didn't follow room switches made inside its own live preview

With **Drag-edit preview** on, clicking a different room in the preview's own thumbnail nav strip
changed what the preview showed, but left the editor's *Room* dropdown (and every per-room panel)
pointed at whichever room was selected before — so any field edit made right after silently landed
on the wrong room's config.

Root cause: the preview is a real, independent `room-overlay-card` instance; its internal room
switch (`_switchRoom`) had no way to tell the surrounding editor it had moved. Fixed by having the
preview dispatch a `roc-room-switch` window event (only for preview instances, matched by config
identity) whenever it switches room; the editor listens for it while the preview is mounted and
syncs `_editRoomIdx` (and re-renders, so the Room select and every per-room panel follow along) —
same pattern already used for relaying drag/resize edits back from the preview (`roc-pos-update`).

4 new render tests: the preview mounts, the editor starts on room 0, switching room inside the
preview updates the editor's tracked room index and the Room select's value, and a field edit made
afterward lands on the room now shown rather than room 0. Full smoke and render test suites pass.

## [5.8.0] - 2026-08-05

### Haptic feedback the moment a hold action registers (ROADMAP E7)

Zones/icons/labels/gauges with a `hold_action` already showed a visual progress ring confirming
when the hold threshold was reached — but the card only vibrated later, on release, when the hold
action actually executed (the same haptic pulse any tap action fires). Now there's a distinct
tactile tick at the exact moment the hold *registers* (the ring turning green), before you even
lift your finger — similar to how a native long-press haptic feels.

Uses the same `haptic` top-level opt-out as every other haptic pulse in the card
(`haptic: false` to disable all of it). Now also toggleable from the editor: a **Haptic feedback**
checkbox sits in the persistent header next to Test mode / Drag-edit preview / Advanced — no more
YAML-only.

4 new render tests (the tick fires on hold-registered with default settings, `haptic: false`
suppresses it, the editor checkbox reflects and writes the config both directions). Full smoke and
render test suites pass.

## [5.7.1] - 2026-08-05

### Fix: `nav.live` dropdown order

Editor's *Live thumbnails* dropdown now lists options in increasing order of complexity: Off,
Composite, Custom, Full (was Off, Composite, Full, Custom). No config or behaviour change.

## [5.7.0] - 2026-08-05

### `nav.live: custom` — pick exactly which elements show in the mini

The third and final `nav.live` tier (alongside `off` and `composite`) alongside `full`: same
real-instance mount/scale mechanism as `full`, but instead of showing everything unconditionally,
each mini starts **empty** and only shows what you explicitly opt in.

Every gauge, label, icon, badge, blind, and embedded card panel in the editor gets a **"Show in
mini"** checkbox (only visible once `nav.live: custom` is selected) — tick it to include that
element in the live mini-room thumbnails. Weather gets its own toggle in the Basic tab, since it's
a single overlay rather than a list. In YAML, the same thing is a `nav_mini: true` field on any
element, or `weather_nav_mini: true` at the top level or per room:

```yaml
nav:
  style: thumbnails
  live: custom
gauges:
  - id: temp_gauge
    entity: sensor.bedroom_temp
    nav_mini: true   # shows in the mini — omit or set false to hide it there
weather_nav_mini: true
```

Nothing is a breaking change: `full` keeps showing everything as before, `nav_mini` is ignored
entirely outside `custom` mode, and switching `nav.live` back and forth never loses your per-element
choices — they just stop being read until you switch back to `custom`.

Motivating case: a room with a lot of visual detail where you don't want every gauge/label/badge
crammed into a thumbnail-sized mini, or one specific embedded card that looks bad at that scale —
`custom` lets you keep everything in the main view while trimming the mini down to what actually
reads well at a glance.

10 new smoke tests (`rocBuildMiniConfig`'s custom-tier filtering: per-item opt-in across all six
element types, room-level vs top-level default arrays filtered independently, the weather toggle's
room-overrides-top-level resolution, `full` mode staying unaffected) and 12 new render tests (the
`custom` option, checkboxes appearing/disappearing across every element panel, zones correctly
excluded — not visual room content, collect round-tripping, weather toggle, and an end-to-end mount
test confirming a live mini's actual config comes out pre-filtered). Full smoke + render suite
green (202 smoke tests).

## [5.6.0] - 2026-08-05

### `nav.live: full` — editor UI (step 5 of the feature)

`nav.live: full` (real live mini-rooms in the nav thumbnails, shipped v5.4.0, sizing bugs fixed
through v5.5.2) was YAML-only until now. The editor's *Rooms & menu* tab gets:

- A `full` option on the existing *Live thumbnails* dropdown, alongside `off` and `composite`.
- A *Mini-room settings* panel, shown only when `full` is selected: a templates checkbox, a
  camera-refresh number field (min 30s), and a reference-width field — matching `nav.mini.templates`
  / `nav.mini.camera_refresh` / `nav.mini.width_ref` in YAML.

No behaviour change for existing `off`/`composite` configs. New render tests cover the option
being present, the panel showing/hiding on selection, config round-tripping correctly on
`config-changed`, and pre-filling correctly when reopening the editor on a config that already has
`nav.mini` set. 168 smoke + full render suite green.

This closes out the `nav.live: full` feature build-out (mount mechanism, three rounds of live
sizing fixes, now editor UI) — remaining items (instance-reuse performance, the planned `custom`
per-element mode) are non-blocking follow-ups, not required for today's `full` mode to work.

## [5.5.2] - 2026-08-05

### Fix: v5.5.1's `zoom` fix didn't survive a real page load (async re-layout undid it)

v5.5.1 switched mini scaling from `transform: scale()` to CSS `zoom` to fix a content-box
mis-sizing bug. Live-verified correct in the moment — but after actually deploying it and doing a
full page reload, the living room blind was *still* invisible.

Root cause: `zoom`'s effect on `getBoundingClientRect()` isn't consistent over time. Right after
setting `zoom`, a rect read on a descendant can still report the pre-zoom (correct) size — but a
later, asynchronous re-layout pass (triggered by the mini's own `ResizeObserver` on its `.wrap`
box, which runs for legitimate reasons unrelated to this bug) re-measures once the zoom has fully
"settled," and *that* read comes back zoomed/shrunk — silently re-corrupting the content box that
had been correctly sized moments earlier. This is exactly why it looked fixed when checked
immediately but wasn't fixed after a real reload.

Real fix this time: `_layoutStage()` (which sizes the mini's internal content box, and is the root
of this whole bug class) now measures with `wrap.offsetWidth`/`wrap.offsetHeight` instead of
`wrap.getBoundingClientRect()`. Unlike `getBoundingClientRect()`, `offsetWidth`/`offsetHeight` are
specified to always report an element's own CSS layout box, completely unaffected by *any*
ancestor visual transform (`transform` or `zoom`) — regardless of timing. Scaling mechanism
reverted back to plain `transform: scale()` (simpler, more predictable, no longer matters which
one is used since the measurement itself is now immune). Also added a `_roc_mini` bail to
`_layoutFitWrap()` — its viewport-height budget-fitting logic was never meant for minis (they
always render at a fixed reference width with an aspect-derived auto height, never in
viewport-height mode) and was reading rects that had the same theoretical exposure.

Live-verified this time with an approach that specifically covers what broke last time: forced the
mini's layout pass, then waited 2.5s for any async re-layout to settle, and re-checked — content
box and gauge size stayed correct and *stable* across both reads (479.9×255 / 118×87, unchanged
before and after the wait), unlike the `zoom` version which silently regressed during that same
window.

## [5.5.1] - 2026-08-05

### Fix: `nav.live: full` mini content box measured ~3x too small (blinds nearly invisible, everything else subtly mis-sized)

v5.5.0 fixed the *connection-timing* half of the living-room blind bug, but live testing on a real
dashboard showed it wasn't gone — the blind's gauge and fill elements now had real, non-zero
computed styles, yet the blind still didn't visually appear.

Root cause was different and deeper: minis are scaled down to fit their small nav thumbnail with
CSS `transform: scale()`. `transform` is a *paint-only* transform — an element's own CSS layout
(its `%`-based children, `aspect-ratio`, etc.) still resolves at the **pre-transform** size, but
`getBoundingClientRect()` reports the **post-transform** (visually rendered, smaller) size. The
card's cover-stage sizing (`_layoutStage()`) uses `getBoundingClientRect()` to size `.content` in
pixels — so under a mini's ~0.29x scale, `.content` ended up pinned to roughly 0.29x its intended
size, and everything positioned by percentage inside it (gauges, badges, icons, labels) inherited
that wrong, too-small box. Most gauges are simple percentage fills, so this just looked slightly
compressed. `day_night` blinds measure their own real pixel height to draw a repeating slat
pattern — with a `.content` box already ~3.3x too small *and* the whole thing scaled down again by
the outer transform on top, the slat pattern ended up sub-pixel wide and effectively invisible.

Fixed by switching the mini scaling mechanism from `transform: scale()` to CSS `zoom`. Unlike
`transform`, `zoom` scales layout itself — every measurement inside the zoomed subtree
(`offsetHeight`, `getBoundingClientRect()`) stays self-consistent with the CSS percentages sizing
it, so there's no more mismatch between how the box is measured and how it's actually laid out.
This is a general fix, not blind-specific: it corrects sizing for anything measured by pixel
rect inside a mini under `lock_aspect`, not just `day_night` blinds.

Live-verified on the reported living-room `day_night` blind: gauge size went from a wrong 34×25px
to the correct 114×83px (matching its configured `width:23.5%;height:32.0%`), and the slat stripe
width went from an invisible 0.7px to a visible 2.4px.

## [5.5.0] - 2026-08-05

### Fix: `nav.live: full` mini could render a blind (esp. `day_night`) as empty

Live-tested v5.4.0 on a real dashboard: the bedroom mini showed its blind correctly, the living
room mini didn't show its `day_night` blind at all.

Root cause: the mini `<room-overlay-card>` instance had `hass` assigned (which triggers its first
render/update pass) **before** it was attached to the document. A disconnected element always
reports `offsetHeight`/`getBoundingClientRect()` as zero — harmless for plain percentage-fill
gauges (a later visibility check quietly corrects them), but `day_night` blinds specifically
measure their own pixel height via `offsetHeight` to position their slat pattern, and silently
skip drawing any fill at all when that measurement comes back zero. Fixed by connecting the mini
to the DOM before configuring it, so every layout measurement on its first pass is already
accurate — no more relying on a later self-correction that wasn't guaranteed for every blind type.

## [5.4.0] - 2026-08-05

### `nav.live: full` — nav thumbnails become real, live mini-rooms (early/experimental, YAML-only)

*(v5.2.0/v5.3.0 intentionally unused — reserved during development, never released.)*

`nav.live` gains a third value, `full`, alongside the existing `composite`. Where `composite`
(v3.1.0) composites base image + active overlay images + a filter as CSS backgrounds, `full`
mounts a real, independent, non-interactive `room-overlay-card` instance for every room —
gauges, labels, icons, badges, blinds, embedded elements and all — rendered at a fixed reference
width and scaled down with a CSS transform, so fonts/icons/gauge strokes keep exact proportions.
It shows **everything unconditionally** — no per-element configuration in this release.

```yaml
nav:
  style: thumbnails
  live: full
  mini:
    templates: false     # opt-in — label/colour templates cost a WS subscription per mini
    camera_refresh: 30    # seconds, clamped >= 30 regardless of the room's own setting
    width_ref: 480         # px — reference width each mini renders at before scaling down
```

**Status — please read before enabling on more than a couple of rooms:**
- **No editor UI yet.** `nav.live: full` and the `nav.mini.*` options are YAML-only this release —
  set them via the card's Advanced/YAML editor. A GUI dropdown + settings panel is planned next.
- **Not yet performance-tuned.** Every mini instance currently rebuilds on every full card render
  (matches the existing `nav.cards` behaviour) rather than only when a room's identity changes —
  more subscription/DOM churn than the final design targets. Fine for trying it out; revisit
  before leaning on it with many rooms on a permanently-open kiosk display.
- **Real cost, on purpose.** Each mini is a genuine card instance — real DOM, real state
  subscriptions. A soft cap of ~8 rooms is recommended; test on your actual wall tablet before
  going further. `composite` remains the lightweight default for anyone who doesn't need this.
- Camera/template subscriptions stay off by default per mini and must be explicitly opted into via
  `nav.mini.templates` — a real per-instance cost otherwise.
- Always excluded from every mini, regardless of the live mode (this is page furniture around the
  image, not room content): `cards_above`, `cards_below`, `light_controls`, blind `control:`
  blocks, `nav.cards`, `zoom`/`parallax`, `url_sync`.

A future `custom` mode (planned, not in this release) will add per-element GUI checkboxes to
curate exactly what shows in a mini — useful if, say, one specific embedded card is unsuitable at
thumbnail scale while everything else should stay. Full design: `NAV_LIVE_FULL_PLAN.md` in the
repo.

## [5.1.0] - 2026-08-05

### Blind visual overlay calibration (`top_offset`)

Many roller-blind motors keep a deliberate safety margin at their own "fully open" (0%) limit — the motor never actually winds all the way up, so the blind still hangs a few centimetres even at `current_position: 0`. Until now the card drew the visual overlay assuming raw `0` meant truly fully open, so the on-screen blind never quite matched reality at intermediate positions.

- New optional per-blind field **`top_offset`** (%, decimals allowed, e.g. `3.4`) — the real/visual position that corresponds to the motor's raw `0`. Raw `100` is assumed to already match reality (most motors close accurately) and needs no correction. The card linearly remaps every position in between for the **visual overlay only** (`blinds:` gauge rendering on the room image).
- The cover-control widget (drag rail, up/stop/down, presets) is **unaffected on purpose** — it keeps showing and sending the motor's raw position, so dragging the rail or tapping a preset still behaves exactly as before.
- Default `0` = fully backward compatible, no behaviour change for existing configs.
- New editor field "Top offset (%)" next to Min/Max on each blind.

## [5.0.0] - 2026-07-17

### Layout engine cleanup + real-renderer regression harness

Internal restructuring release — **no config changes, no intended behaviour changes**. The 4.6.x series fixed the viewport/edit-mode behaviour through five generations of overlapping trigger mechanisms; 5.0.0 consolidates them and locks the verified behaviour in with a new test tier. Full plan: `V5_PLAN.md`.

- **One pin entry point.** Every trigger (scroller/body ResizeObservers, window resize, edit-transition MutationObservers, `location-changed`, the state-update piggyback, reconnect) now routes through `_requestPin(reason)`, which coalesces any number of requests inside one task into a single recalculation on the next microtask — never rAF. A hook-inventory comment in the code documents why each trigger exists. Two now-redundant timers are gone: the 1.2 s post-render re-pin and the 300 ms "self-heal" (both superseded by the deterministic edit-transition MutationObserver from 4.6.4).
- **rAF audit.** `_schedule` (state-update batching) now falls back to `setTimeout(0)` when the document is hidden — rAF never fires in background tabs, so updates in hidden dashboards (browser_mod popups, secondary windows) queued forever and the card woke up stale. The remaining rAF uses are visual-only (swipe ghosts, parallax) and annotated as background-safe.
- **Diagnostics.** `window.ROC_DEBUG = 1` logs every pin request (reason) and every applied pin (resolved scroller, avail/top/edit-bar reserve, raw vs absorbed height). If the scroll container or panel-view ancestor stops resolving on a dashboard where it previously did — the signature of an HA internal-DOM change — the card says so once in the console instead of degrading silently.
- **Small debts.** Shared grid-row span helpers (`rocRowStart`/`rocRowEnd`) replace three inline parsers; the window-scroller branch measures `visualViewport.height` (mobile dynamic toolbars); a smoke test pins `ROC_VERSION` to `package.json` so the two can never drift.
- **Geometry regression harness (new test tier).** `tests/harness/ha-shell.html` is a static mock of the HA DOM skeleton the card depends on — including a faithful replay of the edit-mode toggle (wrapper + actions bar, atomic move) as observed live. `tests/e2e.spec.js` (Playwright, headless Chromium — a real layout engine, unlike jsdom) asserts pixels: card bottom == viewport bottom with zero page overflow, corner badge fully visible, letterboxing on short windows (aspect kept, centred), actions bar reachable without scrolling in edit mode, full re-expansion on exit, height stability over idle time (anti-breathing), and resize re-pinning. Runs via `npm run test:e2e` and in CI. All 6 pass against this release; the jsdom tiers (159 smoke + 52 render checks) stay as the fast tier.

## [4.6.4] - 2026-07-17

### Edit-mode transitions are now event-driven — enter and exit recalculate instantly

Both remaining edit-mode bugs — the actions bar off-screen after entering edit mode, and the card stuck at its edit-mode height after leaving until a refresh or swipe — had the same root cause, diagnosed live with instrumented observers in the running dashboard:

- **`disconnectedCallback` nulled every ResizeObserver, and `connectedCallback` "re-attached" them with `if(this._ro)this._ro.observe(…)` — dead code after the nulling.** Any DOM move stripped the card of all layout triggers, leaving only the 1-second state-update piggyback, which fires only when a relevant entity happens to change — seconds to minutes later. Fixed: all observer wiring lives in one `_wireLayoutObservers()` method, called from render **and** from `connectedCallback`, recreating everything from scratch.
- **The edit toggle itself is invisible to all conventional hooks.** Verified live: it fires no `location-changed`, doesn't resize the scroller or `body`, and doesn't even dis/connect the card element — HA atomically rebuilds the DOM *around* it (`hui-card-options` wrapper in `hui-panel-view`'s shadow tree, the actions bar in the wrapper's own shadowRoot). The card now watches exactly those two trees with a MutationObserver: they mutate precisely on edit enter/exit and never contain the card's own DOM, so the observer is silent otherwise. On every mutation the height re-pins synchronously and the observer adopts a newly created wrapper's shadowRoot.
- **`requestAnimationFrame` was silently eating deferred recalculations** — rAF never fires in background tabs (wall-mounted kiosk dashboards!) or during HA view transitions. All deferred re-pins now use synchronous calls from MutationObserver callbacks (the DOM is already settled there) or `setTimeout(0)`, never rAF.
- A `location-changed`/`popstate` listener re-pins after HA client-side navigations (view switches, back/forward) as well.

Verified live on the real dashboard: entering edit mode settles in one self-correcting sequence (bar reserve measured the moment the bar mounts), leaving edit mode re-expands to full height in a single synchronous pin — no refresh, no swipe, no timers.

## [4.6.3] - 2026-07-17

### Release pipeline hardened — HACS "unknown error" on v4.6.2 (missing release asset)

No card-code changes — this release exists because **v4.6.2 could not be installed through HACS**. HACS downloads `room-overlay-card.js` from the release assets (per `hacs.json` `filename`), and the v4.6.2 release had none: the upload workflow's single-shot `softprops/action-gh-release` step hit a transient GitHub 503 ("Unicorn" error page, run #150), the run failed quietly, and the release stayed published without its asset.

- **The release workflow now retries the upload** (5 attempts with increasing backoff, via the `gh` CLI — the deprecated-Node third-party action is gone) **and verifies at the end that `room-overlay-card.js` is really attached**, failing the run loudly if not. A published release that HACS can't install is no longer a silent possibility.
- **Backfill trigger:** the workflow can be run manually (Actions → Release → Run workflow → tag) to attach the asset to any existing release.
- Card is identical to 4.6.2 apart from the version number.

## [4.6.2] - 2026-07-16

### Edit mode: actions bar visible without scrolling; "breathing" size loop after a swipe fixed

Diagnosed live in the running dashboard (edit mode entered, oscillation reproduced and logged at ~1 Hz). Two interlocking causes:

- **Fix: the card "breathed" — rhythmically zoomed in and out and never settled.** `ha-card` carries a `transition: 0.3s ease-out` from Home Assistant's own styles, so every height pin animated for 300 ms — and every measurement taken inside that window (the budget-fit, the overflow absorption) read a mid-flight rect and computed the *next* wrong value; the appearing/disappearing page scrollbar then acted as a metronome re-triggering the cycle. The card's `ha-card` now gets `transition: none` (we own its height entirely), and the budget-fit computes from the card's *intended* inline height instead of the animated rect as a second line of defence.
- **Fix: edit-mode actions bar (Edit / Move / …) landed below the fold.** `_editBarHeight` looked for HA's `.card-actions` inside an `HA-CARD` ancestor's shadowRoot — in current HA the bar lives in `hui-card-options`' shadowRoot, so the probe returned 0 and no room was reserved. The reserve now finds the bar there (legacy path kept) and measures the bar block's **own** height + vertical margins — never a position difference against our card, which is circular (it measures a layout our own height just changed and over-reserves).
- **Fix: leaving edit mode left the card at the shorter edit-mode height.** Exiting edit removes the actions bar without resizing the scroller or recreating the card — no observer fires. A throttled (1 s) root-height re-check now piggybacks on regular state updates; it early-outs when nothing changed, so it's effectively free.

## [4.6.1] - 2026-07-16

### Intrinsic image box now respects the height budget (letterbox instead of clipping)

Diagnosed live against the real dashboard: v4.6.0's height pin was already correct (card ended exactly at the viewport), yet a bottom-left badge still vanished — the overflow was **inside** the card. With the image region on an `auto` grid row, CSS `aspect-ratio` sizes the image box from its WIDTH alone (height = width/aspect), blind to the card's pinned height; on short viewports the grid total exceeded the card, `ha-card` clipped the excess, and everything anchored to the image's bottom edge disappeared below the fold. In edit mode the same mismatch showed up inverted, as a black band where the (mis-fitted) image should have been.

- **Budget-fit for the intrinsic image box.** Whenever the width-derived height doesn't fit the remaining budget (card height minus the rows above/below the image, from the layout definition — not from the geometry of an already-overflowing grid), the box now shrinks to fit the HEIGHT, keeps the exact design aspect, and centres itself — the image letterboxes (side bars) instead of being cropped or clipped. Every stage-glued element (zones, icons, labels, gauges) shrinks with it; corner badges stay pinned to the visible box. Fits back up automatically when space returns (window resize, leaving edit mode). Runs on every layout trigger (pin, resize, ResizeObserver, render).
- **Fix: an absorbed height could get stuck short.** 4.6.0's residual-overflow absorption kept the shrunken height as long as the raw measurement was unchanged — even after the overflow it reacted to was gone (e.g. it was a transient of the internal grid overflow above). The change-detection now re-expands whenever the pinned height stopped matching the raw one and nothing overflows anymore.
- **Self-heal for transient rects.** Heights measured while HA shuffles its DOM (edit-mode reparenting into `hui-card-options`, header mount) can be transiently wrong, and an RO event could pin a bogus value with no follow-up trigger. Every pin that CHANGES the value now schedules one delayed re-check (300 ms) from settled rects; a stable pin doesn't reschedule, so there's no steady-state polling.

## [4.6.0] - 2026-07-16

### Viewport height engine rebuilt: scroll-container measurement (header, edit mode, room-switch fixes)

One root cause explained three separate symptoms — a too-tall card after HA's header settled, no recalculation when entering edit mode, and corner badges (e.g. a bottom-left vacuum chip) sliding below the fold on *some* rooms after a swipe. The `viewport` height pin measured the card's top offset **relative to the viewport** and refused to run when the page was scrolled (`r.top < 0`) or the offset looked odd. But a card pinned too tall is exactly what *causes* that scroll — so one bad measurement locked itself in and could never self-heal. Every room switch re-rendered the card, reset its height to the CSS first-paint fallback (`calc(100svh - var(--header-height, 56px))`, which never matches HA's real header + view padding exactly), and rolled the dice again — hence "broken on some rooms".

- **Scroll-independent measurement.** The card now resolves Home Assistant's actual scroll container (nearest scrollable ancestor across shadow boundaries, `documentElement` fallback) and measures its top offset against the scroller's *content* (rect diff + `scrollTop`) instead of the viewport. The math stays valid while scrolled, in edit mode, and while the header settles — all the old bail-out conditions are gone.
- **The right ResizeObserver.** HA keeps `document.body` at a fixed height (the app scrolls *inside* it), so 4.5.1's body observer never fired for header/toolbar changes. The card now observes the scroll container itself — header settling and edit-mode toolbars change its box, triggering an immediate re-pin. The body observer stays as a fallback for embeds where the page itself scrolls. Two delayed re-pins (250 ms / 1.2 s) after each render catch late-settling fonts and HA's per-card edit bar.
- **Pinned height survives re-renders.** A room switch (swipe, nav, presence-follow) now re-renders the card at the previously pinned pixel height instead of falling back to the CSS calc — no flash, no per-room lottery.
- **Residual overflow absorbed.** View wrappers add bottom padding *below* the card inside the scroller — invisible to any top-offset math. After pinning, the card measures what actually overflows and absorbs it into its height (capped at 160 px, so a genuinely tall page keeps its scrollbar instead of crushing the card). This ends the family of 1 px-to-header-sized scroll gaps chased in 4.5.1/4.5.2.
- Portrait natural-height mode (4.5.2) is untouched. New render tests cover scroller resolution, badge pinning to the visible box across room switches, and height persistence.

## [4.5.3] - 2026-07-16

### Fix: cover-control presets read in the wrong direction on the horizontal (portrait) bar

- **The blind-control preset buttons (Open / Day / Gap / Closed, etc.) now always read closed → open in a horizontal bar, regardless of how they're ordered in `control.presets`.** The vertical rail (landscape dock, side column) reads its presets top → bottom exactly as authored in the config — typically open at the top, closed at the bottom, matching the up/close direction of the slider. The same `presets` list, unmodified, previously rendered in that *same* array order on the horizontal bar (portrait dock, or the portrait float bottom bar), which put "closed" on the wrong end and read open → closed left-to-right. One `presets` list can't have two different orders depending on the axis it's authored for, so reordering it in YAML to fix one profile silently broke the other. The horizontal bar now sorts a copy of the list by `position` ascending purely for its own left-to-right rendering; the vertical rail is untouched and still uses the config order as-is. No config change needed — existing `control.presets` lists now render correctly in both profiles at once.

## [4.5.2] - 2026-07-15

### Portrait: natural content height + landscape edit-mode/rounding fixes

Diagnosed live against a real dashboard (Panel view) before writing any code — see the investigation notes below.

- **Portrait no longer force-fills the screen.** `layout: height: viewport` (default) forced portrait to stretch every region to match the full available screen height, even though width is the real constraint there — any extra vertical space just got proportionally distributed across rows instead of being left alone. Portrait now sizes itself from its own content (width-driven, image at its design aspect, everything else its natural size); if that's shorter than the screen, the rest is simply left blank instead of stretched. Landscape (the wall-tablet kiosk use case) is unchanged — it still fills the screen. An explicit `layout: height: container` or a fixed length is still honoured in either profile.
- **Fix: HA's edit-mode "card actions" bar (Edit / Move to view / …) no longer lands below the fold.** In landscape/viewport mode, Home Assistant wraps the edited card in its own `hui-card-options` element and appends a real, in-flow actions bar after it — not an overlay. Since the card was (correctly) sized to the exact screen edge, that bar always ended up needing a scroll to reach. The card now detects HA's own `edit-mode` marker and reserves the actions bar's live-measured height (never a hardcoded number), so it's visible without scrolling. Best-effort: this reaches into HA's internal, non-public DOM structure — if a future HA version changes it, this silently falls back to today's behaviour rather than breaking.
- **Fix: a persistent sub-pixel scrollbar in landscape.** Measured live: the view container can sit a fraction of a pixel taller than the actual viewport even outside edit mode, and rounding the pinned height with `Math.round()` could round the wrong way and trigger a scrollbar. Switched to `Math.floor()` — the card now only ever errs a fraction of a pixel short, never long.

## [4.5.1] - 2026-07-15

### Fix: empty scroll strip under the card in viewport-height layout

- **Portrait `layout: height: viewport` no longer leaves a stray scrollable gap the size of the HA header (or the edit-mode bottom bar).** The card pins its height in JS from `innerHeight − <card top offset>`, but that pin was only ever refreshed on an actual `window` resize event. If the HA header rendered/settled *after* the card's first paint, or the dashboard's edit-mode bar appeared/disappeared, the card's top offset (or the space below it) shifted without the card itself changing size — so the pinned height went stale and the page picked up real, unwanted scroll.
- The card now also watches `document.body` with a `ResizeObserver`. When the page can actually scroll, `body`'s own content box grows or shrinks by that same amount (that's *why* the scrollbar shows up), so this reacts to the real cause — header settling, tabs appearing, the edit-mode bar — the moment it happens, with no polling and no risk of jank during the room-swipe gesture.

## [4.5.0] - 2026-07-11

### Home Assistant's own preview now follows the edited room (`url_sync`)

- **HA's native right-side preview tracks the room you're editing.** When `url_sync` is enabled, the editor now writes the `#room=…` hash (and fires `hashchange`) for the room being edited — on open and whenever you change the room picker. HA's own preview card reads `url_sync`, so it switches to that room instead of showing the first room / live-presence room. This automates the manual "scroll back and forth to restore `#room=…`" workaround, and also restores the hash after HA strips it on save. Requires `url_sync` (there's no other channel into HA's preview); the Drag-edit preview and the editor's room scoping work regardless.

## [4.4.0] - 2026-07-11

### Fix: editor now reliably opens on the room you were viewing

- **The editor-opens-on-viewed-room feature actually works now.** In 4.3.0 the card recorded its current room on *every* render. When Home Assistant enters edit mode it recreates the dashboard card (resetting it to the first room), and that fresh render overwrote the remembered room with room 0 *before* the editor read it — so the editor kept opening on the first room. The card now records the room **only when you actively switch rooms** (nav thumbnails, swipe, wheel, presence-follow), so the value survives HA's edit-mode recreation and save. Still works without `url_sync`, with the URL hash as a fallback.
- The **Drag-edit preview** (header checkbox) already follows the room picker — selecting a different room to edit re-renders the preview for that room, so you can see what you're editing. (Home Assistant's own right-side preview pane follows live presence and can't be steered.)

## [4.3.0] - 2026-07-11

### Light-controls height parity + reliable editor-opens-on-room

- **Toggle pills now match the slider height.** A `switch` pill and a `light` slider given the same height rendered at slightly different heights, because `material-slider-card` renders its own box around the configured pixel value. The toggle pill now measures the actually-rendered slider and matches it, so a mixed row (e.g. `Světlo` slider + `Zrcadlo` switch) lines up. When a row has no sliders, the toggles use the configured height directly.
- **Height field is now clearly general.** The Light-controls editor field is relabeled **"Control height — sliders & switches (px, vh, %, per-tier)"** — one setting drives the height of every control element in the strip (it always did for switches; the label now says so).
- **"Editor opens on the viewed room" no longer depends on the URL hash.** Home Assistant strips the `#room=…` hash when it enters edit mode (it navigates to `?edit=1`) and again on save, which made the v4.2.0 hash-based approach unreliable (you had to scroll to restore the hash). The card now records the room it's showing in an in-memory store (keyed by `card_id` / image), and the editor reads that on open. This survives the edit toggle and save, and works **without** `url_sync`. The URL hash remains a fallback.

## [4.2.0] - 2026-07-11

### Editor opens on the room you were viewing

- **The config editor now opens scoped to the room the card was showing** (requires `url_sync`). The card already writes the active room to the URL hash when you switch rooms; the editor now reads that same hash on open, so clicking *Edit* while looking at e.g. `Hall` opens the editor with Hall selected — the room picker and the drag-edit preview (with Hall's background image) follow. It's a one-time read on open, so manually changing the room picker afterwards still takes over, and a `hashchange` while editing won't move you. Without `url_sync` the editor opens on the first room as before. Card and editor are separate elements, so the URL hash is the shared channel; HA's own right-side preview pane still follows live presence and is not affected.

## [4.1.0] - 2026-07-11

### Light controls — switch support + editor gradient preview

- **On/off entities are now supported in `light_controls`.** Previously every entity was mounted as a `material-slider-card` with `control_type: light`, which only works for `light.*` (brightness). Now the domain is detected per entity: `light.*` still renders the brightness slider, while on/off entities (`switch.*`, `input_boolean.*`, `fan.*`, `script.*`, …) render as an **on/off toggle pill** that shares the same rounded shape, height, `bg_off` background and the lux-driven border ring. Tapping a pill calls `homeassistant.toggle`; when the entity is on it fills with the current lux-ring colour and switches the icon (`mdi:power` / `mdi:power-off`). No config change is needed — just add a `switch.*` (or any on/off entity) to `light_controls.entities`.
- **Editor: live gradient preview under the lux settings.** The Light controls editor section now shows a preview bar of the configured border-colour gradient, sampled from the *same* HSL ramp the sliders use (`lcBorderColor`), with tick marks at **¼, ½, ¾** and end labels `0 lx … <lux_max> lx`. It repaints live as you drag the low/high colour pickers or change `lux max` — no save/re-render round-trip.
- **Editor copy** for the Light controls section updated to reflect that both lights and switches are accepted (`+ Entity` button, `light.bedroom_1 · switch.lamp` placeholder, section title "Light & switch controls — sliders / toggles").

## [4.0.0] - 2026-07-10

### BREAKING — layout engine rebuild (see LAYOUT.md)

- **Two layout profiles — `portrait` / `landscape` — replace the 4-tier width system** (mobile/tablet/desktop/ultrawide). The profile is chosen by the **shape of the available viewport** (w/h ratio vs `layout.threshold`, default 1.0), not by device type; rotating a tablet switches profile automatically. Force with `layout.orientation`, or pin per device via `layout.orientation.by_browser` (browser_mod ID, GUI: "Pin THIS device").
- **% grid layout**: each profile defines `columns` / `rows` in % of the available screen and places regions (`nav`, `cards_above`, `image`, `lights`, `cards_below`, `cover`) into cells (`row`/`col`, spans like `1/6`, `overflow`, `align`). A region not placed in a profile is hidden. The user owns the percentages (Σ ≤ 100).
- **Root height**: `layout.height: viewport` (default — full view minus HA header, real top offset measured), `container`, or a fixed CSS length. Designed for panel-view dashboards.
- **Image region inverted**: the grid gives the image a fixed box; the image renders at its design aspect with `image_fit: cover|contain` (per-profile capable). Element % positions stay glued to the image — the v3 lock_aspect cover-stage now runs always, with its own ResizeObserver on the region.
- **Cover control placement per profile**: `control.placement` accepts `{portrait, landscape}` with `off | float | dock`. `float` = v3.3.0 tap-reveal overlay; `dock` = permanently visible in the `cover` grid region — orientation (vertical rail vs horizontal bar) follows the region's own shape.
- **Removed**: tiers `tablet`/`ultrawide`, `breakpoints`, `mobile_breakpoint`, `nav.auto_breakpoint` (`position: auto` → `top`), `max_height` (use the image region's %), tier lists in strip `media:` (now `all | portrait | landscape`).
- **Auto-migration**: configs without `layout:` are converted in memory on load — `mobile`→`portrait`, `desktop`→`landscape`, `tablet`/`ultrawide` dropped (per-element blocks cleaned), scalars (`aspect_ratio`, `border_radius`, `light_controls.height`) remapped, a starter `layout:` generated mirroring the old stacked look (side nav becomes a landscape column). The editor shows a banner with **Save migrated config**.
- **Editor**: Responsive tab → **Layout tab** (height source, orientation, threshold, per-device pin, gap, both profile grids with per-region row/col/scroll), per-profile inputs for `aspect_ratio` / `border_radius` / `image_fit`.
- **Test mode**: region outlines + name tags, live viewport×profile badge, and a **profile switch button** (⇅) to preview the other profile; FLIP (day/night filters) unchanged.
- Swipe ghosts render the image region only and fill the image box (no layout recursion inside the drag preview).
- **Empty placed regions render nothing** — rooms can share a grid cell (e.g. `cards_above` + `lights` on one row when no room has both) and `auto` rows/columns collapse to 0 in rooms without that content. Test mode still outlines the empty cell (non-interactive).
- **Rows pack from the top** (`align-content: start`) — leftover height stays at the bottom instead of being distributed into `auto` rows as ugly gaps (rows summing to <100 % are fine).
- **Intrinsic image row**: when the image region sits on an `auto` row, the image box sizes itself from the design aspect (CSS `aspect-ratio` on `.wrap`, refined to the image's natural ratio under `lock_aspect`) — exact fit, no crop, no letterbox; strips above/below hug the image.
- **Dock orientation is derived from the grid definition** (`rocCoverHoriz`), not from measuring the box — `auto` tracks size to content, so measuring was circular (a vertical rail kept its row tall → stayed vertical at the bottom). One full-width row → horizontal bar; side column / row span → vertical rail; `place.cover.direction: horizontal|vertical` overrides. Multiple docked bars stack (`.roc-ccdock.ccd-h`).

## [3.3.0] – 2026-07-08

### Added
- **Cover control (roleta) — interactive GUI for `cover` entities, built on the
  existing `blinds` element.** A `blind` can carry a `control:` block that turns
  its visual overlay into a slim, **icon-only** controller: a draggable position
  rail (`cover.set_cover_position`, throttled + live), up / stop / down buttons,
  and quick-jump **presets** (position + icon + colour) — each a single icon; the
  `name` is a tooltip only. Up/Down do a full travel (`open_cover` /
  `close_cover`); `Stop` (`stop_cover`) highlights while the cover is moving. The
  controller is **hidden until you tap the window** (the blind graphic), and only
  one shows at a time. Two placements per blind: `placement: float` — placed
  freely via `top` / `left`, sized to the window height — or `placement: dock` —
  a slim rail pinned to the image edge (`dock_side: left | right`) filling the
  full height. On the `mobile` tier the controller flips to a **horizontal bar at
  the bottom**, and `touch-action: none` keeps drags from leaking to the room
  swipe / page scroll. Covers with no `current_position` (assumed-state) hide the
  rail and keep the buttons + presets. Preset colours accept HA names (`indigo`,
  `amber`, `blue-grey`, …) or any CSS colour. The editor’s *Elements → Blinds*
  section gained a **Control** sub-panel (placement, float top/left/width, dock
  side, slider, preset rows). Backward compatible — a blind with no `control:`
  renders exactly as before — and the control is stripped from room-swipe
  neighbour previews.

```yaml
blinds:
  - id: bedroom_roller
    entity: cover.roller_motor_bedroom
    top: 6%
    left: 8%
    width: 22%
    height: 30%
    blind_type: roller
    control:
      placement: float        # float (place via top/left) | dock (edge rail)
      top: 12%                # float position (sized to the window height)
      left: 34%
      dock_side: right        # left | right   (dock only)
      slider: true
      presets:
        - {position: 100, icon: mdi:blinds-open,         color: amber,     name: Open}
        - {position: 65,  icon: mdi:blinds,              color: orange,    name: Day}
        - {position: 2,   icon: mdi:roller-shade,        color: blue-grey, name: Peek}
        - {position: 0,   icon: mdi:roller-shade-closed, color: indigo,    name: Closed}
```

---

## [3.2.3] – 2026-07-08

### Fixed
- **`light_controls` sliders were dragged with the image during room swipes.**
  The light-controls strip is room-scoped (in `ROOM_KEYS`), so the neighbour-
  preview ghost pulled its own `light_controls` from `rooms[idx]` and rendered
  them over the sliding image — the sliders slid in with the swipe instead of
  staying put (the same class of bug previously fixed for `cards_above` /
  `cards_below`). `_renderNeighbourPreview` now strips `light_controls` from the
  ghost config (top-level and per-room), so during a swipe only the room image
  and its in-image elements move; the sliders are recomputed after the swipe
  commits.

---

## [3.2.2] – 2026-07-08

### Fixed
- **HACS validation failed — repository had no `LICENSE` file.** Added the MIT
  `LICENSE` file in the repo root (the licence was already declared in
  `package.json` and the source header, but HACS validates the actual file).

### Changed
- **Editor *Elements* tab — readability pass.** Section headers are now sorted
  alphabetically, each carries a Material icon, and the title/description are
  split into a bold name + muted subtitle with the item count shown as a pill
  badge (greyed out when the section is empty). The *Image* tab sections got the
  same treatment.

---

## [3.2.1] – 2026-07-08

Follow-ups to the `light_controls` feature shipped in 3.2.0.

### Fixed
- **`bg_off` (off-state slider background) never applied.** It was set as an
  inline CSS variable, which `material-slider-card`'s `colorize` overrode — the
  slider background stayed the card's default instead of the configured colour.
  The pill shape, background and lux-ring border colour are now injected into the
  slider's shadow root as an `!important` stylesheet (the same technique as the
  `card_mod` this feature replaced), so `bg_off` takes effect and the ring colour
  stays authoritative over the card's own inline styles.

### Added
- **`light_controls.height` accepts screen-relative and per-tier values.** Besides
  a plain px number it now takes a viewport unit (`4vh`, or `5%` of the screen
  height) or a per-tier object (`{mobile, tablet, desktop, ultrawide}`,
  nearest-smaller fallback), resolved to px at render via the card's responsive
  tier system — a fixed px looked tiny on desktop, `4vh` scales across screens.
  The editor's *Slider height* field is now a text input that also accepts a
  per-tier flow map, e.g. `{ mobile: 20, desktop: 60 }`.
- Smoke tests for `lcResolveHeight` (units + per-tier) and `lcSliderCss`.

---

## [3.2.0] – 2026-07-07

### Added
- **`light_controls` — GUI light sliders with a lux-driven border ring.** A new
  room-scoped key renders a strip of `material-slider-card` sliders above the
  image, one per light, whose border colour tracks a lux sensor: a smooth HSL
  gradient between two configurable anchor colours (dark = low lux, bright =
  high lux). This replaces the hand-written `card_mod` + Jinja template — the
  ring colour is computed in JS and applied through the card's own CSS variables,
  so it needs no `card_mod` and recomputes cheaply (one HSL calc, applied only
  when the colour actually changes; the lux sensor rides the standard
  change-detection path). Fully configurable from the editor: add/remove lights
  (each with an optional name), columns, slider height, lux sensor, `lux_max`,
  the two anchor colours and the off-state background.
  - New editor section under the **Elements** tab: *Light controls*.
  - Helpers `rgbToHsl`, `toHslParts`, `lcBorderColor`, `lcNormEnts`; the default
    anchors reproduce the previous card_mod gradient (hsl 250→45) almost exactly.
- Smoke tests for the light-controls colour maths and entity normalisation.

---

## [3.1.0] – 2026-07-03

### Added
- **`nav.live: composite` — live mini-room thumbnails** (Phase 1 of the v3.1
  mini-room vision). Nav thumbnails become true miniatures of each room: the
  room's currently **active overlay images** are stacked over its base image
  (top-most z on top), the **conditional base image** is resolved the same way
  as on the main card, and the thumb filter now supports **`brightness_model`**
  (smooth day/night) in addition to `filter_conditions`. Pure CSS background
  compositing — no extra card instances, timers or template subscriptions.
  - Binary approximation: an overlay shows when its opacity resolves > 0.
  - Grouped (pop-up panel) and `visible_template`-driven overlays are skipped.
  - Change detection extended: other rooms' overlay/base/brightness entities
    (incl. attribute sources) feed the cheap nav-only refresh path from v3.0.7.
  - Editor: new **Live thumbnails** select in *Rooms & menu → Navigation menu*.
- Smoke tests for the extracted `bmFilter()` helper (brightness model → filter).

### Changed
- The main card's brightness-model filter computation was extracted into the
  shared `bmFilter()` helper (behaviour unchanged).

Phase 2 (`nav.live: full` — scaled real card instances with gauges/labels/blinds)
stays on the roadmap.

---

## [3.0.7] – 2026-07-02

Full-code-review release — every change traces to a finding in `ANALYSIS_v3.0.6.md`.

### Fixed
- **Per-room `base_camera` never refreshed** (A1). `_startCamera()` read the
  top-level config, but `base_camera` / `camera_refresh` are room-scoped keys —
  a camera defined inside `rooms[i]` never started its refresh timer (and the
  room showed no background at all without a `base_image`). The camera loop now
  uses the merged active-room view.
- **Keyboard focus was invisible on zones** (A2). Zones hard-coded
  `outline:none`; a `:focus-visible` outline (primary color) is now shown on
  zones, icons, labels and gauges when navigating by keyboard. Touch/mouse look
  is unchanged.
- **Test-mode resize was mouse-only** (A5). Resize handles now use Pointer
  Events, so zones/elements/gauges can be resized by touch on tablets.
- **Element ids and image URLs were interpolated unescaped** (A4). Ids are now
  escaped consistently in generated HTML and via `CSS.escape` in selector
  lookups; base/overlay image URLs escape quotes for `url('…')`. `setConfig`
  warns once when an id contains characters outside `A-Za-z0-9_-`.
- **Embedded cards went stale off-screen** (A6). `hass` is now forwarded to
  embedded cards (elements, nav cards, companion strips) even while the card is
  outside the viewport, so they're current the moment it scrolls back.
- **Numeric `aspect_ratio` was silently ignored** (A7). `aspect_ratio: 1.78`
  (number or numeric string, incl. per-tier values) now works everywhere —
  wrap padding, `max_height` cap, nav thumb ratio and `lock_aspect`.
- **Climate sliders could request absurd temperatures** (A8). Slider min/max
  now default from entity attributes (`min_temp`/`max_temp` for climate,
  `min`/`max` for number) before falling back to 0–100.
- **A tap after a cancelled room swipe was swallowed** (A9). The drag
  suppression flag resets on `pointercancel`.
- **Swipe ghost churn** (A10). The neighbour-preview card instance no longer
  opens `render_template` subscriptions or camera timers (it lives < 0.5 s).
- **Stale async card mounts** (A11). Card-helper callbacks from an outdated
  render bail out via a render-generation counter instead of pushing orphaned
  elements that kept receiving `hass` forever.
- **`navigate` action** now also fires HA's canonical `location-changed` event
  (popstate kept for compatibility) (B).
- **Unquoted Jinja in YAML textareas** is kept as a plain string by the
  built-in parser instead of being mangled into an inline map (B).

### Changed
- **Change detection is now scoped to the active room** (D1). Entities that only
  drive other rooms' nav thumbnails/chips trigger a cheap nav-only refresh
  instead of the full update pass — a real win on large multi-room configs with
  busy sensors.
- **Overlays no longer force permanent GPU layers** (D2). Removed the blanket
  `will-change:opacity,transform` + `translateZ(0)` from overlay layers;
  browsers promote layers automatically during the opacity/filter transitions.
- **Image preload is staged** (D3). The active room + swipe neighbours load
  immediately; remaining rooms of large configs load on browser idle time.
- **Editor performance & output** (D4–D6): the entity datalist is cached instead
  of being rebuilt on every editor render; clones use native `structuredClone`;
  the editor no longer writes default values into saved YAML
  (`filter_transition: 2s ease`, `test_mode: false`, gauge/blind `min: 0` /
  `max: 100`, icon `size: 20px`, empty element arrays).
- **Dead code removed** (C1–C2): `mApply()` helper and the unused `_mobActive`
  flag.

### Added
- **Slider value bubble** (E2). Zone sliders show a live readout while dragging
  ("72 %", "21.5 °") — the fill alone was hard to read precisely.
- Smoke tests for the new pure helpers (`rocRatio`, `escSel`, Jinja YAML guard).

### Not done (by decision)
- A3 (keyboard access for badges) — declined as impractical in real use.
- B window.confirm styling and the editor's length-only staleness check stay
  as documented trade-offs.

---

## [3.0.6] – 2026-06-20

### Fixed
- **Quick flash on the left edge after swiping to the next room (mobile).** On
  commit, `_switchRoom` laid a crossfade clone of the old room on top and faded
  it out. With `lock_aspect` the content is a cover-stage wider than the visible
  box, so the clone's translate didn't push it fully off-screen and a sliver
  flashed on the left. The swipe commit now re-renders **without** that crossfade
  clone — the drag preview already covers the transition — so there's no flash.
  Nav / wheel / presence room changes keep the crossfade as before.

---

## [3.0.5] – 2026-06-20

### Fixed
- **Finger-swipe between rooms dragged the incoming room's companion cards.** The
  neighbour preview is a full card instance; it stripped the top-level
  `cards_above` / `cards_below` but not the **per-room** ones (they're room-scoped
  in `rooms[]`). So the incoming room pulled its own strips from `rooms[idx]` and
  rendered them above/below the preview image, and they slid in with it. The
  preview now strips `cards_above` / `cards_below` from **every room** too, so
  during the swipe only the room image moves; companion cards switch at commit.

---

## [3.0.4] – 2026-06-20

### Changed
- **Reverted the day/night blind to the original 3.0.0 model.** The rework in
  3.0.1 was based on a wrong mental model and didn't match real hardware; the
  3.0.0 two-layer rendering was the closest, so it's restored. Accurate day/night
  blind modelling stays an open item to revisit with a real-world reference.
  (Versions 3.0.2 and 3.0.3 were internal blind-model experiments, never
  released.)

### Fixed
- **Release workflow** — `action-gh-release` now passes an explicit `tag_name`,
  fixing the "GitHub Releases requires a tag" failure when publishing a release.

---

## [3.0.1] – 2026-06-20

### Fixed
- **Day/night blind animation drifted as it closed.** The `day_night` blind drew
  its stripes with two gradient layers, the second offset by
  `position × slat_count × (slat_pitch / 2)`. Because that offset is many times
  the tile size, the two layers' alignment wrapped around several times across
  the travel, so the bands visibly oscillated open/closed instead of closing
  once — plus a snap at exactly 100 %. The blind is now a **single, top-anchored
  striped layer** whose covered height tracks the position (Model A — a
  descending striped fabric): stripes stay put, the leading edge descends
  smoothly, and a fully closed blind shows exactly `slat_count` slats.
- New optional **`slat_snap: true`** rounds the covered height to whole slats, so
  the leading edge lands on a slat boundary instead of cutting one mid-band
  (off by default = smooth motion).

---

## [3.0.0] – 2026-06-20

The roadmap-completion release. Everything that used to be YAML-only in the
editor now has a proper GUI, the two image-filter systems are unified behind a
single mode switch, and the active room can be shared and bookmarked through the
URL. Fully backwards compatible with 2.x configs.

### Editor — GUI completeness
- **Navigation menu is fully editable in the GUI.** The old single `nav:` YAML
  textarea in *Rooms & menu* is replaced by structured fields: **style**,
  **position**, **height**, **item width**, **mobile height**, **auto
  breakpoint**, **wheel switch** and a **follow button** toggle. Chips and
  custom strip cards stay as YAML lists (they're arbitrary card/sensor configs),
  and invalid YAML in those two fields is now preserved instead of being wiped.
- **Dedicated per-tier inputs** for `aspect_ratio`, `border_radius` and
  `max_height` in the *Responsive* tab — one cell per tier
  (mobile / tablet / desktop / ultrawide) instead of having to drop to YAML to
  set an object. A single value still applies to all tiers; values follow the
  same nearest-lower-neighbour inheritance as before.
- **Unified image-filter section.** `filter_conditions` (discrete, first-match)
  and `brightness_model` (smooth interpolation from a sensor) used to be two
  separate sections — confusing, because at runtime `brightness_model` always
  wins. They're now one **Image filters** section with a **mode** switch:
  **Conditional** or **Smooth**. The switch is authoritative — saving keeps only
  the active mode and drops the other, so what you pick is what runs.
- **"Advanced" toggle.** Each element's raw per-item YAML textarea (the escape
  hatch for fields without a dedicated control) is now hidden behind a global
  **Advanced** checkbox in the editor header, so the common path stays clean.
- **URL-sync control.** New checkbox + optional key field in *Rooms & menu*
  (see `url_sync` below).

### New features
- **URL deep-linking — `url_sync`.** Opt-in. `url_sync: true` keeps the active
  room in the page URL as `#room=<id>` (set `url_sync: <key>` for a custom hash
  key). Rooms become **bookmarkable and shareable**: opening a URL with
  `#room=bedroom` jumps straight to that room (and holds it against presence for
  `follow_hold`). Every room switch — swipe, wheel, nav, presence — rewrites the
  hash, and the card reacts to back/forward navigation and manual hash edits.
  The room value matches a room `id`, `name` or `area_match`. Off by default; the
  editor and drag previews never touch the dashboard URL.
- **Full-room finger-drag preview.** While you drag between rooms, the incoming
  neighbour is now a **fully rendered room** — background, brightness/darkness
  filters, overlays, icons, gauges and live entity states — instead of just the
  static base image. Falls back to the base image if a preview instance can't be
  built.
- **Conditional follow button.** The nav **follow button** now appears only on
  devices that actually resolve `room_entity` to a real presence sensor via an
  explicit `by_browser` / `by_user` mapping. Devices with no usable presence
  source (e.g. a laptop not in the Bermuda browser list) no longer show a button
  that can't do anything. A plain-string `room_entity` still applies everywhere.

### Compatibility
- Backwards compatible with all 2.x configs. The unified filter editor opens
  existing cards in the correct mode based on whether they have
  `brightness_model` or `filter_conditions`. `url_sync` is opt-in, so nothing
  changes unless you enable it.

---

## [2.2.0] – 2026-06-13

### Added
- **Mouse-wheel room switching** on desktop — `nav.wheel`:
  - `horizontal` (or `true`) — switch rooms with a **horizontal** scroll wheel
    (`deltaX`); recommended, since horizontal wheel doesn't scroll the page.
  - `vertical` — use the normal vertical wheel (`deltaY`) over the card.
  - `both` — whichever axis the wheel reports.

  One notch = one room (320 ms cooldown), wraps around, and counts as a manual
  switch (so `follow_hold` applies). `Ctrl`+wheel stays reserved for `zoom`,
  and the gesture is ignored while zoomed. `preventDefault` blocks the
  browser's horizontal back/forward swipe.

```yaml
nav:
  style: thumbnails
  wheel: horizontal     # horizontal | vertical | both
```

---

## [2.1.3] – 2026-06-13

### Fixed
- **Test-mode Save was intermittent.** It only searched for the card inside the
  view matching the current URL path — but navigating or switching rooms makes
  the URL point at a different view than the one the card sits on, so the save
  failed with “card not found” seemingly at random. Save now searches the
  **entire dashboard** (every view, section and nested stack/grid) and matches
  by `cfgKey` (your `card_id`), so it no longer depends on which view the URL is
  on. Error messages are clearer (`card not found in dashboard` /
  `N matching cards — set a unique card_id`). **Tip:** keep a unique `card_id`
  set for rock-solid matching.

---

## [2.1.2] – 2026-06-13

### Fixed
- **`lock_aspect` did nothing in multi-room cards (vertical drift).** Image
  measurement only looked at the root config's `base_image`, but in multi-room
  every background lives inside `rooms[]` — so no aspect was ever detected,
  `lock_aspect` silently fell back to the default crop, and elements drifted
  vertically across tiers (covers/blinds too tall on mobile, too low on
  ultrawide). The card now measures the background (and overlay) images of
  **every room** up front, so `lock_aspect: true` locks each room to its own
  image. Single-room cards are unaffected.

---

## [2.1.1] – 2026-06-13

### Fixed
- **`lock_aspect: true` now detects each room's own image.** The natural-aspect
  auto-detection cached only a single image, so in a multi-room card where each
  room uses a different background (and the images have different resolutions),
  rooms other than the first kept drifting. The card now caches the natural
  aspect of every image separately (keyed by URL) and measures already-cached
  images synchronously, so each room locks to its own image. **For
  different-resolution images per room, use `lock_aspect: true`** (not a single
  explicit aspect, which can only match one of them).

---

## [2.1.0] – 2026-06-13

### Added
- **`lock_aspect` — keep overlays glued to the image across every tier.** With
  per-tier `aspect_ratio` the single source image is cropped differently on
  each device (`cover`), so percentage-positioned zones/icons/blinds drifted
  off their features. `lock_aspect` builds a fixed-design-aspect stage that
  *covers* the per-tier box and centers it; all elements live on that stage,
  so they stay locked to the image — per-tier `aspect_ratio` now only changes
  **how much** of the image is cropped, not **where** elements sit.
  - `lock_aspect: true` — design shape auto-detected from the base image's
    natural dimensions.
  - `lock_aspect: "1720/968"` — pin an explicit design aspect (your source
    image's real W/H), useful with `base_camera` or when you want a specific
    frame.
  - Off by default; existing cards are unchanged. New field in the editor's
    **Responsive** tab.

```yaml
breakpoints: {mobile: 600, tablet: 1281, desktop: 1925}
aspect_ratio:
  mobile: 1720/914
  tablet: 1720/807
  desktop: 1720/668
  ultrawide: 1720/670
lock_aspect: 1720/968        # ← elements now stay put across all four
```

---

## [2.0.0] – 2026-06-13

The "one card rules them all" release — responsive across phone, tablet, desktop
and ultrawide from a single card, plus a fully reorganised tabbed editor.

### Highlights (since 1.12)
- **Responsive tiers.** A four-tier system (`mobile` / `tablet` / `desktop` /
  `ultrawide`) driven by the card's own width. Per-element `tablet:` / `desktop:` /
  `ultrawide:` override blocks (joining `mobile:`), per-tier `aspect_ratio` /
  `border_radius` / `max_height`, and configurable `breakpoints`. One card adapts
  everywhere — no more maintaining a separate card per device.
- **`max_height` height cap.** Stops the image growing too tall on wide screens —
  caps the height and centres the box (letterbox), keeping element positions valid.
- **Tabbed editor.** The old wall of accordions is now four tabs — **Image**,
  **Elements**, **Responsive**, **Rooms & menu** — with a persistent header holding
  the room picker, Test mode and the Drag-edit preview. First-run onboarding guides
  you to set a background before the rest of the editor appears.
- **Drag-edit preview** follows the selected room and lets you drag/resize elements
  right in the editor.
- **Hold-gesture feedback.** Elements with a `hold_action` show a progress ring that
  fills and turns green when the hold registers.
- **GUI for more things.** Breakpoints, companion cards (`cards_above` /
  `cards_below`), and room reordering are now editable in the GUI instead of YAML.
- **Test-mode size readout.** A live width + active-tier badge to help tune
  breakpoints on each device.

### This release also adds
- **Cleaner test mode** — resize handles now appear only on the element you've
  selected (click to select), instead of on every element at once. Embedded cards,
  zones and gauges are all click-to-select; arrow keys nudge the selection.

### Compatibility
- Backwards compatible with 1.x configs: existing `mobile:` blocks and
  `mobile_breakpoint` keep working.

---

## [1.15.2] – 2026-06-13

### Added
- **Companion cards in the GUI** — the Image tab now has *Cards above image* and
  *Cards below image* YAML fields. Paste a card config you built elsewhere to stack
  full Home Assistant cards above/below the room image (handy on mobile). Per room;
  each list item is a card config, or `{card, height, media}`
  (`media: all|mobile|tablet|desktop|ultrawide`). Previously `cards_above` /
  `cards_below` were YAML-only with no editor field.

### Changed
- **Clearer room-icon label** — the per-room *Room icon* field now states it's
  only shown when the nav style is `tabs` (it doesn't appear with the default
  `thumbnails` navigation, which uses the room image instead).

### Fixed
- **Drag-edit preview now follows the selected room** — the in-editor preview used
  to always show the default/last room (e.g. living room) regardless of which room
  you were editing. It now renders the room picked in the header and stays on it
  (presence-following is disabled inside the preview). Renamed "Interactive
  preview" → "Drag-edit preview" with a tooltip explaining it's a live, draggable
  copy (and that the panel on the right is Home Assistant's own preview, which
  follows live presence and won't track the room selector).

### Added
- **Reorder rooms from the GUI** — move-up / move-down arrows next to + Room /
  Remove in the Rooms &amp; menu tab let you change room order (which is also the
  order of the thumbnail navigation) without editing YAML.

### Changed
- **Room picker, Test mode &amp; Interactive preview moved to a persistent header**
  — the active-room dropdown now lives at the top of the editor (visible on every
  tab), so you can switch which room you're editing without leaving the Image or
  Elements tab. Test mode and Interactive preview sit next to it.
- **Responsive tab now owns the image shape** — `aspect_ratio`, `border_radius`,
  `max_height` and the breakpoint thresholds (incl. legacy `mobile_breakpoint`)
  all live together in the Responsive tab. The Image tab keeps just the
  background, filters, weather, filter-transition and zoom.
- **Removed the Code tab** — it duplicated Home Assistant's built-in "Show code
  editor". Editor is now four tabs: Image / Elements / Responsive / Rooms &amp; menu.

### Notes
- Remaining v1.15.x editor work: a proper GUI block for the menu/nav strip
  (currently still YAML), plus optional per-tier inputs for aspect ratio.

### Changed
- **Editor is now tab-based** — the grouped sections moved into five top tabs:
  **Image** (background, filters, brightness), **Elements** (zones, icons, labels,
  badges, gauges, blinds, embedded cards, overlays, groups), **Responsive**,
  **Rooms &amp; menu** (room list, presence, nav strip), and **Code**. Switching
  tabs no longer scrolls a long wall of accordions, and your active tab is kept
  while you work. The first-run onboarding (set a background first) is unchanged.

### Added
- **Responsive tab** — set the tier breakpoints (mobile / tablet / desktop upper
  bounds in px) directly in the GUI instead of YAML, with a reminder that tiers
  follow the card's own width and that Test mode shows a live width + tier badge.
- **Code tab** — a read-only preview of the full card config as YAML.

### Notes
- This supersedes the 1.14.0 accordion grouping with the tabbed layout agreed for
  the v1.14 editor pass. Per-tier `aspect_ratio` / `max_height` GUI fields and a
  dedicated menu/nav editor are coming in the next iterations.

### Changed
- **Editor restructured into four groups** — the flat wall of ~14 accordions is
  now organized under labelled headings: **Start here** (Background &amp; basics),
  **Lighting &amp; atmosphere** (filters, brightness model), **Elements** (zones,
  icons, labels, badges, gauges, blinds, embedded cards, overlays) and
  **Advanced** (element groups, multi-room). Background is first and open by
  default; multi-room and groups moved to Advanced.
- **Clearer section names** — each element section now says what it is at a
  glance ("Zones — invisible tap areas", "Icons — state-aware mdi icons",
  "Labels — entity values as text", …) instead of bare jargon.

### Added
- **First-run onboarding** — a brand-new card (no background, no elements) now
  opens to a single focused step: set a background image (or camera), with a
  short hint to enable Interactive preview and drag elements on. The full grouped
  editor appears automatically once a background is set.

---

## [1.13.5] – 2026-06-13

### Fixed
- **Per-tier values now apply in test mode** — `test_mode` disables per-element
  tier overrides (so dragging always edits the base), but it was also forcing
  per-tier *scalars* (`aspect_ratio`, `border_radius`, `max_height`) to the
  desktop value. So on an ultrawide screen the test-mode readout correctly said
  `ultrawide` while the card still rendered the desktop aspect ratio. These
  scalars now follow the actual detected tier even in test mode, and crossing a
  tier boundary while resizing in test mode re-renders to pick up the new value.
  Live (non-test) rendering was already correct.

---

## [1.13.4] – 2026-06-13

### Added
- **Test-mode size readout** — enabling `test_mode` now shows a small badge in
  the top-left corner with the card's current width in pixels and, below it, the
  responsive tier that width maps to (mobile/tablet/desktop/ultrawide). It
  updates live as the card resizes, so you can read the exact width on each
  device and set `breakpoints:` to match. Note the tier is detected from the
  card's own width (its dashboard column), not the device screen resolution.

### Docs
- Tier thresholds are configurable via a top-level `breakpoints:` map, e.g.
  `breakpoints: { mobile: 600, tablet: 1024, desktop: 1600 }` (each value is the
  exclusive upper bound; `ultrawide` is the rest). Legacy `mobile_breakpoint`
  still overrides the mobile bound.

---

## [1.13.2] – 2026-06-13

### Added
- **Hold gesture feedback** — elements with a `hold_action` now show a circular
  progress ring while you press. It fills over the hold delay and turns green
  the moment the hold registers, so you know you've held long enough (no more
  guessing). A short grace period keeps quick taps from flashing the ring.
  Opt out globally with `hold_feedback: false`; customize via `hold_color`
  (in-progress ring) — the "registered" colour is green by default.

---

## [1.13.1] – 2026-06-13

### Added
- **Responsive tiers** — the single binary mobile/desktop profile is now a
  four-tier system driven by the card's own width (container width, not the
  viewport — correct for HA dashboard columns): `mobile` (`< 600px`),
  `tablet` (`600–1024px`), `desktop` (`1024–1600px`) and `ultrawide`
  (`≥ 1600px`). One card now adapts to phone, tablet, PC and ultrawide
  without maintaining separate cards.
- **Per-element tier overrides** — every element (zones, badges, icons,
  labels, gauges, blinds, embedded cards) accepts `tablet:`, `desktop:` and
  `ultrawide:` override blocks in addition to the existing `mobile:`. Each
  block merges over the base element, so you only specify the deltas that
  differ on that tier:
  ```yaml
  - id: temp
    top: 10%
    left: 80%
    font_size: 2%
    mobile:    { top: 6%,  left: 70%, font_size: 4% }
    ultrawide: { top: 12%, left: 85%, font_size: 1.5% }
  ```
- **Per-tier `aspect_ratio` and `border_radius`** — these accept either a
  single value (as before) or a per-tier object. A missing tier falls back to
  the nearest defined tier (smaller first, then larger):
  ```yaml
  aspect_ratio: { mobile: 4/3, tablet: 16/10, desktop: 16/9, ultrawide: 21/9 }
  ```
- **Custom breakpoints** — override the tier thresholds with a top-level
  `breakpoints: { mobile, tablet, desktop }` (each value is the exclusive
  upper bound; `ultrawide` is the rest).
- **Strip media tiers** — `cards_above`/`cards_below` `media:` now also accepts
  individual tier names and comma lists (e.g. `media: tablet,ultrawide`)
  alongside the legacy `all` / `mobile` / `desktop` (`desktop` = any non-mobile).
- **`max_height` height cap** — optional per-tier ceiling for the image box. On
  wide screens (FHD/2K) a fixed aspect ratio makes the image grow tall with the
  card width; `max_height` caps the height and centers the box, letterboxing the
  sides instead. Accepts a single value or a per-tier object, e.g.
  `max_height: { desktop: 70vh, ultrawide: 80vh }`. The box keeps its aspect
  ratio, so all `%` element positions stay valid.

### Changed
- Tier changes (resize, rotation, moving the card to a different dashboard
  column) re-render the card automatically, just like the old mobile flip.

### Compatibility
- Fully backward compatible: existing `mobile:` blocks and `mobile_breakpoint`
  keep working unchanged (`mobile_breakpoint` overrides the mobile threshold).
- The GUI editor exposes per-tier `aspect_ratio`/`border_radius` and per-element
  tier blocks via YAML for now; a dedicated centralized "Responsive" panel with
  a tier switcher is planned for the next release.

---

## [1.12.2] – 2026-06-12

### Fixed
- **Mobile nav polish** — thumbnails on the wrapped mobile strip now use a
  fixed height (`nav.mobile_height`, default `48px`) instead of preserving
  the aspect ratio, so both sensor chips fit again (the image crops to cover).
  Embedded nav cards get `flex-basis: 0` on mobile, so the ticker always
  shares its row with the follow button and takes exactly the remaining
  space — no more orphaned third row.

---

## [1.12.1] – 2026-06-12

### Fixed
- **Mobile navigation strip** — on narrow cards the horizontal strip used to
  overflow (only ~3 room thumbnails visible, rest behind a scroll). Below
  `mobile_breakpoint` the strip now wraps: all room thumbnails shrink to fit
  on the first row (aspect ratio preserved via CSS `aspect-ratio`), embedded
  nav cards (e.g. an alert ticker) move to the second row and stretch, and
  the follow button sits at the very end. Desktop keeps the single row.

### Changed
- The follow button now renders after `nav.cards` (far end of the strip) on
  all screen sizes, for consistent ordering.

---

## [1.12.0] – 2026-06-12

### Added
- **Per-room companion strips** — new room keys `cards_above:` and
  `cards_below:` render full-width HA cards in normal document flow above and
  below the room image (inside the card, switching together with the room).
  Built for mobile, where positioned overlays get cramped. Entries are plain
  card configs or `{card, height, media}`; `media: all|mobile|desktop`
  (default `all`) shows an entry only below/above `mobile_breakpoint` — so
  you can keep elegant overlay panels on desktop and get stacked control
  strips on the phone, from one config.

  ```yaml
  rooms:
    - id: bedroom
      cards_above:
        - media: mobile
          card: {type: grid, columns: 3, cards: [...]}   # lights
      cards_below:
        - media: mobile
          card: {type: custom:bubble-card, ...}          # blinds
  ```

---

## [1.11.1] – 2026-06-12

### Fixed
- **Room swipe no longer hijacks gestures inside embedded HA cards** —
  horizontal drags starting on an `elements[]` card (bubble-card sliders,
  cover controls, maps…) are now left to the embedded card, same as slider
  zones. Swiping between rooms still works everywhere else on the image.

---

## [1.11.0] – 2026-06-12

Presence-follow polish: follow modes, a follow button, active-room state
mirroring, an in-editor device mapper, and a swipe-vs-tap fix.
Verified against Home Assistant 2026.6.

### Added
- **`follow_mode`** — `always` (default, continuous follow), `initial` (jump
  to the presence room only once when the card loads — then navigation is
  fully manual) or `manual` (presence never moves the card by itself; only
  the follow button / `follow-room` action do).
- **Follow button** — a crosshair button at the end of the nav strip jumps to
  the presence room and clears the manual-navigation hold. It lights up in
  the accent colour whenever you're viewing a different room than the one
  presence reports. Hide with `nav.follow_button: false`. Also available as
  an action: `{action: follow-room}` on any zone/icon/badge.
- **`room_state_entity`** — the card mirrors the active room into a writable
  helper (`input_text` or `input_select`), so automations and other cards can
  react to where you're looking. Accepts the same per-device mapping object
  as `room_entity` (each device mirrors into its own helper).
- **Editor: "Map this device"** — the Rooms section now shows the
  browser_mod ID of the device the editor is open on, with an entity picker
  and a one-click button that writes `room_entity.by_browser` for you. Open
  the editor on each device, pick its presence sensor, click — done. Plus
  GUI fields for `follow_mode` and `room_state_entity`.
- **`nav.cards` placement** — `placement: start` puts a custom card before
  the room thumbnails (default `end`).

### Fixed
- **Swiping that started on a clickable zone no longer triggers the zone's
  action** — zones fire on `touchend`, which the previous click-only
  suppressor couldn't catch; actions are now suppressed during a room drag
  and for 400 ms after it.

---

## [1.10.1] – 2026-06-12

### Fixed
- **Side-rail nav collapsed to a thin strip with `nav.width: auto`** — a
  vertical rail has no intrinsic width to stretch into, so `width: 100%`
  items made the whole rail collapse. With `position: left/right/auto`,
  `width: auto` now falls back to the aspect-derived thumbnail width
  (explicit CSS widths keep working). Horizontal strips are unaffected.

---

## [1.10.0] – 2026-06-12

Per-device presence follow and nav chip styling.
Verified against Home Assistant 2026.6.

### Added
- **Per-device / per-user `room_entity` mapping** — `room_entity` now also
  accepts an object, so every device follows *its own* Bermuda sensor:

  ```yaml
  room_entity:
    default: sensor.phone_alice_area
    by_user:                      # matched against the logged-in HA user
      Alice: sensor.phone_alice_area
      Bob: sensor.phone_bob_area
    by_browser:                   # matched against browser_mod browser ID
      wall_tablet_living: sensor.phone_alice_area
  ```

  Resolution order: `by_browser` (exact browser_mod ID) → `by_user`
  (case-insensitive HA user name) → `default`. All mapped entities are part
  of change detection; manual-switch write-back targets the resolved entity.
  The editor field shows a hint and defers to YAML when a mapping is active.
- **Nav chip styling** — chips accept optional `background`,
  `border_radius`, `padding`, `border` and `font_size`, e.g. pill style:

  ```yaml
  nav:
    chips:
      - entity: sensor.{room}_temperature
        decimals: 1
        suffix: "°"
        background: "rgba(0,0,0,0.55)"
        border_radius: 8px
        padding: 1px 6px
        color_gradient: [...]
  ```

---

## [1.9.0] – 2026-06-10

Multi-room navigation strip customization. Verified against Home Assistant 2026.6.

### Added
- **`nav.width`** — item width in the navigation strip: any CSS size
  (e.g. `120px`), or **`auto`** to stretch room thumbnails/tabs evenly across
  the full available width. Default stays height × aspect ratio. In a side
  rail, `auto` makes items fill the rail width.
- **`nav.cards`** — embed arbitrary HA cards directly in the navigation strip
  (alert tiles, markdown, mushroom chips…). Entries are either a plain card
  config or `{width: 320px, card: {...}}`; without `width` the card flexes to
  fill the remaining strip space. Cards receive live `hass` updates and work
  in top/bottom strips as well as side rails.

```yaml
nav:
  style: thumbnails
  height: 64px
  width: auto                  # stretch thumbs across the strip
  cards:
    - width: 40%
      card:
        type: markdown
        content: >-
          💧 Zvýšená vlhkost v obýváku — {{ states('sensor.livingroom_humidity') }} %
```

---

## [1.8.0] – 2026-06-10

Final roadmap items: interactive preview inside the GUI editor, 3D parallax
tilt, a copy-paste preset gallery and HACS validation in CI.
Verified against Home Assistant 2026.6.

### Added
- **Interactive editor preview** — a checkbox at the top of the GUI editor
  mounts a live card instance with test mode forced on, directly inside the
  editor dialog: drag, resize, draw-to-create zones and keyboard-nudge there,
  with every change synced back to the form and the dashboard preview —
  **without ever enabling `test_mode` on the saved card**. The preview hides
  the Save button (the editor owns saving) and strips its forced flags from
  outgoing config updates.
- **3D parallax tilt** — `parallax: true` (or
  `{strength: 6, scale: 1.04, source: pointer|orientation|auto}`) tilts the
  scene toward the mouse on desktop and with device orientation where the
  platform allows it without a permission prompt. Pauses automatically during
  room drags; mutually exclusive with `zoom:`.
- **Preset gallery** — new `PRESETS.md` with copy-paste recipes: day/night
  filters, lux-driven dusk, weather moods, gauge palettes, dimmer zones, door
  portals, RGB glow via `color_from`, last-motion labels, Bermuda multiroom.
- **CI: HACS validation** — `hacs/action` job runs next to the smoke tests on
  every push/PR (groundwork for HACS default-repository submission).

---

## [1.7.0] – 2026-06-10

Multi-room phase 2 (adaptive navigation + finger-attached room drag) and a
complete snow rework. Verified against Home Assistant 2026.6.

### Added
- **Adaptive navigation position** — `nav.position` now accepts `left`,
  `right` and `auto` in addition to `top`/`bottom`. With `auto` the strip
  renders as a **vertical side rail** when the card is wider than
  `nav.auto_breakpoint` (default 1100 px) — on ultrawide screens the 16/9
  image doesn't fill the height, so the rail uses that dead space instead of
  eating vertical room; on narrow widths it falls back to the top strip.
  Flips live on resize/rotation.
- **Finger-attached room drag** — swiping between rooms is now a real
  filmstrip gesture: the room follows your finger, the neighbour's image is
  revealed alongside, release past 25 % of the width (or a quick fling)
  commits the switch, otherwise the room snaps back. Direction can be
  reversed mid-drag. Vertical page scrolling stays untouched
  (`touch-action: pan-y`), slider zones and zoomed state still own their
  gestures.

### Changed
- **Snow effect rebuilt** — the old snow was nearly invisible. Now three
  parallax layers of larger, soft-edged flakes (bright core + glow falloff)
  with opposing horizontal drift, seamless loops, and a denser/faster heavy
  tier for `hail`. Default opacity is now per-effect: snow 0.7, heavy snow
  0.8, rain 0.45, heavy rain 0.55, fog 0.5, lightning 0.6 (explicit
  `opacity:` still overrides).

---

## [1.6.0] – 2026-06-10

**Multi-room.** One card, your whole home: per-room configs, an auto-generated
thumbnail navigation strip with live filters and sensor chips, swipe and
door-zone navigation, and presence-driven room switching (Bermuda/BLE ready).
Fully backward compatible — without `rooms:` nothing changes.
Verified against Home Assistant 2026.6.

### Added
- **`rooms:` array** — each entry is a complete room config (`base_image`,
  `overlays`, `zones`, `gauges`, …) plus `id`, `name`, `icon`, `area_match`,
  `chips`. Top-level room-scoped keys act as shared defaults inherited by
  every room; card-level keys (`aspect_ratio`, `border_radius`, `zoom`,
  `mobile_breakpoint`, `haptic`) stay shared.
- **Auto-generated navigation** — `nav.style: thumbnails` (default) renders a
  strip of live room miniatures: each thumb shows the room's base image with
  its *active filter conditions applied* (night dim follows automatically)
  plus up to 3 sensor chips. `nav.chips` defines chips once for all rooms with
  a `{room}` placeholder (e.g. `sensor.{room}_temperature`), per-room `chips:`
  overrides. Styles: `thumbnails | tabs | dots | none`; `position: top|bottom`;
  `height`. Active room is highlighted; thumbnails are keyboard-accessible.
- **Room switching, four ways** — tap a nav thumbnail; **swipe** horizontally
  on the image (intent-detected, ignores slider zones, inactive while zoomed);
  **`switch-room` / `next-room` / `prev-room` actions** on anything clickable
  (doors on the floorplan become portals between rooms); or…
- **`room_entity:` presence follow** — point it at any entity whose state
  names a room (Bermuda trilateration area sensor, `input_select`, template
  sensor). The card follows it automatically; `area_match:` per room maps
  arbitrary state values (e.g. Bermuda area names) to rooms. Manual navigation
  takes priority for `follow_hold:` seconds (default 60). Writable entities
  (`input_select`/`select`) are synced back on manual switches — replaces
  browser_mod dashboard-switching scripts.
- **Animated transitions** — directional slide between adjacent rooms,
  crossfade for jumps; updates, template subscriptions, camera and tickers
  always run only for the active room.
- **`card_id:`** — explicit pairing key for editor/save/highlight matching;
  also lifts the old "two cards with the same base_image" limitation.
- **Editor: Rooms section** — room selector (all sections below edit the
  chosen room), add/remove room, id/name/icon/area_match/chips fields,
  room_entity + follow_hold + card_id + nav YAML, and a one-click
  **Convert to multi-room** migration for existing configs. Test-mode
  drag/resize/draw and Save write into the active room.

### Changed
- Smoke-test suite extended to 54 assertions (room merge, room matching,
  pairing keys, shared defaults).

---

## [1.5.0] – 2026-06-10

Layout & interaction release — the complete v1.5 roadmap: responsive mobile
position profiles, light-colour overlay tinting, draw-to-create zones,
pan & pinch-zoom floorplan mode, per-element fade/slide animations and
actions on gauges & labels. Verified against Home Assistant 2026.6.

### Added
- **Responsive mobile profiles** — every positioned element (zones, icons,
  labels, gauges, blinds, embedded cards, custom-positioned badges) accepts a
  `mobile:` block overriding `top`/`left`/`width`/`height`/`size`/`font_size`
  when the card is narrower than `mobile_breakpoint` (default 600 px). The
  card re-renders automatically when the profile flips on resize/rotation.
  Disabled in test mode, where dragging edits the desktop profile.
- **Light colour visualization** — `color_from: light.x` on an overlay tints
  the overlay image toward the light's current `rgb_color` (or
  `color_temp_kelvin`, converted via a Tanner-Helland approximation) using a
  computed sepia/hue-rotate filter chain. No more one PNG per colour.
- **Draw-to-create zones** — in test mode, click-drag on an empty area of the
  card sketches a rubber-band rectangle and creates a new zone with a unique
  id at that exact position, synced straight into the GUI editor.
- **Pan & pinch-zoom floorplan mode** — `zoom: true` enables two-finger
  pinch (1–4×), one-finger panning while zoomed, double-tap reset and
  Ctrl+wheel zoom on desktop. Taps and sliders keep working while zoomed.
- **Entrance/exit animations** — `fade: true` (or seconds) animates
  visibility changes of zones, icons, badges, labels, gauges and embedded
  cards; `slide: up|down|left|right` adds a 10 px directional slide.
  Works with `visible`, `visible_conditions` and `visible_template`.
- **Actions on gauges and labels** — `tap_action`, `hold_action` and
  `double_tap_action` are now supported on gauges (incl. radial) and labels;
  elements with actions become focusable buttons (Enter/Space work).
- **Editor** — new Basic settings fields for mobile breakpoint and
  pan & zoom; element/gauge/label YAML hints updated; `fade`/`slide`/`mobile`
  keys round-trip safely through the GUI editor.

### Changed
- Group fade now cooperates with per-element fade state (an element hidden by
  its own condition stays hidden when its group reappears).
- Smoke-test suite extended to 41 assertions (mobile merge, Kelvin→RGB,
  tint filter).

---

## [1.4.0] – 2026-06-10

Feature release delivering the complete v1.4 roadmap: templates on every
element type, relative-time labels, weather effects v2, snap-to-grid editing
with alignment guides, editor undo/redo, live icon previews and a CI test
suite. Verified against Home Assistant 2026.6.

### Added
- **`visible_template` on every element type** — zones, icons, badges,
  overlays, embedded cards, gauges and blinds can now be shown/hidden by any
  Jinja2 template, rendered live over the `render_template` WebSocket
  subscription. Takes precedence over `visible` / `visible_conditions` when
  both are set. Truthiness follows HA conventions (`false`, `off`, `no`, `0`,
  empty, `unknown` and `unavailable` hide the element).
- **`label_template` on badges** — badge chip text driven by a Jinja2
  template, same live mechanism as label templates.
- **Relative-time labels** — `format: relative` renders timestamps as
  localized relative time ("5 minutes ago" / "před 5 minutami") using
  `Intl.RelativeTimeFormat` in the dashboard language, refreshed every 30 s
  (paused while the card is off-screen). Works with `prefix`/`suffix`.
- **Weather effects v2** — new effects `fog` (drifting banks) and `lightning`
  (screen flash); `pouring` now renders denser, faster rain and `hail` dense
  snow via a new heavy tier; `lightning-rainy` combines rain + flashes. New
  `angle:` option tilts the rain direction (e.g. `angle: 115deg` for wind).
  Manual `effect:` accepts `rain`, `rain-heavy`, `snow`, `snow-heavy`, `fog`,
  `lightning`.
- **Snap-to-grid + alignment guides** — test-mode dragging snaps to a 0.5 %
  grid and magnetically aligns to the top/left edges of other elements, with
  live guide lines; hold **Alt** for free movement. Resize handles snap to the
  same 0.5 % grid.
- **Editor undo/redo** — 50-step history of every config change with ↶ / ↷
  header buttons and Ctrl+Z / Ctrl+Y (Cmd on macOS) shortcuts. Native
  text-field undo inside inputs is left untouched.
- **Live icon previews** — icon and badge `mdi:` inputs in the editor render
  the actual icon next to the field as you type.
- **CI test suite** — `tests/smoke.test.js` (34 assertions over the pure
  helpers: conditions, gradients, YAML parser round-trip, filters, template
  truthiness, relative time) + a GitHub Actions workflow running syntax check
  and tests on every push/PR. `npm test` runs them locally.

### Fixed
- Weather CSS could not previously express a flash overlay (`content` quoting
  in the embedded stylesheet) — caught by the new verification flow before
  release.

### Changed
- Editor weather effect selector offers the full v2 effect list.
- Embedded-card YAML textarea now round-trips `visible_template` correctly.

---

## [1.3.1] – 2026-06-10

### Fixed
- **Card no longer renders at the wrong height in sections view** — the
  `getGridOptions()` introduced in 1.3.0 declared a fixed `rows` count
  computed from an assumed card width. On wider dashboards the real card
  (whose height is driven by `aspect_ratio`) overflowed its grid cell, so
  following cards were laid out on top of it instead of flowing below.
  `rows` is now intentionally omitted, which per the HA docs makes the grid
  ignore row sizing and the card keep its natural aspect-ratio height
  (the pre-1.3.0 behaviour), while keeping the column defaults.

---

## [1.3.0] – 2026-06-10

Major release: bug-fix sweep from a full code audit, performance pass, editor
overhaul, and six new features. Verified against Home Assistant 2026.6.

### Added
- **Jinja templates on labels** — new `template:` option renders any Jinja2
  template live via the `render_template` WebSocket subscription. Replaces the
  entity value entirely; works with `color_gradient` (numeric results).
- **Slider zones** — new `slider:` option on zones: drag vertically or
  horizontally across a zone to set light brightness, cover position, fan
  speed, media volume, climate temperature or number value. Keys: `entity`,
  `direction`, `min`, `max`, `live`, `invert`, `color`. Shows a translucent
  fill while dragging; tap actions still work (drags are suppressed).
- **Radial gauges** — `orientation: radial` renders a circular SVG arc gauge
  with `arc` (degrees, default 270), `thickness`, optional `target` marker and
  full `color_gradient` support.
- **Camera background** — new `base_camera:` option uses a camera entity
  snapshot as the base layer, refreshed every `camera_refresh:` seconds
  (default 10, paused when the card is off-screen). `base_image` is now
  optional when `base_camera` is set.
- **Weather effects** — new `weather_overlay:` option renders an animated CSS
  rain/snow layer, driven automatically by a `weather.*` entity state or
  forced with `effect: rain|snow`. Configurable `opacity` and `z_index`.
- **Full action support** — actions now accept `target:` and `data:` for
  `call-service`, the HA 2024+ `perform-action` / `perform_action` aliases,
  `url` actions, `confirmation:` dialogs, and emit haptic feedback on the
  companion app (disable with `haptic: false` at card level).
- **Groups on overlays and zones** — `group:` is now supported on every
  element type, and group show/hide animates with a 0.25 s fade instead of an
  instant toggle.
- **Auto units on labels** — `suffix: auto` appends the entity's
  `unit_of_measurement` automatically.
- **`getGridOptions()`** — proper default sizing in sections-view dashboards,
  derived from the configured aspect ratio.
- **Card picker suggestion (HA 2026.6)** — the card suggests itself with a
  `base_camera` preset when a camera entity is selected in the card picker.
- **Editor: reorder buttons** (▲▼) on overlays, zones, badges, elements,
  icons, labels, gauges and blinds — overlay stacking order is finally
  editable without YAML.
- **Editor: live highlight** — opening an item panel in the editor flashes the
  corresponding element in the card preview.
- **Editor: version header** — the GUI editor now shows the installed card
  version; a version banner is also printed to the browser console.
- **Editor: new fields** — base camera + refresh, weather overlay,
  zone slider, zone group, overlay group, label Jinja template.

### Fixed
- **Group re-show left elements hidden** — badges, labels, gauges, blinds and
  embedded cards inside a group stayed invisible after the group was hidden
  and shown again unless they had their own `visible` condition.
- **`double_tap_action` without `tap_action` never fired** — the double-tap
  detector required a pending single-tap timer that only existed when a tap
  action was configured.
- **Dragging in test mode could be reverted by the next editor change** — the
  editor now re-renders its inputs after a position update from the card, so
  stale top/left values no longer overwrite the dragged position.
- **Attribute-based conditions didn't trigger updates** — conditions using
  `attribute:` anywhere (filters, overlays, visibility, badge labels/colors)
  are now part of change detection; previously only a state-string change
  re-rendered the card.
- **Embedded cards could render blank or freeze** — elements are now created
  through HA's official card helpers (`loadCardHelpers`), which resolves
  lazy-loaded `hui-*` cards and shows a proper error card on bad config; and
  `hass` is forwarded to embedded cards on every update so cards listing
  entities as plain strings (e.g. entities card) stay live.
- **Editor silently deleted config on invalid YAML** — YAML fields now keep
  the previous value and turn red when input can't be parsed. The editor also
  ships a built-in YAML parser/serializer, so YAML works even though HA
  provides no global YAML library (previously only JSON was accepted in
  practice).
- **Editor round-trip data loss** — unknown filter functions (`grayscale`,
  `invert`, `drop-shadow`, …) survive slider edits; keys removed from item
  YAML textareas are now actually removed from the config; clearing an
  overlay's conditions removes them; `rgba()` colors are no longer collapsed
  to opaque hex by the color pickers.
- **Cross-talk between two cards in test mode** — position updates and saves
  are matched to the editor by base image/camera; Save aborts with a clear
  message when two identical cards exist in the same view instead of
  overwriting the wrong one.
- **`%`-based label `font_size` now responds to card resizes** and no longer
  freezes at the initial render width.
- **Tapping a badge without `tap_action` no longer triggers the card-level
  `tap_action`.**
- **Stray tap after touch-dragging an element in test mode** is no longer
  swallowed permanently.
- Config values (ids, image URLs, icons) are HTML-escaped in the card markup.

### Changed / Performance
- Skip full re-render when `setConfig` receives an identical configuration
  (stops flicker while typing in the editor).
- Gradient stops are sorted once per render instead of on every state update;
  badge containers are cached; repeated style writes are guarded.
- Slider/gradient/color inputs in the editor are debounced (150 ms), so the
  preview no longer re-collects the whole form on every pixel of movement.
- Zones and icons with actions are keyboard-accessible (`Tab` + `Enter`/`Space`,
  `role="button"`, `aria-label`).
- Label/icon default colors are themeable via `--roc-label-color` /
  `--roc-icon-color` CSS variables.
- Editor inputs share a stylesheet class instead of repeating inline styles.

### Removed
- Stale `src/` TypeScript sources (frozen at ~v0.3), prehistoric `dist/`
  bundle (v0.2.0), `node_modules/`, `tsconfig.json` and `rollup.config.mjs`.
  The single source of truth is `room-overlay-card.js`; the dangerous
  `npm run build` scripts that would have overwritten it are gone.

---

## [1.2.9] – 2026-06-04

### Fix: Save now finds card in sections-layout views (HA 2024+)

HA 2024+ introduced a new `sections` view type (the default for new dashboards).
Unlike the classic `masonry` layout where cards live in `view.cards[]`, the
sections layout stores cards in `view.sections[].cards[]`.

The card search now walks both structures:
- `view.cards[]` — classic masonry/panel layout
- `view.sections[].cards[]` — sections layout (HA 2024 and newer)

This fixes the `card_not_found_in_view` error reported on dashboards using
the sections view type.

## [1.2.8] – 2026-06-04

### Improved: Save button diagnostics + hass.callWS fallback

- Uses `hass.callWS` (standard HA frontend method) with automatic fallback
  to `conn.sendMessagePromise` for compatibility.
- When auto-save fails, the overlay now shows the **exact error** in red below
  the header (e.g. `config_not_supported`, `card_not_found_in_view`, etc.)
  so it's clear whether the issue is YAML mode, permissions, or wrong view.

**Note:** If Lovelace is configured in YAML mode (`lovelace.yaml` /
`ui-lovelace.yaml`), `lovelace/config/save` is not supported by HA — the
overlay copy-paste workflow is the only option in that case.

## [1.2.7] – 2026-06-04

### Fix: Save button uses view-scoped search to handle duplicate cards

Searching the entire Lovelace config by `base_image` matched copies of the
same card in other views/dashboards (production, dev, backup tabs).

Fix: the current view is extracted from `window.location.pathname` and the
card search is scoped to that view only:

- `/lovelace/2` → looks in `views[2]` of the default dashboard
- `/my-dash/living-room` → dashboard `my-dash`, view with `path: living-room`
- Fallback to `views[0]` if no view segment in URL

This correctly distinguishes copies of the same card that live in different
views/tabs, even when they share the same `base_image`.

## [1.2.6] – 2026-06-04

### New: Save button writes directly to HA Lovelace storage

When `test_mode: true` and Lovelace is in storage mode (UI-managed), clicking
**💾 Save** now saves the card's current config directly to HA without any
copy-paste:

1. Fetches the full Lovelace config via `hass.connection.sendMessagePromise`
2. Locates the card by matching `type` + `base_image`
3. Replaces the card config with current positions
4. Saves the updated Lovelace config back to HA

On success the button shows **"✓ Saved!"** for 2.5 s.

**Fallback:** If Lovelace is in YAML mode, the card is not found (multiple
cards with the same `base_image`), or the connection is unavailable, the
config overlay (Ctrl+C copy) is shown instead with a console warning.

## [1.2.5] – 2026-06-04

### Fix: Save button now shows config overlay for reliable copy

`navigator.clipboard` is not available in all HA setups (HTTP, older browsers,
permission denied), so the previous clipboard-only approach silently did nothing.

Clicking **💾 Save** now toggles a dark overlay over the card with the full
config YAML in a read-only textarea — auto-focused and auto-selected so
**Ctrl+C** copies it immediately. The clipboard API is still attempted in the
background as a best-effort bonus. Close the overlay with ✕ or by clicking
outside it. Clicking Save again also closes the overlay.

## [1.2.4] – 2026-06-04

### Fix: Save button and roc-pos-update now work when test_mode is toggled in editor

Root cause: when test_mode is enabled via the checkbox in the GUI editor,
`setConfig()` is called but the `same` check skips `_render()` (no array
length changes). The `_rocPosHandler` window listener was only registered
inside `_render()`, so it was never set up in this case.

Fix: the test_mode checkbox listener in `_listen()` now also manages
`_rocPosHandler` directly — registering it when the checkbox is checked and
removing it when unchecked.

### Fix: Save button feedback messages

- **When editor is open (auto-save):** drag/keyboard already auto-saves via
  window event on every drop; Save button sends an extra event (no visible
  change needed).
- **When on dashboard without editor:** Save copies config YAML to clipboard
  and shows **"📋 Copied!"** (blue) instead of the misleading "✓ Saved!",
  making it clear the user needs to paste it into the YAML editor manually.

## [1.2.3] – 2026-06-04

### New: Save button in test mode

A green **💾 Save** button appears below the FLIP button when `test_mode: true`.

- **When the HA card editor is open:** fires `roc-pos-update` → editor relays
  the config to HA storage automatically. Button shows "✓ Saved!" for 2 s.
- **When on the dashboard without editor:** copies the full config YAML
  (or JSON if YAML unavailable) to the clipboard so you can paste it into the
  YAML editor manually.

The Save button is excluded from the card's `tap_action` so clicking it never
triggers navigation or other card-level actions.

## [1.2.2] – 2026-06-04

### Fix: drag & drop and keyboard nudge positions now actually save

Config changes from the card (drag, resize, keyboard) were dispatched as
`config-changed` from the card element — but HA Lovelace only listens for
`config-changed` from the **editor** element, so positions were not persisted.

Fix: the card now dispatches a `window` custom event `roc-pos-update` instead.
The editor registers a `window` listener when `test_mode: true` and relays
any received config through its own `_fire()` call, which HA correctly treats
as an editor config change and saves to storage. The listener is cleaned up
in the editor's `disconnectedCallback`.

## [1.2.1] – 2026-06-04

### Fix: test mode red border restored after deselect

Selecting an element for keyboard nudge overrides its outline with the dashed
selection indicator. On deselect, zones now get their `3px solid red` test mode
border back; other element types get an empty outline (they have no default
test mode border).

### Changed: keyboard nudge step sizes

- `Arrow` keys: **1%** per press (was 0.5%)
- `Shift` + `Arrow`: **0.1%** per press (was 2%) — for fine pixel-level tuning

## [1.2.0] – 2026-06-04

### New: keyboard nudge in test mode

Click any zone, icon, or label in `test_mode: true` to select it — it gets a
dashed primary-color outline. Then use the keyboard to position it precisely:

| Key | Movement |
|---|---|
| `Arrow` keys | ±0.5% per press |
| `Shift` + `Arrow` | ±2% per press (coarse) |
| `Escape` | Deselect |

Config is saved 200 ms after the last key press (debounced), so holding down
an arrow key moves the element smoothly without flooding config-changed events.

Click anywhere on the card background to deselect. Click a different element to
switch selection. The keyboard handler is registered on `document` while
test_mode is active and cleaned up on re-render and `disconnectedCallback`.

## [1.1.0] – 2026-06-04

### New: visual resize handles in test mode

Zones, elements, and gauges now show 6 resize handles in `test_mode: true` —
four corners and two edge handles (right, bottom). Dragging a corner changes
both axes simultaneously; edge handles change one axis. Position and size save
to config automatically on release, identical to the drag & drop behaviour.

Handles are 10×10 px squares styled with `--primary-color` and a white border
so they're visible against any room image. `overflow: visible` is set on the
element in test mode so handles can extend outside the element boundary.

### New: `base_image_conditions` — conditional base image switching

Swap the room photo based on entity state without needing an overlay:

```yaml
base_image: /local/living_room_day.jpg
base_image_conditions:
  - condition:
      entity: sun.sun
      state: below_horizon
    image: /local/living_room_night.jpg
  - image: /local/living_room_day.jpg   # default (no condition)
```

Evaluated in order — first match wins; entry without `condition` is the
default fallback. Images are preloaded at startup. Available in the GUI
editor as a YAML textarea in the Basic settings section.

### Includes all v1.0.18 changes

- Drag & drop positioning in test mode (zones, icons, labels)
- Duplicate button in all GUI editor panels
- Icon `%` size now tracks live card width via `ResizeObserver`

## [1.0.18] – 2026-06-04

### New: drag & drop positioning in test mode

- Zones, icons, and labels are now draggable when `test_mode: true`.
  Grab any element and drag it to its new position — `top`/`left` update live
  and the config is saved automatically on drop.
- Tap/click actions are suppressed when a drag occurs (capture-phase listener),
  so dragging a tappable zone doesn't accidentally trigger its action.
- Labels temporarily become pointer-interactive in test mode to allow dragging.

### New: Duplicate button in GUI editor

- Every icon, label, gauge, blind, zone, and element panel now has a **Duplicate**
  button alongside Remove. Creates a deep copy of the element, appends `_2` to
  the ID, and offsets `top`/`left` by 3% so the copy is visible immediately.

### Fix: icon `%` size now tracks actual card width

- `size: X%` was calculated from `offsetWidth` at `_render()` time, which is often
  0 before the card is laid out (defaulting to 300 px).
- Icon sizes are now recalculated on every `_update()` using the live `offsetWidth`.
- Added `ResizeObserver` — resizing the browser window or changing the dashboard
  layout triggers an `_update()` so icon sizes adjust to the new card width.
- `vw`, `vh`, `vmin`, `clamp()` and other CSS units continue to work unchanged
  (they pass through `resolveSize` unmodified).

## [1.0.17] – 2026-05-30

### Fix: editor freeze caused by datalist DOM thrashing

- `set hass()` in the editor was regenerating and re-setting the full entity
  `<datalist>` on every hass tick (called dozens of times per second when any
  entity changes), causing severe DOM thrashing and browser freeze.
- Fix: datalist is now populated only when empty — once after each `_render()`.
  Subsequent hass updates skip the datalist entirely. Entity list is stable
  within a session so a single fill is sufficient.

## [1.0.16] – 2026-05-30

### Fix: entity search replaced with native datalist

- `ha-entity-picker` had lifecycle issues in the innerHTML-based editor
  (broken rendering, unresponsive fields, empty values on load).
- All entity fields now use `<input list="roc-entities">` backed by a native HTML5
  `<datalist>` populated from `hass.states`. Typing filters entities immediately;
  the dropdown shows matching IDs without any custom element complexity.
- `set hass()` in the editor updates the datalist in-place on every hass update,
  so the list always reflects the current entity set without requiring a full re-render.

## [1.0.15] – 2026-05-30

### New: client-side element groups

Elements can now be grouped and toggled on/off without any HA entity.

**New config section `groups[]`:**
```yaml
groups:
  - id: tv_controls
    visible: false          # initial state
    grouping_code: 1        # optional: mutual exclusion with same code
    style:                  # optional: background panel div
      top: 65%
      left: 5%
      width: 90%
      height: 28%
      background: rgba(0,0,0,0.75)
      border_radius: 10px
      z_index: 49
```

**New `group` property on `icons[]`, `labels[]`, `gauges[]`, `blinds[]`, `elements[]`, `badges[]`, `zones[]`:**
```yaml
icons:
  - id: tv_power
    group: tv_controls
    ...
```

**New action types `toggle-group`, `show-group`, `hide-group`:**
```yaml
zones:
  - id: zone_tv
    tap_action:
      action: toggle-group
      group: tv_controls
```

- `grouping_code`: when a group becomes visible, all other groups sharing the same code are automatically hidden (radio-button behaviour).
- Group state is client-side only — no `input_boolean` entity needed.
- GUI editor: new *Element groups* section with ID, grouping code, initially-visible checkbox, and optional background panel YAML. All element panels gain a *Group* input field.

## [1.0.14] – 2026-05-30

### New: `ha-entity-picker` in all entity fields

- All entity input fields in the GUI editor now use HA's native `ha-entity-picker`
  component instead of plain text inputs. Typing filters the list; clicking shows all
  entities grouped by domain — identical to the standard Lovelace card editors.
- Fields upgraded: base image filter conditions (main + AND/OR sub-conditions),
  labels, gauges, gauge alert conditions, blinds, and brightness model sources.
- `_bindHassComponents()` extended to copy `data-*` attributes from the placeholder
  span to the created picker, so `_collectConfig()` requires no changes.

## [1.0.13] – 2026-05-30

### Refactor: universal `resolveSize()` helper for percentage-based sizes

- New module-level `resolveSize(raw, cardW)` function: if the value ends in `%`,
  it converts to pixels based on the card's rendered width; otherwise passes the
  value through unchanged. Works for any CSS size field.
- `icons[].size` refactored to use `resolveSize()` — removes the inline `%`
  conversion that was added in v1.0.12; behaviour unchanged.
- `labels[].font_size` now also accepts `%` values via `resolveSize()`.
  Example: `font_size: 1.5%` on a 600 px wide card → `9px`; on a 1200 px card → `18px`.
- GUI icon size field label and placeholder updated to `Size (px or %)` / `20px or 2%`.

## [1.0.12] – 2026-05-29

### New: percentage-based icon size

- `size` on icons now accepts `%` values (e.g. `size: 2%`) meaning 2% of the card's
  rendered width. The icon scales proportionally with the card on all screen sizes.
  Pixel values (e.g. `size: 22px`) continue to work as before.

## [1.0.11] – 2026-05-29

### Fix: `bottom` positioning with auto height

- When `bottom` is set without an explicit `height`, the element now uses `height: auto`
  so it expands to fit its content and anchors correctly to the bottom edge on all
  screen sizes. Fixes bubble-card "floating" inside an oversized container on wide screens.

## [1.0.10] – 2026-05-29

### Fix: `bottom` positioning now reliably places element at bottom

- CSS `bottom` property proved unreliable in the card's absolute-positioned container.
  `bottom: X%` is now converted to an equivalent `top` value in JavaScript:
  `top = 100% - bottom% - height%`. Works correctly on all screen sizes.

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
