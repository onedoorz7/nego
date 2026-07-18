import Link from "next/link";
import { labList, roundList, totalPoints } from "@/lib/progress";
import { dailyScenario, getDailyRecord } from "@/lib/daily";

export const dynamic = "force-dynamic";

const MODE_CHIP: Record<string, string> = {
  blitz: "⏱️ real-time",
  mystery: "🎰 hidden value",
  standard: "🎭 story table",
};

/** Emoji tile backdrops, rotating per round. */
const TILE_GRADIENTS = [
  "from-indigo-500/40 to-sky-500/25",
  "from-emerald-500/35 to-teal-500/25",
  "from-amber-500/35 to-orange-500/25",
  "from-rose-500/35 to-pink-500/25",
  "from-cyan-500/35 to-blue-500/25",
];

function EmojiTile({ emoji, gradient }: { emoji: string; gradient: string }) {
  return (
    <span
      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br text-4xl ${gradient}`}
    >
      {emoji}
    </span>
  );
}

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
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-3xl font-black tracking-tight text-white">
          Ready to
          <br />
          haggle? <span className="inline-block">🃏</span>
        </h1>
        <div className="flex items-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5">
          <span className="text-2xl">🪙</span>
          <div className="leading-tight">
            <div className="text-xl font-black tabular-nums text-amber-300">
              {points.toLocaleString()}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/60">
              points
            </div>
          </div>
        </div>
      </div>

      {/* Daily challenge — one table, one shot, same for everyone */}
      <div className="panel panel-glow-amber shimmer-border anim-rise mt-6 p-5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
            📅 Today&apos;s table · one shot
          </span>
          {dailyRec?.finished && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                (dailyRec.points ?? 0) > 0
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-white/10 text-stone-400"
              }`}
            >
              {(dailyRec.points ?? 0) > 0 ? `+${dailyRec.points} pts` : "no deal"}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-4">
          <span className="anim-float text-5xl drop-shadow-[0_6px_16px_rgba(245,158,11,0.35)]">
            {daily.emoji}
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-black leading-tight text-white">
              {daily.title}
            </h2>
            <p className="mt-1 text-sm font-medium leading-snug text-stone-400">
              Everyone gets the exact same game today. No retries — make it
              count.
            </p>
          </div>
        </div>
        {dailyRec?.finished ? (
          <Link
            href={`/play/session/${dailyRec.session_id}/result`}
            className="btn3d btn3d-ghost mt-4 py-3 text-sm"
          >
            ✓ PLAYED — see your result · new table at midnight
          </Link>
        ) : dailyRec ? (
          <Link
            href={`/play/session/${dailyRec.session_id}`}
            className="btn3d btn3d-amber mt-4 py-3.5 text-base"
          >
            ⏳ RESUME TODAY&apos;S GAME
          </Link>
        ) : (
          <Link href="/play/daily" className="btn3d btn3d-amber mt-4 py-3.5 text-base">
            ▶ PLAY TODAY&apos;S TABLE
          </Link>
        )}
      </div>

      {/* Rounds ladder */}
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.18em] text-indigo-300">
          🪜 The ladder
        </h2>
        <span className="text-[11px] font-semibold text-stone-500">
          close a deal to unlock the next
        </span>
      </div>
      <div className="mt-3 space-y-4">
        {rounds.map((r, i) => (
          <div
            key={r.id}
            className={`panel anim-rise p-5 ${
              r.unlocked
                ? r.id === current.id
                  ? "panel-glow-indigo"
                  : ""
                : "opacity-45 saturate-50"
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">
                Round {r.round}
              </span>
              {r.best_points > 0 ? (
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-xs font-black text-emerald-300">
                  best {r.best_points} pts
                </span>
              ) : r.attempts > 0 ? (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-stone-400">
                  no deal yet
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center gap-4">
              <EmojiTile
                emoji={r.unlocked ? r.emoji : "🔒"}
                gradient={
                  r.unlocked
                    ? TILE_GRADIENTS[i % TILE_GRADIENTS.length]
                    : "from-white/5 to-white/5"
                }
              />
              <div className="min-w-0">
                <h3 className="text-lg font-black leading-tight text-white">
                  {r.title}
                </h3>
                <p className="mt-1 text-sm font-medium leading-snug text-stone-400">
                  {r.unlocked ? r.mission : r.unlock_hint}
                </p>
              </div>
            </div>
            {r.unlocked && (
              <Link
                href={`/play/${r.id}`}
                className={`mt-4 py-3.5 text-base ${
                  r.id === current.id ? "btn3d btn3d-indigo" : "btn3d btn3d-ghost"
                }`}
              >
                {r.attempts > 0
                  ? r.best_points > 0
                    ? `PLAY AGAIN — BEAT ${r.best_points}`
                    : "TRY AGAIN"
                  : "▶ PLAY"}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* The Lab — experimental tables with different rules */}
      {labs.length > 0 && (
        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-violet-300">
              🧪 The Lab
            </h2>
            <span className="text-[11px] font-semibold text-stone-500">
              weird tables · new rules · always open
            </span>
          </div>
          <div className="mt-3 space-y-4">
            {labs.map((l, i) => (
              <div
                key={l.id}
                className="panel panel-glow-violet anim-rise p-5"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-violet-300">
                    {l.mode === "blitz" && l.blitz_seconds
                      ? `⏱️ ${l.blitz_seconds}s real-time`
                      : MODE_CHIP[l.mode]}
                  </span>
                  {l.best_points !== 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                        l.best_points > 0
                          ? "bg-emerald-400/15 text-emerald-300"
                          : "bg-rose-400/15 text-rose-300"
                      }`}
                    >
                      best {l.best_points} pts
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <EmojiTile
                    emoji={l.emoji}
                    gradient="from-violet-500/40 to-fuchsia-500/25"
                  />
                  <div className="min-w-0">
                    <h3 className="text-lg font-black leading-tight text-white">
                      {l.title}
                    </h3>
                    <p className="mt-1 text-sm font-medium leading-snug text-stone-400">
                      {l.mission}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/play/${l.id}`}
                  className="btn3d btn3d-violet mt-4 py-3.5 text-base"
                >
                  {l.attempts > 0 ? "▶ PLAY AGAIN" : "▶ TRY IT"}
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-xs font-semibold text-stone-500">
        Curious about the theory behind the game?{" "}
        <Link
          href="/learn"
          className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
        >
          Lessons →
        </Link>
      </p>
    </div>
  );
}
