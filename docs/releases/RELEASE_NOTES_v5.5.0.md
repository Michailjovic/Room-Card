# v5.5.0 — Fix: `nav.live: full` mini blinds could render empty

## What was wrong

After live-testing v5.4.0's `nav.live: full`: the bedroom room's mini showed its blind correctly,
but the living room's `day_night` blind didn't show up in its mini at all — even though it
rendered fine in the main view, and the room's other elements looked right in the mini too.

## Root cause

Mounting a mini set its `hass` property (which kicks off that instance's first render/update)
**before** appending it to the page. A DOM element that isn't connected to the document always
reports zero for any pixel measurement (`offsetHeight`, `getBoundingClientRect()`, etc.) — that's
normal browser behaviour, not a bug in the measurement itself.

Most gauges don't care — they're pure CSS percentage fills, and a routine visibility check shortly
after mount quietly corrects anything that was set too early. `day_night` blinds are the
exception: they measure their own real pixel height to position the alternating slat pattern, and
when that measurement came back zero, they skipped drawing a fill entirely rather than drawing a
degenerate one. So the blind was invisible until *something else* happened to trigger a fresh
update — which wasn't reliably happening.

## Fix

Mini instances are now attached to the page **before** being configured, so the very first render
already has accurate layout information to measure — no more depending on a later correction that
different element types handled differently.

## Testing

168 smoke tests and the full render suite pass. This was diagnosed from your live report — thank
you for testing it and flagging the discrepancy. Worth a re-check on your dashboard: the living
room mini's blind should now show up correctly.
