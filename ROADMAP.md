# Room Overlay Card — Roadmap

Current release: **v3.0.0** (2026-06-20). Verified against Home Assistant 2026.6.
**The original roadmap, the v2.0.0 milestone and the v3.0 backlog are complete.**
Post-roadmap releases (driven by real-world multiroom usage), the v1.13–v2.0
responsive + editor work, the v2.1–v2.2 fixes/features, and the v3.0
roadmap-completion release are below.

Legend: 🎯 should do · 💡 could do · 🔭 vision · ✅ shipped

---

## v1.4 — Polish & safety net — ✅ SHIPPED in v1.4.0 (2026-06-10)

| # | Item | Status |
|---|---|---|
| 1 | **CI smoke tests** — GitHub Action + `tests/smoke.test.js` | ✅ |
| 2 | **Editor undo/redo** — 50-step history, ↶/↷ buttons, Ctrl+Z / Ctrl+Y | ✅ |
| 3 | **Snap-to-grid & alignment guides** — 0.5 % grid, magnetic edges, Alt = free | ✅ |
| 4 | **Templates everywhere** — `visible_template:` on all element types, `label_template:` on badges | ✅ |
| 5 | **Relative-time labels** (`format: relative`), localized, 30 s ticker | ✅ |
| 6 | **Weather effects v2** — fog, lightning, heavy tiers, wind `angle:` | ✅ |
| 7 | **Icon preview in editor** — live `ha-icon` next to icon inputs | ✅ |

## v1.5 — Layout & interaction — ✅ SHIPPED in v1.5.0 (2026-06-10)

| # | Item | Status |
|---|---|---|
| 8 | **Responsive position profiles** — `mobile:` block + `mobile_breakpoint` | ✅ (generalized into tiers in v2.0.0) |
| 9 | **Light color visualization** — `color_from:` overlay tint | ✅ |
| 10 | **Draw-to-create zones** — rubber-band drag in test mode | ✅ |
| 11 | **Pan & pinch-zoom mode** — `zoom: true` | ✅ |
| 12 | **Entrance/exit animations** — `fade:` / `slide:` per element | ✅ |
| 13 | **Actions on gauges & labels** | ✅ |

## v2.0 vision — ✅ ALL SHIPPED

| # | Item | Shipped in |
|---|---|---|
| 14 | **Multi-room navigation** — `rooms:`, thumbnail nav, `switch-room`, presence follow (Bermuda), `card_id`, side-rail nav, finger-drag | v1.6.0 / v1.7.0 |
| 15 | **Editor live preview** — interactive preview inside the editor | v1.8.0 |
| 16 | **3D parallax tilt** — `parallax:` pointer + device orientation | v1.8.0 |
| 17 | **Theme preset gallery** — `PRESETS.md` | v1.8.0 |

## Post-roadmap releases (v1.9 – v1.12)

| Version | Highlights |
|---|---|
| v1.9.0 | `nav.width` (css / `auto` stretch), `nav.cards` — custom HA cards in the strip |
| v1.10.0 | `room_entity` per-device mapping (`by_user` / `by_browser`), nav chip pill styling |
| v1.10.1 | Side-rail `width: auto` collapse fix |
| v1.11.0 | `follow_mode`, nav **follow button** + `follow-room`, `room_state_entity` mirror, editor **Map this device** |
| v1.11.1 | Room swipe leaves gestures inside embedded cards alone |
| v1.12.0 | **`cards_above` / `cards_below`** — per-room companion strips |
| v1.12.1–2 | Mobile nav: wrap to rows, `nav.mobile_height` |

## v1.13 – v2.0 — Responsive & editor overhaul — ✅ SHIPPED

| Version | Highlights |
|---|---|
| v1.13.0 | **Responsive tiers** — `mobile`/`tablet`/`desktop`/`ultrawide` by container width; per-element `tablet:`/`desktop:`/`ultrawide:` overrides; per-tier `aspect_ratio`/`border_radius`; `breakpoints` |
| v1.13.1 | **`max_height`** — cap & center the image on wide screens (per-tier) |
| v1.13.2 | **Hold-gesture feedback** — progress ring fills + turns green on hold |
| v1.13.3–5 | Test-mode width/tier readout; per-tier scalars apply in test mode |
| v1.14.0–1 | Editor onboarding; **tabbed editor** (Image / Elements / Responsive / Rooms & menu) |
| v1.15.0 | Persistent header (room picker, Test mode, preview); Responsive tab owns image shape; dropped redundant Code tab |
| v1.15.1 | Drag-edit preview follows the selected room; **GUI room reorder** (▲▼) |
| v1.15.2 | **Companion cards in the GUI**; clearer room-icon label |
| **v2.0.0** | **Milestone.** Test-mode declutter (handles only on the selected element, click-to-select for all element types); full README rework; consolidated docs |

## v2.1 – v2.2 — post-2.0 fixes & features — ✅ SHIPPED

| Version | Highlights |
|---|---|
| v2.1.0 | **`lock_aspect`** — fixed-design-aspect stage so % elements stay glued to the image across tiers (per-tier `aspect_ratio` only changes the crop) |
| v2.1.1 | `lock_aspect: true` caches each image's natural ratio separately |
| v2.1.2 | `lock_aspect` measures every room's image (multi-room vertical-drift fix) |
| v2.1.3 | Test-mode **Save** searches the whole dashboard (no longer URL-view dependent → no more intermittent saves) |
| **v2.2.0** | **Mouse-wheel room switching** — `nav.wheel: horizontal \| vertical \| both` |

## v3.0 — Roadmap completion — ✅ SHIPPED in v3.0.0 (2026-06-20)

The v2.x backlog, closed out. Item 5 was dropped (the "Map this device" button
already covers the common path; full row editing stays YAML).

| # | Item | Status |
|---|---|---|
| 1 | **Nav/menu GUI block** — structured fields (style, position, height, width, mobile height, auto breakpoint, wheel, follow button); chips/cards stay YAML | ✅ |
| 2 | **Dedicated per-tier inputs** for `aspect_ratio` / `border_radius` / `max_height` — one cell per tier | ✅ |
| 3 | **Unified image-filter section** — `filter_conditions` + `brightness_model` behind one Conditional/Smooth mode switch | ✅ |
| 4 | **"Advanced" toggle** — hides per-item YAML textareas behind a header checkbox | ✅ |
| 5 | Row-builder for `room_entity` / `room_state_entity` mappings | ⛔ dropped (YAML stays for full row editing) |
| 6 | **URL hash deep-linking** — opt-in `url_sync` → bookmarkable `#room=<id>` | ✅ |
| 7 | **Full-room render** in the finger-drag neighbour preview (was base image only) | ✅ |

Also in v3.0: the nav **follow button** is now conditional — it only shows on
devices that resolve `room_entity` to a real presence sensor via an explicit
`by_browser` / `by_user` mapping.

## v3.1 vision — Live mini-room navigation 🎯 (planned, not yet committed to a release)

**Goal:** nav thumbnails become *true miniatures* of the room cards — the same base image,
filters, overlays, blinds and (optionally) gauges/labels, live-updating — instead of the current
base image + filter + 3 chips. "The menu is literally a scaled-down copy of what we built."

The card already contains both required building blocks: `_renderNeighbourPreview` (swipe drag)
and the editor's `_mountPreview` both create a full, non-interactive `room-overlay-card` instance
pinned to a specific room. The feature generalizes that pattern into the nav strip.

### Phase 1 — composite thumbnails (`nav.live: composite`) — cheap, ships first

Paint the room's *currently active* overlay images as stacked `background-image` layers inside
the existing thumbnail div, and keep applying the room filter (already done today). Reuses
`_ovImg()` + `resolveVal()`/`resolveFilter()` per thumbnail inside `_update()` — no extra card
instances, no template subscriptions, no timers.

| Aspect | Behaviour |
|---|---|
| Overlays | shown when opacity resolves > 0 (binary approximation of conditional opacity) |
| Base filter | as today (`filter_conditions`; add `brightness_model` support via `lerpFilterGradient`) |
| Blinds / gauges / labels / weather | **not** rendered in this phase |
| Perf cost | ~zero — a few extra background layers per thumb, updated in the existing `_update()` pass |
| Limits | `color_from` tint and per-overlay filters approximated or skipped |

### Phase 2 — full live minis (`nav.live: full`)

Each thumbnail hosts a real, non-interactive card instance rendered at a reference width and
scaled down, so px-based fonts/icons/gauges keep their exact proportions (a true miniature,
not a reflow):

- **Scaling:** host div = thumb size + `overflow:hidden`; inner `room-overlay-card` styled at
  `width: W_ref` (the main card's current width) with `transform: scale(thumbW / W_ref);
  transform-origin: top left;`.
- **Config transform for minis** (same recipe as `_renderNeighbourPreview`): `_roc_preview: true`,
  `nav: {style: none}` (recursion guard — a mini must never spawn its own nav), `test_mode: false`,
  `follow_mode: manual` + pinned `_roomIdx`, strip `url_sync`, `cards_above/below` (top-level and
  per-room), `zoom`, `parallax`.
- **Interactivity:** `pointer-events: none` on the mini; the host keeps click/keyboard → switch room.
- **hass forwarding:** parent forwards in `set hass` exactly like `_navCardEls` today; embedded
  IntersectionObserver already pauses off-screen minis.
- **Perf budget & knobs:**
  - `nav.mini.features:` allowlist — default `[overlays, filters, blinds]`; opt-in `gauges`,
    `labels`, `icons`, `weather`. Weather animations off by default (N animated layers is the
    single biggest GPU risk).
  - Templates: strip `visible_template` / `template` / `label_template` from mini configs by
    default (avoids rooms × templates WS subscriptions); `nav.mini.templates: true` to opt in.
  - Cameras: `camera_refresh` in minis clamped to ≥ 30 s (or disabled via `nav.mini.camera: false`).
  - Reuse instances across `_render()` where the config hash is unchanged; teardown via existing
    `disconnectedCallback`.
  - Documented practical cap ~8 rooms; log a console hint above that.
- **Editor:** nav style select gains "thumbnails — live minis"; chips still overlay on top.

**Risks:** GPU memory on old tablets (mitigated by feature allowlist + D2 `will-change` fix from
ANALYSIS_v3.0.6.md), template subscription multiplication (mitigated by default stripping),
recursion (guarded twice: `nav.style none` + `_roc_preview` never spawns minis).

## Future backlog (candidates, not committed)

- **ANALYSIS_v3.0.6.md** review: fix batches 1–4 ✅ shipped in **v3.0.7** (A3 declined).
  Remaining open ideas from the report: E3 draw-to-create palette, E4 edge/center
  snap guides, E5 editor list filter, E6 inline save-failure hint, E7 haptic on
  hold-registered, E8 → superseded by the v3.1 mini-room vision, D7 editor
  round-trip test harness.

## Maintenance (ongoing)

- **HACS default-repository submission** — validation action shipped in v1.8.0 ✅;
  remaining: repo topics + submission PR to hacs/default (now that v2.0.0 is out).
- **Fresh screenshots** for v2.0.0 (responsive, tabbed editor, test mode).
- **Watch-list of internal APIs** (re-verify on each HA major):
  - `lovelace/config` + `lovelace/config/save` WS (test-mode Save button) — undocumented but stable.
  - `window.browser_mod` (popup action) — third-party.
- **Optional migration**: `set hass` → `context-request` states subscription
  (recommended path; `hass` property remains fully supported, so no urgency).

---

## HA 2026.6 compatibility audit

| API used by the card | Status in HA 2026.6.2 |
|---|---|
| `setConfig` / `getCardSize` / `getStubConfig` / `getConfigElement` | ✅ current documented API |
| `getGridOptions()` (columns only, rows omitted) | ✅ documented; rows omitted so aspect-ratio drives height |
| `getEntitySuggestion` on `window.customCards` | ✅ implemented (camera suggestion) |
| `hass` property updates (card + editor) | ✅ standard; `context-request` is an optional alternative |
| `hass.callService(domain, service, data, target)` | ✅ stable |
| `render_template` WebSocket subscription (label templates) | ✅ current documented API |
| `window.loadCardHelpers().createCardElement` (embedded cards) | ✅ no deprecation; direct-create fallback kept |
| `config-changed` event from editor | ✅ current documented API |
| `lovelace/config` (+ `/save`) WS — Save button | ⚠️ internal API, works incl. sections layout + whole-dashboard search (v2.1.3); on watch-list |
| `haptic` window event | ✅ frontend convention; harmless no-op when unsupported |
| `browser_mod.popup` service | ⚠️ third-party dependency (user-installed) |
| Pointer Events, IntersectionObserver, ResizeObserver, CSS filters | ✅ evergreen browser APIs |

Minimum HA in `hacs.json` stays at 2023.9.0 — 2026.6-only features (grid options, entity suggestions) degrade gracefully on older versions.
