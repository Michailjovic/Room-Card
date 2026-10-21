// ---- Light glow (v6.6.0) ------------------------------------------------
// A light-spill layer painted over the photo with mix-blend-mode: the colour
// comes from the light's own rgb_color / colour temperature, the strength from
// its brightness. Deliberately gradient-only -- no filter: blur(). Stacking a
// filter on a blended layer is the compositing combination that caused the
// v6.5.1 vacuum-widget repaint bug on tablet WebViews; the soft edge is made
// with gradient stops instead, which composites cleanly everywhere.
const GLOW_STOPS={
  soft:[[0,0.85],[40,0.35],[72,0]],
  tight:[[0,1],[22,0.5],[55,0]],
  wide:[[0,0.6],[55,0.22],[100,0]]
};
const GLOW_DEFAULT_RGB=[255,180,110];
// Accepts #rgb / #rrggbb / rgb(...) / "r,g,b" / "2700K"; null = derive from the entity
function glowParseColor(v){
  if(v==null)return null;
  if(Array.isArray(v)&&v.length>=3)return[+v[0],+v[1],+v[2]];
  const t=String(v).trim();
  if(!t||t==='auto')return null;
  let m=t.match(/^#?([0-9a-f]{6})$/i);
  if(m)return[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];
  m=t.match(/^#?([0-9a-f]{3})$/i);
  if(m)return[parseInt(m[1][0]+m[1][0],16),parseInt(m[1][1]+m[1][1],16),parseInt(m[1][2]+m[1][2],16)];
  m=t.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if(m)return[Math.round(+m[1]),Math.round(+m[2]),Math.round(+m[3])];
  m=t.match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
  if(m)return[+m[1],+m[2],+m[3]];
  m=t.match(/^(\d{3,5})\s*k$/i);
  if(m)return kelvinToRgb(parseInt(m[1],10));
  return null;
}
function glowRgb(g,st){
  const fixed=glowParseColor(g.color);
  if(fixed)return fixed;
  const a=st&&st.attributes;
  if(a){
    if(Array.isArray(a.rgb_color)&&a.rgb_color.length>=3)return a.rgb_color;
    if(a.color_temp_kelvin)return kelvinToRgb(a.color_temp_kelvin);
    if(a.color_temp)return kelvinToRgb(Math.round(1e6/a.color_temp));
  }
  return glowParseColor(g.fallback_color)||GLOW_DEFAULT_RGB;
}
function glowBg(g,rgb){
  const c=rgb[0]+','+rgb[1]+','+rgb[2];
  const stops=(GLOW_STOPS[g.falloff]||GLOW_STOPS.soft).map(function(p){
    return'rgba('+c+','+p[1]+') '+p[0]+'%';
  }).join(',');
  if(g.shape==='wash'){
    // Directional spill: an ellipse anchored on the edge the light comes FROM,
    // so it fades on every side. A plain linear-gradient would leave hard
    // vertical seams down the box -- light does not have straight edges.
    let a=g.angle==null?180:(typeof g.angle==='number'?g.angle:parseFloat(g.angle));
    if(isNaN(a))a=180;
    const rad=a*Math.PI/180;
    const x=Math.round(50-50*Math.sin(rad)),y=Math.round(50+50*Math.cos(rad));
    return'radial-gradient(ellipse farthest-side at '+x+'% '+y+'%,'+stops+')';
  }
  return'radial-gradient('+(g.shape==='ellipse'?'ellipse':'circle')+' closest-side,'+stops+')';
}
