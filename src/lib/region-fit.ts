import raw from "../../data/region-fit.json";
import { sectorTitle } from "@/lib/catalog";
import { getCountry, getParish } from "@/lib/seed";
import type { Sector } from "@/lib/types";

/**
 * Place notes from public pages only.
 * A claim with no source stays out of data/region-fit.json.
 * check-seed rejects an item that has no source.
 */

export type FitSource = { title: string; url: string };

export type FitSector = {
  sector: Sector;
  why: string;
  sources: FitSource[];
  checkedOn: string;
};

export type FitLine = {
  line: string;
  sources: FitSource[];
  checkedOn: string;
};

export type FitAdvice = {
  title: string;
  body: string;
  rule: string;
  action: string;
  sources: FitSource[];
  checkedOn: string;
};

export type PlaceFit = {
  id: string;
  sectors: FitSector[];
  seasons: FitLine[];
  risks: FitLine[];
  advice: FitAdvice[];
};

export const NOT_WRITTEN = "We have not written this up yet.";
export const NOT_ADVICE = "Fundwork does not give legal or investment advice.";

const places = (raw as { places: PlaceFit[] }).places;

function uniqueSources(sources: FitSource[]): FitSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

export function placeFit(id: string): PlaceFit | null {
  const found = places.find((place) => place.id === id);
  if (!found) return null;
  const count = found.sectors.length + found.seasons.length + found.risks.length + found.advice.length;
  return count > 0 ? found : null;
}

/** Parish note when one is on file. Otherwise the country note. */
export function fitForPlace(parishId: string | null, countryId: string): PlaceFit | null {
  if (parishId) {
    const parish = placeFit(parishId);
    if (parish) return parish;
  }
  return placeFit(countryId);
}

export function suitedSector(parishId: string | null, countryId: string, sector: Sector): FitSector | null {
  const fit = fitForPlace(parishId, countryId);
  return fit?.sectors.find((item) => item.sector === sector) ?? null;
}

export function topSectorTitles(placeId: string, count = 2): string[] {
  const fit = placeFit(placeId);
  if (!fit) return [];
  return fit.sectors.slice(0, count).map((item) => sectorTitle(item.sector));
}

export function sourcesOf(fit: PlaceFit | null): FitSource[] {
  if (!fit) return [];
  return uniqueSources([
    ...fit.sectors.flatMap((item) => item.sources),
    ...fit.seasons.flatMap((item) => item.sources),
    ...fit.risks.flatMap((item) => item.sources),
    ...fit.advice.flatMap((item) => item.sources),
  ]);
}

export function sectorSources(parishId: string | null, countryId: string): FitSource[] {
  const fit = fitForPlace(parishId, countryId);
  if (!fit) return [];
  return uniqueSources(fit.sectors.flatMap((item) => item.sources));
}

export function riskSources(parishId: string | null, countryId: string): FitSource[] {
  const fit = fitForPlace(parishId, countryId);
  if (!fit) return [];
  return uniqueSources(fit.risks.flatMap((item) => item.sources));
}

export function sourcesForPlaces(ids: string[]): FitSource[] {
  const rows: FitSource[] = [];
  for (const id of ids) {
    const fit = placeFit(id);
    if (!fit) continue;
    for (const sector of fit.sectors.slice(0, 2)) rows.push(...sector.sources);
  }
  return uniqueSources(rows);
}

export function placeLabel(placeId: string): string {
  return getParish(placeId)?.name ?? getCountry(placeId)?.name ?? "This place";
}
