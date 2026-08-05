# v5.8.1 — Fix: editor preview room-switch not syncing the Room select

## What's fixed

With **Drag-edit preview** turned on in the card editor, clicking a different room in the
preview's own thumbnail strip changed what the preview showed — but the editor's *Room*
dropdown (and every per-room panel below it) kept pointing at whichever room was selected
before. Any field you edited right after that silently landed on the wrong room's config.

The editor's Room select, and every per-room panel, now follow along automatically when you
switch rooms by clicking inside the live preview itself — not just when you use the Room
dropdown in the header.

## Why it happened

The Drag-edit preview is a real, independent `room-overlay-card` instance embedded in the
editor. It has its own room-switching logic (used for its own nav strip / swipe), and that
logic had no way to tell the surrounding editor it had moved to a different room.

## Compatibility

No config changes. Behavior-only fix — if you don't use Drag-edit preview, or you always
switch rooms via the header dropdown, you won't notice a difference.

## Testing

4 new render tests covering: preview mounting, initial room state, the editor's tracked room
index and Room select value following a room switch made inside the preview, and a field edit
made afterward landing on the correct room. Full smoke and render test suites pass.
