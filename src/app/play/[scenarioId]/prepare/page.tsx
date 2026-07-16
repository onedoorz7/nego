"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Md from "@/components/Md";

interface PrepField {
  id: string;
  label: string;
  kind: "text" | "number";
  help?: string;
}

interface ScenarioView {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  public_context: string;
  player_role: {
    name: string;
    persona: string;
    private_brief: string;
    batna: { description: string };
  };
  ai_role: { name: string; persona: string };
  preparation: PrepField[];
}

export default function PreparePage() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioView | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not start the scenario");
        return;
      }
      setScenario(data.scenario);
      setSessionId(data.session.id);
    })();
  }, [scenarioId]);

  const begin = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/prep`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save preparation");
        return;
      }
      router.push(`/play/session/${sessionId}`);
    } finally {
      setBusy(false);
    }
  };

  if (error && !scenario) {
    return <p className="text-rose-600">{error}</p>;
  }
  if (!scenario) {
    return <p className="text-stone-500">Setting up your negotiation…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{scenario.emoji}</span>
        <div>
          <h1 className="text-2xl font-bold">{scenario.title}</h1>
          <p className="text-sm text-stone-500">
            You: {scenario.player_role.name} · Them: {scenario.ai_role.name}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-stone-500">
          The situation
        </h2>
        <Md text={scenario.public_context} />
      </section>

      <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-indigo-700">
          🕵️ Your private brief — the other side can&apos;t see this
        </h2>
        <Md text={scenario.player_role.private_brief} className="text-stone-800" />
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          📝 Prepare
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Skilled negotiators decide these before saying a word. Your answers
          come back in the debrief.
        </p>
        <div className="mt-4 space-y-4">
          {scenario.preparation.map((f) => (
            <label key={f.id} className="block">
              <span className="text-sm font-medium">{f.label}</span>
              {f.help && <span className="block text-xs text-stone-500">{f.help}</span>}
              {f.kind === "number" ? (
                <input
                  type="number"
                  className="mt-1 w-48 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  value={answers[f.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [f.id]: e.target.value }))
                  }
                />
              ) : (
                <textarea
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                  value={answers[f.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({ ...a, [f.id]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button
          onClick={begin}
          disabled={busy}
          className="mt-6 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          {busy ? "Starting…" : "Start the negotiation →"}
        </button>
      </section>
    </div>
  );
}
