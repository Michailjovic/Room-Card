class RoomOverlayCard extends HTMLElement{
  constructor(){
    super();this.attachShadow({mode:'open'});
    this._config=null;this._hass=null;this._rendered=false;
    this._baseEl=null;this._ovEls={};this._zoneEls={};
    this._biconEls={};this._blabelEls={};this._cardEls={};this._contEls={};
    this._icoEls={};this._icoIconEls={};
    this._wrapEl=null;this._contentEl=null;this._cardEl=null; // layout refs (see _elWrap/_elContent/_elCard)
    this._layoutQueued=false;this._layoutFitDirty=false;
    this._needsCardWidth=false;this._hasDayNightGauge=false; // geometry-dependency flags, set per render
    this._rafPending=false;this._relevantEntities=null;this._relevantAttrSources=null;this._prevStates={};
    this._io=null;this._ro=null;this._visible=true;this._testFlipped=false;this._lblEls={};this._gaugeEls={};
    this._groupState={};this._grpPanelEls={};
    this._sectionOpen=null;this._secCfgRef=null;this._secCache=[];this._secPanelEls={};this._secBadgeEls={};this._secTileEls={};this._secCardEls={};this._secVisMap={};this._secKeyHandler=null;
    this._selectedTM=null;this._tmKeyHandler=null;
    this._lcEls=[];this._lcCfg=null;this._lcPrevCol=null;this._lcToggles=[];
    this._bcontEls={};this._wxEl=null;this._camTimer=null;
    this._tmplUnsubs=[];this._tmplVals={};this._tmplVis={};this._relTimer=null;this._relNeeded=false;
    this._gdH=null;this._gdV=null;this._tier=null;this._vt=null;this._profile=null;this._profFlipped=false;this._lp=null;this._winHandler=null;this._wrapRo=null;this._bodyRo=null;
    this._scRo=null;this._scrollEl=null;this._rootHPx=0;this._rootHRaw=0;this._rootHT1=null;this._locHandler=null;this._barMo=null;this._pvMo=null;this._lastPinCheck=0;this._pinQueued=false;
    this._roomIdx=0;this._roomCfg=null;this._manualHoldUntil=0;
    this._navThumbEls={};this._navChipEls=[];this._navCardEls=[];this._zoomScale=1;
    this._navMiniEls={};this._navMiniRo=null;
    this._navPos='top';this._wrapTA='';
    this._orientHandler=null;this._roomDragActive=false;
    this._lastRoomDragEnd=0;this._followInit=false;this._navFollowEl=null;
    this._stripCardEls=[];this._imgRatios={};
    this._hlHandler=null;this._sortedLblGrads={};this._sortedBmFg=null;this._radialMeta={};
    this._cfgJson=null;this._renderGen=0;this._navEntities=null;this._navDirty=false;this._fullDirty=false;
    this._navAttrSources=null;this._navBmSorted={};
  }

  static getStubConfig(){return{base_image:ROC_STUB_IMG,layout:{},aspect_ratio:'16/9',border_radius:'12px',filter_conditions:[],overlays:[],zones:[],badges:[],elements:[],icons:[],test_mode:false,labels:[],gauges:[],vacuum_widgets:[]};}

  setConfig(cfg){
    this._rocRaw=cfg; // the exact object HA handed in — the studio finds it in lovelace.config by identity
    cfg=rocMigrateLayout(cfg);
    const hasRooms=Array.isArray(cfg.rooms)&&cfg.rooms.length;
    if(!cfg.base_image&&!cfg.base_camera&&!(hasRooms&&cfg.rooms.some(function(r){return r.base_image||r.base_camera;})))
      throw new Error('[room-overlay-card] base_image (or base_camera) is required — directly or in rooms[]');
    const j=JSON.stringify(cfg);
    if(this._rendered&&this._cfgJson===j)return; // identical config — skip full rebuild
    this._cfgJson=j;
    // Warn once about element ids that would break HTML/selector interpolation.
    // Derived instances (nav minis, swipe ghosts, editor previews) carry a copy
    // of a config that was already checked — skip them.
    const _derived=!!(cfg._roc_mini||cfg._roc_ghost||cfg._roc_preview);
    const _badId=/[^A-Za-z0-9_-]/;
    if(!_derived)outer:for(const r of(hasRooms?cfg.rooms:[cfg])){
      if(!r)continue;
      for(const k of['overlays','zones','badges','icons','labels','gauges','vacuum_widgets','glows','blinds','elements','groups']){
        for(const it of(r[k]||[])){
          if(it&&it.id!=null&&_badId.test(String(it.id))){
            rocWarnOnce('[room-overlay-card] element id "'+it.id+'" contains characters outside A-Za-z0-9_- — rendering/selection may misbehave');
            break outer;
          }
        }
      }
    }
    // Warn once about duplicate ids within the same list, per room — _render()
    // caches DOM nodes by id via querySelector, so a second item with the same
    // id renders but its own updates never reach it (the editor's Duplicate
    // button used to be able to produce this itself before it started
    // guaranteeing uniqueness — see rocDupId).
    if(!_derived)outerDup:for(const r of(hasRooms?cfg.rooms:[cfg])){
      if(!r)continue;
      for(const k of['overlays','zones','badges','icons','labels','gauges','vacuum_widgets','glows','blinds','elements','groups']){
        const _seenIds=new Set();
        for(const it of(r[k]||[])){
          if(!it||it.id==null)continue;
          if(_seenIds.has(it.id)){
            rocWarnOnce('[room-overlay-card] duplicate "'+it.id+'" id in '+k+'[] — only the first match ever updates (ids must be unique)');
            break outerDup;
          }
          _seenIds.add(it.id);
        }
      }
    }
    if(hasRooms&&this._roomIdx>=cfg.rooms.length)this._roomIdx=0;
    this._config=cfg;this._rendered=false;if(this._hass)this._render();
  }

  // Home Assistant sets editMode (and preview) on every card while the DASHBOARD is in edit mode
  // (verified on HA 2026.10.2: masonry, sections and panel views). The card then offers a
  // Studio button of its own (v6.42.0), so the saved Edit-mode setting is no longer needed to
  // reach the studio from the dashboard.
  set editMode(v){
    const n=!!v;
    if(n===!!this._haEdit)return;
    this._haEdit=n;
    this._syncStudioChip();
  }
  get editMode(){return!!this._haEdit;}
  _syncStudioChip(){
    const sr=this.shadowRoot;if(!sr)return;
    const c=this._config;
    const admin=!(this._hass&&this._hass.user&&this._hass.user.is_admin===false);
    // Sections views cover each card with HA's own click-to-edit layer (hui-card-edit-mode): a
    // button underneath could not be pressed, and HA's editor has the Studio button anyway.
    // Only on the dashboard itself: an ancestor holds the dashboard (lovelace) — not the preview
    // inside HA's card-editor dialog, which HA also puts in edit mode.
    let covered=false,onDash=false;
    for(let n=this,i=0;n&&i<60;i++){
      n=n.parentNode||n.host;if(!n)break;
      if(n.tagName==='HUI-CARD-EDIT-MODE')covered=true;
      if(n.lovelace&&n.lovelace.config){onDash=true;break;}
    }
    const want=!!(this._haEdit&&onDash&&c&&!c.test_mode&&!c._roc_preview&&!c._roc_studio&&!c._roc_mini&&!c._roc_ghost&&admin&&!covered);
    let b=sr.querySelector('.roc-studio-chip');
    if(!want){if(b)b.remove();return;}
    if(b&&b.isConnected)return;
    const host=sr.querySelector('.wrap');if(!host)return;
    b=document.createElement('button');
    b.className='roc-studio-chip';b.type='button';b.title='Open the full-screen Room Card Studio';
    b.innerHTML='&#9998; Studio';
    b.style.cssText='position:absolute;top:8px;right:8px;z-index:900;background:rgba(40,70,140,0.92);color:#fff;border:1px solid rgba(255,255,255,0.4);border-radius:8px;padding:6px 14px;font:600 13px/1.2 sans-serif;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
    ['pointerdown','mousedown','touchstart','touchend','dblclick'].forEach(function(t){b.addEventListener(t,function(e){e.stopPropagation();},{passive:true});});
    const self=this;
    b.addEventListener('click',function(e){
      e.stopPropagation();e.preventDefault();
      b.disabled=true;
      rocOpenStudio({from:'dashboard',card:self,hass:self._hass})
        .catch(function(err){b.textContent='\u26A0 '+((err&&err.message)||String(err));})
        .then(function(){b.disabled=false;});
    });
    host.appendChild(b);
  }

  set hass(h){
    this._hass=h;if(!this._config)return;
    if(!this._rendered){this._render();return;}
    // Embedded cards do their own change detection — always forward hass
    // (even while off-screen, so they're current the moment the card scrolls back)
    for(const k in this._cardEls){try{this._cardEls[k].hass=h;}catch(_){}}
    for(const k in(this._secCardEls||{})){try{this._secCardEls[k].hass=h;}catch(_){}}
    for(const el of(this._navCardEls||[]))try{el.hass=h;}catch(_){}
    for(const ri in(this._navMiniEls||{}))try{this._navMiniEls[ri].el.hass=h;}catch(_){}
    for(const ri in(this._ovMiniEls||{}))try{this._ovMiniEls[ri].el.hass=h;}catch(_){}
    for(const el of(this._ovCardEls||[]))try{el.hass=h;}catch(_){}
    for(const el of(this._stripCardEls||[]))try{el.hass=h;}catch(_){}
    for(const o of(this._lcEls||[]))try{o.el.hass=h;}catch(_){}
    // Only trust _visible while an IntersectionObserver is actually alive to
    // flip it back. Without this, ANY future path that loses the IO turns a
    // stale `_visible=false` into a permanently frozen card (see the v5.9.14
    // note on disconnectedCallback). Browsers without IO keep _io null and so
    // never suppress updates at all — which is the correct fallback.
    if(!this._visible&&this._io)return;
    if(this._relevantEntities){
      const s=h.states,p=this._prevStates;
      const chg=this._relevantEntities.some(id=>s[id]?.state!==p[id])
        ||(this._relevantAttrSources&&this._relevantAttrSources.some(a=>s[a.entity]?.attributes[a.attr]!==p[a.entity+'.'+a.attr]));
      if(!chg){
        // Active room untouched — maybe another room's thumbnail/chip changed
        const navChg=(this._navEntities&&this._navEntities.length&&this._navEntities.some(id=>s[id]?.state!==p[id]))
          ||(this._navAttrSources&&this._navAttrSources.length&&this._navAttrSources.some(a=>s[a.entity]?.attributes[a.attr]!==p[a.entity+'.'+a.attr]));
        if(navChg)this._schedule(true);
        return;
      }
    }
    this._schedule(false);
  }

  // Batched update; navOnly refreshes just the nav thumbnails/chips.
  // A pending nav-only frame upgrades to a full one if a full request lands first.
  // rAF while visible (paint-aligned), setTimeout(0) while hidden — rAF NEVER
  // fires in background tabs (browser_mod popups, secondary windows), which
  // would queue state updates forever and leave a stale card on re-focus.
  _schedule(navOnly){
    if(navOnly)this._navDirty=true;else this._fullDirty=true;
    if(this._rafPending)return;
    this._rafPending=true;
    const run=()=>{
      this._rafPending=false;
      const full=this._fullDirty;this._fullDirty=false;this._navDirty=false;
      if(!this._hass||!this._rendered)return;
      if(full)this._update();else this._updateNav();
    };
    if(typeof document!=='undefined'&&document.hidden)setTimeout(run,0);
    else requestAnimationFrame(run);
  }

  _extractEntities(obj,ids=new Set(),attrs=new Set()){
    if(!obj||typeof obj!=='object')return{ids,attrs};
    if(typeof obj.entity==='string'){
      ids.add(obj.entity);
      if(typeof obj.attribute==='string')attrs.add(obj.entity+' '+obj.attribute);
    }
    if(typeof obj.color_from==='string'){
      ids.add(obj.color_from);
      attrs.add(obj.color_from+' rgb_color');
      attrs.add(obj.color_from+' color_temp_kelvin');
    }
    for(const v of Object.values(obj)){
      if(Array.isArray(v))v.forEach(i=>{
        if(typeof i==='string'&&/^[a-z_]+\.[a-z0-9_]+$/.test(i))ids.add(i); // entity-id strings in plain lists (e.g. embedded entities cards)
        else this._extractEntities(i,ids,attrs);
      });
      else if(v&&typeof v==='object')this._extractEntities(v,ids,attrs);
    }
    return{ids,attrs};
  }

  _extractAttrSources(cfg){
    const out=[];
    const add=function(entity,attr){if(entity&&attr)out.push({entity,attr});}
    ;(cfg.brightness_model?.source||[]).forEach(function(s){add(s.entity,s.attribute);});
    (cfg.gauges||[]).forEach(function(g){add(g.entity,g.attribute);if(g.alert_conditions?.attribute)add(g.alert_conditions.entity,g.alert_conditions.attribute);});
    (cfg.labels||[]).forEach(function(l){add(l.entity,l.attribute);});
    (cfg.icons||[]).forEach(function(ico){add(ico.entity,ico.attribute);});
    (cfg.blinds||[]).forEach(function(bl){add(bl.entity,bl.attribute);});
    // Glow strength/colour come from brightness + colour attributes, not the
    // on/off state alone — without these, dimming or re-colouring an already-on
    // light never re-triggers _update() (only a state flip, or a forced
    // re-render such as dragging the glow in edit mode, did).
    (cfg.glows||[]).forEach(function(g){add(g.entity,'brightness');add(g.entity,'rgb_color');add(g.entity,'color_temp_kelvin');add(g.entity,'color_temp');});
    return out;
  }

  getCardSize(){return 4;}

  _addZoneListeners(el,tapAction,holdAction,doubleTapAction,holdDelay){
    const delay=holdDelay??500;
    let holdTimer=null,showTimer=null,held=false,tapTimer=null,lastTapTime=0,ring=null;
    // Scroll-vs-tap: touchmove already cancels the hold timer, but a finger
    // that started a page scroll on top of a tappable element still fired
    // its tap_action on release (v6.12.2 fix) — track how far the touch
    // travelled and swallow the tap once it moved past a small jitter
    // threshold, exactly like native tap-vs-scroll disambiguation.
    let touchX=0,touchY=0,scrolled=false;
    const self=this;
    // Hold progress ring — fills over the hold delay, turns green when the hold
    // threshold is reached (so you know it registered). Global opt-out: hold_feedback:false.
    const fb=holdAction&&!(self._roomCfg&&self._roomCfg.hold_feedback===false);
    const fbColor=(self._roomCfg&&self._roomCfg.hold_color)||'';
    const sd=Math.min(140,Math.round(delay*0.25)); // small delay so quick taps don't flash the ring
    const startHold=function(dur){
      if(!fb||ring)return;
      ring=document.createElement('div');
      ring.className='roc-hold';
      ring.style.setProperty('--roc-hold-dur',dur+'ms');
      if(fbColor)ring.style.setProperty('--roc-hold-color',fbColor);
      ring.innerHTML='<svg viewBox="0 0 36 36"><circle class="roc-hold-trk" cx="18" cy="18" r="16"></circle><circle class="roc-hold-bar" cx="18" cy="18" r="16"></circle></svg>';
      el.appendChild(ring);
    };
    const doneHold=function(){if(ring)ring.classList.add('done');};
    const cancel=function(){clearTimeout(holdTimer);clearTimeout(showTimer);if(ring){ring.remove();ring=null;}};
    const press=function(e){
      held=false;scrolled=false;cancel();
      if(e&&e.touches&&e.touches[0]){touchX=e.touches[0].clientX;touchY=e.touches[0].clientY;}
      if(holdAction){
        showTimer=setTimeout(function(){startHold(delay-sd);},sd);
        holdTimer=setTimeout(function(){
          held=true;doneHold();
          // Tactile confirmation the MOMENT the hold threshold is reached —
          // distinct from _exec()'s haptic (which fires later, on release,
          // for whichever action actually ran). Same opt-out as everywhere
          // else in the card: top-level `haptic: false`.
          if(self._config.haptic!==false)try{window.dispatchEvent(new CustomEvent('haptic',{detail:'medium'}));}catch(_){}
        },delay);
      }
    };
    const onTap=function(e){
      if(el._rocSlid){el._rocSlid=false;return;} // slider drag just ended — swallow the tap
      if(held){if(holdAction)self._exec(holdAction,e);held=false;return;}
      if(doubleTapAction){
        const now=Date.now();
        if(now-lastTapTime<350){ // double tap works even without tap_action
          if(tapTimer){clearTimeout(tapTimer);tapTimer=null;}
          lastTapTime=0;
          self._exec(doubleTapAction,e);
        }else{
          lastTapTime=now;
          if(tapAction)tapTimer=setTimeout(function(){tapTimer=null;self._exec(tapAction,e);},350);
        }
      }else{
        if(tapAction)self._exec(tapAction,e);
      }
    };
    el.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){if(tapAction)self._exec(tapAction,e);else{e.preventDefault();}}
    });
    el.addEventListener('touchstart',press,{passive:true});
    el.addEventListener('touchend',function(e){
      cancel();e.stopPropagation();e.preventDefault();
      if(scrolled){scrolled=false;held=false;return;} // finger dragged (page scroll) — not a tap
      onTap(e);
    });
    el.addEventListener('touchmove',function(e){
      cancel();
      if(!scrolled&&e.touches&&e.touches[0]){
        const dx=e.touches[0].clientX-touchX,dy=e.touches[0].clientY-touchY;
        if(dx*dx+dy*dy>100)scrolled=true; // >~10px — a drag/scroll, not finger jitter on a tap
      }
    },{passive:true});
    el.addEventListener('touchcancel',function(){cancel();held=false;});
    el.addEventListener('mousedown',press);
    el.addEventListener('click',function(e){
      cancel();e.stopPropagation();e.preventDefault();onTap(e);
    });
    el.addEventListener('mouseleave',function(){cancel();held=false;});
  }

  _pad(r){
    const ratio=rocRatio(r)||rocRatio('16/9');
    return ratio?((100/ratio).toFixed(4)+'%'):'56.25%';
  }

  _preloadImages(){
    const c=this._config;
    // Collect images from a room (or the flat config) — in multi-room every room
    // has its own base_image, so we must walk rooms[], not just the root.
    const addImgs=function(r,set){
      if(!r)return;
      if(r.base_image)set.add(r.base_image);
      for(const bc of(r.base_image_conditions||[])){if(bc.image)set.add(bc.image);}
      for(const ov of(r.overlays||[])){
        if(ov.image)set.add(ov.image);
        if(ov.state_images)ov.state_images.forEach(function(m){if(m.image)set.add(m.image);});
      }
    };
    // Active room + swipe neighbours load now; the rest of a large multi-room
    // config waits for browser idle time (keeps dashboard load light).
    const now=new Set(),later=new Set();
    if(Array.isArray(c.rooms)&&c.rooms.length){
      const n=c.rooms.length,cur=this._roomIdx;
      c.rooms.forEach(function(r,ri){
        const near=n<=3||ri===cur||ri===(cur+1)%n||ri===(cur-1+n)%n;
        addImgs(r,near?now:later);
      });
    }else addImgs(c,now);
    // Per-image natural aspect cache — every room may use a different image with a
    // different resolution, so lock_aspect:true must detect each one separately.
    this._preloadImgs=[];const _plSelf=this;
    const load=function(url){
      const img=new Image();
      const grab=function(){if(img.naturalWidth&&img.naturalHeight){_plSelf._imgRatios[url]=img.naturalWidth/img.naturalHeight;_plSelf._layoutStage();}};
      img.onload=grab;
      img.src=url;
      if(img.complete)grab(); // already cached → measure synchronously
      _plSelf._preloadImgs.push(img);
    };
    now.forEach(load);
    const laterArr=[...later].filter(function(u){return!now.has(u);});
    if(laterArr.length){
      const idle=window.requestIdleCallback||function(f){setTimeout(f,1500);};
      idle(function(){laterArr.forEach(load);});
    }
  }

  // Design aspect for lock_aspect: true → base image's natural ratio (auto),
  // or an explicit "W/H" / number. null = feature off (default behaviour).
  _designAspect(){
    const la=(this._roomCfg&&this._roomCfg.lock_aspect)??(this._config&&this._config.lock_aspect);
    if(!la)return null;
    if(la===true){const bi=this._roomCfg&&this._roomCfg.base_image;return(bi&&this._imgRatios[bi])||null;}
    return rocRatio(la);
  }

  // Budget-fit for the intrinsic (auto-row) image box: CSS aspect-ratio sizes
  // the wrap from WIDTH alone (height = width/aspect), blind to the card's
  // height budget — on short viewports the grid total exceeds the pinned card,
  // ha-card clips the overflow and bottom-anchored chips vanish below the
  // edge. When the width-derived height doesn't fit the remaining budget
  // (card height minus the other rows), shrink the box to fit the HEIGHT and
  // keep the design aspect — the image letterboxes (side bars) instead of
  // being cropped, and every stage-glued element stays on it. Fits back up
  // automatically when space returns.
  _layoutFitWrap(){
    if(!this.shadowRoot||!this._config)return;
    const c=this._roomCfg||this._config;
    // Viewport-height budget fitting is irrelevant to a mini — it always
    // renders at a fixed reference width/auto height (see _isMini), never in
    // viewport-height mode — and its card/region rects sit inside a scaled
    // thumbnail host, not a real scrolling page, so the budget math here
    // wouldn't mean anything useful for it anyway.
    if(c._roc_ghost||c._roc_mini)return;
    if(this._profile==='portrait'&&((this._config.layout&&this._config.layout.height)||'viewport')==='viewport')return; // natural portrait sizes itself ('fill' pins it — falls through to the fit-check below
    const wrap=this._elWrap();
    if(!wrap||!wrap.style.aspectRatio)return; // only the intrinsic image box
    const region=wrap.parentElement;
    const card=this._elCard();
    if(!region||!card)return;
    const da=parseFloat(wrap.style.aspectRatio)||16/9;
    const cardR=card.getBoundingClientRect();
    const regR=region.getBoundingClientRect();
    if(!(cardR.height>0)||!(regR.width>0))return;
    // Use the INTENDED card height (we own the inline px) rather than the
    // rect — a theme/HA transition can animate the box for ~300ms and a fit
    // computed from a mid-flight rect feeds the next mismeasurement (the
    // v4.6.1 edit-mode "breathing" loop). ha-card also gets transition:none.
    const _ih=parseFloat(card.style.height);
    const cardBottom=cardR.top+((isFinite(_ih)&&_ih>0)?_ih:cardR.height);
    // Height budget: from the region's top edge to the card's bottom, minus
    // rows placed BELOW the image (from the layout definition — geometry of
    // an already-overflowing grid is unreliable). Regions sharing a below-row
    // count once (max per row).
    const lp=this._lp||{place:{}};
    const imgEnd=rocRowEnd(lp.place&&lp.place.image&&lp.place.image.row);
    const belowRows={};
    this.shadowRoot.querySelectorAll('.roc-reg').forEach(el=>{
      const rg=el.dataset.reg;if(rg==='image')return;
      const pl=lp.place&&lp.place[rg];if(!pl)return;
      const st=rocRowStart(pl.row);
      if(st>=imgEnd){const h=el.getBoundingClientRect().height;if(!(belowRows[st]>=h))belowRows[st]=h;}
    });
    let belowH=0;for(const k in belowRows)belowH+=belowRows[k];
    const budget=Math.floor(cardBottom-regR.top-belowH);
    const naturalH=regR.width/da;
    const target=Math.floor(Math.min(naturalH,Math.max(120,budget)));
    if(target>=Math.floor(naturalH)-1){ // fits — restore pure intrinsic sizing
      if(wrap.style.height!=='auto'){wrap.style.height='auto';wrap.style.width='';wrap.style.marginLeft='';wrap.style.marginRight='';this._layoutStage();}
      return;
    }
    const w=Math.min(Math.floor(regR.width),Math.floor(target*da));
    if(wrap.style.height===target+'px'&&wrap.style.width===w+'px')return; // settled
    wrap.style.height=target+'px';
    wrap.style.width=w+'px';
    wrap.style.marginLeft='auto';wrap.style.marginRight='auto'; // centre — side bars show the card background
    this._layoutStage();
  }

  _layoutStage(){
    if(!this.shadowRoot)return;
    const content=this._elContent();
    const wrap=this._elWrap();
    if(!content||!wrap)return;
    const c=this._roomCfg||this._config;if(!c)return;
    if(this._ovActive)return; // overview page: .content is inset:0, no photo stage
    const prof=this._vt||'landscape';
    // Design aspect: lock_aspect wins (explicit / auto from image), else aspect_ratio.
    const da=this._designAspect()||rocRatio(tVal(c.aspect_ratio,prof))||16/9;
    const fit=(tVal(c.image_fit,prof)==='contain')?'contain':'cover';
    const align=tVal(c.image_align,prof)||'center';
    if(wrap.style.aspectRatio){ // intrinsic (auto-row) image box follows the design aspect
      const _as=da.toFixed(4);
      if(wrap.style.aspectRatio!==_as)wrap.style.aspectRatio=_as;
    }
    // offsetWidth/offsetHeight, NOT getBoundingClientRect(): the latter reports
    // the PAINTED (post-transform/zoom) size, which for a scaled-down
    // nav.live:full mini is smaller than the size its own CSS (%, aspect-ratio)
    // actually lays out at — pinning .content from that shrunk rect corrupts
    // every %-positioned child inside it (gauges, badges, icons…). offset*
    // always reports the true CSS layout box, immune to any ancestor visual
    // transform, so this stays correct regardless of how (or whether) a mini
    // is being scaled down for its thumbnail.
    const r={width:wrap.offsetWidth,height:wrap.offsetHeight};
    if(!(r.width>0)||!(r.height>0))return;
    const key=Math.round(r.width)+'x'+Math.round(r.height)+':'+da.toFixed(4)+':'+fit+':'+align;
    if(content.dataset.rocStage===key)return; // unchanged
    const st=(fit==='contain'?containStage:coverStage)(r.width,r.height,da,align);
    if(!st)return;
    content.style.position='absolute';content.style.inset='auto';
    content.style.width=st.w+'px';content.style.height=st.h+'px';
    content.style.left=st.left+'px';content.style.top=st.top+'px';
    content.dataset.rocStage=key;
  }

  // Viewport-mode root height: measure the card's real top offset (header +
  // view padding + safe-area) and pin the height in px; the CSS calc() set at
  // render is only the first-paint fallback. Re-run on window resize.
  // Best-effort: HA appends its own per-card "actions" bar (Edit / Move to
  // view / …) as a REAL sibling after the card while the dashboard is being
  // edited (hui-card-options > ha-card.type-panel > .card-actions), not an
  // overlay — so a card pinned to the exact viewport bottom pushes that bar
  // below the fold. HA marks edit mode with an 'edit-mode' class on an
  // ancestor; walk up to detect it, then measure the actions bar's REAL
  // rendered height (never hardcoded) so we can reserve exactly that much
  // room. This reaches into HA's internal, non-public, version-specific DOM
  // (verified live 2026-07) — any miss/throw just returns 0, i.e. today's
  // behaviour, never a hard failure.
  _editBarHeight(){
    try{
      let node=this,guard=0,inEdit=false;
      while(node&&guard++<12){
        if(node.classList&&node.classList.contains('edit-mode')){inEdit=true;break;}
        node=node.parentElement||(node.getRootNode&&node.getRootNode()&&node.getRootNode().host)||null;
      }
      if(!inEdit)return 0;
      node=this;guard=0;
      while(node&&guard++<12){
        // Current HA: the actions bar lives in hui-card-options' shadowRoot.
        // Reserve = the bar block's OWN height + vertical margins — never a
        // position difference against our card, which would be circular (it
        // measures a layout our own height just changed). Verified live 2026-07.
        if(node.tagName==='HUI-CARD-OPTIONS'&&node.shadowRoot){
          const bar=node.shadowRoot.querySelector('.card-actions');
          if(bar){
            const br=bar.getBoundingClientRect();
            if(br.height>0){
              const bcs=(node.ownerDocument.defaultView||window).getComputedStyle(bar);
              return Math.ceil(br.height+(parseFloat(bcs.marginTop)||0)+(parseFloat(bcs.marginBottom)||0));
            }
          }
        }
        // Legacy HA: hui-card-options > ha-card.type-panel > .card-actions
        const host=node.getRootNode&&node.getRootNode()&&node.getRootNode().host;
        if(host&&host.tagName==='HA-CARD'&&host.shadowRoot){
          const bar=host.shadowRoot.querySelector('.card-actions');
          if(bar){const rr=bar.getBoundingClientRect();if(rr.height>0)return Math.ceil(rr.height);}
        }
        node=node.parentElement||host||null;
      }
    }catch(_){}
    return 0;
  }

  // ---- Root-height pin: trigger inventory --------------------------------
  // Every hook that can ask for a re-pin goes through _requestPin(reason).
  // Direct _layoutRootHeight() calls are reserved for first paint (sync, no
  // flash). The inventory — WHY each hook exists (v5.0 consolidation):
  //   render tail          first paint (direct, sync)
  //   +250ms after render  fonts/images settle — NOT a DOM mutation
  //   _scRo (scroller RO)  header settling, edit toolbars resize the scroller
  //   _bodyRo (body RO)    exotic embeds where the page itself scrolls
  //   window resize        window/profile changes
  //   _pvMo (MO)           edit ENTER/EXIT — hui-panel-view/-card-options
  //                        shadow trees are the ONLY observable truth (no
  //                        event, no resize, no dis/connect — verified live)
  //   _watchEditBar (MO)   actions bar mounting later than the transition
  //   location-changed     HA client-side navigation (view switch, back/fwd)
  //   1s piggyback         last-resort safety on state updates (early-outs)
  //   connectedCallback    HA moved the card (view switch) — full rewire
  // Coalescing: any number of requests inside one task collapse into ONE
  // recalc on the next microtask (background-tab safe — NEVER rAF here).
  _requestPin(reason){
    if(window.ROC_DEBUG)try{console.debug('[roc] pin request:',reason);}catch(_){}
    if(this._pinQueued)return;
    this._pinQueued=true;
    const self=this;
    const mt=typeof queueMicrotask==='function'?queueMicrotask:function(f){Promise.resolve().then(f);};
    mt(function(){
      self._pinQueued=false;
      if(!self._rendered)return;
      try{self._layoutRootHeight();}catch(_){}
    });
  }

  // Cached refs to the three structural nodes the layout engine measures on
  // every pass. _render() sets them directly; these accessors re-resolve if the
  // cached node no longer belongs to the current shadow tree (which is exactly
  // what innerHTML replacement does to it), so they stay correct without any
  // manual invalidation. Before v5.10.0 each layout pass re-queried all three —
  // 11 querySelector calls per ResizeObserver callback, once per frame during
  // a resize drag.
  _elWrap(){const e=this._wrapEl;return(e&&e.getRootNode()===this.shadowRoot)?e:(this._wrapEl=this.shadowRoot?this.shadowRoot.querySelector('.wrap'):null);}
  _elContent(){const e=this._contentEl;return(e&&e.getRootNode()===this.shadowRoot)?e:(this._contentEl=this.shadowRoot?this.shadowRoot.querySelector('.content'):null);}
  _elCard(){const e=this._cardEl;return(e&&e.getRootNode()===this.shadowRoot)?e:(this._cardEl=this.shadowRoot?this.shadowRoot.querySelector('ha-card'):null);}

  // Coalesce a burst of layout requests into one pass. Several observers can
  // fire within the same frame; without this each one ran its own sequence.
  // stageOnly requests (the .wrap box changed, but not the card) upgrade to a
  // full fit if a full request lands in the same microtask — same pattern as
  // _schedule()'s nav-only/full upgrade. Microtask timing matches _requestPin.
  _requestLayout(stageOnly){
    if(!stageOnly)this._layoutFitDirty=true;
    if(this._layoutQueued)return;
    this._layoutQueued=true;
    const self=this;
    const mt=typeof queueMicrotask==='function'?queueMicrotask:function(f){Promise.resolve().then(f);};
    mt(function(){
      self._layoutQueued=false;
      const full=self._layoutFitDirty;self._layoutFitDirty=false;
      if(!self._rendered)return;
      try{if(full)self._layoutFitWrap();self._layoutStage();}catch(_){}
    });
  }

  // Nearest scrollable ancestor across shadow boundaries — HA's view scroller
  // (falls back to documentElement). Cached per instance; HA recreates the
  // card whenever it rebuilds the surrounding DOM (view switch, edit toggle),
  // so a fresh card always re-resolves. _render() also clears the cache.
  _scrollParent(){
    if(this._scrollEl&&this._scrollEl.isConnected)return this._scrollEl;
    let node=this,guard=0;
    while(node&&guard++<40){
      if(node.nodeType===1&&node!==this){
        try{
          const cs=(node.ownerDocument.defaultView||window).getComputedStyle(node);
          const oy=cs.overflowY;
          if((oy==='auto'||oy==='scroll'||oy==='overlay')&&node.clientHeight>0){this._scWasEl=true;return(this._scrollEl=node);}
        }catch(_){}
      }
      node=node.parentElement||(node.getRootNode&&node.getRootNode()&&node.getRootNode().host)||null;
    }
    // Degradation notice: a dashboard that once resolved a real scroller and
    // suddenly doesn't points at an HA internal-DOM change — say so ONCE
    // instead of silently falling back (behaviour still degrades gracefully).
    if(this._scWasEl&&!this._scDegraded){this._scDegraded=true;try{console.debug('[room-overlay-card] scroll container no longer resolves — falling back to documentElement (HA DOM change?)');}catch(_){}}
    return(this._scrollEl=document.documentElement);
  }

  _layoutRootHeight(){
    if(!this.shadowRoot||!this._config)return;
    const c=this._roomCfg||this._config;
    if(c._roc_ghost||c._roc_preview||c._roc_mini||rocIsStubCfg(this._config))return;
    const _lh=(this._config.layout&&this._config.layout.height)||'viewport';
    if(_lh!=='viewport'&&_lh!=='fill')return;
    if(this._profile==='portrait'&&_lh==='viewport'&&!this._ovActive)return; // natural content height — nothing to pin ('fill' pins portrait too; so does an overview page — O9)
    const card=this._elCard();
    if(!card)return;
    const r=this.getBoundingClientRect();
    if(!(r.width>0))return; // display:none / not laid out yet
    // Scroll-INDEPENDENT top offset: distance from the scroller's content top
    // (rect diff + current scrollTop), not from the viewport. The old
    // viewport-relative math bailed whenever the page was scrolled (r.top<0)
    // — and a card pinned too tall causes exactly that scroll, so one bad pin
    // could never self-heal. Container math stays valid scrolled, in edit
    // mode, and while HA's header settles.
    const sc=this._scrollParent();
    const _winSc=sc===document.documentElement||sc===document.body;
    let avail,top;
    // visualViewport (when available) tracks mobile dynamic toolbars that
    // window.innerHeight misses; identical on desktop.
    if(_winSc){avail=(window.visualViewport&&window.visualViewport.height)||window.innerHeight||0;top=r.top+(window.scrollY||0);}
    else{const cr=sc.getBoundingClientRect();avail=sc.clientHeight;top=r.top-cr.top+sc.scrollTop-(sc.clientTop||0);}
    if(!(avail>0))return;
    top=Math.max(0,top);
    // floor (not round): a fraction of a px short never scrolls, a fraction
    // over always does (sub-pixel rounding measured live).
    let h=Math.floor(avail-top)-this._editBarHeight();
    h=Math.max(200,h);
    // Steady-state early out: raw height unchanged, nothing was absorbed last
    // time AND nothing overflows now. An ABSORBED height must NOT early-out on
    // "raw unchanged" alone — the overflow it reacted to may be gone (e.g. it
    // was a transient), and the card would stay stuck short forever.
    const ovPre=_winSc?(document.documentElement.scrollHeight-(window.innerHeight||0)):(sc.scrollHeight-sc.clientHeight);
    if(Math.abs(h-(this._rootHRaw||0))<=1&&this._rootHPx===this._rootHRaw&&ovPre<=1)return;
    this._rootHRaw=h;
    card.style.height=h+'px'; // full (raw) height first, then measure what overflows
    // Residual-overflow absorption: view wrappers add bottom padding (and HA
    // may stack small siblings — e.g. the edit-mode card-actions bar) BELOW
    // the card inside the scroller — invisible to any top-offset math.
    // Measure what actually overflows after pinning and absorb it, capped at
    // 160px so a genuinely tall page (user content below the card) keeps its
    // scrollbar instead of crushing the card. Both writes happen in the same
    // task, so no intermediate paint.
    const ov=_winSc?(document.documentElement.scrollHeight-(window.innerHeight||0)):(sc.scrollHeight-sc.clientHeight);
    if(ov>1&&ov<=160)h=Math.max(200,h-Math.ceil(ov));
    this._rootHPx=h;
    card.dataset.rocH=String(h);
    if(card.style.height!==h+'px')card.style.height=h+'px';
    if(window.ROC_DEBUG)try{console.debug('[roc] pin:',{scroller:sc.tagName+(sc.id?'#'+sc.id:''),winSc:_winSc,avail:avail,top:top,editBar:this._editBarHeight(),raw:this._rootHRaw,pinned:h,absorbed:this._rootHRaw-h});}catch(_){}
    this._layoutFitWrap();
    this._layoutStage();
    // (v5.0) The 300ms "self-heal" re-check that used to live here is gone:
    // it existed for transient rects during HA's edit-mode DOM shuffles,
    // which the _pvMo MutationObserver now catches deterministically.
  }

  // IntersectionObserver — suppress updates while the card is off-screen.
  // Called from _render AND from connectedCallback: an IO whose disconnect()
  // ran is still a perfectly usable object (disconnect only drops the target
  // list), so a reconnect just needs a fresh observe(). Creating it here rather
  // than inline in _render is what makes that possible.
  _wireVisibility(){
    if(typeof IntersectionObserver==='undefined')return; // no IO → _visible stays true forever (see the guard in set hass)
    if(this._io)this._io.disconnect();
    else{
      const self=this;
      this._io=new IntersectionObserver(function(entries){
        self._visible=entries[entries.length-1].isIntersecting;
        if(self._visible&&self._hass&&self._rendered)self._update();
      },{threshold:0});
    }
    this._io.observe(this);
  }

  // 30 s ticker for `format: relative` labels. Idempotent — safe to call from
  // both _render and connectedCallback.
  _wireRelTimer(){
    if(this._relTimer){clearInterval(this._relTimer);this._relTimer=null;}
    if(!this._relNeeded)return;
    const self=this;
    this._relTimer=setInterval(function(){
      if(self._visible&&self._hass&&self._rendered)self._update();
    },30000);
  }

  // All layout observers & listeners in one place — called from _render AND
  // from connectedCallback. HA MOVES the card element when toggling dashboard
  // edit mode (it gets wrapped into / unwrapped from hui-card-options), which
  // fires disconnectedCallback → all observers are disconnected and nulled.
  // The old connectedCallback "re-attach" used `if(this._ro)this._ro.observe()`
  // — dead code after the nulling — so a card that went through an edit-mode
  // toggle had NO layout triggers left and stayed mis-sized until a state
  // update or swipe happened to re-render it. Recreating everything here on
  // every (re)connect is cheap and makes the edit transitions self-correcting.
  _wireLayoutObservers(){
    const self=this;
    // Restricted instances (swipe ghost / editor preview / nav.live:full mini,
    // §3 of NAV_LIVE_FULL_PLAN.md) are never a top-level HA dashboard card — they
    // have no meaningful scroller/body/hui-panel-view relationship of their own
    // (a MutationObserver walk from deep inside a thumbnail resolves the SAME
    // ancestors the OUTER card already watches, so one per mini would just be a
    // duplicate observer on a node someone else already owns). They still get
    // their OWN box + wrap-box resize handling below (image aspect-fit; needed
    // even at thumbnail scale) — only the viewport-pin machinery is skipped.
    const _rc=this._roomCfg||this._config;
    const _restricted=!!(_rc&&(_rc._roc_ghost||_rc._roc_preview||_rc._roc_mini));
    if(window.ResizeObserver){
      if(this._ro)this._ro.disconnect();
      // Coalesced + narrowed (v5.10.0): a geometry event runs the layout pass
      // and _applyResizeStyles(), NOT the full _update() state pass it used to.
      this._ro=new ResizeObserver(function(){if(self._rendered){self._requestLayout();self._applyResizeStyles();}});
      this._ro.observe(this);
      // The image region's height changes independently of the card (grid %),
      // so the cover-stage watches its own box too.
      if(this._wrapRo)this._wrapRo.disconnect();
      const _wEl=this._elWrap();
      if(_wEl){this._wrapRo=new ResizeObserver(function(){if(self._rendered)self._requestLayout(true);});this._wrapRo.observe(_wEl);}
      // Root-height pin (viewport mode): watch the SCROLLER's own box. HA
      // keeps document.body at a fixed height (the app scrolls inside), so a
      // body observer misses header settling and edit-mode toolbars entirely
      // — but both change the scroll container's box, which this catches.
      // body stays observed too as a fallback for exotic embeds where the
      // page itself scrolls. Restricted instances never pin a viewport height
      // (_layoutRootHeight already no-ops for them) — skip creating these.
      if(this._scRo){this._scRo.disconnect();this._scRo=null;}
      if(this._bodyRo){this._bodyRo.disconnect();this._bodyRo=null;}
      if(!_restricted){
        this._scrollEl=null; // re-resolve on every (re)wire (edit toggle rebuilds HA's DOM)
        const _scEl=this._scrollParent();
        if(_scEl&&_scEl.nodeType===1){
          this._scRo=new ResizeObserver(function(){self._requestPin('scroller-resize');});
          this._scRo.observe(_scEl);
        }
        if(document.body){
          this._bodyRo=new ResizeObserver(function(){self._requestPin('body-resize');});
          this._bodyRo.observe(document.body);
        }
      }
    }
    if(!this._winHandler){this._winHandler=this._onWinResize.bind(this);window.addEventListener('resize',this._winHandler);}
    // 'location-changed' catches HA client-side navigations (view switches,
    // back/forward). Verified live: the edit-mode toggle does NOT fire it and
    // does NOT move the card element either (no dis/connect) — it only
    // rebuilds hui-panel-view's shadow tree around us. So this listener is a
    // helper for navigations, while the panel-view MutationObserver below is
    // THE deterministic edit ENTER/EXIT hook. Double-rAF lets HA finish its
    // DOM shuffle before measuring. Restricted instances are never themselves
    // navigated to/from — skip.
    if(this._locHandler){window.removeEventListener('location-changed',this._locHandler);window.removeEventListener('popstate',this._locHandler);this._locHandler=null;}
    if(!_restricted&&!this._locHandler){
      // setTimeout(0), NOT rAF — rAF never fires in background tabs (kiosk
      // dashboards!) or during HA view transitions; a 0-delay task runs the
      // moment the current work (HA's navigation handling) is done.
      this._locHandler=function(){setTimeout(function(){
        if(!self._rendered)return;
        self._requestPin('location-changed');
        self._watchEditBar();
      },0);};
      window.addEventListener('location-changed',this._locHandler);
      window.addEventListener('popstate',this._locHandler);
    }
    // Edit ENTER/EXIT: watch the trees that HA actually mutates. Verified
    // live: the toggle fires NO window event and does NOT even dis/connect
    // the card element (HA moves it atomically) — the only observable truth
    // is the DOM around us: hui-panel-view's shadow tree gains/loses the
    // hui-card-options wrapper, and the actions bar mounts inside
    // hui-card-options' OWN shadowRoot (a separate tree). Watch both; after
    // a structural change re-adopt the (possibly new) wrapper's shadow.
    // Neither tree ever contains our own DOM (that lives in OUR shadow root,
    // and slotted light content stays in the light tree), so these observers
    // are silent except on real HA transitions. No polling, no timers.
    // Restricted instances skip this entirely — see note at the top of this
    // method: the ancestor walk from deep inside a nested instance resolves
    // the OUTER card's own hui-panel-view, which the outer card already
    // watches — a restricted instance adding its own observer on the same
    // node would be pure duplication, not a second real hook.
    if(this._pvMo){this._pvMo.disconnect();this._pvMo=null;}
    if(!_restricted&&window.MutationObserver){
      let _pv=null,_opts=null,_n=this,_g=0;
      while(_n&&_g++<12){
        const _tg=_n.tagName;
        if(_tg==='HUI-CARD-OPTIONS')_opts=_n;
        if(_tg==='HUI-PANEL-VIEW'||_tg==='HUI-VIEW'){_pv=_n;break;}
        _n=_n.parentElement||(_n.getRootNode&&_n.getRootNode()&&_n.getRootNode().host)||null;
      }
      if(!_pv&&this._pvWasFound&&!this._pvDegraded){this._pvDegraded=true;try{console.debug('[room-overlay-card] hui-panel-view/hui-view ancestor no longer resolves — edit-mode transition observer inactive (HA DOM change?)');}catch(_){}}
      if(_pv){
        this._pvWasFound=true;
        // SYNCHRONOUS handler — deliberately no requestAnimationFrame:
        // MutationObserver callbacks already run AFTER the mutating task
        // finished (the DOM is settled), and rAF never fires in background
        // tabs / during HA view transitions (verified live: the queued rAF
        // pin silently never ran). The pin early-outs when nothing changed.
        const mo=this._pvMo=new MutationObserver(function(){
          if(!self._rendered)return;
          self._requestPin('edit-transition');
          // the structure may have brought a NEW hui-card-options — adopt
          // its shadowRoot too (the actions bar mounts there, a separate
          // tree; re-observing an observed target is a cheap no-op)
          let o=null,m=self,gg=0;
          while(m&&gg++<12){if(m.tagName==='HUI-CARD-OPTIONS'){o=m;break;}m=m.parentElement||(m.getRootNode&&m.getRootNode()&&m.getRootNode().host)||null;}
          if(o&&o.shadowRoot)try{mo.observe(o.shadowRoot,{childList:true,subtree:true});}catch(_){}
        });
        if(_pv.shadowRoot)mo.observe(_pv.shadowRoot,{childList:true,subtree:true});
        mo.observe(_pv,{childList:true});
        if(_opts&&_opts.shadowRoot)mo.observe(_opts.shadowRoot,{childList:true,subtree:true});
      }
    }
  }

  // One-shot MutationObserver: on edit ENTER the hui-card-options actions bar
  // can mount AFTER our re-pin measured (editBar=0). Watch the wrapper's
  // shadowRoot until '.card-actions' exists, re-pin, disconnect. Event-driven,
  // self-terminating — no timers.
  _watchEditBar(){
    if(this._barMo){this._barMo.disconnect();this._barMo=null;}
    let node=this,guard=0,opts=null;
    while(node&&guard++<12){
      if(node.tagName==='HUI-CARD-OPTIONS'){opts=node;break;}
      node=node.parentElement||(node.getRootNode&&node.getRootNode()&&node.getRootNode().host)||null;
    }
    if(!opts||!opts.shadowRoot)return;
    if(opts.shadowRoot.querySelector('.card-actions'))return; // already there — measured by the caller
    const self=this;
    this._barMo=new MutationObserver(function(){
      if(opts.shadowRoot.querySelector('.card-actions')){
        self._barMo.disconnect();self._barMo=null;
        self._requestPin('edit-bar-mounted');
      }
    });
    this._barMo.observe(opts.shadowRoot,{childList:true,subtree:true});
  }

  // Viewport the layout profile is chosen from. The studio canvas (v6.41.0) renders the card in
  // a device frame and sets _rocVp to that frame's size; everywhere else it is the window.
  _vpW(){return this._rocVp?this._rocVp.w:(window.innerWidth||0);}
  _vpH(){return this._rocVp?this._rocVp.h:(window.innerHeight||0);}
  // Edit-mode position/draw changes leave the card here: to the studio when it hosts this card
  // (_rocSink), otherwise as the window event the HA editor relays to Home Assistant.
  _posOut(cfg){
    if(typeof this._rocSink==='function'){try{this._rocSink(cfg);}catch(e){console.warn('[room-overlay-card] studio update failed:',e);}return;}
    window.dispatchEvent(new CustomEvent('roc-pos-update',{detail:{config:cfg}}));
  }

  _onWinResize(){
    if(!this._config||!this._rendered)return;
    let p=rocProfile(this._config,this._vpW(),this._vpH());
    const c=this._roomCfg||this._config;
    if((c.test_mode??false)&&this._profFlipped)p=(p==='portrait')?'landscape':'portrait';
    if(p!==this._profile){this._rendered=false;this._render();return;}
    this._requestPin('window-resize');this._requestLayout();this._applyResizeStyles();
  }

  // Collected sections, cached by config object identity — _render() runs
  // on every room switch (see _switchRoom) but the collection only needs to
  // change when setConfig() actually assigns a new config.
  _getSections(cAll){
    if(this._secCfgRef===cAll)return this._secCache;
    this._secCfgRef=cAll;
    this._secCache=rocCollectSections(cAll);
    return this._secCache;
  }

  // ----- Cockpit sections: open/close + live tile state (v6.8.0) -----------
  // One panel open at a time (COCKPIT_PLAN.md D7); closing the view (room
  // switch) closes it too — see _switchRoom.
  _openSection(id){
    const secs=this._getSections(this._config);
    if(!secs.some(function(sx){return sx.def.id===id;}))return;
    if(this._secVisMap&&this._secVisMap[id]===false)return; // visible_template says hidden
    // remember what opened it (a launcher icon / tile) to hand focus back on close
    if(!this._sectionOpen){try{this._secReturnFocus=this.shadowRoot&&this.shadowRoot.activeElement||null;}catch(_){this._secReturnFocus=null;}}
    this._sectionOpen=id;
    this._applySectionOpenState();
    if(!this._secKeyHandler){
      const self=this;
      this._secKeyHandler=function(e){if(e.key==='Escape'&&self._sectionOpen)self._closeSection();};
      document.addEventListener('keydown',this._secKeyHandler);
    }
    const pEl=this._secPanelEls&&this._secPanelEls[id];
    if(pEl){const btn=pEl.querySelector('.roc-panel-close');if(btn)try{btn.focus();}catch(_){}}
    this._updateSectionTiles();
  }
  // The section an icon / zone under (x, y) opens with its tap_action, if any.
  _sectionLauncherAt(x,y){
    const sr=this.shadowRoot;
    if(!sr||typeof sr.elementsFromPoint!=='function')return null;
    const c=this._roomCfg||this._config||{};
    let els=[];try{els=sr.elementsFromPoint(x,y)||[];}catch(_){return null;}
    for(const el of els){
      const hit=el&&el.closest?el.closest('[data-ico],[data-z]'):null;
      if(!hit)continue;
      const item=hit.hasAttribute('data-ico')?(c.icons||[]).find(function(i){return i.id===hit.getAttribute('data-ico');}):(c.zones||[]).find(function(z){return z.id===hit.getAttribute('data-z');});
      const a=item&&item.tap_action?this._resolveAct(item.tap_action):null;
      if(a&&a.action==='open-section'&&a.section)return a.section;
    }
    return null;
  }
  _closeSection(){
    if(!this._sectionOpen)return;
    this._sectionOpen=null;
    this._applySectionOpenState();
    if(this._secKeyHandler){document.removeEventListener('keydown',this._secKeyHandler);this._secKeyHandler=null;}
    const rf=this._secReturnFocus;this._secReturnFocus=null;
    if(rf&&rf.isConnected&&typeof rf.focus==='function')try{rf.focus();}catch(_){}
  }
  _applySectionOpenState(){
    if(this._secPanelEls)for(const id in this._secPanelEls){
      const pEl=this._secPanelEls[id];if(pEl)pEl.classList.toggle('open',id===this._sectionOpen);
    }
    const backdropEl=this.shadowRoot&&this.shadowRoot.querySelector('[data-section-backdrop]');
    if(backdropEl)backdropEl.classList.toggle('open',!!this._sectionOpen);
  }
  // Patches live entity-derived tile content (state/value default, progress,
  // unavailable, active-state icon animation, header badge). Gated on a panel
  // actually being open — collection + skeleton already happened in _render(),
  // this only runs per hass tick while a user is looking at it (COCKPIT_PLAN.md
  // kap.4: "the panel body is built once per open, not per state tick").
  // `state`/`value` given as a `{{ }}` template are owned by the template
  // subscription in _setupTemplates() instead — left untouched here.
  _updateSectionTiles(){
    if(!this._sectionOpen||!this._hass)return;
    const id=this._sectionOpen;
    const sx=this._getSections(this._config).find(function(x){return x.def.id===id;});
    if(!sx)return;
    const s=this._hass.states;
    const self=this;
    const tileEls=(this._secTileEls&&this._secTileEls[id])||[];
    const tiles=(this._secResolvedTiles&&this._secResolvedTiles[id])||sx.tiles;
    let activeCount=0;
    tiles.forEach(function(entry,idx){
      const tileEl=tileEls[idx];if(!tileEl)return;
      const td=rocTileDef(entry);
      const st=td.entity?s[td.entity]:undefined;
      const known=!td.entity||!!st;
      tileEl.classList.toggle('unavailable',!known);
      const stateStr=st?st.state:'';
      const isActive=rocTileActive(td,st);
      if(isActive)activeCount++;
      tileEl.classList.toggle('is-active',isActive);
      const iconEl=tileEl.querySelector('[data-tile-icon]');
      if(iconEl){
        const anim=td.icon_animation;
        const animOn=anim&&anim!=='none'&&(td.active_state===undefined||isActive);
        iconEl.className='roc-tile-icon'+(animOn?(anim==='spin'?' tia-spin':anim==='pulse'?' tia-pulse':anim==='blink'?' tia-blink':''):'');
      }
      const isTpl=function(v){return typeof v==='string'&&v.indexOf('{{')>=0;};
      const stateEl=tileEl.querySelector('[data-tile-state]');
      if(stateEl&&!isTpl(td.state)){
        // v6.16.0: HA's own formatted state (translated, device-class aware)
        // instead of the raw machine string.
        const txt=td.state!==undefined?td.state:(st?rocFmtState(self._hass,st,{}):(td.entity?'—':''));
        let cls='roc-tile-state';
        // auto: only a RUNNING tile is coloured. Every other state stays
        // neutral — before v6.16.0 any non-active state was painted green
        // ("done"), so idle machines looked like good news. `state_class:
        // done` is still available explicitly.
        const sc=td.state_class===undefined||td.state_class==='auto'
          ?(isActive?'run':'')
          :td.state_class;
        if(sc==='run')cls+=' ts-run';else if(sc==='done')cls+=' ts-done';
        stateEl.className=cls;
        if(stateEl.textContent!==txt)stateEl.textContent=txt||'';
      }
      const valEl=tileEl.querySelector('[data-tile-value]');
      if(valEl&&!isTpl(td.value)){
        const v=td.value!==undefined?td.value:'';
        if(valEl.textContent!==v)valEl.textContent=v;
      }
      if(td.progress){
        const pEl=tileEl.querySelector('[data-tile-progress]');
        if(pEl){
          const pst=s[td.progress];
          const pv=pst?rocNumVal(pst.state):NaN;
          pEl.style.width=(isNaN(pv)?0:Math.max(0,Math.min(100,pv)))+'%';
          // v6.16.0: a tile with active_state shows its progress bar only
          // while it runs (an idle oven no longer shows a full blue bar);
          // `progress_always: true` keeps the old always-on bar.
          const pWrap=pEl.parentNode;
          if(pWrap)setSt(pWrap,'display',(td.active_state===undefined||td.progress_always||isActive)?'':'none');
        }
      }
      // Image tile overlays (v6.9.0, D3 scheme b) -- exactly the room overlay's
      // own condition/transform resolvers (resolveVal/tfResolve/_ovImg),
      // applied to the tile's own tiny stage. Not per global state tick: this
      // whole method already only runs while the panel is open.
      if(td.image&&Array.isArray(td.overlays)&&td.overlays.length){
        const ovEls=tileEl.querySelectorAll('.roc-tile-ov');
        td.overlays.forEach(function(ov,oi){
          const el=ovEls[oi];if(!el)return;
          const img=self._ovImg(ov);
          if(img){const bg="url('"+escUrl(img)+"')";if(el.style.backgroundImage!==bg)el.style.backgroundImage=bg;}
          const rawOp=(ov.conditions&&ov.conditions.opacity)?Number(resolveVal(ov.conditions.opacity,s,0)):1;
          if(rawOp>0&&ov.animation){el.style.animation='roc-'+ov.animation+' '+(ov.animation==='blink'?'1s step-end':'2s ease-in-out')+' infinite';el.style.opacity='';}
          else{el.style.animation='none';setSt(el,'opacity',String(rawOp));}
          const ovF=(ov.conditions&&ov.conditions.filter)?resolveVal(ov.conditions.filter,s,'none'):'none';
          setSt(el,'filter',ovF);
          if(ov.transform){
            const tfr=tfResolve(ov.transform,ov.transform.entity?s[ov.transform.entity]:null);
            if(tfr){
              setSt(el,'transform',tfr.transform||'');
              if(ov.transform.spin)setSt(el,'animation',tfr.animation==='none'?'none':tfr.animation);
            }
          }
        });
      }
    });
    const badgeEl=this._secBadgeEls&&this._secBadgeEls[id];
    if(badgeEl){
      const mode=sx.def.badge===undefined?'auto':sx.def.badge;
      const txt=mode==='none'?'':(activeCount>0?String(activeCount):'');
      if(badgeEl.textContent!==txt)badgeEl.textContent=txt;
    }
  }
  // `card:` source (D12: embed only, never render through) — same
  // getHelpers()/createCardElement path `elements` already uses, with the
  // direct-create fallback, and a legible notice if the custom element never
  // registered instead of a silently blank panel (kap.6 degradation rules).
  _mountSectionCards(secList,gen){
    this._secCardEls={};
    const self=this;
    for(const sx of secList){
      const d=sx.def;
      if(!d.card)continue;
      const host=this.shadowRoot.querySelector('[data-section-card="'+escSel(d.id)+'"]');
      if(!host)continue;
      const type=d.card.type;
      const tag=type&&type.indexOf('custom:')===0?type.slice(7):null;
      if(tag&&!customElements.get(tag)){
        host.innerHTML='<div class="roc-panel-notice">Card <code>'+escA(type)+'</code> is not registered — is it installed?</div>';
        continue;
      }
      const secId=d.id;
      const wrap=makeHACard(d.card,function(cardEl){
        if(self._renderGen!==gen)return; // stale render
        self._secCardEls[secId]=cardEl;
        if(self._hass)try{cardEl.hass=self._hass;}catch(_){}
      });
      if(wrap)host.appendChild(wrap);
    }
  }


  // ----- Overview page (v6.30.0, OVERVIEW_PLAN.md) ---------------------------
  // One live-mini instance for room `ri`, mounted into `host` at a fixed
  // reference width. Shared by the nav strip (nav.live: full/custom) and the
  // overview grid's card tiles — one implementation (OVERVIEW_PLAN.md 1a.4).
  _mountMini(host,ri,wRef){
    const cAll=this._config,r=cAll.rooms&&cAll.rooms[ri];
    try{
      const mc=document.createElement('room-overlay-card');
      // Scaled down with transform:scale() to fit the thumbnail. transform
      // is paint-only — it never affects offsetWidth/offsetHeight, which is
      // exactly what _layoutStage() now measures with (see its comment) —
      // so nothing inside the mini ever sees a shrunk box to mis-size
      // itself against, regardless of the applied scale.
      mc.style.cssText='display:block;position:absolute;top:0;left:0;width:'+wRef+'px;transform-origin:top left;';
      // Connect to the document BEFORE setConfig/hass: several layout
      // reads happen synchronously on the first render/update pass
      // (_layoutFitWrap/_layoutStage, and — the one that actually bit a
      // live day_night blind — the gauge fill's el.offsetHeight slat
      // measurement). offsetHeight/getBoundingClientRect always read 0
      // on a still-disconnected element, so day_night's `if(_perDN>0)`
      // guard silently skipped setting any fill at all on first paint.
      // A later IntersectionObserver-triggered _update() can self-heal
      // plain percentage-fill gauges, but there's no reason to rely on
      // that race at all — just connect first.
      host.appendChild(mc);
      mc.setConfig(rocBuildMiniConfig(cAll,ri));
      mc._roomIdx=ri;
      if(this._hass)try{mc.hass=this._hass;}catch(_){}
      return{el:mc,host:host,widthRef:wRef};
    }catch(e){console.warn('[room-overlay-card] nav.live mini mount failed for room '+((r&&r.id)||ri)+':',e);return null;}
  }

  // One info chip (nav.chips / a room's chips:) into `chipCont` — the nav
  // thumbnail's own builder, also used by overview tiles (O11). Registered in
  // _navChipEls, so _updateNav() formats it with the shared value formatter.
  _navChipInto(chipCont,chCfg,r){
    const span=document.createElement('span');
    // Optional pill styling per chip
    let _cs='pointer-events:none;';
    if(chCfg.background)_cs+='background:'+chCfg.background+';';
    if(chCfg.border_radius)_cs+='border-radius:'+chCfg.border_radius+';';
    if(chCfg.padding)_cs+='padding:'+chCfg.padding+';';
    if(chCfg.font_size)_cs+='font-size:'+chCfg.font_size+';';
    if(chCfg.border)_cs+='border:'+chCfg.border+';';
    span.style.cssText=_cs;
    span.className='roc-navchip'; // v6.16.0 default pill (token colours); any inline chip style above still wins
    chipCont.appendChild(span);
    this._navChipEls.push({el:span,cfg:chCfg,entity:String(chCfg.entity||'').replace(/\{room\}/g,r.id||'')});
  }

  // Thumbnail painting for nav.live off/composite — filter (brightness model,
  // filter_conditions) and, for composite, the stacked active overlay images.
  // Shared by nav thumbnails and overview tiles; `mode` is that strip's live tier.
  _paintThumb(tEl,r,ri,mode){
    const s=this._hass.states;
    const _live=mode==='composite'; // composite draws its own base+overlay stack on tEl, filtered here
    const _liveReal=mode==='full'||mode==='custom'; // real mounted mini instances — they
    // apply their own brightness_model/filter_conditions internally (same code path as the main card);
    // a CSS filter set on the WRAPPER (tEl) would stack on top of the mini's own already-correct
    // per-layer filter, double-exposing/double-dimming it. So the wrapper must stay filter-free here.
    let tf='';
    if(!_liveReal){
      if(_live){const bf=bmFilter(r.brightness_model,s,this._navBmSorted[ri]);if(bf&&bf!=='none')tf=bf;}
      if(!tf&&r.filter_conditions?.length){const f=resolveFilter(r.filter_conditions,s);if(f&&f!=='none')tf=f;}
    }
    setSt(tEl,'filter',tf);
    if(!_live)return;
    // Conditional base image (mirror of the main card's logic)
    let base=r.base_image||'';
    if(r.base_image_conditions?.length&&!r.base_camera){
      for(const bc of r.base_image_conditions){
        if(bc.condition===undefined){if(bc.image)base=bc.image;continue;}
        if(evalCond(bc.condition,s)){if(bc.image)base=bc.image;break;}
      }
    }
    // Active overlays, top-most first (CSS: first background layer is on top)
    const stack=[];
    (r.overlays||[]).forEach((ov,oi)=>{
      if(ov.group||ov.visible_template!==undefined)return;
      const op=ov.conditions?.opacity?Number(resolveVal(ov.conditions.opacity,s,0)):1;
      if(!(op>0))return;
      const img=this._ovImg(ov);
      if(img)stack.push({img:img,z:ov.z_index??oi+1});
    });
    stack.sort(function(a,b){return a.z-b.z;});stack.reverse();
    // v6.25.0: HQ-resampled copies sized to the thumb (measured once per thumb element)
    if(!tEl._rocHqBox&&tEl.offsetWidth){const _d=window.devicePixelRatio||1;tEl._rocHqBox={w:tEl.offsetWidth*_d,h:tEl.offsetHeight*_d};}
    const _hb=tEl._rocHqBox,_self=this;
    const _hqT=function(u){return _hb?rocHqUrl(u,_hb.w,_hb.h,function(){clearTimeout(_self._hqNavT);_self._hqNavT=setTimeout(function(){if(_self.isConnected)_self._updateNav();},60);}):u;};
    const bgs=stack.map(function(o){return'url(\''+escUrl(_hqT(o.img))+'\')';});
    if(base)bgs.push('url(\''+escUrl(_hqT(base))+'\')');
    const bgStr=bgs.join(',');
    if(tEl._rocBg!==bgStr){tEl._rocBg=bgStr;tEl.style.backgroundImage=bgStr;}
  }

  // Overview markup for the active profile. Returns {html, meta}; meta drives
  // _ovWire() (mounting, listeners) and the dock's synthetic launcher icons.
  _ovBuild(cAll,ov,prof){
    const self=this,hass=this._hass;
    const P=function(v,d){return rocOvPV(v,prof,d);};
    const g=ov.grid||{};
    const style=P(g.style,'card')==='row'?'row':'card';
    const live=rocOvLive(cAll,ov,style);
    const cols=style==='row'?1:Math.max(1,Math.min(12,parseInt(P(g.columns,prof==='portrait'?2:3),10)||1));
    const chipsMax=P(g.chips_max,prof==='portrait'?3:4);
    const showInfo=g.info!==false;
    const namesOn=g.names!==false; // v6.31.0: grid.names: false hides every tile's name; overview_tile.show_name overrides per room
    const meta={prof:prof,style:style,live:live,tiles:[],pills:[],cards:[],dockIcons:[]};
    const show=function(media){
      if(!media||media==='all')return true;
      if(media==='mobile'||media==='portrait')return prof==='portrait';
      if(media==='desktop'||media==='landscape')return prof==='landscape';
      return String(media).split(',').map(function(x){return x.trim();}).indexOf(prof)>=0;
    };
    // --- header ---
    let hdHtml='';
    const hd=ov.header;
    if(hd&&typeof hd==='object'){
      const fixedH=hd.height&&hd.height!=='auto';
      let inner='';
      (Array.isArray(hd.items)?hd.items:[]).forEach(function(it,i){
        const k=rocOvHdKind(it);
        if(!k||(it.media&&!show(it.media)))return;
        const w=it.width;
        const hcss=fixedH?'height:100%;':'';
        if(k==='pill'){
          const p=it.pill||{};
          const tap=p.tap_action!==undefined?p.tap_action:(p.entity?{action:'more-info',entity:p.entity}:null);
          const hold=p.hold_action!==undefined?p.hold_action:null;
          inner+='<div class="roc-ovp" data-ovp="'+i+'"'+(tap||hold?' data-tap tabindex="0" role="button"':'')+' style="'+(w?'flex:none;width:'+escA(w)+';':'flex:none;')+(p.color?'color:'+escA(p.color)+';':'')+'">'
            +(p.icon?'<ha-icon icon="'+escA(p.icon)+'"></ha-icon>':'')+'<span data-ovp-v>'+escA(p.text!=null?p.text:'')+'</span></div>';
          meta.pills.push({i:i,def:p,tap:tap,hold:hold});
        }else if(k==='nav_cards'){
          ((cAll.nav&&cAll.nav.cards)||[]).forEach(function(cc,ci){
            const cfg=cc&&cc.card?cc.card:cc;
            if(!cfg||!cfg.type)return;
            const cw=(cc&&cc.width)||w;
            inner+='<div class="roc-ov-hdi'+(cw?'':' roc-ov-grow')+'" data-ovc-card="hd'+i+'_'+ci+'" style="'+(cw?'flex:none;width:'+escA(cw)+';':'')+hcss+'"></div>';
            meta.cards.push({key:'hd'+i+'_'+ci,cfg:cfg});
          });
        }else{
          let cfg=it.card;
          if(!cfg){cfg=Object.assign({},it);delete cfg.width;delete cfg.media;}
          if(!cfg||!cfg.type)return;
          inner+='<div class="roc-ov-hdi'+(w?'':' roc-ov-grow')+'" data-ovc-card="hd'+i+'" style="'+(w?'flex:none;width:'+escA(w)+';':'')+hcss+'"></div>';
          meta.cards.push({key:'hd'+i,cfg:cfg});
        }
      });
      if(inner)hdHtml='<div class="roc-ov-hd" style="'+(fixedH?'height:'+escA(hd.height)+';':'')+'">'+inner+'</div>';
    }
    // --- left / right card columns ---
    const side=function(key,area){
      const sd=ov[key];
      if(!sd||typeof sd!=='object')return null;
      const pp=prof==='portrait'?(sd.portrait||'top'):'';
      if(pp==='hidden')return null;
      let inner='';
      (Array.isArray(sd.cards)?sd.cards:[]).forEach(function(cc,ci){
        if(!show(cc&&cc.media))return;
        const cfg=cc&&cc.card?cc.card:cc;
        if(!cfg||!cfg.type)return;
        inner+='<div data-ovc-card="'+key+ci+'" style="'+(cc&&cc.height?'height:'+escA(cc.height)+';':'')+'"></div>';
        meta.cards.push({key:key+ci,cfg:cfg});
      });
      if(!inner)return null;
      return{html:'<div class="roc-ov-side roc-ov-'+key+'" style="grid-area:'+area+';">'+inner+'</div>',width:sd.width||'28%',pp:pp};
    };
    const L=side('left','lt'),R=side('right','rt');
    // --- room grid ---
    const rooms=rocOvRooms(cAll,ov);
    const real=live==='full'||live==='custom';
    let tilesHtml='';
    rooms.forEach(function(ri){
      const r=cAll.rooms[ri];
      const t=r.overview_tile||{};
      const name=t.name||r.name||r.id||('Room '+(ri+1));
      const f=rocOvFocus(t.focus);
      const chips=rocOvChips(cAll,ri,chipsMax);
      const base=roomMerge(cAll,ri).base_image||'';
      const phStyle='--roc-ov-focus:'+Math.round(f.x*100)+'% '+Math.round(f.y*100)+'%;'+((real||live==='composite'||!base)?'':'background-image:url(\''+escA(escUrl(base))+'\');');
      const chipsHtml=chips.map(function(ch,k){
        const ic=rocOvChipIcon(ch,hass);
        return'<button type="button" class="roc-ovc" data-ovchip="'+ri+':'+k+'" aria-pressed="false" aria-label="'+escA(ch.name||ch.entities[0]||ic)+'"><ha-icon icon="'+escA(ic)+'"></ha-icon></button>';
      }).join('');
      tilesHtml+='<div class="roc-ovt roc-ovt-'+style+'" data-ovt="'+ri+'" tabindex="0" role="button" aria-label="'+escA(name)+'">'
        +'<div class="roc-ovt-ph" data-ovt-ph="'+ri+'" style="'+phStyle+'">'+(real?'<div class="roc-ovt-mini" data-ovt-mini="'+ri+'"></div>':'')+'</div>'
        +'<div class="roc-ovt-top">'+((t.show_name!==undefined?t.show_name!==false:namesOn)?'<div class="roc-ovt-name">'+escA(name)+'</div>':'<span></span>')+(showInfo?'<div class="roc-ovt-info" data-ovt-info="'+ri+'"></div>':'')+'</div>'
        +(chipsHtml?'<div class="roc-ovt-chips">'+chipsHtml+'</div>':'')
        +'</div>';
      meta.tiles.push({ri:ri,chips:chips,focus:f,real:real});
    });
    if(!rooms.length)tilesHtml='<div class="roc-ov-empty">Rooms appear here — add a room in Rooms &amp; menu.</div>';
    const fill=prof==='landscape'&&style==='card'&&g.fill!==false;
    const gridHtml='<div class="roc-ov-grid'+(fill?' roc-ov-fill':'')+'" data-ov-grid style="--roc-ov-cols:'+cols+';'+(g.gap?'gap:'+escA(g.gap)+';':'')+(g.min_height?'--roc-ov-minh:'+escA(g.min_height)+';':'')+(g.aspect_ratio?'--roc-ov-aspect:'+escA(g.aspect_ratio)+';':'')+'">'+tilesHtml+'</div>';
    // --- dock: one launcher per section, rendered by the icon pipeline ---
    let dockHtml='';
    const dk=ov.dock;
    if(dk&&typeof dk==='object'){
      const all=this._getSections(cAll).map(function(sx){return sx.def;});
      const list=Array.isArray(dk.sections)?dk.sections.map(function(id){return all.find(function(d){return d.id===id;});}).filter(Boolean):all;
      const isz=dk.size||'24px';
      list.forEach(function(d){
        const id='__ovdock_'+d.id,ic=d.icon||'mdi:view-dashboard',ttl=d.title||d.id;
        meta.dockIcons.push({id:id,icon:ic,size:isz,chip:true,tap_action:{action:'open-section',section:d.id},_ovDock:true});
        dockHtml+='<div class="ico ico-chip" data-ico="'+escA(id)+'" tabindex="0" role="button" aria-label="'+escA(ttl)+'" title="'+escA(ttl)+'" style="position:relative;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;border-radius:50%;padding:9px;box-sizing:content-box;">'
          +'<ha-icon data-icoicon="'+escA(id)+'" icon="'+escA(ic)+'" style="--mdc-icon-size:'+escA(isz)+';width:'+escA(isz)+';height:'+escA(isz)+';display:flex;color:var(--roc-icon-color,#fff);pointer-events:none;position:relative;z-index:2;"></ha-icon>'
          +'<span class="ico-ring" data-ico-ring></span><span class="ico-badge" data-ico-badge></span></div>';
      });
      if(dockHtml)dockHtml='<div class="roc-ov-dock">'+dockHtml+'</div>';
    }
    // --- region grid (OVERVIEW_PLAN.md §3): absent regions get no track ---
    const areas=[],cols2=[],rows=[];
    if(prof==='landscape'){
      const mid=[];
      if(L){mid.push('lt');cols2.push(escA(L.width));}
      mid.push('gr');cols2.push('minmax(0,1fr)');
      if(R){mid.push('rt');cols2.push(escA(R.width));}
      const span=function(a){return mid.map(function(){return a;}).join(' ');};
      if(hdHtml){areas.push(span('hd'));rows.push('auto');}
      areas.push(mid.join(' '));rows.push('minmax(0,1fr)');
      if(dockHtml){areas.push(span('dk'));rows.push('auto');}
    }else{
      cols2.push('minmax(0,1fr)');
      if(hdHtml){areas.push('hd');rows.push('auto');}
      if(L&&L.pp==='top'){areas.push('lt');rows.push('auto');}
      if(R&&R.pp==='top'){areas.push('rt');rows.push('auto');}
      areas.push('gr');rows.push('minmax(0,1fr)');
      if(L&&L.pp==='bottom'){areas.push('lt');rows.push('auto');}
      if(R&&R.pp==='bottom'){areas.push('rt');rows.push('auto');}
      if(dockHtml){areas.push('dk');rows.push('auto');}
    }
    const html='<div class="roc-ov roc-ov-'+style+(prof==='portrait'?' roc-ov-pm':'')+'" data-ov-root style="grid-template-areas:'+areas.map(function(a){return'\''+a+'\'';}).join(' ')+';grid-template-columns:'+cols2.join(' ')+';grid-template-rows:'+rows.join(' ')+';'+(ov.gap?'--roc-ov-gap:'+escA(ov.gap)+';':'')+(ov.padding!==undefined?'--roc-ov-pad:'+escA(ov.padding)+';':'')+'">'
      +hdHtml+(L?L.html:'')+gridHtml+(R?R.html:'')+dockHtml+'</div>';
    return{html:html,meta:meta};
  }

  // Mount cards / minis and wire listeners for the markup _ovBuild() produced.
  _ovWire(meta,gen){
    const self=this,sr=this.shadowRoot,cAll=this._config;
    this._ovTiles=[];this._ovPills=[];this._ovCardEls=[];this._ovThumbs=[];this._ovMiniEls={};
    if(this._ovMiniRo){this._ovMiniRo.disconnect();this._ovMiniRo=null;}
    meta.cards.forEach(function(m){
      const host=sr.querySelector('[data-ovc-card="'+m.key+'"]');if(!host)return;
      const w=makeHACard(m.cfg,function(el){
        if(self._renderGen!==gen)return; // a newer render replaced this DOM
        self._ovCardEls.push(el);
        if(self._hass)try{el.hass=self._hass;}catch(_){}
      });
      if(w)host.appendChild(w);
    });
    meta.pills.forEach(function(p){
      const el=sr.querySelector('[data-ovp="'+p.i+'"]');if(!el)return;
      self._ovPills.push({el:el,valEl:el.querySelector('[data-ovp-v]'),def:p.def});
      if(p.tap||p.hold||p.def.double_tap_action)self._addZoneListeners(el,p.tap,p.hold,p.def.double_tap_action,p.def.hold_delay);
    });
    const ovRoom=cAll.rooms[this._roomIdx]||{};
    const ov=rocOvCfg(cAll,this._roomIdx)||{};
    const wr=ov.grid&&ov.grid.width_ref;
    const wAuto=!(Number(wr)>0);
    const navRef=(cAll.nav&&cAll.nav.mini&&Number(cAll.nav.mini.width_ref))||480;
    const navCfg=cAll.nav||{};
    meta.tiles.forEach(function(t){
      const el=sr.querySelector('[data-ovt="'+t.ri+'"]');if(!el)return;
      const r=cAll.rooms[t.ri];
      const tc=r.overview_tile||{};
      self._addZoneListeners(el,{action:'switch-room',room:r.id||r.name},tc.hold_action||null,tc.double_tap_action||null,tc.hold_delay);
      const rec={ri:t.ri,el:el,chips:[]};
      t.chips.forEach(function(ch,k){
        const b=el.querySelector('[data-ovchip="'+t.ri+':'+k+'"]');if(!b)return;
        rec.chips.push({el:b,def:ch});
        if(ch.tap_action||ch.hold_action)self._addZoneListeners(b,ch.tap_action,ch.hold_action,null,null);
      });
      const info=sr.querySelector('[data-ovt-info="'+t.ri+'"]');
      if(info)(r.chips||navCfg.chips||[]).slice(0,3).forEach(function(chCfg){if(chCfg)self._navChipInto(info,chCfg,r);});
      const ph=sr.querySelector('[data-ovt-ph="'+t.ri+'"]');
      if(t.real){
        const host=sr.querySelector('[data-ovt-mini="'+t.ri+'"]');
        if(host){
          let wRef=wAuto?(host.clientWidth||0):Number(wr);
          wRef=wRef>0?(wAuto?Math.max(160,Math.ceil(wRef/40)*40):wRef):navRef;
          const m=self._mountMini(host,t.ri,wRef);
          if(m){m.thumb=host;m.focus=t.focus;m.auto=wAuto;self._ovMiniEls[t.ri]=m;}
        }
      }else if(ph)self._ovThumbs.push({el:ph,ri:t.ri,mode:meta.live});
      self._ovTiles.push(rec);
    });
    if(window.ResizeObserver&&Object.keys(this._ovMiniEls).length){
      const map=this._ovMiniEls;
      this._ovMiniRo=new ResizeObserver(function(entries){
        for(const en of entries)for(const k in map){const m=map[k];if(m&&(m.thumb===en.target||m.el===en.target))self._ovFit(m);}
      });
      for(const k in map){this._ovMiniRo.observe(map[k].thumb);this._ovMiniRo.observe(map[k].el);}
    }
    const gridEl=sr.querySelector('[data-ov-grid]');
    if(gridEl){
      if(this._ovScroll)gridEl.scrollTop=this._ovScroll;
      gridEl.addEventListener('scroll',function(){self._ovScroll=gridEl.scrollTop;},{passive:true});
    }
    void ovRoom;
  }

  // Cover-fit a tile's live mini (focus = object-position). With width_ref:
  // auto the mini is re-laid-out at the width the tile really needs, in 40 px
  // steps, so a big tile is never an upscaled 480 px render (O13).
  _ovFit(m){
    const w=m.thumb.clientWidth||0,h=m.thumb.clientHeight||0;
    let mh=m.el.offsetHeight||0;
    if(m.auto&&w>0){
      const need=mh>0?Math.max(w,h*(m.widthRef/mh)):w;
      const want=Math.max(160,Math.ceil(need/40)*40);
      if(Math.abs(want-m.widthRef)>=40){
        if(mh>0)mh=mh*want/m.widthRef;
        m.widthRef=want;m.el.style.width=want+'px';
      }
    }
    let sc=w>0?w/m.widthRef:0,tx=0,ty=0;
    if(sc>0&&mh>0){sc=Math.max(sc,h/mh);tx=(w-m.widthRef*sc)*m.focus.x;ty=(h-mh*sc)*m.focus.y;}
    m.el.style.transform=sc>0?('translate('+tx.toFixed(2)+'px,'+ty.toFixed(2)+'px) scale('+sc+')'):'';
    m.el._miniScale=sc;
    if(sc>0&&m.el._hqRefresh)m.el._hqRefresh();
  }

  _updateOverview(s){
    for(const t of(this._ovTiles||[])){
      let any=false;
      for(const ch of t.chips){
        const on=rocOvChipActive(ch.def,s);
        const ents=ch.def.entities||[];
        const na=ents.length>0&&ents.every(function(id){return!s[id]||s[id].state==='unavailable';});
        if(on)any=true;
        ch.el.classList.toggle('on',on);
        ch.el.classList.toggle('na',na);
        const ap=on?'true':'false';
        if(ch.el.getAttribute('aria-pressed')!==ap)ch.el.setAttribute('aria-pressed',ap);
      }
      t.el.classList.toggle('roc-ovt-on',any);
    }
    for(const p of(this._ovPills||[])){
      const d=p.def;
      if(d.template||!d.entity||!p.valEl)continue;
      const st=s[d.entity];
      const txt=st?rocFmtState(this._hass,st,d):'—';
      if(p.valEl.textContent!==txt)p.valEl.textContent=txt;
    }
  }

  _dropNavStash(){
    const st=this._navStash;this._navStash=null;
    if(st&&st.ro)try{st.ro.disconnect();}catch(_){}
  }

  // ----- Overview ↔ room transition (O14, OVERVIEW_PLAN.md §4a) ---------------
  _ovAnimFinish(){
    const a=this._ovAnim;this._ovAnim=null;
    if(a)try{a.finish();}catch(_){}
  }
  // Decided BEFORE the room switch re-renders: captures what is on screen now.
  _ovPlanSwitch(idx,manual){
    const cAll=this._config,sr=this.shadowRoot;
    if(!sr)return null;
    const from=this._roomIdx;
    const fromOv=this._ovActive?rocOvCfg(cAll,from):null;
    const toOv=rocOvCfg(cAll,idx);
    if(!fromOv&&!toOv)return null;
    const ov=fromOv||toOv;
    const card=sr.querySelector('ha-card');if(!card)return null;
    const reduced=rocReducedMotion();
    let mode=ov.transition||'zoom';
    if(mode!=='none'&&reduced)mode='fade';
    if(mode==='none')return{kind:'none'};
    const dur=reduced?150:rocOvMs(ov.transition_duration,450);
    const cr=card.getBoundingClientRect();
    const rel=function(el){const r=el.getBoundingClientRect();return{x:r.left-cr.left,y:r.top-cr.top,w:r.width,h:r.height};};
    if(fromOv&&!toOv){
      // The whole overview .content (background layer + grid) is frozen.
      const root=sr.querySelector('.wrap .content');
      if(!root||!root.querySelector('[data-ov-root]'))return null;
      const ph=root.querySelector('.roc-ovt[data-ovt="'+idx+'"] .roc-ovt-ph');
      if(mode==='zoom'&&manual&&ph){ // presence follow fades; only a switch the user made zooms
        const T=rel(ph);
        if(T.w>0&&T.h>0){
          const tc=((cAll.rooms[idx]||{}).overview_tile)||{};
          return{kind:'open',root:root,idx:idx,tile:T,radius:parseFloat(getComputedStyle(ph).borderTopLeftRadius)||0,focus:rocOvFocus(tc.focus),dur:dur};
        }
      }
      return{kind:'fade-out',layerEl:root,dur:dur};
    }
    if(toOv&&!fromOv){
      const grid=sr.querySelector('.roc-grid');
      if(!grid)return null;
      if(mode==='zoom'&&manual&&rocOvRooms(cAll,toOv).indexOf(from)>=0){
        const tc=((cAll.rooms[from]||{}).overview_tile)||{};
        return{kind:'close',grid:grid,idx:from,focus:rocOvFocus(tc.focus),dur:dur};
      }
      return{kind:'fade-out',layerEl:grid,dur:dur};
    }
    return null;
  }
  // FLIP the room's image region onto the tile rect T: transform + clip-path
  // so the room's own stage, cover-fitted with the tile's focus, sits exactly
  // where the tile showed it. Returns the {transform, clip} pair.
  _ovTileXf(reg,T,focus,radius,card){
    const cr=card.getBoundingClientRect();
    const rel=function(el){const r=el.getBoundingClientRect();return{x:r.left-cr.left,y:r.top-cr.top,w:r.width,h:r.height};};
    const R=rel(reg);
    const content=reg.querySelector('.content');
    const S=content?rel(content):R;
    if(!(R.w>0&&R.h>0&&S.w>0&&S.h>0&&T.w>0&&T.h>0))return null;
    const s=Math.max(T.w/S.w,T.h/S.h);
    const Sx=T.x+(T.w-S.w*s)*focus.x,Sy=T.y+(T.h-S.h*s)*focus.y;
    const tx=Sx-R.x-(S.x-R.x)*s,ty=Sy-R.y-(S.y-R.y)*s;
    const L=(T.x-R.x-tx)/s,Tp=(T.y-R.y-ty)/s;
    const Rr=R.w-L-T.w/s,B=R.h-Tp-T.h/s;
    const f=function(n){return n.toFixed(2)+'px';};
    return{transform:'translate('+f(tx)+','+f(ty)+') scale('+s.toFixed(5)+')',clip:'inset('+f(Tp)+' '+f(Rr)+' '+f(B)+' '+f(L)+' round '+f(radius/s)+')'};
  }
  // Waits until the freshly rendered card is laid out. In Home Assistant
  // <ha-card> is a Lit element: right after innerHTML its shadow <slot> does
  // not exist yet, so its children are outside the flat tree — no box, and a
  // transition started then has no "from" state and simply jumps (v6.31.0
  // fix: `transition: fade` did nothing, the zoom back to the overview
  // measured a 0×0 tile). Without Lit (tests, older HA) this runs at once.
  _ovReady(card,el,cb){
    let n=0,fired=false;
    const laid=function(){const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
    const go=function(){
      if(fired)return;
      if(laid()||n++>30){fired=true;void el.offsetWidth;getComputedStyle(el).opacity;cb();}
      else setTimeout(go,16);
    };
    if(laid()){go();return;}
    const p=card&&card.updateComplete;
    if(p&&typeof p.then==='function')p.then(function(){setTimeout(go,0);},function(){setTimeout(go,0);});
    else setTimeout(go,0);
  }
  // Runs AFTER the switch rendered the new view. Every path ends in exactly
  // the plain switch-room DOM (finish() strips every inline style it set).
  // The frozen layer is attached at once (no flash of the new view); the
  // animation itself starts once the card is laid out (_ovReady).
  _ovRun(plan){
    if(!plan||plan.kind==='none')return;
    const self=this,sr=this.shadowRoot;
    const card=sr&&sr.querySelector('ha-card');if(!card)return;
    const cleanups=[];let done=false,timer=null;
    const anim={finish:function(){
      if(done)return;done=true;clearTimeout(timer);clearTimeout(safety);
      for(const f of cleanups)try{f();}catch(_){}
      if(self._ovAnim===anim)self._ovAnim=null;
    }};
    this._ovAnim=anim;
    const setS=function(el,props){
      const prev={};for(const k in props){prev[k]=el.style[k];el.style[k]=props[k];}
      cleanups.push(function(){for(const k in prev)el.style[k]=prev[k];});
    };
    if(card.style.position!=='relative'&&card.style.position!=='absolute')setS(card,{position:'relative'});
    const ease='cubic-bezier(.2,.8,.2,1)',dur=plan.dur;
    const layer=document.createElement('div');
    cleanups.push(function(){layer.remove();});
    const end=function(ms){clearTimeout(timer);timer=setTimeout(anim.finish,ms);};
    // never leave a frozen layer behind, whatever happens to the async steps
    const safety=setTimeout(anim.finish,dur+2500);
    if(plan.kind==='fade-out'){
      layer.style.cssText='position:absolute;inset:0;z-index:5;pointer-events:none;transition:opacity '+dur+'ms ease;';
      layer.appendChild(plan.layerEl);card.appendChild(layer);
      this._ovReady(card,layer,function(){
        if(done)return;
        layer.style.opacity='0';
        end(dur+60);
      });
      return;
    }
    const grid=sr.querySelector('.roc-grid');
    if(plan.kind==='open'){
      // Frozen overview BELOW the new room; the room grows out of the tile.
      if(!grid){anim.finish();return;}
      layer.style.cssText='position:absolute;inset:0;z-index:0;pointer-events:none;';
      layer.appendChild(plan.root);card.insertBefore(layer,card.firstChild);
      const src=plan.root.querySelector('.roc-ovt[data-ovt="'+plan.idx+'"] .roc-ovt-ph');
      if(src)src.style.visibility='hidden';
      setS(grid,{position:'relative',zIndex:'1'});
      const img=grid.querySelector('.roc-reg[data-reg="image"]');
      if(!img){anim.finish();return;}
      const others=[].slice.call(grid.querySelectorAll('.roc-reg')).filter(function(r){return r!==img;});
      setS(img,{visibility:'hidden'});
      others.forEach(function(o){setS(o,{opacity:'0',transform:'none',transition:'none'});});
      const base=this._roomCfg&&this._roomCfg.base_image;
      const go=function(){
        if(done)return;
        // Each region slides in from the edge it sits on (measured now that
        // the card is laid out).
        const ir=img.getBoundingClientRect();
        others.forEach(function(o){
          const r=o.getBoundingClientRect();
          o.style.transform=r.bottom<=ir.top+1?'translateY(-16px)':(r.top>=ir.bottom-1?'translateY(16px)':(r.right<=ir.left+1?'translateX(-16px)':(r.left>=ir.right-1?'translateX(16px)':'none')));
        });
        // Start from the room's real state, not from overlays fading in from 0:
        // apply one state pass with the layers' own transitions off.
        const lay=[].slice.call(img.querySelectorAll('.layer,.glow'));
        const tr=lay.map(function(el){const v=el.style.transition;el.style.transition='none';return v;});
        try{self._update();}catch(_){}
        void img.offsetWidth;
        lay.forEach(function(el,k){el.style.transition=tr[k];});
        const xf=self._ovTileXf(img,plan.tile,plan.focus,plan.radius,card);
        if(!xf){anim.finish();return;}
        // The tile shows the room's whole stage; the room view crops it to its
        // image region. Let the stage overflow the region while clip-path does
        // the cropping, so the first frame IS the tile and the last IS the room.
        const wrapEl=img.querySelector('.wrap');
        if(wrapEl)setS(wrapEl,{overflow:'visible'});
        setS(img,{overflow:'visible',transformOrigin:'0 0',willChange:'transform,clip-path',transition:'none',transform:xf.transform,clipPath:xf.clip});
        img.style.visibility='';
        void img.offsetWidth;
        img.style.transition='transform '+dur+'ms '+ease+',clip-path '+dur+'ms '+ease;
        img.style.transform='translate(0px,0px) scale(1)';
        img.style.clipPath='inset(0px 0px 0px 0px round 0px)';
        setS(layer,{transition:'opacity '+dur+'ms ease,transform '+dur+'ms '+ease,transformOrigin:(plan.tile.x+plan.tile.w/2)+'px '+(plan.tile.y+plan.tile.h/2)+'px'});
        layer.style.opacity='0';layer.style.transform='scale(.96)';
        setTimeout(function(){
          if(done)return;
          others.forEach(function(o){o.style.transition='opacity 250ms ease,transform 300ms ease';o.style.opacity='1';o.style.transform='none';});
        },Math.round(dur*0.7));
        end(dur+320);
      };
      rocOvDecode(base,150).then(function(){if(!done)self._ovReady(card,img,go);});
      return;
    }
    if(plan.kind==='close'){
      // Frozen old room ABOVE the new overview; its photo shrinks into the tile.
      const root=sr.querySelector('[data-ov-root]');
      const tile=root&&root.querySelector('.roc-ovt[data-ovt="'+plan.idx+'"]');
      const ph=tile&&tile.querySelector('.roc-ovt-ph');
      if(!root||!ph){anim.finish();return;}
      layer.style.cssText='position:absolute;inset:0;z-index:5;pointer-events:none;';
      setS(plan.grid,{height:'100%'});
      layer.appendChild(plan.grid);card.appendChild(layer);
      setS(root,{opacity:'0',transition:'none'});
      this._ovReady(card,root,function(){
        if(done)return;
        // Bring the tile into view inside the scrolling grid first.
        const gEl=root.querySelector('[data-ov-grid]');
        if(gEl){
          const gr=gEl.getBoundingClientRect(),tr=tile.getBoundingClientRect();
          if(tr.top<gr.top)gEl.scrollTop-=gr.top-tr.top+8;
          else if(tr.bottom>gr.bottom)gEl.scrollTop+=tr.bottom-gr.bottom+8;
        }
        const cr=card.getBoundingClientRect(),pr=ph.getBoundingClientRect();
        const T={x:pr.left-cr.left,y:pr.top-cr.top,w:pr.width,h:pr.height};
        const img=plan.grid.querySelector('.roc-reg[data-reg="image"]');
        const xf=img&&self._ovTileXf(img,T,plan.focus,parseFloat(getComputedStyle(ph).borderTopLeftRadius)||0,card);
        if(!xf){anim.finish();return;}
        setS(ph,{visibility:'hidden'});
        const wrapOld=img.querySelector('.wrap');
        if(wrapOld)wrapOld.style.overflow='visible';
        img.style.overflow='visible';
        setS(root,{transform:'scale(.96)',transformOrigin:(T.x+T.w/2)+'px '+(T.y+T.h/2)+'px'});
        [].slice.call(plan.grid.querySelectorAll('.roc-reg')).forEach(function(o){
          if(o!==img)o.style.transition='opacity '+Math.round(dur*0.45)+'ms ease';
        });
        img.style.transformOrigin='0 0';img.style.willChange='transform,clip-path';
        img.style.clipPath='inset(0px 0px 0px 0px round 0px)';
        void img.offsetWidth;
        img.style.transition='transform '+dur+'ms '+ease+',clip-path '+dur+'ms '+ease;
        img.style.transform=xf.transform;img.style.clipPath=xf.clip;
        [].slice.call(plan.grid.querySelectorAll('.roc-reg')).forEach(function(o){if(o!==img)o.style.opacity='0';});
        root.style.transition='opacity '+Math.round(dur*0.8)+'ms ease,transform '+dur+'ms '+ease;
        root.style.opacity='1';root.style.transform='scale(1)';
        end(dur+60);
      });
    }
  }

  _render(){
    if(!this._config)return;
    this._ovAnimFinish(); // a running overview zoom ends in its final state first
    const _gen=++this._renderGen; // stale async mounts (card helpers) bail via this
    const cAll=this._config;
    // URL deep-link: the first render honours #<key>=<room> (opt-in via url_sync);
    // otherwise reflect the starting room so the URL is immediately bookmarkable.
    if(!this._hashInit){
      this._hashInit=true;
      const _hi=this._roomIdxFromHash();
      if(_hi>=0){this._roomIdx=_hi;this._manualHoldUntil=Date.now()+((cAll.follow_hold??60)*1000);}
      else this._writeRoomHash(this._roomIdx);
    }
    const c=roomMerge(cAll,this._roomIdx); // active room view (or plain config)
    this._roomCfg=c;
    this._zoomScale=1;this._wrapTA='';
    const tm=c.test_mode??false;
    // Active layout profile — by the AVAILABLE VIEWPORT shape (w/h ratio), not
    // by device type. Test mode can force the other profile via the ⇅ button.
    let _rt=rocProfile(cAll,this._vpW(),this._vpH());
    if(tm&&this._profFlipped)_rt=(_rt==='portrait')?'landscape':'portrait';
    const _tier=tm?null:_rt; // element profile-overrides are off in test mode (so dragging edits the base profile)
    this._tier=_tier;
    const _vt=_rt; // per-profile SCALARS follow the real profile even in test mode
    this._vt=_vt;this._profile=_rt;
    // Swipe ghosts AND nav.live:full minis (§3 NAV_LIVE_FULL_PLAN.md) both want the
    // collapsed image-only grid below — a mini is a persistent restricted
    // instance, not a <0.5s ghost, but shares the same "just render the room
    // picture" grid shape. Height behaviour DIFFERS from a ghost though (see
    // _isMini/_rootH below): a ghost stretches to fill an externally-dictated
    // box (the swipe container, already sized to match the real card); a mini
    // renders at a fixed reference WIDTH with its own aspect-derived height,
    // then gets scaled as a whole to fit its thumbnail (NAV_LIVE_FULL_PLAN.md
    // §6) — stretching it to an arbitrary thumb height would distort it.
    // Camera/template skipping stays gated on the literal c._roc_ghost checks
    // elsewhere (unaffected by this) — minis opt into those via nav.mini.*.
    const _isGhost=!!c._roc_ghost;
    const _isMini=!!c._roc_mini;
    // Overview page (v6.30.0, OVERVIEW_PLAN.md): the room's OWN `overview:`
    // block — a top-level one would make every room an overview. Its content
    // is the overview, never the room keys it may inherit from top level; a
    // swipe ghost / nav mini of it draws a placeholder instead of the grid.
    const _ovDef=rocOvCfg(cAll,this._roomIdx);
    const _ovOn=!!_ovDef&&!_isGhost&&!_isMini;
    const _ovPh=!!_ovDef&&!_ovOn;
    const _ovAny=rocOvAny(cAll);
    this._ovActive=_ovOn;
    if(_ovDef){
      ['overlays','zones','badges','elements','icons','labels','gauges','vacuum_widgets','glows','blinds','groups','cards_above','cards_below'].forEach(function(k){c[k]=[];});
      c.light_controls=null;c.weather_overlay=null;c.base_camera=null;c.base_image_conditions=null;c.filter_conditions=null;c.brightness_model=null;c.tap_action=null;c.zoom=false;c.parallax=false;
      c.base_image=_ovDef.background||'';
    }
    // Grid definition for the active profile (swipe ghosts + minis render the image region only)
    const _lp=(_isGhost||_isMini||_ovOn)?{columns:[100],rows:[100],place:{image:{row:1,col:1}}}
      :(rocProfileDef(cAll,_rt)||{columns:[100],rows:[100],place:{image:{row:1,col:1}}});
    this._lp=_lp;
    const _arResolved=tVal(c.aspect_ratio,_vt)||'16/9';
    const br=(tVal(c.border_radius,_vt)??'12px');
    // Root height: viewport (default) | fill | container | fixed CSS length.
    // Ghosts and editor previews fill/fix their host instead of the viewport.
    const _lhRaw=(cAll.layout&&cAll.layout.height)||'viewport';
    // Portrait, default 'viewport' mode: size from CONTENT (width is the real
    // limiting factor in portrait), not a forced full-screen pin — force-
    // filling the leftover vertical space just stretches every region
    // proportionally past what it actually needs. Landscape (the kiosk/wall-
    // tablet use case) keeps the viewport-fill goal. An explicit
    // layout.height (container/fixed) always wins, in either profile.
    // 'fill' (v6.13.0) is the escape hatch from that portrait default: a
    // panel-view cockpit dashboard (sections/panels, image row on '1fr') wants
    // the phone screen genuinely pinned full-height too, so its bottom sheet
    // has real screen to open into — 'fill' behaves exactly like 'viewport'
    // but also opts portrait INTO the pin instead of sizing to content.
    const _isStubCard=rocIsStubCfg(cAll);
    const _pinHeight=_lhRaw==='viewport'||_lhRaw==='fill';
    const _naturalRoot=!_ovOn&&!_isGhost&&!_isMini&&!c._roc_preview&&_rt==='portrait'&&_lhRaw==='viewport';
    let _rootH;
    if(_isGhost)_rootH='100%';
    else if(_isMini)_rootH='auto';       // aspect-derived, via _wrapAspect below — never stretched
    else if(c._roc_preview||_isStubCard)_rootH='auto';  // aspect-derived, via _wrapAspect below — was a guessed fixed 420px, left blank space under shorter content
    else if(_naturalRoot)_rootH='auto';
    else if(_pinHeight)_rootH=this._rootHPx?this._rootHPx+'px':'calc(100svh - var(--header-height,56px))'; // pinned px survives re-renders (room switch); CSS calc is first-paint only, refined by _layoutRootHeight()
    else if(_lhRaw==='container')_rootH='100%';
    else _rootH=(typeof _lhRaw==='number')?_lhRaw+'px':String(_lhRaw);
    // ---- Multi-room navigation strip -------------------------------------
    let navHtml='',_navKey='';
    const navCfg=cAll.nav||{};
    const navStyle=Array.isArray(cAll.rooms)&&cAll.rooms.length>1?(navCfg.style||'thumbnails'):'none';
    // nav.live: 'full' — persistent live mini <room-overlay-card> per thumbnail
    // (NAV_LIVE_FULL_PLAN.md). Only meaningful for thumbnails; tabs/dots have
    // no image box to host one.
    const _navLiveReal=navStyle==='thumbnails'&&(navCfg.live==='full'||navCfg.live==='custom');
    // position: top | bottom | left | right | auto (auto = side rail on wide cards)
    let navPos=navCfg.position||'top';
    if(navPos==='auto')navPos='top'; // v4: position only orients the strip; placement comes from the layout grid
    if(navStyle==='none')navPos='top';
    this._navPos=navPos;
    const _navSide=navPos==='left'||navPos==='right';
    if(navStyle!=='none'){
      const nh=navCfg.height||'64px';
      const _nr=rocRatio(tVal(c.aspect_ratio,_vt))||16/9;
      const navSelfIdx=this._roomIdx;
      // nav.width: css size | 'auto' (stretch items across the available strip)
      const nwRaw=navCfg.width;
      const _thDerived='calc('+nh+' * '+_nr.toFixed(3)+')';
      let _thFlex;
      // 'auto' stretches items in horizontal strips; a vertical side rail has no
      // intrinsic width to stretch into, so it falls back to the derived width
      if(nwRaw==='auto')_thFlex=_navSide?('flex:none;width:'+_thDerived+';'):'flex:1 1 0;min-width:0;';
      else _thFlex='flex:none;width:'+(nwRaw||_thDerived)+';';
      // Mobile: wrap the strip — all thumbnails shrink onto row 1 (keeping
      // aspect via aspect-ratio), custom cards + follow button wrap to row 2
      const _navMob=!_navSide&&_rt==='portrait';
      if(_navMob)_thFlex='flex:1 1 0;min-width:0;';
      // Mobile thumbs: fixed (shorter) height so both chips fit; image crops to cover
      const _thSize='height:'+(_navMob?(navCfg.mobile_height||'48px'):nh)+';';
      const _navBreak=_navMob?'<div style="flex-basis:100%;height:0;"></div>':'';
      const _tabFlex=(nwRaw==='auto'&&!_navSide)?'flex:1 1 0;min-width:0;justify-content:center;':'flex:none;';
      // v6.25.0: nav.rows / nav.cards_position — thumbnails in a grid of N rows
      // (e.g. 3+3 on a phone) with the strip cards beside the grid (spanning
      // every row) or on their own row below it. Both take a plain value or
      // {portrait, landscape}. A profile left out gets the default — on purpose
      // NOT tVal()'s fallback to the other profile: rows: {portrait: 2} must not
      // also turn the landscape strip into two rows. Neither key set → the
      // pre-v6.25.0 strip, byte for byte (the _navGrid=false path below).
      const _navPV=function(v){return(v!=null&&typeof v==='object'&&!Array.isArray(v))?v[_rt]:v;};
      const _nRows=Math.max(1,Math.min(6,parseInt(_navPV(navCfg.rows),10)||1));
      const _cpos=_navPV(navCfg.cards_position);
      const _navGrid=navStyle==='thumbnails'&&!_navSide&&(_nRows>1||_cpos==='side'||_cpos==='below');
      const _cardsBelow=_navGrid&&(_cpos==='below'||(_cpos!=='side'&&_navMob));
      const _rowH=_navMob?(navCfg.mobile_height||'48px'):nh;     // height of ONE thumbnail row
      const _gridStretch=_navMob||nwRaw==='auto';                // columns share the width vs fixed item width
      const _gridH=_nRows>1?'calc('+_nRows+' * '+_rowH+' + '+((_nRows-1)*6)+'px)':_rowH;
      const _gridCols=Math.max(1,Math.ceil((cAll.rooms||[]).length/_nRows));
      const _gridOpen=_navGrid?'<div class="roc-thumbgrid" style="display:grid;grid-template-columns:repeat('+_gridCols+','+(_gridStretch?'minmax(0,1fr)':((nwRaw&&nwRaw!=='auto')?nwRaw:_thDerived))+');grid-auto-rows:'+_rowH+';gap:6px;min-width:0;'+(_gridStretch?(_cardsBelow?'flex:1 1 100%;':'flex:1 1 0;'):'flex:none;')+'">':'';
      const _gridClose=_navGrid?'</div>'+(_cardsBelow?'<div style="flex-basis:100%;height:0;"></div>':''):'';
      // nav.cards: arbitrary HA cards inside the strip ({width, card, placement} or plain card config)
      const _navCardOne=function(cc,ci){
        const w=cc&&cc.width;
        const sz=_navGrid
          ?(_cardsBelow
            ?('height:'+nh+';'+(w?'flex:none;width:'+w+';':'flex:1 1 0;min-width:0;'))
            :('height:'+_gridH+';'+(w?'flex:none;width:'+w+';':(_gridStretch?'flex:1 1 0;min-width:0;':'flex:1 1 auto;min-width:140px;'))))
          :_navSide
          ?('width:100%;'+(w?'height:'+w+';':'min-height:'+nh+';'))
          :('height:'+nh+';'+(w?'flex:none;width:'+w+';':(_navMob?'flex:1 1 0;min-width:0;':'flex:1 1 auto;min-width:140px;')));
        return'<div data-nav-card="'+ci+'" style="'+sz+'overflow:hidden;border-radius:6px;position:relative;"></div>';
      };
      const _navCardsStart=(navCfg.cards||[]).map(function(cc,ci){return cc&&cc.placement==='start'?_navCardOne(cc,ci):'';}).join('');
      const _navCardsEnd=(navCfg.cards||[]).map(function(cc,ci){return cc&&cc.placement==='start'?'':_navCardOne(cc,ci);}).join('');
      // Follow button — only when THIS device resolves room_entity to a real,
      // existing presence sensor (by_browser → by_user → default). Devices with
      // no usable presence source (e.g. a phone not in the mapping) don't show it.
      const _fbEnt=this._followBtnEntity();
      const _fbHtml=(navCfg.follow_button!==false&&_fbEnt&&this._hass&&this._hass.states[_fbEnt])
        ?'<button data-nav-follow title="Jump to my room (presence)" style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;border:1px solid var(--divider-color,#555);background:none;color:var(--primary-text-color,#fff);cursor:pointer;"><ha-icon icon="mdi:crosshairs-gps" style="--mdc-icon-size:18px;"></ha-icon></button>'
        :'';
      // Built twice: for the active room, and with no room active as a key —
      // a room switch whose key is unchanged keeps the existing nav DOM
      // (v6.23.0, see _navOld below) and only moves the "active" marker.
      const _navBuild=function(navSelfIdx){return'<div class="roc-nav'+(navCfg.dim_inactive===false?'':' roc-dim')+'" style="display:flex;box-sizing:border-box;'+(_navSide?'flex-direction:column;overflow-y:auto;overflow-x:hidden;height:100%;':(_navGrid?((_cardsBelow?'flex-wrap:wrap;':'')+(_gridStretch?'':'overflow-x:auto;')):(_navMob?'flex-wrap:wrap;':'overflow-x:auto;')))+'gap:6px;padding:6px;align-items:center;scrollbar-width:thin;">'
        +_navCardsStart
        +_gridOpen+cAll.rooms.map(function(r,ri){
          const act=ri===navSelfIdx;
          if(r&&r.overview&&r.nav_hidden===true)return''; // overview page kept out of the strip (O12)
          if(navStyle==='dots')
            return'<button data-nav-room="'+ri+'" aria-label="'+escA(r.name||r.id)+'" style="width:10px;height:10px;border-radius:50%;border:none;cursor:pointer;background:'+(act?'var(--primary-color,#03a9f4)':'var(--divider-color,#666)')+';padding:0;flex:none;"></button>';
          if(navStyle==='tabs')
            return'<button data-nav-room="'+ri+'" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:16px;border:1px solid '+(act?'var(--primary-color,#03a9f4)':'var(--divider-color,#444)')+';cursor:pointer;background:'+(act?'rgba(3,169,244,0.15)':'none')+';color:var(--primary-text-color,#fff);font-size:12px;'+_tabFlex+'">'+(r.icon?'<ha-icon icon="'+escA(r.icon)+'" style="--mdc-icon-size:16px;"></ha-icon>':'')+escA(r.name||r.id||'')+'</button>';
          // An overview page shows as an icon thumbnail — a mini of a grid of minis is noise (O12)
          if(r&&r.overview){const _ovbg=(typeof r.overview==='object'&&r.overview.background)||'';
            return'<div class="roc-thumb roc-thumb-ov" data-nav-room="'+ri+'" data-thumb="'+ri+'"'+(act?' data-act':'')+' tabindex="0" role="button" aria-label="'+escA(r.name||r.id)+'" style="position:relative;'+(_navGrid?'height:'+_rowH+';min-width:0;':_thSize+_thFlex)+'border-radius:6px;overflow:hidden;cursor:pointer;background-size:cover;background-position:center;'+(_ovbg?'background-image:url(\''+escA(escUrl(_ovbg))+'\');':'')+'border:2px solid '+(act?'var(--primary-color,#03a9f4)':'transparent')+';box-sizing:border-box;transition:border-color .2s ease,opacity .2s ease;"><ha-icon icon="'+escA(r.icon||'mdi:view-dashboard')+'" style="pointer-events:none;"></ha-icon></div>';}
          // thumbnails — live mini-render: base image + filter + sensor chips
          return'<div class="roc-thumb" data-nav-room="'+ri+'" data-thumb="'+ri+'"'+(act?' data-act':'')+' tabindex="0" role="button" aria-label="'+escA(r.name||r.id)+'" style="position:relative;'+(_navGrid?'height:'+_rowH+';min-width:0;':_thSize+_thFlex)+'border-radius:6px;overflow:hidden;cursor:pointer;background-size:cover;background-position:center;'+(_navLiveReal?'':(r.base_image?'background-image:url(\''+escA(escUrl(r.base_image))+'\');':''))+'border:2px solid '+(act?'var(--primary-color,#03a9f4)':'transparent')+';box-sizing:border-box;transition:border-color .2s ease,filter 1.5s ease,opacity .2s ease;">'
            +(_navLiveReal?'<div data-thumb-mini="'+ri+'" style="position:absolute;inset:0;overflow:hidden;pointer-events:none;"></div>':'')
            +'<div data-thumb-chips="'+ri+'" style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;padding:3px 5px;pointer-events:none;font-family:inherit;font-weight:600;font-size:11px;line-height:1.35;font-variant-numeric:tabular-nums;text-shadow:0 1px 2px rgba(0,0,0,0.9);color:var(--roc-text-c);"></div></div>';
        }).join('')+(_navGrid?_gridClose:_navBreak)+_navCardsEnd+_fbHtml+'</div>';};
      navHtml=_navBuild(navSelfIdx);
      _navKey=_navBuild(-1);
    }

    // Group state init — keep existing state, add newly declared groups
    const _prevGS=this._groupState||{};
    this._groupState={};
    for(const g of(c.groups||[])){
      this._groupState[g.id]=g.id in _prevGS?_prevGS[g.id]:(g.visible??false);
    }
    // Reset handlers/timers/subscriptions from previous render
    if(this._tmKeyHandler){document.removeEventListener('keydown',this._tmKeyHandler);this._tmKeyHandler=null;}
    if(this._hlHandler){window.removeEventListener('roc-highlight',this._hlHandler);this._hlHandler=null;}
    if(this._camTimer){clearInterval(this._camTimer);this._camTimer=null;}
    if(this._relTimer){clearInterval(this._relTimer);this._relTimer=null;}
    this._relNeeded=false; // recomputed from the new config at the end of _render
    if(this._orientHandler){window.removeEventListener('deviceorientation',this._orientHandler);this._orientHandler=null;}
    if(this._hashHandler){window.removeEventListener('hashchange',this._hashHandler);this._hashHandler=null;}
    this._teardownTemplates();
    this._selectedTM=null;
    // URL deep-link: follow back/forward navigation and external hash edits
    if(this._urlSyncKey()&&Array.isArray(cAll.rooms)&&cAll.rooms.length>1){
      const _hashSelf=this;
      this._hashHandler=function(){
        if(_hashSelf._hashMuted)return;
        const hi=_hashSelf._roomIdxFromHash();
        if(hi>=0&&hi!==_hashSelf._roomIdx)_hashSelf._switchRoom(hi,0,true);
      };
      window.addEventListener('hashchange',this._hashHandler);
    }

    const ovHtml=(c.overlays||[]).map((ov,i)=>{
      // transform-origin is where the hinge / axle sits ON THE IMAGE (the layer
      // covers the whole stage, so it is a % of the photo, not of the PNG's
      // visible pixels) — static config, so it belongs in the markup.
      const _tf=ov.transform;
      const _tfSt=_tf?('transform-origin:'+(_tf.origin||'50% 50%')+';will-change:transform;'+(_tf.perspective?'transform-style:preserve-3d;':'')):'';
      const _tfTr=_tf?(',transform '+(_tf.transition||'0.8s ease')):'';
      return'<div class="layer ov" data-ov="'+escA(ov.id)+'" style="z-index:'+(ov.z_index??i+1)+';opacity:0;'+_tfSt+'transition:opacity '+(ov.transition??'2s ease')+',filter '+(ov.transition??'2s ease')+_tfTr+';"></div>';
    }).join('');
    const zHtml=(c.zones||[]).map(z0=>{const z=tApply(z0,_tier);const act=z.tap_action||z.hold_action||z.double_tap_action||z.slider;const a11y=act?` tabindex="0" role="button" aria-label="${escA(z.id)}"`:'';return`<div class="zone" data-z="${escA(z.id)}"${a11y} style="top:${z.top};left:${z.left};width:${z.width};height:${z.height};z-index:50;cursor:${act?'pointer':'default'};box-sizing:border-box;-webkit-tap-highlight-color:transparent;${tm?'outline:3px solid red;background:rgba(255,0,0,0.08);':''}" title="${tm?escA(`[${z.id}] ${z.top} ${z.left} ${z.width}x${z.height}`):''}">${tm?`<span class="zlabel">${escA(z.id)}</span>`:''}</div>`;}).join('');
    const bHtml=(c.badges||[]).map(b=>{let animSt='';if(b.animation==='blink')animSt='animation:roc-blink 1s step-end infinite;';else if(b.animation==='pulse'){if(b.animation_color)animSt='--roc-ac:'+b.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else animSt='animation:roc-pulse 2s ease-in-out infinite;';}const _bAct=b.tap_action||b.hold_action||b.double_tap_action;const _bA11y=_bAct?' tabindex="0" role="button" aria-label="'+escA(b.id)+'"':'';return'<div class="badge" data-b="'+escA(b.id)+'"'+_bA11y+' style="'+makeBadgePos(tApply(b,_tier))+';cursor:'+(_bAct?'pointer':'default')+';-webkit-tap-highlight-color:transparent;'+animSt+'">'+(b.icon?'<ha-icon data-bi="'+escA(b.id)+'" icon="'+escA(b.icon)+'" style="color:white;--mdc-icon-size:14px;width:14px;height:14px;display:flex;"></ha-icon>':'')+(b.label!==undefined||b.label_template!==undefined?'<span class="blabel" data-bl="'+escA(b.id)+'"></span>':'')+'</div>';}).join('');
    const _cardW=this.offsetWidth||300;
    const icoHtml=(c.icons||[]).map(ico0=>{const ico=tApply(ico0,_tier);const sz=resolveSize(ico.size||'20px',_cardW);const isChip=!!ico.chip;const _ibg=isChip?'border-radius:50%;padding:9px;box-sizing:content-box;':(ico.background?'background:'+ico.background+';border-radius:50%;padding:7px;box-sizing:content-box;':'');const _icoAct=ico.tap_action||ico.hold_action||ico.double_tap_action;const a11y=_icoAct?' tabindex="0" role="button" aria-label="'+escA(ico.id)+'"':'';return'<div class="ico'+(isChip?' ico-chip':'')+'" data-ico="'+escA(ico.id)+'"'+a11y+' style="position:absolute;top:'+ico.top+';left:'+ico.left+';z-index:'+(ico.z_index??6)+';cursor:'+(_icoAct?'pointer':'default')+';-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;'+_ibg+'"><ha-icon data-icoicon="'+escA(ico.id)+'" icon="'+escA(ico.icon||'')+'" style="--mdc-icon-size:'+sz+';width:'+sz+';height:'+sz+';display:flex;color:var(--roc-icon-color,#fff);pointer-events:none;position:relative;z-index:2;"></ha-icon>'+(rocIcoSection(ico)?'<span class="ico-ring" data-ico-ring></span><span class="ico-badge" data-ico-badge></span>':'')+'</div>';}).join('');
    // Overview page markup (OVERVIEW_PLAN.md §3). Dock launchers join c.icons
    // AFTER icoHtml was built, so they get the icon pipeline's listeners and
    // section status (ring, badge) without being drawn on the photo.
    let _ovHtml='',_ovMeta=null;
    if(_ovOn){const _ob=this._ovBuild(cAll,_ovDef,_rt);_ovHtml=_ob.html;_ovMeta=_ob.meta;c.icons=_ovMeta.dockIcons;}
    else if(_ovPh)_ovHtml='<div class="roc-ov-ph"><ha-icon icon="'+escA(((cAll.rooms||[])[this._roomIdx]||{}).icon||'mdi:view-dashboard')+'"></ha-icon></div>';

    const vwHtml=(_isGhost||_isMini)?'':(c.vacuum_widgets||[]).map(vw0=>{
      const vw=tApply(vw0,_tier);
      const vwSz=resolveSize(vw.size||'44px',_cardW);
      const a11y=vw.tap_action?' tabindex="0" role="button" aria-label="'+escA(vw.id)+'"':'';
      return'<div class="vw vw-rest" data-vw="'+escA(vw.id)+'"'+a11y+' style="position:absolute;top:'+vw.top+';left:'+vw.left+';width:'+vwSz+';height:'+vwSz+';z-index:'+(vw.z_index??7)+';cursor:'+(vw.tap_action?'pointer':'default')+';-webkit-tap-highlight-color:transparent;"><div class="vw-bg" data-vwbg="'+escA(vw.id)+'"></div>'+vwIconHtml(vw)+'<span class="vw-count" data-vwc="'+escA(vw.id)+'" style="display:none;"></span></div>';
    }).join('');
    // Geometry in % of the stage (like zones), so a resize handle writes the
    // same units it reads. A circle sets width only and derives its height from
    // aspect-ratio -- a % height would be measured against the stage HEIGHT and
    // turn every circle into an ellipse on a non-square card.
    const _glowGeom=(g)=>{
      const box=(g.shape==='ellipse'||g.shape==='wash');
      return box?('width:'+(g.width||g.size||'25%')+';height:'+(g.height||g.width||g.size||'25%')+';')
                :('width:'+(g.size||g.width||'25%')+';aspect-ratio:1;');
    };
    const glowHtml=(c.glows||[]).map(g0=>{
      const g=tApply(g0,_tier);
      let _fx='position:absolute;inset:0;';
      if(g.shape!=='wash')_fx+='border-radius:50%;';
      else if(g.border_radius)_fx+='border-radius:'+g.border_radius+';';
      if(g.animation==='flicker')_fx+='animation:roc-gw-flicker '+(g.animation_speed||'3.1s')+' ease-in-out infinite;';
      else if(g.animation==='pulse')_fx+='animation:roc-gw-pulse '+(g.animation_speed||'4s')+' ease-in-out infinite;';
      // top/left is the CENTRE of the glow (a lamp is a point, not a box), done
      // with a transform so _makeDraggable/_snapPos keep working on top/left %.
      const _anchor=g.anchor==='corner'?'':'transform:translate(-50%,-50%);';
      return'<div class="glow" data-glow="'+escA(g0.id)+'" style="position:absolute;top:'+(g.top??'50%')+';left:'+(g.left??'50%')+';'+_glowGeom(g)+_anchor+'z-index:'+(g.z_index??2)+';opacity:0;mix-blend-mode:'+(g.blend||'screen')+';transition:opacity '+(g.transition||'0.6s ease')+';"><div class="glow-fx" data-glowfx="'+escA(g0.id)+'" style="'+_fx+'"></div></div>';
    }).join('');
    // Edit mode draws its own un-blended chrome box per glow (drag + resize
    // handles + id tag). Handles parented to the glow itself would inherit its
    // state-driven opacity and be screen-blended into the photo, so the real
    // glow layer stays exactly as it renders on the dashboard and all editing
    // affordances live in this sibling.
    const glowEditHtml=tm?(c.glows||[]).map(g0=>{
      const g=tApply(g0,_tier);
      const _a=g.anchor==='corner'?'':'transform:translate(-50%,-50%);';
      return'<div class="glow-edit" data-glowedit="'+escA(g0.id)+'" style="position:absolute;top:'+(g.top??'50%')+';left:'+(g.left??'50%')+';'+_glowGeom(g)+_a+'z-index:60;border-radius:'+(g.shape==='wash'?'6px':'50%')+';outline:1px dashed rgba(255,214,120,0.95);"><span class="glow-tag">'+escA(g0.id)+'</span></div>';
    }).join(''):'';
    const lblHtml=(c.labels||[]).map(lbl0=>{const lbl=tApply(lbl0,_tier);const fs=resolveSize(lbl.font_size,_cardW)||'clamp(8px,0.8vw,13px)';const ff=lbl.font_family||'monospace';const fw=lbl.font_weight||'bold';const bg=lbl.background||'';const pad=lbl.padding||'';const br=lbl.border_radius||'';const ts=lbl.text_shadow!==undefined?lbl.text_shadow:'0 1px 3px rgba(0,0,0,0.8)';let st='position:absolute;top:'+lbl.top+';left:'+lbl.left+';z-index:'+(lbl.z_index??6)+';pointer-events:none;font-size:'+fs+';font-family:'+ff+';font-weight:'+fw+';white-space:nowrap;color:var(--roc-label-color,#fff);';if(bg)st+='background:'+bg+';';if(pad)st+='padding:'+pad+';';if(br)st+='border-radius:'+br+';';if(ts)st+='text-shadow:'+ts+';';if(lbl.animation==='blink')st+='animation:roc-blink 1s step-end infinite;';else if(lbl.animation==='pulse'){if(lbl.animation_color)st+='--roc-ac:'+lbl.animation_color+';animation:roc-glow 2s ease-in-out infinite;';else st+='animation:roc-pulse 2s ease-in-out infinite;';}return'<div class="lbl" data-lbl="'+escA(lbl.id)+'" style="'+st+'"></div>';}).join('');
    const grpHtml=(c.groups||[]).filter(g=>g.style).map(g=>{const st=g.style;const vis=this._groupState[g.id]??false;return'<div data-grp-panel="'+escA(g.id)+'" style="position:absolute;top:'+(st.top||'0')+';left:'+(st.left||'0')+';width:'+(st.width||'auto')+';height:'+(st.height||'auto')+';z-index:'+(st.z_index||49)+';background:'+(st.background||'transparent')+';border-radius:'+(st.border_radius||'0')+';pointer-events:none;transition:opacity .25s ease,visibility .25s ease;visibility:'+(vis?'visible':'hidden')+';opacity:'+(vis?'1':'0')+';"></div>';}).join('');
    const _wx=c.weather_overlay?(typeof c.weather_overlay==='string'?{entity:c.weather_overlay}:c.weather_overlay):null;
    const wxHtml=_wx?'<div class="layer wx" data-wx style="z-index:'+(_wx.z_index??5)+';opacity:0;"></div>':'';
    // Per-room companion strips above/below the image (normal document flow —
    // mobile friendly). Entry: plain card config or {card, height, media: all|mobile|desktop}
    // media: all | mobile | desktop (legacy = any non-mobile) | tier list (e.g. "tablet,ultrawide")
    const _stripShow=function(media){
      if(!media||media==='all')return true;
      if(media==='mobile'||media==='portrait')return _rt==='portrait';
      if(media==='desktop'||media==='landscape')return _rt==='landscape';
      return String(media).split(',').map(function(s){return s.trim();}).indexOf(_rt)>=0;
    };
    const _stripOne=function(list,attr){
      return(list||[]).map(function(cc,ci){
        if(!_stripShow(cc&&cc.media))return'';
        return'<div '+attr+'="'+ci+'" style="'+(cc&&cc.height?'height:'+cc.height+';':'')+'overflow:visible;"></div>';
      }).join('');
    };
    const _aboveInner=_stripOne(c.cards_above,'data-above-card');
    const _belowInner=_stripOne(c.cards_below,'data-below-card');
    const _aboveHtml=_aboveInner?'<div style="display:flex;flex-direction:column;gap:6px;padding:6px 6px 0;">'+_aboveInner+'</div>':'';
    const _belowHtml=_belowInner?'<div style="display:flex;flex-direction:column;gap:6px;padding:0 6px 6px;">'+_belowInner+'</div>':'';
    // Light controls — material-slider-card strip with a lux-driven border ring.
    // Sliders mount via card helpers (below); the border colour is set from JS
    // through the card's own CSS variables — no card_mod / Jinja needed.
    this._lcCfg=c.light_controls||null;
    const _lcEnts=lcNormEnts(c.light_controls);
    const _lcCols=(c.light_controls&&c.light_controls.columns)||_lcEnts.length||1;
    const _lcHgt=lcResolveHeight(c.light_controls&&c.light_controls.height,_vt);
    const _lcBgOff=(c.light_controls&&c.light_controls.bg_off)||LC_DEF_BG;
    const _lcNative=!!(c.light_controls&&c.light_controls.style==='native');
    const _lcHass=this._hass;
    const _lcHtml=_lcEnts.length?'<div class="roc-lc'+(_lcNative?' roc-lc-native':'')+'" style="display:grid;grid-template-columns:repeat('+_lcCols+',minmax(0,1fr));gap:6px;padding:6px 6px 0;">'+_lcEnts.map(function(e,i){
      if(_lcNative){
        const _st=_lcHass&&_lcHass.states[e.entity];
        const _nm=e.name||(_st&&_st.attributes&&_st.attributes.friendly_name)||e.entity;
        const _ic=e.icon||(lcUsesSlider(e.entity)?'mdi:lightbulb-outline':'mdi:power');
        // the cell is the size container the name-hiding @container rule queries
        return'<div class="roc-lcp-cell"><div class="roc-lcp" data-lcp="'+i+'" tabindex="0" role="button" aria-label="'+escA(_nm)+'" style="height:'+_lcHgt+'px;--lcp-h:'+_lcHgt+'px;--lcp-bg:'+escA(_lcBgOff)+';">'
          +'<div class="roc-lcp-fill" data-lcp-fill></div>'
          +'<span class="roc-lcp-ic"><ha-icon data-lcp-icon icon="'+escA(_ic)+'"></ha-icon></span>'
          +'<span class="roc-lcp-nm">'+escA(_nm)+'</span>'
          +'<span class="roc-lcp-val" data-lcp-val></span>'
          +'</div></div>';
      }
      if(lcUsesSlider(e.entity))return'<div data-lc-card="'+i+'" style="min-width:0;"></div>';
      // on/off toggle pill for switch-like entities — same pill shape + lux ring
      return'<button type="button" class="roc-lctgl" data-lc-toggle="'+i+'" style="min-width:0;width:100%;height:'+_lcHgt+'px;border-radius:999px;border:2px solid transparent;background:'+escA(_lcBgOff)+';color:var(--secondary-text-color);display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;padding:0 8px;font-size:12px;line-height:1;box-sizing:border-box;transition:border-color 0.6s ease-in-out,background 0.3s ease,color 0.3s ease;overflow:hidden;">'
        +'<ha-icon data-lc-ticon icon="mdi:power" style="--mdc-icon-size:16px;flex:0 0 auto;"></ha-icon>'
        +(e.name?'<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escA(e.name)+'</span>':'')
        +'</button>';
    }).join('')+'</div>':'';

    // ---- Cover controls (roleta) — build tap-reveal overlays -------------
    // Minis strip `control:` from every blind already (rocBuildMiniConfig),
    // so _ccList would end up empty anyway — this is defense-in-depth.
    const _ccGhost=_isGhost||_isMini;
    const _ccList=_ccGhost?[]:(c.blinds||[]).map(function(b){return coverControlNorm(tApply(b,_tier),_rt);}).filter(Boolean);
    // A dock needs a placed cover region — otherwise fall back to float so the
    // controller never silently disappears.
    if(!_ccGhost&&!(_lp.place&&_lp.place.cover)){
      let _ccWarned=false;
      _ccList.forEach(function(cc){
        if(cc.placement!=='dock')return;
        cc.placement='float';
        if(!_ccWarned){_ccWarned=true;try{console.warn('[room-overlay-card] cover control placement "dock" but no cover region is placed in the '+_rt+' layout profile — falling back to float (tap-reveal)');}catch(_){}}
      });
    }
    this._ccCfgs=_ccList;
    const _ccPop=_ccList.filter(function(cc){return cc.placement==='float';}).map(function(cc){return coverCtlHtml(cc,_rt==='portrait','float');}).join('');
    const _ccDockHoriz=rocCoverHoriz(_lp);
    const _ccDockHtml=_ccList.filter(function(cc){return cc.placement==='dock';}).map(function(cc){return coverCtlHtml(cc,_ccDockHoriz,'dock');}).join('');
    this._radialMeta={};
    const _allGaugesRC=[...(c.gauges||[]).map(g=>tApply(g,_tier)),...(c.blinds||[]).map(b=>tApply(b,_tier)).flatMap(blindToGaugeConfig)];const gaugeHtml=_allGaugesRC.map(g=>{const bg=g.background||'rgba(0,0,0,0.5)';const br=g.border_radius||'4px';const _gor=g.orientation||'vertical';
    if(_gor==='radial'){
      const arc=Math.max(30,Math.min(360,g.arc??270)),r=42,circ=2*Math.PI*r,arcLen=circ*arc/360;
      const rot=90+(360-arc)/2,th=g.thickness??10;
      this._radialMeta[g.id]={arcLen:arcLen,circ:circ};
      let tgt='';
      if(g.target!==undefined){
        const mn=g.min??0,mx=g.max??100;
        const tp=Math.max(0,Math.min(1,(g.target-mn)/(mx-mn)));
        const ang=(rot+tp*arc)*Math.PI/180;
        const x1=50+(r-th/2-2)*Math.cos(ang),y1=50+(r-th/2-2)*Math.sin(ang);
        const x2=50+(r+th/2+2)*Math.cos(ang),y2=50+(r+th/2+2)*Math.sin(ang);
        tgt='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+escA(g.target_color||'#fff')+'" stroke-width="2.5" stroke-linecap="round"/>';
      }
      return'<div class="gauge gauge-radial" data-gauge="'+escA(g.id)+'" style="position:absolute;top:'+g.top+';left:'+g.left+';width:'+g.width+';height:'+g.height+';z-index:'+(g.z_index??6)+';pointer-events:none;">'
        +'<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block;overflow:visible;">'
        +'<circle cx="50" cy="50" r="'+r+'" fill="none" stroke="'+escA(bg)+'" stroke-width="'+th+'" stroke-linecap="round" stroke-dasharray="'+arcLen.toFixed(2)+' '+circ.toFixed(2)+'" transform="rotate('+rot+' 50 50)"/>'
        +'<circle class="gfill" cx="50" cy="50" r="'+r+'" fill="none" stroke="white" stroke-width="'+th+'" stroke-linecap="round" stroke-dasharray="0 '+circ.toFixed(2)+'" transform="rotate('+rot+' 50 50)" style="transition:stroke-dasharray '+(g.transition||'0.5s ease')+';"/>'
        +tgt+'</svg></div>';
    }const _ghoriz=_gor==='horizontal'||_gor==='right';const defTr=_ghoriz?'width 0.5s ease':'height 0.5s ease';const tr=g.transition||defTr;let fillSt;if(g._dayNight){const _dtr=g.transition||'height 0.5s ease';const _bgTr=_dtr.replace(/^\S+\s+/,'');fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:transparent;background-repeat:repeat;background-size:100% auto;transition:'+_dtr+',background-position-y '+_bgTr+';';}else if(_gor==='top')fillSt='position:absolute;top:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';else if(_gor==='right')fillSt='position:absolute;top:0;right:0;bottom:0;width:0%;background:white;transition:'+tr+';';else if(_gor==='horizontal')fillSt='position:absolute;top:0;left:0;bottom:0;width:0%;background:white;transition:'+tr+';';else fillSt='position:absolute;bottom:0;left:0;right:0;height:0%;background:white;transition:'+tr+';';return'<div class="gauge" data-gauge="'+escA(g.id)+'" style="position:absolute;top:'+g.top+';left:'+g.left+';width:'+g.width+';height:'+g.height+';z-index:'+(g.z_index??6)+';pointer-events:none;background:'+bg+';border:1px solid rgba(255,255,255,0.12);border-radius:'+br+';overflow:hidden;"><div class="gfill" style="'+fillSt+'"></div></div>';}).join('');
    // ---- Layout grid: wrap every placed region ---------------------------
    const _regDiv=function(rg,inner){
      const pl=_lp.place&&_lp.place[rg];
      if(!pl)return''; // region not placed in this profile → hidden
      // Empty region (this room has no content for it) → render nothing. Rooms
      // can therefore SHARE a cell (e.g. cards_above + lights on the same row)
      // and 'auto' rows collapse to 0 where a room has no strip. Test mode still
      // shows the cell outline (non-interactive) so the grid stays visible.
      if(!inner&&!tm)return'';
      return'<div class="roc-reg" data-reg="'+rg+'" style="'+rocRegionCss(pl)+(inner?'':'pointer-events:none;')+(tm?'outline:1px dashed rgba(255,110,110,0.85);outline-offset:-1px;':'')+'">'+inner+(tm?'<div class="roc-regtag">'+rg+'</div>':'')+'</div>';
    };
    const _regInner={nav:navHtml,cards_above:_aboveHtml,lights:_lcHtml,cards_below:_belowHtml,cover:_ccDockHtml?'<div class="roc-ccdock'+(_ccDockHoriz?' ccd-h':'')+'">'+_ccDockHtml+'</div>':''};
    let _regPost='';
    ['nav','cards_above','lights','cards_below','cover'].forEach(function(rg){_regPost+=_regDiv(rg,_regInner[rg]);});
    const _imgPl=(_lp.place&&_lp.place.image)||{row:1,col:1};
    // image row 'auto' → intrinsic height from the design aspect (refined to the
    // image's natural ratio by _layoutStage once it loads under lock_aspect)
    // Mini: _rootH is 'auto', so the image box needs its own intrinsic size —
    // lock it to the room's design aspect ratio at the fixed reference width
    // (NAV_LIVE_FULL_PLAN.md §6), same mechanism natural-portrait already uses.
    const _wrapAspect=(rocImgAutoRow(_lp)||_naturalRoot||_isMini||c._roc_preview||_isStubCard)?' style="height:auto;aspect-ratio:'+(rocRatio(_arResolved)||16/9).toFixed(4)+';"':'';
    const _regPre='<div class="roc-reg" data-reg="image" style="'+rocRegionCss(_imgPl)+(tm?'outline:1px dashed rgba(255,110,110,0.85);outline-offset:-1px;':'')+'">';
    // ----- Cockpit sections: panel chrome (v6.8.0) --------------------------
    // One panel node per declared section (COCKPIT_PLAN.md kap.4 asks for a
    // single reused element; N cheap hidden divs toggled by visibility is the
    // same idiom `groups`/`grpHtml`+`_setGrpVis` already use elsewhere in this
    // file, so it stays consistent with the rest of the renderer instead of
    // introducing a second DOM-reuse mechanism). Suppressed for swipe ghosts
    // and nav.live minis, same as vacuum_widgets above.
    const _secList=(_isGhost||_isMini)?[]:this._getSections(cAll);
    const _secOpenId=this._sectionOpen;
    // Auto tiles (v6.10.0): merge `source: auto`+`domain:` entities (from
    // hass.states, deduped against this section's own collected tiles) onto
    // the end of each section's tile list, ONCE per _render() -- never per
    // state tick (kap.4). Cached on the instance so _updateSectionTiles(),
    // the tile click wiring below and _setupTemplates() all iterate the
    // exact same array the DOM was built from (index-stable).
    const _secResolved={};
    _secList.forEach((sx)=>{
      const d=sx.def;
      let tiles=sx.tiles;
      if(d.source==='auto'&&d.domain){
        const already=new Set(tiles.map(function(t){return rocTileDef(t).entity;}).filter(Boolean));
        tiles=tiles.concat(rocAutoTiles(d,this._hass,already));
      }
      _secResolved[d.id]=tiles;
    });
    this._secResolvedTiles=_secResolved;
    // Image tile stage (v6.9.0, D3 scheme b) -- a tiny independent room: its
    // own base image plus absolutely-positioned overlay layers, laid out and
    // animated by the SAME markup shape as a room's own `ovHtml` above (see
    // _updateSectionTiles() for the matching update-time resolvers). Never a
    // nested room-overlay-card (COCKPIT_PLAN.md kap.4).
    const _tileStageHtml=function(td){
      const ovHtmlT=(td.overlays||[]).map(function(ov,oi){
        const _tf=ov.transform;
        const _tfSt=_tf?('transform-origin:'+(_tf.origin||'50% 50%')+';will-change:transform;'+(_tf.perspective?'transform-style:preserve-3d;':'')):'';
        const _tfTr=_tf?(',transform '+(_tf.transition||'0.8s ease')):'';
        return'<div class="roc-tile-ov" data-tile-ov="'+oi+'" style="z-index:'+(ov.z_index??oi+1)+';opacity:0;'+_tfSt+'transition:opacity '+(ov.transition??'2s ease')+',filter '+(ov.transition??'2s ease')+_tfTr+';"></div>';
      }).join('');
      const _stageSt=td.image_ratio?('aspect-ratio:'+td.image_ratio+';'):'';
      return'<div class="roc-tile-img-stage" style="'+_stageSt+'"><div class="roc-tile-img-base" style="'+(td.image?'background-image:url(\''+escUrl(td.image)+'\');':'')+'"></div>'+ovHtmlT+'</div>';
    };
    const _secTileHtml=function(entry,idx){
      const td=rocTileDef(entry);
      const isImg=!!td.image;
      const quickHtml=(td.quick||[]).map(function(q,qi){
        return'<button type="button" data-quick="'+qi+'" title="'+escA(q.name||'')+'"><ha-icon icon="'+escA(q.icon||'mdi:play')+'"></ha-icon></button>';
      }).join('');
      return'<div class="roc-tile'+(isImg?' roc-tile-img':'')+'" data-tile-idx="'+idx+'"'+((td.tap_action||td.hold_action||td.double_tap_action)?' data-tappable tabindex="0" role="button"':'')+'>'
        +(isImg?_tileStageHtml(td):'<div class="roc-tile-icon-wrap"><ha-icon class="roc-tile-icon" data-tile-icon icon="'+escA(td.icon)+'"></ha-icon></div>')
        +'<div class="roc-tile-body">'
          +'<div class="roc-tile-name">'+escA(td.name)+'</div>'
          +'<div class="roc-tile-state" data-tile-state></div>'
          +'<div class="roc-tile-value" data-tile-value></div>'
          +(td.progress?'<div class="roc-tile-progress"><div class="roc-tile-progress-bar" data-tile-progress></div></div>':'')
        +'</div>'
        +(quickHtml?'<div class="roc-tile-quick">'+quickHtml+'</div>':'')
      +'</div>';
    };
    // Degradation (COCKPIT_PLAN.md kap.6): an embedded `card:` source gets its
    // own mount host (wired up like `elements` below); no tiles + no card = an
    // explanatory empty state, never a blank panel.
    const _secPanelBodyHtml=function(sx){
      const d=sx.def;
      const tiles=_secResolved[d.id]||sx.tiles;
      const tilesHtml=tiles.length?tiles.map(_secTileHtml).join(''):'';
      const cardHtml=d.card?'<div class="roc-card-tile-host" data-section-card="'+escA(d.id)+'"></div>':'';
      if(!tilesHtml&&!cardHtml)return'<div class="roc-panel-empty">Nothing here yet — tag an element in this room with <code>section: '+escA(d.id)+'</code>.</div>';
      return tilesHtml+cardHtml;
    };
    const secPanelHtml=!_secList.length?'':(
      '<div class="roc-panel-backdrop'+(_secOpenId?' open':'')+(_rt==='portrait'?' roc-pm':'')+'" data-section-backdrop></div>'
      +_secList.map(function(sx){
        const d=sx.def,isOpen=d.id===_secOpenId,placement=d.placement||'sheet-right',cols=d.columns||2;
        const sizeStyle=d.size?('--roc-panel-size:'+d.size+';'):'';
        // Portrait (phone): every panel covers the whole screen (v6.24.1) —
        // inside the card it was clipped to the image region, often a strip a
        // few hundred px tall. `placement_portrait: inline` keeps the old way.
        const _pm=_rt==='portrait'&&d.placement_portrait!=='inline';
        return'<div class="roc-panel pl-'+escA(placement)+(_pm?' roc-pm':'')+(d.columns?' roc-cols-set':'')+(isOpen?' open':'')+'" data-section-panel="'+escA(d.id)+'" style="'+sizeStyle+'--roc-panel-cols:'+cols+';" role="dialog"'+(d.backdrop!==false||placement==='full'||_pm?' aria-modal="true"':'')+' aria-label="'+escA(d.title||d.id)+'">'
          +'<div class="roc-panel-hd">'
            +(d.icon?'<ha-icon icon="'+escA(d.icon)+'"></ha-icon>':'')
            +'<div class="roc-panel-hd-txt"><div class="roc-panel-title">'+escA(d.title||d.id)+'<span class="roc-panel-badge" data-section-badge></span></div>'
            +(d.subtitle?'<div class="roc-panel-subtitle">'+escA(d.subtitle)+'</div>':'')+'</div>'
            +'<button class="roc-panel-close" type="button" aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button>'
          +'</div>'
          +'<div class="roc-panel-body">'+_secPanelBodyHtml(sx)+'</div>'
        +'</div>';
      }).join('')
    );
    // Persistent nav (v6.23.0): on a room switch (_switchRoom sets _navKeep)
    // whose nav markup is unchanged apart from the active room, the existing
    // strip — thumbnails, chips, live mini cards, nav cards — is carried over
    // into the new DOM instead of being rebuilt; that rebuild (re-mounting
    // up to one full mini card per room) was most of a room switch's cost.
    let _navOld=(this._navKeep&&navHtml&&this._navKey===_navKey&&this.shadowRoot)?this.shadowRoot.querySelector('.roc-nav'):null;
    let _navScroll=_navOld?[_navOld.scrollLeft,_navOld.scrollTop]:null;
    // Overview page (v6.30.0): it shows no strip, so the strip of the room we
    // came from is parked (detached, its minis no longer fed hass) and put back
    // on the way out — leaving the overview costs no re-mount of every mini.
    this._navRestore=null;
    if(!this._navKeep||(this._navStash&&this._navStash.key!==_navKey))this._dropNavStash();
    if(_ovOn&&_navOld){
      this._dropNavStash();
      this._navStash={el:_navOld,key:_navKey,scroll:_navScroll,thumbs:this._navThumbEls,chips:this._navChipEls,cards:this._navCardEls,minis:this._navMiniEls,ro:this._navMiniRo,follow:this._navFollowEl};
      this._navMiniRo=null;this._navMiniEls={};this._navCardEls=[];_navOld=null;_navScroll=null;
    }else if(!_ovOn&&!_navOld&&this._navKeep&&navHtml&&this._navStash&&this._navStash.key===_navKey){
      _navOld=this._navStash.el;_navScroll=this._navStash.scroll||[0,0];this._navRestore=this._navStash;this._navStash=null;
    }
    this._navKey=_navKey;
    this.shadowRoot.innerHTML='<style>:host{display:block;--roc-active-c:var(--roc-active,#ffb35c);--roc-cold-c:var(--roc-cold,#6cb8ff);--roc-alert-c:var(--roc-alert,#ff7a6e);--roc-surface-c:var(--roc-surface,rgba(20,22,26,.85));--roc-border-c:var(--roc-border,rgba(255,255,255,.08));--roc-text-c:var(--roc-text,#f2f3f5);--roc-text-2-c:var(--roc-text-2,#9aa3ad);--roc-chip-bg-c:var(--roc-chip-bg,rgba(10,12,15,.55));}@keyframes roc-pulse{0%,100%{opacity:1}50%{opacity:.25}}@keyframes roc-glow{0%,100%{opacity:1;filter:drop-shadow(0 0 0px var(--roc-ac,transparent))}50%{opacity:.7;filter:drop-shadow(0 0 8px var(--roc-ac,rgba(255,0,0,.6)))}}@keyframes roc-blink{0%,49.9%{opacity:1}50%,100%{opacity:0}}@keyframes roc-gw-flicker{0%,100%{opacity:1}8%{opacity:.72}14%{opacity:.96}22%{opacity:.62}30%{opacity:1}44%{opacity:.8}52%{opacity:.98}66%{opacity:.7}78%{opacity:.93}90%{opacity:.78}}@keyframes roc-gw-pulse{0%,100%{opacity:1}50%{opacity:.62}}@keyframes roc-tf-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes roc-tf-spin-x{from{transform:rotateX(0deg)}to{transform:rotateX(360deg)}}@keyframes roc-tf-spin-y{from{transform:rotateY(0deg)}to{transform:rotateY(360deg)}}.glow{pointer-events:none;will-change:opacity;}.glow-fx{pointer-events:none;}.glow-edit{pointer-events:auto;box-sizing:border-box;overflow:visible;-webkit-tap-highlight-color:transparent;}.glow-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#ffd67a;font:600 10px/1.5 monospace;padding:1px 6px;border-radius:6px;white-space:nowrap;pointer-events:none;}@keyframes roc-vac-drive{0%,100%{transform:translateX(0) rotate(0deg)}25%{transform:translateX(-9%) rotate(-7deg)}75%{transform:translateX(9%) rotate(7deg)}}@keyframes roc-vac-ripple{0%{transform:scale(.55);opacity:.9}100%{transform:scale(1.5);opacity:0}}@keyframes roc-vac-duo{0%,40%{background:#f5a623;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 10px rgba(245,166,35,.6)}50%,90%{background:#03a9f4;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 10px rgba(3,169,244,.6)}100%{background:#f5a623;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 10px rgba(245,166,35,.6)}}@keyframes roc-vac-mop{0%,100%{transform:translateX(0)}30%{transform:translateX(-11%)}70%{transform:translateX(11%)}}@keyframes roc-vac-duo-icon{0%,100%{transform:translateX(0) rotate(0deg)}10%{transform:translateX(-9%) rotate(-7deg)}30%{transform:translateX(9%) rotate(7deg)}40%,50%{transform:translateX(0) rotate(0deg)}65%{transform:translateX(-11%) rotate(0deg)}85%{transform:translateX(11%) rotate(0deg)}}@keyframes roc-border-pulse{0%,100%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8)),inset 0 0 8px var(--roc-ac,rgba(255,0,0,.3))}50%{box-shadow:inset 0 0 0 2px transparent,inset 0 0 0 transparent}}@keyframes roc-border-blink{0%,49.9%{box-shadow:inset 0 0 0 2px var(--roc-ac,rgba(255,0,0,.8))}50%,100%{box-shadow:none}}@keyframes roc-rain{from{background-position:0 0,0 0}to{background-position:-60px 240px,-30px 120px}}@keyframes roc-snow{0%{background-position:0 0,40px 60px,20px 30px}100%{background-position:90px 280px,-50px 340px,110px 240px}}@keyframes roc-snow-heavy{0%{background-position:0 0,30px 40px,15px 20px}100%{background-position:70px 220px,-40px 250px,70px 160px}}@keyframes roc-fog{0%{background-position:0 0,0 0}100%{background-position:340px 0,-260px 0}}@keyframes roc-flash{0%,91.5%,94.2%,100%{opacity:0}92%,92.6%{opacity:.85}93.4%{opacity:.35}}.wx{transition:opacity 1.5s ease;}.wx-rain{background-image:repeating-linear-gradient(var(--roc-rain-angle,105deg),rgba(255,255,255,0.16) 0px,rgba(255,255,255,0.16) 1px,transparent 1px,transparent 26px),repeating-linear-gradient(calc(var(--roc-rain-angle,105deg) - 5deg),rgba(255,255,255,0.10) 0px,rgba(255,255,255,0.10) 1px,transparent 1px,transparent 17px);background-size:60px 240px,30px 120px;animation:roc-rain 0.55s linear infinite;}.wx-rain.wx-heavy{background-size:42px 200px,22px 100px;animation-duration:0.32s;}.wx-snow{background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.95) 0 2.2px,rgba(255,255,255,0.35) 3px,transparent 4.2px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.85) 0 1.7px,rgba(255,255,255,0.3) 2.4px,transparent 3.4px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.65) 0 1.2px,transparent 2.4px);background-size:90px 140px,90px 140px,90px 105px;animation:roc-snow 9s linear infinite;}.wx-snow.wx-heavy{background-image:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.95) 0 2.6px,rgba(255,255,255,0.4) 3.6px,transparent 5px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.85) 0 2px,rgba(255,255,255,0.32) 2.8px,transparent 4px),radial-gradient(circle at 50% 50%,rgba(255,255,255,0.65) 0 1.4px,transparent 2.8px);background-size:70px 110px,70px 105px,55px 70px;animation:roc-snow-heavy 5.5s linear infinite;}.wx-fog{background-image:radial-gradient(ellipse 60% 40% at 30% 55%,rgba(255,255,255,0.22) 0%,transparent 70%),radial-gradient(ellipse 70% 45% at 75% 40%,rgba(255,255,255,0.16) 0%,transparent 70%);background-size:340px 100%,420px 100%;background-repeat:repeat-x;animation:roc-fog 60s linear infinite;}.wx-lightning::after{content:"";position:absolute;inset:0;background:rgba(255,255,255,0.95);opacity:0;animation:roc-flash 7s linear infinite;pointer-events:none;}@keyframes roc-holdfill{to{stroke-dashoffset:0;}}@keyframes roc-holdpop{0%{transform:rotate(-90deg) scale(1);}45%{transform:rotate(-90deg) scale(1.18);}100%{transform:rotate(-90deg) scale(1);}}.roc-hold{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;z-index:300;pointer-events:none;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.55));}.roc-hold svg{width:100%;height:100%;transform:rotate(-90deg);}.roc-hold circle{fill:none;stroke-width:3;}.roc-hold-trk{stroke:rgba(255,255,255,0.22);}.roc-hold-bar{stroke:var(--roc-hold-color,var(--primary-color,#03a9f4));stroke-linecap:round;stroke-dasharray:100.53;stroke-dashoffset:100.53;animation:roc-holdfill var(--roc-hold-dur,500ms) linear forwards;}.roc-hold.done svg{animation:roc-holdpop 0.3s ease;}.roc-hold.done .roc-hold-bar{stroke-dashoffset:0;stroke:var(--roc-hold-done-color,#37d67a);}.roc-gd{position:absolute;background:var(--primary-color,#03a9f4);z-index:998;display:none;pointer-events:none;}.roc-gd-h{left:0;right:0;height:1px;}.roc-gd-v{top:0;bottom:0;width:1px;}.zone,.badge,.ico,.lbl,.gauge,.elcont{transition:opacity .25s ease,visibility .25s ease,transform .25s ease;}ha-card{overflow:hidden;padding:0!important;background:transparent;border-radius:'+br+';display:block;transition:none;}.roc-reg{box-sizing:border-box;}.roc-regtag{position:absolute;top:2px;left:2px;z-index:400;background:rgba(190,45,45,0.85);color:#fff;font:bold 10px monospace;padding:1px 5px;border-radius:4px;pointer-events:none;}.roc-ccdock{display:flex;gap:8px;width:100%;height:100%;padding:6px;box-sizing:border-box;}.roc-ccdock.ccd-h{flex-direction:column;}.wrap{position:relative;width:100%;height:100%;overflow:hidden;}.content{position:absolute;inset:0;overflow:hidden;}.layer{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;}.zone{position:absolute;outline:none;}.zone:focus-visible,.ico:focus-visible,.lbl:focus-visible,.gauge:focus-visible{outline:2px solid var(--primary-color,#03a9f4);outline-offset:2px;}.zlabel{position:absolute;top:2px;left:4px;font-size:10px;color:red;font-weight:bold;pointer-events:none;text-shadow:0 0 3px white;white-space:nowrap;}.badge{position:absolute;z-index:100;display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px 10px;white-space:nowrap;user-select:none;}.blabel{font-size:12px;color:white;font-weight:500;}.elcont{position:absolute;pointer-events:auto;}.elcont>*{width:100%!important;height:100%!important;display:block;}.vw{display:flex;align-items:center;justify-content:center;border-radius:50%;user-select:none;transition:transform .15s ease;transform:translateZ(0);}.vw:active{transform:scale(.92) translateZ(0);}.vw-bg{position:absolute;inset:0;border-radius:50%;background:rgba(255,255,255,.16);box-shadow:0 3px 8px rgba(0,0,0,.4);transition:background .6s ease,box-shadow .6s ease;}.vw-bg::before{content:"";position:absolute;inset:3px;border-radius:50%;background:rgba(25,25,28,.62);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 1px rgba(255,255,255,.14),inset 0 -2px 4px rgba(0,0,0,.25);transform:translateZ(0);}.vw-rest .vw-bg{background:rgba(255,255,255,.16);}.vw-rest .vw-icon{opacity:.7;}.vw-dry .vw-bg{background:#f5a623;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 10px rgba(245,166,35,.55);}.vw-dry .vw-icon{animation:roc-vac-drive 1.1s ease-in-out infinite;}.vw-wet .vw-bg{background:#03a9f4;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 10px rgba(3,169,244,.55);}.vw-wet .vw-bg::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(3,169,244,.65);animation:roc-vac-ripple 1.6s ease-out infinite;}.vw-wet .vw-icon{animation:roc-vac-mop 1.8s ease-in-out infinite;}.vw-both .vw-bg{animation:roc-vac-duo 2.4s ease-in-out infinite;}.vw-both .vw-icon{animation:roc-vac-duo-icon 2.4s ease-in-out infinite;}.vw-active .vw-bg{background:rgba(3,169,244,.55);--roc-ac:rgba(3,169,244,.55);animation:roc-glow 2.2s ease-in-out infinite;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 10px rgba(3,169,244,.4);}.vw-error .vw-bg{background:#e74c3c;box-shadow:0 3px 8px rgba(0,0,0,.4),0 0 12px rgba(231,76,60,.65);}.vw-error .vw-icon{animation:roc-blink 1s step-end infinite;}.vw-count{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:#e74c3c;color:#fff;font:bold 10px/16px sans-serif;text-align:center;z-index:3;pointer-events:none;box-shadow:0 0 0 2px rgba(0,0,0,.6);}.ico.ico-ring{display:none;position:absolute;inset:-3px;border-radius:50%;z-index:3;pointer-events:none;background:conic-gradient(var(--roc-active-c) 0 var(--p,0%),rgba(255,255,255,.14) var(--p,0%) 100%);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));}.ico-badge{position:absolute;top:-4px;right:-4px;z-index:4;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:var(--roc-active-c);color:#1a1206;font-size:11px;font-weight:700;line-height:18px;text-align:center;pointer-events:none;}.ico-badge:empty{display:none;}.roc-lcp-cell{min-width:0;container-type:inline-size;}.roc-lcp{position:relative;box-sizing:border-box;width:100%;border-radius:999px;border:2px solid var(--roc-border-c);background:var(--lcp-bg,#16191d);overflow:hidden;display:flex;align-items:center;gap:8px;padding:0 12px 0 3px;color:var(--roc-text-c);font-size:13px;line-height:1;cursor:pointer;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:border-color .6s ease-in-out;}.roc-lcp.unavailable{opacity:.5;}.roc-lcp-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:var(--lcp-col,rgba(255,179,92,.55));transition:width .3s ease,background-color .4s ease;pointer-events:none;}.roc-lcp.dragging .roc-lcp-fill{transition:none;}.roc-lcp-ic{position:relative;flex:none;width:calc(min(var(--lcp-h,30px) - 8px,34px));height:calc(min(var(--lcp-h,30px) - 8px,34px));border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.18);color:var(--roc-text-2-c);box-sizing:border-box;--mdc-icon-size:calc(min(var(--lcp-h,30px) - 8px,34px) * .6);}.roc-lcp.on .roc-lcp-ic{background:var(--lcp-solid,#ffb35c);border-color:transparent;color:#1a1206;}.roc-lcp-nm{position:relative;flex:1;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.roc-lcp-val{position:relative;flex:none;font-variant-numeric:tabular-nums;color:var(--roc-text-2-c);}.roc-lcp.on .roc-lcp-val{color:var(--roc-text-c);font-weight:500;}.roc-lcp:focus-visible{outline:2px solid var(--roc-text-c);outline-offset:2px;}@container (max-width:120px){.roc-lcp-nm{display:none;}.roc-lcp{justify-content:space-between;}}.roc-navchip{background:var(--roc-chip-bg-c);border-radius:4px;padding:1px 5px;}.roc-nav.roc-dim .roc-thumb:not([data-act]){opacity:.8;}.roc-nav.roc-dim .roc-thumb:hover{opacity:1;}.ico-chip{box-shadow:0 3px 8px rgba(0,0,0,.4);}.ico.ico-chip::before{content:"";position:absolute;inset:0;border-radius:50%;background:rgba(255,255,255,.16);}.ico.ico-chip::after{content:"";position:absolute;inset:3px;border-radius:50%;background:rgba(25,25,28,.62);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);border:1px solid rgba(255,255,255,.16);box-shadow:inset 0 1px 1px rgba(255,255,255,.14),inset 0 -2px 4px rgba(0,0,0,.25);}'+CC_CSS+'.roc-panel-backdrop{position:absolute;inset:0;z-index:400;background:rgba(0,0,0,0.45);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;}@media (prefers-reduced-motion:reduce){*:not(.roc-hold):not(.roc-hold *){animation:none!important;}.roc-panel,.roc-panel-backdrop,.content{transition:none!important;}.roc-panel.pl-sheet-right,.roc-panel.pl-sheet-bottom{transform:none!important;}}.roc-panel-backdrop.open{opacity:1;visibility:visible;}.roc-panel{position:absolute;z-index:401;background:var(--card-background-color,#1c1c1c);color:var(--primary-text-color,#fff);box-shadow:0 8px 30px rgba(0,0,0,0.5);display:flex;flex-direction:column;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .25s ease,visibility .25s ease,transform .25s ease;}.roc-panel.open{opacity:1;visibility:visible;pointer-events:auto;}.roc-panel.roc-pm[data-section-panel]{position:fixed;inset:0;width:auto;height:auto;max-height:none;border-radius:0;transform:translateY(14px);padding-bottom:env(safe-area-inset-bottom,0px);}.roc-panel.roc-pm.open[data-section-panel]{transform:none;}.roc-panel-backdrop.roc-pm{position:fixed;}.roc-panel.pl-sheet-right{top:0;right:0;bottom:0;width:min(var(--roc-panel-size,420px),92%);border-radius:12px 0 0 12px;transform:translateX(14px);}.roc-panel.pl-sheet-right.open{transform:translateX(0);}.roc-panel.pl-sheet-bottom{left:0;right:0;bottom:0;max-height:min(var(--roc-panel-size,80%),86%);border-radius:12px 12px 0 0;transform:translateY(14px);}.roc-panel.pl-sheet-bottom.open{transform:translateY(0);}.roc-panel.pl-full{inset:0;border-radius:0;}.roc-panel.pl-dialog{top:50%;left:50%;width:min(var(--roc-panel-size,620px),92%);max-height:80%;border-radius:12px;transform:translate(-50%,-46%);}.roc-panel.pl-dialog.open{transform:translate(-50%,-50%);}.roc-panel-hd{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--divider-color,rgba(255,255,255,0.12));flex:none;}.roc-panel-hd>ha-icon{--mdc-icon-size:22px;color:var(--primary-color,#03a9f4);flex:none;}.roc-panel-hd-txt{flex:1;min-width:0;}.roc-panel-title{font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.roc-panel-subtitle{font-size:12px;color:var(--secondary-text-color);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.roc-panel-badge{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--roc-active-c);color:#1a1206;font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none;}.roc-panel-badge:empty{display:none;}.roc-panel-close{background:none;border:none;color:var(--primary-text-color,#fff);cursor:pointer;padding:4px;flex:none;border-radius:50%;display:flex;-webkit-tap-highlight-color:transparent;}.roc-panel-body{flex:1;overflow-y:auto;padding:14px 16px;display:grid;gap:10px;grid-template-columns:repeat(var(--roc-panel-cols,2),minmax(0,1fr));align-content:start;}@media (max-width:640px){.roc-panel:not(.roc-cols-set) .roc-panel-body{grid-template-columns:1fr;}}.roc-panel-empty,.roc-panel-notice{grid-column:1/-1;font-size:13px;color:var(--secondary-text-color);text-align:center;padding:22px 8px;}.roc-panel-notice{border:1px dashed var(--divider-color,rgba(255,255,255,0.2));border-radius:8px;}.roc-panel-notice a{color:var(--primary-color,#03a9f4);}.roc-tile{position:relative;display:flex;gap:10px;align-items:center;background:var(--secondary-background-color,rgba(255,255,255,0.06));border-radius:10px;padding:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:left;}.roc-tile.unavailable{opacity:0.55;}.roc-tile:not([data-tappable]){cursor:default;}.roc-tile-icon-wrap{flex:none;width:38px;height:38px;border-radius:50%;background:rgba(127,127,127,0.16);display:flex;align-items:center;justify-content:center;}.roc-tile-icon-wrap ha-icon{--mdc-icon-size:20px;color:var(--roc-icon-color,inherit);}.roc-tile-img{flex-direction:column;align-items:stretch;}.roc-tile-img-stage{position:relative;width:100%;aspect-ratio:4/3;border-radius:8px;overflow:hidden;background:rgba(127,127,127,0.12);flex:none;}.roc-tile-img-base{position:absolute;inset:0;background-size:cover;background-position:center;}.roc-tile-ov{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none;}.roc-tile-icon.tia-spin{animation:roc-tf-spin 2.2s linear infinite;}.roc-tile-icon.tia-pulse{animation:roc-pulse 2s ease-in-out infinite;}.roc-tile-icon.tia-blink{animation:roc-blink 1s step-end infinite;}.roc-tile-body{min-width:0;flex:1;}.roc-tile-name{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.roc-tile-state{font-size:12px;color:var(--secondary-text-color);min-height:14px;}.roc-tile-state.ts-run{color:var(--roc-active-c);font-weight:500;}.roc-tile.is-active{box-shadow:inset 0 0 0 1px var(--roc-active-c);}.roc-tile.is-active .roc-tile-progress-bar{background:var(--roc-active-c);}.roc-tile-state.ts-done{color:#37d67a;}.roc-tile-value{font-size:12px;margin-top:2px;}.roc-tile-value:empty{display:none;}.roc-tile-progress{height:4px;border-radius:2px;background:rgba(127,127,127,0.25);margin-top:6px;overflow:hidden;}.roc-tile-progress-bar{height:100%;background:var(--primary-color,#03a9f4);width:0%;transition:width .5s ease;}.roc-tile-quick{display:flex;flex-direction:column;gap:4px;flex:none;}.roc-tile-img .roc-tile-quick{flex-direction:row;flex-wrap:wrap;justify-content:center;margin-top:2px;}.roc-tile-quick button{background:rgba(127,127,127,0.18);border:none;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:inherit;cursor:pointer;--mdc-icon-size:15px;}.roc-card-tile-host{border-radius:10px;overflow:hidden;grid-column:1/-1;}'+(_ovAny?ROC_OV_CSS:'')+'</style>'+(this._rocExtraCss?'<style class="roc-xcss">'+this._rocExtraCss+'</style>':'')+'<ha-card style="height:'+_rootH+';"><div class="roc-grid" style="'+rocGridCss(_lp,(cAll.layout&&cAll.layout.gap)||'')+'">'+_regPre+'<div class="wrap"'+_wrapAspect+'><div class="content"'+(_ovOn?' style="position:absolute;inset:0;"':'')+'><div class="layer base" style="'+(c.base_image?'background-image:url(\''+escUrl(c.base_image)+'\');':'')+'transition:filter '+(c.filter_transition??'2s ease')+';will-change:filter,transform;transform:translateZ(0);"></div>'+_ovHtml+glowHtml+ovHtml+wxHtml+grpHtml+zHtml+bHtml+icoHtml+vwHtml+glowEditHtml+lblHtml+gaugeHtml+_ccPop+(tm?'<div class="tm-info" style="position:absolute;top:6px;left:6px;z-index:200;background:rgba(0,0,0,0.72);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:6px;padding:4px 8px;font-size:11px;font-weight:bold;font-family:monospace;line-height:1.35;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;pointer-events:none;">&#128208; '+Math.round(this._vpW())+'&#215;'+Math.round(this._vpH())+'<br><span style="font-weight:normal;opacity:0.85;">profile: '+_rt+'</span></div><button class="tm-flip" style="position:absolute;top:6px;right:6px;z-index:200;background:'+(this._testFlipped?'rgba(220,80,0,0.9)':'rgba(0,0,0,0.72)')+';color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#8644; '+(this._testFlipped?'FLIPPED':'FLIP')+'</button>'+(c._roc_studio?'':'<button class="tm-prof" style="position:absolute;top:6px;right:96px;z-index:200;background:'+(this._profFlipped?'rgba(30,90,160,0.92)':'rgba(0,0,0,0.72)')+';color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#8645; '+_rt.toUpperCase()+'</button>')+''+(c._roc_preview||c._roc_studio?'':'<button class="tm-studio" title="Open the full-screen Room Card Studio" style="position:absolute;top:38px;right:96px;z-index:200;background:rgba(40,70,140,0.88);color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#9998; Studio</button><button class="tm-save" style="position:absolute;top:38px;right:6px;z-index:200;background:rgba(20,100,20,0.82);color:#fff;border:1px solid rgba(255,255,255,0.35);border-radius:6px;padding:4px 12px;font-size:11px;font-weight:bold;cursor:pointer;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);user-select:none;letter-spacing:0.04em;">&#128190; Save</button>'):'')+'</div>'+secPanelHtml+'</div>'+(tm?'<div class="roc-regtag">image</div>':'')+'</div>'+_regPost+'</div></ha-card>';

    // Structural refs the layout engine measures every pass — cached here
    // (see _elWrap/_elContent/_elCard) instead of re-queried per call.
    this._contentEl=this.shadowRoot.querySelector('.content');
    if(this._config&&this._config._roc_mini&&this._miniScale>0)this._hqRefresh(); // v6.25.0: a re-render re-wrote the base URL
    this._wrapEl=this.shadowRoot.querySelector('.wrap');
    this._cardEl=this.shadowRoot.querySelector('ha-card');
    const content=this._contentEl;
    this._baseEl=this.shadowRoot.querySelector('.base');
    this._tmInfoEl=tm?this.shadowRoot.querySelector('.tm-info'):null;
    this._wxEl=this.shadowRoot.querySelector('[data-wx]');
    // Corner badges & test-mode controls must pin to the VISIBLE box (.wrap),
    // not to .content — under lock_aspect .content is a larger cover-stage that
    // overflows the box, so bottom/top-anchored chips would fall off-screen.
    const _wrapBox=this.shadowRoot.querySelector('.wrap');
    if(_wrapBox)this.shadowRoot.querySelectorAll('.content > .badge, .content > .tm-info, .content > .tm-flip, .content > .tm-prof, .content > .tm-studio, .content > .tm-save').forEach(function(el){_wrapBox.appendChild(el);});
    // ---- Nav wiring -------------------------------------------------------
    let _navReused=false;
    if(_navOld){
      const _navNew=this.shadowRoot.querySelector('.roc-nav');
      if(_navNew){
        _navNew.replaceWith(_navOld);
        _navOld.scrollLeft=_navScroll[0];_navOld.scrollTop=_navScroll[1];
        _navReused=true;
        const _nr=this._navRestore;this._navRestore=null;
        if(_nr){
          if(this._navMiniRo)this._navMiniRo.disconnect();
          this._navThumbEls=_nr.thumbs;this._navChipEls=_nr.chips;this._navCardEls=_nr.cards;this._navMiniEls=_nr.minis;this._navMiniRo=_nr.ro;this._navFollowEl=_nr.follow;
          // Fresh states reach the parked minis after the switch's own frames
          // (a zoom out of the overview must not share them with 6 mini updates).
          const _nself=this,_nm=this._navMiniEls,_nc=this._navCardEls;
          const _npush=function(){if(_nself._ovAnim){setTimeout(_npush,150);return;}if(!_nself._hass)return;for(const _k in _nm)try{_nm[_k].el.hass=_nself._hass;}catch(_){}for(const _ce of _nc)try{_ce.hass=_nself._hass;}catch(_){}};
          setTimeout(_npush,300);
        }
        this._navSetActive(this._roomIdx);
      }
    }
    if(!_navReused){
    this._navThumbEls={};this._navChipEls=[];this._navCardEls=[];this._navFollowEl=null;
    if(this._navMiniRo){this._navMiniRo.disconnect();this._navMiniRo=null;}
    this._navMiniEls={};
    if(navStyle!=='none'){
      const navSelf=this;
      this.shadowRoot.querySelectorAll('[data-nav-room]').forEach(function(btn){
        btn.addEventListener('click',function(e){
          e.stopPropagation();
          const ri=parseInt(btn.dataset.navRoom);
          navSelf._switchRoom(ri,ri>navSelf._roomIdx?1:(ri<navSelf._roomIdx?-1:0),true);
        });
        btn.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();btn.click();}});
      });
      if(navStyle==='thumbnails'){
        cAll.rooms.forEach(function(r,ri){
          navSelf._navThumbEls[ri]=navSelf.shadowRoot.querySelector('[data-thumb="'+ri+'"]');
          const chipCont=navSelf.shadowRoot.querySelector('[data-thumb-chips="'+ri+'"]');
          if(!chipCont)return;
          (r.chips||navCfg.chips||[]).slice(0,3).forEach(function(chCfg){
navSelf._navChipInto(chipCont,chCfg,r);
          });
        });
      }
      // nav.live: 'full' OR 'custom' — mount one persistent, non-interactive
      // mini <room-overlay-card> per thumbnail (NAV_LIVE_FULL_PLAN.md §5/§6/
      // §13). Fixed reference width, aspect-derived height (see _isMini/
      // _rootH/_wrapAspect above) — then a shared ResizeObserver scales the
      // whole thing to fit its thumb box, so every mini keeps the SAME font/
      // icon/gauge proportions no matter each room's own aspect_ratio. Both
      // tiers share this entire mount/scale mechanism unchanged — only
      // rocBuildMiniConfig's content differs: both tiers honor nav_mini per
      // §13, but with opposite defaults (custom opt-in, full opt-out —
      // v6.15.0).
      if(_navLiveReal){
        const _wRef=(navCfg.mini&&Number(navCfg.mini.width_ref))||480;
        cAll.rooms.forEach(function(r,ri){
          const host=navSelf.shadowRoot.querySelector('[data-thumb-mini="'+ri+'"]');
          if(!host)return;
          const _mrec=navSelf._mountMini(host,ri,_wRef); // shared with overview tiles
          if(_mrec)navSelf._navMiniEls[ri]=_mrec;
        });
        if(window.ResizeObserver){
          const _miniMap=navSelf._navMiniEls;
          // Fit: width-fit, top-anchored (as always) — unless the thumb is
          // TALLER than the width-fitted mini (narrow thumbs: a phone strip, a
          // 3-column nav.rows grid), which used to leave an empty band under
          // the room. Then cover by height, centred horizontally (v6.25.0).
          // Both the thumb AND the mini are observed: the mini only gets its
          // real height after its first render.
          const _fit=function(rec){
            const w=rec.thumb.clientWidth||0,h=rec.thumb.clientHeight||0,mh=rec.el.offsetHeight||0;
            let sc=w>0?w/rec.widthRef:0,tx=0;
            if(sc>0&&mh>0&&h>mh*sc+0.5){sc=h/mh;tx=(w-rec.widthRef*sc)/2;}
            rec.el.style.transform=sc>0?((tx?'translateX('+tx.toFixed(2)+'px) ':'')+'scale('+sc+')'):'';
            rec.el._miniScale=sc; // v6.25.0: HQ thumbnail images need the real drawn size
            if(sc>0&&rec.el._hqRefresh)rec.el._hqRefresh();
          };
          navSelf._navMiniRo=new ResizeObserver(function(entries){
            for(const en of entries){
              for(const _ri in _miniMap){const rec=_miniMap[_ri];if(rec&&(rec.thumb===en.target||rec.el===en.target))_fit(rec);}
            }
          });
          for(const _ri in this._navMiniEls){
            const rec=this._navMiniEls[_ri];
            const _thumbHost=navSelf.shadowRoot.querySelector('[data-thumb="'+_ri+'"]');
            if(_thumbHost&&rec){rec.thumb=_thumbHost;navSelf._navMiniRo.observe(_thumbHost);navSelf._navMiniRo.observe(rec.el);}
          }
        }
      }
      // Custom HA cards embedded in the nav strip
      (navCfg.cards||[]).forEach(function(cc,ci){
        const host=navSelf.shadowRoot.querySelector('[data-nav-card="'+ci+'"]');
        if(!host)return;
        const cardCfg=cc&&cc.card?cc.card:cc;
        if(!cardCfg||!cardCfg.type)return;
        const wrapEl=makeHACard(cardCfg,function(el){
          if(navSelf._renderGen!==_gen)return; // a newer render replaced this DOM
          navSelf._navCardEls.push(el);
          if(navSelf._hass)try{el.hass=navSelf._hass;}catch(_){}
        });
        if(wrapEl)host.appendChild(wrapEl);
      });
      this._navFollowEl=this.shadowRoot.querySelector('[data-nav-follow]');
      if(this._navFollowEl){
        const fbSelf=this;
        this._navFollowEl.addEventListener('click',function(e){e.stopPropagation();fbSelf._followNow();});
      }
    }
    } // !_navReused
    // Overview page wiring (cards, pills, tiles, minis) — after the nav block,
    // which resets _navChipEls that the tiles' info chips register into.
    if(_ovOn&&_ovMeta)this._ovWire(_ovMeta,_gen);
    else{this._ovTiles=null;this._ovPills=null;this._ovThumbs=null;this._ovCardEls=[];this._ovMiniEls={};if(this._ovMiniRo){this._ovMiniRo.disconnect();this._ovMiniRo=null;}}
    // Mount companion strip cards (above/below the image)
    this._stripCardEls=[];
    const stSelf=this;
    const _mountStrip=function(list,attr){
      (list||[]).forEach(function(cc,ci){
        const host=stSelf.shadowRoot.querySelector('['+attr+'="'+ci+'"]');
        if(!host)return;
        const cardCfg=cc&&cc.card?cc.card:cc;
        if(!cardCfg||!cardCfg.type)return;
        const w=makeHACard(cardCfg,function(el){
          if(stSelf._renderGen!==_gen)return; // stale render
          stSelf._stripCardEls.push(el);
          if(stSelf._hass)try{el.hass=stSelf._hass;}catch(_){}
        });
        if(w)host.appendChild(w);
      });
    };
    _mountStrip(c.cards_above,'data-above-card');
    _mountStrip(c.cards_below,'data-below-card');
    // Mount light-controls sliders (material-slider-card) + wire the lux ring.
    // Switch-like entities have no [data-lc-card] host (they render a toggle
    // pill instead), so the querySelector below simply skips them.
    this._lcEls=[];this._lcPrevCol=null;this._lcToggles=[];this._lcPills=[];
    if(_lcEnts.length){
      const lcSelf=this;
      const _bgOff=_lcBgOff;
      _lcEnts.forEach(function(e,i){
        const host=lcSelf.shadowRoot.querySelector('[data-lc-card="'+i+'"]');
        if(!host)return;
        const cardCfg={type:'custom:material-slider-card',entity:e.entity,control_type:'light',colorize:true,height:_lcHgt,border_width:'2px',border_style:'solid'};
        if(e.name)cardCfg.name=e.name;
        const w=makeHACard(cardCfg,function(el){
          if(lcSelf._renderGen!==_gen)return;
          const _icol=(lcSelf._hass&&lcSelf._lcCfg)?lcBorderColor(lcSelf._hass.states[lcSelf._lcCfg.lux_sensor]?.state,lcSelf._lcCfg):'';
          const _stEl=lcSelf._injectLcStyle(el,_bgOff,_icol);
          lcSelf._lcEls.push({el:el,entity:e.entity,styleEl:_stEl,bgOff:_bgOff});
          try{el.style.width='100%';}catch(_){}
          if(lcSelf._hass){try{el.hass=lcSelf._hass;}catch(_){}}
        });
        if(w)host.appendChild(w);
      });
      // Wire on/off toggle pills (switch, input_boolean, fan…) — they share the
      // lux ring + bg_off look; state + ring colour are reflected in _update().
      _lcEnts.forEach(function(e,i){
        if(lcUsesSlider(e.entity))return;
        const btn=lcSelf.shadowRoot.querySelector('[data-lc-toggle="'+i+'"]');
        if(!btn)return;
        btn.addEventListener('click',function(ev){
          ev.stopPropagation();
          if(lcSelf._hass)try{lcSelf._hass.callService('homeassistant','toggle',{entity_id:e.entity});}catch(_){}
        });
        lcSelf._lcToggles.push({el:btn,entity:e.entity,icon:btn.querySelector('[data-lc-ticon]'),bgOff:_bgOff});
      });
      // Native pills (style: native, v6.17.0)
      this._lcPills=[];
      _lcEnts.forEach(function(e,i){
        const el=lcSelf.shadowRoot.querySelector('[data-lcp="'+i+'"]');
        if(!el)return;
        const rec={el:el,entity:e.entity,cfg:e,fill:el.querySelector('[data-lcp-fill]'),val:el.querySelector('[data-lcp-val]'),icon:el.querySelector('[data-lcp-icon]'),userUntil:0};
        lcSelf._lcPills.push(rec);
        lcSelf._wireLcPill(rec);
      });
      // Match toggle-pill height to the ACTUAL rendered slider height — material-
      // slider-card renders its own box, so a shared px value can still differ
      // visually. Measuring the mounted slider guarantees parity. Retried because
      // the slider mounts async via card helpers.
      if(this._lcToggles.length){
        const _syncSelf=this,_sg=_gen;
        const _sy=function(){if(_syncSelf._renderGen===_sg)_syncSelf._syncLcToggleHeights();};
        // rAF = fast path only; the setTimeout retries below are the
        // background-tab-safe guarantee (rAF never fires in hidden tabs)
        if(typeof requestAnimationFrame!=='undefined')requestAnimationFrame(_sy);
        setTimeout(_sy,140);setTimeout(_sy,450);
      }
    }
    // ---- Cover controls (roleta) — mount interactions -----------------------
    this._ccEls={};
    if(this._ccCfgs&&this._ccCfgs.length&&!c._roc_ghost){
      const ccSelf=this;const _ccMobM=(_vt==='portrait');
      this._ccCfgs.forEach(function(cc){
        const root=ccSelf.shadowRoot.querySelector('.roc-cc[data-cc="'+escSel(cc.id)+'"]');
        if(!root)return;
        const _mode=root.dataset.ccMode||'float';
        const _horiz=_mode==='dock'?rocCoverHoriz(ccSelf._lp):_ccMobM; // dock: grid-derived (html already carries cc-h)
        root.style.touchAction='none';
        root.addEventListener('pointerdown',function(e){e.stopPropagation();});
        const rec={cfg:cc,root:root,horiz:_horiz,mode:_mode,
          pct:root.querySelector('[data-cc-pct]'),fill:root.querySelector('[data-cc-fill]'),
          thumb:root.querySelector('[data-cc-thumb]'),rail:root.querySelector('[data-cc-rail]'),
          stop:root.querySelector('[data-cc-stop]'),up:root.querySelector('[data-cc-up]'),
          down:root.querySelector('[data-cc-down]'),
          presets:[].slice.call(root.querySelectorAll('[data-cc-preset]')),_userHold:0};
        ccSelf._ccEls[cc.id]=rec;
        const call=function(svc,data){const h=ccSelf._hass;if(!h)return;h.callService('cover',svc,Object.assign({entity_id:cc.entity},data||{}));};
        const guard=function(fn){return function(e){e.stopPropagation();if(ccSelf._config&&ccSelf._config.test_mode)return;rec._userHold=Date.now();fn();};};
        if(rec.up)rec.up.addEventListener('click',guard(function(){call('open_cover');}));
        if(rec.down)rec.down.addEventListener('click',guard(function(){call('close_cover');}));
        if(rec.stop)rec.stop.addEventListener('click',guard(function(){call('stop_cover');}));
        rec.presets.forEach(function(pb){pb.addEventListener('click',guard(function(){call('set_cover_position',{position:parseInt(pb.dataset.pos,10)||0});}));});
        if(rec.rail)ccSelf._attachCoverRail(rec);
        const anchor=ccSelf.shadowRoot.querySelector('[data-gauge="__bl_'+escSel(cc.id)+'"]');
        if(anchor&&_mode==='float'){anchor.style.pointerEvents='auto';anchor.style.cursor='pointer';
          anchor.addEventListener('click',function(e){e.stopPropagation();ccSelf._toggleCoverPop(cc.id);});}
      });
      if(!this._ccOutsideBound){
        this._ccOutsideBound=true;const obSelf=this;
        this.shadowRoot.addEventListener('pointerdown',function(e){
          const path=e.composedPath?e.composedPath():[];
          for(const n of path){if(n&&n.classList&&(n.classList.contains('roc-cc')||(n.dataset&&typeof n.dataset.gauge==='string'&&n.dataset.gauge.indexOf('__bl_')===0)))return;}
          for(const k in(obSelf._ccEls||{})){if(obSelf._ccEls[k].mode!=='dock')obSelf._ccEls[k].root.style.display='none';}
        },true);
      }
    }
    // ---- Finger-attached room drag (filmstrip feel) -------------------------
    if(Array.isArray(cAll.rooms)&&cAll.rooms.length>1&&!tm){
      const wrapSw=this.shadowRoot.querySelector('.wrap');
      if(wrapSw)this._attachRoomDrag(wrapSw);
      // ---- Mouse-wheel room switching (nav.wheel) -------------------------
      // One listener on the card element itself, bound once (not on the shadow
      // root: Chrome only treats wheel events as cancelable over an ELEMENT with
      // a non-passive listener). It survives every re-render,
      // so a touchpad swipe that is still running while the next room renders
      // (or while an overview transition hides the image region) keeps being
      // caught — before v6.31.0 those events reached the page and Chrome turned
      // them into a browser Back swipe (left the dashboard view).
      if(navCfg.wheel&&!this._wheelBound){this._wheelBound=true;this.addEventListener('wheel',this._onWheel.bind(this),{passive:false});}
    }
    if(this._wxEl&&_wx&&_wx.angle!==undefined)this._wxEl.style.setProperty('--roc-rain-angle',typeof _wx.angle==='number'?_wx.angle+'deg':String(_wx.angle));
    this._ovEls={};
    for(const ov of(c.overlays||[])){this._ovEls[ov.id]=this.shadowRoot.querySelector('[data-ov="'+escSel(ov.id)+'"]');}
    this._glowEls={};this._glowFxEls={};
    for(const g of(c.glows||[])){
      const gel=this.shadowRoot.querySelector('[data-glow="'+escSel(g.id)+'"]');
      if(!gel)continue;
      this._glowEls[g.id]=gel;
      this._glowFxEls[g.id]=gel.querySelector('.glow-fx');
    }
    this._glowEditEls={};
    for(const g of(c.glows||[])){
      const ge=this.shadowRoot.querySelector('[data-glowedit="'+escSel(g.id)+'"]');
      if(ge)this._glowEditEls[g.id]=ge;
    }
    this._grpPanelEls={};
    for(const g of(c.groups||[])){if(g.style)this._grpPanelEls[g.id]=this.shadowRoot.querySelector('[data-grp-panel="'+escSel(g.id)+'"]');}
    this._zoneEls={};
    for(const z of(c.zones||[])){
      const el=this.shadowRoot.querySelector('[data-z="'+escSel(z.id)+'"]');
      if(!el)continue;this._zoneEls[z.id]=el;
      if(z.tap_action||z.hold_action||z.double_tap_action)
        this._addZoneListeners(el,z.tap_action,z.hold_action,z.double_tap_action,z.hold_delay);
      if(z.slider&&z.slider.entity&&!tm)this._attachSlider(el,z);
    }
    this._biconEls={};this._blabelEls={};this._bcontEls={};
    for(const b of(c.badges||[])){
      this._biconEls[b.id]=this.shadowRoot.querySelector('[data-bi="'+escSel(b.id)+'"]');
      this._blabelEls[b.id]=this.shadowRoot.querySelector('[data-bl="'+escSel(b.id)+'"]');
      const bel=this.shadowRoot.querySelector('[data-b="'+escSel(b.id)+'"]');
      this._bcontEls[b.id]=bel;
      if(bel&&(b.tap_action||b.hold_action||b.double_tap_action))
        this._addZoneListeners(bel,b.tap_action,b.hold_action,b.double_tap_action,b.hold_delay);
    }
    this._icoEls={};this._icoIconEls={};
    for(const ico of(c.icons||[])){
      const el=this.shadowRoot.querySelector('[data-ico="'+escSel(ico.id)+'"]');
      if(!el)continue;this._icoEls[ico.id]=el;
      // Cache the inner <ha-icon> alongside its container (same pattern as
      // _biconEls/_blabelEls for badges). _update() used to re-query this per
      // icon per tick — 20 icons meant 20 querySelector calls on every state
      // change, for a node that cannot change between renders.
      this._icoIconEls[ico.id]=el.querySelector('ha-icon');
      if(ico.tap_action||ico.hold_action||ico.double_tap_action)this._addZoneListeners(el,ico.tap_action,ico.hold_action,ico.double_tap_action,ico.hold_delay);
    }
    this._vwEls={};this._vwBgEls={};this._vwIconEls={};this._vwCountEls={};
    for(const vw of(c.vacuum_widgets||[])){
      const el=this.shadowRoot.querySelector('[data-vw="'+escSel(vw.id)+'"]');
      if(!el)continue;
      this._vwEls[vw.id]=el;
      this._vwBgEls[vw.id]=this.shadowRoot.querySelector('[data-vwbg="'+escSel(vw.id)+'"]');
      this._vwIconEls[vw.id]=this.shadowRoot.querySelector('[data-vwi="'+escSel(vw.id)+'"]');
      this._vwCountEls[vw.id]=this.shadowRoot.querySelector('[data-vwc="'+escSel(vw.id)+'"]');
      if(vw.tap_action||vw.hold_action||vw.double_tap_action)
        this._addZoneListeners(el,vw.tap_action,vw.hold_action,vw.double_tap_action,vw.hold_delay);
    }
    this._lblEls={};this._sortedLblGrads={};
    for(const lbl of(c.labels||[])){
      this._lblEls[lbl.id]=this.shadowRoot.querySelector('[data-lbl="'+escSel(lbl.id)+'"]');
      if(lbl.color_gradient)this._sortedLblGrads[lbl.id]=lbl.color_gradient.slice().sort((a,b)=>a.value-b.value);
      const lel=this._lblEls[lbl.id];
      if(lel&&!_isMini&&(lbl.tap_action||lbl.hold_action||lbl.double_tap_action)){
        lel.style.pointerEvents='auto';lel.style.cursor='pointer';
        lel.setAttribute('tabindex','0');lel.setAttribute('role','button');
        this._addZoneListeners(lel,lbl.tap_action,lbl.hold_action,lbl.double_tap_action,lbl.hold_delay);
      }
    }
    this._sortedBmFg=c.brightness_model?.filter_gradient?.length?c.brightness_model.filter_gradient.slice().sort((a,b)=>a.value-b.value):null;
    this._gaugeEls={};this._gaugeFills={};this._sortedGrads={};this._blindGaugeCfgs=(c.blinds||[]).map(b=>tApply(b,_tier)).flatMap(blindToGaugeConfig);for(const g of(c.gauges||[])){this._gaugeEls[g.id]=this.shadowRoot.querySelector('[data-gauge="'+escSel(g.id)+'"]');if(this._gaugeEls[g.id])this._gaugeFills[g.id]=this._gaugeEls[g.id].querySelector('.gfill');if(g.color_gradient)this._sortedGrads[g.id]=g.color_gradient.slice().sort((a,b)=>a.value-b.value);}for(const bg of this._blindGaugeCfgs){this._gaugeEls[bg.id]=this.shadowRoot.querySelector('[data-gauge="'+escSel(bg.id)+'"]');if(this._gaugeEls[bg.id])this._gaugeFills[bg.id]=this._gaugeEls[bg.id].querySelector('.gfill');if(bg.color_gradient)this._sortedGrads[bg.id]=bg.color_gradient.slice().sort((a,b)=>a.value-b.value);}
    // Gauges with actions become interactive (default stays pointer-events: none)
    for(const g of[...(c.gauges||[]),...this._blindGaugeCfgs]){
      const gel=this._gaugeEls[g.id];
      if(gel&&!_isMini&&(g.tap_action||g.hold_action||g.double_tap_action)){
        gel.style.pointerEvents='auto';gel.style.cursor='pointer';
        gel.setAttribute('tabindex','0');gel.setAttribute('role','button');
        this._addZoneListeners(gel,g.tap_action,g.hold_action,g.double_tap_action,g.hold_delay);
      }
    }
    this._cardEls={};this._contEls={};
    for(const el0 of(c.elements||[])){
      const el=tApply(el0,_tier);
      const cont=document.createElement('div');
      cont.className='elcont';cont.setAttribute('data-el',el.id);
      const _elVPos=el.bottom!==undefined?'bottom:'+el.bottom+';':'top:'+(el.top||'0')+';';
      const _elH=el.height?('height:'+el.height+';'):(el.bottom!==undefined?'height:auto;':'height:auto;');
      cont.style.cssText=_elVPos+'left:'+el.left+';width:'+el.width+';'+_elH+'z-index:'+(el.z_index??4)+';overflow:'+(el.overflow??'hidden')+';border-radius:'+(el.border_radius??'0')+';'+(_isMini?'pointer-events:none;':'')+(tm?'outline:2px dashed blue;':'');
      if(tm)cont.title='[element] '+el.id;
      const self=this,elId=el.id;
      const wrap=makeHACard(el.card,function(cardEl){
        if(self._renderGen!==_gen)return; // stale render
        self._cardEls[elId]=cardEl;
        if(self._hass)try{cardEl.hass=self._hass;}catch(_){}
      });
      if(wrap)cont.appendChild(wrap);
      this._contEls[el.id]=cont;if(content)content.appendChild(cont);
    }
    const hacard=this.shadowRoot.querySelector('ha-card');
    if(hacard&&c.tap_action){
      hacard.addEventListener('click',e=>{
        if(!e.composedPath().some(n=>n.classList?.contains('zone')||n.classList?.contains('elcont')||n.classList?.contains('ico')||n.classList?.contains('badge')||n.classList?.contains('tm-flip')||n.classList?.contains('tm-save')||n.classList?.contains('tm-studio')||n.classList?.contains('roc-panel')||n.classList?.contains('roc-panel-backdrop')))this._exec(c.tap_action,e);
      });
    }
    if(tm){
      // Alignment guide lines for drag snapping
      const _gdc=this.shadowRoot.querySelector('.content');
      this._gdH=document.createElement('div');this._gdH.className='roc-gd roc-gd-h';
      this._gdV=document.createElement('div');this._gdV.className='roc-gd roc-gd-v';
      if(_gdc){_gdc.appendChild(this._gdH);_gdc.appendChild(this._gdV);}
      const flipBtn=this.shadowRoot.querySelector('.tm-flip');
      if(flipBtn){
        const self=this;
        flipBtn.addEventListener('click',function(e){
          e.stopPropagation();e.preventDefault();
          self._testFlipped=!self._testFlipped;
          flipBtn.style.background=self._testFlipped?'rgba(220,80,0,0.9)':'rgba(0,0,0,0.72)';
          flipBtn.innerHTML=self._testFlipped?'&#8644; FLIPPED':'&#8644; FLIP';
          self._update();
        });
      }
      const profBtn=this.shadowRoot.querySelector('.tm-prof');
      if(profBtn){
        const pfSelf=this;
        profBtn.addEventListener('click',function(e){
          e.stopPropagation();e.preventDefault();
          pfSelf._profFlipped=!pfSelf._profFlipped;
          pfSelf._rendered=false;pfSelf._render();
        });
      }
      const studioBtn=this.shadowRoot.querySelector('.tm-studio');
      if(studioBtn){
        const stSelf=this;
        studioBtn.addEventListener('click',function(e){
          e.stopPropagation();e.preventDefault();
          studioBtn.disabled=true;
          rocOpenStudio({from:'dashboard',card:stSelf,hass:stSelf._hass})
            .catch(function(err){studioBtn.textContent='\u26A0 '+((err&&err.message)||String(err));studioBtn.style.background='rgba(160,60,20,0.92)';})
            .then(function(){studioBtn.disabled=false;});
        });
      }
      const saveBtn=this.shadowRoot.querySelector('.tm-save');
      if(saveBtn){
        const self=this;
        saveBtn.addEventListener('click',function(e){
          e.stopPropagation();e.preventDefault();
          const cfg=Object.assign({type:'custom:room-overlay-card'},self._config);
          // Always relay via editor if open
          window.dispatchEvent(new CustomEvent('roc-pos-update',{detail:{config:cfg}}));

          function _showOverlay(reason){
            const existing=self.shadowRoot.querySelector('.tm-cfg-ov');
            if(existing){existing.remove();return;}
            // _yaml.s() is the embedded js-yaml dumper (v6.22.0), so this is
            // real YAML, matching the "paste in YAML editor" instruction below.
            const txt=_yaml.s(cfg);
            const ov=document.createElement('div');
            ov.className='tm-cfg-ov';
            ov.style.cssText='position:absolute;inset:0;z-index:500;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;padding:10px;box-sizing:border-box;';
            const hdr=document.createElement('div');
            hdr.style.cssText='display:flex;flex-direction:column;gap:4px;margin-bottom:6px;';
            const hdr1=document.createElement('div');
            hdr1.style.cssText='display:flex;justify-content:space-between;align-items:center;';
            hdr1.innerHTML='<span style="color:#fff;font-size:11px;font-weight:bold;">&#128190; Config — Ctrl+A, Ctrl+C, then paste in YAML editor</span><button style="background:none;border:1px solid rgba(255,255,255,0.4);color:#fff;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:12px;">&#x2715;</button>';
            hdr.appendChild(hdr1);
            if(reason){const hdr2=document.createElement('div');hdr2.style.cssText='color:#faa;font-size:10px;';hdr2.textContent='Auto-save failed: '+reason;hdr.appendChild(hdr2);}
            hdr1.querySelector('button').addEventListener('click',function(ev){ev.stopPropagation();ov.remove();});
            const ta=document.createElement('textarea');
            ta.value=txt;ta.readOnly=true;
            ta.style.cssText='flex:1;width:100%;background:#111;color:#aef;border:1px solid rgba(255,255,255,0.15);border-radius:4px;font-family:monospace;font-size:11px;padding:8px;box-sizing:border-box;resize:none;';
            ov.appendChild(hdr);ov.appendChild(ta);
            self.shadowRoot.querySelector('.content').appendChild(ov);
            ta.focus();ta.select();
            if(navigator.clipboard)navigator.clipboard.writeText(txt).catch(function(){});
            try{document.execCommand('copy');}catch(_){}
            ov.addEventListener('click',function(ev){if(ev.target===ov)ov.remove();});
          }

          // Direct HA Lovelace save via WebSocket (storage mode only)
          const _callWS=self._hass&&(typeof self._hass.callWS==='function'?self._hass.callWS.bind(self._hass):null)||(self._hass&&self._hass.connection&&typeof self._hass.connection.sendMessagePromise==='function'?self._hass.connection.sendMessagePromise.bind(self._hass.connection):null);
          if(_callWS){
            // Extract dashboard url_path and view key from current URL
            // e.g. /lovelace/2  →  urlPath=null, viewKey='2'
            // e.g. /my-dash/living-room  →  urlPath='my-dash', viewKey='living-room'
            const _parts=window.location.pathname.split('/').filter(Boolean);
            const _urlPath=_parts[0]==='lovelace'?null:(_parts[0]||null);
            _callWS({type:'lovelace/config',url_path:_urlPath})
              .then(function(lc){
                const nc=rocClone(lc);
                const key=cfgKey(self._config);
                // Search the WHOLE dashboard (every view + section + nesting),
                // not just the URL's view — navigation/room switches make the URL
                // view unreliable. card_id keeps the match unambiguous.
                const matches=[];
                function _walk(cards){
                  if(!Array.isArray(cards))return;
                  for(let i=0;i<cards.length;i++){
                    const card=cards[i];if(!card)continue;
                    if(card.type==='custom:room-overlay-card'&&cfgKey(card)===key)matches.push({arr:cards,idx:i});
                    if(card.cards)_walk(card.cards);
                    if(card.card)_walk([card.card]);
                    if(Array.isArray(card.sections))card.sections.forEach(function(sec){_walk(sec&&sec.cards);});
                  }
                }
                (nc.views||[]).forEach(function(v){
                  _walk(v.cards);
                  if(Array.isArray(v.sections))v.sections.forEach(function(sec){_walk(sec&&sec.cards);});
                });
                if(!matches.length)throw new Error('card not found in dashboard (key: '+key+')');
                if(matches.length>1)throw new Error(matches.length+' matching cards — set a unique card_id to disambiguate');
                matches[0].arr[matches[0].idx]=Object.assign({},self._config,{type:'custom:room-overlay-card'});
                return _callWS({type:'lovelace/config/save',url_path:_urlPath,config:nc});
              })
              .then(function(){
                saveBtn.innerHTML='&#10003; Saved!';saveBtn.style.background='rgba(0,140,0,0.9)';
                setTimeout(function(){saveBtn.innerHTML='&#128190; Save';saveBtn.style.background='rgba(20,100,20,0.82)';},2500);
              })
              .catch(function(err){
                const reason=(err&&(err.code||err.message))||String(err);
                console.warn('[room-overlay-card] Direct save failed:',reason);
                _showOverlay(reason);
              });
          } else {
            _showOverlay('hass.callWS not available');
          }
        });
      }
      // Drag & drop — zones, icons, labels
      const _dpFire=(nc)=>{
        this._config=nc;
        this._posOut(Object.assign({type:'custom:room-overlay-card'},nc));
      };
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const zc=this._roomArr(nc,'zones').find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const ico of(c.icons||[])){
        const el=this._icoEls[ico.id];if(!el)continue;
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const ic=this._roomArr(nc,'icons').find(x=>x.id===ico.id);if(ic){ic.top=top;ic.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const vw of(c.vacuum_widgets||[])){
        const el=this._vwEls[vw.id];if(!el)continue;
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const vc=this._roomArr(nc,'vacuum_widgets').find(x=>x.id===vw.id);if(vc){vc.top=top;vc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const g of(c.glows||[])){
        const el=this._glowEditEls[g.id];if(!el)continue;
        const gl=this._glowEls[g.id];
        el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          if(gl){gl.style.top=top;gl.style.left=left;}   // the light follows the box live
          const nc=rocClone(this._config);
          const gc=this._roomArr(nc,'glows').find(x=>x.id===g.id);if(gc){gc.top=top;gc.left=left;}
          _dpFire(nc);this._update();
        });
        this._makeGlowResizable(el,g.shape,(width,height)=>{
          if(gl){gl.style.width=width;if(height)gl.style.height=height;}
          const nc=rocClone(this._config);
          const gc=this._roomArr(nc,'glows').find(x=>x.id===g.id);
          if(gc){
            if(height){gc.width=width;gc.height=height;delete gc.size;}
            else{gc.size=width;delete gc.width;delete gc.height;}
          }
          _dpFire(nc);this._update();
        });
      }
      for(const lbl of(c.labels||[])){
        const el=this._lblEls[lbl.id];if(!el)continue;
        el.style.pointerEvents='auto';el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const lc=this._roomArr(nc,'labels').find(x=>x.id===lbl.id);if(lc){lc.top=top;lc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      // Gauges and blinds move by dragging their body (v6.42.0)
      for(const g of(c.gauges||[])){
        const el=this._gaugeEls[g.id];if(!el)continue;
        el.style.pointerEvents='auto';el.style.cursor='grab'; // gauges ignore the pointer outside Edit mode
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const gc=this._roomArr(nc,'gauges').find(x=>x.id===g.id);if(gc){gc.top=top;gc.left=left;}
          _dpFire(nc);this._update();
        });
      }
      for(const b of(c.blinds||[])){
        const el=this._gaugeEls['__bl_'+b.id];if(!el)continue;
        el.style.pointerEvents='auto';el.style.cursor='grab';
        this._makeDraggable(el,(top,left)=>{
          const nc=rocClone(this._config);
          const bc=this._roomArr(nc,'blinds').find(x=>x.id===b.id);if(bc){bc.top=top;bc.left=left;}
          _dpFire(nc);this._update();
        });
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=rocClone(this._config);
          const bc=this._roomArr(nc,'blinds').find(x=>x.id===b.id);if(bc){bc.top=top;bc.left=left;bc.width=width;bc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      // Resize handles — zones, elements, gauges
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=rocClone(this._config);
          const zc=this._roomArr(nc,'zones').find(x=>x.id===z.id);if(zc){zc.top=top;zc.left=left;zc.width=width;zc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      for(const elCfg of(c.elements||[])){
        const cont=this._contEls[elCfg.id];if(!cont)continue;
        this._makeResizable(cont,(top,left,width,height)=>{
          const nc=rocClone(this._config);
          const ec=this._roomArr(nc,'elements').find(x=>x.id===elCfg.id);if(ec){ec.top=top;ec.left=left;ec.width=width;ec.height=height;}
          _dpFire(nc);this._update();
        });
        // the body is the embedded card itself (it stays usable), so it moves by a grip (v6.42.0)
        const grip=document.createElement('div');
        grip.className='roc-rh roc-grip';grip.title='Drag to move';
        grip.style.cssText='position:absolute;top:-14px;left:calc(50% - 14px);width:28px;height:12px;border-radius:6px;background:var(--primary-color,#03a9f4);border:2px solid #fff;box-sizing:border-box;z-index:1001;cursor:move;display:none;touch-action:none;';
        cont.appendChild(grip);
        this._makeDraggable(grip,(top,left)=>{
          const nc=rocClone(this._config);
          const ec=this._roomArr(nc,'elements').find(x=>x.id===elCfg.id);if(ec){ec.top=top;ec.left=left;}
          _dpFire(nc);this._update();
        },cont);
      }
      for(const g of(c.gauges||[])){
        const el=this._gaugeEls[g.id];if(!el)continue;
        this._makeResizable(el,(top,left,width,height)=>{
          const nc=rocClone(this._config);
          const gc=this._roomArr(nc,'gauges').find(x=>x.id===g.id);if(gc){gc.top=top;gc.left=left;gc.width=width;gc.height=height;}
          _dpFire(nc);this._update();
        });
      }
      // Keyboard nudge — click to select, arrows to nudge, Escape to deselect
      const _tmOutline=(type)=>type==='zone'?'3px solid red':(type==='glow'?'1px dashed rgba(255,214,120,0.95)':'');
      const _selectTM=(el,type,id,ev)=>{
        if(this._selectedTM){this._selectedTM.el.style.outline=_tmOutline(this._selectedTM.type);this._selectedTM.el.style.outlineOffset='';}
        this.shadowRoot.querySelectorAll('.roc-rh').forEach(function(h){h.style.display='none';}); // hide every resize handle
        el.style.outline='2px dashed var(--primary-color,#03a9f4)';
        el.style.outlineOffset='2px';
        el.querySelectorAll('.roc-rh').forEach(function(h){h.style.display='block';}); // show only the selected element's handles
        this._selectedTM={el,type,id};
        // studio: open it in the inspector; Shift / Ctrl / ⌘ = add to (or remove from) a multi-selection
        if(!_selSilent&&typeof this._rocSelSink==='function')try{this._rocSelSink(type,id,{add:!!(ev&&(ev.shiftKey||ev.ctrlKey||ev.metaKey))});}catch(_){}
      };
      let _selSilent=false;
      const _deselectTM=()=>{if(this._selectedTM){this._selectedTM.el.style.outline=_tmOutline(this._selectedTM.type);this._selectedTM.el.style.outlineOffset='';this._selectedTM.el.querySelectorAll('.roc-rh').forEach(function(h){h.style.display='none';});this._selectedTM=null;if(!_selSilent&&typeof this._rocSelSink==='function')try{this._rocSelSink(null,null);}catch(_){}}};
      // Studio (v6.42.0): select / deselect from outside (outline, inspector) without echoing
      // back through _rocSelSink. Returns false when the element is not on the canvas.
      const _tmEl=(type,id)=>{
        if(type==='blind')return this._gaugeEls['__bl_'+id]||null;
        const m={zone:this._zoneEls,icon:this._icoEls,label:this._lblEls,gauge:this._gaugeEls,element:this._contEls,glow:this._glowEditEls,vacuum_widget:this._vwEls}[type];
        return m&&m[id]||null;
      };
      // Studio multi-selection (v6.43.0): the other selected elements get a dashed outline
      // (the primary one keeps its handles); _rocBox reports where an element is drawn, in % of
      // the image, for align / distribute.
      this._rocMarked=[];
      this._rocMark=(list)=>{
        (this._rocMarked||[]).forEach(function(m){if(m.el!==(self2._selectedTM&&self2._selectedTM.el)){m.el.style.outline=_tmOutline(m.type);m.el.style.outlineOffset='';}});
        this._rocMarked=[];
        (list||[]).forEach((x)=>{const el=_tmEl(x.type,x.id);if(!el||(this._selectedTM&&this._selectedTM.el===el))return;el.style.outline='2px dashed rgba(3,169,244,0.75)';el.style.outlineOffset='2px';this._rocMarked.push({el:el,type:x.type});});
      };
      const self2=this;
      this._rocBox=(type,id)=>{
        const el=_tmEl(type,id),cont=this.shadowRoot.querySelector('.content');
        if(!el||!cont)return null;
        const cr=cont.getBoundingClientRect(),r=el.getBoundingClientRect();
        if(!(cr.width>0&&cr.height>0))return null;
        return{t:(r.top-cr.top)/cr.height*100,l:(r.left-cr.left)/cr.width*100,h:r.height/cr.height*100,w:r.width/cr.width*100};
      };
      this._rocSelect=(type,id)=>{
        _selSilent=true;
        try{
          if(!type){_deselectTM();return true;}
          const el=_tmEl(type,id);if(!el){_deselectTM();return false;}
          _selectTM(el,type,id);return true;
        }finally{_selSilent=false;}
      };
      let _nudgeTimer=null;
      const _nudgeFn=(e)=>{
        if(!this._selectedTM)return;
        if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.key))return;
        // keys typed into a field (the editor, the studio's inspector) are not nudges (v6.42.0)
        const _kt=e.composedPath?e.composedPath()[0]:e.target;
        if(_kt&&(/^(INPUT|TEXTAREA|SELECT)$/.test(_kt.tagName||'')||_kt.isContentEditable))return;
        if(e.key==='Escape'){_deselectTM();return;}
        e.preventDefault();
        const step=e.shiftKey?0.1:1;
        const {el,type,id}=this._selectedTM;
        let top=parseFloat(el.style.top)||0,left=parseFloat(el.style.left)||0;
        if(e.key==='ArrowUp')top=Math.max(0,top-step);
        else if(e.key==='ArrowDown')top=Math.min(98,top+step);
        else if(e.key==='ArrowLeft')left=Math.max(0,left-step);
        else if(e.key==='ArrowRight')left=Math.min(98,left+step);
        el.style.top=top.toFixed(1)+'%';el.style.left=left.toFixed(1)+'%';
        if(type==='glow'){const _gl=this._glowEls[id];if(_gl){_gl.style.top=el.style.top;_gl.style.left=el.style.left;}}
        clearTimeout(_nudgeTimer);
        _nudgeTimer=setTimeout(()=>{
          const nc=rocClone(this._config);
          const arr=type==='zone'?this._roomArr(nc,'zones'):type==='icon'?this._roomArr(nc,'icons'):type==='label'?this._roomArr(nc,'labels'):type==='element'?this._roomArr(nc,'elements'):type==='gauge'?this._roomArr(nc,'gauges'):type==='vacuum_widget'?this._roomArr(nc,'vacuum_widgets'):type==='glow'?this._roomArr(nc,'glows'):type==='blind'?this._roomArr(nc,'blinds'):null;
          const item=(arr||[]).find(x=>x.id===id);
          if(item){item.top=el.style.top;item.left=el.style.left;}
          _dpFire(nc);
        },200);
      };
      this._tmKeyHandler=_nudgeFn;
      document.addEventListener('keydown',_nudgeFn);
      // v6.44.0: no text selection / native drag-and-drop on the edit canvas. A Shift-click (add
      // to the selection) used to extend a text selection over the labels; the next drag then
      // started the browser's own drag of that text and the element never moved (Chromium 15x).
      const _tmCont=this.shadowRoot.querySelector('.content');
      if(_tmCont){
        _tmCont.style.userSelect='none';_tmCont.style.webkitUserSelect='none';
        _tmCont.addEventListener('mousedown',(e)=>{if(e.shiftKey||e.ctrlKey||e.metaKey){const t=e.composedPath()[0];if(!(t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName||'')))e.preventDefault();}},true);
        _tmCont.addEventListener('dragstart',(e)=>{e.preventDefault();},true);
      }
      // Click to select (capture phase — fires before drag suppression and zone tap actions)
      for(const z of(c.zones||[])){
        const el=this._zoneEls[z.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'zone',z.id,e);},true);
      }
      for(const ico of(c.icons||[])){
        const el=this._icoEls[ico.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'icon',ico.id,e);},true);
      }
      for(const vw of(c.vacuum_widgets||[])){
        const el=this._vwEls[vw.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'vacuum_widget',vw.id,e);},true);
      }
      for(const g of(c.glows||[])){
        const el=this._glowEditEls[g.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'glow',g.id,e);},true);
      }
      for(const lbl of(c.labels||[])){
        const el=this._lblEls[lbl.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'label',lbl.id,e);},true);
      }
      for(const elCfg of(c.elements||[])){
        const el=this._contEls[elCfg.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'element',elCfg.id,e);},true);
      }
      for(const g of(c.gauges||[])){
        const el=this._gaugeEls[g.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'gauge',g.id,e);},true);
      }
      for(const b of(c.blinds||[])){
        const el=this._gaugeEls['__bl_'+b.id];if(!el)continue;
        el.addEventListener('click',(e)=>{e.stopImmediatePropagation();e.preventDefault();_selectTM(el,'blind',b.id,e);},true);
      }
      // Click on card background → deselect
      const _hacard=this.shadowRoot.querySelector('ha-card');
      if(_hacard)_hacard.addEventListener('click',_deselectTM);
      // Draw-to-create: drag on an empty area sketches a new zone
      const drawSelf=this;
      let _dwBox=null,_dwJustDrew=false;
      content.addEventListener('click',function(ce){if(_dwJustDrew){ce.stopImmediatePropagation();ce.preventDefault();}},true);
      content.addEventListener('mousedown',function(e){
        if(e.button!==0)return;
        const t=e.target;
        if(!(t===content||(t.classList&&t.classList.contains('layer'))))return; // only empty areas
        const rect=content.getBoundingClientRect();
        const sx=e.clientX,sy=e.clientY;
        function mv(ev){
          if(!_dwBox){
            if(Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy)<8)return;
            _dwBox=document.createElement('div');
            _dwBox.style.cssText='position:absolute;border:2px dashed var(--primary-color,#03a9f4);background:rgba(3,169,244,0.12);z-index:997;pointer-events:none;';
            content.appendChild(_dwBox);
          }
          _dwBox.style.left=((Math.min(sx,ev.clientX)-rect.left)/rect.width*100)+'%';
          _dwBox.style.top=((Math.min(sy,ev.clientY)-rect.top)/rect.height*100)+'%';
          _dwBox.style.width=(Math.abs(ev.clientX-sx)/rect.width*100)+'%';
          _dwBox.style.height=(Math.abs(ev.clientY-sy)/rect.height*100)+'%';
        }
        function up(){
          document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);
          if(!_dwBox)return;
          const l=parseFloat(_dwBox.style.left),tp=parseFloat(_dwBox.style.top),w=parseFloat(_dwBox.style.width),h=parseFloat(_dwBox.style.height);
          _dwBox.remove();_dwBox=null;
          _dwJustDrew=true;setTimeout(function(){_dwJustDrew=false;},300);
          if(w<2||h<2)return; // too small — ignore accidental drags
          const nc=rocClone(drawSelf._config);
          const dwZones=drawSelf._roomArrNew(nc,'zones');
          let n=dwZones.length+1,id='zone_'+n;
          while(dwZones.some(function(z){return z.id===id;})){n++;id='zone_'+n;}
          dwZones.push({id:id,top:tp.toFixed(1)+'%',left:l.toFixed(1)+'%',width:w.toFixed(1)+'%',height:h.toFixed(1)+'%'});
          drawSelf._config=nc;
          drawSelf._posOut(Object.assign({type:'custom:room-overlay-card'},nc));
          drawSelf._rendered=false;drawSelf._render();
        }
        document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
      });
    }
    if(c.zoom&&!tm){
      const wrapEl=this.shadowRoot.querySelector('.wrap');
      if(wrapEl&&content)this._attachZoom(wrapEl,content);
    }
    // Parallax tilt — pointer-driven (and device orientation where allowed).
    // Mutually exclusive with zoom (both own the content transform).
    if(c.parallax&&!tm&&!c.zoom&&!rocReducedMotion()){
      const wrapPx=this.shadowRoot.querySelector('.wrap');
      if(wrapPx&&content)this._attachParallax(wrapPx,content);
    }
    this._wireVisibility();
    this._wireLayoutObservers();
    this._layoutRootHeight(); // first paint: direct & synchronous (no flash)
    this._layoutFitWrap();
    this._layoutStage();
    // One late-settling re-pin: fonts/images can land after first paint
    // WITHOUT any DOM mutation or resize we observe. (v5.0: the second 1.2s
    // timer is gone — everything it covered is now caught by _pvMo or the
    // state-update piggyback.)
    const _lrSelf=this;
    clearTimeout(this._rootHT1);
    this._rootHT1=setTimeout(function(){_lrSelf._requestPin('post-render-settle');},250);
    // Change detection: the ACTIVE room (merged view) drives full updates;
    // entities that only affect nav thumbnails/chips go into a cheaper
    // nav-only set (see _schedule) so busy sensors in other rooms don't
    // re-run the whole update pass.
    const _ex=this._extractEntities(c);
    if(c.light_controls&&c.light_controls.lux_sensor)_ex.ids.add(c.light_controls.lux_sensor);
    for(const _b of(c.blinds||[]))if(_b&&_b.entity&&_b.control)_ex.ids.add(_b.entity);
    // Cockpit sections are deliberately cross-room (COCKPIT_PLAN.md kap.4): a
    // tile's entity may live in another room, be `source: auto` (no config
    // entity at all), or use `progress:` (a key _extractEntities doesn't
    // recognise). None of that is in `c`, so without this loop the panel
    // silently stops updating the moment its content isn't the active room's
    // own tagged elements (bug: cockpit tiles don't update live).
    for(const _secId in _secResolved)for(const _te of _secResolved[_secId]){
      const _td=rocTileDef(_te);
      if(_td.entity)_ex.ids.add(_td.entity);
      if(_td.progress)_ex.ids.add(_td.progress);
      for(const _ov of(_td.overlays||[]))this._extractEntities(_ov,_ex.ids,_ex.attrs);
    }
    const _reCfg=cAll.room_entity;
    if(typeof _reCfg==='string')_ex.ids.add(_reCfg);
    else if(_reCfg&&typeof _reCfg==='object'){
      if(_reCfg.default)_ex.ids.add(_reCfg.default);
      for(const k in(_reCfg.by_user||{}))_ex.ids.add(_reCfg.by_user[k]);
      for(const k in(_reCfg.by_browser||{}))_ex.ids.add(_reCfg.by_browser[k]);
    }
    const _navEx={ids:new Set(),attrs:new Set()};
    // nav.live (composite thumbnails) also reacts to other rooms' overlays,
    // conditional base images and brightness model
    const _navLive=!!(cAll.nav&&cAll.nav.live)||!!(this._ovThumbs&&this._ovThumbs.some(function(t){return t.mode==='composite';}));
    this._navBmSorted={};
    if(Array.isArray(cAll.rooms))for(let _ri=0;_ri<cAll.rooms.length;_ri++){
      const _rr=cAll.rooms[_ri];if(!_rr)continue;
      if(_navLive&&_rr.brightness_model?.filter_gradient?.length)
        this._navBmSorted[_ri]=_rr.brightness_model.filter_gradient.slice().sort((a,b)=>a.value-b.value);
      if(_ri===this._roomIdx)continue;
      if(_rr.filter_conditions)this._extractEntities(_rr.filter_conditions,_navEx.ids,_navEx.attrs);
      if(_navLive){
        if(_rr.overlays)this._extractEntities(_rr.overlays,_navEx.ids,_navEx.attrs);
        if(_rr.base_image_conditions)this._extractEntities(_rr.base_image_conditions,_navEx.ids,_navEx.attrs);
        if(_rr.brightness_model)this._extractEntities(_rr.brightness_model,_navEx.ids,_navEx.attrs);
      }
    }
    for(const ch of this._navChipEls)if(ch.entity)_navEx.ids.add(ch.entity);
    // Overview chips/pills are the overview page's own state — full updates.
    for(const _t of(this._ovTiles||[]))for(const _ch of _t.chips)for(const _id of(_ch.def.entities||[]))_ex.ids.add(_id);
    for(const _p of(this._ovPills||[]))if(_p.def.entity&&!_p.def.template)_ex.ids.add(_p.def.entity);
    this._relevantEntities=[..._ex.ids];
    this._navEntities=[..._navEx.ids].filter(id=>!_ex.ids.has(id));
    this._navAttrSources=[..._navEx.attrs].map(s=>{const i=s.indexOf(' ');return{entity:s.slice(0,i),attr:s.slice(i+1)};});
    this._relevantAttrSources=[...this._extractAttrSources(c),...[..._ex.attrs].map(s=>{const i=s.indexOf(' ');return{entity:s.slice(0,i),attr:s.slice(i+1)};})];
    this._prevStates={};
    this._rendered=true;
    if(this._haEdit)this._syncStudioChip();
    this._preloadImages();
    // Editor → card highlight (panel opened in GUI editor flashes the element)
    const hlSelf=this;
    this._hlHandler=function(e){
      const d=e.detail||{};
      if(d.key!==cfgKey(hlSelf._config))return;
      const pre={zone:'[data-z="',icon:'[data-ico="',label:'[data-lbl="',gauge:'[data-gauge="',badge:'[data-b="',element:'[data-el="',overlay:'[data-ov="',vacuum_widget:'[data-vw="',glow:'[data-glow="'}[d.kind];
      if(!pre)return;
      const el=hlSelf.shadowRoot.querySelector(pre+escSel(d.id)+'"]');
      if(!el)return;
      const po=el.style.outline,poo=el.style.outlineOffset;
      el.style.outline='3px solid var(--primary-color,#03a9f4)';el.style.outlineOffset='2px';
      clearTimeout(el._rocHlT);
      el._rocHlT=setTimeout(function(){el.style.outline=po;el.style.outlineOffset=poo;},1600);
    };
    window.addEventListener('roc-highlight',this._hlHandler);
    this._startCamera();
    this._setupTemplates();
    // 30 s ticker for labels with format: relative — a real interval, so unlike
    // the observers it cannot be "re-observed"; it has to be recreated after a
    // reconnect. _relNeeded records whether this config wants one.
    this._relNeeded=(c.labels||[]).some(function(l){return l.format==='relative';});
    this._wireRelTimer();
    // Geometry-dependency flags, computed once per render so the hot paths
    // (_update / _applyResizeStyles) can skip forced layout reads entirely.
    this._needsCardWidth=rocNeedsPctWidth(c.icons,'size')||rocNeedsPctWidth(c.labels,'font_size')||rocNeedsPctWidth(c.vacuum_widgets,'size');
    this._hasDayNightGauge=(this._blindGaugeCfgs||[]).some(function(g){return g&&g._dayNight;});
    // ----- Cockpit sections: wiring (v6.8.0) --------------------------------
    this._secPanelEls={};this._secBadgeEls={};this._secTileEls={};
    for(const sx of _secList){
      const d=sx.def;
      const pEl=this.shadowRoot.querySelector('[data-section-panel="'+escSel(d.id)+'"]');
      if(!pEl)continue;
      this._secPanelEls[d.id]=pEl;
      this._secBadgeEls[d.id]=pEl.querySelector('[data-section-badge]');
      const closeBtn=pEl.querySelector('.roc-panel-close');
      if(closeBtn)closeBtn.addEventListener('click',e=>{e.stopPropagation();this._closeSection();});
      this._secTileEls[d.id]=[];
      const _tileSelf=this;
      const _secTiles=this._secResolvedTiles&&this._secResolvedTiles[d.id]||sx.tiles;
      pEl.querySelectorAll('.roc-tile').forEach(function(tileEl){
        const idx=parseInt(tileEl.dataset.tileIdx,10);
        const entry=_secTiles[idx];if(!entry)return;
        _tileSelf._secTileEls[d.id][idx]=tileEl;
        const td=rocTileDef(entry);
        // Quick buttons live inside the tile and must swallow every pointer
        // event, not just 'click' — _addZoneListeners below also listens for
        // touchstart/mousedown (to run the hold-progress ring), and those
        // would otherwise bubble up from a quick button and start a hold on
        // the tile itself while the user is only pressing a quick button.
        tileEl.querySelectorAll('[data-quick]').forEach(function(qb){
          ['mousedown','touchstart','touchend'].forEach(function(evt){
            qb.addEventListener(evt,function(e){e.stopPropagation();},{passive:true});
          });
          qb.addEventListener('click',function(e){
            e.stopPropagation();
            const qi=parseInt(qb.dataset.quick,10);
            const q=(td.quick||[])[qi];
            if(q&&q.service&&_tileSelf._hass){const dd=q.service.indexOf('.');_tileSelf._hass.callService(q.service.slice(0,dd),q.service.slice(dd+1),q.data||{},q.target);}
          });
        });
        if(td.tap_action||td.hold_action||td.double_tap_action)_tileSelf._addZoneListeners(tileEl,td.tap_action,td.hold_action,td.double_tap_action,td.hold_delay);
      });
    }
    const _secBackdropEl=this.shadowRoot.querySelector('[data-section-backdrop]');
    if(_secBackdropEl){
      const _bdSelf=this;
      _secBackdropEl.addEventListener('click',function(e){
        const openEntry=_secList.find(function(sx){return sx.def.id===_bdSelf._sectionOpen;});
        if(!openEntry||openEntry.def.backdrop===false)return;
        // v6.24.1: a click that lands on another section's launcher (behind
        // the backdrop) switches straight to that section instead of only
        // closing the current one.
        const to=_bdSelf._sectionLauncherAt(e.clientX,e.clientY);
        if(to&&to!==_bdSelf._sectionOpen){_bdSelf._openSection(to);return;}
        _bdSelf._closeSection();
      });
    }
    this._mountSectionCards(_secList,_gen);
    this._updateSectionTiles();
    this._update();
    this._syncRoomState();
    this._layoutStage();
  }

  // Snap lines (E4, v6.42.0): the VISUAL left/centre/right and top/centre/bottom of every other
  // element on the image, plus the image's edges and centre — measured from the DOM, so each
  // type's own anchoring (centred icons and glows, top-left zones…) is handled the same way.
  // All values are % of .content, like top/left.
  _snapCandidates(selfEl){
    const tops=[0,50,100],lefts=[0,50,100];
    const cont=this.shadowRoot&&this.shadowRoot.querySelector('.content');
    if(!cont)return{tops:tops,lefts:lefts};
    const cr=cont.getBoundingClientRect();
    if(!(cr.width>0&&cr.height>0))return{tops:tops,lefts:lefts};
    const seen=new Set();
    [this._zoneEls,this._icoEls,this._lblEls,this._gaugeEls,this._contEls,this._vwEls,this._glowEditEls].forEach(function(m){
      for(const k in(m||{})){
        const el=m[k];
        if(!el||el===selfEl||seen.has(el))continue;seen.add(el);
        const r=el.getBoundingClientRect();if(!(r.width>0||r.height>0))continue;
        const t=(r.top-cr.top)/cr.height*100,h=r.height/cr.height*100,l=(r.left-cr.left)/cr.width*100,w=r.width/cr.width*100;
        tops.push(t,t+h/2,t+h);lefts.push(l,l+w/2,l+w);
      }
    });
    return{tops:tops,lefts:lefts};
  }
  // Where the dragged element's visual box sits relative to its top/left (in %), so its edges
  // and centre — not only its top/left point — can snap.
  _snapBox(el,cr,top,left){
    try{
      const r=el.getBoundingClientRect();
      if(!(cr.width>0&&cr.height>0)||!(r.width>0||r.height>0))return null;
      return{dt:(r.top-cr.top)/cr.height*100-top,dl:(r.left-cr.left)/cr.width*100-left,h:r.height/cr.height*100,w:r.width/cr.width*100};
    }catch(_){return null;}
  }

  _snapPos(t,l,free,cands,box){
    if(free){this._hideGuides();return{t:t,l:l};}
    t=Math.round(t*2)/2;l=Math.round(l*2)/2; // 0.5 % grid
    const TH=0.6;
    const best=function(pos,offs,lines){
      let bd=TH,hit=null;
      for(const o of offs)for(const ln of lines){const d=Math.abs(pos+o-ln);if(d<bd){bd=d;hit={pos:ln-o,line:ln};}}
      return hit;
    };
    const oT=box?[box.dt,box.dt+box.h/2,box.dt+box.h]:[0];
    const oL=box?[box.dl,box.dl+box.w/2,box.dl+box.w]:[0];
    const hT=best(t,oT,cands.tops),hL=best(l,oL,cands.lefts);
    let gh=null,gv=null;
    if(hT){t=Math.round(hT.pos*10)/10;gh=hT.line;}
    if(hL){l=Math.round(hL.pos*10)/10;gv=hL.line;}
    if(this._gdH){if(gh!==null){this._gdH.style.top=gh+'%';this._gdH.style.display='block';}else this._gdH.style.display='none';}
    if(this._gdV){if(gv!==null){this._gdV.style.left=gv+'%';this._gdV.style.display='block';}else this._gdV.style.display='none';}
    return{t:t,l:l};
  }

  _hideGuides(){
    if(this._gdH)this._gdH.style.display='none';
    if(this._gdV)this._gdV.style.display='none';
  }

  // Active-room scoped array access for test-mode editing (drag/resize/draw)
  // An element a room INHERITS (the room has no list of its own) lives in the top-level list:
  // edits go there. Only when neither has one is the room's list created. (Before v6.42.0 the
  // room got a new EMPTY list here, which hid the inherited elements after a drag.)
  _roomArr(nc,key){
    if(this._editGlobal){if(!nc[key])nc[key]=[];return nc[key];}
    const t=Array.isArray(nc.rooms)&&nc.rooms.length?nc.rooms[Math.max(0,Math.min(this._roomIdx,nc.rooms.length-1))]:nc;
    if(Array.isArray(t[key]))return t[key];
    if(t!==nc&&Array.isArray(nc[key]))return nc[key];
    t[key]=[];
    return t[key];
  }
  // The list a NEW element is added to: the room's own; when the room so far inherited the
  // shared list, it gets a copy of it first, so what is on screen stays.
  _roomArrNew(nc,key){
    if(this._editGlobal){if(!nc[key])nc[key]=[];return nc[key];}
    const t=Array.isArray(nc.rooms)&&nc.rooms.length?nc.rooms[Math.max(0,Math.min(this._roomIdx,nc.rooms.length-1))]:nc;
    if(!Array.isArray(t[key]))t[key]=(t!==nc&&Array.isArray(nc[key]))?rocClone(nc[key]):[];
    return t[key];
  }

  // Resolve an entity option: plain string, or per-device mapping
  // {default, by_user: {<HA user name>: entity}, by_browser: {<browser_mod id>: entity}}
  _resolveMapEntity(re){
    if(!re)return null;
    if(typeof re==='string')return re;
    const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id;
    if(re.by_browser&&bid&&re.by_browser[bid])return re.by_browser[bid];
    const un=this._hass&&this._hass.user&&this._hass.user.name;
    if(re.by_user&&un){
      for(const k in re.by_user)
        if(String(k).toLowerCase()===String(un).toLowerCase())return re.by_user[k];
    }
    return re.default||null;
  }

  _roomEntityId(){return this._resolveMapEntity(this._config?this._config.room_entity:null);}

  // Presence entity for the FOLLOW BUTTON — like _roomEntityId but a per-device
  // mapping must match THIS device explicitly (by_browser/by_user). 'default'
  // does NOT count, so unmapped devices (e.g. a laptop not in the browser list)
  // get no button. A plain-string room_entity applies to every device.
  _followBtnEntity(){
    const re=this._config&&this._config.room_entity;
    if(!re)return null;
    if(typeof re==='string')return re;
    const bid=window.browser_mod?.browserID||window.browser_mod?.browser_id;
    if(re.by_browser&&bid&&re.by_browser[bid])return re.by_browser[bid];
    const un=this._hass&&this._hass.user&&this._hass.user.name;
    if(re.by_user&&un){for(const k in re.by_user)if(String(k).toLowerCase()===String(un).toLowerCase())return re.by_user[k];}
    return null;
  }

  // Mirror the active room into a writable helper entity (input_text /
  // input_select) so automations and other cards can react to it
  // Move the "active room" marker in a carried-over nav strip (thumbnails:
  // data-act + border; dots/tabs: their own active colours) — the same
  // values _render() writes into fresh markup.
  _navSetActive(idx){
    const nav=this.shadowRoot&&this.shadowRoot.querySelector('.roc-nav');if(!nav)return;
    nav.querySelectorAll('[data-nav-room]').forEach(function(b){
      const act=parseInt(b.getAttribute('data-nav-room'),10)===idx;
      if(b.classList.contains('roc-thumb')){
        if(act)b.setAttribute('data-act','');else b.removeAttribute('data-act');
        b.style.borderColor=act?'var(--primary-color,#03a9f4)':'transparent';
      }else if(b.style.borderRadius==='50%'){
        b.style.background=act?'var(--primary-color,#03a9f4)':'var(--divider-color,#666)';
      }else{
        b.style.borderColor=act?'var(--primary-color,#03a9f4)':'var(--divider-color,#444)';
        b.style.background=act?'rgba(3,169,244,0.15)':'none';
      }
      if(act)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
    });
  }

  _syncRoomState(){
    const cAll=this._config;
    if(!this._hass||!Array.isArray(cAll.rooms)||!cAll.rooms.length)return;
    const rse=this._resolveMapEntity(cAll.room_state_entity);
    if(!rse)return;
    const r=cAll.rooms[Math.max(0,Math.min(this._roomIdx,cAll.rooms.length-1))];
    const val=r.name||r.id||'';
    const cur=this._hass.states[rse]?.state;
    const dom=rse.split('.')[0];
    if(dom==='input_text'){
      if(cur!==val)this._hass.callService('input_text','set_value',{entity_id:rse,value:val});
    }else if(dom==='input_select'||dom==='select'){
      const opts=this._hass.states[rse]?.attributes?.options||[];
      const opt=opts.find(function(o){
        const ol=String(o).toLowerCase();
        return ol===String(r.id||'').toLowerCase()||ol===String(r.name||'').toLowerCase();
      });
      if(opt&&opt!==cur)this._hass.callService(dom,'select_option',{entity_id:rse,option:opt});
    }
  }

  // ---- URL deep-linking (opt-in via url_sync) --------------------------------
  // url_sync: true → hash key 'room'; url_sync: 'mykey' → custom key. Produces
  // bookmarkable URLs like …/lovelace/home#room=bedroom, reacts to back/forward
  // and external hash edits, and rewrites the hash on every room switch. Off by
  // default; the room value matches a room id / name / area_match (via roomMatch).
  _urlSyncKey(){
    const u=this._config&&this._config.url_sync;
    if(!u)return null;
    return(typeof u==='string'&&u.trim())?u.trim():'room';
  }
  _roomIdxFromHash(){
    const key=this._urlSyncKey();
    if(!key||typeof location==='undefined'||!this._config||!Array.isArray(this._config.rooms))return -1;
    const h=String(location.hash||'').replace(/^#/,'');
    if(!h)return -1;
    let val=null;
    h.split('&').forEach(function(p){
      const eq=p.indexOf('=');
      if(eq>0&&decodeURIComponent(p.slice(0,eq))===key)val=decodeURIComponent(p.slice(eq+1));
    });
    return val===null?-1:roomMatch(this._config,val);
  }
  _writeRoomHash(idx){
    const key=this._urlSyncKey();
    if(!key||typeof location==='undefined'||!this._config||!Array.isArray(this._config.rooms))return;
    const r=this._config.rooms[Math.max(0,Math.min(idx,this._config.rooms.length-1))];
    const val=encodeURIComponent(String(r.id||r.name||idx));
    // Keep any unrelated hash params, replace just our key
    const parts=String(location.hash||'').replace(/^#/,'').split('&').filter(Boolean)
      .filter(function(p){const eq=p.indexOf('=');return!(eq>0&&decodeURIComponent(p.slice(0,eq))===key);});
    parts.push(encodeURIComponent(key)+'='+val);
    const newHash='#'+parts.join('&');
    if((location.hash||'')===newHash)return; // already current
    try{history.replaceState(history.state,'',location.pathname+location.search+newHash);}
    catch(_){this._hashMuted=true;location.hash=newHash;this._hashMuted=false;}
  }

  // Jump to the room reported by the presence sensor (used by the nav button
  // and the follow-room action); clears the manual-navigation hold
  _followNow(){
    const reId=this._roomEntityId();
    if(!reId||!this._hass)return;
    const ri=roomMatch(this._config,this._hass.states[reId]?.state);
    if(ri<0)return;
    this._manualHoldUntil=0;
    if(ri!==this._roomIdx)this._switchRoom(ri,ri>this._roomIdx?1:-1,false);
  }

  // Remember the room currently shown, so the editor can open on it (see ROC_ROOM_MEM).
  _rememberRoom(){
    try{
      const cAll=this._config;
      if(!cAll||!Array.isArray(cAll.rooms)||!cAll.rooms.length)return;
      const r=cAll.rooms[Math.max(0,Math.min(this._roomIdx,cAll.rooms.length-1))];
      if(r)ROC_ROOM_MEM.set(cfgKey(cAll),String(r.id||r.name||this._roomIdx));
    }catch(_){}
  }

  _switchRoom(idx,dir,manual,noGhost){
    const cAll=this._config;
    if(!Array.isArray(cAll.rooms)||idx<0||idx>=cAll.rooms.length||idx===this._roomIdx)return;
    if(manual)this._manualHoldUntil=Date.now()+((cAll.follow_hold??60)*1000);
    if(Math.abs(idx-this._roomIdx)>1)dir=0; // non-adjacent → crossfade
    if(rocReducedMotion())dir=0; // reduced motion: crossfade, no slide
    // Ghost of the old room for the transition (embedded cards render blank in
    // the clone for ~0.3 s — acceptable)
    this._ovAnimFinish();
    // Overview page ↔ room (O14): decided on what is on screen NOW; a swipe
    // (noGhost) keeps its own drag preview.
    const _ovPlan=(!noGhost&&rocOvAny(cAll))?this._ovPlanSwitch(idx,manual):null;
    const oldContent=this.shadowRoot?this.shadowRoot.querySelector('.wrap .content'):null;
    let ghost=null;
    if(oldContent&&!noGhost&&!_ovPlan){ // swipe-commit passes noGhost — the drag preview already covers the transition (and a translated clone leaks a sliver under lock_aspect)
      ghost=rocGhostClone(oldContent);
      ghost.style.position='absolute';ghost.style.inset='0';ghost.style.zIndex='600';
      ghost.style.pointerEvents='none';
      ghost.style.transition='transform .3s ease,opacity .3s ease';
    }
    if(this._sectionOpen)this._closeSection(); // COCKPIT_PLAN.md kap.7: panel closes on room switch
    this._roomIdx=idx;
    this._rememberRoom(); // record the room the user switched to (for the editor)
    // Editor preview instance (see _mountPreview): tell the editor GUI so its
    // Room select / per-room panels follow clicks made inside the live preview's
    // own nav strip, instead of silently staying on the previously selected room.
    if(cAll._roc_preview)window.dispatchEvent(new CustomEvent('roc-room-switch',{detail:{cfgKey:cfgKey(cAll),idx:idx}}));
    if(typeof this._rocRoomSink==='function')try{this._rocRoomSink(idx);}catch(_){} // studio canvas: outline + inspector follow the room
    this._rendered=false;
    this._navKeep=true;
    const _gateOpen=ghost?rocGateCards(600):null; // embedded cards of the new room mount once the slide has started
    try{this._render();}finally{this._navKeep=false;}
    if(_ovPlan)this._ovRun(_ovPlan);
    const wrap=this.shadowRoot.querySelector('.wrap');
    const ncontent=this.shadowRoot.querySelector('.content');
    if(ghost&&wrap&&ncontent){
      wrap.appendChild(ghost);
      // v6.43.0: the old room used to stay frozen on screen for ~1/3 s after a wheel / nav switch
      // and the slide was then cut short (a black strip at the edge). Three causes, three fixes:
      //  · the ghost was a deep clone, so every embedded HA card in it was constructed again
      //    just to slide out → rocGhostClone copies plain boxes instead;
      //  · the slide ran on the main thread, so it froze while the new room mounted its embedded
      //    cards → both layers are promoted (will-change) and the compositor runs it;
      //  · the ghost was removed 380 ms after the SWITCH, not after the slide, so a slide that
      //    started late was cut off → it is removed when its own transition ends (fallback
      //    timer from the moment the slide starts; in a hidden tab rAF never fires, so a last
      //    timer still cleans up).
      let cleaned=false;
      const cleanup=function(){
        if(cleaned)return;cleaned=true;
        ghost.remove();
        if(ncontent){ncontent.style.transition='';ncontent.style.willChange='';}
      };
      ghost.style.willChange=dir?'transform':'opacity';
      ghost.addEventListener('transitionend',function(ev){if(ev.target===ghost)cleanup();});
      if(dir){
        ncontent.style.transition='none';
        ncontent.style.willChange='transform';
        ncontent.style.transform='translateX('+(dir*100)+'%)';
        requestAnimationFrame(function(){
          ncontent.style.transition='transform .3s ease';
          ncontent.style.transform='';
          ghost.style.transform='translateX('+(-dir*100)+'%)';
          setTimeout(cleanup,420);
          setTimeout(_gateOpen,0); // after this frame is committed: the compositor carries the slide
        });
      }else{
        requestAnimationFrame(function(){ghost.style.opacity='0';setTimeout(cleanup,420);setTimeout(_gateOpen,0);});
      }
      setTimeout(cleanup,1500);
    }else if(_gateOpen)_gateOpen();
    // Manual switches sync back to a writable room_entity (input_select/select)
    const _reW=this._roomEntityId();
    if(manual&&_reW&&this._hass){
      const dom=_reW.split('.')[0];
      if(dom==='input_select'||dom==='select'){
        const r=cAll.rooms[idx];
        const opts=this._hass.states[_reW]?.attributes?.options||[];
        const opt=opts.find(function(o){
          const ol=String(o).toLowerCase();
          return ol===String(r.id||'').toLowerCase()||ol===String(r.name||'').toLowerCase()||(Array.isArray(r.area_match)&&r.area_match.some(function(a){return String(a).toLowerCase()===ol;}));
        });
        if(opt)this._hass.callService(dom,'select_option',{entity_id:_reW,option:opt});
      }
    }
    this._writeRoomHash(idx); // keep the URL hash in sync (opt-in via url_sync)
    this._syncRoomState();
  }

  _startCamera(){
    if(this._camTimer){clearInterval(this._camTimer);this._camTimer=null;}
    if(this._config&&this._config._roc_ghost)return; // swipe ghosts live <0.5 s — no camera churn
    // base_camera / camera_refresh are room-scoped keys → use the merged room view
    const c=this._roomCfg||this._config;if(!c||!c.base_camera)return;
    const iv=Math.max(2,c.camera_refresh??10)*1000;
    const self=this;
    const tick=function(){
      if(!self._hass||!self._visible||!self._baseEl)return;
      const st=self._hass.states[c.base_camera];
      const ep=st&&st.attributes&&st.attributes.entity_picture;
      if(!ep)return;
      const url=ep+(ep.includes('?')?'&':'?')+'_roc='+Date.now();
      const img=new Image();
      img.onload=function(){if(self._baseEl)self._baseEl.style.backgroundImage='url("'+url.replace(/"/g,'%22')+'")';};
      img.src=url;
    };
    tick();
    this._camTimer=setInterval(tick,iv);
  }

  _teardownTemplates(){
    (this._tmplUnsubs||[]).forEach(function(u){
      try{
        if(u&&typeof u.then==='function')u.then(function(f){try{if(typeof f==='function')f();else if(f&&f.unsubscribe)f.unsubscribe();}catch(_){}}).catch(function(){});
        else if(typeof u==='function')u();
      }catch(_){}
    });
    this._tmplUnsubs=[];this._tmplVals={};this._tmplVis={};
  }

  _setupTemplates(){
    // MERGED room view, not this._config: labels/badges/zones/icons/overlays/
    // elements/gauges are all ROOM_KEYS, so roomMerge() REPLACES the top-level
    // arrays with rooms[i]'s. Reading this._config here meant that in any
    // rooms: config the per-room templates were never subscribed at all (the
    // element ids didn't match, so every lookup silently `continue`d) — no
    // warning, the label just never updated. Fixed v5.9.14; _startCamera()
    // already did this correctly.
    const c=this._roomCfg||this._config,self=this;
    // nav.live:full minis subscribe to templates only when nav.mini.templates
    // opts in (§5 NAV_LIVE_FULL_PLAN.md — a real per-instance WS subscription
    // cost, off by default for up to 8 persistent instances).
    if(!this._hass||!this._hass.connection||c._roc_ghost||(c._roc_mini&&!c._roc_mini_templates))return;
    const sub=function(tpl,cb){
      try{
        // .catch is REQUIRED: HA rejects the subscription for an invalid Jinja
        // template, and an uncaught rejection surfaces in the console with no
        // card context at all. Resolving to null keeps the unsub loop safe —
        // _teardownTemplates already type-checks before calling.
        const p=self._hass.connection.subscribeMessage(function(msg){cb(msg?msg.result:undefined);},{type:'render_template',template:tpl})
          .catch(function(e){console.warn('[room-overlay-card] template failed:',tpl,e);return null;});
        self._tmplUnsubs.push(p);
      }catch(e){console.warn('[room-overlay-card] template subscribe failed:',e);}
    };
    // Overview header pills with a `template:` (v6.30.0)
    for(const p of(this._ovPills||[])){
      if(!p.def.template||!p.valEl)continue;
      const el=p.valEl;
      sub(p.def.template,function(r){const v=r!==undefined&&r!==null?String(r):'';if(el.textContent!==v)el.textContent=v;});
    }
    // Label text templates
    for(const lbl of(c.labels||[])){
      if(!lbl.template)continue;
      const el=this._lblEls[lbl.id];if(!el)continue;
      const lblId=lbl.id,grad=this._sortedLblGrads[lblId];
      sub(lbl.template,function(r){
        const v=r!==undefined&&r!==null?String(r):'';
        self._tmplVals[lblId]=v;
        if(el.textContent!==v)el.textContent=v;
        if(grad){const nv=parseFloat(v);if(!isNaN(nv))el.style.color=lerpColorGradient(grad,nv,true);}
      });
    }
    // Badge label templates
    for(const b of(c.badges||[])){
      if(!b.label_template)continue;
      const lel=this._blabelEls[b.id];if(!lel)continue;
      sub(b.label_template,function(r){
        const v=r!==undefined&&r!==null?String(r):'';
        if(lel.textContent!==v)lel.textContent=v;
      });
    }
    // visible_template — zones, icons, badges, overlays, elements, gauges (incl. blinds)
    const vis=function(key,tpl,el,showDisp,it){
      if(!tpl||!el)return;
      sub(tpl,function(r){
        const ok=tmplTruthy(r);
        self._tmplVis[key]=ok;
        self._setVis(el,ok,showDisp,it&&it.fade,it&&it.slide);
      });
    };
    for(const z of(c.zones||[]))vis('z:'+z.id,z.visible_template,this._zoneEls[z.id],'',z);
    for(const ico of(c.icons||[]))vis('i:'+ico.id,ico.visible_template,this._icoEls[ico.id],'flex',ico);
    for(const b of(c.badges||[]))vis('b:'+b.id,b.visible_template,this._bcontEls[b.id],'flex',b);
    for(const ov of(c.overlays||[]))vis('o:'+ov.id,ov.visible_template,this._ovEls[ov.id],'',null);
    for(const gw of(c.glows||[]))vis('gw:'+gw.id,gw.visible_template,this._glowEls[gw.id],'',gw);
    for(const e of(c.elements||[]))vis('e:'+e.id,e.visible_template,this._contEls[e.id],'block',e);
    for(const g of[...(c.gauges||[]),...(this._blindGaugeCfgs||[])])vis('g:'+g.id,g.visible_template,this._gaugeEls[g.id],'',g);
    // Cockpit sections: `visible_template` (whole section) + templated tile
    // `state`/`value` (COCKPIT_PLAN.md kap.3.1/3.2). Top-level `this._config`,
    // not the room-merged `c` — `sections:` isn't a ROOM_KEYS field. Skipped
    // for nav.live minis (no panel DOM was built for them — see _render()).
    if(!c._roc_mini)for(const sx of this._getSections(this._config)){
      const d=sx.def,secId=d.id;
      if(d.visible_template)sub(d.visible_template,function(r){
        const ok=tmplTruthy(r);
        self._secVisMap[secId]=ok;
        if(!ok&&self._sectionOpen===secId)self._closeSection();
      });
      ((self._secResolvedTiles&&self._secResolvedTiles[secId])||sx.tiles).forEach(function(entry,idx){
        const td=rocTileDef(entry);
        if(typeof td.state==='string'&&td.state.indexOf('{{')>=0)sub(td.state,function(r){
          const v=r!==undefined&&r!==null?String(r):'';
          const tileEl=self._secTileEls&&self._secTileEls[secId]&&self._secTileEls[secId][idx];
          const stateEl=tileEl&&tileEl.querySelector('[data-tile-state]');
          if(stateEl&&stateEl.textContent!==v)stateEl.textContent=v;
        });
        if(typeof td.value==='string'&&td.value.indexOf('{{')>=0)sub(td.value,function(r){
          const v=r!==undefined&&r!==null?String(r):'';
          const tileEl=self._secTileEls&&self._secTileEls[secId]&&self._secTileEls[secId][idx];
          const valEl=tileEl&&tileEl.querySelector('[data-tile-value]');
          if(valEl&&valEl.textContent!==v)valEl.textContent=v;
        });
      });
    }
  }

  _setGrpVis(el,show){
    if(!el)return;
    // Respect item-level fade state (rocFv) when the group comes back
    const v=(!show||el.dataset.rocFv==='0')?'hidden':'';
    if(el.style.visibility!==v){
      el.style.visibility=v;
      el.style.opacity=v?'0':'';
    }
  }

  // Item visibility with optional fade/slide animation.
  // fd: true|seconds, sl: up|down|left|right (slide implies fade)
  _setVis(el,show,disp,fd,sl){
    if(!el)return;
    if(!fd&&!sl){setSt(el,'display',show?disp:'none');return;}
    setSt(el,'display',disp); // keep in layout — animate via opacity/visibility
    if(typeof fd==='number'&&fd>0)el.style.transitionDuration=fd+'s';
    const key=show?'1':'0';
    if(el.dataset.rocFv!==key){
      el.dataset.rocFv=key;
      el.style.visibility=show?'':'hidden';
      el.style.opacity=show?'':'0';
      if(sl){
        const ax=(sl==='up'||sl==='down')?'Y':'X';
        const sign=(sl==='down'||sl==='right')?'-':'';
        el.style.transform=show?'':'translate'+ax+'('+sign+'10px)';
      }
    }
  }

  // 3D parallax tilt of the whole scene. Pointer-driven on desktop; device
  // orientation on platforms that expose it without a permission prompt
  // (iOS requires a user-gesture prompt, deliberately not triggered here).
  _attachParallax(wrap,content){
    const self=this;
    const pc=typeof this._roomCfg.parallax==='object'&&this._roomCfg.parallax?this._roomCfg.parallax:{};
    const strength=pc.strength??6,scale=pc.scale??1.04;
    const src=pc.source||'auto';
    wrap.style.perspective='900px';
    let raf=0,tx=0,ty=0;
    const apply=function(){
      raf=0;
      if(self._zoomScale>1||self._roomDragActive)return; // those gestures own the transform
      content.style.transition='transform .12s ease-out';
      content.style.transform=(tx===0&&ty===0)?'':'scale('+scale+') rotateX('+ty.toFixed(2)+'deg) rotateY('+tx.toFixed(2)+'deg)';
    };
    const queue=function(){if(!raf)raf=requestAnimationFrame(apply);}; // visual-only (parallax); pointer events don't occur in hidden tabs
    if(src!=='orientation'){
      wrap.addEventListener('pointermove',function(e){
        if(e.pointerType==='touch')return;
        const r=wrap.getBoundingClientRect();
        tx=((e.clientX-r.left)/r.width-0.5)*2*strength;
        ty=-((e.clientY-r.top)/r.height-0.5)*2*strength;
        queue();
      });
      wrap.addEventListener('pointerleave',function(){tx=0;ty=0;queue();});
    }
    if((src==='orientation'||src==='auto')&&typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission!=='function'){
      const oh=function(ev){
        if(ev.gamma===null||ev.beta===null)return;
        tx=Math.max(-strength,Math.min(strength,ev.gamma/4));
        ty=Math.max(-strength,Math.min(strength,-(ev.beta-45)/4));
        queue();
      };
      window.addEventListener('deviceorientation',oh);
      this._orientHandler=oh;
    }
  }

  // Live room drag: content follows the finger, the neighbour's base image is
  // revealed alongside; release past 25 % width (or fling) commits the switch.
  // nav.wheel: true|'horizontal' → horizontal wheel/touchpad (deltaX) ·
  // 'vertical' → deltaY · 'both' → either. Ctrl+wheel stays zoom.
  // One gesture = one room: a touchpad swipe keeps sending (momentum) events
  // for a second or two; after a switch the rest of that gesture is swallowed
  // until the stream pauses for 150 ms (3 s at most).
  _onWheel(e){
    const cAll=this._config;
    if(!cAll||cAll.test_mode||!Array.isArray(cAll.rooms)||cAll.rooms.length<2)return;
    const mode=(cAll.nav||{}).wheel;
    if(!mode||e.ctrlKey||this._zoomScale>1)return; // leave zoom alone
    const path=e.composedPath?e.composedPath():[];
    const has=function(cls){return path.some(function(n){return n&&n.classList&&n.classList.contains(cls);});};
    // Only the room picture (and the gaps of the layout grid) switch rooms; the
    // nav strip, light pills, cover dock… keep their own wheel. While an
    // overview transition runs the picture may be hidden — catch everything.
    const ax=Math.abs(e.deltaX),ay=Math.abs(e.deltaY);
    if(!this._ovAnim&&!has('wrap')&&path.some(function(n){return n&&n.classList&&n.classList.contains('roc-reg')&&n.dataset.reg!=='image';})){
      // …but a sideways swipe that nothing there can scroll any further must
      // not reach the page either (browser Back swipe).
      if(ax>ay&&!path.some(function(n){
        if(!n||n.nodeType!==1||n.scrollWidth<=n.clientWidth+1)return false;
        const ox=getComputedStyle(n).overflowX;if(ox!=='auto'&&ox!=='scroll')return false;
        return e.deltaX<0?n.scrollLeft>0:n.scrollLeft+n.clientWidth<n.scrollWidth-1;
      }))e.preventDefault();
      return;
    }
    // Overview page: a vertical wheel over the room grid / a side column scrolls it
    if(this._ovActive&&!this._ovAnim&&ay>=ax&&(has('roc-ov-grid')||has('roc-ov-side')))return;
    const useX=mode===true||mode==='horizontal'||mode==='both';
    const useY=mode==='vertical'||mode==='both';
    let d=0;
    if(useX&&ax>ay)d=e.deltaX;
    else if(useY&&ay>=ax)d=e.deltaY;
    if(!d)return;
    // Every event of a horizontal gesture is cancelled — also its tiny first
    // ones: Chrome makes the rest of a gesture non-cancelable when its first
    // event was not, and then the touchpad swipe becomes a browser Back.
    e.preventDefault();
    // A pause is measured from the end of the previous handling to this
    // event's input time: a room switch can block the main thread for a few
    // hundred ms, and the events queued meanwhile must not look like a pause.
    const now=e.timeStamp||performance.now(),gap=now-(this._wheelLast||-1e9);
    const self=this,done=function(){self._wheelLast=Math.max(now,performance.now());};
    if(this._wheelLock){
      if(gap<150&&now-this._wheelLock<3000){done();return;}
      this._wheelLock=0;
    }
    if(Math.abs(d)<6){done();return;}
    this._wheelLock=now;
    const n=cAll.rooms.length;
    if(d>0)this._switchRoom((this._roomIdx+1)%n,1,true);
    else this._switchRoom((this._roomIdx-1+n)%n,-1,true);
    done();
  }
  _attachRoomDrag(wrap){
    const self=this;
    this._wrapTA='pan-y';
    wrap.style.touchAction='pan-y';
    let pid=null,sx=0,sy=0,active=false,engaged=false,dx=0,prev=null,dir2=0,w=0,moved=false,lastX=0,lastT=0,vx=0;
    const content=function(){return self.shadowRoot?self.shadowRoot.querySelector('.wrap .content'):null;};
    wrap.addEventListener('pointerdown',function(e){
      if(self._zoomScale>1)return;
      const path=e.composedPath?e.composedPath():[];
      // Slider zones, embedded HA cards (sliders, covers…) and an open cockpit
      // section sheet (a tile card's own percentage slider must never engage
      // the room-swipe running underneath it — v6.10.1) own their gestures.
      if(path.some(function(n){return(n.dataset&&n.dataset.rocSlider)||(n.classList&&(n.classList.contains('elcont')||n.classList.contains('roc-panel')||n.classList.contains('roc-ov-hd')||n.classList.contains('roc-ov-side')));}))return;
      pid=e.pointerId;sx=e.clientX;sy=e.clientY;active=true;engaged=false;dx=0;
      lastX=e.clientX;lastT=Date.now();vx=0;
      w=wrap.getBoundingClientRect().width||1;
    });
    wrap.addEventListener('pointermove',function(e){
      if(!active||e.pointerId!==pid)return;
      dx=e.clientX-sx;
      const now=Date.now();
      if(now>lastT){vx=(e.clientX-lastX)/(now-lastT);lastX=e.clientX;lastT=now;}
      if(!engaged){
        const dy=e.clientY-sy;
        if(Math.abs(dx)<12||Math.abs(dx)<1.5*Math.abs(dy))return; // horizontal intent only
        engaged=true;moved=true;self._roomDragActive=true;
        try{wrap.setPointerCapture(pid);}catch(_){}
        dir2=dx<0?1:-1;
        const n=self._config.rooms.length;
        const ni=(self._roomIdx+dir2+n)%n;
        prev=document.createElement('div');
        prev.style.cssText='position:absolute;inset:0;z-index:590;pointer-events:none;overflow:hidden;background:#000;';
        wrap.appendChild(prev);
        self._renderNeighbourPreview(prev,ni); // full-room render (img+filters+overlays+states)
        const ct=content();if(ct)ct.style.transition='none';
      }
      e.preventDefault();
      const ndir=dx<0?1:-1;
      if(ndir!==dir2&&prev){ // direction flipped mid-drag → swap neighbour preview
        dir2=ndir;
        const n=self._config.rooms.length;
        self._renderNeighbourPreview(prev,(self._roomIdx+dir2+n)%n);
      }
      const ct=content();
      if(ct)ct.style.transform='translateX('+dx+'px)';
      if(prev)prev.style.transform='translateX('+(dir2>0?w+dx:-w+dx)+'px)';
    });
    wrap.addEventListener('pointerup',function(){
      if(!active)return;
      active=false;
      if(!engaged)return;
      engaged=false;self._roomDragActive=false;self._lastRoomDragEnd=Date.now();
      const ct=content();
      const fling=Math.abs(vx)>0.5&&(vx<0)===(dir2>0);
      const commit=Math.abs(dx)>w*0.25||fling;
      const pv=prev;prev=null;
      if(commit){
        const n=self._config.rooms.length;
        const ni=(self._roomIdx+dir2+n)%n;
        const target=dir2>0?-w:w;
        if(ct){ct.style.transition='transform .18s ease-out';ct.style.transform='translateX('+target+'px)';}
        if(pv){pv.style.transition='transform .18s ease-out';pv.style.transform='translateX(0)';}
        setTimeout(function(){
          self._switchRoom(ni,0,true,true); // re-render under the settled preview (no crossfade ghost — pv already covers it)
          setTimeout(function(){if(pv)pv.remove();},80);
        },180);
      }else{
        if(ct){ct.style.transition='transform .2s ease';ct.style.transform='';}
        if(pv){pv.style.transition='transform .2s ease';pv.style.transform='translateX('+(dir2>0?w:-w)+'px)';setTimeout(function(){pv.remove();},230);}
        setTimeout(function(){const c2=content();if(c2)c2.style.transition='';},230);
      }
    });
    wrap.addEventListener('pointercancel',function(){
      if(prev){prev.remove();prev=null;}
      const ct=content();if(ct){ct.style.transition='';ct.style.transform='';}
      active=false;engaged=false;moved=false;self._roomDragActive=false;self._lastRoomDragEnd=Date.now();
    });
    // Swallow the click that follows a drag (capture phase beats zone handlers)
    wrap.addEventListener('click',function(e){if(moved){moved=false;e.stopImmediatePropagation();e.preventDefault();}},true);
  }

  // Full-room neighbour preview for the finger-drag: a real, non-interactive
  // card instance rendering the target room — image + filters + overlays + live
  // states (not just the base image). Falls back to the plain base image if the
  // instance can't be created. Reuses the same pattern as the editor live preview.
  _renderNeighbourPreview(prevEl,idx){
    const cAll=this._config;
    const r=(cAll.rooms&&cAll.rooms[idx])||null;
    if(prevEl._ghost){try{prevEl._ghost.remove();}catch(_){}prevEl._ghost=null;}
    prevEl.style.backgroundImage='';
    try{
      const gc=document.createElement('room-overlay-card');
      const gcfg=rocClone(cAll);
      gcfg.follow_mode='manual';                              // no presence jumps in the ghost
      gcfg._roc_preview=true;                                 // suppress Save button etc.
      gcfg._roc_ghost=true;                                   // skip template subscriptions & camera timers (<0.5 s lifetime)
      gcfg.test_mode=false;
      gcfg.nav=Object.assign({},gcfg.nav||{},{style:'none'}); // the real card owns the nav strip
      delete gcfg.cards_above;delete gcfg.cards_below;delete gcfg.light_controls; // keep the preview to the image box…
      // …and strip the PER-ROOM strips too — cards_above/below and light_controls are room-scoped
      // (in ROOM_KEYS), so the previewed room pulls its own from rooms[idx];
      // without this they render above/below the ghost image and slide in with it.
      if(Array.isArray(gcfg.rooms))gcfg.rooms.forEach(function(_r){if(_r){delete _r.cards_above;delete _r.cards_below;delete _r.light_controls;}});
      delete gcfg.url_sync;                                   // the ghost must never touch the URL hash
      gc.style.cssText='display:block;position:absolute;top:0;left:0;width:100%;height:100%;';
      gc.setConfig(gcfg);
      gc._roomIdx=Math.max(0,Math.min(idx,(cAll.rooms||[]).length-1));
      if(this._hass)gc.hass=this._hass;
      prevEl.appendChild(gc);
      prevEl._ghost=gc;
    }catch(e){
      prevEl.style.backgroundSize='cover';
      prevEl.style.backgroundPosition='center';
      prevEl.style.backgroundImage=r&&r.base_image?'url("'+String(r.base_image).replace(/"/g,'%22')+'")':'';
    }
  }

  _attachZoom(wrap,content){
    const ptrs=new Map();
    const zSelf=this;
    let scale=1,tx=0,ty=0,lastDist=0,lastTap=0;
    const apply=function(){
      const r=wrap.getBoundingClientRect();
      const maxX=(scale-1)*r.width/2,maxY=(scale-1)*r.height/2;
      tx=Math.max(-maxX,Math.min(maxX,tx));
      ty=Math.max(-maxY,Math.min(maxY,ty));
      content.style.transform=scale>1?'translate('+tx+'px,'+ty+'px) scale('+scale+')':'';
      wrap.style.touchAction=scale>1?'none':(zSelf._wrapTA||'');
      zSelf._zoomScale=scale;
    };
    wrap.addEventListener('pointerdown',function(e){
      ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(ptrs.size===2){const a=[...ptrs.values()];lastDist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
    });
    wrap.addEventListener('pointermove',function(e){
      if(!ptrs.has(e.pointerId))return;
      const p=ptrs.get(e.pointerId);
      if(ptrs.size===2){
        ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
        const a=[...ptrs.values()];
        const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
        if(lastDist>0){scale=Math.max(1,Math.min(4,scale*d/lastDist));apply();}
        lastDist=d;
        e.preventDefault();
      }else if(ptrs.size===1&&scale>1){
        tx+=e.clientX-p.x;ty+=e.clientY-p.y;
        ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
        apply();
        e.preventDefault();
      }
    });
    const end=function(e){
      ptrs.delete(e.pointerId);
      lastDist=0;
      const now=Date.now();
      if(now-lastTap<300){scale=1;tx=0;ty=0;apply();} // double tap resets
      lastTap=now;
    };
    wrap.addEventListener('pointerup',end);
    wrap.addEventListener('pointercancel',function(e){ptrs.delete(e.pointerId);lastDist=0;});
    wrap.addEventListener('wheel',function(e){ // desktop: Ctrl+wheel
      if(!e.ctrlKey)return;
      e.preventDefault();
      scale=Math.max(1,Math.min(4,scale*(e.deltaY<0?1.15:0.87)));
      apply();
    },{passive:false});
  }

  _attachSlider(el,z){
    const self=this,sl=z.slider;
    el.style.touchAction='none';
    el.dataset.rocSlider='1';
    const horiz=sl.direction==='horizontal';
    const fill=document.createElement('div');
    fill.className='zslider-fill';
    fill.style.cssText='position:absolute;pointer-events:none;background:'+(sl.color||'rgba(255,255,255,0.28)')+';opacity:0;transition:opacity .2s;'+(horiz?'left:0;top:0;bottom:0;width:0%;':'left:0;right:0;bottom:0;height:0%;');
    el.appendChild(fill);
    // Value bubble — precise readout while dragging
    const bub=document.createElement('div');
    bub.className='zslider-bubble';
    bub.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;background:rgba(0,0,0,0.78);color:#fff;font-family:monospace;font-size:12px;font-weight:600;padding:3px 9px;border-radius:10px;opacity:0;transition:opacity .15s;white-space:nowrap;z-index:5;';
    el.appendChild(bub);
    // min/max: explicit slider config → entity attributes (climate min_temp/max_temp,
    // number min/max) → generic 0–100. Keeps climate sliders in a sane range.
    const _range=function(){
      const dom=sl.entity.split('.')[0];
      const attr=(self._hass&&self._hass.states[sl.entity]&&self._hass.states[sl.entity].attributes)||{};
      if(dom==='climate')return[sl.min??attr.min_temp??7,sl.max??attr.max_temp??35];
      if(dom==='number'||dom==='input_number')return[sl.min??attr.min??0,sl.max??attr.max??100];
      return[sl.min??0,sl.max??100];
    };
    const _fmtVal=function(p){
      const dom=sl.entity.split('.')[0];
      if(dom==='light'||dom==='cover'||dom==='fan'||dom==='media_player')return Math.round(p*100)+' %';
      const r=_range();
      if(dom==='climate')return(Math.round((r[0]+p*(r[1]-r[0]))*2)/2)+' °';
      return String(Math.round((r[0]+p*(r[1]-r[0]))*100)/100);
    };
    let active=false,moved=false,pct=0,sx=0,sy=0,lastSent=0;
    const calc=function(ev){
      const r=el.getBoundingClientRect();
      let p=horiz?(ev.clientX-r.left)/r.width:1-(ev.clientY-r.top)/r.height;
      if(sl.invert)p=1-p;
      return Math.max(0,Math.min(1,p));
    };
    const apply=function(p){
      const h=self._hass;if(!h)return;
      const ent=sl.entity,dom=ent.split('.')[0];
      const _r=_range(),mn=_r[0],mx=_r[1];
      if(dom==='light')h.callService('light','turn_on',{entity_id:ent,brightness_pct:Math.round(p*100)});
      else if(dom==='cover')h.callService('cover','set_cover_position',{entity_id:ent,position:Math.round(p*100)});
      else if(dom==='fan')h.callService('fan','set_percentage',{entity_id:ent,percentage:Math.round(p*100)});
      else if(dom==='media_player')h.callService('media_player','volume_set',{entity_id:ent,volume_level:Math.round(p*100)/100});
      else if(dom==='number'||dom==='input_number')h.callService(dom,'set_value',{entity_id:ent,value:Math.round((mn+p*(mx-mn))*100)/100});
      else if(dom==='climate')h.callService('climate','set_temperature',{entity_id:ent,temperature:Math.round((mn+p*(mx-mn))*2)/2});
      else console.warn('[room-overlay-card] slider: unsupported domain',dom);
    };
    el.addEventListener('pointerdown',function(e){
      if(self._config.test_mode)return;
      active=true;moved=false;sx=e.clientX;sy=e.clientY;
      try{el.setPointerCapture(e.pointerId);}catch(_){}
    });
    el.addEventListener('pointermove',function(e){
      if(!active)return;
      if(!moved&&Math.abs(horiz?e.clientX-sx:e.clientY-sy)<6)return;
      moved=true;
      pct=calc(e);
      fill.style.opacity='1';
      if(horiz)fill.style.width=(pct*100).toFixed(1)+'%';
      else fill.style.height=(pct*100).toFixed(1)+'%';
      bub.textContent=_fmtVal(pct);bub.style.opacity='1';
      if(sl.live){const now=Date.now();if(now-lastSent>250){lastSent=now;apply(pct);}}
    });
    el.addEventListener('pointerup',function(e){
      if(!active)return;
      active=false;
      if(moved){el._rocSlid=true;e.stopPropagation();apply(pct);setTimeout(function(){el._rocSlid=false;},400);}
      setTimeout(function(){fill.style.opacity='0';bub.style.opacity='0';},250);
    });
    el.addEventListener('pointercancel',function(){active=false;fill.style.opacity='0';bub.style.opacity='0';});
  }

  // Drag the vertical cover rail -> cover.set_cover_position (throttled, live).
  _attachCoverRail(rec){
    const self=this,el=rec.rail,cc=rec.cfg,horiz=rec.horiz;
    el.style.touchAction='none';
    let active=false,pct=0,lastSent=0;
    const calc=function(ev){const r=el.getBoundingClientRect();let p=horiz?((ev.clientX-r.left)/r.width):(1-(ev.clientY-r.top)/r.height);return Math.max(0,Math.min(1,p));};
    const paint=function(p){const v=(Math.round(p*1000)/10);if(rec.fill){if(horiz)rec.fill.style.width=v+'%';else rec.fill.style.height=v+'%';}if(rec.thumb){if(horiz)rec.thumb.style.left=v+'%';else rec.thumb.style.bottom=v+'%';}if(rec.pct)rec.pct.textContent=Math.round(p*100)+' %';};
    const send=function(p){const h=self._hass;if(!h)return;h.callService('cover','set_cover_position',{entity_id:cc.entity,position:Math.round(p*100)});};
    el.addEventListener('pointerdown',function(e){if(self._config&&self._config.test_mode)return;active=true;e.stopPropagation();try{el.setPointerCapture(e.pointerId);}catch(_){}rec._userHold=Date.now();pct=calc(e);paint(pct);});
    el.addEventListener('pointermove',function(e){if(!active)return;e.stopPropagation();rec._userHold=Date.now();pct=calc(e);paint(pct);const now=Date.now();if(now-lastSent>250){lastSent=now;send(pct);}});
    el.addEventListener('pointerup',function(e){if(!active)return;active=false;e.stopPropagation();rec._userHold=Date.now();send(pct);});
    el.addEventListener('pointercancel',function(){active=false;});
  }

  // Cover control -> toggle visibility (reveal on blind tap; only one shown at a time).
  _toggleCoverPop(id){
    const rec=this._ccEls&&this._ccEls[id];if(!rec||rec.mode==='dock')return;
    const showing=rec.root.style.display!=='none';
    for(const k in this._ccEls){if(this._ccEls[k].mode!=='dock')this._ccEls[k].root.style.display='none';}
    if(!showing)rec.root.style.display='';
  }

  getGridOptions(){
    // `rows` intentionally NOT defined — the card's height comes from
    // aspect_ratio (padding-bottom). Declaring rows makes the grid cell
    // smaller than the rendered card, so following cards overlap it.
    return{columns:12,min_columns:6};
  }

  _makeResizable(el,onResize){
    // 6 handles: 4 corners + right edge + bottom edge
    const hs=[
      {p:'top:-6px;left:-6px',c:'nw-resize',w:-1,h:-1,ml:true,mt:true},
      {p:'top:-6px;right:-6px',c:'ne-resize',w:1,h:-1,ml:false,mt:true},
      {p:'bottom:-6px;left:-6px',c:'sw-resize',w:-1,h:1,ml:true,mt:false},
      {p:'bottom:-6px;right:-6px',c:'se-resize',w:1,h:1,ml:false,mt:false},
      {p:'top:calc(50% - 5px);right:-6px',c:'e-resize',w:1,h:0,ml:false,mt:false},
      {p:'left:calc(50% - 5px);bottom:-6px',c:'s-resize',w:0,h:1,ml:false,mt:false},
    ];
    el.style.overflow='visible';
    const self=this;
    hs.forEach(function(hd){
      const h=document.createElement('div');
      h.className='roc-rh';
      h.style.cssText='position:absolute;'+hd.p+';width:10px;height:10px;background:var(--primary-color,#03a9f4);border:2px solid #fff;border-radius:2px;z-index:1000;cursor:'+hd.c+';box-sizing:border-box;pointer-events:auto;display:none;';
      el.appendChild(h);
      h.style.touchAction='none'; // Pointer Events also cover touch (tablet resize)
      h.addEventListener('mousedown',function(e){e.stopPropagation();e.preventDefault();}); // keep the host's drag handlers quiet
      h.addEventListener('touchstart',function(e){e.stopPropagation();},{passive:true});
      h.addEventListener('pointerdown',function(e){
        e.stopPropagation();e.preventDefault();
        const cont=self.shadowRoot.querySelector('.content');if(!cont)return;
        const rect=cont.getBoundingClientRect();
        const sx=e.clientX,sy=e.clientY;
        const st=parseFloat(el.style.top)||0,sl=parseFloat(el.style.left)||0;
        const sw=parseFloat(el.style.width)||10,sh=parseFloat(el.style.height)||10;
        function onMove(ev){
          const dx=(ev.clientX-sx)/rect.width*100,dy=(ev.clientY-sy)/rect.height*100;
          const snap=function(v){return ev.altKey?v:Math.round(v*2)/2;}; // 0.5 % grid, Alt = free
          if(hd.w!==0){const nw=Math.max(2,snap(sw+hd.w*dx));el.style.width=nw.toFixed(1)+'%';if(hd.ml)el.style.left=snap(sl+dx).toFixed(1)+'%';}
          if(hd.h!==0){const nh=Math.max(2,snap(sh+hd.h*dy));el.style.height=nh.toFixed(1)+'%';if(hd.mt)el.style.top=snap(st+dy).toFixed(1)+'%';}
        }
        function onUp(){document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerup',onUp);document.removeEventListener('pointercancel',onUp);onResize(el.style.top,el.style.left,el.style.width,el.style.height);}
        document.addEventListener('pointermove',onMove);document.addEventListener('pointerup',onUp);document.addEventListener('pointercancel',onUp);
      });
    });
  }

  // Resize for a glow's edit-mode chrome box. Not _makeResizable: top/left is
  // the CENTRE here, so a handle drag grows the box on both sides (hence ×200,
  // not ×100), a circle resizes on one axis and keeps aspect-ratio, and the
  // callback speaks size/width/height rather than a top/left/width/height rect.
  _makeGlowResizable(el,shape,onResize){
    const self=this;
    const box=(shape==='ellipse'||shape==='wash');
    const hs=box?[{p:'top:calc(50% - 7px);right:-7px',c:'ew-resize',w:1,h:0},
                  {p:'left:calc(50% - 7px);bottom:-7px',c:'ns-resize',w:0,h:1},
                  {p:'bottom:-7px;right:-7px',c:'nwse-resize',w:1,h:1}]
                :[{p:'bottom:-7px;right:-7px',c:'nwse-resize',w:1,h:1}];
    hs.forEach(function(hd){
      const h=document.createElement('div');
      h.className='roc-rh';
      h.style.cssText='position:absolute;'+hd.p+';width:13px;height:13px;background:var(--primary-color,#03a9f4);border:2px solid #fff;border-radius:50%;z-index:1000;cursor:'+hd.c+';box-sizing:border-box;pointer-events:auto;touch-action:none;display:none;';
      el.appendChild(h);
      h.addEventListener('mousedown',function(e){e.stopPropagation();e.preventDefault();});
      h.addEventListener('touchstart',function(e){e.stopPropagation();},{passive:true});
      h.addEventListener('pointerdown',function(e){
        e.stopPropagation();e.preventDefault();
        const cont=self.shadowRoot.querySelector('.content');if(!cont)return;
        const rect=cont.getBoundingClientRect();
        const sx=e.clientX,sy=e.clientY;
        const sw=parseFloat(el.style.width)||10;
        const sh=parseFloat(el.style.height)||sw;
        function onMove(ev){
          const dx=(ev.clientX-sx)/rect.width*200,dy=(ev.clientY-sy)/rect.height*200;
          const snap=function(v){return ev.altKey?v:Math.round(v*2)/2;};
          if(!box){
            const nw=Math.max(2,snap(sw+Math.max(dx,dy)));
            el.style.width=nw.toFixed(1)+'%';
          }else{
            if(hd.w)el.style.width=Math.max(2,snap(sw+dx)).toFixed(1)+'%';
            if(hd.h)el.style.height=Math.max(2,snap(sh+dy)).toFixed(1)+'%';
          }
        }
        function onUp(){
          document.removeEventListener('pointermove',onMove);
          document.removeEventListener('pointerup',onUp);
          document.removeEventListener('pointercancel',onUp);
          onResize(el.style.width,box?el.style.height:null);
        }
        document.addEventListener('pointermove',onMove);
        document.addEventListener('pointerup',onUp);
        document.addEventListener('pointercancel',onUp);
      });
    });
  }

  _makeDraggable(handle,onDrop,target){
    const self=this;
    const el=target||handle; // the element that moves (a grip can move its parent)
    let dragOccurred=false;
    handle.addEventListener('mousedown',function(e){
      if(e.button!==0)return;
      if(target){e.stopPropagation();e.preventDefault();}
      const cont=self.shadowRoot.querySelector('.content');
      if(!cont)return;
      const rect=cont.getBoundingClientRect();
      const startX=e.clientX,startY=e.clientY;
      const startTop=parseFloat(el.style.top)||0,startLeft=parseFloat(el.style.left)||0;
      const cands=self._snapCandidates(el);
      const box=self._snapBox(el,rect,startTop,startLeft);
      let moved=false;
      function onMove(e){
        const dx=e.clientX-startX,dy=e.clientY-startY;
        if(!moved&&Math.sqrt(dx*dx+dy*dy)<5)return;
        moved=true;e.preventDefault();e.stopPropagation();
        const sp=self._snapPos(
          Math.max(0,Math.min(98,startTop+dy/rect.height*100)),
          Math.max(0,Math.min(98,startLeft+dx/rect.width*100)),
          e.altKey,cands,box);
        el.style.top=sp.t.toFixed(1)+'%';
        el.style.left=sp.l.toFixed(1)+'%';
      }
      function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);self._hideGuides();if(moved){dragOccurred=true;setTimeout(function(){dragOccurred=false;},400);onDrop(el.style.top,el.style.left);}}
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    handle.addEventListener('touchstart',function(e){
      const cont=self.shadowRoot.querySelector('.content');if(!cont)return;
      if(target)e.stopPropagation();
      const rect=cont.getBoundingClientRect();
      const t0=e.touches[0],startX=t0.clientX,startY=t0.clientY;
      const startTop=parseFloat(el.style.top)||0,startLeft=parseFloat(el.style.left)||0;
      let moved=false;
      const tCands=self._snapCandidates(el),tBox=self._snapBox(el,rect,startTop,startLeft);
      function onTMove(e){const t=e.touches[0],dx=t.clientX-startX,dy=t.clientY-startY;if(!moved&&Math.sqrt(dx*dx+dy*dy)<5)return;moved=true;e.preventDefault();e.stopPropagation();const sp=self._snapPos(Math.max(0,Math.min(98,startTop+dy/rect.height*100)),Math.max(0,Math.min(98,startLeft+dx/rect.width*100)),false,tCands,tBox);el.style.top=sp.t.toFixed(1)+'%';el.style.left=sp.l.toFixed(1)+'%';}
      function onTEnd(){handle.removeEventListener('touchmove',onTMove);handle.removeEventListener('touchend',onTEnd);self._hideGuides();if(moved){dragOccurred=true;setTimeout(function(){dragOccurred=false;},400);onDrop(el.style.top,el.style.left);}}
      handle.addEventListener('touchmove',onTMove,{passive:false});handle.addEventListener('touchend',onTEnd);
    },{passive:true});
    // Suppress click after drag — capture phase fires before zone/icon tap listeners
    el.addEventListener('click',function(e){if(dragOccurred){e.stopImmediatePropagation();e.preventDefault();dragOccurred=false;}},true);
  }

  // Inject the pill shape + border transition into the slider's own shadow root.
  // Colours (--bsc-background / --bsc-border-color) are set inline on the host so
  // they stay authoritative over this stylesheet and can update live.
  // Native light pill gestures (v6.17.0). Pointer events only; touch-action:
  // pan-y on the pill lets a vertical page scroll through untouched.
  //  tap → toggle · horizontal drag → brightness (dimmable lights) · hold → more-info
  _wireLcPill(rec){
    const self=this,el=rec.el;
    let sx=0,sy=0,pid=null,dragging=false,moved=false,held=false,holdT=null,pct=0;
    const dimmable=function(){return lcIsDimmable(self._hass&&self._hass.states[rec.entity]);};
    const pctAt=function(x){const r=el.getBoundingClientRect();return r.width>0?Math.max(0,Math.min(100,Math.round((x-r.left)/r.width*100))):0;};
    const paint=function(p){if(rec.fill)rec.fill.style.width=p+'%';if(rec.val)rec.val.textContent=p>0?p+' %':'';el.classList.toggle('on',p>0);};
    const reset=function(){clearTimeout(holdT);holdT=null;pid=null;dragging=false;el.classList.remove('dragging');};
    el.addEventListener('pointerdown',function(ev){
      if(ev.button!=null&&ev.button>0)return;
      ev.stopPropagation();
      pid=ev.pointerId;sx=ev.clientX;sy=ev.clientY;dragging=false;moved=false;held=false;
      clearTimeout(holdT);
      holdT=setTimeout(function(){
        if(pid===null||dragging||moved)return;
        held=true;
        self._exec({action:'more-info',entity:rec.entity});
      },Number(self._config&&self._config.hold_delay)||500);
    });
    el.addEventListener('pointermove',function(ev){
      if(pid===null||ev.pointerId!==pid)return;
      const dx=ev.clientX-sx,dy=ev.clientY-sy;
      if(!dragging){
        if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){moved=true;reset();return;} // page scroll
        if(Math.abs(dx)>8&&Math.abs(dx)>=Math.abs(dy)){
          moved=true;clearTimeout(holdT);
          if(!dimmable())return;
          dragging=true;el.classList.add('dragging');
          try{el.setPointerCapture(pid);}catch(_){}
        }
      }
      if(dragging){ev.preventDefault();ev.stopPropagation();pct=pctAt(ev.clientX);paint(pct);}
    });
    el.addEventListener('pointerup',function(ev){
      if(pid===null||ev.pointerId!==pid)return;
      ev.stopPropagation();
      const wasDrag=dragging,wasMoved=moved,wasHeld=held;
      reset();
      if(!self._hass)return;
      if(wasDrag){
        rec.userUntil=Date.now()+1500; // ignore the stale state for a moment so the fill doesn't jump back
        if(pct<1)self._hass.callService('light','turn_off',{entity_id:rec.entity});
        else self._hass.callService('light','turn_on',{entity_id:rec.entity,brightness_pct:pct});
        return;
      }
      if(!wasMoved&&!wasHeld)self._exec({action:'toggle',entity:rec.entity});
    });
    el.addEventListener('pointercancel',reset);
    el.addEventListener('click',function(ev){ev.stopPropagation();}); // never reach the room tap_action
    el.addEventListener('keydown',function(ev){
      if(!self._hass)return;
      if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();self._exec({action:'toggle',entity:rec.entity});return;}
      if((ev.key==='ArrowRight'||ev.key==='ArrowLeft')&&dimmable()){
        ev.preventDefault();
        const cur=lcPillPct(self._hass.states[rec.entity]);
        const nx=Math.max(0,Math.min(100,cur+(ev.key==='ArrowRight'?10:-10)));
        rec.userUntil=Date.now()+1500;paint(nx);
        if(nx<1)self._hass.callService('light','turn_off',{entity_id:rec.entity});
        else self._hass.callService('light','turn_on',{entity_id:rec.entity,brightness_pct:nx});
      }
    });
  }
  _syncLcToggleHeights(){
    if(!this._lcToggles||!this._lcToggles.length||!this.shadowRoot)return;
    const host=this.shadowRoot.querySelector('.roc-lc [data-lc-card]');
    if(!host)return; // no sliders present → toggles keep their configured height
    const h=host.offsetHeight;
    if(h>0)for(const t of this._lcToggles){try{t.el.style.height=h+'px';}catch(_){}}
  }
  _injectLcStyle(el,bgOff,col){
    if(!el)return null;
    const st=document.createElement('style');
    st.setAttribute('data-roc-lc','');
    st.textContent=lcSliderCss(bgOff,col);
    const attach=function(n){
      const sr=el.shadowRoot;
      if(sr){if(!sr.querySelector('style[data-roc-lc]'))sr.appendChild(st);return;}
      if(n<20)setTimeout(function(){attach(n+1);},50);
    };
    attach(0);
    return st;
  }

  // Geometry-only restyle, for ResizeObserver callbacks. The RO used to call
  // the full _update(), i.e. a complete state pass — every overlay, zone,
  // badge, icon, label and gauge re-evaluated — triggered by a pure geometry
  // event, once per frame during a window drag or an opening keyboard. Only
  // three things in _update() actually depend on the box: %-based icon sizes,
  // %-based label font sizes, and the day/night gauge slat pattern (which
  // measures its own height and is entangled with the state value, so that one
  // case still delegates to the full pass).
  _applyResizeStyles(){
    if(!this._rendered||!this._config)return;
    if(this._hasDayNightGauge){if(this._hass&&this._visible)this._update();return;}
    if(!this._needsCardWidth)return;
    const c=this._roomCfg||this._config;
    const w=this.offsetWidth||300;
    for(const ico of(c.icons||[])){
      const haicon=this._icoIconEls[ico.id];if(!haicon)continue;
      const sz=resolveSize(tApply(ico,this._tier).size||ico.size||'20px',w);
      if(sz&&haicon.style.getPropertyValue('--mdc-icon-size')!==sz){haicon.style.setProperty('--mdc-icon-size',sz);haicon.style.width=sz;haicon.style.height=sz;}
    }
    for(const vw of(c.vacuum_widgets||[])){
      const vel=this._vwEls[vw.id];if(!vel)continue;
      const vsz=resolveSize(tApply(vw,this._tier).size||vw.size||'44px',w);
      if(vsz&&vel.style.width!==vsz){vel.style.width=vsz;vel.style.height=vsz;}
    }

    for(const lbl of(c.labels||[])){
      const el=this._lblEls[lbl.id];if(!el)continue;
      const raw=tApply(lbl,this._tier).font_size||lbl.font_size;
      if(raw){const fs=resolveSize(raw,w);if(fs)setSt(el,'fontSize',fs);}
    }
  }

  // v6.25.0: nav minis draw their images from HQ-resampled copies (rocHqUrl).
  // _miniScale is set by the parent's ResizeObserver; the box is measured in
  // _hqRefresh (not per _update — no layout read on every state change).
  _hq(url){
    const c=this._config,b=this._hqBox;
    if(!url||!c||!c._roc_mini||!b)return url;
    const self=this;
    return rocHqUrl(url,b.w,b.h,function(){self._hqRefresh();});
  }
  _hqRefresh(){
    if(!this._config||!this._config._roc_mini)return;
    clearTimeout(this._hqT);const self=this;
    this._hqT=setTimeout(function(){
      if(!self.isConnected||!(self._miniScale>0))return;
      const st=self._elContent&&self._elContent();if(!st||!st.offsetWidth)return;
      const d=(window.devicePixelRatio||1)*self._miniScale;
      self._hqBox={w:st.offsetWidth*d,h:st.offsetHeight*d};
      const c=self._roomCfg||self._config;
      if(self._baseEl&&c.base_image&&!c.base_camera&&!(c.base_image_conditions&&c.base_image_conditions.length)){
        const bg="url('"+escUrl(self._hq(c.base_image))+"')";
        if(self._baseEl.style.backgroundImage!==bg)self._baseEl.style.backgroundImage=bg;
      }
      if(self._hass)try{self._update();}catch(_){}
    },60);
  }
  _update(){
    if(!this._hass||!this._config||!this._rendered)return;
    // Throttled root-height re-check piggybacked on state updates: leaving
    // dashboard edit mode removes HA's card-actions bar WITHOUT resizing the
    // scroller or recreating the card — no observer fires, and the card would
    // stay pinned at the shorter edit-mode height. State updates tick steadily,
    // and the pin early-outs when nothing changed, so this is nearly free.
    const _pcNow=Date.now();
    if(!this._lastPinCheck||_pcNow-this._lastPinCheck>1000){this._lastPinCheck=_pcNow;this._requestPin('state-update');}
    const s=this._hass.states;
    const cAll=this._config;
    const c=this._roomCfg||roomMerge(cAll,this._roomIdx); // active room view
    // room_entity follow (e.g. Bermuda area sensor) — manual switches hold priority.
    // follow_mode: always (default) | initial (only the first match after load) | manual (button/action only)
    const _reId=this._roomEntityId();
    const _fMode=cAll.follow_mode||'always';
    if(_reId&&Array.isArray(cAll.rooms)&&cAll.rooms.length&&_fMode!=='manual'&&!(_fMode==='initial'&&this._followInit)){
      const ri=roomMatch(cAll,s[_reId]?.state);
      if(ri>=0){
        this._followInit=true;
        if(ri!==this._roomIdx&&Date.now()>this._manualHoldUntil){
          this._switchRoom(ri,0,false);
          return;
        }
      }
    }
    if(this._ovActive)this._updateOverview(s);
    // Follow button: accent colour while we're away from the presence room
    if(this._navFollowEl&&_reId){
      const _fri=roomMatch(cAll,s[_reId]?.state);
      setSt(this._navFollowEl,'color',(_fri>=0&&_fri!==this._roomIdx)?'var(--primary-color,#03a9f4)':'');
    }
    // Re-render when the active layout profile changes (resize / rotation)
    let _rtNow=rocProfile(cAll,this._vpW(),this._vpH());
    if((c.test_mode??false)&&this._profFlipped)_rtNow=(_rtNow==='portrait')?'landscape':'portrait';
    const _tierNow=(c.test_mode??false)?null:_rtNow;
    if(_tierNow!==this._tier||_rtNow!==this._vt){this._rendered=false;this._render();return;}
    // Live viewport/profile readout in test mode (updates on resize without re-render)
    if(this._tmInfoEl)this._tmInfoEl.innerHTML='&#128208; '+Math.round(this._vpW())+'&#215;'+Math.round(this._vpH())+'<br><span style="font-weight:normal;opacity:0.85;">profile: '+_rtNow+'</span>';
    const flipped=(c.test_mode??false)&&this._testFlipped;
    if(this._baseEl){
      let _bf=flipped?null:bmFilter(c.brightness_model,s,this._sortedBmFg);
      if(_bf===null)_bf=c.filter_conditions?.length?(flipped?resolveFilterInverted(c.filter_conditions,s):resolveFilter(c.filter_conditions,s)):'none';
      setSt(this._baseEl,'filter',_bf);
      // Conditional base image (static images only — base_camera drives its own refresh)
      if(c.base_image_conditions?.length&&!c.base_camera){
        let _bimg=c.base_image;
        for(const bc of c.base_image_conditions){
          if(bc.condition===undefined){_bimg=bc.image;continue;}
          if(evalCond(bc.condition,s)){_bimg=bc.image;break;}
        }
        if(_bimg){const _bbg='url(\''+escUrl(this._hq(_bimg))+'\')';if(this._baseEl.style.backgroundImage!==_bbg)this._baseEl.style.backgroundImage=_bbg;}
      }
    }
    for(const ov of(c.overlays||[])){
      const el=this._ovEls[ov.id];if(!el)continue;
      const gShow=!ov.group||(this._groupState[ov.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      if(ov.visible_template!==undefined)setSt(el,'display',(this._tmplVis['o:'+ov.id]??true)?'':'none');
      const img=this._hq(this._ovImg(ov));
      if(img){const bg='url(\''+escUrl(img)+'\')';if(el.style.backgroundImage!==bg)el.style.backgroundImage=bg;}
      const rawOp=ov.conditions?.opacity?Number(resolveVal(ov.conditions.opacity,s,0)):1;
      const showOp=flipped?String(rawOp>0.5?0:1):String(rawOp);if(parseFloat(showOp)>0&&ov.animation){el.style.animation='roc-'+ov.animation+' '+(ov.animation==='blink'?'1s step-end':'2s ease-in-out')+' infinite';el.style.opacity='';}else{el.style.animation='none';el.style.opacity=showOp;}
      let _ovF=ov.conditions?.filter?resolveVal(ov.conditions.filter,s,'none'):'none';
      if(ov.color_from){
        // Tint the overlay toward the light's current colour
        const _cf=s[ov.color_from];
        if(_cf&&_cf.state==='on'){
          const _rgb=_cf.attributes.rgb_color||(_cf.attributes.color_temp_kelvin?kelvinToRgb(_cf.attributes.color_temp_kelvin):null);
          if(_rgb)_ovF=tintFilter(_rgb);
        }
      }
      setSt(el,'filter',_ovF);
      if(ov.transform){
        const _tfr=tfResolve(ov.transform,ov.transform.entity?s[ov.transform.entity]:null);
        if(_tfr){
          setSt(el,'transform',_tfr.transform||'');
          // Only a spin block owns the animation slot; map/range modes leave the
          // overlay's own pulse/blink alone.
          if(ov.transform.spin)setSt(el,'animation',_tfr.animation==='none'?'none':_tfr.animation);
        }
      }
    }
    // Light glow -- colour from the light itself, strength from its brightness
    for(const g0 of(c.glows||[])){
      const gel=this._glowEls[g0.id];if(!gel)continue;
      const g=tApply(g0,this._tier);
      const gShow=!g.group||(this._groupState[g.group]??true);
      this._setGrpVis(gel,gShow);
      if(!gShow)continue;
      // `visible:` was documented (and in the editor's YAML box label) since
      // v6.8.0 but never actually evaluated here — only `visible_template`
      // worked, via _setupTemplates() setting display directly. Mirror the
      // icon loop above.
      const gShow2=g.visible_template!==undefined?(this._tmplVis['gw:'+g0.id]??true):(g.visible?evalCond(g.visible,s):true);
      this._setVis(gel,gShow2,'',g.fade,g.slide);
      const gst=g.entity?s[g.entity]:null;
      let gOn=!!gst&&gst.state!=='off'&&gst.state!=='unavailable'&&gst.state!=='unknown';
      if(flipped)gOn=!gOn;
      let gOp=0;
      if(gOn){
        const br=(gst&&gst.attributes)?gst.attributes.brightness:null;
        const frac=(br==null||flipped)?1:Math.max(0,Math.min(1,br/255));
        const minb=g.min_brightness??0;
        gOp=(br!=null&&!flipped&&br<minb)?0:(g.intensity==null?0.7:Number(g.intensity))*frac;
      }
      // Edit mode keeps every glow visible (and grabbable) even with its light off
      if((c.test_mode??false)&&gOp<0.25)gOp=0.25;
      setSt(gel,'opacity',Math.max(0,Math.min(1,gOp)).toFixed(3));
      const gfx=this._glowFxEls[g0.id];
      if(gfx&&gOp>0){
        const gbg=glowBg(g,glowRgb(g,gst));
        if(gfx.dataset.gwBg!==gbg){gfx.dataset.gwBg=gbg;gfx.style.backgroundImage=gbg;}
      }
    }
    // Weather overlay
    if(this._wxEl&&c.weather_overlay){
      const wx=typeof c.weather_overlay==='string'?{entity:c.weather_overlay}:c.weather_overlay;
      let eff=wx.effect&&wx.effect!=='auto'?wx.effect:null;
      if(!eff&&wx.entity){
        const wst=s[wx.entity]?.state;
        eff=({rainy:'rain',pouring:'rain-heavy','lightning-rainy':'rain-lightning',lightning:'lightning',hail:'snow-heavy',snowy:'snow','snowy-rainy':'snow',fog:'fog'})[wst]||null;
      }
      const effCls=({'rain':' wx-rain','rain-heavy':' wx-rain wx-heavy','rain-lightning':' wx-rain wx-lightning','lightning':' wx-lightning','snow':' wx-snow','snow-heavy':' wx-snow wx-heavy','fog':' wx-fog'})[eff]||'';
      const wcls='layer wx'+effCls;
      if(this._wxEl.className!==wcls)this._wxEl.className=wcls;
      // Per-effect default opacity — snow needs more presence than rain
      const _defOp=({'rain':0.45,'rain-heavy':0.55,'rain-lightning':0.5,'lightning':0.6,'snow':0.7,'snow-heavy':0.8,'fog':0.5})[eff]??0.45;
      setSt(this._wxEl,'opacity',effCls?String(wx.opacity??_defOp):'0');
    }
    // Group panels (fade via visibility/opacity)
    for(const g of(c.groups||[])){
      if(g.style&&this._grpPanelEls[g.id])this._setGrpVis(this._grpPanelEls[g.id],this._groupState[g.id]??false);
    }
    // Cockpit sections: live tile values while a panel is open (v6.8.0)
    this._updateSectionTiles();
    for(const z of(c.zones||[])){
      const el=this._zoneEls[z.id];if(!el)continue;
      const gShow=!z.group||(this._groupState[z.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const zShow=z.visible_template!==undefined?(this._tmplVis['z:'+z.id]??true):!(z.visible&&!evalCond(z.visible,s));
      this._setVis(el,zShow,'',z.fade,z.slide);
    }
    for(const b of(c.badges||[])){
      const bel=this._bcontEls[b.id];if(!bel)continue;
      const gShow=!b.group||(this._groupState[b.group]??true);
      this._setGrpVis(bel,gShow);
      if(!gShow)continue;
      const bShow=b.visible_template!==undefined?(this._tmplVis['b:'+b.id]??true):(b.visible?evalCond(b.visible,s):true);
      this._setVis(bel,bShow,'flex',b.fade,b.slide);
      const iel=this._biconEls[b.id];
      if(iel&&b.icon_color)setSt(iel,'color',resolveVal(b.icon_color,s,'white'));
      const lel=this._blabelEls[b.id];
      if(lel&&b.label){const t=resolveVal(b.label,s,'');if(lel.textContent!==t)lel.textContent=t;}
    }
    // Card width is only needed to resolve %-based icon sizes / label font
    // sizes. Reading offsetWidth is a forced layout, so skip it entirely for
    // the (common) config that uses none — _needsCardWidth is computed once
    // per render.
    const _icoW=this._needsCardWidth?(this.offsetWidth||300):0;
    for(const ico of(c.icons||[])){
      const el=this._icoEls[ico.id];if(!el)continue;
      const gShow=!ico.group||(this._groupState[ico.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const iShow=ico.visible_template!==undefined?(this._tmplVis['i:'+ico.id]??true):(ico.visible?evalCond(ico.visible,s):true);
      this._setVis(el,iShow,'flex',ico.fade,ico.slide);
      const haicon=this._icoIconEls[ico.id];
      if(haicon){
        const sz=resolveSize(tApply(ico,this._tier).size||ico.size||'20px',_icoW);
        if(haicon.style.getPropertyValue('--mdc-icon-size')!==sz){haicon.style.setProperty('--mdc-icon-size',sz);haicon.style.width=sz;haicon.style.height=sz;}
        if(ico.color)setSt(haicon,'color',resolveVal(ico.color,s,'white'));
      }
      // Section launcher status (v6.16.0): an icon that opens a section shows
      // what's running inside it — a progress ring for the first running tile
      // that has a progress sensor, a count badge, and the active colour.
      const _sid=rocIcoSection(ico);
      if(_sid){
        const _act=rocSectionActivity(this._secResolvedTiles&&this._secResolvedTiles[_sid],s);
        const ringEl=el.querySelector('[data-ico-ring]'),badgeEl=el.querySelector('[data-ico-badge]');
        const showRing=_act.count>0&&_act.progress!==null;
        if(ringEl){
          setSt(ringEl,'display',showRing?'block':'none');
          if(showRing)ringEl.style.setProperty('--p',_act.progress+'%');
        }
        if(badgeEl){
          const bt=(_act.count>1||(_act.count===1&&!showRing))?String(_act.count):'';
          if(badgeEl.textContent!==bt)badgeEl.textContent=bt;
        }
        el.classList.toggle('ico-active',_act.count>0);
        if(haicon&&!ico.color)setSt(haicon,'color',_act.count>0?'var(--roc-active-c)':'');
      }
    }
    for(const vw of(c.vacuum_widgets||[])){
      const el=this._vwEls[vw.id];if(!el)continue;
      const gShow=!vw.group||(this._groupState[vw.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const vShow=vw.visible?evalCond(vw.visible,s):true;
      this._setVis(el,vShow,'flex',vw.fade,vw.slide);
      if(!vShow)continue;
      if(this._needsCardWidth){
        const vsz=resolveSize(tApply(vw,this._tier).size||vw.size||'44px',_icoW);
        if(vsz&&el.style.width!==vsz){el.style.width=vsz;el.style.height=vsz;}
      }
      const cats=(vw.vacuums||[]).map(vv=>rocVacCat(s[vv.entity]?.state));
      const vwAgg=rocVacAggregate(cats);
      if(el.dataset.vwCat!==vwAgg.overall){
        el.classList.remove('vw-rest','vw-dry','vw-wet','vw-both','vw-active','vw-error');
        el.classList.add('vw-'+vwAgg.overall);
        el.dataset.vwCat=vwAgg.overall;
      }
      const cEl=this._vwCountEls[vw.id];
      if(cEl){
        const show=vwAgg.count>=2;
        const dv=show?'inline-flex':'none';
        if(cEl.style.display!==dv)cEl.style.display=dv;
        if(show&&cEl.textContent!==String(vwAgg.count))cEl.textContent=String(vwAgg.count);
      }
    }
    for(const el of(c.elements||[])){
      const cont=this._contEls[el.id];if(!cont)continue;
      const gShow=!el.group||(this._groupState[el.group]??true);
      this._setGrpVis(cont,gShow);
      if(!gShow)continue;
      const eShow=el.visible_template!==undefined?(this._tmplVis['e:'+el.id]??true):(el.visible?evalCond(el.visible,s):true);
      this._setVis(cont,eShow,'block',el.fade,el.slide);
    }
    for(const lbl of(c.labels||[])){
      const el=this._lblEls[lbl.id];if(!el)continue;
      const gShow=!lbl.group||(this._groupState[lbl.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const lblVis=lbl.visible_conditions!==undefined?lbl.visible_conditions:lbl.visible;
      this._setVis(el,lblVis!==undefined?evalCond(lblVis,s):true,'',lbl.fade,lbl.slide);
      const _lfsRaw=tApply(lbl,this._tier).font_size||lbl.font_size;
      if(_lfsRaw){const _fs=resolveSize(_lfsRaw,_icoW);if(_fs)setSt(el,'fontSize',_fs);}
      if(lbl.template){
        // Text and gradient colour come from the template subscription
        const tv=this._tmplVals[lbl.id];
        if(tv!==undefined&&el.textContent!==tv)el.textContent=tv;
        continue;
      }
      const ent=s[lbl.entity];if(!ent)continue;
      const rawVal=lbl.attribute!==undefined?ent.attributes[lbl.attribute]:ent.state;
      if(lbl.format==='relative'){
        const _rt=(lbl.prefix||'')+relTime(rawVal,this._hass.locale?.language)+(lbl.suffix&&lbl.suffix!=='auto'?lbl.suffix:'');
        if(el.textContent!==_rt)el.textContent=_rt;
        continue;
      }
      const text=rocFmtState(this._hass,ent,lbl); // v6.16.0 shared formatter (see rocFmtState)
      if(el.textContent!==text)el.textContent=text;
      if(lbl.color_gradient){const _lv=rocNumVal(rawVal);if(!isNaN(_lv))setSt(el,'color',lerpColorGradient(this._sortedLblGrads[lbl.id]||lbl.color_gradient,_lv,!!this._sortedLblGrads[lbl.id]));}else if(lbl.color)setSt(el,'color',Array.isArray(lbl.color)?resolveVal(lbl.color,s,'white'):lbl.color);
    }
    const _allGaugesUp=[...(c.gauges||[]),...(this._blindGaugeCfgs||[])];
    for(const g of _allGaugesUp){
      const el=this._gaugeEls[g.id];if(!el)continue;
      const gShow=!g.group||(this._groupState[g.group]??true);
      this._setGrpVis(el,gShow);
      if(!gShow)continue;
      const gVis=g.visible_conditions!==undefined?g.visible_conditions:g.visible;
      const gShow2=g.visible_template!==undefined?(this._tmplVis['g:'+g.id]??true):(gVis!==undefined?evalCond(gVis,s):true);
      this._setVis(el,gShow2,'',g.fade,g.slide);
      if(g.animation){const _gActive=g.alert_conditions?evalCond(g.alert_conditions,s):true;if(_gActive){if(g.animation_color)el.style.setProperty('--roc-ac',g.animation_color);else el.style.removeProperty('--roc-ac');el.style.animation=g.animation==='blink'?'roc-border-blink 1s step-end infinite':'roc-border-pulse 2s ease-in-out infinite';}else{el.style.animation='';el.style.removeProperty('--roc-ac');}}else if(el.style.animation){el.style.animation='';el.style.removeProperty('--roc-ac');}
      const ent=s[g.entity];if(!ent)continue;
      let val=parseFloat(g.attribute!==undefined?ent.attributes[g.attribute]:ent.state);
      if(isNaN(val))continue;
      const mn=g.min??0,mx=g.max??100;
      // rawPct = normalized position with NO top_offset applied. Always 0=open /
      // 1=closed regardless of the blind's own raw motor direction. Kept around
      // because day_night's phase must be driven by the real travel, not by the
      // reserve-corrected coverage (see rocDayNightShift).
      const rawPct=Math.max(0,Math.min(1,(val-mn)/(mx-mn)));
      // top_offset corrects the visual fill only, AFTER min/max normalization —
      // pct here is always 0=open/1=closed regardless of the blind's own raw
      // motor direction (see rocApplyTopOffset). Closed (pct=1) is left exactly
      // as-is; only the open end (pct=0) gets floored to the residual coverage.
      let pct=rawPct;
      if(g.top_offset)pct=rocApplyTopOffset(rawPct*100,g.top_offset)/100;
      const fill=this._gaugeFills[g.id];
      if(fill){if(g._dayNight){const _nDN=g._slat_count||6;const _perDN=el.offsetHeight/_nDN;if(_perDN>0){const _swDN=_perDN/2;const _scDN=g._slat_color;const _gradDN='repeating-linear-gradient(to bottom,'+_scDN+' 0px,'+_scDN+' '+_swDN+'px,transparent '+_swDN+'px,transparent '+_perDN+'px)';const _offDN=g.shift_legacy?(pct>=1?(_perDN/2):pct*_nDN*(_perDN/2)):rocDayNightShift(rawPct,g.shift_start,(g.shift_turns!==undefined?g.shift_turns:_nDN/2),g.shift_snap!==false)*_perDN;fill.style.height=(Math.round(pct*1000)/10)+'%';fill.style.backgroundImage=_gradDN+','+_gradDN;fill.style.backgroundPositionY=(-_offDN)+'px,0px';fill.style.backgroundRepeat='repeat';fill.style.backgroundSize='100% '+_perDN+'px';fill.style.backgroundColor='transparent';}}
      else if((g.orientation||'vertical')==='radial'){
        const meta=this._radialMeta[g.id];
        if(meta){
          const dash=(pct*meta.arcLen).toFixed(2)+' '+meta.circ.toFixed(2);
          if(fill.getAttribute('stroke-dasharray')!==dash)fill.setAttribute('stroke-dasharray',dash);
          let _rc=null;
          if(g.color_gradient)_rc=lerpColorGradient(this._sortedGrads[g.id]||g.color_gradient,val,!!this._sortedGrads[g.id]);
          else if(g.color)_rc=Array.isArray(g.color)?resolveVal(g.color,s,'white'):g.color;
          if(_rc&&fill.getAttribute('stroke')!==_rc)fill.setAttribute('stroke',_rc);
        }
      }
      else{const _go=g.orientation||'vertical';const _pv=(Math.round(pct*1000)/10)+'%';if(_go==='horizontal'||_go==='right')setSt(fill,'width',_pv);else setSt(fill,'height',_pv);if(g.color_gradient)setSt(fill,'background',lerpColorGradient(this._sortedGrads[g.id]||g.color_gradient,val,!!this._sortedGrads[g.id]));else if(g.color)setSt(fill,'background',Array.isArray(g.color)?resolveVal(g.color,s,'white'):g.color);}}
    }
    // Light-controls lux ring — cheap: one HSL computation, applied only on change
    if(this._lcEls&&this._lcEls.length&&this._lcCfg){
      const _col=lcBorderColor(s[this._lcCfg.lux_sensor]?.state,this._lcCfg);
      if(_col!==this._lcPrevCol){
        this._lcPrevCol=_col;
        for(const o of this._lcEls){if(o.styleEl)try{o.styleEl.textContent=lcSliderCss(o.bgOff,_col);}catch(_){}}
      }
    }
    // Light-controls on/off toggle pills — reflect entity state + share lux ring
    if(this._lcToggles&&this._lcToggles.length){
      const _tcol=this._lcCfg?lcBorderColor(s[this._lcCfg.lux_sensor]?.state,this._lcCfg):'var(--primary-color)';
      for(const t of this._lcToggles){
        const stt=s[t.entity];
        const on=!!stt&&stt.state!=='off'&&stt.state!=='unavailable'&&stt.state!=='unknown';
        const bg=on?_tcol:t.bgOff;
        if(t._bg!==bg){t._bg=bg;try{t.el.style.background=bg;}catch(_){}}
        if(t._brc!==_tcol){t._brc=_tcol;try{t.el.style.borderColor=_tcol;}catch(_){}}
        if(t._on!==on){t._on=on;try{t.el.style.color=on?'#fff':'var(--secondary-text-color)';}catch(_){}if(t.icon)try{t.icon.setAttribute('icon',on?'mdi:power':'mdi:power-off');}catch(_){}}
      }
    }
    // Native light pills (v6.17.0) — fill = brightness in the light's colour,
    // lux ring on the border, HA-formatted value when off.
    if(this._lcPills&&this._lcPills.length){
      const _pcol=(this._lcCfg&&this._lcCfg.lux_sensor)?lcBorderColor(s[this._lcCfg.lux_sensor]?.state,this._lcCfg):'var(--roc-border-c)';
      const _now=Date.now();
      for(const p of this._lcPills){
        const st=s[p.entity];
        setSt(p.el,'borderColor',_pcol);
        if(p.userUntil>_now||p.el.classList.contains('dragging'))continue;
        const unavail=!st||st.state==='unavailable'||st.state==='unknown';
        const on=!unavail&&st.state!=='off';
        const pct=lcIsDimmable(st)?lcPillPct(st):(on?100:0);
        const rgb=lcLightRgb(st);
        p.el.classList.toggle('on',on);
        p.el.classList.toggle('unavailable',unavail);
        p.el.style.setProperty('--lcp-col',lcFillCss(rgb));
        p.el.style.setProperty('--lcp-solid','rgb('+rgb.join(',')+')');
        if(p.fill)setSt(p.fill,'width',pct+'%');
        const txt=unavail?'—':(on&&lcIsDimmable(st)?pct+' %':rocFmtState(this._hass,st,{}));
        if(p.val&&p.val.textContent!==txt)p.val.textContent=txt;
        if(p.icon&&!p.cfg.icon){
          const dom=String(p.entity).split('.')[0];
          const ic=dom==='light'?(on?'mdi:lightbulb':'mdi:lightbulb-outline'):(on?'mdi:power':'mdi:power-off');
          if(p.icon.getAttribute('icon')!==ic)p.icon.setAttribute('icon',ic);
        }
      }
    }
    // Cover controls (roleta) — reflect live position + motion state
    if(this._ccEls&&this._ccCfgs&&this._ccCfgs.length){
      for(const cc of this._ccCfgs){
        const rec=this._ccEls[cc.id];if(!rec)continue;
        const ent=s[cc.entity];if(!ent)continue;
        const attrs=ent.attributes||{};
        const hasPosAttr=attrs.current_position!=null;
        const pos=hasPosAttr?Math.max(0,Math.min(100,Math.round(attrs.current_position))):null;
        const st=ent.state,moving=(st==='opening'||st==='closing');
        if(rec.rail)setSt(rec.rail,'display',(hasPosAttr&&cc.slider)?'':'none');
        const held=rec._userHold&&(Date.now()-rec._userHold<1200);
        if(pos!=null&&!held){
          if(rec.fill){if(rec.horiz)rec.fill.style.width=pos+'%';else rec.fill.style.height=pos+'%';}
          if(rec.thumb){if(rec.horiz)rec.thumb.style.left=pos+'%';else rec.thumb.style.bottom=pos+'%';}
          if(rec.pct){if(rec.pct.textContent!==pos+' %')rec.pct.textContent=pos+' %';setSt(rec.pct,'display','');}
          for(const pb of rec.presets)pb.classList.toggle('active',parseInt(pb.dataset.pos,10)===pos);
        }else if(pos==null&&rec.pct){rec.pct.textContent='';setSt(rec.pct,'display','none');}
        if(rec.stop)rec.stop.classList.toggle('moving',moving);
      }
    }
    this._updateNav();
    if(this._relevantEntities){
      for(const id of this._relevantEntities)this._prevStates[id]=s[id]?.state;
      if(this._relevantAttrSources)for(const a of this._relevantAttrSources)this._prevStates[a.entity+'.'+a.attr]=s[a.entity]?.attributes[a.attr];
    }
  }

  // Nav thumbnails — live filters + sensor chips. Callable standalone (via
  // _schedule(true)) for state changes that only affect other rooms' thumbs.
  // nav.live: 'composite' → thumbs stack the room's ACTIVE overlay images over
  // the base image (mini-room view: same lights/filters as the big card).
  // Binary approximation: overlay shows when its opacity resolves > 0;
  // grouped (pop-up panel) overlays and visible_template overlays are skipped.
  _updateNav(){
    if(!this._hass||!this._rendered)return;
    const s=this._hass.states,cAll=this._config;
    if(Array.isArray(cAll.rooms)&&cAll.rooms.length){
      const _navLiveVal=cAll.nav&&cAll.nav.live;
      const _live=_navLiveVal==='composite'; // composite draws its own base+overlay stack on tEl, filtered here
      const _liveReal=_navLiveVal==='full'||_navLiveVal==='custom'; // real mounted mini instances — they
      // apply their own brightness_model/filter_conditions internally (same code path as the main card);
      // a CSS filter set on the WRAPPER (tEl) would stack on top of the mini's own already-correct
      // per-layer filter, double-exposing/double-dimming it. So the wrapper must stay filter-free here.
      const _mode=_live?'composite':(_liveReal?_navLiveVal:'');
      for(let ri=0;ri<cAll.rooms.length;ri++){
        const tEl=this._navThumbEls[ri];if(!tEl)continue;
        if(cAll.rooms[ri]&&cAll.rooms[ri].overview)continue; // icon thumbnail, nothing to paint
        this._paintThumb(tEl,cAll.rooms[ri],ri,_mode);
      }
      for(const t of(this._ovThumbs||[]))this._paintThumb(t.el,cAll.rooms[t.ri],t.ri,t.mode);
      for(const ch of this._navChipEls){
        const ent=s[ch.entity];if(!ent)continue;
        const nv=rocNumVal(ent.state);
        const txt=rocFmtState(this._hass,ent,ch.cfg); // v6.16.0 shared formatter
        if(ch.el.textContent!==txt)ch.el.textContent=txt;
        // Out-of-range colour only for a real number; "—" (unavailable) falls
        // back to the muted token colour instead of keeping the last stop.
        if(ch.cfg.color_gradient&&!isNaN(nv))setSt(ch.el,'color',lerpColorGradient(ch.cfg.color_gradient,nv));
        else if(ch.cfg.color)setSt(ch.el,'color',ch.cfg.color);
        else setSt(ch.el,'color',isNaN(nv)&&txt==='—'?'var(--roc-text-2-c)':'');
      }
    }
    if(this._navEntities)for(const id of this._navEntities)this._prevStates[id]=s[id]?.state;
    if(this._navAttrSources)for(const a of this._navAttrSources)this._prevStates[a.entity+'.'+a.attr]=s[a.entity]?.attributes[a.attr];
  }

  _ovImg(ov){
    if(ov.image)return ov.image;
    if(ov.state_images?.length){
      for(const m of ov.state_images){
        if(!('entity'in m))continue;
        const st=this._hass.states[m.entity];if(!st)continue;
        // v6.11.4: `attribute` matches an attribute's value instead of the
        // entity's own state -- e.g. a media_player's app_id, which has no
        // dedicated state of its own to key off.
        const val=m.attribute?st.attributes?.[m.attribute]:st.state;
        if(val===m.state)return m.image;
      }
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
    if(event){event.stopPropagation();event.preventDefault();}
    const a=this._resolveAct(tapAction);
    if(!a||a.action==='none')return;
    // Swallow taps generated by a room swipe (zones fire on touchend, which the
    // wrap-level click suppressor cannot catch)
    if(this._roomDragActive||(this._lastRoomDragEnd&&Date.now()-this._lastRoomDragEnd<400))return;
    if(a.confirmation){
      const _ct=typeof a.confirmation==='object'?(a.confirmation.text||'Are you sure?'):'Are you sure?';
      if(!window.confirm(_ct))return;
    }
    if(this._config.haptic!==false)try{window.dispatchEvent(new CustomEvent('haptic',{detail:'light'}));}catch(_){}
    switch(a.action){
      case'navigate':{const p=a.navigation_path||a.path;if(p){history.pushState(null,'',p);const _lc=new Event('location-changed',{bubbles:true,composed:true});_lc.detail={replace:false};window.dispatchEvent(_lc);window.dispatchEvent(new PopStateEvent('popstate'));}}break;
      case'url':{const u=a.url_path||a.url;if(u)window.open(u,a.new_tab===false?'_self':'_blank');}break;
      case'more-info':if(a.entity)this.dispatchEvent(new CustomEvent('hass-more-info',{bubbles:true,composed:true,detail:{entityId:a.entity}}));break;
      case'perform-action':
      case'call-service':{
        const svc=a.perform_action||a.service;
        if(svc){const d=svc.indexOf('.');this._hass.callService(svc.slice(0,d),svc.slice(d+1),a.data??a.service_data??{},a.target);}
      }break;
      case'browser-mod-popup':{const _bmData={title:a.title??'',size:a.size??'normal',content:a.content??{}};const _bmId=window.browser_mod?.browserID||window.browser_mod?.browser_id;if(_bmId)_bmData.browser_id=_bmId;this._hass.callService('browser_mod','popup',_bmData);}break;
      case'toggle':if(a.entity)this._hass.callService('homeassistant','toggle',{entity_id:a.entity});break;
      case'switch-room':{
        const ri=roomMatch(this._config,a.room);
        if(ri>=0)this._switchRoom(ri,ri>this._roomIdx?1:-1,true);
      }break;
      case'next-room':
        if(Array.isArray(this._config.rooms)&&this._config.rooms.length)
          this._switchRoom((this._roomIdx+1)%this._config.rooms.length,1,true);
        break;
      case'prev-room':
        if(Array.isArray(this._config.rooms)&&this._config.rooms.length)
          this._switchRoom((this._roomIdx-1+this._config.rooms.length)%this._config.rooms.length,-1,true);
        break;
      case'follow-room':this._followNow();break;
      case'open-section':if(a.section)this._openSection(a.section);break;
      // Standard Lovelace hook (browser_mod 2 popups, custom actions): HA's own
      // cards dispatch the whole action config as an `ll-custom` event.
      case'fire-dom-event':this.dispatchEvent(new CustomEvent('ll-custom',{bubbles:true,composed:true,detail:a}));break;
      case'close-section':this._closeSection();break;
      case'toggle-group':
      case'show-group':
      case'hide-group':
        if(a.group){
          // ??true: an undeclared group is visible by default in _update() too,
          // so its first toggle must hide it (it used to need two taps).
          const _newVis=a.action==='toggle-group'?!(this._groupState[a.group]??true):a.action==='show-group';
          this._groupState[a.group]=_newVis;
          if(_newVis){
            // groups is a ROOM_KEYS key — read the active room's merged list, not the top-level one
            const _grps=(this._roomCfg||this._config).groups||[];
            const _gc=_grps.find(g=>g.id===a.group)?.grouping_code;
            if(_gc!==undefined)for(const _og of _grps)if(_og.id!==a.group&&_og.grouping_code===_gc)this._groupState[_og.id]=false;
          }
          this._update();
        }
        break;
    }
  }
  // NOTE (v5.9.14): handles that connectedCallback needs in order to REVIVE a
  // hook are deliberately NOT nulled here — only detached. HA moves the card
  // element on every dashboard edit-mode toggle, which runs this callback and
  // then connectedCallback. The old code nulled _io/_hlHandler/_orientHandler
  // and then revived them with `if(this._x)…`, which is dead code once they're
  // null — so after one edit toggle the card had no IntersectionObserver, no
  // roc-highlight listener, no relative-time ticker and no parallax tilt. Worst
  // case: the card was off-screen at move time, _visible stayed false, and
  // `set hass` bailed forever → frozen card until a page reload. Observers that
  // _wireLayoutObservers() recreates wholesale (_ro/_wrapRo/_bodyRo/_scRo/
  // _pvMo/_barMo) are still nulled — that path builds them from scratch.
  disconnectedCallback(){
    // Kept (not nulled) — revived on reconnect, same as _hlHandler/_orientHandler
    // below. Nulling here was the bug: HA's edit-mode toggle disconnects and
    // reconnects the element without a full re-render in between, and
    // connectedCallback never recreated these, so Escape / arrow-nudge died
    // the first time the card was moved while a panel was open or an element
    // was selected in Edit mode.
    if(this._tmKeyHandler)document.removeEventListener('keydown',this._tmKeyHandler);
    if(this._secKeyHandler)document.removeEventListener('keydown',this._secKeyHandler);
    if(this._hlHandler)window.removeEventListener('roc-highlight',this._hlHandler); // kept — revived on reconnect
    if(this._camTimer){clearInterval(this._camTimer);this._camTimer=null;}
    if(this._relTimer){clearInterval(this._relTimer);this._relTimer=null;} // _relNeeded drives the restart
    if(this._orientHandler)window.removeEventListener('deviceorientation',this._orientHandler); // kept — revived on reconnect
    if(this._hashHandler)window.removeEventListener('hashchange',this._hashHandler);
    this._teardownTemplates();
    if(this._ro){this._ro.disconnect();this._ro=null;}
    if(this._wrapRo){this._wrapRo.disconnect();this._wrapRo=null;}
    if(this._bodyRo){this._bodyRo.disconnect();this._bodyRo=null;}
    if(this._scRo){this._scRo.disconnect();this._scRo=null;}
    this._scrollEl=null;
    clearTimeout(this._rootHT1);
    if(this._io)this._io.disconnect(); // kept — re-observed on reconnect
    if(this._winHandler){window.removeEventListener('resize',this._winHandler);this._winHandler=null;}
    if(this._locHandler){window.removeEventListener('location-changed',this._locHandler);window.removeEventListener('popstate',this._locHandler);this._locHandler=null;}
    if(this._barMo){this._barMo.disconnect();this._barMo=null;}
    if(this._pvMo){this._pvMo.disconnect();this._pvMo=null;}
    if(this._navMiniRo){this._navMiniRo.disconnect();this._navMiniRo=null;}
  }

  connectedCallback(){
    // Re-attach observers & subscriptions after the element is MOVED back into
    // the DOM. HA does this move on every dashboard edit-mode toggle (the card
    // gets wrapped into / unwrapped from hui-card-options), and
    // disconnectedCallback nulls all observers — so everything must be
    // RECREATED here, not conditionally `.observe()`d on nulled handles (the
    // old bug: a card that went through an edit toggle had no layout triggers
    // left and stayed mis-sized until the next state update or swipe).
    if(this._rendered&&this._config){
      this._wireVisibility();
      this._wireLayoutObservers();
      this._wireRelTimer();
      this._startCamera();
      if(!this._tmplUnsubs.length)this._setupTemplates();
      // addEventListener dedupes identical (type, listener) pairs, so re-adding
      // a handler that was never detached is a no-op — safe unconditionally.
      if(this._hlHandler)window.addEventListener('roc-highlight',this._hlHandler);
      if(this._orientHandler)window.addEventListener('deviceorientation',this._orientHandler);
      if(this._hashHandler)window.addEventListener('hashchange',this._hashHandler);
      if(this._tmKeyHandler)document.addEventListener('keydown',this._tmKeyHandler);
      if(this._secKeyHandler)document.addEventListener('keydown',this._secKeyHandler);
      // Re-pin now and once more after HA's current task finishes
      // (setTimeout(0), NOT rAF — rAF never fires in background tabs or
      // during HA view transitions); _watchEditBar and the panel-view
      // MutationObserver cover anything that mounts even later.
      const self=this;
      try{this._layoutRootHeight();this._watchEditBar();}catch(_){}
      if(this._haEdit)this._syncStudioChip(); // wrapped into / out of HA's edit chrome
      setTimeout(function(){
        if(!self._rendered||!self.isConnected)return;
        if(self._haEdit)self._syncStudioChip();
        self._requestPin('reconnect-settle');
        self._watchEditBar();
      },0);
    }
  }
}

customElements.define('room-overlay-card',RoomOverlayCard);



