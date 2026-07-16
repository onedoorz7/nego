import { randomUUID } from "node:crypto";
import type { Scenario } from "@/lib/content/schema";
import type {
  OfferValues,
  SessionState,
  TranscriptEntry,
} from "@/lib/types";
import { analyzePlayerMessage } from "./classify";
import { formatOffer, offersEqual, validateOffer } from "./offers";
import { decide, INSULT_MARGIN } from "./policy";
import { resolveParams } from "./variation";
import { randomSeed } from "./rng";
import { utilityFor } from "./utility";
import type {
  ModelCallLogger,
  NegotiationProvider,
} from "@/lib/llm/provider";

/**
 * Session engine — the turn state machine. One player action per turn; the
 * deterministic policy decides the AI's move; the provider only verbalizes.
 */

export type PlayerAction =
  | { type: "message"; text: string }
  | { type: "offer"; values: Record<string, unknown>; text?: string }
  | { type: "accept" }
  | { type: "reject"; text?: string }
  | { type: "walk_away" };

export function createSession(
  scenario: Scenario,
  seed: number = randomSeed()
): SessionState {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    scenario_id: scenario.id,
    seed,
    status: "preparing",
    created_at: now,
    updated_at: now,
    turn: 0,
    resolved: resolveParams(scenario, seed),
    prep: null,
    transcript: [],
    standing_offer: null,
    offer_history: [],
    revealed_info: [],
    events_fired: [],
    ai: {
      offers_made: 0,
      frustration: 0,
      warned_walk: false,
      event_threshold_delta: 0,
      mood: "warm",
    },
    outcome: null,
  };
}

export function submitPrep(
  state: SessionState,
  prep: Record<string, string | number>
): SessionState {
  if (state.status !== "preparing") throw new UserError("Preparation already submitted");
  return {
    ...state,
    prep,
    status: "active",
    updated_at: new Date().toISOString(),
  };
}

export class UserError extends Error {}

function entry(
  partial: Omit<TranscriptEntry, "at">
): TranscriptEntry {
  return { ...partial, at: new Date().toISOString() };
}

export interface TurnResult {
  state: SessionState;
  /** Reveal ids newly disclosed this turn (for UI highlight). */
  new_reveals: string[];
  ai_fallback: boolean;
}

export async function playTurn(
  scenario: Scenario,
  prev: SessionState,
  action: PlayerAction,
  provider: NegotiationProvider,
  log: ModelCallLogger
): Promise<TurnResult> {
  if (prev.status !== "active") throw new UserError("Session is not active");

  // Work on a deep copy; caller persists the returned state.
  const state: SessionState = JSON.parse(JSON.stringify(prev));
  state.turn += 1;
  state.updated_at = new Date().toISOString();

  // ---- Player side of the turn -------------------------------------------
  let playerText = "";
  if (action.type === "message") {
    playerText = action.text.trim();
    if (!playerText) throw new UserError("Empty message");
    if (playerText.length > 1500) throw new UserError("Message too long");
    state.transcript.push(
      entry({ turn: state.turn, speaker: "player", kind: "message", text: playerText })
    );
  } else if (action.type === "offer") {
    const check = validateOffer(scenario, action.values);
    if (!check.ok) throw new UserError(check.errors.join("; "));
    playerText = (action.text ?? "").trim().slice(0, 1500);
    const offer = { by: "player" as const, values: check.values, turn: state.turn };
    state.standing_offer = offer;
    state.offer_history.push(offer);
    state.transcript.push(
      entry({
        turn: state.turn,
        speaker: "player",
        kind: "offer",
        text: playerText || `Here's my offer: ${formatOffer(scenario, check.values)}.`,
        offer: check.values,
      })
    );
  } else if (action.type === "accept") {
    if (!state.standing_offer || state.standing_offer.by !== "ai") {
      throw new UserError("There is no offer from the other side to accept");
    }
    state.transcript.push(
      entry({
        turn: state.turn,
        speaker: "player",
        kind: "accept",
        text: `Accepted: ${formatOffer(scenario, state.standing_offer.values)}.`,
      })
    );
    return finish(state, scenario, "agreement", state.standing_offer.values);
  } else if (action.type === "reject") {
    if (!state.standing_offer || state.standing_offer.by !== "ai") {
      throw new UserError("There is no offer from the other side to reject");
    }
    playerText = (action.text ?? "").trim().slice(0, 1500);
    state.standing_offer = null;
    state.transcript.push(
      entry({
        turn: state.turn,
        speaker: "player",
        kind: "reject",
        text: playerText || "That doesn't work for me.",
      })
    );
  } else if (action.type === "walk_away") {
    state.transcript.push(
      entry({ turn: state.turn, speaker: "player", kind: "walk", text: "Walked away from the negotiation." })
    );
    return finish(state, scenario, "player_walked", null);
  }

  // ---- Scenario events due this turn --------------------------------------
  for (const ev of scenario.events) {
    if (ev.turn === state.turn && !state.events_fired.includes(ev.id)) {
      state.events_fired.push(ev.id);
      state.ai.event_threshold_delta += ev.threshold_delta;
      state.transcript.push(
        entry({ turn: state.turn, speaker: "system", kind: "event", text: ev.player_note })
      );
    }
  }

  // ---- Deterministic decision ---------------------------------------------
  const analysis = analyzePlayerMessage(scenario, playerText);
  const decision = decide({
    scenario,
    state,
    action:
      action.type === "offer"
        ? { type: "offer", text: playerText }
        : action.type === "reject"
          ? { type: "reject", text: playerText }
          : { type: "message", text: playerText },
    unlocked_info: analysis.matched_info_ids,
  });

  // Bookkeeping the decision implies (before dialogue, so prompts see it).
  state.ai.mood = decision.mood;
  if (decision.intent === "warn_walk") {
    state.ai.warned_walk = true;
    state.ai.frustration = Math.max(state.ai.frustration, 2);
  }
  if (
    action.type === "offer" &&
    decision.standing_offer_utility !== null &&
    decision.standing_offer_utility <
      state.resolved.ai_reservation_utility - INSULT_MARGIN
  ) {
    state.ai.frustration += 1;
  }

  // ---- Verbalize -----------------------------------------------------------
  const dialogue = await provider.dialogue(
    { scenario, state, decision, playerText },
    log
  );

  // Defense in depth: even a misbehaving provider cannot reveal facts the
  // deterministic policy didn't allow this turn.
  const newReveals = dialogue.used_reveal_ids.filter(
    (id) =>
      decision.allowed_reveals.includes(id) && !state.revealed_info.includes(id)
  );
  state.revealed_info.push(...newReveals);

  // ---- Apply the AI move ---------------------------------------------------
  if (decision.intent === "accept" && state.standing_offer) {
    state.transcript.push(
      entry({
        turn: state.turn,
        speaker: "ai",
        kind: "accept",
        text: dialogue.message,
        revealed: newReveals,
      })
    );
    return finishWith(state, scenario, "agreement", state.standing_offer.values, dialogue.fallback, newReveals);
  }

  if (decision.intent === "walk_away") {
    state.transcript.push(
      entry({ turn: state.turn, speaker: "ai", kind: "walk", text: dialogue.message, revealed: newReveals })
    );
    return finishWith(state, scenario, "ai_walked", null, dialogue.fallback, newReveals);
  }

  if (
    (decision.intent === "counter_offer" || decision.intent === "first_offer") &&
    decision.offer
  ) {
    // Guard: the policy never emits an invalid offer, but re-validate anyway.
    const check = validateOffer(scenario, decision.offer);
    const values: OfferValues = check.ok ? check.values : decision.offer;
    if (!state.standing_offer || !offersEqual(state.standing_offer.values, values)) {
      const offer = { by: "ai" as const, values, turn: state.turn };
      state.standing_offer = offer;
      state.offer_history.push(offer);
      state.ai.offers_made += 1;
    }
    state.transcript.push(
      entry({
        turn: state.turn,
        speaker: "ai",
        kind: "offer",
        text: dialogue.message,
        offer: values,
        revealed: newReveals,
      })
    );
  } else {
    state.transcript.push(
      entry({
        turn: state.turn,
        speaker: "ai",
        kind: decision.intent === "reject_offer" ? "reject" : "message",
        text: dialogue.message,
        revealed: newReveals,
      })
    );
    if (decision.intent === "reject_offer") state.standing_offer = null;
  }

  // ---- Turn-limit check -----------------------------------------------------
  if (state.turn >= state.resolved.turn_limit && !state.outcome) {
    state.transcript.push(
      entry({
        turn: state.turn,
        speaker: "system",
        kind: "info",
        text: "Time ran out — the negotiation ended without a deal.",
      })
    );
    return finishWith(state, scenario, "turn_limit", null, dialogue.fallback, newReveals);
  }

  return { state, new_reveals: newReveals, ai_fallback: dialogue.fallback };
}

function finish(
  state: SessionState,
  scenario: Scenario,
  type: "agreement" | "player_walked" | "ai_walked" | "turn_limit",
  finalOffer: OfferValues | null
): TurnResult {
  return finishWith(state, scenario, type, finalOffer, false, []);
}

function finishWith(
  state: SessionState,
  scenario: Scenario,
  type: "agreement" | "player_walked" | "ai_walked" | "turn_limit",
  finalOffer: OfferValues | null,
  aiFallback: boolean,
  newReveals: string[]
): TurnResult {
  state.status = type;
  state.outcome = {
    type,
    final_offer: finalOffer,
    player_utility: finalOffer ? round1(utilityFor(scenario, "player", finalOffer)) : null,
    ai_utility: finalOffer ? round1(utilityFor(scenario, "ai", finalOffer)) : null,
  };
  return { state, new_reveals: newReveals, ai_fallback: aiFallback };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
