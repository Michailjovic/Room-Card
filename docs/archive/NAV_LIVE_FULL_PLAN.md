# Live Mini-Room Nav — Phase 2 (`nav.live: full`) — Implementation Plan

Status: **done, live-verified** — Phase 0, steps 2-3 (config transform + mount/scale, v5.4.0),
step 5 (editor UI, v5.6.0) and step 6 (tests, alongside each step) implemented and confirmed
working on a real dashboard (v5.5.0-v5.5.2 fixed real sizing bugs found in that live testing).
`custom` mode (§13, per-element `nav_mini` opt-in) implemented v5.7.0 — opt-in confirmed as the
default (not opt-out) 2026-08-05, reuses `full`'s entire mount/scale/lifecycle machinery unchanged.
Step 4 (instance-reuse/lifecycle optimization) and Optional Phase 3 (swipe reuse) still pending —
non-blocking follow-ups, not required for the feature to work correctly.

**Three `nav.live` tiers, agreed 2026-08-05** (see §13 for the full rationale): `''`/off (today's
baseline — static base image + filter, no compositing) → `'composite'` (existing, shipped v3.1.0
— CSS image-layer stack, base + active overlays + filter, no real card instances) →
**`'full'`** (this document's main subject — real persistent live instances, shows EVERYTHING
unconditionally, no per-element config) → **`'custom'`** (planned follow-up, §13 — same
mechanism as `full`, but a per-element GUI checkbox picks what's included; built AFTER `full`
ships and is tested, reusing `full`'s mount/scale/lifecycle machinery rather than reworking it).
This document currently implements and describes `full` only; `§13` sketches `custom` for later.

## 1. Goal

Today (`nav.live: composite`, shipped v3.1.0) each nav thumbnail is a CSS background stack —
base image + active overlay images + a filter — updated directly on the thumbnail `<div>`. It's
cheap and looks like a mini-room at a glance, but it's an approximation: no gauges, no labels,
no icons, no blinds, no weather, no true per-element positioning at scale.

**Phase 2 makes each thumbnail a real, live, non-interactive `room-overlay-card` instance for
its room, scaled down** — "the menu is literally a scaled-down copy of what we built" (user's own
framing, captured in ROADMAP.md). Because it's a real instance rendering at a reference pixel
width and then scaled with a CSS transform, px-based fonts/icons/gauge strokes keep their exact
proportions — a true miniature, not a reflow.

## 2. What Phase 1 already built (reuse, don't duplicate)

Three places in `room-overlay-card.js` already mount a full nested `<room-overlay-card>` instance
with a stripped-down config — this is 90% of the mechanism Phase 2 needs, just used
transiently/singly today:

| Consumer | Method | Lifetime | Config recipe |
|---|---|---|---|
| Swipe neighbour preview | `_renderNeighbourPreview(prevEl, idx)` (~L2517) | < 0.5 s (torn down on next swipe/commit) | `follow_mode:'manual'`, `_roc_preview:true`, `_roc_ghost:true`, `nav:{style:'none'}`, strips `cards_above`/`cards_below`/`light_controls` (top-level **and** per-room), strips `url_sync` |
| Editor drag-preview | `_mountPreview()` (~L3539) | lives for the editor session | `test_mode:true`, `_roc_preview:true`, `follow_mode:'manual'`, strips `url_sync` |
| Nav composite thumbs | `_updateNav()` (~L3057) | persistent, but **not** a card instance — pure `style.backgroundImage` compositing | n/a |

Key existing render-time behaviour these flags already unlock (found in `_render()`, ~L1232-1255):

- `c._roc_ghost` → `_lp` (grid definition) collapses to a single `image` region, full 100×100 —
  exactly the "just show me the room picture with its overlays" shape a thumbnail wants.
- `c._roc_ghost` → `_rootH='100%'` — fills its host div instead of trying to pin viewport height.
- `c._roc_ghost` → camera timers and template subscriptions are hard-skipped (`if(c._roc_ghost)return;`
  at L2287 and L2318) — correct for a < 0.5 s ghost, **wrong** for a persistent mini (Phase 2 needs
  these opt-in, see §5).
- `c._roc_preview` → suppresses the editor Save button etc.; also short-circuits
  `_layoutRootHeight()` entirely (L1019: `if(c._roc_ghost||c._roc_preview)return;`).

## 3. Phase 0 — prerequisite refactor (do this first, before Phase 2 code)

Two real gaps found while grounding this plan in the current code — fix both before wiring up
persistent minis, or every mini instance leaks observer overhead for its entire lifetime:

1. **`_wireLayoutObservers()` (~L1082) doesn't check `_roc_ghost`/`_roc_preview` at all.** It
   unconditionally creates `this._ro` (a `ResizeObserver` that calls `_layoutFitWrap()` +
   `_layoutStage()` + `_update()` on every resize of the instance itself — real work, not a
   no-op), plus `_wrapRo`, `_scRo`, `_bodyRo`. Today this only matters for two short-lived/single
   instances (swipe ghost, editor preview) so it's harmless. With up to **8 persistent** mini
   instances it's 8× real ResizeObservers permanently wired, each doing a real recompute pass on
   every resize, watching a `_scrollParent()` that (nested this deep in another card's shadow DOM)
   likely resolves to the outer page's own scroller — so an outer page scroll/resize fans out into
   8 wasted recompute passes. **Fix:** early-return at the top of `_wireLayoutObservers()` for any
   "restricted" instance (see flag below), keeping only what a mini actually needs (its own image
   aspect-fit on resize, nothing viewport-related).
2. **No existing flag distinguishes "persistent restricted instance" from "ultra-short-lived
   ghost."** `_roc_ghost` hard-skips camera/templates unconditionally — right for a 0.5 s swipe
   ghost, wrong for a mini that should be able to opt back into templates/camera per
   `nav.mini.*` config (§5). Add a new flag, e.g. **`_roc_mini:true`**, orthogonal to `_roc_ghost`:
   - Reuses the ghost's `_lp` (image-only grid) and `_rootH:'100%'` treatment — extend those two
     conditions from `c._roc_ghost` to `(c._roc_ghost||c._roc_mini)`.
   - Reuses `_roc_preview`'s Save-button suppression and `_layoutRootHeight()` bail.
   - Does **not** imply the camera/template hard-skip — those stay gated on `_roc_ghost` only, so
     a mini can have `_roc_mini:true` without `_roc_ghost:true` and keep templates/camera when
     `nav.mini.*` opts in.
3. **Recommended (not required) cleanup while touching this code:** factor the config-stripping
   recipe duplicated between `_renderNeighbourPreview` and `_mountPreview` (and the new mini
   builder, §4) into one shared method, e.g. `_buildEmbeddedConfig(baseCfg, opts)` where `opts`
   picks the flag combination and strip-list per caller. Not load-bearing for Phase 2 to work, but
   avoids a third copy-paste of the same ~10 lines, and the next person touching any of the three
   only has to reason about one function.

## 4. Config schema

```yaml
nav:
  style: thumbnails
  live: full                      # '' (off) | composite | full | custom  ← 'full'/'custom' new
  mini:                           # read for both live: full and live: custom
    templates: false              # opt-in — label/color templates cost a WS subscription per mini
    camera_refresh: 30            # seconds, clamped ≥ 30 regardless of the room's own setting
    width_ref: 480                # px — reference width the mini renders at before scaling down
```

`full` shows **everything** unconditionally — no allowlist, no per-element config. This keeps the
common case (just want the real thing, scaled down) a one-line config change from `composite`.
Fine-grained control (excluding one specific gauge/card/label while keeping the rest) is `custom`
mode's job (§13, not yet built) — deliberately NOT solved inside `full` itself, so `full` stays
simple and doesn't need reworking once `custom` exists alongside it.

Always stripped, in **both** `full` and the future `custom` (§13) — this is page furniture around
the image, not "how the room looks", so it's orthogonal to the fidelity tiers: `cards_above`,
`cards_below`, `light_controls` (same recipe `_renderNeighbourPreview` already applies), blind
`control:` blocks (interactive), `nav.cards`, `zoom`/`parallax`, `url_sync`. `elements` (embedded
HA cards) is deliberately **not** on this list — in `full` it's part of "everything"; a specific
inappropriate one is `custom` mode's job to exclude, per-item, once built.

## 5. Per-instance config transform

Implemented as `rocBuildMiniConfig(cAll, ri)` — a **pure top-level function** (not an instance
method as originally sketched here), matching the project's existing pattern for
`blindToGaugeConfig`/`coverControlNorm`: smoke-testable directly, no jsdom needed. Called once per
thumbnail during the nav-mount step (§6), inside `_render()` — so it re-runs on every full
re-render today (step 4, lifecycle/reuse, will narrow this to only when it actually needs to).

1. `rocClone(cAll)` — start from the full multi-room config, same as the swipe ghost, so the
   nested instance's own normal room-render/merge logic does the work; no manual re-merging.
2. `gcfg._roc_mini=true; gcfg._roc_preview=true;` (§3) — **not** `_roc_ghost` (needs to be able to
   keep templates/camera per `nav.mini.*`).
3. `gcfg.follow_mode='manual';` — the caller pins the instance to its own room via `el._roomIdx=ri`
   *after* `setConfig`, matching how `_renderNeighbourPreview`/`_mountPreview` already do it (room
   index isn't baked into the config itself).
4. `gcfg.nav={style:'none'};` — **recursion guard**: a mini must never render its own nav strip
   (which would try to mount 8 more minis inside it, and so on).
5. `delete gcfg.url_sync; delete gcfg.zoom; delete gcfg.parallax;` — must never touch the page URL;
   zoom/parallax are pointer-driven and the mini is `pointer-events:none` (§7) anyway.
6. Strip the always-off list (§4) from `gcfg` (top-level) **and** from every entry in
   `gcfg.rooms` (top-level room-scoped keys act as per-room defaults per the README, so both
   layers need stripping — exactly the bug the existing ghost code already had to account for).
7. `nav.mini.templates` opt-in, implemented as a code-level gate rather than a config scrub:
   `gcfg._roc_mini_templates=!!(cAll.nav&&cAll.nav.mini&&cAll.nav.mini.templates)` — preserved as
   its own top-level flag since `nav` itself gets wiped to `{style:'none'}` at step 4, so
   `nav.mini.templates` wouldn't survive on the clone otherwise. `_setupTemplates()` skips
   entirely when `c._roc_mini&&!c._roc_mini_templates`, right next to the existing `c._roc_ghost`
   gate — no template-string detection needed, just don't subscribe.
8. `gcfg.rooms[ri].camera_refresh = Math.max(30, ...)` when that room has a `base_camera` — clamps
   without needing a code-level gate (camera start already reads this config value normally).

No per-category or per-element filtering happens here — that's `custom` mode's entire reason to
exist (§13), kept out of this function on purpose.

## 6. Mount & sizing (scale transform)

The existing thumbnail host (`room-overlay-card.js` ~L1312, `.roc-thumb[data-thumb="ri"]`) already
has a resolved pixel box (`_thSize` + `_thFlex`, from `nav.height`/`nav.width`/derived aspect —
see ~L1266-1292). Phase 2 adds one more layer inside it:

```html
<div class="roc-thumb" data-thumb="0" style="...existing sizing...">
  <div data-thumb-mini="0" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;">
    <!-- mini card mounted here at width_ref, then scaled -->
  </div>
  <div data-thumb-chips="0">...</div>  <!-- existing chip overlay stays on top, unscaled -->
</div>
```

- Mount the `<room-overlay-card>` at a fixed CSS width `nav.mini.width_ref` (default 480 px) —
  the SAME width for every room, so gauge/font proportions are consistent across thumbnails no
  matter each room's own `aspect_ratio`.
- `transform: scale(thumbBoxWidth / width_ref); transform-origin: top left;` computed from the
  **host div's own** `getBoundingClientRect().width` (not the window) — the host div is already
  correctly sized by the existing nav layout math, so this reads it rather than re-deriving it.
- Rescale triggers: a `ResizeObserver` **on the host thumb div** (one per thumb, or one shared
  observer with `observe()` called per thumb — prefer one shared `ResizeObserver` instance with a
  Map from observed element → index, cheaper than 8 separate observer objects) recomputes the
  scale on width change (mobile wrap reflow, `nav.width:auto` flex, window resize, orientation
  change). This is a pure CSS transform recompute, not a re-render — cheap even at 8×.
- `pointer-events:none` on the mini host div (§7) means the scale wrapper never intercepts drag/
  swipe/click — those still land on the outer `.roc-thumb` exactly as today.

## 7. Interactivity

- Mini instances are **visually live, functionally inert**: `pointer-events:none` on the mount
  wrapper. All existing thumbnail interactions (click → switch room, keyboard, the outer
  swipe/drag-preview system) are untouched — they operate on `.roc-thumb`, which sits above/around
  the mini in z-order and keeps normal pointer handling.
- Corollary: cover-control widgets, embedded HA cards, zone tap actions etc. inside a mini must
  never be reachable — covered by "always stripped" in §4 (`control:` blocks, `cards_above/below`,
  `light_controls`) plus `pointer-events:none` as a second, structural line of defense.

## 8. Lifecycle & performance

- **Instance reuse.** Don't tear down and recreate minis on every card render — only (re)build a
  mini when its room's *identity* changes (room added/removed/reordered) or `nav.live`/`nav.mini.*`
  itself changes. Key by a config hash per room (same `cfgKey`-style approach already used for the
  editor-room-memory store) so a `_render()` triggered by an unrelated state change doesn't rebuild
  8 card instances. **Current status: not yet done** — `rocBuildMiniConfig` + mount (§5/§6, both
  implemented 2026-08-05) currently rebuild every mini on every full `_render()`, same as the
  pre-existing `nav.cards` precedent; this is step 4, still pending.
- **`hass` forwarding.** Implemented: a `this._navMiniEls` object (keyed by room index, not an
  array — deliberate, so the planned Phase 3 swipe-reuse can look up a specific room's mini
  directly) forwarded in `set hass()` alongside the existing `_navCardEls`/`_stripCardEls` loops.
- **Camera & templates opt-in, clamped** (§5) — off by default; each is a real per-instance
  WebSocket subscription or polling timer, and 8× is a meaningfully larger footprint than 1×.
- **Documented cap ~8 rooms** for `nav.live: full` (matches ROADMAP) — the editor should warn (not
  block) above that, same tone as other soft limits in this project.
- **GPU/memory on older tablets** — this is the real open risk (real DOM trees + `transform:
  scale` compositing layers × up to 8, persistent, and `full` shows everything unconditionally —
  no allowlist to soften this the way an earlier draft of this plan assumed). Mitigation is Phase
  0's observer cleanup (§3) plus, longer-term, `custom` mode (§13) for anyone who needs to trim
  what renders; call the GPU/memory risk out explicitly in the CHANGELOG/README as "test on your
  actual wall tablet before enabling on more than a couple of rooms."

## 9. Editor

- Nav-style select's existing `live` dropdown (~L4673: `off | composite`) gains a `full — live
  room minis (real instances, everything)` option. (`custom` — §13 — adds a further option once
  built, not part of this pass.)
- New "Mini-room settings" sub-panel (visible only when `live: full`, small — `full` has no
  per-element config by design, §4): templates toggle, camera-refresh number input (min 30,
  matching the config clamp so the editor can't produce an invalid value), width_ref number input.
- Collect/round-trip: new `_navO.mini = {...}` block, same pattern as the existing `_navO.chips`/
  `_navO.cards` YAML-textarea collection (~L4058-4059) — plain form (a couple of number inputs +
  a checkbox), no YAML textarea needed for a field set this small.

## 10. Test plan

- **Smoke (pure functions):** `rocBuildMiniConfig(cAll, ri)` (§5, implemented as a standalone
  top-level function, not yet tested) — given a full config + room index, assert the returned
  clone has the always-off keys stripped, `_roc_mini`/`_roc_preview`/`_roc_mini_templates` set
  correctly, `nav:{style:'none'}`, `camera_refresh` clamped ≥30 only when `base_camera` is present.
  Mirrors how `coverControlNorm`/`blindToGaugeConfig` are unit-tested today.
- **Render (jsdom):** mount a multi-room config with `nav.live: full`, assert one nested
  `room-overlay-card` element exists per room inside `[data-thumb-mini]`, each with the expected
  stripped config and `_roomIdx` pinned to its own index; assert scale transform is applied and
  recomputed after a simulated host resize.
- **E2e (Playwright, real Chromium — the geometry tier from v5.0.0):** visual regression — a
  fixture dashboard with `nav.live: full`, assert each thumbnail's mini paints (not blank/broken),
  scale looks correct at at least two card widths, and — importantly — that the Phase 0 observer
  cleanup actually holds: assert no console errors/warnings fire when a mini's `_scrollParent()`
  resolves to something unexpected, and that resizing the outer window doesn't trigger 8×
  redundant `_update()` calls (spy/count check).
- Regression check on `nav.live: composite` — must keep working unchanged (it's still the
  lightweight default; `full` is opt-in, never a silent migration).

## 11. Phased implementation steps

1. **Phase 0** (§3): `_roc_mini` flag + `_wireLayoutObservers()` early-return + (optional) shared
   `_buildEmbeddedConfig` refactor. Ship as an internal-only change first, verified against the
   existing swipe-ghost/editor-preview smoke+render tests (should be a pure no-behaviour-change
   refactor if done right — same discipline as v5.0.0).
2. **Config transform** (§5) as a standalone, unit-tested pure(ish) function.
3. **Mount + scale wrapper** (§6), wired into the existing `_updateNav`/render nav-building path,
   gated behind `nav.live === 'full'`.
4. **Instance reuse/lifecycle** (§8) — hass forwarding, rebuild-on-identity-change only.
5. **Editor UI** (§9).
6. **Tests** (§10) — smoke + render alongside each step above (not saved for the end), e2e once
   the feature is visually complete.
7. Docs: README "Multi-room" section gets a `nav.live: full` example next to the existing
   `composite` one; CHANGELOG + RELEASE_NOTES; version bump (next available number at ship time —
   do not reuse one, per project convention).

## 12. Optional Phase 3 — swipe reuses the live mini instance (`nav.live: full` only)

Not required for Phase 2 to ship; a follow-up optimization, only meaningful when `nav.live: full`
is actually enabled (when it isn't, there's nothing persistent to reuse and today's
`_renderNeighbourPreview` lazy-create-on-drag behaviour is already correct and stays unchanged).

**Why it's worth doing:** today's swipe already creates a fresh throwaway `room-overlay-card`
instance per drag (§2) — cheap because it's rare and short-lived (~0.5–2 s). With `nav.live: full`
on, a real live instance for every room already sits in the nav strip continuously. Creating a
*second*, independent instance for the same room just to slide it across the screen during a
swipe is redundant work that Phase 2 itself introduces — this phase removes that redundancy by
reusing the DOM node that's already there instead of building a new one.

**Mechanism:**

1. On drag-engage in `_attachRoomDrag` (~L2454), if `cAll.nav?.live==='full'` **and** a live mini
   exists for the target neighbour room index (`this._navMiniEls?.[ni]`), skip
   `_renderNeighbourPreview` entirely for that gesture.
2. Reparent the mini's element (`appendChild`) from its thumbnail host
   (`[data-thumb-mini="ni"]`) into the swipe overlay (`prev`), in the same frame as starting the
   drag transform — no visible gap, matching the create-then-immediately-transform pattern
   `_renderNeighbourPreview` already uses today.
3. Animate its CSS transform from the thumbnail's small scale/position (§6) to full-size
   (`scale(1)`, filling `prev`) as the drag proceeds — same drag-following behaviour as the
   current ghost, just driving an existing node instead of a freshly created one.
4. On drag end (commit or cancel), reverse step 2/3: transform back down and reparent the element
   back into its `[data-thumb-mini]` host, resuming normal thumbnail rendering. The element is
   never disconnected-and-recreated, only moved — its internal state, WS subscriptions, timers all
   survive, the same guarantee the card already relies on for HA's own edit-mode DOM shuffling
   (v4.6.4: `connectedCallback`/`disconnectedCallback` proven safe across a reparent while running).
5. **Fallback is automatic and cheap to reason about:** any case Phase 3 doesn't handle (no live
   mini for that room yet — cap exceeded, feature disabled, identity rebuild pending — or
   `nav.live!=='full'`) just falls through to the existing `_renderNeighbourPreview` path,
   unchanged. Phase 3 is purely opportunistic, never a hard dependency for swipe to work.

**Trade-off, revised now that `full` shows everything unconditionally (§4):** a `full`-mode mini
is actually near-equivalent in fidelity to today's `_renderNeighbourPreview` ghost — both show
essentially the whole room. The one difference runs the *other* way: the ghost sets `_roc_ghost`,
which hard-skips camera refresh and templates always; a `full` mini can opt into both via
`nav.mini.templates`/`camera_refresh`, so Phase 3 reuse could mean a *more* faithful swipe preview
than today, not less. The real version of this trade-off only appears once **`custom`** mode
(§13) exists: if a room's mini is curated (some elements excluded), Phase 3 reuse means the swipe
preview shows that same curated view, not the fuller one `_renderNeighbourPreview` shows today.
That's arguably the *correct*, consistent behaviour (what you see in the menu is what slides in) —
but it's still a behaviour change worth calling out in the README/CHANGELOG whenever `custom` +
Phase 3 combine, so it isn't a surprise.

**Risks (beyond §8's general ones):** reparenting mid-transition needs care to avoid a visible
flash — do the DOM move and the first transform frame together, not across two ticks. Stacking
context: the thumbnail's `overflow:hidden` wrapper vs. the full-viewport swipe overlay need
compatible z-index handling during the move. The mini's own `_ro` (kept alive under Phase 0's
restricted wiring, §3) should actually help here rather than hurt: since the thumbnail-scale
transform never changes the element's real box size, `_ro` stays quiet at rest; once reparented to
full swipe size its real box *does* change, so `_ro` correctly fires `_layoutFitWrap()`/
`_layoutStage()` for the new size — no special-casing needed, just verify it in testing.

**Test plan addition:** an e2e case that swipes with `nav.live: full` on and asserts (a) DOM node
identity is preserved across the gesture (same element reference before/after, not
recreated), (b) no extra image network requests fire (proof it didn't rebuild), (c) no visible
flash (screenshot diff at drag-start). A render/jsdom test for the reparent-and-restore round trip
(mini ends up back in the correct `[data-thumb-mini]` host with its original transform after a
cancelled drag).

## 13. `nav.live: custom` — IMPLEMENTED v5.7.0

Agreed 2026-08-05, prompted by a real case: a user knows one specific embedded card/element is
inappropriate at thumbnail scale but wants everything else `full` shows. Rather than bolt a
category allowlist back onto `full` (an earlier draft of this plan did exactly that — reverted,
see §4/§5's "no per-category filtering, on purpose"), `custom` is its own third `nav.live` value,
built **after** `full` ships and is tested, reusing `full`'s entire mount/scale/lifecycle machinery
(§5-§8) — only `rocBuildMiniConfig`'s content is different for this tier.

**Mechanism (as shipped):** a new optional per-element field `nav_mini: true`, addable to
individual entries in `gauges`, `labels`, `icons`, `badges`, `blinds` (the visual gauge, independent
of `control:`), `elements` (embedded HA cards) — `zones` deliberately excluded, not visual room
content. Weather (`weather_overlay`) is a scalar, not a list, so it gets its own top-level-or-per-
room `weather_nav_mini: true` toggle instead. `custom` mode reuses `rocBuildMiniConfig` and every
bit of `full`'s mount/scale/lifecycle machinery unchanged — only one extra filtering pass inside
`stripAlways`, applied to both the top-level default arrays and each room's own arrays (same
top-level+per-room duality the always-off strip already needed). **Default resolved 2026-08-05,
confirmed explicitly by the user: opt-in** (`nav_mini===true` required — nothing shows until
checked), not opt-out. Weather's toggle resolves per the SPECIFIC target room being rendered: that
room's own `weather_nav_mini` if it set one, else the top-level default — needed because
`weather_overlay` itself can live at either level, so a naive "check the same object" approach
would silently break whenever the two were defined at different levels.

**Editor:** each element type's existing `_xxxItem()` panel (`_gaugeItem`, `_blindItem`, `_icoItem`,
`_lblItem`, `_badgeItem`, `_elItem`) gained one checkbox via a shared `_navMiniField(prefix,i,
checked)` helper, visible only when `nav.live==='custom'`. The weather toggle lives in the Basic
tab next to the existing weather fields, same visibility gating. Picking `full`/`custom`/etc. now
triggers a full editor re-render (not just a local panel toggle like `nav.mini.*`'s settings panel)
since `custom`'s checkboxes need to actually appear/disappear across every open element panel at
once, not just one local sub-panel.

**Scope:** touched all 6 relevant element item builders + their collect logic + KEEP-array
exclusions (so the checkbox's value doesn't also leak into each item's advanced-YAML textarea) +
the shared field-level change-listener wiring — mechanically repetitive but each addition was small
and uniform. 10 smoke tests (`rocBuildMiniConfig` custom-tier filtering) + 12 render tests (editor
checkboxes, collect round-trip, end-to-end mount filtering).

## 14. Open questions (resolve before/while implementing, not blocking this plan)

- Exact default for `width_ref` (480 px assumed above) — tune once real thumbnails are on screen;
  trades text/icon crispness at small thumb sizes against per-instance render cost.
- Whether a mini should ever show its own cover-control glass module in a *disabled/visual-only*
  state (position rail visible but non-interactive) instead of stripping `control:` entirely —
  default in this plan is full strip (simplest, safest); revisit only if the visual absence looks
  wrong in practice.
- ~~`custom` mode's opt-in vs. opt-out default (§13)~~ — **resolved 2026-08-05: opt-in**,
  implemented v5.7.0.
