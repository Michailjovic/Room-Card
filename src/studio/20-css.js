// ---- Styles (inside the studio's own shadow root; HA's theme variables inherit from <html>) ---
const ROC_STUDIO_CSS=`
:host{all:initial;display:block;position:fixed;inset:0;font-family:var(--paper-font-body1_-_font-family,Roboto,system-ui,sans-serif);font-size:14px;color:var(--primary-text-color,#e8eaed);
  --rs-bg:var(--primary-background-color,#111418);--rs-panel:var(--card-background-color,#1c1f24);--rs-sub:var(--secondary-background-color,#24282e);
  --rs-line:var(--divider-color,rgba(255,255,255,.12));--rs-acc:var(--primary-color,#03a9f4);--rs-txt2:var(--secondary-text-color,#9aa3ad);
  --rs-err:var(--error-color,#db4437);--rs-warn:var(--warning-color,#ffa600);--rs-ok:var(--success-color,#43a047);}
*{box-sizing:border-box;}
button{font:inherit;color:inherit;}
ha-icon{--mdc-icon-size:18px;display:inline-flex;}
.app{position:absolute;inset:0;display:grid;background:var(--rs-bg);
  grid-template-columns:230px minmax(0,1fr) minmax(380px,34%);grid-template-rows:auto minmax(0,1fr) auto;
  grid-template-areas:"bar bar bar" "outline canvas insp" "status status status";}
.bar{grid-area:bar;display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--rs-panel);border-bottom:1px solid var(--rs-line);flex-wrap:wrap;min-width:0;}
.brand{font-weight:600;white-space:nowrap;display:flex;align-items:baseline;gap:6px;margin-right:6px;}
.brand small{font-weight:400;font-size:11px;color:var(--rs-txt2);}
.sp{flex:1;}
.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--rs-line);background:none;cursor:pointer;white-space:nowrap;}
.btn:hover:not([disabled]){background:var(--rs-sub);}
.btn[disabled]{opacity:.38;cursor:default;}
.btn.icon{padding:0 7px;}
.btn.primary{background:var(--rs-acc);border-color:var(--rs-acc);color:#fff;font-weight:600;}
.btn.primary:hover:not([disabled]){filter:brightness(1.1);background:var(--rs-acc);}
.btn.danger{border-color:var(--rs-err);color:var(--rs-err);}
.btn:focus-visible,.seg button:focus-visible,select:focus-visible,.ol-item:focus-visible{outline:2px solid var(--rs-acc);outline-offset:1px;}
select.room{height:32px;border-radius:8px;border:1px solid var(--rs-line);background:var(--rs-panel);color:inherit;padding:0 8px;max-width:220px;}
.seg{display:inline-flex;border:1px solid var(--rs-line);border-radius:8px;overflow:hidden;}
.seg button{border:none;background:none;height:30px;padding:0 10px;cursor:pointer;white-space:nowrap;color:var(--rs-txt2);}
.seg button+button{border-left:1px solid var(--rs-line);}
.seg button[aria-pressed="true"]{background:var(--rs-sub);color:var(--rs-acc);font-weight:600;}
.narrow-only{display:none;}
.outline{grid-area:outline;overflow:auto;border-right:1px solid var(--rs-line);background:var(--rs-panel);padding:10px 8px;}
.ol-h{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--rs-txt2);margin:10px 6px 6px;}
.ol-h:first-child{margin-top:2px;}
.ol-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer;color:inherit;}
.ol-item:hover{background:var(--rs-sub);}
.ol-item[aria-current="true"]{background:var(--rs-sub);color:var(--rs-acc);font-weight:600;}
.ol-item .n{margin-left:auto;font-size:12px;color:var(--rs-txt2);font-variant-numeric:tabular-nums;}
.ol-item .tag{font-size:10px;color:var(--rs-txt2);border:1px solid var(--rs-line);border-radius:4px;padding:0 4px;}
.ol-item.empty{opacity:.45;}
.ol-search{width:100%;height:30px;margin:0 0 6px;padding:0 8px;border-radius:6px;border:1px solid var(--rs-line);background:var(--rs-bg);color:inherit;font:inherit;font-size:13px;}
.ol-kind{font-weight:600;margin-top:4px;}
.ol-el{padding:4px 8px 4px 34px;font-size:13px;gap:6px;}
.ol-el .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ol-el .sub{margin-left:auto;font-size:11px;color:var(--rs-txt2);max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ol-empty{font-size:12px;color:var(--rs-txt2);padding:6px 8px;}
.ol-row{display:flex;align-items:center;gap:2px;}
.ol-row>.ol-item{flex:1;min-width:0;}
.ol-act{flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;border-radius:6px;cursor:pointer;color:var(--rs-txt2);}
.ol-act:hover{background:var(--rs-sub);color:var(--primary-text-color,#e8eaed);}
.ol-act.on{color:var(--rs-acc);}
.ol-act.danger:hover{color:var(--rs-err);}
.ol-act ha-icon{--mdc-icon-size:17px;}
.ol-kindrow.hid .ol-kind,.ol-el.hid{opacity:.45;}
.ol-paste{color:var(--rs-acc);}
.selbar .aligns button{height:26px;padding:0 6px;}
.selbar .aligns ha-icon{--mdc-icon-size:17px;}
.selbar .hint.warn{color:var(--rs-warn);font-weight:400;}
.cv-bar{min-height:36px;}
.selbar{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.selbar .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;background:var(--rs-sub);color:var(--primary-text-color,#e8eaed);}
.selbar .hint{color:var(--rs-acc);font-weight:600;}
.btn.sm{height:26px;padding:0 8px;font-size:12px;gap:4px;}
.btn.sm ha-icon{--mdc-icon-size:16px;}
.place{position:absolute;inset:0;z-index:30;cursor:crosshair;touch-action:none;}
.place-box{position:absolute;display:none;border:2px dashed var(--rs-acc);background:rgba(3,169,244,.12);pointer-events:none;}
.addgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-top:10px;}
.addbtn{height:40px;justify-content:flex-start;}
.canvas{grid-area:canvas;position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;}
.cv-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:12px;color:var(--rs-txt2);border-bottom:1px solid var(--rs-line);flex-wrap:wrap;}
.stage{position:relative;flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:16px;
  background:repeating-conic-gradient(rgba(127,127,127,.06) 0 25%,transparent 0 50%) 0 0/24px 24px;}
.fbox{position:relative;flex:none;}
.frame{position:absolute;left:0;top:0;transform-origin:0 0;overflow:auto;background:var(--rs-bg);box-shadow:0 0 0 1px var(--rs-line),0 10px 40px rgba(0,0,0,.45);border-radius:6px;}
.frame>room-overlay-card{display:block;height:100%;}
.cv-err{position:absolute;inset:16px;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--rs-txt2);}
.insp{grid-area:insp;display:flex;flex-direction:column;overflow:hidden;border-left:1px solid var(--rs-line);background:var(--rs-panel);min-width:0;}
.itabs{flex:none;display:flex;border-bottom:1px solid var(--rs-line);padding:0 8px;}
.itabs button{border:none;background:none;padding:10px 12px;cursor:pointer;color:var(--rs-txt2);border-bottom:2px solid transparent;margin-bottom:-1px;}
.itabs button[aria-selected="true"]{color:var(--rs-acc);border-bottom-color:var(--rs-acc);font-weight:600;}
.itabs button:focus-visible{outline:2px solid var(--rs-acc);outline-offset:-2px;}
.ipane{flex:1;min-height:0;overflow:auto;}
.ipane[hidden]{display:none;}
.props{padding:10px 12px 28px;display:flex;flex-direction:column;gap:8px;}
.pf-head{display:flex;align-items:center;gap:8px;padding:2px;min-width:0;}
.pf-head>ha-icon{--mdc-icon-size:22px;color:var(--rs-acc);flex:none;}
.pf-title{font-weight:600;font-size:15px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pf-type{color:var(--rs-txt2);font-size:12px;white-space:nowrap;}
.pf-head .tag{font-size:10px;color:var(--rs-txt2);border:1px solid var(--rs-line);border-radius:4px;padding:0 4px;}
.pf-head .pf-open{margin-left:auto;flex:none;}
.pf-note{font-size:12px;color:var(--rs-txt2);line-height:1.45;padding:2px 4px;}
.pf-sec{border:1px solid var(--rs-line);border-radius:10px;background:var(--rs-bg);}
.pf-sec>summary{cursor:pointer;padding:9px 12px;font-weight:600;display:flex;align-items:center;gap:8px;list-style:none;user-select:none;}
.pf-sec>summary::-webkit-details-marker{display:none;}
.pf-sec>summary::before{content:'';width:0;height:0;border:4px solid transparent;border-left:6px solid var(--rs-txt2);margin-right:-2px;transition:transform .15s;}
.pf-sec[open]>summary::before{transform:rotate(90deg) translateX(2px);}
.pf-sec>summary .n{margin-left:auto;font-size:11px;font-weight:400;color:var(--rs-txt2);}
.pf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;padding:4px 12px 12px;}
.pf-idrow{padding:0;}
.pf-field{display:flex;flex-direction:column;gap:4px;min-width:0;}
.pf-field.wide{grid-column:1/-1;}
.pf-l{font-size:12px;color:var(--rs-txt2);}
.pf-in{width:100%;height:32px;padding:0 8px;border-radius:6px;border:1px solid var(--rs-line);background:var(--rs-panel);color:inherit;font:inherit;font-size:13px;min-width:0;}
select.pf-in{padding:0 4px;}
textarea.pf-in{height:auto;padding:6px 8px;resize:vertical;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;}
.pf-in:focus{outline:2px solid var(--rs-acc);outline-offset:-1px;}
.pf-field.has-error>.pf-in,.pf-field.has-error .pf-ent .pf-in,.pf-field.has-error .pf-yaml .pf-in{border-color:var(--rs-err);}
.pf-cb{width:18px;height:18px;margin:6px 0;accent-color:var(--rs-acc);}
.pf-sub{font-size:11px;color:var(--rs-txt2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.pf-sub:empty{display:none;}
.pf-sub.warn{color:var(--rs-warn);}
.pf-ent{display:flex;flex-direction:column;gap:3px;}
.pf-msg{font-size:11px;line-height:1.35;}
.pf-msg:empty{display:none;}
.pf-msg.error{color:var(--rs-err);}
.pf-msg.warn{color:var(--rs-warn);}
.pf-color,.pf-icon,.pf-url,.pf-prof{display:flex;gap:6px;align-items:center;}
.pf-color input[type=color]{width:36px;height:32px;padding:0 2px;border:1px solid var(--rs-line);border-radius:6px;background:none;flex:none;cursor:pointer;}
.pf-color input[type=color].unset{opacity:.3;}
.pf-icon .rs-pick,.pf-url .pf-in,.pf-prof>.pf-in,.pf-prof>.rs-pick,.pf-prof>.pf-ent{flex:1;}
.pf-icprev{--mdc-icon-size:22px;width:32px;height:32px;align-items:center;justify-content:center;border:1px solid var(--rs-line);border-radius:6px;flex:none;}
.pf-thumb{width:48px;height:32px;flex:none;border-radius:6px;border:1px solid var(--rs-line);background:center/cover no-repeat var(--rs-sub);}
.pf-tag{font-size:11px;color:var(--rs-txt2);width:64px;flex:none;}
.pf-links{display:flex;gap:12px;flex-wrap:wrap;}
.pf-link{border:none;background:none;padding:0;color:var(--rs-acc);cursor:pointer;font-size:11px;text-align:left;}
.pf-link:hover{text-decoration:underline;}
.pf-act,.pf-yaml{display:flex;flex-direction:column;gap:6px;}
.pf-actbody{display:flex;flex-direction:column;gap:6px;padding-left:10px;border-left:2px solid var(--rs-line);}
.pf-actbody:empty{display:none;}
.pf-sub2{display:flex;flex-direction:column;gap:3px;}
.rs-pick{position:relative;width:100%;min-width:0;}
.rs-list{display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);z-index:20;max-height:260px;overflow:auto;background:var(--rs-panel);border:1px solid var(--rs-line);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.45);}
.rs-pick.open .rs-list{display:block;}
.rs-opt{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:0 8px;padding:6px 10px;cursor:pointer;font-size:13px;}
.rs-opt.ic{display:flex;align-items:center;gap:8px;}
.rs-opt:hover,.rs-opt.act{background:var(--rs-sub);}
.rs-opt .o-main,.rs-opt .o-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rs-opt .o-sub{grid-column:1;font-size:11px;color:var(--rs-txt2);}
.rs-opt .o-st{grid-column:2;grid-row:1/span 2;align-self:center;font-size:11px;color:var(--rs-txt2);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.rs-opt.none{color:var(--rs-txt2);cursor:default;}
.ol-item .vd{width:7px;height:7px;border-radius:50%;flex:none;margin-left:4px;}
.ol-el .vd{order:3;}
.vd.error{background:var(--rs-err);} .vd.warn{background:var(--rs-warn);}
.status{grid-area:status;display:flex;align-items:center;gap:14px;padding:6px 12px;font-size:12px;color:var(--rs-txt2);background:var(--rs-panel);border-top:1px solid var(--rs-line);flex-wrap:wrap;}
.status .vbtn{display:inline-flex;align-items:center;gap:6px;border:none;background:none;cursor:pointer;color:inherit;padding:2px 4px;border-radius:4px;}
.status .vbtn:hover{background:var(--rs-sub);}
.status .ok{color:var(--rs-ok);} .status .err{color:var(--rs-err);} .status .warn{color:var(--rs-warn);}
.status .dirty{color:var(--rs-warn);font-weight:600;}
.status .tgt{margin-left:auto;}
.layer{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);padding:16px;}
.panel{background:var(--rs-panel);border:1px solid var(--rs-line);border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.5);width:min(560px,100%);max-height:min(80vh,100%);display:flex;flex-direction:column;}
.panel h2{font-size:17px;margin:0;padding:16px 18px 6px;}
.panel .pb{padding:4px 18px 12px;overflow:auto;line-height:1.5;color:var(--rs-txt2);}
.panel .pf{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px 16px;flex-wrap:wrap;}
.panel textarea{width:100%;min-height:42vh;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;background:var(--rs-bg);color:var(--primary-text-color,#e8eaed);border:1px solid var(--rs-line);border-radius:8px;padding:10px;resize:vertical;}
.vl{list-style:none;margin:0;padding:0;display:grid;gap:6px;}
.vl li{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;padding:6px 8px;border-radius:6px;background:var(--rs-sub);}
.vl code{color:var(--primary-text-color,#e8eaed);word-break:break-all;}
.vl .lv{font-size:11px;font-weight:700;text-transform:uppercase;}
.vl .lv.error{color:var(--rs-err);} .vl .lv.warn{color:var(--rs-warn);}
.vl .m{grid-column:2;}
.hl{list-style:none;margin:0;padding:0;display:grid;gap:6px;}
.hl li{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;background:var(--rs-sub);}
.hl li span{flex:1;}
@media (max-width:1100px){
  .app{grid-template-columns:minmax(0,1fr) minmax(340px,44%);grid-template-areas:"bar bar" "canvas insp" "status status";}
  .outline{display:none;position:absolute;z-index:40;left:0;top:0;bottom:0;width:min(280px,80%);box-shadow:8px 0 30px rgba(0,0,0,.4);}
  .app.show-outline .outline{display:block;}
  .narrow-only.ol-t{display:inline-flex;}
}
@media (max-width:700px){
  .app{grid-template-columns:minmax(0,1fr);grid-template-areas:"bar" "canvas" "status";}
  .insp{position:absolute;z-index:40;left:0;right:0;bottom:0;height:72%;border-left:none;border-top:1px solid var(--rs-line);border-radius:14px 14px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.45);transform:translateY(105%);transition:transform .22s ease;}
  .app.show-insp .insp{transform:none;}
  .narrow-only.in-t{display:inline-flex;}
  .bar{gap:6px;padding:6px 8px;}
  .bar>*{flex:none;}
  .bar .lbl,.brand,.seg.frames{display:none;}   /* on a phone the real screen IS the frame */
  select.room{max-width:150px;}
}
@media (prefers-reduced-motion:reduce){.insp{transition:none;}}
`;
