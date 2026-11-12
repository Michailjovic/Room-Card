# v7.0.1 — fixes from a full review of 7.0.0, lighter updates

No new config keys; update and reload.

## Fixes

- **A confirmation could run without being confirmed.** The confirmation dialog kept listening for
  keys after it was gone (the card re-rendered under it, or left the page): the next **Enter**
  pressed anywhere ran the action. It now closes as *Cancel*, and Enter counts only inside the
  dialog.
- **Native light pills** follow a light that was dimmed or recoloured elsewhere (a wall switch, an
  automation, another device). They kept the old value while the light stayed `on`.
- **`visible:` as a list of conditions** works (all must hold). Written that way, an element used
  to stay hidden for good.
- **Visibility works the same on every element:** `visible`, `visible_conditions` and
  `visible_template` on zones, icons, badges, labels, gauges, blinds, glows, overlays, embedded
  cards and vacuum widgets. If an overlay of yours carries a `visible:` that is false, it is hidden
  from now on.
- **Studio:** changing a room's **ID** keeps the overview grid, the floor plan and `switch-room`
  actions pointing at it. The room used to drop out of the overview without a word.
- **CSS values with a double quote** (`font_family: '"Roboto Mono", monospace'`,
  `url("/local/x.png")`) no longer break their element — and a pasted config can no longer add
  markup to the page through a size, a colour or a font.

## Performance

- **State updates do about half the work** — number formatters are built once, not for every value.
- **Floor plan at `quality: low`** runs its animations in steps (about ten a second) instead of
  repainting the whole plan 60 times a second. The default look is unchanged; try it on a wall
  tablet that shows the plan all day.

Details: [CHANGELOG.md](../../CHANGELOG.md).
