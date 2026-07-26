import { detectiveErrorResponse } from "@/lib/detective/api";
import { toDetectiveCaseView } from "@/lib/detective/engine";
import { DetectiveError } from "@/lib/detective/errors";
import { detectiveIdentifierSchema } from "@/lib/detective/schemas";
import { getDetectiveCase } from "@/lib/detective/store";

type Context = { params: Promise<{ caseId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { caseId: rawCaseId } = await context.params;
    const caseId = detectiveIdentifierSchema.parse(rawCaseId);
    const session = await getDetectiveCase(caseId);
    if (!session) {
      throw new DetectiveError(404, "CASE_NOT_FOUND", "That case file was not found.");
    }
    return Response.json({ case: toDetectiveCaseView(session) });
  } catch (error) {
    return detectiveErrorResponse(error);
  }
}
