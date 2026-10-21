// ---- v3 → v4 auto-migration ---------------------------------------------------
// Configs without a layout: block are converted in memory on load (clean cut —
// the 4-tier engine is gone). The editor offers saving the migrated config.
const ROC_ELEMENT_KEYS=['overlays','zones','badges','elements','icons','labels','gauges','vacuum_widgets','glows','blinds','groups'];
function rocMigScalar(v){
  if(v==null||typeof v!=='object'||Array.isArray(v))return v;
  if(v.portrait!=null||v.landscape!=null)return v;
  const p=v.mobile!=null?v.mobile:(v.tablet!=null?v.tablet:(v.desktop!=null?v.desktop:v.ultrawide));
  const l=v.desktop!=null?v.desktop:(v.ultrawide!=null?v.ultrawide:(v.tablet!=null?v.tablet:v.mobile));
  if(p!=null&&l!=null&&p===l)return p;
  const o={};if(p!=null)o.portrait=p;if(l!=null)o.landscape=l;
  return Object.keys(o).length?o:undefined;
}
function rocMigItem(it){
  if(!it||typeof it!=='object')return;
  if(it.mobile&&!it.portrait)it.portrait=it.mobile;
  if(!it.landscape){const d=it.desktop||it.ultrawide||it.tablet;if(d)it.landscape=d;}
  delete it.mobile;delete it.tablet;delete it.desktop;delete it.ultrawide;
}
function rocMigMedia(list){
  (list||[]).forEach(function(cc){
    if(!cc||!cc.media||cc.media==='all')return;
    const set={};
    String(cc.media).split(',').map(function(s){return s.trim();}).forEach(function(t){
      if(t==='portrait'||t==='mobile')set.portrait=1;
      else if(t==='landscape'||t==='desktop'||t==='tablet'||t==='ultrawide')set.landscape=1;
    });
    const out=Object.keys(set);
    cc.media=out.length>=2?'all':(out[0]||'all');
  });
}
function rocMigRoom(r){
  if(!r)return;
  ROC_ELEMENT_KEYS.forEach(function(k){(r[k]||[]).forEach(rocMigItem);});
  rocMigMedia(r.cards_above);rocMigMedia(r.cards_below);
  if(r.light_controls&&r.light_controls.height!=null){
    const hv=rocMigScalar(r.light_controls.height);
    if(hv===undefined)delete r.light_controls.height;else r.light_controls.height=hv;
  }
}
// Generate a layout block approximating the old stacked v3 look.
function rocGenLayout(cfg){
  const rooms=Array.isArray(cfg.rooms)&&cfg.rooms.length?cfg.rooms:[cfg];
  const has=function(k){
    const hv=function(x){return!!(x&&x[k]&&(!Array.isArray(x[k])||x[k].length));};
    return hv(cfg)||rooms.some(hv);
  };
  const wantNav=Array.isArray(cfg.rooms)&&cfg.rooms.length>1&&((cfg.nav&&cfg.nav.style)!=='none');
  const navSide=wantNav&&cfg.nav&&(cfg.nav.position==='left'||cfg.nav.position==='right');
  const wantAbove=has('cards_above'),wantBelow=has('cards_below'),wantLights=has('light_controls');
  // Any blind docking its control in the given profile → the layout needs a cover region
  const dockIn=function(profile){
    const blinds=(cfg.blinds||[]).concat.apply([],rooms.map(function(r){return(r&&r.blinds)||[];}));
    return blinds.some(function(b){
      if(!b||!b.control)return false;
      const ctl=b.control===true?{}:b.control;
      const pv=(ctl.placement&&typeof ctl.placement==='object')?ctl.placement[profile]:ctl.placement;
      const dv=(ctl.display&&typeof ctl.display==='object')?ctl.display[profile]:ctl.display;
      return pv==='dock'||dv==='dock';
    });
  };
  const mk=function(side,dock){
    const rows=[],place={};let r=1;
    const dockCol=dock&&!side; // landscape without a side nav → dock as a right column
    if(wantNav&&!side){rows.push(8);place.nav={row:r++};}
    if(wantAbove){rows.push(12);place.cards_above={row:r++};}
    if(wantLights){rows.push(7);place.lights={row:r++};}
    const imgRow=r++;rows.push(0);place.image={row:imgRow};
    if(wantBelow){rows.push(12);place.cards_below={row:r++};}
    if(dock&&!dockCol){rows.push(14);place.cover={row:r++};} // stacked (bottom) cover strip
    rows[imgRow-1]=Math.max(20,100-rows.reduce(function(a,b){return a+b;},0));
    if(side){
      place.nav={row:'1/'+(rows.length+1),col:cfg.nav.position==='left'?1:2};
      const oc=cfg.nav.position==='left'?2:1;
      ['cards_above','lights','image','cards_below','cover'].forEach(function(k){if(place[k])place[k].col=oc;});
      return{columns:cfg.nav.position==='left'?[15,85]:[85,15],rows:rows,place:place};
    }
    if(dockCol){
      place.cover={row:'1/'+(rows.length+1),col:2};
      return{columns:[88,12],rows:rows,place:place};
    }
    return{columns:[100],rows:rows,place:place};
  };
  return{height:'viewport',portrait:mk(false,dockIn('portrait')),landscape:mk(navSide,dockIn('landscape'))};
}
function rocMigrateLayout(cfg){
  if(!cfg||typeof cfg!=='object'||cfg.layout)return cfg;
  const c=rocClone(cfg);
  ['aspect_ratio','border_radius'].forEach(function(k){
    const v=rocMigScalar(c[k]);
    if(v===undefined)delete c[k];else if(v!=null)c[k]=v;
  });
  c.layout=rocGenLayout(c); // generate BEFORE nav.position is normalised
  delete c.max_height;delete c.breakpoints;delete c.mobile_breakpoint;
  if(c.nav){delete c.nav.auto_breakpoint;if(c.nav.position==='auto')c.nav.position='top';}
  rocMigRoom(c);
  (c.rooms||[]).forEach(rocMigRoom);
  try{console.info('[room-overlay-card] v3 config auto-migrated to the v4 layout engine (in memory only). Open the card editor to review & save — see LAYOUT.md.');}catch(_){}
  return c;
}
