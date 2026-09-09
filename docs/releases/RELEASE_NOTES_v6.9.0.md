# v6.9.0 — Cockpit: image tiles

v6.8.0's cockpit panels could show one thing per tile: an animated icon and a state line. Real
enough for a plain switch, but a washing machine has a drum that turns, a dryer has a door, a
robot vacuum has a spinning brush — and D3 always planned for that second scheme. `tile.image`
adds it: a tile becomes its own tiny stage, a device photo with moving parts layered on top.

## Declaring an image tile

```yaml
zones:
  - id: pracka
    section: appliances
    tile:
      name: Pračka
      image: /local/pracka.webp
      overlays:
        - id: buben
          image: /local/pracka_buben.png
          transform:
            entity: sensor.pracka_stav
            origin: 50% 58%
            spin: { min_duration: 1.2s, max_duration: 3s }
```

Setting `tile.image` is the whole switch — nothing else about the tile (its `section:` tag, its
`name`/`entity`/`state`/`quick`/`tap_action`) changes. A tile with no `image:` keeps rendering the
existing icon+state scheme exactly as it did in v6.8.0.

## Reusing the transform engine, not rebuilding it

`tile.overlays` is the same `overlays:` shape a room already has, applied to the tile's own image
instead of the room photo: `image`, `transition`, `animation`, `conditions.opacity`/`filter`,
`state_images`, and the full [`transform:`](../CONFIGURATION.md#moving-an-overlay--transform)
block — states map, numeric range, or continuous spin, with `origin`, `perspective` and its own
`transition`. `origin` is measured against the *tile's* image, not the room's. The one field that
does not carry over is `group` — `groups` are a room-level pop-up mechanism (D13), and a tile has
no room-level groups to join.

The tile is a genuinely independent stage: no nested `room-overlay-card`, no second card instance
per tile. Under the hood it is the exact same condition and transform resolvers a room overlay
uses (`resolveVal`, `tfResolve`, the state-image picker), pointed at a smaller stage — so a spin
that looks right on a door in the room photo looks right on a washing machine drum in a panel
tile, because it is the same code.

## No cropping, ever

Per D4 (closed in the original cockpit plan and not reopened here): a tile image is never carved
out of the room photo. Click zones in this card are deliberately oversized for touch, and real
appliances are rarely axis-aligned in a photo taken at an angle — a crop tool was considered and
dropped as a large piece of editor machinery serving a thin gap. A tile image is its own asset,
drawn or photographed separately, exactly like any other overlay PNG this card already uses.

## Degrades, never blanks

An overlay with no `image:` on it simply contributes nothing to the stage for that layer — the
same behaviour a room overlay already has when nothing matches its `state_images`. It never
throws and never blanks the rest of the tile.

## Editor

Filling in a tile's new **Image** field reveals an **Overlays** list on that same tile panel —
add, remove, and reorder overlays, each opening the *exact* editor panel a room's own overlays
get: Image URL, Conditions YAML, and a **Transform** sub-panel with the states/range/spin mode
select, prefilled fields, and live add/remove state rows. It is not a smaller or YAML-only version
of that editor — it is the same one, scoped to one tile's own overlay list instead of the room's.

## Testing

Full jsdom render coverage: the icon-vs-image branch, overlay layer order, a spin transform
resolving from a live entity exactly as a room overlay would, `conditions.opacity` resolving the
same way, degradation when an overlay carries no image, and the editor round trip — the Image
field, the Overlays list appearing, add/remove/reorder, and the Transform sub-panel's own
round-trip — all verified against both the source file and the minified `dist/` build. A
real-Chromium Playwright test confirms a tile overlay's spin animation actually computes (name and
duration) rather than only looking right as an inline style string.

## Migration

None. A tile without `image:` renders exactly as it did in v6.8.0.

See [`docs/CONFIGURATION.md` → Image tiles](../CONFIGURATION.md#image-tiles) and
[`docs/EDITOR.md`](../EDITOR.md#the-five-tabs).
