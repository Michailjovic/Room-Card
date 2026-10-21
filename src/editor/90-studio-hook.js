// ----- Studio hook (v6.41.0, V7_PLAN.md §5, D5) -------------------------------------
// The studio is a second file, room-overlay-card-studio.js, next to this one. It is loaded with
// import() the first time someone opens it — a dashboard that only shows the card never
// downloads it. HACS installs every release asset, so the file is there for HACS users; a manual
// install has to copy both files (the error below says so).
//
// The studio never reaches into this file's scope: it gets what it needs through the explicit
// handle below (RoomOverlayCard._rocInternals), so it keeps working whether the card was loaded
// as a module (HACS) or as a classic script.
const ROC_STUDIO_FILE='room-overlay-card-studio.js';
// URL of the studio file: the card's own script URL with the file name swapped, the original
// query kept (HACS' ?hacstag= cache key) and ?v=<version> added so a stale cached studio from an
// older release is never paired with a newer card.
function rocStudioUrl(){return rocAssetUrl(ROC_STUDIO_FILE);}
// v6.47.0: the same for any sibling file (the floor plan renderer, room-overlay-card-floorplan.js).
function rocAssetUrl(file){
  const re=/\/room-overlay-card(\.min)?\.js(\?|#|$)/;
  let src='';
  try{
    const ss=document.querySelectorAll('script[src]');
    for(let i=0;i<ss.length;i++){if(re.test(ss[i].src)){src=ss[i].src;break;}}
  }catch(_){}
  if(!src)try{ // fallback: the resource timing entry (scripts injected and removed again)
    const es=performance.getEntriesByType('resource');
    for(let i=es.length-1;i>=0;i--){if(re.test(es[i].name)){src=es[i].name;break;}}
  }catch(_){}
  if(!src)return null;
  try{
    const u=new URL(src,location.href);
    u.pathname=u.pathname.replace(/[^/]*$/,file);
    u.hash='';
    u.searchParams.set('v',ROC_VERSION);
    return u.href;
  }catch(_){return null;}
}
let rocStudioLoading=null;
function rocLoadStudio(){
  const C=customElements.get('room-overlay-card');
  if(C&&C._rocStudio)return Promise.resolve(C._rocStudio);
  if(rocStudioLoading)return rocStudioLoading;
  const url=rocStudioUrl();
  if(!url)return Promise.reject(new Error('Studio: could not find the URL room-overlay-card.js was loaded from'));
  rocStudioLoading=import(url).then(function(){
    const S=C&&C._rocStudio;
    if(!S)throw new Error('Studio: '+ROC_STUDIO_FILE+' loaded but did not register');
    if(S.version!==ROC_VERSION)console.warn('[room-overlay-card] studio v'+S.version+' with card v'+ROC_VERSION+' — reload the page (browser cache)');
    return S;
  },function(e){
    rocStudioLoading=null;
    console.warn('[room-overlay-card] studio import failed:',url,e);
    throw new Error('Studio file '+ROC_STUDIO_FILE+' not found — it must sit next to room-overlay-card.js');
  });
  return rocStudioLoading;
}
function rocOpenStudio(opts){return rocLoadStudio().then(function(S){return S.open(opts);});}
RoomOverlayCard._rocStudioOpen=false; // set by the studio while it is open (editors ignore canvas relays)
RoomOverlayCard._rocInternals={
  version:ROC_VERSION,
  yaml:_yaml,
  clone:function(o){return rocClone(o);}, // wrapped: rocClone may be the native structuredClone, which throws when called as a method
  migrate:rocMigrateLayout,
  roomMerge:roomMerge,
  cfgKey:cfgKey,
  profile:rocProfile,
  esc:escA,
  studioUrl:rocStudioUrl,
  ROOM_KEYS:ROOM_KEYS,
  actTypes:ROC_ACT_TYPES, // v6.44.0 — the studio's action builder offers the same types as the editor
  // v6.46.0 — the new-card wizard: the card's domain icons, its placeholder image and how it spots a fresh card
  domainIcon:ROC_DOMAIN_ICON,
  stubImg:ROC_STUB_IMG,
  isStubImg:rocIsStubImg,
  isStubCfg:rocIsStubCfg,
  // v6.47.0 — the floor plan page: the studio loads the renderer through the card
  loadFloorplan:rocLoadFloorplan,
  fpCfg:rocFpCfg,
};
