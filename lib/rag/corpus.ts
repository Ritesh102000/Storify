import manifestJson from "@/knowledge/source-manifest.json";
import type { CraftCard, StoryPhase, TemplateId } from "@/lib/types";

export type SourceManifestEntry = {
  source_id: string;
  gutenberg_id: number;
  template_id: TemplateId;
  title: string;
  author: string;
  translator: string | null;
  publication_year: number;
  source_url: string;
  text_url: string;
  rights_basis: string;
  territory_review: string;
  expected_sha256: string;
};

export const SOURCE_MANIFEST = manifestJson as SourceManifestEntry[];

const PHASES: StoryPhase[] = [
  "opening",
  "choice_consequence",
  "relationship_dialogue",
  "escalation",
  "reversal",
  "crisis_resolution",
];

const PHASE_PATTERNS: Record<StoryPhase, string> = {
  opening:
    "Open inside an unstable situation with one physical objective, one endangered relationship, and one person who can be challenged. Make every available action save something different and endanger something concrete.",
  choice_consequence:
    "Begin with the selected action succeeding in a limited way, then make its anticipated tradeoff irreversible. The next lead must emerge from that exact consequence rather than from coincidence.",
  relationship_dialogue:
    "Let one character name what the listener chose while another disputes its meaning. Each reply must answer the preceding line, expose incompatible goals, and create an action the listener can take.",
  escalation:
    "Turn a stored clue or earlier cost into an obstacle that moves against the listener. Raise stakes by narrowing time, safety, or trust while preserving a credible path forward.",
  reversal:
    "Introduce corroborated evidence that keeps prior facts true but changes their interpretation. The reversal should complicate loyalty or motive, not replace the established conflict with an unrelated surprise.",
  crisis_resolution:
    "Bring two established values into direct conflict. Resolve the active question through accumulated evidence and the listener's action, then show a permanent change in the world and one relationship.",
};

const TEMPLATE_LENSES: Record<TemplateId, string[]> = {
  blackmoor: [
    "Use a promise that becomes costly when the environment changes.",
    "Let an apparently useful artifact impose a social or ecological price.",
    "Make travel reveal competing communities rather than serve as empty transition.",
    "Allow an old rule to become newly relevant through a character's action.",
    "Use a rival's practical argument to challenge a loyal relationship.",
    "Make wonder and danger emerge from the same world rule.",
  ],
  neon_afterlight: [
    "Separate personal testimony from physical evidence and let them disagree.",
    "Make a technology solve one problem while damaging identity or trust.",
    "Use asymmetric knowledge so a character can be truthful but incomplete.",
    "Let an institution react strategically to the listener's specific evidence.",
    "Make a timeline inconsistency become actionable rather than merely strange.",
    "Resolve truth through accountability, not through discovering a perfect original.",
  ],
  monsoon_house: [
    "Let a domestic object carry evidence that contradicts family habit.",
    "Make a supernatural rule behave consistently during emotional conflict.",
    "Use repeated speech as evidence while preserving the limit that it cannot answer.",
    "Let care and denial exist in the same character without making either false.",
    "Make the building physically express an unresolved family relationship.",
    "Resolve remembrance through shared responsibility rather than simple exposure.",
  ],
};

export const LOCAL_CRAFT_CARDS: CraftCard[] = SOURCE_MANIFEST.flatMap(
  (source, sourceIndex) =>
    PHASES.map((story_phase, phaseIndex) => {
      const lens =
        TEMPLATE_LENSES[source.template_id][(sourceIndex + phaseIndex) % 6];
      return {
        template_id: source.template_id,
        doc_type: "craft" as const,
        card_id: `${source.source_id}_${story_phase}`,
        source_id: source.source_id,
        source_title: source.title,
        story_phase,
        scene_function: `${story_phase.replaceAll("_", "-")}-with-causal-change`,
        pattern: `${PHASE_PATTERNS[story_phase]} ${lens}`,
        content_rating: "family_safe" as const,
      };
    }),
);

export function localCraftSearch(input: {
  templateId: TemplateId;
  phase: StoryPhase;
  excludeCardIds?: string[];
  limit?: number;
}): CraftCard[] {
  const excluded = new Set(input.excludeCardIds ?? []);
  const exact = LOCAL_CRAFT_CARDS.filter(
    (card) =>
      card.template_id === input.templateId &&
      card.story_phase === input.phase &&
      !excluded.has(card.card_id),
  );
  const adjacent = LOCAL_CRAFT_CARDS.filter(
    (card) =>
      card.template_id === input.templateId &&
      card.story_phase !== input.phase &&
      !excluded.has(card.card_id),
  );
  return [...exact, ...adjacent].slice(0, input.limit ?? 4);
}

export function craftCardText(card: CraftCard): string {
  return [
    `card_id: ${card.card_id}`,
    `story_phase: ${card.story_phase}`,
    `scene_function: ${card.scene_function}`,
    `pattern: ${card.pattern}`,
  ].join("\n");
}
