import { isSector, isSkill } from "@/lib/catalog";
import type {
  Application,
  Availability,
  CapitalRequest,
  Check,
  CheckState,
  Commitment,
  Contribution,
  PathChoice,
  Project,
  Skill,
  User,
  WorkPreset,
} from "@/lib/types";

type Row = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function skills(value: unknown): Skill[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Skill => typeof item === "string" && isSkill(item));
}

function checks(value: unknown): Check[] {
  if (!Array.isArray(value)) return [];
  const states: CheckState[] = ["yes", "review", "open"];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Row;
    const id = text(row.id);
    const state = text(row.state);
    if (!id || !state || !states.includes(state as CheckState)) return [];
    return [{ id: id as Check["id"], state: state as CheckState }];
  });
}

function role(value: unknown): PathChoice | null {
  return value === "investor" || value === "worker" ? value : null;
}

export function mapProject(row: Row, team: string[], acceptedJmd: number): Project | null {
  const id = text(row.id);
  const sector = text(row.sector);
  const goal = number(row.goal);
  const weekly = number(row.weekly_payout);
  const workersNeeded = number(row.workers_needed);
  if (!id || !sector || !isSector(sector) || goal === null || weekly === null || workersNeeded === null) {
    return null;
  }
  const name = text(row.name);
  const countryId = text(row.country_id);
  const townId = text(row.town_id);
  const organizerName = text(row.organizer_name);
  if (!name || !countryId || !townId || !organizerName) return null;
  return {
    id,
    name,
    countryId,
    parishId: text(row.parish_id),
    townId,
    sector,
    summary: text(row.summary) ?? "",
    whatYouGet: text(row.what_you_get) ?? "",
    goalJmd: goal,
    committedJmd: acceptedJmd,
    workersMatched: team.length,
    workersNeeded,
    weeklyPayout: weekly,
    workStarted: row.work_started === true,
    organizerName,
    organizerId: text(row.organizer_id),
    mentorName: text(row.mentor_name),
    needs: skills(row.needs),
    checks: checks(row.checks),
    team,
  };
}

export function mapRequest(row: Row): CapitalRequest | null {
  const id = text(row.id);
  const userId = text(row.user_id);
  const sector = text(row.sector);
  const budget = number(row.budget);
  const workersNeeded = number(row.workers_needed);
  const status = text(row.status);
  const countryId = text(row.country_id);
  const townId = text(row.town_id);
  if (
    !id ||
    !userId ||
    !sector ||
    !isSector(sector) ||
    budget === null ||
    workersNeeded === null ||
    !countryId ||
    !townId ||
    (status !== "open" && status !== "team-ready" && status !== "closed")
  ) {
    return null;
  }
  return {
    id,
    userId,
    countryId,
    parishId: text(row.parish_id),
    townId,
    sector,
    budget,
    workersNeeded,
    skills: skills(row.skills),
    note: text(row.note) ?? "",
    status,
    projectId: text(row.project_id),
    createdAt: text(row.created_at) ?? "",
  };
}

export function mapApplication(row: Row): Application | null {
  const id = text(row.id);
  const workerId = text(row.worker_id);
  const skill = text(row.skill);
  const origin = text(row.origin);
  const status = text(row.status);
  if (!id || !workerId || !skill || !isSkill(skill)) return null;
  if (origin !== "applied" && origin !== "invited") return null;
  if (status !== "waiting" && status !== "accepted" && status !== "declined" && status !== "withdrawn") {
    return null;
  }
  if (status === "withdrawn") return null;
  const requestId = text(row.request_id);
  const projectId = text(row.project_id);
  return {
    id,
    requestId,
    projectId,
    workerId,
    skill,
    message: text(row.message) ?? "",
    origin,
    status,
    createdAt: text(row.created_at) ?? "",
  };
}

export function mapAvailability(row: Row): Availability | null {
  const id = text(row.id);
  const userId = text(row.user_id);
  const countryId = text(row.country_id);
  const townId = text(row.town_id);
  const picked = skills(row.skills);
  if (!id || !userId || !countryId || !townId || picked.length === 0) return null;
  return {
    id,
    userId,
    countryId,
    parishId: text(row.parish_id),
    townId,
    skills: picked,
    note: text(row.note) ?? "",
    createdAt: text(row.created_at) ?? "",
  };
}

export function mapCommitment(row: Row): Commitment | null {
  const id = text(row.id);
  const userId = text(row.user_id);
  const projectId = text(row.project_id);
  const amount = number(row.amount);
  const status = text(row.status);
  if (!id || !userId || !projectId || amount === null) return null;
  if (status !== "pledged" && status !== "accepted") return null;
  return {
    id,
    userId,
    projectId,
    amountJmd: amount,
    status,
    createdAt: text(row.created_at) ?? "",
    countsAt: text(row.counts_at),
  };
}

export function mapContribution(row: Row): Contribution | null {
  const id = text(row.id);
  const userId = text(row.user_id);
  const projectId = text(row.project_id);
  const skill = text(row.skill);
  const preset = text(row.preset);
  const status = text(row.status);
  if (!id || !userId || !projectId || !skill || !isSkill(skill)) return null;
  if (preset !== "day" && preset !== "few" && preset !== "week") return null;
  if (status !== "logged" && status !== "accepted") return null;
  return {
    id,
    userId,
    projectId,
    skill,
    preset: preset as WorkPreset,
    status,
    createdAt: text(row.created_at) ?? "",
  };
}

export function mapPublicPerson(row: Row): Pick<User, "id" | "name" | "role" | "countryId" | "parishId" | "townId"> | null {
  const id = text(row.id);
  const name = text(row.name);
  const personRole = role(row.role);
  const countryId = text(row.country_id);
  const townId = text(row.town_id);
  if (!id || !name || !personRole || !countryId || !townId) return null;
  return {
    id,
    name,
    role: personRole,
    countryId,
    parishId: text(row.parish_id),
    townId,
  };
}

export function newest<T extends { createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
