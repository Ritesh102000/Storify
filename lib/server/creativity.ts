import type { CreativityLevel } from "@/lib/types";

export type CreativitySetting = {
  /** Reasoning effort for the renderer call. */
  effort: "low" | "medium" | "high";
  /** Appended to the renderer instructions. Style only — never changes canon. */
  directive: string;
};

// The story models reject a `temperature` parameter outright ("Unsupported
// parameter: 'temperature' is not supported with this model"), so a literal
// temperature slider would be a dead control. These map the listener-facing
// creativity setting onto levers the models actually honour.
const SETTINGS: Record<CreativityLevel, CreativitySetting> = {
  grounded: {
    effort: "low",
    directive: `Style: plain and procedural. Short declarative sentences, concrete
nouns, minimal figurative language. Favour clarity over atmosphere. The listener
should always know exactly what is physically happening and what it costs.`,
  },
  balanced: {
    effort: "medium",
    directive: `Style: grounded but alive. Vary sentence length deliberately. Use
at most one image or comparison per scene, and only where it sharpens a physical
detail rather than decorating it. Keep one moment of the listener's own
perception.`,
  },
  vivid: {
    effort: "medium",
    directive: `Style: atmospheric and sensory. Let the place have weather, sound,
smell, and texture. Use figurative language where it earns its place, and give
the listener interior reactions — what a moment reminds them of, what they
brace for. Never let atmosphere blur what physically happened, who did it, or
what it cost.`,
  },
};

export function resolveCreativity(
  level: CreativityLevel | undefined,
): CreativitySetting {
  return SETTINGS[level ?? "balanced"] ?? SETTINGS.balanced;
}
