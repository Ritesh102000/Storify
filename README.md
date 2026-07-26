# Pocket Multiverse

A hackathon MVP for persistent, choice-driven audio stories. The listener starts
or customizes a world, makes server-validated choices, sees character-specific
memories, hears the scene, and can continue with another arc in the same canon.
The local GameField now has three modules: Living Stories, Character Forge, and
Detective, a server-owned clue investigation and accusation game.

## Run

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:3000` and select Detective in the GameField to investigate
a case, unlock prerequisite-gated clues, and submit a final accusation.

Set `OPENAI_API_KEY` server-side. For hosted story-pattern retrieval also set:

```env
OPENAI_RAG_ENABLED=true
OPENAI_STORY_VECTOR_STORE_ID=vs_...
```

Never use a `NEXT_PUBLIC_` prefix for these values.

## Move to another Mac

Push or copy this repository. The app uses one private local `.env`. Do not add
it to Git—it contains the real OpenAI key and is already ignored. The committed
`.env.example` contains names and safe defaults only.

On the other Mac:

1. Clone the repository.
2. Double-click `scripts/setup-mac.command`.
3. The first run creates `.env` and opens it in TextEdit.
4. Paste the OpenAI key into `OPENAI_API_KEY=`, save, and run the setup again.
5. The script installs dependencies, verifies the project, and starts the local
   demo at `http://localhost:3000`.

The single OpenAI key powers world generation, the story simulator, narration,
Character Forge, image portraits, and transcription. The optional vector-store
ID is needed only when hosted RAG is enabled.

## Knowledge base

```bash
npm run rag:download
npm run rag:ingest
```

The manifest pins 18 public-domain Project Gutenberg editions. Downloaded full
texts remain ignored and private. Ingestion uploads 18 source files plus 108
sanitized abstract craft cards. Live story prompts search only craft cards.

## Validation

```bash
npm run test:deterministic
npm run typecheck
npm run lint
npm run build
```

The deterministic suite does not generate a live multi-turn story.

## Built

- three starter worlds and Create Your Own;
- editable premise, rules, role, conflict, mood, and character prototypes;
- strict OpenAI world and story structured outputs;
- explicit OpenAI vector search with four-second local fallback;
- seven flexible dramatic milestones spanning 8–15 scenes;
- causal choice → consequence → scene generation;
- 120–200 word narration and 4–8 connected dialogue lines;
- one unique discovery maximum per scene;
- server-owned command effects, state diffs, objectives, and progression;
- physically valid Protect/Confront targets;
- immutable events and actual-location character memories;
- distinct choice intent and anticipated tradeoff;
- Context Trace retrieval provenance;
- private character spin-offs and OpenAI TTS;
- standalone Character Forge identities with optional story context;
- Chrome and Safari microphone recording through OpenAI transcription;
- server-owned Detective truth, clue gates, turn limits, and verdicts;
- D1 aggregate persistence;
- same-world arc continuation after resolution.

OpenAI writes creative content. It never writes state directly. The server
commits the selected typed command before generation and validates the complete
scene before persistence.

## Main code

```text
app/api/demo/                         API routes
components/demo-app.tsx               simple test UI
lib/detective/                         Detective case engine and public views
lib/domain/                           commands, state, validation, fallbacks
lib/rag/corpus.ts                     local sanitized craft corpus
lib/server/retrieval.ts               hosted search and fallback
lib/server/openai.ts                  OpenAI structured generation and TTS
knowledge/source-manifest.json        sources, rights metadata, hashes
scripts/ingest-story-rag.mjs           private corpus ingestion
tests/story-engine.test.ts            deterministic engine checks
```
