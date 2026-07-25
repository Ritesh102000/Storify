import { z } from "zod";

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
export const plotBeatTypeSchema = z.enum([
  "setup",
  "pursuit",
  "reveal",
  "reversal",
  "crisis",
  "climax",
]);

const shortText = z.string().trim().min(1).max(180);
const paragraph = z.string().trim().min(1).max(900);

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
    label: z.string().trim().min(1).max(140),
  })
  .strict();

export const plotBeatSchema = z
  .object({
    beat_type: plotBeatTypeSchema,
    title: z.string().trim().min(1).max(80),
    location: shortText,
    objective: shortText,
    obstacle: paragraph,
    development: paragraph,
    reveal: paragraph,
    story_question: shortText,
    present_character_prototypes: z
      .array(prototypeSchema)
      .min(1)
      .max(3),
  })
  .strict();

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
    plot_outline: z
      .object({
        theme: shortText,
        ending_direction: paragraph,
        beats: z.array(plotBeatSchema).length(6),
      })
      .strict(),
    characters: z.array(characterDraftSchema).length(3),
    opening_scene: z
      .object({
        location: shortText,
        situation: paragraph,
        present_character_prototypes: z
          .array(prototypeSchema)
          .min(1)
          .max(3),
        objective_label: z.string().trim().min(1).max(80),
        danger_label: z.string().trim().min(1).max(80),
        threat_prototype: z.literal("rival"),
      })
      .strict(),
    opening_narration: z.string().trim().min(40).max(1600),
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

    const expected = {
      protect: "help_character",
      pursue: "pursue_goal",
      confront: "confront_character",
    } as const;
    for (const proposal of value.first_choice_proposals) {
      if (expected[proposal.axis] !== proposal.command_type) {
        context.addIssue({
          code: "custom",
          path: ["first_choice_proposals"],
          message: `Axis ${proposal.axis} must use ${expected[proposal.axis]}.`,
        });
      }
    }

    const expectedBeats = [
      "setup",
      "pursuit",
      "reveal",
      "reversal",
      "crisis",
      "climax",
    ];
    const actualBeats = value.plot_outline.beats.map((beat) => beat.beat_type);
    if (actualBeats.some((beat, index) => beat !== expectedBeats[index])) {
      context.addIssue({
        code: "custom",
        path: ["plot_outline", "beats"],
        message:
          "Plot beats must be setup, pursuit, reveal, reversal, crisis, and climax in order.",
      });
    }
    const distinctLocations = new Set(
      value.plot_outline.beats.map((beat) => beat.location.toLowerCase()),
    );
    if (distinctLocations.size < 4) {
      context.addIssue({
        code: "custom",
        path: ["plot_outline", "beats"],
        message: "The plot must use at least four distinct locations.",
      });
    }
    const distinctDevelopments = new Set(
      value.plot_outline.beats.map((beat) => beat.development.toLowerCase()),
    );
    if (distinctDevelopments.size !== 6) {
      context.addIssue({
        code: "custom",
        path: ["plot_outline", "beats"],
        message: "Every beat must introduce a distinct development.",
      });
    }
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
        z
          .object({
            prototype: prototypeSchema,
            name: z.string().trim().max(48),
            instruction: z.string().trim().max(240),
          })
          .strict(),
      )
      .max(3),
    customization_prompt: z.string().trim().max(1000),
    language: z.string().trim().min(2).max(32),
    content_tone: z.enum(["family_safe", "mature"]),
  })
  .strict();

export const storyTurnDraftSchema = z
  .object({
    scene_title: z.string().trim().min(1).max(100),
    location: shortText,
    situation: paragraph,
    scene_goal: shortText,
    new_information: paragraph,
    thread_opened: shortText.nullable(),
    thread_resolved: shortText.nullable(),
    narration: z.string().trim().min(20).max(1600),
    dialogue: z
      .array(
        z
          .object({
            character_id: z.string().trim().min(1).max(80),
            text: z.string().trim().min(1).max(320),
          })
          .strict(),
      )
      .max(2),
    choice_proposals: z
      .array(
        z
          .object({
            axis: axisSchema,
            command_type: commandTypeSchema,
            arguments: z
              .object({
                target_id: z.string().trim().min(1).max(80).nullable(),
              })
              .strict(),
            label: z.string().trim().min(1).max(140),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();

export const chooseRequestSchema = z
  .object({
    branch_id: z.string().trim().min(1),
    choice_id: z.string().trim().min(1),
  })
  .strict();

export const spinOffRequestSchema = z
  .object({
    source_branch_id: z.string().trim().min(1),
    source_event_id: z.string().trim().min(1),
    character_id: z.string().trim().min(1),
  })
  .strict();

export const createWorldRequestSchema = z
  .object({
    preview_id: z.string().trim().min(1),
  })
  .strict();

export const spinOffDraftSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    opening_narration: z.string().trim().min(40).max(1600),
  })
  .strict();
