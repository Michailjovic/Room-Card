# v6.11.4 — `state_images` can match an attribute

`state_images` (an overlay's or tile's state-driven image switching) has always compared each
entry against an entity's own `state`. That works for entities whose `state` directly carries the
thing you want to switch on — a fan's on/off, a washer's cycle. It falls short for a media_player
whose *content* lives in an attribute instead: most Android TV / Google Cast devices report their
own `state` as just playing/paused/idle/off, with the actually-running app in an attribute like
`app_id` (`com.stremio.one`, `org.smarttube.beta`, …).

## What's new

A `state_images` entry can now carry an optional `attribute:` field. When set, the entry is matched
against that attribute's value instead of the entity's `.state`:

```yaml
overlays:
  - id: tv_content
    state_images:
      - entity: media_player.televize_v_obyvaku_2
        attribute: app_id
        state: com.stremio.one
        image: /local/monitor-Stremio.webp
      - entity: media_player.televize_v_obyvaku_2
        attribute: app_id
        state: org.smarttube.beta
        image: /local/monitor-YouTube.webp
      - image: /local/monitor-LG.webp   # default — nothing else matched
```

Entries are still checked in order, first match wins, and the one entity-less entry is still the
default fallback — `attribute` is purely additive: an entry that omits it keeps comparing against
`.state` exactly as before, so nothing already configured changes behavior.

This closes the gap the bedroom TV tile didn't have to deal with (its LG webOS integration already
exposes the current source as a dedicated sensor's own state) but a Cast-based living-room TV does:
rather than requiring a separate template sensor just to re-expose an attribute as a state, the
overlay can now read the attribute directly.

No editor changes were needed — a `state_images` entry already lives inside the freeform "Conditions
YAML" box (room overlays and tile overlays alike), so `attribute:` is just another key typed there;
it round-trips through the GUI editor automatically.

No migration needed — purely additive.

Verified: 3 new render tests (attribute match wins over a same-list plain-state entry, a
non-matching attribute entry falls through to the next entry, no match at all falls back to the
default) — smoke/render/lifecycle all passing against source and the minified `dist/` build.
