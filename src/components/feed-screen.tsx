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
import { UseMyLocation } from "@/components/use-location";
import { buttonVariants } from "@/components/ui/button";
import { SECTORS, SKILLS, isSector, isSkill, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { bandRank } from "@/lib/match";
import { capitalReserved } from "@/lib/ownership";
import { openingFromProject, openingFromRequest } from "@/lib/openings";
import {
  explainItem,
  itemFromProject,
  itemFromRequest,
  orderCards,
  reachLabel,
  regionOf,
  workerAllows,
  type PlacePick,
} from "@/lib/profile";
import type { ScorePart } from "@/lib/recommend";
import { getCity, getCountry, getParish, getTown } from "@/lib/seed";
import type { CapitalRequest, PathChoice, Project, Sector, Skill } from "@/lib/types";

type FeedOrder = "for-you" | "closest" | "newest";

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

  const profileKey = `${demo.userId}:${demo.profileSet ? "1" : "0"}`;
  const [order, setOrder] = useState<FeedOrder>(demo.profileSet ? "for-you" : "closest");
  const [orderKey, setOrderKey] = useState(profileKey);
  if (orderKey !== profileKey) {
    setOrderKey(profileKey);
    setOrder(demo.profileSet ? "for-you" : "closest");
  }
  const [desk, setDesk] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 840px)");
    const apply = () => setDesk(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const rows = useMemo(
    () =>
      mode === "investor"
        ? investorRows(demo, home, sector, order)
        : workerRows(demo, home, mine, skill, order),
    [mode, demo, home, sector, mine, skill, order],
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
          {placeChipLabel(demo, mode, home)}
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </Link>
        {mode === "worker" && demo.profileSet ? (
          <button
            type="button"
            aria-pressed={demo.seeEverywhere}
            onClick={() => demo.setSeeEverywhere(!demo.seeEverywhere)}
            className={cn(chipClass, demo.seeEverywhere ? "bg-work text-work-foreground" : "border-2 border-border bg-card")}
          >
            See everywhere
          </button>
        ) : null}
        {mode === "investor" && demo.profileSet ? (
          <button
            type="button"
            aria-pressed={demo.nearMe}
            onClick={() => demo.setNearMe(!demo.nearMe)}
            className={cn(chipClass, demo.nearMe ? "bg-primary text-primary-foreground" : "border-2 border-border bg-card")}
          >
            Near me
          </button>
        ) : null}
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
      <UseMyLocation
        className={cn(chipClass, "mt-2 border-2 border-border bg-card")}
        onTown={(place) => demo.setHomeTown(place)}
      />
      <div className="mt-2 flex gap-2 overflow-x-auto" role="group" aria-label="Order">
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
            className={cn(chipClass, order === id ? "bg-foreground text-background" : "border-2 border-border bg-card")}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {countPhrase(projects, "project")} and {countPhrase(requests, "request")}
      </p>
      {!home && !(mode === "investor" && demo.profileSet && !demo.nearMe) ? (
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
          <div data-order={order} className="grid min-w-0 grid-cols-1 gap-2 pb-24 min-[600px]:grid-cols-2 min-[600px]:pb-4 min-[840px]:w-3/5">
            {rows.map((row) =>
              row.kind === "project" ? (
                <ProjectCard
                  key={`project-${row.project.id}`}
                  project={row.project}
                  reason={order === "for-you" ? row.reasons.join(" · ") : undefined}
                  parts={order === "for-you" ? row.parts : undefined}
                />
              ) : (
                <RequestCard
                  key={`request-${row.request.id}`}
                  request={row.request}
                  reason={order === "for-you" ? row.reasons.join(" · ") : undefined}
                  parts={order === "for-you" ? row.parts : undefined}
                />
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
  id: string;
  sector: Sector;
  rank: number;
  full: number;
  ratio: number;
  left: number;
  score: number;
  reasons: string[];
  parts: ScorePart[];
  createdAt: string;
} & (
  | { kind: "project"; project: Project }
  | { kind: "request"; request: CapitalRequest }
);

function personPlace(home: Home | null): PlacePick | null {
  if (!home?.countryId || !home.townId) return null;
  return { countryId: home.countryId, parishId: home.parishId, townId: home.townId };
}

function placeChipLabel(
  demo: ReturnType<typeof useDemo>,
  mode: PathChoice,
  home: Home | null,
): string {
  if (mode === "investor" && demo.profileSet && !demo.nearMe) return "Everywhere";
  if (mode === "worker" && demo.profileSet && demo.seeEverywhere) return "Everywhere";
  if (mode === "worker" && demo.profileSet) return reachLabel(demo.profile.reach, personPlace(home));
  return home?.label ?? "Everywhere";
}

function allowsPlace(
  demo: ReturnType<typeof useDemo>,
  mode: PathChoice,
  home: Home | null,
  item: { countryId: string; parishId: string | null; townId: string },
): boolean {
  if (mode === "investor") {
    if (demo.profileSet && !demo.nearMe) return true;
    if (demo.profileSet && demo.nearMe) {
      return (
        Boolean(home?.townId) &&
        item.countryId === home?.countryId &&
        item.townId === home.townId &&
        (item.parishId ?? null) === (home?.parishId ?? null)
      );
    }
    return inPlace(home, item);
  }
  if (demo.profileSet && demo.role === "worker") {
    return workerAllows(demo.profile, personPlace(home), demo.seeEverywhere, {
      ...item,
      regionId: regionOf(item.countryId),
    });
  }
  return inPlace(home, item);
}

function investorRows(
  demo: ReturnType<typeof useDemo>,
  home: Home | null,
  sector: Sector | null,
  order: FeedOrder,
): Row[] {
  const projects = demo.projects.filter(
    (project) => allowsPlace(demo, "investor", home, project) && (!sector || project.sector === sector),
  );
  const requests = demo.requests.filter(
    (request) =>
      request.status === "open" &&
      request.userId !== demo.userId &&
      allowsPlace(demo, "investor", home, request) &&
      (!sector || request.sector === sector),
  );
  return finishRows(demo, home, order, [
    ...projects.map((project) => projectRow(demo, home, project)),
    ...requests.map((request) => requestRow(demo, home, request)),
  ]);
}

function workerRows(
  demo: ReturnType<typeof useDemo>,
  home: Home | null,
  mine: Skill[],
  skill: Skill | null,
  order: FeedOrder,
): Row[] {
  const skills = skill ? [skill] : mine;
  const openSkills = skill === null && mine.length === 0;
  const projects = demo.projects.filter((project) => {
    if (!allowsPlace(demo, "worker", home, project)) return false;
    if (openSkills) return true;
    return project.needs.some((need) => skills.includes(need));
  });
  const requests = demo.requests.filter((request) => {
    if (request.status !== "open" || !allowsPlace(demo, "worker", home, request)) return false;
    if (openSkills) return true;
    return request.skills.some((item) => skills.includes(item));
  });
  return finishRows(demo, home, order, [
    ...projects.map((project) => projectRow(demo, home, project)),
    ...requests.map((request) => requestRow(demo, home, request)),
  ]);
}

function finishRows(demo: ReturnType<typeof useDemo>, home: Home | null, order: FeedOrder, rows: Row[]): Row[] {
  const hidden = new Set(demo.hiddenIds);
  const visible = rows.filter((row) => !hidden.has(row.id));
  if (order === "closest" || !demo.profileSet) return sortRows(visible);
  if (order === "newest") return orderCards(visible, "newest", Date.now());
  return orderCards(visible, "for-you", Date.now());
}

function scored(
  demo: ReturnType<typeof useDemo>,
  home: Home | null,
  item: ReturnType<typeof itemFromProject>,
): { score: number; reasons: string[]; parts: ScorePart[] } {
  const explained = demo.profileSet
    ? explainItem(
        item,
        demo.role === "worker" ? "worker" : demo.role === "investor" ? "investor" : null,
        demo.profile,
        personPlace(home),
        demo.seeEverywhere,
        demo.sectorDown[item.sector] ?? 0,
        Date.now(),
      )
    : null;
  return explained ?? { score: 0, reasons: [], parts: [] };
}

function projectRow(demo: ReturnType<typeof useDemo>, home: Home | null, project: Project): Row {
  const reserved = capitalReserved(project.committedJmd, demo.addedCommitments, project.id);
  const left = project.goalJmd - reserved;
  const ratio = project.goalJmd > 0 ? reserved / project.goalJmd : 0;
  const item = itemFromProject(project, demo.addedCommitments);
  const note = scored(demo, home, item);
  return {
    kind: "project",
    id: project.id,
    sector: project.sector,
    project,
    rank: rankOf(home, project),
    full: left <= 0 ? 1 : 0,
    ratio,
    left,
    createdAt: item.createdAt,
    ...note,
  };
}

function requestRow(demo: ReturnType<typeof useDemo>, home: Home | null, request: CapitalRequest): Row {
  const item = itemFromRequest(request, demo.applications, demo.pledges);
  const note = scored(demo, home, item);
  return {
    kind: "request",
    id: request.id,
    sector: request.sector,
    request,
    rank: rankOf(home, request),
    full: 0,
    ratio: 0,
    left: 0,
    createdAt: item.createdAt,
    ...note,
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
