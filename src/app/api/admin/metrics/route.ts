import { NextResponse } from "next/server";
import { db } from "@/lib/db/db";

/** Derived metrics for the product hypothesis, computed on read. */
export async function GET() {
  const d = db();
  const sessions = d
    .prepare("SELECT status, state_json FROM sessions")
    .all() as { status: string; state_json: string }[];

  const finished = sessions.filter((s) =>
    ["agreement", "player_walked", "ai_walked", "turn_limit"].includes(s.status)
  );
  const started = sessions.filter((s) => s.status !== "preparing");
  const turns = finished.map((s) => JSON.parse(s.state_json).turn as number);

  const count = (type: string) =>
    (d.prepare("SELECT COUNT(*) c FROM events WHERE type = ?").get(type) as { c: number }).c;

  const evals = d
    .prepare("SELECT result_json FROM evaluations")
    .all() as { result_json: string }[];
  const totals = evals.map((e) => JSON.parse(e.result_json).total as number);

  const aiIssues = d
    .prepare(
      "SELECT COUNT(*) c FROM model_calls WHERE ok = 0"
    )
    .get() as { c: number };

  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

  return NextResponse.json({
    sessions_created: sessions.length,
    sessions_started: started.length,
    sessions_finished: finished.length,
    completion_rate: started.length
      ? Math.round((finished.length / started.length) * 100) / 100
      : null,
    agreement_rate: finished.length
      ? Math.round(
          (finished.filter((s) => s.status === "agreement").length / finished.length) * 100
        ) / 100
      : null,
    walk_away_rate: finished.length
      ? Math.round(
          (finished.filter((s) => s.status !== "agreement").length / finished.length) * 100
        ) / 100
      : null,
    avg_turns: avg(turns),
    avg_total_score: avg(totals),
    replays: count("scenario_replayed"),
    debriefs_viewed: count("debrief_viewed"),
    messages_sent: count("message_sent"),
    offers_made: count("offer_made"),
    ai_fallbacks: count("ai_fallback_used"),
    model_call_failures: aiIssues.c,
  });
}
