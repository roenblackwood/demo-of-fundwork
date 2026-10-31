import type { Availability, CapitalRequest, Project } from "@/lib/types";

export type PlaceCounts = {
  projects: number;
  requests: number;
  workers: number;
};

export function countLine(counts: PlaceCounts): string {
  const projects = counts.projects === 1 ? "1 project" : `${counts.projects} projects`;
  const requests = counts.requests === 1 ? "1 request" : `${counts.requests} requests`;
  const workers = counts.workers === 1 ? "1 worker" : `${counts.workers} workers`;
  return `${projects} · ${requests} · ${workers} available`;
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
