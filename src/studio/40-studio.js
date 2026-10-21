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
    this.sel=null;           // {type,id} — the selected element (canvas, outline and inspector agree)
    this.multi=[];           // further selected elements (Shift / Ctrl click) — v6.43.0
    this.hidden=new Set();   // element types hidden on the canvas (studio view only, never saved)
    this.locked=new Set();   // element types that cannot be selected or dragged on the canvas
    this.search='';          // outline filter
    this._placeType=null;    // element type being placed on the canvas (Add)
    this._layers=[];this._timers=[];
    // inspector tab (v6.44.0): 'props' = the studio's own Properties form, 'all' = the classic editor
    let tab='props';try{tab=localStorage.getItem('roc-studio-tab')==='all'?'all':'props';}catch(_){}
    this.tab=tab;
    this._propsOpen=new Set(['main','position']); // Properties sections kept open across selections
    this._propsSig='';this._propsKey='';this._propsSkip=false;
    this.cardSel=null;          // v6.45.0: Card settings / Navigation / a section, shown in Properties
    this._yamlKeys=new Set();   // sub-forms the user switched to YAML (by path)
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
    this._addBtn=rsEl('button',{class:'btn',title:this.t('add_hint'),onclick:function(){self._showAdd();}},[rsIcon('mdi:plus'),rsEl('span',{class:'lbl',text:this.t('add')})]);
    bar.appendChild(this._addBtn);
    bar.appendChild(rsEl('button',{class:'btn','data-act':'wizard',title:this.t('wiz_hint'),onclick:function(){self.openWizard();}},[rsIcon('mdi:auto-fix'),rsEl('span',{class:'lbl',text:this.t('wiz_btn')})]));
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
    this._olRooms=rsEl('div');
    this._olCard=rsEl('div',{class:'ol-cardbox'});
    this._olSearch=rsEl('input',{class:'ol-search',type:'search',placeholder:this.t('search_ph'),'aria-label':this.t('search_ph'),oninput:function(){self.search=self._olSearch.value;self._renderOutlineList();}});
    this._olList=rsEl('div');
    this._outline.appendChild(this._olRooms);
    this._outline.appendChild(this._olCard);
    this._outline.appendChild(rsEl('div',{class:'ol-h',text:this.t('elements')}));
    this._outline.appendChild(this._olSearch);
    this._outline.appendChild(this._olList);
    app.appendChild(this._outline);

    // canvas
    const cv=rsEl('main',{class:'canvas'});
    this._cvInfo=rsEl('div',{class:'cv-bar'});
    this._cvSize=rsEl('span');
    this._selBar=rsEl('span',{class:'selbar'});
    this._cvInfo.appendChild(this._cvSize);this._cvInfo.appendChild(this._selBar);
    this._stage=rsEl('div',{class:'stage'});
    this._fbox=rsEl('div',{class:'fbox'});
    this._frameEl=rsEl('div',{class:'frame'});
    this._fbox.appendChild(this._frameEl);this._stage.appendChild(this._fbox);
    cv.appendChild(this._cvInfo);cv.appendChild(this._stage);
    app.appendChild(cv);

    // inspector: the Properties form (v6.44.0, §5.7) and today's editor, hosted unchanged (§5.5)
    this._insp=rsEl('aside',{class:'insp','aria-label':this.t('inspector')});
    const tabs=rsEl('div',{class:'itabs',role:'tablist'});
    this._tabBtns={};
    [['props','tab_props','tab_props_hint'],['all','tab_all','tab_all_hint']].forEach(function(x){
      const b=rsEl('button',{type:'button',role:'tab','data-tab':x[0],title:self.t(x[2]),'aria-selected':String(self.tab===x[0]),onclick:function(){self._setTab(x[0]);}},[self.t(x[1])]);
      self._tabBtns[x[0]]=b;tabs.appendChild(b);
    });
    this._insp.appendChild(tabs);
    this._propsPane=rsEl('div',{class:'ipane props-pane',role:'tabpanel'});
    // a field with typed, not yet committed text keeps the browser's own undo (see _onKey)
    this._propsPane.addEventListener('input',function(e){const t=e.composedPath?e.composedPath()[0]:e.target;if(t)t._rsDirty=true;},true);
    this._propsPane.addEventListener('change',function(e){const t=e.composedPath?e.composedPath()[0]:e.target;if(t)t._rsDirty=false;},true);
    this._edPane=rsEl('div',{class:'ipane ed-pane',role:'tabpanel'});
    if(this.tab!=='props')this._propsPane.hidden=true;
    if(this.tab!=='all')this._edPane.hidden=true;
    this._insp.appendChild(this._propsPane);this._insp.appendChild(this._edPane);
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
    // v6.46.0: a fresh card (the picker's placeholder) starts in the wizard; so does "Start with the
    // wizard" in the editor (on a card that has content it adds rooms)
    if(this.opts.wizard||(this.I.isStubCfg&&this.I.isStubCfg(this.work)))try{this.openWizard();}catch(e){console.warn('[room-overlay-card] wizard:',e);}
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
    ed.addEventListener('click',function(e){
      const sm=e.target&&e.target.closest?e.target.closest('summary'):null;
      const d=sm&&sm.parentElement;
      if(!d||d.tagName!=='DETAILS'||!d.dataset.panel)return;
      setTimeout(function(){
        if(!d.open)return;
        const m=/^([a-z]+)-(\d+)$/.exec(d.dataset.panel);
        const type=m&&RS_PRE2TYPE[m[1]];
        if(!type)return;
        const item=((ed._roomView()||{})[RS_TYPES[type].key]||[])[parseInt(m[2],10)];
        if(item&&item.id!=null)self._select(type,String(item.id),'inspector');
      },0);
    },true);
    ed.setConfig(I.clone(this.work));
    this._ed=ed;
    this._edPane.appendChild(ed);
  }

  _mountCanvas(){
    const self=this;
    const card=document.createElement('room-overlay-card');
    card._rocSink=function(nc){self._onCanvas(nc);};
    card._rocRoomSink=function(idx){self._onCanvasRoom(idx);};
    card._rocSelSink=function(type,id,o){self._onCanvasSel(type,id,o);};
    card._rocFpSink=function(v){self._fpOnView(v);}; // v6.47.0: the floor plan page's renderer
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
        self._reselectCanvas();
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
      this._reselectCanvas();
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
    if(this.fp)this.fp.draft=null;
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
    this._cvSize.textContent=w+' × '+h+' · '+prof+(s<1?' · '+Math.round(s*100)+' %':'');
    if(this._placeLayer)this._placeLayer.style.display='';
  }
  _onCanvas(nc){
    // a drag / draw on the canvas (Arrange mode) — the card already shows it
    const out=this._restore(nc);
    // a selected element dragged while others are selected too: they all move by the same amount
    const mv=this._movedItem(this.work,out);
    if(mv&&this.multi.length&&this._isSel(mv.type,mv.id)){
      let n=0;
      const self=this;
      this._selSet().forEach(function(x){
        if(x.type===mv.type&&x.id===mv.id)return;
        const f=self._findItem(x.type,x.id,out);if(!f)return;
        if(rsShiftPct(f.item,'top',mv.dt))n++;
        if(rsShiftPct(f.item,'left',mv.dl))n++;
      });
      if(n){this._commit(out,'studio');return;}
    }
    this._commit(out,'canvas');
    // v6.44.0: dragging an element that was not selected selects it (its form follows the drag)
    if(mv&&!this._isSel(mv.type,mv.id))this._select(mv.type,mv.id,'drag');
  }
  // the one positioned element whose top/left differs between two configs (a canvas drag)
  _movedItem(a,b){
    const self=this;let hit=null,count=0;
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];if(!T.canvas)return;
      const la=rsOwner(a,self.roomIdx,self.global,T.key).list||[],lb=rsOwner(b,self.roomIdx,self.global,T.key).list||[];
      lb.forEach(function(ib){
        if(!ib)return;
        const ia=la.find(function(x){return x&&String(x.id)===String(ib.id);});
        if(!ia||(ia.top===ib.top&&ia.left===ib.left))return;
        const dt=rsPctNum(ib.top)-rsPctNum(ia.top),dl=rsPctNum(ib.left)-rsPctNum(ia.left);
        count++;
        if(isFinite(dt)&&isFinite(dl))hit={type:type,id:String(ib.id),dt:dt,dl:dl};
      });
    });
    return count===1?hit:null;
  }
  _onCanvasRoom(idx){
    if(idx===this.roomIdx&&!this.global)return;
    this.sel=null;
    this._setRoom(idx,false,'canvas');
  }
  _onCanvasSel(type,id,o){
    if(!type){if(this.sel&&RS_TYPES[this.sel.type]&&RS_TYPES[this.sel.type].canvas){this.sel=null;this.multi=[];this._renderOutlineList();this._renderSelBar();}return;}
    if(o&&o.add)this._toggleSel(type,String(id),'canvas');
    else this._select(type,String(id),'canvas');
  }
  _reselectCanvas(){
    const card=this._card;
    this._applyLayerCss();
    if(!card||this.mode!=='arrange'||typeof card._rocSelect!=='function')return;
    const s=this.sel;
    try{card._rocSelect(s&&RS_TYPES[s.type]&&RS_TYPES[s.type].canvas?s.type:null,s?s.id:null);}catch(_){}
    if(typeof card._rocMark==='function')try{card._rocMark(this.multi.filter(function(x){return RS_TYPES[x.type]&&RS_TYPES[x.type].canvas;}));}catch(_){}
  }
  // hidden / locked layers: a stylesheet inside the canvas card (studio view only)
  _applyLayerCss(){
    const card=this._card;if(!card)return;
    let css='';
    this.hidden.forEach(function(t){const q=RS_LAYER_SEL[t];if(q)css+=q.map(function(x){return'.content '+x;}).join(',')+'{display:none!important;}';});
    this.locked.forEach(function(t){const q=RS_LAYER_SEL[t];if(q)css+=q.map(function(x){return'.content '+x+',.content '+x+' *';}).join(',')+'{pointer-events:none!important;}';});
    css+=this._markCss();
    card._rocExtraCss=css;
    const sr=card.shadowRoot;if(!sr)return;
    let st=sr.querySelector('style.roc-xcss');
    if(!css){if(st)st.remove();return;}
    if(!st){st=document.createElement('style');st.className='roc-xcss';const first=sr.querySelector('style');if(first&&first.nextSibling)sr.insertBefore(st,first.nextSibling);else sr.appendChild(st);}
    st.textContent=css;
  }
  toggleLayer(type,what){
    const set=what==='lock'?this.locked:this.hidden;
    if(set.has(type))set.delete(type);else set.add(type);
    // a hidden or locked element cannot stay selected on the canvas
    if(this.hidden.has(type)||this.locked.has(type)){
      if(this.sel&&this.sel.type===type)this.sel=this.multi.shift()||null;
      this.multi=this.multi.filter(function(x){return x.type!==type;});
    }
    this._reselectCanvas();this._renderOutlineList();this._renderSelBar();
  }

  // ---------------------------------------------------------------- selection (Phase 3)
  _findItem(type,id,cfg){
    const T=RS_TYPES[type];if(!T)return null;
    const o=rsOwner(cfg||this.work,this.roomIdx,this.global,T.key);
    if(!o.list)return null;
    const i=o.list.findIndex(function(x){return x&&String(x.id)===String(id);});
    return i<0?null:{list:o.list,idx:i,item:o.list[i],inherited:o.inherited};
  }
  _selSet(){return(this.sel?[this.sel]:[]).concat(this.multi);}
  _isSel(type,id){return this._selSet().some(function(x){return x.type===type&&x.id===String(id);});}
  // Shift / Ctrl / ⌘ click: add to the selection, or take an already selected element out of it
  _toggleSel(type,id,from){
    if(!RS_TYPES[type])return;
    id=String(id);
    if(!this.sel){this._select(type,id,from);return;}
    this.cardSel=null;
    if(this._isSel(type,id)){
      if(this.sel.type===type&&this.sel.id===id)this.sel=this.multi.shift()||null;
      else this.multi=this.multi.filter(function(x){return!(x.type===type&&x.id===id);});
    }else{
      this.multi.push(this.sel);
      this.sel={type:type,id:id};
    }
    this._reselectCanvas();
    if(this.sel&&from!=='inspector')this._revealItem(this.sel.type,this.sel.id);
    this._renderOutlineList();this._renderSelBar();
  }
  _select(type,id,from){
    if(!RS_TYPES[type])return;
    const f=this._findItem(type,id);
    this.multi=[];this.cardSel=null;
    this.sel={type:type,id:String(id)};
    // an element the room inherits lives in the shared (Global) list — edit it there
    if(f&&f.inherited&&!this.global&&from!=='inspector'&&from!=='drag')this._setRoom(this.roomIdx,true,'select');
    if(from!=='canvas')this._reselectCanvas();
    if(from!=='inspector')this._revealItem(type,id);
    this._renderOutlineList();this._renderSelBar();
  }
  deselect(){
    if(this.fp&&(this.fp.sel!=null||this.fp.door!=null)){this._fpSelect(null,null);return;}
    if(!this.sel&&!this.cardSel)return;
    this.sel=null;this.multi=[];this.cardSel=null;
    if(this._card&&typeof this._card._rocMark==='function')try{this._card._rocMark([]);}catch(_){}
    if(this._card&&typeof this._card._rocSelect==='function'&&this.mode==='arrange')try{this._card._rocSelect(null);}catch(_){}
    this._renderOutlineList();this._renderSelBar();
  }
  // show the selection in the inspector: the Properties form follows the selection by itself
  // (_syncProps); in All settings the element's own editor panel is opened and flashed
  _revealItem(type,id){
    if(this.tab==='all')this._revealInEditor(type,id);
    if(this._narrow(700))this._app.classList.add('show-insp');this._app.classList.remove('show-outline');
  }
  _revealInEditor(type,id){
    const ed=this._ed,T=RS_TYPES[type];if(!ed||!T)return;
    const list=(ed._roomView()||{})[T.key]||[];
    const i=list.findIndex(function(x){return x&&String(x.id)===String(id);});
    const tab=ed.querySelector('[data-roctab="elements"]');if(tab)tab.click();
    const sec=ed.querySelector('details[data-panel="'+T.panel+'"]');if(sec)sec.open=true;
    const d=i>=0?ed.querySelector('details[data-panel="'+T.pre+'-'+i+'"]'):null;
    const target=d||sec;
    if(!target)return;
    if(d)d.open=true;
    try{target.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){try{target.scrollIntoView();}catch(__){}}
    const sm=target.querySelector('summary');
    if(sm){sm.style.outline='2px solid var(--primary-color,#03a9f4)';sm.style.outlineOffset='1px';clearTimeout(sm._rsT);sm._rsT=setTimeout(function(){sm.style.outline='';sm.style.outlineOffset='';},1400);}
  }
  _syncEditor(){
    const ed=this._ed;if(!ed)return;
    this._edStale=false;
    ed._editRoomIdx=this.roomIdx;ed._editGlobal=this.global;
    ed._rocStudioLoad(this.I.clone(this.work));
  }
  // the same breakpoints as the studio CSS: ≤1100 px the outline slides over, ≤700 px the inspector
  _narrow(px){try{return!!(window.matchMedia&&window.matchMedia('(max-width:'+px+'px)').matches);}catch(_){return false;}}
  _setTab(k){
    if(k!=='props'&&k!=='all')return;
    this.tab=k;
    try{localStorage.setItem('roc-studio-tab',k);}catch(_){}
    for(const x in this._tabBtns)this._tabBtns[x].setAttribute('aria-selected',String(x===k));
    this._propsPane.hidden=k!=='props';this._edPane.hidden=k!=='all';
    if(k==='props')this._syncProps(true);
    else{
      if(this._edStale)this._syncEditor();
      if(this.sel)this._revealInEditor(this.sel.type,this.sel.id);
    }
  }
  deleteSel(){
    const set=this._selSet();if(!set.length)return;
    const c=JSON.parse(rsJ(this.work));
    const self=this;let n=0;
    set.forEach(function(x){const f=self._findItem(x.type,x.id,c);if(f){f.list.splice(f.idx,1);n++;}});
    if(!n)return;
    this.sel=null;this.multi=[];
    this._commit(c,'studio');
  }
  duplicateSel(){
    const set=this._selSet();if(!set.length)return;
    const c=JSON.parse(rsJ(this.work));
    const self=this,made=[];
    set.forEach(function(x){
      const f=self._findItem(x.type,x.id,c);if(!f)return;
      const it=JSON.parse(rsJ(f.item));
      it.id=rsUniqueId(f.list,RS_TYPES[x.type].idp,it.id);
      if(it.top!=null)it.top=rsNudgePct(it.top,2);
      if(it.left!=null)it.left=rsNudgePct(it.left,2);
      f.list.splice(f.idx+1,0,it);
      made.push({type:x.type,id:String(it.id)});
    });
    if(!made.length)return;
    this._commit(c,'studio');
    this._selectMany(made);
  }
  // select a list of elements at once (the first one is the primary)
  _selectMany(list){
    if(!list.length)return;
    this._select(list[0].type,list[0].id,'studio');
    this.multi=list.slice(1);
    this._reselectCanvas();this._renderOutlineList();this._renderSelBar();
  }
  copySel(){
    const set=this._selSet();if(!set.length)return false;
    const self=this,items=[];
    set.forEach(function(x){const f=self._findItem(x.type,x.id);if(f)items.push({type:x.type,item:JSON.parse(rsJ(f.item))});});
    if(!items.length)return false;
    this._clip={items:items};
    try{localStorage.setItem('roc-studio-clip',rsJ(this._clip));}catch(_){}
    this._renderSelBar();
    return true;
  }
  // the clipboard: {items:[{type,item}]} (v6.43.0), or {room} — a v6.42.0 {type,item} still reads
  _clipboard(){
    let v=this._clip;
    if(!v)try{v=JSON.parse(localStorage.getItem('roc-studio-clip')||'null');}catch(_){v=null;}
    if(!v)return null;
    if(v.type&&v.item)v={items:[{type:v.type,item:v.item}]};
    if(v.room&&typeof v.room==='object')return v;
    if(Array.isArray(v.items)&&v.items.length&&v.items.every(function(x){return x&&RS_TYPES[x.type]&&x.item;}))return v;
    return null;
  }
  paste(){
    const clip=this._clipboard();if(!clip)return;
    if(clip.room){this.pasteRoom();return;}
    const c=JSON.parse(rsJ(this.work));
    const self=this,made=[];
    clip.items.forEach(function(x){
      const T=RS_TYPES[x.type];
      const list=rsListForNew(c,self.roomIdx,self.global,T.key);
      const it=JSON.parse(rsJ(x.item));
      it.id=rsUniqueId(list,T.idp,it.id);
      if(list.some(function(y){return y&&y.top===it.top&&y.left===it.left;})){it.top=rsNudgePct(it.top,2);it.left=rsNudgePct(it.left,2);}
      list.push(it);
      made.push({type:x.type,id:String(it.id)});
    });
    this._commit(c,'studio');
    this._selectMany(made);
  }

  selectAll(){
    const self=this,all=[];
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];if(!T.canvas||self.hidden.has(type)||self.locked.has(type))return;
      (rsOwner(self.work,self.roomIdx,self.global,T.key).list||[]).forEach(function(it){if(it&&it.id!=null)all.push({type:type,id:String(it.id)});});
    });
    if(!all.length)return;
    this.cardSel=null;
    this.sel=all[0];this.multi=all.slice(1);
    this._reselectCanvas();this._renderOutlineList();this._renderSelBar();
  }
  // ---------------------------------------------------------------- align / distribute (3b)
  // Measured on the canvas (what you see), applied to top / left. Values that are not "%"
  // strings are left alone — the button reports how many were skipped.
  _boxes(){
    const card=this._card,self=this;
    if(!card||typeof card._rocBox!=='function')return[];
    return this._selSet().filter(function(x){return RS_TYPES[x.type]&&RS_TYPES[x.type].canvas;}).map(function(x){
      let b=null;try{b=card._rocBox(x.type,x.id);}catch(_){}
      return b?{x:x,b:b}:null;
    }).filter(Boolean);
  }
  align(edge){
    const bs=this._boxes();if(bs.length<2)return 0;
    const L=Math.min.apply(null,bs.map(function(o){return o.b.l;})),R=Math.max.apply(null,bs.map(function(o){return o.b.l+o.b.w;}));
    const T=Math.min.apply(null,bs.map(function(o){return o.b.t;})),B=Math.max.apply(null,bs.map(function(o){return o.b.t+o.b.h;}));
    const d=function(o){
      switch(edge){
        case'left':return{dl:L-o.b.l};case'right':return{dl:R-(o.b.l+o.b.w)};case'center':return{dl:(L+R)/2-(o.b.l+o.b.w/2)};
        case'top':return{dt:T-o.b.t};case'bottom':return{dt:B-(o.b.t+o.b.h)};case'middle':return{dt:(T+B)/2-(o.b.t+o.b.h/2)};
      }
      return{};
    };
    return this._shiftBoxes(bs.map(function(o){return Object.assign({x:o.x},d(o));}));
  }
  distribute(axis){
    const bs=this._boxes();if(bs.length<3)return 0;
    const h=axis!=='vertical';
    const pos=function(o){return h?o.b.l:o.b.t;},size=function(o){return h?o.b.w:o.b.h;};
    bs.sort(function(a,b){return pos(a)-pos(b);});
    const first=bs[0],last=bs[bs.length-1];
    const span=pos(last)+size(last)-pos(first);
    const sum=bs.reduce(function(a,o){return a+size(o);},0);
    const gap=(span-sum)/(bs.length-1);
    let cur=pos(first)+size(first)+gap;
    const moves=[];
    for(let i=1;i<bs.length-1;i++){const o=bs[i];const dd=cur-pos(o);moves.push(h?{x:o.x,dl:dd}:{x:o.x,dt:dd});cur+=size(o)+gap;}
    return this._shiftBoxes(moves);
  }
  _shiftBoxes(moves){
    const c=JSON.parse(rsJ(this.work));
    const self=this;let skipped=0,moved=0;
    moves.forEach(function(m){
      const f=self._findItem(m.x.type,m.x.id,c);if(!f)return;
      let ok=true;
      if(m.dt&&Math.abs(m.dt)>0.01)ok=rsShiftPct(f.item,'top',m.dt)&&ok;
      if(m.dl&&Math.abs(m.dl)>0.01)ok=rsShiftPct(f.item,'left',m.dl)&&ok;
      if(ok)moved++;else skipped++;
    });
    this._lastSkipped=skipped;
    this._commit(c,'studio');
    this._reselectCanvas();this._renderSelBar();
    return moved;
  }

  // ---------------------------------------------------------------- rooms (3b)
  duplicateRoom(idx){
    const c=JSON.parse(rsJ(this.work));
    if(!Array.isArray(c.rooms)||!c.rooms[idx])return;
    const r=rsRoomCopy(c.rooms,c.rooms[idx],this.t('copy_suffix'));
    c.rooms.splice(idx+1,0,r);
    this._commit(c,'studio');
    this._setRoom(idx+1,false,'outline');
  }
  copyRoom(idx){
    const r=this._rooms()[idx];if(!r)return;
    this._clip={room:JSON.parse(rsJ(r))};
    try{localStorage.setItem('roc-studio-clip',rsJ(this._clip));}catch(_){}
    this._renderChrome();
  }
  pasteRoom(){
    const clip=this._clipboard();if(!clip||!clip.room)return;
    const c=JSON.parse(rsJ(this.work));
    if(!Array.isArray(c.rooms)||!c.rooms.length)return; // a single-room card has no room list to add to
    const r=rsRoomCopy(c.rooms,clip.room,this.t('copy_suffix'));
    c.rooms.push(r);
    this._commit(c,'studio');
    this._setRoom(c.rooms.length-1,false,'outline');
  }
  deleteRoom(idx){
    const rooms=this._rooms();if(rooms.length<2||!rooms[idx])return;
    const c=JSON.parse(rsJ(this.work));
    c.rooms.splice(idx,1);
    this.sel=null;this.multi=[];
    if(this.roomIdx>=idx&&this.roomIdx>0)this.roomIdx--;
    this._commit(c,'studio');
    this._setRoom(this.roomIdx,false,'outline');
  }

  // ---------------------------------------------------------------- add (draw-to-create, E3)
  _showAdd(){
    const self=this;
    const grid=rsEl('div',{class:'addgrid'});
    let close=null;
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];
      grid.appendChild(rsEl('button',{class:'btn addbtn',type:'button','data-type':type,onclick:function(){if(close)close();self.add(type);}},
        [rsIcon(T.icon),rsEl('span',{text:self.t('t_'+type)})]));
    });
    close=this._panel(this.t('add_title'),[this.t(this._rooms().length&&!this.global?'add_body_room':'add_body'),grid],[{label:this.t('cancel'),id:'cancel'}]);
  }
  // canvas types: place by clicking / drawing on the image; the others are added straight away
  add(type){
    const T=RS_TYPES[type];if(!T)return;
    if(!T.canvas){this._create(type,null);return;}
    if(this.mode!=='arrange')this._setMode('arrange');
    this._startPlace(type);
  }
  _startPlace(type){
    const self=this;
    this._cancelPlace();
    this._placeType=type;
    const layer=rsEl('div',{class:'place'});
    const box=rsEl('div',{class:'place-box'});
    layer.appendChild(box);
    let sx=0,sy=0,down=false,pid=null;
    const sr=function(){return self._stage.getBoundingClientRect();};
    layer.addEventListener('pointerdown',function(e){
      if(e.button!==undefined&&e.button!==0)return;
      e.preventDefault();down=true;pid=e.pointerId;sx=e.clientX;sy=e.clientY;
      try{layer.setPointerCapture(pid);}catch(_){}
      box.style.display='none';
    });
    layer.addEventListener('pointermove',function(e){
      if(!down)return;
      const r=sr();
      box.style.display='block';
      box.style.left=(Math.min(sx,e.clientX)-r.left)+'px';box.style.top=(Math.min(sy,e.clientY)-r.top)+'px';
      box.style.width=Math.abs(e.clientX-sx)+'px';box.style.height=Math.abs(e.clientY-sy)+'px';
    });
    const up=function(e){
      if(!down)return;down=false;
      try{layer.releasePointerCapture(pid);}catch(_){}
      self._placeAt(sx,sy,e.clientX,e.clientY);
    };
    layer.addEventListener('pointerup',up);
    layer.addEventListener('pointercancel',function(){down=false;box.style.display='none';});
    this._stage.appendChild(layer);
    this._placeLayer=layer;
    this._renderSelBar();
  }
  _cancelPlace(){
    if(this._placeLayer){this._placeLayer.remove();this._placeLayer=null;}
    if(this._placeType){this._placeType=null;this._renderSelBar();}
  }
  // client coordinates of the press and the release → a new element on the image
  _placeAt(x0,y0,x1,y1){
    const type=this._placeType;
    const cont=this._card&&this._card.shadowRoot&&this._card.shadowRoot.querySelector('.content');
    this._cancelPlace();
    if(!type||!cont)return;
    const cr=cont.getBoundingClientRect();
    if(!(cr.width>0&&cr.height>0))return;
    const px=function(x){return(x-cr.left)/cr.width*100;},py=function(y){return(y-cr.top)/cr.height*100;};
    const dragged=Math.abs(x1-x0)+Math.abs(y1-y0)>8;
    const pos={};
    if(RS_TYPES[type].draw==='box'&&dragged){
      const l=Math.max(0,Math.min(px(x0),px(x1))),t=Math.max(0,Math.min(py(y0),py(y1)));
      const w=Math.min(100-l,Math.abs(px(x1)-px(x0))),h=Math.min(100-t,Math.abs(py(y1)-py(y0)));
      pos.top=rsPct(t);pos.left=rsPct(l);
      if(w>=1)pos.width=rsPct(w);
      if(h>=1)pos.height=rsPct(h);
    }else{
      pos.top=rsPct(py(y1));pos.left=rsPct(px(x1));
    }
    this._create(type,pos);
  }
  _create(type,pos){
    const T=RS_TYPES[type];
    const c=JSON.parse(rsJ(this.work));
    const list=rsListForNew(c,this.roomIdx,this.global,T.key);
    const it={id:rsUniqueId(list,T.idp)};
    if(pos){it.top=pos.top;it.left=pos.left;}
    const def=JSON.parse(rsJ(T.def));
    for(const k in def)if(!(pos&&pos[k]!==undefined))it[k]=def[k];
    if(pos&&pos.width)it.width=pos.width;
    if(pos&&pos.height)it.height=pos.height;
    list.push(it);
    this._commit(c,'studio');
    this._select(type,it.id,'studio');
  }
  _renderSelBar(){
    const self=this,b=this._selBar;if(!b)return;
    this._renderCardOutline();
    this._syncProps();
    b.innerHTML='';
    if(this._placeType){
      b.appendChild(rsEl('span',{class:'hint',text:this.t('place_hint',{t:this.t('t_'+this._placeType)})}));
      b.appendChild(rsEl('button',{class:'btn sm',type:'button',onclick:function(){self._cancelPlace();}},[this.t('cancel')]));
      return;
    }
    const s=this.sel;
    const n=this._selSet().length;
    if(s&&RS_TYPES[s.type]){
      b.appendChild(rsEl('span',{class:'chip'},[rsIcon(RS_TYPES[s.type].icon),rsEl('span',{text:n>1?this.t('n_selected',{n:n}):s.id})]));
      if(n>1){
        const al=rsEl('span',{class:'seg aligns'});
        [['left','mdi:align-horizontal-left'],['center','mdi:align-horizontal-center'],['right','mdi:align-horizontal-right'],['top','mdi:align-vertical-top'],['middle','mdi:align-vertical-center'],['bottom','mdi:align-vertical-bottom']].forEach(function(a){
          al.appendChild(rsEl('button',{type:'button','data-act':'al-'+a[0],title:self.t('al_'+a[0]),'aria-label':self.t('al_'+a[0]),onclick:function(){self.align(a[0]);}},[rsIcon(a[1])]));
        });
        if(n>2){
          al.appendChild(rsEl('button',{type:'button','data-act':'dist-h',title:self.t('dist_h'),'aria-label':self.t('dist_h'),onclick:function(){self.distribute('horizontal');}},[rsIcon('mdi:distribute-horizontal-center')]));
          al.appendChild(rsEl('button',{type:'button','data-act':'dist-v',title:self.t('dist_v'),'aria-label':self.t('dist_v'),onclick:function(){self.distribute('vertical');}},[rsIcon('mdi:distribute-vertical-center')]));
        }
        b.appendChild(al);
        if(this._lastSkipped)b.appendChild(rsEl('span',{class:'hint warn',text:this.t('al_skipped',{n:this._lastSkipped})}));
      }
      b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'dup',title:this.t('dup_hint'),onclick:function(){self.duplicateSel();}},[rsIcon('mdi:content-duplicate'),rsEl('span',{class:'lbl',text:this.t('dup')})]));
      b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'copy',title:this.t('copy_hint'),onclick:function(){self.copySel();}},[rsIcon('mdi:content-copy'),rsEl('span',{class:'lbl',text:this.t('copy')})]));
      b.appendChild(rsEl('button',{class:'btn sm danger',type:'button','data-act':'del',title:this.t('del_hint'),onclick:function(){self.deleteSel();}},[rsIcon('mdi:delete-outline'),rsEl('span',{class:'lbl',text:this.t('del')})]));
    }
    if(this._clipboard())b.appendChild(rsEl('button',{class:'btn sm',type:'button','data-act':'paste',title:this.t('paste_hint'),onclick:function(){self.paste();}},[rsIcon('mdi:content-paste'),rsEl('span',{class:'lbl',text:this.t('paste')})]));
  }

  // ---------------------------------------------------------------- properties (4a)
  // What the Properties form edits: the selected element; else the room shown; else the card
  // itself (a single-room card, or Global = the defaults every room falls back to).
  _propsTarget(){
    const s=this.sel;
    if(s&&RS_TYPES[s.type]){const f=this._findItem(s.type,s.id);if(f)return{kind:'element',type:s.type,id:s.id,f:f};}
    const fpt=this._fpTarget();if(fpt)return fpt; // v6.47.0: a room or door on the floor plan
    const cs=this.cardSel;
    if(cs){
      if(cs.kind==='section'){const l=Array.isArray(this.work.sections)?this.work.sections:[];const i=l.findIndex(function(x){return x&&String(x.id)===String(cs.id);});if(i>=0)return{kind:'section',id:String(cs.id),idx:i};}
      else if(cs.kind==='nav'&&this._rooms().length)return{kind:'nav'};
      else if(cs.kind==='card')return{kind:'card',settings:true};
    }
    if(this._rooms().length&&!this.global)return{kind:'room'};
    return{kind:'card'};
  }
  // the validator's path of an element ("rooms[1].zones[0]", "icons[2]")
  _itemPath(type,id){
    const T=RS_TYPES[type],f=this._findItem(type,id);if(!T||!f)return null;
    const room=rsRoom(this.work,this.roomIdx,this.global);
    return(room&&!f.inherited?'rooms['+this.roomIdx+'].':'')+T.key+'['+f.idx+']';
  }
  _levelOf(prefix){
    let lv='';
    (this._findings||[]).forEach(function(f){
      const p=f.path||'';
      if(p===prefix||p.indexOf(prefix+'.')===0||p.indexOf(prefix+'[')===0){if(f.level==='error')lv='error';else if(!lv)lv='warn';}
    });
    return lv;
  }
  // pinned validation: a dot on outline rows that have findings, a red ring on the canvas
  _applyMarks(outlineOnly){
    const self=this;
    const dot=function(btn,lv){
      const old=btn.querySelector('.vd');if(old)old.remove();
      if(lv)btn.appendChild(rsEl('span',{class:'vd '+lv,title:self.t(lv==='error'?'mark_err':'mark_warn')}));
    };
    if(this._olList)this._olList.querySelectorAll('.ol-el[data-type]').forEach(function(b){const p=self._itemPath(b.getAttribute('data-type'),b.getAttribute('data-id'));dot(b,p?self._levelOf(p):'');});
    if(this._olRooms)this._olRooms.querySelectorAll('[data-room]').forEach(function(b){dot(b,self._levelOf('rooms['+b.getAttribute('data-room')+']'));});
    if(this._olCard)this._olCard.querySelectorAll('[data-vpath]').forEach(function(b){dot(b,self._levelOf(b.getAttribute('data-vpath')));});
    if(outlineOnly)return;
    if(this._propsPane){const r=this._propsPane.firstChild;if(r&&r._rsRefresh)r._rsRefresh(this._findings||[]);}
    this._applyLayerCss();
  }
  _markCss(){
    if(this.mode!=='arrange'||!this._findings||!this._findings.length)return'';
    const self=this,sels=[];
    const q=function(v){return'"'+String(v).replace(/["\\]/g,'\\$&')+'"';};
    const attr={zone:['data-z'],icon:['data-ico'],label:['data-lbl'],gauge:['data-gauge'],element:['data-el'],glow:['data-glow','data-glowedit'],vacuum_widget:['data-vw']};
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];if(!T.canvas||self.hidden.has(type))return;
      (rsOwner(self.work,self.roomIdx,self.global,T.key).list||[]).forEach(function(it){
        if(!it||it.id==null)return;
        const p=self._itemPath(type,it.id);
        if(!p||self._levelOf(p)!=='error')return;
        if(type==='blind')sels.push('.content [data-gauge='+q('__bl_'+it.id)+']');
        else (attr[type]||[]).forEach(function(a){sels.push('.content ['+a+'='+q(it.id)+']');});
      });
    });
    return sels.length?sels.join(',')+'{box-shadow:0 0 0 2px var(--error-color,#db4437),0 0 12px 3px rgba(219,68,55,.55)!important;}':'';
  }
  // rebuild the form when what it shows changed — but not after its own commit (the cursor is in it)
  _syncProps(force){
    const pane=this._propsPane;if(!pane)return;
    if(this.tab!=='props'){this._propsSig='';return;}
    const tg=this._propsTarget();
    const key=tg.kind+(tg.settings?'*':'')+':'+(tg.type||'')+':'+(tg.id||'')+'@'+(this.global?'g':this.roomIdx);
    let data;
    const top=function(w){const o={};Object.keys(w).forEach(function(k){if(k!=='rooms')o[k]=w[k];});return rsJ(o);};
    if(tg.kind==='element')data=rsJ(tg.f.item)+(tg.f.inherited?'i':'');
    else if(tg.kind==='room')data=rsJ(this._rooms()[this.roomIdx])+top(this.work);   // + the shared values it may inherit
    else if(tg.kind==='section')data=rsJ(this.work.sections[tg.idx])+'#'+tg.idx+'/'+this.work.sections.length+this._membersSig();
    else if(tg.kind==='nav')data=rsJ(this.work.nav||null);
    else if(tg.kind==='fproom'||tg.kind==='fpdoor'||tg.kind==='fpitem')data=rsJ(tg.item);
    else data=top(this.work);
    const sig=key+'|'+data+'|'+this._selSet().length;
    if(!force&&sig===this._propsSig)return;
    if(!force&&this._propsSkip&&key===this._propsKey){this._propsSig=sig;this._propsSkip=false;return;}
    this._propsSkip=false;
    const same=key===this._propsKey;
    const st=pane.scrollTop;
    // the same target rebuilt (undo, a canvas drag): the focus goes back to the same field
    let fk=null;
    const ae=this._sr&&this._sr.activeElement;
    if(same&&ae&&pane.contains(ae)&&/^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)&&!ae.closest('.rs-pick')){const f=ae.closest('.pf-field');if(f)fk=f.getAttribute('data-key');}
    const fn=this._focusNest;this._focusNest=null;
    this._propsSig=sig;this._propsKey=key;
    pane.innerHTML='';
    const ctx=this._propsCtx(tg);
    pane.appendChild(rsBuildProps(ctx,tg));
    rsMarkNests(pane);
    pane.scrollTop=same?st:0;
    if(fn){ // a list item just added: its first field
      const d=[...pane.querySelectorAll('details[data-nest]')].find(function(x){return x.getAttribute('data-nest')===fn;});
      const el=d&&d.querySelector('input:not([type="checkbox"]):not([type="color"]),select,textarea');
      if(el){try{el.focus({preventScroll:true});d.scrollIntoView({block:'nearest'});}catch(_){}}
    }else if(fk){const f=pane.querySelector('.pf-field[data-key="'+fk+'"]');const el=f&&f.querySelector('input,select,textarea');if(el)try{el.focus({preventScroll:true});}catch(_){}}
  }
  // every element tagged into a section (`section: <id>`), in the shared lists and in each room
  _members(secId){
    const out=[],w=this.work,rooms=this._rooms();
    const scan=function(o,room,roomName){RS_TYPE_ORDER.forEach(function(type){(Array.isArray(o[RS_TYPES[type].key])?o[RS_TYPES[type].key]:[]).forEach(function(it){if(it&&it.id!=null&&String(it.section)===String(secId))out.push({type:type,id:String(it.id),room:room,roomName:roomName});});});};
    scan(w,-1,rooms.length?this.t('global'):'');
    rooms.forEach(function(r,i){if(r)scan(r,i,String(r.name||r.id||''));});
    return out;
  }
  _membersSig(){const self=this;return rsJ((this.work.sections||[]).map(function(s){return s&&self._members(s.id).length;}));}
  _propsCtx(tg){
    const self=this,I=this.I,w=this.work;
    const room=rsRoom(w,this.roomIdx,this.global);
    let item,path,inherited=false;
    if(tg.kind==='element'){item=tg.f.item;inherited=tg.f.inherited;path=this._itemPath(tg.type,tg.id);}
    else if(tg.kind==='room'){item=this._rooms()[this.roomIdx];path='rooms['+this.roomIdx+']';}
    else if(tg.kind==='section'){item=w.sections[tg.idx];path='sections['+tg.idx+']';}
    else if(tg.kind==='nav'){item=w.nav&&typeof w.nav==='object'?w.nav:{};path='nav';}
    else if(tg.kind==='fproom'||tg.kind==='fpdoor'||tg.kind==='fpitem'){item=tg.item;path=tg.path;}
    else{item=w;path='';}
    const ids=function(list){const o=[];(list||[]).forEach(function(x){if(x&&x.id!=null&&o.indexOf(String(x.id))<0)o.push(String(x.id));});return o;};
    return{
      t:function(k,v){return self.t(k,v);},I:I,
      get hass(){return self.hass;},
      work:w,scope:room||w,item:item,path:path,global:this.global,
      shared:tg.kind==='room'?w:null,
      findings:this._findings||this._validate(),
      domains:tg.kind==='element'?(RS_DOMAINS[tg.type]||null):null,
      labels:{z_index:'Z-index',hold_delay:'Hold delay (ms)'},
      open:this._propsOpen,yamlKeys:this._yamlKeys,inherited:inherited,multi:this._selSet().length,
      // suggestions for plain text keys, grounded in the config or in Home Assistant
      choices:function(key,schema){
        const pair=function(l){return l.map(function(x){return[x,x];});};
        if(key==='section'||(key==='sections'&&schema==='ovDock'))return pair(ids(w.sections));
        if(key==='group')return pair(ids([].concat((room&&room.groups)||[],w.groups||[])));
        if(key==='room'&&schema==='fpRoom')return rsFpPageRooms(w).map(function(x){return[String((x.r.overview_tile&&x.r.overview_tile.name)||x.r.name||x.r.id)+' ('+x.r.id+')',String(x.r.id)];});
        if(key==='rooms'||key==='focus')return pair(ids(self._rooms()));
        if(key==='area_match'){const a=(self.hass&&self.hass.areas)||{};return Object.keys(a).map(function(k){return[String(a[k].name||k),k];});}
        if(key==='domain'){const d=[];Object.keys((self.hass&&self.hass.states)||{}).forEach(function(e){const x=e.split('.')[0];if(d.indexOf(x)<0)d.push(x);});return pair(d.sort());}
        return null;
      },
      members:function(id){return self._members(id);},
      select:function(type,id,roomIdx){
        if(roomIdx>=0)self._setRoom(roomIdx,false,'outline');else if(self._rooms().length)self._setRoom(self.roomIdx,true,'outline');
        self._select(type,id,'outline');
      },
      goGlobal:function(){self.sel=null;self.multi=[];self.cardSel=null;self._setRoom(self.roomIdx,true,'outline');},
      sectionAct:function(act){self._sectionAct(tg.id,act);},
      set:function(k,v){self._propsSet(tg,function(it){if(v===undefined)delete it[k];else it[k]=v;},k);},
      setRest:function(keys,obj){
        self._propsSet(tg,function(it){keys.forEach(function(k){if(!(k in obj))delete it[k];});Object.keys(obj).forEach(function(k){it[k]=obj[k];});},'_rest');
        self._syncProps(true);
      },
      rename:function(nid){self._propsRename(tg,nid);},
      rerender:function(){self._syncProps(true);},
      focusNest:function(k){self._focusNest=k;},
      openAll:function(){
        self._setTab('all');
        if(tg.kind==='element'||!self._ed)return;
        const tab=self._ed.querySelector('[data-roctab="'+({room:'rooms',nav:'rooms',section:'sections'}[tg.kind]||'image')+'"]');if(tab)tab.click();
      },
    };
  }
  // one change from the form: a copy of the config, the target's own object changed in place
  // (every other key, and the key order, stay as they are — KEEP)
  _propsSet(tg,mut,key){
    const c=JSON.parse(rsJ(this.work));
    let it=null;
    if(tg.kind==='element'){const f=this._findItem(tg.type,tg.id,c);it=f&&f.item;}
    else if(tg.kind==='room')it=Array.isArray(c.rooms)?c.rooms[this.roomIdx]:null;
    else if(tg.kind==='section')it=Array.isArray(c.sections)?c.sections[tg.idx]:null;
    else if(tg.kind==='nav'){if(!c.nav||typeof c.nav!=='object')c.nav={};it=c.nav;}
    else if(tg.kind==='fproom'||tg.kind==='fpdoor'||tg.kind==='fpitem')it=this._fpItem(c,tg);
    else it=c;
    if(!it||typeof it!=='object')return;
    mut(it);
    if(tg.kind==='nav'&&!Object.keys(c.nav).length)delete c.nav; // an emptied nav: no `nav: {}` left behind
    this._commit(c,'props',(tg.kind==='element'?tg.type+':'+tg.id:tg.kind+':'+(tg.id||''))+'.'+key);
  }
  // rename an element (or a section): unique id; the selection follows; sections and groups take
  // their references along (`section:` / `group:` keys, actions, the overview dock)
  _propsRename(tg,nid){
    const c=JSON.parse(rsJ(this.work));
    let old,id,refKey=null;
    if(tg.kind==='element'){
      const f=this._findItem(tg.type,tg.id,c);if(!f)return;
      old=String(f.item.id);
      id=rsUniqueId(f.list.filter(function(x,i){return i!==f.idx;}),RS_TYPES[tg.type].idp,nid);
      f.item.id=id;
      if(tg.type==='group')refKey='group';
      if(this.sel&&this.sel.type===tg.type&&this.sel.id===String(tg.id))this.sel={type:tg.type,id:String(id)};
    }else if(tg.kind==='section'){
      const l=c.sections;old=String(l[tg.idx].id);
      id=rsUniqueId(l.filter(function(x,i){return i!==tg.idx;}),'section_',nid);
      l[tg.idx].id=id;refKey='section';
      this.cardSel={kind:'section',id:String(id)};
    }else return;
    let refs=0;
    if(refKey&&old!==String(id))(function walk(o,parentKey,isSectionList){
      if(!o||typeof o!=='object')return;
      if(Array.isArray(o)){
        o.forEach(function(x,i){if(refKey==='section'&&parentKey==='sections'&&!isSectionList&&x===old){o[i]=id;refs++;}else walk(x,null,false);});
        return;
      }
      if(o[refKey]===old&&!(refKey==='group'&&o.id===id)){o[refKey]=id;refs++;}
      Object.keys(o).forEach(function(k){walk(o[k],k,o===c&&k==='sections');});
    })(c,null,false);
    this._lastRefs=refs;
    this._commit(c,'props','id');
    this._syncProps(true);
  }
  // card-level things in the outline: Card settings, Navigation, Sections
  selectCard(kind,id){
    this.sel=null;this.multi=[];
    if(this._card&&typeof this._card._rocMark==='function')try{this._card._rocMark([]);}catch(_){}
    if(this._card&&typeof this._card._rocSelect==='function'&&this.mode==='arrange')try{this._card._rocSelect(null);}catch(_){}
    this.cardSel={kind:kind,id:id==null?null:String(id)};
    if(this.tab==='all'&&this._ed){const tab=this._ed.querySelector('[data-roctab="'+({nav:'rooms',section:'sections'}[kind]||'image')+'"]');if(tab)tab.click();}
    if(this._narrow(700))this._app.classList.add('show-insp');
    this._app.classList.remove('show-outline');
    this._renderChrome();
  }
  addSection(kind){
    const c=JSON.parse(rsJ(this.work));
    if(!Array.isArray(c.sections))c.sections=[];
    let def=null;
    if(kind&&this._ed&&typeof this._ed._recipeDef==='function')try{def=this._ed._recipeDef(kind);}catch(_){def=null;}  // the editor's own recipes
    const id=rsUniqueId(c.sections,'section_',kind&&def?kind:null);
    c.sections.push(Object.assign({id:id},def||{title:this.t('t_section')}));
    this._commit(c,'studio');
    this.selectCard('section',id);
  }
  _sectionAct(id,act){
    const c=JSON.parse(rsJ(this.work));
    const l=Array.isArray(c.sections)?c.sections:[];
    const i=l.findIndex(function(x){return x&&String(x.id)===String(id);});if(i<0)return;
    if(act==='up'&&i>0)l.splice(i-1,0,l.splice(i,1)[0]);
    else if(act==='down'&&i<l.length-1)l.splice(i+1,0,l.splice(i,1)[0]);
    else if(act==='delete'){l.splice(i,1);if(!l.length)delete c.sections;this.cardSel=null;}
    else return;
    this._commit(c,'studio');
    this._syncProps(true);
  }
  _renderCardOutline(){
    const self=this,box=this._olCard;if(!box)return;
    box.innerHTML='';
    const cs=this.cardSel,rooms=this._rooms();
    box.appendChild(rsEl('div',{class:'ol-h',text:this.t('card_h')}));
    const row=function(kind,id,icon,label,vpath,extra){
      const cur=!!(cs&&!self.sel&&cs.kind===kind&&String(cs.id)===String(id==null?null:id));
      const b=rsEl('button',{class:'ol-item ol-card',type:'button','data-card':kind+(id!=null?':'+id:''),'data-vpath':vpath==null?null:vpath,'aria-current':String(cur),onclick:function(){self.selectCard(kind,id);}},
        [rsIcon(icon),rsEl('span',{class:'nm',text:label})].concat(extra||[]));
      box.appendChild(b);return b;
    };
    row('card',null,'mdi:cog-outline',this.t('card_settings'),null);
    if(rooms.length)row('nav',null,'mdi:dots-horizontal-circle-outline',this.t('nav_form'),'nav');
    const secs=Array.isArray(this.work.sections)?this.work.sections:[];
    const sh=rsEl('div',{class:'ol-row ol-kindrow'});
    sh.appendChild(rsEl('span',{class:'ol-item ol-kind ol-static'},[rsIcon('mdi:view-dashboard-outline'),rsEl('span',{text:this.t('sections_h')}),rsEl('span',{class:'n',text:secs.length?String(secs.length):''})]));
    sh.appendChild(rsEl('button',{class:'ol-act',type:'button','data-act':'sec-add',title:this.t('sec_add'),'aria-label':this.t('sec_add'),onclick:function(){self._showAddSection();}},[rsIcon('mdi:plus')]));
    box.appendChild(sh);
    secs.forEach(function(sc,i){
      if(!sc)return;
      const n=self._members(sc.id).length;
      const b=row('section',String(sc.id),sc.icon&&/^mdi:/.test(sc.icon)?sc.icon:'mdi:view-dashboard-outline',String(sc.title||sc.id),'sections['+i+']',[n?rsEl('span',{class:'sub',title:self.t('sec_members',{n:n}),text:String(n)}):null]);
      b.classList.add('ol-el');
    });
    box.querySelectorAll('[data-vpath]').forEach(function(b){const lv=self._levelOf(b.getAttribute('data-vpath'));if(lv)b.appendChild(rsEl('span',{class:'vd '+lv,title:self.t(lv==='error'?'mark_err':'mark_warn')}));});
  }
  _showAddSection(){
    const self=this;
    const grid=rsEl('div',{class:'addgrid'});
    let close=null;
    // the editor's own recipe list (room-overlay-card-editor: _recipeDef)
    const kinds=[['','mdi:plus',this.t('sec_blank')],['appliances','mdi:washing-machine','Appliances'],['cleaning','mdi:robot-vacuum','Cleaning'],['media','mdi:cast','Media'],
      ['heating','mdi:radiator','Heating'],['covers','mdi:window-shutter','Covers'],['electricity','mdi:flash','Electricity'],['weather','mdi:weather-partly-cloudy','Weather']];
    kinds.forEach(function(k){
      let ok=!k[0];
      if(k[0]&&self._ed&&typeof self._ed._recipeDef==='function')try{ok=!!self._ed._recipeDef(k[0]);}catch(_){ok=false;}
      grid.appendChild(rsEl('button',{class:'btn addbtn',type:'button','data-recipe':k[0]||'blank',disabled:ok?null:true,title:ok?null:self.t('sec_needs'),onclick:function(){if(close)close();self.addSection(k[0]||null);}},[rsIcon(k[1]),rsEl('span',{text:k[2]})]));
    });
    close=this._panel(this.t('sec_add'),[this.t('sec_add_body'),grid],[{label:this.t('cancel'),id:'cancel'}]);
  }

  // ---------------------------------------------------------------- state
  _rooms(){return Array.isArray(this.work&&this.work.rooms)?this.work.rooms:[];}
  _dirty(){return rsJ(this.work)!==this.base;}
  _commit(c,src,key){
    const j=rsJ(c),cur=rsJ(this.work);
    if(j===cur)return;
    const now=Date.now();
    // a typing burst in one field fires every 150 ms — keep it as ONE undo step; the Properties
    // form commits on change, so only repeated changes of the same key within 800 ms merge
    const coalesce=now-this.lastCommit<800&&((src==='editor'&&this.lastSrc==='editor')||(src==='props'&&this.lastSrc==='props'&&key!=null&&key===this._lastKey));
    this._lastKey=key;
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
    const self0=this;
    this.multi=this.multi.filter(function(x){return!!self0._findItem(x.type,x.id);});
    if(this.sel&&!this._findItem(this.sel.type,this.sel.id))this.sel=this.multi.shift()||null;
    const n=this._rooms().length;
    if(n&&this.roomIdx>=n)this.roomIdx=n-1;
    if(!n)this.global=false;
    if(src!=='editor'&&this._ed){
      // the hosted editor is rebuilt only while it is shown (All settings) — otherwise once, when
      // its tab is opened (a large card's editor takes a while to build)
      if(this.tab==='all')this._syncEditor();else this._edStale=true;
    }
    if(src==='canvas'){if(this._card)this._card._cfgJson=null;} // card already shows it; never skip its next setConfig
    else this._pushCanvas(src!=='editor');
    this._propsSkip=src==='props'; // the form already shows its own change — do not rebuild it under the cursor
    this._renderChrome();
  }
  _setRoom(idx,global,from){
    const n=this._rooms().length;
    if(!n)return;
    idx=Math.max(0,Math.min(idx|0,n-1));
    const gChanged=!!global!==this.global;
    this.roomIdx=idx;this.global=!!global;
    if(from!=='editor'&&this._ed){if(this.tab==='all'){this._ed._editRoomIdx=idx;this._ed._editGlobal=this.global;this._ed._render();}else this._edStale=true;}
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
    // outline: rooms
    const ol=this._olRooms;ol.innerHTML='';
    if(rooms.length){
      ol.appendChild(rsEl('div',{class:'ol-h',text:this.t('rooms')}));
      const mk=function(label,icon,cur,fn){return rsEl('button',{class:'ol-item',type:'button','aria-current':String(!!cur),onclick:fn},[rsIcon(icon),rsEl('span',{text:label})]);};
      ol.appendChild(mk(this.t('global'),'mdi:earth',this.global,function(){self._setRoom(self.roomIdx,true,'outline');}));
      rooms.forEach(function(r,i){
        const cur=!self.global&&i===self.roomIdx;
        const row=rsEl('div',{class:'ol-row'+(cur?' cur':'')});
        const rb=mk(String(r.name||r.id||('room '+(i+1))),r.overview?'mdi:view-dashboard-outline':(r.floorplan?'mdi:floor-plan':'mdi:door'),cur,function(){self.sel=null;self.multi=[];self.cardSel=null;self._setRoom(i,false,'outline');self._app.classList.remove('show-outline');});
        rb.setAttribute('data-room',String(i));
        row.appendChild(rb);
        if(cur){
          row.appendChild(rsEl('button',{class:'ol-act',type:'button','data-act':'room-dup',title:self.t('room_dup'),'aria-label':self.t('room_dup'),onclick:function(){self.duplicateRoom(i);}},[rsIcon('mdi:content-duplicate')]));
          row.appendChild(rsEl('button',{class:'ol-act',type:'button','data-act':'room-copy',title:self.t('room_copy'),'aria-label':self.t('room_copy'),onclick:function(){self.copyRoom(i);}},[rsIcon('mdi:content-copy')]));
          if(rooms.length>1)row.appendChild(rsEl('button',{class:'ol-act danger',type:'button','data-act':'room-del',title:self.t('room_del'),'aria-label':self.t('room_del'),onclick:function(){self._panel(self.t('room_del_title',{r:String(r.name||r.id||'')}),[self.t('room_del_body')],[{label:self.t('room_del'),cls:'danger',id:'room-del-ok',fn:function(){self.deleteRoom(i);}},{label:self.t('cancel'),cls:'primary',id:'cancel'}]);}},[rsIcon('mdi:delete-outline')]));
        }
        ol.appendChild(row);
      });
      const clip=this._clipboard();
      if(clip&&clip.room)ol.appendChild(rsEl('button',{class:'ol-item ol-paste',type:'button','data-act':'room-paste',onclick:function(){self.pasteRoom();}},[rsIcon('mdi:content-paste'),rsEl('span',{text:self.t('room_paste',{r:String(clip.room.name||clip.room.id||'')})})]));
      ol.appendChild(rsEl('button',{class:'ol-item ol-paste',type:'button','data-act':'add-fp',title:self.t('fp_add'),onclick:function(){self.addFloorplan();}},[rsIcon('mdi:plus'),rsEl('span',{text:self.t('fp_add_btn')})]));
    }
    this._renderOutlineList();
    this._renderSelBar();
    this._fpChrome(); // v6.47.0: the floor plan tools (only on a floor plan page)
    this._addBtn.disabled=this._fpIdx()>=0; // a floor plan page has no elements to add — its toolbar draws rooms
    this._fpDraw();
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
  // outline: every element of the room (or Global) by type, filtered by the search box
  _renderOutlineList(){
    const self=this,box=this._olList;if(!box)return;
    box.innerHTML='';
    const q=String(this.search||'').trim().toLowerCase();
    const hit=function(type,it){
      if(!q)return true;
      const hay=[type,self.t('t_'+type),it.id,it.name,it.entity,it.icon,it.card&&it.card.entity,it.card&&it.card.type].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(q)>=0;
    };
    if(this._fpIdx()>=0){this._fpOutline(box);this._applyMarks(true);return;} // v6.47.0: a floor plan page lists its rooms and doors
    let shown=0;
    RS_TYPE_ORDER.forEach(function(type){
      const T=RS_TYPES[type];
      const o=rsOwner(self.work,self.roomIdx,self.global,T.key);
      const items=(o.list||[]).filter(function(it){return it&&typeof it==='object'&&hit(type,it);});
      if(!items.length)return;
      shown+=items.length;
      const hid=self.hidden.has(type),lck=self.locked.has(type);
      const head=rsEl('div',{class:'ol-row ol-kindrow'+(hid?' hid':'')});
      head.appendChild(rsEl('button',{class:'ol-item ol-kind',type:'button',onclick:function(){self._reveal(T.panel);}},
        [rsIcon(T.icon),rsEl('span',{text:self.t('k_'+T.key)}),o.inherited?rsEl('span',{class:'tag',text:self.t('inherited')}):null,rsEl('span',{class:'n',text:String(items.length)})]));
      if(T.canvas||type==='overlay'||type==='badge'){
        head.appendChild(rsEl('button',{class:'ol-act'+(hid?' on':''),type:'button','data-act':'hide-'+type,'aria-pressed':String(hid),title:self.t(hid?'layer_show':'layer_hide'),'aria-label':self.t(hid?'layer_show':'layer_hide'),onclick:function(){self.toggleLayer(type,'hide');}},[rsIcon(hid?'mdi:eye-off-outline':'mdi:eye-outline')]));
        if(T.canvas)head.appendChild(rsEl('button',{class:'ol-act'+(lck?' on':''),type:'button','data-act':'lock-'+type,'aria-pressed':String(lck),title:self.t(lck?'layer_unlock':'layer_lock'),'aria-label':self.t(lck?'layer_unlock':'layer_lock'),onclick:function(){self.toggleLayer(type,'lock');}},[rsIcon(lck?'mdi:lock-outline':'mdi:lock-open-variant-outline')]));
      }
      box.appendChild(head);
      items.forEach(function(it){
        const cur=self._isSel(type,it.id);
        const sub=it.entity||(it.card&&it.card.entity)||it.icon||'';
        box.appendChild(rsEl('button',{class:'ol-item ol-el'+(hid?' hid':''),type:'button','data-type':type,'data-id':String(it.id),'aria-current':String(cur),onclick:function(e){if(e.shiftKey||e.ctrlKey||e.metaKey)self._toggleSel(type,String(it.id),'outline');else self._select(type,String(it.id),'outline');}},
          [rsEl('span',{class:'nm',text:String(it.id==null?'':it.id)}),sub?rsEl('span',{class:'sub',text:String(sub)}):null]));
      });
    });
    const lc=(rsRoom(self.work,self.roomIdx,self.global)||{}).light_controls||self.work.light_controls;
    const lcn=lc&&Array.isArray(lc.entities)?lc.entities.length:0;
    if(lcn&&(!q||'light controls lights'.indexOf(q)>=0)){
      shown+=1;
      // v6.45.0: light controls are part of the room (or Global) form in Properties
      box.appendChild(rsEl('button',{class:'ol-item ol-kind',type:'button','data-act':'lights',onclick:function(){
        if(self.tab!=='props'){self._reveal('lights');return;}
        self.sel=null;self.multi=[];self.cardSel=null;self._propsOpen.add('lights');
        if(!(rsRoom(self.work,self.roomIdx,self.global)||{}).light_controls&&self._rooms().length&&!self.global&&self.work.light_controls)self._setRoom(self.roomIdx,true,'outline');
        self._reselectCanvas();self._renderChrome();self._syncProps(true);
        const g=self._propsPane.querySelector('[data-sec="lights"]');if(g)try{g.scrollIntoView({block:'start'});}catch(_){}
      }},[rsIcon('mdi:tune-vertical'),rsEl('span',{text:self.t('k_lights')}),rsEl('span',{class:'n',text:String(lcn)})]));
    }
    if(!shown)box.appendChild(rsEl('div',{class:'ol-empty',text:q?this.t('no_match'):this.t('no_elements')}));
    this._applyMarks(true);
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
    this._applyMarks();
  }
  // open the editor section that holds this kind of element
  _reveal(panel){
    const ed=this._ed;if(!ed)return;
    if(this.tab!=='all')this._setTab('all');
    const tab=ed.querySelector('[data-roctab="elements"]');if(tab)tab.click();
    const d=ed.querySelector('details[data-panel="'+panel+'"]');
    if(d){d.open=true;try{d.scrollIntoView({block:'start',behavior:'smooth'});}catch(_){d.scrollIntoView();}}
    if(this._narrow(700))this._app.classList.add('show-insp');this._app.classList.remove('show-outline');
  }

  // ---------------------------------------------------------------- keyboard
  _onKey(e){
    const path=e.composedPath?e.composedPath():[e.target];
    const tgt=path[0]||e.target;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();
      // an open picker list closes first; a Properties field just gives up the focus (its change commits)
      const pk=this._sr&&this._sr.querySelector('.rs-pick.open');
      if(pk&&pk._rsClose){pk._rsClose();return;}
      if(this._propsPane&&tgt&&this._propsPane.contains(tgt)&&/^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName||'')){try{tgt.blur();}catch(_){}return;}
      if(this._layers.length){this._layers[this._layers.length-1]();return;}
      if(this._placeType){this._cancelPlace();return;}
      if(this._fpEsc())return;
      if(this.sel||this.cardSel){this.deselect();return;}
      // a slide-over panel (narrow screens only — the classes do nothing on a wide one)
      if((this._app.classList.contains('show-outline')&&this._narrow(1100))||(this._app.classList.contains('show-insp')&&this._narrow(700))){this._app.classList.remove('show-outline','show-insp');return;}
      const card=this._card;
      if(card&&card._sectionOpen&&typeof card._closeSection==='function'){card._closeSection();return;}
      this.requestClose();
      return;
    }
    const tag=(tgt&&tgt.tagName||'').toLowerCase();
    const inField=tag==='input'||tag==='textarea'||tag==='select'||!!(tgt&&tgt.isContentEditable);
    // Ctrl+Z / Y in a Properties field with nothing typed yet is the studio's undo (the browser's
    // own would only put back the text of another field, without committing it)
    if(inField&&(e.ctrlKey||e.metaKey)&&!e.altKey&&this._propsPane&&this._propsPane.contains(tgt)&&!tgt._rsDirty&&!this._layers.length){
      const kz=String(e.key||'').toLowerCase();
      if(kz==='z'||kz==='y'){e.preventDefault();e.stopPropagation();if(kz==='y'||e.shiftKey)this.redo();else this.undo();return;}
    }
    if(!inField&&!this._layers.length&&(e.key==='Delete'||e.key==='Backspace')&&!this.sel&&!e.ctrlKey&&!e.metaKey&&this._fpDel()){e.preventDefault();e.stopPropagation();return;}
    if(!inField&&!this._layers.length&&e.key==='Enter'&&this._fpEnter()){e.preventDefault();e.stopPropagation();return;}
    if(!inField&&!this._layers.length&&(e.key==='Delete'||e.key==='Backspace')&&this.sel&&!e.ctrlKey&&!e.metaKey){e.preventDefault();e.stopPropagation();this.deleteSel();return;}
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
    const k=String(e.key||'').toLowerCase();
    if(k==='s'){e.preventDefault();e.stopPropagation();this.save();return;}
    if(inField||this._layers.length)return; // native undo / copy / paste inside fields
    if(k==='d'&&this.sel){e.preventDefault();e.stopPropagation();this.duplicateSel();return;}
    if(k==='a'){e.preventDefault();e.stopPropagation();this.selectAll();return;}
    if(k==='c'&&this.sel){e.preventDefault();e.stopPropagation();this.copySel();return;}
    if(k==='v'&&this._clipboard()){e.preventDefault();e.stopPropagation();this.paste();return;}
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
    const close=function(){
      const i=self._layers.indexOf(close);if(i>=0)self._layers.splice(i,1);layer.remove();
      // v6.47.0: the focus was on a button of the panel — keep it inside the studio (Esc, Ctrl+Z, Delete)
      try{if(!self._sr.activeElement){const h=self._sr.host;if(!h.hasAttribute('tabindex'))h.setAttribute('tabindex','-1');h.focus({preventScroll:true});}}catch(_){}
    };
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
    if(this._card){this._card._rocSink=null;this._card._rocRoomSink=null;this._card._rocSelSink=null;}
    this._card=null;this._ed=null;
  }
}
