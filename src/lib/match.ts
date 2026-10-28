import { matchNote } from "@/lib/ai";
import { askedPlace, getCountry, getProjects, projectPlace } from "@/lib/seed";
import type { AiNote, Project, Sector, Skill } from "@/lib/types";

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
}): Match[] {
  const asked = askedPlace(input.countryId, input.parishId, input.townId);
  if (!asked || input.skills.length === 0) return [];

  const fits = getProjects().filter((project) =>
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

export function projectsForPlace(placeId: string, townId: string, sector: Sector): Project[] {
  return getProjects().filter((project) => {
    if (project.sector !== sector) return false;
    const here =
      project.parishId === placeId ||
      (placeId !== "jamaica" && project.countryId === placeId && !project.parishId);
    if (!here) return false;
    if (townId === "all") return true;
    return project.townId === townId;
  });
}

export function sectorsHere(placeId: string, townId: string): Sector[] {
  const present = new Set<Sector>();
  for (const project of getProjects()) {
    const jamaica = project.countryId === "jamaica";
    const here = jamaica ? project.parishId === placeId : project.countryId === placeId;
    if (!here) continue;
    if (townId !== "all" && project.townId !== townId) continue;
    present.add(project.sector);
  }
  return [...present];
}
