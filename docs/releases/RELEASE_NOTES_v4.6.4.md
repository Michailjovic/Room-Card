# Room Overlay Card v4.6.4

## Edit-mode transitions are now event-driven — enter and exit recalculate instantly

Both remaining edit-mode bugs — the actions bar landing off-screen after entering edit mode, and the card staying stuck at its shorter edit-mode height after leaving until a refresh or room swipe — shared one root cause, diagnosed live with instrumented observers in a running dashboard.

### What was wrong

- **Observers died on every DOM move.** `disconnectedCallback` nulled every ResizeObserver; `connectedCallback` then "re-attached" them with `if(this._ro)this._ro.observe(…)` — dead code after the nulling. A card that went through any move had no layout triggers left, only the 1-second state-update piggyback — which fires when a relevant entity happens to change, i.e. seconds to minutes later. That lottery is why the card sometimes fixed itself and sometimes didn't.
- **The edit toggle is invisible to every conventional hook.** Verified live: toggling dashboard edit mode fires no `location-changed` event, doesn't resize the scroller or `body`, and doesn't even disconnect the card element — Home Assistant atomically rebuilds the DOM *around* it (the `hui-card-options` wrapper inside `hui-panel-view`'s shadow tree; the actions bar inside the wrapper's own shadowRoot).
- **`requestAnimationFrame` silently ate deferred recalculations.** rAF never fires in background tabs — which wall-mounted kiosk dashboards effectively are — nor during HA view transitions. Deferred re-pins queued via rAF simply never ran.

### What changed

- All observer wiring moved into one `_wireLayoutObservers()` method called from render **and** `connectedCallback` — every reconnect recreates everything from scratch.
- A MutationObserver watches exactly the two trees HA mutates on edit enter/exit (`hui-panel-view`'s shadow tree and the `hui-card-options` shadowRoot). Neither ever contains the card's own DOM, so the observer is silent except on real transitions; on each one the height re-pins **synchronously** and a newly created wrapper's shadowRoot is adopted automatically.
- Deferred work uses synchronous MutationObserver callbacks (the DOM is already settled there) or `setTimeout(0)` — never rAF.
- A `location-changed`/`popstate` listener additionally re-pins after HA client-side navigations (view switches, back/forward).

### Verified live

Entering edit mode settles in one self-correcting sequence — the bar reserve is measured the moment the bar mounts. Leaving edit mode re-expands to full height in a single synchronous pin. No refresh, no swipe, no polling timers.

### Compatibility

- No config changes. Card behaviour outside edit-mode transitions is identical to v4.6.3.
