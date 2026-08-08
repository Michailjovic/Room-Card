# v5.9.10 — Fix: `nav.live: full`/`custom` thumbnails were overexposed vs. `composite`

## What's fixed

Room thumbnails in the navigation strip apply each room's lighting-driven CSS filter
(`brightness_model` and/or `filter_conditions`) to look right at a glance. For `nav.live:
composite`, the thumbnail draws its own simplified stack of the room's background + active
overlays, so applying that filter directly to the thumbnail is correct.

For `nav.live: full` and `nav.live: custom`, though, the thumbnail instead hosts a real, fully
independent mini `room-overlay-card` instance — which already computes and applies its own
filter internally (same logic the main card uses). The thumbnail wrapper was *also* applying a
filter on top of that, so the two filters composited together — effectively doubling the
brightness adjustment. The result: `composite` thumbnails looked correct, `full`/`custom`
thumbnails looked overexposed/washed out.

## The fix

The thumbnail wrapper no longer applies any filter when `nav.live` is `full` or `custom` — the
mounted mini instance handles its own lighting completely on its own. `composite` and classic
static thumbnails (`nav.live` unset) are unchanged.

## Compatibility

No config changes. Purely a visual correction — if you use `nav.live: full` or `custom`, your
thumbnails should now look identical in brightness/contrast to the main card view for that room.

## Testing

4 new render tests cover all four thumbnail modes (`full`, `custom`, `composite`, and classic
static) to confirm the wrapper filter is applied only where it should be. Full smoke + render
suites pass.
