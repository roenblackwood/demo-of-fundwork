import raw from "../../data/blueprints.json";
import { isSector, isSkill, skillTitle } from "@/lib/catalog";
import type { CheckId, Readiness, ReadinessState, Sector, SiteStatus, Skill } from "@/lib/types";

export type TeamBand = {
  skill: Skill;
  min: number;
  max: number;
};

export type BlueprintKind = {
  id: string;
  title: string;
  detail: string;
  needFirst: string[];
  checks: CheckId[];
  team: TeamBand[];
  phases: string[];
  spend: string[];
  noteHints: string[];
};

export type NeedItem = {
  key: string;
  label: string;
  group: "need" | "check";
};

const SITE_NEEDED = "Find a site before you ask workers to start.";

export const SITE_CHOICES: { id: SiteStatus; label: string }[] = [
  { id: "own", label: "I own the land or building" },
  { id: "lease", label: "I lease it" },
  { id: "permission", label: "I have written permission" },
  { id: "not-yet", label: "Not yet" },
];

const file = raw as { sectors: Record<string, BlueprintKind[]> };

export function isSite(value: unknown): value is SiteStatus {
  return value === "own" || value === "lease" || value === "permission" || value === "not-yet";
}

export function siteLabel(site: SiteStatus): string {
  return SITE_CHOICES.find((choice) => choice.id === site)?.label ?? "Not yet";
}

export function kindsFor(sector: Sector): BlueprintKind[] {
  const rows = file.sectors[sector];
  return Array.isArray(rows) ? rows : [];
}

export function kindById(sector: Sector, id: string | null | undefined): BlueprintKind | null {
  if (!id) return null;
  return kindsFor(sector).find((kind) => kind.id === id) ?? null;
}

export function defaultCounts(kind: BlueprintKind): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const band of kind.team) counts[band.skill] = band.min;
  return counts;
}

export function peopleCount(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + (Number.isInteger(count) && count > 0 ? count : 0), 0);
}

export function skillsFromCounts(counts: Record<string, number>): Skill[] {
  return Object.entries(counts).flatMap(([skill, count]) => {
    if (!isSkill(skill) || !Number.isInteger(count) || count < 1) return [];
    return [skill];
  });
}

export function needLines(kind: BlueprintKind, site: SiteStatus | null): string[] {
  if (site !== "not-yet") return [...kind.needFirst];
  return [...kind.needFirst, SITE_NEEDED];
}

export function readinessItems(kind: BlueprintKind, site: SiteStatus | null): NeedItem[] {
  const needs = needLines(kind, site).map((label) => ({
    key: `need:${label}`,
    label,
    group: "need" as const,
  }));
  const checks = kind.checks.map((id) => ({
    key: `check:${id}`,
    label: id,
    group: "check" as const,
  }));
  return [...needs, ...checks];
}

export function cleanReadiness(value: unknown): Readiness | null {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const next: Readiness = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key || key.length > 160) return null;
    if (item !== "have" && item !== "working" && item !== "not-yet") return null;
    next[key] = item;
  }
  if (Object.keys(next).length > 40) return null;
  return next;
}

export function readinessFor(
  kind: BlueprintKind,
  site: SiteStatus | null,
  current: Readiness | null | undefined,
): Readiness {
  const saved = cleanReadiness(current) ?? {};
  const next: Readiness = {};
  for (const item of readinessItems(kind, site)) {
    next[item.key] = saved[item.key] ?? "not-yet";
  }
  return next;
}

export function readyCount(readiness: Readiness): number {
  return Object.values(readiness).filter((state) => state === "have").length;
}

export function needsSummary(checks: number, people: number, site: SiteStatus | null): string {
  const checkPart = checks === 1 ? "1 check" : `${checks} checks`;
  const peoplePart = people === 1 ? "1 person" : `${people} people`;
  const parts = [checkPart, peoplePart];
  if (site === "not-yet") parts.push("site needed");
  return parts.join(", ");
}

export function teamLine(skill: Skill, count: number): string {
  return `${skillTitle(skill)}, ${count}`;
}

export function phaseNames(sector: Sector, kindId: string | null | undefined): string[] {
  return kindById(sector, kindId)?.phases ?? [];
}

export function knownKind(sector: string, id: string): boolean {
  if (!isSector(sector)) return false;
  return kindsFor(sector).some((kind) => kind.id === id);
}

export const READINESS_LABEL: Record<ReadinessState, string> = {
  have: "I have it",
  working: "Working on it",
  "not-yet": "Not yet",
};
