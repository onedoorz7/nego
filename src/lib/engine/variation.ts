import type { Scenario } from "@/lib/content/schema";
import type { ResolvedParams } from "@/lib/types";
import { mulberry32, sampleRange } from "./rng";

/**
 * Variation engine — "infinite games". Ranged scenario parameters are sampled
 * once per session with a seeded RNG, so replays differ but any given session
 * is fully reproducible from (scenario_id, seed).
 */
export function resolveParams(scenario: Scenario, seed: number): ResolvedParams {
  const rng = mulberry32(seed);
  const v = scenario.variation;

  const reservation = v.ai_reservation_utility
    ? sampleRange(rng, v.ai_reservation_utility.min, v.ai_reservation_utility.max)
    : scenario.ai_role.reservation_utility;

  let target = v.ai_target_utility
    ? sampleRange(rng, v.ai_target_utility.min, v.ai_target_utility.max)
    : scenario.ai_role.target_utility;
  // Target must stay meaningfully above reservation.
  target = Math.max(target, reservation + 5);

  const openingDemand = v.opening_demand
    ? sampleRange(rng, v.opening_demand.min, v.opening_demand.max)
    : scenario.ai_role.personality.opening_demand;

  const turnLimit = v.turn_limit
    ? Math.round(sampleRange(rng, v.turn_limit.min, v.turn_limit.max))
    : scenario.turn_limit;

  return {
    ai_reservation_utility: Math.round(reservation * 10) / 10,
    ai_target_utility: Math.round(target * 10) / 10,
    opening_demand: Math.round(openingDemand * 100) / 100,
    turn_limit: turnLimit,
  };
}
