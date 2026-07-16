import { NextRequest, NextResponse } from "next/server";
import { getScenario } from "@/lib/content/loader";
import { loadSession, saveSession } from "@/lib/db/sessions";
import { submitPrep, UserError } from "@/lib/engine/session";
import { publicSession } from "@/lib/redact";
import { track } from "@/lib/analytics";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = loadSession(id);
  if (!state) return NextResponse.json({ error: "Unknown session" }, { status: 404 });
  const scenario = getScenario(state.scenario_id);

  const body = await req.json().catch(() => null);
  const answers = body?.answers;
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Missing answers" }, { status: 400 });
  }
  // Only accept fields defined by the scenario; clip lengths.
  const clean: Record<string, string | number> = {};
  for (const f of scenario.preparation) {
    const v = (answers as Record<string, unknown>)[f.id];
    if (v === undefined || v === null || v === "") continue;
    clean[f.id] = f.kind === "number" ? Number(v) : String(v).slice(0, 2000);
  }

  try {
    const next = submitPrep(state, clean);
    saveSession(next);
    track("preparation_completed", id, { fields: Object.keys(clean).length });
    return NextResponse.json({ session: publicSession(next, scenario) });
  } catch (e) {
    if (e instanceof UserError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
