import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import { loadSession, logModelCall, saveSession } from "@/lib/db/sessions";
import { playTurn, UserError, type PlayerAction } from "@/lib/engine/session";
import { evaluateSession } from "@/lib/engine/evaluate";
import { recordScenarioResult } from "@/lib/progress";
import { saveEvaluation } from "@/lib/db/sessions";
import { getProvider } from "@/lib/llm/anthropic";
import { publicSession } from "@/lib/redact";
import { track } from "@/lib/analytics";

/** The gameplay endpoint: one player action per call, AI responds. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = loadSession(id);
  if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const scenario = getScenario(state.scenario_id);

  const body = await req.json().catch(() => null);
  const action = parseAction(body);
  if (!action) return NextResponse.json({ error: "Bad action" }, { status: 400 });

  trackAction(action, id);

  try {
    const result = await playTurn(scenario, state, action, getProvider(), (log) =>
      logModelCall(id, log)
    );
    saveSession(result.state);

    if (result.ai_fallback) track("ai_fallback_used", id);

    // Session just finished → evaluate deterministically and record progress.
    if (result.state.outcome) {
      const evaluation = evaluateSession(scenario, result.state);
      saveEvaluation(id, evaluation, null);
      recordScenarioResult(scenario.id, evaluation);
      track("scenario_completed", id, {
        outcome: result.state.outcome.type,
        total: evaluation.total,
        turns: result.state.turn,
      });
      if (result.state.outcome.type === "agreement") track("offer_accepted", id);
    }

    return NextResponse.json({
      session: publicSession(result.state, scenario),
      new_reveals: result.new_reveals,
      done: !!result.state.outcome,
    });
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("action error", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function parseAction(body: unknown): PlayerAction | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  switch (b.type) {
    case "message":
      return typeof b.text === "string" ? { type: "message", text: b.text } : null;
    case "offer":
      return b.values && typeof b.values === "object"
        ? {
            type: "offer",
            values: b.values as Record<string, unknown>,
            text: typeof b.text === "string" ? b.text : undefined,
          }
        : null;
    case "accept":
      return { type: "accept" };
    case "reject":
      return { type: "reject", text: typeof b.text === "string" ? b.text : undefined };
    case "walk_away":
      return { type: "walk_away" };
    default:
      return null;
  }
}

function trackAction(action: PlayerAction, sessionId: string) {
  switch (action.type) {
    case "message":
      track("message_sent", sessionId);
      break;
    case "offer":
      track("offer_made", sessionId);
      break;
    case "reject":
      track("offer_rejected", sessionId);
      break;
    case "walk_away":
      track("walk_away_selected", sessionId);
      break;
  }
}
