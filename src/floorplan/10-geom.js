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
// Wall pieces of one room: every edge minus the openings (doors) that sit on it (`open`: p is a
// path, not a closed polygon). An opening
// belongs to an edge when its centre is within `tol` of the edge line, so one door cuts the walls
// of BOTH rooms it connects (adjacent rooms are separate polygons a few cm apart).
function rfpWallSegs(p,openings,tol,open){
  tol=tol==null?0.3:tol;
  const out=[];
  for(let i=0;i<(open?p.length-1:p.length);i++){
    const a=p[i],b=p[(i+1)%p.length];
    const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);if(L<1e-6)continue;
    const ux=dx/L,uy=dy/L;
    const cuts=[];
    for(const o of openings||[]){
      const at=o.at,w=rfpNum(o.width)>0?rfpNum(o.width):0.8;
      if(!at)continue;
      // only along the wall it sits in: a door near a corner used to cut the perpendicular wall too
      if(o.u&&Math.abs(o.u[0]*uy-o.u[1]*ux)>0.2)continue;
      const rx=at[0]-a[0],ry=at[1]-a[1];
      const t=rx*ux+ry*uy,d=Math.abs(rx*uy-ry*ux);
      if(d>tol||t<-w/2||t>L+w/2)continue;
      cuts.push([t-w/2,t+w/2]);
    }
    cuts.sort(function(m,n){return m[0]-n[0];});
    let cur=0;
    // a sliver (< 12 cm) between a door or window and a corner is the frame, not a wall: it stood as
    // a lone post. Between two openings it is a mullion and stays.
    const seg=function(t0,t1,cut){if(t1-t0>(cut?0.12:0.01))out.push({a:[a[0]+ux*t0,a[1]+uy*t0],b:[a[0]+ux*t1,a[1]+uy*t1],edge:i});};
    let first=true;
    for(const k of cuts){if(k[1]<=cur||k[0]>=L)continue;if(k[0]>cur)seg(cur,k[0],first);cur=Math.max(cur,k[1]);first=false;}
    if(cur<L)seg(cur,L,cuts.length>0);
  }
  return out;
}
// The wall network of the whole plan (7.0.0-beta.4). Each room is its own polygon, so the wall
// between two rooms used to be drawn twice — on top of each other when the rooms touch, or as two
// walls a few cm apart when the vacuum map left a gap (or an overlap) between them. Edges of two
// rooms that run parallel within `tol` (0.2 m), face each other and overlap by 0.3 m or more are merged: the shared stretch becomes ONE wall on
// the middle line (shared: true, owned by the lower room index), the rest of each edge stays where
// it is. Doors and windows then cut the result exactly like rfpWallSegs does.
function rfpWallNet(polys,openings,tol){
  tol=tol==null?0.2:tol;
  const edges=[];
  polys.forEach(function(p,ri){
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
      if(L<1e-6)continue;
      const u=[dx/L,dy/L],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
      const n=rfpInPoly(mx-u[1]*0.04,my+u[0]*0.04,p)?[-u[1],u[0]]:[u[1],-u[0]]; // into the room
      edges.push({r:ri,i:i,a:a,b:b,L:L,u:u,n:n});
    }
  });
  const pieces=[];
  edges.forEach(function(e){
    const cover=[];      // [t0,t1] stretches of e that another room's edge runs along
    edges.forEach(function(f){
      if(f.r===e.r)return;
      if(Math.abs(e.u[0]*f.u[1]-e.u[1]*f.u[0])>0.05)return;            // not parallel (~3°)
      if(e.n[0]*f.n[0]+e.n[1]*f.n[1]>-0.9)return;                      // rooms on the same side: two walls
      const off=(f.a[0]-e.a[0])*-e.u[1]+(f.a[1]-e.a[1])*e.u[0];         // signed distance of f's line
      if(Math.abs(off)>tol)return;
      const ta=(f.a[0]-e.a[0])*e.u[0]+(f.a[1]-e.a[1])*e.u[1],tb=(f.b[0]-e.a[0])*e.u[0]+(f.b[1]-e.a[1])*e.u[1];
      const fa=Math.min(ta,tb),fb=Math.max(ta,tb);
      const o0=Math.max(0,fa),o1=Math.min(e.L,fb);
      if(o1-o0<0.3)return;                                              // a brush past a corner
      // a stub of either edge shorter than tol past the shared stretch joins it (no 5 cm tooth)
      const t0=Math.max(o0-0,o0-fa)<tol?Math.min(0,fa):o0,t1=Math.max(e.L-o1,fb-o1)<tol?Math.max(e.L,fb):o1;
      cover.push([Math.max(0,t0),Math.min(e.L,t1)]);
      // the lower room owns the shared stretch and draws it on the middle line
      if(e.r<f.r){
        const h=off/2,nx=-e.u[1]*h,ny=e.u[0]*h;
        pieces.push({a:[e.a[0]+e.u[0]*t0+nx,e.a[1]+e.u[1]*t0+ny],b:[e.a[0]+e.u[0]*t1+nx,e.a[1]+e.u[1]*t1+ny],edge:e.i,room:e.r,shared:true});
      }
    });
    cover.sort(function(m,n){return m[0]-n[0];});
    let cur=0;
    const keep=function(t0,t1){if(t1-t0>0.04)pieces.push({a:[e.a[0]+e.u[0]*t0,e.a[1]+e.u[1]*t0],b:[e.a[0]+e.u[0]*t1,e.a[1]+e.u[1]*t1],edge:e.i,room:e.r});};
    cover.forEach(function(k){if(k[1]<=cur)return;if(k[0]>cur)keep(cur,k[0]);cur=Math.max(cur,k[1]);});
    if(cur<e.L)keep(cur,e.L);
  });
  // a stretch shared by three rooms would be emitted twice: drop exact repeats
  const seen={},uniq=pieces.filter(function(w){
    const k=[w.a[0],w.a[1],w.b[0],w.b[1]].map(function(v){return Math.round(v*50);});
    const k1=k.join(','),k2=[k[2],k[3],k[0],k[1]].join(',');
    if(seen[k1]||seen[k2])return false;seen[k1]=1;return true;
  });
  const out=[];
  uniq.forEach(function(w){
    rfpWallSegs([w.a,w.b],openings,0.3,true).forEach(function(s){s.edge=w.edge;s.room=w.room;if(w.shared)s.shared=true;out.push(s);});
  });
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
  const rm=rfpMul([c,s,-s,c],mr),m=rfpMul(P.m,rm);
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
  return{m:[m[0]*S,m[1]*S,m[2]*S,m[3]*S],e:e,f:f,S:S,zf:P.z*S,proj:proj,unit:m,rm:rm};
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
// ---- Floor heating loops and their feeds (7.1.0, HEATING_PLAN.md) -----------------------------
// The card draws the loops itself: no rendered images. Every room with a thermostat gets a
// counter-flow (bifilar) spiral in the biggest rectangle that fits it `margin` from its walls; with
// a manifold placed, every loop also gets its feed, routed from the manifold through the rooms. A
// wall can be crossed only at a pass (a point the user clicks on the wall), so the user decides
// where the pipes go under the walls. Everything in plan metres.
// The biggest axis-aligned rectangle inside polygon p, at least m from its walls (grid g).
function rfpMaxRect(p,m,g){
  g=g||0.05;
  const b=rfpBBox(p),nx=Math.ceil((b[2]-b[0])/g),ny=Math.ceil((b[3]-b[1])/g);
  if(!(nx>0&&ny>0)||nx*ny>4e6)return null;
  const hgt=new Int32Array(nx);let best={a:0};
  for(let j=0;j<ny;j++){
    for(let i=0;i<nx;i++){const x=b[0]+(i+0.5)*g,y=b[1]+(j+0.5)*g;hgt[i]=rfpInPoly(x,y,p)&&rfpEdgeDist(x,y,p)>=m?hgt[i]+1:0;}
    const st=[];
    for(let i=0;i<=nx;i++){
      const h=i<nx?hgt[i]:0;let start=i;
      while(st.length&&st[st.length-1].h>=h){const t=st.pop(),a=t.h*(i-t.i);if(a>best.a)best={a:a,i0:t.i,i1:i,j0:j+1-t.h,j1:j+1};start=t.i;}
      st.push({i:start,h:h});
    }
  }
  return best.a?[b[0]+best.i0*g,b[1]+best.j0*g,b[0]+best.i1*g,b[1]+best.j1*g]:null;
}
// A rectangular spiral into a w×h box, step s between laps: starts at 0,0 along +x, the inside
// on its right (y down). The loop's return runs back between the laps (rfpOffset by s/2).
function rfpSpiralIn(w,h,s){
  let x0=0,y0=0,x1=w,y1=h;const P=[[0,0]];
  for(let g=0;g<400;g++){
    P.push([x1,y0]);if(y1-y0<1.5*s)break;
    P.push([x1,y1]);if(x1-x0<1.5*s)break;
    P.push([x0,y1]);y0+=s;if(y1-y0<1.5*s)break;
    P.push([x0,y0]);x0+=s;x1-=s;y1-=s;if(x1-x0<1.5*s)break;
  }
  return P;
}
// A polyline moved d to its right (y down), mitred at the corners.
function rfpOffset(P,d){
  const sg=[];
  for(let i=0;i<P.length-1;i++){const dx=P[i+1][0]-P[i][0],dy=P[i+1][1]-P[i][1],L=Math.hypot(dx,dy);if(L>1e-9)sg.push({a:P[i],b:P[i+1],n:[-dy/L,dx/L]});}
  if(!sg.length)return P.slice();
  const out=[[sg[0].a[0]+sg[0].n[0]*d,sg[0].a[1]+sg[0].n[1]*d]];
  for(let k=1;k<sg.length;k++){
    const n1=sg[k-1].n,n2=sg[k].n,q=sg[k].a,dot=n1[0]*n2[0]+n1[1]*n2[1];
    if(dot<-0.99)continue;
    out.push(dot>0.99?[q[0]+n1[0]*d,q[1]+n1[1]*d]:[q[0]+(n1[0]+n2[0])*d/(1+dot),q[1]+(n1[1]+n2[1])*d/(1+dot)]);
  }
  const l=sg[sg.length-1];out.push([l.b[0]+l.n[0]*d,l.b[1]+l.n[1]*d]);
  return out;
}
function rfpSimplify(P){
  const q=[];
  P.forEach(function(p){const l=q[q.length-1];if(!l||Math.hypot(p[0]-l[0],p[1]-l[1])>1e-6)q.push(p);});
  if(q.length<3)return q;
  const o=[q[0]];
  for(let i=1;i<q.length-1;i++){const a=o[o.length-1],b=q[i],c=q[i+1];if(Math.abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))>1e-9)o.push(b);}
  o.push(q[q.length-1]);return o;
}
// The routing grid: each cell belongs to the first room that holds it; cells near a wall and on a
// loop cost more (feeds run along the loops, not across them); a pass opens the walls within r.
function rfpHeatGrid(polys,fields,passes,r){
  const g=0.05;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  polys.forEach(function(p){const b=rfpBBox(p);x0=Math.min(x0,b[0]);y0=Math.min(y0,b[1]);x1=Math.max(x1,b[2]);y1=Math.max(y1,b[3]);});
  if(!isFinite(x0))return null;
  x0-=0.4;y0-=0.4;x1+=0.4;y1+=0.4;
  const nx=Math.ceil((x1-x0)/g),ny=Math.ceil((y1-y0)/g);if(nx*ny>2e6)return null;
  const room=new Int16Array(nx*ny).fill(-1),cost=new Float32Array(nx*ny),zone=new Uint8Array(nx*ny);
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const x=x0+(i+0.5)*g,y=y0+(j+0.5)*g,c=j*nx+i;
    for(let k=0;k<polys.length;k++)if(rfpInPoly(x,y,polys[k])){room[c]=k;cost[c]=rfpEdgeDist(x,y,polys[k])<0.1?3:0;break;}
    if(room[c]<0)continue;
    fields.forEach(function(f){if(f&&x>f[0]&&x<f[2]&&y>f[1]&&y<f[3])cost[c]+=2;});
  }
  const rc=Math.ceil(r/g);
  (passes||[]).forEach(function(p){
    const ci=Math.floor((p[0]-x0)/g),cj=Math.floor((p[1]-y0)/g);
    for(let dj=-rc;dj<=rc;dj++)for(let di=-rc;di<=rc;di++){
      const i=ci+di,j=cj+dj;if(i<0||j<0||i>=nx||j>=ny)continue;
      if(Math.hypot(x0+(i+0.5)*g-p[0],y0+(j+0.5)*g-p[1])<=r)zone[j*nx+i]=1;
    }
  });
  return{g:g,x0:x0,y0:y0,nx:nx,ny:ny,room:room,cost:cost,zone:zone};
}
function rfpGridCell(G,p){
  const free=function(c){return G.room[c]>=0||G.zone[c]===1;};
  const i=Math.max(0,Math.min(G.nx-1,Math.floor((p[0]-G.x0)/G.g))),j=Math.max(0,Math.min(G.ny-1,Math.floor((p[1]-G.y0)/G.g)));
  if(free(j*G.nx+i))return j*G.nx+i;
  for(let r=1;r<40;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){
    if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;
    const ii=i+di,jj=j+dj;if(ii<0||jj<0||ii>=G.nx||jj>=G.ny)continue;
    if(free(jj*G.nx+ii))return jj*G.nx+ii;
  }
  return-1;
}
// A* over the grid with a heading in the state (a turn costs 8 cells: few bends). A move from one
// room into another is allowed only inside a pass. occ: extra cost of cells other feeds took.
function rfpRoute(G,a,b,occ){
  const s=rfpGridCell(G,a),t=rfpGridCell(G,b);if(s<0||t<0)return null;
  const nx=G.nx,NS=nx*G.ny*4,dist=new Float32Array(NS).fill(Infinity),prev=new Int32Array(NS).fill(-1),done=new Uint8Array(NS);
  const hk=[],hv=[];
  const swap=function(x,y){let q=hk[x];hk[x]=hk[y];hk[y]=q;q=hv[x];hv[x]=hv[y];hv[y]=q;};
  const push=function(k,v){hk.push(k);hv.push(v);let i=hk.length-1;while(i>0){const p=(i-1)>>1;if(hv[p]<=hv[i])break;swap(p,i);i=p;}};
  const pop=function(){const k=hk[0],lk=hk.pop(),lv=hv.pop();if(hk.length){hk[0]=lk;hv[0]=lv;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<hk.length&&hv[l]<hv[m])m=l;if(r<hk.length&&hv[r]<hv[m])m=r;if(m===i)break;swap(m,i);i=m;}}return k;};
  const ti=t%nx,tj=(t-ti)/nx,H=function(c){const i=c%nx,j=(c-i)/nx;return Math.abs(i-ti)+Math.abs(j-tj);};
  for(let d=0;d<4;d++){dist[s*4+d]=0;push(s*4+d,H(s));}
  const DI=[1,0,-1,0],DJ=[0,1,0,-1];let end=-1;
  while(hk.length){
    const u=pop();if(done[u])continue;done[u]=1;
    const c=u>>2,d=u&3;if(c===t){end=u;break;}
    const ci=c%nx,cj=(c-ci)/nx;
    for(let nd=0;nd<4;nd++){
      if(nd===((d+2)&3))continue;
      const ii=ci+DI[nd],jj=cj+DJ[nd];if(ii<0||jj<0||ii>=nx||jj>=G.ny)continue;
      const nc=jj*nx+ii;if(!(G.room[nc]>=0||G.zone[nc]))continue;
      if(G.room[c]!==G.room[nc]&&!G.zone[c]&&!G.zone[nc])continue;
      const v=nc*4+nd,wt=dist[u]+1+(G.zone[nc]?0:G.cost[nc])+(occ?occ[nc]:0)+(nd!==d?8:0);
      if(wt<dist[v]){dist[v]=wt;prev[v]=u;push(v,wt+H(nc));}
    }
  }
  if(end<0)return null;
  const cells=[];for(let u=end;u>=0;u=prev[u])cells.push(u>>2);cells.reverse();
  const pts=cells.map(function(c){const i=c%nx,j=(c-i)/nx;return[G.x0+(i+0.5)*G.g,G.y0+(j+0.5)*G.g];});
  // exact ends, square to the first and last step
  const p0=pts[0],pe=pts[pts.length-1];
  if(pts.length>1&&Math.abs(pts[1][0]-p0[0])<1e-6)pts[0]=[p0[0],a[1]];else pts[0]=[a[0],p0[1]];
  pts.unshift(a.slice());
  pts.push(pts.length>1&&Math.abs(pts[pts.length-2][1]-pe[1])<1e-6?[b[0],pe[1]]:[pe[0],b[1]]);pts.push(b.slice());
  return{cells:cells,pts:rfpSimplify(pts),cost:dist[end]};
}
// The circuits of a plan. polys: every room's polygon; loops: [{k (room index), poly}];
// o: {pitch (pipe to pipe, m), margin (m), manifold ([x,y] or null), passes ([[x,y]]), passR}.
// Returns [{k, field, sup (manifold → centre), ret (centre → manifold), routed, missing}].
function rfpHeatCircuits(polys,loops,o){
  o=o||{};
  const p=rfpNum(o.pitch)>=0.08?Math.min(0.6,rfpNum(o.pitch)):0.2,mg=rfpNum(o.margin)>=0?rfpNum(o.margin):0.25,m=o.manifold;
  // 7.4.2: a loop starts where its feed comes in. Each field has 8 ways to lay the spiral — which
  // corner it starts in, and whether its first run follows the field's width or its height. The
  // feed pair arrives square to the field's edge, in line with that first run, so the supply flows
  // straight into the spiral's outer turn and the return straight out of it. With a manifold every
  // way is routed and the cheapest wins (before, the corner nearest the manifold won, and a feed
  // coming in elsewhere ran along the wall to it — a doubled pipe beside the first turn).
  const way=function(f,cx,cy,t){
    const map=function(q){const u=t?q[1]:q[0],v=t?q[0]:q[1];return[cx?f[2]-u:f[0]+u,cy?f[3]-v:f[1]+v];};
    const W=f[2]-f[0],H=f[3]-f[1],ap=Math.min(0.15,Math.max(0.05,mg*0.6));
    return{map:map,w:t?H:W,h:t?W:H,entry:map([0,p/2]),pre:map([-ap,p/2])};
  };
  const items=loops.map(function(L){
    const f=rfpMaxRect(L.poly,mg);if(!f||f[2]-f[0]<3*p||f[3]-f[1]<3*p)return null;
    const ways=[];[0,1].forEach(function(cx){[0,1].forEach(function(cy){[0,1].forEach(function(t){ways.push(way(f,cx,cy,t));});});});
    const near=m?ways.reduce(function(b,w){const d=Math.abs(m[0]-w.entry[0])+Math.abs(m[1]-w.entry[1]);return d<b?d:b;},Infinity):0;
    // without a manifold: the corner nearest the origin, first run along the width (as before)
    return{L:L,f:f,ways:ways,dist:near};
  }).filter(Boolean).sort(function(a,b){return a.dist-b.dist;});
  const G=m?rfpHeatGrid(polys,items.map(function(x){return x.f;}),o.passes,o.passR||0.35):null;
  const occ=G?new Float32Array(G.nx*G.ny):null;
  return items.map(function(it){
    const f=it.f;let w=it.ways[0],r=null,routed=false,missing=false;
    if(G){
      it.ways.forEach(function(x){const q=rfpRoute(G,m,x.pre,occ);if(q&&(!r||q.cost<r.cost)){r=q;w=x;}});
      if(!r)missing=true;
    }
    const Sc=rfpSpiralIn(w.w,w.h,2*p),Rc=rfpOffset(Sc,p);
    const Sp=Sc.map(w.map),Rp=Rc.map(w.map);
    let sup=Sp,ret=[Sp[Sp.length-1]].concat(Rp.slice().reverse());
    if(r){
      routed=true;
      const rr=Math.ceil(p*1.15/G.g);
      r.cells.forEach(function(c){const i=c%G.nx,j=(c-i)/G.nx;
        for(let dj=-rr;dj<=rr;dj++)for(let di=-rr;di<=rr;di++){const ii=i+di,jj=j+dj;if(ii>=0&&jj>=0&&ii<G.nx&&jj<G.ny)occ[jj*G.nx+ii]+=25;}});
      // the last step goes square into the field: pre → entry
      const pts=rfpSimplify(r.pts.concat([w.entry]));
      const A=rfpOffset(pts,p/2),B=rfpOffset(pts,-p/2),e=Sp[0];
      const da=Math.hypot(A[A.length-1][0]-e[0],A[A.length-1][1]-e[1]),db=Math.hypot(B[B.length-1][0]-e[0],B[B.length-1][1]-e[1]);
      sup=rfpSimplify((da<=db?A:B).concat(Sp));ret=rfpSimplify(ret.concat((da<=db?B:A).slice().reverse()));
    }
    return{k:it.L.k,field:f,sup:sup,ret:ret,routed:routed,missing:missing};
  });
}
// ---- a vacuum's map on the plan (7.4.0) ----------------------------------------------------------
// AnyVac gives every map a home frame; it can change (AnyVac 1.6x moved all vacuums of a home into
// one shared frame), and a frame-bound mapping then draws the robot in the wrong place or not at
// all. This fits each map to the plan itself, by its rooms: the plan rooms with an `anyvac_room`
// key (else the same name) pair with the map's rooms; a rigid fit (rotation + shift, both in mm)
// of their centroids maps home px → plan metres. Returns {r (rad), x, y, k (m / px), n, rms} or null.
function rfpCentroid(p){
  let a=0,cx=0,cy=0;
  for(let i=0;i<p.length;i++){const q=p[i],n=p[(i+1)%p.length],c=q[0]*n[1]-n[0]*q[1];a+=c;cx+=(q[0]+n[0])*c;cy+=(q[1]+n[1])*c;}
  if(Math.abs(a)<1e-9){let x=0,y=0;p.forEach(function(q){x+=q[0];y+=q[1];});return p.length?[x/p.length,y/p.length]:null;}
  return[cx/(3*a),cy/(3*a)];
}
function rfpVacRoomPts(r){
  const ol=rfpPoly(r&&r.outline_home_px),b=r&&r.bbox_home_px;
  const bb=b&&isFinite(b.x0)?[[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]]:null;
  if(ol.length>=3&&(!bb||Math.abs(rfpArea(ol))>=0.25*Math.abs(rfpArea(bb))))return ol;
  return bb||[];
}
// plan: [{key, name, poly (m)}]; rooms: the map's `rooms` attribute; k: metres per home px
function rfpVacFit(plan,rooms,k){
  if(!Array.isArray(plan)||!Array.isArray(rooms)||!(k>0))return null;
  const norm=function(v){return String(v==null?'':v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'');};
  const pairs=[],used={};
  rooms.forEach(function(vr){
    if(!vr||typeof vr!=='object')return;
    let pr=vr.home_room_id?plan.find(function(x){return x.key&&String(x.key)===String(vr.home_room_id);}):null;
    if(!pr&&vr.name)pr=plan.find(function(x){return!x.key&&norm(x.name)===norm(vr.name);});
    if(!pr||used[pr.i])return;
    const cp=rfpCentroid(pr.poly),pts=rfpVacRoomPts(vr),cq=pts.length>=3?rfpCentroid(pts):null;if(!cp||!cq)return;
    used[pr.i]=1;pairs.push({p:cp,q:[cq[0]*k,cq[1]*k]});
  });
  if(pairs.length<2)return null;
  const n=pairs.length,mp=[0,0],mq=[0,0];
  pairs.forEach(function(x){mp[0]+=x.p[0]/n;mp[1]+=x.p[1]/n;mq[0]+=x.q[0]/n;mq[1]+=x.q[1]/n;});
  let num=0,den=0;
  pairs.forEach(function(x){const qx=x.q[0]-mq[0],qy=x.q[1]-mq[1],px=x.p[0]-mp[0],py=x.p[1]-mp[1];num+=qx*py-qy*px;den+=qx*px+qy*py;});
  const th=Math.atan2(num,den),c=Math.cos(th),s=Math.sin(th);
  const tx=mp[0]-(c*mq[0]-s*mq[1]),ty=mp[1]-(s*mq[0]+c*mq[1]);
  let e=0;pairs.forEach(function(x){const X=c*x.q[0]-s*x.q[1]+tx,Y=s*x.q[0]+c*x.q[1]+ty;e+=(X-x.p[0])*(X-x.p[0])+(Y-x.p[1])*(Y-x.p[1]);});
  return{r:th,x:tx,y:ty,k:k,n:n,rms:Math.sqrt(e/n)};
}
