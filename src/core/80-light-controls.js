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
// ---- Native light pills (light_controls.style: native, v6.17.0) -------------
// A built-in pill per entity — icon, name and brightness, with the fill showing
// the brightness in the light's own colour — instead of mounting the external
// material-slider-card. Same height (`height:`) and the same lux ring, so the
// strip takes exactly the space it took before. Tap toggles, a horizontal drag
// dims (lights that support brightness), a long press opens more-info.
function lcIsDimmable(st){
  if(!st||String(st.entity_id||'').split('.')[0]!=='light')return false;
  const m=st.attributes&&st.attributes.supported_color_modes;
  if(Array.isArray(m)&&m.length)return!(m.length===1&&m[0]==='onoff');
  return true; // older integrations without supported_color_modes — assume dimmable
}
function lcLightRgb(st){
  const a=(st&&st.attributes)||{};
  if(Array.isArray(a.rgb_color)&&a.rgb_color.length===3)return a.rgb_color;
  if(a.color_temp_kelvin)return kelvinToRgb(a.color_temp_kelvin);
  return[255,179,92]; // warm default (= --roc-active)
}
// Fill colour: the light's own colour, more transparent for near-white light so
// white text on the pill stays readable (the old strip put yellow text on white).
function lcFillCss(rgb){
  const lum=(0.299*rgb[0]+0.587*rgb[1]+0.114*rgb[2])/255;
  return'rgba('+rgb[0]+','+rgb[1]+','+rgb[2]+','+(lum>0.8?0.32:0.55)+')';
}
function lcPillPct(st){
  if(!st||st.state!=='on')return 0;
  const b=st.attributes&&st.attributes.brightness;
  return typeof b==='number'?Math.max(1,Math.round(b/255*100)):100;
}
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
// Every key tApply() might pull a per-profile override from.
const ROC_TIER_KEYS=ROC_PROFILES.concat(ROC_LEGACY_TIERS);
// Does any item (or any of its per-profile overrides) size itself in % — i.e.
// does resolveSize actually need the card width? Reading offsetWidth is a
// forced layout, so _update()/_applyResizeStyles() skip it when this is false.
// Deliberately conservative: a non-string value counts as "yes". A false
// positive costs one reflow; a false negative would break sizing.
function rocNeedsPctWidth(items,key){
  for(const it of(items||[])){
    if(!it)continue;
    const probe=function(v){return v===undefined?false:(typeof v==='string'?v.trim().endsWith('%'):v!=null);};
    if(probe(it[key]))return true;
    for(const p of ROC_TIER_KEYS){const o=it[p];if(o&&typeof o==='object'&&probe(o[key]))return true;}
  }
  return false;
}

