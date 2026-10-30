/**
 * Pure scores for For you lists.
 * Payout forecasts are not part of this score.
 */

export type ReachId = "town" | "parish" | "country" | "region";

export type LevelId = "learning" | "experienced" | "can-lead";

export type ScorePart = {
  label: string;
  text: string;
};

export type Score = {
  score: number;
  reasons: string[];
  parts: ScorePart[];
};

export type WorkItem = {
  id: string;
  sector: string;
  sectorLabel: string;
  kindId: string | null;
  countryId: string;
  parishId: string | null;
  townId: string;
  regionId: string;
  place: string;
  skills: { id: string; phrase: string }[];
  openSpots: number;
  readiness: number;
  createdAt: string;
  stillNeededUsd: number | null;
  confirmedIn: boolean;
  fundedRatio: number;
  /** Set on an open request that still has room. Absent on other items. */
  pledgeLeft?: string | null;
};

export type WorkerView = {
  reach: ReachId;
  countryId: string;
  parishId: string | null;
  townId: string;
  regionId: string;
  skills: { id: string; level: LevelId; phrase: string }[];
  seeEverywhere: boolean;
};

export type InvestorView = {
  sectors: string[];
  kinds: string[];
  places: string[];
  minUsd: number;
  maxUsd: number;
};

export type Ranked = {
  id: string;
  sector: string;
  score: number;
  createdAt: string;
};

const FRESH_MS = 14 * 24 * 60 * 60 * 1000;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function placedAt(createdAt: string): number | null {
  if (!createdAt) return null;
  const stamp = createdAt.length === 10 ? `${createdAt}T00:00:00.000Z` : createdAt;
  const time = Date.parse(stamp);
  return Number.isFinite(time) ? time : null;
}

export function isFresh(createdAt: string, nowMs: number): boolean {
  const time = placedAt(createdAt);
  if (time === null) return false;
  const age = nowMs - time;
  return age >= 0 && age <= FRESH_MS;
}

export function inReach(
  view: Pick<WorkerView, "reach" | "countryId" | "parishId" | "townId" | "regionId">,
  item: Pick<WorkItem, "countryId" | "parishId" | "townId" | "regionId">,
): boolean {
  if (!view.countryId) return false;
  if (view.reach === "town") {
    return (
      item.countryId === view.countryId &&
      item.townId === view.townId &&
      (item.parishId ?? null) === (view.parishId ?? null)
    );
  }
  if (view.reach === "parish") {
    if (view.parishId) return item.countryId === view.countryId && item.parishId === view.parishId;
    return item.countryId === view.countryId && item.townId === view.townId;
  }
  if (view.reach === "country") return item.countryId === view.countryId;
  return view.regionId !== "" && item.regionId === view.regionId;
}

function reachText(view: WorkerView): string {
  if (view.reach === "town") return "This is in your town.";
  if (view.reach === "parish") return view.parishId ? "This is in your parish." : "This is in your city.";
  if (view.reach === "country") return "This is in your country.";
  return "This is in your region.";
}

function skillFit(view: WorkerView, item: WorkItem): { points: number; phrase: string; level: LevelId | null } {
  let points = 0;
  let phrase = "";
  let level: LevelId | null = null;
  for (const need of item.skills) {
    const mine = view.skills.find((skill) => skill.id === need.id);
    if (!mine) continue;
    const next = mine.level === "can-lead" ? 30 : mine.level === "experienced" ? 24 : 18;
    if (next > points) {
      points = next;
      phrase = need.phrase;
      level = mine.level;
    }
  }
  return { points, phrase, level };
}

function levelText(level: LevelId | null, phrase: string): string {
  if (level === "can-lead") return `It needs ${phrase}, and you can lead it.`;
  if (level === "experienced") return `It needs ${phrase}, and your level fits.`;
  return `It needs ${phrase}. You are learning this.`;
}

function spotText(openSpots: number): string {
  if (openSpots === 1) return "1 spot is open.";
  return `${openSpots} spots are open.`;
}

function takeTwo(lines: string[]): string[] {
  return lines.filter(Boolean).slice(0, 2);
}

export function scoreForWorker(item: WorkItem, view: WorkerView, nowMs: number, sectorDown = 0): Score {
  if (!inReach(view, item) && !view.seeEverywhere) {
    return { score: 0, reasons: [], parts: [] };
  }
  const distance = inReach(view, item) ? 35 : 0;
  const skill = skillFit(view, item);
  const spots = item.openSpots > 0 ? 15 : 0;
  const ready = Math.round(clamp01(item.readiness) * 10);
  const recent = isFresh(item.createdAt, nowMs) ? 10 : 0;
  const parts: ScorePart[] = [];
  if (distance > 0) parts.push({ label: "Distance", text: reachText(view) });
  else parts.push({ label: "Distance", text: "This is outside your reach. You asked to see everywhere." });
  if (skill.points > 0 && skill.phrase) parts.push({ label: "Skill", text: levelText(skill.level, skill.phrase) });
  if (spots > 0) parts.push({ label: "Open spots", text: spotText(item.openSpots) });
  if (ready > 0) parts.push({ label: "Readiness", text: "Some of the plan is already in place." });
  if (recent > 0) parts.push({ label: "Recency", text: "It was posted in the last two weeks." });
  const reasons = takeTwo([
    skill.phrase && item.place ? `Needs ${skill.phrase} in ${item.place}` : "",
    skill.level === "experienced" || skill.level === "can-lead" ? "Your level fits" : "",
    spots > 0 ? spotText(item.openSpots).replace(/\.$/, "") : "",
    recent > 0 ? "Posted in the last two weeks" : "",
    ready > 0 ? "The plan is moving" : "",
  ]);
  return {
    score: clamp(distance + skill.points + spots + ready + recent - sectorDown),
    reasons,
    parts,
  };
}

export function scoreForInvestor(item: WorkItem, view: InvestorView, nowMs: number, sectorDown = 0): Score {
  const interest =
    view.sectors.includes(item.sector) || (item.kindId !== null && view.kinds.includes(item.kindId)) ? 30 : 0;
  const amount =
    view.minUsd > 0 && item.stillNeededUsd !== null && item.stillNeededUsd >= view.minUsd ? 20 : 0;
  const anywhere = view.places.includes("anywhere");
  const place =
    anywhere || view.places.includes(item.countryId) || (item.regionId !== "" && view.places.includes(item.regionId))
      ? 15
      : 0;
  const ready = Math.round(clamp01(item.readiness) * 15);
  const confirmed = item.confirmedIn ? 10 : 0;
  const momentum = Math.round(clamp01(item.fundedRatio) * 10);
  const recent = isFresh(item.createdAt, nowMs);
  const parts: ScorePart[] = [];
  if (interest > 0) parts.push({ label: "Interest", text: `It matches ${item.sectorLabel}.` });
  if (amount > 0) parts.push({ label: "Amount", text: "The amount still needed is at least your minimum." });
  if (place > 0) {
    parts.push({
      label: "Place",
      text: anywhere ? "You are open to anywhere." : "It is in a place you chose.",
    });
  }
  if (ready > 0) parts.push({ label: "Readiness", text: "Some of the plan is already in place." });
  if (confirmed > 0) parts.push({ label: "Money in", text: "Some money is already confirmed." });
  if (momentum > 0) parts.push({ label: "Momentum", text: "It is moving toward the full amount." });
  if (recent) parts.push({ label: "Recency", text: "It was posted in the last two weeks." });
  const reasons = takeTwo([
    amount > 0 && item.pledgeLeft ? item.pledgeLeft : "",
    interest > 0 ? `Matches ${item.sectorLabel}` : "",
    amount > 0 && !item.pledgeLeft ? "The amount still needed fits your range" : "",
    !anywhere && place > 0 ? "In a place you chose" : "",
    confirmed > 0 ? "Some money is already in" : "",
    ready > 0 ? "The plan is moving" : "",
    momentum > 0 ? "Moving toward the full amount" : "",
  ]);
  return {
    score: clamp(interest + amount + place + ready + confirmed + momentum - sectorDown),
    reasons,
    parts,
  };
}

function canPlace(rows: Ranked[], sector: string): boolean {
  const count = rows.length;
  if (count < 2) return true;
  return !(rows[count - 1].sector === sector && rows[count - 2].sector === sector);
}

function mixFresh<T extends Ranked>(ranked: T[], nowMs: number): T[] {
  const fresh = ranked.filter((row) => isFresh(row.createdAt, nowMs));
  const used = new Set<string>();
  const out: T[] = [];
  let cursor = 0;
  let freshIndex = 0;
  while (out.length < ranked.length) {
    if (out.length % 5 === 4) {
      while (freshIndex < fresh.length && used.has(fresh[freshIndex].id)) freshIndex += 1;
      if (freshIndex < fresh.length) {
        const pick = fresh[freshIndex];
        freshIndex += 1;
        used.add(pick.id);
        out.push(pick);
        continue;
      }
    }
    while (cursor < ranked.length && used.has(ranked[cursor].id)) cursor += 1;
    if (cursor >= ranked.length) break;
    used.add(ranked[cursor].id);
    out.push(ranked[cursor]);
    cursor += 1;
  }
  return out;
}

function capSectors<T extends Ranked>(rows: T[]): T[] {
  const wait: T[] = [];
  const out: T[] = [];
  function drain() {
    let moved = true;
    while (moved) {
      moved = false;
      for (let index = 0; index < wait.length; index += 1) {
        if (!canPlace(out, wait[index].sector)) continue;
        out.push(wait[index]);
        wait.splice(index, 1);
        moved = true;
        break;
      }
    }
  }
  for (const row of rows) {
    if (!canPlace(out, row.sector)) {
      wait.push(row);
      continue;
    }
    out.push(row);
    drain();
  }
  let guard = wait.length * wait.length + 1;
  while (wait.length > 0 && guard > 0) {
    guard -= 1;
    const row = wait.shift();
    if (!row) break;
    if (canPlace(out, row.sector)) {
      out.push(row);
      drain();
      continue;
    }
    if (wait.every((item) => !canPlace(out, item.sector)) && !canPlace(out, row.sector)) {
      out.push(row, ...wait);
      wait.length = 0;
      break;
    }
    wait.push(row);
  }
  return out;
}

/** One fresh item in every five slots, then no more than two of one sector in a row. */
export function orderForYou<T extends Ranked>(rows: T[], nowMs: number): T[] {
  const ranked = [...rows].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return capSectors(mixFresh(ranked, nowMs));
}
