// ----- Themes (V7_PLAN §6.2, the 2026-10-21 proposals) -------------------------------------------
// A theme is a set of tokens, not code: projection, background, floor materials, walls, how a lit
// room and a heating room are drawn, labels. `floorplan.overrides` replaces single tokens by dotted
// path ('floor.wood': '#6b4a33', 'wall.h': 0.4). `mode` picks one of three drawing modes: the
// spatial plan (most themes), the temperature map and the tiles.
const RFP_FONT={
  sans:'var(--ha-font-family-body,var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif))',
  mono:"'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
  hand:"'Caveat','Segoe Print','Bradley Hand','Comic Sans MS',cursive",
};
const RFP_THEMES={
  night:{mode:'plan',proj:'oblique',dark:true,bg:'#0b0e12',bg2:'#151a20',vignette:true,
    floor:{wood:'#5a3e2b',vinyl:'#6e5442',tile:'#cfcac2',carpet:'#3c3f47',concrete:'#55585c',none:'#2a2e34'},floorStyle:'pattern',
    wall:{side:'#20252c',side2:'#20252c',top:'#3a414b',h:0.42,w:0.12},
    label:{font:'sans',c:'#e8eaed',sub:'#9aa3ad',chip:'rgba(10,12,15,.72)'},
    light:'pool',lightColor:'#ffb35c',heat:'pipes',heatColor:'#ff7a63',coolColor:'#8fb8ff',door:'gap',shadow:'hard',
    win:{glass:'#7fb6e6',open:'#5eead4',blind:'#cbb89a',door:'#8a6a4f'}},
  clay:{mode:'plan',proj:'iso',dark:false,bg:'#efe9e1',bg2:'#e4ddd3',
    floor:{wood:'#e7c9a6',vinyl:'#d6b896',tile:'#e9e6e1',carpet:'#d9d2e8',concrete:'#d8d4ce',none:'#ece6dd'},floorStyle:'pattern',
    wall:{side:'#f6f2ec',side2:'#ddd4c8',top:'#ffffff',h:0.55,w:0.12},
    label:{font:'sans',c:'#3a332c',sub:'#7a6f63',chip:'rgba(255,255,255,.85)'},
    light:'pool',lightBlend:'multiply',lightColor:'#ffb35c',heat:'pipes-soft',heatColor:'#f2836b',door:'gap',shadow:'soft',
    win:{glass:'#a9d2ec',open:'#22a699',blind:'#c9b49a',door:'#d9c3a5'}},
  neon:{mode:'plan',proj:'iso',dark:true,bg:'#05060a',
    floor:{wood:'#0b0d14',vinyl:'#0b0d14',tile:'#0b0d14',carpet:'#0b0d14',concrete:'#0b0d14',none:'#0b0d14'},floorStyle:'flat',
    wall:{side:'rgba(80,120,255,.07)',side2:'rgba(80,120,255,.07)',top:'#5b7cff',h:0.5,w:0.12,edge:true},
    label:{font:'mono',c:'#d6e0ff',sub:'#7d8bbd',chip:'rgba(5,6,10,.8)'},
    light:'edge',lightColor:'#ffcf7a',heat:'edge',heatColor:'#ff4d6d',door:'gap',
    win:{glass:'#5bd1ff',open:'#00ffc6',blind:'#7d8bbd',door:'#5b7cff'}},
  blueprint:{mode:'plan',proj:'top',dark:true,bg:'#0d3b66',
    floorStyle:'outline',line:'#e6f1ff',line2:'rgba(230,241,255,.35)',
    label:{font:'mono',c:'#e6f1ff',sub:'#9fc4ea',chip:'none'},
    light:'hatch',lightColor:'#ffd166',heat:'dashed',heatColor:'#ff9f8a',door:'arc',dims:true,
    win:{glass:'#9fd3ff',open:'#ffd166',blind:'rgba(230,241,255,.7)',door:'#e6f1ff'}},
  thermal:{mode:'thermal',proj:'top',dark:true,bg:'#101317',line:'#101317',
    label:{font:'sans',c:'#ffffff',sub:'rgba(255,255,255,.8)',chip:'none'},
    range:[21,24],stops:[[38,70,83],[42,157,143],[233,196,106],[244,162,97],[231,111,81]],heat:'faint'},
  tiles:{mode:'tiles',proj:'top',dark:false,bg:'#f3f4f6',
    label:{font:'sans',c:'#111827',sub:'#6b7280',chip:'none'},
    tile:{bg:'#ffffff',on:'#fff8eb',line:'#e5e7eb',onLine:'#f2c46d',r:18,icon:'#f3f4f6',iconOn:'#fde68a',ink:'#4b5563',inkOn:'#92400e',heatBg:'#fecaca',heatInk:'#991b1b'}},
  sketch:{mode:'plan',proj:'top',dark:false,bg:'#f4eee2',
    floorStyle:'sketch',line:'#3b3227',line2:'rgba(59,50,39,.55)',
    label:{font:'hand',c:'#3b3227',sub:'#7a6a55',chip:'none',scale:1.45},
    light:'scribble',lightColor:'#e9a23b',heat:'squiggle',heatColor:'#d1495b',door:'arc',rough:true,paper:true,
    win:{glass:'#5d8fb3',open:'#2a9d8f',blind:'#8c7a5f',door:'#3b3227'}},
};
const RFP_THEME_NAMES=Object.keys(RFP_THEMES);
// Floor materials (v6.49.0: + vinyl) and their patterns, in plan metres. `c` is the base colour —
// the theme's floor.<material>, or a room's own floor_color.
const RFP_FLOORS=['wood','vinyl','tile','carpet','concrete','none'];
function rfpFloorPattern(pid,mat,c){
  c=rfpEsc(c);
  if(mat==='tile')return'<pattern id="'+pid+'" patternUnits="userSpaceOnUse" width="0.6" height="0.6"><rect width="0.6" height="0.6" fill="'+c+'"/><path d="M0 0H0.6M0 0V0.6" stroke="rgba(0,0,0,.14)" stroke-width="0.014"/></pattern>';
  if(mat==='carpet')return'<pattern id="'+pid+'" patternUnits="userSpaceOnUse" width="0.12" height="0.12"><rect width="0.12" height="0.12" fill="'+c+'"/><circle cx="0.06" cy="0.06" r="0.012" fill="rgba(255,255,255,.06)"/></pattern>';
  if(mat==='concrete')return'<pattern id="'+pid+'" patternUnits="userSpaceOnUse" width="0.5" height="0.5"><rect width="0.5" height="0.5" fill="'+c+'"/><circle cx="0.12" cy="0.2" r="0.01" fill="rgba(0,0,0,.18)"/><circle cx="0.37" cy="0.41" r="0.008" fill="rgba(255,255,255,.12)"/></pattern>';
  if(mat==='vinyl')return'<pattern id="'+pid+'" patternUnits="userSpaceOnUse" width="1.2" height="0.44"><rect width="1.2" height="0.44" fill="'+c+'"/><path d="M0 0.22H1.2M0 0.44H1.2M0.8 0V0.22M0.2 0.22V0.44" stroke="rgba(0,0,0,.12)" stroke-width="0.008"/><path d="M0.1 0.07H0.7M0.5 0.31H1.1" stroke="rgba(255,255,255,.04)" stroke-width="0.05"/></pattern>';
  return'<pattern id="'+pid+'" patternUnits="userSpaceOnUse" width="0.9" height="0.18"><rect width="0.9" height="0.18" fill="'+c+'"/><path d="M0 0.18H0.9M0.45 0V0.18" stroke="rgba(0,0,0,.28)" stroke-width="0.012"/><path d="M0 0.09H0.9" stroke="rgba(255,255,255,.05)" stroke-width="0.04"/></pattern>';
}
// Vacuum colours (v6.51.0): the robot, its dry line, the mop's wet band and how strong the band is.
// Several vacuums on one plan get their own colours from RFP_VAC_PALETTE unless set per vacuum.
const RFP_VAC_DEF={night:{robot:'#03a9f4',dry:'#8ecbff',wet:'#7dd3fc',wetOpacity:0.28},clay:{robot:'#0284c7',dry:'#0284c7',wet:'#0ea5e9',wetOpacity:0.2},
  neon:{robot:'#00e5ff',dry:'#00e5ff',wet:'#00ffc6',wetOpacity:0.18},blueprint:{robot:'#9fd3ff',dry:'#e6f1ff',wet:'#9fd3ff',wetOpacity:0.25},
  sketch:{robot:'#2563eb',dry:'#2563eb',wet:'#2a9d8f',wetOpacity:0.2}};
const RFP_VAC_PALETTE=['#03a9f4','#f59e0b','#a855f7','#22c55e','#ef4444','#ec4899'];
function rfpVacT(T){const d=RFP_VAC_DEF[T&&T.name]||RFP_VAC_DEF.night,v=(T&&T.vac)||{};return{robot:v.robot||d.robot,dry:v.dry||d.dry,wet:v.wet||d.wet,wetOpacity:rfpNum(v.wetOpacity)>=0?rfpNum(v.wetOpacity):d.wetOpacity};}
// Door / window colours (v6.49.0): glass, glass of an open window, the blind, a door leaf.
function rfpWinT(T){const w=(T&&T.win)||{};return{glass:w.glass||'#8fc7ff',open:w.open||'#5eead4',blind:w.blind||'#c9b79c',door:w.door||'#8a6a4f'};}
// contact-sensor states that mean open (binary_sensor on; a cover-like or text sensor open)
const RFP_OPEN=['on','open','opening'];
function rfpClone(o){return JSON.parse(JSON.stringify(o));}
function rfpSetPath(o,path,v){
  const ks=String(path).split('.');let cur=o;
  for(let i=0;i<ks.length-1;i++){if(!cur[ks[i]]||typeof cur[ks[i]]!=='object')cur[ks[i]]={};cur=cur[ks[i]];}
  cur[ks[ks.length-1]]=v;
}
// Which theme is active: theme_by.<profile> (portrait / landscape) wins, then theme_by.dark /
// theme_by.light (Home Assistant's dark mode), then `theme`, then night.
function rfpThemeName(fp,profile,dark){
  const by=fp&&fp.theme_by&&typeof fp.theme_by==='object'?fp.theme_by:{};
  const pick=function(v){return v&&RFP_THEMES[v]?v:null;};
  return pick(by[profile])||pick(dark?by.dark:by.light)||pick(fp&&fp.theme)||'night';
}
function rfpTheme(fp,profile,dark){
  const name=rfpThemeName(fp,profile,dark);
  const T=rfpClone(RFP_THEMES[name]);T.name=name;
  const ov=fp&&fp.overrides&&typeof fp.overrides==='object'?fp.overrides:{};
  for(const k in ov)rfpSetPath(T,k,ov[k]);
  const wall=fp&&fp.wall&&typeof fp.wall==='object'?fp.wall:{};
  if(T.wall&&rfpNum(wall.height)>=0)T.wall.h=rfpNum(wall.height);
  return T;
}
