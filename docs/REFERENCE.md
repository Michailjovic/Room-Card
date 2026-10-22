# Configuration reference (generated)

[← Back to README](../README.md) · Guides: [Getting started](GETTING_STARTED.md) · [Configuration](CONFIGURATION.md) · [Studio](STUDIO.md) · [Overview](OVERVIEW.md) · [Floor plan](FLOORPLAN.md)

> **Generated from the config schema** (`src/schema/roc-schema.js`) by `tools/gen-docs.js` — do not edit by hand.
> It lists every key the card understands, its type, default and since which version. The
> linked guides explain what the keys do, with examples. The studio's config check uses the same
> schema: a key that is not here is reported as unknown.

**Notation.** *length* = a number (px) or a CSS length (`12%`, `24px`, `2.5vw`, `calc(…)`);
*template* = a string that may contain a Home Assistant (Jinja) template; *colour* = any CSS colour
or `var(--…)`; *prof* = one value, or `{portrait: …, landscape: …}` with one per layout profile.
**Room-scoped** keys can be set on a room or at the top level, where they are the default for
every room. Every element type also accepts its own keys under `portrait:` / `landscape:`
(per-profile overrides). Keys marked *v3* are migrated in memory when the card loads.

## Contents

- **Card and rooms:** [`card`](#t-card) · [`room`](#t-room) · [`roomEntity`](#t-roomentity) · [`parallax`](#t-parallax)
- **Layout:** [`layout`](#t-layout) · [`orientation`](#t-orientation) · [`layoutProfile`](#t-layoutprofile) · [`place`](#t-place) · [`region`](#t-region)
- **Shared values:** [`cond`](#t-cond) · [`condVal`](#t-condval) · [`action`](#t-action) · [`transform`](#t-transform) · [`spin`](#t-spin) · [`gradStop`](#t-gradstop) · [`baseImageCond`](#t-baseimagecond) · [`filterCond`](#t-filtercond) · [`weather`](#t-weather) · [`brightnessModel`](#t-brightnessmodel) · [`bmSource`](#t-bmsource) · [`bmStop`](#t-bmstop) · [`companion`](#t-companion)
- **Elements on the image:** [`overlay`](#t-overlay) · [`stateImage`](#t-stateimage) · [`overlayConds`](#t-overlayconds) · [`zone`](#t-zone) · [`slider`](#t-slider) · [`badge`](#t-badge) · [`icon`](#t-icon) · [`label`](#t-label) · [`gauge`](#t-gauge) · [`blind`](#t-blind) · [`coverControl`](#t-covercontrol) · [`coverPreset`](#t-coverpreset) · [`element`](#t-element) · [`glow`](#t-glow) · [`group`](#t-group) · [`vacuumWidget`](#t-vacuumwidget) · [`vacuumRef`](#t-vacuumref) · [`lightControls`](#t-lightcontrols) · [`lightEntity`](#t-lightentity)
- **Navigation:** [`nav`](#t-nav) · [`navMini`](#t-navmini) · [`navChip`](#t-navchip)
- **Sections (cockpit tiles):** [`section`](#t-section) · [`tile`](#t-tile) · [`quick`](#t-quick) · [`tileOverlay`](#t-tileoverlay)
- **Overview page:** [`overview`](#t-overview) · [`ovSignals`](#t-ovsignals) · [`ovHeader`](#t-ovheader) · [`ovHeaderItem`](#t-ovheaderitem) · [`ovPill`](#t-ovpill) · [`ovSide`](#t-ovside) · [`ovSideCard`](#t-ovsidecard) · [`ovGrid`](#t-ovgrid) · [`ovDock`](#t-ovdock) · [`overviewTile`](#t-overviewtile) · [`ovChip`](#t-ovchip)
- **Floor plan page:** [`floorplan`](#t-floorplan) · [`fpRoom`](#t-fproom) · [`fpLight`](#t-fplight) · [`fpOpening`](#t-fpopening) · [`fpItem`](#t-fpitem) · [`fpVacuum`](#t-fpvacuum) · [`fpTransform`](#t-fptransform) · [`fpLayers`](#t-fplayers) · [`fpEntity`](#t-fpentity) · [`fpBackground`](#t-fpbackground) · [`fpThemeBy`](#t-fpthemeby) · [`fpWall`](#t-fpwall) · [`fpSource`](#t-fpsource) · [`fpTrace`](#t-fptrace)

## Card and rooms

<a id="t-card"></a>

### The card (top level) — `card`

Every **room-scoped** key of [`room`](#t-room) is also valid here, as the default for every room. Guide: [CONFIGURATION.md](CONFIGURATION.md#top-level).

| Key | Type | Default | Notes |
|---|---|---|---|
| `type` | string |  | required |
| `card_id` | string |  |  |
| `layout` | [`layout`](#t-layout) |  |  |
| `aspect_ratio` | string, or `{portrait, landscape}` of it |  |  |
| `lock_aspect` | string **or** boolean |  |  |
| `border_radius` | length, or `{portrait, landscape}` of it |  |  |
| `image_fit` | `cover` · `contain`, or `{portrait, landscape}` of it |  |  |
| `image_align` | `top` · `center` · `bottom`, or `{portrait, landscape}` of it |  |  |
| `filter_transition` | string | `"2s ease"` |  |
| `rooms` | list of [`room`](#t-room) |  |  |
| `nav` | [`nav`](#t-nav) |  |  |
| `sections` | list of [`section`](#t-section) |  |  |
| `room_entity` | entity id **or** [`roomEntity`](#t-roomentity) |  |  |
| `room_state_entity` | entity id **or** [`roomEntity`](#t-roomentity) |  |  |
| `follow_mode` | `always` · `initial` · `manual` | `"always"` |  |
| `follow_hold` | number | `60` |  |
| `url_sync` | boolean **or** string |  |  |
| `test_mode` | boolean | `false` |  |
| `zoom` | boolean | `false` |  |
| `parallax` | boolean **or** [`parallax`](#t-parallax) |  |  |
| `haptic` | boolean | `true` |  |
| `hold_feedback` | boolean | `true` |  |
| `hold_color` | colour |  |  |
| `weather_nav_mini` | boolean |  |  |
| `grid_options` | object |  |  |
| `view_layout` | object |  |  |
| `card_mod` | object |  |  |
| `max_height` | any |  | v3 — migrated on load |
| `breakpoints` | any |  | v3 — migrated on load |
| `mobile_breakpoint` | any |  | v3 — migrated on load |

<a id="t-room"></a>

### A room (`rooms:` item) — `room`

Guide: [CONFIGURATION.md](CONFIGURATION.md#multi-room-one-card--whole-home).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  |  |
| `name` | string |  |  |
| `icon` | string |  |  |
| `area_match` | list of string **or** string |  |  |
| `chips` | list of [`navChip`](#t-navchip) |  |  |
| `nav_hidden` | boolean |  |  |
| `nav_mini` | boolean |  |  |
| `overview` | boolean **or** [`overview`](#t-overview) |  | since 6.30.0 |
| `overview_tile` | [`overviewTile`](#t-overviewtile) |  | since 6.30.0 |
| `floorplan` | boolean **or** [`floorplan`](#t-floorplan) |  | since 6.47.0 |
| `weather_nav_mini` | boolean |  |  |
| `base_image` | image URL |  | room-scoped |
| `base_camera` | entity id |  | room-scoped |
| `camera_refresh` | number | `10` | room-scoped |
| `base_image_conditions` | list of [`baseImageCond`](#t-baseimagecond) |  | room-scoped |
| `weather_overlay` | entity id **or** [`weather`](#t-weather) |  | room-scoped |
| `filter_conditions` | list of [`filterCond`](#t-filtercond) |  | room-scoped |
| `brightness_model` | [`brightnessModel`](#t-brightnessmodel) |  | room-scoped |
| `overlays` | list of [`overlay`](#t-overlay) |  | room-scoped |
| `zones` | list of [`zone`](#t-zone) |  | room-scoped |
| `badges` | list of [`badge`](#t-badge) |  | room-scoped |
| `elements` | list of [`element`](#t-element) |  | room-scoped |
| `icons` | list of [`icon`](#t-icon) |  | room-scoped |
| `labels` | list of [`label`](#t-label) |  | room-scoped |
| `gauges` | list of [`gauge`](#t-gauge) |  | room-scoped |
| `vacuum_widgets` | list of [`vacuumWidget`](#t-vacuumwidget) |  | room-scoped |
| `glows` | list of [`glow`](#t-glow) |  | room-scoped |
| `blinds` | list of [`blind`](#t-blind) |  | room-scoped |
| `groups` | list of [`group`](#t-group) |  | room-scoped |
| `tap_action` | [action](#t-action) |  | room-scoped |
| `cards_above` | list of [`companion`](#t-companion) |  | room-scoped |
| `cards_below` | list of [`companion`](#t-companion) |  | room-scoped |
| `light_controls` | [`lightControls`](#t-lightcontrols) |  | room-scoped |

<a id="t-roomentity"></a>

### Presence entity per browser / user — `roomEntity`

Guide: [CONFIGURATION.md](CONFIGURATION.md#multi-room-one-card--whole-home).

| Key | Type | Default | Notes |
|---|---|---|---|
| `default` | entity id |  |  |
| `by_browser` | object |  |  |
| `by_user` | object |  |  |

<a id="t-parallax"></a>

### Parallax — `parallax`

Guide: [CONFIGURATION.md](CONFIGURATION.md#top-level).

| Key | Type | Default | Notes |
|---|---|---|---|
| `source` | `auto` · `orientation` · `pointer` | `"auto"` |  |
| `strength` | number | `6` |  |
| `scale` | number | `1.04` |  |

## Layout

<a id="t-layout"></a>

### `layout:` — `layout`

Guide: [LAYOUT.md](../LAYOUT.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `height` | length **or** `viewport` · `fill` · `container` | `"viewport"` |  |
| `orientation` | `auto` · `portrait` · `landscape` **or** [`orientation`](#t-orientation) | `"auto"` |  |
| `threshold` | number | `1` |  |
| `gap` | length |  |  |
| `portrait` | [`layoutProfile`](#t-layoutprofile) |  |  |
| `landscape` | [`layoutProfile`](#t-layoutprofile) |  |  |

<a id="t-orientation"></a>

### `layout.orientation` (object form) — `orientation`

Guide: [LAYOUT.md](../LAYOUT.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `default` | `auto` · `portrait` · `landscape` |  |  |
| `by_browser` | object |  |  |

<a id="t-layoutprofile"></a>

### A layout profile (`layout.portrait` / `layout.landscape`) — `layoutProfile`

Guide: [LAYOUT.md](../LAYOUT.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `rows` | list of length |  |  |
| `columns` | list of length |  |  |
| `gap` | length |  |  |
| `place` | [`place`](#t-place) |  |  |

<a id="t-place"></a>

### `place:` — where each region goes — `place`

Guide: [LAYOUT.md](../LAYOUT.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `nav` | [`region`](#t-region) |  |  |
| `cards_above` | [`region`](#t-region) |  |  |
| `image` | [`region`](#t-region) |  |  |
| `lights` | [`region`](#t-region) |  |  |
| `cards_below` | [`region`](#t-region) |  |  |
| `cover` | [`region`](#t-region) |  |  |

<a id="t-region"></a>

### A placed region — `region`

Guide: [LAYOUT.md](../LAYOUT.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `row` | number **or** string |  |  |
| `col` | number **or** string |  |  |
| `align` | `stretch` · `start` · `center` · `end` |  |  |
| `overflow` | `hidden` · `auto` |  |  |

## Shared values

<a id="t-cond"></a>

### A condition — `cond`

Guide: [CONFIGURATION.md](CONFIGURATION.md#conditions).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `state` | any |  |  |
| `state_not` | any |  |  |
| `operator` | `<` · `>` · `<=` · `>=` · `==` · `!=` |  |  |
| `value` | any |  |  |
| `and` | [condition](#t-cond) |  |  |
| `or` | [condition](#t-cond) |  |  |

<a id="t-condval"></a>

### A conditional value (`condition` + `value`) — `condVal`

Guide: [CONFIGURATION.md](CONFIGURATION.md#conditions).

| Key | Type | Default | Notes |
|---|---|---|---|
| `condition` | [condition](#t-cond) |  |  |
| `value` | any |  |  |

<a id="t-action"></a>

### An action (`tap_action`, `hold_action`, `double_tap_action`) — `action`

With `action: fire-dom-event` the other keys are passed through unchecked. Guide: [CONFIGURATION.md](CONFIGURATION.md#action-types).

| Key | Type | Default | Notes |
|---|---|---|---|
| `action` | `none` · `navigate` · `url` · `more-info` · `toggle` · `call-service` · `perform-action` · `browser-mod-popup` · `toggle-group` · `show-group` · `hide-group` · `switch-room` · `next-room` · `prev-room` · `follow-room` · `open-section` · `close-section` · `fire-dom-event` |  |  |
| `entity` | entity id |  |  |
| `entity_id` | entity id |  |  |
| `navigation_path` | string |  |  |
| `path` | string |  |  |
| `url` | string |  |  |
| `url_path` | string |  |  |
| `new_tab` | boolean |  |  |
| `service` | string |  |  |
| `perform_action` | string |  |  |
| `data` | object |  |  |
| `service_data` | object |  |  |
| `target` | object |  |  |
| `title` | string |  |  |
| `size` | string |  |  |
| `content` | Lovelace card config |  |  |
| `room` | string **or** number |  |  |
| `section` | string |  |  |
| `group` | string |  |  |
| `confirmation` | boolean **or** object |  |  |
| `haptic` | string |  |  |
| `condition` | [condition](#t-cond) |  |  |
| `then` | [action](#t-action) |  |  |
| `else` | [action](#t-action) |  |  |

<a id="t-transform"></a>

### `transform:` — an overlay that moves with its entity — `transform`

Guide: [CONFIGURATION.md](CONFIGURATION.md#moving-an-overlay--transform).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `origin` | string |  |  |
| `transition` | string |  |  |
| `perspective` | length |  |  |
| `map` | object |  |  |
| `from` | object |  |  |
| `to` | object |  |  |
| `spin` | [`spin`](#t-spin) |  |  |

<a id="t-spin"></a>

### `transform.spin` — `spin`

Guide: [CONFIGURATION.md](CONFIGURATION.md#moving-an-overlay--transform).

| Key | Type | Default | Notes |
|---|---|---|---|
| `min_duration` | number **or** string |  |  |
| `max_duration` | number **or** string |  |  |
| `axis` | `x` · `y` · `z` |  |  |
| `reverse` | boolean |  |  |
| `min_value` | number |  |  |
| `max_value` | number |  |  |

<a id="t-gradstop"></a>

### A gradient stop (`color_gradient` item) — `gradStop`

Guide: [CONFIGURATION.md](CONFIGURATION.md#icons--labels).

| Key | Type | Default | Notes |
|---|---|---|---|
| `value` | number |  |  |
| `color` | colour |  |  |

<a id="t-baseimagecond"></a>

### A background image condition (`base_image_conditions` item) — `baseImageCond`

Guide: [CONFIGURATION.md](CONFIGURATION.md#conditions).

| Key | Type | Default | Notes |
|---|---|---|---|
| `image` | image URL |  |  |
| `condition` | [condition](#t-cond) |  |  |
| `value` | any |  |  |

<a id="t-filtercond"></a>

### A filter condition (`filter_conditions` item) — `filterCond`

Guide: [CONFIGURATION.md](CONFIGURATION.md#css-filter-engine).

| Key | Type | Default | Notes |
|---|---|---|---|
| `condition` | [condition](#t-cond) |  |  |
| `filter` | string |  |  |

<a id="t-weather"></a>

### `weather_overlay:` (object form) — `weather`

Guide: [CONFIGURATION.md](CONFIGURATION.md#camera-background--weather-effects).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `effect` | `auto` · `rain` · `snow` · `fog` · `lightning` |  |  |
| `opacity` | number |  |  |
| `z_index` | number |  |  |
| `angle` | number **or** string |  |  |

<a id="t-brightnessmodel"></a>

### `brightness_model:` — `brightnessModel`

Guide: [CONFIGURATION.md](CONFIGURATION.md#brightness-model).

| Key | Type | Default | Notes |
|---|---|---|---|
| `source` | list of [`bmSource`](#t-bmsource) |  |  |
| `filter_gradient` | list of [`bmStop`](#t-bmstop) |  |  |

<a id="t-bmsource"></a>

### `brightness_model.source` (object form) — `bmSource`

Guide: [CONFIGURATION.md](CONFIGURATION.md#brightness-model).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `min_input` | number | `0` |  |
| `max_input` | number | `100` |  |
| `condition` | [condition](#t-cond) |  |  |

<a id="t-bmstop"></a>

### A `brightness_model.filter_gradient` stop — `bmStop`

Guide: [CONFIGURATION.md](CONFIGURATION.md#brightness-model).

| Key | Type | Default | Notes |
|---|---|---|---|
| `value` | number |  |  |
| `filter` | string |  |  |

<a id="t-companion"></a>

### A companion card (`cards_above` / `cards_below` / `nav.cards` item) — `companion`

Open-ended: other keys are passed through unchecked. Guide: [CONFIGURATION.md](CONFIGURATION.md#companion-cards-above--below-the-image).

| Key | Type | Default | Notes |
|---|---|---|---|
| `card` | Lovelace card config |  |  |
| `media` | string |  |  |
| `height` | length |  |  |
| `type` | string |  |  |

## Elements on the image

<a id="t-overlay"></a>

### Overlay image (`overlays:` item) — `overlay`

Guide: [CONFIGURATION.md](CONFIGURATION.md#overlays).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `image` | image URL |  |  |
| `state_images` | list of [`stateImage`](#t-stateimage) |  |  |
| `conditions` | [`overlayConds`](#t-overlayconds) |  |  |
| `transition` | string |  |  |
| `z_index` | number |  |  |
| `animation` | `none` · `pulse` · `blink` |  |  |
| `color_from` | entity id |  |  |
| `transform` | [`transform`](#t-transform) |  | since 6.7.0 |
| `className` | string |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-stateimage"></a>

### `state_images` item — `stateImage`

Guide: [CONFIGURATION.md](CONFIGURATION.md#overlays).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `state` | any |  |  |
| `image` | image URL |  |  |

<a id="t-overlayconds"></a>

### `conditions:` of an overlay — `overlayConds`

Guide: [CONFIGURATION.md](CONFIGURATION.md#overlays).

| Key | Type | Default | Notes |
|---|---|---|---|
| `opacity` | list of [`condVal`](#t-condval) |  |  |
| `filter` | list of [`condVal`](#t-condval) |  |  |

<a id="t-zone"></a>

### Clickable zone (`zones:` item) — `zone`

Guide: [CONFIGURATION.md](CONFIGURATION.md#clickable-zones).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |
| `slider` | [`slider`](#t-slider) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-slider"></a>

### `slider:` of a zone — `slider`

Guide: [CONFIGURATION.md](CONFIGURATION.md#slider-zones).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `action` | string |  |  |
| `attribute` | string |  |  |
| `direction` | `horizontal` · `vertical` |  |  |
| `min` | number |  |  |
| `max` | number |  |  |
| `step` | number |  |  |
| `live` | boolean |  |  |
| `invert` | boolean |  |  |
| `color` | colour |  |  |
| `service` | string |  |  |
| `data` | object |  |  |

<a id="t-badge"></a>

### Status badge (`badges:` item) — `badge`

Guide: [CONFIGURATION.md](CONFIGURATION.md#status-badges).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `position` | `top-left` · `top-right` · `bottom-left` · `bottom-right` |  |  |
| `icon` | string |  |  |
| `icon_color` | colour **or** list of [`condVal`](#t-condval) |  |  |
| `label` | string **or** list of [`condVal`](#t-condval) |  |  |
| `label_template` | template |  |  |
| `animation` | `none` · `pulse` · `blink` |  |  |
| `animation_color` | colour |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-icon"></a>

### Icon (`icons:` item) — `icon`

Guide: [CONFIGURATION.md](CONFIGURATION.md#icons--labels).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `icon` | string **or** list of [`condVal`](#t-condval) |  |  |
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `size` | length |  |  |
| `color` | colour **or** list of [`condVal`](#t-condval) |  |  |
| `background` | colour |  |  |
| `chip` | boolean |  |  |
| `section_status` | boolean |  | since 6.16.0 |
| `animation` | string |  |  |
| `animation_color` | colour |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-label"></a>

### Label (`labels:` item) — `label`

Guide: [CONFIGURATION.md](CONFIGURATION.md#icons--labels).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `template` | template |  |  |
| `text` | string |  |  |
| `prefix` | string |  |  |
| `suffix` | string |  |  |
| `unit` | string |  |  |
| `decimals` | number |  |  |
| `format` | string |  |  |
| `unavailable_text` | string |  |  |
| `color` | colour **or** list of [`condVal`](#t-condval) |  |  |
| `color_gradient` | list of [`gradStop`](#t-gradstop) |  |  |
| `background` | colour |  |  |
| `padding` | string |  |  |
| `border_radius` | length |  |  |
| `font_size` | length |  |  |
| `font_weight` | string **or** number |  |  |
| `font_family` | string |  |  |
| `text_shadow` | string |  |  |
| `orientation` | string |  |  |
| `animation` | string |  |  |
| `animation_color` | colour |  |  |
| `alert_conditions` | [condition](#t-cond) |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-gauge"></a>

### Gauge (`gauges:` item) — `gauge`

Guide: [CONFIGURATION.md](CONFIGURATION.md#gauges).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `min` | number |  |  |
| `max` | number |  |  |
| `orientation` | `vertical` · `top` · `horizontal` · `left` · `right` · `radial` |  |  |
| `color` | colour |  |  |
| `color_gradient` | list of [`gradStop`](#t-gradstop) |  |  |
| `background` | colour |  |  |
| `border_radius` | length |  |  |
| `arc` | number |  |  |
| `thickness` | length |  |  |
| `target` | number **or** entity id |  |  |
| `target_color` | colour |  |  |
| `animation` | string |  |  |
| `animation_color` | colour |  |  |
| `alert_conditions` | [condition](#t-cond) |  |  |
| `transition` | string |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-blind"></a>

### Blind (`blinds:` item) — `blind`

Guide: [CONFIGURATION.md](CONFIGURATION.md#blinds).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `min` | number |  |  |
| `max` | number |  |  |
| `blind_type` | `roller` · `venetian` · `day_night` |  |  |
| `slat_color` | colour |  |  |
| `slat_count` | number |  |  |
| `slat_gap` | length |  |  |
| `slat_width` | length |  |  |
| `gap_color` | colour |  |  |
| `top_offset` | number |  | since 5.1.0 |
| `shift_turns` | number |  |  |
| `shift_start` | number |  |  |
| `shift_snap` | boolean |  |  |
| `shift_legacy` | boolean |  |  |
| `icon` | string |  |  |
| `label` | string |  |  |
| `label_template` | template |  |  |
| `value` | any |  |  |
| `animation` | string |  |  |
| `animation_color` | colour |  |  |
| `control` | boolean **or** [`coverControl`](#t-covercontrol) |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-covercontrol"></a>

### `control:` of a blind (cover control) — `coverControl`

Guide: [CONFIGURATION.md](CONFIGURATION.md#cover-control-roleta).

| Key | Type | Default | Notes |
|---|---|---|---|
| `placement` | boolean **or** `off` · `float` · `dock`, or `{portrait, landscape}` of it |  |  |
| `display` | boolean **or** `off` · `popover` · `float` · `dock`, or `{portrait, landscape}` of it |  | v3 — migrated on load |
| `slider` | boolean |  |  |
| `presets` | list of [`coverPreset`](#t-coverpreset) |  |  |
| `buttons` | any |  |  |
| `name` | string |  |  |
| `top` | length |  |  |
| `left` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `position` | string |  |  |

<a id="t-coverpreset"></a>

### A cover control preset — `coverPreset`

Guide: [CONFIGURATION.md](CONFIGURATION.md#cover-control-roleta).

| Key | Type | Default | Notes |
|---|---|---|---|
| `position` | number |  |  |
| `icon` | string |  |  |
| `color` | colour |  |  |
| `name` | string |  |  |

<a id="t-element"></a>

### Embedded card (`elements:` item) — `element`

Guide: [CONFIGURATION.md](CONFIGURATION.md#embedded-ha-cards).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `card` | Lovelace card config |  |  |
| `overflow` | string |  |  |
| `border_radius` | length |  |  |
| `background` | colour |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-glow"></a>

### Light glow (`glows:` item) — `glow`

Guide: [CONFIGURATION.md](CONFIGURATION.md#light-glow-light-spill-on-the-photo).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `entity` | entity id |  |  |
| `size` | length |  |  |
| `shape` | `circle` · `ellipse` · `wash` |  |  |
| `angle` | number **or** string |  |  |
| `intensity` | number |  |  |
| `falloff` | `soft` · `tight` · `wide` |  |  |
| `color` | colour |  |  |
| `fallback_color` | colour |  |  |
| `blend` | string |  |  |
| `animation` | `none` · `flicker` · `pulse` |  |  |
| `animation_speed` | string |  |  |
| `min_brightness` | number |  |  |
| `anchor` | `center` · `corner` |  |  |
| `transition` | string |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-group"></a>

### Group (`groups:` item) — `group`

Guide: [CONFIGURATION.md](CONFIGURATION.md#groups-pop-up-control-panels).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `grouping_code` | string **or** number |  |  |
| `style` | object |  |  |
| `visible` | boolean |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-vacuumwidget"></a>

### Vacuum status widget (`vacuum_widgets:` item) — `vacuumWidget`

Guide: [CONFIGURATION.md](CONFIGURATION.md#vacuum-status-widget).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `top` | length |  |  |
| `left` | length |  |  |
| `bottom` | length |  |  |
| `right` | length |  |  |
| `width` | length |  |  |
| `height` | length |  |  |
| `z_index` | number |  |  |
| `size` | length |  |  |
| `vacuums` | list of [`vacuumRef`](#t-vacuumref) |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `group` | string |  |  |
| `visible` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_conditions` | [condition](#t-cond) **or** list of [`cond`](#t-cond) |  |  |
| `visible_template` | template |  |  |
| `fade` | boolean **or** string |  |  |
| `slide` | boolean **or** string |  |  |
| `nav_mini` | boolean |  |  |
| `section` | string |  |  |
| `tile` | [`tile`](#t-tile) |  |  |

Per-profile overrides: `portrait`, `landscape`, `mobile`, `tablet`, `desktop`, `ultrawide` (the legacy tiers are migrated on load).

<a id="t-vacuumref"></a>

### A vacuum of the widget — `vacuumRef`

Guide: [CONFIGURATION.md](CONFIGURATION.md#vacuum-status-widget).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `name` | string |  |  |

<a id="t-lightcontrols"></a>

### `light_controls:` — `lightControls`

Guide: [CONFIGURATION.md](CONFIGURATION.md#light-controls-sliders-with-lux-ring).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entities` | list of [`lightEntity`](#t-lightentity) |  |  |
| `style` | `native` |  |  |
| `columns` | number |  |  |
| `height` | length, or `{portrait, landscape}` of it |  |  |
| `lux_sensor` | entity id |  |  |
| `lux_max` | number |  |  |
| `color_low` | colour |  |  |
| `color_high` | colour |  |  |
| `bg_off` | colour |  |  |
| `top` | length |  |  |
| `left` | length |  |  |

<a id="t-lightentity"></a>

### A light control entity — `lightEntity`

A bare `entity` string is accepted as the short form (`- light.kitchen`). Guide: [CONFIGURATION.md](CONFIGURATION.md#light-controls-sliders-with-lux-ring).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `name` | string |  |  |
| `icon` | string |  |  |

## Navigation

<a id="t-nav"></a>

### `nav:` — the room strip — `nav`

Guide: [CONFIGURATION.md](CONFIGURATION.md#multi-room-one-card--whole-home).

| Key | Type | Default | Notes |
|---|---|---|---|
| `style` | `thumbnails` · `tabs` · `dots` · `none` |  |  |
| `position` | `top` · `bottom` · `left` · `right` |  |  |
| `live` | `off` · `composite` · `full` · `custom` |  |  |
| `height` | length |  |  |
| `width` | length |  |  |
| `mobile_height` | length |  |  |
| `rows` | number, or `{portrait, landscape}` of it |  |  |
| `cards_position` | `side` · `below`, or `{portrait, landscape}` of it |  |  |
| `wheel` | boolean **or** `horizontal` · `vertical` · `both` |  |  |
| `follow_button` | boolean |  |  |
| `dim_inactive` | boolean |  |  |
| `chips` | list of [`navChip`](#t-navchip) |  |  |
| `cards` | list of [`companion`](#t-companion) |  |  |
| `mini` | [`navMini`](#t-navmini) |  |  |
| `auto_breakpoint` | any |  | v3 — migrated on load |

<a id="t-navmini"></a>

### `nav.mini` — `navMini`

Guide: [CONFIGURATION.md](CONFIGURATION.md#thumbnail-rows-and-the-strip-cards-v6250).

| Key | Type | Default | Notes |
|---|---|---|---|
| `width_ref` | number |  |  |
| `templates` | boolean |  |  |
| `camera_refresh` | number |  |  |

<a id="t-navchip"></a>

### A nav chip (`chips:` item) — `navChip`

A bare `entity` string is accepted as the short form (`- light.kitchen`). Guide: [CONFIGURATION.md](CONFIGURATION.md#multi-room-one-card--whole-home).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `template` | template |  |  |
| `icon` | string |  |  |
| `prefix` | string |  |  |
| `suffix` | string |  |  |
| `decimals` | number |  |  |
| `format` | string |  |  |
| `color` | colour |  |  |
| `color_gradient` | list of [`gradStop`](#t-gradstop) |  |  |
| `background` | colour |  |  |
| `border_radius` | length |  |  |
| `padding` | string |  |  |
| `active_state` | any |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |

## Sections (cockpit tiles)

<a id="t-section"></a>

### A section (`sections:` item) — `section`

Guide: [CONFIGURATION.md](CONFIGURATION.md#sections--panels-cockpit-tiles).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  | required |
| `title` | string |  |  |
| `icon` | string |  |  |
| `subtitle` | string |  |  |
| `placement` | `sheet-right` · `sheet-bottom` · `full` · `dialog` |  |  |
| `placement_portrait` | `screen` · `inline` |  |  |
| `size` | length |  |  |
| `columns` | number |  |  |
| `badge` | `auto` · `none` |  |  |
| `backdrop` | boolean |  |  |
| `visible_template` | template |  |  |
| `source` | `auto` |  |  |
| `domain` | string |  |  |
| `card` | Lovelace card config |  |  |
| `tiles` | list of [`tile`](#t-tile) |  |  |

<a id="t-tile"></a>

### A tile (`tiles:` item, or an element's `tile:`) — `tile`

Guide: [CONFIGURATION.md](CONFIGURATION.md#declared-tiles-tiles).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  |  |
| `name` | string |  |  |
| `entity` | entity id |  |  |
| `icon` | string |  |  |
| `icon_animation` | `none` · `spin` · `pulse` · `blink` |  |  |
| `state` | template |  |  |
| `state_class` | `auto` · `run` · `done` · `""` |  |  |
| `active_state` | any |  |  |
| `value` | template |  |  |
| `progress` | entity id |  |  |
| `progress_always` | boolean |  |  |
| `quick` | list of [`quick`](#t-quick) |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |
| `image` | image URL |  |  |
| `image_ratio` | string |  |  |
| `overlays` | list of [`tileOverlay`](#t-tileoverlay) |  |  |

<a id="t-quick"></a>

### A quick action of a tile — `quick`

Guide: [CONFIGURATION.md](CONFIGURATION.md#declared-tiles-tiles).

| Key | Type | Default | Notes |
|---|---|---|---|
| `name` | string |  |  |
| `icon` | string |  |  |
| `service` | string |  |  |
| `data` | object |  |  |
| `target` | object |  |  |

<a id="t-tileoverlay"></a>

### An image tile overlay — `tileOverlay`

Guide: [CONFIGURATION.md](CONFIGURATION.md#image-tiles).

| Key | Type | Default | Notes |
|---|---|---|---|
| `id` | string |  |  |
| `image` | image URL |  |  |
| `state_images` | list of [`stateImage`](#t-stateimage) |  |  |
| `conditions` | [`overlayConds`](#t-overlayconds) |  |  |
| `transition` | string |  |  |
| `transform` | [`transform`](#t-transform) |  |  |

## Overview page

<a id="t-overview"></a>

### `overview:` of a room — `overview`

Guide: [OVERVIEW.md](OVERVIEW.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `background` | image URL |  |  |
| `transition` | `zoom` · `fade` · `none` |  |  |
| `transition_duration` | number **or** string |  |  |
| `gap` | length |  |  |
| `padding` | length |  |  |
| `header` | [`ovHeader`](#t-ovheader) |  |  |
| `left` | [`ovSide`](#t-ovside) |  |  |
| `right` | [`ovSide`](#t-ovside) |  |  |
| `grid` | [`ovGrid`](#t-ovgrid) |  |  |
| `dock` | [`ovDock`](#t-ovdock) |  |  |
| `signals` | boolean **or** [`ovSignals`](#t-ovsignals) |  | since 6.48.0 |

<a id="t-ovsignals"></a>

### `overview.signals` — `ovSignals`

Guide: [OVERVIEW.md](OVERVIEW.md#cross-room-signals-v6480).

| Key | Type | Default | Notes |
|---|---|---|---|
| `presence` | boolean **or** entity id **or** list of [`fpEntity`](#t-fpentity) |  |  |
| `attention` | boolean | `true` |  |
| `vacuum` | boolean | `true` |  |

<a id="t-ovheader"></a>

### `overview.header` — `ovHeader`

Guide: [OVERVIEW.md](OVERVIEW.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `height` | length |  |  |
| `items` | list of [`ovHeaderItem`](#t-ovheaderitem) |  |  |

<a id="t-ovheaderitem"></a>

### A header item — `ovHeaderItem`

With `type:` it is a Lovelace card config (not checked). Guide: [OVERVIEW.md](OVERVIEW.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `pill` | [`ovPill`](#t-ovpill) |  |  |
| `nav_cards` | boolean |  |  |
| `card` | Lovelace card config |  |  |
| `width` | length |  |  |
| `media` | `landscape` · `portrait` · `all` |  |  |
| `type` | string |  |  |

<a id="t-ovpill"></a>

### A header pill — `ovPill`

Guide: [OVERVIEW.md](OVERVIEW.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `template` | template |  |  |
| `icon` | string |  |  |
| `prefix` | string |  |  |
| `suffix` | string |  |  |
| `decimals` | number |  |  |
| `format` | string |  |  |
| `color` | colour |  |  |
| `text` | string |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |

<a id="t-ovside"></a>

### `overview.left` / `overview.right` — `ovSide`

Guide: [OVERVIEW.md](OVERVIEW.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `width` | length |  |  |
| `portrait` | `top` · `bottom` · `hidden` |  |  |
| `cards` | list of [`ovSideCard`](#t-ovsidecard) |  |  |

<a id="t-ovsidecard"></a>

### A side column card — `ovSideCard`

With `type:` it is a Lovelace card config (not checked). Guide: [OVERVIEW.md](OVERVIEW.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `card` | Lovelace card config |  |  |
| `height` | length |  |  |
| `media` | `landscape` · `portrait` · `all` |  |  |
| `type` | string |  |  |

<a id="t-ovgrid"></a>

### `overview.grid` — `ovGrid`

Guide: [OVERVIEW.md](OVERVIEW.md#room-tiles).

| Key | Type | Default | Notes |
|---|---|---|---|
| `rooms` | list of string |  |  |
| `columns` | number, or `{portrait, landscape}` of it |  |  |
| `style` | `card` · `row`, or `{portrait, landscape}` of it |  |  |
| `live` | `inherit` · `full` · `custom` · `composite` · `off` |  |  |
| `width_ref` | number **or** `auto` |  |  |
| `chips_max` | number, or `{portrait, landscape}` of it |  |  |
| `info` | boolean |  |  |
| `names` | boolean |  | since 6.31.0 |
| `gap` | length |  |  |
| `fill` | boolean |  |  |
| `min_height` | length |  |  |
| `aspect_ratio` | string |  |  |

<a id="t-ovdock"></a>

### `overview.dock` — `ovDock`

Guide: [OVERVIEW.md](OVERVIEW.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `sections` | list of string |  |  |
| `size` | length |  |  |

<a id="t-overviewtile"></a>

### `overview_tile:` of a room — `overviewTile`

Guide: [OVERVIEW.md](OVERVIEW.md#room-tiles).

| Key | Type | Default | Notes |
|---|---|---|---|
| `name` | string |  |  |
| `hidden` | boolean |  |  |
| `focus` | string |  |  |
| `chips` | `auto` · `none` **or** list of [`ovChip`](#t-ovchip) |  |  |
| `show_name` | boolean |  | since 6.31.0 |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |
| `double_tap_action` | [action](#t-action) |  |  |
| `hold_delay` | number |  |  |

<a id="t-ovchip"></a>

### An overview tile chip — `ovChip`

A bare `entity` string is accepted as the short form (`- light.kitchen`). Guide: [OVERVIEW.md](OVERVIEW.md#room-tiles).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `icon` | string |  |  |
| `active_state` | any |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |

## Floor plan page

<a id="t-floorplan"></a>

### `floorplan:` of a room — `floorplan`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `theme` | `night` · `clay` · `neon` · `blueprint` · `thermal` · `tiles` · `sketch` | `"night"` |  |
| `theme_by` | [`fpThemeBy`](#t-fpthemeby) |  |  |
| `projection` | `auto` · `top` · `oblique` · `iso` | `"auto"` |  |
| `rotate` | number **or** `auto`, or `{portrait, landscape}` of it | `"auto"` |  |
| `mirror` | `none` · `horizontal` · `vertical` · `both` | `"none"` | since 6.49.0 |
| `quality` | `auto` · `high` · `low` | `"auto"` |  |
| `wall` | [`fpWall`](#t-fpwall) |  |  |
| `temperature_range` | list of number |  |  |
| `overrides` | object |  |  |
| `transition` | `zoom` · `fade` · `none` |  |  |
| `transition_duration` | number **or** string |  |  |
| `source` | [`fpSource`](#t-fpsource) |  |  |
| `trace` | [`fpTrace`](#t-fptrace) |  |  |
| `rooms` | list of [`fpRoom`](#t-fproom) |  |  |
| `openings` | list of [`fpOpening`](#t-fpopening) |  |  |
| `presence` | boolean **or** entity id **or** list of [`fpEntity`](#t-fpentity) |  | since 6.48.0 |
| `layers` | [`fpLayers`](#t-fplayers) |  | since 6.48.0 |
| `items` | list of [`fpItem`](#t-fpitem) |  | since 6.48.0 |
| `vacuums` | list of [`fpVacuum`](#t-fpvacuum) |  | since 6.50.0 |
| `attention_sections` | list of string |  | since 6.50.0 |
| `clean_mode` | `dry` · `wet` · `both` | `"dry"` | since 6.50.0 |
| `trail_mode` | `always` · `cleaning` | `"always"` | since 6.50.0 |
| `background` | [`fpBackground`](#t-fpbackground) |  | since 6.50.0 |

<a id="t-fproom"></a>

### A plan room (`floorplan.rooms` item) — `fpRoom`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `room` | string |  |  |
| `name` | string |  |  |
| `polygon` | list of values |  |  |
| `floor` | `wood` · `vinyl` · `tile` · `carpet` · `concrete` · `none` | `"wood"` |  |
| `floor_color` | colour |  | since 6.49.0 |
| `label_at` | list of number |  | since 6.50.0 |
| `anyvac_room` | string |  |  |
| `lights` | entity id **or** list of [`fpLight`](#t-fplight) |  |  |
| `climate` | entity id |  |  |
| `temperature` | entity id |  |  |
| `humidity` | entity id |  |  |
| `media` | entity id **or** list of [`fpEntity`](#t-fpentity) |  | since 6.48.0 |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |

<a id="t-fplight"></a>

### A plan room light — `fpLight`

A bare `entity` string is accepted as the short form (`- light.kitchen`). Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |

<a id="t-fpopening"></a>

### A door or window (`floorplan.openings` item) — `fpOpening`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `type` | `door` · `window` | `"door"` |  |
| `at` | list of number |  |  |
| `width` | number | `0.8` |  |
| `entity` | entity id |  | since 6.49.0 |
| `cover` | entity id |  | since 6.49.0 |
| `blind_type` | `roller` · `venetian` · `day_night` | `"roller"` | since 6.49.0 |
| `invert` | boolean |  | since 6.49.0 |
| `mirror` | boolean |  | since 6.49.0 |
| `outward` | boolean |  | since 6.49.0 |
| `tap_action` | [action](#t-action) |  | since 6.49.0 |
| `hold_action` | [action](#t-action) |  | since 6.49.0 |

<a id="t-fpitem"></a>

### A marker or label (`floorplan.items` item) — `fpItem`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `type` | `marker` · `label` | `"marker"` |  |
| `at` | list of number |  |  |
| `entity` | entity id |  |  |
| `attribute` | string |  |  |
| `icon` | string |  |  |
| `name` | string |  |  |
| `show_state` | boolean |  |  |
| `prefix` | string |  |  |
| `suffix` | string |  |  |
| `decimals` | number |  |  |
| `active_state` | any |  |  |
| `color` | colour |  |  |
| `size` | length |  |  |
| `text` | string |  |  |
| `tap_action` | [action](#t-action) |  |  |
| `hold_action` | [action](#t-action) |  |  |

<a id="t-fpvacuum"></a>

### A vacuum (`floorplan.vacuums` item) — `fpVacuum`

A bare `entity` string is accepted as the short form (`- light.kitchen`). Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |
| `transform` | [`fpTransform`](#t-fptransform) |  |  |
| `color` | colour |  | since 6.51.0 |
| `mop_color` | colour |  | since 6.51.0 |
| `mop_opacity` | number |  | since 6.51.0 |

<a id="t-fptransform"></a>

### `transform:` of a vacuum — `fpTransform`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `rotation` | number |  |  |
| `x` | number |  |  |
| `y` | number |  |  |
| `rooms` | number |  |  |
| `rms` | number |  |  |

<a id="t-fplayers"></a>

### `floorplan.layers` — `fpLayers`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `lights` | boolean | `true` |  |
| `heating` | boolean | `true` |  |
| `labels` | boolean | `true` |  |
| `presence` | boolean | `true` |  |
| `media` | boolean | `true` |  |
| `attention` | boolean | `true` |  |
| `vacuum` | boolean | `true` |  |
| `items` | boolean | `true` |  |
| `openings` | boolean | `true` | since 6.49.0 |
| `cleaning` | boolean | `false` | since 6.50.0 |
| `trail` | boolean | `true` | since 6.50.0 |

<a id="t-fpentity"></a>

### A presence / media entity — `fpEntity`

A bare `entity` string is accepted as the short form (`- light.kitchen`). Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `entity` | entity id |  |  |

<a id="t-fpbackground"></a>

### `floorplan.background` — the photo background — `fpBackground`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `image` | image URL |  |  |
| `x` | number |  |  |
| `y` | number |  |  |
| `scale` | number |  |  |
| `width_px` | number |  |  |
| `height_px` | number |  |  |
| `rotation` | number |  |  |
| `opacity` | number |  |  |
| `floors` | boolean |  |  |
| `fiducials` | list of values |  |  |
| `frame` | string |  |  |

<a id="t-fpthemeby"></a>

### `floorplan.theme_by` — `fpThemeBy`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `portrait` | `night` · `clay` · `neon` · `blueprint` · `thermal` · `tiles` · `sketch` |  |  |
| `landscape` | `night` · `clay` · `neon` · `blueprint` · `thermal` · `tiles` · `sketch` |  |  |
| `dark` | `night` · `clay` · `neon` · `blueprint` · `thermal` · `tiles` · `sketch` |  |  |
| `light` | `night` · `clay` · `neon` · `blueprint` · `thermal` · `tiles` · `sketch` |  |  |

<a id="t-fpwall"></a>

### `floorplan.wall` — `fpWall`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `height` | number |  |  |

<a id="t-fpsource"></a>

### `floorplan.source` — where the plan came from — `fpSource`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `anyvac` | entity id |  |  |
| `frame` | string |  |  |
| `imported` | string |  |  |
| `origin_px` | list of number |  |  |
| `mm_per_px` | number |  |  |

<a id="t-fptrace"></a>

### `floorplan.trace` — the image traced in the studio — `fpTrace`

Guide: [FLOORPLAN.md](FLOORPLAN.md).

| Key | Type | Default | Notes |
|---|---|---|---|
| `image` | image URL |  |  |
| `x` | number |  |  |
| `y` | number |  |  |
| `scale` | number |  |  |
| `width_px` | number |  |  |
| `height_px` | number |  |  |
| `opacity` | number |  |  |

