# v5.9.11 — Editor Layout tab: sub-tabs, live mini grid preview, and a real live-preview fix

Part of the ongoing editor GUI/UX revalidation ([`EDITOR_UX_REVALIDATION.md`](EDITOR_UX_REVALIDATION.md)).
This pass covers the Layout tab (proposal 7 — "Live preview for the Layout tab") plus two smaller
usability wins for the same tab. The Elements tab's alphabetical-with-icons ordering (proposal 1)
was reviewed and kept as-is for now — it reads fine as is.

## What's new

**Portrait / Landscape sub-tabs.** The two profile editors (each a full set of row/column %
fields plus six region placements) used to render stacked one after another — a long scroll, and
easy to edit the wrong profile by mistake. They're now behind a small pill toggle, same pattern as
the top-level Image/Elements/Layout/Rooms&menu tabs. Both profiles stay mounted underneath so
field values and focus survive switching — only visibility toggles.

**Illustrative mini grid preview.** Each profile box now shows a small color-coded diagram of its
regions (Nav / Cards↑ / Image / Lights / Cards↓ / Cover), built from the same `rocGridCss`/
`rocRegionCss` functions the real card uses to lay itself out — so the diagram can't drift out of
sync with actual CSS Grid semantics, including the `1/6` grid-line span syntax that's otherwise
easy to get wrong sight-unseen. It repaints on every keystroke via a direct `innerHTML` swap of
just the preview box (same technique as the existing Light Controls gradient preview), so typing
never loses focus or triggers a full editor re-render. Purely a visual aid in the editor form —
doesn't touch the real card.

## Fix: Layout tab edits weren't reaching the Edit-mode live preview card

Before building anything new, checked whether the existing Edit-mode preview (the real,
interactive `room-overlay-card` instance mounted in the editor when Edit mode is on) already
reflected Layout tab changes — it didn't, not even after clicking away from the field. Root cause:
the editor's `setConfig()` only remounts that preview instance when an item-count diff (zones /
icons / labels / badges / etc. array lengths) says something changed; `layout` was never part of
that comparison, so a Layout-only edit could never trigger a remount.

Added a dedicated debounced path that pushes the freshly-collected config straight into the
mounted preview card's `setConfig()`, bypassing the editor's own DOM re-render entirely. Layout
field edits now reach the live preview in ~150ms, without touching input focus.

## Compatibility

No config schema changes — editor-only. Existing `layout:` blocks render identically.

## Testing

9 new jsdom render tests: sub-tab buttons present and default to Portrait, clicking Landscape
shows/hides the right panel, both mini-preview divs render, the landscape preview is pre-filled
from an auto-migrated config, typing a region's row live-repaints its mini preview without losing
the field's own value, and — after the debounce window — a Layout tab edit (input, no blur)
reaches the mounted Edit-mode preview card's config. Full smoke + render suites green (0 FAIL).
The Playwright e2e suite is unaffected (its 6 specs test main-card geometry, not the editor) but
couldn't be run in this environment — the Chromium binary failed to install offline; unrelated to
this change.
