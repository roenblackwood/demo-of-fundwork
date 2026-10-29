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

export function projectCommitted(
  baseJmd: number,
  extras: { projectId: string; amountJmd: number; status?: "pledged" | "accepted" }[],
  projectId: string,
): number {
  // Pledged money is still waiting on a capital check, so it stays out of this total.
  const extra = extras
    .filter((item) => item.projectId === projectId && item.status !== "pledged")
    .reduce((sum, item) => sum + item.amountJmd, 0);
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
