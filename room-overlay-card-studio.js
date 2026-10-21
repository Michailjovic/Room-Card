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
 */
(function(){
'use strict';
const ROC_STUDIO_VERSION='6.42.0';
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
.insp{grid-area:insp;overflow:auto;border-left:1px solid var(--rs-line);background:var(--rs-panel);min-width:0;}
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
    this.search='';          // outline filter
    this._placeType=null;    // element type being placed on the canvas (Add)
    this._layers=[];this._timers=[];
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

    // inspector = today's editor, hosted unchanged (§5.5)
    this._insp=rsEl('aside',{class:'insp','aria-label':this.t('inspector')});
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
    this._insp.appendChild(ed);
  }

  _mountCanvas(){
    const self=this;
    const card=document.createElement('room-overlay-card');
    card._rocSink=function(nc){self._onCanvas(nc);};
    card._rocRoomSink=function(idx){self._onCanvasRoom(idx);};
    card._rocSelSink=function(type,id){self._onCanvasSel(type,id);};
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
    this._commit(this._restore(nc),'canvas');
  }
  _onCanvasRoom(idx){
    if(idx===this.roomIdx&&!this.global)return;
    this.sel=null;
    this._setRoom(idx,false,'canvas');
  }
  _onCanvasSel(type,id){
    if(!type){if(this.sel&&RS_TYPES[this.sel.type]&&RS_TYPES[this.sel.type].canvas){this.sel=null;this._renderOutlineList();this._renderSelBar();}return;}
    this._select(type,String(id),'canvas');
  }
  _reselectCanvas(){
    const card=this._card;
    if(!card||this.mode!=='arrange'||typeof card._rocSelect!=='function')return;
    const s=this.sel;
    try{card._rocSelect(s&&RS_TYPES[s.type]&&RS_TYPES[s.type].canvas?s.type:null,s?s.id:null);}catch(_){}
  }

  // ---------------------------------------------------------------- selection (Phase 3)
  _findItem(type,id,cfg){
    const T=RS_TYPES[type];if(!T)return null;
    const o=rsOwner(cfg||this.work,this.roomIdx,this.global,T.key);
    if(!o.list)return null;
    const i=o.list.findIndex(function(x){return x&&String(x.id)===String(id);});
    return i<0?null:{list:o.list,idx:i,item:o.list[i],inherited:o.inherited};
  }
  _select(type,id,from){
    if(!RS_TYPES[type])return;
    const f=this._findItem(type,id);
    this.sel={type:type,id:String(id)};
    // an element the room inherits lives in the shared (Global) list — edit it there
    if(f&&f.inherited&&!this.global&&from!=='inspector')this._setRoom(this.roomIdx,true,'select');
    if(from!=='canvas')this._reselectCanvas();
    if(from!=='inspector')this._revealItem(type,id);
    this._renderOutlineList();this._renderSelBar();
  }
  deselect(){
    if(!this.sel)return;
    this.sel=null;
    if(this._card&&typeof this._card._rocSelect==='function'&&this.mode==='arrange')try{this._card._rocSelect(null);}catch(_){}
    this._renderOutlineList();this._renderSelBar();
  }
  // open the element's own panel in the inspector, scroll to it and flash it
  _revealItem(type,id){
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
    this._app.classList.add('show-insp');this._app.classList.remove('show-outline');
  }
  deleteSel(){
    const s=this.sel;if(!s)return;
    const c=JSON.parse(rsJ(this.work));
    const f=this._findItem(s.type,s.id,c);if(!f)return;
    f.list.splice(f.idx,1);
    this.sel=null;
    this._commit(c,'studio');
  }
  duplicateSel(){
    const s=this.sel;if(!s)return;
    const c=JSON.parse(rsJ(this.work));
    const f=this._findItem(s.type,s.id,c);if(!f)return;
    const it=JSON.parse(rsJ(f.item));
    it.id=rsUniqueId(f.list,RS_TYPES[s.type].idp,it.id);
    if(it.top!=null)it.top=rsNudgePct(it.top,2);
    if(it.left!=null)it.left=rsNudgePct(it.left,2);
    f.list.splice(f.idx+1,0,it);
    this._commit(c,'studio');
    this._select(s.type,it.id,'studio');
  }
  copySel(){
    const s=this.sel;if(!s)return false;
    const f=this._findItem(s.type,s.id);if(!f)return false;
    this._clip={type:s.type,item:JSON.parse(rsJ(f.item))};
    try{localStorage.setItem('roc-studio-clip',rsJ(this._clip));}catch(_){}
    this._renderSelBar();
    return true;
  }
  _clipboard(){
    if(this._clip)return this._clip;
    try{const v=JSON.parse(localStorage.getItem('roc-studio-clip')||'null');if(v&&RS_TYPES[v.type]&&v.item)return v;}catch(_){}
    return null;
  }
  paste(){
    const clip=this._clipboard();if(!clip)return;
    const T=RS_TYPES[clip.type];
    const c=JSON.parse(rsJ(this.work));
    const list=rsListForNew(c,this.roomIdx,this.global,T.key);
    const it=JSON.parse(rsJ(clip.item));
    it.id=rsUniqueId(list,T.idp,it.id);
    if(list.some(function(x){return x&&x.top===it.top&&x.left===it.left;})){it.top=rsNudgePct(it.top,2);it.left=rsNudgePct(it.left,2);}
    list.push(it);
    this._commit(c,'studio');
    this._select(clip.type,it.id,'studio');
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
    b.innerHTML='';
    if(this._placeType){
      b.appendChild(rsEl('span',{class:'hint',text:this.t('place_hint',{t:this.t('t_'+this._placeType)})}));
      b.appendChild(rsEl('button',{class:'btn sm',type:'button',onclick:function(){self._cancelPlace();}},[this.t('cancel')]));
      return;
    }
    const s=this.sel;
    if(s&&RS_TYPES[s.type]){
      b.appendChild(rsEl('span',{class:'chip'},[rsIcon(RS_TYPES[s.type].icon),rsEl('span',{text:s.id})]));
      b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'dup',title:this.t('dup_hint'),onclick:function(){self.duplicateSel();}},[rsIcon('mdi:content-duplicate'),rsEl('span',{class:'lbl',text:this.t('dup')})]));
      b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'copy',title:this.t('copy_hint'),onclick:function(){self.copySel();}},[rsIcon('mdi:content-copy'),rsEl('span',{class:'lbl',text:this.t('copy')})]));
      b.appendChild(rsEl('button',{class:'btn sm danger',type:'button','data-act':'del',title:this.t('del_hint'),onclick:function(){self.deleteSel();}},[rsIcon('mdi:delete-outline'),rsEl('span',{class:'lbl',text:this.t('del')})]));
    }
    if(this._clipboard())b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'paste',title:this.t('paste_hint'),onclick:function(){self.paste();}},[rsIcon('mdi:content-paste'),rsEl('span',{class:'lbl',text:this.t('paste')})]));
  }

  // ---------------------------------------------------------------- state
  _rooms(){return Array.isArray(this.work&&this.work.rooms)?this.work.rooms:[];}
  _dirty(){return rsJ(this.work)!==this.base;}
  _commit(c,src){
    const j=rsJ(c),cur=rsJ(this.work);
    if(j===cur)return;
    const now=Date.now();
    // a typing burst in one field fires every 150 ms — keep it as ONE undo step
    const coalesce=src==='editor'&&this.lastSrc==='editor'&&now-this.lastCommit<800;
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
    if(this.sel&&!this._findItem(this.sel.type,this.sel.id))this.sel=null;
    const n=this._rooms().length;
    if(n&&this.roomIdx>=n)this.roomIdx=n-1;
    if(!n)this.global=false;
    if(src!=='editor'&&this._ed){
      this._ed._editRoomIdx=this.roomIdx;this._ed._editGlobal=this.global;
      this._ed._rocStudioLoad(this.I.clone(this.work));
    }
    if(src==='canvas'){if(this._card)this._card._cfgJson=null;} // card already shows it; never skip its next setConfig
    else this._pushCanvas(src!=='editor');
    this._renderChrome();
  }
  _setRoom(idx,global,from){
    const n=this._rooms().length;
    if(!n)return;
    idx=Math.max(0,Math.min(idx|0,n-1));
    const gChanged=!!global!==this.global;
    this.roomIdx=idx;this.global=!!global;
    if(from!=='editor'&&this._ed){this._ed._editRoomIdx=idx;this._ed._editGlobal=this.global;this._ed._render();}
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
        ol.appendChild(mk(String(r.name||r.id||('room '+(i+1))),r.overview?'mdi:view-dashboard-outline':'mdi:door',!self.global&&i===self.roomIdx,function(){self.sel=null;self._setRoom(i,false,'outline');self._app.classList.remove('show-outline');}));
      });
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
      box.appendChild(rsEl('button',{class:'ol-item ol-kind',type:'button',onclick:function(){self._reveal(T.panel);}},
        [rsIcon(T.icon),rsEl('span',{text:self.t('k_'+T.key)}),o.inherited?rsEl('span',{class:'tag',text:self.t('inherited')}):null,rsEl('span',{class:'n',text:String(items.length)})]));
      items.forEach(function(it){
        const cur=!!(self.sel&&self.sel.type===type&&self.sel.id===String(it.id));
        const sub=it.entity||(it.card&&it.card.entity)||it.icon||'';
        box.appendChild(rsEl('button',{class:'ol-item ol-el',type:'button','data-type':type,'data-id':String(it.id),'aria-current':String(cur),onclick:function(){self._select(type,String(it.id),'outline');}},
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
  }
  // open the editor section that holds this kind of element
  _reveal(panel){
    const ed=this._ed;if(!ed)return;
    const tab=ed.querySelector('[data-roctab="elements"]');if(tab)tab.click();
    const d=ed.querySelector('details[data-panel="'+panel+'"]');
    if(d){d.open=true;try{d.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){d.scrollIntoView();}}
    this._app.classList.add('show-insp');this._app.classList.remove('show-outline');
  }

  // ---------------------------------------------------------------- keyboard
  _onKey(e){
    const path=e.composedPath?e.composedPath():[e.target];
    const tgt=path[0]||e.target;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();
      if(this._layers.length){this._layers[this._layers.length-1]();return;}
      if(this._placeType){this._cancelPlace();return;}
      if(this.sel){this.deselect();return;}
      if(this._app.classList.contains('show-outline')||this._app.classList.contains('show-insp')){this._app.classList.remove('show-outline','show-insp');return;}
      const card=this._card;
      if(card&&card._sectionOpen&&typeof card._closeSection==='function'){card._closeSection();return;}
      this.requestClose();
      return;
    }
    const tag=(tgt&&tgt.tagName||'').toLowerCase();
    const inField=tag==='input'||tag==='textarea'||tag==='select'||!!(tgt&&tgt.isContentEditable);
    if(!inField&&!this._layers.length&&(e.key==='Delete'||e.key==='Backspace')&&this.sel&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopPropagation();this.deleteSel();return;}
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
    const k=String(e.key||'').toLowerCase();
    if(k==='s'){e.preventDefault();e.stopPropagation();this.save();return;}
    if(inField||this._layers.length)return; // native undo / copy / paste inside fields
    if(k==='d'&&this.sel){e.preventDefault();e.stopPropagation();this.duplicateSel();return;}
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
