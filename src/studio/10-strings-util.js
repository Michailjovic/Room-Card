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
  room_more_hint:'The room\'s elements are on the canvas and in the outline; the card layout (rows, columns, regions) is in All settings.',
  mark_err:'Has errors',mark_warn:'Has warnings',
  // Phase 4b (v6.45.0) — card-level forms, sub-forms and lists
  card_h:'Card',card_settings:'Card settings',nav_form:'Navigation',sections_h:'Sections',t_section:'Section',
  sec_add:'Add a section',sec_add_body:'A section is a panel that opens over the card (appliances, media, heating…). Start blank or from a recipe — the same ones as the editor\'s.',
  sec_blank:'Blank',sec_needs:'Needs its card to be installed',sec_del:'Delete this section (Undo brings it back)',
  sec_members:'In this section: {n}',sec_members_none:'Nothing yet — set an element\'s Section field (Visibility) to this id.',
  move_up:'Move up',move_down:'Move down',remove:'Remove',add_item:'Add',add_value:'Add…',
  n_options:'Options ({n})',as_yaml:'Edit as YAML',as_form:'Edit as a form',more_options:'More options…',other_keys:'Other keys (kept as they are)',
  shared_ph:'shared: {v}',inh_shared:'Uses the shared setting from Global.',inh_edit:'Edit it in Global',inh_copy:'Give this room its own copy',
  g_defaults:'Room defaults',g_image:'Image & weather',g_lights:'Light controls',g_cards:'Cards above / below',g_room_tap:'Tap on the image',
  g_room_nav:'Navigation',g_overview:'Overview page',g_card:'Card',g_panel:'Panel',g_content:'Content',g_behaviour:'Behaviour',
  g_nav_chips:'Chips',g_nav_cards:'Cards in the nav',g_nav_mini:'Mini previews',
  // Phase 4c (v6.46.0) — the new-card wizard
  stub_img:'the placeholder sketch',
  wiz_btn:'Wizard',wiz_hint:'Build the card from Home Assistant\'s areas — or add rooms for the areas it does not have yet',
  wiz_title:'New card',wiz_title_add:'Add rooms from Home Assistant',
  wiz_s_rooms:'Rooms',wiz_s_images:'Pictures',wiz_s_contents:'Contents',wiz_s_nav:'Navigation',wiz_s_review:'Review',
  wiz_back:'Back',wiz_next:'Next',wiz_create:'Create the card',wiz_add:'Add to the card',
  wiz_mode_rooms:'Several rooms',wiz_mode_single:'One room',
  wiz_rooms_body:'One room per Home Assistant area. Pick the ones this card shows — names, icons and pictures come from the areas.',
  wiz_rooms_add_body:'Areas the card does not have yet. Pick the ones to add as rooms.',
  wiz_no_areas:'Home Assistant has no areas yet — name the rooms here (or create areas in Settings → Areas, then come back).',
  wiz_single_body:'A card for one room. Pick the area it shows (its picture and devices are used).',
  wiz_all:'All',wiz_none:'None',wiz_has:'already in the card',wiz_n_dev:'{n} devices',wiz_room_n:'Room {n}',wiz_add_room:'Room without an area',
  wiz_images_body:'A photo or a floor-plan render for each room — a URL (/local/… for files in config/www), an upload, or a live camera. The area\'s own picture is already filled in.',
  wiz_images_note:'A room without a picture shows a placeholder sketch until you set one (Properties → the room).',
  wiz_upload:'Upload',wiz_upload_hint:'Upload a picture to Home Assistant (the same store as area pictures)',wiz_uploading:'Uploading…',wiz_upload_err:'Upload failed: {m}',wiz_camera_ph:'or a camera: camera.living_room',
  wiz_c_rooms:'In each room',wiz_lights:'Its lights as light controls (slider pills under the picture)',wiz_icons:'Its devices as icons, to arrange on the picture',wiz_found:'{n} found',
  wiz_c_sections:'Sections',wiz_sections_body:'Panels that open over the card. A recipe that fills itself from a kind of device is offered when Home Assistant has such devices.',
  wiz_recipe_none:'No such devices in Home Assistant',
  wiz_nav_body:'How the rooms are switched.',wiz_nav_style:'Room strip',wiz_nav_pos:'Position',
  wiz_overview:'An overview page first',wiz_overview_sub:'every room as a tile, tap to zoom in',
  wiz_presence:'Follow presence (optional)',wiz_presence_note:'A sensor whose state is the room you are in (its name or id) — the card switches to that room.',
  wiz_sum_rooms:'{n} rooms: {names}',wiz_sum_single:'One room',wiz_sum_lights:'Light controls in {n} rooms',wiz_sum_icons:'{n} icons to arrange',wiz_sum_sections:'Sections: {s}',
  wiz_sum_stub:'Rooms without a picture use the placeholder sketch for now',
  wiz_review_note:'Creating replaces the placeholder card. Undo brings it back; nothing is saved until you press Save / Apply.',
  wiz_review_note_add:'The rooms are added to this card; everything it has stays. Undo takes them out again.',
  // v6.47.0 — the floor plan page
  ok:'OK',fp_add:'Add a floor plan page',fp_add_btn:'Add a floor plan page',fp_page_name:'Floor plan',
  fp_add_norooms:'A floor plan page is one of the card\'s rooms. This card has a single room — add rooms first (the wizard creates them from your Home Assistant areas).',
  fp_tools:'Floor plan tools',fp_tool_select:'Select and move (rooms, corners, doors, windows, markers)',fp_tool_rect:'Draw a rectangular room',fp_tool_poly:'Draw a room corner by corner',fp_tool_marker:'Place a marker or a label (any entity)',fp_tool_window:'Place a window',fp_tool_door:'Place a door on a wall',
  fp_import:'Import the rooms from an AnyVac vacuum map',fp_import_l:'AnyVac',fp_trace:'Trace over a floor plan image',fp_trace_l:'Image',
  fp_doors:'Propose doors where rooms touch',fp_doors_l:'Doors',fp_delete:'Delete the selection (Del)',fp_delete_l:'',
  fp_hint_select:'Click a room to select it, drag it to move. Drag a corner; a dot in the middle of a wall adds one. Alt = no snapping.',
  fp_hint_rect:'Drag a rectangle on the plan.',fp_hint_poly:'Click the corners; click the first one (or double-click) to close the room. Esc cancels.',
  fp_hint_door:'Click a wall to place a door.',fp_hint_marker:'Click where the marker goes, then pick its entity in Properties.',fp_hint_window:'Click a wall to place a window.',
  fp_window_n:'Window {n}',
  fp_rot:'Turn the plan by 90° (for the layout profile shown: landscape or portrait)',fp_rot_l:'',fp_rot_p:'Turned for portrait',fp_rot_l2:'Turned for landscape',fp_flip:'Mirror the plan (none → horizontal → vertical → both)',fp_flip_l:'',
  fp_flip_none:'Mirror: none',fp_flip_horizontal:'Mirror: horizontal',fp_flip_vertical:'Mirror: vertical',fp_flip_both:'Mirror: both',
  fp_vacs:'Vacuums on this plan',fp_vacs_l:'Vacuums',fp_vacs_auto:'Automatic',
  fp_vacs_body:'Which AnyVac vacuums this plan shows (the robot, its trail, the badge). A vacuum mapped in another home frame is aligned to this plan by the rooms both maps share (same names in the Roborock app); the fit can be tuned in YAML (floorplan.vacuums[].transform). Automatic = every vacuum in the frame the plan was imported from.',
  fp_vac_same:'the plan\'s own frame',fp_vac_fit:'aligned by {n} rooms, ± {e} m',fp_vac_few:'cannot be aligned — fewer than 2 rooms with the same name',fp_vac_nosrc:'cannot be aligned — the plan was not imported from AnyVac',
  fp_bg:'Photo background',fp_bg_l:'Background',fp_bg_body:'An image under the plan (e.g. your render of the home). AnyVac snapshot: a picture of the vacuum map exactly in place — edit it outside (keep the canvas, or keep the PNG transparency for the markers) and use the edited file here. Fit by markers places an edited, cropped or resized snapshot by AnyVac\'s invisible markers.',
  fp_bg_snap:'AnyVac snapshot',fp_bg_fit:'Fit by markers',fp_bg_floors:'Draw the floors over it',fp_bg_working:'Working…',fp_bg_snapped:'Snapshot placed. Edit the file, then use it here.',
  fp_bg_fitted:'Placed by {n} markers.',fp_bg_bad:'AnyVac gave nothing to place the image by.',fp_bg_err:'Could not do that: {m}',t_fpwindow:'Window',fp_openings_h:'Doors and windows',
  fp_items_h:'Markers and labels',fp_marker:'Marker',fp_label:'Label',fp_marker_n:'Marker {n}',fp_label_n:'Label {n}',g_fp_shows:'Shows',fp_hint_calib:'Click two points on the image whose real distance you know.',
  fp_hint_empty:'The plan is empty — import it from AnyVac, trace an image or draw the rooms.',
  fp_door_nowall:'No wall there — click closer to a room\'s edge.',
  fp_page:'Floor plan page',fp_rooms:'Rooms on the plan',fp_doors_h:'Doors',fp_door_n:'Door {n}',fp_room_n:'Room {n}',
  fp_planonly:'plan only (no room)',fp_badlink:'⚠ {r} is not a room of this card',fp_ol_empty:'No rooms yet.',
  fp_imp_none:'No AnyVac map sensor found. AnyVac (a Home Assistant integration for Roborock vacuums) publishes the map as sensor.<vacuum>_anyvac_map — install it, or draw the plan / trace an image instead.',
  fp_imp_sensor:'Map',fp_imp_links:'Which card room is each room of the map?',fp_imp_skip:'leave out',
  fp_imp_clean:'Clean up the outlines (furniture, steps)',fp_imp_doors:'Propose doors (where the robot drove between rooms)',fp_imp_entities:'Fill in lights, heating and sensors from the rooms',
  fp_imp_reimport:'Rooms already on the plan keep their settings; only their outlines are replaced. Rooms you drew yourself stay.',
  fp_imp_info:'{n} rooms · registration: {s} · {f}',fp_imp_unaligned:'This map is not aligned to the home frame — pick a reference or aligned vacuum.',fp_imp_go:'Import',
  fp_doors_replace:'The plan has {n} doors. Replace them with {m} proposed doors? Windows stay.',fp_doors_go:'Replace',
  fp_trace_body:'An image to draw over in the studio (a floor plan picture or a scan). It is never shown on the dashboard.',
  fp_trace_upload:'Upload',fp_trace_uploading:'Uploading…',fp_trace_go:'Use this image',fp_trace_err:'The image could not be loaded.',
  fp_trace_calib:'Now click two points on the image whose distance you know.',fp_trace_calib_btn:'Set the scale',fp_trace_remove:'Remove the image',
  fp_trace_calib_t:'Scale of the image',fp_trace_calib_q:'The two points are {d} m apart on the plan now. How far apart are they really (m)?',
  g_floorplan:'Floor plan',g_fp_states:'Shows',g_fp_geom:'Geometry',g_fp_actions:'Actions',t_fproom:'Room on the plan',t_fpdoor:'Door',
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
