import { createId } from "../id";
import type {
  Character,
  CharacterMemory,
  GameState,
  StateDiff,
  StoryEvent,
  WorldSession,
} from "../types";
import { currentScene } from "./state";

export class CommandError extends Error {
  code:
    | "CHOICE_NOT_FOUND"
    | "CHOICE_NOT_AVAILABLE"
    | "COMMAND_PRECONDITION_FAILED";

  constructor(
    code: CommandError["code"],
    message: string,
  ) {
    super(message);
    this.name = "CommandError";
    this.code = code;
  }
}

export type CommandCommit = {
  session: WorldSession;
  event: StoryEvent;
  stateDiff: StateDiff[];
  memories: CharacterMemory[];
};

export function commitChoice(
  inputSession: WorldSession,
  choiceId: string,
): CommandCommit {
  const session = structuredClone(inputSession);
  const choice = session.choices.find(
    (candidate) => candidate.choice_id === choiceId,
  );
  if (!choice) {
    throw new CommandError("CHOICE_NOT_FOUND", "That choice does not exist.");
  }
  if (choice.status !== "available") {
    throw new CommandError(
      "CHOICE_NOT_AVAILABLE",
      "That choice is no longer available.",
    );
  }
  if (session.state.goal_status !== "active") {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      "This story has already reached its ending.",
    );
  }
  if (session.state.turn_index >= 20) {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      "The demo turn limit has been reached.",
    );
  }

  const before = structuredClone(session.state);
  const scene = currentScene(session);
  const ally = getCharacter(session, "ally");
  const targetId = choice.arguments.target_id;
  let primaryEffect = "";

  if (choice.command_type === "help_character") {
    if (!targetId) {
      throw new CommandError(
        "COMMAND_PRECONDITION_FAILED",
        "That character cannot be identified.",
      );
    }
    const status = session.state.character_statuses[targetId];
    if (
      status !== "in_danger" &&
      status !== "safe" &&
      status !== "active" &&
      status !== "unavailable"
    ) {
      throw new CommandError(
        "COMMAND_PRECONDITION_FAILED",
        "That character cannot be helped right now.",
      );
    }
    if (status === "in_danger") {
      session.state.character_statuses[targetId] = "safe";
      session.state.relationships[targetId].trust += 25;
      session.state.relationships[targetId].tension -= 5;
      session.state.story_progress += 5;
      if (session.state.objective_status === "available") {
        session.state.objective_status = "lost";
      }
      primaryEffect = `${getCharacterById(session, targetId).name} safe; ${session.semantic_labels.objective_label} lost`;
    } else if (status === "unavailable") {
      session.state.character_statuses[targetId] = "active";
      session.state.relationships[targetId].trust += 12;
      session.state.relationships[targetId].tension -= 8;
      session.state.story_progress += 4;
      primaryEffect = `${getCharacterById(session, targetId).name} found and brought back into the story`;
    } else {
      session.state.relationships[targetId].trust += 8;
      session.state.relationships[targetId].tension -= 5;
      session.state.story_progress += 3;
      primaryEffect = `trust with ${getCharacterById(session, targetId).name} strengthened`;
    }
  } else if (choice.command_type === "pursue_goal") {
    if (session.state.objective_status === "available") {
      session.state.objective_status = "secured";
      session.state.story_progress += 20;
      if (session.state.character_statuses[ally.character_id] === "in_danger") {
        session.state.character_statuses[ally.character_id] = "unavailable";
        session.state.relationships[ally.character_id].trust -= 15;
        session.state.relationships[ally.character_id].tension += 15;
      }
      primaryEffect = `${session.semantic_labels.objective_label} secured; ${ally.name} left behind`;
    } else if (session.state.objective_status === "lost") {
      session.state.objective_status = "secured";
      session.state.story_progress += 15;
      primaryEffect = `${session.semantic_labels.objective_label} recovered`;
    } else {
      session.state.story_progress += 12;
      primaryEffect = `${session.story.main_goal} advanced`;
    }
  } else if (choice.command_type === "confront_character") {
    if (
      !targetId ||
      targetId !== session.state.active_threat_id ||
      session.state.character_statuses[targetId] !== "active"
    ) {
      throw new CommandError(
        "COMMAND_PRECONDITION_FAILED",
        "That threat cannot be confronted right now.",
      );
    }
    const target = getCharacterById(session, targetId);
    session.state.relationships[targetId].trust += 5;
    session.state.relationships[targetId].tension += 15;
    session.state.story_progress += 10;
    if (!session.state.unlocked_fact_ids.includes(target.secret_fact_id)) {
      session.state.unlocked_fact_ids.push(target.secret_fact_id);
    }
    primaryEffect = `a hidden fact about ${target.name} surfaced`;
  }

  session.state.turn_index += 1;
  normalizeState(session.state);
  if (session.state.story_progress === 100) {
    session.state.goal_status = "completed";
  }

  const stateDiff = diffState(before, session.state);
  const eventId = createId("evt");
  const actorLabel = "You";
  const verb =
    choice.command_type === "help_character"
      ? "protected"
      : choice.command_type === "pursue_goal"
        ? "pursued the objective"
        : "confronted the threat";
  const targetLabel = targetId
    ? getCharacterById(session, targetId).name
    : session.semantic_labels.objective_label;
  const event: StoryEvent = {
    event_id: eventId,
    scene_id: scene.scene_id,
    choice_id: choice.choice_id,
    command_type: choice.command_type,
    command_arguments: choice.arguments,
    summary: `${actorLabel} ${verb} ${targetLabel} — ${primaryEffect}.`,
    witness_character_ids: scene.present_character_ids,
    effects: stateDiff,
    created_at: new Date().toISOString(),
  };

  const memories = createWitnessMemories(session, event);
  session.events.push(event);
  session.memories.push(...memories);
  for (const sceneChoice of session.choices.filter(
    (candidate) => candidate.scene_id === scene.scene_id,
  )) {
    sceneChoice.status = "consumed";
  }
  session.updated_at = new Date().toISOString();

  return { session, event, stateDiff, memories };
}

function normalizeState(state: GameState): void {
  state.story_progress = clamp(state.story_progress);
  for (const relationship of Object.values(state.relationships)) {
    relationship.trust = clamp(relationship.trust);
    relationship.tension = clamp(relationship.tension);
  }
  state.unlocked_fact_ids = [...new Set(state.unlocked_fact_ids)].slice(0, 3);
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function diffState(before: GameState, after: GameState): StateDiff[] {
  const diffs: StateDiff[] = [];
  addDiff(diffs, "turn_index", before.turn_index, after.turn_index);
  addDiff(
    diffs,
    "story_progress",
    before.story_progress,
    after.story_progress,
  );
  addDiff(diffs, "goal_status", before.goal_status, after.goal_status);
  addDiff(
    diffs,
    "objective_status",
    before.objective_status,
    after.objective_status,
  );
  const characterIds = Object.keys(after.character_statuses).toSorted();
  for (const characterId of characterIds) {
    addDiff(
      diffs,
      `character_statuses.${characterId}`,
      before.character_statuses[characterId],
      after.character_statuses[characterId],
    );
  }
  for (const characterId of characterIds) {
    addDiff(
      diffs,
      `relationships.${characterId}.trust`,
      before.relationships[characterId].trust,
      after.relationships[characterId].trust,
    );
    addDiff(
      diffs,
      `relationships.${characterId}.tension`,
      before.relationships[characterId].tension,
      after.relationships[characterId].tension,
    );
  }
  if (
    JSON.stringify(before.unlocked_fact_ids) !==
    JSON.stringify(after.unlocked_fact_ids)
  ) {
    diffs.push({
      path: "unlocked_fact_ids",
      from: before.unlocked_fact_ids,
      to: after.unlocked_fact_ids,
    });
  }
  return diffs;
}

function addDiff(
  diffs: StateDiff[],
  path: string,
  from: string | number,
  to: string | number,
): void {
  if (from !== to) {
    diffs.push({ path, from, to });
  }
}

function createWitnessMemories(
  session: WorldSession,
  event: StoryEvent,
): CharacterMemory[] {
  const changedRelationship = new Map<string, number>();
  for (const effect of event.effects) {
    const match = effect.path.match(
      /^relationships\.([^.]+)\.(trust|tension)$/,
    );
    if (
      match &&
      typeof effect.from === "number" &&
      typeof effect.to === "number"
    ) {
      changedRelationship.set(
        match[1],
        (changedRelationship.get(match[1]) ?? 0) +
          Math.abs(effect.to - effect.from),
      );
    }
  }

  return event.witness_character_ids.map((characterId) => {
    const isTarget = event.command_arguments.target_id === characterId;
    const text = isTarget
      ? `The listener chose me during ${session.semantic_labels.danger_label}. ${event.summary}`
      : `I witnessed the listener's decision during ${session.semantic_labels.danger_label}. ${event.summary}`;
    return {
      memory_id: createId("mem"),
      character_id: characterId,
      source_event_id: event.event_id,
      kind: "witnessed",
      text,
      importance: isTarget ? 10 : 7,
      relationship_delta: changedRelationship.get(characterId) ?? 0,
      goal_relevance: event.command_type === "pursue_goal" ? 10 : 6,
      created_at: event.created_at,
    };
  });
}

function getCharacter(
  session: WorldSession,
  prototype: Character["prototype"],
): Character {
  const character = session.characters.find(
    (candidate) => candidate.prototype === prototype,
  );
  if (!character) {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      `Missing ${prototype} character.`,
    );
  }
  return character;
}

function getCharacterById(
  session: WorldSession,
  characterId: string,
): Character {
  const character = session.characters.find(
    (candidate) => candidate.character_id === characterId,
  );
  if (!character) {
    throw new CommandError(
      "COMMAND_PRECONDITION_FAILED",
      "The selected character does not exist.",
    );
  }
  return character;
}
