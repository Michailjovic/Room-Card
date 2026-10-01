# v6.22.0 — editor: real YAML parsing

The editor's YAML fields now use **js-yaml**, the same YAML library Home Assistant's own editor
uses, instead of a small built-in parser that got some YAML silently wrong:

- multi-line templates and `|` / `>` blocks no longer turn into empty values;
- a `# comment` after a value is a comment again, not part of the value;
- errors tell you the line and column.

Unquoted one-line templates (`visible_template: {{ … }}`) still work. A line of plain text in a
field that expects `key: value` lines is now reported instead of being saved.

No configuration changes. Details: [CHANGELOG.md](../../CHANGELOG.md).
