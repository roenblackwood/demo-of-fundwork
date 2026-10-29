"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionBar, sectionTitle } from "@/components/parts";
import { ProjectCard } from "@/components/project-card";
import { RegionMap } from "@/components/region-map";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { CAPITAL_LINE } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { projectCommitted } from "@/lib/ownership";
import { countriesIn, getRegion, REGIONS, showcaseById, type RegionId } from "@/lib/regions";
import type { Commitment, Project } from "@/lib/types";

export default function HomePage() {
  const { startPath, updateFlow, role, projects, addedCommitments } = useDemo();
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
      {region ? null : (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {REGIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={false}
              onClick={() => pickRegion(item.id)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border-2 border-border bg-card px-3 text-base font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {item.name}
            </button>
          ))}
        </div>
      )}
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
      {!region ? null : !country ? (
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
      <p className={country ? "mt-2 text-lg leading-relaxed" : "mt-4 text-lg leading-relaxed"}>
        {CAPITAL_LINE}
      </p>
      <p className="mt-1 text-base text-muted-foreground">A demo. No money moves.</p>
      <OpenNow projects={projects} commitments={addedCommitments} />
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

function OpenNow({ projects, commitments }: { projects: Project[]; commitments: Commitment[] }) {
  const closest = [...projects]
    .map((project) => {
      const committed = projectCommitted(project.committedJmd, commitments, project.id);
      const ratio = project.goalJmd > 0 ? committed / project.goalJmd : 0;
      const left = project.goalJmd - committed;
      return { project, ratio, left };
    })
    .sort((a, b) => {
      const aOpen = a.left > 0 ? 0 : 1;
      const bOpen = b.left > 0 ? 0 : 1;
      return aOpen - bOpen || b.ratio - a.ratio || a.left - b.left;
    })
    .slice(0, 3)
    .map((item) => item.project);
  const count = projects.length === 1 ? "1 project open" : `${projects.length} projects open`;

  return (
    <section className="mt-4 space-y-3">
      <h2 className={sectionTitle}>Open now</h2>
      <p className="text-sm text-muted-foreground">
        {count} in {REGIONS.length} regions
      </p>
      <div className="space-y-2">
        {closest.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
      <Link href="/invest" className="inline-flex min-h-11 items-center font-semibold text-primary">
        See all
      </Link>
    </section>
  );
}
