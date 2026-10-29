import {
  BedDouble,
  Droplets,
  School,
  Sprout,
  Stethoscope,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Check, CheckId, Sector, Skill, WorkPreset } from "@/lib/types";

/** Sector tile icon and tint. Reuse this anywhere a project needs a sector mark. */
export const SECTOR_MARKS: Record<Sector, { icon: LucideIcon; tile: string }> = {
  lodging: { icon: BedDouble, tile: "bg-[#efe6d6] text-[#6b4423]" },
  agriculture: { icon: Sprout, tile: "bg-[#e3f0e4] text-[#1d6b38]" },
  energy: { icon: Zap, tile: "bg-[#f8efd4] text-[#8a5a10]" },
  water: { icon: Droplets, tile: "bg-[#e3f1f4] text-[#0e5f73]" },
  connectivity: { icon: Wifi, tile: "bg-[#e6e8f6] text-[#343a86]" },
  education: { icon: School, tile: "bg-[#efe6f4] text-[#5c3478]" },
  healthcare: { icon: Stethoscope, tile: "bg-[#f8e6e3] text-[#8a3418]" },
};

/** Weekly pay in the local currency, used when a request becomes a project. */
export const SECTOR_WEEKLY: Record<Sector, number> = {
  lodging: 30000,
  agriculture: 24000,
  energy: 18000,
  water: 16000,
  connectivity: 20000,
  education: 18000,
  healthcare: 20000,
};

export function sectorWeekly(sector: Sector): number {
  return SECTOR_WEEKLY[sector];
}

export function openChecks(sector: Sector, jamaica: boolean): Check[] {
  const ids: CheckId[] =
    jamaica && sector === "lodging"
      ? ["organizer", "jtb", "site-visit"]
      : jamaica && sector === "agriculture"
        ? ["organizer", "rada", "site-visit"]
        : ["organizer", "engineer", "community"];
  return ids.map((id) => ({ id, state: "open" }));
}

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

/** Short, safe tools for a skill. No wiring steps and no mixes. */
export const SKILL_TOOLS: Record<Skill, string> = {
  building: "A tape, a hammer, and work gloves.",
  farming: "A hoe, a fork, and boots.",
  cooking: "Pots, a knife, and a clean board.",
  "guest-house": "Clean linen, a broom, and a notepad.",
  front: "A notebook and a calendar.",
  power: "A meter and insulated tools. Do not open a live panel.",
  water: "A wrench and pipe fittings.",
  internet: "A cable tester and a ladder.",
  teaching: "A board and paper.",
  care: "Gloves and a clean cloth.",
};

export function skillTools(id: Skill): string {
  return SKILL_TOOLS[id];
}

export function workPresetLabel(id: WorkPreset): string {
  return WORK_PRESETS.find((preset) => preset.id === id)?.label ?? "Work";
}

const SECTOR_SKILLS: Record<Sector, Skill[]> = {
  lodging: ["guest-house", "building"],
  agriculture: ["farming"],
  energy: ["power"],
  water: ["water"],
  connectivity: ["internet"],
  education: ["teaching"],
  healthcare: ["care"],
};

export function skillsForSector(sector: Sector): Skill[] {
  return [...SECTOR_SKILLS[sector]];
}

/** Three local amounts for a new request. Jamaica keeps the commit presets. */
export function requestBudgets(currency: string): number[] {
  if (currency === "J$") return [...COMMIT_PRESETS];
  return commitChoices(10_000_000, currency);
}
