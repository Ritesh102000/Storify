import OpenAI from "openai";
import {
  LOCAL_CRAFT_CARDS,
  localCraftSearch,
} from "@/lib/rag/corpus";
import type {
  CraftCard,
  RetrievalTrace,
  StoryEvent,
  StoryPhase,
  TemplateId,
  WorldSession,
  WorldSetupInput,
} from "@/lib/types";

type RetrievalResult = { cards: CraftCard[]; trace: RetrievalTrace };

export async function retrieveForWorld(
  input: WorldSetupInput,
  templateId: TemplateId,
): Promise<RetrievalResult> {
  return retrieveCraft({
    templateId,
    phase: "opening",
    queryParts: [
      input.genre,
      input.story_brief,
      input.main_conflict,
      input.listener_role,
      `mood ${input.mood.join(", ")}`,
      "Need an opening pattern and a flexible arc direction.",
    ],
  });
}

export async function retrieveForTurn(
  session: WorldSession,
  event: StoryEvent,
): Promise<RetrievalResult> {
  const milestone = session.arc_state.milestones[
    session.arc_state.active_milestone_index
  ];
  const scene = session.scenes.at(-1)!;
  const phase = phaseForMilestone(milestone.milestone_type);
  const present = scene.present_character_ids
    .map((id) => session.characters.find((character) => character.character_id === id))
    .filter(Boolean)
    .map((character) => character!.name);
  return retrieveCraft({
    templateId: session.template_id,
    phase,
    excludeCardIds: session.arc_state.recent_pattern_ids.slice(-4),
    queryParts: [
      `${session.universe.genre}: ${session.universe.premise}`,
      `Milestone purpose: ${milestone.dramatic_purpose}`,
      `Selected command and consequence: ${event.command_type}; ${event.summary}`,
      `Location: ${scene.location}`,
      `Objective: ${session.state.active_objective.label}`,
      `Present characters: ${present.join(", ")}`,
      `Relationship pressure: ${relationshipSummary(session)}`,
      `Unresolved question: ${session.arc_state.open_threads[0] ?? session.story.central_question}`,
      `Recent discoveries: ${session.arc_state.discovered_clues.slice(-3).join(" | ") || "none"}`,
      `Do not repeat patterns: ${session.arc_state.recent_pattern_ids.slice(-4).join(", ") || "none"}`,
    ],
  });
}

async function retrieveCraft(input: {
  templateId: TemplateId;
  phase: StoryPhase;
  queryParts: string[];
  excludeCardIds?: string[];
}): Promise<RetrievalResult> {
  const query = input.queryParts.filter(Boolean).join("\n");
  const local = localCraftSearch({
    templateId: input.templateId,
    phase: input.phase,
    excludeCardIds: input.excludeCardIds,
    limit: 4,
  });
  const enabled = process.env.OPENAI_RAG_ENABLED === "true";
  const vectorStoreId = process.env.OPENAI_STORY_VECTOR_STORE_ID?.trim();
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!enabled || !vectorStoreId || !apiKey) {
    return {
      cards: local,
      trace: traceFromCards(query, local, false, true, "Hosted retrieval is not configured."),
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const page = await client.vectorStores.search(
      vectorStoreId,
      {
        query,
        max_num_results: 12,
        rewrite_query: true,
        filters: {
          type: "and",
          filters: [
            { type: "eq", key: "doc_type", value: "craft" },
            { type: "eq", key: "template_id", value: input.templateId },
            // Without this the phase only influenced the query text, and 58% of
            // retrieved cards were for the wrong stage of the arc — opening
            // technique was being handed to the director during the crisis.
            { type: "eq", key: "story_phase", value: input.phase },
          ],
        },
        ranking_options: { ranker: "auto", score_threshold: 0.1 },
      },
      // Kept deliberately: a slow vector search falls back to local cards, so
      // this bounds the turn instead of costing it. 4s was tight enough to
      // trigger needless fallbacks.
      { signal: AbortSignal.timeout(20_000) },
    );
    const excluded = new Set(input.excludeCardIds ?? []);
    const hits = page.data
      .map((hit) => {
        const cardId = String(hit.attributes?.card_id ?? "");
        const card = LOCAL_CRAFT_CARDS.find((item) => item.card_id === cardId);
        return card ? { card, score: hit.score } : null;
      })
      .filter((item): item is { card: CraftCard; score: number } => Boolean(item))
      .filter((item) => !excluded.has(item.card.card_id))
      .slice(0, 4);
    if (hits.length === 0) throw new Error("No matching craft cards were returned.");
    const cards = hits.map((hit) => hit.card);
    return {
      cards,
      trace: {
        enabled: true,
        query,
        card_ids: cards.map((card) => card.card_id),
        source_ids: cards.map((card) => card.source_id),
        source_titles: cards.map((card) => card.source_title),
        scores: hits.map((hit) => hit.score),
        selected_pattern_id: cards[0]?.card_id ?? null,
        used_local_fallback: false,
      },
    };
  } catch (error) {
    return {
      cards: local,
      trace: traceFromCards(
        query,
        local,
        true,
        true,
        error instanceof Error ? error.message.slice(0, 180) : "Retrieval failed.",
      ),
    };
  }
}

function traceFromCards(
  query: string,
  cards: CraftCard[],
  enabled: boolean,
  fallback: boolean,
  failureReason?: string,
): RetrievalTrace {
  return {
    enabled,
    query,
    card_ids: cards.map((card) => card.card_id),
    source_ids: cards.map((card) => card.source_id),
    source_titles: cards.map((card) => card.source_title),
    scores: cards.map(() => 0),
    selected_pattern_id: cards[0]?.card_id ?? null,
    used_local_fallback: fallback,
    failure_reason: failureReason,
  };
}

function phaseForMilestone(
  milestone: WorldSession["arc_state"]["milestones"][number]["milestone_type"],
): StoryPhase {
  if (milestone === "opening") return "opening";
  if (milestone === "investigation") return "choice_consequence";
  if (milestone === "escalation") return "escalation";
  if (milestone === "revelation") return "relationship_dialogue";
  if (milestone === "reversal") return "reversal";
  return "crisis_resolution";
}

function relationshipSummary(session: WorldSession): string {
  return session.characters
    .map((character) => {
      const relationship = session.state.relationships[character.character_id];
      return `${character.name} trust ${relationship.trust}, tension ${relationship.tension}`;
    })
    .join("; ");
}
