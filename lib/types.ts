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
export type ObjectiveStatus = "active" | "achieved" | "failed" | "abandoned";
export type ChoiceStatus = "available" | "consumed" | "disabled";
export type GenerationStatus =
  | "generated"
  | "repaired"
  | "layered_fallback"
  | "template_fallback"
  | "fixture";

export const MILESTONE_TYPES = [
  "opening",
  "investigation",
  "escalation",
  "revelation",
  "reversal",
  "crisis",
  "resolution",
] as const;
export type MilestoneType = (typeof MILESTONE_TYPES)[number];
export type StoryPhase =
  | "opening"
  | "choice_consequence"
  | "relationship_dialogue"
  | "escalation"
  | "reversal"
  | "crisis_resolution";

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
  narrative_intent: string;
  anticipated_tradeoff: string;
};

export type MilestoneContract = {
  milestone_type: MilestoneType;
  dramatic_purpose: string;
  stakes_change: string;
  completion_evidence_description: string;
  permitted_revelations: string[];
  forbidden_revelations: string[];
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
  arc_plan: {
    theme: string;
    ending_direction: string;
    milestones: MilestoneContract[];
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

export type CreativeDiff = { field: string; before: string; after: string };

export type RetrievalTrace = {
  enabled: boolean;
  query: string;
  card_ids: string[];
  source_ids: string[];
  source_titles: string[];
  scores: number[];
  selected_pattern_id: string | null;
  used_local_fallback: boolean;
  failure_reason?: string;
};

export type WorldPreview = {
  preview_id: string;
  requested_template_id: StartingMode;
  resolved_template_id: TemplateId;
  seed: WorldSeedDraft;
  creative_diffs: CreativeDiff[];
  retrieval: RetrievalTrace | null;
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
export type Relationship = { trust: number; tension: number };
export type ActiveObjective = {
  objective_id: string;
  label: string;
  status: ObjectiveStatus;
};

export type GameState = {
  schema_version: 2;
  turn_index: number;
  story_progress: number;
  goal_status: GoalStatus;
  active_objective: ActiveObjective;
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
  arguments: { target_id?: string };
  label: string;
  narrative_intent: string;
  anticipated_tradeoff: string;
  status: ChoiceStatus;
  disabled_reason?: string;
};

export type DialogueLine = {
  character_id: string;
  text: string;
  responds_to_previous: boolean;
};

export type Scene = {
  scene_id: string;
  scene_index: number;
  milestone_type: MilestoneType;
  title: string;
  location: string;
  situation: string;
  scene_goal: string;
  objective_id: string;
  obstacle: string;
  because_of_choice: string;
  immediate_consequence: string;
  time_passed: string;
  transition_reason: string;
  new_information: string | null;
  thread_opened: string | null;
  thread_resolved: string | null;
  present_character_ids: string[];
  narration: string;
  dialogue: DialogueLine[];
  choice_ids: string[];
  created_from_event_id: string | null;
};

export type StoryEvent = {
  event_id: string;
  scene_id: string;
  choice_id: string;
  command_type: CommandType;
  command_arguments: { target_id?: string };
  summary: string;
  source_scene_title: string;
  source_location: string;
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

export type ArcMilestoneState = MilestoneContract & {
  milestone_id: string;
  minimum_scenes: number;
  maximum_scenes: number;
  scene_count: number;
  unique_discovery_count: number;
  status: "pending" | "active" | "completed";
  completion_evidence: string | null;
};

export type ArcState = {
  arc_id: string;
  arc_number: number;
  active_milestone_index: number;
  milestones: ArcMilestoneState[];
  completed_milestone_types: MilestoneType[];
  open_threads: string[];
  discovered_clues: string[];
  last_new_information: string | null;
  recent_locations: string[];
  recent_pattern_ids: string[];
  status: "active" | "completed";
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
  milestone_type: MilestoneType;
  open_thread_count: number;
  proposal_count: number;
  valid_choice_count: number;
  retrieval: RetrievalTrace;
  prompt_version: 3;
  schema_version: 2;
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
  arc_progress: {
    arc_id: string;
    arc_number: number;
    status: ArcState["status"];
    current_milestone: ArcMilestoneState;
    completed_milestone_types: MilestoneType[];
    completed_count: number;
    total_milestones: number;
    turn_count: number;
    minimum_turns: number;
    maximum_turns: number;
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
  schema_version: 2;
  universe_id: string;
  storyline_id: string;
  branch_id: string;
  template_id: TemplateId;
  universe: WorldSeedDraft["universe"];
  story: WorldSeedDraft["story"];
  arc_plan: WorldSeedDraft["arc_plan"];
  arc_state: ArcState;
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
  because_of_choice: string;
  immediate_consequence: string;
  time_passed: string;
  transition_reason: string;
  milestone_action: "continue" | "complete";
  milestone_completion_evidence: string | null;
  scene_title: string;
  location: string;
  scene_goal: string;
  obstacle: string;
  new_information: string | null;
  thread_opened: string | null;
  thread_resolved: string | null;
  present_character_ids: string[];
  narration: string;
  dialogue: DialogueLine[];
  choice_proposals: Array<{
    axis: ChoiceAxis;
    command_type: CommandType;
    arguments: { target_id: string | null };
    label: string;
    narrative_intent: string;
    anticipated_tradeoff: string;
  }>;
};

export type CraftCard = {
  template_id: TemplateId;
  doc_type: "craft";
  card_id: string;
  source_id: string;
  source_title: string;
  story_phase: StoryPhase;
  scene_function: string;
  pattern: string;
  content_rating: "family_safe";
};

export type FastTurnPacket = {
  schema_version: 2;
  world: WorldSession["universe"] & { universe_id: string };
  story: WorldSession["story"];
  arc_context: {
    arc_id: string;
    active_milestone: ArcMilestoneState;
    completed_milestone_types: MilestoneType[];
    open_threads: string[];
    discovered_clues: string[];
    last_new_information: string | null;
    recent_locations: string[];
    recent_pattern_ids: string[];
    must_complete_this_turn: boolean;
    novelty_rules: string[];
  };
  committed_event: Pick<
    StoryEvent,
    "event_id" | "command_type" | "summary" | "source_location"
  >;
  recent_events: Array<
    Pick<StoryEvent, "event_id" | "command_type" | "summary" | "source_location">
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
  retrieved_craft_cards: CraftCard[];
  supported_commands: CommandType[];
  output_requirements: {
    narration_min_words: number;
    narration_max_words: number;
    dialogue_min_items: number;
    dialogue_max_items: number;
    choice_proposal_limit: number;
    canonical_discovery_limit: number;
  };
};
