import { matchNote } from "@/lib/ai";
import { skillPhrase } from "@/lib/catalog";
import { askedPlace, getCountry, getProjects, projectPlace } from "@/lib/seed";
import type { AiNote, Availability, CapitalRequest, Project, Sector, Skill } from "@/lib/types";

export type Match = {
  project: Project;
  note: AiNote;
};

function sameArea(project: Project, countryId: string, parishId: string | null): boolean {
  if (countryId === "jamaica") return Boolean(parishId) && project.parishId === parishId;
  return project.countryId === countryId;
}

function regionOf(project: Project): string {
  if (project.countryId === "jamaica") return "caribbean";
  return getCountry(project.countryId)?.regionId ?? "";
}

export function matchProjects(input: {
  countryId: string;
  parishId: string | null;
  townId: string;
  skills: Skill[];
  projects?: Project[];
}): Match[] {
  const asked = askedPlace(input.countryId, input.parishId, input.townId);
  if (!asked || input.skills.length === 0) return [];

  const fits = (input.projects ?? getProjects()).filter((project) =>
    project.needs.some((need) => input.skills.includes(need)),
  );
  const inTown = fits.filter(
    (project) => sameArea(project, input.countryId, input.parishId) && project.townId === input.townId,
  );
  const inArea = fits.filter(
    (project) => sameArea(project, input.countryId, input.parishId) && project.townId !== input.townId,
  );
  const homeRegion =
    input.countryId === "jamaica" ? "caribbean" : getCountry(input.countryId)?.regionId ?? "";
  const primary = input.skills[0];
  const farther = fits
    .filter((project) => !sameArea(project, input.countryId, input.parishId))
    .sort((a, b) => rank(a, homeRegion, primary) - rank(b, homeRegion, primary));

  let chosen = [...inTown];
  if (chosen.length < 2) chosen = [...chosen, ...inArea];
  if (chosen.length < 2) chosen = [...chosen, ...farther];

  return chosen.slice(0, 4).map((project) => {
    const where = projectPlace(project);
    const skill =
      input.skills.find((item) => project.needs.includes(item)) ?? input.skills[0];
    return {
      project,
      note: matchNote({
        project,
        skill,
        askedTown: asked.town,
        askedParish: asked.parish,
        projectTown: where?.town ?? "this place",
        projectParish: where?.parish ?? "this place",
      }),
    };
  });
}

function rank(project: Project, homeRegion: string, primary: Skill | undefined): number {
  const regionScore = regionOf(project) === homeRegion ? 0 : 2;
  const skillScore = primary && project.needs.includes(primary) ? 0 : 1;
  return regionScore + skillScore;
}

export function projectsForPlace(
  placeId: string,
  townId: string,
  sector: Sector,
  projects: Project[] = getProjects(),
): Project[] {
  return projects.filter((project) => {
    if (project.sector !== sector) return false;
    const here =
      project.parishId === placeId ||
      (placeId !== "jamaica" && project.countryId === placeId && !project.parishId);
    if (!here) return false;
    if (townId === "all") return true;
    return project.townId === townId;
  });
}

type Spot = {
  countryId: string;
  parishId: string | null;
  townId: string;
};

function sameSpot(home: Spot, item: Spot): boolean {
  if (home.countryId === "jamaica") {
    return item.countryId === "jamaica" && Boolean(home.parishId) && item.parishId === home.parishId;
  }
  return item.countryId === home.countryId;
}

function spotRegion(spot: Spot): string {
  if (spot.countryId === "jamaica") return "caribbean";
  return getCountry(spot.countryId)?.regionId ?? "";
}

type Band = "town" | "area" | "region" | "far";

export function bandRank(home: Spot, item: Spot): number {
  const band = bandOf(home, item);
  if (band === "town") return 0;
  if (band === "area") return 1;
  if (band === "region") return 2;
  return 3;
}

function bandOf(home: Spot, item: Spot): Band {
  if (sameSpot(home, item) && home.townId === item.townId) return "town";
  if (sameSpot(home, item)) return "area";
  if (spotRegion(home) && spotRegion(home) === spotRegion(item)) return "region";
  return "far";
}

function pickNearby<T extends Spot>(home: Spot, fits: T[], hasPrimary: (item: T) => boolean): T[] {
  const inTown = fits.filter((item) => sameSpot(home, item) && item.townId === home.townId);
  const inArea = fits.filter((item) => sameSpot(home, item) && item.townId !== home.townId);
  const homeRegion = spotRegion(home);
  const farther = fits
    .filter((item) => !sameSpot(home, item))
    .sort((a, b) => {
      const score = (item: T) => (spotRegion(item) === homeRegion ? 0 : 2) + (hasPrimary(item) ? 0 : 1);
      return score(a) - score(b);
    });
  let chosen = [...inTown];
  if (chosen.length < 2) chosen = [...chosen, ...inArea];
  if (chosen.length < 2) chosen = [...chosen, ...farther];
  return chosen;
}

function workerReason(band: Band, skill: Skill, jamaica: boolean): string {
  const need = skillPhrase(skill);
  if (band === "town") return `In your town and needs ${need}.`;
  if (band === "area") {
    return jamaica ? `In your parish and needs ${need}.` : `In your country and needs ${need}.`;
  }
  if (band === "region") return `In your region and needs ${need}.`;
  return `Farther away, and needs ${need}.`;
}

function investorReason(band: Band, skill: Skill, jamaica: boolean): string {
  const can = skillPhrase(skill);
  if (band === "town") return `In this town and can do ${can}.`;
  if (band === "area") {
    return jamaica ? `In this parish and can do ${can}.` : `In this country and can do ${can}.`;
  }
  if (band === "region") return `In this region and can do ${can}.`;
  return `Farther away, and can do ${can}.`;
}

export type RequestMatch = {
  request: CapitalRequest;
  reason: string;
};

export function matchRequests(input: {
  countryId: string;
  parishId: string | null;
  townId: string;
  skills: Skill[];
  requests: CapitalRequest[];
}): RequestMatch[] {
  if (!askedPlace(input.countryId, input.parishId, input.townId) || input.skills.length === 0) {
    return [];
  }
  const fits = input.requests.filter(
    (request) =>
      request.status === "open" && request.skills.some((skill) => input.skills.includes(skill)),
  );
  const primary = input.skills[0];
  return pickNearby(input, fits, (request) => request.skills.includes(primary))
    .slice(0, 4)
    .map((request) => {
      const skill = input.skills.find((item) => request.skills.includes(item)) ?? request.skills[0];
      return {
        request,
        reason: workerReason(bandOf(input, request), skill, input.countryId === "jamaica"),
      };
    });
}

export type WorkerMatch = {
  availability: Availability;
  reason: string;
};

export function matchWorkers(request: CapitalRequest, posts: Availability[]): WorkerMatch[] {
  const fits = posts.filter(
    (post) =>
      post.userId !== request.userId &&
      post.skills.some((skill) => request.skills.includes(skill)),
  );
  const primary = request.skills[0];
  const seen = new Set<string>();
  const unique: Availability[] = [];
  for (const post of pickNearby(request, fits, (item) => item.skills.includes(primary))) {
    if (seen.has(post.userId)) continue;
    seen.add(post.userId);
    unique.push(post);
  }
  return unique.slice(0, 4).map((post) => {
    const skill = request.skills.find((item) => post.skills.includes(item)) ?? post.skills[0];
    return {
      availability: post,
      reason: investorReason(bandOf(request, post), skill, request.countryId === "jamaica"),
    };
  });
}

export function sectorsHere(
  placeId: string,
  townId: string,
  projects: Project[] = getProjects(),
): Sector[] {
  const present = new Set<Sector>();
  for (const project of projects) {
    const jamaica = project.countryId === "jamaica";
    const here = jamaica ? project.parishId === placeId : project.countryId === placeId;
    if (!here) continue;
    if (townId !== "all" && project.townId !== townId) continue;
    present.add(project.sector);
  }
  return [...present];
}
