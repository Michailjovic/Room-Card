# Room Overlay Card — bug analysis & editor UX review (v6.15.1)

Scope: `room-overlay-card.js` (8 351 lines / 587 KB), `docs/`, `tests/`. Method: full static read of the
card and the editor, then **every finding below was reproduced in jsdom** with the probe scripts in
`tests/probes/` (not wired into `npm test`; run `node tests/probes/<file>.js`). Baseline first: `smoke`,
`render` and `lifecycle` tiers all green on the unmodified source, `node --check` clean.

Everything the v5.9.13 audit (`CODE_ANALYSIS_v5.9.13.md`) found was confirmed fixed. The findings below are
new, and most of them live in the code added since (cockpit v6.8–6.15, glows, the tile editor).

Part 1 is bugs, ranked. Part 2 is the editor GUI/UX review, which was the secondary ask.

---

## Part 1 — Bugs

### Severity summary

| # | Finding | Severity | Effort |
|---|---------|----------|--------|
| 1 | Cockpit tiles never update live unless their entity is in the *active* room (cross-room, `source: auto`, `progress:`) | **P1 — headline feature half-dead** | 30 min |
| 2 | Editor silently deletes an element's `portrait:`/`landscape:` overrides on every save | **P1 — data loss** | 15 min |
| 3 | "Save migrated config" button throws `ReferenceError: fire is not defined` | **P1 — crash** | 1 min |
| 4 | Clicks inside an open section panel (and on the backdrop) fire the room-level `tap_action` | P2 | 5 min |
| 5 | Badges bypass the shared tap handler: a page scroll starting on a badge fires its `tap_action`; no hold / double-tap / keyboard | P2 | 15 min |
| 6 | Icons with `hold_action` / `double_tap_action` but no `tap_action` get no listener at all (and no `tabindex`) | P2 | 2 min |
| 7 | The in-editor Edit-mode preview never receives scalar edits (icon, colour, entity, tile YAML…) — only add/remove and Layout-tab edits | P2 | 20 min |
| 8 | `glows[].visible` (documented, offered in the editor's YAML box) is not implemented | P2 | 10 min |
| 9 | Built-in YAML subset: nested flow mappings and inline `# comments` are **silently** mis-parsed; block scalars / multi-line strings fail — including the editor's own dump output | P2 | see Part 2 §B1 |
| 10 | After HA moves the card (edit-mode toggle) Escape no longer closes an open panel and arrow-key nudging stops | P3 | 5 min |
| 11 | Hard-coded Czech string in the empty-section panel | P3 | 1 min |
| 12 | *Duplicate* on the same element twice produces two elements with the same id (second one never updates) | P3 | 5 min |
| 13 | Badge "Hide from mini" checkbox is overridden by the YAML box (order of operations) | P3 | 2 min |
| 14 | Dead / stale editor controls: nav position `auto`, nav *Auto breakpoint*, copy still says "Interactive preview" / "Test mode" | P3 | 10 min |
| 15 | Every drag-drop in Edit mode rebuilds the whole editor DOM and remounts the preview card | P3 — perf/flicker | 30 min |
| 16 | Docs: badge `label:` conditional with a `{{ }}` value is shown literally (only `label_template` renders) | P3 — docs | 2 min |
| 17 | Housekeeping: Save overlay dumps JSON although `_yaml.s` exists; `_scanUntagged` ignores declared tiles; editor→card highlight has no `glow` kind; file header still says v4.0.0 | P3 | 15 min |

---

### 1. Cockpit tiles don't update live unless the entity belongs to the active room — **P1**

`_render()` builds the change-detection set from the **merged active room** only:

```js
const _ex=this._extractEntities(c);          // 3018 — c = roomMerge(cAll, roomIdx)
…
this._relevantEntities=[..._ex.ids];         // 3046
```

`set hass` (1082-1095) returns early when nothing in `_relevantEntities` / `_relevantAttrSources` changed,
so `_update()` → `_updateSectionTiles()` (4119) never runs. Sections are the one feature that is
deliberately *cross-room*, and three of its four content sources are outside that set:

| Tile source | Entity lives in | Live update while the panel is open |
|---|---|---|
| tagged element in the **active** room | `c` | ✅ |
| tagged element in **another** room | `cAll.rooms[j]` | ❌ never |
| `source: auto` (from `hass.states`) | config-less | ❌ never |
| `progress: sensor.x` (any tile) | key is `progress`, not `entity` — `_extractEntities` doesn't see it | ❌ never |
| declared `tiles:` (`sections[].tiles[].entity`) | top-level, survives `roomMerge` | ✅ (but its `progress` ❌) |

Reproduced (`probe_sections.js`): a washer zone tagged into `appliances` from room 2, panel open on room 1,
washer `idle → run`: `_update` called **0** times, tile still says *idle*; `progress` 10 → 75 %: bar stays
at 10 %; auto `climate` tile `heat → off`: unchanged. Control (same element moved into room 1): updates.
`_relevantEntities` printed `[]`.

**Fix.** After computing `_secResolvedTiles` in `_render()`, add every resolved tile's entities to the
relevant set — they're already iterated there:

```js
for(const id in _secResolved)for(const e of _secResolved[id]){
  const td=rocTileDef(e);
  if(td.entity)_ex.ids.add(td.entity);
  if(td.progress)_ex.ids.add(td.progress);
  for(const ov of(td.overlays||[]))this._extractEntities(ov,_ex.ids,_ex.attrs); // image-tile transforms/conditions
}
```

That makes any tile entity trigger a full pass, which is fine (COCKPIT_PLAN kap.4 only asked that
*collection* not run per tick — and `_updateSectionTiles` already early-outs when no panel is open).
If the cost matters on a big auto section, a third bucket next to `_navEntities` (`_secEntities` →
`_updateSectionTiles()` only) keeps busy sensors out of the room pass.

**Test.** `render.test.js` covers panels only from a fresh `_render()`; add the incremental case: open a
panel, assign a new `hass` with only a cross-room / auto / progress entity changed, await 30 ms, assert the
tile text. This is the exact blind spot the v6.15.1 glow fix already documented.

### 2. Editor deletes an element's per-profile overrides on save — **P1 (data loss)**

`_collectConfig()` for `elements` (5411-5413):

```js
const KEEP=['id','top','bottom','left','width','height','group'];
for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
if(yaR.val)Object.assign(o,yaR.val);
```

Every key not in `KEEP` must therefore come back from the YAML box — but `_elItem()` (5997-6006) only puts
a *whitelist* into that box: `card, visible, visible_template, fade, slide, mobile, z_index, border_radius,
overflow`. `portrait:` / `landscape:` — the v4 replacements for `mobile:` that `tApply()` reads at 2663 —
are in neither list, so they are dropped the first time the editor fires for any reason (a tap on
"Edit mode" is enough). Same fate for any future element key. Every other item type builds its YAML box
as "everything minus the dedicated fields" (`_lblItem`, `_gaugeItem`, `_vwItem`, `_glowItem`, `_badgeItem`),
which is the correct shape; `_elItem` is the odd one out.

Reproduced (`probe_editor.js`): element with `landscape:{width:'40%'}, portrait:{top:'50%'}` →
`_collectConfig()` → both gone, `visible_template` survives.

**Fix.** Make `_elItem` build `elCopy` the same way as the others (copy, delete the dedicated keys), and
keep `KEEP` and that delete list as one shared array so they can't drift again. Add the generic
round-trip test suggested at the end of Part 1 — it would have caught this and #13.

### 3. "Save migrated config" throws — **P1**

`_render()` line 6994: `migBtn.addEventListener('click',function(){self._wasMigrated=false;fire();});` —
`fire` is a local of `_listen()` (7401), not of `_render()`. Clicking the button in the migration banner
throws `ReferenceError: fire is not defined`; nothing is saved and the banner never goes away. Reproduced.
The banner is the documented path for every v3 user upgrading.

**Fix.** `self._fire(self._collectConfig());` — and re-render so the banner disappears.

### 4. Section-panel clicks bubble into the room-level `tap_action` — **P2**

The panels and the backdrop are rendered inside `.wrap` (2326), i.e. inside `ha-card`. The card-level
handler (2680-2683) fires `c.tap_action` unless the composed path contains
`zone|elcont|ico|badge|tm-flip|tm-save`. `.roc-panel` / `.roc-panel-backdrop` / `.roc-tile` are not in that
list, and only the close button stops propagation. With `tap_action` set on the room (a very common
`more-info`/`navigate`), every tap on a panel header, on empty panel space, on a tile that has no
`tap_action`, and **the backdrop tap that closes the panel** also runs the room action. Reproduced: three
`homeassistant.toggle` calls for three such clicks.

**Fix.** Add `roc-panel`, `roc-panel-backdrop` (and `roc-cc`, `lbl`, `gauge`, `vw`, `glow-edit` while
there) to the exclusion, or — simpler and future-proof — `stopPropagation()` on `click` at the panel and
backdrop roots.

### 5. Badges bypass `_addZoneListeners` — **P2**

Badges wire `click` **and** `touchend` straight to `_exec` (2615). Consequences:

- the v6.12.2 scroll-vs-tap fix does not apply — a finger drag that starts on a badge fires the tap on
  release (reproduced: 110 px drag → `toggle` called);
- no `hold_action` / `double_tap_action` / `hold_delay` / hold ring (silently ignored if written in YAML);
- no `tabindex`/`role`/keyboard, unlike every other tappable element;
- `_exec` calls `preventDefault()` on `touchend`, which is what prevents a double fire today — an
  accidental dependency.

**Fix.** Route badges through `_addZoneListeners(bel,b.tap_action,b.hold_action,b.double_tap_action,b.hold_delay)`
and add the a11y attributes in `bHtml` when any action is set, exactly as icons do.

### 6. Icons with only `hold_action` / `double_tap_action` are inert — **P2**

Line 2626: `if(ico.tap_action)this._addZoneListeners(el,…)`. Zones (2605), vacuum widgets (2636), labels
(2644), gauges (2655) and tiles (3113) all check any of the three actions; icons check `tap_action` only.
The a11y attributes at 2100 have the same condition. Reproduced: icon with `hold_action` only — no hold
ring, `tabindex` null; the identically configured zone works.

**Fix.** `const act=ico.tap_action||ico.hold_action||ico.double_tap_action;` in both places.

### 7. In-editor Edit-mode preview goes stale on scalar edits — **P2**

The editor's `setConfig()` skips `_render()` when item *counts* are unchanged (4904-4925), and `_prevCard`
is only (re)configured from `_render()` → `_mountPreview()` or from the Layout-tab path
`_lyDebouncedUpdate()` (5022). Every other field — icon name, colour, size, entity, tile YAML, glow
intensity slider, transform fields, filter sliders — reaches HA's *own* preview on the right but never the
draggable preview in the editor header. Reproduced: icon `mdi:lamp → mdi:sofa`, editor config updated,
`_prevCard._config.icons[0].icon` still `mdi:lamp` even after HA echoes the config back. On a phone-width
dialog the header preview is the only one visible, so it looks like the change didn't take.

**Fix.** Generalise `_lyDebouncedUpdate()`: make `_fire()` / `_fireDebounced()` also push the collected
config into `_prevCard.setConfig()` (the card's own `_cfgJson` guard makes an unchanged push free), and
drop the Layout-only special case.

### 8. `glows[].visible` is not implemented — **P2**

`docs/CONFIGURATION.md` line 929 lists `group / visible / visible_template / fade / slide — as on every other
element`, and the glow YAML box label says the same. `_update()`'s glow loop (4074-4098) evaluates only
`entity` state/brightness; there is no `evalCond(g.visible)` and no `_setVis` call (`visible_template`
works only because `_setupTemplates` sets `display` directly). Reproduced: glow with
`visible:{entity:binary_sensor.home,state:'on'}`, sensor `off` → opacity 0.7, display `''`.

**Fix.** Mirror the icon loop: `const gShow2=g.visible_template!==undefined?(this._tmplVis['gw:'+id]??true):(g.visible?evalCond(g.visible,s):true); this._setVis(gel,gShow2,'',g.fade,g.slide);`
before the opacity math.

### 9. YAML subset parser: silent corruption and self-incompatible dump — **P2**

`_yParse` (4588-4641) is a line parser. Reproduced from the YAML boxes' point of view (`probe_editor.js`):

| Input | Result |
|---|---|
| `visible: { entity: light.a, state: "on", and: { entity: light.b, state: "on" } }` | **silently** `{entity:'light.a', state:'"on" }', and:'{ entity: light.b'}` — no red border |
| `entity: light.a # the lamp` | **silently** `entity: 'light.a # the lamp'` |
| `template: >-` + indented lines | `null` → red border, previous value kept |
| `_yaml.s({visible_template:"a\nb"})` → `_yaml.p(...)` | `null` — the editor's **own dump** of a multi-line string cannot be read back |

The docs use the first shape constantly (`visible: { entity: …, state: "on" }` works only while it stays
one level deep) and the multi-line form for templates. Because `_pYaml` keeps the old value on failure,
data isn't lost — but the user gets a red border with a `title` tooltip (invisible on touch) and no message,
and in the two "silent" rows the config is written wrong.

**Fix.** Don't extend the hand-rolled parser — replace the textareas with HA's `<ha-yaml-editor>`
(js-yaml underneath, syntax highlight, `value-changed` with `detail.isValid`). It is already loaded in the
card-editor dialog (the "Show code editor" pane uses it). Details in Part 2 §B1. Until then, at least
strip ` # …` comments and reject `{`/`[` values that contain a nested `{`/`[` with an explicit message.

### 10. Escape / arrow keys die after HA moves the card — **P3**

`disconnectedCallback` (4461-4462) removes **and nulls** `_tmKeyHandler` and `_secKeyHandler`;
`connectedCallback` never re-adds them and `_openSection` only installs the handler when it was null *at open
time*. Reproduced: open a panel, move the card to another parent (what the edit-mode toggle does), press
Escape → panel stays open, `_secKeyHandler` false. Same class as the v5.9.14 finding, two siblings missed.

**Fix.** Detach without nulling and re-attach in `connectedCallback` when `_sectionOpen` /
`this._roomCfg.test_mode` say they should be live.

### 11. Czech string in the empty panel — **P3**

Line 2307: `Zatím sem nic nepatří — přidej <code>section: …</code> některému prvku v místnosti.` — the
only non-English UI string in a HACS card. Reproduced. Replace with e.g. *Nothing here yet — tag a zone,
icon, element or blind with `section: <id>`.*

### 12. Duplicate twice → duplicate ids — **P3**

All element `Duplicate` handlers (8227-8232, glows 7962, vacuum widgets 8014) do `cl.id=cl.id+'_2'` with no
uniqueness loop (sections have one, 8308). Duplicating the original a second time yields
`['lamp','lamp_2','lamp_2']` (reproduced). Because `_render()` caches elements by id via `querySelector`,
the second `lamp_2` renders but never updates. `setConfig` warns about bad characters in ids, not about
duplicates.

**Fix.** Reuse the section loop (`while(arr.some(x=>x.id===id))…`), and add a one-time duplicate-id warning
next to the character check in `setConfig`.

### 13. Badge "Hide from mini" checkbox overridden by the YAML box — **P3**

`_badgeItem` leaves `nav_mini` in the YAML box (5960 deletes only id/icon/position/x/y/animation/…), while
`_collectConfig` runs `_navMiniSet` **before** the YAML merge (5389 vs 5396). Unchecking the box therefore
does nothing until the YAML is also edited (reproduced: `nav_mini:false` survives). Labels, gauges and
blinds call `_navMiniSet` after the merge and are fine.

**Fix.** Delete `nav_mini` from `bCopy` in `_badgeItem` and move `_navMiniSet` below the merge.

### 14. Dead and stale editor controls — **P3**

- Nav *Position* offers `auto (rail on wide)` (6624) — the card maps `auto → top` (2005) and the migration
  rewrites it; the option is a no-op.
- Nav *Auto breakpoint (px)* (6648, written at 5715) — `nav.auto_breakpoint` is deleted by the v4 migration
  (448) and read nowhere in the render path. It's a field that writes a key nothing uses.
- Onboarding copy (6693) still says *turn on **Interactive preview** above*; the Layout intro (6708) says
  *Turn on **Test mode***. Both controls have been called **Edit mode** since v5.9.0.
- The file header comment says `v4.0.0` (line 2).

### 15. Drag-drop rebuilds the whole editor — **P3 (perf/flicker)**

`_makeRocPosHandler` (7046) calls `self._render()` on every `roc-pos-update` — every drop, every resize,
every 200 ms-debounced keyboard nudge. That rebuilds ~all editor DOM, re-binds every listener, re-runs
`_mountPreview()` (a brand-new card instance, new template subscriptions, camera timer, embedded HA cards
re-created), and the preview visibly re-paints (reproduced: `_prevCard` identity changes). With embedded
cards or `nav.live: full` this is a noticeable stutter after each drag.

**Fix.** Patch only the affected position/size inputs by `data-*` selector (they exist and are keyed by
index), update `this._config`, fire — no `_render()`.

### 16. Docs — badge `label:` with a Jinja value — **P3**

`docs/CONFIGURATION.md` 609-612 shows `label: [{condition:…, value:"Hot!"}, {value:"{{ states(…) }} °C"}]`.
`resolveVal` returns the string verbatim; only `label_template` is subscribed. Reproduced: the badge shows
the literal `{{ states('sensor.t') }} °C`. Either render `{{ }}` values through the template path (the
tile code already has an `isTpl` test) or fix the example.

### 17. Housekeeping — **P3**

- Test-mode Save overlay (2723) dumps `JSON.stringify` when `window.YAML` is absent (it always is in HA)
  while telling the user to "paste in YAML editor"; `_yaml.s(cfg)` is right there.
- `_scanUntagged` (7116) reads `t.item.entity`, which is undefined for declared tiles (`item:{id,tile}`), so
  an entity used only in a declared tile is still reported as untagged.
- `_hlHandler` kinds (3058) and `_hlKinds` (7678) have no `glow` entry — opening a glow panel doesn't flash
  it in the preview like every other element.
- `filter_conditions: []` is always written by `_collectConfig` (5248) and only pruned at the end — fine,
  just noting `tgt.filter_conditions` is set even in `smooth` mode before being deleted.

### Not a problem (checked)

Badge tap does **not** double-fire on touch (`_exec` prevents the synthesized click); `nav.live` minis
have `pointer-events:none` so section launchers inside them can't open panels; `rocBuildMiniConfig`
correctly drops sections/cards/controls; change detection for glows/transforms/`state_images.attribute`
is tracked (generic `entity`+`attribute` extraction); observers and window listeners are all released on
`disconnectedCallback`; template rejections are caught; no `innerHTML` with entity state.

### Tests to add with the fixes

| Guards | Test |
|---|---|
| 1 | render: open panel → incremental `hass` with cross-room / auto / `progress` change → tile text/bar |
| 2, 13 | **generic editor round-trip**: for each item kind, a fixture with every documented key → editor `setConfig` → `_collectConfig` → deep-equal. One loop, catches any KEEP/whitelist drift forever |
| 3 | render: click `#roc-mig-save` → `config-changed` fired, no window error |
| 4 | render: panel header / backdrop click → room `tap_action` not called |
| 5, 6 | render: badge drag ≥ 10 px → no call; icon hold-only → ring appears |
| 7 | render: change an icon field → `_prevCard._config` updated (fake timers) |
| 8 | render: glow `visible` false → hidden |
| 9 | smoke: the four parser rows above |
| 10 | lifecycle: open panel → move card → Escape closes |

---

## Part 2 — Editor GUI/UX review

Frame of reference (from `COCKPIT_PLAN.md` and the roadmap notes): *the GUI is the deliverable*; the
target user is someone who would otherwise hand-write YAML for months; the second audience is another AI
reading the repo; and the one piece of user research on file is that a non-technical household member only
ever liked *a nice simple controller for one device* and *the photo reacting to lights*. The review below is
graded against that, not against the author's own workflow (who, by his own account, has no pain point).

Explicitly **not** re-proposed (rejected 2026-08-08): regrouping the Elements sections by intent, and a
text search per section.

### A. What is already good — keep

- Onboarding gate (one field, then the rest) and `_openPanels` persistence.
- Light Controls panel: live gradient preview bound to the real fields — still the internal reference for
  "good".
- Layout tab sub-tabs + live mini grid preview (v5.9.11/12); Image fit as a dropdown.
- Undo/redo history, the count badges on sections, icons on every accordion, the Recipe select and the
  untagged-device scan on the Sections tab, "Create a room for each area".
- Edit mode: click-to-select handles, snapping guides, Alt for free drag, draw-to-create zone, per-glow
  chrome box.

### B. High impact

> **Caveat for B1, B3, B4 — HA's Lit components inside this innerHTML editor.** An earlier attempt to use
> `ha-entity-picker` here failed (value not shown, interaction broken) and the project notes record
> "never use it in an innerHTML editor". The likely mechanism is upgrade timing, not innerHTML itself:
> these elements are lazy-loaded chunks, and any `.hass` / `.value` set on the element *before*
> `customElements.whenDefined(tag)` resolves lands as a plain own-property that shadows Lit's accessor
> forever. The pattern that works in other custom cards is: create the element, `await
> customElements.whenDefined(tag)`, *then* set `hass` and `value`, re-set `hass` from `set hass()`, and
> listen to `value-changed`. Treat B1 as a one-hour spike on a single box first; if it still misbehaves,
> the fallback is to keep the textareas and adopt only the parser (`js-yaml` is not exposed on `window`,
> so that would mean bundling a small YAML parser — acceptable, the current one is 120 lines anyway).

**B1. Replace every YAML `<textarea>` with `<ha-yaml-editor>`.** Today 20+ boxes (actions ×3 on zones and
icons, badge body, element body, tile body, declared-tile body, conditions, chips, cards, slider, style…)
are parsed by a 50-line subset parser (bug #9). HA ships `ha-yaml-editor` (js-yaml, highlighting, error
reporting via `value-changed → detail.isValid`) and it is already loaded inside the card-editor dialog.
Swap-in plan: keep the `data-*` keys, render a placeholder element, upgrade after
`customElements.whenDefined('ha-yaml-editor')`, fall back to the textarea if it never defines (harness /
old HA). `_pYaml` becomes "read `.value` from the editor element". This removes the whole class of silent
mis-parses, gives real error messages, and deletes `_yParse`. It is the single biggest robustness *and*
UX gain per hour available.

**B2. Give tiles a real form.** The cockpit is the feature built "for other people", and its unit — the
tile — is a YAML box whose label is a 13-key list (`_secTileHtml` 7251, `_declTileItem` 7220). Promote
`name`, `entity` (picker), `icon` (picker), `icon_animation` (select), `active_state`, `state_class`,
`value`, `progress` (picker) and a small `quick` list (icon + service + target) to fields; leave
`tap/hold/double_tap` to B3 and the rest to the YAML box. Reuse the existing composite-key pattern
(`kind:i` / `dt:secI_ti`). With B1 in place the leftover box is safe; with B2 the common case needs none.

**B3. Use HA's action selector for actions.** Zones and icons carry three side-by-side YAML textareas each
("tap_action (YAML)" …); badges, tiles and the room `tap_action` are YAML too. `<ha-selector>` with
`selector:{ui_action:{}}` is the exact widget the tile/button cards use (navigate/URL/more-info/perform
action/toggle… with entity and target pickers). The card's own actions (`open-section`, `switch-room`,
`next-room`, `toggle-group`, `browser-mod-popup`, `follow-room`) can be offered as a second small select
that writes the same object, with the raw YAML as the escape hatch. Same `whenDefined` fallback as B1.

**B4. Entity and icon pickers.** Every entity field is a text input with a `<datalist>` of ~2 000 ids
(`_dlOptions`) — searchable by id only, not by friendly name, and the datalist is re-injected into the DOM
on every editor render. `ha-entity-picker` (the dead `.ep-placeholder` branch in `_bindHassComponents`,
7069, is the remains of the failed attempt) and `ha-icon-picker` give name search, icons and validation —
subject to the upgrade-timing caveat above. If the spike fails, a cheaper win inside the current pattern:
put the friendly name in the `<option>` label (`<option value="light.x">Kitchen lamp</option>` — browsers
match the label too), and render the datalist once outside the re-rendered subtree instead of per render.

**B5. Make the header preview truthful** (bug #7 + #15): push every debounced change into `_prevCard`
and stop remounting it on drag. On a phone the header preview is the only preview the user sees; a
preview that ignores half the edits teaches people to distrust it.

**B6. Layout presets.** The Layout tab is still "type CSS-grid percentages". A *Preset* select at the top
(*Photo only · Nav top + photo · Nav left + photo + cover rail · Photo + lights strip · Cockpit phone (fill)*)
that fills rows/columns/place for both profiles, plus a *Reset to generated default* button (call
`rocGenLayout`), covers persona A without touching the power-user path underneath. The generator already
exists; this is UI over it.

### C. Medium impact

- **C1. Inline error text under YAML fields** instead of red border + `title` (invisible on touch). The
  parser already throws `bad indent` / `bad line: …`; show it. (Moot after B1, which does this natively.)
- **C2. Rename cascade.** Changing a section `id` leaves every `section:` tag pointing at the old id;
  changing a room `id` breaks `area_match`-less presence matching and `switch-room` actions. Either cascade
  the rename through the config, or make the tag selects key on a stable value and show the title.
- **C3. Phone-width editor.** Field grids are hard-coded `repeat(3|4,1fr)` (e.g. 6042, 6156, 7150) — at
  the dialog width on a phone that's four ~70 px inputs per row. `repeat(auto-fit,minmax(150px,1fr))`
  wraps instead of squeezing; same for the 1fr/1fr/1fr/1fr action row (5940).
- **C4. Exit from Edit mode on the live card.** `test_mode` is saved, so a forgotten Edit mode leaves the
  dashboard card non-interactive with red outlines until someone reopens the editor. The card already has
  the WebSocket save path (`tm-save`) — add a small *Done editing* button next to *Save* that writes
  `test_mode:false` through it, and make the `.tm-info` badge say *Edit mode — actions disabled*.
- **C5. Advanced-YAML toggle labelling.** The header `{}` button is icon-only with a long tooltip; it hides
  every YAML box globally. Label it *YAML* and, per the earlier proposal 5, add a per-item *More…*
  disclosure so a single item's leftovers can be shown without opening 40 boxes. (Half of this disappears
  with B1–B3: fewer boxes to hide.)
- **C6. Sections tab — tag from here.** The *Currently collected* list is read-only and tagging lives on
  the other tab. An *Add from element…* picker (all untagged zones/icons/elements/blinds across rooms, room
  name prefixed) writes `section:` on the chosen element; each collected row gets a *jump to* link that
  switches room + tab + opens the panel (all three mechanisms exist: `_editRoomIdx`, `_tab`,
  `_openPanels`).
- **C7. Recipes: the Electricity recipe hard-codes `custom:electricity-panel-card`**, the author's own
  separate project; for anyone else it yields the "not registered — is it installed?" notice. Either ship it
  as a generic *Embedded card* recipe with an empty `card:` and a hint, or link the card in the notice.
- **C8. Destructive actions.** *Remove …* buttons act immediately; undo exists but the ↶ is small and
  unlabeled. A 5-second inline *Removed zone_3 — Undo* strip after removal is cheaper than a confirm dialog
  and matches HA's own pattern.

### D. Low impact / polish

- Localisation: all UI strings are English literals (plus the one Czech one). A 40-key `ROC_I18N`
  map keyed by `hass.locale.language` with `en`/`cs` covers the card's own chrome (panel empty state,
  *Close*, *Open/Close/Stop*, follow-button title, hold overlay) — the editor can stay English.
- Accessibility in the editor: `<label class="roc-l">` is never associated with its input (`for`/`id`),
  so screen readers announce "edit text" for every field; icons-only buttons (▲▼✕↶↷) have `title` but no
  `aria-label`.
- Header: show the *edited room's* name next to *Edit mode* when multi-room, so the Room select and the
  header preview visibly agree.
- Blind panel: *Presets (icon only)* is no longer accurate — rows have icon, colour and name.
- `nav.live` option copy is long; the four-line explanatory paragraph could become per-option help
  under the select (only the chosen option's sentence shown).
- The *Room icon* field says "shown only when nav style = tabs" — also use it as the section-collected
  list's room marker and as the thumbnail fallback when a room has no image yet (bootstrap-from-areas
  creates exactly that state).

### E. Suggested order

1. **Patch release (bugs 1, 2, 3, 4, 6, 11)** — all small, all independent; 1 and 2 are the ones users will
   hit first (any cockpit with more than one room; any element with a per-profile override).
2. **Second patch (5, 8, 10, 12, 13, 14, 16, 17)** plus the generic editor round-trip test.
3. **B1 (ha-yaml-editor) + C1** — one focused release; it retires bug 9 and most of the parser code.
4. **B2 + B3 + B4** — the tile form, actions and pickers; this is where the "GUI is the product" thesis
   gets cashed in. Expect it to be the largest item on this list.
5. **B5 + bug 15, B6, C2–C8** as separate small releases, in whichever order the next screenshot round
   suggests.
