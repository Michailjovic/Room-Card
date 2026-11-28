# The heating controller

*(7.2.0)* A controller for one room's thermostat, in degrees: no presets to learn. It opens over
the card from anything with a tap action — a temperature label on the room photo, an icon, a zone,
a section tile — and, since 7.3.0, from a tap on a room in the floor plan's
[heating lens](FLOORPLAN.md#lenses), beside the plan with the room outlined:

```yaml
tap_action:
  action: heating
  entity: climate.bedroom
```

It works with any `climate` entity. With [Versatile Thermostat](https://github.com/jmcollin78/versatile_thermostat)
it shows more: how hard the room heats (`power_percent`), why it is paused (its central mode, an
open window), when it reaches the target (from its temperature slope), and it can hold a
temperature for a while.

## What it shows

- **Now** — the room's temperature and humidity.
- **Status** — heating (with power and the time to the target), holding the target, not heating,
  paused (VTherm's central mode stopped it, a window is open), off, or the sensor is silent and
  VTherm runs its safety power.
- **Target** — big, with − / + by `step`, the quick temperatures, and a ruler over `range`. A run of
  taps is sent as one change, about a second after the last tap.
- **How long** *(VTherm)* — keep the new target, or only for 2 h, until the evening (`evening`,
  22:00) or until the morning (`morning`, 06:00). A time-limited target goes into the thermostat's
  boost preset and runs as VTherm's timed preset; when it ends VTherm brings back the target it
  had before. A running one shows *Temporarily until …* with *Cancel*. Shown only when the
  thermostat has a boost preset number entity.
- **24 hours** — temperature, the target (dashed) and when it heated.
- **Turn off / on** and **Details** (Home Assistant's more-info).

## Settings

```yaml
heating:
  quick: [21, 22, 22.5, 23]      # quick temperatures (°C)
  step: 0.5                      # − / + and the ruler
  range: [16, 26]                # the ruler
  durations: [always, 2h, evening, morning]
  evening: '22:00'
  morning: '06:00'
  rooms:                         # per thermostat (each key falls back to the ones above)
    - climate: climate.bedroom
      name: Ložnice
      quick: [20, 21, 21.5, 22]
```

In the Studio: Card settings → *Heating controller*.

## The house panel

*(7.3.0)* The heating lens's dock button, tapped while the lens is on (or the pause banner), opens
the house panel at the bottom:

- **House mode** — Versatile Thermostat's central mode (*Auto*, *Stopped*, *Heat only*,
  *Frost protection*; *Cool only* only when a thermostat can cool). A tap sets it. An automation
  that drives the central mode (by the tariff, say) keeps doing so — the panel shows what it set.
- **Heating boiler** (*Kotel*) — running / off, from VTherm's central boiler: what heats the floor.
- **Hot water** *(7.4.0)* — the water heater (*bojler*): its temperature and target. The only
  `water_heater` there is, or `water_heater:`.
- **Tariff** — high (VT) / low (NT), with `tariff`.
- **Main supply** — the sensors in `supply`, one row each.
- **Rooms** — every thermostat of the plan (then `heating.rooms`): now → target and its status; a
  tap opens its controller.

The central mode and the central boiler are found by themselves (VTherm's central configuration);
the Studio shows what it found. Set them to use other entities, or `false` to leave one out:

```yaml
heating:
  central_mode: select.central_mode            # found by itself; false = no house mode
  boiler: binary_sensor.central_configuration_central_boiler   # the heating boiler (VTherm's central boiler)
  water_heater: water_heater.bojler            # hot water; found when there is only one; false = none
  tariff:
    entity: switch.hdo                         # the HDO signal
    high_state: 'off'                          # its state in the high tariff (default 'on')
  supply:
    - entity: sensor.main_power
      name: Main supply
```

