import { STARTER_WORLDS } from "../fixtures";
import type {
  CreativeDiff,
  StoryEvent,
  StoryTurnDraft,
  TemplateId,
  WorldSeedDraft,
  WorldSession,
  WorldSetupInput,
} from "../types";

export function resolveNearestTemplate(input: WorldSetupInput): TemplateId {
  if (input.template_id !== "create_your_own") {
    return input.template_id;
  }

  const text = [
    input.genre,
    input.story_brief,
    input.main_conflict,
    input.customization_prompt,
  ]
    .join(" ")
    .toLowerCase();

  if (
    /family|house|monsoon|ghost|inherit|home|radio|supernatural|relationship/.test(
      text,
    )
  ) {
    return "monsoon_house";
  }
  if (
    /fantasy|king|queen|seal|gate|magic|ocean|island|crown|medieval/.test(text)
  ) {
    return "blackmoor";
  }
  return "neon_afterlight";
}

export function buildLayeredFallbackSeed(
  input: WorldSetupInput,
  resolvedTemplateId: TemplateId,
  partial?: Partial<WorldSeedDraft> | null,
): WorldSeedDraft {
  const template = structuredClone(STARTER_WORLDS[resolvedTemplateId]);

  template.base_template_id = resolvedTemplateId;
  template.base_template_reason =
    input.template_id === "create_your_own"
      ? "The setup was mapped to the nearest tested starter so its mechanics and fallback remain reliable."
      : "The selected starter provides the tested mechanical skeleton.";

  template.universe.genre = input.genre || template.universe.genre;
  template.universe.mood =
    input.mood.length > 0 ? input.mood.slice(0, 3) : template.universe.mood;
  template.universe.premise =
    input.story_brief || template.universe.premise;
  template.universe.rules =
    input.world_rules.length > 0
      ? input.world_rules.slice(0, 3)
      : template.universe.rules;
  template.story.listener_role =
    input.listener_role || template.story.listener_role;
  template.story.main_goal =
    input.main_conflict || template.story.main_goal;

  for (const override of input.character_overrides) {
    const character = template.characters.find(
      (candidate) => candidate.prototype === override.prototype,
    );
    if (!character) continue;
    if (override.name.trim()) character.name = override.name.trim();
    if (override.instruction.trim()) {
      character.relationship_to_listener = override.instruction.trim();
    }
  }

  const customization = input.customization_prompt.trim();
  if (customization) {
    applyKnownCustomization(template, customization);
  }

  mergeValidatedPartial(template, partial);
  return template;
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
    const before = base.characters.find(
      (character) => character.prototype === prototype,
    );
    const after = seed.characters.find(
      (character) => character.prototype === prototype,
    );
    if (!before || !after) continue;
    addDiff(
      diffs,
      `${labelPrototype(prototype)} name`,
      before.name,
      after.name,
    );
    addDiff(
      diffs,
      `${labelPrototype(prototype)} relationship`,
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
  const ally = session.characters.find(
    (character) => character.prototype === "ally",
  )!;
  const rival = session.characters.find(
    (character) => character.prototype === "rival",
  )!;
  const objective = session.semantic_labels.objective_label;
  const relationship = session.state.relationships[ally.character_id];
  const beat =
    session.plot_outline.beats[session.plot_state.current_beat_index];
  const plotFields = {
    scene_title: beat.title,
    location: beat.location,
    situation: `${beat.development} ${beat.obstacle}`,
    scene_goal: beat.objective,
    new_information: beat.reveal,
    thread_opened: beat.story_question,
    thread_resolved: session.plot_state.open_threads[0] ?? null,
  };

  if (event.command_type === "help_character") {
    return {
      ...plotFields,
      narration: `Your decision to protect ${ally.name} follows you into ${beat.location}, where ${beat.development.toLowerCase()} The immediate cost remains: ${objective} is no longer where you left it. ${beat.obstacle} Then the story yields something genuinely new: ${beat.reveal} The old question cannot hold the investigation anymore. Now you must ask: ${beat.story_question}`,
      dialogue: [
        {
          character_id: ally.character_id,
          text:
            relationship.trust >= 70
              ? "You chose me. Whatever comes next, you do not face it alone."
              : "I did not expect you to come back for me.",
        },
        {
          character_id: rival.character_id,
          text: `Compassion is expensive. You just paid with ${objective}.`,
        },
      ],
      choice_proposals: [
        {
          axis: "protect",
          command_type: "help_character",
          arguments: { target_id: ally.character_id },
          label: `Stay with ${ally.name} and strengthen the alliance.`,
        },
        {
          axis: "pursue",
          command_type: "pursue_goal",
          arguments: { target_id: null },
          label: `Trace ${objective} before the trail disappears.`,
        },
        {
          axis: "confront",
          command_type: "confront_character",
          arguments: { target_id: rival.character_id },
          label: `Confront ${rival.name} about where ${objective} went.`,
        },
      ],
    };
  }

  if (event.command_type === "pursue_goal") {
    return {
      ...plotFields,
      narration: `The pursuit carries you out of the previous crisis and into ${beat.location}. ${beat.development} Securing ${objective} gives you leverage, but ${beat.obstacle.toLowerCase()} The breakthrough changes the shape of the mystery: ${beat.reveal} What happened before still matters, yet the plot now turns on a new question: ${beat.story_question}`,
      dialogue: [
        {
          character_id: rival.character_id,
          text: `You secured the proof. Tell me whether it was worth who you left behind.`,
        },
      ],
      choice_proposals: [
        {
          axis: "protect",
          command_type: "help_character",
          arguments: { target_id: ally.character_id },
          label: `Turn back and search for ${ally.name}.`,
        },
        {
          axis: "pursue",
          command_type: "pursue_goal",
          arguments: { target_id: null },
          label: `Use ${objective} to advance the investigation.`,
        },
        {
          axis: "confront",
          command_type: "confront_character",
          arguments: { target_id: rival.character_id },
          label: `Force ${rival.name} to explain what the evidence means.`,
        },
      ],
    };
  }

  const revealedFact = session.facts.find(
    (fact) => fact.character_id === rival.character_id,
  );
  return {
    ...plotFields,
    narration: `Your confrontation changes the route through ${session.universe.title} and drives everyone toward ${beat.location}. ${rival.name}'s composure fractures around one truth: ${revealedFact?.text ?? "the rival knows more than they admitted"}. But the argument cannot remain the whole story. ${beat.development} ${beat.obstacle} The next discovery breaks the loop: ${beat.reveal} Now the central question becomes: ${beat.story_question}`,
    dialogue: [
      {
        character_id: rival.character_id,
        text: "You wanted the truth. Do not pretend you will like what it asks of you.",
      },
    ],
    choice_proposals: [
      {
        axis: "protect",
        command_type: "help_character",
        arguments: { target_id: ally.character_id },
        label: `Move ${ally.name} out of ${rival.name}'s reach.`,
      },
      {
        axis: "pursue",
        command_type: "pursue_goal",
          arguments: { target_id: null },
        label: `Act on the revealed fact and pursue ${objective}.`,
      },
      {
        axis: "confront",
        command_type: "confront_character",
        arguments: { target_id: rival.character_id },
        label: `Press ${rival.name} on the part they still concealed.`,
      },
    ],
  };
}

function applyKnownCustomization(
  seed: WorldSeedDraft,
  customization: string,
): void {
  const normalized = customization.toLowerCase();
  if (/mumbai/.test(normalized)) {
    seed.universe.title = `${seed.universe.title}: Mumbai 2095`;
    seed.universe.premise = `In Mumbai in 2095, ${lowercaseFirst(seed.universe.premise)}`;
    seed.opening_scene.location = `Mumbai 2095 · ${seed.opening_scene.location}`;
    seed.plot_outline.beats = seed.plot_outline.beats.map((beat) => ({
      ...beat,
      location: `Mumbai 2095 · ${beat.location}`,
    }));
  }
  if (/older sister|elder sister/.test(normalized)) {
    const rival = seed.characters.find(
      (character) => character.prototype === "rival",
    );
    if (rival) {
      rival.relationship_to_listener =
        "Your older sister, estranged by the central conflict";
      if (rival.name === "Kade") rival.name = "Asha";
    }
  }
  if (/romance|romantic/.test(normalized)) {
    seed.universe.mood = [...new Set([...seed.universe.mood, "romantic"])].slice(
      0,
      3,
    );
  }
}

function mergeValidatedPartial(
  target: WorldSeedDraft,
  partial?: Partial<WorldSeedDraft> | null,
): void {
  if (!partial) return;
  if (partial.universe) {
    if (isString(partial.universe.title)) {
      target.universe.title = partial.universe.title;
    }
    if (isString(partial.universe.genre)) {
      target.universe.genre = partial.universe.genre;
    }
    if (isString(partial.universe.premise)) {
      target.universe.premise = partial.universe.premise;
    }
  }
  if (partial.story) {
    if (isString(partial.story.listener_role)) {
      target.story.listener_role = partial.story.listener_role;
    }
    if (isString(partial.story.main_goal)) {
      target.story.main_goal = partial.story.main_goal;
    }
  }
  if (Array.isArray(partial.characters)) {
    for (const partialCharacter of partial.characters) {
      if (!partialCharacter || typeof partialCharacter !== "object") continue;
      const targetCharacter = target.characters.find(
        (character) => character.prototype === partialCharacter.prototype,
      );
      if (!targetCharacter) continue;
      if (isString(partialCharacter.name)) {
        targetCharacter.name = partialCharacter.name;
      }
      if (isString(partialCharacter.relationship_to_listener)) {
        targetCharacter.relationship_to_listener =
          partialCharacter.relationship_to_listener;
      }
      if (isString(partialCharacter.role_in_world)) {
        targetCharacter.role_in_world = partialCharacter.role_in_world;
      }
    }
  }
}

function addDiff(
  diffs: CreativeDiff[],
  field: string,
  before: string,
  after: string,
): void {
  if (before.trim() !== after.trim()) {
    diffs.push({ field, before, after });
  }
}

function labelPrototype(prototype: string): string {
  if (prototype === "mystery_keeper") return "Mystery keeper";
  return prototype[0].toUpperCase() + prototype.slice(1);
}

function lowercaseFirst(value: string): string {
  return value.length === 0 ? value : value[0].toLowerCase() + value.slice(1);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
