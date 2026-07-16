import { NextResponse } from "next/server";
import { listSessions } from "@/lib/db/sessions";

export async function GET() {
  return NextResponse.json({ sessions: listSessions() });
}
