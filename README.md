# Pocket Multiverse

A hackathon MVP for persistent, choice-driven audio stories. The listener starts
or customizes a world, makes server-validated choices, sees character-specific
memories, hears the scene, and can continue with another arc in the same canon.

## Run

Requires Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` server-side. For hosted story-pattern retrieval also set:

```env
OPENAI_RAG_ENABLED=true
OPENAI_STORY_VECTOR_STORE_ID=vs_...
```

Never use a `NEXT_PUBLIC_` prefix for these values.

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
- D1 aggregate persistence;
- same-world arc continuation after resolution.

OpenAI writes creative content. It never writes state directly. The server
commits the selected typed command before generation and validates the complete
scene before persistence.

## Main code

```text
app/api/demo/                         API routes
components/demo-app.tsx               simple test UI
lib/domain/                           commands, state, validation, fallbacks
lib/rag/corpus.ts                     local sanitized craft corpus
lib/server/retrieval.ts               hosted search and fallback
lib/server/openai.ts                  OpenAI structured generation and TTS
knowledge/source-manifest.json        sources, rights metadata, hashes
scripts/ingest-story-rag.mjs           private corpus ingestion
tests/story-engine.test.ts            deterministic engine checks
```
