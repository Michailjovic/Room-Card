# Getting started

[← Back to README](../README.md) · [Room Card Studio](STUDIO.md) · [Configuration](CONFIGURATION.md) · [Reference](REFERENCE.md) · [Troubleshooting](TROUBLESHOOTING.md)

From nothing to a room that lights up with your lamps, then a whole home with an overview and a
floor plan. Every step is done in Room Card Studio; the YAML it writes is shown along the way for
reference — you never have to type it.

---

## 1. Install

Install with HACS (as a custom repository until the card is in HACS's default store) or by hand:
see [Installation](../README.md#installation). Then hard-refresh the browser.

## 2. Add the card and run the wizard

1. On a dashboard: **Edit dashboard → Add card → Custom: Room Overlay Card**.
2. Home Assistant's card editor shows the card's **launcher**. Press **Start with the wizard**.
3. **Rooms:** tick the Home Assistant areas you want, one room each (or choose *one room* for a
   single area). Each room takes its area's name, icon, picture and aliases.
4. **Pictures:** an area's picture is filled in. Otherwise give a URL (`/local/bedroom.webp`),
   **upload** a photo (Home Assistant stores it like an area picture) or pick a camera. A room
   without one shows a placeholder sketch until you set it.
5. **Contents:** the area's lights become light controls; optionally its devices become icons to
   drag into place; sections (pop-up panels of tiles) are offered from recipes when Home Assistant
   has the devices they need.
6. **Navigation:** the room strip's style and position, an overview page first, a presence sensor
   to follow.
7. **Review** the result and create it. One Undo takes the whole wizard back.

The wizard opens the studio with the new card. **Apply & close** hands it back to Home
Assistant's dialog; **Save** there.

> A good room photo is taken from a corner at eye level, in daylight, with the lights off. The
> card darkens and tints it by itself — see [the brightness model](CONFIGURATION.md#brightness-model).

## 3. Your first room

Open the card's editor again and press **Open Studio**. The card fills the screen; the toolbar's
room picker switches rooms, *Arrange* lets you select and drag, *Live* behaves like the dashboard.

**A lamp that switches on and off.** **Add → Icon**, click on the lamp in the photo, then in
*Properties* pick the entity (type to search by name or area) and an icon, and set *Tap* to
*Toggle*.

```yaml
icons:
  - id: icon_lamp
    entity: light.floor_lamp
    icon: mdi:floor-lamp
    top: "58%"
    left: "22%"
    tap_action: { action: toggle }
```

**Light that spills onto the photo.** **Add → Light glow**, drag a box around the lamp and pick the
light. The glow takes the light's colour and grows with its brightness.

**The whole wall as a button.** **Add → Zone**, drag a box over the TV and set its tap action to
*more info* of the media player. Zones are invisible on the dashboard.

**A value on the furniture.** **Add → Label** on the thermostat, entity `sensor.bedroom_temperature`.

Select several elements with **Shift-click** to align or distribute them; **Ctrl+D** duplicates,
**Ctrl+C / Ctrl+V** copies into another room. Everything has Undo (**Ctrl+Z**).

## 4. Make it react to the day

The room photo can follow the house: darker at night, warmer in the evening, a rain overlay when
it rains. In *Properties* with nothing selected (the room itself): **Image & weather** → a
`brightness_model` that blends filter stops by a sensor, or `filter_conditions` per state. The
recipes are in [PRESETS.md](../PRESETS.md#day--night-base-filters).

## 5. More rooms, one card

A card can hold every room of the home. The **Wizard** in the toolbar adds rooms for areas the
card does not have yet; the outline's room menu **duplicates** or **copies** a room. The room strip
(`nav:`) is built from the rooms automatically; `room_entity` makes the card follow you from room
to room. See [Multi-room](CONFIGURATION.md#multi-room-one-card--whole-home).

## 6. An overview page

An overview is one more room: every room as a live tile, plus a header, side cards and a dock of
sections. In the studio's *All settings* → **Rooms & menu → + Overview**, or in YAML:

```yaml
rooms:
  - id: overview
    name: Home
    icon: mdi:home
    overview: true
  - id: bedroom
    name: Bedroom
    base_image: /local/bedroom.webp
```

Guide: [OVERVIEW.md](OVERVIEW.md).

## 7. A floor plan

**Add a floor plan page** (at the bottom of the studio's room list) adds a page that draws the home
as a plan, then:

- **AnyVac** in the plan's toolbar imports the rooms from your Roborock vacuum's map — the room
  outlines, their lights, thermostats and sensors, and the doors. This needs the
  **[AnyVac](https://github.com/Michailjovic/anyvac)** integration.
- Without it, draw the rooms (**Rectangle**, **Polygon**), place **Doors** and **Windows**, or trace
  over a picture of your floor plan (**Image**).

Pick a theme, add markers for any entity, and tap a room on the plan to open it. Guide:
[FLOORPLAN.md](FLOORPLAN.md).

## 8. Where next

- [Room Card Studio](STUDIO.md) — every tool, the keyboard, saving from the dashboard.
- [Configuration](CONFIGURATION.md) — what each element can do, with examples; the
  [reference](REFERENCE.md) lists every key.
- [Presets](../PRESETS.md) — copy-paste recipes.
- [Troubleshooting](TROUBLESHOOTING.md) — when an update doesn't show or saving fails.
