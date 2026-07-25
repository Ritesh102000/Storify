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
    plot_outline: {
      theme: "A crown is only worth what its bearer refuses to sacrifice.",
      ending_direction:
        "The listener reaches the final gate and must decide whether saving Blackmoor means surrendering the claim that could unite it.",
      beats: [
        {
          beat_type: "setup",
          title: "The Burning Gate",
          location: "Blackmoor Gatehouse",
          objective: "Survive the gatehouse and decide what cannot be abandoned",
          obstacle: "Fire, rising water, and Vex divide the only escape route.",
          development:
            "The opening choice establishes whether friendship, proof, or confrontation defines the pursuit.",
          reveal:
            "The royal seal reacts to the listener's touch as if recognizing them.",
          story_question: "Why does the royal seal recognize a disgraced courier?",
          present_character_prototypes: ["ally", "rival"],
        },
        {
          beat_type: "pursuit",
          title: "The Saltwind Chase",
          location: "Saltwind Causeway",
          objective: "Intercept the seal before the tide severs the island road",
          obstacle:
            "Crownless riders collapse sections of the causeway while refugees cross in the opposite direction.",
          development:
            "A map hidden in the seal points not to the capital, but to an archive beneath the reef.",
          reveal:
            "Someone altered the official gate map to hide a route reserved for the royal bloodline.",
          story_question: "Who changed the map, and who were they protecting?",
          present_character_prototypes: ["ally", "rival"],
        },
        {
          beat_type: "reveal",
          title: "The Archive Below",
          location: "Archive Reef",
          objective: "Recover the unaltered gate record before the chamber floods",
          obstacle:
            "The archive only opens when the listener speaks a name erased from the royal history.",
          development:
            "The Gatekeeper emerges from the submerged stacks and tests the listener's right to continue.",
          reveal:
            "The lost capital was sealed deliberately after its rulers woke something beneath it.",
          story_question: "What is still alive beneath the drowned capital?",
          present_character_prototypes: ["ally", "mystery_keeper"],
        },
        {
          beat_type: "reversal",
          title: "Bells for a False Heir",
          location: "Bell-Tower Island",
          objective: "Stop the island council from giving Vex control of the final fleet",
          obstacle:
            "Evidence brands the listener as the person who sabotaged the outer gates years ago.",
          development:
            "The hunt reverses when the islands turn against the listener and Vex offers public protection at a private price.",
          reveal:
            "The sabotage record carries the same hidden royal cipher found inside the seal.",
          story_question: "Was the listener framed, or were their memories altered?",
          present_character_prototypes: ["rival", "mystery_keeper"],
        },
        {
          beat_type: "crisis",
          title: "The Last Island Falls",
          location: "Sunken Throne Causeway",
          objective: "Reach the final gate before the outer island is sacrificed",
          obstacle:
            "Opening the approach will flood the home Arin has sworn to protect.",
          development:
            "Every faction converges and the listener must carry the cost of earlier choices into a single alliance.",
          reveal:
            "The final gate can be sealed forever only by someone the seal accepts as sovereign.",
          story_question: "Will the listener claim the crown to destroy its power?",
          present_character_prototypes: ["ally", "rival", "mystery_keeper"],
        },
        {
          beat_type: "climax",
          title: "The Drowned Crown",
          location: "Crown Gate",
          objective: "Choose the fate of the prison beneath Blackmoor",
          obstacle:
            "The sea-prison wakes while Vex, Arin, and the Gatekeeper demand incompatible futures.",
          development:
            "The listener's accumulated trust, losses, and discoveries determine who stands with them at the gate.",
          reveal:
            "The crown was never a throne; it was a promise that one heir would remain behind as the final lock.",
          story_question: "What kind of ruler ends a kingdom in order to save its people?",
          present_character_prototypes: ["ally", "rival", "mystery_keeper"],
        },
      ],
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
    plot_outline: {
      theme: "Identity survives through the memories people choose to protect.",
      ending_direction:
        "The listener reaches the citywide broadcast and must choose between restoring the truth, protecting the people changed by the lie, and preserving their own identity.",
      beats: [
        {
          beat_type: "setup",
          title: "Twelve Seconds",
          location: "Mnemosyne Clinic",
          objective: "Escape the purge with either Mira, the shard, or leverage over Kade",
          obstacle:
            "The lockdown destroys memories and seals exits one floor at a time.",
          development:
            "The opening choice determines which human cost follows the listener into the investigation.",
          reveal:
            "The missing-hour shard carries a timestamp from tomorrow.",
          story_question: "How can a memory exist before it happens?",
          present_character_prototypes: ["ally", "rival"],
        },
        {
          beat_type: "pursuit",
          title: "The Rainline Ghost",
          location: "Abandoned Rainline Tunnel",
          objective: "Trace the future timestamp to an illegal memory relay",
          obstacle:
            "Advertisements built from stolen memories identify the listener and alert corporate hunters.",
          development:
            "A relay begins broadcasting fragments of the missing hour in the listener's own voice.",
          reveal:
            "The shard was copied after the listener officially disappeared from the city.",
          story_question: "Who used the listener's identity after their disappearance?",
          present_character_prototypes: ["ally", "mystery_keeper"],
        },
        {
          beat_type: "reveal",
          title: "The City Before",
          location: "Old City Memory Archive",
          objective: "Reconstruct the first unedited version of the missing hour",
          obstacle:
            "Each restored minute permanently erases one personal memory from the person viewing it.",
          development:
            "Oracle-9 guides the listener through mutually contradictory versions of the city's founding.",
          reveal:
            "The citywide edits were designed to hide a voluntary uprising, not a technical accident.",
          story_question: "Why did the uprising's leaders later consent to being erased?",
          present_character_prototypes: ["ally", "mystery_keeper"],
        },
        {
          beat_type: "reversal",
          title: "Exchange of Selves",
          location: "Afterlight Skybridge",
          objective: "Trade a recovered memory for access to the founder's private vault",
          obstacle:
            "Kade proves that one of the listener's most trusted memories was manufactured.",
          development:
            "The investigation becomes personal when the listener can no longer trust the relationship that motivated it.",
          reveal:
            "The missing hour contains instructions recorded by an earlier version of the listener.",
          story_question: "What did the earlier listener expect their future self to become?",
          present_character_prototypes: ["rival", "mystery_keeper"],
        },
        {
          beat_type: "crisis",
          title: "The Founder Vault",
          location: "Mnemosyne Founder Vault",
          objective: "Recover the master record before the city begins a total memory reset",
          obstacle:
            "Opening the record will expose every private memory Mnemosyne ever stole.",
          development:
            "Mira, Kade, and Oracle-9 each propose a different truth the city could survive.",
          reveal:
            "The listener helped design the reset as a failsafe, then erased their own consent.",
          story_question: "Does forgotten consent still bind the person who remains?",
          present_character_prototypes: ["ally", "rival", "mystery_keeper"],
        },
        {
          beat_type: "climax",
          title: "The Last Broadcast",
          location: "Afterlight Broadcast Spire",
          objective: "Choose which version of the city's memory becomes public",
          obstacle:
            "The broadcast can restore the truth only by overwriting the life the listener built afterward.",
          development:
            "Every protected relationship and recovered clue becomes part of the final broadcast decision.",
          reveal:
            "There is no untouched original memory—only accountable choices about what the city carries forward.",
          story_question: "Who owns a truth when remembering it changes everyone?",
          present_character_prototypes: ["ally", "rival", "mystery_keeper"],
        },
      ],
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
    plot_outline: {
      theme: "A family cannot heal from a loss it refuses to name.",
      ending_direction:
        "The listener reaches the room the house erased and must decide whether restoring the missing woman will also restore the pain everyone surrendered.",
      beats: [
        {
          beat_type: "setup",
          title: "The Voice in the Rain",
          location: "Monsoon House Attic",
          objective: "Save a person, preserve the recording, or force the first confession",
          obstacle:
            "The collapsing attic and rising rain make every part of the truth impossible to keep.",
          development:
            "The opening choice determines which family member first trusts the listener with the past.",
          reveal:
            "The forgotten voice uses the private childhood name of the listener.",
          story_question: "Why does the erased woman remember the listener?",
          present_character_prototypes: ["ally", "rival"],
        },
        {
          beat_type: "pursuit",
          title: "The Missing Corridor",
          location: "Sealed East Corridor",
          objective: "Find the room that appears only when the forgotten voice speaks",
          obstacle:
            "The corridor rearranges itself whenever a family member denies what they heard.",
          development:
            "Tara discovers a doorway behind a wall covered with newer family photographs.",
          reveal:
            "Every photograph leaves a person-shaped gap in exactly the same place.",
          story_question: "Who kept replacing the photographs after each monsoon?",
          present_character_prototypes: ["ally", "rival"],
        },
        {
          beat_type: "reveal",
          title: "Names in the Garden",
          location: "Rain Garden",
          objective: "Match the repeated voices to names carved beneath the flooded stones",
          obstacle:
            "The rain stops whenever Grandmother Leela approaches, silencing the only witness.",
          development:
            "The garden reveals that the house has erased more than one person across several generations.",
          reveal:
            "Each erased name belonged to someone who tried to expose the same family bargain.",
          story_question: "What bargain has the family renewed for generations?",
          present_character_prototypes: ["ally", "mystery_keeper"],
        },
        {
          beat_type: "reversal",
          title: "The Wedding Tape",
          location: "Abandoned Family Chapel",
          objective: "Play a wedding recording before Dev destroys the chapel archive",
          obstacle:
            "The tape contains the listener's voice making a promise they cannot remember.",
          development:
            "Dev produces proof that the listener once helped the family preserve the erasure.",
          reveal:
            "The forgotten woman asked the listener to participate, believing it would save a child.",
          story_question: "Which child was the erasure meant to protect?",
          present_character_prototypes: ["rival", "mystery_keeper"],
        },
        {
          beat_type: "crisis",
          title: "What the Cellar Kept",
          location: "Flooded Foundation Cellar",
          objective: "Break the bargain before sunrise seals the house's memories again",
          obstacle:
            "Restoring the missing name begins erasing Tara from the family's present memories.",
          development:
            "The listener must carry earlier loyalties into a choice between one recovered life and another disappearing one.",
          reveal:
            "The house does not erase the dead; it transfers remembrance from one living person to another.",
          story_question: "Whose memory should bear the family's full grief?",
          present_character_prototypes: ["ally", "rival", "mystery_keeper"],
        },
        {
          beat_type: "climax",
          title: "The Room That Remembers",
          location: "Hidden Memory Room",
          objective: "End, renew, or transform the family's bargain",
          obstacle:
            "Every voice the house erased speaks at once, demanding to be carried back into the world.",
          development:
            "Trust, evidence, and the listener's recovered promise determine who enters the room with them.",
          reveal:
            "The house was built to share unbearable memory, but the family turned that gift into erasure.",
          story_question: "Can the family remember truth without choosing a new person to forget?",
          present_character_prototypes: ["ally", "rival", "mystery_keeper"],
        },
      ],
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
