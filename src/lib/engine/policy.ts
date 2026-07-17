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

/** Extra slack the AI gives a credible take-it-or-leave-it offer. */
export const FINAL_OFFER_DISCOUNT = 6;

export interface PolicyInput {
  scenario: Scenario;
  state: SessionState;
  /** What the player just did this turn. */
  action:
    | { type: "message"; text: string }
    | { type: "offer"; text?: string; final?: boolean }
    | { type: "reject"; text?: string }
    | { type: "flinch" }
    | { type: "silence" };
  /** Hidden-info ids unlocked by this turn's message/probe. */
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

  // --- Pressure move: flinch ----------------------------------------------
  if (action.type === "flinch") {
    if (ai.flinches_used > 2) {
      notes.push(
        "The player keeps making a show of wincing at your numbers. You see through the theatrics now — say so, lightly."
      );
      return decision("hold_firm", null, { mood: "wary" });
    }
    notes.push(
      "The player visibly flinched at your offer. Defend your number in character — you may soften in TONE, but do not change any terms this turn."
    );
    return decision("hold_firm", null);
  }

  // --- Pressure move: silence ---------------------------------------------
  if (action.type === "silence") {
    const aiOffers = state.offer_history.filter((o) => o.by === "ai");
    const lastAiOffer = aiOffers[aiOffers.length - 1];
    const lastLevel = lastAiOffer
      ? utilityFor(scenario, "ai", lastAiOffer.values)
      : null;
    const level = counterLevel(scenario, resolved, ai, turn);

    // No numbers on the table yet and patience exhausted: the silence forces
    // the AI to open — exactly what a patient negotiator is playing for.
    if (
      state.offer_history.length === 0 &&
      turn > scenario.ai_role.personality.patience
    ) {
      const opening = bestOfferAtAiLevel(scenario, level);
      notes.push(
        "The player's silence forces your hand — break it by putting your own number on the table."
      );
      return decision("first_offer", opening?.offer ?? null);
    }
    if (ai.silence_streak >= 3) {
      notes.push(
        "The player keeps sitting in silence. It's stopped working — call it out and push for a real response."
      );
      return decision("nudge", null, { mood: "wary" });
    }
    // Silence squeezes a seller under pressure: if the AI's own standing
    // level has decayed meaningfully below its last offer, it sweetens.
    if (lastLevel !== null && lastLevel > level + 2) {
      const sweeter = bestOfferAtAiLevel(scenario, level);
      if (sweeter) {
        notes.push(
          "The player let the silence hang and it's working on you — you're filling it by improving your own offer a little. Present the new terms as 'alright, look…'."
        );
        return decision("counter_offer", sweeter.offer);
      }
    }
    notes.push(
      "The player said nothing — an awkward silence. Fill it in character and prod them to react. Do not change your terms."
    );
    return decision("nudge", null);
  }

  // --- A fresh player offer is on the table -------------------------------
  if (action.type === "offer" && playerOffer && offerUtility !== null) {
    const isFinal = action.final === true;
    // "Take it or leave it": accept with a small extra discount if it clears
    // (never below reservation) — otherwise it ends the game per the warning
    // rules. Broken credibility (bluffed final before) removes the discount.
    if (isFinal) {
      const bar = ai.credibility_broken
        ? threshold
        : Math.max(
            resolved.ai_reservation_utility,
            threshold - FINAL_OFFER_DISCOUNT
          );
      if (offerUtility >= bar) {
        notes.push(
          "The player declared this offer final and it (just) works for you. Accept — a touch grudgingly, in character."
        );
        return decision("accept", null);
      }
      if (
        scenario.ai_role.personality.warns_before_walking &&
        !ai.warned_walk
      ) {
        notes.push(
          "The player declared a final offer you can't take. Tell them plainly: if that's truly final, you're done — give them one chance to reconsider."
        );
        return decision("warn_walk", null, { mood: "wary" });
      }
      notes.push("Their 'final' offer doesn't work for you. Walk away.");
      return decision("walk_away", null, { mood: "wary" });
    }

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
