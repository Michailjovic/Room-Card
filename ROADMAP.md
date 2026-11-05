# Room Overlay Card — Roadmap

Current release: **7.0.0** (2026-11-04). Verified against Home Assistant 2026.10.2; the install
text covers 2026.11's Marketplace.

The full record of every release is [`CHANGELOG.md`](CHANGELOG.md). Finished plans live in
[`docs/archive/`](docs/archive). This file only says where the card is going.

Legend: 🎯 agreed · 💡 candidate, not decided · 🔭 idea · 🅿️ parked · ⛔ not planned · ✅ done

---

## ✅ 7.0.0 — Studio, floor plan, AnyVac (2026-11-04)

Plan: [`V7_PLAN.md`](docs/archive/V7_PLAN.md). The card's own full-screen editor (**Room Card
Studio**), a **floor plan page** drawn from the vacuum map via [AnyVac](https://github.com/Michailjovic/anyvac)
or by hand, live vacuums on it, and the overview's cross-room signals. Phases 1–8 shipped as
v6.40.0–v6.51.0, Phase 9 in the 7.0.0 betas; 7.0.0 is 7.0.0-beta.4 with the documentation of
Phase 10. It is the first full release on GitHub since 6.25.1 — 6.30.0 to 7.0.0-beta.4 were
pre-releases. Release notes: [`RELEASE_NOTES_v7.0.0.md`](docs/releases/RELEASE_NOTES_v7.0.0.md).

Left over from Phase 10:

- [x] Studio GIFs in [`docs/STUDIO.md`](docs/STUDIO.md): device frames, select / move / undo, add by drawing, turning the floor plan
- [ ] The install text checked against a real Home Assistant 2026.11 Marketplace (labels taken
  from its documentation)

## 🎯 Next — 7.1

- **The Classic editor goes.** The 6.x tabbed editor stays behind *Classic editor* for one minor
  release after 7.0.0 (V7_PLAN §8), then is removed. `src/editor/` is about half of the main
  file's sources, which every wall tablet downloads and parses today.

## 💡 Candidates for 7.x (not decided)

- **Devices from one source**, steps 1–2: the floor plan resolves a room's lights / climate /
  sensors live from the room instead of copying them at import; a blind tagged into a section
  renders its own cover control there. Proposed 2026-10-26, waiting for the author.
- **Multi-floor homes** — one floor plan page per floor (V7_PLAN §11.4).
- **Openings in the `thermal` and `tiles` themes** ([FLOORPLAN.md](docs/FLOORPLAN.md#coming-next)).
- **Inline save-failure hint** (old E6) wherever a save can still fail silently.

## 🔭 v8 idea — furniture on the floor plan

[`V8_PLAN.md`](V8_PLAN.md). Stylised furniture drawn by each theme, with control through the
objects. Undecided; a Phase 0 prototype on the author's plan exists (V8_PLAN §2a).

## 🅿️ Parked · ⛔ not planned

- 🅿️ **Device packs / a `devices:` registry** — shareable device visuals bound to your own
  entities ([COCKPIT_PLAN D14](docs/archive/COCKPIT_PLAN.md)); needs a way to distribute them.
- 🅿️ **`day_night` blind: a fully transparent residual sliver.** The phase is calibrated since
  v6.1.0 (`shift_turns` / `shift_start` / `shift_snap`); with the two-layer renderer the topmost
  visible row of a fill is always opaque. Not without side-by-side photos of a real blind.
- ⛔ **AI inside the card** (e.g. drafting zones through HA's `ai_task`) — models change too fast
  for a finished product. The card is documented for AIs instead: [`docs/AI_SPEC.md`](docs/AI_SPEC.md),
  [`llms.txt`](llms.txt).
- ⛔ **Vacuum control and energy panels inside the card** — AnyVac / anyvac-card and
  electricity-panel-card own those; the card shows, links and embeds (V7_PLAN non-goals,
  COCKPIT_PLAN D12).
- ⛔ **Merging `groups` into sections** (COCKPIT_PLAN D13) — two different layouts, a migration
  for every existing config, no gain.

---

## ✅ In the default catalog (HACS / Marketplace)

The card is in HACS's default list (`hacs/default` → `plugin`), so it installs from Home Assistant
2026.11's Marketplace and from HACS by searching for *Room Overlay Card*. What keeps it there:

1. The HACS validation Action in CI (`hacs/action`, `category: plugin`) passes with no ignores.
2. Full GitHub releases (not just tags), with the assets attached and verified by `release.yml`.
3. `hacs.json` with `name` and `filename`; the MIT licence recognised by GitHub.
4. A README with images; the repo's description, topics and issues.

## Maintenance (ongoing)

- **Internal APIs on the watch-list** (re-verify every HA major):
  - `lovelace/config` (+ `/save`) WebSocket — the studio's save straight to the dashboard;
    undocumented but stable.
  - `window.browser_mod` (popup action) — third-party.
- **Optional migration:** `set hass` → a `context-request` states subscription (the `hass`
  property stays fully supported).
- Minimum HA in `hacs.json` stays at 2023.9.0; newer-only features (grid options, entity
  suggestions) degrade gracefully.

---

## History (condensed)

| Line | Highlights | Plan |
|---|---|---|
| **7.0.0** (2026-11-04) | studio as the default editor, docs set (getting started, studio, overview, floor plan, reference, AI spec), live demo, floor plan walls and free rotation, field-test fixes (betas 1–4) | [V7_PLAN](docs/archive/V7_PLAN.md) |
| **v6.40–v6.51** | v7 phases 1–8: `src/` + schema, studio shell → canvas → forms → wizard, floor plan page, presence / media / markers, doors and windows, AnyVac live vacuums | [V7_PLAN](docs/archive/V7_PLAN.md) |
| **v6.30–v6.31** | overview page: every room as a live tile, header, side columns, section dock, zoom transition | [OVERVIEW_PLAN](docs/archive/OVERVIEW_PLAN.md) |
| **v6.16–v6.25** | design refresh, native light pills, action builder, entity fields, preview + undo, js-yaml, persistent nav strip | — |
| **v6.8–v6.15** | cockpit sections and panels, image / auto / declared tiles, editor audit fixes | [COCKPIT_PLAN](docs/archive/COCKPIT_PLAN.md) |
| **v6.0–v6.7** | documentation overhaul, `day_night` calibration, vacuum widget, light glows, overlay `transform:` | — |
| **v5.x** | layout engine cleanup + geometry harness, `top_offset`, live mini nav (`full` / `custom`), haptics, editor revalidation | [V5_PLAN](docs/archive/V5_PLAN.md), [NAV_LIVE_FULL_PLAN](docs/archive/NAV_LIVE_FULL_PLAN.md), [EDITOR_UX_REVALIDATION](docs/archive/EDITOR_UX_REVALIDATION.md) |
| **v4.x** | layout engine rebuild: portrait / landscape profiles, % grid regions, cover dock / float | [LAYOUT](LAYOUT.md) |
| **v3.x** | live nav (`composite`), `light_controls`, cover control | — |
| **v1–v2** | overlays, zones, icons, labels, gauges, blinds, multi-room, presence follow, responsive tiers, the editor | — |

Unused version numbers: v5.2.0, v5.3.0, v6.26–v6.29, v6.32–v6.39.
