# Editor guide

[← Back to README](../README.md) · See also: [Configuration reference](CONFIGURATION.md) · [Preset gallery](../PRESETS.md)

The whole card can be built without writing YAML: add it, set a background, and everything else
happens by dragging on the image and filling in tabbed panels. This page walks through the
editor as it exists today, then summarizes the UX rebuild that got it here.

---

## Getting started

1. **Add the card** to a dashboard — *Add card → Custom: Room Overlay Card*.
2. The editor opens on a single step: **set a background image** (a room photo or floor-plan,
   e.g. `/local/bedroom.webp`) or a live camera. The rest of the editor appears once one is set —
   a narrow, unambiguous first step with no premature choices.
3. Turn on **Edit mode** in the header. Now drag elements straight onto the image.
4. In the **Elements** tab, add an icon, label, zone or embedded card and drop it on the right
   spot.
5. Save. You never had to touch YAML.

---

## Header (always visible)

- **Room picker** — when the card is multi-room, switches which room the *Image* and *Elements*
  tabs edit.
- **Edit mode** — see [below](#edit-mode).
- **Haptics** — feedback on actions (companion app) and hold-gesture registration.

## The four tabs

- **Image** — the background (image or camera), image-swap conditions, weather overlay, CSS
  filters, the brightness model, filter transition and zoom. Also the **companion cards** (above
  / below the image) and **light controls**.
- **Elements** — everything you place on the image: zones, icons, labels, badges, gauges,
  blinds, embedded cards, overlays, and groups. Each type is a collapsible section with a count,
  listed alphabetically (icons next to each label make it scannable without needing to reorder
  by intent).
- **Layout** — height source, orientation, threshold, and both profile grids as Portrait /
  Landscape sub-tabs, each with a live mini grid preview. See
  [Configuration → Layout](CONFIGURATION.md#layout--two-profiles-on-a--grid) for the underlying
  YAML.
- **Rooms & menu** — four accordions: Room identity, Presence & follow, Navigation menu, and
  Deep-linking. Add / remove / reorder rooms here.

## Edit mode

`test_mode: true`, or the header toggle — same field, one name. Puts the card into a safe
editing state instead of its normal live behaviour: real tap/hold actions are suppressed, and
editing affordances appear — red outlines on zones, blue dashed outlines on embedded cards, a
live **viewport + active-profile badge**, region outlines with names, and a **profile switch
button**.

**Click an element to select it** — only the selected element shows resize handles, so the card
stays readable even with many overlapping elements. Drag to move (snaps to a 0.5 % grid,
magnetic alignment guides, hold **Alt** for free movement), drag a handle to resize, or nudge the
selection with the **arrow keys** (Shift = 0.1 %). Drag on an empty area to **draw a new zone**.

Because it's a saved config field, turning it on inside the editor also shows a **live,
draggable copy of the card right there in the header** (matching the room picked above — the
preview panel Home Assistant shows on the right is its own and follows live presence, so it
won't track the room picker), and — because it's saved — the same safe/draggable behaviour
carries over to the real card on your dashboard until you switch it off again.

The editor also has **undo/redo** (↶ ↷ or Ctrl+Z / Ctrl+Y).

---

## Editor UX rebuild (v5.9.0 – v5.10.1)

The control surface had grown a lot across v3–v4 and was getting hard to navigate, even for the
author. A full pass (analysis in `EDITOR_UX_REVALIDATION.md`, decided incrementally rather than
implemented wholesale) shipped four changes, all reflected in the walkthrough above:

- **Edit mode unified** (v5.9.0) — *Test mode* and *Drag-edit preview* used to be two separate
  controls doing overlapping things; they're now one header toggle with one meaning.
- **Layout tab got a live preview** (v5.9.11) — Portrait/Landscape used to be two stacked
  profile boxes with no visual feedback; now they're sub-tabs with an illustrative mini grid
  preview each, and edits actually reach the mounted Edit-mode preview card (previously they
  silently didn't).
- **Rooms & menu tab reorganized** (v5.9.13) — one long list split into four accordions (Room
  identity / Presence & follow / Navigation menu / Deep-linking), matching the pattern the
  Elements tab already used.
- **Dead control removed** (v5.10.1) — the blind editor's "Dock side" dropdown never affected
  anything (a docked control fills its grid region; there's no free space to align within), so
  it was removed rather than wired up to a knob that couldn't do anything.

Two proposals from the same review were **explicitly rejected** after discussion: reordering the
Elements sections by intent instead of alphabetically (the icons already make it scannable), and
a text filter/search per section (low value at typical room sizes — most rooms have a handful of
items per type).
