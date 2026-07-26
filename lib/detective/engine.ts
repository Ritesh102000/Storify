import { createId } from "@/lib/id";
import { DetectiveError } from "./errors";
import { detectiveSessionSchema } from "./schemas";
import type {
  DetectiveAccusationInput,
  DetectiveActionInput,
  DetectiveCaseDraft,
  DetectiveCaseSession,
  DetectiveCaseView,
  DetectiveCreateInput,
  DetectiveGeneration,
  DetectiveInterrogationContext,
  DetectiveInterrogationOutcome,
} from "./types";

const PACE_TURNS = {
  blitz: 10,
  full: 16,
} as const;

export function createDetectiveSession(
  input: DetectiveCreateInput,
  draft: DetectiveCaseDraft,
  generation: DetectiveGeneration,
  caseId = createId("case"),
): DetectiveCaseSession {
  validateDetectiveDraft(draft);
  const now = new Date().toISOString();

  return detectiveSessionSchema.parse({
    schema_version: 1,
    case_id: caseId,
    revision: 0,
    status: "active",
    title: draft.title,
    genre: input.genre,
    difficulty: input.difficulty,
    pace: input.pace,
    atmosphere: draft.atmosphere,
    setting: draft.setting,
    premise: draft.premise,
    opening_narration: draft.opening_narration,
    central_question: draft.central_question,
    turn: 0,
    max_turns: PACE_TURNS[input.pace],
    suspects: draft.suspects.map(({ starting_stress, ...suspect }) => ({
      ...suspect,
      stress: starting_stress,
    })),
    locations: draft.locations.map((location) => ({ ...location })),
    clues: draft.clues.map((clue) => ({ ...clue })),
    transcript: [],
    solution: { ...draft.solution },
    generation,
    created_at: now,
    updated_at: now,
  });
}

/**
 * The browser receives this projection and nothing else. Deliberately list
 * every public field instead of spreading private aggregate objects.
 */
export function toDetectiveCaseView(
  session: DetectiveCaseSession,
): DetectiveCaseView {
  const cluesById = new Map(session.clues.map((clue) => [clue.clue_id, clue]));

  return {
    case_id: session.case_id,
    status: session.status,
    title: session.title,
    genre: session.genre,
    difficulty: session.difficulty,
    pace: session.pace,
    atmosphere: session.atmosphere,
    setting: session.setting,
    premise: session.premise,
    opening_narration: session.opening_narration,
    central_question: session.central_question,
    turn: session.turn,
    max_turns: session.max_turns,
    suspects: session.suspects.map((suspect) => ({
      suspect_id: suspect.suspect_id,
      name: suspect.name,
      role: suspect.role,
      public_profile: suspect.public_profile,
      demeanor: suspect.demeanor,
      stress: suspect.stress,
    })),
    locations: session.locations.map((location) => ({
      location_id: location.location_id,
      name: location.name,
      description: location.description,
      visited: location.visited,
      remaining_clue_count: location.clue_ids.filter(
        (clueId) => !cluesById.get(clueId)?.discovered,
      ).length,
    })),
    evidence: session.clues
      .filter((clue) => clue.discovered)
      .map((clue) => ({
        clue_id: clue.clue_id,
        title: clue.title,
        location_id: clue.location_id,
        discovery: clue.discovery,
        ...(clue.analyzed ? { analysis: clue.analysis } : {}),
        analyzed: clue.analyzed,
        connections: clue.analyzed ? [...clue.connections] : [],
      })),
    transcript: session.transcript.map((entry) => ({ ...entry })),
    ...(session.status === "resolved" && session.result
      ? { result: { ...session.result } }
      : {}),
  };
}

export function applyDetectiveAction(
  session: DetectiveCaseSession,
  action: DetectiveActionInput,
  options: { interrogation_reply?: string } = {},
): DetectiveCaseSession {
  assertTurnAvailable(session);
  const next = structuredClone(session);
  const nextTurn = session.turn + 1;

  if (action.action_type === "inspect") {
    const location = next.locations.find(
      (candidate) => candidate.location_id === action.location_id,
    );
    if (!location) {
      throw new DetectiveError(404, "LOCATION_NOT_FOUND", "That scene does not exist.");
    }

    const clue = location.clue_ids
      .map((clueId) => next.clues.find((candidate) => candidate.clue_id === clueId))
      .find(
        (candidate) =>
          candidate &&
          !candidate.discovered &&
          candidate.prerequisite_clue_ids.every(
            (requiredId) =>
              next.clues.find((item) => item.clue_id === requiredId)?.analyzed,
          ),
      );

    if (!clue) {
      const hasUndiscovered = location.clue_ids.some(
        (clueId) =>
          !next.clues.find((candidate) => candidate.clue_id === clueId)?.discovered,
      );
      if (hasUndiscovered) {
        throw new DetectiveError(
          409,
          "CLUE_PREREQUISITE_MISSING",
          "The remaining trace has no meaning yet. Analyze the evidence already in your notebook.",
        );
      }
      throw new DetectiveError(
        409,
        "LOCATION_EXHAUSTED",
        "You have already recovered everything this scene can establish.",
      );
    }

    location.visited = true;
    clue.discovered = true;
    next.transcript.push({
      entry_id: createId("log"),
      turn: nextTurn,
      action_type: "inspect",
      text: `${clue.title}: ${clue.discovery}`,
    });
  } else if (action.action_type === "analyze") {
    const clue = next.clues.find(
      (candidate) => candidate.clue_id === action.clue_id,
    );
    if (!clue) {
      throw new DetectiveError(404, "CLUE_NOT_FOUND", "That evidence does not exist.");
    }
    if (!clue.discovered) {
      throw new DetectiveError(
        409,
        "CLUE_NOT_DISCOVERED",
        "You cannot analyze evidence that has not been recovered.",
      );
    }
    if (clue.analyzed) {
      throw new DetectiveError(
        409,
        "CLUE_ALREADY_ANALYZED",
        "That evidence has already been analyzed.",
      );
    }

    clue.analyzed = true;
    next.transcript.push({
      entry_id: createId("log"),
      turn: nextTurn,
      action_type: "analyze",
      text: `${clue.title}: ${clue.analysis}`,
    });
  } else {
    const outcome = prepareInterrogation(session, action);
    const suspect = next.suspects.find(
      (candidate) => candidate.suspect_id === action.suspect_id,
    );
    if (!suspect) {
      throw new DetectiveError(404, "SUSPECT_NOT_FOUND", "That suspect does not exist.");
    }

    suspect.stress = outcome.next_stress;
    const proposed =
      options.interrogation_reply?.trim() ||
      fallbackInterrogationReply(outcome.context);
    const reply = safeInterrogationReply(session, suspect.suspect_id, proposed, outcome);
    next.transcript.push({
      entry_id: createId("log"),
      turn: nextTurn,
      action_type: "interrogate",
      speaker: suspect.name,
      text: reply,
    });
  }

  next.turn = nextTurn;
  next.revision = session.revision + 1;
  next.updated_at = new Date().toISOString();
  return detectiveSessionSchema.parse(next);
}

export function prepareInterrogation(
  session: DetectiveCaseSession,
  action: Extract<DetectiveActionInput, { action_type: "interrogate" }>,
): DetectiveInterrogationOutcome {
  assertTurnAvailable(session);
  const suspect = session.suspects.find(
    (candidate) => candidate.suspect_id === action.suspect_id,
  );
  if (!suspect) {
    throw new DetectiveError(404, "SUSPECT_NOT_FOUND", "That suspect does not exist.");
  }

  const evidence = action.evidence_id
    ? session.clues.find((clue) => clue.clue_id === action.evidence_id)
    : undefined;
  if (action.evidence_id && !evidence) {
    throw new DetectiveError(404, "CLUE_NOT_FOUND", "That evidence does not exist.");
  }
  if (evidence && !evidence.discovered) {
    throw new DetectiveError(
      409,
      "CLUE_NOT_DISCOVERED",
      "You cannot present evidence that is not in your notebook.",
    );
  }

  const difficultyAdjustment =
    session.difficulty === "easy" ? 4 : session.difficulty === "hard" ? -2 : 0;
  const evidencePressure = evidence
    ? evidence.suspect_ids.includes(suspect.suspect_id)
      ? evidence.analyzed
        ? 14
        : 8
      : 3
    : 0;
  const questionPressure = action.question.trim().length >= 100 ? 2 : 0;
  const nextStress = clamp(
    suspect.stress + 8 + difficultyAdjustment + evidencePressure + questionPressure,
    0,
    100,
  );

  const requiredEvidenceReady = suspect.confession_clue_ids.every((clueId) => {
    const clue = session.clues.find((candidate) => candidate.clue_id === clueId);
    return Boolean(clue?.discovered && clue.analyzed);
  });
  const requiredEvidencePresented = Boolean(
    evidence && suspect.confession_clue_ids.includes(evidence.clue_id),
  );
  const confessionAllowed = Boolean(
    suspect.is_culprit &&
      requiredEvidenceReady &&
      requiredEvidencePresented &&
      nextStress >= suspect.confession_stress_threshold,
  );

  const context: DetectiveInterrogationContext = {
    suspect_id: suspect.suspect_id,
    suspect_name: suspect.name,
    role: suspect.role,
    public_profile: suspect.public_profile,
    demeanor: suspect.demeanor,
    stress: nextStress,
    question: action.question.trim(),
    ...(evidence
      ? {
          presented_evidence: {
            clue_id: evidence.clue_id,
            title: evidence.title,
            discovery: evidence.discovery,
            ...(evidence.analyzed ? { analysis: evidence.analysis } : {}),
          },
        }
      : {}),
    discovered_facts: session.clues
      .filter((clue) => clue.discovered)
      .map((clue) =>
        clue.analyzed
          ? `${clue.title}: ${clue.discovery} Analysis: ${clue.analysis}`
          : `${clue.title}: ${clue.discovery}`,
      ),
    authorized_knowledge: [...suspect.authorized_knowledge],
    confession_allowed: confessionAllowed,
    ...(confessionAllowed
      ? { confession_statement: suspect.confession_statement }
      : {}),
  };

  return {
    next_stress: nextStress,
    confession_allowed: confessionAllowed,
    context,
  };
}

export function resolveDetectiveAccusation(
  session: DetectiveCaseSession,
  accusation: DetectiveAccusationInput,
): DetectiveCaseSession {
  if (session.status === "resolved") {
    throw new DetectiveError(409, "CASE_RESOLVED", "This case is already closed.");
  }

  const accused = session.suspects.find(
    (suspect) => suspect.suspect_id === accusation.suspect_id,
  );
  if (!accused) {
    throw new DetectiveError(404, "SUSPECT_NOT_FOUND", "That suspect does not exist.");
  }
  if (!accusation.evidence_ids.length) {
    throw new DetectiveError(
      400,
      "EVIDENCE_REQUIRED",
      "An accusation needs at least one recovered piece of evidence.",
    );
  }
  if (new Set(accusation.evidence_ids).size !== accusation.evidence_ids.length) {
    throw new DetectiveError(
      400,
      "DUPLICATE_EVIDENCE",
      "Each piece of evidence can be used only once.",
    );
  }

  const submitted = accusation.evidence_ids.map((clueId) => {
    const clue = session.clues.find((candidate) => candidate.clue_id === clueId);
    if (!clue) {
      throw new DetectiveError(404, "CLUE_NOT_FOUND", "That evidence does not exist.");
    }
    if (!clue.discovered) {
      throw new DetectiveError(
        409,
        "CLUE_NOT_DISCOVERED",
        "An accusation cannot use evidence that was never recovered.",
      );
    }
    return clue;
  });

  const correctCulprit = accused.suspect_id === session.solution.culprit_id;
  const motiveRatio = keywordCoverage(
    accusation.motive,
    session.solution.motive_keywords,
  );
  const keyEvidence = submitted.filter(
    (clue) => clue.key_evidence && clue.analyzed,
  );
  const supportingEvidence = submitted.filter(
    (clue) =>
      !clue.key_evidence &&
      clue.analyzed &&
      clue.suspect_ids.includes(session.solution.culprit_id),
  );
  const evidenceScore = Math.min(
    30,
    keyEvidence.length * 15 + supportingEvidence.length * 5,
  );
  const score = clamp(
    Math.round((correctCulprit ? 45 : 0) + motiveRatio * 25 + evidenceScore),
    0,
    100,
  );
  const correct = Boolean(
    correctCulprit && keyEvidence.length > 0 && motiveRatio >= 1 / 6 && score >= 60,
  );
  const culprit = session.suspects.find(
    (suspect) => suspect.suspect_id === session.solution.culprit_id,
  );
  if (!culprit) {
    throw new DetectiveError(
      500,
      "CASE_INVALID",
      "The sealed solution could not be resolved.",
    );
  }

  const next = structuredClone(session);
  next.status = "resolved";
  next.result = {
    correct,
    score,
    culprit_id: culprit.suspect_id,
    culprit_name: culprit.name,
    motive: session.solution.motive,
    explanation: session.solution.explanation,
    used_evidence_ids: [...accusation.evidence_ids],
  };
  next.revision = session.revision + 1;
  next.updated_at = new Date().toISOString();
  return detectiveSessionSchema.parse(next);
}

export function fallbackInterrogationReply(
  context: DetectiveInterrogationContext,
): string {
  if (context.confession_allowed && context.confession_statement) {
    return context.confession_statement;
  }

  const fact =
    context.authorized_knowledge[
      Math.max(0, context.discovered_facts.length - 1) %
        context.authorized_knowledge.length
    ];
  if (context.presented_evidence) {
    return `${context.presented_evidence.title} deserves an answer, but it does not make me the killer. ${fact}`;
  }
  return `Ask me about something you can prove. ${fact}`;
}

export function validateDetectiveDraft(draft: DetectiveCaseDraft): void {
  const suspectIds = uniqueOrThrow(
    draft.suspects.map((suspect) => suspect.suspect_id),
    "suspect",
  );
  const locationIds = uniqueOrThrow(
    draft.locations.map((location) => location.location_id),
    "location",
  );
  const clueIds = uniqueOrThrow(
    draft.clues.map((clue) => clue.clue_id),
    "clue",
  );
  const culprits = draft.suspects.filter((suspect) => suspect.is_culprit);
  if (
    culprits.length !== 1 ||
    culprits[0]?.suspect_id !== draft.solution.culprit_id
  ) {
    invalidDraft("The solution must identify the one server-selected culprit.");
  }
  if (!draft.clues.some((clue) => clue.key_evidence)) {
    invalidDraft("The case needs at least one key evidence clue.");
  }

  for (const location of draft.locations) {
    uniqueOrThrow(location.clue_ids, "location clue");
    for (const clueId of location.clue_ids) {
      const clue = draft.clues.find((candidate) => candidate.clue_id === clueId);
      if (!clue || clue.location_id !== location.location_id) {
        invalidDraft("A location contains an invalid clue reference.");
      }
    }
  }
  for (const clue of draft.clues) {
    if (!locationIds.has(clue.location_id)) {
      invalidDraft("A clue points to a missing location.");
    }
    const owningLocation = draft.locations.find(
      (location) => location.location_id === clue.location_id,
    );
    if (!owningLocation?.clue_ids.includes(clue.clue_id)) {
      invalidDraft("A clue is absent from its owning location.");
    }
    for (const prerequisite of clue.prerequisite_clue_ids) {
      if (!clueIds.has(prerequisite) || prerequisite === clue.clue_id) {
        invalidDraft("A clue has an invalid prerequisite.");
      }
    }
    for (const suspectId of clue.suspect_ids) {
      if (!suspectIds.has(suspectId)) {
        invalidDraft("A clue points to a missing suspect.");
      }
    }
  }
  for (const suspect of draft.suspects) {
    for (const clueId of suspect.confession_clue_ids) {
      if (!clueIds.has(clueId)) {
        invalidDraft("A confession gate points to missing evidence.");
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (clueId: string) => {
    if (visiting.has(clueId)) invalidDraft("The clue graph contains a cycle.");
    if (visited.has(clueId)) return;
    visiting.add(clueId);
    const clue = draft.clues.find((candidate) => candidate.clue_id === clueId);
    clue?.prerequisite_clue_ids.forEach(visit);
    visiting.delete(clueId);
    visited.add(clueId);
  };
  draft.clues.forEach((clue) => visit(clue.clue_id));
  if (visited.size !== draft.clues.length) {
    invalidDraft("Every clue must be reachable.");
  }
}

function assertTurnAvailable(session: DetectiveCaseSession): void {
  if (session.status === "resolved") {
    throw new DetectiveError(409, "CASE_RESOLVED", "This case is already closed.");
  }
  if (session.turn >= session.max_turns) {
    throw new DetectiveError(
      409,
      "TURN_LIMIT_REACHED",
      "The trail is cold. Submit your best accusation now.",
    );
  }
}

function safeInterrogationReply(
  session: DetectiveCaseSession,
  suspectId: string,
  proposed: string,
  outcome: DetectiveInterrogationOutcome,
): string {
  const suspect = session.suspects.find(
    (candidate) => candidate.suspect_id === suspectId,
  );
  if (!suspect) return fallbackInterrogationReply(outcome.context);
  if (outcome.confession_allowed) return proposed.slice(0, 1_200);

  const directAdmission =
    /\b(i|we)\s+(killed|murdered|did it|caused (?:her|his|their) death)\b/i.test(
      proposed,
    );
  const includesPrivatePhrase = containsPrivatePhrase(proposed, [
    suspect.true_alibi,
    suspect.secret_motive,
    suspect.confession_statement,
  ]);
  if (directAdmission || includesPrivatePhrase) {
    return fallbackInterrogationReply(outcome.context);
  }
  return proposed.slice(0, 1_200);
}

function containsPrivatePhrase(reply: string, privateValues: string[]): boolean {
  const normalizedReply = normalizeWords(reply).join(" ");
  return privateValues.some((value) => {
    const words = normalizeWords(value);
    for (let index = 0; index <= words.length - 4; index += 1) {
      if (normalizedReply.includes(words.slice(index, index + 4).join(" "))) {
        return true;
      }
    }
    return false;
  });
}

function keywordCoverage(input: string, keywords: string[]): number {
  const tokens = new Set(normalizeWords(input).map(stem));
  const matched = keywords.filter((keyword) => {
    const candidate = stem(normalizeWords(keyword)[0] ?? "");
    return candidate && [...tokens].some((token) => token === candidate);
  }).length;
  return matched / Math.max(1, keywords.length);
}

function normalizeWords(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function stem(input: string): string {
  return input.replace(/(ing|ed|es|s)$/i, "");
}

function uniqueOrThrow(values: string[], kind: string): Set<string> {
  const unique = new Set(values);
  if (unique.size !== values.length) invalidDraft(`Duplicate ${kind} IDs.`);
  return unique;
}

function invalidDraft(reason: string): never {
  void reason;
  throw new DetectiveError(
    500,
    "CASE_INVALID",
    "The generated case did not form a valid, solvable evidence graph.",
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
