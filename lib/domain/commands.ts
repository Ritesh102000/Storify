import { createId } from "@/lib/id";
import type {
  Character,
  CharacterMemory,
  Choice,
  GameState,
  StateDiff,
  StoryEvent,
  WorldSession,
} from "@/lib/types";
import { currentScene } from "./state";
import { recordPlayerEventInSimulation } from "@/lib/simulation/world";

export class CommandError extends Error {
  constructor(
    public code:
      | "CHOICE_NOT_FOUND"
      | "CHOICE_ALREADY_CONSUMED"
      | "COMMAND_PRECONDITION_FAILED",
    message: string,
  ) {
    super(message);
  }
}

export function commitChoice(
  source: WorldSession,
  choiceId: string,
): { session: WorldSession; event: StoryEvent } {
  const session = structuredClone(source);
  const choice = session.choices.find((item) => item.choice_id === choiceId);
  if (!choice || choice.scene_id !== session.current_scene_id) {
    throw new CommandError("CHOICE_NOT_FOUND", "That choice is not available here.");
  }
  if (choice.status !== "available") {
    throw new CommandError(
      "CHOICE_ALREADY_CONSUMED",
      "That choice has already been used.",
    );
  }
  if (session.arc_state.status === "completed") {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      "This arc is complete. Continue in the world to begin a new arc.",
    );
  }

  const scene = currentScene(session);
  const before = structuredClone(session.state);
  applyRegisteredCommand(session, choice);
  session.state.turn_index += 1;
  clampState(session.state);
  const effects = stateDiff(before, session.state);

  for (const candidate of session.choices) {
    if (candidate.scene_id === scene.scene_id && candidate.status === "available") {
      candidate.status = candidate.choice_id === choiceId ? "consumed" : "disabled";
      if (candidate.choice_id !== choiceId) {
        candidate.disabled_reason = "Another action was selected.";
      }
    }
  }

  const target = choice.arguments.target_id
    ? session.characters.find((item) => item.character_id === choice.arguments.target_id)
    : null;
  const event: StoryEvent = {
    event_id: createId("event"),
    scene_id: scene.scene_id,
    choice_id: choice.choice_id,
    command_type: choice.command_type,
    command_arguments: { ...choice.arguments },
    summary: immutableSummary(choice, target ?? null, session),
    source_scene_title: scene.title,
    source_location: scene.location,
    witness_character_ids: [...scene.present_character_ids],
    effects,
    created_at: new Date().toISOString(),
  };
  session.events.push(event);
  session.memories.push(...memoriesForEvent(session, event, before));
  recordPlayerEventInSimulation(session, event);
  return { session, event };
}

function applyRegisteredCommand(session: WorldSession, choice: Choice): void {
  const scene = currentScene(session);
  const present = new Set(scene.present_character_ids);
  const targetId = choice.arguments.target_id;

  if (choice.command_type === "help_character") {
    if (!targetId || !present.has(targetId)) {
      throw new CommandError(
        "COMMAND_PRECONDITION_FAILED",
        "Protect can only target a character who is physically present.",
      );
    }
    const target = getCharacterById(session, targetId);
    const status = session.state.character_statuses[targetId];
    if (status === "absent" || status === "unavailable") {
      throw new CommandError(
        "COMMAND_PRECONDITION_FAILED",
        `${target.name} cannot be protected in this scene.`,
      );
    }
    session.state.character_statuses[targetId] = "safe";
    session.state.relationships[targetId].trust += 18;
    session.state.relationships[targetId].tension -= 6;
    return;
  }

  if (choice.command_type === "pursue_goal") {
    if (session.state.active_objective.status !== "active") {
      throw new CommandError(
        "COMMAND_PRECONDITION_FAILED",
        "The current scene objective is no longer active.",
      );
    }
    for (const characterId of scene.present_character_ids) {
      session.state.relationships[characterId].tension += 3;
    }
    return;
  }

  if (!targetId || !present.has(targetId)) {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      "Confront can only target a character who is physically present.",
    );
  }
  const target = getCharacterById(session, targetId);
  if (session.state.character_statuses[targetId] === "unavailable") {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      `${target.name} is unavailable.`,
    );
  }
  session.state.relationships[targetId].trust += 2;
  session.state.relationships[targetId].tension += 14;
}

function immutableSummary(
  choice: Choice,
  target: Character | null,
  session: WorldSession,
): string {
  if (choice.command_type === "help_character") {
    return `The listener protected ${target?.name ?? "a present character"} at ${currentScene(session).location}, accepting the stated tradeoff: ${choice.anticipated_tradeoff}`;
  }
  if (choice.command_type === "pursue_goal") {
    return `The listener pursued ${session.state.active_objective.label} at ${currentScene(session).location}, accepting the stated tradeoff: ${choice.anticipated_tradeoff}`;
  }
  return `The listener confronted ${target?.name ?? "a present character"} at ${currentScene(session).location}, accepting the stated tradeoff: ${choice.anticipated_tradeoff}`;
}

function memoriesForEvent(
  session: WorldSession,
  event: StoryEvent,
  before: GameState,
): CharacterMemory[] {
  const targetId = event.command_arguments.target_id;
  return event.witness_character_ids.map((characterId) => {
    const target = characterId === targetId;
    const beforeRelationship = before.relationships[characterId];
    const afterRelationship = session.state.relationships[characterId];
    return {
      memory_id: createId("mem"),
      character_id: characterId,
      source_event_id: event.event_id,
      kind: "witnessed",
      text: `${target ? "I was directly involved when" : "I witnessed when"} ${event.summary} The decision happened during “${event.source_scene_title}” at ${event.source_location}.`,
      importance: target ? 10 : 7,
      relationship_delta:
        (afterRelationship?.trust ?? 0) - (beforeRelationship?.trust ?? 0),
      goal_relevance: event.command_type === "pursue_goal" ? 10 : 7,
      created_at: event.created_at,
    };
  });
}

function stateDiff(before: GameState, after: GameState): StateDiff[] {
  const diffs: StateDiff[] = [];
  pushDiff(diffs, "turn_index", before.turn_index, after.turn_index);
  pushDiff(
    diffs,
    "active_objective.status",
    before.active_objective.status,
    after.active_objective.status,
  );
  for (const characterId of Object.keys(after.relationships)) {
    pushDiff(
      diffs,
      `relationships.${characterId}.trust`,
      before.relationships[characterId].trust,
      after.relationships[characterId].trust,
    );
    pushDiff(
      diffs,
      `relationships.${characterId}.tension`,
      before.relationships[characterId].tension,
      after.relationships[characterId].tension,
    );
    pushDiff(
      diffs,
      `character_statuses.${characterId}`,
      before.character_statuses[characterId],
      after.character_statuses[characterId],
    );
  }
  pushDiff(
    diffs,
    "unlocked_fact_ids",
    before.unlocked_fact_ids,
    after.unlocked_fact_ids,
  );
  return diffs;
}

function pushDiff(
  diffs: StateDiff[],
  path: string,
  from: string | number | string[],
  to: string | number | string[],
): void {
  if (JSON.stringify(from) !== JSON.stringify(to)) diffs.push({ path, from, to });
}

function clampState(state: GameState): void {
  for (const relationship of Object.values(state.relationships)) {
    relationship.trust = Math.max(0, Math.min(100, relationship.trust));
    relationship.tension = Math.max(0, Math.min(100, relationship.tension));
  }
}

function getCharacterById(session: WorldSession, characterId: string): Character {
  const character = session.characters.find((item) => item.character_id === characterId);
  if (!character) {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      "The selected character does not exist.",
    );
  }
  return character;
}
