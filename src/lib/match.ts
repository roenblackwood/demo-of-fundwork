import { matchNote } from "@/lib/ai";
import { getProjects, placeName } from "@/lib/seed";
import type { AiNote, Project, Skill } from "@/lib/types";

export type Match = {
  project: Project;
  note: AiNote;
};

export function matchProjects(input: {
  parishId: string;
  townId: string;
  skills: Skill[];
}): Match[] {
  const asked = placeName(input.parishId, input.townId);
  if (!asked || input.skills.length === 0) return [];

  const fits = getProjects().filter((project) =>
    project.needs.some((need) => input.skills.includes(need)),
  );
  const inTown = fits.filter(
    (project) => project.parishId === input.parishId && project.townId === input.townId,
  );
  const inParish = fits.filter(
    (project) => project.parishId === input.parishId && project.townId !== input.townId,
  );
  const farther = fits.filter((project) => project.parishId !== input.parishId);

  let chosen = [...inTown];
  if (chosen.length < 2) chosen = [...chosen, ...inParish];
  if (chosen.length < 2) chosen = [...chosen, ...farther];

  return chosen.slice(0, 4).map((project) => {
    const where = placeName(project.parishId, project.townId);
    const skill =
      input.skills.find((item) => project.needs.includes(item)) ?? input.skills[0];
    return {
      project,
      note: matchNote({
        project,
        skill,
        askedTown: asked.town,
        askedParish: asked.parish,
        projectTown: where?.town ?? "this town",
        projectParish: where?.parish ?? "this parish",
      }),
    };
  });
}

export function projectsForPlace(
  parishId: string,
  townId: string,
  sector: Project["sector"],
): Project[] {
  return getProjects().filter((project) => {
    if (project.parishId !== parishId || project.sector !== sector) return false;
    if (townId === "all") return true;
    return project.townId === townId;
  });
}
