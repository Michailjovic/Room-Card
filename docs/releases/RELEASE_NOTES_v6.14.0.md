# v6.14.0 — `image_align`: where the photo sits in a taller-than-needed box

Reported right after applying v6.13.0's `layout.height: fill` fix: the bottom dead-space was gone
(the card now genuinely fills the phone screen), but the room photo itself now floated in the
middle of the screen — a big black gap above it (between the nav strip/banner and the photo) and
another below it, instead of the photo sitting compactly right under the banner the way it used to.

## Root cause

`fill` does exactly what it's meant to: it pins `ha-card` to the full available height, and the
`image` region's `1fr` row correctly claims all the leftover space in the grid. But the region's
*box* being tall was never the same thing as the *photo inside it* being tall. `image_fit: contain`
letterboxes the design-aspect photo to fit inside its box without cropping — and the stage-
positioning math (`containStage`/`coverStage`) has always centered that letterboxed (or, for
`cover`, cropped) content vertically, no matter how much taller the box got. Making the box
genuinely fill the screen was correct; it just meant the pre-existing centering became a lot more
visible than it used to be, splitting the newly-available space evenly above AND below the photo
instead of leaving it all in one predictable place.

## The fix

New `image_align: top | center (default) | bottom`. It's a pure positioning knob on top of
whichever `image_fit` is already in effect:

```yaml
image_fit: contain
image_align: top    # was implicitly "center" — now explicit and overridable
```

`top` pins the visible photo to the top of its box, so it sits right under the nav strip / status
banner exactly as before `fill` made the box taller — and pushes all the leftover space to the
bottom, which happens to be exactly where a bottom-sheet section panel opens into anyway. `bottom`
does the mirror image. `center` (or omitting the field) keeps today's behavior unchanged. Works
identically for `cover`'s crop overflow, not just `contain`'s letterbox — a `cover`-fit image
cropped into a too-tall box can now be told to keep its top edge (or bottom edge) visible instead
of always cropping evenly off both ends.

Accepts a single value or `{portrait, landscape}`, same as `image_fit`. Purely additive: the
underlying stage-positioning helpers took an optional 4th `align` argument that defaults to the
old centered math when omitted, so every existing config renders pixel-identical to before.

Verified: new smoke tests (contain/cover stage math for all three align values, plus a check that
omitting it still centers exactly as before), new render tests (a real card with a design aspect
far shorter than its box renders the photo pinned top/bottom/center as configured), and an editor
round-trip test (the new Image align dropdown collects into `image_align`) — smoke/render/lifecycle
all passing against source and the minified `dist/` build.
