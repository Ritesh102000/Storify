import { z } from "zod";

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/, "Identifiers may contain letters, numbers, _ and -.");
export const detectiveIdentifierSchema = identifier;
const shortText = z.string().trim().min(1).max(240);
const prose = z.string().trim().min(1).max(2_000);

export const detectiveGenreSchema = z.enum(["noir", "gothic", "scifi"]);
export const detectiveDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const detectivePaceSchema = z.enum(["blitz", "full"]);
export const detectiveStatusSchema = z.enum(["active", "resolved"]);
export const detectiveActionTypeSchema = z.enum([
  "inspect",
  "analyze",
  "interrogate",
]);

export const detectiveCreateSchema = z
  .object({
    genre: detectiveGenreSchema,
    difficulty: detectiveDifficultySchema,
    pace: detectivePaceSchema,
    atmosphere: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

const inspectActionSchema = z
  .object({
    action_type: z.literal("inspect"),
    location_id: identifier,
  })
  .strict();

const analyzeActionSchema = z
  .object({
    action_type: z.literal("analyze"),
    clue_id: identifier,
  })
  .strict();

const interrogateActionSchema = z
  .object({
    action_type: z.literal("interrogate"),
    suspect_id: identifier,
    question: z.string().trim().min(1).max(600),
    evidence_id: identifier.optional(),
  })
  .strict();

export const detectiveActionSchema = z.discriminatedUnion("action_type", [
  inspectActionSchema,
  analyzeActionSchema,
  interrogateActionSchema,
]);

export const detectiveAccusationSchema = z
  .object({
    suspect_id: identifier,
    motive: z.string().trim().min(1).max(1_000),
    evidence_ids: z.array(identifier).min(1).max(6),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.evidence_ids).size !== value.evidence_ids.length) {
      context.addIssue({
        code: "custom",
        path: ["evidence_ids"],
        message: "Evidence IDs must be unique.",
      });
    }
  });

const transcriptEntrySchema = z
  .object({
    entry_id: identifier,
    turn: z.number().int().min(1),
    action_type: detectiveActionTypeSchema,
    speaker: shortText.optional(),
    text: prose,
  })
  .strict();

const resultSchema = z
  .object({
    correct: z.boolean(),
    score: z.number().int().min(0).max(100),
    culprit_id: identifier,
    culprit_name: shortText,
    motive: prose,
    explanation: prose,
    used_evidence_ids: z.array(identifier).max(6),
  })
  .strict();

const suspectSecretSchema = z
  .object({
    suspect_id: identifier,
    name: shortText,
    role: shortText,
    public_profile: prose,
    demeanor: prose,
    stress: z.number().int().min(0).max(100),
    is_culprit: z.boolean(),
    true_alibi: prose,
    secret_motive: prose,
    authorized_knowledge: z.array(prose).min(1).max(12),
    confession_clue_ids: z.array(identifier).min(1).max(6),
    confession_stress_threshold: z.number().int().min(40).max(100),
    confession_statement: prose,
  })
  .strict();

const locationSecretSchema = z
  .object({
    location_id: identifier,
    name: shortText,
    description: prose,
    visited: z.boolean(),
    clue_ids: z.array(identifier).min(1).max(12),
  })
  .strict();

const clueSecretSchema = z
  .object({
    clue_id: identifier,
    title: shortText,
    location_id: identifier,
    discovery: prose,
    analysis: prose,
    connections: z.array(shortText).max(12),
    prerequisite_clue_ids: z.array(identifier).max(6),
    suspect_ids: z.array(identifier).max(6),
    discovered: z.boolean(),
    analyzed: z.boolean(),
    key_evidence: z.boolean(),
    significance: prose,
  })
  .strict();

const solutionSchema = z
  .object({
    culprit_id: identifier,
    motive: prose,
    motive_keywords: z.array(shortText).min(2).max(16),
    explanation: prose,
  })
  .strict();

const generationSchema = z
  .object({
    provider: z.enum(["openai", "fixture"]),
    model: shortText,
    used_fallback: z.boolean(),
  })
  .strict();

export const detectiveSessionSchema = z
  .object({
    schema_version: z.literal(1),
    case_id: identifier,
    revision: z.number().int().min(0),
    status: detectiveStatusSchema,
    title: shortText,
    genre: detectiveGenreSchema,
    difficulty: detectiveDifficultySchema,
    pace: detectivePaceSchema,
    atmosphere: shortText,
    setting: prose,
    premise: prose,
    opening_narration: prose,
    central_question: prose,
    turn: z.number().int().min(0),
    max_turns: z.number().int().min(1).max(100),
    suspects: z.array(suspectSecretSchema).min(3).max(6),
    locations: z.array(locationSecretSchema).min(2).max(8),
    clues: z.array(clueSecretSchema).min(4).max(20),
    transcript: z.array(transcriptEntrySchema).max(200),
    solution: solutionSchema,
    result: resultSchema.optional(),
    generation: generationSchema,
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .strict();

const draftSuspectSchema = suspectSecretSchema
  .omit({ stress: true })
  .extend({
    starting_stress: z.number().int().min(0).max(70),
  })
  .strict();

const draftLocationSchema = locationSecretSchema
  .extend({ visited: z.literal(false) })
  .strict();

const draftClueSchema = clueSecretSchema
  .extend({
    discovered: z.literal(false),
    analyzed: z.literal(false),
  })
  .strict();

export const detectiveCaseDraftSchema = z
  .object({
    title: shortText,
    atmosphere: shortText,
    setting: prose,
    premise: prose,
    opening_narration: prose,
    central_question: prose,
    suspects: z.array(draftSuspectSchema).min(3).max(6),
    locations: z.array(draftLocationSchema).min(2).max(8),
    clues: z.array(draftClueSchema).min(4).max(20),
    solution: solutionSchema,
  })
  .strict();

const flavorSuspectSchema = z
  .object({
    suspect_id: identifier,
    name: shortText,
    role: shortText,
    public_profile: prose,
    demeanor: prose,
    true_alibi: prose,
    secret_motive: prose,
    authorized_knowledge: z.array(prose).min(1).max(12),
    confession_statement: prose,
  })
  .strict();

const flavorLocationSchema = z
  .object({
    location_id: identifier,
    name: shortText,
    description: prose,
  })
  .strict();

const flavorClueSchema = z
  .object({
    clue_id: identifier,
    title: shortText,
    discovery: prose,
    analysis: prose,
    connections: z.array(shortText).max(12),
    significance: prose,
  })
  .strict();

/**
 * OpenAI may rewrite narrative flavor, but it cannot choose IDs, culprit,
 * clue locks, key-evidence flags, turn limits, or any other game mechanic.
 */
export const detectiveCaseFlavorSchema = z
  .object({
    title: shortText,
    atmosphere: shortText,
    setting: prose,
    premise: prose,
    opening_narration: prose,
    central_question: prose,
    suspects: z.array(flavorSuspectSchema).min(3).max(6),
    locations: z.array(flavorLocationSchema).min(2).max(8),
    clues: z.array(flavorClueSchema).min(4).max(20),
    solution_motive: prose,
    solution_motive_keywords: z.array(shortText).min(2).max(16),
    solution_explanation: prose,
  })
  .strict();

export const detectiveReplySchema = z
  .object({
    stance: z.enum(["denial", "guarded_confession"]),
    reply: z.string().trim().min(1).max(1_200),
  })
  .strict();

export type DetectiveCaseFlavor = z.infer<
  typeof detectiveCaseFlavorSchema
>;
