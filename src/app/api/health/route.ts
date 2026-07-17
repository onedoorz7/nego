import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

/** Ungated health check (excluded from the access-code proxy) so anyone —
 * including CI or the founder's agent — can verify which build is live. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    version: APP_VERSION,
    time: new Date().toISOString(),
  });
}
