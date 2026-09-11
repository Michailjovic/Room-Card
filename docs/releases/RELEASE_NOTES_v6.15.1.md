# v6.15.1 — fix: glow didn't react to brightness/colour changes on an already-on light

Reported after wiring a `glows:` entry to a real light: the glow only ever picked up the light's
current brightness/colour after something forced a full re-render (dragging the glow in edit mode)
— live changes to the light itself (dimming it, changing its colour) while it stayed `on` produced
no visible reaction. Turning the light fully on/off already worked correctly.

## Root cause

`_update()` (added in v6.6.0 with the `glows:` feature) has always read a glow's opacity from its
light's `brightness` attribute and its colour from `rgb_color` / `color_temp_kelvin` / legacy mired
`color_temp` — that part was correct. The problem was upstream: the incremental `set hass(h)` path
only calls `_update()` when something in `_relevantEntities` (entity *state*) or
`_relevantAttrSources` (specific tracked attributes) actually changed. `_extractAttrSources()`
already tracked `brightness_model.source`, `gauges[].attribute`, `labels[].attribute`,
`icons[].attribute` and `blinds[].attribute` — but never `glows[].entity`'s attributes. So a light
switching `off`→`on` (a state change) triggered an update and showed the right glow at that instant,
but any later brightness or colour change on that same still-`on` light was invisible to the change
detector and never triggered `_update()` again.

## The fix

`_extractAttrSources()` now also tracks `brightness`, `rgb_color`, `color_temp_kelvin` and
`color_temp` for every `glows[].entity`, the same pattern already used for gauges/labels/icons/
blinds. No other logic changed — `_update()`'s own glow opacity/colour calculation was already
correct.

No configuration change — this is a pure bug fix and applies to every existing `glows:` entry
automatically.

Verified: all `tests/smoke.test.js` cases pass against the patched source (`glowParseColor` /
`glowRgb` / `glowBg` and everything else, 200+ assertions). `render.test.js` / `lifecycle.test.js` /
the Playwright e2e suite, and the minified `dist/` rebuild, were **not** run as part of this fix —
run `npm test` and `npm run build:verify` locally before tagging/releasing.
