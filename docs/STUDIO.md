# Room Card Studio

[← Back to README](../README.md) · [Getting started](GETTING_STARTED.md) · [Configuration](CONFIGURATION.md) · [Reference](REFERENCE.md) · [Floor plan](FLOORPLAN.md) · [Troubleshooting](TROUBLESHOOTING.md)

Room Card Studio is the card's editor (since 7.0; built from v6.41.0 on). It takes the whole
screen, above Home Assistant's own dialog, and shows the real card large on a live canvas next to
a form for whatever is selected. Everything can be built here without writing YAML: rooms from
Home Assistant's areas, elements placed and sized on the image, sections, the overview page and
floor plan pages.

---

## Opening the studio

- **From Home Assistant's card editor** (*Edit* on the card): the editor shows a short
  [launcher](#the-launcher) with **Open Studio**.
- **From the dashboard:** switch the dashboard to edit mode (the pencil) and press **✎ Studio** on
  the card. It saves straight to the dashboard — handy on a wall tablet. (In a *sections* view HA
  covers each card with its own click-to-edit layer: click the card, then **Open Studio** in the
  editor.) The button appears for administrators only.

### The launcher

Home Assistant's card editor (the dialog opened by *Edit* on the card) no longer holds the whole
editor. It shows:

- **Open Studio** — the primary button; on a card with nothing configured yet, **Start with the
  wizard** comes first instead. A one-line summary says what the card holds (rooms, the overview
  page, floor plan pages, sections).
- **Basics:** *Haptic feedback* (`haptic`), and *Edit mode (legacy)* only on a card that still has
  `test_mode: true`, so it can be switched off.
- **YAML:** Home Assistant's own *Show code editor* at the bottom of the dialog, or **YAML** in the
  studio's toolbar.
- **Classic editor** — the tabbed editor of 6.x, unchanged, for one more release. The choice is
  remembered in this browser; the banner on top of it (**Back to the Studio launcher**) switches back.
  **It is removed in 7.1**: everything it does is in the studio (its *All settings* tab hosts the
  same form today).

Nothing changes in the card's configuration — 6.x YAML is 7.0 YAML. Only where things are in the
UI moved:

| In 6.x (HA's editor) | In 7.0 |
|---|---|
| The five tabs | The studio: Properties forms per element, the card / nav / section forms; the same tabs under *All settings* |
| The **Studio** button in the header | **Open Studio** in the launcher; **✎ Studio** on the dashboard is unchanged |
| The wizard on the first screen | **Start with the wizard** (launcher), **Wizard** (studio toolbar) |
| Haptics in the header | The launcher's *Haptic feedback*; also the card form in the studio |
| Rooms & menu, + Overview | The same tab under *All settings*; rooms from HA areas with **Wizard**; **Add a floor plan page** in the studio |
| YAML of one element | Select it in the studio → *Advanced (YAML)* in its form, or *Edit as YAML* on a field |

The Classic editor and the studio's *All settings* tab are described in
[EDITOR.md](EDITOR.md).

## The wizard

The wizard (v6.46.0) builds a card from Home Assistant's areas. **Start with the wizard** in the
launcher opens it, so does opening the studio on the placeholder card the card picker adds, and
**Wizard** in the studio's toolbar works at any time. It takes five steps:

1. **Rooms:** one per Home Assistant area (by floor), with the area's name, icon, picture and
   aliases (as `area_match`). Rooms without an area can be added by name, or the card can be **one
   room** for one area.
2. **Pictures:** the area's picture is filled in; otherwise a URL (`/local/…`), an **upload**
   (stored in Home Assistant like area pictures) or a camera. A room without one shows a
   placeholder sketch until you set it.
3. **Contents:** each area's lights as light controls, optionally its devices as icons to drag
   into place, and sections from recipes (offered when Home Assistant has the devices they need).
4. **Navigation** (a new multi-room card): the room strip's style and position, an overview page
   first, a presence sensor to follow.
5. **Review:** the result as YAML.

On a new card the wizard replaces the placeholder. On an existing card it adds rooms for the
areas the card does not have yet and leaves everything else alone; a single-room card becomes
room 1 first. One Undo takes it back.

## The workspace

```
┌ toolbar: room · frame (Fit / Tablet / Tablet portrait / Phone) · Arrange / Live · Add · undo / redo · YAML · History · Save ┐
│ outline (rooms, every element, search) │ canvas — the real card, live states │ inspector: Properties | All settings (the tabbed form) │
└ status bar: config check · unsaved changes · where Save goes ┘
```

**Selecting.** Click an element on the canvas or its row in the outline (or drag it) — the
canvas, the outline and the inspector follow. On the *Properties* tab the inspector shows the
element's form; on *All settings* it opens exactly that element's panel in the [tabbed form](EDITOR.md) (a click
on a panel header there selects it too).
The canvas bar shows the selection with **Duplicate**, **Copy** and **Delete** (and **Paste**
once something is copied), so all of it works on a touch screen too. An element the room only
*inherits* from the shared defaults is opened in **Global**, where it lives.

## Properties

*Properties* (v6.44.0, sub-forms and card-level forms since v6.45.0) is the inspector's first
tab, a form for:

- the **selected element** (any type);
- with nothing selected, the **room** shown: name, id, icon, background image or camera,
  `area_match`, navigation (chips, mini preview), the overview page and the room's overview
  tile, image & weather, light controls, cards above / below, the tap on the image;
- in **Global**, or on a single-room card, the **shared defaults** every room falls back to;
- the card-level items in the outline's **Card** group:
  - **Card settings:** aspect ratio, image fit, follow mode, URL sync, zoom, parallax, haptics…;
  - **Navigation:** the nav strip;
  - each **Section**, with its tiles and the elements tagged into it. **+** adds one, blank or
    from a recipe; the header's buttons reorder or delete it.

The fields come from the card's schema, grouped into *General*, *Position & size*, *Actions*,
*Visibility* and *Advanced (YAML)*:

- **Entity:** type to search by id, name or area; the element's usual domains come first; the
  live state is shown under the field and an unknown entity is flagged.
- **Icon:** searches Home Assistant's own icon list (name and keywords), with a preview.
- **Colours** (swatch or any CSS colour), **lengths** (`10%`, `24px`), numbers, choices (a list),
  templates, image paths (with a thumbnail).
- **Actions:** pick the type (more info, toggle, navigate, URL, perform action, open section,
  switch room, groups…), then its own fields. Changing the type keeps `confirmation` / `haptic`.
- **Sub-forms and lists:**
  - an option that holds an object opens as a sub-form (a blind's cover control, an element's
    tile, the overview page…);
  - a list has one row per item with **add, move up / down, remove** (section tiles, light-control
    entities, nav chips, cover presets…);
  - **Edit as YAML** switches any of them to YAML and back.

  An on/off or entity setting that can take more options (`control: true`, `overview: true`,
  `weather_overlay: weather.home`) has **More options…**.
- **Suggestions:** *Section* and *Group* fields list the ids in the card; `area_match` lists Home
  Assistant's areas. Any other value can still be typed.
- **YAML** for conditions and embedded card configs. Invalid YAML is shown and not saved. Keys
  that take one value or a list of conditions (`color`, `icon`, `label`…) have a link to switch
  between the two.
- **Inherited settings:** a room field left empty shows the shared value from Global as its
  placeholder. Light controls set only in Global offer *Edit it in Global* or *Give this room its
  own copy*.
- **Advanced (YAML)** shows profile overrides (`portrait:` / `landscape:`) and any key the form
  does not know. They are kept exactly as they are.

A field changes only its own key when you leave it (Tab / Enter / click elsewhere). Problems the
config check finds are shown under the field they are about, as a dot in the outline and as a red
ring on the canvas; a collapsed part of the form with a problem inside gets a dot. The **ID** field
renames the element (the selection follows); renaming a section or a group also updates what
refers to it. The **↗** button in the form's header opens the same thing in *All settings*.

## Several at once

Since v6.43.0:

- **Shift / Ctrl / ⌘ click** on the canvas or in the outline adds an element to the selection,
  or takes it out; **Ctrl+A** selects every visible, unlocked element of the room. The others get
  a dashed outline; the last one clicked keeps the handles.
- Dragging any selected element moves them all.
- The selection bar then offers **align** (left / centre / right / top / middle / bottom) and,
  from three elements, **distribute** with equal gaps. Both measure what you see on the canvas
  and change `top` / `left`; positions not written in `%` are left alone (the bar says how many).
- Duplicate, copy / paste and delete apply to the whole selection.

**Layers.** Each type in the outline has an eye (hide it on the canvas) and a lock (it cannot be
selected or dragged). Handy for reaching a small icon under a large zone. This only changes the
studio's view — the card on the dashboard is not affected.

**Rooms.** The current room in the outline has **duplicate**, **copy** (paste it into this or
another card — a *Paste room* line appears) and **delete**. A copy gets a unique id and a
"(copy)" name; its `area_match` is left out so presence keeps following the original.

## Moving, resizing, adding

**Moving and resizing** (canvas in *Arrange*):

- drag to move; it snaps to a 0.5 % grid and, with a blue guide line, to the left / centre /
  right and top / centre / bottom of every other element and of the image — hold **Alt** for free
  movement;
- drag a handle to resize (zones, gauges, blinds, embedded cards, light glows); gauges and blinds
  move by dragging their body;
- an embedded card moves by the small grip above it (the card itself stays usable);
- arrow keys nudge the selection (Shift = 0.1 %); keys typed into a field never move anything.

**Adding.** **Add** lists every element type. Zones, icons, labels, gauges, light glows, blinds,
embedded cards and vacuum widgets are then placed on the image: click where it goes, or drag a
box for the sized ones. Badges, overlay images and groups are added straight to the inspector. A
new element gets the same defaults as the editor's own "+ Add" buttons and a unique id, and it
opens selected. It goes to the room shown, or to the shared defaults in **Global**. If the room so
far inherited that list, the room gets its own copy first, so nothing on screen disappears.

**Keyboard** (outside text fields): **Ctrl+A** selects all, **Del** deletes, **Ctrl+D** duplicates, **Ctrl+C / Ctrl+V**
copy and paste (also into another room or another card — the copy is kept in this browser),
**Ctrl+Z / Ctrl+Y** undo / redo, **Ctrl+S** saves, **Esc** cancels placing, then clears the
selection, then closes. In a Properties field: **Esc** closes an open list, then leaves the field;
**Ctrl+Z** is the studio's undo until you type into the field.

## Other parts of the screen

- **Inspector.** *Properties* (above) and *All settings* — the [tabbed form](EDITOR.md) of 6.x,
  every tab and field working the same. The studio remembers the tab you used last.
- **Canvas frames.**
  - *Tablet* (1280 × 800), *Tablet portrait* (800 × 1280) and *Phone* (390 × 844) are scaled to
    fit; *Fit* is the real size of the canvas.
  - The card chooses its layout profile from the frame as it would from a screen, so you can check
    the portrait layout on a PC.
- **Canvas modes.**
  - *Arrange*: select, drag, resize, add. Taps do nothing.
  - *Live*: the card exactly as on the dashboard, with real actions.
- **Outline.** The rooms (click to switch), then every element of the room by type, with a search
  box (id, entity, icon, type). A type's header opens its section in the inspector. Rooms stay in
  sync everywhere: toolbar, outline, inspector and the card's own nav strip.
- **Undo / redo.** Covers everything done in the studio; a burst of typing in one field is one
  step, and so is a quick series of changes to one Properties field.
- **Status bar.**
  - The *config check* (wrong types, values outside the allowed list, unknown keys, missing ids,
    each with its full path).
  - Whether there are unsaved changes.
  - Where *Save* goes.
- **YAML.** The whole card config, with Copy.
- **History.** The last 10 versions saved or applied from the studio in this browser. Restoring
  one is an ordinary undoable change.

## Saving

Saving depends on where you opened it:

| Opened from | Primary button | What happens |
|---|---|---|
| HA's card editor | **Apply & close** (Ctrl+S) | The config goes back into HA's editor; press **Save** there as usual. HA's editor undo can revert the whole studio session. |
| The card on the dashboard | **Save** (Ctrl+S) | Saved straight to the dashboard. The studio finds *this* card even if another one has the same `card_id`, and refuses to overwrite it if it was changed elsewhere (another tab or device) since you opened it. You can still overwrite on purpose or copy the YAML. |
| Read-only cases | **Copy YAML** | You are not an administrator, the dashboard is in YAML mode or generated, or the card is not part of a dashboard. |

**Closing.** Escape or ✕ with unsaved changes asks first: save, discard or keep editing.

**Installing.** The studio is a second file, `room-overlay-card-studio.js`. It is downloaded only
the first time you open the studio, never by a dashboard that just shows the card. HACS installs
it automatically. A manual install needs both files in the same folder; the Studio button tells
you if the second one is missing.

## Floor plan pages

Since v6.47.0, *Add a floor plan page* at the bottom of the Rooms list adds a
page that draws the home as a plan ([docs/FLOORPLAN.md](FLOORPLAN.md)). On that page the canvas
edits the plan instead of elements, with a toolbar above it:

- **Select** — click a room to select it, drag it to move it; drag a room's **label** to move
  just the label (v6.50.0, `label_at`); drag a corner; the dot in the middle
  of a wall adds a corner; click a door to select it, drag it along its wall. Corners snap to
  5 cm and to the x / y of other corners (walls line up); hold **Alt** for no snapping.
- **Rectangle** / **Polygon** — draw a room (a polygon closes on its first corner, a double-click
  or Enter; Esc cancels).
- **Door** — click a wall to place a door (0.8 m wide).
- **Turn** / **Mirror** (v6.50.0) — turn the drawing by 90° (`rotate`) and flip it (`mirror`:
  none → horizontal → vertical → both).
- **Vacuums** (v6.50.0) — which AnyVac vacuums the plan shows; a vacuum mapped in another home
  frame is aligned by the rooms both maps share (the panel says how well it fits). Since v6.51.0
  each row has two colour pickers: the vacuum's colour and its mop trail's.
- **Background** (v6.50.0) — a photo background: AnyVac snapshot (placed exactly), your edited
  copy of it, *Fit by markers*, or by hand in Properties.
- **Window** (v6.49.0) — click a wall to place a window (1 m wide). It gets the room's unused window
  sensor and blind from the Home Assistant area; check them in Properties (type, width, sensor,
  blind, blind type, invert; doors also mirror / outward).
- **Marker** (v6.48.0) — click where a marker goes, then pick its entity in Properties. Select
  a marker to drag it (snapping like corners; Alt = free); Delete removes it. Set *type* to
  `label` for a text with a live value.
- **AnyVac** — import the rooms from an AnyVac vacuum map: pick the map sensor, check which card
  room each map room is (guessed from names and areas), choose clean-up, doors and entities, see
  the result before importing. Importing again keeps each room's own settings and replaces only
  its outline. **Requires the [AnyVac](https://github.com/Michailjovic/anyvac) integration**; without it, draw or trace the plan.
- **Image** — trace over a floor plan picture (URL or upload): click two points whose distance you
  know to set its scale. The picture is shown in the studio only.
- **Doors** — propose doors where two rooms touch (where the robot crossed, if the plan came from
  AnyVac).
- **Delete** (or the Delete key) removes the selected corner, marker, door, window or room. Undo works for every
  step.

The outline lists the plan's rooms, doors and windows, and markers. Properties shows the selected room (name,
the card room it opens, floor material and colour, lights, thermostat, temperature and humidity sensors,
media players, tap / hold, the polygon as YAML), the selected door or marker, or with nothing
selected the page's settings (theme, `theme_by`, projection, rotation, mirror, quality, wall height,
overrides, the traced image, presence entities, layers). The AnyVac import also fills in each
room's media players (the ones the room already uses, else the area's).