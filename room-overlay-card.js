/**
 * room-overlay-card v1.15.0 — MIT License
 * https://github.com/Michailjovic/Room-Card
 */
const ROC_VERSION='1.15.0';
console.info('%c ROOM-OVERLAY-CARD %c v'+ROC_VERSION+' ','background:#3a7d5a;color:#fff;font-weight:bold;border-radius:4px 0 0 4px;padding:2px 0;','background:#222;color:#aef;border-radius:0 4px 4px 0;padding:2px 0;');
window.customCards=window.customCards||[];
window.customCards.push({type:'room-overlay-card',name:'Room Overlay Card',description:'Room visualization with image layers, transitions and clickable zones (v'+ROC_VERSION+')',preview:true,documentationURL:'https://github.com/Michailjovic/Room-Card',
  getEntitySuggestion:function(hass,entityId){
    // HA 2026.6+: suggest this card when the user picks a camera entity
    if(entityId.split('.')[0]!=='camera')return null;
    return{config:{type:'custom:room-overlay-card',base_camera:entityId,aspect_ratio:'16/9'}};
  }});

function escA(s){return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/'/g,'&#39;');}
function setSt(el,prop,val){if(el&&el.style[prop]!==val)el.style[prop]=val;}
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
// ---- Responsive tiers (container-width based) -------------------------------
// Order matters: smallest → largest. The active tier is chosen by the card's own
// width (offsetWidth), NOT the viewport — correct for HA dashboard columns.
const ROC_TIERS=['mobile','tablet','desktop','ultrawide'];
const ROC_TIER_BOUNDS={mobile:600,tablet:1024,desktop:1600}; // exclusive upper bound of each; ultrawide = the rest
// Active tier from a width + optional config overrides
// (cfg.breakpoints:{mobile,tablet,desktop}; legacy cfg.mobile_breakpoint wins for the mobile bound).
function rocTier(w,cfg){
  if(!(w>0))return'desktop';
  const bp=(cfg&&cfg.breakpoints)||{};
  const mB=(cfg&&cfg.mobile_breakpoint!=null)?cfg.mobile_breakpoint:(bp.mobile!=null?bp.mobile:ROC_TIER_BOUNDS.mobile);
  const tB=bp.tablet!=null?bp.tablet:ROC_TIER_BOUNDS.tablet;
  const dB=bp.desktop!=null?bp.desktop:ROC_TIER_BOUNDS.desktop;
  if(w<mB)return'mobile';
  if(w<tB)return'tablet';
  if(w<dB)return'desktop';
  return'ultrawide';
}
// Merge a per-item tier override block over the base item.
// Backward compatible: the 'mobile' tier also reads the legacy `it.mobile` block.
function tApply(it,tier){
  if(!it||!tier)return it;
  const o=it[tier]||(tier==='mobile'?it.mobile:null);
  return o?Object.assign({},it,o):it;
}
// Resolve a scalar that may instead be a per-tier object {mobile,tablet,desktop,ultrawide}.
// A missing tier falls back to the nearest defined tier (smaller first, then larger).
function tVal(val,tier){
  if(val==null||typeof val!=='object'||Array.isArray(val))return val;
  const want=tier||'desktop';
  if(val[want]!=null)return val[want];
  const i=ROC_TIERS.indexOf(want);
  for(let d=1;d<ROC_TIERS.length;d++){
    const lo=ROC_TIERS[i-d];if(lo&&val[lo]!=null)return val[lo];
    const hi=ROC_TIERS[i+d];if(hi&&val[hi]!=null)return val[hi];
  }
  return undefined;
}
// Legacy alias — the mobile profile = the 'mobile' tier.
function mApply(it,act){return tApply(it,act?'mobile':null);}
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
// ----- Multi-room helpers -----------------------------------------------------
// Keys that live per-room; top-level values act as shared defaults for all rooms
const ROOM_KEYS=['base_image','base_camera','camera_refresh','base_image_conditions','weather_overlay','filter_conditions','brightness_model','overlays','zones','badges','elements','icons','labels','gauges','blinds','groups','tap_action','cards_above','cards_below'];
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

function resolveSize(raw,cardW){if(!raw)return null;const s=String(raw);return s.endsWith('%')?Math.round(cardW*parseFloat(s)/100)+'px':s;}

function blindToGaugeConfig(b){
  const type=b.blind_type||'roller';
  const sw=b.slat_width??7,sg=b.slat_gap??sw;
  const sc=b.slat_color||'rgba(0,0,0,0.9)';
  const z=b.z_index??6;
  const base={id:'__bl_'+b.id,entity:b.entity,min:b.min??0,max:b.max??100,
    top:b.top,left:b.left,width:b.width,height:b.height,z_index:z,
    orientation:'top',background:b.background||'transparent',border_radius:b.border_radius||'0'};
  if(b.attribute!==undefined)base.attribute=b.attribute;
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
    this._bcontEls={};this._wxEl=null;this._camTimer=null;
    this._tmplUnsubs=[];this._tmplVals={};this._tmplVis={};this._relTimer=null;
    this._gdH=null;this._gdV=null;this._mobActive=false;this._tier=null;this._vt=null;
    this._roomIdx=0;this._roomCfg=null;this._manualHoldUntil=0;
    this._navThumbEls={};this._navChipEls=[];this._navCardEls=[];this._zoomScale=1;
    this._navPos='top';this._wrapTA='';
    this._orientHandler=null;this._roomDragActive=false;
    this._lastRoomDragEnd=0;this._followInit=false;this._navFollowEl=null;
    this._stripCardEls=[];
    this._hlHandler=null;this._sortedLblGrads={};this._sortedBmFg=null;this._radialMeta={};
    this._cfgJson=null;
  }

  static getStubConfig(){return{base_image:'/local/room.webp',aspect_ratio:'16/9',border_radius:'12px',filter_conditions:[],overlays:[],zones:[],badges:[],elements:[],icons:[],test_mode:false,labels:[],gauges:[]};}

  setConfig(cfg){
    const hasRooms=Array.isArray(cfg.rooms)&&cfg.rooms.length;
    if(!cfg.base_image&&!cfg.base_camera&&!(hasRooms&&cfg.rooms.some(function(r){return r.base_image||r.base_camera;})))
      throw new Error('[room-overlay-card] base_image (or base_camera) is required — directly or in rooms[]');
    const j=JSON.stringify(cfg);
    if(this._rendered&&this._cfgJson===j)return; // identical config — skip full rebuild
    this._cfgJson=j;
    if(hasRooms&&this._roomIdx>=cfg.rooms.length)this._roomIdx=0;
    this._config=cfg;this._rendered=false;if(this._hass)this._render();
  }

  set hass(h){
    this._hass=h;if(!this._config)return;
    if(!this._rendered){this._render();return;}
    if(!this._visible)return;
    // Embedded cards do their own change detection — always forward hass
    for(const k in this._cardEls){try{this._cardEls[k].hass=h;}catch(_){}}
    for(const el of(this._navCardEls||[]))try{el.hass=h;}catch(_){}
    for(const el of(this._stripCardEls||[]))try{el.hass=h;}catch(_){}
    if(this._relevantEntities){
      const s=h.states,p=this._prevStates;
      if(!this._relevantEntities.some(id=>s[id]?.state!==p[id]))
        {if(!this._relevantAttrSources||!this._relevantAttrSources.some(a=>s[a.entity]?.attributes[a.attr]!==p[a.entity+'.'+a.attr]))return;}
    }
    if(!this._rafPending){
      this._rafPending=true;
      requestAnimationFrame(()=>{
        this._rafPending=false;
        if(this._hass&&this._rendered)this._update();
      });
    }
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
        holdTimer=setTimeout(function(){held=true;doneHold();},delay);
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
    const p=(r||'16/9').split('/');
    if(p.length===2){const w=parseFloat(p[0]),h=parseFloat(p[1]);if(w>0&&h>0)return((h/w)*100).toFixed(4)+'%';}
    return'56.25%';
  }

  _preloadImages(){
    const c=this._config,urls=new Set();
    if(c.base_image)urls.add(c.base_image);
    for(const bc of(c.base_image_conditions||[])){if(bc.image)urls.add(bc.image);}
    for(const ov of(c.overlays||[])){
      if(ov.image)urls.add(ov.image);
      if(ov.state_images)ov.state_images.forEach(function(m){if(m.image)urls.add(m.image);});
    }
    this._preloadImgs=[];const _plSelf=this;urls.forEach(function(url){const img=new Image();img.src=url;_plSelf._preloadImgs.push(img);});
  }

  _render(){
    if(!this._config)return;
    const cAll=this._config;
    const c=roomMerge(cAll,this._roomIdx); // active room view (or plain config)
    this._roomCfg=c;
    this._zoomScale=1;this._wrapTA='';
    const tm=c.test_mode??false;
    // Active responsive tier (by the card's own width). Null in test mode so that
    // dragging always edits the base profile (tier deltas merge over the base).
    const _rt=rocTier(this.offsetWidth,c); // real tier by the card's own width
    const _tier=tm?null:_rt; // element tier-overrides are off in test mode (so dragging edits the base profile)
    this._tier=_tier;this._mobActive=(_tier==='mobile');
    const _vt=_rt; // per-tier SCALARS (aspect_ratio/border_radius/max_height) follow the real tier even in test mode
    this._vt=_vt;
    const _arResolved=tVal(c.aspect_ratio,_vt)||'16/9';
    const pad=this._pad(_arResolved),br=(tVal(c.border_radius,_vt)??'12px');
    // Optional per-tier height cap. The image box keeps its aspect ratio (so % positions
    // stay valid) but stops growing once it would exceed max_height — converted to a
    // max-width via the ratio — then centered, letterboxing the sides on wide screens.
    let _wrapMax='';
    {
      let _mh=tVal(c.max_height,_vt);
      if(typeof _mh==='number')_mh=_mh+'px';
      if(_mh){
        const _arp=String(_arResolved).split('/');const _aw=parseFloat(_arp[0]),_ah=parseFloat(_arp[1]);
        if(_aw>0&&_ah>0)_wrapMax=' style="max-width:calc('+_mh+' * '+(_aw/_ah).toFixed(4)+');margin-left:auto;margin-right:auto;"';
      }
    }
    // ---- Multi-room navigation strip -------------------------------------
    let navHtml='';
    const navCfg=cAll.nav||{};
    const navStyle=Array.isArray(cAll.rooms)&&cAll.rooms.length>1?(navCfg.style||'thumbnails'):'none';
    // position: top | bottom | left | right | auto (auto = side rail on wide cards)
    let navPos=navCfg.position||'top';
    if(navPos==='auto')navPos=(this.offsetWidth||0)>=(navCfg.auto_breakpoint??1100)?'left':'top';
    if(navStyle==='none')navPos='top';
    this._navPos=navPos;
    const _navSide=navPos==='left'||navPos==='right';
    if(navStyle!=='none'){
      const nh=navCfg.height||'64px';
      const _np=String(tVal(c.aspect_ratio,_vt)||'16/9').split('/');
      const _nr=(parseFloat(_np[0])>0&&parseFloat(_np[1])>0)?parseFloat(_np[0])/parseFloat(_np[1]):16/9;
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
      const _navMob=!_navSide&&(this.offsetWidth||0)>0&&(this.offsetWidth||0)<(cAll.mobile_breakpoint??600);
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
      // Follow button — jump back to the presence room (room_entity)
      const _fbHtml=(cAll.room_entity&&navCfg.follow_button!==false)
        ?'<button data-nav-follow title="Jump to my room (presence)" style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--divider-color,#555);background:none;color:var(--primary-text-color,#fff);cursor:pointer;"><ha-icon icon="mdi:crosshairs-gps" style="--mdc-icon-size:18px;"></ha-icon></button>'
        :'';
      navHtml='<div class="roc-nav" style="display:flex;'+(_navSide?'flex-direction:column;overflow-y:auto;overflow-x:hidden;flex:none;':(_navMob?'flex-wrap:wrap;':'overflow-x:auto;'))+'gap:6px;padding:6px;align-items:center;scrollbar-width:thin;">'
        +_navCardsStart
        +cAll.rooms.map(function(r,ri){
          const act=ri===navSelfIdx;
          if(navStyle==='dots')
            return'<button data-nav-room="'+ri+'" aria-label="'+escA(r.name||r.id)+'" style="width:10px;height:10px;border-radius:50%;border:none;cursor:pointer;background:'+(act?'var(--primary-color,#03a9f4)':'var(--divider-color,#666)')+';padding:0;flex:none;"></button>';
          if(navStyle==='tabs')
            return'<button data-nav-room="'+ri+'" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:16px;border:1px solid '+(act?'var(--primary-color,#03a9f4)':'var(--divider-color,#444)')+';cursor:pointer;background:'+(act?'rgba(3,169,244,0.15)':'none')+';color:var(--primary-text-color,#fff);font-size:12px;'+_tabFlex+'">'+(r.icon?'<ha-icon icon="'+escA(r.icon)+'" style="--mdc-icon-size:16px;"></ha-icon>':'')+escA(r.name||r.id||'')+'</button>';
          // thumbnails — live mini-render: base image + filter + sensor chips
          return'<div class="roc-thumb" data-nav-room="'+ri+'" data-thumb="'+ri+'" tabindex="0" role="button" aria-label="'+escA(r.name||r.id)+'" style="position:relative;'+_thSize+_thFlex+'border-radius:6px;overflow:hidden;cursor:pointer;background-size:cover;background-position:center;'+(r.base_image?'background-image:url(\''+escA(r.base_image)+'\');':'')+'border:2px solid '+(act?'var(--primary-color,#03a9f4)':'transparent')+';box-sizing:border-box;transition:border-color .2s ease,filter 1.5s ease;">'
            +'<div data-thumb-chips="'+ri+'" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;padding:3px 5px;pointer-events:none;font-family:monospace;font-weight:bold;font-size:11px;text-shadow:0 1px 2px rgba(0,0,0,0.9);color:#fff;"></div></div>';
        }).join('')+_navBreak+_navCardsEnd+_fbHtml+'</div>';
    }
    const _navTop=!_navSide&&navPos!=='bottom'?navHtml:'';
    const _navBot=!_navSide&&navPos==='bottom'?navHtml:'';
    const _flexPre=_navSide?'<div style="display:flex;align-items:stretch;">'+(navPos==='left'?navHtml:''):'';
    const _flexPost=_navSide?(navPos==='right'?navHtml:'')+'</div>':'';
    const _wrapStyle=_navSide?' style="flex:1 1 auto;min-width:0;"':'';

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
    this._teardownTemplates();
    this._selectedTM=null;

    // Legacy boolean derived from the tier — used by strip media filtering below.
    const _mob=(_tier==='mobile');
    const ovHtml=(c.overlays||[]).map((ov,i)=>`<div class="layer ov" data-ov="${ov.id}" style="z-index:${ov.z_index??i+1};opacity:0;transition:opacity ${ov.transition??'2s ease'},filter ${ov.transition??'2s ease'};will-change:opacity,transform;transform:translateZ(0);"></div>`).join('');
    const zHtml=(c.zones||[]).map(z0=>{const z=tApply(z0,_tier);const act=z.tap_action||z.hold_action||z.double_tap_action||z.slider;const a11y=act?` tabindex="0" role="button" aria-label="${escA(z.id)}"`:'';return`<div class="zone" data-z="${escA(z.id)}"${a11y} style="top:${z.top};left:${z.left};width:${z.width};height:${z.height};z-index:50;cursor:${act?'pointer':'default'};box-sizing:border-box;-webkit-tap-highlight-color:transparent;outline:none;${tm?'outline:3px solid red;background:rgba(255,0,0,0.08);':''}" title="${tm?escA(`[${z.id}] ${z.top} ${z.left} ${z.width}x${z.height}`):''}">${tm?`<span class="zlabel">${escA(z.id)}</span>`:''}</div>`;}).join('');
    const bHtml=(c.badges||[]).map(b=>{let animSt='';if(b.animation==='blink')animSt='animation:roc-blink 1s step-end infinite;';else if(b.animation==='pulse'){if(b.animation_color)animSt='--roc-ac:'+b.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else animSt='animation:roc-pulse 2s ease-in-out infinite;';}return'<div class="badge" data-b="'+b.id+'" style="'+makeBadgePos(tApply(b,_tier))+';cursor:'+(b.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;'+animSt+'">'+(b.icon?'<ha-icon data-bi="'+b.id+'" icon="'+b.icon+'" style="color:white;--mdc-icon-size:14px;width:14px;height:14px;display:flex;"></ha-icon>':'')+(b.label!==undefined?'<span class="blabel" data-bl="'+b.id+'"></span>':'')+'</div>';}).join('');
    const _cardW=this.offsetWidth||300;
    const icoHtml=(c.icons||[]).map(ico0=>{const ico=tApply(ico0,_tier);const sz=resolveSize(ico.size||'20px',_cardW);const _ibg=ico.background?'background:'+ico.background+';border-radius:50%;padding:7px;box-sizing:content-box;':'';const a11y=ico.tap_action?' tabindex="0" role="button" aria-label="'+escA(ico.id)+'"':'';return'<div class="ico" data-ico="'+escA(ico.id)+'"'+a11y+' style="position:absolute;top:'+ico.top+';left:'+ico.left+';z-index:'+(ico.z_index??6)+';cursor:'+(ico.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;'+_ibg+'"><ha-icon data-icoicon="'+escA(ico.id)+'" icon="'+escA(ico.icon||'')+'" style="--mdc-icon-size:'+sz+';width:'+sz+';height:'+sz+';display:flex;color:var(--roc-icon-color,#fff);pointer-events:none;"></ha-icon></div>';}).join('');

    const lblHtml=(c.labels||[]).map(lbl0=>{const lbl=tApply(lbl0,_tier);const fs=resolveSize(lbl.font_size,_cardW)||'clamp(8px,0.8vw,13px)';const ff=lbl.font_family||'monospace';const fw=lbl.font_weight||'bold';const bg=lbl.background||'';const pad=lbl.padding||'';const br=lbl.border_radius||'';const ts=lbl.text_shadow!==undefined?lbl.text_shadow:'0 1px 3px rgba(0,0,0,0.8)';let st='position:absolute;top:'+lbl.top+';left:'+lbl.left+';z-index:'+(lbl.z_index??6)+';pointer-events:none;font-size:'+fs+';font-family:'+ff+';font-weight:'+fw+';white-space:nowrap;color:var(--roc-label-color,#fff);';if(bg)st+='background:'+bg+';';if(pad)st+='padding:'+pad+';';if(br)st+='border-radius:'+br+';';if(ts)st+='text-shadow:'+ts+';';if(lbl.animation==='blink')st+='animation:roc-blink 1s step-end infinite;';else if(lbl.animation==='pulse'){if(lbl.animation_color)st+='--roc-ac:'+lbl.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else st+='animation:roc-pulse 2s ease-in-out infinite;';}return'<div class="lbl" data-lbl="'+lbl.id+'" style="'+st+'"></div>';}).join('');
    const grpHtml=(c.groups||[]).filter(g=>g.style).map(g=>{const st=g.style;const vis=this._groupState[g.id]??false;return'<div data-grp-panel="'+escA(g.id)+'" style="position:absolute;top:'+(st.top||'0')+';left:'+(st.left||'0')+';width:'+(st.width||'auto')+';height:'+(st.height||'auto')+';z-index:'+(st.z_index||49)+';background:'+(st.background||'transparent')+';border-radius:'+(st.border_radius||'0')+';pointer-events:none;transition:opacity .25s ease,visibility .25s ease;visibility:'+(vis?'visible':'hidden')+';opacity:'+(vis?'1':'0')+';"></div>';}).join('');
    const _wx=c.weather_overlay?(typeof c.weather_overlay==='string'?{entity:c.weather_overlay}:c.weather_overlay):null;
    const wxHtml=_wx?'<div class="layer wx" data-wx style="z-index:'+(_wx.z_index??5)+';opacity:0;"></div>':'';
    // Per-room companion strips above/below the image (normal document flow —
    // mobile friendly). Entry: plain card config or {card, height, media: all|mobile|desktop}
    // media: all | mobile | desktop (legacy = any non-mobile) | tier list (e.g. "tablet,ultrawide")
    const _stripShow=function(media){
      if(!media||media==='all')return true;
      if(media==='mobile')return _mob;
      if(media==='desktop')return !_mob;
      return String(media).split(',').map(function(s){return s.trim();}).indexOf(_vt)>=0;
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
    }const _ghoriz=_gor==='horizontal'||_gor==='right';const defTr=_ghoriz?'width 0.5s ease':'height 0.5s ease';const tr=g.transition||defTr;let fillSt;if(g._dayNight){const _dtr=g.transition||'height 0.5s ease';const _bgTr=_dtr.replace(/^\S+\s+/,'');fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:transparent;background-repeat:repeat;background-size:100% auto;transition:'+_dtr+',background-position-y '+_bgTr+';';}else if(_gor==='top')fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';else if(_gor==='right')fillSt='position:absolute;top:0;right:0;bottom:0;width:0%;background:white;transition:'+tr+';';else if(_gor==='horizontal')fillSt='position:absolute;top:0;left:0;bottom:0;width:0%;background:white;transition:'+tr+';';else fillSt='position:absolute;bottom:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';return'<div class="gauge" data-gauge="'+g.id+'" style="position:absolute;top:'+g.top+';left:'+g.left+';width:'+g.width+';height:'+g.height+';z-index:'+(g.z_index??6)+';pointer-events:none;background:'+bg+';border:1px solid rgba(255,255,255,0.12);border-radius:'+br+';overflow:hidden;"><div class="gfill" style="'+fillSt+'"></div></div>';}).join('');
    this.shadowRoot.innerHTML='<style>:host{display:block;}@keyframes roc-pulse{0%,100%{opacity:1}50%{opacity:.25}}@keyframes roc-glow{0%,100%{opacity:1;filter:drop-shadow(0 0 0px var(--roc-ac,transparent))}50%{opacity:.7;filter:drop-shadow(0 0 8px var(--roc-ac,rgba(255,0,0,.6)))}}@keyframes roc-blink{0%,49.9%{opacity:1}50%,100%{opacity:0}}@keyframes roc-border-pulse{0%,100%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8)),inset 0 0 8px var(--roc-ac,rgba(255,0,0,.3))}50%{box-shadow:inset 0 0 0 2px transparent,inset 0 0 0 transparent}}@keyframes roc-border-blink{0%,49.9%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8))}50%,100%{box-shadow:none}}@keyframes roc-rain{from{background-position:0 0,0 0}to{background-position:-60px 240px,-30px 120px}}@keyframes roc-snow{0%{background-position:0 0,40px 60px,20px 30px}100%{background-position:90px 280px,-50px 340px,110px 240px}}@keyframes roc-snow-heavy{0%{background-position:0 0,30px 40px,15px 20px}100%{background-position:70px 220px,-40px 250px,70px 160px}}@keyframes roc-fog{0%{background-position:0 0,0 0}100%{background-position:340px 0,-260px 0}}@keyframes roc-flash{0%,91.5%,94.2%,100%{opacity:0}92%,92.6%{opacity:.85}93.4%{opacity:.35}}.wx{transition:opacity 1.5s ease;}.wx-rain{background-image:repeating-linear-gradient(var(--roc-rain-angle,105deg),rgba(255,255,255,0.16) 0px,rgba(255,255,255,0.16) 1px,transparent 1px,transparent 26px),repeating-linear-gradient(calc(var(--roc-rain-angle,105deg) - 5deg),rgba(255,255,255,0.10) 0px,rgba(255,255,255,0.10) 1px,transparent 1px,transparent 17px);background-size:60px 240px,30px 120px;animation:roc-rain 0.55s linear infinite;}.wx-rain.wx-heavy{background-size:42px 200px,22px 100px;animation-duration:0.32s;}.wx-snow{background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.95) 0 2.2px,rgba(255,255,255,0.35) 3px,transparent 4.2px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.85) 0 1.7px,rgba(255,255,255,0.3) 2.4px,transparent 3.4px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.65) 0 1.2px,transparent 2.4px);background-size:90px 140px,90px 140px,90px 105px;animation:roc-snow 9s linear infinite;}.wx-snow.wx-heavy{background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.95) 0 2.6px,rgba(255,255,255,0.4) 3.6px,transparent 5px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.85) 0 2px,rgba(255,255,255,0.32) 2.8px,transparent 4px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.65) 0 1.4px,transparent 2.8px);background-size:70px 110px,70px 105px,55px 70px;animation:roc-snow-heavy 5.5s linear infinite;}.wx-fog{background-image:radial-gradient(ellipse 60% 40% at 30% 55%,rgba(255,255,255,0.22) 0%,transparent 70%),radial-gradient(ellipse 70% 45% at 75% 40%,rgba(255,255,255,0.16) 0%,transparent 70%);background-size:340px 100%,420px 100%;background-repeat:repeat-x;animation:roc-fog 60s linear infinite;}.wx-lightning::after{content:"";position:absolute;inset:0;background:rgba(255,255,255,0.95);opacity:0;animation:roc-flash 7s linear infinite;pointer-events:none;}@keyframes roc-holdfill{to{stroke-dashoffset:0;}}@keyframes roc-holdpop{0%{transform:rotate(-90deg) scale(1);}45%{transform:rotate(-90deg) scale(1.18);}100%{transform:rotate(-90deg) scale(1);}}.roc-hold{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;z-index:300;pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.55));}.roc-hold svg{width:100%;height:100%;transform:rotate(-90deg);}.roc-hold circle{fill:none;stroke-width:3;}.roc-hold-trk{stroke:rgba(255,255,255,0.22);}.roc-hold-bar{stroke:var(--roc-hold-color,var(--primary-color,#03a9f4));stroke-linecap:round;stroke-dasharray:100.53;stroke-dashoffset:100.53;animation:roc-holdfill var(--roc-hold-dur,500ms) linear forwards;}.roc-hold.done svg{animation:roc-holdpop 0.3s ease;}.roc-hold.done .roc-hold-bar{stroke-dashoffset:0;stroke:var(--roc-hold-done-color,#37d67a);}.roc-gd{position:absolute;background:var(--primary-color,#03a9f4);z-index:998;display:none;pointer-events:none;}.roc-gd-h{left:0;right:0;height:1px;}.roc-gd-v{top:0;bottom:0;width:1px;}.zone,.badge,.ico,.lbl,.gauge,.elcont{transition:opacity .25s ease,visibility .25s ease,transform .25s ease;}ha-card{overflow:hidden;padding:0!important;background:transparent;border-radius:'+br+'}.wrap{position:relative;width:100%;padding-bottom:'+pad+';overflow:hidden;}.content{position:absolute;inset:0;overflow:hidden;}.layer{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;}.zone{position:absolute;}.zlabel{position:absolute;top:2px;left:4px;font-size:10px;color:red;font-weight:bold;pointer-events:none;text-shadow:0 0 3px white;white-space:nowrap;}.badge{position:absolute;z-index:100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px 10px;white-space:nowrap;user-select:none;}.blabel{font-size:12px;color:white;font-weight:500;}.elcont{position:absolute;pointer-events:auto;}.elcont>*{width:100%!important;height:100%!important;display:block;}</style><ha-card>'+_navTop+_flexPre+'<div class="roc-main"'+_wrapStyle+'>'+_aboveHtml+'<div class="wrap"'+_wrapMax+'><div class="content"><div class="layer base" style="'+(c.base_image?'background-image:url(\''+c.base_image+'\');':'')+'transition:filter '+(c.filter_transition??'2s ease')+';will-change:filter,transform;transform:translateZ(0);"></div>'+ovHtml+wxHtml+grpHtml+zHtml+bHtml+icoHtml+lblHtml+gaugeHtml+(tm?'<div class="tm-info" style="position:absolute;top:6px;left:6px;z-index:200;background:rgba(0,0,0,0.72);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:4px 8px;font-size:11px;font-weight:bold;font-family:monospace;line-height:1.35;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;pointer-events:none;">&#128208; '+Math.round(this.offsetWidth)+' px<br><span style="font-weight:normal;opacity:0.85;">tier: '+rocTier(this.offsetWidth,c)+'</span></div><button class="tm-flip" style="position:absolute;top:6px;right:6px;z-index:200;background:'+(this._testFlipped?'rgba(220,80,0,0.9)':'rgba(0,0,0,0.72)')+';color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#8644; '+(this._testFlipped?'FLIPPED':'FLIP')+'</button>'+(c._roc_preview?'':'<button class="tm-save" style="position:absolute;top:38px;right:6px;z-index:200;background:rgba(20,100,20,0.82);color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#128190; Save</button>'):'')+'</div></div>'+_belowHtml+'</div>'+_flexPost+_navBot+'</ha-card>';

    const content=this.shadowRoot.querySelector('.content');
    this._baseEl=this.shadowRoot.querySelector('.base');
    this._tmInfoEl=tm?this.shadowRoot.querySelector('.tm-info'):null;
    this._wxEl=this.shadowRoot.querySelector('[data-wx]');
    // ---- Nav wiring -------------------------------------------------------
    this._navThumbEls={};this._navChipEls=[];this._navCardEls=[];this._navFollowEl=null;
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
      // Custom HA cards embedded in the nav strip
      (navCfg.cards||[]).forEach(function(cc,ci){
        const host=navSelf.shadowRoot.querySelector('[data-nav-card="'+ci+'"]');
        if(!host)return;
        const cardCfg=cc&&cc.card?cc.card:cc;
        if(!cardCfg||!cardCfg.type)return;
        const wrapEl=makeHACard(cardCfg,function(el){
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
          stSelf._stripCardEls.push(el);
          if(stSelf._hass)try{el.hass=stSelf._hass;}catch(_){}
        });
        if(w)host.appendChild(w);
      });
    };
    _mountStrip(c.cards_above,'data-above-card');
    _mountStrip(c.cards_below,'data-below-card');
    // ---- Finger-attached room drag (filmstrip feel) -------------------------
    if(Array.isArray(cAll.rooms)&&cAll.rooms.length>1&&!tm){
      const wrapSw=this.shadowRoot.querySelector('.wrap');
      if(wrapSw)this._attachRoomDrag(wrapSw);
    }
    if(this._wxEl&&_wx&&_wx.angle!==undefined)this._wxEl.style.setProperty('--roc-rain-angle',typeof _wx.angle==='number'?_wx.angle+'deg':String(_wx.angle));
    this._ovEls={};
    for(const ov of(c.overlays||[])){this._ovEls[ov.id]=this.shadowRoot.querySelector('[data-ov="'+ov.id+'"]');}
    this._grpPanelEls={};
    for(const g of(c.groups||[])){if(g.style)this._grpPanelEls[g.id]=this.shadowRoot.querySelector('[data-grp-panel="'+g.id+'"]');}
    this._zoneEls={};
    for(const z of(c.zones||[])){
      const el=this.shadowRoot.querySelector('[data-z="'+z.id+'"]');
      if(!el)continue;this._zoneEls[z.id]=el;
      if(z.tap_action||z.hold_action||z.double_tap_action)
        this._addZoneListeners(el,z.tap_action,z.hold_action,z.double_tap_action,z.hold_delay);
      if(z.slider&&z.slider.entity&&!tm)this._attachSlider(el,z);
    }
    this._biconEls={};this._blabelEls={};this._bcontEls={};
    for(const b of(c.badges||[])){
      this._biconEls[b.id]=this.shadowRoot.querySelector('[data-bi="'+b.id+'"]');
      this._blabelEls[b.id]=this.shadowRoot.querySelector('[data-bl="'+b.id+'"]');
      const bel=this.shadowRoot.querySelector('[data-b="'+b.id+'"]');
      this._bcontEls[b.id]=bel;
      if(bel&&b.tap_action){bel.addEventListener('click',e=>this._exec(b.tap_action,e));bel.addEventListener('touchend',e=>this._exec(b.tap_action,e));}
    }
    this._icoEls={};
    for(const ico of(c.icons||[])){
      const el=this.shadowRoot.querySelector('[data-ico="'+ico.id+'"]');
      if(!el)continue;this._icoEls[ico.id]=el;
      if(ico.tap_action)this._addZoneListeners(el,ico.tap_action,ico.hold_action,ico.double_tap_action,ico.hold_delay);
    }
    this._lblEls={};this._sortedLblGrads={};
    for(const lbl of(c.labels||[])){
      this._lblEls[lbl.id]=this.shadowRoot.querySelector('[data-lbl="'+lbl.id+'"]');
      if(lbl.color_gradient)this._sortedLblGrads[lbl.id]=lbl.color_gradient.slice().sort((a,b)=>a.value-b.value);
      const lel=this._lblEls[lbl.id];
      if(lel&&(lbl.tap_action||lbl.hold_action||lbl.double_tap_action)){
        lel.style.pointerEvents='auto';lel.style.cursor='pointer';
        lel.setAttribute('tabindex','0');lel.setAttribute('role','button');
        this._addZoneListeners(lel,lbl.tap_action,lbl.hold_action,lbl.double_tap_action,lbl.hold_delay);
      }
    }
    this._sortedBmFg=c.brightness_model?.filter_gradient?.length?c.brightness_model.filter_gradient.slice().sort((a,b)=>a.value-b.value):null;
    this._gaugeEls={};this._gaugeFills={};this._sortedGrads={};this._blindGaugeCfgs=(c.blinds||[]).map(b=>tApply(b,_tier)).flatMap(blindToGaugeConfig);for(const g of(c.gauges||[])){this._gaugeEls[g.id]=this.shadowRoot.querySelector('[data-gauge="'+g.id+'"]');if(this._gaugeEls[g.id])this._gaugeFills[g.id]=this._gaugeEls[g.id].querySelector('.gfill');if(g.color_gradient)this._sortedGrads[g.id]=g.color_gradient.slice().sort((a,b)=>a.value-b.value);}for(const bg of this._blindGaugeCfgs){this._gaugeEls[bg.id]=this.shadowRoot.querySelector('[data-gauge="'+bg.id+'"]');if(this._gaugeEls[bg.id])this._gaugeFills[bg.id]=this._gaugeEls[bg.id].querySelector('.gfill');if(bg.color_gradient)this._sortedGrads[bg.id]=bg.color_gradient.slice().sort((a,b)=>a.value-b.value);}
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
            const _viewKey=_parts.length>1?_parts[_parts.length-1]:null;
            _callWS({type:'lovelace/config',url_path:_urlPath})
              .then(function(lc){
                const nc=JSON.parse(JSON.stringify(lc));
                // Find the current view (by index or path slug)
                let view=null;
                if(_viewKey!==null){
                  const idx=parseInt(_viewKey,10);
                  view=!isNaN(idx)?nc.views[idx]:nc.views.find(function(v){return v.path===_viewKey;});
                }
                if(!view&&nc.views&&nc.views.length)view=nc.views[0];
                if(!view)throw new Error('view_not_found');
                // Walk only the current view — avoids matching copies in other views/tabs
                const matches=[];
                function _walk(cards){
                  if(!Array.isArray(cards))return;
                  for(let i=0;i<cards.length;i++){
                    const card=cards[i];
                    if(card.type==='custom:room-overlay-card'&&cfgKey(card)===cfgKey(self._config)){
                      matches.push({arr:cards,idx:i});
                    }
                    if(card.cards)_walk(card.cards);
                    if(card.card)_walk([card.card]);
                  }
                }
                // Masonry / panel layout: view.cards[]
                _walk(view.cards);
                // Sections layout (HA 2024+): view.sections[].cards[]
                if(Array.isArray(view.sections))for(const sec of view.sections)_walk(sec.cards);
                if(!matches.length)throw new Error('card_not_found_in_view');
                if(matches.length>1)throw new Error('multiple matching cards in view (same base image) — copy the YAML manually');
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
          const nc=JSON.parse(JSON.stringify(this._config));
          const zc=this._roomArr(nc,'zones').find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const ico of(c.icons||[])){
        const el=this._icoEls[ico.id];if(!el)continue;
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const ic=this._roomArr(nc,'icons').find(x=>x.id===ico.id);if(ic){ic.top=top;ic.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const lbl of(c.labels||[])){
        const el=this._lblEls[lbl.id];if(!el)continue;
        el.style.pointerEvents='auto';el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const lc=this._roomArr(nc,'labels').find(x=>x.id===lbl.id);if(lc){lc.top=top;lc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      // Resize handles — zones, elements, gauges
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const zc=this._roomArr(nc,'zones').find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;zc.width=width;zc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      for(const elCfg of(c.elements||[])){
        const cont=this._contEls[elCfg.id];if(!cont)continue;
        this._makeResizable(cont,(top,left,width,height)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const ec=this._roomArr(nc,'elements').find(x=>x.id===elCfg.id);if(ec){ec.top=top;ec.left=left;ec.width=width;ec.height=height;}
          _dpFire(nc);this._update();
        });
      }
      for(const g of(c.gauges||[])){
        const el=this._gaugeEls[g.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const gc=this._roomArr(nc,'gauges').find(x=>x.id===g.id);if(gc){gc.top=top;gc.left=left;gc.width=width;gc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      // Keyboard nudge — click to select, arrows to nudge, Escape to deselect
      const _tmOutline=(type)=>type==='zone'?'3px solid red':'';
      const _selectTM=(el,type,id)=>{
        if(this._selectedTM){this._selectedTM.el.style.outline=_tmOutline(this._selectedTM.type);this._selectedTM.el.style.outlineOffset='';}
        el.style.outline='2px dashed var(--primary-color,#03a9f4)';
        el.style.outlineOffset='2px';
        this._selectedTM={el,type,id};
      };
      const _deselectTM=()=>{if(this._selectedTM){this._selectedTM.el.style.outline=_tmOutline(this._selectedTM.type);this._selectedTM.el.style.outlineOffset='';this._selectedTM=null;}};
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
          const nc=JSON.parse(JSON.stringify(this._config));
          const arr=type==='zone'?this._roomArr(nc,'zones'):type==='icon'?this._roomArr(nc,'icons'):this._roomArr(nc,'labels');
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
          const nc=JSON.parse(JSON.stringify(drawSelf._config));
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
    if(window.ResizeObserver){
      if(this._ro)this._ro.disconnect();
      const self=this;
      this._ro=new ResizeObserver(function(){if(self._rendered&&self._hass&&self._visible)self._update();});
      this._ro.observe(this);
    }
    const _ex=this._extractEntities(this._config);
    const _reCfg=cAll.room_entity;
    if(typeof _reCfg==='string')_ex.ids.add(_reCfg);
    else if(_reCfg&&typeof _reCfg==='object'){
      if(_reCfg.default)_ex.ids.add(_reCfg.default);
      for(const k in(_reCfg.by_user||{}))_ex.ids.add(_reCfg.by_user[k]);
      for(const k in(_reCfg.by_browser||{}))_ex.ids.add(_reCfg.by_browser[k]);
    }
    for(const ch of this._navChipEls)if(ch.entity)_ex.ids.add(ch.entity);
    this._relevantEntities=[..._ex.ids];
    this._relevantAttrSources=[...this._extractAttrSources(this._config),...[..._ex.attrs].map(s=>{const i=s.indexOf(' ');return{entity:s.slice(0,i),attr:s.slice(i+1)};})];
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
      const el=hlSelf.shadowRoot.querySelector(pre+d.id+'"]');
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

  _switchRoom(idx,dir,manual){
    const cAll=this._config;
    if(!Array.isArray(cAll.rooms)||idx<0||idx>=cAll.rooms.length||idx===this._roomIdx)return;
    if(manual)this._manualHoldUntil=Date.now()+((cAll.follow_hold??60)*1000);
    if(Math.abs(idx-this._roomIdx)>1)dir=0; // non-adjacent → crossfade
    // Ghost of the old room for the transition (embedded cards render blank in
    // the clone for ~0.3 s — acceptable)
    const oldContent=this.shadowRoot?this.shadowRoot.querySelector('.wrap .content'):null;
    let ghost=null;
    if(oldContent){
      ghost=oldContent.cloneNode(true);
      ghost.style.position='absolute';ghost.style.inset='0';ghost.style.zIndex='600';
      ghost.style.pointerEvents='none';
      ghost.style.transition='transform .3s ease,opacity .3s ease';
    }
    this._roomIdx=idx;
    this._rendered=false;
    this._render();
    const wrap=this.shadowRoot.querySelector('.wrap');
    const ncontent=this.shadowRoot.querySelector('.content');
    if(ghost&&wrap&&ncontent){
      wrap.appendChild(ghost);
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
    this._syncRoomState();
  }

  _startCamera(){
    if(this._camTimer){clearInterval(this._camTimer);this._camTimer=null;}
    const c=this._config;if(!c.base_camera)return;
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
    if(!this._hass||!this._hass.connection)return;
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
    const queue=function(){if(!raf)raf=requestAnimationFrame(apply);};
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
        const nr=self._config.rooms[(self._roomIdx+dir2+n)%n];
        prev=document.createElement('div');
        prev.style.cssText='position:absolute;inset:0;z-index:590;pointer-events:none;background-size:cover;background-position:center;'+(nr&&nr.base_image?'background-image:url("'+String(nr.base_image).replace(/"/g,'%22')+'");':'background:#000;');
        wrap.appendChild(prev);
        const ct=content();if(ct)ct.style.transition='none';
      }
      e.preventDefault();
      const ndir=dx<0?1:-1;
      if(ndir!==dir2&&prev){ // direction flipped mid-drag → swap neighbour preview
        dir2=ndir;
        const n=self._config.rooms.length;
        const nr=self._config.rooms[(self._roomIdx+dir2+n)%n];
        prev.style.backgroundImage=nr&&nr.base_image?'url("'+String(nr.base_image).replace(/"/g,'%22')+'")':'';
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
          self._switchRoom(ni,0,true); // re-render under the settled preview
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
      active=false;engaged=false;self._roomDragActive=false;self._lastRoomDragEnd=Date.now();
    });
    // Swallow the click that follows a drag (capture phase beats zone handlers)
    wrap.addEventListener('click',function(e){if(moved){moved=false;e.stopImmediatePropagation();e.preventDefault();}},true);
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
      const mn=sl.min??0,mx=sl.max??100;
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
      if(sl.live){const now=Date.now();if(now-lastSent>250){lastSent=now;apply(pct);}}
    });
    el.addEventListener('pointerup',function(e){
      if(!active)return;
      active=false;
      if(moved){el._rocSlid=true;e.stopPropagation();apply(pct);setTimeout(function(){el._rocSlid=false;},400);}
      setTimeout(function(){fill.style.opacity='0';},250);
    });
    el.addEventListener('pointercancel',function(){active=false;fill.style.opacity='0';});
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
      h.style.cssText='position:absolute;'+hd.p+';width:10px;height:10px;background:var(--primary-color,#03a9f4);border:2px solid #fff;border-radius:2px;z-index:1000;cursor:'+hd.c+';box-sizing:border-box;pointer-events:auto;';
      el.appendChild(h);
      h.addEventListener('mousedown',function(e){
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
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);onResize(el.style.top,el.style.left,el.style.width,el.style.height);}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
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

  _update(){
    if(!this._hass||!this._config||!this._rendered)return;
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
    // Re-render when the active responsive tier changes (resize/rotation/column change)
    const _rtNow=rocTier(this.offsetWidth,c);
    const _tierNow=(c.test_mode??false)?null:_rtNow;
    if(_tierNow!==this._tier||_rtNow!==this._vt){this._rendered=false;this._render();return;}
    // Live width/tier readout in test mode (updates on resize without re-render)
    if(this._tmInfoEl)this._tmInfoEl.innerHTML='&#128208; '+Math.round(this.offsetWidth)+' px<br><span style="font-weight:normal;opacity:0.85;">tier: '+rocTier(this.offsetWidth,c)+'</span>';
    // Re-render when nav position: auto flips between top and side rail
    if(Array.isArray(cAll.rooms)&&cAll.rooms.length>1&&(cAll.nav&&cAll.nav.position)==='auto'&&this.offsetWidth>0){
      const _wantPos=this.offsetWidth>=((cAll.nav&&cAll.nav.auto_breakpoint)??1100)?'left':'top';
      if(_wantPos!==this._navPos){this._rendered=false;this._render();return;}
    }
    const flipped=(c.test_mode??false)&&this._testFlipped;
    if(this._baseEl){
      let _bf;
      const _bm=c.brightness_model;
      if(_bm&&_bm.source?.length&&_bm.filter_gradient?.length&&!flipped){
        let _pct=null;
        for(const _src of _bm.source){
          if(_src.condition&&!evalCond(_src.condition,s))continue;
          const _ent=s[_src.entity];if(!_ent)continue;
          const _rv=_src.attribute!==undefined?parseFloat(_ent.attributes[_src.attribute]):parseFloat(_ent.state);
          if(isNaN(_rv))continue;
          const _mn=_src.min_input??0,_mx=_src.max_input??100;
          _pct=Math.max(0,Math.min(100,(_rv-_mn)/(_mx-_mn)*100));
          break;
        }
        _bf=_pct!==null?lerpFilterGradient(this._sortedBmFg||_bm.filter_gradient,_pct,!!this._sortedBmFg):'none';
      }else{
        _bf=c.filter_conditions?.length?(flipped?resolveFilterInverted(c.filter_conditions,s):resolveFilter(c.filter_conditions,s)):'none';
      }
      setSt(this._baseEl,'filter',_bf);
      // Conditional base image (static images only — base_camera drives its own refresh)
      if(c.base_image_conditions?.length&&!c.base_camera){
        let _bimg=c.base_image;
        for(const bc of c.base_image_conditions){
          if(bc.condition===undefined){_bimg=bc.image;continue;}
          if(evalCond(bc.condition,s)){_bimg=bc.image;break;}
        }
        if(_bimg){const _bbg='url(\''+_bimg+'\')';if(this._baseEl.style.backgroundImage!==_bbg)this._baseEl.style.backgroundImage=_bbg;}
      }
    }
    for(const ov of(c.overlays||[])){
      const el=this._ovEls[ov.id];if(!el)continue;
      const gShow=!ov.group||(this._groupState[ov.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      if(ov.visible_template!==undefined)setSt(el,'display',(this._tmplVis['o:'+ov.id]??true)?'':'none');
      const img=this._ovImg(ov);
      if(img){const bg='url(\''+img+'\')';if(el.style.backgroundImage!==bg)el.style.backgroundImage=bg;}
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
      const val=parseFloat(g.attribute!==undefined?ent.attributes[g.attribute]:ent.state);
      if(isNaN(val))continue;
      const mn=g.min??0,mx=g.max??100;
      const pct=Math.max(0,Math.min(1,(val-mn)/(mx-mn)));
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
    // Nav thumbnails — live filters + sensor chips
    if(Array.isArray(cAll.rooms)&&cAll.rooms.length){
      for(let ri=0;ri<cAll.rooms.length;ri++){
        const tEl=this._navThumbEls[ri];if(!tEl)continue;
        const r=cAll.rooms[ri];
        let tf='';
        if(r.filter_conditions?.length){const f=resolveFilter(r.filter_conditions,s);if(f&&f!=='none')tf=f;}
        setSt(tEl,'filter',tf);
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
    if(this._relevantEntities){
      for(const id of this._relevantEntities)this._prevStates[id]=s[id]?.state;
      if(this._relevantAttrSources)for(const a of this._relevantAttrSources)this._prevStates[a.entity+'.'+a.attr]=s[a.entity]?.attributes[a.attr];
    }
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
      case'navigate':{const p=a.navigation_path||a.path;if(p){history.pushState(null,'',p);window.dispatchEvent(new PopStateEvent('popstate'));}}break;
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
    this._teardownTemplates();
    if(this._ro){this._ro.disconnect();this._ro=null;}
    if(this._io){this._io.disconnect();this._io=null;}
  }

  connectedCallback(){
    // Re-attach observers & subscriptions after the element is moved back into the DOM
    if(this._rendered&&this._config){
      if(this._io)this._io.observe(this);
      if(this._ro)this._ro.observe(this);
      this._startCamera();
      if(!this._tmplUnsubs.length)this._setupTemplates();
      if(this._hlHandler)window.addEventListener('roc-highlight',this._hlHandler);
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
  constructor(){super();this._config=null;this._hass=null;this._rocPosHandler=null;this._fdT=null;this._openPanels=null;this._hist=[];this._histIdx=-1;this._histMuted=false;this._keysBound=false;this._editRoomIdx=0;this._prevOn=false;this._prevCard=null;}

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

  setConfig(cfg){
    const prev=this._config;
    this._config=cfg;
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
      dl.innerHTML=Object.keys(h.states).sort().map(function(id){return'<option value="'+id+'">';}).join('');
  }

  // Interactive preview inside the editor — a real card instance with
  // test_mode forced on, without touching the dashboard config
  _mountPreview(){
    const host=this.querySelector('#roc-prev-host');
    this._prevCard=null;
    if(!host||!this._prevOn)return;
    try{
      const el=document.createElement('room-overlay-card');
      const cfg=JSON.parse(JSON.stringify(this._config));
      cfg.test_mode=true;cfg._roc_preview=true;
      el.setConfig(cfg);
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

  _collectConfig(){
    const c=Object.assign({},this._config);
    const self=this;
    const q=function(s){return this.querySelector(s);}.bind(this);
    const v=function(id,fb){const el=q('#'+id);return el?el.value:fb;};
    // Multi-room: sections write into the room being edited; shared keys stay top-level
    const hasRooms=Array.isArray(c.rooms)&&c.rooms.length>0;
    if(hasRooms)c.rooms=c.rooms.map(function(r){return Object.assign({},r);});
    const tgt=hasRooms?c.rooms[Math.max(0,Math.min(this._editRoomIdx,c.rooms.length-1))]:c;
    tgt.base_image=v('base_image',tgt.base_image||'');
    if(!tgt.base_image)delete tgt.base_image;
    const _bcam=v('base_camera','').trim();
    if(_bcam)tgt.base_camera=_bcam;else delete tgt.base_camera;
    const _bcr=parseFloat(v('camera_refresh',''));
    if(_bcam&&!isNaN(_bcr)&&_bcr>0&&_bcr!==10)tgt.camera_refresh=_bcr;else delete tgt.camera_refresh;
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
    const _mbp=parseFloat(v('mobile_breakpoint',''));
    if(!isNaN(_mbp)&&_mbp>0&&_mbp!==600)c.mobile_breakpoint=_mbp;else delete c.mobile_breakpoint;
    const _bpO={};['mobile','tablet','desktop'].forEach(function(k){const _bv=parseFloat(v('bp_'+k,''));if(!isNaN(_bv)&&_bv>0)_bpO[k]=_bv;});
    if(Object.keys(_bpO).length)c.breakpoints=_bpO;else delete c.breakpoints;
    const _zm=q('#zoom');
    if(_zm&&_zm.checked)c.zoom=true;else delete c.zoom;
    const _bicR=this._pYaml(this.querySelector('#base_image_conditions'));
    if(_bicR.ok){if(Array.isArray(_bicR.val))tgt.base_image_conditions=_bicR.val;else delete tgt.base_image_conditions;}
    // Per-tier objects (aspect_ratio/border_radius as {mobile,tablet,...}) are YAML-only
    // for now — preserve them instead of overwriting from the single text field.
    const _arOld=this._config.aspect_ratio;
    c.aspect_ratio=(_arOld&&typeof _arOld==='object')?_arOld:v('aspect_ratio','16/9');
    const _brOld=this._config.border_radius;
    c.border_radius=(_brOld&&typeof _brOld==='object')?_brOld:v('border_radius','12px');
    const _mhOld=this._config.max_height;
    if(_mhOld&&typeof _mhOld==='object')c.max_height=_mhOld;
    else{const _mhv=v('max_height','').trim();if(_mhv)c.max_height=_mhv;else delete c.max_height;}
    c.filter_transition=v('filter_transition','2s ease');
    const tm=q('#test_mode');c.test_mode=tm?tm.checked:false;
    const _taR=this._pYaml(q('#tap_action_yaml'));
    if(_taR.ok){if(_taR.val)tgt.tap_action=_taR.val;else delete tgt.tap_action;}

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
      const yaR=self._pYaml(q('[data-b-yaml="'+i+'"]'));
      if(yaR.ok){
        // The YAML textarea owns every key except those with dedicated fields —
        // keys removed from the textarea are removed from the config too.
        const KEEP=['id','icon','position','x','y','animation','animation_color'];
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
      return o;
    });

    tgt.icons=(tgt.icons||[]).map(function(ico,i){
      const o=Object.assign({},ico);
      const idEl=q('[data-ico-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const iconEl=q('[data-ico-icon="'+i+'"]');if(iconEl)o.icon=iconEl.value;
      const sizeEl=q('[data-ico-size="'+i+'"]');if(sizeEl)o.size=sizeEl.value||'20px';
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
        const KEEP=['id','top','left','entity','attribute','suffix','unit','color_gradient','animation','animation_color','group','template'];
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
      const minEl=q('[data-g-min="'+i+'"]');if(minEl){const _gmn=parseFloat(minEl.value);o.min=isNaN(_gmn)?0:_gmn;}
      const maxEl=q('[data-g-max="'+i+'"]');if(maxEl){const _gmx=parseFloat(maxEl.value);o.max=isNaN(_gmx)?100:_gmx;}const orientEl=q('[data-g-orient="'+i+'"]');if(orientEl&&orientEl.value&&orientEl.value!=='vertical')o.orientation=orientEl.value;else if(orientEl&&orientEl.value==='vertical')delete o.orientation;else delete o.orientation;
      const yaR=self._pYaml(q('[data-g-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','width','height','entity','attribute','min','max','color_gradient','animation','animation_color','alert_conditions','orientation','group'];
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
      const minEl=q('[data-bl-min="'+i+'"]');if(minEl){const _bmn=parseFloat(minEl.value);o.min=isNaN(_bmn)?0:_bmn;}
      const maxEl=q('[data-bl-max="'+i+'"]');if(maxEl){const _bmx=parseFloat(maxEl.value);o.max=isNaN(_bmx)?100:_bmx;}
      const typeEl=q('[data-bl-type="'+i+'"]');if(typeEl)o.blind_type=typeEl.value;else o.blind_type='roller';
      const scEl=q('[data-bl-slat-color="'+i+'"]');if(scEl&&scEl.value.trim())o.slat_color=scEl.value.trim();else delete o.slat_color;
      const scntEl=q('[data-bl-slat-count="'+i+'"]');if(scntEl&&scntEl.value)o.slat_count=parseInt(scntEl.value,10)||6;else delete o.slat_count;
      const swEl=q('[data-bl-slat-w="'+i+'"]');if(swEl&&swEl.value)o.slat_width=parseFloat(swEl.value)||7;else delete o.slat_width;
      const sgEl=q('[data-bl-slat-g="'+i+'"]');if(sgEl&&sgEl.value)o.slat_gap=parseFloat(sgEl.value)||6;else delete o.slat_gap;
      const gcEl=q('[data-bl-gap-color="'+i+'"]');if(gcEl&&gcEl.value.trim())o.gap_color=gcEl.value.trim();else delete o.gap_color;
      const yaR=self._pYaml(q('[data-bl-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','width','height','entity','attribute','min','max','z_index','blind_type','slat_color','slat_count','slat_width','slat_gap','gap_color','slat_pitch','group'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const blGrpEl=q('[data-bl-grp="'+i+'"]');if(blGrpEl&&blGrpEl.value.trim())o.group=blGrpEl.value.trim();else delete o.group;
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
      const navR=this._pYaml(q('#nav_yaml'));
      if(navR.ok){if(navR.val)c.nav=navR.val;else delete c.nav;}
    }

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
    const cpBl=Object.assign({},b);['id','top','left','width','height','entity','attribute','min','max','z_index','blind_type','slat_color','slat_count','slat_width','slat_gap','gap_color','slat_pitch','group'].forEach(function(k){delete cpBl[k];});
    const ysBl=Object.keys(cpBl).length?_yaml.s(cpBl):'';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">background / border_radius / transition / visible / visible_conditions (YAML)</label>';
    h+='<textarea data-bl-yaml="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ysBl)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-bl-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(b.group||'')+'"'+this._inp('')+'></div>';
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
    const sec=function(id,label,count,inner){
      const isOpen=open.has(id)||(firstRender&&id==='basic');
      return '<details data-panel="'+id+'"'+(isOpen?' open':'')+' style="margin-bottom:8px;">'
        +'<summary style="cursor:pointer;padding:10px 12px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;justify-content:space-between;">'
        +'<span>'+label+(count!==undefined?' ('+count+')':'')+'</span>'
        +'<ha-icon icon="mdi:chevron-down" style="--mdc-icon-size:18px;"></ha-icon>'
        +'</summary>'
        +'<div style="padding:12px;border:1px solid var(--divider-color);border-top:none;border-radius:0 0 6px 6px;margin-top:-1px;">'+inner+'</div>'
        +'</details>';
    };

    const btnStyle='padding:6px 14px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:13px;';

    let basicInner='<div style="display:grid;gap:8px;">';
    basicInner+='<div><label class="roc-l">Base image URL *</label><input id="base_image" type="text" value="'+this._e(cR.base_image||'')+'"'+this._inp('')+'></div>';
    const _bicYaml=cR.base_image_conditions?_yaml.s(cR.base_image_conditions):'';
    basicInner+='<div><label class="roc-l">Base image conditions (optional — swap image by entity state)</label><textarea id="base_image_conditions" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_bicYaml)+'</textarea></div>';
    basicInner+='<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;">';
    basicInner+='<div><label class="roc-l">Base camera (optional — live snapshot as background)</label><input id="base_camera" type="text" list="roc-entities" placeholder="camera.living_room" value="'+this._e(cR.base_camera||'')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label class="roc-l">Camera refresh (s)</label><input id="camera_refresh" type="number" min="2" step="1" value="'+(cR.camera_refresh??10)+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    const _woEd=typeof cR.weather_overlay==='string'?{entity:cR.weather_overlay}:(cR.weather_overlay||{});
    basicInner+='<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;">';
    basicInner+='<div><label class="roc-l">Weather overlay entity (optional — rain/snow effect)</label><input id="weather_entity" type="text" list="roc-entities" placeholder="weather.home" value="'+this._e(_woEd.entity||'')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label class="roc-l">Effect</label><select id="weather_effect"'+this._inp('')+'>';
    ['auto','rain','rain-heavy','snow','snow-heavy','fog','lightning'].forEach(function(ef){basicInner+='<option value="'+ef+'"'+((_woEd.effect||'auto')===ef?' selected':'')+'>'+ef+'</option>';});
    basicInner+='</select></div>';
    basicInner+='<div><label class="roc-l">Opacity</label><input id="weather_opacity" type="number" step="0.05" min="0" max="1" value="'+(_woEd.opacity??0.45)+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    basicInner+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:center;">';
    basicInner+='<div><label class="roc-l">Filter transition</label><input id="filter_transition" type="text" value="'+this._e(c.filter_transition||'2s ease')+'"'+this._inp('')+'></div>';
    basicInner+='<div style="display:flex;align-items:center;gap:8px;padding-top:18px;"><input id="zoom" type="checkbox"'+(c.zoom?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:13px;cursor:pointer;" for="zoom">Pan &amp; pinch-zoom (floorplan mode)</label></div>';
    basicInner+='</div>';
    basicInner+='<div><label class="roc-l">tap_action (YAML)</label><textarea id="tap_action_yaml" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
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
    bmInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:6px 0 0;">Source value is normalized to 0–100 % and interpolated across stops. When defined, replaces filter_conditions.</p>';
    bmInner+='</div>';

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
      roomsInner+='<span style="display:flex;gap:8px;flex:none;"><button id="add-room" style="'+btnStyle+'">+ Room</button><button id="rm-room" style="padding:6px 14px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:13px;">Remove</button></span>';
      roomsInner+='</div>';
      roomsInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
      roomsInner+='<div><label class="roc-l">Room id</label><input id="room-id" type="text" value="'+this._e(er.id||'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Name</label><input id="room-name" type="text" value="'+this._e(er.name||'')+'"'+this._inp('')+'></div>';
      roomsInner+='<div><label class="roc-l">Icon (tabs nav)</label><input id="room-icon" type="text" placeholder="mdi:sofa" value="'+this._e(er.icon||'')+'"'+this._inp('')+'></div>';
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
      const _navY=c.nav?_yaml.s(c.nav):'';
      roomsInner+='<div><label class="roc-l">nav (YAML — style, position, height, width (css|auto), chips, cards (placement: start|end), follow_button)</label><textarea id="nav_yaml" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_navY)+'</textarea></div>';
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
    // Responsive tab — breakpoint thresholds (per-tier aspect/max_height stay in Image for now)
    const _bp=c.breakpoints||{};
    let respInner='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;line-height:1.5;">Tiers follow the card’s own width (its dashboard column), not the screen resolution. Each breakpoint is the upper bound in px; <b>ultrawide</b> is everything above the last. Turn on <b>Test mode</b> (header) to see a live width + tier badge on the card.</p>';
    respInner+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">';
    respInner+='<div><label class="roc-l">Mobile below (px)</label><input id="bp_mobile" type="number" min="0" step="10" placeholder="600" value="'+this._e(_bp.mobile!=null?String(_bp.mobile):'')+'"'+this._inp('')+'></div>';
    respInner+='<div><label class="roc-l">Tablet below</label><input id="bp_tablet" type="number" min="0" step="10" placeholder="1024" value="'+this._e(_bp.tablet!=null?String(_bp.tablet):'')+'"'+this._inp('')+'></div>';
    respInner+='<div><label class="roc-l">Desktop below</label><input id="bp_desktop" type="number" min="0" step="10" placeholder="1600" value="'+this._e(_bp.desktop!=null?String(_bp.desktop):'')+'"'+this._inp('')+'></div>';
    respInner+='<div><label class="roc-l">Legacy mobile_bp</label><input id="mobile_breakpoint" type="number" min="0" step="10" placeholder="600" value="'+(c.mobile_breakpoint!=null?c.mobile_breakpoint:'')+'"'+this._inp('')+'></div>';
    respInner+='</div>';
    const _arObj=c.aspect_ratio&&typeof c.aspect_ratio==='object';
    const _arShow=_arObj?ROC_TIERS.map(function(tt){return c.aspect_ratio[tt]?tt+': '+c.aspect_ratio[tt]:'';}).filter(Boolean).join('   '):(c.aspect_ratio||'16/9');
    respInner+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    respInner+='<div><label class="roc-l">Aspect ratio'+(_arObj?' (per-tier — edit in YAML)':'')+'</label><input id="aspect_ratio" type="text"'+(_arObj?' disabled':'')+' placeholder="16/9 or {mobile: 4/3, ultrawide: 21/9}" value="'+this._e(_arShow)+'"'+this._inp('')+'></div>';
    const _brObj=c.border_radius&&typeof c.border_radius==='object';
    respInner+='<div><label class="roc-l">Border radius'+(_brObj?' (per-tier)':'')+'</label><input id="border_radius" type="text"'+(_brObj?' disabled':'')+' value="'+this._e(_brObj?'per-tier in YAML':(c.border_radius||'12px'))+'"'+this._inp('')+'></div>';
    respInner+='</div>';
    const _mhObj=c.max_height&&typeof c.max_height==='object';
    respInner+='<div style="margin-bottom:8px;"><label class="roc-l">Max height (caps &amp; centers the image on wide screens; e.g. 70vh or 600px)'+(_mhObj?' — per-tier in YAML':'')+'</label><input id="max_height" type="text"'+(_mhObj?' disabled':'')+' placeholder="e.g. 70vh" value="'+this._e(_mhObj?'per-tier in YAML':(c.max_height||''))+'"'+this._inp('')+'></div>';
    respInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0;line-height:1.5;">Want a different shape per device? Set these as per-tier objects in YAML, e.g. <code>aspect_ratio: {mobile: 4/3, tablet: 16/10, desktop: 16/9, ultrawide: 21/9}</code> — the field then shows “per-tier in YAML” and locks. Dedicated per-tier inputs are coming.</p>';
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
      +_tabBtn('responsive','mdi:monitor-cellphone','Responsive')
      +_tabBtn('rooms','mdi:floor-plan','Rooms &amp; menu')
      +'</div>'
      +_panel('image',
          sec('basic','Background &amp; basics'+(hasRooms?' — room: '+this._e(cR.name||cR.id||''):''),undefined,basicInner)
         +sec('filters','Base image filters',(cR.filter_conditions||[]).length,filterInner)
         +sec('brightness','Brightness model (smooth filter)',(bm.source?.length||0)+(bm.filter_gradient?.length||0),bmInner))
      +_panel('elements',
          sec('zones','Zones — invisible tap areas',(cR.zones||[]).length,zInner)
         +sec('icons','Icons — state-aware mdi icons',(cR.icons||[]).length,icoInner)
         +sec('labels','Labels — entity values as text',(cR.labels||[]).length,lblInner)
         +sec('badges','Badges — pill chips',(cR.badges||[]).length,bInner)
         +sec('gauges','Gauges — bar / radial meters',(cR.gauges||[]).length,gInner)
         +sec('blinds','Blinds — window covers',(cR.blinds||[]).length,blInner)
         +sec('elements','Embedded HA cards',(cR.elements||[]).length,elInner)
         +sec('overlays','Overlay image layers',(cR.overlays||[]).length,ovInner)
         +sec('groups','Groups — pop-up control panels',(cR.groups||[]).length,grpInner))
      +_panel('responsive',respInner)
      +_panel('rooms',roomsInner);
    const _dlOpts=this._hass?Object.keys(this._hass.states).sort().map(id=>'<option value="'+id+'">').join(''):'';
    this.innerHTML='<datalist id="roc-entities">'+_dlOpts+'</datalist>'
      +'<style>.roc-ed .roc-in{width:100%;padding:6px;border-radius:4px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box;}.roc-ed .roc-l{font-size:12px;display:block;margin-bottom:4px;}</style>'
      +'<div class="roc-ed" style="padding:8px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px 8px;"><span style="font-weight:600;font-size:13px;">Room Overlay Card</span>'
      +'<span style="display:flex;gap:6px;align-items:center;">'
      +'<button id="roc-undo" title="Undo (Ctrl+Z)"'+(this._histIdx>0?'':' disabled')+' style="padding:2px 9px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:14px;line-height:1.3;'+(this._histIdx>0?'':'opacity:0.4;cursor:default;')+'">&#8630;</button>'
      +'<button id="roc-redo" title="Redo (Ctrl+Y)"'+(this._histIdx<this._hist.length-1?'':' disabled')+' style="padding:2px 9px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:14px;line-height:1.3;'+(this._histIdx<this._hist.length-1?'':'opacity:0.4;cursor:default;')+'">&#8631;</button>'
      +'<span style="font-size:11px;color:var(--secondary-text-color);margin-left:4px;">v'+ROC_VERSION+'</span></span></div>'
      +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:0 4px 8px;">'
      +(hasRooms?'<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--secondary-text-color);">Room <select id="room-select" style="padding:5px 8px;border-radius:6px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer;font-size:13px;">'+c.rooms.map(function(r,i){return '<option value="'+i+'"'+(i===self._editRoomIdx?' selected':'')+'>'+self._e(r.name||r.id||('room_'+(i+1)))+'</option>';}).join('')+'</select></span>':'')
      +'<label style="display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;color:var(--secondary-text-color);"><input id="test_mode" type="checkbox"'+(c.test_mode?' checked':'')+' style="width:16px;height:16px;cursor:pointer;">Test mode</label>'
      +'<label for="prev-on" style="display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;color:var(--secondary-text-color);"><input id="prev-on" type="checkbox"'+(this._prevOn?' checked':'')+' style="width:16px;height:16px;cursor:pointer;">Interactive preview</label>'
      +'</div>'
      +(this._prevOn?'<div id="roc-prev-host" style="margin:0 4px 10px;border:1px solid var(--divider-color);border-radius:8px;overflow:hidden;"></div>':'')
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
    // Responsive tab — breakpoint fields save on change
    this.querySelectorAll('#bp_mobile,#bp_tablet,#bp_desktop').forEach(function(el){
      el.addEventListener('change',function(){self._fire(self._collectConfig());});
    });

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
    this._listen();
    this._bindHassComponents();
    this._mountPreview();
    // Position updates from card drag/keyboard — relay through editor so HA saves correctly
    if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);this._rocPosHandler=null;}
    if(c.test_mode||this._prevOn){
      this._rocPosHandler=this._makeRocPosHandler();
      window.addEventListener('roc-pos-update',this._rocPosHandler);
    }
  }

  _makeRocPosHandler(){
    const self=this;
    return function(e){
      const nc=e.detail&&e.detail.config;
      if(!nc)return;
      // Only accept updates from "our" card (two cards in test mode = cross-talk)
      if(cfgKey(nc)!==cfgKey(self._config))return;
      // Updates from the embedded editor preview carry forced flags — strip them
      if(nc._roc_preview){
        delete nc._roc_preview;
        if(!self._config.test_mode)delete nc.test_mode;
      }
      self._config=nc;
      self._render(); // refresh position inputs, otherwise the next edit reverts the drag
      self._fire(nc);
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
    if(roomSel)roomSel.addEventListener('change',function(){self._editRoomIdx=parseInt(roomSel.value)||0;self._render();});
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
    const convRooms=this.querySelector('#conv-rooms');
    if(convRooms)convRooms.addEventListener('click',function(){self._convertToRooms();});
    ['room-id','room-name','room-icon','room-area-match','room-chips','room_entity','follow_hold','card_id','nav_yaml','follow_mode','room_state_entity'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
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

    ['base_image','aspect_ratio','border_radius','filter_transition','base_image_conditions','base_camera','camera_refresh','weather_entity','weather_effect','weather_opacity','mobile_breakpoint','zoom'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
    });
    const prevOnEl=this.querySelector('#prev-on');
    if(prevOnEl)prevOnEl.addEventListener('change',function(){self._prevOn=prevOnEl.checked;self._render();});
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
        // Re-register roc-pos-update listener — _render() is skipped by same-check when only test_mode toggles
        if(self._rocPosHandler){window.removeEventListener('roc-pos-update',self._rocPosHandler);self._rocPosHandler=null;}
        if(tm.checked){
          self._rocPosHandler=self._makeRocPosHandler();
          window.addEventListener('roc-pos-update',self._rocPosHandler);
        }
        fire();
      });
    }
    const ta=this.querySelector('#tap_action_yaml');if(ta)ta.addEventListener('change',fire);

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
    this.querySelectorAll('[data-bl-id],[data-bl-top],[data-bl-left],[data-bl-w],[data-bl-h],[data-bl-entity],[data-bl-attr],[data-bl-min],[data-bl-max],[data-bl-z],[data-bl-type],[data-bl-slat-color],[data-bl-slat-count],[data-bl-slat-w],[data-bl-slat-g],[data-bl-gap-color],[data-bl-yaml]').forEach(function(el){el.addEventListener('change',fire);});

    // Duplicate (clone) handlers
    function _cp(v,dflt){if(!v)return dflt||'3%';const n=parseFloat(v);return(!isNaN(n)&&String(v).trim().endsWith('%'))?Math.min(n+3,95).toFixed(1)+'%':v;}
    this.querySelectorAll('[data-dup-ico]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupIco),c=self._collectConfig();const dA=A(c,'icons');if(!dA[i])return;const cl=JSON.parse(JSON.stringify(dA[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-lbl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupLbl),c=self._collectConfig();const dA=A(c,'labels');if(!dA[i])return;const cl=JSON.parse(JSON.stringify(dA[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-g]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupG),c=self._collectConfig();const dA=A(c,'gauges');if(!dA[i])return;const cl=JSON.parse(JSON.stringify(dA[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-bl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupBl),c=self._collectConfig();const dA=A(c,'blinds');if(!dA[i])return;const cl=JSON.parse(JSON.stringify(dA[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-el]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupEl),c=self._collectConfig();const dA=A(c,'elements');if(!dA[i])return;const cl=JSON.parse(JSON.stringify(dA[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-z]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupZ),c=self._collectConfig();const dA=A(c,'zones');if(!dA[i])return;const cl=JSON.parse(JSON.stringify(dA[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});

    // Group fields on elements
    this.querySelectorAll('[data-ico-grp],[data-lbl-grp],[data-g-grp],[data-bl-grp],[data-el-grp]').forEach(function(el){el.addEventListener('change',fire);});

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
