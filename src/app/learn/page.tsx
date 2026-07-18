import Link from "next/link";
import { listLessons } from "@/lib/content/loader";
import { getLearningPath } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default function LearnPage() {
  const lessons = new Map(listLessons().map((l) => [l.id, l]));
  const path = getLearningPath();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-black text-white">The theory 📖 (optional)</h1>
      <p className="mt-1.5 font-medium text-stone-400">
        Everything here you can learn by just playing. But if you want the
        concepts behind the game — short reads, one idea each, easy to advanced.
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
                className={`panel anim-rise flex items-center gap-4 p-4 transition ${
                  locked
                    ? "cursor-not-allowed opacity-40"
                    : "hover:border-indigo-400/50 hover:bg-white/[0.07]"
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/25 to-sky-500/15 text-xl">
                  {locked ? "🔒" : lesson.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
                    Lesson {i + 1}
                  </div>
                  <div className="font-extrabold text-white">{lesson.title}</div>
                  {step.scenario_id && (
                    <div className="mt-0.5 text-xs font-bold text-indigo-400">
                      🎭 ends in a live negotiation
                    </div>
                  )}
                </div>
                <div className="text-right text-sm">
                  {step.lesson_done ? (
                    <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-black text-emerald-300">
                      ✓ done
                    </span>
                  ) : locked ? (
                    <span className="text-xs font-bold text-stone-500">locked</span>
                  ) : (
                    <span className="rounded-full bg-indigo-400/15 px-2.5 py-1 text-xs font-black text-indigo-300">
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
