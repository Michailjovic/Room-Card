# v5.9.8 — Fix: `day_night` blind phase drift, now composes correctly with `top_offset`

## What's fixed

`blind_type: day_night` renders a scrolling striped background to simulate the two-layer
day/night fabric look. The scroll amount (its "phase") used a formula with no defined relationship
to `top_offset`. Once `top_offset` started flooring the fill percentage instead of letting it reach
0%, the residual sliver still visible at fully open showed an arbitrary, unpredictable slice of the
striped pattern — no `top_offset` value could reliably sync it with the real blind.

## The fix

The phase is now computed with a continuous, physically-derived model: the striped pattern is
treated as fixed along the fabric's own length, measured from the **rail end** — the end that
stays visible longest as the blind retracts (the header/roll swallows the opposite end first). The
portion currently hanging below the header is always the *last* `fill % × height` pixels of the
full pattern.

Because the full height is always an exact multiple of one slat period, this means: once you set
`top_offset` correctly (the residual coverage % remaining at fully open), the *appearance* of that
residual sliver is fully determined — no extra tuning parameter, no guesswork.

**Practical formula:** to get exactly one transparent half-slat remaining visible at fully open,
set:

```yaml
top_offset: <100 * 0.5 / slat_count>   # e.g. slat_count: 17 -> top_offset: 2.94
```

More generally, `top_offset = (residual slat-pairs / slat_count) × 100` predicts how much of a
slat-pair remains visible.

This also removes a hard-coded special case at fully closed — the old formula had a visible
discontinuity right at the closed boundary; the new one is naturally continuous everywhere.

## Compatibility

No config changes. If you already use `blind_type: day_night` (with or without `top_offset`), the
striped pattern's scroll animation will look slightly different than before — this is the fix, not
a regression: the old phase had no physical grounding at all, so this replaces it with one that
does. Please verify visually against your real hardware.

## Testing

6 new smoke tests for the underlying pure function, including the exact real-world scenario
reported (17 band pairs, ~1.3-slat reserve, tuned to land the residual precisely on a transparent
slat boundary). 3 new render tests confirm the DOM output matches. Full smoke + render suites pass.
