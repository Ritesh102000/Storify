import { portraitRequestSchema } from "@/lib/forge/schemas";
import {
  ForgeError,
  generatePortrait,
  moderateImage,
  readReference,
} from "@/lib/forge/openai";
import {
  getCharacter,
  getPortrait,
  markPortraitStyle,
  savePortrait,
} from "@/lib/forge/store";
import { forgeError, notFound } from "@/lib/forge/api";

type Ctx = { params: Promise<{ characterId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { characterId } = await context.params;
    const portrait = await getPortrait(characterId);
    if (!portrait) return notFound();
    const bytes = Uint8Array.from(atob(portrait.base64), (c) => c.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        "Content-Type": portrait.mediaType,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const { characterId } = await context.params;
    const character = await getCharacter(characterId);
    if (!character) return notFound();
    const input = portraitRequestSchema.parse(await request.json().catch(() => ({})));

    let referenceNote: string | undefined;
    let referenceImageBase64: string | undefined;
    if (input.reference_image_base64) {
      // A reference is only accepted with explicit consent, is screened before
      // use, and is never written to storage — it lives for this request only.
      if (!input.consent_confirmed) {
        throw new ForgeError(
          400,
          "CONSENT_REQUIRED",
          "Confirm you have the right to use this image before continuing.",
        );
      }
      await moderateImage(input.reference_image_base64);
      if (input.reference_mode === "look" || input.subject_type === "self") {
        // "look" and "self" use the actual request-scoped image with the Image
        // Edit API. The bytes are never stored.
        referenceImageBase64 = input.reference_image_base64;
      } else {
        // A style reference contributes palette/light direction only, not a
        // likeness, so a text description is the narrower operation.
        referenceNote = await readReference(
          input.reference_image_base64,
          input.reference_mode,
        );
      }
    }

    const portrait = await generatePortrait({
      name: character.name,
      role: character.role,
      appearance: character.appearance,
      style: character.portrait_style,
      referenceNote,
      referenceImageBase64,
      subjectType: input.subject_type,
    });
    await savePortrait({
      characterId,
      mediaType: portrait.mediaType,
      base64: portrait.base64,
    });
    const nextOrigin =
      input.subject_type === "self" && input.reference_image_base64
        ? "self"
        : input.reference_mode === "look" && input.reference_image_base64
          ? "reference"
          : character.origin;
    const updated = await markPortraitStyle(
      { ...character, origin: nextOrigin },
      character.portrait_style,
    );
    return Response.json({ character: updated });
  } catch (error) {
    return forgeError(error);
  }
}
