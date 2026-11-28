# v7.2.0 — the heating controller

Set a room's temperature in degrees, from anywhere on the card.

- **New action `heating`:** `tap_action: {action: heating, entity: climate.bedroom}` opens a
  controller over the card — put it on the temperature label of a room photo, an icon, a zone or
  a floor plan room.
- **The controller:** current temperature and humidity, a plain status (heating at 64 % · target
  in ~30 min, holding 22 °C, paused by the central mode, off…), the target with − / +, quick
  temperatures, a ruler, and a 24 h chart. Works with any thermostat.
- **For a while (Versatile Thermostat):** keep the new temperature, or only for 2 h, until the
  evening or until the morning — run as VTherm's timed preset, which restores the previous target.
- **Settings:** `heating:` (quick temperatures, step, range, durations, per-room overrides); in the
  Studio under Card settings → Heating controller.

See docs/HEATING.md.
