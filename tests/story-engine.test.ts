import assert from "node:assert/strict";
import test from "node:test";
import { commitChoice, CommandError } from "@/lib/domain/commands";
import {
  commitFallbackSimulation,
  fallbackStoryTurn,
} from "@/lib/domain/fallbacks";
import {
  appendStoryTurn,
  continueWorldArc,
  materializeWorld,
  prepareArcForTurn,
  toWorldView,
  validateStoryTurnReferences,
} from "@/lib/domain/state";
import { STARTER_WORLDS } from "@/lib/fixtures";
import {
  LOCAL_CRAFT_CARDS,
  SOURCE_MANIFEST,
  localCraftSearch,
} from "@/lib/rag/corpus";
import type { WorldPreview, WorldSession } from "@/lib/types";
import { dryRunBeat } from "@/lib/simulation/registry";
import type { BeatCandidate } from "@/lib/simulation/types";

function world(templateId: keyof typeof STARTER_WORLDS = "monsoon_house") {
  const preview: WorldPreview = {
    preview_id: "preview_test",
    requested_template_id: templateId,
    resolved_template_id: templateId,
    seed: structuredClone(STARTER_WORLDS[templateId]),
    creative_diffs: [],
    creativity: "balanced" as const,
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
  assert.equal(pursue.session.state.active_objective.status, "active");
  assert.equal(confront.session.state.unlocked_fact_ids.length, 0);
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
  const openingLocation = base.scenes[0].location;
  const protect = base.choices.find((choice) => choice.axis === "protect")!;
  const committed = commitChoice(base, protect.choice_id);
  // Assert against the world's own scene rather than a literal, so renaming a
  // starter world cannot make this test stale.
  assert.equal(committed.event.source_location, openingLocation);
  assert.ok(
    committed.session.memories.every((memory) =>
      memory.text.includes(openingLocation),
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
  const dialogueIndexes = draft.story_blocks
    .map((block, index) => (block.block_type === "dialogue" ? index : -1))
    .filter((index) => index >= 0);
  assert.ok(
    dialogueIndexes.every(
      (index) =>
        draft.story_blocks[index - 1]?.block_type === "narration" &&
        draft.story_blocks[index + 1]?.block_type === "narration",
    ),
  );
});

test("simulator dry-runs legal entity, time, fact, and thread changes", () => {
  const base = world("blackmoor");
  const choice = base.choices.find((item) => item.axis === "protect")!;
  const committed = commitChoice(base, choice.choice_id);
  const candidate = legalBeat(committed.event.event_id);
  const result = dryRunBeat(
    committed.session.simulation,
    committed.event,
    candidate,
  );
  assert.equal(result.valid, true);
  if (!result.valid) return;
  assert.equal(result.next_state.clock.elapsed_minutes, 2);
  assert.match(result.commit.effects[0].description, /^2 minutes pass /);
  assert.equal(
    Object.values(result.next_state.facts).filter(
      (fact) => fact.source_event_id === committed.event.event_id,
    ).length,
    1,
  );
  assert.equal(
    result.next_state.threads.thread_central.evidence_fact_ids.length,
    1,
  );
  assert.ok(result.commit.resolved_refs.clue_object);
});

test("simulator rejects impossible movement and absent character staging", () => {
  const base = world("blackmoor");
  const choice = base.choices.find((item) => item.axis === "protect")!;
  const committed = commitChoice(base, choice.choice_id);
  const candidate = legalBeat(committed.event.event_id);
  candidate.end_location_ref = "location_that_does_not_exist";
  candidate.character_pressure[1].character_id = "char_keeper";
  const result = dryRunBeat(
    committed.session.simulation,
    committed.event,
    candidate,
  );
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.match(result.errors.join(" "), /unknown|not physically present/i);
});

test("local prose fallback commits the same fact to authoritative simulation", () => {
  const base = world("monsoon_house");
  const choice = base.choices.find((item) => item.axis === "pursue")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  const factsBefore = Object.keys(committed.session.simulation.facts).length;
  commitFallbackSimulation(committed.session, committed.event, draft);
  assert.equal(
    Object.keys(committed.session.simulation.facts).length,
    factsBefore + 1,
  );
  assert.equal(committed.session.simulation.clock.elapsed_minutes, 1);
  assert.equal(committed.session.simulation_events.length, 1);
  assert.equal(
    Object.values(committed.session.simulation.facts).some(
      (fact) => fact.statement === draft.new_information,
    ),
    true,
  );
  assert.equal(draft.thread_resolved, null);
});

test("minor narration length drift is repaired without replacing the scene", () => {
  const base = world("blackmoor");
  const choice = base.choices.find((item) => item.axis === "protect")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  draft.narration = Array.from({ length: 100 }, (_, index) => `detail${index}`).join(
    " ",
  );
  const normalized = validateStoryTurnReferences(committed.session, draft);
  assert.equal(normalized.narration.split(/\s+/).length, 100);
  assert.match(
    committed.session.last_context_trace?.quality_warnings.join(" ") ?? "",
    /^$/,
  );
});

test("reader-facing engine scaffolding is rejected", () => {
  const base = world("blackmoor");
  const choice = base.choices.find((item) => item.axis === "protect")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  draft.narration = `${draft.narration} The current objective remains unclear.`;
  assert.throws(
    () => validateStoryTurnReferences(committed.session, draft),
    /scaffolding/i,
  );
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

function legalBeat(eventId: string): BeatCandidate {
  return {
    candidate_id: `candidate_${eventId}`,
    storylet_id: "blackmoor_answering_whistle",
    because_of_choice: "The rescue creates two minutes in which the signaler moves.",
    dramatic_question: "Who answered from the sealed room?",
    chosen_action_result: "Arin reaches stable ground.",
    cost_paid: "The signaler gains time to hide the route token.",
    scene_premise:
      "At Blackmoor Gatehouse, Arin and Vex inspect the chain exposed by the rescue before the signaler can return.",
    continuity_bridge:
      "As Arin steps off the pulled chain, a broken brass whistle drops from beneath its last link.",
    action_sequence: [
      {
        actor_ref: "char_ally",
        physical_action: "Arin lifts the broken whistle by its leather cord.",
        observable_result: "Fresh yellow metal shows through the soot on its cut edge.",
      },
      {
        actor_ref: "char_rival",
        physical_action: "Vex turns the whistle toward the gatehouse brazier.",
        observable_result: "The cut gleams while the older surfaces remain smoke-black.",
      },
      {
        actor_ref: "char_ally",
        physical_action: "Arin fits the two broken edges together.",
        observable_result: "The break aligns cleanly instead of showing heat damage.",
      },
      {
        actor_ref: "char_rival",
        physical_action: "Vex pockets the leather cord but leaves the whistle visible.",
        observable_result: "Arin sees Vex trying to control who can carry the evidence.",
      },
    ],
    evidence_delivery:
      "Arin and Vex inspect the bright cut against the smoke-black brass and infer that someone cut the whistle after the fire started.",
    closing_pressure:
      "A matching whistle answers from the sealed stair before its signaler can leave.",
    start_location_ref: "location_opening",
    end_location_ref: "location_opening",
    character_pressure: [
      {
        character_id: "char_ally",
        want_in_scene: "Trace the signal.",
        conflict_with: "Vex wants to control the route.",
      },
      {
        character_id: "char_rival",
        want_in_scene: "Secure the whistle.",
        conflict_with: "Arin wants to warn the island.",
      },
    ],
    commands: [
      {
        command_type: "advance_time",
        actor_ref: null,
        target_ref: null,
        new_ref: null,
        entity_kind: null,
        name: null,
        description: null,
        string_value: null,
        number_value: 2,
        boolean_value: null,
        fact_statement: null,
        evidence: [],
        known_by_refs: [],
        reason: "Arin must be pulled clear of the flood channel.",
      },
      {
        command_type: "introduce_entity",
        actor_ref: null,
        target_ref: "location_opening",
        new_ref: "clue_object",
        entity_kind: "object",
        name: "broken signal whistle",
        description: "A brass whistle with a fresh Crownless cut mark.",
        string_value: "intact",
        number_value: null,
        boolean_value: true,
        fact_statement: null,
        evidence: [],
        known_by_refs: [],
        reason: "The rescue exposes what was trapped beneath the chain.",
      },
      {
        command_type: "establish_fact",
        actor_ref: null,
        target_ref: null,
        new_ref: "signal_fact",
        entity_kind: null,
        name: null,
        description: null,
        string_value: "true",
        number_value: null,
        boolean_value: null,
        fact_statement: "The whistle was cut after the gatehouse fire began.",
        evidence: ["The cut is bright while the surrounding brass is smoke-blackened."],
        known_by_refs: ["char_ally", "char_rival"],
        reason: "Both present characters inspect the same physical mark.",
      },
      {
        command_type: "update_thread",
        actor_ref: "signal_fact",
        target_ref: "thread_central",
        new_ref: null,
        entity_kind: null,
        name: null,
        description: null,
        string_value: "add_evidence",
        number_value: null,
        boolean_value: null,
        fact_statement: null,
        evidence: [],
        known_by_refs: [],
        reason: "The cut timing connects the fire to the gate conspiracy.",
      },
    ],
    information_used_fact_ids: [],
    milestone_action: "continue",
    milestone_completion_evidence: null,
  };
}

test("a carried object travels with the character holding it", () => {
  const base = world("blackmoor");
  const choice = base.choices.find((item) => item.axis === "protect")!;
  const committed = commitChoice(base, choice.choice_id);
  const state = committed.session.simulation;
  const objective = state.entities.object_active_objective;
  assert.equal(objective.location_id, "location_opening");

  const candidate = legalBeat(committed.event.event_id);
  candidate.end_location_ref = "location_lower_gate";
  candidate.commands = [
    command({ command_type: "advance_time", number_value: 6 }),
    command({
      command_type: "introduce_entity",
      new_ref: "location_lower_gate",
      entity_kind: "location",
      name: "Lower Gate",
      description: "The flooded gate below the gatehouse.",
    }),
    command({
      command_type: "set_possession",
      target_ref: "object_active_objective",
      actor_ref: "char_ally",
    }),
    command({
      command_type: "move_entity",
      target_ref: "char_ally",
      string_value: "location_lower_gate",
      number_value: 6,
    }),
    command({
      command_type: "move_entity",
      target_ref: "char_rival",
      string_value: "location_lower_gate",
      number_value: 6,
    }),
    command({
      command_type: "establish_fact",
      new_ref: "clue_object",
      fact_statement: "The lower gate was opened from inside.",
      evidence: ["Fresh tool marks on the inner bar."],
      known_by_refs: ["char_ally", "char_rival"],
    }),
  ];
  const result = dryRunBeat(state, committed.event, candidate);
  assert.equal(result.valid, true, JSON.stringify(result));
  if (!result.valid) return;

  const movedObjective = result.next_state.entities.object_active_objective;
  const gateId = result.commit.resolved_refs.location_lower_gate;
  assert.equal(
    movedObjective.location_id,
    gateId,
    "a held object must follow its carrier instead of being stranded",
  );
  assert.equal(movedObjective.carried_by, "char_ally");
  assert.match(
    result.commit.effects.map((effect) => effect.description).join(" "),
    /carrying/,
  );
});

test("an object cannot be picked up from another room", () => {
  const base = world("blackmoor");
  const choice = base.choices.find((item) => item.axis === "protect")!;
  const committed = commitChoice(base, choice.choice_id);
  const candidate = legalBeat(committed.event.event_id);
  candidate.commands = [
    command({ command_type: "advance_time", number_value: 2 }),
    command({
      command_type: "set_possession",
      target_ref: "object_active_objective",
      actor_ref: "char_keeper",
    }),
    command({
      command_type: "establish_fact",
      new_ref: "clue_object",
      fact_statement: "Someone reached the bar first.",
      evidence: ["A wet handprint."],
      known_by_refs: ["char_ally"],
    }),
  ];
  const result = dryRunBeat(
    committed.session.simulation,
    committed.event,
    candidate,
  );
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.match(result.errors.join(" "), /not in the same place/i);
});

test("a verbose generated storylet deck still yields a renderable fallback", () => {
  const base = world("monsoon_house");
  // AI-authored decks use paragraph-length fields; the fixture deck does not,
  // which is why an over-long fallback narration reached production unnoticed.
  base.storylet_deck = base.storylet_deck.map((storylet) => ({
    ...storylet,
    situation: `${storylet.situation} ${"The rain keeps rewriting what the room admits to. ".repeat(6)}`,
    concrete_affordance: `${storylet.concrete_affordance} ${"The listener can weigh each surviving fragment against the ledger. ".repeat(5)}`,
    pressure: `${storylet.pressure} ${"Water is already past the lower stair. ".repeat(5)}`,
    character_conflict: `${storylet.character_conflict} ${"Neither will concede the other's reading of it. ".repeat(5)}`,
  }));
  const choice = base.choices.find((item) => item.axis === "pursue")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  commitFallbackSimulation(committed.session, committed.event, draft);
  const normalized = validateStoryTurnReferences(committed.session, draft);
  const words = normalized.narration.trim().split(/\s+/).length;
  assert.ok(words <= 280, `fallback narration ran to ${words} words`);
  assert.doesNotMatch(
    [normalized.narration, normalized.scene_goal].join(" "),
    /the listener/i,
    "design-voice phrasing must be rewritten before it reaches the reader",
  );
});

test("repeated fallbacks in one arc do not reprint the same exchange", () => {
  const base = world("monsoon_house");
  const choice = base.choices.find((item) => item.axis === "pursue")!;
  const first = commitChoice(base, choice.choice_id);
  prepareArcForTurn(first.session);
  const draftOne = fallbackStoryTurn(first.session, first.event);

  const later = structuredClone(first.session);
  later.state.turn_index += 1;
  const draftTwo = fallbackStoryTurn(later, first.event);

  assert.notDeepEqual(
    draftOne.dialogue.map((line) => line.text),
    draftTwo.dialogue.map((line) => line.text),
    "consecutive fallbacks must not use identical dialogue",
  );
});

test("a milestone at its scene ceiling can complete without a fresh discovery", () => {
  const base = world("monsoon_house");
  const choice = base.choices.find((item) => item.axis === "pursue")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const milestone =
    committed.session.arc_state.milestones[
      committed.session.arc_state.active_milestone_index
    ];
  milestone.scene_count = milestone.maximum_scenes - 1;
  milestone.unique_discovery_count = 0;

  const draft = fallbackStoryTurn(committed.session, committed.event);
  commitFallbackSimulation(committed.session, committed.event, draft);
  // Every discovery so far was rejected as a repeat, so none is available.
  draft.new_information = null;
  draft.milestone_action = "complete";
  draft.milestone_completion_evidence =
    "The group holds a corroborated physical lead and an agreed next action.";

  const updated = appendStoryTurn(committed.session, committed.event, draft);
  assert.equal(
    updated.arc_state.milestones[0].status === "completed" ||
      updated.arc_state.active_milestone_index > 0,
    true,
    "an arc must not deadlock past its scene ceiling",
  );
});

function command(
  overrides: Partial<BeatCandidate["commands"][number]>,
): BeatCandidate["commands"][number] {
  return {
    command_type: "advance_time",
    actor_ref: null,
    target_ref: null,
    new_ref: null,
    entity_kind: null,
    name: null,
    description: null,
    string_value: null,
    number_value: null,
    boolean_value: null,
    fact_statement: null,
    evidence: [],
    known_by_refs: [],
    reason: "test",
    ...overrides,
  };
}

test("a long but well-formed scene is kept rather than discarded", () => {
  const base = world("monsoon_house");
  const choice = base.choices.find((item) => item.axis === "pursue")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  commitFallbackSimulation(committed.session, committed.event, draft);

  // The renderer reliably writes 250-370 words. Rejecting those cost whole
  // scenes and dropped the listener to a template.
  const filler = "Rain moves along the gutter and drips onto the step below. ";
  const long = `${draft.narration} ${filler.repeat(22)}`.trim();
  const wordCount = long.split(/\s+/).length;
  assert.ok(wordCount > 280 && wordCount < 460, `probe was ${wordCount} words`);

  const normalized = validateStoryTurnReferences(committed.session, {
    ...draft,
    narration: long,
  });
  assert.ok(normalized.narration.length > 0);
});

test("a silently substituted choice is reported as a warning", () => {
  const base = world("monsoon_house");
  const choice = base.choices.find((item) => item.axis === "pursue")!;
  const committed = commitChoice(base, choice.choice_id);
  prepareArcForTurn(committed.session);
  const draft = fallbackStoryTurn(committed.session, committed.event);
  commitFallbackSimulation(committed.session, committed.event, draft);
  committed.session.last_context_trace = {
    quality_warnings: [],
  } as unknown as NonNullable<WorldSession["last_context_trace"]>;

  validateStoryTurnReferences(committed.session, {
    ...draft,
    choice_proposals: draft.choice_proposals.filter(
      (proposal) => proposal.axis !== "confront",
    ),
  });

  assert.ok(
    committed.session.last_context_trace!.quality_warnings.some((warning) =>
      /confront choice was missing/i.test(warning),
    ),
    "a replaced choice must not degrade the scene silently",
  );
});
