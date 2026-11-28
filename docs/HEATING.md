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
- **24 hours** — temperature, the target you set (dashed; VTherm's own drops to 10 °C in its safety
  mode and in a pause, the chart keeps yours), the heating power per quarter hour (bars), pauses
  (grey) and the safety mode (amber) as strips under them, the °C range on the side.
- **Turn off / on** and **Details** (Home Assistant's more-info). *(7.5.1)* For admins the second
  button is **Log & check** and opens the [administration](#administration) on the event log.

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

The same action can open the [quick mode (B)](#the-quick-mode-b) or the
[administration](#administration) — `view: simple | controller | check | log`; `heating.simple`
decides between A and B when `view` is not set.

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
  tap opens its controller (B instead of A where `heating.simple` says so).
- **Settings check · Event log** *(7.5.0, admins)* — the [administration](#administration); the
  check's button counts its warnings.

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


## The quick mode (B)

*(7.5.0)* One question per room — how warm — for phones and for everyone at home. Room tabs, the
temperature big, a sentence saying what the floor does now, and four answers worked out from the
room's usual temperature:

| Answer | Target | |
|---|---|---|
| warmer for 3 hours | usual + 1 °C | through VTherm's timed preset (then back); kept without the boost slot |
| usual | `normal` (21.5 °C) | |
| saving | usual − 1.5 °C | |
| no heating, only guarding | `guard` (16 °C) | |

The sentence: warm as it should be, heating up to …, warming up (with the time from the slope and
when it goes back), saving, no heating here, *the heating waits* (the central mode or a window
paused it), or *heating on an estimate, without measuring* when the thermometer is silent (VTherm's
safety mode, no temperature, or no value for longer than its safety delay) with when it last
reported. Under it what the loop does: open all the time, open *n* of every *cycle* minutes
(from `power_percent` and the thermostat's cycle), closed, waiting, or the safety mode.

At the bottom **We are leaving — the whole home on frost protection** puts the central mode on
*Frost protection* (a second tap within 4 s confirms); then **We are home** puts it back on
*Heat only* (or *Auto*). Hidden without a central mode that has *Frost protection*, or with
`away: false`. **More** opens the full controller (A).

When the `heating` action opens B instead of A:

```yaml
heating:
  simple: phone        # never (default) | phone (card or screen under 600 px) | always
  normal: 21.5         # the usual °C; per room in rooms[].normal
  guard: 16            # "no heating, only guarding"
  away: true           # the "We are leaving" button
  rooms:
    - climate: climate.bedroom
      normal: 21
```

On a single action `view:` wins: `view: simple` always opens B, `view: controller` always A.

## Administration

*(7.5.0)* For admins only (`hass.user.is_admin`; `heating.admin: false` hides it): the house panel
gets **Settings check** (with how many warnings) and **Event log** at the bottom; the `heating`
action opens them with `view: check` / `view: log`. A sheet over the card with both as tabs. It
only reads; nothing is changed from it.

### Settings check

What Versatile Thermostat reports about every room, in cards — regulation (auto-TPI coefficients
and cycles, or *learning since …*; the cycle), sensors (how old each room's last temperature is;
outside), safety (safety delay → power, heating failure detection, window), the house (central
mode, boiler, tariff, the cooking / overload sensors) — and the findings worked out from them,
warnings first:

- the heating failure, the safety mode running (alerts);
- a thermometer silent longer than its safety delay;
- every preset at the same temperature (the time-limited temperature runs through *boost*, the
  frost protection holds *frost*);
- auto-TPI learning standing still (`power_out_of_range`: the loop runs at full power);
- no heating failure detection, no safety mode, a room not following the central mode, an
  unavailable switch;
- what is fine (failure detection / safety mode everywhere, every room follows the central mode,
  every thermometer reports);
- notes: no slot for a time-limited temperature, no window detection, a device power that is only
  a statistic, VTherm's own messages.

### Event log

The Home Assistant logbook of the last days (one read when the tab opens, ↻ reads again) of the
central mode, the boiler, the tariff, the rooms and `log`'s entities. Every time the central mode
went to *Stopped* is one event, until it left *Stopped*:

- **what caused it** — the entity whose change started the automation that stopped it (the
  logbook's context): the tariff entity → *high tariff*, a `log.cooking` entity → *cooking*, a
  `log.overload` entity → *overload*; set by hand → *by hand*; else *other*;
- **how long**, the **reaction** (from the cause's change to *Stopped*), the steps around it (every
  logbook entry of those entities, with its entity and state);
- the message an automation wrote with `logbook.log` on the central mode is its summary; `… kW` and
  `L1 4,3 A · L2 …` in it are read out;
- the **highest current of each phase** during the pause (history of `log.phases`), with what the
  boiler would add (`log.boiler_amps`, dashed) and the main breaker (`log.breaker`).

A room's thermostat unavailable for 5 minutes or more (one event, with how long), a thermostat or
the house mode switched by hand, are events of their own; a thermostat gone for a second (a
restart, a reload of Versatile Thermostat) is not.

*(7.5.1)* **Meters** on top, live: the main supply per phase (`log.phases`) with the boiler's share
in orange, the rest in blue and the breaker (`log.breaker`) as a dashed line; beside it the heating
boiler's own meter (`log.boiler_phases`) per phase. KPIs (pauses, stopped in total, the longest) and filters by cause sit on
top; on a wide card the list and the detail side by side.

```yaml
heating:
  admin: true                         # false hides the administration
  log:
    days: 7                           # 1–30
    cooking: [binary_sensor.kitchen_cooking, sensor.oven_operation_state]
    overload: [binary_sensor.main_supply_overload]
    phases: [sensor.l1_current, sensor.l2_current, sensor.l3_current]
    boiler_phases: [sensor.boiler_l1_current, sensor.boiler_l2_current, sensor.boiler_l3_current]   # 7.5.1
    breaker: 25                       # A
    boiler_amps: 12.8                 # A per phase the boiler adds
    entities: [switch.boiler_relay]   # more entities whose changes are steps
```

An automation that drives the central mode can write the reason into the logbook — the summary of
its event:

```yaml
- action: logbook.log
  data:
    name: Heating
    entity_id: select.central_mode
    message: "cooking started → paused (cooking) · kitchen 2,4 kW · L1 3,1 A · L2 6,3 A · L3 16,8 A"
```
