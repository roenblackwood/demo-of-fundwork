import raw from "../../data/seed.json";
import { isSector, isSkill } from "@/lib/catalog";
import type {
  Commitment,
  Contribution,
  Parish,
  Project,
  Seed,
  User,
} from "@/lib/types";

const CHECK_IDS = [
  "organizer",
  "jtb",
  "site-visit",
  "parish-letter",
  "rada",
  "public-health",
] as const;

function assertSeed(data: Seed): void {
  if (data.parishes.length !== 14) {
    throw new Error(`Expected 14 parishes, found ${data.parishes.length}.`);
  }
  const parishIds = new Set<string>();
  for (const parish of data.parishes) {
    if (parishIds.has(parish.id)) throw new Error(`Duplicate parish ${parish.id}.`);
    parishIds.add(parish.id);
    if (parish.towns.length < 3 || parish.towns.length > 5) {
      throw new Error(`${parish.name} needs 3 to 5 towns.`);
    }
    const townIds = new Set<string>();
    for (const town of parish.towns) {
      if (townIds.has(town.id)) {
        throw new Error(`Duplicate town ${town.id} in ${parish.name}.`);
      }
      townIds.add(town.id);
    }
  }
  if (data.projects.length < 6 || data.projects.length > 8) {
    throw new Error(`Expected 6 to 8 projects, found ${data.projects.length}.`);
  }
  const projectIds = new Set(data.projects.map((project) => project.id));
  for (const project of data.projects) {
    const parish = data.parishes.find((item) => item.id === project.parishId);
    if (!parish) throw new Error(`Project ${project.id} has an unknown parish.`);
    if (!parish.towns.some((town) => town.id === project.townId)) {
      throw new Error(`Project ${project.id} has an unknown town.`);
    }
    if (!isSector(project.sector)) {
      throw new Error(`Project ${project.id} has an unknown sector.`);
    }
    for (const skill of project.needs) {
      if (!isSkill(skill)) throw new Error(`Project ${project.id} has an unknown skill.`);
    }
    for (const check of project.checks) {
      const known: readonly string[] = CHECK_IDS;
      if (!known.includes(check.id)) {
        throw new Error(`Project ${project.id} has an unknown check.`);
      }
    }
  }
  const userIds = new Set(data.users.map((user) => user.id));
  for (const user of data.users) {
    const parish = data.parishes.find((item) => item.id === user.parishId);
    if (!parish?.towns.some((town) => town.id === user.townId)) {
      throw new Error(`User ${user.id} has an unknown place.`);
    }
    if (user.skill && !isSkill(user.skill)) {
      throw new Error(`User ${user.id} has an unknown skill.`);
    }
  }
  for (const commitment of data.commitments) {
    if (!userIds.has(commitment.userId) || !projectIds.has(commitment.projectId)) {
      throw new Error(`Commitment ${commitment.id} points at missing data.`);
    }
  }
  for (const contribution of data.contributions) {
    if (!userIds.has(contribution.userId) || !projectIds.has(contribution.projectId)) {
      throw new Error(`Contribution ${contribution.id} points at missing data.`);
    }
    if (!isSkill(contribution.skill)) {
      throw new Error(`Contribution ${contribution.id} has an unknown skill.`);
    }
  }
}

const seed = raw as Seed;
assertSeed(seed);

export function getParishes(): Parish[] {
  return seed.parishes;
}

export function getParish(id: string): Parish | undefined {
  return seed.parishes.find((parish) => parish.id === id);
}

export function getTown(parishId: string, townId: string) {
  return getParish(parishId)?.towns.find((town) => town.id === townId);
}

export function getProjects(): Project[] {
  return seed.projects;
}

export function getProject(id: string): Project | undefined {
  return seed.projects.find((project) => project.id === id);
}

export function getUsers(): User[] {
  return seed.users;
}

export function getUser(id: string): User | undefined {
  return seed.users.find((user) => user.id === id);
}

export function seedCommitments(): Commitment[] {
  return seed.commitments;
}

export function seedContributions(): Contribution[] {
  return seed.contributions;
}

export function placeName(parishId: string, townId: string): { town: string; parish: string } | null {
  const parish = getParish(parishId);
  const town = parish?.towns.find((item) => item.id === townId);
  if (!parish || !town) return null;
  return { town: town.name, parish: parish.name };
}
