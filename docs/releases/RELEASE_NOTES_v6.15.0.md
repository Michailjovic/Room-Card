# v6.15.0 — `nav_mini: false`: hide one element from a `nav.live: full` mini

Reported right after getting `layout.height: fill` + `image_align: top` working on a cockpit
dashboard: the cockpit room's own "open section" launcher icons (and, potentially, other small
per-room controls placed the same way) showed up inside that same room's own live nav-strip
thumbnail — cramped, overlapping, and not something the room's menu entry needs to show at all.

## Root cause

`nav.live: full` is deliberately "everything, unconditionally" — every gauge, label, icon, badge,
blind and embedded card in a room renders inside that room's own live mini thumbnail, with no
per-element filtering. That's the right default (it's what makes `full` simple: turn it on, the
mini just works), but it left no way to single out one specific element that doesn't belong at
thumbnail scale — short of switching the whole room to `nav.live: custom`, which flips the default
to "nothing unless opted in" and would mean re-adding `nav_mini: true` to every other element in
the room just to get back to where `full` already had it.

The `nav_mini` field itself already existed for exactly this filtering purpose — but only in one
direction: `rocBuildMiniConfig`'s per-element filter only ever ran under `nav.live: custom`, checked
`nav_mini === true`, and was skipped entirely for `full`.

## The fix

The same per-item filter now applies under both tiers, with each tier's own default preserved by
using the opposite comparison:

```yaml
icons:
  - id: open_media
    tap_action: { action: open-section, section: media }
    nav_mini: false   # keep this one launcher icon out of the (already-full) mini
```

- `custom` (unchanged): opt-in — only `nav_mini: true` items appear, everything else is hidden.
- `full` (new): opt-out — every item appears except one explicitly marked `nav_mini: false`.

An existing `full` config with no `nav_mini` fields at all renders exactly as before — the new
comparison (`!== false`) is true for `undefined` and for `true` alike, so nothing changes unless a
field is added on purpose.

The editor's per-element "Show in mini" checkbox is tier-aware now: under `custom` it keeps its
existing opt-in label and meaning, but under `full` it relabels to "Hide from mini" and, when
checked, writes `nav_mini: false` instead of `true`. Unchecking it (in either tier) always just
deletes the field, so switching `nav.live` back and forth never loses a per-element choice.

Verified: new smoke tests (`rocBuildMiniConfig` under `full` keeping unset/`true` items and
dropping only an explicit `false`), new render tests (a `nav.live: full` mini's mounted config
actually excludes the opted-out icon), and new editor round-trip tests (the checkbox renders with
the right label/checked-state per tier, and collects the right value in each direction) —
smoke/render/lifecycle all passing against source and the minified `dist/` build.
