import { commitChoice } from "@/lib/domain/commands";
import {
  appendStoryTurn,
  assertSchemaV2,
  buildFastTurnPacket,
  prepareArcForTurn,
  toWorldView,
} from "@/lib/domain/state";
import {
  commitFallbackSimulation,
  fallbackStoryTurn,
} from "@/lib/domain/fallbacks";
import { chooseRequestSchema } from "@/lib/schemas";
import { ApiError, errorResponse } from "@/lib/server/api";
import { retrieveForTurn } from "@/lib/server/retrieval";
import { getWorld, saveWorld } from "@/lib/server/store";
import { orchestrateStoryTurn } from "@/lib/server/story-orchestrator";

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
    let generated;
    try {
      generated = await orchestrateStoryTurn(
        committed.session,
        committed.event,
        packet,
      );
    } catch (error) {
      const fallbackDraft = fallbackStoryTurn(
        committed.session,
        committed.event,
      );
      commitFallbackSimulation(
        committed.session,
        committed.event,
        fallbackDraft,
      );
      generated = {
        draft: fallbackDraft,
        critique: {
          valid: false,
          errors: [],
          repair_instructions: [],
        },
        generation: {
        status: "layered_fallback" as const,
        provider: "fixture" as const,
        model: "simulator-fallback",
        latency_ms: 0,
        used_fallback: true,
        fallback_reason:
          error instanceof Error
            ? `Simulator pipeline: ${error.message}`
            : "Simulator pipeline failed.",
        },
      };
    }
    if (committed.session.last_context_trace) {
      committed.session.last_context_trace.proposal_count =
        generated.draft.choice_proposals.length;
      committed.session.last_context_trace.valid_choice_count =
        generated.draft.choice_proposals.length;
    }
    // appendStoryTurn revalidates the draft. If that rejects a generated scene
    // the turn must still resolve, otherwise the listener is stuck on a choice
    // that fails identically on every retry.
    let updated;
    try {
      updated = appendStoryTurn(
        committed.session,
        committed.event,
        generated.draft,
      );
    } catch (error) {
      if (generated.generation.used_fallback) throw error;
      const rescueSession = commitChoice(current, input.choice_id).session;
      prepareArcForTurn(rescueSession);
      rescueSession.last_context_trace = trace;
      const rescueDraft = fallbackStoryTurn(rescueSession, committed.event);
      commitFallbackSimulation(rescueSession, committed.event, rescueDraft);
      updated = appendStoryTurn(rescueSession, committed.event, rescueDraft);
      generated.generation = {
        status: "layered_fallback" as const,
        provider: "fixture" as const,
        model: "simulator-fallback",
        latency_ms: generated.generation.latency_ms,
        used_fallback: true,
        fallback_reason: `Generated scene failed final validation: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      };
    }
    updated.generation = generated.generation;
    await saveWorld(updated);

    return Response.json({ world: toWorldView(updated) });
  } catch (error) {
    return errorResponse(error);
  }
}
