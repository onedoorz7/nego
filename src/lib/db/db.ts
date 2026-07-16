import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * SQLite store (node:sqlite — zero native deps). Single local demo user.
 * Schema kept deliberately boring and portable so a later move to Postgres is
 * a mechanical change (JSON columns → jsonb, autoincrement → serial).
 */

const DATA_DIR = process.env.NEGO_DATA_DIR || path.join(process.cwd(), "data");

const g = globalThis as unknown as { __negoDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__negoDb) return g.__negoDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const database = new DatabaseSync(path.join(DATA_DIR, "nego.db"));
  migrate(database);
  g.__negoDb = database;
  return database;
}

function migrate(d: DatabaseSync) {
  d.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      state_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS model_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      purpose TEXT NOT NULL,
      provider TEXT NOT NULL,
      request_json TEXT NOT NULL,
      response_raw TEXT,
      ok INTEGER NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      session_id TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      coaching_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_model_calls_session ON model_calls(session_id);
  `);
}

export function kvGet<T>(key: string, fallback: T): T {
  const row = db()
    .prepare("SELECT value_json FROM kv WHERE key = ?")
    .get(key) as { value_json: string } | undefined;
  return row ? (JSON.parse(row.value_json) as T) : fallback;
}

export function kvSet(key: string, value: unknown): void {
  db()
    .prepare(
      "INSERT INTO kv (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json"
    )
    .run(key, JSON.stringify(value));
}
