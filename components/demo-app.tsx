"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  SpinOff,
  TemplateId,
  WorldPreview,
  WorldSetupInput,
  WorldView,
} from "@/lib/types";

type TemplateCard = {
  template_id: TemplateId;
  title: string;
  genre: string;
  mood: string[];
  hook: string;
  listener_role: string;
  setup: WorldSetupInput;
};

type ApiProblem = { error?: { message?: string } };
type Stage = "setup" | "preview" | "play";

const CUSTOM_SETUP: WorldSetupInput = {
  template_id: "create_your_own",
  story_brief:
    "A living world where one urgent decision changes a relationship and the future of the story.",
  genre: "Interactive mystery",
  mood: ["cinematic", "mysterious"],
  listener_role: "The person whose decisions reshape the world",
  main_conflict:
    "Reach the truth without losing the person who trusts you most",
  world_rules: ["Every major choice has a visible cost."],
  character_overrides: [
    { prototype: "ally", name: "", instruction: "A trusted but vulnerable ally" },
    { prototype: "rival", name: "", instruction: "A persuasive personal rival" },
    {
      prototype: "mystery_keeper",
      name: "",
      instruction: "A distant keeper of the world's deepest secret",
    },
  ],
  customization_prompt: "",
  language: "English",
  content_tone: "family_safe",
};

export function DemoApp() {
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [setup, setSetup] = useState<WorldSetupInput | null>(null);
  const [stage, setStage] = useState<Stage>("setup");
  const [preview, setPreview] = useState<WorldPreview | null>(null);
  const [world, setWorld] = useState<WorldView | null>(null);
  const [busy, setBusy] = useState<string | null>("Loading worlds");
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [activeSpinOff, setActiveSpinOff] = useState<SpinOff | null>(null);

  useEffect(() => {
    void api<{ templates: TemplateCard[] }>("/api/demo/templates")
      .then((data) => {
        setTemplates(data.templates);
        setSetup(clone(data.templates[0].setup));
      })
      .catch((reason) => setError(messageOf(reason)))
      .finally(() => setBusy(null));
  }, []);

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  async function generatePreview() {
    if (!setup) return;
    setBusy("Building your world with OpenAI");
    setError("");
    setActiveSpinOff(null);
    try {
      const data = await api<{ preview: WorldPreview }>(
        "/api/demo/world-previews",
        { method: "POST", body: JSON.stringify(setup) },
      );
      setPreview(data.preview);
      setStage("preview");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  async function launchWorld() {
    if (!preview) return;
    setBusy("Starting the story");
    setError("");
    try {
      const data = await api<{ world: WorldView }>("/api/demo/worlds", {
        method: "POST",
        body: JSON.stringify({ preview_id: preview.preview_id }),
      });
      setWorld(data.world);
      setStage("play");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  async function choose(choiceId: string) {
    if (!world || busy) return;
    setBusy("Writing the next beat");
    setError("");
    setActiveSpinOff(null);
    stopAudio();
    try {
      const data = await api<{ world: WorldView }>(
        `/api/demo/worlds/${world.universe_id}/choose`,
        {
          method: "POST",
          body: JSON.stringify({
            branch_id: world.branch_id,
            choice_id: choiceId,
          }),
        },
      );
      setWorld(data.world);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  async function listen() {
    if (!world || busy) return;
    setBusy("Generating an AI voice");
    setError("");
    try {
      const response = await fetch(
        `/api/demo/worlds/${world.universe_id}/audio`,
        { method: "POST" },
      );
      if (!response.ok) throw await response.json();
      const nextUrl = URL.createObjectURL(await response.blob());
      stopAudio();
      setAudioUrl(nextUrl);
      requestAnimationFrame(() => {
        const player = document.querySelector<HTMLAudioElement>("#story-audio");
        void player?.play();
      });
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  async function createSpinOff(characterId: string) {
    if (!world?.last_event || busy) return;
    setBusy("Opening a private spin-off");
    setError("");
    try {
      const data = await api<{ spin_off: SpinOff }>(
        `/api/demo/worlds/${world.universe_id}/spin-offs`,
        {
          method: "POST",
          body: JSON.stringify({
            source_branch_id: world.branch_id,
            source_event_id: world.last_event.event_id,
            character_id: characterId,
          }),
        },
      );
      setActiveSpinOff(data.spin_off);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  async function startOver() {
    if (world) {
      await fetch(`/api/demo/worlds/${world.universe_id}/reset`, {
        method: "POST",
      }).catch(() => undefined);
    }
    stopAudio();
    setWorld(null);
    setPreview(null);
    setActiveSpinOff(null);
    setStage("setup");
    setError("");
  }

  function stopAudio() {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
  }

  function selectTemplate(template: TemplateCard | "custom") {
    setPreview(null);
    setWorld(null);
    setStage("setup");
    setSetup(
      template === "custom" ? clone(CUSTOM_SETUP) : clone(template.setup),
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => void startOver()}>
          <span className="brand-mark">PM</span>
          <span>
            <strong>Pocket Multiverse</strong>
            <small>Living audio stories</small>
          </span>
        </button>
        <span className="status-chip">
          <i />
          OpenAI + deterministic state
        </span>
      </header>

      {error ? (
        <div className="notice error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      ) : null}
      {busy ? (
        <div className="notice busy" role="status">
          <span className="spinner" />
          {busy}…
        </div>
      ) : null}

      {stage === "setup" && setup ? (
        <SetupScreen
          templates={templates}
          setup={setup}
          setSetup={setSetup}
          selectTemplate={selectTemplate}
          submit={generatePreview}
          busy={Boolean(busy)}
        />
      ) : null}
      {stage === "preview" && preview ? (
        <PreviewScreen
          preview={preview}
          back={() => setStage("setup")}
          launch={launchWorld}
          busy={Boolean(busy)}
        />
      ) : null}
      {stage === "play" && world ? (
        <PlayerScreen
          world={world}
          activeSpinOff={activeSpinOff}
          audioUrl={audioUrl}
          choose={choose}
          listen={listen}
          createSpinOff={createSpinOff}
          closeSpinOff={() => setActiveSpinOff(null)}
          reset={startOver}
          busy={Boolean(busy)}
        />
      ) : null}
    </main>
  );
}

function SetupScreen({
  templates,
  setup,
  setSetup,
  selectTemplate,
  submit,
  busy,
}: {
  templates: TemplateCard[];
  setup: WorldSetupInput;
  setSetup: (setup: WorldSetupInput) => void;
  selectTemplate: (template: TemplateCard | "custom") => void;
  submit: () => void;
  busy: boolean;
}) {
  const selected = setup.template_id;
  return (
    <section className="content setup-screen">
      <div className="hero">
        <p className="eyebrow">Hackathon MVP</p>
        <h1>Start a world. Make one choice. Watch it remember.</h1>
        <p>
          Begin with a tested universe or describe your own. OpenAI writes the
          story; the game engine owns every permanent consequence.
        </p>
      </div>

      <section className="section-block">
        <div className="section-heading">
          <span>01</span>
          <div>
            <h2>Choose a starting world</h2>
            <p>You can rewrite any detail before it becomes canon.</p>
          </div>
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <button
              className={`template-card ${
                selected === template.template_id ? "selected" : ""
              }`}
              key={template.template_id}
              onClick={() => selectTemplate(template)}
            >
              <small>{template.genre}</small>
              <strong>{template.title}</strong>
              <p>{template.hook}</p>
              <span>{template.mood.join(" · ")}</span>
            </button>
          ))}
          <button
            className={`template-card custom ${
              selected === "create_your_own" ? "selected" : ""
            }`}
            onClick={() => selectTemplate("custom")}
          >
            <small>Blank canvas</small>
            <strong>Create your own</strong>
            <p>Give the AI a premise, role, conflict, and three character ideas.</p>
            <span>Uses a tested game skeleton</span>
          </button>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <span>02</span>
          <div>
            <h2>Shape the story</h2>
            <p>Simple context in, coherent world out.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="field wide">
            <span>World and story premise</span>
            <textarea
              value={setup.story_brief}
              onChange={(event) =>
                setSetup({ ...setup, story_brief: event.target.value })
              }
              rows={4}
            />
          </label>
          <label className="field">
            <span>Genre</span>
            <input
              value={setup.genre}
              onChange={(event) =>
                setSetup({ ...setup, genre: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Mood, comma separated</span>
            <input
              value={setup.mood.join(", ")}
              onChange={(event) =>
                setSetup({
                  ...setup,
                  mood: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean)
                    .slice(0, 3),
                })
              }
            />
          </label>
          <label className="field">
            <span>Your role</span>
            <input
              value={setup.listener_role}
              onChange={(event) =>
                setSetup({ ...setup, listener_role: event.target.value })
              }
            />
          </label>
          <label className="field">
            <span>Main conflict</span>
            <input
              value={setup.main_conflict}
              onChange={(event) =>
                setSetup({ ...setup, main_conflict: event.target.value })
              }
            />
          </label>
          <label className="field wide">
            <span>Change anything with one prompt</span>
            <textarea
              value={setup.customization_prompt}
              onChange={(event) =>
                setSetup({ ...setup, customization_prompt: event.target.value })
              }
              placeholder="Example: Set it in Mumbai in 2095, make the rival my older sister, and add a slow-burn romance."
              rows={3}
            />
          </label>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <span>03</span>
          <div>
            <h2>Character prototypes</h2>
            <p>Names are optional. Their dramatic jobs stay consistent.</p>
          </div>
        </div>
        <div className="character-inputs">
          {setup.character_overrides.map((character, index) => (
            <div className="character-input" key={character.prototype}>
              <span className={`prototype ${character.prototype}`}>
                {labelPrototype(character.prototype)}
              </span>
              <input
                aria-label={`${character.prototype} name`}
                placeholder="Character name"
                value={character.name}
                onChange={(event) => {
                  const overrides = clone(setup.character_overrides);
                  overrides[index].name = event.target.value;
                  setSetup({ ...setup, character_overrides: overrides });
                }}
              />
              <textarea
                aria-label={`${character.prototype} direction`}
                value={character.instruction}
                rows={3}
                onChange={(event) => {
                  const overrides = clone(setup.character_overrides);
                  overrides[index].instruction = event.target.value;
                  setSetup({ ...setup, character_overrides: overrides });
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="action-row">
        <p>
          The preview is editable and nothing becomes permanent until you start
          the world.
        </p>
        <button className="primary" disabled={busy} onClick={submit}>
          Generate world preview
        </button>
      </div>
    </section>
  );
}

function PreviewScreen({
  preview,
  back,
  launch,
  busy,
}: {
  preview: WorldPreview;
  back: () => void;
  launch: () => void;
  busy: boolean;
}) {
  return (
    <section className="content preview-screen">
      <div className="subnav">
        <button className="text-button" onClick={back}>
          ← Edit setup
        </button>
        <span className={`generation ${preview.generation.provider}`}>
          {preview.generation.provider === "openai"
            ? `Generated by ${preview.generation.model}`
            : "Safe fallback used"}
        </span>
      </div>
      <div className="preview-hero">
        <p className="eyebrow">{preview.seed.universe.genre}</p>
        <h1>{preview.seed.universe.title}</h1>
        <p>{preview.seed.universe.premise}</p>
        <div className="pill-row">
          {preview.seed.universe.mood.map((mood) => (
            <span className="pill" key={mood}>
              {mood}
            </span>
          ))}
        </div>
      </div>

      <div className="preview-columns">
        <article className="panel">
          <h2>Story contract</h2>
          <dl className="facts">
            <div>
              <dt>You play</dt>
              <dd>{preview.seed.story.listener_role}</dd>
            </div>
            <div>
              <dt>Main goal</dt>
              <dd>{preview.seed.story.main_goal}</dd>
            </div>
            <div>
              <dt>Central question</dt>
              <dd>{preview.seed.story.central_question}</dd>
            </div>
          </dl>
          <h3>World rules</h3>
          <ul>
            {preview.seed.universe.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h2>Opening scene</h2>
          <small>{preview.seed.opening_scene.location}</small>
          <p>{preview.seed.opening_narration}</p>
        </article>
      </div>

      <h2 className="standalone-heading">Cast</h2>
      <div className="cast-grid">
        {preview.seed.characters.map((character) => (
          <article className="cast-card" key={character.prototype}>
            <span className={`prototype ${character.prototype}`}>
              {labelPrototype(character.prototype)}
            </span>
            <h3>{character.name}</h3>
            <p>{character.role_in_world}</p>
            <small>{character.relationship_to_listener}</small>
          </article>
        ))}
      </div>

      {preview.creative_diffs.length ? (
        <details className="panel change-review">
          <summary>See what changed from the starter</summary>
          {preview.creative_diffs.map((diff) => (
            <div className="diff-row" key={diff.field}>
              <strong>{diff.field}</strong>
              <span>{diff.before}</span>
              <span>{diff.after}</span>
            </div>
          ))}
        </details>
      ) : null}

      <div className="action-row">
        <p>Starting creates a private branch with its own state and memories.</p>
        <button className="primary" disabled={busy} onClick={launch}>
          Start this world
        </button>
      </div>
    </section>
  );
}

function PlayerScreen({
  world,
  activeSpinOff,
  audioUrl,
  choose,
  listen,
  createSpinOff,
  closeSpinOff,
  reset,
  busy,
}: {
  world: WorldView;
  activeSpinOff: SpinOff | null;
  audioUrl: string;
  choose: (choiceId: string) => void;
  listen: () => void;
  createSpinOff: (characterId: string) => void;
  closeSpinOff: () => void;
  reset: () => void;
  busy: boolean;
}) {
  const names = useMemo(
    () =>
      new Map(
        world.characters.map((character) => [
          character.character_id,
          character.name,
        ]),
      ),
    [world.characters],
  );

  return (
    <section className="player">
      <div className="player-header">
        <div>
          <p className="eyebrow">
            Chapter {world.plot_progress.current_beat_index + 1} of{" "}
            {world.plot_progress.total_beats} ·{" "}
            {world.plot_progress.current_beat.beat_type}
          </p>
          <h1>{world.universe.title}</h1>
          <p className="chapter-title">
            {world.plot_progress.current_beat.title}
          </p>
        </div>
        <div className="player-actions">
          <button className="secondary" onClick={listen} disabled={busy}>
            ▶ Listen
          </button>
          <button className="text-button" onClick={() => void reset()}>
            Start over
          </button>
        </div>
      </div>

      <div className="progress" aria-label="Story progress">
        <span
          style={{
            width: `${
              (world.plot_progress.current_beat_index /
                (world.plot_progress.total_beats - 1)) *
              100
            }%`,
          }}
        />
      </div>
      <div className="player-layout">
        <div className="story-column">
          <article className="scene-card">
            <div className="scene-meta">
              <span>{world.scene.location}</span>
              <span>
                {world.generation.provider === "openai"
                  ? "OpenAI fast path"
                  : "Deterministic fallback"}
              </span>
            </div>
            <h2 className="scene-title">{world.scene.title}</h2>
            <p className="scene-goal">
              <strong>Current objective</strong>
              {world.scene.scene_goal}
            </p>
            <p className="narration">{world.scene.narration}</p>
            {world.scene.dialogue.map((line) => (
              <blockquote key={`${line.character_id}-${line.text}`}>
                <strong>{names.get(line.character_id)}</strong>
                {line.text}
              </blockquote>
            ))}
            {world.scene.new_information ? (
              <div className="discovery">
                <strong>New discovery</strong>
                <span>{world.scene.new_information}</span>
              </div>
            ) : null}
            {audioUrl ? (
              <div className="audio-wrap">
                <audio id="story-audio" controls src={audioUrl} />
                <small>AI-generated voice</small>
              </div>
            ) : null}
          </article>

          {world.state.goal_status === "completed" ? (
            <div className="ending">
              <h2>This branch reached its ending.</h2>
              <p>Your events and character memories remain available below.</p>
            </div>
          ) : (
            <section className="choices">
              <p className="eyebrow">What do you do?</p>
              {world.choices.map((choice) => (
                <button
                  disabled={busy}
                  onClick={() => choose(choice.choice_id)}
                  key={choice.choice_id}
                >
                  <span>{choice.axis}</span>
                  <strong>{choice.label}</strong>
                </button>
              ))}
            </section>
          )}

          {world.last_event ? (
            <details className="proof" open>
              <summary>Permanent consequence</summary>
              <p>{world.last_event.summary}</p>
              <div className="diff-list">
                {world.last_state_diff.map((diff) => (
                  <div key={diff.path}>
                    <code>{friendlyPath(diff.path)}</code>
                    <span>{formatValue(diff.from)}</span>
                    <b>→</b>
                    <span>{formatValue(diff.to)}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {activeSpinOff ? (
            <article className="spin-off">
              <button onClick={closeSpinOff}>Close</button>
              <p className="eyebrow">Private character branch</p>
              <h2>{activeSpinOff.title}</h2>
              <p>{activeSpinOff.opening_narration}</p>
              <small>
                One-level demo branch · the main story remains unchanged
              </small>
            </article>
          ) : null}
        </div>

        <aside className="world-sidebar">
          <div className="state-strip">
            <div>
              <small>Objective</small>
              <strong>{world.state.objective_status}</strong>
            </div>
            <div>
              <small>Progress</small>
              <strong>
                {world.plot_progress.current_beat_index + 1}/
                {world.plot_progress.total_beats}
              </strong>
            </div>
            <div>
              <small>Memories</small>
              <strong>
                {world.characters.reduce(
                  (total, character) => total + character.memories.length,
                  0,
                )}
              </strong>
            </div>
          </div>

          <details className="trace" open>
            <summary>Plot threads</summary>
            <h4>Questions still open</h4>
            <ul className="thread-list">
              {world.plot_progress.open_threads.map((thread) => (
                <li key={thread}>{thread}</li>
              ))}
            </ul>
            {world.plot_progress.discovered_clues.length ? (
              <>
                <h4>Discoveries</h4>
                <ul className="thread-list clues">
                  {world.plot_progress.discovered_clues
                    .slice(-3)
                    .map((clue) => (
                      <li key={clue}>{clue}</li>
                    ))}
                </ul>
              </>
            ) : null}
          </details>

          <h2>Living characters</h2>
          <div className="character-stack">
            {world.characters.map((character) => (
              <details className="character-card" key={character.character_id}>
                <summary>
                  <span className={`avatar ${character.prototype}`}>
                    {character.name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{character.name}</strong>
                    <small>{labelPrototype(character.prototype)}</small>
                  </span>
                  <span className="relationship">
                    {character.relationship.trust} trust
                  </span>
                </summary>
                <p>{character.relationship_to_listener}</p>
                <div className="meter-row">
                  <span>
                    Trust
                    <i style={{ width: `${character.relationship.trust}%` }} />
                  </span>
                  <span>
                    Tension
                    <i style={{ width: `${character.relationship.tension}%` }} />
                  </span>
                </div>
                <h4>What they remember</h4>
                {character.memories.length ? (
                  <ul className="memory-list">
                    {character.memories.map((memory) => (
                      <li key={memory.memory_id}>{memory.text}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No shared event yet.</p>
                )}
                {character.unlocked_facts.map((fact) => (
                  <p className="unlocked" key={fact.fact_id}>
                    Unlocked: {fact.text}
                  </p>
                ))}
                <button
                  className="secondary full"
                  disabled={!world.last_event || busy}
                  onClick={() => createSpinOff(character.character_id)}
                >
                  Start their spin-off
                </button>
              </details>
            ))}
          </div>

          {world.context_trace ? (
            <details className="trace">
              <summary>Context trace</summary>
              <dl>
                <div>
                  <dt>Active plot beat</dt>
                  <dd>{world.context_trace.plot_beat}</dd>
                </div>
                <div>
                  <dt>Recent events</dt>
                  <dd>{world.context_trace.recent_event_ids.length}</dd>
                </div>
                <div>
                  <dt>Memories loaded</dt>
                  <dd>{world.context_trace.memory_ids.length}</dd>
                </div>
                <div>
                  <dt>Facts unlocked</dt>
                  <dd>{world.context_trace.unlocked_fact_ids.length}</dd>
                </div>
                <div>
                  <dt>Valid choices</dt>
                  <dd>{world.context_trace.valid_choice_count}</dd>
                </div>
              </dl>
            </details>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = (await response.json()) as T & ApiProblem;
  if (!response.ok) throw data;
  return data;
}

function messageOf(reason: unknown): string {
  if (
    reason &&
    typeof reason === "object" &&
    "error" in reason &&
    reason.error &&
    typeof reason.error === "object" &&
    "message" in reason.error &&
    typeof reason.error.message === "string"
  ) {
    return reason.error.message;
  }
  return reason instanceof Error
    ? reason.message
    : "Something went wrong. Please try again.";
}

function labelPrototype(value: string): string {
  if (value === "mystery_keeper") return "Mystery keeper";
  return value[0].toUpperCase() + value.slice(1);
}

function friendlyPath(value: string): string {
  return value.replaceAll("_", " ").replaceAll(".", " / ");
}

function formatValue(value: string | number | string[]): string {
  return Array.isArray(value) ? value.join(", ") || "none" : String(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
