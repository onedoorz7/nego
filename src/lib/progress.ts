import { kvGet, kvSet } from "./db/db";
import { getPath, listLessons, listScenarios } from "./content/loader";
import type { EvaluationResult } from "./types";

/**
 * Progress engine — single local demo user, game-first.
 * The headline number is arcade POINTS (best per round, summed into a total).
 * Rounds unlock by playing: close any deal in a round to open the next.
 * Lessons are never a gate — they're optional reference material.
 */

export interface ProgressData {
  xp: number;
  lessons: Record<string, { completed_at: string; quiz_passed: boolean }>;
  scenarios: Record<
    string,
    {
      attempts: number;
      best_total: number; // best analysis score (0-100)
      last_total: number;
      best_points: number; // best arcade points — the number that unlocks
      last_points: number;
      completed_at: string;
    }
  >;
  skills: Record<string, number>; // score-category key → EWMA 0-100
}

const KEY = "progress";
const EMPTY: ProgressData = { xp: 0, lessons: {}, scenarios: {}, skills: {} };

export function getProgress(): ProgressData {
  const p = kvGet<ProgressData>(KEY, EMPTY);
  // Migrate pre-arcade records gracefully.
  for (const rec of Object.values(p.scenarios)) {
    rec.best_points ??= 0;
    rec.last_points ??= 0;
  }
  return p;
}

export function totalPoints(p: ProgressData = getProgress()): number {
  return Object.values(p.scenarios).reduce((s, r) => s + (r.best_points ?? 0), 0);
}

export function resetProgress(): void {
  kvSet(KEY, EMPTY);
}

export function recordQuizResult(lessonId: string, passed: boolean): ProgressData {
  const p = getProgress();
  if (passed) {
    p.lessons[lessonId] = {
      completed_at: new Date().toISOString(),
      quiz_passed: true,
    };
    p.xp += 15;
  }
  kvSet(KEY, p);
  return p;
}

export function recordScenarioResult(
  scenarioId: string,
  ev: EvaluationResult
): ProgressData {
  const p = getProgress();
  const prev = p.scenarios[scenarioId];
  const firstCompletion = !prev;
  const points = ev.arcade?.points ?? 0;
  p.scenarios[scenarioId] = {
    attempts: (prev?.attempts ?? 0) + 1,
    best_total: Math.max(prev?.best_total ?? 0, ev.total),
    last_total: ev.total,
    best_points: Math.max(prev?.best_points ?? 0, points),
    last_points: points,
    completed_at: new Date().toISOString(),
  };
  p.xp += ev.xp + (firstCompletion ? 30 : 0);
  const ALPHA = 0.4;
  for (const s of ev.scores) {
    const old = p.skills[s.key];
    p.skills[s.key] =
      old === undefined
        ? s.value
        : Math.round((ALPHA * s.value + (1 - ALPHA) * old) * 10) / 10;
  }
  kvSet(KEY, p);
  return p;
}

/** Rounds in play order (by difficulty). A round unlocks when the previous
 * round has ever produced a deal (best_points > 0). First round always open.
 * Lab scenarios live outside this progression (see labList). */
export function roundList() {
  const unlockAll = process.env.NEGO_UNLOCK_ALL === "1";
  const p = getProgress();
  const scenarios = listScenarios().filter((s) => !s.lab); // sorted by difficulty
  return scenarios.map((s, i) => {
    const prevRec = i > 0 ? p.scenarios[scenarios[i - 1].id] : null;
    const unlocked = unlockAll || i === 0 || (prevRec?.best_points ?? 0) > 0;
    const rec = p.scenarios[s.id];
    return {
      round: i + 1,
      id: s.id,
      title: s.title,
      emoji: s.emoji,
      difficulty: s.difficulty,
      mission: s.arcade?.mission ?? s.tagline,
      unlocked,
      unlock_hint: unlocked
        ? null
        : `Close a deal in Round ${i} to unlock`,
      best_points: rec?.best_points ?? 0,
      attempts: rec?.attempts ?? 0,
    };
  });
}

/** The Lab 🧪 — experimental tables that break the format. Always unlocked,
 * never part of the numbered-round progression. */
export function labList() {
  const p = getProgress();
  return listScenarios()
    .filter((s) => s.lab)
    .map((s) => {
      const rec = p.scenarios[s.id];
      return {
        id: s.id,
        title: s.title,
        emoji: s.emoji,
        mode: s.mode,
        blitz_seconds: s.blitz_seconds ?? null,
        mission: s.arcade?.mission ?? s.tagline,
        best_points: rec?.best_points ?? 0,
        attempts: rec?.attempts ?? 0,
      };
    });
}

export function isScenarioUnlocked(scenarioId: string): boolean {
  if (labList().some((l) => l.id === scenarioId)) return true;
  return roundList().some((r) => r.id === scenarioId && r.unlocked);
}

export interface PathStep {
  lesson_id: string;
  scenario_id: string | null;
  lesson_unlocked: boolean;
  lesson_done: boolean;
  scenario_done: boolean;
}

/** Lessons are all available — optional reading, never a gate. */
export function getLearningPath(): PathStep[] {
  const path = getPath();
  const lessons = new Map(listLessons().map((l) => [l.id, l]));
  const p = getProgress();
  return path.lessons
    .filter((id) => lessons.has(id))
    .map((lessonId) => {
      const lesson = lessons.get(lessonId)!;
      return {
        lesson_id: lessonId,
        scenario_id: lesson.scenario_id,
        lesson_unlocked: true,
        lesson_done: !!p.lessons[lessonId]?.quiz_passed,
        scenario_done: lesson.scenario_id
          ? !!p.scenarios[lesson.scenario_id]
          : false,
      };
    });
}

export function scenarioSummaries() {
  return roundList();
}
