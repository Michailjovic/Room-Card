# v3.1.0 — Live mini-room thumbnails

One new option:

```yaml
nav:
  live: composite
```

Every nav thumbnail becomes a **live miniature of its room**: the room's currently active overlay images (lit lamps, TV glow, open windows…) are stacked over its base image, the conditional base image is resolved exactly like on the main card, and the thumbnail filter now also supports `brightness_model` (smooth day/night) — not just `filter_conditions`. When a light turns on in the bedroom, its thumbnail lights up too.

It's pure CSS background compositing — **no extra card instances, timers or template subscriptions** — and it rides the cheap nav-only update path introduced in v3.0.7, so busy sensors in other rooms still don't trigger full re-renders.

Two documented approximations: an overlay shows whenever its opacity resolves above 0, and grouped (pop-up panel) or `visible_template`-driven overlays are skipped.

Configure it in the GUI editor under *Rooms & menu → Navigation menu → Live thumbnails*, or in YAML as above.

Phase 2 (`nav.live: full` — scaled real card instances including gauges, labels and blinds) remains on the roadmap.

**Full Changelog**: https://github.com/Michailjovic/Room-Card/blob/main/CHANGELOG.md
