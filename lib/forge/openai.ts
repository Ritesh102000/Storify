import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  APPEARANCE_FROM_REFERENCE_INSTRUCTIONS,
  CHARACTER_BUILDER_INSTRUCTIONS,
  buildPortraitPrompt,
  buildReferencePortraitPrompt,
} from "./prompts";
import { characterDraftSchema, type CharacterDraftOutput } from "./schemas";
import {
  PORTRAIT_STYLE_CLAUSES,
  type ForgeStorySummary,
  type InterviewAnswers,
  type Origin,
  type PortraitStyle,
} from "./types";

// Forge picks its own models. The story engine's OPENAI_*_MODEL values were
// chosen from measured benchmarks and must not be reused or changed here.
const TEXT_MODEL = process.env.FORGE_TEXT_MODEL || "gpt-5.6-luna";
const VISION_MODEL = process.env.FORGE_VISION_MODEL || "gpt-5.6-luna";
const IMAGE_MODEL = process.env.FORGE_IMAGE_MODEL || "gpt-image-2";
const TRANSCRIBE_MODEL =
  process.env.FORGE_TRANSCRIBE_MODEL || "gpt-4o-transcribe";
const MODERATION_MODEL = "omni-moderation-latest";

export class ForgeError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ForgeError";
  }
}

function client(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new ForgeError(503, "OPENAI_NOT_CONFIGURED", "OpenAI is not configured.");
  }
  // Portraits legitimately take about a minute; a timeout here would throw away
  // work the user already waited for.
  return new OpenAI({ apiKey, timeout: 30 * 60 * 1000, maxRetries: 3 });
}

export async function moderateText(values: string[]): Promise<void> {
  const input = values.map((value) => value.trim()).filter(Boolean).join("\n");
  if (!input) return;
  try {
    const result = await client().moderations.create({
      model: MODERATION_MODEL,
      input,
    });
    if (result.results[0]?.flagged) {
      throw new ForgeError(
        400,
        "CONTENT_BLOCKED",
        "Please revise this description before continuing.",
      );
    }
  } catch (error) {
    if (error instanceof ForgeError) throw error;
    // Generation stays protected by the model's own safety behaviour if the
    // moderation endpoint is briefly unavailable.
  }
}

export async function moderateImage(base64: string): Promise<void> {
  try {
    const result = await client().moderations.create({
      model: MODERATION_MODEL,
      input: [
        { type: "image_url", image_url: { url: asDataUrl(base64) } },
      ] as never,
    });
    if (result.results[0]?.flagged) {
      throw new ForgeError(
        400,
        "IMAGE_BLOCKED",
        "That reference image can't be used. Try a different one.",
      );
    }
  } catch (error) {
    if (error instanceof ForgeError) throw error;
  }
}

export async function draftCharacter(
  answers: InterviewAnswers,
  options?: {
    origin?: Extract<Origin, "interviewed" | "self">;
    story?: ForgeStorySummary;
  },
): Promise<CharacterDraftOutput> {
  const response = await client().responses.parse({
    model: TEXT_MODEL,
    reasoning: { effort: "medium" },
    instructions: CHARACTER_BUILDER_INSTRUCTIONS,
    input: JSON.stringify({
      answers_so_far: answers,
      creation_origin: options?.origin ?? "interviewed",
      character_scope: options?.story ? "story_shaped" : "standalone",
      story_context: options?.story
        ? {
            title: options.story.title,
            template_id: options.story.template_id,
            genre: options.story.genre,
            premise: options.story.premise,
            mood: options.story.mood,
            listener_role: options.story.listener_role,
            main_goal: options.story.main_goal,
            central_question: options.story.central_question,
          }
        : null,
      note: options?.story
        ? "Fields the user did not answer must be invented coherently within the optional world context."
        : "Fields the user did not answer must form an enduring, portable identity rather than a role in a temporary scene.",
    }),
    text: { format: zodTextFormat(characterDraftSchema, "character") },
    max_output_tokens: 6000,
    store: false,
  });
  if (!response.output_parsed) {
    throw new ForgeError(
      502,
      "CHARACTER_NOT_GENERATED",
      `The character could not be drafted (status=${response.status}).`,
    );
  }
  return characterDraftSchema.parse(response.output_parsed);
}

/**
 * Reads a reference image for portrait direction only. Never identifies anyone —
 * the instructions forbid it and we request nothing that could.
 */
export async function readReference(
  base64: string,
  mode: "style" | "look",
): Promise<string> {
  const response = await client().responses.create({
    model: VISION_MODEL,
    instructions: APPEARANCE_FROM_REFERENCE_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Reference mode: ${mode}. Describe accordingly, in under 60 words.`,
          },
          { type: "input_image", image_url: asDataUrl(base64), detail: "low" },
        ],
      },
    ] as never,
    max_output_tokens: 2000,
    store: false,
  });
  return (response.output_text || "").trim().slice(0, 400);
}

export async function generatePortrait(input: {
  name: string;
  role: string;
  appearance: CharacterDraftOutput["appearance"];
  style: PortraitStyle;
  referenceNote?: string;
  referenceImageBase64?: string;
  subjectType?: "character" | "self";
}): Promise<{ base64: string; mediaType: string }> {
  const styleClause = PORTRAIT_STYLE_CLAUSES[input.style];
  const result = input.referenceImageBase64
    ? await editReferencePortrait({
        role: input.role,
        appearance: input.appearance,
        styleClause,
        referenceImageBase64: input.referenceImageBase64,
        isSelf: input.subjectType === "self",
      })
    : await client().images.generate({
        model: IMAGE_MODEL,
        prompt: buildPortraitPrompt({
          name: input.name,
          role: input.role,
          appearance: input.appearance,
          styleClause,
          referenceNote: input.referenceNote,
        }),
        size: "1024x1024",
        quality: "medium",
        n: 1,
        output_format: "webp",
        output_compression: 70,
      });

  const base64 = result.data?.[0]?.b64_json;
  if (!base64) {
    throw new ForgeError(502, "PORTRAIT_FAILED", "The portrait could not be generated.");
  }
  return { base64, mediaType: "image/webp" };
}

async function editReferencePortrait(input: {
  role: string;
  appearance: CharacterDraftOutput["appearance"];
  styleClause: string;
  referenceImageBase64: string;
  isSelf: boolean;
}) {
  const decoded = decodeImage(input.referenceImageBase64);
  const reference = await toFile(
    decoded.bytes,
    `portrait-reference.${extensionFor(decoded.mediaType)}`,
    {
      type: decoded.mediaType,
    },
  );

  // gpt-image-2 processes reference inputs at high fidelity automatically, so
  // input_fidelity is intentionally omitted.
  return client().images.edit({
    model: IMAGE_MODEL,
    image: reference,
    prompt: buildReferencePortraitPrompt({
      role: input.role,
      dress: input.appearance.dress,
      expression: input.appearance.expression,
      styleClause: input.styleClause,
      isSelf: input.isSelf,
    }),
    size: "1024x1024",
    quality: "medium",
    n: 1,
    output_format: "webp",
    output_compression: 70,
  });
}

export async function transcribe(audio: File): Promise<string> {
  const result = await client().audio.transcriptions.create({
    model: TRANSCRIBE_MODEL,
    file: audio,
  });
  return (result.text || "").trim();
}

function asDataUrl(base64: string): string {
  return base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
}

function decodeImage(input: string): {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
} {
  const match = input.match(
    /^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-zA-Z0-9+/=\s]+)$/i,
  );
  const encoded = (match?.[2] ?? input).replace(/\s/g, "");
  const declaredType = match?.[1]?.toLowerCase();
  const mediaType =
    declaredType === "image/jpeg" || declaredType === "image/jpg"
      ? "image/jpeg"
      : declaredType === "image/webp"
        ? "image/webp"
        : "image/png";

  try {
    return {
      bytes: Uint8Array.from(atob(encoded), (character) =>
        character.charCodeAt(0),
      ),
      mediaType,
    };
  } catch {
    throw new ForgeError(
      400,
      "INVALID_REFERENCE_IMAGE",
      "That image could not be read. Use a PNG, JPEG, or WebP image.",
    );
  }
}

function extensionFor(mediaType: "image/png" | "image/jpeg" | "image/webp") {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/webp") return "webp";
  return "png";
}
