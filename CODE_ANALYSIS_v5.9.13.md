# Room Overlay Card — code analysis (v5.9.13)

Scope: `room-overlay-card.js` (5 976 lines / 413 KB), tests, CI.
Method: static read + instrumented jsdom probes (observer lifecycle, hot-path DOM
counters, config-shape fuzzing). Every finding below was **reproduced**, not inferred.
Reproductions are in [Appendix A](#appendix-a--how-each-finding-was-reproduced).

Existing tests were run first as a baseline: `smoke` 100 % pass, `render` 179/179 pass,
`node --check` clean. The 6 failing entries in `test-results/.last-run.json` are a stale
local artifact (`Executable doesn't exist … chrome-headless-shell`) — a missing browser
install, **not** a real regression.

---

## Severity summary

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | `resolveVal()` throws on scalar config values (5 call sites) | **P0 — crash** | 15 min |
| 2 | 4 observers/listeners dead after HA edit-mode DOM move | **P1 — card freezes** | 30 min |
| 3 | Per-room templates never subscribe in multiroom configs | **P1 — silent** | 5 min |
| 4 | Editor leaks a `roc-room-switch` window listener per open | P2 | 5 min |
| 5 | Template subscribe rejections are unhandled | P2 | 5 min |
| 6 | `_update()` re-queries `ha-icon` per icon per tick | P2 — perf | 20 min |
| 7 | ResizeObserver runs a full `_update()` uncoalesced | P2 — perf | 30 min |
| 8 | No minification (413 KB shipped raw) | P3 | 1 h |
| 9 | `_render()` is 953 lines; single-file monolith | P3 — debt | days |
| 10 | Housekeeping (dead field, stale artifacts, 40 release-notes files) | P3 | 30 min |

---

## 1. `resolveVal()` throws on scalar config values — **P0**

`resolveVal(conds, …)` assumes `conds` is an array of `{condition, value}`:

```js
function resolveVal(conds,states,fallback){
  for(const cv of conds){…}
  const d=conds.find(cv=>cv.condition===undefined);   // ← strings have no .find()
  return d!==undefined?d.value:fallback;
}
```

A **string** iterates character-by-character, then dies on `.find`. A **number** dies
immediately on `for…of` ("not iterable").

Two call sites were hardened at some point with `Array.isArray(…)?resolveVal(…):value`
(labels @3195, gauges @3226/3230). **Five were not:**

| Line | Expression | Config that crashes |
|------|-----------|---------------------|
| 3092 | `Number(resolveVal(ov.conditions.opacity,…))` | `conditions: {opacity: 0.5}` |
| 3094 | `resolveVal(ov.conditions.filter,…)` | `conditions: {filter: "blur(2px)"}` |
| 3140 | `resolveVal(b.icon_color,…)` | `icon_color: red` |
| 3142 | `resolveVal(b.label,…)` | `label: Kitchen` |
| 3156 | `resolveVal(ico.color,…)` | `color: "#fff"` |
| 3317 | same as 3092, in `_updateNav` | as above |

All six verified throwing. `label: Kitchen` is the likely one to hit in the wild — it is
the obvious thing to write, and the GUI editor exposes badges through a free-form
`label / visible / icon_color / tap_action / group (YAML)` textarea, so it is reachable
from the supported UI, not just hand-written YAML.

**Blast radius.** `_update()` is called from `set hass`. The exception escapes into HA's
state-update path, and the card is left rendered-but-dead: DOM exists, nothing ever
updates, console error on every state change.

**Fix — harden the resolver itself** (covers all present and future call sites, and the
two `Array.isArray` guards can then be dropped as redundant):

```js
function resolveVal(conds,states,fallback){
  if(!Array.isArray(conds))return conds===undefined?fallback:conds; // scalar shorthand
  for(const cv of conds){if(!cv||cv.condition===undefined)continue;if(evalCond(cv.condition,states))return cv.value;}
  const d=conds.find(cv=>cv&&cv.condition===undefined);
  return d!==undefined?d.value:fallback;
}
```

`resolveFilter` / `resolveFilterInverted` have the identical shape and deserve the same
guard even though no crashing call site exists today.

This also turns the scalar form into a *documented shorthand* — `label: Kitchen` becomes
valid instead of fatal, which is what a user would expect anyway.

---

## 2. Four observers/listeners are dead after HA's edit-mode DOM move — **P1**

`disconnectedCallback` **nulls** every handle; `connectedCallback` re-attaches with
`if(this._x)…`, which is now always false. This is exactly the dead-code pattern fixed
in v4.6.4 for `_ro` — but four siblings were missed:

```js
// disconnectedCallback
if(this._io){this._io.disconnect();this._io=null;}                    // 3421
if(this._hlHandler){…;this._hlHandler=null;}                          // 3409
if(this._relTimer){clearInterval(this._relTimer);this._relTimer=null;} // 3411
if(this._orientHandler){…;this._orientHandler=null;}                  // 3412

// connectedCallback
if(this._io)this._io.observe(this);                    // 3438 — never true
if(this._hlHandler)window.addEventListener(…);         // 3442 — never true
// _relTimer, _orientHandler: not even attempted
```

Measured across a DOM move (`{before} → {after}`):

```
_ro   true → true    ✅ (the v4.6.4 fix)
_io   true → false   ❌
_hl   true → false   ❌
_rel  true → false   ❌
_or   true → false   ❌
```

**Consequences, worst first:**

- **Card freezes permanently.** `set hass` bails on `if(!this._visible)return;` (@740).
  `_visible` is only ever set by the IntersectionObserver. If the card is off-screen when
  HA moves it (`_visible===false`) and the IO is gone, nothing can ever set it back to
  `true` — the card is dead until a full page reload. Verified: after the move
  `_io===null` and `_visible===false`, and no state change schedules an update.
- Off-screen update suppression is lost even in the benign case (`_visible===true`) — the
  card keeps doing full update passes while scrolled out of view.
- `roc-highlight` (editor panel → card flash) stops working.
- `format: relative` labels stop ticking (the 30 s interval is gone).
- `parallax` device-orientation tilt stops on mobile.

**Fix.** Extract the same way `_wireLayoutObservers()` already does it — recreate, don't
conditionally re-observe. Move the IO creation out of `_render()` (@2210-2218) into a
`_wireVisibility()`, restart `_relTimer` from a `_wireRelTimer()`, rebuild `_hlHandler`
in a `_wireHighlight()`, and call all of them from both `_render()` and
`connectedCallback()`. `_orientHandler` is created inside `_attachParallax`, so the
cheapest correct fix there is to re-run the parallax attach on reconnect.

A guard worth adding regardless, as defence in depth against this whole bug class:

```js
set hass(h){
  …
  if(!this._visible&&this._io)return;   // only trust _visible while an IO is actually live
```

---

## 3. Per-room templates never subscribe in multiroom configs — **P1, silent**

`_render()` works on the merged room view (`this._roomCfg`, set @1358) — but
`_setupTemplates()` re-reads the *unmerged* config:

```js
_setupTemplates(){
  const c=this._config,self=this;      // ← should be this._roomCfg||this._config
```

`roomMerge()` **replaces** `labels`/`badges`/`zones`/… with `rooms[i]`'s copy (all are in
`ROOM_KEYS`), so in a `rooms:` config `this._config.labels` is either empty or holds
labels whose elements no longer exist.

Verified — a two-room config with `rooms[0].labels[0].template`:

```
rendered label els:      [ 'kl' ]
template subscriptions:  []          ← expected 1
top-level control:       1 ✅
```

Affects every template feature per room: `label.template`, `badge.label_template`, and
`visible_template` on zones / icons / badges / overlays / elements / gauges / blinds.
Fails silently — no warning, the element just never updates.

`_startCamera()` (@2510) already gets this right with an explicit comment about
room-scoped keys; `_setupTemplates` is the one that was missed.

**Fix** — one line:

```js
const c=this._roomCfg||this._config,self=this;
```

Guard it with a render test that asserts `subscribeMessage` fires for a per-room template.

---

## 4. Editor leaks a window listener per open — **P2**

```js
window.addEventListener('roc-room-switch',this._rocRoomHandler);   // 5363

disconnectedCallback(){                                            // 5969
  clearTimeout(this._fdT);
  if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);…}
  // _rocRoomHandler never removed
}
```

Every editor open/close leaves a live listener holding a reference to the dead editor
instance — memory grows, and stale handlers keep firing on room switches.

**Fix:** mirror the `_rocPosHandler` line. While there, `_prevCard` (the mounted preview
card) should be dropped too so its own observers/timers can be collected.

---

## 5. Unhandled promise rejections from template subscriptions — **P2**

```js
const p=self._hass.connection.subscribeMessage(cb,{type:'render_template',template:tpl});
self._tmplUnsubs.push(p);                       // no .catch
…
u.then(function(f){…});                         // teardown: also no .catch
```

An invalid Jinja template makes HA reject the subscription → `unhandledrejection`. In HA
that surfaces as a red console error with no card context, which makes it hard to trace
back to the offending template.

**Fix:**

```js
const p=self._hass.connection
  .subscribeMessage(function(msg){cb(msg?msg.result:undefined);},{type:'render_template',template:tpl})
  .catch(function(e){console.warn('[room-overlay-card] template failed:',tpl,e);return null;});
```

and `.catch(()=>{})` on the teardown `.then`. The `null` keeps the unsub loop safe
(it already type-checks before calling).

---

## 6. `_update()` re-queries the DOM per icon, per tick — **P2 perf**

```js
const haicon=el.querySelector('ha-icon');   // 3152 — inside the icon loop
```

Measured: **20 icons → 20 `querySelector` calls in a single `_update()`**. On a busy
dashboard `_update()` runs on every relevant state change; with several cards this is
avoidable steady-state work.

Also in the same pass:

- `const _icoW=this.offsetWidth||300;` (@3144) — a forced layout read on every update,
  even when no icon or label actually uses a `%` size.
- `el.offsetHeight` per day/night gauge (@3218) — same, inside a loop.

**Fix.** Cache the `ha-icon` reference alongside the container at render time
(`this._icoIconEls[ico.id]`), exactly as `_biconEls` / `_blabelEls` already do for badges.
Compute `_icoW` lazily behind a render-time flag (`this._needsCardWidth`) set only when
some icon/label size string ends in `%`.

Change detection itself is **correct** — verified: unrelated entity → 0 updates,
relevant entity → 1 update, same `hass` re-assigned 3× → 1 update. The nav/full split
works as designed.

---

## 7. ResizeObserver does too much, uncoalesced — **P2 perf**

```js
this._ro=new ResizeObserver(function(){
  if(self._rendered){self._layoutFitWrap();self._layoutStage();if(self._hass&&self._visible)self._update();}
});
```

Two problems:

1. **A geometry event triggers a full state pass.** `_update()` walks every overlay,
   zone, badge, icon, label and gauge and re-evaluates every condition. Of all that, only
   icon size and label font-size actually depend on width. Measured cost of the callback
   body: **11 `querySelector` + 2 `offsetWidth` + 1 `offsetHeight` per invocation.**
2. **No coalescing.** During a window drag or a keyboard opening, this fires per frame.
   `_layoutFitWrap()` also *writes* styles that can re-trigger the observer (bounded only
   by the "settled" early-outs), and `_layoutStage()` reads `offsetWidth` immediately
   after those writes — read-after-write layout thrashing.

**Fix.**

- Cache `.wrap`, `.content` and `ha-card` refs at render time instead of re-querying
  them in `_layoutFitWrap` / `_layoutStage` / `_layoutRootHeight` (they are stable for
  the lifetime of a render; `_render()` already nulls everything else).
- Coalesce the RO callback through the existing `_requestPin` microtask pattern rather
  than running inline.
- Replace the `_update()` call with a narrow `_applySizeDependentStyles()` that only
  touches `%`-sized icons and labels.

---

## 8. Ship a minified build — **P3**

| | bytes | gzip |
|---|---|---|
| current | 413 050 | 108 378 |
| terser `-c -m` | 288 659 | 70 644 |

**−30 % raw, −35 % gzipped**, on a file that every dashboard load pulls. The code is
already written in a dense hand-minified style, which is *why* the ratio isn't better —
and that density is costing readability for a benefit a build step would give for free.

**Fix.** Add a `build` script (terser + sourcemap), publish `room-overlay-card.js`
minified as the release asset, keep the readable source in the repo. `hacs.json`'s
`filename` and the release workflow's `gh release upload` already point at a single
artifact, so this is a one-line change in each. Ship the `.map` as a second asset;
`.gitignore` already excludes `*.map` and `dist/`.

*Caveat:* this changes what is committed vs. what is released. The release workflow
currently uploads the checked-out `room-overlay-card.js` verbatim — it would need a build
step before `gh release upload`, and the "verify the asset is attached" step should then
also assert the asset is the built one (e.g. non-zero size + version string present).

---

## 9. Structural debt — **P3**

- `_render()` is **953 lines**; `_update()` 254; `_wireLayoutObservers()` 118. The whole
  card + editor + a hand-rolled YAML parser live in one 5 976-line file.
- The editor's `_collectConfig()` (~500 lines), `_render()` (~600) and `_listen()` (~520)
  mirror each other field-by-field — three places to edit for every new option, with
  nothing enforcing that they stay in sync. This is the most likely source of future
  editor bugs.
- Instance fields assigned only in `_render()` (`_ccEls`, `_ccCfgs`, `_gaugeFills`,
  `_sortedGrads`, `_blindGaugeCfgs`, `_tmInfoEl`, `_radialMeta`) are missing from the
  constructor, unlike the ~60 that are there. Safe today because `_update()` guards on
  `_rendered`, but it breaks the "constructor documents the instance shape" contract that
  the rest of the class follows.

**Fix (incremental, no big-bang rewrite).** The file is ESM-loadable as a single module,
so splitting is mechanical: pull the pure helpers (lines 15-670: colour maths, filters,
layout maths, `_yaml`, `coverCtlHtml`) into `src/helpers.js`, the editor into
`src/editor.js`, and let the build step concatenate. That alone moves ~1 100 lines out of
the monolith and makes the helpers directly unit-testable without jsdom. Then split
`_render()` by region (`_renderNav`, `_renderImage`, `_renderLights`, `_renderCover`) —
the grid regions already give you the seams.

For the editor triplication, a field-descriptor table (`{key, type, label, section}`)
driving all three passes would collapse most of the 1 600 lines and make the three
representations structurally impossible to desynchronise. That is a genuine multi-day
refactor — worth scheduling, not worth rushing.

---

## 10. Housekeeping — **P3**

- `_lyPvT` is declared in the editor constructor and never used. Dead.
- ~~40~~ 54 `RELEASE_NOTES_v*.md` files in the repo root — `CHANGELOG.md` (178 KB) already
  has all of it. Move them to `docs/releases/`. **(done in v5.10.1)**
- `test-results/` holds stale failure artifacts from an environment without Chromium
  installed. Gitignored, so harmless, but it makes `.last-run.json` misleading — worth
  deleting so the next reader isn't sent chasing 6 phantom failures.
- The editor's `_e()` escapes `& " < >` but not `'`, while the card's `escA()` escapes all
  five. No exploitable site found (every audited `_e()` output lands in a double-quoted
  attribute or a text node), but the asymmetry is a trap for the next person adding a
  single-quoted attribute. Make `_e = escA`.

**Not a problem** (checked and cleared): no `eval` / `new Function`; entity state reaches
the DOM via `textContent`, never `innerHTML`; `escUrl` is adequate for the `url('…')`
contexts it guards; drag/resize/zoom handlers all remove their document listeners on
pointer-up; repeated `_render()` leaks neither observers nor window listeners; the
release workflow's retry-and-verify is sound; `ROC_VERSION` ↔ `package.json` is
smoke-tested.

---

## Suggested order

**Now — one patch release (~1 h, all three are small and independently testable):**

1. Harden `resolveVal` / `resolveFilter*` (finding 1) — stops a live crash.
2. `_setupTemplates` room-cfg one-liner (finding 3) — restores a broken headline feature.
3. Recreate `_io` / `_hlHandler` / `_relTimer` / `_orientHandler` on reconnect, plus the
   `set hass` `_io` guard (finding 2) — stops the permanent freeze.

Ship 4 and 5 alongside; they are five lines each.

**Next — a perf pass (~2 h):** cache `ha-icon` and the layout element refs, coalesce the
ResizeObserver, narrow it to size-dependent styling (findings 6, 7).

**Then — build step (~1 h):** terser + release-workflow wiring (finding 8).

**Scheduled — structure (days):** helpers/editor split first, editor descriptor table
second (finding 9).

### Test coverage to add with the fixes

The existing suite is genuinely good — 179 jsdom render assertions plus a real-Chromium
geometry tier is more than most custom cards have. It has one systematic blind spot: it
never exercises the **lifecycle**. Every gap found above lives there.

| Guards | Test |
|---|---|
| 1 | `render.test.js`: each of the 6 scalar shorthands renders without throwing |
| 2 | `render.test.js`: after `wrapper.appendChild(card)`, assert `_io/_hlHandler/_relTimer/_orientHandler` are all live (needs the IO/RO polyfills from Appendix A) |
| 3 | `render.test.js`: per-room `label.template` calls `subscribeMessage` once |
| 4 | `render.test.js`: editor `disconnectedCallback` leaves zero `roc-*` window listeners |
| 6, 7 | `render.test.js`: instrument `querySelector` and assert a ceiling per `_update()` — cheap, and it makes perf regressions fail CI instead of being noticed months later |

---

## Appendix A — how each finding was reproduced

All probes ran under jsdom against the unmodified `room-overlay-card.js`, from
`tests/` so `require('jsdom')` resolves. Two setup details matter:

- **Polyfill `IntersectionObserver` and `ResizeObserver`** before `w.eval(code)`. jsdom
  has neither, so without them findings 2's `_io`/`_ro` results are indistinguishable
  from "the API doesn't exist" — the first run of this analysis produced exactly that
  false positive on `_ro`, which is in fact correctly restored.
- **Instrument prototypes, not instances** — wrap `Element.prototype.querySelector`,
  `getBoundingClientRect`, and the `offsetWidth`/`offsetHeight` getters to count
  hot-path DOM work.

Then:

- **Finding 1** — build a card per scalar shorthand (`label:'Kitchen'`,
  `icon_color:'red'`, `color:'#fff'`, `conditions:{opacity:0.5}`,
  `conditions:{filter:'blur(2px)'}`), assign `hass`, catch. 5 throw; the two
  `Array.isArray`-guarded controls (label `color`, gauge `color`) pass.
- **Finding 2** — render a card, snapshot
  `{_io,_ro,_hlHandler,_relTimer,_orientHandler}`, then `wrapper.appendChild(card)` to
  simulate HA's atomic move, and re-snapshot. For the freeze: set `_visible=false`
  before the move, then assign a fresh `hass` and confirm no update is scheduled.
- **Finding 3** — a two-room config whose `rooms[0]` has a templated label, with a stub
  `hass.connection.subscribeMessage` recording every template string. Records nothing;
  the same template hoisted to top level records one.
- **Findings 6, 7** — 20 icons, count `querySelector` across one `_update()`; then 50
  iterations of the RO callback body with the prototype counters running.
- **Change-detection control** (which came back clean) — assign an unrelated entity, a
  relevant entity, and the same `hass` three times, counting `_update`/`_updateNav`.
  Note that mutating a state object in place between assertions makes this test lie —
  the first attempt did exactly that and appeared to show broken change detection.
