# v5.7.0 — `nav.live: custom`: pick exactly which elements show in the mini

## What's new

The third `nav.live` tier, alongside `off` and `composite`: `custom`. It uses the exact same
real-instance mount/scale mechanism as `full` (shipped v5.4.0-v5.6.0), but instead of showing
everything unconditionally, each mini starts **empty** and only shows what you explicitly opt in.

Every gauge, label, icon, badge, blind, and embedded card panel in the editor now has a **"Show in
mini"** checkbox — it only appears once `nav.live: custom` is selected. Weather gets its own toggle
in the Basic tab, since it's a single overlay rather than a list of items.

The same thing in YAML is a `nav_mini: true` field on any element, or `weather_nav_mini: true` at
the top level or per room:

```yaml
nav:
  style: thumbnails
  live: custom
gauges:
  - id: temp_gauge
    entity: sensor.bedroom_temp
    nav_mini: true   # shows in the mini — omit or set false to hide it there
weather_nav_mini: true
```

## Why

If a room has a lot of visual detail — several gauges, labels, badges — cramming all of it into a
thumbnail-sized mini can look busy or just not read well at a glance. `custom` lets the main view
stay as detailed as you like while you pick just the handful of elements that actually matter in
the mini (a temperature gauge, a light icon) and leave the rest out. It's also the fix for one
specific embedded card that looks bad at thumbnail scale, without giving up `full`'s fidelity for
everything else.

## Compatibility

Nothing changes for existing configs. `full` keeps showing everything, exactly as before.
`nav_mini`/`weather_nav_mini` are silently ignored outside `custom` mode. Switching `nav.live`
back and forth never loses your per-element choices — they're just not read again until you switch
back to `custom`.

## Testing

10 new smoke tests cover `rocBuildMiniConfig`'s custom-tier filtering directly: per-item opt-in
across all six element types, top-level default arrays vs. room-level overrides filtered
independently, the weather toggle correctly resolving room-level overrides against the top-level
default, and confirming `full` mode is entirely unaffected. 12 new render tests cover the editor:
the `custom` option, checkboxes appearing/disappearing correctly across every element panel, zones
correctly excluded (not visual room content), collect round-tripping both ways, the weather toggle,
and an end-to-end check that a live mini's actual mounted config really does come out pre-filtered.
Full smoke and render test suites pass (202 smoke tests total).
