# v6.6.0 — Light glow: the lamps in the photo actually light up

Until now a light could only change the **whole** picture. `filter_conditions` and
`brightness_model` dim or lift the entire base image; anything more local meant preparing a
transparent PNG for every lamp and switching it with an overlay condition. Neither shows what a lit
lamp really does to a room photo: a pool of light around itself, in its own colour.

## `glows:`

A new top-level list. Each entry is a soft light-spill layer blended onto the photo — a CSS
gradient, so no image files to prepare for any of it.

```yaml
glows:
  - id: reading_lamp
    entity: light.bedroom_lamp
    top: 42%              # the CENTRE of the glow, not its corner
    left: 18%
    size: 26%             # diameter, % of card width (or px)
    intensity: 0.75       # opacity at full brightness
    falloff: soft         # soft | tight | wide
    color: auto           # auto = follow the light
```

- **Colour follows the light** — `rgb_color` first, then `color_temp_kelvin` (or legacy mired
  `color_temp`), falling back to a warm bulb, so a plain `switch` glows warm too. A fixed `color:`
  (`#ffb46e`, `255,180,110`, `2700K`) overrides it.
- **Strength follows brightness** — opacity is `intensity × brightness / 255`, with an optional
  `min_brightness` floor. A dimmed lamp paints a dimmer pool.
- **Three shapes** — `circle` (lamp, ceiling light, candle), `ellipse` (LED strip, window, TV) and
  `wash`, a directional spill anchored on the edge the light comes *from* (`angle:`, default
  `180deg` = downward) that fades on every side instead of ending in straight seams.
- **`animation: flicker | pulse`** for candles, fireplaces and bias lighting.
- **`top`/`left` is the centre** (`anchor: corner` to opt out) — a lamp is a point, so you drag the
  glow onto it. Dragging, arrow-key nudging and snapping behave exactly as on icons and labels.
- **`z_index: 2`** by default: above the photo, below your overlay PNGs, so a foreground curtain
  still covers the light. Raise it to let the light spill over them.

## Editor

A new **Light glow** section in the Elements tab: live falloff preview, entity datalist,
shape / falloff / blend / animation selects, colour swatch, and the usual duplicate / reorder /
remove. In **Edit mode** every glow stays visible (minimum 25 % opacity) and outlined even when its
light is off, so you can place it at any time of day.

## Notes

There is deliberately **no `filter: blur()`** anywhere in this feature — the soft edge comes from
gradient stops alone. Stacking a `filter` over a blended layer is the compositing combination
behind the v6.5.1 vacuum-widget repaint bug on tablet WebViews.

Verified in real Chromium as well as jsdom: a Playwright test asserts the computed
`mix-blend-mode`, the circle's derived height, the centre anchoring in real pixels, the absence of
any `filter`, and that the glow shares the photo's stacking context (it would silently stop
blending otherwise).

**No migration.** A card without `glows:` renders exactly as before.

See [`docs/CONFIGURATION.md` → Light glow](../CONFIGURATION.md#light-glow-light-spill-on-the-photo)
and the new recipes in [`PRESETS.md`](../../PRESETS.md).
