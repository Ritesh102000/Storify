import { commitChoice } from "@/lib/domain/commands";
import {
  appendStoryTurn,
  assertSchemaV2,
  buildFastTurnPacket,
  isRepetitiveStoryTurn,
  prepareArcForTurn,
  toWorldView,
  validateStoryTurnReferences,
} from "@/lib/domain/state";
import { fallbackStoryTurn } from "@/lib/domain/fallbacks";
import { chooseRequestSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/server/api";
import { generateStoryTurn } from "@/lib/server/openai";
import { retrieveForTurn } from "@/lib/server/retrieval";
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
    assertSchemaV2(current);
    if (current.branch_id !== input.branch_id) {
      throw new ApiError(
        409,
        "BRANCH_MISMATCH",
        "Reload the current branch before making this choice.",
      );
    }

    const committed = commitChoice(current, input.choice_id);
    prepareArcForTurn(committed.session);
    const retrieval = await retrieveForTurn(
      committed.session,
      committed.event,
    );
    const { packet, trace } = buildFastTurnPacket(
      committed.session,
      committed.event,
      retrieval.cards,
      retrieval.trace,
    );
    committed.session.last_context_trace = trace;
    const generated = await generateStoryTurn(
      committed.session,
      committed.event,
      packet,
    );
    try {
      generated.draft = validateStoryTurnReferences(
        committed.session,
        generated.draft,
      );
    } catch (error) {
      generated.draft = fallbackStoryTurn(
        committed.session,
        committed.event,
      );
      generated.generation = {
        ...generated.generation,
        status: "layered_fallback",
        provider: "fixture",
        model: "continuity-fallback",
        used_fallback: true,
        fallback_reason:
          error instanceof Error
            ? `Continuity validation: ${error.message}`
            : "Continuity validation failed.",
      };
    }
    if (isRepetitiveStoryTurn(committed.session, generated.draft)) {
      generated.draft = fallbackStoryTurn(
        committed.session,
        committed.event,
      );
      generated.generation = {
        ...generated.generation,
        status: "layered_fallback",
        provider: "fixture",
        model: "milestone-causal-fallback",
        used_fallback: true,
        fallback_reason:
          "The generated scene repeated recent narration or plot information.",
      };
    }
    if (committed.session.last_context_trace) {
      committed.session.last_context_trace.proposal_count =
        generated.draft.choice_proposals.length;
      committed.session.last_context_trace.valid_choice_count =
        generated.draft.choice_proposals.length;
    }
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
