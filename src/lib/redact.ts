import type { Scenario } from "./content/schema";
import type { SessionState } from "./types";
import { computeArcadePoints } from "./engine/arcade";

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
    mode: s.mode,
    lab: s.lab,
    blitz_seconds: s.blitz_seconds ?? null,
    /** Mystery mode: the value RANGE is public (that's the gamble) — the
     * sampled true value and the clue answer texts are not. */
    mystery: s.mystery
      ? { value_field: s.mystery.value_field, value_range: s.mystery.value_range }
      : null,
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
    /** Player-facing game layer (mission, HUD chips, points table). */
    arcade: s.arcade ?? null,
    /** Ask-move cards: the question text only — never the hidden facts.
     * Mystery clue probes are merged in (answers stay server-side). */
    probes: [
      ...s.ai_role.hidden_info
        .filter((h) => h.probe)
        .map((h) => ({ id: h.id, question: h.probe! })),
      ...(s.mystery?.clues ?? []).map((c) => ({ id: c.id, question: c.probe })),
    ],
  };
}

export function publicSession(state: SessionState, scenario: Scenario) {
  const revealedFacts = [
    ...scenario.ai_role.hidden_info
      .filter((h) => state.revealed_info.includes(h.id))
      .map((h) => ({ id: h.id, fact: h.fact })),
    // Mystery clue answers already shown this session (seeded, tier-dependent).
    ...Object.entries(state.dynamic_facts ?? {}).map(([id, fact]) => ({ id, fact })),
  ];

  return {
    id: state.id,
    scenario_id: state.scenario_id,
    status: state.status,
    turn: state.turn,
    turn_limit: state.resolved.turn_limit,
    /** Blitz: wall-clock cutoff the client counts down to. */
    deadline_at: state.deadline_at,
    is_daily: state.is_daily,
    prep: state.prep,
    transcript: state.transcript,
    standing_offer: state.standing_offer,
    /** What accepting their standing offer is worth right now — the pot.
     * Mystery mode: unknown by design (that IS the game), so null. */
    standing_offer_points:
      state.standing_offer?.by === "ai" &&
      scenario.arcade &&
      scenario.mode !== "mystery"
        ? computeArcadePoints(scenario, state.standing_offer.values).points
        : null,
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
