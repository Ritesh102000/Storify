const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

const TRANSCRIPTION_MIME_TYPES = new Set([
  "audio/flac",
  "audio/m4a",
  "audio/mp3",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
  "video/mp4",
]);

const TRANSCRIPTION_EXTENSIONS = new Set([
  "flac",
  "m4a",
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "ogg",
  "wav",
  "webm",
]);

export function chooseRecorderMimeType(
  isTypeSupported: ((mimeType: string) => boolean) | undefined,
): string | undefined {
  if (!isTypeSupported) return undefined;
  return RECORDER_MIME_CANDIDATES.find((mimeType) => {
    try {
      return isTypeSupported(mimeType);
    } catch {
      return false;
    }
  });
}

export function audioExtension(mimeType: string): string {
  const base = baseMimeType(mimeType);
  if (base.includes("webm")) return "webm";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("wav")) return "wav";
  if (base.includes("mpeg") || base.includes("mp3")) return "mp3";
  if (base.includes("m4a") || base.includes("mp4")) return "m4a";
  if (base.includes("flac")) return "flac";
  return "webm";
}

export function isSupportedTranscriptionFile(input: {
  name: string;
  type: string;
}): boolean {
  const mimeType = baseMimeType(input.type);
  if (mimeType && TRANSCRIPTION_MIME_TYPES.has(mimeType)) return true;
  const extension = input.name.toLowerCase().split(".").pop() ?? "";
  return TRANSCRIPTION_EXTENSIONS.has(extension);
}

export function baseMimeType(mimeType: string): string {
  return mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
}
