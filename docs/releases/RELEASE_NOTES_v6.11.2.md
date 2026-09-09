# v6.11.2 — `tile.image_ratio` fixes cropped widescreen tile images

An image tile's stage (`.roc-tile-img-stage`) has always used a hardcoded `aspect-ratio: 4/3` —
fine for the tiles it was built for (a washer's front panel, roughly square-ish device photos),
but wrong for a widescreen device photo like a TV or monitor. Combined with `background-size:
cover` on the base layer and every overlay, a 16:9-ish source photo forced into a 4:3 box gets its
left/right edges cropped off to fill the narrower shape. Nothing is literally stretched or
distorted — `cover` never distorts — but the visible result reads exactly that way: the picture
looks squashed, and real content (a side menu, a rightmost thumbnail) is simply cut off outside
the frame.

This is what a bedroom TV tile hit: its source photos are properly widescreen, but the fixed 4:3
stage cropped both the TV bezel and the on-screen UI down to a narrower slice than the original.

## The fix

A new optional per-tile field, `tile.image_ratio`, overrides the stage's aspect ratio inline —
any valid CSS `aspect-ratio` value:

```yaml
tile:
  name: Ložnice
  image: /local/tv-off.webp
  image_ratio: '16/9'
  overlays:
    - id: tv_content
      state_images: [ ... ]
```

The inline `style="aspect-ratio:16/9;"` on `.roc-tile-img-stage` naturally overrides the class's
`4/3` default (inline style beats a class rule). Leaving `image_ratio` unset keeps the existing
`4/3` behavior exactly as before — every already-shipped image tile (the washer, for example) is
untouched.

No editor changes were needed: a section's own `tiles:` (v6.11.0) round-trip through the GUI
editor as a whole array via `Object.assign`, so a new field on a declared tile just rides along
unchanged; a room-tagged element's `tile:` box (zones/icons/elements/blinds) already carries any
field outside `image`/`overlays` through its freeform YAML textarea, so `image_ratio` sits there
right next to `name`/`entity`/`quick`/`tap_action` with no dedicated input required.

No migration needed — this is a purely additive, opt-in field.

Verified: 2 new render tests (inline `aspect-ratio` present when `image_ratio` is set, absent
when it isn't) — smoke/render/lifecycle all passing against source and the minified `dist/`
build.
