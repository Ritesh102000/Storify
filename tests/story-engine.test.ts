import assert from "node:assert/strict";
import test from "node:test";
import { commitChoice, CommandError } from "@/lib/domain/commands";
import { fallbackStoryTurn } from "@/lib/domain/fallbacks";
import {
  appendStoryTurn,
  continueWorldArc,
  materializeWorld,
  prepareArcForTurn,
  toWorldView,
} from "@/lib/domain/state";
import { STARTER_WORLDS } from "@/lib/fixtures";
import {
  LOCAL_CRAFT_CARDS,
  SOURCE_MANIFEST,
  localCraftSearch,
} from "@/lib/rag/corpus";
import type { WorldPreview, WorldSession } from "@/lib/types";

function world(templateId: keyof typeof STARTER_WORLDS = "monsoon_house") {
  const preview: WorldPreview = {
    preview_id: "preview_test",
    requested_template_id: templateId,
    resolved_template_id: templateId,
    seed: structuredClone(STARTER_WORLDS[templateId]),
    creative_diffs: [],
    retrieval: null,
    generation: {
      status: "fixture",
      provider: "fixture",
      model: "test",
      latency_ms: 0,
      used_fallback: true,
    },
    created_at: "2026-07-25T00:00:00.000Z",
  };
  return materializeWorld(preview);
}

test("manifest has 18 pinned, rights-audited public-domain sources", () => {
  assert.equal(SOURCE_MANIFEST.length, 18);
  assert.equal(new Set(SOURCE_MANIFEST.map((item) => item.source_id)).size, 18);
  for (const source of SOURCE_MANIFEST) {
    assert.match(source.expected_sha256, /^[a-f0-9]{64}$/);
    assert.match(source.rights_basis, /public-domain/i);
    assert.match(source.territory_review, /outside the USA/i);
    assert.ok(source.author);
    assert.ok(source.publication_year < 1929);
  }
});

test("local craft corpus contains six sanitized cards per source", () => {
  assert.equal(LOCAL_CRAFT_CARDS.length, 108);
  for (const source of SOURCE_MANIFEST) {
    const cards = LOCAL_CRAFT_CARDS.filter(
      (card) => card.source_id === source.source_id,
    );
    assert.equal(cards.length, 6);
    for (const card of cards) {
      assert.equal(card.doc_type, "craft");
      assert.equal(card.template_id, source.template_id);
      assert.ok(!card.pattern.toLowerCase().includes(source.title.toLowerCase()));
      assert.ok(!card.pattern.toLowerCase().includes(source.author.toLowerCase()));
    }
  }
});

test("local retrieval filters by template and excludes recent patterns", () => {
  const first = localCraftSearch({
    templateId: "blackmoor",
    phase: "reversal",
    limit: 4,
  });
  assert.equal(first.length, 4);
  assert.ok(first.every((card) => card.template_id === "blackmoor"));
  const next = localCraftSearch({
    templateId: "blackmoor",
    phase: "reversal",
    excludeCardIds: first.map((card) => card.card_id),
    limit: 4,
  });
  assert.ok(next.every((card) => !first.some((old) => old.card_id === card.card_id)));
});

test("different axes commit different server-owned effects", () => {
  const base = world();
  const byAxis = new Map(base.choices.map((choice) => [choice.axis, choice]));
  const protect = commitChoice(base, byAxis.get("protect")!.choice_id);
  const pursue = commitChoice(base, byAxis.get("pursue")!.choice_id);
  const confront = commitChoice(base, byAxis.get("confront")!.choice_id);
  assert.notDeepEqual(protect.event.effects, pursue.event.effects);
  assert.notDeepEqual(pursue.event.effects, confront.event.effects);
  assert.match(protect.event.summary, /protected/i);
  assert.match(pursue.event.summary, /pursued/i);
  assert.match(confront.event.summary, /confronted/i);
});

test("protect and confront cannot target an absent character", () => {
  const base = world();
  const invalid = structuredClone(base);
  const protect = invalid.choices.find((choice) => choice.axis === "protect")!;
  protect.arguments.target_id = "char_keeper";
  assert.throws(
    () => commitChoice(invalid, protect.choice_id),
    (error) =>
      error instanceof CommandError &&
      error.code === "COMMAND_PRECONDITION_FAILED",
  );
});

test("events and witness memories retain the actual source scene location", () => {
  const base = world();
  const protect = base.choices.find((choice) => choice.axis === "protect")!;
  const committed = commitChoice(base, protect.choice_id);
  assert.equal(committed.event.source_location, "Monsoon House Attic");
  assert.ok(
    committed.session.memories.every((memory) =>
      memory.text.includes("Monsoon House Attic"),
    ),
  );
  const summary = committed.event.summary;
  prepareArcForTurn(committed.session);
  appendStoryTurn(
    committed.session,
    committed.event,
    fallbackStoryTurn(committed.session, committed.event),
  );
  assert.equal(committed.session.events[0].summary, summary);
});

test("a milestone does not advance without completion evidence", () => {
  const base = world();
  const choice = base.choices.find((item) => item.axis === "protect")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  assert.equal(committed.session.arc_state.active_milestone_index, 1);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  assert.equal(draft.milestone_action, "continue");
  appendStoryTurn(committed.session, committed.event, draft);
  assert.equal(committed.session.arc_state.active_milestone_index, 1);
  assert.equal(
    committed.session.arc_state.milestones[1].unique_discovery_count,
    1,
  );
});

test("server limits define an 8-15 scene arc and fallback dialogue is connected", () => {
  const base = world();
  const minimum = base.arc_state.milestones.reduce(
    (sum, milestone) => sum + milestone.minimum_scenes,
    0,
  );
  const maximum = base.arc_state.milestones.reduce(
    (sum, milestone) => sum + milestone.maximum_scenes,
    0,
  );
  assert.equal(minimum, 8);
  assert.equal(maximum, 15);
  const choice = base.choices.find((item) => item.axis === "confront")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  const words = draft.narration.trim().split(/\s+/).length;
  assert.ok(words >= 120 && words <= 200, `fallback has ${words} words`);
  assert.ok(draft.dialogue.length >= 4 && draft.dialogue.length <= 8);
  assert.equal(new Set(draft.dialogue.map((line) => line.character_id)).size, 2);
  assert.ok(draft.dialogue.slice(1).every((line) => line.responds_to_previous));
  assert.equal(new Set(draft.choice_proposals.map((item) => item.axis)).size, 3);
});

test("public world view exposes retrieval provenance but no craft prose", () => {
  const base = world();
  const viewText = JSON.stringify(toWorldView(base));
  assert.ok(!viewText.includes(LOCAL_CRAFT_CARDS[0].pattern));
  assert.ok(!viewText.includes("source text"));
});

test("continuing a resolved arc preserves prior canon and creates a new arc", () => {
  const base = world();
  const choice = base.choices.find((item) => item.axis === "pursue")!;
  const committed = commitChoice(base, choice.choice_id);
  const eventCount = committed.session.events.length;
  const memoryCount = committed.session.memories.length;
  const oldArcId = committed.session.arc_state.arc_id;
  forceResolved(committed.session);
  const continued = continueWorldArc(committed.session);
  assert.notEqual(continued.arc_state.arc_id, oldArcId);
  assert.equal(continued.arc_state.arc_number, 2);
  assert.equal(continued.events.length, eventCount);
  assert.equal(continued.memories.length, memoryCount);
  assert.equal(continued.state.goal_status, "active");
  assert.equal(continued.arc_state.status, "active");
});

function forceResolved(session: WorldSession): void {
  session.arc_state.status = "completed";
  session.state.goal_status = "completed";
  session.state.story_progress = 100;
  session.arc_state.active_milestone_index =
    session.arc_state.milestones.length - 1;
  session.arc_state.milestones.at(-1)!.status = "completed";
  session.arc_state.completed_milestone_types = session.arc_state.milestones.map(
    (milestone) => milestone.milestone_type,
  );
}
