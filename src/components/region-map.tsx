"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Sphere,
  ZoomableGroup,
} from "react-simple-maps";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world from "@/lib/maps/countries-50m.json";
import {
  REGION_VIEWS,
  REGIONS,
  countriesIn,
  regionForCountry,
  showcaseByMapName,
  type RegionId,
} from "@/lib/regions";

const OCEAN = "#d7ebe3";
const QUIET = "#e6e0d4";
const OPEN = "#0e5c3a";
const AVAILABLE = "#9ec4b3";
const PICKED = "#8c3418";
const INK = "#1a2330";
const PAPER = "#fffcf7";

function countryName(feature: Feature<Geometry>): string {
  const name = feature.properties?.name;
  return typeof name === "string" ? name : "";
}

function shortName(name: string): string {
  if (name === "Trinidad and Tobago") return "Trinidad";
  return name;
}

type Anchor = "start" | "middle" | "end";

/** Screen-space nudges so a label does not sit on a neighbor. Barbados stays east of Jamaica. */
const LABEL_NUDGE: Record<string, { x: number; y: number; anchor: Anchor }> = {
  jamaica: { x: -72, y: -8, anchor: "end" },
  barbados: { x: 64, y: 4, anchor: "start" },
  trinidad: { x: 56, y: 36, anchor: "start" },
  jordan: { x: -48, y: 28, anchor: "end" },
  lebanon: { x: 48, y: -28, anchor: "start" },
  egypt: { x: 0, y: 40, anchor: "middle" },
  ghana: { x: -56, y: -8, anchor: "end" },
  nigeria: { x: 56, y: 28, anchor: "start" },
  kenya: { x: 48, y: -32, anchor: "start" },
  moldova: { x: 52, y: -8, anchor: "start" },
  romania: { x: -56, y: 24, anchor: "end" },
  ukraine: { x: 40, y: -36, anchor: "start" },
  india: { x: -64, y: 16, anchor: "end" },
  nepal: { x: -8, y: -40, anchor: "middle" },
  bangladesh: { x: 60, y: 12, anchor: "start" },
  vietnam: { x: -56, y: -12, anchor: "end" },
  philippines: { x: 60, y: 8, anchor: "start" },
  indonesia: { x: 0, y: 40, anchor: "middle" },
};

const DEFAULT_NUDGE = { x: 0, y: -36, anchor: "middle" as Anchor };

export function RegionMap({
  selected,
  countryId,
  onSelect,
  onSelectCountry,
}: {
  selected: RegionId | null;
  countryId?: string | null;
  onSelect: (id: RegionId) => void;
  onSelectCountry?: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<RegionId | null>(null);
  const [mounted, setMounted] = useState(false);
  const [labelPx, setLabelPx] = useState(30);
  useEffect(() => {
    // Projection pixels differ by a fraction on the server, which mismatches hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const apply = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      // 13 CSS pixels, in this map's SVG units, at the current width.
      setLabelPx(Math.max(30, (13 * 800) / width));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);
  const keepLand = useCallback((features: Feature<Geometry>[]) => {
    return features.filter((feature) => {
      const name = countryName(feature);
      return name !== "Antarctica" && name !== "Fr. S. Antarctic Lands";
    });
  }, []);
  const view = selected ? REGION_VIEWS[selected] : null;
  const countries = selected ? countriesIn(selected) : [];
  const mapHeight = selected ? 624 : 520;
  const zoom = view ? view.zoom : 1;

  if (!mounted) {
    return (
      <div
        ref={box}
        className={
          selected
            ? "aspect-[800/624] w-full rounded-3xl bg-[#d7ebe3] ring-1 ring-foreground/10"
            : "aspect-[800/520] w-full rounded-3xl bg-[#d7ebe3] ring-1 ring-foreground/10"
        }
        aria-label={selected ? "Region map. Choose a country." : "World map. Choose a region."}
      />
    );
  }

  return (
    <div ref={box} className="overflow-hidden rounded-3xl bg-[#d7ebe3] ring-1 ring-foreground/10">
      <ComposableMap
        projection="geoEqualEarth"
        width={800}
        height={mapHeight}
        projectionConfig={{ scale: 215, center: [10, 0] }}
        aria-label={selected ? "Region map. Choose a country." : "World map. Choose a region."}
        className="block h-auto w-full"
      >
        <ZoomableGroup
          center={view ? view.center : [10, 0]}
          zoom={view ? view.zoom : 1}
          minZoom={1}
          maxZoom={8}
          filterZoomEvent={() => false}
        >
          <Sphere fill={OCEAN} stroke={OCEAN} />
          <Geographies
            // The file is TopoJSON. The prop type lists GeoJSON, and the library accepts both.
            geography={world as unknown as FeatureCollection}
            parseGeographies={keepLand}
          >
            {({ geographies }) =>
              geographies.map((geography) => {
                const name = countryName(geography);
                const region = regionForCountry(name);
                const showcase = showcaseByMapName(name);
                const inView = Boolean(selected && region === selected);
                const pickedCountry = Boolean(countryId && showcase?.id === countryId);
                const hot = region !== null && region === hover && !selected;
                const fill = pickedCountry
                  ? PICKED
                  : inView
                    ? OPEN
                    : !region
                      ? QUIET
                      : hot
                        ? "#6fa88e"
                        : selected
                          ? "#d5e4dc"
                          : AVAILABLE;
                return (
                  <Geography
                    key={geography.rsmKey}
                    geography={geography}
                    tabIndex={-1}
                    aria-label={showcase ? showcase.name : region ? name : undefined}
                    onClick={() => {
                      if (selected && showcase && showcase.regionId === selected) {
                        onSelectCountry?.(showcase.id);
                        return;
                      }
                      if (region) onSelect(region);
                    }}
                    onMouseEnter={() => setHover(region)}
                    onMouseLeave={() => setHover(null)}
                    fill={fill}
                    stroke="#f4f1e8"
                    strokeWidth={0.6}
                    className={region ? "cursor-pointer" : "cursor-default"}
                  />
                );
              })
            }
          </Geographies>
          {selected
            ? countries.map((country) => (
                <Marker key={country.id} coordinates={[...country.coordinates]}>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={country.name}
                    aria-pressed={countryId === country.id}
                    onClick={() => onSelectCountry?.(country.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectCountry?.(country.id);
                      }
                    }}
                    className="cursor-pointer focus:outline-none"
                  >
                    <circle r={16} fill="transparent" />
                    <circle
                      r={4}
                      fill={countryId === country.id ? PICKED : PAPER}
                      stroke={countryId === country.id ? PAPER : OPEN}
                      strokeWidth={1.5}
                    />
                    <CountryLabel
                      id={country.id}
                      name={shortName(country.name)}
                      zoom={zoom}
                      labelPx={labelPx}
                    />
                  </g>
                </Marker>
              ))
            : null}
          {!selected ? (
            <Marker coordinates={[-77.4, 18.2]}>
              <circle r={5} fill={PAPER} stroke={OPEN} strokeWidth={2} />
            </Marker>
          ) : null}
          {!selected
            ? REGIONS.map((region) => (
                <RegionLabel
                  key={region.id}
                  id={region.id}
                  name={region.name}
                  coordinates={REGION_VIEWS[region.id].label}
                  selected={selected === region.id}
                  onSelect={onSelect}
                  labelPx={labelPx}
                />
              ))
            : null}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}

function CountryLabel({
  id,
  name,
  zoom,
  labelPx,
}: {
  id: string;
  name: string;
  zoom: number;
  labelPx: number;
}) {
  const nudge = LABEL_NUDGE[id] ?? DEFAULT_NUDGE;
  const lead = Math.abs(nudge.x) > 24 || Math.abs(nudge.y) > 24;
  return (
    <g transform={`scale(${1 / zoom})`}>
      {lead ? (
        <line x1={0} y1={0} x2={nudge.x} y2={nudge.y} stroke={INK} strokeWidth={2} />
      ) : null}
      <text
        x={nudge.x}
        y={nudge.y}
        textAnchor={nudge.anchor}
        dominantBaseline="middle"
        fill={INK}
        fontSize={labelPx}
        fontWeight={700}
        fontFamily="var(--font-inter), Inter, sans-serif"
        stroke={PAPER}
        strokeWidth={5}
        paintOrder="stroke"
      >
        {name}
      </text>
    </g>
  );
}

function RegionLabel({
  id,
  name,
  coordinates,
  selected,
  onSelect,
  labelPx,
}: {
  id: RegionId;
  name: string;
  coordinates: [number, number];
  selected: boolean;
  onSelect: (id: RegionId) => void;
  labelPx: number;
}) {
  const width = Math.max(labelPx * 3.2, name.length * labelPx * 0.52 + labelPx);
  const height = labelPx * 1.45;
  const fill = selected ? OPEN : PAPER;
  const text = selected ? "#f7fbf8" : INK;

  return (
    <Marker coordinates={coordinates}>
      <g
        role="button"
        tabIndex={0}
        aria-label={name}
        aria-pressed={selected}
        onClick={() => onSelect(id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(id);
          }
        }}
        className="cursor-pointer focus:outline-none"
      >
        <rect
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          rx={height / 2}
          fill={fill}
          stroke={selected ? OPEN : "#cfc8ba"}
          strokeWidth={2}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={0}
          fill={text}
          fontSize={labelPx}
          fontWeight={700}
          fontFamily="var(--font-inter), Inter, sans-serif"
        >
          {name}
        </text>
      </g>
    </Marker>
  );
}
