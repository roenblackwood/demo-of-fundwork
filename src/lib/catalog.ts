import type { Sector, Skill, WorkPreset } from "@/lib/types";

export const SECTORS: { id: Sector; title: string; detail: string }[] = [
  {
    id: "lodging",
    title: "Places to stay",
    detail: "Hotels, inns, and guest houses",
  },
  {
    id: "agriculture",
    title: "Farms and food",
    detail: "Crops, animals, and storage",
  },
  {
    id: "energy",
    title: "Power",
    detail: "Solar, batteries, and clinic power",
  },
  {
    id: "water",
    title: "Water",
    detail: "Pumps, tanks, and filters",
  },
  {
    id: "connectivity",
    title: "Internet",
    detail: "Community hubs and mesh links",
  },
  {
    id: "education",
    title: "Schools",
    detail: "Classrooms and lessons",
  },
  {
    id: "healthcare",
    title: "Clinics",
    detail: "Clinic rooms and cold storage",
  },
];

export const SKILLS: { id: Skill; title: string; detail: string }[] = [
  {
    id: "building",
    title: "Building and repairs",
    detail: "Carpentry, masonry, painting, roofs",
  },
  {
    id: "guest-house",
    title: "Guest house work",
    detail: "Rooms, laundry, and upkeep",
  },
  {
    id: "farming",
    title: "Farming",
    detail: "Crops, animals, and greenhouse work",
  },
  {
    id: "cooking",
    title: "Cooking",
    detail: "Kitchen work for guests or a team",
  },
  {
    id: "front",
    title: "Welcoming guests",
    detail: "Front desk, tours, and hosting",
  },
  {
    id: "power",
    title: "Solar and batteries",
    detail: "Panels, batteries, and wiring",
  },
  {
    id: "water",
    title: "Water systems",
    detail: "Pumps, tanks, pipes, and filters",
  },
  {
    id: "internet",
    title: "Internet setup",
    detail: "Hubs, mesh links, and routers",
  },
  {
    id: "teaching",
    title: "Teaching",
    detail: "Classrooms, lessons, and tutoring",
  },
  {
    id: "care",
    title: "Clinic support",
    detail: "Clinic rooms and cold storage",
  },
];

export const COMMIT_PRESETS = [50_000, 150_000, 500_000] as const;

export const WORK_PRESETS: { id: WorkPreset; label: string }[] = [
  { id: "day", label: "A day on site" },
  { id: "few", label: "A few days" },
  { id: "week", label: "A full week" },
];

const skillPhrases: Record<Skill, string> = {
  building: "building and repairs",
  "guest-house": "guest house work",
  farming: "farming",
  cooking: "cooking",
  front: "welcoming guests",
  power: "solar and batteries",
  water: "water systems",
  internet: "internet setup",
  teaching: "teaching",
  care: "clinic support",
};

export const JAMAICA_SKILLS: Skill[] = [
  "building",
  "guest-house",
  "farming",
  "cooking",
  "front",
];

function roundCommit(value: number): number {
  const abs = Math.abs(value);
  const step =
    abs >= 100_000_000
      ? 10_000_000
      : abs >= 10_000_000
        ? 1_000_000
        : abs >= 1_000_000
          ? 100_000
          : abs >= 100_000
            ? 10_000
            : abs >= 10_000
              ? 1_000
              : abs >= 1_000
                ? 100
                : abs >= 100
                  ? 10
                  : 1;
  return Math.max(step, Math.round(value / step) * step);
}

/** Jamaica keeps the original three amounts. Other currencies scale to the goal. */
export function commitChoices(goal: number, currency: string): number[] {
  if (currency === "J$") return [...COMMIT_PRESETS];
  const amounts = [0.08, 0.2, 0.45]
    .map((ratio) => roundCommit(goal * ratio))
    .filter((amount) => amount > 0 && amount < goal);
  const unique = [...new Set(amounts)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [Math.max(1, Math.round(goal / 5))];
}

export function canStillCommit(stillOpen: number, goal: number, currency: string): boolean {
  return commitChoices(goal, currency).some((amount) => amount <= stillOpen);
}

export function isSector(value: string): value is Sector {
  return SECTORS.some((sector) => sector.id === value);
}

export function isSkill(value: string): value is Skill {
  return SKILLS.some((skill) => skill.id === value);
}

export function sectorTitle(id: Sector): string {
  return SECTORS.find((sector) => sector.id === id)?.title ?? "Projects";
}

export function skillTitle(id: Skill): string {
  return SKILLS.find((skill) => skill.id === id)?.title ?? "Work";
}

export function skillPhrase(id: Skill): string {
  return skillPhrases[id];
}

export function workPresetLabel(id: WorkPreset): string {
  return WORK_PRESETS.find((preset) => preset.id === id)?.label ?? "Work";
}
