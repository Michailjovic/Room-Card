// ----- Value formatting (v6.16.0) ---------------------------------------------
// One formatter for every place that prints an entity value: labels, nav
// thumbnail chips and cockpit tiles. Before v6.16.0 each did its own
// parseFloat()+suffix, which printed an ISO timestamp as "2026", "12:30" as
// "12", glued the unit onto "unavailable" ("unavailable°") and showed raw
// machine states ("off", "inactive") instead of what HA itself shows.
//
// Rules, in order:
//  1. format: raw → the exact pre-v6.16.0 output (escape hatch).
//  2. unavailable / unknown → `unavailable_text` (default "—"), no prefix/suffix.
//  3. A strictly numeric value with explicit `decimals:` or `suffix:`/`unit:`
//     → the old numeric path (decimals, else rounded to an integer, + suffix),
//     but with the decimal separator of the user's HA number format.
//  4. Anything else → hass.formatEntityState() (translation, device-class
//     wording such as door on → "Open", unit and the entity's own display
//     precision), or formatEntityAttributeValue() for an attribute. Falls back
//     to the raw value on HA versions without those helpers.
const ROC_NUM_RE=/^\s*[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?\s*$/;
function rocIsNum(v){return typeof v==='number'?isFinite(v):(typeof v==='string'&&ROC_NUM_RE.test(v));}
function rocNumLocale(hass){
  const l=hass&&hass.locale;const nf=l&&l.number_format;
  const lang=(l&&l.language)||(hass&&hass.language)||undefined;
  switch(nf){
    case'comma_decimal':return'en-US';
    case'decimal_comma':return'de';
    case'space_comma':return'fr';
    case'system':return undefined;
    case'none':return null;
    default:return lang;
  }
}
function rocFmtNum(hass,n,dec){
  const loc=rocNumLocale(hass);
  if(loc!==null&&typeof Intl!=='undefined'&&Intl.NumberFormat){
    try{
      const o={useGrouping:false};
      if(dec!==undefined){o.minimumFractionDigits=dec;o.maximumFractionDigits=dec;}
      else o.maximumFractionDigits=20;
      return new Intl.NumberFormat(loc,o).format(n);
    }catch(_){}
  }
  return dec!==undefined?n.toFixed(dec):String(n);
}
function rocLegacyFmt(raw,o){ // the pre-v6.16.0 label/chip output, byte for byte
  const nv=parseFloat(raw);
  return!isNaN(nv)?(o.decimals!==undefined?nv.toFixed(o.decimals):String(Math.round(nv))):String(raw??'');
}
function rocFmtState(hass,st,o){
  o=o||{};
  if(!st)return'';
  const hasAttr=o.attribute!==undefined&&o.attribute!==null;
  const raw=hasAttr?(st.attributes||{})[o.attribute]:st.state;
  const pre=o.prefix||'';
  let sfx=o.suffix!==undefined?o.suffix:(o.unit!==undefined?o.unit:'');
  if(sfx==='auto')sfx=st.attributes&&st.attributes.unit_of_measurement?' '+st.attributes.unit_of_measurement:'';
  if(o.format==='raw')return pre+rocLegacyFmt(raw,o)+(sfx||'');
  if(!hasAttr&&(raw==='unavailable'||raw==='unknown'||raw===undefined||raw===null))
    return o.unavailable_text!==undefined?String(o.unavailable_text):'—';
  const explicit=o.decimals!==undefined||(o.suffix!==undefined&&o.suffix!=='')||(o.unit!==undefined&&o.unit!=='');
  if(rocIsNum(raw)&&explicit){
    const n=Number(raw);
    const txt=o.decimals!==undefined?rocFmtNum(hass,n,o.decimals):rocFmtNum(hass,Math.round(n),0);
    return pre+txt+(sfx||'');
  }
  try{
    if(hasAttr){
      if(hass&&typeof hass.formatEntityAttributeValue==='function')return pre+String(hass.formatEntityAttributeValue(st,o.attribute));
    }else if(hass&&typeof hass.formatEntityState==='function')return pre+String(hass.formatEntityState(st));
  }catch(_){}
  if(rocIsNum(raw))return pre+rocFmtNum(hass,Number(raw))+(sfx||'');
  return pre+String(raw??'');
}
// Numeric reading of a state for colour gradients — strict, so "2026-10-01"
// or "12:30" never pick a colour stop.
function rocNumVal(v){return rocIsNum(v)?Number(v):NaN;}

function evalCond(c,s){
  const e=s[c.entity];if(!e)return false;
  const sv=c.attribute!==undefined?String(e.attributes[c.attribute]??''): e.state,nv=parseFloat(sv);let r=true;
  if(c.state!==undefined)r=Array.isArray(c.state)?c.state.map(String).includes(sv):sv===String(c.state); // v6.16.0: list form, like state_not and HA's own conditions
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

// Conditional-value resolvers. Every one of these accepts EITHER the full
// [{condition,value},…] list OR a bare scalar shorthand (`label: Kitchen`,
// `icon_color: red`, `opacity: 0.5`, `filter: blur(2px)`) — the scalar form is
// the obvious thing to write and the GUI editor's free-form YAML boxes let you
// write it, so it must never throw. Before v5.9.14 a scalar reached
// `conds.find(...)` (strings iterate char-by-char, then die; numbers die on
// `for…of`) and the TypeError escaped `set hass` → the card rendered once and
// then never updated again. Guard lives HERE, in the resolvers, so every
// present and future call site is covered.
function resolveVal(conds,states,fallback){
  if(!Array.isArray(conds))return conds===undefined?fallback:conds;
  for(const cv of conds){if(!cv||cv.condition===undefined)continue;if(evalCond(cv.condition,states))return cv.value;}
  const d=conds.find(cv=>cv&&cv.condition===undefined);return d!==undefined?d.value:fallback;
}

function resolveFilter(conds,states){
  if(!Array.isArray(conds))return conds==null?'none':conds;
  for(const fc of conds){if(!fc||fc.condition===undefined)continue;if(evalCond(fc.condition,states))return fc.filter;}
  const d=conds.find(fc=>fc&&fc.condition===undefined);return d?d.filter:'none';
}

function resolveFilterInverted(conds,states){
  if(!Array.isArray(conds))return conds==null?'none':conds;
  // Find the condition that currently matches
  let curIdx=-1;
  for(let i=0;i<conds.length;i++){const fc=conds[i];if(!fc||fc.condition===undefined)continue;if(evalCond(fc.condition,states)){curIdx=i;break;}}
  // A condition matches → show the default (fallback) filter
  if(curIdx!==-1){const d=conds.find(fc=>fc&&fc.condition===undefined);return d?d.filter:'none';}
  // The default is active → show the first conditional filter
  const first=conds.find(fc=>fc&&fc.condition!==undefined);return first?first.filter:'none';
}

function parseCssColor(c){let m=c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);if(m)return[parseInt(m[1]),parseInt(m[2]),parseInt(m[3])];m=c.match(/^#([0-9a-f]{6})$/i);if(m)return[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];m=c.match(/^#([0-9a-f]{3})$/i);if(m)return[parseInt(m[1][0]+m[1][0],16),parseInt(m[1][1]+m[1][1],16),parseInt(m[1][2]+m[1][2],16)];return null;}

