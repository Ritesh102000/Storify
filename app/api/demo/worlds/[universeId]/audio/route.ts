import { assertSchemaV2, currentScene } from "@/lib/domain/state";
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
    assertSchemaV2(world);
    const scene = currentScene(world);
    const characterNames = new Map(
      world.characters.map((character) => [
        character.character_id,
        character.name,
      ]),
    );
    // Preserve the same narrator/dialogue order shown in the reader. The old
    // route put all narration first and all dialogue last, which changed the
    // meaning of the scene when it was spoken.
    const orderedBlocks = scene.story_blocks?.length
      ? scene.story_blocks
      : [
          {
            block_type: "narration" as const,
            character_id: null,
            text: scene.narration,
            responds_to_previous: false,
          },
          ...scene.dialogue.map((line) => ({
            block_type: "dialogue" as const,
            character_id: line.character_id,
            text: line.text,
            responds_to_previous: line.responds_to_previous,
          })),
        ];
    const script = orderedBlocks
      .map((block) =>
        block.block_type === "dialogue" && block.character_id
          ? `${characterNames.get(block.character_id) ?? "Character"} says: ${
              block.text
            }`
          : block.text,
      )
      .join("\n");
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
