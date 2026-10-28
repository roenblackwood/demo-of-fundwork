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
  if (!Array.isArray(project.team) || project.team.length === 0) {
    errors.push(`${project.id} needs a team.`);
  }
  if (project.countryId !== "jamaica") {
    for (const check of project.checks) {
      if (["jtb", "rada", "parish-letter"].includes(check.id)) {
        errors.push(`${project.id} uses a Jamaica-only check.`);
      }
    }
  }
}

const skillIds = new Set([
  "building",
  "guest-house",
  "farming",
  "cooking",
  "front",
  "power",
  "water",
  "internet",
  "teaching",
  "care",
]);
const userIds = new Set((seed.users ?? []).map((user) => user.id));
const usersById = new Map((seed.users ?? []).map((user) => [user.id, user]));
const projectIds = new Set(seed.projects.map((project) => project.id));
for (const project of seed.projects) {
  for (const member of project.team ?? []) {
    const user = usersById.get(member);
    if (!user || user.role !== "worker") {
      errors.push(`${project.id} team member ${member} is not a worker.`);
      continue;
    }
    const samePlace =
      project.countryId === "jamaica"
        ? user.countryId === "jamaica" && user.parishId === project.parishId
        : user.countryId === project.countryId && user.townId === project.townId;
    const skills = [user.skill, ...(user.extraSkills ?? [])];
    if (!samePlace || !project.needs.some((need) => skills.includes(need))) {
      errors.push(`${project.id} team member ${member} does not fit the project.`);
    }
  }
}

function placeOk(item) {
  if (item.countryId === "jamaica") {
    const towns = parishes.get(item.parishId);
    return Boolean(towns?.has(item.townId));
  }
  return !item.parishId && Boolean(countries.get(item.countryId)?.has(item.townId));
}

if (!Array.isArray(seed.requests) || seed.requests.length === 0) {
  errors.push("Expected capital requests.");
}
const requestsById = new Map();
for (const request of seed.requests ?? []) {
  if (requestsById.has(request.id)) errors.push(`Duplicate request ${request.id}.`);
  requestsById.set(request.id, request);
  if (!userIds.has(request.userId)) errors.push(`${request.id} points at a missing user.`);
  if (!placeOk(request)) errors.push(`${request.id} has a bad place.`);
  if (!sectorsNeeded.includes(request.sector)) errors.push(`${request.id} has a bad sector.`);
  if (!(request.budget > 0)) errors.push(`${request.id} needs a budget above zero.`);
  if (!Array.isArray(request.skills) || request.skills.length === 0) {
    errors.push(`${request.id} needs a skill.`);
  }
  for (const skill of request.skills ?? []) {
    if (!skillIds.has(skill)) errors.push(`${request.id} has an unknown skill.`);
  }
  if (request.projectId !== null && !projectIds.has(request.projectId)) {
    errors.push(`${request.id} points at a missing project.`);
  }
}

if (!Array.isArray(seed.applications)) errors.push("Expected applications.");
for (const application of seed.applications ?? []) {
  const hasRequest = Boolean(application.requestId);
  const hasProject = Boolean(application.projectId);
  if (hasRequest === hasProject) {
    errors.push(`${application.id} must point at a request or a project.`);
  }
  const request = application.requestId ? requestsById.get(application.requestId) : undefined;
  if (application.requestId && !request) errors.push(`${application.id} points at a missing request.`);
  if (application.projectId && !projectIds.has(application.projectId)) {
    errors.push(`${application.id} points at a missing project.`);
  }
  if (!userIds.has(application.workerId)) errors.push(`${application.id} points at a missing user.`);
  if (!skillIds.has(application.skill)) errors.push(`${application.id} has an unknown skill.`);
  const project = seed.projects.find((item) => item.id === application.projectId);
  const allowed = request?.skills ?? project?.needs ?? [];
  if (allowed.length > 0 && !allowed.includes(application.skill)) {
    errors.push(`${application.id} uses a skill that does not fit.`);
  }
}

if (!Array.isArray(seed.availability) || seed.availability.length === 0) {
  errors.push("Expected availability posts.");
}
for (const post of seed.availability ?? []) {
  if (!userIds.has(post.userId)) errors.push(`${post.id} points at a missing user.`);
  if (!placeOk(post)) errors.push(`${post.id} has a bad place.`);
  if (!Array.isArray(post.skills) || post.skills.length === 0) errors.push(`${post.id} needs a skill.`);
  for (const skill of post.skills ?? []) {
    if (!skillIds.has(skill)) errors.push(`${post.id} has an unknown skill.`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Seed ok: ${seed.parishes.length} parishes, ${seed.countries.length} countries, ${seed.projects.length} projects, ${seed.users.length} sample people, ${seed.requests.length} requests.`,
);
