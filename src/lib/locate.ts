import blockedRaw from "@/lib/maps/blocked-110m.json";
import regionsRaw from "@/lib/maps/regions-110m.json";
import { countryRule } from "@/lib/country-rules";
import { nearestTown, type PlacePick } from "@/lib/profile";

type Ring = number[][];
type Geometry = { type: string; coordinates: unknown };
type Feature = { properties?: { regionId?: string; id?: string }; geometry?: Geometry };

const OPEN_REGIONS = new Set([
  "caribbean",
  "latin-america",
  "africa",
  "middle-east",
  "south-asia",
  "southeast-asia",
]);

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (xi === undefined || yi === undefined || xj === undefined || yj === undefined) continue;
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  const outer = rings[0];
  if (!outer || !pointInRing(lng, lat, outer)) return false;
  for (let i = 1; i < rings.length; i += 1) {
    const hole = rings[i];
    if (hole && pointInRing(lng, lat, hole)) return false;
  }
  return true;
}

function pointInGeometry(lng: number, lat: number, geometry: Geometry | undefined): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(lng, lat, geometry.coordinates as Ring[]);
  }
  if (geometry.type === "MultiPolygon") {
    const parts = geometry.coordinates as Ring[][];
    return parts.some((rings) => pointInPolygon(lng, lat, rings));
  }
  return false;
}

function features(value: unknown): Feature[] {
  if (!value || typeof value !== "object") return [];
  const rows = (value as { features?: unknown }).features;
  return Array.isArray(rows) ? (rows as Feature[]) : [];
}

function inBlockedCountry(lat: number, lng: number): boolean {
  return features(blockedRaw).some((feature) => pointInGeometry(lng, lat, feature.geometry));
}

function inOpenRegion(lat: number, lng: number): boolean {
  return features(regionsRaw).some((feature) => {
    const id = feature.properties?.regionId;
    return Boolean(id && OPEN_REGIONS.has(id) && pointInGeometry(lng, lat, feature.geometry));
  });
}

export function outsideNote(role: "investor" | "worker"): string {
  if (role === "worker") return "You are outside the places Fundwork is open.";
  return "Your location is outside our project regions. That is fine for investing. Pick regions instead.";
}

/** Phone country from the region shapes. Returns a town id only when one is close. Coordinates are not stored. */
export function readPhonePlace(
  lat: number,
  lng: number,
  role: "investor" | "worker",
): { place: PlacePick | null; note: string } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { place: null, note: "No problem. Pick your town instead." };
  }
  if (inBlockedCountry(lat, lng) || !inOpenRegion(lat, lng)) {
    return { place: null, note: outsideNote(role) };
  }
  const place = nearestTown(lat, lng);
  if (!place) return { place: null, note: "No listed town is close. Pick a place." };
  const rule = countryRule(place.countryId);
  if (!rule || (rule.status !== "open" && rule.status !== "limited")) {
    return { place: null, note: outsideNote(role) };
  }
  return { place, note: "" };
}
