import { readFileSync } from "node:fs";

const seed = JSON.parse(readFileSync(new URL("../data/seed.json", import.meta.url), "utf8"));
const errors = [];
const sectorsNeeded = ["lodging", "agriculture", "energy", "water", "connectivity", "education", "healthcare"];

if (seed.parishes.length !== 14) errors.push(`Expected 14 parishes, found ${seed.parishes.length}.`);
for (const parish of seed.parishes) {
  if (parish.towns.length < 3 || parish.towns.length > 5) {
    errors.push(`${parish.name} should have 3 to 5 towns.`);
  }
}
if (!Array.isArray(seed.countries) || seed.countries.length < 18) {
  errors.push("Expected countries beside Jamaica.");
}
for (const country of seed.countries ?? []) {
  if (country.cities.length < 1 || country.cities.length > 2) {
    errors.push(`${country.name} should have 1 or 2 cities.`);
  }
}
if (seed.projects.length < 12 || seed.projects.length > 15) {
  errors.push(`Expected 12 to 15 projects, found ${seed.projects.length}.`);
}

const sectors = new Set(seed.projects.map((project) => project.sector));
for (const sector of sectorsNeeded) {
  if (!sectors.has(sector)) errors.push(`Missing a ${sector} project.`);
}

const parishes = new Map(seed.parishes.map((parish) => [parish.id, new Set(parish.towns.map((town) => town.id))]));
const countries = new Map((seed.countries ?? []).map((country) => [country.id, new Set(country.cities.map((city) => city.id))]));
for (const project of seed.projects) {
  if (project.countryId === "jamaica") {
    const towns = parishes.get(project.parishId);
    if (!towns?.has(project.townId)) errors.push(`${project.id} has a bad Jamaica place.`);
  } else if (!countries.get(project.countryId)?.has(project.townId) || project.parishId) {
    errors.push(`${project.id} has a bad country place.`);
  }
  if (project.workersMatched > project.workersNeeded || project.weeklyPayout <= 0) {
    errors.push(`${project.id} has a bad worker or payout figure.`);
  }
  if (project.countryId !== "jamaica") {
    for (const check of project.checks) {
      if (["jtb", "rada", "parish-letter"].includes(check.id)) {
        errors.push(`${project.id} uses a Jamaica-only check.`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Seed ok: ${seed.parishes.length} parishes, ${seed.countries.length} countries, ${seed.projects.length} projects, ${seed.users.length} sample people.`,
);
