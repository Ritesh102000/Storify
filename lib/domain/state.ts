import { createId } from "@/lib/id";
import type {
  ArcMilestoneState,
  Character,
  Choice,
  ChoiceProposal,
  ContextTrace,
  CraftCard,
  FastTurnPacket,
  MilestoneContract,
  MilestoneType,
  Prototype,
  RetrievalTrace,
  Scene,
  StoryEvent,
  StoryFact,
  StoryTurnDraft,
  WorldPreview,
  WorldSession,
  WorldView,
} from "@/lib/types";

const PROTOTYPE_IDS: Record<Prototype, string> = {
  ally: "char_ally",
  rival: "char_rival",
  mystery_keeper: "char_keeper",
};

const SCENE_LIMITS: Record<MilestoneType, [number, number]> = {
  opening: [1, 1],
  investigation: [2, 3],
  escalation: [1, 3],
  revelation: [1, 2],
  reversal: [1, 2],
  crisis: [1, 2],
  resolution: [1, 2],
};

export function materializeWorld(preview: WorldPreview): WorldSession {
  const now = new Date().toISOString();
  const characters: Character[] = preview.seed.characters.map((character) => ({
    ...character,
    character_id: PROTOTYPE_IDS[character.prototype],
    secret_fact_id: `fact_${character.prototype}_secret`,
  }));
  const byPrototype = new Map(
    characters.map((character) => [character.prototype, character]),
  );
  const ally = mustGetCharacter(byPrototype, "ally");
  const rival = mustGetCharacter(byPrototype, "rival");
  const keeper = mustGetCharacter(byPrototype, "mystery_keeper");
  const sceneId = createId("scene");
  const objectiveId = createId("objective");
  const choices = preview.seed.first_choice_proposals.map((proposal) =>
    proposalToChoice(proposal, sceneId, byPrototype),
  );
  const scene: Scene = {
    scene_id: sceneId,
    scene_index: 0,
    milestone_type: "opening",
    title: preview.seed.story.opening_hook,
    location: preview.seed.opening_scene.location,
    situation: preview.seed.opening_scene.situation,
    scene_goal: preview.seed.opening_scene.objective_label,
    objective_id: objectiveId,
    obstacle: preview.seed.opening_scene.danger_label,
    because_of_choice: "The listener has not acted yet.",
    immediate_consequence: "The opening danger is still unfolding.",
    time_passed: "No time has passed.",
    transition_reason: "This is the opening scene.",
    new_information: null,
    thread_opened: preview.seed.story.central_question,
    thread_resolved: null,
    present_character_ids:
      preview.seed.opening_scene.present_character_prototypes.map(
        (prototype) => mustGetCharacter(byPrototype, prototype).character_id,
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
  const milestones = preview.seed.arc_plan.milestones.map(toMilestoneState);
  milestones[0].status = "active";
  milestones[0].scene_count = 1;

  return {
    schema_version: 2,
    universe_id: createId("univ"),
    storyline_id: createId("story"),
    branch_id: createId("branch"),
    template_id: preview.resolved_template_id,
    universe: preview.seed.universe,
    story: preview.seed.story,
    arc_plan: preview.seed.arc_plan,
    arc_state: {
      arc_id: createId("arc"),
      arc_number: 1,
      active_milestone_index: 0,
      milestones,
      completed_milestone_types: [],
      open_threads: [preview.seed.story.central_question],
      discovered_clues: [],
      last_new_information: null,
      recent_locations: [preview.seed.opening_scene.location],
      recent_pattern_ids: preview.retrieval?.selected_pattern_id
        ? [preview.retrieval.selected_pattern_id]
        : [],
      status: "active",
    },
    semantic_labels: {
      objective_label: preview.seed.opening_scene.objective_label,
      danger_label: preview.seed.opening_scene.danger_label,
      threat_label: rival.name,
      progress_label: preview.seed.story.main_goal,
    },
    characters,
    state: {
      schema_version: 2,
      turn_index: 0,
      story_progress: 0,
      goal_status: "active",
      active_objective: {
        objective_id: objectiveId,
        label: preview.seed.opening_scene.objective_label,
        status: "active",
      },
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
    },
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

function toMilestoneState(contract: MilestoneContract): ArcMilestoneState {
  const [minimum_scenes, maximum_scenes] = SCENE_LIMITS[contract.milestone_type];
  return {
    ...contract,
    milestone_id: createId("milestone"),
    minimum_scenes,
    maximum_scenes,
    scene_count: 0,
    unique_discovery_count: 0,
    status: "pending",
    completion_evidence: null,
  };
}

export function proposalToChoice(
  proposal: ChoiceProposal,
  sceneId: string,
  byPrototype: Map<Prototype, Character>,
): Choice {
  const target = proposal.target_prototype
    ? mustGetCharacter(byPrototype, proposal.target_prototype)
    : null;
  return {
    choice_id: createId("choice"),
    scene_id: sceneId,
    axis: proposal.axis,
    command_type: proposal.command_type,
    arguments: target ? { target_id: target.character_id } : {},
    label: proposal.label,
    narrative_intent: proposal.narrative_intent,
    anticipated_tradeoff: proposal.anticipated_tradeoff,
    status: "available",
  };
}

export function currentScene(session: WorldSession): Scene {
  const scene = session.scenes.find((item) => item.scene_id === session.current_scene_id);
  if (!scene) throw new Error("Current scene is missing.");
  return scene;
}

export function assertSchemaV2(session: WorldSession): void {
  if ((session as { schema_version?: number }).schema_version !== 2) {
    const error = new Error("This saved world uses the retired fixed-chapter schema.");
    Object.assign(error, {
      status: 409,
      code: "WORLD_SCHEMA_OUTDATED",
      publicMessage: "This world uses an older story engine. Start a new world.",
    });
    throw error;
  }
}

export function prepareArcForTurn(session: WorldSession): void {
  const active = activeMilestone(session);
  if (active.milestone_type !== "opening") return;
  active.status = "completed";
  active.completion_evidence = "The listener selected an opening action and accepted its cost.";
  session.arc_state.completed_milestone_types.push("opening");
  session.arc_state.active_milestone_index = 1;
  session.arc_state.milestones[1].status = "active";
}

export function buildFastTurnPacket(
  session: WorldSession,
  event: StoryEvent,
  cards: CraftCard[],
  retrieval: RetrievalTrace,
): { packet: FastTurnPacket; trace: ContextTrace } {
  const scene = currentScene(session);
  const milestone = activeMilestone(session);
  const recentEvents = session.events.slice(-3).map((item) => ({
    event_id: item.event_id,
    command_type: item.command_type,
    summary: item.summary,
    source_location: item.source_location,
  }));
  const characterViews = session.characters
    .filter(
      (character) =>
        scene.present_character_ids.includes(character.character_id) ||
        session.state.character_statuses[character.character_id] !== "unavailable",
    )
    .map((character) => ({
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
      relationship_to_listener: session.state.relationships[character.character_id],
      accessible_memories: session.memories
        .filter((memory) => memory.character_id === character.character_id)
        .slice(-5),
      unlocked_facts: session.facts.filter(
        (fact) =>
          fact.character_id === character.character_id &&
          session.state.unlocked_fact_ids.includes(fact.fact_id),
      ),
    }));
  const trace: ContextTrace = {
    trace_id: createId("trace"),
    universe_id: session.universe_id,
    branch_id: session.branch_id,
    scene_id: scene.scene_id,
    event_id: event.event_id,
    recent_event_ids: recentEvents.map((item) => item.event_id),
    character_ids: characterViews.map((item) => item.character_id),
    memory_ids: characterViews.flatMap((item) =>
      item.accessible_memories.map((memory) => memory.memory_id),
    ),
    unlocked_fact_ids: [...session.state.unlocked_fact_ids],
    state_fields: [...new Set(event.effects.map((effect) => effect.path))],
    milestone_type: milestone.milestone_type,
    open_thread_count: session.arc_state.open_threads.length,
    proposal_count: 0,
    valid_choice_count: 0,
    retrieval,
    prompt_version: 3,
    schema_version: 2,
  };
  return {
    packet: {
      schema_version: 2,
      world: { universe_id: session.universe_id, ...session.universe },
      story: session.story,
      arc_context: {
        arc_id: session.arc_state.arc_id,
        active_milestone: milestone,
        completed_milestone_types: session.arc_state.completed_milestone_types,
        open_threads: session.arc_state.open_threads,
        discovered_clues: session.arc_state.discovered_clues,
        last_new_information: session.arc_state.last_new_information,
        recent_locations: session.arc_state.recent_locations.slice(-4),
        recent_pattern_ids: session.arc_state.recent_pattern_ids.slice(-4),
        must_complete_this_turn:
          milestone.scene_count + 1 >= milestone.maximum_scenes,
        novelty_rules: [
          "The selected choice must cause the immediate consequence and next scene.",
          "Do not reuse a stored discovery, recent scene goal, or recent dramatic situation.",
          "A new location requires explicit elapsed time and a causal transition.",
          "Stay in the current location when the dramatic situation can genuinely change there.",
          "Use retrieved cards only as abstract craft patterns; never copy source prose or names.",
        ],
      },
      committed_event: {
        event_id: event.event_id,
        command_type: event.command_type,
        summary: event.summary,
        source_location: event.source_location,
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
      retrieved_craft_cards: cards,
      supported_commands: [
        "help_character",
        "pursue_goal",
        "confront_character",
      ],
      output_requirements: {
        narration_min_words: 120,
        narration_max_words: 200,
        dialogue_min_items: 4,
        dialogue_max_items: 8,
        choice_proposal_limit: 3,
        canonical_discovery_limit: 1,
      },
    },
    trace,
  };
}

export function validateStoryTurnReferences(
  session: WorldSession,
  draft: StoryTurnDraft,
): StoryTurnDraft {
  const current = currentScene(session);
  const milestone = activeMilestone(session);
  const characterIds = new Set(session.characters.map((item) => item.character_id));
  const present = [...new Set(draft.present_character_ids)].filter((id) =>
    characterIds.has(id),
  );
  if (present.length < 2) throw new Error("A story scene needs two present characters.");
  const narrationWords = draft.narration.trim().split(/\s+/).length;
  if (narrationWords < 120 || narrationWords > 200) {
    throw new Error(
      `Narration must contain 120-200 words; received ${narrationWords}.`,
    );
  }

  const arrivals = present.filter((id) => !current.present_character_ids.includes(id));
  for (const characterId of arrivals) {
    const character = session.characters.find((item) => item.character_id === characterId)!;
    if (
      !normalize(draft.transition_reason).includes(normalize(character.name)) &&
      !normalize(draft.narration).includes(normalize(character.name))
    ) {
      throw new Error(`The arrival of ${character.name} was not explained.`);
    }
  }
  if (
    normalize(draft.location) !== normalize(current.location) &&
    (!draft.time_passed.trim() || !draft.transition_reason.trim())
  ) {
    throw new Error("A location change requires time_passed and transition_reason.");
  }
  const speakers = new Set(draft.dialogue.map((line) => line.character_id));
  if (
    speakers.size < 2 ||
    [...speakers].some((id) => !present.includes(id)) ||
    draft.dialogue.slice(1).some((line) => !line.responds_to_previous)
  ) {
    throw new Error("Dialogue must be a connected exchange between present characters.");
  }
  const priorDiscoveries = new Set(session.arc_state.discovered_clues.map(normalize));
  if (draft.new_information && priorDiscoveries.has(normalize(draft.new_information))) {
    throw new Error("The proposed discovery repeats stored canon.");
  }
  if (
    draft.new_information &&
    milestone.forbidden_revelations.some((item) =>
      normalize(draft.new_information!).includes(normalize(item)),
    )
  ) {
    throw new Error("The discovery violates the milestone revelation boundary.");
  }

  const proposals = draft.choice_proposals;
  const expected = {
    protect: "help_character",
    pursue: "pursue_goal",
    confront: "confront_character",
  } as const;
  if (
    new Set(proposals.map((choice) => choice.axis)).size !== 3 ||
    proposals.some((choice) => expected[choice.axis] !== choice.command_type)
  ) {
    throw new Error("Choices must provide one valid protect, pursue, and confront axis.");
  }
  for (const proposal of proposals) {
    const target = proposal.arguments.target_id;
    if (
      (proposal.axis === "protect" || proposal.axis === "confront") &&
      (!target || !present.includes(target))
    ) {
      throw new Error(`${proposal.axis} must target a present character.`);
    }
  }
  if (
    new Set(proposals.map((choice) => normalize(choice.narrative_intent))).size !== 3 ||
    new Set(proposals.map((choice) => normalize(choice.anticipated_tradeoff))).size !== 3
  ) {
    throw new Error("Choices need distinct intents and tradeoffs.");
  }

  const resolved = draft.thread_resolved
    ? session.arc_state.open_threads.find(
        (thread) => normalize(thread) === normalize(draft.thread_resolved!),
      ) ?? null
    : null;
  const opened =
    draft.thread_opened &&
    !session.arc_state.open_threads.some(
      (thread) => normalize(thread) === normalize(draft.thread_opened!),
    )
      ? draft.thread_opened
      : null;
  const afterThisScene = milestone.scene_count + 1;
  const canComplete =
    afterThisScene >= milestone.minimum_scenes &&
    (milestone.unique_discovery_count > 0 || Boolean(draft.new_information)) &&
    Boolean(draft.milestone_completion_evidence);
  return {
    ...draft,
    present_character_ids: present,
    thread_resolved: resolved,
    thread_opened: opened,
    milestone_action:
      draft.milestone_action === "complete" && canComplete ? "complete" : "continue",
    milestone_completion_evidence:
      draft.milestone_action === "complete" && canComplete
        ? draft.milestone_completion_evidence
        : null,
  };
}

export function appendStoryTurn(
  session: WorldSession,
  event: StoryEvent,
  proposed: StoryTurnDraft,
): WorldSession {
  const draft = validateStoryTurnReferences(session, proposed);
  const milestone = activeMilestone(session);
  const sceneId = createId("scene");
  const objectiveId = createId("objective");
  const ending =
    milestone.milestone_type === "resolution" &&
    draft.milestone_action === "complete";
  const choices = ending
    ? []
    : draft.choice_proposals.map((proposal) => ({
        choice_id: createId("choice"),
        scene_id: sceneId,
        axis: proposal.axis,
        command_type: proposal.command_type,
        arguments: proposal.arguments.target_id
          ? { target_id: proposal.arguments.target_id }
          : {},
        label: proposal.label,
        narrative_intent: proposal.narrative_intent,
        anticipated_tradeoff: proposal.anticipated_tradeoff,
        status: "available" as const,
      }));
  const scene: Scene = {
    scene_id: sceneId,
    scene_index: session.scenes.length,
    milestone_type: milestone.milestone_type,
    title: draft.scene_title,
    location: draft.location,
    situation: draft.immediate_consequence,
    scene_goal: draft.scene_goal,
    objective_id: objectiveId,
    obstacle: draft.obstacle,
    because_of_choice: draft.because_of_choice,
    immediate_consequence: draft.immediate_consequence,
    time_passed: draft.time_passed,
    transition_reason: draft.transition_reason,
    new_information: draft.new_information,
    thread_opened: draft.thread_opened,
    thread_resolved: draft.thread_resolved,
    present_character_ids: draft.present_character_ids,
    narration: draft.narration,
    dialogue: draft.dialogue,
    choice_ids: choices.map((choice) => choice.choice_id),
    created_from_event_id: event.event_id,
  };
  session.scenes.push(scene);
  session.choices.push(...choices);
  session.current_scene_id = sceneId;
  if (session.last_context_trace) {
    session.last_context_trace.valid_choice_count = choices.length;
  }
  session.state.active_objective = {
    objective_id: objectiveId,
    label: draft.scene_goal,
    status: ending ? "achieved" : "active",
  };
  for (const characterId of draft.present_character_ids) {
    if (session.state.character_statuses[characterId] === "absent") {
      session.state.character_statuses[characterId] = "active";
    }
  }
  if (draft.thread_resolved) {
    session.arc_state.open_threads = session.arc_state.open_threads.filter(
      (thread) => normalize(thread) !== normalize(draft.thread_resolved!),
    );
  }
  if (draft.thread_opened) {
    session.arc_state.open_threads.push(draft.thread_opened);
  }
  if (draft.new_information) {
    session.arc_state.discovered_clues.push(draft.new_information);
    session.arc_state.last_new_information = draft.new_information;
    milestone.unique_discovery_count += 1;
  }
  session.arc_state.recent_locations = [
    ...session.arc_state.recent_locations.filter(
      (location) => normalize(location) !== normalize(draft.location),
    ),
    draft.location,
  ].slice(-4);
  const selectedPattern = session.last_context_trace?.retrieval.selected_pattern_id;
  if (selectedPattern) {
    session.arc_state.recent_pattern_ids = [
      ...session.arc_state.recent_pattern_ids.filter((id) => id !== selectedPattern),
      selectedPattern,
    ].slice(-4);
  }
  milestone.scene_count += 1;
  evaluateMilestone(session, draft);
  session.state.story_progress = deriveProgress(session);
  return session;
}

function evaluateMilestone(session: WorldSession, draft: StoryTurnDraft): void {
  const milestone = activeMilestone(session);
  if (draft.milestone_action !== "complete") return;
  if (
    milestone.scene_count < milestone.minimum_scenes ||
    milestone.unique_discovery_count < 1 ||
    !draft.milestone_completion_evidence
  ) {
    return;
  }
  milestone.status = "completed";
  milestone.completion_evidence = draft.milestone_completion_evidence;
  if (!session.arc_state.completed_milestone_types.includes(milestone.milestone_type)) {
    session.arc_state.completed_milestone_types.push(milestone.milestone_type);
  }
  if (milestone.milestone_type === "resolution") {
    session.arc_state.status = "completed";
    session.state.goal_status = "completed";
    session.state.story_progress = 100;
    return;
  }
  session.arc_state.active_milestone_index += 1;
  session.arc_state.milestones[session.arc_state.active_milestone_index].status =
    "active";
}

export function mustCompleteActiveMilestone(session: WorldSession): boolean {
  const milestone = activeMilestone(session);
  return milestone.scene_count + 1 >= milestone.maximum_scenes;
}

export function isRepetitiveStoryTurn(
  session: WorldSession,
  draft: StoryTurnDraft,
): boolean {
  const candidate = normalize(
    [draft.narration, draft.new_information ?? "", draft.scene_goal].join(" "),
  );
  return session.scenes.slice(-3).some((scene) => {
    const previous = normalize(
      [scene.narration, scene.new_information ?? "", scene.scene_goal].join(" "),
    );
    return tokenOverlap(candidate, previous) > 0.72;
  });
}

export function toWorldView(session: WorldSession): WorldView {
  assertSchemaV2(session);
  const scene = currentScene(session);
  const choiceSet = new Set(scene.choice_ids);
  const milestone = activeMilestone(session);
  return {
    universe_id: session.universe_id,
    branch_id: session.branch_id,
    template_id: session.template_id,
    universe: session.universe,
    story: session.story,
    semantic_labels: session.semantic_labels,
    arc_progress: {
      arc_id: session.arc_state.arc_id,
      arc_number: session.arc_state.arc_number,
      status: session.arc_state.status,
      current_milestone: milestone,
      completed_milestone_types: session.arc_state.completed_milestone_types,
      completed_count: session.arc_state.completed_milestone_types.length,
      total_milestones: session.arc_state.milestones.length,
      turn_count: session.scenes.length,
      minimum_turns: 8,
      maximum_turns: 15,
      open_threads: session.arc_state.open_threads,
      discovered_clues: session.arc_state.discovered_clues,
      last_new_information: session.arc_state.last_new_information,
    },
    state: session.state,
    scene,
    choices: session.choices.filter((choice) => choiceSet.has(choice.choice_id)),
    characters: session.characters.map((character) => ({
      prototype: character.prototype,
      name: character.name,
      role_in_world: character.role_in_world,
      relationship_to_listener: character.relationship_to_listener,
      traits: character.traits,
      goal: character.goal,
      fear: character.fear,
      speech_style: character.speech_style,
      voice_hint: character.voice_hint,
      character_id: character.character_id,
      status: session.state.character_statuses[character.character_id],
      relationship: session.state.relationships[character.character_id],
      memories: session.memories.filter(
        (memory) => memory.character_id === character.character_id,
      ),
      unlocked_facts: session.facts.filter(
        (fact) =>
          fact.character_id === character.character_id &&
          session.state.unlocked_fact_ids.includes(fact.fact_id),
      ),
    })),
    last_event: session.events.at(-1) ?? null,
    last_state_diff: session.events.at(-1)?.effects ?? [],
    context_trace: session.last_context_trace,
    spin_offs: session.spin_offs,
    generation: session.generation,
  };
}

export function continueWorldArc(session: WorldSession): WorldSession {
  assertSchemaV2(session);
  if (session.arc_state.status !== "completed") {
    throw new Error("The current arc must be resolved before continuing.");
  }
  const next = structuredClone(session);
  const priorArc = next.arc_state;
  const consequences = next.events.slice(-2).map((event) => event.summary).join(" ");
  const question = `What new consequence of the last resolution now threatens ${next.universe.title}?`;
  next.story.central_question = question;
  next.story.main_goal = `Resolve the new consequence without undoing the canon of arc ${priorArc.arc_number}`;
  next.arc_plan = {
    ...next.arc_plan,
    ending_direction:
      "Resolve the new consequence while preserving all prior events, memories, facts, and relationship changes.",
    milestones: next.arc_plan.milestones.map((milestone) => ({
      ...milestone,
      dramatic_purpose:
        milestone.milestone_type === "opening"
          ? `Expose a concrete new consequence of prior canon: ${consequences}`
          : milestone.dramatic_purpose,
    })),
  };
  const milestones = next.arc_plan.milestones.map(toMilestoneState);
  milestones[0].status = "active";
  milestones[0].scene_count = 1;
  next.arc_state = {
    arc_id: createId("arc"),
    arc_number: priorArc.arc_number + 1,
    active_milestone_index: 0,
    milestones,
    completed_milestone_types: [],
    open_threads: [question],
    discovered_clues: [],
    last_new_information: null,
    recent_locations: [currentScene(next).location],
    recent_pattern_ids: [],
    status: "active",
  };
  next.state.goal_status = "active";
  next.state.story_progress = 0;
  const priorScene = currentScene(next);
  const present = priorScene.present_character_ids.slice(0, 2);
  const sceneId = createId("scene");
  const objectiveId = createId("objective");
  const choices = continuationChoices(next, sceneId, present);
  const opening: Scene = {
    scene_id: sceneId,
    scene_index: next.scenes.length,
    milestone_type: "opening",
    title: `Aftermath: Arc ${priorArc.arc_number + 1}`,
    location: priorScene.location,
    situation: "The previous resolution holds, but one of its consequences demands action.",
    scene_goal: "Identify which consequence has become the new threat",
    objective_id: objectiveId,
    obstacle: "The characters disagree about what the previous victory now requires.",
    because_of_choice: consequences || "The previous arc changed the world.",
    immediate_consequence:
      "A settled relationship and a changed world rule now point toward a fresh conflict.",
    time_passed: "Several days have passed.",
    transition_reason: "The world has had time to react to the previous resolution.",
    new_information: null,
    thread_opened: question,
    thread_resolved: null,
    present_character_ids: present,
    narration: `Several days after the last decision, ${next.universe.title} has begun to live with what you changed. The victory remains real; nothing has reset. Yet its cost has travelled farther than anyone expected. At ${priorScene.location}, two familiar voices bring incompatible reports, each rooted in the choices they remember you making. One asks you to protect the people carrying the burden. Another points to evidence that the change is spreading. Between them lies a question the old story could not answer: ${question} You can begin with the relationship under pressure, follow the evidence, or confront the person whose version of the aftermath does not fit.`,
    dialogue: [],
    choice_ids: choices.map((choice) => choice.choice_id),
    created_from_event_id: null,
  };
  next.scenes.push(opening);
  next.choices.push(...choices);
  next.current_scene_id = sceneId;
  next.state.active_objective = {
    objective_id: objectiveId,
    label: opening.scene_goal,
    status: "active",
  };
  next.last_context_trace = null;
  return next;
}

function continuationChoices(
  session: WorldSession,
  sceneId: string,
  present: string[],
): Choice[] {
  const first = present[0];
  const second = present[1] ?? first;
  return [
    {
      choice_id: createId("choice"),
      scene_id: sceneId,
      axis: "protect",
      command_type: "help_character",
      arguments: { target_id: first },
      label: `Protect ${characterName(session, first)} from the new consequence.`,
      narrative_intent: "Begin the new arc with the relationship under pressure.",
      anticipated_tradeoff: "The spreading evidence may become harder to follow.",
      status: "available",
    },
    {
      choice_id: createId("choice"),
      scene_id: sceneId,
      axis: "pursue",
      command_type: "pursue_goal",
      arguments: {},
      label: "Follow the first physical sign of the spreading change.",
      narrative_intent: "Define the new conflict through evidence.",
      anticipated_tradeoff: "A character asking for immediate help may feel abandoned.",
      status: "available",
    },
    {
      choice_id: createId("choice"),
      scene_id: sceneId,
      axis: "confront",
      command_type: "confront_character",
      arguments: { target_id: second },
      label: `Confront ${characterName(session, second)} about the conflicting report.`,
      narrative_intent: "Define the new conflict through contested testimony.",
      anticipated_tradeoff: "The confrontation will increase tension before facts are secure.",
      status: "available",
    },
  ];
}

function activeMilestone(session: WorldSession): ArcMilestoneState {
  return session.arc_state.milestones[session.arc_state.active_milestone_index];
}

function deriveProgress(session: WorldSession): number {
  if (session.arc_state.status === "completed") return 100;
  const completed = session.arc_state.completed_milestone_types.length;
  const milestone = activeMilestone(session);
  const within = milestone.scene_count / milestone.maximum_scenes;
  return Math.min(99, Math.round(((completed + within) / 7) * 100));
}

function mustGetCharacter(
  map: Map<Prototype, Character>,
  prototype: Prototype,
): Character {
  const character = map.get(prototype);
  if (!character) throw new Error(`Missing ${prototype} character.`);
  return character;
}

function characterName(session: WorldSession, id: string): string {
  return session.characters.find((item) => item.character_id === id)?.name ?? "them";
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 3));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 3));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}
