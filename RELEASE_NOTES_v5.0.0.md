# Room Overlay Card v5.0.0

## Layout engine cleanup + real-renderer regression harness

Internal restructuring — **no config changes and no intended behaviour changes**. The 4.6.x series fixed the viewport and edit-mode behaviour through five generations of overlapping trigger mechanisms added one bug at a time; 5.0.0 consolidates them into one documented pipeline and locks the verified behaviour in with a new test tier. The full plan lives in `V5_PLAN.md`.

### One pin entry point

Every trigger that can ask for a height recalculation — scroller/body ResizeObservers, window resize, the edit-transition MutationObservers, `location-changed`, the state-update piggyback, element reconnect — now routes through a single `_requestPin(reason)`. Requests coalesce: any number inside one task collapse into a single recalculation on the next microtask (never rAF). A hook-inventory comment in the code documents why each trigger exists, so the next debugging session starts with a map instead of archaeology. Two now-redundant timers are gone — the 1.2 s post-render re-pin and the 300 ms "self-heal", both superseded by the deterministic edit-transition MutationObserver introduced in 4.6.4.

### rAF audit

`requestAnimationFrame` never fires in background tabs. `_schedule` (state-update batching) now falls back to `setTimeout(0)` when the document is hidden — previously, updates in hidden dashboards (browser_mod popups, secondary windows) queued forever and the card woke up stale. The remaining rAF uses are visual-only (swipe ghost transitions, parallax) and are annotated as background-safe.

### Diagnostics

Set `window.ROC_DEBUG = 1` in the browser console and the card logs every pin request (its reason) and every applied pin — resolved scroll container, available height, top offset, edit-bar reserve, raw vs absorbed height. If the scroll container or the panel-view ancestor stops resolving on a dashboard where it previously resolved — the signature of a Home Assistant internal-DOM change — the card reports it once in the console instead of silently degrading.

### Small debts

Shared grid-row span helpers replace three inline parsers; the window-scroller branch measures `visualViewport.height` (correct under mobile dynamic toolbars); a smoke test asserts `ROC_VERSION` matches `package.json`, so the two can never drift again.

### New: geometry regression harness

jsdom has no layout engine, which is why every geometry bug of the 4.6.x saga was invisible to the existing tests. The new tier runs in a real renderer:

- `tests/harness/ha-shell.html` — a static mock of the HA DOM skeleton the card depends on, including a faithful replay of the edit-mode toggle (options wrapper + actions bar, atomic move) exactly as observed live.
- `tests/e2e.spec.js` — Playwright in headless Chromium asserting **pixels**: card bottom equals the viewport bottom with zero page overflow, the corner badge stays fully visible, short windows letterbox the image (aspect kept, centred), the edit-mode actions bar is reachable without scrolling, leaving edit mode re-expands to full height, the pinned height stays perfectly stable over idle time (anti-breathing), and window resizes re-pin.

Run locally with `npm run test:e2e` (after `npx playwright install chromium`); CI runs it on every push. All six scenarios pass against this release; the fast jsdom tiers remain unchanged.

### Compatibility

- No YAML/config changes. If 4.6.4 worked for you, 5.0.0 behaves identically — with fewer moving parts underneath.
