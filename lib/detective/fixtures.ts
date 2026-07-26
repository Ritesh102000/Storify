import { detectiveCaseDraftSchema } from "./schemas";
import type {
  DetectiveCaseDraft,
  DetectiveDifficulty,
  DetectiveGenre,
} from "./types";

const CONFESSION_THRESHOLD: Record<DetectiveDifficulty, number> = {
  easy: 55,
  medium: 70,
  hard: 85,
};

export function createDetectiveFixture(
  genre: DetectiveGenre,
  difficulty: DetectiveDifficulty,
  atmosphere?: string,
): DetectiveCaseDraft {
  const draft =
    genre === "noir"
      ? noirFixture(difficulty)
      : genre === "gothic"
        ? gothicFixture(difficulty)
        : scifiFixture(difficulty);

  if (atmosphere) draft.atmosphere = atmosphere;
  return detectiveCaseDraftSchema.parse(draft);
}

function noirFixture(difficulty: DetectiveDifficulty): DetectiveCaseDraft {
  const threshold = CONFESSION_THRESHOLD[difficulty];
  return {
    title: "The Last Train from Calder Street",
    atmosphere: "Rain-polished noir with a low jazz pulse and mounting distrust",
    setting:
      "Calder Street Station, a fading 1948 railway terminal whose midnight platforms serve politicians, smugglers, and people who prefer not to be remembered.",
    premise:
      "Investigative reporter Lena Vale was found dead in a locked signal office minutes before the last train departed. Her notebook is missing, and every suspect had a reason to stop tomorrow's front page.",
    opening_narration:
      "Rain needles the station glass while the departure board clicks through trains that will never arrive. Behind the signal-office door, Lena Vale lies beside a cold cup of coffee and a clock stopped at 11:47.",
    central_question:
      "Who silenced Lena Vale, and what truth was important enough to kill for?",
    suspects: [
      {
        suspect_id: "suspect_mara",
        name: "Mara Quinn",
        role: "Night-shift dispatcher",
        public_profile:
          "A meticulous railway veteran who controlled platform access during the murder window.",
        demeanor:
          "Clipped, watchful, and visibly angry when anyone questions her records.",
        starting_stress: 18,
        is_culprit: false,
        true_alibi:
          "She left the dispatch desk briefly to hide evidence of falsified overtime claims.",
        secret_motive:
          "Lena had discovered Mara's payroll fraud, but Mara wanted the story delayed rather than Lena dead.",
        authorized_knowledge: [
          "The signal-office clock lost power shortly before midnight.",
          "Deputy Mayor Voss entered through the freight gate without signing in.",
          "A porter moved a leather document case toward Platform Six.",
        ],
        confession_clue_ids: ["clue_gate_log"],
        confession_stress_threshold: 100,
        confession_statement:
          "I changed the payroll sheets, but I did not touch Lena.",
      },
      {
        suspect_id: "suspect_eli",
        name: "Eli Mercer",
        role: "Pullman porter",
        public_profile:
          "A soft-spoken porter who knew the station's service passages and carried luggage for the last train.",
        demeanor:
          "Polite, exhausted, and protective of passengers who paid him to forget.",
        starting_stress: 14,
        is_culprit: false,
        true_alibi:
          "He was moving contraband cigarettes through the baggage tunnel.",
        secret_motive:
          "Lena threatened to expose the smuggling route that kept Eli's family solvent.",
        authorized_knowledge: [
          "Lena asked which passengers used the freight gate.",
          "He heard a heavy brass object strike the signal-office desk.",
          "Voss's aide collected a document case from Platform Six.",
        ],
        confession_clue_ids: ["clue_platform_tag"],
        confession_stress_threshold: 100,
        confession_statement:
          "The cigarettes were mine. The murder was not.",
      },
      {
        suspect_id: "suspect_voss",
        name: "Adrian Voss",
        role: "Deputy mayor",
        public_profile:
          "A polished reform candidate whose transit program made him the city's most photographed public servant.",
        demeanor:
          "Measured and charming, with flashes of contempt when the questions become specific.",
        starting_stress: 19,
        is_culprit: true,
        true_alibi:
          "He entered through the freight gate, confronted Lena, and killed her with the station's brass line seal before staging the locked room.",
        secret_motive:
          "Lena possessed a ledger proving Voss sold municipal rail contracts through shell companies.",
        authorized_knowledge: [
          "Lena was investigating municipal rail contracts.",
          "The freight gate camera had been unreliable for weeks.",
          "The brass line seal normally remained in the signal office.",
        ],
        confession_clue_ids: ["clue_contract_ledger", "clue_line_seal"],
        confession_stress_threshold: threshold,
        confession_statement:
          "Lena would have destroyed everything. I used the line seal, locked the office through the service hatch, and took her notebook.",
      },
    ],
    locations: [
      {
        location_id: "location_signal_office",
        name: "Signal Office",
        description:
          "A cramped room of relay switches, wet footprints, and a desk arranged too carefully.",
        visited: false,
        clue_ids: ["clue_gate_log", "clue_line_seal"],
      },
      {
        location_id: "location_platform_six",
        name: "Platform Six",
        description:
          "The last platform, open to the rain and bordered by locked baggage cages.",
        visited: false,
        clue_ids: ["clue_platform_tag"],
      },
      {
        location_id: "location_records_room",
        name: "Municipal Records Room",
        description:
          "A temporary campaign archive installed in the station for tomorrow's transit announcement.",
        visited: false,
        clue_ids: ["clue_contract_ledger"],
      },
    ],
    clues: [
      {
        clue_id: "clue_gate_log",
        title: "Altered freight-gate log",
        location_id: "location_signal_office",
        discovery:
          "A page was cut from the gate ledger, but the carbon sheet beneath it preserved a reversed impression.",
        analysis:
          "The recovered impression records Voss's car at 11:31. Mara's handwriting appears only in the later attempt to obscure the entry.",
        connections: ["Adrian Voss", "Mara Quinn", "11:31 freight-gate entry"],
        prerequisite_clue_ids: [],
        suspect_ids: ["suspect_voss", "suspect_mara"],
        discovered: false,
        analyzed: false,
        key_evidence: false,
        significance:
          "Places Voss inside the station and separates Mara's cover-up from the homicide.",
      },
      {
        clue_id: "clue_platform_tag",
        title: "Torn Platform Six baggage tag",
        location_id: "location_platform_six",
        discovery:
          "A rain-softened baggage tag bears Lena's initials and a partial municipal inventory number.",
        analysis:
          "The inventory number belongs to a campaign document case signed out to Voss's office. Tobacco dust confirms Eli handled it, but before the murder.",
        connections: ["Adrian Voss", "Eli Mercer", "missing document case"],
        prerequisite_clue_ids: [],
        suspect_ids: ["suspect_voss", "suspect_eli"],
        discovered: false,
        analyzed: false,
        key_evidence: false,
        significance:
          "Connects the missing records to Voss while explaining Eli's suspicious movements.",
      },
      {
        clue_id: "clue_contract_ledger",
        title: "Shell-company contract ledger",
        location_id: "location_records_room",
        discovery:
          "A ledger hidden behind blank campaign posters lists rail contracts routed through three unfamiliar companies.",
        analysis:
          "Bank references tie every company to Voss's private trust. Lena's shorthand marks the same payments in the margin.",
        connections: ["Adrian Voss", "Lena Vale", "municipal contract fraud"],
        prerequisite_clue_ids: ["clue_gate_log"],
        suspect_ids: ["suspect_voss"],
        discovered: false,
        analyzed: false,
        key_evidence: true,
        significance: "Establishes Voss's financial motive for silencing Lena.",
      },
      {
        clue_id: "clue_line_seal",
        title: "Cleaned brass line seal",
        location_id: "location_signal_office",
        discovery:
          "The heavy line seal has been polished, yet a dark trace remains inside its engraved edge.",
        analysis:
          "The trace matches Lena's blood. A fiber caught beneath the handle matches Voss's campaign overcoat, and the service hatch explains the locked door.",
        connections: ["Adrian Voss", "murder weapon", "locked-room staging"],
        prerequisite_clue_ids: ["clue_platform_tag", "clue_contract_ledger"],
        suspect_ids: ["suspect_voss"],
        discovered: false,
        analyzed: false,
        key_evidence: true,
        significance:
          "Identifies the weapon, links it physically to Voss, and resolves the locked-room trick.",
      },
    ],
    solution: {
      culprit_id: "suspect_voss",
      motive:
        "Voss killed Lena to prevent her from publishing proof that he profited from corrupt municipal rail contracts.",
      motive_keywords: [
        "contracts",
        "corruption",
        "ledger",
        "rail",
        "fraud",
        "publish",
      ],
      explanation:
        "Voss entered through the freight gate, recovered the incriminating ledger, struck Lena with the brass line seal, and escaped through the service hatch before staging the office as locked.",
    },
  };
}

function gothicFixture(difficulty: DetectiveDifficulty): DetectiveCaseDraft {
  const threshold = CONFESSION_THRESHOLD[difficulty];
  return {
    title: "The Bell Beneath Ashcombe Hall",
    atmosphere:
      "Candlelit gothic dread, winter thunder, and a household trained to keep old sins quiet",
    setting:
      "Ashcombe Hall, an isolated cliffside estate built over the ruins of a medieval infirmary.",
    premise:
      "Historian Edwin Ashcombe died in the sealed family chapel as a buried bell rang beneath the floor. He had planned to reveal which heir profited from a century-old land fraud.",
    opening_narration:
      "Thunder rolls under the chapel stones rather than above them. Edwin Ashcombe lies before the cold altar, one hand closed around black candle wax, while a bell no living servant admits exists gives a final note.",
    central_question:
      "Who turned the Ashcombe legend into a murder weapon, and what inheritance were they protecting?",
    suspects: [
      {
        suspect_id: "suspect_clara",
        name: "Clara Ashcombe",
        role: "Estate conservator",
        public_profile:
          "Edwin's eldest daughter, responsible for the chapel restoration and every key in the house.",
        demeanor:
          "Controlled and practical, though her certainty frays around questions of inheritance.",
        starting_stress: 17,
        is_culprit: false,
        true_alibi:
          "She was secretly selling minor family artifacts to fund emergency roof repairs.",
        secret_motive:
          "Edwin intended to remove Clara as trustee after discovering the unauthorized sales.",
        authorized_knowledge: [
          "The chapel has a disused ventilation passage.",
          "Only Gideon requested access to the estate genealogies this week.",
          "The black chapel candles were replaced on the afternoon of the murder.",
        ],
        confession_clue_ids: ["clue_wax"],
        confession_stress_threshold: 100,
        confession_statement:
          "I sold the silver reliquary, but I did not poison my father.",
      },
      {
        suspect_id: "suspect_gideon",
        name: "Gideon Ashcombe",
        role: "Family solicitor",
        public_profile:
          "Edwin's nephew and legal adviser, presently overseeing the transfer of the western tenant lands.",
        demeanor:
          "Grave, courteous, and quick to translate moral questions into legal ones.",
        starting_stress: 20,
        is_culprit: true,
        true_alibi:
          "He used the undercroft passage to poison a chapel candle, rang the buried bell as distraction, and sealed the passage from below.",
        secret_motive:
          "Edwin found deeds proving Gideon had diverted tenant land into a company he secretly controlled.",
        authorized_knowledge: [
          "Edwin was reviewing the western tenant deeds.",
          "The buried bell can be reached from the old infirmary undercroft.",
          "Beatrice copied several genealogy pages for Edwin.",
        ],
        confession_clue_ids: ["clue_false_deed", "clue_poisoned_wick"],
        confession_stress_threshold: threshold,
        confession_statement:
          "Edwin had the deeds. I poisoned the candle and used the undercroft because the family name was the only thing I had left to protect.",
      },
      {
        suspect_id: "suspect_beatrice",
        name: "Dr. Beatrice Wren",
        role: "Visiting genealogist",
        public_profile:
          "A scholar invited to authenticate the Ashcombe line and the estate's oldest burial records.",
        demeanor:
          "Curious and direct, becoming evasive only when her own ancestry is mentioned.",
        starting_stress: 13,
        is_culprit: false,
        true_alibi:
          "She searched the family crypt for proof that her grandmother was an unacknowledged Ashcombe heir.",
        secret_motive:
          "A confirmed claim could have challenged Edwin's ownership of part of the estate.",
        authorized_knowledge: [
          "The family tree contains a deliberately erased birth.",
          "Gideon removed a deed box from the archive before dinner.",
          "Edwin complained of a bitter almond smell in the chapel.",
        ],
        confession_clue_ids: ["clue_crypt_copy"],
        confession_stress_threshold: 100,
        confession_statement:
          "I entered the crypt for my family's truth, not to kill Edwin.",
      },
    ],
    locations: [
      {
        location_id: "location_chapel",
        name: "Family Chapel",
        description:
          "A narrow stone chapel crowded with extinguished candles and damp ancestral plaques.",
        visited: false,
        clue_ids: ["clue_wax", "clue_poisoned_wick"],
      },
      {
        location_id: "location_archive",
        name: "Estate Archive",
        description:
          "Shelves of vellum deeds and restoration accounts behind a warped oak door.",
        visited: false,
        clue_ids: ["clue_false_deed"],
      },
      {
        location_id: "location_undercroft",
        name: "Infirmary Undercroft",
        description:
          "A buried corridor reached from the crypt, where ropes disappear into older masonry.",
        visited: false,
        clue_ids: ["clue_crypt_copy"],
      },
    ],
    clues: [
      {
        clue_id: "clue_wax",
        title: "Black wax beneath Edwin's nails",
        location_id: "location_chapel",
        discovery:
          "A curl of black candle wax is pressed into Edwin's palm and carries a faint medicinal odor.",
        analysis:
          "The wax contains a rare aconite compound released by heat. Clara purchased ordinary beeswax; this candle came from another batch.",
        connections: ["poison delivery", "chapel candles", "Edwin Ashcombe"],
        prerequisite_clue_ids: [],
        suspect_ids: ["suspect_clara", "suspect_gideon"],
        discovered: false,
        analyzed: false,
        key_evidence: false,
        significance: "Shows the chapel candle delivered the poison.",
      },
      {
        clue_id: "clue_crypt_copy",
        title: "Charcoal copy of an erased birth record",
        location_id: "location_undercroft",
        discovery:
          "A folded charcoal rubbing records an Ashcombe birth absent from the official genealogy.",
        analysis:
          "Beatrice made the rubbing hours earlier. On its reverse is the imprint of a deed-box inventory number used by Gideon.",
        connections: ["Beatrice Wren", "Gideon Ashcombe", "missing deed box"],
        prerequisite_clue_ids: [],
        suspect_ids: ["suspect_beatrice", "suspect_gideon"],
        discovered: false,
        analyzed: false,
        key_evidence: false,
        significance:
          "Explains Beatrice's secrecy and points toward the deed records Gideon handled.",
      },
      {
        clue_id: "clue_false_deed",
        title: "Substituted western-land deed",
        location_id: "location_archive",
        discovery:
          "The western-land deed bears a fresh ribbon and a seal older than the paper beneath it.",
        analysis:
          "The beneficiary company is controlled by Gideon. Edwin annotated the authentic deed with a plan to confront him that night.",
        connections: ["Gideon Ashcombe", "tenant land", "forged inheritance"],
        prerequisite_clue_ids: ["clue_wax"],
        suspect_ids: ["suspect_gideon"],
        discovered: false,
        analyzed: false,
        key_evidence: true,
        significance: "Establishes Gideon's financial and reputational motive.",
      },
      {
        clue_id: "clue_poisoned_wick",
        title: "Poisoned candle wick and bell-rope fiber",
        location_id: "location_chapel",
        discovery:
          "Inside the candle stub, the wick is stitched with blue thread matching fibers caught on the buried bell rope.",
        analysis:
          "The thread comes from Gideon's legal folio. Soot and limestone on the folio clasp match the undercroft passage used to stage the supernatural bell.",
        connections: ["Gideon Ashcombe", "aconite", "undercroft bell"],
        prerequisite_clue_ids: ["clue_crypt_copy", "clue_false_deed"],
        suspect_ids: ["suspect_gideon"],
        discovered: false,
        analyzed: false,
        key_evidence: true,
        significance:
          "Links Gideon to both the poison mechanism and the staged bell distraction.",
      },
    ],
    solution: {
      culprit_id: "suspect_gideon",
      motive:
        "Gideon killed Edwin to conceal forged deeds that transferred tenant land into Gideon's secret company.",
      motive_keywords: [
        "deeds",
        "land",
        "forgery",
        "company",
        "inheritance",
        "conceal",
      ],
      explanation:
        "Gideon treated a chapel candle with aconite, reached the buried bell through the undercroft, and used the legend to distract from a murder intended to protect his forged land scheme.",
    },
  };
}

function scifiFixture(difficulty: DetectiveDifficulty): DetectiveCaseDraft {
  const threshold = CONFESSION_THRESHOLD[difficulty];
  return {
    title: "Dead Signal at Perihelion",
    atmosphere:
      "Cold orbital suspense, failing light, and the claustrophobia of a station too far from rescue",
    setting:
      "Perihelion Array, a solar observatory orbiting close enough to the sun that every exterior shadow burns sharp.",
    premise:
      "Mission director Dr. Sera Imani died during an impossible ninety-second communications blackout. The station AI reports no intrusion, but someone rewrote the radiation shutters before the signal vanished.",
    opening_narration:
      "The sun fills half the observation dome when the station sound returns. Sera Imani floats above the command rail, her suit alarm blinking silently, while ninety seconds of Perihelion's memory remain perfectly blank.",
    central_question:
      "Who manufactured the dead signal, and what did Sera discover in the station's solar data?",
    suspects: [
      {
        suspect_id: "suspect_ren",
        name: "Ren Calder",
        role: "Systems architect",
        public_profile:
          "Designer of Perihelion's fault-tolerant network and the only crew member with root access.",
        demeanor:
          "Analytical and impatient, answering emotional questions as if they were software bugs.",
        starting_stress: 20,
        is_culprit: true,
        true_alibi:
          "Ren injected a maintenance packet that blinded telemetry, opened Sera's suit cooling loop, and forged an AI fault report.",
        secret_motive:
          "Sera discovered Ren had sold exclusive solar-flare predictions to a private weapons consortium.",
        authorized_knowledge: [
          "A diagnostic packet can temporarily isolate the command ring.",
          "Sera audited outbound research transfers before her death.",
          "The observatory AI signs every authentic fault report.",
        ],
        confession_clue_ids: ["clue_transfer_shard", "clue_forged_packet"],
        confession_stress_threshold: threshold,
        confession_statement:
          "Sera found the consortium transfers. I blinded the array and opened her cooling loop because exposure would have ended everything.",
      },
      {
        suspect_id: "suspect_tala",
        name: "Tala Okonkwo",
        role: "Solar physicist",
        public_profile:
          "Sera's research partner and public critic of the mission director's plan to delay a major flare warning.",
        demeanor:
          "Intense and candid, with little patience for station politics.",
        starting_stress: 15,
        is_culprit: false,
        true_alibi:
          "She copied embargoed flare data to warn a vulnerable colony without authorization.",
        secret_motive:
          "Sera threatened to remove Tala from the mission over the leak.",
        authorized_knowledge: [
          "The blackout began with a maintenance packet, not a solar event.",
          "Ren argued with Sera about outbound bandwidth.",
          "The raw flare data contains an unexplained encrypted transfer marker.",
        ],
        confession_clue_ids: ["clue_sensor_echo"],
        confession_stress_threshold: 100,
        confession_statement:
          "I sent the colony a warning. I did not sabotage Sera's suit.",
      },
      {
        suspect_id: "suspect_milo",
        name: "Milo Vey",
        role: "Life-support engineer",
        public_profile:
          "Keeper of the station's suits, cooling loops, and emergency pressure systems.",
        demeanor:
          "Friendly but scattered, becoming precise whenever machinery is discussed.",
        starting_stress: 16,
        is_culprit: false,
        true_alibi:
          "He was using a service drone to cultivate prohibited medicinal fungi in an unused air scrubber.",
        secret_motive:
          "Sera had scheduled a full life-support inspection that would expose the unauthorized crop.",
        authorized_knowledge: [
          "Sera's cooling valve received a valid-looking remote command.",
          "The valve hardware had passed inspection that morning.",
          "A service drone carried residue from the command ring.",
        ],
        confession_clue_ids: ["clue_drone_residue"],
        confession_stress_threshold: 100,
        confession_statement:
          "The fungi are mine. The command that killed Sera is not.",
      },
    ],
    locations: [
      {
        location_id: "location_command_ring",
        name: "Command Ring",
        description:
          "A circular operations deck surrounding the observation dome and Sera's silent suit telemetry.",
        visited: false,
        clue_ids: ["clue_sensor_echo", "clue_forged_packet"],
      },
      {
        location_id: "location_drone_bay",
        name: "Service Drone Bay",
        description:
          "A rack of maintenance drones beside sealed lockers and a warm, unauthorized air line.",
        visited: false,
        clue_ids: ["clue_drone_residue"],
      },
      {
        location_id: "location_data_vault",
        name: "Solar Data Vault",
        description:
          "Radiation-shielded storage holding raw flare models and signed outbound-transfer records.",
        visited: false,
        clue_ids: ["clue_transfer_shard"],
      },
    ],
    clues: [
      {
        clue_id: "clue_sensor_echo",
        title: "Ninety-second sensor echo",
        location_id: "location_command_ring",
        discovery:
          "A secondary sensor retained a compressed echo from the blackout after the primary telemetry was erased.",
        analysis:
          "The echo shows a maintenance packet originated from Ren's isolated development partition, not from Tala's science console.",
        connections: ["Ren Calder", "maintenance packet", "manufactured blackout"],
        prerequisite_clue_ids: [],
        suspect_ids: ["suspect_ren", "suspect_tala"],
        discovered: false,
        analyzed: false,
        key_evidence: false,
        significance: "Establishes that the blackout was deliberate and traces its origin.",
      },
      {
        clue_id: "clue_drone_residue",
        title: "Service-drone coolant residue",
        location_id: "location_drone_bay",
        discovery:
          "A drone claw carries suit coolant, fungal spores, and a bright fleck of command-ring insulation.",
        analysis:
          "Milo used the drone for his hidden crop hours earlier. Its later command-ring trip was an automated diagnostic requested by Ren's account.",
        connections: ["Milo Vey", "Ren Calder", "suit cooling loop"],
        prerequisite_clue_ids: [],
        suspect_ids: ["suspect_milo", "suspect_ren"],
        discovered: false,
        analyzed: false,
        key_evidence: false,
        significance:
          "Explains Milo's secret while linking Ren's account to the sabotaged suit system.",
      },
      {
        clue_id: "clue_transfer_shard",
        title: "Encrypted consortium transfer shard",
        location_id: "location_data_vault",
        discovery:
          "An undeleted storage shard contains outbound prediction bundles routed through a private relay.",
        analysis:
          "Ren's signing key authorized the transfers to Helix Ordnance. Sera opened the audit record twenty minutes before she died.",
        connections: ["Ren Calder", "Helix Ordnance", "stolen solar predictions"],
        prerequisite_clue_ids: ["clue_sensor_echo"],
        suspect_ids: ["suspect_ren"],
        discovered: false,
        analyzed: false,
        key_evidence: true,
        significance: "Establishes Ren's motive and the secret Sera discovered.",
      },
      {
        clue_id: "clue_forged_packet",
        title: "Forged AI fault packet",
        location_id: "location_command_ring",
        discovery:
          "The official fault report passes a visual check but carries a signature timestamp from before the incident.",
        analysis:
          "The signature was copied from Ren's development archive. Its embedded command opened Sera's cooling valve during the blackout.",
        connections: ["Ren Calder", "forged AI signature", "fatal cooling command"],
        prerequisite_clue_ids: ["clue_drone_residue", "clue_transfer_shard"],
        suspect_ids: ["suspect_ren"],
        discovered: false,
        analyzed: false,
        key_evidence: true,
        significance:
          "Links Ren directly to the blackout, forged report, and fatal suit command.",
      },
    ],
    solution: {
      culprit_id: "suspect_ren",
      motive:
        "Ren killed Sera to conceal the sale of proprietary solar-flare predictions to a weapons consortium.",
      motive_keywords: [
        "solar",
        "predictions",
        "weapons",
        "consortium",
        "transfer",
        "conceal",
      ],
      explanation:
        "Ren sent a maintenance packet to erase ninety seconds of telemetry, remotely opened Sera's cooling loop, and forged the station AI's report to hide both the murder and the illegal data sales.",
    },
  };
}
