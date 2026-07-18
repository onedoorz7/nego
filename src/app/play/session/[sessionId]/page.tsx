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
  mode: "standard" | "blitz" | "mystery";
  blitz_seconds: number | null;
  mystery: { value_field: string; value_range: { min: number; max: number } } | null;
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
  deadline_at: string | null;
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

/** Remaining-moves pips: ●●●○○ */
function MovePips({ total, used }: { total: number; used: number }) {
  const shown = Math.min(total, 12);
  return (
    <span className="flex items-center gap-1" title={`${total - used} moves left`}>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < total - used
              ? total - used <= 2
                ? "bg-rose-400"
                : "bg-indigo-400"
              : "bg-white/15"
          }`}
        />
      ))}
    </span>
  );
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
  const [now, setNow] = useState(() => Date.now());
  const expiredRef = useRef(false);
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

  // Blitz clock: tick 4×/sec while a live deadline exists.
  const deadlineMs = session?.deadline_at ? Date.parse(session.deadline_at) : null;
  const live = !!session && !session.outcome;
  useEffect(() => {
    if (!deadlineMs || !live) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadlineMs, live]);

  // Clock hit zero → the server settles the round; fetch it and show the result.
  useEffect(() => {
    if (!deadlineMs || !live || now < deadlineMs || expiredRef.current) return;
    expiredRef.current = true;
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      const data = await res.json();
      if (res.ok) setSession(data.session);
      setTimeout(() => router.push(`/play/session/${sessionId}/result`), 1400);
    })();
  }, [deadlineMs, live, now, sessionId, router]);

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

  if (error && !session) return <p className="text-center font-bold text-rose-400">{error}</p>;
  if (!scenario || !session) {
    return (
      <div className="pt-16 text-center">
        <div className="anim-float inline-block text-5xl">🎲</div>
        <p className="mt-3 font-bold text-stone-400">Taking your seat…</p>
      </div>
    );
  }

  const done = !!session.outcome;
  const aiOffer = session.standing_offer?.by === "ai" ? session.standing_offer : null;
  const revealedIds = new Set(session.revealed_facts.map((f) => f.id));
  const openProbes = scenario.probes.filter((p) => !revealedIds.has(p.id));
  const secondsLeft = deadlineMs
    ? Math.max(0, Math.ceil((deadlineMs - now) / 1000))
    : null;
  const clock =
    secondsLeft !== null
      ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
      : null;
  const blitzFraction =
    secondsLeft !== null && scenario.blitz_seconds
      ? Math.min(1, secondsLeft / scenario.blitz_seconds)
      : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
      {/* Main column */}
      <div className="min-w-0 flex-1">
        {/* Mission HUD */}
        <div className="panel panel-glow-indigo overflow-hidden">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold leading-snug text-white">
                {scenario.emoji} {scenario.arcade?.short_mission ?? scenario.title}
              </p>
              {clock !== null && !done ? (
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-black tabular-nums ${
                    secondsLeft! <= 15
                      ? "anim-glow-pulse bg-rose-500 text-white"
                      : secondsLeft! <= 30
                        ? "bg-rose-400/20 text-rose-300"
                        : "bg-white/10 text-stone-200"
                  }`}
                >
                  ⏱️ {clock}
                </span>
              ) : done ? (
                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-stone-300">
                  round over
                </span>
              ) : (
                <MovePips total={session.turn_limit} used={session.turn} />
              )}
            </div>
            {((scenario.arcade && scenario.arcade.player_hud.length > 0) ||
              scenario.mystery) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {scenario.mystery && (
                  <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-0.5 text-[11px] font-extrabold text-violet-300">
                    🎰 Inside: worth ${scenario.mystery.value_range.min}–$
                    {scenario.mystery.value_range.max} — nobody knows
                  </span>
                )}
                {(scenario.arcade?.player_hud ?? []).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-stone-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Blitz fuse */}
          {blitzFraction !== null && !done && (
            <div className="h-1.5 w-full bg-white/10">
              <div
                className={`h-full transition-[width] duration-300 ${
                  secondsLeft! <= 15
                    ? "bg-rose-500"
                    : secondsLeft! <= 30
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                }`}
                style={{ width: `${blitzFraction * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="panel mt-3 h-[22rem] overflow-y-auto p-4">
          {session.transcript.length === 0 && (
            <div className="anim-pop mx-auto max-w-xs rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-semibold text-stone-400">
              🎲 {scenario.ai_role.name} is across the table. Make your first
              move — dig for an edge, or open with an offer.
            </div>
          )}
          <div className="space-y-3">
            {session.transcript.map((e, i) => {
              if (e.speaker === "system") {
                return (
                  <div
                    key={i}
                    className="anim-pop mx-auto max-w-md rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-center text-xs font-semibold text-amber-200"
                  >
                    {e.text}
                  </div>
                );
              }
              if (e.kind === "move") {
                return (
                  <div key={i} className="anim-pop text-right text-xs font-semibold italic text-stone-500">
                    {e.text}
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={`anim-pop flex ${e.speaker === "player" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                      e.speaker === "player"
                        ? "rounded-br-sm bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[0_6px_20px_-8px_rgba(99,102,241,0.7)]"
                        : "rounded-bl-sm border border-white/10 bg-white/8 text-stone-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{e.text}</p>
                    {e.offer && (
                      <div
                        className={`mt-2 rounded-lg border px-3 py-2 text-xs font-extrabold ${
                          e.speaker === "player"
                            ? "border-indigo-300/40 bg-indigo-400/25"
                            : "border-white/15 bg-black/25 text-stone-100"
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

        {flash && (
          <p className="anim-pop mt-2 text-center text-sm font-black text-emerald-400">
            {flash}
          </p>
        )}
        {error && (
          <p className="anim-shake mt-2 text-center text-sm font-bold text-rose-400">
            {error}
          </p>
        )}
        {done && (
          <div className="panel panel-glow-indigo anim-pop mt-3 p-4 text-center text-sm font-black text-indigo-200">
            Round over — tallying your score… 🥁
          </div>
        )}

        {/* ------- MOVE BAR ------- */}
        {!done && (
          <div className="panel mt-3 p-3">
            {/* The pot: their offer + accept */}
            {aiOffer && (
              <div className="mb-3 flex items-stretch gap-2">
                <button
                  onClick={() => act({ type: "accept" })}
                  disabled={busy}
                  className="btn3d btn3d-emerald flex-1 px-3 py-3.5 text-base"
                >
                  {scenario.mode === "mystery" ? "✂️ Buy it & cut the lock" : "✓ Accept"}
                  {session.standing_offer_points !== null && (
                    <span className="ml-2 rounded-full bg-black/25 px-2.5 py-0.5 text-xs">
                      +{session.standing_offer_points} pts
                    </span>
                  )}
                </button>
                <button
                  onClick={() => act({ type: "reject" })}
                  disabled={busy}
                  className="btn3d btn3d-ghost px-4 text-sm"
                >
                  ✗<br />
                  <span className="text-[10px] font-bold uppercase">reject</span>
                </button>
              </div>
            )}

            {/* Moves */}
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setDrawer(drawer === "ask" ? null : "ask")}
                disabled={busy || openProbes.length === 0}
                className={`movebtn ${drawer === "ask" ? "movebtn-active" : ""}`}
              >
                <span className="movebtn-emoji">🗣️</span>
                {scenario.mode === "mystery" ? "Snoop" : "Ask"}
              </button>
              <button
                onClick={() => setDrawer(drawer === "offer" ? null : "offer")}
                disabled={busy}
                className={`movebtn ${
                  drawer === "offer"
                    ? "movebtn-active"
                    : "border-indigo-400/50 bg-indigo-500/25"
                }`}
              >
                <span className="movebtn-emoji">📋</span>
                {aiOffer ? "Counter" : "Offer"}
              </button>
              <button
                onClick={() => act({ type: "flinch" })}
                disabled={busy || !aiOffer}
                title="Wince at their number — pressure without words"
                className="movebtn"
              >
                <span className="movebtn-emoji">😤</span>
                Flinch
              </button>
              <button
                onClick={() => act({ type: "silence" })}
                disabled={busy}
                title="Say nothing. Let them sweat."
                className="movebtn"
              >
                <span className="movebtn-emoji">🤐</span>
                Wait
              </button>
            </div>

            {/* Ask drawer: question cards */}
            {drawer === "ask" && (
              <div className="anim-rise mt-3 space-y-1.5 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
                  Pick a question — costs one move
                </p>
                {openProbes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => act({ type: "probe", info_id: p.id })}
                    disabled={busy}
                    className="block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm font-bold text-stone-200 transition hover:border-indigo-400/50 hover:bg-indigo-400/10 disabled:opacity-40"
                  >
                    ❓ {p.question}
                  </button>
                ))}
                {scenario.probes.filter((p) => revealedIds.has(p.id)).map((p) => (
                  <div
                    key={p.id}
                    className="block w-full rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-left text-xs font-semibold text-emerald-300/70"
                  >
                    ✓ {p.question}
                  </div>
                ))}
              </div>
            )}

            {/* Offer drawer */}
            {drawer === "offer" && (
              <div className="anim-rise mt-3 rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="space-y-5">
                  {scenario.offer_fields.map((f) => {
                    if (f.type === "number") {
                      const v = Number(offerDraft[f.key] ?? f.min);
                      const fill = ((v - f.min) / (f.max - f.min)) * 100;
                      const fmt = (x: number) =>
                        f.unit === "$" ? `$${x.toLocaleString()}` : `${x}`;
                      const nudge = (dir: 1 | -1) =>
                        setOfferDraft((d) => ({
                          ...d,
                          [f.key]: String(
                            Math.min(f.max, Math.max(f.min, v + dir * f.step))
                          ),
                        }));
                      return (
                        <div key={f.key}>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
                              {f.label}
                            </span>
                            <span className="text-2xl font-black tabular-nums text-amber-300">
                              {fmt(v)}
                              {f.unit && f.unit !== "$" && (
                                <span className="ml-1 text-xs font-bold text-stone-500">
                                  {f.unit}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              onClick={() => nudge(-1)}
                              className="h-9 w-9 shrink-0 rounded-full border border-white/15 bg-white/8 text-lg font-black text-stone-300 active:scale-90"
                            >
                              −
                            </button>
                            <input
                              type="range"
                              className="slider"
                              min={f.min}
                              max={f.max}
                              step={f.step}
                              value={v}
                              style={{ "--fill": `${fill}%` } as React.CSSProperties}
                              onChange={(e) =>
                                setOfferDraft((d) => ({ ...d, [f.key]: e.target.value }))
                              }
                            />
                            <button
                              onClick={() => nudge(1)}
                              className="h-9 w-9 shrink-0 rounded-full border border-white/15 bg-white/8 text-lg font-black text-stone-300 active:scale-90"
                            >
                              +
                            </button>
                          </div>
                          <div className="mt-1 flex justify-between px-11 text-[10px] font-bold text-stone-600">
                            <span>{fmt(f.min)}</span>
                            <span>{fmt(f.max)}</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={f.key}>
                        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-stone-500">
                          {f.label}
                        </span>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {f.options.map((o) => {
                            const selected = (offerDraft[f.key] ?? "") === o.value;
                            return (
                              <button
                                key={o.value}
                                onClick={() =>
                                  setOfferDraft((d) => ({ ...d, [f.key]: o.value }))
                                }
                                className={`rounded-full px-3.5 py-2 text-xs font-extrabold transition active:scale-95 ${
                                  selected
                                    ? "bg-indigo-500 text-white shadow-[0_4px_14px_-4px_rgba(99,102,241,0.8)]"
                                    : "border border-white/15 bg-white/5 text-stone-300 hover:bg-white/10"
                                }`}
                              >
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setFinalOffer((x) => !x)}
                  className={`mt-4 flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
                    finalOffer
                      ? "border-rose-400/60 bg-rose-500/15"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <span className="text-sm font-extrabold text-stone-200">
                    🎯 Final offer{" "}
                    <span className="font-semibold text-stone-500">
                      — take it or leave it
                    </span>
                  </span>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                      finalOffer ? "bg-rose-500" : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                        finalOffer ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
                {finalOffer && (
                  <p className="anim-rise mt-1.5 text-center text-[11px] font-bold text-rose-300/80">
                    high risk: bluff and they&apos;ll remember
                  </p>
                )}
                <button
                  onClick={() => {
                    act({ type: "offer", values: offerDraft, final: finalOffer });
                    setFinalOffer(false);
                  }}
                  disabled={busy}
                  className={`mt-3 w-full py-3.5 text-base ${
                    finalOffer ? "btn3d btn3d-rose" : "btn3d btn3d-indigo"
                  }`}
                >
                  {finalOffer ? "🎯 PUT IT ALL ON THE TABLE" : "PROPOSE THIS OFFER →"}
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
              className="mt-2 w-full rounded-lg py-1.5 text-center text-xs font-bold text-stone-500 transition hover:text-rose-400 disabled:opacity-40"
            >
              🚶 walk away (fold)
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="w-full shrink-0 space-y-4 lg:w-72">
        {aiOffer && !done && (
          <div className="panel panel-glow-emerald anim-pop p-4">
            <h3 className="flex items-center justify-between text-xs font-black uppercase tracking-[0.15em] text-emerald-300">
              💰 On the table
              {session.standing_offer_points !== null && (
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-emerald-200">
                  +{session.standing_offer_points} pts
                </span>
              )}
            </h3>
            <ul className="mt-2.5 space-y-1.5 text-sm text-stone-200">
              {scenario.offer_fields.map((f) => (
                <li key={f.key} className="flex items-baseline justify-between gap-2">
                  <span className="text-stone-500">{f.label}</span>
                  <strong className="font-black text-white">
                    {formatValue(f, aiOffer.values[f.key])}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="panel p-4">
          <h3 className="text-xs font-black uppercase tracking-[0.15em] text-stone-400">
            🔓 Secrets found{" "}
            <span className="text-stone-600">
              {session.revealed_facts.length}/{scenario.probes.length}
            </span>
          </h3>
          {session.revealed_facts.length === 0 ? (
            <p className="mt-2 text-sm font-medium text-stone-500">
              None yet — the 🗣️ move digs for their weaknesses.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {session.revealed_facts.map((f) => (
                <li
                  key={f.id}
                  className="anim-pop rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-xs font-semibold text-emerald-100/90"
                >
                  {f.fact}
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
