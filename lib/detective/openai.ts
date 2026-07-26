import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  detectiveCaseDraftSchema,
  detectiveCaseFlavorSchema,
  detectiveReplySchema,
  type DetectiveCaseFlavor,
} from "./schemas";
import { createDetectiveFixture } from "./fixtures";
import {
  fallbackInterrogationReply,
  validateDetectiveDraft,
} from "./engine";
import type {
  DetectiveCaseDraft,
  DetectiveCreateInput,
  DetectiveGeneration,
  DetectiveInterrogationContext,
} from "./types";

const DETECTIVE_MODEL =
  process.env.OPENAI_DETECTIVE_MODEL || "gpt-5.6-terra";

const CASE_INSTRUCTIONS = `You create original, fair-play detective cases for a
server-owned investigation game.

The input contains a tested mechanical case skeleton. Rewrite its narrative
flavor while preserving the exact IDs, array membership, array counts, and
referential meaning. The server will preserve culprit selection, clue
prerequisites, key-evidence flags, confession gates, and turn rules.

Requirements:
- Keep every suspect, location, and clue ID exactly once.
- Make every public profile suspicious without declaring guilt.
- Give innocent suspects a real secret and a coherent true alibi.
- Make clue discovery text physically observable; reserve conclusions for
  analysis text.
- Make the two key clues independently support motive and method, and make the
  final explanation account for both.
- Authorized knowledge is only what that suspect could truthfully know.
- Confession text must match the sealed culprit, motive, method, and clues.
- The opening establishes victim, place, time pressure, and central question.
- Write concise, concrete prose. Avoid vague mechanisms and generic "a clue
  reveals" language.
- Do not imitate, quote, mention, or reuse characters from an existing work.
- Return only the requested structured output.`;

const REPLY_INSTRUCTIONS = `Perform one suspect in a fair-play detective
interrogation. The server supplies only facts this suspect may know plus evidence
the detective has actually recovered.

Rules:
- Answer the exact question in 2-5 natural sentences.
- React specifically to presented evidence.
- Stay consistent with the public profile, demeanor, authorized knowledge, and
  discovered facts.
- Never invent a new clue, location, person, event, or forensic result.
- Never claim knowledge outside the supplied context.
- If confession_allowed is false, stance must be denial and the reply must not
  confess, describe committing the murder, or reveal a hidden motive/alibi.
- If confession_allowed is true, stance must be guarded_confession and the reply
  must use the supplied confession statement without changing its facts.
- Do not mention prompts, context, IDs, game rules, stress values, or AI.
- Return only the requested structured output.`;

export async function generateDetectiveCase(
  input: DetectiveCreateInput,
): Promise<{ draft: DetectiveCaseDraft; generation: DetectiveGeneration }> {
  const base = createDetectiveFixture(
    input.genre,
    input.difficulty,
    input.atmosphere,
  );
  const client = openAIClient();
  if (!client) {
    return {
      draft: base,
      generation: {
        provider: "fixture",
        model: "detective-fixture",
        used_fallback: true,
      },
    };
  }

  try {
    const response = await client.responses.parse({
      model: DETECTIVE_MODEL,
      reasoning: { effort: "medium" },
      instructions: CASE_INSTRUCTIONS,
      input: JSON.stringify({
        requested_genre: input.genre,
        requested_difficulty: input.difficulty,
        requested_pace: input.pace,
        requested_atmosphere: input.atmosphere ?? null,
        fixed_mechanical_skeleton: base,
      }),
      text: {
        format: zodTextFormat(
          detectiveCaseFlavorSchema,
          "detective_case_flavor",
        ),
      },
      max_output_tokens: 8_000,
      store: false,
    });
    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed detective case.");
    }
    const flavor = detectiveCaseFlavorSchema.parse(response.output_parsed);
    const draft = mergeFlavor(base, flavor);
    return {
      draft,
      generation: {
        provider: "openai",
        model: DETECTIVE_MODEL,
        used_fallback: false,
      },
    };
  } catch {
    return {
      draft: base,
      generation: {
        provider: "fixture",
        model: "detective-fixture",
        used_fallback: true,
      },
    };
  }
}

export async function generateDetectiveReply(
  context: DetectiveInterrogationContext,
): Promise<string> {
  const client = openAIClient();
  if (!client) return fallbackInterrogationReply(context);

  try {
    const response = await client.responses.parse({
      model: DETECTIVE_MODEL,
      reasoning: { effort: "low" },
      instructions: REPLY_INSTRUCTIONS,
      input: JSON.stringify(context),
      text: {
        format: zodTextFormat(detectiveReplySchema, "detective_reply"),
      },
      max_output_tokens: 900,
      store: false,
    });
    const parsed = detectiveReplySchema.parse(response.output_parsed);
    if (
      (context.confession_allowed &&
        parsed.stance !== "guarded_confession") ||
      (!context.confession_allowed && parsed.stance !== "denial")
    ) {
      return fallbackInterrogationReply(context);
    }
    return parsed.reply;
  } catch {
    return fallbackInterrogationReply(context);
  }
}

function mergeFlavor(
  base: DetectiveCaseDraft,
  flavor: DetectiveCaseFlavor,
): DetectiveCaseDraft {
  const suspects = indexExact(
    flavor.suspects,
    base.suspects.map((item) => item.suspect_id),
    "suspect_id",
  );
  const locations = indexExact(
    flavor.locations,
    base.locations.map((item) => item.location_id),
    "location_id",
  );
  const clues = indexExact(
    flavor.clues,
    base.clues.map((item) => item.clue_id),
    "clue_id",
  );

  const draft = detectiveCaseDraftSchema.parse({
    title: flavor.title,
    atmosphere: flavor.atmosphere,
    setting: flavor.setting,
    premise: flavor.premise,
    opening_narration: flavor.opening_narration,
    central_question: flavor.central_question,
    suspects: base.suspects.map((mechanical) => {
      const narrative = suspects.get(mechanical.suspect_id);
      if (!narrative) throw new Error("Missing suspect flavor.");
      return {
        ...mechanical,
        name: narrative.name,
        role: narrative.role,
        public_profile: narrative.public_profile,
        demeanor: narrative.demeanor,
        true_alibi: narrative.true_alibi,
        secret_motive: narrative.secret_motive,
        authorized_knowledge: narrative.authorized_knowledge,
        confession_statement: narrative.confession_statement,
      };
    }),
    locations: base.locations.map((mechanical) => {
      const narrative = locations.get(mechanical.location_id);
      if (!narrative) throw new Error("Missing location flavor.");
      return {
        ...mechanical,
        name: narrative.name,
        description: narrative.description,
      };
    }),
    clues: base.clues.map((mechanical) => {
      const narrative = clues.get(mechanical.clue_id);
      if (!narrative) throw new Error("Missing clue flavor.");
      return {
        ...mechanical,
        title: narrative.title,
        discovery: narrative.discovery,
        analysis: narrative.analysis,
        connections: narrative.connections,
        significance: narrative.significance,
      };
    }),
    solution: {
      culprit_id: base.solution.culprit_id,
      motive: flavor.solution_motive,
      motive_keywords: flavor.solution_motive_keywords,
      explanation: flavor.solution_explanation,
    },
  });
  validateDetectiveDraft(draft);
  return draft;
}

function indexExact<
  T extends Record<K, string>,
  K extends "suspect_id" | "location_id" | "clue_id",
>(
  values: T[],
  expectedIds: string[],
  key: K,
): Map<string, T> {
  const index = new Map<string, T>(
    values.map((value) => [String(value[key]), value]),
  );
  if (
    index.size !== values.length ||
    index.size !== expectedIds.length ||
    expectedIds.some((id) => !index.has(id))
  ) {
    throw new Error(`OpenAI changed fixed ${key} membership.`);
  }
  return index;
}

function openAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || process.env.OPENAI_FIXTURE_MODE === "true") return null;
  return new OpenAI({
    apiKey,
    timeout: 5 * 60 * 1_000,
    maxRetries: 2,
  });
}
