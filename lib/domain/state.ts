import { createId } from "@/lib/id";
import { eligibleStorylets } from "@/lib/narrative/storylets";
import {
  createInitialSimulation,
  ensureSimulation,
} from "@/lib/simulation/world";
import { fallbackStoryTurn } from "./fallbacks";
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
  StoryBlock,
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
    storylet_id: "opening_seed",
    causal_chain: {
      chosen_action_result: "The listener has not acted yet.",
      cost_paid: "No cost has been paid yet.",
      observable_clue: preview.seed.opening_scene.objective_label,
      new_hypothesis: preview.seed.story.central_question,
      next_pressure: preview.seed.opening_scene.danger_label,
    },
    character_moves: [],
    new_information: null,
    thread_opened: preview.seed.story.central_question,
    thread_resolved: null,
    present_character_ids:
      preview.seed.opening_scene.present_character_prototypes.map(
        (prototype) => mustGetCharacter(byPrototype, prototype).character_id,
      ),
    narration: preview.seed.opening_narration,
    dialogue: [],
    story_blocks: [
      {
        block_type: "narration",
        character_id: null,
        text: preview.seed.opening_narration,
        responds_to_previous: false,
      },
    ],
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
  const simulation = createInitialSimulation(preview, characters);

  return {
    schema_version: 2,
    universe_id: createId("univ"),
    storyline_id: createId("story"),
    branch_id: createId("branch"),
    template_id: preview.resolved_template_id,
    universe: preview.seed.universe,
    story: preview.seed.story,
    arc_plan: preview.seed.arc_plan,
    storylet_deck: preview.seed.storylet_deck,
    creativity: preview.creativity ?? "balanced",
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
      recent_storylet_ids: [],
      status: "active",
    },
    character_minds: Object.fromEntries(
      characters.map((character) => [
        character.character_id,
        {
          current_goal: character.goal,
          current_belief: `I believe my goal is still possible, but I do not yet know whether the listener will help me.`,
          current_emotion:
            character.prototype === "ally"
              ? "afraid but hopeful"
              : character.prototype === "rival"
                ? "controlled and watchful"
                : "guarded",
          attitude_to_listener: character.relationship_to_listener,
          last_changed_event_id: null,
        },
      ]),
    ),
    simulation,
    simulation_events: [],
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
  session.arc_state.recent_storylet_ids ??= [];
  session.storylet_deck ??= [];
  session.creativity ??= "balanced";
  session.character_minds ??= Object.fromEntries(
    session.characters.map((character) => [
      character.character_id,
      {
        current_goal: character.goal,
        current_belief: `I am pursuing ${character.goal.toLowerCase()}.`,
        current_emotion: "guarded",
        attitude_to_listener: character.relationship_to_listener,
        last_changed_event_id: null,
      },
    ]),
  );
  for (const scene of session.scenes) {
    scene.storylet_id ??= scene.created_from_event_id ? "legacy_scene" : "opening_seed";
    scene.causal_chain ??= {
      chosen_action_result: scene.because_of_choice,
      cost_paid: scene.immediate_consequence,
      observable_clue: scene.new_information ?? scene.obstacle,
      new_hypothesis: scene.thread_opened ?? session.story.central_question,
      next_pressure: scene.obstacle,
    };
    scene.character_moves ??= [];
    scene.story_blocks ??= interleaveStoryBlocks(scene.narration, scene.dialogue);
  }
  ensureSimulation(session);
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
  assertSchemaV2(session);
  const storylets = eligibleStorylets(session, event);
  const milestoneIndex = session.arc_state.active_milestone_index;
  const revealIndex = (type: MilestoneType | null) =>
    type
      ? session.arc_state.milestones.findIndex(
          (candidate) => candidate.milestone_type === type,
        )
      : -1;
  const permittedFactIds = Object.values(session.simulation.facts)
    .filter(
      (fact) =>
        fact.reveal_after === null ||
        session.state.unlocked_fact_ids.includes(fact.fact_id) ||
        (revealIndex(fact.reveal_after) <= milestoneIndex &&
          fact.known_by_character_ids.some((id) =>
            scene.present_character_ids.includes(id),
          )),
    )
    .map((fact) => fact.fact_id);
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
      mind: session.character_minds[character.character_id],
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
    selected_storylet_id: null,
    quality_warnings: [],
    prompt_version: 4,
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
        // The mystery keeper sat offstage for entire arcs because nothing ever
        // told the director they were missing. Surface it as state, not hope.
        offstage_characters: session.characters
          .filter(
            (character) =>
              !session.scenes.some((item) =>
                item.present_character_ids.includes(character.character_id),
              ),
          )
          .map((character) => ({
            character_id: character.character_id,
            name: character.name,
            prototype: character.prototype,
            scenes_absent: session.scenes.length,
          })),
        must_introduce_keeper: keeperMustAppear(session),
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
      canon_ledger: {
        timeline: {
          turn_index: session.state.turn_index,
          current_location: scene.location,
          recent_transitions: session.simulation.transitions.slice(-4).map(
            (transition) => ({
              from: transition.from_location_id
                ? session.simulation.entities[transition.from_location_id]?.name ??
                  transition.from_location_id
                : "unknown",
              to: transition.to_location_id
                ? session.simulation.entities[transition.to_location_id]?.name ??
                  transition.to_location_id
                : "unknown",
              time_passed: `${transition.elapsed_minutes} minutes`,
              reason: transition.reason,
            }),
          ),
        },
        active_objective: session.state.active_objective,
        character_positions: session.characters.map((character) => ({
          character_id: character.character_id,
          name: character.name,
          status: session.state.character_statuses[character.character_id],
          location: session.simulation.entities[character.character_id]?.location_id
            ? session.simulation.entities[
                session.simulation.entities[character.character_id].location_id!
              ]?.name ?? null
            : null,
          current_goal:
            session.simulation.characters[character.character_id]?.mind.current_goal ??
            character.goal,
          current_belief:
            session.simulation.characters[character.character_id]?.mind
              .current_belief ?? "",
        })),
        durable_clues: Object.values(session.simulation.facts)
          .filter(
            (fact) =>
              fact.status === "active" &&
              permittedFactIds.includes(fact.fact_id),
          )
          .map((fact) => fact.statement),
        world_rules: session.universe.rules,
      },
      scene_cell: {
        start_location: scene.location,
        required_choice_result: event.summary,
        permitted_character_ids: characterViews.map(
          (character) => character.character_id,
        ),
        permitted_unlocked_fact_ids: [
          ...new Set(permittedFactIds),
        ],
        forbidden_revelations: milestone.forbidden_revelations,
        dramatic_purpose: milestone.dramatic_purpose,
        completion_test: milestone.completion_evidence_description,
      },
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
      eligible_storylets: storylets,
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
  const warnings: string[] = [];
  const characterIds = new Set(session.characters.map((item) => item.character_id));
  let present = [...new Set(draft.present_character_ids)].filter((id) =>
    characterIds.has(id),
  );
  if (present.length < 2) {
    present = [...new Set([...present, ...current.present_character_ids])].filter(
      (id) => characterIds.has(id),
    ).slice(0, 3);
    warnings.push("Unknown or missing present-character IDs were replaced from canon.");
  }
  if (present.length < 2) throw new Error("A story scene needs two present characters.");
  const narrationWords = draft.narration.trim().split(/\s+/).length;
  // Only reject lengths that indicate a broken generation. Discarding a good
  // scene for being 2 words long is the same all-or-nothing failure that made
  // the template fallback the most common path.
  if (narrationWords < 80 || narrationWords > 460) {
    throw new Error(
      `Narration is outside the recoverable 80-460 word range; received ${narrationWords}.`,
    );
  }
  if (narrationWords < 120 || narrationWords > 200) {
    warnings.push(
      `Narration used ${narrationWords} words instead of the 120-200 target.`,
    );
  }
  // Storylet decks are authored in design voice ("The listener can rub charcoal
  // across the backing"). Those strings reach the reader through the fallback
  // narration and through scene_goal, so rewrite them into story voice rather
  // than discarding an otherwise usable scene.
  const beforeSanitize = [draft.narration, draft.scene_goal].join(" ");
  draft = {
    ...draft,
    narration: toStoryVoice(draft.narration),
    scene_goal: toStoryVoice(draft.scene_goal),
    dialogue: draft.dialogue.map((line) => ({
      ...line,
      text: toStoryVoice(line.text),
    })),
    story_blocks: draft.story_blocks.map((block) => ({
      ...block,
      text: toStoryVoice(block.text),
    })),
  };
  if (beforeSanitize !== [draft.narration, draft.scene_goal].join(" ")) {
    warnings.push("Design-voice phrasing was rewritten into story voice.");
  }

  const readerText = [
    draft.narration,
    draft.scene_goal,
    ...draft.dialogue.map((line) => line.text),
  ].join(" ");
  const bannedMeta = [
    "current objective",
    "latest obstacle",
    "investigation evidence",
    "usable lead",
    "the next move is specific",
    "milestone",
    "storylet",
    "char_ally",
    "char_rival",
    "char_keeper",
  ];
  const foundMeta = bannedMeta.find((phrase) =>
    normalize(readerText).includes(normalize(phrase)),
  );
  if (foundMeta || /\bturn\s+\d+\b/i.test(readerText)) {
    throw new Error(
      `Reader-facing prose exposed story-engine scaffolding${foundMeta ? `: ${foundMeta}` : ""}.`,
    );
  }
  const event = session.events.at(-1);
  const validStoryletIds = new Set(
    event ? eligibleStorylets(session, event).map((item) => item.storylet_id) : [],
  );
  if (!validStoryletIds.has(draft.storylet_id)) {
    throw new Error("The generated scene did not use an eligible storylet.");
  }

  const arrivals = present.filter((id) => !current.present_character_ids.includes(id));
  for (const characterId of arrivals) {
    const character = session.characters.find((item) => item.character_id === characterId)!;
    if (
      !normalize(draft.transition_reason).includes(normalize(character.name)) &&
      !normalize(draft.narration).includes(normalize(character.name))
    ) {
      present = present.filter((id) => id !== characterId);
      warnings.push(`Unexplained arrival for ${character.name} was removed.`);
    }
  }
  if (present.length < 2) {
    present = [...new Set([...present, ...current.present_character_ids])].slice(0, 3);
  }
  if (
    normalize(draft.location) !== normalize(current.location) &&
    (!draft.time_passed.trim() || !draft.transition_reason.trim())
  ) {
    throw new Error("A location change requires time_passed and transition_reason.");
  }
  const dialogue = draft.dialogue
    .filter((line) => present.includes(line.character_id) && line.text.trim())
    .slice(0, 8)
    .map((line, index) => ({
      ...line,
      responds_to_previous: index > 0,
    }));
  const speakers = new Set(dialogue.map((line) => line.character_id));
  if (
    dialogue.length < 3 ||
    speakers.size < 2
  ) {
    throw new Error("Dialogue must be a connected exchange between present characters.");
  }
  if (
    dialogue.length !== draft.dialogue.length ||
    draft.dialogue.some(
      (line, index) => line.responds_to_previous !== (index > 0),
    )
  ) {
    warnings.push("Dialogue IDs and response links were normalized to stored canon.");
  }
  let storyBlocks = draft.story_blocks.filter(
    (block) =>
      block.text.trim() &&
      (block.block_type === "narration"
        ? block.character_id === null
        : Boolean(block.character_id && present.includes(block.character_id))),
  );
  const dialogueBlocks = storyBlocks.filter(
    (block) => block.block_type === "dialogue",
  );
  const allDialogueRepresented = dialogue.every((line) =>
    dialogueBlocks.some(
      (block) =>
        block.character_id === line.character_id &&
        normalize(block.text) === normalize(line.text),
    ),
  );
  const properlyInterleaved = storyBlocks.every(
    (block, index) =>
      block.block_type !== "dialogue" ||
      (index > 0 &&
        index < storyBlocks.length - 1 &&
        storyBlocks[index - 1].block_type === "narration" &&
        storyBlocks[index + 1].block_type === "narration"),
  );
  const narrationBlocksAreComplete = storyBlocks
    .filter((block) => block.block_type === "narration")
    .every((block) => /[.!?]["'’”)]?$/.test(block.text.trim()));
  if (
    storyBlocks.length < 7 ||
    !allDialogueRepresented ||
    !properlyInterleaved ||
    !narrationBlocksAreComplete
  ) {
    const sentenceSafeBlocks = interleaveSentenceBlocks(
      draft.narration,
      dialogue,
    );
    if (!sentenceSafeBlocks) {
      throw new Error(
        "Narration does not contain enough complete action beats to interleave dialogue safely.",
      );
    }
    storyBlocks = sentenceSafeBlocks;
    warnings.push("Presentation blocks were rebuilt to interleave action and speech.");
  }
  // Exact-string matching let the same clue be rediscovered in paraphrase — the
  // ledger and the photograph were each "found" twice in one arc. Compare on
  // content-word overlap so a restatement is caught too.
  if (
    draft.new_information &&
    session.arc_state.discovered_clues.some(
      (clue) =>
        tokenOverlap(normalize(clue), normalize(draft.new_information!)) > 0.5,
    )
  ) {
    draft = { ...draft, new_information: null };
    warnings.push("A repeated discovery was omitted instead of discarding the scene.");
  }
  if (
    draft.new_information &&
    milestone.forbidden_revelations.some((item) =>
      normalize(draft.new_information!).includes(normalize(item)),
    )
  ) {
    draft = { ...draft, new_information: null };
    warnings.push("A discovery outside the active revelation boundary was omitted.");
  }

  const fallback = fallbackStoryTurn(session, event!);
  const expected = {
    protect: "help_character",
    pursue: "pursue_goal",
    confront: "confront_character",
  } as const;
  const proposals = (["protect", "pursue", "confront"] as const).map((axis) => {
    const proposed = draft.choice_proposals.find(
      (choice) => choice.axis === axis && choice.command_type === expected[axis],
    );
    const safe = fallback.choice_proposals.find((choice) => choice.axis === axis)!;
    if (!proposed) {
      warnings.push(
        `The ${axis} choice was missing from the scene and was replaced with a generic option.`,
      );
    }
    return proposed ?? safe;
  });
  for (const proposal of proposals) {
    const target = proposal.arguments.target_id;
    if (
      (proposal.axis === "protect" || proposal.axis === "confront") &&
      (!target || !present.includes(target))
    ) {
      const replacement =
        proposal.axis === "protect" ? present[0] : present[1] ?? present[0];
      proposal.arguments.target_id = replacement;
      warnings.push(`${proposal.axis} target was replaced with a present character.`);
    }
    if (proposal.axis === "pursue") proposal.arguments.target_id = null;
  }
  if (
    new Set(proposals.map((choice) => normalize(choice.narrative_intent))).size !== 3 ||
    new Set(proposals.map((choice) => normalize(choice.anticipated_tradeoff))).size !== 3
  ) {
    warnings.push("Duplicate choice framing was replaced with concrete fallback framing.");
    for (const axis of ["protect", "pursue", "confront"] as const) {
      const index = proposals.findIndex((choice) => choice.axis === axis);
      proposals[index] = fallback.choice_proposals.find(
        (choice) => choice.axis === axis,
      )!;
    }
  }

  const movesByCharacter = new Map(
    draft.character_moves
      .filter((move) => present.includes(move.character_id))
      .map((move) => [move.character_id, move]),
  );
  for (const characterId of present) {
    if (movesByCharacter.has(characterId)) continue;
    const fallbackMove = fallback.character_moves.find(
      (move) => move.character_id === characterId,
    );
    if (fallbackMove) {
      movesByCharacter.set(characterId, fallbackMove);
      warnings.push("A missing character move was restored from current character state.");
    }
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
    (milestone.unique_discovery_count > 0 ||
      Boolean(draft.new_information) ||
      afterThisScene >= milestone.maximum_scenes) &&
    Boolean(draft.milestone_completion_evidence);
  if (session.last_context_trace) {
    session.last_context_trace.quality_warnings = warnings;
  }
  return {
    ...draft,
    present_character_ids: present,
    dialogue,
    story_blocks: storyBlocks,
    character_moves: [...movesByCharacter.values()],
    choice_proposals: proposals,
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
    storylet_id: draft.storylet_id,
    causal_chain: draft.causal_chain,
    character_moves: draft.character_moves,
    new_information: draft.new_information,
    thread_opened: draft.thread_opened,
    thread_resolved: draft.thread_resolved,
    present_character_ids: draft.present_character_ids,
    narration: draft.narration,
    dialogue: draft.dialogue,
    story_blocks: draft.story_blocks,
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
  for (const move of draft.character_moves) {
    if (!session.character_minds[move.character_id]) continue;
    session.character_minds[move.character_id] = {
      current_goal: move.want_now,
      current_belief: move.belief_after,
      current_emotion: move.emotion_after,
      attitude_to_listener: move.relationship_move,
      last_changed_event_id: event.event_id,
    };
  }
  session.arc_state.recent_storylet_ids = [
    ...session.arc_state.recent_storylet_ids.filter(
      (id) => id !== draft.storylet_id,
    ),
    draft.storylet_id,
  ].slice(-4);
  if (session.last_context_trace) {
    session.last_context_trace.selected_storylet_id = draft.storylet_id;
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
  // At or past the scene ceiling the arc must be allowed to move on. Requiring a
  // unique discovery here deadlocks a milestone whose discoveries were all
  // rejected as repeats, and the story can then never reach its resolution.
  const atCeiling = milestone.scene_count >= milestone.maximum_scenes;
  if (
    milestone.scene_count < milestone.minimum_scenes ||
    (milestone.unique_discovery_count < 1 && !atCeiling) ||
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
      mind: session.character_minds[character.character_id],
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
    simulator: {
      version: session.simulation.simulation_version,
      time_label: session.simulation.clock.time_label,
      entity_count: Object.keys(session.simulation.entities).length,
      canonical_fact_count: Object.values(session.simulation.facts).filter(
        (fact) => fact.status === "active",
      ).length,
      open_thread_count: Object.values(session.simulation.threads).filter(
        (thread) => thread.status === "open",
      ).length,
      transition_count: session.simulation.transitions.length,
      last_effects:
        session.simulation_events.at(-1)?.effects.map(
          (effect) => effect.description,
        ) ?? [],
    },
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
    recent_storylet_ids: [],
    status: "active",
  };
  const simulationThreadId = `thread_arc_${priorArc.arc_number + 1}`;
  next.simulation.threads[simulationThreadId] = {
    thread_id: simulationThreadId,
    question,
    stakes: next.story.main_goal,
    status: "open",
    required_evidence_count: 3,
    evidence_fact_ids: [],
    opened_event_id: next.events.at(-1)?.event_id ?? null,
    resolved_event_id: null,
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
    storylet_id: "arc_continuation",
    causal_chain: {
      chosen_action_result: "The prior arc reached a lasting resolution.",
      cost_paid: consequences || "The world retains the cost of that resolution.",
      observable_clue: "Two incompatible reports describe the same aftermath.",
      new_hypothesis: question,
      next_pressure: "The consequence is spreading while the characters disagree.",
    },
    character_moves: [],
    new_information: null,
    thread_opened: question,
    thread_resolved: null,
    present_character_ids: present,
    narration: `Several days after the last decision, ${next.universe.title} has begun to live with what you changed. The victory remains real; nothing has reset. Yet its cost has travelled farther than anyone expected. At ${priorScene.location}, two familiar voices bring incompatible reports, each rooted in the choices they remember you making. One asks you to protect the people carrying the burden. Another points to evidence that the change is spreading. Between them lies a question the old story could not answer: ${question} You can begin with the relationship under pressure, follow the evidence, or confront the person whose version of the aftermath does not fit.`,
    dialogue: [],
    story_blocks: [
      {
        block_type: "narration",
        character_id: null,
        text: `Several days after the last decision, ${next.universe.title} has begun to live with what you changed. The victory remains real; nothing has reset. Yet its cost has travelled farther than anyone expected. At ${priorScene.location}, two familiar voices bring incompatible reports, each rooted in the choices they remember you making. One asks you to protect the people carrying the burden. Another points to evidence that the change is spreading. Between them lies a question the old story could not answer: ${question} You can begin with the relationship under pressure, follow the evidence, or confront the person whose version of the aftermath does not fit.`,
        responds_to_previous: false,
      },
    ],
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

// True once the arc has reached the stage where a secret-holder the listener has
// never met would make the revelation meaningless.
function keeperMustAppear(session: WorldSession): boolean {
  const keeper = session.characters.find(
    (character) => character.prototype === "mystery_keeper",
  );
  if (!keeper) return false;
  const hasAppeared = session.scenes.some((scene) =>
    scene.present_character_ids.includes(keeper.character_id),
  );
  if (hasAppeared) return false;
  const reached = new Set(session.arc_state.completed_milestone_types);
  return (
    reached.has("escalation") ||
    session.arc_state.milestones[session.arc_state.active_milestone_index]
      .milestone_type !== "investigation"
  );
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

// Rewrites design-document phrasing into second-person story voice.
function toStoryVoice(value: string): string {
  return value
    .replace(/\bThe listener can\b/g, "You can")
    .replace(/\bthe listener can\b/g, "you can")
    .replace(/\bThe listener's\b/g, "Your")
    .replace(/\bthe listener's\b/g, "your")
    .replace(/\bThe listener\b/g, "You")
    .replace(/\bthe listener\b/g, "you");
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter((token) => token.length > 3));
  const rightTokens = new Set(right.split(" ").filter((token) => token.length > 3));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return shared / Math.min(leftTokens.size, rightTokens.size);
}

function interleaveStoryBlocks(
  narration: string,
  dialogue: StoryTurnDraft["dialogue"],
): StoryBlock[] {
  if (dialogue.length === 0) {
    return [
      {
        block_type: "narration",
        character_id: null,
        text: narration,
        responds_to_previous: false,
      },
    ];
  }
  const sentenceSafe = interleaveSentenceBlocks(narration, dialogue);
  if (sentenceSafe) return sentenceSafe;
  return [
    {
      block_type: "narration",
      character_id: null,
      text: narration,
      responds_to_previous: false,
    },
  ];
}

function interleaveSentenceBlocks(
  narration: string,
  dialogue: StoryTurnDraft["dialogue"],
): StoryBlock[] | null {
  if (!dialogue.length) return interleaveStoryBlocks(narration, dialogue);
  const units =
    narration
      .match(/[^.!?]+(?:[.!?]+["'’”)]*|$)/g)
      ?.map((unit) => unit.trim())
      .filter(Boolean) ?? [];
  const chunkCount = dialogue.length + 1;
  if (units.length < chunkCount) return null;
  const baseSize = Math.floor(units.length / chunkCount);
  const remainder = units.length % chunkCount;
  const narrationChunks: string[] = [];
  let cursor = 0;
  for (let index = 0; index < chunkCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    narrationChunks.push(units.slice(cursor, cursor + size).join(" "));
    cursor += size;
  }
  const blocks: StoryBlock[] = [];
  for (let index = 0; index < dialogue.length; index += 1) {
    if (narrationChunks[index]) {
      blocks.push({
        block_type: "narration",
        character_id: null,
        text: narrationChunks[index],
        responds_to_previous: index > 0,
      });
    }
    blocks.push({
      block_type: "dialogue",
      character_id: dialogue[index].character_id,
      text: dialogue[index].text,
      responds_to_previous: index > 0,
    });
  }
  if (narrationChunks.at(-1)) {
    blocks.push({
      block_type: "narration",
      character_id: null,
      text: narrationChunks.at(-1)!,
      responds_to_previous: true,
    });
  }
  return blocks;
}
