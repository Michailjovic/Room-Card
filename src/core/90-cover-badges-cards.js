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
  // No `side` field: a docked control is flex:1 1 0 and fills its cover grid
  // region, so there is nothing to align. Placement comes from the Layout tab.
  return{id:b.id,entity:b.entity,
    placement:placement,
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
  const base='background:var(--roc-surface-c,rgba(20,22,26,.85));border:1px solid var(--roc-border-c,rgba(255,255,255,.08));color:var(--roc-text-c,#fff);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-sizing:border-box;border-radius:14px;'; // v6.17.0: design tokens (same dimensions)
  let pos;
  // Permanently visible member of the cover grid region. Vertical dock (side
  // column): fill the column (flex:1 1 0). Horizontal dock (a bar in an `auto`
  // row, typically under the photo on a phone): size to the buttons — with
  // flex-basis 0 the bar collapsed to its padding inside the auto row and the
  // 30-34px buttons overflowed it, so the region clipped their top/bottom and
  // the bar's own outline ran through the middle of them (v6.17.1).
  if(dock)pos='position:relative;'+(horiz?'flex:0 0 auto;':'flex:1 1 0;')+'min-width:0;min-height:0;padding:'+(horiz?'4px 10px':'8px 5px')+';';
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
const CC_CSS='.roc-cc{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;}.roc-cc.cc-h{flex-direction:row;gap:10px;}.roc-cc .cc-pct{font-size:13px;font-weight:500;font-variant-numeric:tabular-nums;flex:none;min-width:20px;text-align:center;}.roc-cc .cc-cap{display:flex;align-items:center;justify-content:center;width:34px;height:26px;border:none;border-radius:10px;background:rgba(255,255,255,0.08);color:var(--roc-text-c,#fff);cursor:pointer;--mdc-icon-size:20px;padding:0;flex:none;}.roc-cc.cc-h .cc-cap{width:30px;height:34px;}.roc-cc .cc-cap:active{transform:scale(0.92);}.roc-cc .cc-rail{position:relative;background:rgba(255,255,255,0.12);border-radius:6px;cursor:pointer;touch-action:none;flex:1 1 auto;width:10px;min-height:34px;}.roc-cc.cc-h .cc-rail{height:10px;min-width:50px;width:auto;min-height:0;}.roc-cc .cc-fill{position:absolute;background:rgba(242,243,245,0.28);border-radius:6px;left:0;right:0;bottom:0;height:0%;}.roc-cc.cc-h .cc-fill{top:0;bottom:0;left:0;right:auto;width:0%;height:auto;}.roc-cc .cc-thumb{position:absolute;background:var(--roc-text-c,#fff);border-radius:5px;box-shadow:0 1px 4px rgba(0,0,0,0.5);left:50%;bottom:0%;width:22px;height:10px;transform:translate(-50%,50%);}.roc-cc.cc-h .cc-thumb{top:50%;left:0%;bottom:auto;width:10px;height:22px;transform:translate(-50%,-50%);}.roc-cc .cc-presets{display:flex;flex-direction:column;align-items:center;gap:5px;flex:none;}.roc-cc.cc-h .cc-presets{flex-direction:row;}.roc-cc .cc-preset{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;background:rgba(255,255,255,0.04);color:var(--cc-col,#fff);cursor:pointer;--mdc-icon-size:19px;padding:0;flex:none;box-sizing:border-box;}.roc-cc .cc-preset-num{color:var(--cc-col,#fff);font-weight:600;font-size:12px;}.roc-cc .cc-preset.active{background:rgba(255,255,255,0.12);border-color:transparent;box-shadow:inset 0 0 0 2px var(--cc-col,#fff);}.roc-cc .cc-stop{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:none;border-radius:10px;background:rgba(255,255,255,0.08);color:var(--roc-text-c,#fff);cursor:pointer;--mdc-icon-size:18px;padding:0;flex:none;}.roc-cc .cc-stop.moving{background:rgba(226,75,74,0.28);color:#f6a6a6;animation:roc-glow 1.3s ease-in-out infinite;--roc-ac:rgba(226,75,74,0.6);}';
function lerpColorGradient(stops,val,presorted){if(!stops||!stops.length)return'white';const s=presorted?stops:stops.slice().sort((a,b)=>a.value-b.value);if(val<=s[0].value)return s[0].color;if(val>=s[s.length-1].value)return s[s.length-1].color;for(let i=0;i<s.length-1;i++){if(val>=s[i].value&&val<=s[i+1].value){const t=(val-s[i].value)/(s[i+1].value-s[i].value);const c1=parseCssColor(s[i].color),c2=parseCssColor(s[i+1].color);if(!c1||!c2)return s[i].color;return'rgb('+Math.round(c1[0]+(c2[0]-c1[0])*t)+','+Math.round(c1[1]+(c2[1]-c1[1])*t)+','+Math.round(c1[2]+(c2[2]-c1[2])*t)+')';}}return s[s.length-1].color;}

const BPOS={'bottom-left':'bottom:10px;left:10px','bottom-right':'bottom:10px;right:10px','top-left':'top:10px;left:10px','top-right':'top:10px;right:10px'};

function makeBadgePos(b){
  if(b.position==='custom')return 'top:'+(b.y||'auto')+';left:'+(b.x||'auto')+';';
  return BPOS[b.position||'bottom-left']||BPOS['bottom-left'];
}

let _rocHelpers=null,_rocHelpersP=null;
// Room-switch gate (v6.43.0): while a switch is starting its slide, new embedded cards wait for
// it — HA cards can take a while to construct, and that used to hold the OLD room on screen.
let rocCardGate=null;
function rocGateCards(ms){
  let release;
  const p=new Promise(function(r){release=r;});
  const t=setTimeout(function(){if(rocCardGate===p)rocCardGate=null;release();},ms||600);
  rocCardGate=p;
  return function(){clearTimeout(t);if(rocCardGate===p)rocCardGate=null;release();};
}
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
  (rocCardGate||Promise.resolve()).then(getHelpers).then(function(h){
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

