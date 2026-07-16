import fs from "node:fs";
import path from "node:path";
import {
  LessonSchema,
  PathSchema,
  ScenarioSchema,
  type Lesson,
  type LearningPath,
  type Scenario,
} from "./schema";

/**
 * Content loader — reads and validates JSON content files.
 * Content lives in <repo>/content and is editable without code changes.
 * Files are re-read when their mtime changes (so founder edits show up on
 * refresh in dev without restarting).
 */

const CONTENT_DIR = path.join(process.cwd(), "content");

interface CacheEntry<T> {
  mtime: number;
  value: T;
}

const g = globalThis as unknown as {
  __negoContentCache?: Map<string, CacheEntry<unknown>>;
};
const cache = (g.__negoContentCache ??= new Map());

function loadJson<T>(file: string, parse: (raw: unknown) => T): T {
  const mtime = fs.statSync(file).mtimeMs;
  const hit = cache.get(file) as CacheEntry<T> | undefined;
  if (hit && hit.mtime === mtime) return hit.value;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const value = parse(raw);
  cache.set(file, { mtime, value });
  return value;
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(dir, f))
    .sort();
}

export function listScenarios(): Scenario[] {
  return listJsonFiles(path.join(CONTENT_DIR, "scenarios"))
    .map((f) => loadJson(f, (raw) => ScenarioSchema.parse(raw)))
    .sort((a, b) => a.difficulty - b.difficulty || a.id.localeCompare(b.id));
}

export function getScenario(id: string): Scenario {
  const file = path.join(CONTENT_DIR, "scenarios", `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`Unknown scenario: ${id}`);
  return loadJson(file, (raw) => ScenarioSchema.parse(raw));
}

export function listLessons(): Lesson[] {
  return listJsonFiles(path.join(CONTENT_DIR, "lessons"))
    .map((f) => loadJson(f, (raw) => LessonSchema.parse(raw)))
    .sort((a, b) => a.order - b.order);
}

export function getLesson(id: string): Lesson {
  const file = path.join(CONTENT_DIR, "lessons", `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`Unknown lesson: ${id}`);
  return loadJson(file, (raw) => LessonSchema.parse(raw));
}

export function getPath(): LearningPath {
  const file = path.join(CONTENT_DIR, "path.json");
  return loadJson(file, (raw) => PathSchema.parse(raw));
}
