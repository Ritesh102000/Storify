import type {
  ChoiceProposal,
  MilestoneContract,
  TemplateId,
  WorldSeedDraft,
  WorldSetupInput,
} from "./types";
import { starterStoryletDeck } from "./narrative/storylets";

const milestoneLimits: Record<
  MilestoneContract["milestone_type"],
  Pick<MilestoneContract, "permitted_revelations" | "forbidden_revelations">
> = {
  opening: { permitted_revelations: [], forbidden_revelations: ["the final answer"] },
  investigation: {
    permitted_revelations: ["evidence that the mystery is larger than one incident"],
    forbidden_revelations: ["the final culprit", "the final cost"],
  },
  escalation: {
    permitted_revelations: ["a consequence that raises personal stakes"],
    forbidden_revelations: ["the complete explanation"],
  },
  revelation: {
    permitted_revelations: ["a supported answer to one established question"],
    forbidden_revelations: ["the final resolution"],
  },
  reversal: {
    permitted_revelations: ["evidence that changes the meaning of an earlier fact"],
    forbidden_revelations: ["an unsupported surprise villain"],
  },
  crisis: {
    permitted_revelations: ["the irreversible cost of failure"],
    forbidden_revelations: ["a consequence-free escape"],
  },
  resolution: {
    permitted_revelations: ["the answer earned by stored evidence"],
    forbidden_revelations: ["a new central mystery that replaces closure"],
  },
};

function buildArc(
  purposes: Record<
    MilestoneContract["milestone_type"],
    [dramaticPurpose: string, stakesChange: string, completionEvidence: string]
  >,
): MilestoneContract[] {
  return (Object.keys(milestoneLimits) as MilestoneContract["milestone_type"][])
    .map((milestone_type) => ({
      milestone_type,
      dramatic_purpose: purposes[milestone_type][0],
      stakes_change: purposes[milestone_type][1],
      completion_evidence_description: purposes[milestone_type][2],
      ...milestoneLimits[milestone_type],
    }));
}

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
    narrative_intent: "Protect the person in immediate danger.",
    anticipated_tradeoff: "The physical objective may become harder to recover.",
  },
  {
    axis: "pursue",
    command_type: "pursue_goal",
    target_prototype: null,
    label: pursue,
    narrative_intent: "Secure the evidence or objective before it is lost.",
    anticipated_tradeoff: "A present relationship may be damaged.",
  },
  {
    axis: "confront",
    command_type: "confront_character",
    target_prototype: "rival",
    label: confront,
    narrative_intent: "Force a present character to answer now.",
    anticipated_tradeoff: "Pressure may reveal something but increase tension.",
  },
];

export const STARTER_WORLDS: Record<TemplateId, WorldSeedDraft> = {
  blackmoor: {
    base_template_id: "blackmoor",
    base_template_reason:
      "One building, one night, one approaching boat: the smallest frame that still supports a real mystery.",
    universe: {
      title: "The Lighthouse at Kelp Point",
      genre: "Storm-night mystery",
      mood: ["tense", "cold", "close"],
      premise:
        "A lighthouse on a tidal island. A storm has cut the causeway, a boat is due in before dawn, and the keeper's log is missing last night's page.",
      rules: [
        "The lamp must flash the coast's own rhythm or boats steer for the rocks.",
        "The causeway is underwater from high tide until dawn.",
        "The radio runs on the emergency battery, and every call spends it.",
      ],
    },
    story: {
      listener_role: "The relief keeper, here for your first night",
      main_goal: "Get the lamp showing the right rhythm before the boat reaches the rocks",
      central_question: "Who tore the page out of the log, and what came in last night?",
      tone_guardrails: ["Keep danger tense but non-graphic"],
      opening_hook:
        "The lamp is turning wrong, Mara is trapped under the fallen stair, and the boat is twenty minutes out.",
    },
    arc_plan: {
      theme: "A light is only useful if someone can trust what it says.",
      ending_direction:
        "Settle who altered the light and what it cost, using evidence the listener gathered.",
      milestones: buildArc({
        opening: ["Force a costly choice between a person, the objective, and an answer.", "The listener becomes responsible for a concrete loss.", "One option is chosen and its cost is made irreversible."],
        investigation: ["Show through independent evidence that this is not a one-off accident.", "A private worry becomes something that affects everyone here.", "Two different kinds of evidence support the same pattern."],
        escalation: ["Turn an earlier choice into a new obstacle or a damaged trust.", "Waiting now costs someone something they cannot get back.", "A stored consequence directly blocks the active objective."],
        revelation: ["Answer one established question with physical proof.", "The listener gains a usable fact and a harder responsibility.", "An object and a witness account support the same conclusion."],
        reversal: ["Change the meaning of an earlier accusation or kindness.", "The safest path becomes the one with the highest cost.", "New evidence contradicts a reasonable earlier reading without erasing it."],
        crisis: ["Put the goal in direct conflict with a person the listener protected.", "One thing will be lost no matter which action is taken.", "Both costs are present, specific, and caused by established rules."],
        resolution: ["Answer the central question using what the listener actually gathered.", "The place and the people keep a visible permanent change.", "The final action answers the question and pays an established cost."],
      }),
    },
    storylet_deck: starterStoryletDeck("blackmoor"),
    characters: [
      {
        prototype: "ally",
        name: "Mara",
        role_in_world: "The keeper's daughter, who grew up on this island",
        relationship_to_listener: "The only person here who wants you to succeed",
        traits: ["steady", "stubborn", "honest"],
        goal: "Get the light working before the boat comes in",
        fear: "That her father caused this and she already knows it",
        secret: "She found the torn page and hid it before you arrived",
        speech_style: "Short practical sentences, no softening",
        voice_hint: "Low, clear, salt-worn",
      },
      {
        prototype: "rival",
        name: "Rooke",
        role_in_world: "Harbour master, responsible for every boat on this coast",
        relationship_to_listener: "The man who signed you in and does not trust you",
        traits: ["controlled", "defensive", "quick"],
        goal: "Keep the harbour's record clean whatever happened here",
        fear: "Being held responsible for a wreck he could have prevented",
        secret: "He logged a boat as turned away that he actually let through",
        speech_style: "Official phrasing that hardens under pressure",
        voice_hint: "Clipped, official, tightening",
      },
      {
        prototype: "mystery_keeper",
        name: "Silas",
        role_in_world: "The old keeper, who has run this light for forty years",
        relationship_to_listener: "The man you were sent to relieve",
        traits: ["quiet", "precise", "evasive"],
        goal: "Keep one night off the record",
        fear: "That the sea gives back what he let it take",
        secret: "He changed the lamp's rhythm himself, and he knows why",
        speech_style: "Answers a different question than the one asked",
        voice_hint: "Slow, gravelled, unhurried",
      },
    ],
    opening_scene: {
      location: "The lamp room at Kelp Point",
      situation:
        "The stair rail has come away and pinned Mara's leg. The lamp is turning on the wrong rhythm. Rooke is closing the log book.",
      present_character_prototypes: ["ally", "rival"],
      objective_label: "the keeper's log",
      danger_label: "the wrong rhythm and the incoming boat",
      threat_prototype: "rival",
    },
    opening_narration:
      "Rain drives flat across the lamp room glass. Below you the sea is already over the causeway, and somewhere out in it a boat is running for this light. The lamp turns — and its flashes come wrong, too quick, a rhythm that belongs to no coast you know. Mara is on the floor with the broken stair rail across her leg, telling you she is fine when she plainly is not. Rooke stands at the desk with the keeper's log half shut under his hand, and last night's page is a torn stub. Twenty minutes, maybe less.",
    first_choice_proposals: openingChoices(
      "Lift the rail off Mara's leg.",
      "Take the log out of Rooke's hands.",
      "Ask Rooke what he tore out of it.",
    ),
  },
  neon_afterlight: {
    base_template_id: "neon_afterlight",
    base_template_reason:
      "A single depot at night, an hour the listener cannot account for, and two people who each want a different explanation.",
    universe: {
      title: "The Missing Hour",
      genre: "Modern mystery",
      mood: ["uneasy", "sleepless", "urgent"],
      premise:
        "You come round on a bench in a city bus depot at three in the morning. Your watch says four. One hour of your night is simply gone.",
      rules: [
        "The depot's camera drive overwrites itself every ninety minutes.",
        "Lost property is bagged for disposal at six.",
        "Nobody leaves the depot until the first bus runs.",
      ],
    },
    story: {
      listener_role: "A passenger who cannot account for the last hour",
      main_goal: "Find out what you did in the missing hour before the evidence is cleared away",
      central_question: "What happened in that hour, and who else was there for it?",
      tone_guardrails: ["Keep it unsettling rather than frightening"],
      opening_hook:
        "You wake on a depot bench with an hour gone, a ticket you never bought, and two people who both saw you.",
    },
    arc_plan: {
      theme: "You are what the record says you did, until you can prove otherwise.",
      ending_direction:
        "Account for the missing hour using physical evidence the listener actually secured.",
      milestones: buildArc({
        opening: ["Force a costly choice between a person, the objective, and an answer.", "The listener becomes responsible for a concrete loss.", "One option is chosen and its cost is made irreversible."],
        investigation: ["Show through independent evidence that this is not a one-off accident.", "A private worry becomes something that affects everyone here.", "Two different kinds of evidence support the same pattern."],
        escalation: ["Turn an earlier choice into a new obstacle or a damaged trust.", "Waiting now costs someone something they cannot get back.", "A stored consequence directly blocks the active objective."],
        revelation: ["Answer one established question with physical proof.", "The listener gains a usable fact and a harder responsibility.", "An object and a witness account support the same conclusion."],
        reversal: ["Change the meaning of an earlier accusation or kindness.", "The safest path becomes the one with the highest cost.", "New evidence contradicts a reasonable earlier reading without erasing it."],
        crisis: ["Put the goal in direct conflict with a person the listener protected.", "One thing will be lost no matter which action is taken.", "Both costs are present, specific, and caused by established rules."],
        resolution: ["Answer the central question using what the listener actually gathered.", "The place and the people keep a visible permanent change.", "The final action answers the question and pays an established cost."],
      }),
    },
    storylet_deck: starterStoryletDeck("neon_afterlight"),
    characters: [
      {
        prototype: "ally",
        name: "Nia",
        role_in_world: "A night nurse waiting out her shift change",
        relationship_to_listener: "A stranger who decided to stay with you",
        traits: ["calm", "direct", "kind"],
        goal: "Work out what happened to you before you are moved on",
        fear: "Walking away from someone who needed help, again",
        secret: "She saw you an hour ago and did not recognise you then",
        speech_style: "Plain questions asked gently and repeated",
        voice_hint: "Warm, tired, unhurried",
      },
      {
        prototype: "rival",
        name: "Kade",
        role_in_world: "The depot's night inspector",
        relationship_to_listener: "The man deciding whether to put you out on the street",
        traits: ["procedural", "wary", "blunt"],
        goal: "Close the shift with nothing on the incident book",
        fear: "Being blamed for whatever happened on his watch",
        secret: "He already filed a report about you before you woke up",
        speech_style: "Rules quoted first, opinions second",
        voice_hint: "Flat, official, edged",
      },
      {
        prototype: "mystery_keeper",
        name: "Mr Advani",
        role_in_world: "The lost-property clerk, here every night for nineteen years",
        relationship_to_listener: "Someone who seems to have been expecting you",
        traits: ["patient", "watchful", "indirect"],
        goal: "Keep his cage and its contents undisturbed",
        fear: "Being asked to explain what he keeps back",
        secret: "Your jacket has been on his shelf since before you arrived",
        speech_style: "Small talk that circles the thing you asked",
        voice_hint: "Soft, precise, amused",
      },
    ],
    opening_scene: {
      location: "The night depot waiting hall",
      situation:
        "You are on a bench with an hour missing. Nia is holding your wrist, taking your pulse. Kade is standing over you with an incident book open.",
      present_character_prototypes: ["ally", "rival"],
      objective_label: "the ticket in your pocket",
      danger_label: "the hour you cannot account for",
      threat_prototype: "rival",
    },
    opening_narration:
      "Strip lights buzz over an empty waiting hall. You are sitting up on a bench with no memory of lying down, and the clock above the platform says four when the last thing you remember was three. A woman has two fingers on your wrist, counting. A man in a depot jacket stands over you with an incident book already open, pen down, asking your name for what he says is the second time. There is a bus ticket in your pocket, damp, stamped for a route you have never taken.",
    first_choice_proposals: openingChoices(
      "Let Nia finish checking you over.",
      "Get the ticket out and read it properly.",
      "Ask Kade what he wrote down the first time.",
    ),
  },
  monsoon_house: {
    base_template_id: "monsoon_house",
    base_template_reason:
      "A family house, one locked door, and two siblings who want opposite things before the rain gets in.",
    universe: {
      title: "The Locked Room",
      genre: "Family mystery",
      mood: ["close", "grieving", "unsettled"],
      premise:
        "Your grandmother's house, three days after the funeral. The rain has found a way through the roof, and the one room that was always locked is directly underneath it.",
      rules: [
        "Nobody in this family says the name of the person who left.",
        "The upstairs room has been locked since before you were born.",
        "The road floods by morning and nobody gets out until it clears.",
      ],
    },
    story: {
      listener_role: "The grandchild who moved away and came back for the funeral",
      main_goal: "Open the locked room before the ceiling comes down on whatever is inside",
      central_question: "Who was kept out of this family, and which of them agreed to it?",
      tone_guardrails: ["Treat grief seriously", "No cruelty for its own sake"],
      opening_hook:
        "Water is coming through the ceiling outside the locked room, and Dev has the only key in his fist.",
    },
    arc_plan: {
      theme: "A family keeps its shape by agreeing what not to mention.",
      ending_direction:
        "Settle what the room holds and who chose to lock it, using what the listener uncovered.",
      milestones: buildArc({
        opening: ["Force a costly choice between a person, the objective, and an answer.", "The listener becomes responsible for a concrete loss.", "One option is chosen and its cost is made irreversible."],
        investigation: ["Show through independent evidence that this is not a one-off accident.", "A private worry becomes something that affects everyone here.", "Two different kinds of evidence support the same pattern."],
        escalation: ["Turn an earlier choice into a new obstacle or a damaged trust.", "Waiting now costs someone something they cannot get back.", "A stored consequence directly blocks the active objective."],
        revelation: ["Answer one established question with physical proof.", "The listener gains a usable fact and a harder responsibility.", "An object and a witness account support the same conclusion."],
        reversal: ["Change the meaning of an earlier accusation or kindness.", "The safest path becomes the one with the highest cost.", "New evidence contradicts a reasonable earlier reading without erasing it."],
        crisis: ["Put the goal in direct conflict with a person the listener protected.", "One thing will be lost no matter which action is taken.", "Both costs are present, specific, and caused by established rules."],
        resolution: ["Answer the central question using what the listener actually gathered.", "The place and the people keep a visible permanent change.", "The final action answers the question and pays an established cost."],
      }),
    },
    storylet_deck: starterStoryletDeck("monsoon_house"),
    characters: [
      {
        prototype: "ally",
        name: "Tara",
        role_in_world: "Your cousin, who stayed and looked after the house",
        relationship_to_listener: "The one who kept writing to you after you left",
        traits: ["warm", "persistent", "tired"],
        goal: "Get the truth said out loud once, in this house",
        fear: "That she helped keep the silence without noticing",
        secret: "She has been into the room before, years ago",
        speech_style: "Gentle openings that end in a plain hard question",
        voice_hint: "Soft, steady, close",
      },
      {
        prototype: "rival",
        name: "Dev",
        role_in_world: "Your older brother, executor of the estate",
        relationship_to_listener: "The one who stayed behind and resents that you did not",
        traits: ["practical", "guarded", "sharp"],
        goal: "Get the house sold and everyone out before the road floods",
        fear: "Finding out he was old enough to have stopped it",
        secret: "He knows exactly why the room was locked",
        speech_style: "Deflects with practicalities, then snaps",
        voice_hint: "Tight, quick, rain-worn",
      },
      {
        prototype: "mystery_keeper",
        name: "Ammu",
        role_in_world: "The housekeeper, here since your grandmother was young",
        relationship_to_listener: "The person who raised you more than anyone admits",
        traits: ["affectionate", "careful", "evasive"],
        goal: "Keep a promise she made a long time ago",
        fear: "Being the one who finally says it",
        secret: "She has carried the room's key on a string for forty years",
        speech_style: "Offers food and instructions instead of answers",
        voice_hint: "Warm, low, unhurried",
      },
    ],
    opening_scene: {
      location: "The upstairs hall",
      situation:
        "Water is coming through the ceiling outside the locked room. Tara is holding a bucket under it. Dev has the key ring closed in his fist and is telling everyone to go downstairs.",
      present_character_prototypes: ["ally", "rival"],
      objective_label: "the key ring",
      danger_label: "the sagging ceiling outside the locked room",
      threat_prototype: "rival",
    },
    opening_narration:
      "The rain has been going since the funeral and tonight the house finally gives. Water comes through the upstairs ceiling in a steady rope, right outside the door that has been locked your whole life. Tara is under it with a bucket, both arms up, already soaked. Dev stands between you and the door with the key ring shut inside his fist, saying the plaster is coming down and everyone should be downstairs. The stain above the door has a hard straight edge to it, like it is following something built into the wall.",
    first_choice_proposals: openingChoices(
      "Take the bucket and get Tara out from under it.",
      "Get the key ring off Dev.",
      "Ask Dev why he is standing in front of that door.",
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
    creativity: "balanced",
  };
}
