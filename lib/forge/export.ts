import type { CharacterDraft, Prototype } from "@/lib/types";
import type { ForgedCharacter } from "./types";

/**
 * The only seam between Character Forge and Living Stories.
 *
 * This reads a forged character and returns the shape the story engine already
 * accepts. It is deliberately one-directional: Living Stories imports nothing
 * from `lib/forge/`, so Forge can change freely without touching a measured,
 * regression-tested engine.
 *
 * Casting a forged character into a running world additionally requires the
 * three-prototype cast limit to be lifted, which is Living Stories backlog work
 * and not owned by this module.
 */
export function toStoryCharacter(forged: ForgedCharacter): CharacterDraft {
  return {
    prototype: toPrototype(forged.archetype),
    name: forged.name,
    role_in_world: forged.role,
    relationship_to_listener: forged.owes,
    traits: deriveTraits(forged),
    goal: forged.want,
    // The story engine's `fear` is behavioural, and the wound is what produces
    // it. The lie is what a revelation can actually disprove, so it maps onto
    // the secret rather than the fear.
    fear: forged.wound,
    secret: forged.lie,
    speech_style: forged.speech_style,
    voice_hint: forged.tell,
  };
}

function toPrototype(archetype: ForgedCharacter["archetype"]): Prototype {
  if (archetype === "rival") return "rival";
  if (archetype === "mystery_keeper") return "mystery_keeper";
  // A protagonist cast into someone else's world reads as the ally by default.
  return "ally";
}

function deriveTraits(forged: ForgedCharacter): string[] {
  const traits = [forged.tactic, ...splitContradiction(forged.contradiction)]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.slice(0, 40));
  return traits.length >= 2 ? traits.slice(0, 3) : [forged.tactic, "guarded"];
}

function splitContradiction(contradiction: string): string[] {
  return contradiction
    .split(/\bbut\b|\byet\b|,|;/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && part.length <= 40)
    .slice(0, 2);
}
