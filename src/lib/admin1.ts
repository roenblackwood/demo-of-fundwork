import type { Feature, FeatureCollection, Polygon, MultiPolygon, Point } from "geojson";

export type AdminAreaProps = {
  id: string;
  name: string;
  countryId: string;
  areaStatus?: "blocked" | "caution";
  detail?: string;
};

export type AdminCollection = FeatureCollection<Polygon | MultiPolygon, AdminAreaProps>;

export type AreaName = {
  id: string;
  name: string;
  countryId: string;
  lat: number;
  lng: number;
};

type CacheEntry =
  | { status: "ready"; data: AdminCollection }
  | { status: "error" };

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

export function areaNoun(countryId: string): "parishes" | "areas" {
  return countryId === "jamaica" ? "parishes" : "areas";
}

export function cachedAdmin1(countryId: string): CacheEntry | null {
  return cache.get(countryId) ?? null;
}

/** Fetch one country's areas. Later taps use the session cache. */
export function loadAdmin1(countryId: string): Promise<CacheEntry> {
  const hit = cache.get(countryId);
  if (hit) return Promise.resolve(hit);
  const running = pending.get(countryId);
  if (running) return running;
  const task = fetch(`/maps/admin1/${countryId}.json`)
    .then(async (res) => {
      if (!res.ok) throw new Error("missing");
      const data = (await res.json()) as AdminCollection;
      if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) throw new Error("bad");
      const entry: CacheEntry = { status: "ready", data };
      cache.set(countryId, entry);
      pending.delete(countryId);
      return entry;
    })
    .catch(() => {
      const entry: CacheEntry = { status: "error" };
      cache.set(countryId, entry);
      pending.delete(countryId);
      return entry;
    });
  pending.set(countryId, task);
  return task;
}

let names: AreaName[] | null = null;
let namesTask: Promise<AreaName[]> | null = null;

export function loadAreaNames(): Promise<AreaName[]> {
  if (names) return Promise.resolve(names);
  if (!namesTask) {
    namesTask = fetch("/maps/admin1/names.json")
      .then(async (res) => {
        if (!res.ok) throw new Error("missing");
        const rows = (await res.json()) as AreaName[];
        names = Array.isArray(rows) ? rows : [];
        return names;
      })
      .catch(() => {
        names = [];
        return names;
      });
  }
  return namesTask;
}

function ringPoint(feature: Feature<Polygon | MultiPolygon>): [number, number] | null {
  const geometry = feature.geometry;
  const ring = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const pair of ring) {
    lng += pair[0];
    lat += pair[1];
  }
  return [lng / ring.length, lat / ring.length];
}

export function boundsOfFeature(feature: Feature<Polygon | MultiPolygon>): {
  west: number;
  south: number;
  east: number;
  north: number;
} | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const step = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      west = Math.min(west, node[0]);
      east = Math.max(east, node[0]);
      south = Math.min(south, node[1]);
      north = Math.max(north, node[1]);
      return;
    }
    for (const child of node) step(child);
  };
  step(feature.geometry.coordinates);
  if (!Number.isFinite(west)) return null;
  return { west, south, east, north };
}

export function labelPoints(
  collection: AdminCollection,
  detailFor: (id: string) => string,
): FeatureCollection<Point, { id: string; name: string; detail: string }> {
  return {
    type: "FeatureCollection",
    features: collection.features.flatMap((feature) => {
      const point = ringPoint(feature);
      const id = feature.properties?.id;
      const name = feature.properties?.name;
      if (!point || !id || !name) return [];
      return [
        {
          type: "Feature" as const,
          id,
          properties: { id, name, detail: detailFor(id) },
          geometry: { type: "Point" as const, coordinates: point },
        },
      ];
    }),
  };
}

export function withAreaDetails(collection: AdminCollection, detailFor: (id: string) => string): AdminCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => ({
      ...feature,
      id: feature.properties.id,
      properties: { ...feature.properties, detail: detailFor(feature.properties.id) },
    })),
  };
}
