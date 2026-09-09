# v6.12.1 — `icons[].chip`, a frosted-glass badge for launcher icons

A cockpit typically has a row of small launcher icons whose whole job is `tap_action: { action:
open-section, ... }` — buttons that open a section's side panel. Up to now those rendered as bare
MDI glyphs (optionally with a flat-color circle behind them via `background:`), which reads as
"decoration" rather than "tap me" next to the card's own built-in vacuum status widget, which has
always had a much richer frosted-glass circular badge (soft outer ring, blurred dark glass panel,
border, drop shadow).

## What's new

`chip: true` on any `icons:` entry now renders that exact same badge look:

```yaml
icons:
  - id: open_media
    icon: mdi:cast
    chip: true
    top: 8%
    left: 26%
    tap_action: { action: open-section, section: media }
```

No new colors or tuning to configure — it's the same fixed recipe the vacuum widget's idle state
uses, so a row of these launcher icons now reads as one consistent design language with the vacuum
badge sitting elsewhere on the same card. `chip` and the older `background:` are mutually exclusive
(`chip` wins if both are set); an icon with neither is pixel-identical to before.

## Why this, not a bigger redesign

The alternative — giving every launcher icon the vacuum widget's full live-status machinery
(dry/wet/active/error glow, a count badge) — doesn't fit: those states are specific to a vacuum
domain widget's `vacuums:` list. A plain icon has no such live state to react to; what it needed was
just the *visual chrome*, not the animation engine. So `chip` reuses only the vacuum widget's CSS
(the same `inset:3px` glass-panel recipe, byte-for-byte) applied to the existing `.ico` render path
— no new render primitive, no new state logic.

## Editor

The icon panel in the **Elements** tab gained a "Chip style" checkbox right next to the existing
Background field.

No migration needed — purely additive.

Verified: 5 new render tests (a plain icon keeps the old look, `chip:true` adds the class, the CSS
recipe matches the vacuum widget's byte-for-byte, the editor checkbox prefills and round-trips) —
smoke/render/lifecycle all passing against source and the minified `dist/` build.
