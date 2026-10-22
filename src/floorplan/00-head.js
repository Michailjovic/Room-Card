/**
 * room-overlay-card — floor plan renderer — MIT License (see ROC_FP_VERSION below)
 * https://github.com/Michailjovic/Room-Card
 *
 * GENERATED FILE — assembled from src/floorplan/ by `npm run assemble` (tools/assemble.js).
 * Edit the parts and re-assemble.
 *
 * The floor plan page (V7_PLAN.md §6, Phase 5 — v6.47.0). A room with a `floorplan:` block is a
 * page that draws the home as a vector plan: floors, walls with door openings, room labels and the
 * live state of each room's lights, floor heating, temperature and humidity, in one of seven themes
 * and three projections (top, oblique cut-away, isometric).
 *
 * room-overlay-card.js loads this file with import() the first time a floor plan page is shown
 * (rocLoadFloorplan), so a dashboard without a floor plan never downloads it (§2a.4). Everything
 * here lives in one closure and registers itself on the card class as
 * RoomOverlayCard._rocFloorplan = {version, mount(host, opts), geom, themes}.
 *
 * Coordinates: one plan space in metres, x to the right, y down (the vacuum map's orientation).
 * Every projection is an affine map of the floor plane plus a vertical offset for height, so
 * patterns, light pools and heating loops are drawn in plan metres under one SVG transform, and
 * only labels and wall faces are computed in screen space.
 */
(function(){
'use strict';
const ROC_FP_VERSION='6.51.0';
const RFP_NS='http://www.w3.org/2000/svg';
let rfpUid=0;
function rfpEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function rfpN(v){return Math.round(v*100)/100;}
function rfpNum(v){if(v===null||v===undefined||v==='')return NaN;const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)?n:NaN;}
// Strings the plan itself draws (labels, empty state). The studio has its own table.
const RFP_STR={
  en:{empty:'No floor plan yet',empty2:'Open the Studio to import it from AnyVac or draw it',heating:'heating',light:'Light',heat:'Heating',on:'on',off:'off',idle:'idle',none:'—',
    vac:'vacuumed',mop:'mopped',cleaning:'cleaning',min:'{n} min',hr:'{n} h',day:'{n} d',clean:'Clean {room}',clean_q:'Start cleaning {room}?'},
  cs:{empty:'Půdorys zatím není',empty2:'Otevři Studio a naimportuj ho z AnyVac nebo ho nakresli',heating:'topí',light:'Světlo',heat:'Topení',on:'zap.',off:'vyp.',idle:'stojí',none:'—',
    vac:'vysáto',mop:'vytřeno',cleaning:'uklízí',min:'{n} min',hr:'{n} h',day:'{n} d',clean:'Uklidit: {room}',clean_q:'Spustit úklid: {room}?'},
};
function rfpT(lang,k){const t=RFP_STR[lang]||RFP_STR.en;return t[k]!==undefined?t[k]:RFP_STR.en[k];}
