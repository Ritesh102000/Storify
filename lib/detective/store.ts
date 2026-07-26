import { env } from "cloudflare:workers";
import { ensureSchema } from "@/db/ensure-schema";
import { DetectiveError } from "./errors";
import { detectiveSessionSchema } from "./schemas";
import type { DetectiveCaseSession } from "./types";

export async function insertDetectiveCase(
  session: DetectiveCaseSession,
): Promise<void> {
  await ensureSchema();
  await env.DB.prepare(
    `INSERT INTO detective_sessions
      (case_id, revision, status, payload_json, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(
      session.case_id,
      session.revision,
      session.status,
      JSON.stringify(session),
      session.created_at,
      session.updated_at,
    )
    .run();
}

export async function getDetectiveCase(
  caseId: string,
): Promise<DetectiveCaseSession | null> {
  await ensureSchema();
  const row = await env.DB.prepare(
    `SELECT payload_json FROM detective_sessions WHERE case_id = ?1`,
  )
    .bind(caseId)
    .first<{ payload_json: string }>();
  if (!row) return null;

  try {
    return detectiveSessionSchema.parse(JSON.parse(row.payload_json));
  } catch {
    throw new DetectiveError(
      500,
      "CASE_STORAGE_INVALID",
      "The stored case file could not be read.",
    );
  }
}

/**
 * Compare-and-swap prevents two overlapping browser actions from both
 * committing against the same private case state.
 */
export async function updateDetectiveCase(
  session: DetectiveCaseSession,
  expectedRevision: number,
): Promise<void> {
  await ensureSchema();
  if (session.revision !== expectedRevision + 1) {
    throw new DetectiveError(
      500,
      "CASE_REVISION_INVALID",
      "The case revision is invalid.",
    );
  }

  const result = await env.DB.prepare(
    `UPDATE detective_sessions
        SET revision = ?1,
            status = ?2,
            payload_json = ?3,
            updated_at = ?4
      WHERE case_id = ?5 AND revision = ?6
      RETURNING revision`,
  )
    .bind(
      session.revision,
      session.status,
      JSON.stringify(session),
      session.updated_at,
      session.case_id,
      expectedRevision,
    )
    .run<{ revision: number }>();

  if (result.results?.length !== 1) {
    throw new DetectiveError(
      409,
      "CASE_CONFLICT",
      "The case changed in another tab. Reopen it and try again.",
    );
  }
}
