# v7.0.2 — the rest of the 7.0.0 review

No new config keys; update and reload.

## Fixes

- **`area_match: Kitchen`** (one string, not a list) matches — presence follow never found such a room.
- **An unquoted `on` / `off`** in a YAML-mode dashboard matches the state in conditions and
  `state_images`; `state_images` also match a number.
- **A label with `text:`** shows it. A radial gauge no longer draws `NaN` for `thickness: "12px"`;
  a zone takes `z_index`, an embedded card `background`.
- **No stale values:** a navigation chip or a cover control whose entity disappeared shows `—`.
- **A malformed `%` in the URL hash** no longer turns the card into a configuration error
  (`url_sync`).
- **`toggle` on an entity that cannot be toggled** no longer leaves an unhandled error in the console.
- **Thumbnails** with several card instances of different sizes on one page no longer take each
  other's pictures away.

## Studio

- **Ctrl+S while typing** saves the field you are typing in.
- **Renaming a group** changes only its own room's references; **renaming a section** also follows
  into the floor plan's `attention_sections`.
- **The config check** also reports references that point at nothing (a room, a section) and
  navigation, light controls or companion cards that have no region in any layout profile.
- **The forms offer only keys the card reads** (the reference and the AI spec follow).

Details: [CHANGELOG.md](../../CHANGELOG.md).
