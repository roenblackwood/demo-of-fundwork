"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectCard } from "@/components/project-card";
import { RequestCard } from "@/components/request-card";
import { FilterChips, PlaceSearch, RegionChipRow, ShowMapButton } from "@/components/map/chrome";
import { useMapPhase } from "@/components/map/lite";
import { MapView } from "@/components/map/map-view";
import { readSheetStop, ResultsSheet, writeSheetStop, type SheetStop } from "@/components/map/results-sheet";
import { useDemo } from "@/lib/demo-store";
import {
  REGION_CAMERA,
  WORLD_ZOOM,
  countryZoom,
  type FlyRequest,
  type FlyTarget,
  type MapBounds,
} from "@/lib/map-camera";
import {
  inBounds,
  openLine,
  openingFromProject,
  openingFromRequest,
  orderOpenings,
  regionCount,
  type Opening,
  type SearchHit,
  type Spot,
} from "@/lib/openings";
import type { Sector } from "@/lib/types";

function homeSpot(input: {
  flow: { countryId?: string; parishId?: string; townId?: string } | null;
  homeCountryId: string | null;
  homeParishId: string | null;
  homeTownId: string | null;
}): Spot | null {
  if (input.flow?.countryId && input.flow.townId) {
    return {
      countryId: input.flow.countryId,
      parishId: input.flow.parishId ?? null,
      townId: input.flow.townId,
    };
  }
  if (input.homeCountryId && input.homeTownId) {
    return {
      countryId: input.homeCountryId,
      parishId: input.homeParishId,
      townId: input.homeTownId,
    };
  }
  return null;
}

function OpeningCard({ row }: { row: Opening }) {
  if (row.project) {
    return (
      <div id={`opening-${row.id}`}>
        <ProjectCard project={row.project} />
      </div>
    );
  }
  if (row.request) {
    return (
      <div id={`opening-${row.id}`}>
        <RequestCard request={row.request} />
      </div>
    );
  }
  return null;
}

export function HomeScreen() {
  const demo = useDemo();
  const { phase, lite, showMap, mapReady, mapFailed } = useMapPhase();
  const [lens, setLens] = useState<"invest" | "work" | null>(null);
  const [sector, setSector] = useState<Sector | null>(null);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [blockedName, setBlockedName] = useState<string | null>(null);
  const [listed, setListed] = useState<MapBounds | null>(null);
  const [pending, setPending] = useState<MapBounds | null>(null);
  const [areaMoved, setAreaMoved] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stop, setStop] = useState<SheetStop>("peek");
  const [fly, setFly] = useState<FlyRequest | null>(null);
  const token = useRef(0);
  const flew = useRef(false);

  useEffect(() => {
    const saved = readSheetStop();
    if (saved !== "peek") {
      // The sheet stop is stored for this tab only.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStop(saved);
    }
  }, []);

  function chooseStop(next: SheetStop) {
    setStop(next);
    writeSheetStop(next);
  }

  const rows = useMemo(() => {
    const spot = homeSpot(demo);
    const projects = demo.projects.map((project) => openingFromProject(project, demo.addedCommitments, spot));
    const requests = demo.requests.map((request) => openingFromRequest(request, spot));
    return orderOpenings([...projects, ...requests].filter((row): row is Opening => Boolean(row)));
  }, [demo]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (lens === "invest" && row.kind !== "project") return false;
      if (lens === "work" && row.kind !== "request") return false;
      if (sector && row.sector !== sector) return false;
      if (!listed && regionId && row.regionId !== regionId) return false;
      return true;
    });
  }, [rows, lens, sector, listed, regionId]);
  const visible = inBounds(filtered, listed);
  const selected = selectedId ? rows.find((row) => row.id === selectedId) : undefined;
  const shown = selected
    ? [selected, ...visible.filter((row) => row.id !== selected.id)]
    : visible;
  const label = openLine(visible.length, regionCount(visible));

  function ask(next: FlyTarget) {
    flew.current = true;
    token.current += 1;
    const request: FlyRequest = { ...next, token: token.current };
    setFly(request);
  }

  function goRegion(id: string) {
    const camera = REGION_CAMERA[id];
    if (!camera) return;
    setRegionId(id);
    setSelectedId(null);
    setBlockedName(null);
    ask({ kind: "center", center: camera.center, zoom: camera.zoom });
  }

  function goWorld() {
    setRegionId(null);
    setSelectedId(null);
    setBlockedName(null);
    ask({ kind: "world" });
  }

  function showBlocked(name: string) {
    setBlockedName(name);
    setSelectedId(null);
    chooseStop("half");
  }

  function pickSearch(hit: SearchHit) {
    setRegionId(hit.regionId);
    setSelectedId(null);
    setBlockedName(null);
    ask({ kind: "center", center: [hit.lng, hit.lat], zoom: hit.kind === "town" ? 11 : hit.zoom || countryZoom(hit.countryId) });
  }

  function pickPoint(id: string) {
    setSelectedId(id);
    setBlockedName(null);
    chooseStop("half");
    window.requestAnimationFrame(() => {
      document.getElementById(`opening-${id}`)?.scrollIntoView({ block: "start" });
    });
  }

  const away = Boolean(regionId) || zoom >= WORLD_ZOOM;
  const mapLive = phase === "loading" || phase === "map";

  const list = (
    <div className="space-y-2">
      {shown.map((row) => (
        <OpeningCard key={row.id} row={row} />
      ))}
    </div>
  );

  return (
    <>
      {mapLive ? (
        <div
          className={
            phase === "map"
              ? "fixed inset-x-0 top-14 bottom-16 z-20"
              : "fixed inset-x-0 top-14 bottom-16 z-20 invisible"
          }
          aria-hidden={phase !== "map"}
        >
          <div className="relative h-full">
            <MapView
              points={filtered}
              showMarkers
              selectedId={selectedId}
              regionId={regionId}
              fly={fly}
              onReady={(view) => {
                setListed(view.bounds);
                setZoom(view.zoom);
                setAreaMoved(false);
                mapReady();
                if (!flew.current && regionId && REGION_CAMERA[regionId]) {
                  ask({
                    kind: "center",
                    center: REGION_CAMERA[regionId].center,
                    zoom: REGION_CAMERA[regionId].zoom,
                  });
                }
              }}
              onMove={(view, gesture) => {
                setZoom(view.zoom);
                if (gesture && view.zoom < WORLD_ZOOM - 0.4) {
                  setRegionId(null);
                  setBlockedName(null);
                }
                if (gesture) {
                  setPending(view.bounds);
                  setAreaMoved(true);
                  return;
                }
                setListed(view.bounds);
                setAreaMoved(false);
              }}
              onRegion={goRegion}
              onBlocked={showBlocked}
              onPoint={pickPoint}
              onFail={mapFailed}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
              <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2 px-3 pt-3">
                <PlaceSearch onPick={pickSearch} />
                <FilterChips lens={lens} sector={sector} onLens={setLens} onSector={setSector} />
                {regionId ? null : <RegionChipRow selected={regionId} onSelect={goRegion} />}
              </div>
            </div>
            {areaMoved ? (
              <button
                type="button"
                className="absolute left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground shadow"
                style={{ bottom: "calc(var(--fw-sheet, 6rem) + 0.75rem)" }}
                onClick={() => {
                  if (pending) setListed(pending);
                  setAreaMoved(false);
                }}
              >
                Search this area
              </button>
            ) : null}
            {away ? (
              <button
                type="button"
                className="absolute left-3 z-10 inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-3 text-base font-semibold shadow"
                style={{ bottom: "calc(var(--fw-sheet, 6rem) + 0.75rem)" }}
                onClick={goWorld}
              >
                World
              </button>
            ) : null}
            <ResultsSheet
              label={label}
              notice={
                blockedName
                  ? `${blockedName} does not allow crypto yet, so Fundwork cannot open here.`
                  : null
              }
              stop={stop}
              onStop={chooseStop}
            >
              {list}
            </ResultsSheet>
          </div>
        </div>
      ) : null}
      {phase === "map" ? null : (
        <div className="flex flex-1 flex-col gap-3">
          <PlaceSearch onPick={pickSearch} />
          <FilterChips lens={lens} sector={sector} onLens={setLens} onSector={setSector} />
          <RegionChipRow selected={regionId} onSelect={setRegionId} />
          {lite ? <ShowMapButton onClick={showMap} /> : null}
          <p className="text-sm text-muted-foreground">{label}</p>
          {list}
        </div>
      )}
    </>
  );
}
