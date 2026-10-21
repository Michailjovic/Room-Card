// HA-in-the-loop tier (V7_PLAN.md §10). Runs against a real Home Assistant started by run-ha.js.
// Guards the Home Assistant behaviour v7 builds on (Phase 0 spikes S1/S3/S4, V7_PLAN §13): the
// card renders inside HA's real Lit ha-card, the editor opens in HA's dialog, a card is found in
// the dashboard config by object identity, dashboard saves and conflict detection work, a
// non-admin cannot save, and a modal <dialog> on <body> stacks above HA's editor dialog.
const {test,expect}=require('@playwright/test');const fs=require('fs');
const B=process.env.ROC_HA_URL||'http://localhost:8123';
const TOK=JSON.parse(fs.readFileSync(process.env.ROC_HA_TOKENS||__dirname+'/tokens.json','utf8'));
async function login(page,tok){
  await page.addInitScript(([B,t])=>{localStorage.setItem('hassTokens',JSON.stringify({hassUrl:B,clientId:B+'/',access_token:t.access_token,refresh_token:t.refresh_token,expires_in:t.expires_in,expires:Date.now()+t.expires_in*1000,token_type:'Bearer'}));},[B,tok]);
}
const hass=page=>page.waitForFunction(()=>{const h=document.querySelector('home-assistant');return h&&h.hass&&h.hass.connected!==false&&h.hass.user;},null,{timeout:60000});
const ws=(page,msg)=>page.evaluate(m=>document.querySelector('home-assistant').hass.callWS(m),msg);
const CARD=(extra)=>Object.assign({type:'custom:room-overlay-card',card_id:'dup',base_image:'/local/none.png',aspect_ratio:'16/9'},extra||{});
const DASH={views:[
  {path:'m',title:'Masonry',cards:[CARD({aspect_ratio:'16/9'}),CARD({aspect_ratio:'4/3'})]},
  {path:'s',title:'Sections',type:'sections',sections:[{type:'grid',cards:[CARD({aspect_ratio:'21/9'})]}]},
  {path:'k',title:'Stack',cards:[{type:'vertical-stack',cards:[{type:'markdown',content:'x'},CARD({aspect_ratio:'1/1'})]}]},
  {path:'e',title:'Edit mode',cards:[CARD({aspect_ratio:'16/9'}),CARD({aspect_ratio:'4/3',test_mode:true})]},
]};
// Locate THIS card instance in the dashboard config by object identity (hui-card.config is the
// frozen object from lovelace.config) → returns a path like ['views',0,'cards',1].
const LOCATE=`(function(card){let n=card;while(n&&n.tagName!=='HUI-CARD'){n=n.parentNode&&n.parentNode.host?n.parentNode.host:(n.parentNode||n.host);}
 if(!n||!n.config)return null;function deep(r,s){const q=[r],o=[];while(q.length){const x=q.shift();if(!x)continue;if(x.matches&&x.matches(s))o.push(x);if(x.shadowRoot)q.push(x.shadowRoot);for(const c of x.children||[])q.push(c);}return o}
 const root=deep(document.body,'hui-root')[0];const lc=root.lovelace.config;let found=null;
 (function walk(o,p){if(found||!o||typeof o!=='object')return;if(o===n.config){found=p;return}for(const k in o)walk(o[k],p.concat(Array.isArray(o)?+k:k));})(lc,[]);
 return {path:found,urlPath:root.lovelace.urlPath};})`;
test.describe.configure({mode:'serial'});
test('setup: resource + dashboard',async({page})=>{
  await login(page,TOK);await page.goto(B+'/');await hass(page);
  const res=await ws(page,{type:'lovelace/resources'});
  if(!res.some(r=>r.url.includes('room-overlay-card')))await ws(page,{type:'lovelace/resources/create',res_type:'module',url:'/local/room-overlay-card.js'});
  const ds=await ws(page,{type:'lovelace/dashboards/list'});
  if(!ds.some(d=>d.url_path==='roc-test'))await ws(page,{type:'lovelace/dashboards/create',url_path:'roc-test',title:'ROC test',mode:'storage',require_admin:false,show_in_sidebar:true});
  await ws(page,{type:'lovelace/config/save',url_path:'roc-test',config:DASH});
});
test('the card renders with real geometry inside HA\'s Lit ha-card',async({page})=>{
  await login(page,TOK);await page.goto(B+'/roc-test/m');await hass(page);
  const r=await page.waitForFunction(()=>{function d(r,s){const q=[r],o=[];while(q.length){const x=q.shift();if(!x)continue;if(x.matches&&x.matches(s))o.push(x);if(x.shadowRoot)q.push(x.shadowRoot);for(const c of x.children||[])q.push(c);}return o}
    const c=d(document.body,'room-overlay-card')[0];if(!c||!c._rendered)return false;const w=c.shadowRoot.querySelector('.wrap');const b=w&&w.getBoundingClientRect();
    return b&&b.width>100&&b.height>50?{w:Math.round(b.width),h:Math.round(b.height),ver:c.constructor.name}:false;},null,{timeout:30000});
  const v=await r.jsonValue();console.log('render',JSON.stringify(v));
  expect(v.w).toBeGreaterThan(100);
});
for(const [view,label,expectPath] of [['m','masonry #1',['views',0,'cards',0]],['s','sections',['views',1,'sections',0,'cards',0]],['k','nested stack',['views',2,'cards',0,'cards',1]]]){
  test('card is found in the dashboard config by object identity: '+label,async({page})=>{
    await login(page,TOK);await page.goto(B+'/roc-test/'+view);await hass(page);
    await page.waitForFunction(()=>{function d(r,s){const q=[r],o=[];while(q.length){const x=q.shift();if(!x)continue;if(x.matches&&x.matches(s))o.push(x);if(x.shadowRoot)q.push(x.shadowRoot);for(const c of x.children||[])q.push(c);}return o}return d(document.body,'room-overlay-card').some(c=>c._rendered)},null,{timeout:30000});
    const r=await page.evaluate(L=>{function d(r,s){const q=[r],o=[];while(q.length){const x=q.shift();if(!x)continue;if(x.matches&&x.matches(s))o.push(x);if(x.shadowRoot)q.push(x.shadowRoot);for(const c of x.children||[])q.push(c);}return o}
      const cards=d(document.body,'room-overlay-card');return cards.map(c=>eval(L)(c));},LOCATE);
    console.log(label,JSON.stringify(r));
    expect(r[0].path).toEqual(expectPath);expect(r[0].urlPath).toBe('roc-test');
    if(view==='m')expect(r[1].path).toEqual(['views',0,'cards',1]);   // duplicate card_id, still unique
  });
}
test('dashboard save replaces exactly one of two duplicate cards; a concurrent edit is detected',async({page})=>{
  await login(page,TOK);await page.goto(B+'/roc-test/m');await hass(page);
  const out=await page.evaluate(async()=>{const h=document.querySelector('home-assistant').hass;
    const get=()=>h.callWS({type:'lovelace/config',url_path:'roc-test'});
    const at=(o,p)=>p.reduce((a,k)=>a[k],o);const path=['views',0,'cards',1];
    const orig=JSON.stringify(at(await get(),path));            // what the studio opened with
    // studio save: re-read, verify the card is unchanged, replace, save
    async function studioSave(newCard){const cur=await get();if(JSON.stringify(at(cur,path))!==orig)return 'CONFLICT';
      const c=JSON.parse(JSON.stringify(cur));const parent=at(c,path.slice(0,-1));parent[path[path.length-1]]=newCard;await h.callWS({type:'lovelace/config/save',url_path:'roc-test',config:c});return 'SAVED';}
    const r1=await studioSave(Object.assign(JSON.parse(orig),{aspect_ratio:'3/2'}));
    const after=await get();
    // other tab edits the same card → next studio save must detect it
    const c2=JSON.parse(JSON.stringify(after));c2.views[0].cards[1].aspect_ratio='5/4';await h.callWS({type:'lovelace/config/save',url_path:'roc-test',config:c2});
    const r2=await studioSave(Object.assign(JSON.parse(orig),{aspect_ratio:'9/9'}));
    const fin=await get();
    return {r1,firstCard:after.views[0].cards[0].aspect_ratio,secondCard:after.views[0].cards[1].aspect_ratio,r2,final:fin.views[0].cards[1].aspect_ratio};});
  console.log('save',JSON.stringify(out));
  expect(out).toEqual({r1:'SAVED',firstCard:'16/9',secondCard:'3/2',r2:'CONFLICT',final:'5/4'});
});
test('a non-admin user can read but not save the dashboard',async({page,request})=>{
  await login(page,TOK);await page.goto(B+'/');await hass(page);
  const u=await page.evaluate(async()=>{const h=document.querySelector('home-assistant').hass;
    const list=await h.callWS({type:'config/auth/list'});let user=list.find(x=>x.name==='Viewer');
    if(!user){user=(await h.callWS({type:'config/auth/create',name:'Viewer',group_ids:['system-users'],local_only:false})).user;
      await h.callWS({type:'config/auth_provider/homeassistant/create',user_id:user.id,username:'viewer',password:'viewer12345'});}
    return user.id;});
  // log in as the viewer through the normal login flow
  const cid=B+'/';
  let f=await (await request.post(B+'/auth/login_flow',{data:{client_id:cid,handler:['homeassistant',null],redirect_uri:cid}})).json();
  f=await (await request.post(B+'/auth/login_flow/'+f.flow_id,{data:{client_id:cid,username:'viewer',password:'viewer12345'}})).json();
  const t=await (await request.post(B+'/auth/token',{form:{grant_type:'authorization_code',code:f.result,client_id:cid}})).json();
  const p2=await page.context().browser().newPage();await login(p2,t);await p2.goto(B+'/roc-test/m');await hass(p2);
  const r=await p2.evaluate(async()=>{const h=document.querySelector('home-assistant').hass;
    const read=await h.callWS({type:'lovelace/config',url_path:'roc-test'}).then(()=> 'read ok',e=>'read '+e.code);
    const save=await h.callWS({type:'lovelace/config/save',url_path:'roc-test',config:{views:[]}}).then(()=>'save ok',e=>'save '+e.code);
    return {admin:h.user.is_admin,read,save};});
  console.log('viewer',JSON.stringify(r));
  expect(r.admin).toBe(false);expect(r.save).not.toBe('save ok');
});
test('editor opens in HA\'s dialog; a modal <dialog> on <body> stacks above it and hosts the card + editor',async({page})=>{
  await login(page,TOK);await page.goto(B+'/roc-test/m');await hass(page);
  await page.waitForTimeout(2000);
  const r=await page.evaluate(async()=>{function d(r,s){const q=[r],o=[];while(q.length){const x=q.shift();if(!x)continue;if(x.matches&&x.matches(s))o.push(x);if(x.shadowRoot)q.push(x.shadowRoot);for(const c of x.children||[])q.push(c);}return o}
    const root=d(document.body,'hui-root')[0];root.lovelace.setEditMode(true);await new Promise(r=>setTimeout(r,1500));
    const opt=d(document.body,'hui-card-options')[0];[...opt.shadowRoot.querySelectorAll('ha-button,mwc-button,button')].find(b=>/Edit/.test(b.textContent)).click();
    await new Promise(r=>setTimeout(r,3000));
    const haModal=d(document.body,'dialog').filter(x=>x.open&&x.matches(':modal')).length;
    const ed=d(document.body,'room-overlay-card-editor')[0];
    const s=document.createElement('dialog');s.style.cssText='width:100vw;height:100vh;max-width:none;max-height:none;margin:0;border:0;padding:0';document.body.appendChild(s);s.showModal();
    const host=document.createElement('room-overlay-card-editor');host.hass=document.querySelector('home-assistant').hass;host.setConfig(JSON.parse(JSON.stringify(ed._config)));s.appendChild(host);
    const card=document.createElement('room-overlay-card');card.setConfig(JSON.parse(JSON.stringify(ed._config)));card.hass=host.hass;s.appendChild(card);
    await new Promise(r=>setTimeout(r,1500));
    const cx=innerWidth/2,cy=innerHeight/2;let t=document.elementFromPoint(cx,cy);while(t&&t.shadowRoot){const n=t.shadowRoot.elementFromPoint(cx,cy);if(!n||n===t)break;t=n}
    let onTop=false;for(let n=t;n;n=n.parentNode||n.host)if(n===s){onTop=true;break}
    return {haModal,editorFound:!!ed,studioModal:s.matches(':modal'),onTop,cardRendered:card._rendered,hostedEditorInputs:host.querySelectorAll('input').length};});
  console.log('studio',JSON.stringify(r));
  expect(r).toMatchObject({haModal:1,editorFound:true,studioModal:true,onTop:true,cardRendered:true});
  expect(r.hostedEditorInputs).toBeGreaterThan(10);
});

const DEEP=`function d(r,s){const q=[r],o=[];while(q.length){const x=q.shift();if(!x)continue;if(x.matches&&x.matches(s))o.push(x);if(x.shadowRoot)q.push(x.shadowRoot);for(const c of x.children||[])q.push(c);}return o}`;
const STUDIO_UP=()=>{const C=customElements.get('room-overlay-card');const S=C&&C._rocStudio&&C._rocStudio.Studio.current;return !!(S&&S._card&&S._card._rendered&&S._ed);};
const shot=async(page,name)=>{if(process.env.ROC_HA_SHOTS)await page.screenshot({path:require('path').join(process.env.ROC_HA_SHOTS,name+'.png')});};
test('studio from HA\'s card editor: loads from the resource URL, sits above HA\'s dialog, Apply → HA\'s Save persists',async({page})=>{
  const reqs=[];page.on('request',r=>{if(/room-overlay-card-studio\.js/.test(r.url()))reqs.push(r.url());});
  await login(page,TOK);await page.goto(B+'/roc-test/m');await hass(page);
  await page.waitForTimeout(2000);
  expect(reqs.length).toBe(0);                                  // viewing never loads the studio
  await page.evaluate(async D=>{eval(D);const root=d(document.body,'hui-root')[0];root.lovelace.setEditMode(true);await new Promise(r=>setTimeout(r,1500));
    const opt=d(document.body,'hui-card-options')[0];[...opt.shadowRoot.querySelectorAll('ha-button,mwc-button,button')].find(b=>/Edit/.test(b.textContent)).click();
    await new Promise(r=>setTimeout(r,3000));
    d(document.body,'room-overlay-card-editor')[0].querySelector('#roc-studio').click();},DEEP);
  await page.waitForFunction(STUDIO_UP,null,{timeout:20000});
  expect(reqs[0]).toMatch(/\/local\/room-overlay-card-studio\.js\?v=\d+\.\d+\.\d+$/);
  await page.waitForTimeout(800);await shot(page,'studio-from-editor');
  const r=await page.evaluate(async D=>{eval(D);
    const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;
    const cx=innerWidth/2,cy=innerHeight/2;let t=document.elementFromPoint(cx,cy);while(t&&t.shadowRoot){const n=t.shadowRoot.elementFromPoint(cx,cy);if(!n||n===t)break;t=n}
    let onTop=false;for(let n=t;n;n=n.parentNode||n.host)if(n===S._dlg){onTop=true;break}
    const icon=S._sr.querySelector('.bar ha-icon');
    const wr=S._card.shadowRoot.querySelector('.wrap').getBoundingClientRect();
    const out={kind:S.target.kind,modal:S._dlg.matches(':modal'),onTop,haDialogOpen:d(document.body,'dialog').filter(x=>x!==S._dlg&&x.open).length,
      iconRendered:!!(icon&&icon.shadowRoot&&icon.shadowRoot.innerHTML.length),canvasW:Math.round(wr.width)};
    S._ed._fire(Object.assign({},S._ed._config,{aspect_ratio:'2/1'}));   // an edit in the hosted editor
    const before=d(document.body,'hui-dialog-edit-card')[0]._cardConfig;
    out.haUntouched=before&&before.aspect_ratio==='16/9';
    await S.save();                                                       // Apply & close
    await new Promise(r=>setTimeout(r,800));
    const dlg=d(document.body,'hui-dialog-edit-card')[0];
    out.closed=!document.querySelector('dialog.roc-studio');
    out.haGot=dlg._cardConfig&&dlg._cardConfig.aspect_ratio;
    const save=d(dlg.shadowRoot,'ha-button,mwc-button,button').find(b=>/^\s*Save\s*$/.test(b.textContent));
    save.click();await new Promise(r=>setTimeout(r,2500));
    const lc=await document.querySelector('home-assistant').hass.callWS({type:'lovelace/config',url_path:'roc-test'});
    out.saved=lc.views[0].cards[0].aspect_ratio;out.other=lc.views[0].cards[1].aspect_ratio; // cards[1] = 5/4 from the save test above
    return out;},DEEP);
  console.log('studio/editor',JSON.stringify(r));
  expect(r).toMatchObject({kind:'editor',modal:true,onTop:true,haDialogOpen:1,iconRendered:true,haUntouched:true,closed:true,haGot:'2/1',saved:'2/1',other:'5/4'});
  expect(r.canvasW).toBeGreaterThan(300);
});
test('studio from an Edit-mode card on the dashboard: saves exactly that card, the dashboard updates, a concurrent edit is refused',async({page})=>{
  await login(page,TOK);await page.goto(B+'/roc-test/e');await hass(page);
  await page.waitForFunction(D=>{eval(D);const c=d(document.body,'room-overlay-card');return c.length===2&&c.every(x=>x._rendered);},DEEP,{timeout:30000});
  await page.evaluate(D=>{eval(D);d(document.body,'room-overlay-card')[1].shadowRoot.querySelector('.tm-studio').click();},DEEP);
  await page.waitForFunction(STUDIO_UP,null,{timeout:20000});
  await page.waitForTimeout(800);await shot(page,'studio-from-dashboard');
  const r=await page.evaluate(async D=>{eval(D);
    const h=document.querySelector('home-assistant').hass;const get=()=>h.callWS({type:'lovelace/config',url_path:'roc-test'});
    const S=customElements.get('room-overlay-card')._rocStudio.Studio.current;
    const out={kind:S.target.kind,path:S.target.path};
    S._commit(Object.assign(JSON.parse(JSON.stringify(S.work)),{aspect_ratio:'3/2'}),'test');
    out.ok1=await S.save();
    await new Promise(r=>setTimeout(r,1500));
    let lc=await get();out.c0=lc.views[3].cards[0].aspect_ratio;out.c1=lc.views[3].cards[1].aspect_ratio;out.tm=lc.views[3].cards[1].test_mode;
    out.live=d(document.body,'room-overlay-card').filter(c=>!S._dlg.contains(c)&&!(S._sr&&S._sr.contains(c))).map(c=>c._config&&c._config.aspect_ratio);
    const c2=JSON.parse(JSON.stringify(lc));c2.views[3].cards[1].aspect_ratio='5/4';await h.callWS({type:'lovelace/config/save',url_path:'roc-test',config:c2});
    S._commit(Object.assign(JSON.parse(JSON.stringify(S.work)),{aspect_ratio:'9/9'}),'test');
    out.ok2=await S.save();out.conflictShown=!!S._sr.querySelector('.layer [data-act="overwrite"]');
    lc=await get();out.final=lc.views[3].cards[1].aspect_ratio;
    S.close();return out;},DEEP);
  console.log('studio/dashboard',JSON.stringify(r));
  expect(r).toMatchObject({kind:'dashboard',path:['views',3,'cards',1],ok1:true,c0:'16/9',c1:'3/2',tm:true,ok2:false,conflictShown:true,final:'5/4'});
  expect(r.live).toContain('3/2');
});
