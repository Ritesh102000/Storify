import { z } from "zod";
import { ARCHETYPES, PORTRAIT_STYLES, TACTICS } from "./types";

const short = z.string().trim().min(1).max(200);
const line = z.string().trim().min(1).max(400);

export const appearanceSchema = z
  .object({
    age_band: short,
    build: short,
    hair: short,
    notable_feature: short,
    dress: short,
    expression: short,
  })
  .strict();

/**
 * What the model returns when it drafts a character. Strict, so a malformed
 * character can never reach storage — the same rule the story engine uses.
 */
export const characterDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    role: short,
    archetype: z.enum(ARCHETYPES),

    want: line,
    need: line,
    wound: line,
    lie: line,

    tactic: z.enum(TACTICS),
    boundary: line,
    status_move: line,
    tell: line,
    contradiction: line,

    notices_first: line,
    carries: line,
    speech_style: line,
    never_says: line,
    enemy_description: line,

    owes: line,
    would_call_at_3am: line,
    unforgivable: line,

    appearance: appearanceSchema,
  })
  .strict();

export type CharacterDraftOutput = z.infer<typeof characterDraftSchema>;

export const interviewAnswersSchema = z
  .object({
    seed: z.string().trim().max(600).optional(),
    name: z.string().trim().max(60).optional(),
    role: z.string().trim().max(200).optional(),
    want: z.string().trim().max(400).optional(),
    need: z.string().trim().max(400).optional(),
    wound: z.string().trim().max(400).optional(),
    tactic: z.string().trim().max(60).optional(),
    boundary: z.string().trim().max(400).optional(),
    contradiction: z.string().trim().max(400).optional(),
    speech_style: z.string().trim().max(400).optional(),
    unforgivable: z.string().trim().max(400).optional(),
    archetype: z.enum(ARCHETYPES).optional(),
    portrait_style: z.enum(PORTRAIT_STYLES).optional(),
  })
  .strict();

export const createCharacterSchema = z
  .object({
    answers: interviewAnswersSchema,
    origin: z.enum(["interviewed", "self"]).default("interviewed"),
    story_id: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const patchCharacterSchema = characterDraftSchema
  .partial()
  .extend({ portrait_style: z.enum(PORTRAIT_STYLES).optional() })
  .strict();

export const portraitRequestSchema = z
  .object({
    // A reference is optional. "style" takes palette and light only; "look"
    // additionally takes general build and hair. Default is the narrower one.
    reference_image_base64: z.string().min(1).max(12_000_000).optional(),
    reference_mode: z.enum(["style", "look"]).default("style"),
    subject_type: z.enum(["character", "self"]).default("character"),
    consent_confirmed: z.boolean().optional(),
  })
  .strict();
