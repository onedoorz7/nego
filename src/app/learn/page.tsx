import Link from "next/link";
import { listLessons } from "@/lib/content/loader";
import { getLearningPath } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default function LearnPage() {
  const lessons = new Map(listLessons().map((l) => [l.id, l]));
  const path = getLearningPath();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Learning path</h1>
      <p className="mt-1 text-stone-600">
        One concept at a time, easy to advanced. Pass the quick check to unlock
        the next step — some steps end in a live negotiation.
      </p>
      <ol className="mt-6 space-y-3">
        {path.map((step, i) => {
          const lesson = lessons.get(step.lesson_id);
          if (!lesson) return null;
          const locked = !step.lesson_unlocked;
          return (
            <li key={step.lesson_id}>
              <Link
                href={locked ? "#" : `/learn/${lesson.id}`}
                aria-disabled={locked}
                className={`flex items-center gap-4 rounded-xl border bg-white p-4 transition ${
                  locked
                    ? "cursor-not-allowed border-stone-200 opacity-50"
                    : "border-stone-200 hover:border-indigo-300 hover:shadow-sm"
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xl">
                  {locked ? "🔒" : lesson.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Lesson {i + 1}
                  </div>
                  <div className="font-semibold">{lesson.title}</div>
                  {step.scenario_id && (
                    <div className="mt-0.5 text-xs text-indigo-600">
                      🎭 ends in a live negotiation
                    </div>
                  )}
                </div>
                <div className="text-right text-sm">
                  {step.lesson_done ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      ✓ done
                    </span>
                  ) : locked ? (
                    <span className="text-xs text-stone-400">locked</span>
                  ) : (
                    <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      start
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
