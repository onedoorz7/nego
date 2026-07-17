import type { Scenario } from "@/lib/content/schema";
import type { OfferValues } from "@/lib/types";
import { bestOfferAtAiLevel, paretoFrontier } from "./analysis";

/**
 * Arcade engine — the player-facing score. Deterministic and dead simple:
 * "every dollar you save is a point." The utility model still powers the AI
 * and the full analysis; THIS is the number the player chases.
 */

export interface ArcadeBreakdownLine {
  label: string;
  points: number;
  detail: string; // e.g. "$90 under the listing"
}

export interface ArcadeScore {
  points: number;
  breakdown: ArcadeBreakdownLine[];
}

export function computeArcadePoints(
  scenario: Scenario,
  offer: OfferValues | null
): ArcadeScore {
  if (!scenario.arcade || !offer) return { points: 0, breakdown: [] };
  const breakdown: ArcadeBreakdownLine[] = [];
  let total = 0;

  for (const entry of scenario.arcade.points) {
    const raw = offer[entry.field];
    if (raw === undefined) continue;
    let pts = 0;
    let detail = "";
    if (entry.kind === "per_unit") {
      const v = Number(raw);
      const delta =
        entry.direction === "below" ? entry.baseline - v : v - entry.baseline;
      // Beating the baseline earns points; missing it COSTS points (eats into
      // bonuses from other fields) — overpaying can't be bought back for free.
      pts = Math.round(delta * entry.per_unit);
      const field = scenario.offer_fields.find((f) => f.key === entry.field);
      const unit = field?.type === "number" ? (field.unit ?? "") : "";
      const abs = Math.abs(delta);
      const amount =
        unit === "$" ? `$${abs.toLocaleString()}` : `${abs} ${unit}`.trim();
      const beat = delta >= 0;
      detail =
        entry.direction === "below"
          ? `${amount} ${beat ? "under" : "OVER"} ${fmtBaseline(entry.baseline, unit)}`
          : `${amount} ${beat ? "above" : "SHORT of"} ${fmtBaseline(entry.baseline, unit)}`;
    } else {
      pts = Math.round(entry.values[String(raw)] ?? 0);
      const field = scenario.offer_fields.find((f) => f.key === entry.field);
      detail =
        field?.type === "select"
          ? (field.options.find((o) => o.value === String(raw))?.label ?? String(raw))
          : String(raw);
    }
    if (pts !== 0 || entry.kind === "per_unit") {
      breakdown.push({ label: entry.label, points: pts, detail });
    }
    total += pts;
  }
  // A round can never go negative — worst deal is simply 0 points.
  return { points: Math.max(0, total), breakdown };
}

function fmtBaseline(baseline: number, unit: string): string {
  return unit === "$" ? `$${baseline.toLocaleString()}` : `${baseline} ${unit}`.trim();
}

/** The best score achievable against this opponent's (session-resolved)
 * bottom line — the "can you find the missing points?" replay hook. */
export function bestPossiblePoints(
  scenario: Scenario,
  aiReservation: number
): number {
  if (!scenario.arcade) return 0;
  let best = 0;
  for (const p of paretoFrontier(scenario)) {
    if (p.ai < aiReservation) continue;
    best = Math.max(best, computeArcadePoints(scenario, p.offer).points);
  }
  return best;
}

/** The opponent's true floor on the primary field ("Sam would've gone as low
 * as ~$405") — revealed after a lost round to sting… and drive a replay. */
export function aiFloorOnPrimary(
  scenario: Scenario,
  aiReservation: number
): number | string | null {
  const p = bestOfferAtAiLevel(scenario, aiReservation);
  if (!p) return null;
  return p.offer[scenario.primary_field] ?? null;
}
