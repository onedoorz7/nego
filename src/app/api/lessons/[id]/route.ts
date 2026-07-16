import { NextRequest, NextResponse } from "next/server";
import { getLesson } from "@/lib/content/loader";
import { track } from "@/lib/analytics";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const l = getLesson(id);
    track("lesson_started", null, { lesson: id });
    return NextResponse.json({
      lesson: {
        id: l.id,
        order: l.order,
        concept: l.concept,
        title: l.title,
        emoji: l.emoji,
        summary: l.summary,
        example: l.example,
        common_mistake: l.common_mistake,
        prep_question: l.prep_question,
        scenario_id: l.scenario_id,
        // Quiz WITHOUT answers — grading happens server-side.
        quiz: l.quiz.map((q) => ({ question: q.question, choices: q.choices })),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unknown lesson" }, { status: 404 });
  }
}
