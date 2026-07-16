import type { Scenario } from "@/lib/content/schema";
import type { OfferValues } from "@/lib/types";
import { fieldCandidates, utilityFor, type FieldCandidate } from "./utility";

/**
 * Offer-space analysis. Utilities are additive across fields, so questions
 * like "the best offer for the player with AI utility ≥ L" are multiple-choice
 * knapsack problems. We solve them EXACTLY with a DP over discretized AI
 * utility (0.01 resolution), computed once per scenario and cached. This keeps
 * arbitrary offer grids fast (no full enumeration) while finding interior
 * trade-off points that scalarization/corner methods miss.
 */

export interface FrontierPoint {
  offer: OfferValues;
  player: number;
  ai: number;
}

const SCALE = 100; // AI-utility units of 0.01

interface Dp {
  fields: { key: string; candidates: FieldCandidate[] }[];
  maxUnits: number;
  /** bestPlayer[j] = max Σ player contributions with Σ round(ai*SCALE) == j */
  bestPlayer: Float64Array;
  /** choice[f][j] = candidate index picked for field f on the best path to j */
  choice: Uint16Array[];
  /** suffix argmax: bestJ[j] = j' ≥ j maximizing bestPlayer[j'] (-1 if none) */
  bestJFrom: Int32Array;
}

const dpCache = new Map<string, Dp>();

function unitsOf(c: FieldCandidate): number {
  return Math.max(0, Math.round(c.ai * SCALE));
}

function buildDp(scenario: Scenario): Dp {
  const cached = dpCache.get(scenario.id);
  if (cached) return cached;

  const fields = scenario.offer_fields.map((f) => ({
    key: f.key,
    candidates: fieldCandidates(scenario, f),
  }));
  const maxUnits = fields.reduce(
    (s, f) => s + Math.max(...f.candidates.map(unitsOf)),
    0
  );

  let dp = new Float64Array(maxUnits + 1).fill(-Infinity);
  dp[0] = 0;
  const choice: Uint16Array[] = [];

  for (const f of fields) {
    const next = new Float64Array(maxUnits + 1).fill(-Infinity);
    const ch = new Uint16Array(maxUnits + 1);
    for (let j = 0; j <= maxUnits; j++) {
      for (let ci = 0; ci < f.candidates.length; ci++) {
        const c = f.candidates[ci];
        const u = unitsOf(c);
        if (u > j) continue;
        const prev = dp[j - u];
        if (prev === -Infinity) continue;
        const val = prev + c.player;
        if (val > next[j]) {
          next[j] = val;
          ch[j] = ci;
        }
      }
    }
    dp = next;
    choice.push(ch);
  }

  const bestJFrom = new Int32Array(maxUnits + 2);
  bestJFrom[maxUnits + 1] = -1;
  let argmax = -1;
  let best = -Infinity;
  for (let j = maxUnits; j >= 0; j--) {
    if (dp[j] > best) {
      best = dp[j];
      argmax = j;
    }
    bestJFrom[j] = argmax;
  }

  const built: Dp = { fields, maxUnits, bestPlayer: dp, choice, bestJFrom };
  dpCache.set(scenario.id, built);
  return built;
}

function reconstruct(dp: Dp, j: number): OfferValues {
  const offer: OfferValues = {};
  let rem = j;
  for (let f = dp.fields.length - 1; f >= 0; f--) {
    const ci = dp.choice[f][rem];
    const c = dp.fields[f].candidates[ci];
    offer[dp.fields[f].key] = c.value;
    rem -= unitsOf(c);
  }
  return offer;
}

function pointAt(scenario: Scenario, dp: Dp, j: number): FrontierPoint {
  const offer = reconstruct(dp, j);
  return {
    offer,
    player: utilityFor(scenario, "player", offer),
    ai: utilityFor(scenario, "ai", offer),
  };
}

/** Maximum achievable joint utility — exact (joint is separable per field). */
export function maxJointUtility(scenario: Scenario): number {
  const dp = buildDp(scenario);
  return dp.fields.reduce(
    (s, f) => s + Math.max(...f.candidates.map((c) => c.player + c.ai)),
    0
  );
}

/** Max achievable AI utility (its best corner) — exact. */
export function maxAiUtility(scenario: Scenario): number {
  const dp = buildDp(scenario);
  return dp.fields.reduce((s, f) => s + Math.max(...f.candidates.map((c) => c.ai)), 0);
}

/** Best offer for the PLAYER subject to AI utility ≥ level (exact utilities
 * verified after reconstruction). Null if the level is unreachable. Used by
 * the opponent policy to build integrative counters — it automatically gives
 * away what is cheap for the AI but valuable to the player. */
export function bestOfferAtAiLevel(
  scenario: Scenario,
  level: number
): FrontierPoint | null {
  const dp = buildDp(scenario);
  let j0 = Math.max(0, Math.ceil(level * SCALE));
  // Discretization safety: bump the floor until the exact AI utility clears
  // the requested level (bounded walk).
  for (let tries = 0; tries < 50; tries++) {
    if (j0 > dp.maxUnits) return null;
    const j = dp.bestJFrom[j0];
    if (j < 0 || dp.bestPlayer[j] === -Infinity) return null;
    const p = pointAt(scenario, dp, j);
    if (p.ai >= level - 1e-9) return p;
    j0 = j + 1;
  }
  return null;
}

/** Does any offer satisfy both sides' reservations? */
export function zopaExists(
  scenario: Scenario,
  playerReservation: number,
  aiReservation: number
): boolean {
  const p = bestOfferAtAiLevel(scenario, aiReservation);
  return p !== null && p.player >= playerReservation - 1e-9;
}

/** For a struck deal, find a feasible offer meaningfully better for one side
 * and at least as good for the other. Null when the deal is (near-)efficient. */
export function paretoImprovement(
  scenario: Scenario,
  deal: OfferValues
): FrontierPoint | null {
  const EPS = 2; // require a meaningful improvement, not rounding noise
  const dp = buildDp(scenario);
  const pu = utilityFor(scenario, "player", deal);
  const au = utilityFor(scenario, "ai", deal);

  // Better for the player, no worse for the AI.
  const p1 = bestOfferAtAiLevel(scenario, au);
  if (p1 && p1.player >= pu + EPS && p1.ai >= au - 1e-9) return p1;

  // Better for the AI, no worse for the player.
  for (let j = dp.maxUnits; j >= 0; j--) {
    if (j / SCALE < au + EPS) break;
    if (dp.bestPlayer[j] === -Infinity || dp.bestPlayer[j] < pu - 0.25) continue;
    const p = pointAt(scenario, dp, j);
    if (p.player >= pu - 1e-9 && p.ai >= au + EPS) return p;
  }
  return null;
}

/** Sampled Pareto frontier (exact points, mutually non-dominated), sorted by
 * descending player utility. For the admin inspector and tests. */
export function paretoFrontier(scenario: Scenario, maxPoints = 80): FrontierPoint[] {
  const dp = buildDp(scenario);
  // Collect js where player value strictly improves as ai decreases.
  const js: number[] = [];
  let best = -Infinity;
  for (let j = dp.maxUnits; j >= 0; j--) {
    if (dp.bestPlayer[j] > best) {
      best = dp.bestPlayer[j];
      js.push(j);
    }
  }
  const stride = Math.max(1, Math.floor(js.length / maxPoints));
  const sampled = js.filter((_, i) => i % stride === 0);
  const points = sampled.map((j) => pointAt(scenario, dp, j));
  // Exact-utility non-domination filter (discretization can create ties).
  const kept: FrontierPoint[] = [];
  for (const p of points) {
    if (
      !points.some(
        (q) => q !== p && q.player >= p.player + 0.01 && q.ai >= p.ai + 0.01
      )
    ) {
      kept.push(p);
    }
  }
  kept.sort((a, b) => b.player - a.player);
  return kept;
}
