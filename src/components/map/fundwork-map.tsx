"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import { Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import regions from "@/lib/maps/regions-110m.json";
import blocked from "@/lib/maps/blocked-110m.json";
import {
  POINT_ZOOM,
  WORLD_BOUNDS,
  WORLD_ZOOM,
  type FlyRequest,
  type FlyTarget,
  type MapBounds,
} from "@/lib/map-camera";
import type { MarkerPoint } from "@/lib/openings";
import { placeTip, shadeStep } from "@/lib/place-counts";

// Later, host the tiles as a PMTiles file on our own CDN, so one tile host is not a single point of failure.
const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const OCEAN = "#d7ebe3";
const LAND = "#e6e0d4";
const ROAD = "#f3efe6";
const CASING = "#e3dcd0";
const OPEN = "#0e5c3a";
const WORK = "#8c3418";
const PAPER = "#fffcf7";
const INK = "#1a2330";
const EASE_MS = 450;
const FLY_MS = 800;
const LOAD_MS = 8000;

const SHADE = ["#e7f3ec", "#8fbfa8", "#1f7a52"] as const;
const REGION_CIRCLES = "fw-region-circles";
const REGION_LABELS = "fw-region-labels";
const REGION_COUNTS = "fw-region-counts";
const COUNTRY_CIRCLES = "fw-country-circles";
const COUNTRY_LABELS = "fw-country-labels";
const COUNTRY_COUNTS = "fw-country-counts";
const POINT_CIRCLES = "fw-point-circles";
const POINT_LABELS = "fw-point-labels";
const AREA_FILL = "fw-admin1-fill";
const AREA_LINE = "fw-admin1-line";
const AREA_HIT = "fw-admin1-hit";
const AREA_LABELS = "fw-admin1-labels";
const AREA_COUNTS = "fw-admin1-counts";
const TOWN_HIT = "fw-town-hit";
const TOWN_CIRCLES = "fw-town-circles";
const TOWN_LABELS = "fw-town-labels";
const TOWN_COUNTS = "fw-town-counts";
const AREA_LAYERS = [AREA_FILL, AREA_LINE, AREA_HIT, AREA_LABELS, AREA_COUNTS];
const TOWN_LAYERS = [TOWN_HIT, TOWN_CIRCLES, TOWN_LABELS, TOWN_COUNTS];
const POINT_HIT = [POINT_CIRCLES, POINT_LABELS];
const TOWN_PICK = [TOWN_HIT, TOWN_CIRCLES, TOWN_LABELS, TOWN_COUNTS];
const AREA_PICK = [AREA_FILL, AREA_HIT, AREA_LABELS, AREA_COUNTS];
const COUNTRY_PICK = [COUNTRY_CIRCLES, COUNTRY_LABELS, COUNTRY_COUNTS];
const REGION_BUBBLE = [REGION_CIRCLES, REGION_LABELS, REGION_COUNTS];
const BASE_LABELS = ["label_country_1", "label_country_2", "label_country_3"];

export type TownMarker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  detail: string;
  open: number;
  tip: string;
};

export type DrillMode = "world" | "areas" | "towns";

export type MapViewState = {
  bounds: MapBounds;
  zoom: number;
};

type Handlers = {
  onReady: (view: MapViewState) => void;
  onMove: (view: MapViewState, gesture: boolean) => void;
  onRegion: (regionId: string) => void;
  onBlocked: (name: string) => void;
  onPoint: (id: string) => void;
  onFail: () => void;
  onCountry?: (id: string) => void;
  onArea?: (id: string) => void;
  onTown?: (id: string) => void;
  onMapCountry?: (name: string) => void;
  onEmpty?: () => void;
};

type Hit = {
  kind: "point" | "town" | "area" | "country" | "region" | "blocked" | "basemap";
  id: string;
  tip: string;
  west?: number;
  east?: number;
  south?: number;
  north?: number;
};

type Pad = { top: number; bottom: number; left: number; right: number };

function readBounds(map: MapLibreMap): MapBounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function mercatorY(lat: number): number {
  const rad = (lat * Math.PI) / 180;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
}

function latFromMercator(y: number): number {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

function cameraCenter(center: [number, number] | { lng: number; lat: number } | { lon: number; lat: number }): [number, number] {
  if (Array.isArray(center)) return [Number(center[0]), Number(center[1])];
  if ("lng" in center) return [center.lng, center.lat];
  return [center.lon, center.lat];
}

/** Geographic frame of the viewport at a camera, used so the pan limit can hold the fitted world. */
function viewBounds(width: number, height: number, zoom: number, centerLng: number, centerLat: number): MapBounds {
  const scale = 512 * 2 ** zoom;
  const x = ((centerLng + 180) / 360) * scale;
  const y = mercatorY(centerLat) * scale;
  return {
    west: ((x - width / 2) / scale) * 360 - 180,
    east: ((x + width / 2) / scale) * 360 - 180,
    north: latFromMercator((y - height / 2) / scale),
    south: latFromMercator((y + height / 2) / scale),
  };
}



function emptyGeo(): FeatureCollection<Point> {
  return { type: "FeatureCollection", features: [] };
}

function emptyAreas(): FeatureCollection<Polygon | MultiPolygon> {
  return { type: "FeatureCollection", features: [] };
}

function ringCenter(feature: { geometry: Polygon | MultiPolygon }): [number, number] | null {
  const ring = feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] : feature.geometry.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const pair of ring) {
    lng += pair[0];
    lat += pair[1];
  }
  return [lng / ring.length, lat / ring.length];
}

function areaLabels(data: FeatureCollection<Polygon | MultiPolygon>): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: data.features.flatMap((feature) => {
      const center = ringCenter(feature as { geometry: Polygon | MultiPolygon });
      const id = feature.properties?.id;
      const name = feature.properties?.name;
      if (!center || typeof id !== "string" || typeof name !== "string") return [];
      const open = typeof feature.properties?.open === "number" ? feature.properties.open : 0;
      const tip = typeof feature.properties?.tip === "string" ? feature.properties.tip : name;
      return [
        {
          type: "Feature" as const,
          id,
          properties: { id, name, open, tip },
          geometry: { type: "Point" as const, coordinates: center },
        },
      ];
    }),
  };
}

function townGeo(towns: TownMarker[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: towns.map((town) => ({
      type: "Feature" as const,
      id: town.id,
      properties: { id: town.id, name: town.name, open: town.open, tip: town.tip },
      geometry: { type: "Point" as const, coordinates: [town.lng, town.lat] },
    })),
  };
}

function spread(points: MarkerPoint[]): MarkerPoint[] {
  const seen = new Map<string, number>();
  return points.map((point) => {
    const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
    const slot = seen.get(key) ?? 0;
    seen.set(key, slot + 1);
    if (slot === 0) return point;
    return { ...point, lng: point.lng + slot * 0.045 };
  });
}

function pointsKey(points: MarkerPoint[], show: boolean): string {
  if (!show) return "hidden";
  return points
    .map((point) => `${point.id}:${point.kind}:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`)
    .sort()
    .join("|");
}

function groupGeo(points: MarkerPoint[], mode: "region" | "country"): FeatureCollection<Point> {
  const groups = new Map<string, MarkerPoint[]>();
  for (const point of points) {
    const key = mode === "region" ? point.regionId : point.countryId;
    const list = groups.get(key) ?? [];
    list.push(point);
    groups.set(key, list);
  }
  return {
    type: "FeatureCollection",
    features: [...groups.entries()].map(([key, list]) => {
      const lat = list.reduce((sum, point) => sum + point.lat, 0) / list.length;
      const lng = list.reduce((sum, point) => sum + point.lng, 0) / list.length;
      const projects = list.filter((point) => point.kind === "project").length;
      const requests = list.filter((point) => point.kind === "request").length;
      const name = mode === "region" ? list[0].regionName : list[0].countryName;
      const open = projects + requests;
      return {
        type: "Feature",
        id: key,
        properties: {
          key,
          name,
          open,
          shade: shadeStep(open),
          tip: placeTip(name, { projects, requests, workers: 0 }),
          west: Math.min(...list.map((point) => point.lng)),
          east: Math.max(...list.map((point) => point.lng)),
          south: Math.min(...list.map((point) => point.lat)),
          north: Math.max(...list.map((point) => point.lat)),
        },
        geometry: { type: "Point", coordinates: [lng, lat] },
      };
    }),
  };
}

function pointGeo(points: MarkerPoint[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: spread(points).map((point) => ({
      type: "Feature",
      id: point.id,
      properties: {
        id: point.id,
        name: point.name,
        tone: point.kind === "request" ? "work" : "open",
      },
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
    })),
  };
}

function paint(map: MapLibreMap, id: string, key: string, value: string | number) {
  try {
    const setPaint = map.setPaintProperty.bind(map) as (
      layer: string,
      name: string,
      paintValue: string | number,
    ) => void;
    setPaint(id, key, value);
  } catch {
    // Some land layers use a pattern instead of a color.
  }
}

function restyle(map: MapLibreMap) {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    const id = layer.id;
    if (id === "background") paint(map, id, "background-color", LAND);
    if (id === "natural_earth") paint(map, id, "raster-opacity", 0);
    if (id === "water" || id.startsWith("waterway")) {
      if (layer.type === "fill") paint(map, id, "fill-color", OCEAN);
      if (layer.type === "line") paint(map, id, "line-color", OCEAN);
    }
    if (id === "park" || id.startsWith("landcover") || id.startsWith("landuse")) {
      if (layer.type === "fill") {
        paint(map, id, "fill-color", LAND);
        paint(map, id, "fill-opacity", 0.35);
      }
    }
    if (id.startsWith("boundary")) paint(map, id, "line-color", "#d5cfc3");
    const road = id.includes("road_") || id.includes("bridge_") || id.includes("tunnel_");
    if (road && layer.type === "line" && !id.includes("rail") && !id.includes("hatching")) {
      paint(map, id, "line-color", id.includes("casing") ? CASING : ROAD);
    }
  }
}

function setGeo(map: MapLibreMap, id: string, data: FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  source?.setData(data);
}

function boundsForRegions(ids: string[]): MapBounds | null {
  const wanted = new Set(ids);
  const box: MapBounds = { west: 180, south: 90, east: -180, north: -90 };
  let hit = false;
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      hit = true;
      box.west = Math.min(box.west, coords[0]);
      box.east = Math.max(box.east, coords[0]);
      box.south = Math.min(box.south, coords[1]);
      box.north = Math.max(box.north, coords[1]);
      return;
    }
    for (const child of coords) walk(child);
  };
  for (const feature of (regions as FeatureCollection).features) {
    const id = feature.properties?.regionId;
    if (typeof id !== "string" || !wanted.has(id)) continue;
    walk(feature.geometry);
  }
  return hit ? box : null;
}

function textProp(feature: { properties?: GeoJSON.GeoJsonProperties | null }, key: string): string | null {
  const value = feature.properties?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readPad(container: HTMLElement): Pad {
  const box = container.getBoundingClientRect();
  const pad: Pad = { top: 0, bottom: 0, left: 0, right: 0 };
  const frames = [container.parentElement, container.parentElement?.parentElement].filter(
    (node): node is HTMLElement => Boolean(node),
  );
  frames.forEach((frame) => frame.querySelectorAll<HTMLElement>("[data-fw-pad]").forEach((node) => {
    if (node.getClientRects().length === 0) return;
    const rect = node.getBoundingClientRect();
    const edge = node.dataset.fwPad;
    if (edge === "top") pad.top = Math.max(pad.top, rect.bottom - box.top);
    if (edge === "bottom") pad.bottom = Math.max(pad.bottom, box.bottom - rect.top);
    if (edge === "left") pad.left = Math.max(pad.left, rect.right - box.left);
    if (edge === "right") pad.right = Math.max(pad.right, box.right - rect.left);
  }));
  const height = box.height || container.clientHeight || 1;
  const width = box.width || container.clientWidth || 1;
  if (pad.top + pad.bottom > height - 80) pad.bottom = Math.max(0, height - 80 - pad.top);
  if (pad.left + pad.right > width - 80) {
    pad.left = Math.min(pad.left, width - 80);
    pad.right = Math.max(0, width - 80 - pad.left);
  }
  pad.top = Math.max(0, Math.round(pad.top));
  pad.bottom = Math.max(0, Math.round(pad.bottom));
  pad.left = Math.max(0, Math.round(pad.left));
  pad.right = Math.max(0, Math.round(pad.right));
  return pad;
}

export function FundworkMap({
  points,
  showMarkers,
  selectedId,
  fly,
  onReady,
  onMove,
  onRegion,
  onBlocked,
  onPoint,
  onFail,
  areas = null,
  areaKey = "",
  towns = [],
  drill = "world",
  selectedAreaId = null,
  hoverAreaId = null,
  onCountry,
  onArea,
  onTown,
  onMapCountry,
  onEmpty,
  regionFocus = null,
  selectedTownId = null,
  preview = null,
  previewAt = null,
}: {
  points: MarkerPoint[];
  showMarkers: boolean;
  selectedId: string | null;
  regionId: string | null;
  fly: FlyRequest | null;
  onReady: (view: MapViewState) => void;
  onMove: (view: MapViewState, gesture: boolean) => void;
  onRegion: (regionId: string) => void;
  onBlocked: (name: string) => void;
  onPoint: (id: string) => void;
  onFail: () => void;
  areas?: FeatureCollection<Polygon | MultiPolygon> | null;
  areaKey?: string;
  towns?: TownMarker[];
  drill?: DrillMode;
  selectedAreaId?: string | null;
  hoverAreaId?: string | null;
  onCountry?: (id: string) => void;
  onArea?: (id: string) => void;
  onTown?: (id: string) => void;
  onMapCountry?: (name: string) => void;
  onEmpty?: () => void;
  regionFocus?: string | null;
  selectedTownId?: string | null;
  preview?: ReactNode;
  previewAt?: { id: string; lng: number; lat: number } | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const handlers = useRef<Handlers>({ onReady, onMove, onRegion, onBlocked, onPoint, onFail, onCountry, onArea, onTown, onMapCountry, onEmpty });
  const tipRef = useRef<HTMLDivElement>(null);
  const [popupSlot, setPopupSlot] = useState<HTMLDivElement | null>(null);
  const pointsRef = useRef(points);
  const showRef = useRef(showMarkers);
  const selectedRef = useRef(selectedId);
  const syncRef = useRef<(() => void) | null>(null);
  const syncDrill = useRef<(() => void) | null>(null);
  const drillRef = useRef({ areas, areaKey, towns, drill, selectedAreaId, hoverAreaId, regionFocus, selectedTownId });
  const flyRef = useRef<((request: FlyRequest) => void) | null>(null);
  const pendingFly = useRef<FlyRequest | null>(null);
  const latestFly = useRef<FlyRequest | null>(null);
  const dataKey = useRef("");
  const selectedKey = useRef<string | null>(null);

  useEffect(() => {
    handlers.current = { onReady, onMove, onRegion, onBlocked, onPoint, onFail, onCountry, onArea, onTown, onMapCountry, onEmpty };
  });

  useEffect(() => {
    pointsRef.current = points;
    showRef.current = showMarkers;
    selectedRef.current = selectedId;
    syncRef.current?.();
    syncDrill.current?.();
  }, [points, showMarkers, selectedId]);

  useEffect(() => {
    drillRef.current = { areas, areaKey, towns, drill, selectedAreaId, hoverAreaId, regionFocus, selectedTownId };
    syncDrill.current?.();
  }, [areas, areaKey, towns, drill, selectedAreaId, hoverAreaId, regionFocus, selectedTownId]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let map: MapLibreMap;
    let failed = false;
    try {
      // Turbopack serves this module from a chunk, so the default worker URL 404s.
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new MapLibreMap({
        container,
        style: STYLE,
        center: [20, 18],
        zoom: 1.4,
        minZoom: 0,
        maxZoom: 18,
        renderWorldCopies: false,
        attributionControl: { compact: false },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
        fadeDuration: 0,
      });
    } catch {
      handlers.current.onFail();
      return;
    }
    mapRef.current = map;
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.touchZoomRotate.disableRotation();
    map.boxZoom.enable();
    map.keyboard.enable();

    const wide = window.matchMedia("(min-width: 600px)");
    const zoomControl = new NavigationControl({ showCompass: false, visualizePitch: false });
    const syncZoomControl = () => {
      const has = map.hasControl(zoomControl);
      if (wide.matches && !has) map.addControl(zoomControl, "top-right");
      if (!wide.matches && has) map.removeControl(zoomControl);
    };
    syncZoomControl();
    wide.addEventListener("change", syncZoomControl);

    let boot = true;
    let gesture = false;
    let flying = false;
    let styleOk = false;
    let framed = false;
    let worldHold = true;
    const seenErrors = new Set<string>();
    const fail = () => {
      if (failed) return;
      failed = true;
      window.clearTimeout(timer);
      handlers.current.onFail();
    };
    const timer = window.setTimeout(() => {
      if (!framed) fail();
    }, LOAD_MS);
    const logOnce = (message: string) => {
      const key = message.replace(/\d+/g, "#").slice(0, 180);
      if (!key || seenErrors.has(key)) return;
      seenErrors.add(key);
      console.error(message);
    };

    map.on("movestart", (event) => {
      if (event.originalEvent) gesture = true;
    });
    map.on("dragstart", () => {
      worldHold = false;
      if (flying) map.stop();
    });
    map.on("zoomstart", (event) => {
      if (!event.originalEvent) return;
      worldHold = false;
      if (flying) map.stop();
    });
    map.on("error", (event) => {
      const err = event.error as (Error & { url?: string }) | undefined;
      const url = err?.url ?? "";
      const message = err?.message ?? "";
      const text = `${url} ${message}`;
      const asset = /fonts\.|sprite|glyph|\/tile/i.test(text);
      const styleFailed = !asset && (url.includes("/styles/") || message.includes("/styles/liberty"));
      if (styleFailed) {
        fail();
        return;
      }
      logOnce(message || url || "Map error");
    });
    map.on("render", () => {
      if (framed || !styleOk) return;
      framed = true;
      window.clearTimeout(timer);
    });

    const applyLimits = () => {
      map.resize();
      map.setMaxBounds(null);
      const held = map.getMinZoom();
      map.setMinZoom(0);
      const fitted = map.cameraForBounds(
        [
          [WORLD_BOUNDS.west, WORLD_BOUNDS.south],
          [WORLD_BOUNDS.east, WORLD_BOUNDS.north],
        ],
        { maxZoom: 22 },
      );
      if (!fitted?.center || fitted.zoom === undefined || !Number.isFinite(fitted.zoom)) {
        map.setMinZoom(held);
        return;
      }
      map.setMinZoom(Math.max(0, fitted.zoom - 0.01));
      const [lng, lat] = cameraCenter(fitted.center);
      const frame = viewBounds(container.clientWidth, container.clientHeight, fitted.zoom, lng, lat);
      const lngPad = Math.max(6, (frame.east - frame.west) * 0.05);
      const latPad = Math.max(4, (frame.north - frame.south) * 0.05);
      map.setMaxBounds([
        [frame.west - lngPad, Math.max(-85, frame.south - latPad)],
        [frame.east + lngPad, Math.min(85, frame.north + latPad)],
      ]);
    };

    const applyPad = () => {
      const pad = readPad(container);
      map.setPadding(pad);
    };

    let padKey = "";
    let refitQueued = false;
    let refitWorld = () => {};

    const resizeObserver = new ResizeObserver((entries) => {
      const boxChanged = entries.some((entry) => entry.target === container);
      applyPad();
      if (boxChanged) applyLimits();
      refitWorld();
    });
    resizeObserver.observe(container);
    const frame = container.parentElement?.parentElement ?? container.parentElement;
    const mutation = new MutationObserver(() => {
      frame?.querySelectorAll("[data-fw-pad]").forEach((node) => resizeObserver.observe(node));
      applyPad();
      refitWorld();
    });
    if (frame) {
      mutation.observe(frame, { childList: true, subtree: true });
      frame.querySelectorAll("[data-fw-pad]").forEach((node) => resizeObserver.observe(node));
    }

    let tapMove = 0;
    const travel = (center: [number, number], zoom: number) => {
      const token = ++tapMove;
      map.stop();
      flying = true;
      const finish = () => {
        if (token !== tapMove) return;
        flying = false;
        if (!refitQueued) return;
        refitQueued = false;
        refitWorld();
      };
      if (reducedMotion()) map.jumpTo({ center, zoom });
      else {
        const point = map.project(center);
        const canvas = map.getCanvas();
        const onScreen = point.x >= 0 && point.y >= 0 && point.x <= canvas.width && point.y <= canvas.height;
        const close = Math.abs(zoom - map.getZoom()) < 2 && onScreen;
        if (close) map.easeTo({ center, zoom, duration: EASE_MS });
        else map.flyTo({ center, zoom, duration: FLY_MS });
      }
      if (!map.isMoving()) finish();
      else map.once("moveend", finish);
    };

    const lookAt = (bounds: MapBounds, maxZoom: number) => {
      map.setMinZoom(0);
      const camera = map.cameraForBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { maxZoom },
      );
      if (!camera?.center || camera.zoom === undefined) return;
      const zoom = Math.min(maxZoom, camera.zoom);
      const world = map.cameraForBounds(
        [
          [WORLD_BOUNDS.west, WORLD_BOUNDS.south],
          [WORLD_BOUNDS.east, WORLD_BOUNDS.north],
        ],
        { maxZoom: 22 },
      );
      const floor = world?.zoom;
      map.setMinZoom(floor === undefined || !Number.isFinite(floor) ? 0 : Math.max(0, floor - 0.01));
      const center = camera.center;
      const pair: [number, number] = Array.isArray(center)
        ? [Number(center[0]), Number(center[1])]
        : "lng" in center
          ? [center.lng, center.lat]
          : [center.lon, center.lat];
      travel(pair, zoom);
    };

    const moveTo = (request: FlyTarget) => {
      if (request.kind !== "world") worldHold = false;
      if (request.kind === "world") {
        lookAt(WORLD_BOUNDS, 22);
        return;
      }
      if (request.kind === "region" || request.kind === "regions") {
        const ids = request.kind === "region" ? [request.regionId] : request.ids;
        const box = boundsForRegions(ids);
        if (box) lookAt(box, 5.6);
        return;
      }
      if (request.kind === "center") {
        travel(request.center, request.zoom);
        return;
      }
      const bounds = { ...request.bounds };
      if (bounds.east - bounds.west < 0.4) {
        bounds.west -= 0.3;
        bounds.east += 0.3;
      }
      if (bounds.north - bounds.south < 0.4) {
        bounds.south -= 0.25;
        bounds.north += 0.25;
      }
      lookAt(bounds, request.maxZoom);
    };

    refitWorld = () => {
      if (!worldHold || !map.isStyleLoaded()) return;
      if (flying) {
        refitQueued = true;
        return;
      }
      const pad = readPad(container);
      const key = `${pad.top}:${pad.bottom}:${pad.left}:${pad.right}:${container.clientWidth}:${container.clientHeight}`;
      if (key === padKey) return;
      padKey = key;
      moveTo({ kind: "world" });
    };

    const markSelected = () => {
      const next = showRef.current ? selectedRef.current : null;
      const previous = selectedKey.current;
      selectedKey.current = next;
      if (!map.getSource("fw-points")) return;
      if (previous && previous !== next) {
        try {
          map.setFeatureState({ source: "fw-points", id: previous }, { selected: false });
        } catch {
          // The point was already replaced.
        }
      }
      if (next) {
        try {
          map.setFeatureState({ source: "fw-points", id: next }, { selected: true });
        } catch {
          // The point is not in the current data.
        }
      }
    };

    const syncData = () => {
      if (!map.getSource("fw-points")) return;
      const key = pointsKey(pointsRef.current, showRef.current);
      if (key !== dataKey.current) {
        dataKey.current = key;
        const items = showRef.current ? pointsRef.current : [];
        setGeo(map, "fw-region-totals", groupGeo(items, "region"));
        setGeo(map, "fw-country-totals", groupGeo(items, "country"));
        setGeo(map, "fw-points", pointGeo(items));
        selectedKey.current = null;
      }
      markSelected();
    };
    syncRef.current = syncData;

    map.on("load", () => {
      if (failed) return;
      styleOk = true;
      restyle(map);
      map.getCanvas().setAttribute("tabindex", "0");
      const before = map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id;
      map.addSource("regions", { type: "geojson", data: regions as FeatureCollection });
      map.addLayer(
        {
          id: "regions-fill",
          type: "fill",
          source: "regions",
          maxzoom: WORLD_ZOOM,
          paint: { "fill-color": "#9ec4b3", "fill-opacity": 0.78 },
        },
        before,
      );
      map.addLayer(
        {
          id: "regions-line",
          type: "line",
          source: "regions",
          maxzoom: WORLD_ZOOM,
          paint: { "line-color": "#f4f1e8", "line-width": 1.25 },
        },
        before,
      );
      map.addSource("blocked", { type: "geojson", data: blocked as FeatureCollection });
      map.addLayer(
        {
          id: "blocked-fill",
          type: "fill",
          source: "blocked",
          paint: { "fill-color": "#cfc6b8", "fill-opacity": 1 },
        },
        before,
      );
      map.addLayer(
        {
          id: "blocked-line",
          type: "line",
          source: "blocked",
          paint: { "line-color": "#b7ad9e", "line-width": 1 },
        },
        before,
      );

      const toneColor = ["match", ["get", "tone"], "work", WORK, OPEN] as const;
      const shadeColor = ["match", ["to-number", ["get", "shade"]], 2, SHADE[2], 1, SHADE[1], SHADE[0]] as const;
      const nameSort = ["case", [">", ["to-number", ["get", "open"]], 0], 20, 10] as const;
      const countSort = 0;
      map.addSource("fw-region-totals", { type: "geojson", data: emptyGeo() });
      map.addSource("fw-country-totals", { type: "geojson", data: emptyGeo() });
      map.addSource("fw-points", { type: "geojson", data: emptyGeo(), promoteId: "id" });
      map.addLayer({
        id: REGION_CIRCLES,
        type: "circle",
        source: "fw-region-totals",
        maxzoom: WORLD_ZOOM,
        paint: {
          "circle-radius": 14,
          "circle-color": shadeColor as never,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0e5c3a",
        },
      });
      map.addLayer({
        id: REGION_LABELS,
        type: "symbol",
        source: "fw-region-totals",
        maxzoom: WORLD_ZOOM,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-optional": true,
          "text-max-width": 12,
          "symbol-sort-key": nameSort as never,
        },
        paint: { "text-color": INK, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      });
      map.addLayer({
        id: REGION_COUNTS,
        type: "symbol",
        source: "fw-region-totals",
        maxzoom: WORLD_ZOOM,
        filter: [">", ["to-number", ["get", "open"]], 0],
        layout: {
          "text-field": ["to-string", ["get", "open"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 2.45],
          "text-anchor": "top",
          "text-optional": true,
          "symbol-sort-key": countSort as never,
        },
        paint: { "text-color": PAPER, "text-halo-color": OPEN, "text-halo-width": 5 },
      });
      map.addLayer({
        id: COUNTRY_CIRCLES,
        type: "circle",
        source: "fw-country-totals",
        minzoom: WORLD_ZOOM,
        maxzoom: POINT_ZOOM,
        paint: {
          "circle-radius": 14,
          "circle-color": shadeColor as never,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#0e5c3a",
        },
      });
      map.addLayer({
        id: COUNTRY_LABELS,
        type: "symbol",
        source: "fw-country-totals",
        minzoom: WORLD_ZOOM,
        maxzoom: POINT_ZOOM,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-optional": true,
          "text-max-width": 12,
          "symbol-sort-key": nameSort as never,
        },
        paint: { "text-color": INK, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      });
      map.addLayer({
        id: COUNTRY_COUNTS,
        type: "symbol",
        source: "fw-country-totals",
        minzoom: WORLD_ZOOM,
        maxzoom: POINT_ZOOM,
        filter: [">", ["to-number", ["get", "open"]], 0],
        layout: {
          "text-field": ["to-string", ["get", "open"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 2.45],
          "text-anchor": "top",
          "text-optional": true,
          "symbol-sort-key": countSort as never,
        },
        paint: { "text-color": PAPER, "text-halo-color": OPEN, "text-halo-width": 5 },
      });
      map.addLayer({
        id: POINT_CIRCLES,
        type: "circle",
        source: "fw-points",
        minzoom: POINT_ZOOM,
        paint: {
          "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 14, 8],
          "circle-color": toneColor as never,
          "circle-stroke-width": 2,
          "circle-stroke-color": PAPER,
        },
      });
      map.addLayer({
        id: POINT_LABELS,
        type: "symbol",
        source: "fw-points",
        minzoom: POINT_ZOOM,
        layout: {
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-offset": [0, 1.05],
          "text-anchor": "top",
          "text-optional": true,
          "text-max-width": 12,
        },
        paint: { "text-color": INK, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      });

      map.addSource("fw-admin1", { type: "geojson", data: emptyAreas(), promoteId: "id" });
      map.addSource("fw-admin1-labels", { type: "geojson", data: emptyGeo(), promoteId: "id" });
      map.addSource("fw-towns", { type: "geojson", data: emptyGeo(), promoteId: "id" });
      map.addLayer({
        id: AREA_FILL,
        type: "fill",
        source: "fw-admin1",
        layout: { visibility: "none" },
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#0e5c3a",
            ["boolean", ["feature-state", "hover"], false],
            "#2d8a5e",
            ["match", ["to-number", ["get", "shade"]], 2, SHADE[2], 1, SHADE[1], SHADE[0]],
          ] as never,
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.82,
            ["boolean", ["feature-state", "hover"], false],
            0.75,
            0.88,
          ],
        },
      });
      map.addLayer({
        id: AREA_LINE,
        type: "line",
        source: "fw-admin1",
        layout: { visibility: "none" },
        paint: {
          "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#0e5c3a", "#f4f1e8"],
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 1.25],
        },
      });
      map.addLayer({
        id: AREA_HIT,
        type: "circle",
        source: "fw-admin1-labels",
        layout: { visibility: "none" },
        paint: { "circle-radius": 22, "circle-color": OPEN, "circle-opacity": 0 },
      });
      map.addLayer({
        id: AREA_LABELS,
        type: "symbol",
        source: "fw-admin1-labels",
        layout: {
          visibility: "none",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-anchor": "center",
          "text-offset": [0, -0.7],
          "text-max-width": 12,
          "text-padding": 1,
          "text-optional": true,
          "symbol-sort-key": nameSort as never,
        },
        paint: { "text-color": INK, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      });
      map.addLayer({
        id: AREA_COUNTS,
        type: "symbol",
        source: "fw-admin1-labels",
        filter: [">", ["to-number", ["get", "open"]], 0],
        layout: {
          visibility: "none",
          "text-field": ["to-string", ["get", "open"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-anchor": "center",
          "text-offset": [0, 0.85],
          "text-optional": true,
          "symbol-sort-key": countSort as never,
        },
        paint: { "text-color": PAPER, "text-halo-color": OPEN, "text-halo-width": 5 },
      });
      map.addLayer({
        id: TOWN_HIT,
        type: "circle",
        source: "fw-towns",
        layout: { visibility: "none" },
        paint: { "circle-radius": 22, "circle-color": OPEN, "circle-opacity": 0 },
      });
      map.addLayer({
        id: TOWN_CIRCLES,
        type: "circle",
        source: "fw-towns",
        layout: { visibility: "none" },
        paint: {
          "circle-radius": ["case", ["boolean", ["feature-state", "selected"], false], 14, 8],
          "circle-color": OPEN,
          "circle-stroke-width": 2,
          "circle-stroke-color": PAPER,
        },
      });
      map.addLayer({
        id: TOWN_LABELS,
        type: "symbol",
        source: "fw-towns",
        layout: {
          visibility: "none",
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-offset": [0, 1.15],
          "text-anchor": "top",
          "text-optional": true,
          "text-max-width": 12,
          "text-padding": 1,
          "symbol-sort-key": nameSort as never,
        },
        paint: { "text-color": INK, "text-halo-color": PAPER, "text-halo-width": 1.2 },
      });
      map.addLayer({
        id: TOWN_COUNTS,
        type: "symbol",
        source: "fw-towns",
        filter: [">", ["to-number", ["get", "open"]], 0],
        layout: {
          visibility: "none",
          "text-field": ["to-string", ["get", "open"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 2.5],
          "text-anchor": "top",
          "text-optional": true,
          "symbol-sort-key": countSort as never,
        },
        paint: { "text-color": PAPER, "text-halo-color": OPEN, "text-halo-width": 5 },
      });

      let areaDataKey = "";
      let townDataKey = "";
      let markedArea: string | null = null;
      let markedHover: string | null = null;
      let markedTown: string | null = null;
      const showLayer = (id: string, on: boolean) => {
        if (!map.getLayer(id)) return;
        map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      };
      const markArea = (source: string, previous: string | null, next: string | null, key: "selected" | "hover") => {
        if (previous && previous !== next) {
          try {
            map.setFeatureState({ source, id: previous }, { [key]: false });
          } catch {
            // The shape was replaced.
          }
        }
        if (next) {
          try {
            map.setFeatureState({ source, id: next }, { [key]: true });
          } catch {
            // The shape is not loaded yet.
          }
        }
      };
      const syncAreas = () => {
        if (!map.getSource("fw-admin1")) return;
        const state = drillRef.current;
        const showing = state.drill === "areas" || state.drill === "towns";
        if (state.areaKey !== areaDataKey) {
          areaDataKey = state.areaKey;
          const data = showing && state.areas ? state.areas : emptyAreas();
          setGeo(map, "fw-admin1", data);
          setGeo(map, "fw-admin1-labels", state.areas ? areaLabels(state.areas) : emptyGeo());
          markedArea = null;
          markedHover = null;
        }
        const focus = Boolean(state.regionFocus) && state.drill === "world";
        const world = state.drill === "world";
        for (const id of [COUNTRY_CIRCLES, COUNTRY_LABELS, COUNTRY_COUNTS]) {
          if (!map.getLayer(id)) continue;
          map.setLayerZoomRange(id, focus ? 0 : WORLD_ZOOM, POINT_ZOOM);
          showLayer(id, world);
        }
        for (const id of [REGION_CIRCLES, REGION_LABELS, REGION_COUNTS]) showLayer(id, world && !focus);
        showLayer("regions-fill", world);
        showLayer("regions-line", world);
        for (const id of [POINT_CIRCLES, POINT_LABELS]) showLayer(id, world || state.drill === "towns");
        for (const id of AREA_LAYERS) showLayer(id, showing && Boolean(state.areas?.features.length));
        for (const id of TOWN_LAYERS) showLayer(id, state.drill === "towns");
        const nextTowns = state.drill === "towns" ? state.towns : [];
        const townKey = nextTowns.map((town) => `${town.id}:${town.open}:${town.tip}`).join("|");
        if (townKey !== townDataKey) {
          townDataKey = townKey;
          setGeo(map, "fw-towns", townGeo(nextTowns));
          markedTown = null;
        }
        markArea("fw-admin1", markedArea, state.selectedAreaId, "selected");
        markedArea = state.selectedAreaId;
        markArea("fw-admin1", markedHover, state.hoverAreaId, "hover");
        markedHover = state.hoverAreaId;
        const townSelected = state.drill === "towns" ? state.selectedTownId : null;
        markArea("fw-towns", markedTown, townSelected, "selected");
        markedTown = townSelected;
      };
      syncDrill.current = syncAreas;

      const hitPad = (event: { originalEvent?: Event }) => {
        const native = event.originalEvent;
        if (native && "pointerType" in native && (native as PointerEvent).pointerType === "touch") return 16;
        if (native && native.type.startsWith("touch")) return 16;
        return 8;
      };
      const pickHit = (point: { x: number; y: number }, pad: number): Hit | null => {
        const layers = [
          ...POINT_HIT,
          ...TOWN_PICK,
          ...AREA_PICK,
          ...COUNTRY_PICK,
          ...REGION_BUBBLE,
          "blocked-fill",
          "regions-fill",
          ...BASE_LABELS,
        ].filter((id) => map.getLayer(id));
        if (layers.length === 0) return null;
        const box: [[number, number], [number, number]] = [
          [point.x - pad, point.y - pad],
          [point.x + pad, point.y + pad],
        ];
        const features = map.queryRenderedFeatures(box, { layers });
        const first = (group: string[]) => features.find((feature) => group.includes(feature.layer.id));
        const pointHit = first(POINT_HIT);
        const pointId = pointHit ? textProp(pointHit, "id") : null;
        if (pointHit && pointId) return { kind: "point", id: pointId, tip: textProp(pointHit, "name") ?? "" };
        const townHit = first(TOWN_PICK);
        const townId = townHit ? textProp(townHit, "id") : null;
        if (townHit && townId) return { kind: "town", id: townId, tip: textProp(townHit, "tip") ?? "" };
        const areaHit = first(AREA_PICK);
        const areaId = areaHit ? textProp(areaHit, "id") : null;
        if (areaHit && areaId) return { kind: "area", id: areaId, tip: textProp(areaHit, "tip") ?? "" };
        const countryHit = first(COUNTRY_PICK);
        const countryId = countryHit ? textProp(countryHit, "key") : null;
        if (countryHit && countryId) {
          const west = Number(countryHit.properties?.west);
          const east = Number(countryHit.properties?.east);
          const south = Number(countryHit.properties?.south);
          const north = Number(countryHit.properties?.north);
          return { kind: "country", id: countryId, tip: textProp(countryHit, "tip") ?? "", west, east, south, north };
        }
        const bubble = first(REGION_BUBBLE);
        const bubbleId = bubble ? textProp(bubble, "key") : null;
        if (bubble && bubbleId) return { kind: "region", id: bubbleId, tip: textProp(bubble, "tip") ?? "" };
        const blockedHit = first(["blocked-fill"]);
        const blockedName = blockedHit ? textProp(blockedHit, "name") : null;
        if (blockedHit && blockedName) return { kind: "blocked", id: blockedName, tip: blockedName };
        const fill = first(["regions-fill"]);
        const fillId = fill ? textProp(fill, "regionId") : null;
        if (fill && fillId) {
          const name = textProp(fill, "name") ?? fillId;
          const items = pointsRef.current.filter((item) => item.regionId === fillId);
          const projects = items.filter((item) => item.kind === "project").length;
          const requests = items.filter((item) => item.kind === "request").length;
          return { kind: "region", id: fillId, tip: placeTip(name, { projects, requests, workers: 0 }) };
        }
        if (drillRef.current.drill !== "world") return null;
        const label = first(BASE_LABELS);
        const labelName = label ? textProp(label, "name_en") ?? textProp(label, "name") : null;
        if (label && labelName) return { kind: "basemap", id: labelName, tip: labelName };
        return null;
      };
      const send = (hit: Hit) => {
        if (hit.kind === "point") handlers.current.onPoint(hit.id);
        else if (hit.kind === "town") handlers.current.onTown?.(hit.id);
        else if (hit.kind === "area") handlers.current.onArea?.(hit.id);
        else if (hit.kind === "country") {
          if (handlers.current.onCountry) handlers.current.onCountry(hit.id);
          else if ([hit.west, hit.east, hit.south, hit.north].every((value) => typeof value === "number" && Number.isFinite(value))) {
            moveTo({
              kind: "bounds",
              bounds: { west: hit.west ?? 0, east: hit.east ?? 0, south: hit.south ?? 0, north: hit.north ?? 0 },
              maxZoom: 8.4,
            });
          }
        } else if (hit.kind === "region") handlers.current.onRegion(hit.id);
        else if (hit.kind === "blocked") handlers.current.onBlocked(hit.id);
        else handlers.current.onMapCountry?.(hit.id);
      };
      let lastKey = "";
      let lastAt = 0;
      const showTip = (text: string, point: { x: number; y: number }) => {
        const tip = tipRef.current;
        if (!tip) return;
        tip.textContent = text;
        tip.classList.remove("hidden");
        const width = tip.offsetWidth;
        const height = tip.offsetHeight;
        let x = point.x + 14;
        let y = point.y + 14;
        if (x + width > container.clientWidth - 8) x = Math.max(8, point.x - width - 14);
        if (y + height > container.clientHeight - 8) y = Math.max(8, point.y - height - 14);
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
      };
      const hideTip = () => {
        tipRef.current?.classList.add("hidden");
      };
      map.on("click", (event) => {
        const hit = pickHit(event.point, hitPad(event));
        if (flying && hit) return;
        const key = hit ? `${hit.kind}:${hit.id}` : "empty";
        const now = performance.now();
        if (key === lastKey && now - lastAt < 300) return;
        lastKey = key;
        lastAt = now;
        if (!hit) {
          hideTip();
          handlers.current.onEmpty?.();
          return;
        }
        send(hit);
      });
      let hoverFrame = 0;
      let hoverEvent: MapLayerMouseEvent | null = null;
      map.on("mousemove", (event) => {
        hoverEvent = event;
        if (hoverFrame) return;
        hoverFrame = window.requestAnimationFrame(() => {
          hoverFrame = 0;
          const current = hoverEvent;
          if (!current) return;
          const touch = hitPad(current) === 16 || !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
          if (touch) {
            map.getCanvas().style.cursor = "";
            hideTip();
            return;
          }
          const hit = pickHit(current.point, 8);
          map.getCanvas().style.cursor = hit ? "pointer" : "";
          if (!hit?.tip) {
            hideTip();
            return;
          }
          showTip(hit.tip, current.point);
        });
      });
      map.on("mouseout", () => {
        map.getCanvas().style.cursor = "";
        hideTip();
      });

      map.getCanvas().setAttribute("aria-label", "Map of open projects and requests");
      applyPad();
      applyLimits();
      syncData();
      syncAreas();
      flyRef.current = moveTo;
      const waiting = latestFly.current ?? pendingFly.current;
      pendingFly.current = null;
      moveTo(waiting ?? { kind: "world" });
    });

    map.on("moveend", () => {
      const view = { bounds: readBounds(map), zoom: map.getZoom() };
      if (boot) {
        boot = false;
        handlers.current.onReady(view);
        return;
      }
      const fromUser = gesture;
      gesture = false;
      handlers.current.onMove(view, fromUser);
    });

    return () => {
      window.clearTimeout(timer);
      wide.removeEventListener("change", syncZoomControl);
      resizeObserver.disconnect();
      mutation.disconnect();
      syncRef.current = null;
      syncDrill.current = null;
      flyRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!fly) return;
    latestFly.current = fly;
    if (flyRef.current) flyRef.current(fly);
    else pendingFly.current = fly;
  }, [fly]);

  const previewId = previewAt?.id ?? null;
  const previewLng = previewAt?.lng ?? null;
  const previewLat = previewAt?.lat ?? null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || previewId === null || previewLng === null || previewLat === null) return;
    let popup: Popup | null = null;
    let dead = false;
    const mount = () => {
      if (dead || !mapRef.current) return;
      const el = document.createElement("div");
      el.className = "w-[320px]";
      popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        closeOnMove: false,
        anchor: "bottom",
        offset: [0, -16],
        maxWidth: "320px",
        className: "fw-preview",
      })
        .setLngLat([previewLng, previewLat])
        .setDOMContent(el)
        .addTo(mapRef.current);
      setPopupSlot(el);
    };
    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);
    return () => {
      dead = true;
      map.off("load", mount);
      popup?.remove();
      setPopupSlot(null);
    };
  }, [previewId, previewLng, previewLat]);

  return (
    <div className="relative h-full w-full">
      <div ref={host} className="fw-map h-full w-full bg-[#d7ebe3]" />
      <div
        ref={tipRef}
        role="tooltip"
        className="pointer-events-none absolute z-30 hidden max-w-xs rounded-lg bg-card px-2 py-1 text-sm text-foreground shadow ring-1 ring-border"
      />
      <div className="pointer-events-none absolute bottom-[calc(var(--fw-sheet,0px)+2.75rem)] left-3 z-10 flex items-center gap-2 rounded-full bg-card/95 px-3 py-1 text-sm shadow ring-1 ring-border">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="size-3 rounded-sm border border-[#0e5c3a]" style={{ background: SHADE[0] }} />
          <span className="size-3 rounded-sm border border-[#0e5c3a]" style={{ background: SHADE[1] }} />
          <span className="size-3 rounded-sm border border-[#0e5c3a]" style={{ background: SHADE[2] }} />
        </span>
        More shade, more open.
      </div>
      {popupSlot && preview ? createPortal(preview, popupSlot) : null}
    </div>
  );
}
