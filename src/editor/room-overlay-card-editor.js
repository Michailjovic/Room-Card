class RoomOverlayCardEditor extends HTMLElement{
  constructor(){super();this._config=null;this._hass=null;this._rocPosHandler=null;this._rocRoomHandler=null;this._fdT=null;this._openPanels=null;this._hist=[];this._histIdx=-1;this._histMuted=false;this._keysBound=false;this._editRoomIdx=0;this._editGlobal=false;this._roomIdxInit=false;this._prevCard=null;this._showAdv=false;this._filterMode=null;this._dlCache=null;this._lySub=null;}

  // Entity datalist options — cached; rebuilding ~2k <option> strings on every
  // editor re-render is measurable with large state machines
  // Entity suggestions: <option value="light.x" label="Friendly name"> so the
  // browser's dropdown shows (and matches on) the name too. `key` picks a
  // ROC_ENT_LISTS domain filter; no key = every entity.
  _dlOptions(key){
    const h=this._hass;if(!h)return'';
    const ids=Object.keys(h.states);
    if(!this._dlCache||this._dlCache.n!==ids.length)this._dlCache={n:ids.length,by:{}};
    const k=key||'*';
    if(this._dlCache.by[k]!==undefined)return this._dlCache.by[k];
    const doms=key?ROC_ENT_LISTS[key]:null;
    const s=ids.filter(function(id){return!doms||doms.indexOf(id.slice(0,id.indexOf('.')))>=0;}).sort().map(function(id){
      const st=h.states[id];const fn=st&&st.attributes&&st.attributes.friendly_name;
      return'<option value="'+escA(id)+'"'+(fn&&fn!==id?' label="'+escA(String(fn))+'"':'')+'>';
    }).join('');
    this._dlCache.by[k]=s;
    return s;
  }
  // The lists are emitted empty and filled on the first focus of a field that
  // uses them (_dlFill) — a few thousand <option>s per list would otherwise
  // be re-parsed on every editor render (measured ~60-100 ms on a 4k-entity
  // install).
  _dlAll(){
    return'<datalist id="roc-entities"></datalist>'
      +Object.keys(ROC_ENT_LISTS).map(function(k){return'<datalist id="roc-ent-'+k+'"></datalist>';}).join('');
  }
  _dlFill(id){
    if(!this._hass||!/^roc-ent/.test(id||''))return;
    const dl=this.querySelector('#'+id);
    if(!dl||dl.hasChildNodes())return;
    dl.innerHTML=this._dlOptions(id==='roc-entities'?undefined:id.slice(8));
  }
  // Under every entity field: the entity's friendly name, or "not found"
  // when Home Assistant doesn't know it (typo, renamed entity). Templates and
  // empty fields get no hint. Fields sitting directly in a grid/flex row get
  // only the border + tooltip so the row layout isn't disturbed.
  _entHint(inp){
    const h=this._hass;if(!h||!inp)return;
    const v=(inp.value||'').trim();
    const parent=inp.parentElement;
    const inline=!!parent&&/grid|flex/.test(parent.style&&parent.style.display||'');
    let hint=inp.nextElementSibling;
    if(!(hint&&hint.classList&&hint.classList.contains('roc-ent-hint')))hint=null;
    const ids=v?v.split(',').map(function(x){return x.trim();}).filter(Boolean):[];
    let msg='',bad=false;
    if(ids.length&&!/[{}]/.test(v)){
      const miss=ids.filter(function(id){return!h.states[id];});
      if(miss.length){bad=true;msg='Not found in Home Assistant: '+miss.join(', ');}
      else if(ids.length===1){const fn=h.states[ids[0]].attributes&&h.states[ids[0]].attributes.friendly_name;if(fn&&fn!==ids[0])msg=String(fn);}
    }
    if(bad||inp.hasAttribute('data-roc-ent-bad'))inp.style.borderColor=bad?'var(--warning-color,#ffa600)':'';
    if(bad)inp.setAttribute('data-roc-ent-bad','');else inp.removeAttribute('data-roc-ent-bad');
    if(msg||inp.hasAttribute('data-roc-hint-t')){inp.title=msg;if(msg)inp.setAttribute('data-roc-hint-t','');else inp.removeAttribute('data-roc-hint-t');}
    if(inline)return;
    if(!msg){if(hint)hint.style.display='none';return;}
    if(!hint){
      hint=document.createElement('div');hint.className='roc-ent-hint';
      hint.style.cssText='font-size:11px;line-height:1.3;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      inp.parentNode.insertBefore(hint,inp.nextSibling);
    }
    hint.textContent=msg;hint.style.display='block';
    hint.style.color=bad?'var(--warning-color,#ffa600)':'var(--secondary-text-color)';
  }
  _entHints(){
    const self=this;
    if(!this._hass)return;
    this.querySelectorAll('input[list^="roc-ent"]').forEach(function(i){self._entHint(i);});
    this._hintsDone=true;
  }
  // Toast at the bottom of the editor (sticky, so it stays in view while
  // scrolling). Survives the editor's own re-renders until it times out.
  _showToast(msg,undo){
    const self=this;
    this._toast={msg:msg,undo:!!undo};
    clearTimeout(this._toastT);
    this._toastT=setTimeout(function(){self._toast=null;self._paintToast();},10000);
    this._paintToast();
  }
  _paintToast(){
    const self=this;
    const root=this.querySelector('.roc-ed');
    let el=this.querySelector('.roc-toast');
    if(!this._toast||!root){if(el)el.remove();return;}
    if(!el){
      el=document.createElement('div');el.className='roc-toast';el.setAttribute('role','status');
      el.style.cssText='position:sticky;bottom:8px;z-index:5;margin:10px auto 0;max-width:440px;display:flex;align-items:center;gap:12px;padding:8px 8px 8px 14px;border-radius:8px;background:var(--primary-text-color,#222);color:var(--card-background-color,#fff);font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.35);';
    }
    if(el.parentElement!==root)root.appendChild(el);
    el.innerHTML='<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+escA(this._toast.msg)+'</span>'
      +(this._toast.undo?'<button type="button" data-toast-undo style="background:none;border:none;color:var(--primary-color,#03a9f4);font-weight:600;font-size:13px;letter-spacing:.04em;cursor:pointer;padding:6px 10px;">UNDO</button>':'');
    const u=el.querySelector('[data-toast-undo]');
    if(u)u.addEventListener('click',function(e){e.stopPropagation();self._toast=null;clearTimeout(self._toastT);self._undo();self._paintToast();});
  }
  // Element ids: empty, characters outside A-Za-z0-9_-, or a duplicate within
  // the same list → red border + a one-line message under the field.
  _idHints(){
    const self=this;
    ROC_ID_ATTRS.forEach(function(attr){
      const els=Array.prototype.slice.call(self.querySelectorAll('input['+attr+']'));
      const count={};
      els.forEach(function(el){const v=el.value.trim();if(v)count[v]=(count[v]||0)+1;});
      els.forEach(function(el){
        const v=el.value.trim();
        let msg='';
        if(!v)msg='ID is required';
        else if(/[^A-Za-z0-9_-]/.test(v))msg='Use only letters, digits, _ and -';
        else if(count[v]>1)msg='Duplicate ID — another item in this list uses "'+v+'"';
        el.style.borderColor=msg?'var(--error-color,#d33)':'';
        let n=el.nextElementSibling;
        if(!(n&&n.classList&&n.classList.contains('roc-id-err')))n=null;
        if(!msg){if(n)n.style.display='none';return;}
        if(!n){n=document.createElement('div');n.className='roc-id-err';n.style.cssText='color:var(--error-color,#d33);font-size:11px;line-height:1.3;margin-top:2px;';el.parentNode.insertBefore(n,el.nextSibling);}
        n.textContent=msg;n.style.display='block';
        // One-click fix for invalid / duplicate ids (not for empty ones, and
        // not for lists other config keys point at — see ROC_ID_FIXABLE).
        if(v&&ROC_ID_FIXABLE.indexOf(attr)>=0){
          const taken={};els.forEach(function(o){if(o!==el)taken[o.value.trim()]=1;});
          const base=rocSlugId(v);let sug=base,k=2;
          while(taken[sug])sug=base+'_'+(k++);
          const b=document.createElement('button');b.type='button';b.setAttribute('data-id-fix','');
          b.textContent='Use "'+sug+'"';
          b.style.cssText='margin-left:8px;padding:1px 8px;border-radius:4px;border:1px solid currentColor;background:none;color:inherit;font-size:11px;cursor:pointer;';
          b.addEventListener('click',function(){
            el.value=sug;
            el.dispatchEvent(new Event('change',{bubbles:true}));
            self._idHints();
          });
          n.appendChild(b);
        }
      });
    });
  }

  // Active room view for editing (the room whose sections are shown)
  _roomView(){
    const c=this._config||{};
    if(this._editGlobal)return c;
    if(Array.isArray(c.rooms)&&c.rooms.length){
      this._editRoomIdx=Math.max(0,Math.min(this._editRoomIdx,c.rooms.length-1));
      return c.rooms[this._editRoomIdx];
    }
    return c;
  }

  _convertToRooms(){
    const c=this._collectConfig();
    if(Array.isArray(c.rooms)&&c.rooms.length)return;
    const room={id:'room_1',name:'Room 1'};
    ROOM_KEYS.forEach(function(k){if(c[k]!==undefined){room[k]=c[k];delete c[k];}});
    c.rooms=[room];
    this._editRoomIdx=0;
    this._config=c;this._render();this._fire(c);
  }

  // Onboarding (v6.10.0, COCKPIT_PLAN.md kap.5.3.1) — "I found N areas in
  // Home Assistant — create a room for each?". Converts to multi-room first
  // (same move as _convertToRooms(), reused verbatim) if needed, then adds
  // one room per hass.areas entry with its entities pre-assigned as icons in
  // a simple grid (no photo yet, so no meaningful position to place them at
  // — the user repositions them in the Elements tab once a photo is added,
  // kap.5.3.1: "the user only adds photos"). One-shot: the button that calls
  // this only shows while the card is still single-room (see roomsInner).
  _bootstrapAreas(){
    if(!this._hass||!this._hass.areas)return;
    const c=this._collectConfig();
    if(!Array.isArray(c.rooms)||!c.rooms.length){
      const room={id:'room_1',name:'Room 1'};
      ROOM_KEYS.forEach(function(k){if(c[k]!==undefined){room[k]=c[k];delete c[k];}});
      c.rooms=[room];
    }
    const areas=this._hass.areas,devices=this._hass.devices||{},entities=this._hass.entities||{};
    const existingIds=new Set(c.rooms.map(function(r){return r.id;}));
    Object.keys(areas).forEach(function(areaId){
      const area=areas[areaId]||{};
      const name=area.name||areaId;
      let base=String(name||'room').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'room';
      let id=base,n=1;
      while(existingIds.has(id)){n++;id=base+'_'+n;}
      existingIds.add(id);
      const icons=[];let col=0,row=0;
      Object.keys(entities).forEach(function(eid){
        const ent=entities[eid]||{};
        const entArea=ent.area_id||(ent.device_id&&devices[ent.device_id]&&devices[ent.device_id].area_id);
        if(entArea!==areaId)return;
        const dom=eid.split('.')[0];
        icons.push({id:eid.replace(/[^A-Za-z0-9_-]/g,'_'),entity:eid,icon:ROC_DOMAIN_ICON[dom]||'mdi:help-box',top:(5+row*12)+'%',left:(5+col*12)+'%',width:'8%',height:'8%'});
        col++;if(col>=7){col=0;row++;}
      });
      const room={id:id,name:name};
      if(icons.length)room.icons=icons;
      c.rooms.push(room);
    });
    this._editRoomIdx=Math.max(0,c.rooms.length-1);
    this._config=c;this._render();this._fire(c);
  }

  _toHex(c){if(!c)return'#ffffff';if(c.startsWith('#'))return c.length===4?'#'+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]:c.slice(0,7);const m=c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);return m?'#'+parseInt(m[1]).toString(16).padStart(2,'0')+parseInt(m[2]).toString(16).padStart(2,'0')+parseInt(m[3]).toString(16).padStart(2,'0'):'#ffffff';}

  // Parse a YAML textarea non-destructively: invalid input keeps the
  // previous config value and flags the field instead of silently deleting
  // data. Also shows the actual parse error as inline text under the box
  // (C1) — a red border with a hover-only title tooltip is invisible on
  // touch.
  // opt.scalar: a bare value (string/number) is acceptable — every other box
  // holds a mapping or a list, and with a real YAML parser (v6.22.0) a line
  // of plain text is a valid *string*, which must not slip into the config.
  // opt.template: text starting with {{ / {% is taken verbatim when it isn't
  // valid YAML (a multi-line Jinja template typed without quotes or `|`).
  _pYaml(el,opt){
    if(!el)return{ok:false,val:undefined};
    opt=opt||{};
    const t=el.value.trim();
    if(!t){el.style.borderColor='';el.title='';this._yErr(el,'');return{ok:true,val:undefined};}
    let r=_yaml.pe(el.value);
    if(opt.template&&/^\{[{%]/.test(t)&&(r.val===null||typeof r.val!=='string'))r={val:t,err:null};
    if(r.val!==null&&r.val!==undefined&&!opt.scalar&&typeof r.val!=='object')
      r={val:null,err:'Expected "key: value" lines or a "- " list, not a single value'};
    if(r.val===null||r.val===undefined){
      const msg=r.err||'Invalid YAML';
      el.style.borderColor='var(--error-color,#d33)';
      el.title=msg+' — previous value kept';
      this._yErr(el,msg+' — previous value kept');
      return{ok:false,val:undefined};
    }
    el.style.borderColor='';el.title='';this._yErr(el,'');
    return{ok:true,val:r.val};
  }

  // Inline error text right under a YAML textarea (C1): lazily creates/reuses
  // a sibling <div class="roc-yaml-err"> right after it. Rebuilt on every
  // full editor re-render along with the textarea itself, same as the border
  // color already was — nothing to clean up separately.
  _yErr(el,msg){
    let e=el.nextElementSibling;
    const has=e&&e.classList&&e.classList.contains('roc-yaml-err');
    if(!msg){if(has){e.textContent='';e.style.display='none';}return;}
    if(!has){
      e=document.createElement('div');
      e.className='roc-yaml-err';
      e.style.cssText='color:var(--error-color,#d33);font-size:11px;line-height:1.4;margin:2px 0 6px;';
      el.parentNode.insertBefore(e,el.nextSibling);
    }
    e.textContent=msg;e.style.display='block';
  }

  // One tile overlay's fields, read back from its composite-keyed
  // (kind:i:ti) structured fields -- the exact same shape _collectConfig()
  // already reads for top-level `overlays`, just keyed differently because a
  // tile's overlays are nested inside one element's own tile: rather than a
  // flat array (v6.9.0, D3 scheme b).
  _collectTileOverlay(kind,i,ti,ov){
    const self=this;
    const key=kind+':'+i+':'+ti;
    const q=function(s){return self.querySelector(s);};
    const o=Object.assign({},ov);
    const idEl=q('[data-tlov-id="'+key+'"]');if(idEl)o.id=idEl.value;
    const imgEl=q('[data-tlov-img="'+key+'"]');if(imgEl){if(imgEl.value)o.image=imgEl.value;else delete o.image;}
    const trEl=q('[data-tlov-tr="'+key+'"]');if(trEl)o.transition=trEl.value;
    const animEl=q('[data-tlov-anim="'+key+'"]');if(animEl&&animEl.value)o.animation=animEl.value;else delete o.animation;
    const tfModeEl=q('[data-tlov-tf-mode="'+key+'"]');
    if(tfModeEl){
      const tfMode=tfModeEl.value;
      if(!tfMode)delete o.transform;
      else{
        const gv=function(k){const e=q('[data-tlov-tf-'+k+'="'+key+'"]');return e?String(e.value).trim():'';};
        const tf={};
        const _e1=gv('ent');if(_e1)tf.entity=_e1;
        const _a1=gv('attr');if(_a1)tf.attribute=_a1;
        const _o1=gv('origin');if(_o1)tf.origin=_o1;
        const _t1=gv('tr');if(_t1)tf.transition=_t1;
        const _p1=gv('persp');if(_p1)tf.perspective=_p1;
        if(tfMode==='states'){
          const mp={};
          self.querySelectorAll('[data-tlov-tfk^="'+key+'-"]').forEach(function(kEl){
            const rowKey=kEl.dataset.tlovTfk;
            const vEl=self.querySelector('[data-tlov-tfv="'+rowKey+'"]');
            const k=kEl.value.trim();
            if(k&&vEl&&vEl.value.trim())mp[k]=vEl.value.trim();
          });
          if(Object.keys(mp).length)tf.map=mp;
        }else if(tfMode==='range'){
          tf.from={value:Number(gv('fv')||0),transform:gv('ft')||'none'};
          tf.to={value:Number(gv('tv')||100),transform:gv('tt')||'none'};
        }else if(tfMode==='spin'){
          const sp={};
          const _s1=gv('smin');if(_s1)sp.min_duration=_s1;
          const _s2=gv('smax');if(_s2)sp.max_duration=_s2;
          const _s3=gv('saxis');if(_s3&&_s3!=='z')sp.axis=_s3;
          const _s4=q('[data-tlov-tf-srev="'+key+'"]');if(_s4&&_s4.checked)sp.reverse=true;
          tf.spin=sp;
        }
        o.transform=tf;
      }
    }
    const yaR=this._pYaml(q('[data-tlov-yaml="'+key+'"]'));
    if(yaR.ok){
      const p=yaR.val;
      if(p){
        if(p.opacity||p.filter){o.conditions={};if(p.opacity)o.conditions.opacity=p.opacity;if(p.filter)o.conditions.filter=p.filter;}
        else delete o.conditions;
        if(p.state_images)o.state_images=p.state_images;else delete o.state_images;
      }else{delete o.conditions;delete o.state_images;}
    }
    return o;
  }

  // <input type=color> cannot express alpha — if the picker still shows the hex
  // of the original (possibly rgba) value, keep the original string.
  _colorVal(el,orig){
    if(!el)return orig;
    if(orig&&this._toHex(orig)===el.value)return orig;
    return el.value;
  }

  // Open the editor on the room the card was showing. Primary source is the
  // in-memory ROC_ROOM_MEM the card writes (survives HA's edit toggle, which
  // navigates to ?edit=1 and DROPS the URL hash). url_sync hash is a fallback.
  _initEditRoom(cfg){
    try{
      if(!cfg||!Array.isArray(cfg.rooms)||!cfg.rooms.length)return;
      const clamp=(ri)=>Math.max(0,Math.min(ri,cfg.rooms.length-1));
      // 1) room the card last switched to (exact identity)
      const mem=ROC_ROOM_MEM.get(cfgKey(cfg));
      if(mem!=null){const ri=roomMatch(cfg,mem);if(ri>=0){this._editRoomIdx=clamp(ri);return;}}
      // 2) fallback: url_sync hash (if HA hasn't stripped it)
      const u=cfg.url_sync;
      if(!u||typeof location==='undefined')return;
      const key=(typeof u==='string'&&u.trim())?u.trim():'room';
      const h=String(location.hash||'').replace(/^#/,'');
      if(!h)return;
      let val=null;
      h.split('&').forEach(function(p){const eq=p.indexOf('=');if(eq>0&&decodeURIComponent(p.slice(0,eq))===key)val=decodeURIComponent(p.slice(eq+1));});
      if(val===null)return;
      const ri=roomMatch(cfg,val);
      if(ri>=0)this._editRoomIdx=clamp(ri);
    }catch(_){}
  }

  // Point the url_sync hash at the room being edited + fire hashchange, so HA's
  // OWN preview card (which reads url_sync) follows the editor. Automates the
  // "scroll to restore #room=… then it loads" workaround. url_sync only.
  _writeEditHash(cfg){
    if(this._rocHosted)return; // inside the studio the canvas is the preview — leave the dashboard URL alone
    try{
      const u=cfg&&cfg.url_sync;
      if(!u||typeof location==='undefined'||!Array.isArray(cfg.rooms)||!cfg.rooms.length)return;
      const key=(typeof u==='string'&&u.trim())?u.trim():'room';
      const r=cfg.rooms[Math.max(0,Math.min(this._editRoomIdx,cfg.rooms.length-1))];
      const val=encodeURIComponent(String(r.id||r.name||this._editRoomIdx));
      const parts=String(location.hash||'').replace(/^#/,'').split('&').filter(Boolean)
        .filter(function(p){const eq=p.indexOf('=');return!(eq>0&&decodeURIComponent(p.slice(0,eq))===key);});
      parts.push(encodeURIComponent(key)+'='+val);
      const newHash='#'+parts.join('&');
      if((location.hash||'')===newHash)return; // already pointed there
      try{history.replaceState(history.state,'',location.pathname+location.search+newHash);}
      catch(_){location.hash=newHash;}
      // replaceState doesn't emit hashchange — nudge the preview card's listener
      try{window.dispatchEvent(new HashChangeEvent('hashchange'));}
      catch(_){try{window.dispatchEvent(new Event('hashchange'));}catch(__){}}
    }catch(_){}
  }

  setConfig(cfg){
    const _hadLayout=!!(cfg&&cfg.layout);
    cfg=rocMigrateLayout(cfg);
    if(!_hadLayout)this._wasMigrated=true;
    const prev=this._config;
    this._config=cfg;
    // Open the editor on the room the card was showing (ROC_ROOM_MEM, hash
    // fallback). One-time, so the room picker still wins afterwards.
    if(!this._roomIdxInit){this._roomIdxInit=true;this._initEditRoom(cfg);}
    this._writeEditHash(cfg); // keep the url_sync hash on the edited room (drives HA's native preview; survives its save-strip)
    if(!this._hist.length){try{this._hist=[JSON.stringify(cfg)];this._histIdx=0;}catch(_){}}
    if(prev&&this.innerHTML.trim()){
      const _ri=this._editRoomIdx;
      const _sc=function(x){return Array.isArray(x.rooms)&&x.rooms.length?x.rooms[Math.max(0,Math.min(_ri,x.rooms.length-1))]:x;};
      const pR=_sc(prev),cR=_sc(cfg);
      const same=
        (prev.rooms||[]).length===(cfg.rooms||[]).length&&
        (pR.overlays||[]).length===(cR.overlays||[]).length&&
        (pR.zones||[]).length===(cR.zones||[]).length&&
        (pR.badges||[]).length===(cR.badges||[]).length&&
        (pR.elements||[]).length===(cR.elements||[]).length&&
        (pR.icons||[]).length===(cR.icons||[]).length&&
        (pR.filter_conditions||[]).length===(cR.filter_conditions||[]).length&&
        (pR.labels||[]).length===(cR.labels||[]).length&&
        (pR.gauges||[]).length===(cR.gauges||[]).length&&
        (pR.vacuum_widgets||[]).length===(cR.vacuum_widgets||[]).length&&
        (pR.glows||[]).length===(cR.glows||[]).length&&
        (pR.blinds||[]).length===(cR.blinds||[]).length&&
        ((pR.brightness_model?.source||[]).length===(cR.brightness_model?.source||[]).length)&&
        ((pR.brightness_model?.filter_gradient||[]).length===(cR.brightness_model?.filter_gradient||[]).length)&&
        (pR.groups||[]).length===(cR.groups||[]).length;
      if(same)return;
    }
    this._render();
  }

  set hass(h){
    this._hass=h;
    if(this._prevCard)try{this._prevCard.hass=h;}catch(_){}
    if(!this._hintsDone)this._entHints();
  }

  // Interactive preview inside the editor — a real card instance mirroring
  // Edit mode (config.test_mode); shown here whenever it's on, since it's the
  // same saved config field that also puts the real dashboard card into it.
  // The config the in-editor preview card gets: Edit mode forced on, no URL
  // sync, multi-room locked to the edited room, and — while the shared Global
  // defaults are being edited — the previewed room's own ROOM_KEYS overrides
  // stripped so the preview falls through to the values being edited.
  _previewCfg(src){
    const cfg=rocClone(src);
    cfg.test_mode=true;cfg._roc_preview=true;
    delete cfg.url_sync; // editor preview must not hijack the dashboard URL
    const _multi=Array.isArray(cfg.rooms)&&cfg.rooms.length>0;
    if(_multi)cfg.follow_mode='manual'; // lock the preview to the room being edited (no presence jumps)
    if(_multi&&this._editGlobal){
      const _gvIdx=Math.max(0,Math.min(this._editRoomIdx,cfg.rooms.length-1));
      const _gvRoom=cfg.rooms[_gvIdx];
      if(_gvRoom){
        const KEEP_VISUAL=['id','name','area_match','base_image','base_camera','camera_refresh','base_image_conditions'];
        Object.keys(_gvRoom).forEach(function(k){if(!KEEP_VISUAL.includes(k))delete _gvRoom[k];});
      }
    }
    return cfg;
  }
  // Push a config into the mounted preview (bug #7, v6.20.0): every fired
  // change reaches it, not just Layout edits. Skipped when the preview already
  // shows exactly this (its own drag relayed back, or a re-render).
  _pushPreview(src){
    const el=this._prevCard;
    if(!el||!src||!src.test_mode)return;
    try{
      const cfg=this._previewCfg(src);
      const j=JSON.stringify(cfg);
      if(j===this._prevPushed)return;
      this._prevPushed=j;
      el._editGlobal=this._editGlobal;
      el.setConfig(cfg);
      if(Array.isArray(cfg.rooms)&&cfg.rooms.length)el._roomIdx=Math.max(0,Math.min(this._editRoomIdx,cfg.rooms.length-1));
    }catch(e){console.warn('[room-overlay-card] editor preview update failed:',e);}
  }
  // Mounted once and then MOVED into each re-rendered editor (bug #15,
  // v6.20.0): a drag, an add/remove or any other full editor render used to
  // throw the preview away and build a new one — image reload, flicker, lost
  // selection. It is only rebuilt when it shows a different room than the one
  // being edited (room picker) or Edit mode was off.
  _mountPreview(){
    const host=this.querySelector('#roc-prev-host');
    const old=this._prevCard;
    this._prevCard=null;
    if(!host||!this._config||!this._config.test_mode){this._prevPushed=null;return;}
    try{
      const multi=Array.isArray(this._config.rooms)&&this._config.rooms.length>0;
      const want=multi?Math.max(0,Math.min(this._editRoomIdx,this._config.rooms.length-1)):0;
      if(old&&old._config&&(!multi||old._roomIdx===want)&&!!old._editGlobal===!!this._editGlobal){
        host.appendChild(old);
        this._prevCard=old;
        if(this._hass)old.hass=this._hass;
        this._pushPreview(this._config);
        return;
      }
      const el=document.createElement('room-overlay-card');
      const cfg=this._previewCfg(this._config);
      el.setConfig(cfg);
      this._prevPushed=JSON.stringify(cfg);
      if(multi)el._roomIdx=want;
      el._editGlobal=this._editGlobal;
      if(this._hass)el.hass=this._hass;
      host.appendChild(el);
      this._prevCard=el;
    }catch(e){console.warn('[room-overlay-card] editor preview failed:',e);}
  }

  // Single escaping helper shared with the card (escA). The editor used to have
  // its own copy that differed in two ways, both of them bugs:
  //   · it did not escape ' — harmless today (every _e() output lands in a
  //     double-quoted attribute or a text node, verified), but a trap for the
  //     next single-quoted attribute someone adds;
  //   · it used String(s) rather than String(s ?? ''), so an undefined field
  //     rendered the literal text "undefined" (and null → "null") into the
  //     input box instead of leaving it empty.
  _e(s){return escA(s);}

  _fire(c){
    this._pushHist(c);
    this.dispatchEvent(new CustomEvent('config-changed',{bubbles:true,composed:true,detail:{config:Object.assign({type:'custom:room-overlay-card'},c)}}));
    this._pushPreview(c);
  }

  _pushHist(c){
    if(this._histMuted)return;
    try{
      const j=JSON.stringify(c);
      if(this._hist[this._histIdx]===j)return;
      this._hist=this._hist.slice(0,this._histIdx+1);
      this._hist.push(j);
      if(this._hist.length>50)this._hist.shift();
      this._histIdx=this._hist.length-1;
    }catch(_){}
  }

  _undo(){if(this._rocHost){this._rocHost.undo();return;}if(this._histIdx>0)this._histGo(this._histIdx-1);}
  _redo(){if(this._rocHost){this._rocHost.redo();return;}if(this._histIdx<this._hist.length-1)this._histGo(this._histIdx+1);}
  // Studio (v6.41.0): load a config the studio produced (undo/redo, a canvas drag) and re-render
  // unconditionally — setConfig() skips the render when only values (not item counts) changed.
  _rocStudioLoad(cfg){
    this._config=rocMigrateLayout(cfg);
    this._render();
  }
  _histGo(i){
    this._histIdx=i;
    this._config=JSON.parse(this._hist[i]);
    this._histMuted=true;
    try{this._render();this._fire(this._config);}finally{this._histMuted=false;}
  }

  _fireDebounced(){
    const self=this;
    clearTimeout(this._fdT);
    this._fdT=setTimeout(function(){self._fire(self._collectConfig());},150);
  }

  // Layout-tab fields debounce through here instead of _fireDebounced(): the
  // mounted Edit-mode preview card (_prevCard, see _mountPreview) only gets a
  // fresh setConfig() when this editor's own setConfig() runs a full _render()
  // — which it skips whenever array item counts are unchanged (see the `same`
  // check in setConfig()). layout.* isn't part of that count comparison at
  // all, so a pure Layout edit never reaches _prevCard through the normal
  // path. Push it there directly instead, without touching the editor's own
  // DOM (no _render() here — keeps focus/cursor in the field being typed).
  _lyDebouncedUpdate(){
    const self=this;
    clearTimeout(this._fdT);
    this._fdT=setTimeout(function(){
      self._fire(self._collectConfig()); // _fire() also updates the preview (v6.20.0)
    },150);
  }

  _collectConfig(){
    const c=Object.assign({},this._config);
    const self=this;
    const q=function(s){return this.querySelector(s);}.bind(this);
    const v=function(id,fb){const el=q('#'+id);return el?el.value:fb;};
    // Cockpit sections (v6.8.0): shared `section`/`tile` reader for zones,
    // icons, elements and blinds — the only element kinds that may be tagged
    // into a section (COCKPIT_PLAN.md kap.3.2; badges are not in that list).
    // Structured tile fields (B2, BUG_UX_ANALYSIS_v6.15.1.md §Part 2) — reads
    // back everything _tileFieldsHtml() renders for TILE_DEDICATED_KEYS,
    // mutating `tile` in place. Shared by both _secTile (tagged element's
    // item.tile) and _collectDeclTile (a section's own flat declared tile),
    // keyed the same composite way each of those already keys its own inputs.
    const _collectTileFields=function(key,tile){
      const nameEl=q('[data-tf-name="'+key+'"]');if(nameEl){if(nameEl.value.trim())tile.name=nameEl.value.trim();else delete tile.name;}
      const entEl=q('[data-tf-entity="'+key+'"]');if(entEl){if(entEl.value.trim())tile.entity=entEl.value.trim();else delete tile.entity;}
      const iconEl=q('[data-tf-icon="'+key+'"]');if(iconEl){if(iconEl.value.trim())tile.icon=iconEl.value.trim();else delete tile.icon;}
      const animEl=q('[data-tf-anim="'+key+'"]');if(animEl){if(animEl.value)tile.icon_animation=animEl.value;else delete tile.icon_animation;}
      const actEl=q('[data-tf-active="'+key+'"]');if(actEl){
        // v6.16.0: "washing, drying" → a list (any of them counts as active)
        const _av=actEl.value.split(',').map(function(x){return x.trim();}).filter(Boolean);
        if(!_av.length)delete tile.active_state;else tile.active_state=_av.length===1?_av[0]:_av;
      }
      const sclEl=q('[data-tf-sclass="'+key+'"]');if(sclEl){if(sclEl.value&&sclEl.value!=='auto')tile.state_class=sclEl.value;else delete tile.state_class;}
      const valEl=q('[data-tf-value="'+key+'"]');if(valEl){if(valEl.value.trim())tile.value=valEl.value.trim();else delete tile.value;}
      const progEl=q('[data-tf-progress="'+key+'"]');if(progEl){if(progEl.value.trim())tile.progress=progEl.value.trim();else delete tile.progress;}
      // Quick actions: rebuild each from ITS OWN previous full object (so a
      // `data:` key, or a `target:` too complex for the single-entity field
      // below, isn't silently dropped) plus whatever the structured
      // icon/name/service/target fields currently say.
      const prevQuick=Array.isArray(tile.quick)?tile.quick:[];
      const newQuick=[];
      for(let qi=0;;qi++){
        const iEl=q('[data-tf-q-icon="'+key+':'+qi+'"]');
        if(!iEl)break;
        const prevQ=prevQuick[qi]||{};
        const qo=Object.assign({},prevQ);
        const ic=iEl.value.trim();if(ic)qo.icon=ic;else delete qo.icon;
        const nmEl=q('[data-tf-q-name="'+key+':'+qi+'"]');const nm=nmEl?nmEl.value.trim():'';if(nm)qo.name=nm;else delete qo.name;
        const svcEl=q('[data-tf-q-svc="'+key+':'+qi+'"]');const svc=svcEl?svcEl.value.trim():'';if(svc)qo.service=svc;else delete qo.service;
        const tgtEl=q('[data-tf-q-target="'+key+':'+qi+'"]');
        if(tgtEl){
          const prevSimple=(prevQ.target&&prevQ.target.entity_id&&Object.keys(prevQ.target).length===1)?prevQ.target.entity_id:(typeof prevQ.target==='string'?prevQ.target:'');
          const tv=tgtEl.value.trim();
          if(tv!==prevSimple){if(tv)qo.target={entity_id:tv};else delete qo.target;}
        }
        newQuick.push(qo);
      }
      if(newQuick.length)tile.quick=newQuick;else delete tile.quick;
      self._applyActs('tf:'+key,tile);
    };
    const _secTile=function(kind,i,o){
      const linkEl=q('[data-sec-link="'+kind+':'+i+'"]');
      if(linkEl&&linkEl.value)o.section=linkEl.value;else delete o.section;
      const tile=Object.assign({},o.tile||{});
      // The leftover YAML box owns every key except the ones with a dedicated
      // input in _tileFieldsHtml() (TILE_DEDICATED_KEYS) — same KEEP-list
      // pattern as EL_DEDICATED_KEYS (bug #2): keys removed from the box are
      // removed from the tile too; keys with a dedicated field are refreshed
      // by _collectTileFields() below regardless of what the box says.
      const tileR=self._pYaml(q('[data-sec-tile="'+kind+':'+i+'"]'));
      if(tileR.ok){
        for(const k of Object.keys(tile))if(!TILE_DEDICATED_KEYS.includes(k))delete tile[k];
        if(tileR.val)Object.assign(tile,tileR.val);
      }
      _collectTileFields(kind+':'+i,tile);
      // Image mode (v6.9.0, D3 scheme b): `image` is its own field, `overlays`
      // its own structured list -- both live OUTSIDE the tile fields above,
      // read from the current array on `o.tile` (the last render's, so
      // add/remove/reorder always start from what is actually on screen).
      const imgEl=q('[data-tile-img="'+kind+':'+i+'"]');
      const imgV=imgEl?imgEl.value.trim():'';
      if(imgV)tile.image=imgV;else delete tile.image;
      const imgrEl=q('[data-tile-imgr="'+kind+':'+i+'"]');
      const imgrV=imgrEl?imgrEl.value.trim():'';
      if(imgrV)tile.image_ratio=imgrV;else delete tile.image_ratio;
      const prevOvs=(o.tile&&Array.isArray(o.tile.overlays))?o.tile.overlays:[];
      const ovs=prevOvs.map(function(ov,ti){return self._collectTileOverlay(kind,i,ti,ov);});
      if(ovs.length)tile.overlays=ovs;else delete tile.overlays;
      if(Object.keys(tile).length)o.tile=tile;else delete o.tile;
    };
    // Section-declared tiles (v6.11.2) — a section's own `tiles:` array, no
    // room/zone/element anchor. The declared tile object IS the tile: (flat),
    // unlike a tagged element's item.tile, so this rebuilds it directly rather
    // than reusing _secTile. Image/overlays reuse the exact same composite-
    // keyed machinery as a tagged element's tile (kind:'dt', i:'<secI>_<ti>').
    const _collectDeclTile=function(secIdx,ti,prevTile){
      const dtKey=secIdx+'_'+ti;
      const skey=secIdx+':'+ti;
      const o=Object.assign({},prevTile||{});
      const idEl=q('[data-dtile-id="'+skey+'"]');if(idEl&&idEl.value.trim())o.id=idEl.value.trim();else delete o.id;
      const yaR=self._pYaml(q('[data-dtile-yaml="'+skey+'"]'));
      if(yaR.ok){
        for(const k of Object.keys(o))if(!TILE_DEDICATED_KEYS.includes(k)&&k!=='id'&&k!=='image'&&k!=='image_ratio'&&k!=='overlays')delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      _collectTileFields(skey,o);
      const imgEl=q('[data-tile-img="dt:'+dtKey+'"]');
      const imgV=imgEl?imgEl.value.trim():'';
      if(imgV)o.image=imgV;else delete o.image;
      const imgrEl=q('[data-tile-imgr="dt:'+dtKey+'"]');
      const imgrV=imgrEl?imgrEl.value.trim():'';
      if(imgrV)o.image_ratio=imgrV;else delete o.image_ratio;
      const prevOvs=Array.isArray(prevTile&&prevTile.overlays)?prevTile.overlays:[];
      const ovs=prevOvs.map(function(ov,oi){return self._collectTileOverlay('dt',dtKey,oi,ov);});
      if(ovs.length)o.overlays=ovs;else delete o.overlays;
      return o;
    };
    // Multi-room: sections write into the room being edited; shared keys stay top-level
    const hasRooms=Array.isArray(c.rooms)&&c.rooms.length>0;
    if(hasRooms)c.rooms=c.rooms.map(function(r){return Object.assign({},r);});
    const tgt=(hasRooms&&!this._editGlobal)?c.rooms[Math.max(0,Math.min(this._editRoomIdx,c.rooms.length-1))]:c;
    // Background mode (image vs camera) — mutually exclusive at save time, not just
    // hidden in the UI: whichever isn't the active mode is cleared, so a stale value
    // in the other field can never silently win at render time (camera always wins
    // there if both happened to be set).
    const _bgModeEl=q('#bg-mode');
    const _bgModeV=_bgModeEl?_bgModeEl.value:(tgt.base_camera?'camera':'image');
    if(_bgModeV==='camera'){
      delete tgt.base_image;
      const _bcam=v('base_camera','').trim();
      if(_bcam)tgt.base_camera=_bcam;else delete tgt.base_camera;
      const _bcr=parseFloat(v('camera_refresh',''));
      if(_bcam&&!isNaN(_bcr)&&_bcr>0&&_bcr!==10)tgt.camera_refresh=_bcr;else delete tgt.camera_refresh;
    }else{
      delete tgt.base_camera;delete tgt.camera_refresh;
      tgt.base_image=v('base_image',tgt.base_image||'');
      if(!tgt.base_image)delete tgt.base_image;
    }
    const _wxEnt=v('weather_entity','').trim();
    const _wxEff=v('weather_effect','');
    const _wxOp=parseFloat(v('weather_opacity',''));
    if(_wxEnt||(_wxEff&&_wxEff!=='auto')){
      const _wo={};
      if(_wxEnt)_wo.entity=_wxEnt;
      if(_wxEff&&_wxEff!=='auto')_wo.effect=_wxEff;
      if(!isNaN(_wxOp)&&_wxOp!==0.45)_wo.opacity=_wxOp;
      const _oldWo=typeof tgt.weather_overlay==='object'&&tgt.weather_overlay?tgt.weather_overlay:{};
      if(_oldWo.z_index!==undefined)_wo.z_index=_oldWo.z_index;
      if(_oldWo.angle!==undefined)_wo.angle=_oldWo.angle;
      tgt.weather_overlay=_wo;
    }else delete tgt.weather_overlay;
    const _wxNmEl=q('#weather-nav-mini');if(_wxNmEl){if(_wxNmEl.checked)tgt.weather_nav_mini=true;else delete tgt.weather_nav_mini;}
    // Layout block (v4) — height/orientation/threshold/gap + per-profile grids
    (function(){
      if(!q('#ly-hmode'))return; // Layout tab not rendered (onboarding)
      const ly=Object.assign({},c.layout||{});
      const hm=q('#ly-hmode');
      if(hm.value==='custom'){const hv=v('ly-hcustom','').trim();ly.height=hv||'viewport';}
      else ly.height=hm.value;
      if(ly.height==='viewport')delete ly.height; // default
      const orS=q('#ly-orient');
      const pinS=q('#ly-pin');
      const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id||'';
      let orient=(ly.orientation&&typeof ly.orientation==='object')?Object.assign({},ly.orientation):null;
      if(orient&&orient.by_browser)orient.by_browser=Object.assign({},orient.by_browser);
      if(pinS&&bid){
        if(pinS.value){orient=orient||{};orient.by_browser=orient.by_browser||{};orient.by_browser[bid]=pinS.value;}
        else if(orient&&orient.by_browser){delete orient.by_browser[bid];if(!Object.keys(orient.by_browser).length)delete orient.by_browser;}
      }
      const orV=orS?orS.value:'auto';
      if(orient){
        if(orV==='portrait'||orV==='landscape')orient.default=orV;else delete orient.default;
        if(!Object.keys(orient).length)orient=null;
      }else if(orV==='portrait'||orV==='landscape')orient=orV;
      if(orient)ly.orientation=orient;else delete ly.orientation;
      const th=parseFloat(v('ly-threshold',''));
      if(!isNaN(th)&&th>0&&th!==1)ly.threshold=th;else delete ly.threshold;
      const gp=v('ly-gap','').trim();if(gp)ly.gap=gp;else delete ly.gap;
      const _numOr=function(s){const t=String(s).trim();if(!t)return null;return/^[\d.]+$/.test(t)?parseFloat(t):t;};
      ['portrait','landscape'].forEach(function(pk){
        const lp={};
        const rw=v('ly-rows__'+pk,'').trim(),cl=v('ly-cols__'+pk,'').trim();
        if(rw)lp.rows=rw.split(',').map(_numOr).filter(function(x){return x!==null;});
        if(cl)lp.columns=cl.split(',').map(_numOr).filter(function(x){return x!==null;});
        const place={};
        ['nav','cards_above','image','lights','cards_below','cover'].forEach(function(rg){
          const rr=v('ly-r__'+pk+'__'+rg,'').trim();
          if(!rr)return;
          const pl={row:_numOr(rr)};
          const cc2=v('ly-c__'+pk+'__'+rg,'').trim();if(cc2)pl.col=_numOr(cc2);
          const ov2=q('#ly-o__'+pk+'__'+rg);if(ov2&&ov2.checked)pl.overflow='auto';
          place[rg]=pl;
        });
        if(Object.keys(place).length)lp.place=place;
        if(Object.keys(lp).length)ly[pk]=lp;else delete ly[pk];
      });
      c.layout=ly;
    })();
    const _zm=q('#zoom');
    if(_zm&&_zm.checked)c.zoom=true;else delete c.zoom;
    const _bicR=this._pYaml(this.querySelector('#base_image_conditions'));
    if(_bicR.ok){if(Array.isArray(_bicR.val))tgt.base_image_conditions=_bicR.val;else delete tgt.base_image_conditions;}
    // Per-profile inputs → scalar (only Landscape filled) or {portrait,landscape}
    const _collProf=function(idb){
      const o={};let n=0;
      ROC_PROFILES.forEach(function(pk){const el=q('#'+idb+'__'+pk);if(!el)return;const vv=el.value.trim();if(vv){o[pk]=vv;n++;}});
      if(n===0)return undefined;
      if(n===1&&o.landscape!==undefined)return o.landscape;
      return o;
    };
    const _arV=_collProf('aspect_ratio');c.aspect_ratio=_arV!==undefined?_arV:'16/9';
    const _brV=_collProf('border_radius');if(_brV!==undefined)c.border_radius=_brV;else delete c.border_radius;
    const _ifV=_collProf('image_fit');if(_ifV!==undefined)c.image_fit=_ifV;else delete c.image_fit;
    const _iaV=_collProf('image_align');if(_iaV!==undefined)c.image_align=_iaV;else delete c.image_align;
    const _lav=v('lock_aspect','').trim().toLowerCase();
    if(_lav==='true'||_lav==='on'||_lav==='yes'||_lav==='auto')c.lock_aspect=true;
    else if(_lav)c.lock_aspect=v('lock_aspect','').trim();
    else delete c.lock_aspect;
    const _ftV=v('filter_transition','2s ease');
    if(_ftV&&_ftV!=='2s ease')c.filter_transition=_ftV;else delete c.filter_transition;
    const tm=q('#test_mode');if(tm&&tm.checked)c.test_mode=true;else delete c.test_mode;
    const hpEl=q('#haptic');if(hpEl&&!hpEl.checked)c.haptic=false;else delete c.haptic; // default on — only write when explicitly turned off
    this._applyActs('room',tgt,['tap']);
    const _caR=this._pYaml(q('#cards_above_yaml'));
    if(_caR.ok){if(_caR.val)tgt.cards_above=_caR.val;else delete tgt.cards_above;}
    const _cbR=this._pYaml(q('#cards_below_yaml'));
    if(_cbR.ok){if(_cbR.val)tgt.cards_below=_cbR.val;else delete tgt.cards_below;}
    // Light controls
    (function(){
      // Start from the previous block so keys without a GUI field (an entity's
      // `icon:`, anything added later) survive a save — the KEEP pattern used
      // everywhere else in this editor (v6.17.0; before, they were dropped).
      const prevLc=(tgt.light_controls&&typeof tgt.light_controls==='object')?tgt.light_controls:{};
      const prevEnts=lcNormEnts(prevLc);
      const ents=[];
      self.querySelectorAll('[data-lc-ent]').forEach(function(el,i){
        const ent=el.value.trim();
        const nmEl=self.querySelector('[data-lc-name="'+i+'"]');
        const nm=nmEl?nmEl.value.trim():'';
        const o=Object.assign({},prevEnts[i]&&prevEnts[i].entity===ent?prevEnts[i]:{},{entity:ent});
        if(nm)o.name=nm;else delete o.name;
        ents.push(Object.keys(o).length===1?{entity:ent}:o);
      });
      if(ents.length){
        const lc=Object.assign({},prevLc,{entities:ents});
        ['lux_sensor','lux_max','columns','height','style'].forEach(function(k){delete lc[k];});
        const _sty=v('lc-style','');if(_sty==='native')lc.style='native';
        const _lx=v('lc-lux','').trim();if(_lx)lc.lux_sensor=_lx;
        const _lxm=parseFloat(v('lc-luxmax',''));if(!isNaN(_lxm)&&_lxm>0)lc.lux_max=_lxm;
        const _cols=parseInt(v('lc-cols',''),10);if(!isNaN(_cols)&&_cols>0)lc.columns=_cols;
        const _hgtRaw=v('lc-height','').trim();
        if(_hgtRaw){if(/^[0-9.]+$/.test(_hgtRaw))lc.height=parseFloat(_hgtRaw);else if(_hgtRaw.charAt(0)==='{'){const _hp=_yaml.p(_hgtRaw);lc.height=(_hp&&typeof _hp==='object')?_hp:_hgtRaw;}else lc.height=_hgtRaw;}
        const _cl=q('#lc-color-low');if(_cl)lc.color_low=_cl.value;
        const _ch=q('#lc-color-high');if(_ch)lc.color_high=_ch.value;
        const _cbg=q('#lc-bg-off');if(_cbg)lc.bg_off=_cbg.value;
        tgt.light_controls=lc;
      }else delete tgt.light_controls;
    })();

    const _bmSrcs=[];
    self.querySelectorAll('[data-bm-src-ent]').forEach(function(el,i){
      const _s={entity:el.value.trim()};
      const _cc=self.querySelector('[data-bm-src-cond="'+i+'"]');
      const _ccR=self._pYaml(_cc);
      if(_ccR.ok){if(_ccR.val)_s.condition=_ccR.val;}
      else{const _oldS=(self._roomView().brightness_model?.source||[])[i];if(_oldS&&_oldS.condition)_s.condition=_oldS.condition;}
      const _at=self.querySelector('[data-bm-src-attr="'+i+'"]');
      if(_at&&_at.value.trim())_s.attribute=_at.value.trim();
      const _mn=self.querySelector('[data-bm-src-min="'+i+'"]');
      if(_mn)_s.min_input=parseFloat(_mn.value)||0;
      const _mx=self.querySelector('[data-bm-src-max="'+i+'"]');
      if(_mx)_s.max_input=parseFloat(_mx.value)||100;
      _bmSrcs.push(_s);
    });
    const _bmFg=[];
    self.querySelectorAll('[data-bm-fg-val]').forEach(function(el,i){
      const _v=parseFloat(el.value);if(isNaN(_v))return;
      const _fe=self.querySelector('[data-bm-fg-filt="'+i+'"]');
      if(_fe)_bmFg.push({value:_v,filter:_fe.value.trim()||'none'});
    });
    if(_bmSrcs.length||_bmFg.length)tgt.brightness_model={source:_bmSrcs,filter_gradient:_bmFg};
    else delete tgt.brightness_model;

    tgt.filter_conditions=[];
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
      let _ff=buildFilterStr(filters);
      // Preserve filter functions the sliders don't cover (grayscale, invert, drop-shadow, …)
      const _origFc=(self._roomView().filter_conditions||[])[i];
      if(_origFc&&_origFc.filter&&_origFc.filter!=='none'){
        const _known=FILTER_PROPS.map(function(p){return p.key;});
        const _extras=(String(_origFc.filter).match(/[a-z-]+\((?:[^()]|\([^()]*\))*\)/g)||[]).filter(function(f){return!_known.includes(f.slice(0,f.indexOf('(')));});
        if(_extras.length)_ff=(_ff==='none'?'':_ff+' ')+_extras.join(' ');
      }
      entry.filter=_ff;
      tgt.filter_conditions.push(entry);
    });
    // Unified filter section: the mode toggle is authoritative — keep only the
    // active mode's data so it actually takes effect at runtime (brightness_model
    // otherwise always wins over filter_conditions).
    const _fMode=(q('#filter-mode')&&q('#filter-mode').value)||(tgt.brightness_model?'smooth':'conditional');
    if(_fMode==='smooth'){delete tgt.filter_conditions;}
    else{delete tgt.brightness_model;if(!tgt.filter_conditions.length)delete tgt.filter_conditions;}

    tgt.overlays=(tgt.overlays||[]).map(function(ov,i){
      const o=Object.assign({},ov);
      const idEl=q('[data-ov-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const imgEl=q('[data-ov-img="'+i+'"]');if(imgEl){if(imgEl.value)o.image=imgEl.value;else delete o.image;}
      const trEl=q('[data-ov-tr="'+i+'"]');if(trEl)o.transition=trEl.value;const animOvEl=q('[data-ov-anim="'+i+'"]');if(animOvEl&&animOvEl.value)o.animation=animOvEl.value;else delete o.animation;
      const grpEl=q('[data-ov-grp="'+i+'"]');if(grpEl&&grpEl.value.trim())o.group=grpEl.value.trim();else delete o.group;
      const tfModeEl=q('[data-ov-tf-mode="'+i+'"]');
      if(tfModeEl){
        const tfMode=tfModeEl.value;
        if(!tfMode)delete o.transform;
        else{
          const gv=function(k){const e=q('[data-ov-tf-'+k+'="'+i+'"]');return e?String(e.value).trim():'';};
          const tf={};
          const _e1=gv('ent');if(_e1)tf.entity=_e1;
          const _a1=gv('attr');if(_a1)tf.attribute=_a1;
          const _o1=gv('origin');if(_o1)tf.origin=_o1;
          const _t1=gv('tr');if(_t1)tf.transition=_t1;
          const _p1=gv('persp');if(_p1)tf.perspective=_p1;
          if(tfMode==='states'){
            const mp={};
            self.querySelectorAll('[data-ov-tfk]').forEach(function(kEl){
              const parts=String(kEl.dataset.ovTfk).split('-');
              if(parts[0]!==String(i))return;
              const vEl=self.querySelector('[data-ov-tfv="'+kEl.dataset.ovTfk+'"]');
              const k=kEl.value.trim();
              if(k&&vEl&&vEl.value.trim())mp[k]=vEl.value.trim();
            });
            if(Object.keys(mp).length)tf.map=mp;
          }else if(tfMode==='range'){
            tf.from={value:Number(gv('fv')||0),transform:gv('ft')||'none'};
            tf.to={value:Number(gv('tv')||100),transform:gv('tt')||'none'};
          }else if(tfMode==='spin'){
            const sp={};
            const _s1=gv('smin');if(_s1)sp.min_duration=_s1;
            const _s2=gv('smax');if(_s2)sp.max_duration=_s2;
            const _s3=gv('saxis');if(_s3&&_s3!=='z')sp.axis=_s3;
            const _s4=q('[data-ov-tf-srev="'+i+'"]');if(_s4&&_s4.checked)sp.reverse=true;
            tf.spin=sp;
          }
          o.transform=tf;
        }
      }
      const yaR=self._pYaml(q('[data-ov-yaml="'+i+'"]'));
      if(yaR.ok){
        const p=yaR.val;
        if(p){
          // state_images lives on the overlay root, opacity/filter under conditions
          if(p.opacity||p.filter){o.conditions={};if(p.opacity)o.conditions.opacity=p.opacity;if(p.filter)o.conditions.filter=p.filter;}
          else delete o.conditions;
          if(p.state_images)o.state_images=p.state_images;else delete o.state_images;
        }else{delete o.conditions;delete o.state_images;}
      }
      return o;
    });

    tgt.zones=(tgt.zones||[]).map(function(z,i){
      const o=Object.assign({},z);
      const idEl=q('[data-z-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-z-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-z-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-z-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-z-h="'+i+'"]');if(hEl)o.height=hEl.value;
      self._applyActs('z:'+i,o);
      const hdelEl=q('[data-z-hdelay="'+i+'"]');
      if(hdelEl&&hdelEl.value&&parseInt(hdelEl.value)!==500)o.hold_delay=parseInt(hdelEl.value);else delete o.hold_delay;
      const visR=self._pYaml(q('[data-z-vis="'+i+'"]'));
      if(visR.ok){if(visR.val)o.visible=visR.val;else delete o.visible;}
      const slR=self._pYaml(q('[data-z-slider="'+i+'"]'));
      if(slR.ok){if(slR.val&&slR.val.entity)o.slider=slR.val;else delete o.slider;}
      const zGrpEl=q('[data-z-grp="'+i+'"]');if(zGrpEl&&zGrpEl.value.trim())o.group=zGrpEl.value.trim();else if(zGrpEl)delete o.group;
      _secTile('z',i,o);
      return o;
    });

    tgt.badges=(tgt.badges||[]).map(function(b,i){
      const o=Object.assign({},b);
      const idEl=q('[data-b-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const posEl=q('[data-b-pos="'+i+'"]');if(posEl)o.position=posEl.value;
      const iconEl=q('[data-b-icon="'+i+'"]');if(iconEl){if(iconEl.value)o.icon=iconEl.value;else delete o.icon;}
      const bxEl=q('[data-b-x="'+i+'"]');if(bxEl){if(bxEl.value.trim())o.x=bxEl.value.trim();else delete o.x;}
      const byEl=q('[data-b-y="'+i+'"]');if(byEl){if(byEl.value.trim())o.y=byEl.value.trim();else delete o.y;}const bAnimEl=q('[data-b-anim="'+i+'"]');if(bAnimEl&&bAnimEl.value)o.animation=bAnimEl.value;else delete o.animation;const bAcEl=q('[data-b-ac="'+i+'"]');if(bAcEl&&bAcEl.value&&o.animation)o.animation_color=self._colorVal(bAcEl,b.animation_color);else delete o.animation_color;
      const yaR=self._pYaml(q('[data-b-yaml="'+i+'"]'));
      if(yaR.ok){
        // The YAML textarea owns every key except those with dedicated fields —
        // keys removed from the textarea are removed from the config too.
        const KEEP=['id','icon','position','x','y','animation','animation_color'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      // nav_mini has its own dedicated checkbox (like every other item type) —
      // it must be applied AFTER the YAML merge so it wins, not before (it
      // used to run before the merge, so unchecking "Hide from mini" did
      // nothing until the YAML box was also touched).
      const bNmEl=q('[data-b-nav-mini="'+i+'"]');self._navMiniSet(bNmEl,o);
      return o;
    });

    tgt.elements=(tgt.elements||[]).map(function(el,i){
      const o=Object.assign({},el);
      const idEl=q('[data-el-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-el-top="'+i+'"]');if(topEl&&topEl.value.trim()){o.top=topEl.value.trim();delete o.bottom;}else delete o.top;
      const botEl=q('[data-el-bot="'+i+'"]');if(botEl&&botEl.value.trim()){o.bottom=botEl.value.trim();delete o.top;}else delete o.bottom;
      const lefEl=q('[data-el-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-el-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-el-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const yaR=self._pYaml(q('[data-el-yaml="'+i+'"]'));
      if(yaR.ok){
        for(const k of Object.keys(o))if(!EL_DEDICATED_KEYS.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const elGrpEl=q('[data-el-grp="'+i+'"]');if(elGrpEl&&elGrpEl.value.trim())o.group=elGrpEl.value.trim();else delete o.group;
      const elNmEl=q('[data-el-nav-mini="'+i+'"]');self._navMiniSet(elNmEl,o);
      _secTile('el',i,o);
      return o;
    });

    tgt.icons=(tgt.icons||[]).map(function(ico,i){
      const o=Object.assign({},ico);
      const idEl=q('[data-ico-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const iconEl=q('[data-ico-icon="'+i+'"]');if(iconEl)o.icon=iconEl.value;
      const sizeEl=q('[data-ico-size="'+i+'"]');if(sizeEl){const _sz=sizeEl.value.trim();if(_sz&&_sz!=='20px')o.size=_sz;else delete o.size;}
      const zEl=q('[data-ico-z="'+i+'"]');if(zEl&&zEl.value)o.z_index=parseInt(zEl.value);
      const topEl=q('[data-ico-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-ico-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const hdelEl=q('[data-ico-hdelay="'+i+'"]');
      if(hdelEl&&hdelEl.value&&parseInt(hdelEl.value)!==500)o.hold_delay=parseInt(hdelEl.value);else delete o.hold_delay;
      const bgEl=q('[data-ico-bg="'+i+'"]');if(bgEl&&bgEl.value.trim())o.background=bgEl.value.trim();else delete o.background;
      const chipEl=q('[data-ico-chip="'+i+'"]');if(chipEl){if(chipEl.checked)o.chip=true;else delete o.chip;}
      const colorR=self._pYaml(q('[data-ico-color="'+i+'"]'));
      if(colorR.ok){if(colorR.val)o.color=colorR.val;else delete o.color;}
      const visR=self._pYaml(q('[data-ico-vis="'+i+'"]'));
      if(visR.ok){if(visR.val)o.visible=visR.val;else delete o.visible;}
      self._applyActs('ico:'+i,o);
      const icoGrpEl=q('[data-ico-grp="'+i+'"]');if(icoGrpEl&&icoGrpEl.value.trim())o.group=icoGrpEl.value.trim();else delete o.group;
      const icoNmEl=q('[data-ico-nav-mini="'+i+'"]');self._navMiniSet(icoNmEl,o);
      _secTile('ico',i,o);
      return o;
    });


    tgt.vacuum_widgets=(tgt.vacuum_widgets||[]).map(function(vw,i){
      const o=Object.assign({},vw);
      const idEl=q('[data-vw-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const iconEl=q('[data-vw-icon="'+i+'"]');if(iconEl){if(iconEl.value.trim())o.icon=iconEl.value.trim();else delete o.icon;}
      const sizeEl=q('[data-vw-size="'+i+'"]');if(sizeEl){const _sz=sizeEl.value.trim();if(_sz&&_sz!=='44px')o.size=_sz;else delete o.size;}
      const zEl=q('[data-vw-z="'+i+'"]');if(zEl&&zEl.value)o.z_index=parseInt(zEl.value);
      const topEl=q('[data-vw-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-vw-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const vwGrpEl=q('[data-vw-grp="'+i+'"]');if(vwGrpEl&&vwGrpEl.value.trim())o.group=vwGrpEl.value.trim();else delete o.group;
      const yaR=self._pYaml(q('[data-vw-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','icon','size','z_index','top','left','group','vacuums'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const vwVacs=[];
      self.querySelectorAll('[data-vw-vac^="'+i+'-"]').forEach(function(inp){
        const ent=inp.value.trim();if(ent)vwVacs.push({entity:ent});
      });
      if(vwVacs.length)o.vacuums=vwVacs;else delete o.vacuums;
      return o;
    });

    tgt.glows=(tgt.glows||[]).map(function(g,i){
      const o=Object.assign({},g);
      const idEl=q('[data-gw-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const entEl=q('[data-gw-ent="'+i+'"]');if(entEl){if(entEl.value.trim())o.entity=entEl.value.trim();else delete o.entity;}
      const shEl=q('[data-gw-shape="'+i+'"]');if(shEl){if(shEl.value&&shEl.value!=='circle')o.shape=shEl.value;else delete o.shape;}
      const szEl=q('[data-gw-size="'+i+'"]');if(szEl){const _v=szEl.value.trim();if(_v)o.size=_v;else delete o.size;}
      const wEl=q('[data-gw-w="'+i+'"]');if(wEl){const _v=wEl.value.trim();if(_v)o.width=_v;else delete o.width;}
      const hEl=q('[data-gw-h="'+i+'"]');if(hEl){const _v=hEl.value.trim();if(_v)o.height=_v;else delete o.height;}
      const tEl=q('[data-gw-top="'+i+'"]');if(tEl)o.top=tEl.value;
      const lEl=q('[data-gw-left="'+i+'"]');if(lEl)o.left=lEl.value;
      const inEl=q('[data-gw-int="'+i+'"]');if(inEl&&inEl.value!==''){const _n=parseFloat(inEl.value);if(!isNaN(_n))o.intensity=_n;}
      const foEl=q('[data-gw-fall="'+i+'"]');if(foEl){if(foEl.value&&foEl.value!=='soft')o.falloff=foEl.value;else delete o.falloff;}
      const blEl=q('[data-gw-blend="'+i+'"]');if(blEl){if(blEl.value&&blEl.value!=='screen')o.blend=blEl.value;else delete o.blend;}
      const coEl=q('[data-gw-color="'+i+'"]');if(coEl){const _v=coEl.value.trim();if(_v&&_v!=='auto')o.color=_v;else delete o.color;}
      const anEl=q('[data-gw-anim="'+i+'"]');if(anEl){if(anEl.value)o.animation=anEl.value;else delete o.animation;}
      const agEl=q('[data-gw-angle="'+i+'"]');if(agEl){const _v=agEl.value.trim();if(_v)o.angle=isNaN(parseFloat(_v))?_v:parseFloat(_v);else delete o.angle;}
      const zEl=q('[data-gw-z="'+i+'"]');if(zEl&&zEl.value)o.z_index=parseInt(zEl.value);
      const mbEl=q('[data-gw-minb="'+i+'"]');if(mbEl){const _mb=mbEl.value.trim();if(_mb!==''&&Number(_mb)>0)o.min_brightness=parseInt(_mb);else delete o.min_brightness;}
      const asEl=q('[data-gw-aspeed="'+i+'"]');if(asEl){const _as=asEl.value.trim();if(_as)o.animation_speed=_as;else delete o.animation_speed;}
      const anEl2=q('[data-gw-anchor="'+i+'"]');if(anEl2){if(anEl2.value==='corner')o.anchor='corner';else delete o.anchor;}
      const trEl=q('[data-gw-trans="'+i+'"]');if(trEl){const _tr=trEl.value.trim();if(_tr)o.transition=_tr;else delete o.transition;}
      const grEl=q('[data-gw-grp="'+i+'"]');if(grEl&&grEl.value.trim())o.group=grEl.value.trim();else delete o.group;
      const gyR=self._pYaml(q('[data-gw-yaml="'+i+'"]'));
      if(gyR.ok){
        const KEEP=['id','entity','shape','size','width','height','top','left','intensity','falloff','blend','color','animation','angle','z_index','group',
                    'min_brightness','animation_speed','anchor','transition'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(gyR.val)Object.assign(o,gyR.val);
      }
      return o;
    });


    tgt.labels=(tgt.labels||[]).map(function(lbl,i){
      const o=Object.assign({},lbl);
      const idEl=q('[data-lbl-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-lbl-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-lbl-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const entEl=q('[data-lbl-entity="'+i+'"]');if(entEl)o.entity=entEl.value;
      const atEl=q('[data-lbl-attr="'+i+'"]');if(atEl){if(atEl.value.trim())o.attribute=atEl.value.trim();else delete o.attribute;}
      const sfxEl=q('[data-lbl-suffix="'+i+'"]');if(sfxEl){if(sfxEl.value)o.suffix=sfxEl.value;else delete o.suffix;}const lblAnimEl=q('[data-lbl-anim="'+i+'"]');if(lblAnimEl&&lblAnimEl.value)o.animation=lblAnimEl.value;else delete o.animation;const lblAcEl=q('[data-lbl-ac="'+i+'"]');if(lblAcEl&&lblAcEl.value&&o.animation)o.animation_color=self._colorVal(lblAcEl,lbl.animation_color);else delete o.animation_color;
      const tmplEl=q('[data-lbl-tmpl="'+i+'"]');
      if(tmplEl){if(tmplEl.value.trim())o.template=tmplEl.value.trim();else delete o.template;}
      const yaR=self._pYaml(q('[data-lbl-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','entity','attribute','suffix','unit','color_gradient','animation','animation_color','group','template','nav_mini'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const lblGradStops=[];
      self.querySelectorAll('[data-l-lv^="'+i+'-"]').forEach(function(inp){
        const j=inp.dataset.lLv.split('-')[1];
        const cInp=self.querySelector('[data-l-lc="'+i+'-'+j+'"]');
        if(cInp){const v=parseFloat(inp.value);if(!isNaN(v))lblGradStops.push({value:v,color:self._colorVal(cInp,(lbl.color_gradient||[])[parseInt(j)]?.color)});}
      });
      if(lblGradStops.length)o.color_gradient=lblGradStops.sort((a,b)=>a.value-b.value);
      else delete o.color_gradient;
      const lblGrpEl=q('[data-lbl-grp="'+i+'"]');if(lblGrpEl&&lblGrpEl.value.trim())o.group=lblGrpEl.value.trim();else delete o.group;
      const lblNmEl=q('[data-lbl-nav-mini="'+i+'"]');self._navMiniSet(lblNmEl,o);
      return o;
    });

    tgt.gauges=(tgt.gauges||[]).map(function(g,i){
      const o=Object.assign({},g);
      const idEl=q('[data-g-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-g-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-g-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-g-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-g-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const entEl=q('[data-g-entity="'+i+'"]');if(entEl)o.entity=entEl.value;
      const atEl=q('[data-g-attr="'+i+'"]');if(atEl){if(atEl.value.trim())o.attribute=atEl.value.trim();else delete o.attribute;}
      const minEl=q('[data-g-min="'+i+'"]');if(minEl){const _gmn=parseFloat(minEl.value);if(isNaN(_gmn)||_gmn===0)delete o.min;else o.min=_gmn;}
      const maxEl=q('[data-g-max="'+i+'"]');if(maxEl){const _gmx=parseFloat(maxEl.value);if(isNaN(_gmx)||_gmx===100)delete o.max;else o.max=_gmx;}const orientEl=q('[data-g-orient="'+i+'"]');if(orientEl&&orientEl.value&&orientEl.value!=='vertical')o.orientation=orientEl.value;else if(orientEl&&orientEl.value==='vertical')delete o.orientation;else delete o.orientation;
      const yaR=self._pYaml(q('[data-g-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','width','height','entity','attribute','min','max','color_gradient','animation','animation_color','alert_conditions','orientation','group','nav_mini'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const gradStops=[];
      self.querySelectorAll('[data-g-gv^="'+i+'-"]').forEach(function(inp){
        const j=inp.dataset.gGv.split('-')[1];
        const cInp=self.querySelector('[data-g-gc="'+i+'-'+j+'"]');
        if(cInp){const v=parseFloat(inp.value);if(!isNaN(v))gradStops.push({value:v,color:self._colorVal(cInp,(g.color_gradient||[])[parseInt(j)]?.color)});}
      });
      if(gradStops.length)o.color_gradient=gradStops.sort((a,b)=>a.value-b.value);
      else delete o.color_gradient;
      const gAnimEl=q('[data-g-anim="'+i+'"]');if(gAnimEl&&gAnimEl.value)o.animation=gAnimEl.value;else delete o.animation;
      const gAcEl=q('[data-g-ac="'+i+'"]');if(gAcEl&&gAcEl.value&&o.animation)o.animation_color=self._colorVal(gAcEl,g.animation_color);else delete o.animation_color;
      const gAlertEntEl=q('[data-g-alert-ent="'+i+'"]');const gAlertOpEl=q('[data-g-alert-op="'+i+'"]');const gAlertValEl=q('[data-g-alert-val="'+i+'"]');
      const gAlertAttrEl=q('[data-g-alert-attr="'+i+'"]');
      if(gAlertEntEl&&gAlertEntEl.value.trim()&&gAlertOpEl&&gAlertOpEl.value&&gAlertValEl&&gAlertValEl.value.trim()){const _ac={entity:gAlertEntEl.value.trim(),operator:gAlertOpEl.value,value:parseFloat(gAlertValEl.value)};if(gAlertAttrEl&&gAlertAttrEl.value.trim())_ac.attribute=gAlertAttrEl.value.trim();o.alert_conditions=_ac;}else delete o.alert_conditions;
      const gGrpEl=q('[data-g-grp="'+i+'"]');if(gGrpEl&&gGrpEl.value.trim())o.group=gGrpEl.value.trim();else delete o.group;
      const gNmEl=q('[data-g-nav-mini="'+i+'"]');self._navMiniSet(gNmEl,o);
      return o;
    });
    tgt.blinds=(tgt.blinds||[]).map(function(b,i){
      const o=Object.assign({},b);
      const idEl=q('[data-bl-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const topEl=q('[data-bl-top="'+i+'"]');if(topEl)o.top=topEl.value;
      const lefEl=q('[data-bl-left="'+i+'"]');if(lefEl)o.left=lefEl.value;
      const wEl=q('[data-bl-w="'+i+'"]');if(wEl)o.width=wEl.value;
      const hEl=q('[data-bl-h="'+i+'"]');if(hEl)o.height=hEl.value;
      const zEl=q('[data-bl-z="'+i+'"]');if(zEl&&zEl.value)o.z_index=parseInt(zEl.value)||6;else delete o.z_index;
      const entEl=q('[data-bl-entity="'+i+'"]');if(entEl)o.entity=entEl.value;
      const atEl=q('[data-bl-attr="'+i+'"]');if(atEl){if(atEl.value.trim())o.attribute=atEl.value.trim();else delete o.attribute;}
      const minEl=q('[data-bl-min="'+i+'"]');if(minEl){const _bmn=parseFloat(minEl.value);if(isNaN(_bmn)||_bmn===0)delete o.min;else o.min=_bmn;}
      const maxEl=q('[data-bl-max="'+i+'"]');if(maxEl){const _bmx=parseFloat(maxEl.value);if(isNaN(_bmx)||_bmx===100)delete o.max;else o.max=_bmx;}
      const toEl=q('[data-bl-top-offset="'+i+'"]');if(toEl){const _bto=parseFloat(toEl.value);if(isNaN(_bto)||_bto===0)delete o.top_offset;else o.top_offset=_bto;}
      const typeEl=q('[data-bl-type="'+i+'"]');if(typeEl)o.blind_type=typeEl.value;else o.blind_type='roller';
      const scEl=q('[data-bl-slat-color="'+i+'"]');if(scEl&&scEl.value.trim())o.slat_color=scEl.value.trim();else delete o.slat_color;
      const scntEl=q('[data-bl-slat-count="'+i+'"]');if(scntEl&&scntEl.value)o.slat_count=parseInt(scntEl.value,10)||6;else delete o.slat_count;
      // day_night phase calibration — the fields only exist for blind_type:day_night,
      // so an absent element means "drop the key" (same pattern as slat_count above),
      // which keeps stale keys out of the config after switching the blind type.
      const stuEl=q('[data-bl-shift-turns="'+i+'"]');const _stu=stuEl?parseFloat(stuEl.value):NaN;if(!isNaN(_stu))o.shift_turns=_stu;else delete o.shift_turns;
      const staEl=q('[data-bl-shift-start="'+i+'"]');const _sta=staEl?parseFloat(staEl.value):NaN;if(!isNaN(_sta)&&_sta!==0)o.shift_start=_sta;else delete o.shift_start;
      const ssnEl=q('[data-bl-shift-snap="'+i+'"]');if(ssnEl&&!ssnEl.checked)o.shift_snap=false;else delete o.shift_snap;
      const slgEl=q('[data-bl-shift-legacy="'+i+'"]');if(slgEl&&slgEl.checked)o.shift_legacy=true;else delete o.shift_legacy;
      const swEl=q('[data-bl-slat-w="'+i+'"]');if(swEl&&swEl.value)o.slat_width=parseFloat(swEl.value)||7;else delete o.slat_width;
      const sgEl=q('[data-bl-slat-g="'+i+'"]');if(sgEl&&sgEl.value)o.slat_gap=parseFloat(sgEl.value)||6;else delete o.slat_gap;
      const gcEl=q('[data-bl-gap-color="'+i+'"]');if(gcEl&&gcEl.value.trim())o.gap_color=gcEl.value.trim();else delete o.gap_color;
      const yaR=self._pYaml(q('[data-bl-yaml="'+i+'"]'));
      if(yaR.ok){
        const KEEP=['id','top','left','width','height','entity','attribute','min','max','top_offset','z_index','blind_type','slat_color','slat_count','shift_turns','shift_start','shift_snap','shift_legacy','slat_width','slat_gap','gap_color','slat_pitch','group','nav_mini'];
        for(const k of Object.keys(o))if(!KEEP.includes(k))delete o[k];
        if(yaR.val)Object.assign(o,yaR.val);
      }
      const blGrpEl=q('[data-bl-grp="'+i+'"]');if(blGrpEl&&blGrpEl.value.trim())o.group=blGrpEl.value.trim();else delete o.group;
      const blNmEl=q('[data-bl-nav-mini="'+i+'"]');self._navMiniSet(blNmEl,o);
      const _ccDispEl=q('[data-bl-ccdisp="'+i+'"]');
      if(_ccDispEl&&_ccDispEl.value&&_ccDispEl.value!=='off'){
        const _ctl={placement:_ccDispEl.value==='dock'?'dock':'float'};
        // dock_side deliberately NOT written (v5.10.1) — see the note in
        // _blindItem. An existing key in an older config is simply dropped the
        // next time the blind is saved from the editor; the card ignored it
        // either way, so nothing changes visually.
        const _ccSlEl=q('[data-bl-ccslider="'+i+'"]');_ctl.slider=_ccSlEl?!!_ccSlEl.checked:true;
        const _ccTopEl=q('[data-bl-cctop="'+i+'"]');if(_ccTopEl&&_ccTopEl.value.trim())_ctl.top=_ccTopEl.value.trim();
        const _ccLeftEl=q('[data-bl-ccleft="'+i+'"]');if(_ccLeftEl&&_ccLeftEl.value.trim())_ctl.left=_ccLeftEl.value.trim();
        const _ccWEl=q('[data-bl-ccwidth="'+i+'"]');if(_ccWEl&&_ccWEl.value.trim())_ctl.width=_ccWEl.value.trim();
        const _ccPs=[];
        self.querySelectorAll('[data-ccp-row="'+i+'"]').forEach(function(row){
          const _gp=function(sel){const e=row.querySelector(sel);return e?String(e.value).trim():'';};
          const _pv=parseInt(_gp('[data-ccp-pos]'),10);if(isNaN(_pv))return;
          const _pp={position:Math.max(0,Math.min(100,_pv))};
          const _pi=_gp('[data-ccp-icon]');if(_pi)_pp.icon=_pi;
          const _pc=_gp('[data-ccp-color]');if(_pc)_pp.color=_pc;
          const _pn=_gp('[data-ccp-name]');if(_pn)_pp.name=_pn;
          _ccPs.push(_pp);
        });
        if(_ccPs.length)_ctl.presets=_ccPs;
        o.control=_ctl;
      }else{delete o.control;}
      _secTile('bl',i,o);
      return o;
    });

    tgt.groups=(tgt.groups||[]).map(function(g,i){
      const o=Object.assign({},g);
      const idEl=q('[data-grp-id="'+i+'"]');if(idEl)o.id=idEl.value;
      const visEl=q('[data-grp-vis="'+i+'"]');if(visEl)o.visible=visEl.checked;
      const gcEl=q('[data-grp-gc="'+i+'"]');if(gcEl&&gcEl.value.trim())o.grouping_code=parseInt(gcEl.value,10);else delete o.grouping_code;
      const yaR=self._pYaml(q('[data-grp-yaml="'+i+'"]'));
      if(yaR.ok){if(yaR.val&&yaR.val.style)o.style=yaR.val.style;else delete o.style;}
      return o;
    });

    // Cockpit sections (v6.8.0) — top-level, not room-scoped: always write to
    // `c`, never `tgt` (mirrors how `rooms` itself is card-level).
    c.sections=(c.sections||[]).map(function(sec,i){
      const o=Object.assign({},sec);
      const idEl=q('[data-sec-id="'+i+'"]');if(idEl&&idEl.value.trim())o.id=idEl.value.trim();
      const titleEl=q('[data-sec-title="'+i+'"]');if(titleEl&&titleEl.value.trim())o.title=titleEl.value;else delete o.title;
      const iconEl=q('[data-sec-icon="'+i+'"]');if(iconEl&&iconEl.value.trim())o.icon=iconEl.value.trim();else delete o.icon;
      const plEl=q('[data-sec-placement="'+i+'"]');if(plEl&&plEl.value&&plEl.value!=='sheet-right')o.placement=plEl.value;else delete o.placement;
      const sizeEl=q('[data-sec-size="'+i+'"]');if(sizeEl&&sizeEl.value.trim())o.size=sizeEl.value.trim();else delete o.size;
      const colEl=q('[data-sec-columns="'+i+'"]');if(colEl&&colEl.value&&parseInt(colEl.value,10)!==2)o.columns=parseInt(colEl.value,10)||2;else delete o.columns;
      const badgeEl=q('[data-sec-badge="'+i+'"]');if(badgeEl&&badgeEl.value==='none')o.badge='none';else delete o.badge;
      const subEl=q('[data-sec-subtitle="'+i+'"]');if(subEl&&subEl.value.trim())o.subtitle=subEl.value;else delete o.subtitle;
      const bdEl=q('[data-sec-backdrop="'+i+'"]');if(bdEl&&!bdEl.checked)o.backdrop=false;else delete o.backdrop;
      const vtR=self._pYaml(q('[data-sec-vt="'+i+'"]'),{scalar:true,template:true});
      if(vtR.ok){if(vtR.val!==undefined)o.visible_template=vtR.val;else delete o.visible_template;}
      const srcEl=q('[data-sec-source="'+i+'"]');
      if(srcEl&&srcEl.value==='card'){
        const cyR=self._pYaml(q('[data-sec-card-yaml="'+i+'"]'));
        if(cyR.ok&&cyR.val&&cyR.val.card)o.card=cyR.val.card;else if(cyR.ok)delete o.card;
        delete o.source;delete o.domain;
      }else if(srcEl&&srcEl.value==='auto'){
        delete o.card;
        o.source='auto';
        const domEl=q('[data-sec-domain="'+i+'"]');
        if(domEl&&domEl.value)o.domain=domEl.value;else delete o.domain;
      }else{
        delete o.card;delete o.source;delete o.domain;
      }
      const prevTiles=Array.isArray(sec.tiles)?sec.tiles:[];
      o.tiles=prevTiles.map(function(pt,ti){return _collectDeclTile(i,ti,pt);});
      if(!o.tiles.length)delete o.tiles;
      return o;
    }).filter(function(o){return o&&o.id;});
    if(!c.sections.length)delete c.sections;

    // ---- Multi-room meta + card-level multiroom fields ----------------------
    if(hasRooms){
      const ridEl=q('#room-id');if(ridEl&&ridEl.value.trim())tgt.id=ridEl.value.trim();
      const rnmEl=q('#room-name');if(rnmEl){if(rnmEl.value.trim())tgt.name=rnmEl.value.trim();else delete tgt.name;}
      const ricEl=q('#room-icon');if(ricEl){if(ricEl.value.trim())tgt.icon=ricEl.value.trim();else delete tgt.icon;}
      const ramEl=q('#room-area-match');
      if(ramEl){
        const vv=ramEl.value.split(',').map(function(x){return x.trim();}).filter(Boolean);
        if(vv.length)tgt.area_match=vv;else delete tgt.area_match;
      }
      const rchR=this._pYaml(q('#room-chips'));
      if(rchR.ok){if(rchR.val)tgt.chips=rchR.val;else delete tgt.chips;}
      this._ovCollect(q,tgt); // overview page / tile (v6.30.0)
      const reEl=q('#room_entity');
      if(reEl&&!(typeof c.room_entity==='object'&&c.room_entity)){ // object mapping is YAML-managed
        if(reEl.value.trim())c.room_entity=reEl.value.trim();else delete c.room_entity;
      }
      const fmEl=q('#follow_mode');
      if(fmEl){if(fmEl.value&&fmEl.value!=='always')c.follow_mode=fmEl.value;else delete c.follow_mode;}
      const rseEl=q('#room_state_entity');
      if(rseEl&&!(typeof c.room_state_entity==='object'&&c.room_state_entity)){
        if(rseEl.value.trim())c.room_state_entity=rseEl.value.trim();else delete c.room_state_entity;
      }
      const fhEl=q('#follow_hold');
      if(fhEl){const fv=parseFloat(fhEl.value);if(!isNaN(fv)&&fv>=0&&fv!==60)c.follow_hold=fv;else delete c.follow_hold;}
      const cidEl=q('#card_id');if(cidEl){if(cidEl.value.trim())c.card_id=cidEl.value.trim();else delete c.card_id;}
      // Navigation menu — structured fields (chips/cards stay YAML lists)
      const _oldNav=(this._config.nav&&typeof this._config.nav==='object')?this._config.nav:{};
      // Keys with no GUI field (dim_inactive, auto_breakpoint, …) survive a GUI
      // save — before v6.25.0 they were silently dropped here.
      const _NAV_GUI=['style','position','live','mini','height','width','mobile_height','wheel','follow_button','chips','cards','rows','cards_position'];
      const _navO={};
      for(const _nk in _oldNav)if(_NAV_GUI.indexOf(_nk)<0)_navO[_nk]=_oldNav[_nk];
      const _ns=v('nav-style','thumbnails');if(_ns&&_ns!=='thumbnails')_navO.style=_ns;
      const _np=v('nav-position','top');if(_np&&_np!=='top')_navO.position=_np;
      const _nlv=v('nav-live','');if(_nlv)_navO.live=_nlv;
      const _navMiniO={};
      const _nmtEl=q('#nav-mini-templates');if(_nmtEl&&_nmtEl.checked)_navMiniO.templates=true;
      const _nmcr=parseFloat(v('nav-mini-camera-refresh',''));if(!isNaN(_nmcr))_navMiniO.camera_refresh=_nmcr;
      const _nmwr=parseFloat(v('nav-mini-width-ref',''));if(!isNaN(_nmwr))_navMiniO.width_ref=_nmwr;
      if(Object.keys(_navMiniO).length)_navO.mini=_navMiniO;
      const _nh=v('nav-height','').trim();if(_nh)_navO.height=_nh;
      const _nw=v('nav-width','').trim();if(_nw)_navO.width=_nw;
      const _nmh=v('nav-mobile-height','').trim();if(_nmh)_navO.mobile_height=_nmh;
      // v6.25.0 thumbnail rows (per profile) + where the strip cards go
      const _nrClamp=function(x){x=parseInt(x,10);return x>1?Math.min(6,x):1;};
      const _nrP=_nrClamp(v('nav-rows-portrait','')),_nrL=_nrClamp(v('nav-rows-landscape',''));
      if(_nrP>1||_nrL>1)_navO.rows=(_nrP===_nrL)?_nrP:Object.assign({},_nrP>1?{portrait:_nrP}:{},_nrL>1?{landscape:_nrL}:{});
      const _ncp=v('nav-cards-pos','');
      if(_ncp==='side'||_ncp==='below')_navO.cards_position=_ncp;
      else if(_ncp==='__yaml'&&_oldNav.cards_position!==undefined)_navO.cards_position=_oldNav.cards_position;
      const _nwh=v('nav-wheel','');if(_nwh)_navO.wheel=_nwh;
      const _nfbEl=q('#nav-follow-btn');if(_nfbEl&&!_nfbEl.checked)_navO.follow_button=false;
      const _chR=this._pYaml(q('#nav-chips'));if(_chR.ok){if(_chR.val)_navO.chips=_chR.val;}else if(_oldNav.chips)_navO.chips=_oldNav.chips;
      const _cdR=this._pYaml(q('#nav-cards'));if(_cdR.ok){if(_cdR.val)_navO.cards=_cdR.val;}else if(_oldNav.cards)_navO.cards=_oldNav.cards;
      if(Object.keys(_navO).length)c.nav=_navO;else delete c.nav;
      const _usEl=q('#url-sync');
      if(_usEl){if(_usEl.checked){const _usk=v('url-sync-key','').trim();c.url_sync=_usk||true;}else delete c.url_sync;}
    }

    // Prune empty per-room arrays — keeps saved YAML minimal
    ['overlays','zones','badges','elements','icons','labels','gauges','vacuum_widgets','glows','blinds','groups','filter_conditions'].forEach(function(k){
      if(Array.isArray(tgt[k])&&!tgt[k].length)delete tgt[k];
    });

    return c;
  }

  _inp(s){return ' class="roc-in"'+(s?' style="'+s+'"':'');}

  _mvBtns(kind,i){
    const st='padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;margin-top:8px;margin-right:6px;';
    return'<button data-mv="'+kind+':'+i+':-1" title="Move up" style="'+st+'">&#9650;</button><button data-mv="'+kind+':'+i+':1" title="Move down" style="'+st+'">&#9660;</button>';
  }

  _condFields(prefix,i,c){
    // renders entity + op + val fields for a sub-condition (and/or)
    const entity=c&&c.entity?c.entity:'';
    const op=c?(c.state!==undefined?'state':c.state_not!==undefined?'state_not':c.operator||'state'):'state';
    const val=c?(c.state!==undefined?String(c.state):c.state_not!==undefined?String(c.state_not):c.value!==undefined?String(c.value):''):'';
    let h='<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:end;margin-bottom:6px;">';
    h+='<div><input type="text" list="roc-entities" data-filter-'+prefix+'-entity="'+i+'" placeholder="entity_id" value="'+this._e(entity)+'"'+this._inp('font-size:12px;')+'></div>';
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
    h+='<input type="text" list="roc-entities" data-filter-entity="'+i+'" placeholder="e.g. light.bedroom" value="'+this._e(entity)+'"'+this._inp('')+'></div>';
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
    const condView=Object.assign({},ov.conditions||{});
    if(ov.state_images)condView.state_images=ov.state_images;
    const condYaml=Object.keys(condView).length?_yaml.s(condView):'';
    const ovOpen=this._openPanels&&this._openPanels.has('ov-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="ov-'+i+'"'+(ovOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Overlay: '+this._e(ov.id||'ov_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-ov-id="'+i+'" type="text" value="'+this._e(ov.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Image URL</label><input data-ov-img="'+i+'" type="text" value="'+this._e(ov.image||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Transition</label><input data-ov-tr="'+i+'" type="text" value="'+this._e(ov.transition||'2s ease')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label>';
    h+='<select data-ov-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!ov.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(ov.animation==="pulse"?' selected':'')+'>pulse (fade in/out)</option>';
    h+='<option value="blink"'+(ov.animation==="blink"?' selected':'')+'>blink (hard on/off)</option>';
    h+='</select></div></div>';
    h+='<div><label class="roc-l">Conditions YAML (opacity / filter / state_images)</label>';
    h+='<textarea data-ov-yaml="'+i+'" rows="5"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(condYaml)+'</textarea></div>';
    h+=this._ovTransform(ov,i);
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-ov-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(ov.group||'')+'"'+this._inp('')+'></div>';
    h+=this._mvBtns('ov',i);
    h+='<button data-rm-ov="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove overlay</button>';
    h+='</div></details>';
    return h;
  }

  // Transform block inside an overlay panel — the movement engine's GUI.
  _ovTransform(ov,i){
    const tf=ov.transform||{};
    const mode=ov.transform?(tf.spin?'spin':((tf.from&&tf.to)?'range':(tf.map?'states':''))):'';
    const open=this._openPanels&&this._openPanels.has('ovtf-'+i);
    const pane=function(m){return'style="'+(mode===m?'':'display:none;')+'"';};
    let h='<details style="margin:8px 0;" data-panel="ovtf-'+i+'"'+(open?' open':'')+'>';
    h+='<summary style="cursor:pointer;padding:6px 8px;background:var(--secondary-background-color);border-radius:6px;font-size:12px;font-weight:500;list-style:none;">&#9654; Transform &mdash; make this layer move'+(mode?' <span style="opacity:0.7;">('+mode+')</span>':'')+'</summary>';
    h+='<div style="padding:8px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 8px;">Moves this overlay by an entity\'s state instead of only fading it &mdash; a door swinging on its hinge, a garage door sliding up, a fan spinning. Needs a PNG of just the moving part.</p>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Mode</label><select data-ov-tf-mode="'+i+'"'+this._inp('')+'>';
    [['','none'],['states','states → transform'],['range','numeric range'],['spin','continuous spin']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+(mode===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Entity</label><input data-ov-tf-ent="'+i+'" type="text" list="roc-entities" placeholder="cover.garage" value="'+this._e(tf.entity||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Attribute (blank = state)</label><input data-ov-tf-attr="'+i+'" type="text" placeholder="current_position" value="'+this._e(tf.attribute||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Origin — hinge/axle on the photo</label><input data-ov-tf-origin="'+i+'" type="text" placeholder="50% 50%" value="'+this._e(tf.origin||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div data-ov-tfpane="'+i+'-states" '+pane('states')+'>';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    h+='<label style="font-size:12px;font-weight:500;">State &rarr; transform</label>';
    h+='<button type="button" data-add-tfm="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ State</button>';
    h+='</div>';
    const keys=Object.keys(tf.map||{});
    keys.forEach(function(k,j){
      h+='<div style="display:grid;grid-template-columns:130px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';
      h+='<input type="text" data-ov-tfk="'+i+'-'+j+'" placeholder="on / * " value="'+escA(k)+'" class="roc-in">';
      h+='<input type="text" data-ov-tfv="'+i+'-'+j+'" placeholder="rotateY(-72deg)" value="'+escA(tf.map[k])+'" class="roc-in">';
      h+='<button type="button" data-rm-tfm="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';
      h+='</div>';
    });
    if(!keys.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 4px;">No states yet. <code>*</code> matches anything not listed.</p>';
    h+='</div>';
    const fr=tf.from||{},to=tf.to||{};
    h+='<div data-ov-tfpane="'+i+'-range" '+pane('range')+'>';
    h+='<div style="display:grid;grid-template-columns:80px 1fr;gap:8px;margin-bottom:6px;align-items:end;">';
    h+='<div><label class="roc-l">From value</label><input data-ov-tf-fv="'+i+'" type="number" placeholder="0" value="'+this._e(fr.value==null?'':String(fr.value))+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">… transform</label><input data-ov-tf-ft="'+i+'" type="text" placeholder="translateY(0%)" value="'+this._e(fr.transform||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">To value</label><input data-ov-tf-tv="'+i+'" type="number" placeholder="100" value="'+this._e(to.value==null?'':String(to.value))+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">… transform</label><input data-ov-tf-tt="'+i+'" type="text" placeholder="translateY(-92%)" value="'+this._e(to.transform||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 4px;">Both sides must use the same functions in the same order &mdash; the numbers in between are interpolated.</p>';
    h+='</div>';
    const sp=(tf.spin===true?{}:(tf.spin||{}));
    h+='<div data-ov-tfpane="'+i+'-spin" '+pane('spin')+'>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">';
    h+='<div><label class="roc-l">Fastest (at max)</label><input data-ov-tf-smin="'+i+'" type="text" placeholder="0.35s" value="'+this._e(sp.min_duration||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Slowest (just on)</label><input data-ov-tf-smax="'+i+'" type="text" placeholder="2.5s" value="'+this._e(sp.max_duration||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Axis</label><select data-ov-tf-saxis="'+i+'"'+this._inp('')+'>';
    [['z','flat (seen from the front)'],['x','tilted — X'],['y','tilted — Y']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+((sp.axis||'z')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Direction</label><label style="display:flex;align-items:center;gap:6px;font-size:12px;padding-top:6px;"><input type="checkbox" data-ov-tf-srev="'+i+'"'+(sp.reverse?' checked':'')+' style="width:15px;height:15px;">reverse</label></div>';
    h+='</div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">';
    h+='<div><label class="roc-l">Movement transition</label><input data-ov-tf-tr="'+i+'" type="text" placeholder="0.8s ease" value="'+this._e(tf.transition||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Perspective (3D depth)</label><input data-ov-tf-persp="'+i+'" type="text" placeholder="900px — for rotateX/Y" value="'+this._e(tf.perspective||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='</div></details>';
    return h;
  }

  // Per-element nav_mini checkbox (NAV_LIVE_FULL_PLAN.md §13, opt-in default
  // confirmed 2026-08-05; opt-out under 'full' added v6.15.0). Renders
  // nothing outside the two live-mini tiers — the field/data-attribute
  // simply won't exist in the DOM, so the generic collect loop naturally
  // skips writing/clearing it, leaving whatever nav_mini value the config
  // already had untouched (switching live modes back and forth never loses
  // a user's per-element choices). The checkbox's MEANING flips with the
  // tier: 'custom' is opt-in (checked = "show it"), 'full' is opt-out
  // (checked = "hide it") — matching each tier's own default of showing
  // nothing vs. showing everything. navMiniVal is the item's raw nav_mini
  // config value (undefined/true/false), not a pre-computed boolean, so
  // this can tell "unset" apart from an explicit false.
  _navMiniField(prefix,i,navMiniVal){
    const _live=this._config&&this._config.nav&&this._config.nav.live;
    if(_live!=='custom'&&_live!=='full')return'';
    const _isFull=_live==='full';
    const checked=_isFull?navMiniVal===false:navMiniVal===true;
    const label=_isFull?'Hide from nav.live: full mini':'Show in nav.live: custom mini';
    return '<div style="display:flex;align-items:center;gap:7px;margin-top:6px;"><input data-'+prefix+'-nav-mini="'+i+'" type="checkbox"'+(checked?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:12px;cursor:pointer;">'+label+'</label></div>';
  }
  // Collects one nav-mini checkbox's checked state into o.nav_mini, with the
  // same tier-dependent meaning _navMiniField renders (see above): 'full'
  // writes an explicit false (opt-out) when checked, 'custom' writes true
  // (opt-in); unchecked always deletes the field in both tiers, reverting to
  // that tier's default.
  _navMiniSet(el,o){
    if(!el)return;
    if(el.checked)o.nav_mini=(this._config&&this._config.nav&&this._config.nav.live==='full')?false:true;
    else delete o.nav_mini;
  }

  // Action builder (v6.18.0) — tap / double tap / hold actions as a type
  // select plus the few fields that type needs, instead of a raw YAML box.
  // Anything the builder doesn't model (fire-dom-event, browser-mod-popup,
  // conditional {condition,then,else}, unknown types) shows as "Custom
  // (YAML)" so nothing is lost. `key` is a composite owner key ("z:3",
  // "ico:0", "room", "tf:<tileKey>"); each row is `[data-act="key|slot"]`.
  // The action as rendered is stashed in this._actOrig so _collectAct() can
  // return it untouched when the row wasn't edited — an old `call-service`
  // action or extra keys (confirmation, data, …) never get rewritten just
  // because some other field in the editor changed.
  _actType(a){
    if(a===undefined||a===null||a==='')return'';
    if(typeof a!=='object'||Array.isArray(a)||'condition'in a)return'custom';
    const t=a.action;
    if(t==='call-service')return(a.service||a.perform_action)?'perform-action':'custom';
    return ROC_ACT_TYPES.some(function(x){return x[0]===t;})?t:'custom';
  }
  _actFieldsHtml(key,acts,opt){
    const self=this;
    opt=opt||{};
    const e=function(s){return self._e(s==null?'':String(s));};
    if(!this._actOrig)this._actOrig={};
    const c=this._config||{};
    const cR=(this._roomView&&this._roomView())||c;
    const secs=Array.isArray(c.sections)?c.sections:[];
    const rooms=Array.isArray(c.rooms)?c.rooms:[];
    const grpIds=[];
    [].concat(cR.groups||[],c.groups||[]).forEach(function(g){if(g&&g.id&&grpIds.indexOf(g.id)<0)grpIds.push(g.id);});
    const slots=opt.slots||['tap','double_tap','hold'];
    const names={tap:'Tap',double_tap:'Double tap',hold:'Hold'};
    const inS='font-size:12px;';
    const fld=function(label,inner,grow){return'<div style="flex:'+(grow||'1 1 150px')+';min-width:0;"><label class="roc-l" style="font-size:11px;margin-bottom:2px;">'+label+'</label>'+inner+'</div>';};
    const opts=function(list,cur){
      let o='';let found=false;
      list.forEach(function(x){if(x[0]===cur)found=true;o+='<option value="'+e(x[0])+'"'+(x[0]===cur?' selected':'')+'>'+e(x[1])+'</option>';});
      if(cur&&!found)o='<option value="'+e(cur)+'" selected>'+e(cur)+' (not found)</option>'+o;
      return o;
    };
    let h='<div data-act-box="'+e(key)+'" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;">';
    slots.forEach(function(slot){
      const a=acts?acts[slot]:undefined;
      self._actOrig[key+'|'+slot]=a===undefined?undefined:JSON.parse(JSON.stringify(a));
      const t=self._actType(a);
      const isCur=function(x){return t===x;};
      const A=(a&&typeof a==='object')?a:{};
      // values for the current type; other types start empty (or with the
      // owner's entity as a sensible default for more-info / toggle)
      const val=function(x,v,dflt){return isCur(x)?(v==null?'':v):(dflt||'');};
      const tgtEnt=(A.target&&typeof A.target==='object'&&!Array.isArray(A.target.entity_id))?(A.target.entity_id||''):(A.target&&Array.isArray(A.target.entity_id)?A.target.entity_id.join(', '):'');
      const dataObj=A.data!==undefined?A.data:A.service_data;
      const dataYaml=(isCur('perform-action')&&dataObj&&typeof dataObj==='object'&&Object.keys(dataObj).length)?_yaml.s(dataObj):'';
      const customYaml=isCur('custom')&&a!==undefined?_yaml.s(a):'';
      const ent=opt.entity||'';
      h+='<div data-act="'+e(key+'|'+slot)+'" style="display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;padding:6px 8px;border:1px solid var(--divider-color);border-radius:6px;">';
      h+=fld(e(opt.labels&&opt.labels[slot]||names[slot]),'<select data-act-type'+self._inp(inS)+'>'+ROC_ACT_TYPES.map(function(x){return'<option value="'+x[0]+'"'+(x[0]===t?' selected':'')+'>'+e(x[1])+'</option>';}).join('')+'</select>','1 1 170px');
      const grp=function(type,inner){return'<div data-act-fs="'+type+'" style="display:'+(t===type?'flex':'none')+';flex-wrap:wrap;gap:6px;flex:3 1 240px;min-width:0;">'+inner+'</div>';};
      h+=grp('more-info',fld('Entity','<input data-act-f="entity" type="text" list="roc-entities" placeholder="sensor.xyz" value="'+val('more-info',A.entity,ent)+'"'+self._inp(inS)+'>'));
      h+=grp('toggle',fld('Entity','<input data-act-f="entity" type="text" list="roc-entities" placeholder="light.xyz" value="'+val('toggle',A.entity,ent)+'"'+self._inp(inS)+'>'));
      h+=grp('navigate',fld('Path','<input data-act-f="navigation_path" type="text" placeholder="/lovelace/0" value="'+val('navigate',A.navigation_path!==undefined?A.navigation_path:A.path)+'"'+self._inp(inS)+'>'));
      h+=grp('url',fld('URL','<input data-act-f="url_path" type="text" placeholder="https://…" value="'+val('url',A.url_path!==undefined?A.url_path:A.url)+'"'+self._inp(inS)+'>'));
      h+=grp('perform-action',
        fld('Action (domain.service)','<input data-act-f="perform_action" type="text" placeholder="script.turn_on" value="'+val('perform-action',A.perform_action!==undefined?A.perform_action:A.service)+'"'+self._inp(inS)+'>')
        +fld('Target entity','<input data-act-f="target" type="text" list="roc-entities" placeholder="light.xyz" value="'+e(isCur('perform-action')?tgtEnt:'')+'"'+self._inp(inS)+'>')
        +fld('Data (YAML, optional)','<textarea data-act-f="data" data-act-yaml rows="2" placeholder="brightness_pct: 50"'+self._inp(inS+'font-family:monospace;resize:vertical;')+'>'+e(dataYaml)+'</textarea>','1 1 100%'));
      h+=grp('open-section',fld('Section','<select data-act-f="section"'+self._inp(inS)+'><option value="">— choose —</option>'+opts(secs.map(function(s){return[s.id||'',s.title||s.id||''];}),isCur('open-section')?(A.section||''):'')+'</select>'));
      h+=grp('switch-room',fld('Room','<select data-act-f="room"'+self._inp(inS)+'><option value="">— choose —</option>'+opts(rooms.map(function(r){return[r.id||'',r.name||r.id||''];}),isCur('switch-room')?(A.room==null?'':String(A.room)):'')+'</select>'));
      ['toggle-group','show-group','hide-group'].forEach(function(gt){
        h+=grp(gt,fld('Group','<select data-act-f="group"'+self._inp(inS)+'><option value="">— choose —</option>'+opts(grpIds.map(function(g){return[g,g];}),isCur(gt)?(A.group||''):'')+'</select>'));
      });
      h+=grp('custom',fld('Action (YAML)','<textarea data-act-f="yaml" data-act-yaml rows="3" placeholder="action: fire-dom-event&#10;browser_mod: …"'+self._inp(inS+'font-family:monospace;resize:vertical;')+'>'+e(customYaml)+'</textarea>','1 1 100%'));
      h+='</div>';
    });
    h+='</div>';
    return h;
  }
  // Read one builder row back. Returns {keep:true} when the row isn't on
  // screen or wasn't touched (caller leaves the config value alone), else
  // {val} — undefined meaning "remove the key".
  _collectAct(key,slot){
    const row=this.querySelector('[data-act="'+key+'|'+slot+'"]');
    if(!row)return{keep:true};
    const orig=this._actOrig?this._actOrig[key+'|'+slot]:undefined;
    const sel=row.querySelector('[data-act-type]');
    if(!sel)return{keep:true};
    const t=sel.value;
    const fs=row.querySelector('[data-act-fs="'+t+'"]');
    const fields=fs?Array.prototype.slice.call(fs.querySelectorAll('[data-act-f]')):[];
    const changed=function(el){
      if(el.tagName==='SELECT'){const o=el.options[el.selectedIndex];return!!o&&!o.defaultSelected;}
      return el.value!==el.defaultValue;
    };
    const selDirty=(function(){const o=sel.options[sel.selectedIndex];return!o||!o.defaultSelected;})();
    if(!selDirty&&!fields.some(changed))return{keep:false,val:orig===undefined?undefined:JSON.parse(JSON.stringify(orig))};
    if(t==='')return{val:undefined};
    const f=function(n){const el=fs&&fs.querySelector('[data-act-f="'+n+'"]');return el?el.value.trim():'';};
    if(t==='custom'){
      const r=this._pYaml(fs.querySelector('[data-act-f="yaml"]'));
      if(!r.ok)return{keep:true};
      return{val:r.val};
    }
    const base=(this._actType(orig)===t&&orig&&typeof orig==='object')?JSON.parse(JSON.stringify(orig)):{};
    const o=Object.assign({action:t},base);
    o.action=t;
    const setK=function(k,v){if(v)o[k]=v;else delete o[k];};
    switch(t){
      case'more-info':case'toggle':setK('entity',f('entity'));break;
      case'navigate':delete o.path;setK('navigation_path',f('navigation_path'));break;
      case'url':delete o.url;setK('url_path',f('url_path'));break;
      case'perform-action':{
        delete o.service;
        if(o.service_data!==undefined&&o.data===undefined)o.data=o.service_data;
        delete o.service_data;
        setK('perform_action',f('perform_action'));
        const tv=f('target');
        const tg=(o.target&&typeof o.target==='object')?Object.assign({},o.target):{};
        if(tv){const l=tv.split(',').map(function(x){return x.trim();}).filter(Boolean);tg.entity_id=l.length===1?l[0]:l;}
        else delete tg.entity_id;
        if(Object.keys(tg).length)o.target=tg;else delete o.target;
        const dr=this._pYaml(fs.querySelector('[data-act-f="data"]'));
        if(dr.ok){if(dr.val&&typeof dr.val==='object')o.data=dr.val;else delete o.data;}
      }break;
      case'open-section':setK('section',f('section'));break;
      case'switch-room':setK('room',f('room'));break;
      case'toggle-group':case'show-group':case'hide-group':setK('group',f('group'));break;
    }
    return{val:o};
  }
  // Apply every builder row of `key` onto obj (tap_action/double_tap_action/hold_action).
  _applyActs(key,obj,slots){
    const self=this;
    (slots||['tap','double_tap','hold']).forEach(function(slot){
      const r=self._collectAct(key,slot);
      if(r.keep)return;
      const k=slot+'_action';
      if(r.val!==undefined)obj[k]=r.val;else delete obj[k];
    });
  }
  _zoneItem(z,i){
    const visYaml=z.visible?_yaml.s(z.visible):'';
    const zOpen=this._openPanels&&this._openPanels.has('z-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="z-'+i+'"'+(zOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Zone: '+this._e(z.id||'zone_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-z-id="'+i+'" type="text" value="'+this._e(z.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top</label><input data-z-top="'+i+'" type="text" value="'+this._e(z.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-z-left="'+i+'" type="text" value="'+this._e(z.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Width</label><input data-z-w="'+i+'" type="text" value="'+this._e(z.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Height</label><input data-z-h="'+i+'" type="text" value="'+this._e(z.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">hold_delay (ms)</label><input data-z-hdelay="'+i+'" type="number" value="'+this._e(String(z.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+=this._actFieldsHtml('z:'+i,{tap:z.tap_action,double_tap:z.double_tap_action,hold:z.hold_action},{entity:z.slider&&z.slider.entity});
    h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;">';
    h+='<div><label class="roc-l">visible (YAML)</label><textarea data-z-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:8px;">';
    const sliderYaml=z.slider?_yaml.s(z.slider):'';
    h+='<div><label class="roc-l">slider (YAML — drag on zone sets light/cover/number; keys: entity, direction, live, min, max, color, invert)</label><textarea data-z-slider="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(sliderYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">Group (optional)</label><input data-z-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(z.group||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+=this._secTileHtml('z',i,z);
    h+=this._mvBtns('z',i);
    h+='<button data-dup-z="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-z="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove zone</button>';
    h+='</div></details>';
    return h;
  }

  _badgeItem(b,i){
    const bCopy=Object.assign({},b);delete bCopy.id;delete bCopy.icon;delete bCopy.position;delete bCopy.x;delete bCopy.y;delete bCopy.animation;delete bCopy.animation_color;delete bCopy.nav_mini;
    const bYaml=Object.keys(bCopy).length?_yaml.s(bCopy):'';
    const bOpen=this._openPanels&&this._openPanels.has('b-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="b-'+i+'"'+(bOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Badge: '+this._e(b.id||'badge_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-b-id="'+i+'" type="text" value="'+this._e(b.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Icon (mdi:...)</label><div style="display:flex;gap:6px;align-items:center;"><ha-icon data-roc-prev icon="'+this._e(b.icon||'')+'" style="--mdc-icon-size:20px;flex:none;color:var(--primary-text-color);"></ha-icon><input data-b-icon="'+i+'" type="text" value="'+this._e(b.icon||'')+'"'+this._inp('')+'></div></div>';
    h+='<div><label class="roc-l">Position</label>';
    h+='<select data-b-pos="'+i+'"'+this._inp('')+'>';
    const bp=b.position||'bottom-left';
    ['bottom-left','bottom-right','top-left','top-right','custom'].forEach(function(p){h+='<option value="'+p+'"'+(bp===p?' selected':'')+'>'+p+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">X (custom pos)</label><input data-b-x="'+i+'" type="text" placeholder="e.g. 30%" value="'+this._e(b.x||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Y (custom pos)</label><input data-b-y="'+i+'" type="text" placeholder="e.g. 15%" value="'+this._e(b.y||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label>';
    h+='<select data-b-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!b.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(b.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(b.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Animation color (glow)</label>';
    h+='<input type="color" data-b-ac="'+i+'" value="'+(b.animation_color?this._toHex(b.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div><label class="roc-l">label / visible / icon_color / tap_action / group (YAML)</label>';
    h+='<textarea data-b-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(bYaml)+'</textarea></div>';
    h+=this._navMiniField('b',i,b.nav_mini);
    h+=this._mvBtns('b',i);
    h+='<button data-rm-b="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove badge</button>';
    h+='</div></details>';
    return h;
  }

  _elItem(el,i){
    // Everything minus the fields with their own dedicated input — same
    // shape every other item type's YAML box uses (_lblItem/_gaugeItem/
    // _vwItem/_glowItem/_badgeItem). A whitelist here previously dropped
    // `portrait:`/`landscape:` (and any future key) the first time the
    // editor re-collected the config.
    const elCopy=Object.assign({},el);
    for(const k of EL_DEDICATED_KEYS)delete elCopy[k];
    const elYaml=Object.keys(elCopy).length?_yaml.s(elCopy):'';
    const elOpen=this._openPanels&&this._openPanels.has('el-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="el-'+i+'"'+(elOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Element: '+this._e(el.id||'el_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-el-id="'+i+'" type="text" value="'+this._e(el.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top (or use Bottom)</label><input data-el-top="'+i+'" type="text" placeholder="e.g. 10%" value="'+this._e(el.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Bottom (alternative to Top)</label><input data-el-bot="'+i+'" type="text" placeholder="e.g. 0%" value="'+this._e(el.bottom||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-el-left="'+i+'" type="text" value="'+this._e(el.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Width</label><input data-el-w="'+i+'" type="text" value="'+this._e(el.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Height</label><input data-el-h="'+i+'" type="text" value="'+this._e(el.height||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div><label class="roc-l">card / visible / visible_template / fade / slide / mobile / portrait / landscape / z_index / border_radius / overflow (YAML)</label>';
    h+='<textarea data-el-yaml="'+i+'" rows="6"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(elYaml)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-el-grp="'+i+'" type="text" placeholder="group id" value="'+this._e((typeof el.group==='string'?el.group:''))+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('el',i,el.nav_mini);
    h+=this._secTileHtml('el',i,el);
    h+=this._mvBtns('el',i);
    h+='<button data-dup-el="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-el="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove element</button>';
    h+='</div></details>';
    return h;
  }

  _icoItem(ico,i){
    const colorYaml=ico.color?_yaml.s(ico.color):'';
    const visYaml=ico.visible?_yaml.s(ico.visible):'';
    const icoOpen=this._openPanels&&this._openPanels.has('ico-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="ico-'+i+'"'+(icoOpen?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Icon: '+this._e(ico.id||'ico_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-ico-id="'+i+'" type="text" value="'+this._e(ico.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Icon (mdi:...)</label><div style="display:flex;gap:6px;align-items:center;"><ha-icon data-roc-prev icon="'+this._e(ico.icon||'')+'" style="--mdc-icon-size:20px;flex:none;color:var(--primary-text-color);"></ha-icon><input data-ico-icon="'+i+'" type="text" value="'+this._e(ico.icon||'')+'"'+this._inp('')+'></div></div>';
    h+='<div><label class="roc-l">Size (px or %)</label><input data-ico-size="'+i+'" type="text" placeholder="20px or 2%" value="'+this._e(ico.size||'20px')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">z-index</label><input data-ico-z="'+i+'" type="number" value="'+this._e(String(ico.z_index||6))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Background (circle, optional)</label><input data-ico-bg="'+i+'" type="text" placeholder="rgba(0,0,0,0.55)" value="'+this._e(ico.background||'')+'"'+this._inp('')+'></div>';
    h+='<div style="display:flex;align-items:center;gap:7px;padding-top:18px;"><input data-ico-chip="'+i+'" type="checkbox"'+(ico.chip?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:12px;cursor:pointer;">Chip style (frosted-glass circle, v6.12.1)</label></div>';
    h+='<div><label class="roc-l">Top</label><input data-ico-top="'+i+'" type="text" value="'+this._e(ico.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-ico-left="'+i+'" type="text" value="'+this._e(ico.left||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">hold_delay (ms)</label><input data-ico-hdelay="'+i+'" type="number" value="'+this._e(String(ico.hold_delay||500))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">color (YAML condition list)</label><textarea data-ico-color="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(colorYaml)+'</textarea></div>';
    h+='<div><label class="roc-l">visible (YAML condition)</label><textarea data-ico-vis="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(visYaml)+'</textarea></div>';
    h+='</div>';
    h+=this._actFieldsHtml('ico:'+i,{tap:ico.tap_action,double_tap:ico.double_tap_action,hold:ico.hold_action});
    h+='<div style="margin-bottom:6px;"><label class="roc-l">Group (optional)</label><input data-ico-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(ico.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('ico',i,ico.nav_mini);
    h+=this._secTileHtml('ico',i,ico);
    h+=this._mvBtns('ico',i);
    h+='<button data-dup-ico="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-ico="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove icon</button>';
    h+='</div></details>';
    return h;
  }

  _glowItem(g,i){
    const cp=Object.assign({},g);
    ['id','entity','shape','size','width','height','top','left','intensity','falloff','blend','color','animation','angle','z_index','group',
     'min_brightness','animation_speed','anchor','transition'].forEach(function(k){delete cp[k];});
    const ys=Object.keys(cp).length?_yaml.s(cp):'';
    const op=this._openPanels&&this._openPanels.has('gw-'+i);
    const sw=glowParseColor(g.color);
    const prevBg=glowBg(g,sw||GLOW_DEFAULT_RGB);
    let h='<details style="margin-bottom:6px;" data-panel="gw-'+i+'"'+(op?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Light glow: '+this._e(g.id||'glow_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 8px;">A soft pool of light blended onto the photo. Colour follows the light\'s own <code>rgb_color</code> / colour temperature and strength follows its brightness. <b>Top/Left is the centre</b> of the glow &mdash; in the preview above, drag it onto the lamp, then click it once and pull the round handle to resize.</p>';
    h+='<div style="height:26px;border-radius:6px;background:#101014;position:relative;overflow:hidden;margin-bottom:8px;"><div style="position:absolute;inset:0;background:'+prevBg+';"></div></div>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-gw-id="'+i+'" type="text" value="'+this._e(g.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Light / switch entity</label><input data-gw-ent="'+i+'" type="text" list="roc-ent-light_switch" placeholder="light.xyz" value="'+this._e(g.entity||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Shape</label><select data-gw-shape="'+i+'"'+this._inp('')+'>';
    [['circle','circle — lamp / bulb'],['ellipse','ellipse — LED strip / window'],['wash','wash — directional spill on a wall']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+((g.shape||'circle')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Size (px or % of width)</label><input data-gw-size="'+i+'" type="text" placeholder="25%" value="'+this._e(g.size||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Width (ellipse / wash)</label><input data-gw-w="'+i+'" type="text" placeholder="= size" value="'+this._e(g.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Height (ellipse / wash)</label><input data-gw-h="'+i+'" type="text" placeholder="= width" value="'+this._e(g.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top (centre)</label><input data-gw-top="'+i+'" type="text" value="'+this._e(g.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left (centre)</label><input data-gw-left="'+i+'" type="text" value="'+this._e(g.left||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    const gi=(g.intensity==null?0.7:g.intensity);
    h+='<div><label class="roc-l">Intensity (at full brightness)</label><div style="display:flex;gap:6px;align-items:center;">'
      +'<input type="range" data-gw-int-range="'+i+'" min="0" max="1" step="0.05" value="'+this._e(String(gi))+'" style="flex:1;min-width:0;cursor:pointer;">'
      +'<input data-gw-int="'+i+'" type="number" min="0" max="1" step="0.05" value="'+this._e(String(gi))+'"'+this._inp('width:62px;flex:none;font-size:12px;')+'></div></div>';
    h+='<div><label class="roc-l">Falloff</label><select data-gw-fall="'+i+'"'+this._inp('')+'>';
    [['soft','soft — natural lamp'],['tight','tight — small bright core'],['wide','wide — faint room fill']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+((g.falloff||'soft')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Blend</label><select data-gw-blend="'+i+'"'+this._inp('')+'>';
    [['screen','screen — light adds up (default)'],['plus-lighter','plus-lighter — stronger'],['soft-light','soft-light — subtle'],['normal','normal — plain paint']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+((g.blend||'screen')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    const swHex='#'+(sw||GLOW_DEFAULT_RGB).map(function(v){return('0'+Math.max(0,Math.min(255,v|0)).toString(16)).slice(-2);}).join('');
    h+='<div><label class="roc-l">Colour</label><div style="display:flex;gap:6px;align-items:center;">'
      +'<input type="color" data-gw-swatch="'+i+'" value="'+swHex+'" title="'+(sw?'Fixed colour':'Currently following the light &mdash; pick a colour to override it')+'" style="width:36px;height:31px;flex:none;padding:2px;border:1px solid '+(sw?'var(--divider-color)':'var(--primary-color)')+';border-radius:6px;background:none;cursor:pointer;'+(sw?'':'opacity:0.6;')+'">'
      +'<input data-gw-color="'+i+'" type="text" placeholder="auto" value="'+this._e(g.color||'')+'"'+this._inp('')+'>'
      +'<button type="button" data-gw-auto="'+i+'" title="Follow the light\'s own colour again" style="padding:6px 9px;border-radius:6px;border:1px solid '+(sw?'var(--divider-color)':'var(--primary-color)')+';background:'+(sw?'none':'rgba(3,169,244,0.15)')+';color:'+(sw?'var(--primary-text-color)':'var(--primary-color)')+';cursor:pointer;font-size:11px;flex:none;">Auto</button>'
      +'</div></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label><select data-gw-anim="'+i+'"'+this._inp('')+'>';
    [['','none'],['flicker','flicker — candle / fireplace'],['pulse','pulse — slow breathing']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+((g.animation||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Angle (wash only)</label><input data-gw-angle="'+i+'" type="text" placeholder="180deg = downward" value="'+this._e(g.angle==null?'':String(g.angle))+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">z-index</label><input data-gw-z="'+i+'" type="number" value="'+this._e(String(g.z_index??2))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Group (optional)</label><input data-gw-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(g.group||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Min brightness (0&ndash;255)</label><input data-gw-minb="'+i+'" type="number" min="0" max="255" step="1" placeholder="0" value="'+this._e(g.min_brightness==null?'':String(g.min_brightness))+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Animation speed</label><input data-gw-aspeed="'+i+'" type="text" placeholder="3.1s" value="'+this._e(g.animation_speed||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Anchor (Top/Left means&hellip;)</label><select data-gw-anchor="'+i+'"'+this._inp('')+'>';
    [['center','centre of the glow'],['corner','top-left corner']].forEach(function(o){
      h+='<option value="'+o[0]+'"'+((g.anchor||'center')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Fade transition</label><input data-gw-trans="'+i+'" type="text" placeholder="0.6s ease" value="'+this._e(g.transition||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 8px;">Colour <code>auto</code> follows the light. Fixed values also work: <code>#ffb46e</code>, <code>255,180,110</code> or <code>2700K</code>. z-index <b>2</b> keeps the glow under your overlay PNGs (curtains, furniture) &mdash; raise it to let light spill over them.</p>';
    h+='<div class="roc-adv"><label class="roc-l">fallback_color / border_radius / visible / visible_template / fade / slide / portrait / landscape overrides (YAML)</label><textarea data-gw-yaml="'+i+'" rows="5"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+=this._mvBtns('gw',i);
    h+='<button data-dup-gw="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-gw="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove glow</button>';
    h+='</div></details>';
    return h;
  }

  _vwItem(vw,i){
    const cp=Object.assign({},vw);
    delete cp.id;delete cp.top;delete cp.left;delete cp.icon;delete cp.size;delete cp.z_index;delete cp.group;delete cp.vacuums;
    const ys=Object.keys(cp).length?_yaml.s(cp):'';
    const op=this._openPanels&&this._openPanels.has('vw-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="vw-'+i+'"'+(op?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Vacuum widget: '+this._e(vw.id||'vac_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 8px;">Informational only — tap runs tap_action below, it does not control the vacuum. Drag the widget on the preview above to place it in any corner; Top/Left update automatically.</p>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-vw-id="'+i+'" type="text" value="'+this._e(vw.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Icon override (mdi:... — optional)</label><div style="display:flex;gap:6px;align-items:center;">'+(vw.icon?'<ha-icon data-roc-prev icon="'+this._e(vw.icon)+'" style="--mdc-icon-size:20px;flex:none;color:var(--primary-text-color);"></ha-icon>':'')+'<input data-vw-icon="'+i+'" type="text" placeholder="leave blank for the built-in vacuum icon" value="'+this._e(vw.icon||'')+'"'+this._inp('')+'></div></div>';
    h+='<div><label class="roc-l">Size (px or %)</label><input data-vw-size="'+i+'" type="text" placeholder="44px" value="'+this._e(vw.size||'44px')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">z-index</label><input data-vw-z="'+i+'" type="number" value="'+this._e(String(vw.z_index||7))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Top</label><input data-vw-top="'+i+'" type="text" value="'+this._e(vw.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-vw-left="'+i+'" type="text" value="'+this._e(vw.left||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="margin-bottom:8px;">';
    h+='<label class="roc-l">Quick position (fixed — no drag needed)</label>';
    h+='<div style="display:grid;grid-template-columns:repeat(3,32px);gap:4px;">';
    [['tl','&#8598;','Top-left'],['tc','&#8593;','Top-centre'],['tr','&#8599;','Top-right'],
     ['cl','&#8592;','Left-centre'],['cc','&#8226;','Centre'],['cr','&#8594;','Right-centre'],
     ['bl','&#8601;','Bottom-left'],['bc','&#8595;','Bottom-centre'],['br','&#8600;','Bottom-right']]
      .forEach(function(p){h+='<button type="button" data-vw-pos="'+i+':'+p[0]+'" title="'+p[2]+'" style="width:32px;height:32px;padding:0;border-radius:6px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:15px;line-height:1;">'+p[1]+'</button>';});
    h+='</div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Snaps Top/Left to a fixed corner, edge or centre based on the current Size — a reliable alternative if dragging the widget in the preview above misbehaves.</p>';
    h+='</div>';
    const vacs=vw.vacuums||[];
    h+='<div style="margin-bottom:8px;">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    h+='<label style="font-size:12px;font-weight:500;">Vacuums — status sensors (<code>sensor.*_status</code>, not <code>vacuum.*</code>)</label>';
    h+='<button data-add-vwv="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Entity</button>';
    h+='</div>';
    for(let j=0;j<vacs.length;j++){
      h+='<div style="display:grid;grid-template-columns:1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';
      h+='<input type="text" list="roc-entities" data-vw-vac="'+i+'-'+j+'" placeholder="sensor.xyz_status" value="'+this._e(vacs[j].entity||'')+'"'+this._inp('')+'>';
      h+='<button data-rm-vwv="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';
      h+='</div>';
    }
    if(!vacs.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No vacuums yet — add each vacuum\'s status sensor (device_class: enum — values like cleaning/segment_mopping/error…).</p>';
    h+='</div>';
    h+='<div><label class="roc-l">tap_action / hold_action / double_tap_action / visible / fade / slide / portrait / landscape overrides (YAML)</label><textarea data-vw-yaml="'+i+'" rows="7"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Example: <code>tap_action: {action: navigate, navigation_path: /...}</code>. Add a <code>portrait:</code> (or <code>landscape:</code>) block with its own size/top/left to override this widget on the phone layout.</p>';
    h+='<div style="margin-top:8px;"><label class="roc-l">Group (optional)</label><input data-vw-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(vw.group||'')+'"'+this._inp('')+'></div>';
    h+=this._mvBtns('vw',i);
    h+='<button data-dup-vw="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-vw="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove widget</button>';
    h+='</div></details>';
    return h;
  }

  _lblItem(lbl,i){const cp=Object.assign({},lbl);delete cp.id;delete cp.top;delete cp.left;delete cp.entity;delete cp.attribute;delete cp.suffix;delete cp.unit;delete cp.color_gradient;delete cp.animation;delete cp.animation_color;delete cp.alert_conditions;delete cp.orientation;delete cp.group;delete cp.template;const ys=Object.keys(cp).length?_yaml.s(cp):'';const op=this._openPanels&&this._openPanels.has('lbl-'+i);let h='<details style="margin-bottom:6px;" data-panel="lbl-'+i+'"'+(op?' open':'')+' >';h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Label: '+this._e(lbl.id||'lbl_'+i)+'</summary>';h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">ID</label><input data-lbl-id="'+i+'" type="text" value="'+this._e(lbl.id||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Top</label><input data-lbl-top="'+i+'" type="text" value="'+this._e(lbl.top||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Left</label><input data-lbl-left="'+i+'" type="text" value="'+this._e(lbl.left||'')+'"'+this._inp('')+'></div>';h+='</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">Entity</label><input type="text" list="roc-entities" data-lbl-entity="'+i+'" value="'+this._e(lbl.entity||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Attribute (optional)</label><input data-lbl-attr="'+i+'" type="text" value="'+this._e(lbl.attribute||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Suffix</label><input data-lbl-suffix="'+i+'" type="text" value="'+this._e(lbl.suffix||lbl.unit||'')+'"'+this._inp('')+'></div>';h+='</div>';const ls=lbl.color_gradient||[];h+='<div style="margin-bottom:8px;">';h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';h+='<label style="font-size:12px;font-weight:500;">Color gradient (smooth interpolation)</label>';h+='<button data-add-lg="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';h+='</div>';for(let j=0;j<ls.length;j++){const hex=this._toHex(ls[j].color);h+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';h+='<input type="number" data-l-lv="'+i+'-'+j+'" placeholder="value" value="'+ls[j].value+'"'+this._inp('font-size:12px;')+'>';h+='<input type="color" data-l-lc="'+i+'-'+j+'" value="'+hex+'" style="width:100%;height:30px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;">';h+='<button data-rm-lg="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';h+='</div>';}if(!ls.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No stops yet — add stops for smooth gradient, or use \'color\' in YAML for discrete conditions.</p>';h+='</div>';h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label>';
    h+='<select data-lbl-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!lbl.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(lbl.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(lbl.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Animation color (glow)</label>';
    h+='<input type="color" data-lbl-ac="'+i+'" value="'+(lbl.animation_color?this._toHex(lbl.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Template (Jinja — replaces entity value, e.g. {{ states(\'sensor.x\') | round(1) }})</label><textarea data-lbl-tmpl="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(lbl.template||'')+'</textarea></div>';
    h+='<div><label class="roc-l">font_size / color / visible / visible_template / format / tap_action / fade / mobile / z_index (YAML)</label>';h+='<textarea data-lbl-yaml="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-lbl-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(lbl.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('lbl',i,lbl.nav_mini);
    h+=this._mvBtns('lbl',i);
    h+='<button data-dup-lbl="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-lbl="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove label</button>';h+='</div></details>';return h;}

  _gaugeItem(g,i){const cp=Object.assign({},g);delete cp.id;delete cp.top;delete cp.left;delete cp.width;delete cp.height;delete cp.entity;delete cp.attribute;delete cp.min;delete cp.max;delete cp.color_gradient;delete cp.animation;delete cp.animation_color;delete cp.alert_conditions;delete cp.orientation;delete cp.group;const ys=Object.keys(cp).length?_yaml.s(cp):'';const op=this._openPanels&&this._openPanels.has('g-'+i);let h='<details style="margin-bottom:6px;" data-panel="g-'+i+'"'+(op?' open':'')+' >';h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Gauge: '+this._e(g.id||'gauge_'+i)+'</summary>';h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">ID</label><input data-g-id="'+i+'" type="text" value="'+this._e(g.id||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Top</label><input data-g-top="'+i+'" type="text" value="'+this._e(g.top||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Left</label><input data-g-left="'+i+'" type="text" value="'+this._e(g.left||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Width</label><input data-g-w="'+i+'" type="text" value="'+this._e(g.width||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Height</label><input data-g-h="'+i+'" type="text" value="'+this._e(g.height||'')+'"'+this._inp('')+'></div>';h+='</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';h+='<div><label class="roc-l">Entity</label><input type="text" list="roc-entities" data-g-entity="'+i+'" value="'+this._e(g.entity||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Attribute</label><input data-g-attr="'+i+'" type="text" value="'+this._e(g.attribute||'')+'"'+this._inp('')+'></div>';h+='<div><label class="roc-l">Min</label><input data-g-min="'+i+'" type="number" value="'+this._e(String(g.min??0))+'"'+this._inp('font-size:12px;')+'></div>';h+='<div><label class="roc-l">Max</label><input data-g-max="'+i+'" type="number" value="'+this._e(String(g.max??100))+'"'+this._inp('font-size:12px;')+'></div>';h+='</div>';const gs=g.color_gradient||[];h+='<div style="margin-bottom:8px;">';h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';h+='<label style="font-size:12px;font-weight:500;">Color gradient (smooth interpolation)</label>';h+='<button data-add-gg="'+i+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';h+='</div>';for(let j=0;j<gs.length;j++){const hex=this._toHex(gs[j].color);h+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';h+='<input type="number" data-g-gv="'+i+'-'+j+'" placeholder="value" value="'+gs[j].value+'"'+this._inp('font-size:12px;')+'>';h+='<input type="color" data-g-gc="'+i+'-'+j+'" value="'+hex+'" style="width:100%;height:30px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;">';h+='<button data-rm-gg="'+i+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';h+='</div>';}if(!gs.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No stops yet — add stops for smooth gradient, or use \'color\' in YAML for discrete conditions.</p>';h+='</div>';h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Orientation</label>';
    h+='<select data-g-orient="'+i+'"'+this._inp('')+'>';
    h+='<option value="vertical"'+((!g.orientation||g.orientation==="vertical")?" selected":"")+'>vertical – bottom→top (default)</option>';
    h+='<option value="top"'+(g.orientation==="top"?' selected':'')+'>top – top→bottom (blind/shade)</option>';
    h+='<option value="horizontal"'+(g.orientation==="horizontal"?' selected':'')+'>horizontal – left→right</option>';
    h+='<option value="right"'+(g.orientation==="right"?' selected':'')+'>right – right→left</option>';
    h+='<option value="radial"'+(g.orientation==="radial"?' selected':'')+'>radial – circular arc (extra YAML keys: arc, thickness, target)</option>';
    h+='</select></div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Alert animation (border)</label>';
    h+='<select data-g-anim="'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!g.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(g.animation==="pulse"?' selected':'')+'>pulse</option>';
    h+='<option value="blink"'+(g.animation==="blink"?' selected':'')+'>blink</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Animation color</label>';
    h+='<input type="color" data-g-ac="'+i+'" value="'+(g.animation_color?this._toHex(g.animation_color):'#ff4444')+'"'+this._inp('height:32px;cursor:pointer;')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 70px 70px;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Alert condition: entity</label>';
    h+='<input type="text" list="roc-entities" data-g-alert-ent="'+i+'" value="'+this._e((g.alert_conditions&&g.alert_conditions.entity)||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Attribute (optional)</label>';
    h+='<input data-g-alert-attr="'+i+'" type="text" value="'+this._e((g.alert_conditions&&g.alert_conditions.attribute)||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Operator</label>';
    h+='<select data-g-alert-op="'+i+'"'+this._inp('font-size:12px;')+'>';
    h+='<option value=""'+(!g.alert_conditions?' selected':'')+'>&#8212;</option>';
    h+='<option value=">"'+(g.alert_conditions&&g.alert_conditions.operator===">"?' selected':'')+'>></option>';
    h+='<option value="<"'+(g.alert_conditions&&g.alert_conditions.operator==="<"?' selected':'')+'>&#60;</option>';
    h+='<option value=">="'+(g.alert_conditions&&g.alert_conditions.operator===">="?' selected':'')+'>>= </option>';
    h+='<option value="<="'+(g.alert_conditions&&g.alert_conditions.operator==="<="?' selected':'')+'>&#60;=</option>';
    h+='<option value="=="'+(g.alert_conditions&&g.alert_conditions.operator==="=="?' selected':'')+'>==</option>';
    h+='<option value="!="'+(g.alert_conditions&&g.alert_conditions.operator==="!="?' selected':'')+'>!=</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Value</label>';
    h+='<input data-g-alert-val="'+i+'" type="number" value="'+this._e(String(g.alert_conditions&&g.alert_conditions.value!==undefined?g.alert_conditions.value:''))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div><label class="roc-l">background / transition / visible / visible_template / tap_action / fade / mobile / z_index / color (YAML)</label>';h+='<textarea data-g-yaml="'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ys)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-g-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(g.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('g',i,g.nav_mini);
    h+=this._mvBtns('g',i);
    h+='<button data-dup-g="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-g="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove gauge</button>';h+='</div></details>';return h;}

  _blindItem(b,i){
    const type=b.blind_type||'roller';
    const op=this._openPanels&&this._openPanels.has('bl-'+i);
    let h='<details style="margin-bottom:6px;" data-panel="bl-'+i+'"'+(op?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Blind: '+this._e(b.id||'blind_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-bl-id="'+i+'" type="text" value="'+this._e(b.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Top</label><input data-bl-top="'+i+'" type="text" value="'+this._e(b.top||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Left</label><input data-bl-left="'+i+'" type="text" value="'+this._e(b.left||'')+'"'+this._inp('')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Width</label><input data-bl-w="'+i+'" type="text" value="'+this._e(b.width||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Height</label><input data-bl-h="'+i+'" type="text" value="'+this._e(b.height||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">z-index</label><input data-bl-z="'+i+'" type="number" value="'+this._e(String(b.z_index??6))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Entity</label><input type="text" list="roc-ent-cover" data-bl-entity="'+i+'" value="'+this._e(b.entity||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Attribute</label><input data-bl-attr="'+i+'" type="text" value="'+this._e(b.attribute||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Min</label><input data-bl-min="'+i+'" type="number" value="'+this._e(String(b.min??0))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Max</label><input data-bl-max="'+i+'" type="number" value="'+this._e(String(b.max??100))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l" title="Real/visual coverage (%) at fully OPEN — the roleta\'s own safety margin the motor never fully retracts past, so a sliver of material always stays visible. Fully CLOSED is left untouched (always 100%). Corrects the VISUAL overlay only, so it matches reality even when you can\'t see the blind in person. 0 = off.">Top offset (%)</label><input data-bl-top-offset="'+i+'" type="number" step="0.1" min="0" max="95" value="'+this._e(String(b.top_offset??0))+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Blind type</label><select data-bl-type="'+i+'"'+this._inp('')+'>';
    h+='<option value="roller"'+(type==='roller'?' selected':'')+'>roller &#8211; solid fill</option>';
    h+='<option value="day_night"'+(type==='day_night'?' selected':'')+'>day/night &#8211; striped</option>';
    h+='<option value="venetian"'+(type==='venetian'?' selected':'')+'>venetian &#8211; slats + gap</option>';
    h+='</select></div>';
    h+='<div><label class="roc-l">Slat / roller color (CSS)</label><input data-bl-slat-color="'+i+'" type="text" value="'+this._e(b.slat_color||'rgba(0,0,0,0.9)') +'"'+this._inp('font-size:12px;font-family:monospace;')+'></div>';
    h+='</div>';
    if(type==='day_night'){
      h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
      h+='<div><label class="roc-l">Slat count (number of band pairs)</label><input data-bl-slat-count="'+i+'" type="number" min="1" step="1" value="'+this._e(String(b.slat_count??6))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
      h+='<div><label class="roc-l" title="How many times the two fabric layers sweep aligned (see-through) → offset (blackout) → aligned across the FULL travel. Count it on the real blind: run it from closed to open and count the dark/light cycles. Cannot be derived from slat count — it depends on tube diameter, fabric thickness and band pitch. Empty = slat_count/2 (the pre-6.1.0 hard-coded value).">Shift turns</label><input data-bl-shift-turns="'+i+'" type="number" step="0.25" min="0" placeholder="'+this._e(String((b.slat_count??6)/2))+'" value="'+this._e(b.shift_turns===undefined?'':String(b.shift_turns))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='<div><label class="roc-l" title="Phase of the stripe pattern at fully OPEN, in periods (0–1). 0 = the two layers are aligned (sheer bands let light through). Use this to line the leftover reserve up with what the real blind shows at 0 %.">Shift start (periods)</label><input data-bl-shift-start="'+i+'" type="number" step="0.01" min="0" max="1" placeholder="0" value="'+this._e(b.shift_start===undefined?'':String(b.shift_start))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='</div>';
      h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;"><input data-bl-shift-snap="'+i+'" type="checkbox"'+(b.shift_snap===false?'':' checked')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:12px;cursor:pointer;" title="Nudge Shift turns so fully closed lands exactly on anti-phase, i.e. full blackout. Leave on unless you want the raw measured value.">Snap fully closed to blackout</label></div>';
      h+='<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;"><input data-bl-shift-legacy="'+i+'" type="checkbox"'+(b.shift_legacy?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:12px;cursor:pointer;" title="Restore the exact pre-6.1.0 phase formula: driven by the top_offset-corrected position, with a hard snap on the last percent. Ignores Shift turns / Shift start.">Legacy phase (pre-6.1.0)</label></div>';
    }else if(type==='venetian'){
      h+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">';
      h+='<div><label class="roc-l">Slat width (px)</label><input data-bl-slat-w="'+i+'" type="number" value="'+this._e(String(b.slat_width??7))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='<div><label class="roc-l">Slat gap (px)</label><input data-bl-slat-g="'+i+'" type="number" value="'+this._e(String(b.slat_gap??6))+'"'+this._inp('font-size:12px;')+'></div>';
      h+='<div><label class="roc-l">Gap color (CSS)</label><input data-bl-gap-color="'+i+'" type="text" value="'+this._e(b.gap_color||'rgba(180,160,140,0.35)')+'"'+this._inp('font-size:12px;font-family:monospace;')+'></div>';
      h+='</div>';
    }
    const _cc=(b.control&&typeof b.control==='object')?b.control:{};
    const _ccPl=_cc.placement||({popover:'float',dock:'dock'})[_cc.display]||(b.control?'float':'off');
    const _ccPresets=Array.isArray(_cc.presets)?_cc.presets:[];
    h+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
    h+='<label class="roc-l" style="font-weight:600;">Cover control (roleta)</label>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:end;">';
    h+='<div><label class="roc-l">Control</label><select data-bl-ccdisp="'+i+'"'+this._inp('')+'>';
    h+='<option value="off"'+(_ccPl==='off'?' selected':'')+'>off</option>';
    h+='<option value="float"'+(_ccPl==='float'?' selected':'')+'>float &#8211; place freely</option>';
    h+='<option value="dock"'+(_ccPl==='dock'?' selected':'')+'>dock &#8211; edge rail</option>';
    h+='</select></div>';
    // (v5.10.1) The "Dock side" select is gone: a docked control is
    // `flex:1 1 0` and therefore FILLS its cover grid region, so there is no
    // free space to align it within — the side is decided entirely by where you
    // place the `cover` region in the Layout tab. The select wrote dock_side,
    // coverControlNorm turned it into `side`, and nothing ever read it. Offering
    // a control that cannot do anything is worse than not offering it.
    h+='<div style="display:flex;align-items:center;gap:6px;padding-bottom:7px;"><input data-bl-ccslider="'+i+'" type="checkbox"'+(_cc.slider!==false?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label class="roc-l" style="margin:0;">Slider</label></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Top (float)</label><input data-bl-cctop="'+i+'" type="text" placeholder="'+this._e(b.top||'10%')+'" value="'+this._e(_cc.top||'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Left (float)</label><input data-bl-ccleft="'+i+'" type="text" placeholder="'+this._e(b.left||'10%')+'" value="'+this._e(_cc.left||'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div><label class="roc-l">Width</label><input data-bl-ccwidth="'+i+'" type="text" placeholder="52px" value="'+this._e(_cc.width||'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='</div>';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><label class="roc-l" style="margin:0;">Presets (icon only)</label><button data-add-ccp="'+i+'" style="padding:3px 8px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">+ Preset</button></div>';
    for(let j=0;j<_ccPresets.length;j++){
      const _p=_ccPresets[j]||{};
      h+='<div data-ccp-row="'+i+'" style="display:grid;grid-template-columns:52px 1fr 78px 1fr 24px;gap:6px;margin-bottom:4px;align-items:center;">';
      h+='<input data-ccp-pos type="number" min="0" max="100" placeholder="%" value="'+this._e(_p.position!=null?String(_p.position):'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<input data-ccp-icon type="text" placeholder="mdi:roller-shade" value="'+this._e(_p.icon||'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<input data-ccp-color type="text" placeholder="amber" value="'+this._e(_p.color||'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<input data-ccp-name type="text" placeholder="Name (tooltip)" value="'+this._e(_p.name||'')+'"'+this._inp('font-size:12px;')+'>';
      h+='<button data-rm-ccp="'+i+':'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:16px;line-height:1;padding:0;">&#x2715;</button>';
      h+='</div>';
    }
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:2px 0 0;">Tap the blind to reveal the controller. Up / Stop / Down always shown. Name = tooltip only. Use real MDI icons e.g. <code>mdi:roller-shade</code> / <code>mdi:blinds</code> (materialdesignicons.com). Colour: HA name (indigo, amber, blue-grey) or CSS.</p>';
    h+='</div>';
    const cpBl=Object.assign({},b);['id','top','left','width','height','entity','attribute','min','max','top_offset','z_index','blind_type','slat_color','slat_count','shift_turns','shift_start','shift_snap','shift_legacy','slat_width','slat_gap','gap_color','slat_pitch','group','control'].forEach(function(k){delete cpBl[k];});
    const ysBl=Object.keys(cpBl).length?_yaml.s(cpBl):'';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">background / border_radius / transition / visible / visible_conditions (YAML)</label>';
    h+='<textarea data-bl-yaml="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(ysBl)+'</textarea></div>';
    h+='<div style="margin-top:6px;"><label class="roc-l">Group (optional)</label><input data-bl-grp="'+i+'" type="text" placeholder="group id" value="'+this._e(b.group||'')+'"'+this._inp('')+'></div>';
    h+=this._navMiniField('bl',i,b.nav_mini);
    h+=this._secTileHtml('bl',i,b);
    h+=this._mvBtns('bl',i);
    h+='<button data-dup-bl="'+i+'" style="margin-top:8px;margin-right:6px;padding:4px 10px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Duplicate</button>';
    h+='<button data-rm-bl="'+i+'" style="margin-top:8px;padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove blind</button>';
    h+='</div></details>';
    return h;}


  // ----- Overview page editor (v6.30.0, OVERVIEW_PLAN.md §5) ----------------
  // Two accordions in Rooms & menu: "Overview page" for a room with
  // `overview:`, "Overview tile" for every other room once an overview exists.
  // Every key the renderer reads has a field here (COCKPIT_PLAN.md D11);
  // keys without a field survive a save (KEEP — start from the old object).
  _ovEdHtml(c,er,sec){
    const self=this,e=function(s){return self._e(s==null?'':String(s));};
    const inp=function(st){return self._inp(st||'');};
    const fld=function(label,inner,grow){return'<div style="flex:'+(grow||'1 1 140px')+';min-width:0;"><label class="roc-l">'+label+'</label>'+inner+'</div>';};
    const row=function(inner){return'<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;align-items:flex-end;">'+inner+'</div>';};
    const chk=function(id,label,on,rr){return'<div style="display:flex;align-items:center;gap:7px;padding-bottom:6px;"><input id="'+id+'" type="checkbox"'+(on?' checked':'')+(rr?' data-ovf-rr':' data-ovf')+' style="width:16px;height:16px;cursor:pointer;"><label for="'+id+'" style="font-size:12px;cursor:pointer;">'+label+'</label></div>';};
    const sel=function(id,cur,list,rr){return'<select id="'+id+'"'+(rr?' data-ovf-rr':' data-ovf')+inp()+'>'+list.map(function(o){return'<option value="'+e(o[0])+'"'+(String(cur)===String(o[0])?' selected':'')+'>'+e(o[1])+'</option>';}).join('')+'</select>';};
    const txt=function(id,val,ph,attr){return'<input id="'+id+'" type="text" data-ovf'+(attr||'')+' placeholder="'+e(ph||'')+'" value="'+e(val)+'"'+inp()+'>';};
    const sub=function(t){return'<div style="font-size:12px;font-weight:600;margin:12px 0 6px;padding-top:8px;border-top:1px dashed var(--divider-color);">'+t+'</div>';};
    const btn='padding:4px 10px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:12px;';
    const rooms=Array.isArray(c.rooms)?c.rooms:[];
    let out='';
    if(er&&er.overview){
      const ov=typeof er.overview==='object'?er.overview:{};
      const PV=function(v,p,d){return rocOvPV(v,p,d);};
      let h='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;line-height:1.5;">This room is an <b>overview page</b>: every other room as a tile (tap opens the room), plus optional header, side columns and a dock of section launchers. A region you switch off collapses and the room grid takes its space. Its photo and elements are not used.</p>';
      h+=row(fld('Room → tile transition',sel('ovf-transition',ov.transition||'zoom',[['zoom','zoom — the room grows out of its tile'],['fade','fade'],['none','none']]))
        +fld('Duration (ms)','<input id="ovf-dur" type="number" min="0" step="50" data-ovf placeholder="450" value="'+e(ov.transition_duration!=null?rocOvMs(ov.transition_duration,450):'')+'"'+inp()+'>')
        +fld('Background image (optional)',txt('ovf-bg',ov.background||'','/local/overview_bg.webp'),'2 1 220px'));
      h+=chk('ovf-navhidden','Hide this page from the other rooms&#39; thumbnail strip',er.nav_hidden===true,false);
      // header
      const hd=ov.header&&typeof ov.header==='object'?ov.header:null;
      h+=sub('Header');
      h+=row(chk('ovf-hd-on','Show a header bar',!!hd,true)+(hd?fld('Height','<input id="ovf-hd-h" type="text" data-ovf placeholder="auto" value="'+e(hd.height&&hd.height!=='auto'?hd.height:'')+'"'+inp()+'>'):''));
      if(hd){
        (Array.isArray(hd.items)?hd.items:[]).forEach(function(it,i){
          const k=rocOvHdKind(it)||'card';
          let b='<div style="border:1px solid var(--divider-color);border-radius:6px;padding:8px;margin-bottom:6px;">';
          b+=row(fld('Item','<select data-ovhd-kind="'+i+'" data-ovf-rr'+inp()+'>'+[['pill','Pill — entity value / template'],['nav_cards','Nav strip cards (e.g. your alert ticker)'],['card','Card (YAML)']].map(function(o){return'<option value="'+o[0]+'"'+(o[0]===k?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>','2 1 200px')
            +fld('Width','<input data-ovhd-w="'+i+'" type="text" data-ovf placeholder="'+(k==='pill'?'auto':'grow')+'" value="'+e(it&&it.width||'')+'"'+inp()+'>','1 1 90px')
            +fld('Profile','<select data-ovhd-media="'+i+'" data-ovf'+inp()+'>'+[['','both'],['landscape','landscape only'],['portrait','portrait only']].map(function(o){return'<option value="'+o[0]+'"'+((it&&it.media||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>','1 1 110px'));
          if(k==='pill'){
            const p=(it&&it.pill)||{};
            b+=row(fld('Entity','<input data-ovhd-ent="'+i+'" type="text" list="roc-entities" data-ovf placeholder="sensor.dhw_temperature" value="'+e(p.entity||'')+'"'+inp()+'>','2 1 180px')
              +fld('Icon','<input data-ovhd-icon="'+i+'" type="text" data-ovf placeholder="mdi:water-boiler" value="'+e(p.icon||'')+'"'+inp()+'>')
              +fld('Attribute','<input data-ovhd-attr="'+i+'" type="text" data-ovf value="'+e(p.attribute||'')+'"'+inp()+'>','1 1 100px'));
            b+=row(fld('Prefix','<input data-ovhd-pre="'+i+'" type="text" data-ovf value="'+e(p.prefix||'')+'"'+inp()+'>','1 1 80px')
              +fld('Suffix','<input data-ovhd-suf="'+i+'" type="text" data-ovf placeholder="auto: entity unit" value="'+e(p.suffix!=null?p.suffix:'')+'"'+inp()+'>','1 1 80px')
              +fld('Decimals','<input data-ovhd-dec="'+i+'" type="number" min="0" step="1" data-ovf value="'+e(p.decimals!=null?p.decimals:'')+'"'+inp()+'>','1 1 70px')
              +fld('Template (instead of entity, optional)','<input data-ovhd-tpl="'+i+'" type="text" data-ovf placeholder="{{ states(\'sensor.nameday\') }}" value="'+e(p.template||'')+'"'+inp()+'>','3 1 240px'));
            b+=self._actFieldsHtml('ovhd'+i,{tap:p.tap_action,hold:p.hold_action},{slots:['tap','hold'],entity:p.entity||'',labels:{tap:'Tap (default: more-info)',hold:'Hold'}});
          }else if(k==='card'){
            const cc=it&&it.card?it.card:(function(){const o=Object.assign({},it||{});delete o.width;delete o.media;return o;})();
            b+='<label class="roc-l">Card (YAML)</label><textarea data-ovhd-card="'+i+'" rows="3" data-ovf placeholder="type: custom:alert-ticker-card"'+inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+e(cc&&cc.type?_yaml.s(cc):'')+'</textarea>';
          }else{
            const n=((c.nav&&c.nav.cards)||[]).length;
            b+='<div style="font-size:11px;color:var(--secondary-text-color);">Shows the '+n+' card'+(n===1?'':'s')+' from <i>Navigation menu → Cards</i> here too — one configuration, used in both places.</div>';
          }
          b+='<div><button type="button" data-ovhd-mv="'+i+':-1" style="'+btn+'margin-top:6px;">&#9650;</button> <button type="button" data-ovhd-mv="'+i+':1" style="'+btn+'margin-top:6px;">&#9660;</button> <button type="button" data-ovhd-rm="'+i+'" style="'+btn+'margin-top:6px;color:var(--error-color);border-color:var(--error-color);">Remove</button></div>';
          h+=b+'</div>';
        });
        h+='<div style="display:flex;gap:6px;flex-wrap:wrap;"><button type="button" data-ovhd-add="pill" style="'+btn+'">+ Pill</button><button type="button" data-ovhd-add="nav_cards" style="'+btn+'">+ Nav strip cards</button><button type="button" data-ovhd-add="card" style="'+btn+'">+ Card</button></div>';
      }
      // left / right
      [['left','lt','Left column'],['right','rt','Right column']].forEach(function(x){
        const sd=ov[x[0]]&&typeof ov[x[0]]==='object'?ov[x[0]]:null;
        h+=sub(x[2]);
        h+=row(chk('ovf-'+x[1]+'-on','Show the '+x[2].toLowerCase()+' (cards, e.g. clock, weather, calendar)',!!sd,true));
        if(sd){
          h+=row(fld('Width (landscape)',txt('ovf-'+x[1]+'-w',sd.width||'','28%'))
            +fld('On phones (portrait)',sel('ovf-'+x[1]+'-pp',sd.portrait||'top',[['top','above the room grid'],['bottom','below the room grid'],['hidden','hidden']])));
          h+='<label class="roc-l">Cards (YAML list — each a card config or {card, height, media: portrait|landscape})</label><textarea id="ovf-'+x[1]+'-cards" rows="4" data-ovf placeholder="- card:&#10;    type: weather-forecast&#10;    entity: weather.home&#10;  media: landscape"'+inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+e(Array.isArray(sd.cards)&&sd.cards.length?_yaml.s(sd.cards):'')+'</textarea>';
        }
      });
      // grid
      const g=ov.grid&&typeof ov.grid==='object'?ov.grid:{};
      const gAuto=!Array.isArray(g.rooms);
      h+=sub('Room grid');
      h+=chk('ovf-g-auto','All rooms, in room order',gAuto,true);
      if(!gAuto){
        // v6.31.0: an ordered list — the grid's own order, independent of the
        // nav strip (rooms: order). Shown rooms first, in grid order, with ▲▼;
        // the rest below, unticked, in room order.
        const all=rooms.filter(function(r){return r&&!r.overview;});
        const shown=[];g.rooms.forEach(function(id){const r=all.find(function(x){return String(x.id)===String(id);});if(r&&shown.indexOf(r)<0)shown.push(r);});
        const rest=all.filter(function(r){return shown.indexOf(r)<0;});
        const ab='padding:2px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;';
        h+='<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;max-width:420px;">'+shown.concat(rest).map(function(r,k){
          const on=k<shown.length;
          return'<div style="display:flex;align-items:center;gap:8px;padding:4px 8px;border:1px solid var(--divider-color);border-radius:6px;'+(on?'':'opacity:.6;')+'">'
            +'<label style="flex:1;font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" data-ovg-room="'+e(r.id)+'"'+(on?' checked':'')+' data-ovf-rr style="width:15px;height:15px;">'+e(r.name||r.id)+'</label>'
            +(on?'<button type="button" data-ovg-mv="'+k+':-1" title="Earlier in the grid" style="'+ab+'"'+(k===0?' disabled':'')+'>&#9650;</button><button type="button" data-ovg-mv="'+k+':1" title="Later in the grid" style="'+ab+'"'+(k===shown.length-1?' disabled':'')+'>&#9660;</button>':'')
            +'</div>';
        }).join('')+'</div>';
      }
      const st=[['card','photo tiles'],['row','list rows']];
      h+=row(fld('Columns — landscape','<input id="ovf-g-cols-l" type="number" min="1" max="12" step="1" data-ovf placeholder="3" value="'+e(PV(g.columns,'landscape',''))+'"'+inp()+'>','1 1 100px')
        +fld('Columns — portrait','<input id="ovf-g-cols-p" type="number" min="1" max="12" step="1" data-ovf placeholder="2" value="'+e(PV(g.columns,'portrait',''))+'"'+inp()+'>','1 1 100px')
        +fld('Tiles — landscape',sel('ovf-g-style-l',PV(g.style,'landscape','card'),st))
        +fld('Tiles — portrait',sel('ovf-g-style-p',PV(g.style,'portrait','card'),st)));
      h+=row(fld('Tile picture',sel('ovf-g-live',g.live||'inherit',[['inherit','same as the nav thumbnails'],['full','live room (everything)'],['custom','live room (Show-in-mini items)'],['composite','photo + active overlays'],['off','photo only']]),'2 1 200px')
        +fld('Live tile reference width','<input id="ovf-g-wref" type="text" data-ovf placeholder="auto (tile width)" value="'+e(Number(g.width_ref)>0?g.width_ref:'')+'"'+inp()+'>','1 1 120px')
        +fld('State chips — landscape','<input id="ovf-g-chips-l" type="number" min="0" max="8" step="1" data-ovf placeholder="4" value="'+e(PV(g.chips_max,'landscape',''))+'"'+inp()+'>','1 1 100px')
        +fld('State chips — portrait','<input id="ovf-g-chips-p" type="number" min="0" max="8" step="1" data-ovf placeholder="3" value="'+e(PV(g.chips_max,'portrait',''))+'"'+inp()+'>','1 1 100px'));
      h+=row(chk('ovf-g-names','Show room names on the tiles',g.names!==false,false)+chk('ovf-g-info','Show each room&#39;s thumbnail chips (temperature, humidity…) on its tile',g.info!==false,false)+fld('Gap',txt('ovf-g-gap',g.gap||'','12px'),'0 1 100px'));
      // dock
      const dk=ov.dock&&typeof ov.dock==='object'?ov.dock:null;
      const secs=Array.isArray(c.sections)?c.sections:[];
      h+=sub('Dock — section launchers');
      if(!secs.length)h+='<div style="font-size:11px;color:var(--secondary-text-color);margin-bottom:6px;">No sections yet — create them in the Sections tab; each becomes a launcher here.</div>';
      h+=row(chk('ovf-dk-on','Show the dock',!!dk,true)+(dk?fld('Icon size',txt('ovf-dk-size',dk.size||'','24px'),'0 1 100px'):''));
      if(dk){
        const dAuto=!Array.isArray(dk.sections);
        h+=chk('ovf-dk-auto','All sections, in their order',dAuto,true);
        if(!dAuto){
          const ids=dk.sections.map(String);
          h+='<div style="display:flex;flex-wrap:wrap;gap:10px;">'+secs.map(function(s){
            return'<label style="font-size:12px;display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" data-ovd-sec="'+e(s.id)+'"'+(ids.indexOf(String(s.id))>=0?' checked':'')+' data-ovf style="width:15px;height:15px;">'+e(s.title||s.id)+'</label>';
          }).join('')+'</div>';
        }
      }
      out+=sec('room-overview','Overview page — header, side columns, room grid, dock',undefined,h,'mdi:view-dashboard');
    }else if(er&&rocOvAny(c)){
      const t=er.overview_tile&&typeof er.overview_tile==='object'?er.overview_tile:{};
      const f=rocOvFocus(t.focus);
      const fx=Math.round(f.x*100),fy=Math.round(f.y*100);
      const mode=t.chips===undefined||t.chips===null||t.chips==='auto'?'auto':(Array.isArray(t.chips)?'custom':'none');
      let h='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;line-height:1.5;">How this room appears as a tile on the overview page. Tapping the tile opens this room.</p>';
      h+=row(fld('Tile name','<input id="ovt-name" type="text" data-ovf placeholder="'+e(er.name||er.id||'')+'" value="'+e(t.name||'')+'"'+inp()+'>','2 1 180px')
        +fld('Name on the tile',sel('ovt-showname',t.show_name===true?'show':(t.show_name===false?'hide':''),[['','as the overview page sets it'],['show','always show'],['hide','hide']]),'1 1 170px')
        +chk('ovt-hidden','Leave this room out of the overview',t.hidden===true,false));
      h+='<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">'
        +'<div id="ovt-prev" style="width:160px;aspect-ratio:4/3;border-radius:10px;border:1px solid var(--divider-color);background-size:cover;background-position:'+fx+'% '+fy+'%;'+(er.base_image?'background-image:url(\''+e(escUrl(er.base_image))+'\');':'')+'"></div>'
        +'<div style="flex:1 1 200px;display:grid;gap:6px;"><label class="roc-l">Focus — horizontal <span id="ovt-fx-v">'+fx+'%</span></label><input id="ovt-fx" type="range" min="0" max="100" step="1" value="'+fx+'" data-ovf>'
        +'<label class="roc-l">Focus — vertical <span id="ovt-fy-v">'+fy+'%</span></label><input id="ovt-fy" type="range" min="0" max="100" step="1" value="'+fy+'" data-ovf></div></div>';
      h+=row(fld('State chips',sel('ovt-mode',mode,[['auto','automatic — lights, blinds, media'],['custom','my own list'],['none','none']],true),'2 1 220px'));
      if(mode==='auto'){
        let ri=rooms.indexOf(er);
        const derived=ri>=0?rocOvChips(c,ri,8):[];
        h+='<div style="font-size:11px;color:var(--secondary-text-color);margin-bottom:6px;">'+(derived.length?'Derived now: '+derived.map(function(d){return e(d.kind==='lights'?'Lights ('+d.entities.length+')':d.entities[0]);}).join(' · '):'Nothing to derive yet — this room has no light controls, cover-controlled blinds or media players.')+'</div>';
      }else if(mode==='custom'){
        t.chips.forEach(function(ch,k){
          const o=typeof ch==='string'?{entity:ch}:(ch||{});
          let b='<div style="border:1px solid var(--divider-color);border-radius:6px;padding:8px;margin-bottom:6px;">';
          b+=row(fld('Entity','<input data-ovtc-ent="'+k+'" type="text" list="roc-entities" data-ovf placeholder="light.bedroom" value="'+e(o.entity||'')+'"'+inp()+'>','2 1 180px')
            +fld('Icon','<input data-ovtc-icon="'+k+'" type="text" data-ovf placeholder="entity icon" value="'+e(o.icon||'')+'"'+inp()+'>')
            +fld('Active when state is','<input data-ovtc-act="'+k+'" type="text" data-ovf placeholder="anything but off/closed/idle" value="'+e(o.active_state==null?'':(Array.isArray(o.active_state)?o.active_state.join(', '):o.active_state))+'"'+inp()+'>'));
          b+=self._actFieldsHtml('ovtc'+k,{tap:o.tap_action,hold:o.hold_action},{slots:['tap','hold'],entity:o.entity||'',labels:{tap:'Tap (default: toggle, or more-info)',hold:'Hold (default: more-info)'}});
          b+='<div><button type="button" data-ovtc-mv="'+k+':-1" style="'+btn+'">&#9650;</button> <button type="button" data-ovtc-mv="'+k+':1" style="'+btn+'">&#9660;</button> <button type="button" data-ovtc-rm="'+k+'" style="'+btn+'color:var(--error-color);border-color:var(--error-color);">Remove</button></div>';
          h+=b+'</div>';
        });
        h+='<button type="button" id="ovtc-add" style="'+btn+'">+ Chip</button>';
      }
      out+=sec('room-ovtile','Overview tile — name, focus, state chips',undefined,h,'mdi:view-grid-outline');
    }
    return out;
  }

  // Read the overview fields back onto the edited room (tgt).
  _ovCollect(q,tgt){
    const self=this;
    const has=function(id){return!!q('#'+id);};
    const val=function(id){const el=q('#'+id);return el?el.value.trim():'';};
    const on=function(id){const el=q('#'+id);return!!(el&&el.checked);};
    const setK=function(o,k,v){if(v===undefined||v===null||v==='')delete o[k];else o[k]=v;};
    const num=function(s){const n=parseInt(s,10);return isNaN(n)?undefined:n;};
    const pv=function(l,p,dl,dp){
      if(l===undefined&&p===undefined)return undefined;
      if(l!==undefined&&p!==undefined&&l===p)return l;
      const o={};if(l!==undefined)o.landscape=l;if(p!==undefined)o.portrait=p;return o;
    };
    if(has('ovf-transition')&&tgt.overview){
      const ov=Object.assign({},typeof tgt.overview==='object'?tgt.overview:{});
      const tr=val('ovf-transition');setK(ov,'transition',tr&&tr!=='zoom'?tr:'');
      const d=val('ovf-dur');setK(ov,'transition_duration',d!==''&&!isNaN(parseFloat(d))?Math.max(0,parseFloat(d)):'');
      setK(ov,'background',val('ovf-bg'));
      if(on('ovf-navhidden'))tgt.nav_hidden=true;else delete tgt.nav_hidden;
      // header
      if(on('ovf-hd-on')){
        const hd=Object.assign({},ov.header&&typeof ov.header==='object'?ov.header:{});
        const items=(Array.isArray(hd.items)?hd.items:[]).map(function(it,i){
          const kEl=q('[data-ovhd-kind="'+i+'"]');if(!kEl)return it;
          const k=kEl.value;
          let o;
          if(k==='pill'){
            const p=Object.assign({},it&&it.pill?it.pill:{});
            const g=function(a){const el=q('[data-ovhd-'+a+'="'+i+'"]');return el?el.value.trim():undefined;};
            ['ent:entity','icon:icon','attr:attribute','tpl:template'].forEach(function(m){const x=m.split(':');const v=g(x[0]);if(v!==undefined)setK(p,x[1],v);});
            const sf=q('[data-ovhd-suf="'+i+'"]');if(sf){if(sf.value!=='')p.suffix=sf.value;else delete p.suffix;}
            const pf=q('[data-ovhd-pre="'+i+'"]');if(pf){if(pf.value!=='')p.prefix=pf.value;else delete p.prefix;} // spaces are part of a prefix
            const dc=g('dec');if(dc!==undefined)setK(p,'decimals',num(dc));
            self._applyActs('ovhd'+i,p,['tap','hold']);
            o={pill:p};
          }else if(k==='nav_cards')o={nav_cards:true};
          else{
            const ta=q('[data-ovhd-card="'+i+'"]');
            const r=ta?self._pYaml(ta):{ok:false};
            const prevCard=it&&it.card?it.card:(it&&it.type?(function(){const x=Object.assign({},it);delete x.width;delete x.media;return x;})():null);
            o={card:r.ok?(r.val||null):prevCard};
            if(!o.card)o={card:{type:''}};
          }
          const w=q('[data-ovhd-w="'+i+'"]');if(w&&w.value.trim())o.width=w.value.trim();
          const m=q('[data-ovhd-media="'+i+'"]');if(m&&m.value)o.media=m.value;
          return o;
        });
        hd.items=items;
        if(has('ovf-hd-h'))setK(hd,'height',val('ovf-hd-h'));
        ov.header=hd;
      }else if(has('ovf-hd-on'))delete ov.header;
      // left / right
      [['left','lt'],['right','rt']].forEach(function(x){
        if(!has('ovf-'+x[1]+'-on'))return;
        if(!on('ovf-'+x[1]+'-on')){delete ov[x[0]];return;}
        const sd=Object.assign({},ov[x[0]]&&typeof ov[x[0]]==='object'?ov[x[0]]:{});
        if(has('ovf-'+x[1]+'-w'))setK(sd,'width',val('ovf-'+x[1]+'-w'));
        if(has('ovf-'+x[1]+'-pp')){const pp=val('ovf-'+x[1]+'-pp');setK(sd,'portrait',pp&&pp!=='top'?pp:'');}
        const ta=q('#ovf-'+x[1]+'-cards');
        if(ta){const r=self._pYaml(ta);if(r.ok){if(Array.isArray(r.val)&&r.val.length)sd.cards=r.val;else if(r.val&&typeof r.val==='object')sd.cards=[r.val];else sd.cards=[];}}
        if(!Array.isArray(sd.cards))sd.cards=[];
        ov[x[0]]=sd;
      });
      // grid
      const g=Object.assign({},ov.grid&&typeof ov.grid==='object'?ov.grid:{});
      if(has('ovf-g-auto')){
        if(on('ovf-g-auto'))delete g.rooms;
        else{
          const boxes=self.querySelectorAll('[data-ovg-room]');
          if(boxes.length){const l=[];boxes.forEach(function(b){if(b.checked)l.push(b.dataset.ovgRoom);});g.rooms=l;}
          else if(!Array.isArray(g.rooms)){const tc=self._config||{};g.rooms=(tc.rooms||[]).filter(function(r){return r&&!r.overview;}).map(function(r){return r.id;});}
        }
      }
      setK(g,'columns',pv(num(val('ovf-g-cols-l')),num(val('ovf-g-cols-p'))));
      const sl=val('ovf-g-style-l'),sp=val('ovf-g-style-p');
      setK(g,'style',pv(sl&&sl!=='card'?sl:undefined,sp&&sp!=='card'?sp:undefined));
      const lv=val('ovf-g-live');setK(g,'live',lv&&lv!=='inherit'?lv:'');
      const wrv=parseFloat(val('ovf-g-wref'));setK(g,'width_ref',wrv>0?wrv:'');
      setK(g,'chips_max',pv(num(val('ovf-g-chips-l')),num(val('ovf-g-chips-p'))));
      if(has('ovf-g-info')){if(on('ovf-g-info'))delete g.info;else g.info=false;}
      if(has('ovf-g-names')){if(on('ovf-g-names'))delete g.names;else g.names=false;}
      setK(g,'gap',val('ovf-g-gap'));
      if(Object.keys(g).length)ov.grid=g;else delete ov.grid;
      // dock
      if(has('ovf-dk-on')){
        if(on('ovf-dk-on')){
          const dk=Object.assign({},ov.dock&&typeof ov.dock==='object'?ov.dock:{});
          if(has('ovf-dk-size'))setK(dk,'size',val('ovf-dk-size'));
          if(has('ovf-dk-auto')){
            if(on('ovf-dk-auto'))delete dk.sections;
            else{
              const boxes=self.querySelectorAll('[data-ovd-sec]');
              if(boxes.length){const l=[];boxes.forEach(function(b){if(b.checked)l.push(b.dataset.ovdSec);});dk.sections=l;}
              else if(!Array.isArray(dk.sections))dk.sections=((self._config&&self._config.sections)||[]).map(function(s){return s.id;});
            }
          }
          ov.dock=dk;
        }else delete ov.dock;
      }
      tgt.overview=Object.keys(ov).length?ov:true;
    }
    if(has('ovt-mode')&&!tgt.overview){
      const t=Object.assign({},tgt.overview_tile&&typeof tgt.overview_tile==='object'?tgt.overview_tile:{});
      setK(t,'name',val('ovt-name'));
      if(on('ovt-hidden'))t.hidden=true;else delete t.hidden;
      if(has('ovt-showname')){const sn=val('ovt-showname');if(sn==='show')t.show_name=true;else if(sn==='hide')t.show_name=false;else delete t.show_name;}
      const fx=parseInt(val('ovt-fx'),10),fy=parseInt(val('ovt-fy'),10);
      if(!isNaN(fx)&&!isNaN(fy)&&!(fx===50&&fy===50))t.focus=fx+'% '+fy+'%';else delete t.focus;
      const mode=val('ovt-mode');
      if(mode==='none')t.chips='none';
      else if(mode==='auto')delete t.chips;
      else{
        const prev=Array.isArray(t.chips)?t.chips:[];
        t.chips=prev.map(function(ch,k){
          const o=Object.assign({},typeof ch==='string'?{entity:ch}:(ch||{}));
          const ent=q('[data-ovtc-ent="'+k+'"]');if(ent)setK(o,'entity',ent.value.trim());
          const ic=q('[data-ovtc-icon="'+k+'"]');if(ic)setK(o,'icon',ic.value.trim());
          const ac=q('[data-ovtc-act="'+k+'"]');
          if(ac){const l=ac.value.split(',').map(function(x){return x.trim();}).filter(Boolean);if(!l.length)delete o.active_state;else o.active_state=l.length===1?l[0]:l;}
          self._applyActs('ovtc'+k,o,['tap','hold']);
          if(typeof ch==='string'&&Object.keys(o).length===1&&o.entity===ch)return ch; // KEEP the short form
          return o;
        });
      }
      if(Object.keys(t).length)tgt.overview_tile=t;else delete tgt.overview_tile;
    }
  }

  // Listeners for the overview accordions (called from _listen()).
  _ovListen(fire,T){
    const self=this;
    const rr=function(mut){
      const c=self._collectConfig();
      if(mut)mut(T(c));
      self._config=c;self._render();self._fire(c);
    };
    this.querySelectorAll('[data-ovf]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-ovf-rr]').forEach(function(el){
      el.addEventListener('change',function(){
        rr(function(r){
          const ov=r.overview&&typeof r.overview==='object'?r.overview:null;
          if(!ov)return;
          if(el.id==='ovf-hd-on'&&el.checked&&!ov.header)ov.header={items:[{nav_cards:true}]};
          if(el.id==='ovf-lt-on'&&el.checked&&!ov.left)ov.left={cards:[]};
          if(el.id==='ovf-rt-on'&&el.checked&&!ov.right)ov.right={cards:[]};
          if(el.id==='ovf-dk-on'&&el.checked&&!ov.dock)ov.dock={};
        });
      });
    });
    const fx=this.querySelector('#ovt-fx'),fy=this.querySelector('#ovt-fy'),pv=this.querySelector('#ovt-prev');
    const live=function(){
      if(!fx||!fy)return;
      if(pv)pv.style.backgroundPosition=fx.value+'% '+fy.value+'%';
      const a=self.querySelector('#ovt-fx-v'),b=self.querySelector('#ovt-fy-v');
      if(a)a.textContent=fx.value+'%';if(b)b.textContent=fy.value+'%';
    };
    if(fx)fx.addEventListener('input',live);
    if(fy)fy.addEventListener('input',live);
    const hdItems=function(r){const ov=r.overview;if(!ov||typeof ov!=='object')return null;if(!ov.header||typeof ov.header!=='object')ov.header={};if(!Array.isArray(ov.header.items))ov.header.items=[];return ov.header.items;};
    this.querySelectorAll('[data-ovhd-add]').forEach(function(b){
      b.addEventListener('click',function(){
        const k=b.dataset.ovhdAdd;
        rr(function(r){const l=hdItems(r);if(!l)return;l.push(k==='pill'?{pill:{}}:(k==='nav_cards'?{nav_cards:true}:{card:{type:'markdown',content:'…'}}));});
      });
    });
    this.querySelectorAll('[data-ovhd-rm]').forEach(function(b){
      b.addEventListener('click',function(){const i=parseInt(b.dataset.ovhdRm,10);rr(function(r){const l=hdItems(r);if(l&&i>=0&&i<l.length)l.splice(i,1);});});
    });
    this.querySelectorAll('[data-ovhd-mv]').forEach(function(b){
      b.addEventListener('click',function(){
        const p=b.dataset.ovhdMv.split(':'),i=parseInt(p[0],10),j=i+parseInt(p[1],10);
        rr(function(r){const l=hdItems(r);if(!l||j<0||j>=l.length)return;const x=l[i];l[i]=l[j];l[j]=x;});
      });
    });
    this.querySelectorAll('[data-ovg-mv]').forEach(function(b){
      b.addEventListener('click',function(){
        const p=b.dataset.ovgMv.split(':'),i=parseInt(p[0],10),j=i+parseInt(p[1],10);
        const order=[];self.querySelectorAll('[data-ovg-room]').forEach(function(x){if(x.checked)order.push(x.dataset.ovgRoom);});
        if(j<0||j>=order.length)return;
        const x=order[i];order[i]=order[j];order[j]=x;
        rr(function(r){const ov=r.overview;if(!ov||typeof ov!=='object')return;if(!ov.grid||typeof ov.grid!=='object')ov.grid={};ov.grid.rooms=order;});
      });
    });
    const chipList=function(r){if(!r.overview_tile||typeof r.overview_tile!=='object')r.overview_tile={};if(!Array.isArray(r.overview_tile.chips))r.overview_tile.chips=[];return r.overview_tile.chips;};
    const modeEl=this.querySelector('#ovt-mode');
    if(modeEl)modeEl.addEventListener('change',function(){
      rr(function(r){
        if(modeEl.value!=='custom')return;
        const l=chipList(r);
        if(!l.length){
          // seed the list with what "automatic" showed, so switching is not a reset
          const c=self._config,ri=(c.rooms||[]).indexOf(r);
          const tmp=JSON.parse(JSON.stringify(c));
          if(ri>=0&&tmp.rooms[ri].overview_tile)delete tmp.rooms[ri].overview_tile.chips;
          (ri>=0?rocOvChips(tmp,ri,8):[]).forEach(function(d){if(d.kind!=='lights')l.push({entity:d.entities[0]});else d.entities.forEach(function(id){l.push({entity:id});});});
        }
      });
    });
    const addC=this.querySelector('#ovtc-add');
    if(addC)addC.addEventListener('click',function(){rr(function(r){chipList(r).push({entity:''});});});
    this.querySelectorAll('[data-ovtc-rm]').forEach(function(b){
      b.addEventListener('click',function(){const k=parseInt(b.dataset.ovtcRm,10);rr(function(r){const l=chipList(r);if(k>=0&&k<l.length)l.splice(k,1);});});
    });
    this.querySelectorAll('[data-ovtc-mv]').forEach(function(b){
      b.addEventListener('click',function(){
        const p=b.dataset.ovtcMv.split(':'),i=parseInt(p[0],10),j=i+parseInt(p[1],10);
        rr(function(r){const l=chipList(r);if(j<0||j>=l.length)return;const x=l[i];l[i]=l[j];l[j]=x;});
      });
    });
    const addOv=this.querySelector('#add-ovpage');
    if(addOv)addOv.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!Array.isArray(c.rooms))c.rooms=[];
      let id='overview',n=1;
      while(c.rooms.some(function(r){return r&&r.id===id;})){n++;id='overview_'+n;}
      const ov={grid:{}};
      if(Array.isArray(c.sections)&&c.sections.length)ov.dock={};
      delete ov.grid;
      c.rooms.push({id:id,name:'Overview',icon:'mdi:view-dashboard',overview:Object.keys(ov).length?ov:true});
      self._editRoomIdx=c.rooms.length-1;self._editGlobal=false;
      if(self._openPanels)self._openPanels.add('room-overview');
      self._config=c;self._render();self._fire(c);
    });
  }

  // ---- v7.0.0 (V7_PLAN.md Phase 9): the studio is the editor --------------------------------
  // HA's card-editor dialog shows a launcher: open the studio (or the wizard on a new card), a few
  // basics and where the YAML is. The tabbed editor of 6.x is still there behind "Classic editor"
  // (remembered per browser) until 7.1. Inside the studio (hosted) the classic forms stay as they are.
  _isClassic(){
    if(this._rocHosted)return true;
    if(this._classic!=null)return!!this._classic;
    if(this.constructor.rocDefaultView==='classic')return true; // the test tiers
    try{return window.localStorage.getItem('roc-editor-classic')==='1';}catch(_){return false;}
  }
  _setClassic(on){
    this._classic=!!on;
    try{window.localStorage.setItem('roc-editor-classic',on?'1':'0');}catch(_){}
    this._render();
  }
  _renderLauncher(){
    const c=this._config,self=this,e=function(s){return self._e(String(s==null?'':s));};
    const rooms=Array.isArray(c.rooms)?c.rooms:[];
    const pages=rooms.filter(function(r){return r&&(r.overview||r.floorplan);});
    const nRooms=rooms.length-pages.length,nOv=rooms.filter(function(r){return r&&r.overview;}).length,nFp=rooms.filter(function(r){return r&&r.floorplan&&!r.overview;}).length;
    const nSec=Array.isArray(c.sections)?c.sections.length:0;
    const empty=!rooms.length&&rocIsStubImg(c.base_image)&&!c.base_camera&&!['zones','icons','labels','badges','gauges','blinds','elements','overlays','vacuum_widgets'].some(function(k){return Array.isArray(c[k])&&c[k].length;});
    const sum=empty?'A new card — nothing configured yet.':[rooms.length?nRooms+' room'+(nRooms===1?'':'s'):'one room (no rooms list)',nOv?'overview page':'',nFp?nFp+' floor plan page'+(nFp===1?'':'s'):'',nSec?nSec+' section'+(nSec===1?'':'s'):''].filter(Boolean).join(' · ');
    const btn=function(id,icon,label,primary){return'<button id="'+id+'" type="button" style="padding:'+(primary?'10px 18px':'8px 14px')+';border-radius:8px;border:'+(primary?'none':'1px solid var(--primary-color)')+';background:'+(primary?'var(--primary-color)':'none')+';color:'+(primary?'var(--text-primary-color,#fff)':'var(--primary-color)')+';cursor:pointer;font-size:'+(primary?'14px':'13px')+';font-weight:600;display:inline-flex;align-items:center;gap:8px;"><ha-icon icon="'+icon+'" style="--mdc-icon-size:'+(primary?'20px':'18px')+';"></ha-icon>'+label+'</button>';};
    this.innerHTML='<div class="roc-ed roc-launch" style="padding:8px;">'
      +'<div style="display:flex;align-items:baseline;gap:8px;padding:0 4px 10px;"><span style="font-weight:600;font-size:13px;">Room Overlay Card</span><span style="font-size:11px;color:var(--secondary-text-color);">v'+e(ROC_VERSION)+'</span></div>'
      +'<div style="margin:0 4px 12px;padding:16px;border:1px solid var(--divider-color);border-radius:12px;background:var(--secondary-background-color,rgba(127,127,127,.08));">'
        +'<div style="font-size:15px;font-weight:600;margin-bottom:6px;">Room Card Studio</div>'
        +'<div style="font-size:13px;line-height:1.5;color:var(--secondary-text-color);margin-bottom:12px;">This card is edited in the Studio: the card on a large canvas, drag and drop, a form for every setting, undo, the overview and floor plan pages. Changes come back here and are saved with the dashboard as usual.</div>'
        +'<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">'
          +(empty?btn('roc-wizard','mdi:auto-fix','Start with the wizard',true)+btn('roc-studio','mdi:fullscreen','Open Studio',false)
                 :btn('roc-studio','mdi:fullscreen','Open Studio',true)+btn('roc-wizard','mdi:auto-fix','Wizard',false))
        +'</div>'
        +'<div id="roc-studio-msg" style="font-size:12px;color:var(--error-color);margin-top:8px;"></div>'
        +'<div data-roc-summary style="font-size:12px;color:var(--secondary-text-color);margin-top:10px;">'+e(sum)+'</div>'
      +'</div>'
      +'<div style="margin:0 4px 12px;display:flex;flex-direction:column;gap:8px;">'
        +'<label title="Vibrates on tap/hold actions, and on the moment a hold registers (mobile browsers that support it)." style="display:inline-flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input id="roc-l-haptic" type="checkbox"'+(c.haptic!==false?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><ha-icon icon="mdi:vibrate" style="--mdc-icon-size:16px;"></ha-icon>Haptic feedback</label>'
        +(c.test_mode?'<label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input id="roc-l-tm" type="checkbox" checked style="width:16px;height:16px;cursor:pointer;">Edit mode (legacy, saved in the card — switch it off)</label>':'')
        +'<div style="font-size:12px;color:var(--secondary-text-color);line-height:1.5;"><ha-icon icon="mdi:code-braces" style="--mdc-icon-size:15px;vertical-align:-3px;"></ha-icon> YAML: <b>Show code editor</b> in this dialog — or <b>YAML</b> in the Studio.</div>'
      +'</div>'
      +'<div style="margin:0 4px;padding-top:10px;border-top:1px solid var(--divider-color);display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--secondary-text-color);">'
        +'<button id="roc-classic" type="button" style="padding:4px 10px;border-radius:6px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:12px;">Classic editor</button>'
        +'<span>The tabbed editor of 6.x, for one more release (removed in 7.1).</span>'
      +'</div>'
      +'</div>';
    const open=function(wiz){
      const m=self.querySelector('#roc-studio-msg');if(m)m.textContent='';
      const b=self.querySelector(wiz?'#roc-wizard':'#roc-studio');if(b)b.disabled=true;
      rocOpenStudio(Object.assign({from:'editor',editor:self,hass:self._hass},wiz?{wizard:true}:{}))
        .catch(function(err){const mm=self.querySelector('#roc-studio-msg');if(mm)mm.textContent=(err&&err.message)||String(err);})
        .then(function(){if(b)b.disabled=false;});
    };
    const sb=this.querySelector('#roc-studio');if(sb)sb.addEventListener('click',function(){open(false);});
    const wb=this.querySelector('#roc-wizard');if(wb)wb.addEventListener('click',function(){open(true);});
    const hp=this.querySelector('#roc-l-haptic');
    if(hp)hp.addEventListener('change',function(){const nc=Object.assign({},self._config);if(hp.checked)delete nc.haptic;else nc.haptic=false;self._config=nc;self._fire(nc);});
    const tm=this.querySelector('#roc-l-tm');
    if(tm)tm.addEventListener('change',function(){const nc=Object.assign({},self._config);if(!tm.checked)delete nc.test_mode;self._config=nc;self._fire(nc);self._renderLauncher();});
    const cl=this.querySelector('#roc-classic');if(cl)cl.addEventListener('click',function(){self._setClassic(true);});
  }
  _render(){
    if(!this._config)return;
    if(!this._isClassic()){this._renderLauncher();return;}
    this._actOrig={};
    this._hintsDone=false;
    const c=this._config;
    const cR=this._roomView();
    const hasRooms=Array.isArray(c.rooms)&&c.rooms.length>0;
    const open=new Set();
    this.querySelectorAll('details[data-panel]').forEach(function(d){if(d.open)open.add(d.dataset.panel);});
    this._openPanels=open;
    const firstRender=open.size===0;

    const sec=function(id,label,count,inner,icon){
      const isOpen=open.has(id)||(firstRender&&(id==='basic'||id==='room-identity'));
      const _d=label.indexOf(' — ');
      const _nm=_d>=0?label.slice(0,_d):label;
      const _ds=_d>=0?label.slice(_d+3):'';
      const _badge=count!==undefined?'<span style="min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:'+(count?'var(--primary-color)':'var(--divider-color)')+';color:'+(count?'#fff':'var(--secondary-text-color)')+';font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none;">'+count+'</span>':'';
      return '<details data-panel="'+id+'"'+(isOpen?' open':'')+' style="margin-bottom:8px;">'
        +'<summary style="cursor:pointer;padding:10px 12px;background:var(--secondary-background-color);border-radius:6px;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;">'
        +'<span style="display:flex;align-items:center;gap:10px;min-width:0;">'
        +'<ha-icon icon="'+(icon||'mdi:shape-outline')+'" style="--mdc-icon-size:20px;color:var(--primary-color);flex:none;"></ha-icon>'
        +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><span style="font-size:13px;font-weight:600;color:var(--primary-text-color);">'+_nm+'</span>'+(_ds?'<span style="font-size:12px;color:var(--secondary-text-color);margin-left:6px;">'+_ds+'</span>':'')+'</span>'
        +'</span>'
        +'<span style="display:flex;align-items:center;gap:8px;flex:none;">'+_badge+'<ha-icon icon="mdi:chevron-down" style="--mdc-icon-size:20px;color:var(--secondary-text-color);"></ha-icon></span>'
        +'</summary>'
        +'<div style="padding:12px;border:1px solid var(--divider-color);border-top:none;border-radius:0 0 6px 6px;margin-top:-1px;">'+inner+'</div>'
        +'</details>';
    };

    const btnStyle='padding:6px 14px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:13px;';

    let basicInner='<div style="display:grid;gap:8px;">';
    if(cR&&cR.overview&&!this._editGlobal)basicInner+='<div style="padding:10px 12px;border-radius:6px;background:var(--secondary-background-color);font-size:12px;line-height:1.5;">This room is an <b>overview page</b> — its photo and elements are not shown. Set it up in <b>Rooms &amp; menu → Overview page</b>.</div>';
    else if(cR&&cR.floorplan&&!this._editGlobal)basicInner+='<div style="padding:10px 12px;border-radius:6px;background:var(--secondary-background-color);font-size:12px;line-height:1.5;">This room is a <b>floor plan page</b> (v6.47.0) — its photo and elements are not shown. Draw the plan, import it from an AnyVac vacuum map and pick a theme in <b>Room Card Studio</b> (the floor plan is edited there only; the YAML box keeps it as it is).</div>';
    const _bgMode=this._bgMode||(cR.base_camera?'camera':'image');
    basicInner+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;">';
    basicInner+='<div><label class="roc-l">Background</label><select id="bg-mode"'+this._inp('')+'>';
    basicInner+='<option value="image"'+(_bgMode==='image'?' selected':'')+'>Image — static file or URL</option>';
    basicInner+='<option value="camera"'+(_bgMode==='camera'?' selected':'')+'>Camera — periodic snapshot</option>';
    basicInner+='</select></div>';
    basicInner+='<div style="display:flex;align-items:center;gap:8px;padding-bottom:6px;"><input id="zoom" type="checkbox"'+(c.zoom?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label style="font-size:13px;cursor:pointer;" for="zoom">Pan &amp; pinch-zoom (floorplan mode)</label></div>';
    basicInner+='</div>';
    basicInner+='<div id="bg-pane-image" style="display:'+(_bgMode==='image'?'block':'none')+';">';
    basicInner+='<div><label class="roc-l">Base image URL (required, unless using a camera above)</label><input id="base_image" type="text" placeholder="/local/images/room.webp" value="'+this._e(cR.base_image||'')+'"'+this._inp('')+'></div>';
    const _bicYaml=cR.base_image_conditions?_yaml.s(cR.base_image_conditions):'';
    basicInner+='<div style="margin-top:8px;"><label class="roc-l">Base image conditions (optional — swap image by entity state)</label><textarea id="base_image_conditions" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_bicYaml)+'</textarea></div>';
    basicInner+='</div>';
    basicInner+='<div id="bg-pane-camera" style="display:'+(_bgMode==='camera'?'grid':'none')+';grid-template-columns:2fr 1fr;gap:8px;">';
    basicInner+='<div><label class="roc-l">Base camera (live snapshot as background)</label><input id="base_camera" type="text" list="roc-ent-camera" placeholder="camera.living_room" value="'+this._e(cR.base_camera||'')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label class="roc-l">Snapshot refresh (s) — a periodic photo, not a continuous video stream</label><input id="camera_refresh" type="number" min="2" step="1" value="'+(cR.camera_refresh??10)+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    basicInner+='<div style="margin-top:8px;">'+this._actFieldsHtml('room',{tap:cR.tap_action},{slots:['tap'],labels:{tap:'Tap on the image'}})+'</div>';
    const _caY=cR.cards_above?_yaml.s(cR.cards_above):'';
    const _cbY=cR.cards_below?_yaml.s(cR.cards_below):'';
    basicInner+='<div class="roc-adv" style="border-top:1px dashed var(--divider-color);margin-top:6px;padding-top:8px;"><label class="roc-l" style="margin-bottom:2px;">Companion cards — paste card YAML to stack full Home Assistant cards above / below the image (handy on mobile). A YAML list; each item is a card config, or <code>{card: {...}, height, media: all|mobile|tablet|desktop|ultrawide}</code>.</label></div>';
    basicInner+='<div><label class="roc-l">Cards above image (YAML)</label><textarea id="cards_above_yaml" rows="4" placeholder="- type: entities&#10;  entities: [light.kitchen]"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_caY)+'</textarea></div>';
    basicInner+='<div><label class="roc-l">Cards below image (YAML)</label><textarea id="cards_below_yaml" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_cbY)+'</textarea></div>';
    const _woEd=typeof cR.weather_overlay==='string'?{entity:cR.weather_overlay}:(cR.weather_overlay||{});
    basicInner+='<div style="border-top:1px dashed var(--divider-color);margin-top:6px;padding-top:8px;display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;">';
    basicInner+='<div><label class="roc-l">Weather overlay entity (optional — rain/snow effect)</label><input id="weather_entity" type="text" list="roc-ent-weather" placeholder="weather.home" value="'+this._e(_woEd.entity||'')+'"'+this._inp('')+'></div>';
    basicInner+='<div><label class="roc-l">Effect</label><select id="weather_effect"'+this._inp('')+'>';
    ['auto','rain','rain-heavy','snow','snow-heavy','fog','lightning'].forEach(function(ef){basicInner+='<option value="'+ef+'"'+((_woEd.effect||'auto')===ef?' selected':'')+'>'+ef+'</option>';});
    basicInner+='</select></div>';
    basicInner+='<div><label class="roc-l">Opacity</label><input id="weather_opacity" type="number" step="0.05" min="0" max="1" value="'+(_woEd.opacity??0.45)+'"'+this._inp('')+'></div>';
    basicInner+='</div>';
    if(this._config&&this._config.nav&&this._config.nav.live==='custom')basicInner+='<div style="display:flex;align-items:center;gap:7px;margin-top:6px;"><input id="weather-nav-mini" type="checkbox"'+(cR.weather_nav_mini===true?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="weather-nav-mini" style="font-size:12px;cursor:pointer;">Show weather in nav.live: custom mini</label></div>';
    basicInner+='</div>';

    let filterInner='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;">Conditions are evaluated in order — first match wins. A block without an entity is the default (fallback).</p>';
    filterInner+='<div id="filter-blocks">';
    const self=this;
    (cR.filter_conditions||[]).forEach(function(fc,i){filterInner+=self._filterBlock(fc,i);});
    filterInner+='</div>';
    filterInner+='<button id="add-filter" style="'+btnStyle+'">+ Add filter condition</button>';

    const bm=cR.brightness_model||{};
    const bmSrcList=bm.source||[];
    const bmFgList=bm.filter_gradient||[];
    let bmInner='';
    bmInner+='<div style="margin-bottom:10px;">';
    bmInner+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    bmInner+='<label style="font-size:12px;font-weight:500;">Value sources (first matching condition wins)</label>';
    bmInner+='<button id="add-bm-src" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Source</button>';
    bmInner+='</div>';
    for(let i=0;i<bmSrcList.length;i++){
      const src=bmSrcList[i];
      const condYaml=src.condition?_yaml.s(src.condition):'';
      bmInner+='<div style="border:1px solid var(--divider-color);border-radius:6px;padding:8px;margin-bottom:6px;">';
      bmInner+='<div style="display:grid;grid-template-columns:1fr 1fr 70px 70px 28px;gap:6px;align-items:end;margin-bottom:6px;">';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Entity</label>';
      bmInner+='<input type="text" list="roc-entities" data-bm-src-ent="'+i+'" value="'+this._e(src.entity||'')+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Attribute (optional)</label>';
      bmInner+='<input data-bm-src-attr="'+i+'" type="text" value="'+this._e(src.attribute||'')+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Min</label>';
      bmInner+='<input data-bm-src-min="'+i+'" type="number" value="'+(src.min_input??0)+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Max</label>';
      bmInner+='<input data-bm-src-max="'+i+'" type="number" value="'+(src.max_input??100)+'"'+this._inp('font-size:12px;')+'></div>';
      bmInner+='<button data-rm-bm-src="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;align-self:center;">&#x2715;</button>';
      bmInner+='</div>';
      bmInner+='<div><label style="font-size:11px;display:block;margin-bottom:3px;">Condition YAML (optional — leave empty = always matches)</label>';
      bmInner+='<textarea data-bm-src-cond="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:11px;resize:vertical;')+'>';
      bmInner+=this._e(condYaml)+'</textarea></div>';
      bmInner+='</div>';
    }
    if(!bmSrcList.length)bmInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0;">No sources — add at least one source entity.</p>';
    bmInner+='</div>';
    bmInner+='<div>';
    bmInner+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    bmInner+='<label style="font-size:12px;font-weight:500;">Filter gradient stops (value = 0–100 %)</label>';
    bmInner+='<button id="add-bm-fg" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Stop</button>';
    bmInner+='</div>';
    for(let i=0;i<bmFgList.length;i++){
      bmInner+='<div style="display:grid;grid-template-columns:70px 1fr 28px;gap:6px;align-items:center;margin-bottom:4px;">';
      bmInner+='<input type="number" data-bm-fg-val="'+i+'" min="0" max="100" placeholder="%" value="'+bmFgList[i].value+'"'+this._inp('font-size:12px;')+'>';
      bmInner+='<input type="text" data-bm-fg-filt="'+i+'" placeholder="e.g. brightness(0.5) sepia(0.3)" value="'+this._e(bmFgList[i].filter||'')+'"'+this._inp('font-size:12px;font-family:monospace;')+'>';
      bmInner+='<button data-rm-bm-fg="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';
      bmInner+='</div>';
    }
    if(!bmFgList.length)bmInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0;">No stops — add at least 2 stops (value 0 and 100).</p>';
    bmInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:6px 0 0;">Source value is normalized to 0–100 % and interpolated across stops.</p>';
    bmInner+='</div>';
    // Unified filter section — one mode toggle picks discrete vs smooth; only the
    // active mode is kept on save (they're mutually exclusive at runtime).
    const _fMode=this._filterMode||(cR.brightness_model?'smooth':'conditional');
    const _fCount=_fMode==='smooth'?((bm.source?.length||0)+(bm.filter_gradient?.length||0)):(cR.filter_conditions||[]).length;
    let filtCombined='<div style="margin-bottom:12px;"><label class="roc-l">Filter mode</label><select id="filter-mode"'+this._inp('')+'>';
    filtCombined+='<option value="conditional"'+(_fMode==='conditional'?' selected':'')+'>Conditional — discrete states (first match wins)</option>';
    filtCombined+='<option value="smooth"'+(_fMode==='smooth'?' selected':'')+'>Smooth — interpolate from a sensor (brightness model)</option>';
    filtCombined+='</select></div>';
    filtCombined+='<div style="margin-bottom:12px;"><label class="roc-l">Filter transition</label><input id="filter_transition" type="text" value="'+this._e(c.filter_transition||'2s ease')+'"'+this._inp('')+'></div>';
    filtCombined+='<div id="filter-pane-conditional" style="'+(_fMode==='conditional'?'':'display:none;')+'">'+filterInner+'</div>';
    filtCombined+='<div id="filter-pane-smooth" style="'+(_fMode==='smooth'?'':'display:none;')+'">'+bmInner+'</div>';

    let ovInner='<div id="ov-list">';
    (cR.overlays||[]).forEach(function(ov,i){ovInner+=self._ovItem(ov,i);});
    ovInner+='</div><button id="add-ov" style="'+btnStyle+'margin-top:4px;">+ Add overlay</button>';

    let zInner='<div id="z-list">';
    (cR.zones||[]).forEach(function(z,i){zInner+=self._zoneItem(z,i);});
    zInner+='</div><button id="add-z" style="'+btnStyle+'margin-top:4px;">+ Add zone</button>';

    let bInner='<div id="b-list">';
    (cR.badges||[]).forEach(function(b,i){bInner+=self._badgeItem(b,i);});
    bInner+='</div><button id="add-b" style="'+btnStyle+'margin-top:4px;">+ Add badge</button>';

    let elInner='<div id="el-list">';
    (cR.elements||[]).forEach(function(el,i){elInner+=self._elItem(el,i);});
    elInner+='</div><button id="add-el" style="'+btnStyle+'margin-top:4px;">+ Add element</button>';

    let icoInner='<div id="ico-list">';
    (cR.icons||[]).forEach(function(ico,i){icoInner+=self._icoItem(ico,i);});
    icoInner+='</div><button id="add-ico" style="'+btnStyle+'margin-top:4px;">+ Add icon</button>';

    let vwInner='<div id="vw-list">';
    (cR.vacuum_widgets||[]).forEach(function(vw,i){vwInner+=self._vwItem(vw,i);});
    vwInner+='</div><button id="add-vw" style="'+btnStyle+'margin-top:4px;">+ Add vacuum widget</button>';

    let gwInner='<div id="gw-list">';
    (cR.glows||[]).forEach(function(g,i){gwInner+=self._glowItem(g,i);});
    gwInner+='</div><button id="add-gw" style="'+btnStyle+'margin-top:4px;">+ Add light glow</button>';

    let lblInner='<div id="lbl-list">';
    (cR.labels||[]).forEach(function(lbl,i){lblInner+=self._lblItem(lbl,i);});
    lblInner+='</div><button id="add-lbl" style="'+btnStyle+'margin-top:4px;">+ Add label</button>';

    let gInner='<div id="g-list">';
    (cR.gauges||[]).forEach(function(g,i){gInner+=self._gaugeItem(g,i);});
    gInner+='</div><button id="add-g" style="'+btnStyle+'margin-top:4px;">+ Add gauge</button>';

    let blInner='<div id="bl-list">';
    (cR.blinds||[]).forEach(function(b,i){blInner+=self._blindItem(b,i);});
    blInner+='</div><button id="add-bl" style="'+btnStyle+'margin-top:4px;">+ Add blind</button>';

    // Cockpit sections (v6.8.0) — top-level list, not per-room; the read-only
    // "currently collected" preview reuses the card's own collection engine.
    let sectionsInner='<div id="sec-list">';
    const _secCollectedAll=rocCollectSections(c);
    (c.sections||[]).forEach(function(sec,i){
      const entry=_secCollectedAll.find(function(x){return x.def.id===sec.id;});
      sectionsInner+=self._sectionItem(sec,i,(entry&&entry.tiles)||[]);
    });
    sectionsInner+='</div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:4px;"><button id="add-section" style="'+btnStyle+'">+ Add section</button><select id="add-section-recipe"'+this._inp('width:auto;')+'><option value="">Recipe\u2026</option><option value="appliances">Appliances</option><option value="cleaning">Cleaning</option><option value="media">Media</option><option value="heating">Heating</option><option value="covers">Covers</option>'+(customElements.get('electricity-panel-card')?'<option value="electricity">Electricity</option>':'<option value="electricity" disabled>Electricity (needs electricity-panel-card)</option>')+'<option value="weather">Weather</option></select></div>';
    if(!(c.sections||[]).length)sectionsInner+='<p style="font-size:12px;color:var(--secondary-text-color);margin:10px 0 0;">Sections are user-defined buckets for things that aren\'t one room — appliances, media, heating\u2026 Add one, then tag a zone/icon/element/blind in any room with its id via the Section field (Elements tab), pick a Recipe above, or use the scan below.</p>';
    // Onboarding (v6.10.0, COCKPIT_PLAN.md kap.5.3.2) — devices HA knows
    // about in the four spatial-ish domains that aren't reachable from any
    // section yet (neither tagged into one nor covered by an existing
    // `source: auto` section for that domain). Purely a hass.states scan +
    // config read, so it's always current, not a one-shot "run scan" click.
    if(this._hass){
      const _untagged=self._scanUntagged(c);
      if(_untagged.length){
        const _byDom={};
        _untagged.forEach(function(u){(_byDom[u.domain]=_byDom[u.domain]||[]).push(u);});
        const _domRecipe={vacuum:'cleaning',climate:'heating',cover:'covers',media_player:'media'};
        const _domLabel={vacuum:'vacuum',climate:'climate',cover:'cover',media_player:'media player'};
        sectionsInner+='<div style="margin-top:10px;padding:8px;border:1px dashed var(--divider-color);border-radius:6px;"><div style="font-size:12px;font-weight:600;margin-bottom:4px;">Find untagged devices</div>';
        Object.keys(_byDom).forEach(function(dom){
          const list=_byDom[dom];
          sectionsInner+='<div style="font-size:11px;color:var(--secondary-text-color);margin:4px 0;">'+list.length+' '+_domLabel[dom]+' '+(list.length===1?'entity':'entities')+' not in any section ('+list.slice(0,3).map(function(u){return self._e(u.name);}).join(', ')+(list.length>3?'\u2026':'')+') — <button data-add-untagged-recipe="'+_domRecipe[dom]+'" style="padding:2px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;">+ Add a section for these</button></div>';
        });
        sectionsInner+='</div>';
      }
    }

    let grpInner='<div id="grp-list">';
    (cR.groups||[]).forEach(function(g,i){grpInner+=self._groupItem(g,i);});
    grpInner+='</div><button id="add-grp" style="'+btnStyle+'margin-top:4px;">+ Add group</button>';

    // ---- Rooms (multi-room) section ----------------------------------------
    let roomsInner='';
    if(hasRooms){
      const er=cR;
      roomsInner+='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">';
      roomsInner+=self._editGlobal
        ?'<span style="font-size:12px;color:var(--secondary-text-color);">Editing <b>🌐 Global defaults</b> — shared by every room unless a room overrides it. Pick a room in the header above to edit that room instead.</span>'
        :'<span style="font-size:12px;color:var(--secondary-text-color);">Editing <b>'+self._e(er.name||er.id||('room_'+(self._editRoomIdx+1)))+'</b> — pick the room in the header above.</span>';
      const _rcnt=c.rooms.length,_ri=self._editRoomIdx;
      const _navBtn='padding:6px 10px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:13px;line-height:1;';
      roomsInner+='<span style="display:flex;gap:8px;flex:none;align-items:center;">';
      roomsInner+='<button id="room-up" title="Move room earlier"'+(self._editGlobal||_ri<=0?' disabled':'')+' style="'+_navBtn+(self._editGlobal||_ri<=0?'opacity:0.4;cursor:default;':'')+'">&#9650;</button>';
      roomsInner+='<button id="room-down" title="Move room later"'+(self._editGlobal||_ri>=_rcnt-1?' disabled':'')+' style="'+_navBtn+(self._editGlobal||_ri>=_rcnt-1?'opacity:0.4;cursor:default;':'')+'">&#9660;</button>';
      roomsInner+='<button id="add-room" style="'+btnStyle+'">+ Room</button>';
      roomsInner+='<button id="add-ovpage" title="Add an overview page: every room as a tile, tap opens the room" style="'+btnStyle+'">+ Overview</button>';
      roomsInner+='<button id="rm-room" style="padding:6px 14px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:13px;">Remove</button>';
      roomsInner+='</span>';
      roomsInner+='</div>';
      // --- Room identity ---------------------------------------------------
      let riIdentity='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
      riIdentity+='<div><label class="roc-l">Room id</label><input id="room-id" type="text" value="'+this._e(er.id||'')+'"'+this._inp('')+'></div>';
      riIdentity+='<div><label class="roc-l">Name</label><input id="room-name" type="text" value="'+this._e(er.name||'')+'"'+this._inp('')+'></div>';
      riIdentity+='<div><label class="roc-l">Room icon (shown only when nav style = tabs)</label><input id="room-icon" type="text" placeholder="mdi:sofa" value="'+this._e(er.icon||'')+'"'+this._inp('')+'></div>';
      riIdentity+='</div>';
      riIdentity+='<div style="margin-bottom:8px;"><label class="roc-l">Area match (comma-separated states of room_entity that map to this room, e.g. Bermuda area names)</label><input id="room-area-match" type="text" placeholder="Bedroom, Ložnice" value="'+this._e(Array.isArray(er.area_match)?er.area_match.join(', '):'')+'"'+this._inp('')+'></div>';
      const _rch=er.chips?_yaml.s(er.chips):'';
      riIdentity+='<div><label class="roc-l">Thumbnail chips override (YAML list — falls back to nav.chips; {room} = room id)</label><textarea id="room-chips" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_rch)+'</textarea></div>';

      // --- Presence & follow -------------------------------------------------
      let riPresence='<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
      const _reIsObj=typeof c.room_entity==='object'&&c.room_entity;
      riPresence+='<div><label class="roc-l">room_entity (active room follows it — e.g. Bermuda area sensor or input_select)</label><input id="room_entity" type="text" list="roc-entities"'+(_reIsObj?' disabled placeholder="per-device mapping active — edit by_user/by_browser in YAML"':' placeholder="sensor.phone_area"')+' value="'+this._e(typeof c.room_entity==='string'?c.room_entity:'')+'"'+this._inp('')+'></div>';
      riPresence+='<div><label class="roc-l">Follow hold (s after manual switch)</label><input id="follow_hold" type="number" min="0" step="5" value="'+(c.follow_hold??60)+'"'+this._inp('')+'></div>';
      riPresence+='<div><label class="roc-l">card_id (pairing key)</label><input id="card_id" type="text" value="'+this._e(c.card_id||'')+'"'+this._inp('')+'></div>';
      riPresence+='</div>';
      riPresence+='<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-bottom:8px;">';
      riPresence+='<div><label class="roc-l">Follow mode</label><select id="follow_mode"'+this._inp('')+'>';
      [['always','always — follow continuously'],['initial','initial — only when the card loads'],['manual','manual — button / action only']].forEach(function(o){riPresence+='<option value="'+o[0]+'"'+((c.follow_mode||'always')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      riPresence+='</select></div>';
      const _rseIsObj=typeof c.room_state_entity==='object'&&c.room_state_entity;
      riPresence+='<div><label class="roc-l">room_state_entity (card writes the active room here — input_text / input_select)</label><input id="room_state_entity" type="text" list="roc-entities"'+(_rseIsObj?' disabled placeholder="per-device mapping — edit in YAML"':' placeholder="input_text.active_room"')+' value="'+this._e(typeof c.room_state_entity==='string'?c.room_state_entity:'')+'"'+this._inp('')+'></div>';
      riPresence+='</div>';
      const _bidNow=window.browser_mod?.browserID||window.browser_mod?.browser_id||'';
      riPresence+='<div style="border-top:1px dashed var(--divider-color);padding-top:8px;">';
      riPresence+='<label class="roc-l">This device — browser_mod ID: <b>'+this._e(_bidNow||'(browser_mod not detected)')+'</b></label>';
      if(_bidNow){
        riPresence+='<div style="display:grid;grid-template-columns:2fr auto;gap:8px;align-items:end;">';
        riPresence+='<div><label class="roc-l">Presence sensor for this device (e.g. its Bermuda area sensor)</label><input id="bid-entity" type="text" list="roc-entities" placeholder="sensor.tablet_area"'+this._inp('')+'></div>';
        riPresence+='<button id="bid-map" style="'+btnStyle+'">Map this device</button>';
        riPresence+='</div>';
        riPresence+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Adds/updates room_entity.by_browser for this device. Open the editor on each device you want to map.</p>';
      }
      riPresence+='</div>';

      // --- Navigation menu -----------------------------------------------------
      const _nav=(c.nav&&typeof c.nav==='object')?c.nav:{};
      const _navMini=(_nav.mini&&typeof _nav.mini==='object')?_nav.mini:{};
      let riNav='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
      riNav+='<div><label class="roc-l">Style</label><select id="nav-style"'+this._inp('')+'>';
      [['thumbnails','thumbnails — live room minis'],['tabs','tabs — icon + name'],['dots','dots'],['none','none (hide menu)']].forEach(function(o){riNav+='<option value="'+o[0]+'"'+((_nav.style||'thumbnails')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      riNav+='</select></div>';
      riNav+='<div><label class="roc-l">Position</label><select id="nav-position"'+this._inp('')+'>';
      [['top','top'],['bottom','bottom'],['left','left (side rail)'],['right','right (side rail)']].forEach(function(o){riNav+='<option value="'+o[0]+'"'+((_nav.position||'top')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      riNav+='</select></div>';
      riNav+='</div>';
      const _navLiveIsMiniTier=_nav.live==='full'||_nav.live==='custom';
      riNav+='<div style="margin-bottom:8px;"><label class="roc-l">Live thumbnails (mini-room view)</label><select id="nav-live"'+this._inp('')+'>';
      [['','off — base image + filter (classic)'],['composite','composite — base + active overlays + filters (live mini-room)'],['custom','custom — live room minis (real instances, pick which elements show)'],['full','full — live room minis (real instances, everything)']].forEach(function(o){riNav+='<option value="'+o[0]+'"'+((_nav.live||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      riNav+='</select><p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Composite thumbs mirror each room’s current look — lit lamps, day/night filter, conditional base images. Pop-up (grouped) and template-driven overlays are skipped. Full mounts a real, independent copy of each room — gauges, labels, icons, blinds, embedded cards and all — scaled down; heavier on older tablets, test yours with more than a couple of rooms. Custom is the same, but starts empty — tick "Show in mini" on each element you want included (below, and the weather toggle in the Basic tab).</p></div>';
      riNav+='<div id="nav-mini-panel" style="'+(_navLiveIsMiniTier?'':'display:none;')+'border-top:1px dashed var(--divider-color);padding-top:8px;margin-bottom:8px;">';
      riNav+='<label class="roc-l" style="font-weight:600;">Mini-room settings (live: '+(_nav.live==='custom'?'custom':'full')+')</label>';
      riNav+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;align-items:center;">';
      riNav+='<div style="display:flex;align-items:center;gap:7px;"><input id="nav-mini-templates" type="checkbox"'+(_navMini.templates?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="nav-mini-templates" style="font-size:12px;cursor:pointer;">Label/colour templates</label></div>';
      riNav+='<div><label class="roc-l">Camera refresh (s, min 30)</label><input id="nav-mini-camera-refresh" type="number" min="30" step="5" placeholder="30" value="'+(_navMini.camera_refresh!=null?_navMini.camera_refresh:'')+'"'+this._inp('')+'></div>';
      riNav+='<div><label class="roc-l">Reference width (px)</label><input id="nav-mini-width-ref" type="number" min="120" step="10" placeholder="480" value="'+(_navMini.width_ref!=null?_navMini.width_ref:'')+'"'+this._inp('')+'></div>';
      riNav+='</div>';
      riNav+=(_nav.live==='custom'
        ?'<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Nothing shows in the mini until you tick "Show in mini" on it — look for the checkbox on each gauge/label/icon/badge/blind/element panel below (and the weather toggle in the Basic tab). Templates and camera streams are extra per-room subscriptions — off by default regardless.</p>'
        :'<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Templates and camera streams are extra per-room subscriptions — off by default. Every mini shows everything unconditionally; switch to "custom" above to pick individual elements instead.</p>');
      riNav+='</div>';
      riNav+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
      riNav+='<div><label class="roc-l">Height</label><input id="nav-height" type="text" placeholder="64px" value="'+this._e(_nav.height||'')+'"'+this._inp('')+'></div>';
      riNav+='<div><label class="roc-l">Item width (css or auto)</label><input id="nav-width" type="text" placeholder="auto / 120px" value="'+this._e(_nav.width||'')+'"'+this._inp('')+'></div>';
      riNav+='<div><label class="roc-l">Mobile height</label><input id="nav-mobile-height" type="text" placeholder="48px" value="'+this._e(_nav.mobile_height||'')+'"'+this._inp('')+'></div>';
      riNav+='</div>';
      // v6.25.0 thumbnail rows + strip-card position
      const _nrv=function(p){const r=_nav.rows;const x=(r!=null&&typeof r==='object')?r[p]:r;return parseInt(x,10)>1?parseInt(x,10):'';};
      const _cpCur=_nav.cards_position;const _cpObj=_cpCur!=null&&typeof _cpCur==='object';
      riNav+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px;">';
      riNav+='<div><label class="roc-l">Thumbnail rows — portrait</label><input id="nav-rows-portrait" type="number" min="1" max="6" step="1" placeholder="1" value="'+_nrv('portrait')+'"'+this._inp('')+'></div>';
      riNav+='<div><label class="roc-l">Thumbnail rows — landscape</label><input id="nav-rows-landscape" type="number" min="1" max="6" step="1" placeholder="1" value="'+_nrv('landscape')+'"'+this._inp('')+'></div>';
      riNav+='<div><label class="roc-l">Strip cards</label><select id="nav-cards-pos"'+this._inp('')+'>';
      [['','auto — below on portrait, beside on landscape'],['side','beside the thumbnails (all rows tall)'],['below','own row below the thumbnails']].concat(_cpObj?[['__yaml','per profile (set in YAML)']]:[]).forEach(function(o){riNav+='<option value="'+o[0]+'"'+((_cpObj?'__yaml':(_cpCur||''))===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      riNav+='</select></div>';
      riNav+='</div>';
      riNav+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 8px;">Rows split the thumbnails into a grid (6 rooms × 2 rows = 3 + 3). Each row is <i>Height</i> tall (<i>Mobile height</i> on portrait). "Strip cards" are the cards from the YAML list below — e.g. an alert ticker; give one a <code>width</code> to fix its share of the strip.</p>';
      riNav+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;align-items:center;">';
      riNav+='<div><label class="roc-l">Wheel switch</label><select id="nav-wheel"'+this._inp('')+'>';
      const _whCur=(_nav.wheel===true?'horizontal':(_nav.wheel||''));
      [['','off'],['horizontal','horizontal'],['vertical','vertical'],['both','both']].forEach(function(o){riNav+='<option value="'+o[0]+'"'+(_whCur===o[0]?' selected':'')+'>'+o[1]+'</option>';});
      riNav+='</select></div>';
      riNav+='<div style="display:flex;align-items:center;gap:7px;padding-top:18px;"><input id="nav-follow-btn" type="checkbox"'+(_nav.follow_button!==false?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="nav-follow-btn" style="font-size:12px;cursor:pointer;">Follow button</label></div>';
      riNav+='</div>';
      const _chY=_nav.chips?_yaml.s(_nav.chips):'';
      riNav+='<div><label class="roc-l">Chips (YAML list — sensor pills on thumbnails; {room} = room id)</label><textarea id="nav-chips" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_chY)+'</textarea></div>';
      const _cdY=_nav.cards?_yaml.s(_nav.cards):'';
      riNav+='<div style="margin-top:6px;"><label class="roc-l">Cards (YAML list — custom HA cards in the strip; keys: card, width, placement, media)</label><textarea id="nav-cards" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(_cdY)+'</textarea></div>';

      // --- Deep-linking ---------------------------------------------------
      const _usCur=c.url_sync,_usOn=!!_usCur,_usKey=(typeof _usCur==='string')?_usCur:'';
      let riDeep='<div style="display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:center;">';
      riDeep+='<div style="display:flex;align-items:center;gap:7px;padding-top:18px;"><input id="url-sync" type="checkbox"'+(_usOn?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><label for="url-sync" style="font-size:12px;cursor:pointer;">Sync room to URL</label></div>';
      riDeep+='<div><label class="roc-l">URL hash key (blank = "room" → #room=&lt;id&gt;)</label><input id="url-sync-key" type="text" placeholder="room" value="'+this._e(_usKey)+'"'+this._inp('')+'></div>';
      riDeep+='</div>';
      riDeep+='<p style="font-size:11px;color:var(--secondary-text-color);margin:8px 0 0;line-height:1.5;">Puts the active room in the page URL as <code>#'+this._e(_usKey||'room')+'=&lt;id&gt;</code> — bookmarkable, and lets HA\'s own dashboard navigation land on a specific room.</p>';

      roomsInner+=sec('room-identity','Room identity — id, name, icon, area match',undefined,riIdentity,'mdi:home-account');
      roomsInner+=sec('room-presence','Presence &amp; follow — which room is "active", and how',undefined,riPresence,'mdi:radar');
      roomsInner+=sec('room-nav','Navigation menu — style, live thumbnails, sizing, chips &amp; cards',undefined,riNav,'mdi:menu');
      roomsInner+=sec('room-deeplink','Deep-linking — bookmarkable room URL',undefined,riDeep,'mdi:link-variant');
      if(!self._editGlobal)roomsInner+=this._ovEdHtml(c,er,sec); // overview page / tile (v6.30.0)
    }else{
      roomsInner+='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;">Single-room card. Convert to multi-room to get the thumbnail room switcher, swipe navigation, switch-room actions and room_entity follow (e.g. Bermuda).</p>';
      roomsInner+='<button id="conv-rooms" style="'+btnStyle+'">Convert to multi-room</button>';
      // Onboarding (v6.10.0, COCKPIT_PLAN.md kap.5.3.1) — offered only when
      // hass actually exposes the modern area registry (hass.areas/devices/
      // entities, plain synchronous dictionaries — no websocket round-trip).
      // Older HA without them simply never shows the button (graceful
      // degradation by omission, not an error).
      if(this._hass&&this._hass.areas){
        const _areaN=Object.keys(this._hass.areas).length;
        if(_areaN>0)roomsInner+='<p style="font-size:12px;color:var(--secondary-text-color);margin:10px 0 6px;">I found '+_areaN+' area'+(_areaN===1?'':'s')+' in Home Assistant.</p><button id="bootstrap-areas" style="'+btnStyle+'">Create a room for each area</button>';
      }
    }

    // ---- First-run onboarding + tabbed editor (v1.14.1) ---------------------
    const _nArr=function(k){return Array.isArray(cR[k])?cR[k].length:0;};
    const _realImg=!rocIsStubImg(cR.base_image);
    const _isEmpty=!hasRooms&&!_realImg&&!cR.base_camera&&(_nArr('zones')+_nArr('icons')+_nArr('labels')+_nArr('badges')+_nArr('gauges')+_nArr('blinds')+_nArr('elements')+_nArr('overlays')+_nArr('vacuum_widgets'))===0;
    const _onboardHtml=
      '<div style="padding:18px 14px;border:1px dashed var(--divider-color);border-radius:10px;text-align:center;">'
      +'<div style="font-size:15px;font-weight:600;margin-bottom:6px;">Build your room card</div>'
      +'<div style="font-size:12px;color:var(--secondary-text-color);margin:0 auto 14px;max-width:430px;line-height:1.5;">Start with a background — a floor-plan or room photo. Then open the <b>Studio</b> (button above) to place and drag elements on it. The rest of the editor appears once a background is set.</div>'
      // v6.46.0: the studio's new-card wizard builds the card from Home Assistant's areas
      +'<button id="roc-wizard" type="button" style="padding:8px 14px;border-radius:6px;border:none;background:var(--primary-color);color:var(--text-primary-color,#fff);cursor:pointer;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:6px;margin:0 auto 6px;"><ha-icon icon="mdi:auto-fix" style="--mdc-icon-size:18px;"></ha-icon>Start with the wizard</button>'
      +'<div style="font-size:11px;color:var(--secondary-text-color);margin:0 auto 14px;max-width:430px;">One room per Home Assistant area — names, pictures, lights and sections filled in for you. Or set a background yourself:</div>'
      +'<div style="max-width:430px;margin:0 auto;text-align:left;">'
      +'<label class="roc-l">Background image URL *</label>'
      +'<input id="base_image" type="text" placeholder="/local/room.webp or https://…" value="'+this._e(_realImg?cR.base_image:'')+'"'+this._inp('')+'>'
      +'<div style="font-size:11px;color:var(--secondary-text-color);margin:10px 0 4px;">… or use a live camera snapshot instead:</div>'
      +'<input id="base_camera" type="text" list="roc-ent-camera" placeholder="camera.living_room" value="'+this._e(cR.base_camera||'')+'"'+this._inp('')+'>'
      +'</div></div>';
    // Layout tab (v4) — two profiles (portrait/landscape) on a % grid of the viewport
    const _ly=c.layout||{};
    const _lyH=_ly.height||'viewport';
    const _lyHMode=(_lyH==='viewport'||_lyH==='fill'||_lyH==='container')?_lyH:'custom';
    const _lyOr=(typeof _ly.orientation==='string')?_ly.orientation:'auto';
    const _lyPin=(_ly.orientation&&typeof _ly.orientation==='object')?_ly.orientation:null;
    const _bidNowL=window.browser_mod?.browserID||window.browser_mod?.browser_id||'';
    const _pinVal=(_lyPin&&_bidNowL&&_lyPin.by_browser)?(_lyPin.by_browser[_bidNowL]||''):'';
    let respInner='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;line-height:1.5;">Two layout profiles — <b>portrait</b> / <b>landscape</b> — picked by the viewport&#39;s width/height ratio (not by device type). Each profile is a % grid of the available screen and every block (region) gets a cell. <b>You own the percentages</b> (rows should sum to &le;100). In the <b>Studio</b>, Arrange shows the region outlines and the Tablet / Tablet portrait / Phone frames switch between the profiles.</p>';
    respInner+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;">';
    respInner+='<div><label class="roc-l">Height</label><select id="ly-hmode"'+this._inp('')+'><option value="viewport"'+(_lyHMode==='viewport'?' selected':'')+'>viewport (full view — desktop/tablet; phones size to content)</option><option value="fill"'+(_lyHMode==='fill'?' selected':'')+'>fill (full view, phones too — v6.13.0)</option><option value="container"'+(_lyHMode==='container'?' selected':'')+'>container (parent)</option><option value="custom"'+(_lyHMode==='custom'?' selected':'')+'>custom&#8230;</option></select></div>';
    respInner+='<div><label class="roc-l">Custom height</label><input id="ly-hcustom" type="text" placeholder="e.g. 90vh / 800px" value="'+this._e(_lyHMode==='custom'?String(_lyH):'')+'"'+this._inp('')+'></div>';
    respInner+='<div><label class="roc-l">Orientation</label><select id="ly-orient"'+this._inp('')+'><option value="auto"'+(_lyOr==='auto'?' selected':'')+'>auto (by ratio)</option><option value="portrait"'+(_lyOr==='portrait'?' selected':'')+'>always portrait</option><option value="landscape"'+(_lyOr==='landscape'?' selected':'')+'>always landscape</option></select></div>';
    respInner+='<div><label class="roc-l">Threshold (w/h)</label><input id="ly-threshold" type="number" step="0.05" min="0.1" placeholder="1.0" value="'+(_ly.threshold!=null?_ly.threshold:'')+'"'+this._inp('')+'></div>';
    respInner+='</div>';
    respInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;align-items:end;">';
    respInner+='<div><label class="roc-l">Pin THIS device (browser_mod: '+this._e(_bidNowL||'not detected')+')</label><select id="ly-pin"'+this._inp('')+(_bidNowL?'':' disabled')+'><option value=""'+(!_pinVal?' selected':'')+'>&#8212; follow auto &#8212;</option><option value="portrait"'+(_pinVal==='portrait'?' selected':'')+'>portrait</option><option value="landscape"'+(_pinVal==='landscape'?' selected':'')+'>landscape</option></select></div>';
    respInner+='<div><label class="roc-l">Grid gap</label><input id="ly-gap" type="text" placeholder="0px" value="'+this._e(_ly.gap||'')+'"'+this._inp('')+'></div>';
    respInner+='<div style="font-size:11px;color:var(--secondary-text-color);line-height:1.4;">Pinning forces this device&#39;s profile even when rotated (<code>layout.orientation.by_browser</code>).</div>';
    respInner+='</div>';
    // Per-profile grid editors
    const _regListEd=['nav','cards_above','image','lights','cards_below','cover'];
    const _profBox=function(pk){
      const lp=_ly[pk]||{};
      const _csv=function(a){return Array.isArray(a)?a.map(function(x){return String(x);}).join(', '):'';};
      let h='<div style="border:1px solid var(--divider-color);border-radius:8px;padding:10px;margin-bottom:12px;">';
      h+='<label class="roc-l" style="font-weight:700;font-size:13px;letter-spacing:0.03em;">'+pk.toUpperCase()+'</label>';
      h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0 8px;">';
      h+='<div><label class="roc-l">Rows % (comma separated)</label><input id="ly-rows__'+pk+'" type="text" placeholder="e.g. 10, 10, 70, 5, 5" value="'+self._e(_csv(lp.rows))+'"'+self._inp('font-size:12px;')+'></div>';
      h+='<div><label class="roc-l">Columns % (comma separated)</label><input id="ly-cols__'+pk+'" type="text" placeholder="100" value="'+self._e(_csv(lp.columns))+'"'+self._inp('font-size:12px;')+'></div>';
      h+='</div>';
      h+='<div style="display:grid;grid-template-columns:110px 1fr 1fr 60px;gap:6px;align-items:center;font-size:11px;color:var(--secondary-text-color);"><span></span><span>Row (3 or 1/6)</span><span>Column</span><span>Scroll</span></div>';
      _regListEd.forEach(function(rg){
        const pl=(lp.place&&lp.place[rg])||null;
        h+='<div style="display:grid;grid-template-columns:110px 1fr 1fr 60px;gap:6px;align-items:center;margin-top:4px;">';
        h+='<label class="roc-l" style="margin:0;">'+rg+'</label>';
        h+='<input id="ly-r__'+pk+'__'+rg+'" type="text" placeholder="hidden" value="'+self._e(pl&&pl.row!=null?String(pl.row):'')+'"'+self._inp('font-size:12px;')+'>';
        h+='<input id="ly-c__'+pk+'__'+rg+'" type="text" placeholder="1" value="'+self._e(pl&&pl.col!=null?String(pl.col):'')+'"'+self._inp('font-size:12px;')+'>';
        h+='<input id="ly-o__'+pk+'__'+rg+'" type="checkbox"'+(pl&&pl.overflow==='auto'?' checked':'')+' style="width:16px;height:16px;cursor:pointer;justify-self:center;">';
        h+='</div>';
      });
      h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:8px 0 0;line-height:1.5;">Empty <b>Row</b> = region hidden in this profile. Spans use CSS grid lines: <code>1/6</code> = rows 1&#8211;5. The <b>cover</b> region shows blinds whose control placement is <code>dock</code>; <code>float</code> controls stay as tap-reveal overlays on the image.</p>';
      h+='<div style="margin-top:10px;"><label class="roc-l" style="margin-bottom:4px;">Preview <span style="font-weight:400;color:var(--secondary-text-color);">(illustrative diagram, not a live render)</span></label>';
      h+='<div id="ly-preview__'+pk+'" style="height:120px;border:1px dashed var(--divider-color);border-radius:6px;padding:4px;box-sizing:border-box;background:rgba(255,255,255,0.02);">'+rocLyPreviewHtml(lp)+'</div></div>';
      h+='</div>';
      return h;
    };
    const _lySub=this._lySub==='landscape'?'landscape':'portrait';
    const _lySubDef=[['portrait','mdi:crop-portrait','Portrait'],['landscape','mdi:crop-landscape','Landscape']];
    respInner+='<div style="display:flex;gap:6px;margin-bottom:10px;">'+_lySubDef.map(function(d){
      const pk=d[0],icon=d[1],label=d[2],on=_lySub===pk;
      return '<button data-rocsub="'+pk+'" type="button" style="padding:5px 14px;border-radius:999px;font-size:12px;font-weight:'+(on?'700':'400')+';border:1px solid '+(on?'var(--primary-color)':'var(--divider-color)')+';background:'+(on?'rgba(3,169,244,0.15)':'none')+';color:'+(on?'var(--primary-color)':'var(--primary-text-color)')+';cursor:pointer;display:inline-flex;align-items:center;gap:5px;"><ha-icon icon="'+icon+'" style="--mdc-icon-size:16px;"></ha-icon>'+label+'</button>';
    }).join('')+'</div>';
    respInner+='<div data-rocsubpanel="portrait" style="display:'+(_lySub==='portrait'?'block':'none')+';">'+_profBox('portrait')+'</div>';
    respInner+='<div data-rocsubpanel="landscape" style="display:'+(_lySub==='landscape'?'block':'none')+';">'+_profBox('landscape')+'</div>';
    // Per-profile scalar inputs — fill only Landscape to use one value everywhere.
    const _profRow=function(idb,label,val,ph){
      const isObj=val&&typeof val==='object';
      const sc=(val!=null&&!isObj)?String(val):'';
      let h='<div style="margin-bottom:8px;"><label class="roc-l">'+label+'</label>';
      h+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';
      ROC_PROFILES.forEach(function(pk){
        const v0=isObj?(val[pk]!=null?String(val[pk]):''):(pk==='landscape'?sc:'');
        h+='<input id="'+idb+'__'+pk+'" type="text" placeholder="'+pk+(ph?' '+ph:'')+'" value="'+self._e(v0)+'"'+self._inp('font-size:12px;')+'>';
      });
      h+='</div></div>';
      return h;
    };
    const _profRowSelect=function(idb,label,val,opts,defLabel){
      const isObj=val&&typeof val==='object';
      const sc=(val!=null&&!isObj)?String(val):'';
      let h='<div style="margin-bottom:8px;"><label class="roc-l">'+label+'</label>';
      h+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">';
      ROC_PROFILES.forEach(function(pk){
        const v0=isObj?(val[pk]!=null?String(val[pk]):''):(pk==='landscape'?sc:'');
        h+='<select id="'+idb+'__'+pk+'"'+self._inp('font-size:12px;')+'>';
        h+='<option value=""'+(!v0?' selected':'')+'>'+(pk==='portrait'?'&#8212; same as landscape &#8212;':'&#8212; default: '+(defLabel||'cover')+' &#8212;')+'</option>';
        opts.forEach(function(o){h+='<option value="'+o[0]+'"'+(v0===o[0]?' selected':'')+'>'+o[1]+'</option>';});
        h+='</select>';
      });
      h+='</div></div>';
      return h;
    };
    respInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 8px;line-height:1.5;">Per profile: Portrait / Landscape. Fill only <b>Landscape</b> to use one value everywhere.</p>';
    respInner+=_profRow('aspect_ratio','Aspect ratio (design shape of the image)',c.aspect_ratio,'e.g. 16/9');
    respInner+=_profRow('border_radius','Border radius',c.border_radius,'e.g. 12px');
    respInner+=_profRowSelect('image_fit','Image fit',c.image_fit,[['cover','cover — crop to fill'],['contain','contain — letterbox']]);
    respInner+=_profRowSelect('image_align','Image align (v6.14.0)',c.image_align,[['top','top'],['center','center'],['bottom','bottom']],'center');
    respInner+='<div style="border-top:1px solid var(--divider-color);padding-top:12px;"><label class="roc-l">Lock layout to image</label>';
    respInner+='<input id="lock_aspect" type="text" placeholder="off — or: true (auto from image) / 16/9" value="'+this._e(c.lock_aspect===true?'true':(c.lock_aspect||''))+'"'+this._inp('')+'>';
    respInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:6px 0 0;line-height:1.5;">When set, zones / icons / blinds etc. stay glued to the image across every tier — per-tier <code>aspect_ratio</code> then only changes how much of the image is cropped, not where elements sit. Use <b>true</b> to take the design shape from the image automatically, or pin an explicit aspect like <b>1720/968</b> (your source image’s real W/H).</p></div>';
    // Light controls section (Elements tab)
    const _lc=cR.light_controls||{};
    const _lcEnts=(Array.isArray(_lc.entities)?_lc.entities:[]).map(function(e){return typeof e==='string'?{entity:e}:(e||{});});
    let lcInner='';
    lcInner+='<p style="font-size:12px;color:var(--secondary-text-color);margin:0 0 10px;line-height:1.5;">A strip rendered above the image. <code>light.*</code> entities render as a <code>material-slider-card</code> brightness slider (requires that resource); on/off entities (<code>switch.*</code>, <code>input_boolean.*</code>, <code>fan.*</code>…) render as an on/off toggle pill. Both share a lux-driven border colour — a smooth gradient between two colours (dark = low lux, bright = high lux).</p>';
    lcInner+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><label style="font-size:12px;font-weight:500;">Lights &amp; switches</label><button id="add-lc-ent" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Entity</button></div>';
    for(let i=0;i<_lcEnts.length;i++){
      lcInner+='<div style="display:grid;grid-template-columns:1fr 130px 28px;gap:6px;align-items:center;margin-bottom:4px;">';
      lcInner+='<input type="text" list="roc-ent-light_switch" data-lc-ent="'+i+'" placeholder="light.bedroom_1 · switch.lamp" value="'+this._e(_lcEnts[i].entity||'')+'"'+this._inp('font-size:12px;')+'>';
      lcInner+='<input type="text" data-lc-name="'+i+'" placeholder="Name (optional)" value="'+this._e(_lcEnts[i].name||'')+'"'+this._inp('font-size:12px;')+'>';
      lcInner+='<button data-rm-lc-ent="'+i+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';
      lcInner+='</div>';
    }
    if(!_lcEnts.length)lcInner+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0;">No entities yet — add a light or switch.</p>';
    lcInner+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;">';
    lcInner+='<div><label class="roc-l">Lux sensor</label><input id="lc-lux" type="text" list="roc-ent-sensor" placeholder="sensor.kitchen_illuminance" value="'+this._e(_lc.lux_sensor||'')+'"'+this._inp('')+'></div>';
    lcInner+='<div><label class="roc-l">Lux max (full brightness)</label><input id="lc-luxmax" type="number" min="1" placeholder="50" value="'+this._e(_lc.lux_max!=null?String(_lc.lux_max):'')+'"'+this._inp('')+'></div>';
    lcInner+='<div><label class="roc-l">Style</label><select id="lc-style"'+this._inp('')+'><option value=""'+(_lc.style==='native'?'':' selected')+'>material-slider-card (external)</option><option value="native"'+(_lc.style==='native'?' selected':'')+'>Built-in pills (icon · name · %)</option></select></div>';
    lcInner+='<div><label class="roc-l">Columns</label><input id="lc-cols" type="number" min="1" placeholder="'+(_lcEnts.length||3)+'" value="'+this._e(_lc.columns!=null?String(_lc.columns):'')+'"'+this._inp('')+'></div>';
    lcInner+='<div><label class="roc-l">Control height — sliders &amp; switches (px, vh, %, per-tier)</label><input id="lc-height" type="text" placeholder="20 · 4vh · {mobile: 20, desktop: 60}" value="'+this._e(_lc.height!=null?(typeof _lc.height==='object'?('{'+Object.keys(_lc.height).map(function(k){return k+': '+_lc.height[k];}).join(', ')+'}'):String(_lc.height)):'')+'"'+this._inp('')+'></div>';
    lcInner+='</div>';
    lcInner+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">';
    lcInner+='<div><label class="roc-l">Colour — dark (low lux)</label><input id="lc-color-low" type="color" value="'+this._toHex(_lc.color_low||LC_DEF_LOW)+'" style="width:100%;height:34px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;"></div>';
    lcInner+='<div><label class="roc-l">Colour — bright (high lux)</label><input id="lc-color-high" type="color" value="'+this._toHex(_lc.color_high||LC_DEF_HIGH)+'" style="width:100%;height:34px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;"></div>';
    lcInner+='<div><label class="roc-l">Background (light off)</label><input id="lc-bg-off" type="color" value="'+this._toHex(_lc.bg_off||LC_DEF_BG)+'" style="width:100%;height:34px;cursor:pointer;border-radius:4px;border:1px solid var(--divider-color);padding:2px;"></div>';
    lcInner+='</div>';
    // Gradient preview — samples the SAME HSL ramp as the border ring, with tick
    // marks at ¼ ½ ¾ so you can see where a given lux level lands on the colour.
    const _lcLuxMax=(_lc.lux_max!=null&&_lc.lux_max>0)?_lc.lux_max:50;
    lcInner+='<div style="margin-top:10px;">';
    lcInner+='<label class="roc-l">Gradient preview (border colour vs. lux)</label>';
    lcInner+='<div id="lc-grad-preview" style="position:relative;height:22px;border-radius:999px;border:1px solid var(--divider-color);background:'+lcGradientCss(_lc.color_low||LC_DEF_LOW,_lc.color_high||LC_DEF_HIGH)+';overflow:hidden;">';
    ['25','50','75'].forEach(function(p){lcInner+='<span style="position:absolute;top:0;bottom:0;left:'+p+'%;width:2px;transform:translateX(-1px);background:rgba(255,255,255,0.9);box-shadow:0 0 1.5px rgba(0,0,0,0.7);"></span>';});
    lcInner+='</div>';
    lcInner+='<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--secondary-text-color);margin-top:3px;"><span>0 lx</span><span>¼</span><span>½</span><span>¾</span><span id="lc-grad-max">'+this._e(String(_lcLuxMax))+' lx</span></div>';
    lcInner+='</div>';

    // Tabbed shell — all panels render; the active one is shown, others hidden via CSS
    const _tab=this._tab||'image';
    const _tabBtn=function(id,icon,label){
      const on=_tab===id;
      return '<button data-roctab="'+id+'" type="button" style="padding:9px 11px;font-size:13px;white-space:nowrap;background:none;border:none;border-bottom:2px solid '+(on?'var(--primary-color)':'transparent')+';color:'+(on?'var(--primary-color)':'var(--secondary-text-color)')+';cursor:pointer;font-weight:'+(on?'600':'400')+';"><ha-icon icon="'+icon+'" style="--mdc-icon-size:16px;vertical-align:-3px;"></ha-icon> '+label+'</button>';
    };
    const _panel=function(id,inner){
      return '<div data-rocpanel="'+id+'" style="display:'+(_tab===id?'block':'none')+';">'+inner+'</div>';
    };
    const _tabbedHtml=
      '<div style="display:flex;gap:2px;border-bottom:1px solid var(--divider-color);overflow-x:auto;margin-bottom:12px;">'
      +_tabBtn('image','mdi:image','Image')
      +_tabBtn('elements','mdi:shape','Elements')
      +_tabBtn('responsive','mdi:monitor-cellphone','Layout')
      +_tabBtn('rooms','mdi:floor-plan','Rooms &amp; menu')
      +_tabBtn('sections','mdi:view-dashboard-outline','Sections')
      +'</div>'
      +_panel('image',
          sec('basic','Background &amp; basics'+(hasRooms?' — room: '+this._e(cR.name||cR.id||''):''),undefined,basicInner,'mdi:image-outline')
         +sec('filters','Image filters'+(_fMode==='smooth'?' — smooth':''),_fCount,filtCombined,'mdi:brightness-6'))
      +_panel('elements',
          sec('badges','Badges — pill chips',(cR.badges||[]).length,bInner,'mdi:label-outline')
         +sec('blinds','Blinds — window covers',(cR.blinds||[]).length,blInner,'mdi:blinds-horizontal')
         +sec('elements','Embedded HA cards',(cR.elements||[]).length,elInner,'mdi:card-bulleted-outline')
         +sec('gauges','Gauges — bar / radial meters',(cR.gauges||[]).length,gInner,'mdi:gauge')
         +sec('groups','Groups — pop-up control panels',(cR.groups||[]).length,grpInner,'mdi:dock-window')
         +sec('icons','Icons — state-aware mdi icons',(cR.icons||[]).length,icoInner,'mdi:star-four-points-outline')
         +sec('labels','Labels — entity values as text',(cR.labels||[]).length,lblInner,'mdi:format-text')
         +sec('lights','Light &amp; switch controls — sliders / toggles',_lcEnts.length,lcInner,'mdi:tune-vertical')
         +sec('glows','Light glow — light spill on the photo',(cR.glows||[]).length,gwInner,'mdi:lightbulb-on-outline')
         +sec('overlays','Overlay image layers',(cR.overlays||[]).length,ovInner,'mdi:layers-outline')
         +sec('vacuum_widgets','Vacuum status widgets — cross-room informational badge',(cR.vacuum_widgets||[]).length,vwInner,'mdi:robot-vacuum')
         +sec('zones','Zones — invisible tap areas',(cR.zones||[]).length,zInner,'mdi:gesture-tap'))
      +_panel('responsive',respInner)
      +_panel('rooms',roomsInner)
      +_panel('sections',sectionsInner);
    this.innerHTML=this._dlAll()
      +'<style>.roc-ed .roc-in{width:100%;padding:6px;border-radius:4px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);box-sizing:border-box;}.roc-ed .roc-l{font-size:12px;display:block;margin-bottom:4px;}.roc-ed.roc-hideadv .roc-adv{display:none;}'+ROC_ED_NARROW_CSS+'</style>'
      +'<div class="roc-ed'+(this._showAdv?'':' roc-hideadv')+'" style="padding:8px;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px 8px;">'
      +'<span style="display:flex;align-items:baseline;gap:8px;"><span style="font-weight:600;font-size:13px;">Room Overlay Card</span><span style="font-size:11px;color:var(--secondary-text-color);">v'+ROC_VERSION+'</span></span>'
      +'<span style="display:flex;gap:6px;align-items:center;">'
      +(this._rocHosted?'':'<span id="roc-studio-msg" style="font-size:11px;color:var(--error-color);max-width:220px;"></span><button id="roc-studio" type="button" title="Open the full-screen Room Card Studio — the card on a large canvas next to this editor" style="padding:2px 8px;border-radius:4px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-size:12px;line-height:1;"><ha-icon icon="mdi:fullscreen" style="--mdc-icon-size:16px;"></ha-icon>Studio</button>')
      +'<button id="roc-adv-toggle" type="button" title="Show the raw YAML textareas (tap_action, conditions, etc.) on every element. Off = simpler, basic fields only." style="padding:2px 8px;border-radius:4px;border:1px solid '+(this._showAdv?'var(--primary-color)':'rgba(255,255,255,0.4)')+';background:'+(this._showAdv?'rgba(3,169,244,0.15)':'none')+';color:'+(this._showAdv?'var(--primary-color)':'var(--primary-text-color)')+';cursor:pointer;display:inline-flex;align-items:center;line-height:1;"><ha-icon icon="mdi:code-braces" style="--mdc-icon-size:16px;"></ha-icon></button>'
      +(this._rocHosted?'':''
      +'<button id="roc-undo" title="Undo (Ctrl+Z)"'+(this._histIdx>0?'':' disabled')+' style="padding:2px 9px;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:none;color:var(--primary-text-color);cursor:pointer;font-size:14px;line-height:1.3;'+(this._histIdx>0?'':'opacity:0.4;cursor:default;')+'">&#8630;</button>'
      +'<button id="roc-redo" title="Redo (Ctrl+Y)"'+(this._histIdx<this._hist.length-1?'':' disabled')+' style="padding:2px 9px;border-radius:4px;border:1px solid rgba(255,255,255,0.4);background:none;color:var(--primary-text-color);cursor:pointer;font-size:14px;line-height:1.3;'+(this._histIdx<this._hist.length-1?'':'opacity:0.4;cursor:default;')+'">&#8631;</button>'
      )
      +'</span></div>'
      +'<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:0 4px 8px;">'
      +(hasRooms?'<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--secondary-text-color);"><ha-icon icon="mdi:door" style="--mdc-icon-size:16px;"></ha-icon>Room <select id="room-select" style="padding:5px 8px;border-radius:6px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);cursor:pointer;font-size:13px;"><option value="global"'+(self._editGlobal?' selected':'')+'>🌐 Global (all rooms)</option>'+c.rooms.map(function(r,i){return '<option value="'+i+'"'+(i===self._editRoomIdx&&!self._editGlobal?' selected':'')+'>'+self._e(r.name||r.id||('room_'+(i+1)))+'</option>';}).join('')+'</select></span>':'')
      // Edit mode (test_mode) is retired as a setting in v6.42.0 — the studio does everything it
      // did, and the dashboard reaches the studio through HA's own edit mode. The toggle is only
      // shown on a card that still has it switched on, so it can be switched off.
      +(c.test_mode?'<label title="Legacy (since v6.42.0 the Studio replaces it): suppresses real tap/hold actions and lets you drag elements straight on the dashboard card. It is saved in the card config, so the dashboard card stays in this state for everyone until it is switched off." style="display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;color:var(--secondary-text-color);"><input id="test_mode" type="checkbox" checked style="width:16px;height:16px;cursor:pointer;"><ha-icon icon="mdi:cursor-move" style="--mdc-icon-size:16px;"></ha-icon>Edit mode (legacy)</label>':'')
      +'<label title="Vibrates on tap/hold actions, and on the moment a hold registers (mobile browsers that support it)." style="display:inline-flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;color:var(--secondary-text-color);"><input id="haptic" type="checkbox"'+(c.haptic!==false?' checked':'')+' style="width:16px;height:16px;cursor:pointer;"><ha-icon icon="mdi:vibrate" style="--mdc-icon-size:16px;"></ha-icon>Haptics</label>'
      +'</div>'
      +(c.test_mode&&!this._rocHosted?'<div id="roc-prev-host" style="margin:0 4px 10px;border:1px solid var(--divider-color);border-radius:8px;overflow:hidden;"></div>':'')
      +((this._wasMigrated&&!_isEmpty)?'<div style="margin:0 4px 10px;padding:8px 12px;border:1px solid rgba(230,160,40,0.7);background:rgba(230,160,40,0.12);border-radius:8px;font-size:12px;line-height:1.5;">Config was <b>auto-migrated</b> from the v3 tier system to the v4 layout engine (in memory only). Review the <b>Layout</b> tab, then <button id="roc-mig-save" style="padding:3px 12px;border-radius:5px;background:var(--primary-color);color:#fff;border:none;cursor:pointer;font-size:12px;font-weight:600;">Save migrated config</button></div>':'')
      +(this._rocHosted?'':'<div style="margin:0 4px 10px;padding:7px 10px;border:1px solid var(--divider-color);border-radius:8px;font-size:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--secondary-text-color);"><span>Classic editor — removed in 7.1; the Studio edits everything.</span><button id="roc-launcher" type="button" style="padding:3px 10px;border-radius:6px;border:1px solid var(--primary-color);background:none;color:var(--primary-color);cursor:pointer;font-size:12px;">Back to the Studio launcher</button></div>')
      +(_isEmpty?_onboardHtml:_tabbedHtml)
      +'</div>';

    // Onboarding: once a background is set, re-render into the full grouped editor
    if(_isEmpty){
      const _go=function(){
        const nc=Object.assign({},self._config);
        const _ob=self.querySelector('#base_image'),_oc=self.querySelector('#base_camera');
        const _bi=_ob?_ob.value.trim():'',_bc=_oc?_oc.value.trim():'';
        if(_bi)nc.base_image=_bi;else delete nc.base_image;
        if(_bc)nc.base_camera=_bc;else delete nc.base_camera;
        self._config=nc;self._render();self._fire(nc);
      };
      const _obEl=this.querySelector('#base_image'),_ocEl=this.querySelector('#base_camera');
      if(_obEl)_obEl.addEventListener('change',_go);
      if(_ocEl)_ocEl.addEventListener('change',_go);
    }

    // Tab switching — toggle panel visibility without a full re-render (keeps focus)
    const _tabBtns=this.querySelectorAll('[data-roctab]');
    if(_tabBtns.length){
      _tabBtns.forEach(function(btn){
        btn.addEventListener('click',function(){
          const id=btn.dataset.roctab;self._tab=id;
          self.querySelectorAll('[data-rocpanel]').forEach(function(p){p.style.display=(p.dataset.rocpanel===id)?'block':'none';});
          _tabBtns.forEach(function(b){const on=b.dataset.roctab===id;b.style.borderBottomColor=on?'var(--primary-color)':'transparent';b.style.color=on?'var(--primary-color)':'var(--secondary-text-color)';b.style.fontWeight=on?'600':'400';});
        });
      });
    }
    // Responsive tab — breakpoint fields save on change, and (Layout-tab grid
    // fields only) also debounce-push straight to the Edit-mode preview card
    // on every keystroke — see _lyDebouncedUpdate() for why that needs a
    // dedicated path instead of the usual _fireDebounced().
    this.querySelectorAll('#lock_aspect,#ly-hmode,#ly-hcustom,#ly-orient,#ly-threshold,#ly-pin,#ly-gap,[id^="ly-rows__"],[id^="ly-cols__"],[id^="ly-r__"],[id^="ly-c__"],[id^="ly-o__"]').forEach(function(el){
      el.addEventListener('change',function(){self._fire(self._collectConfig());});
      el.addEventListener('input',function(){self._lyDebouncedUpdate();});
    });

    // Layout tab — Portrait/Landscape sub-tab toggle (visibility only, keeps
    // both profiles mounted so field state/focus survives switching).
    const _lySubBtns=this.querySelectorAll('[data-rocsub]');
    if(_lySubBtns.length){
      _lySubBtns.forEach(function(btn){
        btn.addEventListener('click',function(){
          const pk=btn.dataset.rocsub;self._lySub=pk;
          self.querySelectorAll('[data-rocsubpanel]').forEach(function(p){p.style.display=(p.dataset.rocsubpanel===pk)?'block':'none';});
          _lySubBtns.forEach(function(b){
            const on=b.dataset.rocsub===pk;
            b.style.borderColor=on?'var(--primary-color)':'var(--divider-color)';
            b.style.background=on?'rgba(3,169,244,0.15)':'none';
            b.style.color=on?'var(--primary-color)':'var(--primary-text-color)';
            b.style.fontWeight=on?'700':'400';
          });
        });
      });
    }

    // Layout tab — mini grid preview repaint on every keystroke, no full
    // re-render (see rocLyPreviewHtml — purely illustrative, editor-only).
    (function(){
      const _numOrLy=function(s){const t=String(s).trim();if(!t)return null;return/^[\d.]+$/.test(t)?parseFloat(t):t;};
      const _lyReadProfile=function(pk){
        const q2=function(id){return self.querySelector('#'+id);};
        const v2=function(id){const el=q2(id);return el?el.value:'';};
        const lp={};
        const rw=v2('ly-rows__'+pk).trim(),cl=v2('ly-cols__'+pk).trim();
        if(rw)lp.rows=rw.split(',').map(_numOrLy).filter(function(x){return x!==null;});
        if(cl)lp.columns=cl.split(',').map(_numOrLy).filter(function(x){return x!==null;});
        const place={};
        ['nav','cards_above','image','lights','cards_below','cover'].forEach(function(rg){
          const rr=v2('ly-r__'+pk+'__'+rg).trim();
          if(!rr)return;
          const pl={row:_numOrLy(rr)};
          const cc2=v2('ly-c__'+pk+'__'+rg).trim();if(cc2)pl.col=_numOrLy(cc2);
          const ov2=q2('ly-o__'+pk+'__'+rg);if(ov2&&ov2.checked)pl.overflow='auto';
          place[rg]=pl;
        });
        if(Object.keys(place).length)lp.place=place;
        const gp2=v2('ly-gap').trim();if(gp2)lp.gap=gp2;
        return lp;
      };
      const _repaint=function(pk){
        const host=self.querySelector('#ly-preview__'+pk);
        if(host)host.innerHTML=rocLyPreviewHtml(_lyReadProfile(pk));
      };
      ['portrait','landscape'].forEach(function(pk){
        self.querySelectorAll('[id^="ly-rows__'+pk+'"],[id^="ly-cols__'+pk+'"],[id^="ly-r__'+pk+'__"],[id^="ly-c__'+pk+'__"],[id^="ly-o__'+pk+'__"]').forEach(function(el){
          el.addEventListener('input',function(){_repaint(pk);});
        });
      });
      const gapEl=self.querySelector('#ly-gap');
      if(gapEl)gapEl.addEventListener('input',function(){_repaint('portrait');_repaint('landscape');});
    })();

    if(!this._keysBound){
      this._keysBound=true;
      const kbSelf=this;
      this.addEventListener('keydown',function(e){
        if(!(e.ctrlKey||e.metaKey))return;
        const tag=(e.target&&e.target.tagName||'').toLowerCase();
        if(tag==='input'||tag==='textarea'||tag==='select')return; // keep native undo inside fields
        const k=e.key.toLowerCase();
        if(k==='z'&&!e.shiftKey){e.preventDefault();kbSelf._undo();}
        else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();kbSelf._redo();}
      });
    }
    // Tag every YAML textarea's wrapper as "advanced" so the header toggle can
    // hide them (declutter — basic fields stay visible). Monospace = YAML field.
    this.querySelectorAll('textarea').forEach(function(ta){
      const st=ta.getAttribute('style')||'';
      if(st.indexOf('monospace')>=0&&!ta.hasAttribute('data-act-yaml')){const p=ta.parentElement;if(p)p.classList.add('roc-adv');}
    });
    const wizBtn=this.querySelector('#roc-wizard');
    if(wizBtn)wizBtn.addEventListener('click',function(){
      if(self._rocHosted&&self._rocHost&&typeof self._rocHost.openWizard==='function'){self._rocHost.openWizard();return;}   // already in the studio
      wizBtn.disabled=true;
      rocOpenStudio({from:'editor',editor:self,hass:self._hass,wizard:true})
        .catch(function(err){const m=self.querySelector('#roc-studio-msg');if(m)m.textContent=(err&&err.message)||String(err);})
        .then(function(){wizBtn.disabled=false;});
    });
    const studioBtn=this.querySelector('#roc-studio');
    if(studioBtn)studioBtn.addEventListener('click',function(){
      const msg=self.querySelector('#roc-studio-msg');if(msg)msg.textContent='';
      studioBtn.disabled=true;
      rocOpenStudio({from:'editor',editor:self,hass:self._hass})
        .catch(function(err){const m=self.querySelector('#roc-studio-msg');if(m)m.textContent=(err&&err.message)||String(err);})
        .then(function(){studioBtn.disabled=false;});
    });
    const lnBtn=this.querySelector('#roc-launcher');if(lnBtn)lnBtn.addEventListener('click',function(){self._setClassic(false);});
    const migBtn=this.querySelector('#roc-mig-save');
    if(migBtn)migBtn.addEventListener('click',function(){self._wasMigrated=false;self._fire(self._collectConfig());self._render();});
    const advT=this.querySelector('#roc-adv-toggle');
    if(advT)advT.addEventListener('click',function(){
      self._showAdv=!self._showAdv;
      const root=self.querySelector('.roc-ed');
      if(root)root.classList.toggle('roc-hideadv',!self._showAdv);
      advT.style.borderColor=self._showAdv?'var(--primary-color)':'rgba(255,255,255,0.4)';
      advT.style.background=self._showAdv?'rgba(3,169,244,0.15)':'none';
      advT.style.color=self._showAdv?'var(--primary-color)':'var(--primary-text-color)';
    });
    this._listen();
    this._entHints();
    this._idHints();
    if(!this._hintBound){
      this._hintBound=true;
      const hSelf=this;
      this.addEventListener('change',function(e){const t=e.target;if(t&&t.tagName==='INPUT'&&/^roc-ent/.test(t.getAttribute('list')||''))hSelf._entHint(t);});
      // "Removed … · Undo" toast (v6.20.0): note what a Remove button is about
      // to delete (capture phase — runs before the button's own handler
      // re-renders the editor), then show the toast if history moved on.
      this.addEventListener('click',function(e){
        const b=e.target&&e.target.closest?e.target.closest('button'):null;
        if(!b||!Array.prototype.some.call(b.attributes,function(a){return/^data-rm-/.test(a.name);})){hSelf._rmPending=null;return;}
        // whole-item Remove buttons name the item (its panel's summary); row-level × buttons don't
        const whole=Array.prototype.some.call(b.attributes,function(a){return/^data-rm-(z|b|el|ico|gw|vw|lbl|g|bl|ov|sec|dtile|grp)$/.test(a.name);});
        const d=whole?b.closest('details'):null;const sm=d&&d.querySelector('summary');
        const lbl=sm?sm.textContent.replace(/^[\s\u25B6\u25BA]+/,'').trim():'';
        hSelf._rmPending={idx:hSelf._histIdx,len:hSelf._hist.length,top:hSelf._hist[hSelf._histIdx],label:lbl};
      },true);
      this.addEventListener('click',function(){
        const p=hSelf._rmPending;hSelf._rmPending=null;
        if(!p||hSelf._hist[hSelf._histIdx]===p.top)return;
        hSelf._showToast('Removed'+(p.label?' '+p.label:''),true);
      });
      this.addEventListener('focusin',function(e){const t=e.target;if(t&&t.tagName==='INPUT')hSelf._dlFill(t.getAttribute('list'));});
      this.addEventListener('input',function(e){const t=e.target;if(t&&t.tagName==='INPUT')hSelf._dlFill(t.getAttribute('list'));if(t&&t.tagName==='INPUT'&&ROC_ID_ATTRS.some(function(a){return t.hasAttribute(a);}))hSelf._idHints();});
    }
    this._bindHassComponents();
    this._mountPreview();
    this._paintToast();
    // Position updates from card drag/keyboard — relay through editor so HA saves correctly
    if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);this._rocPosHandler=null;}
    if(c.test_mode&&!this._rocHosted){ // hosted in the studio: the studio feeds canvas changes in directly
      this._rocPosHandler=this._makeRocPosHandler();
      window.addEventListener('roc-pos-update',this._rocPosHandler);
    }
    if(this._rocRoomHandler){window.removeEventListener('roc-room-switch',this._rocRoomHandler);this._rocRoomHandler=null;}
    if(c.test_mode&&!this._rocHosted){
      this._rocRoomHandler=this._makeRocRoomHandler();
      window.addEventListener('roc-room-switch',this._rocRoomHandler);
    }
  }

  _makeRocPosHandler(){
    const self=this;
    return function(e){
      if(RoomOverlayCard._rocStudioOpen)return; // the studio owns edits while it is open (its Apply comes back through _fire)
      const nc=e.detail&&e.detail.config;
      if(!nc)return;
      // Only accept updates from "our" card (two cards in test mode = cross-talk)
      if(cfgKey(nc)!==cfgKey(self._config))return;
      const _fromPrev=!!nc._roc_preview;
      // Updates from the embedded editor preview carry forced/stripped fields
      // (see _mountPreview: test_mode forced true, url_sync deleted, multi-room
      // follow_mode forced 'manual' — none of that belongs in the real saved
      // config) — undo all of it using what the real config had before the drag.
      if(nc._roc_preview){
        delete nc._roc_preview;
        if(!self._config.test_mode)delete nc.test_mode;
        if(self._config.url_sync!==undefined)nc.url_sync=self._config.url_sync;else delete nc.url_sync;
        if(self._config.follow_mode!==undefined)nc.follow_mode=self._config.follow_mode;else delete nc.follow_mode;
        // Global-defaults editing strips the previewed room's own ROOM_KEYS
        // overrides so the preview falls through to the shared defaults (see
        // _mountPreview) — restore that room's real data here, otherwise this
        // relay would silently wipe it from the saved config on every drag.
        if(self._editGlobal&&Array.isArray(self._config.rooms)&&Array.isArray(nc.rooms)){
          const _gvIdx=Math.max(0,Math.min(self._editRoomIdx,self._config.rooms.length-1));
          if(nc.rooms[_gvIdx]&&self._config.rooms[_gvIdx])nc.rooms[_gvIdx]=rocClone(self._config.rooms[_gvIdx]);
        }
      }
      // A drag inside the preview: it already shows this — don't rebuild it.
      if(_fromPrev)self._prevPushed=JSON.stringify(self._previewCfg(nc));
      self._config=nc;
      self._render(); // refresh position inputs, otherwise the next edit reverts the drag
      self._fire(nc);
    };
  }

  // Room switches made by clicking inside the live preview's own nav strip —
  // keep the editor's Room select and per-room panels following along, otherwise
  // edits silently land on whatever room the header dropdown was last set to.
  _makeRocRoomHandler(){
    const self=this;
    return function(e){
      if(RoomOverlayCard._rocStudioOpen)return;
      const d=e.detail;
      if(!d||d.cfgKey!==cfgKey(self._config))return;
      if(!Array.isArray(self._config.rooms))return;
      const idx=Math.max(0,Math.min(d.idx,self._config.rooms.length-1));
      if(idx===self._editRoomIdx)return;
      self._editRoomIdx=idx;
      self._render();
    };
  }

  _bindHassComponents(){
    const self=this;
    this.querySelectorAll('.ep-placeholder').forEach(function(span){
      const val=span.dataset.epVal||'';
      const picker=document.createElement('ha-entity-picker');
      picker.style.cssText='width:100%;display:block;';
      Array.from(span.attributes).forEach(function(a){if(a.name!=='class'&&a.name!=='data-ep-val')picker.setAttribute(a.name,a.value);});
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
      range.addEventListener('input',function(){num.value=range.value;self._fireDebounced();});
      num.addEventListener('change',function(){range.value=num.value;self._fire(self._collectConfig());});
    });
  }

  // ----- Cockpit onboarding (v6.10.0, COCKPIT_PLAN.md kap.5.3) --------------
  // Recipe defaults for "+ Add section" (5.3.3) and the untagged-device scan's
  // one-click add (5.3.2) — both just build a section def and push it, same
  // as the plain "+ Add section" button already does.
  _recipeDef(kind){
    const R={
      appliances:{title:'Appliances',icon:'mdi:washing-machine',placement:'sheet-right'},
      cleaning:{title:'Cleaning',icon:'mdi:robot-vacuum',placement:'sheet-right',source:'auto',domain:'vacuum'},
      media:{title:'Media',icon:'mdi:cast',placement:'sheet-right',source:'auto',domain:'media_player'},
      heating:{title:'Heating',icon:'mdi:radiator',placement:'sheet-right',source:'auto',domain:'climate'},
      covers:{title:'Covers',icon:'mdi:window-shutter',placement:'sheet-right',source:'auto',domain:'cover'},
      electricity:{title:'Electricity',icon:'mdi:flash',placement:'full',card:{type:'custom:electricity-panel-card'}},
      weather:{title:'Weather',icon:'mdi:weather-partly-cloudy',placement:'sheet-right'}
    };
    // Electricity embeds a third-party card — offer it only when that card is
    // actually registered, otherwise the new section is a "not registered" error.
    if(kind==='electricity'&&!customElements.get('electricity-panel-card'))return null;
    return R[kind]||null;
  }
  // Devices in the four spatial-ish domains (kap.5.3.2) that aren't reachable
  // from any section yet — neither individually tagged nor swept in by an
  // existing `source: auto` section for that domain. Re-evaluated on every
  // editor render (cheap: one states scan), never persisted itself.
  _scanUntagged(c){
    if(!this._hass||!this._hass.states)return[];
    const doms=['vacuum','climate','cover','media_player'];
    const collected=rocCollectSections(c);
    const collectedEntities=new Set();
    // rocTileDef() resolves the entity the same way the card itself does —
    // reading t.item.entity directly missed declared tiles (item:{id,tile},
    // no top-level entity), so an entity used only in a declared tile was
    // still offered by the "Find untagged devices" scan as if unused.
    collected.forEach(function(sx){sx.tiles.forEach(function(t){const e=rocTileDef(t).entity;if(e)collectedEntities.add(e);});});
    // v6.24.0: a section that embeds a card (`card:` — e.g. a covers or media
    // card listing its own entities) makes those entities reachable too; they
    // used to be offered as "untagged" although the cockpit already shows them.
    const _walk=function(v){
      if(typeof v==='string'){if(/^[a-z_]+\.[a-z0-9_]+$/.test(v))collectedEntities.add(v);return;}
      if(Array.isArray(v)){v.forEach(_walk);return;}
      if(v&&typeof v==='object')for(const k in v)_walk(v[k]);
    };
    (c.sections||[]).forEach(function(sd){if(sd&&sd.card)_walk(sd.card);});
    const autoDomains=new Set((c.sections||[]).filter(function(s){return s&&s.source==='auto'&&s.domain;}).map(function(s){return s.domain;}));
    const s=this._hass.states,out=[];
    for(const eid in s){
      const dom=eid.split('.')[0];
      if(doms.indexOf(dom)<0)continue;
      if(autoDomains.has(dom))continue;
      if(collectedEntities.has(eid))continue;
      out.push({entity:eid,domain:dom,name:(s[eid].attributes&&s[eid].attributes.friendly_name)||eid});
    }
    out.sort(function(a,b){return a.name.localeCompare(b.name);});
    return out;
  }

  // ----- Cockpit sections editor (v6.8.0) -----------------------------------
  // Top-level list (like `rooms`), not per-room — reuses the same _mvBtns/
  // _mvKinds reorder mechanism the per-room element lists use (COCKPIT_PLAN.md
  // kap.5.1). `tiles` is the read-only "currently collected" preview, computed
  // once per render via the same rocCollectSections() the card itself uses.
  _sectionItem(sec,i,tiles){
    const self=this;
    const op=this._openPanels&&this._openPanels.has('sec-'+i);
    const isCard=!!sec.card;
    const isAuto=!isCard&&sec.source==='auto';
    const cardYaml=sec.card?_yaml.s({card:sec.card}):'';
    const vtYaml=sec.visible_template!==undefined?_yaml.s(sec.visible_template):'';
    let h='<details style="margin-bottom:6px;" data-panel="sec-'+i+'"'+(op?' open':'')+'>';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">'+(sec.icon?'<ha-icon icon="'+this._e(sec.icon)+'" style="--mdc-icon-size:16px;"></ha-icon>':'&#9654;')+' Section: '+this._e(sec.title||sec.id||'section_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-sec-id="'+i+'" type="text" value="'+this._e(sec.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Title</label><input data-sec-title="'+i+'" type="text" value="'+this._e(sec.title||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Icon</label><div style="display:flex;gap:6px;align-items:center;"><ha-icon data-roc-prev icon="'+this._e(sec.icon||'')+'" style="--mdc-icon-size:20px;flex:none;color:var(--primary-text-color);"></ha-icon><input data-sec-icon="'+i+'" type="text" placeholder="mdi:washing-machine" value="'+this._e(sec.icon||'')+'"'+this._inp('')+'></div></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Placement</label><select data-sec-placement="'+i+'"'+this._inp('')+'>';
    [['sheet-right','Sheet — right'],['sheet-bottom','Sheet — bottom'],['full','Full'],['dialog','Dialog']].forEach(function(o){h+='<option value="'+o[0]+'"'+((sec.placement||'sheet-right')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Size (sheet width / dialog max-width)</label><input data-sec-size="'+i+'" type="text" placeholder="420px" value="'+this._e(sec.size||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Columns</label><input data-sec-columns="'+i+'" type="number" min="1" placeholder="2" value="'+this._e(sec.columns!=null?String(sec.columns):'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Badge</label><select data-sec-badge="'+i+'"'+this._inp('')+'>';
    [['auto','Auto — count active'],['none','None']].forEach(function(o){h+='<option value="'+o[0]+'"'+((sec.badge===undefined?'auto':sec.badge)===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='</div>';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Subtitle (optional)</label><input data-sec-subtitle="'+i+'" type="text" value="'+this._e(sec.subtitle||'')+'"'+this._inp('')+'></div>';
    h+='<div style="margin-bottom:8px;"><label style="font-size:12px;display:flex;align-items:center;gap:6px;"><input data-sec-backdrop="'+i+'" type="checkbox"'+(sec.backdrop!==false?' checked':'')+' style="width:auto;cursor:pointer;"> Tap outside closes (backdrop)</label></div>';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Content source (collected tagging always applies in addition to this)</label><select data-sec-source="'+i+'"'+this._inp('')+'>';
    h+='<option value="collected"'+(!isCard&&!isAuto?' selected':'')+'>Collected only — elements tagged with this section</option>';
    h+='<option value="auto"'+(isAuto?' selected':'')+'>Auto — by domain, from Home Assistant</option>';
    h+='<option value="card"'+(isCard?' selected':'')+'>Embedded card</option>';
    h+='</select></div>';
    h+='<div data-sec-domain-box="'+i+'" style="'+(isAuto?'':'display:none;')+'margin-bottom:8px;"><label class="roc-l">Domain</label><select data-sec-domain="'+i+'"'+this._inp('')+'>';
    [['climate','Climate'],['cover','Cover'],['media_player','Media player'],['vacuum','Vacuum'],['fan','Fan'],['light','Light'],['switch','Switch']].forEach(function(o){h+='<option value="'+o[0]+'"'+((sec.domain||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select><p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">Adds one tile per matching entity not already tagged into this section. Resolved live from Home Assistant, so nothing to list here.</p></div>';
    h+='<div data-sec-card-box="'+i+'" style="'+(isCard?'':'display:none;')+'margin-bottom:8px;"><label class="roc-l">Embedded card (YAML — a full <code>card:</code> block, e.g. <code>card: {type: custom:electricity-panel-card}</code>)</label><textarea data-sec-card-yaml="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(cardYaml)+'</textarea></div>';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">visible_template (optional, YAML — a Jinja template; falsy hides the section)</label><textarea data-sec-vt="'+i+'" rows="2"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(vtYaml)+'</textarea></div>';
    h+=this._declTilesBox(i,sec);
    if(!isCard){
      h+='<div style="margin-bottom:4px;"><label class="roc-l">Currently collected ('+tiles.length+')</label>';
      if(tiles.length){
        h+='<ul style="margin:0;padding-left:18px;font-size:12px;color:var(--secondary-text-color);">';
        tiles.forEach(function(t){h+='<li>'+self._e((t.room&&(t.room.name||t.room.id))||'—')+' &rarr; '+self._e(t.item.id||t.kind)+' ('+t.kind+')</li>';});
        h+='</ul>';
      }else{
        h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:2px 0 0;">Nothing tagged yet — open an element in the Elements tab and set its Section field.</p>';
      }
      h+='</div>';
    }
    h+=this._mvBtns('sec',i);
    h+='<button data-dup-sec="'+i+'" style="padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;margin-top:8px;margin-right:6px;">Duplicate</button>';
    h+='<button data-rm-sec="'+i+'" style="padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;margin-top:8px;">Remove section</button>';
    h+='</div></details>';
    return h;
  }

  // Section-declared tiles (v6.11.2, kap.4's "declared" source) — content a
  // section owns directly, no room/zone/element/blind tag needed at all. One
  // list per section, editable right where it's declared; each tile reuses
  // the same Image/Overlays editor a tagged element's tile: gets, via the
  // composite-keyed machinery below (kind:'dt', i:'<sectionIdx>_<tileIdx>').
  _declTilesBox(secIdx,sec){
    const self=this;
    const tiles=Array.isArray(sec.tiles)?sec.tiles:[];
    let h='<div style="margin-bottom:8px;">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><label class="roc-l" style="margin:0;">Declared tiles (no room/zone tag needed)</label>';
    h+='<button type="button" data-add-dtile="'+secIdx+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Tile</button></div>';
    if(!tiles.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 4px;">No declared tiles yet — content collected from tagged elements (below) or Auto still applies too.</p>';
    tiles.forEach(function(t,ti){h+=self._declTileItem(secIdx,ti,t,sec.id);});
    h+='</div>';
    return h;
  }

  _declTileItem(secIdx,ti,t,secId){
    const skey=secIdx+':'+ti;
    const dtKey=secIdx+'_'+ti;
    const open=this._openPanels&&this._openPanels.has('dtile-'+skey);
    const scalar=Object.assign({},t||{});
    delete scalar.id;delete scalar.image;delete scalar.image_ratio;delete scalar.overlays;
    TILE_DEDICATED_KEYS.forEach(function(k){delete scalar[k];});
    const scalarYaml=Object.keys(scalar).length?_yaml.s(scalar):'';
    const idPlaceholder=(secId||'section')+'_tile_'+ti;
    let h='<details style="margin-bottom:6px;" data-panel="dtile-'+skey+'"'+(open?' open':'')+'>';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Tile: '+this._e((t&&(t.name||t.id))||'tile_'+ti)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">ID (optional — falls back to "'+this._e(idPlaceholder)+'")</label><input data-dtile-id="'+skey+'" type="text" placeholder="'+this._e(idPlaceholder)+'" value="'+this._e((t&&t.id)||'')+'"'+this._inp('')+'></div>';
    h+=this._tileFieldsHtml(skey,t||{});
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Other tile fields — hold_delay etc. (YAML)</label><textarea data-dtile-yaml="'+skey+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(scalarYaml)+'</textarea></div>';
    h+=this._tileImageBox('dt',dtKey,{tile:t||{}});
    h+='<div style="display:flex;gap:6px;margin-top:8px;">';
    h+='<button type="button" data-mv-dtile="'+skey+':up" style="padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;">&#9650;</button>';
    h+='<button type="button" data-mv-dtile="'+skey+':down" style="padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;">&#9660;</button>';
    h+='<button type="button" data-dup-dtile="'+skey+'" style="padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;">Duplicate</button>';
    h+='<button type="button" data-rm-dtile="'+skey+'" style="padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove tile</button>';
    h+='</div>';
    h+='</div></details>';
    return h;
  }

  // Section select + `tile:` fields, shared by zone/icon/element/blind
  // editors (COCKPIT_PLAN.md kap.5.2 — badges are not taggable). `kind` is the
  // same short letter used by _mvKinds ('z'/'ico'/'el'/'bl'), so the generic
  // [data-sec-link]/[data-sec-tile]/[data-tf-*] wiring in _listen() and the
  // _secTile() reader in _collectConfig() both key off "kind:i" without
  // per-kind code.
  _secTileHtml(kind,i,item){
    const self=this;
    const secs=(this._config&&this._config.sections)||[];
    let h='<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--divider-color);"><label class="roc-l">Section (cockpit panel)</label><select data-sec-link="'+kind+':'+i+'"'+this._inp('')+'>';
    h+='<option value=""'+(!item.section?' selected':'')+'>— none —</option>';
    secs.forEach(function(s){h+='<option value="'+self._e(s.id||'')+'"'+(item.section===s.id?' selected':'')+'>'+self._e(s.title||s.id||'')+'</option>';});
    h+='</select>';
    if(!secs.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 0;">No sections yet — add one in the Sections tab first.</p>';
    // The tile fields carry the icon-scheme fields only (D3 scheme a) —
    // `image`/`overlays` (scheme b, v6.9.0) get their own structured editor
    // below, reusing the overlay editor's UI (COCKPIT_PLAN.md kap.5.2).
    const tileScalar=Object.assign({},item.tile||{});
    delete tileScalar.image;delete tileScalar.image_ratio;delete tileScalar.overlays;
    TILE_DEDICATED_KEYS.forEach(function(k){delete tileScalar[k];});
    const tileYaml=Object.keys(tileScalar).length?_yaml.s(tileScalar):'';
    h+='<div data-sec-tile-box="'+kind+':'+i+'" style="'+(item.section?'':'display:none;')+'margin-top:6px;">';
    h+=this._tileFieldsHtml(kind+':'+i,item.tile||{});
    h+='<label class="roc-l">Other tile fields — hold_delay etc. (YAML)</label><textarea data-sec-tile="'+kind+':'+i+'" rows="3"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(tileYaml)+'</textarea>';
    h+=this._tileImageBox(kind,i,item);
    h+='</div>';
    h+='</div>';
    return h;
  }

  // Structured tile-field editor (B2, BUG_UX_ANALYSIS_v6.15.1.md §Part 2) —
  // promotes the most commonly-edited `tile:` keys to real inputs instead of
  // making every tile a 13-key YAML box. `key` is the same composite key
  // ("kind:i" for a tagged element, "secIdx:ti" for a declared tile) both
  // callers already use for their own dedicated inputs (id/image/overlays),
  // so _collectTileFields() in _collectConfig() can read them back uniformly.
  // See TILE_DEDICATED_KEYS for exactly which keys this owns.
  _tileFieldsHtml(key,tile){
    const self=this;
    const e=function(s){return self._e(s);};
    let h='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Name</label><input data-tf-name="'+key+'" type="text" value="'+e(tile.name||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Entity</label><input data-tf-entity="'+key+'" type="text" list="roc-entities" value="'+e(tile.entity||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Icon</label><input data-tf-icon="'+key+'" type="text" placeholder="mdi:..." value="'+e(tile.icon||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Icon animation</label><select data-tf-anim="'+key+'"'+this._inp('')+'>';
    [['','— none —'],['spin','Spin'],['pulse','Pulse'],['blink','Blink']].forEach(function(o){
      h+='<option value="'+o[0]+'"'+((tile.icon_animation||'')===o[0]?' selected':'')+'>'+o[1]+'</option>';
    });
    h+='</select></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Active state (e.g. "on" or "washing, drying")</label><input data-tf-active="'+key+'" type="text" value="'+e(tile.active_state===undefined?'':(Array.isArray(tile.active_state)?tile.active_state.join(', '):tile.active_state))+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">State class</label><select data-tf-sclass="'+key+'"'+this._inp('')+'>';
    [['auto','Auto (from active state)'],['run','Force: Run (blue)'],['done','Force: Done (green)']].forEach(function(o){
      h+='<option value="'+o[0]+'"'+((tile.state_class===undefined?'auto':tile.state_class)===o[0]?' selected':'')+'>'+o[1]+'</option>';
    });
    h+='</select></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Value text (optional — overrides the live entity state text)</label><input data-tf-value="'+key+'" type="text" value="'+e(tile.value===undefined?'':tile.value)+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Progress entity (0-100 sensor, optional)</label><input data-tf-progress="'+key+'" type="text" list="roc-ent-progress" value="'+e(tile.progress||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+=this._actFieldsHtml('tf:'+key,{tap:tile.tap_action,double_tap:tile.double_tap_action,hold:tile.hold_action},{entity:tile.entity});
    const quick=Array.isArray(tile.quick)?tile.quick:[];
    h+='<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><label class="roc-l" style="margin:0;">Quick actions (small buttons on the tile)</label>';
    h+='<button type="button" data-add-tquick="'+key+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Quick action</button></div>';
    quick.forEach(function(q,qi){
      const tgtSimple=(q.target&&q.target.entity_id&&Object.keys(q.target).length===1)?q.target.entity_id:(typeof q.target==='string'?q.target:'');
      h+='<div style="display:grid;grid-template-columns:70px 1fr 1fr 1fr auto;gap:6px;align-items:center;margin-bottom:4px;">';
      h+='<input data-tf-q-icon="'+key+':'+qi+'" type="text" placeholder="mdi:..." value="'+e(q.icon||'')+'"'+self._inp('')+'>';
      h+='<input data-tf-q-name="'+key+':'+qi+'" type="text" placeholder="Label" value="'+e(q.name||'')+'"'+self._inp('')+'>';
      h+='<input data-tf-q-svc="'+key+':'+qi+'" type="text" placeholder="domain.service" value="'+e(q.service||'')+'"'+self._inp('')+'>';
      h+='<input data-tf-q-target="'+key+':'+qi+'" type="text" list="roc-entities" placeholder="target entity_id" value="'+e(tgtSimple)+'"'+self._inp('')+'>';
      h+='<button type="button" data-rm-tquick="'+key+':'+qi+'" title="Remove quick action" style="padding:4px 8px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:11px;">&#10005;</button>';
      h+='</div>';
    });
    h+='</div>';
    return h;
  }

  // Tile image mode (v6.9.0, D3 scheme b) -- `tile.image` switches a tile from
  // the icon+state scheme to a device photo with its own overlays. `image:`
  // gets a real field (like an overlay's own "Image URL"); the overlays list
  // below mirrors _ovItem/_ovTransform exactly but composite-keyed
  // ("kind:i:ti") since it is nested inside one element's own tile, not a
  // flat top-level/per-room array -- so it needs its own add/remove/reorder
  // rather than the generic [data-mv]/_mvKinds mechanism.
  _tileImageBox(kind,i,item){
    const self=this;
    const t=item.tile||{};
    const key=kind+':'+i;
    const ovs=Array.isArray(t.overlays)?t.overlays:[];
    let h='<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--divider-color);">';
    h+='<label class="roc-l">Tile image (optional — switches this tile from an icon to a device photo with movable parts)</label>';
    h+='<input data-tile-img="'+key+'" type="text" placeholder="/local/pracka.webp" value="'+this._e(t.image||'')+'"'+this._inp('')+'>';
    h+='<div data-tile-ov-box="'+key+'" style="'+(t.image?'':'display:none;')+'margin-top:8px;">';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Aspect ratio (optional — overrides the 4/3 default stage, e.g. for a widescreen TV/monitor photo)</label><input data-tile-imgr="'+key+'" type="text" placeholder="4/3 (default) — e.g. 16/9" value="'+this._e(t.image_ratio||'')+'"'+this._inp('')+'></div>';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><label style="font-size:12px;font-weight:500;">Overlays (moving parts)</label>';
    h+='<button type="button" data-add-tlov="'+key+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ Overlay</button></div>';
    if(!ovs.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 4px;">No overlays yet — the tile shows just the image.</p>';
    ovs.forEach(function(ov,ti){h+=self._tileOverlayItem(kind,i,ti,ov);});
    h+='</div></div>';
    return h;
  }

  _tileOverlayItem(kind,i,ti,ov){
    const key=kind+':'+i+':'+ti;
    const condView=Object.assign({},ov.conditions||{});
    if(ov.state_images)condView.state_images=ov.state_images;
    const condYaml=Object.keys(condView).length?_yaml.s(condView):'';
    const open=this._openPanels&&this._openPanels.has('tlov-'+key);
    let h='<details style="margin-bottom:6px;" data-panel="tlov-'+key+'"'+(open?' open':'')+'>';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Overlay: '+this._e(ov.id||'ov_'+ti)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-tlov-id="'+key+'" type="text" value="'+this._e(ov.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Image URL</label><input data-tlov-img="'+key+'" type="text" value="'+this._e(ov.image||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Transition</label><input data-tlov-tr="'+key+'" type="text" value="'+this._e(ov.transition||'2s ease')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Animation</label>';
    h+='<select data-tlov-anim="'+key+'"'+this._inp('')+'>';
    h+='<option value=""'+(!ov.animation?' selected':'')+'>none</option>';
    h+='<option value="pulse"'+(ov.animation==="pulse"?' selected':'')+'>pulse (fade in/out)</option>';
    h+='<option value="blink"'+(ov.animation==="blink"?' selected':'')+'>blink (hard on/off)</option>';
    h+='</select></div></div>';
    h+='<div><label class="roc-l">Conditions YAML (opacity / filter / state_images)</label>';
    h+='<textarea data-tlov-yaml="'+key+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(condYaml)+'</textarea></div>';
    h+=this._tileOverlayTransform(kind,i,ti,ov);
    h+='<div style="display:flex;gap:6px;margin-top:8px;">';
    h+='<button type="button" data-mv-tlov="'+key+':up" style="padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;">&#9650;</button>';
    h+='<button type="button" data-mv-tlov="'+key+':down" style="padding:4px 8px;border-radius:4px;border:1px solid var(--divider-color);background:none;color:var(--primary-text-color);cursor:pointer;font-size:11px;">&#9660;</button>';
    h+='<button type="button" data-rm-tlov="'+key+'" style="padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove overlay</button>';
    h+='</div>';
    h+='</div></details>';
    return h;
  }

  // Transform sub-panel for a tile overlay — identical fields/behaviour to
  // _ovTransform, composite-keyed ("kind:i:ti") instead of a bare index.
  _tileOverlayTransform(kind,i,ti,ov){
    const key=kind+':'+i+':'+ti;
    const tf=ov.transform||{};
    const mode=ov.transform?(tf.spin?'spin':((tf.from&&tf.to)?'range':(tf.map?'states':''))):'';
    const open=this._openPanels&&this._openPanels.has('tlovtf-'+key);
    const pane=function(m){return'style="'+(mode===m?'':'display:none;')+'"';};
    let h='<details style="margin:8px 0;" data-panel="tlovtf-'+key+'"'+(open?' open':'')+'>';
    h+='<summary style="cursor:pointer;padding:6px 8px;background:var(--secondary-background-color);border-radius:6px;font-size:12px;font-weight:500;list-style:none;">&#9654; Transform &mdash; make this layer move'+(mode?' <span style="opacity:0.7;">('+mode+')</span>':'')+'</summary>';
    h+='<div style="padding:8px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">Mode</label><select data-tlov-tf-mode="'+key+'"'+this._inp('')+'>';
    [['','none'],['states','states → transform'],['range','numeric range'],['spin','continuous spin']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+(mode===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Entity</label><input data-tlov-tf-ent="'+key+'" type="text" list="roc-entities" placeholder="sensor.pracka_stav" value="'+this._e(tf.entity||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Attribute (blank = state)</label><input data-tlov-tf-attr="'+key+'" type="text" placeholder="current_position" value="'+this._e(tf.attribute||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Origin — hinge/axle on the tile image</label><input data-tlov-tf-origin="'+key+'" type="text" placeholder="50% 50%" value="'+this._e(tf.origin||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<div data-tlov-tfpane="'+key+'-states" '+pane('states')+'>';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
    h+='<label style="font-size:12px;font-weight:500;">State &rarr; transform</label>';
    h+='<button type="button" data-add-tlovtfm="'+key+'" style="padding:2px 10px;border-radius:4px;background:var(--primary-color);color:white;border:none;cursor:pointer;font-size:11px;">+ State</button>';
    h+='</div>';
    const keys=Object.keys(tf.map||{});
    keys.forEach(function(k,j){
      h+='<div style="display:grid;grid-template-columns:130px 1fr 28px;gap:4px;align-items:center;margin-bottom:4px;">';
      h+='<input type="text" data-tlov-tfk="'+key+'-'+j+'" placeholder="on / * " value="'+escA(k)+'" class="roc-in">';
      h+='<input type="text" data-tlov-tfv="'+key+'-'+j+'" placeholder="rotateY(-72deg)" value="'+escA(tf.map[k])+'" class="roc-in">';
      h+='<button type="button" data-rm-tlovtfm="'+key+'-'+j+'" style="background:none;border:none;cursor:pointer;color:var(--error-color);font-size:18px;line-height:1;padding:0;">&#x2715;</button>';
      h+='</div>';
    });
    if(!keys.length)h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 4px;">No states yet. <code>*</code> matches anything not listed.</p>';
    h+='</div>';
    const fr=tf.from||{},to=tf.to||{};
    h+='<div data-tlov-tfpane="'+key+'-range" '+pane('range')+'>';
    h+='<div style="display:grid;grid-template-columns:80px 1fr;gap:8px;margin-bottom:6px;align-items:end;">';
    h+='<div><label class="roc-l">From value</label><input data-tlov-tf-fv="'+key+'" type="number" placeholder="0" value="'+this._e(fr.value==null?'':String(fr.value))+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">… transform</label><input data-tlov-tf-ft="'+key+'" type="text" placeholder="translateY(0%)" value="'+this._e(fr.transform||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">To value</label><input data-tlov-tf-tv="'+key+'" type="number" placeholder="100" value="'+this._e(to.value==null?'':String(to.value))+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">… transform</label><input data-tlov-tf-tt="'+key+'" type="text" placeholder="translateY(-92%)" value="'+this._e(to.transform||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:0 0 4px;">Both sides must use the same functions in the same order &mdash; the numbers in between are interpolated.</p>';
    h+='</div>';
    const sp=(tf.spin===true?{}:(tf.spin||{}));
    h+='<div data-tlov-tfpane="'+key+'-spin" '+pane('spin')+'>';
    h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">';
    h+='<div><label class="roc-l">Fastest (at max)</label><input data-tlov-tf-smin="'+key+'" type="text" placeholder="0.35s" value="'+this._e(sp.min_duration||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Slowest (just on)</label><input data-tlov-tf-smax="'+key+'" type="text" placeholder="2.5s" value="'+this._e(sp.max_duration||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Axis</label><select data-tlov-tf-saxis="'+key+'"'+this._inp('')+'>';
    [['z','flat (seen from the front)'],['x','tilted — X'],['y','tilted — Y']]
      .forEach(function(o){h+='<option value="'+o[0]+'"'+((sp.axis||'z')===o[0]?' selected':'')+'>'+o[1]+'</option>';});
    h+='</select></div>';
    h+='<div><label class="roc-l">Direction</label><label style="display:flex;align-items:center;gap:6px;font-size:12px;padding-top:6px;"><input type="checkbox" data-tlov-tf-srev="'+key+'"'+(sp.reverse?' checked':'')+' style="width:15px;height:15px;">reverse</label></div>';
    h+='</div></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">';
    h+='<div><label class="roc-l">Movement transition</label><input data-tlov-tf-tr="'+key+'" type="text" placeholder="0.8s ease" value="'+this._e(tf.transition||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Perspective (3D depth)</label><input data-tlov-tf-persp="'+key+'" type="text" placeholder="900px — for rotateX/Y" value="'+this._e(tf.perspective||'')+'"'+this._inp('')+'></div>';
    h+='</div>';
    h+='</div></details>';
    return h;
  }

  _groupItem(g,i){
    const op=this._openPanels&&this._openPanels.has('grp-'+i);
    const styleYaml=g.style?_yaml.s({style:g.style}):'';
    let h='<details style="margin-bottom:6px;" data-panel="grp-'+i+'"'+(op?' open':'')+' >';
    h+='<summary style="cursor:pointer;padding:8px;background:var(--secondary-background-color);border-radius:6px;font-size:13px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;">&#9654; Group: '+this._e(g.id||'group_'+i)+'</summary>';
    h+='<div style="padding:10px;border:1px solid var(--divider-color);border-radius:0 0 6px 6px;margin-top:-1px;">';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">';
    h+='<div><label class="roc-l">ID</label><input data-grp-id="'+i+'" type="text" value="'+this._e(g.id||'')+'"'+this._inp('')+'></div>';
    h+='<div><label class="roc-l">Grouping code (mutual exclusion)</label><input data-grp-gc="'+i+'" type="number" placeholder="e.g. 1" value="'+this._e(g.grouping_code!=null?String(g.grouping_code):'')+'"'+this._inp('font-size:12px;')+'></div>';
    h+='<div style="display:flex;align-items:center;gap:8px;padding-top:18px;"><label style="font-size:12px;">Initially visible</label><input data-grp-vis="'+i+'" type="checkbox"'+(g.visible?' checked':'')+' style="width:auto;cursor:pointer;"></div>';
    h+='</div>';
    h+='<div style="margin-bottom:8px;"><label class="roc-l">Background panel — style: (top / left / width / height / background / border_radius / z_index)</label>';
    h+='<textarea data-grp-yaml="'+i+'" rows="4"'+this._inp('font-family:monospace;font-size:12px;resize:vertical;')+'>'+this._e(styleYaml)+'</textarea></div>';
    h+='<p style="font-size:11px;color:var(--secondary-text-color);margin:4px 0 8px;">Actions: <code>action: toggle-group</code>, <code>show-group</code>, <code>hide-group</code> with <code>group: '+this._e(g.id||'group_id')+'</code></p>';
    h+='<button data-rm-grp="'+i+'" style="padding:4px 10px;border-radius:4px;border:1px solid var(--error-color);background:none;color:var(--error-color);cursor:pointer;font-size:12px;">Remove group</button>';
    h+='</div></details>';
    return h;
  }

  _listen(){
    const self=this;
    const fire=function(){self._fire(self._collectConfig());};
    // Room-scoped access for add/remove/duplicate/move handlers
    const T=function(c){return(Array.isArray(c.rooms)&&c.rooms.length&&!self._editGlobal)?c.rooms[Math.max(0,Math.min(self._editRoomIdx,c.rooms.length-1))]:c;};
    const A=function(c,key){const t=T(c);if(!t[key])t[key]=[];return t[key];};
    // Rooms section
    const roomSel=this.querySelector('#room-select');
    if(roomSel)roomSel.addEventListener('change',function(){
      if(roomSel.value==='global'){self._editGlobal=true;}
      else{self._editGlobal=false;self._editRoomIdx=parseInt(roomSel.value)||0;}
      self._render();self._writeEditHash(self._config);
    });
    const addRoom=this.querySelector('#add-room');
    if(addRoom)addRoom.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!Array.isArray(c.rooms))c.rooms=[];
      let n=c.rooms.length+1,id='room_'+n;
      while(c.rooms.some(function(r){return r.id===id;})){n++;id='room_'+n;}
      c.rooms.push({id:id,name:'Room '+n});
      self._editRoomIdx=c.rooms.length-1;
      self._config=c;self._render();self._fire(c);
    });
    const rmRoom=this.querySelector('#rm-room');
    if(rmRoom)rmRoom.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!Array.isArray(c.rooms)||c.rooms.length<=1)return; // keep at least one room
      c.rooms.splice(self._editRoomIdx,1);
      self._editRoomIdx=Math.max(0,self._editRoomIdx-1);
      self._config=c;self._render();self._fire(c);
    });
    const roomUp=this.querySelector('#room-up');
    if(roomUp)roomUp.addEventListener('click',function(){
      const i=self._editRoomIdx;if(i<=0)return;
      const c=self._collectConfig();if(!Array.isArray(c.rooms)||i>=c.rooms.length)return;
      const tmp=c.rooms[i-1];c.rooms[i-1]=c.rooms[i];c.rooms[i]=tmp;
      self._editRoomIdx=i-1;self._config=c;self._render();self._fire(c);
    });
    const roomDown=this.querySelector('#room-down');
    if(roomDown)roomDown.addEventListener('click',function(){
      const i=self._editRoomIdx;const c=self._collectConfig();
      if(!Array.isArray(c.rooms)||i>=c.rooms.length-1)return;
      const tmp=c.rooms[i+1];c.rooms[i+1]=c.rooms[i];c.rooms[i]=tmp;
      self._editRoomIdx=i+1;self._config=c;self._render();self._fire(c);
    });
    const convRooms=this.querySelector('#conv-rooms');
    if(convRooms)convRooms.addEventListener('click',function(){self._convertToRooms();});
    const bootstrapAreas=this.querySelector('#bootstrap-areas');
    if(bootstrapAreas)bootstrapAreas.addEventListener('click',function(){self._bootstrapAreas();});
    this._ovListen(fire,T); // overview page / tile (v6.30.0)
    ['room-id','room-name','room-icon','room-area-match','room-chips','room_entity','follow_hold','card_id','follow_mode','room_state_entity','nav-style','nav-position','nav-height','nav-width','nav-mobile-height','nav-rows-portrait','nav-rows-landscape','nav-cards-pos','nav-wheel','nav-follow-btn','nav-chips','nav-cards','nav-mini-templates','nav-mini-camera-refresh','nav-mini-width-ref','url-sync','url-sync-key'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
    });
    // nav-live needs a full re-render (not just a local panel toggle, unlike
    // #filter-mode below): 'custom' adds a "Show in mini" checkbox to every
    // gauge/label/icon/badge/blind/element panel, not just its own local
    // sub-panel, so those need to actually (dis)appear across the form.
    const navLiveEl=this.querySelector('#nav-live');
    if(navLiveEl)navLiveEl.addEventListener('change',function(){
      const c=self._collectConfig();
      self._config=c;self._render();self._fire(c);
    });
    const bidMap=this.querySelector('#bid-map');
    if(bidMap)bidMap.addEventListener('click',function(){
      const entEl=self.querySelector('#bid-entity');
      const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id;
      if(!bid||!entEl||!entEl.value.trim())return;
      const c=self._collectConfig();
      if(typeof c.room_entity==='string')c.room_entity={default:c.room_entity};
      else if(!c.room_entity||typeof c.room_entity!=='object')c.room_entity={};
      else c.room_entity=Object.assign({},c.room_entity);
      c.room_entity.by_browser=Object.assign({},c.room_entity.by_browser||{});
      c.room_entity.by_browser[bid]=entEl.value.trim();
      self._config=c;self._render();self._fire(c);
    });

    ['base_image','filter_transition','base_image_conditions','base_camera','camera_refresh','weather_entity','weather_effect','weather_opacity','weather-nav-mini','zoom'].forEach(function(id){
      const el=self.querySelector('#'+id);if(el)el.addEventListener('change',fire);
    });
    // Per-profile inputs (aspect_ratio / border_radius / image_fit / image_align — 2 cells each)
    ROC_PROFILES.forEach(function(pk){['aspect_ratio','border_radius','image_fit','image_align'].forEach(function(idb){
      const el=self.querySelector('#'+idb+'__'+pk);if(el)el.addEventListener('change',fire);
    });});
    const undoBtn=this.querySelector('#roc-undo');
    if(undoBtn)undoBtn.addEventListener('click',function(){self._undo();});
    const redoBtn=this.querySelector('#roc-redo');
    if(redoBtn)redoBtn.addEventListener('click',function(){self._redo();});
    // Live icon previews
    this.querySelectorAll('[data-ico-icon],[data-b-icon],[data-vw-icon],[data-sec-icon]').forEach(function(inp){
      inp.addEventListener('input',function(){
        const prev=inp.parentElement&&inp.parentElement.querySelector('ha-icon[data-roc-prev]');
        if(prev)prev.setAttribute('icon',inp.value.trim());
      });
    });
    // Reorder (▲▼) — one generic handler for all item lists
    const _mvKinds={z:'zones',ov:'overlays',b:'badges',el:'elements',ico:'icons',lbl:'labels',g:'gauges',bl:'blinds',vw:'vacuum_widgets',gw:'glows',sec:'sections'};
    this.querySelectorAll('[data-mv]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.mv.split(':');
        const key=_mvKinds[p[0]];if(!key)return;
        const i=parseInt(p[1]),dir=parseInt(p[2]),j=i+dir;
        const c=self._collectConfig();
        const arr=p[0]==='sec'?c[key]:T(c)[key]; // sections are top-level, not per-room
        if(!arr||j<0||j>=arr.length)return;
        const t=arr[i];arr[i]=arr[j];arr[j]=t;
        // keep the moved panel open at its new index
        if(self._openPanels){
          const a=p[0]+'-'+i,b=p[0]+'-'+j;
          const hadA=self._openPanels.has(a),hadB=self._openPanels.has(b);
          if(hadA)self._openPanels.add(b);else self._openPanels.delete(b);
          if(hadB)self._openPanels.add(a);else self._openPanels.delete(a);
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    // Tile overlays (v6.9.0, D3 scheme b) -- nested one level inside one
    // element's own tile:, so they need their own add/remove/reorder rather
    // than the generic [data-mv]/_mvKinds mechanism above (which only knows
    // flat top-level/per-room arrays). `_mvKinds`/`A`/`T` are reused as-is.
    const _tileOvArr=function(c,kind,i){
      // Section-declared tiles (v6.11.2): 'dt' isn't in _mvKinds (sections
      // aren't per-room), and its i is composite ("<sectionIdx>_<tileIdx>")
      // since a declared tile has no flat top-level/per-room array of its own.
      if(kind==='dt'){
        const parts=String(i).split('_');
        const secI=parseInt(parts[0],10),tileI=parseInt(parts[1],10);
        if(!Array.isArray(c.sections))return null;
        const sec=c.sections[secI];if(!sec)return null;
        if(!Array.isArray(sec.tiles))sec.tiles=[];
        const item=sec.tiles[tileI];if(!item)return null;
        if(!Array.isArray(item.overlays))item.overlays=[];
        return item.overlays;
      }
      const key=_mvKinds[kind];if(!key)return null;
      const arr=A(c,key);const item=arr[i];if(!item)return null;
      if(!item.tile)item.tile={};
      if(!Array.isArray(item.tile.overlays))item.tile.overlays=[];
      return item.tile.overlays;
    };
    // Quick actions (B2, BUG_UX_ANALYSIS_v6.15.1.md §Part 2) -- resolves the
    // actual tile object (a tagged element's item.tile, or a section's own
    // flat declared tile) for the composite key _tileFieldsHtml() renders:
    // "kind:i" for the former (kind is one of the _mvKinds letters, never
    // numeric), "secIdx:ti" for the latter (both numeric) -- a purely numeric
    // first segment is what tells the two apart.
    const _tileRefForKey=function(c,key){
      const parts=key.split(':');
      if(/^\d+$/.test(parts[0])){
        if(!Array.isArray(c.sections))return null;
        const sec=c.sections[parseInt(parts[0],10)];if(!sec||!Array.isArray(sec.tiles))return null;
        return sec.tiles[parseInt(parts[1],10)]||null;
      }
      const arrKey=_mvKinds[parts[0]];if(!arrKey)return null;
      const arr=A(c,arrKey);const item=arr[parseInt(parts[1],10)];if(!item)return null;
      if(!item.tile)item.tile={};
      return item.tile;
    };
    this.querySelectorAll('[data-add-tquick]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const c=self._collectConfig();
        const tile=_tileRefForKey(c,btn.dataset.addTquick);if(!tile)return;
        if(!Array.isArray(tile.quick))tile.quick=[];
        tile.quick.push({icon:'mdi:play'});
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-tquick]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const parts=btn.dataset.rmTquick.split(':');
        const qi=parseInt(parts.pop(),10);
        const c=self._collectConfig();
        const tile=_tileRefForKey(c,parts.join(':'));if(!tile||!Array.isArray(tile.quick))return;
        tile.quick.splice(qi,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    // Action builder rows: switching the type only swaps which field group
    // is visible (no re-render, keeps focus) and fires like any other field.
    this.querySelectorAll('[data-act-type]').forEach(function(sel){
      sel.addEventListener('change',function(){
        const row=sel.closest('[data-act]');
        if(row)row.querySelectorAll('[data-act-fs]').forEach(function(g){g.style.display=g.getAttribute('data-act-fs')===sel.value?'flex':'none';});
        fire();
      });
    });
    this.querySelectorAll('[data-act-f]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-tf-name],[data-tf-entity],[data-tf-icon],[data-tf-anim],[data-tf-active],[data-tf-sclass],[data-tf-value],[data-tf-progress],[data-tf-q-icon],[data-tf-q-name],[data-tf-q-svc],[data-tf-q-target]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-tile-img]').forEach(function(el){
      el.addEventListener('input',function(){
        const box=self.querySelector('[data-tile-ov-box="'+el.dataset.tileImg+'"]');
        if(box)box.style.display=el.value.trim()?'':'none';
      });
      el.addEventListener('change',fire);
    });
    this.querySelectorAll('[data-tile-imgr]').forEach(function(el){el.addEventListener('change',fire);});
    // Section-declared tiles (v6.11.2) — add/remove/duplicate/reorder within
    // one section's own tiles: array (not a flat top-level/per-room array,
    // so this doesn't go through the generic [data-mv]/_mvKinds mechanism).
    this.querySelectorAll('[data-add-dtile]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const secI=parseInt(btn.dataset.addDtile,10);
        const c=self._collectConfig();
        if(!Array.isArray(c.sections)||!c.sections[secI])return;
        const sec=c.sections[secI];
        if(!Array.isArray(sec.tiles))sec.tiles=[];
        sec.tiles.push({name:'New tile'});
        if(!self._openPanels)self._openPanels=new Set();
        self._openPanels.add('dtile-'+secI+':'+(sec.tiles.length-1));
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-dtile]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.rmDtile.split(':'); // secI:ti
        const c=self._collectConfig();
        const sec=(c.sections||[])[parseInt(p[0],10)];if(!sec||!Array.isArray(sec.tiles))return;
        sec.tiles.splice(parseInt(p[1],10),1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-dup-dtile]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.dupDtile.split(':'); // secI:ti
        const c=self._collectConfig();
        const secI=parseInt(p[0],10),ti=parseInt(p[1],10);
        const sec=(c.sections||[])[secI];if(!sec||!Array.isArray(sec.tiles)||!sec.tiles[ti])return;
        const copy=rocClone(sec.tiles[ti]);
        if(copy.id)copy.id=copy.id+'_copy';
        sec.tiles.splice(ti+1,0,copy);
        if(!self._openPanels)self._openPanels=new Set();
        self._openPanels.add('dtile-'+secI+':'+(ti+1));
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-mv-dtile]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.mvDtile.split(':'); // secI:ti:dir
        const c=self._collectConfig();
        const secI=parseInt(p[0],10),ti=parseInt(p[1],10),dir=p[2]==='up'?-1:1,tj=ti+dir;
        const sec=(c.sections||[])[secI];if(!sec||!Array.isArray(sec.tiles)||tj<0||tj>=sec.tiles.length)return;
        const t=sec.tiles[ti];sec.tiles[ti]=sec.tiles[tj];sec.tiles[tj]=t;
        if(self._openPanels){
          const a='dtile-'+secI+':'+ti,b='dtile-'+secI+':'+tj;
          const hadA=self._openPanels.has(a),hadB=self._openPanels.has(b);
          if(hadA)self._openPanels.add(b);else self._openPanels.delete(b);
          if(hadB)self._openPanels.add(a);else self._openPanels.delete(a);
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-dtile-id],[data-dtile-yaml]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-tlov]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.addTlov.split(':'); // kind:i
        const c=self._collectConfig();
        const ovs=_tileOvArr(c,p[0],p[1]);if(!ovs)return;
        ovs.push({id:'overlay_'+(ovs.length+1),image:'',transition:'2s ease'});
        if(!self._openPanels)self._openPanels=new Set();
        self._openPanels.add('tlov-'+p[0]+':'+p[1]+':'+(ovs.length-1));
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-tlov]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.rmTlov.split(':'); // kind:i:ti
        const c=self._collectConfig();
        const ovs=_tileOvArr(c,p[0],p[1]);if(!ovs)return;
        ovs.splice(parseInt(p[2],10),1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-mv-tlov]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.mvTlov.split(':'); // kind:i:ti:dir
        const c=self._collectConfig();
        const ti=parseInt(p[2],10),dir=p[3]==='up'?-1:1,tj=ti+dir;
        const ovs=_tileOvArr(c,p[0],p[1]);if(!ovs||tj<0||tj>=ovs.length)return;
        const t=ovs[ti];ovs[ti]=ovs[tj];ovs[tj]=t;
        if(self._openPanels){
          const a='tlov-'+p[0]+':'+p[1]+':'+ti,b='tlov-'+p[0]+':'+p[1]+':'+tj;
          const hadA=self._openPanels.has(a),hadB=self._openPanels.has(b);
          if(hadA)self._openPanels.add(b);else self._openPanels.delete(b);
          if(hadB)self._openPanels.add(a);else self._openPanels.delete(a);
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-tlov-id],[data-tlov-img],[data-tlov-tr],[data-tlov-yaml],[data-tlov-anim]').forEach(function(el){el.addEventListener('change',fire);});
    // Tile overlay transform sub-panel -- identical wiring to the room
    // overlay's own [data-ov-tf-*] block below, composite-keyed.
    this.querySelectorAll('[data-tlov-tf-mode]').forEach(function(sel){
      sel.addEventListener('change',function(){
        const key=sel.dataset.tlovTfMode;
        ['states','range','spin'].forEach(function(m){
          const p=self.querySelector('[data-tlov-tfpane="'+key+'-'+m+'"]');
          if(p)p.style.display=(sel.value===m)?'':'none';
        });
        fire();
      });
    });
    this.querySelectorAll('[data-tlov-tf-ent],[data-tlov-tf-attr],[data-tlov-tf-origin],[data-tlov-tf-tr],[data-tlov-tf-persp],[data-tlov-tf-fv],[data-tlov-tf-ft],[data-tlov-tf-tv],[data-tlov-tf-tt],[data-tlov-tf-smin],[data-tlov-tf-smax],[data-tlov-tf-saxis],[data-tlov-tf-srev],[data-tlov-tfk],[data-tlov-tfv]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-tlovtfm]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=btn.dataset.addTlovtfm.split(':'); // kind:i:ti
        const c=self._collectConfig();
        const ovs=_tileOvArr(c,p[0],p[1]);if(!ovs)return;
        const ov=ovs[parseInt(p[2],10)];if(!ov)return;
        const tf=ov.transform||(ov.transform={});
        const mp=tf.map||(tf.map={});
        let k='state',nx=2;while(mp[k]!==undefined)k='state_'+(nx++);
        mp[k]='none';
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-tlovtfm]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const raw=btn.dataset.rmTlovtfm,dash=raw.lastIndexOf('-'); // "kind:i:ti-j"
        const p=raw.slice(0,dash).split(':'),j=parseInt(raw.slice(dash+1),10);
        const c=self._collectConfig();
        const ovs=_tileOvArr(c,p[0],p[1]);if(!ovs)return;
        const ov=ovs[parseInt(p[2],10)];const tf=ov&&ov.transform;if(!tf||!tf.map)return;
        const k=Object.keys(tf.map)[j];if(k===undefined)return;
        delete tf.map[k];
        if(!Object.keys(tf.map).length)delete tf.map;
        self._config=c;self._render();self._fire(c);
      });
    });
    // Editor → card highlight: opening an item panel flashes the element in the preview
    const _hlKinds={ov:['overlays','overlay'],z:['zones','zone'],b:['badges','badge'],el:['elements','element'],ico:['icons','icon'],lbl:['labels','label'],g:['gauges','gauge'],bl:['blinds','gauge'],vw:['vacuum_widgets','vacuum_widget'],gw:['glows','glow']};
    this.querySelectorAll('details[data-panel]').forEach(function(d){
      d.addEventListener('toggle',function(){
        if(!d.open)return;
        const m=d.dataset.panel.match(/^(ov|z|b|el|ico|lbl|g|bl|vw|gw)-(\d+)$/);
        if(!m)return;
        const k=_hlKinds[m[1]];
        const item=(self._roomView()[k[0]]||[])[parseInt(m[2])];
        if(!item)return;
        window.dispatchEvent(new CustomEvent('roc-highlight',{detail:{kind:k[1],id:m[1]==='bl'?'__bl_'+item.id:item.id,key:cfgKey(self._config)}}));
      });
    });
    const tm=this.querySelector('#test_mode');
    if(tm){
      tm.addEventListener('change',function(){
        // Edit mode also toggles the live preview panel below — force a local
        // re-render rather than just fire(), since setConfig()'s same-config
        // check would otherwise skip re-rendering for this field alone and the
        // preview host div (and its pos/room relay listeners) wouldn't appear.
        const c=self._collectConfig();
        self._config=c;
        self._render();
        self._fire(c);
      });
    }
    const hpEl2=this.querySelector('#haptic');if(hpEl2)hpEl2.addEventListener('change',fire);
    const caTa=this.querySelector('#cards_above_yaml');if(caTa)caTa.addEventListener('change',fire);
    const cbTa=this.querySelector('#cards_below_yaml');if(cbTa)cbTa.addEventListener('change',fire);
    // Light controls
    const addLc=this.querySelector('#add-lc-ent');
    if(addLc)addLc.addEventListener('click',function(){
      const c=self._collectConfig();
      const t=T(c);
      if(!t.light_controls)t.light_controls={entities:[]};
      if(!Array.isArray(t.light_controls.entities))t.light_controls.entities=[];
      t.light_controls.entities.push({entity:''});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-lc-ent]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmLcEnt);
        const c=self._collectConfig();const t=T(c);
        if(t.light_controls&&Array.isArray(t.light_controls.entities))t.light_controls.entities.splice(i,1);
        if(t.light_controls&&(!t.light_controls.entities||!t.light_controls.entities.length))delete t.light_controls;
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-lc-ent],[data-lc-name],#lc-lux,#lc-luxmax,#lc-cols,#lc-height,#lc-color-low,#lc-color-high,#lc-bg-off,#lc-style').forEach(function(el){
      el.addEventListener('change',fire);
    });
    // Live gradient preview — repaint the bar + max label without a full re-render
    const _gradPrev=this.querySelector('#lc-grad-preview');
    if(_gradPrev){
      const _updGrad=function(){
        const _lo=(self.querySelector('#lc-color-low')||{}).value||LC_DEF_LOW;
        const _hi=(self.querySelector('#lc-color-high')||{}).value||LC_DEF_HIGH;
        _gradPrev.style.background=lcGradientCss(_lo,_hi);
        const _lx=parseFloat((self.querySelector('#lc-luxmax')||{}).value);
        const _lbl=self.querySelector('#lc-grad-max');
        if(_lbl)_lbl.textContent=((!isNaN(_lx)&&_lx>0)?_lx:50)+' lx';
      };
      ['#lc-color-low','#lc-color-high','#lc-luxmax'].forEach(function(sel){
        const el=self.querySelector(sel);if(el)el.addEventListener('input',_updGrad);
      });
    }

    // Background mode toggle (image/camera) — swap panes (no re-render) + persist choice
    const bgModeEl=this.querySelector('#bg-mode');
    if(bgModeEl)bgModeEl.addEventListener('change',function(){
      self._bgMode=bgModeEl.value;
      const pi=self.querySelector('#bg-pane-image'),pc2=self.querySelector('#bg-pane-camera');
      if(pi)pi.style.display=bgModeEl.value==='image'?'block':'none';
      if(pc2)pc2.style.display=bgModeEl.value==='camera'?'grid':'none';
      self._fire(self._collectConfig());
    });
    // Filter mode toggle — swap panes (no re-render) + persist choice
    const fmodeEl=this.querySelector('#filter-mode');
    if(fmodeEl)fmodeEl.addEventListener('change',function(){
      self._filterMode=fmodeEl.value;
      const pc=self.querySelector('#filter-pane-conditional'),ps=self.querySelector('#filter-pane-smooth');
      if(pc)pc.style.display=fmodeEl.value==='conditional'?'':'none';
      if(ps)ps.style.display=fmodeEl.value==='smooth'?'':'none';
      self._fire(self._collectConfig());
    });
    // Filter conditions
    const addF=this.querySelector('#add-filter');
    if(addF)addF.addEventListener('click',function(){
      const c=self._collectConfig();
      A(c,'filter_conditions').push({filter:'none'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-filter]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmFilter);
        const c=self._collectConfig();
        A(c,'filter_conditions').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-filter-entity],[data-filter-state-op],[data-filter-state-val],[data-filter-and-entity],[data-filter-and-op],[data-filter-and-val],[data-filter-or-entity],[data-filter-or-op],[data-filter-or-val]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Brightness model
    const addBmSrc=this.querySelector('#add-bm-src');
    if(addBmSrc)addBmSrc.addEventListener('click',function(){
      const c=self._collectConfig();
      const t=T(c);
      if(!t.brightness_model)t.brightness_model={source:[],filter_gradient:[]};
      if(!t.brightness_model.source)t.brightness_model.source=[];
      t.brightness_model.source.push({entity:'',min_input:0,max_input:100});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bm-src]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBmSrc);
        const c=self._collectConfig();
        const t=T(c);if(t.brightness_model&&t.brightness_model.source)t.brightness_model.source.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bm-src-ent],[data-bm-src-attr],[data-bm-src-min],[data-bm-src-max],[data-bm-src-cond]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    const addBmFg=this.querySelector('#add-bm-fg');
    if(addBmFg)addBmFg.addEventListener('click',function(){
      const c=self._collectConfig();
      const t=T(c);
      if(!t.brightness_model)t.brightness_model={source:[],filter_gradient:[]};
      if(!t.brightness_model.filter_gradient)t.brightness_model.filter_gradient=[];
      const fg=t.brightness_model.filter_gradient;
      const last=fg[fg.length-1];
      fg.push({value:last?Math.min(100,last.value+25):0,filter:'none'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bm-fg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBmFg);
        const c=self._collectConfig();
        const t=T(c);if(t.brightness_model&&t.brightness_model.filter_gradient)t.brightness_model.filter_gradient.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bm-fg-val],[data-bm-fg-filt]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Overlays
    const addOv=this.querySelector('#add-ov');
    if(addOv)addOv.addEventListener('click',function(){
      const c=self._collectConfig();
      const ovA=A(c,'overlays');
      ovA.push({id:'overlay_'+(ovA.length+1),image:'',transition:'2s ease'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ov]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmOv);
        const c=self._collectConfig();
        A(c,'overlays').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-ov-id],[data-ov-img],[data-ov-tr],[data-ov-yaml],[data-ov-anim],[data-ov-grp]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Zones
    const addZ=this.querySelector('#add-z');
    if(addZ)addZ.addEventListener('click',function(){
      const c=self._collectConfig();
      const zA=A(c,'zones');
      zA.push({id:'zone_'+(zA.length+1),top:'0%',left:'0%',width:'10%',height:'10%'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-z]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmZ);
        const c=self._collectConfig();
        A(c,'zones').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-z-id],[data-z-top],[data-z-left],[data-z-w],[data-z-h],[data-z-hdelay],[data-z-vis],[data-z-slider],[data-z-grp]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Badges
    const addB=this.querySelector('#add-b');
    if(addB)addB.addEventListener('click',function(){
      const c=self._collectConfig();
      const bA=A(c,'badges');
      bA.push({id:'badge_'+(bA.length+1),position:'bottom-left'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-b]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmB);
        const c=self._collectConfig();
        A(c,'badges').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-b-id],[data-b-icon],[data-b-pos],[data-b-x],[data-b-y],[data-b-yaml],[data-b-anim],[data-b-ac]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Icons
    const addIco=this.querySelector('#add-ico');
    if(addIco)addIco.addEventListener('click',function(){
      const c=self._collectConfig();
      const icoA=A(c,'icons');
      icoA.push({id:'icon_'+(icoA.length+1),icon:'mdi:help',top:'10%',left:'10%',size:'24px'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-ico]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmIco);
        const c=self._collectConfig();
        A(c,'icons').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-ico-id],[data-ico-icon],[data-ico-size],[data-ico-z],[data-ico-top],[data-ico-left],[data-ico-hdelay],[data-ico-color],[data-ico-vis]').forEach(function(el){
      el.addEventListener('change',fire);
    });

    // Overlay transform engine
    this.querySelectorAll('[data-ov-tf-mode]').forEach(function(sel){
      sel.addEventListener('change',function(){
        const i=sel.dataset.ovTfMode;
        ['states','range','spin'].forEach(function(m){
          const p=self.querySelector('[data-ov-tfpane="'+i+'-'+m+'"]');
          if(p)p.style.display=(sel.value===m)?'':'none';
        });
        fire();
      });
    });
    this.querySelectorAll('[data-ov-tf-ent],[data-ov-tf-attr],[data-ov-tf-origin],[data-ov-tf-tr],[data-ov-tf-persp],[data-ov-tf-fv],[data-ov-tf-ft],[data-ov-tf-tv],[data-ov-tf-tt],[data-ov-tf-smin],[data-ov-tf-smax],[data-ov-tf-saxis],[data-ov-tf-srev],[data-ov-tfk],[data-ov-tfv]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    this.querySelectorAll('[data-add-tfm]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addTfm);
        const c=self._collectConfig();
        const arr=A(c,'overlays');if(!arr[i])return;
        const tf=arr[i].transform||(arr[i].transform={});
        const mp=tf.map||(tf.map={});
        let k='state',nx=2;while(mp[k]!==undefined)k='state_'+(nx++);
        mp[k]='none';
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-tfm]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const p=String(btn.dataset.rmTfm).split('-');
        const i=parseInt(p[0]),j=parseInt(p[1]);
        const c=self._collectConfig();
        const arr=A(c,'overlays');
        const tf=arr[i]&&arr[i].transform;if(!tf||!tf.map)return;
        const k=Object.keys(tf.map)[j];if(k===undefined)return;
        delete tf.map[k];
        if(!Object.keys(tf.map).length)delete tf.map;
        self._config=c;self._render();self._fire(c);
      });
    });

    // Light glow
    const addGw=this.querySelector('#add-gw');
    if(addGw)addGw.addEventListener('click',function(){
      const c=self._collectConfig();
      const gA=A(c,'glows');
      gA.push({id:'glow_'+(gA.length+1),entity:'',top:'40%',left:'50%',size:'25%',intensity:0.7});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-gw]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmGw);
        const c=self._collectConfig();
        A(c,'glows').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-dup-gw]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.dupGw),c=self._collectConfig();
        const dA=A(c,'glows');if(!dA[i])return;
        const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);
        dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-gw-id],[data-gw-ent],[data-gw-shape],[data-gw-size],[data-gw-w],[data-gw-h],[data-gw-top],[data-gw-left],[data-gw-int],[data-gw-fall],[data-gw-blend],[data-gw-color],[data-gw-anim],[data-gw-angle],[data-gw-z],[data-gw-grp],[data-gw-minb],[data-gw-aspeed],[data-gw-anchor],[data-gw-trans],[data-gw-yaml]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    // Colour picker → writes a hex into the text field (which stays the source
    // of truth, so "auto" / "2700K" / "r,g,b" keep working); dragging in the
    // picker previews live, releasing it commits.
    this.querySelectorAll('[data-gw-swatch]').forEach(function(sw){
      const txt=self.querySelector('[data-gw-color="'+sw.dataset.gwSwatch+'"]');
      if(!txt)return;
      sw.addEventListener('input',function(){txt.value=sw.value;sw.style.opacity='1';self._fireDebounced();});
      sw.addEventListener('change',function(){txt.value=sw.value;self._fire(self._collectConfig());});
    });
    this.querySelectorAll('[data-gw-auto]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const txt=self.querySelector('[data-gw-color="'+btn.dataset.gwAuto+'"]');
        if(!txt)return;
        txt.value='';
        const c=self._collectConfig();
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-gw-int-range]').forEach(function(range){
      const num=self.querySelector('[data-gw-int="'+range.dataset.gwIntRange+'"]');
      if(!num)return;
      range.addEventListener('input',function(){num.value=range.value;self._fireDebounced();});
      num.addEventListener('change',function(){range.value=num.value;});
    });

    // Vacuum widgets
    const addVw=this.querySelector('#add-vw');
    if(addVw)addVw.addEventListener('click',function(){
      const c=self._collectConfig();
      const vwA=A(c,'vacuum_widgets');
      vwA.push({id:'vac_'+(vwA.length+1),icon:'mdi:robot-vacuum',top:'90%',left:'4%',size:'44px',vacuums:[]});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-vw]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmVw);
        const c=self._collectConfig();
        A(c,'vacuum_widgets').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-dup-vw]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.dupVw),c=self._collectConfig();
        const dA=A(c,'vacuum_widgets');if(!dA[i])return;
        const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);
        dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-vw-id],[data-vw-icon],[data-vw-size],[data-vw-z],[data-vw-top],[data-vw-left],[data-vw-yaml]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    this.querySelectorAll('[data-vw-pos]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const parts=btn.dataset.vwPos.split(':');
        const i=parseInt(parts[0]),code=parts[1];
        const topEl=self.querySelector('[data-vw-top="'+i+'"]');
        const leftEl=self.querySelector('[data-vw-left="'+i+'"]');
        const sizeEl=self.querySelector('[data-vw-size="'+i+'"]');
        if(!topEl||!leftEl)return;
        const m=((sizeEl&&sizeEl.value)||'').trim().match(/^(\d+(?:\.\d+)?)px$/);
        const sz=m?parseFloat(m[1]):44;
        const MARGIN=12;
        const near=MARGIN+'px';
        const far='calc(100% - '+(MARGIN+sz)+'px)';
        const mid='calc(50% - '+(sz/2)+'px)';
        const V={t:near,c:mid,b:far};
        const H={l:near,c:mid,r:far};
        const map={tl:['t','l'],tc:['t','c'],tr:['t','r'],cl:['c','l'],cc:['c','c'],cr:['c','r'],bl:['b','l'],bc:['b','c'],br:['b','r']};
        const pair=map[code];
        if(!pair)return;
        topEl.value=V[pair[0]];
        leftEl.value=H[pair[1]];
        const c=self._collectConfig();self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-add-vwv]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addVwv);
        const c=self._collectConfig();
        const vwArr=A(c,'vacuum_widgets');
        if(!vwArr[i])return;
        if(!vwArr[i].vacuums)vwArr[i].vacuums=[];
        vwArr[i].vacuums.push({entity:''});
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-vwv]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const parts=btn.dataset.rmVwv.split('-');
        const i=parseInt(parts[0]),j=parseInt(parts[1]);
        const c=self._collectConfig();
        const vwArr=A(c,'vacuum_widgets');
        if(vwArr[i]&&vwArr[i].vacuums){
          vwArr[i].vacuums.splice(j,1);
          if(!vwArr[i].vacuums.length)delete vwArr[i].vacuums;
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-vw-vac]').forEach(function(el){
      el.addEventListener('change',fire);el.addEventListener('input',function(){self._fireDebounced();});
    });

    // Labels
    const addLbl=this.querySelector('#add-lbl');
    if(addLbl)addLbl.addEventListener('click',function(){
      const c=self._collectConfig();
      const lblA=A(c,'labels');
      lblA.push({id:'label_'+(lblA.length+1),top:'10%',left:'10%',entity:''});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-lbl]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmLbl);
        const c=self._collectConfig();
        A(c,'labels').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-lbl-id],[data-lbl-top],[data-lbl-left],[data-lbl-entity],[data-lbl-attr],[data-lbl-suffix],[data-lbl-yaml],[data-lbl-anim],[data-lbl-ac],[data-lbl-tmpl]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-lg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addLg);
        const c=self._collectConfig();
        const lblArr=A(c,'labels');
        if(!lblArr[i])return;
        if(!lblArr[i].color_gradient)lblArr[i].color_gradient=[];
        const ls=lblArr[i].color_gradient;
        const last=ls[ls.length-1];
        const nv=last?last.value+10:0;
        ls.push({value:nv,color:'#ffffff'});
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-lg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const parts=btn.dataset.rmLg.split('-');
        const i=parseInt(parts[0]),j=parseInt(parts[1]);
        const c=self._collectConfig();
        const lblArr=A(c,'labels');
        if(lblArr[i]&&lblArr[i].color_gradient){
          lblArr[i].color_gradient.splice(j,1);
          if(!lblArr[i].color_gradient.length)delete lblArr[i].color_gradient;
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-l-lv],[data-l-lc]').forEach(function(el){
      el.addEventListener('change',fire);el.addEventListener('input',function(){self._fireDebounced();});
    });

    // Gauges
    const addG=this.querySelector('#add-g');
    if(addG)addG.addEventListener('click',function(){
      const c=self._collectConfig();
      const gA=A(c,'gauges');
      gA.push({id:'gauge_'+(gA.length+1),top:'10%',left:'10%',width:'2%',height:'20%',entity:'',min:0,max:100});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-g]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmG);
        const c=self._collectConfig();
        A(c,'gauges').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-g-id],[data-g-top],[data-g-left],[data-g-w],[data-g-h],[data-g-entity],[data-g-attr],[data-g-min],[data-g-max],[data-g-yaml],[data-g-orient],[data-g-anim],[data-g-ac],[data-g-alert-ent],[data-g-alert-attr],[data-g-alert-op],[data-g-alert-val]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-gg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.addGg);
        const c=self._collectConfig();
        const gArr=A(c,'gauges');
        if(!gArr[i])return;
        if(!gArr[i].color_gradient)gArr[i].color_gradient=[];
        const gs=gArr[i].color_gradient;
        const last=gs[gs.length-1];
        const mn=gArr[i].min??0,mx=gArr[i].max??100;
        const nv=last?Math.min(last.value+Math.round((mx-mn)/6),mx):mn;
        gs.push({value:nv,color:'#00ff44'});
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-rm-gg]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const parts=btn.dataset.rmGg.split('-');
        const i=parseInt(parts[0]),j=parseInt(parts[1]);
        const c=self._collectConfig();
        const gArr=A(c,'gauges');
        if(gArr[i]&&gArr[i].color_gradient){
          gArr[i].color_gradient.splice(j,1);
          if(!gArr[i].color_gradient.length)delete gArr[i].color_gradient;
        }
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-g-gv],[data-g-gc]').forEach(function(el){
      el.addEventListener('change',fire);el.addEventListener('input',function(){self._fireDebounced();});
    });

    // Elements
    const addEl=this.querySelector('#add-el');
    if(addEl)addEl.addEventListener('click',function(){
      const c=self._collectConfig();
      const elA=A(c,'elements');
      elA.push({id:'el_'+(elA.length+1),top:'0%',left:'0%',width:'30%',height:'20%',card:{type:'tile',entity:''}});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-el]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmEl);
        const c=self._collectConfig();
        A(c,'elements').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-el-id],[data-el-top],[data-el-bot],[data-el-left],[data-el-w],[data-el-h],[data-el-yaml]').forEach(function(el){
      el.addEventListener('change',fire);
    });
    // Blinds
    const addBl=this.querySelector('#add-bl');
    if(addBl)addBl.addEventListener('click',function(){
      const c=self._collectConfig();
      const blA=A(c,'blinds');
      blA.push({id:'blind_'+(blA.length+1),top:'10%',left:'30%',width:'20%',height:'40%',entity:'',min:0,max:100,blind_type:'roller'});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-bl]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmBl);
        const c=self._collectConfig();
        A(c,'blinds').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-bl-id],[data-bl-top],[data-bl-left],[data-bl-w],[data-bl-h],[data-bl-entity],[data-bl-attr],[data-bl-min],[data-bl-max],[data-bl-top-offset],[data-bl-z],[data-bl-type],[data-bl-slat-color],[data-bl-slat-count],[data-bl-shift-turns],[data-bl-shift-start],[data-bl-shift-snap],[data-bl-shift-legacy],[data-bl-slat-w],[data-bl-slat-g],[data-bl-gap-color],[data-bl-yaml]').forEach(function(el){el.addEventListener('change',fire);});
    this.querySelectorAll('[data-add-ccp]').forEach(function(btn){btn.addEventListener('click',function(){
      const i=parseInt(btn.dataset.addCcp,10);const c=self._collectConfig();const bl=A(c,'blinds')[i];if(!bl)return;
      if(!bl.control||typeof bl.control!=='object')bl.control={display:'popover'};
      if(!Array.isArray(bl.control.presets))bl.control.presets=[];
      bl.control.presets.push({position:100,icon:'',color:'',name:''});
      self._config=c;self._render();self._fire(c);
    });});
    this.querySelectorAll('[data-rm-ccp]').forEach(function(btn){btn.addEventListener('click',function(){
      const pr=String(btn.dataset.rmCcp).split(':'),i=parseInt(pr[0],10),j=parseInt(pr[1],10);
      const c=self._collectConfig();const bl=A(c,'blinds')[i];if(!bl||!bl.control||!Array.isArray(bl.control.presets))return;
      bl.control.presets.splice(j,1);
      self._config=c;self._render();self._fire(c);
    });});
    this.querySelectorAll('[data-bl-ccdisp],[data-bl-ccslider],[data-bl-cctop],[data-bl-ccleft],[data-bl-ccwidth],[data-ccp-pos],[data-ccp-icon],[data-ccp-color],[data-ccp-name]').forEach(function(el){el.addEventListener('change',fire);});

    // Duplicate (clone) handlers
    function _cp(v,dflt){if(!v)return dflt||'3%';const n=parseFloat(v);return(!isNaN(n)&&String(v).trim().endsWith('%'))?Math.min(n+3,95).toFixed(1)+'%':v;}
    this.querySelectorAll('[data-dup-ico]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupIco),c=self._collectConfig();const dA=A(c,'icons');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-lbl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupLbl),c=self._collectConfig();const dA=A(c,'labels');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-g]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupG),c=self._collectConfig();const dA=A(c,'gauges');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-bl]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupBl),c=self._collectConfig();const dA=A(c,'blinds');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-el]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupEl),c=self._collectConfig();const dA=A(c,'elements');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});
    this.querySelectorAll('[data-dup-z]').forEach(function(btn){btn.addEventListener('click',function(){const i=parseInt(btn.dataset.dupZ),c=self._collectConfig();const dA=A(c,'zones');if(!dA[i])return;const cl=rocClone(dA[i]);cl.id=rocDupId(cl.id,dA);cl.top=_cp(cl.top);cl.left=_cp(cl.left);dA.splice(i+1,0,cl);self._config=c;self._render();self._fire(c);});});

    // Group fields on elements
    this.querySelectorAll('[data-ico-grp],[data-lbl-grp],[data-g-grp],[data-bl-grp],[data-el-grp],[data-vw-grp]').forEach(function(el){el.addEventListener('change',fire);});
    // nav.live:custom "Show in mini" checkboxes (NAV_LIVE_FULL_PLAN.md §13) —
    // one shared list across every element type that has one, same pattern
    // as the Group fields just above.
    this.querySelectorAll('[data-b-nav-mini],[data-el-nav-mini],[data-ico-nav-mini],[data-lbl-nav-mini],[data-g-nav-mini],[data-bl-nav-mini],[data-ico-chip]').forEach(function(el){el.addEventListener('change',fire);});

    // Groups
    const addGrp=this.querySelector('#add-grp');
    if(addGrp)addGrp.addEventListener('click',function(){
      const c=self._collectConfig();
      const grpA=A(c,'groups');
      grpA.push({id:'group_'+(grpA.length+1),visible:false});
      self._config=c;self._render();self._fire(c);
    });
    this.querySelectorAll('[data-rm-grp]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmGrp);
        const c=self._collectConfig();
        A(c,'groups').splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-grp-id],[data-grp-gc],[data-grp-vis],[data-grp-yaml]').forEach(function(el){el.addEventListener('change',fire);});

    // ----- Cockpit sections (v6.8.0) — top-level list, own add/remove/dup ----
    const addSec=this.querySelector('#add-section');
    if(addSec)addSec.addEventListener('click',function(){
      const c=self._collectConfig();
      if(!Array.isArray(c.sections))c.sections=[];
      let n=c.sections.length+1,id='section_'+n;
      while(c.sections.some(function(s){return s.id===id;})){n++;id='section_'+n;}
      c.sections.push({id:id,title:'Section '+n,icon:'mdi:view-grid-outline'});
      if(!self._openPanels)self._openPanels=new Set();
      self._openPanels.add('sec-'+(c.sections.length-1));
      self._config=c;self._render();self._fire(c);
    });
    // Onboarding — recipes (kap.5.3.3) and the untagged-device scan's
    // one-click add (kap.5.3.2) both fill in the same section skeleton the
    // plain +Add section button uses, just pre-filled from _recipeDef().
    function addSectionFromRecipe(kind){
      const rd=self._recipeDef(kind);if(!rd)return;
      const c=self._collectConfig();
      if(!Array.isArray(c.sections))c.sections=[];
      const base=rd.id_base||kind;
      let n=0,id=base;
      while(c.sections.some(function(s){return s.id===id;})){n++;id=base+'_'+n;}
      c.sections.push(Object.assign({id:id},rd));
      if(!self._openPanels)self._openPanels=new Set();
      self._openPanels.add('sec-'+(c.sections.length-1));
      self._config=c;self._render();self._fire(c);
    }
    const addSecRecipe=this.querySelector('#add-section-recipe');
    if(addSecRecipe)addSecRecipe.addEventListener('change',function(){
      const kind=addSecRecipe.value;if(!kind)return;
      addSectionFromRecipe(kind);
    });
    this.querySelectorAll('[data-add-untagged-recipe]').forEach(function(btn){
      btn.addEventListener('click',function(){addSectionFromRecipe(btn.dataset.addUntaggedRecipe);});
    });
    this.querySelectorAll('[data-rm-sec]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.rmSec,10);
        const c=self._collectConfig();
        if(Array.isArray(c.sections))c.sections.splice(i,1);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-dup-sec]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const i=parseInt(btn.dataset.dupSec,10);
        const c=self._collectConfig();
        if(!Array.isArray(c.sections)||!c.sections[i])return;
        const copy=rocClone(c.sections[i]);
        const baseId=copy.id||'section';let n=1,id=baseId+'_copy';
        while(c.sections.some(function(s){return s.id===id;})){n++;id=baseId+'_copy'+n;}
        copy.id=id;
        c.sections.splice(i+1,0,copy);
        self._config=c;self._render();self._fire(c);
      });
    });
    this.querySelectorAll('[data-sec-source]').forEach(function(sel){
      sel.addEventListener('change',function(){
        const cardBox=self.querySelector('[data-sec-card-box="'+sel.dataset.secSource+'"]');
        if(cardBox)cardBox.style.display=sel.value==='card'?'':'none';
        const domBox=self.querySelector('[data-sec-domain-box="'+sel.dataset.secSource+'"]');
        if(domBox)domBox.style.display=sel.value==='auto'?'':'none';
        fire();
      });
    });
    this.querySelectorAll('[data-sec-id],[data-sec-title],[data-sec-icon],[data-sec-placement],[data-sec-size],[data-sec-columns],[data-sec-badge],[data-sec-subtitle],[data-sec-backdrop],[data-sec-card-yaml],[data-sec-domain],[data-sec-vt]').forEach(function(el){el.addEventListener('change',fire);});
    // Per-element Section select + tile: box (zones/icons/elements/blinds) —
    // one generic handler keyed by "kind:i", shared across all four editors.
    this.querySelectorAll('[data-sec-link]').forEach(function(sel){
      sel.addEventListener('change',function(){
        const box=self.querySelector('[data-sec-tile-box="'+sel.dataset.secLink+'"]');
        if(box)box.style.display=sel.value?'':'none';
        fire();
      });
    });
    this.querySelectorAll('[data-sec-tile]').forEach(function(el){el.addEventListener('change',fire);});
  }

  disconnectedCallback(){
    clearTimeout(this._fdT);
    if(this._rocPosHandler){window.removeEventListener('roc-pos-update',this._rocPosHandler);this._rocPosHandler=null;}
    // v5.9.14: this one was missing — every editor open/close left a live
    // roc-room-switch listener pinning the dead editor instance in memory and
    // still firing on room switches.
    if(this._rocRoomHandler){window.removeEventListener('roc-room-switch',this._rocRoomHandler);this._rocRoomHandler=null;}
    // Drop the mounted preview card so its own observers/timers can be
    // collected (it is a full room-overlay-card instance).
    this._prevCard=null;
  }
}

customElements.define('room-overlay-card-editor',RoomOverlayCardEditor);
customElements.get('room-overlay-card').getConfigElement=function(){return document.createElement('room-overlay-card-editor');};
