# v6.1.0 — `day_night` blinds: calibratable stripe phase, and the reserve stops shifting it

If you don't use `blind_type: day_night`, nothing in this release changes anything for you.

## The bug

A real zebra blind that keeps an un-retracted reserve at its motor's fully-open limit rendered
with the whole striped pattern shifted, and no `top_offset` value could sync it.

The cause was that the stripe phase was computed from the position **after** `top_offset` had been
applied. `top_offset` exists to say "the motor reports fully open, but a sliver of fabric is still
hanging" — that's a statement about how much of the window is *covered*, not about where the
fabric's own printed pattern sits. Feeding it into the phase term slid the entire phase curve
sideways. With 17 band pairs and `top_offset: 7.6`, the fully-open residual came out at **71 %
layer overlap instead of 0 %**, and every position from there inherited the error.

Two smaller problems came along with it. The sweep rate was hard-coded to `slat_count / 2`, a
number with no physical basis — how many times a zebra sweeps see-through → blackout → see-through
across its travel depends on tube diameter, fabric thickness and band pitch, not on how many bands
are visible when closed. And the fully-closed blackout was produced by a `pct >= 1` special case,
so the last percent of travel jumped rather than arriving.

## What changed

The phase now comes from the raw, `top_offset`-free travel, and three optional per-blind keys let
you calibrate it against your actual blind:

```yaml
blinds:
  - id: living_room
    entity: cover.living_room
    attribute: current_position
    blind_type: day_night
    slat_count: 17
    top_offset: 7.6     # unchanged — coverage only
    shift_turns: 8.5    # sweeps of see-through → blackout → see-through over the full travel
    shift_start: 0      # phase in periods (0–1) at fully open
    shift_snap: true    # land exactly on blackout when closed (default)
```

- **`shift_turns`** defaults to `slat_count / 2`, which is exactly what the card did before — so a
  `day_night` blind without `top_offset` renders identically to v6.0.0.
- **`shift_start`** lines the leftover reserve up with what you actually see at 0 %.
- **`shift_snap`** (on by default) nudges `shift_turns` so fully closed lands on true anti-phase.
  It replaces the old `pct >= 1` jump; the curve is continuous all the way to closed now.
- **`shift_legacy: true`** restores the pre-6.1.0 formula bit-for-bit, if you had tuned around it.

All four are in the GUI editor's blind panel under `blind_type: day_night`, so you can dial them
in against the live Edit-mode preview instead of editing YAML and reloading. Defaults are pruned
from the saved config.

## Measuring your blind

1. Run the cover from fully closed to fully open and count how many times it goes dark → light →
   dark. That count is `shift_turns`.
2. Park it at fully open and adjust `shift_start` until the leftover reserve on screen matches the
   window.

## Verification

19 new smoke tests cover `rocDayNightShift` (endpoints, linearity, clamping, the snap's blackout
guarantee and its composition with a non-zero `shift_start`) and the config passthrough. 14 new
render tests cover the rendered output and the editor round-trip, two of them pinning
`shift_legacy` to the exact pre-6.1.0 numbers. The render path was additionally verified in real
Chromium against a mounted card, since jsdom has no layout engine: at fully open the new path
reads offset `0.00` / overlap `0.000` where the legacy path reads `12.81px` / `0.708`, and both
reach a full blackout when closed.

## Docs

`docs/CONFIGURATION.md` gains a **Calibrating a `day_night` blind** section explaining the
two-layer model and the measurement procedure. The old note saying the stripe phase was an
unsolved problem is gone — that narrow question is now answered. The broader question of whether
the two-layer look matches real zebra optics in every respect stays parked in `ROADMAP.md`.
