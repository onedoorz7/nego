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
  arcade: { mission: string; short_mission: string; player_hud: string[] } | null;
  probes: { id: string; question: string }[];
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
  standing_offer_points: number | null;
  offer_history: { by: "player" | "ai"; values: OfferValues }[];
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
  const [drawer, setDrawer] = useState<"ask" | "offer" | null>(null);
  const [offerDraft, setOfferDraft] = useState<Record<string, string>>({});
  const [finalOffer, setFinalOffer] = useState(false);
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
      setDrawer(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "That move didn't work"); return; }
        setSession(data.session);
        if (data.new_reveals?.length) {
          setFlash("🔓 Secret uncovered!");
          setTimeout(() => setFlash(null), 3000);
        }
        if (data.done) {
          setTimeout(() => router.push(`/play/session/${sessionId}/result`), 1400);
        }
      } finally {
        setBusy(false);
      }
    },
    [session, busy, sessionId, router]
  );

  if (error && !session) return <p className="text-rose-600">{error}</p>;
  if (!scenario || !session) return <p className="text-stone-500">Taking your seat…</p>;

  const done = !!session.outcome;
  const aiOffer = session.standing_offer?.by === "ai" ? session.standing_offer : null;
  const revealedIds = new Set(session.revealed_facts.map((f) => f.id));
  const openProbes = scenario.probes.filter((p) => !revealedIds.has(p.id));
  const movesLeft = session.turn_limit - session.turn;

  const moveBtn =
    "rounded-xl border px-3 py-2.5 text-sm font-bold transition disabled:opacity-40";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
      {/* Main column */}
      <div className="min-w-0 flex-1">
        {/* Mission HUD */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold leading-snug text-indigo-900">
              {scenario.emoji} {scenario.arcade?.short_mission ?? scenario.title}
            </p>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                movesLeft <= 2 ? "bg-rose-100 text-rose-700" : "bg-white text-stone-600"
              }`}
            >
              {done ? "round over" : `${movesLeft} moves left`}
            </span>
          </div>
          {scenario.arcade && scenario.arcade.player_hud.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {scenario.arcade.player_hud.map((chip) => (
                <span key={chip} className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="mt-3 h-[22rem] overflow-y-auto rounded-xl border border-stone-200 bg-white p-4">
          {session.transcript.length === 0 && (
            <div className="mx-auto max-w-xs rounded-lg bg-stone-50 px-3 py-2 text-center text-xs text-stone-500">
              🎲 {scenario.ai_role.name} is across the table. Make your first
              move — ask a question to dig for an edge, or open with an offer.
            </div>
          )}
          <div className="space-y-3">
            {session.transcript.map((e, i) => {
              if (e.speaker === "system") {
                return (
                  <div key={i} className="mx-auto max-w-md rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                    {e.text}
                  </div>
                );
              }
              if (e.kind === "move") {
                return (
                  <div key={i} className="text-right text-xs italic text-stone-400">
                    {e.text}
                  </div>
                );
              }
              return (
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
              );
            })}
          </div>
          <div ref={bottomRef} />
        </div>

        {flash && <p className="mt-2 text-center text-sm font-bold text-emerald-600">{flash}</p>}
        {error && <p className="mt-2 text-center text-sm text-rose-600">{error}</p>}
        {done && (
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-center text-sm font-bold text-indigo-800">
            Round over — tallying your score… 🥁
          </div>
        )}

        {/* ------- MOVE BAR ------- */}
        {!done && (
          <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3">
            {/* The pot: their offer + accept */}
            {aiOffer && (
              <div className="mb-3 flex items-stretch gap-2">
                <button
                  onClick={() => act({ type: "accept" })}
                  disabled={busy}
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-3 text-center font-extrabold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                >
                  ✓ Accept
                  {session.standing_offer_points !== null && (
                    <span className="ml-1.5 rounded-full bg-emerald-500 px-2 py-0.5 text-xs">
                      +{session.standing_offer_points} pts
                    </span>
                  )}
                </button>
                <button
                  onClick={() => act({ type: "reject" })}
                  disabled={busy}
                  className={`${moveBtn} border-stone-300 text-stone-600 hover:bg-stone-100`}
                >
                  ✗ Reject
                </button>
              </div>
            )}

            {/* Moves */}
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setDrawer(drawer === "ask" ? null : "ask")}
                disabled={busy || openProbes.length === 0}
                className={`${moveBtn} ${drawer === "ask" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}
              >
                🗣️<br />Ask
              </button>
              <button
                onClick={() => setDrawer(drawer === "offer" ? null : "offer")}
                disabled={busy}
                className={`${moveBtn} ${drawer === "offer" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700"}`}
              >
                📋<br />{aiOffer ? "Counter" : "Offer"}
              </button>
              <button
                onClick={() => act({ type: "flinch" })}
                disabled={busy || !aiOffer}
                title="Wince at their number — pressure without words"
                className={`${moveBtn} border-stone-300 text-stone-700 hover:bg-stone-50`}
              >
                😤<br />Flinch
              </button>
              <button
                onClick={() => act({ type: "silence" })}
                disabled={busy}
                title="Say nothing. Let them sweat."
                className={`${moveBtn} border-stone-300 text-stone-700 hover:bg-stone-50`}
              >
                🤐<br />Wait
              </button>
            </div>

            {/* Ask drawer: question cards */}
            {drawer === "ask" && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">
                  Pick a question — costs one move
                </p>
                {openProbes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => act({ type: "probe", info_id: p.id })}
                    disabled={busy}
                    className="block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-left text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50/50 disabled:opacity-40"
                  >
                    ❓ {p.question}
                  </button>
                ))}
                {scenario.probes.filter((p) => revealedIds.has(p.id)).map((p) => (
                  <div key={p.id} className="block w-full rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-2 text-left text-xs text-emerald-700 opacity-70">
                    ✓ {p.question}
                  </div>
                ))}
              </div>
            )}

            {/* Offer drawer */}
            {drawer === "offer" && (
              <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {scenario.offer_fields.map((f) => (
                    <label key={f.key} className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                        {f.label} {f.type === "number" && f.unit ? `(${f.unit})` : ""}
                      </span>
                      {f.type === "number" ? (
                        <input
                          type="number"
                          min={f.min} max={f.max} step={f.step}
                          value={offerDraft[f.key] ?? ""}
                          onChange={(e) => setOfferDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                        />
                      ) : (
                        <select
                          value={offerDraft[f.key] ?? ""}
                          onChange={(e) => setOfferDraft((d) => ({ ...d, [f.key]: e.target.value }))}
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
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
                  <input
                    type="checkbox"
                    checked={finalOffer}
                    onChange={(e) => setFinalOffer(e.target.checked)}
                    className="h-4 w-4 accent-rose-600"
                  />
                  🎯 Final offer — take it or leave it
                  <span className="text-xs font-normal text-stone-400">
                    (high risk: bluff and they&apos;ll remember)
                  </span>
                </label>
                <button
                  onClick={() => {
                    act({ type: "offer", values: offerDraft, final: finalOffer });
                    setFinalOffer(false);
                  }}
                  disabled={busy}
                  className={`mt-3 w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-40 ${
                    finalOffer ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {finalOffer ? "🎯 PUT IT ALL ON THE TABLE" : "Propose this offer →"}
                </button>
              </div>
            )}

            {/* Walk away */}
            <button
              onClick={() => {
                if (confirm("Fold this round for good? No deal = 0 points.")) {
                  act({ type: "walk_away" });
                }
              }}
              disabled={busy}
              className="mt-2 w-full rounded-lg py-1.5 text-center text-xs font-semibold text-stone-400 hover:text-rose-600 disabled:opacity-40"
            >
              🚶 walk away (fold)
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="w-full shrink-0 space-y-4 lg:w-72">
        {aiOffer && !done && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              On the table
              {session.standing_offer_points !== null && (
                <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-white">
                  +{session.standing_offer_points} pts
                </span>
              )}
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
            🔓 Secrets found ({session.revealed_facts.length}/{scenario.probes.length})
          </h3>
          {session.revealed_facts.length === 0 ? (
            <p className="mt-2 text-sm text-stone-400">
              None yet — the 🗣️ Ask move digs for their weaknesses.
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
