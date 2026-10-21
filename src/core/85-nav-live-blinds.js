// ---- Live mini-room nav (nav.live: full / custom, Phase 2) ----------------
// Builds the stripped/scoped config for ONE persistent mini <room-overlay-card>
// instance living inside a nav thumbnail. Pure function (no `this`) — smoke-
// testable directly, no jsdom needed. The caller (mount step, §6) creates the
// element, calls setConfig(result), then pins el._roomIdx = ri — the target
// room is NOT baked into the returned config itself, matching how
// _renderNeighbourPreview/_mountPreview already pin _roomIdx after setConfig
// rather than pre-selecting a room. See NAV_LIVE_FULL_PLAN.md §5.
//
// Three nav.live tiers (agreed 2026-08-05, see plan §13): '' (static image +
// filter, today's baseline) | 'composite' (existing CSS image-layer stack,
// v3.1.0) | 'full' (real live instances, EVERYTHING unconditional, no
// per-element config) | 'custom' (same mechanism as 'full' — reuses this
// entire function and the mount/scale/lifecycle machinery around it — but
// keeps only gauges/labels/icons/badges/blinds/elements that opt in via
// `nav_mini:true`, and weather only when `weather_nav_mini:true`; opt-in
// default confirmed 2026-08-05). Both 'full' and 'custom' share every strip
// rule below; 'custom' just adds one more filtering pass on top.
function rocBuildMiniConfig(cAll,ri){
  const gcfg=rocClone(cAll);
  gcfg._roc_mini=true;
  gcfg._roc_preview=true;                        // suppress Save button etc. (shared w/ editor preview)
  gcfg._roc_mini_templates=!!(cAll.nav&&cAll.nav.mini&&cAll.nav.mini.templates); // preserved separately — nav gets wiped below
  gcfg.follow_mode='manual';                      // a mini always shows its OWN room, never presence-follows
  gcfg.test_mode=false;
  gcfg.nav={style:'none'};                        // recursion guard — a mini never mounts its own nav strip
  delete gcfg.url_sync;                           // must never touch the page URL
  delete gcfg.zoom;delete gcfg.parallax;
  // Always off, in EVERY live tier (full and the future custom alike) —
  // this is page furniture around the image, not "how the room looks", so
  // it's orthogonal to the full/custom fidelity choice: cards_above/
  // cards_below/light_controls mirrors _renderNeighbourPreview's existing
  // recipe; blind control: blocks (interactive) the same idea. `elements`
  // (embedded HA cards) is intentionally NOT in this always-off list — in
  // 'full' they're part of "everything"; a specific inappropriate one (e.g.
  // a heavy custom card) is excluded via 'custom' mode instead, per-item,
  // once that's built.
  const isCustom=!!(cAll.nav&&cAll.nav.live==='custom');
  // weather_nav_mini is a scalar toggle, not a per-item array flag like the
  // others below — it can live at top-level OR be overridden per-room (same
  // ROOM_KEYS fallback pattern as weather_overlay itself), so unlike the
  // array filters (which just check each item wherever it happens to live),
  // this needs the ONE effective value for the SPECIFIC target room (ri):
  // that room's own value if it set one, else the top-level default.
  const _wxRoom=Array.isArray(gcfg.rooms)?gcfg.rooms[ri]:null;
  const _wxOptIn=!!((_wxRoom&&_wxRoom.weather_nav_mini!==undefined)?_wxRoom.weather_nav_mini:gcfg.weather_nav_mini);
  const stripAlways=function(o){
    if(!o)return;
    delete o.cards_above;delete o.cards_below;delete o.light_controls;
    if(Array.isArray(o.blinds))o.blinds.forEach(function(b){if(b)delete b.control;});
    // Per-item nav_mini filtering (v6.15.0: applies in BOTH live tiers, with
    // opposite defaults). 'custom' tier is opt-in — "show nothing except what
    // I explicitly chose" — so only nav_mini:true survives. 'full' tier is
    // opt-out — "show everything" is the whole point of 'full' — so
    // everything survives except an item explicitly marked nav_mini:false;
    // that lets one cluttering element (e.g. a room's own launcher icons)
    // be hidden from its OWN room's live mini without giving up 'full' for
    // every other element/room.
    ['gauges','labels','icons','badges','blinds','elements'].forEach(function(k){
      if(Array.isArray(o[k]))o[k]=o[k].filter(function(it){
        return it&&(isCustom?it.nav_mini===true:it.nav_mini!==false);
      });
    });
    if(isCustom&&!_wxOptIn)delete o.weather_overlay;
  };
  stripAlways(gcfg);
  if(Array.isArray(gcfg.rooms))gcfg.rooms.forEach(stripAlways);
  // camera_refresh — clamp >= 30s for a persistent mini (room-scoped key;
  // resolved the same way _startCamera already falls back top-level -> 10).
  const _room=Array.isArray(gcfg.rooms)?gcfg.rooms[ri]:null;
  if(_room&&_room.base_camera)_room.camera_refresh=Math.max(30,Number(_room.camera_refresh??gcfg.camera_refresh??10)||10);
  return gcfg;
}

// Roleta top-offset calibration: many motors keep a deliberate safety margin
// at their own fully-OPEN limit (never meant to be recalibrated away), so the
// blind never actually retracts all the way — a sliver of material always
// stays visible. The fully-CLOSED limit, by contrast, is normally accurate.
// top_offset (%) is the real/visual coverage that corresponds to fully open;
// fully closed always stays 100 (never corrected). Applied to the gauge's
// already min/max-normalized 0–100 fill % (0=open,1=closed — see caller),
// NOT the raw entity value, so this works regardless of which raw direction
// (min/max) the blind's own motor reports. Linear remap between those two
// known points. Applied ONLY to the visual overlay (blindToGaugeConfig/gauge
// fill) — the cover-control widget intentionally keeps showing/sending raw
// motor % (see ROADMAP.md 🅿️ day_night blind model — top_offset does NOT
// control that gauge type's striped-background phase; see the parked note).
function rocApplyTopOffset(pct100,offset){
  const o=Math.max(0,Math.min(95,Number(offset)||0));
  if(!o)return pct100;
  return o+pct100*(100-o)/100;
}

// day_night phase engine. The striped look comes from TWO identical gradient
// layers: one pinned at background-position 0 (the "back" fabric), one scrolled
// by this function's result (the "front" fabric). What makes the blind read as
// see-through (layers aligned) or blackout (layers half a period apart) is their
// RELATIVE offset, and on a real zebra blind that offset changes continuously as
// the fabric travels — the fabric is one continuous loop running over the tube,
// so raising/lowering re-aligns the sheer and solid bands against each other.
//
//   raw    0..1 position BEFORE top_offset (0 = fully open, 1 = fully closed).
//          Deliberately NOT the top_offset-corrected pct: an un-retracted reserve
//          changes how much of the window is COVERED, not where the fabric's own
//          printed pattern sits, so driving the phase from pct shifts the entire
//          phase curve sideways by the reserve (the pre-6.1.0 bug).
//   start  phase in periods at fully open (0 = layers aligned / see-through).
//   turns  how many times the overlap sweeps aligned -> blackout -> aligned across
//          the full travel. NOT derivable from slat_count — it depends on tube
//          diameter, fabric thickness and band pitch, so it has to be measured.
//          Defaults to slat_count/2, which is what v6.0.0 and earlier hard-coded.
//   snap   nudge `turns` so fully closed lands exactly on anti-phase (full
//          blackout). Replaces the old `pct>=1` special case, which forced that
//          same anti-phase but as a visible jump inside the last percent.
// Returns the offset in PERIODS; the caller multiplies by the period in px.
function rocDayNightShift(raw,start,turns,snap){
  const r=Math.max(0,Math.min(1,Number(raw)||0));
  const a=Number(start)||0;
  let b=Number(turns);
  if(!isFinite(b))b=0;
  if(snap){b=Math.round(a+b-0.5)+0.5-a;while(b<0)b+=1;}
  return a+b*r;
}

function blindToGaugeConfig(b){
  const type=b.blind_type||'roller';
  const sw=b.slat_width??7,sg=b.slat_gap??sw;
  const sc=b.slat_color||'rgba(0,0,0,0.9)';
  const z=b.z_index??6;
  const base={id:'__bl_'+b.id,entity:b.entity,min:b.min??0,max:b.max??100,
    top:b.top,left:b.left,width:b.width,height:b.height,z_index:z,
    orientation:'top',background:b.background||'transparent',border_radius:b.border_radius||'0'};
  if(b.attribute!==undefined)base.attribute=b.attribute;
  if(b.top_offset!==undefined)base.top_offset=b.top_offset;
  if(b.transition!==undefined)base.transition=b.transition;
  if(b.visible!==undefined)base.visible=b.visible;
  if(b.visible_conditions!==undefined)base.visible_conditions=b.visible_conditions;
  if(b.visible_template!==undefined)base.visible_template=b.visible_template;
  if(type==='roller'){
    return[Object.assign({},base,{color:sc})];
  }else if(type==='day_night'){
    const scount=b.slat_count??6;
    const dn=Object.assign({},base,{_dayNight:true,background:'transparent',_slat_count:scount,_slat_color:sc});
    // Phase calibration (see rocDayNightShift) — day_night only.
    if(b.shift_start!==undefined)dn.shift_start=b.shift_start;
    if(b.shift_turns!==undefined)dn.shift_turns=b.shift_turns;
    if(b.shift_snap!==undefined)dn.shift_snap=b.shift_snap;
    if(b.shift_legacy!==undefined)dn.shift_legacy=b.shift_legacy;
    return[dn];
  }else if(type==='venetian'){
    const gc=b.gap_color||'rgba(180,160,140,0.35)';
    const grad='repeating-linear-gradient(to bottom,'+sc+' 0px,'+sc+' '+sw+'px,'+gc+' '+sw+'px,'+gc+' '+(sw+sg)+'px)';
    return[Object.assign({},base,{color:grad})];
  }
  return[Object.assign({},base,{color:sc})];
}
