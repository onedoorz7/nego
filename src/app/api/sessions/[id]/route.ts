import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import { loadSession } from "@/lib/db/sessions";
import { publicScenario, publicSession } from "@/lib/redact";
import { settleExpiry } from "@/lib/settle";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = loadSession(id);
  if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const scenario = getScenario(state.scenario_id);
  // Blitz: a page load after the deadline finalizes the round.
  settleExpiry(scenario, state);
  return NextResponse.json({
    session: publicSession(state, scenario),
    scenario: publicScenario(scenario),
  });
}
