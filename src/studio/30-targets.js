// ---- Save targets (V7_PLAN §5.4, D3; spike S3) ---------------------------------------------
// editor    — opened from HA's card editor: the result goes back through that editor's own
//             config-changed (official API, no admin rights or internals needed); HA saves.
// dashboard — opened from the card on the dashboard: saved with lovelace/config/save. The card
//             is located BY OBJECT IDENTITY (hui-card.config is the very object inside
//             lovelace.config), never by card_id, which is not unique in practice. Conflict check:
//             re-read the dashboard and refuse when that path no longer holds what was opened.
// yaml      — anything that cannot be saved (non-admin, YAML-mode or generated dashboard, card
//             not found): read-only, the YAML can be copied.
function rsResolveDashboard(card,hass){
  const raw=card&&card._rocRaw||null;
  const huiCard=card?rsFindUp(card,function(n){return n.tagName==='HUI-CARD'&&n.config&&typeof n.config==='object';}):null;
  const needle=(huiCard&&huiCard.config)||raw;
  let host=card?rsFindUp(card,function(n){return n!==card&&n.lovelace&&n.lovelace.config;}):null;
  if(!host)host=rsDeepFind(document.body,function(n){return n.tagName==='HUI-ROOT'&&n.lovelace&&n.lovelace.config;});
  const ll=host&&host.lovelace;
  if(!ll)return{kind:'yaml',reason:'r_notfound'};
  if(!hass||typeof hass.callWS!=='function')return{kind:'yaml',reason:'r_nows'};
  if(ll.mode==='yaml')return{kind:'yaml',reason:'r_yaml'};
  if((ll.rawConfig||ll.config).strategy)return{kind:'yaml',reason:'r_strategy'};
  let path=needle?rsPathOf(ll.config,needle):null;
  if(!path&&raw&&raw!==needle)path=rsPathOf(ll.config,raw);
  if(!path)return{kind:'yaml',reason:'r_notfound'};
  if(!(hass.user&&hass.user.is_admin))return{kind:'yaml',reason:'r_admin'};
  const v=path[0]==='views'?ll.config.views[path[1]]:null;
  return{
    kind:'dashboard',lovelace:ll,urlPath:ll.urlPath==null?null:ll.urlPath,path:path,
    orig:rsJ(rsAt(ll.config,path)),
    dashName:ll.config.title||ll.urlPath||'Overview',
    where:(v?('view “'+(v.title||v.path||('#'+path[1]))+'”'):'')+' · '+path.join('/'),
  };
}
async function rsSaveDashboard(tgt,hass,cfg,force){
  const fresh=await hass.callWS({type:'lovelace/config',url_path:tgt.urlPath});
  const cur=rsAt(fresh,tgt.path);
  if(!force&&rsJ(cur)!==tgt.orig){const e=new Error('conflict');e.conflict=true;throw e;}
  const nc=JSON.parse(rsJ(fresh));
  const parent=rsAt(nc,tgt.path.slice(0,-1));
  if(!parent||typeof parent!=='object')throw new Error('card position '+tgt.path.join('/')+' no longer exists');
  parent[tgt.path[tgt.path.length-1]]=cfg;
  const ll=tgt.lovelace;
  // lovelace.saveConfig updates the open dashboard immediately (and rolls back on failure);
  // the plain WS call is the fallback when HA's frontend object is not available.
  if(ll&&typeof ll.saveConfig==='function')await ll.saveConfig(nc);
  else await hass.callWS({type:'lovelace/config/save',url_path:tgt.urlPath,config:nc});
  tgt.orig=rsJ(cfg);
}

// "Restore previous version" (§5.4): the last 10 configs saved or applied from the studio, in
// this browser's localStorage — a convenience, not a backup.
function rsHistLoad(k){try{const v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[];}catch(_){return[];}}
function rsHistPush(k,cfg){
  try{
    const a=rsHistLoad(k);const j=rsJ(cfg);
    if(a.length&&a[0].cfg===j)return;
    a.unshift({t:Date.now(),cfg:j});
    localStorage.setItem(k,JSON.stringify(a.slice(0,10)));
  }catch(_){}
}
