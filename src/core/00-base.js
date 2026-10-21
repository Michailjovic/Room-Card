/**
 * room-overlay-card — MIT License (see ROC_VERSION below for the current version)
 * https://github.com/Michailjovic/Room-Card
 *
 * GENERATED FILE — assembled from src/ by `npm run assemble` (tools/assemble.js).
 * Edit the parts under src/ and re-assemble; CI fails when this file is out of date.
 */
const ROC_VERSION='6.45.0';
console.info('%c ROOM-OVERLAY-CARD %c v'+ROC_VERSION+' ','background:#3a7d5a;color:#fff;font-weight:bold;border-radius:4px 0 0 4px;padding:2px 0;','background:#222;color:#aef;border-radius:0 4px 4px 0;padding:2px 0;');
// Placeholder room sketch (v6.21.0) for the card picker preview and a freshly
// added card — the old '/local/room.webp' stub doesn't exist on anyone's
// install, so the picker showed an empty card. Treated like that old stub
// everywhere: it never counts as a real background (the editor still opens
// on its "set a background" step).
const ROC_STUB_IMG='data:image/svg+xml,'+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 180'><rect width='320' height='180' fill='#263039'/><rect y='118' width='320' height='62' fill='#3a2f27'/><path d='M0 118h320' stroke='#151a1f' stroke-width='2'/><rect x='196' y='26' width='74' height='58' rx='3' fill='#7fb4d9' opacity='.55'/><path d='M233 26v58M196 55h74' stroke='#263039' stroke-width='3'/><ellipse cx='104' cy='152' rx='72' ry='12' fill='#4a3b30'/><rect x='38' y='92' width='104' height='34' rx='8' fill='#4f6273'/><rect x='30' y='100' width='16' height='30' rx='5' fill='#5a6f81'/><rect x='134' y='100' width='16' height='30' rx='5' fill='#5a6f81'/><circle cx='172' cy='76' r='30' fill='#ffb35c' opacity='.12'/><path d='M172 128V72' stroke='#9aa3ad' stroke-width='2'/><path d='M162 72h20l-5-14h-10z' fill='#ffb35c'/><rect x='284' y='104' width='14' height='18' rx='2' fill='#6b4f3a'/><circle cx='291' cy='98' r='12' fill='#4f7a52'/></svg>");
// prefers-reduced-motion (v6.24.0): decorative motion off — see the CSS
// block in _render() and the room-switch / parallax checks.
const rocReducedMotion=function(){try{return!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(_){return false;}};
const rocIsStubImg=function(u){return!u||u==='/local/room.webp'||u===ROC_STUB_IMG;};
// A freshly added / card-picker card (stub sketch, single room): sized by its
// aspect ratio like the editor preview instead of pinning to the viewport —
// a viewport-tall placeholder in the picker grid or on a new dashboard is
// mostly empty space.
const rocIsStubCfg=function(c){return!!c&&c.base_image===ROC_STUB_IMG&&!c.base_camera&&!(Array.isArray(c.rooms)&&c.rooms.length);};
window.customCards=window.customCards||[];
window.customCards.push({type:'room-overlay-card',name:'Room Overlay Card',description:'Room visualization with image layers, transitions and clickable zones (v'+ROC_VERSION+')',preview:true,documentationURL:'https://github.com/Michailjovic/Room-Card',
  getEntitySuggestion:function(hass,entityId){
    // HA 2026.6+: suggest this card when the user picks a camera entity
    if(entityId.split('.')[0]!=='camera')return null;
    return{config:{type:'custom:room-overlay-card',base_camera:entityId,aspect_ratio:'16/9'}};
  }});

// Element (`elements:`) fields that have their own dedicated editor input —
// shared between _elItem()'s YAML-box builder and _collectConfig()'s
// elements KEEP list so the two can't drift apart again (they did once:
// portrait:/landscape: were silently dropped on every editor save).
const EL_DEDICATED_KEYS=['id','top','bottom','left','width','height','group','nav_mini','section','tile'];

// Cockpit tile (`tile:`) fields promoted to their own dedicated editor input
// (B2, BUG_UX_ANALYSIS_v6.15.1.md §Part 2) — shared between the tile-field
// renderer and the two tile collectors (a tagged element's item.tile, and a
// section's own declared tiles) so they can't drift apart, same reasoning as
// EL_DEDICATED_KEYS above. `id`/`image`/`image_ratio`/`overlays` are handled
// entirely separately already (own inputs/editor predating this list) and are
// not repeated here. Everything else on a tile (tap_action, hold_action,
// hold_delay, double_tap_action, and any future/unknown key) is owned by the
// leftover YAML box, exactly like EL_DEDICATED_KEYS owns elements' leftovers.
const TILE_DEDICATED_KEYS=['name','entity','icon','icon_animation','active_state','state_class','value','progress','quick','tap_action','double_tap_action','hold_action'];
// Action builder types (v6.18.0) — [value, editor label]. '' = key not set;
// 'custom' = raw YAML for anything the builder doesn't model.
// Domain-filtered entity suggestion lists (v6.19.0): datalist id suffix →
// domains. A field bound to one of these only *suggests* those domains —
// anything typed is still accepted.
const ROC_ENT_LISTS={light_switch:['light','switch'],cover:['cover'],camera:['camera'],weather:['weather'],sensor:['sensor'],progress:['sensor','number','input_number']};
// Editor inputs holding an element id, one list per attribute (ids must be
// unique within their own list, per room — same rule setConfig() warns about).
// Element-id lists whose ids nothing else in the config points at — safe to
// rename with the one-click fix. Sections and groups are referenced by
// `section:` / `group:` / actions, so those only get the message.
const ROC_ID_FIXABLE=['data-z-id','data-ico-id','data-lbl-id','data-b-id','data-bl-id','data-el-id','data-g-id','data-gw-id','data-ov-id','data-vw-id'];
// "Roleta Ložnice" → "roleta_loznice": accents dropped, anything outside
// A-Za-z0-9_- collapsed to "_", lower-case.
function rocSlugId(v){
  let s=String(v||'');
  try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(_){}
  s=s.toLowerCase().replace(/[^a-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
  return s||'item';
}
const ROC_ID_ATTRS=['data-z-id','data-ico-id','data-lbl-id','data-b-id','data-bl-id','data-el-id','data-g-id','data-grp-id','data-gw-id','data-ov-id','data-sec-id','data-vw-id'];
// Editor on a phone / narrow dialog (v6.19.0): the editor root is an
// inline-size container, so its multi-column field rows fold to two columns
// below 500 px and to one below 300 px — the inline grid styles are matched
// by attribute selector, no markup change needed.
const ROC_ED_NARROW_CSS='.roc-ed{container-type:inline-size;}'
  +'@container (max-width:500px){.roc-ed [style*="grid-template-columns:repeat(4,1fr)"],.roc-ed [style*="grid-template-columns:1fr 1fr 1fr"],.roc-ed [style*="grid-template-columns:repeat(3,1fr)"],.roc-ed [style*="grid-template-columns:2fr 1fr 1fr"]{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}'
  +'@container (max-width:300px){.roc-ed [style*="grid-template-columns:repeat(4,1fr)"],.roc-ed [style*="grid-template-columns:1fr 1fr"],.roc-ed [style*="grid-template-columns:repeat(3,1fr)"],.roc-ed [style*="grid-template-columns:repeat(2,1fr)"],.roc-ed [style*="grid-template-columns:2fr 1fr"],.roc-ed [style*="grid-template-columns:1fr 2fr"]{grid-template-columns:minmax(0,1fr)!important;}}';
const ROC_ACT_TYPES=[['','— not set —'],['more-info','More info'],['toggle','Toggle'],['navigate','Navigate'],['url','Open URL'],['perform-action','Perform action'],['open-section','Open section'],['close-section','Close section'],['switch-room','Switch room'],['next-room','Next room'],['prev-room','Previous room'],['follow-room','Follow room'],['toggle-group','Toggle group'],['show-group','Show group'],['hide-group','Hide group'],['none','Do nothing (none)'],['custom','Custom (YAML)']];

function escA(s){return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');}
// Default glyph for vacuum_widgets when no custom `icon:` is set — a compact top-down
// robot-vacuum pictogram (body, camera/lidar turret, cliff-sensor slot, cleaning-line
// marks) rather than the stock mdi:robot-vacuum glyph, which reads poorly at this
// widget's small on-screen size.
const VW_ICON_VB='0 0 222.978402 150.251297';
const VW_ICON_TRANSFORM='translate(-0.021598,150.251297) scale(0.100000,-0.100000)';
const VW_ICON_PATHS='<path d="M905 1493 c-404 -38 -778 -199 -871 -377 -16 -30 -26 -57 -24 -59 3 -2 29 -7 58 -9 l52 -5 19 43 c53 119 247 236 500 300 94 24 292 54 357 54 31 0 34 2 34 30 0 29 -2 30 -42 28 -24 -1 -61 -3 -83 -5z"/><path d="M1071 1486 c-22 -26 -2 -47 43 -44 66 5 62 57 -5 58 -15 0 -32 -6 -38 -14z"/><path d="M1198 1471 c4 -29 7 -31 46 -31 59 0 235 -27 330 -49 253 -60 454 -178 514 -301 l21 -45 56 3 c37 3 55 8 55 17 0 26 -77 126 -130 170 -159 131 -488 238 -801 261 l-96 7 5 -32z"/><path d="M850 1395 c-402 -55 -670 -213 -670 -395 0 -128 134 -244 374 -324 383 -128 920 -105 1253 53 157 75 243 171 243 271 0 181 -277 343 -677 395 -137 18 -391 18 -523 0z m403 -144 c76 -21 117 -53 149 -115 24 -48 18 -75 -26 -114 -61 -53 -136 -75 -261 -75 -117 0 -180 14 -242 56 -34 23 -63 65 -63 93 0 27 56 107 88 126 82 48 240 61 355 29z m-289 -484 c25 -41 -74 -66 -108 -28 -16 17 -16 20 0 35 22 23 93 18 108 -7z m201 6 c16 -16 16 -18 -5 -35 -33 -27 -93 -21 -105 10 -14 38 77 58 110 25z m205 2 c27 -33 -20 -65 -75 -51 -57 14 -37 66 25 66 21 0 43 -7 50 -15z"/><path d="M1041 1239 c-35 -5 -84 -18 -110 -31 -39 -20 -46 -27 -46 -53 0 -24 7 -34 40 -52 135 -74 425 -35 425 57 0 20 -47 51 -95 65 -69 18 -139 23 -214 14z"/><path d="M860 1094 c0 -31 20 -52 72 -75 47 -21 67 -24 183 -24 111 0 137 3 175 21 54 25 80 49 80 74 0 17 -6 15 -62 -13 -60 -31 -65 -32 -193 -32 -128 0 -133 1 -193 32 -48 24 -62 28 -62 17z"/><path d="M7 1013 c-4 -3 -7 -117 -7 -252 0 -289 2 -297 103 -395 332 -323 1204 -406 1758 -167 129 56 194 97 267 169 100 100 102 104 102 394 l0 247 -37 7 c-47 9 -87 -12 -91 -47 -4 -32 13 -46 64 -57 l39 -8 -75 -75 c-88 -88 -215 -158 -383 -214 -488 -159 -1180 -103 -1544 127 -56 35 -173 148 -173 166 0 4 14 9 31 10 17 1 40 7 50 13 26 13 24 54 -3 73 -22 16 -89 22 -101 9z m1186 -583 c26 -29 27 -35 27 -136 l0 -106 -34 -34 c-26 -26 -42 -34 -71 -34 -82 0 -105 39 -105 181 l0 101 35 35 c32 32 39 35 78 30 30 -4 50 -15 70 -37z"/><path d="M1077 402 c-13 -14 -17 -39 -17 -110 0 -98 11 -122 54 -122 44 0 56 28 56 128 0 83 -2 92 -22 106 -29 21 -51 20 -71 -2z"/><path d="M2018 236 c-16 -12 -14 -14 21 -24 51 -16 68 -15 75 3 11 30 -63 47 -96 21z"/><path d="M195 235 c-5 -2 -22 -6 -37 -9 -19 -4 -28 -13 -28 -26 0 -23 16 -25 90 -9 l52 11 -31 19 c-17 10 -32 19 -34 18 -1 0 -6 -2 -12 -4z"/><path d="M1913 182 c-17 -11 93 -93 113 -85 24 9 16 28 -25 61 -40 32 -65 39 -88 24z"/><path d="M256 145 c-47 -37 -58 -61 -31 -71 21 -8 130 86 113 97 -22 14 -33 10 -82 -26z"/><path d="M386 84 c-7 -68 -3 -84 19 -84 17 0 23 20 27 84 2 42 -1 50 -19 57 -19 7 -21 3 -27 -57z"/><path d="M1813 143 c-23 -9 -11 -111 14 -120 28 -11 35 12 23 71 -11 56 -14 59 -37 49z"/><path d="M501 89 c9 -13 22 -34 30 -46 17 -28 49 -31 49 -4 0 27 -30 59 -65 67 -29 7 -29 7 -14 -17z"/><path d="M1624 76 c-18 -14 -18 -15 -1 -21 9 -4 24 -2 32 5 33 28 5 42 -31 16z"/>';
function vwIconHtml(vw){
  if(vw.icon)return'<ha-icon data-vwi="'+escA(vw.id)+'" class="vw-icon" icon="'+escA(vw.icon)+'" style="--mdc-icon-size:56%;width:56%;height:56%;position:relative;z-index:2;color:#fff;pointer-events:none;"></ha-icon>';
  return'<svg data-vwi="'+escA(vw.id)+'" class="vw-icon" viewBox="'+VW_ICON_VB+'" style="width:56%;height:56%;position:relative;z-index:2;pointer-events:none;overflow:visible;"><g transform="'+VW_ICON_TRANSFORM+'" fill="#fff">'+VW_ICON_PATHS+'</g></svg>';
}
// Escape a value for use inside a CSS attribute selector [data-x="..."]
function escSel(s){return(typeof CSS!=='undefined'&&CSS.escape)?CSS.escape(String(s)):String(s).replace(/["\\\]]/g,'\\$&');}
// Escape single quotes for CSS url('...') contexts
function escUrl(s){return String(s??'').replace(/'/g,'%27');}
// v6.25.0: high-quality downscaled copies of images for nav thumbnails.
// A photo or overlay drawn ~10x smaller than its file lets the browser's fast
// scaler alias fine detail (thin parallel lines: underfloor-heating pipes,
// slats, tiles) into false diagonal patterns (moire). Every image a thumbnail
// shows is resampled ONCE with a proper filter to the size it is really drawn
// at and served from a blob: URL. Only thumbnails use this — the full-size
// card always gets the original file. Unsupported/failed → the original URL.
const ROC_HQ_NAT=new Map();   // url → {w,h} | null (probing) | false (give up)
const ROC_HQ=new Map();       // url|W → blob URL | null (in progress)
const ROC_HQ_WAIT=new Map();  // key → [callbacks]
const ROC_HQ_Q=[];let ROC_HQ_RUN=0;
function rocHqPump(){
  while(ROC_HQ_RUN<2&&ROC_HQ_Q.length){ // two at a time: decoding a 2k image is not free on a wall tablet
    const job=ROC_HQ_Q.shift();ROC_HQ_RUN++;
    Promise.resolve().then(job).catch(function(){}).then(function(){ROC_HQ_RUN--;rocHqPump();});
  }
}
function rocHqWait(key,cb){if(!cb)return;const l=ROC_HQ_WAIT.get(key);if(l)l.push(cb);else ROC_HQ_WAIT.set(key,[cb]);}
function rocHqFire(key){const l=ROC_HQ_WAIT.get(key);ROC_HQ_WAIT.delete(key);if(l)l.forEach(function(f){try{f();}catch(_){}});}
function rocHqTarget(nat,devW,devH){
  const sc=Math.max(devW/nat.w,devH/nat.h);  // background-size: cover
  if(!(sc<0.5))return 0;                     // ≤2x smaller: the browser's own filter is fine
  return Math.max(16,Math.ceil(nat.w*sc/16)*16); // 16-px buckets — a 1-px resize never re-samples
}
async function rocHqResize(bmp,W,H){
  let src=bmp;
  try{
    src=await createImageBitmap(bmp,0,0,bmp.width,bmp.height,{resizeWidth:W,resizeHeight:H,resizeQuality:'high'});
  }catch(_){
    // No resize options (older Safari): halve step by step on a canvas — each
    // ≤2x step is filtered properly, unlike one big jump.
    let cw=bmp.width,ch=bmp.height,cur=bmp;
    while(cw/2>=W){
      cw=Math.round(cw/2);ch=Math.round(ch/2);
      const k=document.createElement('canvas');k.width=cw;k.height=ch;
      const kx=k.getContext('2d');kx.imageSmoothingEnabled=true;kx.imageSmoothingQuality='high';kx.drawImage(cur,0,0,cw,ch);cur=k;
    }
    src=cur;
  }
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;
  const cx=cv.getContext('2d');cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(src,0,0,W,H);
  if(src!==bmp&&src.close)try{src.close();}catch(_){}
  const blob=await new Promise(function(res){cv.toBlob(res,'image/png');});
  return blob?URL.createObjectURL(blob):null;
}
// devW/devH: device-pixel size of the box the image covers. Returns the HQ
// blob URL when it is ready; otherwise the original URL, queues the work and
// calls onReady once it lands.
function rocHqUrl(url,devW,devH,onReady){
  url=String(url||'');
  if(!url||!(devW>0)||!(devH>0)||/^(data|blob):/i.test(url)||typeof createImageBitmap!=='function'||typeof fetch!=='function'||typeof URL==='undefined'||!URL.createObjectURL)return url;
  const nat=ROC_HQ_NAT.get(url);
  if(nat===false)return url;
  if(nat===null){rocHqWait('n|'+url,onReady);return url;}
  if(nat){
    const W=rocHqTarget(nat,devW,devH);if(!W)return url;
    const key=url+'|'+W,got=ROC_HQ.get(key);
    if(got)return got;
    rocHqWait(key,onReady);
    if(got===undefined){
      ROC_HQ.set(key,null);
      ROC_HQ_Q.push(async function(){
        let bmp=null;
        try{
          const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw 0;
          bmp=await createImageBitmap(await r.blob());
          const u=await rocHqResize(bmp,W,Math.max(1,Math.round(nat.h*W/nat.w)));
          if(u)ROC_HQ.set(key,u);else ROC_HQ_NAT.set(url,false);
        }catch(_){ROC_HQ_NAT.set(url,false);}
        finally{if(bmp&&bmp.close)try{bmp.close();}catch(_){} rocHqFire(key);}
      });
      rocHqPump();
    }
    return url;
  }
  // First sight of this URL: learn its natural size (one decode), then ask again.
  ROC_HQ_NAT.set(url,null);rocHqWait('n|'+url,onReady);
  ROC_HQ_Q.push(async function(){
    try{
      const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw 0;
      const bmp=await createImageBitmap(await r.blob());
      ROC_HQ_NAT.set(url,{w:bmp.width,h:bmp.height});if(bmp.close)bmp.close();
    }catch(_){ROC_HQ_NAT.set(url,false);}
    finally{rocHqFire('n|'+url);}
  });
  rocHqPump();
  return url;
}
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
// Editor "Duplicate" buttons: find a free id starting from baseId+'_2' (the
// original suffix scheme), bumping the number until it doesn't collide with
// any existing id in `arr`. Duplicating the same item twice used to always
// produce baseId+'_2' both times — the second copy then silently never
// updated (_render() caches elements by id via querySelector, so only the
// first match is ever found).
function rocDupId(baseId,arr){
  let n=2,id=baseId+'_'+n;
  while(arr.some(function(x){return x&&x.id===id;})){n++;id=baseId+'_'+n;}
  return id;
}
// Config warnings are printed once per page, not once per setConfig: every
// nav.live mini and every room switch re-runs setConfig on the same config,
// which used to repeat the same line dozens of times (v6.16.0).
const ROC_WARNED=new Set();
function rocWarnOnce(msg){if(ROC_WARNED.has(msg))return;ROC_WARNED.add(msg);try{console.warn(msg);}catch(_){}}
function setSt(el,prop,val){if(el&&el.style[prop]!==val)el.style[prop]=val;}
// lock_aspect: size a fixed-design-aspect stage to COVER the (per-tier) box,
// centered. Elements live on this stage → glued to the image, identical across
// tiers; the per-tier aspect_ratio only changes how much is cropped.
// align (v6.14.0): 'top'|'center'(default)|'bottom' — where the stage sits
// vertically when it doesn't exactly fill the box (contain's letterbox gap,
// or cover's crop overflow). Horizontal stays centered either way — the
// vertical case is the one a taller-than-needed box (e.g. layout.height:
// fill's 1fr image row) actually produces.
function rocStageTop(boxH,h,align){
  return align==='top'?0:align==='bottom'?(boxH-h):(boxH-h)/2;
}
function coverStage(boxW,boxH,da,align){
  if(!(da>0)||!(boxW>0)||!(boxH>0))return null;
  let w,h;
  if(boxW/boxH>=da){w=boxW;h=boxW/da;}else{h=boxH;w=boxH*da;}
  return{w:w,h:h,left:(boxW-w)/2,top:rocStageTop(boxH,h,align)};
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
