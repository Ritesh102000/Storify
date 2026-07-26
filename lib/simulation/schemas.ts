import { z } from "zod";
import { SIMULATION_COMMAND_TYPES } from "./types";

const commandSchema = z.object({
  command_type: z.enum(SIMULATION_COMMAND_TYPES),
  actor_ref: z.string().trim().min(1).max(100).nullable(),
  target_ref: z.string().trim().min(1).max(100).nullable(),
  new_ref: z.string().trim().min(1).max(100).nullable(),
  entity_kind: z
    .enum(["character", "location", "object", "faction", "hazard"])
    .nullable(),
  name: z.string().trim().min(1).max(100).nullable(),
  description: z.string().trim().min(1).max(500).nullable(),
  string_value: z.string().trim().min(1).max(500).nullable(),
  number_value: z.number().min(0).max(1440).nullable(),
  boolean_value: z.boolean().nullable(),
  fact_statement: z.string().trim().min(1).max(500).nullable(),
  evidence: z.array(z.string().trim().min(1).max(300)).max(4),
  known_by_refs: z.array(z.string().trim().min(1).max(100)).max(4),
  reason: z.string().trim().min(1).max(500),
}).strict();

const beatCandidateSchema = z.object({
  candidate_id: z.string().trim().min(1).max(100),
  storylet_id: z.string().trim().min(1).max(100),
  because_of_choice: z.string().trim().min(1).max(500),
  dramatic_question: z.string().trim().min(1).max(300),
  chosen_action_result: z.string().trim().min(1).max(500),
  cost_paid: z.string().trim().min(1).max(500),
  scene_premise: z.string().trim().min(1).max(500),
  continuity_bridge: z.string().trim().min(1).max(500),
  action_sequence: z.array(
    z.object({
      actor_ref: z.string().trim().min(1).max(100),
      physical_action: z.string().trim().min(1).max(300),
      observable_result: z.string().trim().min(1).max(300),
    }).strict(),
  ).min(4).max(7),
  evidence_delivery: z.string().trim().min(1).max(500),
  closing_pressure: z.string().trim().min(1).max(500),
  start_location_ref: z.string().trim().min(1).max(100),
  end_location_ref: z.string().trim().min(1).max(100),
  character_pressure: z.array(
    z.object({
      character_id: z.string().trim().min(1).max(100),
      want_in_scene: z.string().trim().min(1).max(300),
      conflict_with: z.string().trim().min(1).max(300),
    }).strict(),
  ).min(2).max(3),
  commands: z.array(commandSchema).min(2).max(10),
  information_used_fact_ids: z.array(
    z.string().trim().min(1).max(100),
  ).max(8),
  milestone_action: z.enum(["continue", "complete"]),
  milestone_completion_evidence: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .nullable(),
}).strict();

export const directorPlanSchema = z.object({
  turn_thesis: z.string().trim().min(1).max(500),
  candidates: z.array(beatCandidateSchema).length(3),
}).strict();

export const characterIntentSchema = z.object({
  character_id: z.string().trim().min(1).max(100),
  immediate_goal: z.string().trim().min(1).max(300),
  private_interpretation: z.string().trim().min(1).max(500),
  emotional_state: z.string().trim().min(1).max(100),
  physical_action: z.string().trim().min(1).max(300),
  dialogue_goal: z.string().trim().min(1).max(300),
  tactic: z.string().trim().min(1).max(300),
  boundary: z.string().trim().min(1).max(300),
  belief_updates: z.array(
    z.object({
      fact_id: z.string().trim().min(1).max(100),
      confidence: z.number().min(0).max(100),
      interpretation: z.string().trim().min(1).max(500),
    }).strict(),
  ).max(4),
}).strict();

export const beatSelectionSchema = z.object({
  selected_candidate_id: z.string().trim().min(1).max(100),
  scores: z.array(
    z.object({
      candidate_id: z.string().trim().min(1).max(100),
      causal_soundness: z.number().min(0).max(10),
      spatial_temporal_logic: z.number().min(0).max(10),
      character_intentionality: z.number().min(0).max(10),
      novelty_without_randomness: z.number().min(0).max(10),
      dramatic_progress: z.number().min(0).max(10),
      weakness: z.string().trim().min(1).max(400),
    }).strict(),
  ).min(1).max(3),
  selection_reason: z.string().trim().min(1).max(500),
}).strict();

export const storyCritiqueSchema = z.object({
  valid: z.boolean(),
  errors: z.array(
    z.object({
      category: z.enum([
        "causality",
        "timeline",
        "character_knowledge",
        "world_rule",
        "entity_state",
        "presentation",
        "reader_logic",
        "character_intent",
        "repetition",
      ]),
      severity: z.enum(["warning", "fatal"]),
      explanation: z.string().trim().min(1).max(500),
      evidence: z.string().trim().min(1).max(500),
    }).strict(),
  ).max(12),
  repair_instructions: z.array(
    z.string().trim().min(1).max(500),
  ).max(10),
}).strict();
