# Room Overlay Card v4.5.0

Home Assistant's own preview pane now follows the room you're editing.

## ✨ What's new

### HA's native preview tracks the edited room (`url_sync`)
Until now, only the built-in **Drag-edit preview** followed the room picker — Home Assistant's own right-side preview kept showing the first room (or the live-presence room), and you had to scroll the dashboard back and forth to restore the `#room=…` hash before it loaded the right room.

The editor now writes that `url_sync` hash itself — for the room being edited, on open and whenever you switch rooms in the picker — and fires a `hashchange`. HA's own preview card reads `url_sync`, so it follows along automatically. This also restores the hash after Home Assistant strips it on **save**.

- Requires `url_sync` (there is no other channel into HA's native preview).
- The Drag-edit preview and the editor's room scoping keep working with or without `url_sync`.

```yaml
type: custom:room-overlay-card
url_sync: true        # or a custom key, e.g. url_sync: room
rooms:
  - id: living
  - id: hall
  - id: bathroom
```

## 🧪 Tests
159 smoke + 37 jsdom render tests pass (new: the editor writes the `url_sync` hash for the remembered room).

## ⬆️ Upgrade
Drop-in replacement for 4.4.0. No breaking changes.
