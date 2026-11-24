# v7.0.4 — a lighter floor plan by default

No new config keys; update and reload.

- **Floor plan:** the animations (heating flow, pulses, markers) now run in steps, about ten a
  second, on every quality setting except **`quality: high`**, which keeps them smooth. Smooth, they
  repainted the whole plan 60 times a second for as long as it was on screen — a wall tablet showing
  the plan all day feels that.
- **A navigate action** no longer runs the card's navigation handling twice.
- **Vacuum widget `icon`** is a known key in the config check (the studio itself writes it).
- **Schema:** icons and vacuum widgets no longer offer `width` / `height` (they are sized by
  `size`), and a cover control no longer offers `position` — none of them was ever read.
- The demo workflow runs on Node 24.

Details: [CHANGELOG.md](../../CHANGELOG.md).
