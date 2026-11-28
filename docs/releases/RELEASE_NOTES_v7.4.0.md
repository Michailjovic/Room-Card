# v7.4.0 — lights and cleaning on the floor plan

The floor plan gets two more lenses, and your vacuums are back on it.

- **Lights lens:** every room says on (how bright) or off; tap a room for its **light
  controller** — each light with its switch, brightness, warm / neutral / cold and colours, the
  whole room on / off. The lens's panel lists every room's lights, with *All off*.
- **Light controller anywhere:** `tap_action: {action: lights, room: living_room}` (the room's
  light controls) or `entities: [...]`.
- **Cleaning lens:** vacuums, trails and when each room was cleaned. Tap rooms to queue them in
  AnyVac's shared selection, hold to clean one now; the panel shows every vacuum (state, battery,
  errors), the mode and *Clean n rooms*.
- **Badges:** lights lit, vacuums cleaning or an error, rooms queued — visible in every lens.
- **Hot water** in the house panel, next to the heating boiler.
- **Fixed — vacuums off the plan:** after AnyVac moved all vacuums into one shared home frame, the
  plan lost them or drew them in the wrong rooms. It now fits each map to its rooms by itself.

See docs/FLOORPLAN.md#lenses and docs/LIGHTS.md.
