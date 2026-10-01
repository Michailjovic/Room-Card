# Room Overlay Card — complete review (v6.15.9)

Date: 2026-10-01 · Scope: `room-overlay-card.js` (8 637 lines / 606 KB), `docs/`, `tests/`, repo layout,
plus the **live dev dashboard** (`/living-room/test#cockpit=…`, HA 2026.9.4, 6 rooms, `nav.live: full`,
5 cockpit sections, 4 093 entities).

Method: static read of the card + editor, baseline test run, a new reproduction probe
(`tests/probes/probe_v6_15_9.js` — not wired into `npm test`), and measurements taken in the real
dashboard through the browser (timings, DOM counts, console) — re-run once HA had fully started.

**Status update (v6.16.0, 2026-10-01):** Part 1 #1–#7 fixed (the formatter covers #1/#2), Part 2
done (`rocFmtState`), design tokens + section-launcher status + nav chip/thumbnail styling shipped.
Still open: #8 YAML parser (→ vendored js-yaml), #9/#10 editor preview, `_render()` split + persistent
nav on room switch, editor redesign (action builder, entity picker, Sections WYSIWYG, phone grids),
README/AI_SPEC/HACS. v6.17.0: light strip as built-in pills (`light_controls.style: native`, opt-in until
tested on a wall tablet) + cover control restyled with the tokens (same size).
v6.18.0: editor action builder (zones, icons, tiles, room tap) — done.
v6.19.0: entity suggestions with names + domain filter, entity/ID checks, phone-width grids — done.
Design mockup: Claude artifact "Room Card – návrh designu".

**Baseline:** `smoke` + `render` (773 PASS) + `lifecycle` (42 PASS) all green. Every finding in
Part 1 is reproduced by the probe — 12/12 FAIL on the unmodified source.

**Overall verdict:** the card is in good shape. The state-update hot path is excellent (64 µs of own
work per `hass` push, 0.22 ms per `_update()` measured live), the lifecycle hardening from v4.6–v6.15 holds,
and the previous audit's fixes are all in place. What I would change falls into four buckets:
how values are *displayed* (raw states, no localisation), a handful of small logic bugs, the size of
two functions that now block performance work, and the public face of the project (README, AI spec,
HACS) lagging far behind what the card can actually do.

---

## TL;DR — what I would do, in order

| # | Change | Why | Effort |
|---|--------|-----|--------|
| 1 | **One shared value formatter** for labels, nav chips and cockpit tiles, built on `hass.formatEntityState()` | Live dashboard shows `unavailable°`, `off`, `inactive`, `ready`; timestamps render as `2026` | 2–3 h |
| 2 | **Five one-line logic fixes** (Part 1, #3–#7) | Real bugs, trivially fixable | 30 min |
| 3 | **Replace the hand-rolled YAML subset with vendored `js-yaml`** | Closes old bug #9 for every box at once, zero Lit/HA-component risk | 2 h |
| 4 | **Split card `_render()` (1 221 lines) into named phases**, then keep the nav strip + live minis across room switches | A swipe costs ~164 ms to paint on desktop (one 100–150 ms long task); all 6 minis are rebuilt every time (0/72 reused) | 1 day |
| 5 | **README + `docs/AI_SPEC.md` + `llms.txt` + cockpit preset** | The headline feature of v6.8–6.15 (cockpit) is not mentioned in the README at all | 1 day |
| 6 | **HACS default-repo submission** | Everything above is what a new user sees first | ½ day |
| 7 | Editor polish: phone-width grids, id validation, preview receives scalar edits (#7), recipe guard | Known, small, cumulative | 1 day |
| 8 | Time-boxed **live diagnostic session** to unblock B3/B4 | The "need real devtools" blocker can now be met (see Part 4) | 1–2 h |

---

## Part 1 — Bugs (all reproduced, `tests/probes/probe_v6_15_9.js`)

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | Label/chip value: `parseFloat` treats any state *starting* with a digit as a number → ISO timestamp `2026-10-01T05:00…` shows **`2026`**, `12:30` shows **`12`** | **P2** | part of TL;DR #1 |
| 2 | Label/chip/tile: `unavailable` / `unknown` get the unit glued on (`unavailable°`, `unavailable%` — seen live on the living-room thumbnail while HA was starting); non-numeric states are shown raw (`off`, `inactive`, `ready`, door `on` instead of `Open`) | **P2** (looks broken) | part of TL;DR #1 |
| 3 | `evalCond`: `state: [heat, heat_cool]` (HA-style list) never matches — `sv===String(c.state)` compares against `"heat,heat_cool"`. `state_not` already accepts a list, `state` doesn't | P2 | 2 min |
| 4 | `grouping_code` exclusivity in `_exec` (show-/toggle-group) reads `this._config.groups` — the **top-level** list — but `groups` is a `ROOM_KEYS` key. With per-room `groups:` (any `rooms:` config) radio-style groups never hide each other | P2 | 2 min |
| 5 | `toggle-group` on a group that elements reference but `groups:` doesn't declare: render treats it as visible (`??true`), the toggle as hidden (`??false`) → **first tap does nothing** | P3 | 1 min |
| 6 | "Warn once" id warnings fire on **every** `setConfig` of every instance (live: **6 identical warnings per room switch** — each rebuilt nav mini re-runs the check; 448 lines after ~5 min of testing) | P3 (console spam hides real errors) | 5 min |
| 7 | `_exec` has no `fire-dom-event` (the standard Lovelace hook that browser_mod 2 popups and many custom actions use — `ll-custom`). `assist` is also missing | P3 | 10 min |
| 8 | Editor YAML subset (old #9, still open): its own dump of a multi-line string (any multi-line Jinja `template:`) parses back to `null`; `action: toggle # note` → action `"toggle # note"` (silent!); block scalars `|`/`>` → `null`. Anchors are kept as literal text | P2 | TL;DR #3 |
| 9 | Old #7 — in-editor Edit-mode preview never receives scalar edits (still open; `_fire()` doesn't reach `_prevCard`) | P2 | 20 min |
| 10 | Old #15 — every drag-drop in Edit mode rebuilds the editor and remounts the preview (still open) | P3 | with #9 |

### Suggested fixes

- **#3** `if(c.state!==undefined)r=Array.isArray(c.state)?c.state.map(String).includes(sv):sv===String(c.state);`
- **#4** both lines in the group branch of `_exec`: `(this._roomCfg||this._config).groups`.
- **#5** in `_exec`: `!(this._groupState[a.group]??true)` — same default the renderer uses for undeclared groups
  (declared groups are always initialised in `_render`, so they're unaffected).
- **#6** a module-level `const ROC_WARNED=new Set()`; key = message; skip if seen. Also skip the checks
  entirely for `_roc_mini`/`_roc_ghost` configs (they're derived from a config that was already checked).
- **#7** `case'fire-dom-event':this.dispatchEvent(new CustomEvent('ll-custom',{bubbles:true,composed:true,detail:a}));break;`
  and add it to the editor's action dropdown.
- **#1/#2** see Part 2.
- **#8** see Part 4.

---

## Part 2 — How values are displayed (biggest visible issue)

Three separate code paths format an entity value, each slightly differently: labels (`_update`),
nav chips (`_updateNav`), cockpit tiles (`_updateSectionTiles`). All three do
`parseFloat(state)` → `toFixed(decimals)` or `Math.round()` → `+ suffix`.

Consequences seen on the live dashboard:

- `unavailable°` / `unavailable%` on the living-room thumbnail while its Shelly H&T was unavailable during HA start-up.
- Appliance tiles read `off`, `inactive`, `ready`, `inactive` — raw machine states. HA itself would show
  `Off`, `Inactive`, `Ready`; a `binary_sensor` door with `device_class: door` would show `Open`, not `on`,
  and a Czech-language HA user would get Czech. `hass.formatEntityState()` exists on this HA (checked live)
  (keep a raw-state fallback for older installs that lack it).
- Without `decimals:` every number is rounded to an integer (21.6 °C → `22`) — ignores the entity's own
  display precision. Probably intentional, but surprising.
- Decimal separator is always `.` — Czech users expect `,`.

**Proposal — one helper, `rocFmtState(hass, stateObj, opts)`, used by all three paths:**

1. `unavailable` / `unknown` → a neutral `—` (configurable), never with prefix/suffix.
2. A state is numeric only if `/^\s*-?\d+(\.\d+)?\s*$/` matches (fixes `2026`, `12`).
3. Numeric **and** the user set `decimals:` / `suffix:` → today's behaviour (backwards compatible),
   but format via `Intl.NumberFormat(hass.locale.language)` so the separator is local.
4. Otherwise (no explicit formatting, or a non-numeric state) → `hass.formatEntityState(stateObj)`,
   which gives translation, device-class wording, unit and the entity's precision for free.
5. `format: raw` as the escape hatch for anyone who wants the old output.

This is the single change with the most visible effect for new (especially non-English) users,
and it removes three copies of the same logic.

---

## Part 3 — Performance & architecture

### Measured live (desktop, Chrome, dpr 1.25, tab in foreground)

Re-measured on 2026-10-01 ~07:50 after HA had fully started (the first pass ran while HA was still
booting). Medians of repeated runs.

**State updates — 116 `hass` pushes in 30 s (3.9/s), none relevant to the active room:**

| What | Result | Verdict |
|---|---|---|
| Card's own work per `hass` push (change detection + forwarding to 6 minis) | **64 µs** | excellent — leave it |
| `_update()` full state pass / `_updateNav()` | **0.22 ms / 0.04 ms** | excellent |
| Third-party `alert-ticker-card` in `nav.cards`, per push | **avg ~10 ms, max 118 ms** | **904 ms of main thread in 20 s (~4.5 %)** — ~99 % of the subtree's hass cost. Not this card's code. |
| Template subscriptions | 13 (main card only; minis correctly opt out) | fine |

**Room switch — 12 consecutive switches through all 6 rooms:**

| What | Result |
|---|---|
| Synchronous JS in `_switchRoom()` | **35 ms** median (33–41) |
| Until the new room is painted (2× rAF) | **164 ms** median (134–202) — baseline for 2 frames is ~33 ms |
| Long tasks | **one per switch, 100–150 ms** (zero long tasks in 8 s of idle) |
| Live minis reused across a switch | **0 / 72** — every switch destroys and recreates all 6 minis + the nav card |
| Same-room re-render (`_render()` without switching) | 34 ms JS / 131 ms to paint |
| Parsing the card's 16.8 KB `<style>` | 0.57 ms — *not* the bottleneck |

**What the switch cost is made of** (same dashboard, config changed in memory only, 8 switches each):

| `nav` variant | JS | To paint |
|---|---|---|
| `live: off` | 12 ms | 110 ms |
| `live: composite` | 12 ms | 108 ms |
| `live: full`, without `nav.cards` | 33 ms | 141 ms |
| `live: full` + ticker card (your real config) | 34 ms | 160 ms |

Reading: the live minis add ~21 ms of JS and ~30 ms to paint, recreating the ticker card another ~20 ms
— together ~30 % of a switch. The remaining **~110 ms is the full shadow-DOM rebuild itself** (layout +
paint of the whole card and recreation of its embedded cards), present even with `live: off`. On a wall
tablet, expect 4–6× these numbers, i.e. **0.5–1 s per swipe**. Before optimising the base part, take one
DevTools *Performance* recording of a switch to split layout vs. paint vs. embedded-card creation.

### The structural problem

| Function | Lines | Size |
|---|---|---|
| Card `_render()` | 1 221 | 100 KB (17 % of the file) |
| Card `_update()` | 333 | 21 KB |
| Editor `_render()` | 662 | 67 KB |
| Editor `_listen()` | 976 | 52 KB |
| Editor `_collectConfig()` | 748 | 49 KB |

`_render()` rebuilds the whole shadow DOM (`shadowRoot.innerHTML=…`) and is the only entry point for
room switch, profile flip and config change. That's why the nav strip and every live mini are recreated on
each swipe — there is no smaller unit to call. The perf fix (keep the nav strip, just move the active
class) is easy *once the function is split*, and close to impossible to do safely before.

**What I'd do:** split `_render()` mechanically into named phases in the same file — e.g.
`_renderRoot()`, `_renderNav()`, `_renderStage()`, `_renderElements()`, `_renderSections()`,
`_renderLightControls()`, `_wireRender()` — no behaviour change, verified by the existing 773 render + 42 lifecycle assertions +
the Playwright geometry tier. Then make `_switchRoom()` call only the stage/element phases and leave the
nav DOM (and its minis) alone.

**What I would *not* do:** port to Lit/TypeScript, or reintroduce a `src/` + bundler. The single-file,
no-dependency approach is working, the tests cover it, and a rewrite would throw away months of
live-verified edge-case fixes.

### Smaller items

- **`prefers-reduced-motion` is not respected anywhere** — 22 `@keyframes` (pulse, glow, flicker, spin,
  rain/snow, vacuum motion). One `@media (prefers-reduced-motion: reduce)` block that sets decorative
  infinite animations to `none` is ~10 min and matters for wall-tablet battery too.
- Section panel: `role="dialog"` but no `aria-modal="true"`.
- A few Czech comments left in published code (`resolveFilterInverted`, group-state init ~line 2108) — the rest of the file is English.
- Embedded/nav cards get `hass` even while the card is off-screen (by design, "so they're current").
  With a heavy embedded card that's real cost; optional: forward only while visible + once on becoming
  visible (the IO already exists).

---

## Part 4 — Editor / UX

1. **YAML boxes → vendored `js-yaml`** (MIT, ~40 KB min / ~13 KB gz, pure function). Replace
   `_yParse`/`_yDump` behind the existing `_yaml.p/_yaml.s` facade. This closes bug #8/#9 *completely*
   and — unlike the reverted B1 `<ha-yaml-editor>` spike — involves no HA component, no upgrade timing and
   nothing jsdom can't test. Same textarea, same C1 inline errors, correct parser.
2. **Id field validation.** The editor accepts any text as an id; the live config has
   `Roleta Bedroom` / `Roleta living room`. It works (attribute selectors are quoted) but triggers the
   warning spam and is a latent selector bug. Use the C1 pattern: inline hint + "use `roleta_bedroom`"
   auto-fix button.
3. **Phone width:** 14× `repeat(4,1fr)` and 6× `repeat(3,1fr)` field grids, **zero `@media` rules** in the
   editor. In HA's full-screen phone editor that's ~75 px per input. One media query that drops these to
   2 columns below ~500 px.
4. **Preview gets scalar edits** (old #7) — push a debounced `setConfig` to `_prevCard` from `_fire()`,
   the same way `_lyDebouncedUpdate()` already does for Layout. Fix #15 (drag remount) in the same pass.
5. **Electricity recipe** still hard-codes `custom:electricity-panel-card` (the author's own card). Offer it
   only when `customElements.get('electricity-panel-card')` exists — other users get a "not registered"
   panel today.
6. **Card picker preview:** `getStubConfig()` points at `/local/room.webp`, which doesn't exist on anyone's
   install, and `customCards` has `preview:true` → an empty card in the picker. A tiny inline SVG data-URI
   room sketch makes the first impression in HACS look intentional.
7. **B3/B4 (`ha-selector` / `ha-entity-picker`) are on hold "until real browser devtools data exists".**
   That condition can now be met: this review drove the live dashboard, read the console and timed
   internals from inside the page. A 1–2 h diagnostic session on a dev build — set `window.ROC_DEBUG=true`,
   type into a `<ha-yaml-editor>` spike, log `_requestPin` reasons + `_pvMo` callbacks — would confirm or
   kill the MutationObserver theory with data instead of a third blind fix. Decide B3/B4 after that,
   not before.

Already rejected earlier, not re-proposed: regrouping Elements by intent, per-section search.

---

## Part 5 — Product, docs, HACS

- **README doesn't mention the cockpit at all** (sections, panels, tiles, image tiles, auto tiles, recipes)
  — the feature that took v6.8–v6.15. Feature table + one screenshot of the open "Spotřebiče"-style panel.
  Hero/editor screenshots are from v6.0.
- **`docs/AI_SPEC.md` + `llms.txt` — not started**, although COCKPIT_PLAN §9 names "another AI can read the
  repo and configure it" as a stated product goal and says new keys go in "from the start". Generate a
  first version from `docs/CONFIGURATION.md` (44 sections) and keep it next to it.
- **Cockpit preset in `PRESETS.md`** — planned "once v6.9.0 is out", not there.
- **`ROADMAP.md` says "Current release: v6.15.0"** — it's 6.15.9.
- **HACS default repository** — still the pending milestone. Items 1, 5 and 6 of the TL;DR are what a
  first-time HACS user hits; I'd do them before submitting.
- **Repo hygiene (public GitHub):** `Claude outputs/` (16 files — mockup PNGs and the author's own
  dashboard YAML) is tracked; four historical analysis/plan files sit in the root; `bedroom-card.yaml` is
  tracked although `.gitignore` lists it (and currently shows a whole-file diff — line endings). Suggest
  `docs/archive/` for the plans/analyses and untracking the personal files.

---

## Part 6 — Your own dashboard (not card bugs)

- `Kitchen-LG.png` is a **1.0 MB PNG**; every other room/overlay image is WebP ≤ 0.2 MB. Converting it to
  WebP is the cheapest win for the kitchen's first paint.
- The `cockpit` room inherits the global `nav.chips`, which resolve to non-existent
  `sensor.cockpit_shelly_…` entities (rendered empty — harmless; `chips: []` on that room makes it explicit).
- Blind ids `Roleta Bedroom` / `Roleta living room` → rename to `roleta_bedroom` / `roleta_living_room`.
- `alert-ticker-card` costs ~10 ms on average (up to 118 ms) on **every** state change in the house —
  ~4.5 % of the main thread on a desktop, several times that on a tablet. If that's your own card, its
  `set hass` is the place to look (most likely it re-renders on every push without checking whether its own entities changed — not verified).

---

## Part 7 — Suggested release plan

| Version | Contents |
|---|---|
| **v6.15.10** | Part 1 #3–#7 (logic one-liners + warning dedupe + `fire-dom-event`), reduced-motion block, `aria-modal`, Czech comments → English, ROADMAP line. Probe items flip to PASS → move them into `render.test.js`. |
| **v6.16.0** | `rocFmtState()` for labels/chips/tiles (+ `format: raw`), vendored `js-yaml` for all YAML boxes. |
| **v6.16.x** | Editor: phone-width grids, id validation, preview scalar edits (#7/#15), recipe guard, stub preview. |
| **v6.18.0+** | `_render()` split (no behaviour change) → persistent nav strip/minis on room switch. |
| docs | README cockpit section + screenshots, `AI_SPEC.md` + `llms.txt`, cockpit preset → **HACS submission**. |
| parked | B3/B4 after the live diagnostic session; floorplan v7 stays parked. |
