import { env } from "cloudflare:workers";

let schemaReady: Promise<void> | null = null;

const statements = [
  `CREATE TABLE IF NOT EXISTS world_previews (
    preview_id TEXT PRIMARY KEY,
    template_id TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS world_sessions (
    universe_id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    template_id TEXT,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS world_sessions_branch_idx
    ON world_sessions(branch_id)`,
  `CREATE TABLE IF NOT EXISTS generation_logs (
    log_id TEXT PRIMARY KEY,
    universe_id TEXT,
    operation TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    latency_ms TEXT NOT NULL,
    used_fallback TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS detective_sessions (
    case_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS detective_sessions_updated_idx
    ON detective_sessions(updated_at)`,
];

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = env.DB.batch(
      statements.map((statement) => env.DB.prepare(statement)),
    ).then(() => undefined);
  }

  await schemaReady;
}
