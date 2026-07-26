import { ensureSchema } from "@/db/ensure-schema";
import { execute, queryOne } from "@/db/runtime";
import type { WorldPreview, WorldSession } from "../types";
import { createId } from "../id";

export async function savePreview(preview: WorldPreview): Promise<void> {
  await ensureSchema();
  await execute(
    `INSERT INTO world_previews
      (preview_id, template_id, payload_json, created_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(preview_id) DO UPDATE SET
       template_id = excluded.template_id,
       payload_json = excluded.payload_json,
       created_at = excluded.created_at`,
    [
      preview.preview_id,
      preview.resolved_template_id,
      JSON.stringify(preview),
      preview.created_at,
    ],
  );
}

export async function getPreview(
  previewId: string,
): Promise<WorldPreview | null> {
  await ensureSchema();
  const row = await queryOne<{ payload_json: string }>(
    `SELECT payload_json FROM world_previews WHERE preview_id = ?1`,
    [previewId],
  );
  return row ? (JSON.parse(row.payload_json) as WorldPreview) : null;
}

export async function saveWorld(session: WorldSession): Promise<void> {
  await ensureSchema();
  session.updated_at = new Date().toISOString();
  await execute(
    `INSERT INTO world_sessions
      (universe_id, branch_id, template_id, payload_json, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(universe_id) DO UPDATE SET
       branch_id = excluded.branch_id,
       template_id = excluded.template_id,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at`,
    [
      session.universe_id,
      session.branch_id,
      session.template_id,
      JSON.stringify(session),
      session.created_at,
      session.updated_at,
    ],
  );
}

export async function getWorld(
  universeId: string,
): Promise<WorldSession | null> {
  await ensureSchema();
  const row = await queryOne<{ payload_json: string }>(
    `SELECT payload_json FROM world_sessions WHERE universe_id = ?1`,
    [universeId],
  );
  return row ? (JSON.parse(row.payload_json) as WorldSession) : null;
}

export async function deleteWorld(universeId: string): Promise<void> {
  await ensureSchema();
  await execute(`DELETE FROM world_sessions WHERE universe_id = ?1`, [
    universeId,
  ]);
}

export async function logGeneration(input: {
  universeId?: string;
  operation: "world_builder" | "story_turn" | "repair" | "speech" | "moderation";
  provider: "openai" | "fixture";
  model: string;
  status: string;
  latencyMs: number;
  usedFallback: boolean;
}): Promise<void> {
  try {
    await ensureSchema();
    await execute(
      `INSERT INTO generation_logs
        (log_id, universe_id, operation, provider, model, status, latency_ms, used_fallback, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      [
        createId("log"),
        input.universeId ?? null,
        input.operation,
        input.provider,
        input.model,
        input.status,
        String(input.latencyMs),
        input.usedFallback ? "true" : "false",
        new Date().toISOString(),
      ],
    );
  } catch {
    // Generation logs must never break the story path.
  }
}
