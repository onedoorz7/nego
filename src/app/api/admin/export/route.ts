import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/db";

/** Export session data as JSON or CSV for offline analysis. */
export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const d = db();
  const sessions = d
    .prepare("SELECT id, scenario_id, status, created_at, updated_at, state_json FROM sessions ORDER BY created_at ASC")
    .all() as Record<string, unknown>[];
  const evaluations = d
    .prepare("SELECT session_id, result_json, coaching_json, created_at FROM evaluations")
    .all() as Record<string, unknown>[];
  const events = d
    .prepare("SELECT session_id, type, payload_json, created_at FROM events ORDER BY id ASC")
    .all() as Record<string, unknown>[];

  if (format === "csv") {
    const evalBySession = new Map(
      evaluations.map((e) => [e.session_id, JSON.parse(String(e.result_json))])
    );
    const header = [
      "session_id", "scenario_id", "status", "created_at", "turns",
      "total_score", "xp", "player_utility", "ai_utility", "deal_reached",
    ];
    const rows = sessions.map((s) => {
      const state = JSON.parse(String(s.state_json));
      const ev = evalBySession.get(s.id);
      return [
        s.id, s.scenario_id, s.status, s.created_at, state.turn,
        ev?.total ?? "", ev?.xp ?? "",
        state.outcome?.player_utility ?? "", state.outcome?.ai_utility ?? "",
        state.outcome?.type === "agreement" ? 1 : 0,
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(",");
    });
    return new NextResponse([header.join(","), ...rows].join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=nego-sessions.csv",
      },
    });
  }

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    sessions: sessions.map((s) => ({ ...s, state_json: JSON.parse(String(s.state_json)) })),
    evaluations: evaluations.map((e) => ({
      session_id: e.session_id,
      result: JSON.parse(String(e.result_json)),
      coaching: e.coaching_json ? JSON.parse(String(e.coaching_json)) : null,
    })),
    events: events.map((e) => ({ ...e, payload_json: JSON.parse(String(e.payload_json)) })),
  });
}
