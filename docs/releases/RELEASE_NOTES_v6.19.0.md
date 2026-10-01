# v6.19.0 — editor: entity names, checks and phone layout

- Entity suggestions now show each entity's **friendly name**, and fields that only make sense for
  one kind of entity (blind → cover, light controls → light/switch, camera, weather, lux sensor,
  tile progress) suggest only those.
- Under every entity field you see the entity's name — or an orange **Not found in Home Assistant**
  when the id has a typo or the entity was renamed.
- Element **IDs** are checked while you type: empty, invalid characters, or a duplicate in the same
  list.
- On a phone or in a narrow dialog the editor's field rows fold to two columns, then one.
- The editor renders faster on large installations (entity lists are filled on demand).

No configuration changes. Details: [CHANGELOG.md](../../CHANGELOG.md) ·
[Editor guide](../EDITOR.md#entity-fields-and-id-checks).
