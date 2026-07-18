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
        <h1 className="text-2xl font-black text-white">{lesson.title}</h1>
      </div>

      <section className="panel anim-rise mt-6 p-6 text-stone-300">
        <Md text={lesson.summary} />
      </section>

      <section
        className="panel anim-rise mt-4 p-6"
        style={{ animationDelay: "60ms" }}
      >
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
          Worked example
        </h2>
        <Md text={lesson.example} className="text-stone-300" />
      </section>

      <section
        className="panel anim-rise mt-4 border-amber-400/25 bg-amber-400/8 p-6"
        style={{ animationDelay: "120ms" }}
      >
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-amber-300">
          ⚠️ The common mistake
        </h2>
        <Md text={lesson.common_mistake} className="text-amber-100/90" />
      </section>

      <section
        className="panel anim-rise mt-4 border-indigo-400/25 bg-indigo-400/8 p-6"
        style={{ animationDelay: "180ms" }}
      >
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-indigo-300">
          🤔 Before your next negotiation
        </h2>
        <Md text={lesson.prep_question} className="text-indigo-100/90" />
      </section>

      <QuizCard
        lessonId={lesson.id}
        scenarioId={lesson.scenario_id}
        quiz={lesson.quiz.map((q) => ({ question: q.question, choices: q.choices }))}
      />
    </div>
  );
}
