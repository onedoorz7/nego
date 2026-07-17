import { getLearningPath, getProgress, roundList, totalPoints } from "@/lib/progress";

export const dynamic = "force-dynamic";

const SKILL_LABELS: Record<string, string> = {
  personal: "Personal outcome",
  joint: "Joint value",
  discovery: "Information discovery",
  concessions: "Concession discipline",
  preparation: "Preparation",
  process: "Questions & process",
};

export default function ProgressPage() {
  const p = getProgress();
  const path = getLearningPath();
  const rounds = roundList();
  const lessonsDone = path.filter((s) => s.lesson_done).length;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">Your scores</h1>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Total points", value: totalPoints(p), emoji: "🏆" },
          {
            label: "Rounds played",
            value: Object.values(p.scenarios).reduce((s, x) => s + x.attempts, 0),
            emoji: "🎮",
          },
          { label: "Lessons read", value: `${lessonsDone}/${path.length}`, emoji: "📘" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-stone-200 bg-white p-4 text-center">
            <div className="text-2xl">{c.emoji}</div>
            <div className="mt-1 text-2xl font-extrabold">{c.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Skill profile
        </h2>
        {Object.keys(p.skills).length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">
            Play a scenario to start building your skill profile.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {Object.entries(p.skills).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between text-sm">
                  <span>{SKILL_LABELS[key] ?? key}</span>
                  <span className="font-bold">{value}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full ${
                      value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-stone-400">
          Rolling average of your recent games (recent games weigh more).
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Personal bests
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {rounds.map((r) => (
            <li key={r.id} className="flex items-center justify-between">
              <span>
                {r.emoji} Round {r.round}: {r.title}
              </span>
              <span className="font-semibold text-stone-700">
                {r.attempts > 0
                  ? `${r.best_points} pts · ${r.attempts} game${r.attempts > 1 ? "s" : ""}`
                  : r.unlocked
                    ? "not played"
                    : "🔒"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
