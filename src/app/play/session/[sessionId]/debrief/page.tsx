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

  if (error) return <p className="text-center font-bold text-rose-400">{error}</p>;
  if (!d) {
    return (
      <div className="pt-16 text-center">
        <div className="anim-float inline-block text-5xl">🔬</div>
        <p className="mt-3 font-bold text-stone-400">Analyzing your game…</p>
      </div>
    );
  }

  const { evaluation: ev, coaching, role_reveal: rr, analysis } = {
    evaluation: d.evaluation,
    coaching: d.coaching,
    role_reveal: d.role_reveal,
    analysis: d.evaluation.analysis,
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Headline */}
      <div className="panel panel-glow-indigo anim-pop p-6 text-center">
        <p className="text-sm font-bold text-stone-500">{d.scenario.title}</p>
        <h1 className="mt-1 text-2xl font-black text-white">
          {OUTCOME_LABELS[d.outcome.type] ?? d.outcome.type}
        </h1>
        {analysis.final_offer && (
          <p className="mt-1 font-semibold text-stone-400">
            {fmtOffer(d, analysis.final_offer)}
          </p>
        )}
        <div className="mt-4 flex items-end justify-center gap-8">
          <div>
            <div className="text-4xl font-black tabular-nums text-indigo-400">{ev.total}</div>
            <div className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
              overall / 100
            </div>
          </div>
          <div>
            <div className="text-4xl font-black tabular-nums text-amber-300">+{ev.xp}</div>
            <div className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
              XP earned
            </div>
          </div>
          <div>
            <div className="text-4xl font-black tabular-nums text-stone-300">{d.turn_count}</div>
            <div className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
              turns
            </div>
          </div>
        </div>
      </div>

      {/* Objective outcome vs plan */}
      <section className="panel mt-4 p-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
          📐 The math <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-stone-400">objective</span>
        </h2>
        <ul className="mt-3 grid gap-2 text-sm text-stone-300 sm:grid-cols-2">
          {analysis.deal_reached ? (
            <>
              <li>Your deal value: <strong className="text-white">{analysis.player_utility}/100</strong></li>
              <li>
                vs your walk-away point:{" "}
                <strong className={analysis.player_vs_reservation! >= 0 ? "text-emerald-300" : "text-rose-400"}>
                  {analysis.player_vs_reservation! >= 0 ? "+" : ""}{analysis.player_vs_reservation}
                </strong>
              </li>
              <li>
                vs your target:{" "}
                <strong className={analysis.player_vs_target! >= 0 ? "text-emerald-300" : "text-amber-300"}>
                  {analysis.player_vs_target! >= 0 ? "+" : ""}{analysis.player_vs_target}
                </strong>
              </li>
              <li>
                Joint value: <strong className="text-white">{analysis.joint_utility}</strong> of{" "}
                <strong className="text-white">{analysis.max_joint_utility}</strong> possible
              </li>
            </>
          ) : (
            <>
              <li>
                A zone of agreement{" "}
                <strong className="text-white">{analysis.zopa_existed ? "existed" : "did not exist"}</strong>
              </li>
              {analysis.walk_was_reasonable !== null && (
                <li>
                  Walking away was{" "}
                  <strong className="text-white">{analysis.walk_was_reasonable ? "disciplined ✓" : "premature"}</strong>
                </li>
              )}
            </>
          )}
        </ul>
        {analysis.pareto_improvement && (
          <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-sm text-amber-100/90">
            💡 A better package existed for BOTH sides:{" "}
            <strong>{fmtOffer(d, analysis.pareto_improvement)}</strong>
          </div>
        )}
      </section>

      {/* Scores */}
      <section className="panel mt-4 p-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
          📊 Skill scores
        </h2>
        <div className="mt-4 space-y-3.5">
          {ev.scores.map((s) => (
            <div key={s.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold text-stone-300">
                  {s.label}{" "}
                  <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">
                    {s.basis === "objective" ? "objective" : "rule-based"}
                  </span>
                </span>
                <span className="font-black tabular-nums text-white">{s.value}</span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${
                    s.value >= 70
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : s.value >= 40
                        ? "bg-gradient-to-r from-amber-500 to-amber-400"
                        : "bg-gradient-to-r from-rose-500 to-rose-400"
                  }`}
                  style={{ width: `${s.value}%` }}
                />
              </div>
              <p className="mt-1 text-xs font-medium text-stone-500">{s.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coaching */}
      <section className="panel mt-4 border-indigo-400/25 bg-indigo-400/8 p-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-300">
          🎓 Coaching{" "}
          <span className="ml-1 rounded bg-indigo-400/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
            {coaching.generated_by === "llm" ? "AI-generated · subjective" : "rule-based template"}
          </span>
        </h2>
        <p className="mt-3 text-sm font-medium text-stone-200">{coaching.what_happened}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-black uppercase text-emerald-300">What you did well</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-stone-300">
              {coaching.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-black uppercase text-amber-300">Missed opportunities</h3>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-stone-300">
              {coaching.missed_opportunities.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xs font-black uppercase text-indigo-300">Lines you could have used</h3>
          {coaching.example_lines.map((l, i) => (
            <p key={i} className="mt-1.5 rounded-lg border border-indigo-400/25 bg-black/25 px-4 py-2 text-sm font-medium italic text-stone-200">
              {l}
            </p>
          ))}
        </div>
        <p className="mt-4 text-sm text-stone-300">
          📘 Concept to review:{" "}
          <strong className="text-white">{coaching.concept_to_review.replaceAll("_", " ")}</strong>
        </p>
      </section>

      {/* Role reveal */}
      <section className="panel mt-4 p-6">
        <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
          🎭 Role reveal — what {rr.name} was really working with
        </h2>
        <div className="mt-3">
          <Md text={rr.private_brief} className="text-sm text-stone-300" />
          <p className="mt-2 text-sm text-stone-400">
            <strong className="text-stone-200">Their fallback:</strong> {rr.batna.description}
          </p>
          {rr.final_ai_utility !== null && (
            <p className="mt-1 text-sm text-stone-400">
              <strong className="text-stone-200">Their deal value:</strong> {rr.final_ai_utility}/100
            </p>
          )}
        </div>
        <h3 className="mt-4 text-xs font-black uppercase text-stone-500">Their secrets</h3>
        <ul className="mt-2 space-y-2">
          {rr.hidden_info.map((h) => (
            <li
              key={h.id}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium ${
                h.discovered
                  ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-100/90"
                  : "border-white/10 bg-white/5 text-stone-400"
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
          href={`/play/${d.scenario.id}`}
          className="btn3d btn3d-indigo px-6 py-3 text-sm"
        >
          🔁 REPLAY (NEW VARIATION)
        </Link>
        <Link href="/learn" className="btn3d btn3d-ghost px-6 py-3 text-sm">
          Continue learning
        </Link>
        <Link href="/" className="btn3d btn3d-ghost px-6 py-3 text-sm">
          All tables
        </Link>
      </div>
    </div>
  );
}
