# v6.25.0 — multi-row navigation, sharper thumbnails

- **Thumbnails in several rows.** `nav.rows` splits the room thumbnails into a grid — e.g.
  `rows: {portrait: 2}` shows six rooms as 3 + 3 on a phone, while the landscape strip stays one row.
- **Where the strip cards go.** `nav.cards_position: side` puts cards such as an alert ticker
  next to the grid, as tall as all its rows; `below` gives them their own row. Both are in the
  editor (*Rooms & menu → Navigation menu*).
- **Live thumbnails fill narrow boxes** instead of leaving an empty band under the room.
- **No more moiré in thumbnails.** Fine patterns (underfloor-heating pipes, slats, tiles) used to
  turn into false diagonal stripes when shrunk; thumbnails now use high-quality downscaled copies.
  The full-size room is unchanged.
- The navigation form no longer drops settings it has no field for (e.g. `dim_inactive`).

Details: [CHANGELOG.md](../../CHANGELOG.md).
