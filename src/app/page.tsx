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
import { getProjects } from "@/lib/seed";

export default function HomePage() {
  const { startPath } = useDemo();
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [countryId, setCountryId] = useState<string | null>(null);
  const crumbs = useRef<HTMLElement>(null);
  const region = regionId ? getRegion(regionId) : undefined;
  const country = countryId ? showcaseById(countryId) : undefined;
  const countries = regionId ? countriesIn(regionId) : [];
  const featured = country
    ? getProjects().filter((project) => project.countryId === country.id)
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

  const investHref =
    country?.id === "jamaica" ? "/invest/jamaica" : country ? `/invest/${country.id}` : "/invest";
  const workHref =
    country?.id === "jamaica" ? "/work/jamaica" : country ? `/work/${country.id}` : "/work";

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="font-display text-4xl leading-tight">Where should we look?</h1>
      <div className={country ? "mt-3" : "mt-6"}>
        <RegionMap
          selected={regionId}
          countryId={countryId}
          onSelect={pickRegion}
          onSelectCountry={setCountryId}
        />
      </div>
      <nav ref={crumbs} aria-label="Place" className="mt-3 flex gap-1 overflow-x-auto">
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
        <p className="mt-4 text-lg leading-relaxed">
          {country.id === "jamaica"
            ? "Jamaica is open, parish by parish."
            : featured.length > 0
              ? `${featured[0].name} is open in ${country.name}.`
              : `${country.name} is on the map. The open project in ${region.name} is next door.`}
        </p>
      )}
      <p className={country ? "mt-12 text-lg leading-relaxed" : "mt-8 text-lg leading-relaxed"}>
        {CAPITAL_LINE}
      </p>
      <p className="mt-3 text-base text-muted-foreground">A demo. No money moves.</p>
      {country ? (
        <ActionBar>
          <Link
            href={investHref}
            onClick={() => startPath("investor")}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            I want to invest
          </Link>
          <Link
            href={workHref}
            onClick={() => startPath("worker")}
            className={cn(buttonVariants({ variant: "workOutline", size: "lg" }), "w-full")}
          >
            I want to work
          </Link>
        </ActionBar>
      ) : null}
    </div>
  );
}
