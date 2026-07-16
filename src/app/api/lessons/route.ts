import { NextResponse } from "next/server";
import { listLessons } from "@/lib/content/loader";
import { getLearningPath } from "@/lib/progress";

export async function GET() {
  const lessons = listLessons().map((l) => ({
    id: l.id,
    order: l.order,
    concept: l.concept,
    title: l.title,
    emoji: l.emoji,
    scenario_id: l.scenario_id,
  }));
  return NextResponse.json({ lessons, path: getLearningPath() });
}
