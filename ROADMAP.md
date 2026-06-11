# Room Overlay Card — Roadmap

Current release: **v1.4.0** (2026-06-10). Verified against Home Assistant 2026.6.

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

## v1.5 — Layout & interaction (mid-term)

| # | Item | Why |
|---|---|---|
| 8 | 🎯 **Responsive position profiles** — optional `mobile:` block (top/left/size overrides) applied under a viewport breakpoint | Phone layouts currently need a second card |
| 9 | 💡 **Light color visualization** — overlay tint auto-derived from a light's `rgb_color` / `color_temp` | RGB lighting without one PNG per color |
| 10 | 💡 **Draw-to-create zones** — drag on empty card area in test mode creates a zone | Faster than add-in-editor + drag + resize |
| 11 | 💡 **Pan & pinch-zoom mode** for large floorplans on mobile | Whole-flat plans are unusable at phone width |
| 12 | 💡 **Entrance/exit animations** per element (fade/slide on visibility change) | Group fade exists; per-element `visible` is still instant |
| 13 | 💡 **Actions on gauges & labels** (currently `pointer-events: none`) | Tap a gauge → more-info is a natural expectation |

## v2.0 — Vision (long-term)

| # | Item | Why |
|---|---|---|
| 14 | 🔭 **Multi-room navigation** — room switcher / swipe between room configs inside one card | One card per flat instead of one per room |
| 15 | 🔭 **Editor revamp** — split-pane live preview + form; evaluate `getConfigForm` hybrid for basic settings | Today preview lives in the dashboard behind the editor dialog |
| 16 | 🔭 **3D parallax tilt** (device orientation / mouse) | Depth illusion from layered PNGs |
| 17 | 🔭 **Theme preset gallery** — shareable YAML snippets (night modes, seasons) | Community building block |

## Maintenance (ongoing)

- **HACS default repository submission** — add HACS validation action, repo topics; README/CHANGELOG already compliant.
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
