import { NextResponse } from "next/server";
import { scenarioSummaries } from "@/lib/progress";

export async function GET() {
  return NextResponse.json({ scenarios: scenarioSummaries() });
}
