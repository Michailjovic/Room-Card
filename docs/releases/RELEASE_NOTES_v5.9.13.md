# v5.9.13 — Rooms & menu tab: split into 4 collapsible sections

Part of the ongoing editor GUI/UX revalidation ([`EDITOR_UX_REVALIDATION.md`](EDITOR_UX_REVALIDATION.md))
— proposal 4, the last remaining tab from that list.

## What's new

The Rooms & menu tab used to be one unbroken flat block — around 15 distinct concerns back to
back with no sub-headers, the densest tab in the editor. It's now 4 collapsible sections, same
accordion pattern already used on the Elements tab (compared a 5-section and a 4-section version
first; 4 won out — enough separation without over-fragmenting):

- **Room identity** — id, name, icon, area match, thumbnail chip override. Open automatically the
  very first time the editor renders (same nudge the Image tab's "Background & basics" already
  gets), since it's what most people reach for first.
- **Presence & follow** — room_entity, follow hold, card_id, follow mode, room_state_entity, and
  the "This device" browser_mod mapping.
- **Navigation menu** — style, position, live thumbnails (with its own conditional Mini-room
  settings panel), sizing, wheel switch, follow button, and the Chips/Cards YAML lists.
- **Deep-linking** — Sync-room-to-URL + hash key, now with a short explanation of what it does.

Every field keeps its exact id — purely a regrouping, no config or parsing changes.

## Compatibility

No config schema changes — editor-only.

## Testing

7 new render tests (all 4 panels present, Room identity open by default and the others closed on
first render, fields land in the right panel). Full smoke + render suites green (0 FAIL).
