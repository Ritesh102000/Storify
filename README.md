# Pocket Multiverse

A hackathon MVP for living audio stories. A listener creates or customizes a
world, makes permanent choices, sees character-specific memories, hears the
scene, and can open a private character spin-off.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add a server-side `OPENAI_API_KEY` to `.env.local`. Never use a
`NEXT_PUBLIC_` prefix for the key.

The exact local URL is printed by the development server. If port 3000 is
already in use it may select 3001.

## Test

```bash
npm run typecheck
npm run lint
npm test
```

`OPENAI_FIXTURE_MODE=true` keeps the full deterministic demo usable without
live model calls. Fixture mode is also used automatically when the API key is
missing or a generation call fails.

## What is built

- Blackmoor, Neon Afterlight, and Monsoon House starter worlds
- Create Your Own mode using a tested mechanical template
- editable world context and three character prototypes
- OpenAI Responses API with strict structured outputs
- OpenAI moderation for creative setup input
- server-owned commands, preconditions, effects, and state diffs
- per-character witnessed memories and trust/tension
- three validated choices per story turn
- context trace showing the events, memories, facts, and state sent to the model
- private, one-level character spin-offs
- OpenAI text-to-speech with an AI-voice disclosure
- D1 persistence and deterministic fallbacks

## Important boundaries

OpenAI creates world content, narration, dialogue, choice wording, spin-off
openings, moderation decisions, and voice audio. It does not write state
directly. The application commits commands and effects before asking OpenAI to
describe the result.

Only validated, unlocked character knowledge enters an ordinary story-turn
prompt. Character secrets are never returned by the public world APIs.

## Main code

```text
app/api/demo/               HTTP routes
components/demo-app.tsx     replaceable test UI
lib/domain/                 state, commands, choices, context, fallbacks
lib/server/openai.ts        OpenAI adapter
lib/server/store.ts         D1 persistence
lib/fixtures.ts             three starter worlds
lib/schemas.ts              strict structured-output and request schemas
db/                         D1 schema bootstrap
tests/                      build/UI contract checks
```
