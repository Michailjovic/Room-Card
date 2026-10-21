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
    floor:{wood:'#5a3e2b',tile:'#cfcac2',carpet:'#3c3f47',concrete:'#55585c',none:'#2a2e34'},floorStyle:'pattern',
    wall:{side:'#20252c',side2:'#20252c',top:'#3a414b',h:0.42,w:0.12},
    label:{font:'sans',c:'#e8eaed',sub:'#9aa3ad',chip:'rgba(10,12,15,.72)'},
    light:'pool',lightColor:'#ffb35c',heat:'pipes',heatColor:'#ff7a63',coolColor:'#8fb8ff',door:'gap',shadow:'hard'},
  clay:{mode:'plan',proj:'iso',dark:false,bg:'#efe9e1',bg2:'#e4ddd3',
    floor:{wood:'#e7c9a6',tile:'#e9e6e1',carpet:'#d9d2e8',concrete:'#d8d4ce',none:'#ece6dd'},floorStyle:'pattern',
    wall:{side:'#f6f2ec',side2:'#ddd4c8',top:'#ffffff',h:0.55,w:0.12},
    label:{font:'sans',c:'#3a332c',sub:'#7a6f63',chip:'rgba(255,255,255,.85)'},
    light:'pool',lightBlend:'multiply',lightColor:'#ffb35c',heat:'pipes-soft',heatColor:'#f2836b',door:'gap',shadow:'soft'},
  neon:{mode:'plan',proj:'iso',dark:true,bg:'#05060a',
    floor:{wood:'#0b0d14',tile:'#0b0d14',carpet:'#0b0d14',concrete:'#0b0d14',none:'#0b0d14'},floorStyle:'flat',
    wall:{side:'rgba(80,120,255,.07)',side2:'rgba(80,120,255,.07)',top:'#5b7cff',h:0.5,w:0.12,edge:true},
    label:{font:'mono',c:'#d6e0ff',sub:'#7d8bbd',chip:'rgba(5,6,10,.8)'},
    light:'edge',lightColor:'#ffcf7a',heat:'edge',heatColor:'#ff4d6d',door:'gap'},
  blueprint:{mode:'plan',proj:'top',dark:true,bg:'#0d3b66',
    floorStyle:'outline',line:'#e6f1ff',line2:'rgba(230,241,255,.35)',
    label:{font:'mono',c:'#e6f1ff',sub:'#9fc4ea',chip:'none'},
    light:'hatch',lightColor:'#ffd166',heat:'dashed',heatColor:'#ff9f8a',door:'arc',dims:true},
  thermal:{mode:'thermal',proj:'top',dark:true,bg:'#101317',line:'#101317',
    label:{font:'sans',c:'#ffffff',sub:'rgba(255,255,255,.8)',chip:'none'},
    range:[21,24],stops:[[38,70,83],[42,157,143],[233,196,106],[244,162,97],[231,111,81]],heat:'faint'},
  tiles:{mode:'tiles',proj:'top',dark:false,bg:'#f3f4f6',
    label:{font:'sans',c:'#111827',sub:'#6b7280',chip:'none'},
    tile:{bg:'#ffffff',on:'#fff8eb',line:'#e5e7eb',onLine:'#f2c46d',r:18,icon:'#f3f4f6',iconOn:'#fde68a',ink:'#4b5563',inkOn:'#92400e',heatBg:'#fecaca',heatInk:'#991b1b'}},
  sketch:{mode:'plan',proj:'top',dark:false,bg:'#f4eee2',
    floorStyle:'sketch',line:'#3b3227',line2:'rgba(59,50,39,.55)',
    label:{font:'hand',c:'#3b3227',sub:'#7a6a55',chip:'none',scale:1.45},
    light:'scribble',lightColor:'#e9a23b',heat:'squiggle',heatColor:'#d1495b',door:'arc',rough:true,paper:true},
};
const RFP_THEME_NAMES=Object.keys(RFP_THEMES);
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
