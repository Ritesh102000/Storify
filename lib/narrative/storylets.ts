import type {
  ChoiceAxis,
  MilestoneType,
  StoryEvent,
  Storylet,
  TemplateId,
  WorldSession,
} from "@/lib/types";

type StoryletSeed = Omit<
  Storylet,
  "template_id" | "milestone_types" | "compatible_axes"
> & {
  milestone_types?: MilestoneType[];
  compatible_axes?: ChoiceAxis[];
};

const ALL_STORY_MILESTONES: MilestoneType[] = [
  "investigation",
  "escalation",
  "revelation",
  "reversal",
  "crisis",
  "resolution",
];
const ALL_AXES: ChoiceAxis[] = ["protect", "pursue", "confront"];

const DECKS: Record<TemplateId, StoryletSeed[]> = {
  blackmoor: [
    {
      storylet_id: "light_torn_page",
      situation: "The keeper's logbook is open on the desk and last night's page has been torn out, leaving a ragged stub.",
      concrete_affordance: "Rubbing pencil over the next page raises the pressure marks of what was written.",
      pressure: "The boat is twenty minutes out and the lamp is still dark.",
      discovery_form: "The raised writing names a boat that was never logged as arriving.",
      character_conflict: "Mara wants the page read aloud; Rooke wants the log shut before the crew sees it.",
    },
    {
      storylet_id: "light_wrong_lamp",
      situation: "The great lamp turns, but its flashes come in the wrong rhythm for this coast.",
      concrete_affordance: "The timing can be counted against the brass rhythm plate bolted to the wall.",
      pressure: "Any boat reading that rhythm will steer for the rocks instead of the channel.",
      discovery_form: "Someone reset the rhythm by hand, and recently.",
      character_conflict: "Mara wants it corrected now; Rooke wants to know who touched it first.",
    },
    {
      storylet_id: "light_wet_coat",
      situation: "A oilskin coat hangs dripping by the stove, though nobody admits to going outside.",
      concrete_affordance: "The salt line on the hem shows how deep the wearer stood in the water.",
      pressure: "The tide is still rising and the causeway will be gone within the hour.",
      discovery_form: "The coat is sized for someone who is not supposed to be on the island.",
      character_conflict: "Mara reads it as proof of a visitor; Rooke insists it is his own from yesterday.",
    },
    {
      storylet_id: "light_radio_answer",
      situation: "The radio crackles and a voice answers the lighthouse call sign using last year's code.",
      concrete_affordance: "The old code book in the drawer can confirm which year that sign was retired.",
      pressure: "Each exchange drains the last of the emergency battery.",
      discovery_form: "The voice knows a detail only someone inside the lighthouse could know.",
      character_conflict: "Mara wants to keep answering; Rooke wants the set switched off entirely.",
    },
    {
      storylet_id: "light_locked_store",
      situation: "The oil store is padlocked, though the lighthouse has never needed a lock.",
      concrete_affordance: "The lock is new and its key can be matched against the ring on the desk hook.",
      pressure: "Without oil the lamp dies at the exact moment the boat needs it.",
      discovery_form: "The store holds fewer drums than the log claims were delivered.",
      character_conflict: "Mara wants it broken open; Rooke says the lock is there for a reason.",
      milestone_types: ["revelation", "reversal", "crisis", "resolution"],
    },
    {
      storylet_id: "light_second_set",
      situation: "A second set of footprints crosses the wet stair and stops at the lamp room door.",
      concrete_affordance: "The tread pattern can be compared with the boots lined up in the porch.",
      pressure: "The stair is the only way down, and the prints lead up.",
      discovery_form: "The prints were made before the storm began, not during it.",
      character_conflict: "Mara counts three people on the island; Rooke insists there are only two.",
    },
  ],
  neon_afterlight: [
    {
      storylet_id: "hour_ticket_stub",
      situation: "A bus ticket in your pocket is stamped for a route you never take, timed inside the missing hour.",
      concrete_affordance: "The depot's printed manifest can confirm whether that bus ran at all.",
      pressure: "The manifest is collected and shredded at the end of every shift.",
      discovery_form: "The bus is listed as out of service for the whole night.",
      character_conflict: "Nia wants the stub kept as proof; Kade wants it handed to the depot office.",
    },
    {
      storylet_id: "hour_missed_call",
      situation: "Your phone shows an outgoing call, four minutes long, to a number you do not recognise.",
      concrete_affordance: "The depot's wall phone can be dialled to see which handset rings.",
      pressure: "The battery is at four percent and there is no charger here.",
      discovery_form: "The number rings a phone inside this building.",
      character_conflict: "Nia wants to call it now; Kade wants to know who is standing near it first.",
    },
    {
      storylet_id: "hour_lost_property",
      situation: "A jacket in the lost-property cage has your name written inside the collar in your own hand.",
      concrete_affordance: "The cage log records the date and finder of every item shelved there.",
      pressure: "Unclaimed items are bagged for disposal at six.",
      discovery_form: "The jacket was handed in an hour before you say you arrived.",
      character_conflict: "Nia wants it opened and searched; Kade says touching it breaks the chain of custody.",
    },
    {
      storylet_id: "hour_camera_gap",
      situation: "The depot monitor cycles through platforms, and one camera holds a frozen frame instead of a live feed.",
      concrete_affordance: "The recorder in the office stores the last hour on a physical drive.",
      pressure: "The drive overwrites itself every ninety minutes.",
      discovery_form: "The frozen frame is timestamped in the middle of the missing hour.",
      character_conflict: "Nia wants the drive copied; Kade wants the office door left shut.",
    },
    {
      storylet_id: "hour_wrong_shoes",
      situation: "Your shoes are soaked through, though it has not rained in the city for a week.",
      concrete_affordance: "The grit in the tread can be matched to the depot's own wash bay.",
      pressure: "They are drying fast under the heaters and the trace is disappearing.",
      discovery_form: "The grit comes from a yard that has been sealed off for months.",
      character_conflict: "One of them wants you to sit down; the other wants you to walk it back.",
      milestone_types: ["revelation", "reversal", "crisis"],
    },
    {
      storylet_id: "hour_signed_form",
      situation: "A depot incident form on the counter carries your signature and tonight's date.",
      concrete_affordance: "The carbon copy underneath still holds the pressure of the original writing.",
      pressure: "The supervisor is due back to collect the forms.",
      discovery_form: "The signature is yours, but the account written above it is not.",
      character_conflict: "Nia wants the copy taken; Kade wants the original left exactly where it is.",
    },
  ],
  monsoon_house: [
    {
      storylet_id: "room_locked_door",
      situation: "The upstairs room has been locked for as long as anyone can remember, and rain is coming through its ceiling into the hall.",
      concrete_affordance: "The keys on the kitchen ring can be tried one at a time against the lock.",
      pressure: "Water is spreading along the floorboards toward the stairs.",
      discovery_form: "One key on the family ring fits a door nobody claims to have opened.",
      character_conflict: "Tara wants the door open now; Dev wants the ceiling dealt with first.",
    },
    {
      storylet_id: "room_extra_cup",
      situation: "The tea tray set out this morning holds four cups, though only three people live here.",
      concrete_affordance: "The cupboard shelf shows a clean ring where a fourth cup always stood.",
      pressure: "Ammu is clearing the tray and rinsing everything on it.",
      discovery_form: "The fourth cup has been used recently and washed by hand.",
      character_conflict: "Tara counts the family out loud; Dev tells her to stop counting.",
    },
    {
      storylet_id: "room_photo_gap",
      situation: "The framed photographs along the stairs run in order, and one frame between them is empty.",
      concrete_affordance: "The wall behind the frames is faded except where the missing one hung.",
      pressure: "Damp is lifting the remaining prints off their backing.",
      discovery_form: "The faded patch is larger than any photograph still on the wall.",
      character_conflict: "Tara wants the album fetched; Dev says the album was thrown out years ago.",
    },
    {
      storylet_id: "room_wrong_name",
      situation: "A parcel arrives addressed to this house, to a name none of them will say out loud.",
      concrete_affordance: "The postmark and the handwriting can be compared with letters in the bureau.",
      pressure: "The paper is soaking through in the rain on the step.",
      discovery_form: "The handwriting matches letters kept in the house.",
      character_conflict: "Tara wants it opened; Dev wants it refused and sent back.",
    },
    {
      storylet_id: "room_ceiling_stain",
      situation: "The stain spreading across the hall ceiling has a hard straight edge on one side.",
      concrete_affordance: "The shape can be measured against the floor plan folded in the bureau drawer.",
      pressure: "The plaster is sagging and will come down before morning.",
      discovery_form: "The straight edge follows a wall that is not on the plan.",
      character_conflict: "One of them wants the plaster opened; the other recognises the line.",
      milestone_types: ["revelation", "reversal", "crisis", "resolution"],
    },
    {
      storylet_id: "room_kept_key",
      situation: "Ammu keeps one key separate from the others, on a string under her blouse.",
      concrete_affordance: "The key's shape can be compared with the lock plate on the upstairs door.",
      pressure: "She is being sent out to the neighbours before the road floods.",
      discovery_form: "The key is worn smooth from decades of use.",
      character_conflict: "Tara asks her directly; Dev asks her not to answer.",
    },
  ],
};

export function starterStoryletDeck(templateId: TemplateId): Storylet[] {
  return DECKS[templateId].map((seed) => ({
    ...seed,
    template_id: templateId,
    milestone_types: seed.milestone_types ?? ALL_STORY_MILESTONES,
    compatible_axes: seed.compatible_axes ?? ALL_AXES,
  }));
}

export function eligibleStorylets(
  session: WorldSession,
  event: StoryEvent,
  limit = 4,
): Storylet[] {
  const milestone =
    session.arc_state.milestones[session.arc_state.active_milestone_index]
      .milestone_type;
  const axis = axisForCommand(event.command_type);
  const recent = new Set(session.arc_state.recent_storylet_ids ?? []);
  const deck =
    session.storylet_deck?.length
      ? session.storylet_deck
      : starterStoryletDeck(session.template_id);
  const eligible = deck.filter(
    (storylet) =>
      storylet.milestone_types.includes(milestone) &&
      storylet.compatible_axes.includes(axis) &&
      !recent.has(storylet.storylet_id),
  );
  const pool = eligible.length
    ? eligible
    : deck.filter((item) => !recent.has(item.storylet_id));
  const start = session.state.turn_index % Math.max(1, pool.length);
  return [...pool.slice(start), ...pool.slice(0, start)].slice(0, limit);
}

export function storyletById(
  session: WorldSession,
  storyletId: string,
): Storylet | null {
  const event = session.events.at(-1);
  if (!event) return null;
  return (
    eligibleStorylets(session, event, session.storylet_deck?.length ?? 6).find(
      (item) => item.storylet_id === storyletId,
    ) ?? null
  );
}

function axisForCommand(command: StoryEvent["command_type"]): ChoiceAxis {
  if (command === "help_character") return "protect";
  if (command === "pursue_goal") return "pursue";
  return "confront";
}
