export type DetectiveGenre = "noir" | "gothic" | "scifi";
export type DetectiveDifficulty = "easy" | "medium" | "hard";
export type DetectivePace = "blitz" | "full";
export type DetectiveStatus = "active" | "resolved";
export type DetectiveActionType = "inspect" | "analyze" | "interrogate";

export type DetectiveCreateInput = {
  genre: DetectiveGenre;
  difficulty: DetectiveDifficulty;
  pace: DetectivePace;
  atmosphere?: string;
};

export type DetectiveActionInput =
  | {
      action_type: "inspect";
      location_id: string;
    }
  | {
      action_type: "analyze";
      clue_id: string;
    }
  | {
      action_type: "interrogate";
      suspect_id: string;
      question: string;
      evidence_id?: string;
    };

export type DetectiveAccusationInput = {
  suspect_id: string;
  motive: string;
  evidence_ids: string[];
};

export type DetectiveTranscriptEntry = {
  entry_id: string;
  turn: number;
  action_type: DetectiveActionType;
  speaker?: string;
  text: string;
};

export type DetectiveResult = {
  correct: boolean;
  score: number;
  culprit_id: string;
  culprit_name: string;
  motive: string;
  explanation: string;
  used_evidence_ids: string[];
};

export type DetectiveSuspectView = {
  suspect_id: string;
  name: string;
  role: string;
  public_profile: string;
  demeanor: string;
  stress: number;
};

export type DetectiveLocationView = {
  location_id: string;
  name: string;
  description: string;
  visited: boolean;
  remaining_clue_count: number;
};

export type DetectiveEvidenceView = {
  clue_id: string;
  title: string;
  location_id: string;
  discovery: string;
  analysis?: string;
  analyzed: boolean;
  connections: string[];
};

export type DetectiveCaseView = {
  case_id: string;
  status: DetectiveStatus;
  title: string;
  genre: DetectiveGenre;
  difficulty: DetectiveDifficulty;
  pace: DetectivePace;
  atmosphere: string;
  setting: string;
  premise: string;
  opening_narration: string;
  central_question: string;
  turn: number;
  max_turns: number;
  suspects: DetectiveSuspectView[];
  locations: DetectiveLocationView[];
  evidence: DetectiveEvidenceView[];
  transcript: DetectiveTranscriptEntry[];
  result?: DetectiveResult;
};

export type DetectiveSuspectSecret = DetectiveSuspectView & {
  is_culprit: boolean;
  true_alibi: string;
  secret_motive: string;
  authorized_knowledge: string[];
  confession_clue_ids: string[];
  confession_stress_threshold: number;
  confession_statement: string;
};

export type DetectiveLocationSecret = Omit<
  DetectiveLocationView,
  "remaining_clue_count"
> & {
  clue_ids: string[];
};

export type DetectiveClueSecret = {
  clue_id: string;
  title: string;
  location_id: string;
  discovery: string;
  analysis: string;
  connections: string[];
  prerequisite_clue_ids: string[];
  suspect_ids: string[];
  discovered: boolean;
  analyzed: boolean;
  key_evidence: boolean;
  significance: string;
};

export type DetectiveSolutionSecret = {
  culprit_id: string;
  motive: string;
  motive_keywords: string[];
  explanation: string;
};

export type DetectiveGeneration = {
  provider: "openai" | "fixture";
  model: string;
  used_fallback: boolean;
};

export type DetectiveCaseSession = {
  schema_version: 1;
  case_id: string;
  revision: number;
  status: DetectiveStatus;
  title: string;
  genre: DetectiveGenre;
  difficulty: DetectiveDifficulty;
  pace: DetectivePace;
  atmosphere: string;
  setting: string;
  premise: string;
  opening_narration: string;
  central_question: string;
  turn: number;
  max_turns: number;
  suspects: DetectiveSuspectSecret[];
  locations: DetectiveLocationSecret[];
  clues: DetectiveClueSecret[];
  transcript: DetectiveTranscriptEntry[];
  solution: DetectiveSolutionSecret;
  result?: DetectiveResult;
  generation: DetectiveGeneration;
  created_at: string;
  updated_at: string;
};

/**
 * Mechanical and narrative seed used to create a new server-owned aggregate.
 * This never crosses the public API boundary.
 */
export type DetectiveCaseDraft = {
  title: string;
  atmosphere: string;
  setting: string;
  premise: string;
  opening_narration: string;
  central_question: string;
  suspects: Array<
    Omit<DetectiveSuspectSecret, "stress"> & {
      starting_stress: number;
    }
  >;
  locations: Array<
    Omit<DetectiveLocationSecret, "visited"> & {
      visited: false;
    }
  >;
  clues: Array<
    Omit<DetectiveClueSecret, "discovered" | "analyzed"> & {
      discovered: false;
      analyzed: false;
    }
  >;
  solution: DetectiveSolutionSecret;
};

export type DetectiveInterrogationContext = {
  suspect_id: string;
  suspect_name: string;
  role: string;
  public_profile: string;
  demeanor: string;
  stress: number;
  question: string;
  presented_evidence?: {
    clue_id: string;
    title: string;
    discovery: string;
    analysis?: string;
  };
  discovered_facts: string[];
  authorized_knowledge: string[];
  confession_allowed: boolean;
  confession_statement?: string;
};

export type DetectiveInterrogationOutcome = {
  next_stress: number;
  confession_allowed: boolean;
  context: DetectiveInterrogationContext;
};
