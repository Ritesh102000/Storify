import { STARTER_WORLDS } from "@/lib/fixtures";
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
  const axisConsequence =
    event.command_type === "help_character"
      ? `${first.name} is safe, but the delay gives the opposing plan time to move.`
      : event.command_type === "pursue_goal"
        ? `The immediate objective is secured, but ${first.name} reads the decision as abandonment.`
        : `${second.name} answers under pressure, but the confrontation closes an easier route to cooperation.`;
  const discovery = `${capitalize(milestone.milestone_type)} evidence from turn ${session.state.turn_index} shows that the latest obstacle was prepared before the listener entered the previous scene.`;
  const complete = mustCompleteActiveMilestone(session);
  const narration = [
    axisConsequence,
    `For a moment, nobody leaves ${scene.location}. The physical danger has changed shape: the obvious emergency is over, while a quieter mechanism begins working against the group.`,
    `${first.name} notices a detail that could only have been placed by someone who understood the current objective. ${second.name} disputes the conclusion, then points out a second consequence of the listener's choice.`,
    `Together those observations create a usable lead rather than another repetition of the old question. ${discovery}`,
    `Nothing in the discovery answers the whole mystery. It narrows the field, connects the present conflict to a deliberate earlier act, and gives both characters a reason to disagree about urgency.`,
    `The next move is specific. They can protect the person now carrying the cost, pursue the material lead before it disappears, or confront the witness whose account no longer fits.`,
  ].join(" ");
  return {
    because_of_choice: event.summary,
    immediate_consequence: axisConsequence,
    time_passed: "Less than a minute has passed.",
    transition_reason:
      "The scene stays in place because the selected action changes the relationship and reveals a new physical detail.",
    milestone_action: complete ? "complete" : "continue",
    milestone_completion_evidence: complete
      ? `The group has a unique canonical clue and a causal lead that satisfies: ${milestone.completion_evidence_description}`
      : null,
    scene_title: `${capitalize(milestone.milestone_type)}: The Cost Becomes Evidence`,
    location: scene.location,
    scene_goal: `Use the new evidence to ${milestone.dramatic_purpose.toLowerCase()}`,
    obstacle: milestone.stakes_change,
    new_information: discovery,
    thread_opened: `Who prepared the obstacle before the listener arrived?`,
    thread_resolved: session.arc_state.open_threads[0] ?? null,
    present_character_ids: present,
    narration,
    dialogue: [
      {
        character_id: first.character_id,
        text: `You made your choice. I need to know whether you understand what it cost.`,
        responds_to_previous: false,
      },
      {
        character_id: second.character_id,
        text: `The cost is not the only problem. Look at the detail beside the objective.`,
        responds_to_previous: true,
      },
      {
        character_id: first.character_id,
        text: `That was placed before we arrived. Someone predicted this decision.`,
        responds_to_previous: true,
      },
      {
        character_id: second.character_id,
        text: `Or they prepared for every decision. Either way, we finally have something we can follow.`,
        responds_to_previous: true,
      },
    ],
    choice_proposals: [
      {
        axis: "protect",
        command_type: "help_character",
        arguments: { target_id: first.character_id },
        label: `Protect ${first.name} while they carry the consequence.`,
        narrative_intent: `Keep ${first.name} safe long enough to test the new evidence.`,
        anticipated_tradeoff: "The material trail may cool while the group regains safety.",
      },
      {
        axis: "pursue",
        command_type: "pursue_goal",
        arguments: { target_id: null },
        label: "Pursue the physical lead before it can be removed.",
        narrative_intent: "Turn the unique discovery into immediate forward motion.",
        anticipated_tradeoff: `${first.name} may have to face the current danger without help.`,
      },
      {
        axis: "confront",
        command_type: "confront_character",
        arguments: { target_id: second.character_id },
        label: `Confront ${second.name} about the contradiction in their account.`,
        narrative_intent: "Test disputed testimony against the stored evidence.",
        anticipated_tradeoff: `Pressure on ${second.name} will increase tension and may close cooperation.`,
      },
    ],
  };
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
