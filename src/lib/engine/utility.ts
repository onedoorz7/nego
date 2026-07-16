import type { OfferField, Preference, Scenario } from "@/lib/content/schema";
import type { OfferValues, Side } from "@/lib/types";

/**
 * Utility engine — the deterministic value model.
 * utility(offer) for a role = Σ over fields of normalizedWeight × fieldValue × 100.
 * Field values are 0..1: number fields interpolate between `worst` and `best`
 * (falling back to field min/max), select fields use `option_values`.
 */

export function rolePrefs(scenario: Scenario, side: Side) {
  return side === "player"
    ? scenario.player_role.preferences
    : scenario.ai_role.preferences;
}

export function normalizedWeights(
  prefs: Record<string, Preference>
): Record<string, number> {
  const total = Object.values(prefs).reduce((s, p) => s + p.weight, 0);
  const out: Record<string, number> = {};
  for (const [k, p] of Object.entries(prefs)) out[k] = p.weight / (total || 1);
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Normalized 0..1 value of a single field for a given preference. */
export function fieldValue(
  field: OfferField,
  pref: Preference,
  value: number | string
): number {
  if (field.type === "number") {
    const v = typeof value === "number" ? value : Number(value);
    const best = pref.best ?? field.max;
    const worst = pref.worst ?? field.min;
    if (best === worst) return 1;
    return clamp01((v - worst) / (best - worst));
  }
  const ov = pref.option_values ?? {};
  return clamp01(ov[String(value)] ?? 0);
}

/** 0–100 utility of a complete offer for one side. */
export function utilityFor(
  scenario: Scenario,
  side: Side,
  offer: OfferValues
): number {
  const prefs = rolePrefs(scenario, side);
  const weights = normalizedWeights(prefs);
  let u = 0;
  for (const field of scenario.offer_fields) {
    const pref = prefs[field.key];
    if (!pref) continue; // unweighted field contributes nothing
    u += (weights[field.key] ?? 0) * fieldValue(field, pref, offer[field.key]) * 100;
  }
  return u;
}

/** Per-field candidate values with each side's contribution — the building
 * block for frontier analysis (utilities are additive across fields). */
export interface FieldCandidate {
  value: number | string;
  player: number; // weighted contribution to player utility (0..100 scale)
  ai: number;
}

export function fieldCandidates(
  scenario: Scenario,
  field: OfferField
): FieldCandidate[] {
  const pPrefs = rolePrefs(scenario, "player");
  const aPrefs = rolePrefs(scenario, "ai");
  const pW = normalizedWeights(pPrefs);
  const aW = normalizedWeights(aPrefs);
  const values: (number | string)[] = [];
  if (field.type === "number") {
    // Cap per-field candidates at ~201 to bound analysis work.
    const count = Math.round((field.max - field.min) / field.step) + 1;
    const stride = Math.max(1, Math.ceil(count / 201));
    for (let i = 0; i < count; i += stride) values.push(field.min + i * field.step);
    const last = field.min + (count - 1) * field.step;
    if (values[values.length - 1] !== last) values.push(last);
  } else {
    for (const o of field.options) values.push(o.value);
  }
  return values.map((value) => ({
    value,
    player: pPrefs[field.key]
      ? (pW[field.key] ?? 0) * fieldValue(field, pPrefs[field.key], value) * 100
      : 0,
    ai: aPrefs[field.key]
      ? (aW[field.key] ?? 0) * fieldValue(field, aPrefs[field.key], value) * 100
      : 0,
  }));
}
