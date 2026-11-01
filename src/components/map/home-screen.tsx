"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { GetStartedButton } from "@/components/getting-started";
import { ProjectCard } from "@/components/project-card";
import { RequestCard } from "@/components/request-card";
import { DrillBreadcrumb, DrillRows, EmptyPlace, type DrillRow } from "@/components/map/drill-list";
import { PreviewCard } from "@/components/map/preview-card";
import { MapLoadNote, PlaceSearch, ShowMapButton } from "@/components/map/chrome";
import { useMapPhase } from "@/components/map/lite";
import { MapView } from "@/components/map/map-view";
import { readSheetStop, ResultsSheet, writeSheetStop, type SheetStop } from "@/components/map/results-sheet";
import { AREA_BLOCKED_LINE, AREA_CAUTION_CHIP, areaMark } from "@/lib/area-rules";
import { boundsOfFeature, loadAdmin1, areaNoun, type AdminCollection } from "@/lib/admin1";
import { ADMIN1_BOUNDS } from "@/lib/admin1-bounds";
import { chipLabel, countryRule, countryRules, isListableCountry, rulesSummary } from "@/lib/country-rules";
import { useDemo } from "@/lib/demo-store";
import { codeForCountryName, countryDisplayName, drillFix, fallbackAreas, isOutsideCode, placeHref, samePlace, townsInArea, watchKey } from "@/lib/drill";
import { defaultListOrder, emptyFilters, passesFilters, type AppliedFilters, type ListOrder } from "@/lib/list-filters";
import { projectCommitted } from "@/lib/ownership";
import {
  REGION_CAMERA,
  WORLD_ZOOM,
  boundsAround,
  boundsContain,
  countryZoom,
  type FlyRequest,
  type FlyTarget,
  type MapBounds,
} from "@/lib/map-camera";
import {
  drillHref,
  isRegionId,
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
import { countsFor, openItems, placeTip, shadeStep } from "@/lib/place-counts";
import { topSectorTitles, usePlaceNotes } from "@/lib/region-fit";
import { getRegion, showcaseById, REGIONS } from "@/lib/regions";
import { getCity, getParish, getTown } from "@/lib/seed";
import { gatePath } from "@/lib/start-gate";
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

function useWideMap(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(min-width: 840px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 840px)").matches,
    () => false,
  );
}

export function HomeScreen() {
  usePlaceNotes();
  const wide = useWideMap();
  const demo = useDemo();
  const router = useRouter();
  const search = useSearchParams();
  const regionQ = search.get("region");
  const countryQ = search.get("country");
  const areaQ = search.get("area");
  const townQ = search.get("town");
  const itemQ = search.get("item");
  const regionOk = regionQ && isRegionId(regionQ) ? regionQ : null;
  const { phase, lite, failed, showMap, mapReady, mapFailed } = useMapPhase();
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
  const [sector, setSector] = useState<Sector | null>(null);
  const [areaStatus, setAreaStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [areaData, setAreaData] = useState<AdminCollection | null>(null);
  const [hoverAreaId, setHoverAreaId] = useState<string | null>(null);
  const [listed, setListed] = useState<MapBounds | null>(null);
  const [pending, setPending] = useState<MapBounds | null>(null);
  const [areaMoved, setAreaMoved] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [itemTrail, setItemTrail] = useState<string[]>([]);
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
  const flown = useRef("");
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
      router.replace(drillHref(hit), { scroll: false });
    } catch {
      // Ignore a bad stored place.
    }
  }, [router]);

  useEffect(() => {
    if (!demo.ready || flew.current || countryQ || regionOk) return;
    const regions = investorRegions(demo);
    if (regions) {
      flew.current = true;
      token.current += 1;
      setFly({ kind: "regions", ids: regions, token: token.current });
      return;
    }
    const target = reachTarget(demo);
    if (!target) return;
    flew.current = true;
    token.current += 1;
    setFly({ ...target, token: token.current });
  }, [demo, countryQ, regionOk]);

  useEffect(() => {
    if (!countryQ || !isListableCountry(countryQ)) return;
    let live = true;
    // The sheet names the file until it arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAreaStatus("loading");
    setAreaData(null);
    loadAdmin1(countryQ).then((entry) => {
      if (!live) return;
      if (entry.status === "ready") {
        setAreaStatus("ready");
        setAreaData(entry.data);
        return;
      }
      setAreaStatus("error");
      setAreaData(null);
    });
    return () => {
      live = false;
    };
  }, [countryQ]);

  useEffect(() => {
    const matched =
      areaStatus === "ready" && areaData?.features[0]?.properties.countryId === countryQ;
    const known =
      matched && areaData
        ? new Set(areaData.features.map((feature) => feature.properties.id))
        : areaStatus === "error" && countryQ
          ? new Set(fallbackAreas(countryQ).map((area) => area.id))
          : null;
    const href = drillFix(regionQ, countryQ, areaQ, townQ, known);
    if (!href) return;
    router.replace(href, { scroll: false });
  }, [regionQ, countryQ, areaQ, townQ, areaStatus, areaData, router]);

  const hadItem = useRef(false);
  useEffect(() => {
    if (itemQ) {
      hadItem.current = true;
      return;
    }
    if (!hadItem.current) return;
    hadItem.current = false;
    document.querySelector<HTMLCanvasElement>(".fw-map canvas")?.focus();
  }, [itemQ]);

  useEffect(() => {
    if (!itemQ) return;
    if (window.matchMedia("(min-width: 840px)").matches) return;
    // A phone card sits above the sheet, so the sheet stays at peek.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStop("peek");
    writeSheetStop("peek");
  }, [itemQ]);

  useEffect(() => {
    const rule = countryQ ? countryRule(countryQ) : undefined;
    const outside = Boolean(countryQ && isOutsideCode(countryQ));
    if (rule?.status !== "blocked" && !outside) return;
    // A blocked or unlisted country opens the note without moving the map.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStop("half");
    writeSheetStop("half");
  }, [countryQ]);

  function chooseStop(next: SheetStop) {
    setStop(next);
    writeSheetStop(next);
  }

  const rows = useMemo(() => noteRows(demo), [demo]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (sector && row.sector !== sector) return false;
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
  }, [rows, sector, applied, demo.addedCommitments]);
  const activeRule = countryQ ? countryRule(countryQ) : undefined;
  const outsideHere = Boolean(countryQ && isOutsideCode(countryQ));
  const blockedHere = activeRule?.status === "blocked";
  const listableHere = Boolean(activeRule && activeRule.status !== "blocked");
  const tally = { projects: demo.projects, requests: demo.requests, availability: demo.availability };
  const areasReady =
    areaStatus === "ready" && areaData?.features[0]?.properties.countryId === countryQ;
  const areaRecords = useMemo(() => {
    if (!listableHere || !countryQ) return [];
    if (areasReady && areaData) {
      return areaData.features.map((feature) => ({ id: feature.properties.id, name: feature.properties.name }));
    }
    if (areaStatus === "error") return fallbackAreas(countryQ);
    return [];
  }, [listableHere, countryQ, areaStatus, areaData, areasReady]);
  const areaRows: DrillRow[] = areaRecords.map((area) => {
    const townIds = townsInArea(countryQ ?? "", area.id).map((town) => town.id);
    return {
      id: area.id,
      name: area.name,
      counts: countsFor({ countryId: countryQ ?? "", areaId: area.id }, tally, townIds),
      suited: topSectorTitles(area.id),
      chip: areaMark(countryQ ?? "", area.id) === "caution" ? AREA_CAUTION_CHIP : undefined,
    };
  });
  const areaBlockedHere = Boolean(countryQ && areaQ && areaMark(countryQ, areaQ) === "blocked");
  const areaCautionHere = Boolean(countryQ && areaQ && areaMark(countryQ, areaQ) === "caution");
  const townRecords = countryQ && areaQ && !areaBlockedHere ? townsInArea(countryQ, areaQ) : [];
  const townRows: DrillRow[] = townRecords.map((town) => ({
    id: town.id,
    name: town.name,
    counts: countsFor({ countryId: countryQ ?? "", areaId: areaQ, townId: town.id }, tally, null),
    suited: [],
  }));
  const countryRank = new Map<string, number>(REGIONS.map((region, index) => [region.id, index]));
  const countryRows: DrillRow[] = countryRules()
    .filter((rule) => rule.status !== "blocked")
    .map((rule) => ({
      id: rule.id,
      name: rule.name,
      counts: countsFor({ countryId: rule.id }, tally, null),
      suited: topSectorTitles(rule.id),
      region: rule.regionId,
    }))
    .sort((a, b) => (countryRank.get(a.region) ?? 0) - (countryRank.get(b.region) ?? 0) || a.name.localeCompare(b.name));
  const townCards = orderNoted(
    (townQ
      ? filtered.filter(
          (row) =>
            row.countryId === countryQ &&
            row.townId === townQ &&
            (countryQ !== "jamaica" || row.parishId === areaQ),
        )
      : []) as NotedOpening[],
    order,
    demo.profileSet,
  );
  const level = !countryQ
    ? regionOk
      ? "region"
      : "world"
    : blockedHere
      ? "blocked"
      : outsideHere
        ? "outside"
        : townQ
          ? "town"
          : areaQ
            ? "area"
            : "country";
  const loadingLine =
    listableHere && activeRule && areaRecords.length === 0 && areaStatus !== "error"
      ? `Loading ${activeRule.name}'s ${areaNoun(activeRule.id)}`
      : null;
  const sheetLabel =
    loadingLine ??
    (level === "world"
      ? `${countryRows.length} countries`
      : level === "region"
        ? `${countryRows.filter((row) => row.region === regionOk).length} countries`
      : level === "country"
        ? `${areaRows.length} ${countryQ === "jamaica" ? "parishes" : "areas"}`
        : level === "area"
          ? areaBlockedHere
            ? (areaRecords.find((area) => area.id === areaQ)?.name ?? "This area")
            : `${townRows.length} towns`
          : level === "town"
            ? openLine(townCards.length, regionCount(townCards))
            : activeRule?.name || (countryQ ? countryDisplayName(countryQ) : ""));
  const notice =
    blockedHere && activeRule
      ? `${activeRule.name} does not allow crypto yet, so Fundwork cannot open here.`
      : outsideHere && countryQ
        ? `Fundwork has no projects in ${countryDisplayName(countryQ)} yet.`
        : areaBlockedHere
          ? AREA_BLOCKED_LINE
          : null;
  const mapAreas =
    !areasReady || !areaData || !countryQ
      ? null
      : {
          type: "FeatureCollection" as const,
          features: areaData.features.map((feature) => {
            const row = areaRows.find((item) => item.id === feature.properties.id);
            const open = row ? openItems(row.counts) : 0;
            return {
              ...feature,
              id: feature.properties.id,
              properties: {
                ...feature.properties,
                open,
                shade: shadeStep(open),
                tip: row ? placeTip(feature.properties.name, row.counts) : "Nothing open yet",
              },
            };
          }),
        };
  const townMarkers = townRecords.map((town) => {
    const row = townRows.find((item) => item.id === town.id);
    const open = row ? openItems(row.counts) : 0;
    return {
      id: town.id,
      name: town.name,
      lat: town.lat,
      lng: town.lng,
      detail: "",
      open,
      tip: row ? placeTip(town.name, row.counts) : "Nothing open yet",
    };
  });

  function ask(next: FlyTarget) {
    flew.current = true;
    token.current += 1;
    const request: FlyRequest = { ...next, token: token.current };
    setFly(request);
  }

  function go(href: string, mode: "push" | "replace" = "push") {
    if (samePlace(search, href)) return;
    if (mode === "push") router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  }

  function here(extra: { region?: string | null; country?: string | null; area?: string | null; town?: string | null; item?: string | null }) {
    return placeHref(extra);
  }

  function goRegion(id: string) {
    if (!getRegion(id)) return;
    setSelectedId(null);
    setHoverAreaId(null);
    go(here({ region: id }));
  }

  function goWorld() {
    setSelectedId(null);
    setHoverAreaId(null);
    if (regionQ || countryQ || areaQ || townQ || itemQ) go(here({}));
    else ask({ kind: "world" });
  }

  function showBlocked(name: string) {
    const id = codeForCountryName(name);
    setSelectedId(null);
    chooseStop("half");
    if (!id) return;
    const rule = countryRule(id);
    const region = rule?.regionId && getRegion(rule.regionId) ? rule.regionId : null;
    go(here({ region, country: id }));
  }

  function pickSearch(hit: SearchHit) {
    setSelectedId(null);
    setHoverAreaId(null);
    if (hit.kind === "blocked" || hit.kind === "outside") chooseStop("half");
    go(drillHref(hit));
  }

  function pickPoint(id: string) {
    setSelectedId(id);
    setItemTrail([]);
    if (window.matchMedia("(max-width: 839px)").matches) chooseStop("peek");
    go(here({ region: regionOk, country: countryQ, area: areaQ, town: townQ, item: id }), itemQ ? "replace" : "push");
    window.requestAnimationFrame(() => {
      const nodes = document.querySelectorAll<HTMLElement>(`[data-opening="${CSS.escape(id)}"]`);
      const node = [...nodes].find((item) => item.getClientRects().length > 0);
      node?.scrollIntoView({ block: "nearest" });
    });
  }

  function closeItem() {
    if (!itemQ) return;
    router.back();
  }

  function openCountry(id: string) {
    setSelectedId(null);
    setHoverAreaId(null);
    const rule = countryRule(id);
    const region = rule?.regionId && getRegion(rule.regionId) ? rule.regionId : regionOk;
    if (rule?.status === "blocked" || isOutsideCode(id)) chooseStop("half");
    go(here({ region, country: id }));
  }

  function openArea(id: string) {
    if (!countryQ || (areaQ === id && !townQ)) return;
    setSelectedId(null);
    setHoverAreaId(null);
    go(here({ region: regionOk, country: countryQ, area: id }));
  }

  function openTown(id: string) {
    if (!countryQ || !areaQ || townQ === id) return;
    setSelectedId(null);
    go(here({ region: regionOk, country: countryQ, area: areaQ, town: id }));
    chooseStop("half");
  }

  useEffect(() => {
    if (phase !== "map") return;
    if (regionOk && !countryQ) {
      const key = `place:region:${regionOk}`;
      if (flown.current === key) return;
      flown.current = key;
      ask({ kind: "region", regionId: regionOk });
      return;
    }
    if (!listableHere || !countryQ) {
      if (flown.current.startsWith("place:") && !countryQ && !regionOk) {
        flown.current = "world";
        ask({ kind: "world" });
      }
      return;
    }
    if (townQ && areaQ) {
      const town = townsInArea(countryQ, areaQ).find((item) => item.id === townQ);
      if (!town) return;
      const key = `place:town:${countryQ}:${areaQ}:${townQ}`;
      if (flown.current === key) return;
      flown.current = key;
      ask({ kind: "center", center: [town.lng, town.lat], zoom: 11 });
      return;
    }
    if (areaQ && areaData?.features[0]?.properties.countryId === countryQ) {
      const feature = areaData.features.find((item) => item.properties.id === areaQ);
      const box = feature ? boundsOfFeature(feature) : null;
      if (box) {
        const key = `place:area:${countryQ}:${areaQ}`;
        if (flown.current === key) return;
        flown.current = key;
        ask({ kind: "bounds", bounds: box, maxZoom: 10 });
        return;
      }
    }
    const box = ADMIN1_BOUNDS[countryQ];
    if (!box) return;
    const key = `place:country:${countryQ}`;
    if (flown.current === key) return;
    flown.current = key;
    ask({ kind: "bounds", bounds: box, maxZoom: 8.4 });
  }, [phase, listableHere, countryQ, areaQ, townQ, areaData, regionOk]);

  const away = Boolean(countryQ) || Boolean(regionOk) || zoom >= WORLD_ZOOM;
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

  const crumbAreaName = areaQ
    ? (areaRecords.find((area) => area.id === areaQ)?.name ??
      (countryQ === "jamaica" ? getParish(areaQ)?.name : fallbackAreas(countryQ ?? "").find((area) => area.id === areaQ)?.name) ??
      areaQ)
    : "";
  const crumbs: { label: string; onClick?: () => void }[] = [
    {
      label: "World",
      onClick:
        regionOk || countryQ
          ? () => {
              setSelectedId(null);
              setHoverAreaId(null);
              go(here({}));
            }
          : undefined,
    },
  ];
  if (regionOk) {
    crumbs.push({
      label: getRegion(regionOk)?.name ?? regionOk,
      onClick: countryQ ? () => go(here({ region: regionOk })) : undefined,
    });
  }
  if (countryQ) {
    crumbs.push({
      label: activeRule?.name ?? countryDisplayName(countryQ),
      onClick: areaQ ? () => go(here({ region: regionOk, country: countryQ })) : undefined,
    });
  }
  if (countryQ && areaQ) {
    crumbs.push({
      label: crumbAreaName,
      onClick: townQ ? () => go(here({ region: regionOk, country: countryQ, area: areaQ })) : undefined,
    });
  }
  if (townQ) {
    crumbs.push({ label: townRecords.find((town) => town.id === townQ)?.name ?? townQ });
  }
  const regionCountryRows = regionOk ? countryRows.filter((row) => row.region === regionOk) : [];
  const placeActions = (() => {
    if (areaBlockedHere || !countryQ || (level !== "area" && level !== "town")) return { start: null, post: null };
    const place = countryQ === "jamaica" ? areaQ ?? countryQ : countryQ;
    const startPath = townQ ? `/invest/start/${place}/${townQ}` : `/invest/start/${place}`;
    const postPath = townQ ? `/work/available/${place}/${townQ}` : `/work/available/${place}`;
    return {
      start: demo.role === "worker" ? null : gatePath(startPath, demo.profileSet),
      post: demo.role === "investor" ? null : gatePath(postPath, demo.profileSet),
    };
  })();
  const placeWatch = countryQ ? watchKey(countryQ, areaQ, level === "town" ? townQ : null) : "";
  const rulesChip = level === "country" && activeRule ? chipLabel(activeRule.status) : null;
  const hoverArea = (id: string | null) => {
    if (window.matchMedia("(min-width: 840px)").matches) setHoverAreaId(id);
  };

  const placeList = () => (
    <div className="space-y-2">
      {rulesChip && activeRule ? (
        <div className="space-y-1">
          <span className="inline-flex min-h-11 items-center rounded-full border-2 border-border px-3 text-sm font-semibold">
            {rulesChip}
          </span>
          <p className="text-sm text-muted-foreground">{rulesSummary(activeRule)}</p>
        </div>
      ) : null}
      {loadingLine ? <p className="text-base">{loadingLine}</p> : null}
      {level === "world" ? <DrillRows rows={countryRows} onOpen={openCountry} /> : null}
      {level === "region" ? <DrillRows rows={regionCountryRows} onOpen={openCountry} /> : null}
      {level === "country" && !loadingLine ? (
        <DrillRows rows={areaRows} selectedId={areaQ} onOpen={openArea} onHover={hoverArea} />
      ) : null}
      {level === "area" && areaCautionHere ? (
        <span className="inline-flex min-h-11 items-center rounded-full border-2 border-border px-3 text-sm font-semibold">
          {AREA_CAUTION_CHIP}
        </span>
      ) : null}
      {level === "area" && !areaBlockedHere ? (
        townRows.length > 0 ? (
          <DrillRows rows={townRows} selectedId={townQ} onOpen={openTown} />
        ) : (
          <EmptyPlace
            startHref={placeActions.start}
            postHref={placeActions.post}
            watched={demo.watchedPlaces.includes(placeWatch)}
            onWatch={() => demo.watchPlace(placeWatch)}
          />
        )
      ) : null}
      {level === "town" ? (
        townCards.length > 0 ? (
          <div className="space-y-2" data-order={order}>
            {townCards.map((row) => {
              const noted = row as NotedOpening;
              const explain = order === "for-you" && noted.reasons?.length ? noted.reasons.join(" · ") : undefined;
              return (
                <OpeningCard
                  key={row.id}
                  row={row}
                  selected={itemQ === row.id}
                  onHover={(id) => {
                    if (!itemQ) setSelectedId(id);
                  }}
                  reason={explain}
                  parts={explain ? noted.parts : undefined}
                />
              );
            })}
          </div>
        ) : (
          <EmptyPlace
            startHref={placeActions.start}
            postHref={placeActions.post}
            watched={demo.watchedPlaces.includes(placeWatch)}
            onWatch={() => demo.watchPlace(placeWatch)}
          />
        )
      ) : null}
      {level === "outside" && countryQ ? (
        <div className="space-y-2">
          <button
            type="button"
            className="inline-flex min-h-12 items-center rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground"
            onClick={() => demo.askForCountry(countryQ)}
          >
            Ask for this country
          </button>
          {(demo.askCounts[countryQ] ?? 0) >= 5 ? (
            <p className="text-sm text-muted-foreground">{demo.askCounts[countryQ]} people asked</p>
          ) : null}
        </div>
      ) : null}
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
    const town = spot?.townId
      ? spot.parishId
        ? getTown(spot.parishId, spot.townId)
        : getCity(spot.countryId, spot.townId)
      : undefined;
    const skills = demo.role === "worker" ? workerSkillIds(demo) : undefined;
    return (
      <FilterBar
        placeLabel={town?.name || "Place"}
        placeHref={applied.kind === "request" ? "/work/place" : "/invest/place"}
        onTown={(place) => {
          demo.setHomeTown(place);
          const point = place.parishId ? getTown(place.parishId, place.townId) : getCity(place.countryId, place.townId);
          if (!point) return;
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
        placeChip={null}
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

  const mapPoints =
    level === "town"
      ? townCards
      : level === "country" || level === "area" || level === "blocked" || level === "outside"
        ? []
        : regionOk
          ? filtered.filter((row) => row.regionId === regionOk)
          : filtered;
  const showMapPoints = level === "world" || level === "region" || level === "town";
  const itemRow = itemQ ? (rows.find((row) => row.id === itemQ) ?? null) : null;
  const itemReason = itemRow && demo.profileSet ? itemRow.reasons[0] : undefined;
  const itemNeighbors = (() => {
    if (!itemRow) return [];
    const pool = (listed ? rows.filter((row) => boundsContain(listed, row.lat, row.lng)) : rows).filter(
      (row) => row.id !== itemRow.id,
    );
    const origin = itemRow;
    return pool.sort((a, b) => squareDistance(origin, a) - squareDistance(origin, b));
  })();
  if (!itemQ && itemTrail.length > 0) setItemTrail([]);
  function stepItem(dir: 1 | -1) {
    if (!itemRow) return;
    if (dir < 0) {
      const prev = itemTrail[itemTrail.length - 1];
      if (!prev) return;
      setItemTrail(itemTrail.slice(0, -1));
      go(here({ region: regionOk, country: countryQ, area: areaQ, town: townQ, item: prev }), "replace");
      return;
    }
    const seen = new Set(itemTrail);
    seen.add(itemRow.id);
    const next = itemNeighbors.find((row) => !seen.has(row.id));
    if (!next) return;
    setItemTrail([...itemTrail, itemRow.id]);
    go(here({ region: regionOk, country: countryQ, area: areaQ, town: townQ, item: next.id }), "replace");
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
                <DrillBreadcrumb parts={crumbs} />
                {renderFilters()}
                <p className="text-sm text-muted-foreground">{sheetLabel}</p>
                {notice ? <p className="text-base">{notice}</p> : null}
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">{placeList()}</div>
            </aside>
            <div className="relative h-full min-w-0 flex-1">
            {failed ? (
              <div className="hidden h-full place-items-center p-6 text-center min-[840px]:grid">
                <MapLoadNote onRetry={retryMap} />
              </div>
            ) : (
            <MapView
              points={mapPoints}
              showMarkers={showMapPoints}
              selectedId={itemQ ?? selectedId}
              regionId={regionOk}
              fly={fly}
              areas={mapAreas}
              areaKey={`${countryQ ?? ""}:${areasReady ? "ready" : areaStatus}:${areaRows.map((row) => `${row.counts.projects}:${row.counts.requests}:${row.counts.workers}`).join("|")}`}
              towns={areaBlockedHere ? [] : level === "area" || level === "town" ? townMarkers : []}
              drill={areaBlockedHere ? "areas" : level === "area" || level === "town" ? "towns" : level === "country" ? "areas" : "world"}
              selectedAreaId={areaQ}
              hoverAreaId={hoverAreaId}
              regionFocus={level === "region" ? regionOk : null}
              selectedTownId={level === "town" ? townQ : null}
              preview={wide && itemRow ? <PreviewCard row={itemRow} reason={itemReason} compact={false} onClose={closeItem} /> : null}
              previewAt={wide && itemRow ? { id: itemRow.id, lng: itemRow.lng, lat: itemRow.lat } : null}
              onCountry={openCountry}
              onArea={openArea}
              onTown={openTown}
              onMapCountry={(name) => {
                const id = codeForCountryName(name);
                if (id) openCountry(id);
              }}
              onReady={(view) => {
                if (failedRef.current) return;
                setListed(view.bounds);
                setZoom(view.zoom);
                setAreaMoved(false);
                mapReady();
              }}
              onMove={(view, gesture) => {
                if (failedRef.current) return;
                setZoom(view.zoom);
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
              onEmpty={closeItem}
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
            {phase === "map" && !wide && itemRow ? (
              <div
                className="absolute inset-x-2 z-30 min-[840px]:hidden"
                style={{ bottom: "calc(var(--fw-sheet, 7rem) + 0.5rem)" }}
              >
                <PreviewCard
                  row={itemRow}
                  reason={itemReason}
                  compact
                  onClose={closeItem}
                  onPrev={itemTrail.length > 0 ? () => stepItem(-1) : undefined}
                  onNext={itemNeighbors.some((row) => !itemTrail.includes(row.id)) ? () => stepItem(1) : undefined}
                />
              </div>
            ) : null}
            {phase === "map" ? (
            <ResultsSheet
              label={sheetLabel}
              notice={notice}
              stop={stop}
              onStop={chooseStop}
              toolbar={
                <>
                  <DrillBreadcrumb parts={crumbs} />
                  <GetStartedButton />
                  {renderFilters()}
                </>
              }
            >
              {placeList()}
            </ResultsSheet>
            ) : null}
            {failed ? (
              <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 min-[840px]:hidden">
                <PlaceSearch onPick={pickSearch} collapsible />
                <GetStartedButton />
                {renderFilters()}
                <DrillBreadcrumb parts={crumbs} />
                <MapLoadNote onRetry={retryMap} />
                <p className="text-sm text-muted-foreground">{sheetLabel}</p>
                {notice ? <p className="text-base">{notice}</p> : null}
                {placeList()}
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
          <DrillBreadcrumb parts={crumbs} />
          <GetStartedButton />
          {renderFilters()}
          {lite && phase !== "loading" ? <ShowMapButton onClick={retryMap} /> : null}
          <p className="text-sm text-muted-foreground">{sheetLabel}</p>
          {notice ? <p className="text-base">{notice}</p> : null}
          {placeList()}
        </div>
      )}
    </>
  );
}

function squareDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat = a.lat - b.lat;
  const lng = a.lng - b.lng;
  return lat * lat + lng * lng;
}

function investorRegions(demo: ReturnType<typeof useDemo>): string[] | null {
  if (!demo.profileSet || demo.role !== "investor") return null;
  const places = demo.profile.places;
  if (places.length === 0 || places.includes("anywhere")) return null;
  const ids = places.filter((id) => isRegionId(id));
  return ids.length > 0 ? ids : null;
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
