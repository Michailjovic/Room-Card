# v5.5.1 — Fix: `nav.live: full` mini content sizing (blinds nearly invisible)

## What was still wrong

v5.5.0 fixed one bug in the living-room `day_night` blind not showing up in its `nav.live: full`
mini, but live testing showed the blind was still missing — even though its gauge and fill
elements now had real, non-zero computed styles.

## Root cause

Minis are scaled down to fit their small nav thumbnail using CSS `transform: scale()`. `transform`
only affects *painting* — the element's own layout (percentage-based children, aspect-ratio, etc.)
still computes at its **pre-scale** size, but `getBoundingClientRect()` reports the **post-scale**
(visually smaller) size. The card's stage-sizing code uses `getBoundingClientRect()` to size the
internal content box in pixels, so under a mini's roughly 0.29x scale, that box ended up pinned to
about 0.29x its intended size — and everything positioned by percentage inside it (gauges, badges,
icons, labels) inherited that wrong, too-small box.

Most gauges are simple percentage fills, so this just looked a little compressed and was easy to
miss. `day_night` blinds measure their own real pixel height to draw a repeating slat pattern —
with the content box already about 3.3x too small, and the whole thing then scaled down *again*
by the outer transform, the slats ended up sub-pixel wide and effectively invisible.

## Fix

Switched the mini scaling mechanism from `transform: scale()` to CSS `zoom`. Unlike `transform`,
`zoom` scales layout itself, so every pixel measurement inside a mini stays consistent with the
CSS percentages sizing it — no more mismatch. This is a general fix, not specific to blinds: it
corrects sizing for anything measured by pixel rect inside a mini under `lock_aspect`.

## Testing

Live-verified on the reported living-room blind: gauge size went from a wrong 34×25px to the
correct 114×83px, and the slat stripe width went from an invisible 0.7px to a visible 2.4px.
Smoke tests and the full render suite pass.

## Note

`zoom` is supported in all Chromium-based browsers (which HA dashboards/tablets/kiosk apps
typically use) and in modern Firefox (126+) and Safari (17+). On a very old browser without
`zoom` support, a mini would simply render at its full unscaled size rather than shrink to fit —
not expected to matter for typical HA setups.
