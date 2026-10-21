/**
 * room-overlay-card — Room Card Studio — MIT License (see ROC_STUDIO_VERSION below)
 * https://github.com/Michailjovic/Room-Card
 *
 * GENERATED FILE — assembled from src/studio/ (plus src/schema/roc-schema.js) by
 * `npm run assemble` (tools/assemble.js). Edit the parts and re-assemble.
 *
 * The full-screen editor (V7_PLAN.md §5). room-overlay-card.js loads this file with import()
 * the first time someone opens the studio (rocLoadStudio), so a dashboard that only shows the
 * card never downloads it (D5). Everything here lives in one closure: the card's helpers are
 * reached only through the handle the card class exposes (RoomOverlayCard._rocInternals), and
 * this file registers itself back on the card class as RoomOverlayCard._rocStudio.
 *
 * Phase 2 (v6.41.0) — the studio shell: a modal <dialog> on document.body above HA's own editor
 * dialog (spike S1), the real card on a canvas in a device frame, today's editor hosted
 * unchanged as the inspector (§5.5), undo/redo, an unsaved-changes guard and the two save paths
 * (§5.4): back through HA's card editor, or straight to the dashboard with a conflict check.
 *
 * Phase 3a (v6.42.0) — canvas editing, first part: selection shared by canvas, outline and
 * inspector; the outline lists every element (with search); add by clicking / drawing on the
 * image (every positioned type); duplicate, copy / paste across rooms, delete; edge and centre
 * snapping lives in the card (_snapPos).
 *
 * Phase 3b (v6.43.0) — multi-selection (Shift / Ctrl click, Ctrl+A), group move, align /
 * distribute, hide / lock layers on the canvas (studio view only), duplicate / copy / paste /
 * delete whole rooms.
 *
 * Phase 4a (v6.44.0) — the Properties form (§5.7): the selected element, the room or the card's
 * shared defaults as a form generated from the schema registry, with the studio's own entity
 * picker, icon picker (Home Assistant's MDI list), colour, length, action builder and YAML for
 * structured keys; validation pinned to fields, outline rows and the canvas. The classic editor
 * stays one tab away (All settings).
 *
 * Phase 4b (v6.45.0) — sub-forms and list editors for every `obj:` / `list:` key the schema
 * describes (section tiles, light controls, nav chips, the overview page, cover controls…); the
 * room form grows to navigation, overview, image & weather, light controls and cards; card-level
 * forms in the outline: Card settings, Navigation and Sections (add from the editor's recipes,
 * reorder, delete, rename with their references, the elements tagged into each).
 */
(function(){
'use strict';
const ROC_STUDIO_VERSION='6.45.0';
