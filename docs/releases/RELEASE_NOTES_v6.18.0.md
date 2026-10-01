# v6.18.0 — action builder in the editor

Tap, double tap and hold actions of zones, icons, cockpit tiles and the room's own *Tap on the
image* no longer need YAML. Each gesture gets a row with a type select — More info, Toggle,
Navigate, Open URL, Perform action, Open/Close section, Switch room, Next/Previous/Follow room,
Toggle/Show/Hide group, Do nothing — and only the fields that type needs, with selects for
sections, rooms and groups.

Anything the builder doesn't cover (`fire-dom-event`, `browser-mod-popup`, conditional actions)
opens as **Custom (YAML)**, extra keys like `confirmation:` are kept, and a row you don't touch is
saved exactly as it was.

No configuration changes. Details: [CHANGELOG.md](../../CHANGELOG.md) ·
[Editor guide → Actions](../EDITOR.md#actions-tap--double-tap--hold).
