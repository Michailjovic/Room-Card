// ---- The lights lens, the light controller and the cleaning lens (7.4.0) --------------------------
// Two more lenses on the floor plan (68-heat-house.js has the lens machinery):
//   lights   — the light pools, windows and blinds in front; each label says on (how bright) / off;
//              a tap on a room opens its light controller (L) beside the plan, hold toggles them;
//              the lens's panel: every room's lights, all off.
//   cleaning — vacuums, trails and when each room was cleaned; a tap queues / unqueues the room in
//              AnyVac's shared selection (the same one its own card's dock uses), hold cleans it now;
//              the lens's panel: the vacuums, the mode, the queued rooms, start.
// The light controller also opens on its own: {action: lights, entities: [light.a, …] | entity,
// name, room} — the lights of a card room's light_controls when only `room` is given.
const ROC_LC_STR={
  en:{lens_lights:'Lights',lens_cleaning:'Cleaning',on_s:'on',off_s:'off',n_on:'{n} of {m} on',none_on:'All off',all_on:'All on',all_off:'All off',bright:'Brightness',
    warm:'Warm',neutral:'Neutral',cold:'Cold',close:'Close',house_l:'Lights · house',off_q:'Turn off every light on the plan?',rooms:'Rooms',
    house_c:'Cleaning',vacuums:'Vacuums',mode:'Mode',dry:'Vacuum',wet:'Mop',both:'Both',queue:'Rooms to clean',start:'Clean {n} rooms',start1:'Clean 1 room',clear:'Clear',
    nothing:'Tap rooms on the plan or here to queue them',bat:'{n} %',cleaning_in:'cleaning {r}',
    st_charging:'charging',st_cleaning:'cleaning',st_returning:'returning',st_idle:'idle',st_paused:'paused',st_error:'error',st_docked:'docked',st_charging_complete:'charged',
    l_lit:'{n} lit',l_none:'No light on',c_run:'{n} cleaning',c_q:'{n} queued',c_err:'Vacuum error'},
  cs:{lens_lights:'Světla',lens_cleaning:'Úklid',on_s:'zap.',off_s:'vyp.',n_on:'Svítí {n} z {m}',none_on:'Vše zhasnuto',all_on:'Rozsvítit vše',all_off:'Zhasnout vše',bright:'Jas',
    warm:'Teplá',neutral:'Neutrální',cold:'Studená',close:'Zavřít',house_l:'Světla · dům',off_q:'Zhasnout všechna světla na půdorysu?',rooms:'Místnosti',
    house_c:'Úklid',vacuums:'Vysavače',mode:'Režim',dry:'Vysát',wet:'Vytřít',both:'Obojí',queue:'Místnosti k úklidu',start:'Uklidit {n} místnosti',start1:'Uklidit 1 místnost',clear:'Zrušit výběr',
    nothing:'Klepni na místnosti na plánu nebo tady a zařadí se',bat:'{n} %',cleaning_in:'uklízí {r}',
    st_charging:'nabíjí',st_cleaning:'uklízí',st_returning:'vrací se',st_idle:'stojí',st_paused:'pozastaven',st_error:'chyba',st_docked:'v doku',st_charging_complete:'nabito',
    l_lit:'Svítí {n}',l_none:'Nic nesvítí',c_run:'Uklízí {n}',c_q:'Ve frontě {n}',c_err:'Chyba vysavače'},
};
function rocLcT(lang,k,v){const t=ROC_LC_STR[lang]||ROC_LC_STR.en;let s=t[k]!=null?t[k]:(ROC_LC_STR.en[k]!=null?ROC_LC_STR.en[k]:k);if(v)for(const x in v)s=s.split('{'+x+'}').join(v[x]);return s;}
// What a light can do, from its supported_color_modes (a switch: on / off only).
function rocLcCaps(st){
  const a=(st&&st.attributes)||{},m=Array.isArray(a.supported_color_modes)?a.supported_color_modes:[];
  const isLight=!!st&&String(st.entity_id||'').indexOf('light.')===0||m.length>0;
  const col=m.some(function(x){return['hs','rgb','rgbw','rgbww','xy'].indexOf(x)>=0;});
  return{dim:isLight&&m.length>0&&!(m.length===1&&m[0]==='onoff'),ct:m.indexOf('color_temp')>=0,col:col,
    kmin:rocHcNum(a.min_color_temp_kelvin)||2200,kmax:rocHcNum(a.max_color_temp_kelvin)||6500};
}
// The lights a `lights` action means, each with the name the user gave it (a card room's
// light_controls), and the room's name.
function rocLcResolve(cAll,a){
  const rooms=Array.isArray(cAll&&cAll.rooms)?cAll.rooms:[];
  let ents=Array.isArray(a.entities)?a.entities.map(function(x){return x&&typeof x==='object'?x.entity:x;}):(a.entity||a.entity_id?[a.entity||a.entity_id]:[]);
  ents=ents.filter(function(x,i,l){return typeof x==='string'&&x&&l.indexOf(x)===i;});
  let room=a.room!=null&&a.room!==''?rooms.find(function(r){return r&&String(r.id)===String(a.room);}):null;
  const lc=function(r){const c=r&&r.light_controls;return c&&Array.isArray(c.entities)?c.entities.map(function(x){return x&&typeof x==='object'?x:{entity:x};}).filter(function(x){return x.entity;}):[];};
  if(!ents.length&&room)ents=lc(room).map(function(x){return x.entity;});
  if(!room&&ents.length)room=rooms.find(function(r){return lc(r).some(function(x){return ents.indexOf(x.entity)>=0;});})||null;
  const names={};lc(room).forEach(function(x){if(x.name)names[x.entity]=x.name;});
  return{entities:ents,names:names,name:a.name||(room&&((room.overview_tile&&room.overview_tile.name)||room.name))||''};
}
const ROC_LC_CSS='.roc-lc-bd{position:absolute;inset:0;z-index:410;background:rgba(0,0,0,.4);}.roc-lc-bd.lc-lite{background:rgba(0,0,0,.12);}'
  +'.roc-lc{position:absolute;z-index:411;top:0;right:0;bottom:0;width:min(380px,92%);box-sizing:border-box;overflow-y:auto;background:var(--card-background-color,#1c1f24);color:var(--primary-text-color,#f2f3f5);border-radius:14px 0 0 14px;box-shadow:0 8px 30px rgba(0,0,0,.5);padding:16px 18px 18px;display:flex;flex-direction:column;gap:14px;font:14px/1.4 var(--paper-font-body1_-_font-family,system-ui,sans-serif);}'
  +'.roc-lc.lc-bottom{top:auto;left:0;width:auto;max-height:88%;border-radius:14px 14px 0 0;}'
  +'.lc-hd{display:flex;align-items:flex-start;gap:10px}.lc-hd>div{flex:1;min-width:0}.lc-room{font-size:18px;font-weight:600}.lc-sum{font-size:13px;color:var(--secondary-text-color,#9aa3ad)}'
  +'.lc-x{background:none;border:0;color:inherit;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:22px;line-height:1}'
  +'.lc-all{min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;font:inherit;font-weight:600;cursor:pointer}.lc-all.on{background:rgba(255,190,90,.16);border-color:#ffbe5a;color:#ffe0b0}'
  +'.lc-lt{display:flex;flex-direction:column;gap:8px;border-radius:12px;border:1px solid rgba(255,255,255,.1);padding:10px 12px;background:rgba(255,255,255,.03)}'
  +'.lc-lt.on{border-color:color-mix(in srgb,var(--lc-c,#ffbe5a) 60%,transparent);background:color-mix(in srgb,var(--lc-c,#ffbe5a) 10%,transparent)}'
  +'.lc-r1{display:flex;align-items:center;gap:10px}.lc-r1 b{flex:1;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lc-r1 span{font-size:12px;color:var(--secondary-text-color,#9aa3ad);font-variant-numeric:tabular-nums}'
  +'.lc-sw{position:relative;width:46px;height:26px;border-radius:13px;border:0;background:rgba(255,255,255,.18);cursor:pointer;flex:none}.lc-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s ease}'
  +'.lc-sw.on{background:var(--lc-c,#ffbe5a)}.lc-sw.on::after{transform:translateX(20px)}'
  +'.lc-rng{width:100%;margin:0;accent-color:var(--lc-c,#ffbe5a)}'
  +'.lc-chips{display:flex;flex-wrap:wrap;gap:6px}.lc-chips button{min-height:32px;min-width:32px;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:inherit;font:12px/1 inherit;padding:0 10px;cursor:pointer}'
  +'.lc-chips button.sw{padding:0;width:32px;border-color:rgba(255,255,255,.25)}'
  +'.lc-lbl{font-size:11px;color:var(--secondary-text-color,#9aa3ad);margin-bottom:-8px}'
  +'.roc-lc button:focus-visible,.roc-lc input:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px}';
const ROC_LC_COLORS=[[255,183,107],[255,110,80],[255,60,120],[170,90,255],[70,140,255],[60,220,160]];
function rocLcOpen(card,a){
  if(!card||!card._hass||!a)return;
  const R=rocLcResolve(card._config,a);if(!R.entities.length)return;
  rocLcClose(card);if(card._heat)rocHcClose(card);if(card._hp)rocHpClose(card);if(card._xp)rocXpClose(card);
  card._lc={ents:R.entities,names:R.names,name:R.name};
  if(!card._lcKey){card._lcKey=function(e){if(e.key==='Escape'&&card._lc)rocLcClose(card);};document.addEventListener('keydown',card._lcKey);}
  rocLcMount(card);rocLcUpdate(card);
  if(card._fpInst&&card._fpInst.setFocus)card._fpInst.setFocus(R.entities[0]);
}
function rocLcClose(card){
  const L=card&&card._lc;if(!L)return;
  if(L.el&&L.el.parentNode)L.el.parentNode.removeChild(L.el);
  if(L.bd&&L.bd.parentNode)L.bd.parentNode.removeChild(L.bd);
  card._lc=null;
  if(card._fpInst&&card._fpInst.setFocus)card._fpInst.setFocus('');
  if(card._lcKey){document.removeEventListener('keydown',card._lcKey);card._lcKey=null;}
}
function rocLcCall(card,d,s,data){try{const p=card._hass.callService(d,s,data);if(p&&p.catch)p.catch(function(e){console.warn('[room-overlay-card] lights',e);});}catch(e){console.warn('[room-overlay-card] lights',e);}}
function rocLcOn(card,ids,data){
  const L=ids.filter(function(x){return x.indexOf('light.')===0;}),O=ids.filter(function(x){return x.indexOf('light.')!==0;});
  if(L.length)rocLcCall(card,'light','turn_on',Object.assign({entity_id:L.length===1?L[0]:L},data||{}));
  if(O.length&&!data)rocLcCall(card,'homeassistant','turn_on',{entity_id:O.length===1?O[0]:O});
}
function rocLcOff(card,ids){if(ids.length)rocLcCall(card,'homeassistant','turn_off',{entity_id:ids.length===1?ids[0]:ids});}
function rocLcMount(card){
  const L=card._lc,sr=card.shadowRoot,wrap=sr&&sr.querySelector('.wrap');if(!wrap)return;
  const lang=rocHcLang(card._hass);
  const bd=document.createElement('div');bd.className='roc-lc-bd'+(card._fpActive?' lc-lite':'');bd.addEventListener('click',function(){rocLcClose(card);});
  const el=document.createElement('div');el.className='roc-lc'+(wrap.clientWidth&&wrap.clientWidth<600?' lc-bottom':'');
  el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.innerHTML='<style>'+ROC_LC_CSS+'</style><div class="lc-hd"><div><div class="lc-room" data-lc-name></div><div class="lc-sum" data-lc-sum></div></div><button class="lc-x" data-lc="close" aria-label="'+rocHcEsc(rocLcT(lang,'close'))+'">×</button></div>'
    +'<button class="lc-all" data-lc="all"></button><div data-lc-mw><div class="lc-lbl">'+rocHcEsc(rocLcT(lang,'bright'))+'</div><input class="lc-rng" type="range" min="1" max="100" step="1" data-lc-master aria-label="'+rocHcEsc(rocLcT(lang,'bright'))+'" style="margin-top:12px"></div>'
    +'<div data-lc-list style="display:flex;flex-direction:column;gap:8px"></div>';
  el.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('[data-lc]');if(!b)return;
    const k=b.getAttribute('data-lc'),id=b.getAttribute('data-e'),S=card._hass.states;
    if(k==='close')rocLcClose(card);
    else if(k==='all'){const on=L.ents.some(function(x){return S[x]&&S[x].state==='on';});if(on)rocLcOff(card,L.ents);else rocLcOn(card,L.ents);}
    else if(k==='sw'){if(S[id]&&S[id].state==='on')rocLcOff(card,[id]);else rocLcOn(card,[id]);}
    else if(k==='ct')rocLcOn(card,[id],{color_temp_kelvin:+b.getAttribute('data-v')});
    else if(k==='rgb')rocLcOn(card,[id],{rgb_color:b.getAttribute('data-v').split(',').map(Number)});
  });
  // sliders send on release (change), the label follows while dragging
  // 7.4.2: a slider being dragged keeps its place; the row's % follows it; when it is let go the
  // panel follows the light again (it used to wait until the panel was opened anew — the slider kept
  // the focus, and a focused slider blocked every update)
  el.addEventListener('pointerdown',function(e){if(e.target&&e.target.matches&&e.target.matches('input[type=range]'))L.drag=true;});
  const endDrag=function(){if(!L.drag)return;L.drag=false;setTimeout(function(){if(card._lc===L)rocLcUpdate(card);},0);};
  el.addEventListener('pointerup',endDrag);el.addEventListener('pointercancel',endDrag);
  el.addEventListener('input',function(e){
    const t=e.target;if(!t||!t.matches||!t.matches('[data-lc-bri]'))return;
    const sp=t.closest('.lc-lt')&&t.closest('.lc-lt').querySelector('.lc-r1 span');if(sp)sp.textContent=t.value+' %';
  });
  el.addEventListener('change',function(e){
    const t=e.target;if(!t||!t.matches)return;
    L.drag=false;
    if(t.matches('[data-lc-bri]')){L.pend[t.getAttribute('data-e')]={v:+t.value,at:Date.now()};setTimeout(function(){if(card._lc===L){L.sig='';rocLcUpdate(card);}},5100);} // the light never answered: show what it says
    if(t.matches('[data-lc-master]')){const S=card._hass.states,on=L.ents.filter(function(x){return S[x]&&S[x].state==='on'&&rocLcCaps(S[x]).dim;});rocLcOn(card,on.length?on:L.ents.filter(function(x){return rocLcCaps(S[x]).dim;}),{brightness_pct:+t.value});}
    else if(t.matches('[data-lc-bri]'))rocLcOn(card,[t.getAttribute('data-e')],{brightness_pct:+t.value});
    L.sig='';rocLcUpdate(card); // the row shows the sent level until the light reports
  });
  wrap.appendChild(bd);wrap.appendChild(el);
  L.el=el;L.bd=bd;L.lang=lang;L.sig='';L.drag=false;L.pend=L.pend||{};
  const x=el.querySelector('[data-lc="close"]');if(x)try{x.focus();}catch(_){}
}
function rocLcUpdate(card){
  const L=card._lc;if(!L)return;
  if(!L.el||!L.el.isConnected){const sr=card.shadowRoot;if(sr&&sr.querySelector('.wrap')){L.el=null;rocLcMount(card);}if(!L.el)return;}
  const S=card._hass.states,lang=L.lang,el=L.el,q=function(s){return el.querySelector(s);};
  const on=L.ents.filter(function(x){return S[x]&&S[x].state==='on';});
  q('[data-lc-name]').textContent=L.name||((S[L.ents[0]]&&S[L.ents[0]].attributes.friendly_name)||L.ents[0]);
  el.setAttribute('aria-label',q('[data-lc-name]').textContent);
  q('[data-lc-sum]').textContent=on.length?rocLcT(lang,'n_on',{n:on.length,m:L.ents.length}):rocLcT(lang,'none_on');
  const all=q('[data-lc="all"]');all.textContent=rocLcT(lang,on.length?'all_off':'all_on');all.classList.toggle('on',!!on.length);
  const dims=L.ents.filter(function(x){return rocLcCaps(S[x]).dim;});
  q('[data-lc-mw]').style.display=dims.length>1?'':'none';
  const mr=q('[data-lc-master]');
  if(mr&&!L.drag){const b=on.map(function(x){return rocHcNum(S[x].attributes.brightness);}).filter(isFinite);mr.value=String(b.length?Math.round(Math.max.apply(null,b)/2.55):100);}
  // the rows are rebuilt only when something they show changed (a slider being dragged keeps its place)
  const sig=JSON.stringify(L.ents.map(function(x){const s=S[x];return s?[s.state,s.attributes.brightness,s.attributes.rgb_color,s.attributes.color_temp_kelvin,s.attributes.supported_color_modes]:null;}));
  if(L.drag)return; // not under the finger; the drag's end brings it up to date
  // a value just sent is shown until the light reports it (or 5 s pass)
  const now=Date.now(),pv=function(id,real){const p=L.pend[id];if(!p)return real;if(now-p.at>5000||(isFinite(real)&&Math.abs(real-p.v)<=1)){delete L.pend[id];return real;}return p.v;};
  const psig=JSON.stringify(L.pend);
  if(sig+psig===L.sig)return;L.sig=sig+psig;
  const act=card.shadowRoot.activeElement,refocus=act&&el.contains(act)&&act.getAttribute?[act.getAttribute('data-e'),act.hasAttribute('data-lc-bri')?'[data-lc-bri]':'[data-lc="sw"]']:null;
  q('[data-lc-list]').innerHTML=L.ents.map(function(id){
    const s=S[id],a=(s&&s.attributes)||{},c=rocLcCaps(s),isOn=!!s&&s.state==='on';
    const bri=rocHcNum(a.brightness),pct=pv(id,isFinite(bri)?Math.max(1,Math.round(bri/2.55)):(isOn?100:0));
    const rgb=Array.isArray(a.rgb_color)?a.rgb_color:null,col=isOn?(rgb?'rgb('+rgb.join(',')+')':'#ffbe5a'):'#ffbe5a';
    const nm=L.names[id]||a.friendly_name||id;
    let h='<div class="lc-lt'+(isOn?' on':'')+'" style="--lc-c:'+col+'"><div class="lc-r1"><b>'+rocHcEsc(nm)+'</b><span>'+rocHcEsc(s?(isOn?(c.dim?pct+' %':rocLcT(lang,'on_s')):rocLcT(lang,'off_s')):'—')+'</span>'
      +'<button class="lc-sw'+(isOn?' on':'')+'" data-lc="sw" data-e="'+rocHcEsc(id)+'" role="switch" aria-checked="'+isOn+'" aria-label="'+rocHcEsc(nm)+'"></button></div>';
    if(c.dim)h+='<input class="lc-rng" type="range" min="1" max="100" step="1" value="'+(pct||1)+'" data-lc-bri data-e="'+rocHcEsc(id)+'" aria-label="'+rocHcEsc(nm+' · '+rocLcT(lang,'bright'))+'">';
    if(c.ct||c.col){
      h+='<div class="lc-chips">';
      if(c.ct)[['warm',2700],['neutral',4000],['cold',6000]].forEach(function(t){const k=Math.max(c.kmin,Math.min(c.kmax,t[1]));h+='<button data-lc="ct" data-e="'+rocHcEsc(id)+'" data-v="'+k+'">'+rocHcEsc(rocLcT(lang,t[0]))+'</button>';});
      if(c.col)ROC_LC_COLORS.forEach(function(v){h+='<button class="sw" data-lc="rgb" data-e="'+rocHcEsc(id)+'" data-v="'+v.join(',')+'" style="background:rgb('+v.join(',')+')" aria-label="rgb('+v.join(',')+')"></button>';});
      h+='</div>';
    }
    return h+'</div>';
  }).join('');
  // the keyboard keeps its place across the rebuild
  if(refocus&&refocus[0]){const n=[].slice.call(el.querySelectorAll(refocus[1])).find(function(x){return x.getAttribute('data-e')===refocus[0];});if(n)try{n.focus();}catch(_){}}
}
// ---- the lights lens's panel: every plan room's lights ----
function rocFpPlanRooms(cAll,def){
  const rooms=Array.isArray(cAll&&cAll.rooms)?cAll.rooms:[];
  return(def&&Array.isArray(def.rooms)?def.rooms:[]).filter(function(r){return r&&typeof r==='object';}).map(function(r){
    const cr=r.room!=null?rooms.find(function(x){return x&&String(x.id)===String(r.room);}):null;
    const L=(Array.isArray(r.lights)?r.lights:(r.lights?[r.lights]:[])).map(function(x){return x&&typeof x==='object'?String(x.entity||''):String(x);}).filter(Boolean);
    return{cfg:r,card:cr,name:r.name||(cr&&cr.overview_tile&&cr.overview_tile.name)||(cr&&cr.name)||r.room||'',lights:L};
  });
}
const ROC_XP_CSS=ROC_HP_CSS.replace(/roc-hp/g,'roc-xp').replace(/hp-/g,'xp-')
  +'.xp-room.lit{border-color:rgba(255,190,90,.6);background:rgba(255,190,90,.08)}.xp-room.lit .s i{background:#ffbe5a;box-shadow:0 0 6px #ffbe5a}'
  +'.xp-room.q{border-color:#03a9f4;background:rgba(3,169,244,.1)}.xp-room.q .s i{background:#03a9f4}'
  +'.xp-go{min-height:44px;border-radius:12px;border:0;background:var(--primary-color,#03a9f4);color:#fff;font:inherit;font-weight:600;cursor:pointer;flex:1}.xp-go:disabled{opacity:.4;cursor:default}'
  +'.xp-sec{min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:none;color:inherit;font:inherit;cursor:pointer;padding:0 16px}'
  +'.xp-acts{display:flex;gap:8px}.xp-vac{display:flex;align-items:center;gap:10px;font-size:13px}.xp-vac i{width:10px;height:10px;border-radius:50%;flex:none;background:#7d8590}.xp-vac b{font-weight:600}.xp-vac span{color:var(--secondary-text-color,#9aa3ad)}.xp-vac.err span{color:var(--roc-alert-c,#ff7a6e)}'
  +'.xp-hint{font-size:12px;color:var(--secondary-text-color,#9aa3ad)}';
// one bottom panel at a time for the lights and cleaning lenses (the house panel has its own)
function rocXpOpen(card,kind){
  if(!card||!card._hass)return;
  rocXpClose(card);if(card._hp)rocHpClose(card);if(card._heat)rocHcClose(card);if(card._lc)rocLcClose(card);
  const sr=card.shadowRoot,wrap=sr&&sr.querySelector('.wrap');if(!wrap)return;
  const lang=rocHcLang(card._hass),T=function(k,v){return rocHcEsc(rocLcT(lang,k,v));};
  const bd=document.createElement('div');bd.className='roc-xp-bd';bd.addEventListener('click',function(){rocXpClose(card);});
  const el=document.createElement('div');el.className='roc-xp';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  const ttl=kind==='lights'?T('house_l'):T('house_c');el.setAttribute('aria-label',kind==='lights'?rocLcT(lang,'house_l'):rocLcT(lang,'house_c'));
  el.innerHTML='<style>'+ROC_XP_CSS+'</style><div class="xp-hd"><h3>'+ttl+'</h3><button class="xp-x" data-xp="close" aria-label="'+T('close')+'">×</button></div><div data-xp-body style="display:flex;flex-direction:column;gap:14px"></div>';
  el.addEventListener('click',function(e){
    const b=e.target.closest&&e.target.closest('[data-xp]');if(!b)return;
    const k=b.getAttribute('data-xp'),P=card._xp;if(!P)return;
    if(k==='close')rocXpClose(card);
    else if(k==='alloff'){const ids=P.lit||[];card._confirm(rocLcT(lang,'off_q')).then(function(ok){if(ok)rocLcOff(card,ids);});}
    else if(k==='lroom'){const i=+b.getAttribute('data-v'),r=P.rooms[i];rocXpClose(card);if(r)rocLcOpen(card,{entities:r.lights,name:r.name,room:r.card&&r.card.id});}
    else if(k==='mode'){P.mode=b.getAttribute('data-v');P.sig='';rocXpUpdate(card);}
    else if(k==='q')card._hass.callService('anyvac','select_rooms',{rooms:[b.getAttribute('data-v')],mode:'toggle'});
    else if(k==='clear')card._hass.callService('anyvac','select_rooms',{rooms:[],mode:'clear'});
    else if(k==='go'&&P.sel&&P.sel.length)card._hass.callService('anyvac','clean',{rooms:P.sel.slice(),mode:P.mode});
  });
  wrap.appendChild(bd);wrap.appendChild(el);
  const def=rocFpCfg(card._config,card._roomIdx)||{};
  card._xp={kind:kind,el:el,bd:bd,lang:lang,sig:'',mode:['dry','wet','both'].indexOf(def.clean_mode)>=0?def.clean_mode:'dry'};
  if(!card._xpKey){card._xpKey=function(e){if(e.key==='Escape'&&card._xp)rocXpClose(card);};document.addEventListener('keydown',card._xpKey);}
  rocXpUpdate(card);
  const x=el.querySelector('[data-xp="close"]');if(x)try{x.focus();}catch(_){}
}
function rocXpClose(card){
  const P=card&&card._xp;if(!P)return;
  if(P.el&&P.el.parentNode)P.el.parentNode.removeChild(P.el);
  if(P.bd&&P.bd.parentNode)P.bd.parentNode.removeChild(P.bd);
  card._xp=null;
  if(card._xpKey){document.removeEventListener('keydown',card._xpKey);card._xpKey=null;}
}
// AnyVac: the map sensors of the plan and the shared selection (room names on the map)
function rocAvSensors(card,def){return typeof card._sigAnyvac==='function'?card._sigAnyvac(def||{}):[];}
function rocAvSel(S,ids){for(const id of ids){const a=S[id]&&S[id].attributes;if(a&&Array.isArray(a.selected_rooms))return a.selected_rooms.map(function(x){return String(x&&typeof x==='object'?x.name:x);});}return[];}
function rocAvRoom(S,ids,key){for(const id of ids){const a=S[id]&&S[id].attributes;const x=a&&Array.isArray(a.rooms)?a.rooms.find(function(q){return q&&String(q.home_room_id||'')===String(key);}):null;if(x)return x;}return null;}
function rocAvName(st,id){return String((st&&st.attributes&&st.attributes.friendly_name)||id).replace(/\s*-?\s*AnyVac Map$/i,'').trim()||id;}
function rocXpUpdate(card){
  const P=card._xp;if(!P)return;
  if(!P.el.isConnected){rocXpClose(card);return;}
  const S=card._hass.states,lang=P.lang,T=function(k,v){return rocHcEsc(rocLcT(lang,k,v));};
  const def=rocFpCfg(card._config,card._roomIdx)||{};
  const rooms=P.rooms=rocFpPlanRooms(card._config,def);
  let h='';
  if(P.kind==='lights'){
    const lit=[];
    const cells=rooms.map(function(r,i){
      if(!r.lights.length)return'';
      const on=r.lights.filter(function(x){return S[x]&&S[x].state==='on';});on.forEach(function(x){lit.push(x);});
      const b=on.map(function(x){return rocHcNum(S[x].attributes.brightness);}).filter(isFinite);
      return'<button class="xp-room'+(on.length?' lit':'')+'" data-xp="lroom" data-v="'+i+'"><span class="n">'+rocHcEsc(r.name)+'</span>'
        +'<span class="t">'+on.length+'<small>/ '+r.lights.length+'</small></span>'
        +'<span class="s"><i></i>'+rocHcEsc(on.length?rocLcT(lang,'n_on',{n:on.length,m:r.lights.length})+(b.length?' · '+Math.round(Math.max.apply(null,b)/2.55)+' %':''):rocLcT(lang,'none_on'))+'</span></button>';
    }).join('');
    P.lit=lit;
    h='<div class="xp-acts"><button class="xp-go" data-xp="alloff"'+(lit.length?'':' disabled')+'>'+T('all_off')+'</button></div>'
      +'<div class="xp-lbl">'+T('rooms')+'</div><div class="xp-rooms">'+cells+'</div>';
  }else{
    const ids=rocAvSensors(card,def),sel=rocAvSel(S,ids);
    const vc=Array.isArray(def.vacuums)?def.vacuums:[];
    const vac=ids.map(function(id){
      const st=S[id],a=(st&&st.attributes)||{},e=vc.find(function(x){return x&&typeof x==='object'&&x.entity===id;})||{};
      const err=a.vacuum_error||(a.dock_status&&a.dock_status.dock_error)||'';
      const ss=String(a.status_state||'');let txt=ss?rocLcT(lang,'st_'+ss.replace(/[^a-z_]/gi,'_').toLowerCase()):'';if(txt.indexOf('st_')===0)txt=ss;
      if(a.in_cleaning&&a.vacuum_room_name)txt=rocLcT(lang,'cleaning_in',{r:a.vacuum_room_name});
      const bat=rocHcNum(a.battery);
      const vcol=e.color||(card._fpInst&&card._fpInst._vacColors?card._fpInst._vacColors(id).robot:''); // the robot's colour on the plan
      return'<div class="xp-vac'+(err?' err':'')+'"><i style="'+(vcol?'background:'+rocHcEsc(vcol):'')+'"></i><b>'+rocHcEsc(rocAvName(st,id))+'</b><span>'+rocHcEsc([err?String(err):txt,isFinite(bat)?rocLcT(lang,'bat',{n:Math.round(bat)}):''].filter(Boolean).join(' · '))+'</span></div>';
    }).join('');
    const av=rooms.map(function(r){const x=r.cfg.anyvac_room?rocAvRoom(S,ids,r.cfg.anyvac_room):null;return x&&x.name?{r:r,x:x}:null;}).filter(Boolean);
    P.sel=av.filter(function(o){return sel.indexOf(String(o.x.name))>=0;}).map(function(o){return String(o.x.name);});
    const ago=function(t){const ms=Date.now()-Date.parse(t);if(!isFinite(ms)||ms<0)return'';const m=Math.round(ms/60000);return m<60?Math.max(1,m)+' min':(m<2880?Math.round(m/60)+' h':Math.round(m/1440)+' d');};
    const cells=av.map(function(o){
      const q=sel.indexOf(String(o.x.name))>=0,lt=[o.x.last_dry?rocLcT(lang,'dry')+' '+ago(o.x.last_dry):'',o.x.last_wet?rocLcT(lang,'wet')+' '+ago(o.x.last_wet):''].filter(function(v){return v&&!/ $/.test(v);}).join(' · ');
      return'<button class="xp-room'+(q?' q':'')+'" data-xp="q" data-v="'+rocHcEsc(o.x.name)+'" aria-pressed="'+q+'"><span class="n">'+rocHcEsc(o.r.name)+'</span><span class="s"><i></i>'+rocHcEsc(lt||'—')+'</span></button>';
    }).join('');
    const n=P.sel.length;
    h=(vac?'<div class="xp-lbl">'+T('vacuums')+'</div><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px">'+vac+'</div>':'')
      +'<div class="xp-lbl">'+T('mode')+'</div><div class="xp-modes" style="margin-top:8px">'+['dry','wet','both'].map(function(m){return'<button data-xp="mode" data-v="'+m+'"'+(P.mode===m?' class="on" aria-pressed="true"':' aria-pressed="false"')+'>'+T(m)+'</button>';}).join('')+'</div>'
      +'<div class="xp-lbl">'+T('queue')+'</div><div class="xp-rooms">'+cells+'</div>'
      +(n?'':'<div class="xp-hint">'+T('nothing')+'</div>')
      +'<div class="xp-acts"><button class="xp-go" data-xp="go"'+(n?'':' disabled')+'>'+(n===1?T('start1'):T('start',{n:n}))+'</button>'+(n?'<button class="xp-sec" data-xp="clear">'+T('clear')+'</button>':'')+'</div>';
  }
  if(h!==P.sig){P.el.querySelector('[data-xp-body]').innerHTML=h;P.sig=h;}
}
// ---- dock badges of the lights and cleaning lenses ----
function rocFpLensBadges(card,def,lang){
  const S=card._hass.states,out={};
  const rooms=rocFpPlanRooms(card._config,def);
  const lit=rooms.filter(function(r){return r.lights.some(function(x){return S[x]&&S[x].state==='on';});}).length;
  out.lights={badge:lit?{t:String(lit),c:''}:null,active:lit>0,title:rocLcT(lang,'lens_lights')+' · '+(lit?rocLcT(lang,'l_lit',{n:lit}):rocLcT(lang,'l_none'))};
  const ids=rocAvSensors(card,def);
  let run=0,err=false,prog=-1;
  ids.forEach(function(id){
    const a=S[id]&&S[id].attributes;if(!a)return;
    if(a.vacuum_error||(a.dock_status&&a.dock_status.dock_error))err=true;
    if(a.in_cleaning){run++;const r=Array.isArray(a.rooms)?a.rooms.find(function(x){return x&&x.name===a.vacuum_room_name;}):null;const p=r?rocHcNum(r.progress_pct):NaN;if(isFinite(p))prog=Math.max(prog,p);}
  });
  const q=rocAvSel(S,ids).length;
  out.cleaning={badge:err?{t:'!',c:'var(--roc-alert-c)'}:(run?{t:String(run),c:''}:(q?{t:String(q),c:'#03a9f4'}:null)),active:run>0,ring:run&&prog>=0?prog:-1,
    title:rocLcT(lang,'lens_cleaning')+' · '+(err?rocLcT(lang,'c_err'):(run?rocLcT(lang,'c_run',{n:run}):(q?rocLcT(lang,'c_q',{n:q}):'—')))};
  return out;
}
