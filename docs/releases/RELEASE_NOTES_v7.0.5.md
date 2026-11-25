# v7.0.5 — what the schema promises, the card does

No new config keys; update and reload.

- **Blinds:** a blind in a `group` now shows and hides with it, and its `tap_action` /
  `hold_action` / `double_tap_action` run. With a `float` cover control the tap still reveals the
  controller (the config check tells you the action is unused there).
- **Icons:** `animation: blink` / `pulse` (with `animation_color`) works, like on labels and badges.
- **Badges:** with both `label` and `label_template`, the template's value stays; `label` is only
  shown until the template answers.
- **Gauges:** `animation: none` no longer pulses.
- **Lighter room switch:** two layouts instead of four or five, and one state pass instead of
  two (in the demo on a desktop browser: about 16 → 13.5 ms per switch).
- **Schema:** keys nothing ever read are no longer offered in the studio's forms and the reference
  (an overlay's `className` / `fade` / `slide`, an icon's `attribute`, a label's `width` / `height`,
  a blind's `label` / `value` / `animation`, a base image condition's `value`, the light controls'
  `top` / `left`). Configs that have them render as before.
- Two new test tiers: every schema key has a visible effect (`npm run test:keys`), and an
  in-place update draws the same as a fresh render (`npm run test:stale`).

Details: [CHANGELOG.md](../../CHANGELOG.md).
