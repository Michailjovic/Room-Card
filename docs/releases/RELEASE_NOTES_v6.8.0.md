# v6.8.0 — Cockpit: sections & panels

Everything on this card so far lives inside one room. Useful for a light switch or a blind, less
so for "how's the laundry going" or "what's playing" — questions that don't belong to any single
room's photo. `sections:` adds pop-up cockpit panels: tap an icon anywhere, get a scrollable grid
of small status/control tiles pulled from wherever those entities actually are.

## Declaring a panel

```yaml
sections:
  - id: appliances
    title: Appliances
    icon: mdi:washing-machine
    placement: sheet-right
    columns: 2

icons:
  - id: open_appliances
    icon: mdi:washing-machine
    top: 80%
    left: 90%
    tap_action: { action: open-section, section: appliances }
```

Any launcher works — an icon, a zone, a badge action, anywhere `tap_action` is accepted.

## Filling it with tiles

Tag the elements that should show up in the panel — on `zones`, `icons`, `elements` or `blinds`,
not `badges` — with `section: <id>` and an optional `tile:` block:

```yaml
zones:
  - id: washer
    section: appliances
    tile:
      name: Washer
      entity: sensor.washer_program
      icon: mdi:washing-machine
      icon_animation: spin
      active_state: run
      value: "{{ state_attr('sensor.washer_program','time_remaining') }}"
      tap_action: { action: navigate, navigation_path: /dashboard-home/utility }
```

Every `tile:` field is optional and falls back to the tagged element itself — `entity`/`icon` in
particular, so a zone that's already wired to an entity needs nothing beyond `section:` and a
`name` to show up. `state`/`value` accept a `{{ }}` Jinja template, evaluated the same way as
everywhere else in this card. `quick` adds small round buttons that call a service directly,
without opening more-info or navigating:

```yaml
tile:
  quick:
    - { name: Pause, icon: mdi:pause, service: washer.pause, target: { entity_id: sensor.washer_program } }
```

## Four placements

`sheet-right` (default), `sheet-bottom`, `full`, `dialog` — plus `size` (sheet width / dialog max
width), `subtitle`, a `badge: auto | none` counting tiles whose `state` matches their own
`active_state`, `visible_template` to hide the whole panel conditionally, and `backdrop: false` if
tapping outside shouldn't close it. Only one panel is open at a time; it closes on Escape, on the
backdrop, or on switching rooms.

## An embedded card instead of tiles

```yaml
sections:
  - id: power
    title: Power
    card: { type: custom:electricity-panel-card }
```

`card:` fills the whole panel with a single embedded card — for a bespoke or third-party fragment
that a tile grid can't express. The card is embedded, never rendered through: this feature does
not read or reshape whatever `card:` points at, and `groups` stays exactly what it was — a
separate, hand-placed pop-up layout mechanism, not merged with this one.

## Degrades, never blanks

A section nothing is tagged into (and no `card:`) shows an explanatory empty state. A `card:`
whose custom element never registers shows a legible notice. A tile whose entity is missing from
`hass` renders `unavailable` rather than disappearing. None of these are silent failures.

## Editor

A new **Sections** tab: add / duplicate / remove / reorder panels, a *Collected* vs *Embedded
card* content-source switch, and — because tiles are collected from all over the card — a live,
read-only list of what's currently tagged into each section, so you can see at a glance whether
you've wired anything up yet. Every zone/icon/element/blind panel gets a **Section** select with a
`tile:` YAML box that only appears once a section is picked. Nothing here requires touching YAML.

## Testing

Full jsdom render coverage: panel count and placement per declared section, one-panel-at-a-time,
badge counting, launcher and tile `tap_action`, Escape/backdrop close, close-on-room-switch, the
empty/unavailable/unregistered-card degradation paths, and the Sections tab plus per-element
Section select round-tripping through the editor's config collector — verified against both the
source file and the minified `dist/` build.

## Migration

None. A card without `sections:` renders exactly as before.

See [`docs/CONFIGURATION.md` → Sections & panels](../CONFIGURATION.md#sections--panels-cockpit-tiles)
and [`docs/EDITOR.md`](../EDITOR.md#the-five-tabs).
