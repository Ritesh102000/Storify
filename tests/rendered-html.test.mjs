import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("server-renders the AI Storify GameField interface", async () => {
  const [layout, gamefield, story, forge] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gamefield.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/demo-app.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/forge/character-forge.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(layout, /title:\s*"AI Storify GameField"/);
  assert.match(gamefield, /Somewhere you keep/);
  assert.match(gamefield, /Living Stories/);
  assert.match(gamefield, /Character Forge/);
  assert.match(gamefield, /Audio Story Engine/);
  assert.match(gamefield, /https:\/\/story-cue-studio\.vercel\.app\//);
  assert.match(gamefield, /target="_blank"/);
  assert.match(story, /Start a world/);
  assert.match(forge, /Your characters/);
  assert.doesNotMatch(
    `${layout}\n${gamefield}\n${story}\n${forge}`,
    /OPENAI_API_KEY|sk-proj-/,
  );
  assert.doesNotMatch(
    `${layout}\n${gamefield}\n${story}\n${forge}`,
    /Codex is building|codex-preview/,
  );
});

test("keeps the GameField modules separate from the story engine", async () => {
  const [page, gamefield, story, forge, openaiAdapter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/gamefield.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/demo-app.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/forge/character-forge.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/server/openai.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<GameField \/>/);
  assert.match(gamefield, /<DemoApp \/>/);
  assert.match(gamefield, /<CharacterForge \/>/);
  assert.match(story, /Generate world preview/);
  assert.match(story, /Permanent consequence/);
  assert.match(story, /Living characters/);
  assert.match(story, /Context trace/);
  assert.match(story, /Start their spin-off/);
  assert.match(forge, /\/api\/forge\/characters/);
  assert.match(forge, /Independent character/);
  assert.match(openaiAdapter, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(`${gamefield}\n${story}\n${forge}`, /OPENAI_API_KEY|sk-proj-/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/", import.meta.url)),
  );
});

test("exposes AI Detective as a native server-backed GameField module", async () => {
  const [gamefield, detective] = await Promise.all([
    readFile(new URL("../components/gamefield.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../components/detective/ai-detective.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(gamefield, /<AiDetective \/>/);
  assert.match(detective, /Truth does not volunteer/);
  assert.match(detective, /\/api\/detective\/cases/);
  assert.doesNotMatch(`${gamefield}\n${detective}`, /OPENAI_API_KEY|sk-proj-/);
});

test("uses the Story Cue Studio palette across every GameField module", async () => {
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /--gf-void:\s*#161615/);
  assert.match(styles, /--gf-surface:\s*#211f1d/);
  assert.match(styles, /--gf-text:\s*#f7f2e9/);
  assert.match(styles, /--gf-dim:\s*#a69e92/);
  assert.match(styles, /--gf-line:\s*#3b3834/);
  assert.match(styles, /--gf-violet:\s*#d9ff4a/);
  assert.match(styles, /--gf-amber:\s*#ff7448/);
  assert.match(styles, /--gf-jade:\s*#9ac4ff/);
  assert.doesNotMatch(styles, /--gf-violet:\s*#8b7bff/);
});
