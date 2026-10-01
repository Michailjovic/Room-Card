# v6.17.1 — fix: cover control bar on phones

A docked cover control shown as a horizontal bar (portrait profile, e.g. under the photo on a phone)
collapsed to its padding: the buttons overflowed the bar, their top and bottom were clipped (the
active preset looked like a pair of brackets) and the bar's outline ran through the middle of them.
The bar now sizes to its buttons. The vertical dock in a side column is unchanged.

No configuration changes. Details: [CHANGELOG.md](../../CHANGELOG.md).
