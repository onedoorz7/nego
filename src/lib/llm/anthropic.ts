import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Coaching } from "@/lib/types";
import {
  buildCoachSystemPrompt,
  buildDialogueSystemPrompt,
  buildTranscriptMessages,
} from "./prompts";
import {
  CoachingResponseSchema,
  DialogueResponseSchema,
  scanDialogue,
  type CoachContext,
  type DialogueContext,
  type DialogueOutput,
  type ModelCallLogger,
  type NegotiationProvider,
} from "./provider";
import { MockProvider } from "./mock";

const MODEL = process.env.NEGO_MODEL || "claude-opus-4-8";

/**
 * AnthropicProvider — natural dialogue + coaching via the Claude API.
 * Every response is schema-validated (structured outputs) and scanned for
 * rule breaches; one retry, then graceful fallback to the mock templates so a
 * flaky call can never break a session. All calls are logged to model_calls.
 */
export class AnthropicProvider implements NegotiationProvider {
  readonly name = `anthropic:${MODEL}`;
  private client = new Anthropic();
  private mock = new MockProvider();

  async dialogue(
    ctx: DialogueContext,
    log: ModelCallLogger
  ): Promise<DialogueOutput> {
    const system = buildDialogueSystemPrompt(
      ctx.scenario,
      ctx.state,
      ctx.decision,
      ctx.playerText
    );
    const messages = buildTranscriptMessages(ctx.state);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.client.messages.parse({
          model: MODEL,
          max_tokens: 700,
          output_config: {
            effort: "low",
            format: zodOutputFormat(DialogueResponseSchema),
          },
          system,
          messages,
        });
        const parsed = response.parsed_output;
        if (!parsed) throw new Error("unparseable structured output");

        const issues = scanDialogue(ctx, parsed.message);
        if (issues.length > 0) {
          log({
            purpose: "dialogue",
            provider: this.name,
            request: { system_chars: system.length, attempt },
            response_raw: JSON.stringify(parsed),
            ok: false,
            error: `guardrail:${issues.join(",")}`,
          });
          continue; // retry once, then fall through to mock
        }

        // The model may only claim reveals it was allowed.
        const used = parsed.used_reveal_ids.filter((id) =>
          ctx.decision.allowed_reveals.includes(id)
        );
        log({
          purpose: "dialogue",
          provider: this.name,
          request: { system_chars: system.length, attempt },
          response_raw: JSON.stringify(parsed),
          ok: true,
          error: null,
        });
        return {
          message: parsed.message,
          used_reveal_ids: used,
          provider: this.name,
          fallback: false,
        };
      } catch (err) {
        log({
          purpose: "dialogue",
          provider: this.name,
          request: { system_chars: system.length, attempt },
          response_raw: null,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Graceful degradation: deterministic templates, game never breaks.
    const fallback = await this.mock.dialogue(ctx, log);
    return { ...fallback, provider: this.name, fallback: true };
  }

  async coach(ctx: CoachContext, log: ModelCallLogger): Promise<Coaching | null> {
    try {
      const response = await this.client.messages.parse({
        model: MODEL,
        max_tokens: 1600,
        output_config: { format: zodOutputFormat(CoachingResponseSchema) },
        system: buildCoachSystemPrompt(),
        messages: [
          {
            role: "user",
            content: `${ctx.material}\n\nAllowed concept keys for concept_to_review: ${ctx.conceptKeys.join(", ")}`,
          },
        ],
      });
      const parsed = response.parsed_output;
      if (!parsed) throw new Error("unparseable structured output");
      log({
        purpose: "coach",
        provider: this.name,
        request: { material_chars: ctx.material.length },
        response_raw: JSON.stringify(parsed),
        ok: true,
        error: null,
      });
      return {
        ...parsed,
        concept_to_review: ctx.conceptKeys.includes(parsed.concept_to_review)
          ? parsed.concept_to_review
          : ctx.conceptKeys[0],
        generated_by: "llm",
      };
    } catch (err) {
      log({
        purpose: "coach",
        provider: this.name,
        request: { material_chars: ctx.material.length },
        response_raw: null,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      return null; // coaching engine falls back to template debrief
    }
  }
}

export function getProvider(): NegotiationProvider {
  const mode = process.env.NEGO_PROVIDER || "auto";
  if (mode === "mock") return new MockProvider();
  if (mode === "anthropic" || (mode === "auto" && process.env.ANTHROPIC_API_KEY)) {
    return new AnthropicProvider();
  }
  return new MockProvider();
}
