import Link from "next/link";
import { listSessions } from "@/lib/db/sessions";
import { listScenarios } from "@/lib/content/loader";
import ResetButton from "./ResetButton";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sessions = listSessions(100);
  const scenarios = listScenarios();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Founder tools</h1>
      <p className="mt-1 text-sm text-stone-500">
        Local experimentation console — no auth; do not deploy publicly as-is.
      </p>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Quick actions</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <a href="/api/admin/metrics" className="rounded-lg border border-stone-300 px-4 py-2 font-medium hover:bg-stone-100">
            📈 Metrics (JSON)
          </a>
          <a href="/api/admin/export?format=json" className="rounded-lg border border-stone-300 px-4 py-2 font-medium hover:bg-stone-100">
            ⬇️ Export JSON
          </a>
          <a href="/api/admin/export?format=csv" className="rounded-lg border border-stone-300 px-4 py-2 font-medium hover:bg-stone-100">
            ⬇️ Export CSV
          </a>
          <ResetButton />
        </div>
        <p className="mt-3 text-xs text-stone-400">
          Content is plain JSON — edit files in <code>content/scenarios/</code> and{" "}
          <code>content/lessons/</code>; changes appear on refresh. Set{" "}
          <code>NEGO_UNLOCK_ALL=1</code> to unlock everything.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Scenario inspector
        </h2>
        <p className="mt-1 text-xs text-stone-500">
          Full scenario definition (hidden values included) + computed ZOPA/frontier
          — sanity-check authored numbers before playtesting.
        </p>
        <ul className="mt-3 space-y-1 text-sm">
          {scenarios.map((s) => (
            <li key={s.id}>
              <a
                href={`/api/admin/scenarios/${s.id}`}
                className="text-indigo-600 hover:underline"
              >
                {s.emoji} {s.id}
              </a>{" "}
              <span className="text-stone-400">difficulty {s.difficulty}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
          Sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="mt-2 text-sm text-stone-400">No sessions yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-xs uppercase text-stone-400">
                <th className="py-2">Session</th>
                <th>Scenario</th>
                <th>Status</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-stone-100">
                  <td className="py-2">
                    <Link href={`/admin/sessions/${s.id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                      {s.id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td>{s.scenario_id}</td>
                  <td>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs">{s.status}</span>
                  </td>
                  <td className="text-xs text-stone-500">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
