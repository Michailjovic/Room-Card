# v7.3.0 — lenses on the floor plan

The floor plan becomes the hub: one plan, switchable lenses, starting with heating.

- **Lenses:** a dock under the plan switches between *Overview* (the plan as before) and *Heating*.
  The heating lens puts the floor heating in front — every room label reads *now → target*,
  outlined in the colour of its state — and a tap on a room opens its heating controller beside the
  plan, with the room outlined.
- **Badges in every lens:** the heating button shows `!` (a thermostat needs a look), `II` (paused
  by the central mode), `VT` (high tariff) or how many rooms heat, with a power ring — you see it
  without switching. A lens never switches by itself.
- **House panel:** tap the active heating button for the house mode (Versatile Thermostat's
  central mode), the boiler, the tariff, the main supply and every room at a glance.
- **Pause banner:** when the central mode stops the heating, the plan says so, with since when.
- **Setup:** nothing for a plan whose rooms have a `climate` — the lenses appear by themselves.
  `floorplan.lenses`, `lens`, `dock` and `pause_banner`; the house entities in `heating:`
  (`central_mode` and `boiler` are found by themselves, `tariff`, `supply`). All in the Studio.

See docs/FLOORPLAN.md#lenses and docs/HEATING.md#the-house-panel.
