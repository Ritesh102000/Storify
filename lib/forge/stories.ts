import { ensureSchema } from "@/db/ensure-schema";
import { queryOne, queryRows } from "@/db/runtime";
import type { ForgeStorySummary } from "./types";

type StoryRow = {
  universe_id: string;
  template_id: string | null;
  payload_json: string;
  updated_at: string;
};

/**
 * Lists only the public design context Character Forge needs. Character
 * secrets, memories, facts, choices, and future arc information never leave
 * this boundary.
 */
export async function listForgeStories(): Promise<ForgeStorySummary[]> {
  await ensureSchema();
  const rows = await queryRows<StoryRow>(
    `SELECT universe_id, template_id, payload_json, updated_at
       FROM world_sessions
      ORDER BY updated_at DESC
      LIMIT 100`,
  );

  return rows
    .map(toSafeSummary)
    .filter((story): story is ForgeStorySummary => story !== null);
}

export async function getForgeStory(
  universeId: string,
): Promise<ForgeStorySummary | null> {
  await ensureSchema();
  const row = await queryOne<StoryRow>(
    `SELECT universe_id, template_id, payload_json, updated_at
       FROM world_sessions
      WHERE universe_id = ?1`,
    [universeId],
  );
  return row ? toSafeSummary(row) : null;
}

function toSafeSummary(row: StoryRow): ForgeStorySummary | null {
  try {
    const parsed = JSON.parse(row.payload_json) as Record<string, unknown>;
    const universe = objectAt(parsed, "universe");
    const story = objectAt(parsed, "story");
    const templateId =
      clean(row.template_id) || clean(parsed.template_id) || "custom";
    const title = clean(universe.title) || "Untitled world";

    return {
      universe_id: row.universe_id,
      template_id: templateId,
      title,
      genre: clean(universe.genre) || "Unspecified genre",
      premise: clean(universe.premise),
      mood: stringArray(universe.mood).slice(0, 8),
      listener_role: clean(story.listener_role),
      main_goal: clean(story.main_goal),
      central_question: clean(story.central_question),
      updated_at: row.updated_at,
    };
  } catch {
    // One old or malformed world must not make the Forge library unusable.
    return null;
  }
}

function objectAt(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const candidate = value[key];
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : {};
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 600) : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().slice(0, 100))
        .filter(Boolean)
    : [];
}
