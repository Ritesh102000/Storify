import type {
  CharacterMindState,
  MilestoneType,
  StoryEvent,
  TemplateId,
} from "@/lib/types";

export type SimulationEntityKind =
  | "character"
  | "location"
  | "object"
  | "faction"
  | "hazard";

export type SimulationEntity = {
  entity_id: string;
  kind: SimulationEntityKind;
  name: string;
  description: string;
  status: string;
  location_id: string | null;
  portable: boolean;
  // A portable entity held by a character travels with them. Without this the
  // evidence a scene depends on is orphaned in the room where it was found.
  carried_by: string | null;
  properties: Record<string, string | number | boolean>;
  introduced_event_id: string | null;
};

export type SimulationFact = {
  fact_id: string;
  statement: string;
  truth_status: "true" | "false" | "uncertain";
  evidence: string[];
  source_event_id: string | null;
  known_by_character_ids: string[];
  reveal_after: MilestoneType | null;
  status: "active" | "superseded";
};

export type SimulationBelief = {
  fact_id: string;
  confidence: number;
  interpretation: string;
  learned_event_id: string | null;
};

export type SimulationGoal = {
  goal_id: string;
  description: string;
  priority: number;
  status: "active" | "achieved" | "failed" | "abandoned";
  created_event_id: string | null;
};

export type SimulationCharacter = {
  character_id: string;
  mind: CharacterMindState;
  beliefs: SimulationBelief[];
  goals: SimulationGoal[];
};

export type SimulationThread = {
  thread_id: string;
  question: string;
  stakes: string;
  status: "open" | "resolved" | "abandoned";
  required_evidence_count: number;
  evidence_fact_ids: string[];
  opened_event_id: string | null;
  resolved_event_id: string | null;
};

export type SimulationClock = {
  elapsed_minutes: number;
  time_label: string;
  turn_started_at_minutes: number;
};

export type SimulationTransition = {
  transition_id: string;
  event_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  elapsed_minutes: number;
  reason: string;
};

export type SimulationState = {
  simulation_version: 1;
  template_id: TemplateId;
  clock: SimulationClock;
  entities: Record<string, SimulationEntity>;
  characters: Record<string, SimulationCharacter>;
  facts: Record<string, SimulationFact>;
  threads: Record<string, SimulationThread>;
  transitions: SimulationTransition[];
  last_event_id: string | null;
};

export const SIMULATION_COMMAND_TYPES = [
  "advance_time",
  "introduce_entity",
  "move_entity",
  "set_possession",
  "set_status",
  "establish_fact",
  "update_belief",
  "update_goal",
  "update_thread",
] as const;

export type SimulationCommandType =
  (typeof SIMULATION_COMMAND_TYPES)[number];

export type SimulationCommandProposal = {
  command_type: SimulationCommandType;
  actor_ref: string | null;
  target_ref: string | null;
  new_ref: string | null;
  entity_kind: SimulationEntityKind | null;
  name: string | null;
  description: string | null;
  string_value: string | null;
  number_value: number | null;
  boolean_value: boolean | null;
  fact_statement: string | null;
  evidence: string[];
  known_by_refs: string[];
  reason: string;
};

export type BeatCandidate = {
  candidate_id: string;
  storylet_id: string;
  because_of_choice: string;
  dramatic_question: string;
  chosen_action_result: string;
  cost_paid: string;
  scene_premise: string;
  continuity_bridge: string;
  action_sequence: Array<{
    actor_ref: string;
    physical_action: string;
    observable_result: string;
  }>;
  evidence_delivery: string;
  closing_pressure: string;
  start_location_ref: string;
  end_location_ref: string;
  character_pressure: Array<{
    character_id: string;
    want_in_scene: string;
    conflict_with: string;
  }>;
  commands: SimulationCommandProposal[];
  information_used_fact_ids: string[];
  milestone_action: "continue" | "complete";
  milestone_completion_evidence: string | null;
};

export type DirectorPlan = {
  turn_thesis: string;
  candidates: BeatCandidate[];
};

export type CharacterIntent = {
  character_id: string;
  immediate_goal: string;
  private_interpretation: string;
  emotional_state: string;
  physical_action: string;
  dialogue_goal: string;
  tactic: string;
  boundary: string;
  belief_updates: Array<{
    fact_id: string;
    confidence: number;
    interpretation: string;
  }>;
};

export type SimulationCommit = {
  simulation_event_id: string;
  source_story_event_id: string;
  candidate_id: string;
  commands: SimulationCommandProposal[];
  resolved_refs: Record<string, string>;
  effects: Array<{
    command_type: SimulationCommandType;
    target_id: string | null;
    description: string;
  }>;
  created_at: string;
};

export type CandidateDryRun =
  | {
      valid: true;
      candidate: BeatCandidate;
      next_state: SimulationState;
      commit: SimulationCommit;
      score: number;
    }
  | {
      valid: false;
      candidate: BeatCandidate;
      errors: string[];
    };

export type StoryCritique = {
  valid: boolean;
  errors: Array<{
    category:
      | "causality"
      | "timeline"
      | "character_knowledge"
      | "world_rule"
      | "entity_state"
      | "presentation"
      | "reader_logic"
      | "character_intent"
      | "repetition";
    severity: "warning" | "fatal";
    explanation: string;
    evidence: string;
  }>;
  repair_instructions: string[];
};

export type SimulationTurnContext = {
  before: SimulationState;
  selected: BeatCandidate;
  after: SimulationState;
  commit: SimulationCommit;
  character_intents: CharacterIntent[];
  source_event: StoryEvent;
};
