// Character Forge domain types. Owned by the Forge module.
// Nothing here is imported by the Living Stories engine.

export const ARCHETYPES = [
  "protagonist",
  "ally",
  "rival",
  "mystery_keeper",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

export const TACTICS = ["push", "charm", "deflect", "vanish"] as const;
export type Tactic = (typeof TACTICS)[number];

export const PORTRAIT_STYLES = [
  "ink_wash",
  "oil_portrait",
  "graphite",
  "muted_photographic",
] as const;
export type PortraitStyle = (typeof PORTRAIT_STYLES)[number];

export const ORIGINS = [
  "described",
  "interviewed",
  "reference",
  "self",
] as const;
export type Origin = (typeof ORIGINS)[number];

/**
 * A safe, deliberately small link back to a Living Story. This is design
 * context only: associating a forged character does not cast them into the
 * running story or mutate its canonical cast.
 */
export type StoryBinding = {
  universe_id: string;
  template_id: string;
  title: string;
  genre: string;
};

/** Public story context the Forge may use while drafting a character. */
export type ForgeStorySummary = StoryBinding & {
  premise: string;
  mood: string[];
  listener_role: string;
  main_goal: string;
  central_question: string;
  updated_at: string;
};

/**
 * The appearance contract. The user edits these structured fields; the server
 * composes the image prompt from them. Free-typed prompts never reach the image
 * model, which keeps prompt injection out of generation and makes regeneration
 * deterministic.
 */
export type AppearanceSpec = {
  age_band: string;
  build: string;
  hair: string;
  notable_feature: string;
  dress: string;
  expression: string;
};

export type ForgedCharacter = {
  character_id: string;
  name: string;
  role: string;
  archetype: Archetype;

  // Layer 1 — the engine. want and need should pull against each other.
  want: string;
  need: string;
  wound: string;
  lie: string;

  // Layer 2 — behaviour under pressure.
  tactic: Tactic;
  boundary: string;
  status_move: string;
  tell: string;
  contradiction: string;

  // Layer 3 — texture.
  notices_first: string;
  carries: string;
  speech_style: string;
  never_says: string;
  enemy_description: string;

  // Layer 4 — ties to other people.
  owes: string;
  would_call_at_3am: string;
  unforgivable: string;

  appearance: AppearanceSpec;
  portrait_style: PortraitStyle;
  has_portrait: boolean;
  origin: Origin;
  story_binding?: StoryBinding;
  times_cast: number;
  created_at: string;
  updated_at: string;
};

/** Row shape returned by the library grid — never carries image data. */
export type ForgedCharacterSummary = Pick<
  ForgedCharacter,
  | "character_id"
  | "name"
  | "role"
  | "archetype"
  | "want"
  | "has_portrait"
  | "origin"
  | "story_binding"
  | "times_cast"
  | "updated_at"
>;

/** Answers collected by the interview, all optional so any step can be skipped. */
export type InterviewAnswers = {
  seed?: string;
  name?: string;
  role?: string;
  want?: string;
  need?: string;
  wound?: string;
  tactic?: string;
  boundary?: string;
  contradiction?: string;
  speech_style?: string;
  unforgivable?: string;
  archetype?: Archetype;
  portrait_style?: PortraitStyle;
};

export const PORTRAIT_STYLE_CLAUSES: Record<PortraitStyle, string> = {
  ink_wash:
    "Ink and wash illustration, muted palette, visible brush texture, soft directional light, painterly edges.",
  oil_portrait:
    "Classical oil portrait, warm restrained palette, single light source, visible impasto, gallery framing.",
  graphite:
    "Graphite and charcoal drawing on toned paper, high contrast, loose hatching, white highlights.",
  muted_photographic:
    "Stylised editorial illustration with photographic composition, desaturated palette, soft film grain.",
};

export const PORTRAIT_STYLE_LABELS: Record<PortraitStyle, string> = {
  ink_wash: "Ink and wash",
  oil_portrait: "Oil portrait",
  graphite: "Graphite",
  muted_photographic: "Muted editorial",
};
