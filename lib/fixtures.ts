import type {
  ChoiceProposal,
  TemplateId,
  WorldSeedDraft,
  WorldSetupInput,
} from "./types";

const openingChoices = (
  protect: string,
  pursue: string,
  confront: string,
): ChoiceProposal[] => [
  {
    axis: "protect",
    command_type: "help_character",
    target_prototype: "ally",
    label: protect,
  },
  {
    axis: "pursue",
    command_type: "pursue_goal",
    target_prototype: null,
    label: pursue,
  },
  {
    axis: "confront",
    command_type: "confront_character",
    target_prototype: "rival",
    label: confront,
  },
];

export const STARTER_WORLDS: Record<TemplateId, WorldSeedDraft> = {
  blackmoor: {
    base_template_id: "blackmoor",
    base_template_reason:
      "A character-first fantasy mystery built around a person-versus-objective tradeoff.",
    universe: {
      title: "Blackmoor: The Drowned Crown",
      genre: "Fantasy thriller",
      mood: ["urgent", "mysterious", "emotional"],
      premise:
        "A drowned kingdom survives on islands joined by ancient gates, while factions race to reopen the lost capital.",
      rules: [
        "The royal seal opens one ancient gate.",
        "The royal seal cannot exist in two places at once.",
        "Every opened gate permanently floods another island.",
      ],
    },
    story: {
      listener_role: "Disgraced royal courier",
      main_goal: "Find the royal seal before the final gate opens",
      central_question: "Who wants the drowned capital reopened, and why?",
      tone_guardrails: ["No graphic violence"],
      opening_hook:
        "A burning gatehouse forces you to choose between Arin and the royal seal.",
    },
    characters: [
      {
        prototype: "ally",
        name: "Arin",
        role_in_world: "Rebel cartographer",
        relationship_to_listener: "Your oldest friend",
        traits: ["loyal", "impulsive", "sarcastic"],
        goal: "Protect Blackmoor's outer islands",
        fear: "Becoming another royal weapon",
        secret: "Arin already opened one forbidden gate",
        speech_style: "Short, dry, and defiant",
        voice_hint: "Warm, weathered, quick",
      },
      {
        prototype: "rival",
        name: "Vex",
        role_in_world: "Commander of the Crownless Guard",
        relationship_to_listener: "Former partner and present rival",
        traits: ["charming", "ruthless", "strategic"],
        goal: "Open the drowned capital",
        fear: "Being forgotten by history",
        secret: "Vex believes the listener is the true heir",
        speech_style: "Controlled sentences with cutting questions",
        voice_hint: "Measured, low, magnetic",
      },
      {
        prototype: "mystery_keeper",
        name: "The Gatekeeper",
        role_in_world: "Last keeper of the ancient gates",
        relationship_to_listener: "A formal stranger who knows your lineage",
        traits: ["formal", "observant", "secretive"],
        goal: "Keep the final gate closed",
        fear: "The sea beneath the capital waking",
        secret: "The seal opens a prison, not a city",
        speech_style: "Ritual phrases and precise warnings",
        voice_hint: "Old, resonant, unhurried",
      },
    ],
    opening_scene: {
      location: "Blackmoor Gatehouse",
      situation:
        "Fire splits the gatehouse in two. Arin hangs above the flood channel while Vex reaches for the royal seal.",
      present_character_prototypes: ["ally", "rival"],
      objective_label: "royal seal",
      danger_label: "burning gatehouse",
      threat_prototype: "rival",
    },
    opening_narration:
      "Black water climbs the gatehouse steps as fire races across the old timber. Arin hangs from a broken chain above the flood channel, one hand slipping. Across the flames, Vex closes in on the royal seal—the only key to Blackmoor's drowned capital. He meets your eyes and smiles as if the choice has already been made for you. Save the friend who carried you through exile, secure the object that could decide the kingdom, or force Vex to reveal why he needs it now. The gate groans. You have seconds.",
    first_choice_proposals: openingChoices(
      "Leap through the fire and pull Arin to safety.",
      "Cross the collapsing bridge and secure the royal seal.",
      "Block Vex at the inner gate and demand the truth.",
    ),
  },
  neon_afterlight: {
    base_template_id: "neon_afterlight",
    base_template_reason:
      "A high-concept mystery where a relationship and a unique piece of evidence cannot both be saved.",
    universe: {
      title: "Neon Afterlight",
      genre: "Cyberpunk mystery",
      mood: ["noir", "intimate", "paranoid"],
      premise:
        "Citizens rent memories while Mnemosyne Corp controls what the city is allowed to remember.",
      rules: [
        "A copied memory degrades whenever it is transferred.",
        "Oracle-9 cannot directly name its creator.",
        "Physical evidence cannot be edited remotely.",
      ],
    },
    story: {
      listener_role: "Memory-recovery detective",
      main_goal: "Recover a missing hour that can expose the city's founder",
      central_question: "Who ordered the citywide memory edits?",
      tone_guardrails: ["No graphic violence"],
      opening_hook:
        "Mira is trapped while the only copy of your missing hour is being erased.",
    },
    characters: [
      {
        prototype: "ally",
        name: "Mira",
        role_in_world: "Junior memory technician",
        relationship_to_listener: "Your newest source and uneasy friend",
        traits: ["idealistic", "reckless", "empathetic"],
        goal: "Free illegally stored memories",
        fear: "Becoming like her employer",
        secret: "Mira copied the listener's missing hour",
        speech_style: "Quick, direct, and full of technical metaphors",
        voice_hint: "Young, urgent, warm",
      },
      {
        prototype: "rival",
        name: "Kade",
        role_in_world: "Mnemosyne recovery chief",
        relationship_to_listener: "A former mentor who now hunts you",
        traits: ["controlled", "ambitious", "guarded"],
        goal: "Contain the missing-hour investigation",
        fear: "Learning his own loyalty was programmed",
        secret: "Kade requested the first memory edit",
        speech_style: "Calm, exact, never wastes a word",
        voice_hint: "Low, polished, restrained",
      },
      {
        prototype: "mystery_keeper",
        name: "Oracle-9",
        role_in_world: "Illegal archival intelligence",
        relationship_to_listener: "An anonymous voice that claims to know you",
        traits: ["precise", "evasive", "melancholic"],
        goal: "Restore the city's original memory record",
        fear: "Being reset before it can testify",
        secret: "Oracle-9 was trained from the founder's erased conscience",
        speech_style: "Incomplete truths and numbered observations",
        voice_hint: "Clear, calm, slightly synthetic",
      },
    ],
    opening_scene: {
      location: "Mnemosyne Clinic",
      situation:
        "The clinic locks down. Mira is trapped beside a memory furnace while Kade purges the shard containing your missing hour.",
      present_character_prototypes: ["ally", "rival"],
      objective_label: "missing memory shard",
      danger_label: "clinic lockdown",
      threat_prototype: "rival",
    },
    opening_narration:
      "The clinic lights turn red one floor at a time. Behind the glass, Mira fights a restraint cable while the memory furnace counts down from twelve. Inside it glows the only surviving copy of your missing hour. Kade watches from the control bridge, composed even as the lockdown seals around him. The air tastes metallic—the signature of a fresh edit. You can pull Mira free, preserve the shard, or confront the man who taught you how to recover memories in the first place. Whatever you leave behind will be gone when the counter reaches zero.",
    first_choice_proposals: openingChoices(
      "Pull Mira away from the memory furnace.",
      "Preserve the missing memory shard before the purge.",
      "Trap Kade on the control bridge and confront him.",
    ),
  },
  monsoon_house: {
    base_template_id: "monsoon_house",
    base_template_reason:
      "An intimate supernatural mystery whose opening forces family loyalty against physical evidence.",
    universe: {
      title: "Monsoon House",
      genre: "Supernatural family mystery",
      mood: ["warm", "tense", "bittersweet"],
      premise:
        "An old hill house repeats conversations during every monsoon, but the family has forgotten one of its own.",
      rules: [
        "The house repeats only words once spoken inside it.",
        "A repeated voice cannot answer a new question.",
        "Recordings made during the rain fade by sunrise.",
      ],
    },
    story: {
      listener_role: "Estranged heir returning home",
      main_goal: "Discover why one family member vanished from every memory",
      central_question: "Who asked the house to erase them?",
      tone_guardrails: ["No graphic violence"],
      opening_hook:
        "A forgotten voice returns as the attic collapses around Tara and the only recording.",
    },
    characters: [
      {
        prototype: "ally",
        name: "Tara",
        role_in_world: "Family archivist",
        relationship_to_listener: "Your cousin and childhood confidante",
        traits: ["protective", "observant", "quietly funny"],
        goal: "Recover the family's missing history",
        fear: "Discovering she chose to forget",
        secret: "Tara has heard the forgotten voice for years",
        speech_style: "Gentle observations followed by blunt conclusions",
        voice_hint: "Soft, grounded, intimate",
      },
      {
        prototype: "rival",
        name: "Dev",
        role_in_world: "Caretaker of the estate",
        relationship_to_listener: "Your older brother, who believes you abandoned him",
        traits: ["wounded", "suspicious", "proud"],
        goal: "Sell the house before it harms anyone else",
        fear: "Remembering what happened during the last monsoon",
        secret: "Dev destroyed the original family photograph",
        speech_style: "Defensive humor and unfinished accusations",
        voice_hint: "Tense, familiar, rain-worn",
      },
      {
        prototype: "mystery_keeper",
        name: "Grandmother Leela",
        role_in_world: "Family matriarch",
        relationship_to_listener: "The person who raised you and sent you away",
        traits: ["affectionate", "evasive", "composed"],
        goal: "Keep the forgotten bargain intact",
        fear: "The house repeating her final confession",
        secret: "Leela asked the house to erase her eldest daughter",
        speech_style: "Domestic details that conceal precise warnings",
        voice_hint: "Warm, steady, authoritative",
      },
    ],
    opening_scene: {
      location: "Monsoon House Attic",
      situation:
        "The storm locks the family inside. Tara is pinned under a falling beam while a dead radio records the forgotten voice.",
      present_character_prototypes: ["ally", "rival"],
      objective_label: "radio recording",
      danger_label: "collapsing attic",
      threat_prototype: "rival",
    },
    opening_narration:
      "Rain drums hard enough to make the old house speak. In the attic, a dead radio crackles to life with a woman's voice no one in your family remembers. Tara reaches for it just as a roof beam tears loose and pins her to the floor. Dev stands in the doorway, pale, insisting the recording must be destroyed before Grandmother Leela hears it. Water is already crawling toward the tape. You can free Tara, save the only evidence that the missing woman existed, or force Dev to explain why he recognizes her voice.",
    first_choice_proposals: openingChoices(
      "Lift the fallen beam and pull Tara free.",
      "Save the radio recording before the rain reaches it.",
      "Block the doorway and make Dev explain the voice.",
    ),
  },
};

export const TEMPLATE_SUMMARIES = Object.entries(STARTER_WORLDS).map(
  ([templateId, seed]) => ({
    template_id: templateId as TemplateId,
    title: seed.universe.title,
    genre: seed.universe.genre,
    mood: seed.universe.mood,
    hook: seed.story.opening_hook,
    listener_role: seed.story.listener_role,
    accent:
      templateId === "blackmoor"
        ? "ember"
        : templateId === "neon_afterlight"
          ? "neon"
          : "monsoon",
  }),
);

export function setupFromTemplate(templateId: TemplateId): WorldSetupInput {
  const seed = STARTER_WORLDS[templateId];
  return {
    template_id: templateId,
    story_brief: seed.universe.premise,
    genre: seed.universe.genre,
    mood: seed.universe.mood,
    listener_role: seed.story.listener_role,
    main_conflict: seed.story.main_goal,
    world_rules: seed.universe.rules,
    character_overrides: seed.characters.map((character) => ({
      prototype: character.prototype,
      name: character.name,
      instruction: character.relationship_to_listener,
    })),
    customization_prompt: "",
    language: "English",
    content_tone: "family_safe",
  };
}
