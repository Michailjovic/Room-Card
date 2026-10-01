# v6.16.0 — Design refresh, part 1

Values now read the way Home Assistant shows them, and colour on the card only means "something is
happening". This is the first, layout-neutral half of the design review — nothing moves or grows.
The light strip and the cover control (which do take space) follow in a later release.

## Highlights

**Values look like Home Assistant.** Labels, nav thumbnail chips and cockpit tiles share one
formatter. Text states are translated and device-class aware (*Open*, *Docked*, *Washing* instead of
`on`, `docked`, `washing`), numbers use your HA number format's decimal separator, and a sensor that
drops out shows `—` instead of `unavailable°`. Timestamps and `12:30`-style states are no longer
mangled into `2026` / `12`.

**Idle is quiet.** A cockpit tile is coloured (and outlined) only while it runs. Idle states stay
neutral — previously every non-running state was painted green. Progress bars appear only while a
tile runs. `active_state` now takes a list: `[washing, drying]`.

**Section launchers show what's going on.** An icon that opens a section gets a progress ring while
something in it runs, a count badge when several things run, and turns amber — no config needed
(`section_status: false` to opt out).

**Calmer nav thumbnails.** Chips use the card's font in a small rounded pill; the other rooms'
thumbnails are slightly dimmed (`nav.dim_inactive: false` to turn off).

**Themeable.** New CSS variables `--roc-active`, `--roc-text`, `--roc-text-2`, `--roc-chip-bg`
(and more) — set them in your HA theme.

## Fixes

- `state: [a, b]` list conditions now match.
- `grouping_code` works with per-room `groups:`.
- First `toggle-group` on an undeclared group now hides it.
- Config warnings print once per page instead of on every room switch.
- New action `fire-dom-event` (browser_mod 2 popups and other custom actions).

## Behaviour changes to check

- A label or chip **without** `decimals:`/`suffix:` now shows HA's formatting (`21.6 °C`) instead
  of a rounded `22`. Add `format: raw` to keep the old output.
- Tiles with `active_state` hide their progress bar while idle — `progress_always: true` keeps it.
- `state_class: auto` no longer paints idle tiles green.

Full details: [CHANGELOG.md](../../CHANGELOG.md) · configuration: [docs/CONFIGURATION.md](../CONFIGURATION.md)
(*How values are formatted*, *Section launchers*, *Theming*).
