# Heating plan — a floor heating controller inside the card

Agreed with the author on 2026-11-27. Read this before working on anything heating-related; the
decisions below are closed unless he reopens them.

## Why

His floor heating runs on Versatile Thermostat (VTherm, `over_switch` + TPI, central boiler,
central mode). Setting a temperature on his old thermostat dashboard (mushroom climate cards,
0.1 °C steps) is not friendly. The card should give a controller people enjoy, and show the
heating where it is: on the floor plan.

## Closed decisions

1. **Degrees, not presets.** The user picks °C (quick values, ± 0.5, a ruler); VTherm presets are
   at most hidden slots the card uses for a time-limited temperature.
2. **The floor plan is the heating view.** No rendered loop pictures: the card draws the loops
   (7.1.0). The cockpit render stays a photo page; heating lives on the vector plan.
3. **The manifold is optional.** Without it the plan shows loops only; with it every loop gets its
   feed, and the hall / bathroom light up when a room behind them heats.
4. **Feeds cross walls at passes the user clicks**, not at doors.
5. **No schedule** in the card (no scheduler integration needed).
6. **Everything is set up in the Studio** — a heating module: rooms ↔ thermostats, quick
   temperatures, step, ruler range, durations, the house entities, the manifold and passes.
7. **Heating panel at the bottom**, full width (like the prototype), opened from a dock button.
8. **Administration is admin-only** (`hass.user.is_admin`): settings check and the event log of
   the cooking / overload protection.
9. Do not merge the electricity-panel-card; the panel shows the main supply as simple rows.
10. **The floor plan is the hub (2026-11-27).** Everything spatial is centralised on ONE floor plan
    page with switchable **lenses**, not separate specialised pages (one geometry, edited once;
    cross-topic context stays visible). A lens is a preset over the existing `layers`: what is
    emphasised, what is dimmed, what a tap on a room does, which panel the dock opens.
    - *Overview* (default): everything subtle, tap = switch to the room (as today).
    - *Heating*: loops and feeds full, temperature / target chips, tap = room controller (A).
    - *Cleaning*: vacuums, trails, last cleaned, tap = clean this room (fix the AnyVac bug then).
    - *Lights* (7.4.0): light pools, windows and blinds; tap = the room's light controller.
    Lenses are switched from the dock (the same button opens the lens's panel); dock badges show
    events in every lens; a lens never switches by itself. Config stays small: which lenses, their
    order, the default. A page that wants one lens only (a hall tablet) is another page with a
    different default lens on the same plan — no copied geometry.

## Phases

| Version | Content | Status |
|---|---|---|
| — | **HA preparation** (not card code): logbook entries (reason, kitchen kW, phase currents) in `automation.topeni_centralni_rezim`; VTherm heating-failure detection (2–3 h); a preset slot for the time-limited temperature; the bedroom target | logbook entries done (V4, 2026-11-28); the rest is what the settings check reports |
| 7.1.0 | **Loops on the floor plan**: counter-flow loops per climate room, manifold + feeds routed through passes, states (heat by `power_percent` / idle / paused by `requested_state` / off), theme tokens `pipe.*`, Studio tools *Manifold* and *Passes* | done |
| 7.2.0 | **Room controller (A)** — the `heating` action opens it from anything with a tap action; any `climate`, VTherm extras when present: status with power / pause reason / ETA, quick °C, ± step, ruler, duration (keep / 2 h / until evening / until morning via VTherm's timed preset on the boost preset number), 24 h chart from history; settings in `heating:` (Studio: Card settings → Heating controller) | done |
| 7.3.0 | **Lenses on the plan** (decision 10) with *Overview* and *Heating*: dock buttons with ring + badge (heating count, `II` pause, `VT`, `!` sensor); the Heating lens dims other layers, shows target chips, a tap on a room opens A beside it; the pause banner; the bottom panel (C): rooms, house mode (VTherm central mode), boiler, main supply | done |
| 7.4.0 | **Lights lens** with the light controller (L), **cleaning lens** (AnyVac's shared selection, the cleaning panel), the AnyVac vacuums fitted to the plan's rooms after AnyVac's shared home frame, hot water in the house panel | done |
| 7.5.0 | **Administration + phone**: settings check from VTherm attributes, event log from the HA logbook (filters, detail), simple mode (B) for phones | done — B by `heating.simple` / `view: simple`; the administration from the house panel or `view: check / log`; the log groups each stop of the central mode into one event, its cause from the logbook's context |

Every phase ships with its GUI (the larger part of the work), demo scenario, tests, AI_SPEC,
CHANGELOG and English release notes.

## Risks to check first

- **Time-limited temperature (7.2.0):** verified on VTherm 10.6 (2026-11-28, kitchen): the °C in
  `number.<vtherm>_preset_boost_temp`, `set_timed_preset boost`; at the end VTherm restored preset
  `none` with the previous manual target. Shipped that way.
- **L-shaped rooms (7.1.0):** a loop fills the biggest rectangle; the rest of an L stays empty. A
  hand-drawn loop field in the Studio would fix it if anyone needs it.
- **The dock on the plan page (7.3.0):** done — the dock sits under the plan (the plan shrinks by
  its height) and carries lens buttons and section launchers through the card's icon pipeline,
  like the overview's dock; sections open as sheets over the plan.

## Data the card reads (VTherm 10.6, verified on the author's system)

- `power_percent` (0–100), `on_percent` (0–1), `hvac_action`.
- `requested_state.hvac_mode` vs `state`: off with a heat request = paused;
  `specific_states.hvac_off_reason` (`hvac_off_central_mode`, …) says why.
- `preset_temperatures`, `timed_preset_manager` (end time, remaining minutes),
  `safety_manager`, `auto_tpi_learning`, `is_heating_failure_detection_configured` — for the
  settings check (7.5.0).

## Prototypes

- Claude design canvas „Návrhy obrazovek“ / „Integrace do cockpitu“ (controller A, quick mode B,
  house panel C, tiles D, diagnostics E, event log G, navigation map).
- Loop prototype on the real renderer (2026-11-27), the source of the 7.1.0 geometry.
