# v5.8.0 — Haptic feedback the moment a hold action registers

## What's new

Zones, icons, labels, and gauges with a `hold_action` already showed a visual progress ring
confirming when the hold threshold was reached — but the card only vibrated later, on release,
when the hold action actually ran. Now there's a distinct tactile tick at the exact moment the
hold *registers* (the ring turning green), before you even lift your finger — similar to how a
native long-press haptic feels.

## Editor

Now toggleable from the editor, not just YAML: a **Haptic feedback** checkbox in the persistent
header, next to Test mode / Drag-edit preview / Advanced. On by default, matching the existing
`haptic` config field.

## Compatibility

Uses the exact same `haptic` top-level opt-out as every other haptic pulse the card already fires
— set `haptic: false` (or uncheck the new editor checkbox) to disable all of it, same as before.
No config changes needed for existing setups; the new tick is on by default wherever haptic
already was.

## Testing

4 new render tests: the tick fires on hold-registered with default settings, `haptic: false`
suppresses it, and the editor checkbox both reflects and writes the config in each direction.
Full smoke and render test suites pass.
