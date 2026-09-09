# v6.11.1 — Quick buttons on an image tile lay out in a row

`tile.quick` — small round buttons that call a service directly, no more-info dialog, no
navigation — render in the same fixed side-rail regardless of tile mode: a vertical column next
to the icon on a plain icon tile. That's fine for a compact icon+text tile, but wrong for an image
tile: v6.9.0's image stage already stacks the tile *vertically* (photo, then body, then quick), so
the quick buttons ended up as a tall column sitting below the photo — awkward for something like a
TV remote's volume/power buttons, which read far more naturally side by side.

Image tiles (`tile.image` set) now lay their `quick` buttons out in a row instead, wrapping if
there isn't room. Plain icon tiles keep the vertical side-rail — nothing changes for them.

No config changes. No migration needed — this is pure rendering, the same `quick:` YAML you
already have just displays differently on an image tile.

Verified: 2 new render tests asserting the CSS rule shape (row on `.roc-tile-img .roc-tile-quick`,
column preserved on the plain `.roc-tile-quick` rule) — smoke/render/lifecycle all passing against
source and the minified `dist/` build.
