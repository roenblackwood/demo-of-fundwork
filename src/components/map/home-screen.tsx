"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FilterBar } from "@/components/filter-bar";
import { ProjectCard } from "@/components/project-card";
import { RequestCard } from "@/components/request-card";
import { MapLoadNote, PlaceSearch, ShowMapButton } from "@/components/map/chrome";
import { useMapPhase } from "@/components/map/lite";
import { MapView } from "@/components/map/map-view";
import { readSheetStop, ResultsSheet, writeSheetStop, type SheetStop } from "@/components/map/results-sheet";
import { useDemo } from "@/lib/demo-store";
import { defaultListOrder, emptyFilters, passesFilters, type AppliedFilters, type ListOrder } from "@/lib/list-filters";
import { projectCommitted } from "@/lib/ownership";
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
import { getRegion, showcaseById } from "@/lib/regions";
import { getCity, getParish, getTown } from "@/lib/seed";
import type { Sector, Skill } from "@/lib/types";

type NotedOpening = Opening & {
  score: number;
  reasons: string[];
  parts: ScorePart[];
};

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
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
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
  const profileKey = `${demo.ready ? "1" : "0"}:${demo.userId}:${demo.profileSet ? "1" : "0"}`;
  const [order, setOrder] = useState<ListOrder>("newest");
  const [orderKey, setOrderKey] = useState("");
  if (demo.ready && orderKey !== profileKey) {
    setOrderKey(profileKey);
    setOrder(defaultListOrder(demo.profileSet, Boolean(homeSpot(demo)?.townId)));
  }
  const token = useRef(0);
  const flew = useRef(false);
  const failedRef = useRef(false);

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

  const regionLock = listed && phase === "map" ? null : regionId;
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (sector && row.sector !== sector) return false;
      if (regionLock && row.regionId !== regionLock) return false;
      return passesFilters({
        kind: row.kind,
        checks: row.project?.checks,
        readiness: row.request?.readiness ?? row.project?.readiness,
        confirmedAmount: row.project
          ? projectCommitted(row.project.committedJmd, demo.addedCommitments, row.project.id)
          : 0,
        skillIds: row.project ? row.project.needs : row.request ? row.request.skills : [],
        filters: applied,
      });
    });
  }, [rows, sector, regionLock, applied, demo.addedCommitments]);
  const visible = inBounds(filtered, phase === "map" ? listed : null);
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

  function toggleEverywhere(next = !demo.seeEverywhere) {
    demo.setSeeEverywhere(next);
    if (next) goWorld();
    else {
      const target = reachTarget({ ...demo, seeEverywhere: false });
      if (target) ask(target);
    }
  }

  function toggleNear(next = !demo.nearMe) {
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

  function retryMap() {
    failedRef.current = false;
    setListed(null);
    setPending(null);
    setAreaMoved(false);
    showMap();
  }

  function renderFilters() {
    const spot = homeSpot(demo);
    const regionName = regionId ? (getRegion(regionId)?.name ?? "") : "";
    const town = spot?.townId
      ? spot.parishId
        ? getTown(spot.parishId, spot.townId)
        : getCity(spot.countryId, spot.townId)
      : undefined;
    const skills = demo.role === "worker" ? workerSkillIds(demo) : undefined;
    return (
      <FilterBar
        placeLabel={regionName || town?.name || "Place"}
        placeHref={applied.kind === "request" ? "/work/place" : "/invest/place"}
        onTown={(place) => {
          demo.setHomeTown(place);
          const point = place.parishId ? getTown(place.parishId, place.townId) : getCity(place.countryId, place.townId);
          if (!point) return;
          // The camera token changes only after this click.
          // eslint-disable-next-line react-hooks/refs
          ask({ kind: "center", center: [point.lng, point.lat], zoom: 11 });
        }}
        sector={sector}
        onSector={setSector}
        order={order}
        onOrder={setOrder}
        applied={applied}
        onApply={setApplied}
        skills={skills}
        homeToggle={applied.kind === "project" ? "invest" : applied.kind === "request" ? "work" : null}
        nearMe={demo.role === "investor" && demo.profileSet ? demo.nearMe : undefined}
        seeEverywhere={demo.role === "worker" && demo.profileSet ? demo.seeEverywhere : undefined}
        onNearMe={demo.role === "investor" && demo.profileSet ? toggleNear : undefined}
        onSeeEverywhere={demo.role === "worker" && demo.profileSet ? toggleEverywhere : undefined}
        placeChip={
          regionName
            ? {
                label: regionName,
                onRemove: () => {
                  // The camera token changes only after this click.
                  // eslint-disable-next-line react-hooks/refs
                  goWorld();
                },
              }
            : null
        }
        onClear={() => {
          setApplied(emptyFilters);
          setSector(null);
          if (demo.nearMe) demo.setNearMe(false);
          if (demo.seeEverywhere) demo.setSeeEverywhere(false);
          goWorld();
        }}
      />
    );
  }

  const mapFrame =
    phase === "map" || failed
      ? "fixed top-[var(--fw-top)] right-0 bottom-[var(--fw-bottom)] left-[var(--fw-left)] z-20"
      : "fixed top-[var(--fw-top)] right-0 bottom-[var(--fw-bottom)] left-[var(--fw-left)] z-20 invisible";

  return (
    <>
      {mapLive || failed ? (
        <div className={mapFrame} aria-hidden={phase !== "map" && !failed}>
          <div className="flex h-full">
            <aside className="hidden h-full w-[400px] shrink-0 flex-col border-r border-border bg-background min-[840px]:flex">
              <div className="flex shrink-0 flex-col gap-2 p-3">
                {renderFilters()}
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">{openingList()}</div>
            </aside>
            <div className="relative h-full min-w-0 flex-1">
            {failed ? (
              <div className="hidden h-full place-items-center p-6 text-center min-[840px]:grid">
                <MapLoadNote onRetry={retryMap} />
              </div>
            ) : (
            <MapView
              points={filtered}
              showMarkers
              selectedId={selectedId}
              regionId={regionId}
              fly={fly}
              onReady={(view) => {
                if (failedRef.current) return;
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
                if (failedRef.current) return;
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
              onFail={() => {
                failedRef.current = true;
                setListed(null);
                setPending(null);
                setAreaMoved(false);
                mapFailed();
              }}
            />
            )}
            {phase === "map" ? (
            <div data-fw-pad="top" className="pointer-events-none absolute inset-x-0 top-0 z-10 min-[840px]:hidden">
              <div className="pointer-events-auto mx-auto flex w-full max-w-lg flex-col gap-2 px-3 pt-3 min-[600px]:mx-0 min-[600px]:max-w-[480px]">
                <PlaceSearch onPick={pickSearch} collapsible />
              </div>
            </div>
            ) : null}
            {phase === "map" && areaMoved ? (
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
            {phase === "map" && away ? (
              <button
                type="button"
                className="absolute left-3 z-10 inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-3 text-base font-semibold shadow"
                style={{ bottom: "calc(var(--fw-sheet, 6rem) + 0.75rem)" }}
                onClick={goWorld}
              >
                World
              </button>
            ) : null}
            {phase === "map" ? (
            <ResultsSheet
              label={label}
              notice={
                blockedName
                  ? `${blockedName} does not allow crypto yet, so Fundwork cannot open here.`
                  : null
              }
              stop={stop}
              onStop={chooseStop}
              toolbar={renderFilters()}
            >
              {openingList()}
            </ResultsSheet>
            ) : null}
            {failed ? (
              <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 min-[840px]:hidden">
                <PlaceSearch onPick={pickSearch} collapsible />
                {renderFilters()}
                <MapLoadNote onRetry={retryMap} />
                <p className="text-sm text-muted-foreground">{label}</p>
                {openingList()}
              </div>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {phase === "map" || failed ? null : (
        <div className="flex flex-1 flex-col gap-3">
          <div className="min-[840px]:hidden">
            <PlaceSearch onPick={pickSearch} collapsible />
          </div>
          {renderFilters()}
          {lite && phase !== "loading" ? <ShowMapButton onClick={retryMap} /> : null}
          <p className="text-sm text-muted-foreground">{label}</p>
          {openingList()}
        </div>
      )}
    </>
  );
}

function orderNoted(rows: NotedOpening[], order: ListOrder, profileSet: boolean): NotedOpening[] {
  if (order === "closest") return orderOpenings(rows) as NotedOpening[];
  if (order === "newest") return orderCards(rows, "newest", Date.now());
  if (!profileSet) return orderOpenings(rows) as NotedOpening[];
  return orderCards(rows, order, Date.now());
}

function workerSkillIds(demo: ReturnType<typeof useDemo>): Skill[] {
  const fromProfile = demo.profile.skillLevels.map((item) => item.skill);
  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  return [...new Set([primary, ...extras, ...fromProfile].filter((item): item is Skill => Boolean(item)))];
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
