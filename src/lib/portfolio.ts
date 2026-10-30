import { openSlice, phasesFor } from "@/lib/capital";
import { sectorTitle } from "@/lib/catalog";
import { placeLine } from "@/lib/format";
import { investorUnits } from "@/lib/ownership";
import type { WeekPlan, WeekStatus } from "@/lib/progress";
import { USD_RATES, usdAmount } from "@/lib/rates";
import { currencyOf, getCountry, projectPlace } from "@/lib/seed";
import type { Application, Commitment, Payment, Project, TrancheStatus } from "@/lib/types";

const STALE_MS = 14 * 24 * 60 * 60 * 1000;

export type LocalAmount = { currency: string; amount: number };

export type MoneyTotal = {
  usd: number;
  local: LocalAmount[];
};

export type BarRow = { label: string; usd: number };

export type PortfolioRow = {
  projectId: string;
  name: string;
  place: string;
  country: string;
  sector: string;
  phase: string;
  tranche: TrancheStatus;
  pledgedUsd: number;
  pledgedLocal: number;
  confirmedUsd: number;
  confirmedLocal: number;
  wagesUsd: number;
  wagesLocal: number;
  btcConfirmed: number;
  btcWages: number;
  currency: string;
  readiness: string;
  week: string;
  warnings: string[];
};

export type ActivityItem = {
  id: string;
  time: number;
  at: string;
  text: string;
};

export type PortfolioView = {
  pledged: MoneyTotal;
  confirmed: MoneyTotal;
  units: number;
  btcConfirmed: number;
  barsFrom: "pledged" | "confirmed";
  countries: BarRow[];
  sectors: BarRow[];
  concentrated: boolean;
  rows: PortfolioRow[];
  activity: ActivityItem[];
};

type BuildInput = {
  userId: string;
  commitments: Commitment[];
  projects: Project[];
  payments: Payment[];
  weeks: WeekPlan[];
  applications: Application[];
  nameFor: (userId: string) => string;
  now: number;
};

function formatWhen(iso: string): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  return new Date(time).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : time;
}

export function formatUsd(amount: number): string {
  const text = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `US$${text}`;
}

function localFromUsd(usd: number, currency: string): number {
  const rate = USD_RATES[currency];
  if (!rate || !Number.isFinite(usd)) return 0;
  return usd * rate;
}

function weekWord(status: WeekStatus): string {
  if (status === "done") return "Done";
  if (status === "not-done") return "Not done";
  return "Open";
}

function countHave(record: Record<string, string> | null | undefined): { ready: number; total: number } | null {
  if (!record) return null;
  const keys = Object.keys(record);
  if (keys.length === 0) return null;
  return { ready: keys.filter((key) => record[key] === "have").length, total: keys.length };
}

export function readinessLine(project: Project): string {
  const fromChecks = {
    ready: project.checks.filter((check) => check.state === "yes").length,
    total: project.checks.length,
  };
  const now = countHave(project.readiness) ?? fromChecks;
  const then = countHave(project.phaseBaseline);
  if (then && then.total > 0 && then.total === now.total && then.ready !== now.ready) {
    return `Ready so far went from ${then.ready} of ${then.total} to ${now.ready} of ${now.total}.`;
  }
  if (now.total === 0) return "Ready so far is not listed.";
  return `Ready so far is ${now.ready} of ${now.total}.`;
}

function placeText(project: Project): string {
  const where = projectPlace(project);
  if (where) return placeLine(where.town, where.parish);
  return getCountry(project.countryId)?.name ?? "This place";
}

function trancheOf(project: Project, commitment: Commitment): { phase: string; status: TrancheStatus } {
  const phases = phasesFor(project);
  const slice = openSlice({
    amount: commitment.amountJmd,
    phases,
    openPhase: project.openPhase,
    shares: project.phaseShares,
    tranches: commitment.tranches,
  });
  const row = commitment.tranches?.find((item) => item.position === slice.position);
  return { phase: slice.phase, status: row?.status ?? "open" };
}

function groupBars(rows: { key: string; label: string; usd: number }[]): BarRow[] {
  const map = new Map<string, BarRow>();
  for (const row of rows) {
    const current = map.get(row.key);
    if (current) current.usd += row.usd;
    else map.set(row.key, { label: row.label, usd: row.usd });
  }
  return [...map.values()].sort((a, b) => b.usd - a.usd || a.label.localeCompare(b.label));
}

function localsFrom(rows: { currency: string; amount: number }[]): LocalAmount[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.currency, (map.get(row.currency) ?? 0) + row.amount);
  }
  return [...map.entries()].map(([currency, amount]) => ({ currency, amount }));
}

export function buildPortfolio(input: BuildInput): PortfolioView {
  const mine = input.commitments.filter((item) => item.userId === input.userId);
  const backed = new Set(mine.map((item) => item.projectId));
  const rows: PortfolioRow[] = [];
  const activity: ActivityItem[] = [];
  let units = 0;
  let btcConfirmed = 0;

  for (const commitment of mine) {
    const project = input.projects.find((item) => item.id === commitment.projectId);
    if (!project) continue;
    const currency = currencyOf(project.countryId);
    const pledgedUsd = usdAmount(commitment.amountJmd, currency) ?? 0;
    const capital = input.payments.filter(
      (payment) => payment.commitmentId === commitment.id && payment.kind === "capital-in",
    );
    const confirmedUsd = capital
      .filter((payment) => payment.status === "confirmed" && payment.asset === "USDC")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const rowBtc = capital
      .filter((payment) => payment.status === "confirmed" && payment.asset === "BTC")
      .reduce((sum, payment) => sum + payment.amount, 0);
    btcConfirmed += rowBtc;
    const confirmedLocal = localFromUsd(confirmedUsd, currency);
    units += investorUnits(confirmedLocal, project.goalJmd);
    const wages = input.payments.filter(
      (payment) => payment.projectId === project.id && payment.kind === "pay-out" && payment.status === "confirmed",
    );
    const wagesUsd = wages.filter((payment) => payment.asset === "USDC").reduce((sum, payment) => sum + payment.amount, 0);
    const btcWages = wages.filter((payment) => payment.asset === "BTC").reduce((sum, payment) => sum + payment.amount, 0);
    const tranche = trancheOf(project, commitment);
    const times: number[] = [];
    const created = parseTime(commitment.createdAt);
    if (created !== null) times.push(created);
    for (const payment of input.payments) {
      if (payment.commitmentId !== commitment.id && payment.projectId !== project.id) continue;
      const time = parseTime(payment.checkedAt) ?? parseTime(payment.createdAt);
      if (time !== null) times.push(time);
    }
    for (const week of input.weeks) {
      if (week.projectId !== project.id) continue;
      const time = parseTime(week.createdAt);
      if (time !== null) times.push(time);
    }
    const newest = times.length > 0 ? Math.max(...times) : null;
    const warnings: string[] = [];
    if (newest !== null && input.now - newest > STALE_MS) warnings.push("No update in 14 days");
    if (capital.some((payment) => payment.status === "mismatch")) warnings.push("A payment did not match");
    if (tranche.status === "waiting") warnings.push("Phase waiting on the organizer");
    const latestWeek = input.weeks
      .filter((week) => week.projectId === project.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    rows.push({
      projectId: project.id,
      name: project.name,
      place: placeText(project),
      country: getCountry(project.countryId)?.name ?? "This country",
      sector: sectorTitle(project.sector),
      phase: tranche.phase,
      tranche: tranche.status,
      pledgedUsd,
      pledgedLocal: commitment.amountJmd,
      confirmedUsd,
      confirmedLocal,
      wagesUsd,
      wagesLocal: localFromUsd(wagesUsd, currency),
      btcConfirmed: rowBtc,
      btcWages,
      currency,
      readiness: readinessLine(project),
      week: latestWeek ? `This week: ${latestWeek.goal}. ${weekWord(latestWeek.status)}.` : "No This week goal yet.",
      warnings,
    });
  }

  for (const payment of input.payments) {
    if (!backed.has(payment.projectId) || payment.status !== "confirmed") continue;
    const project = input.projects.find((item) => item.id === payment.projectId);
    if (!project) continue;
    const time = parseTime(payment.checkedAt) ?? parseTime(payment.createdAt);
    if (time === null) continue;
    const kind = payment.kind === "pay-out" ? "Wages confirmed" : "Payment confirmed";
    activity.push({
      id: `payment-${payment.id}`,
      time,
      at: formatWhen(payment.checkedAt || payment.createdAt),
      text: `${kind} on ${project.name}. ${payment.amount} ${payment.asset}.`,
    });
  }

  for (const week of input.weeks) {
    if (!backed.has(week.projectId)) continue;
    const project = input.projects.find((item) => item.id === week.projectId);
    if (!project) continue;
    const time = parseTime(week.createdAt);
    if (time === null) continue;
    activity.push({
      id: `week-${week.id}`,
      time,
      at: formatWhen(week.createdAt),
      text: `This week goal on ${project.name}: ${week.goal}. Status: ${weekWord(week.status)}.`,
    });
  }

  for (const application of input.applications) {
    if (application.status !== "accepted" || !application.projectId || !backed.has(application.projectId)) continue;
    const project = input.projects.find((item) => item.id === application.projectId);
    if (!project) continue;
    const time = parseTime(application.createdAt);
    if (time === null) continue;
    const person = input.nameFor(application.workerId).trim() || "A worker";
    activity.push({
      id: `team-${application.id}`,
      time,
      at: formatWhen(application.createdAt),
      text: `Team change on ${project.name}. ${person} is accepted.`,
    });
  }

  activity.sort((a, b) => b.time - a.time || a.id.localeCompare(b.id));

  const confirmedUsd = rows.reduce((sum, row) => sum + row.confirmedUsd, 0);
  const useConfirmed = confirmedUsd > 0;
  const topConfirmed = rows.reduce((top, row) => Math.max(top, row.confirmedUsd), 0);
  const barUsd = (row: PortfolioRow) => (useConfirmed ? row.confirmedUsd : row.pledgedUsd);

  return {
    pledged: {
      usd: rows.reduce((sum, row) => sum + row.pledgedUsd, 0),
      local: localsFrom(rows.map((row) => ({ currency: row.currency, amount: row.pledgedLocal }))),
    },
    confirmed: {
      usd: confirmedUsd,
      local: localsFrom(rows.map((row) => ({ currency: row.currency, amount: row.confirmedLocal }))),
    },
    units,
    btcConfirmed,
    barsFrom: useConfirmed ? "confirmed" : "pledged",
    countries: groupBars(rows.map((row) => ({ key: row.country, label: row.country, usd: barUsd(row) }))),
    sectors: groupBars(rows.map((row) => ({ key: row.sector, label: row.sector, usd: barUsd(row) }))),
    concentrated: confirmedUsd > 0 && topConfirmed > confirmedUsd / 2,
    rows,
    activity,
  };
}
