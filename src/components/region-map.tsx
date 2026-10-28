"use client";

import { useCallback, useEffect, useState } from "react";
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
  if (name === "United Arab Emirates") return "Emirates";
  return name;
}

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
  const [hover, setHover] = useState<RegionId | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Projection pixels differ by a fraction on the server, which mismatches hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const keepLand = useCallback((features: Feature<Geometry>[]) => {
    return features.filter((feature) => {
      const name = countryName(feature);
      return name !== "Antarctica" && name !== "Fr. S. Antarctic Lands";
    });
  }, []);
  const view = selected ? REGION_VIEWS[selected] : null;
  const countries = selected ? countriesIn(selected) : [];

  if (!mounted) {
    return (
      <div
        className="aspect-[800/520] w-full rounded-3xl bg-[#d7ebe3] ring-1 ring-foreground/10"
        aria-label={selected ? "Region map. Choose a country." : "World map. Choose a region."}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl bg-[#d7ebe3] ring-1 ring-foreground/10">
      <ComposableMap
        projection="geoEqualEarth"
        width={800}
        height={520}
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
                      r={7}
                      fill={countryId === country.id ? PICKED : PAPER}
                      stroke={countryId === country.id ? PAPER : OPEN}
                      strokeWidth={2}
                    />
                    <text
                      textAnchor="middle"
                      y={
                        country.id === "nigeria" ||
                        country.id === "jordan" ||
                        country.id === "romania" ||
                        country.id === "trinidad" ||
                        country.id === "philippines" ||
                        country.id === "ukraine" ||
                        country.id === "bangladesh"
                          ? 24
                          : -16
                      }
                      fill={INK}
                      fontSize={13}
                      fontWeight={700}
                      fontFamily="var(--font-nunito), Nunito, sans-serif"
                      stroke={PAPER}
                      strokeWidth={4}
                      paintOrder="stroke"
                    >
                      {shortName(country.name)}
                    </text>
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
                />
              ))
            : null}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}

function RegionLabel({
  id,
  name,
  coordinates,
  selected,
  onSelect,
}: {
  id: RegionId;
  name: string;
  coordinates: [number, number];
  selected: boolean;
  onSelect: (id: RegionId) => void;
}) {
  const width = Math.max(108, name.length * 8.4 + 28);
  const height = 32;
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
          y={5}
          fill={text}
          fontSize={15}
          fontWeight={700}
          fontFamily="var(--font-nunito), Nunito, sans-serif"
        >
          {name}
        </text>
      </g>
    </Marker>
  );
}
