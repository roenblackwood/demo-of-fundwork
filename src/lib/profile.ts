import { isSector, isSkill, sectorTitle, skillPhrase, toolChoices } from "@/lib/catalog";
import { moneyShort } from "@/lib/format";
import { capitalReserved, projectCommitted } from "@/lib/ownership";
import { pledgedAmount } from "@/lib/pledges";
import {
  inReach,
  orderForYou,
  scoreForInvestor,
  scoreForWorker,
  type InvestorView,
  type Score,
  type ScorePart,
  type WorkerView,
  type WorkItem,
} from "@/lib/recommend";
import { acceptedCount } from "@/lib/requests";
import { cleanResidence } from "@/lib/residence";
import { USD_RATES } from "@/lib/rates";
import { currencyOf, getCity, getCountries, getCountry, getParish, getParishes, getTown, getUser } from "@/lib/seed";
import type {
  Application,
  CapitalRequest,
  Commitment,
  RequestPledge,
  Contribution,
  Payment,
  Project,
  Sector,
  Skill,
  User,
} from "@/lib/types";

export type ReachChoice = "town" | "parish" | "country" | "region";
export type SkillLevelName = "learning" | "experienced" | "can-lead";
export type StartWhen = "now" | "month" | "later";
export type HorizonChoice = "1-2" | "3-5" | "longer";
export type GoalChoice = "jobs" | "power" | "water" | "food" | "care" | "women";

export type WorkPhoto = {
  fileName: string;
  dataUrl: string | null;
};

export type PersonProfile = {
  done: boolean;
  residence: string | null;
  reach: ReachChoice;
  skillLevels: { skill: Skill; level: SkillLevelName }[];
  tools: string[];
  daysPerWeek: number | null;
  startWhen: StartWhen | null;
  languages: string[];
  photos: WorkPhoto[];
  interests: Sector[];
  kinds: string[];
  places: string[];
  minUsd: number | null;
  maxUsd: number | null;
  horizon: HorizonChoice | null;
  goals: GoalChoice[];
  showName: boolean;
};

export type TrackRecord = {
  accepted: number;
  projects: number;
  payouts: number;
};

export type PlacePick = {
  countryId: string;
  parishId: string | null;
  townId: string;
};

export const REACH_CHOICES: { id: ReachChoice; label: string }[] = [
  { id: "town", label: "My town" },
  { id: "parish", label: "My parish or city" },
  { id: "country", label: "My country" },
  { id: "region", label: "My region" },
];

export const LEVEL_CHOICES: { id: SkillLevelName; label: string }[] = [
  { id: "learning", label: "Learning" },
  { id: "experienced", label: "Experienced" },
  { id: "can-lead", label: "Can lead" },
];

export const START_CHOICES: { id: StartWhen; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "month", label: "Within a month" },
  { id: "later", label: "Later" },
];

export const HORIZON_CHOICES: { id: HorizonChoice; label: string }[] = [
  { id: "1-2", label: "1 to 2 years" },
  { id: "3-5", label: "3 to 5 years" },
  { id: "longer", label: "Longer" },
];

export const GOAL_CHOICES: { id: GoalChoice; label: string }[] = [
  { id: "jobs", label: "Jobs created" },
  { id: "power", label: "Clean power" },
  { id: "water", label: "Clean water" },
  { id: "food", label: "Food" },
  { id: "care", label: "Schools and clinics" },
  { id: "women", label: "Women-led projects" },
];

const SHORT_SKILL: Record<Skill, string> = {
  building: "building",
  "guest-house": "guest house work",
  farming: "farming",
  cooking: "cooking",
  front: "welcoming guests",
  power: "solar work",
  water: "water work",
  internet: "internet setup",
  teaching: "teaching",
  care: "clinic support",
};

export function emptyProfile(): PersonProfile {
  return {
    done: false,
    residence: null,
    reach: "town",
    skillLevels: [],
    tools: [],
    daysPerWeek: null,
    startWhen: null,
    languages: [],
    photos: [],
    interests: [],
    kinds: [],
    places: [],
    minUsd: null,
    maxUsd: null,
    horizon: null,
    goals: [],
    showName: true,
  };
}

function sampleProfile(user: User | undefined): PersonProfile | null {
  if (!user) return null;
  if (user.id === "keisha") {
    return {
      ...emptyProfile(),
      done: true,
      reach: "parish",
      skillLevels: [
        { skill: "building", level: "experienced" },
        { skill: "guest-house", level: "learning" },
      ],
      tools: ["A hammer", "A tape"],
      daysPerWeek: 5,
      startWhen: "now",
      languages: ["English"],
      showName: true,
    };
  }
  if (user.id === "marcia") {
    return {
      ...emptyProfile(),
      done: true,
      reach: "country",
      interests: ["agriculture"],
      places: ["anywhere"],
      minUsd: 5000,
      maxUsd: 20000,
      horizon: "3-5",
      goals: ["food"],
      showName: true,
    };
  }
  return null;
}

export function storedProfile(value: unknown): PersonProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as PersonProfile;
  if (typeof row.done !== "boolean" || !isReach(row.reach)) return null;
  return {
    ...emptyProfile(),
    ...row,
    done: row.done,
    residence: cleanResidence(row.residence),
    reach: row.reach,
    skillLevels: Array.isArray(row.skillLevels) ? row.skillLevels : [],
    tools: Array.isArray(row.tools) ? row.tools : [],
    languages: cleanLanguages(Array.isArray(row.languages) ? row.languages : []),
    photos: Array.isArray(row.photos) ? row.photos.slice(0, 4) : [],
    interests: Array.isArray(row.interests) ? row.interests : [],
    kinds: Array.isArray(row.kinds) ? row.kinds : [],
    places: Array.isArray(row.places) ? row.places : [],
    goals: Array.isArray(row.goals) ? row.goals.filter((item): item is GoalChoice => isGoal(item)) : [],
    daysPerWeek: typeof row.daysPerWeek === "number" && row.daysPerWeek >= 1 && row.daysPerWeek <= 7 ? row.daysPerWeek : null,
    showName: row.showName !== false,
  };
}

export function resolvedProfile(
  userId: string,
  saved: PersonProfile | undefined,
): { profile: PersonProfile; set: boolean } {
  if (saved?.done) return { profile: saved, set: true };
  const sample = sampleProfile(getUser(userId));
  if (sample && !saved) return { profile: sample, set: true };
  if (saved) return { profile: saved, set: false };
  return { profile: emptyProfile(), set: false };
}

export function sectorDown(hidden: { sector: string }[]): Record<string, number> {
  const down: Record<string, number> = {};
  for (const item of hidden) {
    if (item.sector) down[item.sector] = 5;
  }
  return down;
}

export function trackFor(
  userId: string,
  contributions: Contribution[],
  payments: Payment[],
): TrackRecord {
  const mine = contributions.filter((item) => item.userId === userId);
  const accepted = mine.filter((item) => item.status === "accepted");
  const ids = new Set(mine.map((item) => item.id));
  const payouts = payments.filter(
    (item) =>
      item.kind === "pay-out" &&
      item.status === "confirmed" &&
      Boolean(item.contributionId) &&
      ids.has(item.contributionId as string),
  ).length;
  return {
    accepted: accepted.length,
    projects: new Set(accepted.map((item) => item.projectId)).size,
    payouts,
  };
}

export function regionOf(countryId: string): string {
  if (countryId === "jamaica") return "caribbean";
  return getCountry(countryId)?.regionId ?? "";
}

export function areaName(countryId: string, parishId: string | null): string {
  if (parishId) return getParish(parishId)?.name ?? "";
  return getCountry(countryId)?.name ?? "";
}

export function townName(countryId: string, parishId: string | null, townId: string): string {
  if (parishId) return getTown(parishId, townId)?.name ?? "";
  return getCity(countryId, townId)?.name ?? "";
}

export function reachLabel(reach: ReachChoice, place: PlacePick | null): string {
  if (!place) return "Everywhere";
  if (reach === "town") return townName(place.countryId, place.parishId, place.townId) || "My town";
  if (reach === "parish") {
    if (place.parishId) return getParish(place.parishId)?.name ?? "My parish";
    return townName(place.countryId, null, place.townId) || "My city";
  }
  if (reach === "country") return getCountry(place.countryId)?.name ?? "My country";
  if (place.countryId === "jamaica") return "Caribbean";
  const region = getCountry(place.countryId)?.regionId ?? "";
  if (region === "latin-america") return "Latin America";
  if (region === "middle-east") return "Middle East";
  if (region === "eastern-europe") return "Eastern Europe";
  if (region === "south-asia") return "South Asia";
  if (region === "southeast-asia") return "Southeast Asia";
  if (region === "africa") return "Africa";
  if (region === "caribbean") return "Caribbean";
  return "My region";
}

function readinessOf(checks: { state: string }[], values: string[]): number {
  const checkRatio = checks.length ? checks.filter((item) => item.state === "yes").length / checks.length : null;
  const readyRatio = values.length ? values.filter((item) => item === "have").length / values.length : null;
  if (checkRatio !== null && readyRatio !== null) return (checkRatio + readyRatio) / 2;
  return checkRatio ?? readyRatio ?? 0;
}

function skillsOf(ids: Skill[]): { id: string; phrase: string }[] {
  return ids.map((id) => ({ id, phrase: SHORT_SKILL[id] || skillPhrase(id) }));
}

export function itemFromProject(project: Project, commitments: Commitment[]): WorkItem {
  const committed = projectCommitted(project.committedJmd, commitments, project.id);
  const reserved = capitalReserved(project.committedJmd, commitments, project.id);
  const left = Math.max(0, project.goalJmd - reserved);
  const currency = currencyOf(project.countryId);
  const ratio = project.goalJmd > 0 ? reserved / project.goalJmd : 0;
  return {
    id: project.id,
    sector: project.sector,
    sectorLabel: sectorTitle(project.sector),
    kindId: project.kind ?? null,
    countryId: project.countryId,
    parishId: project.parishId,
    townId: project.townId,
    regionId: regionOf(project.countryId),
    place: areaName(project.countryId, project.parishId),
    skills: skillsOf(project.needs),
    openSpots: Math.max(0, project.workersNeeded - project.workersMatched),
    readiness: readinessOf(project.checks, Object.values(project.readiness ?? {})),
    createdAt: "",
    stillNeededUsd: usdOf(left, currency),
    confirmedIn: committed > 0,
    fundedRatio: Math.max(0, Math.min(1, ratio)),
  };
}

export function itemFromRequest(
  request: CapitalRequest,
  applications: Application[],
  pledges: RequestPledge[] = [],
): WorkItem {
  const filled = acceptedCount(applications, request.id);
  const currency = currencyOf(request.countryId);
  const open = request.status !== "closed" && !request.projectId;
  const taken = open ? pledgedAmount(pledges, request.id) : 0;
  const left = open ? Math.max(0, request.budget - taken) : 0;
  const ratio = request.budget > 0 ? Math.min(1, taken / request.budget) : 0;
  return {
    id: request.id,
    sector: request.sector,
    sectorLabel: sectorTitle(request.sector),
    kindId: request.kind ?? null,
    countryId: request.countryId,
    parishId: request.parishId,
    townId: request.townId,
    regionId: regionOf(request.countryId),
    place: areaName(request.countryId, request.parishId),
    skills: skillsOf(request.skills),
    openSpots: Math.max(0, request.workersNeeded - filled),
    readiness: readinessOf([], Object.values(request.readiness ?? {})),
    createdAt: request.createdAt,
    stillNeededUsd: usdOf(left, currency),
    confirmedIn: false,
    fundedRatio: ratio,
    pledgeLeft: open && left > 0 ? `${moneyShort(left, currency)} left to pledge` : null,
  };
}

function usdOf(amount: number, currency: string): number | null {
  const rate = USD_RATES[currency];
  if (!rate || !Number.isFinite(amount)) return null;
  return amount / rate;
}

export function localFromUsd(usd: number, currency: string): number | null {
  const rate = USD_RATES[currency];
  if (!rate || !Number.isFinite(usd)) return null;
  return Math.round(usd * rate);
}

export function workerViewOf(
  profile: PersonProfile,
  home: PlacePick,
  seeEverywhere: boolean,
): WorkerView {
  return {
    reach: profile.reach,
    countryId: home.countryId,
    parishId: home.parishId,
    townId: home.townId,
    regionId: regionOf(home.countryId),
    skills: profile.skillLevels.map((item) => ({
      id: item.skill,
      level: item.level,
      phrase: SHORT_SKILL[item.skill] || skillPhrase(item.skill),
    })),
    seeEverywhere,
  };
}

export function investorViewOf(profile: PersonProfile): InvestorView {
  return {
    sectors: profile.interests,
    kinds: profile.kinds,
    places: profile.places.length > 0 ? profile.places : [],
    minUsd: profile.minUsd ?? 0,
    maxUsd: profile.maxUsd ?? 0,
  };
}

export type OrderedCard = {
  id: string;
  sector: string;
  score: number;
  createdAt: string;
  reasons: string[];
  parts: ScorePart[];
  rank: number;
};

export function orderCards<T extends OrderedCard>(
  rows: T[],
  order: "for-you" | "closest" | "newest",
  nowMs: number,
): T[] {
  if (order === "newest") {
    return [...rows].sort((a, b) => {
      if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : 1;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }
  if (order === "closest") {
    return [...rows].sort((a, b) => a.rank - b.rank || b.score - a.score || (a.id < b.id ? -1 : 1));
  }
  const ranked = orderForYou(rows, nowMs);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ranked.flatMap((row) => {
    const full = byId.get(row.id);
    return full ? [full] : [];
  });
}

export function explainItem(
  item: WorkItem,
  role: "worker" | "investor" | null,
  profile: PersonProfile,
  home: PlacePick | null,
  seeEverywhere: boolean,
  down: number,
  nowMs: number,
): Score | null {
  if (role === "worker" && home) {
    return scoreForWorker(item, workerViewOf(profile, home, seeEverywhere), nowMs, down);
  }
  if (role === "investor") return scoreForInvestor(item, investorViewOf(profile), nowMs, down);
  return null;
}

export function workerAllows(
  profile: PersonProfile,
  home: PlacePick | null,
  seeEverywhere: boolean,
  item: Pick<WorkItem, "countryId" | "parishId" | "townId" | "regionId">,
): boolean {
  if (seeEverywhere || !home) return true;
  return inReach(workerViewOf(profile, home, false), {
    ...item,
    regionId: item.regionId || regionOf(item.countryId),
  });
}

type TownPoint = PlacePick & { lat: number; lng: number };

function townPoints(): TownPoint[] {
  const rows: TownPoint[] = [];
  for (const parish of getParishes()) {
    for (const town of parish.towns) {
      rows.push({
        countryId: "jamaica",
        parishId: parish.id,
        townId: town.id,
        lat: town.lat,
        lng: town.lng,
      });
    }
  }
  for (const country of getCountries()) {
    for (const city of country.cities) {
      rows.push({
        countryId: country.id,
        parishId: null,
        townId: city.id,
        lat: city.lat,
        lng: city.lng,
      });
    }
  }
  return rows;
}

function distance(lat: number, lng: number, point: TownPoint): number {
  const latRad = ((point.lat - lat) * Math.PI) / 180;
  const lngRad = ((point.lng - lng) * Math.PI) / 180;
  const a =
    Math.sin(latRad / 2) ** 2 +
    Math.cos((lat * Math.PI) / 180) *
      Math.cos((point.lat * Math.PI) / 180) *
      Math.sin(lngRad / 2) ** 2;
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const EARTH_KM = 6371;
const TOWN_LIMIT_KM = 150;

/** Nearest seeded town within 150 km. Returns ids only. A farther town is not a match. */
export function nearestTown(lat: number, lng: number): PlacePick | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: TownPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of townPoints()) {
    const gap = distance(lat, lng, point);
    if (gap < bestDistance) {
      best = point;
      bestDistance = gap;
    }
  }
  if (!best || EARTH_KM * bestDistance > TOWN_LIMIT_KM) return null;
  return { countryId: best.countryId, parishId: best.parishId, townId: best.townId };
}

export function toolsForSkills(skills: Skill[]): { skill: Skill; tools: string[] }[] {
  return skills.map((skill) => ({ skill, tools: toolChoices(skill) }));
}

export function cleanLanguages(values: string[]): string[] {
  const next: string[] = [];
  for (const value of values) {
    const text = value.trim().slice(0, 40);
    if (!text || next.some((item) => item.toLowerCase() === text.toLowerCase())) continue;
    next.push(text);
    if (next.length === 5) break;
  }
  return next;
}

export function isReach(value: string): value is ReachChoice {
  return value === "town" || value === "parish" || value === "country" || value === "region";
}

export function isLevel(value: string): value is SkillLevelName {
  return value === "learning" || value === "experienced" || value === "can-lead";
}

export function isStart(value: string): value is StartWhen {
  return value === "now" || value === "month" || value === "later";
}

export function isHorizon(value: string): value is HorizonChoice {
  return value === "1-2" || value === "3-5" || value === "longer";
}

export function isGoal(value: string): value is GoalChoice {
  return value === "jobs" || value === "power" || value === "water" || value === "food" || value === "care" || value === "women";
}

const GOAL_IDS: GoalChoice[] = ["jobs", "power", "water", "food", "care", "women"];

export function profileFromRow(row: Record<string, unknown> | null | undefined): PersonProfile | null {
  if (!row || typeof row !== "object") return null;
  const base = emptyProfile();
  const reach = typeof row.reach === "string" && isReach(row.reach) ? row.reach : base.reach;
  const skillLevels = Array.isArray(row.skill_levels)
    ? row.skill_levels.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const skill = (item as { skill?: unknown }).skill;
        const level = (item as { level?: unknown }).level;
        if (typeof skill !== "string" || !isSkill(skill) || typeof level !== "string" || !isLevel(level)) return [];
        return [{ skill, level }];
      })
    : [];
  const photos = Array.isArray(row.photos)
    ? row.photos.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const fileName = (item as { fileName?: unknown }).fileName;
        const dataUrl = (item as { dataUrl?: unknown }).dataUrl;
        if (typeof fileName !== "string") return [];
        return [{ fileName, dataUrl: typeof dataUrl === "string" ? dataUrl : null }];
      }).slice(0, 4)
    : [];
  const days = typeof row.days_per_week === "number" ? row.days_per_week : null;
  return {
    done: true,
    reach,
    skillLevels,
    tools: stringList(row.tools),
    daysPerWeek: days !== null && days >= 1 && days <= 7 ? days : null,
    startWhen: typeof row.start_when === "string" && isStart(row.start_when) ? row.start_when : null,
    languages: cleanLanguages(stringList(row.languages)),
    photos,
    interests: stringList(row.interests).filter((item): item is Sector => isSector(item)),
    kinds: stringList(row.kinds),
    places: stringList(row.places),
    minUsd: numberOrNull(row.amount_min_usd),
    maxUsd: numberOrNull(row.amount_max_usd),
    horizon: typeof row.horizon === "string" && isHorizon(row.horizon) ? row.horizon : null,
    goals: stringList(row.goals).filter((item): item is GoalChoice => GOAL_IDS.includes(item as GoalChoice)),
    showName: row.show_name !== false,
    residence: null,
  };
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function profileToRow(userId: string, profile: PersonProfile): Record<string, unknown> {
  return {
    user_id: userId,
    reach: profile.reach,
    skill_levels: profile.skillLevels,
    tools: profile.tools,
    days_per_week: profile.daysPerWeek,
    start_when: profile.startWhen,
    languages: profile.languages.slice(0, 5),
    photos: profile.photos.slice(0, 4),
    interests: profile.interests,
    kinds: profile.kinds,
    places: profile.places,
    amount_min_usd: profile.minUsd,
    amount_max_usd: profile.maxUsd,
    horizon: profile.horizon,
    goals: profile.goals,
    show_name: profile.showName,
  };
}
