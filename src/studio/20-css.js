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
.canvas{grid-area:canvas;position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;}
.cv-bar{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:12px;color:var(--rs-txt2);border-bottom:1px solid var(--rs-line);flex-wrap:wrap;}
.stage{position:relative;flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:16px;
  background:repeating-conic-gradient(rgba(127,127,127,.06) 0 25%,transparent 0 50%) 0 0/24px 24px;}
.fbox{position:relative;flex:none;}
.frame{position:absolute;left:0;top:0;transform-origin:0 0;overflow:auto;background:var(--rs-bg);box-shadow:0 0 0 1px var(--rs-line),0 10px 40px rgba(0,0,0,.45);border-radius:6px;}
.frame>room-overlay-card{display:block;height:100%;}
.cv-err{position:absolute;inset:16px;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:var(--rs-txt2);}
.insp{grid-area:insp;overflow:auto;border-left:1px solid var(--rs-line);background:var(--rs-panel);min-width:0;}
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
