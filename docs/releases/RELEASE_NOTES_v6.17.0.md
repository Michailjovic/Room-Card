# v6.17.0 — Design refresh, part 2: built-in light pills

## Highlights

**Built-in light pills (opt-in).** Set `light_controls.style: native` and the light strip draws its
own pills instead of mounting `material-slider-card`: an icon, the name and the brightness, with the
fill growing in the light's own colour. Tap toggles, drag sideways to dim (drag to the left edge to
turn off), long-press for more-info, swipe vertically to scroll. Same `height:` as before, same lux
ring, no external card required. In the editor: *Light controls → Style → Built-in pills*.

**Cover control in the shared look.** The roller-blind control now uses the card's design tokens
(surface, hairline border, tabular percentage, softer buttons) — with every dimension unchanged,
so nothing on your dashboard moves.

## Fixes

- Saving the editor's *Light controls* panel no longer drops keys that have no field there (such
  as an entity's `icon:`).

## Notes

- `style: native` is opt-in for now; the default stays `material-slider-card` until the pills have
  been tried on wall tablets.
- Light pills never change a light on their own — a drag only sends a brightness when you let go.

Full details: [CHANGELOG.md](../../CHANGELOG.md) · configuration: [docs/CONFIGURATION.md](../CONFIGURATION.md)
(*Light controls → Built-in pills*).
