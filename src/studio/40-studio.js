// ---- The studio -----------------------------------------------------------------------------
// Device frames for the canvas. The card chooses its layout profile from the frame's size (its
// _rocVp viewport override), so "Tablet portrait" shows the portrait profile on a landscape PC.
const RS_FRAMES={fit:null,landscape:{w:1280,h:800},portrait:{w:800,h:1280},phone:{w:390,h:844}};
// Outline rows: [config key, editor section id (data-panel), icon]
const RS_KINDS=[
  ['overlays','overlays','mdi:layers-outline'],['zones','zones','mdi:gesture-tap'],['badges','badges','mdi:label-outline'],
  ['icons','icons','mdi:star-four-points-outline'],['labels','labels','mdi:format-text'],['gauges','gauges','mdi:gauge'],
  ['glows','glows','mdi:lightbulb-on-outline'],['blinds','blinds','mdi:blinds-horizontal'],['elements','elements','mdi:card-bulleted-outline'],
  ['groups','groups','mdi:dock-window'],['vacuum_widgets','vacuum_widgets','mdi:robot-vacuum'],['light_controls','lights','mdi:tune-vertical'],
];
// Room keys kept on the previewed room while the shared Global defaults are edited — the same
// list the editor's own preview uses (_previewCfg), so the canvas falls through to the defaults.
const RS_KEEP_VISUAL=['id','name','area_match','base_image','base_camera','camera_refresh','base_image_conditions'];

class RocStudio{
  static open(opts){
    if(RocStudio.current){RocStudio.current._dlg.focus();return Promise.resolve(RocStudio.current);}
    const s=new RocStudio(opts||{});
    RocStudio.current=s;
    try{s._init();}catch(e){RocStudio.current=null;try{s._teardown();}catch(_){}return Promise.reject(e);}
    return Promise.resolve(s);
  }

  constructor(opts){
    const C=customElements.get('room-overlay-card');
    this.C=C;this.I=C&&C._rocInternals;
    if(!this.I)throw new Error('Studio: room-overlay-card is not loaded');
    this.opts=opts;
    this.hass=opts.hass||(opts.editor&&opts.editor._hass)||(opts.card&&opts.card._hass)||null;
    // landscape screen → the tablet frame (the canvas column alone is often squarish and would
    // flip a desktop layout to portrait); portrait screen (phone) → the real screen size
    this.frame=(window.innerWidth||0)>=(window.innerHeight||0)?'landscape':'fit';this.mode='arrange';
    this.undoStack=[];this.redoStack=[];this.lastCommit=0;this.lastSrc='';
    this.roomIdx=0;this.global=false;
    this._layers=[];this._timers=[];
  }
  t(k,v){return rocT((this.hass&&this.hass.language||'en').split('-')[0],k,v);}

  // ---------------------------------------------------------------- setup
  _init(){
    const o=this.opts,I=this.I;
    if(o.from==='editor'&&o.editor){
      const ed=o.editor;
      this.work=I.clone(ed._config);
      this.roomIdx=ed._editRoomIdx||0;this.global=!!ed._editGlobal;
      this.target={kind:'editor',editor:ed};
    }else if(o.card){
      this.work=I.clone(o.card._rocRaw||o.card._config);
      this.roomIdx=o.card._roomIdx||0;
      this.target=rsResolveDashboard(o.card,this.hass);
    }else if(o.config){
      this.work=I.clone(o.config);
      this.target={kind:'yaml',reason:o.reason||'r_notfound'};
    }else throw new Error('Studio: nothing to edit');
    if(!this.work||typeof this.work!=='object')throw new Error('Studio: the card has no config');
    // A v3 config (no `layout:`) is migrated once, in memory, exactly as the card and the editor
    // do on load; it is written back only together with a real edit (like the editor's banner).
    this.work=I.migrate(this.work);
    const n=this._rooms().length;
    if(n)this.roomIdx=Math.max(0,Math.min(this.roomIdx,n-1));else this.global=false;
    this.base=rsJ(this.work);        // what the target holds (last applied / saved)
    this.histKey='roc-studio-history:'+I.cfgKey(this.work);
    this._build();
  }

  _build(){
    const self=this;
    // Document-level styles for the dialog box itself (its contents live in a shadow root).
    if(!document.getElementById('roc-studio-doc-css')){
      const st=document.createElement('style');st.id='roc-studio-doc-css';
      st.textContent='dialog.roc-studio{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:hidden;}dialog.roc-studio::backdrop{background:rgba(0,0,0,.55);}';
      document.head.appendChild(st);
    }
    const dlg=document.createElement('dialog');
    dlg.className='roc-studio';dlg.setAttribute('aria-label',this.t('title'));
    const host=document.createElement('div');
    dlg.appendChild(host);
    const sr=host.attachShadow({mode:'open'});
    this._dlg=dlg;this._sr=sr;
    sr.innerHTML='<style>'+ROC_STUDIO_CSS+'</style>';
    const app=rsEl('div',{class:'app'});this._app=app;sr.appendChild(app);

    // toolbar
    const bar=rsEl('header',{class:'bar'});
    bar.appendChild(rsEl('span',{class:'brand'},[this.t('title'),rsEl('small',{text:'v'+ROC_STUDIO_VERSION})]));
    this._olToggle=rsEl('button',{class:'btn icon narrow-only ol-t',title:this.t('outline'),'aria-label':this.t('outline'),onclick:function(){app.classList.toggle('show-outline');}},[rsIcon('mdi:file-tree')]);
    bar.appendChild(this._olToggle);
    this._roomSel=rsEl('select',{class:'room','aria-label':this.t('room'),onchange:function(){const v=self._roomSel.value;self._setRoom(v==='global'?self.roomIdx:(parseInt(v,10)||0),v==='global','toolbar');}});
    bar.appendChild(this._roomSel);
    const fseg=rsEl('span',{class:'seg frames',role:'group','aria-label':this.t('frame_hint'),title:this.t('frame_hint')});
    this._frameBtns={};
    Object.keys(RS_FRAMES).forEach(function(k){
      const b=rsEl('button',{type:'button','aria-pressed':String(k===self.frame),onclick:function(){self._setFrame(k);}},[self.t('frame_'+k)]);
      self._frameBtns[k]=b;fseg.appendChild(b);
    });
    bar.appendChild(fseg);
    const mseg=rsEl('span',{class:'seg',role:'group'});
    this._modeBtns={};
    ['arrange','live'].forEach(function(k){
      const b=rsEl('button',{type:'button',title:self.t('mode_'+k+'_hint'),'aria-pressed':String(k===self.mode),onclick:function(){self._setMode(k);}},[self.t('mode_'+k)]);
      self._modeBtns[k]=b;mseg.appendChild(b);
    });
    bar.appendChild(mseg);
    this._undoBtn=rsEl('button',{class:'btn icon',title:this.t('undo'),'aria-label':this.t('undo'),onclick:function(){self.undo();}},[rsIcon('mdi:undo')]);
    this._redoBtn=rsEl('button',{class:'btn icon',title:this.t('redo'),'aria-label':this.t('redo'),onclick:function(){self.redo();}},[rsIcon('mdi:redo')]);
    bar.appendChild(this._undoBtn);bar.appendChild(this._redoBtn);
    bar.appendChild(rsEl('span',{class:'sp'}));
    bar.appendChild(rsEl('button',{class:'btn',title:this.t('yaml'),onclick:function(){self._showYaml();}},[rsIcon('mdi:code-braces'),rsEl('span',{class:'lbl',text:this.t('yaml')})]));
    bar.appendChild(rsEl('button',{class:'btn',title:this.t('history'),onclick:function(){self._showHistory();}},[rsIcon('mdi:history'),rsEl('span',{class:'lbl',text:this.t('history')})]));
    this._inToggle=rsEl('button',{class:'btn icon narrow-only in-t',title:this.t('inspector'),'aria-label':this.t('inspector'),onclick:function(){app.classList.toggle('show-insp');}},[rsIcon('mdi:tune')]);
    bar.appendChild(this._inToggle);
    const tk=this.target.kind;
    this._saveBtn=rsEl('button',{class:'btn primary',title:tk==='editor'?this.t('apply_hint'):(tk==='dashboard'?this.t('save_hint'):''),onclick:function(){self.save();}},
      [rsIcon(tk==='yaml'?'mdi:content-copy':'mdi:content-save'),rsEl('span',{text:tk==='editor'?this.t('apply'):(tk==='dashboard'?this.t('save'):this.t('copy_yaml'))})]);
    bar.appendChild(this._saveBtn);
    bar.appendChild(rsEl('button',{class:'btn icon',title:this.t('close'),'aria-label':this.t('close'),onclick:function(){self.requestClose();}},[rsIcon('mdi:close')]));
    app.appendChild(bar);

    // outline
    this._outline=rsEl('nav',{class:'outline','aria-label':this.t('outline')});
    app.appendChild(this._outline);

    // canvas
    const cv=rsEl('main',{class:'canvas'});
    this._cvInfo=rsEl('div',{class:'cv-bar'});
    this._stage=rsEl('div',{class:'stage'});
    this._fbox=rsEl('div',{class:'fbox'});
    this._frameEl=rsEl('div',{class:'frame'});
    this._fbox.appendChild(this._frameEl);this._stage.appendChild(this._fbox);
    cv.appendChild(this._cvInfo);cv.appendChild(this._stage);
    app.appendChild(cv);

    // inspector = today's editor, hosted unchanged (§5.5)
    this._insp=rsEl('aside',{class:'insp','aria-label':this.t('inspector')});
    app.appendChild(this._insp);

    // status bar
    const stb=rsEl('footer',{class:'status'});
    this._vBtn=rsEl('button',{class:'vbtn',onclick:function(){self._showValidation();}});
    this._dirtyEl=rsEl('span');
    this._tgtEl=rsEl('span',{class:'tgt'});
    this._verEl=rsEl('span',{class:'warn'});
    stb.appendChild(this._vBtn);stb.appendChild(this._dirtyEl);stb.appendChild(this._verEl);stb.appendChild(this._tgtEl);
    app.appendChild(stb);
    if(this.I.version!==ROC_STUDIO_VERSION)this._verEl.textContent=this.t('ver_mismatch',{s:ROC_STUDIO_VERSION,c:this.I.version});

    this._mountEditor();
    this._mountCanvas();

    // keyboard: Escape is guarded on keydown in the CAPTURE phase (spike S1 — preventing the
    // dialog's `cancel` is ignored without fresh user activation); Ctrl+Z/Y/S are the studio's.
    dlg.addEventListener('keydown',function(e){self._onKey(e);},true);
    dlg.addEventListener('cancel',function(e){e.preventDefault();self.requestClose();});
    this._bu=function(e){if(self._dirty()){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',this._bu);

    document.body.appendChild(dlg);
    if(typeof dlg.showModal==='function')dlg.showModal();else dlg.setAttribute('open','');
    this.C._rocStudioOpen=true;

    if(window.ResizeObserver){this._ro=new ResizeObserver(function(){self._layoutFrame();});this._ro.observe(this._stage);}
    this._timers.push(setInterval(function(){self._pollHass();},250));
    this._renderChrome();
    this._layoutFrame();
  }

  _mountEditor(){
    const self=this,I=this.I;
    const ed=document.createElement('room-overlay-card-editor');
    ed._rocHosted=true;ed._rocHost=this;
    ed._roomIdxInit=true;ed._editRoomIdx=this.roomIdx;ed._editGlobal=this.global;
    if(this.hass)ed.hass=this.hass;
    ed.addEventListener('config-changed',function(e){
      e.stopPropagation(); // never reaches HA's dialog: the studio owns this config until Apply/Save
      const c=e.detail&&e.detail.config;
      if(c)self._commit(c,'editor');
    });
    ed.addEventListener('change',function(e){
      const tgt=e.composedPath?e.composedPath()[0]:e.target;
      if(tgt&&tgt.id==='room-select')self._setRoom(ed._editRoomIdx||0,!!ed._editGlobal,'editor');
    });
    ed.setConfig(I.clone(this.work));
    this._ed=ed;
    this._insp.appendChild(ed);
  }

  _mountCanvas(){
    const self=this;
    const card=document.createElement('room-overlay-card');
    card._rocSink=function(nc){self._onCanvas(nc);};
    card._rocRoomSink=function(idx){self._onCanvasRoom(idx);};
    card._rocVp={w:1280,h:800};
    if(this._rooms().length)card._roomIdx=this.roomIdx;
    this._card=card;
    this._frameEl.appendChild(card);
    this._cvErr=null;
    this._pushCanvas(true);
    if(this.hass)card.hass=this.hass;
    this._canvasRoom();
  }

  // ---------------------------------------------------------------- canvas
  _vp(){return this._card&&this._card._rocVp||{w:1280,h:800};}
  // The config the canvas card renders: the working config plus render-only overrides, never
  // written back (_restore undoes every one of them).
  _canvasCfg(){
    const I=this.I;
    const c=I.migrate(I.clone(this.work));
    c._roc_studio=true;
    delete c.url_sync;                       // the canvas must not drive the dashboard URL
    const rooms=Array.isArray(c.rooms)&&c.rooms.length>0;
    if(rooms)c.follow_mode='manual';         // no presence jumps while editing
    if(this.mode==='arrange')c.test_mode=true;
    const vp=this._vp();
    const prof=I.profile(c,vp.w,vp.h);
    c.layout=Object.assign({},c.layout);
    const h=c.layout.height||'viewport';
    // viewport/fill pin to the screen; in the studio the frame is the screen
    if(h==='fill'||(h==='viewport'&&prof==='landscape'))c.layout.height='container';
    if(rooms&&this.global){
      const r=c.rooms[this.roomIdx];
      if(r)Object.keys(r).forEach(function(k){if(RS_KEEP_VISUAL.indexOf(k)<0)delete r[k];});
    }
    return c;
  }
  _restore(nc){
    const I=this.I;
    const base=I.migrate(I.clone(this.work));
    const out=I.clone(nc);
    delete out._roc_studio;
    ['test_mode','url_sync','follow_mode'].forEach(function(k){if(base[k]!==undefined)out[k]=I.clone(base[k]);else delete out[k];});
    if(out.layout&&typeof out.layout==='object'){
      if(base.layout&&base.layout.height!==undefined)out.layout.height=I.clone(base.layout.height);else delete out.layout.height;
    }
    if(this.global&&Array.isArray(base.rooms)&&Array.isArray(out.rooms)&&base.rooms[this.roomIdx])out.rooms[this.roomIdx]=I.clone(base.rooms[this.roomIdx]);
    return out;
  }
  _pushCanvas(now){
    const self=this;
    clearTimeout(this._pcT);
    const go=function(){
      const card=self._card;if(!card)return;
      card._editGlobal=self.global;
      try{
        card.setConfig(self._canvasCfg());
        if(self._cvErr){self._cvErr.remove();self._cvErr=null;}
        card.style.display='';
      }catch(e){
        card.style.display='none';
        if(!self._cvErr){self._cvErr=rsEl('div',{class:'cv-err'});self._stage.appendChild(self._cvErr);}
        self._cvErr.textContent=self.t('canvas_err',{m:String(e&&e.message||e).replace(/^\[room-overlay-card\]\s*/,'')});
      }
    };
    if(now)go();else this._pcT=setTimeout(go,40);
  }
  _canvasRoom(){
    const card=this._card;
    if(!card||!this._rooms().length)return;
    if(card._roomIdx!==this.roomIdx){
      card._roomIdx=this.roomIdx;
      if(card._hass&&card._config){card._rendered=false;try{card._render();}catch(_){}}
    }
  }
  _setFrame(k){
    if(!(k in RS_FRAMES))return;
    this.frame=k;
    for(const f in this._frameBtns)this._frameBtns[f].setAttribute('aria-pressed',String(f===k));
    this._layoutFrame();
  }
  _setMode(k){
    this.mode=k;
    for(const f in this._modeBtns)this._modeBtns[f].setAttribute('aria-pressed',String(f===k));
    this._pushCanvas(true);
  }
  _layoutFrame(){
    const st=this._stage,card=this._card;
    if(!st||!card)return;
    const aw=Math.max(0,st.clientWidth-32),ah=Math.max(0,st.clientHeight-32);
    let w,h,s;
    const F=RS_FRAMES[this.frame];
    if(!F){w=Math.max(320,Math.round(aw)||1280);h=Math.max(240,Math.round(ah)||800);s=1;}
    else{w=F.w;h=F.h;s=(aw>0&&ah>0)?Math.min(1,aw/w,ah/h):1;}
    this._fbox.style.width=Math.round(w*s)+'px';this._fbox.style.height=Math.round(h*s)+'px';
    const fe=this._frameEl;
    fe.style.width=w+'px';fe.style.height=h+'px';fe.style.transform=s<1?'scale('+s+')':'';
    const vp=card._rocVp;
    const changed=!vp||vp.w!==w||vp.h!==h;
    card._rocVp={w:w,h:h};
    this._scale=s;
    if(changed){
      this._pushCanvas(true); // the profile (and so the canvas height override) may change
      if(card._rendered)try{card._onWinResize();}catch(_){}
    }
    const prof=this.I.profile(this.work,w,h);
    this._cvInfo.textContent=w+' × '+h+' · '+prof+(s<1?' · '+Math.round(s*100)+' %':'');
  }
  _onCanvas(nc){
    // a drag / draw on the canvas (Arrange mode) — the card already shows it
    this._commit(this._restore(nc),'canvas');
  }
  _onCanvasRoom(idx){
    if(idx===this.roomIdx&&!this.global)return;
    this._setRoom(idx,false,'canvas');
  }

  // ---------------------------------------------------------------- state
  _rooms(){return Array.isArray(this.work&&this.work.rooms)?this.work.rooms:[];}
  _dirty(){return rsJ(this.work)!==this.base;}
  _commit(c,src){
    const j=rsJ(c),cur=rsJ(this.work);
    if(j===cur)return;
    const now=Date.now();
    // a typing burst in one field fires every 150 ms — keep it as ONE undo step
    const coalesce=src==='editor'&&this.lastSrc==='editor'&&now-this.lastCommit<800;
    if(!coalesce){this.undoStack.push(cur);if(this.undoStack.length>200)this.undoStack.shift();}
    this.redoStack=[];
    this.lastCommit=now;this.lastSrc=src;
    this.work=JSON.parse(j);
    this._afterChange(src);
  }
  undo(){
    if(!this.undoStack.length)return;
    this.redoStack.push(rsJ(this.work));
    this.work=JSON.parse(this.undoStack.pop());
    this.lastSrc='undo';this._afterChange('undo');
  }
  redo(){
    if(!this.redoStack.length)return;
    this.undoStack.push(rsJ(this.work));
    this.work=JSON.parse(this.redoStack.pop());
    this.lastSrc='redo';this._afterChange('redo');
  }
  _afterChange(src){
    const n=this._rooms().length;
    if(n&&this.roomIdx>=n)this.roomIdx=n-1;
    if(!n)this.global=false;
    if(src!=='editor'&&this._ed){
      this._ed._editRoomIdx=this.roomIdx;this._ed._editGlobal=this.global;
      this._ed._rocStudioLoad(this.I.clone(this.work));
    }
    if(src==='canvas'){if(this._card)this._card._cfgJson=null;} // card already shows it; never skip its next setConfig
    else this._pushCanvas(src!=='editor');
    this._renderChrome();
  }
  _setRoom(idx,global,from){
    const n=this._rooms().length;
    if(!n)return;
    idx=Math.max(0,Math.min(idx|0,n-1));
    const gChanged=!!global!==this.global;
    this.roomIdx=idx;this.global=!!global;
    if(from!=='editor'&&this._ed){this._ed._editRoomIdx=idx;this._ed._editGlobal=this.global;this._ed._render();}
    if(from!=='canvas'){
      if(gChanged)this._pushCanvas(true);
      this._canvasRoom();
    }
    this._renderChrome();
  }
  _pollHass(){
    let h=null;
    try{const ha=document.querySelector('home-assistant');h=ha&&ha.hass;}catch(_){}
    if(!h)h=(this.target.editor&&this.target.editor._hass)||(this.opts.card&&this.opts.card._hass)||null;
    if(h&&h!==this.hass)this.setHass(h);
  }
  setHass(h){
    this.hass=h;
    if(this._card)this._card.hass=h;
    if(this._ed)this._ed.hass=h;
  }

  // ---------------------------------------------------------------- chrome
  _renderChrome(){
    const self=this,I=this.I,rooms=this._rooms();
    // room select
    const sel=this._roomSel;
    sel.style.display=rooms.length?'':'none';
    sel.innerHTML='';
    if(rooms.length){
      sel.appendChild(rsEl('option',{value:'global',text:'🌐 '+this.t('global')}));
      rooms.forEach(function(r,i){sel.appendChild(rsEl('option',{value:String(i),text:String(r.name||r.id||('room '+(i+1)))}));});
      sel.value=this.global?'global':String(this.roomIdx);
    }
    // outline
    const ol=this._outline;ol.innerHTML='';
    if(rooms.length){
      ol.appendChild(rsEl('div',{class:'ol-h',text:this.t('rooms')}));
      const mk=function(label,icon,cur,fn){return rsEl('button',{class:'ol-item',type:'button','aria-current':String(!!cur),onclick:fn},[rsIcon(icon),rsEl('span',{text:label})]);};
      ol.appendChild(mk(this.t('global'),'mdi:earth',this.global,function(){self._setRoom(self.roomIdx,true,'outline');}));
      rooms.forEach(function(r,i){
        ol.appendChild(mk(String(r.name||r.id||('room '+(i+1))),r.overview?'mdi:view-dashboard-outline':'mdi:door',!self.global&&i===self.roomIdx,function(){self._setRoom(i,false,'outline');self._app.classList.remove('show-outline');}));
      });
    }
    const scope=rooms.length&&!this.global?rooms[this.roomIdx]:this.work;
    ol.appendChild(rsEl('div',{class:'ol-h',text:this.t('elements')}));
    RS_KINDS.forEach(function(k){
      let v=scope&&scope[k[0]],inh=false;
      if(v==null&&scope!==self.work&&self.work[k[0]]!=null){v=self.work[k[0]];inh=true;}
      const cnt=k[0]==='light_controls'?((v&&Array.isArray(v.entities))?v.entities.length:0):(Array.isArray(v)?v.length:0);
      ol.appendChild(rsEl('button',{class:'ol-item'+(cnt?'':' empty'),type:'button',onclick:function(){self._reveal(k[1]);}},
        [rsIcon(k[2]),rsEl('span',{text:self.t('k_'+(k[0]==='light_controls'?'lights':k[0]))}),inh&&cnt?rsEl('span',{class:'tag',text:self.t('inherited')}):null,rsEl('span',{class:'n',text:String(cnt)})]));
    });
    // undo / redo
    this._undoBtn.disabled=!this.undoStack.length;
    this._redoBtn.disabled=!this.redoStack.length;
    // status
    const dirty=this._dirty();
    this._dirtyEl.className=dirty?'dirty':'';
    this._dirtyEl.textContent=dirty?this.t('dirty'):(this._savedAt?this._savedAt:this.t('clean'));
    const tg=this.target;
    this._tgtEl.textContent=tg.kind==='editor'?this.t('tgt_editor'):(tg.kind==='dashboard'?this.t('tgt_dash',{d:tg.dashName,p:tg.where}):this.t('tgt_yaml',{r:this.t(tg.reason||'r_notfound')}));
    clearTimeout(this._vT);
    this._vT=setTimeout(function(){self._renderValidation();},120);
  }
  _validate(){
    try{return RocSchema.rocValidate(this.work).filter(function(x){return x.level!=='info';});}catch(e){return[{path:'',level:'error',msg:String(e&&e.message||e)}];}
  }
  _renderValidation(){
    const f=this._validate();
    const e=f.filter(function(x){return x.level==='error';}).length,w=f.length-e;
    const b=this._vBtn;b.innerHTML='';
    if(!f.length){b.appendChild(rsEl('span',{class:'ok'},[rsIcon('mdi:check-circle-outline')]));b.appendChild(document.createTextNode(this.t('valid_ok')));}
    else{
      b.appendChild(rsEl('span',{class:e?'err':'warn'},[rsIcon('mdi:alert-circle-outline')]));
      const parts=[];if(e)parts.push(this.t('valid_err',{e:e}));if(w)parts.push(this.t('valid_warn',{w:w}));
      b.appendChild(document.createTextNode(parts.join(' · ')));
    }
    this._findings=f;
  }
  // open the editor section that holds this kind of element
  _reveal(panel){
    const ed=this._ed;if(!ed)return;
    const tab=ed.querySelector('[data-roctab="elements"]');if(tab)tab.click();
    const d=ed.querySelector('details[data-panel="'+panel+'"]');
    if(d){d.open=true;try{d.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){d.scrollIntoView();}}
    this._app.classList.add('show-insp');this._app.classList.remove('show-outline');
  }

  // ---------------------------------------------------------------- keyboard
  _onKey(e){
    const path=e.composedPath?e.composedPath():[e.target];
    const tgt=path[0]||e.target;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();
      if(this._layers.length){this._layers[this._layers.length-1]();return;}
      if(this._app.classList.contains('show-outline')||this._app.classList.contains('show-insp')){this._app.classList.remove('show-outline','show-insp');return;}
      const card=this._card;
      if(card&&card._sectionOpen&&typeof card._closeSection==='function'){card._closeSection();return;}
      this.requestClose();
      return;
    }
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
    const k=String(e.key||'').toLowerCase();
    if(k==='s'){e.preventDefault();e.stopPropagation();this.save();return;}
    const tag=(tgt&&tgt.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select'||(tgt&&tgt.isContentEditable))return; // native undo inside fields
    if(k==='z'&&!e.shiftKey){e.preventDefault();e.stopPropagation();this.undo();}
    else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();e.stopPropagation();this.redo();}
  }

  // ---------------------------------------------------------------- panels
  _panel(title,body,buttons){
    const self=this;
    const layer=rsEl('div',{class:'layer'});
    const p=rsEl('div',{class:'panel',role:'dialog','aria-modal':'true','aria-label':title});
    p.appendChild(rsEl('h2',{text:title}));
    const pb=rsEl('div',{class:'pb'});
    (Array.isArray(body)?body:[body]).forEach(function(b){if(b!=null)pb.appendChild(typeof b==='string'?rsEl('p',{text:b}):b);});
    p.appendChild(pb);
    const pf=rsEl('div',{class:'pf'});
    const close=function(){const i=self._layers.indexOf(close);if(i>=0)self._layers.splice(i,1);layer.remove();};
    (buttons||[]).forEach(function(b){
      const el=rsEl('button',{class:'btn'+(b.cls?' '+b.cls:''),type:'button','data-act':b.id||null,onclick:function(){if(b.keep)b.fn&&b.fn(el);else{close();b.fn&&b.fn();}}},[b.label]);
      pf.appendChild(el);
    });
    p.appendChild(pf);
    layer.appendChild(p);
    layer.addEventListener('click',function(e){if(e.target===layer)close();});
    this._app.appendChild(layer);
    this._layers.push(close);
    const f=pf.querySelector('button.primary')||pf.querySelector('button');
    if(f)try{f.focus();}catch(_){}
    return close;
  }
  _yamlText(){return this.I.yaml.s(this.work);}
  _copy(text){
    try{if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text).then(function(){return true;},function(){return false;});}catch(_){}
    return Promise.resolve(false);
  }
  _showYaml(){
    const self=this;
    const ta=rsEl('textarea',{readonly:true,spellcheck:'false'});ta.value=this._yamlText();
    this._panel(this.t('yaml_title'),[this.t('yaml_body'),ta],[
      {label:this.t('copy'),cls:'primary',keep:true,id:'copy',fn:function(btn){ta.focus();ta.select();try{document.execCommand('copy');}catch(_){}self._copy(ta.value);btn.textContent=self.t('copied');}},
      {label:this.t('close'),id:'close'},
    ]);
  }
  _showValidation(){
    const f=this._findings||this._validate();
    const body=[];
    if(!f.length)body.push(this.t('valid_none'));
    else{
      const ul=rsEl('ul',{class:'vl'});
      f.slice(0,200).forEach(function(x){ul.appendChild(rsEl('li',null,[rsEl('span',{class:'lv '+x.level,text:x.level}),rsEl('code',{text:x.path||'(card)'}),rsEl('span',{class:'m',text:x.msg})]));});
      body.push(ul);
    }
    this._panel(this.t('valid_title'),body,[{label:this.t('close'),id:'close'}]);
  }
  _showHistory(){
    const self=this;
    const h=rsHistLoad(this.histKey);
    let close=null;
    const body=[this.t('hist_body')];
    if(!h.length)body.push(this.t('hist_empty'));
    else{
      const ul=rsEl('ul',{class:'hl'});
      h.forEach(function(x){
        ul.appendChild(rsEl('li',null,[rsEl('span',{text:rsDate(x.t)}),rsEl('button',{class:'btn',type:'button',onclick:function(){try{self._commit(JSON.parse(x.cfg),'history');}catch(_){}if(close)close();}},[self.t('restore')])]));
      });
      body.push(ul);
    }
    close=this._panel(this.t('hist_title'),body,[{label:this.t('close'),id:'close'}]);
  }

  // ---------------------------------------------------------------- save / close
  save(opts){
    const self=this,tg=this.target;
    opts=opts||{};
    if(tg.kind==='yaml'){this._showYaml();return Promise.resolve(false);}
    if(tg.kind==='editor'){
      if(this._dirty())this._applyToEditor();
      this.base=rsJ(this.work);
      rsHistPush(this.histKey,this.work);
      if(opts.keepOpen){this._savedAt=this.t('applied');this._renderChrome();}
      else this.close();
      return Promise.resolve(true);
    }
    // dashboard
    if(this._saving)return this._saving;
    const cfg=this.I.clone(this.work);
    const lbl=this._saveBtn.querySelector('span');
    this._saveBtn.disabled=true;if(lbl)lbl.textContent=this.t('saving');
    const done=function(){self._saveBtn.disabled=false;if(lbl)lbl.textContent=self.t('save');self._saving=null;};
    this._saving=rsSaveDashboard(tg,this.hass,cfg,!!opts.force).then(function(){
      done();
      self.base=rsJ(cfg);
      self._savedAt=self.t('saved_at',{t:rsTime(Date.now())});
      rsHistPush(self.histKey,cfg);
      self._renderChrome();
      if(opts.close)self.close();
      return true;
    },function(err){
      done();
      if(err&&err.conflict){
        self._panel(self.t('conflict_title'),[self.t('conflict_body')],[
          {label:self.t('overwrite'),cls:'danger',id:'overwrite',fn:function(){self.save({force:true,close:opts.close});}},
          {label:self.t('copy_yaml'),id:'yaml',fn:function(){self._showYaml();}},
          {label:self.t('cancel'),cls:'primary',id:'cancel'},
        ]);
      }else{
        self._panel(self.t('save_failed',{m:(err&&(err.message||err.code))||String(err)}),[],[
          {label:self.t('copy_yaml'),id:'yaml',fn:function(){self._showYaml();}},{label:self.t('close'),cls:'primary',id:'close'}]);
      }
      return false;
    });
    return this._saving;
  }
  _applyToEditor(){
    const ed=this.target.editor,I=this.I;
    ed._editRoomIdx=this.roomIdx;ed._editGlobal=this.global;
    ed._config=I.migrate(I.clone(this.work));
    ed._render();
    ed._fire(ed._config); // the editor's own config-changed → HA's dialog (and its history: the HA editor's Undo reverts the whole studio session)
  }
  requestClose(){
    const self=this;
    if(!this._dirty()){this.close();return;}
    if(this._layers.length)return;
    const tk=this.target.kind;
    const btns=[];
    if(tk==='editor')btns.push({label:this.t('apply'),cls:'primary',id:'apply',fn:function(){self.save();}});
    if(tk==='dashboard')btns.push({label:this.t('save'),cls:'primary',id:'save',fn:function(){self.save({close:true});}});
    btns.push({label:this.t('discard'),cls:'danger',id:'discard',fn:function(){self.close();}});
    btns.push({label:this.t('keep'),id:'keep'});
    this._panel(this.t('guard_title'),[this.t('guard_body')],btns);
  }
  close(){
    this._teardown();
    if(RocStudio.current===this)RocStudio.current=null;
  }
  _teardown(){
    this._timers.forEach(function(t){clearInterval(t);});this._timers=[];
    clearTimeout(this._pcT);clearTimeout(this._vT);
    if(this._ro)try{this._ro.disconnect();}catch(_){}
    if(this._bu)window.removeEventListener('beforeunload',this._bu);
    if(this.C)this.C._rocStudioOpen=false;
    const d=this._dlg;
    if(d){try{if(d.open&&typeof d.close==='function')d.close();}catch(_){}d.remove();}
    if(this._card){this._card._rocSink=null;this._card._rocRoomSink=null;}
    this._card=null;this._ed=null;
  }
}
