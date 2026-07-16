import { z } from "zod";
import type { Scenario } from "@/lib/content/schema";
import type { Coaching, PolicyDecision, SessionState } from "@/lib/types";

/**
 * Provider abstraction. The app works fully without an API key (MockProvider
 * templates the dialogue from the deterministic decision); with
 * ANTHROPIC_API_KEY set, AnthropicProvider generates natural dialogue.
 * Selection: NEGO_PROVIDER=mock|anthropic|auto (default auto).
 */

export interface DialogueContext {
  scenario: Scenario;
  state: SessionState;
  decision: PolicyDecision;
  playerText: string;
}

export interface DialogueOutput {
  message: string;
  /** Validated subset of decision.allowed_reveals actually used. */
  used_reveal_ids: string[];
  provider: string;
  fallback: boolean;
}

export interface CoachContext {
  scenario: Scenario;
  state: SessionState;
  material: string; // pre-rendered debrief material (scores, analysis, transcript)
  conceptKeys: string[];
}

export const DialogueResponseSchema = z.object({
  message: z.string().min(1),
  used_reveal_ids: z.array(z.string()).default([]),
});

export const CoachingResponseSchema = z.object({
  what_happened: z.string(),
  strengths: z.array(z.string()).min(1).max(4),
  missed_opportunities: z.array(z.string()).min(1).max(4),
  example_lines: z.array(z.string()).min(1).max(2),
  concept_to_review: z.string(),
});

export interface ModelCallLog {
  purpose: "dialogue" | "coach";
  provider: string;
  request: unknown;
  response_raw: string | null;
  ok: boolean;
  error: string | null;
}

export type ModelCallLogger = (log: ModelCallLog) => void;

export interface NegotiationProvider {
  readonly name: string;
  dialogue(ctx: DialogueContext, log: ModelCallLogger): Promise<DialogueOutput>;
  coach(ctx: CoachContext, log: ModelCallLogger): Promise<Coaching | null>;
}

/** Scan a generated message for obvious rule breaches. Returns list of issues.
 * (Verbatim-leak detection only — paraphrased leaks are a known limitation,
 * logged in docs/testing-plan.md.) */
export function scanDialogue(
  ctx: DialogueContext,
  message: string
): string[] {
  const issues: string[] = [];
  const lower = message.toLowerCase();
  if (
    /(as an ai|language model|system prompt|my instructions|reservation utility|acceptance threshold|utility score)/.test(
      lower
    )
  ) {
    issues.push("meta_or_internal_leak");
  }
  const permitted = new Set([
    ...ctx.decision.allowed_reveals,
    ...ctx.state.revealed_info,
  ]);
  for (const info of ctx.scenario.ai_role.hidden_info) {
    if (permitted.has(info.id)) continue;
    const frag = info.fact.toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 40);
    const normMsg = lower.replace(/[^a-z0-9 ]/g, "");
    if (frag.length > 15 && normMsg.includes(frag)) {
      issues.push(`hidden_info_leak:${info.id}`);
    }
  }
  return issues;
}
