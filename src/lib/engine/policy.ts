import type { Scenario } from "@/lib/content/schema";
import type {
  AiInternalState,
  GamePhase,
  PolicyDecision,
  ResolvedParams,
  SessionState,
} from "@/lib/types";
import { bestOfferAtAiLevel, maxAiUtility } from "./analysis";
import { utilityFor } from "./utility";

/**
 * Opponent policy engine — the deterministic brain of the AI counterpart.
 * It alone decides accept / counter / reject / walk and computes every number
 * in every AI offer. The LLM downstream only turns these decisions into
 * natural language, which makes it structurally impossible for the model to
 * accept an invalid offer, breach its reservation, or invent offer dimensions.
 */

/** How far below reservation a player offer must be to count as insulting. */
export const INSULT_MARGIN = 8;
/** Insults tolerated before (warning then) walking away. */
const FRUSTRATION_LIMIT = 3;

/** Acceptance threshold at a given player-turn: starts at target and decays
 * linearly by concession_rate × span per elapsed turn; scripted events shift
 * it; it NEVER drops below reservation. */
export function acceptanceThreshold(
  scenario: Scenario,
  resolved: ResolvedParams,
  turn: number,
  eventDelta: number
): number {
  const r = resolved.ai_reservation_utility;
  const t = resolved.ai_target_utility;
  const rate = scenario.ai_role.personality.concession_rate;
  const decayed = t - rate * (t - r) * Math.max(0, turn - 1);
  return Math.min(100, Math.max(r, decayed + eventDelta));
}

/** Utility level of the AI's own offers: starts near its best corner
 * (opening_demand) and steps down per offer made, floored at the current
 * acceptance threshold (its offers always weakly beat what it would accept). */
export function counterLevel(
  scenario: Scenario,
  resolved: ResolvedParams,
  ai: AiInternalState,
  turn: number
): number {
  const r = resolved.ai_reservation_utility;
  const maxAi = maxAiUtility(scenario);
  const opening = r + resolved.opening_demand * (maxAi - r);
  const rate = scenario.ai_role.personality.concession_rate;
  const stepped = opening - rate * (opening - r) * ai.offers_made;
  const floor = acceptanceThreshold(scenario, resolved, turn, ai.event_threshold_delta);
  return Math.max(floor, stepped);
}

export function currentPhase(state: SessionState, scenario: Scenario): GamePhase {
  if (state.outcome) return "done";
  if (state.turn >= state.resolved.turn_limit - 1) return "close";
  if (state.standing_offer || state.offer_history.length > 0) return "bargain";
  return "explore";
}

export interface PolicyInput {
  scenario: Scenario;
  state: SessionState;
  /** What the player just did this turn. */
  action:
    | { type: "message"; text: string }
    | { type: "offer"; text?: string }
    | { type: "reject"; text?: string };
  /** Hidden-info ids unlocked by this turn's message (from classify). */
  unlocked_info: string[];
}

export function decide(input: PolicyInput): PolicyDecision {
  const { scenario, state, action } = input;
  const { resolved, ai } = state;
  const turn = state.turn;
  const threshold = acceptanceThreshold(
    scenario,
    resolved,
    turn,
    ai.event_threshold_delta
  );
  const phase = currentPhase(state, scenario);
  const notes: string[] = [];

  const playerOffer =
    state.standing_offer?.by === "player" ? state.standing_offer : null;
  const offerUtility = playerOffer
    ? utilityFor(scenario, "ai", playerOffer.values)
    : null;

  // Reveals: only items unlocked by the player's own words, not yet revealed.
  const allowed = input.unlocked_info.filter(
    (id) => !state.revealed_info.includes(id)
  );

  let mood: AiInternalState["mood"] = ai.mood;
  const lastTurn = turn >= resolved.turn_limit;

  // --- A fresh player offer is on the table -------------------------------
  if (action.type === "offer" && playerOffer && offerUtility !== null) {
    if (offerUtility >= threshold) {
      return decision("accept", null);
    }

    const insulting = offerUtility < resolved.ai_reservation_utility - INSULT_MARGIN;
    const frustration = ai.frustration + (insulting ? 1 : 0);
    if (insulting) {
      mood = frustration >= 2 ? "annoyed" : "wary";
      notes.push(
        "The player's offer is far below anything acceptable to you — respond in character (cool off, push back)."
      );
    }

    if (frustration >= FRUSTRATION_LIMIT) {
      if (scenario.ai_role.personality.warns_before_walking && !ai.warned_walk) {
        return decision("warn_walk", null, { frustration, mood: "annoyed" });
      }
      return decision("walk_away", null, { frustration, mood: "annoyed" });
    }

    if (lastTurn) {
      // Final turn: take anything at/above reservation, else walk.
      if (offerUtility >= resolved.ai_reservation_utility) {
        return decision("accept", null, { frustration, mood });
      }
      return decision("walk_away", null, { frustration, mood });
    }

    // Counter: pick the player-friendliest offer at the AI's current level —
    // integrative trades fall out of the frontier search automatically.
    const level = Math.max(
      counterLevel(scenario, resolved, { ...ai, frustration }, turn),
      offerUtility + 1 // countering below the standing offer would be absurd
    );
    const counter = bestOfferAtAiLevel(scenario, level) ??
      bestOfferAtAiLevel(scenario, threshold);
    return decision("counter_offer", counter?.offer ?? null, {
      frustration,
      mood,
    });
  }

  // --- Player rejected the AI's standing offer without countering ---------
  if (action.type === "reject") {
    if (lastTurn) return decision("walk_away", null, { mood: "wary" });
    const level = counterLevel(
      scenario,
      resolved,
      { ...ai, offers_made: ai.offers_made }, // next counter steps down via offers_made increment on emit
      turn
    );
    const softer = bestOfferAtAiLevel(scenario, Math.max(threshold, level));
    notes.push("The player rejected your last offer outright. Probe what would work for them.");
    return decision("counter_offer", softer?.offer ?? null, { mood: "wary" });
  }

  // --- Plain message (question / statement), no new offer -----------------
  if (allowed.length > 0) {
    notes.push("Weave the newly unlocked private facts into your reply naturally — the player earned them by asking.");
  }

  // If the game is about to end, push for closure.
  if (lastTurn) {
    if (playerOffer && offerUtility !== null && offerUtility >= resolved.ai_reservation_utility) {
      return decision("accept", null);
    }
    notes.push("Time has run out for small talk — state plainly that you need a decision now.");
    const finalOffer = bestOfferAtAiLevel(scenario, threshold);
    return decision(
      state.ai.offers_made > 0 ? "nudge" : "first_offer",
      state.ai.offers_made > 0 ? null : finalOffer?.offer ?? null
    );
  }

  // AI opens with its own offer once patience runs out.
  const patience = scenario.ai_role.personality.patience;
  if (!state.standing_offer && state.offer_history.length === 0 && turn > patience) {
    const level = counterLevel(scenario, resolved, ai, turn);
    const opening = bestOfferAtAiLevel(scenario, level);
    notes.push("You're done waiting — put your number on the table confidently.");
    return decision("first_offer", opening?.offer ?? null);
  }

  return decision("answer", null);

  // -------------------------------------------------------------------------
  function decision(
    intent: PolicyDecision["intent"],
    offer: PolicyDecision["offer"],
    patch: Partial<Pick<AiInternalState, "frustration" | "mood">> = {}
  ): PolicyDecision {
    return {
      intent,
      offer,
      allowed_reveals: allowed,
      acceptance_threshold: Math.round(threshold * 10) / 10,
      standing_offer_utility:
        offerUtility === null ? null : Math.round(offerUtility * 10) / 10,
      mood: patch.mood ?? mood,
      phase,
      notes,
    };
  }
}
