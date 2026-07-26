import { detectiveErrorResponse } from "@/lib/detective/api";
import { createDetectiveSession, toDetectiveCaseView } from "@/lib/detective/engine";
import { generateDetectiveCase } from "@/lib/detective/openai";
import { detectiveCreateSchema } from "@/lib/detective/schemas";
import { insertDetectiveCase } from "@/lib/detective/store";

export async function POST(request: Request) {
  try {
    const input = detectiveCreateSchema.parse(await request.json());
    const generated = await generateDetectiveCase(input);
    const session = createDetectiveSession(
      input,
      generated.draft,
      generated.generation,
    );
    await insertDetectiveCase(session);
    return Response.json(
      { case: toDetectiveCaseView(session) },
      { status: 201 },
    );
  } catch (error) {
    return detectiveErrorResponse(error);
  }
}
