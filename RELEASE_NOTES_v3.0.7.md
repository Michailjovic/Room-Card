# v3.0.7 — Code-review release: 10 bug fixes, leaner updates, tablet resize

This release implements the findings of a full-source review (`ANALYSIS_v3.0.6.md`). No new config keys — everything is a fix or a free upgrade.

## Fixes

- **Per-room `base_camera` works now.** Cameras defined inside `rooms[]` never started their refresh timer; the camera loop now uses the active-room view.
- **Keyboard focus is visible** on zones, icons, labels and gauges (`:focus-visible` outline; touch/mouse look unchanged).
- **Resize by touch.** Test-mode resize handles switched to Pointer Events — works on tablets now.
- **Safer sliders.** Climate/number sliders take min/max from entity attributes (`min_temp`/`max_temp`, `min`/`max`) instead of blindly using 0–100.
- **Numeric `aspect_ratio`** (e.g. `1.78`) is honored everywhere instead of silently falling back to 16/9.
- **Off-screen freshness.** Embedded cards keep receiving `hass` while the card is scrolled out, so nothing looks stale when you scroll back.
- Escaped element ids / image URLs in generated HTML & selectors (+ a one-time warning for exotic ids), fixed a swallowed tap after a cancelled swipe, stopped the swipe ghost from opening template/camera subscriptions, fixed stale async card mounts after fast re-renders, `navigate` fires HA's canonical `location-changed`, and unquoted Jinja in YAML textareas is no longer mangled.

## Performance

- **Active-room-scoped change detection** — busy sensors in *other* rooms now trigger a cheap nav-thumbnail refresh instead of the full update pass.
- Overlays no longer force permanent GPU layers (`will-change`/`translateZ` removed).
- Staged image preload: active room + neighbours now, the rest on browser idle.
- Editor: cached entity datalist, native `structuredClone`, and saved YAML no longer includes default values (`test_mode: false`, `min: 0` / `max: 100`, `size: 20px`, empty arrays…).

## Added

- **Slider value bubble** — zone sliders show a live "72 %" / "21.5 °" readout while dragging.
- New smoke tests for the added helpers.

**Full Changelog**: https://github.com/Michailjovic/Room-Card/blob/main/CHANGELOG.md
