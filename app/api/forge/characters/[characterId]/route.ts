import { patchCharacterSchema } from "@/lib/forge/schemas";
import { deleteCharacter, getCharacter, saveCharacter } from "@/lib/forge/store";
import { forgeError, notFound } from "@/lib/forge/api";

type Ctx = { params: Promise<{ characterId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { characterId } = await context.params;
    const character = await getCharacter(characterId);
    if (!character) return notFound();
    return Response.json({ character });
  } catch (error) {
    return forgeError(error);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { characterId } = await context.params;
    const existing = await getCharacter(characterId);
    if (!existing) return notFound();
    const patch = patchCharacterSchema.parse(await request.json());
    const character = {
      ...existing,
      ...patch,
      appearance: { ...existing.appearance, ...(patch.appearance ?? {}) },
      character_id: existing.character_id,
      updated_at: new Date().toISOString(),
    };
    await saveCharacter(character);
    return Response.json({ character });
  } catch (error) {
    return forgeError(error);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { characterId } = await context.params;
    await deleteCharacter(characterId);
    return Response.json({ deleted: true });
  } catch (error) {
    return forgeError(error);
  }
}
