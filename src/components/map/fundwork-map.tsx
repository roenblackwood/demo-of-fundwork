"use client";

import { useEffect, useRef } from "react";
import type { FeatureCollection } from "geojson";
import { LngLat, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
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

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const OCEAN = "#d7ebe3";
const LAND = "#e6e0d4";
const ROAD = "#f3efe6";
const CASING = "#e3dcd0";
const OPEN = "#0e5c3a";
const WORK = "#8c3418";
const PAPER = "#fffcf7";

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

function latFromMercatorY(y: number): number {
  return (Math.atan(Math.exp(Math.PI * (1 - 2 * y))) * 2 - Math.PI / 2) * (180 / Math.PI);
}

// The stock constraint zooms in until the world covers a tall screen.
// On a phone that crops the side regions, so keep zoom 0 and center the world.
function constrainView(container: HTMLElement, lngLat: LngLat, zoom: number) {
  const nextZoom = Math.min(18, Math.max(0, zoom));
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;
  const world = 512 * 2 ** nextZoom;
  let lng = lngLat.lng;
  let lat = lngLat.lat;
  const halfLng = ((width / world) * 360) / 2;
  if (halfLng < 180) {
    const limit = 180 - halfLng;
    lng = Math.min(limit, Math.max(-limit, lng));
  }
  if (world <= height) {
    lat = 0;
  } else {
    const halfY = height / 2 / world;
    lat = latFromMercatorY(Math.min(1 - halfY, Math.max(halfY, mercatorY(lat))));
  }
  return { center: new LngLat(lng, lat), zoom: nextZoom };
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

function levelOf(zoom: number, regionLocked: boolean): "region" | "country" | "point" {
  if (zoom >= POINT_ZOOM) return "point";
  if (regionLocked || zoom >= WORLD_ZOOM) return "country";
  return "region";
}

function markerButton(label: string, selected: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "fw-marker";
  button.dataset.fwMarker = "1";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", selected ? "true" : "false");
  button.style.width = "44px";
  button.style.height = "44px";
  button.style.display = "grid";
  button.style.placeItems = "center";
  button.style.padding = "0";
  button.style.border = "0";
  button.style.background = "transparent";
  button.style.cursor = "pointer";
  return button;
}

function dot(color: string, selected: boolean): HTMLSpanElement {
  const dotNode = document.createElement("span");
  dotNode.style.width = selected ? "22px" : "16px";
  dotNode.style.height = selected ? "22px" : "16px";
  dotNode.style.borderRadius = "999px";
  dotNode.style.background = color;
  dotNode.style.border = `2px solid ${PAPER}`;
  dotNode.style.boxShadow = "0 1px 3px rgb(26 35 48 / 0.28)";
  return dotNode;
}

function countBubble(count: number, color: string): HTMLSpanElement {
  const bubble = document.createElement("span");
  bubble.textContent = String(count);
  bubble.style.minWidth = "36px";
  bubble.style.height = "36px";
  bubble.style.padding = "0 8px";
  bubble.style.borderRadius = "999px";
  bubble.style.display = "grid";
  bubble.style.placeItems = "center";
  bubble.style.background = color;
  bubble.style.color = PAPER;
  bubble.style.fontWeight = "700";
  bubble.style.fontSize = "14px";
  bubble.style.border = `2px solid ${PAPER}`;
  bubble.style.boxShadow = "0 1px 3px rgb(26 35 48 / 0.28)";
  return bubble;
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

export function FundworkMap({
  points,
  showMarkers,
  selectedId,
  regionId,
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
  const markers = useRef<Marker[]>([]);
  const handlers = useRef<Handlers>({ onReady, onMove, onRegion, onBlocked, onPoint, onFail });
  const pointsRef = useRef(points);
  const showRef = useRef(showMarkers);
  const selectedRef = useRef(selectedId);
  const regionRef = useRef(regionId);
  const syncRef = useRef<(() => void) | null>(null);
  const flyRef = useRef<((request: FlyRequest) => void) | null>(null);
  const pendingFly = useRef<FlyRequest | null>(null);

  useEffect(() => {
    handlers.current = { onReady, onMove, onRegion, onBlocked, onPoint, onFail };
  });

  useEffect(() => {
    pointsRef.current = points;
    showRef.current = showMarkers;
    selectedRef.current = selectedId;
    regionRef.current = regionId;
    syncRef.current?.();
  }, [points, showMarkers, selectedId, regionId]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let map: MapLibreMap;
    try {
      // Turbopack serves this module from a chunk, so the default worker URL 404s.
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new MapLibreMap({
        container,
        style: STYLE,
        center: [20, 0],
        zoom: 0,
        minZoom: 0,
        renderWorldCopies: false,
        transformConstrain: (lngLat, zoom) => constrainView(container, lngLat, zoom),
        attributionControl: { compact: false },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
        fadeDuration: reducedMotion() ? 0 : 300,
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

    const wide = window.matchMedia("(min-width: 768px)");
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
    map.on("movestart", (event) => {
      if (event.originalEvent) gesture = true;
    });
    map.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (message.toLowerCase().includes("webgl")) handlers.current.onFail();
    });

    const moveTo = (request: FlyTarget) => {
      const duration = reducedMotion() ? 0 : 900;
      if (request.kind === "world") {
        map.fitBounds(
          [
            [WORLD_BOUNDS.west, WORLD_BOUNDS.south],
            [WORLD_BOUNDS.east, WORLD_BOUNDS.north],
          ],
          { padding: { top: 176, bottom: 148, left: 40, right: 40 }, maxZoom: 2.2, duration },
        );
        return;
      }
      if (request.kind === "center") {
        if (duration === 0) map.jumpTo({ center: request.center, zoom: request.zoom });
        else map.flyTo({ center: request.center, zoom: request.zoom, duration });
        return;
      }
      map.fitBounds(
        [
          [request.bounds.west, request.bounds.south],
          [request.bounds.east, request.bounds.north],
        ],
        { padding: { top: 188, bottom: 160, left: 48, right: 48 }, maxZoom: request.maxZoom, duration },
      );
    };
    flyRef.current = moveTo;

    const focusMarker = (current: HTMLButtonElement, step: number) => {
      const buttons = [...container.querySelectorAll<HTMLButtonElement>("[data-fw-marker]")];
      const index = buttons.indexOf(current);
      if (index < 0 || buttons.length === 0) return;
      buttons[(index + step + buttons.length) % buttons.length]?.focus();
    };

    const drawMarkers = () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      if (!showRef.current) return;
      const zoom = map.getZoom();
      const mode = levelOf(zoom, Boolean(regionRef.current));
      const items = spread(pointsRef.current);
      if (mode === "point") {
        for (const point of items) {
          const button = markerButton(`${point.name}, ${point.place}`, selectedRef.current === point.id);
          button.append(dot(point.kind === "request" ? WORK : OPEN, selectedRef.current === point.id));
          button.addEventListener("click", (event) => {
            event.stopPropagation();
            handlers.current.onPoint(point.id);
          });
          button.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowUp") {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            focusMarker(button, event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1);
          });
          markers.current.push(new Marker({ element: button }).setLngLat([point.lng, point.lat]).addTo(map));
        }
        return;
      }
      const groups = new Map<string, MarkerPoint[]>();
      for (const point of items) {
        const key = mode === "region" ? point.regionId : point.countryId;
        const list = groups.get(key) ?? [];
        list.push(point);
        groups.set(key, list);
      }
      for (const [key, list] of groups) {
        const lat = list.reduce((sum, point) => sum + point.lat, 0) / list.length;
        const lng = list.reduce((sum, point) => sum + point.lng, 0) / list.length;
        const name = mode === "region" ? list[0].regionName : list[0].countryName;
        const workOnly = list.every((point) => point.kind === "request");
        const button = markerButton(`${list.length} open in ${name}`, false);
        button.append(countBubble(list.length, workOnly ? WORK : OPEN));
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          if (mode === "region") {
            handlers.current.onRegion(key);
            const camera = REGION_CAMERA[key];
            if (camera) moveTo({ kind: "center", center: camera.center, zoom: camera.zoom });
            return;
          }
          const west = Math.min(...list.map((point) => point.lng));
          const east = Math.max(...list.map((point) => point.lng));
          const south = Math.min(...list.map((point) => point.lat));
          const north = Math.max(...list.map((point) => point.lat));
          moveTo({
            kind: "bounds",
            bounds: { west, south, east, north },
            maxZoom: 8.4,
          });
        });
        button.addEventListener("keydown", (event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowDown" && event.key !== "ArrowLeft" && event.key !== "ArrowUp") {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          focusMarker(button, event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1);
        });
        markers.current.push(new Marker({ element: button }).setLngLat([lng, lat]).addTo(map));
      }
    };
    syncRef.current = drawMarkers;

    const applyShade = () => {
      if (!map.getLayer("regions-fill")) return;
      const show = !regionRef.current && map.getZoom() < WORLD_ZOOM;
      const visibility = show ? "visible" : "none";
      map.setLayoutProperty("regions-fill", "visibility", visibility);
      map.setLayoutProperty("regions-line", "visibility", visibility);
    };

    map.on("load", () => {
      restyle(map);
      const before = map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id;
      map.addSource("regions", { type: "geojson", data: regions as FeatureCollection });
      map.addLayer(
        {
          id: "regions-fill",
          type: "fill",
          source: "regions",
          paint: { "fill-color": "#9ec4b3", "fill-opacity": 0.78 },
        },
        before,
      );
      map.addLayer(
        {
          id: "regions-line",
          type: "line",
          source: "regions",
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
      map.on("click", "blocked-fill", (event) => {
        const name = event.features?.[0]?.properties?.name;
        if (typeof name !== "string") return;
        handlers.current.onBlocked(name);
      });
      map.on("mouseenter", "blocked-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "blocked-fill", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "regions-fill", (event) => {
        if (regionRef.current || map.getZoom() >= WORLD_ZOOM) return;
        const quiet = map.queryRenderedFeatures(event.point, { layers: ["blocked-fill"] });
        if (quiet.length > 0) return;
        const value = event.features?.[0]?.properties?.regionId;
        if (typeof value !== "string") return;
        handlers.current.onRegion(value);
        const camera = REGION_CAMERA[value];
        if (camera) moveTo({ kind: "center", center: camera.center, zoom: camera.zoom });
      });
      map.on("mouseenter", "regions-fill", () => {
        if (!regionRef.current && map.getZoom() < WORLD_ZOOM) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "regions-fill", () => {
        map.getCanvas().style.cursor = "";
      });
      map.getCanvas().setAttribute("aria-label", "Map of open projects and requests");
      const waiting = pendingFly.current;
      pendingFly.current = null;
      moveTo(waiting ?? { kind: "world" });
      applyShade();
    });

    map.on("moveend", () => {
      applyShade();
      drawMarkers();
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
      wide.removeEventListener("change", syncZoomControl);
      markers.current.forEach((marker) => marker.remove());
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
