import { db } from "./db/db";

/**
 * Analytics — a simple internal event table, enough to evaluate the product
 * hypothesis without invasive tracking. Derived metrics are computed on read
 * in the admin dashboard.
 */

export type AnalyticsEvent =
  | "lesson_started"
  | "lesson_completed"
  | "quiz_passed"
  | "quiz_failed"
  | "scenario_started"
  | "preparation_completed"
  | "message_sent"
  | "move_probe"
  | "move_flinch"
  | "move_silence"
  | "offer_final_declared"
  | "offer_made"
  | "offer_accepted"
  | "offer_rejected"
  | "walk_away_selected"
  | "scenario_completed"
  | "debrief_viewed"
  | "scenario_replayed"
  | "session_abandoned"
  | "ai_fallback_used"
  | "ai_guardrail_triggered";

export function track(
  type: AnalyticsEvent,
  sessionId: string | null = null,
  payload: Record<string, unknown> = {}
): void {
  try {
    db()
      .prepare(
        "INSERT INTO events (session_id, type, payload_json, created_at) VALUES (?, ?, ?, ?)"
      )
      .run(sessionId, type, JSON.stringify(payload), new Date().toISOString());
  } catch {
    // Analytics must never break the product path.
  }
}
