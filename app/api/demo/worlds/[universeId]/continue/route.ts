import {
  assertSchemaV2,
  continueWorldArc,
  toWorldView,
} from "@/lib/domain/state";
import { continueWorldRequestSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/server/api";
import { getWorld, saveWorld } from "@/lib/server/store";

type RouteContext = { params: Promise<{ universeId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const input = continueWorldRequestSchema.parse(await request.json());
    const world = await getWorld(universeId);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", "World not found.");
    }
    assertSchemaV2(world);
    if (world.branch_id !== input.branch_id) {
      throw new ApiError(
        409,
        "BRANCH_MISMATCH",
        "Reload the current branch before continuing.",
      );
    }
    if (world.arc_state.status !== "completed") {
      throw new ApiError(
        409,
        "ARC_NOT_COMPLETE",
        "Resolve the current arc before continuing in this world.",
      );
    }
    const continued = continueWorldArc(world);
    await saveWorld(continued);
    return Response.json({ world: toWorldView(continued) });
  } catch (error) {
    return errorResponse(error);
  }
}
