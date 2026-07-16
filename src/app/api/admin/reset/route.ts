import { NextRequest, NextResponse } from "next/server";
import { resetProgress } from "@/lib/progress";
import { db } from "@/lib/db/db";

/** Founder tool: reset progress, optionally wipe all session data. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  resetProgress();
  if (body?.wipe === "all") {
    const d = db();
    d.exec("DELETE FROM sessions; DELETE FROM events; DELETE FROM model_calls; DELETE FROM evaluations;");
  }
  return NextResponse.json({ ok: true });
}
