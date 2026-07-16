import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import { createSession } from "@/lib/engine/session";
import { saveSession } from "@/lib/db/sessions";
import { publicScenario, publicSession } from "@/lib/redact";
import { isScenarioUnlocked, getProgress } from "@/lib/progress";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const scenarioId = String(body?.scenario_id ?? "");
  let scenario;
  try {
    scenario = getScenario(scenarioId);
  } catch {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 404 });
  }
  if (!isScenarioUnlocked(scenarioId)) {
    return NextResponse.json({ error: "Scenario locked" }, { status: 403 });
  }
  // Founder tool: pass a seed to reproduce an exact game.
  const seed = Number.isFinite(Number(body?.seed)) ? Number(body.seed) : undefined;
  const state = createSession(scenario, seed);
  saveSession(state);

  const replay = (getProgress().scenarios[scenarioId]?.attempts ?? 0) > 0;
  track(replay ? "scenario_replayed" : "scenario_started", state.id, {
    scenario: scenarioId,
    seed: state.seed,
  });

  return NextResponse.json({
    session: publicSession(state, scenario),
    scenario: publicScenario(scenario),
  });
}
