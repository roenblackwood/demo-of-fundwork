import raw from "../../data/seed.json";
import { isSector, isSkill } from "@/lib/catalog";
import { getRegion } from "@/lib/regions";
import { isLive } from "@/lib/mode";
import type {
  Application,
  Availability,
  CapitalRequest,
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
  "business-registration",
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
    if (!Array.isArray(project.team) || project.team.length === 0) {
      throw new Error(`Project ${project.id} needs a team.`);
    }
    if (project.organizerId !== null) {
      const organizer = data.users.find((user) => user.id === project.organizerId);
      if (!organizer || organizer.role !== "investor") {
        throw new Error(`Project ${project.id} organizer is not an investor.`);
      }
    }
    for (const member of project.team) {
      const user = data.users.find((item) => item.id === member);
      if (!user || user.role !== "worker") {
        throw new Error(`Project ${project.id} has a team member who is not a worker.`);
      }
      const samePlace =
        project.countryId === "jamaica"
          ? user.countryId === "jamaica" && user.parishId === project.parishId
          : user.countryId === project.countryId && user.townId === project.townId;
      const skills = [user.skill, ...user.extraSkills].filter(Boolean);
      if (!samePlace || !project.needs.some((need) => skills.includes(need))) {
        throw new Error(`Project ${project.id} has a team member who does not fit.`);
      }
    }
    if (
      project.mentorName !== undefined &&
      project.mentorName !== null &&
      (typeof project.mentorName !== "string" ||
        !project.mentorName.trim() ||
        project.mentorName.length > 80)
    ) {
      throw new Error(`Project ${project.id} has a bad mentor name.`);
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
  const requestStatus = new Set(["open", "team-ready", "closed"]);
  const applicationStatus = new Set(["waiting", "accepted", "declined"]);
  const applicationOrigin = new Set(["applied", "invited"]);
  function placeOk(countryId: string, parishId: string | null, townId: string): boolean {
    if (countryId === "jamaica") {
      const towns = parishId ? jamaicaTowns.get(parishId) : undefined;
      return Boolean(towns?.has(townId));
    }
    return !parishId && Boolean(cities.get(countryId)?.has(townId));
  }
  if (!Array.isArray(data.requests) || data.requests.length === 0) {
    throw new Error("Expected capital requests.");
  }
  const requestIds = new Set<string>();
  const requestsById = new Map<string, (typeof data.requests)[number]>();
  for (const request of data.requests) {
    if (requestIds.has(request.id)) throw new Error(`Duplicate request ${request.id}.`);
    requestIds.add(request.id);
    requestsById.set(request.id, request);
    if (!userIds.has(request.userId)) {
      throw new Error(`Request ${request.id} points at a missing user.`);
    }
    if (!placeOk(request.countryId, request.parishId, request.townId)) {
      throw new Error(`Request ${request.id} has an unknown place.`);
    }
    if (!isSector(request.sector)) {
      throw new Error(`Request ${request.id} has an unknown sector.`);
    }
    if (!(request.budget > 0) || !Number.isFinite(request.budget)) {
      throw new Error(`Request ${request.id} needs a budget above zero.`);
    }
    if (!Number.isInteger(request.workersNeeded) || request.workersNeeded < 1) {
      throw new Error(`Request ${request.id} needs at least one worker.`);
    }
    if (!Array.isArray(request.skills) || request.skills.length === 0) {
      throw new Error(`Request ${request.id} needs a skill.`);
    }
    for (const skill of request.skills) {
      if (!isSkill(skill)) throw new Error(`Request ${request.id} has an unknown skill.`);
    }
    if (!requestStatus.has(request.status)) {
      throw new Error(`Request ${request.id} has an unknown status.`);
    }
    if (request.projectId !== null && !projectIds.has(request.projectId)) {
      throw new Error(`Request ${request.id} points at a missing project.`);
    }
  }
  if (!Array.isArray(data.applications)) throw new Error("Expected applications.");
  const applicationIds = new Set<string>();
  for (const application of data.applications) {
    if (applicationIds.has(application.id)) {
      throw new Error(`Duplicate application ${application.id}.`);
    }
    applicationIds.add(application.id);
    const hasRequest = Boolean(application.requestId);
    const hasProject = Boolean(application.projectId);
    if (hasRequest === hasProject) {
      throw new Error(`Application ${application.id} must point at a request or a project.`);
    }
    const request = application.requestId ? requestsById.get(application.requestId) : undefined;
    if (application.requestId && !request) {
      throw new Error(`Application ${application.id} points at a missing request.`);
    }
    if (application.projectId && !projectIds.has(application.projectId)) {
      throw new Error(`Application ${application.id} points at a missing project.`);
    }
    if (!userIds.has(application.workerId)) {
      throw new Error(`Application ${application.id} points at a missing user.`);
    }
    const allowed = request
      ? request.skills
      : data.projects.find((item) => item.id === application.projectId)?.needs ?? [];
    if (!isSkill(application.skill) || !allowed.includes(application.skill)) {
      throw new Error(`Application ${application.id} has an unknown skill.`);
    }
    if (!applicationOrigin.has(application.origin) || !applicationStatus.has(application.status)) {
      throw new Error(`Application ${application.id} has an unknown status.`);
    }
  }
  if (!Array.isArray(data.availability) || data.availability.length === 0) {
    throw new Error("Expected availability posts.");
  }
  const availabilityIds = new Set<string>();
  for (const post of data.availability) {
    if (availabilityIds.has(post.id)) throw new Error(`Duplicate availability ${post.id}.`);
    availabilityIds.add(post.id);
    if (!userIds.has(post.userId)) {
      throw new Error(`Availability ${post.id} points at a missing user.`);
    }
    if (!placeOk(post.countryId, post.parishId, post.townId)) {
      throw new Error(`Availability ${post.id} has an unknown place.`);
    }
    if (!Array.isArray(post.skills) || post.skills.length === 0) {
      throw new Error(`Availability ${post.id} needs a skill.`);
    }
    for (const skill of post.skills) {
      if (!isSkill(skill)) throw new Error(`Availability ${post.id} has an unknown skill.`);
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

const livePeople = new Map<string, User>();

export function rememberLivePeople(
  people: Array<Pick<User, "id" | "name" | "role" | "countryId" | "parishId" | "townId">>,
) {
  livePeople.clear();
  for (const person of people) {
    livePeople.set(person.id, {
      id: person.id,
      name: person.name,
      role: person.role,
      countryId: person.countryId,
      parishId: person.parishId,
      townId: person.townId,
      verified: false,
      skill: null,
      extraSkills: [],
      proofLabel: null,
      example: "",
    });
  }
}

export function getUser(id: string): User | undefined {
  return seed.users.find((user) => user.id === id) ?? livePeople.get(id);
}

export function seedCommitments(): Commitment[] {
  if (isLive()) return [];
  return seed.commitments;
}

export function seedContributions(): Contribution[] {
  return seed.contributions;
}

export function seedRequests(): CapitalRequest[] {
  return seed.requests;
}

export function seedApplications(): Application[] {
  return seed.applications;
}

export function seedAvailability(): Availability[] {
  return seed.availability;
}

export function requestPlace(request: {
  countryId: string;
  parishId: string | null;
  townId: string;
}): { town: string; parish: string } | null {
  return askedPlace(request.countryId, request.parishId, request.townId);
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
