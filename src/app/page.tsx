import Link from "next/link";
import { labList, roundList, totalPoints } from "@/lib/progress";
import { dailyScenario, getDailyRecord } from "@/lib/daily";

export const dynamic = "force-dynamic";

const MODE_CHIP: Record<string, string> = {
  blitz: "⏱️ real-time",
  mystery: "🎰 hidden value",
  standard: "🎭 story table",
};

export default function Home() {
  const rounds = roundList();
  const labs = labList();
  const points = totalPoints();
  const daily = dailyScenario();
  const dailyRec = getDailyRecord();
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

      {/* Daily challenge — one table, one shot, same for everyone */}
      <div className="mt-5 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-amber-600">
            📅 Today&apos;s table · one shot
          </span>
          {dailyRec?.finished && (
            <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              {(dailyRec.points ?? 0) > 0 ? `+${dailyRec.points} pts` : "no deal"}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-4xl">{daily.emoji}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight">{daily.title}</h2>
            <p className="mt-0.5 text-sm leading-snug text-stone-600">
              Everyone plays the exact same game today. No retries — make it
              count.
            </p>
          </div>
        </div>
        {dailyRec?.finished ? (
          <Link
            href={`/play/session/${dailyRec.session_id}/result`}
            className="mt-4 block rounded-xl border border-amber-300 py-3 text-center text-base font-extrabold tracking-wide text-amber-700 hover:bg-amber-100"
          >
            ✓ PLAYED — see your result (new table at midnight)
          </Link>
        ) : dailyRec ? (
          <Link
            href={`/play/session/${dailyRec.session_id}`}
            className="mt-4 block rounded-xl bg-amber-500 py-3 text-center text-base font-extrabold tracking-wide text-white shadow-sm hover:bg-amber-600"
          >
            ⏳ RESUME TODAY&apos;S GAME
          </Link>
        ) : (
          <Link
            href="/play/daily"
            className="mt-4 block rounded-xl bg-amber-500 py-3 text-center text-base font-extrabold tracking-wide text-white shadow-sm hover:bg-amber-600"
          >
            ▶ PLAY TODAY&apos;S TABLE
          </Link>
        )}
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

      {/* The Lab — experimental tables with different rules */}
      {labs.length > 0 && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-violet-600">
              🧪 The Lab
            </h2>
            <span className="text-[11px] font-semibold text-stone-400">
              weird tables · new rules · always open
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {labs.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-700">
                    {l.mode === "blitz" && l.blitz_seconds
                      ? `⏱️ ${l.blitz_seconds}s real-time`
                      : MODE_CHIP[l.mode]}
                  </span>
                  {l.best_points !== 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        l.best_points > 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      best {l.best_points} pts
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-4xl">{l.emoji}</span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold leading-tight">{l.title}</h3>
                    <p className="mt-0.5 text-sm leading-snug text-stone-600">
                      {l.mission}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/play/${l.id}`}
                  className="mt-4 block rounded-xl bg-violet-600 py-3 text-center text-base font-extrabold tracking-wide text-white shadow-sm hover:bg-violet-700"
                >
                  {l.attempts > 0 ? "▶ PLAY AGAIN" : "▶ TRY IT"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-stone-400">
        Curious about the theory behind the game?{" "}
        <Link href="/learn" className="font-semibold text-indigo-500 hover:underline">
          Lessons →
        </Link>
      </p>
    </div>
  );
}
