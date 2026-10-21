// ----- Floor plan page (v6.47.0, V7_PLAN.md §6) ------------------------------------------------
// One room in `rooms:` can be a floor plan page: a `floorplan:` block draws the home as a vector
// plan (rooms, walls, doors) with each room's lights, floor heating, temperature and humidity, in
// one of seven themes. Same page model as the overview (D6): it hides the photo stage and the
// nav strip, taps open rooms with the zoom transition. The renderer is a third file,
// room-overlay-card-floorplan.js, loaded the first time a floor plan page is shown — nothing here
// runs for a config without a `floorplan:` room.
function rocFpCfg(cAll,idx){
  const r=cAll&&Array.isArray(cAll.rooms)?cAll.rooms[idx]:null;
  if(!r||!r.floorplan||r.overview)return null; // a room that is both: the overview wins
  return typeof r.floorplan==='object'?r.floorplan:{};
}
function rocFpAny(cAll){
  return!!(cAll&&Array.isArray(cAll.rooms)&&cAll.rooms.some(function(r){return r&&r.floorplan&&!r.overview;}));
}
const ROC_FP_FILE='room-overlay-card-floorplan.js';
let rocFpLoading=null;
function rocLoadFloorplan(){
  const C=customElements.get('room-overlay-card');
  if(C&&C._rocFloorplan)return Promise.resolve(C._rocFloorplan);
  if(rocFpLoading)return rocFpLoading;
  const url=rocAssetUrl(ROC_FP_FILE);
  if(!url)return Promise.reject(new Error('Floor plan: could not find the URL room-overlay-card.js was loaded from'));
  rocFpLoading=import(url).then(function(){
    const F=C&&C._rocFloorplan;
    if(!F)throw new Error('Floor plan: '+ROC_FP_FILE+' loaded but did not register');
    if(F.version!==ROC_VERSION)console.warn('[room-overlay-card] floorplan v'+F.version+' with card v'+ROC_VERSION+' — reload the page (browser cache)');
    return F;
  },function(e){
    rocFpLoading=null;
    console.warn('[room-overlay-card] floorplan import failed:',url,e);
    throw new Error('Floor plan file '+ROC_FP_FILE+' not found — it must sit next to room-overlay-card.js');
  });
  return rocFpLoading;
}
const ROC_FP_CSS='.roc-fp{position:absolute;inset:0;overflow:hidden;z-index:1;}.roc-fp-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;color:var(--roc-text-2-c);font-size:13px;line-height:1.5;}';
