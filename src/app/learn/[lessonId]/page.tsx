import { notFound } from "next/navigation";
import { getLesson } from "@/lib/content/loader";
import Md from "@/components/Md";
import QuizCard from "./QuizCard";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  let lesson;
  try {
    lesson = getLesson(lessonId);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{lesson.emoji}</span>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
      </div>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <Md text={lesson.summary} />
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
          Worked example
        </h2>
        <Md text={lesson.example} className="text-stone-700" />
      </section>

      <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-700">
          ⚠️ The common mistake
        </h2>
        <Md text={lesson.common_mistake} className="text-amber-900" />
      </section>

      <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-indigo-700">
          🤔 Before your next negotiation
        </h2>
        <Md text={lesson.prep_question} className="text-indigo-900" />
      </section>

      <QuizCard
        lessonId={lesson.id}
        scenarioId={lesson.scenario_id}
        quiz={lesson.quiz.map((q) => ({ question: q.question, choices: q.choices }))}
      />
    </div>
  );
}
