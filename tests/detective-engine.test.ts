import assert from "node:assert/strict";
import test from "node:test";
import { createDetectiveFixture } from "../lib/detective/fixtures";
import {
  applyDetectiveAction,
  createDetectiveSession,
  prepareInterrogation,
  resolveDetectiveAccusation,
  toDetectiveCaseView,
  validateDetectiveDraft,
} from "../lib/detective/engine";
import { DetectiveError } from "../lib/detective/errors";
import type {
  DetectiveCaseSession,
  DetectiveCreateInput,
  DetectiveGenre,
} from "../lib/detective/types";

const fixtureGeneration = {
  provider: "fixture",
  model: "test-fixture",
  used_fallback: true,
} as const;

function makeSession(
  genre: DetectiveGenre = "scifi",
  overrides: Partial<DetectiveCreateInput> = {},
): DetectiveCaseSession {
  const input: DetectiveCreateInput = {
    genre,
    difficulty: "easy",
    pace: "blitz",
    ...overrides,
  };
  return createDetectiveSession(
    input,
    createDetectiveFixture(
      input.genre,
      input.difficulty,
      input.atmosphere,
    ),
    fixtureGeneration,
    `case_test_${genre}`,
  );
}

function errorCode(action: () => unknown): string {
  try {
    action();
    assert.fail("Expected a DetectiveError.");
  } catch (error) {
    assert.ok(error instanceof DetectiveError);
    return error.code;
  }
}

function solveScifi(session = makeSession("scifi")): DetectiveCaseSession {
  let current = session;
  current = applyDetectiveAction(current, {
    action_type: "inspect",
    location_id: "location_command_ring",
  });
  current = applyDetectiveAction(current, {
    action_type: "analyze",
    clue_id: "clue_sensor_echo",
  });
  current = applyDetectiveAction(current, {
    action_type: "inspect",
    location_id: "location_data_vault",
  });
  current = applyDetectiveAction(current, {
    action_type: "analyze",
    clue_id: "clue_transfer_shard",
  });
  current = applyDetectiveAction(current, {
    action_type: "inspect",
    location_id: "location_drone_bay",
  });
  current = applyDetectiveAction(current, {
    action_type: "analyze",
    clue_id: "clue_drone_residue",
  });
  current = applyDetectiveAction(current, {
    action_type: "inspect",
    location_id: "location_command_ring",
  });
  current = applyDetectiveAction(current, {
    action_type: "analyze",
    clue_id: "clue_forged_packet",
  });
  return current;
}

test("all three fixtures are valid, original, solvable case graphs", () => {
  for (const genre of ["noir", "gothic", "scifi"] as const) {
    const draft = createDetectiveFixture(genre, "medium");
    assert.doesNotThrow(() => validateDetectiveDraft(draft));
    assert.equal(draft.suspects.filter((suspect) => suspect.is_culprit).length, 1);
    assert.ok(draft.clues.some((clue) => clue.key_evidence));
    assert.ok(draft.clues.some((clue) => clue.prerequisite_clue_ids.length === 0));
  }
});

test("public case views contain no solution, private suspect truth, or locked clues", () => {
  const session = makeSession("noir");
  const serialized = JSON.stringify(toDetectiveCaseView(session));

  assert.equal(toDetectiveCaseView(session).evidence.length, 0);
  assert.doesNotMatch(
    serialized,
    /solution|is_culprit|true_alibi|secret_motive|authorized_knowledge|confession_|key_evidence|significance/,
  );
  assert.doesNotMatch(serialized, /Shell-company contract ledger|Cleaned brass line seal/);
  assert.doesNotMatch(serialized, /Voss killed Lena/);
});

test("inspection and analysis obey prerequisites without consuming invalid turns", () => {
  const initial = makeSession();
  assert.equal(
    errorCode(() =>
      applyDetectiveAction(initial, {
        action_type: "inspect",
        location_id: "location_data_vault",
      }),
    ),
    "CLUE_PREREQUISITE_MISSING",
  );
  assert.equal(initial.turn, 0);
  assert.equal(initial.clues.some((clue) => clue.discovered), false);

  const inspected = applyDetectiveAction(initial, {
    action_type: "inspect",
    location_id: "location_command_ring",
  });
  assert.equal(inspected.turn, 1);
  assert.equal(inspected.clues.find((clue) => clue.clue_id === "clue_sensor_echo")?.discovered, true);
  assert.equal(
    errorCode(() =>
      applyDetectiveAction(inspected, {
        action_type: "analyze",
        clue_id: "clue_transfer_shard",
      }),
    ),
    "CLUE_NOT_DISCOVERED",
  );

  const analyzed = applyDetectiveAction(inspected, {
    action_type: "analyze",
    clue_id: "clue_sensor_echo",
  });
  assert.equal(
    errorCode(() =>
      applyDetectiveAction(analyzed, {
        action_type: "analyze",
        clue_id: "clue_sensor_echo",
      }),
    ),
    "CLUE_ALREADY_ANALYZED",
  );
  assert.equal(analyzed.turn, 2);
});

test("the complete clue graph can be solved within the blitz turn budget", () => {
  const solved = solveScifi();
  const view = toDetectiveCaseView(solved);

  assert.equal(solved.turn, 8);
  assert.ok(solved.turn <= solved.max_turns);
  assert.equal(view.evidence.length, 4);
  assert.equal(view.evidence.every((clue) => clue.analyzed), true);
  assert.equal(
    view.locations.every((location) => location.remaining_clue_count === 0),
    true,
  );
});

test("interrogation cannot confess before the evidence and pressure gates", () => {
  const initial = makeSession();
  const premature = applyDetectiveAction(
    initial,
    {
      action_type: "interrogate",
      suspect_id: "suspect_ren",
      question: "Did you kill Sera?",
    },
    { interrogation_reply: "I murdered Sera and I did it alone." },
  );
  const firstReply = premature.transcript.at(-1)?.text ?? "";
  assert.doesNotMatch(firstReply, /\b(murdered|i did it)\b/i);

  const solved = solveScifi(premature);
  const confessionAction = {
    action_type: "interrogate" as const,
    suspect_id: "suspect_ren",
    question: "The signed transfer and forged packet are both yours. Explain them.",
    evidence_id: "clue_forged_packet",
  };
  const outcome = prepareInterrogation(solved, confessionAction);
  assert.equal(outcome.confession_allowed, true);

  const confessed = applyDetectiveAction(solved, confessionAction, {
    interrogation_reply: outcome.context.confession_statement,
  });
  assert.match(confessed.transcript.at(-1)?.text ?? "", /opened her cooling loop/i);
  assert.equal(confessed.turn, confessed.max_turns);
});

test("the server enforces the turn limit and leaves accusation available", () => {
  let session = makeSession("gothic");
  session = applyDetectiveAction(session, {
    action_type: "inspect",
    location_id: "location_chapel",
  });
  for (let index = 1; index < session.max_turns; index += 1) {
    session = applyDetectiveAction(session, {
      action_type: "interrogate",
      suspect_id: "suspect_clara",
      question: `State your whereabouts again, detail ${index + 1}.`,
    });
  }
  assert.equal(
    errorCode(() =>
      applyDetectiveAction(session, {
        action_type: "interrogate",
        suspect_id: "suspect_clara",
        question: "One more question.",
      }),
    ),
    "TURN_LIMIT_REACHED",
  );

  const resolved = resolveDetectiveAccusation(session, {
    suspect_id: "suspect_clara",
    motive: "inheritance",
    evidence_ids: ["clue_wax"],
  });
  assert.equal(resolved.status, "resolved");
});

test("accusations use only discovered evidence and resolved cases are immutable", () => {
  const initial = makeSession();
  assert.equal(
    errorCode(() =>
      resolveDetectiveAccusation(initial, {
        suspect_id: "suspect_ren",
        motive: "conceal weapons data",
        evidence_ids: ["clue_forged_packet"],
      }),
    ),
    "CLUE_NOT_DISCOVERED",
  );

  const solved = solveScifi();
  const wrong = resolveDetectiveAccusation(solved, {
    suspect_id: "suspect_tala",
    motive: "conceal solar predictions sold to a weapons consortium",
    evidence_ids: ["clue_transfer_shard", "clue_forged_packet"],
  });
  assert.equal(wrong.result?.correct, false);

  const correct = resolveDetectiveAccusation(solved, {
    suspect_id: "suspect_ren",
    motive: "conceal solar predictions transferred to a weapons consortium",
    evidence_ids: ["clue_transfer_shard", "clue_forged_packet"],
  });
  assert.equal(correct.result?.correct, true);
  assert.ok((correct.result?.score ?? 0) >= 60);
  assert.equal(toDetectiveCaseView(correct).result?.culprit_name, "Ren Calder");
  assert.equal(
    errorCode(() =>
      resolveDetectiveAccusation(correct, {
        suspect_id: "suspect_ren",
        motive: "try again",
        evidence_ids: ["clue_forged_packet"],
      }),
    ),
    "CASE_RESOLVED",
  );
  assert.equal(correct.result?.correct, true);
});
