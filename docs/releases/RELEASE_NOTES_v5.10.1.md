# v5.10.1 — Editor honesty & repo tidy-up

Small release closing out the code audit. One real fix, one hardening, and
housekeeping. No config migration needed.

## Fixed

### The "Dock side" select did nothing — removed

The blind editor offered a **Dock side: left / right** dropdown. It wrote
`control.dock_side`, `coverControlNorm()` turned it into a `side` field, and
**nothing ever read that field.**

It could not have worked: a docked cover control is `flex:1 1 0`, so it *fills*
its `cover` grid region — there is no free space to align it within. The side is
decided entirely by where you place the `cover` region in the Layout tab, per
profile. The README already said this correctly one bullet below the line that
documented `dock_side`.

So the control is gone rather than reimplemented. Offering a knob that cannot
affect anything is worse than not offering it — it sends you looking for a
layout bug that isn't there.

**Impact:** none visually. `dock_side` never had an effect, so removing it
changes nothing on screen. An existing `dock_side:` key in your YAML is ignored
exactly as before, and is dropped the next time you save that blind from the
editor. README updated; the historical CHANGELOG entries are left as they are.

### Editor escaping unified with the card's

The editor carried its own escaping helper that differed from the card's `escA()`
in two ways, both bugs:

- it did not escape `'`. Harmless today — every one of the 136 call sites was
  checked and they all land in a double-quoted attribute or a text node — but a
  trap for the next single-quoted attribute someone adds.
- it used `String(s)` instead of `String(s ?? '')`, so an unset field rendered
  the literal text `undefined` (or `null`) into its input box.

`_e()` now delegates to `escA()`. Verified first that the editor has no inline
`on*` handlers, so escaping apostrophes cannot break anything.

## Housekeeping

- **54** `RELEASE_NOTES_v*.md` files moved from the repo root to
  `docs/releases/`. They were crowding out the documents people actually open —
  README, LAYOUT, PRESETS, ROADMAP. Moved with `git mv`, so
  `git log --follow` still works on any of them. `CHANGELOG.md` remains the
  canonical history.
- Stale `test-results/` artifacts deleted. They recorded six "failures" that
  were only ever a missing Chromium install in a sandbox, and `.last-run.json`
  made the suite look broken to anyone who glanced at it.

## Testing

8 new assertions in `tests/lifecycle.test.js` (43 total). Four of them fail
against v5.10.0, which is the point — they reproduce the bugs rather than merely
describing the fixes. The other four are regression nets around nullish
rendering. There is also a check that a legacy `dock_side:` key in an existing
config still loads and saves without error.

Full suite green against both the source and the minified bundle.

## Not done: the structural refactor

Step 4 of `CODE_ANALYSIS_v5.9.13.md` (splitting the file into `src/`) is
**dropped**, and the report's recommendation there was wrong on two counts:

- It claimed the split would make the pure helpers unit-testable. They already
  are — `smoke.test.js` loads the file with `vm.runInContext` and exercises them
  off the sandbox global, 100+ assertions.
- `src/` already existed once (TypeScript + rollup), drifted out of sync with
  the shipped JS, and was deliberately deleted in v1.3.0 with the note that
  `room-overlay-card.js` is now the single source of truth. Re-splitting would
  recreate exactly that failure mode.

The editor's real problem — the same 101 fields described three times across
`_render` / `_collectConfig` / `_listen`, 1633 lines — is genuine but currently
*correct*: an audit of all 101 ids found no dead or drifted controls. It is a
future maintenance risk, not a present defect, and is better tackled as a
deliberate incremental project than on refactor momentum.
