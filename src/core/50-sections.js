// ----- Cockpit sections: collection engine (v6.8.0) -------------------------
// Sections are user-defined buckets (COCKPIT_PLAN.md D1) filled by tagging
// existing zones/icons/elements/blinds with `section: <id>` (D2) — single
// source of truth, no parallel registry. Walks every room in room-then-
// element order and groups matches by section id, preserving the order
// `sections:` itself was declared in. Pure function of the config; the card
// caches the result per config object (see RoomOverlayCard#_getSections) so
// it never runs on a state tick, only when _render() is asked to rebuild.
const ROC_SECTION_TAG_KINDS=['zones','icons','elements','blinds'];
function rocCollectSections(cAll){
  const defs=Array.isArray(cAll&&cAll.sections)?cAll.sections:[];
  if(!defs.length)return[];
  const rooms=Array.isArray(cAll.rooms)&&cAll.rooms.length?cAll.rooms:[cAll];
  const bySec={};
  defs.forEach(function(d){if(d&&d.id&&!bySec[d.id])bySec[d.id]=[];});
  // Section-declared tiles (v6.11.0, D-ext): pure dashboard content with no
  // natural room hotspot (a TV summary, a projector-screen remote) shouldn't
  // need a throwaway room icon just to carry `section:`+`tile:` -- a section
  // can now own tiles directly via `tiles:`, same shape as a tagged element's
  // own `tile:` block. Declared first (most deliberate authoring), then
  // room-tagged collected elements, same as any other section.
  defs.forEach(function(d){
    if(d&&d.id&&Array.isArray(d.tiles)){
      d.tiles.forEach(function(t,ti){
        bySec[d.id].push({kind:'declared',item:{id:(t&&t.id)||(d.id+'_tile_'+ti),tile:t},room:null});
      });
    }
  });
  rooms.forEach(function(room){
    ROC_SECTION_TAG_KINDS.forEach(function(kind){
      (room[kind]||[]).forEach(function(item){
        if(item&&item.section&&bySec[item.section])
          bySec[item.section].push({kind:kind,item:item,room:room});
      });
    });
  });
  return defs.filter(function(d){return d&&d.id;}).map(function(d){return{def:d,tiles:bySec[d.id]||[]};});
}
// A tile's effective display fields, defaulted from the element it is
// attached to when no `tile:` block (or an incomplete one) is given (§3.2:
// "tile: is optional. Without it, the element is collected with sensible
// defaults derived from its own id, icon and entity.").
function rocTileDef(entry){
  const it=entry.item,t=(it&&it.tile)||{};
  const out=Object.assign({},t);
  if(out.name===undefined)out.name=it.id||'';
  if(out.entity===undefined)out.entity=it.entity;
  if(out.icon===undefined)out.icon=it.icon||'mdi:help-box';
  return out;
}

// Is a cockpit tile "running"? `active_state` may be one state or (v6.16.0)
// a list of them. A tile without active_state is never counted as active.
function rocTileActive(td,st){
  if(!st||td.active_state===undefined||td.active_state===null)return false;
  const a=td.active_state;
  return Array.isArray(a)?a.map(String).includes(st.state):st.state===String(a);
}
// Section activity for its launcher icon (v6.16.0): how many tiles are
// active, and the progress (0-100) of the first active tile that has a
// progress sensor — drawn as a ring around the launcher chip.
function rocSectionActivity(tiles,states){
  let count=0,progress=null;
  for(const entry of(tiles||[])){
    const td=rocTileDef(entry);
    const st=td.entity?states[td.entity]:undefined;
    if(!rocTileActive(td,st))continue;
    count++;
    if(progress===null&&td.progress){
      const pv=rocNumVal(states[td.progress]?.state);
      if(!isNaN(pv))progress=Math.max(0,Math.min(100,pv));
    }
  }
  return{count,progress};
}

// The section an icon launches (tap_action: open-section), unless the icon
// opts out with `section_status: false` (v6.16.0).
function rocIcoSection(ico){
  if(!ico||ico.section_status===false)return null;
  const a=ico.tap_action;
  return a&&a.action==='open-section'&&a.section?String(a.section):null;
}

