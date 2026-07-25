import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("server-renders the Pocket Multiverse test interface", async () => {
  const [layout, component] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/demo-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /title:\s*"Pocket Multiverse"/);
  assert.match(component, /Living audio stories/);
  assert.match(component, /Start a world/);
  assert.match(component, /OpenAI \+ deterministic state/);
  assert.doesNotMatch(`${layout}\n${component}`, /OPENAI_API_KEY|sk-proj-/);
  assert.doesNotMatch(`${layout}\n${component}`, /Codex is building|codex-preview/);
});

test("keeps the simple UI separate from the story engine", async () => {
  const [page, component, openaiAdapter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/demo-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/openai.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<DemoApp \/>/);
  assert.match(component, /Generate world preview/);
  assert.match(component, /Permanent consequence/);
  assert.match(component, /Living characters/);
  assert.match(component, /Context trace/);
  assert.match(component, /Start their spin-off/);
  assert.match(openaiAdapter, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(component, /OPENAI_API_KEY|sk-proj-/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/", import.meta.url)),
  );
});
