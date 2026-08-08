# v5.9.14 — Lifecycle & config-shape hardening

A bug-fix release from a full code audit. Six real defects, three of them
capable of leaving a card permanently dead until a page reload. No new features,
no config changes required — every fix is backwards compatible.

## Fixed

### Card stopped updating when a config field used its scalar form

Writing a field in the obvious short way instead of the conditional-list way:

```yaml
badges:
  - id: kitchen
    label: Kitchen          # ← not a [{condition,value}] list
```

…threw a `TypeError` out of `set hass`. The card rendered once and then never
updated again, with a console error on every state change. The same crash hit
`badge.icon_color`, `icon.color`, `overlay.conditions.opacity` and
`overlay.conditions.filter`.

`resolveVal()`, `resolveFilter()` and `resolveFilterInverted()` now accept the
scalar form as a documented shorthand, so all five spellings above simply work.
The guard lives in the resolvers themselves, so any future call site is covered
too.

### Card froze after toggling dashboard edit mode

HA moves the card element when you enter or leave dashboard edit mode, which
fires `disconnectedCallback` and then `connectedCallback`. Four hooks were
nulled on the way out and revived with `if(this._x)…` on the way back in —
dead code once they're null. So after one edit toggle a card had:

- no `IntersectionObserver`,
- no `roc-highlight` listener (editor panel → card flash stopped working),
- no 30-second ticker (`format: relative` labels froze),
- no `deviceorientation` parallax tilt on mobile.

Worst case, and the reason this is the headline fix: `_visible` is only ever set
by the IntersectionObserver. If the card happened to be scrolled off-screen at
the moment HA moved it, `_visible` stayed `false` with nothing left alive to
flip it back — **the card was dead until a full page reload.**

Handles that can be revived are now detached rather than nulled, the
IntersectionObserver and the relative-time ticker are (re)created from
`_wireVisibility()` / `_wireRelTimer()` on both render and reconnect, and
`set hass` only trusts `_visible` while an observer is actually alive to
correct it — so no future regression of this class can freeze a card again.

This is the same defect class fixed in v4.6.4 for the layout observers; four
siblings were missed at the time.

### Templates never ran in multiroom configs

`_setupTemplates()` read the unmerged top-level config while everything else in
`_render()` worked on the merged room view. Since `labels`, `badges`, `zones`,
`icons`, `overlays`, `elements` and `gauges` are all room-scoped keys,
`roomMerge()` replaces them with the active room's copies — so in any `rooms:`
config the per-room templates were never subscribed at all.

Affected `label.template`, `badge.label_template` and `visible_template` on
every element type. It failed silently: no warning, the element just never
updated.

### `label_template` did nothing without a `label`

The badge's text span was only rendered when `label` was set, so a badge using
only `label_template` — the exact form shown in the README — had nothing to
write into. The span is now rendered for either key.

### Editor leaked a listener on every open

`disconnectedCallback` removed `roc-pos-update` but not `roc-room-switch`, so
every editor open/close left a live listener pinning the dead editor instance in
memory and still firing on room switches. The mounted preview card is now
released too.

### Invalid templates produced unhandled promise rejections

A Jinja error made HA reject the subscription, surfacing as a bare console error
with no indication of which card or which template caused it. Failures are now
caught and logged with the offending template string.

## Testing

New `tests/lifecycle.test.js` — 27 assertions covering exactly the blind spot
all six bugs lived in: what happens when the card element is *moved*, and what
happens when config fields use their scalar shorthand. It polyfills
`IntersectionObserver` and `ResizeObserver`, which jsdom lacks — without them
"the observer is gone" and "the API never existed" are indistinguishable, and
the `_io` assertions silently pass against a broken card.

It also enforces a hot-path budget (`_update()` must not scale `querySelector`
calls with item count), so perf regressions fail CI instead of being noticed
months later.

Wired into `npm test` and the CI workflow. The existing 178 render assertions
and the full smoke tier are unchanged and still pass.
