import { createId } from "@/lib/id";
import type {
  Character,
  StoryEvent,
  WorldPreview,
  WorldSession,
} from "@/lib/types";
import type { SimulationState } from "./types";

const OPENING_LOCATION_ID = "location_opening";
const OBJECTIVE_ENTITY_ID = "object_active_objective";
const OPENING_HAZARD_ID = "hazard_opening";

export function createInitialSimulation(
  preview: WorldPreview,
  characters: Character[],
): SimulationState {
  const facts: SimulationState["facts"] = {};
  for (const [index, rule] of preview.seed.universe.rules.entries()) {
    const factId = `fact_world_rule_${index + 1}`;
    facts[factId] = {
      fact_id: factId,
      statement: rule,
      truth_status: "true",
      evidence: ["World rule established during world creation."],
      source_event_id: null,
      known_by_character_ids: characters.map((character) => character.character_id),
      reveal_after: null,
      status: "active",
    };
  }
  for (const character of characters) {
    facts[character.secret_fact_id] = {
      fact_id: character.secret_fact_id,
      statement: character.secret,
      truth_status: "true",
      evidence: ["Private character canon."],
      source_event_id: null,
      known_by_character_ids: [character.character_id],
      reveal_after: "revelation",
      status: "active",
    };
  }

  return {
    simulation_version: 1,
    template_id: preview.resolved_template_id,
    clock: {
      elapsed_minutes: 0,
      time_label: "Day 1, 00:00",
      turn_started_at_minutes: 0,
    },
    entities: {
      [OPENING_LOCATION_ID]: {
        entity_id: OPENING_LOCATION_ID,
        kind: "location",
        name: preview.seed.opening_scene.location,
        description: preview.seed.opening_scene.situation,
        status: "active",
        location_id: null,
        portable: false,
        carried_by: null,
        properties: { opening_location: true },
        introduced_event_id: null,
      },
      [OBJECTIVE_ENTITY_ID]: {
        entity_id: OBJECTIVE_ENTITY_ID,
        kind: "object",
        name: preview.seed.opening_scene.objective_label,
        description: `The physical focus of the opening objective: ${preview.seed.opening_scene.objective_label}.`,
        status: "contested",
        location_id: OPENING_LOCATION_ID,
        portable: true,
        carried_by: null,
        properties: { objective: true },
        introduced_event_id: null,
      },
      [OPENING_HAZARD_ID]: {
        entity_id: OPENING_HAZARD_ID,
        kind: "hazard",
        name: preview.seed.opening_scene.danger_label,
        description: preview.seed.opening_scene.situation,
        status: "active",
        location_id: OPENING_LOCATION_ID,
        portable: false,
        carried_by: null,
        properties: { opening_hazard: true },
        introduced_event_id: null,
      },
      ...Object.fromEntries(
        characters.map((character) => [
          character.character_id,
          {
            entity_id: character.character_id,
            kind: "character" as const,
            name: character.name,
            description: character.role_in_world,
            status: preview.seed.opening_scene.present_character_prototypes.includes(
              character.prototype,
            )
              ? "present"
              : "absent",
            location_id: preview.seed.opening_scene.present_character_prototypes.includes(
              character.prototype,
            )
              ? OPENING_LOCATION_ID
              : null,
            portable: false,
            carried_by: null,
            properties: { prototype: character.prototype },
            introduced_event_id: null,
          },
        ]),
      ),
    },
    characters: Object.fromEntries(
      characters.map((character) => [
        character.character_id,
        {
          character_id: character.character_id,
          mind: {
            current_goal: character.goal,
            current_belief: `My immediate decisions should serve: ${character.goal}`,
            current_emotion:
              character.prototype === "ally"
                ? "under pressure"
                : character.prototype === "rival"
                  ? "watchful"
                  : "guarded",
            attitude_to_listener: character.relationship_to_listener,
            last_changed_event_id: null,
          },
          beliefs: [
            ...preview.seed.universe.rules.map((_, index) => ({
              fact_id: `fact_world_rule_${index + 1}`,
              confidence: 100,
              interpretation: "A reliable rule of this world.",
              learned_event_id: null,
            })),
            {
              fact_id: character.secret_fact_id,
              confidence: 100,
              interpretation: "Private knowledge I will not reveal without cause.",
              learned_event_id: null,
            },
          ],
          goals: [
            {
              goal_id: `goal_${character.prototype}_core`,
              description: character.goal,
              priority: 80,
              status: "active" as const,
              created_event_id: null,
            },
          ],
        },
      ]),
    ),
    facts,
    threads: {
      thread_central: {
        thread_id: "thread_central",
        question: preview.seed.story.central_question,
        stakes: preview.seed.story.main_goal,
        status: "open",
        required_evidence_count: 3,
        evidence_fact_ids: [],
        opened_event_id: null,
        resolved_event_id: null,
      },
    },
    transitions: [],
    last_event_id: null,
  };
}

export function ensureSimulation(session: WorldSession): void {
  if (session.simulation?.simulation_version === 1) {
    // Sessions saved before possession tracking existed have no carrier field.
    for (const entity of Object.values(session.simulation.entities)) {
      entity.carried_by ??= null;
    }
    return;
  }
  const preview: WorldPreview = {
    preview_id: "hydrated",
    requested_template_id: session.template_id,
    resolved_template_id: session.template_id,
    seed: {
      base_template_id: session.template_id,
      base_template_reason: "Hydrated from an existing schema-v2 session.",
      universe: session.universe,
      story: session.story,
      arc_plan: session.arc_plan,
      storylet_deck: session.storylet_deck ?? [],
      characters: session.characters,
      opening_scene: {
        location: session.scenes[0].location,
        situation: session.scenes[0].situation,
        present_character_prototypes: session.scenes[0].present_character_ids.map(
          (id) =>
            session.characters.find((character) => character.character_id === id)!
              .prototype,
        ),
        objective_label: session.semantic_labels.objective_label,
        danger_label: session.semantic_labels.danger_label,
        threat_prototype: "rival",
      },
      opening_narration: session.scenes[0].narration,
      first_choice_proposals: [],
    },
    creative_diffs: [],
    creativity: session.creativity ?? "balanced",
    retrieval: null,
    generation: session.generation,
    created_at: session.created_at,
  };
  session.simulation = createInitialSimulation(preview, session.characters);
  session.simulation_events ??= [];
}

export function recordPlayerEventInSimulation(
  session: WorldSession,
  event: StoryEvent,
): void {
  ensureSimulation(session);
  const simulation = session.simulation;
  simulation.clock.turn_started_at_minutes = simulation.clock.elapsed_minutes;
  simulation.last_event_id = event.event_id;
  const targetId = event.command_arguments.target_id;
  if (event.command_type === "help_character" && targetId) {
    const target = simulation.entities[targetId];
    if (target) target.status = "safe";
  }
  if (event.command_type === "pursue_goal") {
    const objective = simulation.entities[OBJECTIVE_ENTITY_ID];
    if (objective) objective.status = "actively pursued";
  }
  if (event.command_type === "confront_character" && targetId) {
    const target = simulation.characters[targetId];
    if (target) {
      target.mind.current_emotion = "pressured";
      target.mind.last_changed_event_id = event.event_id;
    }
  }
}

export function simulationLocationForScene(
  session: WorldSession,
  locationName: string,
): string | null {
  const normalized = locationName.toLowerCase().trim();
  return (
    Object.values(session.simulation.entities).find(
      (entity) =>
        entity.kind === "location" &&
        entity.name.toLowerCase().trim() === normalized,
    )?.entity_id ?? null
  );
}

export function addSceneLocationIfMissing(
  session: WorldSession,
  locationName: string,
  description: string,
  eventId: string,
): string {
  const existing = simulationLocationForScene(session, locationName);
  if (existing) return existing;
  const locationId = createId("location");
  session.simulation.entities[locationId] = {
    entity_id: locationId,
    kind: "location",
    name: locationName,
    description,
    status: "active",
    location_id: null,
    portable: false,
    carried_by: null,
    properties: {},
    introduced_event_id: eventId,
  };
  return locationId;
}
