# v5.4.0 — `nav.live: full`: real, live mini-rooms in the nav strip (early/experimental)

*(v5.2.0 and v5.3.0 were skipped — reserved during development, never released; no gap in
functionality, just version numbers that never shipped.)*

## What's new

The nav thumbnail strip's `live` mode gains a third option: `full`. Where `composite` (v3.1.0)
composites a CSS background stack (base image + active overlays + a filter), `full` mounts a
real, independent `room-overlay-card` instance for **every room** — the same card, showing
gauges, labels, icons, badges, blinds and embedded elements, rendered at a fixed reference width
and then scaled down to fit its thumbnail with a CSS transform. Because it's a real instance
rather than a composited image, fonts, icons and gauge strokes keep exactly the same proportions
at thumbnail size as they have in the main view — "the menu is literally a scaled-down copy of
what you built," not an approximation of it.

```yaml
nav:
  style: thumbnails
  live: full
  mini:
    templates: false    # opt-in — costs a WebSocket subscription per mini instance
    camera_refresh: 30   # seconds, clamped to at least 30 regardless of the room's own setting
    width_ref: 480        # px — the fixed reference width every mini renders at before scaling
```

`full` shows everything unconditionally in this release — there's no per-element filtering yet.
The handful of things that never show in a mini, in any live mode, are the strips and controls
around the image rather than the room itself: `cards_above`, `cards_below`, `light_controls`,
a blind's `control:` block, `nav.cards`, `zoom`/`parallax`, and `url_sync`.

## Before you turn this on

This is an early cut, not the finished feature — a few things to know:

- **YAML only for now.** There's no editor GUI for `nav.live: full` or `nav.mini.*` yet — set them
  through the card's Advanced/YAML editor. A proper dropdown and settings panel are next.
- **Not yet optimized.** Every mini instance currently rebuilds whenever the card fully re-renders,
  rather than only when its room actually changes — more churn than the design is aiming for.
  It works, but expect it to get lighter in a follow-up release.
- **This is real, ongoing cost — plan for it.** Each mini is a genuine card instance with its own
  DOM and state subscriptions, not a lightweight compositing trick. A soft cap of around 8 rooms
  is recommended, and it's worth trying this on your actual wall-mounted tablet before turning it
  on for more than a couple of rooms — `composite` stays the light, default-friendly option for
  anyone who doesn't need full fidelity.
- Camera refresh and templates stay off per mini unless you opt in via `nav.mini.*` — each is a
  real, ongoing cost multiplied by every room using `full`.

## What's coming next

A `custom` live mode (planned, not in this release) will let you pick exactly which elements show
in each room's mini via checkboxes in the editor — for example, keeping everything except one
specific embedded card that doesn't make sense at thumbnail scale. The full design for both what's
shipped here and what's still to come lives in `NAV_LIVE_FULL_PLAN.md` in the repo.

## Testing

168 smoke tests (12 new, covering the config-building logic directly) and the full jsdom render
suite (10 new, covering the actual mount — verifying nested card instances appear one per
thumbnail, each pinned to its own room, with `hass` correctly forwarded) all pass. This has not
yet been verified against a real, running Home Assistant dashboard — please treat this release as
something to try out and report back on, not a finished, polished feature.
