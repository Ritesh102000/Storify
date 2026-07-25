import { assertSchemaV2, toWorldView } from "@/lib/domain/state";
import { ApiError, errorResponse } from "@/lib/server/api";
import { getWorld } from "@/lib/server/store";

type RouteContext = { params: Promise<{ universeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const world = await getWorld(universeId);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", "World not found.");
    }
    assertSchemaV2(world);
    return Response.json({ world: toWorldView(world) });
  } catch (error) {
    return errorResponse(error);
  }
}
