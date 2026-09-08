# v6.6.1 — Light glow: colour picker, intensity slider, resize handles

Follow-up to [v6.6.0](RELEASE_NOTES_v6.6.0.md) from using glows on a real room photo. No new config
keys, no migration — this is the editing surface for what v6.6.0 already renders.

## Editor

- **Colour picker.** A native colour picker sits beside the colour field. The text field stays the
  source of truth, so `auto`, `2700K` and `255,180,110` keep working — the picker only writes a hex
  into it. Dragging inside it previews live, releasing commits, and an **Auto** button hands the
  colour back to the light. A non-hex value resolves to its real colour in the swatch, so `2700K`
  shows warm rather than black.
- **Intensity slider** paired with the number field.
- `min_brightness`, `animation_speed`, `anchor` and `transition` are **real fields** now. Only
  `fallback_color`, `border_radius`, visibility, fade/slide and the per-profile overrides are left
  in the YAML box.

## Edit mode

Each glow gets a **chrome box**: a dashed outline labelled with the glow's id that you drag onto the
lamp, with round **resize handles** once you click it — one for a circle (it stays round), width /
height / corner for an ellipse or wash. Resizing grows the glow symmetrically, because `top`/`left`
is its centre. Glows stay visible at 25 % opacity with their light off, so they can be placed at any
time of day.

The handles are deliberately **not** children of the glow: they would inherit its state-driven
opacity and be `screen`-blended into the photo along with it. The chrome is a plain unblended
sibling mirroring the glow's geometry, and drag/resize sync the real glow layer live.

## Under the hood

Glow geometry is now plain `%` of the stage instead of percentages pre-resolved to px against the
card width. A circle sets `width` and derives its height from `aspect-ratio: 1` — a `%` height is
measured against the stage *height*, which would turn every circle into an ellipse on a non-square
card. That is what lets the resize handles read and write the same units the config stores.
