"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface ResultData {
  evaluation: {
    arcade: {
      points: number;
      breakdown: { label: string; points: number; detail: string }[];
      best_possible: number;
      mystery?: {
        value: number;
        tier: "low" | "mid" | "high";
        reveal_text: string;
        price_paid: number | null;
      };
    } | null;
    analysis: {
      deal_reached: boolean;
      final_offer: Record<string, number | string> | null;
      zopa_existed: boolean;
      walk_was_reasonable: boolean | null;
    };
  };
  coaching: { missed_opportunities: string[]; concept_to_review: string };
  role_reveal: {
    name: string;
    hidden_info: { id: string; fact: string; discovered: boolean }[];
    floor_on_primary: number | string | null;
  };
  outcome: { type: string };
  turn_count: number;
  scenario: {
    id: string;
    title: string;
    concepts: string[];
    offer_fields: {
      key: string; label: string; type: string; unit?: string;
      options?: { value: string; label: string }[];
    }[];
  };
}

const CONCEPT_LESSONS: Record<string, string> = {
  interests_vs_positions: "01-interests-vs-positions",
  batna: "02-batna",
  reservation_point: "03-reservation-point",
  zopa: "04-zopa",
  targets_and_openings: "05-targets-and-openings",
  anchoring: "06-anchoring",
  concessions: "07-concessions",
  diagnostic_questions: "08-diagnostic-questions",
  multi_issue_tradeoffs: "09-multi-issue-tradeoffs",
  package_offers: "09-multi-issue-tradeoffs",
  objective_criteria: "05-targets-and-openings",
  walking_away: "10-walking-away",
};

const TIER_LABEL: Record<string, { emoji: string; line: string }> = {
  low: { emoji: "🕸️", line: "dusty junk" },
  mid: { emoji: "🪑", line: "a decent haul" },
  high: { emoji: "💎", line: "a collector's trove" },
};

const CONFETTI_COLORS = ["#fbbf24", "#34d399", "#818cf8", "#f472b6", "#38bdf8", "#fb7185"];

/** Deterministic pseudo-random confetti (no hydration mismatch). */
function Confetti() {
  return (
    <div aria-hidden>
      {Array.from({ length: 42 }, (_, i) => {
        const left = (i * 37 + 13) % 100;
        const delay = ((i * 53) % 140) / 100;
        const duration = 2.4 + ((i * 29) % 120) / 100;
        return (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${left}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `scale(${0.7 + ((i * 17) % 60) / 100})`,
            }}
          />
        );
      })}
    </div>
  );
}

/** Counts 0 → target with an ease-out once `go` flips true. */
function useCountUp(target: number, go: boolean, ms = 900): number {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!go) return;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, go, ms]);
  return value;
}

export default function ResultPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [d, setD] = useState<ResultData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/debrief`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not load the result"); return; }
      setD(data);
      // Mystery: hold the number back for a beat — let the lock get cut.
      if (data.evaluation?.arcade?.mystery) setTimeout(() => setRevealed(true), 1800);
      else setRevealed(true);
    })();
  }, [sessionId]);

  const points = d?.evaluation.arcade?.points ?? 0;
  const shownPoints = useCountUp(points, revealed && !!d);

  if (error) return <p className="text-center font-bold text-rose-400">{error}</p>;
  if (!d) {
    return (
      <div className="pt-16 text-center">
        <div className="anim-jiggle inline-block text-5xl">🥁</div>
        <p className="mt-3 font-bold text-stone-400">Counting your points…</p>
      </div>
    );
  }

  const arcade = d.evaluation.arcade;
  const deal = d.evaluation.analysis.deal_reached;
  const mystery = arcade?.mystery ?? null;
  const tier = mystery ? TIER_LABEL[mystery.tier] : null;
  const win = deal && points > 0;
  const missedSecrets = d.role_reveal.hidden_info.filter((h) => !h.discovered);
  const foundSecrets = d.role_reveal.hidden_info.filter((h) => h.discovered);
  const primaryField = d.scenario.offer_fields[0];
  const floor = d.role_reveal.floor_on_primary;
  const floorLabel =
    typeof floor === "number" && primaryField?.unit === "$"
      ? `$${floor.toLocaleString()}`
      : floor !== null
        ? String(floor)
        : null;
  const tip = d.coaching.missed_opportunities[0];
  const lessonId = CONCEPT_LESSONS[d.coaching.concept_to_review];

  return (
    <div className="mx-auto max-w-md pb-10">
      {win && revealed && <Confetti />}

      {/* The verdict */}
      <div
        className={`panel anim-pop p-6 text-center ${
          deal
            ? points < 0
              ? "panel-glow-rose"
              : "panel-glow-emerald"
            : ""
        }`}
      >
        <div className={`text-6xl ${mystery && deal && !revealed ? "anim-jiggle" : "anim-float"}`}>
          {deal ? (mystery ? "📦" : "🤝") : "💔"}
        </div>
        <h1
          className={`anim-stamp mt-3 inline-block text-3xl font-black tracking-tight ${
            deal
              ? points < 0
                ? "text-rose-400"
                : "text-emerald-400"
              : "text-stone-300"
          }`}
        >
          {deal
            ? mystery
              ? "SOLD!"
              : "DEAL!"
            : d.outcome.type === "player_walked"
              ? "You walked away"
              : d.outcome.type === "ai_walked"
                ? "They walked out!"
                : "Time ran out"}
        </h1>

        {/* Mystery: the lock gets cut before the number lands */}
        {mystery && deal && (
          <div className="mx-auto mt-3 max-w-xs rounded-xl border border-violet-400/25 bg-violet-400/8 p-3.5 text-sm">
            <p className="font-semibold italic text-stone-400">{mystery.reveal_text}</p>
            {!revealed ? (
              <div className="mt-2 animate-pulse text-3xl">📦 …</div>
            ) : (
              <p className="anim-reveal mt-2 font-extrabold text-white">
                {tier?.emoji} Inside: {tier?.line} — worth ${mystery.value}
                {mystery.price_paid !== null && (
                  <span className="mt-0.5 block text-xs font-bold text-stone-500">
                    you paid ${mystery.price_paid}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        <div
          className={`mt-3 text-7xl font-black tabular-nums ${
            !revealed
              ? "text-stone-600"
              : deal
                ? points < 0
                  ? "text-rose-400"
                  : "text-emerald-400 drop-shadow-[0_0_24px_rgba(16,185,129,0.4)]"
                : "text-stone-500"
          }`}
        >
          {!revealed ? "?" : shownPoints > 0 ? `+${shownPoints}` : `${shownPoints}`}
        </div>
        <div className="text-sm font-black uppercase tracking-[0.25em] text-stone-500">
          points
        </div>

        {/* Points breakdown */}
        {arcade && arcade.breakdown.length > 0 && deal && revealed && (
          <div className="mx-auto mt-5 max-w-xs space-y-1.5 text-left text-sm">
            {arcade.breakdown.map((b, i) => (
              <div
                key={i}
                className="anim-rise flex items-baseline justify-between"
                style={{ animationDelay: `${300 + i * 140}ms` }}
              >
                <span className="font-semibold text-stone-400">
                  {b.label}
                  <span className="ml-1 text-xs font-medium text-stone-600">
                    ({b.detail})
                  </span>
                </span>
                <span
                  className={`font-black tabular-nums ${
                    b.points < 0 ? "text-rose-400" : "text-emerald-300"
                  }`}
                >
                  {b.points > 0 ? `+${b.points}` : b.points}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No-deal sting + hook */}
        {!deal && mystery && (
          <p className="mx-auto mt-3 max-w-xs text-sm font-bold text-stone-300">
            {mystery.tier === "low"
              ? `Good instincts — inside was ${tier?.line}, worth just $${mystery.value}. 🕵️`
              : `You passed… and inside was ${tier?.line} worth $${mystery.value}. ${
                  mystery.tier === "high" ? "Ouch." : ""
                }`}
          </p>
        )}
        {!deal && !mystery && (
          <p className="mx-auto mt-3 max-w-xs text-sm font-semibold text-stone-400">
            {d.outcome.type === "player_walked" &&
            d.evaluation.analysis.walk_was_reasonable === false &&
            floorLabel
              ? `Ouch — ${d.role_reveal.name} would have gone as low as ~${floorLabel}. A deal was there.`
              : floorLabel
                ? `For the record: their true limit was around ${floorLabel}.`
                : "No deal this round — no points."}
          </p>
        )}

        {/* Best-possible tease */}
        {arcade && revealed && arcade.best_possible > points && (
          <p className="anim-rise mt-4 text-sm font-extrabold text-indigo-300" style={{ animationDelay: "700ms" }}>
            A perfect round was worth {arcade.best_possible} pts — can you find
            the missing {arcade.best_possible - points}?
          </p>
        )}
      </div>

      {/* Secrets */}
      <div className="panel anim-rise mt-4 p-5" style={{ animationDelay: "150ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-stone-200">
            🔎 Their secrets:{" "}
            <span className={foundSecrets.length > 0 ? "text-emerald-400" : "text-stone-400"}>
              {foundSecrets.length}/{d.role_reveal.hidden_info.length}
            </span>{" "}
            uncovered
          </h2>
          {missedSecrets.length > 0 && (
            <button
              onClick={() => setShowSecrets((s) => !s)}
              className="text-xs font-extrabold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              {showSecrets ? "hide" : "reveal them"}
            </button>
          )}
        </div>
        {foundSecrets.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {foundSecrets.map((h) => (
              <li
                key={h.id}
                className="rounded-lg border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-xs font-semibold text-emerald-100/90"
              >
                🔓 {h.fact}
              </li>
            ))}
          </ul>
        )}
        {missedSecrets.length > 0 && !showSecrets && (
          <p className="mt-2 text-xs font-semibold text-stone-500">
            {missedSecrets.length} secret{missedSecrets.length > 1 ? "s" : ""} slipped
            past you — each one was worth money. Ask more questions next time… or
            peek now.
          </p>
        )}
        {showSecrets && (
          <ul className="mt-2 space-y-1.5">
            {missedSecrets.map((h) => (
              <li
                key={h.id}
                className="anim-pop rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-stone-400"
              >
                🔒 {h.fact}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* One tip, one optional lesson */}
      {tip && (
        <div
          className="panel anim-rise mt-4 border-amber-400/25 bg-amber-400/8 p-4 text-sm font-medium text-amber-100/90"
          style={{ animationDelay: "250ms" }}
        >
          💡 <span className="font-extrabold">Next time:</span> {tip}
          {lessonId && (
            <Link
              href={`/learn/${lessonId}`}
              className="ml-1 whitespace-nowrap font-extrabold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              2-min read →
            </Link>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="anim-rise mt-5 space-y-2.5" style={{ animationDelay: "350ms" }}>
        <Link
          href={`/play/${d.scenario.id}`}
          className="btn3d btn3d-indigo py-4 text-base"
        >
          🔁 PLAY AGAIN{points > 0 ? ` — BEAT ${points}` : ""}
        </Link>
        <Link href="/" className="btn3d btn3d-ghost py-3 text-sm">
          All tables
        </Link>
        <Link
          href={`/play/session/${sessionId}/debrief`}
          className="block py-1 text-center text-xs font-bold text-stone-500 transition hover:text-indigo-400"
        >
          Full analysis & coaching →
        </Link>
      </div>
    </div>
  );
}
