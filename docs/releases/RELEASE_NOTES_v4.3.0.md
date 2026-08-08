# Room Overlay Card v4.3.0

Fixes for the light-controls strip: switch pills now line up with sliders, and the "editor opens on the room you were viewing" feature no longer breaks when Home Assistant strips the URL hash.

## 🐛 Fixes

### Toggle pills match the slider height
A `switch` toggle pill and a `light` slider given the same height rendered at slightly different heights, because `material-slider-card` draws its own box around the configured pixel value. The toggle now measures the actually-rendered slider and matches it, so a mixed row (e.g. a `Světlo` slider next to a `Zrcadlo` switch) lines up. Rows with no sliders use the configured height directly.

### Height field is now clearly general
The Light-controls editor field is relabeled **"Control height — sliders & switches (px, vh, %, per-tier)"** — one setting controls the height of every element in the strip.

### Editor-opens-on-viewed-room no longer depends on the URL
Home Assistant strips the `#room=…` hash when it enters edit mode (it navigates to `?edit=1`) and again on save — which made the v4.2.0 hash-based approach unreliable (you had to scroll to restore the hash). The card now records the room it's showing in an in-memory store (keyed by `card_id` / background image), and the editor reads that when it opens. This:

- survives the edit toggle **and** save,
- works **without** `url_sync`,
- keeps the URL hash as a fallback.

## 🧪 Tests
159 smoke + 35 jsdom render tests pass (the editor-room tests now cover the in-memory path end-to-end).

## ⬆️ Upgrade
Drop-in replacement for 4.2.0. No breaking changes.
