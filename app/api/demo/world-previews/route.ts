import { worldSetupInputSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/server/api";
import { generateWorldPreview } from "@/lib/server/openai";
import { savePreview } from "@/lib/server/store";

export async function POST(request: Request) {
  try {
    const input = worldSetupInputSchema.parse(await request.json());
    const preview = await generateWorldPreview(input);
    await savePreview(preview);
    return Response.json({ preview }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
