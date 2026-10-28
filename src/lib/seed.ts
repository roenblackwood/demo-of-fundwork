import raw from "../../data/seed.json";
import { isSector, isSkill } from "@/lib/catalog";
import { getRegion } from "@/lib/regions";
import type {
  Commitment,
  Contribution,
  Country,
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
  "engineer",
  "community",
] as const;

const JAMAICA_ONLY_CHECKS = new Set(["jtb", "rada", "parish-letter"]);

function assertSeed(data: Seed): void {
  if (data.parishes.length !== 14) {
    throw new Error(`Expected 14 parishes, found ${data.parishes.length}.`);
  }
  const parishIds = new Set<string>();
  const jamaicaTowns = new Map<string, Set<string>>();
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
    jamaicaTowns.set(parish.id, townIds);
  }
  if (data.countries.length < 18 || data.countries.length > 22) {
    throw new Error(`Expected about 20 countries, found ${data.countries.length}.`);
  }
  const countryIds = new Set<string>();
  const cities = new Map<string, Set<string>>();
  for (const country of data.countries) {
    if (country.id === "jamaica") throw new Error("Jamaica stays in the parish list.");
    if (countryIds.has(country.id) || parishIds.has(country.id)) {
      throw new Error(`Duplicate country ${country.id}.`);
    }
    countryIds.add(country.id);
    if (!getRegion(country.regionId)) {
      throw new Error(`${country.name} has an unknown region.`);
    }
    if (!country.currency) throw new Error(`${country.name} needs a currency.`);
    if (country.cities.length < 1 || country.cities.length > 2) {
      throw new Error(`${country.name} needs 1 or 2 cities.`);
    }
    const cityIds = new Set<string>();
    for (const city of country.cities) {
      if (cityIds.has(city.id)) throw new Error(`Duplicate city ${city.id} in ${country.name}.`);
      cityIds.add(city.id);
    }
    cities.set(country.id, cityIds);
  }
  if (data.projects.length < 12 || data.projects.length > 15) {
    throw new Error(`Expected 12 to 15 projects, found ${data.projects.length}.`);
  }
  const projectIds = new Set(data.projects.map((project) => project.id));
  for (const project of data.projects) {
    if (project.countryId === "jamaica") {
      const towns = project.parishId ? jamaicaTowns.get(project.parishId) : undefined;
      if (!towns?.has(project.townId)) {
        throw new Error(`Project ${project.id} has an unknown Jamaica place.`);
      }
    } else if (!cities.get(project.countryId)?.has(project.townId) || project.parishId) {
      throw new Error(`Project ${project.id} has an unknown country place.`);
    }
    if (!isSector(project.sector)) {
      throw new Error(`Project ${project.id} has an unknown sector.`);
    }
    if (
      project.workersNeeded < 1 ||
      project.workersMatched < 0 ||
      project.workersMatched > project.workersNeeded ||
      project.weeklyPayout <= 0
    ) {
      throw new Error(`Project ${project.id} has a bad worker or payout figure.`);
    }
    for (const skill of project.needs) {
      if (!isSkill(skill)) throw new Error(`Project ${project.id} has an unknown skill.`);
    }
    for (const check of project.checks) {
      const known: readonly string[] = CHECK_IDS;
      if (!known.includes(check.id)) {
        throw new Error(`Project ${project.id} has an unknown check.`);
      }
      if (project.countryId !== "jamaica" && JAMAICA_ONLY_CHECKS.has(check.id)) {
        throw new Error(`Project ${project.id} uses a Jamaica-only check.`);
      }
    }
  }
  const userIds = new Set(data.users.map((user) => user.id));
  for (const user of data.users) {
    if (user.countryId === "jamaica") {
      const towns = user.parishId ? jamaicaTowns.get(user.parishId) : undefined;
      if (!towns?.has(user.townId)) throw new Error(`User ${user.id} has an unknown place.`);
    } else if (!cities.get(user.countryId)?.has(user.townId) || user.parishId) {
      throw new Error(`User ${user.id} has an unknown place.`);
    }
    if (user.skill && !isSkill(user.skill)) {
      throw new Error(`User ${user.id} has an unknown skill.`);
    }
    for (const skill of user.extraSkills) {
      if (!isSkill(skill)) throw new Error(`User ${user.id} has an unknown skill.`);
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

const jamaicaCountry: Country = {
  id: "jamaica",
  name: "Jamaica",
  regionId: "caribbean",
  currency: "J$",
  cities: [],
};

export function getParishes(): Parish[] {
  return seed.parishes;
}

export function getParish(id: string): Parish | undefined {
  return seed.parishes.find((parish) => parish.id === id);
}

export function getTown(parishId: string, townId: string) {
  return getParish(parishId)?.towns.find((town) => town.id === townId);
}

export function getCountries(): Country[] {
  return [jamaicaCountry, ...seed.countries];
}

export function getCountry(id: string): Country | undefined {
  if (id === "jamaica") return jamaicaCountry;
  return seed.countries.find((country) => country.id === id);
}

export function getCity(countryId: string, cityId: string) {
  return getCountry(countryId)?.cities.find((city) => city.id === cityId);
}

export function currencyOf(countryId: string): string {
  return getCountry(countryId)?.currency ?? "J$";
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

export function projectPlace(project: Project): { town: string; parish: string } | null {
  if (project.countryId === "jamaica" && project.parishId) {
    const parish = getParish(project.parishId);
    const town = parish?.towns.find((item) => item.id === project.townId);
    if (!parish || !town) return null;
    return { town: town.name, parish: parish.name };
  }
  const country = getCountry(project.countryId);
  const city = country?.cities.find((item) => item.id === project.townId);
  if (!country || !city) return null;
  return { town: city.name, parish: country.name };
}

export function askedPlace(
  countryId: string,
  parishId: string | null,
  townId: string,
): { town: string; parish: string } | null {
  if (countryId === "jamaica" && parishId) {
    const parish = getParish(parishId);
    const town = parish?.towns.find((item) => item.id === townId);
    if (!parish || !town) return null;
    return { town: town.name, parish: parish.name };
  }
  const country = getCountry(countryId);
  const city = country?.cities.find((item) => item.id === townId);
  if (!country || !city) return null;
  return { town: city.name, parish: country.name };
}
