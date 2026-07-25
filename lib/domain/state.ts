import type {
  Character,
  Choice,
  ChoiceProposal,
  ContextTrace,
  FastTurnPacket,
  GameState,
  PlotBeat,
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
  const openingBeat = preview.seed.plot_outline.beats[0];

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
    title: openingBeat.title,
    location: preview.seed.opening_scene.location,
    situation: preview.seed.opening_scene.situation,
    scene_goal: openingBeat.objective,
    new_information: null,
    thread_opened: preview.seed.story.central_question,
    thread_resolved: null,
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
    plot_outline: preview.seed.plot_outline,
    plot_state: {
      current_beat_index: 0,
      completed_beat_types: [],
      open_threads: [preview.seed.story.central_question],
      discovered_clues: [],
      last_new_information: null,
      recent_locations: [preview.seed.opening_scene.location],
      last_transition: null,
    },
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
  const activeBeat = currentPlotBeat(session);
  const previousBeat =
    session.plot_outline.beats[
      Math.max(0, session.plot_state.current_beat_index - 1)
    ];
  const activeCharacterIds = characterIdsForBeat(session, activeBeat);
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
    plot_beat: activeBeat.beat_type,
    open_thread_count: session.plot_state.open_threads.length,
    proposal_count: 0,
    valid_choice_count: 0,
    prompt_version: 2,
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
      plot_context: {
        active_beat: activeBeat,
        previous_beat: previousBeat,
        completed_beat_types: session.plot_state.completed_beat_types,
        open_threads: session.plot_state.open_threads,
        discovered_clues: session.plot_state.discovered_clues,
        last_new_information: session.plot_state.last_new_information,
        required_character_ids: activeCharacterIds,
        novelty_rules: [
          "Resolve the committed consequence, then execute the active beat.",
          "Introduce the active beat's development and reveal.",
          "Do not repeat the previous location, objective, or central question.",
          "Answer or materially narrow one open thread and raise the active beat's story question.",
        ],
      },
      committed_event: {
        event_id: event.event_id,
        command_type: event.command_type,
        summary: event.summary,
      },
      recent_events: recentEvents,
      current_state: session.state,
      active_scene: {
        scene_id: scene.scene_id,
        title: scene.title,
        location: scene.location,
        situation: scene.situation,
        scene_goal: scene.scene_goal,
        new_information: scene.new_information,
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
  const beat = currentPlotBeat(session);
  const existingIds = new Set(session.characters.map((character) => character.character_id));
  const presentIds = new Set(characterIdsForBeat(session, beat));
  const resolvedThread =
    draft.thread_resolved &&
    session.plot_state.open_threads.find(
      (thread) =>
        normalizeText(thread) === normalizeText(draft.thread_resolved ?? ""),
    );
  const openedThread =
    draft.thread_opened &&
    !session.plot_state.open_threads.some(
      (thread) =>
        normalizeText(thread) === normalizeText(draft.thread_opened ?? ""),
    )
      ? draft.thread_opened
      : beat.story_question;
  const newInformation =
    normalizeText(draft.new_information) ===
    normalizeText(session.plot_state.last_new_information ?? "")
      ? beat.reveal
      : draft.new_information;

  return {
    scene_title: draft.scene_title,
    location: beat.location,
    situation: draft.situation,
    scene_goal: beat.objective,
    new_information: newInformation,
    thread_opened: openedThread,
    thread_resolved: resolvedThread ?? null,
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
      return !targetId || existingIds.has(targetId);
    }),
  };
}

export function advancePlotForEvent(
  session: WorldSession,
  event: StoryEvent,
): WorldSession {
  const previousIndex = session.plot_state.current_beat_index;
  const nextIndex = Math.min(
    previousIndex + 1,
    session.plot_outline.beats.length - 1,
  );
  const previousBeat = session.plot_outline.beats[previousIndex];
  const nextBeat = session.plot_outline.beats[nextIndex];

  if (nextIndex !== previousIndex) {
    if (
      !session.plot_state.completed_beat_types.includes(previousBeat.beat_type)
    ) {
      session.plot_state.completed_beat_types.push(previousBeat.beat_type);
    }
    session.plot_state.current_beat_index = nextIndex;
    session.plot_state.last_transition = {
      from_beat: previousBeat.beat_type,
      to_beat: nextBeat.beat_type,
    };
    event.summary = `${event.summary} The story advances into ${nextBeat.title}.`;
  }

  for (const characterId of characterIdsForBeat(session, nextBeat)) {
    if (session.state.character_statuses[characterId] === "absent") {
      session.state.character_statuses[characterId] = "active";
      addEventEffect(
        event,
        `character_statuses.${characterId}`,
        "absent",
        "active",
      );
    }
  }

  if (nextBeat.beat_type === "climax") {
    if (session.state.story_progress !== 100) {
      addEventEffect(
        event,
        "story_progress",
        session.state.story_progress,
        100,
      );
      session.state.story_progress = 100;
    }
    if (session.state.goal_status !== "completed") {
      addEventEffect(event, "goal_status", session.state.goal_status, "completed");
      session.state.goal_status = "completed";
    }
  }

  session.updated_at = new Date().toISOString();
  return session;
}

export function isRepetitiveStoryTurn(
  session: WorldSession,
  draft: StoryTurnDraft,
): boolean {
  const recentScenes = session.scenes.slice(-3);
  const repeatedNarration = recentScenes.some(
    (scene) => wordOverlap(scene.narration, draft.narration) > 0.72,
  );
  const previousScene = currentScene(session);
  const unchangedScene =
    normalizeText(previousScene.location) === normalizeText(draft.location) &&
    normalizeText(previousScene.scene_goal) === normalizeText(draft.scene_goal) &&
    normalizeText(previousScene.situation) === normalizeText(draft.situation);
  const repeatedInformation =
    normalizeText(draft.new_information) ===
    normalizeText(session.plot_state.last_new_information ?? "");
  return repeatedNarration || (unchangedScene && repeatedInformation);
}

export function appendStoryTurn(
  session: WorldSession,
  event: StoryEvent,
  rawDraft: StoryTurnDraft,
): WorldSession {
  const draft = validateStoryTurnReferences(session, rawDraft);
  const previousScene = currentScene(session);
  const beat = currentPlotBeat(session);
  const presentCharacterIds = characterIdsForBeat(session, beat);
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
    title: draft.scene_title,
    location: beat.location,
    situation: draft.situation,
    scene_goal: beat.objective,
    new_information: draft.new_information,
    thread_opened: draft.thread_opened,
    thread_resolved: draft.thread_resolved,
    present_character_ids: presentCharacterIds,
    narration: draft.narration,
    dialogue: draft.dialogue,
    choice_ids: choices.map((choice) => choice.choice_id),
    created_from_event_id: event.event_id,
  };

  session.scenes.push(nextScene);
  session.choices.push(...choices);
  session.current_scene_id = sceneId;
  if (draft.thread_resolved) {
    session.plot_state.open_threads = session.plot_state.open_threads.filter(
      (thread) =>
        normalizeText(thread) !== normalizeText(draft.thread_resolved ?? ""),
    );
  }
  const nextThread = draft.thread_opened ?? beat.story_question;
  session.plot_state.open_threads = [
    ...session.plot_state.open_threads.filter(
      (thread) => normalizeText(thread) !== normalizeText(nextThread),
    ),
    nextThread,
  ].slice(-3);
  session.plot_state.discovered_clues = [
    ...session.plot_state.discovered_clues.filter(
      (clue) => normalizeText(clue) !== normalizeText(draft.new_information),
    ),
    draft.new_information,
  ].slice(-6);
  session.plot_state.last_new_information = draft.new_information;
  session.plot_state.recent_locations = [
    ...session.plot_state.recent_locations.filter(
      (location) => normalizeText(location) !== normalizeText(beat.location),
    ),
    beat.location,
  ].slice(-3);
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
    plot_progress: {
      current_beat_index: session.plot_state.current_beat_index,
      total_beats: session.plot_outline.beats.length,
      current_beat: {
        beat_type: currentPlotBeat(session).beat_type,
        title: currentPlotBeat(session).title,
        location: currentPlotBeat(session).location,
        objective: currentPlotBeat(session).objective,
        story_question: currentPlotBeat(session).story_question,
      },
      completed_beat_types: session.plot_state.completed_beat_types,
      open_threads: session.plot_state.open_threads,
      discovered_clues: session.plot_state.discovered_clues,
      last_new_information: session.plot_state.last_new_information,
    },
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
  const targetId = proposal.arguments.target_id;
  if (proposal.command_type === "pursue_goal") return !targetId;
  if (!targetId) return false;
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

function currentPlotBeat(session: WorldSession): PlotBeat {
  return session.plot_outline.beats[session.plot_state.current_beat_index];
}

function characterIdsForBeat(
  session: WorldSession,
  beat: PlotBeat,
): string[] {
  return beat.present_character_prototypes
    .map(
      (prototype) =>
        session.characters.find(
          (character) => character.prototype === prototype,
        )?.character_id,
    )
    .filter((characterId): characterId is string => Boolean(characterId));
}

function addEventEffect(
  event: StoryEvent,
  path: string,
  from: string | number,
  to: string | number,
): void {
  const existing = event.effects.find((effect) => effect.path === path);
  if (existing) {
    existing.to = to;
    return;
  }
  event.effects.push({ path, from, to });
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordOverlap(left: string, right: string): number {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "to",
    "of",
    "in",
    "is",
    "it",
    "you",
    "your",
    "that",
    "with",
    "as",
    "for",
  ]);
  const leftWords = new Set(
    normalizeText(left)
      .split(" ")
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );
  const rightWords = new Set(
    normalizeText(right)
      .split(" ")
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );
  if (leftWords.size === 0 || rightWords.size === 0) return 0;
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.min(leftWords.size, rightWords.size);
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
