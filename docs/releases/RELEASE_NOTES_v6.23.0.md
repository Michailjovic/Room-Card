# v6.23.0 — faster room switching

Switching rooms no longer rebuilds the room thumbnails at the top of the card. The strip — and,
with live thumbnails (`nav.live: full` / `custom`), every mini room card in it — stays in place and
only the highlight moves to the new room. On a 6-room dashboard with live thumbnails a switch got
about 3–4× cheaper, and the thumbnails no longer reload.

No configuration changes. Details: [CHANGELOG.md](../../CHANGELOG.md).
