import raw from "../../data/area-status.json";
import { getCountry } from "@/lib/seed";

export type AreaMark = "blocked" | "caution";

export const AREA_BLOCKED_LINE = "Fundwork cannot open projects here.";
export const AREA_CAUTION_CHIP = "Active conflict area. Rules not checked yet.";

// OFAC Ukraine-/Russia-related sanctions:
// https://ofac.treasury.gov/sanctions-programs-and-country-information/ukraine-russia-related-sanctions
// A lawyer must review that page before this list is treated as final.

type AreaRow = {
  countryId: string;
  id: string;
  status: AreaMark;
};

const rows = (raw as { areas: AreaRow[] }).areas;
const byKey = new Map(rows.map((row) => [`${row.countryId}:${row.id}`, row.status]));

export function areaMark(countryId: string, areaId: string | null | undefined): AreaMark | null {
  if (!areaId) return null;
  const status = byKey.get(`${countryId}:${areaId}`);
  return status === "blocked" || status === "caution" ? status : null;
}

export function areaIdForPlace(countryId: string, parishId: string | null, townId: string): string | null {
  if (countryId === "jamaica") return parishId;
  return getCountry(countryId)?.cities.find((city) => city.id === townId)?.admin1Id ?? null;
}

export function placeIsBlocked(countryId: string, parishId: string | null, townId: string): boolean {
  return areaMark(countryId, areaIdForPlace(countryId, parishId, townId)) === "blocked";
}
