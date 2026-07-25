import { currentScene } from "@/lib/domain/state";
import { ApiError, errorResponse } from "@/lib/server/api";
import { synthesizeSpeech } from "@/lib/server/openai";
import { getWorld } from "@/lib/server/store";

type RouteContext = { params: Promise<{ universeId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const world = await getWorld(universeId);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", "World not found.");
    }
    const scene = currentScene(world);
    const characterNames = new Map(
      world.characters.map((character) => [
        character.character_id,
        character.name,
      ]),
    );
    const script = [
      scene.narration,
      ...scene.dialogue.map(
        (line) =>
          `${characterNames.get(line.character_id) ?? "Character"}: ${line.text}`,
      ),
    ].join("\n");
    const audio = await synthesizeSpeech(script);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, no-store",
        "X-AI-Generated-Voice": "true",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
