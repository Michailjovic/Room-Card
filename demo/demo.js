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
// 7.5.0: what Versatile Thermostat reports about its settings (for the settings check), with the
// times relative to now; the phase currents and the cooking sensor of the event log
{const N=Date.now(),iso=m=>new Date(N-m*60000).toISOString(),o=(id,a)=>{states[id]={...states[id],attributes:{...states[id].attributes,...a}};};
  const vt=(age,tpi,extra)=>Object.assign({configuration:{type:'over_switch',cycle_min:45,is_controlled_by_central_mode:true,is_used_by_central_boiler:true},
    preset_temperatures:{frost_temp:10,eco_temp:10,comfort_temp:10,boost_temp:10},is_safety_configured:true,safety_manager:{safety_state:'off',safety_delay_min:60,safety_default_on_percent:0.25},
    is_heating_failure_detection_configured:true,heating_failure_detection_manager:{heating_failure_state:'off',detection_delay_min:150},
    is_window_configured:true,window_manager:{window_state:'off'},power_manager:{device_power:1.2}},extra||{},
    {specific_states:Object.assign({},extra&&extra.ss,{hvac_off_reason:null,last_temperature_datetime:iso(age),ext_current_temperature:-1.1,unavailable_underlying_entities:[],messages:[],auto_tpi_state:'on',auto_tpi_learning:tpi})});
  o('climate.versatile_living_room',vt(1,{coeff_indoor_heat:0.79,coeff_outdoor_heat:0.013,total_cycles:44,last_learning_status:'ok',autolearn_enabled:true},{ss:{temperature_slope:0.4}}));
  o('climate.versatile_bedroom',vt(2,{coeff_indoor_heat:1.1,coeff_outdoor_heat:0.06,total_cycles:6,learning_start_date:iso(1440),last_learning_status:'power_out_of_range(100.0% vs Saturation 100.0%)',autolearn_enabled:true},
    {is_heating_failure_detection_configured:false,ss:{temperature_slope:0.6}}));
  o('climate.versatile_kitchen',vt(0,{coeff_indoor_heat:0.6,coeff_outdoor_heat:0.01,total_cycles:5,learning_start_date:iso(2880),last_learning_status:'ok',autolearn_enabled:true},{power_manager:{device_power:0.01},ss:{temperature_slope:0}}));
  [['l1',3.4],['l2',5.1],['l3',2.7]].forEach(([k,v])=>{states['sensor.main_phase_'+k]={entity_id:'sensor.main_phase_'+k,state:String(v),attributes:{friendly_name:'Main supply '+k.toUpperCase(),unit_of_measurement:'A',device_class:'current'}};});
  states['binary_sensor.kitchen_cooking']={entity_id:'binary_sensor.kitchen_cooking',state:'off',attributes:{friendly_name:'Kitchen cooking'}};
  states['binary_sensor.main_supply_overload']={entity_id:'binary_sensor.main_supply_overload',state:'off',attributes:{friendly_name:'Main supply overload'}};}
// the logbook of the last days: what an automation running the central mode writes (7.5.0 demo)
function demoLogbook(){
  const N=Date.now()/1000,out=[],ctx=e=>({context_event_type:'automation_triggered',context_source:'state of '+e,context_entity_id:'automation.heating_central_mode',context_name:'Heating: central mode'});
  const day=86400,at=(d,h,m)=>{const t=new Date();t.setDate(t.getDate()-d);t.setHours(h,m,0,0);return t.getTime()/1000;};
  const pause=(t,cause,dur,why,kw,ph)=>{if(t>N)return;
    out.push({entity_id:cause,state:cause.startsWith('switch.hdo')?'off':'on',when:t-2},Object.assign({entity_id:'select.central_mode',state:'Stopped',when:t},ctx(cause)),
      Object.assign({entity_id:'select.central_mode',name:'Heating',message:why+' → paused · kitchen '+kw+' kW · L1 '+ph[0]+' A · L2 '+ph[1]+' A · L3 '+ph[2]+' A',when:t+0.01},ctx(cause)),
      {entity_id:'climate.versatile_living_room',state:'off',when:t+1},{entity_id:'climate.versatile_bedroom',state:'off',when:t+1});
    const e=t+dur*60;if(e>N)return;
    out.push({entity_id:cause,state:cause.startsWith('switch.hdo')?'on':'off',when:e-300},Object.assign({entity_id:'select.central_mode',state:'Heat only',when:e},ctx(cause)),
      Object.assign({entity_id:'select.central_mode',name:'Heating',message:'resumed · kitchen 0.1 kW',when:e+0.01},ctx(cause)),
      {entity_id:'climate.versatile_living_room',state:'heat',when:e+30},{entity_id:'climate.versatile_bedroom',state:'heat',when:e+30});};
  for(let d=6;d>=0;d--){
    pause(at(d,9,20),'switch.hdo',40,'tariff change',0,[4.3,0.9,6.1]);
    pause(at(d,13,0),'switch.hdo',40,'tariff change',0.2,[3.8,1.2,5.4]);
    pause(at(d,18,42),'binary_sensor.kitchen_cooking',25,'cooking started',2.4,[3.1,6.3,16.8]);
    if(d===1)pause(at(d,11,5),'binary_sensor.kitchen_cooking',69,'oven on',1.9,[2.8,15.2,3.4]);
  }
  const ov=at(1,20,51);if(ov<N)pause(ov,'binary_sensor.main_supply_overload',7,'supply overload',3.1,[4.0,5.1,24.1]);
  const nb=at(2,5,4);if(nb<N)out.push({entity_id:'climate.versatile_bedroom',state:'unavailable',when:nb},{entity_id:'climate.versatile_bedroom',state:'heat',when:nb+3600*6});
  return out.filter(e=>e.when<=N).sort((a,b)=>a.when-b.when);
}
// the phase currents during a pause: a short peak where the log says so
function demoPhases(m){
  const t0=Date.parse(m.start_time)/1000,t1=Date.parse(m.end_time||new Date().toISOString())/1000,lb=demoLogbook().filter(e=>e.message&&e.when>=t0&&e.when<=t1+1);
  const ph=lb.length?(/L1 ([\d.]+) A · L2 ([\d.]+) A · L3 ([\d.]+) A/.exec(lb[0].message)||[]).slice(1).map(Number):[3,4,5];
  const r={};(m.entity_ids||[]).forEach((id,i)=>{const v=ph[i]||3;r[id]=[{s:String(Math.round(v*0.6*10)/10),lu:t0},{s:String(v),lu:(t0+t1)/2},{s:String(Math.round(v*0.7*10)/10),lu:t1}];});
  return r;
}
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
      L.forEach(id=>{const o=states[id];if(!o)return;if(id.startsWith('light.')){light(id,service,data);return;} // homeassistant.toggle on a light
        put(id,service==='toggle'?(ON.includes(o.state)?'off':'on'):(service==='turn_off'?'off':'on'));});break;
    case'cover':L.forEach(id=>{if(!states[id])return;if(service==='stop_cover'){clearInterval(moving[id]);put(id,+states[id].attributes.current_position>0?'open':'closed');return;}
      moveCover(id,service==='open_cover'?100:service==='close_cover'?0:service==='toggle'?(+states[id].attributes.current_position>0?0:100):Math.round(+data.position||0));});break;
    case'media_player':L.forEach(id=>{const o=states[id];if(!o)return;
      const s={turn_on:'on',turn_off:'off',media_play:'playing',media_pause:'paused',media_play_pause:o.state==='playing'?'paused':'playing',toggle:ON.includes(o.state)?'off':'playing'}[service];if(s)put(id,s);});break;
    case'climate':L.forEach(id=>{if(service==='set_hvac_mode')put(id,data.hvac_mode,{hvac_action:data.hvac_mode==='off'?'off':'heating'});if(service==='set_temperature')put(id,null,{temperature:data.temperature});
      if(service==='turn_off')put(id,'off',{hvac_action:'off'});if(service==='turn_on')put(id,'heat',{hvac_action:'heating'});});break;
    case'number':L.forEach(id=>{if(service==='set_value')put(id,data.value);});break;
    // Versatile Thermostat (7.3.0 demo): the central mode stops / restores every thermostat; a timed preset holds the boost °C
    case'select':L.forEach(id=>{if(service!=='select_option')return;put(id,data.option);
      if(id==='select.central_mode')Object.keys(states).filter(k=>k.startsWith('climate.versatile_')).forEach(k=>{const a=states[k].attributes,stop=data.option==='Stopped';
        put(k,stop?'off':'heat',{hvac_action:stop?'off':(a.current_temperature<a.temperature?'heating':'idle'),power_percent:stop?0:(a.current_temperature<a.temperature?45:0),specific_states:Object.assign({},a.specific_states,{hvac_off_reason:stop?'hvac_off_central_mode':null})});});});break;
    case'versatile_thermostat':L.forEach(id=>{const n=states[id.replace('climate.','number.')+'_preset_boost_temp'];
      if(service==='set_timed_preset')put(id,null,{temperature:n?+n.state:states[id].attributes.temperature,timed_preset_manager:{is_active:true,end_time:new Date(Date.now()+(+data.duration_minutes||60)*60000).toISOString()}});
      if(service==='cancel_timed_preset')put(id,null,{timed_preset_manager:{is_active:false}});});break;
    // AnyVac (7.4.0 demo): the shared room selection and a short pretend clean
    case'anyvac':{const av=Object.keys(states).filter(k=>k.endsWith('_anyvac_map'));
      if(service==='select_rooms'){const cur=(states[av[0]].attributes.selected_rooms||[]).slice();const rs=data.rooms||[];
        const nx=data.mode==='clear'?[]:data.mode==='set'?rs.slice():data.mode==='toggle'?cur.filter(r=>!rs.includes(r)).concat(rs.filter(r=>!cur.includes(r))):cur;
        av.forEach(id=>put(id,null,{selected_rooms:nx}));}
      else if(service==='clean'){const id=av[0],r=(data.rooms||[])[0];put(id,null,{in_cleaning:true,vacuum_room_name:r,status_state:'cleaning',selected_rooms:[]});av.slice(1).forEach(x=>put(x,null,{selected_rooms:[]}));
        setTimeout(()=>{put(id,null,{in_cleaning:false,status_state:'charging'});push();},8000);}
      else toast('anyvac.'+service+' — not available in the demo');}break;
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
  if(m.type==='logbook/get_events')return demoLogbook();
  if(m.type==='history/history_during_period'&&(m.entity_ids||[]).every(id=>id.startsWith('sensor.main_phase_')))return demoPhases(m);
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
