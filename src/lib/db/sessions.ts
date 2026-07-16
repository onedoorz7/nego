import type { SessionState } from "@/lib/types";
import { db } from "./db";
import type { ModelCallLog } from "@/lib/llm/provider";

export function saveSession(state: SessionState): void {
  db()
    .prepare(
      `INSERT INTO sessions (id, scenario_id, status, created_at, updated_at, state_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         updated_at = excluded.updated_at,
         state_json = excluded.state_json`
    )
    .run(
      state.id,
      state.scenario_id,
      state.status,
      state.created_at,
      state.updated_at,
      JSON.stringify(state)
    );
}

export function loadSession(id: string): SessionState | null {
  const row = db()
    .prepare("SELECT state_json FROM sessions WHERE id = ?")
    .get(id) as { state_json: string } | undefined;
  return row ? (JSON.parse(row.state_json) as SessionState) : null;
}

export interface SessionListing {
  id: string;
  scenario_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function listSessions(limit = 200): SessionListing[] {
  return db()
    .prepare(
      "SELECT id, scenario_id, status, created_at, updated_at FROM sessions ORDER BY created_at DESC LIMIT ?"
    )
    .all(limit) as unknown as SessionListing[];
}

export function logModelCall(sessionId: string | null, log: ModelCallLog): void {
  db()
    .prepare(
      `INSERT INTO model_calls (session_id, purpose, provider, request_json, response_raw, ok, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      sessionId,
      log.purpose,
      log.provider,
      JSON.stringify(log.request ?? {}),
      log.response_raw,
      log.ok ? 1 : 0,
      log.error,
      new Date().toISOString()
    );
}

export function listModelCalls(sessionId: string) {
  return db()
    .prepare(
      "SELECT id, purpose, provider, request_json, response_raw, ok, error, created_at FROM model_calls WHERE session_id = ? ORDER BY id ASC"
    )
    .all(sessionId);
}

export function saveEvaluation(
  sessionId: string,
  result: unknown,
  coaching: unknown | null
): void {
  db()
    .prepare(
      `INSERT INTO evaluations (session_id, result_json, coaching_json, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         result_json = excluded.result_json,
         coaching_json = excluded.coaching_json`
    )
    .run(
      sessionId,
      JSON.stringify(result),
      coaching ? JSON.stringify(coaching) : null,
      new Date().toISOString()
    );
}

export function loadEvaluation(
  sessionId: string
): { result: unknown; coaching: unknown | null } | null {
  const row = db()
    .prepare(
      "SELECT result_json, coaching_json FROM evaluations WHERE session_id = ?"
    )
    .get(sessionId) as
    | { result_json: string; coaching_json: string | null }
    | undefined;
  if (!row) return null;
  return {
    result: JSON.parse(row.result_json),
    coaching: row.coaching_json ? JSON.parse(row.coaching_json) : null,
  };
}
