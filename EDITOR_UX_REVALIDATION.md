# Editor GUI/UX Revalidation — analysis & proposals

Status: **analysis only, no code changed yet.** For discussion before any implementation.
Target ship version if/when approved: **v5.9.x** (explicitly not bundled into v6.0.0).

Scope: `RoomOverlayCardEditor` (the `room-overlay-card-editor` custom element in
`room-overlay-card.js`) — the 4-tab editor (Image / Elements / Layout / Rooms & menu),
its onboarding gate, and its item-accordion patterns. Read in full for this pass:
onboarding gate, `sec()` accordion helper, all 10 Elements-tab sections' construction,
the Layout (Responsive) tab, Light Controls panel, tab-switching machinery, persistent
header, and the Rooms & menu tab.

Two personas, per your request:
- **A — new user**, no config yet, wants a visible result.
- **B — existing user**, has a working card, wants to make one incremental change.

---

## Persona A: new user

Walkthrough as it exists today:

1. Add the card in HA → onboarding gate (`_isEmpty`) shows a minimal prompt: set a
   background image or camera, "the rest of the editor appears once a background is
   set." This part is good — narrow, unambiguous first step, no premature choices.
2. The moment a background is set, the **entire** editor appears at once: 4 tabs, a
   persistent header with 5 controls (Room select, Test mode, Haptic feedback,
   Drag-edit preview, Advanced YAML), and — inside the Elements tab alone — **10**
   accordion sections (Badges, Blinds, Elements, Gauges, Groups, Icons, Labels,
   Light & switch controls, Overlays, Zones). Nothing is highlighted as "start here."
3. **Drag-edit preview** — the fastest, most visual way to place things — is an
   unlabeled checkbox in a row of five, discoverable only by reading every checkbox
   in the header. There's no nudge pointing a first-time user at it.
4. The 10 Elements sections are listed **alphabetically**, not by what a newcomer is
   likely to reach for. Someone trying to "put a light switch on my floor plan" has to
   guess between *Light & switch controls*, *Icons* (state-aware, could be a light),
   *Elements* (embedded HA card), or *Zones* (invisible tap area + action) — all four
   are plausible answers to a naturally-phrased goal, and nothing in the tab
   distinguishes "the direct/common way" from "the flexible/advanced way."
5. If the defaults on the **Layout** tab don't fit their room photo, there is no
   visual affordance at all — it's raw CSS-Grid authoring: comma-separated row/column
   percentage arrays, and per-region grid-line placements typed as text (e.g. `"1/6"`),
   for two separate profiles (portrait/landscape), with zero live preview. This
   assumes CSS Grid line-syntax knowledge a floor-plan hobbyist won't have. It's the
   single steepest cliff in the editor for someone who just wants "move this region
   over a bit."
6. This session's own `nav.live` naming confusion ("composite" vs "custom" vs "full")
   is a live data point: even a technical user misread three adjacent, similarly-worded
   options. That's evidence the editor's option labels need to survive a stranger's
   first read, not just make sense once you already know the feature.

**Bottom line for A:** the onboarding gate itself is fine; the cliff is the instant,
undifferentiated full-surface-area reveal right after it, with no ordering or nudging
toward the easiest path (drag-edit) and no visual escape hatch for layout tweaks.

---

## Persona B: existing user, incremental edit

Walkthrough as it exists today:

1. Accordion open/closed state (`_openPanels`) survives re-render — good, you don't
   lose your place after a field change triggers a rebuild.
2. To find "the thing I want to tweak" you first need to know which of the 10
   alphabetically-ordered section *types* it lives in, then scan that section's item
   list (each item is its own `<details>` accordion). For a room with many zones/
   labels/icons, the only navigation is open-then-scroll-then-read; there's no
   search/filter/jump-by-name.
3. Every item type repeats the same shape (dedicated fields + a "leftover YAML" delta
   box for anything without a dedicated field) — consistent once learned, which is a
   real strength for muscle memory.
4. **Advanced (YAML) is a single global switch** for the whole editor. To see or edit
   one item's raw-YAML leftover box, you must turn on Advanced for *every* item in
   *every* section simultaneously — a targeted "just let me fix this one zone's
   `tap_action` YAML" edit means wading through YAML boxes that appeared on every
   other zone, label, icon, badge, blind, gauge, group, and overlay too.
5. The leftover-YAML box's contents are implicit: it's whatever fields survived the
   KEEP-array exclusion for that item type. The GUI gives no indication of *which*
   fields those are — you learn it by trial, or by knowing the schema already. The
   round-trip mechanism itself is correct; the problem is pure discoverability.
6. **Rooms & menu is one unbroken flat tab** — roughly 15 distinct concerns back to
   back with no sub-headers or sub-accordions: room id/name/icon, area_match, chips
   YAML, room_entity/room_state_entity linking, follow_mode, browser_mod device
   mapping, nav style/position/live + mini-room settings, nav height/width/wheel/
   follow-button, url_sync, nav chips YAML, nav cards YAML. Every other tab groups
   related fields under a collapsible, named `sec()` header; this tab doesn't, and
   it's the densest one. Wanting to tweak just "nav position" means scrolling past
   everything else, every time, with no anchor to jump to.
7. Multi-room setups scope editing to one room via the header dropdown; there's no
   copy-to-other-rooms action, so a tweak you want applied identically across 3 rooms
   means repeating the same navigation per room.

**Bottom line for B:** the per-item editing pattern itself is sound and consistent;
the friction is in *finding* the right item/section quickly (no grouping-by-intent,
no search, Rooms & menu un-sectioned) and in the all-or-nothing Advanced YAML switch
forcing a global reveal for a local edit.

---

## Cross-cutting observations

- Alphabetical ordering shows up more than once (Elements-tab sections; the `nav.live`
  dropdown was alphabetical until the v5.7.1 fix). Worth treating as a pattern to
  audit generally, not a one-off.
- "Elements" names both the whole tab and one specific section inside it (embedded HA
  cards). Combined with docs/roadmap language that uses "element" generically for
  "anything you add to a room," this is a a real ambiguity risk for anyone reading
  written instructions rather than clicking around live.
- The codebase always mounts all 4 tabs' full HTML and toggles `display:block/none` —
  not itself a user-facing bug, but it's why disclosure is currently binary (visible/
  hidden via CSS) rather than staged; any progressive-disclosure proposal fits this
  architecture cheaply (it's just about what to *show by default*, not a rendering
  rewrite).
- Light Controls is the most polished sub-panel in the editor (live gradient preview
  with tick marks bound to the actual field values) — worth treating as the internal
  bar/reference for what "good" looks like here, not something to change itself.

---

## Proposals, prioritized

**High impact / moderate effort — recommended first:**

1. **Re-group the Elements tab** by intent instead of alphabetically — e.g.
   *Interactive* (Zones, Blinds, Light & switch controls, Groups) vs *Informational*
   (Labels, Gauges, Icons, Badges, Overlays) vs *Embedded* (Elements/cards). Helps A
   pick the right tool, helps B scan faster. Low implementation cost — reordering
   `sec()` calls plus maybe a sub-heading, no new mechanism.
2. **First-run nudge toward Drag-edit preview** right after the background is set —
   a one-line callout, not a new checkbox, pointing at the existing control. Directly
   answers A's "how do I even start placing things" moment.
3. **Disambiguate "Elements"** — rename the embedded-HA-card section's user-facing
   label away from bare "Elements" (it's already leaning on "Embedded HA cards" in the
   description half of the label; tighten the name half too) so "Elements" unambiguously
   means the tab.
4. **Sub-accordion the Rooms & menu tab** using the same `sec()` helper already used
   in Elements — group into Room identity / Presence & follow / Navigation menu /
   Deep-linking. Serves B directly, and is architecturally free (reuses an existing
   pattern, no new UI concept).

**Medium impact:**

5. **Per-item Advanced-YAML toggle**, additive to (not replacing) the existing global
   one — lets B reveal one item's leftover-YAML box without exposing it everywhere.
6. **Text filter/search box** atop each item list (zones, labels, icons, …) for rooms
   with many items — scales with B's project growth, not needed on small setups.
7. **Live preview for the Layout tab** — ideally by making the existing drag-edit
   preview panel honor Layout-tab edits live, rather than building a second, separate
   grid visualizer. This is likely the single most expensive item on the list; worth
   scoping down to "does drag-edit preview already reflect Layout tab changes, and if
   not, wire that" before considering a bespoke visual grid editor.

**Lower impact / polish:**

8. **Copy-to-other-rooms** bulk action for repeated items — reduces multi-room
   tedium, not blocking for either persona.
9. **Audit remaining alphabetical lists/dropdowns** for logical-vs-alphabetical
   mismatches beyond the one already fixed (`nav.live` in v5.7.1).

**Explicitly not proposing changes to** (already good, called out so we don't
relitigate them): the onboarding gate and its copy; the Light Controls panel; item-
accordion open/close persistence (`_openPanels`); the KEEP-array/delta-object
round-trip mechanism itself (its *correctness* is fine — only its *visibility*, via
proposal 5).

---

## Suggested next step

Pick which of the numbered proposals to take into v5.9.0 (all of "high impact," a
subset of "medium," or something else) — then I'll implement + test in that order.
