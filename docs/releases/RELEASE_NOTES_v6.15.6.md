# v6.15.6 — fix: the upgraded `tap_action` box (B1) went blank on reopen

A bugfix release found through live testing of v6.15.5's `<ha-yaml-editor>` spike (v6.15.4's B1, on
the zone `tap_action` box only) — see
[RELEASE_NOTES_v6.15.4.md](RELEASE_NOTES_v6.15.4.md) for the original spike and
[RELEASE_NOTES_v6.15.5.md](RELEASE_NOTES_v6.15.5.md) for the most recent editor work.

## What was reported

Typing a `tap_action` into the upgraded box worked correctly — the value saved, and the zone reacted
on the actual card exactly as configured. But closing the editor and reopening it showed the box
empty, as if nothing had been saved.

## Root cause

The upgraded box is HA's real `<ha-yaml-editor>` component, which holds a parsed JS value rather than
YAML text. Every time the editor re-renders that box — including on reopen — something has to hand it
a starting value. That "something" was reconstructing the value by taking the box's own displayed
YAML text (produced by this project's `_yaml.s()` serializer) and re-parsing it with this project's
own hand-rolled subset YAML parser (`_yaml.p()`/`_yParse()`) — not real `js-yaml`.

That subset parser is exactly what bug #9 in the original audit already flagged as incomplete: it
doesn't round-trip every shape correctly. In particular, a multi-line string (say, a notification
`data.message` with an embedded line break) gets serialized as a literal, unquoted newline in the
middle of a `key: value` line — and the parser's line-based reader then chokes on the next physical
line (no `:` on it) and throws, so the whole parse comes back empty. Anything past the simplest single
`action`/`entity` pair could trip this in some form.

Crucially, this never affected what actually got **saved** — `_pYaml()` reads a value from an upgraded
box's own `value-changed` event, which carries the value HA's real YAML engine already parsed
correctly, never touching the subset parser. Only the box's own *redisplay* after a fresh render was
wrong.

## The fix

The upgraded box's starting value is now read directly from the live config object (a small getter
table, `ROC_YAML_EDITOR_GETTERS`, paired one-to-one with `ROC_YAML_EDITOR_BOXES`) instead of being
reconstructed from text at all. There is no longer any round-trip through the subset parser for this
box — the value that goes in is exactly the value that's actually configured, every time.

## Verified

A new regression test reproduces the exact failure: a `tap_action` containing a multi-line string
that the old code could not round-trip, a fresh `setConfig()` + re-render (simulating closing and
reopening the editor), and an assertion that the upgraded box's value now matches the config exactly.
Confirmed this test fails against the old code and passes against the fix. Full suite re-run clean:
all three test tiers (including the existing B1/B2 tests), all 4 reproduction probes (unchanged from
v6.15.5 — no new regressions), and `npm run build:verify` against the rebuilt minified `dist/`.
