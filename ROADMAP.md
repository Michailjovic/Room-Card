# Room Overlay Card — Roadmap

Current release: **v5.4.0** (2026-08-05, v5.2.0/v5.3.0 reserved/unused). Verified against Home
Assistant 2026.6.

**The original roadmap, the v2.0.0 milestone, the v3.0 backlog, and the entire
v3.1 – v5.1 feature run are complete.** The card is feature-complete for daily
use — remaining work is the push to get it into HACS's own default repository
(**v6.0.0**), one big optional vision item (live mini-room nav), and a short
editor/UX polish backlog.

Legend: 🎯 should do · 💡 could do · 🔭 vision · ✅ shipped · ⛔ dropped · 🅿️ parked

---

## Shipped history (condensed)

### v1.x – v3.0 — foundation, responsive tiers, editor, multiroom — ✅ SHIPPED

- **v1.3 – v1.4** — core elements (zones, icons, labels, badges, gauges, blinds,
  embedded cards), templates everywhere, relative-time labels, weather v2, CI smoke
  tests, editor undo/redo, snap-to-grid + alignment guides, live icon previews.
- **v1.5** — `color_from` tint, draw-to-create zones, pinch-zoom, per-element
  `fade`/`slide`, actions on gauges & labels.
- **v1.6 – v1.12** — **multi-room** (`rooms:`, thumbnail nav, `switch-room`, Bermuda
  presence follow, `card_id`, side-rail nav, finger-drag), editor live preview, 3D
  parallax tilt, `PRESETS.md`, `nav.width`/`nav.cards`, `room_entity` per-device
  mapping, `follow_mode` + follow button, `room_state_entity`, `cards_above`/`cards_below`.
- **v1.13 – v2.0** — **responsive tiers** (mobile/tablet/desktop/ultrawide), per-tier
  scalars, hold-gesture feedback, **tabbed editor** + onboarding, persistent header,
  GUI companion cards & room reorder, **v2.0.0 milestone** (test-mode declutter, README rework).
- **v2.1 – v2.2** — **`lock_aspect`** (fixed-design-aspect stage), whole-dashboard Save,
  **mouse-wheel room switching**.
- **v3.0.0** — roadmap-completion release: nav/menu GUI block, per-tier inputs, unified
  image-filter section, Advanced (YAML) toggle, **`url_sync` deep-linking**, full-room
  drag preview. (v3.0.1–3.0.7: day_night attempts 🅿️, swipe/strip fixes, code-review batch.)

### v3.1 – v4.5 — post-3.0 feature run — ✅ SHIPPED

| Version | Highlights |
|---|---|
| **v3.1.0** | **`nav.live: composite`** — nav thumbnails paint the room's active overlay images as stacked layers + `filter_conditions`/`brightness_model` (Phase 1 of live mini-room nav) |
| **v3.2.0** | **`light_controls`** — a strip of `material-slider-card` light sliders whose border colour tracks a lux sensor (HSL ramp, no card_mod) |
| v3.2.1–3 | `light_controls` follow-ups (`bg_off` fix, responsive height px/vh/%/per-tier), HACS `LICENSE`, editor Elements A–Z with icons/badges, swipe-strip fix |
| **v3.3.0** | **Cover control (roleta)** — a `blind` `control:` block becomes an interactive glass module (position rail + up/stop/down + presets, `float` tap-reveal / `dock`, mobile horizontal bar) |
| **v4.0.0** | **Layout engine rebuild** — two `portrait`/`landscape` profiles chosen by viewport ratio, **% CSS-grid regions**, per-profile cover dock/float, auto-migration from the v3 tier system + editor banner, new **Layout tab**, jsdom render tests |
| **v4.1.0** | `light_controls` supports **on/off switches** (toggle pill sharing the lux ring) + editor **gradient preview** with ¼ ½ ¾ tick marks |
| **v4.2.0** | Editor **opens on the room you were viewing** (via `url_sync` hash) |
| **v4.3.0** | Toggle-pill height **matches the slider** (measured); editor-opens-on-room moved to an in-memory store (works without `url_sync`) |
| **v4.4.0** | Fix: record the viewed room only on an actual room switch, so HA's edit-mode card recreation no longer clobbers it |
| **v4.5.0** | HA's **own preview pane follows the edited room** — the editor writes the `url_sync` hash (+ `hashchange`) on open and room-pick |

### v4.5.1 – v4.6.4 — responsiveness + edit-mode hardening — ✅ SHIPPED

Five generations of fixes to the viewport-height engine and edit-mode transitions,
diagnosed live against the real dashboard each time: natural portrait height,
landscape edit-bar reservation, scroll-container-relative measurement (not viewport),
intrinsic image budget-fit (letterbox, never crop), the edit-mode "breathing" loop,
and finally fully event-driven transitions (MutationObserver on HA's own DOM, no rAF,
no timers). v4.6.3 also hardened the release pipeline itself after a silent asset-upload
failure broke HACS installs.

### v5.0 – v5.1 — internal cleanup + calibration — ✅ SHIPPED (user push pending)

- **v5.0.0** — layout-engine cleanup: every layout trigger routed through one coalesced
  `_requestPin` entry point, rAF audit (background/kiosk-tab safe), `ROC_DEBUG` diagnostics,
  and a new Playwright **geometry regression harness** asserting real pixels in headless
  Chromium (not just jsdom). No config or behaviour changes.
- **v5.1.0** — blind visual-overlay **`top_offset`** calibration: many motors keep a
  deliberate safety margin at their own "fully open" (raw 0%) limit, so the blind still
  hangs a little even there. `top_offset` (%) linearly remaps the **visual overlay only**
  to match reality; the cover-control widget keeps showing/sending the raw motor position,
  unchanged. Default `0` = no behaviour change.

---

## Development order (agreed 2026-08-05)

1. ✅ **Live mini-room nav — Phase 2** (`nav.live: full` + `custom`) — all three tiers
   (`off`/`composite`/`full`/`custom`) shipped v5.4.0-v5.7.0, live-verified working. Remaining
   pieces (instance-reuse perf, optional swipe-reuse Phase 3) are non-blocking follow-ups — see
   [`NAV_LIVE_FULL_PLAN.md`](NAV_LIVE_FULL_PLAN.md).
2. ✅ **Haptic on hold-registered** (E7, mobile) — shipped v5.8.0.
3. 🎯 **Editor GUI/UX revalidation** — up next, ships under **v5.9.x** (own minor version, not
   bundled into v6.0.0 — decided 2026-08-05: v6.0.0 is reserved for the finished product,
   README overhaul included, right before HACS submission).
4. 🎯 **v6.0.0 — Official HACS default-repository submission** — README/GitHub content overhaul
   as the finale, once the revalidated editor (step 3) has landed and settled.
5. 🅿️ `day_night` blind visual model stays parked — explicitly **not** revisited before or
   during v6.0.0.

## 🎯 Editor GUI/UX revalidation — up next, ships as v5.9.x

A full pass over the editor for consistency and discoverability. The control surface has grown a
lot across v3–v4 and is getting hard to navigate, even for the author. Scope to be broken down
when picked up. **Versioned separately from v6.0.0** (decided 2026-08-05) — this is a real
feature pass in its own right, not just a pre-submission checkbox.

## 🎯 v6.0.0 — Official HACS default-repository submission

**Goal:** the card gets listed in HACS's own default repository, so new users can install
it straight from HACS search instead of adding it as a custom/manual repository. Depends on the
editor GUI/UX revalidation (above) having already shipped and settled — the submission
screenshots should show off the finished, revalidated editor.

1. **GitHub content overhaul** — a much more detailed, beginner-friendly README and fresh
   screenshots reflecting the v4 layout engine, cover control, light controls (sliders +
   switches), and the **revalidated** editor. Current screenshots predate all of this.
2. **Repo topics** — add discoverability topics on the GitHub repo itself (`home-assistant`,
   `lovelace`, `custom-card`, `hacs`, …) — required by the `hacs/default` review.
3. **Re-verify against the `hacs/default` validation checklist** — the repo's own HACS
   validation Action has shipped since v1.8.0 ✅; confirm it still covers everything the
   default-repo submission specifically checks for (README, `hacs.json`, releases, brands).
4. **Submit the PR to `hacs/default`.**
5. Bump to **v6.0.0** to mark the milestone once accepted/merged.

## ✅ Live mini-room navigation — Phase 2 (`nav.live: full` + `custom`) — done, v5.4.0-v5.7.0

Full technical spec, code touch-points and phased implementation plan:
[`NAV_LIVE_FULL_PLAN.md`](NAV_LIVE_FULL_PLAN.md). **Status:** mount/scale mechanism (v5.4.0),
three rounds of live-verified sizing bugfixes (v5.5.0-v5.5.2 — connection-order, then a
transform-vs-getBoundingClientRect measurement bug that needed two attempts to fully nail down;
see those CHANGELOG entries), editor UI for `full` (v5.6.0 — *Rooms & menu* tab, "full" option
reveals a *Mini-room settings* panel for templates/camera_refresh/width_ref), and the `custom` tier
(v5.7.0 — same mount/scale mechanism as `full`, per-element opt-in via `nav_mini`/a "Show in mini"
checkbox on every gauge/label/icon/badge/blind/embedded-card panel, plus a weather toggle) are all
done. Still open: instance-reuse/lifecycle optimization (step 4 — currently rebuilds every mini on
every card render) and optional Phase 3 (swipe reuses the live mini instance) — see the plan doc.

**Goal:** nav thumbnails become *true miniatures* — each thumbnail hosts a real,
non-interactive `room-overlay-card` rendered at a reference width and scaled down, so
px-based fonts/icons/gauges keep exact proportions (a true miniature, not a reflow).
"The menu is literally a scaled-down copy of what we built." Phase 1 (`composite`)
shipped in v3.1.0; the building blocks (`_renderNeighbourPreview`, `_mountPreview`)
already exist.

- **Scaling:** host = thumb size + `overflow:hidden`; inner card at `width: W_ref` with
  `transform: scale(thumbW / W_ref); transform-origin: top left`.
- **Config transform** (same recipe as `_renderNeighbourPreview`): `_roc_preview: true`,
  `nav.style: none` (recursion guard), `follow_mode: manual` + pinned `_roomIdx`, strip
  `url_sync`, `cards_above/below`, `zoom`, `parallax`.
- **Interactivity:** `pointer-events: none` on the mini; host keeps click/keyboard → switch room.
- **Perf knobs:** `nav.mini.features` allowlist (default `[overlays, filters, blinds]`;
  opt-in `gauges`/`labels`/`icons`/`weather`, animations off by default); default-strip
  templates (`nav.mini.templates: true` to opt in); `camera_refresh` clamped ≥ 30 s;
  reuse instances by config hash; documented cap ~8 rooms.
- **Editor:** nav-style select gains "thumbnails — live minis".
- **Risks:** GPU memory on old tablets, template subscription multiplication, recursion
  (all mitigated by allowlist / default stripping / double recursion guard).

## 🎯 Editor / UX polish backlog (from ANALYSIS_v3.0.6.md)

| # | Item | Note |
|---|---|---|
| E7 | **Haptic on hold-registered** | ✅ shipped v5.8.0 — fires a haptic tick the moment a hold action registers, toggleable from the editor |
| E3 | Draw-to-create for all element types | rubber-band currently makes zones only |
| E4 | Edge / centre snap guides | complements the 0.5 % grid + edge snap |
| E5 | Editor list filter / search | for long element lists |
| E6 | Inline save-failure hint | surface a failed Save in-editor |
| D7 | Editor round-trip test harness | automate collect → config → re-render checks |

## 🅿️ Parked

- **`day_night` blind model** — three failed attempts (v3.0.1–3.0.3); reverted to the
  v3.0.0 two-layer look. Do **not** re-attempt without a precise description of the real
  blind's motor-%→visual mapping (ideally side-by-side at specific positions). Note: v5.1.0's
  `top_offset` fixes a related-but-narrower problem (raw-motor calibration offset) and does
  **not** unpark this item — the dual-layer visual *style* modeling is still unsolved.
  **Explicitly stays parked through v6.0.0** (user decision 2026-08-05) — not on the near-term
  development order at all.

## Maintenance (ongoing)

- **Watch-list of internal APIs** (re-verify each HA major):
  - `lovelace/config` (+ `/save`) WS — test-mode Save button; undocumented but stable.
  - `window.browser_mod` (popup action) — third-party.
- **Optional migration**: `set hass` → `context-request` states subscription (`hass`
  property remains fully supported, so no urgency).

---

## HA 2026.6 compatibility audit

| API used by the card | Status in HA 2026.6.2 |
|---|---|
| `setConfig` / `getCardSize` / `getGridOptions` / `getConfigElement` | ✅ current documented API |
| `getGridOptions()` (columns only; rows omitted so the layout grid drives height) | ✅ documented |
| `getEntitySuggestion` on `window.customCards` | ✅ implemented (camera suggestion) |
| `hass` property updates (card + editor) | ✅ standard; `context-request` optional |
| `hass.callService(domain, service, data, target)` | ✅ stable |
| `render_template` WebSocket subscription (label templates) | ✅ current documented API |
| `window.loadCardHelpers().createCardElement` (embedded + slider/cover cards) | ✅ direct-create fallback kept |
| `config-changed` event from editor | ✅ current documented API |
| `history.replaceState` + `hashchange` (`url_sync`, editor-drives-preview) | ✅ evergreen browser API |
| `lovelace/config` (+ `/save`) WS — Save button | ⚠️ internal API (incl. sections layout); on watch-list |
| `haptic` window event | ✅ frontend convention; harmless no-op when unsupported |
| `browser_mod.popup` service | ⚠️ third-party dependency (user-installed) |
| Pointer Events, IntersectionObserver, ResizeObserver, CSS filters/grid | ✅ evergreen browser APIs |

Minimum HA in `hacs.json` stays at 2023.9.0 — 2026.6-only features (grid options, entity suggestions) degrade gracefully on older versions.
