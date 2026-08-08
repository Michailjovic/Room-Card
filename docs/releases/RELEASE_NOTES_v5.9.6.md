# v5.9.6 — Fix: orphaned Companion cards text with YAML mode off

## What's fixed

The "Companion cards — paste card YAML..." explanation above the Cards above/below YAML
boxes stayed visible even when Advanced (YAML) mode was off — describing fields that weren't
shown. It's now tied to the same visibility toggle as the fields it explains.

## Compatibility

No config changes — editor visibility fix only.

## Testing

1 new render test. Full smoke and render test suites pass.
