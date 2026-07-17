import type { Coaching } from "@/lib/types";
import { formatOffer } from "@/lib/engine/offers";
import type {
  CoachContext,
  DialogueContext,
  DialogueOutput,
  ModelCallLogger,
  NegotiationProvider,
} from "./provider";

/**
 * MockProvider — deterministic, template-based dialogue so the entire game
 * loop runs (and is testable) with no API key and zero cost. Tone is basic;
 * the deterministic decisions underneath are identical to live play.
 */
export class MockProvider implements NegotiationProvider {
  readonly name = "mock";

  async dialogue(
    ctx: DialogueContext,
    log: ModelCallLogger
  ): Promise<DialogueOutput> {
    const { scenario, decision } = ctx;
    const reveals = scenario.ai_role.hidden_info.filter((h) =>
      decision.allowed_reveals.includes(h.id)
    );
    const revealText = reveals.map((h) => toFirstPerson(h.fact)).join(" ");
    const offerText = decision.offer
      ? formatOffer(scenario, decision.offer)
      : "";
    const name = scenario.ai_role.name;

    const moodPrefix =
      decision.mood === "annoyed"
        ? "Look — "
        : decision.mood === "wary"
          ? "Hmm. "
          : "";

    let message: string;
    switch (decision.intent) {
      case "accept":
        message = `${moodPrefix}You know what — deal. ${
          ctx.state.standing_offer
            ? `${formatOffer(scenario, ctx.state.standing_offer.values)} it is.`
            : ""
        } Glad we could make this work.`;
        break;
      case "counter_offer":
        message = `${revealText} ${moodPrefix}I can't do that as it stands. Here's what works for me: ${offerText}. What do you say?`;
        break;
      case "first_offer":
        message = `${revealText} ${moodPrefix}Let me put something concrete on the table: ${offerText}.`;
        break;
      case "reject_offer":
        message = `${revealText} ${moodPrefix}That one doesn't work for me, I'm afraid. Come back with something better.`;
        break;
      case "answer":
        message = revealText
          ? `${revealText}`
          : `${moodPrefix}Fair question. ${pickTalkingPoint(ctx)} What else would you like to know?`;
        break;
      case "hold_firm":
        message =
          ctx.state.ai.flinches_used > 2
            ? `${moodPrefix}You can make that face all you like — the number's the number. Do you want it or not?`
            : `${moodPrefix}I know, I know. But I did my homework on what it's worth — I'm comfortable where I am.`;
        break;
      case "nudge":
        message = `${revealText} ${moodPrefix}We've been going back and forth a while — where do you actually stand? Give me a number we can work with.`;
        break;
      case "warn_walk":
        message = `${moodPrefix}I'll be honest: this is starting to feel like a waste of both our time. One more offer like that and I'm done here.`;
        break;
      case "walk_away":
        message = `${moodPrefix}I don't think we're going to get there. I'm going to pass — good luck with your search.`;
        break;
    }

    const out: DialogueOutput = {
      message: message.replace(/\s+/g, " ").trim(),
      used_reveal_ids: reveals.map((r) => r.id),
      provider: this.name,
      fallback: false,
    };
    log({
      purpose: "dialogue",
      provider: this.name,
      request: { intent: decision.intent, offer: decision.offer },
      response_raw: out.message,
      ok: true,
      error: null,
    });
    return out;

    function pickTalkingPoint(c: DialogueContext): string {
      const tps = c.scenario.ai_role.talking_points;
      if (!tps.length) return "";
      return toFirstPerson(tps[c.state.turn % tps.length]);
    }
  }

  async coach(): Promise<Coaching | null> {
    // Template coaching is assembled by the coaching engine from observations;
    // the mock provider contributes nothing extra.
    return null;
  }
}

/** Hidden-info facts are written second person ("You need the cash…") for the
 * prompt; flip the obvious pronouns for direct template output. */
function toFirstPerson(fact: string): string {
  return fact
    .replace(/\byou'd\b/gi, "I'd")
    .replace(/\byou'll\b/gi, "I'll")
    .replace(/\byou're\b/gi, "I'm")
    .replace(/\byou've\b/gi, "I've")
    .replace(/\byourself\b/gi, "myself")
    .replace(/\byours\b/gi, "mine")
    .replace(/\byour\b/gi, "my")
    .replace(/\byou\b/gi, "I");
}

// Referenced for typing completeness in tests.
export type { CoachContext, ModelCallLogger };
