# Room Overlay Card — Roadmap

Current release: **v1.12.2** (2026-06-12). Verified against Home Assistant 2026.6.
**The original roadmap is complete.** Post-roadmap releases (driven by real-world
multiroom usage) and the current backlog are listed at the bottom.

Legend: 🎯 should do · 💡 could do · 🔭 vision · ✅ shipped

---

## v1.4 — Polish & safety net — ✅ SHIPPED in v1.4.0 (2026-06-10)

| # | Item | Status |
|---|---|---|
| 1 | **CI smoke tests** — GitHub Action + `tests/smoke.test.js` (34 assertions) | ✅ |
| 2 | **Editor undo/redo** — 50-step history, ↶/↷ buttons, Ctrl+Z / Ctrl+Y | ✅ |
| 3 | **Snap-to-grid & alignment guides** — 0.5 % grid, magnetic edges, Alt = free | ✅ |
| 4 | **Templates everywhere** — `visible_template:` on zones/icons/badges/overlays/elements/gauges/blinds, `label_template:` on badges | ✅ |
| 5 | **Relative-time labels** (`format: relative`), localized, 30 s ticker | ✅ |
| 6 | **Weather effects v2** — fog, lightning, heavy tiers, wind `angle:` | ✅ |
| 7 | **Icon preview in editor** — live `ha-icon` next to icon inputs | ✅ |

## v1.5 — Layout & interaction — ✅ SHIPPED in v1.5.0 (2026-06-10)

| # | Item | Status |
|---|---|---|
| 8 | **Responsive position profiles** — `mobile:` block + `mobile_breakpoint` (600 px default) | ✅ |
| 9 | **Light color visualization** — `color_from:` overlay tint from `rgb_color` / `color_temp_kelvin` | ✅ |
| 10 | **Draw-to-create zones** — rubber-band drag on empty area in test mode | ✅ |
| 11 | **Pan & pinch-zoom mode** — `zoom: true`, 1–4×, double-tap reset, Ctrl+wheel | ✅ |
| 12 | **Entrance/exit animations** — `fade:` / `slide:` per element | ✅ |
| 13 | **Actions on gauges & labels** — tap/hold/double-tap + keyboard | ✅ |

## v2.0 — Vision (long-term)

| # | Item | Why |
|---|---|---|
| 14 | ✅ **Multi-room navigation** — v1.6.0: `rooms:`, thumbnail nav with live filters + `{room}` chips, `switch-room` door zones, `room_entity` presence follow (Bermuda), `card_id`. v1.7.0: `nav.position: auto` side rail on ultrawide, finger-attached filmstrip drag, snow effect v3 | One card per flat instead of one per room |
| 15 | ✅ **Editor live preview** — SHIPPED in v1.8.0: interactive preview (forced test mode) inside the editor dialog; `getConfigForm` hybrid evaluated and rejected (custom editor is richer) | Today preview lives in the dashboard behind the editor dialog |
| 16 | ✅ **3D parallax tilt** — SHIPPED in v1.8.0: `parallax:` pointer + device orientation, pauses during gestures | Depth illusion from layered PNGs |
| 17 | ✅ **Theme preset gallery** — SHIPPED in v1.8.0: `PRESETS.md` copy-paste recipes | Community building block |

## Post-roadmap releases (v1.9 – v1.12)

| Version | Highlights |
|---|---|
| v1.9.0 | `nav.width` (css / `auto` stretch), `nav.cards` — custom HA cards embedded in the strip |
| v1.10.0 | `room_entity` per-device mapping (`by_user` / `by_browser`), nav chip pill styling |
| v1.10.1 | Side-rail `width: auto` collapse fix |
| v1.11.0 | `follow_mode` (always/initial/manual), nav **follow button** + `follow-room` action, `room_state_entity` mirror, editor **Map this device**, swipe-vs-tap fix, `nav.cards` placement |
| v1.11.1 | Room swipe leaves gestures inside embedded cards alone |
| v1.12.0 | **`cards_above` / `cards_below`** — per-room companion strips in document flow, `media: all\|mobile\|desktop` |
| v1.12.1–2 | Mobile nav: wrap to rows (thumbs → ticker + follow button), `nav.mobile_height` |

## v2.0.0 (planned — after a real-world testing period)

1. **GUI for `cards_above` / `cards_below`** — add/remove/reorder entries,
   YAML card content, `media` + `height` fields, per room.
2. **Row-builder for `room_entity` / `room_state_entity` mappings** — editable
   list of by_browser/by_user rows (today only "Map this device" covers the
   common path).
3. **UX pass over the whole GUI editor** — consistency, grouping, labels,
   discoverability of YAML-only options, mobile editor usability.
4. **README rework + fresh screenshots** covering multiroom, nav, presence
   follow, companion strips, weather v3, radial gauges, sliders.
5. Release **v2.0.0** (then HACS default-repository submission).

## Backlog (candidates, not committed)

- URL hash deep-linking (`#room=bedroom`) — bookmarkable rooms, navigate-to-room from other dashboards, per-browser path conditioning via browser_mod.
- Full-room render in the finger-drag neighbour preview (currently base image only).

## Maintenance (ongoing)

- **HACS default repository submission** — validation action added in v1.8.0 ✅; remaining: repo topics + submission PR to hacs/default.
- **Screenshots refresh** for 1.3 features (radial gauges, sliders, weather, templates).
- **Watch-list of internal APIs** (re-verify on each HA major):
  - `lovelace/config` + `lovelace/config/save` WS (test-mode Save button) — undocumented but stable; sections layout handled.
  - `window.browser_mod` (popup action) — third-party.
- **Optional migration**: `set hass` → new `context-request` states subscription (HA now documents it as the recommended data path; `hass` property remains fully supported, so no urgency).

---

## HA 2026.6 compatibility audit (v1.3.1)

| API used by the card | Status in HA 2026.6.2 |
|---|---|
| `setConfig` / `getCardSize` / `getStubConfig` / `getConfigElement` | ✅ current documented API |
| `getGridOptions()` (columns only, rows omitted) | ✅ documented; rows intentionally omitted so aspect-ratio drives height |
| `getEntitySuggestion` on `window.customCards` | ✅ new in 2026.6 — implemented (camera suggestion) |
| `hass` property updates (card + editor) | ✅ standard; `context-request` is an optional alternative |
| `hass.callService(domain, service, data, target)` | ✅ stable |
| `render_template` WebSocket subscription (label templates) | ✅ current documented two-phase subscribe API |
| `window.loadCardHelpers().createCardElement` (embedded cards) | ✅ no deprecation; direct-create fallback kept |
| `config-changed` event from editor | ✅ current documented API |
| `lovelace/config` (+ `/save`) WS — Save button | ⚠️ internal API, works incl. sections layout; on watch-list |
| `haptic` window event | ✅ frontend convention; harmless no-op when unsupported |
| `browser_mod.popup` service | ⚠️ third-party dependency (user-installed) |
| Pointer Events, IntersectionObserver, ResizeObserver, CSS filters | ✅ evergreen browser APIs |

Minimum HA in `hacs.json` stays at 2023.9.0 — 2026.6-only features (grid options, entity suggestions) degrade gracefully on older versions.
