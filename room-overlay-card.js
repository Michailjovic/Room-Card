/**
 * room-overlay-card v0.2.0 — MIT License
 * https://github.com/yourusername/room-overlay-card
 */
window.customCards=window.customCards||[];
window.customCards.push({type:'room-overlay-card',name:'Room Overlay Card',description:'Vizualizace místnosti s vrstvami, přechody a zónami',preview:true});

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
  }

  static getStubConfig(){return{base_image:'/local/room.webp',aspect_ratio:'16/9',border_radius:'12px',filter_conditions:[],overlays:[],zones:[],badges:[],elements:[],test_mode:false};}

  setConfig(cfg){
    if(!cfg.base_image)throw new Error('[room-overlay-card] base_image je povinný');
    this._config=cfg;this._rendered=false;if(this._hass)this._render();
  }

  set hass(h){
    this._hass=h;if(!this._config)return;
    this._rendered?this._update():this._render();
  }

  getCardSize(){return 4;}

  _pad(r){
    const p=(r||'16/9').split('/');
    if(p.length===2){const w=parseFloat(p[0]),h=parseFloat(p[1]);if(w>0&&h>0)return((h/w)*100).toFixed(4)+'%';}
    return'56.25%';
  }

  _render(){
    if(!this._config)return;
    const c=this._config,tm=c.test_mode??false;
    const pad=this._pad(c.aspect_ratio),br=c.border_radius??'12px';

    const ovHtml=(c.overlays||[]).map((ov,i)=>`<div class="layer ov" data-ov="${ov.id}" style="z-index:${ov.z_index??i+1};opacity:0;transition:opacity ${ov.transition??'2s ease'},filter ${ov.transition??'2s ease'};will-change:opacity;"></div>`).join('');

    const zHtml=(c.zones||[]).map(z=>`<div class="zone" data-z="${z.id}" style="top:${z.top};left:${z.left};width:${z.width};height:${z.height};z-index:50;cursor:${z.tap_action?'pointer':'default'};box-sizing:border-box;-webkit-tap-highlight-color:transparent;${tm?'outline:3px solid red;background:rgba(255,0,0,0.08);':''}" title="${tm?`[${z.id}] ${z.top} ${z.left} ${z.width}×${z.height}`:''}">${tm?`<span class="zlabel">${z.id}</span>`:''}</div>`).join('');

    const bHtml=(c.badges||[]).map(b=>`<div class="badge" data-b="${b.id}" style="${BPOS[b.position||'bottom-left']};cursor:${b.tap_action?'pointer':'default'};-webkit-tap-highlight-color:transparent;">${b.icon?`<ha-icon data-bi="${b.id}" icon="${b.icon}" style="color:white;--mdc-icon-size:14px;width:14px;height:14px;display:flex;"></ha-icon>`:''} ${b.label!==undefined?`<span class="blabel" data-bl="${b.id}"></span>`:''}</div>`).join('');

    this.shadowRoot.innerHTML=`<style>
:host{display:block;}
ha-card{overflow:hidden;padding:0!important;background:transparent;border-radius:${br};}
.wrap{position:relative;width:100%;padding-bottom:${pad};overflow:hidden;}
.content{position:absolute;inset:0;overflow:hidden;}
.layer{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;}
.zone{position:absolute;}
.zlabel{position:absolute;top:2px;left:4px;font-size:10px;color:red;font-weight:bold;pointer-events:none;text-shadow:0 0 3px white;white-space:nowrap;}
.badge{position:absolute;z-index:100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px 10px;white-space:nowrap;user-select:none;}
.blabel{font-size:12px;color:white;font-weight:500;}
.elcont{position:absolute;pointer-events:auto;}
.elcont>*{width:100%!important;height:100%!important;display:block;}
</style>
<ha-card><div class="wrap"><div class="content">
<div class="layer base" style="background-image:url('${c.base_image}');transition:filter ${c.filter_transition??'2s ease'};will-change:filter;"></div>
${ovHtml}${zHtml}${bHtml}
</div></div></ha-card>`;

    const content=this.shadowRoot.querySelector('.content');
    this._baseEl=this.shadowRoot.querySelector('.base');
    this._ovEls={};
    for(const ov of(c.overlays||[])){this._ovEls[ov.id]=this.shadowRoot.querySelector(`[data-ov="${ov.id}"]`);}
    this._zoneEls={};
    for(const z of(c.zones||[])){
      const el=this.shadowRoot.querySelector(`[data-z="${z.id}"]`);
      if(!el)continue;this._zoneEls[z.id]=el;
      if(z.tap_action){el.addEventListener('click',e=>this._exec(z.tap_action,e));el.addEventListener('touchend',e=>this._exec(z.tap_action,e));}
    }
    this._biconEls={};this._blabelEls={};
    for(const b of(c.badges||[])){
      this._biconEls[b.id]=this.shadowRoot.querySelector(`[data-bi="${b.id}"]`);
      this._blabelEls[b.id]=this.shadowRoot.querySelector(`[data-bl="${b.id}"]`);
      const bel=this.shadowRoot.querySelector(`[data-b="${b.id}"]`);
      if(bel&&b.tap_action){bel.addEventListener('click',e=>this._exec(b.tap_action,e));bel.addEventListener('touchend',e=>this._exec(b.tap_action,e));}
    }
    this._cardEls={};this._contEls={};
    for(const el of(c.elements||[])){
      const cont=document.createElement('div');
      cont.className='elcont';cont.setAttribute('data-el',el.id);
      cont.style.cssText=`top:${el.top};left:${el.left};width:${el.width};height:${el.height};z-index:${el.z_index??4};overflow:${el.overflow??'hidden'};border-radius:${el.border_radius??'0'};${tm?'outline:2px dashed blue;':''}`;
      if(tm)cont.title=`[element] ${el.id}`;
      const card=makeHACard(el.card);
      if(card){if(this._hass)card.hass=this._hass;cont.appendChild(card);this._cardEls[el.id]=card;}
      this._contEls[el.id]=cont;if(content)content.appendChild(cont);
    }
    const hacard=this.shadowRoot.querySelector('ha-card');
    if(hacard&&c.tap_action){
      hacard.addEventListener('click',e=>{
        if(!e.composedPath().some(n=>n.classList?.contains('zone')||n.classList?.contains('elcont')))this._exec(c.tap_action,e);
      });
    }
    this._rendered=true;this._update();
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
      if(img){const bg=`url('${img}')`;if(el.style.backgroundImage!==bg)el.style.backgroundImage=bg;}
      el.style.opacity=ov.conditions?.opacity?String(resolveVal(ov.conditions.opacity,s,0)):'1';
      el.style.filter=ov.conditions?.filter?resolveVal(ov.conditions.filter,s,'none'):'none';
    }
    for(const z of(c.zones||[])){
      const el=this._zoneEls[z.id];
      if(el&&z.visible)el.style.display=evalCond(z.visible,s)?'block':'none';
    }
    for(const b of(c.badges||[])){
      const bel=this.shadowRoot.querySelector(`[data-b="${b.id}"]`);
      if(bel&&b.visible)bel.style.display=evalCond(b.visible,s)?'flex':'none';
      const iel=this._biconEls[b.id];
      if(iel&&b.icon_color)iel.style.color=resolveVal(b.icon_color,s,'white');
      const lel=this._blabelEls[b.id];
      if(lel&&b.label){const t=resolveVal(b.label,s,'');if(lel.textContent!==t)lel.textContent=t;}
    }
    for(const el of(c.elements||[])){
      const card=this._cardEls[el.id],cont=this._contEls[el.id];
      if(card)try{card.hass=this._hass;}catch(_){}
      if(cont&&el.visible)cont.style.display=evalCond(el.visible,s)?'block':'none';
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
      case'navigate':if(a.path){history.pushState(null,'',a.path);window.dispatchEvent(new PopStateEvent('popstate'));}break;
      case'more-info':if(a.entity)this.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:a.entity}}));break;
      case'call-service':if(a.service){const d=a.service.indexOf('.');this._hass.callService(a.service.slice(0,d),a.service.slice(d+1),a.service_data??{});}break;
      case'browser-mod-popup':this._hass.callService('browser_mod','popup',{title:a.title??'',size:a.size??'normal',content:a.content??{}});break;
      case'toggle':if(a.entity)this._hass.callService('homeassistant','toggle',{entity_id:a.entity});break;
    }
  }
}

customElements.define('room-overlay-card',RoomOverlayCard);

// ─── GUI Editor ───────────────────────────────────────────────────────────────

class RoomOverlayCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(h) { this._hass = h; }

  _e(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  _fire(config) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { type: 'custom:room-overlay-card', ...config } },
      bubbles: true, composed: true,
    }));
  }

  _collectConfig() {
    const c = {};

    // Skalární pole
    this.querySelectorAll('[data-key]').forEach(el => {
      const v = el.type === 'checkbox' ? el.checked : el.value;
      if (v !== '' && v !== false) c[el.dataset.key] = v;
    });

    // filter_conditions jako JSON
    const fcEl = this.querySelector('[data-filter-conds]');
    if (fcEl?.value?.trim()) {
      try { c.filter_conditions = JSON.parse(fcEl.value); } catch(_) {}
    } else {
      c.filter_conditions = this._config.filter_conditions ?? [];
    }

    // Overlays
    c.overlays = [];
    this.querySelectorAll('.ov-item').forEach(item => {
      const o = {};
      item.querySelectorAll('[data-field]').forEach(f => { if (f.value !== '') o[f.dataset.field] = f.value; });
      const condEl = item.querySelector('[data-cond]');
      if (condEl?.value?.trim()) { try { o.conditions = JSON.parse(condEl.value); } catch(_) {} }
      const siEl = item.querySelector('[data-si]');
      if (siEl?.value?.trim()) { try { o.state_images = JSON.parse(siEl.value); } catch(_) {} }
      if (o.id) c.overlays.push(o);
    });

    // Zóny
    c.zones = [];
    this.querySelectorAll('.zone-item').forEach(item => {
      const o = {};
      item.querySelectorAll('[data-field]').forEach(f => { if (f.value !== '') o[f.dataset.field] = f.value; });
      const actionEl = item.querySelector('[data-action]');
      if (actionEl?.value?.trim()) { try { o.tap_action = JSON.parse(actionEl.value); } catch(_) {} }
      const visEl = item.querySelector('[data-visible]');
      if (visEl?.value?.trim()) { try { o.visible = JSON.parse(visEl.value); } catch(_) {} }
      if (o.id) c.zones.push(o);
    });

    // Badges
    c.badges = [];
    this.querySelectorAll('.badge-item').forEach(item => {
      const o = {};
      item.querySelectorAll('[data-field]').forEach(f => { if (f.value !== '') o[f.dataset.field] = f.value; });
      const jFields = { label: '[data-label]', icon_color: '[data-icon-color]', tap_action: '[data-tap-action]' };
      Object.entries(jFields).forEach(([key, sel]) => {
        const el = item.querySelector(sel);
        if (el?.value?.trim()) { try { o[key] = JSON.parse(el.value); } catch(_) {} }
      });
      if (o.id) c.badges.push(o);
    });

    // Elements
    c.elements = [];
    this.querySelectorAll('.element-item').forEach(item => {
      const o = {};
      item.querySelectorAll('[data-field]').forEach(f => { if (f.value !== '') o[f.dataset.field] = f.value; });
      if (o.z_index) o.z_index = parseInt(o.z_index);
      const cardEl = item.querySelector('[data-card-cfg]');
      if (cardEl?.value?.trim()) { try { o.card = JSON.parse(cardEl.value); } catch(_) {} }
      const visEl = item.querySelector('[data-visible]');
      if (visEl?.value?.trim()) { try { o.visible = JSON.parse(visEl.value); } catch(_) {} }
      if (o.id) c.elements.push(o);
    });

    return c;
  }

  _ovItem(ov, i) {
    const e = this._e.bind(this);
    return `<div class="item ov-item">
      <div class="ihead"><b>Overlay: ${e(ov.id || i+1)}</b>
        <button type="button" class="rm-btn" data-rm-ov="${i}">✕ Odebrat</button></div>
      <div class="row2">
        <label>ID *<br><input data-field="id" value="${e(ov.id ?? '')}"></label>
        <label>Transition<br><input data-field="transition" value="${e(ov.transition ?? '2s ease')}"></label>
      </div>
      <label>Obrázek (image)<br><input data-field="image" value="${e(ov.image ?? '')}"></label>
      <label>State images – JSON pole <small>[{entity,state,image},{image}]</small><br>
        <textarea data-si>${ov.state_images ? JSON.stringify(ov.state_images, null, 2) : ''}</textarea></label>
      <label>Podmínky – JSON <small>{opacity:[{condition:{...},value:1},{value:0}],filter:[...]}</small><br>
        <textarea data-cond>${ov.conditions ? JSON.stringify(ov.conditions, null, 2) : ''}</textarea></label>
    </div>`;
  }

  _zoneItem(z, i) {
    const e = this._e.bind(this);
    return `<div class="item zone-item">
      <div class="ihead"><b>Zóna: ${e(z.id || i+1)}</b>
        <button type="button" class="rm-btn" data-rm-zone="${i}">✕ Odebrat</button></div>
      <div class="row2">
        <label>ID *<br><input data-field="id" value="${e(z.id ?? '')}"></label>
        <label>Label (test mód)<br><input data-field="label" value="${e(z.label ?? '')}"></label>
      </div>
      <div class="row4">
        <label>Top %<br><input data-field="top" value="${e(z.top ?? '0%')}"></label>
        <label>Left %<br><input data-field="left" value="${e(z.left ?? '0%')}"></label>
        <label>Šířka %<br><input data-field="width" value="${e(z.width ?? '10%')}"></label>
        <label>Výška %<br><input data-field="height" value="${e(z.height ?? '10%')}"></label>
      </div>
      <label>Akce – JSON <small>{"action":"navigate","path":"/..."}</small> nebo podmíněná <small>{"condition":{...},"then":{...},"else":{...}}</small><br>
        <textarea data-action>${z.tap_action ? JSON.stringify(z.tap_action, null, 2) : ''}</textarea></label>
      <label>Podmínka zobrazení – JSON <small>{"entity":"input_boolean.x","state":"on"}</small><br>
        <textarea data-visible>${z.visible ? JSON.stringify(z.visible, null, 2) : ''}</textarea></label>
    </div>`;
  }

  _badgeItem(b, i) {
    const e = this._e.bind(this);
    const pos = ['bottom-left','bottom-right','top-left','top-right'];
    const opts = pos.map(p => `<option value="${p}"${b.position===p?' selected':''}>${p}</option>`).join('');
    return `<div class="item badge-item">
      <div class="ihead"><b>Badge: ${e(b.id || i+1)}</b>
        <button type="button" class="rm-btn" data-rm-badge="${i}">✕ Odebrat</button></div>
      <div class="row3">
        <label>ID *<br><input data-field="id" value="${e(b.id ?? '')}"></label>
        <label>Pozice<br><select data-field="position">${opts}</select></label>
        <label>Ikona (mdi:...)<br><input data-field="icon" value="${e(b.icon ?? '')}"></label>
      </div>
      <label>Barva ikony – JSON pole <small>[{condition:{...},value:"#e74c3c"},{value:"#2ecc71"}]</small><br>
        <textarea data-icon-color>${b.icon_color ? JSON.stringify(b.icon_color, null, 2) : ''}</textarea></label>
      <label>Text (label) – JSON pole <small>[{condition:{...},value:"Uklízí"},{value:"Připraveni"}]</small><br>
        <textarea data-label>${b.label ? JSON.stringify(b.label, null, 2) : ''}</textarea></label>
      <label>Akce – JSON<br>
        <textarea data-tap-action>${b.tap_action ? JSON.stringify(b.tap_action, null, 2) : ''}</textarea></label>
    </div>`;
  }

  _elItem(el, i) {
    const e = this._e.bind(this);
    return `<div class="item element-item">
      <div class="ihead"><b>Element: ${e(el.id || i+1)}</b>
        <button type="button" class="rm-btn" data-rm-el="${i}">✕ Odebrat</button></div>
      <label>ID *<br><input data-field="id" value="${e(el.id ?? '')}"></label>
      <div class="row4">
        <label>Top %<br><input data-field="top" value="${e(el.top ?? '0%')}"></label>
        <label>Left %<br><input data-field="left" value="${e(el.left ?? '0%')}"></label>
        <label>Šířka %<br><input data-field="width" value="${e(el.width ?? '20%')}"></label>
        <label>Výška %<br><input data-field="height" value="${e(el.height ?? '20%')}"></label>
      </div>
      <div class="row3">
        <label>Z-index<br><input data-field="z_index" type="number" value="${e(el.z_index ?? 4)}"></label>
        <label>Overflow<br><input data-field="overflow" value="${e(el.overflow ?? 'hidden')}"></label>
        <label>Border-radius<br><input data-field="border_radius" value="${e(el.border_radius ?? '0')}"></label>
      </div>
      <label>Karta – JSON <small>{"type":"custom:atmospheric-weather-card","weather_entity":"..."}</small><br>
        <textarea data-card-cfg style="min-height:100px">${el.card ? JSON.stringify(el.card, null, 2) : ''}</textarea></label>
      <label>Podmínka zobrazení – JSON<br>
        <textarea data-visible>${el.visible ? JSON.stringify(el.visible, null, 2) : ''}</textarea></label>
    </div>`;
  }

  _render() {
    const c = this._config;
    const e = this._e.bind(this);
    const ov = c.overlays ?? [];
    const zones = c.zones ?? [];
    const badges = c.badges ?? [];
    const els = c.elements ?? [];

    this.innerHTML = `
<style>
room-overlay-card-editor*{box-sizing:border-box;}
room-overlay-card-editor{display:block;padding:16px;font-family:var(--paper-font-body1_-_font-family,inherit);}
room-overlay-card-editor details{border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;margin-bottom:8px;overflow:hidden;}
room-overlay-card-editor summary{padding:12px 16px;background:var(--secondary-background-color,#f5f5f5);cursor:pointer;font-weight:500;list-style:none;display:flex;justify-content:space-between;user-select:none;}
room-overlay-card-editor summary::-webkit-details-marker{display:none;}
room-overlay-card-editor .body{padding:16px;display:flex;flex-direction:column;gap:10px;}
room-overlay-card-editor label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--secondary-text-color,#666);}
room-overlay-card-editor label small{font-size:10px;opacity:.7;}
room-overlay-card-editor input,room-overlay-card-editor select,room-overlay-card-editor textarea{width:100%;padding:7px 9px;border:1px solid var(--divider-color,#ccc);border-radius:4px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#000);font-size:13px;}
room-overlay-card-editor textarea{font-family:monospace;font-size:12px;min-height:55px;resize:vertical;}
room-overlay-card-editor .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
room-overlay-card-editor .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
room-overlay-card-editor .row4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;}
room-overlay-card-editor .item{border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px;background:var(--secondary-background-color,#fafafa);}
room-overlay-card-editor .ihead{display:flex;justify-content:space-between;align-items:center;}
room-overlay-card-editor button{padding:6px 12px;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;}
room-overlay-card-editor .rm-btn{background:var(--error-color,#f44336);color:#fff;}
room-overlay-card-editor .add-btn{background:var(--primary-color,#03a9f4);color:#fff;margin-top:4px;align-self:flex-start;}
room-overlay-card-editor input[type=checkbox]{width:auto;margin-right:6px;}
room-overlay-card-editor .cb-row{display:flex;align-items:center;font-size:14px;color:var(--primary-text-color,#000);}
</style>

<details open>
  <summary>Základní nastavení ▸</summary>
  <div class="body">
    <label>Obrázek místnosti (base_image) *<br>
      <input data-key="base_image" value="${e(c.base_image ?? '')}"></label>
    <div class="row2">
      <label>Poměr stran (aspect_ratio)<br>
        <input data-key="aspect_ratio" value="${e(c.aspect_ratio ?? '16/9')}" placeholder="1720/783 nebo 16/9"></label>
      <label>Zaoblení rohů (border_radius)<br>
        <input data-key="border_radius" value="${e(c.border_radius ?? '12px')}"></label>
    </div>
    <label>Filter přechod (filter_transition)<br>
      <input data-key="filter_transition" value="${e(c.filter_transition ?? '2.0s ease')}"></label>
    <label>Filter podmínky – JSON pole
      <small>[{condition:{entity:"light.x",state:"on"},filter:"brightness(2.6) sepia(0.35)"},…,{filter:"brightness(0.6)"}]</small><br>
      <textarea data-filter-conds style="min-height:80px">${c.filter_conditions?.length ? JSON.stringify(c.filter_conditions, null, 2) : ''}</textarea></label>
    <label class="cb-row"><input type="checkbox" data-key="test_mode" ${c.test_mode ? 'checked' : ''}>
      Test mód (červené bordery zón, modré bordery elementů)</label>
  </div>
</details>

<details>
  <summary>Overlay vrstvy (${ov.length}) ▸</summary>
  <div class="body">
    ${ov.map((o, i) => this._ovItem(o, i)).join('')}
    <button type="button" class="add-btn" id="add-ov">+ Přidat overlay</button>
  </div>
</details>

<details>
  <summary>Klikatelné zóny (${zones.length}) ▸</summary>
  <div class="body">
    ${zones.map((z, i) => this._zoneItem(z, i)).join('')}
    <button type="button" class="add-btn" id="add-zone">+ Přidat zónu</button>
  </div>
</details>

<details>
  <summary>Status badges (${badges.length}) ▸</summary>
  <div class="body">
    ${badges.map((b, i) => this._badgeItem(b, i)).join('')}
    <button type="button" class="add-btn" id="add-badge">+ Přidat badge</button>
  </div>
</details>

<details>
  <summary>Embedded karty (${els.length}) ▸</summary>
  <div class="body">
    ${els.map((el, i) => this._elItem(el, i)).join('')}
    <button type="button" class="add-btn" id="add-el">+ Přidat embedded kartu</button>
  </div>
</details>`;

    this._listen();
  }

  _listen() {
    const onChange = () => this._fire(this._collectConfig());
    this.querySelectorAll('input, select, textarea').forEach(el => el.addEventListener('change', onChange));

    const addRemove = (addId, listKey, defaultItem) => {
      this.querySelector(addId)?.addEventListener('click', () => {
        const c = this._collectConfig();
        c[listKey] = [...(c[listKey] ?? []), defaultItem];
        this._config = c; this._fire(c); this._render();
      });
    };

    addRemove('#add-ov', 'overlays', { id: `overlay_${Date.now()}`, image: '', transition: '2s ease' });
    addRemove('#add-zone', 'zones', { id: `zona_${Date.now()}`, top: '0%', left: '0%', width: '20%', height: '20%' });
    addRemove('#add-badge', 'badges', { id: `badge_${Date.now()}`, position: 'bottom-left', icon: 'mdi:information' });
    addRemove('#add-el', 'elements', { id: `element_${Date.now()}`, top: '10%', left: '10%', width: '30%', height: '30%', z_index: 4, card: { type: 'tile', entity: '' } });

    const rmMap = { 'rm-ov': 'overlays', 'rm-zone': 'zones', 'rm-badge': 'badges', 'rm-el': 'elements' };
    Object.entries(rmMap).forEach(([attr, key]) => {
      this.querySelectorAll(`[data-${attr}]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const c = this._collectConfig();
          c[key].splice(parseInt(btn.dataset[attr.replace('-','')]), 1);
          this._config = c; this._fire(c); this._render();
        });
      });
    });
  }
}

customElements.define('room-overlay-card-editor', RoomOverlayCardEditor);

// Zaregistrovat editor na hlavní kartě
customElements.get('room-overlay-card').getConfigElement = () =>
  document.createElement('room-overlay-card-editor');
