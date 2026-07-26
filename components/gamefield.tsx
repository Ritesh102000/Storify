"use client";

import { useState } from "react";
import { DemoApp } from "./demo-app";
import { AiDetective } from "./detective/ai-detective";
import { CharacterForge } from "./forge/character-forge";

type GameFieldModuleId =
  | "living-stories"
  | "character-forge"
  | "ai-detective"
  | "world-atlas"
  | "story-arena";

type GameFieldModule = {
  id: GameFieldModuleId;
  name: string;
  tagline: string;
  description: string;
  glyph: string;
  status: "live" | "planned";
};

type WorldPortal = {
  id: string;
  name: string;
  genre: string;
  line: string;
  scene: string;
};

// Each portal paints its own weather in CSS so the hub feels like three places
// rather than three boxes.
const PORTALS: WorldPortal[] = [
  {
    id: "blackmoor",
    name: "Blackmoor",
    genre: "Fantasy thriller",
    line: "The tide is climbing the gate, and someone opened it from the inside.",
    scene: "scene-blackmoor",
  },
  {
    id: "neon_afterlight",
    name: "Neon Afterlight",
    genre: "Cyberpunk mystery",
    line: "An hour is missing from your life, and the city billed someone for it.",
    scene: "scene-neon",
  },
  {
    id: "monsoon_house",
    name: "Monsoon House",
    genre: "Family ghost story",
    line: "The rain keeps saying a name your family spent years unlearning.",
    scene: "scene-monsoon",
  },
];

const MODULES: GameFieldModule[] = [
  {
    id: "living-stories",
    name: "Living Stories",
    tagline: "Worlds that remember",
    description:
      "Describe a world, step inside, and make one choice at a time. The people in it remember what you did and hold it against you later.",
    glyph: "◈",
    status: "live",
  },
  {
    id: "character-forge",
    name: "Character Forge",
    tagline: "Build someone real",
    description:
      "Nine questions, spoken or typed, and a portrait. Give someone a want, a wound, and a lie they believe — then keep them.",
    glyph: "◆",
    status: "live",
  },
  {
    id: "ai-detective",
    name: "AI Detective",
    tagline: "Make the evidence talk",
    description:
      "Search sealed scenes, test every alibi, and build a case before the trail goes cold. The culprit is fixed. Your theory has to earn the truth.",
    glyph: "⌕",
    status: "live",
  },
  {
    id: "world-atlas",
    name: "World Atlas",
    tagline: "Everywhere you've been",
    description:
      "Every world you finish stays on the map. Return to it, branch it, or hand it to someone else to continue.",
    glyph: "❖",
    status: "planned",
  },
  {
    id: "story-arena",
    name: "Story Arena",
    tagline: "Two players, one truth",
    description:
      "Same world, incompatible goals. The story keeps score of what each of you managed to make true.",
    glyph: "◇",
    status: "planned",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Say what kind of world",
    body: "A sentence is enough. A flooded house, a drowned city, a gate nobody should have opened.",
  },
  {
    n: "02",
    title: "Make one hard choice",
    body: "Protect someone, chase the evidence, or force the truth out. Every option costs you the others.",
  },
  {
    n: "03",
    title: "Live with it",
    body: "The choice is committed before a word is written. Characters remember only what they witnessed.",
  },
];

export function GameField() {
  const [openModule, setOpenModule] = useState<GameFieldModuleId | null>(null);

  if (openModule === "ai-detective") {
    return (
      <div className="gf-root">
        <GameFieldBar onHome={() => setOpenModule(null)} moduleName="AI Detective" />
        <AiDetective />
      </div>
    );
  }

  if (openModule === "character-forge") {
    return (
      <div className="gf-root">
        <GameFieldBar onHome={() => setOpenModule(null)} moduleName="Character Forge" />
        <CharacterForge />
      </div>
    );
  }

  if (openModule === "living-stories") {
    return (
      <div className="gf-root">
        <GameFieldBar onHome={() => setOpenModule(null)} moduleName="Living Stories" />
        <DemoApp />
      </div>
    );
  }

  const enter = () => setOpenModule("living-stories");

  return (
    <div className="gf-root gf-home">
      <GameFieldBar onHome={() => setOpenModule(null)} moduleName={null} />

      <main>
        <section className="gf-hero">
          <div className="gf-weather" aria-hidden="true">
            <span className="gf-ember" />
            <span className="gf-ember" />
            <span className="gf-ember" />
            <span className="gf-ember" />
            <span className="gf-ember" />
          </div>
          <div className="gf-hero-inner">
            <p className="gf-eyebrow">AI Storify · GameField</p>
            <h1 className="gf-title">
              Somewhere you keep
              <br />
              <span className="gf-title-accent">coming back to.</span>
            </h1>
            <p className="gf-lede">
              Worlds you can walk into, argue with, and leave a mark on. They stay
              exactly where you left them.
            </p>
            <div className="gf-cta-row">
              <button type="button" className="gf-cta-primary" onClick={enter}>
                Open a world
              </button>
              <a className="gf-cta-ghost" href="#how">
                How it remembers
              </a>
            </div>
          </div>
        </section>

        <section className="gf-portals" aria-label="Starting worlds">
          <header className="gf-section-head">
            <h2>Pick a door</h2>
            <p>Three tested worlds, or describe your own from nothing.</p>
          </header>
          <div className="gf-portal-grid">
            {PORTALS.map((portal) => (
              <button
                key={portal.id}
                type="button"
                className="gf-portal"
                onClick={enter}
              >
                <span className={`gf-portal-scene ${portal.scene}`} aria-hidden="true" />
                <span className="gf-portal-body">
                  <span className="gf-portal-genre">{portal.genre}</span>
                  <span className="gf-portal-name">{portal.name}</span>
                  <span className="gf-portal-line">{portal.line}</span>
                </span>
                <span className="gf-portal-go">Enter →</span>
              </button>
            ))}
            <button type="button" className="gf-portal gf-portal-blank" onClick={enter}>
              <span className="gf-portal-scene scene-blank" aria-hidden="true" />
              <span className="gf-portal-body">
                <span className="gf-portal-genre">Blank canvas</span>
                <span className="gf-portal-name">Your own</span>
                <span className="gf-portal-line">
                  One sentence and the world builds itself around it.
                </span>
              </span>
              <span className="gf-portal-go">Describe it →</span>
            </button>
          </div>
        </section>

        <section className="gf-how" id="how">
          <header className="gf-section-head">
            <h2>How a world remembers</h2>
            <p>
              The story is written live, but nothing important is left to chance.
            </p>
          </header>
          <ol className="gf-steps">
            {STEPS.map((step) => (
              <li key={step.n}>
                <span className="gf-step-n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="gf-quote">
          <blockquote>
            &ldquo;Rain hammers the roof until the house seems to breathe between
            the blows. In the attic, a dead radio crackles alive and a woman says
            your childhood nickname in a voice you have never been allowed to
            remember.&rdquo;
          </blockquote>
          <cite>An opening, written the moment someone asked for it</cite>
        </section>

        <section className="gf-modules-section" aria-label="Modules">
          <header className="gf-section-head">
            <h2>The field</h2>
            <p>
              Living Stories, Character Forge, and AI Detective are open. More
              worlds are coming.
            </p>
          </header>
          <div className="gf-modules">
            {MODULES.map((module) => (
              <article
                key={module.id}
                className={`gf-card ${module.status === "live" ? "is-live" : "is-planned"}`}
              >
                <div className="gf-card-top">
                  <span className="gf-glyph" aria-hidden="true">
                    {module.glyph}
                  </span>
                  <span className={`gf-status gf-status-${module.status}`}>
                    {module.status === "live" ? "Open" : "Soon"}
                  </span>
                </div>
                <h3 className="gf-card-name">{module.name}</h3>
                <p className="gf-card-tagline">{module.tagline}</p>
                <p className="gf-card-desc">{module.description}</p>
                <button
                  type="button"
                  className="gf-enter"
                  onClick={() =>
                    module.status === "live" ? setOpenModule(module.id) : undefined
                  }
                  disabled={module.status !== "live"}
                >
                  {module.status === "live" ? "Enter" : "Not yet"}
                </button>
              </article>
            ))}
          </div>
        </section>

        <footer className="gf-footer">
          <span className="gf-brand-mark" aria-hidden="true">
            ▲
          </span>
          <p>
            AI Storify <strong>GameField</strong> — your worlds are still here.
          </p>
        </footer>
      </main>
    </div>
  );
}

function GameFieldBar({
  onHome,
  moduleName,
}: {
  onHome: () => void;
  moduleName: string | null;
}) {
  return (
    <header className="gf-bar">
      <button type="button" className="gf-brand" onClick={onHome}>
        <span className="gf-brand-mark" aria-hidden="true">
          ▲
        </span>
        <span className="gf-brand-text">
          AI Storify <strong>GameField</strong>
        </span>
      </button>
      {moduleName ? (
        <div className="gf-breadcrumb">
          <span className="gf-crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="gf-crumb">{moduleName}</span>
        </div>
      ) : null}
    </header>
  );
}
