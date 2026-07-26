import { detectiveErrorResponse } from "@/lib/detective/api";
import {
  applyDetectiveAction,
  prepareInterrogation,
  toDetectiveCaseView,
} from "@/lib/detective/engine";
import { DetectiveError } from "@/lib/detective/errors";
import { generateDetectiveReply } from "@/lib/detective/openai";
import {
  detectiveActionSchema,
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
    const action = detectiveActionSchema.parse(await request.json());
    const session = await getDetectiveCase(caseId);
    if (!session) {
      throw new DetectiveError(404, "CASE_NOT_FOUND", "That case file was not found.");
    }

    const interrogationReply =
      action.action_type === "interrogate"
        ? await generateDetectiveReply(
            prepareInterrogation(session, action).context,
          )
        : undefined;
    const next = applyDetectiveAction(session, action, {
      ...(interrogationReply
        ? { interrogation_reply: interrogationReply }
        : {}),
    });
    await updateDetectiveCase(next, session.revision);
    return Response.json({ case: toDetectiveCaseView(next) });
  } catch (error) {
    return detectiveErrorResponse(error);
  }
}
