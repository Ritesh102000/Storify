import { execute, executeBatch, queryOne, queryRows } from "@/db/runtime";
import { createId } from "@/lib/id";
import type {
  ForgedCharacter,
  ForgedCharacterSummary,
  Origin,
  PortraitStyle,
  StoryBinding,
} from "./types";
import { ORIGINS } from "./types";

let ready: Promise<void> | null = null;

// Portraits live in their own table so listing the library never drags image
// data along. Forge owns both tables; it does not touch the story engine's.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS forged_characters (
    character_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    archetype TEXT NOT NULL,
    origin TEXT NOT NULL,
    has_portrait INTEGER NOT NULL DEFAULT 0,
    times_cast INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS forged_characters_updated_idx
    ON forged_characters(updated_at)`,
  `CREATE TABLE IF NOT EXISTS forged_portraits (
    character_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL,
    image_base64 TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

async function ensureForgeSchema(): Promise<void> {
  if (!ready) {
    ready = executeBatch(STATEMENTS.map((statement) => ({ text: statement })));
  }
  await ready;
}

export function newCharacterId(): string {
  return createId("char");
}

export async function saveCharacter(
  character: ForgedCharacter,
): Promise<ForgedCharacter> {
  await ensureForgeSchema();
  await execute(
    `INSERT INTO forged_characters
      (character_id, name, payload_json, archetype, origin, has_portrait, times_cast, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
     ON CONFLICT(character_id) DO UPDATE SET
       name = excluded.name,
       payload_json = excluded.payload_json,
       archetype = excluded.archetype,
       origin = excluded.origin,
       has_portrait = excluded.has_portrait,
       times_cast = excluded.times_cast,
       updated_at = excluded.updated_at`,
    [
      character.character_id,
      character.name,
      JSON.stringify(character),
      character.archetype,
      character.origin,
      character.has_portrait ? 1 : 0,
      character.times_cast,
      character.created_at,
      character.updated_at,
    ],
  );
  return character;
}

export async function listCharacters(): Promise<ForgedCharacterSummary[]> {
  await ensureForgeSchema();
  const rows = await queryRows<{ payload_json: string }>(
    `SELECT payload_json FROM forged_characters ORDER BY updated_at DESC LIMIT 200`,
  );
  return rows.map((row) => {
    const full = parseStoredCharacter(row.payload_json);
    return {
      character_id: full.character_id,
      name: full.name,
      role: full.role,
      archetype: full.archetype,
      want: full.want,
      has_portrait: full.has_portrait,
      origin: full.origin,
      story_binding: full.story_binding,
      times_cast: full.times_cast,
      updated_at: full.updated_at,
    };
  });
}

export async function getCharacter(
  characterId: string,
): Promise<ForgedCharacter | null> {
  await ensureForgeSchema();
  const row = await queryOne<{ payload_json: string }>(
    `SELECT payload_json FROM forged_characters WHERE character_id = ?1`,
    [characterId],
  );
  return row ? parseStoredCharacter(row.payload_json) : null;
}

export async function deleteCharacter(characterId: string): Promise<void> {
  await ensureForgeSchema();
  // Row and portrait go together — deletion must not leave an orphan image.
  await executeBatch([
    {
      text: `DELETE FROM forged_characters WHERE character_id = ?1`,
      values: [characterId],
    },
    {
      text: `DELETE FROM forged_portraits WHERE character_id = ?1`,
      values: [characterId],
    },
  ]);
}

export async function savePortrait(input: {
  characterId: string;
  mediaType: string;
  base64: string;
}): Promise<void> {
  await ensureForgeSchema();
  await execute(
    `INSERT INTO forged_portraits (character_id, media_type, image_base64, created_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(character_id) DO UPDATE SET
       media_type = excluded.media_type,
       image_base64 = excluded.image_base64,
       created_at = excluded.created_at`,
    [input.characterId, input.mediaType, input.base64, new Date().toISOString()],
  );
}

export async function getPortrait(
  characterId: string,
): Promise<{ mediaType: string; base64: string } | null> {
  await ensureForgeSchema();
  const row = await queryOne<{
    media_type: string;
    image_base64: string;
  }>(
    `SELECT media_type, image_base64 FROM forged_portraits WHERE character_id = ?1`,
    [characterId],
  );
  return row ? { mediaType: row.media_type, base64: row.image_base64 } : null;
}

export async function markPortraitStyle(
  character: ForgedCharacter,
  style: PortraitStyle,
): Promise<ForgedCharacter> {
  const updated: ForgedCharacter = {
    ...character,
    portrait_style: style,
    has_portrait: true,
    updated_at: new Date().toISOString(),
  };
  return saveCharacter(updated);
}

/**
 * Stored characters predate story bindings and some very early local records
 * may not include origin. Keep those records readable without a destructive
 * migration.
 */
function parseStoredCharacter(payload: string): ForgedCharacter {
  const parsed = JSON.parse(payload) as ForgedCharacter & {
    origin?: Origin;
    story_binding?: StoryBinding;
  };
  return {
    ...parsed,
    origin:
      parsed.origin && ORIGINS.includes(parsed.origin)
        ? parsed.origin
        : "interviewed",
    story_binding: validStoryBinding(parsed.story_binding)
      ? parsed.story_binding
      : undefined,
  };
}

function validStoryBinding(value: StoryBinding | undefined): value is StoryBinding {
  return Boolean(
    value &&
      typeof value.universe_id === "string" &&
      typeof value.template_id === "string" &&
      typeof value.title === "string" &&
      typeof value.genre === "string",
  );
}
