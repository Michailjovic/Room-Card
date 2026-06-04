/**
 * room-overlay-card v1.2.7 — MIT License
 * https://github.com/Michailjovic/Room-Card
 */
window.customCards=window.customCards||[];
window.customCards.push({type:'room-overlay-card',name:'Room Overlay Card',description:'Room visualization with image layers, transitions and clickable zones',preview:true});

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

function lerpFilterGradient(stops,pct){
  if(!stops||!stops.length)return 'none';
  const ss=stops.slice().sort((a,b)=>a.value-b.value);
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
function lerpColorGradient(stops,val){if(!stops||!stops.length)return'white';const s=stops.slice().sort((a,b)=>a.value-b.value);if(val<=s[0].value)return s[0].color;if(val>=s[s.length-1].value)return s[s.length-1].color;for(let i=0;i<s.length-1;i++){if(val>=s[i].value&&val<=s[i+1].value){const t=(val-s[i].value)/(s[i+1].value-s[i].value);const c1=parseCssColor(s[i].color),c2=parseCssColor(s[i+1].color);if(!c1||!c2)return s[i].color;return'rgb('+Math.round(c1[0]+(c2[0]-c1[0])*t)+','+Math.round(c1[1]+(c2[1]-c1[1])*t)+','+Math.round(c1[2]+(c2[2]-c1[2])*t)+')';}}return s[s.length-1].color;}

const BPOS={'bottom-left':'bottom:10px;left:10px','bottom-right':'bottom:10px;right:10px','top-left':'top:10px;left:10px','top-right':'top:10px;right:10px'};

function makeBadgePos(b){
  if(b.position==='custom')return 'top:'+(b.y||'auto')+';left:'+(b.x||'auto')+';';
  return BPOS[b.position||'bottom-left']||BPOS['bottom-left'];
}

function makeHACard(cfg){
  if(!cfg?.type)return null;
  const name=cfg.type.startsWith('custom:')?cfg.type.substring(7):`hui-${cfg.type}-card`;
  let el;
  try{el=document.createElement(name);}catch(e){console.error('[room-overlay-card] createElement failed:',name,e);return null;}
  const apply=()=>{if(typeof el.setConfig==='function')try{el.setConfig(cfg);}catch(e){console.error('[room-overlay-card] setConfig failed:',cfg.type,e);}};
  customElements.get(name)?apply():customElements.whenDefined(name).then(apply);
  return el;
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
  }

  static getStubConfig(){return{base_image:'/local/room.webp',aspect_ratio:'16/9',border_radius:'12px',filter_conditions:[],overlays:[],zones:[],badges:[],elements:[],icons:[],test_mode:false,labels:[],gauges:[]};}

  setConfig(cfg){
    if(!cfg.base_image)throw new Error('[room-overlay-card] base_image is required');
    this._config=cfg;this._rendered=false;if(this._hass)this._render();
  }

  set hass(h){
    this._hass=h;if(!this._config)return;
    if(!this._rendered){this._render();return;}
    if(!this._visible)return;
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

  _extractEntities(obj,ids=new Set()){
    if(!obj||typeof obj!=='object')return ids;
    if(typeof obj.entity==='string')ids.add(obj.entity);
    for(const v of Object.values(obj)){
      if(Array.isArray(v))v.forEach(i=>this._extractEntities(i,ids));
      else if(v&&typeof v==='object')this._extractEntities(v,ids);
    }
    return ids;
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
    let holdTimer=null,held=false,tapTimer=null,lastTapTime=0;
    const self=this;
    const onTap=function(e){
      if(held){if(holdAction)self._exec(holdAction,e);held=false;return;}
      if(doubleTapAction){
        const now=Date.now();
        if(now-lastTapTime<350&&tapTimer){
          clearTimeout(tapTimer);tapTimer=null;lastTapTime=0;
          self._exec(doubleTapAction,e);
        }else{
          lastTapTime=now;
          if(tapAction)tapTimer=setTimeout(function(){tapTimer=null;self._exec(tapAction,e);},350);
        }
      }else{
        if(tapAction)self._exec(tapAction,e);
      }
    };
    el.addEventListener('touchstart',function(){
      held=false;clearTimeout(holdTimer);
      if(holdAction)holdTimer=setTimeout(function(){held=true;},delay);
    },{passive:true});
    el.addEventListener('touchend',function(e){
      clearTimeout(holdTimer);e.stopPropagation();e.preventDefault();onTap(e);
    });
    el.addEventListener('touchmove',function(){clearTimeout(holdTimer);},{passive:true});
    el.addEventListener('touchcancel',function(){clearTimeout(holdTimer);held=false;});
    el.addEventListener('mousedown',function(){
      held=false;clearTimeout(holdTimer);
      if(holdAction)holdTimer=setTimeout(function(){held=true;},delay);
    });
    el.addEventListener('click',function(e){
      clearTimeout(holdTimer);e.stopPropagation();e.preventDefault();onTap(e);
    });
    el.addEventListener('mouseleave',function(){clearTimeout(holdTimer);held=false;});
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
    const c=this._config,tm=c.test_mode??false;
    const pad=this._pad(c.aspect_ratio),br=c.border_radius??'12px';

    // Inicializace group state — zachovat existující stav, přidat nové skupiny
    const _prevGS=this._groupState||{};
    this._groupState={};
    for(const g of(c.groups||[])){
      this._groupState[g.id]=g.id in _prevGS?_prevGS[g.id]:(g.visible??false);
    }
    // Reset keyboard handler from previous render
    if(this._tmKeyHandler){document.removeEventListener('keydown',this._tmKeyHandler);this._tmKeyHandler=null;}
    this._selectedTM=null;

    const ovHtml=(c.overlays||[]).map((ov,i)=>`<div class="layer ov" data-ov="${ov.id}" style="z-index:${ov.z_index??i+1};opacity:0;transition:opacity ${ov.transition??'2s ease'},filter ${ov.transition??'2s ease'};will-change:opacity,transform;transform:translateZ(0);"></div>`).join('');
    const zHtml=(c.zones||[]).map(z=>`<div class="zone" data-z="${z.id}" style="top:${z.top};left:${z.left};width:${z.width};height:${z.height};z-index:50;cursor:${(z.tap_action||z.hold_action||z.double_tap_action)?'pointer':'default'};box-sizing:border-box;-webkit-tap-highlight-color:transparent;${tm?'outline:3px solid red;background:rgba(255,0,0,0.08);':''}" title="${tm?`[${z.id}] ${z.top} ${z.left} ${z.width}x${z.height}`:''}">${tm?`<span class="zlabel">${z.id}</span>`:''}</div>`).join('');
    const bHtml=(c.badges||[]).map(b=>{let animSt='';if(b.animation==='blink')animSt='animation:roc-blink 1s step-end infinite;';else if(b.animation==='pulse'){if(b.animation_color)animSt='--roc-ac:'+b.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else animSt='animation:roc-pulse 2s ease-in-out infinite;';}return'<div class="badge" data-b="'+b.id+'" style="'+makeBadgePos(b)+';cursor:'+(b.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;'+animSt+'">'+(b.icon?'<ha-icon data-bi="'+b.id+'" icon="'+b.icon+'" style="color:white;--mdc-icon-size:14px;width:14px;height:14px;display:flex;"></ha-icon>':'')+(b.label!==undefined?'<span class="blabel" data-bl="'+b.id+'"></span>':'')+'</div>';}).join('');
    const _cardW=this.offsetWidth||300;
    const icoHtml=(c.icons||[]).map(ico=>{const sz=resolveSize(ico.size||'20px',_cardW);const _ibg=ico.background?'background:'+ico.background+';border-radius:50%;padding:7px;box-sizing:content-box;':'';return'<div class="ico" data-ico="'+ico.id+'" style="position:absolute;top:'+ico.top+';left:'+ico.left+';z-index:'+(ico.z_index??6)+';cursor:'+(ico.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;'+_ibg+'"><ha-icon data-icoicon="'+ico.id+'" icon="'+(ico.icon||'')+'" style="--mdc-icon-size:'+sz+';width:'+sz+';height:'+sz+';display:flex;color:white;pointer-events:none;"></ha-icon></div>';}).join('');

    const lblHtml=(c.labels||[]).map(lbl=>{const fs=resolveSize(lbl.font_size,_cardW)||'clamp(8px,0.8vw,13px)';const ff=lbl.font_family||'monospace';const fw=lbl.font_weight||'bold';const bg=lbl.background||'';const pad=lbl.padding||'';const br=lbl.border_radius||'';const ts=lbl.text_shadow!==undefined?lbl.text_shadow:'0 1px 3px rgba(0,0,0,0.8)';let st='position:absolute;top:'+lbl.top+';left:'+lbl.left+';z-index:'+(lbl.z_index??6)+';pointer-events:none;font-size:'+fs+';font-family:'+ff+';font-weight:'+fw+';white-space:nowrap;color:white;';if(bg)st+='background:'+bg+';';if(pad)st+='padding:'+pad+';';if(br)st+='border-radius:'+br+';';if(ts)st+='text-shadow:'+ts+';';if(lbl.animation==='blink')st+='animation:roc-blink 1s step-end infinite;';else if(lbl.animation==='pulse'){if(lbl.animation_color)st+='--roc-ac:'+lbl.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else st+='animation:roc-pulse 2s ease-in-out infinite;';}return'<div class="lbl" data-lbl="'+lbl.id+'" style="'+st+'"></div>';}).join('');
    const grpHtml=(c.groups||[]).filter(g=>g.style).map(g=>{const st=g.style;const vis=this._groupState[g.id]??false;return'<div data-grp-panel="'+g.id+'" style="position:absolute;top:'+(st.top||'0')+';left:'+(st.left||'0')+';width:'+(st.width||'auto')+';height:'+(st.height||'auto')+';z-index:'+(st.z_index||49)+';background:'+(st.background||'transparent')+';border-radius:'+(st.border_radius||'0')+';pointer-events:none;display:'+(vis?'block':'none')+';"></div>';}).join('');

    const _allGaugesRC=[...(c.gauges||[]),...(c.blinds||[]).flatMap(blindToGaugeConfig)];const gaugeHtml=_allGaugesRC.map(g=>{const bg=g.background||'rgba(0,0,0,0.5)';const br=g.border_radius||'4px';const _gor=g.orientation||'vertical';const _ghoriz=_gor==='horizontal'||_gor==='right';const defTr=_ghoriz?'width 0.5s ease':'height 0.5s ease';const tr=g.transition||defTr;let fillSt;if(g._dayNight){const _dtr=g.transition||'height 0.5s ease';const _bgTr=_dtr.replace(/^\S+\s+/,'');fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:transparent;background-repeat:repeat;background-size:100% auto;transition:'+_dtr+',background-position-y '+_bgTr+';';}else if(_gor==='top')fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';else if(_gor==='right')fillSt='position:absolute;top:0;right:0;bottom:0;width:0%;background:white;transition:'+tr+';';else if(_gor==='horizontal')fillSt='position:absolute;top:0;left:0;bottom:0;width:0%;background:white;transition:'+tr+';';else fillSt='position:absolute;bottom:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';return'<div class="gauge" data-gauge="'+g.id+'" style="position:absolute;top:'+g.top+';left:'+g.left+';width:'+g.width+';height:'+g.height+';z-index:'+(g.z_index??6)+';pointer-events:none;background:'+bg+';border:1px solid rgba(255,255,255,0.12);border-radius:'+br+';overflow:hidden;"><div class="gfill" style="'+fillSt+'"></div></div>';}).join('');
    this.shadowRoot.innerHTML='<style>:host{display:block;}@keyframes roc-pulse{0%,100%{opacity:1}50%{opacity:.25}}@keyframes roc-glow{0%,100%{opacity:1;filter:drop-shadow(0 0 0px var(--roc-ac,transparent))}50%{opacity:.7;filter:drop-shadow(0 0 8px var(--roc-ac,rgba(255,0,0,.6)))}}@keyframes roc-blink{0%,49.9%{opacity:1}50%,100%{opacity:0}}@keyframes roc-border-pulse{0%,100%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8)),inset 0 0 8px var(--roc-ac,rgba(255,0,0,.3))}50%{box-shadow:inset 0 0 0 2px transparent,inset 0 0 0 transparent}}@keyframes roc-border-blink{0%,49.9%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8))}50%,100%{box-shadow:none}}ha-card{overflow:hidden;padding:0!important;background:transparent;border-radius:'+br+'}.wrap{position:relative;width:100%;padding-bottom:'+pad+';overflow:hidden;}.content{position:absolute;inset:0;overflow:hidden;}.layer{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;}.zone{position:absolute;}.zlabel{position:absolute;top:2px;left:4px;font-size:10px;color:red;font-weight:bold;pointer-events:none;text-shadow:0 0 3px white;white-space:nowrap;}.badge{position:absolute;z-index:100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px 10px;white-space:nowrap;user-select:none;}.blabel{font-size:12px;color:white;font-weight:500;}.elcont{position:absolute;pointer-events:auto;}.elcont>*{width:100%!important;height:100%!important;display:block;}</style><ha-card><div class="wrap"><div class="content"><div class="layer base" style="background-image:url(\''+c.base_image+'\');transition:filter '+(c.filter_transition??'2s ease')+';will-change:filter,transform;transform:translateZ(0);"></div>'+ovHtml+grpHtml+zHtml+bHtml+icoHtml+lblHtml+gaugeHtml+(tm?'<button class="tm-flip" style="position:absolute;top:6px;right:6px;z-index:200;background:'+(this._testFlipped?'rgba(220,80,0,0.9)':'rgba(0,0,0,0.72)')+';color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#8644; '+(this._testFlipped?'FLIPPED':'FLIP')+'</button><button class="tm-save" style="position:absolute;top:38px;right:6px;z-index:200;background:rgba(20,100,20,0.82);color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#128190; Save</button>':'')+'</div></div></ha-card>';

    const content=this.shadowRoot.querySelector('.content');
    this._baseEl=this.shadowRoot.querySelector('.base');
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
    }
    this._biconEls={};this._blabelEls={};
    for(const b of(c.badges||[])){
      this._biconEls[b.id]=this.shadowRoot.querySelector('[data-bi="'+b.id+'"]');
      this._blabelEls[b.id]=this.shadowRoot.querySelector('[data-bl="'+b.id+'"]');
      const bel=this.shadowRoot.querySelector('[data-b="'+b.id+'"]');
      if(bel&&b.tap_action){bel.addEventListener('click',e=>this._exec(b.tap_action,e));bel.addEventListener('touchend',e=>this._exec(b.tap_action,e));}
    }
    this._icoEls={};
    for(const ico of(c.icons||[])){
      const el=this.shadowRoot.querySelector('[data-ico="'+ico.id+'"]');
      if(!el)continue;this._icoEls[ico.id]=el;
      if(ico.tap_action)this._addZoneListeners(el,ico.tap_action,ico.hold_action,ico.double_tap_action,ico.hold_delay);
    }
    this._lblEls={};for(const lbl of(c.labels||[])){this._lblEls[lbl.id]=this.shadowRoot.querySelector('[data-lbl="'+lbl.id+'"]');}
    this._gaugeEls={};this._gaugeFills={};this._sortedGrads={};this._blindGaugeCfgs=(c.blinds||[]).flatMap(blindToGaugeConfig);for(const g of(c.gauges||[])){this._gaugeEls[g.id]=this.shadowRoot.querySelector('[data-gauge="'+g.id+'"]');if(this._gaugeEls[g.id])this._gaugeFills[g.id]=this._gaugeEls[g.id].querySelector('.gfill');if(g.color_gradient)this._sortedGrads[g.id]=g.color_gradient.slice().sort((a,b)=>a.value-b.value);}for(const bg of this._blindGaugeCfgs){this._gaugeEls[bg.id]=this.shadowRoot.querySelector('[data-gauge="'+bg.id+'"]');if(this._gaugeEls[bg.id])this._gaugeFills[bg.id]=this._gaugeEls[bg.id].querySelector('.gfill');if(bg.color_gradient)this._sortedGrads[bg.id]=bg.color_gradient.slice().sort((a,b)=>a.value-b.value);}
    this._cardEls={};this._contEls={};
    for(const el of(c.elements||[])){
      const cont=document.createElement('div');
      cont.className='elcont';cont.setAttribute('data-el',el.id);
      const _elVPos=el.bottom!==undefined?'bottom:'+el.bottom+';':'top:'+(el.top||'0')+';';
      const _elH=el.height?('height:'+el.height+';'):(el.bottom!==undefined?'height:auto;':'height:auto;');
      cont.style.cssText=_elVPos+'left:'+el.left+';width:'+el.width+';'+_elH+'z-index:'+(el.z_index??4)+';overflow:'+(el.overflow??'hidden')+';border-radius:'+(el.border_radius??'0')+';'+(tm?'outline:2px dashed blue;':'');
      if(tm)cont.title='[element] '+el.id;
      const card=makeHACard(el.card);
      if(card){if(this._hass)card.hass=this._hass;cont.appendChild(card);this._cardEls[el.id]=card;}
      this._contEls[el.id]=cont;if(content)content.appendChild(cont);
    }
    const hacard=this.shadowRoot.querySelector('ha-card');
    if(hacard&&c.tap_action){
      hacard.addEventListener('click',e=>{
        if(!e.composedPath().some(n=>n.classList?.contains('zone')||n.classList?.contains('elcont')||n.classList?.contains('ico')||n.classList?.contains('tm-flip')||n.classList?.contains('tm-save')))this._exec(c.tap_action,e);
      });
    }
    if(tm){
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

          function _showOverlay(){
            const existing=self.shadowRoot.querySelector('.tm-cfg-ov');
            if(existing){existing.remove();return;}
            const txt=window.YAML?window.YAML.stringify(cfg):JSON.stringify(cfg,null,2);
            const ov=document.createElement('div');
            ov.className='tm-cfg-ov';
            ov.style.cssText='position:absolute;inset:0;z-index:500;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;padding:10px;box-sizing:border-box;';
            const hdr=document.createElement('div');
            hdr.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
            hdr.innerHTML='<span style="color:#fff;font-size:11px;font-weight:bold;">&#128190; Config — press Ctrl+C to copy, paste in YAML editor</span><button style="background:none;border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;">&#x2715;</button>';
            const ta=document.createElement('textarea');
            ta.value=txt;ta.readOnly=true;
            ta.style.cssText='flex:1;width:100%;background:#111;color:#aef;border:1px solid rgba(255,255,255,0.15);border-radius:4px;font-family:monospace;font-size:11px;padding:8px;box-sizing:border-box;resize:none;';
            ov.appendChild(hdr);ov.appendChild(ta);
            self.shadowRoot.querySelector('.content').appendChild(ov);
            ta.focus();ta.select();
            if(navigator.clipboard)navigator.clipboard.writeText(txt).catch(function(){});
            try{document.execCommand('copy');}catch(_){}
            hdr.querySelector('button').addEventListener('click',function(ev){ev.stopPropagation();ov.remove();});
            ov.addEventListener('click',function(ev){if(ev.target===ov)ov.remove();});
          }

          // Direct HA Lovelace save via WebSocket (storage mode only)
          const conn=self._hass&&self._hass.connection;
          if(conn&&typeof conn.sendMessagePromise==='function'){
            // Extract dashboard url_path and view key from current URL
            // e.g. /lovelace/2  →  urlPath=null, viewKey='2'
            // e.g. /my-dash/living-room  →  urlPath='my-dash', viewKey='living-room'
            const _parts=window.location.pathname.split('/').filter(Boolean);
            const _urlPath=_parts[0]==='lovelace'?null:(_parts[0]||null);
            const _viewKey=_parts.length>1?_parts[_parts.length-1]:null;
            conn.sendMessagePromise({type:'lovelace/config',url_path:_urlPath})
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
                let found=false;
                function _walk(cards){
                  if(!Array.isArray(cards))return;
                  for(let i=0;i<cards.length;i++){
                    const card=cards[i];
                    if(card.type==='custom:room-overlay-card'&&card.base_image===self._config.base_image){
                      cards[i]=Object.assign({},self._config,{type:'custom:room-overlay-card'});
                      found=true;return;
                    }
                    if(card.cards)_walk(card.cards);
                    if(card.card)_walk([card.card]);
                  }
                }
                _walk(view.cards);
                if(!found)throw new Error('card_not_found_in_view');
                return conn.sendMessagePromise({type:'lovelace/config/save',url_path:_urlPath,config:nc});
              })
              .then(function(){
                saveBtn.innerHTML='&#10003; Saved!';saveBtn.style.background='rgba(0,140,0,0.9)';
                setTimeout(function(){saveBtn.innerHTML='&#128190; Save';saveBtn.style.background='rgba(20,100,20,0.82)';},2500);
              })
              .catch(function(err){
                console.warn('[room-overlay-card] Direct save failed ('+err.message+'), showing overlay');
                _showOverlay();
              });
          } else {
            _showOverlay();
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
          const zc=(nc.zones||[]).find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const ico of(c.icons||[])){
        const el=this._icoEls[ico.id];if(!el)continue;
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const ic=(nc.icons||[]).find(x=>x.id===ico.id);if(ic){ic.top=top;ic.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const lbl of(c.labels||[])){
        const el=this._lblEls[lbl.id];if(!el)continue;
        el.style.pointerEvents='auto';el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const lc=(nc.labels||[]).find(x=>x.id===lbl.id);if(lc){lc.top=top;lc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      // Resize handles — zones, elements, gauges
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const zc=(nc.zones||[]).find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;zc.width=width;zc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      for(const elCfg of(c.elements||[])){
        const cont=this._contEls[elCfg.id];if(!cont)continue;
        this._makeResizable(cont,(top,left,width,height)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const ec=(nc.elements||[]).find(x=>x.id===elCfg.id);if(ec){ec.top=top;ec.left=left;ec.width=width;ec.height=height;}
          _dpFire(nc);this._update();
        });
      }
      for(const g of(c.gauges||[])){
        const el=this._gaugeEls[g.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=JSON.parse(JSON.stringify(this._config));
          const gc=(nc.gauges||[]).find(x=>x.id===g.id);if(gc){gc.top=top;gc.left=left;gc.width=width;gc.height=height;}
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
          const arr=type==='zone'?nc.zones:type==='icon'?nc.icons:nc.labels;
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
    this._relevantEntities=[...this._extractEntities(this._config)];
    this._relevantAttrSources=this._extractAttrSources(this._config);
    this._prevStates={};
    this._rendered=true;
    this._preloadImages();
    this._update();
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
          if(hd.w!==0){const nw=Math.max(2,sw+hd.w*dx);el.style.width=nw.toFixed(1)+'%';if(hd.ml)el.style.left=(sl+dx).toFixed(1)+'%';}
          if(hd.h!==0){const nh=Math.max(2,sh+hd.h*dy);el.style.height=nh.toFixed(1)+'%';if(hd.mt)el.style.top=(st+dy).toFixed(1)+'%';}
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
      let moved=false;
      function onMove(e){
        const dx=e.clientX-startX,dy=e.clientY-startY;
        if(!moved&&Math.sqrt(dx*dx+dy*dy)<5)return;
        moved=true;e.preventDefault();e.stopPropagation();
        el.style.top=Math.max(0,Math.min(98,startTop+dy/rect.height*100)).toFixed(1)+'%';
        el.style.left=Math.max(0,Math.min(98,startLeft+dx/rect.width*100)).toFixed(1)+'%';
      }
      function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);if(moved){dragOccurred=true;onDrop(el.style.top,el.style.left);}}
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    el.addEventListener('touchstart',function(e){
      const cont=self.shadowRoot.querySelector('.content');if(!cont)return;
      const rect=cont.getBoundingClientRect();
      const t0=e.touches[0],startX=t0.clientX,startY=t0.clientY;
      const startTop=parseFloat(el.style.top)||0,startLeft=parseFloat(el.style.left)||0;
      let moved=false;
      function onTMove(e){const t=e.touches[0],dx=t.clientX-startX,dy=t.clientY-startY;if(!moved&&Math.sqrt(dx*dx+dy*dy)<5)return;moved=true;e.preventDefault();e.stopPropagation();el.style.top=Math.max(0,Math.min(98,startTop+dy/rect.height*100)).toFixed(1)+'%';el.style.left=Math.max(0,Math.min(98,startLeft+dx/rect.width*100)).toFixed(1)+'%';}
      function onTEnd(){el.removeEventListener('touchmove',onTMove);el.removeEventListener('touchend',onTEnd);if(moved){dragOccurred=true;onDrop(el.style.top,el.style.left);}}
      el.addEventListener('touchmove',onTMove,{passive:false});el.addEventListener('touchend',onTEnd);
    },{passive:true});
    // Suppress click after drag — capture phase fires before zone/icon tap listeners
    el.addEventListener('click',function(e){if(dragOccurred){e.stopImmediatePropagation();e.preventDefault();dragOccurred=false;}},true);
  }

  _update(){
    if(!this._hass||!this._config||!this._rendered)return;
    const s=this._hass.states,c=this._config;
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
        _bf=_pct!==null?lerpFilterGradient(_bm.filter_gradient,_pct):'none';
      }else{
        _bf=c.filter_conditions?.length?(flipped?resolveFilterInverted(c.filter_conditions,s):resolveFilter(c.filter_conditions,s)):'none';
      }
      this._baseEl.style.filter=_bf;
      // Conditional base image
      if(c.base_image_conditions?.length){
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
      const img=this._ovImg(ov);
      if(img){const bg='url(\''+img+'\')';if(el.style.backgroundImage!==bg)el.style.backgroundImage=bg;}
      const rawOp=ov.conditions?.opacity?Number(resolveVal(ov.conditions.opacity,s,0)):1;
      const showOp=flipped?String(rawOp>0.5?0:1):String(rawOp);if(parseFloat(showOp)>0&&ov.animation){el.style.animation='roc-'+ov.animation+' '+(ov.animation==='blink'?'1s step-end':'2s ease-in-out')+' infinite';el.style.opacity='';}else{el.style.animation='none';el.style.opacity=showOp;}
      el.style.filter=ov.conditions?.filter?resolveVal(ov.conditions.filter,s,'none'):'none';
    }
    // Group panels
    for(const g of(c.groups||[])){
      if(g.style&&this._grpPanelEls[g.id])this._grpPanelEls[g.id].style.display=(this._groupState[g.id]??false)?'block':'none';
    }
    for(const z of(c.zones||[])){
      const el=this._zoneEls[z.id];if(!el)continue;
      if(z.group&&!(this._groupState[z.group]??true)){el.style.display='none';continue;}
      el.style.display=(z.visible&&!evalCond(z.visible,s))?'none':'';
    }
    for(const b of(c.badges||[])){
      const bel=this.shadowRoot.querySelector('[data-b="'+b.id+'"]');
      if(bel&&b.group&&!(this._groupState[b.group]??true)){bel.style.display='none';continue;}
      if(bel&&b.visible)bel.style.display=evalCond(b.visible,s)?'flex':'none';
      const iel=this._biconEls[b.id];
      if(iel&&b.icon_color)iel.style.color=resolveVal(b.icon_color,s,'white');
      const lel=this._blabelEls[b.id];
      if(lel&&b.label){const t=resolveVal(b.label,s,'');if(lel.textContent!==t)lel.textContent=t;}
    }
    const _icoW=this.offsetWidth||300;
    for(const ico of(c.icons||[])){
      const el=this._icoEls[ico.id];if(!el)continue;
      if(ico.group&&!(this._groupState[ico.group]??true)){el.style.display='none';continue;}
      if(ico.visible)el.style.display=evalCond(ico.visible,s)?'flex':'none';
      else el.style.display='flex';
      const haicon=el.querySelector('ha-icon');
      if(haicon){
        const sz=resolveSize(ico.size||'20px',_icoW);
        haicon.style.setProperty('--mdc-icon-size',sz);haicon.style.width=sz;haicon.style.height=sz;
        if(ico.color)haicon.style.color=resolveVal(ico.color,s,'white');
      }
    }
    for(const el of(c.elements||[])){
      const card=this._cardEls[el.id],cont=this._contEls[el.id];
      if(cont&&el.group&&!(this._groupState[el.group]??true)){cont.style.display='none';continue;}
      let vis=true;
      if(cont&&el.visible){vis=evalCond(el.visible,s);cont.style.display=vis?'block':'none';}
      if(card&&vis)try{card.hass=this._hass;}catch(_){}
    }
    for(const lbl of(c.labels||[])){
      const el=this._lblEls[lbl.id];if(!el)continue;
      if(lbl.group&&!(this._groupState[lbl.group]??true)){el.style.display='none';continue;}
      const lblVis=lbl.visible_conditions!==undefined?lbl.visible_conditions:lbl.visible;if(lblVis!==undefined)el.style.display=evalCond(lblVis,s)?'block':'none';
      const ent=s[lbl.entity];if(!ent)continue;
      const rawVal=lbl.attribute!==undefined?ent.attributes[lbl.attribute]:ent.state;
      const numVal=parseFloat(rawVal);
      const dispVal=!isNaN(numVal)?(lbl.decimals!==undefined?numVal.toFixed(lbl.decimals):String(Math.round(numVal))):String(rawVal??'');
      const text=(lbl.prefix||'')+dispVal+(lbl.suffix||lbl.unit||'');
      if(el.textContent!==text)el.textContent=text;
      if(lbl.color_gradient){const _lv=parseFloat(lbl.attribute!==undefined?ent.attributes[lbl.attribute]:ent.state);if(!isNaN(_lv))el.style.color=lerpColorGradient(lbl.color_gradient,_lv);}else if(lbl.color)el.style.color=Array.isArray(lbl.color)?resolveVal(lbl.color,s,'white'):lbl.color;
    }
    const _allGaugesUp=[...(c.gauges||[]),...(this._blindGaugeCfgs||[])];
    for(const g of _allGaugesUp){
      const el=this._gaugeEls[g.id];if(!el)continue;
      if(g.group&&!(this._groupState[g.group]??true)){el.style.display='none';continue;}
      const gVis=g.visible_conditions!==undefined?g.visible_conditions:g.visible;
      if(gVis!==undefined)el.style.display=evalCond(gVis,s)?'block':'none';
      if(g.animation){const _gActive=g.alert_conditions?evalCond(g.alert_conditions,s):true;if(_gActive){if(g.animation_color)el.style.setProperty('--roc-ac',g.animation_color);else el.style.removeProperty('--roc-ac');el.style.animation=g.animation==='blink'?'roc-border-blink 1s step-end infinite':'roc-border-pulse 2s ease-in-out infinite';}else{el.style.animation='';el.style.removeProperty('--roc-ac');}}else if(el.style.animation){el.style.animation='';el.style.removeProperty('--roc-ac');}
      const ent=s[g.entity];if(!ent)continue;
      const val=parseFloat(g.attribute!==undefined?ent.attributes[g.attribute]:ent.state);
      if(isNaN(val))continue;
      const mn=g.min??0,mx=g.max??100;
      const pct=Math.max(0,Math.min(1,(val-mn)/(mx-mn)));
      const fill=this._gaugeFills[g.id];
      if(fill){if(g._dayNight){const _nDN=g._slat_count||6;const _perDN=el.offsetHeight/_nDN;if(_perDN>0){const _swDN=_perDN/2;const _scDN=g._slat_color;const _gradDN='repeating-linear-gradient(to bottom,'+_scDN+' 0px,'+_scDN+' '+_swDN+'px,transparent '+_swDN+'px,transparent '+_perDN+'px)';const _offDN=pct>=1?(_perDN/2):pct*_nDN*(_perDN/2);fill.style.height=(Math.round(pct*1000)/10)+'%';fill.style.backgroundImage=_gradDN+','+_gradDN;fill.style.backgroundPositionY='-'+_offDN+'px,0px';fill.style.backgroundRepeat='repeat';fill.style.backgroundSize='100% '+_perDN+'px';fill.style.backgroundColor='transparent';}}else{const _go=g.orientation||'vertical';if(_go==='horizontal')fill.style.width=(Math.round(pct*1000)/10)+'%';else if(_go==='right'){fill.style.width=(Math.round(pct*1000)/10)+'%';}else fill.style.height=(Math.round(pct*1000)/10)+'%';if(g.color_gradient)fill.style.background=lerpColorGradient(this._sortedGrads[g.id]||g.color_gradient,val);else if(g.color){const _gc=Array.isArray(g.color)?resolveVal(g.color,s,'white'):g.color;fill.style.background=_gc;}}}
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
    event.stopPropagation();event.preventDefault();
    const a=this._resolveAct(tapAction);
    switch(a.action){
      case'navigate':{const p=a.navigation_path||a.path;if(p){history.pushState(null,'',p);window.dispatchEvent(new PopStateEvent('popstate'));}}break;
      case'more-info':if(a.entity)this.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:a.entity}}));break;
      case'call-service':if(a.service){const d=a.service.indexOf('.');this._hass.callService(a.service.slice(0,d),a.service.slice(d+1),a.service_data??{});}break;
      case'browser-mod-popup':{const _bmData={title:a.title??'',size:a.size??'normal',content:a.content??{}};const _bmId=window.browser_mod?.browserID||window.browser_mod?.browser_id;if(_bmId)_bmData.browser_id=_bmId;this._hass.callService('browser_mod','popup',_bmData);}break;
      case'toggle':if(a.entity)this._hass.callService('homeassistant','toggle',{entity_id:a.entity});break;
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
    if(this._ro){this._ro.disconnect();this._ro=null;}
    if(this._io){this._io.disconnect();this._io=null;}
  }
}

customElements.define('room-overlay-card',RoomOverlayCard);



const _yaml={
  s:function(o){try{return window.YAML?window.YAML.stringify(o):JSON.stringify(o,null,2);}catch(_){return '';}},
  p:function(s){try{return window.YAML?window.YAML.parse(s):JSON.parse(s);}catch(_){return null;}}
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
  constructor(){super();this._config=null;this._hass=null;this._rocPosHandler=null;}

  _toHex(c){if(!c)return'#ffffff';if(c.startsWith('#'))return c.length===4?'#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]:c.slice(0,7);const m=c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);return m?'#'+parseInt(m[1]).toString(16).padStart(2,'0')+parseInt(m[2]).toString(16).padStart(2,'0')+parseInt(m[3]).toString(16).padStart(2,'0'):'#ffffff';}

  setConfig(cfg){
    const prev=this._config;
    this._config=cfg;
    if(prev&&this.innerHTML.trim()){
      const same=
        (prev.overlays||[]).length===(cfg.overlays||[]).length&&
        (prev.zones||[]).length===(cfg.zones||[]).length&&
        (prev.badges||[]).length===(cfg.badges||[]).length&&
        (prev.elements||[]).length===(cfg.elements||[]).length&&
        (prev.icons||[]).length===(cfg.icons||[]).length&&
        (prev.filter_conditions||[]).length===(cfg.filter_conditions||[]).length&&
        (prev.labels||[]).length===(cfg.labels||[]).length&&
        (prev.gauges||[]).length===(cfg.gauges||[]).length&&
        (prev.blinds||[]).length===(cfg.blinds||[]).length&&
        ((prev.brightness_model?.source||[]).length===(cfg.brightness_model?.source||[]).length)&&
        ((prev.brightness_model?.filter_gradient||[]).length===(cfg.brightness_model?.filter_gradient||[]).length)&&
        (prev.groups||[]).length===(cfg.groups||[]).length;
      if(same)return;
    }
    this._render();
  }

  set hass(h){
    this._hass=h;
    const dl=this.querySelector('#roc-entities');
    if(dl&&!dl.hasChildNodes())
      dl.innerHTML=Object.keys(h.states).sort().map(function(id){return'<option value="'+id+'">';}).join('');
  }

  _e(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  _fire(c){
    this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:Object.assign({type:'custom:room-overlay-card'},c)}}));
  }

  _collectConfig(){
    const c=Object.assign({},this._config);
    const self=this;
    const q=function(s){return this.querySelector(s);}.bind(this);
    const v=function(id,fb){const el=q('#'+id);return el?el.value:fb;};
    c.base_image=v('base_image',c.base_image||'');
    const _bicEl=this.querySelector('#base_image_conditions');
    if(_bicEl&&_bicEl.value.trim()){const _bic=_yaml.p(_bicEl.value);if(Array.isArray(_bic))c.base_image_conditions=_bic;else delete c.base_image_conditions;}else delete c.base_image_conditions;
    c.aspect_ratio=v('aspect_ratio','16/9');
    c.border_radius=v('border_radius','12px');
    c.filter_transition=v('filter_transition','2s ease');
    const tm=q('#test_mode');c.test_mode=tm?tm.checked:false;
    const ta=q('#tap_action_yaml');
    if(ta&&ta.value.trim()){const p=_yaml.p(ta.value);if(p)c.tap_action=p;else delete c.tap_action;}
    else delete c.tap_action;

    const _bmSrcs=[];
    self.querySelectorAll('[data-bm-src-ent]').forEach(function(el,i){
      const _s={entity:el.value.trim()};
      const _cc=self.querySelector('[data-bm-src-cond="'+i+'"]');
      if(_cc&&_cc.value.trim()){const _p=_yaml.p(_cc.value);if(_p)_s.condition=_p;}
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
    if(_bmSrcs.length||_bmFg.length)c.brightness_model={source:_bmSrcs,filter_gradient:_bmFg};
    else delete c.brightness_model;

    c.filter_conditions=[];
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
      entry.filter=buildFilterStr(filters);
      c.filter_conditions.push(entry);
    });

    c.overlays=(c.overlays||[]).map(function(ov,i){
      const o=Object.assign({},ov);
      const idEl=q('[data-ov-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const imgEl=q('[data-ov-img="'+i+'"]');if(imgEl){if(imgEl.value)o.image=imgEl.value;else delete o.image;}
      const trEl=q('[data-ov-tr="'+i+'"]');if(trEl)o.transition=trEl.value;const animOvEl=q('[data-ov-anim="'+i+'"]');if(animOvEl&&animOvEl.value)o.animation=animOvEl.value;else delete o.animation;
      const yaEl=q('[data-ov-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p)o.conditions=p;}
      return o;
    });

    c.zones=(c.zones||[]).map(function(z,i){
      const o=Object.assign({},z);
      const idEl=q('[data-z-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-z-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-z-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-z-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-z-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const tapEl=q('[data-z-tap="'+i+'"]');
      if(tapEl&&tapEl.value.trim()){const p=_yaml.p(tapEl.value);if(p)o.tap_action=p;else delete o.tap_action;}
      else delete o.tap_action;
      const holdEl=q('[data-z-hold="'+i+'"]');
      if(holdEl&&holdEl.value.trim()){const p=_yaml.p(holdEl.value);if(p)o.hold_action=p;else delete o.hold_action;}
      else delete o.hold_action;
      const dtapEl=q('[data-z-dtap="'+i+'"]');
      if(dtapEl&&dtapEl.value.trim()){const p=_yaml.p(dtapEl.value);if(p)o.double_tap_action=p;else delete o.double_tap_action;}
      else delete o.double_tap_action;
      const hdelEl=q('[data-z-hdelay="'+i+'"]');
      if(hdelEl&&hdelEl.value&&parseInt(hdelEl.value)!==500)o.hold_delay=parseInt(hdelEl.value);else delete o.hold_delay;
      const visEl=q('[data-z-vis="'+i+'"]');
      if(visEl&&visEl.value.trim()){const p=_yaml.p(visEl.value);if(p)o.visible=p;else delete o.visible;}
      else delete o.visible;
      return o;
    });

    c.badges=(c.badges||[]).map(function(b,i){
      const o=Object.assign({},b);
      const idEl=q('[data-b-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const posEl=q('[data-b-pos="'+i+'"]');if(posEl)o.position=posEl.value;
      const iconEl=q('[data-b-icon="'+i+'"]');if(iconEl){if(iconEl.value)o.icon=iconEl.value;else delete o.icon;}
      const bxEl=q('[data-b-x="'+i+'"]');if(bxEl){if(bxEl.value.trim())o.x=bxEl.value.trim();else delete o.x;}
      const byEl=q('[data-b-y="'+i+'"]');if(byEl){if(byEl.value.trim())o.y=byEl.value.trim();else delete o.y;}const bAnimEl=q('[data-b-anim="'+i+'"]');if(bAnimEl&&bAnimEl.value)o.animation=bAnimEl.value;else delete o.animation;const bAcEl=q('[data-b-ac="'+i+'"]');if(bAcEl&&bAcEl.value&&o.animation)o.animation_color=bAcEl.value;else delete o.animation_color;
      const yaEl=q('[data-b-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p)Object.assign(o,p);}
      return o;
    });

    c.elements=(c.elements||[]).map(function(el,i){
      const o=Object.assign({},el);
      const idEl=q('[data-el-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-el-top="'+i+'"]');if(topEl&&topEl.value.trim()){o.top=topEl.value.trim();delete o.bottom;}else delete o.top;
      const botEl=q('[data-el-bot="'+i+'"]');if(botEl&&botEl.value.trim()){o.bottom=botEl.value.trim();delete o.top;}else delete o.bottom;
      const lefEl=q('[data-el-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-el-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-el-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const yaEl=q('[data-el-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p){if(p.card)o.card=p.card;if(p.visible!==undefined)o.visible=p.visible;if(p.z_index!==undefined)o.z_index=p.z_index;if(p.border_radius)o.border_radius=p.border_radius;if(p.overflow)o.overflow=p.overflow;}}
      const elGrpEl=q('[data-el-grp="'+i+'"]');if(elGrpEl&&elGrpEl.value.trim())o.group=elGrpEl.value.trim();else delete o.group;
      return o;
    });

    c.icons=(c.icons||[]).map(function(ico,i){
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
      const colorEl=q('[data-ico-color="'+i+'"]');
      if(colorEl&&colorEl.value.trim()){const p=_yaml.p(colorEl.value);if(p)o.color=p;else delete o.color;}else delete o.color;
      const visEl=q('[data-ico-vis="'+i+'"]');
      if(visEl&&visEl.value.trim()){const p=_yaml.p(visEl.value);if(p)o.visible=p;else delete o.visible;}else delete o.visible;
      const tapEl=q('[data-ico-tap="'+i+'"]');
      if(tapEl&&tapEl.value.trim()){const p=_yaml.p(tapEl.value);if(p)o.tap_action=p;else delete o.tap_action;}else delete o.tap_action;
      const dtapEl=q('[data-ico-dtap="'+i+'"]');
      if(dtapEl&&dtapEl.value.trim()){const p=_yaml.p(dtapEl.value);if(p)o.double_tap_action=p;else delete o.double_tap_action;}else delete o.double_tap_action;
      const holdEl=q('[data-ico-hold="'+i+'"]');
      if(holdEl&&holdEl.value.trim()){const p=_yaml.p(holdEl.value);if(p)o.hold_action=p;else delete o.hold_action;}else delete o.hold_action;
      const icoGrpEl=q('[data-ico-grp="'+i+'"]');if(icoGrpEl&&icoGrpEl.value.trim())o.group=icoGrpEl.value.trim();else delete o.group;
      return o;
    });


    c.labels=(c.labels||[]).map(function(lbl,i){
      const o=Object.assign({},lbl);
      const idEl=q('[data-lbl-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-lbl-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-lbl-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const entEl=q('[data-lbl-entity="'+i+'"]');if(entEl)o.entity=entEl.value;
      const atEl=q('[data-lbl-attr="'+i+'"]');if(atEl){if(atEl.value.trim())o.attribute=atEl.value.trim();else delete o.attribute;}
      const sfxEl=q('[data-lbl-suffix="'+i+'"]');if(sfxEl){if(sfxEl.value)o.suffix=sfxEl.value;else delete o.suffix;}const lblAnimEl=q('[data-lbl-anim="'+i+'"]');if(lblAnimEl&&lblAnimEl.value)o.animation=lblAnimEl.value;else delete o.animation;const lblAcEl=q('[data-lbl-ac="'+i+'"]');if(lblAcEl&&lblAcEl.value&&o.animation)o.animation_color=lblAcEl.value;else delete o.animation_color;
      const yaEl=q('[data-lbl-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p)Object.assign(o,p);}
      const lblGradStops=[];
      self.querySelectorAll('[data-l-lv^="'+i+'-"]').forEach(function(inp){
        const j=inp.dataset.lLv.split('-')[1];
        const cInp=self.querySelector('[data-l-lc="'+i+'-'+j+'"]');
        if(cInp){const v=parseFloat(inp.value);if(!isNaN(v))lblGradStops.push({value:v,color:cInp.value});}
      });
      if(lblGradStops.length)o.color_gradient=lblGradStops.sort((a,b)=>a.value-b.value);
      else delete o.color_gradient;
      const lblGrpEl=q('[data-lbl-grp="'+i+'"]');if(lblGrpEl&&lblGrpEl.value.trim())o.group=lblGrpEl.value.trim();else delete o.group;
      return o;
    });

    c.gauges=(c.gauges||[]).map(function(g,i){
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
      const yaEl=q('[data-g-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p)Object.assign(o,p);}
      const gradStops=[];
      self.querySelectorAll('[data-g-gv^="'+i+'-"]').forEach(function(inp){
        const j=inp.dataset.gGv.split('-')[1];
        const cInp=self.querySelector('[data-g-gc="'+i+'-'+j+'"]');
        if(cInp){const v=parseFloat(inp.value);if(!isNaN(v))gradStops.push({value:v,color:cInp.value});}
      });
      if(gradStops.length)o.color_gradient=gradStops.sort((a,b)=>a.value-b.value);
      else delete o.color_gradient;
      const gAnimEl=q('[data-g-anim="'+i+'"]');if(gAnimEl&&gAnimEl.value)o.animation=gAnimEl.value;else delete o.animation;
      const gAcEl=q('[data-g-ac="'+i+'"]');if(gAcEl&&gAcEl.value&&o.animation)o.animation_color=gAcEl.value;else delete o.animation_color;
      const gAlertEntEl=q('[data-g-alert-ent="'+i+'"]');const gAlertOpEl=q('[data-g-alert-op="'+i+'"]');const gAlertValEl=q('[data-g-alert-val="'+i+'"]');
      const gAlertAttrEl=q('[data-g-alert-attr="'+i+'"]');
      if(gAlertEntEl&&gAlertEntEl.value.trim()&&gAlertOpEl&&gAlertOpEl.value&&gAlertValEl&&gAlertValEl.value.trim()){const _ac={entity:gAlertEntEl.value.trim(),operator:gAlertOpEl.value,value:parseFloat(gAlertValEl.value)};if(gAlertAttrEl&&gAlertAttrEl.value.trim())_ac.attribute=gAlertAttrEl.value.trim();o.alert_conditions=_ac;}else delete o.alert_conditions;
      const gGrpEl=q('[data-g-grp="'+i+'"]');if(gGrpEl&&gGrpEl.value.trim())o.group=gGrpEl.value.trim();else delete o.group;
      return o;
    });
    c.blinds=(c.blinds||[]).map(function(b,i){
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
      const yaEl=q('[data-bl-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p)Object.assign(o,p);}
      const blGrpEl=q('[data-bl-grp="'+i+'"]');if(blGrpEl&&blGrpEl.value.trim())o.group=blGrpEl.value.trim();else delete o.group;
      return o;
    });

    c.groups=(c.groups||[]).map(function(g,i){
      const o=Object.assign({},g);
      const idEl=q('[data-grp-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const visEl=q('[data-grp-vis="'+i+'"]');if(visEl)o.visible=visEl.checked;
      const gcEl=q('[data-grp-gc="'+i+'"]');if(gcEl&&gcEl.value.trim())o.grouping_code=parseInt(gcEl.value,10);else delete o.grouping_code;
      const yaEl=q('[data-grp-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p&&p.style)o.style=p.style;else delete o.style;}else delete o.style;
      return o;
    });

    return c;
  }

  _inp(s){return ' style="width:100%;padding:6px;border-radius:4px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box;'+s+'"';}

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
    const condYaml=ov.conditions?_yaml.s(ov.conditions):'';
    const ovOpen=this._openPanels&&this._openPanels.has('ov-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="ov-'+i+'"'+(ovOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Overlay: '+this._e(ov.id||'ov_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-ov-id="'+i+'" type="text" value="'+this._e(ov.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Image URL</label><input data-ov-img="'+i+'" type="text" value="'+this._e(ov.image||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Transition</label><input data-ov-tr="'+i+'" type="text" value="'+this._e(ov.transition||'2s ease')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Animation</label>';
    h+='<select data-ov-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!ov.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(ov.animation==="pulse"?' selected':'')+'>pulse (fade in/out)</option>';
    h+='<option value="blink"'+(ov.animation==="blink"?' selected':'')+'>blink (hard on/off)</option>';
    h+='</select></div></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Conditions YAML (opacity / filter / state_images)</label>';
    h+='<textarea data-ov-yaml="'+i+'" rows="5"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(condYaml)+'</textarea></div>';
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
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-z-id="'+i+'" type="text" value="'+this._e(z.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-z-top="'+i+'" type="text" value="'+this._e(z.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-z-left="'+i+'" type="text" value="'+this._e(z.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Width</label><input data-z-w="'+i+'" type="text" value="'+this._e(z.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Height</label><input data-z-h="'+i+'" type="text" value="'+this._e(z.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_delay (ms)</label><input data-z-hdelay="'+i+'" type="number" value="'+this._e(String(z.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">tap_action (YAML)</label><textarea data-z-tap="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">double_tap_action (YAML)</label><textarea data-z-dtap="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(dtapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_action (YAML)</label><textarea data-z-hold="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(holdYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">visible (YAML)</label><textarea data-z-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+='<button data-dup-z="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-z="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove zone</button>';
    h+='</div></details>';
    return h;
  }

  _badgeItem(b,i){
    const bCopy=Object.assign({},b);delete bCopy.id;delete bCopy.icon;delete bCopy.position;
    const bYaml=Object.keys(bCopy).length?_yaml.s(bCopy):'';
    const bOpen=this._openPanels&&this._openPanels.has('b-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="b-'+i+'"'+(bOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Badge: '+this._e(b.id||'badge_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-b-id="'+i+'" type="text" value="'+this._e(b.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Icon (mdi:...)</label><input data-b-icon="'+i+'" type="text" value="'+this._e(b.icon||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Position</label>';
    h+='<select data-b-pos="'+i+'"'+this._inp('')+'>';
    const bp=b.position||'bottom-left';
    ['bottom-left','bottom-right','top-left','top-right','custom'].forEach(function(p){h+='<option value="'+p+'"'+(bp===p?' selected':'')+'>'+p+'</option>';});
    h+='</select></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">X (custom pos)</label><input data-b-x="'+i+'" type="text" placeholder="e.g. 30%" value="'+this._e(b.x||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Y (custom pos)</label><input data-b-y="'+i+'" type="text" placeholder="e.g. 15%" value="'+this._e(b.y||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Animation</label>';
    h+='<select data-b-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!b.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(b.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(b.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Animation color (glow)</label>';
    h+='<input type="color" data-b-ac="'+i+'" value="'+(b.animation_color?this._toHex(b.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">label / visible / icon_color / tap_action (YAML)</label>';
    h+='<textarea data-b-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(bYaml)+'</textarea></div>';
    h+='<button data-rm-b="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove badge</button>';
    h+='</div></details>';
    return h;
  }

  _elItem(el,i){
    const elCopy={};
    if(el.card)elCopy.card=el.card;
    if(el.visible!==undefined)elCopy.visible=el.visible;
    if(el.z_index!==undefined)elCopy.z_index=el.z_index;
    if(el.border_radius)elCopy.border_radius=el.border_radius;
    if(el.overflow)elCopy.overflow=el.overflow;
    const elYaml=Object.keys(elCopy).length?_yaml.s(elCopy):'';
    const elOpen=this._openPanels&&this._openPanels.has('el-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="el-'+i+'"'+(elOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Element: '+this._e(el.id||'el_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-el-id="'+i+'" type="text" value="'+this._e(el.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top (or use Bottom)</label><input data-el-top="'+i+'" type="text" placeholder="e.g. 10%" value="'+this._e(el.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Bottom (alternative to Top)</label><input data-el-bot="'+i+'" type="text" placeholder="e.g. 0%" value="'+this._e(el.bottom||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-el-left="'+i+'" type="text" value="'+this._e(el.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Width</label><input data-el-w="'+i+'" type="text" value="'+this._e(el.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Height</label><input data-el-h="'+i+'" type="text" value="'+this._e(el.height||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">card / visible / z_index / border_radius (YAML)</label>';
    h+='<textarea data-el-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(elYaml)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Group (optional)</label><input data-el-grp="'+i+'" type="text" placeholder="group id" value="'+this._e((typeof el.group==='string'?el.group:''))+'"'+this._inp('')+'></div>';
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
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-ico-id="'+i+'" type="text" value="'+this._e(ico.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Icon (mdi:...)</label><input data-ico-icon="'+i+'" type="text" value="'+this._e(ico.icon||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Size (px or %)</label><input data-ico-size="'+i+'" type="text" placeholder="20px or 2%" value="'+this._e(ico.size||'20px')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">z-index</label><input data-ico-z="'+i+'" type="number" value="'+this._e(String(ico.z_index||6))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Background (circle, optional)</label><input data-ico-bg="'+i+'" type="text" placeholder="rgba(0,0,0,0.55)" value="'+this._e(ico.background||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-ico-top="'+i+'" type="text" value="'+this._e(ico.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-ico-left="'+i+'" type="text" value="'+this._e(ico.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_delay (ms)</label><input data-ico-hdelay="'+i+'" type="number" value="'+this._e(String(ico.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">color (YAML condition list)</label><textarea data-ico-color="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(colorYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">visible (YAML condition)</label><textarea data-ico-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">tap_action (YAML)</label><textarea data-ico-tap="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">double_tap_action (YAML)</label><textarea data-ico-dtap="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(dtapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_action (YAML)</label><textarea data-ico-hold="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(holdYaml)+'</textarea></div>';
    h+='</div>';
    h+='<div style="margin-bottom:6px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Group (optional)</label><input data-ico-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(ico.group||'')+'"'+this._inp('')+'></div>';
    h+='<button data-dup-ico="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-ico="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove icon</button>';
    h+='</div></details>';
    return h;
  }

  _lblItem(lbl,i){const cp=Object.assign({},lbl);delete cp.id;delete cp.top;delete cp.left;delete cp.entity;delete cp.attribute;delete cp.suffix;delete cp.unit;delete cp.color_gradient;delete cp.animation;delete cp.animation_color;delete cp.alert_conditions;delete cp.orientation;const ys=Object.keys(cp).length?_yaml.s(cp):'';const op=this._openPanels&&this._openPanels.has('lbl-'+i);let h='<details style="margin-bottom:6px;" data-panel="lbl-'+i+'"'+(op?' open':'')+' >';h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Label: '+this._e(lbl.id||'lbl_'+i)+'</summary>';h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-lbl-id="'+i+'" type="text" value="'+this._e(lbl.id||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-lbl-top="'+i+'" type="text" value="'+this._e(lbl.top||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-lbl-left="'+i+'" type="text" value="'+this._e(lbl.left||'')+'"'+this._inp('')+'></div>';h+='</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Entity</label><input type="text" list="roc-entities" data-lbl-entity="'+i+'" value="'+this._e(lbl.entity||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Attribute (optional)</label><input data-lbl-attr="'+i+'" type="text" value="'+this._e(lbl.attribute||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Suffix</label><input data-lbl-suffix="'+i+'" type="text" value="'+this._e(lbl.suffix||lbl.unit||'')+'"'+this._inp('')+'></div>';h+='</div>';const ls=lbl.color_gradient||[];h+='<div style="margin-bottom:8px;">';h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';h+='<label style="font-size:12px;font-weight:500;">Color gradient (smooth interpolation)</label>';h+='<button data-add-lg="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';h+='</div>';for(let j=0;j<ls.length;j++){const hex=this._toHex(ls[j].color);h+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';h+='<input type="number" data-l-lv="'+i+'-'+j+'" placeholder="value" value="'+ls[j].value+'"'+this._inp('font-size:12px;')+'>';h+='<input type="color" data-l-lc="'+i+'-'+j+'" value="'+hex+'" style="width:100%;height:30px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;">';h+='<button data-rm-lg="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';h+='</div>';}if(!ls.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No stops yet — add stops for smooth gradient, or use \'color\' in YAML for discrete conditions.</p>';h+='</div>';h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Animation</label>';
    h+='<select data-lbl-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!lbl.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(lbl.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(lbl.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Animation color (glow)</label>';
    h+='<input type="color" data-lbl-ac="'+i+'" value="'+(lbl.animation_color?this._toHex(lbl.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">font_size / font_weight / color / visible / visible_conditions / z_index (YAML)</label>';h+='<textarea data-lbl-yaml="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Group (optional)</label><input data-lbl-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(lbl.group||'')+'"'+this._inp('')+'></div>';
    h+='<button data-dup-lbl="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-lbl="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove label</button>';h+='</div></details>';return h;}

  _gaugeItem(g,i){const cp=Object.assign({},g);delete cp.id;delete cp.top;delete cp.left;delete cp.width;delete cp.height;delete cp.entity;delete cp.attribute;delete cp.min;delete cp.max;delete cp.color_gradient;delete cp.animation;delete cp.animation_color;delete cp.alert_conditions;delete cp.orientation;const ys=Object.keys(cp).length?_yaml.s(cp):'';const op=this._openPanels&&this._openPanels.has('g-'+i);let h='<details style="margin-bottom:6px;" data-panel="g-'+i+'"'+(op?' open':'')+' >';h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Gauge: '+this._e(g.id||'gauge_'+i)+'</summary>';h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-g-id="'+i+'" type="text" value="'+this._e(g.id||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-g-top="'+i+'" type="text" value="'+this._e(g.top||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-g-left="'+i+'" type="text" value="'+this._e(g.left||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Width</label><input data-g-w="'+i+'" type="text" value="'+this._e(g.width||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Height</label><input data-g-h="'+i+'" type="text" value="'+this._e(g.height||'')+'"'+this._inp('')+'></div>';h+='</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Entity</label><input type="text" list="roc-entities" data-g-entity="'+i+'" value="'+this._e(g.entity||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Attribute</label><input data-g-attr="'+i+'" type="text" value="'+this._e(g.attribute||'')+'"'+this._inp('')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Min</label><input data-g-min="'+i+'" type="number" value="'+this._e(String(g.min??0))+'"'+this._inp('font-size:12px;')+'></div>';h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Max</label><input data-g-max="'+i+'" type="number" value="'+this._e(String(g.max??100))+'"'+this._inp('font-size:12px;')+'></div>';h+='</div>';const gs=g.color_gradient||[];h+='<div style="margin-bottom:8px;">';h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';h+='<label style="font-size:12px;font-weight:500;">Color gradient (smooth interpolation)</label>';h+='<button data-add-gg="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';h+='</div>';for(let j=0;j<gs.length;j++){const hex=this._toHex(gs[j].color);h+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';h+='<input type="number" data-g-gv="'+i+'-'+j+'" placeholder="value" value="'+gs[j].value+'"'+this._inp('font-size:12px;')+'>';h+='<input type="color" data-g-gc="'+i+'-'+j+'" value="'+hex+'" style="width:100%;height:30px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;">';h+='<button data-rm-gg="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';h+='</div>';}if(!gs.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No stops yet — add stops for smooth gradient, or use \'color\' in YAML for discrete conditions.</p>';h+='</div>';h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Orientation</label>';
    h+='<select data-g-orient="'+i+'"'+this._inp('')+'>';
    h+='<option value="vertical"'+((!g.orientation||g.orientation==="vertical")?" selected":"")+'>vertical – bottom→top (default)</option>';
    h+='<option value="top"'+(g.orientation==="top"?' selected':'')+'>top – top→bottom (blind/shade)</option>';
    h+='<option value="horizontal"'+(g.orientation==="horizontal"?' selected':'')+'>horizontal – left→right</option>';
    h+='<option value="right"'+(g.orientation==="right"?' selected':'')+'>right – right→left</option>';
    h+='</select></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Alert animation (border)</label>';
    h+='<select data-g-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!g.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(g.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(g.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Animation color</label>';
    h+='<input type="color" data-g-ac="'+i+'" value="'+(g.animation_color?this._toHex(g.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 70px 70px;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Alert condition: entity</label>';
    h+='<input type="text" list="roc-entities" data-g-alert-ent="'+i+'" value="'+this._e((g.alert_conditions&&g.alert_conditions.entity)||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Attribute (optional)</label>';
    h+='<input data-g-alert-attr="'+i+'" type="text" value="'+this._e((g.alert_conditions&&g.alert_conditions.attribute)||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Operator</label>';
    h+='<select data-g-alert-op="'+i+'"'+this._inp('font-size:12px;')+'>';
    h+='<option value=""'+(!g.alert_conditions?' selected':'')+'>&#8212;</option>';
    h+='<option value=">"'+(g.alert_conditions&&g.alert_conditions.operator===">"?' selected':'')+'>></option>';
    h+='<option value="<"'+(g.alert_conditions&&g.alert_conditions.operator==="<"?' selected':'')+'>&#60;</option>';
    h+='<option value=">="'+(g.alert_conditions&&g.alert_conditions.operator===">="?' selected':'')+'>>= </option>';
    h+='<option value="<="'+(g.alert_conditions&&g.alert_conditions.operator==="<="?' selected':'')+'>&#60;=</option>';
    h+='<option value="=="'+(g.alert_conditions&&g.alert_conditions.operator==="=="?' selected':'')+'>==</option>';
    h+='<option value="!="'+(g.alert_conditions&&g.alert_conditions.operator==="!="?' selected':'')+'>!=</option>';
    h+='</select></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Value</label>';
    h+='<input data-g-alert-val="'+i+'" type="number" value="'+this._e(String(g.alert_conditions&&g.alert_conditions.value!==undefined?g.alert_conditions.value:''))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">background / border_radius / transition / visible / visible_conditions / z_index / color (YAML)</label>';h+='<textarea data-g-yaml="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Group (optional)</label><input data-g-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(g.group||'')+'"'+this._inp('')+'></div>';
    h+='<button data-dup-g="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-g="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove gauge</button>';h+='</div></details>';return h;}

  _blindItem(b,i){
    const type=b.blind_type||'roller';
    const op=this._openPanels&&this._openPanels.has('bl-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="bl-'+i+'"'+(op?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Blind: '+this._e(b.id||'blind_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-bl-id="'+i+'" type="text" value="'+this._e(b.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-bl-top="'+i+'" type="text" value="'+this._e(b.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-bl-left="'+i+'" type="text" value="'+this._e(b.left||'')+'"'+this._inp('')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Width</label><input data-bl-w="'+i+'" type="text" value="'+this._e(b.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Height</label><input data-bl-h="'+i+'" type="text" value="'+this._e(b.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">z-index</label><input data-bl-z="'+i+'" type="number" value="'+this._e(String(b.z_index??6))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Entity</label><input type="text" list="roc-entities" data-bl-entity="'+i+'" value="'+this._e(b.entity||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Attribute</label><input data-bl-attr="'+i+'" type="text" value="'+this._e(b.attribute||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Min</label><input data-bl-min="'+i+'" type="number" value="'+this._e(String(b.min??0))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Max</label><input data-bl-max="'+i+'" type="number" value="'+this._e(String(b.max??100))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Blind type</label><select data-bl-type="'+i+'"'+this._inp('')+'>';
    h+='<option value="roller"'+(type==='roller'?' selected':'')+'>roller &#8211; solid fill</option>';
    h+='<option value="day_night"'+(type==='day_night'?' selected':'')+'>day/night &#8211; striped</option>';
    h+='<option value="venetian"'+(type==='venetian'?' selected':'')+'>venetian &#8211; slats + gap</option>';
    h+='</select></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Slat / roller color (CSS)</label><input data-bl-slat-color="'+i+'" type="text" value="'+this._e(b.slat_color||'rgba(0,0,0,0.9)') +'"'+this._inp('font-size:12px;font-family:monospace;')+'></div>';
    h+='</div>';
    if(type==='day_night'){
      h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
      h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Slat count (number of band pairs)</label><input data-bl-slat-count="'+i+'" type="number" min="1" step="1" value="'+this._e(String(b.slat_count??6))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='</div>';
    }else if(type==='venetian'){
      h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
      h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Slat width (px)</label><input data-bl-slat-w="'+i+'" type="number" value="'+this._e(String(b.slat_width??7))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Slat gap (px)</label><input data-bl-slat-g="'+i+'" type="number" value="'+this._e(String(b.slat_gap??6))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Gap color (CSS)</label><input data-bl-gap-color="'+i+'" type="text" value="'+this._e(b.gap_color||'rgba(180,160,140,0.35)')+'"'+this._inp('font-size:12px;font-family:monospace;')+'></div>';
      h+='</div>';
    }
    const cpBl=Object.assign({},b);['id','top','left','width','height','entity','attribute','min','max','z_index','blind_type','slat_color','slat_count','slat_width','slat_gap','gap_color','slat_pitch'].forEach(function(k){delete cpBl[k];});
    const ysBl=Object.keys(cpBl).length?_yaml.s(cpBl):'';
    h+='<div style="margin-bottom:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">background / border_radius / transition / visible / visible_conditions (YAML)</label>';
    h+='<textarea data-bl-yaml="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ysBl)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Group (optional)</label><input data-bl-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(b.group||'')+'"'+this._inp('')+'></div>';
    h+='<button data-dup-bl="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-bl="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove blind</button>';
    h+='</div></details>';
    return h;}

  _render(){
    if(!this._config)return;
    const c=this._config;
    const open=new Set();
    this.querySelectorAll('details[data-panel]').forEach(function(d){if(d.open)open.add(d.dataset.panel);});
    this._openPanels=open;
    const firstRender=open.size===0;

    const tapYaml=c.tap_action?_yaml.s(c.tap_action):'';
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
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Base image URL *</label><input id="base_image" type="text" value="'+this._e(c.base_image||'')+'"'+this._inp('')+'></div>';
    const _bicYaml=c.base_image_conditions?_yaml.s(c.base_image_conditions):'';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Base image conditions (optional — swap image by entity state)</label><textarea id="base_image_conditions" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_bicYaml)+'</textarea></div>';
    basicInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Aspect ratio</label><input id="aspect_ratio" type="text" value="'+this._e(c.aspect_ratio||'16/9')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Border radius</label><input id="border_radius" type="text" value="'+this._e(c.border_radius||'12px')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Filter transition</label><input id="filter_transition" type="text" value="'+this._e(c.filter_transition||'2s ease')+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    basicInner+='<div style="display:flex;align-items:center;gap:8px;"><input id="test_mode" type="checkbox"'+(c.test_mode?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:13px;cursor:pointer;" for="test_mode">Test mode (show zone &amp; element outlines)</label></div>';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">tap_action (YAML)</label><textarea id="tap_action_yaml" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    basicInner+='</div>';

    let filterInner='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;">Conditions are evaluated in order — first match wins. A block without an entity is the default (fallback).</p>';
    filterInner+='<div id="filter-blocks">';
    const self=this;
    (c.filter_conditions||[]).forEach(function(fc,i){filterInner+=self._filterBlock(fc,i);});
    filterInner+='</div>';
    filterInner+='<button id="add-filter" style="'+btnStyle+'">+ Add filter condition</button>';

    const bm=c.brightness_model||{};
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
    (c.overlays||[]).forEach(function(ov,i){ovInner+=self._ovItem(ov,i);});
    ovInner+='</div><button id="add-ov" style="'+btnStyle+'margin-top:4px;">+ Add overlay</button>';

    let zInner='<div id="z-list">';
    (c.zones||[]).forEach(function(z,i){zInner+=self._zoneItem(z,i);});
    zInner+='</div><button id="add-z" style="'+btnStyle+'margin-top:4px;">+ Add zone</button>';

    let bInner='<div id="b-list">';
    (c.badges||[]).forEach(function(b,i){bInner+=self._badgeItem(b,i);});
    bInner+='</div><button id="add-b" style="'+btnStyle+'margin-top:4px;">+ Add badge</button>';

    let elInner='<div id="el-list">';
    (c.elements||[]).forEach(function(el,i){elInner+=self._elItem(el,i);});
    elInner+='</div><button id="add-el" style="'+btnStyle+'margin-top:4px;">+ Add element</button>';

    let icoInner='<div id="ico-list">';
    (c.icons||[]).forEach(function(ico,i){icoInner+=self._icoItem(ico,i);});
    icoInner+='</div><button id="add-ico" style="'+btnStyle+'margin-top:4px;">+ Add icon</button>';

    let lblInner='<div id="lbl-list">';
    (c.labels||[]).forEach(function(lbl,i){lblInner+=self._lblItem(lbl,i);});
    lblInner+='</div><button id="add-lbl" style="'+btnStyle+'margin-top:4px;">+ Add label</button>';

    let gInner='<div id="g-list">';
    (c.gauges||[]).forEach(function(g,i){gInner+=self._gaugeItem(g,i);});
    gInner+='</div><button id="add-g" style="'+btnStyle+'margin-top:4px;">+ Add gauge</button>';

    let blInner='<div id="bl-list">';
    (c.blinds||[]).forEach(function(b,i){blInner+=self._blindItem(b,i);});
    blInner+='</div><button id="add-bl" style="'+btnStyle+'margin-top:4px;">+ Add blind</button>';

    let grpInner='<div id="grp-list">';
    (c.groups||[]).forEach(function(g,i){grpInner+=self._groupItem(g,i);});
    grpInner+='</div><button id="add-grp" style="'+btnStyle+'margin-top:4px;">+ Add group</button>';

    const _dlOpts=this._hass?Object.keys(this._hass.states).sort().map(id=>'<option value="'+id+'">').join(''):'';
    this.innerHTML='<datalist id="roc-entities">'+_dlOpts+'</datalist><div style="padding:8px;">'
      +sec('basic','Basic settings',undefined,basicInner)
      +sec('filters','Base image filters',(c.filter_conditions||[]).length,filterInner)
      +sec('brightness','Brightness model (filter interpolation)',(bm.source?.length||0)+(bm.filter_gradient?.length||0),bmInner)
      +sec('overlays','Overlay layers',(c.overlays||[]).length,ovInner)
      +sec('zones','Clickable zones',(c.zones||[]).length,zInner)
      +sec('badges','Status badges',(c.badges||[]).length,bInner)
      +sec('elements','Embedded HA cards',(c.elements||[]).length,elInner)
      +sec('icons','Icon overlays',(c.icons||[]).length,icoInner)+sec('labels','Value labels',(c.labels||[]).length,lblInner)+sec('gauges','Gauge bars',(c.gauges||[]).length,gInner)
      +sec('blinds','Window blinds',(c.blinds||[]).length,blInner)
      +sec('groups','Element groups',(c.groups||[]).length,grpInner)
      +'</div>';

    this._listen();
    this._bindHassComponents();
    // Position updates from card drag/keyboard — relay through editor so HA saves correctly
    if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);this._rocPosHandler=null;}
    if(c.test_mode){
      const self=this;
      this._rocPosHandler=function(e){self._config=e.detail.config;self._fire(e.detail.config);};
      window.addEventListener('roc-pos-update',this._rocPosHandler);
    }
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
      range.addEventListener('input',function(){num.value=range.value;self._fire(self._collectConfig());});
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
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-grp-id="'+i+'" type="text" value="'+this._e(g.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Grouping code (mutual exclusion)</label><input data-grp-gc="'+i+'" type="number" placeholder="e.g. 1" value="'+this._e(g.grouping_code!=null?String(g.grouping_code):'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div style="display:flex;align-items:center;gap:8px;padding-top:18px;"><label style="font-size:12px;">Initially visible</label><input data-grp-vis="'+i+'" type="checkbox"'+(g.visible?' checked':'')+' style="width:auto;cursor:pointer;"></div>';
    h+='</div>';
    h+='<div style="margin-bottom:8px;"><label style="font-size:12px;display:block;margin-bottom:4px;">Background panel — style: (top / left / width / height / background / border_radius / z_index)</label>';
    h+='<textarea data-grp-yaml="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(styleYaml)+'</textarea></div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 8px;">Actions: <code>action: toggle-group</code>, <code>show-group</code>, <code>hide-group</code> with <code>group: '+this._e(g.id||'group_id')+'</code></p>';
    h+='<button data-rm-grp="'+i+'" style="padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove group</button>';
    h+='</div></details>';
    return h;
  }

  _listen(){
    const self=this;
    const fire=function(){self._fire(self._collectConfig());};

    ['base_image','aspect_ratio','border_radius','filter_transition','base_image_conditions'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
    });
    const tm=this.querySelector('#test_mode');
    if(tm){
      tm.addEventListener('change',function(){
        // Re-register roc-pos-update listener — _render() is skipped by same-check when only test_mode toggles
        if(self._rocPosHandler){window.removeEventListener('roc-pos-update',self._rocPosHandler);self._rocPosHandler=null;}
        if(tm.checked){
          self._rocPosHandler=function(e){self._config=e.detail.config;self._fire(e.detail.config);};
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
      if(!c.filter_conditions)c.filter_conditions=[];
      c.filter_conditions.push({filter:'none'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-filter]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmFilter);
        const c=self._collectConfig();
        if(c.filter_conditions)c.filter_conditions.splice(i,1);
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
      if(!c.brightness_model)c.brightness_model={source:[],filter_gradient:[]};
      if(!c.brightness_model.source)c.brightness_model.source=[];
      c.brightness_model.source.push({entity:'',min_input:0,max_input:100});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bm-src]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBmSrc);
        const c=self._collectConfig();
        if(c.brightness_model&&c.brightness_model.source)c.brightness_model.source.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bm-src-ent],[data-bm-src-attr],[data-bm-src-min],[data-bm-src-max],[data-bm-src-cond]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    const addBmFg=this.querySelector('#add-bm-fg');
    if(addBmFg)addBmFg.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.brightness_model)c.brightness_model={source:[],filter_gradient:[]};
      if(!c.brightness_model.filter_gradient)c.brightness_model.filter_gradient=[];
      const fg=c.brightness_model.filter_gradient;
      const last=fg[fg.length-1];
      fg.push({value:last?Math.min(100,last.value+25):0,filter:'none'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bm-fg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBmFg);
        const c=self._collectConfig();
        if(c.brightness_model&&c.brightness_model.filter_gradient)c.brightness_model.filter_gradient.splice(i,1);
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
      if(!c.overlays)c.overlays=[];
      c.overlays.push({id:'overlay_'+(c.overlays.length+1),image:'',transition:'2s ease'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ov]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmOv);
        const c=self._collectConfig();
        if(c.overlays)c.overlays.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-ov-id],[data-ov-img],[data-ov-tr],[data-ov-yaml],[data-ov-anim]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Zones
    const addZ=this.querySelector('#add-z');
    if(addZ)addZ.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.zones)c.zones=[];
      c.zones.push({id:'zone_'+(c.zones.length+1),top:'0%',left:'0%',width:'10%',height:'10%'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-z]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmZ);
        const c=self._collectConfig();
        if(c.zones)c.zones.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-z-id],[data-z-top],[data-z-left],[data-z-w],[data-z-h],[data-z-tap],[data-z-hold],[data-z-dtap],[data-z-hdelay],[data-z-vis]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Badges
    const addB=this.querySelector('#add-b');
    if(addB)addB.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.badges)c.badges=[];
      c.badges.push({id:'badge_'+(c.badges.length+1),position:'bottom-left'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-b]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmB);
        const c=self._collectConfig();
        if(c.badges)c.badges.splice(i,1);
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
      if(!c.icons)c.icons=[];
      c.icons.push({id:'icon_'+(c.icons.length+1),icon:'mdi:help',top:'10%',left:'10%',size:'24px'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ico]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmIco);
        const c=self._collectConfig();
        if(c.icons)c.icons.splice(i,1);
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
      if(!c.labels)c.labels=[];
      c.labels.push({id:'label_'+(c.labels.length+1),top:'10%',left:'10%',entity:''});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-lbl]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmLbl);
        const c=self._collectConfig();
        if(c.labels)c.labels.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-lbl-id],[data-lbl-top],[data-lbl-left],[data-lbl-entity],[data-lbl-attr],[data-lbl-suffix],[data-lbl-yaml],[data-lbl-anim],[data-lbl-ac]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-lg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addLg);
        const c=self._collectConfig();
        if(!c.labels||!c.labels[i])return;
        if(!c.labels[i].color_gradient)c.labels[i].color_gradient=[];
        const ls=c.labels[i].color_gradient;
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
        if(c.labels&&c.labels[i]&&c.labels[i].color_gradient){
          c.labels[i].color_gradient.splice(j,1);
          if(!c.labels[i].color_gradient.length)delete c.labels[i].color_gradient;
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-l-lv],[data-l-lc]').forEach(function(el){
      el.addEventListener('change',fire);el.addEventListener('input',fire);
    });

    // Gauges
    const addG=this.querySelector('#add-g');
    if(addG)addG.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.gauges)c.gauges=[];
      c.gauges.push({id:'gauge_'+(c.gauges.length+1),top:'10%',left:'10%',width:'2%',height:'20%',entity:'',min:0,max:100});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-g]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmG);
        const c=self._collectConfig();
        if(c.gauges)c.gauges.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-g-id],[data-g-top],[data-g-left],[data-g-w],[data-g-h],[data-g-entity],[data-g-attr],[data-g-min],[data-g-max],[data-g-yaml],[data-g-orient],[data-g-anim],[data-g-ac],[data-g-alert-ent],[data-g-alert-attr],[data-g-alert-op],[data-g-alert-val]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-gg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addGg);
        const c=self._collectConfig();
        if(!c.gauges||!c.gauges[i])return;
        if(!c.gauges[i].color_gradient)c.gauges[i].color_gradient=[];
        const gs=c.gauges[i].color_gradient;
        const last=gs[gs.length-1];
        const mn=c.gauges[i].min??0,mx=c.gauges[i].max??100;
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
        if(c.gauges&&c.gauges[i]&&c.gauges[i].color_gradient){
          c.gauges[i].color_gradient.splice(j,1);
          if(!c.gauges[i].color_gradient.length)delete c.gauges[i].color_gradient;
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-g-gv],[data-g-gc]').forEach(function(el){
      el.addEventListener('change',fire);el.addEventListener('input',fire);
    });

    // Elements
    const addEl=this.querySelector('#add-el');
    if(addEl)addEl.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.elements)c.elements=[];
      c.elements.push({id:'el_'+(c.elements.length+1),top:'0%',left:'0%',width:'30%',height:'20%',card:{type:'tile',entity:''}});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-el]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmEl);
        const c=self._collectConfig();
        if(c.elements)c.elements.splice(i,1);
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
      if(!c.blinds)c.blinds=[];
      c.blinds.push({id:'blind_'+(c.blinds.length+1),top:'10%',left:'30%',width:'20%',height:'40%',entity:'',min:0,max:100,blind_type:'roller'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bl]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBl);
        const c=self._collectConfig();
        if(c.blinds)c.blinds.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bl-id],[data-bl-top],[data-bl-left],[data-bl-w],[data-bl-h],[data-bl-entity],[data-bl-attr],[data-bl-min],[data-bl-max],[data-bl-z],[data-bl-type],[data-bl-slat-color],[data-bl-slat-count],[data-bl-slat-w],[data-bl-slat-g],[data-bl-gap-color],[data-bl-yaml]').forEach(function(el){el.addEventListener('change',fire);});

    // Duplicate (clone) handlers
    function _cp(v,dflt){if(!v)return dflt||'3%';const n=parseFloat(v);return(!isNaN(n)&&String(v).trim().endsWith('%'))?Math.min(n+3,95).toFixed(1)+'%':v;}
    this.querySelectorAll('[data-dup-ico]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupIco),c=self._collectConfig();if(!c.icons||!c.icons[i])return;const cl=JSON.parse(JSON.stringify(c.icons[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);c.icons.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-lbl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupLbl),c=self._collectConfig();if(!c.labels||!c.labels[i])return;const cl=JSON.parse(JSON.stringify(c.labels[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);c.labels.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-g]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupG),c=self._collectConfig();if(!c.gauges||!c.gauges[i])return;const cl=JSON.parse(JSON.stringify(c.gauges[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);c.gauges.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-bl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupBl),c=self._collectConfig();if(!c.blinds||!c.blinds[i])return;const cl=JSON.parse(JSON.stringify(c.blinds[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);c.blinds.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-el]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupEl),c=self._collectConfig();if(!c.elements||!c.elements[i])return;const cl=JSON.parse(JSON.stringify(c.elements[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);c.elements.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-z]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupZ),c=self._collectConfig();if(!c.zones||!c.zones[i])return;const cl=JSON.parse(JSON.stringify(c.zones[i]));cl.id=cl.id+'_2';cl.top=_cp(cl.top);cl.left=_cp(cl.left);c.zones.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});

    // Group fields on elements
    this.querySelectorAll('[data-ico-grp],[data-lbl-grp],[data-g-grp],[data-bl-grp],[data-el-grp]').forEach(function(el){el.addEventListener('change',fire);});

    // Groups
    const addGrp=this.querySelector('#add-grp');
    if(addGrp)addGrp.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.groups)c.groups=[];
      c.groups.push({id:'group_'+(c.groups.length+1),visible:false});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-grp]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmGrp);
        const c=self._collectConfig();
        if(c.groups)c.groups.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-grp-id],[data-grp-gc],[data-grp-vis],[data-grp-yaml]').forEach(function(el){el.addEventListener('change',fire);});
  }

  disconnectedCallback(){
    if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);this._rocPosHandler=null;}
  }
}

customElements.define('room-overlay-card-editor',RoomOverlayCardEditor);
customElements.get('room-overlay-card').getConfigElement=function(){return document.createElement('room-overlay-card-editor');};
