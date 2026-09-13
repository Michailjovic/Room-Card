# v6.15.5 — editor: structured fields for cockpit tiles (B2)

Fourth release implementing `BUG_UX_ANALYSIS_v6.15.1.md`'s findings, continuing Part 2 (the editor
GUI/UX review) — see [RELEASE_NOTES_v6.15.2.md](RELEASE_NOTES_v6.15.2.md),
[RELEASE_NOTES_v6.15.3.md](RELEASE_NOTES_v6.15.3.md) and
[RELEASE_NOTES_v6.15.4.md](RELEASE_NOTES_v6.15.4.md) for the 14 Part 1 bugs and Part 2's B1/C1
already shipped. This release covers the report's "Suggested order" item 4: **B2** (structured form
fields for cockpit tiles, replacing one combined YAML box).

## Why this one was safe to do in full (unlike B1)

B1 (real `<ha-yaml-editor>` components) carries genuine risk — this project's own memory has the
scar tissue from an earlier attempt to embed a different HA Lit component the same way. That's why
v6.15.4 shipped it as a one-box spike, not a rollout, and asked for it to be confirmed live before
going further.

B2 carries none of that risk: every input it adds (`<input type="text">`, `<select>`) is exactly the
same kind of plain, native form control this editor has always used everywhere else — the same
pattern as the editor's existing Entity/Image/Aspect-ratio fields (a `datalist`-backed text input,
not a Lit custom element). So this release applies B2 everywhere a tile can appear, not just to one
box.

## What changed

Every cockpit tile — a tagged element's `tile:` (zones, icons, elements, blinds tagged into a
section) and a section's own declared `tiles:` — now gets real fields for:

- **Name**, **Entity** (with the same entity datalist every other entity field uses), **Icon**
  (text field, `mdi:...`)
- **Icon animation** (a select: none / spin / pulse / blink)
- **Active state** (text — e.g. `"on"`, `"running"`)
- **State class** (a select: auto / force Run / force Done)
- **Value text** (optional override of the live entity state text)
- **Progress entity** (optional 0–100 sensor for the tile's progress bar)
- **Quick actions** — a repeatable list of icon/label/service/target rows, with `+ Quick action` /
  `×` buttons to add or remove one

The leftover YAML box under each tile (previously the single place all of this lived) now holds only
whatever isn't one of the fields above — in practice, `tap_action` / `hold_action` / `hold_delay` /
`double_tap_action`, the same "actions" category the report calls out as YAML's biggest remaining
footprint on tiles. `id`, `image`, `image_ratio` and `overlays` are unaffected — they already had
their own dedicated fields before this release and stay exactly as they were.

## How it stays safe (the KEEP-list pattern, again)

This reuses the exact mechanism bug #2 established for element fields (`EL_DEDICATED_KEYS`): a
`TILE_DEDICATED_KEYS` list names every key with its own field. On collect, the tile is rebuilt from
whatever the leftover YAML box currently says, then every dedicated key is deleted and re-applied
from its own field — so a stale key removed from the box is removed from the tile too, and the
dedicated fields always win over anything (accidentally or otherwise) typed into the box. An invalid
box still keeps the tile's last-good state; it just can't touch the dedicated fields either way.

Quick actions get their own version of the same care: each row is rebuilt from a shallow copy of its
*own previous* full object, so a `data:` key, or a `target:` too complex for the simplified
single-entity field (e.g. multiple entities, an area/device target), is only overwritten when the
target field's value actually differs from what that field would show for the current target — never
silently dropped just because you edited the icon next to it.

## Verified

`npm test` (all three tiers) passes, including 9 new regression tests: prefill of every dedicated
field from an existing tagged-element tile; the leftover box containing only the non-dedicated key
(`hold_action`) and nothing else; quick-action row prefill (including one carrying a `data:` key the
target field can't represent); editing a dedicated field round-trips without disturbing the leftover
box; editing the leftover box round-trips without disturbing the dedicated fields; an invalid
leftover box keeps every dedicated field and the quick actions unchanged; editing only a quick
action's icon preserves its `data:` and `target`; and the `+`/`×` quick-action buttons correctly
resolve and mutate the right tile (`_tileRefForKey`, covering both a tagged element's `item.tile` and
a section's own declared tile). All 4 reproduction probes were re-run: unchanged from v6.15.4 (no new
regressions). `npm run build:verify` (the minified `dist/` build against the same three test tiers)
also run clean.
