import { NextRequest, NextResponse } from "next/server";
import { getLesson } from "@/lib/content/loader";
import { recordQuizResult } from "@/lib/progress";
import { track } from "@/lib/analytics";

/** Grade a quiz server-side (answer keys never reach the client). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let lesson;
  try {
    lesson = getLesson(id);
  } catch {
    return NextResponse.json({ error: "Unknown lesson" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const answers: unknown = body?.answers;
  if (!Array.isArray(answers) || answers.length !== lesson.quiz.length) {
    return NextResponse.json({ error: "Bad answers array" }, { status: 400 });
  }
  const results = lesson.quiz.map((q, i) => ({
    correct: Number(answers[i]) === q.answer_index,
    answer_index: q.answer_index,
    explanation: q.explanation,
  }));
  const score = results.filter((r) => r.correct).length;
  const passed = score === lesson.quiz.length;
  recordQuizResult(id, passed);
  track(passed ? "quiz_passed" : "quiz_failed", null, { lesson: id, score });
  if (passed) track("lesson_completed", null, { lesson: id });
  return NextResponse.json({ passed, score, total: lesson.quiz.length, results });
}
