import { SKILLS } from "@/lib/catalog";
import { getParishes, getProjects } from "@/lib/seed";
import type { Sector } from "@/lib/types";

const SECTOR_IDS: Sector[] = ["lodging", "agriculture"];

export function parishParams() {
  return getParishes().map((parish) => ({ parish: parish.id }));
}

export function townParams() {
  return getParishes().flatMap((parish) =>
    parish.towns.map((town) => ({ parish: parish.id, town: town.id })),
  );
}

export function sectorParams() {
  const places = [
    ...townParams(),
    ...getParishes().map((parish) => ({ parish: parish.id, town: "all" })),
  ];
  return places.flatMap((place) =>
    SECTOR_IDS.map((sector) => ({ ...place, sector })),
  );
}

export function roleParams() {
  return townParams().flatMap((place) =>
    SKILLS.map((skill) => ({ ...place, role: skill.id })),
  );
}

export function projectParams() {
  return getProjects().map((project) => ({ id: project.id }));
}
