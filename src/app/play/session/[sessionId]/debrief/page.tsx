"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Md from "@/components/Md";

interface ScoreItem {
  key: string; label: string; value: number;
  basis: "objective" | "rule_based"; explanation: string;
}
interface Debrief {
  evaluation: {
    total: number;
    xp: number;
    scores: ScoreItem[];
    observations: { kind: "strength" | "opportunity"; text: string }[];
    analysis: {
      deal_reached: boolean;
      final_offer: Record<string, number | string> | null;
      player_utility: number | null;
      ai_utility: number | null;
      joint_utility: number | null;
      max_joint_utility: number;
      pareto_improvement: Record<string, number | string> | null;
      zopa_existed: boolean;
      player_vs_reservation: number | null;
      player_vs_target: number | null;
      walk_was_reasonable: boolean | null;
    };
  };
  coaching: {
    what_happened: string;
    strengths: string[];
    missed_opportunities: string[];
    example_lines: string[];
    concept_to_review: string;
    generated_by: "llm" | "template";
  };
  role_reveal: {
    name: string;
    private_brief: string;
    batna: { description: string };
    hidden_info: { id: string; fact: string; importance: number; discovered: boolean }[];
    final_ai_utility: number | null;
  };
  outcome: { type: string };
  turn_count: number;
  scenario: {
    id: string; title: string; concepts: string[];
    offer_fields: { key: string; label: string; type: string; unit?: string; options?: { value: string; label: string }[] }[];
  };
}

const OUTCOME_LABELS: Record<string, string> = {
  agreement: "🤝 Deal reached",
  player_walked: "🚶 You walked away",
  ai_walked: "🚪 They walked away",
  turn_limit: "⏱️ Time ran out",
};

function fmtOffer(d: Debrief, offer: Record<string, number | string>): string {
  return d.scenario.offer_fields
    .map((f) => {
      const v = offer[f.key];
      if (v === undefined) return null;
      if (f.type === "number") {
        return f.unit === "$" ? `$${Number(v).toLocaleString()}` : `${v} ${f.unit ?? ""}`.trim();
      }
      return f.options?.find((o) => o.value === v)?.label ?? String(v);
    })
    .filter(Boolean)
    .join(" · ");
}

export default function DebriefPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [d, setD] = useState<Debrief | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/debrief`);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not load debrief"); return; }
      setD(data);
    })();
  }, [sessionId]);

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!d) return <p className="text-stone-500">Analyzing your game…</p>;

  const { evaluation: ev, coaching, role_reveal: rr, analysis } = {
    evaluation: d.evaluation,
    coaching: d.coaching,
    role_reveal: d.role_reveal,
    analysis: d.evaluation.analysis,
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Headline */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-stone-500">{d.scenario.title}</p>
        <h1 className="mt-1 text-2xl font-bold">
          {OUTCOME_LABELS[d.outcome.type] ?? d.outcome.type}
        </h1>
        {analysis.final_offer && (
          <p className="mt-1 text-stone-600">{fmtOffer(d, analysis.final_offer)}</p>
        )}
        <div className="mt-4 flex items-end justify-center gap-8">
          <div>
            <div className="text-4xl font-extrabold text-indigo-600">{ev.total}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              overall / 100
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-amber-500">+{ev.xp}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              XP earned
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-stone-700">{d.turn_count}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
              turns
            </div>
          </div>
        </div>
      </div>

      {/* Objective outcome vs plan */}
      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          📐 The math <span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">objective</span>
        </h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {analysis.deal_reached ? (
            <>
              <li>Your deal value: <strong>{analysis.player_utility}/100</strong></li>
              <li>
                vs your walk-away point:{" "}
                <strong className={analysis.player_vs_reservation! >= 0 ? "text-emerald-700" : "text-rose-600"}>
                  {analysis.player_vs_reservation! >= 0 ? "+" : ""}{analysis.player_vs_reservation}
                </strong>
              </li>
              <li>
                vs your target:{" "}
                <strong className={analysis.player_vs_target! >= 0 ? "text-emerald-700" : "text-amber-600"}>
                  {analysis.player_vs_target! >= 0 ? "+" : ""}{analysis.player_vs_target}
                </strong>
              </li>
              <li>
                Joint value: <strong>{analysis.joint_utility}</strong> of{" "}
                <strong>{analysis.max_joint_utility}</strong> possible
              </li>
            </>
          ) : (
            <>
              <li>
                A zone of agreement{" "}
                <strong>{analysis.zopa_existed ? "existed" : "did not exist"}</strong>
              </li>
              {analysis.walk_was_reasonable !== null && (
                <li>
                  Walking away was{" "}
                  <strong>{analysis.walk_was_reasonable ? "disciplined ✓" : "premature"}</strong>
                </li>
              )}
            </>
          )}
        </ul>
        {analysis.pareto_improvement && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            💡 A better package existed for BOTH sides:{" "}
            <strong>{fmtOffer(d, analysis.pareto_improvement)}</strong>
          </div>
        )}
      </section>

      {/* Scores */}
      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          📊 Skill scores
        </h2>
        <div className="mt-4 space-y-3">
          {ev.scores.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">
                  {s.label}{" "}
                  <span className="ml-1 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">
                    {s.basis === "objective" ? "objective" : "rule-based"}
                  </span>
                </span>
                <span className="font-bold">{s.value}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className={`h-full rounded-full ${
                    s.value >= 70 ? "bg-emerald-500" : s.value >= 40 ? "bg-amber-400" : "bg-rose-400"
                  }`}
                  style={{ width: `${s.value}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-stone-500">{s.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coaching */}
      <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-indigo-700">
          🎓 Coaching{" "}
          <span className="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
            {coaching.generated_by === "llm" ? "AI-generated · subjective" : "rule-based template"}
          </span>
        </h2>
        <p className="mt-3 text-sm text-stone-800">{coaching.what_happened}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold uppercase text-emerald-700">What you did well</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
              {coaching.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase text-amber-700">Missed opportunities</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
              {coaching.missed_opportunities.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase text-indigo-700">Lines you could have used</h3>
          {coaching.example_lines.map((l, i) => (
            <p key={i} className="mt-1 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm italic">
              {l}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm">
          📘 Concept to review:{" "}
          <strong>{coaching.concept_to_review.replaceAll("_", " ")}</strong>
        </p>
      </section>

      {/* Role reveal */}
      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          🎭 Role reveal — what {rr.name} was really working with
        </h2>
        <div className="mt-3">
          <Md text={rr.private_brief} className="text-sm text-stone-700" />
          <p className="mt-2 text-sm text-stone-600">
            <strong>Their fallback:</strong> {rr.batna.description}
          </p>
          {rr.final_ai_utility !== null && (
            <p className="mt-1 text-sm text-stone-600">
              <strong>Their deal value:</strong> {rr.final_ai_utility}/100
            </p>
          )}
        </div>
        <h3 className="mt-4 text-xs font-bold uppercase text-stone-500">Their secrets</h3>
        <ul className="mt-2 space-y-2">
          {rr.hidden_info.map((h) => (
            <li
              key={h.id}
              className={`rounded-lg border px-4 py-2.5 text-sm ${
                h.discovered
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-stone-200 bg-stone-50 text-stone-600"
              }`}
            >
              {h.discovered ? "🔓 You found this: " : "🔒 You never learned: "}
              {h.fact}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3 pb-8">
        <Link
          href={`/play/${d.scenario.id}/prepare`}
          className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
        >
          🔁 Replay (new variation)
        </Link>
        <Link
          href="/learn"
          className="rounded-lg border border-stone-300 bg-white px-6 py-3 font-semibold text-stone-700 hover:bg-stone-100"
        >
          Continue learning
        </Link>
        <Link
          href="/play"
          className="rounded-lg border border-stone-300 bg-white px-6 py-3 font-semibold text-stone-700 hover:bg-stone-100"
        >
          More scenarios
        </Link>
      </div>
    </div>
  );
}
