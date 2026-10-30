"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProjectCard } from "@/components/project-card";
import { RequestCard } from "@/components/request-card";
import { FilterChips, MapLoadNote, PlaceSearch, ShowMapButton } from "@/components/map/chrome";
import { useMapPhase } from "@/components/map/lite";
import { MapView } from "@/components/map/map-view";
import { readSheetStop, ResultsSheet, writeSheetStop, type SheetStop } from "@/components/map/results-sheet";
import { useDemo } from "@/lib/demo-store";
import {
  REGION_CAMERA,
  WORLD_ZOOM,
  boundsAround,
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
import {
  explainItem,
  itemFromProject,
  itemFromRequest,
  orderCards,
  regionOf,
  workerAllows,
} from "@/lib/profile";
import type { ScorePart } from "@/lib/recommend";
import { showcaseById } from "@/lib/regions";
import { getCity, getParish, getTown } from "@/lib/seed";
import type { Sector } from "@/lib/types";
import { cn } from "cn";

type HomeOrder = "for-you" | "closest" | "newest";

type NotedOpening = Opening & {
  score: number;
  reasons: string[];
  parts: ScorePart[];
};

const orderChip =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-border bg-card px-3 text-base font-semibold whitespace-nowrap hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

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

function OpeningCard({
  row,
  selected,
  onHover,
  reason,
  parts,
}: {
  row: Opening;
  selected: boolean;
  onHover: (id: string | null) => void;
  reason?: string;
  parts?: ScorePart[];
}) {
  function enter() {
    if (window.matchMedia("(min-width: 840px)").matches) onHover(row.id);
  }
  function leave() {
    if (window.matchMedia("(min-width: 840px)").matches) onHover(null);
  }
  const frame = selected ? "rounded-2xl ring-2 ring-primary" : "";
  if (row.project) {
    return (
      <div data-opening={row.id} data-sector={row.sector} className={frame} onMouseEnter={enter} onMouseLeave={leave}>
        <ProjectCard project={row.project} reason={reason} parts={parts} />
      </div>
    );
  }
  if (row.request) {
    return (
      <div data-opening={row.id} data-sector={row.sector} className={frame} onMouseEnter={enter} onMouseLeave={leave}>
        <RequestCard request={row.request} reason={reason} parts={parts} />
      </div>
    );
  }
  return null;
}

export function HomeScreen() {
  const demo = useDemo();
  const { phase, lite, failed, showMap, mapReady, mapFailed } = useMapPhase();
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
  const profileKey = `${demo.userId}:${demo.profileSet ? "1" : "0"}`;
  const [order, setOrder] = useState<HomeOrder>(demo.profileSet ? "for-you" : "closest");
  const [orderKey, setOrderKey] = useState(profileKey);
  if (orderKey !== profileKey) {
    setOrderKey(profileKey);
    setOrder(demo.profileSet ? "for-you" : "closest");
  }
  const token = useRef(0);
  const flew = useRef(false);

  useEffect(() => {
    const saved = readSheetStop();
    if (saved !== "peek") {
      // The sheet stop is stored for this tab only.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStop(saved);
    }
    const raw = sessionStorage.getItem("fundwork-place");
    if (!raw) return;
    sessionStorage.removeItem("fundwork-place");
    try {
      const hit = JSON.parse(raw) as SearchHit;
      setRegionId(hit.regionId);
      setSelectedId(null);
      setBlockedName(null);
      flew.current = true;
      token.current += 1;
      setFly({
        kind: "center",
        center: [hit.lng, hit.lat],
        zoom: hit.kind === "town" ? 11 : hit.zoom || countryZoom(hit.countryId),
        token: token.current,
      });
    } catch {
      // Ignore a bad stored place.
    }
  }, []);

  useEffect(() => {
    if (!demo.ready || flew.current) return;
    const target = reachTarget(demo);
    if (!target) return;
    flew.current = true;
    token.current += 1;
    setFly({ ...target, token: token.current });
  }, [demo]);

  function chooseStop(next: SheetStop) {
    setStop(next);
    writeSheetStop(next);
  }

  const rows = useMemo(() => noteRows(demo), [demo]);

  const regionLock = listed ? null : regionId;
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (lens === "invest" && row.kind !== "project") return false;
      if (lens === "work" && row.kind !== "request") return false;
      if (sector && row.sector !== sector) return false;
      if (regionLock && row.regionId !== regionLock) return false;
      return true;
    });
  }, [rows, lens, sector, regionLock]);
  const visible = inBounds(filtered, listed);
  const ordered = orderNoted(visible as NotedOpening[], order, demo.profileSet);
  const selected = selectedId ? rows.find((row) => row.id === selectedId) : undefined;
  const shown = selected
    ? [selected, ...ordered.filter((row) => row.id !== selected.id)]
    : ordered;
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
      const nodes = document.querySelectorAll<HTMLElement>(`[data-opening="${CSS.escape(id)}"]`);
      const visible = [...nodes].find((node) => node.getClientRects().length > 0);
      visible?.scrollIntoView({ block: "nearest" });
    });
  }

  const away = Boolean(regionId) || zoom >= WORLD_ZOOM;
  const mapLive = phase === "loading" || phase === "map";

  function toggleEverywhere() {
    const next = !demo.seeEverywhere;
    demo.setSeeEverywhere(next);
    if (next) goWorld();
    else {
      const target = reachTarget({ ...demo, seeEverywhere: false });
      if (target) ask(target);
    }
  }

  function toggleNear() {
    const next = !demo.nearMe;
    demo.setNearMe(next);
    if (!next) {
      goWorld();
      return;
    }
    const spot = homeSpot(demo);
    const point = spot?.parishId
      ? getTown(spot.parishId, spot.townId)
      : spot
        ? getCity(spot.countryId, spot.townId)
        : undefined;
    if (point) ask({ kind: "center", center: [point.lng, point.lat], zoom: 11 });
  }

  const openingList = () => (
    <div className="space-y-2" data-order={order}>
      {shown.map((row) => {
        const noted = row as NotedOpening;
        const explain = order === "for-you" && noted.reasons?.length ? noted.reasons.join(" · ") : undefined;
        return (
          <OpeningCard
            key={row.id}
            row={row}
            selected={selectedId === row.id}
            onHover={setSelectedId}
            reason={explain}
            parts={explain ? noted.parts : undefined}
          />
        );
      })}
    </div>
  );

  const orderRow = (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Order">
      {demo.role === "worker" && demo.profileSet ? (
        <button
          type="button"
          aria-pressed={demo.seeEverywhere}
          onClick={toggleEverywhere}
          className={cn(orderChip, demo.seeEverywhere && "border-work bg-work text-work-foreground hover:border-work")}
        >
          See everywhere
        </button>
      ) : null}
      {demo.role === "investor" && demo.profileSet ? (
        <button
          type="button"
          aria-pressed={demo.nearMe}
          onClick={toggleNear}
          className={cn(orderChip, demo.nearMe && "border-primary bg-primary text-primary-foreground hover:border-primary")}
        >
          Near me
        </button>
      ) : null}
      {(
        [
          ["for-you", "For you"],
          ["closest", "Closest"],
          ["newest", "Newest"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={order === id}
          onClick={() => setOrder(id)}
          className={cn(orderChip, order === id && "border-foreground bg-foreground text-background hover:border-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      {mapLive ? (
        <div
          className={
            phase === "map"
              ? "fixed top-[var(--fw-top)] right-0 bottom-[var(--fw-bottom)] left-[var(--fw-left)] z-20"
              : "fixed top-[var(--fw-top)] right-0 bottom-[var(--fw-bottom)] left-[var(--fw-left)] z-20 invisible"
          }
          aria-hidden={phase !== "map"}
        >
          <div className="flex h-full">
            <aside className="hidden h-full w-[400px] shrink-0 flex-col border-r border-border bg-background min-[840px]:flex">
              <div className="flex shrink-0 flex-col gap-2 p-3">
                <PlaceSearch onPick={pickSearch} />
                <FilterChips
                  lens={lens}
                  sector={sector}
                  regionId={regionId}
                  onLens={setLens}
                  onSector={setSector}
                  onRegion={goRegion}
                  wrap
                />
                {orderRow}
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">{openingList()}</div>
            </aside>
            <div className="relative h-full min-w-0 flex-1">
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
            <div data-fw-pad="top" className="pointer-events-none absolute inset-x-0 top-0 z-10 min-[840px]:hidden">
              <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2 px-3 pt-3 min-[600px]:mx-0 min-[600px]:max-w-[480px]">
                <PlaceSearch onPick={pickSearch} collapsible />
                <FilterChips
                  lens={lens}
                  sector={sector}
                  regionId={regionId}
                  onLens={setLens}
                  onSector={setSector}
                  onRegion={goRegion}
                />
                {orderRow}
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
              {openingList()}
            </ResultsSheet>
            </div>
          </div>
        </div>
      ) : null}
      {phase === "map" ? null : (
        <div className="flex flex-1 flex-col gap-3">
          <PlaceSearch onPick={pickSearch} collapsible />
          <FilterChips
            lens={lens}
            sector={sector}
            regionId={regionId}
            onLens={setLens}
            onSector={setSector}
            onRegion={(id) => {
              setRegionId(id);
              setSelectedId(null);
              setBlockedName(null);
            }}
          />
          {orderRow}
          {failed ? <MapLoadNote onRetry={showMap} /> : null}
          {lite && !failed && phase !== "loading" ? <ShowMapButton onClick={showMap} /> : null}
          <p className="text-sm text-muted-foreground">{label}</p>
          {openingList()}
        </div>
      )}
    </>
  );
}

function orderNoted(rows: NotedOpening[], order: HomeOrder, profileSet: boolean): NotedOpening[] {
  if (!profileSet || order === "closest") return orderOpenings(rows) as NotedOpening[];
  return orderCards(rows, order, Date.now());
}

function noteRows(demo: ReturnType<typeof useDemo>): NotedOpening[] {
  const spot = homeSpot(demo);
  const hidden = new Set(demo.hiddenIds);
  const projects = demo.projects.map((project) => openingFromProject(project, demo.addedCommitments, spot));
  const requests = demo.requests.map((request) => openingFromRequest(request, spot));
  return [...projects, ...requests].flatMap((row) => {
    if (!row || hidden.has(row.id) || !allowsHome(demo, row)) return [];
    return [annotate(demo, row)];
  });
}

function allowsHome(demo: ReturnType<typeof useDemo>, row: Opening): boolean {
  const spot = homeSpot(demo);
  if (demo.role === "worker" && demo.profileSet) {
    return workerAllows(demo.profile, spot, demo.seeEverywhere, row);
  }
  if (demo.role === "investor" && demo.profileSet && demo.nearMe) {
    if (!spot?.townId) return false;
    return (
      row.countryId === spot.countryId &&
      row.townId === spot.townId &&
      (row.parishId ?? null) === (spot.parishId ?? null)
    );
  }
  return true;
}

function annotate(demo: ReturnType<typeof useDemo>, row: Opening): NotedOpening {
  const empty = { ...row, score: 0, reasons: [] as string[], parts: [] as ScorePart[] };
  if (!demo.profileSet) return empty;
  const item = row.project
    ? itemFromProject(row.project, demo.addedCommitments)
    : row.request
      ? itemFromRequest(row.request, demo.applications, demo.pledges)
      : null;
  if (!item) return empty;
  const explained = explainItem(
    item,
    demo.role === "worker" || demo.role === "investor" ? demo.role : null,
    demo.profile,
    homeSpot(demo),
    demo.seeEverywhere,
    demo.sectorDown[row.sector] ?? 0,
    Date.now(),
  );
  return {
    ...row,
    score: explained?.score ?? 0,
    reasons: explained?.reasons ?? [],
    parts: explained?.parts ?? [],
  };
}

function reachTarget(demo: ReturnType<typeof useDemo>): FlyTarget | null {
  if (demo.role !== "worker" || !demo.profileSet || demo.seeEverywhere) return null;
  const spot = homeSpot(demo);
  if (!spot?.townId) return null;
  const reach = demo.profile.reach;
  if (reach === "town" || (reach === "parish" && !spot.parishId)) {
    const point = spot.parishId ? getTown(spot.parishId, spot.townId) : getCity(spot.countryId, spot.townId);
    if (!point) return null;
    return { kind: "center", center: [point.lng, point.lat], zoom: 11 };
  }
  if (reach === "parish" && spot.parishId) {
    const parish = getParish(spot.parishId);
    if (!parish || parish.towns.length === 0) return null;
    const lats = parish.towns.map((town) => town.lat);
    const lngs = parish.towns.map((town) => town.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const span = Math.max(0.35, (Math.max(...lats) - Math.min(...lats)) / 2, (Math.max(...lngs) - Math.min(...lngs)) / 2);
    return { kind: "bounds", bounds: boundsAround(midLat, midLng, span + 0.15), maxZoom: 10 };
  }
  if (reach === "country") {
    const country = showcaseById(spot.countryId);
    if (!country) return null;
    return {
      kind: "center",
      center: [country.coordinates[0], country.coordinates[1]],
      zoom: countryZoom(spot.countryId),
    };
  }
  const camera = REGION_CAMERA[regionOf(spot.countryId)];
  if (!camera) return null;
  return { kind: "center", center: camera.center, zoom: camera.zoom };
}
