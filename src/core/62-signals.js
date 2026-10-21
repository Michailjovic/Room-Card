// ----- Cross-room signals (v6.48.0, OVERVIEW_PLAN.md §9, V7_PLAN.md §6.4 / Phase 6) -------------
// The "relationships across rooms" a strip of photos cannot show, computed once for the whole card
// and drawn by both the overview tiles and the floor plan:
//   presence  — who is in which room: entities whose state names a room (Bermuda's area sensors,
//               the card's own room_entity) — matched like presence follow does (roomMatch);
//   attention — section tiles collected from a room that are in their active_state (the washing
//               machine runs → a badge on the hall);
//   vacuum    — the room an AnyVac vacuum is cleaning right now (vacuum_room_name while
//               in_cleaning, V7_PLAN §7a).
// Pure functions of the config and the states; nothing here runs unless a page asks for them.
// overview.signals: true | {presence: true | entity | [entities], attention, vacuum} (opt-in).
function rocSigCfg(v){
  if(v===true)return{presence:true,attention:true,vacuum:true};
  if(!v||typeof v!=='object')return null;
  return{presence:v.presence===undefined?true:v.presence,attention:v.attention!==false,vacuum:v.vacuum!==false};
}
// Presence entities: an explicit entity / list, else the card's presence entity (fallback).
function rocSigPersons(v,fallback){
  const l=Array.isArray(v)?v:(typeof v==='string'&&v?[v]:[]);
  const ids=l.map(function(x){return x&&typeof x==='object'?x.entity:x;}).filter(function(x){return typeof x==='string'&&x;});
  if(ids.length||v===false)return ids;
  return fallback?[fallback]:[];
}
// AnyVac map sensors in Home Assistant (the contract's markers) — scanned once per render.
function rocAnyvacIds(states){
  const out=[];
  for(const id in(states||{})){
    if(id.indexOf('sensor.')!==0)continue;
    const a=states[id]&&states[id].attributes;
    if(a&&Number(a.schema_version)>=3&&a.home_frame&&Array.isArray(a.rooms))out.push(id);
  }
  return out.sort();
}
function rocSigName(st,id){
  const a=(st&&st.attributes)||{};
  return String(a.friendly_name||id||'').replace(/\s+(area|room|location|presence|poloha|místnost)$/i,'');
}
// The vacuums cleaning now: [{id, name, room (the map's room name), key (its home_room_id)}]
function rocSigVacuums(states,ids){
  const out=[];
  (ids||[]).forEach(function(id){
    const st=states&&states[id],a=st&&st.attributes;
    if(!a||!a.in_cleaning||!a.vacuum_room_name)return;
    const r=(a.rooms||[]).find(function(x){return x&&x.name===a.vacuum_room_name;});
    out.push({id:id,name:String(a.friendly_name||id).replace(/\s*AnyVac.*$/i,'').replace(/\s+map$/i,''),room:String(a.vacuum_room_name),key:r&&r.home_room_id?String(r.home_room_id):''});
  });
  return out;
}
// Per card room: {here: [{id, name}], att: n, attIcon, vac: [names]}.
// o: {persons: [ids], anyvac: [ids], sections: rocCollectSections(cAll) result, presence, attention, vacuum}
function rocRoomSignals(cAll,states,o){
  const rooms=Array.isArray(cAll&&cAll.rooms)?cAll.rooms:[];
  const out=rooms.map(function(){return{here:[],att:0,attIcon:'',vac:[]};});
  states=states||{};o=o||{};
  if(o.presence!==false)(o.persons||[]).forEach(function(id){
    const st=states[id];if(!st)return;
    const ri=roomMatch(cAll,st.state);
    if(ri>=0)out[ri].here.push({id:id,name:rocSigName(st,id)});
  });
  if(o.attention!==false)(o.sections||[]).forEach(function(sec){
    (sec.tiles||[]).forEach(function(entry){
      if(!entry.room)return;
      const ri=rooms.indexOf(entry.room);if(ri<0)return;
      const td=rocTileDef(entry);
      if(td.entity&&rocTileActive(td,states[td.entity])){out[ri].att++;if(!out[ri].attIcon)out[ri].attIcon=td.icon||'';}
    });
  });
  if(o.vacuum!==false)rocSigVacuums(states,o.anyvac).forEach(function(v){
    // a floor plan room imported from that map knows its card room exactly (anyvac_room)
    let ri=-1;
    if(v.key)rooms.some(function(r){
      const fp=r&&r.floorplan;if(!fp||typeof fp!=='object'||!Array.isArray(fp.rooms))return false;
      const pr=fp.rooms.find(function(x){return x&&String(x.anyvac_room||'')===v.key&&x.room!=null;});
      if(pr){ri=rooms.findIndex(function(x){return x&&String(x.id)===String(pr.room);});return ri>=0;}
      return false;
    });
    if(ri<0)ri=roomMatch(cAll,v.room);
    if(ri>=0)out[ri].vac.push(v.name);
  });
  return out;
}
// Entities whose state changes a signal (the card's change detection adds them).
function rocSigEntities(o,sections){
  const ids=[];
  (o.persons||[]).forEach(function(id){ids.push(id);});
  (o.anyvac||[]).forEach(function(id){ids.push(id);});
  (sections||[]).forEach(function(sec){(sec.tiles||[]).forEach(function(entry){if(entry.room){const td=rocTileDef(entry);if(td.entity)ids.push(td.entity);}});});
  return ids;
}
function rocSigAny(cAll){
  return!!(cAll&&Array.isArray(cAll.rooms)&&cAll.rooms.some(function(r){return r&&r.overview&&typeof r.overview==='object'&&rocSigCfg(r.overview.signals);}));
}
// The badges of one overview tile (who is here, active tiles, the vacuum).
function rocSigBadges(x){
  if(!x)return'';
  let h='';
  if(x.here.length)h+='<span class="roc-sig-b roc-sig-here" title="'+escA(x.here.map(function(p){return p.name;}).join(', '))+'"><ha-icon icon="mdi:account"></ha-icon>'+(x.here.length>1?x.here.length:'')+'</span>';
  if(x.att)h+='<span class="roc-sig-b roc-sig-att"><ha-icon icon="'+escA(x.attIcon||'mdi:bell-ring')+'"></ha-icon>'+(x.att>1?x.att:'')+'</span>';
  if(x.vac.length)h+='<span class="roc-sig-b roc-sig-vac" title="'+escA(x.vac.join(', '))+'"><ha-icon icon="mdi:robot-vacuum"></ha-icon></span>';
  return h;
}
const ROC_SIG_CSS='.roc-ovt.roc-ovt-here::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 2px var(--roc-sig-here,#7ee0b5),inset 0 0 16px rgba(126,224,181,.35);z-index:2;pointer-events:none;}'
  +'.roc-ovt-sig{position:absolute;right:8px;bottom:8px;z-index:3;display:flex;gap:4px;pointer-events:none;}'
  +'.roc-ovt-row .roc-ovt-sig{top:4px;right:4px;bottom:auto;}'
  +'.roc-ovt-sig:empty{display:none;}'
  +'.roc-sig-b{display:inline-flex;align-items:center;gap:2px;height:24px;min-width:24px;justify-content:center;padding:0 6px;box-sizing:border-box;border-radius:12px;background:var(--roc-chip-bg-c);color:var(--roc-text-c);font-size:11px;font-weight:700;--mdc-icon-size:15px;}'
  +'.roc-sig-att{background:var(--roc-active-c);color:#1a1206;}.roc-sig-vac{background:#03a9f4;color:#fff;}.roc-sig-here{background:#7ee0b5;color:#06281a;}';
