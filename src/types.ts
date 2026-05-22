// ─── Podmínky ──────────────────────────────────────────────────────────────────

/**
 * Podmínka vyhodnocená proti stavu entity.
 * Podporuje: state, state_not, numerické operátory, AND/OR zřetězení.
 */
export interface StateCondition {
  entity: string;
  /** Přesná shoda stavu */
  state?: string;
  /** Stav nesmí být roven (string nebo pole stringů) */
  state_not?: string | string[];
  /** Numerický operátor — porovnává parseFloat(state) */
  operator?: '<' | '>' | '<=' | '>=' | '==' | '!=';
  /** Hodnota pro numerické porovnání */
  value?: number | string;
  /** Obě podmínky musí platit */
  and?: StateCondition;
  /** Alespoň jedna podmínka musí platit */
  or?: StateCondition;
}

/**
 * Hodnota T podmíněná stavem entity.
 * Položka bez `condition` slouží jako výchozí (default).
 */
export interface ConditionalValue<T> {
  condition?: StateCondition;
  value: T;
}

/**
 * CSS filter string podmíněný stavem entity.
 * Položka bez `condition` slouží jako výchozí.
 */
export interface FilterCondition {
  condition?: StateCondition;
  filter: string;
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

/** Mapování stavu entity na konkrétní obrázek */
export interface StateImageMapping {
  entity: string;
  state: string;
  image: string;
}

/** Výchozí obrázek (bez entity/state podmínky) */
export interface DefaultImageMapping {
  image: string;
}

export type ImageMapping = StateImageMapping | DefaultImageMapping;

/** Podmínky pro opacity a filter na overlay vrstvě */
export interface OverlayConditions {
  opacity?: ConditionalValue<number>[];
  filter?: ConditionalValue<string>[];
}

/** Konfigurace jedné overlay vrstvy */
export interface OverlayConfig {
  /** Unikátní identifikátor (pro orientaci uživatele) */
  id: string;
  /** Statický obrázek — použij buď `image` nebo `state_images`, ne obojí */
  image?: string;
  /** Dynamický výběr obrázku dle stavu entity */
  state_images?: ImageMapping[];
  /** CSS transition pro tuto vrstvu (výchozí: '2.0s ease') */
  transition?: string;
  /** Podmíněné opacity a filter */
  conditions?: OverlayConditions;
  /** Pořadí vrstvy (výchozí: index v poli + 1) */
  z_index?: number;
}

// ─── Akce ─────────────────────────────────────────────────────────────────────

export type ActionType =
  | 'navigate'
  | 'more-info'
  | 'call-service'
  | 'browser-mod-popup'
  | 'toggle'
  | 'none';

/** Jednoduchá akce (bez podmínky) */
export interface ZoneAction {
  action: ActionType;
  /** Pro navigate: cílová cesta */
  path?: string;
  /** Pro more-info, toggle: ID entity */
  entity?: string;
  /** Pro call-service: 'domain.service' */
  service?: string;
  /** Data pro call-service */
  service_data?: Record<string, unknown>;
  /** Pro browser-mod-popup: titulek dialogu */
  title?: string;
  /** Pro browser-mod-popup: velikost ('normal' | 'large' | 'wide' | 'fullscreen') */
  size?: string;
  /** Pro browser-mod-popup: konfigurace karty uvnitř dialogu */
  content?: unknown;
}

/** Akce závislá na stavu entity */
export interface ConditionalAction {
  condition: StateCondition;
  then: ZoneAction;
  else?: ZoneAction;
}

export type TapAction = ZoneAction | ConditionalAction;

// ─── Zóny ─────────────────────────────────────────────────────────────────────

export interface ZoneConfig {
  /** Unikátní identifikátor */
  id: string;
  /** Vzdálenost od vrcholu karty v % */
  top: string;
  /** Vzdálenost od levého okraje karty v % */
  left: string;
  /** Šířka zóny v % */
  width: string;
  /** Výška zóny v % */
  height: string;
  /** Zóna je skrytá, pokud podmínka není splněna */
  visible?: StateCondition;
  /** Akce při kliknutí (nebo podmíněná akce) */
  tap_action?: TapAction;
  /** Popis zóny (zobrazen v test módu) */
  label?: string;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

export type BadgePosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export interface BadgeConfig {
  /** Unikátní identifikátor */
  id: string;
  /** Pozice v rohu karty */
  position?: BadgePosition;
  /** MDI ikona (např. 'mdi:vacuum') */
  icon?: string;
  /** Podmíněná barva ikony */
  icon_color?: ConditionalValue<string>[];
  /** Podmíněný text vedle ikony */
  label?: ConditionalValue<string>[];
  /** Akce při kliknutí */
  tap_action?: TapAction;
  /** Badge je skrytý, pokud podmínka není splněna */
  visible?: StateCondition;
}

// ─── Element (embedded HA karta na souřadnicích) ──────────────────────────────

export interface ElementConfig {
  /** Unikátní identifikátor */
  id: string;
  /** Vzdálenost od vrcholu karty v % */
  top: string;
  /** Vzdálenost od levého okraje v % */
  left: string;
  /** Šířka v % */
  width: string;
  /** Výška v % */
  height: string;
  /** Pořadí vrstvy (výchozí: 4) */
  z_index?: number;
  /** Přetečení obsahu (výchozí: 'hidden') */
  overflow?: string;
  /** Border-radius kontejneru (výchozí: '0') */
  border_radius?: string;
  /** Element je skrytý, pokud podmínka není splněna */
  visible?: StateCondition;
  /**
   * Kompletní konfigurace HA karty — stejná syntaxe jako v Lovelace dashboardu.
   * Funguje pro custom karty (type: custom:...) i built-in karty (type: tile, atd.)
   */
  card: Record<string, unknown>;
}

// ─── Hlavní konfigurace ────────────────────────────────────────────────────────

export interface RoomOverlayCardConfig {
  type: string;
  /** Cesta k základnímu obrázku místnosti */
  base_image: string;
  /** Volitelný noční/tmavý variant obrázku (zatím rezervováno pro budoucí fázi) */
  base_image_night?: string;
  /** Poměr stran karty ve formátu 'šířka/výška' (výchozí: '16/9') */
  aspect_ratio?: string;
  /** Border-radius karty (výchozí: '12px') */
  border_radius?: string;
  /** Kaskáda CSS filter podmínek pro základní obrázek */
  filter_conditions?: FilterCondition[];
  /** CSS transition pro filter přechod (výchozí: '2.0s ease') */
  filter_transition?: string;
  /** Overlay vrstvy (obrázky s podmíněnou opacity/filter) */
  overlays?: OverlayConfig[];
  /** Klikatelné zóny přes obrázek */
  zones?: ZoneConfig[];
  /** Plovoucí status chipy */
  badges?: BadgeConfig[];
  /** Embedded HA karty umístěné na souřadnicích */
  elements?: ElementConfig[];
  /** Zapne červené ohraničení zón pro ladění pozic */
  test_mode?: boolean;
  /** Akce při kliknutí na celou kartu */
  tap_action?: TapAction;
}
