# v7.5.0 — quick heating mode and the heating administration

The last part of the floor heating plan: a simple controller everyone at home understands, and
tools for whoever looks after the heating.

- **Quick mode (B):** one question per room — how warm. Four answers from the room's usual
  temperature: *warmer for 3 hours*, *usual*, *saving*, *no heating, only guarding*. A sentence
  says what the floor does right now (also when the thermometer is silent and the heating runs on
  an estimate), a line what the loop does. *We are leaving* puts the whole home on frost
  protection. Turn it on with `heating.simple: phone` (or `always`), or `view: simple` on an
  action.
- **Settings check (admins):** what Versatile Thermostat reports about each room — auto-TPI,
  sensors, safety, failure detection, windows, the house — and the findings: silent thermometers,
  presets left at one temperature, learning that stands still, detection that is off, and what is
  fine.
- **Event log (admins):** a week of the logbook, one event per heating pause with its cause (high
  tariff, cooking, overload, by hand), duration, reaction time and steps; the message your
  automation writes with `logbook.log` becomes its summary. The detail shows the highest current
  of each phase during the pause, what the boiler would add and the main breaker.

Both are opened from the heating lens's house panel or with `view: check` / `view: log`.

See docs/HEATING.md#the-quick-mode-b and docs/HEATING.md#administration.
