# Room Overlay Card v4.5.2

Portrait now sizes itself naturally, and two landscape/edit-mode scroll issues are fixed — all diagnosed against a live dashboard before implementing.

## ✨ What's new

### Portrait: natural content height instead of forced full-screen fill

`layout: height: viewport` (the default) used to force portrait to stretch every region to fill the entire available screen height, even though width is the actual limiting factor in portrait. Any extra vertical space just got proportionally distributed across the nav/lights/cards rows instead of being left alone.

Portrait now sizes itself from its own content: full width, image at its configured design aspect, every other region its natural size. If the result is shorter than the screen, the remainder is simply left blank — nothing is stretched to fill it.

**Landscape is unchanged** — it keeps the original "fill the screen" behavior, since that's the intended kiosk/wall-tablet use case. An explicit `layout: height: container` or a fixed CSS length is still respected in either profile.

## 🐛 Bug fixes

### Edit-mode "card actions" bar no longer requires scrolling to reach

When editing a dashboard, Home Assistant wraps the edited card in its own `hui-card-options` element and appends a real actions bar (Edit / Move to view / …) directly after it — not as an overlay, as an actual sibling in the layout. Since the card correctly fills to the exact screen edge in `viewport` height mode, that bar always ended up needing a scroll to reach.

The card now detects HA's own edit-mode state and reserves the actions bar's live-measured height (never a hardcoded pixel value), so the bar is visible without scrolling. This is best-effort: it reads HA's internal (non-public) DOM structure, verified against a live 2026-07 HA build. If a future HA release changes that structure, this silently falls back to today's behavior rather than breaking anything.

### Sub-pixel scrollbar in landscape

Even outside edit mode, the view container can render a fraction of a pixel taller than the actual viewport — a rounding artifact, not a real layout gap. The pinned card height used to round to the nearest pixel (`Math.round`), which could round up and trigger a 1px scrollbar. It now rounds down (`Math.floor`) instead, so the card only ever errs a fraction of a pixel short of the screen edge — never long enough to trigger a scrollbar.

## 🧪 Tests
174 smoke + 41 jsdom render tests pass (4 new: portrait natural-height pin, forced wrap aspect-ratio on a plain `%` row, explicit `layout.height: container` still honoured, edit-bar helper safe no-op).

## ⬆️ Upgrade
Drop-in replacement for 4.5.1. No config changes required. If you were relying on portrait always stretching to fill the screen, note the height behavior there has intentionally changed — see above.
