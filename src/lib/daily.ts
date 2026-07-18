import { listScenarios } from "./content/loader";
import type { Scenario } from "./content/schema";
import { kvGet, kvSet } from "./db/db";
import type { EvaluationResult, SessionState } from "./types";

/**
 * Daily challenge — one seeded table per day, the same for everyone, one
 * attempt. Scenario rotates through the whole catalog (rounds + lab);
 * the seed is derived from the date, so "today's game" is identical for
 * every player and every device.
 */

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export function dailySeed(key: string = todayKey()): number {
  let h = 2166136261;
  for (const c of key) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 1) | 1; // positive, odd
}

export function dailyScenario(key: string = todayKey()): Scenario {
  const all = [...listScenarios()].sort((a, b) => a.id.localeCompare(b.id));
  const dayIndex = Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
  return all[((dayIndex % all.length) + all.length) % all.length];
}

// ---------------------------------------------------------------------------
// One attempt per day (per install — single local demo user)
// ---------------------------------------------------------------------------

export interface DailyRecord {
  session_id: string;
  finished: boolean;
  points: number | null;
}

export function getDailyRecord(key: string = todayKey()): DailyRecord | null {
  return kvGet<DailyRecord | null>(`daily:${key}`, null);
}

export function setDailyRecord(rec: DailyRecord, key: string = todayKey()): void {
  kvSet(`daily:${key}`, rec);
}

/** Called when any session finishes: locks in today's daily result. */
export function recordDailyFinish(state: SessionState, ev: EvaluationResult): void {
  if (!state.is_daily) return;
  const rec = getDailyRecord();
  if (rec && rec.session_id !== state.id) return; // stale session from a past day
  setDailyRecord({
    session_id: state.id,
    finished: true,
    points: ev.arcade?.points ?? null,
  });
}
