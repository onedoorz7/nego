import type { Scenario } from "@/lib/content/schema";
import type { Coaching, EvaluationResult, SessionState } from "@/lib/types";
import { formatOffer } from "@/lib/engine/offers";
import type { ModelCallLogger, NegotiationProvider } from "@/lib/llm/provider";

/**
 * Coaching engine — builds the debrief material and asks the provider for
 * qualitative coaching. Falls back to a transparent template assembled from
 * the deterministic observations when no LLM is available (or on failure).
 * Coaching NEVER contributes numbers; those all come from the evaluation.
 */

export async function generateCoaching(
  scenario: Scenario,
  state: SessionState,
  evaluation: EvaluationResult,
  provider: NegotiationProvider,
  log: ModelCallLogger
): Promise<Coaching> {
  const material = renderMaterial(scenario, state, evaluation);
  const llm = await provider.coach(
    { scenario, state, material, conceptKeys: scenario.concepts },
    log
  );
  if (llm) return llm;
  return templateCoaching(scenario, state, evaluation);
}

function renderMaterial(
  scenario: Scenario,
  state: SessionState,
  ev: EvaluationResult
): string {
  const transcript = state.transcript
    .map((e) => {
      const who =
        e.speaker === "player" ? "PLAYER" : e.speaker === "ai" ? scenario.ai_role.name : "SYSTEM";
      const offer = e.offer ? ` [offer: ${formatOffer(scenario, e.offer)}]` : "";
      return `${e.turn}. ${who} (${e.kind}): ${e.text}${offer}`;
    })
    .join("\n");

  const prep = Object.entries(state.prep ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const missedFacts = scenario.ai_role.hidden_info
    .filter((h) => ev.discovery.missed.includes(h.id))
    .map((h) => `- ${h.fact}`)
    .join("\n");

  return [
    `# Scenario: ${scenario.title}\n${scenario.public_context}`,
    `# Player's role\n${scenario.player_role.persona}\nReservation ${scenario.player_role.reservation_utility}, target ${scenario.player_role.target_utility} (0-100 utility scale).`,
    `# Player's preparation answers\n${prep || "(none)"}`,
    `# Transcript\n${transcript}`,
    `# Outcome\n${JSON.stringify(ev.analysis, null, 2)}`,
    `# Deterministic scores (final — do not dispute)\n${ev.scores
      .map((s) => `- ${s.label}: ${s.value}/100 (${s.basis}) — ${s.explanation}`)
      .join("\n")}\nTotal: ${ev.total}/100`,
    `# Rule-based observations\n${ev.observations.map((o) => `- [${o.kind}] ${o.text}`).join("\n")}`,
    missedFacts
      ? `# Hidden facts the player NEVER discovered (you may reference these — the negotiation is over)\n${missedFacts}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function templateCoaching(
  scenario: Scenario,
  state: SessionState,
  ev: EvaluationResult
): Coaching {
  const strengths = ev.observations
    .filter((o) => o.kind === "strength")
    .map((o) => o.text)
    .slice(0, 3);
  const missed = ev.observations
    .filter((o) => o.kind === "opportunity")
    .map((o) => o.text)
    .slice(0, 3);

  const outcomeLine = (() => {
    const o = state.outcome;
    if (!o) return "The session ended.";
    switch (o.type) {
      case "agreement":
        return `You reached a deal: ${o.final_offer ? formatOffer(scenario, o.final_offer) : ""}.`;
      case "player_walked":
        return "You walked away without a deal.";
      case "ai_walked":
        return `${scenario.ai_role.name} ended the negotiation.`;
      default:
        return "The negotiation ran out of time without a deal.";
    }
  })();

  const missedFact = scenario.ai_role.hidden_info.find((h) =>
    ev.discovery.missed.includes(h.id)
  );

  return {
    what_happened: `${outcomeLine} ${
      ev.analysis.deal_reached
        ? `Your side captured ${ev.analysis.player_utility}/100 utility (walk-away point: ${scenario.player_role.reservation_utility}, target: ${scenario.player_role.target_utility}).`
        : ""
    }`.trim(),
    strengths: strengths.length ? strengths : ["You completed the negotiation — every rep builds the skill."],
    missed_opportunities: missed.length ? missed : ["Push for more information before talking numbers."],
    example_lines: [
      missedFact
        ? `“Help me understand your situation — ${suggestQuestion(missedFact.reveal_topics)}”`
        : "“Before we talk numbers — what matters most to you in this deal?”",
    ],
    concept_to_review: scenario.concepts[0],
    generated_by: "template",
  };
}

function suggestQuestion(topics: string[]): string {
  const t = topics[0] ?? "what matters most to you";
  return `what's driving the ${t.trim()} side of this for you?`;
}
