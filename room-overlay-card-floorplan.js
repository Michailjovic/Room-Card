/**
 * room-overlay-card — floor plan renderer — MIT License (see ROC_FP_VERSION below)
 * https://github.com/Michailjovic/Room-Card
 *
 * GENERATED FILE — assembled from src/floorplan/ by `npm run assemble` (tools/assemble.js).
 * Edit the parts and re-assemble.
 *
 * The floor plan page (V7_PLAN.md §6, Phase 5 — v6.47.0). A room with a `floorplan:` block is a
 * page that draws the home as a vector plan: floors, walls with door openings, room labels and the
 * live state of each room's lights, floor heating, temperature and humidity, in one of seven themes
 * and three projections (top, oblique cut-away, isometric).
 *
 * room-overlay-card.js loads this file with import() the first time a floor plan page is shown
 * (rocLoadFloorplan), so a dashboard without a floor plan never downloads it (§2a.4). Everything
 * here lives in one closure and registers itself on the card class as
 * RoomOverlayCard._rocFloorplan = {version, mount(host, opts), geom, themes}.
 *
 * Coordinates: one plan space in metres, x to the right, y down (the vacuum map's orientation).
 * Every projection is an affine map of the floor plane plus a vertical offset for height, so
 * patterns, light pools and heating loops are drawn in plan metres under one SVG transform, and
 * only labels and wall faces are computed in screen space.
 */
(function(){
'use strict';
const ROC_FP_VERSION='7.0.0-beta.3';
const RFP_NS='http://www.w3.org/2000/svg';
let rfpUid=0;
function rfpEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function rfpN(v){return Math.round(v*100)/100;}
function rfpNum(v){if(v===null||v===undefined||v==='')return NaN;const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)?n:NaN;}
// Strings the plan itself draws (labels, empty state). The studio has its own table.
const RFP_STR={
  en:{empty:'No floor plan yet',empty2:'Open the Studio to import it from AnyVac or draw it',heating:'heating',light:'Light',heat:'Heating',on:'on',off:'off',idle:'idle',none:'—',
    vac:'vacuumed',mop:'mopped',cleaning:'cleaning',min:'{n} min',hr:'{n} h',day:'{n} d',clean:'Clean {room}',clean_q:'Start cleaning {room}?'},
  cs:{empty:'Půdorys zatím není',empty2:'Otevři Studio a naimportuj ho z AnyVac nebo ho nakresli',heating:'topí',light:'Světlo',heat:'Topení',on:'zap.',off:'vyp.',idle:'stojí',none:'—',
    vac:'vysáto',mop:'vytřeno',cleaning:'uklízí',min:'{n} min',hr:'{n} h',day:'{n} d',clean:'Uklidit: {room}',clean_q:'Spustit úklid: {room}?'},
};
function rfpT(lang,k){const t=RFP_STR[lang]||RFP_STR.en;return t[k]!==undefined?t[k]:RFP_STR.en[k];}
// ----- Geometry (pure) -------------------------------------------------------------------------
// Polygons are arrays of [x, y] in plan metres. Nothing here touches the DOM; the studio and the
// test tiers use the same functions through RoomOverlayCard._rocFloorplan.geom.
function rfpPoly(p){
  if(!Array.isArray(p))return[];
  const out=[];
  for(const q of p){
    if(Array.isArray(q)&&q.length>=2){const x=rfpNum(q[0]),y=rfpNum(q[1]);if(isFinite(x)&&isFinite(y))out.push([x,y]);}
    else if(q&&typeof q==='object'){const x=rfpNum(q.x),y=rfpNum(q.y);if(isFinite(x)&&isFinite(y))out.push([x,y]);}
  }
  return out;
}
function rfpArea(p){let s=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];s+=a[0]*b[1]-b[0]*a[1];}return s/2;}
function rfpBBox(pts){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const q of pts){if(q[0]<x0)x0=q[0];if(q[0]>x1)x1=q[0];if(q[1]<y0)y0=q[1];if(q[1]>y1)y1=q[1];}
  return[x0,y0,x1,y1];
}
function rfpInPoly(x,y,p){
  let c=false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];
    if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))c=!c;
  }
  return c;
}
function rfpDistSeg(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0;t=Math.max(0,Math.min(1,t));
  const x=ax+t*dx,y=ay+t*dy;return Math.hypot(px-x,py-y);
}
function rfpEdgeDist(x,y,p){let d=Infinity;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];d=Math.min(d,rfpDistSeg(x,y,a[0],a[1],b[0],b[1]));}return d;}
// The most "inside" point of a room (its label / lamp spot): a two-pass grid search for the
// point farthest from every wall. For a rectangle that is the centre; for an L it stays in the
// bigger arm instead of falling into the corner (or outside, like a centroid can).
function rfpPole(p){
  if(p.length<3)return p[0]?p[0].slice():[0,0];
  const b=rfpBBox(p);let best=null,bd=-1;
  const scan=function(x0,y0,x1,y1,n){
    for(let i=0;i<=n;i++)for(let j=0;j<=n;j++){
      const x=x0+(x1-x0)*i/n,y=y0+(y1-y0)*j/n;
      if(!rfpInPoly(x,y,p))continue;
      const d=rfpEdgeDist(x,y,p);if(d>bd){bd=d;best=[x,y];}
    }
  };
  scan(b[0],b[1],b[2],b[3],24);
  if(!best)return[(b[0]+b[2])/2,(b[1]+b[3])/2];
  const cx=(b[2]-b[0])/24,cy=(b[3]-b[1])/24;
  scan(best[0]-cx,best[1]-cy,best[0]+cx,best[1]+cy,8);
  return best;
}
// Wall pieces of one room: every edge minus the openings (doors) that sit on it. An opening
// belongs to an edge when its centre is within `tol` of the edge line, so one door cuts the walls
// of BOTH rooms it connects (adjacent rooms are separate polygons a few cm apart).
function rfpWallSegs(p,openings,tol){
  tol=tol==null?0.3:tol;
  const out=[];
  for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length];
    const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<1e-6)continue;
    const ux=dx/L,uy=dy/L;
    const cuts=[];
    for(const o of openings||[]){
      const at=o.at,w=rfpNum(o.width)>0?rfpNum(o.width):0.8;
      if(!at)continue;
      const rx=at[0]-a[0],ry=at[1]-a[1];
      const t=rx*ux+ry*uy,d=Math.abs(rx*uy-ry*ux);
      if(d>tol||t<-w/2||t>L+w/2)continue;
      cuts.push([t-w/2,t+w/2]);
    }
    cuts.sort(function(m,n){return m[0]-n[0];});
    let cur=0;
    const seg=function(t0,t1){if(t1-t0>0.01)out.push({a:[a[0]+ux*t0,a[1]+uy*t0],b:[a[0]+ux*t1,a[1]+uy*t1],edge:i});};
    for(const k of cuts){if(k[1]<=cur||k[0]>=L)continue;if(k[0]>cur)seg(cur,k[0]);cur=Math.max(cur,k[1]);}
    if(cur<L)seg(cur,L);
  }
  return out;
}
// Where an opening sits: the nearest edge over every room, the unit direction along it, the
// normal pointing into that room, and the distance. Doors swing into that room.
function rfpOpeningEdge(at,rooms){
  let best=null;
  rooms.forEach(function(p,ri){
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length];
      const d=rfpDistSeg(at[0],at[1],a[0],a[1],b[0],b[1]);
      if(!best||d<best.d){
        const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
        const u=[dx/L,dy/L];let n=[-u[1],u[0]];
        if(!rfpInPoly(at[0]+n[0]*0.2,at[1]+n[1]*0.2,p))n=[-n[0],-n[1]];
        best={d:d,room:ri,edge:i,u:u,n:n};
      }
    }
  });
  return best;
}
// ---- Projection ------------------------------------------------------------------------------
// Unit floor matrices [m0,m1,m2,m3]: screen x = m0·x + m2·y, screen y = m1·x + m3·y, and `z`
// lifts a point by z·zf·scale. `oblique` is the cut-away view of the prototype (the long side of
// a flat stays horizontal); `iso` is 30° isometric.
const RFP_PROJ={
  top:{m:[1,0,0,1],z:0},
  oblique:{m:[1,0,-0.28,0.7],z:0.95},
  iso:{m:[0.866,-0.5,0.866,0.5],z:0.9},
};
function rfpMul(a,b){return[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3]];}
// The affine map for a plan: projection × rotation, scaled and centred into W×H minus padding.
// pts: every floor point; zTop: wall height (raised corners count for the fit).
// mirror (v6.49.0): 'horizontal' flips x, 'vertical' flips y, 'both' (v6.50.0) both — before the rotation, so the plan's
// own coordinates (and everything stored in them) stay as the vacuum mapped them.
function rfpFit(pts,proj,rotDeg,W,H,pad,zTop,mirror){
  const P=RFP_PROJ[proj]||RFP_PROJ.top;
  const r=(rfpNum(rotDeg)||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  const mr=mirror==='horizontal'?[-1,0,0,1]:(mirror==='vertical'?[1,0,0,-1]:(mirror==='both'?[-1,0,0,-1]:[1,0,0,1]));
  const m=rfpMul(P.m,rfpMul([c,s,-s,c],mr));
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const q of pts){
    const sx=m[0]*q[0]+m[2]*q[1],sy=m[1]*q[0]+m[3]*q[1];
    if(sx<x0)x0=sx;if(sx>x1)x1=sx;
    if(sy<y0)y0=sy;if(sy>y1)y1=sy;
    const sz=sy-(zTop||0)*P.z;if(sz<y0)y0=sz;
  }
  if(!isFinite(x0)){x0=0;y0=0;x1=1;y1=1;}
  const w=Math.max(0.01,x1-x0),h=Math.max(0.01,y1-y0);
  const pl=pad.l!=null?pad.l:pad,pr=pad.r!=null?pad.r:pad,pt=pad.t!=null?pad.t:pad,pb=pad.b!=null?pad.b:pad;
  const S=Math.max(0.0001,Math.min((W-pl-pr)/w,(H-pt-pb)/h));
  const e=pl+((W-pl-pr)-w*S)/2-x0*S,f=pt+((H-pt-pb)-h*S)/2-y0*S;
  return{m:[m[0]*S,m[1]*S,m[2]*S,m[3]*S],e:e,f:f,S:S,zf:P.z*S,proj:proj,unit:m};
}
function rfpP(F,x,y,z){return[F.m[0]*x+F.m[2]*y+F.e,F.m[1]*x+F.m[3]*y+F.f-(z||0)*F.zf];}
// Screen → plan on the floor (z = 0).
function rfpInv(F,sx,sy){
  const a=F.m[0],b=F.m[1],c=F.m[2],d=F.m[3],det=a*d-b*c;if(!det)return[0,0];
  const X=sx-F.e,Y=sy-F.f;return[(d*X-c*Y)/det,(-b*X+a*Y)/det];
}
// Plan direction that points "towards the viewer" (moves down the screen): walls whose outside
// faces this way are front walls and are drawn low (the cut-away).
function rfpViewDir(F){
  const a=F.m[0],b=F.m[1],c=F.m[2],d=F.m[3],det=a*d-b*c;if(!det)return[0,1];
  const x=-c/det,y=a/det,l=Math.hypot(x,y)||1;return[x/l,y/l];
}
// ---- Heating loops (plan metres, clipped to the room by the caller) ----------------------------
function rfpSerp(p,pitch,margin){
  const b=rfpBBox(p),m=margin==null?0.35:margin;
  const x0=b[0]+m,x1=b[2]-m,y1=b[3]-m;let y=b[1]+m;
  if(x1<=x0||y1<=y)return'';
  let d='M'+rfpN(x0)+' '+rfpN(y),dir=1;
  while(y<y1){d+='H'+rfpN(dir>0?x1:x0);const yn=Math.min(y1,y+pitch);d+='V'+rfpN(yn);y=yn;dir=-dir;}
  return d;
}
function rfpSpiral(p,pitch){
  const b=rfpBBox(p),m=0.3;let d='';let x0=b[0]+m,y0=b[1]+m,x1=b[2]-m,y1=b[3]-m;
  while(x1-x0>pitch*2&&y1-y0>pitch*2){d+='M'+rfpN(x0)+' '+rfpN(y0)+'H'+rfpN(x1)+'V'+rfpN(y1)+'H'+rfpN(x0)+'Z';x0+=pitch;y0+=pitch;x1-=pitch;y1-=pitch;}
  return d;
}
// ---- Colour --------------------------------------------------------------------------------------
// Colour temperature (K) → rgb, Tanner Helland's fit — close enough for a lamp's glow.
function rfpKelvin(k){
  const t=Math.max(1000,Math.min(40000,k))/100;let r,g,b;
  if(t<=66){r=255;g=99.4708025861*Math.log(t)-161.1195681661;b=t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;}
  else{r=329.698727446*Math.pow(t-60,-0.1332047592);g=288.1221695283*Math.pow(t-60,-0.0755148492);b=255;}
  const c=function(v){return Math.round(Math.max(0,Math.min(255,v)));};
  return'rgb('+c(r)+','+c(g)+','+c(b)+')';
}
function rfpLerpColor(stops,k){
  k=Math.max(0,Math.min(1,k));const f=k*(stops.length-1),i=Math.floor(f),u=f-i;
  const a=stops[i],b=stops[Math.min(stops.length-1,i+1)];
  return'rgb('+a.map(function(v,j){return Math.round(v+(b[j]-v)*u);}).join(',')+')';
}
// ---- Map clean-up (the AnyVac import, V7_PLAN §6.3) --------------------------------------------
// A vacuum outline traces the floor the robot reached: furniture bites notches into it, and it
// steps in 5 cm cells. The clean-up rasterises the outline, closes gaps narrower than `close`
// (furniture, 0.8 m), opens away slivers thinner than `open` (0.2 m), traces the largest piece
// back to a rectilinear polygon and removes jogs up to `jog` (0.2 m). 14–45 points become 4–8 for the
// author's flat. The result is axis-aligned in the map frame.
function rfpCleanOutline(poly,o){
  o=o||{};
  const g=o.grid||0.05,close=o.close==null?0.8:o.close,open=o.open==null?0.2:o.open,jog=o.jog==null?0.2:o.jog;
  const p=rfpPoly(poly);if(p.length<3)return p;
  const b=rfpBBox(p),padc=Math.ceil(close/g)+2;
  const ox=b[0]-padc*g,oy=b[1]-padc*g;
  const nx=Math.ceil((b[2]-b[0])/g)+2*padc,ny=Math.ceil((b[3]-b[1])/g)+2*padc;
  if(nx*ny>4e6)return p; // absurd input: leave it alone
  let A=new Uint8Array(nx*ny);
  // scanline fill at cell centres
  for(let j=0;j<ny;j++){
    const y=oy+(j+0.5)*g,xs=[];
    for(let i=0,k=p.length-1;i<p.length;k=i++){
      const a=p[i],c=p[k];
      if((a[1]>y)!==(c[1]>y))xs.push(a[0]+(y-a[1])*(c[0]-a[0])/(c[1]-a[1]));
    }
    xs.sort(function(m,n){return m-n;});
    for(let q=0;q+1<xs.length;q+=2){
      const i0=Math.max(0,Math.ceil((xs[q]-ox)/g-0.5)),i1=Math.min(nx-1,Math.floor((xs[q+1]-ox)/g-0.5));
      for(let i=i0;i<=i1;i++)A[j*nx+i]=1;
    }
  }
  const morph=function(src,r,dil){ // square kernel (2r+1) cells, separable
    if(r<=0)return src;
    const t=new Uint8Array(nx*ny),out=new Uint8Array(nx*ny);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      let v=dil?0:1;
      for(let k=-r;k<=r;k++){const ii=i+k;const s=ii<0||ii>=nx?0:src[j*nx+ii];if(dil?s:!s){v=dil?1:0;break;}}
      t[j*nx+i]=v;
    }
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      let v=dil?0:1;
      for(let k=-r;k<=r;k++){const jj=j+k;const s=jj<0||jj>=ny?0:t[jj*nx+i];if(dil?s:!s){v=dil?1:0;break;}}
      out[j*nx+i]=v;
    }
    return out;
  };
  const rc=Math.round(close/g/2),ro=Math.round(open/g/2);
  A=morph(morph(A,rc,true),rc,false);   // closing
  A=morph(morph(A,ro,false),ro,true);   // opening
  // largest 4-connected component
  const lab=new Int32Array(nx*ny);let bestL=0,bestN=0,L=0;
  for(let s=0;s<nx*ny;s++){
    if(!A[s]||lab[s])continue;L++;let n=0;const st=[s];lab[s]=L;
    while(st.length){const c=st.pop();n++;const ci=c%nx,cj=(c-ci)/nx;
      const nb=[ci>0?c-1:-1,ci<nx-1?c+1:-1,cj>0?c-nx:-1,cj<ny-1?c+nx:-1];
      for(const d of nb)if(d>=0&&A[d]&&!lab[d]){lab[d]=L;st.push(d);}}
    if(n>bestN){bestN=n;bestL=L;}
  }
  if(!bestL)return p;
  const on=function(i,j){return i>=0&&j>=0&&i<nx&&j<ny&&lab[j*nx+i]===bestL;};
  // boundary edges, clockwise on screen (interior on the right)
  const out=new Map();
  const add=function(x0,y0,x1,y1){const k=x0+','+y0;if(!out.has(k))out.set(k,[]);out.get(k).push([x1,y1]);};
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    if(!on(i,j))continue;
    if(!on(i,j-1))add(i,j,i+1,j);
    if(!on(i+1,j))add(i+1,j,i+1,j+1);
    if(!on(i,j+1))add(i+1,j+1,i,j+1);
    if(!on(i-1,j))add(i,j+1,i,j);
  }
  let loop=null,loopA=0;
  const used=new Set();
  out.forEach(function(list,k){
    list.forEach(function(e0,ei){
      const id=k+'>'+ei;if(used.has(id))return;
      const pts=[];let cur=k.split(',').map(Number),prevDir=null,guard=0;
      let nextIdx=ei;
      while(guard++<200000){
        const key=cur[0]+','+cur[1];const L2=out.get(key);if(!L2)break;
        let pick=-1;
        if(nextIdx!=null){pick=nextIdx;nextIdx=null;}
        else{
          // at a pinch, turn right first (keeps the traced piece simple)
          let bestT=Infinity;
          L2.forEach(function(t,ti){if(used.has(key+'>'+ti))return;
            const d=[t[0]-cur[0],t[1]-cur[1]];const cr=prevDir?prevDir[0]*d[1]-prevDir[1]*d[0]:0;const rank=cr>0?0:(cr===0?1:2);
            if(rank<bestT){bestT=rank;pick=ti;}});
        }
        if(pick<0||used.has(key+'>'+pick))break;
        used.add(key+'>'+pick);
        const t=L2[pick];pts.push(cur);prevDir=[t[0]-cur[0],t[1]-cur[1]];cur=t;
      }
      const ar=Math.abs(rfpArea(pts));
      if(pts.length>=4&&ar>loopA){loopA=ar;loop=pts;}
    });
  });
  if(!loop)return p;
  let q=rfpCollinear(loop);
  const jc=jog/g;
  for(let guard=0;guard<500&&q.length>4;guard++){
    let si=-1,sl=Infinity;
    for(let i=0;i<q.length;i++){const a=q[i],c=q[(i+1)%q.length];const l=Math.abs(a[0]-c[0])+Math.abs(a[1]-c[1]);if(l<sl){sl=l;si=i;}}
    if(sl>jc+1e-9)break;
    q=rfpDejog(q,si);q=rfpCollinear(q);
  }
  return q.map(function(v){return[rfpN(ox+v[0]*g),rfpN(oy+v[1]*g)];});
}
function rfpCollinear(p){
  let q=p.slice(),changed=true;
  while(changed&&q.length>3){
    changed=false;
    for(let i=0;i<q.length;i++){
      const a=q[(i-1+q.length)%q.length],b=q[i],c=q[(i+1)%q.length];
      const cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
      if(Math.abs(cr)<1e-9||(a[0]===b[0]&&a[1]===b[1])){q.splice(i,1);changed=true;break;}
    }
  }
  return q;
}
// Remove the short edge q[i]→q[i+1] of a rectilinear polygon: a step (neighbours go the same
// way) moves the shorter neighbour onto the longer one's line; a notch or tab (neighbours go
// opposite ways) is cut off flush with the shorter neighbour.
function rfpDejog(q,i){
  const n=q.length,ia=(i-1+n)%n,ib=i,ic=(i+1)%n,id=(i+2)%n;
  const A=q[ia],B=q[ib],C=q[ic],D=q[id];
  const vert=B[0]===C[0];
  const ab=vert?B[0]-A[0]:B[1]-A[1],cd=vert?D[0]-C[0]:D[1]-C[1];
  const lab=Math.abs(ab),lcd=Math.abs(cd);
  const r=q.slice();
  if((ab>0)===(cd>0)){ // step
    if(lab<lcd){ // move A,B onto C's line
      if(vert){r[ia]=[A[0],C[1]];}else{r[ia]=[C[0],A[1]];}
      r.splice(Math.max(ib,ic),1);r.splice(Math.min(ib,ic),1);
    }else{
      if(vert){r[id]=[D[0],B[1]];}else{r[id]=[B[0],D[1]];}
      r.splice(Math.max(ib,ic),1);r.splice(Math.min(ib,ic),1);
    }
  }else{ // notch / tab
    if(lab<lcd){ // cut back to A's level: C slides to A's coordinate, B and A merge
      if(vert)r[ic]=[A[0],C[1]];else r[ic]=[C[0],A[1]];
      r.splice(ib,1);if(ib<ia)r.splice(ia-1,1);else r.splice(ia,1);
    }else{
      if(vert)r[ib]=[D[0],B[1]];else r[ib]=[B[0],D[1]];
      const rm=[ic,id].sort(function(m,k){return k-m;});r.splice(rm[0],1);r.splice(rm[1],1);
    }
  }
  return r.length>=3?r:q;
}
// Doors where two rooms touch (V7_PLAN §6.3, AnyVac request A3): for every pair of rooms the
// longest pair of parallel facing walls at most `gap` apart and overlapping ≥ 0.7 m gets one door.
// When the robot's paths are given (plan metres), the door goes where the robot actually crossed;
// otherwise in the middle of the overlap. The user confirms or moves them in the studio.
function rfpProposeDoors(rooms,paths,o){
  o=o||{};const gap=o.gap==null?0.4:o.gap,minOv=o.min==null?0.7:o.min;
  const segs=(paths||[]).map(function(seg){return rfpPoly(seg||[]);}).filter(function(p){return p.length>=2;});
  const doors=[];
  for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
    const P=rooms[i],Q=rooms[j];if(P.length<3||Q.length<3)continue;
    let best=null;
    for(let a=0;a<P.length;a++){
      const p0=P[a],p1=P[(a+1)%P.length];
      const dx=p1[0]-p0[0],dy=p1[1]-p0[1],L=Math.hypot(dx,dy);if(L<minOv)continue;
      const u=[dx/L,dy/L];
      for(let b=0;b<Q.length;b++){
        const q0=Q[b],q1=Q[(b+1)%Q.length];
        const ex=q1[0]-q0[0],ey=q1[1]-q0[1],M=Math.hypot(ex,ey);if(M<minOv)continue;
        if(Math.abs(u[0]*ey-u[1]*ex)/M>0.05)continue; // not parallel
        const d=Math.abs((q0[0]-p0[0])*u[1]-(q0[1]-p0[1])*u[0]);if(d>gap)continue;
        const t0=(q0[0]-p0[0])*u[0]+(q0[1]-p0[1])*u[1],t1=(q1[0]-p0[0])*u[0]+(q1[1]-p0[1])*u[1];
        const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(L,Math.max(t0,t1));
        if(hi-lo<minOv)continue;
        if(!best||hi-lo>best.hi-best.lo)best={p0:p0,u:u,lo:lo,hi:hi,d:d,q0:q0};
      }
    }
    if(!best)continue;
    const n=[-best.u[1],best.u[0]];
    const side=(best.q0[0]-best.p0[0])*n[0]+(best.q0[1]-best.p0[1])*n[1];
    const off=side/2;
    const w=Math.min(o.width||0.8,best.hi-best.lo-0.1);
    // where the robot crossed the line between the two walls
    let tc=(best.lo+best.hi)/2;const hits=[];
    const loc=function(v){const rx=v[0]-best.p0[0],ry=v[1]-best.p0[1];return[rx*best.u[0]+ry*best.u[1],rx*n[0]+ry*n[1]-off];};
    segs.forEach(function(seg){
      for(let i=1;i<seg.length;i++){
        const A=loc(seg[i-1]),B=loc(seg[i]);
        if((A[1]>0)===(B[1]>0)||A[1]===B[1])continue;
        const t=A[0]+(B[0]-A[0])*(A[1]/(A[1]-B[1]));
        if(t>=best.lo&&t<=best.hi)hits.push(t);
      }
    });
    if(hits.length){hits.sort(function(m,k){return m-k;});tc=hits[Math.floor(hits.length/2)];}
    tc=Math.max(best.lo+w/2+0.05,Math.min(best.hi-w/2-0.05,tc));
    doors.push({type:'door',at:[rfpN(best.p0[0]+best.u[0]*tc+n[0]*off),rfpN(best.p0[1]+best.u[1]*tc+n[1]*off)],width:rfpN(w),rooms:[i,j],traced:hits.length>0});
  }
  return doors;
}
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
// 7.0.0-beta.3: the band lies on an underlay in the theme's background colour (`under`,
// `underOpacity`) that mutes the floor beneath it, so the band keeps its own hue on wood or tile
// instead of turning into a floor-coloured stain; the band itself is stronger for that.
const RFP_VAC_DEF={night:{robot:'#03a9f4',dry:'#8ecbff',wet:'#7dd3fc',wetOpacity:0.45},clay:{robot:'#0284c7',dry:'#0284c7',wet:'#0ea5e9',wetOpacity:0.35},
  neon:{robot:'#00e5ff',dry:'#00e5ff',wet:'#00ffc6',wetOpacity:0.35},blueprint:{robot:'#9fd3ff',dry:'#e6f1ff',wet:'#9fd3ff',wetOpacity:0.4},
  sketch:{robot:'#2563eb',dry:'#2563eb',wet:'#2a9d8f',wetOpacity:0.35}};
const RFP_VAC_PALETTE=['#03a9f4','#f59e0b','#a855f7','#22c55e','#ef4444','#ec4899'];
function rfpVacT(T){const d=RFP_VAC_DEF[T&&T.name]||RFP_VAC_DEF.night,v=(T&&T.vac)||{},uo=rfpNum(v.underOpacity);return{robot:v.robot||d.robot,dry:v.dry||d.dry,wet:v.wet||d.wet,wetOpacity:rfpNum(v.wetOpacity)>=0?rfpNum(v.wetOpacity):d.wetOpacity,
  under:v.under||(T&&T.bg)||'#0b0e12',underOpacity:uo>=0&&uo<=1?uo:0.55};}
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
  +'.rfp-robot{transition:transform 1.2s linear,opacity .4s ease}'+'.rfp-person,.rfp-sig{transition:transform .6s ease,opacity .4s ease}'
  +'.rfp-ping{animation:rfp-ping 2.2s ease-out infinite;transform-box:fill-box;transform-origin:center}@keyframes rfp-ping{0%{transform:scale(.7);opacity:.9}100%{transform:scale(2);opacity:0}}'
  +'.rfp-bob{animation:rfp-bob 1.4s ease-in-out infinite}@keyframes rfp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}'
  +'.rfp-paused .rfp-flow,.rfp-paused .rfp-pulse,.rfp-paused .rfp-ping,.rfp-paused .rfp-bob{animation-play-state:paused}'
  +'@media (prefers-reduced-motion:reduce){.rfp-flow,.rfp-pulse,.rfp-ping,.rfp-bob{animation:none}.rfp-light,.rfp-heat .rfp-w,.rfp-heat .rfp-c,.rfp-person,.rfp-sig,.rfp-robot{transition:none}}';
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
    clearInterval(this._ageT);
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
      const fc=typeof r.floor_color==='string'&&/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(r.floor_color.trim())?r.floor_color.trim():'';
      rooms.push({i:i,cfg:r,poly:poly,name:String(name),link:link,floor:RFP_FLOORS.indexOf(r.floor)>=0?r.floor:'wood',floorColor:fc,media:list(r.media),
        lights:list(r.lights),climate:r.climate?String(r.climate):'',temp:r.temperature?String(r.temperature):'',hum:r.humidity?String(r.humidity):'',
        pole:rfpPole(poly),bbox:rfpBBox(poly),area:Math.abs(rfpArea(poly)),
        // where the label sits (v6.50.0: label_at, dragged in the studio), else the pole of inaccessibility
        lab:rfpPoly([r.label_at])[0]||rfpPole(poly)});
    });
    // doors and (v6.49.0) windows: k = the index in floorplan.openings; u runs along the wall from the
    // hinge, n points into the room the opening belongs to (mirror / outward flip them)
    const polys=rooms.map(function(r){return r.poly;});
    const openings=(Array.isArray(fp.openings)?fp.openings:[]).map(function(o,k){
      if(!o||typeof o!=='object')return null;
      const type=o.type==='window'?'window':(!o.type||o.type==='door'?'door':null);if(!type)return null;
      const at=rfpPoly([o.at])[0];if(!at)return null;
      const e=polys.length?rfpOpeningEdge(at,polys):null;
      let u=e?e.u:[1,0],n=e?e.n:[0,1];
      if(o.mirror)u=[-u[0],-u[1]];
      if(o.outward)n=[-n[0],-n[1]];
      return{k:k,type:type,at:at,width:rfpNum(o.width)>0?rfpNum(o.width):(type==='window'?1:0.8),cfg:o,u:u,n:n,
        entity:o.entity?String(o.entity):'',cover:o.cover?String(o.cover):'',blind:['venetian','day_night'].indexOf(o.blind_type)>=0?o.blind_type:'roller'};
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
    const o={};['lights','heating','labels','presence','media','attention','vacuum','items','openings','trail'].forEach(function(k){o[k]=l[k]!==false;});
    o.cleaning=l.cleaning===true; // v6.50.0: last cleaned + the clean button, opt-in
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
    this._st={};this._os={};this._og={};this._nodes=null;this._pSig='';
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
    // rotate: degrees | auto, or (v6.50.0) per layout profile {landscape, portrait}
    const rv=fp.rotate&&typeof fp.rotate==='object'&&!Array.isArray(fp.rotate)?fp.rotate[this.o.profile||'landscape']:fp.rotate;
    let rot=rfpNum(rv);
    const mir=['horizontal','vertical','both'].indexOf(fp.mirror)>=0?fp.mirror:'';
    if(!isFinite(rot)&&all.length){const s0=rfpFit(all,proj,0,W,H,padB,wallH,mir).S,s9=rfpFit(all,proj,90,W,H,padB,wallH,mir).S;rot=s9>s0*1.25?90:0;}
    this.rot=isFinite(rot)?rot:0;
    const F=this.F=rfpFit(all.length?all:[[0,0],[10,5]],proj,this.rot,W,H,T.mode==='thermal'?{l:pad,r:pad,t:pad,b:pad+44}:(T.dims?{l:pad+10,r:pad+36,t:pad+34,b:pad+10}:pad),wallH,mir);
    const fs=Math.max(12,Math.min(17,F.S*0.26))*((T.label&&T.label.scale)||1);
    this.fs=fs;
    const mat='matrix('+[F.m[0],F.m[1],F.m[2],F.m[3],F.e,F.f].map(function(v){return+v.toFixed(5);}).join(' ')+')';
    const id=this.uid;
    let s='<style>'+RFP_CSS+'</style><defs>'+this._defs(T,M,F)+'</defs>';
    s+=T.bg2?'<rect width="'+W+'" height="'+H+'" fill="url(#'+id+'-bg)"/>':'<rect width="'+W+'" height="'+H+'" fill="'+T.bg+'"/>';
    if(trace)s+=this._traceSvg(trace,mat);
    const bgi=fp.background&&typeof fp.background==='object'&&fp.background.image?fp.background:null;
    this.bgOn=!!bgi;this.bgFloors=!!(bgi&&bgi.floors);
    if(bgi)s+=this._bgSvg(bgi,mat);
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
      if(T.mode==='plan')s+=this._openingHits(M,F,wallH);
    }
    s+=this._personsSvg(T);
    s+='<g class="rfp-edit"></g>';
    this.svg.innerHTML=s;
    this._itemsHtml(T,M,F);
    this._afterRender();
  }
  _afterRender(){
    this.edit=this.svg.querySelector('.rfp-edit');
    clearInterval(this._ageT);this._ageT=null;
    if(this.L&&this.L.cleaning&&this.M&&this.M.rooms.some(function(r){return r.cfg.anyvac_room;})){const self=this;this._ageT=setInterval(function(){if(!self._dead)self._apply(false);},60000);}
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
  // The photo background (v6.50.0, D11): an image placed in plan metres — top-left at x, y, scale
  // metres per image pixel, turned by rotation° around its top-left — under the vector layers.
  _bgSvg(b,mat){
    const sc=rfpNum(b.scale),w=rfpNum(b.width_px),h=rfpNum(b.height_px);
    if(!(sc>0&&w>0&&h>0))return'';
    const x=rfpNum(b.x)||0,y=rfpNum(b.y)||0,r=rfpNum(b.rotation)||0,op=rfpNum(b.opacity);
    return'<g transform="'+mat+'" opacity="'+(op>=0&&op<=1?op:1)+'" pointer-events="none"><image data-rfp-bg href="'+rfpEsc(b.image)+'" x="'+rfpN(x)+'" y="'+rfpN(y)+'" width="'+(+(w*sc).toFixed(4))+'" height="'+(+(h*sc).toFixed(4))+'" preserveAspectRatio="none"'+(r?' transform="rotate('+rfpN(r)+' '+rfpN(x)+' '+rfpN(y)+')"':'')+'/></g>';
  }
  _defs(T,M,F){
    const id=this.uid,fl=T.floor||{};let d='';
    if(T.bg2)d+='<radialGradient id="'+id+'-bg" cx="50%" cy="40%" r="75%"><stop offset="0%" stop-color="'+T.bg2+'"/><stop offset="100%" stop-color="'+T.bg+'"/></radialGradient>';
    if(T.vignette)d+='<radialGradient id="'+id+'-vg" cx="50%" cy="45%" r="70%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".35"/></radialGradient>';
    if(T.floorStyle==='pattern'){
      RFP_FLOORS.forEach(function(mt){if(mt!=='none')d+=rfpFloorPattern(id+'-'+mt,mt,fl[mt]||fl.wood);});
      // a room's own floor colour (v6.49.0): its own pattern
      M.rooms.forEach(function(r,k){if(r.floorColor&&r.floor!=='none')d+=rfpFloorPattern(id+'-f'+k,r.floor,r.floorColor);});
    }
    const WT=rfpWinT(T);
    d+='<pattern id="'+id+'-ven" patternUnits="userSpaceOnUse" width="6" height="4"><rect width="6" height="4" fill="'+WT.blind+'" fill-opacity=".55"/><rect width="6" height="2.2" fill="'+WT.blind+'"/></pattern>'
      +'<pattern id="'+id+'-dn" patternUnits="userSpaceOnUse" width="6" height="10"><rect width="6" height="10" fill="'+WT.blind+'" fill-opacity=".35"/><rect width="6" height="5" fill="'+WT.blind+'"/></pattern>';
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
      const mat0=r.floor;
      if(T.floorStyle==='pattern')fill=mat0==='none'?(T.floor.none||'#222'):'url(#'+id+(r.floorColor?'-f'+k:'-'+mat0)+')';
      else if(T.floorStyle==='flat')fill=r.floorColor||(T.floor&&(T.floor[mat0]||T.floor.wood))||'#111';
      else if(T.floorStyle==='outline'){stroke=T.line;}
      else if(T.floorStyle==='sketch')fill='rgba(255,255,255,.35)';
      if(self.bgOn&&!self.bgFloors){fill='none';if(stroke==='none')stroke='rgba(255,255,255,.25)';}
      s+='<polygon points="'+rfpPts(r.poly)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="0.03"/>';
      s+='<g clip-path="url(#'+id+'-c'+k+')">'+self._heatSvg(T,r,k)+self._lightSvg(T,r,k)+self._mediaSvg(r,k)+'</g>';
    });
    s+='</g></g>';
    // the vacuum's trail while it cleans (v6.49.0), in plan metres
    if(this.L.vacuum&&this.L.trail&&this._anyvac().length)s+='<g transform="'+mat+'" pointer-events="none" data-rfp-trail></g>';
    // walls
    const walls=[];M.rooms.forEach(function(r){rfpWallSegs(r.poly,M.openings).forEach(function(w){walls.push(w);});});
    if(proj==='top'){
      const col=T.line||(T.wall&&T.wall.top)||'#888';
      const ww=T.line?(T.rough?0.07:0.1):((T.wall&&T.wall.w)||0.12);
      s+='<g'+(T.rough&&fx?' filter="url(#'+id+'-rough)"':'')+'><g transform="'+mat+'" stroke="'+col+'" stroke-linecap="square">';
      walls.forEach(function(w){s+='<line x1="'+rfpN(w.a[0])+'" y1="'+rfpN(w.a[1])+'" x2="'+rfpN(w.b[0])+'" y2="'+rfpN(w.b[1])+'" stroke-width="'+ww+'"/>';});
      if(T.rough)walls.forEach(function(w){s+='<line x1="'+rfpN(w.a[0]+0.03)+'" y1="'+rfpN(w.a[1]+0.02)+'" x2="'+rfpN(w.b[0]-0.02)+'" y2="'+rfpN(w.b[1]+0.03)+'" stroke-width="0.02" opacity=".5"/>';});
      s+=this._openingsTop(T,M,col,ww);
      s+='</g></g>';
    }else{
      const VD=rfpViewDir(F),wl=T.wall||{};
      const inAny=function(x,y){return M.rooms.some(function(r){return rfpInPoly(x,y,r.poly);});};
      M.openings.forEach(function(o){
        const w2=o.width/2,a=[o.at[0]-o.u[0]*w2,o.at[1]-o.u[1]*w2],b=[o.at[0]+o.u[0]*w2,o.at[1]+o.u[1]*w2];
        if(o.type==='window')walls.push({a:a,b:b,win:o});
        else if(self.L.openings&&o.entity)walls.push({a:a,b:b,door:o});
      });
      walls.forEach(function(w){w.depth=((w.a[0]+w.b[0])/2)*VD[0]+((w.a[1]+w.b[1])/2)*VD[1];});
      walls.sort(function(a,b){return a.depth-b.depth;});
      const topW=Math.max(2,(wl.w||0.12)*F.S*0.55);
      s+='<g>';
      walls.forEach(function(w){
        const mx=(w.a[0]+w.b[0])/2,my=(w.a[1]+w.b[1])/2,e=0.08;
        const front=inAny(mx-VD[0]*e,my-VD[1]*e)&&!inAny(mx+VD[0]*e,my+VD[1]*e);
        const h=front?wl.h*0.3:wl.h;
        if(w.win||w.door){s+=self._openingFace(T,F,w,front,topW);return;}
        const A=rfpP(F,w.a[0],w.a[1],0),B=rfpP(F,w.b[0],w.b[1],0),C=rfpP(F,w.b[0],w.b[1],h),D=rfpP(F,w.a[0],w.a[1],h);
        const vert=Math.abs(w.a[0]-w.b[0])<Math.abs(w.a[1]-w.b[1]);
        s+='<polygon points="'+rfpPts([A,B,C,D])+'" fill="'+(vert?(wl.side2||wl.side):wl.side)+'"'+(wl.edge?' stroke="rgba(91,124,255,.35)" stroke-width="1"':'')+'/>';
        if(wl.edge)s+='<line x1="'+rfpN(D[0])+'" y1="'+rfpN(D[1])+'" x2="'+rfpN(C[0])+'" y2="'+rfpN(C[1])+'" stroke="'+wl.top+'" stroke-width="'+rfpN(topW*3)+'" stroke-linecap="round" opacity=".18"/>';
        s+='<line x1="'+rfpN(D[0])+'" y1="'+rfpN(D[1])+'" x2="'+rfpN(C[0])+'" y2="'+rfpN(C[1])+'" stroke="'+wl.top+'" stroke-width="'+rfpN(topW)+'" stroke-linecap="square"/>';
      });
      s+='</g>';
    }
    s+=this._robotsSvg(T,F);
    if(T.dims)s+=this._dims(T,M,F);
    if(this.L.labels)s+=this._labels(T,M,F);
    if(T.paper&&fx)s+='<rect width="'+W+'" height="'+H+'" filter="url(#'+id+'-paper)" pointer-events="none"/>';
    if(T.vignette)s+='<rect width="'+W+'" height="'+H+'" fill="url(#'+id+'-vg)" pointer-events="none"/>';
    return s;
  }
  // ---- doors and windows (v6.49.0, V7_PLAN §6.5) ----
  // Top view, in plan metres: a window is a frame with a pane line (its colour says open), an open
  // casement and the blind on the room side; a door with a contact sensor gets a leaf that swings
  // open, and its arc (blueprint, sketch) shows only while it is open.
  _openingsTop(T,M,col,ww){
    const WT=rfpWinT(T),L=this.L;let s='';
    const ln=function(p,q,a){return'<line x1="'+rfpN(p[0])+'" y1="'+rfpN(p[1])+'" x2="'+rfpN(q[0])+'" y2="'+rfpN(q[1])+'" '+a+'/>';};
    M.openings.forEach(function(o){
      const w=o.width,u=o.u,n=o.n,k=o.k;
      const a=[o.at[0]-u[0]*w/2,o.at[1]-u[1]*w/2],b=[o.at[0]+u[0]*w/2,o.at[1]+u[1]*w/2];
      const off=function(p,d){return[p[0]+n[0]*d,p[1]+n[1]*d];};
      const live=L.openings&&(o.entity||o.cover);
      if(o.type==='window'){
        const f=ww*0.42;
        s+=ln(off(a,f),off(b,f),'stroke-width="'+rfpN(ww*0.16)+'"')+ln(off(a,-f),off(b,-f),'stroke-width="'+rfpN(ww*0.16)+'"');
        s+=ln(a,b,'data-rfp-glass="'+k+'" data-rfp-ga="stroke" stroke="'+WT.glass+'" stroke-width="'+rfpN(ww*0.34)+'" stroke-linecap="butt"');
        if(live&&o.entity){const c=Math.cos(0.7),sn=Math.sin(0.7),d=[u[0]*c+n[0]*sn,u[1]*c+n[1]*sn],l=w*0.5;
          s+=ln(a,[a[0]+d[0]*l,a[1]+d[1]*l],'class="rfp-sig" data-rfp-pane="'+k+'" stroke="'+WT.open+'" stroke-width="'+rfpN(ww*0.22)+'" stroke-linecap="round" opacity="0"');}
        if(live&&o.cover)s+=ln(off(a,ww*0.95),off(b,ww*0.95),'class="rfp-sig" data-rfp-blind="'+k+'" data-rfp-bk="line" stroke="'+WT.blind+'" stroke-width="'+rfpN(ww*0.4)+'" stroke-linecap="butt" opacity="0"'
          +(o.blind==='venetian'?' stroke-dasharray="0.03 0.025"':(o.blind==='day_night'?' stroke-dasharray="0.1 0.05"':'')));
        return;
      }
      // door
      const leaf=off(a,w),cr=u[0]*n[1]-u[1]*n[0];
      const arc='<path'+(live&&o.entity?' class="rfp-sig" data-rfp-arc="'+k+'"':'')+' d="M'+rfpN(a[0])+' '+rfpN(a[1])+'L'+rfpN(leaf[0])+' '+rfpN(leaf[1])+'A'+rfpN(w)+' '+rfpN(w)+' 0 0 '+(cr>0?0:1)+' '+rfpN(b[0])+' '+rfpN(b[1])+'" fill="none" stroke="'+(T.line2||col)+'" stroke-width="0.02"/>';
      if(T.door==='arc')s+=arc;
      if(live&&o.entity){
        this._og[k]={hinge:a,shut:b,open:leaf};
        s+=ln(a,leaf,'data-rfp-leaf="'+k+'" data-rfp-lk="line" stroke="'+WT.door+'" stroke-width="'+rfpN(ww*0.45)+'" stroke-linecap="round"');
      }
    },this);
    return s;
  }
  // Projected views: a window is a wall face with a sill and glass; the blind comes down the glass
  // from the top; a door with a contact sensor is a panel in the gap that swings into the room.
  // Front walls are cut away to 30 %, so there only the sill's top edge shows the glass colour.
  _openingFace(T,F,w,front,topW){
    const WT=rfpWinT(T),wl=T.wall||{},id=this.uid,L=this.L;
    const P=function(p,z){return rfpP(F,p[0],p[1],z);};
    let s='';
    if(w.win){
      const o=w.win,k=o.k,h=front?wl.h*0.3:wl.h,sill=front?h:wl.h*0.38;
      const vert=Math.abs(w.a[0]-w.b[0])<Math.abs(w.a[1]-w.b[1]);
      const side=vert?(wl.side2||wl.side):wl.side;
      s+='<polygon points="'+rfpPts([P(w.a,0),P(w.b,0),P(w.b,sill),P(w.a,sill)])+'" fill="'+side+'"/>';
      if(front){
        s+='<line x1="'+rfpN(P(w.a,sill)[0])+'" y1="'+rfpN(P(w.a,sill)[1])+'" x2="'+rfpN(P(w.b,sill)[0])+'" y2="'+rfpN(P(w.b,sill)[1])+'" data-rfp-glass="'+k+'" data-rfp-ga="stroke" stroke="'+WT.glass+'" stroke-width="'+rfpN(topW)+'" stroke-linecap="square"/>';
        return s;
      }
      s+='<polygon points="'+rfpPts([P(w.a,sill),P(w.b,sill),P(w.b,h),P(w.a,h)])+'" data-rfp-glass="'+k+'" data-rfp-ga="fill" fill="'+WT.glass+'" fill-opacity=".55" stroke="'+(wl.top||'#888')+'" stroke-width="1"/>';
      if(L.openings&&o.cover){
        this._og[k]={a:w.a,b:w.b,z0:sill,z1:h};
        s+='<polygon class="rfp-ease" data-rfp-blind="'+k+'" data-rfp-bk="quad" points="" fill="'+(o.blind==='roller'?WT.blind:'url(#'+id+(o.blind==='venetian'?'-ven':'-dn')+')')+'" stroke="'+WT.blind+'" stroke-width="0.5"/>';
      }
      s+='<line x1="'+rfpN(P(w.a,h)[0])+'" y1="'+rfpN(P(w.a,h)[1])+'" x2="'+rfpN(P(w.b,h)[0])+'" y2="'+rfpN(P(w.b,h)[1])+'" stroke="'+(wl.top||'#888')+'" stroke-width="'+rfpN(topW)+'" stroke-linecap="square"/>';
      return s;
    }
    const o=w.door,k=o.k,hh=(front?wl.h*0.3:wl.h)*0.95;
    this._og[k]={hinge:w.a,shut:w.b,open:[w.a[0]+o.n[0]*o.width,w.a[1]+o.n[1]*o.width],z:hh};
    return'<polygon class="rfp-ease" data-rfp-leaf="'+k+'" data-rfp-lk="quad" points="" fill="'+WT.door+'" stroke="'+(wl.top||'#888')+'" stroke-width="1"/>';
  }
  // ---- the vacuum on the plan (v6.49.0, V7_PLAN §6.6) ----
  // AnyVac map sensors on this plan: floorplan.vacuums (v6.50.0) when set, else every map the card
  // found. A vacuum is drawn when it has a transform into the plan (another home frame, aligned in
  // the studio) or shares the plan's own frame (source.frame) — home px → metres via origin_px.
  _vacList(){
    const v=this.o.cfg&&this.o.cfg.vacuums;
    if(!Array.isArray(v))return null;
    return v.map(function(x){return x&&typeof x==='object'?x:{entity:x};}).filter(function(x){return typeof x.entity==='string'&&x.entity;});
  }
  _robots(){
    const fp=this.o.cfg||{},src=fp.source&&typeof fp.source==='object'?fp.source:null;
    const S=(this.o.hass&&this.o.hass.states)||{},fr=src&&src.frame?String(src.frame):'',self=this;
    const srcOk=!!(src&&Array.isArray(src.origin_px)&&rfpNum(src.mm_per_px)>0);
    return this._anyvac().filter(function(id){
      const a=S[id]&&S[id].attributes;if(!a||!a.vacuum_position_home_px)return false;
      if(self._vacT(id))return true;
      return srcOk&&(!fr||!a.home_frame||String(a.home_frame.id||'')===fr);
    });
  }
  // a vacuum's own transform into the plan: {rotation (deg), x, y (m)} from floorplan.vacuums
  _vacT(id){
    const l=this._vacList();if(!l)return null;
    const e=l.find(function(x){return x.entity===id;});
    const t=e&&e.transform&&typeof e.transform==='object'?e.transform:null;
    return t&&isFinite(rfpNum(t.x))&&isFinite(rfpNum(t.y))?{r:(rfpNum(t.rotation)||0)*Math.PI/180,x:rfpNum(t.x),y:rfpNum(t.y)}:null;
  }
  // home px of vacuum `id` → plan metres
  _toPlan(p,id){
    const x=rfpNum(p&&p.x),y=rfpNum(p&&p.y);if(!(isFinite(x)&&isFinite(y)))return null;
    const t=id?this._vacT(id):null;
    if(t){
      const S=(this.o.hass&&this.o.hass.states)||{},hf=(S[id]&&S[id].attributes&&S[id].attributes.home_frame)||{};
      const k=(rfpNum(hf.cell_mm)>0&&rfpNum(hf.scale)>0?rfpNum(hf.cell_mm)/rfpNum(hf.scale):12.5)/1000;
      const qx=x*k,qy=y*k,c=Math.cos(t.r),s=Math.sin(t.r);
      return[c*qx-s*qy+t.x,s*qx+c*qy+t.y];
    }
    const src=this.o.cfg.source;if(!src||!Array.isArray(src.origin_px))return null;
    const k=rfpNum(src.mm_per_px)/1000;
    return[(x-rfpNum(src.origin_px[0]))*k,(y-rfpNum(src.origin_px[1]))*k];
  }
  // where the vacuum is and its trail: AnyVac's 3 s live update when it belongs to the snapshot
  // shown (live.base_points == path_points, AnyVac docs/48), else the snapshot
  _vacState(id){
    const S=(this.o.hass&&this.o.hass.states)||{},a=(S[id]&&S[id].attributes)||{};
    const lv=a.live&&typeof a.live==='object'&&rfpNum(a.live.base_points)===rfpNum(a.path_points)?a.live:null;
    const segs=function(k){return Array.isArray(a[k])?a[k]:[];};
    return{a:a,pos:(lv&&lv.pos_home_px)||a.vacuum_position_home_px,
      dry:segs('path_dry_home_px').concat(lv&&Array.isArray(lv.dry_home_px)?lv.dry_home_px:[]),
      wet:segs('path_wet_home_px').concat(lv&&Array.isArray(lv.wet_home_px)?lv.wet_home_px:[]),seq:lv?lv.seq:''};
  }
  // Each vacuum's colours (v6.51.0): its own `color` / `mop_color` / `mop_opacity` from
  // floorplan.vacuums, else — with more than one vacuum on the plan — one from the palette in list
  // order, else the theme's (vac.* tokens). A colour set for a vacuum colours its robot, its dry
  // line and (unless mop_color says otherwise) its mop band and its room badge.
  _vacColors(id){
    const VT=rfpVacT(this.T),all=this._anyvac(),i=all.indexOf(id),l=this._vacList()||[];
    const e=l.find(function(x){return x.entity===id;})||{};
    const ok=function(v){return typeof v==='string'&&/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(v.trim())?v.trim():'';};
    const own=ok(e.color)||(all.length>1&&i>=0?RFP_VAC_PALETTE[i%RFP_VAC_PALETTE.length]:'');
    const mo=rfpNum(e.mop_opacity);
    return{robot:own||VT.robot,dry:own||VT.dry,wet:ok(e.mop_color)||own||VT.wet,wetOpacity:mo>=0&&mo<=1?mo:VT.wetOpacity,under:VT.under,underOpacity:VT.underOpacity};
  }
  // The robots' SVG. Their nodes are numbered in the order of _robots() when drawn; a vacuum that
  // appears or drops out later (its map sensor not loaded yet, no position for a while) would shift
  // that order, so _applyRobots redraws the group whenever the list changes (7.0.0-beta.3: before,
  // a robot could take another vacuum's colour, or be missing).
  _robotsSvg(T,F){
    if(!this.L.vacuum)return'';
    return'<g pointer-events="none" data-rfp-robots>'+this._robotsInner(F)+'</g>';
  }
  _robotsInner(F){
    const ids=this._robots();this._robotIdsR=ids.slice();if(!ids.length)return'';
    const r=Math.max(7,F.S*0.17),self=this;let s='';
    ids.forEach(function(id,i){
      const c=rfpEsc(self._vacColors(id).robot);
      s+='<g class="rfp-robot" data-rfp-robot="'+i+'" opacity="0" style="transform:translate(-100px,-100px)">'
        +'<circle class="rfp-ping" r="'+rfpN(r)+'" fill="none" stroke="'+c+'" stroke-width="2" data-rfp-rping="'+i+'" opacity="0"/>'
        +'<g data-rfp-rhead="'+i+'"><circle r="'+rfpN(r)+'" fill="#f4f6f8" stroke="'+c+'" stroke-width="2.5"/>'
        +'<circle cx="'+rfpN(r*0.32)+'" r="'+rfpN(r*0.36)+'" fill="#cfd6de" stroke="rgba(0,0,0,.25)" stroke-width="1"/>'
        +'<path d="M'+rfpN(r*0.72)+' 0L'+rfpN(r*0.38)+' '+rfpN(-r*0.3)+'V'+rfpN(r*0.3)+'Z" fill="'+c+'"/></g></g>';
    });
    return s;
  }
  _applyRobots(){
    const N=this._nodes,F=this.F,self=this;if(!N||!this.svg)return;
    const ids=this._robots();
    if(ids.join('|')!==(this._robotIdsR||[]).join('|')){
      const g=this.svg.querySelector('[data-rfp-robots]');
      if(g){
        g.innerHTML=this._robotsInner(F);
        const by=function(a){const o={};[].forEach.call(g.querySelectorAll('['+a+']'),function(el){const k=el.getAttribute(a);(o[k]=o[k]||[]).push(el);});return o;};
        N.robot=by('data-rfp-robot');N.rhead=by('data-rfp-rhead');N.rping=by('data-rfp-rping');
        this._trailSig=null;
      }
    }
    if(!N.robot||!Object.keys(N.robot).length){const tg0=this.svg.querySelector('[data-rfp-trail]');if(tg0&&this._trailSig!=='')tg0.innerHTML='';this._trailSig='';return;}
    const P=function(p){return rfpP(F,p[0],p[1],0.03);};
    const vs={};
    ids.forEach(function(id,i){
      const el=(N.robot[i]||[])[0];if(!el)return;
      const v=vs[id]=self._vacState(id),p=self._toPlan(v.pos,id);
      if(!p){el.setAttribute('opacity','0');return;}
      const q=P(p),t=self._vacT(id);
      let ang=rfpNum(v.pos&&v.pos.a),deg=0;
      if(isFinite(ang)){if(t)ang+=t.r*180/Math.PI;const tt=ang*Math.PI/180,q2=P([p[0]+Math.cos(tt)*0.3,p[1]+Math.sin(tt)*0.3]);deg=Math.atan2(q2[1]-q[1],q2[0]-q[0])*180/Math.PI;}
      const tr='translate('+rfpN(q[0])+'px,'+rfpN(q[1])+'px)';
      if(el.getAttribute('opacity')==='0'){el.style.transition='none';el.style.transform=tr;try{el.getBoundingClientRect();}catch(_){}el.style.transition='';}
      else el.style.transform=tr;
      (N.rhead[i]||[]).forEach(function(h){h.setAttribute('transform','rotate('+rfpN(deg)+')');});
      const busy=!!v.a.in_cleaning;
      (N.rping[i]||[]).forEach(function(c){c.setAttribute('opacity',busy?'1':'0');c.style.display=busy?'':'none';}); // the ping animates opacity: hide it outright
      el.setAttribute('opacity',busy?'1':'0.85');
    });
    // the trail of the vacuums cleaning now (dry: a line, wet: the mop's band)
    const tg=this.svg.querySelector('[data-rfp-trail]');if(!tg)return;
    let sig='';const parts=[];
    ids.forEach(function(id){
      // the last run stays on the plan, like in AnyVac's own card; its shared dry / wet toggles apply
      const v=vs[id]||self._vacState(id),vl=v.a.view_layers&&typeof v.a.view_layers==='object'?v.a.view_layers:{};
      if(self.o.cfg&&self.o.cfg.trail_mode==='cleaning'&&!v.a.in_cleaning)return; // only while it cleans
      [['wet',vl.wet===false?[]:v.wet],['dry',vl.dry===false?[]:v.dry]].forEach(function(x){
        let n=0;x[1].forEach(function(sg){n+=Array.isArray(sg)?sg.length:0;});
        const vc0=self._vacColors(id);
        sig+=id+x[0]+n+'/'+v.seq+'/'+vc0.dry+vc0.wet+vc0.wetOpacity+vc0.under+vc0.underOpacity+';';parts.push({kind:x[0],segs:x[1],id:id});
      });
    });
    if(sig===this._trailSig)return;
    this._trailSig=sig;
    let h='',hu='';
    parts.forEach(function(pt){
      let d='';
      pt.segs.forEach(function(sg){
        if(!Array.isArray(sg))return;let last=null,first=true;
        sg.forEach(function(v){
          const p=self._toPlan(Array.isArray(v)?{x:v[0],y:v[1]}:v,pt.id);if(!p)return;
          if(last&&Math.hypot(p[0]-last[0],p[1]-last[1])<0.05)return;
          d+=(first?'M':'L')+rfpN(p[0])+' '+rfpN(p[1]);first=false;last=p;
        });
      });
      const vc=self._vacColors(pt.id);
      if(d&&pt.kind==='wet'&&vc.underOpacity>0)hu+='<path data-rfp-wetu="'+rfpEsc(pt.id)+'" d="'+d+'" fill="none" stroke="'+rfpEsc(vc.under)+'" stroke-opacity="'+rfpN(vc.underOpacity)+'" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round"/>';
      if(d)h+=pt.kind==='wet'?'<path data-rfp-wet="'+rfpEsc(pt.id)+'" d="'+d+'" fill="none" stroke="'+rfpEsc(vc.wet)+'" stroke-opacity="'+rfpN(vc.wetOpacity)+'" stroke-width="0.25" stroke-linecap="round" stroke-linejoin="round"/>'
        :'<path data-rfp-dry="'+rfpEsc(pt.id)+'" d="'+d+'" fill="none" stroke="'+rfpEsc(vc.dry)+'" stroke-opacity=".75" stroke-width="0.04" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    // every band's underlay first: a second vacuum's underlay does not dim the first one's band
    tg.innerHTML=hu+h;
  }
  // the source map's room key for a room name (rooms of other vacuums carry their own keys)
  _avKey(name){
    const src=this.o.cfg&&this.o.cfg.source,S=(this.o.hass&&this.o.hass.states)||{};
    const a=src&&src.anyvac&&S[src.anyvac]&&S[src.anyvac].attributes;
    const r=a&&Array.isArray(a.rooms)?a.rooms.find(function(x){return x&&x.name===name;}):null;
    return r&&r.home_room_id?String(r.home_room_id):'';
  }
  // the AnyVac room record of a plan room (last cleaned, progress, coverage), from the plan's map
  _avRoom(r){
    const key=r&&r.cfg&&r.cfg.anyvac_room;if(!key)return null;
    const S=(this.o.hass&&this.o.hass.states)||{},src=this.o.cfg&&this.o.cfg.source;
    const ids=(src&&src.anyvac?[src.anyvac]:[]).concat(this._anyvac());
    for(const id of ids){
      const a=S[id]&&S[id].attributes;const x=a&&Array.isArray(a.rooms)?a.rooms.find(function(q){return q&&String(q.home_room_id||'')===String(key);}):null;
      if(x)return x;
    }
    return null;
  }
  // Tap targets over the openings that have something to show or do (screen px, over the rooms)
  _openingHits(M,F,wallH){
    if(!this.L.openings)return'';
    let s='';
    M.openings.forEach(function(o){
      const c=o.cfg;if(!(o.entity||o.cover||c.tap_action||c.hold_action))return;
      const w2=o.width/2,z=wallH*0.5;
      const A=rfpP(F,o.at[0]-o.u[0]*w2,o.at[1]-o.u[1]*w2,z),B=rfpP(F,o.at[0]+o.u[0]*w2,o.at[1]+o.u[1]*w2,z);
      s+='<line class="rfp-hit-o" data-rfp-open="'+o.k+'" x1="'+rfpN(A[0])+'" y1="'+rfpN(A[1])+'" x2="'+rfpN(B[0])+'" y2="'+rfpN(B[1])+'" stroke="transparent" stroke-width="'+rfpN(Math.max(18,F.S*0.3))+'" stroke-linecap="round"/>';
    });
    return s;
  }
  // Live state of the doors and windows: open (contact on), how far the blind is down (0–1)
  _applyOpenings(force){
    const N=this._nodes,M=this.M,self=this,F=this.F;
    if(!N||!M||!this.L.openings)return;
    const S=(this.o.hass&&this.o.hass.states)||{},WT=rfpWinT(this.T);
    M.openings.forEach(function(o){
      const k=o.k,es=o.entity?S[o.entity]:null,cs=o.cover?S[o.cover]:null;
      const open=!!es&&RFP_OPEN.indexOf(String(es.state))>=0;
      let c=-1;
      if(cs){
        let p=rfpNum((cs.attributes||{}).current_position);
        if(!isFinite(p))p=cs.state==='closed'?0:(cs.state==='open'||cs.state==='opening'||cs.state==='closing'?100:NaN);
        if(isFinite(p)){if(o.cfg.invert)p=100-p;c=1-Math.max(0,Math.min(100,p))/100;}
      }
      const sig=open+'|'+c;
      if(!force&&self._os[k]===sig)return;
      self._os[k]=sig;
      (N.glass[k]||[]).forEach(function(el){el.setAttribute(el.getAttribute('data-rfp-ga')||'stroke',open?WT.open:WT.glass);});
      (N.pane[k]||[]).forEach(function(el){el.setAttribute('opacity',open?'1':'0');});
      (N.arc[k]||[]).forEach(function(el){el.setAttribute('opacity',open?'1':'0');});
      (N.blind[k]||[]).forEach(function(el){
        if(el.getAttribute('data-rfp-bk')==='quad'){
          const g=self._og[k];if(!g)return;
          if(!(c>0.005)){el.setAttribute('points','');return;}
          const zc=g.z1-c*(g.z1-g.z0);
          el.setAttribute('points',rfpPts([rfpP(F,g.a[0],g.a[1],g.z1),rfpP(F,g.b[0],g.b[1],g.z1),rfpP(F,g.b[0],g.b[1],zc),rfpP(F,g.a[0],g.a[1],zc)]));
        }else el.setAttribute('opacity',c>0.005?rfpN(0.3+0.7*c):'0');
      });
      (N.leaf[k]||[]).forEach(function(el){
        const g=self._og[k];if(!g)return;
        const e=open?g.open:g.shut;
        if(el.getAttribute('data-rfp-lk')==='quad')el.setAttribute('points',rfpPts([rfpP(F,g.hinge[0],g.hinge[1],0),rfpP(F,e[0],e[1],0),rfpP(F,e[0],e[1],g.z),rfpP(F,g.hinge[0],g.hinge[1],g.z)]));
        else{el.setAttribute('x2',rfpN(e[0]));el.setAttribute('y2',rfpN(e[1]));}
      });
    });
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
      const p=rfpP(F,r.lab[0],r.lab[1],0);
      const pw=self._projW(r,F);
      const compact=r.area<3.5||pw<Math.max(r.name.length*fs*0.62+24,fs*7);
      r.compact=compact;
      s+='<g data-rfp-label="'+k+'" transform="translate('+rfpN(p[0])+','+rfpN(p[1])+')">';
      if(L.chip&&L.chip!=='none')s+='<rect data-rfp-chip="'+k+'" rx="'+(compact?7:10)+'" fill="'+L.chip+'"/>';
      if(compact)s+='<text data-rfp-name="'+k+'" y="'+rfpN(fs*0.35)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.82)+'" font-weight="600" fill="'+L.c+'"><tspan>'+rfpEsc(r.name)+'</tspan><tspan data-rfp-val="'+k+'" fill="'+L.sub+'" font-weight="500"></tspan></text>';
      else s+='<text data-rfp-name="'+k+'" y="'+rfpN(-fs*0.15)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs)+'" font-weight="600" fill="'+L.c+'">'+rfpEsc(r.name)+'</text>'
        +'<text data-rfp-val="'+k+'" y="'+rfpN(fs*0.95)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.78)+'" fill="'+L.sub+'"></text>';
      if(!compact&&r.media.length&&self.L.media)s+='<text data-rfp-media="'+k+'" y="'+rfpN(fs*2.05)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.72)+'" fill="'+(T.mediaColor||'#8ecbff')+'"></text>';
      // when the room was cleaned — also under a compact label (7.0.0-beta.3: small rooms had none)
      if(self.L.cleaning&&r.cfg.anyvac_room)s+='<text data-rfp-clean="'+k+'" y="'+rfpN(fs*(compact?1.55:2.05))+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*(compact?0.66:0.7))+'" fill="'+L.sub+'"></text>';
      r.lp=p;
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
  _anyvac(){const p=this.o.anyvac;let l=typeof p==='function'?p():p;l=Array.isArray(l)?l:[];const v=this._vacList();return v?v.map(function(x){return x.entity;}).filter(function(id){return l.indexOf(id)>=0;}):l;}
  // ---- markers and labels (HTML) ----
  _itemsHtml(T,M,F){
    const box=this.items;
    const cleanRooms=this.L.cleaning&&T.mode==='plan'?M.rooms.filter(function(r){return r.cfg.anyvac_room;}):[];
    if((!this.L.items||!M.items.length)&&!cleanRooms.length){box.innerHTML='';return;}
    const inter=!!this.o.interactive,self=this,lang=this._lang();
    const chip=T.label.chip&&T.label.chip!=='none'?T.label.chip:(T.dark?'rgba(10,12,15,.72)':'rgba(255,255,255,.9)');
    box.style.cssText='--rfp-ibg:'+chip+';--rfp-ink:'+T.label.c+';--rfp-on:'+(T.lightColor||'#ffb35c')+';--rfp-font:'+RFP_FONT[T.label.font==='hand'?'hand':(T.label.font||'sans')]+';';
    let h='<style>'+RFP_ITEM_CSS+'</style>';
    (this.L.items?M.items:[]).forEach(function(it){
      const p=rfpP(F,it.at[0],it.at[1],0),c=it.cfg;
      const sz=c.size?' --rfp-isz:'+rfpEsc(c.size)+';':'';
      const on=c.color?' --rfp-on:'+rfpEsc(c.color)+';':'';
      h+='<div class="rfp-it rfp-it-'+it.type+(inter?' on-tap':'')+'" data-rfp-item="'+it.k+'" style="left:'+rfpN(p[0])+'px;top:'+rfpN(p[1])+'px;'+sz+on+'"'+(inter?' role="button" tabindex="0" aria-label="'+rfpEsc(c.name||it.entity||'')+'"':'')+'>';
      if(it.type==='marker')h+='<div class="rfp-it-ic"><ha-icon icon="'+rfpEsc(c.icon||self._defIcon(it.entity))+'"></ha-icon></div>'+(c.show_state||c.name?'<div class="rfp-it-tx" data-rfp-itx></div>':'');
      else h+='<div class="rfp-it-tx" data-rfp-itx></div>';
      h+='</div>';
    });
    // "clean this room" (v6.50.0): next to the label, placed by _apply once the label is measured
    cleanRooms.forEach(function(r){
      const t=rfpT(lang,'clean').replace('{room}',r.name);
      h+='<div class="rfp-it rfp-cleanb'+(inter?' on-tap':'')+'" data-rfp-cleanbtn="'+r.i+'" style="left:-100px;top:-100px;--rfp-isz:28px;" title="'+rfpEsc(t)+'"'+(inter?' role="button" tabindex="0" aria-label="'+rfpEsc(t)+'"':'')+'><div class="rfp-it-ic"><ha-icon icon="mdi:robot-vacuum"></ha-icon></div></div>';
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
      const p=rfpP(F,r.lab[0],r.lab[1],0),pw=self._projW(r,F);
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
      person:by(q('[data-rfp-person]'),'data-rfp-person'),
      glass:by(q('[data-rfp-glass]'),'data-rfp-glass'),pane:by(q('[data-rfp-pane]'),'data-rfp-pane'),blind:by(q('[data-rfp-blind]'),'data-rfp-blind'),
      leaf:by(q('[data-rfp-leaf]'),'data-rfp-leaf'),arc:by(q('[data-rfp-arc]'),'data-rfp-arc'),
      robot:by(q('[data-rfp-robot]'),'data-rfp-robot'),clean:by(q('[data-rfp-clean]'),'data-rfp-clean'),rhead:by(q('[data-rfp-rhead]'),'data-rfp-rhead'),rping:by(q('[data-rfp-rping]'),'data-rfp-rping'),pinit:by(q('[data-rfp-pinit]'),'data-rfp-pinit'),
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
    st.clean='';
    if(this.L&&this.L.cleaning&&r.cfg.anyvac_room){
      const x=this._avRoom(r);
      if(x){
        const lang=this._lang(),self=this;
        const age=function(t){const ms=Date.now()-Date.parse(t);if(!isFinite(ms)||ms<0)return'';const m=Math.round(ms/60000);
          return m<60?rfpT(lang,'min').replace('{n}',Math.max(1,m)):(m<2880?rfpT(lang,'hr').replace('{n}',Math.round(m/60)):rfpT(lang,'day').replace('{n}',Math.round(m/1440)));};
        if(isFinite(rfpNum(x.progress_pct)))st.clean=rfpT(lang,'cleaning')+' '+self._fmt(rfpNum(x.progress_pct),0)+' %';
        else st.clean=[x.last_dry?rfpT(lang,'vac')+' '+age(x.last_dry):'',x.last_wet?rfpT(lang,'mop')+' '+age(x.last_wet):''].filter(function(v){return v&&!/ $/.test(v);}).join(' · ');
      }
    }
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
    const self=this,M=this.M,S=(this.o.hass&&this.o.hass.states)||{},L=this.L;
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
      if(k<0){const k2=self._avKey(a.vacuum_room_name);if(k2)k=M.rooms.findIndex(function(r){return String(r.cfg.anyvac_room||'')===k2;});}
      if(k<0)k=byName(a.vacuum_room_name);
      if(k<0)k=byCard(rm(a.vacuum_room_name));
      if(k>=0&&!out.vac[k])out.vac[k]=self._vacColors(id).robot;
    });
    return out;
  }
  _apply(force){
    const N=this._nodes;if(!N||!this.M)return;
    const T=this.T,self=this,lang=this._lang();
    const SG=this._signals();
    this.M.rooms.forEach(function(r,k){
      const st=self._roomState(r);
      st.att=SG.att[k]||0;st.vac=!!SG.vac[k];st.vacC=typeof SG.vac[k]==='string'?SG.vac[k]:'';
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
      set(N.clean[k],function(el){el.textContent=st.clean;el.setAttribute('y',rfpN(self.fs*(r.compact?1.55:(N.media[k]&&st.media?2.95:2.05))));});
      // labels (a playing room gets ▶ on a compact label)
      set(N.val[k],function(el){el.textContent=r.compact&&T.mode==='plan'?((val?'  '+val:'')+(st.media&&!N.media[k]?'  ▶':'')):val;});
      // label box: measured when the browser lays the text out; estimated otherwise (hidden, jsdom)
      if(N.label[k]&&T.mode==='plan'){
        const fs=self.fs,g=N.label[k][0];let tw=0;
        [].forEach.call(g.querySelectorAll('text'),function(t){try{tw=Math.max(tw,t.getComputedTextLength());}catch(_){}});
        if(!(tw>0)){const nameW=r.name.length*fs*(r.compact?0.5:0.58),valW=val.length*fs*(r.compact?0.46:0.47);tw=Math.max(nameW+(r.compact?valW:0),r.compact?0:valW,(st.media.length+2)*fs*0.4,st.clean.length*fs*0.4);}
        const cl=N.clean[k]&&st.clean?1:0;
        const w=tw+(r.compact?20:28),h=r.compact?fs*(1.55+cl*0.9):fs*(2.75+(N.media[k]&&st.media?1:0)+cl*0.95),y0=r.compact?-fs*0.775:-fs*1.45;
        // the clean button sits at the label's right edge
        const cb=self.items.querySelector('[data-rfp-cleanbtn="'+r.i+'"]');
        if(cb&&r.lp){cb.style.left=rfpN(r.lp[0]+w/2+18)+'px';cb.style.top=rfpN(r.lp[1]+y0+h/2)+'px';}
        set(N.chip[k],function(el){el.setAttribute('x',rfpN(-w/2));el.setAttribute('y',rfpN(y0));el.setAttribute('width',rfpN(w));el.setAttribute('height',rfpN(h));});
        set(N.att[k],function(el){if(!el.hasAttribute('data-rfp-fixed'))el.setAttribute('transform','translate('+rfpN(w/2)+','+rfpN(y0)+')');});
        set(N.vac[k],function(el){if(!el.hasAttribute('data-rfp-fixed'))el.setAttribute('transform','translate('+rfpN(-w/2)+','+rfpN(y0)+')');});
      }
      // attention / vacuum badges
      set(N.att[k],function(el){el.setAttribute('opacity',st.att?'1':'0');});
      set(N.attn[k],function(el){el.textContent=st.att?String(st.att):'';});
      set(N.vac[k],function(el){el.setAttribute('opacity',st.vac?'1':'0');const c=el.querySelector('circle');if(c&&st.vacC)c.setAttribute('fill',st.vacC);});
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
    this._applyOpenings(force);
    if(force)this._trailSig=null;
    this._applyRobots();
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
      else{const q=rfpP(F,r.lab[0],r.lab[1],0);p=[q[0]+(j-(g.length-1)/2)*fs*1.8,q[1]-fs*(r.compact?1.9:2.75)];}
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
        if(n.getAttribute){const c=n.getAttribute('data-rfp-ctl');if(c)return{ctl:c};const it=n.getAttribute('data-rfp-item');if(it!=null)return{item:+it};const op=n.getAttribute('data-rfp-open');if(op!=null)return{open:+op};const cl=n.getAttribute('data-rfp-cleanbtn');if(cl!=null)return{clean:+cl};const h=n.getAttribute('data-rfp-hit');if(h!=null)return{room:+h};}
        n=n.parentNode;
      }
      return null;
    };
    sv.addEventListener('pointerdown',function(e){
      if(!self.o.interactive||e.button>0)return;
      const t=target(e);if(!t)return;
      down={t:t,x:e.clientX,y:e.clientY,held:false};
      clearTimeout(self._holdT);
      if(t.room!=null||t.item!=null||t.open!=null)self._holdT=setTimeout(function(){if(down){down.held=true;self._act(t,'hold');}},550);
    });
    sv.addEventListener('pointermove',function(e){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10){clearTimeout(self._holdT);down=null;}});
    const cancel=function(){clearTimeout(self._holdT);down=null;};
    sv.addEventListener('pointercancel',cancel);sv.addEventListener('pointerleave',cancel);
    sv.addEventListener('pointerup',function(e){
      clearTimeout(self._holdT);
      if(!down||!self.o.interactive)return;
      const d=down;down=null;if(d.held)return;
      const t=target(e);if(!t||t.room!==d.t.room||t.ctl!==d.t.ctl||t.item!==d.t.item||t.open!==d.t.open||t.clean!==d.t.clean)return;
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
    }else if(t.clean!=null){
      // "clean this room": AnyVac's planner with the room's name on the map (confirmed first)
      if(kind!=='tap')return;
      const r=M.rooms.find(function(x){return x.i===t.clean;});const x=r&&this._avRoom(r);if(!x||!x.name)return;
      const md=this.o.cfg&&this.o.cfg.clean_mode;
      a={action:'perform-action',perform_action:'anyvac.clean',data:{rooms:[String(x.name)],mode:['dry','wet','both'].indexOf(md)>=0?md:'dry'},
        confirmation:{text:rfpT(this._lang(),'clean_q').replace('{room}',r.name)}};
    }else if(t.open!=null){
      const o=M.openings.find(function(x){return x.k===t.open;});if(!o)return;
      const c=o.cfg,mi=function(e){return e?{action:'more-info',entity:e}:null;};
      a=kind==='tap'?(c.tap_action||mi(o.cover)||mi(o.entity)):(c.hold_action||mi(o.entity)||mi(o.cover));
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
// ---- Registration ---------------------------------------------------------------------------
// The card's loader (rocLoadFloorplan) looks for RoomOverlayCard._rocFloorplan after the import.
function rfpRegister(){
  const C=customElements.get('room-overlay-card');
  if(!C){console.warn('[room-overlay-card] floorplan: room-overlay-card.js is not loaded');return;}
  C._rocFloorplan={version:ROC_FP_VERSION,
    mount:function(host,opts){return new RfpView(host,opts);},
    View:RfpView,themes:RFP_THEMES,themeNames:RFP_THEME_NAMES,theme:rfpTheme,themeName:rfpThemeName,
    geom:{poly:rfpPoly,area:rfpArea,bbox:rfpBBox,inPoly:rfpInPoly,distSeg:rfpDistSeg,pole:rfpPole,wallSegs:rfpWallSegs,openingEdge:rfpOpeningEdge,
      proj:RFP_PROJ,fit:rfpFit,P:rfpP,inv:rfpInv,viewDir:rfpViewDir,clean:rfpCleanOutline,doors:rfpProposeDoors,kelvin:rfpKelvin}};
}
if(customElements.get('room-overlay-card'))rfpRegister();
else customElements.whenDefined('room-overlay-card').then(rfpRegister);
})();
