import assert from "node:assert/strict";
import test from "node:test";
import {
  audioExtension,
  chooseRecorderMimeType,
  isSupportedTranscriptionFile,
} from "../lib/forge/audio";
import { CHARACTER_BUILDER_INSTRUCTIONS } from "../lib/forge/prompts";
import { createCharacterSchema } from "../lib/forge/schemas";

test("standalone character creation requires no story binding", () => {
  const parsed = createCharacterSchema.parse({
    origin: "interviewed",
    answers: {
      seed: "A patient teacher who cannot forgive their own first failure.",
    },
  });
  assert.equal(parsed.story_id, undefined);
  assert.equal(parsed.answers.seed?.startsWith("A patient teacher"), true);
  assert.match(CHARACTER_BUILDER_INSTRUCTIONS, /standalone person/i);
  assert.match(CHARACTER_BUILDER_INSTRUCTIONS, /outside any one scene or plot/i);
});

test("recorder format selection supports Safari MP4 when WebM is unavailable", () => {
  const selected = chooseRecorderMimeType((mimeType) =>
    mimeType.startsWith("audio/mp4"),
  );
  assert.equal(selected, "audio/mp4;codecs=mp4a.40.2");
  assert.equal(audioExtension(selected ?? ""), "m4a");
  assert.equal(
    isSupportedTranscriptionFile({
      name: "clip.m4a",
      type: "audio/mp4;codecs=mp4a.40.2",
    }),
    true,
  );
});

test("recorder format selection keeps Opus WebM on supporting browsers", () => {
  const selected = chooseRecorderMimeType(() => true);
  assert.equal(selected, "audio/webm;codecs=opus");
  assert.equal(audioExtension(selected ?? ""), "webm");
});

test("transcription upload validation rejects unrelated files", () => {
  assert.equal(
    isSupportedTranscriptionFile({
      name: "notes.txt",
      type: "text/plain",
    }),
    false,
  );
  assert.equal(
    isSupportedTranscriptionFile({
      name: "voice.ogg",
      type: "",
    }),
    true,
  );
});
