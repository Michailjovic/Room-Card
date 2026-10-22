#!/usr/bin/env node
// Generated documentation (v7.0.0, V7_PLAN.md §9): every key the card understands, written from
// the config schema registry (src/schema/roc-schema.js), so the reference can never drift from
// what the card and the studio validate.
//
//   node tools/gen-docs.js           write docs/REFERENCE.md and the schema block of docs/AI_SPEC.md
//   node tools/gen-docs.js --check   fail when either is out of date (tests / CI)
//
// docs/REFERENCE.md is generated whole. docs/AI_SPEC.md is hand-written; only the part between
// <!-- BEGIN GENERATED: schema --> and <!-- END GENERATED: schema --> is replaced.
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const {ROC_SCHEMA:S}=require(path.join(ROOT,'src/schema/roc-schema.js'));
const CHECK=process.argv.includes('--check');

// ---- chapters: every schema type in reading order, with its title and the hand-written guide
const CFG='CONFIGURATION.md',OV='OVERVIEW.md',FP='FLOORPLAN.md',LAY='../LAYOUT.md';
const CHAPTERS=[
  ['Card and rooms',[
    ['card','The card (top level)',CFG+'#top-level'],
    ['room','A room (`rooms:` item)',CFG+'#multi-room-one-card--whole-home'],
    ['roomEntity','Presence entity per browser / user',CFG+'#multi-room-one-card--whole-home'],
    ['parallax','Parallax',CFG+'#top-level'],
  ]],
  ['Layout',[
    ['layout','`layout:`',LAY],
    ['orientation','`layout.orientation` (object form)',LAY],
    ['layoutProfile','A layout profile (`layout.portrait` / `layout.landscape`)',LAY],
    ['place','`place:` — where each region goes',LAY],
    ['region','A placed region',LAY],
  ]],
  ['Shared values',[
    ['cond','A condition',CFG+'#conditions'],
    ['condVal','A conditional value (`condition` + `value`)',CFG+'#conditions'],
    ['action','An action (`tap_action`, `hold_action`, `double_tap_action`)',CFG+'#action-types'],
    ['transform','`transform:` — an overlay that moves with its entity',CFG+'#moving-an-overlay--transform'],
    ['spin','`transform.spin`',CFG+'#moving-an-overlay--transform'],
    ['gradStop','A gradient stop (`color_gradient` item)',CFG+'#icons--labels'],
    ['baseImageCond','A background image condition (`base_image_conditions` item)',CFG+'#conditions'],
    ['filterCond','A filter condition (`filter_conditions` item)',CFG+'#css-filter-engine'],
    ['weather','`weather_overlay:` (object form)',CFG+'#camera-background--weather-effects'],
    ['brightnessModel','`brightness_model:`',CFG+'#brightness-model'],
    ['bmSource','`brightness_model.source` (object form)',CFG+'#brightness-model'],
    ['bmStop','A `brightness_model.filter_gradient` stop',CFG+'#brightness-model'],
    ['companion','A companion card (`cards_above` / `cards_below` / `nav.cards` item)',CFG+'#companion-cards-above--below-the-image'],
  ]],
  ['Elements on the image',[
    ['overlay','Overlay image (`overlays:` item)',CFG+'#overlays'],
    ['stateImage','`state_images` item',CFG+'#overlays'],
    ['overlayConds','`conditions:` of an overlay',CFG+'#overlays'],
    ['zone','Clickable zone (`zones:` item)',CFG+'#clickable-zones'],
    ['slider','`slider:` of a zone',CFG+'#slider-zones'],
    ['badge','Status badge (`badges:` item)',CFG+'#status-badges'],
    ['icon','Icon (`icons:` item)',CFG+'#icons--labels'],
    ['label','Label (`labels:` item)',CFG+'#icons--labels'],
    ['gauge','Gauge (`gauges:` item)',CFG+'#gauges'],
    ['blind','Blind (`blinds:` item)',CFG+'#blinds'],
    ['coverControl','`control:` of a blind (cover control)',CFG+'#cover-control-roleta'],
    ['coverPreset','A cover control preset',CFG+'#cover-control-roleta'],
    ['element','Embedded card (`elements:` item)',CFG+'#embedded-ha-cards'],
    ['glow','Light glow (`glows:` item)',CFG+'#light-glow-light-spill-on-the-photo'],
    ['group','Group (`groups:` item)',CFG+'#groups-pop-up-control-panels'],
    ['vacuumWidget','Vacuum status widget (`vacuum_widgets:` item)',CFG+'#vacuum-status-widget'],
    ['vacuumRef','A vacuum of the widget',CFG+'#vacuum-status-widget'],
    ['lightControls','`light_controls:`',CFG+'#light-controls-sliders-with-lux-ring'],
    ['lightEntity','A light control entity',CFG+'#light-controls-sliders-with-lux-ring'],
  ]],
  ['Navigation',[
    ['nav','`nav:` — the room strip',CFG+'#multi-room-one-card--whole-home'],
    ['navMini','`nav.mini`',CFG+'#thumbnail-rows-and-the-strip-cards-v6250'],
    ['navChip','A nav chip (`chips:` item)',CFG+'#multi-room-one-card--whole-home'],
  ]],
  ['Sections (cockpit tiles)',[
    ['section','A section (`sections:` item)',CFG+'#sections--panels-cockpit-tiles'],
    ['tile','A tile (`tiles:` item, or an element\'s `tile:`)',CFG+'#declared-tiles-tiles'],
    ['quick','A quick action of a tile',CFG+'#declared-tiles-tiles'],
    ['tileOverlay','An image tile overlay',CFG+'#image-tiles'],
  ]],
  ['Overview page',[
    ['overview','`overview:` of a room',OV],
    ['ovSignals','`overview.signals`',OV+'#cross-room-signals-v6480'],
    ['ovHeader','`overview.header`',OV],
    ['ovHeaderItem','A header item',OV],
    ['ovPill','A header pill',OV],
    ['ovSide','`overview.left` / `overview.right`',OV],
    ['ovSideCard','A side column card',OV],
    ['ovGrid','`overview.grid`',OV+'#room-tiles'],
    ['ovDock','`overview.dock`',OV],
    ['overviewTile','`overview_tile:` of a room',OV+'#room-tiles'],
    ['ovChip','An overview tile chip',OV+'#room-tiles'],
  ]],
  ['Floor plan page',[
    ['floorplan','`floorplan:` of a room',FP],
    ['fpRoom','A plan room (`floorplan.rooms` item)',FP],
    ['fpLight','A plan room light',FP],
    ['fpOpening','A door or window (`floorplan.openings` item)',FP],
    ['fpItem','A marker or label (`floorplan.items` item)',FP],
    ['fpVacuum','A vacuum (`floorplan.vacuums` item)',FP],
    ['fpTransform','`transform:` of a vacuum',FP],
    ['fpLayers','`floorplan.layers`',FP],
    ['fpEntity','A presence / media entity',FP],
    ['fpBackground','`floorplan.background` — the photo background',FP],
    ['fpThemeBy','`floorplan.theme_by`',FP],
    ['fpWall','`floorplan.wall`',FP],
    ['fpSource','`floorplan.source` — where the plan came from',FP],
    ['fpTrace','`floorplan.trace` — the image traced in the studio',FP],
  ]],
];
const SKIP=new Set(['fpPage']); // the studio's view of `floorplan`, not a config shape of its own
{ // every schema type is documented exactly once
  const listed=CHAPTERS.flatMap(c=>c[1].map(t=>t[0]));
  const missing=Object.keys(S).filter(t=>!SKIP.has(t)&&!listed.includes(t));
  const unknown=listed.filter(t=>!S[t]);
  const dup=listed.filter((t,i)=>listed.indexOf(t)!==i);
  if(missing.length||unknown.length||dup.length){
    console.error('gen-docs: chapter list out of sync with the schema —'+(missing.length?' not listed: '+missing.join(', '):'')+(unknown.length?' unknown: '+unknown.join(', '):'')+(dup.length?' twice: '+dup.join(', '):''));
    process.exit(1);
  }
}
const anchor=t=>'t-'+t.toLowerCase();

// ---- type notation → words (REFERENCE.md) and → a compact grammar (AI_SPEC.md)
const WORD={str:'string',num:'number',bool:'boolean',len:'length',url:'image URL',entity:'entity id',tmpl:'template',
  color:'colour',any:'any',card:'Lovelace card config',map:'object',action:'[action](#t-action)',cond:'[condition](#t-cond)'};
function splitAlts(t){const out=[];for(const p of t.split('|')){const prev=out.length?out[out.length-1]:'';
  if(prev.includes('enum:')&&!/^(enum|obj|list|prof):/.test(p))out[out.length-1]+='|'+p;else out.push(p);}return out;}
function words(t){
  if(t.startsWith('prof:'))return words(t.slice(5))+', or `{portrait, landscape}` of it';
  return splitAlts(t).map(a=>{
    if(a.startsWith('enum:'))return a.slice(5).split('|').map(v=>v===''?'`""`':'`'+v+'`').join(' · ');
    if(a.startsWith('obj:'))return '[`'+a.slice(4)+'`](#'+anchor(a.slice(4))+')';
    if(a.startsWith('list:')){const it=a.slice(5);return 'list of '+(S[it]?'[`'+it+'`](#'+anchor(it)+')':it==='any'?'values':WORD[it]||it);}
    return WORD[a]||a;
  }).join(' **or** ');
}
function gram(t){
  if(t.startsWith('prof:'))return 'prof<'+gram(t.slice(5))+'>';
  return splitAlts(t).map(a=>{
    if(a.startsWith('enum:'))return a.slice(5).split('|').map(v=>JSON.stringify(v)).join('|');
    if(a.startsWith('obj:'))return a.slice(4);
    if(a.startsWith('list:'))return gram(a.slice(5))+'[]';
    return a;
  }).join(' | ');
}
const isProfOvr=(k,d)=>d.t==='self';

// ---- REFERENCE.md
function reference(){
  const L=[];
  L.push('# Configuration reference (generated)','');
  L.push('[← Back to README](../README.md) · Guides: [Getting started](GETTING_STARTED.md) · [Configuration](CONFIGURATION.md) · [Studio](STUDIO.md) · [Overview](OVERVIEW.md) · [Floor plan](FLOORPLAN.md)','');
  L.push('> **Generated from the config schema** (`src/schema/roc-schema.js`) by `tools/gen-docs.js` — do not edit by hand.',
    '> It lists every key the card understands, its type, default and since which version. The',
    '> linked guides explain what the keys do, with examples. The studio\'s config check uses the same',
    '> schema: a key that is not here is reported as unknown.','');
  L.push('**Notation.** *length* = a number (px) or a CSS length (`12%`, `24px`, `2.5vw`, `calc(…)`);',
    '*template* = a string that may contain a Home Assistant (Jinja) template; *colour* = any CSS colour',
    'or `var(--…)`; *prof* = one value, or `{portrait: …, landscape: …}` with one per layout profile.',
    '**Room-scoped** keys can be set on a room or at the top level, where they are the default for',
    'every room. Every element type also accepts its own keys under `portrait:` / `landscape:`',
    '(per-profile overrides). Keys marked *v3* are migrated in memory when the card loads.','');
  L.push('## Contents','');
  for(const [ch,types] of CHAPTERS)L.push('- **'+ch+':** '+types.map(([t])=>'[`'+t+'`](#'+anchor(t)+')').join(' · '));
  L.push('');
  for(const [ch,types] of CHAPTERS){
    L.push('## '+ch,'');
    for(const [t,title,guide] of types){
      const T=S[t];
      L.push('<a id="'+anchor(t)+'"></a>','','### '+title+' — `'+t+'`','');
      const notes=[];
      if(T.scalar)notes.push('A bare `'+T.scalar+'` string is accepted as the short form (`- light.kitchen`).');
      if(T.open===true)notes.push('Open-ended: other keys are passed through unchecked.');
      else if(T.open==='type')notes.push('With `type:` it is a Lovelace card config (not checked).');
      else if(T.open)notes.push('With `action: '+T.open+'` the other keys are passed through unchecked.');
      if(t==='card')notes.push('Every **room-scoped** key of [`room`](#t-room) is also valid here, as the default for every room.');
      notes.push('Guide: ['+guide.replace(/^\.\.\//,'').replace(/#.*$/,'')+'](' + guide + ').');
      L.push(notes.join(' '),'');
      const rows=Object.entries(T.keys).filter(([k,d])=>!isProfOvr(k,d));
      const prof=Object.entries(T.keys).filter(([k,d])=>isProfOvr(k,d)).map(([k])=>k);
      L.push('| Key | Type | Default | Notes |','|---|---|---|---|');
      for(const [k,d] of rows){
        const n=[];
        if(d.req)n.push('required');
        if(d.room)n.push('room-scoped');
        if(d.legacy)n.push('v3 — migrated on load');
        if(d.since)n.push('since '+d.since);
        L.push('| `'+k+'` | '+words(d.t).replace(/\|/g,'\\|')+' | '+(d.d===undefined?'':'`'+JSON.stringify(d.d)+'`')+' | '+n.join(', ')+' |');
      }
      if(prof.length)L.push('','Per-profile overrides: '+prof.map(k=>'`'+k+'`').join(', ')+' (the legacy tiers are migrated on load).');
      L.push('');
    }
  }
  return L.join('\n').replace(/\n{3,}/g,'\n\n');
}

// ---- the compact grammar for AI_SPEC.md
function grammar(){
  const L=['```text','// Generated from src/schema/roc-schema.js by tools/gen-docs.js — do not edit by hand.',
    '// key!  = required · key = default · @x.y.z = since · room-scoped keys (R) also work at the top level',
    '// str num bool len(number or CSS length) url entity tmpl(may hold a Jinja template) color any',
    '// card(Lovelace card config) map(free object) prof<T>(T or {portrait: T, landscape: T}) T[] = list',
    '// Every element type also takes portrait: / landscape: with its own keys (per-profile overrides).',''];
  for(const [ch,types] of CHAPTERS){
    L.push('// ---- '+ch);
    for(const [t] of types){
      const T=S[t];
      const ks=Object.entries(T.keys).filter(([k,d])=>!isProfOvr(k,d)&&!d.legacy).map(([k,d])=>
        k+(d.req?'!':'')+': '+gram(d.t)+(d.d===undefined?'':' = '+JSON.stringify(d.d))+(d.room?' (R)':'')+(d.since?' @'+d.since:''));
      L.push(t+(T.scalar?' (or a bare '+T.scalar+' string)':'')+' {');
      for(const k of ks)L.push('  '+k+';');
      L.push('}');
    }
    L.push('');
  }
  L.push('```');
  return L.join('\n');
}

// ---- write / check
const out=[];
const refPath=path.join(ROOT,'docs/REFERENCE.md');
out.push([refPath,reference()+'\n']);
const aiPath=path.join(ROOT,'docs/AI_SPEC.md');
if(fs.existsSync(aiPath)){
  const ai=fs.readFileSync(aiPath,'utf8');
  const B='<!-- BEGIN GENERATED: schema -->',E='<!-- END GENERATED: schema -->';
  const i=ai.indexOf(B),j=ai.indexOf(E);
  if(i<0||j<i){console.error('gen-docs: docs/AI_SPEC.md has no generated block markers');process.exit(1);}
  out.push([aiPath,ai.slice(0,i+B.length)+'\n'+grammar()+'\n'+ai.slice(j)]);
}
let stale=0;
for(const [p,txt] of out){
  const cur=fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
  if(cur===txt){console.log('gen-docs: '+path.relative(ROOT,p)+' up to date');continue;}
  if(CHECK){console.error('gen-docs: '+path.relative(ROOT,p)+' is out of date — run node tools/gen-docs.js');stale++;continue;}
  fs.writeFileSync(p,txt);console.log('gen-docs: wrote '+path.relative(ROOT,p));
}
process.exit(stale?1:0);
