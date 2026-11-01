import type { Availability, CapitalRequest, Project } from "@/lib/types";

export type PlaceCounts = {
  projects: number;
  requests: number;
  workers: number;
};

export function openItems(counts: PlaceCounts): number {
  return counts.projects + counts.requests;
}

/** 0 is the lightest shade. 2 is the darkest. */
export function shadeStep(open: number): 0 | 1 | 2 {
  if (open <= 0) return 0;
  if (open === 1) return 1;
  return 2;
}

function part(count: number, one: string, many: string): string | null {
  if (count <= 0) return null;
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function countLine(counts: PlaceCounts): string {
  const parts = [
    part(counts.projects, "project", "projects"),
    part(counts.requests, "request", "requests"),
    part(counts.workers, "worker", "workers"),
  ].filter((item): item is string => Boolean(item));
  return parts.length > 0 ? parts.join(" · ") : "Nothing open yet";
}

/** Hover line. Workers stay on the list, not on the map. */
export function placeTip(name: string, counts: PlaceCounts): string {
  const parts = [
    part(counts.projects, "project", "projects"),
    part(counts.requests, "request", "requests"),
  ].filter((item): item is string => Boolean(item));
  if (parts.length === 0) return "Nothing open yet";
  return `${name} · ${parts.join(" · ")}`;
}

type Placed = {
  countryId: string;
  parishId: string | null;
  townId: string;
};

export function countsFor(
  place: { countryId: string; areaId?: string | null; townId?: string | null },
  rows: { projects: Project[]; requests: CapitalRequest[]; availability: Availability[] },
  townIds: string[] | null,
): PlaceCounts {
  const match = (item: Placed) => {
    if (item.countryId !== place.countryId) return false;
    if (place.townId) return item.townId === place.townId;
    if (place.areaId) {
      if (place.countryId === "jamaica") return item.parishId === place.areaId;
      return townIds?.includes(item.townId) ?? false;
    }
    return true;
  };
  return {
    projects: rows.projects.filter(match).length,
    requests: rows.requests.filter((item) => item.status !== "closed" && match(item)).length,
    workers: rows.availability.filter(match).length,
  };
}
