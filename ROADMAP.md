# Room Overlay Card — Roadmap

Current release: **v2.0.0** (2026-06-13). Verified against Home Assistant 2026.6.
**The original roadmap and the v2.0.0 milestone are complete.** Post-roadmap
releases (driven by real-world multiroom usage), the v1.13–v2.0 responsive +
editor work, and the remaining backlog are listed below.

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

## v2.x — Backlog (candidates, not committed)

1. **Nav/menu GUI block** — replace the nav YAML textarea in *Rooms & menu* with
   structured fields (style, position, height, width, chips, cards, follow button).
2. **Dedicated per-tier inputs** for `aspect_ratio` (today an object set in YAML
   locks the field with a "per-tier in YAML" hint).
3. **Unify the two image-filter sections** (`filter_conditions` + `brightness_model`)
   into one with a mode toggle.
4. **Hide per-item YAML textareas** behind an "Advanced" toggle inside each element.
5. **Row-builder for `room_entity` / `room_state_entity` mappings** — editable
   `by_browser` / `by_user` rows (today only "Map this device" covers the common path).
6. **URL hash deep-linking** (`#room=bedroom`) — bookmarkable rooms.
7. **Full-room render** in the finger-drag neighbour preview (currently base image only).

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
| `lovelace/config` (+ `/save`) WS — Save button | ⚠️ internal API, works incl. sections layout; on watch-list |
| `haptic` window event | ✅ frontend convention; harmless no-op when unsupported |
| `browser_mod.popup` service | ⚠️ third-party dependency (user-installed) |
| Pointer Events, IntersectionObserver, ResizeObserver, CSS filters | ✅ evergreen browser APIs |

Minimum HA in `hacs.json` stays at 2023.9.0 — 2026.6-only features (grid options, entity suggestions) degrade gracefully on older versions.
