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
 */
(function(){
'use strict';
const ROC_STUDIO_VERSION='6.44.0';
// The schema registry (src/schema/roc-schema.js) is bundled here for the validation status. Its
// UMD footer exports to `module.exports` when `module` exists — this wrapper provides one, so the
// registry stays private to the studio instead of becoming window globals.
const RocSchema=(function(module){
// ---- Config schema registry (v6.40.0, V7_PLAN.md §5.2) --------------------------
// One declarative description of every config key the card understands. It is NOT part of
// the card the dashboard loads (src/manifest.json lists it as `standalone`); it is used by the
// tests today and by the studio, the generated configuration reference and docs/AI_SPEC.md
// later. When you add a config key to the card, add it here — tests/schema.test.js fails on
// any key that a reference config, a documented example or the card's own key lists use
// without a schema entry.
//
// Notation (kept terse on purpose — this file is data):
//   type   'str' 'num' 'bool' 'len' (number or CSS length) 'url' 'entity' 'tmpl' (string,
//          may be a Jinja template) 'color' 'any' 'card' (an embedded Lovelace card config,
//          not validated) 'action' 'cond' (one condition object) 'enum:a|b|c',
//          'obj:<Type>', 'list:<Type or scalar type>', 'map' (free-form object)
//   unions 'str|obj:X'   per-profile 'prof:<type>' = <type> or {portrait, landscape} of it
//   flags  {t, d: default, room: true (room-scoped, top-level value is the default for every
//          room), legacy: true (v3 key, auto-migrated on load), since: 'x.y.z'}
// Every element type also accepts its own keys under `portrait:` / `landscape:` (profile
// overrides) and the legacy tiers `mobile:` / `tablet:` / `desktop:` / `ultrawide:`.
(function(root){
'use strict';
const PROF_OVR={portrait:{t:'self'},landscape:{t:'self'},mobile:{t:'self',legacy:true},tablet:{t:'self',legacy:true},desktop:{t:'self',legacy:true},ultrawide:{t:'self',legacy:true}};
// keys every positioned element shares
const POS={id:{t:'str',req:true},top:{t:'len'},left:{t:'len'},bottom:{t:'len'},right:{t:'len'},width:{t:'len'},height:{t:'len'},z_index:{t:'num'}};
const VIS={group:{t:'str'},visible:{t:'cond|list:cond'},visible_conditions:{t:'list:cond'},visible_template:{t:'tmpl'},fade:{t:'bool|str'},slide:{t:'bool|str'},nav_mini:{t:'bool'}};
const ACTS={tap_action:{t:'action'},hold_action:{t:'action'},double_tap_action:{t:'action'},hold_delay:{t:'num'}};
const COCKPIT={section:{t:'str'},tile:{t:'obj:tile'}};
const COND_VAL={condition:{t:'cond'},value:{t:'any'}};
const S={
  // ---------------------------------------------------------------- top level
  card:{keys:Object.assign({
    type:{t:'str',req:true},
    card_id:{t:'str'},
    layout:{t:'obj:layout'},
    aspect_ratio:{t:'prof:str'},
    lock_aspect:{t:'str|bool'},
    border_radius:{t:'prof:len'},
    image_fit:{t:'prof:enum:cover|contain'},
    image_align:{t:'prof:enum:top|center|bottom'},
    filter_transition:{t:'str',d:'2s ease'},
    rooms:{t:'list:room'},
    nav:{t:'obj:nav'},
    sections:{t:'list:section'},
    room_entity:{t:'entity|obj:roomEntity'},
    room_state_entity:{t:'entity|obj:roomEntity'},
    follow_mode:{t:'enum:always|initial|manual',d:'always'},
    follow_hold:{t:'num',d:60},
    url_sync:{t:'bool|str'},
    test_mode:{t:'bool',d:false},
    zoom:{t:'bool',d:false},
    parallax:{t:'bool|obj:parallax'},
    haptic:{t:'bool',d:true},
    hold_feedback:{t:'bool',d:true},
    hold_color:{t:'color'},
    weather_nav_mini:{t:'bool'},
    grid_options:{t:'map'},
    view_layout:{t:'map'},
    card_mod:{t:'map'},
    // v3 (pre-layout engine) keys — migrated in memory on load
    max_height:{t:'any',legacy:true},breakpoints:{t:'any',legacy:true},mobile_breakpoint:{t:'any',legacy:true},
  },{}),room:true},   // + every ROOM key (see room below) as a shared default
  roomEntity:{keys:{default:{t:'entity'},by_browser:{t:'map'},by_user:{t:'map'}}},
  parallax:{keys:{source:{t:'enum:auto|orientation|pointer',d:'auto'},strength:{t:'num',d:6},scale:{t:'num',d:1.04}}},
  // ---------------------------------------------------------------- layout (v4)
  layout:{keys:{
    height:{t:'len|enum:viewport|fill|container',d:'viewport'},
    orientation:{t:'enum:auto|portrait|landscape|obj:orientation',d:'auto'},
    threshold:{t:'num',d:1},
    gap:{t:'len'},
    portrait:{t:'obj:layoutProfile'},landscape:{t:'obj:layoutProfile'},
  }},
  orientation:{keys:{default:{t:'enum:auto|portrait|landscape'},by_browser:{t:'map'}}},
  layoutProfile:{keys:{rows:{t:'list:len'},columns:{t:'list:len'},gap:{t:'len'},place:{t:'obj:place'}}},
  place:{keys:{nav:{t:'obj:region'},cards_above:{t:'obj:region'},image:{t:'obj:region'},lights:{t:'obj:region'},cards_below:{t:'obj:region'},cover:{t:'obj:region'}}},
  region:{keys:{row:{t:'num|str'},col:{t:'num|str'},align:{t:'enum:stretch|start|center|end'},overflow:{t:'enum:hidden|auto'}}},
  // ---------------------------------------------------------------- room (ROOM_KEYS + per-room-only)
  room:{keys:{
    id:{t:'str'},name:{t:'str'},icon:{t:'str'},area_match:{t:'list:str|str'},
    chips:{t:'list:navChip'},nav_hidden:{t:'bool'},nav_mini:{t:'bool'},
    overview:{t:'bool|obj:overview',since:'6.30.0'},overview_tile:{t:'obj:overviewTile',since:'6.30.0'},
    weather_nav_mini:{t:'bool'},
    // ROOM_KEYS — also valid at the top level as defaults
    base_image:{t:'url',room:true},base_camera:{t:'entity',room:true},camera_refresh:{t:'num',d:10,room:true},
    base_image_conditions:{t:'list:baseImageCond',room:true},weather_overlay:{t:'entity|obj:weather',room:true},
    filter_conditions:{t:'list:filterCond',room:true},brightness_model:{t:'obj:brightnessModel',room:true},
    overlays:{t:'list:overlay',room:true},zones:{t:'list:zone',room:true},badges:{t:'list:badge',room:true},
    elements:{t:'list:element',room:true},icons:{t:'list:icon',room:true},labels:{t:'list:label',room:true},
    gauges:{t:'list:gauge',room:true},vacuum_widgets:{t:'list:vacuumWidget',room:true},glows:{t:'list:glow',room:true},
    blinds:{t:'list:blind',room:true},groups:{t:'list:group',room:true},tap_action:{t:'action',room:true},
    cards_above:{t:'list:companion',room:true},cards_below:{t:'list:companion',room:true},
    light_controls:{t:'obj:lightControls',room:true},
  }},
  baseImageCond:{keys:Object.assign({image:{t:'url'}},COND_VAL)},
  filterCond:{keys:{condition:{t:'cond'},filter:{t:'str'}}},
  weather:{keys:{entity:{t:'entity'},effect:{t:'enum:auto|rain|snow|fog|lightning'},opacity:{t:'num'},z_index:{t:'num'},angle:{t:'num|str'}}},
  brightnessModel:{keys:{source:{t:'entity|obj:bmSource'},entity:{t:'entity'},attribute:{t:'str'},filter_gradient:{t:'list:bmStop'},min_input:{t:'num'},max_input:{t:'num'}}},
  bmSource:{keys:{entity:{t:'entity'},attribute:{t:'str'},min_input:{t:'num'},max_input:{t:'num'}}},
  bmStop:{keys:{value:{t:'num'},filter:{t:'str'}}},
  companion:{keys:{card:{t:'card'},media:{t:'str'},height:{t:'len'},type:{t:'str'}},open:true},
  // ---------------------------------------------------------------- shared value objects
  cond:{keys:{entity:{t:'entity'},attribute:{t:'str'},state:{t:'any'},state_not:{t:'any'},
    operator:{t:'enum:<|>|<=|>=|==|!='},value:{t:'any'},and:{t:'cond'},or:{t:'cond'}}},
  condVal:{keys:COND_VAL},
  gradStop:{keys:{value:{t:'num'},color:{t:'color'}}},
  action:{keys:{action:{t:'enum:none|navigate|url|more-info|toggle|call-service|perform-action|browser-mod-popup|toggle-group|show-group|hide-group|switch-room|next-room|prev-room|follow-room|open-section|close-section|fire-dom-event'},
    entity:{t:'entity'},entity_id:{t:'entity'},navigation_path:{t:'str'},path:{t:'str'},url:{t:'str'},url_path:{t:'str'},new_tab:{t:'bool'},
    service:{t:'str'},perform_action:{t:'str'},data:{t:'map'},service_data:{t:'map'},target:{t:'map'},
    title:{t:'str'},size:{t:'str'},content:{t:'card'},room:{t:'str|num'},section:{t:'str'},group:{t:'str'},
    confirmation:{t:'bool|map'},haptic:{t:'str'},condition:{t:'cond'},then:{t:'action'},else:{t:'action'}},open:'fire-dom-event'},
  transform:{keys:{entity:{t:'entity'},attribute:{t:'str'},origin:{t:'str'},transition:{t:'str'},perspective:{t:'len'},map:{t:'map'},from:{t:'map'},to:{t:'map'},spin:{t:'obj:spin'}}},
  spin:{keys:{min_duration:{t:'num|str'},max_duration:{t:'num|str'},axis:{t:'enum:x|y|z'},reverse:{t:'bool'},min_value:{t:'num'},max_value:{t:'num'}}},
  // ---------------------------------------------------------------- elements
  overlay:{keys:Object.assign({id:{t:'str',req:true},image:{t:'url'},state_images:{t:'list:stateImage'},conditions:{t:'obj:overlayConds'},
    transition:{t:'str'},z_index:{t:'num'},animation:{t:'enum:none|pulse|blink'},color_from:{t:'entity'},transform:{t:'obj:transform',since:'6.7.0'},className:{t:'str'}},VIS,COCKPIT,PROF_OVR)},
  stateImage:{keys:{entity:{t:'entity'},attribute:{t:'str'},state:{t:'any'},image:{t:'url'}}},
  overlayConds:{keys:{opacity:{t:'list:condVal'},filter:{t:'list:condVal'}}},
  zone:{keys:Object.assign({},POS,ACTS,VIS,COCKPIT,{slider:{t:'obj:slider'}},PROF_OVR)},
  slider:{keys:{entity:{t:'entity'},action:{t:'str'},attribute:{t:'str'},direction:{t:'enum:horizontal|vertical'},min:{t:'num'},max:{t:'num'},step:{t:'num'},
    live:{t:'bool'},invert:{t:'bool'},color:{t:'color'},service:{t:'str'},data:{t:'map'}}},
  badge:{keys:Object.assign({id:{t:'str',req:true},position:{t:'enum:top-left|top-right|bottom-left|bottom-right'},icon:{t:'str'},icon_color:{t:'color|list:condVal'},
    label:{t:'str|list:condVal'},label_template:{t:'tmpl'},animation:{t:'enum:none|pulse|blink'},animation_color:{t:'color'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  icon:{keys:Object.assign({},POS,{icon:{t:'str|list:condVal'},entity:{t:'entity'},attribute:{t:'str'},size:{t:'len'},color:{t:'color|list:condVal'},background:{t:'color'},
    chip:{t:'bool'},section_status:{t:'bool',since:'6.16.0'},animation:{t:'str'},animation_color:{t:'color'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  label:{keys:Object.assign({},POS,{entity:{t:'entity'},attribute:{t:'str'},template:{t:'tmpl'},text:{t:'str'},prefix:{t:'str'},suffix:{t:'str'},unit:{t:'str'},
    decimals:{t:'num'},format:{t:'str'},unavailable_text:{t:'str'},color:{t:'color|list:condVal'},color_gradient:{t:'list:gradStop'},
    background:{t:'color'},padding:{t:'str'},border_radius:{t:'len'},font_size:{t:'len'},font_weight:{t:'str|num'},font_family:{t:'str'},text_shadow:{t:'str'},
    orientation:{t:'str'},animation:{t:'str'},animation_color:{t:'color'},alert_conditions:{t:'cond'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  gauge:{keys:Object.assign({},POS,{entity:{t:'entity'},attribute:{t:'str'},min:{t:'num'},max:{t:'num'},
    orientation:{t:'enum:vertical|top|horizontal|left|right|radial'},color:{t:'color'},color_gradient:{t:'list:gradStop'},background:{t:'color'},border_radius:{t:'len'},
    arc:{t:'num'},thickness:{t:'len'},target:{t:'num|entity'},target_color:{t:'color'},
    animation:{t:'str'},animation_color:{t:'color'},alert_conditions:{t:'cond'},transition:{t:'str'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  blind:{keys:Object.assign({},POS,{entity:{t:'entity'},attribute:{t:'str'},min:{t:'num'},max:{t:'num'},
    blind_type:{t:'enum:roller|venetian|day_night'},slat_color:{t:'color'},slat_count:{t:'num'},slat_gap:{t:'len'},slat_width:{t:'len'},gap_color:{t:'color'},
    top_offset:{t:'num',since:'5.1.0'},shift_turns:{t:'num'},shift_start:{t:'num'},shift_snap:{t:'bool'},shift_legacy:{t:'bool'},
    icon:{t:'str'},label:{t:'str'},label_template:{t:'tmpl'},value:{t:'any'},animation:{t:'str'},animation_color:{t:'color'},
    control:{t:'bool|obj:coverControl'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  coverControl:{keys:{placement:{t:'prof:bool|enum:off|float|dock'},display:{t:'prof:bool|enum:off|popover|float|dock',legacy:true},slider:{t:'bool'},presets:{t:'list:coverPreset'},buttons:{t:'any'},
    name:{t:'str'},top:{t:'len'},left:{t:'len'},width:{t:'len'},height:{t:'len'},position:{t:'str'}}},
  coverPreset:{keys:{position:{t:'num'},icon:{t:'str'},color:{t:'color'},name:{t:'str'}}},
  element:{keys:Object.assign({},POS,{card:{t:'card'},overflow:{t:'str'},border_radius:{t:'len'},background:{t:'color'}},ACTS,VIS,COCKPIT,PROF_OVR),fromEl:true},
  glow:{keys:Object.assign({},POS,{entity:{t:'entity'},size:{t:'len'},shape:{t:'enum:circle|ellipse|wash'},angle:{t:'num|str'},intensity:{t:'num'},
    falloff:{t:'enum:soft|tight|wide'},color:{t:'color'},fallback_color:{t:'color'},blend:{t:'str'},animation:{t:'enum:none|flicker|pulse'},animation_speed:{t:'str'},
    min_brightness:{t:'num'},anchor:{t:'enum:center|corner'},transition:{t:'str'}},VIS,COCKPIT,PROF_OVR)},
  group:{keys:Object.assign({id:{t:'str',req:true},grouping_code:{t:'str|num'},style:{t:'map'},visible:{t:'bool'}},PROF_OVR)},
  vacuumWidget:{keys:Object.assign({},POS,{size:{t:'len'},vacuums:{t:'list:vacuumRef'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  vacuumRef:{keys:{entity:{t:'entity'},name:{t:'str'}}},
  lightControls:{keys:{entities:{t:'list:lightEntity'},style:{t:'enum:native'},columns:{t:'num'},height:{t:'prof:len'},
    lux_sensor:{t:'entity'},lux_max:{t:'num'},color_low:{t:'color'},color_high:{t:'color'},bg_off:{t:'color'},top:{t:'len'},left:{t:'len'}}},
  lightEntity:{keys:{entity:{t:'entity'},name:{t:'str'},icon:{t:'str'}},scalar:'entity'},
  // ---------------------------------------------------------------- nav
  nav:{keys:{style:{t:'enum:thumbnails|tabs|dots|none'},position:{t:'enum:top|bottom|left|right'},live:{t:'enum:off|composite|full|custom'},
    height:{t:'len'},width:{t:'len'},mobile_height:{t:'len'},rows:{t:'prof:num'},cards_position:{t:'prof:enum:side|below'},
    wheel:{t:'bool|enum:horizontal|vertical|both'},follow_button:{t:'bool'},dim_inactive:{t:'bool'},chips:{t:'list:navChip'},cards:{t:'list:companion'},
    mini:{t:'obj:navMini'},auto_breakpoint:{t:'any',legacy:true}}},
  navMini:{keys:{width_ref:{t:'num'},templates:{t:'bool'},camera_refresh:{t:'num'}}},
  navChip:{keys:{entity:{t:'entity'},attribute:{t:'str'},template:{t:'tmpl'},icon:{t:'str'},prefix:{t:'str'},suffix:{t:'str'},decimals:{t:'num'},format:{t:'str'},
    color:{t:'color'},color_gradient:{t:'list:gradStop'},background:{t:'color'},border_radius:{t:'len'},padding:{t:'str'},
    active_state:{t:'any'},tap_action:{t:'action'},hold_action:{t:'action'}},scalar:'entity'},
  // ---------------------------------------------------------------- cockpit sections (v6.8.0)
  section:{keys:{id:{t:'str',req:true},title:{t:'str'},icon:{t:'str'},subtitle:{t:'str'},placement:{t:'enum:sheet-right|sheet-bottom|full|dialog'},
    placement_portrait:{t:'enum:screen|inline'},size:{t:'len'},columns:{t:'num'},badge:{t:'enum:auto|none'},backdrop:{t:'bool'},
    visible_template:{t:'tmpl'},source:{t:'enum:auto'},domain:{t:'str'},card:{t:'card'},tiles:{t:'list:tile'}}},
  tile:{keys:{id:{t:'str'},name:{t:'str'},entity:{t:'entity'},icon:{t:'str'},icon_animation:{t:'enum:none|spin|pulse|blink'},state:{t:'tmpl'},
    state_class:{t:'enum:auto|run|done|'},active_state:{t:'any'},value:{t:'tmpl'},progress:{t:'entity'},progress_always:{t:'bool'},quick:{t:'list:quick'},
    tap_action:{t:'action'},hold_action:{t:'action'},double_tap_action:{t:'action'},hold_delay:{t:'num'},
    image:{t:'url'},image_ratio:{t:'str'},overlays:{t:'list:tileOverlay'}}},
  quick:{keys:{name:{t:'str'},icon:{t:'str'},service:{t:'str'},data:{t:'map'},target:{t:'map'}}},
  tileOverlay:{keys:{id:{t:'str'},image:{t:'url'},state_images:{t:'list:stateImage'},conditions:{t:'obj:overlayConds'},transition:{t:'str'},transform:{t:'obj:transform'}}},
  // ---------------------------------------------------------------- overview page (v6.30.0)
  overview:{keys:{background:{t:'url'},transition:{t:'enum:zoom|fade|none'},transition_duration:{t:'num|str'},gap:{t:'len'},padding:{t:'len'},
    header:{t:'obj:ovHeader'},left:{t:'obj:ovSide'},right:{t:'obj:ovSide'},grid:{t:'obj:ovGrid'},dock:{t:'obj:ovDock'}}},
  ovHeader:{keys:{height:{t:'len'},items:{t:'list:ovHeaderItem'}}},
  ovHeaderItem:{keys:{pill:{t:'obj:ovPill'},nav_cards:{t:'bool'},card:{t:'card'},width:{t:'len'},media:{t:'enum:landscape|portrait|all'},type:{t:'str'}},open:'type'},
  ovPill:{keys:{entity:{t:'entity'},attribute:{t:'str'},template:{t:'tmpl'},icon:{t:'str'},prefix:{t:'str'},suffix:{t:'str'},decimals:{t:'num'},format:{t:'str'},
    color:{t:'color'},text:{t:'str'},tap_action:{t:'action'},hold_action:{t:'action'},double_tap_action:{t:'action'}}},
  ovSide:{keys:{width:{t:'len'},portrait:{t:'enum:top|bottom|hidden'},cards:{t:'list:ovSideCard'}}},
  ovSideCard:{keys:{card:{t:'card'},height:{t:'len'},media:{t:'enum:landscape|portrait|all'},type:{t:'str'}},open:'type'},
  ovGrid:{keys:{rooms:{t:'list:str'},columns:{t:'prof:num'},style:{t:'prof:enum:card|row'},live:{t:'enum:inherit|full|custom|composite|off'},
    width_ref:{t:'num|enum:auto'},chips_max:{t:'prof:num'},info:{t:'bool'},names:{t:'bool',since:'6.31.0'},gap:{t:'len'},fill:{t:'bool'},
    min_height:{t:'len'},aspect_ratio:{t:'str'}}},
  ovDock:{keys:{sections:{t:'list:str'},size:{t:'len'}}},
  overviewTile:{keys:{name:{t:'str'},hidden:{t:'bool'},focus:{t:'str'},chips:{t:'enum:auto|none|list:ovChip'},show_name:{t:'bool',since:'6.31.0'},
    tap_action:{t:'action'},hold_action:{t:'action'},double_tap_action:{t:'action'},hold_delay:{t:'num'}}},
  ovChip:{keys:{entity:{t:'entity'},icon:{t:'str'},active_state:{t:'any'},tap_action:{t:'action'},hold_action:{t:'action'}},scalar:'entity'},
};

// ---- validator ----------------------------------------------------------------
// rocValidate(config) → [{path, level: 'error'|'warn'|'info', msg}]
//   error: a value of the wrong type / outside an enum on a key the schema knows
//   warn:  a key the schema does not know (typo, removed feature, or a schema gap)
//   info:  a legacy v3 key the card migrates on load
const LEN_RE=/^-?\d*\.?\d+(px|%|em|rem|vh|vw|vmin|vmax|fr|ch)?$|^(auto|calc\(.+\)|min\(.+\)|max\(.+\)|clamp\(.+\)|var\(.+\))$/;
function typeOk(t,v,path,out){
  const alts=t.startsWith('prof:')?[t]:splitAlts(t);
  for(const a of alts){if(single(a,v,path,null)){if(out)single(a,v,path,out);return true;}}
  // report with the most specific alternative that structurally matches
  const objAlt=alts.find(a=>(a.startsWith('obj:')&&isObj(v))||(a.startsWith('list:')&&Array.isArray(v))||(a.startsWith('prof:')&&isObj(v)));
  if(objAlt){single(objAlt,v,path,out);return true;}
  out.push({path,level:'error',msg:'expected '+t+', got '+JSON.stringify(v).slice(0,60)});
  return false;
}
function splitAlts(t){ // 'enum:a|b|obj:x' → ['enum:a|b','obj:x']
  const parts=t.split('|');const out=[];
  for(const p of parts){
    const prev=out.length?out[out.length-1]:'';
    // inside an enum every bare word is a value ('url', 'none'…), only `x:` starts a new type
    if(prev.includes('enum:')&&!/^(enum|obj|list|prof):/.test(p))out[out.length-1]+='|'+p;
    else out.push(p);
  }
  return out;
}
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function single(a,v,path,out){
  if(a==='any'||a==='card'||a==='map')return a!=='map'||isObj(v);
  if(a==='str'||a==='url'||a==='entity'||a==='tmpl')return typeof v==='string';
  if(a==='color')return typeof v==='string';
  if(a==='num')return typeof v==='number'||(typeof v==='string'&&/^-?\d*\.?\d+$/.test(v.trim()));
  if(a==='bool')return typeof v==='boolean';
  if(a==='len')return typeof v==='number'||(typeof v==='string'&&(LEN_RE.test(v.trim())||/^[\d.]+(px|%)\s*$/.test(v.trim())));
  if(a.startsWith('enum:'))return a.slice(5).split('|').includes(typeof v==='string'?v:String(v));
  if(a==='action'){if(!isObj(v))return false;if(out)obj('action',v,path,out);return true;}
  if(a==='cond'){if(!isObj(v))return false;if(out)obj('cond',v,path,out);return true;}
  if(a.startsWith('obj:')){if(!isObj(v))return false;if(out)obj(a.slice(4),v,path,out);return true;}
  if(a.startsWith('list:')){
    if(!Array.isArray(v))return false;
    if(out){const it=a.slice(5);v.forEach((x,i)=>{
      const T=S[it];
      if(T&&T.scalar&&typeof x==='string')return;                 // short form: '- light.x'
      if(T)return isObj(x)?obj(it,x,path+'['+i+']',out):out.push({path:path+'['+i+']',level:'error',msg:'expected an object ('+it+')'});
      typeOk(it,x,path+'['+i+']',out);
    });}
    return true;
  }
  if(a.startsWith('prof:')){
    const inner=a.slice(5);
    if(isObj(v)&&(('portrait'in v)||('landscape'in v))&&!inner.startsWith('obj:')){
      if(out)for(const k in v){if(k!=='portrait'&&k!=='landscape'){out.push({path:path+'.'+k,level:'warn',msg:'unknown profile key (portrait / landscape)'});continue}typeOk(inner,v[k],path+'.'+k,out);}
      return true;
    }
    return out?typeOk(inner,v,path,out):splitAlts(inner).some(x=>single(x,v,path,null));
  }
  return false;
}
function obj(type,v,path,out,self){
  const T=S[type];if(!T)return;
  if(T.open&&(T.open===true||(typeof T.open==='string'&&(v.action===T.open||v.type!==undefined&&T.open==='type'&&!v.card))))return; // open-ended (embedded card configs, fire-dom-event)
  for(const k of Object.keys(v)){
    let d=T.keys[k];
    if(!d&&type==='card')d=S.room.keys[k]&&S.room.keys[k].room?S.room.keys[k]:null;
    const p=path?path+'.'+k:k;
    if(!d){out.push({path:p,level:'warn',msg:'unknown key'});continue}
    if(d.legacy){out.push({path:p,level:'info',msg:'v3 key — migrated on load'});continue}
    if(d.t==='self'){if(isObj(v[k]))obj(type,v[k],p,out,true);continue}
    typeOk(d.t,v[k],p,out);
  }
  if(!self)for(const k in T.keys)if(T.keys[k].req&&v[k]===undefined)out.push({path:(path?path+'.':'')+k,level:'warn',msg:'missing required key'});
}
function rocValidate(cfg){const out=[];if(!isObj(cfg))return[{path:'',level:'error',msg:'config must be an object'}];obj('card',cfg,'',out);return out;}
// every key name the schema knows, per type (for coverage tests and the docs generator)
function rocSchemaKeys(){const o={};for(const t in S)o[t]=Object.keys(S[t].keys);return o;}
const api={ROC_SCHEMA:S,rocValidate,rocSchemaKeys};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(root,api);
})(typeof window!=='undefined'?window:globalThis);
return module.exports;
})({exports:{}});
// ---- Strings (V7_PLAN §5.8: EN first; CS is added before 7.0.0) ----------------------------
// Every user-visible studio string goes through t(). Language comes from hass.language; a
// language without a table (or a missing key) falls back to English.
const ROC_STUDIO_STR={en:{
  title:'Room Card Studio',
  room:'Room',global:'Global (all rooms)',
  frame_fit:'Fit',frame_landscape:'Tablet',frame_portrait:'Tablet portrait',frame_phone:'Phone',
  frame_hint:'Preview size — the card picks its layout profile from this frame like it does from a screen',
  mode_arrange:'Arrange',mode_arrange_hint:'Edit mode: drag elements on the canvas, tap/hold actions do nothing',
  mode_live:'Live',mode_live_hint:'The card exactly as on the dashboard — taps run their real actions',
  undo:'Undo (Ctrl+Z)',redo:'Redo (Ctrl+Y)',yaml:'YAML',history:'History',close:'Close (Esc)',
  outline:'Outline',inspector:'Inspector',
  apply:'Apply & close',apply_hint:'Hand the config back to Home Assistant\'s card editor — then press Save there',
  save:'Save',save_hint:'Save this card to the dashboard (Ctrl+S)',
  copy_yaml:'Copy YAML',
  rooms:'Rooms',elements:'Elements',inherited:'shared',
  k_overlays:'Overlay images',k_zones:'Zones',k_badges:'Badges',k_icons:'Icons',k_labels:'Labels',k_gauges:'Gauges',
  k_glows:'Light glows',k_blinds:'Blinds',k_elements:'Embedded cards',k_groups:'Groups',k_vacuum_widgets:'Vacuum widgets',
  k_lights:'Light controls',
  valid_ok:'No problems',valid_err:'{e} errors',valid_warn:'{w} warnings',
  valid_title:'Config check',valid_none:'The schema found nothing to report.',
  dirty:'Unsaved changes',clean:'No unsaved changes',saved_at:'Saved {t}',applied:'Applied',
  tgt_editor:'Returns to HA\'s card editor',tgt_dash:'Saves to dashboard “{d}” · {p}',tgt_yaml:'Read-only — copy the YAML ({r})',
  r_admin:'not an administrator',r_yaml:'YAML-mode dashboard',r_strategy:'generated dashboard',r_notfound:'card not found in the dashboard',r_nows:'no connection to Home Assistant',
  guard_title:'Unsaved changes',guard_body:'Close the studio and lose the changes made here?',
  discard:'Discard changes',keep:'Keep editing',
  conflict_title:'The card changed elsewhere',
  conflict_body:'Someone (another tab or device) changed this card on the dashboard after the studio opened it. Saving now would overwrite that change.',
  overwrite:'Overwrite anyway',cancel:'Cancel',
  save_failed:'Save failed: {m}',saving:'Saving…',
  yaml_title:'Card YAML',yaml_body:'The full card config as it is in the studio right now.',copied:'Copied',copy:'Copy',
  hist_title:'Restore a previous version',hist_body:'The last 10 versions saved or applied from the studio in this browser (a convenience, not a backup).',
  hist_empty:'Nothing saved from the studio in this browser yet.',restore:'Restore',
  canvas_err:'The card cannot render this config: {m}',
  ver_mismatch:'Studio v{s} with card v{c} — reload the page (browser cache)',
  // Phase 3 (v6.42.0)
  add:'Add',add_hint:'Add an element — then click or drag on the image to place it',add_title:'Add an element',
  add_body:'Pick a type. Elements that sit on the image are placed with a click (or a drag for a box); the others are added to the inspector.',
  add_body_room:'Pick a type. It is added to the room shown — switch to Global first for an element every room shares. Elements on the image are placed with a click (or a drag for a box).',
  t_zone:'Zone',t_icon:'Icon',t_label:'Label',t_gauge:'Gauge',t_glow:'Light glow',t_blind:'Blind',t_element:'Embedded card',
  t_vacuum_widget:'Vacuum widget',t_badge:'Badge',t_overlay:'Overlay image',t_group:'Group',
  place_hint:'{t}: click on the image, or drag a box — Esc cancels',
  dup:'Duplicate',dup_hint:'Duplicate (Ctrl+D)',copy_hint:'Copy (Ctrl+C) — paste into any room or card',
  del:'Delete',del_hint:'Delete (Del)',paste:'Paste',paste_hint:'Paste (Ctrl+V) into the room shown',
  search_ph:'Search elements…',no_match:'Nothing matches.',no_elements:'No elements yet — Add places the first one.',
  // Phase 3b (v6.43.0)
  n_selected:'{n} selected',
  al_left:'Align left edges',al_center:'Align centres (horizontally)',al_right:'Align right edges',
  al_top:'Align top edges',al_middle:'Align middles (vertically)',al_bottom:'Align bottom edges',
  dist_h:'Distribute horizontally (equal gaps)',dist_v:'Distribute vertically (equal gaps)',
  al_skipped:'{n} not moved (position not in %)',
  copy_suffix:'(copy)',room_dup:'Duplicate this room',room_copy:'Copy this room (paste into any card)',
  room_del:'Delete room',room_del_title:'Delete the room “{r}”?',room_del_body:'The room and everything in it is removed from the card. Undo brings it back.',
  room_paste:'Paste room “{r}”',
  layer_hide:'Hide on the canvas (studio only)',layer_show:'Show on the canvas',layer_lock:'Lock — cannot be selected or dragged',layer_unlock:'Unlock',
  // Phase 4a (v6.44.0) — the Properties form
  tab_props:'Properties',tab_props_hint:'The selected element (or the room) as a form',
  tab_all:'All settings',tab_all_hint:'The complete classic editor — every option, including the ones the Properties form does not show yet',
  open_all:'Open in All settings',card_form:'Card',
  props_multi:'{n} selected — the form edits “{id}”',
  props_card_hint:'Select an element on the canvas or in the outline to edit it here. Layout, sections and the rest of the card settings are in All settings.',
  props_global_hint:'These are the defaults every room falls back to. Select an element, or a room in the outline, to edit it here.',
  ent_missing:'Not found in Home Assistant',dflt:'default',not_set:'not set',choose:'choose',
  f_entity:'Entity',f_path:'Path',f_service:'Action',f_target:'Target entity',f_data:'Data (YAML)',f_section:'Section',f_group:'Group',
  one_value:'One value for both profiles',as_simple:'Use a single value',per_profile:'Different per profile (portrait / landscape)',as_conditions:'Depends on a state…',
  g_main:'General',g_position:'Position & size',g_actions:'Actions',g_visibility:'Visibility',g_advanced:'Advanced (YAML)',g_room_more:'More (YAML)',
  adv_hint:'Profile overrides (portrait / landscape) and keys the form does not list — kept exactly as they are',
  adv_room_hint:'Room keys the schema does not know — kept exactly as they are',
  room_more_hint:'The overview tile, navigation chips, weather, the lighting model and the room\'s cards are in All settings for now.',
  mark_err:'Has errors',mark_warn:'Has warnings',
}};
function rocT(lang,key,vars){
  const tb=ROC_STUDIO_STR[lang]||ROC_STUDIO_STR.en;
  let s=tb[key];if(s==null)s=ROC_STUDIO_STR.en[key];if(s==null)s=key;
  if(vars)s=s.replace(/\{(\w+)\}/g,function(m,k){return vars[k]!=null?String(vars[k]):m;});
  return s;
}

// ---- Small DOM / data helpers --------------------------------------------------------------
function rsEl(tag,attrs,kids){
  const e=document.createElement(tag);
  if(attrs)for(const k in attrs){
    const v=attrs[k];if(v==null||v===false)continue;
    if(k==='text')e.textContent=v;
    else if(k==='html')e.innerHTML=v;
    else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v===true?'':v);
  }
  (kids||[]).forEach(function(c){if(c!=null)e.appendChild(typeof c==='string'?document.createTextNode(c):c);});
  return e;
}
function rsIcon(name){return rsEl('ha-icon',{icon:name});}
// next node up the composed tree (crosses shadow-root boundaries)
function rsUp(n){return n.parentNode||n.host||null;}
function rsFindUp(start,pred){let n=start,g=0;while(n&&g++<300){if(n.nodeType===1&&pred(n))return n;n=rsUp(n);}return null;}
function rsDeepFind(root,pred){
  const q=[root];let g=0;
  while(q.length&&g++<20000){const x=q.shift();if(!x)continue;if(x.nodeType===1&&pred(x))return x;if(x.shadowRoot)q.push(x.shadowRoot);const ch=x.children||[];for(let i=0;i<ch.length;i++)q.push(ch[i]);}
  return null;
}
// path of `needle` inside `root` by object identity, e.g. ['views',7,'cards',0]
function rsPathOf(root,needle){
  let found=null;
  (function walk(o,p){
    if(found||!o||typeof o!=='object')return;
    if(o===needle){found=p;return;}
    for(const k of Object.keys(o))walk(o[k],p.concat(Array.isArray(o)?+k:k));
  })(root,[]);
  return found;
}
function rsAt(o,path){return path.reduce(function(a,k){return a==null?a:a[k];},o);}
function rsJ(o){return JSON.stringify(o);}
function rsTime(ms){const d=new Date(ms);const p=function(n){return String(n).padStart(2,'0');};return p(d.getHours())+':'+p(d.getMinutes());}
function rsDate(ms){const d=new Date(ms);return d.toLocaleDateString()+' '+rsTime(ms);}
// ---- Styles (inside the studio's own shadow root; HA's theme variables inherit from <html>) ---
const ROC_STUDIO_CSS=`
:host{all:initial;display:block;position:fixed;inset:0;font-family:var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif);font-size:14px;color:var(--primary-text-color,#e8eaed);
  --rs-bg:var(--primary-background-color,#111418);--rs-panel:var(--card-background-color,#1c1f24);--rs-sub:var(--secondary-background-color,#24282e);
  --rs-line:var(--divider-color,rgba(255,255,255,.12));--rs-acc:var(--primary-color,#03a9f4);--rs-txt2:var(--secondary-text-color,#9aa3ad);
  --rs-err:var(--error-color,#db4437);--rs-warn:var(--warning-color,#ffa600);--rs-ok:var(--success-color,#43a047);}
*{box-sizing:border-box;}
button{font:inherit;color:inherit;}
ha-icon{--mdc-icon-size:18px;display:inline-flex;}
.app{position:absolute;inset:0;display:grid;background:var(--rs-bg);
  grid-template-columns:230px minmax(0,1fr) minmax(380px,34%);grid-template-rows:auto minmax(0,1fr) auto;
  grid-template-areas:"bar bar bar" "outline canvas insp" "status status status";}
.bar{grid-area:bar;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--rs-panel);border-bottom:1px solid var(--rs-line);flex-wrap:wrap;min-width:0;}
.brand{font-weight:600;white-space:nowrap;display:flex;align-items:baseline;gap:6px;margin-right:6px;}
.brand small{font-weight:400;font-size:11px;color:var(--rs-txt2);}
.sp{flex:1;}
.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--rs-line);background:none;cursor:pointer;white-space:nowrap;}
.btn:hover:not([disabled]){background:var(--rs-sub);}
.btn[disabled]{opacity:.38;cursor:default;}
.btn.icon{padding:0 7px;}
.btn.primary{background:var(--rs-acc);border-color:var(--rs-acc);color:#fff;font-weight:600;}
.btn.primary:hover:not([disabled]){filter:brightness(1.1);background:var(--rs-acc);}
.btn.danger{border-color:var(--rs-err);color:var(--rs-err);}
.btn:focus-visible,.seg button:focus-visible,select:focus-visible,.ol-item:focus-visible{outline:2px solid var(--rs-acc);outline-offset:1px;}
select.room{height:32px;border-radius:8px;border:1px solid var(--rs-line);background:var(--rs-panel);color:inherit;padding:0 8px;max-width:220px;}
.seg{display:inline-flex;border:1px solid var(--rs-line);border-radius:8px;overflow:hidden;}
.seg button{border:none;background:none;height:30px;padding:0 10px;cursor:pointer;white-space:nowrap;color:var(--rs-txt2);}
.seg button+button{border-left:1px solid var(--rs-line);}
.seg button[aria-pressed="true"]{background:var(--rs-sub);color:var(--rs-acc);font-weight:600;}
.narrow-only{display:none;}
.outline{grid-area:outline;overflow:auto;border-right:1px solid var(--rs-line);background:var(--rs-panel);padding:10px 8px;}
.ol-h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--rs-txt2);margin:10px 6px 6px;}
.ol-h:first-child{margin-top:2px;}
.ol-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer;color:inherit;}
.ol-item:hover{background:var(--rs-sub);}
.ol-item[aria-current="true"]{background:var(--rs-sub);color:var(--rs-acc);font-weight:600;}
.ol-item .n{margin-left:auto;font-size:12px;color:var(--rs-txt2);font-variant-numeric:tabular-nums;}
.ol-item .tag{font-size:10px;color:var(--rs-txt2);border:1px solid var(--rs-line);border-radius:4px;padding:0 4px;}
.ol-item.empty{opacity:.45;}
.ol-search{width:100%;height:30px;margin:0 0 6px;padding:0 8px;border-radius:6px;border:1px solid var(--rs-line);background:var(--rs-bg);color:inherit;font:inherit;font-size:13px;}
.ol-kind{font-weight:600;margin-top:4px;}
.ol-el{padding:4px 8px 4px 34px;font-size:13px;gap:6px;}
.ol-el .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ol-el .sub{margin-left:auto;font-size:11px;color:var(--rs-txt2);max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ol-empty{font-size:12px;color:var(--rs-txt2);padding:6px 8px;}
.ol-row{display:flex;align-items:center;gap:2px;}
.ol-row>.ol-item{flex:1;min-width:0;}
.ol-act{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;border-radius:6px;cursor:pointer;color:var(--rs-txt2);}
.ol-act:hover{background:var(--rs-sub);color:var(--primary-text-color,#e8eaed);}
.ol-act.on{color:var(--rs-acc);}
.ol-act.danger:hover{color:var(--rs-err);}
.ol-act ha-icon{--mdc-icon-size:17px;}
.ol-kindrow.hid .ol-kind,.ol-el.hid{opacity:.45;}
.ol-paste{color:var(--rs-acc);}
.selbar .aligns button{height:26px;padding:0 6px;}
.selbar .aligns ha-icon{--mdc-icon-size:17px;}
.selbar .hint.warn{color:var(--rs-warn);font-weight:400;}
.cv-bar{min-height:36px;}
.selbar{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.selbar .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;background:var(--rs-sub);color:var(--primary-text-color,#e8eaed);}
.selbar .hint{color:var(--rs-acc);font-weight:600;}
.btn.sm{height:26px;padding:0 8px;font-size:12px;gap:4px;}
.btn.sm ha-icon{--mdc-icon-size:16px;}
.place{position:absolute;inset:0;z-index:30;cursor:crosshair;touch-action:none;}
.place-box{position:absolute;display:none;border:2px dashed var(--rs-acc);background:rgba(3,169,244,.12);pointer-events:none;}
.addgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:10px;}
.addbtn{height:40px;justify-content:flex-start;}
.canvas{grid-area:canvas;position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;}
.cv-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:12px;color:var(--rs-txt2);border-bottom:1px solid var(--rs-line);flex-wrap:wrap;}
.stage{position:relative;flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:16px;
  background:repeating-conic-gradient(rgba(127,127,127,.06) 0 25%,transparent 0 50%) 0 0/24px 24px;}
.fbox{position:relative;flex:none;}
.frame{position:absolute;left:0;top:0;transform-origin:0 0;overflow:auto;background:var(--rs-bg);box-shadow:0 0 0 1px var(--rs-line),0 10px 40px rgba(0,0,0,.45);border-radius:6px;}
.frame>room-overlay-card{display:block;height:100%;}
.cv-err{position:absolute;inset:16px;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--rs-txt2);}
.insp{grid-area:insp;display:flex;flex-direction:column;overflow:hidden;border-left:1px solid var(--rs-line);background:var(--rs-panel);min-width:0;}
.itabs{flex:none;display:flex;border-bottom:1px solid var(--rs-line);padding:0 8px;}
.itabs button{border:none;background:none;padding:10px 12px;cursor:pointer;color:var(--rs-txt2);border-bottom:2px solid transparent;margin-bottom:-1px;}
.itabs button[aria-selected="true"]{color:var(--rs-acc);border-bottom-color:var(--rs-acc);font-weight:600;}
.itabs button:focus-visible{outline:2px solid var(--rs-acc);outline-offset:-2px;}
.ipane{flex:1;min-height:0;overflow:auto;}
.ipane[hidden]{display:none;}
.props{padding:10px 12px 28px;display:flex;flex-direction:column;gap:8px;}
.pf-head{display:flex;align-items:center;gap:8px;padding:2px;min-width:0;}
.pf-head>ha-icon{--mdc-icon-size:22px;color:var(--rs-acc);flex:none;}
.pf-title{font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pf-type{color:var(--rs-txt2);font-size:12px;white-space:nowrap;}
.pf-head .tag{font-size:10px;color:var(--rs-txt2);border:1px solid var(--rs-line);border-radius:4px;padding:0 4px;}
.pf-head .pf-open{margin-left:auto;flex:none;}
.pf-note{font-size:12px;color:var(--rs-txt2);line-height:1.45;padding:2px 4px;}
.pf-sec{border:1px solid var(--rs-line);border-radius:10px;background:var(--rs-bg);}
.pf-sec>summary{cursor:pointer;padding:9px 12px;font-weight:600;display:flex;align-items:center;gap:8px;list-style:none;user-select:none;}
.pf-sec>summary::-webkit-details-marker{display:none;}
.pf-sec>summary::before{content:'';width:0;height:0;border:4px solid transparent;border-left:6px solid var(--rs-txt2);margin-right:-2px;transition:transform .15s;}
.pf-sec[open]>summary::before{transform:rotate(90deg) translateX(2px);}
.pf-sec>summary .n{margin-left:auto;font-size:11px;font-weight:400;color:var(--rs-txt2);}
.pf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;padding:4px 12px 12px;}
.pf-idrow{padding:0;}
.pf-field{display:flex;flex-direction:column;gap:4px;min-width:0;}
.pf-field.wide{grid-column:1/-1;}
.pf-l{font-size:12px;color:var(--rs-txt2);}
.pf-in{width:100%;height:32px;padding:0 8px;border-radius:6px;border:1px solid var(--rs-line);background:var(--rs-panel);color:inherit;font:inherit;font-size:13px;min-width:0;}
select.pf-in{padding:0 4px;}
textarea.pf-in{height:auto;padding:6px 8px;resize:vertical;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;}
.pf-in:focus{outline:2px solid var(--rs-acc);outline-offset:-1px;}
.pf-field.has-error>.pf-in,.pf-field.has-error .pf-ent .pf-in,.pf-field.has-error .pf-yaml .pf-in{border-color:var(--rs-err);}
.pf-cb{width:18px;height:18px;margin:6px 0;accent-color:var(--rs-acc);}
.pf-sub{font-size:11px;color:var(--rs-txt2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pf-sub:empty{display:none;}
.pf-sub.warn{color:var(--rs-warn);}
.pf-ent{display:flex;flex-direction:column;gap:3px;}
.pf-msg{font-size:11px;line-height:1.35;}
.pf-msg:empty{display:none;}
.pf-msg.error{color:var(--rs-err);}
.pf-msg.warn{color:var(--rs-warn);}
.pf-color,.pf-icon,.pf-url,.pf-prof{display:flex;gap:6px;align-items:center;}
.pf-color input[type=color]{width:36px;height:32px;padding:0 2px;border:1px solid var(--rs-line);border-radius:6px;background:none;flex:none;cursor:pointer;}
.pf-color input[type=color].unset{opacity:.3;}
.pf-icon .rs-pick,.pf-url .pf-in,.pf-prof>.pf-in,.pf-prof>.rs-pick,.pf-prof>.pf-ent{flex:1;}
.pf-icprev{--mdc-icon-size:22px;width:32px;height:32px;align-items:center;justify-content:center;border:1px solid var(--rs-line);border-radius:6px;flex:none;}
.pf-thumb{width:48px;height:32px;flex:none;border-radius:6px;border:1px solid var(--rs-line);background:center/cover no-repeat var(--rs-sub);}
.pf-tag{font-size:11px;color:var(--rs-txt2);width:64px;flex:none;}
.pf-links{display:flex;gap:12px;flex-wrap:wrap;}
.pf-link{border:none;background:none;padding:0;color:var(--rs-acc);cursor:pointer;font-size:11px;text-align:left;}
.pf-link:hover{text-decoration:underline;}
.pf-act,.pf-yaml{display:flex;flex-direction:column;gap:6px;}
.pf-actbody{display:flex;flex-direction:column;gap:6px;padding-left:10px;border-left:2px solid var(--rs-line);}
.pf-actbody:empty{display:none;}
.pf-sub2{display:flex;flex-direction:column;gap:3px;}
.rs-pick{position:relative;width:100%;min-width:0;}
.rs-list{display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);z-index:20;max-height:260px;overflow:auto;background:var(--rs-panel);border:1px solid var(--rs-line);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.45);}
.rs-pick.open .rs-list{display:block;}
.rs-opt{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 8px;padding:6px 10px;cursor:pointer;font-size:13px;}
.rs-opt.ic{display:flex;align-items:center;gap:8px;}
.rs-opt:hover,.rs-opt.act{background:var(--rs-sub);}
.rs-opt .o-main,.rs-opt .o-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rs-opt .o-sub{grid-column:1;font-size:11px;color:var(--rs-txt2);}
.rs-opt .o-st{grid-column:2;grid-row:1/span 2;align-self:center;font-size:11px;color:var(--rs-txt2);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rs-opt.none{color:var(--rs-txt2);cursor:default;}
.ol-item .vd{width:7px;height:7px;border-radius:50%;flex:none;margin-left:4px;}
.ol-el .vd{order:3;}
.vd.error{background:var(--rs-err);} .vd.warn{background:var(--rs-warn);}
.status{grid-area:status;display:flex;align-items:center;gap:14px;padding:6px 12px;font-size:12px;color:var(--rs-txt2);background:var(--rs-panel);border-top:1px solid var(--rs-line);flex-wrap:wrap;}
.status .vbtn{display:inline-flex;align-items:center;gap:6px;border:none;background:none;cursor:pointer;color:inherit;padding:2px 4px;border-radius:4px;}
.status .vbtn:hover{background:var(--rs-sub);}
.status .ok{color:var(--rs-ok);} .status .err{color:var(--rs-err);} .status .warn{color:var(--rs-warn);}
.status .dirty{color:var(--rs-warn);font-weight:600;}
.status .tgt{margin-left:auto;}
.layer{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);padding:16px;}
.panel{background:var(--rs-panel);border:1px solid var(--rs-line);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);width:min(560px,100%);max-height:min(80vh,100%);display:flex;flex-direction:column;}
.panel h2{font-size:17px;margin:0;padding:16px 18px 6px;}
.panel .pb{padding:4px 18px 12px;overflow:auto;line-height:1.5;color:var(--rs-txt2);}
.panel .pf{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px 16px;flex-wrap:wrap;}
.panel textarea{width:100%;min-height:42vh;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;background:var(--rs-bg);color:var(--primary-text-color,#e8eaed);border:1px solid var(--rs-line);border-radius:8px;padding:10px;resize:vertical;}
.vl{list-style:none;margin:0;padding:0;display:grid;gap:6px;}
.vl li{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:6px 8px;border-radius:6px;background:var(--rs-sub);}
.vl code{color:var(--primary-text-color,#e8eaed);word-break:break-all;}
.vl .lv{font-size:11px;font-weight:700;text-transform:uppercase;}
.vl .lv.error{color:var(--rs-err);} .vl .lv.warn{color:var(--rs-warn);}
.vl .m{grid-column:2;}
.hl{list-style:none;margin:0;padding:0;display:grid;gap:6px;}
.hl li{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;background:var(--rs-sub);}
.hl li span{flex:1;}
@media (max-width:1100px){
  .app{grid-template-columns:minmax(0,1fr) minmax(340px,44%);grid-template-areas:"bar bar" "canvas insp" "status status";}
  .outline{display:none;position:absolute;z-index:40;left:0;top:0;bottom:0;width:min(280px,80%);box-shadow:8px 0 30px rgba(0,0,0,.4);}
  .app.show-outline .outline{display:block;}
  .narrow-only.ol-t{display:inline-flex;}
}
@media (max-width:700px){
  .app{grid-template-columns:minmax(0,1fr);grid-template-areas:"bar" "canvas" "status";}
  .insp{position:absolute;z-index:40;left:0;right:0;bottom:0;height:72%;border-left:none;border-top:1px solid var(--rs-line);border-radius:14px 14px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.45);transform:translateY(105%);transition:transform .22s ease;}
  .app.show-insp .insp{transform:none;}
  .narrow-only.in-t{display:inline-flex;}
  .bar{gap:6px;padding:6px 8px;}
  .bar>*{flex:none;}
  .bar .lbl,.brand,.seg.frames{display:none;}   /* on a phone the real screen IS the frame */
  select.room{max-width:150px;}
}
@media (prefers-reduced-motion:reduce){.insp{transition:none;}}
`;
// ---- Save targets (V7_PLAN §5.4, D3; spike S3) ---------------------------------------------
// editor    — opened from HA's card editor: the result goes back through that editor's own
//             config-changed (official API, no admin rights or internals needed); HA saves.
// dashboard — opened from the card on the dashboard: saved with lovelace/config/save. The card
//             is located BY OBJECT IDENTITY (hui-card.config is the very object inside
//             lovelace.config), never by card_id, which is not unique in practice. Conflict check:
//             re-read the dashboard and refuse when that path no longer holds what was opened.
// yaml      — anything that cannot be saved (non-admin, YAML-mode or generated dashboard, card
//             not found): read-only, the YAML can be copied.
function rsResolveDashboard(card,hass){
  const raw=card&&card._rocRaw||null;
  const huiCard=card?rsFindUp(card,function(n){return n.tagName==='HUI-CARD'&&n.config&&typeof n.config==='object';}):null;
  const needle=(huiCard&&huiCard.config)||raw;
  let host=card?rsFindUp(card,function(n){return n!==card&&n.lovelace&&n.lovelace.config;}):null;
  if(!host)host=rsDeepFind(document.body,function(n){return n.tagName==='HUI-ROOT'&&n.lovelace&&n.lovelace.config;});
  const ll=host&&host.lovelace;
  if(!ll)return{kind:'yaml',reason:'r_notfound'};
  if(!hass||typeof hass.callWS!=='function')return{kind:'yaml',reason:'r_nows'};
  if(ll.mode==='yaml')return{kind:'yaml',reason:'r_yaml'};
  if((ll.rawConfig||ll.config).strategy)return{kind:'yaml',reason:'r_strategy'};
  let path=needle?rsPathOf(ll.config,needle):null;
  if(!path&&raw&&raw!==needle)path=rsPathOf(ll.config,raw);
  if(!path)return{kind:'yaml',reason:'r_notfound'};
  if(!(hass.user&&hass.user.is_admin))return{kind:'yaml',reason:'r_admin'};
  const v=path[0]==='views'?ll.config.views[path[1]]:null;
  return{
    kind:'dashboard',lovelace:ll,urlPath:ll.urlPath==null?null:ll.urlPath,path:path,
    orig:rsJ(rsAt(ll.config,path)),
    dashName:ll.config.title||ll.urlPath||'Overview',
    where:(v?('view “'+(v.title||v.path||('#'+path[1]))+'”'):'')+' · '+path.join('/'),
  };
}
async function rsSaveDashboard(tgt,hass,cfg,force){
  const fresh=await hass.callWS({type:'lovelace/config',url_path:tgt.urlPath});
  const cur=rsAt(fresh,tgt.path);
  if(!force&&rsJ(cur)!==tgt.orig){const e=new Error('conflict');e.conflict=true;throw e;}
  const nc=JSON.parse(rsJ(fresh));
  const parent=rsAt(nc,tgt.path.slice(0,-1));
  if(!parent||typeof parent!=='object')throw new Error('card position '+tgt.path.join('/')+' no longer exists');
  parent[tgt.path[tgt.path.length-1]]=cfg;
  const ll=tgt.lovelace;
  // lovelace.saveConfig updates the open dashboard immediately (and rolls back on failure);
  // the plain WS call is the fallback when HA's frontend object is not available.
  if(ll&&typeof ll.saveConfig==='function')await ll.saveConfig(nc);
  else await hass.callWS({type:'lovelace/config/save',url_path:tgt.urlPath,config:nc});
  tgt.orig=rsJ(cfg);
}

// "Restore previous version" (§5.4): the last 10 configs saved or applied from the studio, in
// this browser's localStorage — a convenience, not a backup.
function rsHistLoad(k){try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[];}catch(_){return[];}}
function rsHistPush(k,cfg){
  try{
    const a=rsHistLoad(k);const j=rsJ(cfg);
    if(a.length&&a[0].cfg===j)return;
    a.unshift({t:Date.now(),cfg:j});
    localStorage.setItem(k,JSON.stringify(a.slice(0,10)));
  }catch(_){}
}
// ---- Element model (Phase 3, v6.42.0) ------------------------------------------------------
// One row per element type the studio can select, create, copy and delete.
//  key    config list            pre    the editor's item panel prefix (details data-panel="<pre>-<i>")
//  panel  the editor section      canvas the card can select / drag it on the canvas (Arrange mode)
//  draw   'box' = drag a rectangle, 'point' = click (a click on a box type gives the default size)
//  def    defaults for a new one — the same values the editor's own "+ Add" buttons use
//  idp    id prefix of a new one (also the editor's)
const RS_TYPES={
  zone:{key:'zones',pre:'z',panel:'zones',icon:'mdi:gesture-tap',canvas:true,draw:'box',idp:'zone_',def:{width:'10%',height:'10%'}},
  icon:{key:'icons',pre:'ico',panel:'icons',icon:'mdi:star-four-points-outline',canvas:true,draw:'point',idp:'icon_',def:{icon:'mdi:help',size:'24px'}},
  label:{key:'labels',pre:'lbl',panel:'labels',icon:'mdi:format-text',canvas:true,draw:'point',idp:'label_',def:{entity:''}},
  gauge:{key:'gauges',pre:'g',panel:'gauges',icon:'mdi:gauge',canvas:true,draw:'box',idp:'gauge_',def:{width:'2%',height:'20%',entity:'',min:0,max:100}},
  glow:{key:'glows',pre:'gw',panel:'glows',icon:'mdi:lightbulb-on-outline',canvas:true,draw:'point',idp:'glow_',centre:true,def:{entity:'',size:'25%',intensity:0.7}},
  blind:{key:'blinds',pre:'bl',panel:'blinds',icon:'mdi:blinds-horizontal',canvas:true,draw:'box',idp:'blind_',def:{width:'20%',height:'40%',entity:'',min:0,max:100,blind_type:'roller'}},
  element:{key:'elements',pre:'el',panel:'elements',icon:'mdi:card-bulleted-outline',canvas:true,draw:'box',idp:'el_',def:{width:'30%',height:'20%',card:{type:'tile',entity:''}}},
  vacuum_widget:{key:'vacuum_widgets',pre:'vw',panel:'vacuum_widgets',icon:'mdi:robot-vacuum',canvas:true,draw:'point',idp:'vac_',def:{icon:'mdi:robot-vacuum',size:'44px',vacuums:[]}},
  badge:{key:'badges',pre:'b',panel:'badges',icon:'mdi:label-outline',canvas:false,idp:'badge_',def:{position:'bottom-left'}},
  overlay:{key:'overlays',pre:'ov',panel:'overlays',icon:'mdi:layers-outline',canvas:false,idp:'overlay_',def:{image:'',transition:'2s ease'}},
  group:{key:'groups',pre:'grp',panel:'groups',icon:'mdi:dock-window',canvas:false,idp:'group_',def:{visible:false}},
};
const RS_TYPE_ORDER=['zone','icon','label','gauge','glow','blind','element','vacuum_widget','badge','overlay','group'];
const RS_PRE2TYPE={};Object.keys(RS_TYPES).forEach(function(t){RS_PRE2TYPE[RS_TYPES[t].pre]=t;});

// The room object a scope refers to (null = the top level / a single-room card).
function rsRoom(cfg,roomIdx,global){
  return(!global&&Array.isArray(cfg.rooms)&&cfg.rooms.length)?cfg.rooms[Math.max(0,Math.min(roomIdx,cfg.rooms.length-1))]:null;
}
// Where an element of this type lives for the scope: the room's own list, else the inherited
// top-level list (the card's _roomArr does the same since v6.42.0).
function rsOwner(cfg,roomIdx,global,key){
  const r=rsRoom(cfg,roomIdx,global);
  if(r&&Array.isArray(r[key]))return{list:r[key],inherited:false};
  if(Array.isArray(cfg[key]))return{list:cfg[key],inherited:!!r};
  return{list:null,inherited:false};
}
// The list a NEW element goes to: the room's own (a copy of the inherited one first, so nothing
// on screen disappears), or the top level in Global / a single-room card.
function rsListForNew(cfg,roomIdx,global,key){
  const r=rsRoom(cfg,roomIdx,global);
  const t=r||cfg;
  if(!Array.isArray(t[key]))t[key]=(r&&Array.isArray(cfg[key]))?JSON.parse(rsJ(cfg[key])):[];
  return t[key];
}
function rsUniqueId(list,prefix,want){
  const used=new Set((list||[]).map(function(x){return x&&x.id;}));
  if(want&&!used.has(want))return want;
  let base=want?String(want).replace(/_\d+$/,''):prefix.replace(/_$/,'');
  let n=(list||[]).length+1;
  while(used.has(base+'_'+n))n++;
  return base+'_'+n;
}
// shift a percentage position a little (duplicate / paste on top of the original)
function rsNudgePct(v,d){const m=/^(-?\d+(?:\.\d+)?)%$/.exec(String(v==null?'':v));return m?Math.max(0,Math.min(98,parseFloat(m[1])+d)).toFixed(1)+'%':v;}
function rsPct(n){return(Math.round(Math.max(0,Math.min(100,n))*10)/10).toFixed(1)+'%';}
// "%" positions as numbers; NaN for anything else (px, calc(), numbers without a unit…)
function rsPctNum(v){const m=/^\s*(-?\d+(?:\.\d+)?)%\s*$/.exec(String(v==null?'':v));return m?parseFloat(m[1]):NaN;}
// move a "%" position by d percent points (kept inside 0–100); false when it is not a "%" value
function rsShiftPct(item,key,d){
  const n=rsPctNum(item[key]);
  if(!isFinite(n))return false;
  item[key]=rsPct(n+d);
  return true;
}
// a copy of a room for duplicate / paste: unique id, "(copy)" name; area_match is dropped, so a
// presence sensor keeps following the original room
function rsRoomCopy(rooms,room,suffix){
  const r=JSON.parse(rsJ(room));
  const ids=new Set((rooms||[]).map(function(x){return x&&x.id;}));
  const base=String(r.id||'room').replace(/_\d+$/,'');
  let n=2,id=r.id||base;
  while(ids.has(id)){id=base+'_'+n;n++;}
  r.id=id;
  if(r.name)r.name=r.name+' '+suffix;
  delete r.area_match;
  return r;
}
// CSS selectors of each element type inside the card's .content (hide / lock layers)
const RS_LAYER_SEL={
  zone:['[data-z]'],icon:['[data-ico]'],label:['[data-lbl]'],gauge:['[data-gauge]:not([data-gauge^="__bl_"])'],
  blind:['[data-gauge^="__bl_"]'],element:['[data-el]'],glow:['[data-glow]','[data-glowedit]'],vacuum_widget:['[data-vw]'],
  overlay:['[data-ov]'],badge:['[data-b]'],
};

// ---- Properties panel (Phase 4a, v6.44.0, V7_PLAN §5.7) -------------------------------------
// The studio's own forms for the selected element (or the room), generated from the schema
// registry: every key the schema lists for that element type gets a field of the right kind.
// Our own small components only — no HA Lit elements inside the studio (the v6.15.x lesson):
// entity picker (name / area / domain search, live state), icon picker (Home Assistant's own MDI
// list), colour, length, action builder, and YAML for the structured keys.
// KEEP rule (D4): a change rewrites only its own key; keys the form does not show (or the schema
// does not know) stay byte for byte.
const RS_SCHEMA_OF={zone:'zone',icon:'icon',label:'label',gauge:'gauge',glow:'glow',blind:'blind',element:'element',
  vacuum_widget:'vacuumWidget',badge:'badge',overlay:'overlay',group:'group'};
const RS_POS_KEYS=['top','left','bottom','right','width','height','size','z_index'];
const RS_ACT_KEYS=['tap_action','double_tap_action','hold_action','hold_delay'];
const RS_VIS_KEYS=['group','visible','visible_conditions','visible_template','fade','slide','nav_mini','section','tile'];
const RS_PROF_KEYS=['portrait','landscape','mobile','tablet','desktop','ultrawide'];
// Entity domains listed first in the picker (any entity can still be chosen).
const RS_DOMAINS={blind:['cover'],glow:['light'],gauge:['sensor','number','input_number','cover','light','climate'],
  label:['sensor','binary_sensor','climate','weather','input_number'],icon:['light','switch','binary_sensor','cover','fan','lock','media_player','climate'],
  zone:['light','switch','cover','scene','script'],vacuum_widget:['vacuum']};
// Room form (no element selected in a multi-room card); the card form (single-room card, or
// Global) edits the shared defaults the rooms fall back to
const RS_ROOM_KEYS=['name','id','icon','base_image','base_camera','camera_refresh','area_match'];
const RS_CARD_KEYS=['base_image','base_camera','camera_refresh'];
const RS_ACT_FALLBACK=[['','— not set —'],['custom','Custom (YAML)']];
function rsActTypes(ctx){return(ctx.I&&Array.isArray(ctx.I.actTypes)&&ctx.I.actTypes.length)?ctx.I.actTypes:RS_ACT_FALLBACK;}

function rsLabel(k){const s=String(k).replace(/_/g,' ');return s.charAt(0).toUpperCase()+s.slice(1);}
// 'enum:a|b|obj:x' → ['enum:a|b','obj:x'] (same rule as the schema registry)
function rsAlts(t){
  const parts=String(t).split('|'),out=[];
  for(const p of parts){
    const prev=out.length?out[out.length-1]:'';
    if(prev.indexOf('enum:')===0&&!/^(enum|obj|list|prof):/.test(p))out[out.length-1]+='|'+p;
    else out.push(p);
  }
  return out;
}
const RS_SIMPLE=['str','num','bool','len','url','entity','tmpl','color'];
function rsIsSimple(a){return RS_SIMPLE.indexOf(a)>=0||a.indexOf('enum:')===0;}
// the simple alternative of a union that fits the value now set (null → only YAML can show it)
function rsPickSimple(alts,v){
  const s=alts.filter(rsIsSimple);
  if(!s.length)return null;
  if(v===undefined||v===null)return s[0];
  const ty=typeof v;
  if(ty==='boolean')return s.indexOf('bool')>=0?'bool':null;
  if(ty==='number')return s.find(function(a){return a==='num'||a==='len';})||s.find(function(a){return a==='str';})||null;
  if(ty==='string'){
    const en=s.find(function(a){return a.indexOf('enum:')===0&&a.slice(5).split('|').indexOf(v)>=0;});
    if(en)return en;
    return s.find(function(a){return a!=='bool'&&a!=='num'&&a.indexOf('enum:')!==0;})||s.find(function(a){return a.indexOf('enum:')===0;})||null;
  }
  return null;
}

// ---- shared data: icon list (from Home Assistant itself), entity index ----------------------
let rsIconList=null,rsIconP=null;
function rsLoadIcons(){
  if(rsIconList)return Promise.resolve(rsIconList);
  if(rsIconP)return rsIconP;
  if(typeof fetch!=='function')return Promise.resolve(null);
  rsIconP=fetch('/static/mdi/iconList.json').then(function(r){if(!r.ok)throw new Error(r.status);return r.json();})
    .then(function(l){rsIconList=(Array.isArray(l)?l:[]).map(function(x){return{n:'mdi:'+x.name,k:(x.keywords||[]).join(' ').toLowerCase()};});return rsIconList;})
    .catch(function(){rsIconP=null;return null;});
  return rsIconP;
}
function rsEntityIndex(hass){
  const st=(hass&&hass.states)||{},ents=(hass&&hass.entities)||{},devs=(hass&&hass.devices)||{},areas=(hass&&hass.areas)||{};
  return Object.keys(st).map(function(id){
    const s=st[id],a=s.attributes||{};
    const reg=ents[id]||{};
    const aid=reg.area_id||(reg.device_id&&devs[reg.device_id]&&devs[reg.device_id].area_id)||'';
    const area=aid&&areas[aid]?(areas[aid].name||''):'';
    return{id:id,dom:id.split('.')[0],name:a.friendly_name||'',area:area,state:s.state,unit:a.unit_of_measurement||''};
  });
}

// ---- field shell ------------------------------------------------------------------------------
function rsFieldBox(label,key,wide,msgs){
  const box=rsEl('div',{class:'pf-field'+(wide?' wide':''),'data-key':key});
  box.appendChild(rsEl('label',{class:'pf-l',text:label}));
  return box;
}
// pinned validation: the schema's findings for this key, under the field (refreshed in place)
function rsMsgs(box,msgs){
  Array.prototype.slice.call(box.children).forEach(function(c){if(c.classList.contains('v'))c.remove();});
  box.classList.toggle('has-error',(msgs||[]).some(function(m){return m.level==='error';}));
  (msgs||[]).forEach(function(m){box.appendChild(rsEl('div',{class:'pf-msg v '+m.level,text:m.msg}));});
}

// ---- pickers (dropdown list under an input, inside the studio's shadow root) ------------------
function rsPicker(input,getItems,onPick,render){
  const wrap=rsEl('div',{class:'rs-pick'});
  input.parentNode&&input.parentNode.replaceChild(wrap,input);
  wrap.appendChild(input);
  const list=rsEl('div',{class:'rs-list',role:'listbox'});
  wrap.appendChild(list);
  let items=[],act=-1;
  const close=function(){wrap.classList.remove('open');act=-1;};
  const paint=function(){
    list.innerHTML='';
    items.slice(0,60).forEach(function(it,i){
      const row=rsEl('div',{class:'rs-opt'+(i===act?' act':''),role:'option'});
      render(row,it);
      row.addEventListener('mousedown',function(e){e.preventDefault();onPick(it);close();});
      list.appendChild(row);
    });
    if(!items.length)list.appendChild(rsEl('div',{class:'rs-opt none',text:'—'}));
  };
  // on focus the whole list (the value already set is not a search); typing filters it
  const refresh=function(q){Promise.resolve(getItems(q)).then(function(r){items=r||[];act=-1;paint();});};
  input.addEventListener('focus',function(){wrap.classList.add('open');refresh('');});
  input.addEventListener('input',function(){wrap.classList.add('open');refresh(input.value);});
  input.addEventListener('blur',function(){setTimeout(close,120);});
  input.addEventListener('keydown',function(e){
    if(!wrap.classList.contains('open'))return;
    if(e.key==='ArrowDown'){e.preventDefault();act=Math.min(items.length-1,act+1);paint();}
    else if(e.key==='ArrowUp'){e.preventDefault();act=Math.max(0,act-1);paint();}
    else if(e.key==='Enter'&&act>=0&&items[act]){e.preventDefault();onPick(items[act]);close();}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
  });
  wrap._rsClose=close;
  return wrap;
}
// entity picker: search id / friendly name / area, preferred domains first, live state shown
function rsEntityInput(ctx,value,domains,onChange){
  const inp=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false',placeholder:'light.living_room'});
  inp.value=value||'';
  const hint=rsEl('div',{class:'pf-sub'});
  const showHint=function(){
    const v=inp.value.trim();
    const st=v&&ctx.hass&&ctx.hass.states&&ctx.hass.states[v];
    hint.className='pf-sub'+(v&&!st?' warn':'');
    hint.textContent=!v?'':(st?((st.attributes&&st.attributes.friendly_name?st.attributes.friendly_name+' · ':'')+st.state+(st.attributes&&st.attributes.unit_of_measurement?' '+st.attributes.unit_of_measurement:'')):ctx.t('ent_missing'));
  };
  const box=rsEl('div',{class:'pf-ent'});box.appendChild(inp);
  rsPicker(inp,function(q){
    q=String(q||'').trim().toLowerCase();
    const idx=rsEntityIndex(ctx.hass);
    const pref=domains||[];
    return idx.filter(function(e){return!q||e.id.toLowerCase().indexOf(q)>=0||e.name.toLowerCase().indexOf(q)>=0||e.area.toLowerCase().indexOf(q)>=0;})
      .sort(function(a,b){const pa=pref.indexOf(a.dom)<0?99:pref.indexOf(a.dom),pb=pref.indexOf(b.dom)<0?99:pref.indexOf(b.dom);return pa-pb||a.id.localeCompare(b.id);});
  },function(e){inp.value=e.id;showHint();onChange(e.id);},function(row,e){
    row.appendChild(rsEl('span',{class:'o-main',text:e.name||e.id}));
    row.appendChild(rsEl('span',{class:'o-sub',text:e.id+(e.area?' · '+e.area:'')}));
    row.appendChild(rsEl('span',{class:'o-st',text:e.state+(e.unit?' '+e.unit:'')}));
  });
  inp.addEventListener('change',function(){showHint();onChange(inp.value.trim()||undefined);});
  box.appendChild(hint);showHint();
  return box;
}
function rsIconInput(ctx,value,onChange){
  const box=rsEl('div',{class:'pf-icon'});
  const prev=rsIcon(value||'mdi:help-circle-outline');prev.classList.add('pf-icprev');
  const inp=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false',placeholder:'mdi:lightbulb'});
  inp.value=value||'';
  box.appendChild(prev);box.appendChild(inp);
  rsPicker(inp,function(q){
    q=String(q||'').trim().toLowerCase().replace(/^mdi:/,'');
    return rsLoadIcons().then(function(list){
      if(!list)return[];
      if(!q)return list.slice(0,60);
      const a=[],b=[];
      for(const x of list){if(x.n.indexOf(q)>=0)a.push(x);else if(x.k.indexOf(q)>=0)b.push(x);if(a.length>60)break;}
      return a.concat(b).slice(0,60);
    });
  },function(x){inp.value=x.n;prev.setAttribute('icon',x.n);onChange(x.n);},function(row,x){
    row.classList.add('ic');row.appendChild(rsIcon(x.n));row.appendChild(rsEl('span',{class:'o-main',text:x.n}));
  });
  inp.addEventListener('change',function(){const v=inp.value.trim();prev.setAttribute('icon',v||'mdi:help-circle-outline');onChange(v||undefined);});
  return box;
}

// ---- simple widgets ----------------------------------------------------------------------------
function rsSimpleWidget(ctx,a,value,onChange,o){
  o=o||{};
  if(a==='bool'){
    const cb=rsEl('input',{type:'checkbox',class:'pf-cb'});cb.checked=value===true;
    cb.addEventListener('change',function(){onChange(cb.checked?true:(o.dflt===true?false:undefined));});
    return cb;
  }
  if(a.indexOf('enum:')===0){
    const sel=rsEl('select',{class:'pf-in'});
    sel.appendChild(rsEl('option',{value:'',text:o.dflt!==undefined?'— '+ctx.t('dflt')+' ('+o.dflt+') —':'— '+ctx.t('not_set')+' —'}));
    a.slice(5).split('|').forEach(function(v){sel.appendChild(rsEl('option',{value:v,text:v===''?'(empty)':v}));});
    if(value!==undefined&&value!==null&&a.slice(5).split('|').indexOf(String(value))<0)sel.appendChild(rsEl('option',{value:String(value),text:String(value)+' ?'}));
    sel.value=value==null?'':String(value);
    sel.addEventListener('change',function(){onChange(sel.value===''?undefined:sel.value);});
    return sel;
  }
  if(a==='entity')return rsEntityInput(ctx,value,o.domains,onChange);
  if(a==='color'){
    const box=rsEl('div',{class:'pf-color'});
    const sw=rsEl('input',{type:'color'});
    const tx=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false',placeholder:'#ffb35c / rgba(…) / var(--…)'});
    tx.value=value||'';
    if(/^#[0-9a-f]{6}$/i.test(value||''))sw.value=value;else sw.classList.add('unset'); // no colour set: not a black swatch
    sw.addEventListener('input',function(){sw.classList.remove('unset');tx.value=sw.value;});
    sw.addEventListener('change',function(){tx.value=sw.value;onChange(sw.value);});
    tx.addEventListener('change',function(){const v=tx.value.trim();const hex=/^#[0-9a-f]{6}$/i.test(v);if(hex)sw.value=v;sw.classList.toggle('unset',!hex);onChange(v||undefined);});
    box.appendChild(sw);box.appendChild(tx);
    return box;
  }
  if(a==='tmpl'){
    const ta=rsEl('textarea',{class:'pf-in mono',rows:'2',spellcheck:'false',placeholder:'{{ states(\'sensor.x\') }}'});ta.value=value==null?'':String(value);
    ta.addEventListener('change',function(){onChange(ta.value===''?undefined:ta.value);});
    return ta;
  }
  if(o.icon)return rsIconInput(ctx,value,onChange);
  const inp=rsEl('input',{type:a==='num'?'number':'text',class:'pf-in',spellcheck:'false'});
  if(a==='num')inp.step='any';
  if(a==='len')inp.placeholder='10% · 24px';
  if(a==='url')inp.placeholder='/local/…';
  inp.value=value==null?'':String(value);
  inp.addEventListener('change',function(){
    const v=inp.value.trim();
    if(v===''){onChange(undefined);return;}
    onChange((a==='num'||typeof value==='number')&&isFinite(Number(v))?Number(v):v); // a number stays a number
  });
  if(a==='url'){
    const box=rsEl('div',{class:'pf-url'});box.appendChild(inp);
    const img=rsEl('div',{class:'pf-thumb'});
    const set=function(){img.style.backgroundImage=inp.value.trim()?'url("'+inp.value.trim().replace(/"/g,'%22')+'")':'';};
    inp.addEventListener('change',set);set();
    box.appendChild(img);
    return box;
  }
  return inp;
}
// YAML for structured values (lists, objects, conditions, cards…): committed only when it parses
function rsYamlWidget(ctx,value,onChange,rows){
  const box=rsEl('div',{class:'pf-yaml'});
  const ta=rsEl('textarea',{class:'pf-in mono',rows:String(rows||3),spellcheck:'false'});
  ta.value=value===undefined?'':ctx.I.yaml.s(value);
  const err=rsEl('div',{class:'pf-msg error'});
  ta.addEventListener('change',function(){
    const s=ta.value;
    if(!s.trim()){err.textContent='';onChange(undefined);return;}
    const r=ctx.I.yaml.pe(s);
    if(r.err){err.textContent=r.err;return;}
    err.textContent='';onChange(r.val);
  });
  box.appendChild(ta);box.appendChild(err);
  return box;
}

// ---- action builder (same types and keys as the editor's, ROC_ACT_TYPES) ----------------------
function rsActType(ctx,a){
  if(a===undefined||a===null||a==='')return'';
  if(typeof a!=='object'||Array.isArray(a)||'condition'in a)return'custom';
  const t=a.action;
  if(t==='call-service')return(a.service||a.perform_action)?'perform-action':'custom';
  return rsActTypes(ctx).some(function(x){return x[0]===t;})?t:'custom';
}
function rsActionWidget(ctx,value,onChange,o){
  const box=rsEl('div',{class:'pf-act'});
  const t0=rsActType(ctx,value);
  const sel=rsEl('select',{class:'pf-in'});
  rsActTypes(ctx).forEach(function(x){sel.appendChild(rsEl('option',{value:x[0],text:x[1]}));});
  sel.value=t0;
  box.appendChild(sel);
  const body=rsEl('div',{class:'pf-actbody'});box.appendChild(body);
  let cur=value;
  const A=function(){return(cur&&typeof cur==='object'&&!Array.isArray(cur))?cur:{};};
  // KEEP: same type → start from the old object; another type → a new one (confirmation / haptic carried)
  const base=function(t){
    const a=A();
    if(rsActType(ctx,cur)===t)return JSON.parse(rsJ(a));
    const n={action:t};
    ['confirmation','haptic'].forEach(function(k){if(a[k]!==undefined)n[k]=JSON.parse(rsJ(a[k]));});
    return n;
  };
  const commit=function(v){cur=v;onChange(v);};
  const field=function(label,w){const f=rsEl('div',{class:'pf-sub2'});f.appendChild(rsEl('label',{class:'pf-l',text:label}));f.appendChild(w);body.appendChild(f);};
  const opts=function(list,val,cb){
    const s=rsEl('select',{class:'pf-in'});s.appendChild(rsEl('option',{value:'',text:'— '+ctx.t('choose')+' —'}));
    list.forEach(function(x){s.appendChild(rsEl('option',{value:x[0],text:x[1]}));});
    if(val&&!list.some(function(x){return x[0]===String(val);}))s.appendChild(rsEl('option',{value:String(val),text:val+' ?'}));
    s.value=val==null?'':String(val);s.addEventListener('change',function(){cb(s.value);});return s;
  };
  const set=function(t,k,v){const n=base(t);n.action=t;if(v===undefined||v==='')delete n[k];else n[k]=v;commit(n);};
  const draw=function(t){
    body.innerHTML='';
    const a=A(),same=rsActType(ctx,cur)===t;
    if(t==='more-info'||t==='toggle')field(ctx.t('f_entity'),rsEntityInput(ctx,same?a.entity:(o&&o.entity)||'',null,function(v){set(t,'entity',v);}));
    else if(t==='navigate'){const i=rsSimpleWidget(ctx,'str',same?(a.navigation_path!==undefined?a.navigation_path:a.path):'',function(v){const n=base(t);delete n.path;if(v)n.navigation_path=v;else delete n.navigation_path;commit(n);});i.placeholder='/lovelace/0';field(ctx.t('f_path'),i);}
    else if(t==='url'){const i=rsSimpleWidget(ctx,'str',same?(a.url_path!==undefined?a.url_path:a.url):'',function(v){const n=base(t);delete n.url;if(v)n.url_path=v;else delete n.url_path;commit(n);});i.placeholder='https://…';field('URL',i);}
    else if(t==='perform-action'){
      const svc=rsSimpleWidget(ctx,'str',same?(a.perform_action!==undefined?a.perform_action:a.service):'',function(v){const n=base(t);delete n.service;if(n.service_data!==undefined&&n.data===undefined)n.data=n.service_data;delete n.service_data;if(v)n.perform_action=v;else delete n.perform_action;commit(n);});
      svc.placeholder='script.turn_on';
      const dl=rsEl('datalist',{id:'rs-svc-'+Math.random().toString(36).slice(2)});
      const sv=(ctx.hass&&ctx.hass.services)||{};Object.keys(sv).forEach(function(d){Object.keys(sv[d]).forEach(function(s){dl.appendChild(rsEl('option',{value:d+'.'+s}));});});
      svc.setAttribute('list',dl.id);body.appendChild(dl);
      field(ctx.t('f_service'),svc);
      const te=same&&a.target&&typeof a.target==='object'&&typeof a.target.entity_id==='string'?a.target.entity_id:'';
      field(ctx.t('f_target'),rsEntityInput(ctx,te,null,function(v){const n=base(t);const tg=(n.target&&typeof n.target==='object')?Object.assign({},n.target):{};if(v)tg.entity_id=v;else delete tg.entity_id;if(Object.keys(tg).length)n.target=tg;else delete n.target;commit(n);}));
      field(ctx.t('f_data'),rsYamlWidget(ctx,same?(a.data!==undefined?a.data:a.service_data):undefined,function(v){const n=base(t);delete n.service_data;if(v&&typeof v==='object')n.data=v;else delete n.data;commit(n);},2));
    }
    else if(t==='open-section')field(ctx.t('f_section'),opts(((ctx.work.sections)||[]).map(function(s){return[String(s.id||''),String(s.title||s.id||'')];}),same?a.section:'',function(v){set(t,'section',v);}));
    else if(t==='switch-room')field(ctx.t('room'),opts(((ctx.work.rooms)||[]).map(function(r){return[String(r.id||''),String(r.name||r.id||'')];}),same?a.room:'',function(v){set(t,'room',v);}));
    else if(t==='toggle-group'||t==='show-group'||t==='hide-group'){
      const ids=[];[].concat(ctx.scope.groups||[],ctx.work.groups||[]).forEach(function(g){if(g&&g.id&&ids.indexOf(g.id)<0)ids.push(g.id);});
      field(ctx.t('f_group'),opts(ids.map(function(g){return[g,g];}),same?a.group:'',function(v){set(t,'group',v);}));
    }
    else if(t==='custom')field('YAML',rsYamlWidget(ctx,cur,function(v){commit(v);},3));
  };
  sel.addEventListener('change',function(){
    const t=sel.value;
    if(t===''){commit(undefined);draw('');return;}
    if(t==='custom'){draw('custom');return;}
    const n=base(t);n.action=t;
    if((t==='more-info'||t==='toggle')&&!n.entity&&o&&o.entity)n.entity=o.entity;
    commit(n);draw(t);
  });
  draw(t0);
  return box;
}

// ---- one field for a schema key ----------------------------------------------------------------
// prof:X → X, or {portrait, landscape} of X; unions → the simple alternative unless the value is
// structured (then YAML, with a switch back)
function rsKeyField(ctx,key,def,value,onChange,msgs){
  const t=String(def.t);
  const isProf=t.indexOf('prof:')===0;
  const inner=isProf?t.slice(5):t;
  const alts=rsAlts(inner);
  const simple=rsPickSimple(alts,isProf&&value&&typeof value==='object'&&!Array.isArray(value)?(value.portrait!==undefined?value.portrait:value.landscape):value);
  const hasStruct=alts.some(function(a){return!rsIsSimple(a);});
  const iconKey=key==='icon'&&simple==='str';
  const wo={dflt:def.d,domains:key==='base_camera'?['camera']:(key==='entity'||/entity$/.test(key)?ctx.domains:null),icon:iconKey};
  const isAct=t==='action';
  const wide=isAct||!simple||simple==='tmpl'||simple==='entity'||simple==='url'||iconKey||(hasStruct&&(Array.isArray(value)||(value&&typeof value==='object'&&!isProf)));
  const box=rsFieldBox(ctx.labels[key]||rsLabel(key),key,wide);
  if(isAct){box.appendChild(rsActionWidget(ctx,value,onChange,{entity:ctx.item&&ctx.item.entity}));rsMsgs(box,msgs);return box;}
  const perProf=isProf&&value&&typeof value==='object'&&!Array.isArray(value)&&(('portrait'in value)||('landscape'in value));
  if(perProf){
    ['portrait','landscape'].forEach(function(p){
      const row=rsEl('div',{class:'pf-prof'});row.appendChild(rsEl('span',{class:'pf-tag',text:p}));
      row.appendChild(simple?rsSimpleWidget(ctx,simple,value[p],function(v){const n=Object.assign({},value);if(v===undefined)delete n[p];else n[p]=v;value=n;onChange(Object.keys(n).length?n:undefined);},wo):rsYamlWidget(ctx,value[p],function(v){const n=Object.assign({},value);if(v===undefined)delete n[p];else n[p]=v;value=n;onChange(n);}));
      box.appendChild(row);
    });
    box.appendChild(rsEl('button',{type:'button',class:'pf-link',text:ctx.t('one_value'),onclick:function(){onChange(value.landscape!==undefined?value.landscape:value.portrait);ctx.rerender();}}));
    rsMsgs(box,msgs);return box;
  }
  const structured=!simple||(value!==undefined&&value!==null&&typeof value==='object');
  if(structured){
    box.appendChild(rsYamlWidget(ctx,value,onChange,Array.isArray(value)&&value.length>2?4:3));
    if(alts.some(rsIsSimple)&&hasStruct)box.appendChild(rsEl('button',{type:'button',class:'pf-link',text:ctx.t('as_simple'),onclick:function(){onChange(undefined);ctx.rerender();}}));
  }else{
    box.appendChild(rsSimpleWidget(ctx,simple,value,onChange,wo));
    const links=rsEl('div',{class:'pf-links'});
    if(isProf)links.appendChild(rsEl('button',{type:'button',class:'pf-link',text:ctx.t('per_profile'),onclick:function(){onChange({portrait:value,landscape:value});ctx.rerender();}}));
    if(alts.indexOf('list:condVal')>=0)links.appendChild(rsEl('button',{type:'button',class:'pf-link',text:ctx.t('as_conditions'),onclick:function(){onChange([{condition:{entity:'',state:'on'},value:value===undefined?'':value},{value:value===undefined?'':value}]);ctx.rerender();}}));
    if(links.childNodes.length)box.appendChild(links);
  }
  rsMsgs(box,msgs);
  return box;
}

// ---- the panel -----------------------------------------------------------------------------------
// target: {kind:'element',type,id} | {kind:'room'} | {kind:'card'} (single-room card / Global)
// ctx: {t, I, hass, work, scope, item, path, findings, domains, labels, open:Set, inherited, multi,
//       set(k,v), setRest(keys,obj), rename(id), rerender(), openAll()}
// root._rsRefresh(findings) re-pins the validation messages without rebuilding the form.
function rsBuildProps(ctx,target){
  const root=rsEl('div',{class:'props'});
  const S=RocSchema.ROC_SCHEMA;
  let item,schemaKeys,title,icon,groups;
  const prefix=ctx.path||'';
  const rel=function(p){return prefix?p.slice(prefix.length+1):p;};
  const under=function(p){return!prefix||p===prefix||p.indexOf(prefix+'.')===0||p.indexOf(prefix+'[')===0;};
  if(target.kind==='room'||target.kind==='card'){
    item=ctx.item;schemaKeys=S.room.keys;
    title=target.kind==='room'?String(item.name||item.id||''):ctx.t(ctx.global?'global':'card_form');
    icon=target.kind==='room'?'mdi:door':(ctx.global?'mdi:earth':'mdi:image-outline');
    groups=[['main',target.kind==='room'?RS_ROOM_KEYS:RS_CARD_KEYS]];
  }else{
    const T=RS_TYPES[target.type];
    item=ctx.item;schemaKeys=(S[RS_SCHEMA_OF[target.type]]||{keys:{}}).keys;title=String(item.id);icon=T.icon;
    const keyOrder=Object.keys(schemaKeys);
    const isIn=function(l){return function(k){return l.indexOf(k)>=0;};};
    groups=[
      ['main',keyOrder.filter(function(k){return!isIn(RS_POS_KEYS)(k)&&!isIn(RS_ACT_KEYS)(k)&&!isIn(RS_VIS_KEYS)(k)&&!isIn(RS_PROF_KEYS)(k)&&k!=='id';})],
      ['position',keyOrder.filter(isIn(RS_POS_KEYS))],
      ['actions',keyOrder.filter(isIn(RS_ACT_KEYS))],
      ['visibility',keyOrder.filter(isIn(RS_VIS_KEYS))],
    ];
  }
  const head=rsEl('div',{class:'pf-head'},[rsIcon(icon),rsEl('span',{class:'pf-title',text:title}),
    rsEl('span',{class:'pf-type',text:target.kind==='element'?ctx.t('t_'+target.type):(target.kind==='room'?ctx.t('room'):'')})]);
  if(ctx.inherited)head.appendChild(rsEl('span',{class:'tag',text:ctx.t('inherited')}));
  head.appendChild(rsEl('button',{type:'button',class:'btn sm pf-open','data-act':'open-all',title:ctx.t('open_all'),'aria-label':ctx.t('open_all'),onclick:function(){ctx.openAll();}},[rsIcon('mdi:open-in-new')]));
  root.appendChild(head);
  if(ctx.multi>1)root.appendChild(rsEl('div',{class:'pf-note',text:ctx.t('props_multi',{n:ctx.multi,id:title})}));
  let findings=(ctx.findings||[]).filter(function(f){return under(f.path);});
  const msgsFor=function(k){return findings.filter(function(f){const r=rel(f.path);return r===k||r.indexOf(k+'.')===0||r.indexOf(k+'[')===0;});};
  const pinned=[]; // [box, () => msgs]
  const pin=function(box,fn){pinned.push([box,fn]);rsMsgs(box,fn());return box;};
  // id (elements): renaming keeps the selection
  if(target.kind==='element'){
    const idBox=rsFieldBox('ID','id',false);
    const inp=rsEl('input',{type:'text',class:'pf-in',spellcheck:'false'});inp.value=String(item.id);
    inp.addEventListener('change',function(){const v=inp.value.trim();if(v&&v!==String(item.id))ctx.rename(v);else inp.value=String(item.id);});
    idBox.appendChild(inp);
    root.appendChild(rsEl('div',{class:'pf-grid pf-idrow'},[pin(idBox,function(){return msgsFor('id');})]));
  }
  const shown=new Set(['id']);
  groups.forEach(function(g){
    const keys=g[1].filter(function(k){return schemaKeys[k]&&!schemaKeys[k].legacy;});
    if(!keys.length)return;
    const sec=rsEl('details',{class:'pf-sec','data-sec':g[0]});
    if(ctx.open.has(g[0]))sec.open=true;
    sec.addEventListener('toggle',function(){if(sec.open)ctx.open.add(g[0]);else ctx.open.delete(g[0]);});
    const nset=keys.filter(function(k){return item[k]!==undefined;}).length;
    sec.appendChild(rsEl('summary',null,[rsEl('span',{text:ctx.t('g_'+g[0])}),rsEl('span',{class:'n',text:nset?String(nset):''})]));
    const grid=rsEl('div',{class:'pf-grid'});
    keys.forEach(function(k){
      shown.add(k);
      grid.appendChild(pin(rsKeyField(ctx,k,schemaKeys[k],item[k],function(v){ctx.set(k,v);},[]),function(){return msgsFor(k);}));
    });
    sec.appendChild(grid);
    root.appendChild(sec);
  });
  // elements: profile overrides and keys the schema does not know; a room: keys the schema does
  // not know — YAML, kept exactly as they are (KEEP)
  const rest={};
  if(target.kind!=='card')Object.keys(item).forEach(function(k){
    if(shown.has(k))return;
    if(target.kind==='room'?!schemaKeys[k]:true)rest[k]=item[k];
  });
  const nrest=Object.keys(rest).length;
  if(target.kind==='element'||nrest){
    const adv=rsEl('details',{class:'pf-sec','data-sec':'advanced'});
    if(ctx.open.has('advanced'))adv.open=true;
    adv.addEventListener('toggle',function(){if(adv.open)ctx.open.add('advanced');else ctx.open.delete('advanced');});
    adv.appendChild(rsEl('summary',null,[rsEl('span',{text:ctx.t(target.kind==='room'?'g_room_more':'g_advanced')}),rsEl('span',{class:'n',text:nrest?String(nrest):''})]));
    const ab=rsEl('div',{class:'pf-grid'});
    const advBox=rsFieldBox(ctx.t(target.kind==='room'?'adv_room_hint':'adv_hint'),'_rest',true);
    advBox.appendChild(rsYamlWidget(ctx,nrest?rest:undefined,function(v){if(v===undefined)v={};if(!v||typeof v!=='object'||Array.isArray(v))return;ctx.setRest(Object.keys(rest),v);},4));
    ab.appendChild(pin(advBox,function(){return findings.filter(function(f){const r=rel(f.path).split(/[.[]/)[0];return Object.prototype.hasOwnProperty.call(rest,r);});}));
    adv.appendChild(ab);
    root.appendChild(adv);
  }
  if(target.kind==='room')root.appendChild(rsEl('div',{class:'pf-note',text:ctx.t('room_more_hint')}));
  if(target.kind==='card')root.appendChild(rsEl('div',{class:'pf-note',text:ctx.t(ctx.global?'props_global_hint':'props_card_hint')}));
  root._rsRefresh=function(all){
    findings=(all||[]).filter(function(f){return under(f.path);});
    pinned.forEach(function(p){rsMsgs(p[0],p[1]());});
  };
  return root;
}
// ---- The studio -----------------------------------------------------------------------------
// Device frames for the canvas. The card chooses its layout profile from the frame's size (its
// _rocVp viewport override), so "Tablet portrait" shows the portrait profile on a landscape PC.
const RS_FRAMES={fit:null,landscape:{w:1280,h:800},portrait:{w:800,h:1280},phone:{w:390,h:844}};
// Outline rows: [config key, editor section id (data-panel), icon]
const RS_KINDS=[
  ['overlays','overlays','mdi:layers-outline'],['zones','zones','mdi:gesture-tap'],['badges','badges','mdi:label-outline'],
  ['icons','icons','mdi:star-four-points-outline'],['labels','labels','mdi:format-text'],['gauges','gauges','mdi:gauge'],
  ['glows','glows','mdi:lightbulb-on-outline'],['blinds','blinds','mdi:blinds-horizontal'],['elements','elements','mdi:card-bulleted-outline'],
  ['groups','groups','mdi:dock-window'],['vacuum_widgets','vacuum_widgets','mdi:robot-vacuum'],['light_controls','lights','mdi:tune-vertical'],
];
// Room keys kept on the previewed room while the shared Global defaults are edited — the same
// list the editor's own preview uses (_previewCfg), so the canvas falls through to the defaults.
const RS_KEEP_VISUAL=['id','name','area_match','base_image','base_camera','camera_refresh','base_image_conditions'];

class RocStudio{
  static open(opts){
    if(RocStudio.current){RocStudio.current._dlg.focus();return Promise.resolve(RocStudio.current);}
    const s=new RocStudio(opts||{});
    RocStudio.current=s;
    try{s._init();}catch(e){RocStudio.current=null;try{s._teardown();}catch(_){}return Promise.reject(e);}
    return Promise.resolve(s);
  }

  constructor(opts){
    const C=customElements.get('room-overlay-card');
    this.C=C;this.I=C&&C._rocInternals;
    if(!this.I)throw new Error('Studio: room-overlay-card is not loaded');
    this.opts=opts;
    this.hass=opts.hass||(opts.editor&&opts.editor._hass)||(opts.card&&opts.card._hass)||null;
    // landscape screen → the tablet frame (the canvas column alone is often squarish and would
    // flip a desktop layout to portrait); portrait screen (phone) → the real screen size
    this.frame=(window.innerWidth||0)>=(window.innerHeight||0)?'landscape':'fit';this.mode='arrange';
    this.undoStack=[];this.redoStack=[];this.lastCommit=0;this.lastSrc='';
    this.roomIdx=0;this.global=false;
    this.sel=null;           // {type,id} — the selected element (canvas, outline and inspector agree)
    this.multi=[];           // further selected elements (Shift / Ctrl click) — v6.43.0
    this.hidden=new Set();   // element types hidden on the canvas (studio view only, never saved)
    this.locked=new Set();   // element types that cannot be selected or dragged on the canvas
    this.search='';          // outline filter
    this._placeType=null;    // element type being placed on the canvas (Add)
    this._layers=[];this._timers=[];
    // inspector tab (v6.44.0): 'props' = the studio's own Properties form, 'all' = the classic editor
    let tab='props';try{tab=localStorage.getItem('roc-studio-tab')==='all'?'all':'props';}catch(_){}
    this.tab=tab;
    this._propsOpen=new Set(['main','position']); // Properties sections kept open across selections
    this._propsSig='';this._propsKey='';this._propsSkip=false;
  }
  t(k,v){return rocT((this.hass&&this.hass.language||'en').split('-')[0],k,v);}

  // ---------------------------------------------------------------- setup
  _init(){
    const o=this.opts,I=this.I;
    if(o.from==='editor'&&o.editor){
      const ed=o.editor;
      this.work=I.clone(ed._config);
      this.roomIdx=ed._editRoomIdx||0;this.global=!!ed._editGlobal;
      this.target={kind:'editor',editor:ed};
    }else if(o.card){
      this.work=I.clone(o.card._rocRaw||o.card._config);
      this.roomIdx=o.card._roomIdx||0;
      this.target=rsResolveDashboard(o.card,this.hass);
    }else if(o.config){
      this.work=I.clone(o.config);
      this.target={kind:'yaml',reason:o.reason||'r_notfound'};
    }else throw new Error('Studio: nothing to edit');
    if(!this.work||typeof this.work!=='object')throw new Error('Studio: the card has no config');
    // A v3 config (no `layout:`) is migrated once, in memory, exactly as the card and the editor
    // do on load; it is written back only together with a real edit (like the editor's banner).
    this.work=I.migrate(this.work);
    const n=this._rooms().length;
    if(n)this.roomIdx=Math.max(0,Math.min(this.roomIdx,n-1));else this.global=false;
    this.base=rsJ(this.work);        // what the target holds (last applied / saved)
    this.histKey='roc-studio-history:'+I.cfgKey(this.work);
    this._build();
  }

  _build(){
    const self=this;
    // Document-level styles for the dialog box itself (its contents live in a shadow root).
    if(!document.getElementById('roc-studio-doc-css')){
      const st=document.createElement('style');st.id='roc-studio-doc-css';
      st.textContent='dialog.roc-studio{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:hidden;}dialog.roc-studio::backdrop{background:rgba(0,0,0,.55);}';
      document.head.appendChild(st);
    }
    const dlg=document.createElement('dialog');
    dlg.className='roc-studio';dlg.setAttribute('aria-label',this.t('title'));
    const host=document.createElement('div');
    dlg.appendChild(host);
    const sr=host.attachShadow({mode:'open'});
    this._dlg=dlg;this._sr=sr;
    sr.innerHTML='<style>'+ROC_STUDIO_CSS+'</style>';
    const app=rsEl('div',{class:'app'});this._app=app;sr.appendChild(app);

    // toolbar
    const bar=rsEl('header',{class:'bar'});
    bar.appendChild(rsEl('span',{class:'brand'},[this.t('title'),rsEl('small',{text:'v'+ROC_STUDIO_VERSION})]));
    this._olToggle=rsEl('button',{class:'btn icon narrow-only ol-t',title:this.t('outline'),'aria-label':this.t('outline'),onclick:function(){app.classList.toggle('show-outline');}},[rsIcon('mdi:file-tree')]);
    bar.appendChild(this._olToggle);
    this._roomSel=rsEl('select',{class:'room','aria-label':this.t('room'),onchange:function(){const v=self._roomSel.value;self._setRoom(v==='global'?self.roomIdx:(parseInt(v,10)||0),v==='global','toolbar');}});
    bar.appendChild(this._roomSel);
    const fseg=rsEl('span',{class:'seg frames',role:'group','aria-label':this.t('frame_hint'),title:this.t('frame_hint')});
    this._frameBtns={};
    Object.keys(RS_FRAMES).forEach(function(k){
      const b=rsEl('button',{type:'button','aria-pressed':String(k===self.frame),onclick:function(){self._setFrame(k);}},[self.t('frame_'+k)]);
      self._frameBtns[k]=b;fseg.appendChild(b);
    });
    bar.appendChild(fseg);
    const mseg=rsEl('span',{class:'seg',role:'group'});
    this._modeBtns={};
    ['arrange','live'].forEach(function(k){
      const b=rsEl('button',{type:'button',title:self.t('mode_'+k+'_hint'),'aria-pressed':String(k===self.mode),onclick:function(){self._setMode(k);}},[self.t('mode_'+k)]);
      self._modeBtns[k]=b;mseg.appendChild(b);
    });
    bar.appendChild(mseg);
    this._addBtn=rsEl('button',{class:'btn',title:this.t('add_hint'),onclick:function(){self._showAdd();}},[rsIcon('mdi:plus'),rsEl('span',{class:'lbl',text:this.t('add')})]);
    bar.appendChild(this._addBtn);
    this._undoBtn=rsEl('button',{class:'btn icon',title:this.t('undo'),'aria-label':this.t('undo'),onclick:function(){self.undo();}},[rsIcon('mdi:undo')]);
    this._redoBtn=rsEl('button',{class:'btn icon',title:this.t('redo'),'aria-label':this.t('redo'),onclick:function(){self.redo();}},[rsIcon('mdi:redo')]);
    bar.appendChild(this._undoBtn);bar.appendChild(this._redoBtn);
    bar.appendChild(rsEl('span',{class:'sp'}));
    bar.appendChild(rsEl('button',{class:'btn',title:this.t('yaml'),onclick:function(){self._showYaml();}},[rsIcon('mdi:code-braces'),rsEl('span',{class:'lbl',text:this.t('yaml')})]));
    bar.appendChild(rsEl('button',{class:'btn',title:this.t('history'),onclick:function(){self._showHistory();}},[rsIcon('mdi:history'),rsEl('span',{class:'lbl',text:this.t('history')})]));
    this._inToggle=rsEl('button',{class:'btn icon narrow-only in-t',title:this.t('inspector'),'aria-label':this.t('inspector'),onclick:function(){app.classList.toggle('show-insp');}},[rsIcon('mdi:tune')]);
    bar.appendChild(this._inToggle);
    const tk=this.target.kind;
    this._saveBtn=rsEl('button',{class:'btn primary',title:tk==='editor'?this.t('apply_hint'):(tk==='dashboard'?this.t('save_hint'):''),onclick:function(){self.save();}},
      [rsIcon(tk==='yaml'?'mdi:content-copy':'mdi:content-save'),rsEl('span',{text:tk==='editor'?this.t('apply'):(tk==='dashboard'?this.t('save'):this.t('copy_yaml'))})]);
    bar.appendChild(this._saveBtn);
    bar.appendChild(rsEl('button',{class:'btn icon',title:this.t('close'),'aria-label':this.t('close'),onclick:function(){self.requestClose();}},[rsIcon('mdi:close')]));
    app.appendChild(bar);

    // outline
    this._outline=rsEl('nav',{class:'outline','aria-label':this.t('outline')});
    this._olRooms=rsEl('div');
    this._olSearch=rsEl('input',{class:'ol-search',type:'search',placeholder:this.t('search_ph'),'aria-label':this.t('search_ph'),oninput:function(){self.search=self._olSearch.value;self._renderOutlineList();}});
    this._olList=rsEl('div');
    this._outline.appendChild(this._olRooms);
    this._outline.appendChild(rsEl('div',{class:'ol-h',text:this.t('elements')}));
    this._outline.appendChild(this._olSearch);
    this._outline.appendChild(this._olList);
    app.appendChild(this._outline);

    // canvas
    const cv=rsEl('main',{class:'canvas'});
    this._cvInfo=rsEl('div',{class:'cv-bar'});
    this._cvSize=rsEl('span');
    this._selBar=rsEl('span',{class:'selbar'});
    this._cvInfo.appendChild(this._cvSize);this._cvInfo.appendChild(this._selBar);
    this._stage=rsEl('div',{class:'stage'});
    this._fbox=rsEl('div',{class:'fbox'});
    this._frameEl=rsEl('div',{class:'frame'});
    this._fbox.appendChild(this._frameEl);this._stage.appendChild(this._fbox);
    cv.appendChild(this._cvInfo);cv.appendChild(this._stage);
    app.appendChild(cv);

    // inspector: the Properties form (v6.44.0, §5.7) and today's editor, hosted unchanged (§5.5)
    this._insp=rsEl('aside',{class:'insp','aria-label':this.t('inspector')});
    const tabs=rsEl('div',{class:'itabs',role:'tablist'});
    this._tabBtns={};
    [['props','tab_props','tab_props_hint'],['all','tab_all','tab_all_hint']].forEach(function(x){
      const b=rsEl('button',{type:'button',role:'tab','data-tab':x[0],title:self.t(x[2]),'aria-selected':String(self.tab===x[0]),onclick:function(){self._setTab(x[0]);}},[self.t(x[1])]);
      self._tabBtns[x[0]]=b;tabs.appendChild(b);
    });
    this._insp.appendChild(tabs);
    this._propsPane=rsEl('div',{class:'ipane props-pane',role:'tabpanel'});
    // a field with typed, not yet committed text keeps the browser's own undo (see _onKey)
    this._propsPane.addEventListener('input',function(e){const t=e.composedPath?e.composedPath()[0]:e.target;if(t)t._rsDirty=true;},true);
    this._propsPane.addEventListener('change',function(e){const t=e.composedPath?e.composedPath()[0]:e.target;if(t)t._rsDirty=false;},true);
    this._edPane=rsEl('div',{class:'ipane ed-pane',role:'tabpanel'});
    if(this.tab!=='props')this._propsPane.hidden=true;
    if(this.tab!=='all')this._edPane.hidden=true;
    this._insp.appendChild(this._propsPane);this._insp.appendChild(this._edPane);
    app.appendChild(this._insp);

    // status bar
    const stb=rsEl('footer',{class:'status'});
    this._vBtn=rsEl('button',{class:'vbtn',onclick:function(){self._showValidation();}});
    this._dirtyEl=rsEl('span');
    this._tgtEl=rsEl('span',{class:'tgt'});
    this._verEl=rsEl('span',{class:'warn'});
    stb.appendChild(this._vBtn);stb.appendChild(this._dirtyEl);stb.appendChild(this._verEl);stb.appendChild(this._tgtEl);
    app.appendChild(stb);
    if(this.I.version!==ROC_STUDIO_VERSION)this._verEl.textContent=this.t('ver_mismatch',{s:ROC_STUDIO_VERSION,c:this.I.version});

    this._mountEditor();
    this._mountCanvas();

    // keyboard: Escape is guarded on keydown in the CAPTURE phase (spike S1 — preventing the
    // dialog's `cancel` is ignored without fresh user activation); Ctrl+Z/Y/S are the studio's.
    dlg.addEventListener('keydown',function(e){self._onKey(e);},true);
    dlg.addEventListener('cancel',function(e){e.preventDefault();self.requestClose();});
    this._bu=function(e){if(self._dirty()){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',this._bu);

    document.body.appendChild(dlg);
    if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
    this.C._rocStudioOpen=true;

    if(window.ResizeObserver){this._ro=new ResizeObserver(function(){self._layoutFrame();});this._ro.observe(this._stage);}
    this._timers.push(setInterval(function(){self._pollHass();},250));
    this._renderChrome();
    this._layoutFrame();
  }

  _mountEditor(){
    const self=this,I=this.I;
    const ed=document.createElement('room-overlay-card-editor');
    ed._rocHosted=true;ed._rocHost=this;
    ed._roomIdxInit=true;ed._editRoomIdx=this.roomIdx;ed._editGlobal=this.global;
    if(this.hass)ed.hass=this.hass;
    ed.addEventListener('config-changed',function(e){
      e.stopPropagation(); // never reaches HA's dialog: the studio owns this config until Apply/Save
      const c=e.detail&&e.detail.config;
      if(c)self._commit(c,'editor');
    });
    ed.addEventListener('change',function(e){
      const tgt=e.composedPath?e.composedPath()[0]:e.target;
      if(tgt&&tgt.id==='room-select')self._setRoom(ed._editRoomIdx||0,!!ed._editGlobal,'editor');
    });
    ed.addEventListener('click',function(e){
      const sm=e.target&&e.target.closest?e.target.closest('summary'):null;
      const d=sm&&sm.parentElement;
      if(!d||d.tagName!=='DETAILS'||!d.dataset.panel)return;
      setTimeout(function(){
        if(!d.open)return;
        const m=/^([a-z]+)-(\d+)$/.exec(d.dataset.panel);
        const type=m&&RS_PRE2TYPE[m[1]];
        if(!type)return;
        const item=((ed._roomView()||{})[RS_TYPES[type].key]||[])[parseInt(m[2],10)];
        if(item&&item.id!=null)self._select(type,String(item.id),'inspector');
      },0);
    },true);
    ed.setConfig(I.clone(this.work));
    this._ed=ed;
    this._edPane.appendChild(ed);
  }

  _mountCanvas(){
    const self=this;
    const card=document.createElement('room-overlay-card');
    card._rocSink=function(nc){self._onCanvas(nc);};
    card._rocRoomSink=function(idx){self._onCanvasRoom(idx);};
    card._rocSelSink=function(type,id,o){self._onCanvasSel(type,id,o);};
    card._rocVp={w:1280,h:800};
    if(this._rooms().length)card._roomIdx=this.roomIdx;
    this._card=card;
    this._frameEl.appendChild(card);
    this._cvErr=null;
    this._pushCanvas(true);
    if(this.hass)card.hass=this.hass;
    this._canvasRoom();
  }

  // ---------------------------------------------------------------- canvas
  _vp(){return this._card&&this._card._rocVp||{w:1280,h:800};}
  // The config the canvas card renders: the working config plus render-only overrides, never
  // written back (_restore undoes every one of them).
  _canvasCfg(){
    const I=this.I;
    const c=I.migrate(I.clone(this.work));
    c._roc_studio=true;
    delete c.url_sync;                       // the canvas must not drive the dashboard URL
    const rooms=Array.isArray(c.rooms)&&c.rooms.length>0;
    if(rooms)c.follow_mode='manual';         // no presence jumps while editing
    if(this.mode==='arrange')c.test_mode=true;
    const vp=this._vp();
    const prof=I.profile(c,vp.w,vp.h);
    c.layout=Object.assign({},c.layout);
    const h=c.layout.height||'viewport';
    // viewport/fill pin to the screen; in the studio the frame is the screen
    if(h==='fill'||(h==='viewport'&&prof==='landscape'))c.layout.height='container';
    if(rooms&&this.global){
      const r=c.rooms[this.roomIdx];
      if(r)Object.keys(r).forEach(function(k){if(RS_KEEP_VISUAL.indexOf(k)<0)delete r[k];});
    }
    return c;
  }
  _restore(nc){
    const I=this.I;
    const base=I.migrate(I.clone(this.work));
    const out=I.clone(nc);
    delete out._roc_studio;
    ['test_mode','url_sync','follow_mode'].forEach(function(k){if(base[k]!==undefined)out[k]=I.clone(base[k]);else delete out[k];});
    if(out.layout&&typeof out.layout==='object'){
      if(base.layout&&base.layout.height!==undefined)out.layout.height=I.clone(base.layout.height);else delete out.layout.height;
    }
    if(this.global&&Array.isArray(base.rooms)&&Array.isArray(out.rooms)&&base.rooms[this.roomIdx])out.rooms[this.roomIdx]=I.clone(base.rooms[this.roomIdx]);
    return out;
  }
  _pushCanvas(now){
    const self=this;
    clearTimeout(this._pcT);
    const go=function(){
      const card=self._card;if(!card)return;
      card._editGlobal=self.global;
      try{
        card.setConfig(self._canvasCfg());
        if(self._cvErr){self._cvErr.remove();self._cvErr=null;}
        card.style.display='';
        self._reselectCanvas();
      }catch(e){
        card.style.display='none';
        if(!self._cvErr){self._cvErr=rsEl('div',{class:'cv-err'});self._stage.appendChild(self._cvErr);}
        self._cvErr.textContent=self.t('canvas_err',{m:String(e&&e.message||e).replace(/^\[room-overlay-card\]\s*/,'')});
      }
    };
    if(now)go();else this._pcT=setTimeout(go,40);
  }
  _canvasRoom(){
    const card=this._card;
    if(!card||!this._rooms().length)return;
    if(card._roomIdx!==this.roomIdx){
      card._roomIdx=this.roomIdx;
      if(card._hass&&card._config){card._rendered=false;try{card._render();}catch(_){}}
      this._reselectCanvas();
    }
  }
  _setFrame(k){
    if(!(k in RS_FRAMES))return;
    this.frame=k;
    for(const f in this._frameBtns)this._frameBtns[f].setAttribute('aria-pressed',String(f===k));
    this._layoutFrame();
  }
  _setMode(k){
    this.mode=k;
    for(const f in this._modeBtns)this._modeBtns[f].setAttribute('aria-pressed',String(f===k));
    this._pushCanvas(true);
  }
  _layoutFrame(){
    const st=this._stage,card=this._card;
    if(!st||!card)return;
    const aw=Math.max(0,st.clientWidth-32),ah=Math.max(0,st.clientHeight-32);
    let w,h,s;
    const F=RS_FRAMES[this.frame];
    if(!F){w=Math.max(320,Math.round(aw)||1280);h=Math.max(240,Math.round(ah)||800);s=1;}
    else{w=F.w;h=F.h;s=(aw>0&&ah>0)?Math.min(1,aw/w,ah/h):1;}
    this._fbox.style.width=Math.round(w*s)+'px';this._fbox.style.height=Math.round(h*s)+'px';
    const fe=this._frameEl;
    fe.style.width=w+'px';fe.style.height=h+'px';fe.style.transform=s<1?'scale('+s+')':'';
    const vp=card._rocVp;
    const changed=!vp||vp.w!==w||vp.h!==h;
    card._rocVp={w:w,h:h};
    this._scale=s;
    if(changed){
      this._pushCanvas(true); // the profile (and so the canvas height override) may change
      if(card._rendered)try{card._onWinResize();}catch(_){}
    }
    const prof=this.I.profile(this.work,w,h);
    this._cvSize.textContent=w+' × '+h+' · '+prof+(s<1?' · '+Math.round(s*100)+' %':'');
    if(this._placeLayer)this._placeLayer.style.display='';
  }
  _onCanvas(nc){
    // a drag / draw on the canvas (Arrange mode) — the card already shows it
    const out=this._restore(nc);
    // a selected element dragged while others are selected too: they all move by the same amount
    const mv=this._movedItem(this.work,out);
    if(mv&&this.multi.length&&this._isSel(mv.type,mv.id)){
      let n=0;
      const self=this;
      this._selSet().forEach(function(x){
        if(x.type===mv.type&&x.id===mv.id)return;
        const f=self._findItem(x.type,x.id,out);if(!f)return;
        if(rsShiftPct(f.item,'top',mv.dt))n++;
        if(rsShiftPct(f.item,'left',mv.dl))n++;
      });
      if(n){this._commit(out,'studio');return;}
    }
    this._commit(out,'canvas');
    // v6.44.0: dragging an element that was not selected selects it (its form follows the drag)
    if(mv&&!this._isSel(mv.type,mv.id))this._select(mv.type,mv.id,'drag');
  }
  // the one positioned element whose top/left differs between two configs (a canvas drag)
  _movedItem(a,b){
    const self=this;let hit=null,count=0;
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];if(!T.canvas)return;
      const la=rsOwner(a,self.roomIdx,self.global,T.key).list||[],lb=rsOwner(b,self.roomIdx,self.global,T.key).list||[];
      lb.forEach(function(ib){
        if(!ib)return;
        const ia=la.find(function(x){return x&&String(x.id)===String(ib.id);});
        if(!ia||(ia.top===ib.top&&ia.left===ib.left))return;
        const dt=rsPctNum(ib.top)-rsPctNum(ia.top),dl=rsPctNum(ib.left)-rsPctNum(ia.left);
        count++;
        if(isFinite(dt)&&isFinite(dl))hit={type:type,id:String(ib.id),dt:dt,dl:dl};
      });
    });
    return count===1?hit:null;
  }
  _onCanvasRoom(idx){
    if(idx===this.roomIdx&&!this.global)return;
    this.sel=null;
    this._setRoom(idx,false,'canvas');
  }
  _onCanvasSel(type,id,o){
    if(!type){if(this.sel&&RS_TYPES[this.sel.type]&&RS_TYPES[this.sel.type].canvas){this.sel=null;this.multi=[];this._renderOutlineList();this._renderSelBar();}return;}
    if(o&&o.add)this._toggleSel(type,String(id),'canvas');
    else this._select(type,String(id),'canvas');
  }
  _reselectCanvas(){
    const card=this._card;
    this._applyLayerCss();
    if(!card||this.mode!=='arrange'||typeof card._rocSelect!=='function')return;
    const s=this.sel;
    try{card._rocSelect(s&&RS_TYPES[s.type]&&RS_TYPES[s.type].canvas?s.type:null,s?s.id:null);}catch(_){}
    if(typeof card._rocMark==='function')try{card._rocMark(this.multi.filter(function(x){return RS_TYPES[x.type]&&RS_TYPES[x.type].canvas;}));}catch(_){}
  }
  // hidden / locked layers: a stylesheet inside the canvas card (studio view only)
  _applyLayerCss(){
    const card=this._card;if(!card)return;
    let css='';
    this.hidden.forEach(function(t){const q=RS_LAYER_SEL[t];if(q)css+=q.map(function(x){return'.content '+x;}).join(',')+'{display:none!important;}';});
    this.locked.forEach(function(t){const q=RS_LAYER_SEL[t];if(q)css+=q.map(function(x){return'.content '+x+',.content '+x+' *';}).join(',')+'{pointer-events:none!important;}';});
    css+=this._markCss();
    card._rocExtraCss=css;
    const sr=card.shadowRoot;if(!sr)return;
    let st=sr.querySelector('style.roc-xcss');
    if(!css){if(st)st.remove();return;}
    if(!st){st=document.createElement('style');st.className='roc-xcss';const first=sr.querySelector('style');if(first&&first.nextSibling)sr.insertBefore(st,first.nextSibling);else sr.appendChild(st);}
    st.textContent=css;
  }
  toggleLayer(type,what){
    const set=what==='lock'?this.locked:this.hidden;
    if(set.has(type))set.delete(type);else set.add(type);
    // a hidden or locked element cannot stay selected on the canvas
    if(this.hidden.has(type)||this.locked.has(type)){
      if(this.sel&&this.sel.type===type)this.sel=this.multi.shift()||null;
      this.multi=this.multi.filter(function(x){return x.type!==type;});
    }
    this._reselectCanvas();this._renderOutlineList();this._renderSelBar();
  }

  // ---------------------------------------------------------------- selection (Phase 3)
  _findItem(type,id,cfg){
    const T=RS_TYPES[type];if(!T)return null;
    const o=rsOwner(cfg||this.work,this.roomIdx,this.global,T.key);
    if(!o.list)return null;
    const i=o.list.findIndex(function(x){return x&&String(x.id)===String(id);});
    return i<0?null:{list:o.list,idx:i,item:o.list[i],inherited:o.inherited};
  }
  _selSet(){return(this.sel?[this.sel]:[]).concat(this.multi);}
  _isSel(type,id){return this._selSet().some(function(x){return x.type===type&&x.id===String(id);});}
  // Shift / Ctrl / ⌘ click: add to the selection, or take an already selected element out of it
  _toggleSel(type,id,from){
    if(!RS_TYPES[type])return;
    id=String(id);
    if(!this.sel){this._select(type,id,from);return;}
    if(this._isSel(type,id)){
      if(this.sel.type===type&&this.sel.id===id)this.sel=this.multi.shift()||null;
      else this.multi=this.multi.filter(function(x){return!(x.type===type&&x.id===id);});
    }else{
      this.multi.push(this.sel);
      this.sel={type:type,id:id};
    }
    this._reselectCanvas();
    if(this.sel&&from!=='inspector')this._revealItem(this.sel.type,this.sel.id);
    this._renderOutlineList();this._renderSelBar();
  }
  _select(type,id,from){
    if(!RS_TYPES[type])return;
    const f=this._findItem(type,id);
    this.multi=[];
    this.sel={type:type,id:String(id)};
    // an element the room inherits lives in the shared (Global) list — edit it there
    if(f&&f.inherited&&!this.global&&from!=='inspector'&&from!=='drag')this._setRoom(this.roomIdx,true,'select');
    if(from!=='canvas')this._reselectCanvas();
    if(from!=='inspector')this._revealItem(type,id);
    this._renderOutlineList();this._renderSelBar();
  }
  deselect(){
    if(!this.sel)return;
    this.sel=null;this.multi=[];
    if(this._card&&typeof this._card._rocMark==='function')try{this._card._rocMark([]);}catch(_){}
    if(this._card&&typeof this._card._rocSelect==='function'&&this.mode==='arrange')try{this._card._rocSelect(null);}catch(_){}
    this._renderOutlineList();this._renderSelBar();
  }
  // show the selection in the inspector: the Properties form follows the selection by itself
  // (_syncProps); in All settings the element's own editor panel is opened and flashed
  _revealItem(type,id){
    if(this.tab==='all')this._revealInEditor(type,id);
    if(this._narrow(700))this._app.classList.add('show-insp');this._app.classList.remove('show-outline');
  }
  _revealInEditor(type,id){
    const ed=this._ed,T=RS_TYPES[type];if(!ed||!T)return;
    const list=(ed._roomView()||{})[T.key]||[];
    const i=list.findIndex(function(x){return x&&String(x.id)===String(id);});
    const tab=ed.querySelector('[data-roctab="elements"]');if(tab)tab.click();
    const sec=ed.querySelector('details[data-panel="'+T.panel+'"]');if(sec)sec.open=true;
    const d=i>=0?ed.querySelector('details[data-panel="'+T.pre+'-'+i+'"]'):null;
    const target=d||sec;
    if(!target)return;
    if(d)d.open=true;
    try{target.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){try{target.scrollIntoView();}catch(__){}}
    const sm=target.querySelector('summary');
    if(sm){sm.style.outline='2px solid var(--primary-color,#03a9f4)';sm.style.outlineOffset='1px';clearTimeout(sm._rsT);sm._rsT=setTimeout(function(){sm.style.outline='';sm.style.outlineOffset='';},1400);}
  }
  _syncEditor(){
    const ed=this._ed;if(!ed)return;
    this._edStale=false;
    ed._editRoomIdx=this.roomIdx;ed._editGlobal=this.global;
    ed._rocStudioLoad(this.I.clone(this.work));
  }
  // the same breakpoints as the studio CSS: ≤1100 px the outline slides over, ≤700 px the inspector
  _narrow(px){try{return!!(window.matchMedia&&window.matchMedia('(max-width:'+px+'px)').matches);}catch(_){return false;}}
  _setTab(k){
    if(k!=='props'&&k!=='all')return;
    this.tab=k;
    try{localStorage.setItem('roc-studio-tab',k);}catch(_){}
    for(const x in this._tabBtns)this._tabBtns[x].setAttribute('aria-selected',String(x===k));
    this._propsPane.hidden=k!=='props';this._edPane.hidden=k!=='all';
    if(k==='props')this._syncProps(true);
    else{
      if(this._edStale)this._syncEditor();
      if(this.sel)this._revealInEditor(this.sel.type,this.sel.id);
    }
  }
  deleteSel(){
    const set=this._selSet();if(!set.length)return;
    const c=JSON.parse(rsJ(this.work));
    const self=this;let n=0;
    set.forEach(function(x){const f=self._findItem(x.type,x.id,c);if(f){f.list.splice(f.idx,1);n++;}});
    if(!n)return;
    this.sel=null;this.multi=[];
    this._commit(c,'studio');
  }
  duplicateSel(){
    const set=this._selSet();if(!set.length)return;
    const c=JSON.parse(rsJ(this.work));
    const self=this,made=[];
    set.forEach(function(x){
      const f=self._findItem(x.type,x.id,c);if(!f)return;
      const it=JSON.parse(rsJ(f.item));
      it.id=rsUniqueId(f.list,RS_TYPES[x.type].idp,it.id);
      if(it.top!=null)it.top=rsNudgePct(it.top,2);
      if(it.left!=null)it.left=rsNudgePct(it.left,2);
      f.list.splice(f.idx+1,0,it);
      made.push({type:x.type,id:String(it.id)});
    });
    if(!made.length)return;
    this._commit(c,'studio');
    this._selectMany(made);
  }
  // select a list of elements at once (the first one is the primary)
  _selectMany(list){
    if(!list.length)return;
    this._select(list[0].type,list[0].id,'studio');
    this.multi=list.slice(1);
    this._reselectCanvas();this._renderOutlineList();this._renderSelBar();
  }
  copySel(){
    const set=this._selSet();if(!set.length)return false;
    const self=this,items=[];
    set.forEach(function(x){const f=self._findItem(x.type,x.id);if(f)items.push({type:x.type,item:JSON.parse(rsJ(f.item))});});
    if(!items.length)return false;
    this._clip={items:items};
    try{localStorage.setItem('roc-studio-clip',rsJ(this._clip));}catch(_){}
    this._renderSelBar();
    return true;
  }
  // the clipboard: {items:[{type,item}]} (v6.43.0), or {room} — a v6.42.0 {type,item} still reads
  _clipboard(){
    let v=this._clip;
    if(!v)try{v=JSON.parse(localStorage.getItem('roc-studio-clip')||'null');}catch(_){v=null;}
    if(!v)return null;
    if(v.type&&v.item)v={items:[{type:v.type,item:v.item}]};
    if(v.room&&typeof v.room==='object')return v;
    if(Array.isArray(v.items)&&v.items.length&&v.items.every(function(x){return x&&RS_TYPES[x.type]&&x.item;}))return v;
    return null;
  }
  paste(){
    const clip=this._clipboard();if(!clip)return;
    if(clip.room){this.pasteRoom();return;}
    const c=JSON.parse(rsJ(this.work));
    const self=this,made=[];
    clip.items.forEach(function(x){
      const T=RS_TYPES[x.type];
      const list=rsListForNew(c,self.roomIdx,self.global,T.key);
      const it=JSON.parse(rsJ(x.item));
      it.id=rsUniqueId(list,T.idp,it.id);
      if(list.some(function(y){return y&&y.top===it.top&&y.left===it.left;})){it.top=rsNudgePct(it.top,2);it.left=rsNudgePct(it.left,2);}
      list.push(it);
      made.push({type:x.type,id:String(it.id)});
    });
    this._commit(c,'studio');
    this._selectMany(made);
  }

  selectAll(){
    const self=this,all=[];
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];if(!T.canvas||self.hidden.has(type)||self.locked.has(type))return;
      (rsOwner(self.work,self.roomIdx,self.global,T.key).list||[]).forEach(function(it){if(it&&it.id!=null)all.push({type:type,id:String(it.id)});});
    });
    if(!all.length)return;
    this.sel=all[0];this.multi=all.slice(1);
    this._reselectCanvas();this._renderOutlineList();this._renderSelBar();
  }
  // ---------------------------------------------------------------- align / distribute (3b)
  // Measured on the canvas (what you see), applied to top / left. Values that are not "%"
  // strings are left alone — the button reports how many were skipped.
  _boxes(){
    const card=this._card,self=this;
    if(!card||typeof card._rocBox!=='function')return[];
    return this._selSet().filter(function(x){return RS_TYPES[x.type]&&RS_TYPES[x.type].canvas;}).map(function(x){
      let b=null;try{b=card._rocBox(x.type,x.id);}catch(_){}
      return b?{x:x,b:b}:null;
    }).filter(Boolean);
  }
  align(edge){
    const bs=this._boxes();if(bs.length<2)return 0;
    const L=Math.min.apply(null,bs.map(function(o){return o.b.l;})),R=Math.max.apply(null,bs.map(function(o){return o.b.l+o.b.w;}));
    const T=Math.min.apply(null,bs.map(function(o){return o.b.t;})),B=Math.max.apply(null,bs.map(function(o){return o.b.t+o.b.h;}));
    const d=function(o){
      switch(edge){
        case'left':return{dl:L-o.b.l};case'right':return{dl:R-(o.b.l+o.b.w)};case'center':return{dl:(L+R)/2-(o.b.l+o.b.w/2)};
        case'top':return{dt:T-o.b.t};case'bottom':return{dt:B-(o.b.t+o.b.h)};case'middle':return{dt:(T+B)/2-(o.b.t+o.b.h/2)};
      }
      return{};
    };
    return this._shiftBoxes(bs.map(function(o){return Object.assign({x:o.x},d(o));}));
  }
  distribute(axis){
    const bs=this._boxes();if(bs.length<3)return 0;
    const h=axis!=='vertical';
    const pos=function(o){return h?o.b.l:o.b.t;},size=function(o){return h?o.b.w:o.b.h;};
    bs.sort(function(a,b){return pos(a)-pos(b);});
    const first=bs[0],last=bs[bs.length-1];
    const span=pos(last)+size(last)-pos(first);
    const sum=bs.reduce(function(a,o){return a+size(o);},0);
    const gap=(span-sum)/(bs.length-1);
    let cur=pos(first)+size(first)+gap;
    const moves=[];
    for(let i=1;i<bs.length-1;i++){const o=bs[i];const dd=cur-pos(o);moves.push(h?{x:o.x,dl:dd}:{x:o.x,dt:dd});cur+=size(o)+gap;}
    return this._shiftBoxes(moves);
  }
  _shiftBoxes(moves){
    const c=JSON.parse(rsJ(this.work));
    const self=this;let skipped=0,moved=0;
    moves.forEach(function(m){
      const f=self._findItem(m.x.type,m.x.id,c);if(!f)return;
      let ok=true;
      if(m.dt&&Math.abs(m.dt)>0.01)ok=rsShiftPct(f.item,'top',m.dt)&&ok;
      if(m.dl&&Math.abs(m.dl)>0.01)ok=rsShiftPct(f.item,'left',m.dl)&&ok;
      if(ok)moved++;else skipped++;
    });
    this._lastSkipped=skipped;
    this._commit(c,'studio');
    this._reselectCanvas();this._renderSelBar();
    return moved;
  }

  // ---------------------------------------------------------------- rooms (3b)
  duplicateRoom(idx){
    const c=JSON.parse(rsJ(this.work));
    if(!Array.isArray(c.rooms)||!c.rooms[idx])return;
    const r=rsRoomCopy(c.rooms,c.rooms[idx],this.t('copy_suffix'));
    c.rooms.splice(idx+1,0,r);
    this._commit(c,'studio');
    this._setRoom(idx+1,false,'outline');
  }
  copyRoom(idx){
    const r=this._rooms()[idx];if(!r)return;
    this._clip={room:JSON.parse(rsJ(r))};
    try{localStorage.setItem('roc-studio-clip',rsJ(this._clip));}catch(_){}
    this._renderChrome();
  }
  pasteRoom(){
    const clip=this._clipboard();if(!clip||!clip.room)return;
    const c=JSON.parse(rsJ(this.work));
    if(!Array.isArray(c.rooms)||!c.rooms.length)return; // a single-room card has no room list to add to
    const r=rsRoomCopy(c.rooms,clip.room,this.t('copy_suffix'));
    c.rooms.push(r);
    this._commit(c,'studio');
    this._setRoom(c.rooms.length-1,false,'outline');
  }
  deleteRoom(idx){
    const rooms=this._rooms();if(rooms.length<2||!rooms[idx])return;
    const c=JSON.parse(rsJ(this.work));
    c.rooms.splice(idx,1);
    this.sel=null;this.multi=[];
    if(this.roomIdx>=idx&&this.roomIdx>0)this.roomIdx--;
    this._commit(c,'studio');
    this._setRoom(this.roomIdx,false,'outline');
  }

  // ---------------------------------------------------------------- add (draw-to-create, E3)
  _showAdd(){
    const self=this;
    const grid=rsEl('div',{class:'addgrid'});
    let close=null;
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];
      grid.appendChild(rsEl('button',{class:'btn addbtn',type:'button','data-type':type,onclick:function(){if(close)close();self.add(type);}},
        [rsIcon(T.icon),rsEl('span',{text:self.t('t_'+type)})]));
    });
    close=this._panel(this.t('add_title'),[this.t(this._rooms().length&&!this.global?'add_body_room':'add_body'),grid],[{label:this.t('cancel'),id:'cancel'}]);
  }
  // canvas types: place by clicking / drawing on the image; the others are added straight away
  add(type){
    const T=RS_TYPES[type];if(!T)return;
    if(!T.canvas){this._create(type,null);return;}
    if(this.mode!=='arrange')this._setMode('arrange');
    this._startPlace(type);
  }
  _startPlace(type){
    const self=this;
    this._cancelPlace();
    this._placeType=type;
    const layer=rsEl('div',{class:'place'});
    const box=rsEl('div',{class:'place-box'});
    layer.appendChild(box);
    let sx=0,sy=0,down=false,pid=null;
    const sr=function(){return self._stage.getBoundingClientRect();};
    layer.addEventListener('pointerdown',function(e){
      if(e.button!==undefined&&e.button!==0)return;
      e.preventDefault();down=true;pid=e.pointerId;sx=e.clientX;sy=e.clientY;
      try{layer.setPointerCapture(pid);}catch(_){}
      box.style.display='none';
    });
    layer.addEventListener('pointermove',function(e){
      if(!down)return;
      const r=sr();
      box.style.display='block';
      box.style.left=(Math.min(sx,e.clientX)-r.left)+'px';box.style.top=(Math.min(sy,e.clientY)-r.top)+'px';
      box.style.width=Math.abs(e.clientX-sx)+'px';box.style.height=Math.abs(e.clientY-sy)+'px';
    });
    const up=function(e){
      if(!down)return;down=false;
      try{layer.releasePointerCapture(pid);}catch(_){}
      self._placeAt(sx,sy,e.clientX,e.clientY);
    };
    layer.addEventListener('pointerup',up);
    layer.addEventListener('pointercancel',function(){down=false;box.style.display='none';});
    this._stage.appendChild(layer);
    this._placeLayer=layer;
    this._renderSelBar();
  }
  _cancelPlace(){
    if(this._placeLayer){this._placeLayer.remove();this._placeLayer=null;}
    if(this._placeType){this._placeType=null;this._renderSelBar();}
  }
  // client coordinates of the press and the release → a new element on the image
  _placeAt(x0,y0,x1,y1){
    const type=this._placeType;
    const cont=this._card&&this._card.shadowRoot&&this._card.shadowRoot.querySelector('.content');
    this._cancelPlace();
    if(!type||!cont)return;
    const cr=cont.getBoundingClientRect();
    if(!(cr.width>0&&cr.height>0))return;
    const px=function(x){return(x-cr.left)/cr.width*100;},py=function(y){return(y-cr.top)/cr.height*100;};
    const dragged=Math.abs(x1-x0)+Math.abs(y1-y0)>8;
    const pos={};
    if(RS_TYPES[type].draw==='box'&&dragged){
      const l=Math.max(0,Math.min(px(x0),px(x1))),t=Math.max(0,Math.min(py(y0),py(y1)));
      const w=Math.min(100-l,Math.abs(px(x1)-px(x0))),h=Math.min(100-t,Math.abs(py(y1)-py(y0)));
      pos.top=rsPct(t);pos.left=rsPct(l);
      if(w>=1)pos.width=rsPct(w);
      if(h>=1)pos.height=rsPct(h);
    }else{
      pos.top=rsPct(py(y1));pos.left=rsPct(px(x1));
    }
    this._create(type,pos);
  }
  _create(type,pos){
    const T=RS_TYPES[type];
    const c=JSON.parse(rsJ(this.work));
    const list=rsListForNew(c,this.roomIdx,this.global,T.key);
    const it={id:rsUniqueId(list,T.idp)};
    if(pos){it.top=pos.top;it.left=pos.left;}
    const def=JSON.parse(rsJ(T.def));
    for(const k in def)if(!(pos&&pos[k]!==undefined))it[k]=def[k];
    if(pos&&pos.width)it.width=pos.width;
    if(pos&&pos.height)it.height=pos.height;
    list.push(it);
    this._commit(c,'studio');
    this._select(type,it.id,'studio');
  }
  _renderSelBar(){
    const self=this,b=this._selBar;if(!b)return;
    this._syncProps();
    b.innerHTML='';
    if(this._placeType){
      b.appendChild(rsEl('span',{class:'hint',text:this.t('place_hint',{t:this.t('t_'+this._placeType)})}));
      b.appendChild(rsEl('button',{class:'btn sm',type:'button',onclick:function(){self._cancelPlace();}},[this.t('cancel')]));
      return;
    }
    const s=this.sel;
    const n=this._selSet().length;
    if(s&&RS_TYPES[s.type]){
      b.appendChild(rsEl('span',{class:'chip'},[rsIcon(RS_TYPES[s.type].icon),rsEl('span',{text:n>1?this.t('n_selected',{n:n}):s.id})]));
      if(n>1){
        const al=rsEl('span',{class:'seg aligns'});
        [['left','mdi:align-horizontal-left'],['center','mdi:align-horizontal-center'],['right','mdi:align-horizontal-right'],['top','mdi:align-vertical-top'],['middle','mdi:align-vertical-center'],['bottom','mdi:align-vertical-bottom']].forEach(function(a){
          al.appendChild(rsEl('button',{type:'button','data-act':'al-'+a[0],title:self.t('al_'+a[0]),'aria-label':self.t('al_'+a[0]),onclick:function(){self.align(a[0]);}},[rsIcon(a[1])]));
        });
        if(n>2){
          al.appendChild(rsEl('button',{type:'button','data-act':'dist-h',title:self.t('dist_h'),'aria-label':self.t('dist_h'),onclick:function(){self.distribute('horizontal');}},[rsIcon('mdi:distribute-horizontal-center')]));
          al.appendChild(rsEl('button',{type:'button','data-act':'dist-v',title:self.t('dist_v'),'aria-label':self.t('dist_v'),onclick:function(){self.distribute('vertical');}},[rsIcon('mdi:distribute-vertical-center')]));
        }
        b.appendChild(al);
        if(this._lastSkipped)b.appendChild(rsEl('span',{class:'hint warn',text:this.t('al_skipped',{n:this._lastSkipped})}));
      }
      b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'dup',title:this.t('dup_hint'),onclick:function(){self.duplicateSel();}},[rsIcon('mdi:content-duplicate'),rsEl('span',{class:'lbl',text:this.t('dup')})]));
      b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'copy',title:this.t('copy_hint'),onclick:function(){self.copySel();}},[rsIcon('mdi:content-copy'),rsEl('span',{class:'lbl',text:this.t('copy')})]));
      b.appendChild(rsEl('button',{class:'btn sm danger',type:'button','data-act':'del',title:this.t('del_hint'),onclick:function(){self.deleteSel();}},[rsIcon('mdi:delete-outline'),rsEl('span',{class:'lbl',text:this.t('del')})]));
    }
    if(this._clipboard())b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'paste',title:this.t('paste_hint'),onclick:function(){self.paste();}},[rsIcon('mdi:content-paste'),rsEl('span',{class:'lbl',text:this.t('paste')})]));
  }

  // ---------------------------------------------------------------- properties (4a)
  // What the Properties form edits: the selected element; else the room shown; else the card
  // itself (a single-room card, or Global = the defaults every room falls back to).
  _propsTarget(){
    const s=this.sel;
    if(s&&RS_TYPES[s.type]){const f=this._findItem(s.type,s.id);if(f)return{kind:'element',type:s.type,id:s.id,f:f};}
    if(this._rooms().length&&!this.global)return{kind:'room'};
    return{kind:'card'};
  }
  // the validator's path of an element ("rooms[1].zones[0]", "icons[2]")
  _itemPath(type,id){
    const T=RS_TYPES[type],f=this._findItem(type,id);if(!T||!f)return null;
    const room=rsRoom(this.work,this.roomIdx,this.global);
    return(room&&!f.inherited?'rooms['+this.roomIdx+'].':'')+T.key+'['+f.idx+']';
  }
  _levelOf(prefix){
    let lv='';
    (this._findings||[]).forEach(function(f){
      const p=f.path||'';
      if(p===prefix||p.indexOf(prefix+'.')===0||p.indexOf(prefix+'[')===0){if(f.level==='error')lv='error';else if(!lv)lv='warn';}
    });
    return lv;
  }
  // pinned validation: a dot on outline rows that have findings, a red ring on the canvas
  _applyMarks(outlineOnly){
    const self=this;
    const dot=function(btn,lv){
      const old=btn.querySelector('.vd');if(old)old.remove();
      if(lv)btn.appendChild(rsEl('span',{class:'vd '+lv,title:self.t(lv==='error'?'mark_err':'mark_warn')}));
    };
    if(this._olList)this._olList.querySelectorAll('.ol-el[data-type]').forEach(function(b){const p=self._itemPath(b.getAttribute('data-type'),b.getAttribute('data-id'));dot(b,p?self._levelOf(p):'');});
    if(this._olRooms)this._olRooms.querySelectorAll('[data-room]').forEach(function(b){dot(b,self._levelOf('rooms['+b.getAttribute('data-room')+']'));});
    if(outlineOnly)return;
    if(this._propsPane){const r=this._propsPane.firstChild;if(r&&r._rsRefresh)r._rsRefresh(this._findings||[]);}
    this._applyLayerCss();
  }
  _markCss(){
    if(this.mode!=='arrange'||!this._findings||!this._findings.length)return'';
    const self=this,sels=[];
    const q=function(v){return'"'+String(v).replace(/["\\]/g,'\\$&')+'"';};
    const attr={zone:['data-z'],icon:['data-ico'],label:['data-lbl'],gauge:['data-gauge'],element:['data-el'],glow:['data-glow','data-glowedit'],vacuum_widget:['data-vw']};
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];if(!T.canvas||self.hidden.has(type))return;
      (rsOwner(self.work,self.roomIdx,self.global,T.key).list||[]).forEach(function(it){
        if(!it||it.id==null)return;
        const p=self._itemPath(type,it.id);
        if(!p||self._levelOf(p)!=='error')return;
        if(type==='blind')sels.push('.content [data-gauge='+q('__bl_'+it.id)+']');
        else (attr[type]||[]).forEach(function(a){sels.push('.content ['+a+'='+q(it.id)+']');});
      });
    });
    return sels.length?sels.join(',')+'{box-shadow:0 0 0 2px var(--error-color,#db4437),0 0 12px 3px rgba(219,68,55,.55)!important;}':'';
  }
  // rebuild the form when what it shows changed — but not after its own commit (the cursor is in it)
  _syncProps(force){
    const pane=this._propsPane;if(!pane)return;
    if(this.tab!=='props'){this._propsSig='';return;}
    const tg=this._propsTarget();
    const key=tg.kind+':'+(tg.type||'')+':'+(tg.id||'')+'@'+(this.global?'g':this.roomIdx);
    let data;
    if(tg.kind==='element')data=rsJ(tg.f.item)+(tg.f.inherited?'i':'');
    else if(tg.kind==='room')data=rsJ(this._rooms()[this.roomIdx]);
    else{const w=this.work,o={};RS_CARD_KEYS.forEach(function(k){o[k]=w[k];});data=rsJ(o);}
    const sig=key+'|'+data+'|'+this._selSet().length;
    if(!force&&sig===this._propsSig)return;
    if(!force&&this._propsSkip&&key===this._propsKey){this._propsSig=sig;this._propsSkip=false;return;}
    this._propsSkip=false;
    const same=key===this._propsKey;
    const st=pane.scrollTop;
    // the same target rebuilt (undo, a canvas drag): the focus goes back to the same field
    let fk=null;
    const ae=this._sr&&this._sr.activeElement;
    if(same&&ae&&pane.contains(ae)&&!ae.closest('.rs-pick')){const f=ae.closest('.pf-field');if(f)fk=f.getAttribute('data-key');}
    this._propsSig=sig;this._propsKey=key;
    pane.innerHTML='';
    pane.appendChild(rsBuildProps(this._propsCtx(tg),tg));
    pane.scrollTop=same?st:0;
    if(fk){const f=pane.querySelector('.pf-field[data-key="'+fk+'"]');const el=f&&f.querySelector('input,select,textarea');if(el)try{el.focus({preventScroll:true});}catch(_){}}
  }
  _propsCtx(tg){
    const self=this;
    const room=rsRoom(this.work,this.roomIdx,this.global);
    let item,path,inherited=false;
    if(tg.kind==='element'){item=tg.f.item;inherited=tg.f.inherited;path=this._itemPath(tg.type,tg.id);}
    else if(tg.kind==='room'){item=this._rooms()[this.roomIdx];path='rooms['+this.roomIdx+']';}
    else{item=this.work;path='';}
    return{
      t:function(k,v){return self.t(k,v);},I:this.I,
      get hass(){return self.hass;},
      work:this.work,scope:room||this.work,item:item,path:path,global:this.global,
      findings:this._findings||this._validate(),
      domains:tg.kind==='element'?(RS_DOMAINS[tg.type]||null):null,
      labels:{z_index:'Z-index',hold_delay:'Hold delay (ms)'},
      open:this._propsOpen,inherited:inherited,multi:this._selSet().length,
      set:function(k,v){self._propsSet(tg,function(it){if(v===undefined)delete it[k];else it[k]=v;},k);},
      setRest:function(keys,obj){
        self._propsSet(tg,function(it){keys.forEach(function(k){if(!(k in obj))delete it[k];});Object.keys(obj).forEach(function(k){it[k]=obj[k];});},'_rest');
        self._syncProps(true);
      },
      rename:function(nid){self._propsRename(tg,nid);},
      rerender:function(){self._syncProps(true);},
      openAll:function(){self._setTab('all');if(tg.kind!=='element'&&self._ed){const tab=self._ed.querySelector('[data-roctab="'+(tg.kind==='room'?'rooms':'image')+'"]');if(tab)tab.click();}},
    };
  }
  // one change from the form: a copy of the config, the target's own object changed in place
  // (every other key, and the key order, stay as they are — KEEP)
  _propsSet(tg,mut,key){
    const c=JSON.parse(rsJ(this.work));
    let it=null;
    if(tg.kind==='element'){const f=this._findItem(tg.type,tg.id,c);it=f&&f.item;}
    else if(tg.kind==='room')it=Array.isArray(c.rooms)?c.rooms[this.roomIdx]:null;
    else it=c;
    if(!it||typeof it!=='object')return;
    mut(it);
    this._commit(c,'props',(tg.kind==='element'?tg.type+':'+tg.id:tg.kind)+'.'+key);
  }
  _propsRename(tg,nid){
    if(tg.kind!=='element')return;
    const c=JSON.parse(rsJ(this.work));
    const f=this._findItem(tg.type,tg.id,c);if(!f)return;
    const others=f.list.filter(function(x,i){return i!==f.idx;});
    const id=rsUniqueId(others,RS_TYPES[tg.type].idp,nid);
    f.item.id=id;
    if(this.sel&&this.sel.type===tg.type&&this.sel.id===String(tg.id))this.sel={type:tg.type,id:String(id)};
    this._commit(c,'props','id');
    this._syncProps(true);
  }

  // ---------------------------------------------------------------- state
  _rooms(){return Array.isArray(this.work&&this.work.rooms)?this.work.rooms:[];}
  _dirty(){return rsJ(this.work)!==this.base;}
  _commit(c,src,key){
    const j=rsJ(c),cur=rsJ(this.work);
    if(j===cur)return;
    const now=Date.now();
    // a typing burst in one field fires every 150 ms — keep it as ONE undo step; the Properties
    // form commits on change, so only repeated changes of the same key within 800 ms merge
    const coalesce=now-this.lastCommit<800&&((src==='editor'&&this.lastSrc==='editor')||(src==='props'&&this.lastSrc==='props'&&key!=null&&key===this._lastKey));
    this._lastKey=key;
    if(!coalesce){this.undoStack.push(cur);if(this.undoStack.length>200)this.undoStack.shift();}
    this.redoStack=[];
    this.lastCommit=now;this.lastSrc=src;
    this.work=JSON.parse(j);
    this._afterChange(src);
  }
  undo(){
    if(!this.undoStack.length)return;
    this.redoStack.push(rsJ(this.work));
    this.work=JSON.parse(this.undoStack.pop());
    this.lastSrc='undo';this._afterChange('undo');
  }
  redo(){
    if(!this.redoStack.length)return;
    this.undoStack.push(rsJ(this.work));
    this.work=JSON.parse(this.redoStack.pop());
    this.lastSrc='redo';this._afterChange('redo');
  }
  _afterChange(src){
    const self0=this;
    this.multi=this.multi.filter(function(x){return!!self0._findItem(x.type,x.id);});
    if(this.sel&&!this._findItem(this.sel.type,this.sel.id))this.sel=this.multi.shift()||null;
    const n=this._rooms().length;
    if(n&&this.roomIdx>=n)this.roomIdx=n-1;
    if(!n)this.global=false;
    if(src!=='editor'&&this._ed){
      // the hosted editor is rebuilt only while it is shown (All settings) — otherwise once, when
      // its tab is opened (a large card's editor takes a while to build)
      if(this.tab==='all')this._syncEditor();else this._edStale=true;
    }
    if(src==='canvas'){if(this._card)this._card._cfgJson=null;} // card already shows it; never skip its next setConfig
    else this._pushCanvas(src!=='editor');
    this._propsSkip=src==='props'; // the form already shows its own change — do not rebuild it under the cursor
    this._renderChrome();
  }
  _setRoom(idx,global,from){
    const n=this._rooms().length;
    if(!n)return;
    idx=Math.max(0,Math.min(idx|0,n-1));
    const gChanged=!!global!==this.global;
    this.roomIdx=idx;this.global=!!global;
    if(from!=='editor'&&this._ed){if(this.tab==='all'){this._ed._editRoomIdx=idx;this._ed._editGlobal=this.global;this._ed._render();}else this._edStale=true;}
    if(from!=='canvas'){
      if(gChanged)this._pushCanvas(true);
      this._canvasRoom();
    }
    this._renderChrome();
  }
  _pollHass(){
    let h=null;
    try{const ha=document.querySelector('home-assistant');h=ha&&ha.hass;}catch(_){}
    if(!h)h=(this.target.editor&&this.target.editor._hass)||(this.opts.card&&this.opts.card._hass)||null;
    if(h&&h!==this.hass)this.setHass(h);
  }
  setHass(h){
    this.hass=h;
    if(this._card)this._card.hass=h;
    if(this._ed)this._ed.hass=h;
  }

  // ---------------------------------------------------------------- chrome
  _renderChrome(){
    const self=this,I=this.I,rooms=this._rooms();
    // room select
    const sel=this._roomSel;
    sel.style.display=rooms.length?'':'none';
    sel.innerHTML='';
    if(rooms.length){
      sel.appendChild(rsEl('option',{value:'global',text:'🌐 '+this.t('global')}));
      rooms.forEach(function(r,i){sel.appendChild(rsEl('option',{value:String(i),text:String(r.name||r.id||('room '+(i+1)))}));});
      sel.value=this.global?'global':String(this.roomIdx);
    }
    // outline: rooms
    const ol=this._olRooms;ol.innerHTML='';
    if(rooms.length){
      ol.appendChild(rsEl('div',{class:'ol-h',text:this.t('rooms')}));
      const mk=function(label,icon,cur,fn){return rsEl('button',{class:'ol-item',type:'button','aria-current':String(!!cur),onclick:fn},[rsIcon(icon),rsEl('span',{text:label})]);};
      ol.appendChild(mk(this.t('global'),'mdi:earth',this.global,function(){self._setRoom(self.roomIdx,true,'outline');}));
      rooms.forEach(function(r,i){
        const cur=!self.global&&i===self.roomIdx;
        const row=rsEl('div',{class:'ol-row'+(cur?' cur':'')});
        const rb=mk(String(r.name||r.id||('room '+(i+1))),r.overview?'mdi:view-dashboard-outline':'mdi:door',cur,function(){self.sel=null;self.multi=[];self._setRoom(i,false,'outline');self._app.classList.remove('show-outline');});
        rb.setAttribute('data-room',String(i));
        row.appendChild(rb);
        if(cur){
          row.appendChild(rsEl('button',{class:'ol-act',type:'button','data-act':'room-dup',title:self.t('room_dup'),'aria-label':self.t('room_dup'),onclick:function(){self.duplicateRoom(i);}},[rsIcon('mdi:content-duplicate')]));
          row.appendChild(rsEl('button',{class:'ol-act',type:'button','data-act':'room-copy',title:self.t('room_copy'),'aria-label':self.t('room_copy'),onclick:function(){self.copyRoom(i);}},[rsIcon('mdi:content-copy')]));
          if(rooms.length>1)row.appendChild(rsEl('button',{class:'ol-act danger',type:'button','data-act':'room-del',title:self.t('room_del'),'aria-label':self.t('room_del'),onclick:function(){self._panel(self.t('room_del_title',{r:String(r.name||r.id||'')}),[self.t('room_del_body')],[{label:self.t('room_del'),cls:'danger',id:'room-del-ok',fn:function(){self.deleteRoom(i);}},{label:self.t('cancel'),cls:'primary',id:'cancel'}]);}},[rsIcon('mdi:delete-outline')]));
        }
        ol.appendChild(row);
      });
      const clip=this._clipboard();
      if(clip&&clip.room)ol.appendChild(rsEl('button',{class:'ol-item ol-paste',type:'button','data-act':'room-paste',onclick:function(){self.pasteRoom();}},[rsIcon('mdi:content-paste'),rsEl('span',{text:self.t('room_paste',{r:String(clip.room.name||clip.room.id||'')})})]));
    }
    this._renderOutlineList();
    this._renderSelBar();
    // undo / redo
    this._undoBtn.disabled=!this.undoStack.length;
    this._redoBtn.disabled=!this.redoStack.length;
    // status
    const dirty=this._dirty();
    this._dirtyEl.className=dirty?'dirty':'';
    this._dirtyEl.textContent=dirty?this.t('dirty'):(this._savedAt?this._savedAt:this.t('clean'));
    const tg=this.target;
    this._tgtEl.textContent=tg.kind==='editor'?this.t('tgt_editor'):(tg.kind==='dashboard'?this.t('tgt_dash',{d:tg.dashName,p:tg.where}):this.t('tgt_yaml',{r:this.t(tg.reason||'r_notfound')}));
    clearTimeout(this._vT);
    this._vT=setTimeout(function(){self._renderValidation();},120);
  }
  // outline: every element of the room (or Global) by type, filtered by the search box
  _renderOutlineList(){
    const self=this,box=this._olList;if(!box)return;
    box.innerHTML='';
    const q=String(this.search||'').trim().toLowerCase();
    const hit=function(type,it){
      if(!q)return true;
      const hay=[type,self.t('t_'+type),it.id,it.name,it.entity,it.icon,it.card&&it.card.entity,it.card&&it.card.type].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(q)>=0;
    };
    let shown=0;
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];
      const o=rsOwner(self.work,self.roomIdx,self.global,T.key);
      const items=(o.list||[]).filter(function(it){return it&&typeof it==='object'&&hit(type,it);});
      if(!items.length)return;
      shown+=items.length;
      const hid=self.hidden.has(type),lck=self.locked.has(type);
      const head=rsEl('div',{class:'ol-row ol-kindrow'+(hid?' hid':'')});
      head.appendChild(rsEl('button',{class:'ol-item ol-kind',type:'button',onclick:function(){self._reveal(T.panel);}},
        [rsIcon(T.icon),rsEl('span',{text:self.t('k_'+T.key)}),o.inherited?rsEl('span',{class:'tag',text:self.t('inherited')}):null,rsEl('span',{class:'n',text:String(items.length)})]));
      if(T.canvas||type==='overlay'||type==='badge'){
        head.appendChild(rsEl('button',{class:'ol-act'+(hid?' on':''),type:'button','data-act':'hide-'+type,'aria-pressed':String(hid),title:self.t(hid?'layer_show':'layer_hide'),'aria-label':self.t(hid?'layer_show':'layer_hide'),onclick:function(){self.toggleLayer(type,'hide');}},[rsIcon(hid?'mdi:eye-off-outline':'mdi:eye-outline')]));
        if(T.canvas)head.appendChild(rsEl('button',{class:'ol-act'+(lck?' on':''),type:'button','data-act':'lock-'+type,'aria-pressed':String(lck),title:self.t(lck?'layer_unlock':'layer_lock'),'aria-label':self.t(lck?'layer_unlock':'layer_lock'),onclick:function(){self.toggleLayer(type,'lock');}},[rsIcon(lck?'mdi:lock-outline':'mdi:lock-open-variant-outline')]));
      }
      box.appendChild(head);
      items.forEach(function(it){
        const cur=self._isSel(type,it.id);
        const sub=it.entity||(it.card&&it.card.entity)||it.icon||'';
        box.appendChild(rsEl('button',{class:'ol-item ol-el'+(hid?' hid':''),type:'button','data-type':type,'data-id':String(it.id),'aria-current':String(cur),onclick:function(e){if(e.shiftKey||e.ctrlKey||e.metaKey)self._toggleSel(type,String(it.id),'outline');else self._select(type,String(it.id),'outline');}},
          [rsEl('span',{class:'nm',text:String(it.id==null?'':it.id)}),sub?rsEl('span',{class:'sub',text:String(sub)}):null]));
      });
    });
    const lc=(rsRoom(self.work,self.roomIdx,self.global)||{}).light_controls||self.work.light_controls;
    const lcn=lc&&Array.isArray(lc.entities)?lc.entities.length:0;
    if(lcn&&(!q||'light controls lights'.indexOf(q)>=0)){
      shown+=1;
      box.appendChild(rsEl('button',{class:'ol-item ol-kind',type:'button',onclick:function(){self._reveal('lights');}},[rsIcon('mdi:tune-vertical'),rsEl('span',{text:self.t('k_lights')}),rsEl('span',{class:'n',text:String(lcn)})]));
    }
    if(!shown)box.appendChild(rsEl('div',{class:'ol-empty',text:q?this.t('no_match'):this.t('no_elements')}));
    this._applyMarks(true);
  }
  _validate(){
    try{return RocSchema.rocValidate(this.work).filter(function(x){return x.level!=='info';});}catch(e){return[{path:'',level:'error',msg:String(e&&e.message||e)}];}
  }
  _renderValidation(){
    const f=this._validate();
    const e=f.filter(function(x){return x.level==='error';}).length,w=f.length-e;
    const b=this._vBtn;b.innerHTML='';
    if(!f.length){b.appendChild(rsEl('span',{class:'ok'},[rsIcon('mdi:check-circle-outline')]));b.appendChild(document.createTextNode(this.t('valid_ok')));}
    else{
      b.appendChild(rsEl('span',{class:e?'err':'warn'},[rsIcon('mdi:alert-circle-outline')]));
      const parts=[];if(e)parts.push(this.t('valid_err',{e:e}));if(w)parts.push(this.t('valid_warn',{w:w}));
      b.appendChild(document.createTextNode(parts.join(' · ')));
    }
    this._findings=f;
    this._applyMarks();
  }
  // open the editor section that holds this kind of element
  _reveal(panel){
    const ed=this._ed;if(!ed)return;
    if(this.tab!=='all')this._setTab('all');
    const tab=ed.querySelector('[data-roctab="elements"]');if(tab)tab.click();
    const d=ed.querySelector('details[data-panel="'+panel+'"]');
    if(d){d.open=true;try{d.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){d.scrollIntoView();}}
    if(this._narrow(700))this._app.classList.add('show-insp');this._app.classList.remove('show-outline');
  }

  // ---------------------------------------------------------------- keyboard
  _onKey(e){
    const path=e.composedPath?e.composedPath():[e.target];
    const tgt=path[0]||e.target;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();
      // an open picker list closes first; a Properties field just gives up the focus (its change commits)
      const pk=this._sr&&this._sr.querySelector('.rs-pick.open');
      if(pk&&pk._rsClose){pk._rsClose();return;}
      if(this._propsPane&&tgt&&this._propsPane.contains(tgt)&&/^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName||'')){try{tgt.blur();}catch(_){}return;}
      if(this._layers.length){this._layers[this._layers.length-1]();return;}
      if(this._placeType){this._cancelPlace();return;}
      if(this.sel){this.deselect();return;}
      // a slide-over panel (narrow screens only — the classes do nothing on a wide one)
      if((this._app.classList.contains('show-outline')&&this._narrow(1100))||(this._app.classList.contains('show-insp')&&this._narrow(700))){this._app.classList.remove('show-outline','show-insp');return;}
      const card=this._card;
      if(card&&card._sectionOpen&&typeof card._closeSection==='function'){card._closeSection();return;}
      this.requestClose();
      return;
    }
    const tag=(tgt&&tgt.tagName||'').toLowerCase();
    const inField=tag==='input'||tag==='textarea'||tag==='select'||!!(tgt&&tgt.isContentEditable);
    // Ctrl+Z / Y in a Properties field with nothing typed yet is the studio's undo (the browser's
    // own would only put back the text of another field, without committing it)
    if(inField&&(e.ctrlKey||e.metaKey)&&!e.altKey&&this._propsPane&&this._propsPane.contains(tgt)&&!tgt._rsDirty&&!this._layers.length){
      const kz=String(e.key||'').toLowerCase();
      if(kz==='z'||kz==='y'){e.preventDefault();e.stopPropagation();if(kz==='y'||e.shiftKey)this.redo();else this.undo();return;}
    }
    if(!inField&&!this._layers.length&&(e.key==='Delete'||e.key==='Backspace')&&this.sel&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopPropagation();this.deleteSel();return;}
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
    const k=String(e.key||'').toLowerCase();
    if(k==='s'){e.preventDefault();e.stopPropagation();this.save();return;}
    if(inField||this._layers.length)return; // native undo / copy / paste inside fields
    if(k==='d'&&this.sel){e.preventDefault();e.stopPropagation();this.duplicateSel();return;}
    if(k==='a'){e.preventDefault();e.stopPropagation();this.selectAll();return;}
    if(k==='c'&&this.sel){e.preventDefault();e.stopPropagation();this.copySel();return;}
    if(k==='v'&&this._clipboard()){e.preventDefault();e.stopPropagation();this.paste();return;}
    if(k==='z'&&!e.shiftKey){e.preventDefault();e.stopPropagation();this.undo();}
    else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();e.stopPropagation();this.redo();}
  }

  // ---------------------------------------------------------------- panels
  _panel(title,body,buttons){
    const self=this;
    const layer=rsEl('div',{class:'layer'});
    const p=rsEl('div',{class:'panel',role:'dialog','aria-modal':'true','aria-label':title});
    p.appendChild(rsEl('h2',{text:title}));
    const pb=rsEl('div',{class:'pb'});
    (Array.isArray(body)?body:[body]).forEach(function(b){if(b!=null)pb.appendChild(typeof b==='string'?rsEl('p',{text:b}):b);});
    p.appendChild(pb);
    const pf=rsEl('div',{class:'pf'});
    const close=function(){const i=self._layers.indexOf(close);if(i>=0)self._layers.splice(i,1);layer.remove();};
    (buttons||[]).forEach(function(b){
      const el=rsEl('button',{class:'btn'+(b.cls?' '+b.cls:''),type:'button','data-act':b.id||null,onclick:function(){if(b.keep)b.fn&&b.fn(el);else{close();b.fn&&b.fn();}}},[b.label]);
      pf.appendChild(el);
    });
    p.appendChild(pf);
    layer.appendChild(p);
    layer.addEventListener('click',function(e){if(e.target===layer)close();});
    this._app.appendChild(layer);
    this._layers.push(close);
    const f=pf.querySelector('button.primary')||pf.querySelector('button');
    if(f)try{f.focus();}catch(_){}
    return close;
  }
  _yamlText(){return this.I.yaml.s(this.work);}
  _copy(text){
    try{if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).then(function(){return true;},function(){return false;});}catch(_){}
    return Promise.resolve(false);
  }
  _showYaml(){
    const self=this;
    const ta=rsEl('textarea',{readonly:true,spellcheck:'false'});ta.value=this._yamlText();
    this._panel(this.t('yaml_title'),[this.t('yaml_body'),ta],[
      {label:this.t('copy'),cls:'primary',keep:true,id:'copy',fn:function(btn){ta.focus();ta.select();try{document.execCommand('copy');}catch(_){}self._copy(ta.value);btn.textContent=self.t('copied');}},
      {label:this.t('close'),id:'close'},
    ]);
  }
  _showValidation(){
    const f=this._findings||this._validate();
    const body=[];
    if(!f.length)body.push(this.t('valid_none'));
    else{
      const ul=rsEl('ul',{class:'vl'});
      f.slice(0,200).forEach(function(x){ul.appendChild(rsEl('li',null,[rsEl('span',{class:'lv '+x.level,text:x.level}),rsEl('code',{text:x.path||'(card)'}),rsEl('span',{class:'m',text:x.msg})]));});
      body.push(ul);
    }
    this._panel(this.t('valid_title'),body,[{label:this.t('close'),id:'close'}]);
  }
  _showHistory(){
    const self=this;
    const h=rsHistLoad(this.histKey);
    let close=null;
    const body=[this.t('hist_body')];
    if(!h.length)body.push(this.t('hist_empty'));
    else{
      const ul=rsEl('ul',{class:'hl'});
      h.forEach(function(x){
        ul.appendChild(rsEl('li',null,[rsEl('span',{text:rsDate(x.t)}),rsEl('button',{class:'btn',type:'button',onclick:function(){try{self._commit(JSON.parse(x.cfg),'history');}catch(_){}if(close)close();}},[self.t('restore')])]));
      });
      body.push(ul);
    }
    close=this._panel(this.t('hist_title'),body,[{label:this.t('close'),id:'close'}]);
  }

  // ---------------------------------------------------------------- save / close
  save(opts){
    const self=this,tg=this.target;
    opts=opts||{};
    if(tg.kind==='yaml'){this._showYaml();return Promise.resolve(false);}
    if(tg.kind==='editor'){
      if(this._dirty())this._applyToEditor();
      this.base=rsJ(this.work);
      rsHistPush(this.histKey,this.work);
      if(opts.keepOpen){this._savedAt=this.t('applied');this._renderChrome();}
      else this.close();
      return Promise.resolve(true);
    }
    // dashboard
    if(this._saving)return this._saving;
    const cfg=this.I.clone(this.work);
    const lbl=this._saveBtn.querySelector('span');
    this._saveBtn.disabled=true;if(lbl)lbl.textContent=this.t('saving');
    const done=function(){self._saveBtn.disabled=false;if(lbl)lbl.textContent=self.t('save');self._saving=null;};
    this._saving=rsSaveDashboard(tg,this.hass,cfg,!!opts.force).then(function(){
      done();
      self.base=rsJ(cfg);
      self._savedAt=self.t('saved_at',{t:rsTime(Date.now())});
      rsHistPush(self.histKey,cfg);
      self._renderChrome();
      if(opts.close)self.close();
      return true;
    },function(err){
      done();
      if(err&&err.conflict){
        self._panel(self.t('conflict_title'),[self.t('conflict_body')],[
          {label:self.t('overwrite'),cls:'danger',id:'overwrite',fn:function(){self.save({force:true,close:opts.close});}},
          {label:self.t('copy_yaml'),id:'yaml',fn:function(){self._showYaml();}},
          {label:self.t('cancel'),cls:'primary',id:'cancel'},
        ]);
      }else{
        self._panel(self.t('save_failed',{m:(err&&(err.message||err.code))||String(err)}),[],[
          {label:self.t('copy_yaml'),id:'yaml',fn:function(){self._showYaml();}},{label:self.t('close'),cls:'primary',id:'close'}]);
      }
      return false;
    });
    return this._saving;
  }
  _applyToEditor(){
    const ed=this.target.editor,I=this.I;
    ed._editRoomIdx=this.roomIdx;ed._editGlobal=this.global;
    ed._config=I.migrate(I.clone(this.work));
    ed._render();
    ed._fire(ed._config); // the editor's own config-changed → HA's dialog (and its history: the HA editor's Undo reverts the whole studio session)
  }
  requestClose(){
    const self=this;
    if(!this._dirty()){this.close();return;}
    if(this._layers.length)return;
    const tk=this.target.kind;
    const btns=[];
    if(tk==='editor')btns.push({label:this.t('apply'),cls:'primary',id:'apply',fn:function(){self.save();}});
    if(tk==='dashboard')btns.push({label:this.t('save'),cls:'primary',id:'save',fn:function(){self.save({close:true});}});
    btns.push({label:this.t('discard'),cls:'danger',id:'discard',fn:function(){self.close();}});
    btns.push({label:this.t('keep'),id:'keep'});
    this._panel(this.t('guard_title'),[this.t('guard_body')],btns);
  }
  close(){
    this._teardown();
    if(RocStudio.current===this)RocStudio.current=null;
  }
  _teardown(){
    this._timers.forEach(function(t){clearInterval(t);});this._timers=[];
    clearTimeout(this._pcT);clearTimeout(this._vT);
    if(this._ro)try{this._ro.disconnect();}catch(_){}
    if(this._bu)window.removeEventListener('beforeunload',this._bu);
    if(this.C)this.C._rocStudioOpen=false;
    const d=this._dlg;
    if(d){try{if(d.open&&typeof d.close==='function')d.close();}catch(_){}d.remove();}
    if(this._card){this._card._rocSink=null;this._card._rocRoomSink=null;this._card._rocSelSink=null;}
    this._card=null;this._ed=null;
  }
}
// ---- Registration ---------------------------------------------------------------------------
// The card's loader (rocLoadStudio) looks for RoomOverlayCard._rocStudio after the import. If
// this file is evaluated before the card (e.g. added as its own dashboard resource), it waits.
function rocStudioRegister(){
  const C=customElements.get('room-overlay-card');
  if(!C||!C._rocInternals){console.warn('[room-overlay-card] studio: room-overlay-card.js is too old or not loaded — the studio needs v'+ROC_STUDIO_VERSION);return;}
  C._rocStudio={version:ROC_STUDIO_VERSION,open:function(opts){return RocStudio.open(opts);},Studio:RocStudio,schema:RocSchema};
}
if(customElements.get('room-overlay-card'))rocStudioRegister();
else customElements.whenDefined('room-overlay-card').then(rocStudioRegister);
})();
