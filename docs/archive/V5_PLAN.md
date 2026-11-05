# v5.0 Plan — Layout Engine Cleanup & Regression Harness

Scope agreed 2026-07-17. v4.6.0→4.6.4 fixed the viewport/edit-mode behaviour but left
five generations of overlapping trigger mechanisms in place. v5.0 consolidates them —
**no behaviour changes intended**; the release is done when the live dashboard behaves
exactly as v4.6.4 does, with less machinery. The editor UX revalidation and GitHub
content overhaul previously pencilled for "v5" move to the roadmap after this.

---

## Phase A — One pin entry point

**A1. `_requestPin(reason)`** — the single public way to ask for a root-height recalc.
Coalesces via microtask: any number of calls inside one task run `_layoutRootHeight()`
once. Optional `reason` string recorded for the debug channel (C1). All current call
sites route through it:

| Hook | Why it exists | v5 fate |
|---|---|---|
| `_render` tail | first paint | keep |
| `_scRo` (scroller RO) | header settling, toolbars | keep |
| `_bodyRo` (body RO) | exotic embeds where the page scrolls | keep |
| `window resize` | window/profile changes | keep |
| `_pvMo` (panel-view + card-options MO) | edit enter/exit — the deterministic hook | keep |
| `_watchEditBar` (one-shot MO) | late actions-bar mount | keep |
| `location-changed`/`popstate` | view switches, back/forward | keep |
| 1 s piggyback in `_update` | last-resort safety for unknown HA versions | keep (cheap early-out) |
| `_rootHT1` 250 ms post-render | fonts/images settle (not a DOM mutation) | keep, single timer |
| `_rootHT2` 1.2 s post-render | pre-pvMo era settling | **remove** (covered by pvMo + piggyback) |
| `_rootHT3` 300 ms self-heal | pre-pvMo era transient rects | **remove** (covered by pvMo) |

**A2. Hook inventory comment** — one block above `_requestPin` listing every trigger and
its reason (the table above, in code), so the next debugging session starts with a map.

## Phase B — rAF audit

**B1. `_schedule`:** `document.hidden ? setTimeout(0) : requestAnimationFrame` — state
updates must not queue forever in hidden tabs (browser_mod popups, secondary windows).

**B2. Sweep every `requestAnimationFrame` use** and classify: visual-only (swipe/ghost
transitions, parallax — keep; nothing visible needs animating in a hidden tab) vs
correctness-relevant (must not exist — v4.6.4 already removed the known ones; the sweep
proves it and adds a comment at each kept site saying "visual-only, background-safe").

## Phase C — Diagnostics & small debts

**C1. Debug channel:** with `test_mode: true` (or `window.ROC_DEBUG=1`) log one line per
pin: reason, resolved scroller, hui-panel-view/hui-card-options found or not, computed
raw/absorbed heights. When a future HA update renames internals, one look at the console
says exactly which coupling broke.

**C2. Resolution health warning:** if the scroller or panel-view resolution falls back
(documentElement / not found) on a dashboard where it previously resolved, `console.debug`
a single notice — silent degradation becomes visible.

**C3. Dedupe grid-row parsing** (`_rs`/`_re` in `_layoutFitWrap`, `rocCoverHoriz`,
`rocRegionCss` variants) into shared helpers.

**C4. `visualViewport.height`** (fallback `innerHeight`) in the window-scroller branch —
correct on mobile browsers with dynamic toolbars.

**C5. Version single-source check:** smoke test asserts `ROC_VERSION` ===
`package.json.version` — the two can never drift again.

## Phase D — Geometry regression harness (the "point 5")

jsdom has no layout engine — every geometry bug of the 4.6.x saga was invisible to the
existing tests. This phase adds a real-renderer test tier:

**D1. `tests/harness/ha-shell.html`** — a static mock of the HA skeleton the card
depends on: fixed-height body, inner scroll container, header bar, panel-view-like
wrappers, and a button that replays HA's edit-mode DOM transition exactly as observed
live (insert `hui-card-options`-like wrapper + actions bar into the panel's shadow root,
atomic move of the card wrapper, remove on exit). The real `room-overlay-card.js` loads
into it with a fixture config (rooms, badges, auto-row image layout).

**D2. `tests/e2e.spec.js` (Playwright, headless Chromium)** asserting pixels:
- card bottom == viewport bottom, zero page overflow
- bottom-left badge fully inside the viewport
- short window → image letterboxes (aspect kept, centred), never crops the badge
- edit toggle → actions bar fully visible without scrolling
- edit exit → card re-expands, again zero overflow — no reload between steps
- window resize → re-pin; a few seconds idle → no height churn (anti-breathing guard)

**D3. CI:** `npm run test:e2e` job added to the existing Tests workflow (Playwright's
official GitHub Action). jsdom tests stay as the fast tier.

**Limit (by design):** the harness freezes HA's DOM contract as observed in 2026-07.
It guards against OUR regressions; an HA internals change requires updating the mock —
and C1/C2 make that need visible immediately.

## Order & verification

A → B → C → D, one commit per phase. After A+B: full jsdom suite + live monkey-patch
session on the real dashboard (same method as 4.6.x: patch the running card, toggle
edit, swipe, resize, background-tab check) BEFORE the file is considered done. D then
locks the verified behaviour in.

Release: single `v5.0.0` (major = internal restructuring; config and behaviour
unchanged). CHANGELOG + English release notes as usual; release asset uploads are
already automated and verified by the workflow.
