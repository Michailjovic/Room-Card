# v3.2.1 — Light controls: background fix + responsive height

Two follow-ups to the `light_controls` feature from v3.2.0.

**Fixed — `bg_off` (off-state background) now actually applies.** It was set as an inline CSS variable that `material-slider-card`'s `colorize` overrode, so the slider background stayed the card's default. The pill shape, background and lux-ring border colour are now injected into the slider's shadow root as an `!important` stylesheet — the same technique as the `card_mod` this feature replaced — so your `bg_off` colour takes effect.

**Added — `height` can be screen-relative or per-tier.** A fixed px height looked tiny on desktop and fine on mobile. `height` now also accepts:

```yaml
light_controls:
  height: 4vh                       # 4% of screen height (also: "5%")
  # or per-tier:
  # height: { mobile: 20, desktop: 60 }
```

Tiers are `mobile` / `tablet` / `desktop` / `ultrawide` (by card width, nearest-smaller fallback); values resolve to px at render. In the GUI the *Slider height* field is now a text input — type `4vh`, `5%` or `{ mobile: 20, desktop: 60 }` directly.

**Full Changelog**: https://github.com/Michailjovic/Room-Card/blob/main/CHANGELOG.md
