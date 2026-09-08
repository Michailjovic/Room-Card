# v6.7.0 — Transform engine: overlays that move

An overlay layer could do four things: appear, change opacity, swap its image, take a CSS filter.
Nothing that **moves**. Everything on this card that moves had its own hand-written renderer —
blinds have three, the vacuum icon has its own keyframes, the light glow another set — so every new
moving thing meant new bespoke code.

`transform:` is one declarative block that maps an entity onto an overlay's CSS transform.

## States

```yaml
overlays:
  - id: door_leaf
    image: /local/door_leaf.png        # just the leaf, no frame
    conditions: { opacity: [{ value: 1 }] }
    transform:
      entity: binary_sensor.front_door
      origin: 22% 55%                  # the hinge, in % of the photo
      perspective: 1100px
      transition: 0.9s ease
      map:
        "off": rotateY(0deg)
        "on": rotateY(-68deg)
```

`*` catches any state you don't list.

## Numeric range

```yaml
    transform:
      entity: cover.garage
      attribute: current_position
      from: { value: 0, transform: "translateY(0%)" }
      to:   { value: 100, transform: "translateY(-92%)" }
```

Covers a garage door, a drawer, an oven flap, a sliding door, a window on a vent latch. The two
transforms are interpolated argument by argument, each keeping its own unit. Both sides must list
the same functions in the same order; mismatched sides snap at the midpoint instead of emitting a
nonsense transform.

## Spin

```yaml
    transform:
      entity: fan.living_room
      attribute: percentage
      origin: 76% 43%
      spin: { min_duration: 0.4s, max_duration: 2.5s, axis: z, reverse: false }
```

Here the value drives the **speed**, not a position: `min_duration` at full scale, `max_duration`
just above zero. Stops at `off`, `unavailable` or 0 %; a plain switch spins at `min_duration`.

## Details worth knowing

- **`origin` is in % of the photo**, not of the PNG's visible pixels — an overlay layer covers the
  whole stage, so `22% 55%` means "the hinge is at that point on the room photo".
- **`perspective:`** is prepended to the transform, so `rotateY` reads as a door swinging into the
  room rather than a horizontal squash.
- Only a **spin** block claims the overlay's `animation:` slot; `map` and `range` leave an existing
  `pulse` / `blink` running.
- The layer now transitions `transform` too (default `0.8s ease`).
- You need a PNG of just the moving part. That is the real cost of this feature — the rest of the
  scene stays in the base image or another overlay.

Editor: a **Transform — make this layer move** panel inside every overlay, with a mode select that
reveals only the relevant fields and repeatable state → transform rows.

No migration — an overlay without a `transform:` block renders exactly as before.
