// ----- The view --------------------------------------------------------------------------------
// One instance per mounted floor plan page. render() rebuilds the static SVG (geometry, theme,
// size); _apply() only touches the nodes that show state, and only when a room's state changed.
// opts: {cfg (the floorplan block), cAll (the card config), hass, profile, lang, studio,
//        interactive (default true), exec(action) (the card's action runner), onRender(view)}
const RFP_CSS='.rfp-heat .rfp-w,.rfp-heat .rfp-c{opacity:0;transition:opacity .8s ease}'
  +'.rfp-heat.is-heat .rfp-w{opacity:1}.rfp-heat.is-idle .rfp-c{opacity:.35}.rfp-heat.is-heat .rfp-c{opacity:.4}'
  +'.rfp-flow{animation:rfp-flow 3s linear infinite}@keyframes rfp-flow{to{stroke-dashoffset:-1.5}}'
  +'.rfp-light{transition:opacity .8s ease}.rfp-ease{transition:fill .8s ease,stroke .8s ease}'
  +'.rfp-hit{cursor:pointer;-webkit-tap-highlight-color:transparent}.rfp-hit:focus{outline:none}'
  +'.rfp-pulse{animation:rfp-pulse 2.4s ease-in-out infinite}@keyframes rfp-pulse{0%,100%{opacity:.5}50%{opacity:1}}'
  +'.rfp-person,.rfp-sig{transition:transform .6s ease,opacity .4s ease}'
  +'.rfp-ping{animation:rfp-ping 2.2s ease-out infinite;transform-box:fill-box;transform-origin:center}@keyframes rfp-ping{0%{transform:scale(.7);opacity:.9}100%{transform:scale(2);opacity:0}}'
  +'.rfp-bob{animation:rfp-bob 1.4s ease-in-out infinite}@keyframes rfp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}'
  +'.rfp-paused .rfp-flow,.rfp-paused .rfp-pulse,.rfp-paused .rfp-ping,.rfp-paused .rfp-bob{animation-play-state:paused}'
  +'@media (prefers-reduced-motion:reduce){.rfp-flow,.rfp-pulse,.rfp-ping,.rfp-bob{animation:none}.rfp-light,.rfp-heat .rfp-w,.rfp-heat .rfp-c,.rfp-person,.rfp-sig{transition:none}}';
// Markers and labels on the plan (v6.48.0) are HTML over the SVG: they carry ha-icon.
const RFP_ITEM_CSS='.rfp-items{position:absolute;inset:0;pointer-events:none;overflow:hidden;}'
  +'.rfp-it{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;}'
  +'.rfp-it.on-tap{cursor:pointer;pointer-events:auto;}'
  +'.rfp-it-ic{width:var(--rfp-isz,34px);height:var(--rfp-isz,34px);border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--rfp-ibg);color:var(--rfp-ink);box-shadow:0 2px 6px rgba(0,0,0,.35);--mdc-icon-size:calc(var(--rfp-isz,34px) * .56);transition:background .4s ease,color .4s ease,box-shadow .4s ease;}'
  +'.rfp-it.is-on .rfp-it-ic{background:var(--rfp-on);color:#1a1206;box-shadow:0 0 12px var(--rfp-on);}'
  +'.rfp-it.na .rfp-it-ic{opacity:.45;}'
  +'.rfp-it-tx{font:600 12px/1.3 var(--rfp-font);color:var(--rfp-ink);background:var(--rfp-ibg);padding:1px 7px;border-radius:9px;white-space:nowrap;font-variant-numeric:tabular-nums;}'
  +'.rfp-it-label .rfp-it-tx{font-size:13px;padding:3px 9px;border-radius:11px;}'
  +'.rfp-it-label.is-on .rfp-it-tx{color:var(--rfp-on);}';
// Domains a marker toggles on tap (else more-info), and states that count as "off"
const RFP_TOGGLE=['light','switch','fan','input_boolean','cover','humidifier']; // tap toggles these; never a lock, valve or siren by accident
const RFP_OFF=['off','closed','idle','standby','unavailable','unknown','docked','paused','none','','locked','not_home','away'];
const RFP_MEDIA_ON=['playing','on','paused','buffering'];
class RfpView{
  constructor(host,opts){
    this.host=host;this.uid='rfp'+(++rfpUid);this.o=Object.assign({interactive:true},opts||{});
    this.svg=document.createElementNS(RFP_NS,'svg');
    this.svg.setAttribute('class','rfp-svg');
    this.svg.setAttribute('role','img');
    this.svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;user-select:none;-webkit-user-select:none;touch-action:pan-y pinch-zoom;';
    host.appendChild(this.svg);
    this.items=document.createElement('div');
    this.items.className='rfp-items';
    host.appendChild(this.items);
    this._st={};this.W=0;this.H=0;
    const self=this;
    if(typeof ResizeObserver!=='undefined'){
      this._ro=new ResizeObserver(function(){const r=self._size();if(Math.abs(r[0]-self.W)>0.5||Math.abs(r[1]-self.H)>0.5)self.render();});
      this._ro.observe(host);
    }
    if(typeof IntersectionObserver!=='undefined'){
      this._io=new IntersectionObserver(function(es){for(const e of es)self.svg.classList.toggle('rfp-paused',!e.isIntersecting);});
      this._io.observe(host);
    }
    this._wire(this.svg);this._wire(this.items);
    this.render();
  }
  destroy(){
    if(this._ro)this._ro.disconnect();if(this._io)this._io.disconnect();
    clearTimeout(this._holdT);this._dead=true;
    // the SVG stays: the card may be showing it frozen under a zoom transition
  }
  setOptions(o){Object.assign(this.o,o||{});this.render();}
  setHass(h){
    this.o.hass=h;
    const dark=this._dark();
    if(dark!==this._lastDark&&this.o.cfg&&this.o.cfg.theme_by){this.render();return;}
    this._apply(false);
  }
  _dark(){const h=this.o.hass;return!!(h&&h.themes&&h.themes.darkMode);}
  _lang(){const h=this.o.hass;return String(this.o.lang||(h&&((h.locale&&h.locale.language)||h.language))||'en').split('-')[0];}
  _size(){
    const r=this.host.getBoundingClientRect();
    return[r.width||this.host.clientWidth||0,r.height||this.host.clientHeight||0];
  }
  // ---- model: the configured rooms and openings, linked to the card's rooms ----
  _model(){
    const fp=this.o.cfg||{},cAll=this.o.cAll||{},cardRooms=Array.isArray(cAll.rooms)?cAll.rooms:[];
    const rooms=[];
    (Array.isArray(fp.rooms)?fp.rooms:[]).forEach(function(r,i){
      if(!r||typeof r!=='object')return;
      const poly=rfpPoly(r.polygon);if(poly.length<3)return;
      let link=-1;
      if(r.room!=null&&r.room!=='')for(let k=0;k<cardRooms.length;k++)if(cardRooms[k]&&String(cardRooms[k].id)===String(r.room)){link=k;break;}
      const cr=link>=0?cardRooms[link]:null;
      const name=r.name||(cr&&cr.overview_tile&&cr.overview_tile.name)||(cr&&cr.name)||r.room||('#'+(i+1));
      const list=function(v){return(Array.isArray(v)?v:(v?[v]:[])).map(function(x){return x&&typeof x==='object'?String(x.entity||''):String(x);}).filter(Boolean);};
      rooms.push({i:i,cfg:r,poly:poly,name:String(name),link:link,floor:r.floor||'wood',media:list(r.media),
        lights:list(r.lights),climate:r.climate?String(r.climate):'',temp:r.temperature?String(r.temperature):'',hum:r.humidity?String(r.humidity):'',
        pole:rfpPole(poly),bbox:rfpBBox(poly),area:Math.abs(rfpArea(poly))});
    });
    const openings=(Array.isArray(fp.openings)?fp.openings:[]).filter(function(o){return o&&(o.type||'door')==='door';}).map(function(o,k){
      const at=rfpPoly([o.at])[0];return at?{k:k,at:at,width:rfpNum(o.width)>0?rfpNum(o.width):0.8,cfg:o}:null;
    }).filter(Boolean);
    // markers and labels placed on the plan (v6.48.0)
    const items=(Array.isArray(fp.items)?fp.items:[]).map(function(it,k){
      if(!it||typeof it!=='object')return null;
      const at=rfpPoly([it.at])[0];if(!at)return null;
      return{k:k,cfg:it,at:at,type:it.type==='label'?'label':'marker',entity:it.entity?String(it.entity):''};
    }).filter(Boolean);
    return{rooms:rooms,openings:openings,items:items};
  }
  // Which layers are drawn (floorplan.layers; all on by default)
  _layers(){
    const l=this.o.cfg&&this.o.cfg.layers&&typeof this.o.cfg.layers==='object'?this.o.cfg.layers:{};
    const o={};['lights','heating','labels','presence','media','attention','vacuum','items'].forEach(function(k){o[k]=l[k]!==false;});
    return o;
  }
  // ---- static render ----
  render(){
    if(this._dead)return;
    const sz=this._size();this.W=sz[0];this.H=sz[1];
    const W=this.W,H=this.H;
    this._lastDark=this._dark();
    const fp=this.o.cfg||{};
    const T=this.T=rfpTheme(fp,this.o.profile||'landscape',this._lastDark);
    const q=this.q=(fp.quality==='low'||fp.quality==='high')?fp.quality:'auto';
    this.fx=q!=='low';
    const M=this.M=this._model();
    this.L=this._layers();
    this._st={};this._nodes=null;this._pSig='';
    if(!(W>2&&H>2)){this.svg.innerHTML='';this.items.innerHTML='';return;}
    this.svg.setAttribute('viewBox','0 0 '+rfpN(W)+' '+rfpN(H));
    const lang=this._lang();
    let proj=fp.projection&&fp.projection!=='auto'&&RFP_PROJ[fp.projection]?fp.projection:T.proj;
    if(T.mode!=='plan')proj='top';
    const all=[];M.rooms.forEach(function(r){r.poly.forEach(function(p){all.push(p);});});
    const trace=this.o.studio&&fp.trace&&fp.trace.image?fp.trace:null;
    if(trace){const tb=this._traceBox(trace);if(tb){all.push([tb[0],tb[1]],[tb[2],tb[3]]);}}
    const pad=Math.max(14,Math.min(W,H)*0.06);
    const wallH=proj==='top'?0:((T.wall&&T.wall.h)||0.45);
    // rotate: a number of degrees, or auto (default) — a quarter turn when it makes the plan clearly
    // bigger, e.g. a long flat on a phone held upright
    const padB=T.mode==='thermal'?{l:pad,r:pad,t:pad,b:pad+44}:(T.dims?{l:pad+10,r:pad+36,t:pad+34,b:pad+10}:pad);
    let rot=rfpNum(fp.rotate);
    if(!isFinite(rot)&&all.length){const s0=rfpFit(all,proj,0,W,H,padB,wallH).S,s9=rfpFit(all,proj,90,W,H,padB,wallH).S;rot=s9>s0*1.25?90:0;}
    this.rot=isFinite(rot)?rot:0;
    const F=this.F=rfpFit(all.length?all:[[0,0],[10,5]],proj,this.rot,W,H,T.mode==='thermal'?{l:pad,r:pad,t:pad,b:pad+44}:(T.dims?{l:pad+10,r:pad+36,t:pad+34,b:pad+10}:pad),wallH);
    const fs=Math.max(12,Math.min(17,F.S*0.26))*((T.label&&T.label.scale)||1);
    this.fs=fs;
    const mat='matrix('+[F.m[0],F.m[1],F.m[2],F.m[3],F.e,F.f].map(function(v){return+v.toFixed(5);}).join(' ')+')';
    const id=this.uid;
    let s='<style>'+RFP_CSS+'</style><defs>'+this._defs(T,M,F)+'</defs>';
    s+=T.bg2?'<rect width="'+W+'" height="'+H+'" fill="url(#'+id+'-bg)"/>':'<rect width="'+W+'" height="'+H+'" fill="'+T.bg+'"/>';
    if(trace)s+=this._traceSvg(trace,mat);
    if(!M.rooms.length){
      const font=RFP_FONT[(T.label&&T.label.font)||'sans'];
      s+='<text x="'+W/2+'" y="'+(H/2-6)+'" text-anchor="middle" font-family="'+rfpEsc(font)+'" font-size="'+Math.max(14,fs*1.1)+'" font-weight="600" fill="'+T.label.c+'">'+rfpEsc(rfpT(lang,'empty'))+'</text>'
        +'<text x="'+W/2+'" y="'+(H/2+16)+'" text-anchor="middle" font-family="'+rfpEsc(font)+'" font-size="'+Math.max(12,fs*0.85)+'" fill="'+T.label.sub+'">'+rfpEsc(rfpT(lang,'empty2'))+'</text>';
      s+='<g class="rfp-edit"></g>';
      this.svg.innerHTML=s;this.items.innerHTML='';this._afterRender();return;
    }
    if(T.mode==='tiles')s+=this._tiles(T,M,F);
    else if(T.mode==='thermal')s+=this._thermal(T,M,F,mat);
    else s+=this._plan(T,M,F,mat,proj);
    // hit areas (floor polygons, above everything but labels' pointer-free chips)
    if(T.mode!=='tiles'){
      s+='<g transform="'+mat+'">';
      M.rooms.forEach(function(r,k){s+='<polygon class="rfp-hit" data-rfp-hit="'+k+'" points="'+rfpPts(r.poly)+'" fill="transparent"/>';});
      s+='</g>';
    }
    s+=this._personsSvg(T);
    s+='<g class="rfp-edit"></g>';
    this.svg.innerHTML=s;
    this._itemsHtml(T,M,F);
    this._afterRender();
  }
  _afterRender(){
    this.edit=this.svg.querySelector('.rfp-edit');
    this._collect();
    this._apply(true);
    if(typeof this.o.onRender==='function')try{this.o.onRender(this);}catch(e){console.warn('[room-overlay-card] floorplan onRender',e);}
  }
  _traceBox(t){
    const sc=rfpNum(t.scale);if(!(sc>0))return null;
    const w=rfpNum(t.width_px),h=rfpNum(t.height_px);if(!(w>0&&h>0))return null;
    const x=rfpNum(t.x)||0,y=rfpNum(t.y)||0;return[x,y,x+w*sc,y+h*sc];
  }
  _traceSvg(t,mat){
    const b=this._traceBox(t);if(!b)return'';
    const op=rfpNum(t.opacity);
    return'<g transform="'+mat+'" opacity="'+(op>=0&&op<=1?op:0.5)+'" pointer-events="none"><image href="'+rfpEsc(t.image)+'" x="'+b[0]+'" y="'+b[1]+'" width="'+rfpN(b[2]-b[0])+'" height="'+rfpN(b[3]-b[1])+'" preserveAspectRatio="none"/></g>';
  }
  _defs(T,M,F){
    const id=this.uid,fl=T.floor||{};let d='';
    if(T.bg2)d+='<radialGradient id="'+id+'-bg" cx="50%" cy="40%" r="75%"><stop offset="0%" stop-color="'+T.bg2+'"/><stop offset="100%" stop-color="'+T.bg+'"/></radialGradient>';
    if(T.vignette)d+='<radialGradient id="'+id+'-vg" cx="50%" cy="45%" r="70%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".35"/></radialGradient>';
    if(T.floorStyle==='pattern'){
      d+='<pattern id="'+id+'-wood" patternUnits="userSpaceOnUse" width="0.9" height="0.18"><rect width="0.9" height="0.18" fill="'+fl.wood+'"/><path d="M0 0.18H0.9M0.45 0V0.18" stroke="rgba(0,0,0,.28)" stroke-width="0.012"/><path d="M0 0.09H0.9" stroke="rgba(255,255,255,.05)" stroke-width="0.04"/></pattern>'
        +'<pattern id="'+id+'-tile" patternUnits="userSpaceOnUse" width="0.6" height="0.6"><rect width="0.6" height="0.6" fill="'+fl.tile+'"/><path d="M0 0H0.6M0 0V0.6" stroke="rgba(0,0,0,.14)" stroke-width="0.014"/></pattern>'
        +'<pattern id="'+id+'-carpet" patternUnits="userSpaceOnUse" width="0.12" height="0.12"><rect width="0.12" height="0.12" fill="'+fl.carpet+'"/><circle cx="0.06" cy="0.06" r="0.012" fill="rgba(255,255,255,.06)"/></pattern>'
        +'<pattern id="'+id+'-concrete" patternUnits="userSpaceOnUse" width="0.5" height="0.5"><rect width="0.5" height="0.5" fill="'+fl.concrete+'"/><circle cx="0.12" cy="0.2" r="0.01" fill="rgba(0,0,0,.18)"/><circle cx="0.37" cy="0.41" r="0.008" fill="rgba(255,255,255,.12)"/></pattern>';
    }
    d+='<radialGradient id="'+id+'-mg"><stop offset="0%" stop-color="'+(T.mediaColor||'#8ecbff')+'" stop-opacity=".75"/><stop offset="100%" stop-color="'+(T.mediaColor||'#8ecbff')+'" stop-opacity="0"/></radialGradient>';
    if(T.light==='hatch')d+='<pattern id="'+id+'-hatch" patternUnits="userSpaceOnUse" width="0.18" height="0.18" patternTransform="rotate(45)"><path d="M0 0V0.18" stroke="'+(T.lightColor||'#ffd166')+'" stroke-width="0.03"/></pattern>';
    if(this.fx){
      if(T.shadow==='soft')d+='<filter id="'+id+'-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="'+rfpN(Math.max(4,F.S*0.18))+'"/></filter>';
      if(T.rough)d+='<filter id="'+id+'-rough"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="'+rfpN(Math.max(2,F.S*0.05))+'"/></filter>';
      if(T.paper)d+='<filter id="'+id+'-paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="n"/><feColorMatrix in="n" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.07"/></feComponentTransfer></filter>';
    }
    M.rooms.forEach(function(r,k){
      d+='<clipPath id="'+id+'-c'+k+'"><polygon points="'+rfpPts(r.poly)+'"/></clipPath>';
      if(T.light==='pool'||T.light==='edge'){
        const b=r.bbox,rad=Math.min(2.6,Math.max(1.0,Math.max(b[2]-b[0],b[3]-b[1])*0.42));
        d+='<radialGradient id="'+id+'-lg'+k+'" gradientUnits="userSpaceOnUse" cx="'+rfpN(r.pole[0])+'" cy="'+rfpN(r.pole[1])+'" r="'+rfpN(rad)+'">'
          +'<stop offset="0%" data-rfp-stop="'+k+'" stop-color="'+T.lightColor+'" stop-opacity=".6"/><stop offset="50%" data-rfp-stop="'+k+'" stop-color="'+T.lightColor+'" stop-opacity=".16"/><stop offset="100%" stop-color="'+T.lightColor+'" stop-opacity="0"/></radialGradient>';
      }
    });
    return d;
  }
  // ---- spatial plan (night, clay, neon, blueprint, sketch) ----
  _plan(T,M,F,mat,proj){
    const id=this.uid,self=this,fx=this.fx,W=this.W,H=this.H;let s='';
    // ground shadow under the building (projected views)
    if(proj!=='top'&&T.shadow){
      const soft=T.shadow==='soft'&&fx;
      s+='<g'+(soft?' filter="url(#'+id+'-soft)"':'')+' opacity="'+(soft?0.35:0.55)+'"><g transform="'+mat+'">';
      M.rooms.forEach(function(r){s+='<polygon points="'+rfpPts(r.poly.map(function(p){return[p[0]+0.25,p[1]+0.35];}))+'" fill="#000"/>';});
      s+='</g></g>';
    }
    // floors + per-room heating and light, all in plan metres under one transform
    s+='<g'+(T.rough&&fx?' filter="url(#'+id+'-rough)"':'')+'><g transform="'+mat+'">';
    M.rooms.forEach(function(r,k){
      let fill='none',stroke='none';
      const mat0=['wood','tile','carpet','concrete','none'].indexOf(r.floor)>=0?r.floor:'wood';
      if(T.floorStyle==='pattern')fill=mat0==='none'?(T.floor.none||'#222'):'url(#'+id+'-'+mat0+')';
      else if(T.floorStyle==='flat')fill=(T.floor&&T.floor[mat0])||'#111';
      else if(T.floorStyle==='outline'){stroke=T.line;}
      else if(T.floorStyle==='sketch')fill='rgba(255,255,255,.35)';
      s+='<polygon points="'+rfpPts(r.poly)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="0.03"/>';
      s+='<g clip-path="url(#'+id+'-c'+k+')">'+self._heatSvg(T,r,k)+self._lightSvg(T,r,k)+self._mediaSvg(r,k)+'</g>';
    });
    s+='</g></g>';
    // walls
    const walls=[];M.rooms.forEach(function(r){rfpWallSegs(r.poly,M.openings).forEach(function(w){walls.push(w);});});
    if(proj==='top'){
      const col=T.line||(T.wall&&T.wall.top)||'#888';
      const ww=T.line?(T.rough?0.07:0.1):((T.wall&&T.wall.w)||0.12);
      s+='<g'+(T.rough&&fx?' filter="url(#'+id+'-rough)"':'')+'><g transform="'+mat+'" stroke="'+col+'" stroke-linecap="square">';
      walls.forEach(function(w){s+='<line x1="'+rfpN(w.a[0])+'" y1="'+rfpN(w.a[1])+'" x2="'+rfpN(w.b[0])+'" y2="'+rfpN(w.b[1])+'" stroke-width="'+ww+'"/>';});
      if(T.rough)walls.forEach(function(w){s+='<line x1="'+rfpN(w.a[0]+0.03)+'" y1="'+rfpN(w.a[1]+0.02)+'" x2="'+rfpN(w.b[0]-0.02)+'" y2="'+rfpN(w.b[1]+0.03)+'" stroke-width="0.02" opacity=".5"/>';});
      if(T.door==='arc'){
        const polys=M.rooms.map(function(r){return r.poly;});
        M.openings.forEach(function(o){
          const e=rfpOpeningEdge(o.at,polys);if(!e)return;
          const w=o.width,h=[o.at[0]-e.u[0]*w/2,o.at[1]-e.u[1]*w/2],leaf=[h[0]+e.n[0]*w,h[1]+e.n[1]*w],end=[o.at[0]+e.u[0]*w/2,o.at[1]+e.u[1]*w/2];
          const cr=e.u[0]*e.n[1]-e.u[1]*e.n[0];
          s+='<path d="M'+rfpN(h[0])+' '+rfpN(h[1])+'L'+rfpN(leaf[0])+' '+rfpN(leaf[1])+'A'+rfpN(w)+' '+rfpN(w)+' 0 0 '+(cr>0?0:1)+' '+rfpN(end[0])+' '+rfpN(end[1])+'" fill="none" stroke="'+(T.line2||col)+'" stroke-width="0.02"/>';
        });
      }
      s+='</g></g>';
    }else{
      const VD=rfpViewDir(F),wl=T.wall||{};
      const inAny=function(x,y){return M.rooms.some(function(r){return rfpInPoly(x,y,r.poly);});};
      walls.forEach(function(w){w.depth=((w.a[0]+w.b[0])/2)*VD[0]+((w.a[1]+w.b[1])/2)*VD[1];});
      walls.sort(function(a,b){return a.depth-b.depth;});
      const topW=Math.max(2,(wl.w||0.12)*F.S*0.55);
      s+='<g>';
      walls.forEach(function(w){
        const mx=(w.a[0]+w.b[0])/2,my=(w.a[1]+w.b[1])/2,e=0.08;
        const front=inAny(mx-VD[0]*e,my-VD[1]*e)&&!inAny(mx+VD[0]*e,my+VD[1]*e);
        const h=front?wl.h*0.3:wl.h;
        const A=rfpP(F,w.a[0],w.a[1],0),B=rfpP(F,w.b[0],w.b[1],0),C=rfpP(F,w.b[0],w.b[1],h),D=rfpP(F,w.a[0],w.a[1],h);
        const vert=Math.abs(w.a[0]-w.b[0])<Math.abs(w.a[1]-w.b[1]);
        s+='<polygon points="'+rfpPts([A,B,C,D])+'" fill="'+(vert?(wl.side2||wl.side):wl.side)+'"'+(wl.edge?' stroke="rgba(91,124,255,.35)" stroke-width="1"':'')+'/>';
        if(wl.edge)s+='<line x1="'+rfpN(D[0])+'" y1="'+rfpN(D[1])+'" x2="'+rfpN(C[0])+'" y2="'+rfpN(C[1])+'" stroke="'+wl.top+'" stroke-width="'+rfpN(topW*3)+'" stroke-linecap="round" opacity=".18"/>';
        s+='<line x1="'+rfpN(D[0])+'" y1="'+rfpN(D[1])+'" x2="'+rfpN(C[0])+'" y2="'+rfpN(C[1])+'" stroke="'+wl.top+'" stroke-width="'+rfpN(topW)+'" stroke-linecap="square"/>';
      });
      s+='</g>';
    }
    if(T.dims)s+=this._dims(T,M,F);
    if(this.L.labels)s+=this._labels(T,M,F);
    if(T.paper&&fx)s+='<rect width="'+W+'" height="'+H+'" filter="url(#'+id+'-paper)" pointer-events="none"/>';
    if(T.vignette)s+='<rect width="'+W+'" height="'+H+'" fill="url(#'+id+'-vg)" pointer-events="none"/>';
    return s;
  }
  _mediaSvg(r,k){
    if(!r.media.length||!this.L.media)return'';
    const p=r.pole,b=r.bbox,rad=Math.min(1.4,Math.max(0.7,Math.min(b[2]-b[0],b[3]-b[1])*0.3));
    return'<g class="rfp-light" data-rfp-mglow="'+k+'" opacity="0"><circle class="rfp-pulse" cx="'+rfpN(p[0])+'" cy="'+rfpN(p[1])+'" r="'+rfpN(rad)+'" fill="url(#'+this.uid+'-mg)"/></g>';
  }
  _heatSvg(T,r,k){
    if(!r.climate||!this.L.heating)return'';
    const h=T.heat,hc=T.heatColor||'#ff7a63';let w='',c='';
    if(h==='pipes'){
      const d=rfpSpiral(r.poly,0.26);
      w='<path d="'+d+'" fill="none" stroke="'+hc+'" stroke-width="0.1" opacity=".22"/><path class="rfp-flow" d="'+d+'" fill="none" stroke="'+hc+'" stroke-width="0.035" stroke-dasharray="1 .5"/>';
      c='<path d="'+d+'" fill="none" stroke="'+(T.coolColor||'#8fb8ff')+'" stroke-width="0.022" transform="translate(0.13,0.13)"/>';
    }else if(h==='pipes-soft'){
      const d=rfpSerp(r.poly,0.3);
      w='<path class="rfp-flow" d="'+d+'" fill="none" stroke="'+hc+'" stroke-width="0.06" stroke-linejoin="round" opacity=".6" stroke-dasharray="1.2 .3"/>';
      c='<path d="'+d+'" fill="none" stroke="'+hc+'" stroke-width="0.05" stroke-linejoin="round" opacity=".5"/>';
    }else if(h==='dashed'){
      const d=rfpSerp(r.poly,0.32);
      w='<path d="'+d+'" fill="none" stroke="'+hc+'" stroke-width="0.025" stroke-dasharray="0.12 0.08" opacity=".9"/>';
      c='<path d="'+d+'" fill="none" stroke="'+(T.line2||hc)+'" stroke-width="0.018" stroke-dasharray="0.12 0.08"/>';
    }else if(h==='edge'){
      w='<polygon points="'+rfpPts(r.poly)+'" fill="none" stroke="'+hc+'" stroke-width="0.3" opacity=".22"/><polygon points="'+rfpPts(r.poly)+'" fill="none" stroke="'+hc+'" stroke-width="0.09" opacity=".85"/>';
      c='<polygon points="'+rfpPts(r.poly)+'" fill="none" stroke="'+hc+'" stroke-width="0.05" opacity=".5"/>';
    }else if(h==='squiggle'){
      const d=rfpSerp(r.poly,0.45);
      w='<path d="'+d+'" fill="none" stroke="'+hc+'" stroke-width="0.04" opacity=".6"/>';
      c='<path d="'+d+'" fill="none" stroke="'+hc+'" stroke-width="0.03" opacity=".35" stroke-dasharray="0.1 0.1"/>';
    }else if(h==='faint'){
      const d=rfpSerp(r.poly,0.36);
      w='<path d="'+d+'" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="0.03"/>';
    }else return'';
    return'<g class="rfp-heat" data-rfp-heat="'+k+'"><g class="rfp-c">'+c+'</g><g class="rfp-w">'+w+'</g></g>';
  }
  _lightSvg(T,r,k){
    if(!r.lights.length||!this.L.lights)return'';
    const id=this.uid,b=r.bbox,p=r.pole;let s='';
    const box='x="'+rfpN(b[0]-1)+'" y="'+rfpN(b[1]-1)+'" width="'+rfpN(b[2]-b[0]+2)+'" height="'+rfpN(b[3]-b[1]+2)+'"';
    if(T.light==='pool')s='<rect '+box+' fill="url(#'+id+'-lg'+k+')" style="mix-blend-mode:'+(T.lightBlend||'screen')+'"/>';
    else if(T.light==='hatch')s='<circle cx="'+rfpN(p[0])+'" cy="'+rfpN(p[1])+'" r="0.9" fill="url(#'+id+'-hatch)" opacity=".7"/>';
    else if(T.light==='scribble')s='<polygon points="'+rfpPts(r.poly)+'" fill="rgba(255,196,90,.22)"/><circle cx="'+rfpN(p[0])+'" cy="'+rfpN(p[1])+'" r="0.75" fill="none" stroke="'+T.lightColor+'" stroke-width="0.05" stroke-dasharray="0.08 0.05"/>';
    else if(T.light==='edge')s='<polygon points="'+rfpPts(r.poly)+'" data-rfp-tint="'+k+'" fill="'+T.lightColor+'" opacity=".1"/><rect '+box+' fill="url(#'+id+'-lg'+k+')" opacity=".6"/><circle cx="'+rfpN(p[0])+'" cy="'+rfpN(p[1])+'" r="0.35" data-rfp-tint="'+k+'" fill="'+T.lightColor+'" opacity=".25"/><circle cx="'+rfpN(p[0])+'" cy="'+rfpN(p[1])+'" r="0.12" data-rfp-tint="'+k+'" fill="'+T.lightColor+'"/>';
    else return'';
    return'<g class="rfp-light" data-rfp-light="'+k+'" opacity="0">'+s+'</g>';
  }
  _labels(T,M,F){
    const L=T.label,font=rfpEsc(RFP_FONT[L.font]||RFP_FONT.sans),fs=this.fs,self=this;let s='<g pointer-events="none">';
    M.rooms.forEach(function(r,k){
      const p=rfpP(F,r.pole[0],r.pole[1],0);
      const pw=self._projW(r,F);
      const compact=r.area<3.5||pw<Math.max(r.name.length*fs*0.62+24,fs*7);
      r.compact=compact;
      s+='<g data-rfp-label="'+k+'" transform="translate('+rfpN(p[0])+','+rfpN(p[1])+')">';
      if(L.chip&&L.chip!=='none')s+='<rect data-rfp-chip="'+k+'" rx="'+(compact?7:10)+'" fill="'+L.chip+'"/>';
      if(compact)s+='<text data-rfp-name="'+k+'" y="'+rfpN(fs*0.35)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.82)+'" font-weight="600" fill="'+L.c+'"><tspan>'+rfpEsc(r.name)+'</tspan><tspan data-rfp-val="'+k+'" fill="'+L.sub+'" font-weight="500"></tspan></text>';
      else s+='<text data-rfp-name="'+k+'" y="'+rfpN(-fs*0.15)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs)+'" font-weight="600" fill="'+L.c+'">'+rfpEsc(r.name)+'</text>'
        +'<text data-rfp-val="'+k+'" y="'+rfpN(fs*0.95)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.78)+'" fill="'+L.sub+'"></text>';
      if(!compact&&r.media.length&&self.L.media)s+='<text data-rfp-media="'+k+'" y="'+rfpN(fs*2.05)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.72)+'" fill="'+(T.mediaColor||'#8ecbff')+'"></text>';
      if(T.dims)s+='<text y="'+rfpN(fs*(r.media.length&&!compact?3.1:2.25))+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.7)+'" fill="'+L.sub+'">'+(Math.round(r.area*10)/10).toLocaleString(self._lang())+' m²</text>';
      s+=self._badgesSvg(k,fs);
      s+='</g>';
    });
    return s+'</g>';
  }
  // attention (count of active section tiles) and vacuum badges; placed at the label's corners in _apply
  _badgesSvg(k,fs,fixed){
    let s='';
    const fx=fixed?' data-rfp-fixed="1"':'';
    if(this.L.attention)s+='<g class="rfp-sig" data-rfp-att="'+k+'"'+fx+' opacity="0"'+(fixed?' transform="'+fixed[0]+'"':'')+'><circle r="'+rfpN(fs*0.66)+'" fill="#ffb35c" stroke="rgba(0,0,0,.35)" stroke-width="1"/><text data-rfp-attn="'+k+'" y="'+rfpN(fs*0.25)+'" text-anchor="middle" font-family="'+rfpEsc(RFP_FONT.sans)+'" font-size="'+rfpN(fs*0.72)+'" font-weight="700" fill="#1a1206"></text></g>';
    if(this.L.vacuum)s+='<g class="rfp-sig" data-rfp-vac="'+k+'"'+fx+' opacity="0"'+(fixed?' transform="'+fixed[1]+'"':'')+'><g class="rfp-bob"><circle r="'+rfpN(fs*0.66)+'" fill="#03a9f4" stroke="rgba(0,0,0,.35)" stroke-width="1"/><circle r="'+rfpN(fs*0.42)+'" fill="none" stroke="#fff" stroke-width="1.5"/><circle cy="'+rfpN(-fs*0.18)+'" r="'+rfpN(fs*0.12)+'" fill="#fff"/></g></g>';
    return s;
  }
  // people (presence) — one token each, moved to the room they are in by _apply
  _personsSvg(T){
    if(!this.L.presence)return'';
    const ids=this._persons(),fs=this.fs;if(!ids.length)return'';
    const font=rfpEsc(RFP_FONT.sans);let s='<g pointer-events="none">';
    ids.forEach(function(id,i){
      s+='<g class="rfp-person" data-rfp-person="'+i+'" opacity="0" style="transform:translate(-100px,-100px)">'
        +'<circle class="rfp-ping" r="'+rfpN(fs*0.8)+'" fill="none" stroke="#7ee0b5" stroke-width="2"/>'
        +'<circle r="'+rfpN(fs*0.8)+'" fill="#7ee0b5" stroke="rgba(0,0,0,.35)" stroke-width="1"/>'
        +'<text data-rfp-pinit="'+i+'" y="'+rfpN(fs*0.3)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.82)+'" font-weight="700" fill="#06281a"></text></g>';
    });
    return s+'</g>';
  }
  _persons(){const p=this.o.persons;const l=typeof p==='function'?p():p;return Array.isArray(l)?l.filter(function(x){return typeof x==='string'&&x;}):[];}
  _anyvac(){const p=this.o.anyvac;const l=typeof p==='function'?p():p;return Array.isArray(l)?l:[];}
  // ---- markers and labels (HTML) ----
  _itemsHtml(T,M,F){
    const box=this.items;
    if(!this.L.items||!M.items.length){box.innerHTML='';return;}
    const inter=!!this.o.interactive,self=this;
    const chip=T.label.chip&&T.label.chip!=='none'?T.label.chip:(T.dark?'rgba(10,12,15,.72)':'rgba(255,255,255,.9)');
    box.style.cssText='--rfp-ibg:'+chip+';--rfp-ink:'+T.label.c+';--rfp-on:'+(T.lightColor||'#ffb35c')+';--rfp-font:'+RFP_FONT[T.label.font==='hand'?'hand':(T.label.font||'sans')]+';';
    let h='<style>'+RFP_ITEM_CSS+'</style>';
    M.items.forEach(function(it){
      const p=rfpP(F,it.at[0],it.at[1],0),c=it.cfg;
      const sz=c.size?' --rfp-isz:'+rfpEsc(c.size)+';':'';
      const on=c.color?' --rfp-on:'+rfpEsc(c.color)+';':'';
      h+='<div class="rfp-it rfp-it-'+it.type+(inter?' on-tap':'')+'" data-rfp-item="'+it.k+'" style="left:'+rfpN(p[0])+'px;top:'+rfpN(p[1])+'px;'+sz+on+'"'+(inter?' role="button" tabindex="0" aria-label="'+rfpEsc(c.name||it.entity||'')+'"':'')+'>';
      if(it.type==='marker')h+='<div class="rfp-it-ic"><ha-icon icon="'+rfpEsc(c.icon||self._defIcon(it.entity))+'"></ha-icon></div>'+(c.show_state||c.name?'<div class="rfp-it-tx" data-rfp-itx></div>':'');
      else h+='<div class="rfp-it-tx" data-rfp-itx></div>';
      h+='</div>';
    });
    box.innerHTML=h;
  }
  _defIcon(e){
    const d=String(e||'').split('.')[0];
    return{light:'mdi:lightbulb',switch:'mdi:toggle-switch',fan:'mdi:fan',cover:'mdi:window-shutter',climate:'mdi:thermostat',media_player:'mdi:television',
      sensor:'mdi:gauge',binary_sensor:'mdi:checkbox-blank-circle-outline',lock:'mdi:lock',camera:'mdi:cctv',vacuum:'mdi:robot-vacuum',person:'mdi:account',
      input_boolean:'mdi:toggle-switch',script:'mdi:script-text',scene:'mdi:palette',humidifier:'mdi:air-humidifier',water_heater:'mdi:water-boiler'}[d]||'mdi:circle-medium';
  }
  _itemState(it){
    const S=(this.o.hass&&this.o.hass.states)||{},c=it.cfg,st=it.entity?S[it.entity]:null;
    let raw=st?(c.attribute?(st.attributes||{})[c.attribute]:st.state):undefined;
    let on=false;
    if(st){
      const a=c.active_state;
      if(a!==undefined&&a!==null)on=Array.isArray(a)?a.map(String).indexOf(String(raw))>=0:String(raw)===String(a);
      else if(!c.attribute)on=RFP_OFF.indexOf(String(st.state))<0&&!isFinite(rfpNum(st.state));
    }
    let txt='';
    if(raw!==undefined&&raw!==null){
      const n=rfpNum(raw);
      if(isFinite(n)&&String(raw).trim()!==''&&!/^\d{4}-\d\d-\d\d/.test(String(raw)))txt=this._fmt(n,rfpNum(c.decimals)>=0?rfpNum(c.decimals):(Math.abs(n)<100&&n%1!==0?1:0));
      else txt=String(raw);
    }
    const unit=c.suffix!==undefined?String(c.suffix):(!c.attribute&&st&&st.attributes&&st.attributes.unit_of_measurement?' '+st.attributes.unit_of_measurement:'');
    const show=it.type==='label'||c.show_state;
    const t=(c.name&&it.type==='marker'?String(c.name)+(show?' ':''):'')+(show?(st?(c.prefix!==undefined?String(c.prefix):'')+txt+(txt!==''?unit:''):(c.text!==undefined?String(c.text):'—')):'');
    return{on:on,na:!!it.entity&&(!st||st.state==='unavailable'),text:it.type==='label'&&!it.entity&&c.text!==undefined?String(c.text):t};
  }
  itemPos(k){const it=this.M&&this.M.items.find(function(x){return x.k===k;});return it&&this.F?rfpP(this.F,it.at[0],it.at[1],0):null;}
  _projW(r,F){const xs=r.poly.map(function(p){return rfpP(F,p[0],p[1],0)[0];});return Math.max.apply(null,xs)-Math.min.apply(null,xs);}
  _dims(T,M,F){
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    M.rooms.forEach(function(r){r.poly.forEach(function(p){const q=rfpP(F,p[0],p[1],0);x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);});});
    const L=T.label,font=rfpEsc(RFP_FONT[L.font]||RFP_FONT.sans),c=T.line2||L.sub,fs=Math.max(10,this.fs*0.72),lang=this._lang();
    const ty=y0-18,rx=x1+18;
    const m=function(px){return(Math.round(px/F.S*100)/100).toLocaleString(lang,{minimumFractionDigits:2,maximumFractionDigits:2})+' m';};
    return'<g pointer-events="none" stroke="'+c+'" stroke-width="1">'
      +'<line x1="'+rfpN(x0)+'" y1="'+rfpN(ty)+'" x2="'+rfpN(x1)+'" y2="'+rfpN(ty)+'"/><line x1="'+rfpN(x0)+'" y1="'+rfpN(ty-6)+'" x2="'+rfpN(x0)+'" y2="'+rfpN(ty+6)+'"/><line x1="'+rfpN(x1)+'" y1="'+rfpN(ty-6)+'" x2="'+rfpN(x1)+'" y2="'+rfpN(ty+6)+'"/>'
      +'<line x1="'+rfpN(rx)+'" y1="'+rfpN(y0)+'" x2="'+rfpN(rx)+'" y2="'+rfpN(y1)+'"/><line x1="'+rfpN(rx-6)+'" y1="'+rfpN(y0)+'" x2="'+rfpN(rx+6)+'" y2="'+rfpN(y0)+'"/><line x1="'+rfpN(rx-6)+'" y1="'+rfpN(y1)+'" x2="'+rfpN(rx+6)+'" y2="'+rfpN(y1)+'"/>'
      +'<text stroke="none" x="'+rfpN((x0+x1)/2)+'" y="'+rfpN(ty-7)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs)+'" fill="'+L.sub+'">'+m(x1-x0)+'</text>'
      +'<text stroke="none" x="'+rfpN(rx+8)+'" y="'+rfpN((y0+y1)/2)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs)+'" fill="'+L.sub+'" transform="rotate(90 '+rfpN(rx+8)+' '+rfpN((y0+y1)/2)+')">'+m(y1-y0)+'</text></g>';
  }
  // ---- temperature map ----
  _thermal(T,M,F,mat){
    const id=this.uid,self=this,W=this.W,H=this.H,lang=this._lang();
    let s='<g transform="'+mat+'">';
    M.rooms.forEach(function(r,k){
      s+='<polygon class="rfp-ease" data-rfp-thermo="'+k+'" points="'+rfpPts(r.poly)+'" fill="#3a4048" stroke="'+T.line+'" stroke-width="0.14" stroke-linejoin="round"/>';
      s+='<g clip-path="url(#'+id+'-c'+k+')">'+self._heatSvg(T,r,k)+'</g>';
    });
    s+='</g><g pointer-events="none">';
    const fs=this.fs;
    M.rooms.forEach(function(r,k){
      const p=rfpP(F,r.pole[0],r.pole[1],0),pw=self._projW(r,F);
      const big=Math.max(16,Math.min(48,Math.min(pw*0.28,(r.compact=r.area<3.5)?26:48)));
      s+='<g data-rfp-label="'+k+'" transform="translate('+rfpN(p[0])+','+rfpN(p[1])+')" font-family="'+rfpEsc(RFP_FONT.sans)+'">'
        +'<text data-rfp-tn="'+k+'" y="'+rfpN(-big*0.72)+'" text-anchor="middle" font-size="'+rfpN(Math.max(10,fs*0.8))+'" font-weight="600" letter-spacing="0.08em" fill="#fff">'+rfpEsc(r.name.toUpperCase())+'</text>'
        +'<text data-rfp-tt="'+k+'" y="'+rfpN(big*0.32)+'" text-anchor="middle" font-size="'+rfpN(big)+'" font-weight="700" fill="#fff"></text>'
        +'<text data-rfp-th="'+k+'" y="'+rfpN(big*0.32+fs*1.25)+'" text-anchor="middle" font-size="'+rfpN(Math.max(10,fs*0.8))+'" fill="#fff"></text>'
        +self._badgesSvg(k,fs,['translate('+rfpN(Math.min(pw*0.4,big*1.6))+','+rfpN(-big*0.9)+')','translate('+rfpN(-Math.min(pw*0.4,big*1.6))+','+rfpN(-big*0.9)+')'])+'</g>';
    });
    s+='</g>';
    // legend
    const rg=this._range(),lw=Math.min(400,W*0.5),lx=(W-lw)/2,ly=H-34;
    s+='<defs><linearGradient id="'+id+'-tl">';
    for(let i=0;i<=4;i++)s+='<stop offset="'+(i*25)+'%" stop-color="'+rfpLerpColor(T.stops,i/4)+'"/>';
    s+='</linearGradient></defs><g pointer-events="none"><rect x="'+rfpN(lx)+'" y="'+ly+'" width="'+rfpN(lw)+'" height="8" rx="4" fill="url(#'+id+'-tl)"/>';
    [0,0.5,1].forEach(function(f){const v=rg[0]+(rg[1]-rg[0])*f;s+='<text x="'+rfpN(lx+lw*f)+'" y="'+(ly+24)+'" text-anchor="middle" font-family="'+rfpEsc(RFP_FONT.sans)+'" font-size="12" fill="#9aa3ad">'+(Math.round(v*10)/10).toLocaleString(lang)+'°</text>';});
    return s+'</g>';
  }
  _range(){const r=this.o.cfg&&this.o.cfg.temperature_range;return Array.isArray(r)&&r.length===2&&isFinite(rfpNum(r[0]))&&isFinite(rfpNum(r[1]))&&rfpNum(r[1])>rfpNum(r[0])?[rfpNum(r[0]),rfpNum(r[1])]:(this.T.range||[21,24]);}
  // ---- tiles ----
  _tiles(T,M,F){
    const tt=T.tile,font=rfpEsc(RFP_FONT.sans),pad=6,self=this,lang=this._lang();let s='';
    M.rooms.forEach(function(r,k){
      const b=r.bbox,A=rfpP(F,b[0],b[1],0),B=rfpP(F,b[2],b[3],0);
      const x=Math.min(A[0],B[0])+pad,y=Math.min(A[1],B[1])+pad,w=Math.abs(B[0]-A[0])-2*pad,h=Math.abs(B[1]-A[1])-2*pad;
      if(w<8||h<8)return;
      r.tile=[x,y,w,h];
      const small=w<200||h<120,tiny=w<150||h<90,roomy=w>=260&&h>=120;
      s+='<g data-rfp-tilebox="'+k+'"><rect class="rfp-ease rfp-hit" data-rfp-hit="'+k+'" data-rfp-tile="'+k+'" x="'+rfpN(x)+'" y="'+rfpN(y)+'" width="'+rfpN(w)+'" height="'+rfpN(h)+'" rx="'+tt.r+'" fill="'+tt.bg+'" stroke="'+tt.line+'" stroke-width="1.5"/>';
      const ix=x+(tiny?22:30),iy=y+(tiny?22:30);
      s+='<g pointer-events="none"><circle class="rfp-ease" data-rfp-ticon="'+k+'" cx="'+rfpN(ix)+'" cy="'+rfpN(iy)+'" r="'+(tiny?14:18)+'" fill="'+tt.icon+'"/>'
        +'<path class="rfp-ease" data-rfp-tbulb="'+k+'" transform="translate('+rfpN(ix)+','+rfpN(iy)+') scale('+(tiny?0.8:1)+')" d="M-5 4h10M-4 7h8M0 -9a6 6 0 0 0-4 10.5V4h8V1.5A6 6 0 0 0 0 -9z" fill="none" stroke="'+tt.ink+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
      const tx=tiny?x+12:x+(tiny?40:58),ty=tiny?y+(h>100?62:50):y+28;
      s+='<text x="'+rfpN(tx)+'" y="'+rfpN(ty)+'" font-family="'+font+'" font-size="'+(small?14:16)+'" font-weight="600" fill="'+T.label.c+'">'+rfpEsc(r.name)+'</text>'
        +'<text data-rfp-val="'+k+'" x="'+rfpN(tx)+'" y="'+rfpN(ty+(small?17:19))+'" font-family="'+font+'" font-size="'+(small?12:13)+'" fill="'+T.label.sub+'"></text>';
      s+=self._badgesSvg(k,tiny?12:14,['translate('+rfpN(x+w-16)+','+rfpN(y+16)+')','translate('+rfpN(x+w-(tiny?40:46))+','+rfpN(y+16)+')']);
      if(roomy)s+='<text data-rfp-big="'+k+'" x="'+rfpN(x+w-18)+'" y="'+rfpN(y+50)+'" text-anchor="end" font-family="'+font+'" font-size="38" font-weight="300" fill="'+T.label.c+'"></text>';
      s+='</g>';
      // controls: what a tap toggles / opens
      if(!tiny){
        const chips=[];
        if(r.lights.length)chips.push(['light',rfpT(lang,'light')]);
        if(r.climate)chips.push(['heat',rfpT(lang,'heat')]);
        const cw=Math.min(118,(w-32-8*Math.max(0,chips.length-1))/Math.max(1,chips.length)),cy=y+h-(small?46:58);
        let cx=x+16;
        chips.forEach(function(c){
          if(cx+cw>x+w-10)return;
          s+='<g class="rfp-hit" data-rfp-ctl="'+c[0]+':'+k+'"><rect class="rfp-ease" data-rfp-cbg="'+c[0]+':'+k+'" x="'+rfpN(cx)+'" y="'+rfpN(cy)+'" width="'+rfpN(cw)+'" height="'+(small?36:44)+'" rx="12" fill="'+tt.icon+'"/>'
            +'<text pointer-events="none" x="'+rfpN(cx+12)+'" y="'+rfpN(cy+(small?14:18))+'" font-family="'+font+'" font-size="11.5" fill="'+tt.ink+'" opacity=".85">'+rfpEsc(c[1])+'</text>'
            +'<text pointer-events="none" class="rfp-ease" data-rfp-cv="'+c[0]+':'+k+'" x="'+rfpN(cx+12)+'" y="'+rfpN(cy+(small?30:35))+'" font-family="'+font+'" font-size="14" font-weight="600" fill="'+tt.ink+'"></text></g>';
          cx+=cw+8;
        });
      }
    });
    return s;
  }
  // ---- state ----
  _collect(){
    const sv=this.svg,q=function(sel){return[].slice.call(sv.querySelectorAll(sel));};
    const by=function(list,attr){const m={};list.forEach(function(el){const k=el.getAttribute(attr);(m[k]=m[k]||[]).push(el);});return m;};
    this._nodes={
      light:by(q('[data-rfp-light]'),'data-rfp-light'),stop:by(q('[data-rfp-stop]'),'data-rfp-stop'),tint:by(q('[data-rfp-tint]'),'data-rfp-tint'),
      heat:by(q('[data-rfp-heat]'),'data-rfp-heat'),val:by(q('[data-rfp-val]'),'data-rfp-val'),chip:by(q('[data-rfp-chip]'),'data-rfp-chip'),
      label:by(q('[data-rfp-label]'),'data-rfp-label'),
      thermo:by(q('[data-rfp-thermo]'),'data-rfp-thermo'),tt:by(q('[data-rfp-tt]'),'data-rfp-tt'),th:by(q('[data-rfp-th]'),'data-rfp-th'),tn:by(q('[data-rfp-tn]'),'data-rfp-tn'),
      tile:by(q('[data-rfp-tile]'),'data-rfp-tile'),ticon:by(q('[data-rfp-ticon]'),'data-rfp-ticon'),tbulb:by(q('[data-rfp-tbulb]'),'data-rfp-tbulb'),big:by(q('[data-rfp-big]'),'data-rfp-big'),
      cbg:by(q('[data-rfp-cbg]'),'data-rfp-cbg'),cv:by(q('[data-rfp-cv]'),'data-rfp-cv'),
      media:by(q('[data-rfp-media]'),'data-rfp-media'),mglow:by(q('[data-rfp-mglow]'),'data-rfp-mglow'),
      att:by(q('[data-rfp-att]'),'data-rfp-att'),attn:by(q('[data-rfp-attn]'),'data-rfp-attn'),vac:by(q('[data-rfp-vac]'),'data-rfp-vac'),
      person:by(q('[data-rfp-person]'),'data-rfp-person'),pinit:by(q('[data-rfp-pinit]'),'data-rfp-pinit'),
      item:[].slice.call(this.items.querySelectorAll('[data-rfp-item]')),
    };
  }
  // A room's state from Home Assistant: lights (any on, colour of the first lit one, brightest
  // level), heating (heat / idle / off from the climate's hvac_action and state), temperature and
  // humidity (their sensors, else the climate's current_temperature / current_humidity).
  _roomState(r){
    const S=(this.o.hass&&this.o.hass.states)||{},T=this.T;
    const st={on:false,color:T.lightColor||'#ffb35c',bri:0,heat:null,t:NaN,h:NaN,known:false};
    for(const e of r.lights){
      const o=S[e];if(!o)continue;st.known=true;
      if(o.state!=='on')continue;
      const a=o.attributes||{};
      const b=rfpNum(a.brightness);const bri=isFinite(b)?Math.max(0.05,b/255):1;
      if(!st.on){
        if(Array.isArray(a.rgb_color)&&a.rgb_color.length===3)st.color='rgb('+a.rgb_color.map(function(v){return Math.round(rfpNum(v)||0);}).join(',')+')';
        else if(isFinite(rfpNum(a.color_temp_kelvin)))st.color=rfpKelvin(rfpNum(a.color_temp_kelvin));
      }
      st.on=true;st.bri=Math.max(st.bri,bri);
    }
    const c=r.climate&&S[r.climate];
    if(c){
      const a=c.attributes||{},act=a.hvac_action;
      st.heat=c.state==='off'||c.state==='unavailable'?'off':(act==='heating'||act==='preheating'?'heat':'idle');
      if(isFinite(rfpNum(a.current_temperature)))st.t=rfpNum(a.current_temperature);
      if(isFinite(rfpNum(a.current_humidity)))st.h=rfpNum(a.current_humidity);
    }
    const ts=r.temp&&S[r.temp];if(ts&&isFinite(rfpNum(ts.state)))st.t=rfpNum(ts.state);
    const hs=r.hum&&S[r.hum];if(hs&&isFinite(rfpNum(hs.state)))st.h=rfpNum(hs.state);
    st.media='';st.play=false;
    for(const e of r.media){
      const o=S[e];if(!o||RFP_MEDIA_ON.indexOf(o.state)<0)continue;
      const a=o.attributes||{};
      st.play=st.play||o.state==='playing'||o.state==='on';
      st.media=st.media||String(a.app_name||a.source||a.media_title||a.friendly_name||e);
    }
    return st;
  }
  _fmt(v,d){return isFinite(v)?v.toLocaleString(this._lang(),{minimumFractionDigits:d,maximumFractionDigits:d}):'';}
  // Cross-room signals for the plan's rooms: who is where, attention and vacuum (per card room from
  // the card, opts.attention()), matched to plan rooms by their link, else by the room's name.
  _signals(){
    const M=this.M,S=(this.o.hass&&this.o.hass.states)||{},L=this.L;
    const norm=function(v){return String(v==null?'':v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');};
    const byName=function(v){const n=norm(v);if(!n)return-1;for(let k=0;k<M.rooms.length;k++){const r=M.rooms[k];if(norm(r.name)===n||norm(r.cfg.room)===n)return k;}return-1;};
    const byCard=function(ci){if(ci==null||ci<0)return-1;for(let k=0;k<M.rooms.length;k++)if(M.rooms[k].link===ci)return k;return-1;};
    const rm=typeof this.o.roomMatch==='function'?this.o.roomMatch:function(){return-1;};
    const out={where:[],att:{},vac:{}};
    if(L.presence)this._persons().forEach(function(id,i){
      const st=S[id];let k=-1;
      if(st){k=byCard(rm(st.state));if(k<0)k=byName(st.state);}
      out.where[i]={k:k,name:st?String((st.attributes||{}).friendly_name||id):id};
    });
    if(L.attention&&typeof this.o.attention==='function'){
      const a=this.o.attention()||[];
      M.rooms.forEach(function(r,k){const x=r.link>=0?a[r.link]:null;if(x&&x.att)out.att[k]=x.att;});
    }
    if(L.vacuum)this._anyvac().forEach(function(id){
      const a=S[id]&&S[id].attributes;if(!a||!a.in_cleaning||!a.vacuum_room_name)return;
      const vr=(a.rooms||[]).find(function(x){return x&&x.name===a.vacuum_room_name;});
      let k=-1;
      if(vr&&vr.home_room_id)k=M.rooms.findIndex(function(r){return String(r.cfg.anyvac_room||'')===String(vr.home_room_id);});
      if(k<0)k=byName(a.vacuum_room_name);
      if(k<0)k=byCard(rm(a.vacuum_room_name));
      if(k>=0)out.vac[k]=true;
    });
    return out;
  }
  _apply(force){
    const N=this._nodes;if(!N||!this.M)return;
    const T=this.T,self=this,lang=this._lang();
    const SG=this._signals();
    this.M.rooms.forEach(function(r,k){
      const st=self._roomState(r);
      st.att=SG.att[k]||0;st.vac=!!SG.vac[k];
      const sig=JSON.stringify(st);
      if(!force&&self._st[k]===sig)return;
      self._st[k]=sig;
      const set=function(list,fn){(list||[]).forEach(fn);};
      const val=[isFinite(st.t)?self._fmt(st.t,1)+'°':'',isFinite(st.h)?self._fmt(st.h,0)+' %':''].filter(Boolean).join(' · ');
      // lights
      const str=st.on?(0.35+0.65*st.bri):0;
      set(N.light[k],function(el){el.setAttribute('opacity',rfpN(str));});
      set(N.stop[k],function(el){el.setAttribute('stop-color',st.color);});
      set(N.tint[k],function(el){el.setAttribute('fill',st.color);});
      set(N.heat[k],function(el){el.setAttribute('class','rfp-heat'+(st.heat?' is-'+st.heat:''));});
      // media
      set(N.mglow[k],function(el){el.setAttribute('opacity',st.play?'1':(st.media?'0.45':'0'));});
      set(N.media[k],function(el){el.textContent=st.media?(st.play?'▶ ':'❚❚ ')+st.media:'';});
      // labels (a playing room gets ▶ on a compact label)
      set(N.val[k],function(el){el.textContent=r.compact&&T.mode==='plan'?((val?'  '+val:'')+(st.media&&!N.media[k]?'  ▶':'')):val;});
      // label box: measured when the browser lays the text out; estimated otherwise (hidden, jsdom)
      if(N.label[k]&&T.mode==='plan'){
        const fs=self.fs,g=N.label[k][0];let tw=0;
        [].forEach.call(g.querySelectorAll('text'),function(t){try{tw=Math.max(tw,t.getComputedTextLength());}catch(_){}});
        if(!(tw>0)){const nameW=r.name.length*fs*(r.compact?0.5:0.58),valW=val.length*fs*(r.compact?0.46:0.47);tw=Math.max(nameW+(r.compact?valW:0),r.compact?0:valW,(st.media.length+2)*fs*0.4);}
        const w=tw+(r.compact?20:28),h=r.compact?fs*1.55:fs*(N.media[k]&&st.media?3.75:2.75),y0=r.compact?-h/2:-fs*1.45;
        set(N.chip[k],function(el){el.setAttribute('x',rfpN(-w/2));el.setAttribute('y',rfpN(y0));el.setAttribute('width',rfpN(w));el.setAttribute('height',rfpN(h));});
        set(N.att[k],function(el){if(!el.hasAttribute('data-rfp-fixed'))el.setAttribute('transform','translate('+rfpN(w/2)+','+rfpN(y0)+')');});
        set(N.vac[k],function(el){if(!el.hasAttribute('data-rfp-fixed'))el.setAttribute('transform','translate('+rfpN(-w/2)+','+rfpN(y0)+')');});
      }
      // attention / vacuum badges
      set(N.att[k],function(el){el.setAttribute('opacity',st.att?'1':'0');});
      set(N.attn[k],function(el){el.textContent=st.att?String(st.att):'';});
      set(N.vac[k],function(el){el.setAttribute('opacity',st.vac?'1':'0');});
      // temperature map
      if(N.thermo[k]){
        const rg=self._range(),kk=isFinite(st.t)?(st.t-rg[0])/(rg[1]-rg[0]):NaN;
        const fill=isFinite(kk)?rfpLerpColor(T.stops,kk):'#3a4048';
        const dark=isFinite(kk)&&kk>0.35&&kk<0.85;
        set(N.thermo[k],function(el){el.setAttribute('fill',fill);});
        set(N.tt[k],function(el){el.textContent=isFinite(st.t)?self._fmt(st.t,1)+'°':'—';el.setAttribute('fill',dark?'#1b1b1b':'#fff');});
        set(N.tn[k],function(el){el.setAttribute('fill',dark?'rgba(0,0,0,.7)':'rgba(255,255,255,.85)');});
        set(N.th[k],function(el){el.textContent=[isFinite(st.h)?self._fmt(st.h,0)+' % RH':'',st.heat==='heat'?rfpT(lang,'heating'):''].filter(Boolean).join(' · ');el.setAttribute('fill',dark?'rgba(0,0,0,.7)':'rgba(255,255,255,.85)');});
      }
      // tiles
      if(N.tile[k]){
        const tt=T.tile;
        set(N.tile[k],function(el){el.setAttribute('fill',st.on?tt.on:tt.bg);el.setAttribute('stroke',st.on?tt.onLine:tt.line);el.setAttribute('stroke-width',st.on?2:1.5);});
        set(N.ticon[k],function(el){el.setAttribute('fill',st.on?tt.iconOn:tt.icon);});
        set(N.tbulb[k],function(el){el.setAttribute('stroke',st.on?tt.inkOn:tt.ink);});
        set(N.big[k],function(el){el.textContent=isFinite(st.t)?self._fmt(st.t,1)+'°':'';});
        set(N.val[k],function(el){el.textContent=(N.big[k]?(isFinite(st.h)?self._fmt(st.h,0)+' %':''):val)+(st.media?(N.big[k]&&!isFinite(st.h)?'':'  ')+'▶ '+st.media:'');});
        set(N.cbg['light:'+k],function(el){el.setAttribute('fill',st.on?tt.iconOn:tt.icon);});
        set(N.cv['light:'+k],function(el){el.textContent=st.on?rfpT(lang,'on')+(st.bri<0.995?' '+Math.round(st.bri*100)+' %':''):rfpT(lang,'off');el.setAttribute('fill',st.on?tt.inkOn:tt.ink);});
        set(N.cbg['heat:'+k],function(el){el.setAttribute('fill',st.heat==='heat'?tt.heatBg:tt.icon);});
        set(N.cv['heat:'+k],function(el){el.textContent=st.heat==='heat'?rfpT(lang,'heating'):(st.heat==='off'?rfpT(lang,'off'):rfpT(lang,'idle'));el.setAttribute('fill',st.heat==='heat'?tt.heatInk:tt.ink);});
      }
    });
    this._applyPersons(SG);
    this._applyItems();
  }
  _applyPersons(SG){
    const N=this._nodes,M=this.M,fs=this.fs,F=this.F,self=this;
    if(!N||!N.person||!Object.keys(N.person).length)return;
    const sig=JSON.stringify(SG.where);if(sig===this._pSig)return;this._pSig=sig;
    const groups={};
    SG.where.forEach(function(w,i){if(w&&w.k>=0)(groups[w.k]=groups[w.k]||[]).push(i);});
    SG.where.forEach(function(w,i){
      const el=(N.person[i]||[])[0];if(!el)return;
      (N.pinit[i]||[]).forEach(function(t){t.textContent=String(w.name||'?').trim().charAt(0).toUpperCase();});
      if(!w||w.k<0){el.setAttribute('opacity','0');return;}
      const r=M.rooms[w.k],g=groups[w.k],j=g.indexOf(i);
      let p;
      if(r.tile)p=[r.tile[0]+r.tile[2]-18-j*fs*1.8,r.tile[1]+r.tile[3]-18];
      else{const q=rfpP(F,r.pole[0],r.pole[1],0);p=[q[0]+(j-(g.length-1)/2)*fs*1.8,q[1]-fs*(r.compact?1.9:2.75)];}
      const tr='translate('+rfpN(p[0])+'px,'+rfpN(p[1])+'px)';
      if(el.getAttribute('opacity')==='0'){
        // appearing: jump into place, then fade in (moving between rooms glides)
        el.style.transition='none';el.style.transform=tr;
        try{el.getBoundingClientRect();}catch(_){}
        el.style.transition='';
      }else el.style.transform=tr;
      el.setAttribute('opacity','1');
    });
  }
  _applyItems(){
    const N=this._nodes,self=this;if(!N||!N.item)return;
    N.item.forEach(function(el){
      const it=self.M.items.find(function(x){return x.k===+el.getAttribute('data-rfp-item');});if(!it)return;
      const st=self._itemState(it);
      el.classList.toggle('is-on',st.on);el.classList.toggle('na',st.na);
      const tx=el.querySelector('[data-rfp-itx]');if(tx&&tx.textContent!==st.text)tx.textContent=st.text;
    });
  }
  // ---- interaction: tap opens the room (or more-info), hold toggles its lights ----
  _wire(sv){
    const self=this;let down=null;
    const target=function(e){
      let n=e.target,g=0;
      while(n&&n!==sv&&g++<8){
        if(n.getAttribute){const c=n.getAttribute('data-rfp-ctl');if(c)return{ctl:c};const it=n.getAttribute('data-rfp-item');if(it!=null)return{item:+it};const h=n.getAttribute('data-rfp-hit');if(h!=null)return{room:+h};}
        n=n.parentNode;
      }
      return null;
    };
    sv.addEventListener('pointerdown',function(e){
      if(!self.o.interactive||e.button>0)return;
      const t=target(e);if(!t)return;
      down={t:t,x:e.clientX,y:e.clientY,held:false};
      clearTimeout(self._holdT);
      if(t.room!=null||t.item!=null)self._holdT=setTimeout(function(){if(down){down.held=true;self._act(t,'hold');}},550);
    });
    sv.addEventListener('pointermove',function(e){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10){clearTimeout(self._holdT);down=null;}});
    const cancel=function(){clearTimeout(self._holdT);down=null;};
    sv.addEventListener('pointercancel',cancel);sv.addEventListener('pointerleave',cancel);
    sv.addEventListener('pointerup',function(e){
      clearTimeout(self._holdT);
      if(!down||!self.o.interactive)return;
      const d=down;down=null;if(d.held)return;
      const t=target(e);if(!t||t.room!==d.t.room||t.ctl!==d.t.ctl||t.item!==d.t.item)return;
      self._act(t,'tap',e);
    });
  }
  // Default actions; a plan room's own tap_action / hold_action wins.
  _actionFor(r,kind){
    const c=r.cfg||{};
    if(kind==='tap'&&c.tap_action)return c.tap_action;
    if(kind==='hold'&&c.hold_action)return c.hold_action;
    if(kind==='tap'){
      if(r.link>=0){const cr=(this.o.cAll.rooms||[])[r.link];return{action:'switch-room',room:cr&&cr.id!=null?cr.id:r.link};}
      if(r.climate)return{action:'more-info',entity:r.climate};
      if(r.lights.length)return{action:'more-info',entity:r.lights[0]};
      return null;
    }
    if(r.lights.length)return{action:'perform-action',perform_action:'homeassistant.toggle',target:{entity_id:r.lights.length===1?r.lights[0]:r.lights.slice()}};
    return null;
  }
  _act(t,kind,e){
    const M=this.M;if(!M)return;
    let a=null;
    if(t.item!=null){
      const it=M.items.find(function(x){return x.k===t.item;});if(!it)return;
      const c=it.cfg,d=it.entity.split('.')[0];
      if(kind==='tap')a=c.tap_action||(it.entity?(RFP_TOGGLE.indexOf(d)>=0?{action:'toggle',entity:it.entity}:{action:'more-info',entity:it.entity}):null);
      else a=c.hold_action||(it.entity?{action:'more-info',entity:it.entity}:null);
    }else if(t.ctl){
      const p=t.ctl.split(':'),r=M.rooms[+p[1]];if(!r)return;
      if(p[0]==='light')a={action:'perform-action',perform_action:'homeassistant.toggle',target:{entity_id:r.lights.length===1?r.lights[0]:r.lights.slice()}};
      else if(p[0]==='heat')a={action:'more-info',entity:r.climate};
    }else{
      const r=M.rooms[t.room];if(!r)return;
      a=this._actionFor(r,kind);
    }
    if(!a)return;
    if(typeof this.o.exec==='function')this.o.exec(a,e);
  }
  // ---- geometry queries (the card's zoom transition, the studio) ----
  roomRect(k){
    const r=this.M&&this.M.rooms[k];if(!r||!this.F)return null;
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    if(r.tile){x0=r.tile[0];y0=r.tile[1];x1=x0+r.tile[2];y1=y0+r.tile[3];}
    else r.poly.forEach(function(p){const q=rfpP(this.F,p[0],p[1],0);x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);},this);
    const b=this.svg.getBoundingClientRect(),sx=this.W?b.width/this.W:1,sy=this.H?b.height/this.H:1;
    return{left:b.left+x0*sx,top:b.top+y0*sy,width:(x1-x0)*sx,height:(y1-y0)*sy};
  }
  roomForCardRoom(idx){const M=this.M;if(!M)return-1;for(let k=0;k<M.rooms.length;k++)if(M.rooms[k].link===idx)return k;return-1;}
  toLocal(x,y,z){return this.F?rfpP(this.F,x,y,z||0):[0,0];}
  toPlan(px,py){return this.F?rfpInv(this.F,px,py):[0,0];}
  // client (event) coordinates ↔ the svg's own px
  clientToLocal(cx,cy){const b=this.svg.getBoundingClientRect();return[(cx-b.left)*(this.W/(b.width||1)),(cy-b.top)*(this.H/(b.height||1))];}
}
function rfpPts(a){return a.map(function(p){return rfpN(p[0])+','+rfpN(p[1]);}).join(' ');}
