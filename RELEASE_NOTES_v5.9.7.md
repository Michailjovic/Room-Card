# v5.9.7 — Fix: `top_offset` corrected the wrong end of the blind

## What's fixed

`top_offset` was meant to compensate for a motor's safety margin at fully-open (a sliver of
blind material that never fully retracts) while leaving fully-closed untouched. Instead, it
was applied to the **raw entity value** before `min`/`max` normalization — so it silently
assumed raw `0` was the end needing correction. That's only true for the card's own default
`min: 0`/`max: 100` convention.

If your cover reports the standard `current_position: 0 = closed` (the documented "Inverted
motor direction" setup, `min: 100`/`max: 0`), the correction landed on the **closed** end
instead: fully closed stopped showing as fully closed, and the actual problem — the
un-retracted sliver at fully open — was never fixed at all.

## The fix

`top_offset` now applies **after** `min`/`max` normalization, to the open(0%)/closed(100%)
fill percentage rather than the raw motor value. It works the same regardless of which
direction your motor's `min`/`max` are configured. Fully closed always stays at 100%,
untouched; only the open end is floored to the real residual coverage.

## Compatibility

No config changes — same `top_offset` field, same value meaning (the real/visual coverage %
remaining at fully open). If you'd already set a value and it looked wrong, it should now
look correct without changing the number.

## Testing

3 new render tests reproduce the exact reported scenario: inverted `min`/`max`, closed stays
100%, open shows the residual coverage, and the midpoint interpolates correctly in between.
Full smoke and render test suites pass.
