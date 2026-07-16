"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface OfferFieldNumber {
  key: string; label: string; type: "number";
  unit?: string; min: number; max: number; step: number;
}
interface OfferFieldSelect {
  key: string; label: string; type: "select";
  options: { value: string; label: string }[];
}
type OfferField = OfferFieldNumber | OfferFieldSelect;
type OfferValues = Record<string, number | string>;

interface ScenarioView {
  id: string; title: string; emoji: string;
  player_role: { name: string };
  ai_role: { name: string };
  offer_fields: OfferField[];
}
interface TranscriptEntry {
  turn: number;
  speaker: "player" | "ai" | "system";
  kind: string;
  text: string;
  offer?: OfferValues;
}
interface SessionView {
  id: string; status: string; turn: number; turn_limit: number;
  transcript: TranscriptEntry[];
  standing_offer: { by: "player" | "ai"; values: OfferValues } | null;
  revealed_facts: { id: string; fact: string }[];
  outcome: { type: string } | null;
}

function formatValue(f: OfferField, v: number | string): string {
  if (f.type === "number") {
    return f.unit === "$" ? `$${Number(v).toLocaleString()}` : `${v} ${f.unit ?? ""}`.trim();
  }
  return f.options.find((o) => o.value === v)?.label ?? String(v);
}

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<ScenarioView | null>(null);
  const [session, setSession] = useState<SessionView | null>(null);
  const [message, setMessage] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerDraft, setOfferDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setScenario(data.scenario);
      setSession(data.session);
      seedDraft(data.scenario, data.session);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.transcript.length]);

  const seedDraft = (sc: ScenarioView, se: SessionView) => {
    const base: Record<string, string> = {};
    for (const f of sc.offer_fields) {
      const standing = se.standing_offer?.values[f.key];
      if (standing !== undefined) base[f.key] = String(standing);
      else if (f.type === "number") base[f.key] = String(Math.round((f.min + f.max) / 2));
      else base[f.key] = f.options[0].value;
    }
    setOfferDraft(base);
  };

  const act = useCallback(
    async (action: Record<string, unknown>) => {
      if (!session || busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Action failed"); return; }
        setSession(data.session);
        if (data.new_reveals?.length) {
          setFlash("🔓 You uncovered something — check “What you’ve learned”.");
          setTimeout(() => setFlash(null), 4000);
        }
        if (data.done) {
          setTimeout(() => router.push(`/play/session/${sessionId}/debrief`), 1600);
        }
      } finally {
        setBusy(false);
      }
    },
    [session, busy, sessionId, router]
  );

  if (error && !session) return <p className="text-rose-600">{error}</p>;
  if (!scenario || !session) return <p className="text-stone-500">Loading the table…</p>;

  const done = !!session.outcome;
  const aiOffer = session.standing_offer?.by === "ai" ? session.standing_offer : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
      {/* Main column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <span className="text-2xl">{scenario.emoji}</span> {scenario.title}
          </h1>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
            turn {session.turn} / {session.turn_limit}
          </span>
        </div>

        {/* Transcript */}
        <div className="mt-3 h-[26rem] overflow-y-auto rounded-xl border border-stone-200 bg-white p-4">
          {session.transcript.length === 0 && (
            <p className="text-sm text-stone-400">
              You&apos;re at the table with {scenario.ai_role.name}. Say hello, ask a
              question, or open with an offer.
            </p>
          )}
          <div className="space-y-3">
            {session.transcript.map((e, i) =>
              e.speaker === "system" ? (
                <div key={i} className="mx-auto max-w-md rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                  {e.text}
                </div>
              ) : (
                <div key={i} className={`flex ${e.speaker === "player" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      e.speaker === "player"
                        ? "rounded-br-sm bg-indigo-600 text-white"
                        : "rounded-bl-sm bg-stone-100 text-stone-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{e.text}</p>
                    {e.offer && (
                      <div
                        className={`mt-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                          e.speaker === "player"
                            ? "border-indigo-400 bg-indigo-500/40"
                            : "border-stone-300 bg-white"
                        }`}
                      >
                        📋 {scenario.offer_fields.map((f) => formatValue(f, e.offer![f.key])).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {flash && <p className="mt-2 text-sm font-medium text-emerald-700">{flash}</p>}
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        {done && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-medium text-indigo-800">
            The negotiation has ended — taking you to your debrief…
          </div>
        )}

        {/* Composer */}
        {!done && (
          <div className="mt-3 rounded-xl border border-stone-200 bg-white p-4">
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && message.trim() && !busy) {
                    act({ type: "message", text: message });
                    setMessage("");
                  }
                }}
                placeholder={`Say something to ${scenario.ai_role.name}… (questions pay off)`}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
                disabled={busy}
              />
              <button
                onClick={() => { act({ type: "message", text: message }); setMessage(""); }}
                disabled={busy || !message.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Send
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOfferOpen((o) => !o)}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                📋 {offerOpen ? "Hide offer form" : "Make a structured offer"}
              </button>
              {aiOffer && (
                <>
                  <button
                    onClick={() => act({ type: "accept" })}
                    disabled={busy}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    ✓ Accept their offer
                  </button>
                  <button
                    onClick={() => act({ type: "reject" })}
                    disabled={busy}
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                  >
                    ✗ Reject it
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  if (confirm("Walk away from this negotiation for good?")) {
                    act({ type: "walk_away" });
                  }
                }}
                disabled={busy}
                className="ml-auto rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40"
              >
                🚶 Walk away
              </button>
            </div>

            {offerOpen && (
              <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {scenario.offer_fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {f.label} {f.type === "number" && f.unit ? `(${f.unit})` : ""}
                      </span>
                      {f.type === "number" ? (
                        <input
                          type="number"
                          min={f.min}
                          max={f.max}
                          step={f.step}
                          value={offerDraft[f.key] ?? ""}
                          onChange={(e) =>
                            setOfferDraft((d) => ({ ...d, [f.key]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                        />
                      ) : (
                        <select
                          value={offerDraft[f.key] ?? ""}
                          onChange={(e) =>
                            setOfferDraft((d) => ({ ...d, [f.key]: e.target.value }))
                          }
                          className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                        >
                          {f.options.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                    </label>
                  ))}
                </div>
                <button
                  onClick={() => {
                    act({
                      type: "offer",
                      values: offerDraft,
                      text: message.trim() || undefined,
                    });
                    setMessage("");
                    setOfferOpen(false);
                  }}
                  disabled={busy}
                  className="mt-4 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  Propose this offer →
                </button>
                <span className="ml-3 text-xs text-stone-500">
                  Anything typed in the message box goes along with it.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="w-full shrink-0 space-y-4 lg:w-72">
        {aiOffer && !done && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Their offer on the table
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-emerald-900">
              {scenario.offer_fields.map((f) => (
                <li key={f.key}>
                  <span className="text-emerald-700/70">{f.label}:</span>{" "}
                  <strong>{formatValue(f, aiOffer.values[f.key])}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">
            🔓 What you&apos;ve learned about them
          </h3>
          {session.revealed_facts.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">
              Nothing yet. Ask about their situation — why they&apos;re here, what
              matters to them, what else they could include…
            </p>
          ) : (
            <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-stone-700">
              {session.revealed_facts.map((f) => (
                <li key={f.id}>{f.fact}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
