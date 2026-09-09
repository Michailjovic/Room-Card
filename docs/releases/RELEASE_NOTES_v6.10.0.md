# v6.10.0 — Cockpit: auto tiles & onboarding

The cockpit plan's last phase (COCKPIT_PLAN.md kap.8) is about getting a first section on screen
without writing any YAML by hand at all. `source: auto` fills a section straight from Home
Assistant's own entity list, and three editor helpers — recipes, an untagged-device scan, and a
one-click room bootstrap from HA's area registry — do the rest of the typing.

## Declaring an auto section

```yaml
sections:
  - id: heating
    title: Heating
    icon: mdi:radiator
    source: auto
    domain: climate
```

Every `climate.*` entity gets its own tile, sorted by friendly name, minus whatever is already
tagged into this section by hand. No zone to draw, no `tile:` block to write — the tile's icon
comes from a small per-domain default (`climate` → `mdi:thermostat`, `cover` →
`mdi:window-shutter`, `media_player` → `mdi:cast`, `vacuum` → `mdi:robot-vacuum`, `fan` →
`mdi:fan`, `light` → `mdi:lightbulb`, `switch` → `mdi:toggle-switch`) and its name from the
entity's own `friendly_name`. An auto tile always stays in icon mode — there's no tagged element
to hang a `tile.image` off, so [image tiles](RELEASE_NOTES_v6.9.0.md) stay a collected-tile thing.

## Combining sources — a fixed gap closed

The plan always described a section's content as up to three sources at once, resolved in order:
collected tiles, then auto tiles, then an embedded card at the bottom (kap.4). v6.8.0's `card:`
handling didn't actually honour that — a `card:` section rendered the card alone and silently
dropped any collected tiles. That's fixed here: a section can genuinely combine all three now, in
that order, in the same panel body. A plain `card:` section with nothing else tagged into it
behaves exactly as before.

Under the hood this only changes what the panel body is built from — the same skeleton, the same
`_updateSectionTiles()` per-tile update loop, the same click wiring, now all reading one resolved
tile list (collected + auto, in that order) instead of the collected-only list. The list is
resolved once per `_render()` — a room switch, a layout-profile flip, the first time `hass`
arrives — never on a state tick, the same performance rule tile collection has followed since
v6.8.0. An entity Home Assistant adds while the dashboard is already open shows up at the next
such render, not instantly; this is a deliberate trade against rebuilding tile DOM on every state
update.

## Onboarding, so the first section doesn't start from nothing

Three GUI-only helpers (D11 stands: nothing here is reachable only through YAML):

- **Recipes.** A "Recipe…" select next to *+ Add section* pre-fills a whole section: Appliances,
  Cleaning (`source: auto` / `vacuum`), Media (`media_player`), Heating (`climate`), Covers
  (`cover`), Electricity (`card: { type: custom:electricity-panel-card }`, with the existing
  missing-card notice if it isn't installed), or Weather (id/title/icon only — the plan leaves its
  actual source an open question).
- **Find untagged devices.** The Sections tab scans for `vacuum`/`climate`/`cover`/`media_player`
  entities that aren't reachable from any section yet — not tagged individually, and not already
  covered by an existing `source: auto` section for that domain — and groups them by domain with a
  one-click "+ Add a section for these" using the matching recipe above.
- **Bootstrap rooms from HA areas.** While the card is still single-room, and only when the
  connected Home Assistant actually exposes the modern area registry as plain synchronous
  dictionaries (`hass.areas`/`hass.devices`/`hass.entities` — no websocket round-trip needed;
  older Home Assistant simply never shows this button), the Rooms & menu tab offers *"I found N
  areas — create a room for each?"*. One click converts to multi-room and adds one room per area,
  with that area's entities (matched directly, or via their device's `area_id`) pre-assigned as
  `icons:` in a simple placeholder grid — there's no photo yet to position them against, so you
  reposition them in the Elements tab once you add one.

## Testing

Full jsdom render coverage: an auto section combining a collected tile with auto-derived ones (and
not duplicating the collected entity), a different-domain entity correctly excluded, a `card:`
section rendering its collected tiles above the embedded card host, and the editor round trip for
all three onboarding helpers — the Domain select, a recipe filling in a pre-built section, the
untagged scan finding and adding a section, and the area-bootstrap button converting to multi-room
with entities pre-assigned (and staying absent entirely when `hass.areas` isn't there) — all
verified against both the source file and the minified `dist/` build.

## Migration

None. A config with no `source: auto` section renders exactly as before, and a plain `card:`
section with nothing tagged into it behaves exactly as before too.

See [`docs/CONFIGURATION.md` → Sections & panels](../CONFIGURATION.md#sections--panels-cockpit-tiles)
and [`docs/EDITOR.md`](../EDITOR.md#the-five-tabs).
