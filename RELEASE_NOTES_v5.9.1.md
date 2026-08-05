# v5.9.1 — Fix: blank gap under the editor's live preview + YAML label polish

## What's fixed

The editor's live, draggable preview (the one Edit mode shows in the header) had its height
hardcoded to a guessed `420px`, no matter how tall the actual content — nav strip, lights
row, image, cover rail — needed to be. On rooms where that content added up to less than
420px, you'd see a blank gap underneath it.

It now sizes itself the same way the mini room-nav thumbnails already do: the card's height
follows its content (`auto`), and the image area is locked to the room's design
`aspect_ratio`, computed from its actual rendered width rather than a fixed guess.

## Also in this release

**Advanced (YAML)** stays in the header — after discussion, relocating it near every panel
where YAML applies turned out to be more complexity than it's worth for now. It picked up an
icon (matching Room/Edit mode/Haptics) and a shorter label: just **YAML**.

## Compatibility

No config changes — behavior-only fixes.

## Testing

4 new render tests: the preview's root height is `auto` (not a fixed px), its wrap correctly
locks to the aspect ratio, and the YAML toggle carries both its icon and shortened label.
Full smoke and render test suites pass.
