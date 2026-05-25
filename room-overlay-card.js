/**
 * room-overlay-card v0.3.11 — MIT License
 * https://github.com/Michailjovic/Room-Card
 */
window.customCards=window.customCards||[];
window.customCards.push({type:'room-overlay-card',name:'Room Overlay Card',description:'Room visualization with image layers, transitions and clickable zones',preview:true});

function evalCond(c,s){
  const e=s[c.entity];if(!e)return false;
  const sv=e.state,nv=parseFloat(sv);let r=true;
  if(c.state!==undefined)r=sv===String(c.state);
  else if(c.state_not!==undefined)r=Array.isArray(c.state_not)?!c.state_not.map(String).includes(sv):sv!==String(c.state_not);
  else if(c.operator!==undefined&&c.value!==undefined){
    const cv=typeof c.value==='number'?c.value:parseFloat(String(c.value));
    if(isNaN(nv)||isNaN(cv))r=false;
    else switch(c.operator){case'<':r=nv<cv;break;case'>':r=nv>cv;break;case'<=':r=nv<=cv;break;case'>=':r=nv>=cv;break;case'==':r=nv===cv;break;case'!=':r=nv!==cv;break;default:r=false;}
  }
  if(r&&c.and)r=evalCond(c.and,s);
  if(!r&&c.or)r=evalCond(c.or,s);
  return r;
}

function resolveVal(conds,states,fallback){
  for(const cv of conds){if(cv.condition===undefined)continue;if(evalCond(cv.condition,states))return cv.value;}
  const d=conds.find(cv=>cv.condition===undefined);return d!==undefined?d.value:fallback;
}

function resolveFilter(conds,states){
  for(const fc of conds){if(fc.condition===undefined)continue;if(evalCond(fc.condition,states))return fc.filter;}
  const d=conds.find(fc=>fc.condition===undefined);return d?d.filter:'none';
}

const BPOS={'bottom-left':'bottom:10px;left:10px','bottom-right':'bottom:10px;right:10px','top-left':'top:10px;left:10px','top-right':'top:10px;right:10px'};

function makeBadgePos(b){
  if(b.position==='custom')return 'top:'+(b.y||'auto')+';left:'+(b.x||'auto')+';';
  return BPOS[b.position||'bottom-left']||BPOS['bottom-left'];
}

function makeHACard(cfg){
  if(!cfg?.type)return null;
  const name=cfg.type.startsWith('custom:')?cfg.type.substring(7):`hui-${cfg.type}-card`;
  let el;
  try{el=document.createElement(name);}catch(e){console.error('[room-overlay-card] createElement failed:',name,e);return null;}
  const apply=()=>{if(typeof el.setConfig==='function')try{el.setConfig(cfg);}catch(e){console.error('[room-overlay-card] setConfig failed:',cfg.type,e);}};
  customElements.get(name)?apply():customElements.whenDefined(name).then(apply);
  return el;
}

class RoomOverlayCard extends HTMLElement{
  constructor(){
    super();this.attachShadow({mode:'open'});
    this._config=null;this._hass=null;this._rendered=false;
    this._baseEl=null;this._ovEls={};this._zoneEls={};
    this._biconEls={};this._blabelEls={};this._cardEls={};this._contEls={};
    this._icoEls={};
    this._rafPending=false;this._relevantEntities=null;this._prevStates={};
    this._io=null;this._visible=true;
  }

  static getStubConfig(){return{base_image:'/local/room.webp',aspect_ratio:'16/9',border_radius:'12px',filter_conditions:[],overlays:[],zones:[],badges:[],elements:[],icons:[],test_mode:false};}

  setConfig(cfg){
    if(!cfg.base_image)throw new Error('[room-overlay-card] base_image is required');
    this._config=cfg;this._rendered=false;if(this._hass)this._render();
  }

  set hass(h){
    this._hass=h;if(!this._config)return;
    if(!this._rendered){this._render();return;}
    if(!this._visible)return;
    if(this._relevantEntities){
      const s=h.states,p=this._prevStates;
      if(!this._relevantEntities.some(id=>s[id]?.state!==p[id]))return;
    }
    if(!this._rafPending){
      this._rafPending=true;
      requestAnimationFrame(()=>{
        this._rafPending=false;
        if(this._hass&&this._rendered)this._update();
      });
    }
  }

  _extractEntities(obj,ids=new Set()){
    if(!obj||typeof obj!=='object')return ids;
    if(typeof obj.entity==='string')ids.add(obj.entity);
    for(const v of Object.values(obj)){
      if(Array.isArray(v))v.forEach(i=>this._extractEntities(i,ids));
      else if(v&&typeof v==='object')this._extractEntities(v,ids);
    }
    return ids;
  }

  getCardSize(){return 4;}

  _addZoneListeners(el,tapAction,holdAction,doubleTapAction,holdDelay){
    const delay=holdDelay??500;
    let holdTimer=null,held=false,tapTimer=null,lastTapTime=0;
    const self=this;
    const onTap=function(e){
      if(held){if(holdAction)self._exec(holdAction,e);held=false;return;}
      if(doubleTapAction){
        const now=Date.now();
        if(now-lastTapTime<350&&tapTimer){
          clearTimeout(tapTimer);tapTimer=null;lastTapTime=0;
          self._exec(doubleTapAction,e);
        }else{
          lastTapTime=now;
          if(tapAction)tapTimer=setTimeout(function(){tapTimer=null;self._exec(tapAction,e);},350);
        }
      }else{
        if(tapAction)self._exec(tapAction,e);
      }
    };
    el.addEventListener('touchstart',function(){
      held=false;clearTimeout(holdTimer);
      if(holdAction)holdTimer=setTimeout(function(){held=true;},delay);
    },{passive:true});
    el.addEventListener('touchend',function(e){
      clearTimeout(holdTimer);e.stopPropagation();e.preventDefault();onTap(e);
    });
    el.addEventListener('touchmove',function(){clearTimeout(holdTimer);},{passive:true});
    el.addEventListener('touchcancel',function(){clearTimeout(holdTimer);held=false;});
    el.addEventListener('mousedown',function(){
      held=false;clearTimeout(holdTimer);
      if(holdAction)holdTimer=setTimeout(function(){held=true;},delay);
    });
    el.addEventListener('click',function(e){
      clearTimeout(holdTimer);e.stopPropagation();e.preventDefault();onTap(e);
    });
    el.addEventListener('mouseleave',function(){clearTimeout(holdTimer);held=false;});
  }

  _pad(r){
    const p=(r||'16/9').split('/');
    if(p.length===2){const w=parseFloat(p[0]),h=parseFloat(p[1]);if(w>0&&h>0)return((h/w)*100).toFixed(4)+'%';}
    return'56.25%';
  }

  _preloadImages(){
    const c=this._config,urls=new Set();
    if(c.base_image)urls.add(c.base_image);
    for(const ov of(c.overlays||[])){
      if(ov.image)urls.add(ov.image);
      if(ov.state_images)ov.state_images.forEach(function(m){if(m.image)urls.add(m.image);});
    }
    urls.forEach(function(url){const img=new Image();img.src=url;});
  }

  _render(){
    if(!this._config)return;
    const c=this._config,tm=c.test_mode??false;
    const pad=this._pad(c.aspect_ratio),br=c.border_radius??'12px';

    const ovHtml=(c.overlays||[]).map((ov,i)=>`<div class="layer ov" data-ov="${ov.id}" style="z-index:${ov.z_index??i+1};opacity:0;transition:opacity ${ov.transition??'2s ease'},filter ${ov.transition??'2s ease'};will-change:opacity,transform;transform:translateZ(0);"></div>`).join('');
    const zHtml=(c.zones||[]).map(z=>`<div class="zone" data-z="${z.id}" style="top:${z.top};left:${z.left};width:${z.width};height:${z.height};z-index:50;cursor:${(z.tap_action||z.hold_action||z.double_tap_action)?'pointer':'default'};box-sizing:border-box;-webkit-tap-highlight-color:transparent;${tm?'outline:3px solid red;background:rgba(255,0,0,0.08);':''}" title="${tm?`[${z.id}] ${z.top} ${z.left} ${z.width}x${z.height}`:''}">${tm?`<span class="zlabel">${z.id}</span>`:''}</div>`).join('');
    const bHtml=(c.badges||[]).map(b=>`<div class="badge" data-b="${b.id}" style="${makeBadgePos(b)};cursor:${b.tap_action?'pointer':'default'};-webkit-tap-highlight-color:transparent;">${b.icon?`<ha-icon data-bi="${b.id}" icon="${b.icon}" style="color:white;--mdc-icon-size:14px;width:14px;height:14px;display:flex;"></ha-icon>`:''} ${b.label!==undefined?`<span class="blabel" data-bl="${b.id}"></span>`:''}</div>`).join('');
    const icoHtml=(c.icons||[]).map(ico=>{const sz=ico.size||'20px';return'<div class="ico" data-ico="'+ico.id+'" style="position:absolute;top:'+ico.top+';left:'+ico.left+';z-index:'+(ico.z_index??6)+';cursor:'+(ico.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;"><ha-icon data-icoicon="'+ico.id+'" icon="'+(ico.icon||'')+'" style="--mdc-icon-size:'+sz+';width:'+sz+';height:'+sz+';display:flex;color:white;pointer-events:none;"></ha-icon></div>';}).join('');

    this.shadowRoot.innerHTML='<style>:host{display:block;}ha-card{overflow:hidden;padding:0!important;background:transparent;border-radius:'+br+'}.wrap{position:relative;width:100%;padding-bottom:'+pad+';overflow:hidden;}.content{position:absolute;inset:0;overflow:hidden;}.layer{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;}.zone{position:absolute;}.zlabel{position:absolute;top:2px;left:4px;font-size:10px;color:red;font-weight:bold;pointer-events:none;text-shadow:0 0 3px white;white-space:nowrap;}.badge{position:absolute;z-index:100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px 10px;white-space:nowrap;user-select:none;}.blabel{font-size:12px;color:white;font-weight:500;}.elcont{position:absolute;pointer-events:auto;}.elcont>*{width:100%!important;height:100%!important;display:block;}</style><ha-card><div class="wrap"><div class="content"><div class="layer base" style="background-image:url(\''+c.base_image+'\');transition:filter '+(c.filter_transition??'2s ease')+';will-change:filter,transform;transform:translateZ(0);"></div>'+ovHtml+zHtml+bHtml+icoHtml+'</div></div></ha-card>';

    const content=this.shadowRoot.querySelector('.content');
    this._baseEl=this.shadowRoot.querySelector('.base');
    this._ovEls={};
    for(const ov of(c.overlays||[])){this._ovEls[ov.id]=this.shadowRoot.querySelector('[data-ov="'+ov.id+'"]');}
    this._zoneEls={};
    for(const z of(c.zones||[])){
      const el=this.shadowRoot.querySelector('[data-z="'+z.id+'"]');
      if(!el)continue;this._zoneEls[z.id]=el;
      if(z.tap_action||z.hold_action||z.double_tap_action)
        this._addZoneListeners(el,z.tap_action,z.hold_action,z.double_tap_action,z.hold_delay);
    }
    this._biconEls={};this._blabelEls={};
    for(const b of(c.badges||[])){
      this._biconEls[b.id]=this.shadowRoot.querySelector('[data-bi="'+b.id+'"]');
      this._blabelEls[b.id]=this.shadowRoot.querySelector('[data-bl="'+b.id+'"]');
      const bel=this.shadowRoot.querySelector('[data-b="'+b.id+'"]');
      if(bel&&b.tap_action){bel.addEventListener('click',e=>this._exec(b.tap_action,e));bel.addEventListener('touchend',e=>this._exec(b.tap_action,e));}
    }
    this._icoEls={};
    for(const ico of(c.icons||[])){
      const el=this.shadowRoot.querySelector('[data-ico="'+ico.id+'"]');
      if(!el)continue;this._icoEls[ico.id]=el;
      if(ico.tap_action)this._addZoneListeners(el,ico.tap_action,ico.hold_action,ico.double_tap_action,ico.hold_delay);
    }
    this._cardEls={};this._contEls={};
    for(const el of(c.elements||[])){
      const cont=document.createElement('div');
      cont.className='elcont';cont.setAttribute('data-el',el.id);
      cont.style.cssText='top:'+el.top+';left:'+el.left+';width:'+el.width+';height:'+el.height+';z-index:'+(el.z_index??4)+';overflow:'+(el.overflow??'hidden')+';border-radius:'+(el.border_radius??'0')+';'+(tm?'outline:2px dashed blue;':'');
      if(tm)cont.title='[element] '+el.id;
      const card=makeHACard(el.card);
      if(card){if(this._hass)card.hass=this._hass;cont.appendChild(card);this._cardEls[el.id]=card;}
      this._contEls[el.id]=cont;if(content)content.appendChild(cont);
    }
    const hacard=this.shadowRoot.querySelector('ha-card');
    if(hacard&&c.tap_action){
      hacard.addEventListener('click',e=>{
        if(!e.composedPath().some(n=>n.classList?.contains('zone')||n.classList?.contains('elcont')||n.classList?.contains('ico')))this._exec(c.tap_action,e);
      });
    }
    // IntersectionObserver — zastav updates když karta není ve viewportu
    if(this._io)this._io.disconnect();
    if(typeof IntersectionObserver!=='undefined'){
      const self=this;
      this._io=new IntersectionObserver(function(entries){
        self._visible=entries[0].isIntersecting;
        if(self._visible&&self._hass&&self._rendered)self._update();
      },{threshold:0});
      this._io.observe(this);
    }
    this._relevantEntities=[...this._extractEntities(this._config)];
    this._prevStates={};
    this._rendered=true;
    this._preloadImages();
    this._update();
  }

  _update(){
    if(!this._hass||!this._config||!this._rendered)return;
    const s=this._hass.states,c=this._config;
    if(this._baseEl){
      this._baseEl.style.filter=c.filter_conditions?.length?resolveFilter(c.filter_conditions,s):'none';
    }
    for(const ov of(c.overlays||[])){
      const el=this._ovEls[ov.id];if(!el)continue;
      const img=this._ovImg(ov);
      if(img){const bg='url(\''+img+'\')';if(el.style.backgroundImage!==bg)el.style.backgroundImage=bg;}
      el.style.opacity=ov.conditions?.opacity?String(resolveVal(ov.conditions.opacity,s,0)):'1';
      el.style.filter=ov.conditions?.filter?resolveVal(ov.conditions.filter,s,'none'):'none';
    }
    for(const z of(c.zones||[])){
      const el=this._zoneEls[z.id];
      if(el&&z.visible)el.style.display=evalCond(z.visible,s)?'block':'none';
    }
    for(const b of(c.badges||[])){
      const bel=this.shadowRoot.querySelector('[data-b="'+b.id+'"]');
      if(bel&&b.visible)bel.style.display=evalCond(b.visible,s)?'flex':'none';
      const iel=this._biconEls[b.id];
      if(iel&&b.icon_color)iel.style.color=resolveVal(b.icon_color,s,'white');
      const lel=this._blabelEls[b.id];
      if(lel&&b.label){const t=resolveVal(b.label,s,'');if(lel.textContent!==t)lel.textContent=t;}
    }
    for(const ico of(c.icons||[])){
      const el=this._icoEls[ico.id];if(!el)continue;
      if(ico.visible)el.style.display=evalCond(ico.visible,s)?'flex':'none';
      if(ico.color){
        const haicon=el.querySelector('ha-icon');
        if(haicon)haicon.style.color=resolveVal(ico.color,s,'white');
      }
    }
    for(const el of(c.elements||[])){
      const card=this._cardEls[el.id],cont=this._contEls[el.id];
      let vis=true;
      if(cont&&el.visible){vis=evalCond(el.visible,s);cont.style.display=vis?'block':'none';}
      if(card&&vis)try{card.hass=this._hass;}catch(_){}
    }
    if(this._relevantEntities){
      for(const id of this._relevantEntities)this._prevStates[id]=s[id]?.state;
    }
  }

  _ovImg(ov){
    if(ov.image)return ov.image;
    if(ov.state_images?.length){
      for(const m of ov.state_images){if(!('entity'in m))continue;if(this._hass.states[m.entity]?.state===m.state)return m.image;}
      const d=ov.state_images.find(m=>!('entity'in m));if(d)return d.image;
    }
    return'';
  }

  _resolveAct(a){
    if('condition'in a){const ok=evalCond(a.condition,this._hass.states);return ok?a.then:(a.else??{action:'none'});}
    return a;
  }

  _exec(tapAction,event){
    if(!tapAction)return;
    event.stopPropagation();event.preventDefault();
    const a=this._resolveAct(tapAction);
    switch(a.action){
      case'navigate':{const p=a.navigation_path||a.path;if(p){history.pushState(null,'',p);window.dispatchEvent(new PopStateEvent('popstate'));}}break;
      case'more-info':if(a.entity)this.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:a.entity}}));break;
      case'call-service':if(a.service){const d=a.service.indexOf('.');this._hass.callService(a.service.slice(0,d),a.service.slice(d+1),a.service_data??{});}break;
      case'browser-mod-popup':this._hass.callService('browser_mod','popup',{title:a.title??'',size:a.size??'normal',content:a.content??{}});break;
      case'toggle':if(a.entity)this._hass.callService('homeassistant','toggle',{entity_id:a.entity});break;
    }
  }
}

customElements.define('room-overlay-card',RoomOverlayCard);



const _yaml={
  s:function(o){try{return window.YAML?window.YAML.stringify(o):JSON.stringify(o,null,2);}catch(_){return '';}},
  p:function(s){try{return window.YAML?window.YAML.parse(s):JSON.parse(s);}catch(_){return null;}}
};

const FILTER_PROPS=[
  {key:'brightness', label:'Brightness', min:0,max:4,  step:0.05,dflt:1,unit:''},
  {key:'sepia',      label:'Sepia',      min:0,max:1,  step:0.05,dflt:0,unit:''},
  {key:'saturate',   label:'Saturate',   min:0,max:3,  step:0.05,dflt:1,unit:''},
  {key:'hue-rotate', label:'Hue rotate', min:0,max:360,step:1,   dflt:0,unit:'deg'},
  {key:'contrast',   label:'Contrast',   min:0,max:3,  step:0.05,dflt:1,unit:''},
  {key:'blur',       label:'Blur',       min:0,max:20, step:0.5, dflt:0,unit:'px'},
];

function parseFilterStr(str){
  const r={};
  FILTER_PROPS.forEach(function(p){r[p.key]=p.dflt;});
  if(!str||str==='none')return r;
  FILTER_PROPS.forEach(function(p){
    const esc=p.key.replace('-','\\-');
    const m=str.match(new RegExp(esc+'\\(([\\d.]+)'+p.unit+'\\)'));
    if(m)r[p.key]=parseFloat(m[1]);
  });
  return r;
}

function buildFilterStr(obj){
  const parts=FILTER_PROPS
    .filter(function(p){return obj[p.key]!==undefined&&Math.abs(obj[p.key]-p.dflt)>0.001;})
    .map(function(p){return p.key+'('+obj[p.key]+p.unit+')';});
  return parts.length?parts.join(' '):'none';
}

class RoomOverlayCardEditor extends HTMLElement{
  constructor(){super();this._config=null;this._hass=null;}

  setConfig(cfg){
    const prev=this._config;
    this._config=cfg;
    if(prev&&this.innerHTML.trim()){
      const same=
        (prev.overlays||[]).length===(cfg.overlays||[]).length&&
        (prev.zones||[]).length===(cfg.zones||[]).length&&
        (prev.badges||[]).length===(cfg.badges||[]).length&&
        (prev.elements||[]).length===(cfg.elements||[]).length&&
        (prev.icons||[]).length===(cfg.icons||[]).length&&
        (prev.filter_conditions||[]).length===(cfg.filter_conditions||[]).length;
      if(same)return;
    }
    this._render();
  }

  set hass(h){
    this._hass=h;
    this.querySelectorAll('ha-entity-picker').forEach(function(ep){ep.hass=h;});
  }

  _e(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  _fire(c){
    this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:Object.assign({type:'custom:room-overlay-card'},c)}}));
  }

  _collectConfig(){
    const c=Object.assign({},this._config);
    const q=function(s){return this.querySelector(s);}.bind(this);
    const v=function(id,fb){const el=q('#'+id);return el?el.value:fb;};
    c.base_image=v('base_image',c.base_image||'');
    c.aspect_ratio=v('aspect_ratio','16/9');
    c.border_radius=v('border_radius','12px');
    c.filter_transition=v('filter_transition','2s ease');
    const tm=q('#test_mode');c.test_mode=tm?tm.checked:false;
    const ta=q('#tap_action_yaml');
    if(ta&&ta.value.trim()){const p=_yaml.p(ta.value);if(p)c.tap_action=p;else delete c.tap_action;}
    else delete c.tap_action;

    c.filter_conditions=[];
    const self=this;
    this.querySelectorAll('.filter-block').forEach(function(block,i){
      const entry={};
      const entEl=block.querySelector('[data-filter-entity="'+i+'"]');
      const entity=entEl?entEl.value.trim():'';
      const buildSubCond=function(prefix){
        const eEl=block.querySelector('[data-filter-'+prefix+'-entity="'+i+'"]');
        const ent=eEl?eEl.value.trim():'';
        if(!ent)return null;
        const oEl=block.querySelector('[data-filter-'+prefix+'-op="'+i+'"]');
        const vEl=block.querySelector('[data-filter-'+prefix+'-val="'+i+'"]');
        const o=oEl?oEl.value:'state';
        const v=vEl?vEl.value:'';
        const sc={entity:ent};
        if(o==='state')sc.state=v;
        else if(o==='state_not')sc.state_not=v;
        else{sc.operator=o;sc.value=parseFloat(v)||v;}
        return sc;
      };
      if(entity){
        const opEl=block.querySelector('[data-filter-state-op="'+i+'"]');
        const valEl=block.querySelector('[data-filter-state-val="'+i+'"]');
        const op=opEl?opEl.value:'state';
        const val=valEl?valEl.value:'';
        const cond={entity:entity};
        if(op==='state')cond.state=val;
        else if(op==='state_not')cond.state_not=val;
        else{cond.operator=op;cond.value=parseFloat(val)||val;}
        const andCond=buildSubCond('and');if(andCond)cond.and=andCond;
        const orCond=buildSubCond('or');if(orCond)cond.or=orCond;
        entry.condition=cond;
      }
      const filters={};
      FILTER_PROPS.forEach(function(p){
        const el=block.querySelector('[data-fp="'+i+'-'+p.key+'"][data-fp-num]');
        if(el)filters[p.key]=parseFloat(el.value);
      });
      entry.filter=buildFilterStr(filters);
      c.filter_conditions.push(entry);
    });

    c.overlays=(c.overlays||[]).map(function(ov,i){
      const o=Object.assign({},ov);
      const idEl=q('[data-ov-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const imgEl=q('[data-ov-img="'+i+'"]');if(imgEl){if(imgEl.value)o.image=imgEl.value;else delete o.image;}
      const trEl=q('[data-ov-tr="'+i+'"]');if(trEl)o.transition=trEl.value;
      const yaEl=q('[data-ov-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p)o.conditions=p;}
      return o;
    });

    c.zones=(c.zones||[]).map(function(z,i){
      const o=Object.assign({},z);
      const idEl=q('[data-z-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-z-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-z-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-z-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-z-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const tapEl=q('[data-z-tap="'+i+'"]');
      if(tapEl&&tapEl.value.trim()){const p=_yaml.p(tapEl.value);if(p)o.tap_action=p;else delete o.tap_action;}
      else delete o.tap_action;
      const holdEl=q('[data-z-hold="'+i+'"]');
      if(holdEl&&holdEl.value.trim()){const p=_yaml.p(holdEl.value);if(p)o.hold_action=p;else delete o.hold_action;}
      else delete o.hold_action;
      const dtapEl=q('[data-z-dtap="'+i+'"]');
      if(dtapEl&&dtapEl.value.trim()){const p=_yaml.p(dtapEl.value);if(p)o.double_tap_action=p;else delete o.double_tap_action;}
      else delete o.double_tap_action;
      const hdelEl=q('[data-z-hdelay="'+i+'"]');
      if(hdelEl&&hdelEl.value&&parseInt(hdelEl.value)!==500)o.hold_delay=parseInt(hdelEl.value);else delete o.hold_delay;
      const visEl=q('[data-z-vis="'+i+'"]');
      if(visEl&&visEl.value.trim()){const p=_yaml.p(visEl.value);if(p)o.visible=p;else delete o.visible;}
      else delete o.visible;
      return o;
    });

    c.badges=(c.badges||[]).map(function(b,i){
      const o=Object.assign({},b);
      const idEl=q('[data-b-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const posEl=q('[data-b-pos="'+i+'"]');if(posEl)o.position=posEl.value;
      const iconEl=q('[data-b-icon="'+i+'"]');if(iconEl){if(iconEl.value)o.icon=iconEl.value;else delete o.icon;}
      const bxEl=q('[data-b-x="'+i+'"]');if(bxEl){if(bxEl.value.trim())o.x=bxEl.value.trim();else delete o.x;}
      const byEl=q('[data-b-y="'+i+'"]');if(byEl){if(byEl.value.trim())o.y=byEl.value.trim();else delete o.y;}
      const yaEl=q('[data-b-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p)Object.assign(o,p);}
      return o;
    });

    c.elements=(c.elements||[]).map(function(el,i){
      const o=Object.assign({},el);
      const idEl=q('[data-el-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-el-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-el-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-el-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-el-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const yaEl=q('[data-el-yaml="'+i+'"]');
      if(yaEl&&yaEl.value.trim()){const p=_yaml.p(yaEl.value);if(p){if(p.card)o.card=p.card;if(p.visible!==undefined)o.visible=p.visible;if(p.z_index!==undefined)o.z_index=p.z_index;if(p.border_radius)o.border_radius=p.border_radius;if(p.overflow)o.overflow=p.overflow;}}
      return o;
    });

    c.icons=(c.icons||[]).map(function(ico,i){
      const o=Object.assign({},ico);
      const idEl=q('[data-ico-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const iconEl=q('[data-ico-icon="'+i+'"]');if(iconEl)o.icon=iconEl.value;
      const sizeEl=q('[data-ico-size="'+i+'"]');if(sizeEl)o.size=sizeEl.value||'20px';
      const zEl=q('[data-ico-z="'+i+'"]');if(zEl&&zEl.value)o.z_index=parseInt(zEl.value);
      const topEl=q('[data-ico-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-ico-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const hdelEl=q('[data-ico-hdelay="'+i+'"]');
      if(hdelEl&&hdelEl.value&&parseInt(hdelEl.value)!==500)o.hold_delay=parseInt(hdelEl.value);else delete o.hold_delay;
      const colorEl=q('[data-ico-color="'+i+'"]');
      if(colorEl&&colorEl.value.trim()){const p=_yaml.p(colorEl.value);if(p)o.color=p;else delete o.color;}else delete o.color;
      const visEl=q('[data-ico-vis="'+i+'"]');
      if(visEl&&visEl.value.trim()){const p=_yaml.p(visEl.value);if(p)o.visible=p;else delete o.visible;}else delete o.visible;
      const tapEl=q('[data-ico-tap="'+i+'"]');
      if(tapEl&&tapEl.value.trim()){const p=_yaml.p(tapEl.value);if(p)o.tap_action=p;else delete o.tap_action;}else delete o.tap_action;
      const dtapEl=q('[data-ico-dtap="'+i+'"]');
      if(dtapEl&&dtapEl.value.trim()){const p=_yaml.p(dtapEl.value);if(p)o.double_tap_action=p;else delete o.double_tap_action;}else delete o.double_tap_action;
      const holdEl=q('[data-ico-hold="'+i+'"]');
      if(holdEl&&holdEl.value.trim()){const p=_yaml.p(holdEl.value);if(p)o.hold_action=p;else delete o.hold_action;}else delete o.hold_action;
      return o;
    });
    return c;
  }

  _inp(s){return ' style="width:100%;padding:6px;border-radius:4px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box;'+s+'"';}

  _condFields(prefix,i,c){
    // renders entity + op + val fields for a sub-condition (and/or)
    const entity=c&&c.entity?c.entity:'';
    const op=c?(c.state!==undefined?'state':c.state_not!==undefined?'state_not':c.operator||'state'):'state';
    const val=c?(c.state!==undefined?String(c.state):c.state_not!==undefined?String(c.state_not):c.value!==undefined?String(c.value):''):'';
    let h='<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:end;margin-bottom:6px;">';
    h+='<div><input type="text" data-filter-'+prefix+'-entity="'+i+'" placeholder="entity_id (optional)" value="'+this._e(entity)+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><select data-filter-'+prefix+'-op="'+i+'"'+this._inp('font-size:12px;width:auto;')+'>';
    ['state','state_not','<','>','<=','>=','==','!='].forEach(function(o){h+='<option value="'+o+'"'+(op===o?' selected':'')+'>'+o+'</option>';});
    h+='</select></div>';
    h+='<div><input type="text" data-filter-'+prefix+'-val="'+i+'" placeholder="value" value="'+this._e(val)+'"'+this._inp('font-size:12px;width:90px;')+'></div>';
    h+='</div>';
    return h;
  }

  _filterBlock(fc,i){
    const cond=fc.condition||null;
    const entity=cond&&cond.entity?cond.entity:'';
    const op=cond?(cond.state!==undefined?'state':cond.state_not!==undefined?'state_not':cond.operator||'state'):'state';
    const val=cond?(cond.state!==undefined?String(cond.state):cond.state_not!==undefined?String(cond.state_not):cond.value!==undefined?String(cond.value):''):'';
    const fv=parseFilterStr(fc.filter||'');
    const isDefault=!cond;
    let h='<div class="filter-block" style="border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;padding:12px;margin-bottom:8px;">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">';
    h+='<span style="font-weight:500;font-size:13px;">Filter #'+(i+1)+(isDefault?' (default)':'')+'</span>';
    h+='<button data-rm-filter="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0 4px;" title="Remove">&#x2715;</button>';
    h+='</div>';
    h+='<div style="margin-bottom:6px;"><label style="font-size:12px;color:var(--secondary-text-color);display:block;margin-bottom:4px;">Condition entity (leave empty for default)</label>';
    h+='<input type="text" data-filter-entity="'+i+'" placeholder="e.g. light.bedroom" value="'+this._e(entity)+'"'+this._inp('')+'></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;color:var(--secondary-text-color);display:block;margin-bottom:4px;">Operator</label>';
    h+='<select data-filter-state-op="'+i+'"'+this._inp('')+'>';
    ['state','state_not','<','>','<=','>=','==','!='].forEach(function(o){h+='<option value="'+o+'"'+(op===o?' selected':'')+'>'+o+'</option>';});
    h+='</select></div>';
    h+='<div><label style="font-size:12px;color:var(--secondary-text-color);display:block;margin-bottom:4px;">Value</label>';
    h+='<input data-filter-state-val="'+i+'" type="text" value="'+this._e(val)+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
    h+='<label style="font-size:11px;color:var(--secondary-text-color);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">AND condition (optional — must also be true)</label>';
    h+=this._condFields('and',i,cond?cond.and:null);
    h+='</div>';
    h+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
    h+='<label style="font-size:11px;color:var(--secondary-text-color);font-weight:500;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:4px;">OR condition (optional — fallback if main fails)</label>';
    h+=this._condFields('or',i,cond?cond.or:null);
    h+='</div>';
    h+='<div><label style="font-size:12px;color:var(--secondary-text-color);font-weight:500;display:block;margin-bottom:6px;">Filter values</label>';
    const self=this;
    FILTER_PROPS.forEach(function(p){
      const vv=fv[p.key];
      h+='<div style="display:grid;grid-template-columns:90px 1fr 64px;gap:6px;align-items:center;margin-bottom:4px;">';
      h+='<label style="font-size:12px;">'+p.label+'</label>';
      h+='<input type="range" data-fp="'+i+'-'+p.key+'" data-fp-range min="'+p.min+'" max="'+p.max+'" step="'+p.step+'" value="'+vv+'" style="width:100%;cursor:pointer;">';
      h+='<input type="number" data-fp="'+i+'-'+p.key+'" data-fp-num min="'+p.min+'" max="'+p.max+'" step="'+p.step+'" value="'+vv+'"'+self._inp('font-size:12px;')+'>';
      h+='</div>';
    });
    h+='</div></div>';
    return h;
  }

  _ovItem(ov,i){
    const condYaml=ov.conditions?_yaml.s(ov.conditions):'';
    const ovOpen=this._openPanels&&this._openPanels.has('ov-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="ov-'+i+'"'+(ovOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Overlay: '+this._e(ov.id||'ov_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-ov-id="'+i+'" type="text" value="'+this._e(ov.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Image URL</label><input data-ov-img="'+i+'" type="text" value="'+this._e(ov.image||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Transition</label><input data-ov-tr="'+i+'" type="text" value="'+this._e(ov.transition||'2s ease')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Conditions YAML (opacity / filter / state_images)</label>';
    h+='<textarea data-ov-yaml="'+i+'" rows="5"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(condYaml)+'</textarea></div>';
    h+='<button data-rm-ov="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove overlay</button>';
    h+='</div></details>';
    return h;
  }

  _zoneItem(z,i){
    const tapYaml=z.tap_action?_yaml.s(z.tap_action):'';
    const holdYaml=z.hold_action?_yaml.s(z.hold_action):'';
    const dtapYaml=z.double_tap_action?_yaml.s(z.double_tap_action):'';
    const visYaml=z.visible?_yaml.s(z.visible):'';
    const zOpen=this._openPanels&&this._openPanels.has('z-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="z-'+i+'"'+(zOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Zone: '+this._e(z.id||'zone_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-z-id="'+i+'" type="text" value="'+this._e(z.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-z-top="'+i+'" type="text" value="'+this._e(z.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-z-left="'+i+'" type="text" value="'+this._e(z.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Width</label><input data-z-w="'+i+'" type="text" value="'+this._e(z.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Height</label><input data-z-h="'+i+'" type="text" value="'+this._e(z.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_delay (ms)</label><input data-z-hdelay="'+i+'" type="number" value="'+this._e(String(z.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">tap_action (YAML)</label><textarea data-z-tap="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">double_tap_action (YAML)</label><textarea data-z-dtap="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(dtapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_action (YAML)</label><textarea data-z-hold="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(holdYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">visible (YAML)</label><textarea data-z-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+='<button data-rm-z="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove zone</button>';
    h+='</div></details>';
    return h;
  }

  _badgeItem(b,i){
    const bCopy=Object.assign({},b);delete bCopy.id;delete bCopy.icon;delete bCopy.position;
    const bYaml=Object.keys(bCopy).length?_yaml.s(bCopy):'';
    const bOpen=this._openPanels&&this._openPanels.has('b-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="b-'+i+'"'+(bOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Badge: '+this._e(b.id||'badge_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-b-id="'+i+'" type="text" value="'+this._e(b.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Icon (mdi:...)</label><input data-b-icon="'+i+'" type="text" value="'+this._e(b.icon||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Position</label>';
    h+='<select data-b-pos="'+i+'"'+this._inp('')+'>';
    const bp=b.position||'bottom-left';
    ['bottom-left','bottom-right','top-left','top-right','custom'].forEach(function(p){h+='<option value="'+p+'"'+(bp===p?' selected':'')+'>'+p+'</option>';});
    h+='</select></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">X (custom pos)</label><input data-b-x="'+i+'" type="text" placeholder="e.g. 30%" value="'+this._e(b.x||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Y (custom pos)</label><input data-b-y="'+i+'" type="text" placeholder="e.g. 15%" value="'+this._e(b.y||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">label / visible / icon_color / tap_action (YAML)</label>';
    h+='<textarea data-b-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(bYaml)+'</textarea></div>';
    h+='<button data-rm-b="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove badge</button>';
    h+='</div></details>';
    return h;
  }

  _elItem(el,i){
    const elCopy={};
    if(el.card)elCopy.card=el.card;
    if(el.visible!==undefined)elCopy.visible=el.visible;
    if(el.z_index!==undefined)elCopy.z_index=el.z_index;
    if(el.border_radius)elCopy.border_radius=el.border_radius;
    if(el.overflow)elCopy.overflow=el.overflow;
    const elYaml=Object.keys(elCopy).length?_yaml.s(elCopy):'';
    const elOpen=this._openPanels&&this._openPanels.has('el-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="el-'+i+'"'+(elOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Element: '+this._e(el.id||'el_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-el-id="'+i+'" type="text" value="'+this._e(el.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-el-top="'+i+'" type="text" value="'+this._e(el.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-el-left="'+i+'" type="text" value="'+this._e(el.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Width</label><input data-el-w="'+i+'" type="text" value="'+this._e(el.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Height</label><input data-el-h="'+i+'" type="text" value="'+this._e(el.height||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">card / visible / z_index / border_radius (YAML)</label>';
    h+='<textarea data-el-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(elYaml)+'</textarea></div>';
    h+='<button data-rm-el="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove element</button>';
    h+='</div></details>';
    return h;
  }

  _icoItem(ico,i){
    const tapYaml=ico.tap_action?_yaml.s(ico.tap_action):'';
    const holdYaml=ico.hold_action?_yaml.s(ico.hold_action):'';
    const dtapYaml=ico.double_tap_action?_yaml.s(ico.double_tap_action):'';
    const colorYaml=ico.color?_yaml.s(ico.color):'';
    const visYaml=ico.visible?_yaml.s(ico.visible):'';
    const icoOpen=this._openPanels&&this._openPanels.has('ico-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="ico-'+i+'"'+(icoOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Icon: '+this._e(ico.id||'ico_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">ID</label><input data-ico-id="'+i+'" type="text" value="'+this._e(ico.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Icon (mdi:...)</label><input data-ico-icon="'+i+'" type="text" value="'+this._e(ico.icon||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Size</label><input data-ico-size="'+i+'" type="text" placeholder="20px" value="'+this._e(ico.size||'20px')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">z-index</label><input data-ico-z="'+i+'" type="number" value="'+this._e(String(ico.z_index||6))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Top</label><input data-ico-top="'+i+'" type="text" value="'+this._e(ico.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Left</label><input data-ico-left="'+i+'" type="text" value="'+this._e(ico.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_delay (ms)</label><input data-ico-hdelay="'+i+'" type="number" value="'+this._e(String(ico.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">color (YAML condition list)</label><textarea data-ico-color="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(colorYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">visible (YAML condition)</label><textarea data-ico-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">tap_action (YAML)</label><textarea data-ico-tap="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">double_tap_action (YAML)</label><textarea data-ico-dtap="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(dtapYaml)+'</textarea></div>';
    h+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">hold_action (YAML)</label><textarea data-ico-hold="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(holdYaml)+'</textarea></div>';
    h+='</div>';
    h+='<button data-rm-ico="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove icon</button>';
    h+='</div></details>';
    return h;
  }

  _render(){
    if(!this._config)return;
    const c=this._config;
    const open=new Set();
    this.querySelectorAll('details[data-panel]').forEach(function(d){if(d.open)open.add(d.dataset.panel);});
    this._openPanels=open;
    const firstRender=open.size===0;

    const tapYaml=c.tap_action?_yaml.s(c.tap_action):'';
    const sec=function(id,label,count,inner){
      const isOpen=open.has(id)||(firstRender&&id==='basic');
      return '<details data-panel="'+id+'"'+(isOpen?' open':'')+' style="margin-bottom:8px;">'
        +'<summary style="cursor:pointer;padding:10px 12px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;justify-content:space-between;">'
        +'<span>'+label+(count!==undefined?' ('+count+')':'')+'</span>'
        +'<ha-icon icon="mdi:chevron-down" style="--mdc-icon-size:18px;"></ha-icon>'
        +'</summary>'
        +'<div style="padding:12px;border:1px solid var(--divider-color);border-top:none;border-radius:0 0 6px 6px;margin-top:-1px;">'+inner+'</div>'
        +'</details>';
    };

    const btnStyle='padding:6px 14px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:13px;';

    let basicInner='<div style="display:grid;gap:8px;">';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Base image URL *</label><input id="base_image" type="text" value="'+this._e(c.base_image||'')+'"'+this._inp('')+'></div>';
    basicInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Aspect ratio</label><input id="aspect_ratio" type="text" value="'+this._e(c.aspect_ratio||'16/9')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Border radius</label><input id="border_radius" type="text" value="'+this._e(c.border_radius||'12px')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">Filter transition</label><input id="filter_transition" type="text" value="'+this._e(c.filter_transition||'2s ease')+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    basicInner+='<div style="display:flex;align-items:center;gap:8px;"><input id="test_mode" type="checkbox"'+(c.test_mode?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:13px;cursor:pointer;" for="test_mode">Test mode (show zone &amp; element outlines)</label></div>';
    basicInner+='<div><label style="font-size:12px;display:block;margin-bottom:4px;">tap_action (YAML)</label><textarea id="tap_action_yaml" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tapYaml)+'</textarea></div>';
    basicInner+='</div>';

    let filterInner='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;">Conditions are evaluated in order — first match wins. A block without an entity is the default (fallback).</p>';
    filterInner+='<div id="filter-blocks">';
    const self=this;
    (c.filter_conditions||[]).forEach(function(fc,i){filterInner+=self._filterBlock(fc,i);});
    filterInner+='</div>';
    filterInner+='<button id="add-filter" style="'+btnStyle+'">+ Add filter condition</button>';

    let ovInner='<div id="ov-list">';
    (c.overlays||[]).forEach(function(ov,i){ovInner+=self._ovItem(ov,i);});
    ovInner+='</div><button id="add-ov" style="'+btnStyle+'margin-top:4px;">+ Add overlay</button>';

    let zInner='<div id="z-list">';
    (c.zones||[]).forEach(function(z,i){zInner+=self._zoneItem(z,i);});
    zInner+='</div><button id="add-z" style="'+btnStyle+'margin-top:4px;">+ Add zone</button>';

    let bInner='<div id="b-list">';
    (c.badges||[]).forEach(function(b,i){bInner+=self._badgeItem(b,i);});
    bInner+='</div><button id="add-b" style="'+btnStyle+'margin-top:4px;">+ Add badge</button>';

    let elInner='<div id="el-list">';
    (c.elements||[]).forEach(function(el,i){elInner+=self._elItem(el,i);});
    elInner+='</div><button id="add-el" style="'+btnStyle+'margin-top:4px;">+ Add element</button>';

    let icoInner='<div id="ico-list">';
    (c.icons||[]).forEach(function(ico,i){icoInner+=self._icoItem(ico,i);});
    icoInner+='</div><button id="add-ico" style="'+btnStyle+'margin-top:4px;">+ Add icon</button>';

    this.innerHTML='<div style="padding:8px;">'
      +sec('basic','Basic settings',undefined,basicInner)
      +sec('filters','Base image filters',(c.filter_conditions||[]).length,filterInner)
      +sec('overlays','Overlay layers',(c.overlays||[]).length,ovInner)
      +sec('zones','Clickable zones',(c.zones||[]).length,zInner)
      +sec('badges','Status badges',(c.badges||[]).length,bInner)
      +sec('elements','Embedded HA cards',(c.elements||[]).length,elInner)
      +sec('icons','Icon overlays',(c.icons||[]).length,icoInner)
      +'</div>';

    this._listen();
    this._bindHassComponents();
  }

  _bindHassComponents(){
    const self=this;
    this.querySelectorAll('.ep-placeholder').forEach(function(span){
      const val=span.dataset.epVal||'';
      const picker=document.createElement('ha-entity-picker');
      picker.style.cssText='width:100%;display:block;';
      if(self._hass)picker.hass=self._hass;
      picker.value=val;
      picker.allowCustomEntity=true;
      picker.addEventListener('value-changed',function(e){
        picker.value=e.detail.value||'';
        self._fire(self._collectConfig());
      });
      span.replaceWith(picker);
    });
    this.querySelectorAll('[data-fp-range]').forEach(function(range){
      const num=self.querySelector('[data-fp="'+range.dataset.fp+'"][data-fp-num]');
      if(!num)return;
      range.addEventListener('input',function(){num.value=range.value;self._fire(self._collectConfig());});
      num.addEventListener('change',function(){range.value=num.value;self._fire(self._collectConfig());});
    });
  }

  _listen(){
    const self=this;
    const fire=function(){self._fire(self._collectConfig());};

    ['base_image','aspect_ratio','border_radius','filter_transition'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
    });
    const tm=this.querySelector('#test_mode');if(tm)tm.addEventListener('change',fire);
    const ta=this.querySelector('#tap_action_yaml');if(ta)ta.addEventListener('change',fire);

    // Filter conditions
    const addF=this.querySelector('#add-filter');
    if(addF)addF.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.filter_conditions)c.filter_conditions=[];
      c.filter_conditions.push({filter:'none'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-filter]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmFilter);
        const c=self._collectConfig();
        if(c.filter_conditions)c.filter_conditions.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-filter-entity],[data-filter-state-op],[data-filter-state-val],[data-filter-and-entity],[data-filter-and-op],[data-filter-and-val],[data-filter-or-entity],[data-filter-or-op],[data-filter-or-val]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Overlays
    const addOv=this.querySelector('#add-ov');
    if(addOv)addOv.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.overlays)c.overlays=[];
      c.overlays.push({id:'overlay_'+(c.overlays.length+1),image:'',transition:'2s ease'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ov]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmOv);
        const c=self._collectConfig();
        if(c.overlays)c.overlays.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-ov-id],[data-ov-img],[data-ov-tr],[data-ov-yaml]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Zones
    const addZ=this.querySelector('#add-z');
    if(addZ)addZ.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.zones)c.zones=[];
      c.zones.push({id:'zone_'+(c.zones.length+1),top:'0%',left:'0%',width:'10%',height:'10%'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-z]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmZ);
        const c=self._collectConfig();
        if(c.zones)c.zones.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-z-id],[data-z-top],[data-z-left],[data-z-w],[data-z-h],[data-z-tap],[data-z-hold],[data-z-dtap],[data-z-hdelay],[data-z-vis]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Badges
    const addB=this.querySelector('#add-b');
    if(addB)addB.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.badges)c.badges=[];
      c.badges.push({id:'badge_'+(c.badges.length+1),position:'bottom-left'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-b]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmB);
        const c=self._collectConfig();
        if(c.badges)c.badges.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-b-id],[data-b-icon],[data-b-pos],[data-b-x],[data-b-y],[data-b-yaml]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Icons
    const addIco=this.querySelector('#add-ico');
    if(addIco)addIco.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.icons)c.icons=[];
      c.icons.push({id:'icon_'+(c.icons.length+1),icon:'mdi:help',top:'10%',left:'10%',size:'24px'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ico]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmIco);
        const c=self._collectConfig();
        if(c.icons)c.icons.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-ico-id],[data-ico-icon],[data-ico-size],[data-ico-z],[data-ico-top],[data-ico-left],[data-ico-hdelay],[data-ico-color],[data-ico-vis],[data-ico-tap],[data-ico-dtap],[data-ico-hold]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Elements
    const addEl=this.querySelector('#add-el');
    if(addEl)addEl.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!c.elements)c.elements=[];
      c.elements.push({id:'el_'+(c.elements.length+1),top:'0%',left:'0%',width:'30%',height:'20%',card:{type:'tile',entity:''}});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-el]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmEl);
        const c=self._collectConfig();
        if(c.elements)c.elements.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-el-id],[data-el-top],[data-el-left],[data-el-w],[data-el-h],[data-el-yaml]').forEach(function(el){
      el.addEventListener('change',fire);
    });
  }
}

customElements.define('room-overlay-card-editor',RoomOverlayCardEditor);
customElements.get('room-overlay-card').getConfigElement=function(){return document.createElement('room-overlay-card-editor');};