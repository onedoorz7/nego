import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import {
  loadEvaluation,
  loadSession,
  logModelCall,
  saveEvaluation,
} from "@/lib/db/sessions";
import { evaluateSession } from "@/lib/engine/evaluate";
import { generateCoaching } from "@/lib/coaching/coach";
import { getProvider } from "@/lib/llm/anthropic";
import { track } from "@/lib/analytics";
import type { Coaching, EvaluationResult } from "@/lib/types";

/**
 * Debrief — the post-game review. This is the one place where the AI side is
 * fully revealed (role reveal, chess-style): private brief, all hidden info,
 * both utilities, and what a better package would have looked like.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = loadSession(id);
  if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  if (!state.outcome) {
    return NextResponse.json({ error: "Session not finished" }, { status: 400 });
  }
  const scenario = getScenario(state.scenario_id);

  const stored = loadEvaluation(id);
  const evaluation: EvaluationResult =
    (stored?.result as EvaluationResult) ?? evaluateSession(scenario, state);

  let coaching = stored?.coaching as Coaching | null;
  if (!coaching) {
    coaching = await generateCoaching(scenario, state, evaluation, getProvider(), (log) =>
      logModelCall(id, log)
    );
    saveEvaluation(id, evaluation, coaching);
  }

  track("debrief_viewed", id);

  return NextResponse.json({
    evaluation,
    coaching,
    role_reveal: {
      name: scenario.ai_role.name,
      persona: scenario.ai_role.persona,
      private_brief: scenario.ai_role.private_brief,
      batna: scenario.ai_role.batna,
      hidden_info: scenario.ai_role.hidden_info.map((h) => ({
        id: h.id,
        fact: h.fact,
        importance: h.importance,
        discovered: state.revealed_info.includes(h.id),
      })),
      final_ai_utility: state.outcome.ai_utility,
    },
    outcome: state.outcome,
    turn_count: state.turn,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      concepts: scenario.concepts,
      offer_fields: scenario.offer_fields,
    },
  });
}
