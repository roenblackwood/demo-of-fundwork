"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection, Point } from "geojson";
import { Map as MapLibreMap, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import regions from "@/lib/maps/regions-110m.json";
import blocked from "@/lib/maps/blocked-110m.json";
import {
  POINT_ZOOM,
  REGION_CAMERA,
  WORLD_BOUNDS,
  WORLD_ZOOM,
  type FlyRequest,
  type FlyTarget,
  type MapBounds,
} from "@/lib/map-camera";
import type { MarkerPoint } from "@/lib/openings";

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

const REGION_CIRCLES = "fw-region-circles";
const REGION_LABELS = "fw-region-labels";
const COUNTRY_CIRCLES = "fw-country-circles";
const COUNTRY_LABELS = "fw-country-labels";
const POINT_CIRCLES = "fw-point-circles";
const POINT_LABELS = "fw-point-labels";
const POINT_LAYERS = [REGION_CIRCLES, REGION_LABELS, COUNTRY_CIRCLES, COUNTRY_LABELS, POINT_CIRCLES, POINT_LABELS];

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

function fitZoom(width: number, height: number): number {
  const lngSpan = WORLD_BOUNDS.east - WORLD_BOUNDS.west;
  const ySpan = Math.max(0.0001, mercatorY(WORLD_BOUNDS.south) - mercatorY(WORLD_BOUNDS.north));
  const zoomX = Math.log2((Math.max(64, width) * 360) / (lngSpan * 512));
  const zoomY = Math.log2(Math.max(64, height) / (ySpan * 512));
  return Math.max(0, Math.min(zoomX, zoomY));
}

function emptyGeo(): FeatureCollection<Point> {
  return { type: "FeatureCollection", features: [] };
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
      const workOnly = list.every((point) => point.kind === "request");
      return {
        type: "Feature",
        id: key,
        properties: {
          key,
          name: mode === "region" ? list[0].regionName : list[0].countryName,
          count: list.length,
          tone: workOnly ? "work" : "open",
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

function setGeo(map: MapLibreMap, id: string, data: FeatureCollection<Point>) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  source?.setData(data);
}

function readPad(container: HTMLElement): Pad {
  const frame = container.parentElement;
  const box = container.getBoundingClientRect();
  const pad: Pad = { top: 0, bottom: 0, left: 0, right: 0 };
  if (!frame) return pad;
  frame.querySelectorAll<HTMLElement>("[data-fw-pad]").forEach((node) => {
    if (node.getClientRects().length === 0) return;
    const rect = node.getBoundingClientRect();
    const edge = node.dataset.fwPad;
    if (edge === "top") pad.top = Math.max(pad.top, rect.bottom - box.top);
    if (edge === "bottom") pad.bottom = Math.max(pad.bottom, box.bottom - rect.top);
    if (edge === "left") pad.left = Math.max(pad.left, rect.right - box.left);
    if (edge === "right") pad.right = Math.max(pad.right, box.right - rect.left);
  });
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
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const handlers = useRef<Handlers>({ onReady, onMove, onRegion, onBlocked, onPoint, onFail });
  const pointsRef = useRef(points);
  const showRef = useRef(showMarkers);
  const selectedRef = useRef(selectedId);
  const syncRef = useRef<(() => void) | null>(null);
  const flyRef = useRef<((request: FlyRequest) => void) | null>(null);
  const pendingFly = useRef<FlyRequest | null>(null);
  const dataKey = useRef("");
  const selectedKey = useRef<string | null>(null);

  useEffect(() => {
    handlers.current = { onReady, onMove, onRegion, onBlocked, onPoint, onFail };
  });

  useEffect(() => {
    pointsRef.current = points;
    showRef.current = showMarkers;
    selectedRef.current = selectedId;
    syncRef.current?.();
  }, [points, showMarkers, selectedId]);

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
    let tileOk = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      window.clearTimeout(timer);
      handlers.current.onFail();
    };
    const timer = window.setTimeout(() => {
      if (!styleOk || !tileOk) fail();
    }, LOAD_MS);
    const settled = () => {
      if (styleOk && tileOk) window.clearTimeout(timer);
    };

    map.on("movestart", (event) => {
      if (event.originalEvent) gesture = true;
    });
    map.on("dragstart", () => {
      if (flying) map.stop();
    });
    map.on("zoomstart", (event) => {
      if (event.originalEvent && flying) map.stop();
    });
    map.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (message.toLowerCase().includes("webgl")) fail();
    });
    map.on("sourcedata", (event) => {
      const sourceId = event.sourceId ?? "";
      if (!sourceId || sourceId === "regions" || sourceId === "blocked" || sourceId.startsWith("fw-")) return;
      if (event.isSourceLoaded) {
        tileOk = true;
        settled();
      }
    });

    const applyLimits = () => {
      map.resize();
      const pad = readPad(container);
      const width = container.clientWidth - pad.left - pad.right;
      const height = container.clientHeight - pad.top - 36;
      const minZoom = Math.min(8, fitZoom(width, height));
      if (Number.isFinite(minZoom)) map.setMinZoom(minZoom);
      map.setMaxBounds([
        [WORLD_BOUNDS.west - 10, Math.max(-85, WORLD_BOUNDS.south - 8)],
        [WORLD_BOUNDS.east + 10, Math.min(85, WORLD_BOUNDS.north + 8)],
      ]);
    };

    const applyPad = () => {
      const pad = readPad(container);
      map.setPadding(pad);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const boxChanged = entries.some((entry) => entry.target === container);
      applyPad();
      if (boxChanged) applyLimits();
    });
    resizeObserver.observe(container);
    const frame = container.parentElement;
    const mutation = new MutationObserver(() => {
      frame?.querySelectorAll("[data-fw-pad]").forEach((node) => resizeObserver.observe(node));
      applyPad();
    });
    if (frame) {
      mutation.observe(frame, { childList: true, subtree: true });
      frame.querySelectorAll("[data-fw-pad]").forEach((node) => resizeObserver.observe(node));
    }

    const travel = (center: [number, number], zoom: number) => {
      map.stop();
      flying = true;
      map.once("moveend", () => {
        flying = false;
      });
      if (reducedMotion()) {
        map.jumpTo({ center, zoom });
        return;
      }
      const point = map.project(center);
      const canvas = map.getCanvas();
      const onScreen = point.x >= 0 && point.y >= 0 && point.x <= canvas.width && point.y <= canvas.height;
      const close = Math.abs(zoom - map.getZoom()) < 2 && onScreen;
      if (close) map.easeTo({ center, zoom, duration: EASE_MS });
      else map.flyTo({ center, zoom, duration: FLY_MS });
    };

    const lookAt = (bounds: MapBounds, maxZoom: number) => {
      const camera = map.cameraForBounds(
        [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        { maxZoom },
      );
      if (!camera?.center || camera.zoom === undefined) return;
      const center = camera.center;
      const pair: [number, number] = Array.isArray(center)
        ? [Number(center[0]), Number(center[1])]
        : "lng" in center
          ? [center.lng, center.lat]
          : [center.lon, center.lat];
      travel(pair, camera.zoom);
    };

    const moveTo = (request: FlyTarget) => {
      if (request.kind === "world") {
        lookAt(WORLD_BOUNDS, 2.2);
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
    flyRef.current = moveTo;

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

    const pointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const plain = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("load", () => {
      if (failed) return;
      styleOk = true;
      settled();
      restyle(map);
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
      map.addSource("fw-region-totals", { type: "geojson", data: emptyGeo() });
      map.addSource("fw-country-totals", { type: "geojson", data: emptyGeo() });
      map.addSource("fw-points", { type: "geojson", data: emptyGeo(), promoteId: "id" });
      map.addLayer({
        id: REGION_CIRCLES,
        type: "circle",
        source: "fw-region-totals",
        maxzoom: WORLD_ZOOM,
        paint: {
          "circle-radius": 18,
          "circle-color": toneColor as never,
          "circle-stroke-width": 2,
          "circle-stroke-color": PAPER,
        },
      });
      map.addLayer({
        id: REGION_LABELS,
        type: "symbol",
        source: "fw-region-totals",
        maxzoom: WORLD_ZOOM,
        layout: {
          "text-field": ["to-string", ["get", "count"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-allow-overlap": true,
        },
        paint: { "text-color": PAPER },
      });
      map.addLayer({
        id: COUNTRY_CIRCLES,
        type: "circle",
        source: "fw-country-totals",
        minzoom: WORLD_ZOOM,
        maxzoom: POINT_ZOOM,
        paint: {
          "circle-radius": 18,
          "circle-color": toneColor as never,
          "circle-stroke-width": 2,
          "circle-stroke-color": PAPER,
        },
      });
      map.addLayer({
        id: COUNTRY_LABELS,
        type: "symbol",
        source: "fw-country-totals",
        minzoom: WORLD_ZOOM,
        maxzoom: POINT_ZOOM,
        layout: {
          "text-field": ["to-string", ["get", "count"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": 14,
          "text-allow-overlap": true,
        },
        paint: { "text-color": PAPER },
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

      const openRegion = (id: string) => {
        handlers.current.onRegion(id);
        const camera = REGION_CAMERA[id];
        if (camera) moveTo({ kind: "center", center: camera.center, zoom: camera.zoom });
      };
      map.on("click", "blocked-fill", (event) => {
        const name = event.features?.[0]?.properties?.name;
        if (typeof name === "string") handlers.current.onBlocked(name);
      });
      map.on("click", "regions-fill", (event) => {
        if (map.getZoom() >= WORLD_ZOOM) return;
        const quiet = map.queryRenderedFeatures(event.point, { layers: ["blocked-fill", REGION_CIRCLES] });
        if (quiet.length > 0) return;
        const value = event.features?.[0]?.properties?.regionId;
        if (typeof value === "string") openRegion(value);
      });
      map.on("click", REGION_CIRCLES, (event) => {
        const value = event.features?.[0]?.properties?.key;
        if (typeof value === "string") openRegion(value);
      });
      map.on("click", REGION_LABELS, (event) => {
        const value = event.features?.[0]?.properties?.key;
        if (typeof value === "string") openRegion(value);
      });
      map.on("click", COUNTRY_CIRCLES, (event) => openCountry(event.features?.[0]?.properties));
      map.on("click", COUNTRY_LABELS, (event) => openCountry(event.features?.[0]?.properties));
      map.on("click", POINT_CIRCLES, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") handlers.current.onPoint(id);
      });
      map.on("click", POINT_LABELS, (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") handlers.current.onPoint(id);
      });
      for (const layerId of ["blocked-fill", "regions-fill", ...POINT_LAYERS]) {
        map.on("mouseenter", layerId, pointer);
        map.on("mouseleave", layerId, plain);
      }

      map.getCanvas().setAttribute("aria-label", "Map of open projects and requests");
      applyPad();
      applyLimits();
      syncData();
      const waiting = pendingFly.current;
      pendingFly.current = null;
      moveTo(waiting ?? { kind: "world" });
    });

    function openCountry(properties: GeoJSON.GeoJsonProperties | null | undefined) {
      if (!properties) return;
      const west = Number(properties.west);
      const east = Number(properties.east);
      const south = Number(properties.south);
      const north = Number(properties.north);
      if (![west, east, south, north].every((value) => Number.isFinite(value))) return;
      moveTo({ kind: "bounds", bounds: { west, south, east, north }, maxZoom: 8.4 });
    }

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
      flyRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!fly) return;
    if (flyRef.current) flyRef.current(fly);
    else pendingFly.current = fly;
  }, [fly]);

  return <div ref={host} className="fw-map h-full w-full bg-[#d7ebe3]" />;
}
