import { sectorTitle } from "@/lib/catalog";
import { bandRank } from "@/lib/match";
import { boundsContain, countryZoom, type MapBounds } from "@/lib/map-camera";
import { projectCommitted } from "@/lib/ownership";
import { REGIONS, countriesIn, getRegion, showcaseById, type RegionId } from "@/lib/regions";
import { getCity, getCountry, getParish, getParishes, getTown } from "@/lib/seed";
import type { CapitalRequest, Commitment, Project, Sector } from "@/lib/types";

export type MarkerPoint = {
  id: string;
  kind: "project" | "request";
  name: string;
  lat: number;
  lng: number;
  regionId: string;
  regionName: string;
  countryId: string;
  countryName: string;
  place: string;
};

export type Opening = MarkerPoint & {
  sector: Sector;
  parishId: string | null;
  townId: string;
  rank: number;
  full: number;
  ratio: number;
  left: number;
  createdAt: string;
  project?: Project;
  request?: CapitalRequest;
};

export type Spot = {
  countryId: string;
  parishId: string | null;
  townId: string;
};

export type SearchHit = {
  id: string;
  label: string;
  detail: string;
  lat: number;
  lng: number;
  zoom: number;
  kind: "country" | "town";
  regionId: string;
  countryId: string;
  parishId: string | null;
  townId: string | null;
};

type PlaceName = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
  countryName: string;
};

function namesFor(countryId: string, parishId: string | null): PlaceName | null {
  if (countryId === "jamaica") {
    const parish = parishId ? getParish(parishId) : undefined;
    return {
      id: "jamaica",
      name: "Jamaica",
      regionId: "caribbean",
      regionName: "Caribbean",
      countryName: parish ? parish.name : "Jamaica",
    };
  }
  const country = getCountry(countryId);
  if (!country) return null;
  const region = getRegion(country.regionId);
  return {
    id: country.id,
    name: country.name,
    regionId: country.regionId,
    regionName: region?.name ?? "",
    countryName: country.name,
  };
}

function pointOf(countryId: string, parishId: string | null, townId: string) {
  if (countryId === "jamaica" && parishId) {
    const town = getTown(parishId, townId);
    return town ? { lat: town.lat, lng: town.lng, town: town.name } : null;
  }
  const city = getCity(countryId, townId);
  return city ? { lat: city.lat, lng: city.lng, town: city.name } : null;
}

export function openingFromProject(
  project: Project,
  commitments: Commitment[],
  home: Spot | null,
): Opening | null {
  const where = namesFor(project.countryId, project.parishId);
  const point = pointOf(project.countryId, project.parishId, project.townId);
  if (!where || !point) return null;
  const committed = projectCommitted(project.committedJmd, commitments, project.id);
  const left = project.goalJmd - committed;
  const ratio = project.goalJmd > 0 ? committed / project.goalJmd : 0;
  return {
    id: project.id,
    kind: "project",
    name: project.name,
    sector: project.sector,
    lat: point.lat,
    lng: point.lng,
    regionId: where.regionId,
    regionName: where.regionName,
    countryId: project.countryId,
    countryName: where.name,
    parishId: project.parishId,
    townId: project.townId,
    place: `${point.town}, ${where.countryName}`,
    rank: home?.townId ? bandRank(home, project) : 0,
    full: left <= 0 ? 1 : 0,
    ratio,
    left,
    createdAt: "",
    project,
  };
}

export function openingFromRequest(request: CapitalRequest, home: Spot | null): Opening | null {
  if (request.status !== "open") return null;
  const where = namesFor(request.countryId, request.parishId);
  const point = pointOf(request.countryId, request.parishId, request.townId);
  if (!where || !point) return null;
  const createdAt = request.createdAt.length === 10 ? `${request.createdAt}T00:00:00.000Z` : request.createdAt;
  return {
    id: request.id,
    kind: "request",
    name: `${sectorTitle(request.sector)} in ${point.town}`,
    sector: request.sector,
    lat: point.lat,
    lng: point.lng,
    regionId: where.regionId,
    regionName: where.regionName,
    countryId: request.countryId,
    countryName: where.name,
    parishId: request.parishId,
    townId: request.townId,
    place: `${point.town}, ${where.countryName}`,
    rank: home?.townId ? bandRank(home, request) : 0,
    full: 0,
    ratio: 0,
    left: 0,
    createdAt,
    request,
  };
}

/** Same order as the invest and work feeds. */
export function orderOpenings(rows: Opening[]): Opening[] {
  return [...rows].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.kind !== b.kind) return a.kind === "project" ? -1 : 1;
    if (a.kind === "project") {
      if (a.full !== b.full) return a.full - b.full;
      if (a.ratio !== b.ratio) return b.ratio - a.ratio;
      return a.left - b.left;
    }
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}

export function openLine(count: number, regions: number): string {
  if (count === 0) return "Nothing open in this area";
  const place = regions === 1 ? "1 region" : `${regions} regions`;
  return `${count} open in ${place}`;
}

export function regionCount(rows: Opening[]): number {
  return new Set(rows.map((row) => row.regionId).filter(Boolean)).size;
}

export function inBounds(rows: Opening[], bounds: MapBounds | null): Opening[] {
  if (!bounds) return rows;
  return rows.filter((row) => boundsContain(bounds, row.lat, row.lng));
}

export function searchPlaces(query: string): SearchHit[] {
  const text = query.trim().toLowerCase();
  if (text.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const region of REGIONS) {
    for (const country of countriesIn(region.id)) {
      if (!country.name.toLowerCase().includes(text)) continue;
      hits.push({
        id: `country-${country.id}`,
        label: country.name,
        detail: region.name,
        lat: country.coordinates[1],
        lng: country.coordinates[0],
        zoom: countryZoom(country.id),
        kind: "country",
        regionId: region.id,
        countryId: country.id,
        parishId: null,
        townId: null,
      });
    }
  }
  for (const parish of getParishes()) {
    for (const town of parish.towns) {
      if (!town.name.toLowerCase().includes(text)) continue;
      hits.push({
        id: `town-${parish.id}-${town.id}`,
        label: town.name,
        detail: `${parish.name}, Jamaica`,
        lat: town.lat,
        lng: town.lng,
        zoom: 11,
        kind: "town",
        regionId: "caribbean",
        countryId: "jamaica",
        parishId: parish.id,
        townId: town.id,
      });
    }
  }
  for (const region of REGIONS) {
    for (const country of countriesIn(region.id)) {
      if (country.id === "jamaica") continue;
      const record = getCountry(country.id);
      if (!record) continue;
      for (const city of record.cities) {
        if (!city.name.toLowerCase().includes(text)) continue;
        hits.push({
          id: `city-${country.id}-${city.id}`,
          label: city.name,
          detail: country.name,
          lat: city.lat,
          lng: city.lng,
          zoom: 11,
          kind: "town",
          regionId: region.id,
          countryId: country.id,
          parishId: null,
          townId: city.id,
        });
      }
    }
  }
  const seen = new Set<string>();
  return hits.filter((hit) => {
    if (seen.has(hit.id)) return false;
    seen.add(hit.id);
    return true;
  }).slice(0, 8);
}

export function townsIn(regionId: string, countryId: string): SearchHit[] {
  if (countryId === "jamaica") {
    const rows: SearchHit[] = [];
    for (const parish of getParishes()) {
      for (const town of parish.towns) {
        rows.push({
          id: `${parish.id}-${town.id}`,
          label: town.name,
          detail: parish.name,
          lat: town.lat,
          lng: town.lng,
          zoom: 11,
          kind: "town",
          regionId,
          countryId,
          parishId: parish.id,
          townId: town.id,
        });
      }
    }
    return rows;
  }
  const country = getCountry(countryId);
  const showcase = showcaseById(countryId);
  if (!country || !showcase) return [];
  return country.cities.map((city) => ({
    id: `${country.id}-${city.id}`,
    label: city.name,
    detail: country.name,
    lat: city.lat,
    lng: city.lng,
    zoom: 11,
    kind: "town" as const,
    regionId: showcase.regionId,
    countryId: country.id,
    parishId: null,
    townId: city.id,
  }));
}

export function isRegionId(value: string): value is RegionId {
  return REGIONS.some((region) => region.id === value);
}
