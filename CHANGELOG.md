# Changelog

## [0.4.0] – 2026-05-26

### Added
- **`animation` pro `overlays[]`, `badges[]`, `labels[]`** – dvě CSS animace:
  - `pulse` – plynulé blikání opacity (1 → 0.25 → 1, 2 s, ease-in-out)
  - `blink` – tvrdé on/off (1 s, step-end)
- **`animation_color`** – pro `badges[]` a `labels[]` přidá barevnou záři
  (`filter: drop-shadow`) při animaci `pulse`; vytvoří efekt "glowing badge/label".
  ```yaml
  overlays:
    - id: alarm_overlay
      color: "rgba(255,0,0,0.35)"
      animation: pulse          # fade in/out

  badges:
    - id: alarm_badge
      icon: mdi:alarm-light
      animation: pulse
      animation_color: "#ff2222"   # červená záře

  labels:
    - id: temp_label
      animation: blink             # tvrdé blikání (pozor: agresivní)
  ```
- **GUI editor pro animace** – dropdown `none / pulse / blink` u `overlays[]`,
  `badges[]` a `labels[]`; color picker pro záři u `badges[]` a `labels[]`.

---

## [0.4.x] – plánováno

- **`visible_conditions`** pro `labels[]` a `gauges[]` – show/hide podle stavu entity
- **`orientation: horizontal`** pro `gauges[]` – vodorovný gauge
- **`brightness_model`** – lux senzor nebo atribut světla → CSS `filter: brightness()`,
  lineární interpolace (podobně jako `color_gradient`)

---

## [0.3.19] – 2026-05-25

### Added
- **`background`, `padding`, `border_radius`, `text_shadow` pro `labels[]`** – label lze nyní
  stylovat jako badge/chip s tmavým pozadím, bez nutnosti externích karet.

---

## [0.3.18] – 2026-05-25

### Fixed
- GUI editor pro `color_gradient` byl omylem aplikován pouze na mrtvou kopii `_gaugeItem`
  (třída `RoomOverlayCard`), ne na skutečný editor (`RoomOverlayCardEditor`). V GUI proto
  sekce *Color Gradient Stops* u gauges nebyla viditelná. Opraveno — obě kopie `_gaugeItem`
  i `_lblItem` jsou nyní identické a obsahují správný gradient editor.

---

## [0.3.17] – 2026-05-25

### Added
- **`color_gradient` pro `gauges[]` a `labels[]`** – plynulá interpolace barvy podle hodnoty entity.
  Místo diskrétních podmínek (`color: [{operator: '>', value: 60, result: 'red'}]`) lze nyní definovat
  lineární přechod mezi libovolným počtem barevných zastávek:
  ```yaml
  gauges:
    - id: temp_gauge
      entity: water_heater.bojler
      attribute: current_temperature
      min: 30
      max: 80
      color_gradient:
        - value: 30
          color: "#2196f3"   # modrá (studená)
        - value: 55
          color: "#4caf50"   # zelená (optimální)
        - value: 70
          color: "#ff9800"   # oranžová (teplá)
        - value: 80
          color: "#f44336"   # červená (horká)
  ```
- **GUI editor pro `color_gradient`** – jak `gauges[]`, tak `labels[]` mají v editoru sekci
  *Color Gradient Stops* s řadami (hodnota + color picker `<input type="color">` + tlačítko
  pro odebrání) a tlačítkem **+ Stop** pro přidání nové zastávky.

### Changed
- Interní pomocné funkce `parseCssColor()` a `lerpColorGradient()` přidány na úrovni modulu
  (dostupné pro gauges i labels).

### Fixed
- Odstraněna duplicitní deklarace `const self` uvnitř `_collectConfig()`, která způsobovala
  `SyntaxError` při načítání karty.

---

## [0.3.16] – 2026-05-24

### Added
- **`attribute` podpora v `evalCond`** – podmínky v `filter_conditions`, `overlays`, `zones`,
  `badges`, `labels` a `gauges` nyní mohou porovnávat atributy entity místo jejího stavu:
  ```yaml
  conditions:
    - entity: water_heater.bojler
      attribute: current_temperature
      operator: ">"
      value: 60
      result: "orange"
  ```
- **Nativní `labels[]`** – textové popisky umístěné přes obrázek, podpora `entity`, `attribute`,
  `template`, `prefix`, `suffix`, `color`, `color_gradient`, `font_size`, `font_weight`,
  `position` (top/left/transform v %).
- **Nativní `gauges[]`** – svislé ukazatele hodnoty bez závislosti na `custom:button-card`
  (řeší nefunkční výšku přes shadow DOM), podpora `entity`, `attribute`, `min`, `max`,
  `width`, `height`, `position`, `color`, `color_gradient`, `background`.

---

## [0.3.15] – 2026-05-23

### Added
- Sekce `labels[]` a `gauges[]` (základní implementace bez `color_gradient`).

### Fixed
- Embedded `custom:button-card` v `elements[]` nefungoval jako gauge kvůli přerušení CSS
  výškového řetězce přes shadow DOM. Nativní `gauges[]` tento problém obchází.

---

## [0.3.14] – 2026-05-22

### Added
- **FLIP tlačítko v test módu** – přepíná všechny overlay do opačného stavu a aplikuje
  alternativní base image filter; stav přetrvává při změnách konfigurace v GUI editoru.

### Fixed
- Stav FLIP se neresetoval při editaci konfigurace (záměrné – viz 0.3.13 fix).

---

## [0.3.13] – 2026-05-22

### Fixed
- Syntaktická chyba (přebytečný znak `i` na konci souboru) způsobující
  *"Custom element doesn't exist: room-overlay-card"* po instalaci z HACS.

---

## [0.3.12] – 2026-05-21

### Added
- Rozšířený test mód s tlačítkem **⇄ FLIP** – zobrazí všechny overlay a base image filter
  v opačném stavu než aktuálním, pro rychlé vizuální testování bez nutnosti měnit stavy entit.
