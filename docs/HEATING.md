# The heating controller

*(7.2.0)* A controller for one room's thermostat, in degrees: no presets to learn. It opens over
the card from anything with a tap action — a temperature label on the room photo, an icon, a zone,
a room of the floor plan:

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
