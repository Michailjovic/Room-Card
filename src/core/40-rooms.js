// ----- Multi-room helpers -----------------------------------------------------
// Keys that live per-room; top-level values act as shared defaults for all rooms
const ROOM_KEYS=['base_image','base_camera','camera_refresh','base_image_conditions','weather_overlay','filter_conditions','brightness_model','overlays','zones','badges','elements','icons','labels','gauges','vacuum_widgets','glows','blinds','groups','tap_action','cards_above','cards_below','light_controls'];
// Vacuum status widget -- cross-room/global informational badge (NOT a
// controller; tap only navigates elsewhere). Classifies each configured
// vacuum's status-sensor string (device_class: enum) into
// rest/error/dry/wet/both/active, then aggregates across all configured
// vacuums into one compact icon. Values verified against the user's real
// `sensor.*_status` entities 2026-08-30 -- see project notes/CHANGELOG.
// An unrecognised future status string deliberately falls through to
// 'active', not 'rest': a false "something's happening" is a safer failure
// mode than silently hiding real activity behind "all clear".
const ROC_VAC_REST=new Set(['unknown','idle','charger_disconnected','charging','charging_complete','device_offline','locked','shutting_down','unavailable']);
const ROC_VAC_ERROR=new Set(['error','charging_problem']);
const ROC_VAC_DRY=new Set(['cleaning','segment_cleaning','zoned_cleaning','spot_cleaning']);
const ROC_VAC_WET=new Set(['segment_mopping','zoned_mopping','robot_status_mopping']);
const ROC_VAC_BOTH=new Set(['clean_mop_cleaning','clean_mop_mopping','segment_clean_mop_cleaning','segment_clean_mop_mopping','zoned_clean_mop_cleaning','zoned_clean_mop_mopping']);
function rocVacCat(stateStr){
  const v=String(stateStr==null?'':stateStr).trim().toLowerCase();
  if(!v||ROC_VAC_REST.has(v))return'rest';
  if(ROC_VAC_ERROR.has(v))return'error';
  if(ROC_VAC_BOTH.has(v))return'both';
  if(ROC_VAC_DRY.has(v))return'dry';
  if(ROC_VAC_WET.has(v))return'wet';
  return'active';
}
function rocVacAggregate(cats){
  let hasError=false,hasBoth=false,hasDry=false,hasWet=false,hasActive=false,count=0;
  for(const cat of cats){
    if(cat==='rest')continue;
    count++;
    if(cat==='error')hasError=true;
    else if(cat==='both')hasBoth=true;
    else if(cat==='dry')hasDry=true;
    else if(cat==='wet')hasWet=true;
    else hasActive=true;
  }
  let overall='rest';
  if(hasError)overall='error';
  else if(hasBoth||(hasDry&&hasWet))overall='both';
  else if(hasDry)overall='dry';
  else if(hasWet)overall='wet';
  else if(hasActive)overall='active';
  return{overall,count};
}

function roomMerge(c,idx){
  if(!Array.isArray(c.rooms)||!c.rooms.length)return c;
  const i=Math.max(0,Math.min(idx||0,c.rooms.length-1));
  const base=Object.assign({},c);
  delete base.rooms;delete base.nav;
  return Object.assign(base,c.rooms[i]);
}
function roomMatch(c,state){
  if(!Array.isArray(c.rooms)||state===null||state===undefined)return -1;
  const sv=String(state).trim().toLowerCase();
  if(sv==='')return -1;
  for(let i=0;i<c.rooms.length;i++){
    const r=c.rooms[i];
    if(String(r.id||'').toLowerCase()===sv||String(r.name||'').toLowerCase()===sv)return i;
    if(Array.isArray(r.area_match)&&r.area_match.some(function(a){return String(a).toLowerCase()===sv;}))return i;
  }
  return -1;
}
// Identity key used to pair card ↔ editor ↔ dashboard save
function cfgKey(c){
  if(!c)return'';
  if(c.card_id)return'id:'+c.card_id;
  const r=Array.isArray(c.rooms)&&c.rooms.length?c.rooms[0]:c;
  return'img:'+(r.base_image||'')+'|'+(r.base_camera||'');
}
// Last room the card was showing, keyed by cfgKey — the editor reads this to
// open on the viewed room. In-memory (survives HA's edit toggle, which is an SPA
// nav that DROPS the URL hash); more reliable than url_sync for this purpose.
const ROC_ROOM_MEM=new Map();
// Room-switch ghost (v6.43.0): a copy of the old room's content for the 0.3 s slide / fade.
// Custom elements (embedded HA cards, nav minis…) become plain boxes with the same class and
// inline style — a deep cloneNode constructs every one of them again just to slide out, which
// blocked the switch for a noticeable moment on rich rooms. ha-icon stays (cheap, and visible).
function rocGhostClone(node){
  if(node.nodeType!==1)return node.cloneNode(false);
  const tag=node.tagName;
  if(tag.indexOf('-')>0&&tag!=='HA-ICON'){
    const d=document.createElement('div');
    if(node.className&&typeof node.className==='string')d.className=node.className;
    const st=node.getAttribute('style');if(st)d.setAttribute('style',st);
    return d;
  }
  const c=node.cloneNode(false);
  for(let ch=node.firstChild;ch;ch=ch.nextSibling)c.appendChild(rocGhostClone(ch));
  return c;
}
