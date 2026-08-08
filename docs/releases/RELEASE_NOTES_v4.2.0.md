# Room Overlay Card v4.2.0

The config editor now opens on the room you were actually looking at.

## ✨ What's new

### Editor opens on the viewed room (`url_sync`)
When `url_sync` is enabled, the card writes the active room to the URL hash as you switch rooms. The config editor now reads that same hash when it opens, so clicking **Edit** while looking at `Hall` opens the editor with **Hall** already selected — the room picker and the drag-edit preview (showing Hall's background image) follow along.

- One-time read on open: changing the room picker afterwards still takes over, and a `hashchange` while you're editing won't move you.
- No `url_sync`? The editor opens on the first room, exactly as before.

Card and editor are separate elements (Home Assistant creates the editor via `getConfigElement()`), so the URL hash is the shared channel that lets the editor know where you were. Home Assistant's own right-side preview pane still follows live presence and is not affected.

```yaml
type: custom:room-overlay-card
url_sync: true        # or a custom hash key, e.g. url_sync: floor1
rooms:
  - id: living
    name: Living
  - id: hall
    name: Hall
```

## 🧪 Tests
159 smoke + 34 jsdom render tests pass (3 new: hashed room → editor index, room-picker choice survives a later `setConfig`, no-`url_sync` stays on the first room).

## ⬆️ Upgrade
Drop-in replacement for 4.1.0. No breaking changes. The feature only activates when `url_sync` is set.
