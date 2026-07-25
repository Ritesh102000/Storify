import type {
  Character,
  Choice,
  ChoiceProposal,
  ContextTrace,
  FastTurnPacket,
  GameState,
  Prototype,
  Scene,
  StoryEvent,
  StoryFact,
  StoryTurnDraft,
  TemplateId,
  WorldPreview,
  WorldSession,
  WorldView,
} from "../types";
import { createId } from "../id";

const PROTOTYPE_IDS: Record<Prototype, string> = {
  ally: "char_ally",
  rival: "char_rival",
  mystery_keeper: "char_keeper",
};

export function materializeWorld(preview: WorldPreview): WorldSession {
  const now = new Date().toISOString();
  const characters: Character[] = preview.seed.characters.map((character) => ({
    ...character,
    character_id: PROTOTYPE_IDS[character.prototype],
    secret_fact_id: `fact_${character.prototype}_secret`,
  }));
  const characterByPrototype = new Map(
    characters.map((character) => [character.prototype, character]),
  );
  const ally = mustGetCharacter(characterByPrototype, "ally");
  const rival = mustGetCharacter(characterByPrototype, "rival");
  const keeper = mustGetCharacter(characterByPrototype, "mystery_keeper");

  const universeId = createId("univ");
  const storylineId = createId("story");
  const branchId = createId("branch");
  const sceneId = createId("scene");

  const state: GameState = {
    schema_version: 1,
    turn_index: 0,
    story_progress: 0,
    goal_status: "active",
    objective_status: "available",
    active_threat_id: rival.character_id,
    character_statuses: {
      [ally.character_id]: "in_danger",
      [rival.character_id]: "active",
      [keeper.character_id]: "absent",
    },
    relationships: {
      [ally.character_id]: { trust: 45, tension: 10 },
      [rival.character_id]: { trust: 10, tension: 55 },
      [keeper.character_id]: { trust: 25, tension: 25 },
    },
    unlocked_fact_ids: [],
  };

  const choices = preview.seed.first_choice_proposals.map((proposal) =>
    proposalToChoice(proposal, sceneId, characterByPrototype),
  );
  const scene: Scene = {
    scene_id: sceneId,
    scene_index: 0,
    location: preview.seed.opening_scene.location,
    situation: preview.seed.opening_scene.situation,
    present_character_ids:
      preview.seed.opening_scene.present_character_prototypes.map(
        (prototype) => mustGetCharacter(characterByPrototype, prototype).character_id,
      ),
    narration: preview.seed.opening_narration,
    dialogue: [],
    choice_ids: choices.map((choice) => choice.choice_id),
    created_from_event_id: null,
  };

  const facts: StoryFact[] = characters.map((character) => ({
    fact_id: character.secret_fact_id,
    character_id: character.character_id,
    text: character.secret,
  }));

  return {
    universe_id: universeId,
    storyline_id: storylineId,
    branch_id: branchId,
    template_id: preview.resolved_template_id,
    universe: preview.seed.universe,
    story: preview.seed.story,
    semantic_labels: {
      objective_label: preview.seed.opening_scene.objective_label,
      danger_label: preview.seed.opening_scene.danger_label,
      threat_label: rival.name,
      progress_label: preview.seed.story.main_goal,
    },
    characters,
    state,
    scenes: [scene],
    current_scene_id: sceneId,
    choices,
    events: [],
    memories: [],
    facts,
    spin_offs: [],
    last_context_trace: null,
    generation: preview.generation,
    created_at: now,
    updated_at: now,
  };
}

export function proposalToChoice(
  proposal: ChoiceProposal,
  sceneId: string,
  characterByPrototype: Map<Prototype, Character>,
): Choice {
  const target = proposal.target_prototype
    ? mustGetCharacter(characterByPrototype, proposal.target_prototype)
    : null;

  return {
    choice_id: createId("choice"),
    scene_id: sceneId,
    axis: proposal.axis,
    command_type: proposal.command_type,
    arguments: target ? { target_id: target.character_id } : {},
    label: proposal.label,
    status: "available",
  };
}

export function currentScene(session: WorldSession): Scene {
  const scene = session.scenes.find(
    (candidate) => candidate.scene_id === session.current_scene_id,
  );
  if (!scene) {
    throw new Error("Current scene is missing.");
  }
  return scene;
}

export function buildFastTurnPacket(
  session: WorldSession,
  event: StoryEvent,
): { packet: FastTurnPacket; trace: ContextTrace } {
  const scene = currentScene(session);
  const activeCharacterIds = scene.present_character_ids;
  const recentEvents = session.events.slice(-3).map((recentEvent) => ({
    event_id: recentEvent.event_id,
    command_type: recentEvent.command_type,
    summary: recentEvent.summary,
  }));

  const characterViews = activeCharacterIds
    .map((characterId) =>
      session.characters.find(
        (character) => character.character_id === characterId,
      ),
    )
    .filter((character): character is Character => Boolean(character))
    .map((character) => {
      const memories = session.memories
        .filter((memory) => memory.character_id === character.character_id)
        .toSorted((left, right) => {
          const leftScore =
            left.importance * 10 +
            left.relationship_delta * 4 +
            left.goal_relevance * 3;
          const rightScore =
            right.importance * 10 +
            right.relationship_delta * 4 +
            right.goal_relevance * 3;
          return rightScore - leftScore ||
            right.created_at.localeCompare(left.created_at);
        })
        .slice(0, 5);
      const unlockedFacts = session.facts.filter(
        (fact) =>
          fact.character_id === character.character_id &&
          session.state.unlocked_fact_ids.includes(fact.fact_id),
      );
      return {
        character_id: character.character_id,
        public_identity: {
          prototype: character.prototype,
          name: character.name,
          role_in_world: character.role_in_world,
          relationship_to_listener: character.relationship_to_listener,
          traits: character.traits,
          goal: character.goal,
          fear: character.fear,
          speech_style: character.speech_style,
          voice_hint: character.voice_hint,
        },
        relationship_to_listener:
          session.state.relationships[character.character_id],
        accessible_memories: memories,
        unlocked_facts: unlockedFacts,
      };
    });

  const stateFields = [...new Set(event.effects.map((effect) => effect.path))];
  const trace: ContextTrace = {
    trace_id: createId("trace"),
    universe_id: session.universe_id,
    branch_id: session.branch_id,
    scene_id: scene.scene_id,
    event_id: event.event_id,
    recent_event_ids: recentEvents.map((recentEvent) => recentEvent.event_id),
    character_ids: characterViews.map((view) => view.character_id),
    memory_ids: characterViews.flatMap((view) =>
      view.accessible_memories.map((memory) => memory.memory_id),
    ),
    unlocked_fact_ids: session.state.unlocked_fact_ids,
    state_fields: stateFields,
    proposal_count: 0,
    valid_choice_count: 0,
    prompt_version: 1,
    schema_version: 1,
  };

  return {
    packet: {
      schema_version: 1,
      world: {
        universe_id: session.universe_id,
        ...session.universe,
      },
      story: session.story,
      committed_event: {
        event_id: event.event_id,
        command_type: event.command_type,
        summary: event.summary,
      },
      recent_events: recentEvents,
      current_state: session.state,
      active_scene: {
        scene_id: scene.scene_id,
        location: scene.location,
        situation: scene.situation,
        present_character_ids: scene.present_character_ids,
      },
      character_views: characterViews,
      supported_commands: [
        "help_character",
        "pursue_goal",
        "confront_character",
      ],
      output_requirements: {
        narration_max_words: 160,
        dialogue_item_limit: 2,
        choice_proposal_limit: 6,
      },
    },
    trace,
  };
}

export function validateStoryTurnReferences(
  session: WorldSession,
  draft: StoryTurnDraft,
): StoryTurnDraft {
  const scene = currentScene(session);
  const existingIds = new Set(session.characters.map((character) => character.character_id));
  const presentIds = new Set(scene.present_character_ids);

  return {
    narration: draft.narration,
    dialogue: draft.dialogue.filter(
      (line) =>
        existingIds.has(line.character_id) && presentIds.has(line.character_id),
    ),
    choice_proposals: draft.choice_proposals.filter((proposal) => {
      if (
        proposal.axis === "protect" &&
        proposal.command_type !== "help_character"
      ) {
        return false;
      }
      if (
        proposal.axis === "pursue" &&
        proposal.command_type !== "pursue_goal"
      ) {
        return false;
      }
      if (
        proposal.axis === "confront" &&
        proposal.command_type !== "confront_character"
      ) {
        return false;
      }

      const targetId = proposal.arguments.target_id;
      return !targetId || (existingIds.has(targetId) && presentIds.has(targetId));
    }),
  };
}

export function appendStoryTurn(
  session: WorldSession,
  event: StoryEvent,
  rawDraft: StoryTurnDraft,
): WorldSession {
  const draft = validateStoryTurnReferences(session, rawDraft);
  const previousScene = currentScene(session);
  const sceneId = createId("scene");
  const fallbackByAxis = defaultNextChoices(session);
  const proposals = new Map<
    StoryTurnDraft["choice_proposals"][number]["axis"],
    StoryTurnDraft["choice_proposals"][number]
  >();

  for (const proposal of draft.choice_proposals) {
    if (!proposals.has(proposal.axis) && isLegalProposal(session, proposal)) {
      proposals.set(proposal.axis, proposal);
    }
  }

  const axes = ["protect", "pursue", "confront"] as const;
  const choices: Choice[] =
    session.state.goal_status === "completed"
      ? []
      : axes.map((axis) => {
          const proposal = proposals.get(axis) ?? fallbackByAxis[axis];
          return {
            choice_id: createId("choice"),
            scene_id: sceneId,
            axis,
            command_type: proposal.command_type,
            arguments: proposal.arguments.target_id
              ? { target_id: proposal.arguments.target_id }
              : {},
            label: proposal.label,
            status: "available",
          };
        });

  const nextScene: Scene = {
    scene_id: sceneId,
    scene_index: previousScene.scene_index + 1,
    location: previousScene.location,
    situation: event.summary,
    present_character_ids: previousScene.present_character_ids,
    narration: draft.narration,
    dialogue: draft.dialogue,
    choice_ids: choices.map((choice) => choice.choice_id),
    created_from_event_id: event.event_id,
  };

  session.scenes.push(nextScene);
  session.choices.push(...choices);
  session.current_scene_id = sceneId;
  session.updated_at = new Date().toISOString();
  if (session.last_context_trace) {
    session.last_context_trace.proposal_count = rawDraft.choice_proposals.length;
    session.last_context_trace.valid_choice_count = choices.length;
  }
  return session;
}

export function toWorldView(session: WorldSession): WorldView {
  const scene = currentScene(session);
  const availableChoiceIds = new Set(scene.choice_ids);
  const lastEvent = session.events.at(-1) ?? null;

  return {
    universe_id: session.universe_id,
    branch_id: session.branch_id,
    template_id: session.template_id,
    universe: session.universe,
    story: session.story,
    semantic_labels: session.semantic_labels,
    state: session.state,
    scene,
    choices: session.choices.filter(
      (choice) =>
        availableChoiceIds.has(choice.choice_id) &&
        choice.status === "available",
    ),
    characters: session.characters.map((character) => ({
        ...publicCharacter(character),
        status: session.state.character_statuses[character.character_id],
        relationship: session.state.relationships[character.character_id],
        memories: session.memories
          .filter((memory) => memory.character_id === character.character_id)
          .slice(-5)
          .reverse(),
        unlocked_facts: session.facts.filter(
          (fact) =>
            fact.character_id === character.character_id &&
            session.state.unlocked_fact_ids.includes(fact.fact_id),
        ),
      })),
    last_event: lastEvent,
    last_state_diff: lastEvent?.effects ?? [],
    context_trace: session.last_context_trace,
    spin_offs: session.spin_offs,
    generation: session.generation,
  };
}

export function templateIdOf(value: string): TemplateId {
  if (
    value === "blackmoor" ||
    value === "neon_afterlight" ||
    value === "monsoon_house"
  ) {
    return value;
  }
  return "neon_afterlight";
}

function mustGetCharacter(
  characters: Map<Prototype, Character>,
  prototype: Prototype,
): Character {
  const character = characters.get(prototype);
  if (!character) {
    throw new Error(`Missing ${prototype} character.`);
  }
  return character;
}

function isLegalProposal(
  session: WorldSession,
  proposal: StoryTurnDraft["choice_proposals"][number],
): boolean {
  const scene = currentScene(session);
  const targetId = proposal.arguments.target_id;
  if (proposal.command_type === "pursue_goal") return !targetId;
  if (!targetId || !scene.present_character_ids.includes(targetId)) return false;
  if (proposal.command_type === "confront_character") {
    return (
      targetId === session.state.active_threat_id &&
      session.state.character_statuses[targetId] === "active"
    );
  }
  return ["in_danger", "safe", "active", "unavailable"].includes(
    session.state.character_statuses[targetId],
  );
}

function defaultNextChoices(
  session: WorldSession,
): Record<
  "protect" | "pursue" | "confront",
  StoryTurnDraft["choice_proposals"][number]
> {
  const ally = session.characters.find(
    (character) => character.prototype === "ally",
  )!;
  const rival = session.characters.find(
    (character) => character.prototype === "rival",
  )!;
  return {
    protect: {
      axis: "protect",
      command_type: "help_character",
      arguments: { target_id: ally.character_id },
      label:
        session.state.character_statuses[ally.character_id] === "unavailable"
          ? `Turn back and find ${ally.name}.`
          : `Stay with ${ally.name} and protect the alliance.`,
    },
    pursue: {
      axis: "pursue",
      command_type: "pursue_goal",
      arguments: { target_id: null },
      label: `Push forward: ${session.story.main_goal}.`,
    },
    confront: {
      axis: "confront",
      command_type: "confront_character",
      arguments: { target_id: rival.character_id },
      label: `Confront ${rival.name} before they regain control.`,
    },
  };
}

function publicCharacter(character: Character) {
  return {
    character_id: character.character_id,
    prototype: character.prototype,
    name: character.name,
    role_in_world: character.role_in_world,
    relationship_to_listener: character.relationship_to_listener,
    traits: character.traits,
    goal: character.goal,
    fear: character.fear,
    speech_style: character.speech_style,
    voice_hint: character.voice_hint,
  };
}
