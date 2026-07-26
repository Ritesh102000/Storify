import { eligibleStorylets } from "@/lib/narrative/storylets";
import { dryRunBeat } from "@/lib/simulation/registry";
import type {
  CandidateDryRun,
  CharacterIntent,
  SimulationTurnContext,
  StoryCritique,
} from "@/lib/simulation/types";
import type {
  FastTurnPacket,
  StoryEvent,
  StoryTurnDraft,
  WorldPreview,
  WorldSession,
} from "@/lib/types";
import {
  isRepetitiveStoryTurn,
  validateStoryTurnReferences,
} from "@/lib/domain/state";
import {
  critiqueSimulatorTurn,
  planSimulatorTurn,
  renderSimulatorTurn,
  selectSimulatorBeat,
  simulateCharacterIntent,
} from "./simulator-openai";
import { logGeneration } from "./store";

type GenerationMeta = WorldPreview["generation"];

type ValidCandidate = Extract<CandidateDryRun, { valid: true }>;

// A rejected beat is a dramatic dead end, not a pipeline failure. The director
// already produced three simulator-legal candidates, so exhausting the runners-up
// is far cheaper — and far better for the listener — than dropping to the
// template fallback. Renders are capped so a bad turn cannot run unbounded.
const MAX_RENDER_CALLS = 3;

export async function orchestrateStoryTurn(
  session: WorldSession,
  event: StoryEvent,
  packet: FastTurnPacket,
): Promise<{
  draft: StoryTurnDraft;
  generation: GenerationMeta;
  critique: StoryCritique;
}> {
  const started = Date.now();
  const allowedStorylets = new Set(
    eligibleStorylets(session, event).map((storylet) => storylet.storylet_id),
  );
  const allowedFacts = new Set(packet.scene_cell.permitted_unlocked_fact_ids);
  let plan = await planSimulatorTurn(session, event, packet);
  let attempts = evaluateCandidates(
    session,
    event,
    plan.candidates,
    allowedStorylets,
    allowedFacts,
  );
  let valid = attempts.filter(
    (attempt): attempt is ValidCandidate => attempt.valid,
  );

  if (!valid.length) {
    plan = await planSimulatorTurn(
      session,
      event,
      packet,
      attempts.map((attempt) => ({
        candidate_id: attempt.candidate.candidate_id,
        errors: attempt.valid ? [] : attempt.errors,
      })),
    );
    attempts = evaluateCandidates(
      session,
      event,
      plan.candidates,
      allowedStorylets,
      allowedFacts,
    );
    valid = attempts.filter(
      (attempt): attempt is ValidCandidate => attempt.valid,
    );
  }
  if (!valid.length) {
    const reasons = attempts.flatMap((attempt) =>
      attempt.valid ? [] : attempt.errors,
    );
    throw new Error(
      `Director could not produce a legal beat: ${reasons.slice(0, 4).join(" | ")}`,
    );
  }

  const preferredId = await selectSimulatorBeat(packet, valid);
  const ordered = orderCandidates(valid, preferredId);

  const budget = { renders: MAX_RENDER_CALLS };
  const rejections: string[] = [];

  for (const [index, candidate] of ordered.entries()) {
    if (budget.renders <= 0) break;
    const outcome = await attemptCandidate(
      session,
      event,
      packet,
      candidate,
      budget,
    );
    if (!outcome.ok) {
      rejections.push(`beat ${index + 1}/${ordered.length}: ${outcome.reason}`);
      continue;
    }

    session.simulation = outcome.context.after;
    session.simulation_events.push(outcome.context.commit);
    if (session.last_context_trace) {
      session.last_context_trace.selected_storylet_id =
        candidate.candidate.storylet_id;
      session.last_context_trace.quality_warnings = [
        ...outcome.critique.errors
          .filter((error) => error.severity === "warning")
          .map((error) => error.explanation),
        ...rejections.map((reason) => `Rejected ${reason}`),
      ];
    }
    const generation: GenerationMeta = {
      ...outcome.generation,
      latency_ms: Date.now() - started,
    };
    await logGeneration({
      universeId: session.universe_id,
      operation: "story_turn",
      provider: generation.provider,
      model: generation.model,
      status: generation.status,
      latencyMs: generation.latency_ms,
      usedFallback: false,
    });
    return { draft: outcome.draft, generation, critique: outcome.critique };
  }

  throw new Error(
    `No director beat produced a legal scene: ${rejections.slice(0, 3).join(" | ")}`,
  );
}

// Renders one candidate, allowing a single prose-only repair. Returns a reason
// instead of throwing so the caller can move on to the next candidate.
async function attemptCandidate(
  session: WorldSession,
  event: StoryEvent,
  packet: FastTurnPacket,
  candidate: ValidCandidate,
  budget: { renders: number },
): Promise<
  | {
      ok: true;
      draft: StoryTurnDraft;
      critique: StoryCritique;
      generation: GenerationMeta;
      context: SimulationTurnContext;
    }
  | { ok: false; reason: string }
> {
  const presentCharacterIds = charactersAtBeatEnd(
    session,
    candidate.next_state,
    candidate.candidate.end_location_ref,
    candidate.commit.resolved_refs,
    candidate.candidate.character_pressure.map(
      (pressure) => pressure.character_id,
    ),
  );
  if (presentCharacterIds.length < 2) {
    return { ok: false, reason: "the beat leaves fewer than two characters present" };
  }

  // Each candidate gets its own simulation branch so a rejected beat never
  // leaks belief or entity changes into the next attempt.
  const nextState = structuredClone(candidate.next_state);
  const characterIntents = await Promise.all(
    presentCharacterIds.map((characterId) =>
      simulateCharacterIntent(
        session,
        characterId,
        candidate.candidate,
        nextState,
      ),
    ),
  );
  applyCharacterIntents(nextState, characterIntents, event);

  const context: SimulationTurnContext = {
    before: session.simulation,
    selected: candidate.candidate,
    after: nextState,
    commit: candidate.commit,
    character_intents: characterIntents,
    source_event: event,
  };

  let rendered;
  try {
    budget.renders -= 1;
    rendered = await renderSimulatorTurn(
      packet,
      context,
      null,
      [],
      session.creativity,
    );
  } catch (error) {
    return { ok: false, reason: safeMessage(error) };
  }
  rendered.draft = bindRendererToCanon(
    session,
    event,
    rendered.draft,
    context,
    presentCharacterIds,
  );
  let validation = normalizeRendered(session, rendered.draft);
  rendered.draft = validation.draft;
  let critique: StoryCritique;
  if (validation.error) {
    critique = serverContinuityCritique(validation.error);
  } else {
    critique = await critiqueSimulatorTurn(
      session,
      packet,
      context,
      rendered.draft,
    );
  }

  const fatal = critique.errors.filter((error) => error.severity === "fatal");
  if (!validation.error && !fatal.length) {
    return {
      ok: true,
      draft: rendered.draft,
      critique,
      generation: rendered.generation,
      context,
    };
  }
  if (budget.renders <= 0) {
    return { ok: false, reason: describeFatal(validation.error, fatal) };
  }

  let repaired;
  try {
    budget.renders -= 1;
    repaired = await renderSimulatorTurn(
      packet,
      context,
      rendered.draft,
      [
        ...critique.repair_instructions,
        ...fatal.map((error) => error.explanation),
      ],
      session.creativity,
    );
  } catch (error) {
    return { ok: false, reason: safeMessage(error) };
  }
  repaired.draft = bindRendererToCanon(
    session,
    event,
    repaired.draft,
    context,
    presentCharacterIds,
  );
  validation = normalizeRendered(session, repaired.draft);
  repaired.draft = validation.draft;
  if (validation.error) {
    return { ok: false, reason: validation.error };
  }
  const repairedCritique = await critiqueSimulatorTurn(
    session,
    packet,
    context,
    repaired.draft,
  );
  const stillFatal = repairedCritique.errors.filter(
    (error) => error.severity === "fatal",
  );
  if (stillFatal.length) {
    return { ok: false, reason: describeFatal(null, stillFatal) };
  }
  return {
    ok: true,
    draft: repaired.draft,
    critique: repairedCritique,
    generation: repaired.generation,
    context,
  };
}

function orderCandidates(
  valid: ValidCandidate[],
  preferredId: string,
): ValidCandidate[] {
  const byScore = [...valid].sort((left, right) => right.score - left.score);
  const preferred = byScore.find(
    (candidate) => candidate.candidate.candidate_id === preferredId,
  );
  if (!preferred) return byScore;
  return [preferred, ...byScore.filter((candidate) => candidate !== preferred)];
}

function serverContinuityCritique(error: string): StoryCritique {
  return {
    valid: false,
    errors: [
      {
        category: "entity_state",
        severity: "fatal",
        explanation: error,
        evidence: "Server continuity validation",
      },
    ],
    repair_instructions: [
      `Repair this server-verified continuity error without changing the selected beat: ${error}`,
    ],
  };
}

function describeFatal(
  validationError: string | null,
  fatal: StoryCritique["errors"],
): string {
  if (validationError) return validationError;
  return fatal.map((error) => error.explanation).slice(0, 2).join(" | ");
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : "render failed";
}

function evaluateCandidates(
  session: WorldSession,
  event: StoryEvent,
  candidates: Parameters<typeof dryRunBeat>[2][],
  allowedStorylets: Set<string>,
  allowedFacts: Set<string>,
): CandidateDryRun[] {
  return candidates.map((candidate) => {
    const extraErrors: string[] = [];
    const currentScene = session.scenes.find(
      (scene) => scene.scene_id === session.current_scene_id,
    );
    const startLocation = session.simulation.entities[candidate.start_location_ref];
    if (
      !currentScene ||
      !startLocation ||
      startLocation.kind !== "location" ||
      startLocation.name.trim().toLowerCase() !==
        currentScene.location.trim().toLowerCase()
    ) {
      extraErrors.push(
        `Beat must start at the current scene location ${currentScene?.location ?? "unknown"}.`,
      );
    }
    if (!allowedStorylets.has(candidate.storylet_id)) {
      extraErrors.push(`Storylet ${candidate.storylet_id} is not eligible.`);
    }
    for (const factId of candidate.information_used_fact_ids) {
      if (!allowedFacts.has(factId)) {
        extraErrors.push(`Fact ${factId} is not permitted in this scene.`);
      }
    }
    const dryRun = dryRunBeat(session.simulation, event, candidate);
    if (!extraErrors.length) return dryRun;
    return {
      valid: false,
      candidate,
      errors: [
        ...extraErrors,
        ...(dryRun.valid ? [] : dryRun.errors),
      ],
    };
  });
}

function charactersAtBeatEnd(
  session: WorldSession,
  state: WorldSession["simulation"],
  endLocationRef: string,
  resolvedRefs: Record<string, string>,
  pressureCharacters: string[],
): string[] {
  const resolvedEndLocation = resolvedRefs[endLocationRef] ?? endLocationRef;
  const locationId = state.entities[resolvedEndLocation]
    ? resolvedEndLocation
    : Object.values(state.entities).find(
        (entity) =>
          entity.kind === "location" &&
          entity.name.toLowerCase() === endLocationRef.toLowerCase(),
      )?.entity_id;
  const physicallyPresent = Object.values(state.entities)
    .filter(
      (entity) =>
        entity.kind === "character" &&
        entity.location_id === locationId &&
        entity.status !== "absent" &&
        entity.status !== "unavailable",
    )
    .map((entity) => entity.entity_id);
  const validPressure = pressureCharacters.filter((id) =>
    physicallyPresent.includes(id),
  );
  const current = session.scenes
    .find((scene) => scene.scene_id === session.current_scene_id)!
    .present_character_ids.filter((id) => physicallyPresent.includes(id));
  return [...new Set([...validPressure, ...current, ...physicallyPresent])].slice(
    0,
    3,
  );
}

function applyCharacterIntents(
  state: WorldSession["simulation"],
  intents: CharacterIntent[],
  event: StoryEvent,
): void {
  for (const intent of intents) {
    const character = state.characters[intent.character_id];
    if (!character) continue;
    character.mind = {
      ...character.mind,
      current_goal: intent.immediate_goal,
      current_belief: intent.private_interpretation,
      current_emotion: intent.emotional_state,
      last_changed_event_id: event.event_id,
    };
    for (const update of intent.belief_updates) {
      const fact = state.facts[update.fact_id];
      if (!fact?.known_by_character_ids.includes(intent.character_id)) continue;
      const existing = character.beliefs.find(
        (belief) => belief.fact_id === update.fact_id,
      );
      const belief = {
        fact_id: update.fact_id,
        confidence: Math.max(0, Math.min(100, Math.round(update.confidence))),
        interpretation: update.interpretation,
        learned_event_id: event.event_id,
      };
      if (existing) Object.assign(existing, belief);
      else character.beliefs.push(belief);
    }
  }
}

function bindRendererToCanon(
  session: WorldSession,
  event: StoryEvent,
  draft: StoryTurnDraft,
  context: SimulationTurnContext,
  presentCharacterIds: string[],
): StoryTurnDraft {
  const newFact = Object.values(context.after.facts).find(
    (fact) => fact.source_event_id === event.event_id,
  );
  const endLocation =
    context.after.entities[
      context.commit.resolved_refs[context.selected.end_location_ref] ??
        context.selected.end_location_ref
    ] ??
    Object.values(context.after.entities).find(
      (entity) =>
        entity.kind === "location" &&
        entity.name.toLowerCase() ===
          context.selected.end_location_ref.toLowerCase(),
    );
  const minutesPassed =
    context.after.clock.elapsed_minutes - context.before.clock.elapsed_minutes;
  const intentById = new Map(
    context.character_intents.map((intent) => [intent.character_id, intent]),
  );
  return {
    ...draft,
    because_of_choice: context.selected.because_of_choice,
    immediate_consequence: `${context.selected.chosen_action_result} ${context.selected.cost_paid}`,
    time_passed: `${minutesPassed} ${minutesPassed === 1 ? "minute" : "minutes"}`,
    transition_reason:
      context.commit.effects
        .filter((effect) => effect.command_type === "move_entity")
        .map((effect) => effect.description)
        .join(" ") || draft.transition_reason,
    storylet_id: context.selected.storylet_id,
    causal_chain: {
      chosen_action_result: context.selected.chosen_action_result,
      cost_paid: context.selected.cost_paid,
      observable_clue:
        newFact?.evidence.join(" ") ?? draft.causal_chain.observable_clue,
      new_hypothesis:
        newFact?.truth_status === "uncertain"
          ? newFact.statement
          : draft.causal_chain.new_hypothesis,
      next_pressure: draft.causal_chain.next_pressure,
    },
    character_moves: presentCharacterIds.map((characterId) => {
      const intent = intentById.get(characterId)!;
      const before = context.before.characters[characterId]?.mind;
      return {
        character_id: characterId,
        want_now: intent.immediate_goal,
        belief_before: before?.current_belief ?? "",
        belief_after: intent.private_interpretation,
        emotion_after: intent.emotional_state,
        tactic: intent.tactic,
        relationship_move: intent.dialogue_goal,
        spoken_intent: intent.dialogue_goal,
      };
    }),
    milestone_action: context.selected.milestone_action,
    milestone_completion_evidence:
      context.selected.milestone_completion_evidence,
    location: endLocation?.name ?? draft.location,
    present_character_ids: presentCharacterIds,
    new_information: newFact?.statement ?? null,
  };
}

function normalizeRendered(
  session: WorldSession,
  draft: StoryTurnDraft,
): { draft: StoryTurnDraft; error: string | null } {
  try {
    const normalized = validateStoryTurnReferences(session, draft);
    if (isRepetitiveStoryTurn(session, normalized)) {
      return {
        draft: normalized,
        error:
          "The rendered scene repeats recent narration or dramatic information.",
      };
    }
    return { draft: normalized, error: null };
  } catch (error) {
    return {
      draft,
      error:
        error instanceof Error
          ? error.message
          : "Continuity validation failed.",
    };
  }
}
