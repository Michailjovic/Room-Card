# v5.9.12 — Layout tab: icons on the sub-tabs, Image fit is now a dropdown

Two small follow-ups to v5.9.11's Layout tab work, based on feedback after seeing it rendered.

## What's new

**Portrait/Landscape sub-tab buttons now carry an icon** (`mdi:crop-portrait` /
`mdi:crop-landscape`) next to the label, so it's visible at a glance which profile is which.

**Image fit is now a dropdown, not free text.** `cover`/`contain` used to be typed per profile
into a plain text field (placeholder `cover|contain`) — a typo there fails silently, since the
render just falls back to `cover` for anything that isn't exactly `contain`. It's now a `<select>`
per profile (`cover — crop to fill` / `contain — letterbox`, plus a `— same as landscape —` /
`— default: cover —` empty option). Same config keys, same parsing — just removes the chance of a
bad string.

## Compatibility

No config schema changes — editor-only.

## Testing

3 new render tests (sub-tab icons present, Image fit renders as a real `<select>` for both
profiles, both options available). Full smoke + render suites green (0 FAIL).
