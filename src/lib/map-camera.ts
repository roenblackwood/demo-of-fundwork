export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Below this zoom, open regions are shaded and markers group by region. */
export const WORLD_ZOOM = 3.2;

/** At this zoom and above, each project and request has its own marker. */
export const POINT_ZOOM = 6.2;

export const WORLD_BOUNDS: MapBounds = {
  west: -95,
  south: -16,
  east: 135,
  north: 56,
};

export const REGION_CAMERA: Record<string, { center: [number, number]; zoom: number }> = {
  caribbean: { center: [-77.5, 18.2], zoom: 5.2 },
  "latin-america": { center: [-68, -8], zoom: 2.7 },
  africa: { center: [18, 2], zoom: 2.7 },
  "middle-east": { center: [40, 27], zoom: 3.6 },
  "eastern-europe": { center: [28, 49], zoom: 3.8 },
  "south-asia": { center: [80, 22], zoom: 3.5 },
  "southeast-asia": { center: [115, 2], zoom: 3.3 },
};

export const COUNTRY_ZOOM: Record<string, number> = {
  jamaica: 7.6,
  barbados: 10,
  moldova: 6.6,
};

export function countryZoom(countryId: string): number {
  return COUNTRY_ZOOM[countryId] ?? 5.2;
}

export function boundsContain(bounds: MapBounds, lat: number, lng: number): boolean {
  return lng >= bounds.west && lng <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

export type FlyTarget =
  | { kind: "world" }
  | { kind: "center"; center: [number, number]; zoom: number }
  | { kind: "bounds"; bounds: MapBounds; maxZoom: number };

export type FlyRequest = FlyTarget & { token: number };

export function boundsAround(lat: number, lng: number, span: number): MapBounds {
  return {
    west: lng - span,
    east: lng + span,
    south: lat - span,
    north: lat + span,
  };
}
