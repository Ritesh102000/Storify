"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Genre = "noir" | "gothic" | "scifi";
type Difficulty = "easy" | "medium" | "hard";
type Pace = "blitz" | "full";

type DetectiveSetup = {
  genre: Genre;
  difficulty: Difficulty;
  pace: Pace;
  atmosphere: string;
};

type Suspect = {
  suspect_id: string;
  name: string;
  role: string;
  public_profile: string;
  demeanor: string;
  stress: number;
};

type Location = {
  location_id: string;
  name: string;
  description: string;
  visited: boolean;
  remaining_clue_count: number;
};

type Evidence = {
  clue_id: string;
  title: string;
  location_id: string;
  discovery: string;
  analysis?: string;
  analyzed: boolean;
  connections: string[];
};

type TranscriptEntry = {
  entry_id: string;
  turn: number;
  action_type: string;
  speaker?: string;
  text: string;
};

type DetectiveResult = {
  correct: boolean;
  score: number;
  culprit_id: string;
  culprit_name: string;
  motive: string;
  explanation: string;
  used_evidence_ids: string[];
};

type DetectiveCaseView = {
  case_id: string;
  status: string;
  title: string;
  genre: Genre;
  difficulty: Difficulty;
  pace: Pace;
  atmosphere: string;
  setting: string;
  premise: string;
  opening_narration: string;
  central_question: string;
  turn: number;
  max_turns: number;
  suspects: Suspect[];
  locations: Location[];
  evidence: Evidence[];
  transcript: TranscriptEntry[];
  result?: DetectiveResult;
};

type DetectiveAction =
  | { action_type: "inspect"; location_id: string }
  | { action_type: "analyze"; clue_id: string }
  | {
      action_type: "interrogate";
      suspect_id: string;
      question: string;
      evidence_id?: string;
    };

type CaseResponse = {
  case?: DetectiveCaseView;
  error?: { message?: string };
};

const ACTIVE_CASE_KEY = "ai-storify.detective.active-case-id";

const GENRES: Array<{
  value: Genre;
  label: string;
  detail: string;
  glyph: string;
}> = [
  {
    value: "noir",
    label: "Noir",
    detail: "Rain, hard alibis, and a city that knows more than it says.",
    glyph: "◐",
  },
  {
    value: "gothic",
    label: "Gothic",
    detail: "Old houses, inherited grudges, and evidence that should be dead.",
    glyph: "♢",
  },
  {
    value: "scifi",
    label: "Sci-fi",
    detail: "Closed systems, synthetic witnesses, and impossible timelines.",
    glyph: "⌬",
  },
];

const DIFFICULTIES: Array<{
  value: Difficulty;
  label: string;
  detail: string;
}> = [
  { value: "easy", label: "Clear trail", detail: "Fewer red herrings" },
  { value: "medium", label: "Cold case", detail: "Balanced pressure" },
  { value: "hard", label: "Perfect crime", detail: "Every detail matters" },
];

const PACES: Array<{ value: Pace; label: string; detail: string }> = [
  { value: "blitz", label: "Blitz", detail: "A sharp case for one sitting" },
  { value: "full", label: "Full case", detail: "More turns, clues, and testimony" },
];

const DEFAULT_SETUP: DetectiveSetup = {
  genre: "noir",
  difficulty: "medium",
  pace: "full",
  atmosphere: "",
};

export function AiDetective() {
  const [setup, setSetup] = useState<DetectiveSetup>(DEFAULT_SETUP);
  const [caseFile, setCaseFile] = useState<DetectiveCaseView | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  const [selectedClueId, setSelectedClueId] = useState("");
  const [question, setQuestion] = useState("");
  const [interrogationEvidenceId, setInterrogationEvidenceId] = useState("");
  const [accusationOpen, setAccusationOpen] = useState(false);
  const [accusedSuspectId, setAccusedSuspectId] = useState("");
  const [motive, setMotive] = useState("");
  const [accusationEvidenceIds, setAccusationEvidenceIds] = useState<string[]>([]);

  const installCase = useCallback((next: DetectiveCaseView) => {
    setCaseFile(next);
    setSelectedSuspectId((current) =>
      next.suspects.some((suspect) => suspect.suspect_id === current)
        ? current
        : (next.suspects[0]?.suspect_id ?? ""),
    );
    setSelectedClueId((current) =>
      next.evidence.some((clue) => clue.clue_id === current)
        ? current
        : (next.evidence.at(-1)?.clue_id ?? ""),
    );
    setAccusedSuspectId((current) =>
      next.suspects.some((suspect) => suspect.suspect_id === current)
        ? current
        : "",
    );
    setInterrogationEvidenceId((current) =>
      next.evidence.some((clue) => clue.clue_id === current) ? current : "",
    );
    setAccusationEvidenceIds((current) =>
      current.filter((clueId) =>
        next.evidence.some((clue) => clue.clue_id === clueId),
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Cross an async boundary before updating mount state. This keeps the
      // effect focused on synchronizing the browser's case pointer.
      await Promise.resolve();
      if (cancelled) return;
      const activeCaseId = readActiveCaseId();
      if (!activeCaseId) {
        setInitializing(false);
        return;
      }

      setBusy("Reopening the case file");
      try {
        const next = await requestCase(
          `/api/detective/cases/${encodeURIComponent(activeCaseId)}`,
        );
        if (!cancelled) installCase(next);
      } catch (reason) {
        if (cancelled) return;
        clearActiveCaseId();
        setError(`${messageOf(reason)} Start a new case when you are ready.`);
      } finally {
        if (!cancelled) {
          setBusy(null);
          setInitializing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [installCase]);

  const selectedSuspect = useMemo(
    () =>
      caseFile?.suspects.find(
        (suspect) => suspect.suspect_id === selectedSuspectId,
      ) ?? null,
    [caseFile, selectedSuspectId],
  );

  const concluded = Boolean(caseFile?.result);
  const turnsExhausted = Boolean(
    caseFile && caseFile.turn >= caseFile.max_turns && !concluded,
  );

  async function createCase() {
    setBusy("Building the case");
    setError("");
    try {
      const next = await requestCase("/api/detective/cases", {
        method: "POST",
        body: JSON.stringify({
          genre: setup.genre,
          difficulty: setup.difficulty,
          pace: setup.pace,
          ...(setup.atmosphere.trim()
            ? { atmosphere: setup.atmosphere.trim() }
            : {}),
        }),
      });
      rememberActiveCaseId(next.case_id);
      installCase(next);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
      setInitializing(false);
    }
  }

  async function performAction(
    action: DetectiveAction,
    busyMessage: string,
  ): Promise<DetectiveCaseView | null> {
    if (!caseFile || busy || concluded) return null;
    setBusy(busyMessage);
    setError("");
    try {
      const next = await requestCase(
        `/api/detective/cases/${encodeURIComponent(caseFile.case_id)}/actions`,
        {
          method: "POST",
          body: JSON.stringify(action),
        },
      );
      installCase(next);
      return next;
    } catch (reason) {
      setError(messageOf(reason));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function inspect(locationId: string) {
    if (!caseFile) return;
    const knownIds = new Set(caseFile.evidence.map((clue) => clue.clue_id));
    const next = await performAction(
      { action_type: "inspect", location_id: locationId },
      "Searching the scene",
    );
    const discovered = next?.evidence.find((clue) => !knownIds.has(clue.clue_id));
    if (discovered) setSelectedClueId(discovered.clue_id);
  }

  async function analyze(clueId: string) {
    setSelectedClueId(clueId);
    await performAction(
      { action_type: "analyze", clue_id: clueId },
      "Testing the evidence",
    );
  }

  async function interrogate() {
    const cleanQuestion = question.trim();
    if (!selectedSuspectId || !cleanQuestion) {
      setError("Choose a suspect and ask a specific question.");
      return;
    }
    const next = await performAction(
      {
        action_type: "interrogate",
        suspect_id: selectedSuspectId,
        question: cleanQuestion,
        ...(interrogationEvidenceId
          ? { evidence_id: interrogationEvidenceId }
          : {}),
      },
      "Pressing the witness",
    );
    if (next) setQuestion("");
  }

  async function accuse() {
    if (!caseFile || busy || concluded) return;
    if (!accusedSuspectId) {
      setError("Name the person you believe committed the crime.");
      return;
    }
    if (!motive.trim()) {
      setError("Explain the motive behind your accusation.");
      return;
    }
    if (!accusationEvidenceIds.length) {
      setError("Build your accusation on at least one piece of evidence.");
      return;
    }

    setBusy("Testing your theory");
    setError("");
    try {
      const next = await requestCase(
        `/api/detective/cases/${encodeURIComponent(caseFile.case_id)}/accuse`,
        {
          method: "POST",
          body: JSON.stringify({
            suspect_id: accusedSuspectId,
            motive: motive.trim(),
            evidence_ids: accusationEvidenceIds,
          }),
        },
      );
      installCase(next);
      setAccusationOpen(false);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  function startAnotherCase() {
    if (
      caseFile &&
      !caseFile.result &&
      !window.confirm(
        "Start a new case? This investigation will remain on the server, but this browser will forget its case number.",
      )
    ) {
      return;
    }
    clearActiveCaseId();
    setCaseFile(null);
    setSetup(DEFAULT_SETUP);
    setError("");
    setBusy(null);
    setSelectedSuspectId("");
    setSelectedClueId("");
    setQuestion("");
    setInterrogationEvidenceId("");
    setAccusationOpen(false);
    setAccusedSuspectId("");
    setMotive("");
    setAccusationEvidenceIds([]);
  }

  function openAccusation() {
    setAccusationOpen(true);
    setAccusedSuspectId(selectedSuspectId);
    setError("");
  }

  function toggleAccusationEvidence(clueId: string) {
    setAccusationEvidenceIds((current) =>
      current.includes(clueId)
        ? current.filter((candidate) => candidate !== clueId)
        : [...current, clueId],
    );
  }

  if (initializing) {
    return (
      <main className="detective-shell detective-loading" aria-busy="true">
        <span className="detective-loader" aria-hidden="true" />
        <p>Checking the locked case drawer…</p>
      </main>
    );
  }

  if (!caseFile) {
    return (
      <main className="detective-shell">
        <StatusMessages error={error} busy={busy} onDismiss={() => setError("")} />
        <CaseSetup
          setup={setup}
          busy={Boolean(busy)}
          onChange={setSetup}
          onSubmit={() => void createCase()}
        />
      </main>
    );
  }

  return (
    <main className="detective-shell">
      <StatusMessages error={error} busy={busy} onDismiss={() => setError("")} />

      <CaseHeader
        caseFile={caseFile}
        turnsExhausted={turnsExhausted}
        onAccuse={openAccusation}
        onNewCase={startAnotherCase}
      />

      {caseFile.result ? (
        <CaseResult result={caseFile.result} onNewCase={startAnotherCase} />
      ) : null}

      {accusationOpen && !caseFile.result ? (
        <AccusationPanel
          suspects={caseFile.suspects}
          evidence={caseFile.evidence}
          suspectId={accusedSuspectId}
          motive={motive}
          evidenceIds={accusationEvidenceIds}
          busy={Boolean(busy)}
          onSuspectChange={setAccusedSuspectId}
          onMotiveChange={setMotive}
          onToggleEvidence={toggleAccusationEvidence}
          onCancel={() => setAccusationOpen(false)}
          onSubmit={() => void accuse()}
        />
      ) : null}

      <div className="detective-workspace">
        <div className="detective-investigation">
          <section className="detective-panel" aria-labelledby="detective-locations">
            <div className="detective-section-head">
              <div>
                <p className="detective-section-number">01 / Scene work</p>
                <h2 id="detective-locations">Search the locations</h2>
              </div>
              <span>{caseFile.locations.length} scenes</span>
            </div>
            <div className="detective-location-grid">
              {caseFile.locations.map((location) => (
                <article
                  className={`detective-location ${
                    location.visited ? "is-visited" : ""
                  }`}
                  key={location.location_id}
                >
                  <div className="detective-location-meta">
                    <span>{location.visited ? "Searched" : "Unsearched"}</span>
                    <span>
                      {location.remaining_clue_count} clue
                      {location.remaining_clue_count === 1 ? "" : "s"} left
                    </span>
                  </div>
                  <h3>{location.name}</h3>
                  <p>{location.description}</p>
                  <button
                    type="button"
                    className="detective-action"
                    disabled={
                      Boolean(busy) ||
                      concluded ||
                      turnsExhausted ||
                      location.remaining_clue_count < 1
                    }
                    onClick={() => void inspect(location.location_id)}
                  >
                    {location.remaining_clue_count < 1
                      ? "Scene exhausted"
                      : location.visited
                        ? "Search again"
                        : "Inspect scene"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="detective-panel" aria-labelledby="detective-suspects">
            <div className="detective-section-head">
              <div>
                <p className="detective-section-number">02 / Testimony</p>
                <h2 id="detective-suspects">Question the suspects</h2>
              </div>
              <span>Words leave traces</span>
            </div>
            <div className="detective-suspect-grid">
              {caseFile.suspects.map((suspect) => (
                <button
                  type="button"
                  key={suspect.suspect_id}
                  className={`detective-suspect ${
                    selectedSuspectId === suspect.suspect_id ? "is-selected" : ""
                  }`}
                  aria-pressed={selectedSuspectId === suspect.suspect_id}
                  onClick={() => setSelectedSuspectId(suspect.suspect_id)}
                >
                  <span className="detective-suspect-topline">
                    <strong>{suspect.name}</strong>
                    <small>{suspect.role}</small>
                  </span>
                  <span className="detective-suspect-profile">
                    {suspect.public_profile}
                  </span>
                  <span className="detective-demeanor">{suspect.demeanor}</span>
                  <span className="detective-stress">
                    <span>
                      <i
                        style={{
                          width: `${Math.max(0, Math.min(100, suspect.stress))}%`,
                        }}
                      />
                    </span>
                    Pressure {Math.round(suspect.stress)}%
                  </span>
                </button>
              ))}
            </div>

            {selectedSuspect ? (
              <form
                className="detective-interrogation"
                onSubmit={(event) => {
                  event.preventDefault();
                  void interrogate();
                }}
              >
                <div className="detective-interrogation-head">
                  <div>
                    <span>Interviewing</span>
                    <strong>{selectedSuspect.name}</strong>
                  </div>
                  <small>{selectedSuspect.demeanor}</small>
                </div>
                <label className="detective-field">
                  <span>Your question</span>
                  <textarea
                    rows={3}
                    maxLength={600}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Where were you when the lights went out?"
                  />
                </label>
                <div className="detective-interrogation-row">
                  <label className="detective-field">
                    <span>Put evidence on the table — optional</span>
                    <select
                      value={interrogationEvidenceId}
                      onChange={(event) =>
                        setInterrogationEvidenceId(event.target.value)
                      }
                    >
                      <option value="">Ask without evidence</option>
                      {caseFile.evidence.map((clue) => (
                        <option key={clue.clue_id} value={clue.clue_id}>
                          {clue.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    className="detective-primary"
                    disabled={
                      Boolean(busy) ||
                      turnsExhausted ||
                      concluded ||
                      !question.trim()
                    }
                  >
                    Ask question
                  </button>
                </div>
              </form>
            ) : null}
          </section>
        </div>

        <aside className="detective-notebook" aria-label="Detective notebook">
          <EvidenceNotebook
            evidence={caseFile.evidence}
            locations={caseFile.locations}
            selectedClueId={selectedClueId}
            busy={Boolean(busy)}
            disabled={turnsExhausted || concluded}
            onSelect={setSelectedClueId}
            onAnalyze={(clueId) => void analyze(clueId)}
          />
          <Transcript entries={caseFile.transcript} />
        </aside>
      </div>
    </main>
  );
}

function CaseSetup({
  setup,
  busy,
  onChange,
  onSubmit,
}: {
  setup: DetectiveSetup;
  busy: boolean;
  onChange: (value: DetectiveSetup) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="detective-setup">
      <header className="detective-setup-hero">
        <p className="detective-kicker">AI Detective · New case</p>
        <h1>Truth does not volunteer.</h1>
        <p>
          Search scenes, test physical evidence, and make people defend their
          stories. You have a finite number of moves before the trail goes cold.
        </p>
      </header>

      <form
        className="detective-setup-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <fieldset className="detective-fieldset">
          <legend>
            <span>01</span>
            Choose the kind of crime
          </legend>
          <div className="detective-genre-grid">
            {GENRES.map((genre) => (
              <button
                type="button"
                key={genre.value}
                className={`detective-option detective-genre ${
                  setup.genre === genre.value ? "is-selected" : ""
                }`}
                aria-pressed={setup.genre === genre.value}
                onClick={() => onChange({ ...setup, genre: genre.value })}
              >
                <span className="detective-option-glyph" aria-hidden="true">
                  {genre.glyph}
                </span>
                <strong>{genre.label}</strong>
                <small>{genre.detail}</small>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="detective-setup-split">
          <fieldset className="detective-fieldset">
            <legend>
              <span>02</span>
              Set the difficulty
            </legend>
            <div className="detective-choice-stack">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  type="button"
                  key={difficulty.value}
                  className={`detective-option detective-choice ${
                    setup.difficulty === difficulty.value ? "is-selected" : ""
                  }`}
                  aria-pressed={setup.difficulty === difficulty.value}
                  onClick={() =>
                    onChange({ ...setup, difficulty: difficulty.value })
                  }
                >
                  <strong>{difficulty.label}</strong>
                  <small>{difficulty.detail}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="detective-fieldset">
            <legend>
              <span>03</span>
              Choose the pace
            </legend>
            <div className="detective-choice-stack">
              {PACES.map((pace) => (
                <button
                  type="button"
                  key={pace.value}
                  className={`detective-option detective-choice ${
                    setup.pace === pace.value ? "is-selected" : ""
                  }`}
                  aria-pressed={setup.pace === pace.value}
                  onClick={() => onChange({ ...setup, pace: pace.value })}
                >
                  <strong>{pace.label}</strong>
                  <small>{pace.detail}</small>
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="detective-atmosphere">
          <span>
            <strong>One atmospheric direction</strong>
            <small>Optional — shape the weather, era, or emotional temperature.</small>
          </span>
          <textarea
            rows={3}
            maxLength={500}
            value={setup.atmosphere}
            onChange={(event) =>
              onChange({ ...setup, atmosphere: event.target.value })
            }
            placeholder="A sleepless monsoon night in Mumbai, with the power failing block by block."
          />
        </label>

        <div className="detective-setup-submit">
          <p>
            The culprit and the evidence are fixed before the first move. The AI
            performs the world; it cannot change the answer.
          </p>
          <button type="submit" className="detective-primary" disabled={busy}>
            Open sealed case
          </button>
        </div>
      </form>
    </section>
  );
}

function CaseHeader({
  caseFile,
  turnsExhausted,
  onAccuse,
  onNewCase,
}: {
  caseFile: DetectiveCaseView;
  turnsExhausted: boolean;
  onAccuse: () => void;
  onNewCase: () => void;
}) {
  const progress = Math.min(
    100,
    Math.round((caseFile.turn / Math.max(1, caseFile.max_turns)) * 100),
  );

  return (
    <>
      <header className="detective-case-head">
        <div className="detective-case-copy">
          <p className="detective-kicker">
            Case {caseFile.case_id.slice(-6).toUpperCase()} ·{" "}
            {formatLabel(caseFile.genre)}
          </p>
          <h1>{caseFile.title}</h1>
          <p>{caseFile.premise}</p>
          <div className="detective-case-tags" aria-label="Case details">
            <span>{formatLabel(caseFile.difficulty)}</span>
            <span>{caseFile.pace === "blitz" ? "Blitz case" : "Full case"}</span>
            <span>{caseFile.setting}</span>
          </div>
        </div>
        <div className="detective-case-actions">
          {!caseFile.result ? (
            <button type="button" className="detective-accuse" onClick={onAccuse}>
              Make accusation
            </button>
          ) : null}
          <button type="button" className="detective-ghost" onClick={onNewCase}>
            New case
          </button>
        </div>
      </header>

      <section className="detective-briefing" aria-labelledby="case-question">
        <div className="detective-briefing-mark" aria-hidden="true">
          ?
        </div>
        <div>
          <span>Central question</span>
          <h2 id="case-question">{caseFile.central_question}</h2>
          <blockquote>{caseFile.opening_narration}</blockquote>
        </div>
      </section>

      <div className="detective-turns">
        <div>
          <span>
            Turn {caseFile.turn} of {caseFile.max_turns}
          </span>
          <strong>
            {caseFile.result
              ? "Case concluded"
              : turnsExhausted
                ? "The trail is cold. Accuse now."
                : `${caseFile.max_turns - caseFile.turn} moves remain`}
          </strong>
        </div>
        <span className="detective-turn-track" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </span>
      </div>
    </>
  );
}

function EvidenceNotebook({
  evidence,
  locations,
  selectedClueId,
  busy,
  disabled,
  onSelect,
  onAnalyze,
}: {
  evidence: Evidence[];
  locations: Location[];
  selectedClueId: string;
  busy: boolean;
  disabled: boolean;
  onSelect: (clueId: string) => void;
  onAnalyze: (clueId: string) => void;
}) {
  const locationNames = new Map(
    locations.map((location) => [location.location_id, location.name]),
  );

  return (
    <section className="detective-notebook-section" aria-labelledby="evidence-title">
      <div className="detective-notebook-head">
        <div>
          <p className="detective-section-number">Evidence notebook</p>
          <h2 id="evidence-title">What holds up</h2>
        </div>
        <span>{evidence.length}</span>
      </div>

      {evidence.length ? (
        <div className="detective-evidence-list">
          {evidence.map((clue) => (
            <article
              className={`detective-evidence ${
                selectedClueId === clue.clue_id ? "is-selected" : ""
              } ${clue.analyzed ? "is-analyzed" : ""}`}
              key={clue.clue_id}
            >
              <button
                type="button"
                className="detective-evidence-open"
                aria-expanded={selectedClueId === clue.clue_id}
                onClick={() => onSelect(clue.clue_id)}
              >
                <span>
                  {clue.analyzed ? "Analyzed" : "Unprocessed"} ·{" "}
                  {locationNames.get(clue.location_id) ?? "Unknown scene"}
                </span>
                <strong>{clue.title}</strong>
              </button>
              <p>{clue.discovery}</p>
              {clue.analysis ? (
                <div className="detective-analysis">
                  <span>Lab note</span>
                  <p>{clue.analysis}</p>
                </div>
              ) : null}
              {clue.connections.length ? (
                <div className="detective-connections" aria-label="Connections">
                  {clue.connections.map((connection) => (
                    <span key={connection}>{connection}</span>
                  ))}
                </div>
              ) : null}
              {!clue.analyzed ? (
                <button
                  type="button"
                  className="detective-action"
                  disabled={busy || disabled}
                  onClick={() => onAnalyze(clue.clue_id)}
                >
                  Analyze clue
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="detective-empty">
          <span aria-hidden="true">◇</span>
          <p>Your notebook is empty.</p>
          <small>Search a location to put the first fact on the page.</small>
        </div>
      )}
    </section>
  );
}

function Transcript({ entries }: { entries: TranscriptEntry[] }) {
  const recent = entries.slice(-10);

  return (
    <section className="detective-notebook-section" aria-labelledby="transcript-title">
      <div className="detective-notebook-head">
        <div>
          <p className="detective-section-number">Case log</p>
          <h2 id="transcript-title">On the record</h2>
        </div>
        <span>{entries.length}</span>
      </div>
      {recent.length ? (
        <ol className="detective-transcript">
          {recent.map((entry) => (
            <li key={entry.entry_id}>
              <div>
                <span>Turn {entry.turn}</span>
                <span>{formatLabel(entry.action_type)}</span>
              </div>
              {entry.speaker ? <strong>{entry.speaker}</strong> : null}
              <p>{entry.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="detective-log-empty">
          Nothing is on the record yet. The first move is yours.
        </p>
      )}
    </section>
  );
}

function AccusationPanel({
  suspects,
  evidence,
  suspectId,
  motive,
  evidenceIds,
  busy,
  onSuspectChange,
  onMotiveChange,
  onToggleEvidence,
  onCancel,
  onSubmit,
}: {
  suspects: Suspect[];
  evidence: Evidence[];
  suspectId: string;
  motive: string;
  evidenceIds: string[];
  busy: boolean;
  onSuspectChange: (value: string) => void;
  onMotiveChange: (value: string) => void;
  onToggleEvidence: (clueId: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <section
      className="detective-accusation-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="accusation-title"
    >
      <div className="detective-accusation-copy">
        <p className="detective-section-number">Final theory</p>
        <h2 id="accusation-title">Put your name under it.</h2>
        <p>
          An accusation closes the case. Name the culprit, explain why, and
          choose the evidence that makes your theory stand.
        </p>
      </div>
      <form
        className="detective-accusation-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="detective-field">
          <span>Who did it?</span>
          <select
            value={suspectId}
            onChange={(event) => onSuspectChange(event.target.value)}
          >
            <option value="">Choose a suspect</option>
            {suspects.map((suspect) => (
              <option key={suspect.suspect_id} value={suspect.suspect_id}>
                {suspect.name} — {suspect.role}
              </option>
            ))}
          </select>
        </label>
        <label className="detective-field">
          <span>What was the motive?</span>
          <textarea
            rows={3}
            maxLength={800}
            value={motive}
            onChange={(event) => onMotiveChange(event.target.value)}
            placeholder="They needed the victim silent because…"
          />
        </label>
        <fieldset className="detective-evidence-checks">
          <legend>Evidence in your theory</legend>
          {evidence.length ? (
            evidence.map((clue) => (
              <label key={clue.clue_id}>
                <input
                  type="checkbox"
                  checked={evidenceIds.includes(clue.clue_id)}
                  onChange={() => onToggleEvidence(clue.clue_id)}
                />
                <span>
                  <strong>{clue.title}</strong>
                  <small>{clue.analyzed ? "Analyzed" : "Not analyzed"}</small>
                </span>
              </label>
            ))
          ) : (
            <p>There is no evidence to submit yet.</p>
          )}
        </fieldset>
        <div className="detective-accusation-actions">
          <button type="button" className="detective-ghost" onClick={onCancel}>
            Keep investigating
          </button>
          <button
            type="submit"
            className="detective-accuse"
            disabled={
              busy || !suspectId || !motive.trim() || !evidenceIds.length
            }
          >
            Close the case
          </button>
        </div>
      </form>
    </section>
  );
}

function CaseResult({
  result,
  onNewCase,
}: {
  result: DetectiveResult;
  onNewCase: () => void;
}) {
  return (
    <section
      className={`detective-result ${
        result.correct ? "is-correct" : "is-wrong"
      }`}
      aria-labelledby="detective-verdict"
    >
      <div className="detective-score">
        <span>{result.correct ? "Case solved" : "Theory broken"}</span>
        <strong>{Math.round(result.score)}</strong>
        <small>case score</small>
      </div>
      <div className="detective-result-copy">
        <p className="detective-section-number">The sealed answer</p>
        <h2 id="detective-verdict">
          {result.correct
            ? `You found ${result.culprit_name}.`
            : `${result.culprit_name} was the culprit.`}
        </h2>
        <p>{result.explanation}</p>
        <dl>
          <div>
            <dt>Motive</dt>
            <dd>{result.motive}</dd>
          </div>
          <div>
            <dt>Evidence used</dt>
            <dd>{result.used_evidence_ids.length}</dd>
          </div>
        </dl>
        <button type="button" className="detective-primary" onClick={onNewCase}>
          Open another case
        </button>
      </div>
    </section>
  );
}

function StatusMessages({
  error,
  busy,
  onDismiss,
}: {
  error: string;
  busy: string | null;
  onDismiss: () => void;
}) {
  return (
    <div className="detective-status-region" aria-live="polite">
      {error ? (
        <div className="detective-alert" role="alert">
          <span>{error}</span>
          <button type="button" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
      {busy ? (
        <div className="detective-busy" role="status">
          <span className="detective-loader" aria-hidden="true" />
          {busy}…
        </div>
      ) : null}
    </div>
  );
}

async function requestCase(
  path: string,
  init?: RequestInit,
): Promise<DetectiveCaseView> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const data = (await response.json().catch(() => ({}))) as CaseResponse;
  if (!response.ok) {
    throw new Error(
      data.error?.message ?? "The case file could not be updated. Try again.",
    );
  }
  if (!data.case) {
    throw new Error("The server returned an incomplete case file.");
  }
  return data.case;
}

function messageOf(reason: unknown): string {
  if (reason instanceof Error && reason.message) return reason.message;
  return "The case file could not be updated. Try again.";
}

function readActiveCaseId(): string | null {
  try {
    return window.sessionStorage.getItem(ACTIVE_CASE_KEY);
  } catch {
    return null;
  }
}

function rememberActiveCaseId(caseId: string): void {
  try {
    window.sessionStorage.setItem(ACTIVE_CASE_KEY, caseId);
  } catch {
    // A restrictive storage policy only disables resume; the live case still works.
  }
}

function clearActiveCaseId(): void {
  try {
    window.sessionStorage.removeItem(ACTIVE_CASE_KEY);
  } catch {
    // See rememberActiveCaseId.
  }
}

function formatLabel(value: string): string {
  if (value === "scifi") return "Sci-fi";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
