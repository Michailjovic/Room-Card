# v5.7.1 — Fix: `nav.live` dropdown order

## What changed

The editor's *Live thumbnails* dropdown (*Rooms & menu* tab) now lists options in increasing
order of complexity: **Off → Composite → Custom → Full** (previously Off, Composite, Full,
Custom).

No config or behaviour change — this is purely a reordering of the dropdown for readability.

## Testing

Full smoke and render test suites pass.
