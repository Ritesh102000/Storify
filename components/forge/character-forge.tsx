"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ForgeStorySummary,
  ForgedCharacter,
  ForgedCharacterSummary,
  InterviewAnswers,
  Origin,
  PortraitStyle,
} from "@/lib/forge/types";
import { PORTRAIT_STYLE_LABELS, PORTRAIT_STYLES } from "@/lib/forge/types";
import { INTERVIEW_STEPS } from "./interview-steps";
import { MicButton } from "./mic-button";

type View = "library" | "setup" | "interview" | "sheet";
type CreationOrigin = Extract<Origin, "interviewed" | "self">;
type CreationScope = "standalone" | "story";
type CreationSetup = {
  origin: CreationOrigin;
  scope: CreationScope;
  storyId?: string;
  seed?: string;
};

export function CharacterForge() {
  const [view, setView] = useState<View>("library");
  const [characters, setCharacters] = useState<ForgedCharacterSummary[]>([]);
  const [stories, setStories] = useState<ForgeStorySummary[]>([]);
  const [creation, setCreation] = useState<CreationSetup>({
    origin: "interviewed",
    scope: "standalone",
  });
  const [active, setActive] = useState<ForgedCharacter | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/forge/characters");
      const data = (await response.json()) as {
        characters?: ForgedCharacterSummary[];
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Could not load your characters.");
      }
      setCharacters(data.characters ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load your characters.",
      );
    }
  }, []);

  const refreshStories = useCallback(async () => {
    try {
      const response = await fetch("/api/forge/stories");
      const data = (await response.json()) as {
        stories?: ForgeStorySummary[];
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Could not load your stories.");
      }
      setStories(data.stories ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not load your stories.",
      );
    }
  }, []);

  useEffect(() => {
    // Load once on mount; the abort guard keeps the lint rule satisfied and
    // stops a late response from writing into an unmounted view.
    let cancelled = false;
    void (async () => {
      const [characterResponse, storyResponse] = await Promise.all([
        fetch("/api/forge/characters").catch(() => null),
        fetch("/api/forge/stories").catch(() => null),
      ]);
      if (cancelled) return;
      if (storyResponse) {
        const storyData = (await storyResponse.json().catch(() => ({}))) as {
          stories?: ForgeStorySummary[];
          error?: { message?: string };
        };
        if (storyResponse.ok) setStories(storyData.stories ?? []);
      }
      if (!characterResponse) return;
      const data = (await characterResponse.json().catch(() => ({}))) as {
        characters?: ForgedCharacterSummary[];
        error?: { message?: string };
      };
      if (cancelled) return;
      if (!characterResponse.ok) {
        setError(data.error?.message ?? "Could not load your characters.");
        return;
      }
      setCharacters(data.characters ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(answers: InterviewAnswers) {
    setBusy("Building them");
    setError("");
    try {
      const response = await fetch("/api/forge/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          origin: creation.origin,
          ...(creation.scope === "story" && creation.storyId
            ? { story_id: creation.storyId }
            : {}),
        }),
      });
      const data = (await response.json()) as {
        character?: ForgedCharacter;
        error?: { message?: string };
      };
      if (!response.ok || !data.character) {
        throw new Error(data.error?.message ?? "Could not build the character.");
      }
      setActive(data.character);
      setView("sheet");
      void refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  function beginSetup() {
    setCreation({ origin: "interviewed", scope: "standalone" });
    setView("setup");
    setError("");
    void refreshStories();
  }

  async function open(characterId: string) {
    setBusy("Opening");
    setError("");
    try {
      const response = await fetch(`/api/forge/characters/${characterId}`);
      const data = (await response.json()) as {
        character?: ForgedCharacter;
        error?: { message?: string };
      };
      if (!response.ok || !data.character) {
        throw new Error(data.error?.message ?? "Could not open that character.");
      }
      setActive(data.character);
      setView("sheet");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not open that character.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(characterId: string) {
    setBusy("Removing");
    setError("");
    try {
      const response = await fetch(`/api/forge/characters/${characterId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Could not remove that character.");
      }
      setActive(null);
      setView("library");
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not remove that character.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="forge">
      {error ? <p className="forge-error">{error}</p> : null}
      {busy ? <p className="forge-busy">{busy}…</p> : null}

      {view === "library" ? (
        <Library characters={characters} onNew={beginSetup} onOpen={open} />
      ) : null}

      {view === "setup" ? (
        <ForgeSetup
          stories={stories}
          value={creation}
          onChange={setCreation}
          onCancel={() => setView("library")}
          onContinue={() => setView("interview")}
        />
      ) : null}

      {view === "interview" ? (
        <Interview
          busy={Boolean(busy)}
          origin={creation.origin}
          seed={creation.seed}
          story={
            creation.scope === "story" && creation.storyId
              ? stories.find((story) => story.universe_id === creation.storyId)
              : undefined
          }
          onCancel={() => setView("setup")}
          onFinish={create}
        />
      ) : null}

      {view === "sheet" && active ? (
        <Sheet
          character={active}
          onChange={setActive}
          onBack={() => {
            setView("library");
            void refresh();
          }}
          onDelete={() => void remove(active.character_id)}
        />
      ) : null}
    </section>
  );
}

function Library({
  characters,
  onNew,
  onOpen,
}: {
  characters: ForgedCharacterSummary[];
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="forge-library">
      <header className="forge-head">
        <div>
          <h1>Your characters</h1>
          <p>
            People with their own identity, saved independently and ready for
            any world you choose later.
          </p>
        </div>
        <button type="button" className="forge-primary" onClick={onNew}>
          + Forge someone
        </button>
      </header>

      {characters.length === 0 ? (
        <div className="forge-empty">
          <p>No one here yet.</p>
          <p className="forge-empty-sub">
            Building someone takes about a minute. You will be asked nine
            questions, and you can skip any of them.
          </p>
          <button type="button" className="forge-primary" onClick={onNew}>
            Start
          </button>
        </div>
      ) : (
        <div className="forge-grid">
          {characters.map((character) => (
            <button
              key={character.character_id}
              type="button"
              className="forge-card"
              onClick={() => onOpen(character.character_id)}
            >
              <span className="forge-portrait">
                {character.has_portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/forge/characters/${character.character_id}/portrait`}
                    alt={`Portrait of ${character.name}`}
                    loading="lazy"
                  />
                ) : (
                  <span className="forge-portrait-empty">no portrait</span>
                )}
              </span>
              <span className="forge-card-name">{character.name}</span>
              <span className="forge-card-role">{character.role}</span>
              <span className="forge-card-meta">
                {character.origin === "self"
                  ? "you"
                  : character.archetype.replace("_", " ")}
                {" · "}
                {character.story_binding?.title ?? "independent"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ForgeSetup({
  stories,
  value,
  onChange,
  onCancel,
  onContinue,
}: {
  stories: ForgeStorySummary[];
  value: CreationSetup;
  onChange: (value: CreationSetup) => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const selectedStory = value.storyId
    ? stories.find((story) => story.universe_id === value.storyId)
    : undefined;

  return (
    <div className="forge-setup forge-interview-main">
      <p className="forge-step-count">Create an independent character</p>
      <h2 className="forge-question">Build a person, not a scene role.</h2>
      <p className="forge-setup-intro">
        Their personality and history live in your character library. A saved
        story can shape them, but it is optional and never owns them.
      </p>

      <div className="forge-origin-grid">
        <button
          type="button"
          className={`forge-card forge-mode-card ${
            value.origin === "interviewed" ? "is-selected" : ""
          }`}
          onClick={() => onChange({ ...value, origin: "interviewed" })}
        >
          <span className="forge-card-name">A fictional character</span>
          <span className="forge-card-role">
            Build someone new from your answers.
          </span>
        </button>
        <button
          type="button"
          className={`forge-card forge-mode-card ${
            value.origin === "self" ? "is-selected" : ""
          }`}
          onClick={() => onChange({ ...value, origin: "self" })}
        >
          <span className="forge-card-name">Make me a character</span>
          <span className="forge-card-role">
            Fictionalise your answers, then use your photo for the portrait.
          </span>
        </button>
      </div>

      <label className="forge-seed-field">
        <span>Describe their core in one sentence — optional</span>
        <textarea
          rows={3}
          maxLength={600}
          value={value.seed ?? ""}
          onChange={(event) =>
            onChange({ ...value, seed: event.target.value || undefined })
          }
          placeholder="A brilliant paramedic who can save anyone except the brother who stopped speaking to her."
        />
        <small>
          Describe the person, not a current scene. The interview will turn this
          into lasting motives, boundaries, relationships, and a voice.
        </small>
      </label>

      <p className="forge-step-count forge-scope-label">
        Where should they begin?
      </p>
      <div className="forge-scope-grid">
        <button
          type="button"
          className={`forge-scope-card ${
            value.scope === "standalone" ? "is-selected" : ""
          }`}
          aria-pressed={value.scope === "standalone"}
          onClick={() =>
            onChange({
              ...value,
              scope: "standalone",
              storyId: undefined,
            })
          }
        >
          <strong>Independent character</strong>
          <span>
            Build their permanent identity without tying it to a plot, place,
            genre, or scene.
          </span>
          <small>Recommended</small>
        </button>
        <button
          type="button"
          className={`forge-scope-card ${
            value.scope === "story" ? "is-selected" : ""
          }`}
          aria-pressed={value.scope === "story"}
          disabled={!stories.length}
          onClick={() =>
            onChange({
              ...value,
              scope: "story",
              storyId: value.storyId ?? stories[0]?.universe_id,
            })
          }
        >
          <strong>Shape for a saved world</strong>
          <span>
            Use one Living Story as optional design context. This still does
            not cast or lock the character.
          </span>
          <small>{stories.length ? `${stories.length} available` : "No saved worlds"}</small>
        </button>
      </div>

      {value.scope === "story" ? (
        <>
          <label className="forge-story-select">
            <span>Choose the optional world context</span>
            <select
              value={value.storyId ?? ""}
              onChange={(event) =>
                onChange({
                  ...value,
                  storyId: event.target.value || undefined,
                })
              }
            >
              <option value="">Choose a saved story</option>
              {stories.map((story) => (
                <option key={story.universe_id} value={story.universe_id}>
                  {story.title} · {story.genre}
                </option>
              ))}
            </select>
          </label>
          {selectedStory ? (
            <div className="forge-story-context">
              <strong>{selectedStory.title}</strong>
              <p>{selectedStory.premise || selectedStory.main_goal}</p>
              <small>
                This supplies background only. It does not add the character to
                the live cast or make the world part of their identity.
              </small>
            </div>
          ) : null}
        </>
      ) : (
        <div className="forge-independent-note">
          <strong>They will stand on their own.</strong>
          <span>
            Their sheet is generated from enduring traits and history, not from
            a temporary objective or scene.
          </span>
        </div>
      )}

      <div className="forge-actions">
        <button type="button" className="forge-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="forge-primary"
          onClick={onContinue}
          disabled={value.scope === "story" && !value.storyId}
        >
          Start interview
        </button>
      </div>
    </div>
  );
}

function Interview({
  onFinish,
  onCancel,
  busy,
  origin,
  seed,
  story,
}: {
  onFinish: (answers: InterviewAnswers) => void;
  onCancel: () => void;
  busy: boolean;
  origin: CreationOrigin;
  seed?: string;
  story?: ForgeStorySummary;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<InterviewAnswers>(() =>
    seed?.trim() ? { seed: seed.trim() } : {},
  );
  const step = INTERVIEW_STEPS[index];
  const isLast = index === INTERVIEW_STEPS.length - 1;
  const value = String(answers[step.field] ?? "");
  const secondaryValue = step.secondaryField
    ? String(answers[step.secondaryField] ?? "")
    : "";

  const filled = useMemo(
    () =>
      INTERVIEW_STEPS.filter(
        (candidate) =>
          Boolean(answers[candidate.field]) ||
          Boolean(
            candidate.secondaryField
              ? answers[candidate.secondaryField]
              : undefined,
          ),
      ).length,
    [answers],
  );

  function update(field: keyof InterviewAnswers, nextValue: string) {
    setAnswers((current) => ({ ...current, [field]: nextValue }));
  }

  function appendSpokenAnswer(
    field: keyof InterviewAnswers,
    spokenText: string,
  ) {
    setAnswers((current) => {
      const existing = String(current[field] ?? "").trim();
      return {
        ...current,
        [field]: existing ? `${existing} ${spokenText}` : spokenText,
      };
    });
  }

  function commit(skip: boolean) {
    let next: InterviewAnswers = { ...answers };
    if (skip) {
      next = { ...next, [step.field]: undefined };
      if (step.secondaryField) {
        next = { ...next, [step.secondaryField]: undefined };
      }
      setAnswers(next);
    } else {
      next = {
        ...next,
        [step.field]: value.trim() || undefined,
      };
      if (step.secondaryField) {
        next = {
          ...next,
          [step.secondaryField]: secondaryValue.trim() || undefined,
        };
      }
      setAnswers(next);
    }
    if (isLast) onFinish(next);
    else setIndex((current) => current + 1);
  }

  return (
    <div className="forge-interview">
      <div className="forge-interview-main">
        <p className="forge-interview-context">
          {origin === "self" ? "Making you a character" : "Making someone new"}
          {" · "}
          {story?.title ?? "Independent character"}
        </p>
        <p className="forge-step-count">
          Step {index + 1} of {INTERVIEW_STEPS.length}
        </p>
        <div className="forge-progress" aria-hidden="true">
          {INTERVIEW_STEPS.map((_, position) => (
            <span
              key={position}
              className={
                position < index
                  ? "is-done"
                  : position === index
                    ? "is-current"
                    : ""
              }
            />
          ))}
        </div>

        <p className="forge-defines">{step.defines}</p>
        <h2 className="forge-question">{step.question}</h2>

        {step.secondaryField ? (
          <div className="forge-identity-grid">
            <label>
              <span>{step.label ?? "Answer"}</span>
              <input
                value={value}
                placeholder={step.placeholder}
                onChange={(event) => update(step.field, event.target.value)}
                disabled={busy}
                autoFocus
              />
            </label>
            <label>
              <span>{step.secondaryLabel}</span>
              <input
                value={secondaryValue}
                placeholder={step.secondaryPlaceholder}
                onChange={(event) =>
                  update(step.secondaryField!, event.target.value)
                }
                disabled={busy}
              />
            </label>
            <div className="forge-voice-name">
              <span>Prefer to speak the name?</span>
              <MicButton
                disabled={busy}
                onText={(text) => appendSpokenAnswer(step.field, text)}
              />
            </div>
          </div>
        ) : (
          <div className="forge-input-row">
            <textarea
              value={value}
              rows={3}
              aria-label={step.question}
              placeholder={step.placeholder}
              onChange={(event) => update(step.field, event.target.value)}
              disabled={busy}
              autoFocus
            />
            <MicButton
              disabled={busy}
              onText={(text) => appendSpokenAnswer(step.field, text)}
            />
          </div>
        )}

        {step.suggestions ? (
          <div className="forge-suggestions">
            {step.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => update(step.field, suggestion)}
                disabled={busy}
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div className="forge-actions">
          <div className="forge-actions-left">
            {index > 0 ? (
              <button
                type="button"
                className="forge-ghost"
                onClick={() => setIndex((current) => current - 1)}
                disabled={busy}
              >
                ← Back
              </button>
            ) : null}
            <button
              type="button"
              className="forge-ghost"
              onClick={() => commit(true)}
              disabled={busy}
            >
              Skip — decide for me
            </button>
          </div>
          <div className="forge-actions-right">
            <button
              type="button"
              className="forge-ghost"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="forge-primary"
              onClick={() => commit(false)}
              disabled={busy}
            >
              {isLast ? "Build them" : "Next"}
            </button>
          </div>
        </div>

        {index >= 3 ? (
          <button
            type="button"
            className="forge-escape"
            onClick={() => onFinish(answers)}
            disabled={busy}
          >
            Fill the rest for me
          </button>
        ) : null}
      </div>

      <aside className="forge-live">
        <p className="forge-live-label">Taking shape</p>
        <dl>
          {(
            [
              ["Name", answers.name],
              ["Role", answers.role],
              ["Wants", answers.want],
              ["Needs", answers.need],
              ["Wound", answers.wound],
              ["Cornered", answers.tactic],
              ["Won't cross", answers.boundary],
            ] as const
          ).map(([label, text]) => (
            <div key={label} className={text ? "is-set" : ""}>
              <dt>{label}</dt>
              <dd>{text || "—"}</dd>
            </div>
          ))}
        </dl>
        <p className="forge-live-count">{filled} of 9 steps shaped</p>
      </aside>
    </div>
  );
}

function Sheet({
  character,
  onChange,
  onBack,
  onDelete,
}: {
  character: ForgedCharacter;
  onChange: (character: ForgedCharacter) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceName, setReferenceName] = useState("");
  const [referenceConsent, setReferenceConsent] = useState(false);

  async function patch(field: keyof ForgedCharacter, next: string) {
    const response = await fetch(
      `/api/forge/characters/${character.character_id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      },
    );
    const data = (await response.json()) as { character?: ForgedCharacter };
    if (data.character) onChange(data.character);
  }

  async function makePortrait(style: PortraitStyle, useReference = false) {
    if (useReference && (!referenceImage || !referenceConsent)) {
      setNote("Choose a photo and confirm you have the right to use it.");
      return;
    }
    setWorking(true);
    setNote(
      useReference
        ? "Turning the reference into a character portrait. This can take up to two minutes."
        : "Painting the portrait. This takes about a minute.",
    );
    try {
      if (style !== character.portrait_style) {
        await patch("portrait_style", style);
      }
      const response = await fetch(
        `/api/forge/characters/${character.character_id}/portrait`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            useReference
              ? {
                  reference_image_base64: referenceImage,
                  reference_mode: "look",
                  subject_type:
                    character.origin === "self" ? "self" : "character",
                  consent_confirmed: referenceConsent,
                }
              : {},
          ),
        },
      );
      const data = (await response.json()) as {
        character?: ForgedCharacter;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(data.error?.message ?? "Portrait failed.");
      if (data.character) onChange({ ...data.character, has_portrait: true });
      if (useReference) {
        setReferenceImage(null);
        setReferenceName("");
        setReferenceConsent(false);
      }
      setNote("");
    } catch (reason) {
      setNote(reason instanceof Error ? reason.message : "Portrait failed.");
    } finally {
      setWorking(false);
    }
  }

  async function chooseReference(file: File | undefined) {
    if (!file) return;
    setNote("Preparing the image…");
    try {
      const dataUrl = await prepareReferenceImage(file);
      setReferenceImage(dataUrl);
      setReferenceName(file.name || "Camera photo");
      setReferenceConsent(false);
      setNote("");
    } catch (reason) {
      setReferenceImage(null);
      setReferenceName("");
      setNote(
        reason instanceof Error ? reason.message : "That image could not be read.",
      );
    }
  }

  const fields: Array<[string, keyof ForgedCharacter, string]> = [
    ["Wants", "want", "What they chase out loud"],
    ["Needs", "need", "What would actually resolve them"],
    ["Wound", "wound", "The unresolved thing"],
    ["Believes", "lie", "The false conclusion they still act on"],
    ["Cornered", "tactic", "What they do under pressure"],
    ["Won't cross", "boundary", "The line they hold"],
    ["Contradiction", "contradiction", "What doesn't fit"],
    ["Tell", "tell", "What their body does"],
    ["Notices first", "notices_first", "What they see walking in"],
    ["Carries", "carries", "What they never leave behind"],
    ["Sounds like", "speech_style", "How they talk"],
    ["Never says", "never_says", "What they avoid"],
    ["A critic would say", "enemy_description", "The honest flaw"],
    ["Owes", "owes", "Who, and for what"],
    ["Calls at 3am", "would_call_at_3am", "Who they turn to"],
    ["Never forgives", "unforgivable", "Where they break"],
  ];

  return (
    <div className="forge-sheet">
      <header className="forge-head">
        <button type="button" className="forge-ghost" onClick={onBack}>
          ← All characters
        </button>
        <button type="button" className="forge-ghost forge-danger" onClick={onDelete}>
          Delete
        </button>
      </header>

      <div className="forge-sheet-body">
        <aside className="forge-sheet-portrait">
          <div className="forge-portrait forge-portrait-large">
            {character.has_portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/forge/characters/${character.character_id}/portrait?v=${character.updated_at}`}
                alt={`Portrait of ${character.name}`}
              />
            ) : (
              <span className="forge-portrait-empty">no portrait yet</span>
            )}
          </div>

          <div className="forge-style-row">
            {PORTRAIT_STYLES.map((style) => (
              <button
                key={style}
                type="button"
                className={style === character.portrait_style ? "is-selected" : ""}
                onClick={() => void makePortrait(style)}
                disabled={working}
              >
                {PORTRAIT_STYLE_LABELS[style]}
              </button>
            ))}
          </div>

          <div className="forge-reference">
            <h3>
              {character.origin === "self"
                ? "Turn yourself into this character"
                : "Use a person as the visual reference"}
            </h3>
            <p>
              Take a photo or choose one from this computer. The original is sent
              only for this portrait request and is not saved in your library.
            </p>

            <div className="forge-reference-actions">
              <label className="forge-ghost forge-file-button">
                Use camera
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  capture="user"
                  style={{ display: "none" }}
                  disabled={working}
                  onChange={(event) => {
                    void chooseReference(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <label className="forge-ghost forge-file-button">
                Upload image
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  disabled={working}
                  onChange={(event) => {
                    void chooseReference(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            {referenceImage ? (
              <div className="forge-reference-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={referenceImage} alt="Selected portrait reference" />
                <span>{referenceName}</span>
                <button
                  type="button"
                  className="forge-ghost"
                  onClick={() => {
                    setReferenceImage(null);
                    setReferenceName("");
                    setReferenceConsent(false);
                  }}
                  disabled={working}
                >
                  Remove
                </button>
              </div>
            ) : null}

            <label className="forge-consent">
              <input
                type="checkbox"
                checked={referenceConsent}
                onChange={(event) => setReferenceConsent(event.target.checked)}
                disabled={!referenceImage || working}
              />
              <span>
                I confirm this is me or I have permission to use this image.
              </span>
            </label>

            <button
              type="button"
              className="forge-primary"
              disabled={!referenceImage || !referenceConsent || working}
              onClick={() => void makePortrait(character.portrait_style, true)}
            >
              {character.origin === "self"
                ? "Make my character portrait"
                : "Use this likeness"}
            </button>
          </div>
          {note ? <p className="forge-note">{note}</p> : null}
        </aside>

        <div className="forge-sheet-fields">
          <p className="forge-character-context">
            {character.origin === "self"
              ? "Made from you"
              : "Fictional character"}
            {" · "}
            {character.story_binding
              ? `Designed for ${character.story_binding.title}`
              : "Independent character"}
          </p>
          <input
            className="forge-name"
            value={character.name}
            onChange={(event) => onChange({ ...character, name: event.target.value })}
            onBlur={(event) => void patch("name", event.target.value)}
          />
          <input
            className="forge-role"
            value={character.role}
            onChange={(event) => onChange({ ...character, role: event.target.value })}
            onBlur={(event) => void patch("role", event.target.value)}
          />

          <dl className="forge-fields">
            {fields.map(([label, field, hint]) => (
              <div key={field}>
                <dt>
                  {label}
                  <span>{hint}</span>
                </dt>
                <dd>
                  <textarea
                    rows={2}
                    value={String(character[field] ?? "")}
                    onChange={(event) =>
                      onChange({ ...character, [field]: event.target.value })
                    }
                    onBlur={(event) => void patch(field, event.target.value)}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

async function prepareReferenceImage(file: File): Promise<string> {
  const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new Error("Use a PNG, JPEG, or WebP image.");
  }
  if (file.size > 25_000_000) {
    throw new Error("That image is too large. Choose one under 25 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadBrowserImage(objectUrl);
    const maxEdge = 1536;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the image.");
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    if (dataUrl.length > 12_000_000) {
      throw new Error("That image is still too large after preparation.");
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadBrowserImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be read."));
    image.src = url;
  });
}
