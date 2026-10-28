import { readFileSync } from "node:fs";

const seed = JSON.parse(readFileSync(new URL("../data/seed.json", import.meta.url), "utf8"));
const errors = [];

if (seed.parishes.length !== 14) errors.push(`Expected 14 parishes, found ${seed.parishes.length}.`);
for (const parish of seed.parishes) {
  if (parish.towns.length < 3 || parish.towns.length > 5) {
    errors.push(`${parish.name} should have 3 to 5 towns.`);
  }
}
if (seed.projects.length < 6 || seed.projects.length > 8) {
  errors.push(`Expected 6 to 8 projects, found ${seed.projects.length}.`);
}

const sectors = new Set(seed.projects.map((project) => project.sector));
if (!sectors.has("lodging") || !sectors.has("agriculture")) {
  errors.push("Projects should include both lodging and agriculture.");
}

const parishes = new Map(seed.parishes.map((parish) => [parish.id, new Set(parish.towns.map((town) => town.id))]));
for (const project of seed.projects) {
  const towns = parishes.get(project.parishId);
  if (!towns?.has(project.townId)) errors.push(`${project.id} has a bad place.`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Seed ok: ${seed.parishes.length} parishes, ${seed.projects.length} projects, ${seed.users.length} sample people.`,
);
