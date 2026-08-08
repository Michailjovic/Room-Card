# v5.9.0 — Editor GUI/UX revalidation, part 1: "Edit mode"

This is the first shipped step of an ongoing editor usability pass (tracked in
`EDITOR_UX_REVALIDATION.md`), released as its own **v5.9.x** line — separate from the
v6.0.0 milestone.

## What's new

**Test mode** and **Drag-edit preview** are now a single header toggle: **Edit mode**.

Previously these were two separate checkboxes with overlapping, easy-to-confuse behavior:
*Test mode* was a real config field (`test_mode: true`) that also disabled real tap/hold
actions on your **live dashboard card** — easy to forget you'd left it on. *Drag-edit
preview* was editor-only, never saved, and showed a live draggable copy of the card right
in the editor.

They're merged into one field. Checking **Edit mode** in the editor:

- Persists `test_mode: true` to your saved config (same YAML field as before, unchanged).
- Immediately shows a live, draggable preview of the card right there in the header —
  no separate toggle, and no waiting for Home Assistant to hand the config back before it
  appears.
- Carries the same safe/interactive behavior over to your real dashboard card too, since
  it's the same saved field — intentional, not a footgun: if you save with Edit mode on,
  your live card comes along with it.

The header also picked up icons: **Room** (door), **Edit mode** (cursor-move), and
**Haptics** (vibrate, shortened from "Haptic feedback") — a first step toward fitting the
row on one line instead of wrapping.

`Advanced (YAML)` stays put in the header for now; moving it next to the fields it actually
affects is a separate step still being designed.

## Compatibility

No config changes — `test_mode` is still `test_mode`. If you have both `test_mode: true` in
YAML already, nothing changes for you. In the editor, the two old checkboxes are gone;
there's one now, and it does what "Drag-edit preview" used to do, plus persists like "Test
mode" used to.

## Testing

12 new/updated render tests: the old checkbox is confirmed gone, toggling Edit mode mounts
and unmounts the live preview synchronously (not dependent on a config round-trip), the
config field is correctly written/removed, all three header icons are present, and the
room-switch-sync (v5.8.1) and drag-relay (v5.8.2) tests were updated to the merged field.
Full smoke and render test suites pass.
