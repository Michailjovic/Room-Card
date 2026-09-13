# v6.15.2 — fix: six bugs from the v6.15.1 bug/UX audit (patch 1 of 2)

A full bug and editor-UX audit of the codebase (`BUG_UX_ANALYSIS_v6.15.1.md`) found 17 issues.
This is the first of two planned patch releases implementing that report's fixes, covering the six
smallest and most independent items — the recommended rollout order put these first because two of
them (cross-room cockpit tiles, and the editor's element-override data loss) are the ones any
multi-room cockpit or per-profile setup would hit immediately. The remaining eleven items (badge
gesture wiring, the YAML box parser, `glows[].visible`, layout/UX polish, …) are tracked for the
next patch and beyond — see the audit doc's "Suggested order" section.

## 1. Cockpit tiles didn't update live unless the entity belonged to the active room

### Root cause

`_render()` builds the incremental change-detection set (`_relevantEntities` /
`_relevantAttrSources`) from the **merged active room only** (`c = roomMerge(cAll, roomIdx)`).
Cockpit sections are deliberately cross-room — a section can be filled by tagging elements
anywhere, plus `source: auto` (derived straight from `hass.states`, no element at all) and each
tile's own `progress:` sensor — but none of that lives in `c`:

| Tile source | Entity lives in | Live update while the panel was open |
|---|---|---|
| tagged element in the **active** room | `c` | worked |
| tagged element in **another** room | `cAll.rooms[j]` | never |
| `source: auto` | config-less (`hass.states` only) | never |
| any tile's `progress: sensor.x` | key is `progress`, not `entity` — `_extractEntities` doesn't look for it | never |

`set hass(h)` returns early whenever nothing in that set changed, so `_update()` →
`_updateSectionTiles()` silently never ran for these three cases. A washer tile tagged in from
another room could sit on "idle" forever while the real washer was running, with the panel open the
whole time.

### The fix

`_render()` already resolves and caches every section's tile list (`_secResolvedTiles`, added for
`source: auto` in v6.10.0). It now also walks that resolved list once, adding each tile's `entity`,
`progress`, and any overlay entities into the same relevant-entity set the active room populates.
This makes any tile's entity trigger a full update pass, which is fine — `_updateSectionTiles()`
itself already early-outs when no panel is open, so idle cross-room sensors cost nothing beyond one
extra Set membership check per render.

No configuration change.

## 2. The editor deleted an element's `portrait:`/`landscape:` overrides on save

### Root cause

Every item type's "everything else" YAML box is built as *"clone the item, delete the fields that
have their own dedicated input"* — except `_elItem()` (elements), which instead built it from a
hand-maintained **whitelist**: `card, visible, visible_template, fade, slide, mobile, z_index,
border_radius, overflow`. `portrait:` and `landscape:` (the v4 per-profile override fields) were
never added to that list, so `_collectConfig()` — which deletes anything not surviving the YAML
round-trip — dropped them the moment the editor re-collected the config for *any* reason (opening
Edit mode was enough). The same whitelist-drift risk applied to any future element key.

### The fix

`_elItem()` now builds its YAML box the same way `_lblItem`/`_gaugeItem`/`_vwItem`/`_glowItem`/
`_badgeItem` already do: a full clone of the element with only the dedicated-field keys removed.
That field list (`id, top, bottom, left, width, height, group, nav_mini, section, tile`) is now a
single shared constant (`EL_DEDICATED_KEYS`) used by both `_elItem()` and `_collectConfig()`, so the
two can't drift apart again the way the whitelist did.

**If you have existing elements using `portrait:`/`landscape:` overrides**, they were being
silently dropped every time you opened the GUI editor and it re-saved — re-check them after
updating; nothing under v6.15.2 will drop them further, but anything already lost needs re-entering.

## 3. "Save migrated config" threw instead of saving

### Root cause

The migration banner's Save button (shown when a v3 config is auto-migrated to the v4 layout
engine) was wired in `_render()` with `fire()` — a name that only exists as a local `const` inside
the unrelated `_listen()` method's closure. Clicking the button raised a `ReferenceError` in the
console and never saved anything; the only way to actually persist the migration was to make some
other unrelated edit.

### The fix

The click handler now calls `self._fire(self._collectConfig())` directly (the same call `fire()`
used to wrap) and then `self._render()`, so the banner also disappears immediately once saved.

## 4. Tapping inside an open cockpit panel could also fire the room's `tap_action`

### Root cause

`ha-card`'s click handler runs the room's own `tap_action` unless the click landed on one of a
known list of interactive element classes (zones, elements, icons, badges, the test-mode flip/save
buttons). Section panels (v6.8.0) and their backdrop were never added to that list, so clicking a
panel's header, an untappable tile, or the backdrop (to close it) also fired the room behind it.

### The fix

`roc-panel` and `roc-panel-backdrop` were added to the exclusion list.

## 5. An icon with only `hold_action:`/`double_tap_action:` was completely inert

### Root cause

Zones already treat any of `tap_action`/`hold_action`/`double_tap_action`/`slider` as "this element
is interactive" when deciding on `tabindex`/`role`/cursor and whether to wire up gesture listeners
at all. Icons instead checked `tap_action` alone in both places — an icon configured with only
`hold_action` (a common "long-press for more-info" pattern) got no pointer cursor, no keyboard
focusability, and `_addZoneListeners()` was never even called on it, so neither the mouse nor the
keyboard path could trigger it.

### The fix

Both the render-time accessibility attributes and the listener-wiring condition now check
`ico.tap_action||ico.hold_action||ico.double_tap_action`, matching how zones already behave.

## 6. Hardcoded Czech string in an English UI

The empty-section-panel placeholder ("nothing tagged into this section yet") was left in Czech from
early development. Replaced with the same English copy the rest of the card/editor uses.

---

No configuration changes in any of these six fixes — every one is a pure bug fix, safe to update
without touching YAML.

**Verified:** `npm test` (all three tiers — `smoke.test.js`, `render.test.js`, `lifecycle.test.js`)
passes, including new regression cases added for all six fixes. All 17 reproduction probes from the
audit (`tests/probes/probe_sections.js`, `probe_editor.js`, `probe_card2.js`, `probe_misc.js`) were
re-run: the six targeted here now PASS, and none of the eleven still-open items regressed further.
`npm run build:verify` (the minified `dist/` build against the same three test tiers) was also run
clean.
