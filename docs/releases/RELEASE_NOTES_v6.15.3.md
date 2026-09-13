# v6.15.3 — fix: eight more bugs from the v6.15.1 bug/UX audit (patch 2 of 2)

Second of the two planned patch releases implementing `BUG_UX_ANALYSIS_v6.15.1.md`'s findings (see
[RELEASE_NOTES_v6.15.2.md](RELEASE_NOTES_v6.15.2.md) for the first six). This one covers the
remaining independent, self-contained items — badge gesture wiring, `glows[].visible`, a
keyboard-handler leak, id/checkbox/editor-control cleanups, a docs fix, and three small housekeeping
items. The report's three larger items (replacing the hand-rolled YAML box parser with
`<ha-yaml-editor>`, structured tile forms for zones/icons/labels/gauges/blinds, the stale editor
preview on scalar edits, and drag-drop editor perf) are tracked for later stages — see the audit
doc's "Suggested order" section.

## 1. Badges bypassed `_addZoneListeners`

### Root cause

Every other tappable element type (zones, icons, labels, gauges, blinds, vacuum widgets, section
tiles) is wired through the shared `_addZoneListeners(el, tap_action, hold_action,
double_tap_action, hold_delay)` helper, which handles tap-vs-scroll detection, `hold_action`,
`double_tap_action`, the hold-progress ring, keyboard activation, and the a11y attributes
(`tabindex`/`role`) together. Badges instead wired `click` and `touchend` straight to `_exec()`.
Consequences: the existing scroll-vs-tap fix didn't apply to badges (a 110px finger drag starting
on a badge still fired `tap_action` on release, reproduced in the audit); `hold_action`,
`double_tap_action` and `hold_delay` were silently ignored even when written in the YAML; and
badges had no `tabindex`/`role`/keyboard support, unlike every other tappable element.

### The fix

Badge rendering now computes the same a11y attributes as icons (`tabindex`/`role`/cursor, gated on
any of the three actions being set), and the click/touchend pair is replaced with a single
`this._addZoneListeners(bel, b.tap_action, b.hold_action, b.double_tap_action, b.hold_delay)` call
— identical to how zones/icons/labels/gauges/vacuum widgets are wired.

## 2. `glows[].visible` was not implemented

### Root cause

`docs/CONFIGURATION.md` and the glow YAML box label both document `group / visible /
visible_template / fade / slide — as on every other element`, but `_update()`'s glow loop only ever
evaluated the glow's `entity` state/brightness to compute opacity. There was no `evalCond(g.visible,
states)` check and no `_setVis()` call — `visible_template` happened to work only because
`_setupTemplates` writes `display` directly for template-based visibility, but the plain `visible:`
condition form was silently ignored. Reproduced: a glow with `visible:{entity:binary_sensor.home,
state:'on'}` stayed rendered at full computed opacity even when that sensor was `off`.

### The fix

The glow loop now mirrors the icon loop's visibility handling: it evaluates
`g.visible_template!==undefined ? (this._tmplVis['gw:'+id] ?? true) : (g.visible ? evalCond(g.visible,
s) : true)` and calls `_setVis(gel, gShow2, '', g.fade, g.slide)` before the opacity math, so a glow
hidden by `visible:` now actually disappears (optionally with the same fade/slide as everything
else).

## 3. Escape/arrow keys stopped working for section panels after HA moved the card

### Root cause

`disconnectedCallback` removed **and set to `null`** `_tmKeyHandler` and `_secKeyHandler` — the two
document-level keydown handlers behind Escape-to-close and arrow-key nudging. Every other
window/document listener in the file (`_hlHandler`, `_orientHandler`, `_hashHandler`, …) follows a
different pattern: removed on disconnect but left non-null, then unconditionally re-added in
`connectedCallback` (relying on `addEventListener`'s built-in dedup of identical `(type, fn)` pairs
to make that safe). `_tmKeyHandler`/`_secKeyHandler` were the two exceptions, and `connectedCallback`
never re-armed them — `_openSection` only (re)installs the handler when it happens to be `null` *at
the moment a panel opens*, which is not the case right after a reconnect if a panel was already
open. Reproduced: open a panel, move the card to a new DOM parent (exactly what toggling Edit mode
does), press Escape — the panel stayed open.

### The fix

`_tmKeyHandler`/`_secKeyHandler` now follow the same "removed but not nulled, safely re-added on
reconnect" pattern as every other listener in the file.

## 4. Duplicating an already-duplicated item could produce a duplicate id

### Root cause

All eight "Duplicate" button handlers (icons, labels, gauges, blinds, elements, zones, glows,
vacuum widgets) did a naive `cl.id = cl.id + '_2'` with no uniqueness loop — only the section
duplicator already had one. Duplicating an original a second time produced `['lamp', 'lamp_2',
'lamp_2']` (reproduced in the audit). Because `_render()` caches elements by id via `querySelector`,
the second `lamp_2` rendered but silently never updated again. `setConfig` warned about
bad-character ids but never about duplicate ones.

### The fix

Introduced a shared `rocDupId(baseId, arr)` helper (bumping `_2`, `_3`, … until the id is free in
the target array) and switched all eight Duplicate handlers to use it. `RoomOverlayCard.setConfig()`
now also does a one-time scan for duplicate ids across all item arrays and logs a `console.warn` if
any are found, next to the existing bad-character-id warning.

## 5. Badge "Hide from mini" checkbox was overridden by the YAML box

### Root cause

`_badgeItem()`'s freeform YAML box did not exclude `nav_mini` from its contents, while
`_collectConfig()` applied the "Hide from mini" checkbox's write (`_navMiniSet`) **before** merging
that YAML box back into the collected badge — so the merge silently restored whatever value (or
absence) the YAML box held, undoing the checkbox. Labels, gauges and blinds already called
`_navMiniSet` *after* their YAML merge and were unaffected. Reproduced: unchecking "Hide from mini"
on a badge did nothing until the YAML box was also touched.

### The fix

`_badgeItem()` now deletes `nav_mini` from the cloned object it builds the YAML box from (matching
the dedicated-field exclusion every other item type already applies), and `_collectConfig()`'s badge
block now calls `_navMiniSet` *after* the YAML merge, same as labels/gauges/blinds.

## 6. Dead and stale editor controls

- Nav *Position* offered an `auto (rail on wide)` option that was a no-op: the card always maps
  `auto` to `top` at render time, and the v4 migration rewrites any stored `auto` anyway. Removed.
- Nav *Auto breakpoint (px)* wrote `nav.auto_breakpoint`, a key the v4 migration deletes on load and
  that nothing in the render path reads. The field (and its collect-config line) is removed
  entirely; the enclosing control grid was reflowed from three columns to two.
- Onboarding copy still said "turn on **Interactive preview** above", and the Layout-tab intro still
  said "Turn on **Test mode**" — both controls have been called **Edit mode** since v5.9.0. Both
  strings updated.
- The file header comment still read `room-overlay-card v4.0.0`. Replaced with a comment pointing at
  `ROC_VERSION` as the source of truth, so it can't drift out of sync with the real version again.

## 7. Docs: a badge `label:` example used an unrendered Jinja value

### Root cause

Two examples in `docs/CONFIGURATION.md` showed a badge's plain `label:` field given a value like
`"{{ states('sensor.t') }} °C"`. `resolveVal()` returns non-template `label:` values verbatim — only
`label_template:` is subscribed to HA's template engine for live updates — so following the
documented example literally shows the badge displaying the raw, unrendered
`{{ states('sensor.t') }} °C` text (reproduced).

### The fix

Both examples now use `label_template:` for the templated value, matching how every other
templated field in the docs is documented.

## 8. Housekeeping (three small fixes)

- **Test-mode Save overlay dumped JSON, not YAML.** It called `window.YAML ? window.YAML.stringify(cfg)
  : JSON.stringify(cfg, null, 2)` — `window.YAML` is essentially never present in a real HA
  frontend, so this always fell through to a JSON blob, while the overlay's own instructions told the
  user to "paste in YAML editor". The card already ships a small YAML dumper (`_yaml.s`) used
  elsewhere for the same purpose; the overlay now calls that directly, so it always produces real
  YAML.
- **`_scanUntagged` missed entities used only inside a declared section tile.** It read
  `t.item.entity` directly, which is `undefined` for a declared tile's shape (`item:{id, tile}` —
  the entity lives inside the nested `tile` object, not on `item` itself). An entity referenced only
  that way was still reported as "untagged" by the editor's device-scan helper. Fixed by resolving
  the tile through `rocTileDef(t)` (the same helper the render path already uses) instead of reading
  `t.item.entity` directly.
- **Opening a glow's section panel didn't flash it in the live preview.** Every other item kind
  (zones, badges, icons, labels, gauges, blinds, vacuum widgets) is in the card's `_hlHandler`
  kind-map and the editor's `_hlKinds` map, which drive the highlight-on-select behaviour; `glow` was
  missing from both. Added `glow` to the card's kind-map and `gw` to the editor's, including the
  editor's id-pattern regex.

---

No configuration changes in any of these eight fixes — every one is a pure bug fix (plus the one
docs correction), safe to update without touching YAML.

**Verified:** `npm test` (all three tiers — `smoke.test.js`, `render.test.js`, `lifecycle.test.js`)
passes, including new regression cases added for all eight fixes plus a generic round-trip test (the
report's suggested test) covering every item type that builds a combined "everything else" YAML box
— badges, elements, labels, gauges, blinds, glows and vacuum_widgets — confirming a full set of
fields on each survives an editor collect-config pass unchanged. All four reproduction probes from
the audit (`tests/probes/probe_sections.js`, `probe_editor.js`, `probe_card2.js`, `probe_misc.js`)
were re-run: the items targeted in this release now PASS, and the remaining open items (#7 stale
preview, #9 YAML parser limitations, #15 drag-drop rebuild) are unchanged, tracked for a later stage
as planned. `npm run build:verify` (the minified `dist/` build against the same three test tiers) was
also run clean.
