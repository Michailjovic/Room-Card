// Config schema registry (v6.40.0, V7_PLAN.md §5.2) — keeps src/schema/roc-schema.js honest.
//
//  1. The validator itself (types, enums, unknown keys, legacy keys, short forms).
//  2. Every reference config in the repo validates with no errors and no unknown keys.
//  3. Every key used in a documented YAML example (CONFIGURATION, PRESETS, LAYOUT, README,
//     EDITOR) is known to the schema.
//  4. The card's own key lists (ROOM_KEYS, EL_DEDICATED_KEYS, TILE_DEDICATED_KEYS,
//     ROC_ELEMENT_KEYS, action types) are all in the schema, in the right object.
//  5. Every snake_case property the card code reads is a schema key or a known Home Assistant
//     name — a new config key cannot ship without a schema entry.
//
// Usage: node tests/schema.test.js [path/to/room-overlay-card.js]
'use strict';
const fs=require('fs');
const path=require('path');
let JSDOM;
try{({JSDOM}=require('jsdom'));}
catch(_){console.error('jsdom is not installed — run: npm i -D jsdom');process.exit(1);}
const ROOT=path.join(__dirname,'..');
const cardFile=process.argv[2]||path.join(ROOT,'room-overlay-card.js');
const {ROC_SCHEMA,rocValidate,rocSchemaKeys}=require(path.join(ROOT,'src','schema','roc-schema.js'));

let fails=0;
function check(name,ok,extra){console.log((ok?'PASS ':'FAIL ')+name+(ok||!extra?'':'\n     '+extra));if(!ok)fails++;}

// the card's own vendored js-yaml and constant lists, read from the assembled card
const dom=new JSDOM('<html><body></body></html>',{pretendToBeVisual:true,runScripts:'outside-only'});
const w=dom.window;w.requestIdleCallback=f=>setTimeout(f,0);
// top-level consts of an eval'd script are local to that eval — export what the test reads
w.eval(fs.readFileSync(cardFile,'utf8')+'\n;window.__rocT={rocJsYaml,ROOM_KEYS,ROC_ELEMENT_KEYS,EL_DEDICATED_KEYS,TILE_DEDICATED_KEYS,ROC_ACT_TYPES};');
const yamlLoad=t=>w.__rocT.rocJsYaml.load(t);
const G=n=>w.__rocT[n];

// ---- 1. validator --------------------------------------------------------------
const L=(cfg,level)=>rocValidate(cfg).filter(x=>!level||x.level===level);
check('valid minimal config → no findings',L({type:'custom:room-overlay-card',base_image:'/local/a.webp'}).length===0);
check('unknown top-level key → warn',L({type:'x',fooo:1},'warn').some(x=>x.path==='fooo'));
check('room keys are valid at the top level (shared defaults)',L({type:'x',overlays:[{id:'o',image:'/x.png'}]}).length===0);
check('room-only key at the top level → warn',L({type:'x',area_match:['Kitchen']},'warn').length===1);
check('nested unknown key → warn with full path',L({type:'x',rooms:[{id:'a',blinds:[{id:'b',entity:'cover.x',invert:true}]}]},'warn').some(x=>x.path==='rooms[0].blinds[0].invert'));
check('wrong type → error',L({type:'x',zones:[{id:'z',top:'nope'}]},'error').some(x=>x.path==='zones[0].top'));
check('enum outside the list → error',L({type:'x',image_fit:'stretch'},'error').length===1);
check('per-profile value accepted',L({type:'x',image_fit:{portrait:'contain',landscape:'cover'}}).length===0);
check('per-profile enum checked per profile',L({type:'x',image_fit:{portrait:'stretch'}},'error').length===1);
check('element profile override validated as the same element',L({type:'x',labels:[{id:'l',entity:'sensor.t',portrait:{top:'10%',font_size:'12px'}}]}).length===0
  &&L({type:'x',labels:[{id:'l',portrait:{bogus:1}}]},'warn').some(x=>x.path==='labels[0].portrait.bogus'));
check('legacy v3 tier override → info, not warn',L({type:'x',icons:[{id:'i',mobile:{top:'5%'}}]},'info').length===1&&L({type:'x',icons:[{id:'i',mobile:{top:'5%'}}]},'warn').length===0);
check('short forms (entity strings) accepted',L({type:'x',light_controls:{entities:['light.a',{entity:'light.b',name:'B'}]},nav:{chips:['sensor.t']}}).length===0);
check('conditions recurse (and/or)',L({type:'x',filter_conditions:[{condition:{entity:'a.b',state:'on',or:{entity:'c.d',oprator:'<'}},filter:'none'}]},'warn').some(x=>/or\.oprator$/.test(x.path)));
check('actions: conditional then/else validated',L({type:'x',tap_action:{condition:{entity:'a.b',state:'on'},then:{action:'navigate',navigation_path:'/x'},else:{action:'teleport'}}},'error').some(x=>x.path==='tap_action.else.action'));
check('fire-dom-event actions are open-ended',L({type:'x',tap_action:{action:'fire-dom-event',browser_mod:{service:'x'}}}).length===0);
check('embedded cards are not validated',L({type:'x',elements:[{id:'e',card:{type:'tile',whatever:{deep:1}}}]}).length===0);
check('missing required id → warn',L({type:'x',zones:[{top:'1%'}]},'warn').some(x=>x.path==='zones[0].id'));

// ---- 2. reference configs ------------------------------------------------------
const refFiles=['example-bedroom.yaml','flat-multiroom.yaml','flat-multiroom-v4.yaml']
  .concat(fs.existsSync(path.join(ROOT,'Claude outputs'))?fs.readdirSync(path.join(ROOT,'Claude outputs')).filter(f=>/^room-card-.*\.yaml$/.test(f)).map(f=>'Claude outputs/'+f):[]);
let refCards=0;
for(const f of refFiles){
  const p=path.join(ROOT,f);if(!fs.existsSync(p))continue;
  let doc;try{doc=yamlLoad(fs.readFileSync(p,'utf8'));}catch(e){check('parses: '+f,false,e.message.split('\n')[0]);continue;}
  const cards=[];JSON.stringify(doc,(k,v)=>{if(v&&typeof v==='object'&&String(v.type||'').includes('room-overlay-card'))cards.push(v);return v;});
  cards.forEach((c,i)=>{refCards++;
    const bad=rocValidate(c).filter(x=>x.level!=='info');
    check('reference config validates clean: '+f+(cards.length>1?' #'+i:''),bad.length===0,bad.slice(0,6).map(x=>x.level+' '+x.path+' — '+x.msg).join('\n     '));
  });
}
check('at least 4 reference configs found',refCards>=4,'found '+refCards);

// ---- 3. documented YAML examples ------------------------------------------------
const known=new Set(Object.values(rocSchemaKeys()).flat());
const enumVals=new Set();
(function collect(t){for(const T of Object.values(ROC_SCHEMA))for(const d of Object.values(T.keys))for(const m of String(d.t).matchAll(/enum:([^|]+(?:\|[^|:]+)*)/g))m[1].split('|').forEach(v=>enumVals.add(v));})();
// keys that only ever appear inside an embedded card, an action's data, a transform map or a
// per-browser map — not card keys
const NOT_CARD_CONTEXT=new Set(['card','cards','content','map','from','to','data','service_data','target','by_browser','by_user','style','card_mod']);
const docMiss=[];
for(const f of ['docs/CONFIGURATION.md','PRESETS.md','LAYOUT.md','README.md','docs/EDITOR.md']){
  const p=path.join(ROOT,f);if(!fs.existsSync(p))continue;
  const txt=fs.readFileSync(p,'utf8');
  for(const m of txt.matchAll(/```yaml\n([\s\S]*?)```/g)){
    let d;try{d=yamlLoad(m[1].replace(/…/g,''));}catch(_){continue;} // illustrative fragments with "…" placeholders
    (function walk(o,foreign){
      if(Array.isArray(o)){o.forEach(x=>walk(x,foreign));return;}
      if(!o||typeof o!=='object')return;
      const isForeign=foreign||(typeof o.type==='string'&&!o.type.includes('room-overlay'));
      for(const k in o){
        if(!isForeign&&!known.has(k)&&!/^[a-z_]+\.[a-z0-9_]+$/.test(k))docMiss.push(f+': '+k);
        walk(o[k],isForeign||NOT_CARD_CONTEXT.has(k));
      }
    })(d,false);
  }
  for(const m of txt.matchAll(/^\| *`([a-z_][a-z0-9_]*)`/gm))if(!known.has(m[1])&&!enumVals.has(m[1])&&!/^(unavailable|unknown)$/.test(m[1]))docMiss.push(f+' (table): '+m[1]);
}
check('every key in the documented examples is in the schema',docMiss.length===0,[...new Set(docMiss)].slice(0,15).join('\n     '));

// ---- 4. the card's own key lists -------------------------------------------------
const K=t=>new Set(Object.keys(ROC_SCHEMA[t].keys));
const roomK=K('room');
const roomScoped=new Set(Object.entries(ROC_SCHEMA.room.keys).filter(([,d])=>d.room).map(([k])=>k));
check('ROOM_KEYS ⊆ schema room keys marked room-scoped',G('ROOM_KEYS').every(k=>roomScoped.has(k)),G('ROOM_KEYS').filter(k=>!roomScoped.has(k)).join(', '));
check('every room-scoped schema key is in ROOM_KEYS',[...roomScoped].every(k=>G('ROOM_KEYS').includes(k)),[...roomScoped].filter(k=>!G('ROOM_KEYS').includes(k)).join(', '));
check('ROC_ELEMENT_KEYS ⊆ room keys',G('ROC_ELEMENT_KEYS').every(k=>roomK.has(k)));
check('EL_DEDICATED_KEYS ⊆ element keys',G('EL_DEDICATED_KEYS').every(k=>K('element').has(k)),G('EL_DEDICATED_KEYS').filter(k=>!K('element').has(k)).join(', '));
check('TILE_DEDICATED_KEYS ⊆ tile keys',G('TILE_DEDICATED_KEYS').every(k=>K('tile').has(k)),G('TILE_DEDICATED_KEYS').filter(k=>!K('tile').has(k)).join(', '));
const actEnum=ROC_SCHEMA.action.keys.action.t.slice(5).split('|');
const builderActs=G('ROC_ACT_TYPES').map(a=>a[0]).filter(v=>v&&v!=='custom');
check('every action-builder type is in the schema action enum',builderActs.every(a=>actEnum.includes(a)),builderActs.filter(a=>!actEnum.includes(a)).join(', '));
const src=fs.readFileSync(cardFile,'utf8');
const execActs=[...src.matchAll(/case'([a-z-]+)'/g)].map(m=>m[1]).filter(a=>/^(navigate|url|more-info|toggle|call-service|perform-action|browser-mod-popup|toggle-group|show-group|hide-group|switch-room|next-room|prev-room|follow-room|open-section|close-section|fire-dom-event|none)$/.test(a));
check('the card executes no action type missing from the schema',execActs.every(a=>actEnum.includes(a)));

// ---- 5. code → schema coverage -------------------------------------------------------
// Home Assistant / browser names the card reads off hass objects, not config keys.
const HA_NAMES=new Set(['browser_id','browser_mod','color_temp','color_temp_kelvin','current_position','entity_picture','friendly_name','max_temp','min_temp','number_format','rgb_color','set_cover_position','supported_color_modes','turn_off','turn_on','unit_of_measurement','current_temperature','hvac_action','media_title','app_name','battery_level','is_admin',
  // AnyVac's map sensor attributes (the integration's contract, V7_PLAN §7a)
  'home_frame','home_room_id','in_cleaning','schema_version','vacuum_room_name','view_layers','base_points','path_points','progress_pct','last_dry','last_wet','frame_id','home_anchors']);
const cardCode=src.slice(0,src.indexOf('class RoomOverlayCardEditor'));
const props=new Set([...cardCode.matchAll(/\.([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\b/g)].map(m=>m[1]));
const unknownProps=[...props].filter(p=>!known.has(p)&&!HA_NAMES.has(p)).sort();
check('every snake_case key the card reads is in the schema (or a Home Assistant name)',unknownProps.length===0,unknownProps.join(', '));

console.log(fails?('\n'+fails+' SCHEMA TEST(S) FAILED'):'\nALL SCHEMA TESTS PASSED');
process.exit(fails?1:0);
