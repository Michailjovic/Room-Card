# v6.11.0 — Declared tiles: a section can own content directly

Every section tile so far came from tagging an existing `zones`/`icons`/`elements`/`blinds` entry
with `section:` (+ an optional `tile:`), or from `source: auto`, or from an embedded `card:`. That
covers a status tile riding along with a real room hotspot, and a domain-wide bucket, and a fully
custom panel body — but not a fourth, common shape: content that belongs in a section and nowhere
else. A TV's status summary. A projector screen's remote. Nothing on any room's photo corresponds
to these — the only reason to tag an element for them was to have *something* to hang `section:`
on, which meant inventing a throwaway icon with a placeholder position on a room canvas it had no
business being on.

A section can now declare its own tiles directly:

```yaml
sections:
  - id: media
    title: Media
    tiles:
      - name: Living room
        entity: media_player.tv_living_room
        value: "{{ state_attr('remote.tv_living_room','current_activity') }}"
        tap_action: { action: navigate, navigation_path: /dashboard/remote }
      - name: Screen
        icon: mdi:projector-screen
        quick:
          - name: Up
            icon: mdi:arrow-up-bold
            service: switch.turn_on
            target: { entity_id: switch.screen_up }
```

Same fields as a tagged element's `tile:` block, same rendering, same click/quick/image/overlay
machinery — `rocTileDef()` reads a declared tile exactly like it reads a tagged one, so nothing
downstream needed to change. `rocCollectSections()` folds `sections[].tiles` in before it walks
rooms for tags, so declared tiles land first in resolution order:

**declared → room-tagged collected → auto → embedded `card:`**

Declared first because it's the most deliberate authoring — content the section owns outright,
not something that happened to be tagged on an element elsewhere. An entry's `id:` is optional
(falls back to `<section id>_tile_<index>`) and only matters for the editor's read-only "currently
collected" preview, which now shows `—` in place of a room name for a declared tile.

No config changes for anyone not using this. No migration needed.

Verified: 6 new smoke tests (`rocCollectSections` with `tiles:` — ordering, id fallback,
`rocTileDef` reading a declared tile), 4 new render tests (a section with zero room/zone tags
still renders its declared tiles; declared → collected → auto ordering end-to-end; a declared
tile's `tap_action` and `quick` both fire exactly like a tagged element's) — smoke/render/lifecycle
all passing against source and the minified `dist/` build.
