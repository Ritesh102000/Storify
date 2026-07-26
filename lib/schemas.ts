import { z } from "zod";
import { MILESTONE_TYPES } from "./types";

export const templateIdSchema = z.enum([
  "blackmoor",
  "neon_afterlight",
  "monsoon_house",
]);
export const prototypeSchema = z.enum(["ally", "rival", "mystery_keeper"]);
export const axisSchema = z.enum(["protect", "pursue", "confront"]);
export const commandTypeSchema = z.enum([
  "help_character",
  "pursue_goal",
  "confront_character",
]);
export const milestoneTypeSchema = z.enum(MILESTONE_TYPES);

const shortText = z.string().trim().min(1).max(240);
const paragraph = z.string().trim().min(1).max(1200);

export const characterDraftSchema = z
  .object({
    prototype: prototypeSchema,
    name: z.string().trim().min(1).max(48),
    role_in_world: shortText,
    relationship_to_listener: shortText,
    traits: z.array(z.string().trim().min(1).max(40)).min(2).max(3),
    goal: shortText,
    fear: shortText,
    secret: shortText,
    speech_style: shortText,
    voice_hint: shortText,
  })
  .strict();

export const choiceProposalSchema = z
  .object({
    axis: axisSchema,
    command_type: commandTypeSchema,
    target_prototype: prototypeSchema.nullable(),
    label: z.string().trim().min(1).max(160),
    narrative_intent: shortText,
    anticipated_tradeoff: shortText,
  })
  .strict();

export const milestoneContractSchema = z
  .object({
    milestone_type: milestoneTypeSchema,
    dramatic_purpose: paragraph,
    stakes_change: paragraph,
    completion_evidence_description: paragraph,
    permitted_revelations: z.array(shortText).max(3),
    forbidden_revelations: z.array(shortText).max(3),
  })
  .strict();

const storyletSchema = z.object({
  storylet_id: z.string().trim().min(1).max(100),
  template_id: templateIdSchema,
  milestone_types: z.array(milestoneTypeSchema).min(1).max(7),
  compatible_axes: z.array(axisSchema).min(1).max(3),
  situation: paragraph,
  concrete_affordance: shortText,
  pressure: shortText,
  discovery_form: shortText,
  character_conflict: shortText,
}).strict();

export const worldSeedDraftSchema = z
  .object({
    base_template_id: templateIdSchema,
    base_template_reason: shortText,
    universe: z
      .object({
        title: z.string().trim().min(1).max(80),
        genre: z.string().trim().min(1).max(80),
        mood: z.array(z.string().trim().min(1).max(32)).min(1).max(3),
        premise: paragraph,
        rules: z.array(shortText).min(1).max(3),
      })
      .strict(),
    story: z
      .object({
        listener_role: shortText,
        main_goal: shortText,
        central_question: shortText,
        tone_guardrails: z.array(shortText).max(3),
        opening_hook: shortText,
      })
      .strict(),
    arc_plan: z
      .object({
        theme: shortText,
        ending_direction: paragraph,
        milestones: z.array(milestoneContractSchema).length(7),
      })
      .strict(),
    storylet_deck: z.array(storyletSchema).length(6),
    characters: z.array(characterDraftSchema).length(3),
    opening_scene: z
      .object({
        location: shortText,
        situation: paragraph,
        present_character_prototypes: z.array(prototypeSchema).min(2).max(3),
        objective_label: z.string().trim().min(1).max(100),
        danger_label: z.string().trim().min(1).max(100),
        threat_prototype: z.literal("rival"),
      })
      .strict(),
    opening_narration: z.string().trim().min(40).max(1800),
    first_choice_proposals: z.array(choiceProposalSchema).length(3),
  })
  .strict()
  .superRefine((value, context) => {
    const prototypes = value.characters.map((character) => character.prototype);
    for (const required of ["ally", "rival", "mystery_keeper"] as const) {
      if (prototypes.filter((prototype) => prototype === required).length !== 1) {
        context.addIssue({
          code: "custom",
          path: ["characters"],
          message: `Exactly one ${required} is required.`,
        });
      }
    }
    const expectedCommands = {
      protect: "help_character",
      pursue: "pursue_goal",
      confront: "confront_character",
    } as const;
    for (const proposal of value.first_choice_proposals) {
      if (expectedCommands[proposal.axis] !== proposal.command_type) {
        context.addIssue({
          code: "custom",
          path: ["first_choice_proposals"],
          message: `Axis ${proposal.axis} must use ${expectedCommands[proposal.axis]}.`,
        });
      }
    }
    const actual = value.arc_plan.milestones.map((item) => item.milestone_type);
    if (actual.some((item, index) => item !== MILESTONE_TYPES[index])) {
      context.addIssue({
        code: "custom",
        path: ["arc_plan", "milestones"],
        message: "Milestones must use the canonical seven-stage order.",
      });
    }
    const storyletIds = value.storylet_deck.map(
      (storylet) => storylet.storylet_id,
    );
    if (new Set(storyletIds).size !== storyletIds.length) {
      context.addIssue({
        code: "custom",
        path: ["storylet_deck"],
        message: "Storylet IDs must be unique.",
      });
    }
    value.storylet_deck.forEach((storylet, index) => {
      if (storylet.template_id !== value.base_template_id) {
        context.addIssue({
          code: "custom",
          path: ["storylet_deck", index, "template_id"],
          message: "Every storylet must match the resolved base template.",
        });
      }
    });
  });

export const worldSetupInputSchema = z
  .object({
    template_id: z.union([templateIdSchema, z.literal("create_your_own")]),
    story_brief: z.string().trim().min(12).max(1200),
    genre: z.string().trim().min(1).max(80),
    mood: z.array(z.string().trim().min(1).max(32)).min(1).max(3),
    listener_role: z.string().trim().min(1).max(120),
    main_conflict: z.string().trim().min(1).max(240),
    world_rules: z.array(shortText).max(3),
    character_overrides: z
      .array(
        z.object({
          prototype: prototypeSchema,
          name: z.string().trim().max(48),
          instruction: z.string().trim().max(240),
        }).strict(),
      )
      .max(3),
    customization_prompt: z.string().trim().max(1000),
    language: z.string().trim().min(2).max(32),
    content_tone: z.enum(["family_safe", "mature"]),
    creativity: z
      .enum(["grounded", "balanced", "vivid"])
      .default("balanced"),
  })
  .strict();

const dialogueLineSchema = z.object({
  character_id: z.string().trim().min(1).max(80),
  text: z.string().trim().min(1).max(380),
  responds_to_previous: z.boolean(),
}).strict();

const storyBlockSchema = z.object({
  block_type: z.enum(["narration", "dialogue"]),
  character_id: z.string().trim().min(1).max(80).nullable(),
  text: z.string().trim().min(1).max(600),
  responds_to_previous: z.boolean(),
}).strict();

const causalChainSchema = z.object({
  chosen_action_result: shortText,
  cost_paid: shortText,
  observable_clue: shortText,
  new_hypothesis: shortText,
  next_pressure: shortText,
}).strict();

const characterMoveSchema = z.object({
  character_id: z.string().trim().min(1).max(80),
  want_now: shortText,
  belief_before: shortText,
  belief_after: shortText,
  emotion_after: z.string().trim().min(1).max(80),
  tactic: shortText,
  relationship_move: shortText,
  spoken_intent: shortText,
}).strict();

export const storyTurnDraftSchema = z
  .object({
    because_of_choice: paragraph,
    immediate_consequence: paragraph,
    time_passed: shortText,
    transition_reason: paragraph,
    storylet_id: z.string().trim().min(1).max(100),
    causal_chain: causalChainSchema,
    character_moves: z.array(characterMoveSchema).min(2).max(3),
    milestone_action: z.enum(["continue", "complete"]),
    milestone_completion_evidence: paragraph.nullable(),
    scene_title: z.string().trim().min(1).max(100),
    location: shortText,
    scene_goal: shortText,
    obstacle: paragraph,
    new_information: paragraph.nullable(),
    thread_opened: shortText.nullable(),
    thread_resolved: shortText.nullable(),
    present_character_ids: z.array(z.string().trim().min(1).max(80)).min(2).max(3),
    narration: z.string().trim().min(40).max(4000),
    dialogue: z.array(dialogueLineSchema).min(3).max(8),
    story_blocks: z.array(storyBlockSchema).min(7).max(18),
    choice_proposals: z
      .array(
        z.object({
          axis: axisSchema,
          command_type: commandTypeSchema,
          arguments: z.object({
            target_id: z.string().trim().min(1).max(80).nullable(),
          }).strict(),
          label: z.string().trim().min(1).max(160),
          narrative_intent: shortText,
          anticipated_tradeoff: shortText,
        }).strict(),
      )
      .length(3),
  })
  .strict();

// The simulator renderer emits one presentation source of truth. Narration and
// dialogue projections are derived server-side from these ordered blocks so the
// model never has to duplicate prose or split sentences to keep copies aligned.
export const rendererStoryTurnSchema = storyTurnDraftSchema.omit({
  narration: true,
  dialogue: true,
});

export const chooseRequestSchema = z.object({
  branch_id: z.string().trim().min(1),
  choice_id: z.string().trim().min(1),
}).strict();
export const spinOffRequestSchema = z.object({
  source_branch_id: z.string().trim().min(1),
  source_event_id: z.string().trim().min(1),
  character_id: z.string().trim().min(1),
}).strict();
export const createWorldRequestSchema = z.object({
  preview_id: z.string().trim().min(1),
}).strict();
export const continueWorldRequestSchema = z.object({
  branch_id: z.string().trim().min(1),
}).strict();
export const spinOffDraftSchema = z.object({
  title: z.string().trim().min(1).max(100),
  opening_narration: z.string().trim().min(40).max(1600),
}).strict();
