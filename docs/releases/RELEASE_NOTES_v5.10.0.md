# v5.10.0 — Hot-path performance + minified release build

Steps 2 and 3 of the audit in `CODE_ANALYSIS_v5.9.13.md`. Pure optimisation: no
new features, no config changes, no behaviour change you should be able to see —
except that the card downloads ~36 % smaller and busy dashboards and window
resizes get noticeably cheaper.

## Measured

Benchmarked against v5.9.14 on a 3-room config with 6 overlays, 5 zones,
8 icons, 8 labels and 4 gauges per room (jsdom, prototype-level counters):

| Workload | Before | After | |
|---|---|---|---|
| 300× `_update()` | 234 ms · 2 400 `querySelector` · 300 `offsetWidth` | 148 ms · 0 · 0 | **−37 % time** |
| 60-frame resize drag | 32 ms · 480 `querySelector` · 120 `offsetWidth` | 1.3 ms · 0 · 60 | **−96 % time** |

jsdom timings are not browser timings — treat the percentages as the signal and
the milliseconds as relative. The DOM-operation counts are exact.

## What changed

**`_update()` no longer queries the DOM.** The inner `<ha-icon>` of each icon
was re-queried on every tick — 20 icons meant 20 `querySelector` calls per state
change, for a node that cannot change between renders. It is now cached
alongside its container at render time (`_icoIconEls`), the same way badges
already cached `_biconEls` / `_blabelEls`.

**No more unconditional forced layout.** `_update()` read `this.offsetWidth` on
every pass to resolve `%`-based icon sizes and label font sizes — a forced
layout even for the common config that uses none. A per-render flag
(`_needsCardWidth`) now records whether any item actually sizes itself in `%`,
including sizes hidden in per-profile overrides (`portrait: {size: "12%"}`) and
legacy tier keys. Detection is deliberately conservative: when in doubt it reads
the width, because a false positive costs one reflow while a false negative
would break sizing.

**Resize events stopped running a full state pass.** The ResizeObserver called
`_update()` — re-evaluating every condition on every overlay, zone, badge, icon,
label and gauge — on a pure geometry event, once per frame during a window drag
or an opening on-screen keyboard. Only three things in `_update()` actually
depend on the box, so geometry events now run a narrow `_applyResizeStyles()`
instead. The one entangled case (day/night blind gauges, whose slat pattern is
computed from both their own height and the state value) still delegates to the
full pass, gated on a per-render flag.

**Layout passes are coalesced.** Several observers can fire inside one frame;
each used to run its own fit+stage sequence. They now funnel through
`_requestLayout()`, which collapses a burst into a single pass on a microtask —
the same pattern `_requestPin()` already used. Stage-only requests upgrade to a
full fit if a full request lands in the same microtask, mirroring how
`_schedule()` upgrades nav-only frames.

**Layout element refs are cached.** `_layoutFitWrap()`, `_layoutStage()` and
`_layoutRootHeight()` each re-queried `.wrap`, `.content` and `ha-card` on every
call — 11 `querySelector` calls per observer callback. They now go through
`_elWrap()` / `_elContent()` / `_elCard()`, which re-resolve only when the
cached node no longer belongs to the current shadow tree (exactly what an
`innerHTML` replacement does to it), so no manual invalidation is needed.

Also: the instance fields introduced here are declared in the constructor,
restoring the "constructor documents the instance shape" contract the audit
flagged as broken.

## Minified release build

The release asset is now minified: **413.8 → 284.8 KB raw, 110.1 → 69.8 KB
gzipped (−36.5 %)** — on a file every dashboard load pulls. The repo keeps the
readable source; only the published artifact is compressed.

`build.js` runs terser with **property mangling explicitly off**. That is the
one setting that must never change: mangling properties would rename
`setConfig`, `hass`, `getCardSize` and break every Home Assistant integration
point at once. Class and function names *are* manglable — the custom elements
register by string and nothing reads `constructor.name`.

`npm run build:verify` runs all three test tiers **against the minified bundle**,
not just the source. The tests already accepted a path argument, so this was
free — and it is the check that matters, because the bundle is what users
install. Result: byte-for-byte identical pass/fail output between source and
bundle across all 213 assertions.

Two tests had to change to make that possible: the version checks in
`smoke.test.js` and `render.test.js` matched `const ROC_VERSION='…'` in the
source text, which does not survive minification. They now read the version at
runtime from the `customCards` registration — which is what a user actually
sees anyway.

The release workflow builds before uploading and then **downloads the asset back
and byte-compares it** against the freshly built file, rather than only checking
that an asset with the right name exists. v4.6.2 shipped an asset-less release
after a transient GitHub 503 and failed in HACS with "unknown error"; an asset
with wrong or truncated contents would fail just as opaquely, and name-only
verification would not have caught it.

## Testing

`tests/lifecycle.test.js` grows to 35 assertions. The hot-path budget is now a
hard ceiling rather than a loose one — `_update()` must do **zero**
`querySelector` calls and **zero** `offsetWidth` reads for a 40-item card — so
reintroducing an uncached query or a forced read in a per-item loop fails CI.

The riskiest part of this change is a `%` size silently ceasing to resolve,
which would look fine in jsdom unless the computed value is asserted, so there
are explicit behavioural checks: a `10%` icon on a 400 px card must resolve to
`40px`, and must re-resolve to `80px` when the card grows to 800 px. Coalescing
is asserted directly (50 requests → 1 pass), as is the absence of a full
`_update()` from the resize path.

Existing tiers unchanged and passing: 178 render assertions (output diffed
line-by-line against v5.9.14 — identical), full smoke tier.
