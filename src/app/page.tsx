import Link from "next/link";
import { roundList, totalPoints } from "@/lib/progress";

export const dynamic = "force-dynamic";

export default function Home() {
  const rounds = roundList();
  const points = totalPoints();
  const current =
    rounds.find((r) => r.unlocked && r.best_points === 0) ??
    rounds.filter((r) => r.unlocked).at(-1) ??
    rounds[0];

  return (
    <div className="mx-auto max-w-md">
      {/* Score header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Ready to haggle?
        </h1>
        <div className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-700">
          🏆 {points.toLocaleString()} pts
        </div>
      </div>

      {/* Rounds */}
      <div className="mt-6 space-y-4">
        {rounds.map((r) => (
          <div
            key={r.id}
            className={`rounded-2xl border bg-white p-5 ${
              r.unlocked
                ? r.id === current.id
                  ? "border-indigo-300 shadow-md shadow-indigo-100"
                  : "border-stone-200"
                : "border-stone-200 opacity-55"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-stone-400">
                Round {r.round}
              </span>
              {r.best_points > 0 ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  best {r.best_points} pts
                </span>
              ) : r.attempts > 0 ? (
                <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-500">
                  no deal yet
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-4xl">{r.unlocked ? r.emoji : "🔒"}</span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight">{r.title}</h2>
                <p className="mt-0.5 text-sm leading-snug text-stone-600">
                  {r.unlocked ? r.mission : r.unlock_hint}
                </p>
              </div>
            </div>
            {r.unlocked && (
              <Link
                href={`/play/${r.id}`}
                className={`mt-4 block rounded-xl py-3 text-center text-base font-extrabold tracking-wide ${
                  r.id === current.id
                    ? "bg-indigo-600 text-white shadow-sm hover:bg-indigo-700"
                    : "border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                {r.attempts > 0
                  ? r.best_points > 0
                    ? `PLAY AGAIN — beat ${r.best_points}`
                    : "TRY AGAIN"
                  : "▶ PLAY"}
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-stone-400">
        Curious about the theory behind the game?{" "}
        <Link href="/learn" className="font-semibold text-indigo-500 hover:underline">
          Lessons →
        </Link>
      </p>
    </div>
  );
}
