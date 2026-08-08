# Room Overlay Card v4.4.0

Makes "the editor opens on the room you were viewing" actually reliable.

## 🐛 Fix

### Editor opens on the viewed room — for real this time
4.3.0 introduced an in-memory store so the editor could open on the room the card was showing. It recorded the room on **every** render, though — and when Home Assistant enters edit mode it recreates the dashboard card and resets it to the first room. That fresh render overwrote the remembered room with room 0 before the editor could read it, so the editor still opened on the first room.

Now the card records the room **only when you actively switch** (nav thumbnails, swipe, mouse-wheel, presence-follow). The value survives HA's edit-mode recreation and save, so clicking **Edit** while looking at `Bathroom` opens the editor on Bathroom.

- Works **without** `url_sync` (URL hash remains a fallback).
- The **Drag-edit preview** header checkbox already follows the room picker — pick a room to edit and the preview re-renders for it, so you can see what you're editing. Home Assistant's own right-side preview follows live presence and can't be steered.

## 🧪 Tests
159 smoke + 36 jsdom render tests pass — new coverage: a passive card re-render (edit-mode recreation) no longer clobbers the remembered room.

## ⬆️ Upgrade
Drop-in replacement for 4.3.0. No breaking changes.
