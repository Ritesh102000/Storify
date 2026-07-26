import { detectiveErrorResponse } from "@/lib/detective/api";
import {
  resolveDetectiveAccusation,
  toDetectiveCaseView,
} from "@/lib/detective/engine";
import { DetectiveError } from "@/lib/detective/errors";
import {
  detectiveAccusationSchema,
  detectiveIdentifierSchema,
} from "@/lib/detective/schemas";
import {
  getDetectiveCase,
  updateDetectiveCase,
} from "@/lib/detective/store";

type Context = { params: Promise<{ caseId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { caseId: rawCaseId } = await context.params;
    const caseId = detectiveIdentifierSchema.parse(rawCaseId);
    const accusation = detectiveAccusationSchema.parse(await request.json());
    const session = await getDetectiveCase(caseId);
    if (!session) {
      throw new DetectiveError(404, "CASE_NOT_FOUND", "That case file was not found.");
    }

    const next = resolveDetectiveAccusation(session, accusation);
    await updateDetectiveCase(next, session.revision);
    return Response.json({ case: toDetectiveCaseView(next) });
  } catch (error) {
    return detectiveErrorResponse(error);
  }
}
