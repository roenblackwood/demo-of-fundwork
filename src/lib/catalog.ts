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
};

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
