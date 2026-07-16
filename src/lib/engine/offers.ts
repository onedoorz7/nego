import type { Scenario } from "@/lib/content/schema";
import type { OfferValues } from "@/lib/types";

/**
 * Offer engine — validation and normalization of structured offers.
 * Every offer (player or AI) passes through here before entering the game.
 */

export interface OfferValidation {
  ok: boolean;
  errors: string[];
  /** Values coerced onto the field grid (numbers snapped to step). */
  values: OfferValues;
}

export function validateOffer(
  scenario: Scenario,
  input: Record<string, unknown>
): OfferValidation {
  const errors: string[] = [];
  const values: OfferValues = {};

  for (const field of scenario.offer_fields) {
    const raw = input[field.key];
    if (raw === undefined || raw === null || raw === "") {
      errors.push(`Missing value for "${field.label}"`);
      continue;
    }
    if (field.type === "number") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) {
        errors.push(`"${field.label}" must be a number`);
        continue;
      }
      if (n < field.min || n > field.max) {
        errors.push(
          `"${field.label}" must be between ${field.min} and ${field.max}`
        );
        continue;
      }
      // Snap to the step grid.
      const snapped =
        field.min + Math.round((n - field.min) / field.step) * field.step;
      values[field.key] = Math.min(field.max, Math.max(field.min, snapped));
    } else {
      const s = String(raw);
      if (!field.options.some((o) => o.value === s)) {
        errors.push(`"${field.label}" has an invalid option`);
        continue;
      }
      values[field.key] = s;
    }
  }

  // Reject unknown fields — the AI (or client) must not invent dimensions.
  for (const key of Object.keys(input)) {
    if (!scenario.offer_fields.some((f) => f.key === key)) {
      errors.push(`Unknown offer field "${key}"`);
    }
  }

  return { ok: errors.length === 0, errors, values };
}

export function offersEqual(a: OfferValues, b: OfferValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (a[k] !== b[k]) return false;
  return true;
}

/** Human-readable offer summary, e.g. "$450 · + spare battery & padded bag". */
export function formatOffer(scenario: Scenario, values: OfferValues): string {
  return scenario.offer_fields
    .map((f) => {
      const v = values[f.key];
      if (v === undefined) return null;
      if (f.type === "number") {
        const unit = f.unit ?? "";
        return unit === "$"
          ? `$${Number(v).toLocaleString()}`
          : `${v} ${unit}`.trim();
      }
      return f.options.find((o) => o.value === v)?.label ?? String(v);
    })
    .filter(Boolean)
    .join(" · ");
}
