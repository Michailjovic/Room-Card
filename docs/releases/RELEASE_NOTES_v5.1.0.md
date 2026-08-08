# v5.1.0 — Blind visual overlay calibration (`top_offset`)

## Why

Many roller-blind motors keep a deliberate safety margin at their own "fully open" (0%) limit — the
motor is intentionally never driven all the way up, so the blind still hangs a few centimetres even
when `current_position` reports `0`. The card's blind overlay assumed raw `0` meant truly fully open,
so at intermediate positions the on-screen blind didn't match what the window actually looked like.

## What's new

A new optional per-blind field, `top_offset` (%, decimals allowed):

```yaml
blinds:
  - id: bedroom_blind
    entity: cover.bedroom_blind
    top_offset: 3.4   # real/visual % at raw motor 0
    ...
```

`top_offset` is the real/visual position (%) that corresponds to the motor's raw `0`. Raw `100`
(fully closed) is assumed to already be accurate — that's the common case, and matches what most
users confirm — so it needs no correction. Every position in between is linearly remapped:

```
visual = top_offset + raw * (100 - top_offset) / 100
```

This is applied **only to the visual overlay** — the blind graphic drawn on the room image. It's the
right place to fix this: you can dial in the right number just by comparing the on-screen blind to
what you remember/expect, without needing to physically measure or stand in front of the window.

## What's unaffected — on purpose

The cover-control widget (drag rail, up/stop/down buttons, position presets) keeps showing and
sending the motor's **raw** position, unchanged. Dragging the rail or tapping a preset behaves
exactly as it did before — this avoids touching motor safety margins or changing what position gets
sent to `cover.set_cover_position`.

## Editor

A new "Top offset (%)" number field sits next to the existing Min/Max fields on each blind. Default
`0` — fully backward compatible, no visual change for existing configs until you set it.

## Upgrade notes

No breaking changes. Nothing to migrate — omit `top_offset` (or leave it `0`) to keep the previous
behaviour exactly.
