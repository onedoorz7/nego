import { NextRequest, NextResponse } from "next/server";
import { listModelCalls, loadEvaluation, loadSession } from "@/lib/db/sessions";
import { db } from "@/lib/db/db";

/** Founder view: FULL session state (including AI internals), raw model
 * calls, evaluation, and analytics events. Local tool — no auth in MVP. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = loadSession(id);
  if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const events = db()
    .prepare("SELECT type, payload_json, created_at FROM events WHERE session_id = ? ORDER BY id ASC")
    .all(id);
  return NextResponse.json({
    state,
    evaluation: loadEvaluation(id),
    model_calls: listModelCalls(id),
    events,
  });
}
