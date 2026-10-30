import type { WorkPreset } from "@/lib/types";

/**
 * Demo ownership pool. These ratios are a Fundwork display rule so the
 * screen can show a simple split. They are not LaunchLine's ownership cap.
 * Accepted records are the ones a later LaunchLine connection would write.
 */
export const TOTAL_UNITS = 10_000;
export const PLATFORM_UNITS = 1_000;
export const INVESTOR_UNITS = 5_500;
export const WORKER_UNITS = 3_500;

export function investorUnits(amountJmd: number, goalJmd: number): number {
  if (goalJmd <= 0 || amountJmd <= 0) return 0;
  return Math.round((amountJmd / goalJmd) * INVESTOR_UNITS);
}

export function workerUnits(preset: WorkPreset): number {
  if (preset === "day") return 8;
  if (preset === "few") return 24;
  return 40;
}

export function moneyStillOpen(goalJmd: number, committedJmd: number): number {
  return Math.max(0, goalJmd - committedJmd);
}

type CountedMoney = {
  projectId: string;
  amountJmd: number;
  status?: "pledged" | "accepted";
  countsAt?: string | null;
  tranches?: { amount: number; status: string }[] | null;
};

function countsNow(countsAt: string | null | undefined, now: number): boolean {
  if (!countsAt) return true;
  const time = Date.parse(countsAt);
  return Number.isNaN(time) || time <= now;
}

/** Confirmed phase amounts only. Waiting and open phases stay out. */
export function confirmedTrancheTotal(
  tranches: { amount: number; status: string }[] | null | undefined,
): number {
  return (tranches ?? []).reduce((sum, row) => (row.status === "confirmed" ? sum + row.amount : sum), 0);
}

export function projectCommitted(baseJmd: number, extras: CountedMoney[], projectId: string): number {
  // A pledged commitment counts only its confirmed phases, and only after countsAt.
  // Once it is accepted, the full amount counts and the phases are not added again.
  const now = Date.now();
  const extra = extras.reduce((sum, item) => {
    if (item.projectId !== projectId || !countsNow(item.countsAt, now)) return sum;
    if (item.status === "pledged") return sum + confirmedTrancheTotal(item.tranches);
    return sum + item.amountJmd;
  }, 0);
  return baseJmd + extra;
}

export type FundingLabel = "Open" | "Almost funded" | "Money is in" | "Work has started";

export function fundingLabels(
  committedJmd: number,
  goalJmd: number,
  workStarted: boolean,
): FundingLabel[] {
  const ratio = goalJmd <= 0 ? 0 : committedJmd / goalJmd;
  const labels: FundingLabel[] = [];
  if (workStarted) labels.push("Work has started");
  if (ratio >= 1) labels.push("Money is in");
  else if (ratio >= 0.75) labels.push("Almost funded");
  else if (!workStarted) labels.push("Open");
  return labels;
}
