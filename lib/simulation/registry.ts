import { createId } from "@/lib/id";
import type {
  BeatCandidate,
  CandidateDryRun,
  SimulationCommandProposal,
  SimulationEntity,
  SimulationState,
} from "./types";
import type { StoryEvent } from "@/lib/types";

export function dryRunBeat(
  source: SimulationState,
  event: StoryEvent,
  candidate: BeatCandidate,
): CandidateDryRun {
  const state = structuredClone(source);
  const refs = new Map<string, string>();
  const effects: Array<{
    command_type: SimulationCommandProposal["command_type"];
    target_id: string | null;
    description: string;
  }> = [];
  const errors: string[] = [];

  if (!candidate.because_of_choice.trim()) {
    errors.push("The beat does not explain how the selected choice caused it.");
  }
  if (!candidate.chosen_action_result.trim() || !candidate.cost_paid.trim()) {
    errors.push("The beat needs both a concrete result and a concrete cost.");
  }
  if (candidate.commands.length < 2 || candidate.commands.length > 10) {
    errors.push("A beat must contain 2-10 simulation commands.");
  }
  const introducedEntityRefs = new Set(
    candidate.commands
      .filter((command) => command.command_type === "introduce_entity")
      .map((command) => command.new_ref)
      .filter((ref): ref is string => Boolean(ref)),
  );
  for (const action of candidate.action_sequence) {
    if (
      !source.entities[action.actor_ref] &&
      !introducedEntityRefs.has(action.actor_ref)
    ) {
      errors.push(
        `Action sequence actor ${action.actor_ref} is not an existing or introduced entity.`,
      );
    }
  }

  for (const command of candidate.commands) {
    try {
      applyCommand(state, event, command, refs, effects);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Unknown command failure.");
    }
  }
  try {
    const start = resolveEntityRef(state, refs, candidate.start_location_ref);
    const end = resolveEntityRef(state, refs, candidate.end_location_ref);
    if (start.kind !== "location" || end.kind !== "location") {
      errors.push("Beat start and end references must be locations.");
    }
    if (
      start.entity_id !== end.entity_id &&
      state.clock.elapsed_minutes <= source.clock.elapsed_minutes
    ) {
      errors.push("Changing locations requires an advance_time command.");
    }
    for (const pressure of candidate.character_pressure) {
      const character = state.entities[pressure.character_id];
      if (
        !character ||
        character.kind !== "character" ||
        character.location_id !== end.entity_id
      ) {
        errors.push(
          `Character ${pressure.character_id} is not physically present at the beat end.`,
        );
      }
    }
    const newFacts = Object.values(state.facts).filter(
      (fact) => fact.source_event_id === event.event_id,
    );
    if (newFacts.length !== 1) {
      errors.push("Every scene must establish exactly one evidenced canonical fact.");
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Beat location validation failed.");
  }
  if (errors.length) return { valid: false, candidate, errors };

  state.last_event_id = event.event_id;
  const score =
    100 -
    candidate.commands.length * 2 +
    new Set(candidate.commands.map((command) => command.command_type)).size * 3 +
    (candidate.milestone_action === "complete" ? 2 : 0);
  return {
    valid: true,
    candidate,
    next_state: state,
    score,
    commit: {
      simulation_event_id: createId("sim_event"),
      source_story_event_id: event.event_id,
      candidate_id: candidate.candidate_id,
      commands: candidate.commands,
      resolved_refs: Object.fromEntries(refs),
      effects,
      created_at: new Date().toISOString(),
    },
  };
}

function applyCommand(
  state: SimulationState,
  event: StoryEvent,
  command: SimulationCommandProposal,
  refs: Map<string, string>,
  effects: Array<{
    command_type: SimulationCommandProposal["command_type"];
    target_id: string | null;
    description: string;
  }>,
): void {
  if (!command.reason.trim()) throw new Error("Every command needs a causal reason.");

  if (command.command_type === "advance_time") {
    const minutes = command.number_value;
    if (minutes === null || minutes < 0 || minutes > 1440) {
      throw new Error("advance_time requires 0-1440 minutes.");
    }
    state.clock.elapsed_minutes += minutes;
    state.clock.time_label = formatTime(state.clock.elapsed_minutes);
    effects.push({
      command_type: command.command_type,
      target_id: null,
      description: `${minutes} ${minutes === 1 ? "minute passes" : "minutes pass"} because ${command.reason}`,
    });
    return;
  }

  if (command.command_type === "introduce_entity") {
    if (!command.new_ref || !command.entity_kind || !command.name?.trim()) {
      throw new Error("introduce_entity requires new_ref, entity_kind, and name.");
    }
    if (refs.has(command.new_ref) || state.entities[command.new_ref]) {
      throw new Error(`Entity reference ${command.new_ref} already exists.`);
    }
    const entityId = createId(command.entity_kind);
    const locationId = command.target_ref
      ? resolveEntityRef(state, refs, command.target_ref).entity_id
      : null;
    state.entities[entityId] = {
      entity_id: entityId,
      kind: command.entity_kind,
      name: command.name,
      description: command.description ?? command.name,
      status: command.string_value ?? "active",
      location_id: locationId,
      portable: command.boolean_value ?? command.entity_kind === "object",
      carried_by: null,
      properties: {},
      introduced_event_id: event.event_id,
    };
    refs.set(command.new_ref, entityId);
    effects.push({
      command_type: command.command_type,
      target_id: entityId,
      description: `${command.name} enters canon because ${command.reason}`,
    });
    return;
  }

  if (command.command_type === "move_entity") {
    const entity = requireTarget(state, refs, command);
    if (!command.string_value) {
      throw new Error("move_entity requires destination in string_value.");
    }
    const destination = resolveEntityRef(state, refs, command.string_value);
    if (destination.kind !== "location") {
      throw new Error("move_entity destination must be a location.");
    }
    const from = entity.location_id;
    if (entity.kind === "location") throw new Error("A location cannot move.");
    entity.location_id = destination.entity_id;
    // Anything the mover is holding travels with them, so evidence cannot be
    // silently stranded in the room it was discovered in.
    const carried = Object.values(state.entities).filter(
      (candidate) => candidate.carried_by === entity.entity_id,
    );
    for (const item of carried) item.location_id = destination.entity_id;
    state.transitions.push({
      transition_id: createId("transition"),
      event_id: event.event_id,
      from_location_id: from,
      to_location_id: destination.entity_id,
      elapsed_minutes: command.number_value ?? 0,
      reason: command.reason,
    });
    effects.push({
      command_type: command.command_type,
      target_id: entity.entity_id,
      description:
        `${entity.name} moves to ${destination.name} because ${command.reason}` +
        (carried.length
          ? ` (carrying ${carried.map((item) => item.name).join(", ")})`
          : ""),
    });
    return;
  }

  if (command.command_type === "set_possession") {
    const item = requireTarget(state, refs, command);
    if (item.kind === "location" || item.kind === "character") {
      throw new Error("Only an object or hazard can be picked up or put down.");
    }
    if (!item.portable) {
      throw new Error(`${item.name} is not portable.`);
    }
    if (!command.actor_ref) {
      const previous = item.carried_by;
      item.carried_by = null;
      effects.push({
        command_type: command.command_type,
        target_id: item.entity_id,
        description: `${
          previous ? state.entities[previous]?.name ?? "Someone" : "Someone"
        } puts down ${item.name} because ${command.reason}`,
      });
      return;
    }
    const holderId = resolveCharacterRef(state, refs, command.actor_ref);
    const holder = state.entities[holderId];
    if (holder.location_id !== item.location_id) {
      throw new Error(
        `${holder.name} is not in the same place as ${item.name}.`,
      );
    }
    item.carried_by = holderId;
    effects.push({
      command_type: command.command_type,
      target_id: item.entity_id,
      description: `${holder.name} takes ${item.name} because ${command.reason}`,
    });
    return;
  }

  if (command.command_type === "set_status") {
    const entity = requireTarget(state, refs, command);
    if (!command.string_value?.trim()) {
      throw new Error("set_status requires string_value.");
    }
    const before = entity.status;
    entity.status = command.string_value;
    effects.push({
      command_type: command.command_type,
      target_id: entity.entity_id,
      description: `${entity.name} changes from ${before} to ${entity.status} because ${command.reason}`,
    });
    return;
  }

  if (command.command_type === "establish_fact") {
    if (!command.new_ref || !command.fact_statement?.trim() || !command.evidence.length) {
      throw new Error("establish_fact requires new_ref, statement, and evidence.");
    }
    const factId = createId("sim_fact");
    const knownBy = command.known_by_refs.map((ref) => {
      const entity = resolveEntityRef(state, refs, ref);
      if (entity.kind !== "character") {
        throw new Error(`Fact observer ${ref} is not a character.`);
      }
      return entity.entity_id;
    });
    state.facts[factId] = {
      fact_id: factId,
      statement: command.fact_statement,
      truth_status: command.string_value === "uncertain" ? "uncertain" : "true",
      evidence: command.evidence,
      source_event_id: event.event_id,
      known_by_character_ids: knownBy,
      reveal_after: null,
      status: "active",
    };
    refs.set(command.new_ref, factId);
    effects.push({
      command_type: command.command_type,
      target_id: factId,
      description: `Canon records: ${command.fact_statement}`,
    });
    return;
  }

  if (command.command_type === "update_belief") {
    const characterId = resolveCharacterRef(state, refs, command.actor_ref);
    if (!command.target_ref) throw new Error("update_belief requires target_ref fact.");
    const factId = refs.get(command.target_ref) ?? command.target_ref;
    const fact = state.facts[factId];
    if (!fact) throw new Error(`Belief fact ${command.target_ref} is unknown.`);
    if (!fact.known_by_character_ids.includes(characterId)) {
      throw new Error("A character cannot believe a fact they have not observed.");
    }
    const confidence = clamp(command.number_value ?? 50, 0, 100);
    const character = state.characters[characterId];
    const existing = character.beliefs.find((belief) => belief.fact_id === factId);
    const belief = {
      fact_id: factId,
      confidence,
      interpretation: command.string_value ?? fact.statement,
      learned_event_id: event.event_id,
    };
    if (existing) Object.assign(existing, belief);
    else character.beliefs.push(belief);
    effects.push({
      command_type: command.command_type,
      target_id: characterId,
      description: `${state.entities[characterId].name} updates a belief because ${command.reason}`,
    });
    return;
  }

  if (command.command_type === "update_goal") {
    const characterId = resolveCharacterRef(state, refs, command.actor_ref);
    if (!command.string_value?.trim()) {
      throw new Error("update_goal requires a goal description.");
    }
    const character = state.characters[characterId];
    const goalId = command.target_ref ?? createId("goal");
    const existing = character.goals.find((goal) => goal.goal_id === goalId);
    if (existing) {
      existing.description = command.string_value;
      existing.priority = clamp(command.number_value ?? existing.priority, 0, 100);
    } else {
      character.goals.push({
        goal_id: goalId,
        description: command.string_value,
        priority: clamp(command.number_value ?? 50, 0, 100),
        status: "active",
        created_event_id: event.event_id,
      });
    }
    effects.push({
      command_type: command.command_type,
      target_id: characterId,
      description: `${state.entities[characterId].name} changes goals because ${command.reason}`,
    });
    return;
  }

  if (command.command_type === "update_thread") {
    const threadId = command.target_ref;
    if (!threadId || !state.threads[threadId]) {
      throw new Error("update_thread requires an existing thread.");
    }
    const thread = state.threads[threadId];
    if (command.string_value === "add_evidence") {
      if (!command.actor_ref) {
        throw new Error("Adding thread evidence requires actor_ref as a fact reference.");
      }
      const factId = refs.get(command.actor_ref) ?? command.actor_ref;
      if (!state.facts[factId]) {
        throw new Error(`Thread evidence fact ${command.actor_ref} is unknown.`);
      }
      if (!thread.evidence_fact_ids.includes(factId)) {
        thread.evidence_fact_ids.push(factId);
      }
    }
    if (command.string_value === "resolved") {
      if (thread.evidence_fact_ids.length < thread.required_evidence_count) {
        throw new Error("A thread cannot resolve before its evidence requirement.");
      }
      thread.status = "resolved";
      thread.resolved_event_id = event.event_id;
    }
    effects.push({
      command_type: command.command_type,
      target_id: threadId,
      description: `Thread ${thread.question} changes because ${command.reason}`,
    });
  }
}

function requireTarget(
  state: SimulationState,
  refs: Map<string, string>,
  command: SimulationCommandProposal,
): SimulationEntity {
  if (!command.target_ref) {
    throw new Error(`${command.command_type} requires target_ref.`);
  }
  return resolveEntityRef(state, refs, command.target_ref);
}

function resolveEntityRef(
  state: SimulationState,
  refs: Map<string, string>,
  ref: string,
): SimulationEntity {
  const entityId = refs.get(ref) ?? ref;
  const entity = state.entities[entityId];
  if (!entity) throw new Error(`Entity reference ${ref} is unknown.`);
  return entity;
}

function resolveCharacterRef(
  state: SimulationState,
  refs: Map<string, string>,
  ref: string | null,
): string {
  if (!ref) throw new Error("A character command requires actor_ref.");
  const entity = resolveEntityRef(state, refs, ref);
  if (entity.kind !== "character" || !state.characters[entity.entity_id]) {
    throw new Error(`${ref} is not a character.`);
  }
  return entity.entity_id;
}

function formatTime(minutes: number): string {
  const day = Math.floor(minutes / 1440) + 1;
  const withinDay = minutes % 1440;
  const hour = Math.floor(withinDay / 60);
  const minute = withinDay % 60;
  return `Day ${day}, ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}
