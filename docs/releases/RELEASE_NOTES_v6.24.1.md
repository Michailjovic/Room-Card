# v6.24.1 — section panels on phones

- On a phone (portrait) a cockpit section now opens **over the whole screen** instead of being
  squeezed into the image area. `placement_portrait: inline` keeps the old behaviour per section.
- With a section open you can **tap another section's icon** to switch straight to it — no need to
  close the first one.
- On phones a section's own `columns:` setting is respected (e.g. `columns: 2` for photo tiles).

Details: [CHANGELOG.md](../../CHANGELOG.md).
