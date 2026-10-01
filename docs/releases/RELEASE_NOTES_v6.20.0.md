# v6.20.0 — editor: live preview that keeps up, Undo after Remove

- The **Edit-mode preview** in the editor header now shows every change as you make it — before,
  only Layout edits and drags reached it.
- The preview is **no longer rebuilt** after a drag, adding or removing an item, or undo: no image
  reload, no flicker, your selection stays.
- **Removing** an item shows a *Removed … · UNDO* bar at the bottom of the editor for 10 seconds.

No configuration changes. Details: [CHANGELOG.md](../../CHANGELOG.md) ·
[Editor guide → Edit mode](../EDITOR.md#edit-mode).
