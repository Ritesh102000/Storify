import { createId } from "@/lib/id";
import { spinOffRequestSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/server/api";
import { generateSpinOff } from "@/lib/server/openai";
import { getWorld, saveWorld } from "@/lib/server/store";
import type { SpinOff } from "@/lib/types";

type RouteContext = { params: Promise<{ universeId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const input = spinOffRequestSchema.parse(await request.json());
    const world = await getWorld(universeId);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", "World not found.");
    }
    if (world.branch_id !== input.source_branch_id) {
      throw new ApiError(
        409,
        "BRANCH_MISMATCH",
        "This spin-off must use the current private branch.",
      );
    }
    const event = world.events.find(
      (candidate) => candidate.event_id === input.source_event_id,
    );
    if (!event) {
      throw new ApiError(404, "EVENT_NOT_FOUND", "Source event not found.");
    }
    const character = world.characters.find(
      (candidate) => candidate.character_id === input.character_id,
    );
    if (!character) {
      throw new ApiError(404, "CHARACTER_NOT_FOUND", "Character not found.");
    }
    const existing = world.spin_offs.find(
      (spinOff) =>
        spinOff.source_event_id === input.source_event_id &&
        spinOff.protagonist_character_id === input.character_id,
    );
    if (existing) return Response.json({ spin_off: existing });

    const generated = await generateSpinOff(world, character.character_id, event);
    const spinOff: SpinOff = {
      spin_off_id: createId("spin"),
      storyline_id: createId("story"),
      branch_id: createId("branch"),
      title: generated.title,
      protagonist_character_id: character.character_id,
      source_branch_id: world.branch_id,
      source_event_id: event.event_id,
      visibility: "private",
      depth: 1,
      opening_narration: generated.opening_narration,
      inherited_memory_ids: world.memories
        .filter((memory) => memory.character_id === character.character_id)
        .slice(-5)
        .map((memory) => memory.memory_id),
      created_at: new Date().toISOString(),
    };
    world.spin_offs.push(spinOff);
    await saveWorld(world);
    return Response.json({ spin_off: spinOff }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
