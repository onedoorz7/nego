import { kvGet, kvSet } from "./db/db";
import { getPath, listLessons, listScenarios } from "./content/loader";
import type { EvaluationResult } from "./types";

/**
 * Progress engine — single local demo user. Tracks lesson completions, quiz
 * passes, scenario completions/best scores, XP, and per-skill EWMA scores.
 * Unlocking: lessons unlock in path order once the previous quiz is passed;
 * scenarios unlock with their linked lesson (NEGO_UNLOCK_ALL=1 opens all).
 */

export interface ProgressData {
  xp: number;
  lessons: Record<string, { completed_at: string; quiz_passed: boolean }>;
  scenarios: Record<
    string,
    { attempts: number; best_total: number; last_total: number; completed_at: string }
  >;
  skills: Record<string, number>; // score-category key → EWMA 0-100
}

const KEY = "progress";
const EMPTY: ProgressData = { xp: 0, lessons: {}, scenarios: {}, skills: {} };

export function getProgress(): ProgressData {
  return kvGet<ProgressData>(KEY, EMPTY);
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
    p.xp += p.lessons[lessonId] ? 15 : 15;
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
  p.scenarios[scenarioId] = {
    attempts: (prev?.attempts ?? 0) + 1,
    best_total: Math.max(prev?.best_total ?? 0, ev.total),
    last_total: ev.total,
    completed_at: new Date().toISOString(),
  };
  p.xp += ev.xp + (firstCompletion ? 30 : 0);
  // EWMA skill update per score category.
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

export interface PathStep {
  lesson_id: string;
  scenario_id: string | null;
  lesson_unlocked: boolean;
  lesson_done: boolean;
  scenario_done: boolean;
}

export function getLearningPath(): PathStep[] {
  const unlockAll = process.env.NEGO_UNLOCK_ALL === "1";
  const path = getPath();
  const lessons = new Map(listLessons().map((l) => [l.id, l]));
  const p = getProgress();

  const steps: PathStep[] = [];
  let previousPassed = true; // first lesson always unlocked
  for (const lessonId of path.lessons) {
    const lesson = lessons.get(lessonId);
    if (!lesson) continue;
    const done = !!p.lessons[lessonId]?.quiz_passed;
    steps.push({
      lesson_id: lessonId,
      scenario_id: lesson.scenario_id,
      lesson_unlocked: unlockAll || previousPassed,
      lesson_done: done,
      scenario_done: lesson.scenario_id
        ? !!p.scenarios[lesson.scenario_id]
        : false,
    });
    previousPassed = done;
  }
  return steps;
}

export function isScenarioUnlocked(scenarioId: string): boolean {
  if (process.env.NEGO_UNLOCK_ALL === "1") return true;
  const steps = getLearningPath();
  const step = steps.find((s) => s.scenario_id === scenarioId);
  // Scenarios not on the path (or whose lesson is unlocked) are playable.
  if (!step) return true;
  return step.lesson_unlocked;
}

export function scenarioSummaries() {
  const p = getProgress();
  return listScenarios().map((s) => ({
    id: s.id,
    title: s.title,
    emoji: s.emoji,
    tagline: s.tagline,
    difficulty: s.difficulty,
    concepts: s.concepts,
    unlocked: isScenarioUnlocked(s.id),
    best_total: p.scenarios[s.id]?.best_total ?? null,
    attempts: p.scenarios[s.id]?.attempts ?? 0,
  }));
}
