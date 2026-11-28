# The light controller

[← Back to README](../README.md) · [Floor plan lenses](FLOORPLAN.md#lenses) · [Heating controller](HEATING.md) · [Reference](REFERENCE.md)

*(7.4.0)* A room's lights in one sheet: every light with its switch, brightness, colour temperature
and colours, and the whole room on / off. It opens beside the floor plan from a tap on a room in
the [lights lens](FLOORPLAN.md#lenses), and from anything with a tap action:

```yaml
tap_action:
  action: lights
  room: living_room                 # a card room: its light_controls (with their names)
```

```yaml
tap_action:
  action: lights
  entities: [light.panel_1, light.panel_2, switch.mirror]
  name: Bathroom
```

`entity` (one light) works too. Names come from the card room's `light_controls` (*Left*, *Centre*,
*Right*), else the lights' own names.

## What it shows

- **The room** — its name and how many lights are on; *All on* / *All off*.
- **Brightness** for the whole room (with more than one dimmable light) — moves the lights that
  are on, or switches the dimmable ones on at that level.
- **Every light** — a switch; with brightness a slider (sent when you let go); with colour
  temperature *Warm* / *Neutral* / *Cold* (within the light's range); with colour six swatches.
  Switches have only the switch.
- The plan outlines the room while it is open; Escape, × or a tap beside it closes it.

The lights lens's own panel (its dock button tapped again) lists every room of the plan with how
many lights are on — a tap opens that room — and *All off* for the whole plan (after a
confirmation).
