# Room Overlay Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/Michailjovic/Room-Card.svg)](https://github.com/Michailjovic/Room-Card/releases)

Lovelace karta pro vizualizaci místností — základní obrázek s obrazkovými vrstvami, podmíněnými CSS přechody, klikatelnými zónami, plovoucími status chipy a embedded HA kartami. Plný GUI editor.

![Room Overlay Card preview](https://raw.githubusercontent.com/Michailjovic/Room-Card/main/preview.png)

---

## Funkce

- **Základní obrázek** — libovolný poměr stran, border-radius
- **CSS filter engine** — brightness, saturate, sepia, … řízené stavem entit s plynulou animací
- **Overlay vrstvy** — průhledné PNG vrstvy s podmíněnou `opacity` a `filter`; dynamický výběr obrázku dle stavu entity
- **Klikatelné zóny** — neviditelné oblasti nad obrázkem; navigate / more-info / call-service / toggle / browser-mod-popup
- **Status chipy (badges)** — plovoucí čipy v rozích s MDI ikonou, podmíněnou barvou ikony a podmíněným textem
- **Embedded HA karty** — libovolná HA karta umístěná na souřadnicích (tile, gauge, custom:mini-graph-card, …)
- **Test mód** — červené ohraničení zón + modré ohraničení elementů pro ladění pozic
- **GUI editor** — kompletní nastavení bez YAML

---

## Instalace

### Přes HACS (doporučeno)

1. Otevři HACS → Frontend → ⋮ → **Custom repositories**
2. Přidej `https://github.com/Michailjovic/Room-Card` jako **Lovelace**
3. Vyhledej **Room Overlay Card** a nainstaluj
4. Obnov prohlížeč (Ctrl+F5)

### Manuální instalace

1. Stáhni `room-overlay-card.js` z [nejnovějšího release](https://github.com/Michailjovic/Room-Card/releases/latest)
2. Ulož do `/config/www/room-overlay-card.js`
3. V HA: Nastavení → Dashboardy → ⋮ → **Spravovat prostředky** → přidej `/local/room-overlay-card.js` (typ: JavaScript modul)
4. Obnov prohlížeč

---

## Základní konfigurace

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: "16/9"
border_radius: 12px
```

---

## Kompletní konfigurace

### Hlavní parametry

| Klíč | Typ | Výchozí | Popis |
|------|-----|---------|-------|
| `base_image` | `string` | **povinný** | Cesta k základnímu obrázku |
| `aspect_ratio` | `string` | `16/9` | Poměr stran (`šířka/výška`) |
| `border_radius` | `string` | `12px` | Zaoblení rohů karty |
| `filter_transition` | `string` | `2s ease` | CSS transition pro filter základního obrázku |
| `filter_conditions` | `list` | `[]` | CSS filtry řízené stavem entit |
| `overlays` | `list` | `[]` | Overlay vrstvy |
| `zones` | `list` | `[]` | Klikatelné zóny |
| `badges` | `list` | `[]` | Status chipy |
| `elements` | `list` | `[]` | Embedded HA karty |
| `test_mode` | `bool` | `false` | Zobrazí ohraničení zón a elementů |
| `tap_action` | `action` | — | Akce při kliknutí na kartu |

---

### Podmínky (`StateCondition`)

Podmínky se používají v mnoha místech konfigurace.

```yaml
# Přesná shoda stavu
entity: binary_sensor.window
state: "on"

# Stav nesmí být roven
entity: light.bedroom
state_not: "unavailable"

# Numerické porovnání
entity: sensor.temperature
operator: ">"
value: 25

# Zřetězení AND / OR
entity: sensor.temperature
operator: ">"
value: 22
and:
  entity: binary_sensor.night_mode
  state: "off"
```

Podporované operátory: `<` `>` `<=` `>=` `==` `!=`

---

### CSS filtry základního obrázku

```yaml
filter_conditions:
  - condition:
      entity: binary_sensor.night_mode
      state: "on"
    filter: brightness(0.3) saturate(0.2)
  - filter: brightness(1.0)   # výchozí (bez condition)
```

---

### Overlay vrstvy

```yaml
overlays:
  - id: lights_on
    image: /local/images/bedroom_lights.png
    transition: "1.5s ease"
    conditions:
      opacity:
        - condition:
            entity: light.bedroom
            state: "on"
          value: 1
        - value: 0   # výchozí
  
  - id: fan_state
    state_images:
      - entity: fan.bedroom
        state: "on"
        image: /local/images/fan_on.png
      - image: /local/images/fan_off.png   # výchozí
    conditions:
      opacity:
        - value: 1
```

---

### Klikatelné zóny

```yaml
zones:
  - id: light_switch
    top: "60%"
    left: "10%"
    width: "20%"
    height: "15%"
    tap_action:
      action: toggle
      entity: light.bedroom

  - id: tv_zone
    top: "20%"
    left: "50%"
    width: "35%"
    height: "40%"
    tap_action:
      action: more-info
      entity: media_player.tv

  # Podmíněná akce
  - id: smart_switch
    top: "70%"
    left: "5%"
    width: "15%"
    height: "10%"
    tap_action:
      condition:
        entity: input_boolean.guest_mode
        state: "on"
      then:
        action: navigate
        path: /lovelace/guest
      else:
        action: toggle
        entity: light.bedroom_main
```

#### Typy akcí

| Akce | Parametry | Popis |
|------|-----------|-------|
| `navigate` | `path` | Přejde na danou cestu |
| `more-info` | `entity` | Otevře dialog entity |
| `call-service` | `service`, `service_data` | Zavolá HA službu |
| `toggle` | `entity` | Přepne entitu |
| `browser-mod-popup` | `title`, `size`, `content` | Browser-mod popup |
| `none` | — | Nic neudělá |

---

### Status chipy (badges)

```yaml
badges:
  - id: temp_chip
    position: bottom-right    # bottom-left / bottom-right / top-left / top-right
    icon: mdi:thermometer
    icon_color:
      - condition:
          entity: sensor.temperature
          operator: ">"
          value: 26
        value: "orange"
      - value: "white"
    label:
      - value_template: "{{ states('sensor.temperature') }}°C"  # přímo hodnota
      - condition:
          entity: sensor.temperature
          operator: ">"
          value: 26
        value: "Horko!"
      - value: "OK"
    visible:
      entity: binary_sensor.someone_home
      state: "on"
    tap_action:
      action: more-info
      entity: sensor.temperature
```

---

### Embedded HA karty (elements)

```yaml
elements:
  - id: mini_graph
    top: "5%"
    left: "65%"
    width: "30%"
    height: "25%"
    z_index: 4
    border_radius: "8px"
    overflow: hidden
    visible:
      entity: binary_sensor.show_graph
      state: "on"
    card:
      type: custom:mini-graph-card
      entities:
        - sensor.temperature
      hours_to_show: 6
      line_width: 2
      show:
        labels: false
        icon: false

  - id: weather_tile
    top: "75%"
    left: "70%"
    width: "28%"
    height: "20%"
    card:
      type: tile
      entity: weather.home
      show_entity_picture: true
```

---

## Kompletní příklad

```yaml
type: custom:room-overlay-card
base_image: /local/images/bedroom.webp
aspect_ratio: "16/9"
border_radius: "12px"
filter_transition: "2s ease"
test_mode: false

filter_conditions:
  - condition:
      entity: binary_sensor.night_mode
      state: "on"
    filter: brightness(0.25) saturate(0.1)
  - filter: brightness(1.0)

overlays:
  - id: ceiling_light
    image: /local/images/bedroom_ceiling_on.png
    transition: "1.5s ease"
    conditions:
      opacity:
        - condition:
            entity: light.bedroom_ceiling
            state: "on"
          value: 1
        - value: 0

zones:
  - id: ceiling_switch
    top: "55%"
    left: "8%"
    width: "18%"
    height: "20%"
    tap_action:
      action: toggle
      entity: light.bedroom_ceiling

badges:
  - id: humidity
    position: bottom-left
    icon: mdi:water-percent
    label:
      - value: "Vlhkost"
    visible:
      entity: sensor.bedroom_humidity
      state_not: "unavailable"

elements:
  - id: climate
    top: "3%"
    left: "3%"
    width: "35%"
    height: "18%"
    border_radius: "10px"
    card:
      type: tile
      entity: climate.bedroom
```

---

## Vývoj

```bash
# Instalace závislostí
npm install

# Dev build se source mapou
npm run build

# Produkční build (minifikovaný)
npm run build:prod

# Watch mód
npm run watch
```

Zdrojový kód v `src/room-overlay-card.ts` (TypeScript + LitElement).  
Distribuovaný soubor `room-overlay-card.js` je vanilla JS bez externích závislostí.

---

## Licence

MIT © 2024 Michailjovic
