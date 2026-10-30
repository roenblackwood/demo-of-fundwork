"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { StepHeader } from "@/components/parts";
import { MapLoadNote, PlaceSearch, RegionChipRow, ShowMapButton } from "@/components/map/chrome";
import { useMapPhase } from "@/components/map/lite";
import { MapView } from "@/components/map/map-view";
import { readSheetStop, ResultsSheet, writeSheetStop, type SheetStop } from "@/components/map/results-sheet";
import { REGION_CAMERA, countryZoom, type FlyRequest, type FlyTarget } from "@/lib/map-camera";
import { isRegionId, townsIn, type SearchHit } from "@/lib/openings";
import { REGIONS, countriesIn, getRegion, showcaseById } from "@/lib/regions";
import { WhatWorksButton } from "@/components/place-fit";
import { CountryRuleRow, RulesHere } from "@/components/rules-panel";

const rowClass =
  "flex min-h-14 w-full flex-col justify-center rounded-2xl border-2 border-border bg-card px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

export type PickedPlace = {
  countryId: string;
  parishId: string | null;
  townId: string;
  regionId: string;
};

type Level = "regions" | "countries" | "towns";

export function PlaceScreen({
  title,
  step,
  total,
  backHref,
  onBack,
  onTown,
}: {
  title: string;
  step?: number;
  total?: number;
  backHref: string;
  onBack?: () => void;
  onTown: (place: PickedPlace) => void;
}) {
  const { phase, lite, failed, showMap, mapReady, mapFailed } = useMapPhase();
  const [level, setLevel] = useState<Level>("regions");
  const [regionId, setRegionId] = useState<string | null>(null);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [blockedName, setBlockedName] = useState<string | null>(null);
  const [stop, setStop] = useState<SheetStop>("half");
  const [fly, setFly] = useState<FlyRequest | null>(null);
  const token = useRef(0);
  const region = regionId ? getRegion(regionId) : undefined;
  const country = countryId ? showcaseById(countryId) : undefined;

  useEffect(() => {
    const saved = readSheetStop();
    if (saved !== "half") {
      // The sheet stop is stored for this tab only.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStop(saved);
    }
  }, []);

  function chooseStop(next: SheetStop) {
    setStop(next);
    writeSheetStop(next);
  }

  function ask(next: FlyTarget) {
    token.current += 1;
    const request: FlyRequest = { ...next, token: token.current };
    setFly(request);
  }

  function chooseRegion(id: string) {
    const camera = REGION_CAMERA[id];
    setRegionId(id);
    setCountryId(null);
    setBlockedName(null);
    setLevel("countries");
    if (camera) ask({ kind: "center", center: camera.center, zoom: camera.zoom });
  }

  function chooseCountry(id: string) {
    const item = showcaseById(id);
    if (!item) return;
    setRegionId(item.regionId);
    setCountryId(id);
    setBlockedName(null);
    setLevel("towns");
    ask({ kind: "center", center: [item.coordinates[0], item.coordinates[1]], zoom: countryZoom(id) });
  }

  function chooseTown(hit: SearchHit) {
    if (!hit.townId) return;
    onTown({
      countryId: hit.countryId,
      parishId: hit.parishId,
      townId: hit.townId,
      regionId: hit.regionId,
    });
  }

  function showRegions() {
    setLevel("regions");
    setRegionId(null);
    setCountryId(null);
    setBlockedName(null);
    ask({ kind: "world" });
  }

  function showBlocked(name: string) {
    setBlockedName(name);
    chooseStop("half");
  }

  function pickSearch(hit: SearchHit) {
    if (hit.kind === "town") {
      chooseTown(hit);
      return;
    }
    chooseCountry(hit.countryId);
  }

  const countries = regionId && isRegionId(regionId) ? countriesIn(regionId) : [];
  const towns = regionId && countryId ? townsIn(regionId, countryId) : [];
  const label = level === "regions" ? "7 regions" : level === "countries" ? (region?.name ?? "Countries") : (country?.name ?? "Towns");
  const mapLive = phase === "loading" || phase === "map";

  const choices = (
    <div className="space-y-3">
      {level !== "regions" ? (
        <button type="button" className="min-h-11 font-semibold text-primary" onClick={level === "towns" ? () => {
          setLevel("countries");
          setCountryId(null);
          setBlockedName(null);
          if (regionId && REGION_CAMERA[regionId]) {
            ask({ kind: "center", center: REGION_CAMERA[regionId].center, zoom: REGION_CAMERA[regionId].zoom });
          }
        } : showRegions}>
          {level === "towns" ? region?.name : "All regions"}
        </button>
      ) : null}
      {level === "regions"
        ? REGIONS.map((item) => (
            <button key={item.id} type="button" className={rowClass} onClick={() => chooseRegion(item.id)}>
              <span className="text-lg font-semibold">{item.name}</span>
            </button>
          ))
        : null}
      {level === "countries" && countries.length === 1 ? (
        <p className="text-base text-muted-foreground">More countries after their rules are checked.</p>
      ) : null}
      {level === "countries"
        ? countries.map((item) => (
            <CountryRuleRow key={item.id} countryId={item.id}>
              <div className="space-y-1">
                <button type="button" className={rowClass} onClick={() => chooseCountry(item.id)}>
                  <span className="text-lg font-semibold">{item.name}</span>
                </button>
                <WhatWorksButton placeId={item.id} />
              </div>
            </CountryRuleRow>
          ))
        : null}
      {level === "towns" && countryId ? <RulesHere countryId={countryId} /> : null}
      {level === "towns"
        ? towns.map((item, index) => {
            const previous = towns[index - 1];
            const showParish = Boolean(item.parishId && item.parishId !== previous?.parishId);
            return (
              <div key={item.id} className="space-y-2">
                {showParish && item.parishId ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold">{item.detail}</p>
                    <WhatWorksButton placeId={item.parishId} />
                  </div>
                ) : null}
                <button type="button" className={rowClass} onClick={() => chooseTown(item)}>
                  <span className="text-lg font-semibold">{item.label}</span>
                  <span className="text-base font-normal text-muted-foreground">{item.detail}</span>
                </button>
              </div>
            );
          })
        : null}
    </div>
  );

  const back = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <ChevronLeft className="size-6" aria-hidden />
      Back
    </button>
  ) : (
    <Link
      href={backHref}
      className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <ChevronLeft className="size-6" aria-hidden />
      Back
    </Link>
  );

  return (
    <>
      {mapLive ? (
        <div
          className={
            phase === "map"
              ? "fixed top-[var(--fw-top)] right-0 bottom-[var(--fw-bottom)] left-[var(--fw-left)] z-20 flex flex-col bg-background"
              : "fixed top-[var(--fw-top)] right-0 bottom-[var(--fw-bottom)] left-[var(--fw-left)] z-20 flex flex-col invisible"
          }
          aria-hidden={phase !== "map"}
        >
          <div className="relative z-10 bg-background/95 px-4 pt-1 backdrop-blur">
            {back}
            {step && total ? (
              <p className="text-sm font-semibold text-muted-foreground">
                Step {step} of {total}
              </p>
            ) : null}
            <h1 className="font-display text-2xl leading-tight">{title}</h1>
            <div className="py-2">
              <PlaceSearch onPick={pickSearch} />
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <MapView
              points={[]}
              showMarkers={false}
              selectedId={null}
              regionId={level === "regions" ? null : regionId}
              fly={fly}
              onReady={() => mapReady()}
              onMove={() => undefined}
              onRegion={chooseRegion}
              onBlocked={showBlocked}
              onPoint={() => undefined}
              onFail={mapFailed}
            />
            {level === "regions" ? null : (
              <button
                type="button"
                className="absolute top-3 left-3 z-10 inline-flex min-h-11 items-center rounded-full border-2 border-border bg-card px-3 text-base font-semibold shadow"
                onClick={showRegions}
              >
                World
              </button>
            )}
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
              {choices}
            </ResultsSheet>
          </div>
        </div>
      ) : null}
      {phase === "map" ? null : (
        <div>
          <StepHeader backHref={backHref} onBack={onBack} step={step} total={total} title={title} />
          <div className="mb-4">
            <PlaceSearch onPick={pickSearch} />
          </div>
          {failed ? (
            <div className="mb-4">
              <MapLoadNote onRetry={showMap} />
            </div>
          ) : null}
          {lite && !failed ? (
            <div className="mb-4 space-y-3">
              <RegionChipRow selected={regionId} onSelect={chooseRegion} />
              {phase !== "loading" ? <ShowMapButton onClick={showMap} /> : null}
            </div>
          ) : null}
          {choices}
        </div>
      )}
    </>
  );
}
