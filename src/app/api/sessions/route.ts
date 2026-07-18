import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import { createSession, submitPrep } from "@/lib/engine/session";
import { loadSession, saveSession } from "@/lib/db/sessions";
import { publicScenario, publicSession } from "@/lib/redact";
import { isScenarioUnlocked, getProgress } from "@/lib/progress";
import { dailyScenario, dailySeed, getDailyRecord, setDailyRecord } from "@/lib/daily";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  // ---- Daily challenge: same table + same seed for everyone, one attempt ---
  if (body?.daily === true) {
    const scenario = dailyScenario();
    const record = getDailyRecord();
    if (record) {
      const existing = loadSession(record.session_id);
      if (record.finished || existing?.outcome) {
        return NextResponse.json(
          { error: "You've already played today's table — a new one opens at midnight UTC.", session_id: record.session_id },
          { status: 409 }
        );
      }
      if (existing) {
        // Resume the unfinished attempt instead of granting a fresh one.
        return NextResponse.json({
          session: publicSession(existing, scenario),
          scenario: publicScenario(scenario),
        });
      }
    }
    let state = createSession(scenario, dailySeed(), { is_daily: true });
    state = submitPrep(state, {});
    saveSession(state);
    setDailyRecord({ session_id: state.id, finished: false, points: null });
    track("daily_started", state.id, { scenario: scenario.id, seed: state.seed });
    return NextResponse.json({
      session: publicSession(state, scenario),
      scenario: publicScenario(scenario),
    });
  }

  // ---- Regular round / lab table -------------------------------------------
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
  let state = createSession(scenario, seed);
  // Game-first flow: play starts immediately; prep is an opt-in extra
  // (POST with_prep: true to get a session waiting on /prep).
  if (!body?.with_prep) state = submitPrep(state, {});
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
