import { STARTER_WORLDS } from "@/lib/fixtures";
import { eligibleStorylets } from "@/lib/narrative/storylets";
import { dryRunBeat } from "@/lib/simulation/registry";
import type { BeatCandidate } from "@/lib/simulation/types";
import type {
  CreativeDiff,
  StoryEvent,
  StoryTurnDraft,
  TemplateId,
  WorldSeedDraft,
  WorldSession,
  WorldSetupInput,
} from "@/lib/types";
import { currentScene, mustCompleteActiveMilestone } from "./state";

export function resolveNearestTemplate(input: WorldSetupInput): TemplateId {
  if (input.template_id !== "create_your_own") return input.template_id;
  const text = [
    input.genre,
    input.story_brief,
    input.main_conflict,
    input.customization_prompt,
  ].join(" ").toLowerCase();
  if (/family|house|monsoon|ghost|inherit|home|radio|supernatural/.test(text)) {
    return "monsoon_house";
  }
  if (/fantasy|king|queen|seal|gate|magic|ocean|island|crown/.test(text)) {
    return "blackmoor";
  }
  return "neon_afterlight";
}

export function buildLayeredFallbackSeed(
  input: WorldSetupInput,
  templateId: TemplateId,
  partial?: Partial<WorldSeedDraft> | null,
): WorldSeedDraft {
  const seed = structuredClone(STARTER_WORLDS[templateId]);
  seed.base_template_id = templateId;
  seed.base_template_reason =
    input.template_id === "create_your_own"
      ? "The custom setup uses the nearest tested starter mechanics while retaining the supplied creative direction."
      : "The selected starter supplies tested command and fallback mechanics.";
  seed.universe.genre = input.genre || seed.universe.genre;
  seed.universe.mood = input.mood.length ? input.mood.slice(0, 3) : seed.universe.mood;
  seed.universe.premise = input.story_brief || seed.universe.premise;
  seed.universe.rules = input.world_rules.length
    ? input.world_rules.slice(0, 3)
    : seed.universe.rules;
  seed.story.listener_role = input.listener_role || seed.story.listener_role;
  seed.story.main_goal = input.main_conflict || seed.story.main_goal;

  for (const override of input.character_overrides) {
    const character = seed.characters.find(
      (item) => item.prototype === override.prototype,
    );
    if (!character) continue;
    if (override.name.trim()) character.name = override.name.trim();
    if (override.instruction.trim()) {
      character.relationship_to_listener = override.instruction.trim();
    }
  }
  applyCustomization(seed, input.customization_prompt);
  mergeSafePartial(seed, partial);
  return seed;
}

export function creativeDiffs(
  templateId: TemplateId,
  seed: WorldSeedDraft,
): CreativeDiff[] {
  const base = STARTER_WORLDS[templateId];
  const diffs: CreativeDiff[] = [];
  addDiff(diffs, "Title", base.universe.title, seed.universe.title);
  addDiff(diffs, "Setting", base.universe.premise, seed.universe.premise);
  addDiff(diffs, "Genre", base.universe.genre, seed.universe.genre);
  addDiff(diffs, "Listener role", base.story.listener_role, seed.story.listener_role);
  addDiff(diffs, "Main goal", base.story.main_goal, seed.story.main_goal);
  for (const prototype of ["ally", "rival", "mystery_keeper"] as const) {
    const before = base.characters.find((item) => item.prototype === prototype)!;
    const after = seed.characters.find((item) => item.prototype === prototype)!;
    addDiff(diffs, `${prototype} name`, before.name, after.name);
    addDiff(
      diffs,
      `${prototype} relationship`,
      before.relationship_to_listener,
      after.relationship_to_listener,
    );
  }
  return diffs.slice(0, 8);
}

export function fallbackStoryTurn(
  session: WorldSession,
  event: StoryEvent,
): StoryTurnDraft {
  const scene = currentScene(session);
  const milestone =
    session.arc_state.milestones[session.arc_state.active_milestone_index];
  const present = scene.present_character_ids.slice(0, 3);
  while (present.length < 2) {
    const replacement = session.characters.find(
      (character) => !present.includes(character.character_id),
    );
    if (!replacement) break;
    present.push(replacement.character_id);
  }
  const first = session.characters.find(
    (character) => character.character_id === present[0],
  )!;
  const second = session.characters.find(
    (character) => character.character_id === present[1],
  )!;
  const selected =
    eligibleStorylets(session, event, 1)[0] ??
    (() => {
      throw new Error(`No storylet is available for ${session.template_id}.`);
    })();
  const target = event.command_arguments.target_id
    ? session.characters.find(
        (character) => character.character_id === event.command_arguments.target_id,
      )
    : null;
  const chosenActionResult =
    event.command_type === "help_character"
      ? `${target?.name ?? first.name} reaches solid ground, shaken but able to move.`
      : event.command_type === "pursue_goal"
        ? // The objective label is a full sentence, so it cannot be spliced in as
          // a noun phrase without producing "You take control of Preserve the
          // cassette and keep it within sight and keep it within sight."
          `You do the one thing you came here to do: ${lowerFirst(clip(session.state.active_objective.label, 16))}`
        : `${target?.name ?? second.name} stops and gives the group one brief chance to test the accusation.`;
  const costPaid =
    event.command_type === "help_character"
      ? `The rescue uses the only clear opening while ${lowerFirst(selected.pressure)}`
      : event.command_type === "pursue_goal"
        ? `${first.name} sees you choose the object first and refuses to move closer to the danger.`
        : `The confrontation uses the remaining pause while ${lowerFirst(selected.pressure)}`;
  const axisConsequence = `${chosenActionResult} ${costPaid}`;
  const discovery = selected.situation;
  const hypothesis =
    "Someone deliberately caused the physical change, but the actor and purpose remain unproven.";
  const complete = mustCompleteActiveMilestone(session);
  // Generated storylet decks use paragraph-length fields, so interpolating them
  // raw pushed this narration past the 280-word validation ceiling and hard-
  // failed the turn. Clip each borrowed field to its own budget.
  const narration = [
    chosenActionResult,
    costPaid,
    clip(discovery, 45),
    `For a moment nobody speaks, and the room goes on making its own noise.`,
    `${first.name} crouches over it without touching it yet. ${lowerFirst(clip(selected.concrete_affordance, 30))}`,
    `${second.name} stays where the doorway is, close enough to see, far enough to leave. ${clip(selected.character_conflict, 30)}`,
    clip(selected.pressure, 26),
    `You keep your eyes on it. The back of your neck stays cold.`,
    `${first.name} reaches for something dry to wrap it in. ${second.name} does not move out of the way.`,
  ].join(" ");
  // The fallback used to emit four byte-identical lines every time it fired, so
  // three fallbacks in one arc read as the same scene three times. Rotate the
  // exchange and anchor it to this storylet's own noun.
  const lines = fallbackExchange(
    session.state.turn_index,
    first.name,
    second.name,
    selected,
  );
  return {
    because_of_choice: event.summary,
    immediate_consequence: axisConsequence,
    time_passed: "1 minute",
    transition_reason:
      `The group remains at ${scene.location} because the selected action exposes a physical opportunity there.`,
    storylet_id: selected.storylet_id,
    causal_chain: {
      chosen_action_result: chosenActionResult,
      cost_paid: costPaid,
      observable_clue: selected.situation,
      new_hypothesis: hypothesis,
      next_pressure: selected.pressure,
    },
    character_moves: [
      {
        character_id: first.character_id,
        want_now: `Use ${selected.concrete_affordance.toLowerCase()}`,
        belief_before:
          session.character_minds[first.character_id]?.current_belief ??
          `The main danger is still at ${scene.location}.`,
        belief_after: `The physical trace matters more than the first accusation.`,
        emotion_after: "urgent and distrustful",
        tactic: "Test the physical clue before arguing about it.",
        relationship_move: `Wants the listener to prove they will act on evidence.`,
        spoken_intent: "Push the listener to act before the evidence disappears.",
      },
      {
        character_id: second.character_id,
        want_now: "Control how the clue is interpreted.",
        belief_before:
          session.character_minds[second.character_id]?.current_belief ??
          "The others are acting before they understand the danger.",
        belief_after: `The clue is real, but ${first.name}'s explanation is not proven.`,
        emotion_after: "defensive and calculating",
        tactic: "Challenge the first interpretation and demand a controlled test.",
        relationship_move: "Offers cooperation only if the listener hears the objection.",
        spoken_intent: "Slow the group long enough to challenge the obvious conclusion.",
      },
    ],
    milestone_action: complete ? "complete" : "continue",
    milestone_completion_evidence: complete
      ? `The group has a unique canonical clue and a causal lead that satisfies: ${milestone.completion_evidence_description}`
      : null,
    scene_title: titleFromStorylet(selected.storylet_id),
    location: scene.location,
    scene_goal: selected.concrete_affordance,
    obstacle: selected.pressure,
    new_information: discovery,
    thread_opened: null,
    thread_resolved: null,
    present_character_ids: present,
    narration,
    dialogue: [
      {
        character_id: first.character_id,
        text: lines[0],
        responds_to_previous: false,
      },
      {
        character_id: second.character_id,
        text: lines[1],
        responds_to_previous: true,
      },
      {
        character_id: first.character_id,
        text: lines[2],
        responds_to_previous: true,
      },
      {
        character_id: second.character_id,
        text: lines[3],
        responds_to_previous: true,
      },
    ],
    story_blocks: [
      {
        block_type: "narration",
        character_id: null,
        text: `${chosenActionResult} ${costPaid} ${clip(discovery, 45)} For a moment nobody speaks, and the room goes on making its own noise.`,
        responds_to_previous: false,
      },
      {
        block_type: "dialogue",
        character_id: first.character_id,
        text: lines[0],
        responds_to_previous: false,
      },
      {
        block_type: "narration",
        character_id: null,
        text: `${first.name} crouches over it without touching it yet. ${lowerFirst(clip(selected.concrete_affordance, 30))} ${second.name} watches from the doorway and says nothing for a moment.`,
        responds_to_previous: true,
      },
      {
        block_type: "dialogue",
        character_id: second.character_id,
        text: lines[1],
        responds_to_previous: true,
      },
      {
        block_type: "narration",
        character_id: null,
        text: `${clip(selected.character_conflict, 30)} Neither of them looks away from it.`,
        responds_to_previous: true,
      },
      {
        block_type: "dialogue",
        character_id: first.character_id,
        text: lines[2],
        responds_to_previous: true,
      },
      {
        block_type: "narration",
        character_id: null,
        text: `${selected.character_conflict} ${selected.pressure}`,
        responds_to_previous: true,
      },
      {
        block_type: "dialogue",
        character_id: second.character_id,
        text: lines[3],
        responds_to_previous: true,
      },
      {
        block_type: "narration",
        character_id: null,
        text: `You keep your eyes on it. The back of your neck stays cold. ${first.name} reaches for something dry to wrap it in. ${second.name} does not move out of the way.`,
        responds_to_previous: true,
      },
    ],
    choice_proposals: [
      {
        axis: "protect",
        command_type: "help_character",
        arguments: { target_id: first.character_id },
        label: `Move ${first.name} clear of the danger.`,
        narrative_intent: `Protect ${first.name} before the physical pressure worsens.`,
        anticipated_tradeoff: selected.pressure,
      },
      {
        axis: "pursue",
        command_type: "pursue_goal",
        arguments: { target_id: null },
        label: `Perform the controlled test.`,
        narrative_intent: `Use the available physical test before ${second.name} blocks it.`,
        anticipated_tradeoff: `${first.name} may have to face the current danger without help.`,
      },
      {
        axis: "confront",
        command_type: "confront_character",
        arguments: { target_id: second.character_id },
        label: `Challenge ${second.name}'s objection.`,
        narrative_intent: `Force ${second.name} to state what result would change their mind.`,
        anticipated_tradeoff: `Pressure on ${second.name} will increase tension and may close cooperation.`,
      },
    ],
  };
}

export function commitFallbackSimulation(
  session: WorldSession,
  event: StoryEvent,
  draft: StoryTurnDraft,
): void {
  const scene = currentScene(session);
  const location = Object.values(session.simulation.entities).find(
    (entity) =>
      entity.kind === "location" &&
      entity.name.trim().toLowerCase() === scene.location.trim().toLowerCase(),
  );
  if (!location) {
    throw new Error("Fallback simulator could not resolve the current location.");
  }
  const present = draft.present_character_ids.filter(
    (characterId) =>
      session.simulation.entities[characterId]?.location_id === location.entity_id,
  );
  if (present.length < 2) {
    throw new Error("Fallback simulator requires two physically present characters.");
  }
  const openThread = Object.values(session.simulation.threads).find(
    (thread) => thread.status === "open",
  );
  const factRef = "fallback_scene_fact";
  const commands: BeatCandidate["commands"] = [
    {
      command_type: "advance_time",
      actor_ref: null,
      target_ref: null,
      new_ref: null,
      entity_kind: null,
      name: null,
      description: null,
      string_value: null,
      number_value: 1,
      boolean_value: null,
      fact_statement: null,
      evidence: [],
      known_by_refs: [],
      reason: "The group performs one controlled observation.",
    },
    {
      command_type: "establish_fact",
      actor_ref: null,
      target_ref: null,
      new_ref: factRef,
      entity_kind: null,
      name: null,
      description: null,
      string_value: "true",
      number_value: null,
      boolean_value: null,
      fact_statement: draft.new_information ?? draft.causal_chain.observable_clue,
      evidence: [draft.causal_chain.observable_clue],
      known_by_refs: present,
      reason: "Both present characters witness the same physical result.",
    },
  ];
  if (openThread) {
    commands.push({
      command_type: "update_thread",
      actor_ref: factRef,
      target_ref: openThread.thread_id,
      new_ref: null,
      entity_kind: null,
      name: null,
      description: null,
      string_value: "add_evidence",
      number_value: null,
      boolean_value: null,
      fact_statement: null,
      evidence: [],
      known_by_refs: [],
      reason: "The observed fact contributes one independent piece of evidence.",
    });
  }
  const candidate: BeatCandidate = {
    candidate_id: `fallback_${event.event_id}`,
    storylet_id: draft.storylet_id,
    because_of_choice: draft.because_of_choice,
    dramatic_question: session.story.central_question,
    chosen_action_result: draft.causal_chain.chosen_action_result,
    cost_paid: draft.causal_chain.cost_paid,
    scene_premise: draft.immediate_consequence,
    continuity_bridge: draft.because_of_choice,
    action_sequence: [
      {
        actor_ref: present[0],
        physical_action: "Performs the controlled physical test.",
        observable_result: draft.causal_chain.observable_clue,
      },
      {
        actor_ref: present[1],
        physical_action: "Observes the same test from the current location.",
        observable_result: "Confirms the physical result but disputes its meaning.",
      },
      {
        actor_ref: present[0],
        physical_action: "Preserves a record of the observed result.",
        observable_result: "The evidence remains available for the next decision.",
      },
      {
        actor_ref: present[1],
        physical_action: "Moves to control access to the next test.",
        observable_result: draft.causal_chain.next_pressure,
      },
    ],
    evidence_delivery: draft.causal_chain.observable_clue,
    closing_pressure: draft.causal_chain.next_pressure,
    start_location_ref: location.entity_id,
    end_location_ref: location.entity_id,
    character_pressure: present.slice(0, 3).map((characterId, index) => ({
      character_id: characterId,
      want_in_scene: draft.character_moves[index]?.want_now ?? "Control the test.",
      conflict_with:
        draft.character_moves[index]?.relationship_move ??
        "Disagrees about what the evidence permits.",
    })),
    commands,
    information_used_fact_ids: [],
    milestone_action: draft.milestone_action,
    milestone_completion_evidence: draft.milestone_completion_evidence,
  };
  const committed = dryRunBeat(session.simulation, event, candidate);
  if (!committed.valid) {
    throw new Error(
      `Fallback simulator rejected its beat: ${committed.errors.join(" | ")}`,
    );
  }
  session.simulation = committed.next_state;
  session.simulation_events.push(committed.commit);
}

// Four-line exchanges keyed by turn so repeated fallbacks in one arc do not
// reprint the same conversation. Each variant still has the ally proposing a
// concrete test and the rival contesting what it proves.
function fallbackExchange(
  turnIndex: number,
  firstName: string,
  secondName: string,
  storylet: { discovery_form: string; pressure: string },
): [string, string, string, string] {
  const anchor = lowerFirst(storylet.discovery_form).replace(/\.$/, "");
  const variants: Array<[string, string, string, string]> = [
    [
      `Give me room. I can read this without ruining it.`,
      `Read it once, ${firstName}. Don't turn one mark into a verdict.`,
      `Then watch my hands. I'll write down only what I can see.`,
      `Fine. And when you're done, we deal with what this is costing us.`,
    ],
    [
      `Don't touch it yet — look where it sits before anyone moves it.`,
      `I am looking. I see ${anchor}. I don't see who put it there.`,
      `Neither do I. That's exactly why I want it recorded before the water does.`,
      `Record it, then. But I'm not letting you build a story out of it tonight.`,
    ],
    [
      `Hold the light steady. This is the last chance it stays legible.`,
      `You keep saying last chance. Every hour in this house is a last chance.`,
      `Then help me spend this one properly. One test, and we know something.`,
      `We'll know one thing. You'll act like we know everything. That's the difference.`,
    ],
    [
      `Stand where you are, ${secondName}. I don't want your footprints in this.`,
      `My footprints are already in everything here. That's what you refuse to hear.`,
      `Then say it plainly instead of guarding it, and I'll stop guessing.`,
      `Not while the rain is still deciding how much of this house we keep.`,
    ],
  ];
  return variants[Math.abs(turnIndex) % variants.length];
}

// Trims borrowed storylet prose to a word budget, preferring a sentence break so
// the result still reads as a finished thought.
function clip(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/);
  if (words.length <= maxWords) return value.trim();
  const truncated = words.slice(0, maxWords).join(" ");
  const lastStop = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("?"),
  );
  if (lastStop > truncated.length * 0.5) return truncated.slice(0, lastStop + 1);
  return `${truncated.replace(/[,;:]$/, "")}.`;
}

function titleFromStorylet(storyletId: string): string {
  return storyletId
    .split("_")
    .slice(1)
    .map(capitalize)
    .join(" ");
}

function applyCustomization(seed: WorldSeedDraft, customization: string): void {
  const normalized = customization.toLowerCase();
  if (/mumbai/.test(normalized)) {
    seed.universe.title = `${seed.universe.title}: Mumbai 2095`;
    seed.universe.premise = `In Mumbai in 2095, ${lowerFirst(seed.universe.premise)}`;
    seed.opening_scene.location = `Mumbai 2095 · ${seed.opening_scene.location}`;
  }
  if (/older sister|elder sister/.test(normalized)) {
    const rival = seed.characters.find((item) => item.prototype === "rival");
    if (rival) rival.relationship_to_listener = "Your estranged older sister";
  }
  if (/romance|romantic/.test(normalized)) {
    seed.universe.mood = [...new Set([...seed.universe.mood, "romantic"])].slice(0, 3);
  }
}

function mergeSafePartial(
  target: WorldSeedDraft,
  partial?: Partial<WorldSeedDraft> | null,
): void {
  if (!partial) return;
  if (partial.universe?.title?.trim()) target.universe.title = partial.universe.title;
  if (partial.universe?.genre?.trim()) target.universe.genre = partial.universe.genre;
  if (partial.universe?.premise?.trim()) {
    target.universe.premise = partial.universe.premise;
  }
  if (partial.story?.listener_role?.trim()) {
    target.story.listener_role = partial.story.listener_role;
  }
  if (partial.story?.main_goal?.trim()) {
    target.story.main_goal = partial.story.main_goal;
  }
}

function addDiff(
  list: CreativeDiff[],
  field: string,
  before: string,
  after: string,
): void {
  if (before.trim() !== after.trim()) list.push({ field, before, after });
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}
