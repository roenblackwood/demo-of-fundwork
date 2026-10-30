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

/** [west, east, south, north]. A point outside its country fails the check. */
const COUNTRY_BOX = {
  jamaica: [-78.45, -76.15, 17.68, 18.55],
  barbados: [-59.66, -59.42, 13.04, 13.34],
  "dominican-republic": [-72.0, -68.3, 17.5, 19.9],
  colombia: [-79.05, -66.85, -4.23, 12.5],
  mexico: [-118.4, -86.7, 14.53, 32.72],
  "el-salvador": [-90.13, -87.69, 13.15, 14.45],
  brazil: [-73.99, -34.7, -33.75, 5.27],
  kenya: [33.9, 41.91, -4.68, 5.03],
  ghana: [-3.26, 1.2, 4.54, 11.17],
  rwanda: [28.86, 30.9, -2.84, -1.05],
  nigeria: [2.67, 14.68, 4.27, 13.89],
  jordan: [34.96, 39.3, 29.18, 33.37],
  moldova: [26.62, 30.16, 45.47, 48.49],
  romania: [20.26, 29.72, 43.62, 48.27],
  ukraine: [22.14, 40.23, 44.38, 52.38],
  india: [68.11, 97.42, 6.75, 35.51],
  pakistan: [60.87, 77.84, 23.69, 37.1],
  indonesia: [95.01, 141.01, -11.01, 6.08],
  philippines: [116.95, 126.6, 4.59, 21.12],
  vietnam: [102.14, 109.46, 8.18, 23.39],
};

function pointInside(box, lat, lng) {
  return lng >= box[0] && lng <= box[1] && lat >= box[2] && lat <= box[3];
}

function checkPoint(label, countryId, place) {
  const box = COUNTRY_BOX[countryId];
  if (!box) {
    errors.push(`${label} has no country box.`);
    return;
  }
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
    errors.push(`${label} needs a point.`);
    return;
  }
  if (!pointInside(box, place.lat, place.lng)) {
    errors.push(`${label} is outside ${countryId}.`);
  }
}

for (const parish of seed.parishes) {
  for (const town of parish.towns) checkPoint(`${parish.name}, ${town.name}`, "jamaica", town);
}
for (const country of seed.countries ?? []) {
  for (const city of country.cities) checkPoint(`${country.name}, ${city.name}`, country.id, city);
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
const investorIds = new Set(
  (seed.users ?? []).filter((user) => user.role === "investor").map((user) => user.id),
);
const projectIds = new Set(seed.projects.map((project) => project.id));
for (const project of seed.projects) {
  if (!Object.hasOwn(project, "organizerId")) {
    errors.push(`${project.id} needs an organizerId.`);
  } else if (project.organizerId !== null && !investorIds.has(project.organizerId)) {
    errors.push(`${project.id} organizer is not an investor.`);
  }
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

const guides = JSON.parse(readFileSync(new URL("../data/guides.json", import.meta.url), "utf8"));
const checkIds = new Set([
  "organizer",
  "jtb",
  "site-visit",
  "parish-letter",
  "rada",
  "public-health",
  "engineer",
  "community",
  "business-registration",
]);
const countryIds = new Set((seed.countries ?? []).map((country) => country.id));
countryIds.add("jamaica");
const currencyCodes = new Set(["JMD", "USD", "EUR", "GBP", "KES", "GHS"]);
for (const country of seed.countries ?? []) {
  const letters = String(country.currency ?? "").replace(/[^A-Za-z]/g, "");
  if (letters.length >= 2) currencyCodes.add(letters);
}

function hasMoneyTalk(text) {
  if (/[$€£¥₵]/.test(text)) return true;
  for (const code of currencyCodes) {
    const pattern = new RegExp(`(?:\\d\\s*${code}\\b|\\b${code}\\s*\\d)`, "i");
    if (pattern.test(text)) return true;
  }
  return false;
}

function scanText(label, value) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} needs text.`);
    return;
  }
  if (hasMoneyTalk(value)) errors.push(`${label} mentions money.`);
}

function walkText(label, value, key) {
  if (key === "checkedOn") return;
  if (typeof value === "string") {
    scanText(label, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkText(label, item);
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value)) walkText(label, child, childKey);
  }
}

if (!Array.isArray(guides.entries)) {
  errors.push("guides.json needs an entries list.");
} else {
  const seen = new Set();
  for (const entry of guides.entries) {
    const where = `${entry?.countryId ?? "?"}:${entry?.sector ?? "?"}`;
    if (!countryIds.has(entry.countryId)) errors.push(`${where} is not a real country.`);
    if (!sectorsNeeded.includes(entry.sector)) errors.push(`${where} is not a real sector.`);
    if (seen.has(where)) errors.push(`Duplicate guide ${where}.`);
    seen.add(where);
    if (!Array.isArray(entry.checks) || entry.checks.length === 0) {
      errors.push(`${where} needs checks.`);
    } else if (new Set(entry.checks).size !== entry.checks.length) {
      errors.push(`${where} repeats a check.`);
    }
    for (const checkId of entry.checks ?? []) {
      if (!checkIds.has(checkId)) errors.push(`${where} has an unknown check.`);
    }
    if (!Array.isArray(entry.agencies) || entry.agencies.length === 0) {
      errors.push(`${where} needs agencies.`);
    }
    const covered = new Set();
    for (const agency of entry.agencies ?? []) {
      if (!checkIds.has(agency?.checkId)) errors.push(`${where} has an unknown agency check.`);
      else if (!(entry.checks ?? []).includes(agency.checkId)) {
        errors.push(`${where} agency uses a check the guide does not list.`);
      }
      if (agency?.kindIds == null) {
        covered.add(agency?.checkId);
        continue;
      }
      if (!Array.isArray(agency.kindIds) || agency.kindIds.length === 0) {
        errors.push(`${where} kindIds must list kinds.`);
      }
    }
    for (const checkId of entry.checks ?? []) {
      if (!covered.has(checkId)) errors.push(`${where} check ${checkId} needs an agency.`);
    }
    if (!Array.isArray(entry.firstSteps) || entry.firstSteps.length !== 3) {
      errors.push(`${where} needs three first steps.`);
    }
    if (!Array.isArray(entry.team) || entry.team.length === 0) errors.push(`${where} needs a team.`);
    for (const skill of entry.team ?? []) {
      if (!skillIds.has(skill)) errors.push(`${where} has an unknown skill.`);
    }
    if (typeof entry.sourceNote !== "string" || !entry.sourceNote.trim()) {
      errors.push(`${where} needs a source note.`);
    }
    walkText(where, entry);
    if (typeof entry.checkedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedOn)) {
      errors.push(`${where} needs a checkedOn date.`);
    } else {
      const [year, month, day] = entry.checkedOn.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        errors.push(`${where} has a bad checkedOn date.`);
      }
    }
  }
  for (const sector of sectorsNeeded) {
    if (!seen.has(`jamaica:${sector}`)) errors.push(`Missing a Jamaica ${sector} guide.`);
  }
}

const blueprints = JSON.parse(readFileSync(new URL("../data/blueprints.json", import.meta.url), "utf8"));
const guideChecks = new Map();
for (const entry of guides.entries ?? []) {
  if (entry.countryId === "jamaica") guideChecks.set(entry.sector, new Set(entry.checks ?? []));
}

function shortLine(label, value, limit) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} needs text.`);
    return;
  }
  if (value.includes("\n")) errors.push(`${label} must be one line.`);
  if (value.length > limit) errors.push(`${label} is too long.`);
  if (hasMoneyTalk(value)) errors.push(`${label} mentions money.`);
}

if (!blueprints.sectors || typeof blueprints.sectors !== "object") {
  errors.push("blueprints.json needs a sectors object.");
} else {
  const seenIds = new Set();
  for (const sector of sectorsNeeded) {
    const kinds = blueprints.sectors[sector];
    if (!Array.isArray(kinds) || kinds.length < 2 || kinds.length > 4) {
      errors.push(`${sector} needs 2 to 4 kinds.`);
      continue;
    }
    const allowed = guideChecks.get(sector) ?? new Set();
    for (const kind of kinds) {
      const label = `${sector}:${kind?.id ?? "?"}`;
      if (typeof kind.id !== "string" || !/^[a-z0-9-]{1,40}$/.test(kind.id)) {
        errors.push(`${label} has a bad id.`);
      }
      if (seenIds.has(kind.id)) errors.push(`Duplicate kind ${kind.id}.`);
      seenIds.add(kind.id);
      shortLine(`${label} title`, kind.title, 60);
      shortLine(`${label} detail`, kind.detail, 140);
      shortLine(`${label} short need`, kind.shortNeed, 80);
      const title = String(kind.title ?? "").trim().replace(/\.+$/, "").toLowerCase();
      const detail = String(kind.detail ?? "").trim().replace(/\.+$/, "").toLowerCase();
      if (title && (detail === title || detail.startsWith(`${title} `))) {
        errors.push(`${label} detail repeats its title.`);
      }
      if (!(kind.needFirst ?? []).includes("A registered business name")) {
        errors.push(`${label} needs a registered business name.`);
      }
      if (!(kind.checks ?? []).includes("business-registration")) {
        errors.push(`${label} needs business registration.`);
      }
      if (sector === "energy" && !(kind.checks ?? []).includes("engineer")) {
        errors.push(`${label} needs an engineer check.`);
      }
      if (!Array.isArray(kind.needFirst) || kind.needFirst.length < 2 || kind.needFirst.length > 4) {
        errors.push(`${label} needs 2 to 4 needFirst lines.`);
      }
      for (const line of kind.needFirst ?? []) shortLine(`${label} need`, line, 140);
      if (!Array.isArray(kind.checks) || kind.checks.length < 1 || kind.checks.length > 6) {
        errors.push(`${label} needs checks.`);
      }
      const checkSet = new Set(kind.checks ?? []);
      if (checkSet.size !== (kind.checks ?? []).length) errors.push(`${label} repeats a check.`);
      for (const checkId of kind.checks ?? []) {
        if (!checkIds.has(checkId)) errors.push(`${label} has an unknown check.`);
        if (!allowed.has(checkId)) errors.push(`${label} uses a check the Jamaica guide does not list.`);
      }
      if (!Array.isArray(kind.team) || kind.team.length < 1 || kind.team.length > 4) {
        errors.push(`${label} needs a team.`);
      }
      const teamSkills = new Set();
      let minSum = 0;
      for (const band of kind.team ?? []) {
        if (!skillIds.has(band?.skill)) errors.push(`${label} has an unknown skill.`);
        if (teamSkills.has(band?.skill)) errors.push(`${label} repeats a skill.`);
        teamSkills.add(band?.skill);
        if (!Number.isInteger(band?.min) || !Number.isInteger(band?.max) || band.min < 1 || band.max < band.min || band.max > 10) {
          errors.push(`${label} has a bad count range.`);
        } else {
          minSum += band.min;
        }
      }
      if (minSum > 10) errors.push(`${label} suggests more than 10 people.`);
      if (!Array.isArray(kind.phases) || kind.phases.length < 3 || kind.phases.length > 4) {
        errors.push(`${label} needs 3 or 4 phases.`);
      }
      for (const phase of kind.phases ?? []) shortLine(`${label} phase`, phase, 40);
      if (!Array.isArray(kind.spend) || kind.spend.length < 1 || kind.spend.length > 6) {
        errors.push(`${label} needs spend categories.`);
      }
      const spendSet = new Set();
      for (const item of kind.spend ?? []) {
        shortLine(`${label} spend`, item, 24);
        if (spendSet.has(item)) errors.push(`${label} repeats a spend category.`);
        spendSet.add(item);
      }
      if (!Array.isArray(kind.noteHints) || kind.noteHints.length !== 3) {
        errors.push(`${label} needs 3 note hints.`);
      }
      for (const hint of kind.noteHints ?? []) shortLine(`${label} hint`, hint, 80);
    }
    const kindIds = new Set(kinds.map((kind) => kind?.id));
    const guide = (guides.entries ?? []).find(
      (entry) => entry.countryId === "jamaica" && entry.sector === sector,
    );
    for (const agency of guide?.agencies ?? []) {
      for (const id of agency.kindIds ?? []) {
        if (!kindIds.has(id)) errors.push(`${sector} agency names an unknown kind ${id}.`);
      }
    }
  }
  for (const sector of Object.keys(blueprints.sectors)) {
    if (!sectorsNeeded.includes(sector)) errors.push(`${sector} is not a real sector.`);
  }
}

const lessonsFile = JSON.parse(readFileSync(new URL("../data/lessons.json", import.meta.url), "utf8"));
const audiences = new Set(["investor", "organizer", "worker"]);
const moments = new Set(["investor-basics", "first-month", "running", "on-project", "grow-work"]);
const momentAudience = {
  "investor-basics": "investor",
  "first-month": "organizer",
  running: "organizer",
  "on-project": "worker",
  "grow-work": "worker",
};

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasPercentTalk(text) {
  return /\d\s*%|%\s*\d/.test(text);
}

function realDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function lessonLine(label, value, limit) {
  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${label} needs text.`);
    return;
  }
  if (value.includes("\n")) errors.push(`${label} must be one line.`);
  if (wordCount(value) > limit) errors.push(`${label} is too long.`);
  if (hasMoneyTalk(value) || hasPercentTalk(value)) {
    errors.push(`${label} has a price or a percent.`);
  }
}

if (!Array.isArray(lessonsFile.lessons) || lessonsFile.lessons.length === 0) {
  errors.push("lessons.json needs a lessons list.");
} else {
  const seenIds = new Set();
  const byMoment = new Map();
  for (const lesson of lessonsFile.lessons) {
    const label = lesson?.id ?? "a lesson";
    if (typeof lesson.id !== "string" || !lesson.id.trim()) errors.push("A lesson needs an id.");
    if (seenIds.has(lesson.id)) errors.push(`Duplicate lesson ${lesson.id}.`);
    seenIds.add(lesson.id);
    if (!audiences.has(lesson.audience)) errors.push(`${label} has an unknown audience.`);
    if (!moments.has(lesson.moment)) errors.push(`${label} has an unknown moment.`);
    if (momentAudience[lesson.moment] && lesson.audience !== momentAudience[lesson.moment]) {
      errors.push(`${label} is in the wrong audience for its moment.`);
    }
    if (lesson.sector !== undefined && !sectorsNeeded.includes(lesson.sector)) {
      errors.push(`${label} has an unknown sector.`);
    }
    if (lesson.moment === "running" && !sectorsNeeded.includes(lesson.sector)) {
      errors.push(`${label} needs a sector.`);
    }
    if (lesson.moment !== "running" && lesson.sector !== undefined) {
      errors.push(`${label} should not have a sector.`);
    }
    if (lesson.skill !== undefined && !skillIds.has(lesson.skill)) {
      errors.push(`${label} has an unknown skill.`);
    }
    if (lesson.skill !== undefined && lesson.moment !== "on-project") {
      errors.push(`${label} should not have a skill.`);
    }
    lessonLine(`${label} title`, lesson.title, 16);
    lessonLine(`${label} body`, lesson.body, 90);
    lessonLine(`${label} rule`, lesson.rule, 30);
    lessonLine(`${label} action`, lesson.action, 20);
    if (typeof lesson.checkedOn !== "string" || !realDate(lesson.checkedOn)) {
      errors.push(`${label} needs a checkedOn date.`);
    }
    const bucket = byMoment.get(lesson.moment) ?? [];
    bucket.push(lesson);
    byMoment.set(lesson.moment, bucket);
  }
  const basics = byMoment.get("investor-basics") ?? [];
  if (basics.length !== 5) errors.push("Investor basics needs five cards.");
  for (const id of ["investor-lose", "investor-sell", "investor-time", "investor-prices", "investor-spread"]) {
    if (!seenIds.has(id)) errors.push(`Missing lesson ${id}.`);
  }
  const firstMonth = byMoment.get("first-month") ?? [];
  if (firstMonth.length < 5) errors.push("The first month needs five cards.");
  const running = byMoment.get("running") ?? [];
  for (const sector of sectorsNeeded) {
    const count = running.filter((lesson) => lesson.sector === sector).length;
    const need = sector === "lodging" || sector === "agriculture" ? 6 : 4;
    if (count < need) errors.push(`${sector} needs ${need} running cards.`);
  }
  const onProject = byMoment.get("on-project") ?? [];
  for (const skill of skillIds) {
    if (!onProject.some((lesson) => lesson.skill === skill)) {
      errors.push(`Missing a safety card for ${skill}.`);
    }
  }
  const shared = onProject.filter((lesson) => !lesson.skill);
  if (!shared.some((lesson) => lesson.id === "worker-photo")) errors.push("Missing the daily photo card.");
  if (!shared.some((lesson) => lesson.id === "worker-units")) errors.push("Missing the units card.");
  const grow = byMoment.get("grow-work") ?? [];
  if (grow.length !== 1 || grow[0].id !== "grow-work") errors.push("Missing the grow-your-work card.");
}

const mentors = seed.projects.filter(
  (project) => project.countryId === "jamaica" && typeof project.mentorName === "string" && project.mentorName.trim(),
);
if (mentors.length < 2) errors.push("Two Jamaica projects need a mentor.");
for (const project of seed.projects) {
  if (project.mentorName === undefined || project.mentorName === null) continue;
  if (typeof project.mentorName !== "string" || !project.mentorName.trim() || project.mentorName.length > 80) {
    errors.push(`${project.id} has a bad mentor name.`);
  }
}

const rules = JSON.parse(readFileSync(new URL("../data/countries.json", import.meta.url), "utf8"));
const ruleStatuses = new Set(["open", "limited", "not-checked", "blocked"]);
const blockedIds = new Set();
const listableIds = new Set();
if (!Array.isArray(rules)) {
  errors.push("countries.json needs a list.");
} else {
  const seen = new Set();
  for (const rule of rules) {
    const id = typeof rule?.id === "string" ? rule.id : "?";
    if (seen.has(id)) errors.push(`Duplicate rule ${id}.`);
    seen.add(id);
    if (!ruleStatuses.has(rule?.status)) errors.push(`${id} has a bad status.`);
    if (rule?.status === "blocked") blockedIds.add(id);
    else if (ruleStatuses.has(rule?.status)) listableIds.add(id);
    const sources = Array.isArray(rule?.sources) ? rule.sources : null;
    if (!sources) errors.push(`${id} needs a sources list.`);
    const cryptoNote = typeof rule?.cryptoNote === "string" ? rule.cryptoNote : null;
    const investNote = typeof rule?.investNote === "string" ? rule.investNote : null;
    if (cryptoNote === null || investNote === null) errors.push(`${id} needs note fields.`);
    if ((cryptoNote && cryptoNote.includes("\n")) || (investNote && investNote.includes("\n"))) {
      errors.push(`${id} note must be one line.`);
    }
    const hasNote = Boolean(cryptoNote?.trim() || investNote?.trim());
    if (hasNote && (!sources || sources.length === 0)) errors.push(`${id} has a note without a source.`);
    if ((rule?.status === "open" || rule?.status === "limited") && (!sources || sources.length === 0)) {
      errors.push(`${id} needs a source.`);
    }
    for (const source of sources ?? []) {
      if (typeof source?.title !== "string" || !source.title.trim()) errors.push(`${id} source needs a title.`);
      if (typeof source?.url !== "string" || !/^https?:\/\//.test(source.url)) {
        errors.push(`${id} source needs a url.`);
      }
    }
    if (typeof rule?.checkedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rule.checkedOn)) {
      errors.push(`${id} needs a checkedOn date.`);
    }
  }
}

const regionsSrc = readFileSync(new URL("../src/lib/regions.ts", import.meta.url), "utf8");
const placesStart = regionsSrc.indexOf("const PLACES = [");
const placesEnd = regionsSrc.indexOf("] as const;", placesStart);
const placeIds = [...regionsSrc.slice(placesStart, placesEnd).matchAll(/id: "([a-z0-9-]+)"/g)].map(
  (match) => match[1],
);
if (placeIds.length === 0) errors.push("Could not read the place list.");
for (const id of placeIds) {
  if (!listableIds.has(id)) errors.push(`${id} is listed but is not an open, limited, or not-checked country.`);
}
for (const id of listableIds) {
  if (!placeIds.includes(id)) errors.push(`${id} is missing from the place list.`);
}
for (const country of seed.countries ?? []) {
  if (blockedIds.has(country.id)) errors.push(`${country.id} sits in a blocked country.`);
}
for (const project of seed.projects ?? []) {
  if (blockedIds.has(project.countryId)) errors.push(`${project.id} sits in a blocked country.`);
}
for (const request of seed.requests ?? []) {
  if (blockedIds.has(request.countryId)) errors.push(`${request.id} sits in a blocked country.`);
}
for (const user of seed.users ?? []) {
  if (blockedIds.has(user.countryId)) errors.push(`${user.id} sits in a blocked country.`);
}
for (const post of seed.availability ?? []) {
  if (blockedIds.has(post.countryId)) errors.push(`${post.id} sits in a blocked country.`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Seed ok: ${seed.parishes.length} parishes, ${seed.countries.length} countries, ${seed.projects.length} projects, ${seed.users.length} sample people, ${seed.requests.length} requests.`,
);
