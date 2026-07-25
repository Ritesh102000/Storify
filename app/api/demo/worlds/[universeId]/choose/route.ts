import { commitChoice } from "@/lib/domain/commands";
import {
  appendStoryTurn,
  buildFastTurnPacket,
  toWorldView,
} from "@/lib/domain/state";
import { chooseRequestSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/server/api";
import { generateStoryTurn } from "@/lib/server/openai";
import { getWorld, saveWorld } from "@/lib/server/store";

type RouteContext = { params: Promise<{ universeId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const input = chooseRequestSchema.parse(await request.json());
    const current = await getWorld(universeId);
    if (!current) {
      throw new ApiError(404, "WORLD_NOT_FOUND", "World not found.");
    }
    if (current.branch_id !== input.branch_id) {
      throw new ApiError(
        409,
        "BRANCH_MISMATCH",
        "Reload the current branch before making this choice.",
      );
    }

    const committed = commitChoice(current, input.choice_id);
    const { packet, trace } = buildFastTurnPacket(
      committed.session,
      committed.event,
    );
    committed.session.last_context_trace = trace;
    const generated = await generateStoryTurn(
      committed.session,
      committed.event,
      packet,
    );
    const updated = appendStoryTurn(
      committed.session,
      committed.event,
      generated.draft,
    );
    updated.generation = generated.generation;
    await saveWorld(updated);

    return Response.json({ world: toWorldView(updated) });
  } catch (error) {
    return errorResponse(error);
  }
}
