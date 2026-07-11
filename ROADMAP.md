# Room Overlay Card — Roadmap

Current release: **v4.5.0** (2026-07-11). Verified against Home Assistant 2026.6.

**The original roadmap, the v2.0.0 milestone, the v3.0 backlog, and the entire
v3.1 – v4.5 feature run are complete.** The card is feature-complete for daily
use — remaining work is one big optional vision item (live mini-room nav),
a short editor/UX polish backlog, and a planned **v5.0** pass over the GUI + docs.

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

---

## 🔭 Live mini-room navigation — Phase 2 (`nav.live: full`) — planned, not committed

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
| E7 | **Haptic on hold-registered** | 🎯 next candidate — fire a haptic tick the moment a hold action registers |
| E3 | Draw-to-create for all element types | rubber-band currently makes zones only |
| E4 | Edge / centre snap guides | complements the 0.5 % grid + edge snap |
| E5 | Editor list filter / search | for long element lists |
| E6 | Inline save-failure hint | surface a failed Save in-editor |
| D7 | Editor round-trip test harness | automate collect → config → re-render checks |

## 🔭 v5.0 — GUI/UX revalidation + GitHub overhaul — planned (later)

A dedicated milestone, to be started later:

1. **Complete UX/GUI revalidation** — a full pass over the editor for consistency and
   discoverability (the control surface has grown a lot across v3–v4 and is getting hard
   to navigate, even for the author). Bump to **v5.0** on completion.
2. **GitHub content overhaul** — a much more detailed, beginner-friendly guide/README
   and fresh screenshots reflecting the v4 layout engine, cover control, light controls
   (sliders + switches), and the current editor.

## 🅿️ Parked

- **`day_night` blind model** — three failed attempts (v3.0.1–3.0.3); reverted to the
  v3.0.0 two-layer look. Do **not** re-attempt without a precise description of the real
  blind's motor-%→visual mapping (ideally side-by-side at specific positions).

## Maintenance (ongoing)

- **HACS default-repository submission** — validation action shipped in v1.8.0 ✅;
  remaining: repo topics + submission PR to `hacs/default`.
- **Fresh screenshots** — current ones predate the v4 layout engine, cover control and
  light controls; to be redone as part of the v5.0 GitHub overhaul.
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
