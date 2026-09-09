# v6.12.0 — cockpit tiles gain `hold_action` / `double_tap_action`

Every other tappable thing in this card — a room `zone`, an `icon`, a `label`, a `gauge`, a
`vacuum_widget` — has long supported `hold_action` and `double_tap_action` alongside `tap_action`,
all routed through the same `_addZoneListeners()` helper (hold-progress ring, `hold_delay`
override, `hold_feedback`/`hold_color` opt-outs). A cockpit **tile** (`sections[].tiles` or a
tagged element's own `tile:` block) never got that treatment — its click-wiring was a single, tile-
specific `click` listener that only ever read `tap_action`. Writing a `hold_action:` into a tile's
YAML silently did nothing.

## What's new

Tiles now go through `_addZoneListeners()` exactly like everything else, so `hold_action`,
`double_tap_action` and `hold_delay` all work on a tile the same way they already do on a zone:

```yaml
sections:
  - id: cleaning
    title: Úklid
    tiles:
      - name: Kuchyň
        entity: vacuum.s6_kitchen
        icon: mdi:robot-vacuum
        icon_animation: spin
        active_state: cleaning
        tap_action: { action: navigate, navigation_path: /dashboard-various/vacuum }
        hold_action: { action: more-info, entity: vacuum.s6_kitchen }
```

A short tap on the tile navigates to the full vacuum dashboard; a long-press opens that vacuum's
own more-info dialog directly — no second tile or embedded card needed just to get at more-info.

A tile now gets the tappable cursor/keyboard-focus treatment (`data-tappable`) as soon as it has
*any* of the three actions, not only `tap_action`.

## Under the hood

Tiles host their own **quick buttons** (small round buttons that call a service directly, sitting
inside the same element `_addZoneListeners` now also listens on for `touchstart`/`mousedown` to
drive the hold-progress ring). A quick button's own listener already called `e.stopPropagation()`
on `click` so a quick-button tap never also ran the tile's `tap_action` — but it did **not** stop
`touchstart`/`mousedown`/`touchend`, which would have bubbled up and let the tile's own hold timer
start (and, on a slow tap, fire `hold_action`) underneath a quick-button press. Fixed by having
quick buttons swallow all four events, not just `click`.

No changes to the freeform "Tile (YAML)" editor box were needed beyond its field-list comment —
`hold_action`/`hold_delay`/`double_tap_action` are ordinary scalar keys, so they already round-trip
through the same box `tap_action` always has, for both tagged-element tiles and declared tiles.

No migration needed — purely additive; a tile with no `hold_action`/`double_tap_action` behaves
exactly as before.

Verified: 6 new render tests (tappable attribute with only hold_action set, a short tap still runs
tap_action when both are present, holding past `hold_delay` runs `hold_action` instead, a quick
button press never leaks through to the tile's hold timer, the editor's field-list comment mentions
the new fields, a declared tile's `hold_action` round-trips through the YAML box) — smoke/render/
lifecycle all passing against source and the minified `dist/` build.
