# v5.6.0 — `nav.live: full` editor UI

## What's new

`nav.live: full` — real, live mini-rooms in the nav thumbnails (shipped v5.4.0, with sizing bugs
fixed through v5.5.2 and confirmed working on a real dashboard) — was YAML-only until now.

The editor's **Rooms & menu** tab now has:

- A **full** option on the *Live thumbnails* dropdown, next to the existing `off` and `composite`.
- A **Mini-room settings** panel that appears when `full` is selected: a templates checkbox, a
  camera-refresh field (minimum 30 seconds), and a reference-width field — the GUI equivalents of
  `nav.mini.templates` / `nav.mini.camera_refresh` / `nav.mini.width_ref` in YAML.

Nothing changes for existing `off`/`composite` configs.

## Testing

New render tests cover: the `full` option being present in the dropdown, the settings panel
showing/hiding correctly when you pick it, the config round-tripping properly, and the panel
pre-filling correctly when you reopen the editor on a config that already has `nav.mini` set.
168 smoke tests and the full render suite pass.

## Note

This closes out the `nav.live: full` feature build-out — mount mechanism, three rounds of live
sizing fixes, and now the editor UI. What's left (making mini instances rebuild only when they
actually need to, instead of on every render, and a future "custom" mode for excluding specific
elements from a mini) are follow-ups, not required for `full` mode to work correctly today.
