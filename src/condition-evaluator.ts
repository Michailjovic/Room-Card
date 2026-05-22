import { StateCondition, ConditionalValue, FilterCondition } from './types';

export type HassStates = Record<string, { state: string; attributes: Record<string, unknown> } | undefined>;

// ─── Vyhodnocení podmínek ──────────────────────────────────────────────────────

/**
 * Vyhodnotí StateCondition proti aktuálním stavům HA.
 * Podporuje: state, state_not (string | pole), numerické operátory, AND/OR.
 */
export function evaluateCondition(condition: StateCondition, states: HassStates): boolean {
  const entityState = states[condition.entity];

  // Entita neexistuje → podmínka nesplněna
  if (!entityState) return false;

  const stateStr = entityState.state;
  const stateNum = parseFloat(stateStr);

  let result = true;

  if (condition.state !== undefined) {
    // Přesná shoda stavu
    result = stateStr === String(condition.state);

  } else if (condition.state_not !== undefined) {
    // Stav NENÍ roven
    if (Array.isArray(condition.state_not)) {
      result = !condition.state_not.map(String).includes(stateStr);
    } else {
      result = stateStr !== String(condition.state_not);
    }

  } else if (condition.operator !== undefined && condition.value !== undefined) {
    // Numerické porovnání
    const compareVal =
      typeof condition.value === 'number'
        ? condition.value
        : parseFloat(String(condition.value));

    if (isNaN(stateNum) || isNaN(compareVal)) {
      result = false;
    } else {
      switch (condition.operator) {
        case '<':  result = stateNum < compareVal;  break;
        case '>':  result = stateNum > compareVal;  break;
        case '<=': result = stateNum <= compareVal; break;
        case '>=': result = stateNum >= compareVal; break;
        case '==': result = stateNum === compareVal; break;
        case '!=': result = stateNum !== compareVal; break;
        default:   result = false;
      }
    }
  }

  // AND — obě podmínky musí platit
  if (result && condition.and) {
    result = evaluateCondition(condition.and, states);
  }

  // OR — pokud hlavní podmínka nesplněna, zkusí alternativu
  if (!result && condition.or) {
    result = evaluateCondition(condition.or, states);
  }

  return result;
}

// ─── Resolver podmíněných hodnot ──────────────────────────────────────────────

/**
 * Prochází seznam podmíněných hodnot a vrací první, jejíž podmínka platí.
 * Položka bez `condition` je výchozí a použije se, pokud žádná jiná nesedí.
 * Pokud není nalezena ani výchozí, vrátí `fallback`.
 */
export function resolveConditionalValue<T>(
  conditions: ConditionalValue<T>[],
  states: HassStates,
  fallback: T
): T {
  // První průchod: hledáme podmíněné položky (mají condition)
  for (const cv of conditions) {
    if (cv.condition === undefined) continue;
    if (evaluateCondition(cv.condition, states)) {
      return cv.value;
    }
  }

  // Druhý průchod: výchozí položka (bez condition)
  const defaultItem = conditions.find(cv => cv.condition === undefined);
  return defaultItem !== undefined ? defaultItem.value : fallback;
}

/**
 * Vyhodnotí kaskádu FilterCondition a vrátí první odpovídající CSS filter string.
 * Funguje stejně jako resolveConditionalValue, ale pro FilterCondition typ.
 */
export function resolveFilter(
  conditions: FilterCondition[],
  states: HassStates
): string {
  // Podmíněné filtry
  for (const fc of conditions) {
    if (fc.condition === undefined) continue;
    if (evaluateCondition(fc.condition, states)) {
      return fc.filter;
    }
  }

  // Výchozí filter (bez condition)
  const def = conditions.find(fc => fc.condition === undefined);
  return def?.filter ?? 'none';
}
