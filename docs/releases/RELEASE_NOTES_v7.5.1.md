# v7.5.1 — meters in the event log, the log one tap from the controller

- **Meters on top of the event log:** the main supply per phase with the boiler's share, the rest
  and the main breaker, and beside it the heating boiler's own meter — live. Set the boiler's
  phase currents in `heating.log.boiler_phases`.
- **Log & check in the controller:** for admins the controller's second button opens the event
  log and the settings check (everyone else keeps Home Assistant's details).
- **Cleaner log:** a thermostat that is gone for a second (a restart, a reload of Versatile
  Thermostat) no longer fills the log; an outage of 5 minutes and more is one event with how long
  it lasted.
- **Fixed:** while a time-limited temperature runs, *Keep* is no longer lit, and the 24 h chart
  draws the temperature it holds instead of the one it goes back to.

See docs/HEATING.md#administration.
