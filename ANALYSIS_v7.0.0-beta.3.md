# Room Overlay Card — celková analýza (7.0.0-beta.3)

Datum: 2026-11-03 · Rozsah: `src/` (card, core, editor, studio, floorplan, schema — 17,5 k řádků, 1,2 MB),
testy, CI, dokumentace a živý dev dashboard (`/living-room/test`, 7 instancí karty, 4 381 entit).

**Metoda:** ESLint (no-undef, unused, logické chyby) nad všemi třemi bundly · celá testovací sada
(`npm test` + Playwright e2e/studio/floorplan) · ruční review hot-path, akcí, lifecycle, ukládání ze
Studia, floor planu a overview · vlastní reprodukční probe `tests/probes/probe_v7_0_0b3.js`
(11 FAIL na beta.3) · fuzz floor planu v Chromiu (degenerované polygony, NaN, 300 místností) ·
měření v živém dashboardu.

**Celkově:** jádro je ve velmi dobrém stavu. ESLint `no-undef` = 0, všech 8 unit tierů zelených,
živá konzole čistá (jen známé varování „Roleta Bedroom“), vlastní práce karty na jeden `hass` push
**52 µs** (+138 µs pro 6 live mini), přepnutí místnosti ~20 ms JS (v6.15.9: 33–35 ms), fuzz floor
planu bez jediného `NaN` v SVG, žádné XSS cesty (stavy/atributy jdou všude přes `escA`/`textContent`).
Nálezy jsou hlavně na **hranách**: HA-kompatibilita akcí a podmínek, robustnost proti „špatnému tvaru“
YAML, bezpečnost výchozích tapů a jeden scénář ztráty dat ve Studiu.

---

## TL;DR — pořadí, ve kterém bych to řešil

| # | Co | Závažnost | Odhad |
|---|----|-----------|-------|
| 1 | Studio „Overwrite anyway“ může přepsat **jinou kartu** | P1 (ztráta dat, vzácné) | 30 min |
| 2 | Výchozí tap **toggluje sirénu / garážová vrata** (overview chipy, floor plan markery) | P2 (bezpečnost) | 15 min |
| 3 | Akce bez `entity` nedělají nic (i příklad v dokumentaci) | P2 | 30 min |
| 4 | HA-style `above:` / `below:` v podmínkách = vždy **true** | P2 | 20 min |
| 5 | Objekt místo seznamu (`brightness_model.source`, `gauges:`) shodí celou kartu | P2 | 1 h |
| 6 | Blind bez `attribute` se nikdy nevyplní + výchozí min/max proti konvenci HA | P2 | 30 min |
| 7 | Karta jen s floor planem / overview → `setConfig` vyhodí chybu | P2 | 20 min |
| 8 | Drobnosti P3 (stale hodnoty, kamera v pozadí, wrap-around, confirm…) | P3 | ½ dne |
| 9 | Optimalizace (HQ náhledy, rychlost testů, mrtvý kód, repo) | — | ½ dne |

---

## Část 1 — Chyby

### 1. Studio: „Overwrite anyway“ přepíše kartu podle **pozice**, ne podle identity — P1
`src/studio/30-targets.js:33–46` (`rsSaveDashboard`)

Kartu Studio najde při otevření identitou objektu a uloží si **cestu** (`views/2/sections/0/cards/3`).
Při uložení znovu načte dashboard a porovná, co na té cestě leží. Když se liší → dialog „The card
changed elsewhere“. Tlačítko **Overwrite anyway** pak zapíše config na **stejnou cestu** bez další
kontroly. Pokud mezitím někdo (jiný tab / tablet) přidal nebo smazal kartu nad ní, na cestě teď leží
**jiná karta** → ta je nenávratně nahrazena a room-card je v dashboardu dvakrát. Text dialogu
(„overwrite that change“) uživateli slibuje přepsání *té samé* karty.

**Oprava:** při `force` ověřit, že `cur.type==='custom:room-overlay-card'` a `cfgKey(cur)===cfgKey(orig)`;
jinak kartu v čerstvém configu dohledat (stejný `card_id` / shodný původní JSON) a když není
jednoznačná, nabídnout jen „Copy YAML“.

### 2. Výchozí tap toggluje sirénu a cover (garáž, brána) — P2 bezpečnost
`src/core/60-overview.js:60` · `src/floorplan/30-view.js:28`

- `ROC_OV_TOGGLE` obsahuje **`siren`** a `cover` → chip v overview s entitou sirény nebo garážových
  vrat se **jedním ťuknutím zapne/otevře**.
- `RFP_TOGGLE` (markery floor planu) obsahuje `cover`; komentář říká „never a lock, valve or siren by
  accident“, ale garážová vrata / brána jsou `cover`.
- Obě tabulky se navíc liší (floor plan sirénu vynechává, overview ne).

**Oprava:** jedna sdílená tabulka; `siren` pryč; `cover` togglovat jen pro `device_class`
blind/shade/curtain/shutter (jinak more-info).

### 3. Akce bez `entity` nedělají nic — P2 (HA kompatibilita + chyba v dokumentaci)
`src/card/room-overlay-card.js:4708` (`_exec`), volání z `_addZoneListeners` (ř. 2501–2554, 3151)

V HA `tap_action: {action: toggle}` / `{action: more-info}` použije entitu karty/prvku. Tady
`_exec` čte jen `a.entity` → ikona s `entity: light.a` a `tap_action: {action: toggle}` **nic
neudělá**, potichu. `docs/CONFIGURATION.md:1271–1272` přímo uvádí u tilu příklad
`{ action: more-info }` — ten nefunguje (probe #3).

**Oprava:** `_addZoneListeners(el,tap,hold,dbl,delay,defEntity)` a v `_exec` doplnit
`entity` z prvku pro `toggle` / `more-info` (stejně jako to dělá overview/floor plan).

### 4. HA-style podmínky `above:` / `below:` jsou vždy true — P2
`src/core/70-format.js:77` (`evalCond`)

Karta zná `state`, `state_not` a `operator`+`value`. Podmínka napsaná jako v HA
(`{entity: sensor.t, above: 25}`) neprojde žádnou větví → `r=true` → **overlay/viditelnost je
pořád zapnutá** bez jakékoli chyby (probe #4). Uživatelé z HA to napíšou přirozeně; AI_SPEC to sice
nepopisuje, ale cizí AI to vygeneruje.

**Oprava:** podporovat `above`/`below` (numeric_state sémantika) a neznámý test logovat jednou
přes `rocWarnOnce`.

### 5. Špatný tvar YAML shodí celou kartu — P2
`src/card/room-overlay-card.js:208` (`_extractAttrSources`) a obecně `for…of (c.x||[])`

- `brightness_model: {source: {entity: sensor.lux}}` (jeden zdroj jako objekt — častá chyba)
  → `TypeError` v `_render` → **prázdná karta**, chyba jen v konzoli. Pikantní: `bmFilter` sám
  objekt toleruje (vrátí null), padá až sběr atributů.
- Totéž `gauges:` / `labels:` … jako objekt místo seznamu.

Studio to díky schématu odchytí, ale YAML uživatelé ne. **Oprava:** (a) normalizace `source` na
pole (jako `rocAsList`), (b) `try/catch` kolem `_render()` v `set hass`/`setConfig` s malou
chybovou kartou ve stylu HA (`hui-error-card`-like) místo prázdna.

### 6. Blind bez `attribute` — nikdy se nevyplní; výchozí směr je proti HA — P2
`src/core/85-nav-live-blinds.js:125` · `docs/CONFIGURATION.md:417–442`

- Dokumentace: `attribute: current_position   # omit to use entity state (open/closed)`. Ve
  skutečnosti `parseFloat('closed')` = NaN → gauge se přeskočí → **fill zůstane 0 %** (probe #6).
- Na stejném blindu s `control: true` se ovladač neaktualizuje, když se mění jen
  `current_position` a stav zůstává `open` (řada Zigbee/Tuya rolet nehlásí `opening`/`closing`),
  protože `current_position` není mezi sledovanými atributy (probe #7, druhý případ). S explicitním
  `attribute: current_position` funguje.
- Výchozí `min: 0 = fully open, max: 100 = fully closed` je **opak konvence HA**
  (`current_position` 100 = otevřeno). Docs to popisují jako „inverted motor direction“, přitom je
  to standard — nový uživatel s běžnou roletou uvidí obráceně.

**Oprava:** pro `cover.*` bez `attribute` default `current_position`, fallback `open`→0/`closed`→100;
`current_position` přidat do attr sources u každého blindu s cover entitou. Default min/max
neměnit (zpětná kompatibilita), ale Studio/wizard ať je zapisuje explicitně podle HA konvence a
docs ať ji uvádějí jako normální případ.

### 7. Karta jen s floor planem (nebo jen overview) je odmítnuta — P2
`src/card/room-overlay-card.js:39`

`setConfig` vyžaduje aspoň jednu místnost s `base_image`/`base_camera`. Konfigurace
`rooms: [{id: plan, floorplan: {...}}]` → „base_image (or base_camera) is required“ (probe #8).
Přitom PRESETS „A floor plan for one purpose“ (úklidová obrazovka u dveří) přirozeně svádí k
samostatné kartě. **Oprava:** podmínku rozšířit o `r.floorplan || r.overview`.

### 8. Drobnosti — P3

| # | Nález | Kde |
|---|-------|-----|
| 8a | Label při zmizení/přejmenování entity **drží poslední hodnotu** (`if(!ent)continue`); gauge při `unavailable` taktéž (NaN → `continue`) — vypadá to jako živá data | `room-overlay-card.js:4522, 4545` |
| 8b | `base_camera` polluje i ve skrytém tabu (kontroluje `_visible`, ne `document.hidden`) a **každá live mini** s kamerou má vlastní timer; zpožděný `onload` může po přepnutí místnosti nastavit obrázek staré kamery | `:3475` |
| 8c | `next-room` z poslední na první (a naopak) dělá crossfade místo slidu (`Math.abs(idx-old)>1`) | `:3390` |
| 8d | `confirmation:` a tlačítko „Uklidit“ ve floor planu používají `window.confirm` — v kiosku/Companion WebView bývá blokované (akce se pak nikdy neprovede); HA má vlastní dialog | `:4718` |
| 8e | Legacy `test_mode` **Save** je druhá, starší implementace ukládání: hledá kartu přes `cfgKey` (bez `card_id` = první room `base_image`), bez konfliktní kontroly, zapisuje `this._config` (migrovaný, in-memory) | `:2655–2701` |
| 8f | `navigate` po `location-changed` posílá navíc umělý `popstate` → vlastní `_locHandler` karty běží 2× | `:4722` |
| 8g | Klávesnice: Enter/Space spustí jen `tap_action`; prvek jen s hold/double-tap je pro klávesnici mrtvý; floor plan nemá klávesnicové ovládání vůbec | `:281`, `30-view.js:1008` |
| 8h | `navigation_replace` (HA) se ignoruje; `perform-action` nechytá zamítnutý promise (HA ukáže toast, karta nic) | `:4722–4729` |

---

## Část 2 — Optimalizace

1. **HQ náhledy (`rocHqUrl`, `00-base.js:143`)**
   - Každý obrázek se stahuje a dekóduje **dvakrát** (poprvé jen kvůli rozměrům). Rozměry už zná
     `_preloadImages()` (`naturalWidth`) — stačí je předat.
   - Výstup je **PNG** blob — pro fotky 3–5× větší než `image/webp` (0.9); na tabletu je to RAM.
   - Blob URL se nikdy nerevokují a cache roste s každým 16px bucketem při změně velikosti okna.
     LRU na ~2 velikosti na URL + `URL.revokeObjectURL`.
2. **Rychlost testů:** `render.test.js` běží ~5 min, `studio.test.js` podobně (na tvém PC nedoběhly
   za 3 min). Profil: **74 % času je jsdom `querySelectorAll` v editorovém `_listen()`**
   (91× `querySelectorAll` přes celý editor DOM). V reálném Chromiu je to OK (5místnostní config,
   4 000 entit: `_render` 62 ms, `_collectConfig` 14 ms, změna pole 18 ms) — takže je to problém
   testů, ne uživatelů. Řešení: sdílet jednu instanci karty mezi skupinami asercí, nebo rozdělit
   `render.test.js` a pouštět paralelně (`node --test` / více jobů v CI).
3. **Flaky e2e:** v kontejneru selhaly 2 frame-timing testy overview (`zoom … 4x CPU throttle`
   max 166/83 ms vs limit 70; `room → overview animates` 4 vs >5 mezisnímků). Retry jeden z nich
   zachránil. Doporučuji tyto prahy brát jako „warn“, ne „fail“, nebo měřit medián.
4. **Mrtvý kód (ESLint):** `ROC_REGIONS` (`10-layout.js:7`), `stateStr` (`card/room-overlay-card.js:932`),
   `_yParseScalar` (`00-yaml-filters.js`), `RS_KINDS` (`40-studio.js:6`), nepoužité `self`/`I`.
5. **`set hass` vůči embedded kartám:** vlastní práce 52 µs, ale `alert-ticker-card` v `nav.cards`
   stojí **8,5 ms na každý push** (73 pushů/15 s). Víme, je to tvoje rozhodnutí — jen čísla pro
   pořádek, beze změny od minula.
6. **Repo / docs:** `ROADMAP.md` „Current release: v6.41.0“ (jsme na 7.0.0-beta.3); `Claude outputs/`
   (26 souborů, tvoje dashboard YAML a mockupy) je pořád verzovaný ve veřejném repu.

---

## Část 3 — Tvůj dashboard (ne chyby karty)

- `Roleta Bedroom` / `Roleta living room` — id s mezerou, pořád jediné varování v konzoli.
- `Kitchen-LG.png` 983 KB PNG — WebP by byl ~150 KB.

## Co jsem ověřil a je v pořádku

ESLint `no-undef` 0 · všech 8 unit tierů PASS · Playwright 69/71 (2 timing flaky) · lifecycle
(reconnect, IO revive, listenery v `_render`/`disconnectedCallback` párové) · žádné XSS sinky ·
vendorovaný js-yaml správně izolovaný (nic na `window`) · floor plan fuzz bez NaN/výjimek ·
dynamické importy Studia/floor planu mají `?v=` proti staré cache · release workflow ověřuje
přiložené assety · živá konzole čistá.

Pozn. k měření v živém dashboardu: Chrome okno bylo v pozadí (rAF throttling na 1 Hz), takže
časy „do vykreslení“ nejsou použitelné — JS časy a cena `hass` pushů ano.

## Reprodukce

`node tests/probes/probe_v7_0_0b3.js` — 12 kontrol, na beta.3 11× FAIL (jediný PASS je kontrolní
případ #7 s explicitním `attribute`). Po opravách by měl celý projít; pak přesunout do
`render.test.js`.
