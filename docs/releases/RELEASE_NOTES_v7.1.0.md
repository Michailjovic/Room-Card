# v7.1.0 — floor heating on the floor plan

The floor plan page now draws your floor heating itself — no rendered pictures needed.

- **Loops:** every plan room with a `climate` gets a counter-flow loop, red supply to blue return.
  It glows and flows while the room heats (strength and speed from Versatile Thermostat's
  `power_percent`), is faint while idle, grey when off, and muted when the thermostat is off but
  still asked to heat (paused by VTherm's central mode or an open window).
- **Manifold and feeds:** place the manifold in the studio and every loop gets its feed. Feeds
  cross walls only at **passes** you click on the walls, so you decide where the pipes run; a feed
  through the hall lights up whenever its room heats.
- **Studio:** new *Manifold* and *Passes* tools; pitch, margin and flow in Properties.
- **Config:** `floorplan.heating: {pitch, margin, flow, manifold, passes}`, `loop: false` on a plan
  room, theme tokens `pipe.*`. Existing plans keep working; the old per-theme heating patterns of
  the plan themes are replaced by the new loops.

See docs/FLOORPLAN.md → Floor heating.
