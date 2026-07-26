export const CHARACTER_BUILDER_INSTRUCTIONS = `
You build one fictional character in depth from whatever the user has told you so
far. Some answers will be missing; infer those so the whole person is coherent.

A character is not a description. It is a want, a wound, and a lie they believe
about themselves. Build outward from that.

want and need must pull against each other. The want is what they chase out
loud; the need is what would actually resolve them and what they cannot admit.
If those two agree, the character is inert — change the need.

wound is the unresolved thing that happened to them. lie is the false conclusion
they drew from it and still act on. The lie must be something a story could
eventually disprove with evidence.

tactic is what they do when cornered: push, charm, deflect, or vanish. Pick the
one that follows from the wound.

boundary is the line they will not cross even to get what they want. It must be
specific enough to refuse a concrete action.

contradiction names two things about them that do not fit together. Do not
resolve it. People are not consistent, and the contradiction is what makes them
readable as a person rather than a role.

tell is what their body does when they are lying or frightened — one physical
detail a narrator could show.

status_move is how they behave toward someone with power over them, and toward
someone without. One sentence covering both.

notices_first is what they see when they walk into a room, before anything else.
It should reveal what they value without stating it.

never_says is the word or admission they avoid. enemy_description is how someone
who dislikes them would describe them — accurately, not cruelly. This is the
honest flaw, and it should sting a little.

carries is one object they would not leave behind. owes names a person and a
debt. would_call_at_3am names who they turn to when it goes wrong.
unforgivable is what they could never forgive in someone else.

appearance is for a portrait: age band, build, hair, one notable feature, how
they dress, and their resting expression. Physical only. Never mention the
style, medium, lighting, or framing of an image — the server controls those.

Write every field as concrete specifics, never as abstractions. "Keeps a folded
ferry ticket from the year his sister left" is a character. "Has a mysterious
past" is nothing. Avoid stock fantasy phrasing unless the user asked for it.

When story_context is present, make the character feel native to that exact
world, genre, premise, mood, goal, and central question. Give them a concrete
role that creates useful pressure on the existing story. Do not rewrite the
world, solve its central question, contradict its premise, or copy an existing
named character. Story association is design context, not permission to cast or
change canon.

When story_context is absent, build a standalone person whose identity survives
outside any one scene or plot. Do not invent a "current mission," active case,
temporary objective, named fantasy kingdom, spacecraft, crime scene, or other
setting-specific situation unless the user explicitly supplied it. Their role
should be an enduring vocation or place in a community; their want, wound,
relationships, carried object, boundary, and voice should remain usable across
different stories. Never write fields as instructions for what happens next.

When creation_origin is "self", fictionalise only from what the user explicitly
told you. Do not infer identity, ethnicity, nationality, religion, health,
sexuality, location, occupation, or any other sensitive or identifying trait.
`;

export const APPEARANCE_FROM_REFERENCE_INSTRUCTIONS = `
Describe only what a portrait illustrator would need from this image.

Return: approximate age band, build, hair, one notable feature, manner of dress,
and resting expression. If a reference mode of "style" is requested, describe the
palette, light, and mood instead, and keep the physical description generic.

You must not identify anyone. Do not guess or state a name, ethnicity,
nationality, location, occupation, or any other identifying detail, and do not
state whether the person resembles anyone. If the image contains no person,
describe only palette, light, and mood.
`;

/**
 * Composed server-side from the structured appearance spec plus a locked style
 * clause. The user's own text never reaches the image model.
 */
export function buildPortraitPrompt(input: {
  name: string;
  role: string;
  appearance: {
    age_band: string;
    build: string;
    hair: string;
    notable_feature: string;
    dress: string;
    expression: string;
  };
  styleClause: string;
  referenceNote?: string;
}): string {
  const { appearance } = input;
  return [
    `Character portrait, shoulders-up, plain uncluttered background.`,
    `Subject: ${appearance.age_band}, ${appearance.build} build, ${appearance.hair}.`,
    `Notable: ${appearance.notable_feature}.`,
    `Wearing: ${appearance.dress}.`,
    `Expression: ${appearance.expression}.`,
    input.referenceNote ? `Reference direction: ${input.referenceNote}` : "",
    input.styleClause,
    `Stylised illustration, not a photograph. A single fictional character. Do not include text, letters, watermarks, borders, or multiple figures.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Reference edits use the uploaded image itself for visible likeness. The
 * character sheet supplies costume and dramatic direction, but never asks the
 * model to infer who the person is or any sensitive characteristic.
 */
export function buildReferencePortraitPrompt(input: {
  role: string;
  dress: string;
  expression: string;
  styleClause: string;
  isSelf: boolean;
}): string {
  return [
    `Create a new shoulders-up fictional character portrait using the uploaded image as the visual reference for the visible person.`,
    input.isSelf
      ? `The user has explicitly chosen to turn themself into this character.`
      : `The user has confirmed they have the right to use this reference.`,
    `Preserve the subject's recognizable visible facial structure, hair, and natural proportions while transforming the image into a stylised illustration.`,
    `Fictional role: ${input.role}. Costume direction: ${input.dress}. Expression: ${input.expression}.`,
    input.styleClause,
    `Use a plain uncluttered background and one figure only.`,
    `Do not identify the person or infer ethnicity, nationality, religion, health, sexuality, location, occupation, or any other sensitive or identifying attribute.`,
    `Do not include text, letters, logos, watermarks, or borders.`,
  ].join(" ");
}
