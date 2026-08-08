# v5.9.9 — Revert: v5.9.8's `day_night` phase change broke the closed look

## What happened

v5.9.8 tried to make the `day_night` blind's striped-background animation compose correctly with
`top_offset`. Testing it against real hardware showed a regression: at fully closed — even with
`top_offset: 0` (no correction applied at all) — the blind now rendered visibly "a bit open"
instead of fully solid.

## Why

The `day_night` visual is two identical striped background layers: one permanently fixed, one that
scrolls as the blind's position changes. The pre-5.9.8 code had a special case that placed the
scrolling layer exactly half a stripe-period out of phase from the fixed one when fully closed —
that's not an arbitrary quirk, it's what makes the two layers' gaps cancel out, producing a fully
opaque (no see-through) closed appearance. v5.9.8 replaced that special case with a "cleaner,
continuous" formula that (unintentionally) aligned the layers instead of anti-phasing them at fully
closed, letting light-colored gaps show through everywhere, including at 100% coverage.

## The fix

Reverted the rendering formula to its exact pre-5.9.8 behavior. The closed-state look is back to
what it was (and should be).

## What's still unresolved

While reverting, we traced the two-layer rendering precisely and found a structural limit: because
one layer is always fixed and always starts "solid" at its very first pixel row, **the topmost row
of any visible `day_night` fill is always opaque**, no matter what phase or `top_offset` value is
chosen. That means a residual sliver that's *purely* transparent (nothing opaque in it at all)
isn't achievable with the current rendering approach — only a structurally different approach could
do that, which is a bigger undertaking than a formula tweak.

`top_offset` still correctly controls how much of the blind shows (coverage amount) for
`day_night` blinds, same as any other blind type — it just doesn't (and currently can't cleanly)
also control the exact look of the striped pattern within that residual sliver. This remains a
known, parked limitation (see `ROADMAP.md`), not something to expect a quick fix for.

## Testing

Full smoke + render suites pass after the revert (the 5.9.8-specific tests were removed along with
the code they tested).
