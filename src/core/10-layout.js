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
function containStage(boxW,boxH,da,align){
  if(!(da>0)||!(boxW>0)||!(boxH>0))return null;
  let w,h;
  if(boxW/boxH>=da){h=boxH;w=boxH*da;}else{w=boxW;h=boxW/da;}
  return{w:w,h:h,left:(boxW-w)/2,top:rocStageTop(boxH,h,align)};
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
