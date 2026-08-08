# v4.0.0 — Layout engine rebuild: two profiles on a % grid

**Breaking release.** The 4-tier responsive system (mobile / tablet / desktop / ultrawide, width breakpoints) is gone. In its place: **two GUI-built layout profiles — `portrait` and `landscape` — where every block of the card is placed on a percentage grid of the available viewport.** Old configs are auto-migrated on load. Full spec in [LAYOUT.md](LAYOUT.md).

## Highlights

- **Profiles by shape, not device.** The active profile is picked by the viewport's width/height ratio (`layout.threshold`, default 1.0). Rotate a tablet → the card switches profile automatically. Force one profile with `layout.orientation`, or **pin a specific device** via `layout.orientation.by_browser` (browser_mod ID — one click in the editor).
- **% grid of the screen.** Each profile defines `columns`/`rows` in % and places the regions `nav`, `cards_above`, `image`, `lights`, `cards_below`, `cover` into cells — including spans (`row: 1/6`). A region you don't place is hidden in that profile. You own the percentages.
- **Full-view height.** `layout.height: viewport` (default) sizes the card to the real available screen — HA header, view padding and safe-areas measured, kiosk mode included. `container` and fixed values available for embedding.
- **Image region inverted.** The grid gives the image a fixed box; the image fills it at its design aspect with `image_fit: cover` (crop) or `contain` (letterbox). All element % positions stay glued to the image, on every screen.
- **Cover control docked or floating — per profile.** `control.placement: {landscape: dock, portrait: float}`: dock = permanently visible in the `cover` region (vertical rail or horizontal bar, following the region's shape), float = the v3.3.0 tap-reveal overlay.
- **New Layout tab** in the editor: height source, orientation, threshold, device pin, grid gap, and both profile grids with per-region row/column/scroll inputs. Per-profile `aspect_ratio`, `border_radius`, `image_fit`.
- **Test mode** now shows region outlines with names, a live viewport×profile badge and a ⇅ button to preview the other profile.

## Migration

Configs without a `layout:` block are converted **in memory** when loaded:

- `mobile` → `portrait`, `desktop` → `landscape`; `tablet`/`ultrawide` values dropped (with a console notice)
- `breakpoints`, `mobile_breakpoint`, `max_height`, `nav.auto_breakpoint` removed
- strip `media:` values remapped (`mobile` → `portrait`, `desktop` → `landscape`)
- a starter `layout:` is generated mirroring your old stacked look (a side nav rail becomes a landscape column)

Open the card editor and press **Save migrated config**, then tune the percentages in the Layout tab.

## Notes

- The card is designed for **panel-view / full-screen** dashboards. When embedding between other cards, set `layout.height: container` or a fixed value.
- Tight regions crop their content by default (`overflow: hidden`); enable the per-region **Scroll** checkbox for `overflow: auto`.

**Tests:** 159 smoke assertions pass (profiles, grid CSS, cover/contain stages, migration, per-profile cover placement).
