import { skillPhrase, skillTitle, skillTools } from "@/lib/catalog";
import { genericCheckIds, genericTeam, guideFor, priceRange, uncheckedNote } from "@/lib/guides";
import { money } from "@/lib/format";
import { currencyOf } from "@/lib/seed";
import type { AiNote, CheckId, CheckState, Project, Sector, Skill } from "@/lib/types";

/**
 * Mocked plain-language notes.
 *
 * The UI calls these functions instead of a chatbot. Each one returns a short
 * title and body. A later server-side swap can call https://api.x.ai/v1 with
 * XAI_API_KEY and keep this same return shape. Do not put that key in the browser.
 */

export function projectNote(project: Project): AiNote {
  return { title: "In short", body: project.summary };
}

export function proofTip(skill: Skill): AiNote {
  const tips: Record<Skill, string> = {
    building: "Add a photo of recent work, like a finished wall, roof, or room.",
    farming: "Add a photo of recent work, like a planted row, a harvest, or a pen.",
    cooking: "Add a photo of a meal you prepared, or the kitchen you work in.",
    "guest-house": "Add a photo of a room you set up, or a place you look after.",
    front: "Add a photo of you welcoming guests, if you are comfortable sharing one.",
    power: "Add a photo of a panel, a battery, or a finished install.",
    water: "Add a photo of a pump, a tank, or a finished tap.",
    internet: "Add a photo of a hub, a mast, or a room you set up.",
    teaching: "Add a photo of a classroom you worked on, if you are comfortable sharing one.",
    care: "Add a photo of a clinic room or a cold box you look after, if you are comfortable sharing one.",
  };
  return { title: "A photo helps", body: tips[skill] };
}

export function matchNote(input: {
  project: Project;
  skill: Skill;
  askedTown: string;
  askedParish: string;
  projectTown: string;
  projectParish: string;
}): AiNote {
  const work = skillPhrase(input.skill);
  if (input.project.townId && input.projectTown === input.askedTown && input.projectParish === input.askedParish) {
    return {
      title: "Why this fits",
      body: `They need ${work} in ${input.projectTown}, and that is the work you picked.`,
    };
  }
  if (input.projectParish === input.askedParish) {
    return {
      title: "Why this fits",
      body: `They need ${work} in ${input.projectTown}, which is also in ${input.projectParish}.`,
    };
  }
  return {
    title: "Why this fits",
    body: `They need ${work} in ${input.projectTown}, ${input.projectParish}.`,
  };
}

const checkLabels: Record<CheckId, Record<CheckState, string>> = {
  organizer: {
    yes: "Organizer checked",
    review: "Organizer in review",
    open: "Organizer not checked",
  },
  jtb: {
    yes: "Tourist licence",
    review: "Tourist licence in review",
    open: "Tourist licence still open",
  },
  "site-visit": {
    yes: "Site visit done",
    review: "Site visit in review",
    open: "Site visit still open",
  },
  "parish-letter": {
    yes: "Parish letter",
    review: "Parish letter in review",
    open: "Parish letter still open",
  },
  rada: {
    yes: "Farm papers",
    review: "Farm papers in review",
    open: "Farm papers still open",
  },
  "public-health": {
    yes: "Health check done",
    review: "Health check in review",
    open: "Health check still open",
  },
  engineer: {
    yes: "Engineer visit",
    review: "Engineer visit in review",
    open: "Engineer visit still open",
  },
  community: {
    yes: "Community letter",
    review: "Community letter in review",
    open: "Community letter still open",
  },
};

export function checkLabel(id: CheckId, state: CheckState): string {
  return checkLabels[id][state];
}

export function checkNote(id: CheckId, state: CheckState): AiNote | null {
  if (id === "jtb" && state === "yes") {
    return {
      title: "What a JTB licence means",
      body: "A JTB licence means the Jamaica Tourist Board has registered this place to host visitors. It is a public check that the lodging is allowed to operate.",
    };
  }
  if (id === "jtb") {
    return {
      title: "What a JTB licence means",
      body: "A JTB licence means the Jamaica Tourist Board has registered a place to host visitors. This project's licence is still being checked, so that step is not finished.",
    };
  }
  if (id === "rada" && state === "yes") {
    return {
      title: "What farm papers mean",
      body: "Farm papers mean this farm is registered with RADA, the Rural Agricultural Development Authority.",
    };
  }
  if (id === "rada") {
    return {
      title: "What farm papers mean",
      body: "Farm papers mean a farm is registered with RADA, the Rural Agricultural Development Authority. This project's papers are not finished yet.",
    };
  }
  if (id === "parish-letter" && state === "yes") {
    return {
      title: "What a parish letter means",
      body: "A parish letter means the parish council knows about this project.",
    };
  }
  if (id === "parish-letter") {
    return {
      title: "What a parish letter means",
      body: "A parish letter means the parish council knows about a project. This letter is not finished yet.",
    };
  }
  if (id === "public-health") {
    return {
      title: "What the health check means",
      body: "A public health check looks at food safety. For this dairy, that check is still open, so it is not finished.",
    };
  }
  if (id === "engineer") {
    return {
      title: "What an engineer visit means",
      body:
        state === "yes"
          ? "An engineer visit means someone who knows the work has looked at the site."
          : "An engineer visit means someone who knows the work looks at the site. This visit is not finished yet.",
    };
  }
  if (id === "community") {
    return {
      title: "What a community letter means",
      body:
        state === "yes"
          ? "A community letter means people who live there have said this project should go ahead."
          : "A community letter means people who live there say the project should go ahead. This letter is not finished yet.",
    };
  }
  return null;
}

export type GuideCheck = {
  label: string;
  agency: string;
  why: string;
};

export type StarterGuide = {
  title: string;
  summary: string;
  checks: GuideCheck[];
  firstSteps: string[];
  team: string[];
  costLine: string | null;
  draftNote: string;
  sourceNote: string;
};

export type WorkerGuide = {
  title: string;
  summary: string;
  skills: string[];
  tools: string[];
  weekLine: string;
  standOut: string[];
  draftMessage: string;
  draftNote: string;
};

export type StarterInput = {
  countryId: string;
  countryName: string;
  sector: Sector;
  placeName: string;
  /** Seed plus session on the client. Omitted on the server, which sees the seed only. */
  projects?: Project[];
};

export type WorkerInput = {
  countryId: string;
  countryName: string;
  sector: Sector;
  placeName: string;
  skills: Skill[];
  weekly: number;
  currency: string;
  forProject: boolean;
};

export const guideLabels: Record<CheckId, string> = {
  organizer: "Organizer",
  jtb: "Tourist licence",
  "site-visit": "Site visit",
  "parish-letter": "Parish letter",
  rada: "Farm papers",
  "public-health": "Public health inspection",
  engineer: "Local specialist",
  community: "Local council",
};

const genericRows: Partial<Record<CheckId, { agency: string; why: string }>> = {
  organizer: { agency: "You", why: "You are the person starting this." },
  engineer: {
    agency: "A local specialist",
    why: "Ask someone who knows this work to look at the site.",
  },
  community: {
    agency: "The local council",
    why: "Ask the local council before you build.",
  },
};

const sectorNoun: Record<Sector, string> = {
  lodging: "a place to stay",
  agriculture: "a farm",
  energy: "a power project",
  water: "a water project",
  connectivity: "an internet link",
  education: "a school",
  healthcare: "a clinic",
};

const standOutTips = [
  "Name the skill you will do and where you did it.",
  "Say which days you can reach this place.",
];

function joinPhrases(skills: Skill[]): string {
  const phrases = skills.map((skill) => skillPhrase(skill));
  if (phrases.length === 0) return "this work";
  if (phrases.length === 1) return phrases[0] ?? "this work";
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

function costLineFor(input: StarterInput): string | null {
  const range = priceRange(input.countryId, input.sector, input.projects);
  if (!range) return null;
  const currency = currencyOf(input.countryId);
  return `Other projects like this on Fundwork asked for ${money(range.low, currency)} to ${money(range.high, currency)}.`;
}

/** Template guide. No network. Demo mode always uses this. */
export function starterGuide(input: StarterInput): StarterGuide {
  const entry = guideFor(input.countryId, input.sector);
  const noun = sectorNoun[input.sector];
  const summary = entry
    ? `Starting ${noun} in ${input.placeName} needs the checks below before you spend money. Ask each office on the list.`
    : `Starting ${noun} in ${input.placeName} still needs a local look. Use the steps below, then ask the local council.`;
  if (!entry) {
    const note = uncheckedNote(input.countryName);
    const checks = genericCheckIds(input.sector).flatMap((id) => {
      const row = genericRows[id];
      if (!row) return [];
      return [{ label: guideLabels[id], agency: row.agency, why: row.why }];
    });
    return {
      title: "What it takes",
      summary,
      checks,
      firstSteps: [
        "Ask the local council.",
        "Ask someone who knows the work to look at the site.",
        "Write down what you want to build before you spend money.",
      ],
      team: genericTeam(input.sector).map((skill) => skillTitle(skill)),
      costLine: costLineFor(input),
      draftNote: note,
      sourceNote: note,
    };
  }
  const checks = entry.checks.map((id) => {
    const agency = entry.agencies.find((item) => item.checkId === id);
    return {
      label: guideLabels[id],
      agency: agency?.name ?? "",
      why: agency?.does ?? "",
    };
  });
  const firstAgency = checks[0]?.agency || "the local office";
  return {
    title: "What it takes",
    summary,
    checks,
    firstSteps: [...entry.firstSteps],
    team: entry.team.map((skill) => skillTitle(skill)),
    costLine: costLineFor(input),
    draftNote: `Draft. Check with ${firstAgency} before you spend money.`,
    sourceNote: entry.sourceNote,
  };
}

/** Template guide for a worker. No network. Demo mode always uses this. */
export function workerGuide(input: WorkerInput): WorkerGuide {
  const work = joinPhrases(input.skills);
  const ask = input.forProject ? "ask to join" : "apply";
  const draft = `I can do ${work} in ${input.placeName}. I have done this kind of work before.`;
  return {
    title: input.forProject ? "Before you ask to join" : "Before you apply",
    summary: `This ${input.forProject ? "project" : "request"} needs ${work} in ${input.placeName}. Say what you have done before you ${ask}.`,
    skills: input.skills.map((skill) => skillTitle(skill)),
    tools: input.skills.map((skill) => skillTools(skill)),
    weekLine: `Weekly pay is ${money(input.weekly, input.currency)}, in a stable unit.`,
    standOut: [...standOutTips],
    draftMessage: draft.length <= 200 ? draft : draft.slice(0, 200),
    draftNote: "Draft. Change it to sound like you.",
  };
}

const STARTER_KEYS = [
  "title",
  "summary",
  "checks",
  "firstSteps",
  "team",
  "costLine",
  "draftNote",
  "sourceNote",
] as const;

const WORKER_KEYS = [
  "title",
  "summary",
  "skills",
  "tools",
  "weekLine",
  "standOut",
  "draftMessage",
  "draftNote",
] as const;

const HYPE =
  /\b(unlock|seamless|empower|revolutionary|game-changer|game changer|best-in-class|best in class|amazing|incredible)\b/i;

const BLOCKED =
  /\b(shares|stock|verified capital|capital is verified|legal advice|investment advice)\b/i;

export function sentenceCount(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function sameKeys(value: object, keys: readonly string[]): boolean {
  const found = Object.keys(value);
  return found.length === keys.length && keys.every((key) => found.includes(key));
}

function sameStrings(left: string[], right: unknown): boolean {
  return Array.isArray(right) && right.length === left.length && left.every((item, index) => right[index] === item);
}

function digitsOk(template: unknown, output: unknown): boolean {
  const allowed = new Set(JSON.stringify(template).match(/\d+/g) ?? []);
  const used = JSON.stringify(output).match(/\d+/g) ?? [];
  return used.every((run) => allowed.has(run));
}

function voiceOk(templateText: string, outputText: string): boolean {
  if (outputText.includes("\u2014") || outputText.includes("\u2013")) return false;
  if (HYPE.test(outputText) && !HYPE.test(templateText)) return false;
  if (BLOCKED.test(outputText) && !BLOCKED.test(templateText)) return false;
  return true;
}

function proseOk(text: unknown, maxSentences: number): text is string {
  return typeof text === "string" && text.trim().length > 0 && sentenceCount(text) <= maxSentences;
}

/**
 * Keep a model rewrite only when it preserves the facts in the template.
 * Summary, why lines, stand-out tips, and the draft message may change words.
 */
export function acceptGuideRewrite<T extends StarterGuide | WorkerGuide>(
  template: T,
  output: unknown,
): T | null {
  if (!output || typeof output !== "object" || Array.isArray(output)) return null;
  const row = output as Record<string, unknown>;
  const templateText = JSON.stringify(template);
  const outputText = JSON.stringify(output);
  if (!voiceOk(templateText, outputText) || !digitsOk(template, output)) return null;
  if (!proseOk(row.summary, 2)) return null;

  if ("checks" in template) {
    if (!sameKeys(row, STARTER_KEYS)) return null;
    const starter = template as StarterGuide;
    if (!Array.isArray(row.checks) || row.checks.length !== starter.checks.length) return null;
    for (let index = 0; index < starter.checks.length; index += 1) {
      const check = row.checks[index];
      const original = starter.checks[index];
      if (!check || typeof check !== "object") return null;
      const item = check as Record<string, unknown>;
      if (item.label !== original?.label || item.agency !== original?.agency) return null;
      if (!proseOk(item.why, 2)) return null;
      if (Object.keys(item).length !== 3) return null;
    }
    if (!sameStrings(starter.firstSteps, row.firstSteps)) return null;
    if (!sameStrings(starter.team, row.team)) return null;
    if (row.costLine !== starter.costLine) return null;
    if (row.title !== starter.title || row.draftNote !== starter.draftNote || row.sourceNote !== starter.sourceNote) {
      return null;
    }
    return output as T;
  }

  if (!sameKeys(row, WORKER_KEYS)) return null;
  const worker = template as WorkerGuide;
  if (!sameStrings(worker.skills, row.skills) || !sameStrings(worker.tools, row.tools)) return null;
  if (row.weekLine !== worker.weekLine || row.title !== worker.title || row.draftNote !== worker.draftNote) {
    return null;
  }
  if (!Array.isArray(row.standOut) || row.standOut.length !== 2) return null;
  if (!row.standOut.every((tip) => proseOk(tip, 2))) return null;
  if (typeof row.draftMessage !== "string" || row.draftMessage.trim().length === 0 || row.draftMessage.length > 200) {
    return null;
  }
  return output as T;
}

