"use client";

import { useState } from "react";
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
          <div className="flex flex-col items-start">
            <button
              type="button"
              className="min-h-11 font-semibold text-primary"
              onClick={() => setCountryId(null)}
            >
              See other countries
            </button>
            <button
              type="button"
              className="min-h-11 font-semibold text-primary"
              onClick={() => {
                setRegionId(null);
                setCountryId(null);
              }}
            >
              See the whole world
            </button>
          </div>
        </div>
      )}
      {region && !country ? (
        <button
          type="button"
          className="mt-4 min-h-11 self-start font-semibold text-primary"
          onClick={() => {
            setRegionId(null);
            setCountryId(null);
          }}
        >
          See the whole world
        </button>
      ) : null}
      <p className={country ? "mt-16 text-lg leading-relaxed" : "mt-8 text-lg leading-relaxed"}>
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
