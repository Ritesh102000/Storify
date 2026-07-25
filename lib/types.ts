export const TEMPLATE_IDS = [
  "blackmoor",
  "neon_afterlight",
  "monsoon_house",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];
export type StartingMode = TemplateId | "create_your_own";
export type Prototype = "ally" | "rival" | "mystery_keeper";
export type ChoiceAxis = "protect" | "pursue" | "confront";
export type CommandType =
  | "help_character"
  | "pursue_goal"
  | "confront_character";
export type CharacterStatus =
  | "active"
  | "absent"
  | "in_danger"
  | "safe"
  | "unavailable";
export type GoalStatus = "active" | "completed";
export type ObjectiveStatus = "available" | "secured" | "lost";
export type ChoiceStatus = "available" | "consumed" | "disabled";
export type GenerationStatus =
  | "generated"
  | "repaired"
  | "layered_fallback"
  | "template_fallback"
  | "fixture";
export const PLOT_BEAT_TYPES = [
  "setup",
  "pursuit",
  "reveal",
  "reversal",
  "crisis",
  "climax",
] as const;
export type PlotBeatType = (typeof PLOT_BEAT_TYPES)[number];

export type CharacterDraft = {
  prototype: Prototype;
  name: string;
  role_in_world: string;
  relationship_to_listener: string;
  traits: string[];
  goal: string;
  fear: string;
  secret: string;
  speech_style: string;
  voice_hint: string;
};

export type ChoiceProposal = {
  axis: ChoiceAxis;
  command_type: CommandType;
  target_prototype: Prototype | null;
  label: string;
};

export type WorldSeedDraft = {
  base_template_id: TemplateId;
  base_template_reason: string;
  universe: {
    title: string;
    genre: string;
    mood: string[];
    premise: string;
    rules: string[];
  };
  story: {
    listener_role: string;
    main_goal: string;
    central_question: string;
    tone_guardrails: string[];
    opening_hook: string;
  };
  plot_outline: {
    theme: string;
    ending_direction: string;
    beats: PlotBeat[];
  };
  characters: CharacterDraft[];
  opening_scene: {
    location: string;
    situation: string;
    present_character_prototypes: Prototype[];
    objective_label: string;
    danger_label: string;
    threat_prototype: "rival";
  };
  opening_narration: string;
  first_choice_proposals: ChoiceProposal[];
};

export type PlotBeat = {
  beat_type: PlotBeatType;
  title: string;
  location: string;
  objective: string;
  obstacle: string;
  development: string;
  reveal: string;
  story_question: string;
  present_character_prototypes: Prototype[];
};

export type PlotState = {
  current_beat_index: number;
  completed_beat_types: PlotBeatType[];
  open_threads: string[];
  discovered_clues: string[];
  last_new_information: string | null;
  recent_locations: string[];
  last_transition: {
    from_beat: PlotBeatType;
    to_beat: PlotBeatType;
  } | null;
};

export type WorldSetupInput = {
  template_id: StartingMode;
  story_brief: string;
  genre: string;
  mood: string[];
  listener_role: string;
  main_conflict: string;
  world_rules: string[];
  character_overrides: Array<{
    prototype: Prototype;
    name: string;
    instruction: string;
  }>;
  customization_prompt: string;
  language: string;
  content_tone: "family_safe" | "mature";
};

export type CreativeDiff = {
  field: string;
  before: string;
  after: string;
};

export type WorldPreview = {
  preview_id: string;
  requested_template_id: StartingMode;
  resolved_template_id: TemplateId;
  seed: WorldSeedDraft;
  creative_diffs: CreativeDiff[];
  generation: {
    status: GenerationStatus;
    provider: "openai" | "fixture";
    model: string;
    latency_ms: number;
    used_fallback: boolean;
    fallback_reason?: string;
  };
  created_at: string;
};

export type Character = CharacterDraft & {
  character_id: string;
  secret_fact_id: string;
};

export type Relationship = {
  trust: number;
  tension: number;
};

export type GameState = {
  schema_version: 1;
  turn_index: number;
  story_progress: number;
  goal_status: GoalStatus;
  objective_status: ObjectiveStatus;
  active_threat_id: string;
  character_statuses: Record<string, CharacterStatus>;
  relationships: Record<string, Relationship>;
  unlocked_fact_ids: string[];
};

export type StateDiff = {
  path: string;
  from: string | number | string[];
  to: string | number | string[];
};

export type Choice = {
  choice_id: string;
  scene_id: string;
  axis: ChoiceAxis;
  command_type: CommandType;
  arguments: {
    target_id?: string;
  };
  label: string;
  status: ChoiceStatus;
  disabled_reason?: string;
};

export type Scene = {
  scene_id: string;
  scene_index: number;
  title: string;
  location: string;
  situation: string;
  scene_goal: string;
  new_information: string | null;
  thread_opened: string | null;
  thread_resolved: string | null;
  present_character_ids: string[];
  narration: string;
  dialogue: Array<{
    character_id: string;
    text: string;
  }>;
  choice_ids: string[];
  created_from_event_id: string | null;
};

export type StoryEvent = {
  event_id: string;
  scene_id: string;
  choice_id: string;
  command_type: CommandType;
  command_arguments: {
    target_id?: string;
  };
  summary: string;
  witness_character_ids: string[];
  effects: StateDiff[];
  created_at: string;
};

export type CharacterMemory = {
  memory_id: string;
  character_id: string;
  source_event_id: string;
  kind: "witnessed";
  text: string;
  importance: number;
  relationship_delta: number;
  goal_relevance: number;
  created_at: string;
};

export type StoryFact = {
  fact_id: string;
  character_id: string;
  text: string;
};

export type ContextTrace = {
  trace_id: string;
  universe_id: string;
  branch_id: string;
  scene_id: string;
  event_id: string;
  recent_event_ids: string[];
  character_ids: string[];
  memory_ids: string[];
  unlocked_fact_ids: string[];
  state_fields: string[];
  plot_beat: PlotBeatType;
  open_thread_count: number;
  proposal_count: number;
  valid_choice_count: number;
  prompt_version: 2;
  schema_version: 1;
};

export type SpinOff = {
  spin_off_id: string;
  storyline_id: string;
  branch_id: string;
  title: string;
  protagonist_character_id: string;
  source_branch_id: string;
  source_event_id: string;
  visibility: "private";
  depth: 1;
  opening_narration: string;
  inherited_memory_ids: string[];
  created_at: string;
};

export type PublicCharacterView = Omit<Character, "secret" | "secret_fact_id"> & {
  status: CharacterStatus;
  relationship: Relationship;
  memories: CharacterMemory[];
  unlocked_facts: StoryFact[];
};

export type WorldView = {
  universe_id: string;
  branch_id: string;
  template_id: TemplateId;
  universe: WorldSession["universe"];
  story: WorldSession["story"];
  semantic_labels: WorldSession["semantic_labels"];
  plot_progress: {
    current_beat_index: number;
    total_beats: number;
    current_beat: Pick<
      PlotBeat,
      "beat_type" | "title" | "location" | "objective" | "story_question"
    >;
    completed_beat_types: PlotBeatType[];
    open_threads: string[];
    discovered_clues: string[];
    last_new_information: string | null;
  };
  state: GameState;
  scene: Scene;
  choices: Choice[];
  characters: PublicCharacterView[];
  last_event: StoryEvent | null;
  last_state_diff: StateDiff[];
  context_trace: ContextTrace | null;
  spin_offs: SpinOff[];
  generation: WorldPreview["generation"];
};

export type WorldSession = {
  universe_id: string;
  storyline_id: string;
  branch_id: string;
  template_id: TemplateId;
  universe: WorldSeedDraft["universe"];
  story: WorldSeedDraft["story"];
  plot_outline: WorldSeedDraft["plot_outline"];
  plot_state: PlotState;
  semantic_labels: {
    objective_label: string;
    danger_label: string;
    threat_label: string;
    progress_label: string;
  };
  characters: Character[];
  state: GameState;
  scenes: Scene[];
  current_scene_id: string;
  choices: Choice[];
  events: StoryEvent[];
  memories: CharacterMemory[];
  facts: StoryFact[];
  spin_offs: SpinOff[];
  last_context_trace: ContextTrace | null;
  generation: WorldPreview["generation"];
  created_at: string;
  updated_at: string;
};

export type StoryTurnDraft = {
  scene_title: string;
  location: string;
  situation: string;
  scene_goal: string;
  new_information: string;
  thread_opened: string | null;
  thread_resolved: string | null;
  narration: string;
  dialogue: Array<{
    character_id: string;
    text: string;
  }>;
  choice_proposals: Array<{
    axis: ChoiceAxis;
    command_type: CommandType;
    arguments: {
      target_id: string | null;
    };
    label: string;
  }>;
};

export type FastTurnPacket = {
  schema_version: 1;
  world: WorldSession["universe"] & {
    universe_id: string;
  };
  story: WorldSession["story"];
  plot_context: {
    active_beat: PlotBeat;
    previous_beat: PlotBeat;
    completed_beat_types: PlotBeatType[];
    open_threads: string[];
    discovered_clues: string[];
    last_new_information: string | null;
    required_character_ids: string[];
    novelty_rules: string[];
  };
  committed_event: Pick<
    StoryEvent,
    "event_id" | "command_type" | "summary"
  >;
  recent_events: Array<
    Pick<StoryEvent, "event_id" | "command_type" | "summary">
  >;
  current_state: GameState;
  active_scene: Pick<
    Scene,
    | "scene_id"
    | "title"
    | "location"
    | "situation"
    | "scene_goal"
    | "new_information"
    | "present_character_ids"
  >;
  character_views: Array<{
    character_id: string;
    public_identity: Omit<CharacterDraft, "secret">;
    relationship_to_listener: Relationship;
    accessible_memories: CharacterMemory[];
    unlocked_facts: StoryFact[];
  }>;
  supported_commands: CommandType[];
  output_requirements: {
    narration_max_words: number;
    dialogue_item_limit: number;
    choice_proposal_limit: number;
  };
};
