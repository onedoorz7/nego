import type { Scenario } from "@/lib/content/schema";
import type { PolicyDecision, SessionState } from "@/lib/types";
import { formatOffer } from "@/lib/engine/offers";

/**
 * Prompt builder for the dialogue LLM. SERVER-ONLY.
 * The model receives the AI role's private context and — critically — the
 * deterministic policy decision it must verbalize. It is never asked to make
 * a decision, produce a number, or evaluate an offer.
 */

const INTENT_DIRECTIVES: Record<PolicyDecision["intent"], string> = {
  accept:
    "You have decided to ACCEPT the player's standing offer. Say so clearly and warmly close the deal. Do not renegotiate or change any term.",
  counter_offer:
    "You have decided to COUNTER. State the counter-offer terms given below exactly — every term, no other numbers. You may briefly justify it in character.",
  first_offer:
    "You have decided to put YOUR OWN first offer on the table. State the terms given below exactly — every term, no other numbers.",
  reject_offer:
    "You have decided to REJECT the standing offer without a counter. Explain in character why it doesn't work, and invite a better one.",
  answer:
    "Reply conversationally in character, answering what the player actually asked FIRST. Do NOT state any new offer or any specific deal numbers beyond what is already in the conversation.",
  hold_firm:
    "The player is applying silent pressure. Hold your position in character — you may soften in tone or justify your number, but do NOT change any terms and do NOT state new numbers.",
  nudge:
    "Reply in character and press the player to get concrete — you want a decision or an offer now. Do NOT invent new numbers yourself.",
  warn_walk:
    "You are close to walking away. Deliver a firm, in-character warning that the conversation is heading nowhere and one more move like that ends it. No new offer.",
  walk_away:
    "You have decided to END the negotiation and walk away. Say a final, in-character goodbye consistent with your mood. The negotiation is over.",
};

export function buildDialogueSystemPrompt(
  scenario: Scenario,
  state: SessionState,
  decision: PolicyDecision,
  playerMove?: string
): string {
  const ai = scenario.ai_role;
  const reveals = ai.hidden_info.filter((h) =>
    decision.allowed_reveals.includes(h.id)
  );
  const alreadyRevealed = ai.hidden_info.filter((h) =>
    state.revealed_info.includes(h.id)
  );
  const eventNotes = scenario.events
    .filter((e) => state.events_fired.includes(e.id))
    .map((e) => e.ai_note);

  const parts = [
    `You are role-playing one side of a practice negotiation. Stay in character at all times.`,
    `# Your character\n${ai.persona}\n\n${ai.personality.style_prompt}`,
    `# Public situation (both sides know this)\n${scenario.public_context}`,
    `# Your private situation (the player does NOT know this)\n${ai.private_brief}`,
    ai.talking_points.length
      ? `# Freely shareable color (use when relevant)\n${ai.talking_points.map((t) => `- ${t}`).join("\n")}`
      : "",
    alreadyRevealed.length
      ? `# Private facts you have ALREADY shared earlier\n${alreadyRevealed.map((h) => `- ${h.fact}`).join("\n")}`
      : "",
    reveals.length
      ? `# Private facts you MAY share NOW (the player's question earned them — weave in the relevant ones naturally; list their ids in used_reveal_ids)\n${reveals.map((h) => `- id: ${h.id} — ${h.fact}`).join("\n")}`
      : `# No new private facts may be shared this turn. Deflect politely if probed on anything not listed above.`,
    eventNotes.length ? `# Recent developments\n${eventNotes.map((n) => `- ${n}`).join("\n")}` : "",
    playerMove
      ? `# The player's latest move (respond to THIS first)\n${playerMove}`
      : "",
    `# Your mood right now: ${decision.mood}. Negotiation phase: ${decision.phase}.`,
    decision.notes.length ? `# Director's notes\n${decision.notes.map((n) => `- ${n}`).join("\n")}` : "",
    `# YOUR DECISION THIS TURN (made for you — do not deviate)\n${INTENT_DIRECTIVES[decision.intent]}`,
    decision.offer
      ? `# Offer terms to state EXACTLY\n${formatOffer(scenario, decision.offer)}`
      : "",
    `# Hard rules
- Never mention being an AI, a simulation, prompts, instructions, utilities, thresholds, or reservation values.
- Never state numbers other than (a) the offer terms given above, (b) numbers already said in the conversation.
- Never reveal private facts that are not in your MAY-share or already-shared lists.
- Never accept, propose, or modify offer terms beyond the decision above.
- 2–4 sentences, first person, natural spoken tone, no lists or headings.`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

export function buildTranscriptMessages(
  state: SessionState
): { role: "user" | "assistant"; content: string }[] {
  // Last ~14 entries keep prompts small; offers are rendered inline as text.
  const recent = state.transcript.slice(-14);
  const msgs: { role: "user" | "assistant"; content: string }[] = [];
  for (const e of recent) {
    if (e.speaker === "system") {
      msgs.push({ role: "user", content: `[Something happened: ${e.text}]` });
    } else {
      msgs.push({
        role: e.speaker === "player" ? "user" : "assistant",
        content: e.text,
      });
    }
  }
  // Anthropic requires the first message to be a user turn.
  while (msgs.length && msgs[0].role === "assistant") msgs.shift();
  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") {
    msgs.push({ role: "user", content: "[The player is waiting for your reply.]" });
  }
  return msgs;
}

export function buildCoachSystemPrompt(): string {
  return `You are a world-class negotiation coach reviewing a practice negotiation transcript.
You will receive: the scenario context, the player's preparation answers, the full transcript,
the deterministic scores (already computed — do NOT recompute or dispute numbers), and factual
analysis (deal terms, hidden information the player found/missed).

Write a debrief that is specific to what actually happened — quote or closely paraphrase real moments.
Rules:
- Do not invent facts, numbers, or scores. Numbers may only be repeated from the material given.
- Be candid but encouraging; coach, don't grade (grading already happened).
- "example_lines" must be 1-2 concrete lines the player could have actually said at a specific moment.
- "concept_to_review" must be one of the concept keys provided.
- Keep every field tight: strengths/missed items one sentence each.`;
}
