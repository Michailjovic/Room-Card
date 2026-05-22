import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  RoomOverlayCardConfig,
  OverlayConfig,
  ZoneConfig,
  BadgeConfig,
  TapAction,
  ZoneAction,
  ConditionalAction,
  StateImageMapping,
  BadgePosition,
} from './types';

import {
  HassStates,
  evaluateCondition,
  resolveConditionalValue,
  resolveFilter,
} from './condition-evaluator';

// ─── HA typy (minimální, bez závislosti na ha-frontend balíčku) ───────────────

interface Hass {
  states: HassStates;
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<unknown>;
}

// ─── Registrace karty v HA card pickeru ───────────────────────────────────────

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'room-overlay-card',
  name: 'Room Overlay Card',
  description:
    'Vizualizace místnosti s obrazkovými vrstvami, podmíněnými CSS přechody a klikatelnými zónami',
  preview: true,
});

// ─── Pozice badgů ─────────────────────────────────────────────────────────────

const BADGE_POSITIONS: Record<BadgePosition, Record<string, string>> = {
  'bottom-left':  { bottom: '10px', left: '10px' },
  'bottom-right': { bottom: '10px', right: '10px' },
  'top-left':     { top: '10px', left: '10px' },
  'top-right':    { top: '10px', right: '10px' },
};

// ─── Karta ────────────────────────────────────────────────────────────────────

@customElement('room-overlay-card')
export class RoomOverlayCard extends LitElement {
  @property({ attribute: false }) public hass!: Hass;
  @state() private _config!: RoomOverlayCardConfig;

  // Výchozí konfigurace pro HA card picker preview
  static getStubConfig(): Partial<RoomOverlayCardConfig> {
    return {
      base_image: '/local/room.webp',
      aspect_ratio: '16/9',
      border_radius: '12px',
      filter_conditions: [],
      filter_transition: '2.0s ease',
      overlays: [],
      zones: [],
      badges: [],
      test_mode: false,
    };
  }

  setConfig(config: RoomOverlayCardConfig): void {
    if (!config.base_image) {
      throw new Error('[room-overlay-card] Chybí povinný parametr: base_image');
    }
    this._config = config;
  }

  // HA používá tuto hodnotu pro výchozí výšku v grid layoutu
  getCardSize(): number {
    return 4;
  }

  // ─── Zpracování akcí ────────────────────────────────────────────────────────

  /** Vyhodnotí podmíněnou nebo přímou akci a vrátí konkrétní ZoneAction */
  private _resolveAction(tapAction: TapAction): ZoneAction {
    if ('condition' in tapAction) {
      const ca = tapAction as ConditionalAction;
      return evaluateCondition(ca.condition, this.hass.states)
        ? ca.then
        : (ca.else ?? { action: 'none' });
    }
    return tapAction as ZoneAction;
  }

  /** Provede akci a zastaví propagaci eventu */
  private _executeAction(tapAction: TapAction | undefined, event: Event): void {
    if (!tapAction) return;
    event.stopPropagation();
    event.preventDefault();

    const action = this._resolveAction(tapAction);

    switch (action.action) {
      case 'navigate':
        if (action.path) {
          history.pushState(null, '', action.path);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
        break;

      case 'more-info':
        if (action.entity) {
          this.dispatchEvent(
            new CustomEvent('hass-more-info', {
              bubbles: true,
              composed: true,
              detail: { entityId: action.entity },
            })
          );
        }
        break;

      case 'call-service':
        if (action.service) {
          const dotIndex = action.service.indexOf('.');
          const domain  = action.service.slice(0, dotIndex);
          const service = action.service.slice(dotIndex + 1);
          this.hass.callService(domain, service, action.service_data ?? {});
        }
        break;

      case 'browser-mod-popup':
        this.hass.callService('browser_mod', 'popup', {
          title:   action.title   ?? '',
          size:    action.size    ?? 'normal',
          content: action.content ?? {},
        });
        break;

      case 'toggle':
        if (action.entity) {
          this.hass.callService('homeassistant', 'toggle', {
            entity_id: action.entity,
          });
        }
        break;

      case 'none':
      default:
        break;
    }
  }

  // ─── Pomocné metody ────────────────────────────────────────────────────────

  /** Vrátí URL obrázku pro overlay (statický nebo state-mapped) */
  private _resolveOverlayImage(overlay: OverlayConfig): string {
    if (overlay.image) return overlay.image;

    if (overlay.state_images?.length) {
      for (const mapping of overlay.state_images) {
        if (!('entity' in mapping)) continue; // přeskočit default
        const sm = mapping as StateImageMapping;
        const entityState = this.hass.states[sm.entity]?.state;
        if (entityState === sm.state) return sm.image;
      }
      // Výchozí obrázek (bez entity/state)
      const def = overlay.state_images.find(m => !('entity' in m));
      if (def) return (def as { image: string }).image;
    }

    return '';
  }

  /** Vrátí CSS padding-bottom pro daný poměr stran */
  private _aspectRatioPadding(ratio: string): string {
    const parts = ratio.split('/');
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (w > 0 && h > 0) {
        return `${((h / w) * 100).toFixed(4)}%`;
      }
    }
    return '56.25%'; // fallback 16:9
  }

  // ─── Renderovací metody ────────────────────────────────────────────────────

  private _renderBaseImage(): TemplateResult {
    const { base_image, filter_conditions, filter_transition } = this._config;
    const states = this.hass.states;

    const filter = filter_conditions?.length
      ? resolveFilter(filter_conditions, states)
      : 'none';

    const transition = filter_transition ?? '2.0s ease';

    return html`
      <div
        class="layer base-image"
        style=${styleMap({
          backgroundImage: `url('${base_image}')`,
          filter,
          transition: `filter ${transition}`,
          willChange: 'filter',
        })}
      ></div>
    `;
  }

  private _renderOverlays(): TemplateResult[] {
    const { overlays } = this._config;
    if (!overlays?.length) return [];

    const states = this.hass.states;

    return overlays.map((overlay, index) => {
      const image = this._resolveOverlayImage(overlay);
      if (!image) return html``;

      const transition = overlay.transition ?? '2.0s ease';
      const zIndex     = String(overlay.z_index ?? index + 1);

      const opacity = overlay.conditions?.opacity
        ? resolveConditionalValue(overlay.conditions.opacity, states, 0)
        : 1;

      const filter = overlay.conditions?.filter
        ? resolveConditionalValue(overlay.conditions.filter, states, 'none')
        : 'none';

      return html`
        <div
          class="layer overlay"
          data-overlay-id=${overlay.id}
          style=${styleMap({
            backgroundImage: `url('${image}')`,
            opacity: String(opacity),
            filter,
            transition: `opacity ${transition}, filter ${transition}`,
            zIndex,
            willChange: 'opacity',
          })}
        ></div>
      `;
    });
  }

  private _renderZones(): TemplateResult[] {
    const { zones, test_mode } = this._config;
    if (!zones?.length) return [];

    const states   = this.hass.states;
    const testMode = test_mode ?? false;

    return zones.map(zone => {
      // Podmíněné zobrazení zóny
      if (zone.visible && !evaluateCondition(zone.visible, states)) {
        return html``;
      }

      const zoneStyles: Record<string, string> = {
        top:    zone.top,
        left:   zone.left,
        width:  zone.width,
        height: zone.height,
        zIndex: '50',
        cursor: zone.tap_action ? 'pointer' : 'default',
        boxSizing: 'border-box',
        WebkitTapHighlightColor: 'transparent',
      };

      if (testMode) {
        zoneStyles['outline'] = '3px solid red';
        zoneStyles['backgroundColor'] = 'rgba(255, 0, 0, 0.08)';
      }

      const testLabel = testMode
        ? `[${zone.id}] ${zone.top} ${zone.left} ${zone.width}×${zone.height}${zone.label ? ' — ' + zone.label : ''}`
        : '';

      return html`
        <div
          class="zone"
          data-zone-id=${zone.id}
          style=${styleMap(zoneStyles)}
          title=${testLabel}
          @click=${(e: Event) => this._executeAction(zone.tap_action, e)}
          @touchend=${(e: Event) => this._executeAction(zone.tap_action, e)}
        >
          ${testMode && zone.label
            ? html`<span class="zone-label">${zone.id}</span>`
            : nothing}
        </div>
      `;
    });
  }

  private _renderBadges(): TemplateResult[] {
    const { badges } = this._config;
    if (!badges?.length) return [];

    const states = this.hass.states;

    return badges.map(badge => {
      // Podmíněné zobrazení badge
      if (badge.visible && !evaluateCondition(badge.visible, states)) {
        return html``;
      }

      const iconColor = badge.icon_color
        ? resolveConditionalValue(badge.icon_color, states, 'white')
        : 'white';

      const label = badge.label
        ? resolveConditionalValue(badge.label, states, '')
        : '';

      const position = badge.position ?? 'bottom-left';
      const posStyles = BADGE_POSITIONS[position] ?? BADGE_POSITIONS['bottom-left'];

      return html`
        <div
          class="badge"
          data-badge-id=${badge.id}
          style=${styleMap({
            ...posStyles,
            cursor: badge.tap_action ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
          })}
          @click=${(e: Event) => this._executeAction(badge.tap_action, e)}
          @touchend=${(e: Event) => this._executeAction(badge.tap_action, e)}
        >
          ${badge.icon
            ? html`
                <ha-icon
                  icon=${badge.icon}
                  style=${styleMap({
                    color: iconColor,
                    '--mdc-icon-size': '14px',
                  })}
                ></ha-icon>
              `
            : nothing}
          ${label
            ? html`<span class="badge-label">${label}</span>`
            : nothing}
        </div>
      `;
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  protected render(): TemplateResult {
    if (!this._config || !this.hass) return html``;

    const { aspect_ratio, border_radius, tap_action } = this._config;
    const paddingBottom = this._aspectRatioPadding(aspect_ratio ?? '16/9');

    return html`
      <ha-card
        style=${styleMap({ borderRadius: border_radius ?? '12px' })}
        @click=${(e: Event) => tap_action && this._executeAction(tap_action, e)}
      >
        <div class="card-wrapper" style=${styleMap({ paddingBottom })}>
          <div class="card-content">
            ${this._renderBaseImage()}
            ${this._renderOverlays()}
            ${this._renderZones()}
            ${this._renderBadges()}
          </div>
        </div>
      </ha-card>
    `;
  }

  // ─── Styly ────────────────────────────────────────────────────────────────

  static get styles() {
    return css`
      :host {
        display: block;
      }

      ha-card {
        overflow: hidden;
        padding: 0 !important;
        background: transparent;
      }

      /* Padding-bottom trik pro zachování poměru stran */
      .card-wrapper {
        position: relative;
        width: 100%;
        overflow: hidden;
      }

      /* Absolutní obsah přes celou plochu */
      .card-content {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      /* Společné vlastnosti pro všechny vrstvy */
      .layer {
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        pointer-events: none;
      }

      /* Zóny — absolutně umístěné klikatelné oblasti */
      .zone {
        position: absolute;
      }

      /* Popisek v test módu */
      .zone-label {
        position: absolute;
        top: 2px;
        left: 4px;
        font-size: 10px;
        color: red;
        font-weight: bold;
        pointer-events: none;
        text-shadow: 0 0 3px white;
        white-space: nowrap;
      }

      /* Plovoucí badge chip */
      .badge {
        position: absolute;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 4px 10px;
        white-space: nowrap;
        user-select: none;
      }

      .badge-label {
        font-size: 12px;
        color: white;
        font-weight: 500;
      }

      ha-icon {
        display: flex;
        width: 14px;
        height: 14px;
      }
    `;
  }
}
