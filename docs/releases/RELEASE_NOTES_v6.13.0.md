# v6.13.0 — `layout.height: fill`: pin portrait to full viewport height too

Reported on mobile, after two rounds of investigation: a full-screen cockpit dashboard (`type:
panel` view, `sections:`/panels, image row already switched to `1fr`) still stopped short of the
bottom of the phone screen — a black unused strip below the card, and a section panel that could
only open as tall as that shortened card, not the real screen.

## Root cause

`layout.height: viewport` (the default) has never meant the same thing on both profiles:

- On **landscape**, it pins `ha-card` to the real available height —
  `calc(100svh - var(--header-height,56px))`, refined post-paint by measuring the actual scroll
  container. This is the "designed for panel-view / full-screen dashboards" behaviour the docs
  describe.
- On **portrait**, it deliberately does the opposite: `ha-card` gets `height: auto` and sizes
  itself from its own content instead. This is intentional — on a phone, width is the limiting
  factor, and force-stretching leftover vertical space onto every region would just make them
  disproportionately tall for no benefit on an ordinary photo-and-overlays room card.

Both of the previously-applied fixes (the `type: panel` view, and switching the image row from
`auto` to `1fr`) were correct and necessary, but neither one touches this: the `1fr` row still
lives inside a grid container whose ultimate parent — `ha-card` itself — is pinned to `height:
auto` on portrait. A `1fr` track can only consume the *remainder* of a definite height; against
`auto` there is no remainder to give it, so the grid (and everything in it) simply reverts to
sizing itself from content, exactly as if the row were still `auto`. The visible symptom was
never really about the row's track value — it was `ha-card`'s own height, one level up.

This split was never exposed as a choice — a plain photo card wants the portrait default, but a
cockpit dashboard's sections/panels need the phone screen to actually behave like a full-screen
view, the same way it already does on a tablet.

## The fix

New `layout.height: fill` value. It behaves exactly like `viewport` — same `calc(100svh - header)`
measurement, same post-paint refinement, same `container`/fixed-length override rules — except
portrait is pinned into it too instead of being carved out to size-to-content:

```yaml
layout:
  height: fill   # was: viewport (or omitted — same default behaviour)
```

`viewport` is unchanged on both profiles — this is purely additive, opt-in for the dashboards that
need it. The card editor's Layout tab **Height** dropdown now offers **fill (full view, phones
too)** alongside viewport/container/custom.

Nothing about the grid/row engine itself changed — `1fr` rows still work exactly as documented, and
still matter: `fill` gives `ha-card` a real height to fill, and the `1fr` image row is what tells
the grid to hand that space to the image/panel area instead of leaving it unclaimed.

Verified: new render tests (portrait + `height: fill` renders the pinned `calc(100svh…)` height
instead of `auto`; the root-height-pin gate no longer bails out for portrait when the mode is
`fill`; the editor's Height select offers and round-trips the new option) — smoke/render/lifecycle
all passing against source and the minified `dist/` build.
