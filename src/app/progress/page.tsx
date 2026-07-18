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
      <h1 className="text-2xl font-black text-white">Your scores 🏅</h1>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: "Total points", value: totalPoints(p), emoji: "🪙", gold: true },
          {
            label: "Rounds played",
            value: Object.values(p.scenarios).reduce((s, x) => s + x.attempts, 0),
            emoji: "🎮",
          },
          { label: "Lessons read", value: `${lessonsDone}/${path.length}`, emoji: "📘" },
        ].map((c, i) => (
          <div
            key={c.label}
            className={`panel anim-rise p-4 text-center ${c.gold ? "panel-glow-amber" : ""}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="text-2xl">{c.emoji}</div>
            <div
              className={`mt-1 text-2xl font-black tabular-nums ${
                c.gold ? "text-amber-300" : "text-white"
              }`}
            >
              {c.value}
            </div>
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-500">
              {c.label}
            </div>
          </div>
        ))}
      </div>

      <section className="panel anim-rise mt-6 p-6" style={{ animationDelay: "180ms" }}>
        <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
          Skill profile
        </h2>
        {Object.keys(p.skills).length === 0 ? (
          <p className="mt-2 text-sm font-medium text-stone-500">
            Play a round to start building your skill profile.
          </p>
        ) : (
          <div className="mt-4 space-y-3.5">
            {Object.entries(p.skills).map(([key, value]) => (
              <div key={key}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-stone-300">
                    {SKILL_LABELS[key] ?? key}
                  </span>
                  <span className="font-black tabular-nums text-white">{value}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${
                      value >= 70
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : value >= 40
                          ? "bg-gradient-to-r from-amber-500 to-amber-400"
                          : "bg-gradient-to-r from-rose-500 to-rose-400"
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs font-medium text-stone-500">
          Rolling average of your recent games (recent games weigh more).
        </p>
      </section>

      <section className="panel anim-rise mt-4 p-6" style={{ animationDelay: "240ms" }}>
        <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
          Personal bests
        </h2>
        <ul className="mt-3 space-y-2.5 text-sm">
          {rounds.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3">
              <span className="font-semibold text-stone-300">
                {r.emoji} Round {r.round}: {r.title}
              </span>
              <span
                className={`shrink-0 font-black tabular-nums ${
                  r.attempts > 0 && r.best_points > 0
                    ? "text-amber-300"
                    : "text-stone-500"
                }`}
              >
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
