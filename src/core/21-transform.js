// ---- Overlay transform engine (v6.7.0) ----------------------------------
// Maps an entity onto a CSS transform, so an overlay PNG can swing, slide, tilt
// or spin instead of only fading. One declarative block for every moving part
// (door, window, garage, drawer, oven flap, fan) instead of a hand-written
// renderer per thing, which is how blinds, the vacuum icon and glow each ended
// up with their own animation code.
const TF_SPIN_AXIS={z:'roc-tf-spin',x:'roc-tf-spin-x',y:'roc-tf-spin-y'};
// 'perspective(800px) rotateY(-72deg)' -> [{fn:'perspective',args:['800px']},…]
function tfSplit(str){
  const out=[],re=/([a-zA-Z]+)\(([^)]*)\)/g;let m;
  while((m=re.exec(String(str==null?'':str))))out.push({fn:m[1],args:m[2].split(',').map(function(a){return a.trim();})});
  return out;
}
function tfLerpArg(a,b,t){
  const ra=/^(-?[\d.]+)(.*)$/.exec(a||''),rb=/^(-?[\d.]+)(.*)$/.exec(b||'');
  if(!ra||!rb)return t<0.5?a:b;
  const unit=ra[2]||rb[2]||'';
  const v=parseFloat(ra[1])+(parseFloat(rb[1])-parseFloat(ra[1]))*t;
  return v.toFixed(3).replace(/\.?0+$/,'')+unit;
}
// Interpolates two transform strings argument by argument. Both sides must list
// the same functions in the same order (rotateY→rotateY); anything else snaps
// at the midpoint rather than producing a nonsense transform.
function tfLerp(from,to,t){
  const fa=tfSplit(from),ta=tfSplit(to);
  if(!fa.length)return to;
  if(!ta.length)return from;
  if(fa.length!==ta.length)return t<0.5?from:to;
  const out=[];
  for(let i=0;i<fa.length;i++){
    if(fa[i].fn!==ta[i].fn)return t<0.5?from:to;
    const args=[],len=Math.max(fa[i].args.length,ta[i].args.length);
    for(let j=0;j<len;j++)args.push(tfLerpArg(fa[i].args[j]===undefined?'0':fa[i].args[j],ta[i].args[j]===undefined?'0':ta[i].args[j],t));
    out.push(fa[i].fn+'('+args.join(', ')+')');
  }
  return out.join(' ');
}
// -> {transform, animation} ('animation' is null unless this is a spin block,
// so the overlay's own pulse/blink keeps its animation slot).
function tfResolve(tf,st){
  if(!tf)return null;
  const persp=tf.perspective?('perspective('+tf.perspective+') '):'';
  const off=!st||st.state==='off'||st.state==='unavailable'||st.state==='unknown';
  const raw=st?(tf.attribute?(st.attributes?st.attributes[tf.attribute]:undefined):st.state):undefined;
  if(tf.spin){
    // The value drives SPEED, not a position: full scale = min_duration.
    const sp=(tf.spin===true)?{}:tf.spin;
    const num=Number(raw);
    const lo=sp.min_value==null?0:Number(sp.min_value),hi=sp.max_value==null?100:Number(sp.max_value);
    const frac=isNaN(num)?1:Math.max(0,Math.min(1,(num-lo)/((hi-lo)||1)));
    const dmin=parseFloat(sp.min_duration==null?'0.35s':sp.min_duration)||0.35;
    const dmax=parseFloat(sp.max_duration==null?'2.5s':sp.max_duration)||2.5;
    const dur=dmax-(dmax-dmin)*frac;
    const name=TF_SPIN_AXIS[sp.axis||'z']||TF_SPIN_AXIS.z;
    return{transform:'',animation:(off||(!isNaN(num)&&frac<=0))?'none':(name+' '+dur.toFixed(2)+'s linear infinite'+(sp.reverse?' reverse':''))};
  }
  if(tf.from&&tf.to){
    const num=Number(raw);
    const v0=Number(tf.from.value==null?0:tf.from.value),v1=Number(tf.to.value==null?100:tf.to.value);
    let t=isNaN(num)?0:(num-v0)/((v1-v0)||1);
    t=Math.max(0,Math.min(1,t));
    return{transform:persp+tfLerp(tf.from.transform||'none',tf.to.transform||'none',t),animation:null};
  }
  if(tf.map){
    const key=raw==null?'':String(raw);
    const val=(tf.map[key]!==undefined)?tf.map[key]:tf.map['*'];
    return{transform:val?(persp+val):'none',animation:null};
  }
  return null;
}
