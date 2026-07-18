import type { Scenario } from "./content/schema";
import type { EvaluationResult, SessionState } from "./types";
import { expireIfNeeded } from "./engine/session";
import { evaluateSession } from "./engine/evaluate";
import { saveEvaluation, saveSession } from "./db/sessions";
import { recordScenarioResult } from "./progress";
import { recordDailyFinish } from "./daily";
import { track } from "./analytics";

/** Everything that must happen exactly once when a session ends:
 * evaluate deterministically, persist, record progress + daily lock-in. */
export function recordFinished(
  scenario: Scenario,
  state: SessionState
): EvaluationResult {
  const evaluation = evaluateSession(scenario, state);
  saveEvaluation(state.id, evaluation, null);
  recordScenarioResult(scenario.id, evaluation);
  recordDailyFinish(state, evaluation);
  track("scenario_completed", state.id, {
    outcome: state.outcome?.type,
    total: evaluation.total,
    turns: state.turn,
  });
  return evaluation;
}

/** Blitz: if the wall-clock deadline has passed, end + persist + record.
 * Returns true when the session was just finalized. Safe to call anywhere a
 * session is loaded — a no-op for finished or deadline-free sessions. */
export function settleExpiry(scenario: Scenario, state: SessionState): boolean {
  if (!expireIfNeeded(scenario, state)) return false;
  saveSession(state);
  recordFinished(scenario, state);
  return true;
}
