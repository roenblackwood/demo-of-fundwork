"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, MapPin } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { MapView } from "@/components/map/map-view";
import { FloatingAction } from "@/components/parts";
import { ProjectCard } from "@/components/project-card";
import { RequestCard } from "@/components/request-card";
import { buttonVariants } from "@/components/ui/button";
import { SECTORS, SKILLS, isSector, isSkill, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { bandRank } from "@/lib/match";
import { projectCommitted } from "@/lib/ownership";
import { openingFromProject, openingFromRequest } from "@/lib/openings";
import { getCity, getCountry, getParish, getTown } from "@/lib/seed";
import type { CapitalRequest, PathChoice, Project, Sector, Skill } from "@/lib/types";

type Spot = {
  countryId: string;
  parishId: string | null;
  townId: string;
};

type Home = Spot & { label: string };

function placeLabel(countryId: string, parishId: string | null, townId: string): string {
  const parish = parishId ? getParish(parishId) : undefined;
  const country = getCountry(countryId);
  const town = parishId ? getTown(parishId, townId) : getCity(countryId, townId);
  if (town && parish) return placeLine(town.name, parish.name);
  if (town && country) return placeLine(town.name, country.name);
  if (country) return country.name;
  if (parish) return parish.name;
  return "Everywhere";
}

function savedHome(input: {
  flow: {
    countryId?: string;
    parishId?: string;
    townId?: string;
  } | null;
  homeCountryId: string | null;
  homeParishId: string | null;
  homeTownId: string | null;
}): Home | null {
  if (input.flow?.countryId) {
    const countryId = input.flow.countryId;
    const parishId = input.flow.parishId ?? null;
    const townId = input.flow.townId ?? "";
    return { countryId, parishId, townId, label: placeLabel(countryId, parishId, townId) };
  }
  if (input.homeCountryId && input.homeTownId) {
    return {
      countryId: input.homeCountryId,
      parishId: input.homeParishId,
      townId: input.homeTownId,
      label: placeLabel(input.homeCountryId, input.homeParishId, input.homeTownId),
    };
  }
  return null;
}

function inPlace(home: Home | null, item: Spot): boolean {
  if (!home) return true;
  if (home.countryId === "jamaica") {
    if (home.parishId) return item.countryId === "jamaica" && item.parishId === home.parishId;
    return item.countryId === "jamaica";
  }
  return item.countryId === home.countryId;
}

function rankOf(home: Home | null, item: Spot): number {
  if (!home?.townId) return 0;
  return bandRank(home, item);
}

function startHref(home: Home | null): string {
  if (!home?.townId) return "/invest/start";
  const place = home.parishId ?? home.countryId;
  return `/invest/start/${place}/${home.townId}`;
}

function availableHref(home: Home | null): string {
  if (!home?.townId) return "/work/available";
  const place = home.parishId ?? home.countryId;
  return `/work/available/${place}/${home.townId}`;
}

const chipClass =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full px-3 text-base font-semibold whitespace-nowrap hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

export function FeedScreen({ mode }: { mode: PathChoice }) {
  const demo = useDemo();
  const router = useRouter();
  const searchParams = useSearchParams();
  const home = savedHome(demo);
  const sectorParam = searchParams.get("sector");
  const sector = sectorParam && isSector(sectorParam) ? sectorParam : null;
  const skillParam = searchParams.get("skill");
  const mine = workerSkills(demo);
  const skill = skillParam && isSkill(skillParam) && mine.includes(skillParam) ? skillParam : null;

  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 840px)");
    const apply = () => setDesk(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const rows = useMemo(
    () => (mode === "investor" ? investorRows(demo, home, sector) : workerRows(demo, home, mine, skill)),
    [mode, demo, home, sector, mine, skill],
  );
  const mapPoints = useMemo(() => {
    const spot = home
      ? { countryId: home.countryId, parishId: home.parishId, townId: home.townId }
      : null;
    return rows.flatMap((row) => {
      if (row.kind === "project") {
        const opening = openingFromProject(row.project, demo.addedCommitments, spot);
        return opening ? [opening] : [];
      }
      const opening = openingFromRequest(row.request, spot);
      return opening ? [opening] : [];
    });
  }, [rows, home, demo.addedCommitments]);

  if (!demo.ready) return <PageBusy />;
  const placeHref = mode === "investor" ? "/invest/place" : "/work/place";

  function setQuery(key: "sector" | "skill", value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${mode === "investor" ? "/invest" : "/work"}?${query}` : mode === "investor" ? "/invest" : "/work");
  }

  const projects = rows.filter((row) => row.kind === "project").length;
  const requests = rows.filter((row) => row.kind === "request").length;

  function clearFilters() {
    demo.updateFlow({
      regionId: undefined,
      countryId: undefined,
      parishId: undefined,
      townId: undefined,
    });
    router.replace(mode === "investor" ? "/invest" : "/work");
  }

  const actionHref = mode === "investor" ? startHref(home) : availableHref(home);
  const actionLabel = mode === "investor" ? "Start a project" : "I am available";
  const actionTone = mode === "investor" ? "primary" : "work";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="sr-only text-xl font-semibold min-[600px]:not-sr-only">
          {mode === "investor" ? "Invest" : "Work"}
        </h1>
        <Link
          href={actionHref}
          className={cn(
            buttonVariants({ size: "default", variant: actionTone === "work" ? "work" : "default" }),
            "ml-auto hidden min-[600px]:inline-flex",
          )}
        >
          {actionLabel}
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Link href={placeHref} className={cn(chipClass, "gap-1.5 border-2 border-border bg-card")}>
          <MapPin className="size-4 shrink-0" aria-hidden />
          {home?.label ?? "Everywhere"}
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </Link>
        {mode === "investor"
          ? SECTORS.map((item) => {
              const on = sector === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setQuery("sector", on ? null : item.id)}
                  className={cn(chipClass, on ? "bg-primary text-primary-foreground" : "border-2 border-border bg-card")}
                >
                  {item.title}
                </button>
              );
            })
          : [
              <button
                key="all"
                type="button"
                aria-pressed={!skill}
                onClick={() => setQuery("skill", null)}
                className={cn(chipClass, !skill ? "bg-work text-work-foreground" : "border-2 border-border bg-card")}
              >
                All
              </button>,
              ...mine.map((item) => {
                const on = skill === item;
                const title = SKILLS.find((entry) => entry.id === item)?.title ?? skillTitle(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setQuery("skill", on ? null : item)}
                    className={cn(chipClass, on ? "bg-work text-work-foreground" : "border-2 border-border bg-card")}
                  >
                    {title}
                  </button>
                );
              }),
            ]}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {countPhrase(projects, "project")} and {countPhrase(requests, "request")}
      </p>
      {!home ? (
        <p className="mt-3 text-sm leading-snug">
          Pick your place to see what is close to you.{" "}
          <Link href={placeHref} className="font-semibold text-primary">
            Pick your place
          </Link>
        </p>
      ) : null}
      {mode === "worker" && mine.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-card px-3 py-2 ring-1 ring-foreground/10">
          <p className="text-sm leading-5">Pick your work to see what fits you.</p>
          <Link
            href="/work/place"
            className="inline-flex min-h-11 items-center text-sm font-semibold whitespace-nowrap text-work"
          >
            Pick your work
          </Link>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <button
          type="button"
          onClick={clearFilters}
          className="mt-4 inline-flex min-h-11 items-center font-semibold whitespace-nowrap text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          Clear filters
        </button>
      ) : (
        <div className="mt-2 min-[840px]:flex min-[840px]:items-start min-[840px]:gap-4">
          <div className="grid min-w-0 grid-cols-1 gap-2 pb-24 min-[600px]:grid-cols-2 min-[600px]:pb-4 min-[840px]:w-3/5">
            {rows.map((row) =>
              row.kind === "project" ? (
                <ProjectCard key={`project-${row.project.id}`} project={row.project} />
              ) : (
                <RequestCard key={`request-${row.request.id}`} request={row.request} />
              ),
            )}
          </div>
          {desk ? (
            <div className="hidden min-h-[28rem] w-2/5 min-[840px]:block">
              <div className="sticky top-20 h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl">
                <MapView
                  points={mapPoints}
                  showMarkers
                  selectedId={null}
                  regionId={null}
                  fly={null}
                  onReady={() => undefined}
                  onMove={() => undefined}
                  onRegion={() => undefined}
                  onBlocked={() => undefined}
                  onPoint={() => undefined}
                  onFail={() => undefined}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
      <FloatingAction href={actionHref} label={actionLabel} tone={actionTone} />
    </div>
  );
}

function countPhrase(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function workerSkills(demo: ReturnType<typeof useDemo>): Skill[] {
  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  return [...new Set([primary, ...extras].filter((item): item is Skill => Boolean(item)))];
}

type Row = {
  rank: number;
  full: number;
  ratio: number;
  left: number;
  createdAt: string;
} & (
  | { kind: "project"; project: Project }
  | { kind: "request"; request: CapitalRequest }
);

function investorRows(demo: ReturnType<typeof useDemo>, home: Home | null, sector: Sector | null): Row[] {
  const projects = demo.projects.filter(
    (project) => inPlace(home, project) && (!sector || project.sector === sector),
  );
  const requests = demo.requests.filter(
    (request) =>
      request.status === "open" &&
      request.userId !== demo.userId &&
      inPlace(home, request) &&
      (!sector || request.sector === sector),
  );
  return sortRows([
    ...projects.map((project) => projectRow(demo, home, project)),
    ...requests.map((request) => requestRow(home, request)),
  ]);
}

function workerRows(
  demo: ReturnType<typeof useDemo>,
  home: Home | null,
  mine: Skill[],
  skill: Skill | null,
): Row[] {
  const skills = skill ? [skill] : mine;
  const openSkills = skill === null && mine.length === 0;
  const projects = demo.projects.filter((project) => {
    if (!inPlace(home, project)) return false;
    if (openSkills) return true;
    return project.needs.some((need) => skills.includes(need));
  });
  const requests = demo.requests.filter((request) => {
    if (request.status !== "open" || !inPlace(home, request)) return false;
    if (openSkills) return true;
    return request.skills.some((item) => skills.includes(item));
  });
  return sortRows([
    ...projects.map((project) => projectRow(demo, home, project)),
    ...requests.map((request) => requestRow(home, request)),
  ]);
}

function projectRow(demo: ReturnType<typeof useDemo>, home: Home | null, project: Project): Row {
  const committed = projectCommitted(project.committedJmd, demo.addedCommitments, project.id);
  const left = project.goalJmd - committed;
  const ratio = project.goalJmd > 0 ? committed / project.goalJmd : 0;
  return {
    kind: "project",
    project,
    rank: rankOf(home, project),
    full: left <= 0 ? 1 : 0,
    ratio,
    left,
    createdAt: "",
  };
}

function requestRow(home: Home | null, request: CapitalRequest): Row {
  return {
    kind: "request",
    request,
    rank: rankOf(home, request),
    full: 0,
    ratio: 0,
    left: 0,
    createdAt: request.createdAt.length === 10 ? `${request.createdAt}T00:00:00.000Z` : request.createdAt,
  };
}

function sortRows(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.kind !== b.kind) return a.kind === "project" ? -1 : 1;
    if (a.kind === "project") {
      if (a.full !== b.full) return a.full - b.full;
      if (a.ratio !== b.ratio) return b.ratio - a.ratio;
      return a.left - b.left;
    }
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}
