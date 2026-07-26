import { transcribe } from "@/lib/forge/openai";
import { forgeError } from "@/lib/forge/api";
import { isSupportedTranscriptionFile } from "@/lib/forge/audio";

const MAX_AUDIO_BYTES = 20_000_000;

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return Response.json(
        { error: { code: "NO_AUDIO", message: "No audio was received." } },
        { status: 400 },
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return Response.json(
        {
          error: {
            code: "INVALID_AUDIO_UPLOAD",
            message: "The audio upload could not be read.",
          },
        },
        { status: 400 },
      );
    }
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return Response.json(
        { error: { code: "NO_AUDIO", message: "No audio was received." } },
        { status: 400 },
      );
    }
    if (!audio.size) {
      return Response.json(
        {
          error: {
            code: "EMPTY_AUDIO",
            message: "No audio was captured. Record for a moment, then stop.",
          },
        },
        { status: 400 },
      );
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json(
        {
          error: {
            code: "AUDIO_TOO_LARGE",
            message: "That recording is too large. Keep it under one minute.",
          },
        },
        { status: 413 },
      );
    }
    if (
      !isSupportedTranscriptionFile({
        name: audio.name,
        type: audio.type,
      })
    ) {
      return Response.json(
        {
          error: {
            code: "UNSUPPORTED_AUDIO",
            message:
              "This browser produced an unsupported audio format. Try Safari, Chrome, or Edge again.",
          },
        },
        { status: 415 },
      );
    }

    const text = (await transcribe(audio)).trim();
    if (!text) {
      return Response.json(
        {
          error: {
            code: "NO_SPEECH",
            message: "No speech was detected. Try again and speak a little longer.",
          },
        },
        { status: 422 },
      );
    }
    return Response.json({ text });
  } catch (error) {
    return forgeError(error);
  }
}
