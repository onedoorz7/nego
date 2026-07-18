import { NextResponse } from "next/server";
import { dailyScenario, getDailyRecord, todayKey } from "@/lib/daily";

/** Today's table: which scenario, and whether this install already played. */
export async function GET() {
  const key = todayKey();
  const scenario = dailyScenario(key);
  const record = getDailyRecord(key);
  return NextResponse.json({
    key,
    scenario: {
      id: scenario.id,
      title: scenario.title,
      emoji: scenario.emoji,
      mode: scenario.mode,
      mission: scenario.arcade?.mission ?? scenario.tagline,
    },
    played: record?.finished ?? false,
    points: record?.points ?? null,
    session_id: record?.session_id ?? null,
  });
}
