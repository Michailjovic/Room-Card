# v5.9.5 — Background & basics reorganized

## What's fixed

It was possible to fill in both **Base image URL** and **Base camera** at the same time.
At runtime, the camera always silently won — its periodic snapshot overwrites the background
on every refresh, so the image URL only ever flashed briefly before being replaced. Nothing
in the editor explained this, so a filled-in image URL could sit there doing nothing, looking
like a bug.

This is now a proper **Background: Image / Camera** mode toggle. Only the relevant fields
show for the selected mode, and switching modes — or simply saving a config that already had
both set from before — clears the field for the mode you're not using. The two can no longer
coexist.

## Also new

**Snapshot refresh** (renamed from "Camera refresh") now says plainly what it is: a periodic
photo, refreshed on the interval you set — not a continuous video stream. That's how it's
always worked (it polls the camera entity's snapshot and swaps the background image), chosen
deliberately for compatibility (works with any camera entity) and reliability, rather than
embedding a live-stream player.

**Pan & pinch-zoom** moved next to the new Image/Camera toggle. **Filter transition** moved
into the **Image filters** tab, where the rest of the filter behavior lives. **Weather
overlay** moved to the bottom of the panel.

## Compatibility

If you already have both `base_image` and `base_camera` set on a room, the next time you save
from the editor, `base_image` will be dropped (matching what was already happening visually).
No other config changes.

## Testing

9 new render tests covering mode defaults, pane visibility swapping, mutual-exclusion on both
the toggle switch and the stale-both-set-config save path, the relabeled copy, and regression
coverage for the moved zoom/filter_transition fields. Full smoke and render test suites pass.
