import Link from "next/link";
import { scenarioSummaries } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default function PlayPage() {
  const scenarios = scenarioSummaries();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Scenarios</h1>
      <p className="mt-1 text-stone-600">
        Live negotiations against an AI counterpart with private information and
        a real bottom line. Every replay is a different game.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {scenarios.map((s) => (
          <div
            key={s.id}
            className={`flex flex-col rounded-xl border bg-white p-5 ${
              s.unlocked ? "border-stone-200" : "border-stone-200 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between">
              <span className="text-3xl">{s.unlocked ? s.emoji : "🔒"}</span>
              <span className="text-xs font-semibold text-stone-500">
                {"★".repeat(s.difficulty)}
                {"☆".repeat(3 - Math.min(3, s.difficulty))} difficulty
              </span>
            </div>
            <h2 className="mt-2 font-bold">{s.title}</h2>
            <p className="mt-1 flex-1 text-sm text-stone-600">{s.tagline}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {s.concepts.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
                >
                  {c.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-stone-500">
                {s.attempts > 0
                  ? `best ${s.best_total}/100 · ${s.attempts} attempt${s.attempts > 1 ? "s" : ""}`
                  : "not played yet"}
              </div>
              {s.unlocked ? (
                <Link
                  href={`/play/${s.id}/prepare`}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  {s.attempts > 0 ? "Replay" : "Play"}
                </Link>
              ) : (
                <span className="text-xs text-stone-400">
                  unlock via the learning path
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-stone-400">
        Tip for the founder: set NEGO_UNLOCK_ALL=1 to unlock everything for testing.
      </p>
    </div>
  );
}
