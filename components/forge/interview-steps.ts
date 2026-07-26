import type { InterviewAnswers } from "@/lib/forge/types";

export type InterviewStep = {
  /** Stated before the question, so the user always knows what it decides. */
  defines: string;
  question: string;
  field: keyof InterviewAnswers;
  placeholder: string;
  label?: string;
  secondaryField?: keyof InterviewAnswers;
  secondaryLabel?: string;
  secondaryPlaceholder?: string;
  /** Examples, never a closed list. */
  suggestions?: string[];
  /** Layer 3/4 fields are generated, not asked — this marks the asked ones. */
  optional?: boolean;
};

export const INTERVIEW_STEPS: InterviewStep[] = [
  {
    defines: "Let's start with who they are.",
    question: "Who are they?",
    field: "name",
    label: "Name",
    placeholder: "Mara Vellaram",
    secondaryField: "role",
    secondaryLabel: "What do they do?",
    secondaryPlaceholder: "Keeper's daughter on a tidal island",
  },
  {
    defines: "This is what drives every choice they make.",
    question: "What are they chasing, out loud?",
    field: "want",
    placeholder: "To get the light working before the boat comes in",
    suggestions: [
      "To be believed",
      "To get out of this town",
      "To keep the family together",
    ],
  },
  {
    defines:
      "This is what they actually need — and it usually fights the last answer.",
    question: "What would genuinely fix them, that they'd never admit?",
    field: "need",
    placeholder: "To stop being the one who holds everything together",
    suggestions: [
      "To be forgiven",
      "To stop performing",
      "To let someone else decide",
    ],
  },
  {
    defines: "This is the thing that made them who they are.",
    question: "What happened to them that they never resolved?",
    field: "wound",
    placeholder: "Her father let a boat go down and never said so",
  },
  {
    defines: "This decides how they behave when cornered.",
    question: "Backed into a corner, what do they do?",
    field: "tactic",
    placeholder: "Push back — she gets louder, not quieter",
    suggestions: ["Push back", "Charm", "Deflect", "Go quiet"],
  },
  {
    defines: "This keeps them in character when it would be easier not to be.",
    question: "What line won't they cross, even to win?",
    field: "boundary",
    placeholder: "She won't lie to someone's face, however much it costs",
  },
  {
    defines: "This is what makes them feel like a person instead of a role.",
    question: "Name two things about them that don't fit together.",
    field: "contradiction",
    placeholder: "Fiercely honest, but has hidden the torn page all week",
  },
  {
    defines: "This is how they'll sound on the page.",
    question: "How do they talk — and what do they never say?",
    field: "speech_style",
    placeholder: "Short practical sentences. Never says she's frightened.",
  },
  {
    defines: "Last one — this is where their story can break them.",
    question: "What could they never forgive in someone else?",
    field: "unforgivable",
    placeholder: "Staying quiet when speaking up would have cost them nothing",
  },
];
