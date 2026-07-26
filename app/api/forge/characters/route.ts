import { createCharacterSchema } from "@/lib/forge/schemas";
import {
  ForgeError,
  draftCharacter,
  moderateText,
} from "@/lib/forge/openai";
import { listCharacters, newCharacterId, saveCharacter } from "@/lib/forge/store";
import { forgeError } from "@/lib/forge/api";
import { getForgeStory } from "@/lib/forge/stories";
import type { ForgedCharacter } from "@/lib/forge/types";

export async function GET() {
  try {
    return Response.json({ characters: await listCharacters() });
  } catch (error) {
    return forgeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { answers, origin, story_id: storyId } =
      createCharacterSchema.parse(await request.json());
    await moderateText([
      answers.seed ?? "",
      answers.want ?? "",
      answers.wound ?? "",
      answers.unforgivable ?? "",
    ]);

    const story = storyId ? await getForgeStory(storyId) : null;
    if (storyId && !story) {
      throw new ForgeError(
        404,
        "STORY_NOT_FOUND",
        "That story is no longer available. Choose another story or leave it unassigned.",
      );
    }
    const draft = await draftCharacter(answers, {
      origin,
      story: story ?? undefined,
    });
    const now = new Date().toISOString();
    const character: ForgedCharacter = {
      ...draft,
      character_id: newCharacterId(),
      portrait_style: answers.portrait_style ?? "ink_wash",
      has_portrait: false,
      origin,
      story_binding: story
        ? {
            universe_id: story.universe_id,
            template_id: story.template_id,
            title: story.title,
            genre: story.genre,
          }
        : undefined,
      times_cast: 0,
      created_at: now,
      updated_at: now,
    };
    await saveCharacter(character);
    return Response.json({ character }, { status: 201 });
  } catch (error) {
    return forgeError(error);
  }
}
