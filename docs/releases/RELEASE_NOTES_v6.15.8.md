# v6.15.8 — revert: the `<ha-yaml-editor>` upgrade for the zone `tap_action` box (B1 spike)

A revert release, following two bugfix releases (v6.15.6, v6.15.7) that each addressed a real,
correctly-diagnosed bug in the B1 spike from
[RELEASE_NOTES_v6.15.4.md](RELEASE_NOTES_v6.15.4.md) — yet the user's own live testing found both
original symptoms still present after both fixes shipped.

## What was reported

After v6.15.7 shipped, the user reported that **both** problems were still there: the upgraded zone
`tap_action` box was still blank when the editor was reopened, and it still refreshed the whole page
on every keystroke while typing. They also voiced doubt about the whole approach ("this might not be
the right path").

## Why two fixes in a row didn't help

Both v6.15.6 and v6.15.7 were real bugs, correctly diagnosed, each with a dedicated regression test
that failed against the pre-fix code and passed with the fix:

- v6.15.6 fixed `_upgradeOneYamlBox()` re-deriving the box's initial value by re-parsing this
  project's own serialized YAML with its own incomplete subset parser, instead of reading the live
  config value directly.
- v6.15.7 fixed the box's `value-changed` handler firing `config-changed` synchronously on every
  keystroke (unlike every other field in this editor, which only reacts on blur), by routing it
  through the same 150ms debounce every other live-typing field already uses.

Both passed every test written for them. Both still failed live. That combination — correct,
verified fixes for correctly-identified bugs, that don't fix the reported symptom — means the actual
cause lives somewhere this project's jsdom test harness cannot reach at all: there is no real HA
frontend running in these tests, no real `<ha-yaml-editor>`/CodeMirror component (only a hand-written
stub that mimics its documented contract), and no real Lovelace dashboard DOM around the card.

The leading suspect, **never confirmed** (no browser devtools session was available to check it
against the user's real dashboard): this card's own `_wireLayoutObservers()` mechanism, in place
since v4.6.4, watches `hui-panel-view.shadowRoot` and `hui-card-options.shadowRoot` with a
`MutationObserver` for *any* DOM mutation and synchronously triggers a full layout re-pin
(`_requestPin()`). A real `<ha-yaml-editor>` is a CodeMirror-backed component that grows and
reshapes its own internal DOM continuously while you type — entirely independent of its
`value-changed`/`config-changed` cycle. If that observer reacts to the editor's own internal
mutations, it would produce exactly these symptoms (refresh on every letter, editor state disturbed)
regardless of anything either fix touched, since neither fix could have any effect on that separate
mechanism.

## The decision

Rather than attempt a third live-tested fix based on another unconfirmed theory — costing the user
another round of testing for uncertain payoff — three options were presented: revert the box to a
plain textarea, do one more diagnostic round using the user's own browser devtools first, or leave it
as-is. **The user chose to revert.**

## What changed

The zone `tap_action` box is back to being a plain `<textarea>`, identical to every other YAML box in
this editor. Removed entirely:

- `_upgradeYamlBoxes()` and `_upgradeOneYamlBox()` — the upgrade mechanism itself.
- The `HA-YAML-EDITOR` branch in `_pYaml()` that read an upgraded box's tracked value/validity state.
- The `.hass` forwarding to any `ha-yaml-editor` elements in `set hass()`.
- The `ROC_YAML_EDITOR_BOXES` / `ROC_YAML_EDITOR_GETTERS` extension-point constants.

**Unaffected:** C1 (inline YAML error text shown under an invalid box, added alongside the original
B1 spike) still applies to this box exactly as it does to every other YAML box in the editor. Nothing
about parsing, validation, or the inline error message changed.

**No configuration changes** — this is a pure internal revert.

## Recommendation going forward

B3 and B4 — two further planned upgrades from the same audit item, both carrying the same
`<ha-yaml-editor>`-in-a-custom-editor integration risk as B1 — are now **on hold** and should not be
attempted again without first getting real diagnostic data from the user's own browser devtools
(Elements panel + Console, live, while reproducing the symptom) rather than relying on jsdom-only
theories. Two well-reasoned, carefully-tested attempts on this exact same box both failed live; a
third blind attempt on a different box would carry the identical risk.

## Verified

Removed the entire B1-spike test block from `tests/render.test.js` — the stub `<ha-yaml-editor>`
registered in a dedicated jsdom realm, and every test written against it (upgrade behaviour, prefill,
debounce, round-trip, the multi-line-string reopen bug) — since none of that mechanism exists
anymore. Replaced it with a single sanity check that the box renders as a plain `<textarea>`. Full
three-tier test suite (`smoke`, `render`, `lifecycle`), all 4 reproduction probes (same pre-existing
FAILs as always — bug #7 stale preview, bug #9's YAML-parser edge cases, bug #15 drag-drop remount,
the doc-example probe — none of them touched by this revert) and `npm run build:verify` against the
rebuilt minified `dist/` all re-run clean.
