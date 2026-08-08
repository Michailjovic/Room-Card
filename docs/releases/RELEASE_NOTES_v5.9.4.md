# v5.9.4 — Clarify the Base image URL field

## What's new

The unexplained `*` on "Base image URL" is gone, replaced with an inline note: **required,
unless using a camera below** — matching how every other optional field in that panel already
explains itself. The field also has a placeholder now (`/local/images/room.webp`) showing the
expected path format at a glance.

## Compatibility

No config changes — label/placeholder text only.

## Testing

2 new render tests. Full smoke and render test suites pass.
