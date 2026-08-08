# v6.0.0 — Documentation overhaul + editor UX rebuild milestone

Documentation and versioning release. **No code, config keys, or card behaviour changed** — if
you're updating from v5.10.1, nothing on your dashboard will look or act differently.

## Docs

The README was pushing 900 lines, most of it configuration reference and editor walkthrough. It's
now a short landing page — pitch, feature table, screenshots, install, quick start, links out —
plus two new focused docs:

- **[`docs/CONFIGURATION.md`](../CONFIGURATION.md)** — the complete YAML reference: layout engine,
  conditions, filters, overlays, gauges, blinds & cover control, zones, badges, icons/labels,
  embedded cards, companion cards, light controls, camera/weather, template visibility, groups,
  multi-room, and a complete example config.
- **[`docs/EDITOR.md`](../EDITOR.md)** — the GUI editor tab by tab, Edit mode in full, and a
  summary of what changed in the editor UX rebuild below.

`LAYOUT.md` and `PRESETS.md` are unchanged and now linked from both new docs.

## Editor UX rebuild — now complete

This release also marks the finish line for the editor GUI/UX revalidation that shipped across
v5.9.0–v5.10.1:

- **Edit mode unified** (v5.9.0) — *Test mode* and *Drag-edit preview* merged into one header
  toggle.
- **Layout tab got a live preview** (v5.9.11) — Portrait/Landscape as sub-tabs with an
  illustrative mini grid preview, and a fix so Layout edits actually reach the editor's live
  preview card.
- **Rooms & menu tab reorganized** (v5.9.13) — split into four accordions (Room identity,
  Presence & follow, Navigation menu, Deep-linking).
- **Dead control removed** (v5.10.1) — the blind editor's non-functional "Dock side" dropdown.

## Roadmap note

v6.0.0 was originally earmarked for the HACS default-repository submission milestone. That's been
re-scoped: this release takes the v6.0.0 number for the documentation work above, and the HACS
submission is now its own upcoming milestone with a version number to be chosen when it happens.
See `ROADMAP.md` for the full picture.
