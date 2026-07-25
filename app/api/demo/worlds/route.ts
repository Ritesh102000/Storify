import { materializeWorld, toWorldView } from "@/lib/domain/state";
import { createWorldRequestSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/server/api";
import { getPreview, saveWorld } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    const input = createWorldRequestSchema.parse(await request.json());
    const preview = await getPreview(input.preview_id);
    if (!preview) {
      throw new ApiError(
        404,
        "PREVIEW_NOT_FOUND",
        "That world preview has expired. Generate it again.",
      );
    }
    const world = materializeWorld(preview);
    await saveWorld(world);
    return Response.json({ world: toWorldView(world) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
