import { notFound } from "next/navigation";
import { listModelCalls, loadEvaluation, loadSession } from "@/lib/db/sessions";
import { getScenario } from "@/lib/content/loader";
import { formatOffer } from "@/lib/engine/offers";

export const dynamic = "force-dynamic";

/** Founder session viewer: full transcript, structured offers, resolved hidden
 * parameters, raw scores, and every model call (request/response/errors). */
export default async function AdminSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const state = loadSession(id);
  if (!state) notFound();
  const scenario = getScenario(state.scenario_id);
  const evaluation = loadEvaluation(id);
  const calls = listModelCalls(id) as {
    id: number; purpose: string; provider: string;
    response_raw: string | null; ok: number; error: string | null; created_at: string;
  }[];

  return (
    <div className="mx-auto max-w-3xl text-sm">
      <h1 className="text-xl font-bold">
        Session <span className="font-mono text-base">{id}</span>
      </h1>
      <p className="mt-1 text-stone-500">
        {scenario.title} · seed {state.seed} · status {state.status}
      </p>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Resolved parameters (hidden from player)
        </h2>
        <pre className="mt-2 overflow-x-auto rounded bg-stone-50 p-3 text-xs">
{JSON.stringify({ resolved: state.resolved, ai_state: state.ai, revealed: state.revealed_info, events_fired: state.events_fired }, null, 2)}
        </pre>
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Preparation answers
        </h2>
        <pre className="mt-2 overflow-x-auto rounded bg-stone-50 p-3 text-xs">
{JSON.stringify(state.prep, null, 2)}
        </pre>
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Transcript ({state.transcript.length} entries)
        </h2>
        <ol className="mt-2 space-y-2">
          {state.transcript.map((e, i) => (
            <li key={i} className="rounded border border-stone-100 bg-stone-50 p-2">
              <span className="font-mono text-xs text-stone-400">
                t{e.turn} · {e.speaker} · {e.kind}
              </span>
              <p className="mt-0.5">{e.text}</p>
              {e.offer && (
                <p className="mt-1 text-xs font-semibold text-indigo-700">
                  📋 {formatOffer(scenario, e.offer)}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Evaluation (raw)
        </h2>
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-stone-50 p-3 text-xs">
{JSON.stringify(evaluation, null, 2)}
        </pre>
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Model calls ({calls.length})
        </h2>
        <ol className="mt-2 space-y-2">
          {calls.map((c) => (
            <li key={c.id} className={`rounded border p-2 ${c.ok ? "border-stone-100 bg-stone-50" : "border-rose-200 bg-rose-50"}`}>
              <span className="font-mono text-xs text-stone-500">
                #{c.id} · {c.purpose} · {c.provider} · {c.ok ? "ok" : `FAILED: ${c.error}`}
              </span>
              {c.response_raw && (
                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-stone-600">
{c.response_raw}
                </pre>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
