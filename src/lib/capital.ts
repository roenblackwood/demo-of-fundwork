import { kindsFor, phaseNames } from "@/lib/blueprints";
import type { Readiness, Sector, Tranche } from "@/lib/types";

export type Slice = {
  phase: string;
  position: number;
  amount: number;
};

/** Blueprint phases, or the first kind in the sector when the project has no kind yet. */
export function defaultPhases(sector: Sector, kindId: string | null | undefined): string[] {
  const named = phaseNames(sector, kindId);
  if (named.length > 0) return named;
  const first = kindsFor(sector)[0];
  if (first && first.phases.length > 0) return [...first.phases];
  return ["Start"];
}

export function phasesFor(project: {
  sector: Sector;
  kind?: string | null;
  phases?: string[] | null;
}): string[] {
  const stored = (project.phases ?? []).map((phase) => phase.trim()).filter(Boolean);
  if (stored.length > 0) return stored;
  return defaultPhases(project.sector, project.kind);
}

/**
 * 40 percent on the first phase, then the rest split evenly.
 * The last phase takes the leftover so the parts add up to the pledge.
 * A pledge that is too small to split stays on the first phase.
 */
export function splitPledge(amount: number, phases: string[]): Slice[] {
  const names = phases.length > 0 ? phases : ["Start"];
  const total = Math.round(amount);
  const count = names.length;
  const only = [{ phase: names[0] ?? "Start", position: 0, amount: Math.max(total, 0) }];
  if (count < 2 || total <= 0) return only;
  const first = Math.floor(total * 0.4);
  const rest = total - first;
  const each = Math.floor(rest / (count - 1));
  if (first < 1 || rest < 1 || (count > 2 && each < 1)) return only;
  const rows: Slice[] = [];
  let used = 0;
  for (let position = 0; position < count; position += 1) {
    const value = position === 0 ? first : position === count - 1 ? total - used : each;
    rows.push({ phase: names[position] ?? "Start", position, amount: value });
    used += value;
  }
  return rows;
}

export function amountsFor(total: number, shares: number[]): number[] {
  const whole = Math.round(total);
  const sum = shares.reduce((left, right) => left + right, 0);
  if (shares.length === 0 || sum <= 0 || whole <= 0) return [Math.max(whole, 0)];
  const rows = shares.map((share) => Math.floor((whole * share) / sum));
  const used = rows.reduce((left, right) => left + right, 0);
  rows[rows.length - 1] += whole - used;
  return rows;
}

export function openSlice(input: {
  amount: number;
  phases: string[];
  openPhase?: number;
  shares?: number[] | null;
  tranches?: Tranche[] | null;
}): Slice {
  const open = input.tranches?.find((row) => row.status === "open");
  if (open) return { phase: open.phase, position: open.position, amount: open.amount };
  const phases = input.phases.length > 0 ? input.phases : ["Start"];
  const custom =
    input.shares && input.shares.length === phases.length
      ? amountsFor(input.amount, input.shares).map((amount, position) => ({
          phase: phases[position] ?? "Start",
          position,
          amount,
        }))
      : splitPledge(input.amount, phases);
  const index = Math.min(Math.max(input.openPhase ?? 0, 0), custom.length - 1);
  return custom[index] ?? { phase: phases[0] ?? "Start", position: 0, amount: input.amount };
}

export function readinessChangeNote(before: Readiness, after: Readiness): string {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const parts: string[] = [];
  for (const key of keys) {
    const previous = before[key] ?? "";
    const next = after[key] ?? "";
    if (previous === next) continue;
    const label = key.replace(/^(need:|check:)/, "").replace(/-/g, " ");
    const word = next === "have" ? "Have it" : next === "working" ? "Working" : "Not yet";
    parts.push(`${label} is now ${word}`);
  }
  return parts.join(". ").slice(0, 240);
}
