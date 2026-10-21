// ----- Overview page (v6.30.0, OVERVIEW_PLAN.md) ------------------------------
// One room in `rooms:` can be an overview page: every other room as a tile
// (its live mini or composite thumbnail, name, info chips and state chips),
// plus optional header / left / right regions of embedded cards and pills and
// a dock of section launchers. Nothing here runs for a config without an
// `overview:` room (OVERVIEW_PLAN.md 1a.1). Pure helpers first; the card wires
// them in _render()/_update()/_switchRoom().
function rocOvCfg(cAll,idx){
  const r=cAll&&Array.isArray(cAll.rooms)?cAll.rooms[idx]:null;
  if(!r||!r.overview)return null;
  return typeof r.overview==='object'?r.overview:{};
}
function rocOvAny(cAll){
  return!!(cAll&&Array.isArray(cAll.rooms)&&cAll.rooms.some(function(r){return r&&r.overview;}));
}
// {portrait, landscape} or a plain value; a profile left out falls back to def.
function rocOvPV(v,prof,def){
  if(v!=null&&typeof v==='object'&&!Array.isArray(v))return v[prof]!==undefined&&v[prof]!==null&&v[prof]!==''?v[prof]:def;
  return v===undefined||v===null||v===''?def:v;
}
// Room indices shown in the grid: `grid.rooms` (ids, in that order) or every
// room in config order. Overview and floor plan pages and overview_tile.hidden are never tiles.
function rocOvRooms(cAll,ov){
  const rooms=(cAll&&cAll.rooms)||[];
  const ok=function(i){const r=rooms[i];return!!r&&!r.overview&&!r.floorplan&&!(r.overview_tile&&r.overview_tile.hidden===true);};
  const g=(ov&&ov.grid)||{};
  const out=[];
  if(Array.isArray(g.rooms)){
    g.rooms.forEach(function(id){
      let i=-1;for(let k=0;k<rooms.length;k++)if(rooms[k]&&String(rooms[k].id)===String(id)){i=k;break;}
      if(i>=0&&ok(i)&&out.indexOf(i)<0)out.push(i);
    });
    return out;
  }
  for(let i=0;i<rooms.length;i++)if(ok(i))out.push(i);
  return out;
}
// "40% 60%" → {x:0.4,y:0.6}; anything unparsable → centre.
function rocOvFocus(f){
  const p=String(f==null?'':f).trim().split(/\s+/);
  const n=function(s){const v=parseFloat(s);return isNaN(v)?0.5:Math.max(0,Math.min(1,v/100));};
  return{x:p[0]?n(p[0]):0.5,y:p[1]?n(p[1]):(p[0]?n(p[0]):0.5)};
}
function rocOvMs(v,def){
  if(v===undefined||v===null||v==='')return def;
  const s=String(v).trim(),n=parseFloat(s);
  if(isNaN(n))return def;
  return Math.max(0,/ms$/i.test(s)||!/s$/i.test(s)?n:n*1000);
}
// Grid tile mode: the overview's own `grid.live`, else the nav's. A row tile's
// thumbnail is ~72-96 px wide, so a full live mini buys nothing there — it
// takes `composite` unless the grid asks for more (OVERVIEW_PLAN.md §4).
function rocOvLive(cAll,ov,style){
  const g=(ov&&ov.grid)||{},nl=(cAll&&cAll.nav&&cAll.nav.live)||'';
  const gl=g.live;
  if(gl&&gl!=='inherit')return gl==='off'?'':gl;
  if(style==='row')return(nl==='full'||nl==='custom'||nl==='composite')?'composite':nl;
  return nl;
}
const ROC_OV_TOGGLE=['light','switch','fan','input_boolean','cover','siren','humidifier'];
const ROC_OV_OFF=['off','closed','idle','standby','unavailable','unknown','docked','paused','none',''];
function rocOvChipActive(ch,states){
  const ents=ch.entities||[];
  for(const id of ents){
    const st=states&&states[id];if(!st)continue;
    if(ch.active_state!==undefined&&ch.active_state!==null){
      const a=ch.active_state;
      if(Array.isArray(a)?a.map(String).includes(st.state):st.state===String(a))return true;
    }else if(ROC_OV_OFF.indexOf(String(st.state))<0)return true;
  }
  return false;
}
// Every media_player.* id mentioned anywhere in a room's config.
function rocOvMediaIds(o,out){
  out=out||[];
  if(typeof o==='string'){if(/^media_player\.[a-z0-9_]+$/.test(o)&&out.indexOf(o)<0)out.push(o);}
  else if(Array.isArray(o))o.forEach(function(x){rocOvMediaIds(x,out);});
  else if(o&&typeof o==='object')for(const k in o)rocOvMediaIds(o[k],out);
  return out;
}
function rocOvChipDefaultTap(id){
  const dom=String(id).split('.')[0];
  return ROC_OV_TOGGLE.indexOf(dom)>=0?{action:'toggle',entity:id}:{action:'more-info',entity:id};
}
// State chips of one room tile. `overview_tile.chips`: omitted / 'auto' →
// derived (lights of light_controls as ONE chip, blinds with a cover control,
// media players); a list → exactly those; 'none' → no chips. Capped by `max`.
function rocOvChips(cAll,ri,max){
  const r=(cAll.rooms||[])[ri];if(!r)return[];
  const t=r.overview_tile||{};
  const mode=t.chips===undefined||t.chips===null||t.chips==='auto'?'auto':(Array.isArray(t.chips)?'custom':'none');
  const out=[];
  if(mode==='custom'){
    t.chips.forEach(function(ch,k){
      if(!ch)return;
      const id=typeof ch==='string'?ch:ch.entity;
      const o=typeof ch==='string'?{}:ch;
      if(!id&&!o.tap_action)return;
      out.push({key:'c'+k,entities:id?[id]:[],icon:o.icon||'',name:o.name||'',
        tap_action:o.tap_action!==undefined?o.tap_action:(id?rocOvChipDefaultTap(id):null),
        hold_action:o.hold_action!==undefined?o.hold_action:(id?{action:'more-info',entity:id}:null),
        active_state:o.active_state});
    });
  }else if(mode==='auto'){
    const m=roomMerge(cAll,ri);
    const lights=lcNormEnts(m.light_controls).map(function(e){return e.entity;}).filter(function(id){return/^(light|switch)\./.test(id);});
    if(lights.length){
      // One chip for the room's lights: any on → all off, else all on.
      let cond=null;
      for(let k=lights.length-1;k>=0;k--){const c0={entity:lights[k],state:'on'};if(cond)c0.or=cond;cond=c0;}
      out.push({key:'lights',entities:lights,icon:'mdi:lightbulb',kind:'lights',
        tap_action:{condition:cond,
          then:{action:'perform-action',perform_action:'homeassistant.turn_off',target:{entity_id:lights}},
          else:{action:'perform-action',perform_action:'homeassistant.turn_on',target:{entity_id:lights}}},
        hold_action:{action:'more-info',entity:lights[0]}});
    }
    (m.blinds||[]).forEach(function(b){
      if(!b||!b.control||!b.entity||!/^cover\./.test(b.entity))return;
      if(out.some(function(o){return o.entities.indexOf(b.entity)>=0;}))return;
      out.push({key:'bl:'+b.entity,entities:[b.entity],icon:'mdi:window-shutter',
        tap_action:{action:'toggle',entity:b.entity},hold_action:{action:'more-info',entity:b.entity}});
    });
    rocOvMediaIds(r).forEach(function(id){
      if(out.some(function(o){return o.entities.indexOf(id)>=0;}))return;
      out.push({key:'mp:'+id,entities:[id],icon:'mdi:cast',
        tap_action:{action:'more-info',entity:id},hold_action:{action:'more-info',entity:id}});
    });
  }
  const n=Math.max(0,parseInt(max,10));
  return isNaN(n)?out:out.slice(0,n);
}
function rocOvChipIcon(ch,hass){
  if(ch.icon)return ch.icon;
  const id=ch.entities&&ch.entities[0];
  const st=id&&hass&&hass.states?hass.states[id]:null;
  if(st&&st.attributes&&st.attributes.icon)return st.attributes.icon;
  const dom=id?String(id).split('.')[0]:'';
  return(ROC_DOMAIN_ICON&&ROC_DOMAIN_ICON[dom])||'mdi:toggle-switch';
}
// Header items: {pill:{…}} | {nav_cards:true} | {card:{…}} | a plain card config.
function rocOvHdKind(it){
  if(!it||typeof it!=='object')return'';
  if(it.pill)return'pill';
  if(it.nav_cards)return'nav_cards';
  if(it.card||it.type)return'card';
  return'';
}
// Image-decode gate for the zoom: resolves when the photo is decoded or after
// `ms`, whichever is first — never blocks the switch on a slow/broken image.
function rocOvDecode(url,ms){
  return new Promise(function(res){
    let done=false;const fin=function(){if(!done){done=true;res();}};
    setTimeout(fin,ms);
    if(!url){fin();return;}
    try{
      const im=new Image();im.src=url;
      if(im.decode)im.decode().then(fin,fin);else{im.onload=fin;im.onerror=fin;}
    }catch(_){fin();}
  });
}
// Overview CSS — injected only when the config has an overview room, so a
// config without one renders byte-for-byte as before (OVERVIEW_PLAN.md 1a.1).
const ROC_OV_CSS='.roc-ov{position:absolute;inset:0;display:grid;gap:var(--roc-ov-gap,12px);padding:var(--roc-ov-pad,12px);box-sizing:border-box;color:var(--roc-text-c);z-index:1;min-height:0;}.roc-ov-hd{grid-area:hd;display:flex;align-items:center;gap:8px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;}.roc-ov-hd::-webkit-scrollbar,.roc-ov-side::-webkit-scrollbar,.roc-ov-grid::-webkit-scrollbar{display:none;}.roc-ov-hdi{flex:0 0 auto;min-width:0;overflow:hidden;border-radius:10px;}.roc-ov-hdi.roc-ov-grow{flex:1 1 0;}.roc-ov-side{display:flex;flex-direction:column;gap:var(--roc-ov-gap,12px);min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;}.roc-ov-side>div{flex:none;border-radius:12px;overflow:hidden;}.roc-ov-grid{grid-area:gr;display:grid;grid-template-columns:repeat(var(--roc-ov-cols,3),minmax(0,1fr));gap:var(--roc-ov-gap,12px);min-height:0;min-width:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;align-content:start;}.roc-ov-grid:not(.roc-ov-fill){grid-auto-rows:max-content;}.roc-ov-grid.roc-ov-fill{grid-auto-rows:minmax(var(--roc-ov-minh,110px),1fr);align-content:stretch;}.roc-ov-empty{grid-column:1/-1;padding:24px;text-align:center;color:var(--roc-text-2-c);font-size:13px;}.roc-ovt{position:relative;border-radius:14px;overflow:hidden;cursor:pointer;background:var(--roc-surface-c);border:1px solid var(--roc-border-c);box-sizing:border-box;min-width:0;-webkit-tap-highlight-color:transparent;outline:none;}.roc-ovt:focus-visible{box-shadow:0 0 0 2px var(--primary-color,#03a9f4);}.roc-ov-grid:not(.roc-ov-fill) .roc-ovt-card{aspect-ratio:var(--roc-ov-aspect,4/3);}.roc-ovt-ph{position:absolute;inset:0;background-size:cover;background-position:var(--roc-ov-focus,50% 50%);overflow:hidden;border-radius:inherit;}.roc-ovt-mini{position:absolute;inset:0;overflow:hidden;pointer-events:none;}.roc-ovt-top{position:absolute;top:8px;left:8px;right:8px;z-index:2;display:flex;align-items:flex-start;justify-content:space-between;gap:6px;pointer-events:none;min-width:0;}.roc-ovt-name{font-size:13px;font-weight:600;line-height:1.35;padding:2px 8px;border-radius:6px;background:var(--roc-chip-bg-c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}.roc-ovt-info{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px;font-size:11px;font-weight:600;line-height:1.35;font-variant-numeric:tabular-nums;flex:none;}.roc-ovt-info:empty{display:none;}.roc-ovt-chips{position:absolute;left:8px;bottom:8px;z-index:2;display:flex;gap:6px;}.roc-ovc{position:relative;width:var(--roc-ovc,40px);height:var(--roc-ovc,40px);flex:none;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(25,25,28,.62);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);color:var(--roc-text-c);display:flex;align-items:center;justify-content:center;padding:0;margin:0;cursor:pointer;--mdc-icon-size:20px;-webkit-tap-highlight-color:transparent;box-sizing:border-box;transition:background .2s ease,color .2s ease;}.roc-ovc>ha-icon{pointer-events:none;}.roc-ovc.on{background:var(--roc-active-c);color:#1a1206;border-color:transparent;}.roc-ovc.na{opacity:.45;}.roc-ov-pm .roc-ovc{--roc-ovc:44px;}.roc-ov-pm .roc-ov-hd{flex-wrap:wrap;overflow:visible;}.roc-ov-pm .roc-ov-hdi.roc-ov-grow{flex:1 1 100%;}.roc-ovt-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px;}.roc-ovt-row .roc-ovt-ph{position:relative;inset:auto;width:var(--roc-ov-thumbw,88px);aspect-ratio:16/9;border-radius:8px;}.roc-ovt-row .roc-ovt-top{position:static;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;}.roc-ovt-row .roc-ovt-name{background:none;padding:0;font-size:14px;max-width:100%;}.roc-ovt-row .roc-ovt-info{justify-content:flex-start;}.roc-ovt-row .roc-ovt-chips{position:static;}.roc-ov-dock{grid-area:dk;display:flex;justify-content:center;align-items:center;gap:var(--roc-ov-dgap,14px);flex-wrap:wrap;padding:2px 0;}.roc-ov-dock .ico{position:relative!important;}.roc-ovp{display:inline-flex;align-items:center;gap:6px;height:var(--roc-ovp-h,32px);padding:0 12px;border-radius:16px;background:var(--roc-chip-bg-c);border:1px solid var(--roc-border-c);color:var(--roc-text-c);font-size:13px;font-weight:600;white-space:nowrap;font-variant-numeric:tabular-nums;--mdc-icon-size:18px;box-sizing:border-box;}.roc-ovp[data-tap]{cursor:pointer;}.roc-ov-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--roc-text-2-c);--mdc-icon-size:64px;}.roc-thumb-ov{display:flex;align-items:center;justify-content:center;color:var(--roc-text-c);--mdc-icon-size:22px;background-color:var(--roc-surface-c);}';

// Auto tiles (v6.10.0, COCKPIT_PLAN.md kap.3.1/4) -- a section's `source: auto`
// + `domain:` derives extra tiles straight from `hass.states` instead of a
// tagged element, for domains listed in the schema comment. Default icon per
// domain (a tagged element's own `tile.icon`/`icon` always wins -- this only
// covers the auto-derived, unTagged case). Pure given (def, hass, exclude);
// the card calls it once per _render() (never per state tick, kap.4) and
// caches the merged list on this._secResolvedTiles -- see _render().
const ROC_DOMAIN_ICON={climate:'mdi:thermostat',cover:'mdi:window-shutter',media_player:'mdi:cast',vacuum:'mdi:robot-vacuum',fan:'mdi:fan',light:'mdi:lightbulb',switch:'mdi:toggle-switch'};
function rocAutoTiles(def,hass,exclude){
  if(!hass||!hass.states||!def||!def.domain)return[];
  const s=hass.states,pre=def.domain+'.',out=[];
  for(const eid in s){
    if(eid.indexOf(pre)!==0)continue;
    if(exclude&&exclude.has(eid))continue;
    const name=(s[eid].attributes&&s[eid].attributes.friendly_name)||eid;
    out.push({_name:name,kind:'auto',item:{id:eid,entity:eid,icon:ROC_DOMAIN_ICON[def.domain]||'mdi:help-box',tile:{name:name}},room:null});
  }
  out.sort(function(a,b){return a._name.localeCompare(b._name);});
  out.forEach(function(o){delete o._name;});
  return out;
}

