"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { ActionBar } from "@/components/parts";
import { ProjectCard } from "@/components/project-card";
import { RequestCard } from "@/components/request-card";
import { buttonVariants } from "@/components/ui/button";
import { SECTORS, SKILLS, isSector, isSkill, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { bandRank } from "@/lib/match";
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
  "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-base font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

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

  if (!demo.ready) return <PageBusy />;

  const rows = mode === "investor" ? investorRows(demo, home, sector) : workerRows(demo, home, mine, skill);
  const placeHref = mode === "investor" ? "/invest/place" : "/work/place";

  function setQuery(key: "sector" | "skill", value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.replace(query ? `${mode === "investor" ? "/invest" : "/work"}?${query}` : mode === "investor" ? "/invest" : "/work");
  }

  return (
    <div>
      <h1 className="sr-only">{mode === "investor" ? "Projects" : "Work"}</h1>
      <Link href={placeHref} className={cn(chipClass, "border-2 border-border bg-card")}>
        {home?.label ?? "Everywhere"}
      </Link>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
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
      {!home ? (
        <article className="mt-4 space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-lg leading-relaxed">Pick your place to see what is close to you.</p>
          <Link href={placeHref} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Pick your place
          </Link>
        </article>
      ) : null}
      {rows.length === 0 ? (
        <p className="mt-6 text-lg leading-relaxed">
          {mode === "worker" && mine.length === 0
            ? "Pick your work to see what fits you."
            : "Nothing open here yet."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((row) =>
            row.kind === "project" ? (
              <ProjectCard key={`project-${row.project.id}`} project={row.project} mark="Project" />
            ) : (
              <RequestCard key={`request-${row.request.id}`} request={row.request} mark="Request" />
            ),
          )}
        </div>
      )}
      <ActionBar>
        {mode === "investor" ? (
          <Link href={startHref(home)} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Start a project here
          </Link>
        ) : (
          <Link
            href={availableHref(home)}
            className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
          >
            Post that you are available
          </Link>
        )}
      </ActionBar>
    </div>
  );
}

function workerSkills(demo: ReturnType<typeof useDemo>): Skill[] {
  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  return [...new Set([primary, ...extras].filter((item): item is Skill => Boolean(item)))];
}

type Row =
  | { kind: "project"; project: Project; rank: number; name: string }
  | { kind: "request"; request: CapitalRequest; rank: number; name: string };

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
    ...projects.map((project) => ({
      kind: "project" as const,
      project,
      rank: rankOf(home, project),
      name: project.name,
    })),
    ...requests.map((request) => ({
      kind: "request" as const,
      request,
      rank: rankOf(home, request),
      name: request.note || request.sector,
    })),
  ]);
}

function workerRows(
  demo: ReturnType<typeof useDemo>,
  home: Home | null,
  mine: Skill[],
  skill: Skill | null,
): Row[] {
  const skills = skill ? [skill] : mine;
  if (skills.length === 0) return [];
  const projects = demo.projects.filter(
    (project) => inPlace(home, project) && project.needs.some((need) => skills.includes(need)),
  );
  const requests = demo.requests.filter(
    (request) =>
      request.status === "open" &&
      inPlace(home, request) &&
      request.skills.some((item) => skills.includes(item)),
  );
  return sortRows([
    ...projects.map((project) => ({
      kind: "project" as const,
      project,
      rank: rankOf(home, project),
      name: project.name,
    })),
    ...requests.map((request) => ({
      kind: "request" as const,
      request,
      rank: rankOf(home, request),
      name: request.note || request.sector,
    })),
  ]);
}

function sortRows(rows: Row[]): Row[] {
  return rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}
