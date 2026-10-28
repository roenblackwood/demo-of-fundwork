"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionBar } from "@/components/parts";
import { RegionMap } from "@/components/region-map";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { CAPITAL_LINE } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { countriesIn, getRegion, showcaseById, type RegionId } from "@/lib/regions";

export default function HomePage() {
  const { startPath, updateFlow, role, projects } = useDemo();
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [countryId, setCountryId] = useState<string | null>(null);
  const crumbs = useRef<HTMLElement>(null);
  const region = regionId ? getRegion(regionId) : undefined;
  const country = countryId ? showcaseById(countryId) : undefined;
  const countries = regionId ? countriesIn(regionId) : [];
  const featured = country
    ? projects.filter((project) => project.countryId === country.id)
    : [];

  function pickRegion(id: RegionId) {
    setRegionId(id);
    setCountryId(null);
  }

  useEffect(() => {
    crumbs.current
      ?.querySelector("[aria-current='page']")
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [regionId, countryId]);

  const startHref =
    country?.id === "jamaica"
      ? "/invest/start/jamaica"
      : country
        ? `/invest/start/${country.id}`
        : "/invest/start";
  const availableHref =
    country?.id === "jamaica"
      ? "/work/available/jamaica"
      : country
        ? `/work/available/${country.id}`
        : "/work/available";

  function rememberCountry() {
    if (!country) return;
    updateFlow({
      regionId: region?.id,
      countryId: country.id,
      parishId: undefined,
      townId: undefined,
      sector: undefined,
      skill: undefined,
      extraSkills: [],
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-display text-4xl leading-tight">Where should we look?</h1>
      <div className={country ? "mx-auto mt-1 w-[90%]" : "mt-6"}>
        <RegionMap
          selected={regionId}
          countryId={countryId}
          onSelect={pickRegion}
          onSelectCountry={setCountryId}
        />
      </div>
      <nav ref={crumbs} aria-label="Place" className={country ? "mt-2 flex gap-1 overflow-x-auto" : "mt-3 flex gap-1 overflow-x-auto"}>
        {region ? (
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center rounded-full border-2 border-border bg-card px-2.5 text-base font-semibold whitespace-nowrap"
            onClick={() => {
              setRegionId(null);
              setCountryId(null);
            }}
          >
            World
          </button>
        ) : (
          <span
            aria-current="page"
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-2.5 text-base font-semibold whitespace-nowrap text-primary-foreground"
          >
            World
          </span>
        )}
        {region ? (
          country ? (
            <button
              type="button"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border-2 border-border bg-card px-2.5 text-base font-semibold whitespace-nowrap"
              onClick={() => setCountryId(null)}
            >
              {region.name}
            </button>
          ) : (
            <span
              aria-current="page"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-2.5 text-base font-semibold whitespace-nowrap text-primary-foreground"
            >
              {region.name}
            </span>
          )
        ) : null}
        {country ? (
          <span
            aria-current="page"
            className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-primary px-2.5 text-base font-semibold whitespace-nowrap text-primary-foreground"
          >
            {country.name}
          </span>
        ) : null}
      </nav>
      {!region ? (
        <p className="mt-6 text-lg text-muted-foreground">Tap a region.</p>
      ) : !country ? (
        <div className="mt-6 space-y-3">
          <p className="text-lg leading-relaxed">Tap a country in {region.name}.</p>
          {countries.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCountryId(item.id)}
              className="flex min-h-14 w-full items-center rounded-2xl border-2 border-border bg-card px-4 py-3 text-left text-lg font-semibold shadow-sm"
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-lg leading-relaxed">
            {country.id === "jamaica"
              ? "Jamaica is open, parish by parish."
              : featured.length > 0
                ? `${featured[0].name} is open in ${country.name}.`
                : `${country.name} is on the map. The open project in ${region.name} is next door.`}
          </p>
        </div>
      )}
      <p className={country ? "mt-2 text-lg leading-relaxed" : "mt-8 text-lg leading-relaxed"}>
        {CAPITAL_LINE}
      </p>
      <p className={country ? "mt-1 text-base text-muted-foreground" : "mt-3 text-base text-muted-foreground"}>A demo. No money moves.</p>
      {country ? (
        <ActionBar>
          {role === "investor" ? (
            <>
              <Link
                href="/invest"
                onClick={() => {
                  startPath("investor");
                  rememberCountry();
                }}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                See projects here
              </Link>
              <Link
                href={startHref}
                onClick={() => {
                  startPath("investor");
                  rememberCountry();
                }}
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
              >
                Start a project here
              </Link>
            </>
          ) : role === "worker" ? (
            <>
              <Link
                href="/work"
                onClick={() => {
                  startPath("worker");
                  rememberCountry();
                }}
                className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
              >
                See work here
              </Link>
              <Link
                href={availableHref}
                onClick={() => {
                  startPath("worker");
                  rememberCountry();
                }}
                className={cn(buttonVariants({ variant: "workOutline", size: "lg" }), "w-full")}
              >
                Post that you are available
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/invest"
                onClick={() => {
                  startPath("investor");
                  rememberCountry();
                }}
                className={cn(buttonVariants({ size: "lg" }), "w-full")}
              >
                I want to invest
              </Link>
              <Link
                href="/work"
                onClick={() => {
                  startPath("worker");
                  rememberCountry();
                }}
                className={cn(buttonVariants({ variant: "workOutline", size: "lg" }), "w-full")}
              >
                I want to work
              </Link>
            </>
          )}
        </ActionBar>
      ) : null}
    </div>
  );
}
