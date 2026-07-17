import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { getProvider } from "@/lib/llm/anthropic";
import { db } from "@/lib/db/db";

/** Ungated health check (excluded from the access-code proxy).
 * Reports the live version AND which dialogue provider is active — if this
 * says "mock", the opponent is speaking canned lines (set ANTHROPIC_API_KEY). */
export async function GET() {
  let dialogue_quality = { fallbacks: 0, failures: 0 };
  try {
    const row = db()
      .prepare(
        "SELECT SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) f, COUNT(*) c FROM model_calls WHERE id > (SELECT COALESCE(MAX(id),0) - 100 FROM model_calls)"
      )
      .get() as { f: number | null; c: number };
    dialogue_quality = { fallbacks: row.f ?? 0, failures: row.f ?? 0 };
  } catch {
    // health must never fail
  }
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    provider: getProvider().name,
    recent_model_call_failures: dialogue_quality.failures,
    time: new Date().toISOString(),
  });
}
