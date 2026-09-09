# v6.11.3 — Declared tiles get a full GUI editor

Section-declared `tiles:` (v6.11.0) were YAML-only: the Sections tab showed what was declared in a
read-only "currently collected" list, alongside room-tagged and auto tiles, but there was no way
to add, edit, or reorder a declared tile from the editor itself. Anyone using declared tiles —
content with no room anchor, like a TV status summary or a projector-screen remote — had to hand-
write and hand-maintain that YAML.

## What's new

Each section in the **Sections** tab now has its own **Declared tiles** list:

- **+ Tile** adds a new declared tile to the section.
- An **ID** field (optional — falls back to `<section id>_tile_<index>`, same as the YAML default).
- A **Tile (YAML)** box for the scalar fields — `name`/`entity`/`icon`/`icon_animation`/`state`/
  `state_class`/`active_state`/`value`/`progress`/`quick`/`tap_action` — identical in shape to a
  tagged element's own tile box.
- The exact same **Image** field, new **Aspect ratio** field (v6.11.2's `image_ratio`, now with a
  dedicated input instead of only living in YAML), and **Overlays** editor (add/remove/reorder,
  each overlay with Image URL / Conditions YAML / Transform sub-panel) that a tagged element's
  `tile.image` gets.
- **▲▼** reorder, **Duplicate**, and **Remove tile**.

```yaml
tiles:
  - id: tv_loznice
    name: Ložnice
    entity: media_player.lg_webos_tv_oled83g58lw_beuyljp
    image: /local/Dashboards/Cockpit/Media/tv-off.webp
    image_ratio: '16/9'
    # ...overlays / quick / tap_action, all now editable from the Sections tab
```

The **Aspect ratio** field is also now available on a room-tagged element's own tile editor
(Elements tab → any zone/icon/element/blind → Section → Image), not just on declared tiles — it
was only reachable via the freeform tile YAML box before.

## How it's built

Rather than a parallel implementation, a declared tile's Image/Aspect-ratio/Overlays editing reuses
the *exact same* composite-keyed machinery a tagged element's tile already had (`_tileImageBox`,
`_tileOverlayItem`, `_tileOverlayTransform`, `_collectTileOverlay`), just addressed with
`kind: 'dt'` and a composite index (`'<sectionIndex>_<tileIndex>'`, since a declared tile lives
nested inside `sections[i].tiles[j]` rather than a flat top-level/per-room array). Only the overlay-
array resolver and the five click handlers that fed it a `parseInt`'d index needed a small change
to carry that composite index through instead of truncating it. Everything else — the overlay
markup, the transform sub-panel, the states/range/spin editor — is shared code, unmodified.

Adding, removing, duplicating and reordering the tiles *themselves* (not their overlays) is new,
section-scoped code (`+ Tile`/Remove/Duplicate/▲▼), since a section's `tiles:` isn't a flat
top-level array and so doesn't fit the generic `[data-mv]`/`_mvKinds` reorder mechanism used
elsewhere in the editor — the same reasoning v6.9.0 already used for tile-overlay reordering.

`_collectConfig()`'s sections rebuild now also re-collects each section's `tiles:` array from the
DOM (previously it only ever passed `tiles:` through untouched, relying on `Object.assign` to
preserve it — safe for round-tripping, but it meant edits to declared tiles from a form could never
have worked without this).

No config changes, no migration needed — this is editor-only; the underlying YAML shape declared
tiles already used (since v6.11.0/v6.11.2) is unchanged.

Verified: 15 new render tests covering the declared-tile list's rendering (panel, ID, YAML box
exclusions, Image/Aspect-ratio prefill, the shared overlay editor), collectConfig round-tripping
(`image_ratio`, a new overlay), and add/remove/duplicate/reorder for the tiles themselves, plus a
regression test confirming the Aspect ratio field is now present on the pre-existing tagged-element
tile editor too — smoke/render/lifecycle all passing against source and the minified `dist/` build.
