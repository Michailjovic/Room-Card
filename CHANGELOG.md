# Changelog

## [3.0.0] – 2026-06-20

The roadmap-completion release. Everything that used to be YAML-only in the
editor now has a proper GUI, the two image-filter systems are unified behind a
single mode switch, and the active room can be shared and bookmarked through the
URL. Fully backwards compatible with 2.x configs.

### Editor — GUI completeness
- **Navigation menu is fully editable in the GUI.** The old single `nav:` YAML
  textarea in *Rooms & menu* is replaced by structured fields: **style**,
  **position**, **height**, **item width**, **mobile height**, **auto
  breakpoint**, **wheel switch** and a **follow button** toggle. Chips and
  custom strip cards stay as YAML lists (they're arbitrary card/sensor configs),
  and invalid YAML in those two fields is now preserved instead of being wiped.
- **Dedicated per-tier inputs** for `aspect_ratio`, `border_radius` and
  `max_height` in the *Responsive* tab — one cell per tier
  (mobile / tablet / desktop / ultrawide) instead of having to drop to YAML to
  set an object. A single value still applies to all tiers; values follow the
  same nearest-lower-neighbour inheritance as before.
- **Unified image-filter section.** `filter_conditions` (discrete, first-match)
  and `brightness_model` (smooth interpolation from a sensor) used to be two
  separate sections — confusing, because at runtime `brightness_model` always
  wins. They're now one **Image filters** section with a **mode** switch:
  **Conditional** or **Smooth**. The switch is authoritative — saving keeps only
  the active mode and drops the other, so what you pick is what runs.
- **"Advanced" toggle.** Each element's raw per-item YAML textarea (the escape
  hatch for fields without a dedicated control) is now hidden behind a global
  **Advanced** checkbox in the editor header, so the common path stays clean.
- **URL-sync control.** New checkbox + optional key field in *Rooms & menu*
  (see `url_sync` below).

### New features
- **URL deep-linking — `url_sync`.** Opt-in. `url_sync: true` keeps the active
  room in the page URL as `#room=<id>` (set `url_sync: <key>` for a custom hash
  key). Rooms become **bookmarkable and shareable**: opening a URL with
  `#room=bedroom` jumps straight to that room (and holds it against presence for
  `follow_hold`). Every room switch — swipe, wheel, nav, presence — rewrites the
  hash, and the card reacts to back/forward navigation and manual hash edits.
  The room value matches a room `id`, `name` or `area_match`. Off by default; the
  editor and drag previews never touch the dashboard URL.
- **Full-room finger-drag preview.** While you drag between rooms, the incoming
  neighbour is now a **fully rendered room** — background, brightness/darkness
  filters, overlays, icons, gauges and live entity states — instead of just the
  static base image. Falls back to the base image if a preview instance can't be
  built.
- **Conditional follow button.** The nav **follow button** now appears only on
  devices that actually resolve `room_entity` to a real presence sensor via an
  explicit `by_browser` / `by_user` mapping. Devices with no usable presence
  source (e.g. a laptop not in the Bermuda browser list) no longer show a button
  that can't do anything. A plain-string `room_entity` still applies everywhere.

### Compatibility
- Backwards compatible with all 2.x configs. The unified filter editor opens
  existing cards in the correct mode based on whether they have
  `brightness_model` or `filter_conditions`. `url_sync` is opt-in, so nothing
  changes unless you enable it.

---

## [2.2.0] – 2026-06-13

### Added
- **Mouse-wheel room switching** on desktop — `nav.wheel`:
  - `horizontal` (or `true`) — switch rooms with a **horizontal** scroll wheel
    (`deltaX`); recommended, since horizontal wheel doesn't scroll the page.
  - `vertical` — use the normal vertical wheel (`deltaY`) over the card.
  - `both` — whichever axis the wheel reports.

  One notch = one room (320 ms cooldown), wraps around, and counts as a manual
  switch (so `follow_hold` applies). `Ctrl`+wheel stays reserved for `zoom`,
  and the gesture is ignored while zoomed. `preventDefault` blocks the
  browser's horizontal back/forward swipe.

```yaml
nav:
  style: thumbnails
  wheel: horizontal     # horizontal | vertical | both
```

---

## [2.1.3] – 2026-06-13

### Fixed
- **Test-mode Save was intermittent.** It only searched for the card inside the
  view matching the current URL path — but navigating or switching rooms makes
  the URL point at a different view than the one the card sits on, so the save
  failed with “card not found” seemingly at random. Save now searches the
  **entire dashboard** (every view, section and nested stack/grid) and matches
  by `cfgKey` (your `card_id`), so it no longer depends on which view the URL is
  on. Error messages are clearer (`card not found in dashboard` /
  `N matching cards — set a unique card_id`). **Tip:** keep a unique `card_id`
  set for rock-solid matching.

---

## [2.1.2] – 2026-06-13

### Fixed
- **`lock_aspect` did nothing in multi-room cards (vertical drift).** Image
  measurement only looked at the root config's `base_image`, but in multi-room
  every background lives inside `rooms[]` — so no aspect was ever detected,
  `lock_aspect` silently fell back to the default crop, and elements drifted
  vertically across tiers (covers/blinds too tall on mobile, too low on
  ultrawide). The card now measures the background (and overlay) images of
  **every room** up front, so `lock_aspect: true` locks each room to its own
  image. Single-room cards are unaffected.

---

## [2.1.1] – 2026-06-13

### Fixed
- **`lock_aspect: true` now detects each room's own image.** The natural-aspect
  auto-detection cached only a single image, so in a multi-room card where each
  room uses a different background (and the images have different resolutions),
  rooms other than the first kept drifting. The card now caches the natural
  aspect of every image separately (keyed by URL) and measures already-cached
  images synchronously, so each room locks to its own image. **For
  different-resolution images per room, use `lock_aspect: true`** (not a single
  explicit aspect, which can only match one of them).

---

## [2.1.0] – 2026-06-13

### Added
- **`lock_aspect` — keep overlays glued to the image across every tier.** With
  per-tier `aspect_ratio` the single source image is cropped differently on
  each device (`cover`), so percentage-positioned zones/icons/blinds drifted
  off their features. `lock_aspect` builds a fixed-design-aspect stage that
  *covers* the per-tier box and centers it; all elements live on that stage,
  so they stay locked to the image — per-tier `aspect_ratio` now only changes
  **how much** of the image is cropped, not **where** elements sit.
  - `lock_aspect: true` — design shape auto-detected from the base image's
    natural dimensions.
  - `lock_aspect: "1720/968"` — pin an explicit design aspect (your source
    image's real W/H), useful with `base_camera` or when you want a specific
    frame.
  - Off by default; existing cards are unchanged. New field in the editor's
    **Responsive** tab.

```yaml
breakpoints: {mobile: 600, tablet: 1281, desktop: 1925}
aspect_ratio:
  mobile: 1720/914
  tablet: 1720/807
  desktop: 1720/668
  ultrawide: 1720/670
lock_aspect: 1720/968        # ← elements now stay put across all four
```

---

## [2.0.0] – 2026-06-13

The "one card rules them all" release — responsive across phone, tablet, desktop
and ultrawide from a single card, plus a fully reorganised tabbed editor.

### Highlights (since 1.12)
- **Responsive tiers.** A four-tier system (`mobile` / `tablet` / `desktop` /
  `ultrawide`) driven by the card's own width. Per-element `tablet:` / `desktop:` /
  `ultrawide:` override blocks (joining `mobile:`), per-tier `aspect_ratio` /
  `border_radius` / `max_height`, and configurable `breakpoints`. One card adapts
  everywhere — no more maintaining a separate card per device.
- **`max_height` height cap.** Stops the image growing too tall on wide screens —
  caps the height and centres the box (letterbox), keeping element positions valid.
- **Tabbed editor.** The old wall of accordions is now four tabs — **Image**,
  **Elements**, **Responsive**, **Rooms & menu** — with a persistent header holding
  the room picker, Test mode and the Drag-edit preview. First-run onboarding guides
  you to set a background before the rest of the editor appears.
- **Drag-edit preview** follows the selected room and lets you drag/resize elements
  right in the editor.
- **Hold-gesture feedback.** Elements with a `hold_action` show a progress ring that
  fills and turns green when the hold registers.
- **GUI for more things.** Breakpoints, companion cards (`cards_above` /
  `cards_below`), and room reordering are now editable in the GUI instead of YAML.
- **Test-mode size readout.** A live width + active-tier badge to help tune
  breakpoints on each device.

### This release also adds
- **Cleaner test mode** — resize handles now appear only on the element you've
  selected (click to select), instead of on every element at once. Embedded cards,
  zones and gauges are all click-to-select; arrow keys nudge the selection.

### Compatibility
- Backwards compatible with 1.x configs: existing `mobile:` blocks and
  `mobile_breakpoint` keep working.

---

## [1.15.2] – 2026-06-13

### Added
- **Companion cards in the GUI** — the Image tab now has *Cards above image* and
  *Cards below image* YAML fields. Paste a card config you built elsewhere to stack
  full Home Assistant cards above/below the room image (handy on mobile). Per room;
  each list item is a card config, or `{card, height, media}`
  (`media: all|mobile|tablet|desktop|ultrawide`). Previously `cards_above` /
  `cards_below` were YAML-only with no editor field.

### Changed
- **Clearer room-icon label** — the per-room *Room icon* field now states it's
  only shown when the nav style is `tabs` (it doesn't appear with the default
  `thumbnails` navigation, which uses the room image instead).

### Fixed
- **Drag-edit preview now follows the selected room** — the in-editor preview used
  to always show the default/last room (e.g. living room) regardless of which room
  you were editing. It now renders the room picked in the header and stays on it
  (presence-following is disabled inside the preview). Renamed "Interactive
  preview" → "Drag-edit preview" with a tooltip explaining it's a live, draggable
  copy (and that the panel on the right is Home Assistant's own preview, which
  follows live presence and won't track the room selector).

### Added
- **Reorder rooms from the GUI** — move-up / move-down arrows next to + Room /
  Remove in the Rooms &amp; menu tab let you change room order (which is also the
  order of the thumbnail navigation) without editing YAML.

### Changed
- **Room picker, Test mode &amp; Interactive preview moved to a persistent header**
  — the active-room dropdown now lives at the top of the editor (visible on every
  tab), so you can switch which room you're editing without leaving the Image or
  Elements tab. Test mode and Interactive preview sit next to it.
- **Responsive tab now owns the image shape** — `aspect_ratio`, `border_radius`,
  `max_height` and the breakpoint thresholds (incl. legacy `mobile_breakpoint`)
  all live together in the Responsive tab. The Image tab keeps just the
  background, filters, weather, filter-transition and zoom.
- **Removed the Code tab** — it duplicated Home Assistant's built-in "Show code
  editor". Editor is now four tabs: Image / Elements / Responsive / Rooms &amp; menu.

### Notes
- Remaining v1.15.x editor work: a proper GUI block for the menu/nav strip
  (currently still YAML), plus optional per-tier inputs for aspect ratio.

### Changed
- **Editor is now tab-based** — the grouped sections moved into five top tabs:
  **Image** (background, filters, brightness), **Elements** (zones, icons, labels,
  badges, gauges, blinds, embedded cards, overlays, groups), **Responsive**,
  **Rooms &amp; menu** (room list, presence, nav strip), and **Code**. Switching
  tabs no longer scrolls a long wall of accordions, and your active tab is kept
  while you work. The first-run onboarding (set a background first) is unchanged.

### Added
- **Responsive tab** — set the tier breakpoints (mobile / tablet / desktop upper
  bounds in px) directly in the GUI instead of YAML, with a reminder that tiers
  follow the card's own width and that Test mode shows a live width + tier badge.
- **Code tab** — a read-only preview of the full card config as YAML.

### Notes
- This supersedes the 1.14.0 accordion grouping with the tabbed layout agreed for
  the v1.14 editor pass. Per-tier `aspect_ratio` / `max_height` GUI fields and a
  dedicated menu/nav editor are coming in the next iterations.

### Changed
- **Editor restructured into four groups** — the flat wall of ~14 accordions is
  now organized under labelled headings: **Start here** (Background &amp; basics),
  **Lighting &amp; atmosphere** (filters, brightness model), **Elements** (zones,
  icons, labels, badges, gauges, blinds, embedded cards, overlays) and
  **Advanced** (element groups, multi-room). Background is first and open by
  default; multi-room and groups moved to Advanced.
- **Clearer section names** — each element section now says what it is at a
  glance ("Zones — invisible tap areas", "Icons — state-aware mdi icons",
  "Labels — entity values as text", …) instead of bare jargon.

### Added
- **First-run onboarding** — a brand-new card (no background, no elements) now
  opens to a single focused step: set a background image (or camera), with a
  short hint to enable Interactive preview and drag elements on. The full grouped
  editor appears automatically once a background is set.

---

## [1.13.5] – 2026-06-13

### Fixed
- **Per-tier values now apply in test mode** — `test_mode` disables per-element
  tier overrides (so dragging always edits the base), but it was also forcing
  per-tier *scalars* (`aspect_ratio`, `border_radius`, `max_height`) to the
  desktop value. So on an ultrawide screen the test-mode readout correctly said
  `ultrawide` while the card still rendered the desktop aspect ratio. These
  scalars now follow the actual detected tier even in test mode, and crossing a
  tier boundary while resizing in test mode re-renders to pick up the new value.
  Live (non-test) rendering was already correct.

---

## [1.13.4] – 2026-06-13

### Added
- **Test-mode size readout** — enabling `test_mode` now shows a small badge in
  the top-left corner with the card's current width in pixels and, below it, the
  responsive tier that width maps to (mobile/tablet/desktop/ultrawide). It
  updates live as the card resizes, so you can read the exact width on each
  device and set `breakpoints:` to match. Note the tier is detected from the
  card's own width (its dashboard column), not the device screen resolution.

### Docs
- Tier thresholds are configurable via a top-level `breakpoints:` map, e.g.
  `breakpoints: { mobile: 600, tablet: 1024, desktop: 1600 }` (each value is the
  exclusive upper bound; `ultrawide` is the rest). Legacy `mobile_breakpoint`
  still overrides the mobile bound.

---

## [1.13.2] – 2026-06-13

### Added
- **Hold gesture feedback** — elements with a `hold_action` now show a circular
  progress ring while you press. It fills over the hold delay and turns green
  the moment the hold registers, so you know you've held long enough (no more
  guessing). A short grace period keeps quick taps from flashing the ring.
  Opt out globally with `hold_feedback: false`; customize via `hold_color`
  (in-progress ring) — the "registered" colour is green by default.

---

## [1.13.1] – 2026-06-13

### Added
- **Responsive tiers** — the single binary mobile/desktop profile is now a
  four-tier system driven by the card's own width (container width, not the
  viewport — correct for HA dashboard columns): `mobile` (`< 600px`),
  `tablet` (`600–1024px`), `desktop` (`1024–1600px`) and `ultrawide`
  (`≥ 1600px`). One card now adapts to phone, tablet, PC and ultrawide
  without maintaining separate cards.
- **Per-element tier overrides** — every element (zones, badges, icons,
  labels, gauges, blinds, embedded cards) accepts `tablet:`, `desktop:` and
  `ultrawide:` override blocks in addition to the existing `mobile:`. Each
  block merges over the base element, so you only specify the deltas that
  differ on that tier:
  ```yaml
  - id: temp
    top: 10%
    left: 80%
    font_size: 2%
    mobile:    { top: 6%,  left: 70%, font_size: 4% }
    ultrawide: { top: 12%, left: 85%, font_size: 1.5% }
  ```
- **Per-tier `aspect_ratio` and `border_radius`** — these accept either a
  single value (as before) or a per-tier object. A missing tier falls back to
  the nearest defined tier (smaller first, then larger):
  ```yaml
  aspect_ratio: { mobile: 4/3, tablet: 16/10, desktop: 16/9, ultrawide: 21/9 }
  ```
- **Custom breakpoints** — override the tier thresholds with a top-level
  `breakpoints: { mobile, tablet, desktop }` (each value is the exclusive
  upper bound; `ultrawide` is the rest).
- **Strip media tiers** — `cards_above`/`cards_below` `media:` now also accepts
  individual tier names and comma lists (e.g. `media: tablet,ultrawide`)
  alongside the legacy `all` / `mobile` / `desktop` (`desktop` = any non-mobile).
- **`max_height` height cap** — optional per-tier ceiling for the image box. On
  wide screens (FHD/2K) a fixed aspect ratio makes the image grow tall with the
  card width; `max_height` caps the height and centers the box, letterboxing the
  sides instead. Accepts a single value or a per-tier object, e.g.
  `max_height: { desktop: 70vh, ultrawide: 80vh }`. The box keeps its aspect
  ratio, so all `%` element positions stay valid.

### Changed
- Tier changes (resize, rotation, moving the card to a different dashboard
  column) re-render the card automatically, just like the old mobile flip.

### Compatibility
- Fully backward compatible: existing `mobile:` blocks and `mobile_breakpoint`
  keep working unchanged (`mobile_breakpoint` overrides the mobile threshold).
- The GUI editor exposes per-tier `aspect_ratio`/`border_radius` and per-element
  tier blocks via YAML for now; a dedicated centralized "Responsive" panel with
  a tier switcher is planned for the next release.

---

## [1.12.2] – 2026-06-12

### Fixed
- **Mobile nav polish** — thumbnails on the wrapped mobile strip now use a
  fixed height (`nav.mobile_height`, default `48px`) instead of preserving
  the aspect ratio, so both sensor chips fit again (the image crops to cover).
  Embedded nav cards get `flex-basis: 0` on mobile, so the ticker always
  shares its row with the follow button and takes exactly the remaining
  space — no more orphaned third row.

---

## [1.12.1] – 2026-06-12

### Fixed
- **Mobile navigation strip** — on narrow cards the horizontal strip used to
  overflow (only ~3 room thumbnails visible, rest behind a scroll). Below
  `mobile_breakpoint` the strip now wraps: all room thumbnails shrink to fit
  on the first row (aspect ratio preserved via CSS `aspect-ratio`), embedded
  nav cards (e.g. an alert ticker) move to the second row and stretch, and
  the follow button sits at the very end. Desktop keeps the single row.

### Changed
- The follow button now renders after `nav.cards` (far end of the strip) on
  all screen sizes, for consistent ordering.

---

## [1.12.0] – 2026-06-12

### Added
- **Per-room companion strips** — new room keys `cards_above:` and
  `cards_below:` render full-width HA cards in normal document flow above and
  below the room image (inside the card, switching together with the room).
  Built for mobile, where positioned overlays get cramped. Entries are plain
  card configs or `{card, height, media}`; `media: all|mobile|desktop`
  (default `all`) shows an entry only below/above `mobile_breakpoint` — so
  you can keep elegant overlay panels on desktop and get stacked control
  strips on the phone, from one config.

  ```yaml
  rooms:
    - id: bedroom
      cards_above:
        - media: mobile
          card: {type: grid, columns: 3, cards: [...]}   # lights
      cards_below:
        - media: mobile
          card: {type: custom:bubble-card, ...}          # blinds
  ```

---

## [1.11.1] – 2026-06-12

### Fixed
- **Room swipe no longer hijacks gestures inside embedded HA cards** —
  horizontal drags starting on an `elements[]` card (bubble-card sliders,
  cover controls, maps…) are now left to the embedded card, same as slider
  zones. Swiping between rooms still works everywhere else on the image.

---

## [1.11.0] – 2026-06-12

Presence-follow polish: follow modes, a follow button, active-room state
mirroring, an in-editor device mapper, and a swipe-vs-tap fix.
Verified against Home Assistant 2026.6.

### Added
- **`follow_mode`** — `always` (default, continuous follow), `initial` (jump
  to the presence room only once when the card loads — then navigation is
  fully manual) or `manual` (presence never moves the card by itself; only
  the follow button / `follow-room` action do).
- **Follow button** — a crosshair button at the end of the nav strip jumps to
  the presence room and clears the manual-navigation hold. It lights up in
  the accent colour whenever you're viewing a different room than the one
  presence reports. Hide with `nav.follow_button: false`. Also available as
  an action: `{action: follow-room}` on any zone/icon/badge.
- **`room_state_entity`** — the card mirrors the active room into a writable
  helper (`input_text` or `input_select`), so automations and other cards can
  react to where you're looking. Accepts the same per-device mapping object
  as `room_entity` (each device mirrors into its own helper).
- **Editor: "Map this device"** — the Rooms section now shows the
  browser_mod ID of the device the editor is open on, with an entity picker
  and a one-click button that writes `room_entity.by_browser` for you. Open
  the editor on each device, pick its presence sensor, click — done. Plus
  GUI fields for `follow_mode` and `room_state_entity`.
- **`nav.cards` placement** — `placement: start` puts a custom card before
  the room thumbnails (default `end`).

### Fixed
- **Swiping that started on a clickable zone no longer triggers the zone's
  action** — zones fire on `touchend`, which the previous click-only
  suppressor couldn't catch; actions are now suppressed during a room drag
  and for 400 ms after it.

---

## [1.10.1] – 2026-06-12

### Fixed
- **Side-rail nav collapsed to a thin strip with `nav.width: auto`** — a
  vertical rail has no intrinsic width to stretch into, so `width: 100%`
  items made the whole rail collapse. With `position: left/right/auto`,
  `width: auto` now falls back to the aspect-derived thumbnail width
  (explicit CSS widths keep working). Horizontal strips are unaffected.

---

## [1.10.0] – 2026-06-12

Per-device presence follow and nav chip styling.
Verified against Home Assistant 2026.6.

### Added
- **Per-device / per-user `room_entity` mapping** — `room_entity` now also
  accepts an object, so every device follows *its own* Bermuda sensor:

  ```yaml
  room_entity:
    default: sensor.phone_alice_area
    by_user:                      # matched against the logged-in HA user
      Alice: sensor.phone_alice_area
      Bob: sensor.phone_bob_area
    by_browser:                   # matched against browser_mod browser ID
      wall_tablet_living: sensor.phone_alice_area
  ```

  Resolution order: `by_browser` (exact browser_mod ID) → `by_user`
  (case-insensitive HA user name) → `default`. All mapped entities are part
  of change detection; manual-switch write-back targets the resolved entity.
  The editor field shows a hint and defers to YAML when a mapping is active.
- **Nav chip styling** — chips accept optional `background`,
  `border_radius`, `padding`, `border` and `font_size`, e.g. pill style:

  ```yaml
  nav:
    chips:
      - entity: sensor.{room}_temperature
        decimals: 1
        suffix: "°"
        background: "rgba(0,0,0,0.55)"
        border_radius: 8px
        padding: 1px 6px
        color_gradient: [...]
  ```

---

## [1.9.0] – 2026-06-10

Multi-room navigation strip customization. Verified against Home Assistant 2026.6.

### Added
- **`nav.width`** — item width in the navigation strip: any CSS size
  (e.g. `120px`), or **`auto`** to stretch room thumbnails/tabs evenly across
  the full available width. Default stays height × aspect ratio. In a side
  rail, `auto` makes items fill the rail width.
- **`nav.cards`** — embed arbitrary HA cards directly in the navigation strip
  (alert tiles, markdown, mushroom chips…). Entries are either a plain card
  config or `{width: 320px, card: {...}}`; without `width` the card flexes to
  fill the remaining strip space. Cards receive live `hass` updates and work
  in top/bottom strips as well as side rails.

```yaml
nav:
  style: thumbnails
  height: 64px
  width: auto                  # stretch thumbs across the strip
  cards:
    - width: 40%
      card:
        type: markdown
        content: >-
          💧 Zvýšená vlhkost v obýváku — {{ states('sensor.livingroom_humidity') }} %
```

---

## [1.8.0] – 2026-06-10

Final roadmap items: interactive preview inside the GUI editor, 3D parallax
tilt, a copy-paste preset gallery and HACS validation in CI.
Verified against Home Assistant 2026.6.

### Added
- **Interactive editor preview** — a checkbox at the top of the GUI editor
  mounts a live card instance with test mode forced on, directly inside the
  editor dialog: drag, resize, draw-to-create zones and keyboard-nudge there,
  with every change synced back to the form and the dashboard preview —
  **without ever enabling `test_mode` on the saved card**. The preview hides
  the Save button (the editor owns saving) and strips its forced flags from
  outgoing config updates.
- **3D parallax tilt** — `parallax: true` (or
  `{strength: 6, scale: 1.04, source: pointer|orientation|auto}`) tilts the
  scene toward the mouse on desktop and with device orientation where the
  platform allows it without a permission prompt. Pauses automatically during
  room drags; mutually exclusive with `zoom:`.
- **Preset gallery** — new `PRESETS.md` with copy-paste recipes: day/night
  filters, lux-driven dusk, weather moods, gauge palettes, dimmer zones, door
  portals, RGB glow via `color_from`, last-motion labels, Bermuda multiroom.
- **CI: HACS validation** — `hacs/action` job runs next to the smoke tests on
  every push/PR (groundwork for HACS default-repository submission).

---

## [1.7.0] – 2026-06-10

Multi-room phase 2 (adaptive navigation + finger-attached room drag) and a
complete snow rework. Verified against Home Assistant 2026.6.

### Added
- **Adaptive navigation position** — `nav.position` now accepts `left`,
  `right` and `auto` in addition to `top`/`bottom`. With `auto` the strip
  renders as a **vertical side rail** when the card is wider than
  `nav.auto_breakpoint` (default 1100 px) — on ultrawide screens the 16/9
  image doesn't fill the height, so the rail uses that dead space instead of
  eating vertical room; on narrow widths it falls back to the top strip.
  Flips live on resize/rotation.
- **Finger-attached room drag** — swiping between rooms is now a real
  filmstrip gesture: the room follows your finger, the neighbour's image is
  revealed alongside, release past 25 % of the width (or a quick fling)
  commits the switch, otherwise the room snaps back. Direction can be
  reversed mid-drag. Vertical page scrolling stays untouched
  (`touch-action: pan-y`), slider zones and zoomed state still own their
  gestures.

### Changed
- **Snow effect rebuilt** — the old snow was nearly invisible. Now three
  parallax layers of larger, soft-edged flakes (bright core + glow falloff)
  with opposing horizontal drift, seamless loops, and a denser/faster heavy
  tier for `hail`. Default opacity is now per-effect: snow 0.7, heavy snow
  0.8, rain 0.45, heavy rain 0.55, fog 0.5, lightning 0.6 (explicit
  `opacity:` still overrides).

---

## [1.6.0] – 2026-06-10

**Multi-room.** One card, your whole home: per-room configs, an auto-generated
thumbnail navigation strip with live filters and sensor chips, swipe and
door-zone navigation, and presence-driven room switching (Bermuda/BLE ready).
Fully backward compatible — without `rooms:` nothing changes.
Verified against Home Assistant 2026.6.

### Added
- **`rooms:` array** — each entry is a complete room config (`base_image`,
  `overlays`, `zones`, `gauges`, …) plus `id`, `name`, `icon`, `area_match`,
  `chips`. Top-level room-scoped keys act as shared defaults inherited by
  every room; card-level keys (`aspect_ratio`, `border_radius`, `zoom`,
  `mobile_breakpoint`, `haptic`) stay shared.
- **Auto-generated navigation** — `nav.style: thumbnails` (default) renders a
  strip of live room miniatures: each thumb shows the room's base image with
  its *active filter conditions applied* (night dim follows automatically)
  plus up to 3 sensor chips. `nav.chips` defines chips once for all rooms with
  a `{room}` placeholder (e.g. `sensor.{room}_temperature`), per-room `chips:`
  overrides. Styles: `thumbnails | tabs | dots | none`; `position: top|bottom`;
  `height`. Active room is highlighted; thumbnails are keyboard-accessible.
- **Room switching, four ways** — tap a nav thumbnail; **swipe** horizontally
  on the image (intent-detected, ignores slider zones, inactive while zoomed);
  **`switch-room` / `next-room` / `prev-room` actions** on anything clickable
  (doors on the floorplan become portals between rooms); or…
- **`room_entity:` presence follow** — point it at any entity whose state
  names a room (Bermuda trilateration area sensor, `input_select`, template
  sensor). The card follows it automatically; `area_match:` per room maps
  arbitrary state values (e.g. Bermuda area names) to rooms. Manual navigation
  takes priority for `follow_hold:` seconds (default 60). Writable entities
  (`input_select`/`select`) are synced back on manual switches — replaces
  browser_mod dashboard-switching scripts.
- **Animated transitions** — directional slide between adjacent rooms,
  crossfade for jumps; updates, template subscriptions, camera and tickers
  always run only for the active room.
- **`card_id:`** — explicit pairing key for editor/save/highlight matching;
  also lifts the old "two cards with the same base_image" limitation.
- **Editor: Rooms section** — room selector (all sections below edit the
  chosen room), add/remove room, id/name/icon/area_match/chips fields,
  room_entity + follow_hold + card_id + nav YAML, and a one-click
  **Convert to multi-room** migration for existing configs. Test-mode
  drag/resize/draw and Save write into the active room.

### Changed
- Smoke-test suite extended to 54 assertions (room merge, room matching,
  pairing keys, shared defaults).

---

## [1.5.0] – 2026-06-10

Layout & interaction release — the complete v1.5 roadmap: responsive mobile
position profiles, light-colour overlay tinting, draw-to-create zones,
pan & pinch-zoom floorplan mode, per-element fade/slide animations and
actions on gauges & labels. Verified against Home Assistant 2026.6.

### Added
- **Responsive mobile profiles** — every positioned element (zones, icons,
  labels, gauges, blinds, embedded cards, custom-positioned badges) accepts a
  `mobile:` block overriding `top`/`left`/`width`/`height`/`size`/`font_size`
  when the card is narrower than `mobile_breakpoint` (default 600 px). The
  card re-renders automatically when the profile flips on resize/rotation.
  Disabled in test mode, where dragging edits the desktop profile.
- **Light colour visualization** — `color_from: light.x` on an overlay tints
  the overlay image toward the light's current `rgb_color` (or
  `color_temp_kelvin`, converted via a Tanner-Helland approximation) using a
  computed sepia/hue-rotate filter chain. No more one PNG per colour.
- **Draw-to-create zones** — in test mode, click-drag on an empty area of the
  card sketches a rubber-band rectangle and creates a new zone with a unique
  id at that exact position, synced straight into the GUI editor.
- **Pan & pinch-zoom floorplan mode** — `zoom: true` enables two-finger
  pinch (1–4×), one-finger panning while zoomed, double-tap reset and
  Ctrl+wheel zoom on desktop. Taps and sliders keep working while zoomed.
- **Entrance/exit animations** — `fade: true` (or seconds) animates
  visibility changes of zones, icons, badges, labels, gauges and embedded
  cards; `slide: up|down|left|right` adds a 10 px directional slide.
  Works with `visible`, `visible_conditions` and `visible_template`.
- **Actions on gauges and labels** — `tap_action`, `hold_action` and
  `double_tap_action` are now supported on gauges (incl. radial) and labels;
  elements with actions become focusable buttons (Enter/Space work).
- **Editor** — new Basic settings fields for mobile breakpoint and
  pan & zoom; element/gauge/label YAML hints updated; `fade`/`slide`/`mobile`
  keys round-trip safely through the GUI editor.

### Changed
- Group fade now cooperates with per-element fade state (an element hidden by
  its own condition stays hidden when its group reappears).
- Smoke-test suite extended to 41 assertions (mobile merge, Kelvin→RGB,
  tint filter).

---

## [1.4.0] – 2026-06-10

Feature release delivering the complete v1.4 roadmap: templates on every
element type, relative-time labels, weather effects v2, snap-to-grid editing
with alignment guides, editor undo/redo, live icon previews and a CI test
suite. Verified against Home Assistant 2026.6.

### Added
- **`visible_template` on every element type** — zones, icons, badges,
  overlays, embedded cards, gauges and blinds can now be shown/hidden by any
  Jinja2 template, rendered live over the `render_template` WebSocket
  subscription. Takes precedence over `visible` / `visible_conditions` when
  both are set. Truthiness follows HA conventions (`false`, `off`, `no`, `0`,
  empty, `unknown` and `unavailable` hide the element).
- **`label_template` on badges** — badge chip text driven by a Jinja2
  template, same live mechanism as label templates.
- **Relative-time labels** — `format: relative` renders timestamps as
  localized relative time ("5 minutes ago" / "před 5 minutami") using
  `Intl.RelativeTimeFormat` in the dashboard language, refreshed every 30 s
  (paused while the card is off-screen). Works with `prefix`/`suffix`.
- **Weather effects v2** — new effects `fog` (drifting banks) and `lightning`
  (screen flash); `pouring` now renders denser, faster rain and `hail` dense
  snow via a new heavy tier; `lightning-rainy` combines rain + flashes. New
  `angle:` option tilts the rain direction (e.g. `angle: 115deg` for wind).
  Manual `effect:` accepts `rain`, `rain-heavy`, `snow`, `snow-heavy`, `fog`,
  `lightning`.
- **Snap-to-grid + alignment guides** — test-mode dragging snaps to a 0.5 %
  grid and magnetically aligns to the top/left edges of other elements, with
  live guide lines; hold **Alt** for free movement. Resize handles snap to the
  same 0.5 % grid.
- **Editor undo/redo** — 50-step history of every config change with ↶ / ↷
  header buttons and Ctrl+Z / Ctrl+Y (Cmd on macOS) shortcuts. Native
  text-field undo inside inputs is left untouched.
- **Live icon previews** — icon and badge `mdi:` inputs in the editor render
  the actual icon next to the field as you type.
- **CI test suite** — `tests/smoke.test.js` (34 assertions over the pure
  helpers: conditions, gradients, YAML parser round-trip, filters, template
  truthiness, relative time) + a GitHub Actions workflow running syntax check
  and tests on every push/PR. `npm test` runs them locally.

### Fixed
- Weather CSS could not previously express a flash overlay (`content` quoting
  in the embedded stylesheet) — caught by the new verification flow before
  release.

### Changed
- Editor weather effect selector offers the full v2 effect list.
- Embedded-card YAML textarea now round-trips `visible_template` correctly.

---

## [1.3.1] – 2026-06-10

### Fixed
- **Card no longer renders at the wrong height in sections view** — the
  `getGridOptions()` introduced in 1.3.0 declared a fixed `rows` count
  computed from an assumed card width. On wider dashboards the real card
  (whose height is driven by `aspect_ratio`) overflowed its grid cell, so
  following cards were laid out on top of it instead of flowing below.
  `rows` is now intentionally omitted, which per the HA docs makes the grid
  ignore row sizing and the card keep its natural aspect-ratio height
  (the pre-1.3.0 behaviour), while keeping the column defaults.

---

## [1.3.0] – 2026-06-10

Major release: bug-fix sweep from a full code audit, performance pass, editor
overhaul, and six new features. Verified against Home Assistant 2026.6.

### Added
- **Jinja templates on labels** — new `template:` option renders any Jinja2
  template live via the `render_template` WebSocket subscription. Replaces the
  entity value entirely; works with `color_gradient` (numeric results).
- **Slider zones** — new `slider:` option on zones: drag vertically or
  horizontally across a zone to set light brightness, cover position, fan
  speed, media volume, climate temperature or number value. Keys: `entity`,
  `direction`, `min`, `max`, `live`, `invert`, `color`. Shows a translucent
  fill while dragging; tap actions still work (drags are suppressed).
- **Radial gauges** — `orientation: radial` renders a circular SVG arc gauge
  with `arc` (degrees, default 270), `thickness`, optional `target` marker and
  full `color_gradient` support.
- **Camera background** — new `base_camera:` option uses a camera entity
  snapshot as the base layer, refreshed every `camera_refresh:` seconds
  (default 10, paused when the card is off-screen). `base_image` is now
  optional when `base_camera` is set.
- **Weather effects** — new `weather_overlay:` option renders an animated CSS
  rain/snow layer, driven automatically by a `weather.*` entity state or
  forced with `effect: rain|snow`. Configurable `opacity` and `z_index`.
- **Full action support** — actions now accept `target:` and `data:` for
  `call-service`, the HA 2024+ `perform-action` / `perform_action` aliases,
  `url` actions, `confirmation:` dialogs, and emit haptic feedback on the
  companion app (disable with `haptic: false` at card level).
- **Groups on overlays and zones** — `group:` is now supported on every
  element type, and group show/hide animates with a 0.25 s fade instead of an
  instant toggle.
- **Auto units on labels** — `suffix: auto` appends the entity's
  `unit_of_measurement` automatically.
- **`getGridOptions()`** — proper default sizing in sections-view dashboards,
  derived from the configured aspect ratio.
- **Card picker suggestion (HA 2026.6)** — the card suggests itself with a
  `base_camera` preset when a camera entity is selected in the card picker.
- **Editor: reorder buttons** (▲▼) on overlays, zones, badges, elements,
  icons, labels, gauges and blinds — overlay stacking order is finally
  editable without YAML.
- **Editor: live highlight** — opening an item panel in the editor flashes the
  corresponding element in the card preview.
- **Editor: version header** — the GUI editor now shows the installed card
  version; a version banner is also printed to the browser console.
- **Editor: new fields** — base camera + refresh, weather overlay,
  zone slider, zone group, overlay group, label Jinja template.

### Fixed
- **Group re-show left elements hidden** — badges, labels, gauges, blinds and
  embedded cards inside a group stayed invisible after the group was hidden
  and shown again unless they had their own `visible` condition.
- **`double_tap_action` without `tap_action` never fired** — the double-tap
  detector required a pending single-tap timer that only existed when a tap
  action was configured.
- **Dragging in test mode could be reverted by the next editor change** — the
  editor now re-renders its inputs after a position update from the card, so
  stale top/left values no longer overwrite the dragged position.
- **Attribute-based conditions didn't trigger updates** — conditions using
  `attribute:` anywhere (filters, overlays, visibility, badge labels/colors)
  are now part of change detection; previously only a state-string change
  re-rendered the card.
- **Embedded cards could render blank or freeze** — elements are now created
  through HA's official card helpers (`loadCardHelpers`), which resolves
  lazy-loaded `hui-*` cards and shows a proper error card on bad config; and
  `hass` is forwarded to embedded cards on every update so cards listing
  entities as plain strings (e.g. entities card) stay live.
- **Editor silently deleted config on invalid YAML** — YAML fields now keep
  the previous value and turn red when input can't be parsed. The editor also
  ships a built-in YAML parser/serializer, so YAML works even though HA
  provides no global YAML library (previously only JSON was accepted in
  practice).
- **Editor round-trip data loss** — unknown filter functions (`grayscale`,
  `invert`, `drop-shadow`, …) survive slider edits; keys removed from item
  YAML textareas are now actually removed from the config; clearing an
  overlay's conditions removes them; `rgba()` colors are no longer collapsed
  to opaque hex by the color pickers.
- **Cross-talk between two cards in test mode** — position updates and saves
  are matched to the editor by base image/camera; Save aborts with a clear
  message when two identical cards exist in the same view instead of
  overwriting the wrong one.
- **`%`-based label `font_size` now responds to card resizes** and no longer
  freezes at the initial render width.
- **Tapping a badge without `tap_action` no longer triggers the card-level
  `tap_action`.**
- **Stray tap after touch-dragging an element in test mode** is no longer
  swallowed permanently.
- Config values (ids, image URLs, icons) are HTML-escaped in the card markup.

### Changed / Performance
- Skip full re-render when `setConfig` receives an identical configuration
  (stops flicker while typing in the editor).
- Gradient stops are sorted once per render instead of on every state update;
  badge containers are cached; repeated style writes are guarded.
- Slider/gradient/color inputs in the editor are debounced (150 ms), so the
  preview no longer re-collects the whole form on every pixel of movement.
- Zones and icons with actions are keyboard-accessible (`Tab` + `Enter`/`Space`,
  `role="button"`, `aria-label`).
- Label/icon default colors are themeable via `--roc-label-color` /
  `--roc-icon-color` CSS variables.
- Editor inputs share a stylesheet class instead of repeating inline styles.

### Removed
- Stale `src/` TypeScript sources (frozen at ~v0.3), prehistoric `dist/`
  bundle (v0.2.0), `node_modules/`, `tsconfig.json` and `rollup.config.mjs`.
  The single source of truth is `room-overlay-card.js`; the dangerous
  `npm run build` scripts that would have overwritten it are gone.

---

## [1.2.9] – 2026-06-04

### Fix: Save now finds card in sections-layout views (HA 2024+)

HA 2024+ introduced a new `sections` view type (the default for new dashboards).
Unlike the classic `masonry` layout where cards live in `view.cards[]`, the
sections layout stores cards in `view.sections[].cards[]`.

The card search now walks both structures:
- `view.cards[]` — classic masonry/panel layout
- `view.sections[].cards[]` — sections layout (HA 2024 and newer)

This fixes the `card_not_found_in_view` error reported on dashboards using
the sections view type.

## [1.2.8] – 2026-06-04

### Improved: Save button diagnostics + hass.callWS fallback

- Uses `hass.callWS` (standard HA frontend method) with automatic fallback
  to `conn.sendMessagePromise` for compatibility.
- When auto-save fails, the overlay now shows the **exact error** in red below
  the header (e.g. `config_not_supported`, `card_not_found_in_view`, etc.)
  so it's clear whether the issue is YAML mode, permissions, or wrong view.

**Note:** If Lovelace is configured in YAML mode (`lovelace.yaml` /
`ui-lovelace.yaml`), `lovelace/config/save` is not supported by HA — the
overlay copy-paste workflow is the only option in that case.

## [1.2.7] – 2026-06-04

### Fix: Save button uses view-scoped search to handle duplicate cards

Searching the entire Lovelace config by `base_image` matched copies of the
same card in other views/dashboards (production, dev, backup tabs).

Fix: the current view is extracted from `window.location.pathname` and the
card search is scoped to that view only:

- `/lovelace/2` → looks in `views[2]` of the default dashboard
- `/my-dash/living-room` → dashboard `my-dash`, view with `path: living-room`
- Fallback to `views[0]` if no view segment in URL

This correctly distinguishes copies of the same card that live in different
views/tabs, even when they share the same `base_image`.

## [1.2.6] – 2026-06-04

### New: Save button writes directly to HA Lovelace storage

When `test_mode: true` and Lovelace is in storage mode (UI-managed), clicking
**💾 Save** now saves the card's current config directly to HA without any
copy-paste:

1. Fetches the full Lovelace config via `hass.connection.sendMessagePromise`
2. Locates the card by matching `type` + `base_image`
3. Replaces the card config with current positions
4. Saves the updated Lovelace config back to HA

On success the button shows **"✓ Saved!"** for 2.5 s.

**Fallback:** If Lovelace is in YAML mode, the card is not found (multiple
cards with the same `base_image`), or the connection is unavailable, the
config overlay (Ctrl+C copy) is shown instead with a console warning.

## [1.2.5] – 2026-06-04

### Fix: Save button now shows config overlay for reliable copy

`navigator.clipboard` is not available in all HA setups (HTTP, older browsers,
permission denied), so the previous clipboard-only approach silently did nothing.

Clicking **💾 Save** now toggles a dark overlay over the card with the full
config YAML in a read-only textarea — auto-focused and auto-selected so
**Ctrl+C** copies it immediately. The clipboard API is still attempted in the
background as a best-effort bonus. Close the overlay with ✕ or by clicking
outside it. Clicking Save again also closes the overlay.

## [1.2.4] – 2026-06-04

### Fix: Save button and roc-pos-update now work when test_mode is toggled in editor

Root cause: when test_mode is enabled via the checkbox in the GUI editor,
`setConfig()` is called but the `same` check skips `_render()` (no array
length changes). The `_rocPosHandler` window listener was only registered
inside `_render()`, so it was never set up in this case.

Fix: the test_mode checkbox listener in `_listen()` now also manages
`_rocPosHandler` directly — registering it when the checkbox is checked and
removing it when unchecked.

### Fix: Save button feedback messages

- **When editor is open (auto-save):** drag/keyboard already auto-saves via
  window event on every drop; Save button sends an extra event (no visible
  change needed).
- **When on dashboard without editor:** Save copies config YAML to clipboard
  and shows **"📋 Copied!"** (blue) instead of the misleading "✓ Saved!",
  making it clear the user needs to paste it into the YAML editor manually.

## [1.2.3] – 2026-06-04

### New: Save button in test mode

A green **💾 Save** button appears below the FLIP button when `test_mode: true`.

- **When the HA card editor is open:** fires `roc-pos-update` → editor relays
  the config to HA storage automatically. Button shows "✓ Saved!" for 2 s.
- **When on the dashboard without editor:** copies the full config YAML
  (or JSON if YAML unavailable) to the clipboard so you can paste it into the
  YAML editor manually.

The Save button is excluded from the card's `tap_action` so clicking it never
triggers navigation or other card-level actions.

## [1.2.2] – 2026-06-04

### Fix: drag & drop and keyboard nudge positions now actually save

Config changes from the card (drag, resize, keyboard) were dispatched as
`config-changed` from the card element — but HA Lovelace only listens for
`config-changed` from the **editor** element, so positions were not persisted.

Fix: the card now dispatches a `window` custom event `roc-pos-update` instead.
The editor registers a `window` listener when `test_mode: true` and relays
any received config through its own `_fire()` call, which HA correctly treats
as an editor config change and saves to storage. The listener is cleaned up
in the editor's `disconnectedCallback`.

## [1.2.1] – 2026-06-04

### Fix: test mode red border restored after deselect

Selecting an element for keyboard nudge overrides its outline with the dashed
selection indicator. On deselect, zones now get their `3px solid red` test mode
border back; other element types get an empty outline (they have no default
test mode border).

### Changed: keyboard nudge step sizes

- `Arrow` keys: **1%** per press (was 0.5%)
- `Shift` + `Arrow`: **0.1%** per press (was 2%) — for fine pixel-level tuning

## [1.2.0] – 2026-06-04

### New: keyboard nudge in test mode

Click any zone, icon, or label in `test_mode: true` to select it — it gets a
dashed primary-color outline. Then use the keyboard to position it precisely:

| Key | Movement |
|---|---|
| `Arrow` keys | ±0.5% per press |
| `Shift` + `Arrow` | ±2% per press (coarse) |
| `Escape` | Deselect |

Config is saved 200 ms after the last key press (debounced), so holding down
an arrow key moves the element smoothly without flooding config-changed events.

Click anywhere on the card background to deselect. Click a different element to
switch selection. The keyboard handler is registered on `document` while
test_mode is active and cleaned up on re-render and `disconnectedCallback`.

## [1.1.0] – 2026-06-04

### New: visual resize handles in test mode

Zones, elements, and gauges now show 6 resize handles in `test_mode: true` —
four corners and two edge handles (right, bottom). Dragging a corner changes
both axes simultaneously; edge handles change one axis. Position and size save
to config automatically on release, identical to the drag & drop behaviour.

Handles are 10×10 px squares styled with `--primary-color` and a white border
so they're visible against any room image. `overflow: visible` is set on the
element in test mode so handles can extend outside the element boundary.

### New: `base_image_conditions` — conditional base image switching

Swap the room photo based on entity state without needing an overlay:

```yaml
base_image: /local/living_room_day.jpg
base_image_conditions:
  - condition:
      entity: sun.sun
      state: below_horizon
    image: /local/living_room_night.jpg
  - image: /local/living_room_day.jpg   # default (no condition)
```

Evaluated in order — first match wins; entry without `condition` is the
default fallback. Images are preloaded at startup. Available in the GUI
editor as a YAML textarea in the Basic settings section.

### Includes all v1.0.18 changes

- Drag & drop positioning in test mode (zones, icons, labels)
- Duplicate button in all GUI editor panels
- Icon `%` size now tracks live card width via `ResizeObserver`

## [1.0.18] – 2026-06-04

### New: drag & drop positioning in test mode

- Zones, icons, and labels are now draggable when `test_mode: true`.
  Grab any element and drag it to its new position — `top`/`left` update live
  and the config is saved automatically on drop.
- Tap/click actions are suppressed when a drag occurs (capture-phase listener),
  so dragging a tappable zone doesn't accidentally trigger its action.
- Labels temporarily become pointer-interactive in test mode to allow dragging.

### New: Duplicate button in GUI editor

- Every icon, label, gauge, blind, zone, and element panel now has a **Duplicate**
  button alongside Remove. Creates a deep copy of the element, appends `_2` to
  the ID, and offsets `top`/`left` by 3% so the copy is visible immediately.

### Fix: icon `%` size now tracks actual card width

- `size: X%` was calculated from `offsetWidth` at `_render()` time, which is often
  0 before the card is laid out (defaulting to 300 px).
- Icon sizes are now recalculated on every `_update()` using the live `offsetWidth`.
- Added `ResizeObserver` — resizing the browser window or changing the dashboard
  layout triggers an `_update()` so icon sizes adjust to the new card width.
- `vw`, `vh`, `vmin`, `clamp()` and other CSS units continue to work unchanged
  (they pass through `resolveSize` unmodified).

## [1.0.17] – 2026-05-30

### Fix: editor freeze caused by datalist DOM thrashing

- `set hass()` in the editor was regenerating and re-setting the full entity
  `<datalist>` on every hass tick (called dozens of times per second when any
  entity changes), causing severe DOM thrashing and browser freeze.
- Fix: datalist is now populated only when empty — once after each `_render()`.
  Subsequent hass updates skip the datalist entirely. Entity list is stable
  within a session so a single fill is sufficient.

## [1.0.16] – 2026-05-30

### Fix: entity search replaced with native datalist

- `ha-entity-picker` had lifecycle issues in the innerHTML-based editor
  (broken rendering, unresponsive fields, empty values on load).
- All entity fields now use `<input list="roc-entities">` backed by a native HTML5
  `<datalist>` populated from `hass.states`. Typing filters entities immediately;
  the dropdown shows matching IDs without any custom element complexity.
- `set hass()` in the editor updates the datalist in-place on every hass update,
  so the list always reflects the current entity set without requiring a full re-render.

## [1.0.15] – 2026-05-30

### New: client-side element groups

Elements can now be grouped and toggled on/off without any HA entity.

**New config section `groups[]`:**
```yaml
groups:
  - id: tv_controls
    visible: false          # initial state
    grouping_code: 1        # optional: mutual exclusion with same code
    style:                  # optional: background panel div
      top: 65%
      left: 5%
      width: 90%
      height: 28%
      background: rgba(0,0,0,0.75)
      border_radius: 10px
      z_index: 49
```

**New `group` property on `icons[]`, `labels[]`, `gauges[]`, `blinds[]`, `elements[]`, `badges[]`, `zones[]`:**
```yaml
icons:
  - id: tv_power
    group: tv_controls
    ...
```

**New action types `toggle-group`, `show-group`, `hide-group`:**
```yaml
zones:
  - id: zone_tv
    tap_action:
      action: toggle-group
      group: tv_controls
```

- `grouping_code`: when a group becomes visible, all other groups sharing the same code are automatically hidden (radio-button behaviour).
- Group state is client-side only — no `input_boolean` entity needed.
- GUI editor: new *Element groups* section with ID, grouping code, initially-visible checkbox, and optional background panel YAML. All element panels gain a *Group* input field.

## [1.0.14] – 2026-05-30

### New: `ha-entity-picker` in all entity fields

- All entity input fields in the GUI editor now use HA's native `ha-entity-picker`
  component instead of plain text inputs. Typing filters the list; clicking shows all
  entities grouped by domain — identical to the standard Lovelace card editors.
- Fields upgraded: base image filter conditions (main + AND/OR sub-conditions),
  labels, gauges, gauge alert conditions, blinds, and brightness model sources.
- `_bindHassComponents()` extended to copy `data-*` attributes from the placeholder
  span to the created picker, so `_collectConfig()` requires no changes.

## [1.0.13] – 2026-05-30

### Refactor: universal `resolveSize()` helper for percentage-based sizes

- New module-level `resolveSize(raw, cardW)` function: if the value ends in `%`,
  it converts to pixels based on the card's rendered width; otherwise passes the
  value through unchanged. Works for any CSS size field.
- `icons[].size` refactored to use `resolveSize()` — removes the inline `%`
  conversion that was added in v1.0.12; behaviour unchanged.
- `labels[].font_size` now also accepts `%` values via `resolveSize()`.
  Example: `font_size: 1.5%` on a 600 px wide card → `9px`; on a 1200 px card → `18px`.
- GUI icon size field label and placeholder updated to `Size (px or %)` / `20px or 2%`.

## [1.0.12] – 2026-05-29

### New: percentage-based icon size

- `size` on icons now accepts `%` values (e.g. `size: 2%`) meaning 2% of the card's
  rendered width. The icon scales proportionally with the card on all screen sizes.
  Pixel values (e.g. `size: 22px`) continue to work as before.

## [1.0.11] – 2026-05-29

### Fix: `bottom` positioning with auto height

- When `bottom` is set without an explicit `height`, the element now uses `height: auto`
  so it expands to fit its content and anchors correctly to the bottom edge on all
  screen sizes. Fixes bubble-card "floating" inside an oversized container on wide screens.

## [1.0.10] – 2026-05-29

### Fix: `bottom` positioning now reliably places element at bottom

- CSS `bottom` property proved unreliable in the card's absolute-positioned container.
  `bottom: X%` is now converted to an equivalent `top` value in JavaScript:
  `top = 100% - bottom% - height%`. Works correctly on all screen sizes.

## [1.0.9] – 2026-05-29

### Fix: element `bottom` positioning works correctly through GUI editor

- **Fixed: `top` field in GUI editor was overwriting `bottom`** — when an element used
  `bottom` positioning, opening the GUI editor would save an empty `top` value, causing
  conflicts. Now `top` and `bottom` are mutually exclusive: setting one clears the other.
- **New: `Bottom` field in element GUI panel** — elements now have a dedicated
  "Bottom (alternative to Top)" input field. Fill in either `top` or `bottom`, leave
  the other empty.

## [1.0.8] – 2026-05-29

### New: `bottom` positioning for elements

- Elements now support `bottom` as an alternative to `top`. Use `bottom: 0%` to anchor
  an embedded card to the bottom edge of the room image — works correctly across all
  screen sizes regardless of card pixel height.

## [1.0.7] – 2026-05-29

### Fix: browser-mod popup no longer broadcasts to all devices

- `browser-mod-popup` action now automatically reads the current browser's ID from
  `window.browser_mod.browserID` and passes it as `browser_id` to the service call.
  The popup will only open on the device that triggered the action.
  No YAML changes required — existing configs benefit automatically.

## [1.0.6] – 2026-05-29

### New: icon background (circle style)

- **`background` field on icons** — optional CSS background string; when set, the icon
  is rendered inside a circle (`border-radius: 50%`, `padding: 7px`). Useful for making
  tappable icons visually distinct from the room image.
  Example: `background: rgba(0,0,0,0.55)`
- GUI editor updated with a "Background (circle, optional)" input field in the icon panel.

## [1.0.5] – 2026-05-29

### Refactoring — no functional changes

- **Removed dead code**: `_lblItem()`, `_gaugeItem()`, and `_blindItem()` existed as
  identical copies in both `RoomOverlayCard` and `RoomOverlayCardEditor`. The copies
  in `RoomOverlayCard` were never called (the main card builds all HTML inline in
  `_render()`). Removed 98 lines of unreachable code; only the editor copies remain.
- **Removed `orientation: left`**: was functionally identical to `orientation: horizontal`
  in both `_render()` and `_update()`. Removed from rendering logic entirely. No existing
  config used this value.

## [1.0.3.1] – 2026-05-29

### Hotfix

- **Fixed: day/night (zebra) blind invisible** — a typo introduced in v1.0.3 inserted the
  slat color into the transparent band of the `_gradDN` CSS gradient, producing invalid CSS
  and making all `blind_type: day_night` blinds disappear entirely. Rolled back to the
  correct gradient string.

## [1.0.3] – 2026-05-29

### Bug fixes and performance improvements

- **Fixed: `rgba()` colors treated as white** — `parseCssColor` and `_toHex` only matched
  `rgb(...)` syntax; any color specified as `rgba(...)` in `color_gradient`, `animation_color`,
  or similar fields fell back to `#ffffff`. Both functions now accept `rgba?` pattern.
- **Fixed: `alert_conditions` with `attribute` not triggering updates** — `_extractAttrSources`
  tracked the main gauge `attribute` but not `alert_conditions.attribute`; attribute-based
  alert conditions now register for change tracking properly.
- **Fixed: always-on gauge animation skipped when entity unavailable** — animation logic was
  placed after the `if(!ent) continue` guard, so a gauge with `animation: pulse` and no
  `alert_conditions` never animated if the entity had no state. Animation is now evaluated
  before the entity check.
- **Fixed: preloaded images immediately garbage-collected** — `_preloadImages` created
  `Image` objects that were never stored, so browsers GC'd them before caching. Images are
  now retained on the instance.
- **Perf: `.gfill` element cached at render time** — `_update()` no longer calls
  `el.querySelector('.gfill')` on every tick; fill elements are stored in `_gaugeFills`
  during `_render()`.
- **Perf: `color_gradient` stops sorted once at render time** — `lerpColorGradient` was
  calling `.slice().sort()` on every update cycle; sorted arrays are now cached in
  `_sortedGrads` during `_render()`.
- **Perf: `parseFilterStr` regex precompiled** — `FILTER_PROPS` regex patterns are now
  compiled once at startup instead of inside every `parseFilterStr` call.
- **Fixed: day/night blind gradient broken in initial v1.0.3 build** — a typo in the
  `_gradDN` CSS string inserted the slat color into the transparent band, producing invalid
  CSS and making zebra blinds invisible.

## [1.0.2] – 2026-05-28

### Gauge animation editor fixes

- **Fixed: alert condition fields unwritable in GUI** — `data-g-anim`, `data-g-alert-ent`,
  `data-g-alert-attr`, `data-g-alert-op`, `data-g-alert-val` were missing from the
  `_listen()` change-event registration; any re-render triggered by another gauge field
  (entity, min, max, …) would wipe the partially-filled condition row
- **Fixed: `alert_conditions` leaked into YAML textarea** — the field was not stripped
  from `cp` in `_gaugeItem()`, causing `Object.assign` from the YAML textarea to silently
  overwrite the dedicated condition fields on every save cycle
- **New: attribute support in alert condition** — added optional "Attribute" field to the
  GUI condition row (entity / attribute / operator / value); saves as `alert_conditions.attribute`
  and evaluated by the existing `evalCond` attribute path

## [1.0.1] – 2026-05-28

### Gauge border animations

- **Gauge alert animations**: gauge bars can now display a pulsing or blinking
  colored border when a condition is met (e.g. temperature above threshold).
- New CSS keyframes `roc-border-pulse` and `roc-border-blink` use an inset
  `box-shadow` so the effect renders correctly inside the clipped overlay container.
- New YAML fields on each gauge:
  - `animation`: `pulse` | `blink` — animation style (always-on if no condition set)
  - `animation_color`: CSS color string — border/glow color (default `#ff4444`)
  - `alert_conditions`: condition object `{entity, operator, value}` — when present,
    animation is shown only while the condition is true; removed as soon as it clears
- GUI editor updated in the gauge panel: animation dropdown, color picker, and a
  three-field condition row (entity / operator / value) — no YAML required
- The alert entity is tracked automatically by the existing `_extractEntities`
  recursive scanner, so state changes trigger a live update without re-render

## [1.0.0] – 2026-05-28

### Release milestone — first public version

This release marks the project as production-ready for HACS publication.
All core features are stable, the GUI editor is complete, and the codebase
has no known bugs.

#### Feature summary
- Base image with configurable aspect ratio and border-radius
- CSS filter engine with conditional states and smooth transitions
- Brightness model — multi-stop filter interpolation driven by sensor values
- Overlay layers — conditional opacity and state-driven image switching
- Gauges — animated progress bars, 6 fill directions, color gradients
- Blinds — roller, venetian slat, and day/night (zebra) blind animations
- Clickable zones — navigate, more-info, toggle, call-service, browser-mod
- Status badges — corner chips with conditional icon color and label
- Embedded HA cards at absolute coordinates
- Test mode for layout debugging
- Full GUI editor — no YAML required

#### Also in this release
- README rewritten with full documentation for all sections
- Screenshot paths changed to relative (branch-agnostic)
- `package.json` bumped to 1.0.0

## [0.7.15] – 2026-05-27

### Fixed
- **GUI editor – brightness model section collapses while typing entity name**

  Three cooperating bugs caused the section to disappear mid-edit:

  1. `_collectConfig` skipped any source row whose entity field was empty
     (`if(!el.value.trim())return`) — so a row being actively typed was treated
     as non-existent.
  2. `brightness_model` was deleted from the collected config whenever either
     `source` or `filter_gradient` was empty (`&&` condition). A freshly added
     source with no filter stops yet wiped the whole model.
  3. Entity inputs had `input` event listeners that fired `_fire()` on every
     keystroke, causing HA to call `setConfig()` again; the length mismatch
     triggered a full `_render()` that destroyed the in-progress input.

  Fixes: (1) source rows are preserved regardless of entity value, (2) `&&`
  changed to `||` — model is kept as long as any row exists, (3) `input`
  listeners removed from brightness model fields (values are committed on
  `change` / blur, consistent with all other text fields in the editor).

## [0.7.14] – 2026-05-27

### Fixed
- **GUI editor – `min`/`max` fields no longer overwrite zero values**

  `parseFloat("0") || 100` evaluates to `100` in JavaScript because `0` is falsy.
  Setting `max: 0` (inverted motor, e.g. 0 = closed) was silently reset to `100` on
  every editor save.  Fixed for both `blinds[]` and `gauges[]` min/max fields by
  using `isNaN()` guard instead of the `|| fallback` pattern.

## [0.7.13] – 2026-05-27

### Fixed
- **`blind_type: day_night` – fully closed at 100 %**

  For even `slat_count` (e.g. 8) the cycling formula `pct × N × period/2` ended at
  `N × period/2 ≡ 0 (mod period)` — the gradient wrapped back to its open phase.
  Fix: when `pct ≥ 1` the offset is clamped to `period/2` (fully closed) regardless
  of `slat_count` parity.  The CSS transition animates smoothly to this final position.

## [0.7.12] – 2026-05-27

### Changed
- **`blind_type: day_night` – phase shift cycles `slat_count` times across full travel**

  Previous formula `offset = pct × (period/2)` did one open→closed transition over
  0–100 % travel.  New formula:
  ```
  offset = pct × slat_count × (period/2)
  ```
  With `slat_count: 8` the phase completes 8 half-cycles as the blind deploys, matching
  the physical behaviour where each band pair individually cycles through its open/closed
  state.  The CSS `background-position-y` transition animates smoothly between positions.

- **GUI editor – `day_night` fields simplified to `slat_count` only**

  For `blind_type: day_night` the editor now shows a single *Slat count* field instead
  of the old Slat width / Slat gap / Slat pitch inputs.  `venetian` still shows Slat
  width, Slat gap and Gap color.  `slat_pitch` removed from editor entirely.

## [0.7.11] – 2026-05-27

### Changed
- **`blind_type: day_night` – simplified to single `slat_count` parameter**

  `slat_width`, `slat_gap`, `slat_pitch` are no longer used and can be removed from
  config.  All geometry is now derived from the container at render time:

  ```
  period    = containerHeight / slat_count   (px, dynamic)
  slat_width = period / 2                    (symmetric 50/50 opaque/transparent)
  offset     = pct × (period / 2)            (linear, 0 = open, 1 = closed)
  ```

  Minimal YAML:
  ```yaml
  blind_type: day_night
  slat_count: 8          # number of band pairs; default 6
  slat_color: rgba(0,0,0,0.9)   # optional
  ```

  The band pattern is always visible at every position between 0 % and 100 %
  (open = aligned gaps, closed = gaps fully covered).  The previous
  `Math.min` formula that caused the blind to look fully solid beyond the
  first slat has been removed.

## [0.7.10] – 2026-05-27

### Fixed
- **`blind_type: day_night` – phase shift rate corrected**

  Previous formula `offset = pct × (period/2)` spread the full half-period shift over
  the entire 0–100 % travel, so the bands moved imperceptibly slowly.

  New formula:
  ```
  offset = min(pct × containerHeight, period) / 2
  ```
  The full half-period shift now completes within the first single slat's height of
  travel (`pct = period / containerHeight = 1 / slat_count`); from that point onward
  the offset stays at `period/2` (fully closed) and only the covered height continues
  to grow.  The band motion is visible and fast, matching physical zebra-blind behaviour.

## [0.7.9] – 2026-05-27

### Changed
- **`blind_type: day_night` – rewritten as single-element two-CSS-layer model**

  Root cause of the missing motion effect: the previous two-gauge-div approach had the
  overlay gauge container with `background: rgba(0,0,0,0.5)`.  Through the transparent
  bands of the overlay fill, the browser rendered *the overlay's own background*, not the
  gauge behind it — so the base layer was effectively invisible, and the only visible
  change was the `height` growing.

  New model — one gauge div (`background: transparent`), one `.gfill` div with **two
  CSS gradient layers** on `background-image`:

  ```
  background-image: <gradient shifted by −offset>, <gradient at 0>;
  background-position-y: -offset px, 0px;
  ```

  where `offset = pct × (period / 2)`.

  | pct | offset | layer 1 opaque | layer 2 opaque | combined transparent |
  |---|---|---|---|---|
  | 0 | 0 | [0, sw) | [0, sw) | [sw, period) — max gap |
  | 0.5 | sw/2 | [0, sw/2) | [0, sw) | [sw, 3sw/2) — half gap |
  | 1.0 | sw | [sw, 2sw) | [0, sw) | ∅ — fully closed |

  Because the front gradient layer physically shifts, the opaque bands visibly scroll
  upward relative to the container as `pct` increases — the classic rolling zebra-blind
  motion.  Through the transparent window you see the room image behind (no background
  colour blocks it).

  Transition: `height` + `background-position-y` both animated.

- **`slat_pitch`, `_dnBase`, `_dnOverlay` removed** — internal props cleaned up; only
  `_dayNight` remains.  `slat_count` and `slat_width`/`slat_gap` still supported.

## [0.7.8] – 2026-05-27

### Changed
- **`blind_type: day_night` – front layer now carries the motion (visible band sliding)**

  Previous versions moved the *behind* layer (`_dnBase`, z-index 6) while the *front* layer
  (`_dnOverlay`, z-index 7) was fixed.  Because the dominant visible stripes always belong
  to the front layer, those appeared stationary — only the narrow transparent gaps of the
  front layer changed, which looked like the gap was just squeezing shut rather than bands
  physically moving.

  Fix — formulas swapped:

  | layer | role | `background-position-y` |
  |---|---|---|
  | `_dnBase` (z, behind) | static reference | `0` px (fixed) |
  | `_dnOverlay` (z+1, front) | moving fabric | `−(pct × period/2)` px (slides up) |

  The front layer's opaque bands now physically scroll upward as `pct` increases — the
  leading edge of each band exits above the container top while the next band's leading
  edge enters from below.  Through the front layer's transparent windows you see the
  fixed back layer for contrast.  The combined gap closes to zero at `pct = 1`.  The
  sliding is visible in the **static state** at every pct value, not just during animation.

- **New parameter `slat_count`** — number of slat pairs visible when the blind is fully
  extended.  The period is computed dynamically from `el.offsetHeight / slat_count` each
  render tick, so the gradient always scales to the actual container height:
  ```yaml
  blind_type: day_night
  slat_width: 10   # px — width of each opaque band
  slat_count: 8    # total opaque+transparent pairs in full height
  ```
  `slat_gap` is still accepted (overrides auto-derived gap).  If both `slat_count` and
  `slat_gap` are absent, `slat_gap` defaults to `slat_width` (symmetric bands).

- **`slat_pitch` removed** — parameter no longer has any effect and is silently ignored.
  Remove it from existing configs.

- **`slat_gap` default changed** from the old hardcoded `6` px to `slat_width` (symmetric
  bands by default: equal opaque and transparent stripe widths).

---

## [0.7.7] – 2026-05-27

### Fixed
- **`blind_type: day_night` – band sliding effect now visible in static state**

  v0.7.6 tied layer 1's `background-position-y` to `el.offsetHeight` (the container's
  rendered pixel height).  For any container whose height happens to be a multiple of the
  gradient period (e.g. a 180 px container with a 20 px period), the scroll offset at
  every integer-pct value was a multiple of the period → net phase = 0 → visually
  identical to the unshifted state.  The bands only appeared to move during the 0.5 s CSS
  transition after each entity update, not at rest.

  New formula — container-height-independent:

  | layer | `background-position-y` |
  |---|---|
  | layer 1 `_dnBase` | `pct × period/2` px |
  | layer 2 `_dnOverlay` | `0` px (fixed) |

  Layer 2 acts as a fixed grid/mask.  Layer 1 slides through it by exactly half a period
  (`slat_gap` pixels) as `pct` goes from 0 → 1.  At every intermediate `pct` value the
  opaque band of layer 1 is at a different position relative to layer 2's transparent
  window, so the sliding effect is **visible in the static (resting) state**, not just
  during animation.  Full closure at `pct = 1` is guaranteed: layer 1 phase = `period/2`,
  which means its opaque bands align exactly with layer 2's transparent windows → no gap.

---

## [0.7.6] – 2026-05-27

### Changed
- **`blind_type: day_night` – both fabric layers now scroll together (physical unroll effect)**

  Previously only layer 2 shifted its `background-position-y` while layer 1 stayed fixed
  at offset 0.  The result was a gap that simply squeezed shut — the bands themselves never
  appeared to move.

  New model — two independent but coordinated offsets:

  | layer | `background-position-y` |
  |---|---|
  | layer 1 (base, `_dnBase`) | `pct × container_height` px |
  | layer 2 (overlay, `_dnOverlay`) | `pct × container_height − pct × period/2` px |

  Both layers scroll downward at the same rate (by the full container height as the blind
  goes from 0 → 100 %).  Layer 2 carries the additional `−pct × period/2` tilt that
  progressively shifts the two layers out of phase, closing the gaps.  The result is:
  - The striped fabric **physically slides** as the blind extends — every visible band
    moves downward, like a striped carpet being pulled across the floor.
  - Simultaneously the bands tilt from fully open (phase 0) to fully closed (phase
    `period/2`) at 100 %, exactly as in v0.7.5.

  Implementation: layer 1 is now marked `_dnBase: true` so `_update()` handles it
  independently from the generic gauge path (which would reset `backgroundPositionY` via
  the `background` shorthand).  Both `_dnBase` and `_dnOverlay` share the same initial
  CSS in `_render()` (`transition: height Xs ease, background-position-y Xs ease`).

---

## [0.7.5] – 2026-05-27

### Fixed
- **`blind_type: day_night` – CSS transition for `background-position-y` was broken** –
  the transition string was built as `transition: height Xs ease, background-position-y
  height Xs ease` (the property name `height` leaked into the timing definition for the
  second property).  Browsers silently discarded the invalid `background-position-y`
  transition, so the slat phase jumped instantly on every hass update while only `height`
  animated smoothly.  Fixed by stripping the property-name prefix from `_dtr` before
  appending it to the `background-position-y` entry, e.g.:
  ```
  height 0.5s ease  →  background-position-y 0.5s ease   ✓
  ```

### Changed
- **`blind_type: day_night` – single-pass linear band tilt model** – replaced both the
  oscillating formula (v0.7.4) and the two-phase "lower then tilt" model (v0.7.5 initial)
  with a simple single-pass progressive shift:

  ```
  background-position-y (layer 2) = −(pct × period / 2)  px
  ```

  At `pct = 0`: both layers are in phase → transparent gaps visible (day / open bands).
  At `pct = 1`: layer 2 is offset by exactly `period/2` → opaque bands cover every gap
  of layer 1 → fully solid (night / closed bands). ✓

  The tilt is distributed **across the entire blind travel** — as the blind extends, the
  bands visibly rotate throughout (like pulling striped fabric across a surface), rather
  than staying static during the lowering phase and only moving in the final segment.
  No oscillations, no two-phase split. Guaranteed closure at exactly 100 %.

- **`slat_pitch` default changed from `2` to `30`** – the parameter is kept in the config
  schema but is not used in the current tilt formula; it may serve future extensions.
  Default updated to `30` as a more descriptive placeholder value.

---

## [0.7.4] – 2026-05-27

### Changed
- **`blind_type: day_night` – physical two-layer CSS model** – replaced the opacity-toggle
  approach with a correct simulation of the actual day/night blind mechanism:

  A day/night blind has two identical striped fabric layers.  As the blind extends, the
  front layer shifts relative to the back layer, cyclically aligning and misaligning the
  transparent gaps:

  | relative offset | visual result |
  |---|---|
  | 0 (aligned) | transparent — gaps of both layers line up |
  | ½ period | solid — slats of layer 2 cover gaps of layer 1 |
  | 1 period | transparent again |

  **Implementation**: both layers carry the same `repeating-linear-gradient`.  Layer 1
  has `background-position-y: 0` (fixed).  Layer 2's position is updated every hass tick:
  ```
  backgroundPositionY = -(pct × 100 × (slat_width + slat_gap) / slat_pitch) px
  ```
  Both `height` and `background-position-y` are included in the CSS transition
  (`height Xs ease, background-position-y Xs ease`), so both animate smoothly and in sync.
  No opacity switches, no background re-paints, no binary jumps — pure CSS geometry.

  The formula includes a fixed `−period/2` offset so that `pct = 0` starts at phase 0.5
  (SOLID, but invisible because height is 0) and every whole-cycle boundary (`pct = n ×
  slat_pitch / 100`) also lands on SOLID.  With `slat_pitch: 4` and range 0–100 the
  sequence is: 0 % → invisible · 4 % → SOLID · 8 % → transparent · … · 100 % → SOLID ✓

---

## [0.7.3] – 2026-05-27

### Fixed
- **`blind_type: day_night` – correct cyclic solid/stripe model** – the v0.7.2 solid
  overlay used `min = midpoint` which produced "solid on top, stripes on bottom" and did
  not use `slat_pitch` at all.  Replaced with:
  - Both layers always have **identical height** (= current position %)
  - The solid overlay's **opacity** cycles between `0` and `1` based on `slat_pitch`:
    ```
    cycle_pos = (pct × 100 % slat_pitch) / slat_pitch   // 0→1 per cycle
    opacity   = cycle_pos ≥ 0.5 ? 1 : 0
    ```
  - With `slat_pitch: 2` this produces one full stripes↔solid cycle every 2 % of travel,
    so at e.g. 25 % closed the entire covered area is solid, at 26 % it shows stripes again.
  - The solid layer config is marked with `_dnOverlay: true` and carries `_sp` (slat_pitch);
    the `_update()` loop detects this and applies opacity instead of the standard height
    formula.

---

## [0.7.2] – 2026-05-27

### Changed
- **`blind_type: day_night` now renders as two stacked gauge layers** – this correctly
  models the physical mechanism of a day/night blind, which has two fabric layers (striped +
  solid) that shift relative to each other as the blind closes:

  | position | stripe layer | solid overlay | visual result |
  |---|---|---|---|
  | 0 % (open) | 0 % height | 0 % height | fully transparent |
  | 50 % | 50 % stripes | 0 % solid | half-height stripes visible |
  | 75 % | 75 % stripes | 50 % solid on top | solid upper half + stripes lower quarter |
  | 100 % (closed) | 100 % | 100 % | fully opaque |

  The solid overlay layer uses `z_index + 1` and `min = midpoint` of the configured
  min/max range so it only starts filling from the halfway point.  Both layers are
  generated automatically from a single `blinds[]` config entry — no duplicate YAML needed.

- `blindToGaugeConfig()` now returns an **array** of gauge configs (`flatMap` used at all
  call sites).  `_blindGaugeCfgs` cache is flat and covers all generated layers.

---

## [0.7.1] – 2026-05-27

### Fixed
- **Choppy / unnatural blind animation** – four root causes identified and resolved:
  1. **`background` CSS transition removed from default** – the browser cannot interpolate
     between `repeating-linear-gradient()` values, so `background 1s ease` produced
     jarring flashes on every update. Default transition is now `height 0.5s ease` /
     `width 0.5s ease` (position-only). Background changes are now instant, which is
     correct: only the fill size should animate.
  2. **Sub-percent height precision** – `Math.round(pct*100)` truncated to whole integer
     percentages, causing visible 1 % step-jumps in the fill height. Now uses
     `Math.round(pct*1000)/10` (one decimal place, 0.1 % resolution).
  3. **`slat_pitch` cyclic background switch removed** – the binary solid↔gradient
     alternation every 1 % created a strobe effect when combined with the CSS transition.
     Removed from the update loop; the `repeating-linear-gradient` itself already renders
     the slat pattern correctly as the height grows.
  4. **`blindToGaugeConfig` now cached** – result stored as `this._blindGaugeCfgs` in
     `_render()` and reused in `_update()` instead of rebuilding gradient strings on every
     hass state update.

---

## [0.7.0] – 2026-05-27

### Added
- **`blinds[]` section** – dedicated first-class config section for window blinds / roller
  shades, rendered internally through the existing gauge pipeline via a new module-level
  `blindToGaugeConfig(b)` helper.  All blind elements use `orientation: top` (fills
  top → bottom) automatically.

  Three blind types selectable via `blind_type`:

  | `blind_type` | description | extra properties |
  |---|---|---|
  | `roller` | solid fill, single colour | — |
  | `day_night` | repeating stripe (slat + transparent gap) with cyclic solid overlay | `slat_width`, `slat_gap`, `slat_pitch` |
  | `venetian` | repeating stripe (slat + coloured gap) with optional cyclic overlay | `slat_width`, `slat_gap`, `gap_color`, `slat_pitch` |

  Example – day/night blind over a bedroom window:
  ```yaml
  blinds:
    - id: blind_bedroom
      entity: cover.roller_motor_bedroom_curtain
      attribute: current_position
      min: 0
      max: 100
      top: "13%"
      left: "38%"
      width: "24%"
      height: "45%"
      z_index: 5
      blind_type: day_night
      slat_color: "rgba(10,10,10,0.9)"
      slat_width: 7
      slat_gap: 6
      slat_pitch: 2
  ```

- **GUI editor for `blinds[]`** – new *Window blinds* collapsible section with:
  - Position / size fields (top, left, width, height, z-index)
  - Entity, attribute, min, max
  - **Blind type** dropdown (`roller` / `day/night` / `venetian`)
  - **Slat / roller color** text field (accepts any CSS color, including `rgba(…)`)
  - **Slat width**, **Slat gap**, **Slat pitch** fields (visible for `day_night` and
    `venetian` only)
  - **Gap color** field (visible for `venetian` only)
  - YAML textarea for `background`, `border_radius`, `transition`,
    `visible`, `visible_conditions`
  - Add / Remove blind buttons

### Changed
- `_gaugeEls` cache, `_update()` loop, `_extractAttrSources()` and the `setConfig`
  same-check all extended to cover `blinds[]` entries transparently.

---

## [0.6.0] – 2026-05-26

### Added
- **Four fill directions for `gauges[]`** – the `orientation` property now supports all four
  cardinal directions in addition to the original two:

  | value | fill direction | typical use |
  |---|---|---|
  | `vertical` | bottom → top (default) | level / progress |
  | `top` | top → bottom | roller blind / shade |
  | `horizontal` | left → right | existing alias |
  | `right` | right → left | mirrored bar |

  `bottom` and `left` are accepted as aliases for `vertical` and `horizontal`.

- **CSS gradient support in `color`** – any valid CSS `background` value is accepted,
  including `repeating-linear-gradient(...)`. Combined with `orientation: top` this enables a
  convincing day/night roller blind simulation directly over a window area:
  ```yaml
  gauges:
    - id: blind_bedroom
      entity: cover.roller_motor_bedroom_curtain
      attribute: current_position
      min: 0
      max: 100
      orientation: top          # fills top → bottom like a real shade
      top: "13%"
      left: "38%"
      width: "24%"
      height: "45%"
      z_index: 5
      background: "transparent"
      color: >
        repeating-linear-gradient(
          to bottom,
          rgba(10,10,10,0.90) 0px,
          rgba(10,10,10,0.90) 7px,
          rgba(200,200,200,0.12) 7px,
          rgba(200,200,200,0.12) 13px
        )
  ```
  The transparent background lets the room photo show through the open portion; the gradient
  fills downward as the blind closes, mimicking actual slats.

- **GUI dropdown updated** with all four orientation options and descriptive labels.

---

## [0.5.0.1] – 2026-05-26

### Fixed
- **Attribute-based `brightness_model` sources not reacting to changes** – `_prevStates` only
  tracked entity `.state` strings, so a source like `light.living_room` with
  `attribute: brightness` would only trigger a filter update when the light was turned on/off,
  not when its brightness level changed. Added `_extractAttrSources()` which builds a list of
  all `{entity, attribute}` pairs used across `brightness_model.source`, `gauges[]`,
  `labels[]`, and `icons[]`. The change-detection guard in `set hass` and the end-of-update
  snapshot in `_update()` now track these attribute values in addition to entity states.
- **GUI editor not re-rendering when only `brightness_model` was added/modified** – the
  `setConfig` optimisation that skips re-rendering when array lengths are unchanged did not
  account for `brightness_model`. Adding or removing sources or filter-gradient stops on an
  existing card would leave the editor showing stale content. The `same` check now also
  compares `brightness_model.source.length` and `brightness_model.filter_gradient.length`.

---

## [0.5.0] – 2026-05-26

### Added
- **Redesigned `brightness_model`** – replaced the v0.4.3 additive brightness approach with a
  full **filter gradient interpolator** that blends between any number of named CSS filter stops
  (brightness, contrast, saturate, sepia, hue-rotate, blur, opacity, grayscale, invert) based
  on a normalised 0–100 % sensor value.  
  When `brightness_model` is active it **replaces** `filter_conditions` entirely — no stacking,
  no multiplicative conflicts.
  ```yaml
  brightness_model:
    source:
      - condition:                          # optional — use this source only when…
          entity: light.living_room
          operator: "="
          value: "on"
        entity: light.living_room
        attribute: brightness               # 0–255
        min_input: 0
        max_input: 255
      - entity: sensor.living_room_lux      # fallback (no condition = always matches)
        min_input: 0
        max_input: 800
    filter_gradient:
      - value: 0                            # 0 % → very dark / blue-ish
        filter: "brightness(0.25) sepia(0.3) hue-rotate(200deg)"
      - value: 50                           # 50 % → natural daylight
        filter: "brightness(1.0)"
      - value: 100                          # 100 % → overexposed / warm
        filter: "brightness(1.15) saturate(1.2)"
  ```
- **`source[]` array with per-entry conditions** – define multiple sensor/attribute sources;
  the first source whose `condition` evaluates to `true` (or whose condition is omitted) is
  used to derive the percentage.  Supports both light entity brightness attributes and
  arbitrary numeric sensors (lux, CO₂, temperature, …).
- **`lerpFilterGradient(stops, pct)`** – new module-level helper that parses each filter stop
  with the existing `parseFilterStr` / `buildFilterStr` / `FILTER_PROPS` infrastructure and
  linearly interpolates every CSS filter component between the two surrounding stops.
- **GUI editor for the redesigned `brightness_model`** – two collapsible sub-sections:
  - *Value sources* – entity, optional attribute, min/max input range, optional condition YAML
    (add/remove rows dynamically).
  - *Filter gradient stops* – value (0–100 %), filter string, add/remove rows.

### Changed
- `brightness_model` no longer adds a `brightness()` filter on top of `filter_conditions`.
  It now **replaces** `filter_conditions` when at least one source entity and one gradient
  stop are configured.  Leaving `brightness_model` empty (or unconfigured) falls back to the
  normal `filter_conditions` behaviour.

### Removed
- The v0.4.3 `brightness_model` fields (`entity`, `attribute`, `min_input`, `max_input`,
  `min_brightness`, `max_brightness`) are superseded by the new `source[]` /
  `filter_gradient[]` structure. Old configs using those fields will silently fall back to
  `filter_conditions` (the new code checks for `source` and `filter_gradient`).

---

## [0.4.3] – 2026-05-26

### Added
- **`brightness_model`** – maps a sensor value (lux, light brightness, etc.) to a CSS
  `filter: brightness()` applied on top of the base image in real time, making the room
  photo automatically darken at night and brighten during the day.
  Uses linear interpolation identical to `color_gradient`.
  Composes with `filter_conditions` — both run independently and their brightness factors
  stack in the CSS filter chain. Disabled automatically in FLIP test mode.
  ```yaml
  brightness_model:
    entity: sensor.living_room_lux
    min_input: 0          # lux → darkest
    max_input: 800        # lux → brightest
    min_brightness: 0.3   # CSS brightness() at min_input
    max_brightness: 1.1   # CSS brightness() at max_input
  ```
  Or using a light entity's brightness attribute (0–255):
  ```yaml
  brightness_model:
    entity: light.living_room
    attribute: brightness
    min_input: 0
    max_input: 255
    min_brightness: 0.25
    max_brightness: 1.0
  ```
- **GUI editor for `brightness_model`** – dedicated *Brightness model* section with fields
  for entity, attribute, min/max input range, and min/max brightness. Leave entity empty
  to disable.

---

## [0.4.2] – 2026-05-26

### Added
- **`orientation: horizontal` for `gauges[]`** – horizontal bar that fills left-to-right
  instead of the default bottom-to-top vertical bar. The `transition` default adjusts
  automatically (`width` instead of `height`).
  ```yaml
  gauges:
    - id: brightness_bar
      entity: light.living_room
      attribute: brightness
      min: 0
      max: 255
      orientation: horizontal
      width: "40%"
      height: "6px"
      top: "85%"
      left: "5%"
  ```
- Orientation dropdown added to the gauge GUI editor (`vertical` / `horizontal`).

---

## [0.4.1] – 2026-05-26

### Added
- **`visible_conditions` for `labels[]` and `gauges[]`** – show/hide an element based on
  entity state using the standard condition array syntax (first match wins).
  Falls back to the existing `visible` property if `visible_conditions` is not set.
  Gauges previously had no visibility control at all; both `visible` and `visible_conditions`
  are now supported for them.
  ```yaml
  labels:
    - id: frost_warning
      entity: sensor.outdoor_temp
      visible_conditions:
        - entity: sensor.outdoor_temp
          operator: "<"
          value: 2
          result: true
        - result: false

  gauges:
    - id: co2_bar
      visible_conditions:
        - entity: sensor.co2
          operator: ">"
          value: 800
          result: true
        - result: false
  ```
  Configured via the YAML textarea in the GUI editor (field label updated to include
  `visible` / `visible_conditions`).

---

## [0.4.0] – 2026-05-26

### Added
- **`animation` for `overlays[]`, `badges[]`, `labels[]`** – two CSS animation modes:
  - `pulse` – smooth opacity fade (1 → 0.25 → 1, 2 s, ease-in-out)
  - `blink` – hard on/off (1 s, step-end)
- **`animation_color`** – for `badges[]` and `labels[]`, adds a colored glow
  (`filter: drop-shadow`) when `pulse` is active; creates a "glowing badge/label" effect.
  ```yaml
  overlays:
    - id: alarm_overlay
      color: "rgba(255,0,0,0.35)"
      animation: pulse          # fades when overlay is visible

  badges:
    - id: alarm_badge
      icon: mdi:alarm-light
      animation: pulse
      animation_color: "#ff2222"   # red glow

  labels:
    - id: temp_label
      animation: blink             # hard blink (use sparingly)
  ```
- **GUI editor for animations** – dropdown `none / pulse / blink` on `overlays[]`,
  `badges[]` and `labels[]`; color picker for glow color on `badges[]` and `labels[]`.

---

## [0.4.x] – planned

- **`visible_conditions`** for `labels[]` and `gauges[]` – show/hide based on entity state
- **`orientation: horizontal`** for `gauges[]` – horizontal bar variant
- **`brightness_model`** – lux sensor or light entity brightness attribute →
  CSS `filter: brightness()` with linear interpolation (similar to `color_gradient`)

---

## [0.3.19] – 2026-05-25

### Added
- **`background`, `padding`, `border_radius`, `text_shadow` for `labels[]`** – labels can now
  be styled as a dark badge/chip overlay without needing external card types.

---

## [0.3.18] – 2026-05-25

### Fixed
- The `color_gradient` GUI editor for gauges was accidentally applied only to the dead copy of
  `_gaugeItem` on `RoomOverlayCard`, not to the actual editor class `RoomOverlayCardEditor`.
  The *Color Gradient Stops* section was therefore invisible in the GUI. Fixed — both copies of
  `_gaugeItem` and `_lblItem` are now identical and contain the correct gradient editor.

---

## [0.3.17] – 2026-05-25

### Added
- **`color_gradient` for `gauges[]` and `labels[]`** – smooth color interpolation based on
  entity value. Instead of discrete conditions, define a linear gradient between any number
  of color stops:
  ```yaml
  gauges:
    - id: temp_gauge
      entity: water_heater.boiler
      attribute: current_temperature
      min: 30
      max: 80
      color_gradient:
        - value: 30
          color: "#2196f3"   # blue (cold)
        - value: 55
          color: "#4caf50"   # green (optimal)
        - value: 70
          color: "#ff9800"   # orange (warm)
        - value: 80
          color: "#f44336"   # red (hot)
  ```
- **GUI editor for `color_gradient`** – both `gauges[]` and `labels[]` have a
  *Color Gradient Stops* section with rows (value + `<input type="color">` + remove button)
  and a **+ Stop** button to add new stops.

### Changed
- Internal helper functions `parseCssColor()` and `lerpColorGradient()` moved to module scope
  (shared between gauges and labels).

### Fixed
- Removed duplicate `const self` declaration inside `_collectConfig()` that caused a
  `SyntaxError` on card load.

---

## [0.3.16] – 2026-05-24

### Added
- **`attribute` support in `evalCond`** – conditions in `filter_conditions`, `overlays`,
  `zones`, `badges`, `labels` and `gauges` can now compare entity attributes instead of state:
  ```yaml
  conditions:
    - entity: water_heater.boiler
      attribute: current_temperature
      operator: ">"
      value: 60
      result: "orange"
  ```
- **Native `labels[]`** – text overlays positioned over the image; supports `entity`,
  `attribute`, `template`, `prefix`, `suffix`, `color`, `color_gradient`, `font_size`,
  `font_weight`, `position` (top/left as percentages).
- **Native `gauges[]`** – vertical value bars without dependency on `custom:button-card`
  (fixes broken height inheritance through shadow DOM); supports `entity`, `attribute`,
  `min`, `max`, `width`, `height`, `position`, `color`, `color_gradient`, `background`.

---

## [0.3.15] – 2026-05-23

### Added
- Initial `labels[]` and `gauges[]` sections (basic implementation without `color_gradient`).

### Fixed
- Embedded `custom:button-card` inside `elements[]` did not work as a gauge due to broken
  CSS height chain through the shadow DOM. Native `gauges[]` bypasses this issue.

---

## [0.3.14] – 2026-05-22

### Added
- **FLIP button in test mode** – toggles all overlays to their opposite state and applies
  the alternative base image filter; state persists across GUI editor changes.

### Fixed
- FLIP state was not reset on config edits (intentional — see 0.3.13 fix).

---

## [0.3.13] – 2026-05-22

### Fixed
- Syntax error (stray `i` character at end of file) causing
  *"Custom element doesn't exist: room-overlay-card"* after HACS installation.

---

## [0.3.12] – 2026-05-21

### Added
- Extended test mode with **⇄ FLIP** button – shows all overlays and the base image filter
  in the opposite state for quick visual testing without changing entity states.
