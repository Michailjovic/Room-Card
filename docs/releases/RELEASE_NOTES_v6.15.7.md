# v6.15.7 — fix: the upgraded `tap_action` box refreshed on every keystroke

A second bugfix release found through the user's own live testing of v6.15.4's `<ha-yaml-editor>`
spike on the zone `tap_action` box, right after
[RELEASE_NOTES_v6.15.6.md](RELEASE_NOTES_v6.15.6.md)'s fix for the box going blank on reopen.

## What was reported

Two things, reported together: typing into the upgraded box caused a visible refresh with every
single letter, and — despite v6.15.6's fix — the box could still end up losing whatever had just been
typed.

## Root cause

`<ha-yaml-editor>` is a live, CodeMirror-backed component: its `value-changed` event fires on every
keystroke. Every other field in this editor — text inputs, textareas, sliders — only reacts to
`change`, which fires on blur, not per keystroke. The upgraded box's `value-changed` handler fired
`config-changed` immediately, synchronously, on every single one of those per-keystroke events.

That event feeds directly into Home Assistant's own live "as you type" preview — a real, full
instance of this card. Doing that on every letter forced the preview through a complete, expensive
re-render each time, which is what showed up as "the whole page refreshes while typing."

It also explains why v6.15.6's fix (reading the box's value straight from config instead of
re-parsing text) wasn't the whole story: because most single keystrokes are, by themselves, incomplete
or invalid YAML, the box's own state was being read back and recomputed on nearly every keystroke
rather than once the user actually finished typing — leaving a much narrower window than intended for
a genuinely finished, valid edit to actually stick.

## The fix

The box's `value-changed` handler now routes through `_fireDebounced()` — the same 150ms debounce
this editor already uses for every other field that reacts live as you type (range sliders, plain
text inputs, …). `config-changed` — and the expensive live-preview re-render it triggers — now fires
once, shortly after you stop typing, instead of once per letter. The box's own internal tracked state
(used if something needs to read its current value on demand, e.g. a Save action) still updates
synchronously on every keystroke — only the *broadcast* to HA is debounced.

## Verified

A new regression test simulates a burst of three rapid keystrokes and confirms `config-changed` fires
zero times synchronously and exactly once — carrying only the final value — once the debounce settles.
Confirmed this test fails against the pre-fix code (catches the exact regression) and passes with the
fix. The existing B1 tests were updated to allow for the new debounce window. Full three-tier test
suite, all 4 reproduction probes (unchanged — no new regressions) and `npm run build:verify` against
the rebuilt minified `dist/` all re-run clean.
