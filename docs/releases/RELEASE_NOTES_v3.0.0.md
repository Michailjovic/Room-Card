# Room Overlay Card v3.0.0

**The roadmap-completion release.** Everything that used to be YAML-only in the
editor now has a proper GUI, the two image-filter systems are unified behind a
single mode switch, rooms can be shared and bookmarked through the URL, and the
finger-drag preview now shows the *real* neighbouring room. This release also
folds in everything shipped since 2.0.0 (the v2.1–v2.2 line).

**Fully backwards compatible** with all 2.x configs. `url_sync` is opt-in, so
nothing changes unless you enable it.

---

## ✨ Highlights since 2.0.0

### Editor — GUI completeness (3.0.0)
- **Navigation menu is fully editable in the GUI.** The single `nav:` YAML
  textarea is replaced by structured fields — **style**, **position**,
  **height**, **item width**, **mobile height**, **auto breakpoint**, **wheel
  switch**, and a **follow-button** toggle. Chips and custom strip cards stay as
  YAML lists (they're arbitrary configs), and invalid YAML in those two fields is
  now preserved instead of wiped.
- **Dedicated per-tier inputs** for `aspect_ratio`, `border_radius` and
  `max_height` — one cell per tier (mobile / tablet / desktop / ultrawide) in the
  *Responsive* tab. A single value still applies to all tiers.
- **Unified image-filter section.** `filter_conditions` (discrete, first-match)
  and `brightness_model` (smooth interpolation from a sensor) are now one
  **Image filters** section with a **Conditional / Smooth** mode switch. The
  switch is authoritative — saving keeps only the active mode and drops the
  other, so what you pick is what runs at runtime (no more silent
  `brightness_model`-always-wins surprises).
- **"Advanced" toggle.** Each element's raw per-item YAML textarea is hidden
  behind a global **Advanced** checkbox in the editor header, keeping the common
  path clean.

### New features (3.0.0)
- **URL deep-linking — `url_sync`.** Opt-in. `url_sync: true` keeps the active
  room in the page URL as `#room=<id>` (`url_sync: <key>` for a custom hash key).
  Rooms become **bookmarkable and shareable** — a `#room=bedroom` link opens
  straight on that room and holds it against presence for `follow_hold`. Every
  switch (swipe, wheel, nav, presence) rewrites the hash, and the card reacts to
  browser back/forward and manual hash edits. The value matches a room `id`,
  `name` or `area_match`. Editable from the *Rooms & menu* tab.
- **Full-room finger-drag preview.** While you drag between rooms, the incoming
  neighbour is a **fully rendered room** — background, brightness/darkness
  filters, overlays, icons, gauges and live entity states — instead of just the
  static base image.
- **Conditional follow button.** The nav follow button appears only on devices
  that resolve `room_entity` to a real presence sensor via an explicit
  `by_browser` / `by_user` mapping. Devices with no usable presence source no
  longer show a button that can't do anything. A plain-string `room_entity` still
  applies everywhere.

### Responsive & reliability (2.1–2.2, included since 2.0.0)
- **`lock_aspect` — keep overlays glued to the image across every tier.** Builds
  a fixed-design-aspect stage that covers the per-tier box, so percentage-placed
  zones/icons/blinds stay locked to image features; per-tier `aspect_ratio` then
  only changes *how much* of the image is cropped, not *where* elements sit.
  `true` auto-detects the design shape from the base image; or pin it explicitly
  (e.g. `lock_aspect: "1720/968"`). In multi-room cards every room's image is
  measured separately, so each room locks to its own background.
- **Mouse-wheel room switching** on desktop — `nav.wheel: horizontal | vertical |
  both`. One notch = one room (wraps around), counts as a manual switch, and
  leaves `Ctrl`+wheel reserved for zoom.
- **Rock-solid test-mode Save.** Save now searches the *entire dashboard* (every
  view, section and nested stack/grid) and matches by `card_id`, instead of only
  the view in the current URL — fixing the intermittent "card not found" saves
  after navigating or switching rooms.

---

## 📋 Full version history (2.0.0 → 3.0.0)

### 3.0.0 — 2026-06-20
- Nav/menu GUI block (structured fields; chips/cards stay YAML).
- Per-tier inputs for `aspect_ratio` / `border_radius` / `max_height`.
- Unified image-filter section with Conditional/Smooth mode switch.
- "Advanced" toggle hides per-item YAML textareas.
- `url_sync` URL deep-linking (`#room=<id>`), with GUI control.
- Full-room render in the finger-drag neighbour preview.
- Conditional nav follow button (only on presence-mapped devices).

### 2.2.0 — 2026-06-13
- Mouse-wheel room switching (`nav.wheel: horizontal | vertical | both`).

### 2.1.3 — 2026-06-13
- Fixed intermittent test-mode Save — searches the whole dashboard and matches
  by `card_id` (no longer URL-view dependent). Clearer error messages.

### 2.1.2 — 2026-06-13
- Fixed `lock_aspect` doing nothing in multi-room cards (vertical drift): every
  room's image is now measured, not just the root `base_image`.

### 2.1.1 — 2026-06-13
- `lock_aspect: true` caches each image's natural aspect separately, so
  different-resolution per-room backgrounds each lock correctly.

### 2.1.0 — 2026-06-13
- `lock_aspect` — fixed-design-aspect stage so percentage-positioned elements
  stay glued to the image across every responsive tier.

### 2.0.0 — 2026-06-13
- The "one card rules them all" milestone: responsive tiers (mobile / tablet /
  desktop / ultrawide) from a single card, `max_height` height cap, a fully
  reorganised tabbed editor, drag-edit preview, hold-gesture feedback, and a
  decluttered test mode.

---

## 🔄 Compatibility
- Backwards compatible with all 2.x configs.
- The unified filter editor opens existing cards in the correct mode based on
  whether they use `brightness_model` or `filter_conditions`.
- `url_sync` is opt-in — enable it only if you want room state in the URL.
- Verified against Home Assistant 2026.6. Minimum HA stays at 2023.9.0;
  newer-only features degrade gracefully.

## 📦 Install
Via HACS (custom repository) or copy `room-overlay-card.js` to
`/config/www/` and add it as a dashboard resource
(`/local/room-overlay-card.js`, type: JavaScript Module).
