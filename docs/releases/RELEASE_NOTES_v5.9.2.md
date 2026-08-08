# v5.9.2 — YAML toggle moves up next to Undo/Redo

## What's new

The **YAML** toggle (formerly "Advanced (YAML)") moved from the Room/Edit mode/Haptics row
up into the title row, right beside the Undo/Redo buttons — grouped with the editor's other
meta controls instead of sitting in the row of config toggles. It's now a compact icon-only
button (matching Undo/Redo's style) that highlights when turned on.

## Compatibility

No config changes — purely a header layout change.

## Testing

5 render tests confirm the button's position (right after Redo), its default off/hidden
state, and that clicking it correctly reveals/hides the advanced YAML fields. Full smoke and
render test suites pass.
