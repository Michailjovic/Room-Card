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
const ROC_FP_VERSION='6.47.0';
const RFP_NS='http://www.w3.org/2000/svg';
let rfpUid=0;
function rfpEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function rfpN(v){return Math.round(v*100)/100;}
function rfpNum(v){if(v===null||v===undefined||v==='')return NaN;const n=typeof v==='number'?v:parseFloat(v);return isFinite(n)?n:NaN;}
// Strings the plan itself draws (labels, empty state). The studio has its own table.
const RFP_STR={
  en:{empty:'No floor plan yet',empty2:'Open the Studio to import it from AnyVac or draw it',heating:'heating',light:'Light',heat:'Heating',on:'on',off:'off',idle:'idle',none:'—'},
  cs:{empty:'Půdorys zatím není',empty2:'Otevři Studio a naimportuj ho z AnyVac nebo ho nakresli',heating:'topí',light:'Světlo',heat:'Topení',on:'zap.',off:'vyp.',idle:'stojí',none:'—'},
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
function rfpFit(pts,proj,rotDeg,W,H,pad,zTop){
  const P=RFP_PROJ[proj]||RFP_PROJ.top;
  const r=(rfpNum(rotDeg)||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  const m=rfpMul(P.m,[c,s,-s,c]);
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
  +'.rfp-paused .rfp-flow{animation-play-state:paused}'
  +'@media (prefers-reduced-motion:reduce){.rfp-flow{animation:none}.rfp-light,.rfp-heat .rfp-w,.rfp-heat .rfp-c{transition:none}}';
class RfpView{
  constructor(host,opts){
    this.host=host;this.uid='rfp'+(++rfpUid);this.o=Object.assign({interactive:true},opts||{});
    this.svg=document.createElementNS(RFP_NS,'svg');
    this.svg.setAttribute('class','rfp-svg');
    this.svg.setAttribute('role','img');
    this.svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;user-select:none;-webkit-user-select:none;touch-action:pan-y pinch-zoom;';
    host.appendChild(this.svg);
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
    this._wire();
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
      rooms.push({i:i,cfg:r,poly:poly,name:String(name),link:link,floor:r.floor||'wood',
        lights:list(r.lights),climate:r.climate?String(r.climate):'',temp:r.temperature?String(r.temperature):'',hum:r.humidity?String(r.humidity):'',
        pole:rfpPole(poly),bbox:rfpBBox(poly),area:Math.abs(rfpArea(poly))});
    });
    const openings=(Array.isArray(fp.openings)?fp.openings:[]).filter(function(o){return o&&(o.type||'door')==='door';}).map(function(o,k){
      const at=rfpPoly([o.at])[0];return at?{k:k,at:at,width:rfpNum(o.width)>0?rfpNum(o.width):0.8,cfg:o}:null;
    }).filter(Boolean);
    return{rooms:rooms,openings:openings};
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
    this._st={};this._nodes=null;
    if(!(W>2&&H>2)){this.svg.innerHTML='';return;}
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
      this.svg.innerHTML=s;this._afterRender();return;
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
    s+='<g class="rfp-edit"></g>';
    this.svg.innerHTML=s;
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
      s+='<g clip-path="url(#'+id+'-c'+k+')">'+self._heatSvg(T,r,k)+self._lightSvg(T,r,k)+'</g>';
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
    s+=this._labels(T,M,F);
    if(T.paper&&fx)s+='<rect width="'+W+'" height="'+H+'" filter="url(#'+id+'-paper)" pointer-events="none"/>';
    if(T.vignette)s+='<rect width="'+W+'" height="'+H+'" fill="url(#'+id+'-vg)" pointer-events="none"/>';
    return s;
  }
  _heatSvg(T,r,k){
    if(!r.climate)return'';
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
    if(!r.lights.length)return'';
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
      if(T.dims)s+='<text y="'+rfpN(fs*2.25)+'" text-anchor="middle" font-family="'+font+'" font-size="'+rfpN(fs*0.7)+'" fill="'+L.sub+'">'+(Math.round(r.area*10)/10).toLocaleString(self._lang())+' m²</text>';
      s+='</g>';
    });
    return s+'</g>';
  }
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
        +'<text data-rfp-th="'+k+'" y="'+rfpN(big*0.32+fs*1.25)+'" text-anchor="middle" font-size="'+rfpN(Math.max(10,fs*0.8))+'" fill="#fff"></text></g>';
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
    return st;
  }
  _fmt(v,d){return isFinite(v)?v.toLocaleString(this._lang(),{minimumFractionDigits:d,maximumFractionDigits:d}):'';}
  _apply(force){
    const N=this._nodes;if(!N||!this.M)return;
    const T=this.T,self=this,lang=this._lang();
    this.M.rooms.forEach(function(r,k){
      const st=self._roomState(r),sig=JSON.stringify(st);
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
      // labels
      set(N.val[k],function(el){el.textContent=r.compact&&T.mode==='plan'?(val?'  '+val:''):val;});
      set(N.chip[k],function(el){
        // measured when the browser lays the text out; estimated otherwise (hidden, jsdom)
        const fs=self.fs,g=el.parentNode;let tw=0;
        [].forEach.call(g.querySelectorAll('text'),function(t){try{tw=Math.max(tw,t.getComputedTextLength());}catch(_){}});
        if(!(tw>0)){const nameW=r.name.length*fs*(r.compact?0.5:0.58),valW=val.length*fs*(r.compact?0.46:0.47);tw=Math.max(nameW+(r.compact?valW:0),r.compact?0:valW);}
        const w=tw+(r.compact?20:28),h=r.compact?fs*1.55:fs*2.75;
        el.setAttribute('x',rfpN(-w/2));el.setAttribute('y',rfpN(r.compact?-h/2:-fs*1.45));el.setAttribute('width',rfpN(w));el.setAttribute('height',rfpN(h));
      });
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
        set(N.val[k],function(el){el.textContent=N.big[k]?(isFinite(st.h)?self._fmt(st.h,0)+' %':''):val;});
        set(N.cbg['light:'+k],function(el){el.setAttribute('fill',st.on?tt.iconOn:tt.icon);});
        set(N.cv['light:'+k],function(el){el.textContent=st.on?rfpT(lang,'on')+(st.bri<0.995?' '+Math.round(st.bri*100)+' %':''):rfpT(lang,'off');el.setAttribute('fill',st.on?tt.inkOn:tt.ink);});
        set(N.cbg['heat:'+k],function(el){el.setAttribute('fill',st.heat==='heat'?tt.heatBg:tt.icon);});
        set(N.cv['heat:'+k],function(el){el.textContent=st.heat==='heat'?rfpT(lang,'heating'):(st.heat==='off'?rfpT(lang,'off'):rfpT(lang,'idle'));el.setAttribute('fill',st.heat==='heat'?tt.heatInk:tt.ink);});
      }
    });
  }
  // ---- interaction: tap opens the room (or more-info), hold toggles its lights ----
  _wire(){
    const self=this,sv=this.svg;let down=null;
    const target=function(e){
      let n=e.target,g=0;
      while(n&&n!==sv&&g++<8){
        if(n.getAttribute){const c=n.getAttribute('data-rfp-ctl');if(c)return{ctl:c};const h=n.getAttribute('data-rfp-hit');if(h!=null)return{room:+h};}
        n=n.parentNode;
      }
      return null;
    };
    sv.addEventListener('pointerdown',function(e){
      if(!self.o.interactive||e.button>0)return;
      const t=target(e);if(!t)return;
      down={t:t,x:e.clientX,y:e.clientY,held:false};
      clearTimeout(self._holdT);
      if(t.room!=null)self._holdT=setTimeout(function(){if(down){down.held=true;self._act(t,'hold');}},550);
    });
    sv.addEventListener('pointermove',function(e){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>10){clearTimeout(self._holdT);down=null;}});
    const cancel=function(){clearTimeout(self._holdT);down=null;};
    sv.addEventListener('pointercancel',cancel);sv.addEventListener('pointerleave',cancel);
    sv.addEventListener('pointerup',function(e){
      clearTimeout(self._holdT);
      if(!down||!self.o.interactive)return;
      const d=down;down=null;if(d.held)return;
      const t=target(e);if(!t||t.room!==d.t.room||t.ctl!==d.t.ctl)return;
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
    if(t.ctl){
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
