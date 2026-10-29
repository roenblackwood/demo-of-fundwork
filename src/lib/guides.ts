import raw from "../../data/guides.json";
import { openChecks, skillsForSector } from "@/lib/catalog";
import { getProjects } from "@/lib/seed";
import type { CheckId, Project, Sector, Skill } from "@/lib/types";

export type GuideAgency = {
  name: string;
  does: string;
  checkId: CheckId;
  /** When set, this line is only for these kinds. Sector-wide lines omit it. */
  kindIds?: string[];
};

export type GuideEntry = {
  countryId: string;
  sector: Sector;
  checks: CheckId[];
  agencies: GuideAgency[];
  firstSteps: string[];
  team: Skill[];
  sourceNote: string;
  checkedOn: string;
};

const entries = raw.entries as GuideEntry[];

/** Bump the rewrite cache when the checked list changes. */
export const GUIDE_VERSION = entries
  .map((entry) => `${entry.countryId}:${entry.sector}:${entry.checkedOn}`)
  .sort()
  .join("|");

export function guideFor(countryId: string, sector: Sector): GuideEntry | null {
  return entries.find((entry) => entry.countryId === countryId && entry.sector === sector) ?? null;
}

export function uncheckedNote(countryName: string): string {
  return `We have not checked the rules in ${countryName} yet. Ask the local council before you spend money.`;
}

/** Lowest and highest goal for this country and sector. Null until there are two. */
export function priceRange(
  countryId: string,
  sector: Sector,
  projects: Project[] = getProjects(),
): { low: number; high: number } | null {
  const goals = projects
    .filter((project) => project.countryId === countryId && project.sector === sector)
    .map((project) => project.goalJmd)
    .filter((goal) => Number.isFinite(goal));
  if (goals.length < 2) return null;
  return { low: Math.min(...goals), high: Math.max(...goals) };
}

export function genericCheckIds(sector: Sector): CheckId[] {
  return openChecks(sector, false).map((check) => check.id);
}

export function genericTeam(sector: Sector): Skill[] {
  return skillsForSector(sector);
}
