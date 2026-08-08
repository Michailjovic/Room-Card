/**
 * room-overlay-card v4.0.0 — MIT License
 * https://github.com/Michailjovic/Room-Card
 */
const ROC_VERSION='5.9.11';
console.info('%c ROOM-OVERLAY-CARD %c v'+ROC_VERSION+' ','background:#3a7d5a;color:#fff;font-weight:bold;border-radius:4px 0 0 4px;padding:2px 0;','background:#222;color:#aef;border-radius:0 4px 4px 0;padding:2px 0;');
window.customCards=window.customCards||[];
window.customCards.push({type:'room-overlay-card',name:'Room Overlay Card',description:'Room visualization with image layers, transitions and clickable zones (v'+ROC_VERSION+')',preview:true,documentationURL:'https://github.com/Michailjovic/Room-Card',
  getEntitySuggestion:function(hass,entityId){
    // HA 2026.6+: suggest this card when the user picks a camera entity
    if(entityId.split('.')[0]!=='camera')return null;
    return{config:{type:'custom:room-overlay-card',base_camera:entityId,aspect_ratio:'16/9'}};
  }});

function escA(s){return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');}
// Escape a value for use inside a CSS attribute selector [data-x="..."]
function escSel(s){return(typeof CSS!=='undefined'&&CSS.escape)?CSS.escape(String(s)):String(s).replace(/["\\\]]/g,'\\$&');}
// Escape single quotes for CSS url('...') contexts
function escUrl(s){return String(s??'').replace(/'/g,'%27');}
// Parse an aspect ratio: number, numeric string, or "W/H" → ratio (w/h) or null
function rocRatio(r){
  if(r==null||r==='')return null;
  if(typeof r==='number')return r>0?r:null;
  const p=String(r).trim().split('/');
  if(p.length===2){const w=parseFloat(p[0]),h=parseFloat(p[1]);return(w>0&&h>0)?w/h:null;}
  const n=parseFloat(p[0]);return n>0?n:null;
}
// Deep clone — native structuredClone with JSON fallback for old webviews
const rocClone=typeof structuredClone==='function'?structuredClone:function(o){return JSON.parse(JSON.stringify(o));};
function setSt(el,prop,val){if(el&&el.style[prop]!==val)el.style[prop]=val;}
// lock_aspect: size a fixed-design-aspect stage to COVER the (per-tier) box,
// centered. Elements live on this stage → glued to the image, identical across
// tiers; the per-tier aspect_ratio only changes how much is cropped.
function coverStage(boxW,boxH,da){
  if(!(da>0)||!(boxW>0)||!(boxH>0))return null;
  let w,h;
  if(boxW/boxH>=da){w=boxW;h=boxW/da;}else{h=boxH;w=boxH*da;}
  return{w:w,h:h,left:(boxW-w)/2,top:(boxH-h)/2};
}
// Truthiness for template visibility results (render_template returns native types)
function tmplTruthy(v){
  if(v===true)return true;
  if(v===false||v===null||v===undefined)return false;
  const s=String(v).trim().toLowerCase();
  return!(s===''||s==='false'||s==='off'||s==='no'||s==='0'||s==='none'||s==='unknown'||s==='unavailable');
}
// Localized relative time ("5 minutes ago") for label format: relative
function relTime(ts,lang){
  const d=new Date(ts);
  if(isNaN(d.getTime()))return String(ts??'');
  let s=Math.round((d.getTime()-Date.now())/1000);
  const a=Math.abs(s);
  let v,u;
  if(a<60){v=s;u='second';}
  else if(a<3600){v=Math.trunc(s/60);u='minute';}
  else if(a<86400){v=Math.trunc(s/3600);u='hour';}
  else{v=Math.trunc(s/86400);u='day';}
  try{return new Intl.RelativeTimeFormat(lang||'en',{numeric:'auto'}).format(v,u);}
  catch(_){return(s<0?'-':'+')+Math.abs(v)+' '+u;}
}
// ---- Layout profiles (v4) ----------------------------------------------------
// Two profiles chosen by the SHAPE of the available viewport (w/h ratio), not by
// device type: ratio < threshold → portrait, else landscape. See LAYOUT.md.
const ROC_PROFILES=['portrait','landscape'];
const ROC_LEGACY_TIERS=['mobile','tablet','desktop','ultrawide'];
// Regions a layout profile can place on its % grid
const ROC_REGIONS=['nav','cards_above','image','lights','cards_below','cover'];
function rocBrowserId(){try{return window.browser_mod?.browserID||window.browser_mod?.browser_id||'';}catch(_){return'';}}
// Active profile: layout.orientation force ('portrait'|'landscape'), per-device
// map {by_browser:{<browser_mod id>:profile},default:...}, or 'auto' by ratio.
function rocProfile(cfg,w,h){
  const l=(cfg&&cfg.layout)||{};
  let o=l.orientation||'auto';
  if(o&&typeof o==='object'){
    const bb=o.by_browser||{};
    o=bb[rocBrowserId()]||o.default||'auto';
  }
  if(o==='portrait'||o==='landscape')return o;
  const th=(typeof l.threshold==='number'&&l.threshold>0)?l.threshold:1.0;
  if(!(w>0)||!(h>0))return'landscape';
  return(w/h<th)?'portrait':'landscape';
}
// Merge a per-item profile override block over the base item.
// Legacy v3 blocks still merge: mobile→portrait, desktop/ultrawide/tablet→landscape.
function tApply(it,profile){
  if(!it||!profile)return it;
  const o=it[profile]||(profile==='portrait'?it.mobile:(it.desktop||it.ultrawide||it.tablet))||null;
  return o?Object.assign({},it,o):it;
}
// Resolve a scalar that may be a per-profile object {portrait,landscape}.
// Legacy v3 per-tier objects resolve too (mobile→portrait, desktop→landscape).
function tVal(val,profile){
  if(val==null||typeof val!=='object'||Array.isArray(val))return val;
  const want=profile||'landscape';
  if(val[want]!=null)return val[want];
  const legacy=want==='portrait'?['mobile','tablet']:['desktop','ultrawide','tablet'];
  for(const k of legacy)if(val[k]!=null)return val[k];
  const other=want==='portrait'?'landscape':'portrait';
  if(val[other]!=null)return val[other];
  for(const k of ROC_LEGACY_TIERS)if(val[k]!=null)return val[k];
  return undefined;
}
// A grid track: number → '%', string passes through ('12%', '1fr', 'auto').
function rocTrack(v){return typeof v==='number'?v+'%':String(v);}
// grid-row / grid-column value: 3 → '3', '1/6' passes through.
function rocLine(v){return v==null?'auto':String(v);}
// Grid-row span helpers — shared by the layout fit, intrinsic-row detection
// and anything else that reasons about row placement ('3' → 3..4, '3/6' → 3..6).
function rocRowStart(v){return parseInt(String(v==null?1:v).split('/')[0],10)||1;}
function rocRowEnd(v){const p=String(v==null?1:v).split('/');return p.length>1?(parseInt(p[1],10)||1):rocRowStart(v)+1;}
// Layout definition for the given profile (null when not configured).
function rocProfileDef(cfg,profile){
  const l=(cfg&&cfg.layout)||{};
  return l[profile]||null;
}
// Grid container CSS for one profile definition.
function rocGridCss(lp,gap){
  const cols=(Array.isArray(lp.columns)&&lp.columns.length?lp.columns:['100%']).map(rocTrack).join(' ');
  const rows=(Array.isArray(lp.rows)&&lp.rows.length?lp.rows:['100%']).map(rocTrack).join(' ');
  return'display:grid;width:100%;height:100%;align-content:start;grid-template-columns:'+cols+';grid-template-rows:'+rows+';'+(gap?'gap:'+gap+';':'')+'box-sizing:border-box;';
}
// Region wrapper style from its placement entry {row,col,overflow,align}.
function rocRegionCss(pl){
  const ov=(pl&&pl.overflow==='auto')?'auto':'hidden';
  let st='grid-row:'+rocLine(pl&&pl.row)+';grid-column:'+rocLine(pl&&(pl.col!=null?pl.col:1))+';overflow:'+ov+';position:relative;min-width:0;min-height:0;';
  if(pl&&pl.align&&pl.align!=='stretch')st+='align-self:'+pl.align+';';
  return st;
}
// Editor-only: illustrative mini preview of a layout profile's grid — NOT used
// by the real card render path. Reuses rocGridCss/rocRegionCss so the little
// diagram always matches the actual CSS Grid semantics (grid-line row/col
// syntax etc.), just at editor-form scale, purely as a visual aid while typing.
const ROC_LY_REGIONS=[['nav','Nav','#4f8cff'],['cards_above','Cards ↑','#8a6dff'],['image','Image','#2ecc71'],['lights','Lights','#f5a623'],['cards_below','Cards ↓','#e17055'],['cover','Cover','#00b8d9']];
function rocLyPreviewHtml(lp){
  lp=lp||{};
  const gridCss=rocGridCss(lp,lp.gap);
  let inner='';
  ROC_LY_REGIONS.forEach(function(r){
    const rg=r[0],label=r[1],color=r[2];
    const pl=lp.place&&lp.place[rg];
    if(!pl)return;
    inner+='<div style="'+rocRegionCss(pl)+'background:'+color+'2b;border:1px solid '+color+';border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:'+color+';min-height:12px;overflow:hidden;padding:1px;text-align:center;line-height:1.1;">'+label+'</div>';
  });
  if(!inner)inner='<div style="grid-column:1;grid-row:1;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--secondary-text-color);">No regions placed yet</div>';
  return '<div style="'+gridCss+'height:100%;">'+inner+'</div>';
}
// True when the image region sits on an 'auto' row — the image box then sizes
// itself from the design aspect (CSS aspect-ratio on .wrap): exact fit, no crop,
// no letterbox, and rows above/below pack tightly around it.
function rocImgAutoRow(lp){
  const pl=lp&&lp.place&&lp.place.image;
  if(!pl)return false;
  const rows=Array.isArray(lp.rows)&&lp.rows.length?lp.rows:['100%'];
  return rows[rocRowStart(pl.row)-1]==='auto';
}
// Dock orientation for the cover region — derived from the grid DEFINITION,
// not from measuring the box ('auto' tracks size to content, so measuring is
// circular: a vertical rail makes the row tall → looks vertical forever).
// Horizontal when the region sits in ONE row across the FULL grid width
// (top/bottom bar); vertical otherwise (side column, row span).
// place.cover.direction: horizontal|vertical overrides.
function rocCoverHoriz(lp){
  const pl=lp&&lp.place&&lp.place.cover;
  if(!pl)return false;
  if(pl.direction==='horizontal')return true;
  if(pl.direction==='vertical')return false;
  if(String(pl.row==null?'':pl.row).indexOf('/')>=0)return false; // spans rows → tall
  const nCols=(Array.isArray(lp.columns)&&lp.columns.length)||1;
  if(nCols<=1)return true; // single-column grid → full-width bar
  const colStr=String(pl.col==null?1:pl.col);
  if(colStr.indexOf('/')>=0){
    const pcs=colStr.split('/');
    return(parseInt(pcs[0],10)||1)<=1&&(parseInt(pcs[1],10)||0)>=nCols+1; // spans all columns
  }
  return false; // one column of a multi-column grid → side rail
}
// contain counterpart of coverStage — image letterboxed inside the box.
function containStage(boxW,boxH,da){
  if(!(da>0)||!(boxW>0)||!(boxH>0))return null;
  let w,h;
  if(boxW/boxH>=da){h=boxH;w=boxH*da;}else{w=boxW;h=boxW/da;}
  return{w:w,h:h,left:(boxW-w)/2,top:(boxH-h)/2};
}
// Approximate colour temperature (Kelvin) → RGB (Tanner Helland, compact)
function kelvinToRgb(k){
  k=Math.max(1000,Math.min(12000,k))/100;
  let r,g,b;
  r=k<=66?255:Math.min(255,Math.max(0,329.7*Math.pow(k-60,-0.1332)));
  g=k<=66?Math.min(255,Math.max(0,99.47*Math.log(k)-161.12)):Math.min(255,Math.max(0,288.12*Math.pow(k-60,-0.0755)));
  b=k>=66?255:(k<=19?0:Math.min(255,Math.max(0,138.52*Math.log(k-10)-305.04)));
  return[Math.round(r),Math.round(g),Math.round(b)];
}
// CSS filter chain that tints a (grayscale-ish) overlay PNG toward a target RGB
function tintFilter(rgb){
  const r=rgb[0]/255,g=rgb[1]/255,b=rgb[2]/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  let h=0,sat=0;const l=(mx+mn)/2;
  if(mx!==mn){
    const d=mx-mn;
    sat=l>0.5?d/(2-mx-mn):d/(mx+mn);
    h=mx===r?((g-b)/d+(g<b?6:0)):mx===g?((b-r)/d+2):((r-g)/d+4);
    h*=60;
  }
  return'sepia(1) saturate('+Math.max(0.2,sat*3).toFixed(2)+') hue-rotate('+Math.round(h-38)+'deg) brightness('+(0.6+l*0.9).toFixed(2)+')';
}
// ---- v3 → v4 auto-migration ---------------------------------------------------
// Configs without a layout: block are converted in memory on load (clean cut —
// the 4-tier engine is gone). The editor offers saving the migrated config.
const ROC_ELEMENT_KEYS=['overlays','zones','badges','elements','icons','labels','gauges','blinds','groups'];
function rocMigScalar(v){
  if(v==null||typeof v!=='object'||Array.isArray(v))return v;
  if(v.portrait!=null||v.landscape!=null)return v;
  const p=v.mobile!=null?v.mobile:(v.tablet!=null?v.tablet:(v.desktop!=null?v.desktop:v.ultrawide));
  const l=v.desktop!=null?v.desktop:(v.ultrawide!=null?v.ultrawide:(v.tablet!=null?v.tablet:v.mobile));
  if(p!=null&&l!=null&&p===l)return p;
  const o={};if(p!=null)o.portrait=p;if(l!=null)o.landscape=l;
  return Object.keys(o).length?o:undefined;
}
function rocMigItem(it){
  if(!it||typeof it!=='object')return;
  if(it.mobile&&!it.portrait)it.portrait=it.mobile;
  if(!it.landscape){const d=it.desktop||it.ultrawide||it.tablet;if(d)it.landscape=d;}
  delete it.mobile;delete it.tablet;delete it.desktop;delete it.ultrawide;
}
function rocMigMedia(list){
  (list||[]).forEach(function(cc){
    if(!cc||!cc.media||cc.media==='all')return;
    const set={};
    String(cc.media).split(',').map(function(s){return s.trim();}).forEach(function(t){
      if(t==='portrait'||t==='mobile')set.portrait=1;
      else if(t==='landscape'||t==='desktop'||t==='tablet'||t==='ultrawide')set.landscape=1;
    });
    const out=Object.keys(set);
    cc.media=out.length>=2?'all':(out[0]||'all');
  });
}
function rocMigRoom(r){
  if(!r)return;
  ROC_ELEMENT_KEYS.forEach(function(k){(r[k]||[]).forEach(rocMigItem);});
  rocMigMedia(r.cards_above);rocMigMedia(r.cards_below);
  if(r.light_controls&&r.light_controls.height!=null){
    const hv=rocMigScalar(r.light_controls.height);
    if(hv===undefined)delete r.light_controls.height;else r.light_controls.height=hv;
  }
}
// Generate a layout block approximating the old stacked v3 look.
function rocGenLayout(cfg){
  const rooms=Array.isArray(cfg.rooms)&&cfg.rooms.length?cfg.rooms:[cfg];
  const has=function(k){
    const hv=function(x){return!!(x&&x[k]&&(!Array.isArray(x[k])||x[k].length));};
    return hv(cfg)||rooms.some(hv);
  };
  const wantNav=Array.isArray(cfg.rooms)&&cfg.rooms.length>1&&((cfg.nav&&cfg.nav.style)!=='none');
  const navSide=wantNav&&cfg.nav&&(cfg.nav.position==='left'||cfg.nav.position==='right');
  const wantAbove=has('cards_above'),wantBelow=has('cards_below'),wantLights=has('light_controls');
  // Any blind docking its control in the given profile → the layout needs a cover region
  const dockIn=function(profile){
    const blinds=(cfg.blinds||[]).concat.apply([],rooms.map(function(r){return(r&&r.blinds)||[];}));
    return blinds.some(function(b){
      if(!b||!b.control)return false;
      const ctl=b.control===true?{}:b.control;
      const pv=(ctl.placement&&typeof ctl.placement==='object')?ctl.placement[profile]:ctl.placement;
      const dv=(ctl.display&&typeof ctl.display==='object')?ctl.display[profile]:ctl.display;
      return pv==='dock'||dv==='dock';
    });
  };
  const mk=function(side,dock){
    const rows=[],place={};let r=1;
    const dockCol=dock&&!side; // landscape without a side nav → dock as a right column
    if(wantNav&&!side){rows.push(8);place.nav={row:r++};}
    if(wantAbove){rows.push(12);place.cards_above={row:r++};}
    if(wantLights){rows.push(7);place.lights={row:r++};}
    const imgRow=r++;rows.push(0);place.image={row:imgRow};
    if(wantBelow){rows.push(12);place.cards_below={row:r++};}
    if(dock&&!dockCol){rows.push(14);place.cover={row:r++};} // stacked (bottom) cover strip
    rows[imgRow-1]=Math.max(20,100-rows.reduce(function(a,b){return a+b;},0));
    if(side){
      place.nav={row:'1/'+(rows.length+1),col:cfg.nav.position==='left'?1:2};
      const oc=cfg.nav.position==='left'?2:1;
      ['cards_above','lights','image','cards_below','cover'].forEach(function(k){if(place[k])place[k].col=oc;});
      return{columns:cfg.nav.position==='left'?[15,85]:[85,15],rows:rows,place:place};
    }
    if(dockCol){
      place.cover={row:'1/'+(rows.length+1),col:2};
      return{columns:[88,12],rows:rows,place:place};
    }
    return{columns:[100],rows:rows,place:place};
  };
  return{height:'viewport',portrait:mk(false,dockIn('portrait')),landscape:mk(navSide,dockIn('landscape'))};
}
function rocMigrateLayout(cfg){
  if(!cfg||typeof cfg!=='object'||cfg.layout)return cfg;
  const c=rocClone(cfg);
  ['aspect_ratio','border_radius'].forEach(function(k){
    const v=rocMigScalar(c[k]);
    if(v===undefined)delete c[k];else if(v!=null)c[k]=v;
  });
  c.layout=rocGenLayout(c); // generate BEFORE nav.position is normalised
  delete c.max_height;delete c.breakpoints;delete c.mobile_breakpoint;
  if(c.nav){delete c.nav.auto_breakpoint;if(c.nav.position==='auto')c.nav.position='top';}
  rocMigRoom(c);
  (c.rooms||[]).forEach(rocMigRoom);
  try{console.info('[room-overlay-card] v3 config auto-migrated to the v4 layout engine (in memory only). Open the card editor to review & save — see LAYOUT.md.');}catch(_){}
  return c;
}
// ----- Multi-room helpers -----------------------------------------------------
// Keys that live per-room; top-level values act as shared defaults for all rooms
const ROOM_KEYS=['base_image','base_camera','camera_refresh','base_image_conditions','weather_overlay','filter_conditions','brightness_model','overlays','zones','badges','elements','icons','labels','gauges','blinds','groups','tap_action','cards_above','cards_below','light_controls'];
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

function evalCond(c,s){
  const e=s[c.entity];if(!e)return false;
  const sv=c.attribute!==undefined?String(e.attributes[c.attribute]??''): e.state,nv=parseFloat(sv);let r=true;
  if(c.state!==undefined)r=sv===String(c.state);
  else if(c.state_not!==undefined)r=Array.isArray(c.state_not)?!c.state_not.map(String).includes(sv):sv!==String(c.state_not);
  else if(c.operator!==undefined&&c.value!==undefined){
    const cv=typeof c.value==='number'?c.value:parseFloat(String(c.value));
    if(isNaN(nv)||isNaN(cv))r=false;
    else switch(c.operator){case'<':r=nv<cv;break;case'>':r=nv>cv;break;case'<=':r=nv<=cv;break;case'>=':r=nv>=cv;break;case'==':r=nv===cv;break;case'!=':r=nv!==cv;break;default:r=false;}
  }
  if(r&&c.and)r=evalCond(c.and,s);
  if(!r&&c.or)r=evalCond(c.or,s);
  return r;
}

function resolveVal(conds,states,fallback){
  for(const cv of conds){if(cv.condition===undefined)continue;if(evalCond(cv.condition,states))return cv.value;}
  const d=conds.find(cv=>cv.condition===undefined);return d!==undefined?d.value:fallback;
}

function resolveFilter(conds,states){
  for(const fc of conds){if(fc.condition===undefined)continue;if(evalCond(fc.condition,states))return fc.filter;}
  const d=conds.find(fc=>fc.condition===undefined);return d?d.filter:'none';
}

function resolveFilterInverted(conds,states){
  // Najdi aktuálně matchující podmínku
  let curIdx=-1;
  for(let i=0;i<conds.length;i++){const fc=conds[i];if(fc.condition===undefined)continue;if(evalCond(fc.condition,states)){curIdx=i;break;}}
  // Pokud matchuje podmínka → zobraz default (fallback)
  if(curIdx!==-1){const d=conds.find(fc=>fc.condition===undefined);return d?d.filter:'none';}
  // Pokud je aktivní default → zobraz první podmíněný filter
  const first=conds.find(fc=>fc.condition!==undefined);return first?first.filter:'none';
}

function parseCssColor(c){let m=c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);if(m)return[parseInt(m[1]),parseInt(m[2]),parseInt(m[3])];m=c.match(/^#([0-9a-f]{6})$/i);if(m)return[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];m=c.match(/^#([0-9a-f]{3})$/i);if(m)return[parseInt(m[1][0]+m[1][0],16),parseInt(m[1][1]+m[1][1],16),parseInt(m[1][2]+m[1][2],16)];return null;}

// ----- Light-controls lux ring ------------------------------------------------
// A material-slider-card strip whose border colour tracks a lux sensor: a smooth
// gradient interpolated in HSL between two anchor colours (dark = low lux,
// bright = high lux). HSL interpolation makes a blue->amber ramp travel through
// vivid hues (like the hand-written card_mod template it replaces), not a muddy
// RGB midpoint.
function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);switch(mx){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h*=60;}return[h,s*100,l*100];}
function toHslParts(c){if(c==null)return null;const m=String(c).match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);if(m)return[parseFloat(m[1]),parseFloat(m[2]),parseFloat(m[3])];const rgb=parseCssColor(String(c));return rgb?rgbToHsl(rgb[0],rgb[1],rgb[2]):null;}
const LC_DEF_LOW='#261a66',LC_DEF_HIGH='#f4c025',LC_DEF_BG='#000000';
function lcBorderColor(lux,lc){
  const max=Number(lc&&lc.lux_max)||50;
  const t=Math.max(0,Math.min(1,(Number(lux)||0)/(max||1)));
  const lo=toHslParts((lc&&lc.color_low)||LC_DEF_LOW)||[250,60,25];
  const hi=toHslParts((lc&&lc.color_high)||LC_DEF_HIGH)||[45,90,55];
  const h=lo[0]+(hi[0]-lo[0])*t,s=lo[1]+(hi[1]-lo[1])*t,l=lo[2]+(hi[2]-lo[2])*t;
  return'hsl('+(Math.round(h*10)/10)+','+(Math.round(s*10)/10)+'%,'+(Math.round(l*10)/10)+'%)';
}
function lcSliderCss(bgOff,col){
  return ':host{'+(bgOff?'--bsc-background:'+bgOff+' !important;':'')+'--bsc-border-radius:999px !important;'+(col?'--bsc-border-color:'+col+' !important;':'')+'width:100% !important;}'
    +'#container{border-radius:999px !important;width:100% !important;transition:border-color 0.6s ease-in-out !important;}';
}
// material-slider-card only controls `light` (brightness) and `cover`. On/off
// domains (switch, input_boolean, fan, script…) can't drive a brightness slider,
// so those entities render as an on/off toggle pill that shares the lux ring.
function lcUsesSlider(ent){return String(ent||'').split('.')[0]==='light';}
// Build a CSS linear-gradient that samples the SAME HSL ramp as the border ring,
// so the editor preview matches what the sliders actually show.
function lcGradientCss(low,high){
  const lc={color_low:low||LC_DEF_LOW,color_high:high||LC_DEF_HIGH,lux_max:100};
  const stops=[];
  for(let i=0;i<=10;i++){const t=i/10;stops.push(lcBorderColor(t*100,lc)+' '+Math.round(t*100)+'%');}
  return 'linear-gradient(90deg,'+stops.join(',')+')';
}
function lcResolveHeight(h,tier){
  if(h&&typeof h==='object'&&!Array.isArray(h))h=tVal(h,tier);
  if(h==null||h==='')return 20;
  if(typeof h==='number')return h;
  const m=String(h).trim().match(/^([\d.]+)\s*(px|vh|vw|%)?$/i);
  if(!m)return 20;
  const n=parseFloat(m[1]),u=(m[2]||'px').toLowerCase();
  if(u==='px')return n;
  const w=(typeof window!=='undefined'&&window)||{};
  if(u==='vh'||u==='%')return Math.round((w.innerHeight||800)*n/100);
  if(u==='vw')return Math.round((w.innerWidth||1280)*n/100);
  return n;
}
function lcNormEnts(lc){return(lc&&Array.isArray(lc.entities)?lc.entities:[]).map(function(e){return typeof e==='string'?{entity:e}:(e||{});}).filter(function(e){return e&&e.entity;});}

function lerpFilterGradient(stops,pct,presorted){
  if(!stops||!stops.length)return 'none';
  const ss=presorted?stops:stops.slice().sort((a,b)=>a.value-b.value);
  if(pct<=ss[0].value)return ss[0].filter||'none';
  if(pct>=ss[ss.length-1].value)return ss[ss.length-1].filter||'none';
  let lo=ss[0],hi=ss[ss.length-1];
  for(let i=0;i<ss.length-1;i++){if(pct>=ss[i].value&&pct<=ss[i+1].value){lo=ss[i];hi=ss[i+1];break;}}
  const t=(pct-lo.value)/(hi.value-lo.value);
  const loF=parseFilterStr(lo.filter||'none'),hiF=parseFilterStr(hi.filter||'none');
  const res={};
  FILTER_PROPS.forEach(function(p){res[p.key]=loF[p.key]+t*(hiF[p.key]-loF[p.key]);});
  return buildFilterStr(res);
}

// brightness_model → CSS filter. Returns null when the model is absent/incomplete
// (caller falls back to filter_conditions), 'none' when no source matches.
function bmFilter(bm,s,presortedFg){
  if(!bm||!bm.source?.length||!bm.filter_gradient?.length)return null;
  let pct=null;
  for(const src of bm.source){
    if(src.condition&&!evalCond(src.condition,s))continue;
    const ent=s[src.entity];if(!ent)continue;
    const rv=src.attribute!==undefined?parseFloat(ent.attributes[src.attribute]):parseFloat(ent.state);
    if(isNaN(rv))continue;
    const mn=src.min_input??0,mx=src.max_input??100;
    pct=Math.max(0,Math.min(100,(rv-mn)/(mx-mn)*100));
    break;
  }
  return pct!==null?lerpFilterGradient(presortedFg||bm.filter_gradient,pct,!!presortedFg):'none';
}

function resolveSize(raw,cardW){if(!raw)return null;const s=String(raw);return s.endsWith('%')?Math.round(cardW*parseFloat(s)/100)+'px':s;}

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
    if(isCustom){
      // 'custom' tier: keep only opted-in elements (nav_mini:true) — applied
      // to whichever layer this call is filtering (top-level defaults when
      // called with gcfg, that room's own overrides when called per-room),
      // so a room relying on a top-level default array is filtered exactly
      // like one with its own array (matches the always-off strip above,
      // which has the same top-level+per-room duality for the same reason).
      ['gauges','labels','icons','badges','blinds','elements'].forEach(function(k){
        if(Array.isArray(o[k]))o[k]=o[k].filter(function(it){return it&&it.nav_mini===true;});
      });
      if(!_wxOptIn)delete o.weather_overlay;
    }
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
    return[Object.assign({},base,{_dayNight:true,background:'transparent',_slat_count:scount,_slat_color:sc})];
  }else if(type==='venetian'){
    const gc=b.gap_color||'rgba(180,160,140,0.35)';
    const grad='repeating-linear-gradient(to bottom,'+sc+' 0px,'+sc+' '+sw+'px,'+gc+' '+sw+'px,'+gc+' '+(sw+sg)+'px)';
    return[Object.assign({},base,{color:grad})];
  }
  return[Object.assign({},base,{color:sc})];
}
// ---- Cover control (roleta) ------------------------------------------------
const CC_COLORS={red:'#f44336',pink:'#e91e63',purple:'#926bc7','deep-purple':'#674fa1',indigo:'#4e5cb5',blue:'#2196f3','light-blue':'#03a9f4',cyan:'#00bcd4',teal:'#009688',green:'#4caf50','light-green':'#8bc34a',lime:'#cddc39',yellow:'#ffeb3b',amber:'#ffc107',orange:'#ff9800','deep-orange':'#ff5722',brown:'#795548',grey:'#9e9e9e',gray:'#9e9e9e','blue-grey':'#607d8b','blue-gray':'#607d8b',black:'#000000',white:'#ffffff'};
function ccColor(x){if(!x)return'';const k=String(x).trim().toLowerCase();return CC_COLORS[k]||x;}
function coverControlNorm(b,profile){
  if(!b||!b.control||!b.entity)return null;
  const ctl=(b.control===true)?{}:b.control;
  // placement accepts a per-profile object {portrait,landscape} → off|float|dock
  const _plRaw=tVal(ctl.placement,profile);
  const _dispRaw=tVal(ctl.display,profile); // legacy v3.3.0 key
  if(_plRaw==='off'||_plRaw===false||_dispRaw==='off'||_dispRaw===false)return null;
  let placement=_plRaw||({popover:'float',float:'float',dock:'dock'})[_dispRaw]||'float';
  if(placement!=='dock')placement='float';
  const presets=(Array.isArray(ctl.presets)?ctl.presets:[]).map(function(pp){
    return{position:Math.max(0,Math.min(100,Math.round(Number(pp.position)||0))),icon:pp.icon||'',color:pp.color||'',name:pp.name||''};
  });
  return{id:b.id,entity:b.entity,
    placement:placement,
    side:(ctl.dock_side==='left')?'left':'right',
    top:ctl.top||b.top||'10%',
    left:ctl.left||b.left||'10%',
    height:ctl.height||b.height||'30%',
    width:ctl.width||'52px',
    slider:ctl.slider!==false,
    buttons:Array.isArray(ctl.buttons)?ctl.buttons:['up','stop','down'],
    presets:presets,
    name:ctl.name||b.name||''};
}
function coverCtlHtml(cc,mob,mode){
  const dock=mode==='dock';
  const horiz=!!mob; // float: portrait bottom bar · dock: grid-derived (rocCoverHoriz)
  const base='background:rgba(0,0,0,0.68);color:#fff;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-sizing:border-box;border-radius:14px;';
  let pos;
  if(dock)pos='position:relative;flex:1 1 0;min-width:0;min-height:0;padding:'+(horiz?'4px 10px':'8px 5px')+';'; // permanently visible member of the cover grid region
  else if(horiz)pos='display:none;position:absolute;z-index:120;left:6px;right:6px;bottom:6px;height:54px;padding:0 12px;';
  else pos='display:none;position:absolute;z-index:120;top:'+cc.top+';left:'+cc.left+';height:'+cc.height+';width:'+cc.width+';padding:8px 5px;';
  const hasUp=cc.buttons.indexOf('up')>=0,hasDown=cc.buttons.indexOf('down')>=0,hasStop=cc.buttons.indexOf('stop')>=0;
  const rail=cc.slider?'<div class="cc-rail" data-cc-rail><div class="cc-fill" data-cc-fill></div><div class="cc-thumb" data-cc-thumb></div></div>':'';
  // Vertical rail: config order (top→bottom), typically authored open→closed.
  // Horizontal bar: always closed→open left→right, regardless of config order,
  // so a single presets list works for both profiles without contradicting itself.
  const _ccPresets=horiz?cc.presets.slice().sort(function(a,b){return a.position-b.position;}):cc.presets;
  let presets='';
  for(const pp of _ccPresets){
    const col=ccColor(pp.color)||'#fff';
    presets+='<button class="cc-preset" data-cc-preset data-pos="'+pp.position+'" title="'+escA(pp.name||(pp.position+' %'))+'" style="--cc-col:'+escA(col)+';">'
      +(pp.icon?'<ha-icon icon="'+escA(pp.icon)+'"></ha-icon>':'<span class="cc-preset-num">'+pp.position+'</span>')
      +'</button>';
  }
  return '<div class="roc-cc'+(horiz?' cc-h':'')+'" data-cc="'+escA(cc.id)+'" data-cc-mode="'+(dock?'dock':'float')+'" title="'+escA(cc.name||'')+'" style="'+base+pos+'">'
    +'<span class="cc-pct" data-cc-pct></span>'
    +(hasUp?'<button class="cc-cap" data-cc-up aria-label="Open"><ha-icon icon="mdi:chevron-up"></ha-icon></button>':'')
    +rail
    +(hasDown?'<button class="cc-cap" data-cc-down aria-label="Close"><ha-icon icon="mdi:chevron-down"></ha-icon></button>':'')
    +'<div class="cc-presets">'+presets+'</div>'
    +(hasStop?'<button class="cc-stop" data-cc-stop aria-label="Stop"><ha-icon icon="mdi:stop"></ha-icon></button>':'')
    +'</div>';
}
const CC_CSS='.roc-cc{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;}.roc-cc.cc-h{flex-direction:row;gap:10px;}.roc-cc .cc-pct{font-size:12px;font-weight:600;flex:none;min-width:20px;text-align:center;}.roc-cc .cc-cap{display:flex;align-items:center;justify-content:center;width:34px;height:26px;border:none;border-radius:8px;background:rgba(255,255,255,0.1);color:#fff;cursor:pointer;--mdc-icon-size:20px;padding:0;flex:none;}.roc-cc.cc-h .cc-cap{width:30px;height:34px;}.roc-cc .cc-cap:active{transform:scale(0.92);}.roc-cc .cc-rail{position:relative;background:rgba(255,255,255,0.16);border-radius:6px;cursor:pointer;touch-action:none;flex:1 1 auto;width:10px;min-height:34px;}.roc-cc.cc-h .cc-rail{height:10px;min-width:50px;width:auto;min-height:0;}.roc-cc .cc-fill{position:absolute;background:rgba(130,115,105,0.85);border-radius:6px;left:0;right:0;bottom:0;height:0%;}.roc-cc.cc-h .cc-fill{top:0;bottom:0;left:0;right:auto;width:0%;height:auto;}.roc-cc .cc-thumb{position:absolute;background:#fff;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,0.4);left:50%;bottom:0%;width:22px;height:10px;transform:translate(-50%,50%);}.roc-cc.cc-h .cc-thumb{top:50%;left:0%;bottom:auto;width:10px;height:22px;transform:translate(-50%,-50%);}.roc-cc .cc-presets{display:flex;flex-direction:column;align-items:center;gap:5px;flex:none;}.roc-cc.cc-h .cc-presets{flex-direction:row;}.roc-cc .cc-preset{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:none;border-radius:8px;background:rgba(255,255,255,0.08);color:var(--cc-col,#fff);cursor:pointer;--mdc-icon-size:19px;padding:0;flex:none;}.roc-cc .cc-preset-num{color:var(--cc-col,#fff);font-weight:600;font-size:12px;}.roc-cc .cc-preset.active{background:rgba(255,255,255,0.16);box-shadow:inset 0 0 0 2px var(--cc-col,#fff);}.roc-cc .cc-stop{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:none;border-radius:8px;background:rgba(255,255,255,0.1);color:#fff;cursor:pointer;--mdc-icon-size:18px;padding:0;flex:none;}.roc-cc .cc-stop.moving{background:rgba(226,75,74,0.28);color:#f6a6a6;animation:roc-glow 1.3s ease-in-out infinite;--roc-ac:rgba(226,75,74,0.6);}';
function lerpColorGradient(stops,val,presorted){if(!stops||!stops.length)return'white';const s=presorted?stops:stops.slice().sort((a,b)=>a.value-b.value);if(val<=s[0].value)return s[0].color;if(val>=s[s.length-1].value)return s[s.length-1].color;for(let i=0;i<s.length-1;i++){if(val>=s[i].value&&val<=s[i+1].value){const t=(val-s[i].value)/(s[i+1].value-s[i].value);const c1=parseCssColor(s[i].color),c2=parseCssColor(s[i+1].color);if(!c1||!c2)return s[i].color;return'rgb('+Math.round(c1[0]+(c2[0]-c1[0])*t)+','+Math.round(c1[1]+(c2[1]-c1[1])*t)+','+Math.round(c1[2]+(c2[2]-c1[2])*t)+')';}}return s[s.length-1].color;}

const BPOS={'bottom-left':'bottom:10px;left:10px','bottom-right':'bottom:10px;right:10px','top-left':'top:10px;left:10px','top-right':'top:10px;right:10px'};

function makeBadgePos(b){
  if(b.position==='custom')return 'top:'+(b.y||'auto')+';left:'+(b.x||'auto')+';';
  return BPOS[b.position||'bottom-left']||BPOS['bottom-left'];
}

let _rocHelpers=null,_rocHelpersP=null;
function getHelpers(){
  if(_rocHelpers)return Promise.resolve(_rocHelpers);
  if(window.loadCardHelpers){
    if(!_rocHelpersP)_rocHelpersP=window.loadCardHelpers().then(function(h){_rocHelpers=h;return h;}).catch(function(){return null;});
    return _rocHelpersP;
  }
  return Promise.resolve(null);
}
function makeHACard(cfg,onReady){
  if(!cfg?.type)return null;
  // Container — the real card element is created async via HA card helpers
  // (helpers handle lazy-loaded hui-* cards and render hui-error-card on failure)
  const wrap=document.createElement('div');
  wrap.style.cssText='width:100%;height:100%;display:block;';
  getHelpers().then(function(h){
    let el=null;
    if(h&&typeof h.createCardElement==='function'){
      try{el=h.createCardElement(cfg);}catch(e){console.error('[room-overlay-card] createCardElement failed:',cfg.type,e);}
    }
    if(!el){
      // Fallback: direct element creation (pre-2024 behaviour)
      const name=cfg.type.startsWith('custom:')?cfg.type.substring(7):`hui-${cfg.type}-card`;
      try{el=document.createElement(name);}catch(e){console.error('[room-overlay-card] createElement failed:',name,e);return;}
      const apply=function(){if(typeof el.setConfig==='function')try{el.setConfig(cfg);}catch(e){console.error('[room-overlay-card] setConfig failed:',cfg.type,e);}};
      customElements.get(name)?apply():customElements.whenDefined(name).then(apply);
    }
    el.style.width='100%';el.style.height='100%';
    wrap.appendChild(el);
    if(onReady)onReady(el);
  });
  return wrap;
}

class RoomOverlayCard extends HTMLElement{
  constructor(){
    super();this.attachShadow({mode:'open'});
    this._config=null;this._hass=null;this._rendered=false;
    this._baseEl=null;this._ovEls={};this._zoneEls={};
    this._biconEls={};this._blabelEls={};this._cardEls={};this._contEls={};
    this._icoEls={};
    this._rafPending=false;this._relevantEntities=null;this._relevantAttrSources=null;this._prevStates={};
    this._io=null;this._ro=null;this._visible=true;this._testFlipped=false;this._lblEls={};this._gaugeEls={};
    this._groupState={};this._grpPanelEls={};
    this._selectedTM=null;this._tmKeyHandler=null;
    this._lcEls=[];this._lcCfg=null;this._lcPrevCol=null;this._lcToggles=[];
    this._bcontEls={};this._wxEl=null;this._camTimer=null;
    this._tmplUnsubs=[];this._tmplVals={};this._tmplVis={};this._relTimer=null;
    this._gdH=null;this._gdV=null;this._tier=null;this._vt=null;this._profile=null;this._profFlipped=false;this._lp=null;this._winHandler=null;this._wrapRo=null;this._bodyRo=null;
    this._scRo=null;this._scrollEl=null;this._rootHPx=0;this._rootHRaw=0;this._rootHT1=null;this._locHandler=null;this._barMo=null;this._pvMo=null;this._lastPinCheck=0;this._pinQueued=false;
    this._roomIdx=0;this._roomCfg=null;this._manualHoldUntil=0;
    this._navThumbEls={};this._navChipEls=[];this._navCardEls=[];this._zoomScale=1;
    this._navMiniEls={};this._navMiniRo=null;
    this._navPos='top';this._wrapTA='';
    this._orientHandler=null;this._roomDragActive=false;
    this._lastRoomDragEnd=0;this._followInit=false;this._navFollowEl=null;
    this._stripCardEls=[];this._imgRatios={};
    this._hlHandler=null;this._sortedLblGrads={};this._sortedBmFg=null;this._radialMeta={};
    this._cfgJson=null;this._renderGen=0;this._navEntities=null;this._navDirty=false;this._fullDirty=false;
    this._navAttrSources=null;this._navBmSorted={};
  }

  static getStubConfig(){return{base_image:'/local/room.webp',aspect_ratio:'16/9',border_radius:'12px',filter_conditions:[],overlays:[],zones:[],badges:[],elements:[],icons:[],test_mode:false,labels:[],gauges:[]};}

  setConfig(cfg){
    cfg=rocMigrateLayout(cfg);
    const hasRooms=Array.isArray(cfg.rooms)&&cfg.rooms.length;
    if(!cfg.base_image&&!cfg.base_camera&&!(hasRooms&&cfg.rooms.some(function(r){return r.base_image||r.base_camera;})))
      throw new Error('[room-overlay-card] base_image (or base_camera) is required — directly or in rooms[]');
    const j=JSON.stringify(cfg);
    if(this._rendered&&this._cfgJson===j)return; // identical config — skip full rebuild
    this._cfgJson=j;
    // Warn once about element ids that would break HTML/selector interpolation
    const _badId=/[^A-Za-z0-9_-]/;
    outer:for(const r of(hasRooms?cfg.rooms:[cfg])){
      if(!r)continue;
      for(const k of['overlays','zones','badges','icons','labels','gauges','blinds','elements','groups']){
        for(const it of(r[k]||[])){
          if(it&&it.id!=null&&_badId.test(String(it.id))){
            console.warn('[room-overlay-card] element id "'+it.id+'" contains characters outside A-Za-z0-9_- — rendering/selection may misbehave');
            break outer;
          }
        }
      }
    }
    if(hasRooms&&this._roomIdx>=cfg.rooms.length)this._roomIdx=0;
    this._config=cfg;this._rendered=false;if(this._hass)this._render();
  }

  set hass(h){
    this._hass=h;if(!this._config)return;
    if(!this._rendered){this._render();return;}
    // Embedded cards do their own change detection — always forward hass
    // (even while off-screen, so they're current the moment the card scrolls back)
    for(const k in this._cardEls){try{this._cardEls[k].hass=h;}catch(_){}}
    for(const el of(this._navCardEls||[]))try{el.hass=h;}catch(_){}
    for(const ri in(this._navMiniEls||{}))try{this._navMiniEls[ri].el.hass=h;}catch(_){}
    for(const el of(this._stripCardEls||[]))try{el.hass=h;}catch(_){}
    for(const o of(this._lcEls||[]))try{o.el.hass=h;}catch(_){}
    if(!this._visible)return;
    if(this._relevantEntities){
      const s=h.states,p=this._prevStates;
      const chg=this._relevantEntities.some(id=>s[id]?.state!==p[id])
        ||(this._relevantAttrSources&&this._relevantAttrSources.some(a=>s[a.entity]?.attributes[a.attr]!==p[a.entity+'.'+a.attr]));
      if(!chg){
        // Active room untouched — maybe another room's thumbnail/chip changed
        const navChg=(this._navEntities&&this._navEntities.length&&this._navEntities.some(id=>s[id]?.state!==p[id]))
          ||(this._navAttrSources&&this._navAttrSources.length&&this._navAttrSources.some(a=>s[a.entity]?.attributes[a.attr]!==p[a.entity+'.'+a.attr]));
        if(navChg)this._schedule(true);
        return;
      }
    }
    this._schedule(false);
  }

  // Batched update; navOnly refreshes just the nav thumbnails/chips.
  // A pending nav-only frame upgrades to a full one if a full request lands first.
  // rAF while visible (paint-aligned), setTimeout(0) while hidden — rAF NEVER
  // fires in background tabs (browser_mod popups, secondary windows), which
  // would queue state updates forever and leave a stale card on re-focus.
  _schedule(navOnly){
    if(navOnly)this._navDirty=true;else this._fullDirty=true;
    if(this._rafPending)return;
    this._rafPending=true;
    const run=()=>{
      this._rafPending=false;
      const full=this._fullDirty;this._fullDirty=false;this._navDirty=false;
      if(!this._hass||!this._rendered)return;
      if(full)this._update();else this._updateNav();
    };
    if(typeof document!=='undefined'&&document.hidden)setTimeout(run,0);
    else requestAnimationFrame(run);
  }

  _extractEntities(obj,ids=new Set(),attrs=new Set()){
    if(!obj||typeof obj!=='object')return{ids,attrs};
    if(typeof obj.entity==='string'){
      ids.add(obj.entity);
      if(typeof obj.attribute==='string')attrs.add(obj.entity+' '+obj.attribute);
    }
    if(typeof obj.color_from==='string'){
      ids.add(obj.color_from);
      attrs.add(obj.color_from+' rgb_color');
      attrs.add(obj.color_from+' color_temp_kelvin');
    }
    for(const v of Object.values(obj)){
      if(Array.isArray(v))v.forEach(i=>{
        if(typeof i==='string'&&/^[a-z_]+\.[a-z0-9_]+$/.test(i))ids.add(i); // entity-id strings in plain lists (e.g. embedded entities cards)
        else this._extractEntities(i,ids,attrs);
      });
      else if(v&&typeof v==='object')this._extractEntities(v,ids,attrs);
    }
    return{ids,attrs};
  }

  _extractAttrSources(cfg){
    const out=[];
    const add=function(entity,attr){if(entity&&attr)out.push({entity,attr});}
    ;(cfg.brightness_model?.source||[]).forEach(function(s){add(s.entity,s.attribute);});
    (cfg.gauges||[]).forEach(function(g){add(g.entity,g.attribute);if(g.alert_conditions?.attribute)add(g.alert_conditions.entity,g.alert_conditions.attribute);});
    (cfg.labels||[]).forEach(function(l){add(l.entity,l.attribute);});
    (cfg.icons||[]).forEach(function(ico){add(ico.entity,ico.attribute);});
    (cfg.blinds||[]).forEach(function(bl){add(bl.entity,bl.attribute);});
    return out;
  }

  getCardSize(){return 4;}

  _addZoneListeners(el,tapAction,holdAction,doubleTapAction,holdDelay){
    const delay=holdDelay??500;
    let holdTimer=null,showTimer=null,held=false,tapTimer=null,lastTapTime=0,ring=null;
    const self=this;
    // Hold progress ring — fills over the hold delay, turns green when the hold
    // threshold is reached (so you know it registered). Global opt-out: hold_feedback:false.
    const fb=holdAction&&!(self._roomCfg&&self._roomCfg.hold_feedback===false);
    const fbColor=(self._roomCfg&&self._roomCfg.hold_color)||'';
    const sd=Math.min(140,Math.round(delay*0.25)); // small delay so quick taps don't flash the ring
    const startHold=function(dur){
      if(!fb||ring)return;
      ring=document.createElement('div');
      ring.className='roc-hold';
      ring.style.setProperty('--roc-hold-dur',dur+'ms');
      if(fbColor)ring.style.setProperty('--roc-hold-color',fbColor);
      ring.innerHTML='<svg viewBox="0 0 36 36"><circle class="roc-hold-trk" cx="18" cy="18" r="16"></circle><circle class="roc-hold-bar" cx="18" cy="18" r="16"></circle></svg>';
      el.appendChild(ring);
    };
    const doneHold=function(){if(ring)ring.classList.add('done');};
    const cancel=function(){clearTimeout(holdTimer);clearTimeout(showTimer);if(ring){ring.remove();ring=null;}};
    const press=function(){
      held=false;cancel();
      if(holdAction){
        showTimer=setTimeout(function(){startHold(delay-sd);},sd);
        holdTimer=setTimeout(function(){
          held=true;doneHold();
          // Tactile confirmation the MOMENT the hold threshold is reached —
          // distinct from _exec()'s haptic (which fires later, on release,
          // for whichever action actually ran). Same opt-out as everywhere
          // else in the card: top-level `haptic: false`.
          if(self._config.haptic!==false)try{window.dispatchEvent(new CustomEvent('haptic',{detail:'medium'}));}catch(_){}
        },delay);
      }
    };
    const onTap=function(e){
      if(el._rocSlid){el._rocSlid=false;return;} // slider drag just ended — swallow the tap
      if(held){if(holdAction)self._exec(holdAction,e);held=false;return;}
      if(doubleTapAction){
        const now=Date.now();
        if(now-lastTapTime<350){ // double tap works even without tap_action
          if(tapTimer){clearTimeout(tapTimer);tapTimer=null;}
          lastTapTime=0;
          self._exec(doubleTapAction,e);
        }else{
          lastTapTime=now;
          if(tapAction)tapTimer=setTimeout(function(){tapTimer=null;self._exec(tapAction,e);},350);
        }
      }else{
        if(tapAction)self._exec(tapAction,e);
      }
    };
    el.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){if(tapAction)self._exec(tapAction,e);else{e.preventDefault();}}
    });
    el.addEventListener('touchstart',press,{passive:true});
    el.addEventListener('touchend',function(e){
      cancel();e.stopPropagation();e.preventDefault();onTap(e);
    });
    el.addEventListener('touchmove',function(){cancel();},{passive:true});
    el.addEventListener('touchcancel',function(){cancel();held=false;});
    el.addEventListener('mousedown',press);
    el.addEventListener('click',function(e){
      cancel();e.stopPropagation();e.preventDefault();onTap(e);
    });
    el.addEventListener('mouseleave',function(){cancel();held=false;});
  }

  _pad(r){
    const ratio=rocRatio(r)||rocRatio('16/9');
    return ratio?((100/ratio).toFixed(4)+'%'):'56.25%';
  }

  _preloadImages(){
    const c=this._config;
    // Collect images from a room (or the flat config) — in multi-room every room
    // has its own base_image, so we must walk rooms[], not just the root.
    const addImgs=function(r,set){
      if(!r)return;
      if(r.base_image)set.add(r.base_image);
      for(const bc of(r.base_image_conditions||[])){if(bc.image)set.add(bc.image);}
      for(const ov of(r.overlays||[])){
        if(ov.image)set.add(ov.image);
        if(ov.state_images)ov.state_images.forEach(function(m){if(m.image)set.add(m.image);});
      }
    };
    // Active room + swipe neighbours load now; the rest of a large multi-room
    // config waits for browser idle time (keeps dashboard load light).
    const now=new Set(),later=new Set();
    if(Array.isArray(c.rooms)&&c.rooms.length){
      const n=c.rooms.length,cur=this._roomIdx;
      c.rooms.forEach(function(r,ri){
        const near=n<=3||ri===cur||ri===(cur+1)%n||ri===(cur-1+n)%n;
        addImgs(r,near?now:later);
      });
    }else addImgs(c,now);
    // Per-image natural aspect cache — every room may use a different image with a
    // different resolution, so lock_aspect:true must detect each one separately.
    this._preloadImgs=[];const _plSelf=this;
    const load=function(url){
      const img=new Image();
      const grab=function(){if(img.naturalWidth&&img.naturalHeight){_plSelf._imgRatios[url]=img.naturalWidth/img.naturalHeight;_plSelf._layoutStage();}};
      img.onload=grab;
      img.src=url;
      if(img.complete)grab(); // already cached → measure synchronously
      _plSelf._preloadImgs.push(img);
    };
    now.forEach(load);
    const laterArr=[...later].filter(function(u){return!now.has(u);});
    if(laterArr.length){
      const idle=window.requestIdleCallback||function(f){setTimeout(f,1500);};
      idle(function(){laterArr.forEach(load);});
    }
  }

  // Design aspect for lock_aspect: true → base image's natural ratio (auto),
  // or an explicit "W/H" / number. null = feature off (default behaviour).
  _designAspect(){
    const la=(this._roomCfg&&this._roomCfg.lock_aspect)??(this._config&&this._config.lock_aspect);
    if(!la)return null;
    if(la===true){const bi=this._roomCfg&&this._roomCfg.base_image;return(bi&&this._imgRatios[bi])||null;}
    return rocRatio(la);
  }

  // Budget-fit for the intrinsic (auto-row) image box: CSS aspect-ratio sizes
  // the wrap from WIDTH alone (height = width/aspect), blind to the card's
  // height budget — on short viewports the grid total exceeds the pinned card,
  // ha-card clips the overflow and bottom-anchored chips vanish below the
  // edge. When the width-derived height doesn't fit the remaining budget
  // (card height minus the other rows), shrink the box to fit the HEIGHT and
  // keep the design aspect — the image letterboxes (side bars) instead of
  // being cropped, and every stage-glued element stays on it. Fits back up
  // automatically when space returns.
  _layoutFitWrap(){
    if(!this.shadowRoot||!this._config)return;
    const c=this._roomCfg||this._config;
    // Viewport-height budget fitting is irrelevant to a mini — it always
    // renders at a fixed reference width/auto height (see _isMini), never in
    // viewport-height mode — and its card/region rects sit inside a scaled
    // thumbnail host, not a real scrolling page, so the budget math here
    // wouldn't mean anything useful for it anyway.
    if(c._roc_ghost||c._roc_mini)return;
    if(this._profile==='portrait'&&((this._config.layout&&this._config.layout.height)||'viewport')==='viewport')return; // natural portrait sizes itself
    const wrap=this.shadowRoot.querySelector('.wrap');
    if(!wrap||!wrap.style.aspectRatio)return; // only the intrinsic image box
    const region=wrap.parentElement;
    const card=this.shadowRoot.querySelector('ha-card');
    if(!region||!card)return;
    const da=parseFloat(wrap.style.aspectRatio)||16/9;
    const cardR=card.getBoundingClientRect();
    const regR=region.getBoundingClientRect();
    if(!(cardR.height>0)||!(regR.width>0))return;
    // Use the INTENDED card height (we own the inline px) rather than the
    // rect — a theme/HA transition can animate the box for ~300ms and a fit
    // computed from a mid-flight rect feeds the next mismeasurement (the
    // v4.6.1 edit-mode "breathing" loop). ha-card also gets transition:none.
    const _ih=parseFloat(card.style.height);
    const cardBottom=cardR.top+((isFinite(_ih)&&_ih>0)?_ih:cardR.height);
    // Height budget: from the region's top edge to the card's bottom, minus
    // rows placed BELOW the image (from the layout definition — geometry of
    // an already-overflowing grid is unreliable). Regions sharing a below-row
    // count once (max per row).
    const lp=this._lp||{place:{}};
    const imgEnd=rocRowEnd(lp.place&&lp.place.image&&lp.place.image.row);
    const belowRows={};
    this.shadowRoot.querySelectorAll('.roc-reg').forEach(el=>{
      const rg=el.dataset.reg;if(rg==='image')return;
      const pl=lp.place&&lp.place[rg];if(!pl)return;
      const st=rocRowStart(pl.row);
      if(st>=imgEnd){const h=el.getBoundingClientRect().height;if(!(belowRows[st]>=h))belowRows[st]=h;}
    });
    let belowH=0;for(const k in belowRows)belowH+=belowRows[k];
    const budget=Math.floor(cardBottom-regR.top-belowH);
    const naturalH=regR.width/da;
    const target=Math.floor(Math.min(naturalH,Math.max(120,budget)));
    if(target>=Math.floor(naturalH)-1){ // fits — restore pure intrinsic sizing
      if(wrap.style.height!=='auto'){wrap.style.height='auto';wrap.style.width='';wrap.style.marginLeft='';wrap.style.marginRight='';this._layoutStage();}
      return;
    }
    const w=Math.min(Math.floor(regR.width),Math.floor(target*da));
    if(wrap.style.height===target+'px'&&wrap.style.width===w+'px')return; // settled
    wrap.style.height=target+'px';
    wrap.style.width=w+'px';
    wrap.style.marginLeft='auto';wrap.style.marginRight='auto'; // centre — side bars show the card background
    this._layoutStage();
  }

  _layoutStage(){
    if(!this.shadowRoot)return;
    const content=this.shadowRoot.querySelector('.content');
    const wrap=this.shadowRoot.querySelector('.wrap');
    if(!content||!wrap)return;
    const c=this._roomCfg||this._config;if(!c)return;
    const prof=this._vt||'landscape';
    // Design aspect: lock_aspect wins (explicit / auto from image), else aspect_ratio.
    const da=this._designAspect()||rocRatio(tVal(c.aspect_ratio,prof))||16/9;
    const fit=(tVal(c.image_fit,prof)==='contain')?'contain':'cover';
    if(wrap.style.aspectRatio){ // intrinsic (auto-row) image box follows the design aspect
      const _as=da.toFixed(4);
      if(wrap.style.aspectRatio!==_as)wrap.style.aspectRatio=_as;
    }
    // offsetWidth/offsetHeight, NOT getBoundingClientRect(): the latter reports
    // the PAINTED (post-transform/zoom) size, which for a scaled-down
    // nav.live:full mini is smaller than the size its own CSS (%, aspect-ratio)
    // actually lays out at — pinning .content from that shrunk rect corrupts
    // every %-positioned child inside it (gauges, badges, icons…). offset*
    // always reports the true CSS layout box, immune to any ancestor visual
    // transform, so this stays correct regardless of how (or whether) a mini
    // is being scaled down for its thumbnail.
    const r={width:wrap.offsetWidth,height:wrap.offsetHeight};
    if(!(r.width>0)||!(r.height>0))return;
    const key=Math.round(r.width)+'x'+Math.round(r.height)+':'+da.toFixed(4)+':'+fit;
    if(content.dataset.rocStage===key)return; // unchanged
    const st=(fit==='contain'?containStage:coverStage)(r.width,r.height,da);
    if(!st)return;
    content.style.position='absolute';content.style.inset='auto';
    content.style.width=st.w+'px';content.style.height=st.h+'px';
    content.style.left=st.left+'px';content.style.top=st.top+'px';
    content.dataset.rocStage=key;
  }

  // Viewport-mode root height: measure the card's real top offset (header +
  // view padding + safe-area) and pin the height in px; the CSS calc() set at
  // render is only the first-paint fallback. Re-run on window resize.
  // Best-effort: HA appends its own per-card "actions" bar (Edit / Move to
  // view / …) as a REAL sibling after the card while the dashboard is being
  // edited (hui-card-options > ha-card.type-panel > .card-actions), not an
  // overlay — so a card pinned to the exact viewport bottom pushes that bar
  // below the fold. HA marks edit mode with an 'edit-mode' class on an
  // ancestor; walk up to detect it, then measure the actions bar's REAL
  // rendered height (never hardcoded) so we can reserve exactly that much
  // room. This reaches into HA's internal, non-public, version-specific DOM
  // (verified live 2026-07) — any miss/throw just returns 0, i.e. today's
  // behaviour, never a hard failure.
  _editBarHeight(){
    try{
      let node=this,guard=0,inEdit=false;
      while(node&&guard++<12){
        if(node.classList&&node.classList.contains('edit-mode')){inEdit=true;break;}
        node=node.parentElement||(node.getRootNode&&node.getRootNode()&&node.getRootNode().host)||null;
      }
      if(!inEdit)return 0;
      node=this;guard=0;
      while(node&&guard++<12){
        // Current HA: the actions bar lives in hui-card-options' shadowRoot.
        // Reserve = the bar block's OWN height + vertical margins — never a
        // position difference against our card, which would be circular (it
        // measures a layout our own height just changed). Verified live 2026-07.
        if(node.tagName==='HUI-CARD-OPTIONS'&&node.shadowRoot){
          const bar=node.shadowRoot.querySelector('.card-actions');
          if(bar){
            const br=bar.getBoundingClientRect();
            if(br.height>0){
              const bcs=(node.ownerDocument.defaultView||window).getComputedStyle(bar);
              return Math.ceil(br.height+(parseFloat(bcs.marginTop)||0)+(parseFloat(bcs.marginBottom)||0));
            }
          }
        }
        // Legacy HA: hui-card-options > ha-card.type-panel > .card-actions
        const host=node.getRootNode&&node.getRootNode()&&node.getRootNode().host;
        if(host&&host.tagName==='HA-CARD'&&host.shadowRoot){
          const bar=host.shadowRoot.querySelector('.card-actions');
          if(bar){const rr=bar.getBoundingClientRect();if(rr.height>0)return Math.ceil(rr.height);}
        }
        node=node.parentElement||host||null;
      }
    }catch(_){}
    return 0;
  }

  // ---- Root-height pin: trigger inventory --------------------------------
  // Every hook that can ask for a re-pin goes through _requestPin(reason).
  // Direct _layoutRootHeight() calls are reserved for first paint (sync, no
  // flash). The inventory — WHY each hook exists (v5.0 consolidation):
  //   render tail          first paint (direct, sync)
  //   +250ms after render  fonts/images settle — NOT a DOM mutation
  //   _scRo (scroller RO)  header settling, edit toolbars resize the scroller
  //   _bodyRo (body RO)    exotic embeds where the page itself scrolls
  //   window resize        window/profile changes
  //   _pvMo (MO)           edit ENTER/EXIT — hui-panel-view/-card-options
  //                        shadow trees are the ONLY observable truth (no
  //                        event, no resize, no dis/connect — verified live)
  //   _watchEditBar (MO)   actions bar mounting later than the transition
  //   location-changed     HA client-side navigation (view switch, back/fwd)
  //   1s piggyback         last-resort safety on state updates (early-outs)
  //   connectedCallback    HA moved the card (view switch) — full rewire
  // Coalescing: any number of requests inside one task collapse into ONE
  // recalc on the next microtask (background-tab safe — NEVER rAF here).
  _requestPin(reason){
    if(window.ROC_DEBUG)try{console.debug('[roc] pin request:',reason);}catch(_){}
    if(this._pinQueued)return;
    this._pinQueued=true;
    const self=this;
    const mt=typeof queueMicrotask==='function'?queueMicrotask:function(f){Promise.resolve().then(f);};
    mt(function(){
      self._pinQueued=false;
      if(!self._rendered)return;
      try{self._layoutRootHeight();}catch(_){}
    });
  }

  // Nearest scrollable ancestor across shadow boundaries — HA's view scroller
  // (falls back to documentElement). Cached per instance; HA recreates the
  // card whenever it rebuilds the surrounding DOM (view switch, edit toggle),
  // so a fresh card always re-resolves. _render() also clears the cache.
  _scrollParent(){
    if(this._scrollEl&&this._scrollEl.isConnected)return this._scrollEl;
    let node=this,guard=0;
    while(node&&guard++<40){
      if(node.nodeType===1&&node!==this){
        try{
          const cs=(node.ownerDocument.defaultView||window).getComputedStyle(node);
          const oy=cs.overflowY;
          if((oy==='auto'||oy==='scroll'||oy==='overlay')&&node.clientHeight>0){this._scWasEl=true;return(this._scrollEl=node);}
        }catch(_){}
      }
      node=node.parentElement||(node.getRootNode&&node.getRootNode()&&node.getRootNode().host)||null;
    }
    // Degradation notice: a dashboard that once resolved a real scroller and
    // suddenly doesn't points at an HA internal-DOM change — say so ONCE
    // instead of silently falling back (behaviour still degrades gracefully).
    if(this._scWasEl&&!this._scDegraded){this._scDegraded=true;try{console.debug('[room-overlay-card] scroll container no longer resolves — falling back to documentElement (HA DOM change?)');}catch(_){}}
    return(this._scrollEl=document.documentElement);
  }

  _layoutRootHeight(){
    if(!this.shadowRoot||!this._config)return;
    const c=this._roomCfg||this._config;
    if(c._roc_ghost||c._roc_preview||c._roc_mini)return;
    if(((this._config.layout&&this._config.layout.height)||'viewport')!=='viewport')return;
    if(this._profile==='portrait')return; // natural content height — nothing to pin
    const card=this.shadowRoot.querySelector('ha-card');
    if(!card)return;
    const r=this.getBoundingClientRect();
    if(!(r.width>0))return; // display:none / not laid out yet
    // Scroll-INDEPENDENT top offset: distance from the scroller's content top
    // (rect diff + current scrollTop), not from the viewport. The old
    // viewport-relative math bailed whenever the page was scrolled (r.top<0)
    // — and a card pinned too tall causes exactly that scroll, so one bad pin
    // could never self-heal. Container math stays valid scrolled, in edit
    // mode, and while HA's header settles.
    const sc=this._scrollParent();
    const _winSc=sc===document.documentElement||sc===document.body;
    let avail,top;
    // visualViewport (when available) tracks mobile dynamic toolbars that
    // window.innerHeight misses; identical on desktop.
    if(_winSc){avail=(window.visualViewport&&window.visualViewport.height)||window.innerHeight||0;top=r.top+(window.scrollY||0);}
    else{const cr=sc.getBoundingClientRect();avail=sc.clientHeight;top=r.top-cr.top+sc.scrollTop-(sc.clientTop||0);}
    if(!(avail>0))return;
    top=Math.max(0,top);
    // floor (not round): a fraction of a px short never scrolls, a fraction
    // over always does (sub-pixel rounding measured live).
    let h=Math.floor(avail-top)-this._editBarHeight();
    h=Math.max(200,h);
    // Steady-state early out: raw height unchanged, nothing was absorbed last
    // time AND nothing overflows now. An ABSORBED height must NOT early-out on
    // "raw unchanged" alone — the overflow it reacted to may be gone (e.g. it
    // was a transient), and the card would stay stuck short forever.
    const ovPre=_winSc?(document.documentElement.scrollHeight-(window.innerHeight||0)):(sc.scrollHeight-sc.clientHeight);
    if(Math.abs(h-(this._rootHRaw||0))<=1&&this._rootHPx===this._rootHRaw&&ovPre<=1)return;
    this._rootHRaw=h;
    card.style.height=h+'px'; // full (raw) height first, then measure what overflows
    // Residual-overflow absorption: view wrappers add bottom padding (and HA
    // may stack small siblings — e.g. the edit-mode card-actions bar) BELOW
    // the card inside the scroller — invisible to any top-offset math.
    // Measure what actually overflows after pinning and absorb it, capped at
    // 160px so a genuinely tall page (user content below the card) keeps its
    // scrollbar instead of crushing the card. Both writes happen in the same
    // task, so no intermediate paint.
    const ov=_winSc?(document.documentElement.scrollHeight-(window.innerHeight||0)):(sc.scrollHeight-sc.clientHeight);
    if(ov>1&&ov<=160)h=Math.max(200,h-Math.ceil(ov));
    this._rootHPx=h;
    card.dataset.rocH=String(h);
    if(card.style.height!==h+'px')card.style.height=h+'px';
    if(window.ROC_DEBUG)try{console.debug('[roc] pin:',{scroller:sc.tagName+(sc.id?'#'+sc.id:''),winSc:_winSc,avail:avail,top:top,editBar:this._editBarHeight(),raw:this._rootHRaw,pinned:h,absorbed:this._rootHRaw-h});}catch(_){}
    this._layoutFitWrap();
    this._layoutStage();
    // (v5.0) The 300ms "self-heal" re-check that used to live here is gone:
    // it existed for transient rects during HA's edit-mode DOM shuffles,
    // which the _pvMo MutationObserver now catches deterministically.
  }

  // All layout observers & listeners in one place — called from _render AND
  // from connectedCallback. HA MOVES the card element when toggling dashboard
  // edit mode (it gets wrapped into / unwrapped from hui-card-options), which
  // fires disconnectedCallback → all observers are disconnected and nulled.
  // The old connectedCallback "re-attach" used `if(this._ro)this._ro.observe()`
  // — dead code after the nulling — so a card that went through an edit-mode
  // toggle had NO layout triggers left and stayed mis-sized until a state
  // update or swipe happened to re-render it. Recreating everything here on
  // every (re)connect is cheap and makes the edit transitions self-correcting.
  _wireLayoutObservers(){
    const self=this;
    // Restricted instances (swipe ghost / editor preview / nav.live:full mini,
    // §3 of NAV_LIVE_FULL_PLAN.md) are never a top-level HA dashboard card — they
    // have no meaningful scroller/body/hui-panel-view relationship of their own
    // (a MutationObserver walk from deep inside a thumbnail resolves the SAME
    // ancestors the OUTER card already watches, so one per mini would just be a
    // duplicate observer on a node someone else already owns). They still get
    // their OWN box + wrap-box resize handling below (image aspect-fit; needed
    // even at thumbnail scale) — only the viewport-pin machinery is skipped.
    const _rc=this._roomCfg||this._config;
    const _restricted=!!(_rc&&(_rc._roc_ghost||_rc._roc_preview||_rc._roc_mini));
    if(window.ResizeObserver){
      if(this._ro)this._ro.disconnect();
      this._ro=new ResizeObserver(function(){if(self._rendered){self._layoutFitWrap();self._layoutStage();if(self._hass&&self._visible)self._update();}});
      this._ro.observe(this);
      // The image region's height changes independently of the card (grid %),
      // so the cover-stage watches its own box too.
      if(this._wrapRo)this._wrapRo.disconnect();
      const _wEl=this.shadowRoot?this.shadowRoot.querySelector('.wrap'):null;
      if(_wEl){this._wrapRo=new ResizeObserver(function(){if(self._rendered)self._layoutStage();});this._wrapRo.observe(_wEl);}
      // Root-height pin (viewport mode): watch the SCROLLER's own box. HA
      // keeps document.body at a fixed height (the app scrolls inside), so a
      // body observer misses header settling and edit-mode toolbars entirely
      // — but both change the scroll container's box, which this catches.
      // body stays observed too as a fallback for exotic embeds where the
      // page itself scrolls. Restricted instances never pin a viewport height
      // (_layoutRootHeight already no-ops for them) — skip creating these.
      if(this._scRo){this._scRo.disconnect();this._scRo=null;}
      if(this._bodyRo){this._bodyRo.disconnect();this._bodyRo=null;}
      if(!_restricted){
        this._scrollEl=null; // re-resolve on every (re)wire (edit toggle rebuilds HA's DOM)
        const _scEl=this._scrollParent();
        if(_scEl&&_scEl.nodeType===1){
          this._scRo=new ResizeObserver(function(){self._requestPin('scroller-resize');});
          this._scRo.observe(_scEl);
        }
        if(document.body){
          this._bodyRo=new ResizeObserver(function(){self._requestPin('body-resize');});
          this._bodyRo.observe(document.body);
        }
      }
    }
    if(!this._winHandler){this._winHandler=this._onWinResize.bind(this);window.addEventListener('resize',this._winHandler);}
    // 'location-changed' catches HA client-side navigations (view switches,
    // back/forward). Verified live: the edit-mode toggle does NOT fire it and
    // does NOT move the card element either (no dis/connect) — it only
    // rebuilds hui-panel-view's shadow tree around us. So this listener is a
    // helper for navigations, while the panel-view MutationObserver below is
    // THE deterministic edit ENTER/EXIT hook. Double-rAF lets HA finish its
    // DOM shuffle before measuring. Restricted instances are never themselves
    // navigated to/from — skip.
    if(this._locHandler){window.removeEventListener('location-changed',this._locHandler);window.removeEventListener('popstate',this._locHandler);this._locHandler=null;}
    if(!_restricted&&!this._locHandler){
      // setTimeout(0), NOT rAF — rAF never fires in background tabs (kiosk
      // dashboards!) or during HA view transitions; a 0-delay task runs the
      // moment the current work (HA's navigation handling) is done.
      this._locHandler=function(){setTimeout(function(){
        if(!self._rendered)return;
        self._requestPin('location-changed');
        self._watchEditBar();
      },0);};
      window.addEventListener('location-changed',this._locHandler);
      window.addEventListener('popstate',this._locHandler);
    }
    // Edit ENTER/EXIT: watch the trees that HA actually mutates. Verified
    // live: the toggle fires NO window event and does NOT even dis/connect
    // the card element (HA moves it atomically) — the only observable truth
    // is the DOM around us: hui-panel-view's shadow tree gains/loses the
    // hui-card-options wrapper, and the actions bar mounts inside
    // hui-card-options' OWN shadowRoot (a separate tree). Watch both; after
    // a structural change re-adopt the (possibly new) wrapper's shadow.
    // Neither tree ever contains our own DOM (that lives in OUR shadow root,
    // and slotted light content stays in the light tree), so these observers
    // are silent except on real HA transitions. No polling, no timers.
    // Restricted instances skip this entirely — see note at the top of this
    // method: the ancestor walk from deep inside a nested instance resolves
    // the OUTER card's own hui-panel-view, which the outer card already
    // watches — a restricted instance adding its own observer on the same
    // node would be pure duplication, not a second real hook.
    if(this._pvMo){this._pvMo.disconnect();this._pvMo=null;}
    if(!_restricted&&window.MutationObserver){
      let _pv=null,_opts=null,_n=this,_g=0;
      while(_n&&_g++<12){
        const _tg=_n.tagName;
        if(_tg==='HUI-CARD-OPTIONS')_opts=_n;
        if(_tg==='HUI-PANEL-VIEW'||_tg==='HUI-VIEW'){_pv=_n;break;}
        _n=_n.parentElement||(_n.getRootNode&&_n.getRootNode()&&_n.getRootNode().host)||null;
      }
      if(!_pv&&this._pvWasFound&&!this._pvDegraded){this._pvDegraded=true;try{console.debug('[room-overlay-card] hui-panel-view/hui-view ancestor no longer resolves — edit-mode transition observer inactive (HA DOM change?)');}catch(_){}}
      if(_pv){
        this._pvWasFound=true;
        // SYNCHRONOUS handler — deliberately no requestAnimationFrame:
        // MutationObserver callbacks already run AFTER the mutating task
        // finished (the DOM is settled), and rAF never fires in background
        // tabs / during HA view transitions (verified live: the queued rAF
        // pin silently never ran). The pin early-outs when nothing changed.
        const mo=this._pvMo=new MutationObserver(function(){
          if(!self._rendered)return;
          self._requestPin('edit-transition');
          // the structure may have brought a NEW hui-card-options — adopt
          // its shadowRoot too (the actions bar mounts there, a separate
          // tree; re-observing an observed target is a cheap no-op)
          let o=null,m=self,gg=0;
          while(m&&gg++<12){if(m.tagName==='HUI-CARD-OPTIONS'){o=m;break;}m=m.parentElement||(m.getRootNode&&m.getRootNode()&&m.getRootNode().host)||null;}
          if(o&&o.shadowRoot)try{mo.observe(o.shadowRoot,{childList:true,subtree:true});}catch(_){}
        });
        if(_pv.shadowRoot)mo.observe(_pv.shadowRoot,{childList:true,subtree:true});
        mo.observe(_pv,{childList:true});
        if(_opts&&_opts.shadowRoot)mo.observe(_opts.shadowRoot,{childList:true,subtree:true});
      }
    }
  }

  // One-shot MutationObserver: on edit ENTER the hui-card-options actions bar
  // can mount AFTER our re-pin measured (editBar=0). Watch the wrapper's
  // shadowRoot until '.card-actions' exists, re-pin, disconnect. Event-driven,
  // self-terminating — no timers.
  _watchEditBar(){
    if(this._barMo){this._barMo.disconnect();this._barMo=null;}
    let node=this,guard=0,opts=null;
    while(node&&guard++<12){
      if(node.tagName==='HUI-CARD-OPTIONS'){opts=node;break;}
      node=node.parentElement||(node.getRootNode&&node.getRootNode()&&node.getRootNode().host)||null;
    }
    if(!opts||!opts.shadowRoot)return;
    if(opts.shadowRoot.querySelector('.card-actions'))return; // already there — measured by the caller
    const self=this;
    this._barMo=new MutationObserver(function(){
      if(opts.shadowRoot.querySelector('.card-actions')){
        self._barMo.disconnect();self._barMo=null;
        self._requestPin('edit-bar-mounted');
      }
    });
    this._barMo.observe(opts.shadowRoot,{childList:true,subtree:true});
  }

  _onWinResize(){
    if(!this._config||!this._rendered)return;
    let p=rocProfile(this._config,window.innerWidth||0,window.innerHeight||0);
    const c=this._roomCfg||this._config;
    if((c.test_mode??false)&&this._profFlipped)p=(p==='portrait')?'landscape':'portrait';
    if(p!==this._profile){this._rendered=false;this._render();return;}
    this._requestPin('window-resize');this._layoutFitWrap();this._layoutStage();
  }

  _render(){
    if(!this._config)return;
    const _gen=++this._renderGen; // stale async mounts (card helpers) bail via this
    const cAll=this._config;
    // URL deep-link: the first render honours #<key>=<room> (opt-in via url_sync);
    // otherwise reflect the starting room so the URL is immediately bookmarkable.
    if(!this._hashInit){
      this._hashInit=true;
      const _hi=this._roomIdxFromHash();
      if(_hi>=0){this._roomIdx=_hi;this._manualHoldUntil=Date.now()+((cAll.follow_hold??60)*1000);}
      else this._writeRoomHash(this._roomIdx);
    }
    const c=roomMerge(cAll,this._roomIdx); // active room view (or plain config)
    this._roomCfg=c;
    this._zoomScale=1;this._wrapTA='';
    const tm=c.test_mode??false;
    // Active layout profile — by the AVAILABLE VIEWPORT shape (w/h ratio), not
    // by device type. Test mode can force the other profile via the ⇅ button.
    let _rt=rocProfile(cAll,window.innerWidth||0,window.innerHeight||0);
    if(tm&&this._profFlipped)_rt=(_rt==='portrait')?'landscape':'portrait';
    const _tier=tm?null:_rt; // element profile-overrides are off in test mode (so dragging edits the base profile)
    this._tier=_tier;
    const _vt=_rt; // per-profile SCALARS follow the real profile even in test mode
    this._vt=_vt;this._profile=_rt;
    // Swipe ghosts AND nav.live:full minis (§3 NAV_LIVE_FULL_PLAN.md) both want the
    // collapsed image-only grid below — a mini is a persistent restricted
    // instance, not a <0.5s ghost, but shares the same "just render the room
    // picture" grid shape. Height behaviour DIFFERS from a ghost though (see
    // _isMini/_rootH below): a ghost stretches to fill an externally-dictated
    // box (the swipe container, already sized to match the real card); a mini
    // renders at a fixed reference WIDTH with its own aspect-derived height,
    // then gets scaled as a whole to fit its thumbnail (NAV_LIVE_FULL_PLAN.md
    // §6) — stretching it to an arbitrary thumb height would distort it.
    // Camera/template skipping stays gated on the literal c._roc_ghost checks
    // elsewhere (unaffected by this) — minis opt into those via nav.mini.*.
    const _isGhost=!!c._roc_ghost;
    const _isMini=!!c._roc_mini;
    // Grid definition for the active profile (swipe ghosts + minis render the image region only)
    const _lp=(_isGhost||_isMini)?{columns:[100],rows:[100],place:{image:{row:1,col:1}}}
      :(rocProfileDef(cAll,_rt)||{columns:[100],rows:[100],place:{image:{row:1,col:1}}});
    this._lp=_lp;
    const _arResolved=tVal(c.aspect_ratio,_vt)||'16/9';
    const br=(tVal(c.border_radius,_vt)??'12px');
    // Root height: viewport (default) | container | fixed CSS length. Ghosts and
    // editor previews fill/fix their host instead of the viewport.
    const _lhRaw=(cAll.layout&&cAll.layout.height)||'viewport';
    // Portrait, default 'viewport' mode: size from CONTENT (width is the real
    // limiting factor in portrait), not a forced full-screen pin — force-
    // filling the leftover vertical space just stretches every region
    // proportionally past what it actually needs. Landscape (the kiosk/wall-
    // tablet use case) keeps the viewport-fill goal. An explicit
    // layout.height (container/fixed) always wins, in either profile.
    const _naturalRoot=!_isGhost&&!_isMini&&!c._roc_preview&&_rt==='portrait'&&_lhRaw==='viewport';
    let _rootH;
    if(_isGhost)_rootH='100%';
    else if(_isMini)_rootH='auto';       // aspect-derived, via _wrapAspect below — never stretched
    else if(c._roc_preview)_rootH='auto';  // aspect-derived, via _wrapAspect below — was a guessed fixed 420px, left blank space under shorter content
    else if(_naturalRoot)_rootH='auto';
    else if(_lhRaw==='viewport')_rootH=this._rootHPx?this._rootHPx+'px':'calc(100svh - var(--header-height,56px))'; // pinned px survives re-renders (room switch); CSS calc is first-paint only, refined by _layoutRootHeight()
    else if(_lhRaw==='container')_rootH='100%';
    else _rootH=(typeof _lhRaw==='number')?_lhRaw+'px':String(_lhRaw);
    // ---- Multi-room navigation strip -------------------------------------
    let navHtml='';
    const navCfg=cAll.nav||{};
    const navStyle=Array.isArray(cAll.rooms)&&cAll.rooms.length>1?(navCfg.style||'thumbnails'):'none';
    // nav.live: 'full' — persistent live mini <room-overlay-card> per thumbnail
    // (NAV_LIVE_FULL_PLAN.md). Only meaningful for thumbnails; tabs/dots have
    // no image box to host one.
    const _navLiveReal=navStyle==='thumbnails'&&(navCfg.live==='full'||navCfg.live==='custom');
    // position: top | bottom | left | right | auto (auto = side rail on wide cards)
    let navPos=navCfg.position||'top';
    if(navPos==='auto')navPos='top'; // v4: position only orients the strip; placement comes from the layout grid
    if(navStyle==='none')navPos='top';
    this._navPos=navPos;
    const _navSide=navPos==='left'||navPos==='right';
    if(navStyle!=='none'){
      const nh=navCfg.height||'64px';
      const _nr=rocRatio(tVal(c.aspect_ratio,_vt))||16/9;
      const navSelfIdx=this._roomIdx;
      // nav.width: css size | 'auto' (stretch items across the available strip)
      const nwRaw=navCfg.width;
      const _thDerived='calc('+nh+' * '+_nr.toFixed(3)+')';
      let _thFlex;
      // 'auto' stretches items in horizontal strips; a vertical side rail has no
      // intrinsic width to stretch into, so it falls back to the derived width
      if(nwRaw==='auto')_thFlex=_navSide?('flex:none;width:'+_thDerived+';'):'flex:1 1 0;min-width:0;';
      else _thFlex='flex:none;width:'+(nwRaw||_thDerived)+';';
      // Mobile: wrap the strip — all thumbnails shrink onto row 1 (keeping
      // aspect via aspect-ratio), custom cards + follow button wrap to row 2
      const _navMob=!_navSide&&_rt==='portrait';
      if(_navMob)_thFlex='flex:1 1 0;min-width:0;';
      // Mobile thumbs: fixed (shorter) height so both chips fit; image crops to cover
      const _thSize='height:'+(_navMob?(navCfg.mobile_height||'48px'):nh)+';';
      const _navBreak=_navMob?'<div style="flex-basis:100%;height:0;"></div>':'';
      const _tabFlex=(nwRaw==='auto'&&!_navSide)?'flex:1 1 0;min-width:0;justify-content:center;':'flex:none;';
      // nav.cards: arbitrary HA cards inside the strip ({width, card, placement} or plain card config)
      const _navCardOne=function(cc,ci){
        const w=cc&&cc.width;
        const sz=_navSide
          ?('width:100%;'+(w?'height:'+w+';':'min-height:'+nh+';'))
          :('height:'+nh+';'+(w?'flex:none;width:'+w+';':(_navMob?'flex:1 1 0;min-width:0;':'flex:1 1 auto;min-width:140px;')));
        return'<div data-nav-card="'+ci+'" style="'+sz+'overflow:hidden;border-radius:6px;position:relative;"></div>';
      };
      const _navCardsStart=(navCfg.cards||[]).map(function(cc,ci){return cc&&cc.placement==='start'?_navCardOne(cc,ci):'';}).join('');
      const _navCardsEnd=(navCfg.cards||[]).map(function(cc,ci){return cc&&cc.placement==='start'?'':_navCardOne(cc,ci);}).join('');
      // Follow button — only when THIS device resolves room_entity to a real,
      // existing presence sensor (by_browser → by_user → default). Devices with
      // no usable presence source (e.g. a phone not in the mapping) don't show it.
      const _fbEnt=this._followBtnEntity();
      const _fbHtml=(navCfg.follow_button!==false&&_fbEnt&&this._hass&&this._hass.states[_fbEnt])
        ?'<button data-nav-follow title="Jump to my room (presence)" style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--divider-color,#555);background:none;color:var(--primary-text-color,#fff);cursor:pointer;"><ha-icon icon="mdi:crosshairs-gps" style="--mdc-icon-size:18px;"></ha-icon></button>'
        :'';
      navHtml='<div class="roc-nav" style="display:flex;box-sizing:border-box;'+(_navSide?'flex-direction:column;overflow-y:auto;overflow-x:hidden;height:100%;':(_navMob?'flex-wrap:wrap;':'overflow-x:auto;'))+'gap:6px;padding:6px;align-items:center;scrollbar-width:thin;">'
        +_navCardsStart
        +cAll.rooms.map(function(r,ri){
          const act=ri===navSelfIdx;
          if(navStyle==='dots')
            return'<button data-nav-room="'+ri+'" aria-label="'+escA(r.name||r.id)+'" style="width:10px;height:10px;border-radius:50%;border:none;cursor:pointer;background:'+(act?'var(--primary-color,#03a9f4)':'var(--divider-color,#666)')+';padding:0;flex:none;"></button>';
          if(navStyle==='tabs')
            return'<button data-nav-room="'+ri+'" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:16px;border:1px solid '+(act?'var(--primary-color,#03a9f4)':'var(--divider-color,#444)')+';cursor:pointer;background:'+(act?'rgba(3,169,244,0.15)':'none')+';color:var(--primary-text-color,#fff);font-size:12px;'+_tabFlex+'">'+(r.icon?'<ha-icon icon="'+escA(r.icon)+'" style="--mdc-icon-size:16px;"></ha-icon>':'')+escA(r.name||r.id||'')+'</button>';
          // thumbnails — live mini-render: base image + filter + sensor chips
          return'<div class="roc-thumb" data-nav-room="'+ri+'" data-thumb="'+ri+'" tabindex="0" role="button" aria-label="'+escA(r.name||r.id)+'" style="position:relative;'+_thSize+_thFlex+'border-radius:6px;overflow:hidden;cursor:pointer;background-size:cover;background-position:center;'+(_navLiveReal?'':(r.base_image?'background-image:url(\''+escA(escUrl(r.base_image))+'\');':''))+'border:2px solid '+(act?'var(--primary-color,#03a9f4)':'transparent')+';box-sizing:border-box;transition:border-color .2s ease,filter 1.5s ease;">'
            +(_navLiveReal?'<div data-thumb-mini="'+ri+'" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;"></div>':'')
            +'<div data-thumb-chips="'+ri+'" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;padding:3px 5px;pointer-events:none;font-family:monospace;font-weight:bold;font-size:11px;text-shadow:0 1px 2px rgba(0,0,0,0.9);color:#fff;"></div></div>';
        }).join('')+_navBreak+_navCardsEnd+_fbHtml+'</div>';
    }

    // Inicializace group state — zachovat existující stav, přidat nové skupiny
    const _prevGS=this._groupState||{};
    this._groupState={};
    for(const g of(c.groups||[])){
      this._groupState[g.id]=g.id in _prevGS?_prevGS[g.id]:(g.visible??false);
    }
    // Reset handlers/timers/subscriptions from previous render
    if(this._tmKeyHandler){document.removeEventListener('keydown',this._tmKeyHandler);this._tmKeyHandler=null;}
    if(this._hlHandler){window.removeEventListener('roc-highlight',this._hlHandler);this._hlHandler=null;}
    if(this._camTimer){clearInterval(this._camTimer);this._camTimer=null;}
    if(this._relTimer){clearInterval(this._relTimer);this._relTimer=null;}
    if(this._orientHandler){window.removeEventListener('deviceorientation',this._orientHandler);this._orientHandler=null;}
    if(this._hashHandler){window.removeEventListener('hashchange',this._hashHandler);this._hashHandler=null;}
    this._teardownTemplates();
    this._selectedTM=null;
    // URL deep-link: follow back/forward navigation and external hash edits
    if(this._urlSyncKey()&&Array.isArray(cAll.rooms)&&cAll.rooms.length>1){
      const _hashSelf=this;
      this._hashHandler=function(){
        if(_hashSelf._hashMuted)return;
        const hi=_hashSelf._roomIdxFromHash();
        if(hi>=0&&hi!==_hashSelf._roomIdx)_hashSelf._switchRoom(hi,0,true);
      };
      window.addEventListener('hashchange',this._hashHandler);
    }

    const ovHtml=(c.overlays||[]).map((ov,i)=>`<div class="layer ov" data-ov="${escA(ov.id)}" style="z-index:${ov.z_index??i+1};opacity:0;transition:opacity ${ov.transition??'2s ease'},filter ${ov.transition??'2s ease'};"></div>`).join('');
    const zHtml=(c.zones||[]).map(z0=>{const z=tApply(z0,_tier);const act=z.tap_action||z.hold_action||z.double_tap_action||z.slider;const a11y=act?` tabindex="0" role="button" aria-label="${escA(z.id)}"`:'';return`<div class="zone" data-z="${escA(z.id)}"${a11y} style="top:${z.top};left:${z.left};width:${z.width};height:${z.height};z-index:50;cursor:${act?'pointer':'default'};box-sizing:border-box;-webkit-tap-highlight-color:transparent;${tm?'outline:3px solid red;background:rgba(255,0,0,0.08);':''}" title="${tm?escA(`[${z.id}] ${z.top} ${z.left} ${z.width}x${z.height}`):''}">${tm?`<span class="zlabel">${escA(z.id)}</span>`:''}</div>`;}).join('');
    const bHtml=(c.badges||[]).map(b=>{let animSt='';if(b.animation==='blink')animSt='animation:roc-blink 1s step-end infinite;';else if(b.animation==='pulse'){if(b.animation_color)animSt='--roc-ac:'+b.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else animSt='animation:roc-pulse 2s ease-in-out infinite;';}return'<div class="badge" data-b="'+escA(b.id)+'" style="'+makeBadgePos(tApply(b,_tier))+';cursor:'+(b.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;'+animSt+'">'+(b.icon?'<ha-icon data-bi="'+escA(b.id)+'" icon="'+escA(b.icon)+'" style="color:white;--mdc-icon-size:14px;width:14px;height:14px;display:flex;"></ha-icon>':'')+(b.label!==undefined?'<span class="blabel" data-bl="'+escA(b.id)+'"></span>':'')+'</div>';}).join('');
    const _cardW=this.offsetWidth||300;
    const icoHtml=(c.icons||[]).map(ico0=>{const ico=tApply(ico0,_tier);const sz=resolveSize(ico.size||'20px',_cardW);const _ibg=ico.background?'background:'+ico.background+';border-radius:50%;padding:7px;box-sizing:content-box;':'';const a11y=ico.tap_action?' tabindex="0" role="button" aria-label="'+escA(ico.id)+'"':'';return'<div class="ico" data-ico="'+escA(ico.id)+'"'+a11y+' style="position:absolute;top:'+ico.top+';left:'+ico.left+';z-index:'+(ico.z_index??6)+';cursor:'+(ico.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;'+_ibg+'"><ha-icon data-icoicon="'+escA(ico.id)+'" icon="'+escA(ico.icon||'')+'" style="--mdc-icon-size:'+sz+';width:'+sz+';height:'+sz+';display:flex;color:var(--roc-icon-color,#fff);pointer-events:none;"></ha-icon></div>';}).join('');

    const lblHtml=(c.labels||[]).map(lbl0=>{const lbl=tApply(lbl0,_tier);const fs=resolveSize(lbl.font_size,_cardW)||'clamp(8px,0.8vw,13px)';const ff=lbl.font_family||'monospace';const fw=lbl.font_weight||'bold';const bg=lbl.background||'';const pad=lbl.padding||'';const br=lbl.border_radius||'';const ts=lbl.text_shadow!==undefined?lbl.text_shadow:'0 1px 3px rgba(0,0,0,0.8)';let st='position:absolute;top:'+lbl.top+';left:'+lbl.left+';z-index:'+(lbl.z_index??6)+';pointer-events:none;font-size:'+fs+';font-family:'+ff+';font-weight:'+fw+';white-space:nowrap;color:var(--roc-label-color,#fff);';if(bg)st+='background:'+bg+';';if(pad)st+='padding:'+pad+';';if(br)st+='border-radius:'+br+';';if(ts)st+='text-shadow:'+ts+';';if(lbl.animation==='blink')st+='animation:roc-blink 1s step-end infinite;';else if(lbl.animation==='pulse'){if(lbl.animation_color)st+='--roc-ac:'+lbl.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else st+='animation:roc-pulse 2s ease-in-out infinite;';}return'<div class="lbl" data-lbl="'+escA(lbl.id)+'" style="'+st+'"></div>';}).join('');
    const grpHtml=(c.groups||[]).filter(g=>g.style).map(g=>{const st=g.style;const vis=this._groupState[g.id]??false;return'<div data-grp-panel="'+escA(g.id)+'" style="position:absolute;top:'+(st.top||'0')+';left:'+(st.left||'0')+';width:'+(st.width||'auto')+';height:'+(st.height||'auto')+';z-index:'+(st.z_index||49)+';background:'+(st.background||'transparent')+';border-radius:'+(st.border_radius||'0')+';pointer-events:none;transition:opacity .25s ease,visibility .25s ease;visibility:'+(vis?'visible':'hidden')+';opacity:'+(vis?'1':'0')+';"></div>';}).join('');
    const _wx=c.weather_overlay?(typeof c.weather_overlay==='string'?{entity:c.weather_overlay}:c.weather_overlay):null;
    const wxHtml=_wx?'<div class="layer wx" data-wx style="z-index:'+(_wx.z_index??5)+';opacity:0;"></div>':'';
    // Per-room companion strips above/below the image (normal document flow —
    // mobile friendly). Entry: plain card config or {card, height, media: all|mobile|desktop}
    // media: all | mobile | desktop (legacy = any non-mobile) | tier list (e.g. "tablet,ultrawide")
    const _stripShow=function(media){
      if(!media||media==='all')return true;
      if(media==='mobile'||media==='portrait')return _rt==='portrait';
      if(media==='desktop'||media==='landscape')return _rt==='landscape';
      return String(media).split(',').map(function(s){return s.trim();}).indexOf(_rt)>=0;
    };
    const _stripOne=function(list,attr){
      return(list||[]).map(function(cc,ci){
        if(!_stripShow(cc&&cc.media))return'';
        return'<div '+attr+'="'+ci+'" style="'+(cc&&cc.height?'height:'+cc.height+';':'')+'overflow:visible;"></div>';
      }).join('');
    };
    const _aboveInner=_stripOne(c.cards_above,'data-above-card');
    const _belowInner=_stripOne(c.cards_below,'data-below-card');
    const _aboveHtml=_aboveInner?'<div style="display:flex;flex-direction:column;gap:6px;padding:6px 6px 0;">'+_aboveInner+'</div>':'';
    const _belowHtml=_belowInner?'<div style="display:flex;flex-direction:column;gap:6px;padding:0 6px 6px;">'+_belowInner+'</div>':'';
    // Light controls — material-slider-card strip with a lux-driven border ring.
    // Sliders mount via card helpers (below); the border colour is set from JS
    // through the card's own CSS variables — no card_mod / Jinja needed.
    this._lcCfg=c.light_controls||null;
    const _lcEnts=lcNormEnts(c.light_controls);
    const _lcCols=(c.light_controls&&c.light_controls.columns)||_lcEnts.length||1;
    const _lcHgt=lcResolveHeight(c.light_controls&&c.light_controls.height,_vt);
    const _lcBgOff=(c.light_controls&&c.light_controls.bg_off)||LC_DEF_BG;
    const _lcHtml=_lcEnts.length?'<div class="roc-lc" style="display:grid;grid-template-columns:repeat('+_lcCols+',minmax(0,1fr));gap:6px;padding:6px 6px 0;">'+_lcEnts.map(function(e,i){
      if(lcUsesSlider(e.entity))return'<div data-lc-card="'+i+'" style="min-width:0;"></div>';
      // on/off toggle pill for switch-like entities — same pill shape + lux ring
      return'<button type="button" class="roc-lctgl" data-lc-toggle="'+i+'" style="min-width:0;width:100%;height:'+_lcHgt+'px;border-radius:999px;border:2px solid transparent;background:'+escA(_lcBgOff)+';color:var(--secondary-text-color);display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;padding:0 8px;font-size:12px;line-height:1;box-sizing:border-box;transition:border-color 0.6s ease-in-out,background 0.3s ease,color 0.3s ease;overflow:hidden;">'
        +'<ha-icon data-lc-ticon icon="mdi:power" style="--mdc-icon-size:16px;flex:0 0 auto;"></ha-icon>'
        +(e.name?'<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escA(e.name)+'</span>':'')
        +'</button>';
    }).join('')+'</div>':'';

    // ---- Cover controls (roleta) — build tap-reveal overlays -------------
    // Minis strip `control:` from every blind already (rocBuildMiniConfig),
    // so _ccList would end up empty anyway — this is defense-in-depth.
    const _ccGhost=_isGhost||_isMini;
    const _ccList=_ccGhost?[]:(c.blinds||[]).map(function(b){return coverControlNorm(tApply(b,_tier),_rt);}).filter(Boolean);
    // A dock needs a placed cover region — otherwise fall back to float so the
    // controller never silently disappears.
    if(!_ccGhost&&!(_lp.place&&_lp.place.cover)){
      let _ccWarned=false;
      _ccList.forEach(function(cc){
        if(cc.placement!=='dock')return;
        cc.placement='float';
        if(!_ccWarned){_ccWarned=true;try{console.warn('[room-overlay-card] cover control placement "dock" but no cover region is placed in the '+_rt+' layout profile — falling back to float (tap-reveal)');}catch(_){}}
      });
    }
    this._ccCfgs=_ccList;
    const _ccPop=_ccList.filter(function(cc){return cc.placement==='float';}).map(function(cc){return coverCtlHtml(cc,_rt==='portrait','float');}).join('');
    const _ccDockHoriz=rocCoverHoriz(_lp);
    const _ccDockHtml=_ccList.filter(function(cc){return cc.placement==='dock';}).map(function(cc){return coverCtlHtml(cc,_ccDockHoriz,'dock');}).join('');
    this._radialMeta={};
    const _allGaugesRC=[...(c.gauges||[]).map(g=>tApply(g,_tier)),...(c.blinds||[]).map(b=>tApply(b,_tier)).flatMap(blindToGaugeConfig)];const gaugeHtml=_allGaugesRC.map(g=>{const bg=g.background||'rgba(0,0,0,0.5)';const br=g.border_radius||'4px';const _gor=g.orientation||'vertical';
    if(_gor==='radial'){
      const arc=Math.max(30,Math.min(360,g.arc??270)),r=42,circ=2*Math.PI*r,arcLen=circ*arc/360;
      const rot=90+(360-arc)/2,th=g.thickness??10;
      this._radialMeta[g.id]={arcLen:arcLen,circ:circ};
      let tgt='';
      if(g.target!==undefined){
        const mn=g.min??0,mx=g.max??100;
        const tp=Math.max(0,Math.min(1,(g.target-mn)/(mx-mn)));
        const ang=(rot+tp*arc)*Math.PI/180;
        const x1=50+(r-th/2-2)*Math.cos(ang),y1=50+(r-th/2-2)*Math.sin(ang);
        const x2=50+(r+th/2+2)*Math.cos(ang),y2=50+(r+th/2+2)*Math.sin(ang);
        tgt='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+escA(g.target_color||'#fff')+'" stroke-width="2.5" stroke-linecap="round"/>';
      }
      return'<div class="gauge gauge-radial" data-gauge="'+escA(g.id)+'" style="position:absolute;top:'+g.top+';left:'+g.left+';width:'+g.width+';height:'+g.height+';z-index:'+(g.z_index??6)+';pointer-events:none;">'
        +'<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block;overflow:visible;">'
        +'<circle cx="50" cy="50" r="'+r+'" fill="none" stroke="'+escA(bg)+'" stroke-width="'+th+'" stroke-linecap="round" stroke-dasharray="'+arcLen.toFixed(2)+' '+circ.toFixed(2)+'" transform="rotate('+rot+' 50 50)"/>'
        +'<circle class="gfill" cx="50" cy="50" r="'+r+'" fill="none" stroke="white" stroke-width="'+th+'" stroke-linecap="round" stroke-dasharray="0 '+circ.toFixed(2)+'" transform="rotate('+rot+' 50 50)" style="transition:stroke-dasharray '+(g.transition||'0.5s ease')+';"/>'
        +tgt+'</svg></div>';
    }const _ghoriz=_gor==='horizontal'||_gor==='right';const defTr=_ghoriz?'width 0.5s ease':'height 0.5s ease';const tr=g.transition||defTr;let fillSt;if(g._dayNight){const _dtr=g.transition||'height 0.5s ease';const _bgTr=_dtr.replace(/^\S+\s+/,'');fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:transparent;background-repeat:repeat;background-size:100% auto;transition:'+_dtr+',background-position-y '+_bgTr+';';}else if(_gor==='top')fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';else if(_gor==='right')fillSt='position:absolute;top:0;right:0;bottom:0;width:0%;background:white;transition:'+tr+';';else if(_gor==='horizontal')fillSt='position:absolute;top:0;left:0;bottom:0;width:0%;background:white;transition:'+tr+';';else fillSt='position:absolute;bottom:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';return'<div class="gauge" data-gauge="'+escA(g.id)+'" style="position:absolute;top:'+g.top+';left:'+g.left+';width:'+g.width+';height:'+g.height+';z-index:'+(g.z_index??6)+';pointer-events:none;background:'+bg+';border:1px solid rgba(255,255,255,0.12);border-radius:'+br+';overflow:hidden;"><div class="gfill" style="'+fillSt+'"></div></div>';}).join('');
    // ---- Layout grid: wrap every placed region ---------------------------
    const _regDiv=function(rg,inner){
      const pl=_lp.place&&_lp.place[rg];
      if(!pl)return''; // region not placed in this profile → hidden
      // Empty region (this room has no content for it) → render nothing. Rooms
      // can therefore SHARE a cell (e.g. cards_above + lights on the same row)
      // and 'auto' rows collapse to 0 where a room has no strip. Test mode still
      // shows the cell outline (non-interactive) so the grid stays visible.
      if(!inner&&!tm)return'';
      return'<div class="roc-reg" data-reg="'+rg+'" style="'+rocRegionCss(pl)+(inner?'':'pointer-events:none;')+(tm?'outline:1px dashed rgba(255,110,110,0.85);outline-offset:-1px;':'')+'">'+inner+(tm?'<div class="roc-regtag">'+rg+'</div>':'')+'</div>';
    };
    const _regInner={nav:navHtml,cards_above:_aboveHtml,lights:_lcHtml,cards_below:_belowHtml,cover:_ccDockHtml?'<div class="roc-ccdock'+(_ccDockHoriz?' ccd-h':'')+'">'+_ccDockHtml+'</div>':''};
    let _regPost='';
    ['nav','cards_above','lights','cards_below','cover'].forEach(function(rg){_regPost+=_regDiv(rg,_regInner[rg]);});
    const _imgPl=(_lp.place&&_lp.place.image)||{row:1,col:1};
    // image row 'auto' → intrinsic height from the design aspect (refined to the
    // image's natural ratio by _layoutStage once it loads under lock_aspect)
    // Mini: _rootH is 'auto', so the image box needs its own intrinsic size —
    // lock it to the room's design aspect ratio at the fixed reference width
    // (NAV_LIVE_FULL_PLAN.md §6), same mechanism natural-portrait already uses.
    const _wrapAspect=(rocImgAutoRow(_lp)||_naturalRoot||_isMini||c._roc_preview)?' style="height:auto;aspect-ratio:'+(rocRatio(_arResolved)||16/9).toFixed(4)+';"':'';
    const _regPre='<div class="roc-reg" data-reg="image" style="'+rocRegionCss(_imgPl)+(tm?'outline:1px dashed rgba(255,110,110,0.85);outline-offset:-1px;':'')+'">';
    this.shadowRoot.innerHTML='<style>:host{display:block;}@keyframes roc-pulse{0%,100%{opacity:1}50%{opacity:.25}}@keyframes roc-glow{0%,100%{opacity:1;filter:drop-shadow(0 0 0px var(--roc-ac,transparent))}50%{opacity:.7;filter:drop-shadow(0 0 8px var(--roc-ac,rgba(255,0,0,.6)))}}@keyframes roc-blink{0%,49.9%{opacity:1}50%,100%{opacity:0}}@keyframes roc-border-pulse{0%,100%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8)),inset 0 0 8px var(--roc-ac,rgba(255,0,0,.3))}50%{box-shadow:inset 0 0 0 2px transparent,inset 0 0 0 transparent}}@keyframes roc-border-blink{0%,49.9%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8))}50%,100%{box-shadow:none}}@keyframes roc-rain{from{background-position:0 0,0 0}to{background-position:-60px 240px,-30px 120px}}@keyframes roc-snow{0%{background-position:0 0,40px 60px,20px 30px}100%{background-position:90px 280px,-50px 340px,110px 240px}}@keyframes roc-snow-heavy{0%{background-position:0 0,30px 40px,15px 20px}100%{background-position:70px 220px,-40px 250px,70px 160px}}@keyframes roc-fog{0%{background-position:0 0,0 0}100%{background-position:340px 0,-260px 0}}@keyframes roc-flash{0%,91.5%,94.2%,100%{opacity:0}92%,92.6%{opacity:.85}93.4%{opacity:.35}}.wx{transition:opacity 1.5s ease;}.wx-rain{background-image:repeating-linear-gradient(var(--roc-rain-angle,105deg),rgba(255,255,255,0.16) 0px,rgba(255,255,255,0.16) 1px,transparent 1px,transparent 26px),repeating-linear-gradient(calc(var(--roc-rain-angle,105deg) - 5deg),rgba(255,255,255,0.10) 0px,rgba(255,255,255,0.10) 1px,transparent 1px,transparent 17px);background-size:60px 240px,30px 120px;animation:roc-rain 0.55s linear infinite;}.wx-rain.wx-heavy{background-size:42px 200px,22px 100px;animation-duration:0.32s;}.wx-snow{background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.95) 0 2.2px,rgba(255,255,255,0.35) 3px,transparent 4.2px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.85) 0 1.7px,rgba(255,255,255,0.3) 2.4px,transparent 3.4px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.65) 0 1.2px,transparent 2.4px);background-size:90px 140px,90px 140px,90px 105px;animation:roc-snow 9s linear infinite;}.wx-snow.wx-heavy{background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.95) 0 2.6px,rgba(255,255,255,0.4) 3.6px,transparent 5px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.85) 0 2px,rgba(255,255,255,0.32) 2.8px,transparent 4px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.65) 0 1.4px,transparent 2.8px);background-size:70px 110px,70px 105px,55px 70px;animation:roc-snow-heavy 5.5s linear infinite;}.wx-fog{background-image:radial-gradient(ellipse 60% 40% at 30% 55%,rgba(255,255,255,0.22) 0%,transparent 70%),radial-gradient(ellipse 70% 45% at 75% 40%,rgba(255,255,255,0.16) 0%,transparent 70%);background-size:340px 100%,420px 100%;background-repeat:repeat-x;animation:roc-fog 60s linear infinite;}.wx-lightning::after{content:"";position:absolute;inset:0;background:rgba(255,255,255,0.95);opacity:0;animation:roc-flash 7s linear infinite;pointer-events:none;}@keyframes roc-holdfill{to{stroke-dashoffset:0;}}@keyframes roc-holdpop{0%{transform:rotate(-90deg) scale(1);}45%{transform:rotate(-90deg) scale(1.18);}100%{transform:rotate(-90deg) scale(1);}}.roc-hold{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;z-index:300;pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.55));}.roc-hold svg{width:100%;height:100%;transform:rotate(-90deg);}.roc-hold circle{fill:none;stroke-width:3;}.roc-hold-trk{stroke:rgba(255,255,255,0.22);}.roc-hold-bar{stroke:var(--roc-hold-color,var(--primary-color,#03a9f4));stroke-linecap:round;stroke-dasharray:100.53;stroke-dashoffset:100.53;animation:roc-holdfill var(--roc-hold-dur,500ms) linear forwards;}.roc-hold.done svg{animation:roc-holdpop 0.3s ease;}.roc-hold.done .roc-hold-bar{stroke-dashoffset:0;stroke:var(--roc-hold-done-color,#37d67a);}.roc-gd{position:absolute;background:var(--primary-color,#03a9f4);z-index:998;display:none;pointer-events:none;}.roc-gd-h{left:0;right:0;height:1px;}.roc-gd-v{top:0;bottom:0;width:1px;}.zone,.badge,.ico,.lbl,.gauge,.elcont{transition:opacity .25s ease,visibility .25s ease,transform .25s ease;}ha-card{overflow:hidden;padding:0!important;background:transparent;border-radius:'+br+';display:block;transition:none;}.roc-reg{box-sizing:border-box;}.roc-regtag{position:absolute;top:2px;left:2px;z-index:400;background:rgba(190,45,45,0.85);color:#fff;font:bold 10px monospace;padding:1px 5px;border-radius:4px;pointer-events:none;}.roc-ccdock{display:flex;gap:8px;width:100%;height:100%;padding:6px;box-sizing:border-box;}.roc-ccdock.ccd-h{flex-direction:column;}.wrap{position:relative;width:100%;height:100%;overflow:hidden;}.content{position:absolute;inset:0;overflow:hidden;}.layer{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;}.zone{position:absolute;outline:none;}.zone:focus-visible,.ico:focus-visible,.lbl:focus-visible,.gauge:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px;}.zlabel{position:absolute;top:2px;left:4px;font-size:10px;color:red;font-weight:bold;pointer-events:none;text-shadow:0 0 3px white;white-space:nowrap;}.badge{position:absolute;z-index:100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px 10px;white-space:nowrap;user-select:none;}.blabel{font-size:12px;color:white;font-weight:500;}.elcont{position:absolute;pointer-events:auto;}.elcont>*{width:100%!important;height:100%!important;display:block;}'+CC_CSS+'</style><ha-card style="height:'+_rootH+';"><div class="roc-grid" style="'+rocGridCss(_lp,(cAll.layout&&cAll.layout.gap)||'')+'">'+_regPre+'<div class="wrap"'+_wrapAspect+'><div class="content"><div class="layer base" style="'+(c.base_image?'background-image:url(\''+escUrl(c.base_image)+'\');':'')+'transition:filter '+(c.filter_transition??'2s ease')+';will-change:filter,transform;transform:translateZ(0);"></div>'+ovHtml+wxHtml+grpHtml+zHtml+bHtml+icoHtml+lblHtml+gaugeHtml+_ccPop+(tm?'<div class="tm-info" style="position:absolute;top:6px;left:6px;z-index:200;background:rgba(0,0,0,0.72);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:4px 8px;font-size:11px;font-weight:bold;font-family:monospace;line-height:1.35;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;pointer-events:none;">&#128208; '+Math.round(window.innerWidth||0)+'&#215;'+Math.round(window.innerHeight||0)+'<br><span style="font-weight:normal;opacity:0.85;">profile: '+_rt+'</span></div><button class="tm-flip" style="position:absolute;top:6px;right:6px;z-index:200;background:'+(this._testFlipped?'rgba(220,80,0,0.9)':'rgba(0,0,0,0.72)')+';color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#8644; '+(this._testFlipped?'FLIPPED':'FLIP')+'</button><button class="tm-prof" style="position:absolute;top:6px;right:96px;z-index:200;background:'+(this._profFlipped?'rgba(30,90,160,0.92)':'rgba(0,0,0,0.72)')+';color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#8645; '+_rt.toUpperCase()+'</button>'+(c._roc_preview?'':'<button class="tm-save" style="position:absolute;top:38px;right:6px;z-index:200;background:rgba(20,100,20,0.82);color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#128190; Save</button>'):'')+'</div></div>'+(tm?'<div class="roc-regtag">image</div>':'')+'</div>'+_regPost+'</div></ha-card>';

    const content=this.shadowRoot.querySelector('.content');
    this._baseEl=this.shadowRoot.querySelector('.base');
    this._tmInfoEl=tm?this.shadowRoot.querySelector('.tm-info'):null;
    this._wxEl=this.shadowRoot.querySelector('[data-wx]');
    // Corner badges & test-mode controls must pin to the VISIBLE box (.wrap),
    // not to .content — under lock_aspect .content is a larger cover-stage that
    // overflows the box, so bottom/top-anchored chips would fall off-screen.
    const _wrapBox=this.shadowRoot.querySelector('.wrap');
    if(_wrapBox)this.shadowRoot.querySelectorAll('.content > .badge, .content > .tm-info, .content > .tm-flip, .content > .tm-prof, .content > .tm-save').forEach(function(el){_wrapBox.appendChild(el);});
    // ---- Nav wiring -------------------------------------------------------
    this._navThumbEls={};this._navChipEls=[];this._navCardEls=[];this._navFollowEl=null;
    if(this._navMiniRo){this._navMiniRo.disconnect();this._navMiniRo=null;}
    this._navMiniEls={};
    if(navStyle!=='none'){
      const navSelf=this;
      this.shadowRoot.querySelectorAll('[data-nav-room]').forEach(function(btn){
        btn.addEventListener('click',function(e){
          e.stopPropagation();
          const ri=parseInt(btn.dataset.navRoom);
          navSelf._switchRoom(ri,ri>navSelf._roomIdx?1:(ri<navSelf._roomIdx?-1:0),true);
        });
        btn.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();btn.click();}});
      });
      if(navStyle==='thumbnails'){
        cAll.rooms.forEach(function(r,ri){
          navSelf._navThumbEls[ri]=navSelf.shadowRoot.querySelector('[data-thumb="'+ri+'"]');
          const chipCont=navSelf.shadowRoot.querySelector('[data-thumb-chips="'+ri+'"]');
          if(!chipCont)return;
          (r.chips||navCfg.chips||[]).slice(0,3).forEach(function(chCfg){
            const span=document.createElement('span');
            // Optional pill styling per chip
            let _cs='pointer-events:none;';
            if(chCfg.background)_cs+='background:'+chCfg.background+';';
            if(chCfg.border_radius)_cs+='border-radius:'+chCfg.border_radius+';';
            if(chCfg.padding)_cs+='padding:'+chCfg.padding+';';
            if(chCfg.font_size)_cs+='font-size:'+chCfg.font_size+';';
            if(chCfg.border)_cs+='border:'+chCfg.border+';';
            span.style.cssText=_cs;
            chipCont.appendChild(span);
            navSelf._navChipEls.push({el:span,cfg:chCfg,entity:String(chCfg.entity||'').replace(/\{room\}/g,r.id||'')});
          });
        });
      }
      // nav.live: 'full' OR 'custom' — mount one persistent, non-interactive
      // mini <room-overlay-card> per thumbnail (NAV_LIVE_FULL_PLAN.md §5/§6/
      // §13). Fixed reference width, aspect-derived height (see _isMini/
      // _rootH/_wrapAspect above) — then a shared ResizeObserver scales the
      // whole thing to fit its thumb box, so every mini keeps the SAME font/
      // icon/gauge proportions no matter each room's own aspect_ratio. Both
      // tiers share this entire mount/scale mechanism unchanged — only
      // rocBuildMiniConfig's content differs (custom additionally filters by
      // nav_mini, §13).
      if(_navLiveReal){
        const _wRef=(navCfg.mini&&Number(navCfg.mini.width_ref))||480;
        cAll.rooms.forEach(function(r,ri){
          const host=navSelf.shadowRoot.querySelector('[data-thumb-mini="'+ri+'"]');
          if(!host)return;
          try{
            const mc=document.createElement('room-overlay-card');
            // Scaled down with transform:scale() to fit the thumbnail. transform
            // is paint-only — it never affects offsetWidth/offsetHeight, which is
            // exactly what _layoutStage() now measures with (see its comment) —
            // so nothing inside the mini ever sees a shrunk box to mis-size
            // itself against, regardless of the applied scale.
            mc.style.cssText='display:block;position:absolute;top:0;left:0;width:'+_wRef+'px;transform-origin:top left;';
            // Connect to the document BEFORE setConfig/hass: several layout
            // reads happen synchronously on the first render/update pass
            // (_layoutFitWrap/_layoutStage, and — the one that actually bit a
            // live day_night blind — the gauge fill's el.offsetHeight slat
            // measurement). offsetHeight/getBoundingClientRect always read 0
            // on a still-disconnected element, so day_night's `if(_perDN>0)`
            // guard silently skipped setting any fill at all on first paint.
            // A later IntersectionObserver-triggered _update() can self-heal
            // plain percentage-fill gauges, but there's no reason to rely on
            // that race at all — just connect first.
            host.appendChild(mc);
            mc.setConfig(rocBuildMiniConfig(cAll,ri));
            mc._roomIdx=ri;
            if(navSelf._hass)try{mc.hass=navSelf._hass;}catch(_){}
            navSelf._navMiniEls[ri]={el:mc,host:host,widthRef:_wRef};
          }catch(e){console.warn('[room-overlay-card] nav.live mini mount failed for room '+((r&&r.id)||ri)+':',e);}
        });
        if(window.ResizeObserver){
          const _miniMap=navSelf._navMiniEls;
          navSelf._navMiniRo=new ResizeObserver(function(entries){
            for(const en of entries){
              const _ri=en.target.dataset.thumb;
              const rec=_miniMap[_ri];if(!rec)continue;
              const w=en.contentRect.width||0;
              rec.el.style.transform=w>0?'scale('+(w/rec.widthRef)+')':'';
            }
          });
          for(const _ri in this._navMiniEls){
            const _thumbHost=navSelf.shadowRoot.querySelector('[data-thumb="'+_ri+'"]');
            if(_thumbHost)navSelf._navMiniRo.observe(_thumbHost);
          }
        }
      }
      // Custom HA cards embedded in the nav strip
      (navCfg.cards||[]).forEach(function(cc,ci){
        const host=navSelf.shadowRoot.querySelector('[data-nav-card="'+ci+'"]');
        if(!host)return;
        const cardCfg=cc&&cc.card?cc.card:cc;
        if(!cardCfg||!cardCfg.type)return;
        const wrapEl=makeHACard(cardCfg,function(el){
          if(navSelf._renderGen!==_gen)return; // a newer render replaced this DOM
          navSelf._navCardEls.push(el);
          if(navSelf._hass)try{el.hass=navSelf._hass;}catch(_){}
        });
        if(wrapEl)host.appendChild(wrapEl);
      });
      this._navFollowEl=this.shadowRoot.querySelector('[data-nav-follow]');
      if(this._navFollowEl){
        const fbSelf=this;
        this._navFollowEl.addEventListener('click',function(e){e.stopPropagation();fbSelf._followNow();});
      }
    }
    // Mount companion strip cards (above/below the image)
    this._stripCardEls=[];
    const stSelf=this;
    const _mountStrip=function(list,attr){
      (list||[]).forEach(function(cc,ci){
        const host=stSelf.shadowRoot.querySelector('['+attr+'="'+ci+'"]');
        if(!host)return;
        const cardCfg=cc&&cc.card?cc.card:cc;
        if(!cardCfg||!cardCfg.type)return;
        const w=makeHACard(cardCfg,function(el){
          if(stSelf._renderGen!==_gen)return; // stale render
          stSelf._stripCardEls.push(el);
          if(stSelf._hass)try{el.hass=stSelf._hass;}catch(_){}
        });
        if(w)host.appendChild(w);
      });
    };
    _mountStrip(c.cards_above,'data-above-card');
    _mountStrip(c.cards_below,'data-below-card');
    // Mount light-controls sliders (material-slider-card) + wire the lux ring.
    // Switch-like entities have no [data-lc-card] host (they render a toggle
    // pill instead), so the querySelector below simply skips them.
    this._lcEls=[];this._lcPrevCol=null;this._lcToggles=[];
    if(_lcEnts.length){
      const lcSelf=this;
      const _bgOff=_lcBgOff;
      _lcEnts.forEach(function(e,i){
        const host=lcSelf.shadowRoot.querySelector('[data-lc-card="'+i+'"]');
        if(!host)return;
        const cardCfg={type:'custom:material-slider-card',entity:e.entity,control_type:'light',colorize:true,height:_lcHgt,border_width:'2px',border_style:'solid'};
        if(e.name)cardCfg.name=e.name;
        const w=makeHACard(cardCfg,function(el){
          if(lcSelf._renderGen!==_gen)return;
          const _icol=(lcSelf._hass&&lcSelf._lcCfg)?lcBorderColor(lcSelf._hass.states[lcSelf._lcCfg.lux_sensor]?.state,lcSelf._lcCfg):'';
          const _stEl=lcSelf._injectLcStyle(el,_bgOff,_icol);
          lcSelf._lcEls.push({el:el,entity:e.entity,styleEl:_stEl,bgOff:_bgOff});
          try{el.style.width='100%';}catch(_){}
          if(lcSelf._hass){try{el.hass=lcSelf._hass;}catch(_){}}
        });
        if(w)host.appendChild(w);
      });
      // Wire on/off toggle pills (switch, input_boolean, fan…) — they share the
      // lux ring + bg_off look; state + ring colour are reflected in _update().
      _lcEnts.forEach(function(e,i){
        if(lcUsesSlider(e.entity))return;
        const btn=lcSelf.shadowRoot.querySelector('[data-lc-toggle="'+i+'"]');
        if(!btn)return;
        btn.addEventListener('click',function(ev){
          ev.stopPropagation();
          if(lcSelf._hass)try{lcSelf._hass.callService('homeassistant','toggle',{entity_id:e.entity});}catch(_){}
        });
        lcSelf._lcToggles.push({el:btn,entity:e.entity,icon:btn.querySelector('[data-lc-ticon]'),bgOff:_bgOff});
      });
      // Match toggle-pill height to the ACTUAL rendered slider height — material-
      // slider-card renders its own box, so a shared px value can still differ
      // visually. Measuring the mounted slider guarantees parity. Retried because
      // the slider mounts async via card helpers.
      if(this._lcToggles.length){
        const _syncSelf=this,_sg=_gen;
        const _sy=function(){if(_syncSelf._renderGen===_sg)_syncSelf._syncLcToggleHeights();};
        // rAF = fast path only; the setTimeout retries below are the
        // background-tab-safe guarantee (rAF never fires in hidden tabs)
        if(typeof requestAnimationFrame!=='undefined')requestAnimationFrame(_sy);
        setTimeout(_sy,140);setTimeout(_sy,450);
      }
    }
    // ---- Cover controls (roleta) — mount interactions -----------------------
    this._ccEls={};
    if(this._ccCfgs&&this._ccCfgs.length&&!c._roc_ghost){
      const ccSelf=this;const _ccMobM=(_vt==='portrait');
      this._ccCfgs.forEach(function(cc){
        const root=ccSelf.shadowRoot.querySelector('.roc-cc[data-cc="'+escSel(cc.id)+'"]');
        if(!root)return;
        const _mode=root.dataset.ccMode||'float';
        const _horiz=_mode==='dock'?rocCoverHoriz(ccSelf._lp):_ccMobM; // dock: grid-derived (html already carries cc-h)
        root.style.touchAction='none';
        root.addEventListener('pointerdown',function(e){e.stopPropagation();});
        const rec={cfg:cc,root:root,horiz:_horiz,mode:_mode,
          pct:root.querySelector('[data-cc-pct]'),fill:root.querySelector('[data-cc-fill]'),
          thumb:root.querySelector('[data-cc-thumb]'),rail:root.querySelector('[data-cc-rail]'),
          stop:root.querySelector('[data-cc-stop]'),up:root.querySelector('[data-cc-up]'),
          down:root.querySelector('[data-cc-down]'),
          presets:[].slice.call(root.querySelectorAll('[data-cc-preset]')),_userHold:0};
        ccSelf._ccEls[cc.id]=rec;
        const call=function(svc,data){const h=ccSelf._hass;if(!h)return;h.callService('cover',svc,Object.assign({entity_id:cc.entity},data||{}));};
        const guard=function(fn){return function(e){e.stopPropagation();if(ccSelf._config&&ccSelf._config.test_mode)return;rec._userHold=Date.now();fn();};};
        if(rec.up)rec.up.addEventListener('click',guard(function(){call('open_cover');}));
        if(rec.down)rec.down.addEventListener('click',guard(function(){call('close_cover');}));
        if(rec.stop)rec.stop.addEventListener('click',guard(function(){call('stop_cover');}));
        rec.presets.forEach(function(pb){pb.addEventListener('click',guard(function(){call('set_cover_position',{position:parseInt(pb.dataset.pos,10)||0});}));});
        if(rec.rail)ccSelf._attachCoverRail(rec);
        const anchor=ccSelf.shadowRoot.querySelector('[data-gauge="__bl_'+escSel(cc.id)+'"]');
        if(anchor&&_mode==='float'){anchor.style.pointerEvents='auto';anchor.style.cursor='pointer';
          anchor.addEventListener('click',function(e){e.stopPropagation();ccSelf._toggleCoverPop(cc.id);});}
      });
      if(!this._ccOutsideBound){
        this._ccOutsideBound=true;const obSelf=this;
        this.shadowRoot.addEventListener('pointerdown',function(e){
          const path=e.composedPath?e.composedPath():[];
          for(const n of path){if(n&&n.classList&&(n.classList.contains('roc-cc')||(n.dataset&&typeof n.dataset.gauge==='string'&&n.dataset.gauge.indexOf('__bl_')===0)))return;}
          for(const k in(obSelf._ccEls||{})){if(obSelf._ccEls[k].mode!=='dock')obSelf._ccEls[k].root.style.display='none';}
        },true);
      }
    }
    // ---- Finger-attached room drag (filmstrip feel) -------------------------
    if(Array.isArray(cAll.rooms)&&cAll.rooms.length>1&&!tm){
      const wrapSw=this.shadowRoot.querySelector('.wrap');
      if(wrapSw)this._attachRoomDrag(wrapSw);
      // ---- Mouse-wheel room switching (nav.wheel) -------------------------
      // true|'horizontal' → horizontal wheel (deltaX, safe: doesn't scroll page)
      // 'vertical' → deltaY · 'both' → either. Ctrl+wheel stays zoom.
      const _whMode=navCfg.wheel;
      if(_whMode&&wrapSw){
        const whSelf=this;
        const useX=_whMode===true||_whMode==='horizontal'||_whMode==='both';
        const useY=_whMode==='vertical'||_whMode==='both';
        wrapSw.addEventListener('wheel',function(e){
          if(e.ctrlKey||whSelf._zoomScale>1)return; // leave zoom alone
          let d=0;
          if(useX&&useY)d=Math.abs(e.deltaX)>=Math.abs(e.deltaY)?e.deltaX:e.deltaY;
          else if(useX)d=e.deltaX;
          else if(useY)d=e.deltaY;
          if(!d||Math.abs(d)<6)return;
          e.preventDefault(); // block page scroll / browser back-forward swipe
          const now=Date.now();
          if(now-(whSelf._lastWheelNav||0)<320)return; // one notch = one room
          whSelf._lastWheelNav=now;
          const n=whSelf._config.rooms.length;
          if(d>0)whSelf._switchRoom((whSelf._roomIdx+1)%n,1,true);
          else whSelf._switchRoom((whSelf._roomIdx-1+n)%n,-1,true);
        },{passive:false});
      }
    }
    if(this._wxEl&&_wx&&_wx.angle!==undefined)this._wxEl.style.setProperty('--roc-rain-angle',typeof _wx.angle==='number'?_wx.angle+'deg':String(_wx.angle));
    this._ovEls={};
    for(const ov of(c.overlays||[])){this._ovEls[ov.id]=this.shadowRoot.querySelector('[data-ov="'+escSel(ov.id)+'"]');}
    this._grpPanelEls={};
    for(const g of(c.groups||[])){if(g.style)this._grpPanelEls[g.id]=this.shadowRoot.querySelector('[data-grp-panel="'+escSel(g.id)+'"]');}
    this._zoneEls={};
    for(const z of(c.zones||[])){
      const el=this.shadowRoot.querySelector('[data-z="'+escSel(z.id)+'"]');
      if(!el)continue;this._zoneEls[z.id]=el;
      if(z.tap_action||z.hold_action||z.double_tap_action)
        this._addZoneListeners(el,z.tap_action,z.hold_action,z.double_tap_action,z.hold_delay);
      if(z.slider&&z.slider.entity&&!tm)this._attachSlider(el,z);
    }
    this._biconEls={};this._blabelEls={};this._bcontEls={};
    for(const b of(c.badges||[])){
      this._biconEls[b.id]=this.shadowRoot.querySelector('[data-bi="'+escSel(b.id)+'"]');
      this._blabelEls[b.id]=this.shadowRoot.querySelector('[data-bl="'+escSel(b.id)+'"]');
      const bel=this.shadowRoot.querySelector('[data-b="'+escSel(b.id)+'"]');
      this._bcontEls[b.id]=bel;
      if(bel&&b.tap_action){bel.addEventListener('click',e=>this._exec(b.tap_action,e));bel.addEventListener('touchend',e=>this._exec(b.tap_action,e));}
    }
    this._icoEls={};
    for(const ico of(c.icons||[])){
      const el=this.shadowRoot.querySelector('[data-ico="'+escSel(ico.id)+'"]');
      if(!el)continue;this._icoEls[ico.id]=el;
      if(ico.tap_action)this._addZoneListeners(el,ico.tap_action,ico.hold_action,ico.double_tap_action,ico.hold_delay);
    }
    this._lblEls={};this._sortedLblGrads={};
    for(const lbl of(c.labels||[])){
      this._lblEls[lbl.id]=this.shadowRoot.querySelector('[data-lbl="'+escSel(lbl.id)+'"]');
      if(lbl.color_gradient)this._sortedLblGrads[lbl.id]=lbl.color_gradient.slice().sort((a,b)=>a.value-b.value);
      const lel=this._lblEls[lbl.id];
      if(lel&&(lbl.tap_action||lbl.hold_action||lbl.double_tap_action)){
        lel.style.pointerEvents='auto';lel.style.cursor='pointer';
        lel.setAttribute('tabindex','0');lel.setAttribute('role','button');
        this._addZoneListeners(lel,lbl.tap_action,lbl.hold_action,lbl.double_tap_action,lbl.hold_delay);
      }
    }
    this._sortedBmFg=c.brightness_model?.filter_gradient?.length?c.brightness_model.filter_gradient.slice().sort((a,b)=>a.value-b.value):null;
    this._gaugeEls={};this._gaugeFills={};this._sortedGrads={};this._blindGaugeCfgs=(c.blinds||[]).map(b=>tApply(b,_tier)).flatMap(blindToGaugeConfig);for(const g of(c.gauges||[])){this._gaugeEls[g.id]=this.shadowRoot.querySelector('[data-gauge="'+escSel(g.id)+'"]');if(this._gaugeEls[g.id])this._gaugeFills[g.id]=this._gaugeEls[g.id].querySelector('.gfill');if(g.color_gradient)this._sortedGrads[g.id]=g.color_gradient.slice().sort((a,b)=>a.value-b.value);}for(const bg of this._blindGaugeCfgs){this._gaugeEls[bg.id]=this.shadowRoot.querySelector('[data-gauge="'+escSel(bg.id)+'"]');if(this._gaugeEls[bg.id])this._gaugeFills[bg.id]=this._gaugeEls[bg.id].querySelector('.gfill');if(bg.color_gradient)this._sortedGrads[bg.id]=bg.color_gradient.slice().sort((a,b)=>a.value-b.value);}
    // Gauges with actions become interactive (default stays pointer-events: none)
    for(const g of[...(c.gauges||[]),...this._blindGaugeCfgs]){
      const gel=this._gaugeEls[g.id];
      if(gel&&(g.tap_action||g.hold_action||g.double_tap_action)){
        gel.style.pointerEvents='auto';gel.style.cursor='pointer';
        gel.setAttribute('tabindex','0');gel.setAttribute('role','button');
        this._addZoneListeners(gel,g.tap_action,g.hold_action,g.double_tap_action,g.hold_delay);
      }
    }
    this._cardEls={};this._contEls={};
    for(const el0 of(c.elements||[])){
      const el=tApply(el0,_tier);
      const cont=document.createElement('div');
      cont.className='elcont';cont.setAttribute('data-el',el.id);
      const _elVPos=el.bottom!==undefined?'bottom:'+el.bottom+';':'top:'+(el.top||'0')+';';
      const _elH=el.height?('height:'+el.height+';'):(el.bottom!==undefined?'height:auto;':'height:auto;');
      cont.style.cssText=_elVPos+'left:'+el.left+';width:'+el.width+';'+_elH+'z-index:'+(el.z_index??4)+';overflow:'+(el.overflow??'hidden')+';border-radius:'+(el.border_radius??'0')+';'+(tm?'outline:2px dashed blue;':'');
      if(tm)cont.title='[element] '+el.id;
      const self=this,elId=el.id;
      const wrap=makeHACard(el.card,function(cardEl){
        if(self._renderGen!==_gen)return; // stale render
        self._cardEls[elId]=cardEl;
        if(self._hass)try{cardEl.hass=self._hass;}catch(_){}
      });
      if(wrap)cont.appendChild(wrap);
      this._contEls[el.id]=cont;if(content)content.appendChild(cont);
    }
    const hacard=this.shadowRoot.querySelector('ha-card');
    if(hacard&&c.tap_action){
      hacard.addEventListener('click',e=>{
        if(!e.composedPath().some(n=>n.classList?.contains('zone')||n.classList?.contains('elcont')||n.classList?.contains('ico')||n.classList?.contains('badge')||n.classList?.contains('tm-flip')||n.classList?.contains('tm-save')))this._exec(c.tap_action,e);
      });
    }
    if(tm){
      // Alignment guide lines for drag snapping
      const _gdc=this.shadowRoot.querySelector('.content');
      this._gdH=document.createElement('div');this._gdH.className='roc-gd roc-gd-h';
      this._gdV=document.createElement('div');this._gdV.className='roc-gd roc-gd-v';
      if(_gdc){_gdc.appendChild(this._gdH);_gdc.appendChild(this._gdV);}
      const flipBtn=this.shadowRoot.querySelector('.tm-flip');
      if(flipBtn){
        const self=this;
        flipBtn.addEventListener('click',function(e){
          e.stopPropagation();e.preventDefault();
          self._testFlipped=!self._testFlipped;
          flipBtn.style.background=self._testFlipped?'rgba(220,80,0,0.9)':'rgba(0,0,0,0.72)';
          flipBtn.innerHTML=self._testFlipped?'&#8644; FLIPPED':'&#8644; FLIP';
          self._update();
        });
      }
      const profBtn=this.shadowRoot.querySelector('.tm-prof');
      if(profBtn){
        const pfSelf=this;
        profBtn.addEventListener('click',function(e){
          e.stopPropagation();e.preventDefault();
          pfSelf._profFlipped=!pfSelf._profFlipped;
          pfSelf._rendered=false;pfSelf._render();
        });
      }
      const saveBtn=this.shadowRoot.querySelector('.tm-save');
      if(saveBtn){
        const self=this;
        saveBtn.addEventListener('click',function(e){
          e.stopPropagation();e.preventDefault();
          const cfg=Object.assign({type:'custom:room-overlay-card'},self._config);
          // Always relay via editor if open
          window.dispatchEvent(new CustomEvent('roc-pos-update',{detail:{config:cfg}}));

          function _showOverlay(reason){
            const existing=self.shadowRoot.querySelector('.tm-cfg-ov');
            if(existing){existing.remove();return;}
            const txt=window.YAML?window.YAML.stringify(cfg):JSON.stringify(cfg,null,2);
            const ov=document.createElement('div');
            ov.className='tm-cfg-ov';
            ov.style.cssText='position:absolute;inset:0;z-index:500;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;padding:10px;box-sizing:border-box;';
            const hdr=document.createElement('div');
            hdr.style.cssText='display:flex;flex-direction:column;gap:4px;margin-bottom:6px;';
            const hdr1=document.createElement('div');
            hdr1.style.cssText='display:flex;justify-content:space-between;align-items:center;';
            hdr1.innerHTML='<span style="color:#fff;font-size:11px;font-weight:bold;">&#128190; Config — Ctrl+A, Ctrl+C, then paste in YAML editor</span><button style="background:none;border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;">&#x2715;</button>';
            hdr.appendChild(hdr1);
            if(reason){const hdr2=document.createElement('div');hdr2.style.cssText='color:#faa;font-size:10px;';hdr2.textContent='Auto-save failed: '+reason;hdr.appendChild(hdr2);}
            hdr1.querySelector('button').addEventListener('click',function(ev){ev.stopPropagation();ov.remove();});
            const ta=document.createElement('textarea');
            ta.value=txt;ta.readOnly=true;
            ta.style.cssText='flex:1;width:100%;background:#111;color:#aef;border:1px solid rgba(255,255,255,0.15);border-radius:4px;font-family:monospace;font-size:11px;padding:8px;box-sizing:border-box;resize:none;';
            ov.appendChild(hdr);ov.appendChild(ta);
            self.shadowRoot.querySelector('.content').appendChild(ov);
            ta.focus();ta.select();
            if(navigator.clipboard)navigator.clipboard.writeText(txt).catch(function(){});
            try{document.execCommand('copy');}catch(_){}
            ov.addEventListener('click',function(ev){if(ev.target===ov)ov.remove();});
          }

          // Direct HA Lovelace save via WebSocket (storage mode only)
          const _callWS=self._hass&&(typeof self._hass.callWS==='function'?self._hass.callWS.bind(self._hass):null)||(self._hass&&self._hass.connection&&typeof self._hass.connection.sendMessagePromise==='function'?self._hass.connection.sendMessagePromise.bind(self._hass.connection):null);
          if(_callWS){
            // Extract dashboard url_path and view key from current URL
            // e.g. /lovelace/2  →  urlPath=null, viewKey='2'
            // e.g. /my-dash/living-room  →  urlPath='my-dash', viewKey='living-room'
            const _parts=window.location.pathname.split('/').filter(Boolean);
            const _urlPath=_parts[0]==='lovelace'?null:(_parts[0]||null);
            _callWS({type:'lovelace/config',url_path:_urlPath})
              .then(function(lc){
                const nc=rocClone(lc);
                const key=cfgKey(self._config);
                // Search the WHOLE dashboard (every view + section + nesting),
                // not just the URL's view — navigation/room switches make the URL
                // view unreliable. card_id keeps the match unambiguous.
                const matches=[];
                function _walk(cards){
                  if(!Array.isArray(cards))return;
                  for(let i=0;i<cards.length;i++){
                    const card=cards[i];if(!card)continue;
                    if(card.type==='custom:room-overlay-card'&&cfgKey(card)===key)matches.push({arr:cards,idx:i});
                    if(card.cards)_walk(card.cards);
                    if(card.card)_walk([card.card]);
                    if(Array.isArray(card.sections))card.sections.forEach(function(sec){_walk(sec&&sec.cards);});
                  }
                }
                (nc.views||[]).forEach(function(v){
                  _walk(v.cards);
                  if(Array.isArray(v.sections))v.sections.forEach(function(sec){_walk(sec&&sec.cards);});
                });
                if(!matches.length)throw new Error('card not found in dashboard (key: '+key+')');
                if(matches.length>1)throw new Error(matches.length+' matching cards — set a unique card_id to disambiguate');
                matches[0].arr[matches[0].idx]=Object.assign({},self._config,{type:'custom:room-overlay-card'});
                return _callWS({type:'lovelace/config/save',url_path:_urlPath,config:nc});
              })
              .then(function(){
                saveBtn.innerHTML='&#10003; Saved!';saveBtn.style.background='rgba(0,140,0,0.9)';
                setTimeout(function(){saveBtn.innerHTML='&#128190; Save';saveBtn.style.background='rgba(20,100,20,0.82)';},2500);
              })
              .catch(function(err){
                const reason=(err&&(err.code||err.message))||String(err);
                console.warn('[room-overlay-card] Direct save failed:',reason);
                _showOverlay(reason);
              });
          } else {
            _showOverlay('hass.callWS not available');
          }
        });
      }
      // Drag & drop — zones, icons, labels
      const _dpFire=(nc)=>{
        this._config=nc;
        window.dispatchEvent(new CustomEvent('roc-pos-update',{detail:{config:Object.assign({type:'custom:room-overlay-card'},nc)}}));
      };
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const zc=this._roomArr(nc,'zones').find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const ico of(c.icons||[])){
        const el=this._icoEls[ico.id];if(!el)continue;
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const ic=this._roomArr(nc,'icons').find(x=>x.id===ico.id);if(ic){ic.top=top;ic.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const lbl of(c.labels||[])){
        const el=this._lblEls[lbl.id];if(!el)continue;
        el.style.pointerEvents='auto';el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const lc=this._roomArr(nc,'labels').find(x=>x.id===lbl.id);if(lc){lc.top=top;lc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      // Resize handles — zones, elements, gauges
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=rocClone(this._config);
          const zc=this._roomArr(nc,'zones').find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;zc.width=width;zc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      for(const elCfg of(c.elements||[])){
        const cont=this._contEls[elCfg.id];if(!cont)continue;
        this._makeResizable(cont,(top,left,width,height)=>{
          const nc=rocClone(this._config);
          const ec=this._roomArr(nc,'elements').find(x=>x.id===elCfg.id);if(ec){ec.top=top;ec.left=left;ec.width=width;ec.height=height;}
          _dpFire(nc);this._update();
        });
      }
      for(const g of(c.gauges||[])){
        const el=this._gaugeEls[g.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=rocClone(this._config);
          const gc=this._roomArr(nc,'gauges').find(x=>x.id===g.id);if(gc){gc.top=top;gc.left=left;gc.width=width;gc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      // Keyboard nudge — click to select, arrows to nudge, Escape to deselect
      const _tmOutline=(type)=>type==='zone'?'3px solid red':'';
      const _selectTM=(el,type,id)=>{
        if(this._selectedTM){this._selectedTM.el.style.outline=_tmOutline(this._selectedTM.type);this._selectedTM.el.style.outlineOffset='';}
        this.shadowRoot.querySelectorAll('.roc-rh').forEach(function(h){h.style.display='none';}); // hide every resize handle
        el.style.outline='2px dashed var(--primary-color,#03a9f4)';
        el.style.outlineOffset='2px';
        el.querySelectorAll('.roc-rh').forEach(function(h){h.style.display='block';}); // show only the selected element's handles
        this._selectedTM={el,type,id};
      };
      const _deselectTM=()=>{if(this._selectedTM){this._selectedTM.el.style.outline=_tmOutline(this._selectedTM.type);this._selectedTM.el.style.outlineOffset='';this._selectedTM.el.querySelectorAll('.roc-rh').forEach(function(h){h.style.display='none';});this._selectedTM=null;}};
      let _nudgeTimer=null;
      const _nudgeFn=(e)=>{
        if(!this._selectedTM)return;
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.key))return;
        if(e.key==='Escape'){_deselectTM();return;}
        e.preventDefault();
        const step=e.shiftKey?0.1:1;
        const {el,type,id}=this._selectedTM;
        let top=parseFloat(el.style.top)||0,left=parseFloat(el.style.left)||0;
        if(e.key==='ArrowUp')top=Math.max(0,top-step);
        else if(e.key==='ArrowDown')top=Math.min(98,top+step);
        else if(e.key==='ArrowLeft')left=Math.max(0,left-step);
        else if(e.key==='ArrowRight')left=Math.min(98,left+step);
        el.style.top=top.toFixed(1)+'%';el.style.left=left.toFixed(1)+'%';
        clearTimeout(_nudgeTimer);
        _nudgeTimer=setTimeout(()=>{
          const nc=rocClone(this._config);
          const arr=type==='zone'?this._roomArr(nc,'zones'):type==='icon'?this._roomArr(nc,'icons'):type==='label'?this._roomArr(nc,'labels'):type==='element'?this._roomArr(nc,'elements'):type==='gauge'?this._roomArr(nc,'gauges'):null;
          const item=(arr||[]).find(x=>x.id===id);
          if(item){item.top=el.style.top;item.left=el.style.left;}
          _dpFire(nc);
        },200);
      };
      this._tmKeyHandler=_nudgeFn;
      document.addEventListener('keydown',_nudgeFn);
      // Click to select (capture phase — fires before drag suppression and zone tap actions)
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'zone',z.id);},true);
      }
      for(const ico of(c.icons||[])){
        const el=this._icoEls[ico.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'icon',ico.id);},true);
      }
      for(const lbl of(c.labels||[])){
        const el=this._lblEls[lbl.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'label',lbl.id);},true);
      }
      for(const elCfg of(c.elements||[])){
        const el=this._contEls[elCfg.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'element',elCfg.id);},true);
      }
      for(const g of(c.gauges||[])){
        const el=this._gaugeEls[g.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'gauge',g.id);},true);
      }
      // Click on card background → deselect
      const _hacard=this.shadowRoot.querySelector('ha-card');
      if(_hacard)_hacard.addEventListener('click',_deselectTM);
      // Draw-to-create: drag on an empty area sketches a new zone
      const drawSelf=this;
      let _dwBox=null,_dwJustDrew=false;
      content.addEventListener('click',function(ce){if(_dwJustDrew){ce.stopImmediatePropagation();ce.preventDefault();}},true);
      content.addEventListener('mousedown',function(e){
        if(e.button!==0)return;
        const t=e.target;
        if(!(t===content||(t.classList&&t.classList.contains('layer'))))return; // only empty areas
        const rect=content.getBoundingClientRect();
        const sx=e.clientX,sy=e.clientY;
        function mv(ev){
          if(!_dwBox){
            if(Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy)<8)return;
            _dwBox=document.createElement('div');
            _dwBox.style.cssText='position:absolute;border:2px dashed var(--primary-color,#03a9f4);background:rgba(3,169,244,0.12);z-index:997;pointer-events:none;';
            content.appendChild(_dwBox);
          }
          _dwBox.style.left=((Math.min(sx,ev.clientX)-rect.left)/rect.width*100)+'%';
          _dwBox.style.top=((Math.min(sy,ev.clientY)-rect.top)/rect.height*100)+'%';
          _dwBox.style.width=(Math.abs(ev.clientX-sx)/rect.width*100)+'%';
          _dwBox.style.height=(Math.abs(ev.clientY-sy)/rect.height*100)+'%';
        }
        function up(){
          document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
          if(!_dwBox)return;
          const l=parseFloat(_dwBox.style.left),tp=parseFloat(_dwBox.style.top),w=parseFloat(_dwBox.style.width),h=parseFloat(_dwBox.style.height);
          _dwBox.remove();_dwBox=null;
          _dwJustDrew=true;setTimeout(function(){_dwJustDrew=false;},300);
          if(w<2||h<2)return; // too small — ignore accidental drags
          const nc=rocClone(drawSelf._config);
          const dwZones=drawSelf._roomArr(nc,'zones');
          let n=dwZones.length+1,id='zone_'+n;
          while(dwZones.some(function(z){return z.id===id;})){n++;id='zone_'+n;}
          dwZones.push({id:id,top:tp.toFixed(1)+'%',left:l.toFixed(1)+'%',width:w.toFixed(1)+'%',height:h.toFixed(1)+'%'});
          drawSelf._config=nc;
          window.dispatchEvent(new CustomEvent('roc-pos-update',{detail:{config:Object.assign({type:'custom:room-overlay-card'},nc)}}));
          drawSelf._rendered=false;drawSelf._render();
        }
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });
    }
    if(c.zoom&&!tm){
      const wrapEl=this.shadowRoot.querySelector('.wrap');
      if(wrapEl&&content)this._attachZoom(wrapEl,content);
    }
    // Parallax tilt — pointer-driven (and device orientation where allowed).
    // Mutually exclusive with zoom (both own the content transform).
    if(c.parallax&&!tm&&!c.zoom){
      const wrapPx=this.shadowRoot.querySelector('.wrap');
      if(wrapPx&&content)this._attachParallax(wrapPx,content);
    }
    // IntersectionObserver — zastav updates když karta není ve viewportu
    if(this._io)this._io.disconnect();
    if(typeof IntersectionObserver!=='undefined'){
      const self=this;
      this._io=new IntersectionObserver(function(entries){
        self._visible=entries[0].isIntersecting;
        if(self._visible&&self._hass&&self._rendered)self._update();
      },{threshold:0});
      this._io.observe(this);
    }
    this._wireLayoutObservers();
    this._layoutRootHeight(); // first paint: direct & synchronous (no flash)
    this._layoutFitWrap();
    this._layoutStage();
    // One late-settling re-pin: fonts/images can land after first paint
    // WITHOUT any DOM mutation or resize we observe. (v5.0: the second 1.2s
    // timer is gone — everything it covered is now caught by _pvMo or the
    // state-update piggyback.)
    const _lrSelf=this;
    clearTimeout(this._rootHT1);
    this._rootHT1=setTimeout(function(){_lrSelf._requestPin('post-render-settle');},250);
    // Change detection: the ACTIVE room (merged view) drives full updates;
    // entities that only affect nav thumbnails/chips go into a cheaper
    // nav-only set (see _schedule) so busy sensors in other rooms don't
    // re-run the whole update pass.
    const _ex=this._extractEntities(c);
    if(c.light_controls&&c.light_controls.lux_sensor)_ex.ids.add(c.light_controls.lux_sensor);
    for(const _b of(c.blinds||[]))if(_b&&_b.entity&&_b.control)_ex.ids.add(_b.entity);
    const _reCfg=cAll.room_entity;
    if(typeof _reCfg==='string')_ex.ids.add(_reCfg);
    else if(_reCfg&&typeof _reCfg==='object'){
      if(_reCfg.default)_ex.ids.add(_reCfg.default);
      for(const k in(_reCfg.by_user||{}))_ex.ids.add(_reCfg.by_user[k]);
      for(const k in(_reCfg.by_browser||{}))_ex.ids.add(_reCfg.by_browser[k]);
    }
    const _navEx={ids:new Set(),attrs:new Set()};
    // nav.live (composite thumbnails) also reacts to other rooms' overlays,
    // conditional base images and brightness model
    const _navLive=!!(cAll.nav&&cAll.nav.live);
    this._navBmSorted={};
    if(Array.isArray(cAll.rooms))for(let _ri=0;_ri<cAll.rooms.length;_ri++){
      const _rr=cAll.rooms[_ri];if(!_rr)continue;
      if(_navLive&&_rr.brightness_model?.filter_gradient?.length)
        this._navBmSorted[_ri]=_rr.brightness_model.filter_gradient.slice().sort((a,b)=>a.value-b.value);
      if(_ri===this._roomIdx)continue;
      if(_rr.filter_conditions)this._extractEntities(_rr.filter_conditions,_navEx.ids,_navEx.attrs);
      if(_navLive){
        if(_rr.overlays)this._extractEntities(_rr.overlays,_navEx.ids,_navEx.attrs);
        if(_rr.base_image_conditions)this._extractEntities(_rr.base_image_conditions,_navEx.ids,_navEx.attrs);
        if(_rr.brightness_model)this._extractEntities(_rr.brightness_model,_navEx.ids,_navEx.attrs);
      }
    }
    for(const ch of this._navChipEls)if(ch.entity)_navEx.ids.add(ch.entity);
    this._relevantEntities=[..._ex.ids];
    this._navEntities=[..._navEx.ids].filter(id=>!_ex.ids.has(id));
    this._navAttrSources=[..._navEx.attrs].map(s=>{const i=s.indexOf(' ');return{entity:s.slice(0,i),attr:s.slice(i+1)};});
    this._relevantAttrSources=[...this._extractAttrSources(c),...[..._ex.attrs].map(s=>{const i=s.indexOf(' ');return{entity:s.slice(0,i),attr:s.slice(i+1)};})];
    this._prevStates={};
    this._rendered=true;
    this._preloadImages();
    // Editor → card highlight (panel opened in GUI editor flashes the element)
    const hlSelf=this;
    this._hlHandler=function(e){
      const d=e.detail||{};
      if(d.key!==cfgKey(hlSelf._config))return;
      const pre={zone:'[data-z="',icon:'[data-ico="',label:'[data-lbl="',gauge:'[data-gauge="',badge:'[data-b="',element:'[data-el="',overlay:'[data-ov="'}[d.kind];
      if(!pre)return;
      const el=hlSelf.shadowRoot.querySelector(pre+escSel(d.id)+'"]');
      if(!el)return;
      const po=el.style.outline,poo=el.style.outlineOffset;
      el.style.outline='3px solid var(--primary-color,#03a9f4)';el.style.outlineOffset='2px';
      clearTimeout(el._rocHlT);
      el._rocHlT=setTimeout(function(){el.style.outline=po;el.style.outlineOffset=poo;},1600);
    };
    window.addEventListener('roc-highlight',this._hlHandler);
    this._startCamera();
    this._setupTemplates();
    // 30 s ticker for labels with format: relative
    if((c.labels||[]).some(function(l){return l.format==='relative';})){
      const rtSelf=this;
      this._relTimer=setInterval(function(){
        if(rtSelf._visible&&rtSelf._hass&&rtSelf._rendered)rtSelf._update();
      },30000);
    }
    this._update();
    this._syncRoomState();
    this._layoutStage();
  }

  _snapCandidates(){
    const c=this._config,tops=[],lefts=[];
    ['zones','icons','labels','gauges','blinds','elements'].forEach(function(k){
      (c[k]||[]).forEach(function(it){
        const t=parseFloat(it.top),l=parseFloat(it.left);
        if(!isNaN(t))tops.push(t);
        if(!isNaN(l))lefts.push(l);
      });
    });
    return{tops:tops,lefts:lefts};
  }

  _snapPos(t,l,free,cands){
    if(free){this._hideGuides();return{t:t,l:l};}
    t=Math.round(t*2)/2;l=Math.round(l*2)/2; // 0.5 % grid
    let gh=null,gv=null;
    for(const ct of cands.tops)if(Math.abs(t-ct)<0.45){t=ct;gh=ct;break;}
    for(const cl of cands.lefts)if(Math.abs(l-cl)<0.45){l=cl;gv=cl;break;}
    if(this._gdH){if(gh!==null){this._gdH.style.top=gh+'%';this._gdH.style.display='block';}else this._gdH.style.display='none';}
    if(this._gdV){if(gv!==null){this._gdV.style.left=gv+'%';this._gdV.style.display='block';}else this._gdV.style.display='none';}
    return{t:t,l:l};
  }

  _hideGuides(){
    if(this._gdH)this._gdH.style.display='none';
    if(this._gdV)this._gdV.style.display='none';
  }

  // Active-room scoped array access for test-mode editing (drag/resize/draw)
  _roomArr(nc,key){
    const t=Array.isArray(nc.rooms)&&nc.rooms.length?nc.rooms[Math.max(0,Math.min(this._roomIdx,nc.rooms.length-1))]:nc;
    if(!t[key])t[key]=[];
    return t[key];
  }

  // Resolve an entity option: plain string, or per-device mapping
  // {default, by_user: {<HA user name>: entity}, by_browser: {<browser_mod id>: entity}}
  _resolveMapEntity(re){
    if(!re)return null;
    if(typeof re==='string')return re;
    const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id;
    if(re.by_browser&&bid&&re.by_browser[bid])return re.by_browser[bid];
    const un=this._hass&&this._hass.user&&this._hass.user.name;
    if(re.by_user&&un){
      for(const k in re.by_user)
        if(String(k).toLowerCase()===String(un).toLowerCase())return re.by_user[k];
    }
    return re.default||null;
  }

  _roomEntityId(){return this._resolveMapEntity(this._config?this._config.room_entity:null);}

  // Presence entity for the FOLLOW BUTTON — like _roomEntityId but a per-device
  // mapping must match THIS device explicitly (by_browser/by_user). 'default'
  // does NOT count, so unmapped devices (e.g. a laptop not in the browser list)
  // get no button. A plain-string room_entity applies to every device.
  _followBtnEntity(){
    const re=this._config&&this._config.room_entity;
    if(!re)return null;
    if(typeof re==='string')return re;
    const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id;
    if(re.by_browser&&bid&&re.by_browser[bid])return re.by_browser[bid];
    const un=this._hass&&this._hass.user&&this._hass.user.name;
    if(re.by_user&&un){for(const k in re.by_user)if(String(k).toLowerCase()===String(un).toLowerCase())return re.by_user[k];}
    return null;
  }

  // Mirror the active room into a writable helper entity (input_text /
  // input_select) so automations and other cards can react to it
  _syncRoomState(){
    const cAll=this._config;
    if(!this._hass||!Array.isArray(cAll.rooms)||!cAll.rooms.length)return;
    const rse=this._resolveMapEntity(cAll.room_state_entity);
    if(!rse)return;
    const r=cAll.rooms[Math.max(0,Math.min(this._roomIdx,cAll.rooms.length-1))];
    const val=r.name||r.id||'';
    const cur=this._hass.states[rse]?.state;
    const dom=rse.split('.')[0];
    if(dom==='input_text'){
      if(cur!==val)this._hass.callService('input_text','set_value',{entity_id:rse,value:val});
    }else if(dom==='input_select'||dom==='select'){
      const opts=this._hass.states[rse]?.attributes?.options||[];
      const opt=opts.find(function(o){
        const ol=String(o).toLowerCase();
        return ol===String(r.id||'').toLowerCase()||ol===String(r.name||'').toLowerCase();
      });
      if(opt&&opt!==cur)this._hass.callService(dom,'select_option',{entity_id:rse,option:opt});
    }
  }

  // ---- URL deep-linking (opt-in via url_sync) --------------------------------
  // url_sync: true → hash key 'room'; url_sync: 'mykey' → custom key. Produces
  // bookmarkable URLs like …/lovelace/home#room=bedroom, reacts to back/forward
  // and external hash edits, and rewrites the hash on every room switch. Off by
  // default; the room value matches a room id / name / area_match (via roomMatch).
  _urlSyncKey(){
    const u=this._config&&this._config.url_sync;
    if(!u)return null;
    return(typeof u==='string'&&u.trim())?u.trim():'room';
  }
  _roomIdxFromHash(){
    const key=this._urlSyncKey();
    if(!key||typeof location==='undefined'||!this._config||!Array.isArray(this._config.rooms))return -1;
    const h=String(location.hash||'').replace(/^#/,'');
    if(!h)return -1;
    let val=null;
    h.split('&').forEach(function(p){
      const eq=p.indexOf('=');
      if(eq>0&&decodeURIComponent(p.slice(0,eq))===key)val=decodeURIComponent(p.slice(eq+1));
    });
    return val===null?-1:roomMatch(this._config,val);
  }
  _writeRoomHash(idx){
    const key=this._urlSyncKey();
    if(!key||typeof location==='undefined'||!this._config||!Array.isArray(this._config.rooms))return;
    const r=this._config.rooms[Math.max(0,Math.min(idx,this._config.rooms.length-1))];
    const val=encodeURIComponent(String(r.id||r.name||idx));
    // Keep any unrelated hash params, replace just our key
    const parts=String(location.hash||'').replace(/^#/,'').split('&').filter(Boolean)
      .filter(function(p){const eq=p.indexOf('=');return!(eq>0&&decodeURIComponent(p.slice(0,eq))===key);});
    parts.push(encodeURIComponent(key)+'='+val);
    const newHash='#'+parts.join('&');
    if((location.hash||'')===newHash)return; // already current
    try{history.replaceState(history.state,'',location.pathname+location.search+newHash);}
    catch(_){this._hashMuted=true;location.hash=newHash;this._hashMuted=false;}
  }

  // Jump to the room reported by the presence sensor (used by the nav button
  // and the follow-room action); clears the manual-navigation hold
  _followNow(){
    const reId=this._roomEntityId();
    if(!reId||!this._hass)return;
    const ri=roomMatch(this._config,this._hass.states[reId]?.state);
    if(ri<0)return;
    this._manualHoldUntil=0;
    if(ri!==this._roomIdx)this._switchRoom(ri,ri>this._roomIdx?1:-1,false);
  }

  // Remember the room currently shown, so the editor can open on it (see ROC_ROOM_MEM).
  _rememberRoom(){
    try{
      const cAll=this._config;
      if(!cAll||!Array.isArray(cAll.rooms)||!cAll.rooms.length)return;
      const r=cAll.rooms[Math.max(0,Math.min(this._roomIdx,cAll.rooms.length-1))];
      if(r)ROC_ROOM_MEM.set(cfgKey(cAll),String(r.id||r.name||this._roomIdx));
    }catch(_){}
  }

  _switchRoom(idx,dir,manual,noGhost){
    const cAll=this._config;
    if(!Array.isArray(cAll.rooms)||idx<0||idx>=cAll.rooms.length||idx===this._roomIdx)return;
    if(manual)this._manualHoldUntil=Date.now()+((cAll.follow_hold??60)*1000);
    if(Math.abs(idx-this._roomIdx)>1)dir=0; // non-adjacent → crossfade
    // Ghost of the old room for the transition (embedded cards render blank in
    // the clone for ~0.3 s — acceptable)
    const oldContent=this.shadowRoot?this.shadowRoot.querySelector('.wrap .content'):null;
    let ghost=null;
    if(oldContent&&!noGhost){ // swipe-commit passes noGhost — the drag preview already covers the transition (and a translated clone leaks a sliver under lock_aspect)
      ghost=oldContent.cloneNode(true);
      ghost.style.position='absolute';ghost.style.inset='0';ghost.style.zIndex='600';
      ghost.style.pointerEvents='none';
      ghost.style.transition='transform .3s ease,opacity .3s ease';
    }
    this._roomIdx=idx;
    this._rememberRoom(); // record the room the user switched to (for the editor)
    // Editor preview instance (see _mountPreview): tell the editor GUI so its
    // Room select / per-room panels follow clicks made inside the live preview's
    // own nav strip, instead of silently staying on the previously selected room.
    if(cAll._roc_preview)window.dispatchEvent(new CustomEvent('roc-room-switch',{detail:{cfgKey:cfgKey(cAll),idx:idx}}));
    this._rendered=false;
    this._render();
    const wrap=this.shadowRoot.querySelector('.wrap');
    const ncontent=this.shadowRoot.querySelector('.content');
    if(ghost&&wrap&&ncontent){
      wrap.appendChild(ghost);
      // visual-only rAF below: starts the slide/fade; in a hidden tab it never
      // fires, but the 380ms setTimeout removes the ghost regardless — safe
      if(dir){
        ncontent.style.transition='none';
        ncontent.style.transform='translateX('+(dir*100)+'%)';
        requestAnimationFrame(function(){
          ncontent.style.transition='transform .3s ease';
          ncontent.style.transform='';
          ghost.style.transform='translateX('+(-dir*100)+'%)';
        });
      }else{
        requestAnimationFrame(function(){ghost.style.opacity='0';});
      }
      setTimeout(function(){ghost.remove();if(ncontent)ncontent.style.transition='';},380);
    }
    // Manual switches sync back to a writable room_entity (input_select/select)
    const _reW=this._roomEntityId();
    if(manual&&_reW&&this._hass){
      const dom=_reW.split('.')[0];
      if(dom==='input_select'||dom==='select'){
        const r=cAll.rooms[idx];
        const opts=this._hass.states[_reW]?.attributes?.options||[];
        const opt=opts.find(function(o){
          const ol=String(o).toLowerCase();
          return ol===String(r.id||'').toLowerCase()||ol===String(r.name||'').toLowerCase()||(Array.isArray(r.area_match)&&r.area_match.some(function(a){return String(a).toLowerCase()===ol;}));
        });
        if(opt)this._hass.callService(dom,'select_option',{entity_id:_reW,option:opt});
      }
    }
    this._writeRoomHash(idx); // keep the URL hash in sync (opt-in via url_sync)
    this._syncRoomState();
  }

  _startCamera(){
    if(this._camTimer){clearInterval(this._camTimer);this._camTimer=null;}
    if(this._config&&this._config._roc_ghost)return; // swipe ghosts live <0.5 s — no camera churn
    // base_camera / camera_refresh are room-scoped keys → use the merged room view
    const c=this._roomCfg||this._config;if(!c||!c.base_camera)return;
    const iv=Math.max(2,c.camera_refresh??10)*1000;
    const self=this;
    const tick=function(){
      if(!self._hass||!self._visible||!self._baseEl)return;
      const st=self._hass.states[c.base_camera];
      const ep=st&&st.attributes&&st.attributes.entity_picture;
      if(!ep)return;
      const url=ep+(ep.includes('?')?'&':'?')+'_roc='+Date.now();
      const img=new Image();
      img.onload=function(){if(self._baseEl)self._baseEl.style.backgroundImage='url("'+url.replace(/"/g,'%22')+'")';};
      img.src=url;
    };
    tick();
    this._camTimer=setInterval(tick,iv);
  }

  _teardownTemplates(){
    (this._tmplUnsubs||[]).forEach(function(u){
      try{
        if(u&&typeof u.then==='function')u.then(function(f){try{if(typeof f==='function')f();else if(f&&f.unsubscribe)f.unsubscribe();}catch(_){}});
        else if(typeof u==='function')u();
      }catch(_){}
    });
    this._tmplUnsubs=[];this._tmplVals={};this._tmplVis={};
  }

  _setupTemplates(){
    const c=this._config,self=this;
    // nav.live:full minis subscribe to templates only when nav.mini.templates
    // opts in (§5 NAV_LIVE_FULL_PLAN.md — a real per-instance WS subscription
    // cost, off by default for up to 8 persistent instances).
    if(!this._hass||!this._hass.connection||c._roc_ghost||(c._roc_mini&&!c._roc_mini_templates))return;
    const sub=function(tpl,cb){
      try{
        const p=self._hass.connection.subscribeMessage(function(msg){cb(msg?msg.result:undefined);},{type:'render_template',template:tpl});
        self._tmplUnsubs.push(p);
      }catch(e){console.warn('[room-overlay-card] template subscribe failed:',e);}
    };
    // Label text templates
    for(const lbl of(c.labels||[])){
      if(!lbl.template)continue;
      const el=this._lblEls[lbl.id];if(!el)continue;
      const lblId=lbl.id,grad=this._sortedLblGrads[lblId];
      sub(lbl.template,function(r){
        const v=r!==undefined&&r!==null?String(r):'';
        self._tmplVals[lblId]=v;
        if(el.textContent!==v)el.textContent=v;
        if(grad){const nv=parseFloat(v);if(!isNaN(nv))el.style.color=lerpColorGradient(grad,nv,true);}
      });
    }
    // Badge label templates
    for(const b of(c.badges||[])){
      if(!b.label_template)continue;
      const lel=this._blabelEls[b.id];if(!lel)continue;
      sub(b.label_template,function(r){
        const v=r!==undefined&&r!==null?String(r):'';
        if(lel.textContent!==v)lel.textContent=v;
      });
    }
    // visible_template — zones, icons, badges, overlays, elements, gauges (incl. blinds)
    const vis=function(key,tpl,el,showDisp,it){
      if(!tpl||!el)return;
      sub(tpl,function(r){
        const ok=tmplTruthy(r);
        self._tmplVis[key]=ok;
        self._setVis(el,ok,showDisp,it&&it.fade,it&&it.slide);
      });
    };
    for(const z of(c.zones||[]))vis('z:'+z.id,z.visible_template,this._zoneEls[z.id],'',z);
    for(const ico of(c.icons||[]))vis('i:'+ico.id,ico.visible_template,this._icoEls[ico.id],'flex',ico);
    for(const b of(c.badges||[]))vis('b:'+b.id,b.visible_template,this._bcontEls[b.id],'flex',b);
    for(const ov of(c.overlays||[]))vis('o:'+ov.id,ov.visible_template,this._ovEls[ov.id],'',null);
    for(const e of(c.elements||[]))vis('e:'+e.id,e.visible_template,this._contEls[e.id],'block',e);
    for(const g of[...(c.gauges||[]),...(this._blindGaugeCfgs||[])])vis('g:'+g.id,g.visible_template,this._gaugeEls[g.id],'',g);
  }

  _setGrpVis(el,show){
    if(!el)return;
    // Respect item-level fade state (rocFv) when the group comes back
    const v=(!show||el.dataset.rocFv==='0')?'hidden':'';
    if(el.style.visibility!==v){
      el.style.visibility=v;
      el.style.opacity=v?'0':'';
    }
  }

  // Item visibility with optional fade/slide animation.
  // fd: true|seconds, sl: up|down|left|right (slide implies fade)
  _setVis(el,show,disp,fd,sl){
    if(!el)return;
    if(!fd&&!sl){setSt(el,'display',show?disp:'none');return;}
    setSt(el,'display',disp); // keep in layout — animate via opacity/visibility
    if(typeof fd==='number'&&fd>0)el.style.transitionDuration=fd+'s';
    const key=show?'1':'0';
    if(el.dataset.rocFv!==key){
      el.dataset.rocFv=key;
      el.style.visibility=show?'':'hidden';
      el.style.opacity=show?'':'0';
      if(sl){
        const ax=(sl==='up'||sl==='down')?'Y':'X';
        const sign=(sl==='down'||sl==='right')?'-':'';
        el.style.transform=show?'':'translate'+ax+'('+sign+'10px)';
      }
    }
  }

  // 3D parallax tilt of the whole scene. Pointer-driven on desktop; device
  // orientation on platforms that expose it without a permission prompt
  // (iOS requires a user-gesture prompt, deliberately not triggered here).
  _attachParallax(wrap,content){
    const self=this;
    const pc=typeof this._roomCfg.parallax==='object'&&this._roomCfg.parallax?this._roomCfg.parallax:{};
    const strength=pc.strength??6,scale=pc.scale??1.04;
    const src=pc.source||'auto';
    wrap.style.perspective='900px';
    let raf=0,tx=0,ty=0;
    const apply=function(){
      raf=0;
      if(self._zoomScale>1||self._roomDragActive)return; // those gestures own the transform
      content.style.transition='transform .12s ease-out';
      content.style.transform=(tx===0&&ty===0)?'':'scale('+scale+') rotateX('+ty.toFixed(2)+'deg) rotateY('+tx.toFixed(2)+'deg)';
    };
    const queue=function(){if(!raf)raf=requestAnimationFrame(apply);}; // visual-only (parallax); pointer events don't occur in hidden tabs
    if(src!=='orientation'){
      wrap.addEventListener('pointermove',function(e){
        if(e.pointerType==='touch')return;
        const r=wrap.getBoundingClientRect();
        tx=((e.clientX-r.left)/r.width-0.5)*2*strength;
        ty=-((e.clientY-r.top)/r.height-0.5)*2*strength;
        queue();
      });
      wrap.addEventListener('pointerleave',function(){tx=0;ty=0;queue();});
    }
    if((src==='orientation'||src==='auto')&&typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission!=='function'){
      const oh=function(ev){
        if(ev.gamma===null||ev.beta===null)return;
        tx=Math.max(-strength,Math.min(strength,ev.gamma/4));
        ty=Math.max(-strength,Math.min(strength,-(ev.beta-45)/4));
        queue();
      };
      window.addEventListener('deviceorientation',oh);
      this._orientHandler=oh;
    }
  }

  // Live room drag: content follows the finger, the neighbour's base image is
  // revealed alongside; release past 25 % width (or fling) commits the switch.
  _attachRoomDrag(wrap){
    const self=this;
    this._wrapTA='pan-y';
    wrap.style.touchAction='pan-y';
    let pid=null,sx=0,sy=0,active=false,engaged=false,dx=0,prev=null,dir2=0,w=0,moved=false,lastX=0,lastT=0,vx=0;
    const content=function(){return self.shadowRoot?self.shadowRoot.querySelector('.wrap .content'):null;};
    wrap.addEventListener('pointerdown',function(e){
      if(self._zoomScale>1)return;
      const path=e.composedPath?e.composedPath():[];
      // Slider zones and embedded HA cards (sliders, covers…) own their gestures
      if(path.some(function(n){return(n.dataset&&n.dataset.rocSlider)||(n.classList&&n.classList.contains('elcont'));}))return;
      pid=e.pointerId;sx=e.clientX;sy=e.clientY;active=true;engaged=false;dx=0;
      lastX=e.clientX;lastT=Date.now();vx=0;
      w=wrap.getBoundingClientRect().width||1;
    });
    wrap.addEventListener('pointermove',function(e){
      if(!active||e.pointerId!==pid)return;
      dx=e.clientX-sx;
      const now=Date.now();
      if(now>lastT){vx=(e.clientX-lastX)/(now-lastT);lastX=e.clientX;lastT=now;}
      if(!engaged){
        const dy=e.clientY-sy;
        if(Math.abs(dx)<12||Math.abs(dx)<1.5*Math.abs(dy))return; // horizontal intent only
        engaged=true;moved=true;self._roomDragActive=true;
        try{wrap.setPointerCapture(pid);}catch(_){}
        dir2=dx<0?1:-1;
        const n=self._config.rooms.length;
        const ni=(self._roomIdx+dir2+n)%n;
        prev=document.createElement('div');
        prev.style.cssText='position:absolute;inset:0;z-index:590;pointer-events:none;overflow:hidden;background:#000;';
        wrap.appendChild(prev);
        self._renderNeighbourPreview(prev,ni); // full-room render (img+filters+overlays+states)
        const ct=content();if(ct)ct.style.transition='none';
      }
      e.preventDefault();
      const ndir=dx<0?1:-1;
      if(ndir!==dir2&&prev){ // direction flipped mid-drag → swap neighbour preview
        dir2=ndir;
        const n=self._config.rooms.length;
        self._renderNeighbourPreview(prev,(self._roomIdx+dir2+n)%n);
      }
      const ct=content();
      if(ct)ct.style.transform='translateX('+dx+'px)';
      if(prev)prev.style.transform='translateX('+(dir2>0?w+dx:-w+dx)+'px)';
    });
    wrap.addEventListener('pointerup',function(){
      if(!active)return;
      active=false;
      if(!engaged)return;
      engaged=false;self._roomDragActive=false;self._lastRoomDragEnd=Date.now();
      const ct=content();
      const fling=Math.abs(vx)>0.5&&(vx<0)===(dir2>0);
      const commit=Math.abs(dx)>w*0.25||fling;
      const pv=prev;prev=null;
      if(commit){
        const n=self._config.rooms.length;
        const ni=(self._roomIdx+dir2+n)%n;
        const target=dir2>0?-w:w;
        if(ct){ct.style.transition='transform .18s ease-out';ct.style.transform='translateX('+target+'px)';}
        if(pv){pv.style.transition='transform .18s ease-out';pv.style.transform='translateX(0)';}
        setTimeout(function(){
          self._switchRoom(ni,0,true,true); // re-render under the settled preview (no crossfade ghost — pv already covers it)
          setTimeout(function(){if(pv)pv.remove();},80);
        },180);
      }else{
        if(ct){ct.style.transition='transform .2s ease';ct.style.transform='';}
        if(pv){pv.style.transition='transform .2s ease';pv.style.transform='translateX('+(dir2>0?w:-w)+'px)';setTimeout(function(){pv.remove();},230);}
        setTimeout(function(){const c2=content();if(c2)c2.style.transition='';},230);
      }
    });
    wrap.addEventListener('pointercancel',function(){
      if(prev){prev.remove();prev=null;}
      const ct=content();if(ct){ct.style.transition='';ct.style.transform='';}
      active=false;engaged=false;moved=false;self._roomDragActive=false;self._lastRoomDragEnd=Date.now();
    });
    // Swallow the click that follows a drag (capture phase beats zone handlers)
    wrap.addEventListener('click',function(e){if(moved){moved=false;e.stopImmediatePropagation();e.preventDefault();}},true);
  }

  // Full-room neighbour preview for the finger-drag: a real, non-interactive
  // card instance rendering the target room — image + filters + overlays + live
  // states (not just the base image). Falls back to the plain base image if the
  // instance can't be created. Reuses the same pattern as the editor live preview.
  _renderNeighbourPreview(prevEl,idx){
    const cAll=this._config;
    const r=(cAll.rooms&&cAll.rooms[idx])||null;
    if(prevEl._ghost){try{prevEl._ghost.remove();}catch(_){}prevEl._ghost=null;}
    prevEl.style.backgroundImage='';
    try{
      const gc=document.createElement('room-overlay-card');
      const gcfg=rocClone(cAll);
      gcfg.follow_mode='manual';                              // no presence jumps in the ghost
      gcfg._roc_preview=true;                                 // suppress Save button etc.
      gcfg._roc_ghost=true;                                   // skip template subscriptions & camera timers (<0.5 s lifetime)
      gcfg.test_mode=false;
      gcfg.nav=Object.assign({},gcfg.nav||{},{style:'none'}); // the real card owns the nav strip
      delete gcfg.cards_above;delete gcfg.cards_below;delete gcfg.light_controls; // keep the preview to the image box…
      // …and strip the PER-ROOM strips too — cards_above/below and light_controls are room-scoped
      // (in ROOM_KEYS), so the previewed room pulls its own from rooms[idx];
      // without this they render above/below the ghost image and slide in with it.
      if(Array.isArray(gcfg.rooms))gcfg.rooms.forEach(function(_r){if(_r){delete _r.cards_above;delete _r.cards_below;delete _r.light_controls;}});
      delete gcfg.url_sync;                                   // the ghost must never touch the URL hash
      gc.style.cssText='display:block;position:absolute;top:0;left:0;width:100%;height:100%;';
      gc.setConfig(gcfg);
      gc._roomIdx=Math.max(0,Math.min(idx,(cAll.rooms||[]).length-1));
      if(this._hass)gc.hass=this._hass;
      prevEl.appendChild(gc);
      prevEl._ghost=gc;
    }catch(e){
      prevEl.style.backgroundSize='cover';
      prevEl.style.backgroundPosition='center';
      prevEl.style.backgroundImage=r&&r.base_image?'url("'+String(r.base_image).replace(/"/g,'%22')+'")':'';
    }
  }

  _attachZoom(wrap,content){
    const ptrs=new Map();
    const zSelf=this;
    let scale=1,tx=0,ty=0,lastDist=0,lastTap=0;
    const apply=function(){
      const r=wrap.getBoundingClientRect();
      const maxX=(scale-1)*r.width/2,maxY=(scale-1)*r.height/2;
      tx=Math.max(-maxX,Math.min(maxX,tx));
      ty=Math.max(-maxY,Math.min(maxY,ty));
      content.style.transform=scale>1?'translate('+tx+'px,'+ty+'px) scale('+scale+')':'';
      wrap.style.touchAction=scale>1?'none':(zSelf._wrapTA||'');
      zSelf._zoomScale=scale;
    };
    wrap.addEventListener('pointerdown',function(e){
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.size===2){const a=[...ptrs.values()];lastDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
    });
    wrap.addEventListener('pointermove',function(e){
      if(!ptrs.has(e.pointerId))return;
      const p=ptrs.get(e.pointerId);
      if(ptrs.size===2){
        ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const a=[...ptrs.values()];
        const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
        if(lastDist>0){scale=Math.max(1,Math.min(4,scale*d/lastDist));apply();}
        lastDist=d;
        e.preventDefault();
      }else if(ptrs.size===1&&scale>1){
        tx+=e.clientX-p.x;ty+=e.clientY-p.y;
        ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
        apply();
        e.preventDefault();
      }
    });
    const end=function(e){
      ptrs.delete(e.pointerId);
      lastDist=0;
      const now=Date.now();
      if(now-lastTap<300){scale=1;tx=0;ty=0;apply();} // double tap resets
      lastTap=now;
    };
    wrap.addEventListener('pointerup',end);
    wrap.addEventListener('pointercancel',function(e){ptrs.delete(e.pointerId);lastDist=0;});
    wrap.addEventListener('wheel',function(e){ // desktop: Ctrl+wheel
      if(!e.ctrlKey)return;
      e.preventDefault();
      scale=Math.max(1,Math.min(4,scale*(e.deltaY<0?1.15:0.87)));
      apply();
    },{passive:false});
  }

  _attachSlider(el,z){
    const self=this,sl=z.slider;
    el.style.touchAction='none';
    el.dataset.rocSlider='1';
    const horiz=sl.direction==='horizontal';
    const fill=document.createElement('div');
    fill.className='zslider-fill';
    fill.style.cssText='position:absolute;pointer-events:none;background:'+(sl.color||'rgba(255,255,255,0.28)')+';opacity:0;transition:opacity .2s;'+(horiz?'left:0;top:0;bottom:0;width:0%;':'left:0;right:0;bottom:0;height:0%;');
    el.appendChild(fill);
    // Value bubble — precise readout while dragging
    const bub=document.createElement('div');
    bub.className='zslider-bubble';
    bub.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;background:rgba(0,0,0,0.78);color:#fff;font-family:monospace;font-size:12px;font-weight:600;padding:3px 9px;border-radius:10px;opacity:0;transition:opacity .15s;white-space:nowrap;z-index:5;';
    el.appendChild(bub);
    // min/max: explicit slider config → entity attributes (climate min_temp/max_temp,
    // number min/max) → generic 0–100. Keeps climate sliders in a sane range.
    const _range=function(){
      const dom=sl.entity.split('.')[0];
      const attr=(self._hass&&self._hass.states[sl.entity]&&self._hass.states[sl.entity].attributes)||{};
      if(dom==='climate')return[sl.min??attr.min_temp??7,sl.max??attr.max_temp??35];
      if(dom==='number'||dom==='input_number')return[sl.min??attr.min??0,sl.max??attr.max??100];
      return[sl.min??0,sl.max??100];
    };
    const _fmtVal=function(p){
      const dom=sl.entity.split('.')[0];
      if(dom==='light'||dom==='cover'||dom==='fan'||dom==='media_player')return Math.round(p*100)+' %';
      const r=_range();
      if(dom==='climate')return(Math.round((r[0]+p*(r[1]-r[0]))*2)/2)+' °';
      return String(Math.round((r[0]+p*(r[1]-r[0]))*100)/100);
    };
    let active=false,moved=false,pct=0,sx=0,sy=0,lastSent=0;
    const calc=function(ev){
      const r=el.getBoundingClientRect();
      let p=horiz?(ev.clientX-r.left)/r.width:1-(ev.clientY-r.top)/r.height;
      if(sl.invert)p=1-p;
      return Math.max(0,Math.min(1,p));
    };
    const apply=function(p){
      const h=self._hass;if(!h)return;
      const ent=sl.entity,dom=ent.split('.')[0];
      const _r=_range(),mn=_r[0],mx=_r[1];
      if(dom==='light')h.callService('light','turn_on',{entity_id:ent,brightness_pct:Math.round(p*100)});
      else if(dom==='cover')h.callService('cover','set_cover_position',{entity_id:ent,position:Math.round(p*100)});
      else if(dom==='fan')h.callService('fan','set_percentage',{entity_id:ent,percentage:Math.round(p*100)});
      else if(dom==='media_player')h.callService('media_player','volume_set',{entity_id:ent,volume_level:Math.round(p*100)/100});
      else if(dom==='number'||dom==='input_number')h.callService(dom,'set_value',{entity_id:ent,value:Math.round((mn+p*(mx-mn))*100)/100});
      else if(dom==='climate')h.callService('climate','set_temperature',{entity_id:ent,temperature:Math.round((mn+p*(mx-mn))*2)/2});
      else console.warn('[room-overlay-card] slider: unsupported domain',dom);
    };
    el.addEventListener('pointerdown',function(e){
      if(self._config.test_mode)return;
      active=true;moved=false;sx=e.clientX;sy=e.clientY;
      try{el.setPointerCapture(e.pointerId);}catch(_){}
    });
    el.addEventListener('pointermove',function(e){
      if(!active)return;
      if(!moved&&Math.abs(horiz?e.clientX-sx:e.clientY-sy)<6)return;
      moved=true;
      pct=calc(e);
      fill.style.opacity='1';
      if(horiz)fill.style.width=(pct*100).toFixed(1)+'%';
      else fill.style.height=(pct*100).toFixed(1)+'%';
      bub.textContent=_fmtVal(pct);bub.style.opacity='1';
      if(sl.live){const now=Date.now();if(now-lastSent>250){lastSent=now;apply(pct);}}
    });
    el.addEventListener('pointerup',function(e){
      if(!active)return;
      active=false;
      if(moved){el._rocSlid=true;e.stopPropagation();apply(pct);setTimeout(function(){el._rocSlid=false;},400);}
      setTimeout(function(){fill.style.opacity='0';bub.style.opacity='0';},250);
    });
    el.addEventListener('pointercancel',function(){active=false;fill.style.opacity='0';bub.style.opacity='0';});
  }

  // Drag the vertical cover rail -> cover.set_cover_position (throttled, live).
  _attachCoverRail(rec){
    const self=this,el=rec.rail,cc=rec.cfg,horiz=rec.horiz;
    el.style.touchAction='none';
    let active=false,pct=0,lastSent=0;
    const calc=function(ev){const r=el.getBoundingClientRect();let p=horiz?((ev.clientX-r.left)/r.width):(1-(ev.clientY-r.top)/r.height);return Math.max(0,Math.min(1,p));};
    const paint=function(p){const v=(Math.round(p*1000)/10);if(rec.fill){if(horiz)rec.fill.style.width=v+'%';else rec.fill.style.height=v+'%';}if(rec.thumb){if(horiz)rec.thumb.style.left=v+'%';else rec.thumb.style.bottom=v+'%';}if(rec.pct)rec.pct.textContent=Math.round(p*100)+' %';};
    const send=function(p){const h=self._hass;if(!h)return;h.callService('cover','set_cover_position',{entity_id:cc.entity,position:Math.round(p*100)});};
    el.addEventListener('pointerdown',function(e){if(self._config&&self._config.test_mode)return;active=true;e.stopPropagation();try{el.setPointerCapture(e.pointerId);}catch(_){}rec._userHold=Date.now();pct=calc(e);paint(pct);});
    el.addEventListener('pointermove',function(e){if(!active)return;e.stopPropagation();rec._userHold=Date.now();pct=calc(e);paint(pct);const now=Date.now();if(now-lastSent>250){lastSent=now;send(pct);}});
    el.addEventListener('pointerup',function(e){if(!active)return;active=false;e.stopPropagation();rec._userHold=Date.now();send(pct);});
    el.addEventListener('pointercancel',function(){active=false;});
  }

  // Cover control -> toggle visibility (reveal on blind tap; only one shown at a time).
  _toggleCoverPop(id){
    const rec=this._ccEls&&this._ccEls[id];if(!rec||rec.mode==='dock')return;
    const showing=rec.root.style.display!=='none';
    for(const k in this._ccEls){if(this._ccEls[k].mode!=='dock')this._ccEls[k].root.style.display='none';}
    if(!showing)rec.root.style.display='';
  }

  getGridOptions(){
    // `rows` intentionally NOT defined — the card's height comes from
    // aspect_ratio (padding-bottom). Declaring rows makes the grid cell
    // smaller than the rendered card, so following cards overlap it.
    return{columns:12,min_columns:6};
  }

  _makeResizable(el,onResize){
    // 6 handles: 4 corners + right edge + bottom edge
    const hs=[
      {p:'top:-6px;left:-6px',c:'nw-resize',w:-1,h:-1,ml:true,mt:true},
      {p:'top:-6px;right:-6px',c:'ne-resize',w:1,h:-1,ml:false,mt:true},
      {p:'bottom:-6px;left:-6px',c:'sw-resize',w:-1,h:1,ml:true,mt:false},
      {p:'bottom:-6px;right:-6px',c:'se-resize',w:1,h:1,ml:false,mt:false},
      {p:'top:calc(50% - 5px);right:-6px',c:'e-resize',w:1,h:0,ml:false,mt:false},
      {p:'left:calc(50% - 5px);bottom:-6px',c:'s-resize',w:0,h:1,ml:false,mt:false},
    ];
    el.style.overflow='visible';
    const self=this;
    hs.forEach(function(hd){
      const h=document.createElement('div');
      h.className='roc-rh';
      h.style.cssText='position:absolute;'+hd.p+';width:10px;height:10px;background:var(--primary-color,#03a9f4);border:2px solid #fff;border-radius:2px;z-index:1000;cursor:'+hd.c+';box-sizing:border-box;pointer-events:auto;display:none;';
      el.appendChild(h);
      h.style.touchAction='none'; // Pointer Events also cover touch (tablet resize)
      h.addEventListener('mousedown',function(e){e.stopPropagation();e.preventDefault();}); // keep the host's drag handlers quiet
      h.addEventListener('touchstart',function(e){e.stopPropagation();},{passive:true});
      h.addEventListener('pointerdown',function(e){
        e.stopPropagation();e.preventDefault();
        const cont=self.shadowRoot.querySelector('.content');if(!cont)return;
        const rect=cont.getBoundingClientRect();
        const sx=e.clientX,sy=e.clientY;
        const st=parseFloat(el.style.top)||0,sl=parseFloat(el.style.left)||0;
        const sw=parseFloat(el.style.width)||10,sh=parseFloat(el.style.height)||10;
        function onMove(ev){
          const dx=(ev.clientX-sx)/rect.width*100,dy=(ev.clientY-sy)/rect.height*100;
          const snap=function(v){return ev.altKey?v:Math.round(v*2)/2;}; // 0.5 % grid, Alt = free
          if(hd.w!==0){const nw=Math.max(2,snap(sw+hd.w*dx));el.style.width=nw.toFixed(1)+'%';if(hd.ml)el.style.left=snap(sl+dx).toFixed(1)+'%';}
          if(hd.h!==0){const nh=Math.max(2,snap(sh+hd.h*dy));el.style.height=nh.toFixed(1)+'%';if(hd.mt)el.style.top=snap(st+dy).toFixed(1)+'%';}
        }
        function onUp(){document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerup',onUp);document.removeEventListener('pointercancel',onUp);onResize(el.style.top,el.style.left,el.style.width,el.style.height);}
        document.addEventListener('pointermove',onMove);document.addEventListener('pointerup',onUp);document.addEventListener('pointercancel',onUp);
      });
    });
  }

  _makeDraggable(el,onDrop){
    const self=this;
    let dragOccurred=false;
    el.addEventListener('mousedown',function(e){
      if(e.button!==0)return;
      const cont=self.shadowRoot.querySelector('.content');
      if(!cont)return;
      const rect=cont.getBoundingClientRect();
      const startX=e.clientX,startY=e.clientY;
      const startTop=parseFloat(el.style.top)||0,startLeft=parseFloat(el.style.left)||0;
      const cands=self._snapCandidates();
      let moved=false;
      function onMove(e){
        const dx=e.clientX-startX,dy=e.clientY-startY;
        if(!moved&&Math.sqrt(dx*dx+dy*dy)<5)return;
        moved=true;e.preventDefault();e.stopPropagation();
        const sp=self._snapPos(
          Math.max(0,Math.min(98,startTop+dy/rect.height*100)),
          Math.max(0,Math.min(98,startLeft+dx/rect.width*100)),
          e.altKey,cands);
        el.style.top=sp.t.toFixed(1)+'%';
        el.style.left=sp.l.toFixed(1)+'%';
      }
      function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);self._hideGuides();if(moved){dragOccurred=true;setTimeout(function(){dragOccurred=false;},400);onDrop(el.style.top,el.style.left);}}
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    el.addEventListener('touchstart',function(e){
      const cont=self.shadowRoot.querySelector('.content');if(!cont)return;
      const rect=cont.getBoundingClientRect();
      const t0=e.touches[0],startX=t0.clientX,startY=t0.clientY;
      const startTop=parseFloat(el.style.top)||0,startLeft=parseFloat(el.style.left)||0;
      let moved=false;
      const tCands=self._snapCandidates();
      function onTMove(e){const t=e.touches[0],dx=t.clientX-startX,dy=t.clientY-startY;if(!moved&&Math.sqrt(dx*dx+dy*dy)<5)return;moved=true;e.preventDefault();e.stopPropagation();const sp=self._snapPos(Math.max(0,Math.min(98,startTop+dy/rect.height*100)),Math.max(0,Math.min(98,startLeft+dx/rect.width*100)),false,tCands);el.style.top=sp.t.toFixed(1)+'%';el.style.left=sp.l.toFixed(1)+'%';}
      function onTEnd(){el.removeEventListener('touchmove',onTMove);el.removeEventListener('touchend',onTEnd);self._hideGuides();if(moved){dragOccurred=true;setTimeout(function(){dragOccurred=false;},400);onDrop(el.style.top,el.style.left);}}
      el.addEventListener('touchmove',onTMove,{passive:false});el.addEventListener('touchend',onTEnd);
    },{passive:true});
    // Suppress click after drag — capture phase fires before zone/icon tap listeners
    el.addEventListener('click',function(e){if(dragOccurred){e.stopImmediatePropagation();e.preventDefault();dragOccurred=false;}},true);
  }

  // Inject the pill shape + border transition into the slider's own shadow root.
  // Colours (--bsc-background / --bsc-border-color) are set inline on the host so
  // they stay authoritative over this stylesheet and can update live.
  _syncLcToggleHeights(){
    if(!this._lcToggles||!this._lcToggles.length||!this.shadowRoot)return;
    const host=this.shadowRoot.querySelector('.roc-lc [data-lc-card]');
    if(!host)return; // no sliders present → toggles keep their configured height
    const h=host.offsetHeight;
    if(h>0)for(const t of this._lcToggles){try{t.el.style.height=h+'px';}catch(_){}}
  }
  _injectLcStyle(el,bgOff,col){
    if(!el)return null;
    const st=document.createElement('style');
    st.setAttribute('data-roc-lc','');
    st.textContent=lcSliderCss(bgOff,col);
    const attach=function(n){
      const sr=el.shadowRoot;
      if(sr){if(!sr.querySelector('style[data-roc-lc]'))sr.appendChild(st);return;}
      if(n<20)setTimeout(function(){attach(n+1);},50);
    };
    attach(0);
    return st;
  }

  _update(){
    if(!this._hass||!this._config||!this._rendered)return;
    // Throttled root-height re-check piggybacked on state updates: leaving
    // dashboard edit mode removes HA's card-actions bar WITHOUT resizing the
    // scroller or recreating the card — no observer fires, and the card would
    // stay pinned at the shorter edit-mode height. State updates tick steadily,
    // and the pin early-outs when nothing changed, so this is nearly free.
    const _pcNow=Date.now();
    if(!this._lastPinCheck||_pcNow-this._lastPinCheck>1000){this._lastPinCheck=_pcNow;this._requestPin('state-update');}
    const s=this._hass.states;
    const cAll=this._config;
    const c=this._roomCfg||roomMerge(cAll,this._roomIdx); // active room view
    // room_entity follow (e.g. Bermuda area sensor) — manual switches hold priority.
    // follow_mode: always (default) | initial (only the first match after load) | manual (button/action only)
    const _reId=this._roomEntityId();
    const _fMode=cAll.follow_mode||'always';
    if(_reId&&Array.isArray(cAll.rooms)&&cAll.rooms.length&&_fMode!=='manual'&&!(_fMode==='initial'&&this._followInit)){
      const ri=roomMatch(cAll,s[_reId]?.state);
      if(ri>=0){
        this._followInit=true;
        if(ri!==this._roomIdx&&Date.now()>this._manualHoldUntil){
          this._switchRoom(ri,0,false);
          return;
        }
      }
    }
    // Follow button: accent colour while we're away from the presence room
    if(this._navFollowEl&&_reId){
      const _fri=roomMatch(cAll,s[_reId]?.state);
      setSt(this._navFollowEl,'color',(_fri>=0&&_fri!==this._roomIdx)?'var(--primary-color,#03a9f4)':'');
    }
    // Re-render when the active layout profile changes (resize / rotation)
    let _rtNow=rocProfile(cAll,window.innerWidth||0,window.innerHeight||0);
    if((c.test_mode??false)&&this._profFlipped)_rtNow=(_rtNow==='portrait')?'landscape':'portrait';
    const _tierNow=(c.test_mode??false)?null:_rtNow;
    if(_tierNow!==this._tier||_rtNow!==this._vt){this._rendered=false;this._render();return;}
    // Live viewport/profile readout in test mode (updates on resize without re-render)
    if(this._tmInfoEl)this._tmInfoEl.innerHTML='&#128208; '+Math.round(window.innerWidth||0)+'&#215;'+Math.round(window.innerHeight||0)+'<br><span style="font-weight:normal;opacity:0.85;">profile: '+_rtNow+'</span>';
    const flipped=(c.test_mode??false)&&this._testFlipped;
    if(this._baseEl){
      let _bf=flipped?null:bmFilter(c.brightness_model,s,this._sortedBmFg);
      if(_bf===null)_bf=c.filter_conditions?.length?(flipped?resolveFilterInverted(c.filter_conditions,s):resolveFilter(c.filter_conditions,s)):'none';
      setSt(this._baseEl,'filter',_bf);
      // Conditional base image (static images only — base_camera drives its own refresh)
      if(c.base_image_conditions?.length&&!c.base_camera){
        let _bimg=c.base_image;
        for(const bc of c.base_image_conditions){
          if(bc.condition===undefined){_bimg=bc.image;continue;}
          if(evalCond(bc.condition,s)){_bimg=bc.image;break;}
        }
        if(_bimg){const _bbg='url(\''+escUrl(_bimg)+'\')';if(this._baseEl.style.backgroundImage!==_bbg)this._baseEl.style.backgroundImage=_bbg;}
      }
    }
    for(const ov of(c.overlays||[])){
      const el=this._ovEls[ov.id];if(!el)continue;
      const gShow=!ov.group||(this._groupState[ov.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      if(ov.visible_template!==undefined)setSt(el,'display',(this._tmplVis['o:'+ov.id]??true)?'':'none');
      const img=this._ovImg(ov);
      if(img){const bg='url(\''+escUrl(img)+'\')';if(el.style.backgroundImage!==bg)el.style.backgroundImage=bg;}
      const rawOp=ov.conditions?.opacity?Number(resolveVal(ov.conditions.opacity,s,0)):1;
      const showOp=flipped?String(rawOp>0.5?0:1):String(rawOp);if(parseFloat(showOp)>0&&ov.animation){el.style.animation='roc-'+ov.animation+' '+(ov.animation==='blink'?'1s step-end':'2s ease-in-out')+' infinite';el.style.opacity='';}else{el.style.animation='none';el.style.opacity=showOp;}
      let _ovF=ov.conditions?.filter?resolveVal(ov.conditions.filter,s,'none'):'none';
      if(ov.color_from){
        // Tint the overlay toward the light's current colour
        const _cf=s[ov.color_from];
        if(_cf&&_cf.state==='on'){
          const _rgb=_cf.attributes.rgb_color||(_cf.attributes.color_temp_kelvin?kelvinToRgb(_cf.attributes.color_temp_kelvin):null);
          if(_rgb)_ovF=tintFilter(_rgb);
        }
      }
      setSt(el,'filter',_ovF);
    }
    // Weather overlay
    if(this._wxEl&&c.weather_overlay){
      const wx=typeof c.weather_overlay==='string'?{entity:c.weather_overlay}:c.weather_overlay;
      let eff=wx.effect&&wx.effect!=='auto'?wx.effect:null;
      if(!eff&&wx.entity){
        const wst=s[wx.entity]?.state;
        eff=({rainy:'rain',pouring:'rain-heavy','lightning-rainy':'rain-lightning',lightning:'lightning',hail:'snow-heavy',snowy:'snow','snowy-rainy':'snow',fog:'fog'})[wst]||null;
      }
      const effCls=({'rain':' wx-rain','rain-heavy':' wx-rain wx-heavy','rain-lightning':' wx-rain wx-lightning','lightning':' wx-lightning','snow':' wx-snow','snow-heavy':' wx-snow wx-heavy','fog':' wx-fog'})[eff]||'';
      const wcls='layer wx'+effCls;
      if(this._wxEl.className!==wcls)this._wxEl.className=wcls;
      // Per-effect default opacity — snow needs more presence than rain
      const _defOp=({'rain':0.45,'rain-heavy':0.55,'rain-lightning':0.5,'lightning':0.6,'snow':0.7,'snow-heavy':0.8,'fog':0.5})[eff]??0.45;
      setSt(this._wxEl,'opacity',effCls?String(wx.opacity??_defOp):'0');
    }
    // Group panels (fade via visibility/opacity)
    for(const g of(c.groups||[])){
      if(g.style&&this._grpPanelEls[g.id])this._setGrpVis(this._grpPanelEls[g.id],this._groupState[g.id]??false);
    }
    for(const z of(c.zones||[])){
      const el=this._zoneEls[z.id];if(!el)continue;
      const gShow=!z.group||(this._groupState[z.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const zShow=z.visible_template!==undefined?(this._tmplVis['z:'+z.id]??true):!(z.visible&&!evalCond(z.visible,s));
      this._setVis(el,zShow,'',z.fade,z.slide);
    }
    for(const b of(c.badges||[])){
      const bel=this._bcontEls[b.id];if(!bel)continue;
      const gShow=!b.group||(this._groupState[b.group]??true);
      this._setGrpVis(bel,gShow);
      if(!gShow)continue;
      const bShow=b.visible_template!==undefined?(this._tmplVis['b:'+b.id]??true):(b.visible?evalCond(b.visible,s):true);
      this._setVis(bel,bShow,'flex',b.fade,b.slide);
      const iel=this._biconEls[b.id];
      if(iel&&b.icon_color)setSt(iel,'color',resolveVal(b.icon_color,s,'white'));
      const lel=this._blabelEls[b.id];
      if(lel&&b.label){const t=resolveVal(b.label,s,'');if(lel.textContent!==t)lel.textContent=t;}
    }
    const _icoW=this.offsetWidth||300;
    for(const ico of(c.icons||[])){
      const el=this._icoEls[ico.id];if(!el)continue;
      const gShow=!ico.group||(this._groupState[ico.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const iShow=ico.visible_template!==undefined?(this._tmplVis['i:'+ico.id]??true):(ico.visible?evalCond(ico.visible,s):true);
      this._setVis(el,iShow,'flex',ico.fade,ico.slide);
      const haicon=el.querySelector('ha-icon');
      if(haicon){
        const sz=resolveSize(tApply(ico,this._tier).size||ico.size||'20px',_icoW);
        if(haicon.style.getPropertyValue('--mdc-icon-size')!==sz){haicon.style.setProperty('--mdc-icon-size',sz);haicon.style.width=sz;haicon.style.height=sz;}
        if(ico.color)setSt(haicon,'color',resolveVal(ico.color,s,'white'));
      }
    }
    for(const el of(c.elements||[])){
      const cont=this._contEls[el.id];if(!cont)continue;
      const gShow=!el.group||(this._groupState[el.group]??true);
      this._setGrpVis(cont,gShow);
      if(!gShow)continue;
      const eShow=el.visible_template!==undefined?(this._tmplVis['e:'+el.id]??true):(el.visible?evalCond(el.visible,s):true);
      this._setVis(cont,eShow,'block',el.fade,el.slide);
    }
    for(const lbl of(c.labels||[])){
      const el=this._lblEls[lbl.id];if(!el)continue;
      const gShow=!lbl.group||(this._groupState[lbl.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const lblVis=lbl.visible_conditions!==undefined?lbl.visible_conditions:lbl.visible;
      this._setVis(el,lblVis!==undefined?evalCond(lblVis,s):true,'',lbl.fade,lbl.slide);
      const _lfsRaw=tApply(lbl,this._tier).font_size||lbl.font_size;
      if(_lfsRaw){const _fs=resolveSize(_lfsRaw,_icoW);if(_fs)setSt(el,'fontSize',_fs);}
      if(lbl.template){
        // Text and gradient colour come from the template subscription
        const tv=this._tmplVals[lbl.id];
        if(tv!==undefined&&el.textContent!==tv)el.textContent=tv;
        continue;
      }
      const ent=s[lbl.entity];if(!ent)continue;
      const rawVal=lbl.attribute!==undefined?ent.attributes[lbl.attribute]:ent.state;
      if(lbl.format==='relative'){
        const _rt=(lbl.prefix||'')+relTime(rawVal,this._hass.locale?.language)+(lbl.suffix&&lbl.suffix!=='auto'?lbl.suffix:'');
        if(el.textContent!==_rt)el.textContent=_rt;
        continue;
      }
      const numVal=parseFloat(rawVal);
      const dispVal=!isNaN(numVal)?(lbl.decimals!==undefined?numVal.toFixed(lbl.decimals):String(Math.round(numVal))):String(rawVal??'');
      let _sfx=lbl.suffix||lbl.unit||'';
      if(_sfx==='auto')_sfx=ent.attributes.unit_of_measurement?' '+ent.attributes.unit_of_measurement:'';
      const text=(lbl.prefix||'')+dispVal+_sfx;
      if(el.textContent!==text)el.textContent=text;
      if(lbl.color_gradient){const _lv=parseFloat(lbl.attribute!==undefined?ent.attributes[lbl.attribute]:ent.state);if(!isNaN(_lv))setSt(el,'color',lerpColorGradient(this._sortedLblGrads[lbl.id]||lbl.color_gradient,_lv,!!this._sortedLblGrads[lbl.id]));}else if(lbl.color)setSt(el,'color',Array.isArray(lbl.color)?resolveVal(lbl.color,s,'white'):lbl.color);
    }
    const _allGaugesUp=[...(c.gauges||[]),...(this._blindGaugeCfgs||[])];
    for(const g of _allGaugesUp){
      const el=this._gaugeEls[g.id];if(!el)continue;
      const gShow=!g.group||(this._groupState[g.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const gVis=g.visible_conditions!==undefined?g.visible_conditions:g.visible;
      const gShow2=g.visible_template!==undefined?(this._tmplVis['g:'+g.id]??true):(gVis!==undefined?evalCond(gVis,s):true);
      this._setVis(el,gShow2,'',g.fade,g.slide);
      if(g.animation){const _gActive=g.alert_conditions?evalCond(g.alert_conditions,s):true;if(_gActive){if(g.animation_color)el.style.setProperty('--roc-ac',g.animation_color);else el.style.removeProperty('--roc-ac');el.style.animation=g.animation==='blink'?'roc-border-blink 1s step-end infinite':'roc-border-pulse 2s ease-in-out infinite';}else{el.style.animation='';el.style.removeProperty('--roc-ac');}}else if(el.style.animation){el.style.animation='';el.style.removeProperty('--roc-ac');}
      const ent=s[g.entity];if(!ent)continue;
      let val=parseFloat(g.attribute!==undefined?ent.attributes[g.attribute]:ent.state);
      if(isNaN(val))continue;
      const mn=g.min??0,mx=g.max??100;
      let pct=Math.max(0,Math.min(1,(val-mn)/(mx-mn)));
      // top_offset corrects the visual fill only, AFTER min/max normalization —
      // pct here is always 0=open/1=closed regardless of the blind's own raw
      // motor direction (see rocApplyTopOffset). Closed (pct=1) is left exactly
      // as-is; only the open end (pct=0) gets floored to the residual coverage.
      if(g.top_offset)pct=rocApplyTopOffset(pct*100,g.top_offset)/100;
      const fill=this._gaugeFills[g.id];
      if(fill){if(g._dayNight){const _nDN=g._slat_count||6;const _perDN=el.offsetHeight/_nDN;if(_perDN>0){const _swDN=_perDN/2;const _scDN=g._slat_color;const _gradDN='repeating-linear-gradient(to bottom,'+_scDN+' 0px,'+_scDN+' '+_swDN+'px,transparent '+_swDN+'px,transparent '+_perDN+'px)';const _offDN=pct>=1?(_perDN/2):pct*_nDN*(_perDN/2);fill.style.height=(Math.round(pct*1000)/10)+'%';fill.style.backgroundImage=_gradDN+','+_gradDN;fill.style.backgroundPositionY='-'+_offDN+'px,0px';fill.style.backgroundRepeat='repeat';fill.style.backgroundSize='100% '+_perDN+'px';fill.style.backgroundColor='transparent';}}
      else if((g.orientation||'vertical')==='radial'){
        const meta=this._radialMeta[g.id];
        if(meta){
          const dash=(pct*meta.arcLen).toFixed(2)+' '+meta.circ.toFixed(2);
          if(fill.getAttribute('stroke-dasharray')!==dash)fill.setAttribute('stroke-dasharray',dash);
          let _rc=null;
          if(g.color_gradient)_rc=lerpColorGradient(this._sortedGrads[g.id]||g.color_gradient,val,!!this._sortedGrads[g.id]);
          else if(g.color)_rc=Array.isArray(g.color)?resolveVal(g.color,s,'white'):g.color;
          if(_rc&&fill.getAttribute('stroke')!==_rc)fill.setAttribute('stroke',_rc);
        }
      }
      else{const _go=g.orientation||'vertical';const _pv=(Math.round(pct*1000)/10)+'%';if(_go==='horizontal'||_go==='right')setSt(fill,'width',_pv);else setSt(fill,'height',_pv);if(g.color_gradient)setSt(fill,'background',lerpColorGradient(this._sortedGrads[g.id]||g.color_gradient,val,!!this._sortedGrads[g.id]));else if(g.color)setSt(fill,'background',Array.isArray(g.color)?resolveVal(g.color,s,'white'):g.color);}}
    }
    // Light-controls lux ring — cheap: one HSL computation, applied only on change
    if(this._lcEls&&this._lcEls.length&&this._lcCfg){
      const _col=lcBorderColor(s[this._lcCfg.lux_sensor]?.state,this._lcCfg);
      if(_col!==this._lcPrevCol){
        this._lcPrevCol=_col;
        for(const o of this._lcEls){if(o.styleEl)try{o.styleEl.textContent=lcSliderCss(o.bgOff,_col);}catch(_){}}
      }
    }
    // Light-controls on/off toggle pills — reflect entity state + share lux ring
    if(this._lcToggles&&this._lcToggles.length){
      const _tcol=this._lcCfg?lcBorderColor(s[this._lcCfg.lux_sensor]?.state,this._lcCfg):'var(--primary-color)';
      for(const t of this._lcToggles){
        const stt=s[t.entity];
        const on=!!stt&&stt.state!=='off'&&stt.state!=='unavailable'&&stt.state!=='unknown';
        const bg=on?_tcol:t.bgOff;
        if(t._bg!==bg){t._bg=bg;try{t.el.style.background=bg;}catch(_){}}
        if(t._brc!==_tcol){t._brc=_tcol;try{t.el.style.borderColor=_tcol;}catch(_){}}
        if(t._on!==on){t._on=on;try{t.el.style.color=on?'#fff':'var(--secondary-text-color)';}catch(_){}if(t.icon)try{t.icon.setAttribute('icon',on?'mdi:power':'mdi:power-off');}catch(_){}}
      }
    }
    // Cover controls (roleta) — reflect live position + motion state
    if(this._ccEls&&this._ccCfgs&&this._ccCfgs.length){
      for(const cc of this._ccCfgs){
        const rec=this._ccEls[cc.id];if(!rec)continue;
        const ent=s[cc.entity];if(!ent)continue;
        const attrs=ent.attributes||{};
        const hasPosAttr=attrs.current_position!=null;
        const pos=hasPosAttr?Math.max(0,Math.min(100,Math.round(attrs.current_position))):null;
        const st=ent.state,moving=(st==='opening'||st==='closing');
        if(rec.rail)setSt(rec.rail,'display',(hasPosAttr&&cc.slider)?'':'none');
        const held=rec._userHold&&(Date.now()-rec._userHold<1200);
        if(pos!=null&&!held){
          if(rec.fill){if(rec.horiz)rec.fill.style.width=pos+'%';else rec.fill.style.height=pos+'%';}
          if(rec.thumb){if(rec.horiz)rec.thumb.style.left=pos+'%';else rec.thumb.style.bottom=pos+'%';}
          if(rec.pct){if(rec.pct.textContent!==pos+' %')rec.pct.textContent=pos+' %';setSt(rec.pct,'display','');}
          for(const pb of rec.presets)pb.classList.toggle('active',parseInt(pb.dataset.pos,10)===pos);
        }else if(pos==null&&rec.pct){rec.pct.textContent='';setSt(rec.pct,'display','none');}
        if(rec.stop)rec.stop.classList.toggle('moving',moving);
      }
    }
    this._updateNav();
    if(this._relevantEntities){
      for(const id of this._relevantEntities)this._prevStates[id]=s[id]?.state;
      if(this._relevantAttrSources)for(const a of this._relevantAttrSources)this._prevStates[a.entity+'.'+a.attr]=s[a.entity]?.attributes[a.attr];
    }
  }

  // Nav thumbnails — live filters + sensor chips. Callable standalone (via
  // _schedule(true)) for state changes that only affect other rooms' thumbs.
  // nav.live: 'composite' → thumbs stack the room's ACTIVE overlay images over
  // the base image (mini-room view: same lights/filters as the big card).
  // Binary approximation: overlay shows when its opacity resolves > 0;
  // grouped (pop-up panel) overlays and visible_template overlays are skipped.
  _updateNav(){
    if(!this._hass||!this._rendered)return;
    const s=this._hass.states,cAll=this._config;
    if(Array.isArray(cAll.rooms)&&cAll.rooms.length){
      const _navLiveVal=cAll.nav&&cAll.nav.live;
      const _live=_navLiveVal==='composite'; // composite draws its own base+overlay stack on tEl, filtered here
      const _liveReal=_navLiveVal==='full'||_navLiveVal==='custom'; // real mounted mini instances — they
      // apply their own brightness_model/filter_conditions internally (same code path as the main card);
      // a CSS filter set on the WRAPPER (tEl) would stack on top of the mini's own already-correct
      // per-layer filter, double-exposing/double-dimming it. So the wrapper must stay filter-free here.
      for(let ri=0;ri<cAll.rooms.length;ri++){
        const tEl=this._navThumbEls[ri];if(!tEl)continue;
        const r=cAll.rooms[ri];
        let tf='';
        if(!_liveReal){
          if(_live){const bf=bmFilter(r.brightness_model,s,this._navBmSorted[ri]);if(bf&&bf!=='none')tf=bf;}
          if(!tf&&r.filter_conditions?.length){const f=resolveFilter(r.filter_conditions,s);if(f&&f!=='none')tf=f;}
        }
        setSt(tEl,'filter',tf);
        if(!_live)continue;
        // Conditional base image (mirror of the main card's logic)
        let base=r.base_image||'';
        if(r.base_image_conditions?.length&&!r.base_camera){
          for(const bc of r.base_image_conditions){
            if(bc.condition===undefined){if(bc.image)base=bc.image;continue;}
            if(evalCond(bc.condition,s)){if(bc.image)base=bc.image;break;}
          }
        }
        // Active overlays, top-most first (CSS: first background layer is on top)
        const stack=[];
        (r.overlays||[]).forEach((ov,oi)=>{
          if(ov.group||ov.visible_template!==undefined)return;
          const op=ov.conditions?.opacity?Number(resolveVal(ov.conditions.opacity,s,0)):1;
          if(!(op>0))return;
          const img=this._ovImg(ov);
          if(img)stack.push({img:img,z:ov.z_index??oi+1});
        });
        stack.sort(function(a,b){return a.z-b.z;});stack.reverse();
        const bgs=stack.map(function(o){return'url(\''+escUrl(o.img)+'\')';});
        if(base)bgs.push('url(\''+escUrl(base)+'\')');
        const bgStr=bgs.join(',');
        if(tEl._rocBg!==bgStr){tEl._rocBg=bgStr;tEl.style.backgroundImage=bgStr;}
      }
      for(const ch of this._navChipEls){
        const ent=s[ch.entity];if(!ent)continue;
        const nv=parseFloat(ent.state);
        const txt=(isNaN(nv)?String(ent.state):(ch.cfg.decimals!==undefined?nv.toFixed(ch.cfg.decimals):String(Math.round(nv))))+(ch.cfg.suffix||'');
        if(ch.el.textContent!==txt)ch.el.textContent=txt;
        if(ch.cfg.color_gradient&&!isNaN(nv))setSt(ch.el,'color',lerpColorGradient(ch.cfg.color_gradient,nv));
        else if(ch.cfg.color)setSt(ch.el,'color',ch.cfg.color);
      }
    }
    if(this._navEntities)for(const id of this._navEntities)this._prevStates[id]=s[id]?.state;
    if(this._navAttrSources)for(const a of this._navAttrSources)this._prevStates[a.entity+'.'+a.attr]=s[a.entity]?.attributes[a.attr];
  }

  _ovImg(ov){
    if(ov.image)return ov.image;
    if(ov.state_images?.length){
      for(const m of ov.state_images){if(!('entity'in m))continue;if(this._hass.states[m.entity]?.state===m.state)return m.image;}
      const d=ov.state_images.find(m=>!('entity'in m));if(d)return d.image;
    }
    return'';
  }

  _resolveAct(a){
    if('condition'in a){const ok=evalCond(a.condition,this._hass.states);return ok?a.then:(a.else??{action:'none'});}
    return a;
  }

  _exec(tapAction,event){
    if(!tapAction)return;
    if(event){event.stopPropagation();event.preventDefault();}
    const a=this._resolveAct(tapAction);
    if(!a||a.action==='none')return;
    // Swallow taps generated by a room swipe (zones fire on touchend, which the
    // wrap-level click suppressor cannot catch)
    if(this._roomDragActive||(this._lastRoomDragEnd&&Date.now()-this._lastRoomDragEnd<400))return;
    if(a.confirmation){
      const _ct=typeof a.confirmation==='object'?(a.confirmation.text||'Are you sure?'):'Are you sure?';
      if(!window.confirm(_ct))return;
    }
    if(this._config.haptic!==false)try{window.dispatchEvent(new CustomEvent('haptic',{detail:'light'}));}catch(_){}
    switch(a.action){
      case'navigate':{const p=a.navigation_path||a.path;if(p){history.pushState(null,'',p);const _lc=new Event('location-changed',{bubbles:true,composed:true});_lc.detail={replace:false};window.dispatchEvent(_lc);window.dispatchEvent(new PopStateEvent('popstate'));}}break;
      case'url':{const u=a.url_path||a.url;if(u)window.open(u,a.new_tab===false?'_self':'_blank');}break;
      case'more-info':if(a.entity)this.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:a.entity}}));break;
      case'perform-action':
      case'call-service':{
        const svc=a.perform_action||a.service;
        if(svc){const d=svc.indexOf('.');this._hass.callService(svc.slice(0,d),svc.slice(d+1),a.data??a.service_data??{},a.target);}
      }break;
      case'browser-mod-popup':{const _bmData={title:a.title??'',size:a.size??'normal',content:a.content??{}};const _bmId=window.browser_mod?.browserID||window.browser_mod?.browser_id;if(_bmId)_bmData.browser_id=_bmId;this._hass.callService('browser_mod','popup',_bmData);}break;
      case'toggle':if(a.entity)this._hass.callService('homeassistant','toggle',{entity_id:a.entity});break;
      case'switch-room':{
        const ri=roomMatch(this._config,a.room);
        if(ri>=0)this._switchRoom(ri,ri>this._roomIdx?1:-1,true);
      }break;
      case'next-room':
        if(Array.isArray(this._config.rooms)&&this._config.rooms.length)
          this._switchRoom((this._roomIdx+1)%this._config.rooms.length,1,true);
        break;
      case'prev-room':
        if(Array.isArray(this._config.rooms)&&this._config.rooms.length)
          this._switchRoom((this._roomIdx-1+this._config.rooms.length)%this._config.rooms.length,-1,true);
        break;
      case'follow-room':this._followNow();break;
      case'toggle-group':
      case'show-group':
      case'hide-group':
        if(a.group){
          const _newVis=a.action==='toggle-group'?!(this._groupState[a.group]??false):a.action==='show-group';
          this._groupState[a.group]=_newVis;
          if(_newVis){
            const _gc=(this._config.groups||[]).find(g=>g.id===a.group)?.grouping_code;
            if(_gc!==undefined)for(const _og of(this._config.groups||[]))if(_og.id!==a.group&&_og.grouping_code===_gc)this._groupState[_og.id]=false;
          }
          this._update();
        }
        break;
    }
  }
  disconnectedCallback(){
    if(this._tmKeyHandler){document.removeEventListener('keydown',this._tmKeyHandler);this._tmKeyHandler=null;}
    if(this._hlHandler){window.removeEventListener('roc-highlight',this._hlHandler);this._hlHandler=null;}
    if(this._camTimer){clearInterval(this._camTimer);this._camTimer=null;}
    if(this._relTimer){clearInterval(this._relTimer);this._relTimer=null;}
    if(this._orientHandler){window.removeEventListener('deviceorientation',this._orientHandler);this._orientHandler=null;}
    if(this._hashHandler)window.removeEventListener('hashchange',this._hashHandler);
    this._teardownTemplates();
    if(this._ro){this._ro.disconnect();this._ro=null;}
    if(this._wrapRo){this._wrapRo.disconnect();this._wrapRo=null;}
    if(this._bodyRo){this._bodyRo.disconnect();this._bodyRo=null;}
    if(this._scRo){this._scRo.disconnect();this._scRo=null;}
    this._scrollEl=null;
    clearTimeout(this._rootHT1);
    if(this._io){this._io.disconnect();this._io=null;}
    if(this._winHandler){window.removeEventListener('resize',this._winHandler);this._winHandler=null;}
    if(this._locHandler){window.removeEventListener('location-changed',this._locHandler);window.removeEventListener('popstate',this._locHandler);this._locHandler=null;}
    if(this._barMo){this._barMo.disconnect();this._barMo=null;}
    if(this._pvMo){this._pvMo.disconnect();this._pvMo=null;}
    if(this._navMiniRo){this._navMiniRo.disconnect();this._navMiniRo=null;}
  }

  connectedCallback(){
    // Re-attach observers & subscriptions after the element is MOVED back into
    // the DOM. HA does this move on every dashboard edit-mode toggle (the card
    // gets wrapped into / unwrapped from hui-card-options), and
    // disconnectedCallback nulls all observers — so everything must be
    // RECREATED here, not conditionally `.observe()`d on nulled handles (the
    // old bug: a card that went through an edit toggle had no layout triggers
    // left and stayed mis-sized until the next state update or swipe).
    if(this._rendered&&this._config){
      if(this._io)this._io.observe(this);
      this._wireLayoutObservers();
      this._startCamera();
      if(!this._tmplUnsubs.length)this._setupTemplates();
      if(this._hlHandler)window.addEventListener('roc-highlight',this._hlHandler);
      if(this._hashHandler)window.addEventListener('hashchange',this._hashHandler);
      // Re-pin now and once more after HA's current task finishes
      // (setTimeout(0), NOT rAF — rAF never fires in background tabs or
      // during HA view transitions); _watchEditBar and the panel-view
      // MutationObserver cover anything that mounts even later.
      const self=this;
      try{this._layoutRootHeight();this._watchEditBar();}catch(_){}
      setTimeout(function(){
        if(!self._rendered||!self.isConnected)return;
        self._requestPin('reconnect-settle');
        self._watchEditBar();
      },0);
    }
  }
}

customElements.define('room-overlay-card',RoomOverlayCard);



// ----- Minimal YAML subset (dump + parse) -----------------------------------
// HA frontend does not expose a global YAML library, so the editor ships its
// own small implementation covering plain mappings, lists, nesting and scalars.
// window.YAML is still preferred when some other resource provides it.
function _yScalar(v){
  if(v===null||v===undefined)return'null';
  if(typeof v==='boolean'||typeof v==='number')return String(v);
  const s=String(v);
  if(s===''||/[:#{}\[\]&*!|>'"%@`]/.test(s)||/^[\s-]|\s$/.test(s)||/^(true|false|null|~|yes|no|on|off)$/i.test(s)||/^[+-]?[\d.]/.test(s))
    return"'"+s.replace(/'/g,"''")+"'";
  return s;
}
function _yDump(v,ind){
  ind=ind||0;
  const pad='  '.repeat(ind);
  if(v===null||v===undefined)return'null';
  if(Array.isArray(v)){
    if(!v.length)return'[]';
    return v.map(function(it){
      if(it&&typeof it==='object'&&((Array.isArray(it)&&it.length)||(!Array.isArray(it)&&Object.keys(it).length))){
        const sub=_yDump(it,ind+1);
        return pad+'- '+sub.slice((ind+1)*2);
      }
      if(it&&typeof it==='object')return pad+'- '+(Array.isArray(it)?'[]':'{}');
      return pad+'- '+_yScalar(it);
    }).join('\n');
  }
  if(typeof v==='object'){
    const ks=Object.keys(v);
    if(!ks.length)return'{}';
    return ks.map(function(k){
      const val=v[k];
      if(val&&typeof val==='object'&&((Array.isArray(val)&&val.length)||(!Array.isArray(val)&&Object.keys(val).length)))
        return pad+k+':\n'+_yDump(val,ind+1);
      return pad+k+': '+_yScalar(Array.isArray(val)?'[]':(val&&typeof val==='object'?'{}':val)).replace(/^'(\[\]|\{\})'$/,'$1');
    }).join('\n');
  }
  return _yScalar(v);
}
function _yParseScalar(s){
  s=s.trim();
  if(s==='')return null;
  if(s.length>1&&(s[0]==="'"||s[0]==='"')&&s[s.length-1]===s[0]){
    const q=s[0];s=s.slice(1,-1);
    return q==="'"?s.replace(/''/g,"'"):s.replace(/\\"/g,'"');
  }
  if(/^\{[{%]/.test(s))return s; // unquoted Jinja template — keep as a plain string
  if(s==='null'||s==='~')return null;
  if(s==='true')return true;
  if(s==='false')return false;
  if(s==='[]')return[];
  if(s==='{}')return{};
  if(/^[+-]?\d+$/.test(s))return parseInt(s,10);
  if(/^[+-]?\d*\.\d+$/.test(s))return parseFloat(s);
  if((s[0]==='{'&&s[s.length-1]==='}')||(s[0]==='['&&s[s.length-1]===']')){
    try{return JSON.parse(s);}catch(_){}
    const inner=s.slice(1,-1).trim();
    if(s[0]==='{'){
      const o={};if(!inner)return{};
      inner.split(',').forEach(function(p){const ci=p.indexOf(':');if(ci>0)o[p.slice(0,ci).trim()]=_yParseScalar(p.slice(ci+1));});
      return o;
    }
    if(!inner)return[];
    return inner.split(',').map(_yParseScalar);
  }
  return s;
}
function _yParse(text){
  const _t0=text.trim();
  if((_t0[0]==='{'||_t0[0]==='[')&&!_t0.includes('\n'))return _yParseScalar(_t0);
  const lines=text.split('\n').map(function(l){return l.replace(/\t/g,'  ').replace(/\r$/,'');})
    .filter(function(l){return l.trim()!==''&&!/^\s*#/.test(l);});
  if(!lines.length)return null;
  let i=0;
  function indentOf(l){return l.match(/^ */)[0].length;}
  function parseBlock(ind){
    const isList=/^\s*-(\s|$)/.test(lines[i]);
    if(isList){
      const arr=[];
      while(i<lines.length){
        const l=lines[i],li=indentOf(l);
        if(li<ind||!/^\s*-(\s|$)/.test(l)||li>ind)
          {if(li>ind)throw new Error('bad indent');break;}
        const rest=l.replace(/^\s*-\s?/,'');
        if(rest.trim()===''){
          i++;
          arr.push(i<lines.length&&indentOf(lines[i])>ind?parseBlock(indentOf(lines[i])):null);
        }else if(/^[^:'"]+:(\s|$)/.test(rest)){
          lines[i]=' '.repeat(ind+2)+rest;
          arr.push(parseBlock(ind+2));
        }else{
          arr.push(_yParseScalar(rest));i++;
        }
      }
      return arr;
    }
    const obj={};
    while(i<lines.length){
      const l=lines[i],li=indentOf(l);
      if(li<ind)break;
      if(li>ind)throw new Error('bad indent');
      if(/^\s*-(\s|$)/.test(l))break;
      const ci=l.indexOf(':');
      if(ci<0)throw new Error('bad line: '+l);
      const key=l.slice(0,ci).trim().replace(/^['"]|['"]$/g,'');
      const val=l.slice(ci+1);
      if(val.trim()===''){
        i++;
        if(i<lines.length&&indentOf(lines[i])>ind)obj[key]=parseBlock(indentOf(lines[i]));
        else if(i<lines.length&&/^\s*-(\s|$)/.test(lines[i])&&indentOf(lines[i])===ind)obj[key]=parseBlock(ind);
        else obj[key]=null;
      }else{
        obj[key]=_yParseScalar(val);i++;
      }
    }
    return obj;
  }
  const r=parseBlock(indentOf(lines[0]));
  if(i<lines.length)throw new Error('unparsed trailing lines');
  return r;
}
const _yaml={
  s:function(o){
    try{if(window.YAML&&window.YAML.stringify)return window.YAML.stringify(o);}catch(_){}
    try{return _yDump(o,0);}catch(_){try{return JSON.stringify(o,null,2);}catch(__){return'';}}
  },
  p:function(s){
    try{if(window.YAML&&window.YAML.parse){const r=window.YAML.parse(s);if(r!==undefined)return r;}}catch(_){}
    try{return JSON.parse(s);}catch(_){}
    try{return _yParse(s);}catch(_){return null;}
  }
};

const FILTER_PROPS=[
  {key:'brightness', label:'Brightness', min:0,max:4,  step:0.05,dflt:1,unit:''},
  {key:'sepia',      label:'Sepia',      min:0,max:1,  step:0.05,dflt:0,unit:''},
  {key:'saturate',   label:'Saturate',   min:0,max:3,  step:0.05,dflt:1,unit:''},
  {key:'hue-rotate', label:'Hue rotate', min:0,max:360,step:1,   dflt:0,unit:'deg'},
  {key:'contrast',   label:'Contrast',   min:0,max:3,  step:0.05,dflt:1,unit:''},
  {key:'blur',       label:'Blur',       min:0,max:20, step:0.5, dflt:0,unit:'px'},
];

FILTER_PROPS.forEach(function(p){p._re=new RegExp(p.key.replace(/-/g,'\\-')+'\\(([\\d.]+)'+(p.unit||'')+'\\)');});
function parseFilterStr(str){
  const r={};
  FILTER_PROPS.forEach(function(p){r[p.key]=p.dflt;});
  if(!str||str==='none')return r;
  FILTER_PROPS.forEach(function(p){
    const m=str.match(p._re);
    if(m)r[p.key]=parseFloat(m[1]);
  });
  return r;
}

function buildFilterStr(obj){
  const parts=FILTER_PROPS
    .filter(function(p){return obj[p.key]!==undefined&&Math.abs(obj[p.key]-p.dflt)>0.001;})
    .map(function(p){return p.key+'('+obj[p.key]+p.unit+')';});
  return parts.length?parts.join(' '):'none';
}

class RoomOverlayCardEditor extends HTMLElement{
  constructor(){super();this._config=null;this._hass=null;this._rocPosHandler=null;this._rocRoomHandler=null;this._fdT=null;this._openPanels=null;this._hist=[];this._histIdx=-1;this._histMuted=false;this._keysBound=false;this._editRoomIdx=0;this._roomIdxInit=false;this._prevCard=null;this._showAdv=false;this._filterMode=null;this._dlCache=null;this._lySub=null;this._lyPvT=null;}

  // Entity datalist options — cached; rebuilding ~2k <option> strings on every
  // editor re-render is measurable with large state machines
  _dlOptions(){
    const h=this._hass;if(!h)return'';
    const ids=Object.keys(h.states);
    if(this._dlCache&&this._dlCache.n===ids.length)return this._dlCache.s;
    const s=ids.sort().map(function(id){return'<option value="'+id+'">';}).join('');
    this._dlCache={n:ids.length,s:s};
    return s;
  }

  // Active room view for editing (the room whose sections are shown)
  _roomView(){
    const c=this._config||{};
    if(Array.isArray(c.rooms)&&c.rooms.length){
      this._editRoomIdx=Math.max(0,Math.min(this._editRoomIdx,c.rooms.length-1));
      return c.rooms[this._editRoomIdx];
    }
    return c;
  }

  _convertToRooms(){
    const c=this._collectConfig();
    if(Array.isArray(c.rooms)&&c.rooms.length)return;
    const room={id:'room_1',name:'Room 1'};
    ROOM_KEYS.forEach(function(k){if(c[k]!==undefined){room[k]=c[k];delete c[k];}});
    c.rooms=[room];
    this._editRoomIdx=0;
    this._config=c;this._render();this._fire(c);
  }

  _toHex(c){if(!c)return'#ffffff';if(c.startsWith('#'))return c.length===4?'#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]:c.slice(0,7);const m=c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);return m?'#'+parseInt(m[1]).toString(16).padStart(2,'0')+parseInt(m[2]).toString(16).padStart(2,'0')+parseInt(m[3]).toString(16).padStart(2,'0'):'#ffffff';}

  // Parse a YAML textarea non-destructively: invalid input keeps the previous
  // config value and flags the field red instead of silently deleting data.
  _pYaml(el){
    if(!el)return{ok:false,val:undefined};
    const t=el.value.trim();
    if(!t){el.style.borderColor='';el.title='';return{ok:true,val:undefined};}
    const p=_yaml.p(el.value);
    if(p===null||p===undefined){
      el.style.borderColor='var(--error-color,#d33)';
      el.title='Invalid YAML — previous value kept';
      return{ok:false,val:undefined};
    }
    el.style.borderColor='';el.title='';
    return{ok:true,val:p};
  }

  // <input type=color> cannot express alpha — if the picker still shows the hex
  // of the original (possibly rgba) value, keep the original string.
  _colorVal(el,orig){
    if(!el)return orig;
    if(orig&&this._toHex(orig)===el.value)return orig;
    return el.value;
  }

  // Open the editor on the room the card was showing. Primary source is the
  // in-memory ROC_ROOM_MEM the card writes (survives HA's edit toggle, which
  // navigates to ?edit=1 and DROPS the URL hash). url_sync hash is a fallback.
  _initEditRoom(cfg){
    try{
      if(!cfg||!Array.isArray(cfg.rooms)||!cfg.rooms.length)return;
      const clamp=(ri)=>Math.max(0,Math.min(ri,cfg.rooms.length-1));
      // 1) room the card last switched to (exact identity)
      const mem=ROC_ROOM_MEM.get(cfgKey(cfg));
      if(mem!=null){const ri=roomMatch(cfg,mem);if(ri>=0){this._editRoomIdx=clamp(ri);return;}}
      // 2) fallback: url_sync hash (if HA hasn't stripped it)
      const u=cfg.url_sync;
      if(!u||typeof location==='undefined')return;
      const key=(typeof u==='string'&&u.trim())?u.trim():'room';
      const h=String(location.hash||'').replace(/^#/,'');
      if(!h)return;
      let val=null;
      h.split('&').forEach(function(p){const eq=p.indexOf('=');if(eq>0&&decodeURIComponent(p.slice(0,eq))===key)val=decodeURIComponent(p.slice(eq+1));});
      if(val===null)return;
      const ri=roomMatch(cfg,val);
      if(ri>=0)this._editRoomIdx=clamp(ri);
    }catch(_){}
  }

  // Point the url_sync hash at the room being edited + fire hashchange, so HA's
  // OWN preview card (which reads url_sync) follows the editor. Automates the
  // "scroll to restore #room=… then it loads" workaround. url_sync only.
  _writeEditHash(cfg){
    try{
      const u=cfg&&cfg.url_sync;
      if(!u||typeof location==='undefined'||!Array.isArray(cfg.rooms)||!cfg.rooms.length)return;
      const key=(typeof u==='string'&&u.trim())?u.trim():'room';
      const r=cfg.rooms[Math.max(0,Math.min(this._editRoomIdx,cfg.rooms.length-1))];
      const val=encodeURIComponent(String(r.id||r.name||this._editRoomIdx));
      const parts=String(location.hash||'').replace(/^#/,'').split('&').filter(Boolean)
        .filter(function(p){const eq=p.indexOf('=');return!(eq>0&&decodeURIComponent(p.slice(0,eq))===key);});
      parts.push(encodeURIComponent(key)+'='+val);
      const newHash='#'+parts.join('&');
      if((location.hash||'')===newHash)return; // already pointed there
      try{history.replaceState(history.state,'',location.pathname+location.search+newHash);}
      catch(_){location.hash=newHash;}
      // replaceState doesn't emit hashchange — nudge the preview card's listener
      try{window.dispatchEvent(new HashChangeEvent('hashchange'));}
      catch(_){try{window.dispatchEvent(new Event('hashchange'));}catch(__){}}
    }catch(_){}
  }

  setConfig(cfg){
    const _hadLayout=!!(cfg&&cfg.layout);
    cfg=rocMigrateLayout(cfg);
    if(!_hadLayout)this._wasMigrated=true;
    const prev=this._config;
    this._config=cfg;
    // Open the editor on the room the card was showing (ROC_ROOM_MEM, hash
    // fallback). One-time, so the room picker still wins afterwards.
    if(!this._roomIdxInit){this._roomIdxInit=true;this._initEditRoom(cfg);}
    this._writeEditHash(cfg); // keep the url_sync hash on the edited room (drives HA's native preview; survives its save-strip)
    if(!this._hist.length){try{this._hist=[JSON.stringify(cfg)];this._histIdx=0;}catch(_){}}
    if(prev&&this.innerHTML.trim()){
      const _ri=this._editRoomIdx;
      const _sc=function(x){return Array.isArray(x.rooms)&&x.rooms.length?x.rooms[Math.max(0,Math.min(_ri,x.rooms.length-1))]:x;};
      const pR=_sc(prev),cR=_sc(cfg);
      const same=
        (prev.rooms||[]).length===(cfg.rooms||[]).length&&
        (pR.overlays||[]).length===(cR.overlays||[]).length&&
        (pR.zones||[]).length===(cR.zones||[]).length&&
        (pR.badges||[]).length===(cR.badges||[]).length&&
        (pR.elements||[]).length===(cR.elements||[]).length&&
        (pR.icons||[]).length===(cR.icons||[]).length&&
        (pR.filter_conditions||[]).length===(cR.filter_conditions||[]).length&&
        (pR.labels||[]).length===(cR.labels||[]).length&&
        (pR.gauges||[]).length===(cR.gauges||[]).length&&
        (pR.blinds||[]).length===(cR.blinds||[]).length&&
        ((pR.brightness_model?.source||[]).length===(cR.brightness_model?.source||[]).length)&&
        ((pR.brightness_model?.filter_gradient||[]).length===(cR.brightness_model?.filter_gradient||[]).length)&&
        (pR.groups||[]).length===(cR.groups||[]).length;
      if(same)return;
    }
    this._render();
  }

  set hass(h){
    this._hass=h;
    if(this._prevCard)try{this._prevCard.hass=h;}catch(_){}
    const dl=this.querySelector('#roc-entities');
    if(dl&&!dl.hasChildNodes())
      dl.innerHTML=this._dlOptions();
  }

  // Interactive preview inside the editor — a real card instance mirroring
  // Edit mode (config.test_mode); shown here whenever it's on, since it's the
  // same saved config field that also puts the real dashboard card into it.
  _mountPreview(){
    const host=this.querySelector('#roc-prev-host');
    this._prevCard=null;
    if(!host||!this._config||!this._config.test_mode)return;
    try{
      const el=document.createElement('room-overlay-card');
      const cfg=rocClone(this._config);
      cfg.test_mode=true;cfg._roc_preview=true;
      delete cfg.url_sync; // editor preview must not hijack the dashboard URL
      const _multi=Array.isArray(cfg.rooms)&&cfg.rooms.length>0;
      if(_multi)cfg.follow_mode='manual'; // lock the preview to the room being edited (no presence jumps)
      el.setConfig(cfg);
      if(_multi)el._roomIdx=Math.max(0,Math.min(this._editRoomIdx,cfg.rooms.length-1));
      if(this._hass)el.hass=this._hass;
      host.appendChild(el);
      this._prevCard=el;
    }catch(e){console.warn('[room-overlay-card] editor preview failed:',e);}
  }

  _e(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  _fire(c){
    this._pushHist(c);
    this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:Object.assign({type:'custom:room-overlay-card'},c)}}));
  }

  _pushHist(c){
    if(this._histMuted)return;
    try{
      const j=JSON.stringify(c);
      if(this._hist[this._histIdx]===j)return;
      this._hist=this._hist.slice(0,this._histIdx+1);
      this._hist.push(j);
      if(this._hist.length>50)this._hist.shift();
      this._histIdx=this._hist.length-1;
    }catch(_){}
  }

  _undo(){if(this._histIdx>0)this._histGo(this._histIdx-1);}
  _redo(){if(this._histIdx<this._hist.length-1)this._histGo(this._histIdx+1);}
  _histGo(i){
    this._histIdx=i;
    this._config=JSON.parse(this._hist[i]);
    this._histMuted=true;
    try{this._render();this._fire(this._config);}finally{this._histMuted=false;}
  }

  _fireDebounced(){
    const self=this;
    clearTimeout(this._fdT);
    this._fdT=setTimeout(function(){self._fire(self._collectConfig());},150);
  }

  // Layout-tab fields debounce through here instead of _fireDebounced(): the
  // mounted Edit-mode preview card (_prevCard, see _mountPreview) only gets a
  // fresh setConfig() when this editor's own setConfig() runs a full _render()
  // — which it skips whenever array item counts are unchanged (see the `same`
  // check in setConfig()). layout.* isn't part of that count comparison at
  // all, so a pure Layout edit never reaches _prevCard through the normal
  // path. Push it there directly instead, without touching the editor's own
  // DOM (no _render() here — keeps focus/cursor in the field being typed).
  _lyDebouncedUpdate(){
    const self=this;
    clearTimeout(this._fdT);
    this._fdT=setTimeout(function(){
      const cfg=self._collectConfig();
      self._fire(cfg);
      if(self._prevCard){
        try{
          const pc=rocClone(cfg);pc.test_mode=true;pc._roc_preview=true;delete pc.url_sync;
          if(Array.isArray(pc.rooms)&&pc.rooms.length)pc.follow_mode='manual';
          self._prevCard.setConfig(pc);
          if(Array.isArray(pc.rooms)&&pc.rooms.length)self._prevCard._roomIdx=Math.max(0,Math.min(self._editRoomIdx,pc.rooms.length-1));
        }catch(e){console.warn('[room-overlay-card] editor live layout preview failed:',e);}
      }
    },150);
  }

  _collectConfig(){
    const c=Object.assign({},this._config);
    const self=this;
    const q=function(s){return this.querySelector(s);}.bind(this);
    const v=function(id,fb){const el=q('#'+id);return el?el.value:fb;};
    // Multi-room: sections write into the room being edited; shared keys stay top-level
    const hasRooms=Array.isArray(c.rooms)&&c.rooms.length>0;
    if(hasRooms)c.rooms=c.rooms.map(function(r){return Object.assign({},r);});
    const tgt=hasRooms?c.rooms[Math.max(0,Math.min(this._editRoomIdx,c.rooms.length-1))]:c;
    // Background mode (image vs camera) — mutually exclusive at save time, not just
    // hidden in the UI: whichever isn't the active mode is cleared, so a stale value
    // in the other field can never silently win at render time (camera always wins
    // there if both happened to be set).
    const _bgModeEl=q('#bg-mode');
    const _bgModeV=_bgModeEl?_bgModeEl.value:(tgt.base_camera?'camera':'image');
    if(_bgModeV==='camera'){
      delete tgt.base_image;
      const _bcam=v('base_camera','').trim();
      if(_bcam)tgt.base_camera=_bcam;else delete tgt.base_camera;
      const _bcr=parseFloat(v('camera_refresh',''));
      if(_bcam&&!isNaN(_bcr)&&_bcr>0&&_bcr!==10)tgt.camera_refresh=_bcr;else delete tgt.camera_refresh;
    }else{
      delete tgt.base_camera;delete tgt.camera_refresh;
      tgt.base_image=v('base_image',tgt.base_image||'');
      if(!tgt.base_image)delete tgt.base_image;
    }
    const _wxEnt=v('weather_entity','').trim();
    const _wxEff=v('weather_effect','');
    const _wxOp=parseFloat(v('weather_opacity',''));
    if(_wxEnt||(_wxEff&&_wxEff!=='auto')){
      const _wo={};
      if(_wxEnt)_wo.entity=_wxEnt;
      if(_wxEff&&_wxEff!=='auto')_wo.effect=_wxEff;
      if(!isNaN(_wxOp)&&_wxOp!==0.45)_wo.opacity=_wxOp;
      const _oldWo=typeof tgt.weather_overlay==='object'&&tgt.weather_overlay?tgt.weather_overlay:{};
      if(_oldWo.z_index!==undefined)_wo.z_index=_oldWo.z_index;
      if(_oldWo.angle!==undefined)_wo.angle=_oldWo.angle;
      tgt.weather_overlay=_wo;
    }else delete tgt.weather_overlay;
    const _wxNmEl=q('#weather-nav-mini');if(_wxNmEl){if(_wxNmEl.checked)tgt.weather_nav_mini=true;else delete tgt.weather_nav_mini;}
    // Layout block (v4) — height/orientation/threshold/gap + per-profile grids
    (function(){
      if(!q('#ly-hmode'))return; // Layout tab not rendered (onboarding)
      const ly=Object.assign({},c.layout||{});
      const hm=q('#ly-hmode');
      if(hm.value==='custom'){const hv=v('ly-hcustom','').trim();ly.height=hv||'viewport';}
      else ly.height=hm.value;
      if(ly.height==='viewport')delete ly.height; // default
      const orS=q('#ly-orient');
      const pinS=q('#ly-pin');
      const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id||'';
      let orient=(ly.orientation&&typeof ly.orientation==='object')?Object.assign({},ly.orientation):null;
      if(orient&&orient.by_browser)orient.by_browser=Object.assign({},orient.by_browser);
      if(pinS&&bid){
        if(pinS.value){orient=orient||{};orient.by_browser=orient.by_browser||{};orient.by_browser[bid]=pinS.value;}
        else if(orient&&orient.by_browser){delete orient.by_browser[bid];if(!Object.keys(orient.by_browser).length)delete orient.by_browser;}
      }
      const orV=orS?orS.value:'auto';
      if(orient){
        if(orV==='portrait'||orV==='landscape')orient.default=orV;else delete orient.default;
        if(!Object.keys(orient).length)orient=null;
      }else if(orV==='portrait'||orV==='landscape')orient=orV;
      if(orient)ly.orientation=orient;else delete ly.orientation;
      const th=parseFloat(v('ly-threshold',''));
      if(!isNaN(th)&&th>0&&th!==1)ly.threshold=th;else delete ly.threshold;
      const gp=v('ly-gap','').trim();if(gp)ly.gap=gp;else delete ly.gap;
      const _numOr=function(s){const t=String(s).trim();if(!t)return null;return/^[\d.]+$/.test(t)?parseFloat(t):t;};
      ['portrait','landscape'].forEach(function(pk){
        const lp={};
        const rw=v('ly-rows__'+pk,'').trim(),cl=v('ly-cols__'+pk,'').trim();
        if(rw)lp.rows=rw.split(',').map(_numOr).filter(function(x){return x!==null;});
        if(cl)lp.columns=cl.split(',').map(_numOr).filter(function(x){return x!==null;});
        const place={};
        ['nav','cards_above','image','lights','cards_below','cover'].forEach(function(rg){
          const rr=v('ly-r__'+pk+'__'+rg,'').trim();
          if(!rr)return;
          const pl={row:_numOr(rr)};
          const cc2=v('ly-c__'+pk+'__'+rg,'').trim();if(cc2)pl.col=_numOr(cc2);
          const ov2=q('#ly-o__'+pk+'__'+rg);if(ov2&&ov2.checked)pl.overflow='auto';
          place[rg]=pl;
        });
        if(Object.keys(place).length)lp.place=place;
        if(Object.keys(lp).length)ly[pk]=lp;else delete ly[pk];
      });
      c.layout=ly;
    })();
    const _zm=q('#zoom');
    if(_zm&&_zm.checked)c.zoom=true;else delete c.zoom;
    const _bicR=this._pYaml(this.querySelector('#base_image_conditions'));
    if(_bicR.ok){if(Array.isArray(_bicR.val))tgt.base_image_conditions=_bicR.val;else delete tgt.base_image_conditions;}
    // Per-profile inputs → scalar (only Landscape filled) or {portrait,landscape}
    const _collProf=function(idb){
      const o={};let n=0;
      ROC_PROFILES.forEach(function(pk){const el=q('#'+idb+'__'+pk);if(!el)return;const vv=el.value.trim();if(vv){o[pk]=vv;n++;}});
      if(n===0)return undefined;
      if(n===1&&o.landscape!==undefined)return o.landscape;
      return o;
    };
    const _arV=_collProf('aspect_ratio');c.aspect_ratio=_arV!==undefined?_arV:'16/9';
    const _brV=_collProf('border_radius');if(_brV!==undefined)c.border_radius=_brV;else delete c.border_radius;
    const _ifV=_collProf('image_fit');if(_ifV!==undefined)c.image_fit=_ifV;else delete c.image_fit;
    const _lav=v('lock_aspect','').trim().toLowerCase();
    if(_lav==='true'||_lav==='on'||_lav==='yes'||_lav==='auto')c.lock_aspect=true;
    else if(_lav)c.lock_aspect=v('lock_aspect','').trim();
    else delete c.lock_aspect;
    const _ftV=v('filter_transition','2s ease');
    if(_ftV&&_ftV!=='2s ease')c.filter_transition=_ftV;else delete c.filter_transition;
    const tm=q('#test_mode');if(tm&&tm.checked)c.test_mode=true;else delete c.test_mode;
    const hpEl=q('#haptic');if(hpEl&&!hpEl.checked)c.haptic=false;else delete c.haptic; // default on — only write when explicitly turned off
    const _taR=this._pYaml(q('#tap_action_yaml'));
    if(_taR.ok){if(_taR.val)tgt.tap_action=_taR.val;else delete tgt.tap_action;}
    const _caR=this._pYaml(q('#cards_above_yaml'));
    if(_caR.ok){if(_caR.val)tgt.cards_above=_caR.val;else delete tgt.cards_above;}
    const _cbR=this._pYaml(q('#cards_below_yaml'));
    if(_cbR.ok){if(_cbR.val)tgt.cards_below=_cbR.val;else delete tgt.cards_below;}
    // Light controls
    (function(){
      const ents=[];
      self.querySelectorAll('[data-lc-ent]').forEach(function(el,i){
        const ent=el.value.trim();
        const nmEl=self.querySelector('[data-lc-name="'+i+'"]');
        const nm=nmEl?nmEl.value.trim():'';
        ents.push(nm?{entity:ent,name:nm}:{entity:ent});
      });
      if(ents.length){
        const lc={entities:ents};
        const _lx=v('lc-lux','').trim();if(_lx)lc.lux_sensor=_lx;
        const _lxm=parseFloat(v('lc-luxmax',''));if(!isNaN(_lxm)&&_lxm>0)lc.lux_max=_lxm;
        const _cols=parseInt(v('lc-cols',''),10);if(!isNaN(_cols)&&_cols>0)lc.columns=_cols;
        const _hgtRaw=v('lc-height','').trim();
        if(_hgtRaw){if(/^[0-9.]+$/.test(_hgtRaw))lc.height=parseFloat(_hgtRaw);else if(_hgtRaw.charAt(0)==='{'){const _hp=_yaml.p(_hgtRaw);lc.height=(_hp&&typeof _hp==='object')?_hp:_hgtRaw;}else lc.height=_hgtRaw;}
        const _cl=q('#lc-color-low');if(_cl)lc.color_low=_cl.value;
        const _ch=q('#lc-color-high');if(_ch)lc.color_high=_ch.value;
        const _cbg=q('#lc-bg-off');if(_cbg)lc.bg_off=_cbg.value;
        tgt.light_controls=lc;
      }else delete tgt.light_controls;
    })();

    const _bmSrcs=[];
    self.querySelectorAll('[data-bm-src-ent]').forEach(function(el,i){
      const _s={entity:el.value.trim()};
      const _cc=self.querySelector('[data-bm-src-cond="'+i+'"]');
      const _ccR=self._pYaml(_cc);
      if(_ccR.ok){if(_ccR.val)_s.condition=_ccR.val;}
      else{const _oldS=(self._roomView().brightness_model?.source||[])[i];if(_oldS&&_oldS.condition)_s.condition=_oldS.condition;}
      const _at=self.querySelector('[data-bm-src-attr="'+i+'"]');
      if(_at&&_at.value.trim())_s.attribute=_at.value.trim();
      const _mn=self.querySelector('[data-bm-src-min="'+i+'"]');
      if(_mn)_s.min_input=parseFloat(_mn.value)||0;
      const _mx=self.querySelector('[data-bm-src-max="'+i+'"]');
      if(_mx)_s.max_input=parseFloat(_mx.value)||100;
      _bmSrcs.push(_s);
    });
    const _bmFg=[];
    self.querySelectorAll('[data-bm-fg-val]').forEach(function(el,i){
      const _v=parseFloat(el.value);if(isNaN(_v))return;
      const _fe=self.querySelector('[data-bm-fg-filt="'+i+'"]');
      if(_fe)_bmFg.push({value:_v,filter:_fe.value.trim()||'none'});
    });
    if(_bmSrcs.length||_bmFg.length)tgt.brightness_model={source:_bmSrcs,filter_gradient:_bmFg};
    else delete tgt.brightness_model;

    tgt.filter_conditions=[];
    this.querySelectorAll('.filter-block').forEach(function(block,i){
      const entry={};
      const entEl=block.querySelector('[data-filter-entity="'+i+'"]');
      const entity=entEl?entEl.value.trim():'';
      const buildSubCond=function(prefix){
        const eEl=block.querySelector('[data-filter-'+prefix+'-entity="'+i+'"]');
        const ent=eEl?eEl.value.trim():'';
        if(!ent)return null;
        const oEl=block.querySelector('[data-filter-'+prefix+'-op="'+i+'"]');
        const vEl=block.querySelector('[data-filter-'+prefix+'-val="'+i+'"]');
        const o=oEl?oEl.value:'state';
        const v=vEl?vEl.value:'';
        const sc={entity:ent};
        if(o==='state')sc.state=v;
        else if(o==='state_not')sc.state_not=v;
        else{sc.operator=o;sc.value=parseFloat(v)||v;}
        return sc;
      };
      if(entity){
        const opEl=block.querySelector('[data-filter-state-op="'+i+'"]');
        const valEl=block.querySelector('[data-filter-state-val="'+i+'"]');
        const op=opEl?opEl.value:'state';
        const val=valEl?valEl.value:'';
        const cond={entity:entity};
        if(op==='state')cond.state=val;
        else if(op==='state_not')cond.state_not=val;
        else{cond.operator=op;cond.value=parseFloat(val)||val;}
        const andCond=buildSubCond('and');if(andCond)cond.and=andCond;
        const orCond=buildSubCond('or');if(orCond)cond.or=orCond;
        entry.condition=cond;
      }
      const filters={};
      FILTER_PROPS.forEach(function(p){
        const el=block.querySelector('[data-fp="'+i+'-'+p.key+'"][data-fp-num]');
        if(el)filters[p.key]=parseFloat(el.value);
      });
      let _ff=buildFilterStr(filters);
      // Preserve filter functions the sliders don't cover (grayscale, invert, drop-shadow, …)
      const _origFc=(self._roomView().filter_conditions||[])[i];
      if(_origFc&&_origFc.filter&&_origFc.filter!=='none'){
        const _known=FILTER_PROPS.map(function(p){return p.key;});
        const _extras=(String(_origFc.filter).match(/[a-z-]+\((?:[^()]|\([^()]*\))*\)/g)||[]).filter(function(f){return!_known.includes(f.slice(0,f.indexOf('(')));});
        if(_extras.length)_ff=(_ff==='none'?'':_ff+' ')+_extras.join(' ');
      }
      entry.filter=_ff;
      tgt.filter_conditions.push(entry);
    });
    // Unified filter section: the mode toggle is authoritative — keep only the
    // active mode's data so it actually takes effect at runtime (brightness_model
    // otherwise always wins over filter_conditions).
    const _fMode=(q('#filter-mode')&&q('#filter-mode').value)||(tgt.brightness_model?'smooth':'conditional');
    if(_fMode==='smooth'){delete tgt.filter_conditions;}
    else{delete tgt.brightness_model;if(!tgt.filter_conditions.length)delete tgt.filter_conditions;}

    tgt.overlays=(tgt.overlays||[]).map(function(ov,i){
      const o=Object.assign({},ov);
      const idEl=q('[data-ov-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const imgEl=q('[data-ov-img="'+i+'"]');if(imgEl){if(imgEl.value)o.image=imgEl.value;else delete o.image;}
      const trEl=q('[data-ov-tr="'+i+'"]');if(trEl)o.transition=trEl.value;const animOvEl=q('[data-ov-anim="'+i+'"]');if(animOvEl&&animOvEl.value)o.animation=animOvEl.value;else delete o.animation;
      const grpEl=q('[data-ov-grp="'+i+'"]');if(grpEl&&grpEl.value.trim())o.group=grpEl.value.trim();else delete o.group;
      const yaR=self._pYaml(q('[data-ov-yaml="'+i+'"]'));
      if(yaR.ok){
        const p=yaR.val;
        if(p){
          // state_images lives on the overlay root, opacity/filter under conditions
          if(p.opacity||p.filter){o.conditions={};if(p.opacity)o.conditions.opacity=p.opacity;if(p.filter)o.conditions.filter=p.filter;}
          else delete o.conditions;
          if(p.state_images)o.state_images=p.state_images;else delete o.state_images;
        }else{delete o.conditions;delete o.state_images;}
      }
      return o;
    });

    tgt.zones=(tgt.zones||[]).map(function(z,i){
      const o=Object.assign({},z);
      const idEl=q('[data-z-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-z-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-z-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-z-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-z-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const tapR=self._pYaml(q('[data-z-tap="'+i+'"]'));
      if(tapR.ok){if(tapR.val)o.tap_action=tapR.val;else delete o.tap_action;}
      const holdR=self._pYaml(q('[data-z-hold="'+i+'"]'));
      if(holdR.ok){if(holdR.val)o.hold_action=holdR.val;else delete o.hold_action;}
      const dtapR=self._pYaml(q('[data-z-dtap="'+i+'"]'));
      if(dtapR.ok){if(dtapR.val)o.double_tap_action=dtapR.val;else delete o.double_tap_action;}
      const hdelEl=q('[data-z-hdelay="'+i+'"]');
      if(hdelEl&&hdelEl.value&&parseInt(hdelEl.value)!==500)o.hold_delay=parseInt(hdelEl.value);else delete o.hold_delay;
      const visR=self._pYaml(q('[data-z-vis="'+i+'"]'));
      if(visR.ok){if(visR.val)o.visible=visR.val;else delete o.visible;}
      const slR=self._pYaml(q('[data-z-slider="'+i+'"]'));
      if(slR.ok){if(slR.val&&slR.val.entity)o.slider=slR.val;else delete o.slider;}
      const zGrpEl=q('[data-z-grp="'+i+'"]');if(zGrpEl&&zGrpEl.value.trim())o.group=zGrpEl.value.trim();else if(zGrpEl)delete o.group;
      return o;
    });

    tgt.badges=(tgt.badges||[]).map(function(b,i){
      const o=Object.assign({},b);
      const idEl=q('[data-b-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const posEl=q('[data-b-pos="'+i+'"]');if(posEl)o.position=posEl.value;
      const iconEl=q('[data-b-icon="'+i+'"]');if(iconEl){if(iconEl.value)o.icon=iconEl.value;else delete o.icon;}
      const bxEl=q('[data-b-x="'+i+'"]');if(bxEl){if(bxEl.value.trim())o.x=bxEl.value.trim();else delete o.x;}
      const byEl=q('[data-b-y="'+i+'"]');if(byEl){if(byEl.value.trim())o.y=byEl.value.trim();else delete o.y;}const bAnimEl=q('[data-b-anim="'+i+'"]');if(bAnimEl&&bAnimEl.value)o.animation=bAnimEl.value;else delete o.animation;const bAcEl=q('[data-b-ac="'+i+'"]');if(bAcEl&&bAcEl.value&&o.animation)o.animation_color=self._colorVal(bAcEl,b.animation_color);else delete o.animation_color;
      const bNmEl=q('[data-b-nav-mini="'+i+'"]');if(bNmEl){if(bNmEl.checked)o.nav_mini=true;else delete o.nav_mini;}
      const yaR=self._pYaml(q('[data-b-yaml="'+i+'"]'));
      if(yaR.ok){
        // The YAML textarea owns every key except those with dedicated fields —
        // keys removed from the textarea are removed from the config too.
        const KEEP=['id','icon','position','x','y','animation','animation_color','nav_mini'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      return o;
    });

    tgt.elements=(tgt.elements||[]).map(function(el,i){
      const o=Object.assign({},el);
      const idEl=q('[data-el-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-el-top="'+i+'"]');if(topEl&&topEl.value.trim()){o.top=topEl.value.trim();delete o.bottom;}else delete o.top;
      const botEl=q('[data-el-bot="'+i+'"]');if(botEl&&botEl.value.trim()){o.bottom=botEl.value.trim();delete o.top;}else delete o.bottom;
      const lefEl=q('[data-el-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-el-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-el-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const yaR=self._pYaml(q('[data-el-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','bottom','left','width','height','group'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const elGrpEl=q('[data-el-grp="'+i+'"]');if(elGrpEl&&elGrpEl.value.trim())o.group=elGrpEl.value.trim();else delete o.group;
      const elNmEl=q('[data-el-nav-mini="'+i+'"]');if(elNmEl){if(elNmEl.checked)o.nav_mini=true;else delete o.nav_mini;}
      return o;
    });

    tgt.icons=(tgt.icons||[]).map(function(ico,i){
      const o=Object.assign({},ico);
      const idEl=q('[data-ico-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const iconEl=q('[data-ico-icon="'+i+'"]');if(iconEl)o.icon=iconEl.value;
      const sizeEl=q('[data-ico-size="'+i+'"]');if(sizeEl){const _sz=sizeEl.value.trim();if(_sz&&_sz!=='20px')o.size=_sz;else delete o.size;}
      const zEl=q('[data-ico-z="'+i+'"]');if(zEl&&zEl.value)o.z_index=parseInt(zEl.value);
      const topEl=q('[data-ico-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-ico-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const hdelEl=q('[data-ico-hdelay="'+i+'"]');
      if(hdelEl&&hdelEl.value&&parseInt(hdelEl.value)!==500)o.hold_delay=parseInt(hdelEl.value);else delete o.hold_delay;
      const bgEl=q('[data-ico-bg="'+i+'"]');if(bgEl&&bgEl.value.trim())o.background=bgEl.value.trim();else delete o.background;
      const colorR=self._pYaml(q('[data-ico-color="'+i+'"]'));
      if(colorR.ok){if(colorR.val)o.color=colorR.val;else delete o.color;}
      const visR=self._pYaml(q('[data-ico-vis="'+i+'"]'));
      if(visR.ok){if(visR.val)o.visible=visR.val;else delete o.visible;}
      const tapR=self._pYaml(q('[data-ico-tap="'+i+'"]'));
      if(tapR.ok){if(tapR.val)o.tap_action=tapR.val;else delete o.tap_action;}
      const dtapR=self._pYaml(q('[data-ico-dtap="'+i+'"]'));
      if(dtapR.ok){if(dtapR.val)o.double_tap_action=dtapR.val;else delete o.double_tap_action;}
      const holdR=self._pYaml(q('[data-ico-hold="'+i+'"]'));
      if(holdR.ok){if(holdR.val)o.hold_action=holdR.val;else delete o.hold_action;}
      const icoGrpEl=q('[data-ico-grp="'+i+'"]');if(icoGrpEl&&icoGrpEl.value.trim())o.group=icoGrpEl.value.trim();else delete o.group;
      const icoNmEl=q('[data-ico-nav-mini="'+i+'"]');if(icoNmEl){if(icoNmEl.checked)o.nav_mini=true;else delete o.nav_mini;}
      return o;
    });


    tgt.labels=(tgt.labels||[]).map(function(lbl,i){
      const o=Object.assign({},lbl);
      const idEl=q('[data-lbl-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-lbl-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-lbl-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const entEl=q('[data-lbl-entity="'+i+'"]');if(entEl)o.entity=entEl.value;
      const atEl=q('[data-lbl-attr="'+i+'"]');if(atEl){if(atEl.value.trim())o.attribute=atEl.value.trim();else delete o.attribute;}
      const sfxEl=q('[data-lbl-suffix="'+i+'"]');if(sfxEl){if(sfxEl.value)o.suffix=sfxEl.value;else delete o.suffix;}const lblAnimEl=q('[data-lbl-anim="'+i+'"]');if(lblAnimEl&&lblAnimEl.value)o.animation=lblAnimEl.value;else delete o.animation;const lblAcEl=q('[data-lbl-ac="'+i+'"]');if(lblAcEl&&lblAcEl.value&&o.animation)o.animation_color=self._colorVal(lblAcEl,lbl.animation_color);else delete o.animation_color;
      const tmplEl=q('[data-lbl-tmpl="'+i+'"]');
      if(tmplEl){if(tmplEl.value.trim())o.template=tmplEl.value.trim();else delete o.template;}
      const yaR=self._pYaml(q('[data-lbl-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','entity','attribute','suffix','unit','color_gradient','animation','animation_color','group','template','nav_mini'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const lblGradStops=[];
      self.querySelectorAll('[data-l-lv^="'+i+'-"]').forEach(function(inp){
        const j=inp.dataset.lLv.split('-')[1];
        const cInp=self.querySelector('[data-l-lc="'+i+'-'+j+'"]');
        if(cInp){const v=parseFloat(inp.value);if(!isNaN(v))lblGradStops.push({value:v,color:self._colorVal(cInp,(lbl.color_gradient||[])[parseInt(j)]?.color)});}
      });
      if(lblGradStops.length)o.color_gradient=lblGradStops.sort((a,b)=>a.value-b.value);
      else delete o.color_gradient;
      const lblGrpEl=q('[data-lbl-grp="'+i+'"]');if(lblGrpEl&&lblGrpEl.value.trim())o.group=lblGrpEl.value.trim();else delete o.group;
      const lblNmEl=q('[data-lbl-nav-mini="'+i+'"]');if(lblNmEl){if(lblNmEl.checked)o.nav_mini=true;else delete o.nav_mini;}
      return o;
    });

    tgt.gauges=(tgt.gauges||[]).map(function(g,i){
      const o=Object.assign({},g);
      const idEl=q('[data-g-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-g-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-g-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-g-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-g-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const entEl=q('[data-g-entity="'+i+'"]');if(entEl)o.entity=entEl.value;
      const atEl=q('[data-g-attr="'+i+'"]');if(atEl){if(atEl.value.trim())o.attribute=atEl.value.trim();else delete o.attribute;}
      const minEl=q('[data-g-min="'+i+'"]');if(minEl){const _gmn=parseFloat(minEl.value);if(isNaN(_gmn)||_gmn===0)delete o.min;else o.min=_gmn;}
      const maxEl=q('[data-g-max="'+i+'"]');if(maxEl){const _gmx=parseFloat(maxEl.value);if(isNaN(_gmx)||_gmx===100)delete o.max;else o.max=_gmx;}const orientEl=q('[data-g-orient="'+i+'"]');if(orientEl&&orientEl.value&&orientEl.value!=='vertical')o.orientation=orientEl.value;else if(orientEl&&orientEl.value==='vertical')delete o.orientation;else delete o.orientation;
      const yaR=self._pYaml(q('[data-g-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','width','height','entity','attribute','min','max','color_gradient','animation','animation_color','alert_conditions','orientation','group','nav_mini'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const gradStops=[];
      self.querySelectorAll('[data-g-gv^="'+i+'-"]').forEach(function(inp){
        const j=inp.dataset.gGv.split('-')[1];
        const cInp=self.querySelector('[data-g-gc="'+i+'-'+j+'"]');
        if(cInp){const v=parseFloat(inp.value);if(!isNaN(v))gradStops.push({value:v,color:self._colorVal(cInp,(g.color_gradient||[])[parseInt(j)]?.color)});}
      });
      if(gradStops.length)o.color_gradient=gradStops.sort((a,b)=>a.value-b.value);
      else delete o.color_gradient;
      const gAnimEl=q('[data-g-anim="'+i+'"]');if(gAnimEl&&gAnimEl.value)o.animation=gAnimEl.value;else delete o.animation;
      const gAcEl=q('[data-g-ac="'+i+'"]');if(gAcEl&&gAcEl.value&&o.animation)o.animation_color=self._colorVal(gAcEl,g.animation_color);else delete o.animation_color;
      const gAlertEntEl=q('[data-g-alert-ent="'+i+'"]');const gAlertOpEl=q('[data-g-alert-op="'+i+'"]');const gAlertValEl=q('[data-g-alert-val="'+i+'"]');
      const gAlertAttrEl=q('[data-g-alert-attr="'+i+'"]');
      if(gAlertEntEl&&gAlertEntEl.value.trim()&&gAlertOpEl&&gAlertOpEl.value&&gAlertValEl&&gAlertValEl.value.trim()){const _ac={entity:gAlertEntEl.value.trim(),operator:gAlertOpEl.value,value:parseFloat(gAlertValEl.value)};if(gAlertAttrEl&&gAlertAttrEl.value.trim())_ac.attribute=gAlertAttrEl.value.trim();o.alert_conditions=_ac;}else delete o.alert_conditions;
      const gGrpEl=q('[data-g-grp="'+i+'"]');if(gGrpEl&&gGrpEl.value.trim())o.group=gGrpEl.value.trim();else delete o.group;
      const gNmEl=q('[data-g-nav-mini="'+i+'"]');if(gNmEl){if(gNmEl.checked)o.nav_mini=true;else delete o.nav_mini;}
      return o;
    });
    tgt.blinds=(tgt.blinds||[]).map(function(b,i){
      const o=Object.assign({},b);
      const idEl=q('[data-bl-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-bl-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-bl-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-bl-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-bl-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const zEl=q('[data-bl-z="'+i+'"]');if(zEl&&zEl.value)o.z_index=parseInt(zEl.value)||6;else delete o.z_index;
      const entEl=q('[data-bl-entity="'+i+'"]');if(entEl)o.entity=entEl.value;
      const atEl=q('[data-bl-attr="'+i+'"]');if(atEl){if(atEl.value.trim())o.attribute=atEl.value.trim();else delete o.attribute;}
      const minEl=q('[data-bl-min="'+i+'"]');if(minEl){const _bmn=parseFloat(minEl.value);if(isNaN(_bmn)||_bmn===0)delete o.min;else o.min=_bmn;}
      const maxEl=q('[data-bl-max="'+i+'"]');if(maxEl){const _bmx=parseFloat(maxEl.value);if(isNaN(_bmx)||_bmx===100)delete o.max;else o.max=_bmx;}
      const toEl=q('[data-bl-top-offset="'+i+'"]');if(toEl){const _bto=parseFloat(toEl.value);if(isNaN(_bto)||_bto===0)delete o.top_offset;else o.top_offset=_bto;}
      const typeEl=q('[data-bl-type="'+i+'"]');if(typeEl)o.blind_type=typeEl.value;else o.blind_type='roller';
      const scEl=q('[data-bl-slat-color="'+i+'"]');if(scEl&&scEl.value.trim())o.slat_color=scEl.value.trim();else delete o.slat_color;
      const scntEl=q('[data-bl-slat-count="'+i+'"]');if(scntEl&&scntEl.value)o.slat_count=parseInt(scntEl.value,10)||6;else delete o.slat_count;
      const swEl=q('[data-bl-slat-w="'+i+'"]');if(swEl&&swEl.value)o.slat_width=parseFloat(swEl.value)||7;else delete o.slat_width;
      const sgEl=q('[data-bl-slat-g="'+i+'"]');if(sgEl&&sgEl.value)o.slat_gap=parseFloat(sgEl.value)||6;else delete o.slat_gap;
      const gcEl=q('[data-bl-gap-color="'+i+'"]');if(gcEl&&gcEl.value.trim())o.gap_color=gcEl.value.trim();else delete o.gap_color;
      const yaR=self._pYaml(q('[data-bl-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','width','height','entity','attribute','min','max','top_offset','z_index','blind_type','slat_color','slat_count','slat_width','slat_gap','gap_color','slat_pitch','group','nav_mini'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const blGrpEl=q('[data-bl-grp="'+i+'"]');if(blGrpEl&&blGrpEl.value.trim())o.group=blGrpEl.value.trim();else delete o.group;
      const blNmEl=q('[data-bl-nav-mini="'+i+'"]');if(blNmEl){if(blNmEl.checked)o.nav_mini=true;else delete o.nav_mini;}
      const _ccDispEl=q('[data-bl-ccdisp="'+i+'"]');
      if(_ccDispEl&&_ccDispEl.value&&_ccDispEl.value!=='off'){
        const _ctl={placement:_ccDispEl.value==='dock'?'dock':'float'};
        const _ccSideEl=q('[data-bl-ccside="'+i+'"]');if(_ccSideEl)_ctl.dock_side=_ccSideEl.value==='left'?'left':'right';
        const _ccSlEl=q('[data-bl-ccslider="'+i+'"]');_ctl.slider=_ccSlEl?!!_ccSlEl.checked:true;
        const _ccTopEl=q('[data-bl-cctop="'+i+'"]');if(_ccTopEl&&_ccTopEl.value.trim())_ctl.top=_ccTopEl.value.trim();
        const _ccLeftEl=q('[data-bl-ccleft="'+i+'"]');if(_ccLeftEl&&_ccLeftEl.value.trim())_ctl.left=_ccLeftEl.value.trim();
        const _ccWEl=q('[data-bl-ccwidth="'+i+'"]');if(_ccWEl&&_ccWEl.value.trim())_ctl.width=_ccWEl.value.trim();
        const _ccPs=[];
        self.querySelectorAll('[data-ccp-row="'+i+'"]').forEach(function(row){
          const _gp=function(sel){const e=row.querySelector(sel);return e?String(e.value).trim():'';};
          const _pv=parseInt(_gp('[data-ccp-pos]'),10);if(isNaN(_pv))return;
          const _pp={position:Math.max(0,Math.min(100,_pv))};
          const _pi=_gp('[data-ccp-icon]');if(_pi)_pp.icon=_pi;
          const _pc=_gp('[data-ccp-color]');if(_pc)_pp.color=_pc;
          const _pn=_gp('[data-ccp-name]');if(_pn)_pp.name=_pn;
          _ccPs.push(_pp);
        });
        if(_ccPs.length)_ctl.presets=_ccPs;
        o.control=_ctl;
      }else{delete o.control;}
      return o;
    });

    tgt.groups=(tgt.groups||[]).map(function(g,i){
      const o=Object.assign({},g);
      const idEl=q('[data-grp-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const visEl=q('[data-grp-vis="'+i+'"]');if(visEl)o.visible=visEl.checked;
      const gcEl=q('[data-grp-gc="'+i+'"]');if(gcEl&&gcEl.value.trim())o.grouping_code=parseInt(gcEl.value,10);else delete o.grouping_code;
      const yaR=self._pYaml(q('[data-grp-yaml="'+i+'"]'));
      if(yaR.ok){if(yaR.val&&yaR.val.style)o.style=yaR.val.style;else delete o.style;}
      return o;
    });

    // ---- Multi-room meta + card-level multiroom fields ----------------------
    if(hasRooms){
      const ridEl=q('#room-id');if(ridEl&&ridEl.value.trim())tgt.id=ridEl.value.trim();
      const rnmEl=q('#room-name');if(rnmEl){if(rnmEl.value.trim())tgt.name=rnmEl.value.trim();else delete tgt.name;}
      const ricEl=q('#room-icon');if(ricEl){if(ricEl.value.trim())tgt.icon=ricEl.value.trim();else delete tgt.icon;}
      const ramEl=q('#room-area-match');
      if(ramEl){
        const vv=ramEl.value.split(',').map(function(x){return x.trim();}).filter(Boolean);
        if(vv.length)tgt.area_match=vv;else delete tgt.area_match;
      }
      const rchR=this._pYaml(q('#room-chips'));
      if(rchR.ok){if(rchR.val)tgt.chips=rchR.val;else delete tgt.chips;}
      const reEl=q('#room_entity');
      if(reEl&&!(typeof c.room_entity==='object'&&c.room_entity)){ // object mapping is YAML-managed
        if(reEl.value.trim())c.room_entity=reEl.value.trim();else delete c.room_entity;
      }
      const fmEl=q('#follow_mode');
      if(fmEl){if(fmEl.value&&fmEl.value!=='always')c.follow_mode=fmEl.value;else delete c.follow_mode;}
      const rseEl=q('#room_state_entity');
      if(rseEl&&!(typeof c.room_state_entity==='object'&&c.room_state_entity)){
        if(rseEl.value.trim())c.room_state_entity=rseEl.value.trim();else delete c.room_state_entity;
      }
      const fhEl=q('#follow_hold');
      if(fhEl){const fv=parseFloat(fhEl.value);if(!isNaN(fv)&&fv>=0&&fv!==60)c.follow_hold=fv;else delete c.follow_hold;}
      const cidEl=q('#card_id');if(cidEl){if(cidEl.value.trim())c.card_id=cidEl.value.trim();else delete c.card_id;}
      // Navigation menu — structured fields (chips/cards stay YAML lists)
      const _oldNav=(this._config.nav&&typeof this._config.nav==='object')?this._config.nav:{};
      const _navO={};
      const _ns=v('nav-style','thumbnails');if(_ns&&_ns!=='thumbnails')_navO.style=_ns;
      const _np=v('nav-position','top');if(_np&&_np!=='top')_navO.position=_np;
      const _nlv=v('nav-live','');if(_nlv)_navO.live=_nlv;
      const _navMiniO={};
      const _nmtEl=q('#nav-mini-templates');if(_nmtEl&&_nmtEl.checked)_navMiniO.templates=true;
      const _nmcr=parseFloat(v('nav-mini-camera-refresh',''));if(!isNaN(_nmcr))_navMiniO.camera_refresh=_nmcr;
      const _nmwr=parseFloat(v('nav-mini-width-ref',''));if(!isNaN(_nmwr))_navMiniO.width_ref=_nmwr;
      if(Object.keys(_navMiniO).length)_navO.mini=_navMiniO;
      const _nh=v('nav-height','').trim();if(_nh)_navO.height=_nh;
      const _nw=v('nav-width','').trim();if(_nw)_navO.width=_nw;
      const _nmh=v('nav-mobile-height','').trim();if(_nmh)_navO.mobile_height=_nmh;
      const _nab=parseFloat(v('nav-auto-bp',''));if(!isNaN(_nab))_navO.auto_breakpoint=_nab;
      const _nwh=v('nav-wheel','');if(_nwh)_navO.wheel=_nwh;
      const _nfbEl=q('#nav-follow-btn');if(_nfbEl&&!_nfbEl.checked)_navO.follow_button=false;
      const _chR=this._pYaml(q('#nav-chips'));if(_chR.ok){if(_chR.val)_navO.chips=_chR.val;}else if(_oldNav.chips)_navO.chips=_oldNav.chips;
      const _cdR=this._pYaml(q('#nav-cards'));if(_cdR.ok){if(_cdR.val)_navO.cards=_cdR.val;}else if(_oldNav.cards)_navO.cards=_oldNav.cards;
      if(Object.keys(_navO).length)c.nav=_navO;else delete c.nav;
      const _usEl=q('#url-sync');
      if(_usEl){if(_usEl.checked){const _usk=v('url-sync-key','').trim();c.url_sync=_usk||true;}else delete c.url_sync;}
    }

    // Prune empty per-room arrays — keeps saved YAML minimal
    ['overlays','zones','badges','elements','icons','labels','gauges','blinds','groups','filter_conditions'].forEach(function(k){
      if(Array.isArray(tgt[k])&&!tgt[k].length)delete tgt[k];
    });

    return c;
  }

  _inp(s){return ' class="roc-in"'+(s?' style="'+s+'"':'');}

  _mvBtns(kind,i){
    const st='padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;margin-top:8px;margin-right:6px;';
    return'<button data-mv="'+kind+':'+i+':-1" title="Move up" style="'+st+'">&#9650;</button><button data-mv="'+kind+':'+i+':1" title="Move down" style="'+st+'">&#9660;</button>';
  }

  _condFields(prefix,i,c){
    // renders entity + op + val fields for a sub-condition (and/or)
    const entity=c&&c.entity?c.entity:'';
    const op=c?(c.state!==undefined?'state':c.state_not!==undefined?'state_not':c.operator||'state'):'state';
    const val=c?(c.state!==undefined?String(c.state):c.state_not!==undefined?String(c.state_not):c.value!==undefined?String(c.value):''):'';
    let h='<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:end;margin-bottom:6px;">';
    h+='<div><input type="text" list="roc-entities" data-filter-'+prefix+'-entity="'+i+'" placeholder="entity_id" value="'+this._e(entity)+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><select data-filter-'+prefix+'-op="'+i+'"'+this._inp('font-size:12px;width:auto;')+'>';
    ['state','state_not','<','>','<=','>=','==','!='].forEach(function(o){h+='<option value="'+o+'"'+(op===o?' selected':'')+'>'+o+'</option>';});
    h+='</select></div>';
    h+='<div><input type="text" data-filter-'+prefix+'-val="'+i+'" placeholder="value" value="'+this._e(val)+'"'+this._inp('font-size:12px;width:90px;')+'></div>';
    h+='</div>';
    return h;
  }

  _filterBlock(fc,i){
    const cond=fc.condition||null;
    const entity=cond&&cond.entity?cond.entity:'';
    const op=cond?(cond.state!==undefined?'state':cond.state_not!==undefined?'state_not':cond.operator||'state'):'state';
    const val=cond?(cond.state!==undefined?String(cond.state):cond.state_not!==undefined?String(cond.state_not):cond.value!==undefined?String(cond.value):''):'';
    const fv=parseFilterStr(fc.filter||'');
    const isDefault=!cond;
    let h='<div class="filter-block" style="border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;padding:12px;margin-bottom:8px;">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
    h+='<span style="font-weight:500;font-size:13px;">Filter #'+(i+1)+(isDefault?' (default)':'')+'</span>';
    h+='<button data-rm-filter="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0 4px;" title="Remove">&#x2715;</button>';
    h+='</div>';
    h+='<div style="margin-bottom:6px;"><label style="font-size:12px;color:var(--secondary-text-color);display:block;margin-bottom:4px;">Condition entity (leave empty for default)</label>';
    h+='<input type="text" list="roc-entities" data-filter-entity="'+i+'" placeholder="e.g. light.bedroom" value="'+this._e(entity)+'"'+this._inp('')+'></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;color:var(--secondary-text-color);display:block;margin-bottom:4px;">Operator</label>';
    h+='<select data-filter-state-op="'+i+'"'+this._inp('')+'>';
    ['state','state_not','<','>','<=','>=','==','!='].forEach(function(o){h+='<option value="'+o+'"'+(op===o?' selected':'')+'>'+o+'</option>';});
    h+='</select></div>';
    h+='<div><label style="font-size:12px;color:var(--secondary-text-color);display:block;margin-bottom:4px;">Value</label>';
    h+='<input data-filter-state-val="'+i+'" type="text" value="'+this._e(val)+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
    h+='<label style="font-size:11px;color:var(--secondary-text-color);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">AND condition (optional — must also be true)</label>';
    h+=this._condFields('and',i,cond?cond.and:null);
    h+='</div>';
    h+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
    h+='<label style="font-size:11px;color:var(--secondary-text-color);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">OR condition (optional — fallback if main fails)</label>';
    h+=this._condFields('or',i,cond?cond.or:null);
    h+='</div>';
    h+='<div><label style="font-size:12px;color:var(--secondary-text-color);font-weight:500;display:block;margin-bottom:6px;">Filter values</label>';
    const self=this;
    FILTER_PROPS.forEach(function(p){
      const vv=fv[p.key];
      h+='<div style="display:grid;grid-template-columns:90px 1fr 64px;gap:6px;align-items:center;margin-bottom:4px;">';
      h+='<label style="font-size:12px;">'+p.label+'</label>';
      h+='<input type="range" data-fp="'+i+'-'+p.key+'" data-fp-range min="'+p.min+'" max="'+p.max+'" step="'+p.step+'" value="'+vv+'" style="width:100%;cursor:pointer;">';
      h+='<input type="number" data-fp="'+i+'-'+p.key+'" data-fp-num min="'+p.min+'" max="'+p.max+'" step="'+p.step+'" value="'+vv+'"'+self._inp('font-size:12px;')+'>';
      h+='</div>';
    });
    h+='</div></div>';
    return h;
  }

  _ovItem(ov,i){
    const condView=Object.assign({},ov.conditions||{});
    if(ov.state_images)condView.state_images=ov.state_images;
    const condYaml=Object.keys(condView).length?_yaml.s(condView):'';
    const ovOpen=this._openPanels&&this._openPanels.has('ov-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="ov-'+i+'"'+(ovOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Overlay: '+this._e(ov.id||'ov_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-ov-id="'+i+'" type="text" value="'+this._e(ov.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Image URL</label><input data-ov-img="'+i+'" type="text" value="'+this._e(ov.image||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Transition</label><input data-ov-tr="'+i+'" type="text" value="'+this._e(ov.transition||'2s ease')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label>';
    h+='<select data-ov-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!ov.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(ov.animation==="pulse"?' selected':'')+'>pulse (fade in/out)</option>';
    h+='<option value="blink"'+(ov.animation==="blink"?' selected':'')+'>blink (hard on/off)</option>';
    h+='</select></div></div>';
    h+='<div><label class="roc-l">Conditions YAML (opacity / filter / state_images)</label>';
    h+='<textarea data-ov-yaml="'+i+'" rows="5"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(condYaml)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-ov-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(ov.group||'')+'"'+this._inp('')+'></div>';
    h+=this._mvBtns('ov',i);
    h+='<button data-rm-ov="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove overlay</button>';
    h+='</div></details>';
    return h;
  }

  // 'nav.live: custom' per-element opt-in checkbox (NAV_LIVE_FULL_PLAN.md
  // §13, opt-in default confirmed 2026-08-05). Renders nothing outside
  // custom mode — the field/data-attribute simply won't exist in the DOM, so
  // the generic collect loop naturally skips writing/clearing it, leaving
  // whatever nav_mini value the config already had untouched (switching live
  // modes back and forth never loses a user's per-element choices).
  _navMiniField(prefix,i,checked){
    if(!(this._config&&this._config.nav&&this._config.nav.live==='custom'))return'';
    return '<div style="display:flex;align-items:center;gap:7px;margin-top:6px;"><input data-'+prefix+'-nav-mini="'+i+'" type="checkbox"'+(checked?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:12px;cursor:pointer;">Show in nav.live: custom mini</label></div>';
  }

  _zoneItem(z,i){
    const tapYaml=z.tap_action?_yaml.s(z.tap_action):'';
    const holdYaml=z.hold_action?_yaml.s(z.hold_action):'';
    const dtapYaml=z.double_tap_action?_yaml.s(z.double_tap_action):'';
    const visYaml=z.visible?_yaml.s(z.visible):'';
    const zOpen=this._openPanels&&this._openPanels.has('z-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="z-'+i+'"'+(zOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Zone: '+this._e(z.id||'zone_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-z-id="'+i+'" type="text" value="'+this._e(z.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top</label><input data-z-top="'+i+'" type="text" value="'+this._e(z.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-z-left="'+i+'" type="text" value="'+this._e(z.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Width</label><input data-z-w="'+i+'" type="text" value="'+this._e(z.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Height</label><input data-z-h="'+i+'" type="text" value="'+this._e(z.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">hold_delay (ms)</label><input data-z-hdelay="'+i+'" type="number" value="'+this._e(String(z.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">';
    h+='<div><label class="roc-l">tap_action (YAML)</label><textarea data-z-tap="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">double_tap_action (YAML)</label><textarea data-z-dtap="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(dtapYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">hold_action (YAML)</label><textarea data-z-hold="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(holdYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">visible (YAML)</label><textarea data-z-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:8px;">';
    const sliderYaml=z.slider?_yaml.s(z.slider):'';
    h+='<div><label class="roc-l">slider (YAML — drag on zone sets light/cover/number; keys: entity, direction, live, min, max, color, invert)</label><textarea data-z-slider="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(sliderYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">Group (optional)</label><input data-z-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(z.group||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+=this._mvBtns('z',i);
    h+='<button data-dup-z="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-z="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove zone</button>';
    h+='</div></details>';
    return h;
  }

  _badgeItem(b,i){
    const bCopy=Object.assign({},b);delete bCopy.id;delete bCopy.icon;delete bCopy.position;delete bCopy.x;delete bCopy.y;delete bCopy.animation;delete bCopy.animation_color;
    const bYaml=Object.keys(bCopy).length?_yaml.s(bCopy):'';
    const bOpen=this._openPanels&&this._openPanels.has('b-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="b-'+i+'"'+(bOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Badge: '+this._e(b.id||'badge_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-b-id="'+i+'" type="text" value="'+this._e(b.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Icon (mdi:...)</label><div style="display:flex;gap:6px;align-items:center;"><ha-icon data-roc-prev icon="'+this._e(b.icon||'')+'" style="--mdc-icon-size:20px;flex:none;color:var(--primary-text-color);"></ha-icon><input data-b-icon="'+i+'" type="text" value="'+this._e(b.icon||'')+'"'+this._inp('')+'></div></div>';
    h+='<div><label class="roc-l">Position</label>';
    h+='<select data-b-pos="'+i+'"'+this._inp('')+'>';
    const bp=b.position||'bottom-left';
    ['bottom-left','bottom-right','top-left','top-right','custom'].forEach(function(p){h+='<option value="'+p+'"'+(bp===p?' selected':'')+'>'+p+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">X (custom pos)</label><input data-b-x="'+i+'" type="text" placeholder="e.g. 30%" value="'+this._e(b.x||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Y (custom pos)</label><input data-b-y="'+i+'" type="text" placeholder="e.g. 15%" value="'+this._e(b.y||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label>';
    h+='<select data-b-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!b.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(b.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(b.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Animation color (glow)</label>';
    h+='<input type="color" data-b-ac="'+i+'" value="'+(b.animation_color?this._toHex(b.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div><label class="roc-l">label / visible / icon_color / tap_action / group (YAML)</label>';
    h+='<textarea data-b-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(bYaml)+'</textarea></div>';
    h+=this._navMiniField('b',i,b.nav_mini===true);
    h+=this._mvBtns('b',i);
    h+='<button data-rm-b="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove badge</button>';
    h+='</div></details>';
    return h;
  }

  _elItem(el,i){
    const elCopy={};
    if(el.card)elCopy.card=el.card;
    if(el.visible!==undefined)elCopy.visible=el.visible;
    if(el.visible_template!==undefined)elCopy.visible_template=el.visible_template;
    if(el.fade!==undefined)elCopy.fade=el.fade;
    if(el.slide!==undefined)elCopy.slide=el.slide;
    if(el.mobile!==undefined)elCopy.mobile=el.mobile;
    if(el.z_index!==undefined)elCopy.z_index=el.z_index;
    if(el.border_radius)elCopy.border_radius=el.border_radius;
    if(el.overflow)elCopy.overflow=el.overflow;
    const elYaml=Object.keys(elCopy).length?_yaml.s(elCopy):'';
    const elOpen=this._openPanels&&this._openPanels.has('el-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="el-'+i+'"'+(elOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Element: '+this._e(el.id||'el_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-el-id="'+i+'" type="text" value="'+this._e(el.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top (or use Bottom)</label><input data-el-top="'+i+'" type="text" placeholder="e.g. 10%" value="'+this._e(el.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Bottom (alternative to Top)</label><input data-el-bot="'+i+'" type="text" placeholder="e.g. 0%" value="'+this._e(el.bottom||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-el-left="'+i+'" type="text" value="'+this._e(el.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Width</label><input data-el-w="'+i+'" type="text" value="'+this._e(el.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Height</label><input data-el-h="'+i+'" type="text" value="'+this._e(el.height||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div><label class="roc-l">card / visible / z_index / border_radius (YAML)</label>';
    h+='<textarea data-el-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(elYaml)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-el-grp="'+i+'" type="text" placeholder="group id" value="'+this._e((typeof el.group==='string'?el.group:''))+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('el',i,el.nav_mini===true);
    h+=this._mvBtns('el',i);
    h+='<button data-dup-el="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-el="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove element</button>';
    h+='</div></details>';
    return h;
  }

  _icoItem(ico,i){
    const tapYaml=ico.tap_action?_yaml.s(ico.tap_action):'';
    const holdYaml=ico.hold_action?_yaml.s(ico.hold_action):'';
    const dtapYaml=ico.double_tap_action?_yaml.s(ico.double_tap_action):'';
    const colorYaml=ico.color?_yaml.s(ico.color):'';
    const visYaml=ico.visible?_yaml.s(ico.visible):'';
    const icoOpen=this._openPanels&&this._openPanels.has('ico-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="ico-'+i+'"'+(icoOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Icon: '+this._e(ico.id||'ico_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-ico-id="'+i+'" type="text" value="'+this._e(ico.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Icon (mdi:...)</label><div style="display:flex;gap:6px;align-items:center;"><ha-icon data-roc-prev icon="'+this._e(ico.icon||'')+'" style="--mdc-icon-size:20px;flex:none;color:var(--primary-text-color);"></ha-icon><input data-ico-icon="'+i+'" type="text" value="'+this._e(ico.icon||'')+'"'+this._inp('')+'></div></div>';
    h+='<div><label class="roc-l">Size (px or %)</label><input data-ico-size="'+i+'" type="text" placeholder="20px or 2%" value="'+this._e(ico.size||'20px')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">z-index</label><input data-ico-z="'+i+'" type="number" value="'+this._e(String(ico.z_index||6))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Background (circle, optional)</label><input data-ico-bg="'+i+'" type="text" placeholder="rgba(0,0,0,0.55)" value="'+this._e(ico.background||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top</label><input data-ico-top="'+i+'" type="text" value="'+this._e(ico.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-ico-left="'+i+'" type="text" value="'+this._e(ico.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">hold_delay (ms)</label><input data-ico-hdelay="'+i+'" type="number" value="'+this._e(String(ico.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">color (YAML condition list)</label><textarea data-ico-color="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(colorYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">visible (YAML condition)</label><textarea data-ico-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
    h+='<div><label class="roc-l">tap_action (YAML)</label><textarea data-ico-tap="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">double_tap_action (YAML)</label><textarea data-ico-dtap="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(dtapYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">hold_action (YAML)</label><textarea data-ico-hold="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(holdYaml)+'</textarea></div>';
    h+='</div>';
    h+='<div style="margin-bottom:6px;"><label class="roc-l">Group (optional)</label><input data-ico-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(ico.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('ico',i,ico.nav_mini===true);
    h+=this._mvBtns('ico',i);
    h+='<button data-dup-ico="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-ico="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove icon</button>';
    h+='</div></details>';
    return h;
  }

  _lblItem(lbl,i){const cp=Object.assign({},lbl);delete cp.id;delete cp.top;delete cp.left;delete cp.entity;delete cp.attribute;delete cp.suffix;delete cp.unit;delete cp.color_gradient;delete cp.animation;delete cp.animation_color;delete cp.alert_conditions;delete cp.orientation;delete cp.group;delete cp.template;const ys=Object.keys(cp).length?_yaml.s(cp):'';const op=this._openPanels&&this._openPanels.has('lbl-'+i);let h='<details style="margin-bottom:6px;" data-panel="lbl-'+i+'"'+(op?' open':'')+' >';h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Label: '+this._e(lbl.id||'lbl_'+i)+'</summary>';h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">ID</label><input data-lbl-id="'+i+'" type="text" value="'+this._e(lbl.id||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Top</label><input data-lbl-top="'+i+'" type="text" value="'+this._e(lbl.top||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Left</label><input data-lbl-left="'+i+'" type="text" value="'+this._e(lbl.left||'')+'"'+this._inp('')+'></div>';h+='</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">Entity</label><input type="text" list="roc-entities" data-lbl-entity="'+i+'" value="'+this._e(lbl.entity||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Attribute (optional)</label><input data-lbl-attr="'+i+'" type="text" value="'+this._e(lbl.attribute||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Suffix</label><input data-lbl-suffix="'+i+'" type="text" value="'+this._e(lbl.suffix||lbl.unit||'')+'"'+this._inp('')+'></div>';h+='</div>';const ls=lbl.color_gradient||[];h+='<div style="margin-bottom:8px;">';h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';h+='<label style="font-size:12px;font-weight:500;">Color gradient (smooth interpolation)</label>';h+='<button data-add-lg="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';h+='</div>';for(let j=0;j<ls.length;j++){const hex=this._toHex(ls[j].color);h+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';h+='<input type="number" data-l-lv="'+i+'-'+j+'" placeholder="value" value="'+ls[j].value+'"'+this._inp('font-size:12px;')+'>';h+='<input type="color" data-l-lc="'+i+'-'+j+'" value="'+hex+'" style="width:100%;height:30px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;">';h+='<button data-rm-lg="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';h+='</div>';}if(!ls.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No stops yet — add stops for smooth gradient, or use \'color\' in YAML for discrete conditions.</p>';h+='</div>';h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label>';
    h+='<select data-lbl-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!lbl.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(lbl.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(lbl.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Animation color (glow)</label>';
    h+='<input type="color" data-lbl-ac="'+i+'" value="'+(lbl.animation_color?this._toHex(lbl.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Template (Jinja — replaces entity value, e.g. {{ states(\'sensor.x\') | round(1) }})</label><textarea data-lbl-tmpl="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(lbl.template||'')+'</textarea></div>';
    h+='<div><label class="roc-l">font_size / color / visible / visible_template / format / tap_action / fade / mobile / z_index (YAML)</label>';h+='<textarea data-lbl-yaml="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-lbl-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(lbl.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('lbl',i,lbl.nav_mini===true);
    h+=this._mvBtns('lbl',i);
    h+='<button data-dup-lbl="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-lbl="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove label</button>';h+='</div></details>';return h;}

  _gaugeItem(g,i){const cp=Object.assign({},g);delete cp.id;delete cp.top;delete cp.left;delete cp.width;delete cp.height;delete cp.entity;delete cp.attribute;delete cp.min;delete cp.max;delete cp.color_gradient;delete cp.animation;delete cp.animation_color;delete cp.alert_conditions;delete cp.orientation;delete cp.group;const ys=Object.keys(cp).length?_yaml.s(cp):'';const op=this._openPanels&&this._openPanels.has('g-'+i);let h='<details style="margin-bottom:6px;" data-panel="g-'+i+'"'+(op?' open':'')+' >';h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Gauge: '+this._e(g.id||'gauge_'+i)+'</summary>';h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">ID</label><input data-g-id="'+i+'" type="text" value="'+this._e(g.id||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Top</label><input data-g-top="'+i+'" type="text" value="'+this._e(g.top||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Left</label><input data-g-left="'+i+'" type="text" value="'+this._e(g.left||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Width</label><input data-g-w="'+i+'" type="text" value="'+this._e(g.width||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Height</label><input data-g-h="'+i+'" type="text" value="'+this._e(g.height||'')+'"'+this._inp('')+'></div>';h+='</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">Entity</label><input type="text" list="roc-entities" data-g-entity="'+i+'" value="'+this._e(g.entity||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Attribute</label><input data-g-attr="'+i+'" type="text" value="'+this._e(g.attribute||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Min</label><input data-g-min="'+i+'" type="number" value="'+this._e(String(g.min??0))+'"'+this._inp('font-size:12px;')+'></div>';h+='<div><label class="roc-l">Max</label><input data-g-max="'+i+'" type="number" value="'+this._e(String(g.max??100))+'"'+this._inp('font-size:12px;')+'></div>';h+='</div>';const gs=g.color_gradient||[];h+='<div style="margin-bottom:8px;">';h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';h+='<label style="font-size:12px;font-weight:500;">Color gradient (smooth interpolation)</label>';h+='<button data-add-gg="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';h+='</div>';for(let j=0;j<gs.length;j++){const hex=this._toHex(gs[j].color);h+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';h+='<input type="number" data-g-gv="'+i+'-'+j+'" placeholder="value" value="'+gs[j].value+'"'+this._inp('font-size:12px;')+'>';h+='<input type="color" data-g-gc="'+i+'-'+j+'" value="'+hex+'" style="width:100%;height:30px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;">';h+='<button data-rm-gg="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';h+='</div>';}if(!gs.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No stops yet — add stops for smooth gradient, or use \'color\' in YAML for discrete conditions.</p>';h+='</div>';h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Orientation</label>';
    h+='<select data-g-orient="'+i+'"'+this._inp('')+'>';
    h+='<option value="vertical"'+((!g.orientation||g.orientation==="vertical")?" selected":"")+'>vertical – bottom→top (default)</option>';
    h+='<option value="top"'+(g.orientation==="top"?' selected':'')+'>top – top→bottom (blind/shade)</option>';
    h+='<option value="horizontal"'+(g.orientation==="horizontal"?' selected':'')+'>horizontal – left→right</option>';
    h+='<option value="right"'+(g.orientation==="right"?' selected':'')+'>right – right→left</option>';
    h+='<option value="radial"'+(g.orientation==="radial"?' selected':'')+'>radial – circular arc (extra YAML keys: arc, thickness, target)</option>';
    h+='</select></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Alert animation (border)</label>';
    h+='<select data-g-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!g.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(g.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(g.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Animation color</label>';
    h+='<input type="color" data-g-ac="'+i+'" value="'+(g.animation_color?this._toHex(g.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 70px 70px;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Alert condition: entity</label>';
    h+='<input type="text" list="roc-entities" data-g-alert-ent="'+i+'" value="'+this._e((g.alert_conditions&&g.alert_conditions.entity)||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Attribute (optional)</label>';
    h+='<input data-g-alert-attr="'+i+'" type="text" value="'+this._e((g.alert_conditions&&g.alert_conditions.attribute)||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Operator</label>';
    h+='<select data-g-alert-op="'+i+'"'+this._inp('font-size:12px;')+'>';
    h+='<option value=""'+(!g.alert_conditions?' selected':'')+'>&#8212;</option>';
    h+='<option value=">"'+(g.alert_conditions&&g.alert_conditions.operator===">"?' selected':'')+'>></option>';
    h+='<option value="<"'+(g.alert_conditions&&g.alert_conditions.operator==="<"?' selected':'')+'>&#60;</option>';
    h+='<option value=">="'+(g.alert_conditions&&g.alert_conditions.operator===">="?' selected':'')+'>>= </option>';
    h+='<option value="<="'+(g.alert_conditions&&g.alert_conditions.operator==="<="?' selected':'')+'>&#60;=</option>';
    h+='<option value="=="'+(g.alert_conditions&&g.alert_conditions.operator==="=="?' selected':'')+'>==</option>';
    h+='<option value="!="'+(g.alert_conditions&&g.alert_conditions.operator==="!="?' selected':'')+'>!=</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Value</label>';
    h+='<input data-g-alert-val="'+i+'" type="number" value="'+this._e(String(g.alert_conditions&&g.alert_conditions.value!==undefined?g.alert_conditions.value:''))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div><label class="roc-l">background / transition / visible / visible_template / tap_action / fade / mobile / z_index / color (YAML)</label>';h+='<textarea data-g-yaml="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-g-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(g.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('g',i,g.nav_mini===true);
    h+=this._mvBtns('g',i);
    h+='<button data-dup-g="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-g="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove gauge</button>';h+='</div></details>';return h;}

  _blindItem(b,i){
    const type=b.blind_type||'roller';
    const op=this._openPanels&&this._openPanels.has('bl-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="bl-'+i+'"'+(op?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Blind: '+this._e(b.id||'blind_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-bl-id="'+i+'" type="text" value="'+this._e(b.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top</label><input data-bl-top="'+i+'" type="text" value="'+this._e(b.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-bl-left="'+i+'" type="text" value="'+this._e(b.left||'')+'"'+this._inp('')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Width</label><input data-bl-w="'+i+'" type="text" value="'+this._e(b.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Height</label><input data-bl-h="'+i+'" type="text" value="'+this._e(b.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">z-index</label><input data-bl-z="'+i+'" type="number" value="'+this._e(String(b.z_index??6))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Entity</label><input type="text" list="roc-entities" data-bl-entity="'+i+'" value="'+this._e(b.entity||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Attribute</label><input data-bl-attr="'+i+'" type="text" value="'+this._e(b.attribute||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Min</label><input data-bl-min="'+i+'" type="number" value="'+this._e(String(b.min??0))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Max</label><input data-bl-max="'+i+'" type="number" value="'+this._e(String(b.max??100))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l" title="Real/visual coverage (%) at fully OPEN — the roleta\'s own safety margin the motor never fully retracts past, so a sliver of material always stays visible. Fully CLOSED is left untouched (always 100%). Corrects the VISUAL overlay only, so it matches reality even when you can\'t see the blind in person. 0 = off.">Top offset (%)</label><input data-bl-top-offset="'+i+'" type="number" step="0.1" min="0" max="95" value="'+this._e(String(b.top_offset??0))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Blind type</label><select data-bl-type="'+i+'"'+this._inp('')+'>';
    h+='<option value="roller"'+(type==='roller'?' selected':'')+'>roller &#8211; solid fill</option>';
    h+='<option value="day_night"'+(type==='day_night'?' selected':'')+'>day/night &#8211; striped</option>';
    h+='<option value="venetian"'+(type==='venetian'?' selected':'')+'>venetian &#8211; slats + gap</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Slat / roller color (CSS)</label><input data-bl-slat-color="'+i+'" type="text" value="'+this._e(b.slat_color||'rgba(0,0,0,0.9)') +'"'+this._inp('font-size:12px;font-family:monospace;')+'></div>';
    h+='</div>';
    if(type==='day_night'){
      h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
      h+='<div><label class="roc-l">Slat count (number of band pairs)</label><input data-bl-slat-count="'+i+'" type="number" min="1" step="1" value="'+this._e(String(b.slat_count??6))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='</div>';
    }else if(type==='venetian'){
      h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
      h+='<div><label class="roc-l">Slat width (px)</label><input data-bl-slat-w="'+i+'" type="number" value="'+this._e(String(b.slat_width??7))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='<div><label class="roc-l">Slat gap (px)</label><input data-bl-slat-g="'+i+'" type="number" value="'+this._e(String(b.slat_gap??6))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='<div><label class="roc-l">Gap color (CSS)</label><input data-bl-gap-color="'+i+'" type="text" value="'+this._e(b.gap_color||'rgba(180,160,140,0.35)')+'"'+this._inp('font-size:12px;font-family:monospace;')+'></div>';
      h+='</div>';
    }
    const _cc=(b.control&&typeof b.control==='object')?b.control:{};
    const _ccPl=_cc.placement||({popover:'float',dock:'dock'})[_cc.display]||(b.control?'float':'off');
    const _ccSide=_cc.dock_side||'right';
    const _ccPresets=Array.isArray(_cc.presets)?_cc.presets:[];
    h+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
    h+='<label class="roc-l" style="font-weight:600;">Cover control (roleta)</label>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;">';
    h+='<div><label class="roc-l">Control</label><select data-bl-ccdisp="'+i+'"'+this._inp('')+'>';
    h+='<option value="off"'+(_ccPl==='off'?' selected':'')+'>off</option>';
    h+='<option value="float"'+(_ccPl==='float'?' selected':'')+'>float &#8211; place freely</option>';
    h+='<option value="dock"'+(_ccPl==='dock'?' selected':'')+'>dock &#8211; edge rail</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Dock side</label><select data-bl-ccside="'+i+'"'+this._inp('')+'>';
    h+='<option value="right"'+(_ccSide==='right'?' selected':'')+'>right</option>';
    h+='<option value="left"'+(_ccSide==='left'?' selected':'')+'>left</option>';
    h+='</select></div>';
    h+='<div style="display:flex;align-items:center;gap:6px;padding-bottom:7px;"><input data-bl-ccslider="'+i+'" type="checkbox"'+(_cc.slider!==false?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label class="roc-l" style="margin:0;">Slider</label></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Top (float)</label><input data-bl-cctop="'+i+'" type="text" placeholder="'+this._e(b.top||'10%')+'" value="'+this._e(_cc.top||'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Left (float)</label><input data-bl-ccleft="'+i+'" type="text" placeholder="'+this._e(b.left||'10%')+'" value="'+this._e(_cc.left||'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Width</label><input data-bl-ccwidth="'+i+'" type="text" placeholder="52px" value="'+this._e(_cc.width||'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><label class="roc-l" style="margin:0;">Presets (icon only)</label><button data-add-ccp="'+i+'" style="padding:3px 8px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">+ Preset</button></div>';
    for(let j=0;j<_ccPresets.length;j++){
      const _p=_ccPresets[j]||{};
      h+='<div data-ccp-row="'+i+'" style="display:grid;grid-template-columns:52px 1fr 78px 1fr 24px;gap:6px;margin-bottom:4px;align-items:center;">';
      h+='<input data-ccp-pos type="number" min="0" max="100" placeholder="%" value="'+this._e(_p.position!=null?String(_p.position):'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<input data-ccp-icon type="text" placeholder="mdi:roller-shade" value="'+this._e(_p.icon||'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<input data-ccp-color type="text" placeholder="amber" value="'+this._e(_p.color||'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<input data-ccp-name type="text" placeholder="Name (tooltip)" value="'+this._e(_p.name||'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<button data-rm-ccp="'+i+':'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:16px;line-height:1;padding:0;">&#x2715;</button>';
      h+='</div>';
    }
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:2px 0 0;">Tap the blind to reveal the controller. Up / Stop / Down always shown. Name = tooltip only. Use real MDI icons e.g. <code>mdi:roller-shade</code> / <code>mdi:blinds</code> (materialdesignicons.com). Colour: HA name (indigo, amber, blue-grey) or CSS.</p>';
    h+='</div>';
    const cpBl=Object.assign({},b);['id','top','left','width','height','entity','attribute','min','max','top_offset','z_index','blind_type','slat_color','slat_count','slat_width','slat_gap','gap_color','slat_pitch','group','control'].forEach(function(k){delete cpBl[k];});
    const ysBl=Object.keys(cpBl).length?_yaml.s(cpBl):'';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">background / border_radius / transition / visible / visible_conditions (YAML)</label>';
    h+='<textarea data-bl-yaml="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ysBl)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-bl-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(b.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('bl',i,b.nav_mini===true);
    h+=this._mvBtns('bl',i);
    h+='<button data-dup-bl="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-bl="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove blind</button>';
    h+='</div></details>';
    return h;}

  _render(){
    if(!this._config)return;
    const c=this._config;
    const cR=this._roomView();
    const hasRooms=Array.isArray(c.rooms)&&c.rooms.length>0;
    const open=new Set();
    this.querySelectorAll('details[data-panel]').forEach(function(d){if(d.open)open.add(d.dataset.panel);});
    this._openPanels=open;
    const firstRender=open.size===0;

    const tapYaml=cR.tap_action?_yaml.s(cR.tap_action):'';
    const sec=function(id,label,count,inner,icon){
      const isOpen=open.has(id)||(firstRender&&id==='basic');
      const _d=label.indexOf(' — ');
      const _nm=_d>=0?label.slice(0,_d):label;
      const _ds=_d>=0?label.slice(_d+3):'';
      const _badge=count!==undefined?'<span style="min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:'+(count?'var(--primary-color)':'var(--divider-color)')+';color:'+(count?'#fff':'var(--secondary-text-color)')+';font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none;">'+count+'</span>':'';
      return '<details data-panel="'+id+'"'+(isOpen?' open':'')+' style="margin-bottom:8px;">'
        +'<summary style="cursor:pointer;padding:10px 12px;background:var(--secondary-background-color);border-radius:6px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;">'
        +'<span style="display:flex;align-items:center;gap:10px;min-width:0;">'
        +'<ha-icon icon="'+(icon||'mdi:shape-outline')+'" style="--mdc-icon-size:20px;color:var(--primary-color);flex:none;"></ha-icon>'
        +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span style="font-size:13px;font-weight:600;color:var(--primary-text-color);">'+_nm+'</span>'+(_ds?'<span style="font-size:12px;color:var(--secondary-text-color);margin-left:6px;">'+_ds+'</span>':'')+'</span>'
        +'</span>'
        +'<span style="display:flex;align-items:center;gap:8px;flex:none;">'+_badge+'<ha-icon icon="mdi:chevron-down" style="--mdc-icon-size:20px;color:var(--secondary-text-color);"></ha-icon></span>'
        +'</summary>'
        +'<div style="padding:12px;border:1px solid var(--divider-color);border-top:none;border-radius:0 0 6px 6px;margin-top:-1px;">'+inner+'</div>'
        +'</details>';
    };

    const btnStyle='padding:6px 14px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:13px;';

    let basicInner='<div style="display:grid;gap:8px;">';
    const _bgMode=this._bgMode||(cR.base_camera?'camera':'image');
    basicInner+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;">';
    basicInner+='<div><label class="roc-l">Background</label><select id="bg-mode"'+this._inp('')+'>';
    basicInner+='<option value="image"'+(_bgMode==='image'?' selected':'')+'>Image — static file or URL</option>';
    basicInner+='<option value="camera"'+(_bgMode==='camera'?' selected':'')+'>Camera — periodic snapshot</option>';
    basicInner+='</select></div>';
    basicInner+='<div style="display:flex;align-items:center;gap:8px;padding-bottom:6px;"><input id="zoom" type="checkbox"'+(c.zoom?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:13px;cursor:pointer;" for="zoom">Pan &amp; pinch-zoom (floorplan mode)</label></div>';
    basicInner+='</div>';
    basicInner+='<div id="bg-pane-image" style="display:'+(_bgMode==='image'?'block':'none')+';">';
    basicInner+='<div><label class="roc-l">Base image URL (required, unless using a camera above)</label><input id="base_image" type="text" placeholder="/local/images/room.webp" value="'+this._e(cR.base_image||'')+'"'+this._inp('')+'></div>';
    const _bicYaml=cR.base_image_conditions?_yaml.s(cR.base_image_conditions):'';
    basicInner+='<div style="margin-top:8px;"><label class="roc-l">Base image conditions (optional — swap image by entity state)</label><textarea id="base_image_conditions" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_bicYaml)+'</textarea></div>';
    basicInner+='</div>';
    basicInner+='<div id="bg-pane-camera" style="display:'+(_bgMode==='camera'?'grid':'none')+';grid-template-columns:2fr 1fr;gap:8px;">';
    basicInner+='<div><label class="roc-l">Base camera (live snapshot as background)</label><input id="base_camera" type="text" list="roc-entities" placeholder="camera.living_room" value="'+this._e(cR.base_camera||'')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label class="roc-l">Snapshot refresh (s) — a periodic photo, not a continuous video stream</label><input id="camera_refresh" type="number" min="2" step="1" value="'+(cR.camera_refresh??10)+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    basicInner+='<div><label class="roc-l">tap_action (YAML)</label><textarea id="tap_action_yaml" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    const _caY=cR.cards_above?_yaml.s(cR.cards_above):'';
    const _cbY=cR.cards_below?_yaml.s(cR.cards_below):'';
    basicInner+='<div class="roc-adv" style="border-top:1px dashed var(--divider-color);margin-top:6px;padding-top:8px;"><label class="roc-l" style="margin-bottom:2px;">Companion cards — paste card YAML to stack full Home Assistant cards above / below the image (handy on mobile). A YAML list; each item is a card config, or <code>{card: {...}, height, media: all|mobile|tablet|desktop|ultrawide}</code>.</label></div>';
    basicInner+='<div><label class="roc-l">Cards above image (YAML)</label><textarea id="cards_above_yaml" rows="4" placeholder="- type: entities&#10;  entities: [light.kitchen]"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_caY)+'</textarea></div>';
    basicInner+='<div><label class="roc-l">Cards below image (YAML)</label><textarea id="cards_below_yaml" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_cbY)+'</textarea></div>';
    const _woEd=typeof cR.weather_overlay==='string'?{entity:cR.weather_overlay}:(cR.weather_overlay||{});
    basicInner+='<div style="border-top:1px dashed var(--divider-color);margin-top:6px;padding-top:8px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;">';
    basicInner+='<div><label class="roc-l">Weather overlay entity (optional — rain/snow effect)</label><input id="weather_entity" type="text" list="roc-entities" placeholder="weather.home" value="'+this._e(_woEd.entity||'')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label class="roc-l">Effect</label><select id="weather_effect"'+this._inp('')+'>';
    ['auto','rain','rain-heavy','snow','snow-heavy','fog','lightning'].forEach(function(ef){basicInner+='<option value="'+ef+'"'+((_woEd.effect||'auto')===ef?' selected':'')+'>'+ef+'</option>';});
    basicInner+='</select></div>';
    basicInner+='<div><label class="roc-l">Opacity</label><input id="weather_opacity" type="number" step="0.05" min="0" max="1" value="'+(_woEd.opacity??0.45)+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    if(this._config&&this._config.nav&&this._config.nav.live==='custom')basicInner+='<div style="display:flex;align-items:center;gap:7px;margin-top:6px;"><input id="weather-nav-mini" type="checkbox"'+(cR.weather_nav_mini===true?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="weather-nav-mini" style="font-size:12px;cursor:pointer;">Show weather in nav.live: custom mini</label></div>';
    basicInner+='</div>';

    let filterInner='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;">Conditions are evaluated in order — first match wins. A block without an entity is the default (fallback).</p>';
    filterInner+='<div id="filter-blocks">';
    const self=this;
    (cR.filter_conditions||[]).forEach(function(fc,i){filterInner+=self._filterBlock(fc,i);});
    filterInner+='</div>';
    filterInner+='<button id="add-filter" style="'+btnStyle+'">+ Add filter condition</button>';

    const bm=cR.brightness_model||{};
    const bmSrcList=bm.source||[];
    const bmFgList=bm.filter_gradient||[];
    let bmInner='';
    bmInner+='<div style="margin-bottom:10px;">';
    bmInner+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    bmInner+='<label style="font-size:12px;font-weight:500;">Value sources (first matching condition wins)</label>';
    bmInner+='<button id="add-bm-src" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Source</button>';
    bmInner+='</div>';
    for(let i=0;i<bmSrcList.length;i++){
      const src=bmSrcList[i];
      const condYaml=src.condition?_yaml.s(src.condition):'';
      bmInner+='<div style="border:1px solid var(--divider-color);border-radius:6px;padding:8px;margin-bottom:6px;">';
      bmInner+='<div style="display:grid;grid-template-columns:1fr 1fr 70px 70px 28px;gap:6px;align-items:end;margin-bottom:6px;">';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Entity</label>';
      bmInner+='<input type="text" list="roc-entities" data-bm-src-ent="'+i+'" value="'+this._e(src.entity||'')+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Attribute (optional)</label>';
      bmInner+='<input data-bm-src-attr="'+i+'" type="text" value="'+this._e(src.attribute||'')+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Min</label>';
      bmInner+='<input data-bm-src-min="'+i+'" type="number" value="'+(src.min_input??0)+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Max</label>';
      bmInner+='<input data-bm-src-max="'+i+'" type="number" value="'+(src.max_input??100)+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<button data-rm-bm-src="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;align-self:center;">&#x2715;</button>';
      bmInner+='</div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Condition YAML (optional — leave empty = always matches)</label>';
      bmInner+='<textarea data-bm-src-cond="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:11px;resize:vertical;')+'>';
      bmInner+=this._e(condYaml)+'</textarea></div>';
      bmInner+='</div>';
    }
    if(!bmSrcList.length)bmInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0;">No sources — add at least one source entity.</p>';
    bmInner+='</div>';
    bmInner+='<div>';
    bmInner+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    bmInner+='<label style="font-size:12px;font-weight:500;">Filter gradient stops (value = 0–100 %)</label>';
    bmInner+='<button id="add-bm-fg" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';
    bmInner+='</div>';
    for(let i=0;i<bmFgList.length;i++){
      bmInner+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:6px;align-items:center;margin-bottom:4px;">';
      bmInner+='<input type="number" data-bm-fg-val="'+i+'" min="0" max="100" placeholder="%" value="'+bmFgList[i].value+'"'+this._inp('font-size:12px;')+'>';
      bmInner+='<input type="text" data-bm-fg-filt="'+i+'" placeholder="e.g. brightness(0.5) sepia(0.3)" value="'+this._e(bmFgList[i].filter||'')+'"'+this._inp('font-size:12px;font-family:monospace;')+'>';
      bmInner+='<button data-rm-bm-fg="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';
      bmInner+='</div>';
    }
    if(!bmFgList.length)bmInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0;">No stops — add at least 2 stops (value 0 and 100).</p>';
    bmInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:6px 0 0;">Source value is normalized to 0–100 % and interpolated across stops.</p>';
    bmInner+='</div>';
    // Unified filter section — one mode toggle picks discrete vs smooth; only the
    // active mode is kept on save (they're mutually exclusive at runtime).
    const _fMode=this._filterMode||(cR.brightness_model?'smooth':'conditional');
    const _fCount=_fMode==='smooth'?((bm.source?.length||0)+(bm.filter_gradient?.length||0)):(cR.filter_conditions||[]).length;
    let filtCombined='<div style="margin-bottom:12px;"><label class="roc-l">Filter mode</label><select id="filter-mode"'+this._inp('')+'>';
    filtCombined+='<option value="conditional"'+(_fMode==='conditional'?' selected':'')+'>Conditional — discrete states (first match wins)</option>';
    filtCombined+='<option value="smooth"'+(_fMode==='smooth'?' selected':'')+'>Smooth — interpolate from a sensor (brightness model)</option>';
    filtCombined+='</select></div>';
    filtCombined+='<div style="margin-bottom:12px;"><label class="roc-l">Filter transition</label><input id="filter_transition" type="text" value="'+this._e(c.filter_transition||'2s ease')+'"'+this._inp('')+'></div>';
    filtCombined+='<div id="filter-pane-conditional" style="'+(_fMode==='conditional'?'':'display:none;')+'">'+filterInner+'</div>';
    filtCombined+='<div id="filter-pane-smooth" style="'+(_fMode==='smooth'?'':'display:none;')+'">'+bmInner+'</div>';

    let ovInner='<div id="ov-list">';
    (cR.overlays||[]).forEach(function(ov,i){ovInner+=self._ovItem(ov,i);});
    ovInner+='</div><button id="add-ov" style="'+btnStyle+'margin-top:4px;">+ Add overlay</button>';

    let zInner='<div id="z-list">';
    (cR.zones||[]).forEach(function(z,i){zInner+=self._zoneItem(z,i);});
    zInner+='</div><button id="add-z" style="'+btnStyle+'margin-top:4px;">+ Add zone</button>';

    let bInner='<div id="b-list">';
    (cR.badges||[]).forEach(function(b,i){bInner+=self._badgeItem(b,i);});
    bInner+='</div><button id="add-b" style="'+btnStyle+'margin-top:4px;">+ Add badge</button>';

    let elInner='<div id="el-list">';
    (cR.elements||[]).forEach(function(el,i){elInner+=self._elItem(el,i);});
    elInner+='</div><button id="add-el" style="'+btnStyle+'margin-top:4px;">+ Add element</button>';

    let icoInner='<div id="ico-list">';
    (cR.icons||[]).forEach(function(ico,i){icoInner+=self._icoItem(ico,i);});
    icoInner+='</div><button id="add-ico" style="'+btnStyle+'margin-top:4px;">+ Add icon</button>';

    let lblInner='<div id="lbl-list">';
    (cR.labels||[]).forEach(function(lbl,i){lblInner+=self._lblItem(lbl,i);});
    lblInner+='</div><button id="add-lbl" style="'+btnStyle+'margin-top:4px;">+ Add label</button>';

    let gInner='<div id="g-list">';
    (cR.gauges||[]).forEach(function(g,i){gInner+=self._gaugeItem(g,i);});
    gInner+='</div><button id="add-g" style="'+btnStyle+'margin-top:4px;">+ Add gauge</button>';

    let blInner='<div id="bl-list">';
    (cR.blinds||[]).forEach(function(b,i){blInner+=self._blindItem(b,i);});
    blInner+='</div><button id="add-bl" style="'+btnStyle+'margin-top:4px;">+ Add blind</button>';

    let grpInner='<div id="grp-list">';
    (cR.groups||[]).forEach(function(g,i){grpInner+=self._groupItem(g,i);});
    grpInner+='</div><button id="add-grp" style="'+btnStyle+'margin-top:4px;">+ Add group</button>';

    // ---- Rooms (multi-room) section ----------------------------------------
    let roomsInner='';
    if(hasRooms){
      const er=cR;
      roomsInner+='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">';
      roomsInner+='<span style="font-size:12px;color:var(--secondary-text-color);">Editing <b>'+self._e(er.name||er.id||('room_'+(self._editRoomIdx+1)))+'</b> — pick the room in the header above.</span>';
      const _rcnt=c.rooms.length,_ri=self._editRoomIdx;
      const _navBtn='padding:6px 10px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:13px;line-height:1;';
      roomsInner+='<span style="display:flex;gap:8px;flex:none;align-items:center;">';
      roomsInner+='<button id="room-up" title="Move room earlier"'+(_ri<=0?' disabled':'')+' style="'+_navBtn+(_ri<=0?'opacity:0.4;cursor:default;':'')+'">&#9650;</button>';
      roomsInner+='<button id="room-down" title="Move room later"'+(_ri>=_rcnt-1?' disabled':'')+' style="'+_navBtn+(_ri>=_rcnt-1?'opacity:0.4;cursor:default;':'')+'">&#9660;</button>';
      roomsInner+='<button id="add-room" style="'+btnStyle+'">+ Room</button>';
      roomsInner+='<button id="rm-room" style="padding:6px 14px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:13px;">Remove</button>';
      roomsInner+='</span>';
      roomsInner+='</div>';
      roomsInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
      roomsInner+='<div><label class="roc-l">Room id</label><input id="room-id" type="text" value="'+this._e(er.id||'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Name</label><input id="room-name" type="text" value="'+this._e(er.name||'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Room icon (shown only when nav style = tabs)</label><input id="room-icon" type="text" placeholder="mdi:sofa" value="'+this._e(er.icon||'')+'"'+this._inp('')+'></div>';
      roomsInner+='</div>';
      roomsInner+='<div style="margin-bottom:8px;"><label class="roc-l">Area match (comma-separated states of room_entity that map to this room, e.g. Bermuda area names)</label><input id="room-area-match" type="text" placeholder="Bedroom, Ložnice" value="'+this._e(Array.isArray(er.area_match)?er.area_match.join(', '):'')+'"'+this._inp('')+'></div>';
      const _rch=er.chips?_yaml.s(er.chips):'';
      roomsInner+='<div style="margin-bottom:8px;"><label class="roc-l">Thumbnail chips override (YAML list — falls back to nav.chips; {room} = room id)</label><textarea id="room-chips" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_rch)+'</textarea></div>';
      roomsInner+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
      const _reIsObj=typeof c.room_entity==='object'&&c.room_entity;
      roomsInner+='<div><label class="roc-l">room_entity (active room follows it — e.g. Bermuda area sensor or input_select)</label><input id="room_entity" type="text" list="roc-entities"'+(_reIsObj?' disabled placeholder="per-device mapping active — edit by_user/by_browser in YAML"':' placeholder="sensor.phone_area"')+' value="'+this._e(typeof c.room_entity==='string'?c.room_entity:'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Follow hold (s after manual switch)</label><input id="follow_hold" type="number" min="0" step="5" value="'+(c.follow_hold??60)+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">card_id (pairing key)</label><input id="card_id" type="text" value="'+this._e(c.card_id||'')+'"'+this._inp('')+'></div>';
      roomsInner+='</div>';
      roomsInner+='<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-bottom:8px;">';
      roomsInner+='<div><label class="roc-l">Follow mode</label><select id="follow_mode"'+this._inp('')+'>';
      [['always','always — follow continuously'],['initial','initial — only when the card loads'],['manual','manual — button / action only']].forEach(function(o){roomsInner+='<option value="'+o[0]+'"'+((c.follow_mode||'always')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      roomsInner+='</select></div>';
      const _rseIsObj=typeof c.room_state_entity==='object'&&c.room_state_entity;
      roomsInner+='<div><label class="roc-l">room_state_entity (card writes the active room here — input_text / input_select)</label><input id="room_state_entity" type="text" list="roc-entities"'+(_rseIsObj?' disabled placeholder="per-device mapping — edit in YAML"':' placeholder="input_text.active_room"')+' value="'+this._e(typeof c.room_state_entity==='string'?c.room_state_entity:'')+'"'+this._inp('')+'></div>';
      roomsInner+='</div>';
      const _bidNow=window.browser_mod?.browserID||window.browser_mod?.browser_id||'';
      roomsInner+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
      roomsInner+='<label class="roc-l">This device — browser_mod ID: <b>'+this._e(_bidNow||'(browser_mod not detected)')+'</b></label>';
      if(_bidNow){
        roomsInner+='<div style="display:grid;grid-template-columns:2fr auto;gap:8px;align-items:end;">';
        roomsInner+='<div><label class="roc-l">Presence sensor for this device (e.g. its Bermuda area sensor)</label><input id="bid-entity" type="text" list="roc-entities" placeholder="sensor.tablet_area"'+this._inp('')+'></div>';
        roomsInner+='<button id="bid-map" style="'+btnStyle+'">Map this device</button>';
        roomsInner+='</div>';
        roomsInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Adds/updates room_entity.by_browser for this device. Open the editor on each device you want to map.</p>';
      }
      roomsInner+='</div>';
      const _nav=(c.nav&&typeof c.nav==='object')?c.nav:{};
      const _navMini=(_nav.mini&&typeof _nav.mini==='object')?_nav.mini:{};
      roomsInner+='<div style="border-top:1px solid var(--divider-color);padding-top:12px;margin-top:4px;"><label class="roc-l" style="font-weight:600;">Navigation menu</label>';
      roomsInner+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
      roomsInner+='<div><label class="roc-l">Style</label><select id="nav-style"'+this._inp('')+'>';
      [['thumbnails','thumbnails — live room minis'],['tabs','tabs — icon + name'],['dots','dots'],['none','none (hide menu)']].forEach(function(o){roomsInner+='<option value="'+o[0]+'"'+((_nav.style||'thumbnails')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      roomsInner+='</select></div>';
      roomsInner+='<div><label class="roc-l">Position</label><select id="nav-position"'+this._inp('')+'>';
      [['top','top'],['bottom','bottom'],['left','left (side rail)'],['right','right (side rail)'],['auto','auto (rail on wide)']].forEach(function(o){roomsInner+='<option value="'+o[0]+'"'+((_nav.position||'top')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      roomsInner+='</select></div>';
      roomsInner+='</div>';
      const _navLiveIsMiniTier=_nav.live==='full'||_nav.live==='custom';
      roomsInner+='<div style="margin-bottom:8px;"><label class="roc-l">Live thumbnails (mini-room view)</label><select id="nav-live"'+this._inp('')+'>';
      [['','off — base image + filter (classic)'],['composite','composite — base + active overlays + filters (live mini-room)'],['custom','custom — live room minis (real instances, pick which elements show)'],['full','full — live room minis (real instances, everything)']].forEach(function(o){roomsInner+='<option value="'+o[0]+'"'+((_nav.live||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      roomsInner+='</select><p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Composite thumbs mirror each room’s current look — lit lamps, day/night filter, conditional base images. Pop-up (grouped) and template-driven overlays are skipped. Full mounts a real, independent copy of each room — gauges, labels, icons, blinds, embedded cards and all — scaled down; heavier on older tablets, test yours with more than a couple of rooms. Custom is the same, but starts empty — tick "Show in mini" on each element you want included (below, and the weather toggle in the Basic tab).</p></div>';
      roomsInner+='<div id="nav-mini-panel" style="'+(_navLiveIsMiniTier?'':'display:none;')+'border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
      roomsInner+='<label class="roc-l" style="font-weight:600;">Mini-room settings (live: '+(_nav.live==='custom'?'custom':'full')+')</label>';
      roomsInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;align-items:center;">';
      roomsInner+='<div style="display:flex;align-items:center;gap:7px;"><input id="nav-mini-templates" type="checkbox"'+(_navMini.templates?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="nav-mini-templates" style="font-size:12px;cursor:pointer;">Label/colour templates</label></div>';
      roomsInner+='<div><label class="roc-l">Camera refresh (s, min 30)</label><input id="nav-mini-camera-refresh" type="number" min="30" step="5" placeholder="30" value="'+(_navMini.camera_refresh!=null?_navMini.camera_refresh:'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Reference width (px)</label><input id="nav-mini-width-ref" type="number" min="120" step="10" placeholder="480" value="'+(_navMini.width_ref!=null?_navMini.width_ref:'')+'"'+this._inp('')+'></div>';
      roomsInner+='</div>';
      roomsInner+=(_nav.live==='custom'
        ?'<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Nothing shows in the mini until you tick "Show in mini" on it — look for the checkbox on each gauge/label/icon/badge/blind/element panel below (and the weather toggle in the Basic tab). Templates and camera streams are extra per-room subscriptions — off by default regardless.</p>'
        :'<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Templates and camera streams are extra per-room subscriptions — off by default. Every mini shows everything unconditionally; switch to "custom" above to pick individual elements instead.</p>');
      roomsInner+='</div>';
      roomsInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
      roomsInner+='<div><label class="roc-l">Height</label><input id="nav-height" type="text" placeholder="64px" value="'+this._e(_nav.height||'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Item width (css or auto)</label><input id="nav-width" type="text" placeholder="auto / 120px" value="'+this._e(_nav.width||'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Mobile height</label><input id="nav-mobile-height" type="text" placeholder="48px" value="'+this._e(_nav.mobile_height||'')+'"'+this._inp('')+'></div>';
      roomsInner+='</div>';
      roomsInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;align-items:center;">';
      roomsInner+='<div><label class="roc-l">Auto breakpoint (px)</label><input id="nav-auto-bp" type="number" min="0" step="10" placeholder="1100" value="'+(_nav.auto_breakpoint!=null?_nav.auto_breakpoint:'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Wheel switch</label><select id="nav-wheel"'+this._inp('')+'>';
      const _whCur=(_nav.wheel===true?'horizontal':(_nav.wheel||''));
      [['','off'],['horizontal','horizontal'],['vertical','vertical'],['both','both']].forEach(function(o){roomsInner+='<option value="'+o[0]+'"'+(_whCur===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      roomsInner+='</select></div>';
      roomsInner+='<div style="display:flex;align-items:center;gap:7px;padding-top:18px;"><input id="nav-follow-btn" type="checkbox"'+(_nav.follow_button!==false?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="nav-follow-btn" style="font-size:12px;cursor:pointer;">Follow button</label></div>';
      roomsInner+='</div>';
      // URL deep-linking (top-level url_sync) — bookmarkable #room=<id>
      const _usCur=c.url_sync,_usOn=!!_usCur,_usKey=(typeof _usCur==='string')?_usCur:'';
      roomsInner+='<div style="display:grid;grid-template-columns:auto 1fr;gap:8px;margin-bottom:8px;align-items:center;">';
      roomsInner+='<div style="display:flex;align-items:center;gap:7px;padding-top:18px;"><input id="url-sync" type="checkbox"'+(_usOn?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="url-sync" style="font-size:12px;cursor:pointer;">Sync room to URL</label></div>';
      roomsInner+='<div><label class="roc-l">URL hash key (blank = "room" → #room=&lt;id&gt;)</label><input id="url-sync-key" type="text" placeholder="room" value="'+this._e(_usKey)+'"'+this._inp('')+'></div>';
      roomsInner+='</div>';
      const _chY=_nav.chips?_yaml.s(_nav.chips):'';
      roomsInner+='<div><label class="roc-l">Chips (YAML list — sensor pills on thumbnails; {room} = room id)</label><textarea id="nav-chips" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_chY)+'</textarea></div>';
      const _cdY=_nav.cards?_yaml.s(_nav.cards):'';
      roomsInner+='<div style="margin-top:6px;"><label class="roc-l">Cards (YAML list — custom HA cards in the strip; keys: card, width, placement, media)</label><textarea id="nav-cards" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_cdY)+'</textarea></div>';
      roomsInner+='</div>';
    }else{
      roomsInner+='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;">Single-room card. Convert to multi-room to get the thumbnail room switcher, swipe navigation, switch-room actions and room_entity follow (e.g. Bermuda).</p>';
      roomsInner+='<button id="conv-rooms" style="'+btnStyle+'">Convert to multi-room</button>';
    }

    // ---- First-run onboarding + tabbed editor (v1.14.1) ---------------------
    const _nArr=function(k){return Array.isArray(cR[k])?cR[k].length:0;};
    const _realImg=cR.base_image&&cR.base_image!=='/local/room.webp';
    const _isEmpty=!hasRooms&&!_realImg&&!cR.base_camera&&(_nArr('zones')+_nArr('icons')+_nArr('labels')+_nArr('badges')+_nArr('gauges')+_nArr('blinds')+_nArr('elements')+_nArr('overlays'))===0;
    const _onboardHtml=
      '<div style="padding:18px 14px;border:1px dashed var(--divider-color);border-radius:10px;text-align:center;">'
      +'<div style="font-size:15px;font-weight:600;margin-bottom:6px;">Build your room card</div>'
      +'<div style="font-size:12px;color:var(--secondary-text-color);margin:0 auto 14px;max-width:430px;line-height:1.5;">Start with a background — a floor-plan or room photo. Then turn on <b>Interactive preview</b> above and drag elements onto it. The rest of the editor appears once a background is set.</div>'
      +'<div style="max-width:430px;margin:0 auto;text-align:left;">'
      +'<label class="roc-l">Background image URL *</label>'
      +'<input id="base_image" type="text" placeholder="/local/room.webp or https://…" value="'+this._e(_realImg?cR.base_image:'')+'"'+this._inp('')+'>'
      +'<div style="font-size:11px;color:var(--secondary-text-color);margin:10px 0 4px;">… or use a live camera snapshot instead:</div>'
      +'<input id="base_camera" type="text" list="roc-entities" placeholder="camera.living_room" value="'+this._e(cR.base_camera||'')+'"'+this._inp('')+'>'
      +'</div></div>';
    // Layout tab (v4) — two profiles (portrait/landscape) on a % grid of the viewport
    const _ly=c.layout||{};
    const _lyH=_ly.height||'viewport';
    const _lyHMode=(_lyH==='viewport'||_lyH==='container')?_lyH:'custom';
    const _lyOr=(typeof _ly.orientation==='string')?_ly.orientation:'auto';
    const _lyPin=(_ly.orientation&&typeof _ly.orientation==='object')?_ly.orientation:null;
    const _bidNowL=window.browser_mod?.browserID||window.browser_mod?.browser_id||'';
    const _pinVal=(_lyPin&&_bidNowL&&_lyPin.by_browser)?(_lyPin.by_browser[_bidNowL]||''):'';
    let respInner='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;line-height:1.5;">Two layout profiles — <b>portrait</b> / <b>landscape</b> — picked by the viewport&#39;s width/height ratio (not by device type). Each profile is a % grid of the available screen and every block (region) gets a cell. <b>You own the percentages</b> (rows should sum to &le;100). Turn on <b>Test mode</b> to see region outlines and a profile switch button on the card.</p>';
    respInner+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">';
    respInner+='<div><label class="roc-l">Height</label><select id="ly-hmode"'+this._inp('')+'><option value="viewport"'+(_lyHMode==='viewport'?' selected':'')+'>viewport (full view)</option><option value="container"'+(_lyHMode==='container'?' selected':'')+'>container (parent)</option><option value="custom"'+(_lyHMode==='custom'?' selected':'')+'>custom&#8230;</option></select></div>';
    respInner+='<div><label class="roc-l">Custom height</label><input id="ly-hcustom" type="text" placeholder="e.g. 90vh / 800px" value="'+this._e(_lyHMode==='custom'?String(_lyH):'')+'"'+this._inp('')+'></div>';
    respInner+='<div><label class="roc-l">Orientation</label><select id="ly-orient"'+this._inp('')+'><option value="auto"'+(_lyOr==='auto'?' selected':'')+'>auto (by ratio)</option><option value="portrait"'+(_lyOr==='portrait'?' selected':'')+'>always portrait</option><option value="landscape"'+(_lyOr==='landscape'?' selected':'')+'>always landscape</option></select></div>';
    respInner+='<div><label class="roc-l">Threshold (w/h)</label><input id="ly-threshold" type="number" step="0.05" min="0.1" placeholder="1.0" value="'+(_ly.threshold!=null?_ly.threshold:'')+'"'+this._inp('')+'></div>';
    respInner+='</div>';
    respInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;align-items:end;">';
    respInner+='<div><label class="roc-l">Pin THIS device (browser_mod: '+this._e(_bidNowL||'not detected')+')</label><select id="ly-pin"'+this._inp('')+(_bidNowL?'':' disabled')+'><option value=""'+(!_pinVal?' selected':'')+'>&#8212; follow auto &#8212;</option><option value="portrait"'+(_pinVal==='portrait'?' selected':'')+'>portrait</option><option value="landscape"'+(_pinVal==='landscape'?' selected':'')+'>landscape</option></select></div>';
    respInner+='<div><label class="roc-l">Grid gap</label><input id="ly-gap" type="text" placeholder="0px" value="'+this._e(_ly.gap||'')+'"'+this._inp('')+'></div>';
    respInner+='<div style="font-size:11px;color:var(--secondary-text-color);line-height:1.4;">Pinning forces this device&#39;s profile even when rotated (<code>layout.orientation.by_browser</code>).</div>';
    respInner+='</div>';
    // Per-profile grid editors
    const _regListEd=['nav','cards_above','image','lights','cards_below','cover'];
    const _profBox=function(pk){
      const lp=_ly[pk]||{};
      const _csv=function(a){return Array.isArray(a)?a.map(function(x){return String(x);}).join(', '):'';};
      let h='<div style="border:1px solid var(--divider-color);border-radius:8px;padding:10px;margin-bottom:12px;">';
      h+='<label class="roc-l" style="font-weight:700;font-size:13px;letter-spacing:0.03em;">'+pk.toUpperCase()+'</label>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 8px;">';
      h+='<div><label class="roc-l">Rows % (comma separated)</label><input id="ly-rows__'+pk+'" type="text" placeholder="e.g. 10, 10, 70, 5, 5" value="'+self._e(_csv(lp.rows))+'"'+self._inp('font-size:12px;')+'></div>';
      h+='<div><label class="roc-l">Columns % (comma separated)</label><input id="ly-cols__'+pk+'" type="text" placeholder="100" value="'+self._e(_csv(lp.columns))+'"'+self._inp('font-size:12px;')+'></div>';
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:110px 1fr 1fr 60px;gap:6px;align-items:center;font-size:11px;color:var(--secondary-text-color);"><span></span><span>Row (3 or 1/6)</span><span>Column</span><span>Scroll</span></div>';
      _regListEd.forEach(function(rg){
        const pl=(lp.place&&lp.place[rg])||null;
        h+='<div style="display:grid;grid-template-columns:110px 1fr 1fr 60px;gap:6px;align-items:center;margin-top:4px;">';
        h+='<label class="roc-l" style="margin:0;">'+rg+'</label>';
        h+='<input id="ly-r__'+pk+'__'+rg+'" type="text" placeholder="hidden" value="'+self._e(pl&&pl.row!=null?String(pl.row):'')+'"'+self._inp('font-size:12px;')+'>';
        h+='<input id="ly-c__'+pk+'__'+rg+'" type="text" placeholder="1" value="'+self._e(pl&&pl.col!=null?String(pl.col):'')+'"'+self._inp('font-size:12px;')+'>';
        h+='<input id="ly-o__'+pk+'__'+rg+'" type="checkbox"'+(pl&&pl.overflow==='auto'?' checked':'')+' style="width:16px;height:16px;cursor:pointer;justify-self:center;">';
        h+='</div>';
      });
      h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:8px 0 0;line-height:1.5;">Empty <b>Row</b> = region hidden in this profile. Spans use CSS grid lines: <code>1/6</code> = rows 1&#8211;5. The <b>cover</b> region shows blinds whose control placement is <code>dock</code>; <code>float</code> controls stay as tap-reveal overlays on the image.</p>';
      h+='<div style="margin-top:10px;"><label class="roc-l" style="margin-bottom:4px;">Preview <span style="font-weight:400;color:var(--secondary-text-color);">(illustrative diagram, not a live render)</span></label>';
      h+='<div id="ly-preview__'+pk+'" style="height:120px;border:1px dashed var(--divider-color);border-radius:6px;padding:4px;box-sizing:border-box;background:rgba(255,255,255,0.02);">'+rocLyPreviewHtml(lp)+'</div></div>';
      h+='</div>';
      return h;
    };
    const _lySub=this._lySub==='landscape'?'landscape':'portrait';
    respInner+='<div style="display:flex;gap:6px;margin-bottom:10px;">'+['portrait','landscape'].map(function(pk){
      const on=_lySub===pk;
      return '<button data-rocsub="'+pk+'" type="button" style="padding:5px 14px;border-radius:999px;font-size:12px;font-weight:'+(on?'700':'400')+';border:1px solid '+(on?'var(--primary-color)':'var(--divider-color)')+';background:'+(on?'rgba(3,169,244,0.15)':'none')+';color:'+(on?'var(--primary-color)':'var(--primary-text-color)')+';cursor:pointer;">'+(pk==='portrait'?'Portrait':'Landscape')+'</button>';
    }).join('')+'</div>';
    respInner+='<div data-rocsubpanel="portrait" style="display:'+(_lySub==='portrait'?'block':'none')+';">'+_profBox('portrait')+'</div>';
    respInner+='<div data-rocsubpanel="landscape" style="display:'+(_lySub==='landscape'?'block':'none')+';">'+_profBox('landscape')+'</div>';
    // Per-profile scalar inputs — fill only Landscape to use one value everywhere.
    const _profRow=function(idb,label,val,ph){
      const isObj=val&&typeof val==='object';
      const sc=(val!=null&&!isObj)?String(val):'';
      let h='<div style="margin-bottom:8px;"><label class="roc-l">'+label+'</label>';
      h+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';
      ROC_PROFILES.forEach(function(pk){
        const v0=isObj?(val[pk]!=null?String(val[pk]):''):(pk==='landscape'?sc:'');
        h+='<input id="'+idb+'__'+pk+'" type="text" placeholder="'+pk+(ph?' '+ph:'')+'" value="'+self._e(v0)+'"'+self._inp('font-size:12px;')+'>';
      });
      h+='</div></div>';
      return h;
    };
    respInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 8px;line-height:1.5;">Per profile: Portrait / Landscape. Fill only <b>Landscape</b> to use one value everywhere.</p>';
    respInner+=_profRow('aspect_ratio','Aspect ratio (design shape of the image)',c.aspect_ratio,'e.g. 16/9');
    respInner+=_profRow('border_radius','Border radius',c.border_radius,'e.g. 12px');
    respInner+=_profRow('image_fit','Image fit (cover = crop, contain = letterbox)',c.image_fit,'cover|contain');
    respInner+='<div style="border-top:1px solid var(--divider-color);padding-top:12px;"><label class="roc-l">Lock layout to image</label>';
    respInner+='<input id="lock_aspect" type="text" placeholder="off — or: true (auto from image) / 16/9" value="'+this._e(c.lock_aspect===true?'true':(c.lock_aspect||''))+'"'+this._inp('')+'>';
    respInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:6px 0 0;line-height:1.5;">When set, zones / icons / blinds etc. stay glued to the image across every tier — per-tier <code>aspect_ratio</code> then only changes how much of the image is cropped, not where elements sit. Use <b>true</b> to take the design shape from the image automatically, or pin an explicit aspect like <b>1720/968</b> (your source image’s real W/H).</p></div>';
    // Light controls section (Elements tab)
    const _lc=cR.light_controls||{};
    const _lcEnts=(Array.isArray(_lc.entities)?_lc.entities:[]).map(function(e){return typeof e==='string'?{entity:e}:(e||{});});
    let lcInner='';
    lcInner+='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;line-height:1.5;">A strip rendered above the image. <code>light.*</code> entities render as a <code>material-slider-card</code> brightness slider (requires that resource); on/off entities (<code>switch.*</code>, <code>input_boolean.*</code>, <code>fan.*</code>…) render as an on/off toggle pill. Both share a lux-driven border colour — a smooth gradient between two colours (dark = low lux, bright = high lux).</p>';
    lcInner+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><label style="font-size:12px;font-weight:500;">Lights &amp; switches</label><button id="add-lc-ent" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Entity</button></div>';
    for(let i=0;i<_lcEnts.length;i++){
      lcInner+='<div style="display:grid;grid-template-columns:1fr 130px 28px;gap:6px;align-items:center;margin-bottom:4px;">';
      lcInner+='<input type="text" list="roc-entities" data-lc-ent="'+i+'" placeholder="light.bedroom_1 · switch.lamp" value="'+this._e(_lcEnts[i].entity||'')+'"'+this._inp('font-size:12px;')+'>';
      lcInner+='<input type="text" data-lc-name="'+i+'" placeholder="Name (optional)" value="'+this._e(_lcEnts[i].name||'')+'"'+this._inp('font-size:12px;')+'>';
      lcInner+='<button data-rm-lc-ent="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';
      lcInner+='</div>';
    }
    if(!_lcEnts.length)lcInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0;">No entities yet — add a light or switch.</p>';
    lcInner+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">';
    lcInner+='<div><label class="roc-l">Lux sensor</label><input id="lc-lux" type="text" list="roc-entities" placeholder="sensor.kitchen_illuminance" value="'+this._e(_lc.lux_sensor||'')+'"'+this._inp('')+'></div>';
    lcInner+='<div><label class="roc-l">Lux max (full brightness)</label><input id="lc-luxmax" type="number" min="1" placeholder="50" value="'+this._e(_lc.lux_max!=null?String(_lc.lux_max):'')+'"'+this._inp('')+'></div>';
    lcInner+='<div><label class="roc-l">Columns</label><input id="lc-cols" type="number" min="1" placeholder="'+(_lcEnts.length||3)+'" value="'+this._e(_lc.columns!=null?String(_lc.columns):'')+'"'+this._inp('')+'></div>';
    lcInner+='<div><label class="roc-l">Control height — sliders &amp; switches (px, vh, %, per-tier)</label><input id="lc-height" type="text" placeholder="20 · 4vh · {mobile: 20, desktop: 60}" value="'+this._e(_lc.height!=null?(typeof _lc.height==='object'?('{'+Object.keys(_lc.height).map(function(k){return k+': '+_lc.height[k];}).join(', ')+'}'):String(_lc.height)):'')+'"'+this._inp('')+'></div>';
    lcInner+='</div>';
    lcInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">';
    lcInner+='<div><label class="roc-l">Colour — dark (low lux)</label><input id="lc-color-low" type="color" value="'+this._toHex(_lc.color_low||LC_DEF_LOW)+'" style="width:100%;height:34px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;"></div>';
    lcInner+='<div><label class="roc-l">Colour — bright (high lux)</label><input id="lc-color-high" type="color" value="'+this._toHex(_lc.color_high||LC_DEF_HIGH)+'" style="width:100%;height:34px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;"></div>';
    lcInner+='<div><label class="roc-l">Background (light off)</label><input id="lc-bg-off" type="color" value="'+this._toHex(_lc.bg_off||LC_DEF_BG)+'" style="width:100%;height:34px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;"></div>';
    lcInner+='</div>';
    // Gradient preview — samples the SAME HSL ramp as the border ring, with tick
    // marks at ¼ ½ ¾ so you can see where a given lux level lands on the colour.
    const _lcLuxMax=(_lc.lux_max!=null&&_lc.lux_max>0)?_lc.lux_max:50;
    lcInner+='<div style="margin-top:10px;">';
    lcInner+='<label class="roc-l">Gradient preview (border colour vs. lux)</label>';
    lcInner+='<div id="lc-grad-preview" style="position:relative;height:22px;border-radius:999px;border:1px solid var(--divider-color);background:'+lcGradientCss(_lc.color_low||LC_DEF_LOW,_lc.color_high||LC_DEF_HIGH)+';overflow:hidden;">';
    ['25','50','75'].forEach(function(p){lcInner+='<span style="position:absolute;top:0;bottom:0;left:'+p+'%;width:2px;transform:translateX(-1px);background:rgba(255,255,255,0.9);box-shadow:0 0 1.5px rgba(0,0,0,0.7);"></span>';});
    lcInner+='</div>';
    lcInner+='<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--secondary-text-color);margin-top:3px;"><span>0 lx</span><span>¼</span><span>½</span><span>¾</span><span id="lc-grad-max">'+this._e(String(_lcLuxMax))+' lx</span></div>';
    lcInner+='</div>';

    // Tabbed shell — all panels render; the active one is shown, others hidden via CSS
    const _tab=this._tab||'image';
    const _tabBtn=function(id,icon,label){
      const on=_tab===id;
      return '<button data-roctab="'+id+'" type="button" style="padding:9px 11px;font-size:13px;white-space:nowrap;background:none;border:none;border-bottom:2px solid '+(on?'var(--primary-color)':'transparent')+';color:'+(on?'var(--primary-color)':'var(--secondary-text-color)')+';cursor:pointer;font-weight:'+(on?'600':'400')+';"><ha-icon icon="'+icon+'" style="--mdc-icon-size:16px;vertical-align:-3px;"></ha-icon> '+label+'</button>';
    };
    const _panel=function(id,inner){
      return '<div data-rocpanel="'+id+'" style="display:'+(_tab===id?'block':'none')+';">'+inner+'</div>';
    };
    const _tabbedHtml=
      '<div style="display:flex;gap:2px;border-bottom:1px solid var(--divider-color);overflow-x:auto;margin-bottom:12px;">'
      +_tabBtn('image','mdi:image','Image')
      +_tabBtn('elements','mdi:shape','Elements')
      +_tabBtn('responsive','mdi:monitor-cellphone','Layout')
      +_tabBtn('rooms','mdi:floor-plan','Rooms &amp; menu')
      +'</div>'
      +_panel('image',
          sec('basic','Background &amp; basics'+(hasRooms?' — room: '+this._e(cR.name||cR.id||''):''),undefined,basicInner,'mdi:image-outline')
         +sec('filters','Image filters'+(_fMode==='smooth'?' — smooth':''),_fCount,filtCombined,'mdi:brightness-6'))
      +_panel('elements',
          sec('badges','Badges — pill chips',(cR.badges||[]).length,bInner,'mdi:label-outline')
         +sec('blinds','Blinds — window covers',(cR.blinds||[]).length,blInner,'mdi:blinds-horizontal')
         +sec('elements','Embedded HA cards',(cR.elements||[]).length,elInner,'mdi:card-bulleted-outline')
         +sec('gauges','Gauges — bar / radial meters',(cR.gauges||[]).length,gInner,'mdi:gauge')
         +sec('groups','Groups — pop-up control panels',(cR.groups||[]).length,grpInner,'mdi:dock-window')
         +sec('icons','Icons — state-aware mdi icons',(cR.icons||[]).length,icoInner,'mdi:star-four-points-outline')
         +sec('labels','Labels — entity values as text',(cR.labels||[]).length,lblInner,'mdi:format-text')
         +sec('lights','Light &amp; switch controls — sliders / toggles',_lcEnts.length,lcInner,'mdi:tune-vertical')
         +sec('overlays','Overlay image layers',(cR.overlays||[]).length,ovInner,'mdi:layers-outline')
         +sec('zones','Zones — invisible tap areas',(cR.zones||[]).length,zInner,'mdi:gesture-tap'))
      +_panel('responsive',respInner)
      +_panel('rooms',roomsInner);
    const _dlOpts=this._dlOptions();
    this.innerHTML='<datalist id="roc-entities">'+_dlOpts+'</datalist>'
      +'<style>.roc-ed .roc-in{width:100%;padding:6px;border-radius:4px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box;}.roc-ed .roc-l{font-size:12px;display:block;margin-bottom:4px;}.roc-ed.roc-hideadv .roc-adv{display:none;}</style>'
      +'<div class="roc-ed'+(this._showAdv?'':' roc-hideadv')+'" style="padding:8px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px 8px;">'
      +'<span style="display:flex;align-items:baseline;gap:8px;"><span style="font-weight:600;font-size:13px;">Room Overlay Card</span><span style="font-size:11px;color:var(--secondary-text-color);">v'+ROC_VERSION+'</span></span>'
      +'<span style="display:flex;gap:6px;align-items:center;">'
      +'<button id="roc-adv-toggle" type="button" title="Show the raw YAML textareas (tap_action, conditions, etc.) on every element. Off = simpler, basic fields only." style="padding:2px 8px;border-radius:4px;border:1px solid '+(this._showAdv?'var(--primary-color)':'rgba(255,255,255,0.4)')+';background:'+(this._showAdv?'rgba(3,169,244,0.15)':'none')+';color:'+(this._showAdv?'var(--primary-color)':'var(--primary-text-color)')+';cursor:pointer;display:inline-flex;align-items:center;line-height:1;"><ha-icon icon="mdi:code-braces" style="--mdc-icon-size:16px;"></ha-icon></button>'
      +'<button id="roc-undo" title="Undo (Ctrl+Z)"'+(this._histIdx>0?'':' disabled')+' style="padding:2px 9px;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:none;color:var(--primary-text-color);cursor:pointer;font-size:14px;line-height:1.3;'+(this._histIdx>0?'':'opacity:0.4;cursor:default;')+'">&#8630;</button>'
      +'<button id="roc-redo" title="Redo (Ctrl+Y)"'+(this._histIdx<this._hist.length-1?'':' disabled')+' style="padding:2px 9px;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:none;color:var(--primary-text-color);cursor:pointer;font-size:14px;line-height:1.3;'+(this._histIdx<this._hist.length-1?'':'opacity:0.4;cursor:default;')+'">&#8631;</button>'
      +'</span></div>'
      +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:0 4px 8px;">'
      +(hasRooms?'<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--secondary-text-color);"><ha-icon icon="mdi:door" style="--mdc-icon-size:16px;"></ha-icon>Room <select id="room-select" style="padding:5px 8px;border-radius:6px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer;font-size:13px;">'+c.rooms.map(function(r,i){return '<option value="'+i+'"'+(i===self._editRoomIdx?' selected':'')+'>'+self._e(r.name||r.id||('room_'+(i+1)))+'</option>';}).join('')+'</select></span>':'')
      +'<label title="Puts the card into a safe interactive editing state: real tap/hold actions are suppressed, elements can be dragged directly, and an orientation-flip test button appears. Shows a live, draggable copy of the card right here below, and — since this is saved to your config — the same behaviour on your dashboard card too, until switched off." style="display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;color:var(--secondary-text-color);"><input id="test_mode" type="checkbox"'+(c.test_mode?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><ha-icon icon="mdi:cursor-move" style="--mdc-icon-size:16px;"></ha-icon>Edit mode</label>'
      +'<label title="Vibrates on tap/hold actions, and on the moment a hold registers (mobile browsers that support it)." style="display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;color:var(--secondary-text-color);"><input id="haptic" type="checkbox"'+(c.haptic!==false?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><ha-icon icon="mdi:vibrate" style="--mdc-icon-size:16px;"></ha-icon>Haptics</label>'
      +'</div>'
      +(c.test_mode?'<div id="roc-prev-host" style="margin:0 4px 10px;border:1px solid var(--divider-color);border-radius:8px;overflow:hidden;"></div>':'')
      +((this._wasMigrated&&!_isEmpty)?'<div style="margin:0 4px 10px;padding:8px 12px;border:1px solid rgba(230,160,40,0.7);background:rgba(230,160,40,0.12);border-radius:8px;font-size:12px;line-height:1.5;">Config was <b>auto-migrated</b> from the v3 tier system to the v4 layout engine (in memory only). Review the <b>Layout</b> tab, then <button id="roc-mig-save" style="padding:3px 12px;border-radius:5px;background:var(--primary-color);color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:600;">Save migrated config</button></div>':'')
      +(_isEmpty?_onboardHtml:_tabbedHtml)
      +'</div>';

    // Onboarding: once a background is set, re-render into the full grouped editor
    if(_isEmpty){
      const _go=function(){
        const nc=Object.assign({},self._config);
        const _ob=self.querySelector('#base_image'),_oc=self.querySelector('#base_camera');
        const _bi=_ob?_ob.value.trim():'',_bc=_oc?_oc.value.trim():'';
        if(_bi)nc.base_image=_bi;else delete nc.base_image;
        if(_bc)nc.base_camera=_bc;else delete nc.base_camera;
        self._config=nc;self._render();self._fire(nc);
      };
      const _obEl=this.querySelector('#base_image'),_ocEl=this.querySelector('#base_camera');
      if(_obEl)_obEl.addEventListener('change',_go);
      if(_ocEl)_ocEl.addEventListener('change',_go);
    }

    // Tab switching — toggle panel visibility without a full re-render (keeps focus)
    const _tabBtns=this.querySelectorAll('[data-roctab]');
    if(_tabBtns.length){
      _tabBtns.forEach(function(btn){
        btn.addEventListener('click',function(){
          const id=btn.dataset.roctab;self._tab=id;
          self.querySelectorAll('[data-rocpanel]').forEach(function(p){p.style.display=(p.dataset.rocpanel===id)?'block':'none';});
          _tabBtns.forEach(function(b){const on=b.dataset.roctab===id;b.style.borderBottomColor=on?'var(--primary-color)':'transparent';b.style.color=on?'var(--primary-color)':'var(--secondary-text-color)';b.style.fontWeight=on?'600':'400';});
        });
      });
    }
    // Responsive tab — breakpoint fields save on change, and (Layout-tab grid
    // fields only) also debounce-push straight to the Edit-mode preview card
    // on every keystroke — see _lyDebouncedUpdate() for why that needs a
    // dedicated path instead of the usual _fireDebounced().
    this.querySelectorAll('#lock_aspect,#ly-hmode,#ly-hcustom,#ly-orient,#ly-threshold,#ly-pin,#ly-gap,[id^="ly-rows__"],[id^="ly-cols__"],[id^="ly-r__"],[id^="ly-c__"],[id^="ly-o__"]').forEach(function(el){
      el.addEventListener('change',function(){self._fire(self._collectConfig());});
      el.addEventListener('input',function(){self._lyDebouncedUpdate();});
    });

    // Layout tab — Portrait/Landscape sub-tab toggle (visibility only, keeps
    // both profiles mounted so field state/focus survives switching).
    const _lySubBtns=this.querySelectorAll('[data-rocsub]');
    if(_lySubBtns.length){
      _lySubBtns.forEach(function(btn){
        btn.addEventListener('click',function(){
          const pk=btn.dataset.rocsub;self._lySub=pk;
          self.querySelectorAll('[data-rocsubpanel]').forEach(function(p){p.style.display=(p.dataset.rocsubpanel===pk)?'block':'none';});
          _lySubBtns.forEach(function(b){
            const on=b.dataset.rocsub===pk;
            b.style.borderColor=on?'var(--primary-color)':'var(--divider-color)';
            b.style.background=on?'rgba(3,169,244,0.15)':'none';
            b.style.color=on?'var(--primary-color)':'var(--primary-text-color)';
            b.style.fontWeight=on?'700':'400';
          });
        });
      });
    }

    // Layout tab — mini grid preview repaint on every keystroke, no full
    // re-render (see rocLyPreviewHtml — purely illustrative, editor-only).
    (function(){
      const _numOrLy=function(s){const t=String(s).trim();if(!t)return null;return/^[\d.]+$/.test(t)?parseFloat(t):t;};
      const _lyReadProfile=function(pk){
        const q2=function(id){return self.querySelector('#'+id);};
        const v2=function(id){const el=q2(id);return el?el.value:'';};
        const lp={};
        const rw=v2('ly-rows__'+pk).trim(),cl=v2('ly-cols__'+pk).trim();
        if(rw)lp.rows=rw.split(',').map(_numOrLy).filter(function(x){return x!==null;});
        if(cl)lp.columns=cl.split(',').map(_numOrLy).filter(function(x){return x!==null;});
        const place={};
        ['nav','cards_above','image','lights','cards_below','cover'].forEach(function(rg){
          const rr=v2('ly-r__'+pk+'__'+rg).trim();
          if(!rr)return;
          const pl={row:_numOrLy(rr)};
          const cc2=v2('ly-c__'+pk+'__'+rg).trim();if(cc2)pl.col=_numOrLy(cc2);
          const ov2=q2('ly-o__'+pk+'__'+rg);if(ov2&&ov2.checked)pl.overflow='auto';
          place[rg]=pl;
        });
        if(Object.keys(place).length)lp.place=place;
        const gp2=v2('ly-gap').trim();if(gp2)lp.gap=gp2;
        return lp;
      };
      const _repaint=function(pk){
        const host=self.querySelector('#ly-preview__'+pk);
        if(host)host.innerHTML=rocLyPreviewHtml(_lyReadProfile(pk));
      };
      ['portrait','landscape'].forEach(function(pk){
        self.querySelectorAll('[id^="ly-rows__'+pk+'"],[id^="ly-cols__'+pk+'"],[id^="ly-r__'+pk+'__"],[id^="ly-c__'+pk+'__"],[id^="ly-o__'+pk+'__"]').forEach(function(el){
          el.addEventListener('input',function(){_repaint(pk);});
        });
      });
      const gapEl=self.querySelector('#ly-gap');
      if(gapEl)gapEl.addEventListener('input',function(){_repaint('portrait');_repaint('landscape');});
    })();

    if(!this._keysBound){
      this._keysBound=true;
      const kbSelf=this;
      this.addEventListener('keydown',function(e){
        if(!(e.ctrlKey||e.metaKey))return;
        const tag=(e.target&&e.target.tagName||'').toLowerCase();
        if(tag==='input'||tag==='textarea'||tag==='select')return; // keep native undo inside fields
        const k=e.key.toLowerCase();
        if(k==='z'&&!e.shiftKey){e.preventDefault();kbSelf._undo();}
        else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();kbSelf._redo();}
      });
    }
    // Tag every YAML textarea's wrapper as "advanced" so the header toggle can
    // hide them (declutter — basic fields stay visible). Monospace = YAML field.
    this.querySelectorAll('textarea').forEach(function(ta){
      const st=ta.getAttribute('style')||'';
      if(st.indexOf('monospace')>=0){const p=ta.parentElement;if(p)p.classList.add('roc-adv');}
    });
    const migBtn=this.querySelector('#roc-mig-save');
    if(migBtn)migBtn.addEventListener('click',function(){self._wasMigrated=false;fire();});
    const advT=this.querySelector('#roc-adv-toggle');
    if(advT)advT.addEventListener('click',function(){
      self._showAdv=!self._showAdv;
      const root=self.querySelector('.roc-ed');
      if(root)root.classList.toggle('roc-hideadv',!self._showAdv);
      advT.style.borderColor=self._showAdv?'var(--primary-color)':'rgba(255,255,255,0.4)';
      advT.style.background=self._showAdv?'rgba(3,169,244,0.15)':'none';
      advT.style.color=self._showAdv?'var(--primary-color)':'var(--primary-text-color)';
    });
    this._listen();
    this._bindHassComponents();
    this._mountPreview();
    // Position updates from card drag/keyboard — relay through editor so HA saves correctly
    if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);this._rocPosHandler=null;}
    if(c.test_mode){
      this._rocPosHandler=this._makeRocPosHandler();
      window.addEventListener('roc-pos-update',this._rocPosHandler);
    }
    if(this._rocRoomHandler){window.removeEventListener('roc-room-switch',this._rocRoomHandler);this._rocRoomHandler=null;}
    if(c.test_mode){
      this._rocRoomHandler=this._makeRocRoomHandler();
      window.addEventListener('roc-room-switch',this._rocRoomHandler);
    }
  }

  _makeRocPosHandler(){
    const self=this;
    return function(e){
      const nc=e.detail&&e.detail.config;
      if(!nc)return;
      // Only accept updates from "our" card (two cards in test mode = cross-talk)
      if(cfgKey(nc)!==cfgKey(self._config))return;
      // Updates from the embedded editor preview carry forced/stripped fields
      // (see _mountPreview: test_mode forced true, url_sync deleted, multi-room
      // follow_mode forced 'manual' — none of that belongs in the real saved
      // config) — undo all of it using what the real config had before the drag.
      if(nc._roc_preview){
        delete nc._roc_preview;
        if(!self._config.test_mode)delete nc.test_mode;
        if(self._config.url_sync!==undefined)nc.url_sync=self._config.url_sync;else delete nc.url_sync;
        if(self._config.follow_mode!==undefined)nc.follow_mode=self._config.follow_mode;else delete nc.follow_mode;
      }
      self._config=nc;
      self._render(); // refresh position inputs, otherwise the next edit reverts the drag
      self._fire(nc);
    };
  }

  // Room switches made by clicking inside the live preview's own nav strip —
  // keep the editor's Room select and per-room panels following along, otherwise
  // edits silently land on whatever room the header dropdown was last set to.
  _makeRocRoomHandler(){
    const self=this;
    return function(e){
      const d=e.detail;
      if(!d||d.cfgKey!==cfgKey(self._config))return;
      if(!Array.isArray(self._config.rooms))return;
      const idx=Math.max(0,Math.min(d.idx,self._config.rooms.length-1));
      if(idx===self._editRoomIdx)return;
      self._editRoomIdx=idx;
      self._render();
    };
  }

  _bindHassComponents(){
    const self=this;
    this.querySelectorAll('.ep-placeholder').forEach(function(span){
      const val=span.dataset.epVal||'';
      const picker=document.createElement('ha-entity-picker');
      picker.style.cssText='width:100%;display:block;';
      Array.from(span.attributes).forEach(function(a){if(a.name!=='class'&&a.name!=='data-ep-val')picker.setAttribute(a.name,a.value);});
      if(self._hass)picker.hass=self._hass;
      picker.value=val;
      picker.allowCustomEntity=true;
      picker.addEventListener('value-changed',function(e){
        picker.value=e.detail.value||'';
        self._fire(self._collectConfig());
      });
      span.replaceWith(picker);
    });
    this.querySelectorAll('[data-fp-range]').forEach(function(range){
      const num=self.querySelector('[data-fp="'+range.dataset.fp+'"][data-fp-num]');
      if(!num)return;
      range.addEventListener('input',function(){num.value=range.value;self._fireDebounced();});
      num.addEventListener('change',function(){range.value=num.value;self._fire(self._collectConfig());});
    });
  }

  _groupItem(g,i){
    const op=this._openPanels&&this._openPanels.has('grp-'+i);
    const styleYaml=g.style?_yaml.s({style:g.style}):'';
    let h='<details style="margin-bottom:6px;" data-panel="grp-'+i+'"'+(op?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Group: '+this._e(g.id||'group_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-grp-id="'+i+'" type="text" value="'+this._e(g.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Grouping code (mutual exclusion)</label><input data-grp-gc="'+i+'" type="number" placeholder="e.g. 1" value="'+this._e(g.grouping_code!=null?String(g.grouping_code):'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div style="display:flex;align-items:center;gap:8px;padding-top:18px;"><label style="font-size:12px;">Initially visible</label><input data-grp-vis="'+i+'" type="checkbox"'+(g.visible?' checked':'')+' style="width:auto;cursor:pointer;"></div>';
    h+='</div>';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Background panel — style: (top / left / width / height / background / border_radius / z_index)</label>';
    h+='<textarea data-grp-yaml="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(styleYaml)+'</textarea></div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 8px;">Actions: <code>action: toggle-group</code>, <code>show-group</code>, <code>hide-group</code> with <code>group: '+this._e(g.id||'group_id')+'</code></p>';
    h+='<button data-rm-grp="'+i+'" style="padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove group</button>';
    h+='</div></details>';
    return h;
  }

  _listen(){
    const self=this;
    const fire=function(){self._fire(self._collectConfig());};
    // Room-scoped access for add/remove/duplicate/move handlers
    const T=function(c){return Array.isArray(c.rooms)&&c.rooms.length?c.rooms[Math.max(0,Math.min(self._editRoomIdx,c.rooms.length-1))]:c;};
    const A=function(c,key){const t=T(c);if(!t[key])t[key]=[];return t[key];};
    // Rooms section
    const roomSel=this.querySelector('#room-select');
    if(roomSel)roomSel.addEventListener('change',function(){self._editRoomIdx=parseInt(roomSel.value)||0;self._render();self._writeEditHash(self._config);});
    const addRoom=this.querySelector('#add-room');
    if(addRoom)addRoom.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!Array.isArray(c.rooms))c.rooms=[];
      let n=c.rooms.length+1,id='room_'+n;
      while(c.rooms.some(function(r){return r.id===id;})){n++;id='room_'+n;}
      c.rooms.push({id:id,name:'Room '+n});
      self._editRoomIdx=c.rooms.length-1;
      self._config=c;self._render();self._fire(c);
    });
    const rmRoom=this.querySelector('#rm-room');
    if(rmRoom)rmRoom.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!Array.isArray(c.rooms)||c.rooms.length<=1)return; // keep at least one room
      c.rooms.splice(self._editRoomIdx,1);
      self._editRoomIdx=Math.max(0,self._editRoomIdx-1);
      self._config=c;self._render();self._fire(c);
    });
    const roomUp=this.querySelector('#room-up');
    if(roomUp)roomUp.addEventListener('click',function(){
      const i=self._editRoomIdx;if(i<=0)return;
      const c=self._collectConfig();if(!Array.isArray(c.rooms)||i>=c.rooms.length)return;
      const tmp=c.rooms[i-1];c.rooms[i-1]=c.rooms[i];c.rooms[i]=tmp;
      self._editRoomIdx=i-1;self._config=c;self._render();self._fire(c);
    });
    const roomDown=this.querySelector('#room-down');
    if(roomDown)roomDown.addEventListener('click',function(){
      const i=self._editRoomIdx;const c=self._collectConfig();
      if(!Array.isArray(c.rooms)||i>=c.rooms.length-1)return;
      const tmp=c.rooms[i+1];c.rooms[i+1]=c.rooms[i];c.rooms[i]=tmp;
      self._editRoomIdx=i+1;self._config=c;self._render();self._fire(c);
    });
    const convRooms=this.querySelector('#conv-rooms');
    if(convRooms)convRooms.addEventListener('click',function(){self._convertToRooms();});
    ['room-id','room-name','room-icon','room-area-match','room-chips','room_entity','follow_hold','card_id','follow_mode','room_state_entity','nav-style','nav-position','nav-height','nav-width','nav-mobile-height','nav-auto-bp','nav-wheel','nav-follow-btn','nav-chips','nav-cards','nav-mini-templates','nav-mini-camera-refresh','nav-mini-width-ref','url-sync','url-sync-key'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
    });
    // nav-live needs a full re-render (not just a local panel toggle, unlike
    // #filter-mode below): 'custom' adds a "Show in mini" checkbox to every
    // gauge/label/icon/badge/blind/element panel, not just its own local
    // sub-panel, so those need to actually (dis)appear across the form.
    const navLiveEl=this.querySelector('#nav-live');
    if(navLiveEl)navLiveEl.addEventListener('change',function(){
      const c=self._collectConfig();
      self._config=c;self._render();self._fire(c);
    });
    const bidMap=this.querySelector('#bid-map');
    if(bidMap)bidMap.addEventListener('click',function(){
      const entEl=self.querySelector('#bid-entity');
      const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id;
      if(!bid||!entEl||!entEl.value.trim())return;
      const c=self._collectConfig();
      if(typeof c.room_entity==='string')c.room_entity={default:c.room_entity};
      else if(!c.room_entity||typeof c.room_entity!=='object')c.room_entity={};
      else c.room_entity=Object.assign({},c.room_entity);
      c.room_entity.by_browser=Object.assign({},c.room_entity.by_browser||{});
      c.room_entity.by_browser[bid]=entEl.value.trim();
      self._config=c;self._render();self._fire(c);
    });

    ['base_image','filter_transition','base_image_conditions','base_camera','camera_refresh','weather_entity','weather_effect','weather_opacity','weather-nav-mini','zoom'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
    });
    // Per-profile inputs (aspect_ratio / border_radius / image_fit — 2 cells each)
    ROC_PROFILES.forEach(function(pk){['aspect_ratio','border_radius','image_fit'].forEach(function(idb){
      const el=self.querySelector('#'+idb+'__'+pk);if(el)el.addEventListener('change',fire);
    });});
    const undoBtn=this.querySelector('#roc-undo');
    if(undoBtn)undoBtn.addEventListener('click',function(){self._undo();});
    const redoBtn=this.querySelector('#roc-redo');
    if(redoBtn)redoBtn.addEventListener('click',function(){self._redo();});
    // Live icon previews
    this.querySelectorAll('[data-ico-icon],[data-b-icon]').forEach(function(inp){
      inp.addEventListener('input',function(){
        const prev=inp.parentElement&&inp.parentElement.querySelector('ha-icon[data-roc-prev]');
        if(prev)prev.setAttribute('icon',inp.value.trim());
      });
    });
    // Reorder (▲▼) — one generic handler for all item lists
    const _mvKinds={z:'zones',ov:'overlays',b:'badges',el:'elements',ico:'icons',lbl:'labels',g:'gauges',bl:'blinds'};
    this.querySelectorAll('[data-mv]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.mv.split(':');
        const key=_mvKinds[p[0]];if(!key)return;
        const i=parseInt(p[1]),dir=parseInt(p[2]),j=i+dir;
        const c=self._collectConfig();
        const arr=T(c)[key];
        if(!arr||j<0||j>=arr.length)return;
        const t=arr[i];arr[i]=arr[j];arr[j]=t;
        // keep the moved panel open at its new index
        if(self._openPanels){
          const a=p[0]+'-'+i,b=p[0]+'-'+j;
          const hadA=self._openPanels.has(a),hadB=self._openPanels.has(b);
          if(hadA)self._openPanels.add(b);else self._openPanels.delete(b);
          if(hadB)self._openPanels.add(a);else self._openPanels.delete(a);
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    // Editor → card highlight: opening an item panel flashes the element in the preview
    const _hlKinds={ov:['overlays','overlay'],z:['zones','zone'],b:['badges','badge'],el:['elements','element'],ico:['icons','icon'],lbl:['labels','label'],g:['gauges','gauge'],bl:['blinds','gauge']};
    this.querySelectorAll('details[data-panel]').forEach(function(d){
      d.addEventListener('toggle',function(){
        if(!d.open)return;
        const m=d.dataset.panel.match(/^(ov|z|b|el|ico|lbl|g|bl)-(\d+)$/);
        if(!m)return;
        const k=_hlKinds[m[1]];
        const item=(self._roomView()[k[0]]||[])[parseInt(m[2])];
        if(!item)return;
        window.dispatchEvent(new CustomEvent('roc-highlight',{detail:{kind:k[1],id:m[1]==='bl'?'__bl_'+item.id:item.id,key:cfgKey(self._config)}}));
      });
    });
    const tm=this.querySelector('#test_mode');
    if(tm){
      tm.addEventListener('change',function(){
        // Edit mode also toggles the live preview panel below — force a local
        // re-render rather than just fire(), since setConfig()'s same-config
        // check would otherwise skip re-rendering for this field alone and the
        // preview host div (and its pos/room relay listeners) wouldn't appear.
        const c=self._collectConfig();
        self._config=c;
        self._render();
        self._fire(c);
      });
    }
    const hpEl2=this.querySelector('#haptic');if(hpEl2)hpEl2.addEventListener('change',fire);
    const ta=this.querySelector('#tap_action_yaml');if(ta)ta.addEventListener('change',fire);
    const caTa=this.querySelector('#cards_above_yaml');if(caTa)caTa.addEventListener('change',fire);
    const cbTa=this.querySelector('#cards_below_yaml');if(cbTa)cbTa.addEventListener('change',fire);
    // Light controls
    const addLc=this.querySelector('#add-lc-ent');
    if(addLc)addLc.addEventListener('click',function(){
      const c=self._collectConfig();
      const t=T(c);
      if(!t.light_controls)t.light_controls={entities:[]};
      if(!Array.isArray(t.light_controls.entities))t.light_controls.entities=[];
      t.light_controls.entities.push({entity:''});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-lc-ent]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmLcEnt);
        const c=self._collectConfig();const t=T(c);
        if(t.light_controls&&Array.isArray(t.light_controls.entities))t.light_controls.entities.splice(i,1);
        if(t.light_controls&&(!t.light_controls.entities||!t.light_controls.entities.length))delete t.light_controls;
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-lc-ent],[data-lc-name],#lc-lux,#lc-luxmax,#lc-cols,#lc-height,#lc-color-low,#lc-color-high,#lc-bg-off').forEach(function(el){
      el.addEventListener('change',fire);
    });
    // Live gradient preview — repaint the bar + max label without a full re-render
    const _gradPrev=this.querySelector('#lc-grad-preview');
    if(_gradPrev){
      const _updGrad=function(){
        const _lo=(self.querySelector('#lc-color-low')||{}).value||LC_DEF_LOW;
        const _hi=(self.querySelector('#lc-color-high')||{}).value||LC_DEF_HIGH;
        _gradPrev.style.background=lcGradientCss(_lo,_hi);
        const _lx=parseFloat((self.querySelector('#lc-luxmax')||{}).value);
        const _lbl=self.querySelector('#lc-grad-max');
        if(_lbl)_lbl.textContent=((!isNaN(_lx)&&_lx>0)?_lx:50)+' lx';
      };
      ['#lc-color-low','#lc-color-high','#lc-luxmax'].forEach(function(sel){
        const el=self.querySelector(sel);if(el)el.addEventListener('input',_updGrad);
      });
    }

    // Background mode toggle (image/camera) — swap panes (no re-render) + persist choice
    const bgModeEl=this.querySelector('#bg-mode');
    if(bgModeEl)bgModeEl.addEventListener('change',function(){
      self._bgMode=bgModeEl.value;
      const pi=self.querySelector('#bg-pane-image'),pc2=self.querySelector('#bg-pane-camera');
      if(pi)pi.style.display=bgModeEl.value==='image'?'block':'none';
      if(pc2)pc2.style.display=bgModeEl.value==='camera'?'grid':'none';
      self._fire(self._collectConfig());
    });
    // Filter mode toggle — swap panes (no re-render) + persist choice
    const fmodeEl=this.querySelector('#filter-mode');
    if(fmodeEl)fmodeEl.addEventListener('change',function(){
      self._filterMode=fmodeEl.value;
      const pc=self.querySelector('#filter-pane-conditional'),ps=self.querySelector('#filter-pane-smooth');
      if(pc)pc.style.display=fmodeEl.value==='conditional'?'':'none';
      if(ps)ps.style.display=fmodeEl.value==='smooth'?'':'none';
      self._fire(self._collectConfig());
    });
    // Filter conditions
    const addF=this.querySelector('#add-filter');
    if(addF)addF.addEventListener('click',function(){
      const c=self._collectConfig();
      A(c,'filter_conditions').push({filter:'none'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-filter]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmFilter);
        const c=self._collectConfig();
        A(c,'filter_conditions').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-filter-entity],[data-filter-state-op],[data-filter-state-val],[data-filter-and-entity],[data-filter-and-op],[data-filter-and-val],[data-filter-or-entity],[data-filter-or-op],[data-filter-or-val]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Brightness model
    const addBmSrc=this.querySelector('#add-bm-src');
    if(addBmSrc)addBmSrc.addEventListener('click',function(){
      const c=self._collectConfig();
      const t=T(c);
      if(!t.brightness_model)t.brightness_model={source:[],filter_gradient:[]};
      if(!t.brightness_model.source)t.brightness_model.source=[];
      t.brightness_model.source.push({entity:'',min_input:0,max_input:100});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bm-src]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBmSrc);
        const c=self._collectConfig();
        const t=T(c);if(t.brightness_model&&t.brightness_model.source)t.brightness_model.source.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bm-src-ent],[data-bm-src-attr],[data-bm-src-min],[data-bm-src-max],[data-bm-src-cond]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    const addBmFg=this.querySelector('#add-bm-fg');
    if(addBmFg)addBmFg.addEventListener('click',function(){
      const c=self._collectConfig();
      const t=T(c);
      if(!t.brightness_model)t.brightness_model={source:[],filter_gradient:[]};
      if(!t.brightness_model.filter_gradient)t.brightness_model.filter_gradient=[];
      const fg=t.brightness_model.filter_gradient;
      const last=fg[fg.length-1];
      fg.push({value:last?Math.min(100,last.value+25):0,filter:'none'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bm-fg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBmFg);
        const c=self._collectConfig();
        const t=T(c);if(t.brightness_model&&t.brightness_model.filter_gradient)t.brightness_model.filter_gradient.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bm-fg-val],[data-bm-fg-filt]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Overlays
    const addOv=this.querySelector('#add-ov');
    if(addOv)addOv.addEventListener('click',function(){
      const c=self._collectConfig();
      const ovA=A(c,'overlays');
      ovA.push({id:'overlay_'+(ovA.length+1),image:'',transition:'2s ease'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ov]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmOv);
        const c=self._collectConfig();
        A(c,'overlays').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-ov-id],[data-ov-img],[data-ov-tr],[data-ov-yaml],[data-ov-anim],[data-ov-grp]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Zones
    const addZ=this.querySelector('#add-z');
    if(addZ)addZ.addEventListener('click',function(){
      const c=self._collectConfig();
      const zA=A(c,'zones');
      zA.push({id:'zone_'+(zA.length+1),top:'0%',left:'0%',width:'10%',height:'10%'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-z]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmZ);
        const c=self._collectConfig();
        A(c,'zones').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-z-id],[data-z-top],[data-z-left],[data-z-w],[data-z-h],[data-z-tap],[data-z-hold],[data-z-dtap],[data-z-hdelay],[data-z-vis],[data-z-slider],[data-z-grp]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Badges
    const addB=this.querySelector('#add-b');
    if(addB)addB.addEventListener('click',function(){
      const c=self._collectConfig();
      const bA=A(c,'badges');
      bA.push({id:'badge_'+(bA.length+1),position:'bottom-left'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-b]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmB);
        const c=self._collectConfig();
        A(c,'badges').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-b-id],[data-b-icon],[data-b-pos],[data-b-x],[data-b-y],[data-b-yaml],[data-b-anim],[data-b-ac]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Icons
    const addIco=this.querySelector('#add-ico');
    if(addIco)addIco.addEventListener('click',function(){
      const c=self._collectConfig();
      const icoA=A(c,'icons');
      icoA.push({id:'icon_'+(icoA.length+1),icon:'mdi:help',top:'10%',left:'10%',size:'24px'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ico]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmIco);
        const c=self._collectConfig();
        A(c,'icons').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-ico-id],[data-ico-icon],[data-ico-size],[data-ico-z],[data-ico-top],[data-ico-left],[data-ico-hdelay],[data-ico-color],[data-ico-vis],[data-ico-tap],[data-ico-dtap],[data-ico-hold]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Labels
    const addLbl=this.querySelector('#add-lbl');
    if(addLbl)addLbl.addEventListener('click',function(){
      const c=self._collectConfig();
      const lblA=A(c,'labels');
      lblA.push({id:'label_'+(lblA.length+1),top:'10%',left:'10%',entity:''});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-lbl]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmLbl);
        const c=self._collectConfig();
        A(c,'labels').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-lbl-id],[data-lbl-top],[data-lbl-left],[data-lbl-entity],[data-lbl-attr],[data-lbl-suffix],[data-lbl-yaml],[data-lbl-anim],[data-lbl-ac],[data-lbl-tmpl]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-lg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addLg);
        const c=self._collectConfig();
        const lblArr=A(c,'labels');
        if(!lblArr[i])return;
        if(!lblArr[i].color_gradient)lblArr[i].color_gradient=[];
        const ls=lblArr[i].color_gradient;
        const last=ls[ls.length-1];
        const nv=last?last.value+10:0;
        ls.push({value:nv,color:'#ffffff'});
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-lg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const parts=btn.dataset.rmLg.split('-');
        const i=parseInt(parts[0]),j=parseInt(parts[1]);
        const c=self._collectConfig();
        const lblArr=A(c,'labels');
        if(lblArr[i]&&lblArr[i].color_gradient){
          lblArr[i].color_gradient.splice(j,1);
          if(!lblArr[i].color_gradient.length)delete lblArr[i].color_gradient;
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-l-lv],[data-l-lc]').forEach(function(el){
      el.addEventListener('change',fire);el.addEventListener('input',function(){self._fireDebounced();});
    });

    // Gauges
    const addG=this.querySelector('#add-g');
    if(addG)addG.addEventListener('click',function(){
      const c=self._collectConfig();
      const gA=A(c,'gauges');
      gA.push({id:'gauge_'+(gA.length+1),top:'10%',left:'10%',width:'2%',height:'20%',entity:'',min:0,max:100});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-g]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmG);
        const c=self._collectConfig();
        A(c,'gauges').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-g-id],[data-g-top],[data-g-left],[data-g-w],[data-g-h],[data-g-entity],[data-g-attr],[data-g-min],[data-g-max],[data-g-yaml],[data-g-orient],[data-g-anim],[data-g-ac],[data-g-alert-ent],[data-g-alert-attr],[data-g-alert-op],[data-g-alert-val]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-gg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addGg);
        const c=self._collectConfig();
        const gArr=A(c,'gauges');
        if(!gArr[i])return;
        if(!gArr[i].color_gradient)gArr[i].color_gradient=[];
        const gs=gArr[i].color_gradient;
        const last=gs[gs.length-1];
        const mn=gArr[i].min??0,mx=gArr[i].max??100;
        const nv=last?Math.min(last.value+Math.round((mx-mn)/6),mx):mn;
        gs.push({value:nv,color:'#00ff44'});
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-gg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const parts=btn.dataset.rmGg.split('-');
        const i=parseInt(parts[0]),j=parseInt(parts[1]);
        const c=self._collectConfig();
        const gArr=A(c,'gauges');
        if(gArr[i]&&gArr[i].color_gradient){
          gArr[i].color_gradient.splice(j,1);
          if(!gArr[i].color_gradient.length)delete gArr[i].color_gradient;
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-g-gv],[data-g-gc]').forEach(function(el){
      el.addEventListener('change',fire);el.addEventListener('input',function(){self._fireDebounced();});
    });

    // Elements
    const addEl=this.querySelector('#add-el');
    if(addEl)addEl.addEventListener('click',function(){
      const c=self._collectConfig();
      const elA=A(c,'elements');
      elA.push({id:'el_'+(elA.length+1),top:'0%',left:'0%',width:'30%',height:'20%',card:{type:'tile',entity:''}});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-el]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmEl);
        const c=self._collectConfig();
        A(c,'elements').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-el-id],[data-el-top],[data-el-bot],[data-el-left],[data-el-w],[data-el-h],[data-el-yaml]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    // Blinds
    const addBl=this.querySelector('#add-bl');
    if(addBl)addBl.addEventListener('click',function(){
      const c=self._collectConfig();
      const blA=A(c,'blinds');
      blA.push({id:'blind_'+(blA.length+1),top:'10%',left:'30%',width:'20%',height:'40%',entity:'',min:0,max:100,blind_type:'roller'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bl]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBl);
        const c=self._collectConfig();
        A(c,'blinds').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bl-id],[data-bl-top],[data-bl-left],[data-bl-w],[data-bl-h],[data-bl-entity],[data-bl-attr],[data-bl-min],[data-bl-max],[data-bl-top-offset],[data-bl-z],[data-bl-type],[data-bl-slat-color],[data-bl-slat-count],[data-bl-slat-w],[data-bl-slat-g],[data-bl-gap-color],[data-bl-yaml]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-ccp]').forEach(function(btn){btn.addEventListener('click',function(){
      const i=parseInt(btn.dataset.addCcp,10);const c=self._collectConfig();const bl=A(c,'blinds')[i];if(!bl)return;
      if(!bl.control||typeof bl.control!=='object')bl.control={display:'popover'};
      if(!Array.isArray(bl.control.presets))bl.control.presets=[];
      bl.control.presets.push({position:100,icon:'',color:'',name:''});
      self._config=c;self._render();self._fire(c);
    });});
    this.querySelectorAll('[data-rm-ccp]').forEach(function(btn){btn.addEventListener('click',function(){
      const pr=String(btn.dataset.rmCcp).split(':'),i=parseInt(pr[0],10),j=parseInt(pr[1],10);
      const c=self._collectConfig();const bl=A(c,'blinds')[i];if(!bl||!bl.control||!Array.isArray(bl.control.presets))return;
      bl.control.presets.splice(j,1);
      self._config=c;self._render();self._fire(c);
    });});
    this.querySelectorAll('[data-bl-ccdisp],[data-bl-ccside],[data-bl-ccslider],[data-bl-cctop],[data-bl-ccleft],[data-bl-ccwidth],[data-ccp-pos],[data-ccp-icon],[data-ccp-color],[data-ccp-name]').forEach(function(el){el.addEventListener('change',fire);});

    // Duplicate (clone) handlers
    function _cp(v,dflt){if(!v)return dflt||'3%';const n=parseFloat(v);return(!isNaN(n)&&String(v).trim().endsWith('%'))?Math.min(n+3,95).toFixed(1)+'%':v;}
    this.querySelectorAll('[data-dup-ico]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupIco),c=self._collectConfig();const dA=A(c,'icons');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-lbl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupLbl),c=self._collectConfig();const dA=A(c,'labels');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-g]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupG),c=self._collectConfig();const dA=A(c,'gauges');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-bl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupBl),c=self._collectConfig();const dA=A(c,'blinds');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-el]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupEl),c=self._collectConfig();const dA=A(c,'elements');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-z]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupZ),c=self._collectConfig();const dA=A(c,'zones');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});

    // Group fields on elements
    this.querySelectorAll('[data-ico-grp],[data-lbl-grp],[data-g-grp],[data-bl-grp],[data-el-grp]').forEach(function(el){el.addEventListener('change',fire);});
    // nav.live:custom "Show in mini" checkboxes (NAV_LIVE_FULL_PLAN.md §13) —
    // one shared list across every element type that has one, same pattern
    // as the Group fields just above.
    this.querySelectorAll('[data-b-nav-mini],[data-el-nav-mini],[data-ico-nav-mini],[data-lbl-nav-mini],[data-g-nav-mini],[data-bl-nav-mini]').forEach(function(el){el.addEventListener('change',fire);});

    // Groups
    const addGrp=this.querySelector('#add-grp');
    if(addGrp)addGrp.addEventListener('click',function(){
      const c=self._collectConfig();
      const grpA=A(c,'groups');
      grpA.push({id:'group_'+(grpA.length+1),visible:false});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-grp]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmGrp);
        const c=self._collectConfig();
        A(c,'groups').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-grp-id],[data-grp-gc],[data-grp-vis],[data-grp-yaml]').forEach(function(el){el.addEventListener('change',fire);});
  }

  disconnectedCallback(){
    clearTimeout(this._fdT);
    if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);this._rocPosHandler=null;}
  }
}

customElements.define('room-overlay-card-editor',RoomOverlayCardEditor);
customElements.get('room-overlay-card').getConfigElement=function(){return document.createElement('room-overlay-card-editor');};
