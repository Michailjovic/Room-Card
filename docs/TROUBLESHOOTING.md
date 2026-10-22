# Troubleshooting

[← Back to README](../README.md) · [Getting started](GETTING_STARTED.md) · [Room Card Studio](STUDIO.md) · [Floor plan](FLOORPLAN.md) · [Reference](REFERENCE.md)

**First, the version.** Home Assistant's card editor shows the installed version next to the
card's name (`Room Overlay Card v7.0.0`). If it is not the version you installed, the browser still
runs the old file — see the first section.

---

## An update does not show

- **Hard-refresh** the browser (`Ctrl+Shift+R`, on a Mac `Cmd+Shift+R`). On a wall tablet or in
  the companion app, reload the dashboard or restart the app; a kiosk browser may need its cache
  cleared.
- **Updated in HACS right after the release appeared?** The release's files (the card, the studio
  and the floor plan renderer) are attached to the GitHub release by a workflow a minute or two
  after it is published. An update in that window can install a release without them. Wait a few
  minutes, then in HACS open the card → **⋮ → Redownload**.
- **A manual install:** all three files must be replaced together. A new card with an old studio
  file (or the other way round) can fail in odd ways.

## "Custom element doesn't exist: room-overlay-card"

The dashboard resource is missing or wrong. **Settings → Dashboards → ⋮ → Manage resources** must
list `/local/room-overlay-card.js` (manual install) or the HACS path, type **JavaScript module**.
HACS adds it by itself; after adding it by hand, hard-refresh.

## "Studio file … not found" / "Floor plan file … not found"

The studio (`room-overlay-card-studio.js`) and the floor plan renderer
(`room-overlay-card-floorplan.js`) are separate files, loaded from the same folder as
`room-overlay-card.js` the first time they are needed. HACS installs them with every release
(see [an update does not show](#an-update-does-not-show) if one is missing). A manual install
needs all three files in the same folder; only `room-overlay-card.js` needs a resource entry.

## The studio cannot save

The studio saves where it was opened from ([Saving](STUDIO.md#saving)):

- **Opened from Home Assistant's card editor:** *Apply & close* hands the config back to the
  dialog — you still press **Save** there.
- **Opened from the dashboard (✎ Studio):** it saves straight to the dashboard, unless it cannot.
  Then the primary button is **Copy YAML** and the status bar says why:
  - *not an administrator* — only administrators can change dashboards in Home Assistant;
  - a **YAML-mode** or generated dashboard — Home Assistant cannot write it; copy the YAML into
    your dashboard file;
  - the card is not part of a dashboard (a preview, another card's popup).
- **"Changed elsewhere":** the card was saved from another tab or device since you opened the
  studio. The studio refuses to overwrite it silently; overwrite on purpose, or copy the YAML and
  reopen.

## No ✎ Studio button on the dashboard

The button appears only in the dashboard's edit mode, only for administrators. In a *sections*
view Home Assistant covers each card with its own click-to-edit layer: click the card, then **Open
Studio** in its editor.

## Where is the old tabbed editor?

Since 7.0 Home Assistant's card editor shows a launcher. The tabbed editor of 6.x is behind
**Classic editor** there until 7.1, and stays as the studio's **All settings** tab. See
[STUDIO.md → The launcher](STUDIO.md#the-launcher).

## The config check reports a problem

The studio's status bar checks the config against the schema:

- **unknown key** — a typo, or a key from another card. Every valid key is in the
  [reference](REFERENCE.md).
- **expected …, got …** — a value of the wrong type or outside the allowed list.
- **v3 key — migrated on load** — an old layout key; the card converts it in memory. Open the
  editor and save to keep the converted form.
- An element **id with spaces or other characters** outside `A-Z a-z 0-9 _ -` (the browser console
  warns about it) can break selection; rename it with the **ID** field of its form.

## A phone shows the wrong layout

The card picks the **portrait** or **landscape** profile from the shape of the space it gets, not
from the device. A tall card on a wide screen is portrait. To pin a device, see `layout.orientation`
in [LAYOUT.md](../LAYOUT.md).

## Floor plan and AnyVac

- **"No AnyVac map sensor found"** — the import reads the map from
  [AnyVac](https://github.com/Michailjovic/anyvac), which publishes it as
  `sensor.<vacuum>_anyvac_map`. Install it, or draw the plan / trace a picture instead.
- **No vacuum on the plan:**
  - the `vacuum` layer is off (`layers: {vacuum: false}`);
  - `vacuums:` lists other vacuums — without the list, only the vacuums in the frame the plan was
    imported from are shown;
  - a vacuum mapped in **another home frame** must be aligned first: the studio's **Vacuums**
    panel aligns it by the rooms both maps share (same room names in the Roborock app).
- **The vacuum is mirrored or rotated against the plan** — the plan was mirrored (`mirror`) or
  turned (`rotate`) after the alignment, or the vacuum's map is mirrored against the one the plan
  came from. Re-align it in the **Vacuums** panel.
- **The position jumps every 30 seconds instead of moving smoothly** — the card follows AnyVac's
  `live` attribute (every 3 s) when the vacuum publishes it; without it, only the map refresh
  moves the robot. Check the vacuum's AnyVac sensor for a `live` attribute while it cleans.
- **The trail stays after cleaning** — by design, as in AnyVac's own card: the last run stays until
  the next one. `trail_mode: cleaning` shows it only while a vacuum is cleaning; layer `trail: false`
  hides it.

## Still stuck

Open an [issue](https://github.com/Michailjovic/Room-Card/issues/new/choose) with the version, the
card's YAML (Copy YAML in the studio) and what the browser console says.
