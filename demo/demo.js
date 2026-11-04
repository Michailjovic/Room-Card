// Mock Home Assistant for the live demo: states, registries, services, WebSocket calls and a small
// more-info dialog. Enough for the card, the studio and the floor plan to run unchanged.
// HA's <ha-icon>: the Material Design Icons this card, its studio and the demo config use (mdi.json)
const MDI=await fetch('mdi.json').then(r=>r.json(),()=>({}));
if(!customElements.get('ha-icon'))customElements.define('ha-icon',class extends HTMLElement{
  static get observedAttributes(){return['icon'];}
  get icon(){return this._i;} set icon(v){this._i=v;this._r();}
  attributeChangedCallback(){this._i=this.getAttribute('icon');this._r();}
  connectedCallback(){if(!this.shadowRoot)this.attachShadow({mode:'open'});this._r();}
  _r(){if(!this.shadowRoot)return;const d=MDI[String(this._i||'').replace(/^mdi:/,'')];
    this.shadowRoot.innerHTML='<style>:host{display:inline-flex;align-items:center;justify-content:center;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);vertical-align:middle;fill:currentColor;flex:none}svg{width:100%;height:100%;display:block}</style>'+(d?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+d+'"/></svg>':'');}});
const here=await fetch('./room-overlay-card.js',{method:'HEAD'}).then(r=>r.ok,()=>false);
const BASE=here?'./':'../'; // GitHub Pages: next to index.html; the repo: /demo/ under the root
await import(BASE+'room-overlay-card.js');
await customElements.whenDefined('room-overlay-card');
const C=customElements.get('room-overlay-card');
const [CFG,SCN]=await Promise.all([fetch('config.json').then(r=>r.json()),fetch('scenario.json').then(r=>r.json())]);

let states=SCN.states;
const $=id=>document.getElementById(id);
let toastT=0;
function toast(t){const el=$('toast');el.textContent=t;el.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{el.hidden=true;},2200);}
const ids=(data,target)=>{const v=(target&&target.entity_id)||(data&&data.entity_id)||[];return(Array.isArray(v)?v:[v]).filter(Boolean);};
const ON=['on','playing','open','cleaning','heat','home'];
function put(id,state,attrs){const o=states[id]||{state:'unknown',attributes:{friendly_name:id}};
  states=Object.assign({},states,{[id]:{entity_id:id,state:state==null?o.state:String(state),attributes:Object.assign({},o.attributes,attrs||{}),last_changed:new Date().toISOString()}});}
function groups(){ // light groups follow their members
  for(const [id,o] of Object.entries(states)){const m=o.attributes&&o.attributes.entity_id;if(!Array.isArray(m)||!id.startsWith('light.'))continue;
    const on=m.filter(e=>states[e]&&states[e].state==='on');
    const b=on.length?Math.round(on.reduce((s,e)=>s+(states[e].attributes.brightness||255),0)/on.length):null;
    if(o.state!==(on.length?'on':'off')||o.attributes.brightness!==b)put(id,on.length?'on':'off',{brightness:b});}}
const moving={};
function moveCover(id,to){clearInterval(moving[id]);const from=+(states[id].attributes.current_position||0);if(from===to)return;
  const dir=to>from?1:-1;put(id,dir>0?'opening':'closing');push();
  moving[id]=setInterval(()=>{let p=+(states[id].attributes.current_position||0)+dir*4;if(dir>0?p>=to:p<=to){p=to;clearInterval(moving[id]);}
    put(id,p===to?(p>0?'open':'closed'):(dir>0?'opening':'closing'),{current_position:p});push();},90);}
function light(id,svc,d){const o=states[id];if(!o)return;const m=o.attributes.entity_id;
  if(Array.isArray(m)){const t=svc==='toggle'?(o.state==='on'?'turn_off':'turn_on'):svc;m.forEach(e=>light(e,t,d));return;}
  const want=svc==='toggle'?(o.state==='on'?'off':'on'):(svc==='turn_off'?'off':'on');
  const a={};if(want==='on'){a.brightness=d.brightness!=null?d.brightness:(d.brightness_pct!=null?Math.round(d.brightness_pct*2.55):(o.attributes.brightness||200));
    if(d.rgb_color)a.rgb_color=d.rgb_color;if(d.color_temp_kelvin)a.color_temp_kelvin=d.color_temp_kelvin;a.color_mode=a.rgb_color?'rgb':'brightness';}else a.brightness=null;
  put(id,want,a);}
function callService(domain,service,data,target){data=data||{};const L=ids(data,target);
  switch(domain){
    case'light':L.forEach(id=>light(id,service,data));break;
    case'switch':case'input_boolean':case'fan':case'humidifier':case'homeassistant':
      L.forEach(id=>{const o=states[id];if(!o)return;put(id,service==='toggle'?(ON.includes(o.state)?'off':'on'):(service==='turn_off'?'off':'on'));
        if(id.startsWith('light.'))light(id,service,data);});break;
    case'cover':L.forEach(id=>{if(!states[id])return;if(service==='stop_cover'){clearInterval(moving[id]);put(id,+states[id].attributes.current_position>0?'open':'closed');return;}
      moveCover(id,service==='open_cover'?100:service==='close_cover'?0:service==='toggle'?(+states[id].attributes.current_position>0?0:100):Math.round(+data.position||0));});break;
    case'media_player':L.forEach(id=>{const o=states[id];if(!o)return;
      const s={turn_on:'on',turn_off:'off',media_play:'playing',media_pause:'paused',media_play_pause:o.state==='playing'?'paused':'playing',toggle:ON.includes(o.state)?'off':'playing'}[service];if(s)put(id,s);});break;
    case'climate':L.forEach(id=>{if(service==='set_hvac_mode')put(id,data.hvac_mode,{hvac_action:data.hvac_mode==='off'?'off':'heating'});if(service==='set_temperature')put(id,null,{temperature:data.temperature});
      if(service==='turn_off')put(id,'off',{hvac_action:'off'});if(service==='turn_on')put(id,'heat',{hvac_action:'heating'});});break;
    case'vacuum':L.forEach(id=>{const st=id.replace('vacuum.','sensor.')+'_status';
      if(service==='start'){put(id,'cleaning');if(states[st])put(st,'cleaning');}
      else{put(id,'returning');if(states[st])put(st,'returning');setTimeout(()=>{put(id,'docked');if(states[st])put(st,'docked');push();},3000);}});break;
    case'script':if(L.includes('script.tv_power_toggle_s_wol')||service==='tv_power_toggle_s_wol'){callService('switch','toggle',{},{entity_id:'switch.01_tv'});
      callService('media_player',states['switch.01_tv'].state==='on'?'turn_on':'turn_off',{},{entity_id:'media_player.lg_webos_tv_oled83g58lw_beuyljp'});}
      else toast('script.'+service+' — not run in the demo');break;
    default:toast(domain+'.'+service+' — not available in the demo');
  }
  groups();push();return Promise.resolve();
}
const host=$('lovelace');
async function callWS(m){
  if(m.type==='lovelace/config')return JSON.parse(JSON.stringify(host.lovelace.config));
  if(m.type==='lovelace/config/save'){await host.lovelace.saveConfig(m.config);return null;}
  if(m.type==='call_service'){await callService(m.domain,m.service,m.service_data,m.target);return{response:{}};}
  throw new Error(m.type+' is not available in the demo');
}
const connection={sendMessagePromise:callWS,subscribeMessage:(cb,m)=>{if(m&&m.type==='render_template')cb({result:''});return Promise.resolve(()=>{});},
  subscribeEvents:()=>Promise.resolve(()=>{})};
function hass(){return{states,entities:SCN.entities,areas:SCN.areas,devices:{},services:{},user:{id:'demo',name:'Demo',is_admin:true},
  language:'en',selectedLanguage:'en',locale:{language:'en',number_format:'language',time_format:'24',first_weekday:'monday'},
  themes:{darkMode:true,themes:{}},config:{unit_system:{temperature:'°C',length:'km'},time_zone:'Europe/Prague',location_name:'Demo'},
  callService,callWS,connection,hassUrl:p=>p,panelUrl:'demo'};}
const card=document.createElement('room-overlay-card');
const cfg=JSON.parse(JSON.stringify(CFG));
// the studio saves "to the dashboard": this is the dashboard (found by object identity, like HA's)
host.lovelace={config:{title:'Demo',views:[{title:'Home',path:'home',cards:[cfg]}]},mode:'storage',urlPath:'demo',
  saveConfig:async nc=>{host.lovelace.config=nc;card.setConfig(nc.views[0].cards[0]);card.hass=hass();toast('Saved — in this tab only');}};
card.setConfig(cfg);card.hass=hass();host.appendChild(card);
function push(){const h=hass();card.hass=h;const S=C._rocStudio&&C._rocStudio.Studio&&C._rocStudio.Studio.current;if(S&&typeof S.setHass==='function')S.setHass(h);}
window.__demo={card,hass,callService,get states(){return states;}};

// more-info: a small dialog instead of HA's
const TOG=['light','switch','input_boolean','fan','humidifier','media_player','cover','climate','vacuum'];
document.addEventListener('hass-more-info',e=>{const id=e.detail&&e.detail.entityId,o=id&&states[id];if(!o)return;const d=id.split('.')[0];
  const at=Object.entries(o.attributes).filter(([k,v])=>!['friendly_name','entity_id','supported_features','supported_color_modes','hvac_modes'].includes(k)&&v!=null&&typeof v!=='object').slice(0,6).map(([k,v])=>k.replace(/_/g,' ')+': '+v).join('\n');
  const m=$('more');m.innerHTML='<div class="box" role="dialog" aria-modal="true"><h3></h3><div class="st"></div><div class="at"></div><div class="row">'+(TOG.includes(d)?'<button data-a="t">Toggle</button>':'')+'<button data-a="c">Close</button></div></div>';
  m.querySelector('h3').textContent=o.attributes.friendly_name||id;m.querySelector('.st').textContent=o.state;m.querySelector('.at').textContent=at;m.hidden=false;
  m.onclick=ev=>{const a=ev.target.dataset&&ev.target.dataset.a;if(ev.target===m||a==='c')m.hidden=true;if(a==='t'){
    const svc=d==='cover'?'toggle':d==='vacuum'?(o.state==='cleaning'?'return_to_base':'start'):d==='climate'?(o.state==='off'?'turn_on':'turn_off'):'toggle';
    callService(d==='climate'||d==='vacuum'||d==='cover'?d:d,svc,{},{entity_id:id});m.hidden=true;}};});
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('more').hidden=true;});
$('dev').onclick=()=>{const p=document.body.classList.toggle('phone');$('dev').textContent=p?'Tablet':'Phone';};
$('studio').onclick=async()=>{const b=$('studio');b.disabled=true;
  try{if(!C._rocStudio)await import(BASE+'room-overlay-card-studio.js');await C._rocStudio.open({from:'dashboard',card,hass:hass()});}
  catch(e){toast('Studio: '+(e&&e.message||e));}finally{b.disabled=false;}};
if(new URLSearchParams(location.search).get('phone'))$('dev').click();
