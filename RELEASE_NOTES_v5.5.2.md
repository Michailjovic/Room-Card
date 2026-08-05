# v5.5.2 — Fix: v5.5.1's `zoom` fix didn't survive a real page load

## What was still wrong

v5.5.1 switched mini scaling from `transform: scale()` to CSS `zoom` to fix the living-room
`day_night` blind being invisible in its `nav.live: full` mini. It checked out in a live
verification — but after actually deploying it and reloading the dashboard, the blind was still
missing.

## Root cause

CSS `zoom`'s effect on `getBoundingClientRect()` isn't consistent over time. Right after setting
`zoom`, a rect read on a descendant can still report the correct (pre-zoom) size — but a later,
asynchronous re-layout pass (triggered by the mini's own size-watching `ResizeObserver`, which
runs for unrelated legitimate reasons) re-measures once the zoom has fully "settled," and that
read comes back zoomed/shrunk — silently re-corrupting the content box moments after it had been
sized correctly. That's why it looked fixed in the moment but wasn't fixed after a real reload.

## Fix

The actual sizing calculation (`_layoutStage()`) now measures with `offsetWidth`/`offsetHeight`
instead of `getBoundingClientRect()`. Unlike `getBoundingClientRect()`, these are specified to
always report an element's own CSS layout box, completely unaffected by any ancestor visual
transform — regardless of timing. Scaling reverted to plain `transform: scale()` (simpler, and no
longer matters which mechanism is used since the measurement is now immune either way). Also
excluded minis from an unrelated sizing pass (`_layoutFitWrap()`, viewport-height budget fitting)
that was never meant for them and had the same theoretical exposure.

## Testing

Verified specifically against what broke last time: forced the mini's layout, then waited 2.5
seconds for any async re-layout to run, and re-checked. Content box and gauge size stayed correct
and identical before and after the wait (no silent regression). Smoke tests and the full render
suite pass.

## Note

This closes out the `nav.live: full` mini-sizing bug — three patches (v5.5.0/5.5.1/5.5.2) on the
same underlying issue, per project convention of never reusing a version number once published.
Worth a real re-test on your dashboard after deploying, ideally with a hard refresh so there's no
stale cached JS in the mix.
