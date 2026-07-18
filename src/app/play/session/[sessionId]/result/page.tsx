"use client";

import { useEffect, useState } from "react";
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

  if (error) return <p className="text-center text-rose-600">{error}</p>;
  if (!d) return <p className="text-center text-stone-500">Counting your points…</p>;

  const arcade = d.evaluation.arcade;
  const deal = d.evaluation.analysis.deal_reached;
  const points = arcade?.points ?? 0;
  const mystery = arcade?.mystery ?? null;
  const tier = mystery ? TIER_LABEL[mystery.tier] : null;
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
      {/* The verdict */}
      <div
        className={`rounded-3xl border-2 p-6 text-center ${
          deal
            ? points < 0
              ? "border-rose-300 bg-rose-50"
              : "border-emerald-300 bg-emerald-50"
            : "border-stone-300 bg-stone-100"
        }`}
      >
        <div className="text-5xl">{deal ? (mystery ? "📦" : "🤝") : "💔"}</div>
        <h1 className="mt-2 text-2xl font-extrabold">
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
          <div className="mx-auto mt-3 max-w-xs rounded-xl border border-violet-200 bg-white/80 p-3 text-sm">
            <p className="italic text-stone-600">{mystery.reveal_text}</p>
            {!revealed ? (
              <div className="mt-2 animate-pulse text-3xl">📦 …</div>
            ) : (
              <p className="mt-2 font-bold text-stone-800">
                {tier?.emoji} Inside: {tier?.line} — worth ${mystery.value}
                {mystery.price_paid !== null && (
                  <span className="block text-xs font-semibold text-stone-500">
                    you paid ${mystery.price_paid}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        <div
          className={`mt-3 text-6xl font-black ${
            !revealed
              ? "text-stone-300"
              : deal
                ? points < 0
                  ? "text-rose-600"
                  : "text-emerald-600"
                : "text-stone-400"
          }`}
        >
          {!revealed ? "?" : points > 0 ? `+${points}` : `${points}`}
        </div>
        <div className="text-sm font-bold uppercase tracking-widest text-stone-400">
          points
        </div>

        {/* Points breakdown */}
        {arcade && arcade.breakdown.length > 0 && deal && revealed && (
          <div className="mx-auto mt-4 max-w-xs space-y-1 text-left text-sm">
            {arcade.breakdown.map((b, i) => (
              <div key={i} className="flex items-baseline justify-between">
                <span className="text-stone-600">
                  {b.label}
                  <span className="ml-1 text-xs text-stone-400">({b.detail})</span>
                </span>
                <span className={`font-bold ${b.points < 0 ? "text-rose-500" : ""}`}>
                  {b.points > 0 ? `+${b.points}` : b.points}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No-deal sting + hook */}
        {!deal && mystery && (
          <p className="mx-auto mt-3 max-w-xs text-sm font-semibold text-stone-600">
            {mystery.tier === "low"
              ? `Good instincts — inside was ${tier?.line}, worth just $${mystery.value}. 🕵️`
              : `You passed… and inside was ${tier?.line} worth $${mystery.value}. ${
                  mystery.tier === "high" ? "Ouch." : ""
                }`}
          </p>
        )}
        {!deal && !mystery && (
          <p className="mx-auto mt-3 max-w-xs text-sm text-stone-600">
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
          <p className="mt-3 text-sm font-semibold text-indigo-600">
            A perfect round was worth {arcade.best_possible} pts — can you find
            the missing {arcade.best_possible - points}?
          </p>
        )}
      </div>

      {/* Secrets */}
      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">
            🔎 Their secrets: {foundSecrets.length}/{d.role_reveal.hidden_info.length} uncovered
          </h2>
          {missedSecrets.length > 0 && (
            <button
              onClick={() => setShowSecrets((s) => !s)}
              className="text-xs font-semibold text-indigo-600 hover:underline"
            >
              {showSecrets ? "hide" : "reveal them"}
            </button>
          )}
        </div>
        {foundSecrets.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {foundSecrets.map((h) => (
              <li key={h.id} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                🔓 {h.fact}
              </li>
            ))}
          </ul>
        )}
        {missedSecrets.length > 0 && !showSecrets && (
          <p className="mt-2 text-xs text-stone-500">
            {missedSecrets.length} secret{missedSecrets.length > 1 ? "s" : ""} slipped
            past you — each one was worth money. Ask more questions next time… or
            peek now.
          </p>
        )}
        {showSecrets && (
          <ul className="mt-2 space-y-1.5">
            {missedSecrets.map((h) => (
              <li key={h.id} className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-600">
                🔒 {h.fact}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* One tip, one optional lesson */}
      {tip && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          💡 <span className="font-semibold">Next time:</span> {tip}
          {lessonId && (
            <Link
              href={`/learn/${lessonId}`}
              className="ml-1 whitespace-nowrap font-semibold text-indigo-600 hover:underline"
            >
              2-min read →
            </Link>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 space-y-2">
        <Link
          href={`/play/${d.scenario.id}`}
          className="block rounded-xl bg-indigo-600 py-3.5 text-center text-base font-extrabold text-white shadow-sm hover:bg-indigo-700"
        >
          🔁 PLAY AGAIN{points > 0 ? ` — beat ${points}` : ""}
        </Link>
        <Link
          href="/"
          className="block rounded-xl border border-stone-300 bg-white py-3 text-center font-bold text-stone-700 hover:bg-stone-100"
        >
          All rounds
        </Link>
        <Link
          href={`/play/session/${sessionId}/debrief`}
          className="block py-1 text-center text-xs font-semibold text-stone-400 hover:text-indigo-600"
        >
          Full analysis & coaching →
        </Link>
      </div>
    </div>
  );
}
