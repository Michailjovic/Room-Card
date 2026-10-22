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
