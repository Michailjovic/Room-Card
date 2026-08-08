# v5.8.2 — Fix: editor preview drags wiped `url_sync` and forced `follow_mode`

## What's fixed

Dragging or resizing an element inside the card editor's **Drag-edit preview** was silently
resetting the **Sync room to URL** setting (`url_sync` + its hash key) and, on multi-room
cards, overwriting **Follow mode** with `manual` — every single time, regardless of what you'd
actually set. Any edit made through the interactive preview would undo those two settings.

## Why it happened

The editor's live preview is a real, separate `room-overlay-card` instance, built from a clone
of your config with a few fields intentionally overridden just for the preview: `test_mode`
forced on, `url_sync` removed (so the preview can't hijack the dashboard's own address bar),
and — on multi-room cards — `follow_mode` forced to `manual` (so the preview doesn't jump
rooms on its own while you're editing). When you drag or resize something in the preview, it
reports its position back to the editor so the change sticks — but that report carried the
preview's *own* config, including those forced/removed fields, and only `test_mode` was being
un-done before saving. `url_sync` and `follow_mode` leaked straight into your real config.

## Compatibility

No config changes. If `url_sync` or `follow_mode` were wiped/changed by earlier drags, just set
them again in the *Rooms & menu* tab — they'll now survive future preview edits.

## Testing

5 new render tests confirm the preview instance really does force/strip those fields internally
(sanity checks), and that a simulated drag-relay update restores both `url_sync` and
`follow_mode` to the real config's original values while still correctly cleaning up the
preview-only markers. Full smoke and render test suites pass.
