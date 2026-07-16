import type { Scenario } from "./content/schema";
import type { SessionState } from "./types";

/**
 * Redaction — the ONLY shapes that ever leave the server during a live game.
 * The AI role's private brief, hidden information, preferences, reservation/
 * target values, and the session's resolved parameters and AI internal state
 * are structurally absent (tested in tests/privacy.test.ts).
 * Full disclosure happens only in the post-game debrief (role reveal).
 */

export function publicScenario(s: Scenario) {
  return {
    id: s.id,
    title: s.title,
    emoji: s.emoji,
    difficulty: s.difficulty,
    concepts: s.concepts,
    tagline: s.tagline,
    public_context: s.public_context,
    player_role: {
      name: s.player_role.name,
      persona: s.player_role.persona,
      private_brief: s.player_role.private_brief,
      batna: s.player_role.batna,
      reservation_utility: s.player_role.reservation_utility,
      target_utility: s.player_role.target_utility,
    },
    ai_role: {
      name: s.ai_role.name,
      persona: s.ai_role.persona,
    },
    offer_fields: s.offer_fields,
    primary_field: s.primary_field,
    preparation: s.preparation,
  };
}

export function publicSession(state: SessionState, scenario: Scenario) {
  const revealedFacts = scenario.ai_role.hidden_info
    .filter((h) => state.revealed_info.includes(h.id))
    .map((h) => ({ id: h.id, fact: h.fact }));

  return {
    id: state.id,
    scenario_id: state.scenario_id,
    status: state.status,
    turn: state.turn,
    turn_limit: state.resolved.turn_limit,
    prep: state.prep,
    transcript: state.transcript,
    standing_offer: state.standing_offer,
    offer_history: state.offer_history,
    revealed_facts: revealedFacts,
    outcome: state.outcome
      ? {
          type: state.outcome.type,
          final_offer: state.outcome.final_offer,
          // AI utility stays hidden until the debrief role-reveal.
          player_utility: state.outcome.player_utility,
        }
      : null,
  };
}

export type PublicScenario = ReturnType<typeof publicScenario>;
export type PublicSession = ReturnType<typeof publicSession>;
