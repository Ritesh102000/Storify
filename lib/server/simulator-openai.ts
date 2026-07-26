import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  rendererStoryTurnSchema,
  storyTurnDraftSchema,
} from "@/lib/schemas";
import {
  beatSelectionSchema,
  characterIntentSchema,
  directorPlanSchema,
  storyCritiqueSchema,
} from "@/lib/simulation/schemas";
import type {
  BeatCandidate,
  CharacterIntent,
  DirectorPlan,
  SimulationTurnContext,
  StoryCritique,
} from "@/lib/simulation/types";
import type {
  FastTurnPacket,
  StoryEvent,
  StoryTurnDraft,
  WorldSession,
  WorldPreview,
  CreativityLevel,
} from "@/lib/types";
import { resolveCreativity } from "./creativity";
import {
  CHARACTER_SIMULATOR_INSTRUCTIONS,
  SIMULATION_CRITIC_INSTRUCTIONS,
  SIMULATION_DIRECTOR_INSTRUCTIONS,
  SIMULATION_PLAN_FILTER_INSTRUCTIONS,
  SIMULATION_RENDERER_INSTRUCTIONS,
} from "./prompts";
import type { CandidateDryRun } from "@/lib/simulation/types";

const STORY_MODEL = process.env.OPENAI_STORY_MODEL || "gpt-5.6-sol";
const DIRECTOR_MODEL =
  process.env.OPENAI_DIRECTOR_MODEL || "gpt-5.6-terra";
const CHARACTER_MODEL =
  process.env.OPENAI_CHARACTER_MODEL || "gpt-5.6-terra";
const FILTER_MODEL = process.env.OPENAI_FILTER_MODEL || "gpt-5.6-terra";
const RENDERER_MODEL =
  process.env.OPENAI_RENDERER_MODEL || STORY_MODEL;
const CRITIC_MODEL = process.env.OPENAI_CRITIC_MODEL || "gpt-5.6-terra";
const DIRECTOR_REASONING =
  process.env.OPENAI_DIRECTOR_REASONING_EFFORT || "medium";

type GenerationMeta = WorldPreview["generation"];

export async function planSimulatorTurn(
  session: WorldSession,
  event: StoryEvent,
  packet: FastTurnPacket,
  rejectedCandidates: Array<{ candidate_id: string; errors: string[] }> = [],
): Promise<DirectorPlan> {
  const client = requiredClient();
  const input = JSON.stringify({
    simulator_state: redactSimulation(
      session.simulation,
      new Set(packet.scene_cell.permitted_unlocked_fact_ids),
    ),
    compiled_context: packet,
    committed_event: event,
    rejected_candidates: rejectedCandidates,
  });

  // Three full beat plans measured at ~5.1k output tokens, but reasoning tokens
  // for the same call varied from 483 to 1034, so a 7k ceiling left too little
  // headroom: an overrun returns status "incomplete" with no parsed output and
  // silently costs the listener a real scene. Budget generously and retry once.
  let lastDetail = "no parsed plan";
  for (const budget of [14_000, 20_000]) {
    const response = await client.responses.parse(
      {
        model: DIRECTOR_MODEL,
        reasoning: { effort: reasoningEffort(DIRECTOR_REASONING) },
        instructions: SIMULATION_DIRECTOR_INSTRUCTIONS,
        input,
        text: { format: zodTextFormat(directorPlanSchema, "director_plan") },
        max_output_tokens: budget,
        store: false,
      },
    );
    if (response.output_parsed) {
      return directorPlanSchema.parse(response.output_parsed);
    }
    lastDetail = `status=${response.status}, ${
      response.incomplete_details
        ? `incomplete=${response.incomplete_details.reason}`
        : "no incomplete_details"
    }, budget=${budget}`;
  }
  throw new Error(`Director returned no parsed plan (${lastDetail}).`);
}

export async function simulateCharacterIntent(
  session: WorldSession,
  characterId: string,
  selected: BeatCandidate,
  afterState: WorldSession["simulation"],
): Promise<CharacterIntent> {
  const character = session.characters.find(
    (candidate) => candidate.character_id === characterId,
  );
  const simulationCharacter = session.simulation.characters[characterId];
  // A walk-on introduced by the simulator has no prototype record. Previously
  // this threw and killed the turn, which taught the director never to bring
  // anyone new into a scene. Give them a lightweight identity instead.
  if (!character || !simulationCharacter) {
    return walkOnIntent(session, characterId, selected);
  }
  const knownFacts = simulationCharacter.beliefs
    .map((belief) => ({
      belief,
      fact: session.simulation.facts[belief.fact_id],
    }))
    .filter((item) => item.fact);
  const observedAfterFacts = Object.values(afterState.facts).filter(
    (fact) =>
      fact.source_event_id === session.events.at(-1)?.event_id &&
      fact.known_by_character_ids.includes(characterId),
  );
  const accessibleMemories = session.memories
    .filter((memory) => memory.character_id === characterId)
    .slice(-8);
  const client = requiredClient();
  try {
    const response = await client.responses.parse(
      {
        model: CHARACTER_MODEL,
        reasoning: { effort: "low" },
        instructions: CHARACTER_SIMULATOR_INSTRUCTIONS,
        input: JSON.stringify({
          identity: {
            character_id: character.character_id,
            name: character.name,
            role: character.role_in_world,
            traits: character.traits,
            speech_style: character.speech_style,
            fear: character.fear,
          },
          cognition: simulationCharacter,
          relationship: session.state.relationships[characterId],
          known_facts: knownFacts,
          newly_observed_facts: observedAfterFacts,
          memories: accessibleMemories,
          selected_beat: selected,
        }),
        text: {
          format: zodTextFormat(characterIntentSchema, "character_intent"),
        },
        max_output_tokens: 2200,
        store: false,
      },
    );
    if (!response.output_parsed) throw new Error("Character returned no intent.");
    const parsed = characterIntentSchema.parse(response.output_parsed);
    if (parsed.character_id !== characterId) {
      throw new Error("Character intent changed its character ID.");
    }
    return parsed;
  } catch {
    return {
      character_id: characterId,
      immediate_goal: simulationCharacter.mind.current_goal,
      private_interpretation: simulationCharacter.mind.current_belief,
      emotional_state: simulationCharacter.mind.current_emotion,
      physical_action: `Remain physically grounded in the selected beat while watching its consequence.`,
      dialogue_goal: `Advance ${character.goal.toLowerCase()} without revealing private knowledge.`,
      tactic: "Ask for a concrete action that serves the current goal.",
      boundary: `Will not knowingly act against ${character.fear.toLowerCase()}.`,
      belief_updates: [],
    };
  }
}

export async function selectSimulatorBeat(
  packet: FastTurnPacket,
  candidates: Array<Extract<CandidateDryRun, { valid: true }>>,
): Promise<string> {
  if (candidates.length === 1) return candidates[0].candidate.candidate_id;
  const client = requiredClient();
  try {
    const response = await client.responses.parse(
      {
        model: FILTER_MODEL,
        // Beat selection decides which scene the listener actually gets, so it
        // is worth thinking about. Latency is explicitly not the priority here.
        reasoning: { effort: "medium" },
        instructions: SIMULATION_PLAN_FILTER_INSTRUCTIONS,
        input: JSON.stringify({
          canon_ledger: packet.canon_ledger,
          scene_cell: packet.scene_cell,
          candidates: candidates.map((candidate) => ({
            candidate: candidate.candidate,
            dry_run_effects: candidate.commit.effects,
          })),
        }),
        text: {
          format: zodTextFormat(beatSelectionSchema, "beat_selection"),
        },
        max_output_tokens: 2400,
        store: false,
      },
    );
    if (!response.output_parsed) throw new Error("Plan filter returned no result.");
    const selected = beatSelectionSchema.parse(response.output_parsed);
    if (
      candidates.some(
        (candidate) =>
          candidate.candidate.candidate_id === selected.selected_candidate_id,
      )
    ) {
      return selected.selected_candidate_id;
    }
  } catch {
    // Deterministic scoring remains the safe local fallback.
  }
  return candidates.sort((left, right) => right.score - left.score)[0].candidate
    .candidate_id;
}

export async function renderSimulatorTurn(
  packet: FastTurnPacket,
  context: SimulationTurnContext,
  previousDraft: StoryTurnDraft | null = null,
  repairInstructions: string[] = [],
  creativity: CreativityLevel = "balanced",
): Promise<{ draft: StoryTurnDraft; generation: GenerationMeta }> {
  const started = Date.now();
  const client = requiredClient();
  const response = await client.responses.parse(
    {
      model: RENDERER_MODEL,
      reasoning: { effort: resolveCreativity(creativity).effort },
      instructions: [
        SIMULATION_RENDERER_INSTRUCTIONS,
        resolveCreativity(creativity).directive,
        repairInstructions.length
          ? `Repair only these verified issues:\n${repairInstructions.join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      input: JSON.stringify({
        compiled_context: packet,
        authoritative_turn: rendererContext(
          context,
          new Set(packet.scene_cell.permitted_unlocked_fact_ids),
        ),
        previous_rejected_draft: previousDraft,
      }),
      text: {
        format: zodTextFormat(rendererStoryTurnSchema, "rendered_scene"),
      },
      max_output_tokens: 6000,
      store: false,
    },
  );
  if (!response.output_parsed) {
    throw new Error(
      `Renderer returned no scene (status=${response.status}${
        response.incomplete_details
          ? `, incomplete=${response.incomplete_details.reason}`
          : ""
      }).`,
    );
  }
  const rendered = rendererStoryTurnSchema.parse(response.output_parsed);
  const narration = rendered.story_blocks
    .filter((block) => block.block_type === "narration")
    .map((block) => block.text)
    .join("\n\n");
  const dialogue = rendered.story_blocks
    .filter(
      (
        block,
      ): block is typeof block & {
        block_type: "dialogue";
        character_id: string;
      } => block.block_type === "dialogue" && Boolean(block.character_id),
    )
    .map((block, index) => ({
      character_id: block.character_id,
      text: block.text,
      responds_to_previous: index > 0,
    }));
  return {
    draft: storyTurnDraftSchema.parse({
      ...rendered,
      narration,
      dialogue,
    }),
    generation: {
      status: repairInstructions.length ? "repaired" : "generated",
      provider: "openai",
      model: RENDERER_MODEL,
      latency_ms: Date.now() - started,
      used_fallback: false,
    },
  };
}

export async function critiqueSimulatorTurn(
  session: WorldSession,
  packet: FastTurnPacket,
  context: SimulationTurnContext,
  draft: StoryTurnDraft,
): Promise<StoryCritique> {
  const client = requiredClient();
  try {
    const response = await client.responses.parse(
      {
        model: CRITIC_MODEL,
        // The critic is the last guard against a canon contradiction reaching
        // the page, and its findings drive the repair. Give it room.
        reasoning: { effort: "medium" },
        instructions: SIMULATION_CRITIC_INSTRUCTIONS,
        input: JSON.stringify({
          world_rules: session.universe.rules,
          canon_ledger: packet.canon_ledger,
          authoritative_turn: context,
          rendered_scene: draft,
        }),
        text: { format: zodTextFormat(storyCritiqueSchema, "story_critique") },
        max_output_tokens: 3000,
        store: false,
      },
    );
    if (!response.output_parsed) throw new Error("Critic returned no report.");
    return storyCritiqueSchema.parse(response.output_parsed);
  } catch (error) {
    return {
      valid: true,
      errors: [
        {
          category: "presentation",
          severity: "warning",
          explanation: "The model critic was unavailable; server validation remains active.",
          evidence: safeError(error),
        },
      ],
      repair_instructions: [],
    };
  }
}

// Walk-ons are real people in the room but carry no relationship, memory, or
// secret machinery. Their intent is derived from the beat so they can act and
// speak without the prototype record the three leads have.
function walkOnIntent(
  session: WorldSession,
  characterId: string,
  selected: BeatCandidate,
): CharacterIntent {
  const entity = session.simulation.entities[characterId];
  const name = entity?.name ?? "the newcomer";
  const pressure = selected.character_pressure.find(
    (item) => item.character_id === characterId,
  );
  return {
    character_id: characterId,
    immediate_goal:
      pressure?.want_in_scene ??
      `Find out what is happening here and decide whether to stay.`,
    private_interpretation: `${name} is reading the room from ${
      entity?.description ?? "the doorway"
    } and has not chosen a side.`,
    emotional_state: "alert and uncommitted",
    physical_action: `${name} stays near the way they came in and watches what the others do with their hands.`,
    dialogue_goal: `Ask the one question that the people already here have been avoiding.`,
    tactic: "Speak plainly because they have no stake in the old argument.",
    boundary: `${name} will not take responsibility for a decision that is not theirs.`,
    belief_updates: [],
  };
}

function requiredClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  return new OpenAI({
    apiKey,
    // Quality over latency: a slow response is still a good scene, but an
    // aborted one is always a template fallback. Well beyond any real call.
    timeout: 30 * 60 * 1000,
    maxRetries: 4,
  });
}

function reasoningEffort(
  value: string,
): "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" {
  if (
    value === "none" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  ) {
    return value;
  }
  return "medium";
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : "Unknown error.";
}

function redactSimulation(
  state: WorldSession["simulation"],
  permittedFactIds: Set<string>,
): WorldSession["simulation"] {
  const redacted = structuredClone(state);
  redacted.facts = Object.fromEntries(
    Object.entries(redacted.facts).filter(([factId]) =>
      permittedFactIds.has(factId),
    ),
  );
  for (const character of Object.values(redacted.characters)) {
    character.beliefs = character.beliefs.filter((belief) =>
      permittedFactIds.has(belief.fact_id),
    );
  }
  return redacted;
}

function rendererContext(
  context: SimulationTurnContext,
  permittedFactIds: Set<string>,
) {
  const newlyObserved = Object.values(context.after.facts)
    .filter((fact) => fact.source_event_id === context.source_event.event_id)
    .map((fact) => fact.fact_id);
  const renderableFacts = new Set([...permittedFactIds, ...newlyObserved]);
  return {
    before: redactSimulation(context.before, renderableFacts),
    selected: context.selected,
    after: redactSimulation(context.after, renderableFacts),
    commit: context.commit,
    source_event: context.source_event,
    character_intents: context.character_intents.map((intent) => ({
      character_id: intent.character_id,
      immediate_goal: intent.immediate_goal,
      emotional_state: intent.emotional_state,
      physical_action: intent.physical_action,
      dialogue_goal: intent.dialogue_goal,
      tactic: intent.tactic,
      boundary: intent.boundary,
    })),
  };
}
