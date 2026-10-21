// ---- Element model (Phase 3, v6.42.0) ------------------------------------------------------
// One row per element type the studio can select, create, copy and delete.
//  key    config list            pre    the editor's item panel prefix (details data-panel="<pre>-<i>")
//  panel  the editor section      canvas the card can select / drag it on the canvas (Arrange mode)
//  draw   'box' = drag a rectangle, 'point' = click (a click on a box type gives the default size)
//  def    defaults for a new one — the same values the editor's own "+ Add" buttons use
//  idp    id prefix of a new one (also the editor's)
const RS_TYPES={
  zone:{key:'zones',pre:'z',panel:'zones',icon:'mdi:gesture-tap',canvas:true,draw:'box',idp:'zone_',def:{width:'10%',height:'10%'}},
  icon:{key:'icons',pre:'ico',panel:'icons',icon:'mdi:star-four-points-outline',canvas:true,draw:'point',idp:'icon_',def:{icon:'mdi:help',size:'24px'}},
  label:{key:'labels',pre:'lbl',panel:'labels',icon:'mdi:format-text',canvas:true,draw:'point',idp:'label_',def:{entity:''}},
  gauge:{key:'gauges',pre:'g',panel:'gauges',icon:'mdi:gauge',canvas:true,draw:'box',idp:'gauge_',def:{width:'2%',height:'20%',entity:'',min:0,max:100}},
  glow:{key:'glows',pre:'gw',panel:'glows',icon:'mdi:lightbulb-on-outline',canvas:true,draw:'point',idp:'glow_',centre:true,def:{entity:'',size:'25%',intensity:0.7}},
  blind:{key:'blinds',pre:'bl',panel:'blinds',icon:'mdi:blinds-horizontal',canvas:true,draw:'box',idp:'blind_',def:{width:'20%',height:'40%',entity:'',min:0,max:100,blind_type:'roller'}},
  element:{key:'elements',pre:'el',panel:'elements',icon:'mdi:card-bulleted-outline',canvas:true,draw:'box',idp:'el_',def:{width:'30%',height:'20%',card:{type:'tile',entity:''}}},
  vacuum_widget:{key:'vacuum_widgets',pre:'vw',panel:'vacuum_widgets',icon:'mdi:robot-vacuum',canvas:true,draw:'point',idp:'vac_',def:{icon:'mdi:robot-vacuum',size:'44px',vacuums:[]}},
  badge:{key:'badges',pre:'b',panel:'badges',icon:'mdi:label-outline',canvas:false,idp:'badge_',def:{position:'bottom-left'}},
  overlay:{key:'overlays',pre:'ov',panel:'overlays',icon:'mdi:layers-outline',canvas:false,idp:'overlay_',def:{image:'',transition:'2s ease'}},
  group:{key:'groups',pre:'grp',panel:'groups',icon:'mdi:dock-window',canvas:false,idp:'group_',def:{visible:false}},
};
const RS_TYPE_ORDER=['zone','icon','label','gauge','glow','blind','element','vacuum_widget','badge','overlay','group'];
const RS_PRE2TYPE={};Object.keys(RS_TYPES).forEach(function(t){RS_PRE2TYPE[RS_TYPES[t].pre]=t;});

// The room object a scope refers to (null = the top level / a single-room card).
function rsRoom(cfg,roomIdx,global){
  return(!global&&Array.isArray(cfg.rooms)&&cfg.rooms.length)?cfg.rooms[Math.max(0,Math.min(roomIdx,cfg.rooms.length-1))]:null;
}
// Where an element of this type lives for the scope: the room's own list, else the inherited
// top-level list (the card's _roomArr does the same since v6.42.0).
function rsOwner(cfg,roomIdx,global,key){
  const r=rsRoom(cfg,roomIdx,global);
  if(r&&Array.isArray(r[key]))return{list:r[key],inherited:false};
  if(Array.isArray(cfg[key]))return{list:cfg[key],inherited:!!r};
  return{list:null,inherited:false};
}
// The list a NEW element goes to: the room's own (a copy of the inherited one first, so nothing
// on screen disappears), or the top level in Global / a single-room card.
function rsListForNew(cfg,roomIdx,global,key){
  const r=rsRoom(cfg,roomIdx,global);
  const t=r||cfg;
  if(!Array.isArray(t[key]))t[key]=(r&&Array.isArray(cfg[key]))?JSON.parse(rsJ(cfg[key])):[];
  return t[key];
}
function rsUniqueId(list,prefix,want){
  const used=new Set((list||[]).map(function(x){return x&&x.id;}));
  if(want&&!used.has(want))return want;
  let base=want?String(want).replace(/_\d+$/,''):prefix.replace(/_$/,'');
  let n=(list||[]).length+1;
  while(used.has(base+'_'+n))n++;
  return base+'_'+n;
}
// shift a percentage position a little (duplicate / paste on top of the original)
function rsNudgePct(v,d){const m=/^(-?\d+(?:\.\d+)?)%$/.exec(String(v==null?'':v));return m?Math.max(0,Math.min(98,parseFloat(m[1])+d)).toFixed(1)+'%':v;}
function rsPct(n){return(Math.round(Math.max(0,Math.min(100,n))*10)/10).toFixed(1)+'%';}
