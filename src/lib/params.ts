import { SECTORS, SKILLS } from "@/lib/catalog";
import { getCountries, getParishes, getProjects } from "@/lib/seed";

export function parishParams() {
  const parishes = getParishes().map((parish) => ({ parish: parish.id }));
  const countries = getCountries().map((country) => ({ parish: country.id }));
  return [...parishes, ...countries];
}

export function townParams() {
  const towns = getParishes().flatMap((parish) =>
    parish.towns.map((town) => ({ parish: parish.id, town: town.id })),
  );
  const cities = getCountries().flatMap((country) =>
    country.cities.map((city) => ({ parish: country.id, town: city.id })),
  );
  return [...towns, ...cities];
}

export function sectorParams() {
  const places = [
    ...townParams(),
    ...getParishes().map((parish) => ({ parish: parish.id, town: "all" })),
    ...getCountries()
      .filter((country) => country.id !== "jamaica")
      .map((country) => ({ parish: country.id, town: "all" })),
  ];
  return places.flatMap((place) =>
    SECTORS.map((sector) => ({ ...place, sector: sector.id })),
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
