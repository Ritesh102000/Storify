import { ApiError, errorResponse } from "@/lib/server/api";
import { deleteWorld, getWorld } from "@/lib/server/store";

type RouteContext = { params: Promise<{ universeId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { universeId } = await context.params;
    const world = await getWorld(universeId);
    if (!world) {
      throw new ApiError(404, "WORLD_NOT_FOUND", "World not found.");
    }
    await deleteWorld(universeId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
