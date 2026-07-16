import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import { loadSession } from "@/lib/db/sessions";
import { publicScenario, publicSession } from "@/lib/redact";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = loadSession(id);
  if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const scenario = getScenario(state.scenario_id);
  return NextResponse.json({
    session: publicSession(state, scenario),
    scenario: publicScenario(scenario),
  });
}
