import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  creativeDiffs,
  buildLayeredFallbackSeed,
  fallbackStoryTurn,
  resolveNearestTemplate,
} from "../domain/fallbacks";
import {
  spinOffDraftSchema,
  storyTurnDraftSchema,
  worldSeedDraftSchema,
} from "../schemas";
import type {
  FastTurnPacket,
  GenerationStatus,
  SpinOff,
  StoryEvent,
  StoryTurnDraft,
  WorldPreview,
  WorldSession,
  WorldSetupInput,
} from "../types";
import { createId } from "../id";
import { ApiError } from "./api";
import { logGeneration } from "./store";
import {
  SPIN_OFF_INSTRUCTIONS,
  STORY_TURN_INSTRUCTIONS,
  WORLD_BUILDER_INSTRUCTIONS,
} from "./prompts";
import { retrieveForWorld } from "./retrieval";

const STORY_MODEL = process.env.OPENAI_STORY_MODEL || "gpt-5.6-sol";
const WORLD_MODEL = process.env.OPENAI_WORLD_MODEL || "gpt-5.6-terra";
const WORLD_REASONING_EFFORT =
  process.env.OPENAI_WORLD_REASONING_EFFORT || "medium";
const SPEECH_MODEL = "gpt-4o-mini-tts";
const MODERATION_MODEL = "omni-moderation-latest";

type GenerationMeta = WorldPreview["generation"];

export async function generateWorldPreview(
  input: WorldSetupInput,
): Promise<WorldPreview> {
  const started = Date.now();
  const resolvedTemplateId = resolveNearestTemplate(input);
  const retrieval = await retrieveForWorld(input, resolvedTemplateId);
  const client = openAIClient();
  let seed = buildLayeredFallbackSeed(input, resolvedTemplateId);
  let status: GenerationStatus = "fixture";
  let provider: GenerationMeta["provider"] = "fixture";
  let model = "layered-fallback";
  let fallbackReason: string | undefined;

  if (client) {
    await moderateCreativeInput(client, [
      input.story_brief,
      input.main_conflict,
      input.customization_prompt,
      ...input.character_overrides.flatMap((item) => [
        item.name,
        item.instruction,
      ]),
    ]);
    try {
      const response = await client.responses.parse(
        {
          model: WORLD_MODEL,
          reasoning: {
            effort: WORLD_REASONING_EFFORT as "low" | "medium" | "high",
          },
          instructions: WORLD_BUILDER_INSTRUCTIONS,
          input: JSON.stringify({
            user_setup: input,
            nearest_mechanical_template: seed,
            retrieved_craft_cards: retrieval.cards,
          }),
          text: {
            format: zodTextFormat(worldSeedDraftSchema, "world_seed"),
          },
          max_output_tokens: 5600,
          store: false,
        },
      );
      if (!response.output_parsed) {
        throw new Error("OpenAI returned no parsed world.");
      }
      seed = worldSeedDraftSchema.parse(response.output_parsed);
      status = "generated";
      provider = "openai";
      model = WORLD_MODEL;
    } catch (error) {
      status = "layered_fallback";
      provider = "fixture";
      fallbackReason = safeError(error);
    }
  } else {
    fallbackReason = "OPENAI_API_KEY is not configured.";
  }

  const preview: WorldPreview = {
    preview_id: createId("preview"),
    requested_template_id: input.template_id,
    resolved_template_id: seed.base_template_id,
    seed,
    creative_diffs: creativeDiffs(seed.base_template_id, seed),
    creativity: input.creativity ?? "balanced",
    retrieval: retrieval.trace,
    generation: {
      status,
      provider,
      model,
      latency_ms: Date.now() - started,
      used_fallback: status !== "generated",
      fallback_reason: fallbackReason,
    },
    created_at: new Date().toISOString(),
  };

  await logGeneration({
    operation: "world_builder",
    provider,
    model,
    status,
    latencyMs: preview.generation.latency_ms,
    usedFallback: preview.generation.used_fallback,
  });
  return preview;
}

export async function generateStoryTurn(
  session: WorldSession,
  event: StoryEvent,
  packet: FastTurnPacket,
): Promise<{ draft: StoryTurnDraft; generation: GenerationMeta }> {
  const started = Date.now();
  const client = openAIClient();
  let draft = fallbackStoryTurn(session, event);
  let status: GenerationStatus = "fixture";
  let provider: GenerationMeta["provider"] = "fixture";
  let model = "story-fallback";
  let fallbackReason: string | undefined;

  if (client) {
    try {
      const response = await client.responses.parse(
        {
          model: STORY_MODEL,
          reasoning: { effort: "none" },
          instructions: STORY_TURN_INSTRUCTIONS,
          input: JSON.stringify(packet),
          text: {
            format: zodTextFormat(storyTurnDraftSchema, "story_turn"),
          },
          max_output_tokens: 3600,
          store: false,
        },
      );
      if (!response.output_parsed) {
        throw new Error("OpenAI returned no parsed story turn.");
      }
      draft = storyTurnDraftSchema.parse(response.output_parsed);
      status = "generated";
      provider = "openai";
      model = STORY_MODEL;
    } catch (error) {
      status = "layered_fallback";
      provider = "fixture";
      fallbackReason = safeError(error);
    }
  } else {
    fallbackReason = "OPENAI_API_KEY is not configured.";
  }

  const generation: GenerationMeta = {
    status,
    provider,
    model,
    latency_ms: Date.now() - started,
    used_fallback: status !== "generated",
    fallback_reason: fallbackReason,
  };
  await logGeneration({
    universeId: session.universe_id,
    operation: "story_turn",
    provider,
    model,
    status,
    latencyMs: generation.latency_ms,
    usedFallback: generation.used_fallback,
  });
  return { draft, generation };
}

export async function generateSpinOff(
  session: WorldSession,
  characterId: string,
  event: StoryEvent,
): Promise<Pick<SpinOff, "title" | "opening_narration">> {
  const character = session.characters.find(
    (candidate) => candidate.character_id === characterId,
  );
  if (!character) {
    throw new ApiError(404, "CHARACTER_NOT_FOUND", "Character not found.");
  }
  const memories = session.memories
    .filter((memory) => memory.character_id === characterId)
    .slice(-5);
  const unlockedFacts = session.facts.filter(
    (fact) =>
      fact.character_id === characterId &&
      session.state.unlocked_fact_ids.includes(fact.fact_id),
  );
  const fallback = {
    title: `${character.name}: After the Choice`,
    opening_narration: `${character.name} remembers the listener's decision differently from everyone else. ${event.summary} Now, alone at the edge of ${session.universe.title}, ${character.name} follows a consequence the main story never had time to see. Their goal remains ${character.goal.toLowerCase()}, but the memory of what happened has changed who they trust. A hidden route opens ahead—personal, dangerous, and entirely their own.`,
  };
  const client = openAIClient();
  if (!client) return fallback;

  const started = Date.now();
  try {
    const response = await client.responses.parse(
      {
        model: STORY_MODEL,
        reasoning: { effort: "none" },
        instructions: SPIN_OFF_INSTRUCTIONS,
        input: JSON.stringify({
          world: session.universe,
          story: session.story,
          character: {
            character_id: character.character_id,
            prototype: character.prototype,
            name: character.name,
            role_in_world: character.role_in_world,
            relationship_to_listener: character.relationship_to_listener,
            traits: character.traits,
            goal: character.goal,
            fear: character.fear,
            speech_style: character.speech_style,
            voice_hint: character.voice_hint,
          },
          source_event: {
            summary: event.summary,
            command_type: event.command_type,
          },
          inherited_memories: memories,
          unlocked_facts: unlockedFacts,
        }),
        text: {
          format: zodTextFormat(spinOffDraftSchema, "spin_off_opening"),
        },
        max_output_tokens: 1300,
        store: false,
      },
    );
    const parsed = spinOffDraftSchema.parse(response.output_parsed);
    await logGeneration({
      universeId: session.universe_id,
      operation: "story_turn",
      provider: "openai",
      model: STORY_MODEL,
      status: "generated",
      latencyMs: Date.now() - started,
      usedFallback: false,
    });
    return parsed;
  } catch {
    return fallback;
  }
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const client = openAIClient();
  if (!client) {
    throw new ApiError(
      503,
      "OPENAI_NOT_CONFIGURED",
      "OpenAI speech is not configured.",
      true,
    );
  }
  const started = Date.now();
  const audio = await client.audio.speech.create(
    {
      model: SPEECH_MODEL,
      voice: "marin",
      input: text.slice(0, 4000),
      instructions:
        "Perform as an intimate cinematic audio-story narrator. Clear, restrained, and emotionally grounded.",
      response_format: "mp3",
    },
  );
  await logGeneration({
    operation: "speech",
    provider: "openai",
    model: SPEECH_MODEL,
    status: "generated",
    latencyMs: Date.now() - started,
    usedFallback: false,
  });
  return audio.arrayBuffer();
}

function openAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || process.env.OPENAI_FIXTURE_MODE === "true") return null;
  return new OpenAI({
    apiKey,
    // Quality over latency: a slow response is still a good scene, but an
    // aborted one is always a template fallback. Well beyond any real call.
    timeout: 30 * 60 * 1000,
    maxRetries: 4,
  });
}

async function moderateCreativeInput(
  client: OpenAI,
  values: string[],
): Promise<void> {
  const input = values.map((value) => value.trim()).filter(Boolean).join("\n");
  if (!input) return;
  try {
    const result = await client.moderations.create({
      model: MODERATION_MODEL,
      input,
    });
    if (result.results[0]?.flagged) {
      throw new ApiError(
        400,
        "CONTENT_BLOCKED",
        "Please revise the setup before creating this world.",
      );
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Generation remains protected by the model's own safety behavior if
    // moderation is temporarily unavailable.
  }
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 240);
  return "OpenAI generation was unavailable.";
}
