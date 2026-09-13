# v6.15.4 — editor: inline YAML error text (C1) + a scoped `<ha-yaml-editor>` spike (B1)

Third release implementing `BUG_UX_ANALYSIS_v6.15.1.md`'s findings, this time from Part 2 (the
editor GUI/UX review) rather than Part 1's bug list — see
[RELEASE_NOTES_v6.15.2.md](RELEASE_NOTES_v6.15.2.md) and
[RELEASE_NOTES_v6.15.3.md](RELEASE_NOTES_v6.15.3.md) for the 14 Part 1 bugs already fixed. This
release covers the report's "Suggested order" item 3: **B1** (replace the hand-rolled YAML
textarea parser with HA's own `<ha-yaml-editor>`) and **C1** (inline error text under YAML fields).

## Why this release is scoped differently from the first two

The report itself flags B1 as carrying real risk that the first two releases' fixes didn't:

> **Caveat for B1 … HA's Lit components inside this innerHTML editor.** An earlier attempt to use
> `ha-entity-picker` here failed … Treat B1 as a one-hour spike on a single box first.

This project's own memory has the scar tissue from that earlier attempt: a note reading "never use
`ha-entity-picker` in an innerHTML editor." The audit's diagnosis is that the *actual* cause wasn't
innerHTML itself, but upgrade timing — setting `.hass`/`.value` on a Lit custom element before
`customElements.whenDefined()` resolves permanently shadows its reactive accessors with plain own
properties. That diagnosis is a theory, not something verified against a real HA dashboard from
here (this repo's test harness has no access to HA's actual frontend bundle, so `ha-yaml-editor` can
only be **stubbed**, not exercised for real).

Given that, this release does exactly what the report recommends: implements the corrected
upgrade-timing pattern, applies it to **one box only** (verifiable, low-blast-radius, easy for you
to check live), and leaves the other ~25 YAML boxes on the existing (safe, fully-tested) textarea
path until this one is confirmed working in your actual dashboard.

## 1. C1 — inline error text under YAML fields

### Before

`_pYaml()` flagged invalid YAML with a red border and a `title` attribute tooltip — the tooltip
only appears on mouse hover, so it's effectively invisible on a phone or tablet. The parser already
produces a specific message (`bad indent`, `bad line: <the offending line>`, or a genuine parse
exception's own message) — it just never reached the user.

### The fix

`_yaml.pe()` (parse-with-error) wraps the same fallback chain `_yaml.p()` already used
(`window.YAML` → `JSON.parse` → the hand-rolled `_yParse`) but returns `{val, err}` instead of
swallowing the error. `_pYaml()` now calls a new `_yErr(el, msg)` helper that lazily creates (and
reuses on subsequent renders) a `<div class="roc-yaml-err">` immediately under the field, showing
the message in red text. An empty message hides it again. This applies to every YAML box in the
editor — no per-box changes were needed since `_pYaml()` is the single chokepoint every box already
calls.

The previous-value-kept behavior is unchanged: an invalid box still doesn't overwrite the last good
config value, it just now also tells you *why* it wasn't accepted.

## 2. B1 — a first, scoped `<ha-yaml-editor>` upgrade (zone `tap_action`)

### What changed

The zone `tap_action` YAML box (one of the report's "actions ×3 on zones and icons" category, the
single largest class of YAML boxes) now upgrades from a plain `<textarea>` to HA's real
`<ha-yaml-editor>` component **whenever that component is already defined** in the running HA
frontend (`customElements.get('ha-yaml-editor')`). If it isn't defined yet, the editor watches for
it via `customElements.whenDefined('ha-yaml-editor')` and upgrades the box the next time it
resolves — with no timeout and no forced retry, so on an HA version or a harness that never defines
it (this repo's own jsdom tests, in particular) the box simply stays a plain textarea forever, byte
for byte identical to before this release.

Once upgraded: `<ha-yaml-editor>`'s `.value` property holds the **parsed** JS value (not a YAML
string — the component dumps to text internally), so `_pYaml()` for this box skips text parsing
entirely. The component's own `value-changed` event carries `{value, isValid}`; the editor tracks
`isValid` per-box internally, because `<ha-yaml-editor>` sets its own `.value` to `undefined` on
invalid input — indistinguishable, if read naively, from "the box was cleared." Tracking `isValid`
separately preserves this project's existing non-destructive contract: invalid input keeps the last
good `tap_action`, it's never silently deleted.

The upgraded box is wired independently of the generic per-field `change` listener every other box
uses (that listener would have attached to the original `<textarea>`, which gets replaced and
detached during the upgrade) — its `value-changed` handler calls `_fire(_collectConfig())` directly.

### Why only this one box

Per the report's own caution and this project's prior `ha-entity-picker` scar: the swap-in pattern
needs to be seen working against a **real** HA dashboard before it's worth repeating across ~25
structurally different boxes (some hold a single object, others merge multiple fields via a `KEEP`
list, others wrap a bare scalar). `ROC_YAML_EDITOR_BOXES` (a small array constant right above
`_upgradeYamlBoxes()`) is the whole extension point — adding a box there is a one-line change once
this one is confirmed to render and behave correctly for you.

### If you don't have `ha-yaml-editor` loaded in your HA frontend

Nothing changes for you — the box stays exactly as it was, with the C1 inline-error improvement
from above still applying to it (and every other box) normally.

---

**Verified:** `npm test` (all three tiers) passes, including 8 new regression tests: 3 for C1
(inline error appears on invalid input with the previous value kept, and clears once the box is
fixed) and 5 for the B1 spike — using a stub `<ha-yaml-editor>` custom element registered in a
dedicated jsdom realm that mirrors the real component's contract (`.value` holds the parsed value;
`value-changed` carries `{value, isValid}`), verifying: the box actually upgrades when the
component is defined, it's pre-filled with the parsed config value, a valid edit round-trips
through `config-changed` → `setConfig()` correctly, an invalid edit preserves the last-good value,
and — in every other test in the suite, which never register that stub — the box reliably falls
back to a plain textarea. All 4 reproduction probes from the audit were re-run: unchanged from
v6.15.3 (the 4 remaining YAML-parser sub-cases of bug #9 are exactly the ones B1's eventual full
rollout will retire; they're outside this release's one-box scope). `npm run build:verify` (the
minified `dist/` build against the same three test tiers) also run clean.
