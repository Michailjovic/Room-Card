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
// (7.0.2: `bottom` / `right` were listed here for every element, but only an embedded card reads `bottom` and nothing reads `right`)
const POS={id:{t:'str',req:true},top:{t:'len'},left:{t:'len'},width:{t:'len'},height:{t:'len'},z_index:{t:'num'}};
// elements placed at a point and sized by `size` (7.0.4: an icon or a vacuum widget never read width / height)
const PT={id:{t:'str',req:true},top:{t:'len'},left:{t:'len'},z_index:{t:'num'}};
// 7.0.5: the animation a badge, a label and an icon share (blink / pulse; a colour makes pulse glow)
const ANIM={animation:{t:'enum:none|pulse|blink'},animation_color:{t:'color'}};
const VIS={group:{t:'str'},visible:{t:'cond|list:cond'},visible_conditions:{t:'cond|list:cond'},visible_template:{t:'tmpl'},fade:{t:'bool|str'},slide:{t:'bool|str'},nav_mini:{t:'bool'}};
// 7.0.5: an overlay shows and hides at once (its opacity follows `conditions` / `transition`) — no fade / slide
const VIS_OV=Object.assign({},VIS);delete VIS_OV.fade;delete VIS_OV.slide;
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
    heating:{t:'obj:heating',since:'7.2.0'},
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
    floorplan:{t:'bool|obj:floorplan',since:'6.47.0'},
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
  // the heating controller (7.2.0): defaults for every thermostat, and per-room settings
  heating:{keys:{quick:{t:'list:num'},step:{t:'num',d:0.5},range:{t:'list:num'},durations:{t:'list:str'},evening:{t:'str',d:'22:00'},morning:{t:'str',d:'06:00'},rooms:{t:'list:hcRoom'},
    // the house panel (7.3.0): VTherm's central mode and central boiler are found by themselves; false hides one
    central_mode:{t:'entity|bool',since:'7.3.0'},water_heater:{t:'entity|bool',since:'7.4.0'},boiler:{t:'entity|bool',since:'7.3.0'},tariff:{t:'obj:hcTariff',since:'7.3.0'},supply:{t:'list:hcSupply',since:'7.3.0'},
    // 7.5.0: the quick mode (B) and the administration (admins only: settings check, event log)
    simple:{t:'enum:never|phone|always',d:'never',since:'7.5.0'},normal:{t:'num',d:21.5,since:'7.5.0'},guard:{t:'num',d:16,since:'7.5.0'},away:{t:'bool',d:true,since:'7.5.0'},
    admin:{t:'bool',d:true,since:'7.5.0'},log:{t:'obj:hcLog',since:'7.5.0'}}},
  hcLog:{keys:{days:{t:'num',d:7},cooking:{t:'list:hcEnt'},overload:{t:'list:hcEnt'},phases:{t:'list:hcEnt'},breaker:{t:'num'},boiler_amps:{t:'num'},entities:{t:'list:hcEnt'}}},
  hcEnt:{keys:{entity:{t:'entity'}},scalar:'entity'},
  hcTariff:{keys:{entity:{t:'entity'},high_state:{t:'str',d:'on'}},scalar:'entity'},
  hcSupply:{keys:{entity:{t:'entity'},name:{t:'str'}},scalar:'entity'},
  hcRoom:{keys:{climate:{t:'entity'},name:{t:'str'},quick:{t:'list:num'},step:{t:'num'},range:{t:'list:num'},evening:{t:'str'},morning:{t:'str'},normal:{t:'num',since:'7.5.0'}},scalar:'climate'},
  baseImageCond:{keys:{condition:{t:'cond'},image:{t:'url'}}}, // 7.0.5: `value` was never read — the image is `image`
  filterCond:{keys:{condition:{t:'cond'},filter:{t:'str'}}},
  weather:{keys:{entity:{t:'entity'},effect:{t:'enum:auto|rain|snow|fog|lightning'},opacity:{t:'num'},z_index:{t:'num'},angle:{t:'num|str'}}},
  brightnessModel:{keys:{source:{t:'list:bmSource'},filter_gradient:{t:'list:bmStop'}}}, // 7.0.0-beta.2: source is a list (the card reads the first that has a value)
  bmSource:{keys:{entity:{t:'entity'},attribute:{t:'str'},min_input:{t:'num',d:0},max_input:{t:'num',d:100},condition:{t:'cond'}}},
  bmStop:{keys:{value:{t:'num'},filter:{t:'str'}}},
  companion:{keys:{card:{t:'card'},media:{t:'str'},height:{t:'len'},type:{t:'str'}},open:true},
  // ---------------------------------------------------------------- shared value objects
  cond:{keys:{entity:{t:'entity'},attribute:{t:'str'},state:{t:'any'},state_not:{t:'any'},
    operator:{t:'enum:<|>|<=|>=|==|!='},value:{t:'any'},above:{t:'num',since:'7.0.0'},below:{t:'num',since:'7.0.0'},and:{t:'cond'},or:{t:'cond'}}},
  condVal:{keys:COND_VAL},
  gradStop:{keys:{value:{t:'num'},color:{t:'color'}}},
  action:{keys:{action:{t:'enum:none|navigate|url|more-info|toggle|call-service|perform-action|browser-mod-popup|toggle-group|show-group|hide-group|switch-room|next-room|prev-room|follow-room|open-section|close-section|fire-dom-event|heating|lights'},
    entity:{t:'entity'},entity_id:{t:'entity'},navigation_path:{t:'str'},navigation_replace:{t:'bool',since:'7.0.0'},path:{t:'str'},url:{t:'str'},url_path:{t:'str'},new_tab:{t:'bool'},
    service:{t:'str'},perform_action:{t:'str'},data:{t:'map'},service_data:{t:'map'},target:{t:'map'},
    title:{t:'str'},size:{t:'str'},content:{t:'card'},room:{t:'str|num'},entities:{t:'list:str',since:'7.4.0'},name:{t:'str',since:'7.4.0'},view:{t:'enum:controller|simple|check|log',since:'7.5.0'},section:{t:'str'},group:{t:'str'},
    confirmation:{t:'bool|map'},haptic:{t:'str'},condition:{t:'cond'},then:{t:'action'},else:{t:'action'}},open:'fire-dom-event'},
  transform:{keys:{entity:{t:'entity'},attribute:{t:'str'},origin:{t:'str'},transition:{t:'str'},perspective:{t:'len'},map:{t:'map'},from:{t:'map'},to:{t:'map'},spin:{t:'obj:spin'}}},
  spin:{keys:{min_duration:{t:'num|str'},max_duration:{t:'num|str'},axis:{t:'enum:x|y|z'},reverse:{t:'bool'},min_value:{t:'num'},max_value:{t:'num'}}},
  // ---------------------------------------------------------------- elements
  overlay:{keys:Object.assign({id:{t:'str',req:true},image:{t:'url'},state_images:{t:'list:stateImage'},conditions:{t:'obj:overlayConds'},
    transition:{t:'str'},z_index:{t:'num'},animation:{t:'enum:none|pulse|blink'},color_from:{t:'entity'},transform:{t:'obj:transform',since:'6.7.0'}},VIS_OV,COCKPIT,PROF_OVR)}, // 7.0.5: `className` / `fade` / `slide` were never read
  stateImage:{keys:{entity:{t:'entity'},attribute:{t:'str'},state:{t:'any'},image:{t:'url'}}},
  overlayConds:{keys:{opacity:{t:'list:condVal'},filter:{t:'list:condVal'}}},
  zone:{keys:Object.assign({},POS,ACTS,VIS,COCKPIT,{slider:{t:'obj:slider'}},PROF_OVR)},
  slider:{keys:{entity:{t:'entity'},direction:{t:'enum:horizontal|vertical'},min:{t:'num'},max:{t:'num'},
    live:{t:'bool'},invert:{t:'bool'},color:{t:'color'}}}, // 7.0.2: action / attribute / step / service / data were never read
  badge:{keys:Object.assign({id:{t:'str',req:true},position:{t:'enum:top-left|top-right|bottom-left|bottom-right'},icon:{t:'str'},icon_color:{t:'color|list:condVal'},
    label:{t:'str|list:condVal'},label_template:{t:'tmpl'}},ANIM,ACTS,VIS,COCKPIT,PROF_OVR)},
  icon:{keys:Object.assign({},PT,{icon:{t:'str|list:condVal'},entity:{t:'entity'},size:{t:'len'},color:{t:'color|list:condVal'},background:{t:'color'},
    chip:{t:'bool'},section_status:{t:'bool',since:'6.16.0'}},ANIM,ACTS,VIS,COCKPIT,PROF_OVR)}, // 7.0.5: `attribute` was never read; the animation is drawn now
  label:{keys:Object.assign({},PT,{entity:{t:'entity'},attribute:{t:'str'},template:{t:'tmpl'},text:{t:'str'},prefix:{t:'str'},suffix:{t:'str'},unit:{t:'str'},
    decimals:{t:'num'},format:{t:'enum:raw|relative'},unavailable_text:{t:'str'},color:{t:'color|list:condVal'},color_gradient:{t:'list:gradStop'},
    background:{t:'color'},padding:{t:'str'},border_radius:{t:'len'},font_size:{t:'len'},font_weight:{t:'str|num'},font_family:{t:'str'},text_shadow:{t:'str'},
    },ANIM,ACTS,VIS,COCKPIT,PROF_OVR)}, // 7.0.2: orientation / alert_conditions are a gauge's keys, a label never read them; 7.0.5: nor width / height (a label is placed at a point)
  gauge:{keys:Object.assign({},POS,{entity:{t:'entity'},attribute:{t:'str'},min:{t:'num'},max:{t:'num'},
    orientation:{t:'enum:vertical|top|horizontal|left|right|radial'},color:{t:'color'},color_gradient:{t:'list:gradStop'},background:{t:'color'},border_radius:{t:'len'},
    arc:{t:'num'},thickness:{t:'num|len'},target:{t:'num'},target_color:{t:'color'},
    animation:{t:'enum:none|pulse|blink'},animation_color:{t:'color'},alert_conditions:{t:'cond'},transition:{t:'str'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  blind:{keys:Object.assign({},POS,{entity:{t:'entity'},attribute:{t:'str'},min:{t:'num'},max:{t:'num'},
    blind_type:{t:'enum:roller|venetian|day_night'},slat_color:{t:'color'},slat_count:{t:'num'},slat_gap:{t:'len'},slat_width:{t:'len'},gap_color:{t:'color'},
    top_offset:{t:'num',since:'5.1.0'},shift_turns:{t:'num'},shift_start:{t:'num'},shift_snap:{t:'bool'},shift_legacy:{t:'bool'},
    icon:{t:'str'}, // the tile icon when the blind is collected into a section
    // 7.0.5: label / label_template / value / animation / animation_color were never read
    control:{t:'bool|obj:coverControl'}},ACTS,VIS,COCKPIT,PROF_OVR)},
  coverControl:{keys:{placement:{t:'prof:bool|enum:off|float|dock'},display:{t:'prof:bool|enum:off|popover|float|dock',legacy:true},slider:{t:'bool'},presets:{t:'list:coverPreset'},buttons:{t:'any'},
    name:{t:'str'},top:{t:'len'},left:{t:'len'},width:{t:'len'},height:{t:'len'}}},
  coverPreset:{keys:{position:{t:'num'},icon:{t:'str'},color:{t:'color'},name:{t:'str'}}},
  element:{keys:Object.assign({},POS,{bottom:{t:'len'},card:{t:'card'},overflow:{t:'str'},border_radius:{t:'len'},background:{t:'color'}},ACTS,VIS,COCKPIT,PROF_OVR),fromEl:true},
  glow:{keys:Object.assign({},POS,{entity:{t:'entity'},size:{t:'len'},shape:{t:'enum:circle|ellipse|wash'},angle:{t:'num|str'},intensity:{t:'num'},
    falloff:{t:'enum:soft|tight|wide'},color:{t:'color'},fallback_color:{t:'color'},blend:{t:'str'},animation:{t:'enum:none|flicker|pulse'},animation_speed:{t:'str'},
    min_brightness:{t:'num'},anchor:{t:'enum:center|corner'},transition:{t:'str'}},VIS,COCKPIT,PROF_OVR)},
  group:{keys:Object.assign({id:{t:'str',req:true},grouping_code:{t:'str|num'},style:{t:'map'},visible:{t:'bool'}},PROF_OVR)},
  vacuumWidget:{keys:Object.assign({},PT,{size:{t:'len'},icon:{t:'str'},vacuums:{t:'list:vacuumRef'}},ACTS,VIS,COCKPIT,PROF_OVR)}, // 7.0.4: icon (documented, read, written by the studio) was missing
  vacuumRef:{keys:{entity:{t:'entity'},name:{t:'str'}}},
  lightControls:{keys:{entities:{t:'list:lightEntity'},style:{t:'enum:native'},columns:{t:'num'},height:{t:'prof:len'},
    lux_sensor:{t:'entity'},lux_max:{t:'num'},color_low:{t:'color'},color_high:{t:'color'},bg_off:{t:'color'}}}, // 7.0.5: top / left were never read (the strip sits in its layout region)
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
    header:{t:'obj:ovHeader'},left:{t:'obj:ovSide'},right:{t:'obj:ovSide'},grid:{t:'obj:ovGrid'},dock:{t:'obj:ovDock'},
    signals:{t:'bool|obj:ovSignals',since:'6.48.0'}}},
  ovSignals:{keys:{presence:{t:'bool|entity|list:fpEntity'},attention:{t:'bool',d:true},vacuum:{t:'bool',d:true}}},
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
  // ---------------------------------------------------------------- floor plan page (v6.47.0, V7_PLAN §6)
  floorplan:{keys:{theme:{t:'enum:night|clay|neon|blueprint|thermal|tiles|sketch',d:'night'},theme_by:{t:'obj:fpThemeBy'},projection:{t:'enum:auto|top|oblique|iso',d:'auto'},
    rotate:{t:'prof:num|enum:auto',d:'auto'},mirror:{t:'enum:none|horizontal|vertical|both',d:'none',since:'6.49.0'},quality:{t:'enum:auto|high|low',d:'auto'},wall:{t:'obj:fpWall'},temperature_range:{t:'list:num'},overrides:{t:'map'},
    transition:{t:'enum:zoom|fade|none'},transition_duration:{t:'num|str'},
    source:{t:'obj:fpSource'},trace:{t:'obj:fpTrace'},rooms:{t:'list:fpRoom'},openings:{t:'list:fpOpening'},
    presence:{t:'bool|entity|list:fpEntity',since:'6.48.0'},layers:{t:'obj:fpLayers',since:'6.48.0'},items:{t:'list:fpItem',since:'6.48.0'},
    vacuums:{t:'list:fpVacuum',since:'6.50.0'},attention_sections:{t:'list:str',since:'6.50.0'},clean_mode:{t:'enum:dry|wet|both',d:'dry',since:'6.50.0'},trail_mode:{t:'enum:always|cleaning',d:'always',since:'6.50.0'},
    background:{t:'obj:fpBackground',since:'6.50.0'},heating:{t:'obj:fpHeating',since:'7.1.0'},
    lenses:{t:'list:str',since:'7.3.0'},lens:{t:'enum:overview|lights|heating|cleaning',d:'overview',since:'7.3.0'},dock:{t:'bool|obj:ovDock',since:'7.3.0'},pause_banner:{t:'bool',d:true,since:'7.3.0'}}},
  // the floor plan page's own settings as the studio's form shows them (rooms / doors are edited on the canvas)
  fpPage:{keys:{theme:{t:'enum:night|clay|neon|blueprint|thermal|tiles|sketch',d:'night'},theme_by:{t:'obj:fpThemeBy'},projection:{t:'enum:auto|top|oblique|iso',d:'auto'},
    rotate:{t:'prof:num|enum:auto',d:'auto'},mirror:{t:'enum:none|horizontal|vertical|both',d:'none'},quality:{t:'enum:auto|high|low',d:'auto'},wall:{t:'obj:fpWall'},temperature_range:{t:'list:num'},overrides:{t:'map'},
    transition:{t:'enum:zoom|fade|none'},transition_duration:{t:'num|str'},trace:{t:'obj:fpTrace'},
    presence:{t:'bool|entity|list:fpEntity'},layers:{t:'obj:fpLayers'},attention_sections:{t:'list:str'},clean_mode:{t:'enum:dry|wet|both',d:'dry'},trail_mode:{t:'enum:always|cleaning',d:'always'},
    background:{t:'obj:fpBackground'},heating:{t:'obj:fpHeatPage'},lenses:{t:'list:str'},lens:{t:'enum:overview|lights|heating|cleaning',d:'overview'},dock:{t:'bool|obj:ovDock'},pause_banner:{t:'bool',d:true}},hide:['rooms','openings','source','items','vacuums']},
  // floor heating loops and feeds (7.1.0): pitch = pipe to pipe, margin = loop to wall (m); with a
  // manifold every loop gets its feed, which crosses a wall only at a pass
  fpHeating:{keys:{pitch:{t:'num',d:0.2},margin:{t:'num',d:0.25},flow:{t:'bool',d:true},manifold:{t:'list:num'},passes:{t:'list:fpPass'}}},
  // the same in the studio's form: the manifold and the passes are placed on the canvas
  fpHeatPage:{keys:{pitch:{t:'num',d:0.2},margin:{t:'num',d:0.25},flow:{t:'bool',d:true}},hide:['manifold','passes']},
  fpPass:{keys:{at:{t:'list:num'}}},
  // an AnyVac map on the plan; transform = its home frame → plan metres (another frame, set by the studio)
  fpVacuum:{keys:{entity:{t:'entity'},transform:{t:'obj:fpTransform'},color:{t:'color',since:'6.51.0'},mop_color:{t:'color',since:'6.51.0'},mop_opacity:{t:'num',since:'6.51.0'}},scalar:'entity'},
  fpTransform:{keys:{rotation:{t:'num'},x:{t:'num'},y:{t:'num'},rooms:{t:'num'},rms:{t:'num'},frame:{t:'str',since:'7.4.0'}}},
  // the photo background (D11): an image in plan metres
  fpBackground:{keys:{image:{t:'url'},x:{t:'num'},y:{t:'num'},scale:{t:'num'},width_px:{t:'num'},height_px:{t:'num'},rotation:{t:'num'},opacity:{t:'num'},
    floors:{t:'bool'},fiducials:{t:'list:any'},frame:{t:'str'}}},
  fpLayers:{keys:{lights:{t:'bool',d:true},heating:{t:'bool',d:true},labels:{t:'bool',d:true},presence:{t:'bool',d:true},media:{t:'bool',d:true},
    attention:{t:'bool',d:true},vacuum:{t:'bool',d:true},items:{t:'bool',d:true},openings:{t:'bool',d:true,since:'6.49.0'},cleaning:{t:'bool',d:false,since:'6.50.0'},trail:{t:'bool',d:true,since:'6.50.0'}}},
  fpEntity:{keys:{entity:{t:'entity'}},scalar:'entity'},
  // a marker (icon chip) or a text label placed on the plan (v6.48.0)
  fpItem:{keys:{type:{t:'enum:marker|label',d:'marker'},at:{t:'list:num'},entity:{t:'entity'},attribute:{t:'str'},icon:{t:'str'},name:{t:'str'},
    show_state:{t:'bool'},prefix:{t:'str'},suffix:{t:'str'},decimals:{t:'num'},active_state:{t:'any'},color:{t:'color'},size:{t:'len'},text:{t:'str'},
    tap_action:{t:'action'},hold_action:{t:'action'}}},
  fpThemeBy:{keys:{portrait:{t:'enum:night|clay|neon|blueprint|thermal|tiles|sketch'},landscape:{t:'enum:night|clay|neon|blueprint|thermal|tiles|sketch'},dark:{t:'enum:night|clay|neon|blueprint|thermal|tiles|sketch'},light:{t:'enum:night|clay|neon|blueprint|thermal|tiles|sketch'}}},
  fpWall:{keys:{height:{t:'num'}}},
  fpSource:{keys:{anyvac:{t:'entity'},frame:{t:'str'},imported:{t:'str'},origin_px:{t:'list:num'},mm_per_px:{t:'num'}}},
  fpTrace:{keys:{image:{t:'url'},x:{t:'num'},y:{t:'num'},scale:{t:'num'},width_px:{t:'num'},height_px:{t:'num'},opacity:{t:'num'}}},
  fpRoom:{keys:{room:{t:'str'},name:{t:'str'},polygon:{t:'list:any'},floor:{t:'enum:wood|vinyl|tile|carpet|concrete|none',d:'wood'},floor_color:{t:'color',since:'6.49.0'},label_at:{t:'list:num',since:'6.50.0'},anyvac_room:{t:'str'},
    lights:{t:'entity|list:fpLight'},climate:{t:'entity'},temperature:{t:'entity'},humidity:{t:'entity'},media:{t:'entity|list:fpEntity',since:'6.48.0'},
    loop:{t:'bool',d:true,since:'7.1.0'},tap_action:{t:'action'},hold_action:{t:'action'}}},
  fpLight:{keys:{entity:{t:'entity'}},scalar:'entity'},
  fpOpening:{keys:{type:{t:'enum:door|window',d:'door'},at:{t:'list:num'},width:{t:'num',d:0.8},
    entity:{t:'entity',since:'6.49.0'},cover:{t:'entity',since:'6.49.0'},blind_type:{t:'enum:roller|venetian|day_night',d:'roller',since:'6.49.0'},invert:{t:'bool',since:'6.49.0'},
    mirror:{t:'bool',since:'6.49.0'},outward:{t:'bool',since:'6.49.0'},tap_action:{t:'action',since:'6.49.0'},hold_action:{t:'action',since:'6.49.0'}}},
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
// ---- lint (7.0.2) --------------------------------------------------------------
// rocLint(config) → [{path, level: 'warn', msg}] — what the types cannot see: references that
// point at nothing, and things that are configured but have no region in any layout profile (the
// card then never shows them). Kept apart from rocValidate: such a config is valid.
function rocLint(cfg){
  const out=[];if(!isObj(cfg))return out;
  const lo=function(v){return String(v==null?'':v).trim().toLowerCase();};
  const warn=function(path,msg){out.push({path:path,level:'warn',msg:msg});};
  const rooms=Array.isArray(cfg.rooms)?cfg.rooms:[];
  const roomKeys=new Set();
  rooms.forEach(function(r){if(!isObj(r))return;[r.id,r.name].concat(Array.isArray(r.area_match)?r.area_match:(r.area_match==null?[]:[r.area_match])).forEach(function(x){if(x!=null&&x!=='')roomKeys.add(lo(x));});});
  const roomIds=new Set(rooms.filter(isObj).map(function(r){return String(r.id);})); // the grid and the plan match by id alone
  const secIds=new Set((Array.isArray(cfg.sections)?cfg.sections:[]).filter(isObj).map(function(s){return String(s.id);}));
  (function walk(o,path){
    if(Array.isArray(o)){o.forEach(function(x,i){walk(x,path+'['+i+']');});return;}
    if(!isObj(o))return;
    if(o.action==='switch-room'&&o.room!=null&&typeof o.room!=='object'&&rooms.length&&!roomKeys.has(lo(o.room)))warn(path+'.room','no room has this id or name');
    if(o.action==='open-section'&&o.section!=null&&!secIds.has(String(o.section)))warn(path+'.section','no section has this id');
    if(o.action===undefined&&typeof o.section==='string'&&o.id!==undefined&&!secIds.has(o.section))warn(path+'.section','no section has this id');
    Object.keys(o).forEach(function(k){if(k!=='card'&&k!=='content')walk(o[k],path?path+'.'+k:k);}); // not into embedded cards
  })(cfg,'');
  rooms.forEach(function(r,i){
    if(!isObj(r))return;
    const ov=isObj(r.overview)?r.overview:null,fp=isObj(r.floorplan)?r.floorplan:null,p='rooms['+i+']';
    if(ov&&isObj(ov.grid)&&Array.isArray(ov.grid.rooms))ov.grid.rooms.forEach(function(x,k){if(!roomIds.has(String(x)))warn(p+'.overview.grid.rooms['+k+']','no room has this id — it is left out of the grid');});
    if(ov&&isObj(ov.dock)&&Array.isArray(ov.dock.sections))ov.dock.sections.forEach(function(x,k){if(!secIds.has(String(x)))warn(p+'.overview.dock.sections['+k+']','no section has this id');});
    if(fp&&Array.isArray(fp.attention_sections))fp.attention_sections.forEach(function(x,k){if(!secIds.has(String(x)))warn(p+'.floorplan.attention_sections['+k+']','no section has this id');});
    if(fp&&Array.isArray(fp.rooms))fp.rooms.forEach(function(x,k){if(isObj(x)&&x.room!=null&&x.room!==''&&!roomIds.has(String(x.room)))warn(p+'.floorplan.rooms['+k+'].room','no room has this id — the plan room opens nothing');});
  });
  // 7.0.5: a blind with a float cover control — the tap reveals the controller, so the blind's own actions never run
  const floatCtl=function(ctl){
    if(ctl===true)return true;if(!isObj(ctl))return false;
    const pv=function(v){return isObj(v)?[v.portrait,v.landscape]:[v];};
    const pl=pv(ctl.placement),dp=pv(ctl.display);
    return pl.some(function(v,i){const d=dp.length>1?dp[i]:dp[0];
      if(v==='off'||v===false||d==='off'||d===false)return false;
      return v===undefined?d!=='dock':v!=='dock';});
  };
  [cfg].concat(rooms).forEach(function(h,hi){
    if(!isObj(h)||!Array.isArray(h.blinds))return;
    h.blinds.forEach(function(b,i){
      if(!isObj(b)||!b.entity||!floatCtl(b.control))return;
      const a=['tap_action','hold_action','double_tap_action'].filter(function(k){return b[k]!==undefined;});
      if(a.length)warn((hi?'rooms['+(hi-1)+'].':'')+'blinds['+i+'].'+a[0],'not used: the float cover control takes the tap on this blind (placement: dock lets the blind\'s own actions run)');
    });
  });
  // regions: a profile shows only what its `place` holds
  const L=isObj(cfg.layout)?cfg.layout:null;
  if(L){
    const holders=[cfg].concat(rooms.filter(isObj));
    const want=[];
    const pages=rooms.filter(function(r){return isObj(r)&&!r.nav_hidden;}).length;
    if(pages>1&&!(isObj(cfg.nav)&&cfg.nav.style==='none'))want.push(['nav','the room navigation']);
    if(holders.some(function(h){return isObj(h.light_controls)&&Array.isArray(h.light_controls.entities)&&h.light_controls.entities.length;}))want.push(['lights','light_controls']);
    ['cards_above','cards_below'].forEach(function(k){if(holders.some(function(h){return Array.isArray(h[k])&&h[k].length;}))want.push([k,k]);});
    const o=L.orientation;
    const profs=(o==='landscape'||o==='portrait')?[o]:['landscape','portrait'];
    // only when NO profile places it: one profile without the navigation is a design, none is a mistake
    want.forEach(function(w){
      const placed=profs.some(function(pf){const def=isObj(L[pf])?L[pf]:null;return!!(def&&isObj(def.place)&&isObj(def.place[w[0]]));});
      if(!placed)warn(profs.length===1?'layout.'+profs[0]+'.place':'layout',w[1]+' has no "'+w[0]+'" region in '+(profs.length===1?'the '+profs[0]+' profile':'any layout profile')+' — it is never shown');
    });
  }
  return out;
}
// every key name the schema knows, per type (for coverage tests and the docs generator)
function rocSchemaKeys(){const o={};for(const t in S)o[t]=Object.keys(S[t].keys);return o;}
const api={ROC_SCHEMA:S,rocValidate,rocLint,rocSchemaKeys};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else Object.assign(root,api);
})(typeof window!=='undefined'?window:globalThis);
