import { countryRule, countryRules, isListableCountry } from "@/lib/country-rules";
import { getCountry, getParish, getParishes } from "@/lib/seed";
import type { Town } from "@/lib/types";

export function countryDisplayName(id: string): string {
  const rule = countryRule(id);
  if (rule) return rule.name;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(id) ?? id;
  } catch {
    return id;
  }
}

let regionCodeCache: string[] | null = null;

/** Two-letter regions Intl can name. `supportedValuesOf` has no region key. */
export function regionCodes(): string[] {
  if (regionCodeCache) return regionCodeCache;
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") return [];
  try {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    const codes: string[] = [];
    for (let i = 65; i <= 90; i += 1) {
      for (let j = 65; j <= 90; j += 1) {
        const code = String.fromCharCode(i, j);
        const label = names.of(code);
        if (!label || label.toUpperCase() === code || label === "Unknown Region") continue;
        codes.push(code);
      }
    }
    regionCodeCache = codes;
    return codes;
  } catch {
    regionCodeCache = [];
    return regionCodeCache;
  }
}

export function codeForCountryName(name: string): string | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const listed = countryRules().find((country) => country.name.toLowerCase() === target);
  if (listed) return listed.id;
  if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") return null;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  for (const code of regionCodes()) {
    const label = names.of(code);
    if (label && label.toLowerCase() === target) return code;
  }
  return null;
}

export function townsInArea(countryId: string, areaId: string): Town[] {
  if (countryId === "jamaica") return getParish(areaId)?.towns ?? [];
  return (getCountry(countryId)?.cities ?? []).filter((city) => city.admin1Id === areaId);
}

export function fallbackAreas(countryId: string): { id: string; name: string }[] {
  if (countryId === "jamaica") return getParishes().map((parish) => ({ id: parish.id, name: parish.name }));
  const seen = new Map<string, string>();
  for (const city of getCountry(countryId)?.cities ?? []) {
    if (!city.admin1Id || seen.has(city.admin1Id)) continue;
    const name = city.admin1Id
      .split("-")
      .filter(Boolean)
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
      .join(" ");
    seen.set(city.admin1Id, name || city.admin1Id);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

export function watchKey(countryId: string, areaId: string | null, townId: string | null): string {
  return `watch:${countryId}:${areaId ?? ""}:${townId ?? ""}`;
}

export function isOutsideCode(id: string): boolean {
  return /^[A-Z]{2}$/.test(id) && !countryRule(id);
}

/** A bad query becomes a replace href. Null means the query can stay. */
export function drillFix(
  countryId: string | null,
  areaId: string | null,
  townId: string | null,
  knownAreas: Set<string> | null,
): string | null {
  if (!countryId) {
    if (areaId || townId) return "/";
    return null;
  }
  const rule = countryRule(countryId);
  const outside = !rule && isOutsideCode(countryId);
  if (!rule && !outside) return "/";
  if (rule?.status === "blocked" || outside) {
    if (areaId || townId) return `/?country=${encodeURIComponent(countryId)}`;
    return null;
  }
  if (!isListableCountry(countryId)) return "/";
  if (!areaId) {
    if (townId) return `/?country=${encodeURIComponent(countryId)}`;
    return null;
  }
  if (knownAreas && !knownAreas.has(areaId)) return `/?country=${encodeURIComponent(countryId)}`;
  if (!townId) return null;
  const towns = townsInArea(countryId, areaId);
  if (!towns.some((town) => town.id === townId)) {
    return `/?country=${encodeURIComponent(countryId)}&area=${encodeURIComponent(areaId)}`;
  }
  return null;
}
