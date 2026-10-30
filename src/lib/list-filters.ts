export type ListOrder = "for-you" | "closest" | "newest";

export type AppliedFilters = {
  kind: "all" | "project" | "request";
  readiness: "any" | "ready" | "open";
  confirmed: boolean;
  skill: string | null;
};

export const emptyFilters: AppliedFilters = {
  kind: "all",
  readiness: "any",
  confirmed: false,
  skill: null,
};

export function defaultListOrder(profileSet: boolean, placeSaved: boolean): ListOrder {
  if (profileSet) return "for-you";
  if (placeSaved) return "closest";
  return "newest";
}

export function passesFilters(input: {
  kind: "project" | "request";
  checks?: { state: string }[] | null;
  readiness?: Record<string, string> | null;
  confirmedAmount: number;
  skillIds: string[];
  filters: AppliedFilters;
}): boolean {
  const filters = input.filters;
  if (filters.kind === "project" && input.kind !== "project") return false;
  if (filters.kind === "request" && input.kind !== "request") return false;
  if (filters.skill && !input.skillIds.includes(filters.skill)) return false;
  if (filters.confirmed && !(input.confirmedAmount > 0)) return false;
  if (filters.readiness !== "any") {
    const ready =
      input.kind === "project"
        ? Boolean(input.checks && input.checks.length > 0 && input.checks.every((item) => item.state === "yes"))
        : Boolean(
            input.readiness &&
              Object.keys(input.readiness).length > 0 &&
              Object.values(input.readiness).every((item) => item === "have"),
          );
    if (filters.readiness === "ready" && !ready) return false;
    if (filters.readiness === "open" && ready) return false;
  }
  return true;
}
