"use client";

import Link from "next/link";
import { PageBusy } from "@/components/busy";
import { MoneyText, StepHeader, TrustBadges } from "@/components/parts";
import { sectorTitle } from "@/lib/catalog";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { matchProjects } from "@/lib/match";
import { moneyStillOpen, projectCommitted } from "@/lib/ownership";
import { currencyOf, projectPlace } from "@/lib/seed";
import type { Skill } from "@/lib/types";

export function MatchesScreen() {
  const demo = useDemo();
  const usingFlow = Boolean(demo.flow?.townId && (demo.flow.parishId || demo.flow.countryId));
  const countryId = usingFlow
    ? demo.flow?.countryId || (demo.flow?.parishId ? "jamaica" : "")
    : demo.homeCountryId ?? "";
  const parishId = usingFlow ? demo.flow?.parishId ?? null : demo.homeParishId;
  const townId = usingFlow ? demo.flow?.townId ?? "" : demo.homeTownId ?? "";
  const placeId = parishId || countryId;
  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  const skills = [primary, ...extras].filter((item): item is Skill => Boolean(item));
  const uniqueSkills = [...new Set(skills)];
  const matches =
    countryId && townId
      ? matchProjects({ countryId, parishId, townId, skills: uniqueSkills, projects: demo.projects })
      : [];

  if (!demo.ready) return <PageBusy />;

  if (!primary || !countryId || !townId) {
    return (
      <div className="space-y-6">
        <StepHeader backHref="/work" title="Pick your work first" />
        <Link href="/work" className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}>
          Choose a region
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader
        backHref={`/work/${placeId}/${townId}/${primary}`}
        title={
          matches.length === 0 ? "No project needs this work yet" : "Projects for you"
        }
      />
      {matches.length === 0 ? (
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">
            Nothing open matches this work right now. You can try another parish or another kind of work.
          </p>
          <Link
            href={countryId === "jamaica" ? "/work/jamaica" : "/work"}
            className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
          >
            {countryId === "jamaica" ? "Try another parish" : "Try another place"}
          </Link>
          <Link
            href={`/work/${placeId}/${townId}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
          >
            Try another kind of work
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const where = projectPlace(match.project);
            const currency = currencyOf(match.project.countryId);
            const committed = projectCommitted(
              match.project.committedJmd,
              demo.addedCommitments,
              match.project.id,
            );
            const stillOpen = moneyStillOpen(match.project.goalJmd, committed);
            return (
              <Link
                key={match.project.id}
                href={`/projects/${match.project.id}`}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <Card className="shadow-sm">
                  <CardHeader>
                    <p className="text-sm font-semibold tracking-wide text-primary uppercase">
                      {sectorTitle(match.project.sector)}
                    </p>
                    <CardTitle>{match.project.name}</CardTitle>
                    <p className="text-base text-muted-foreground">
                      {where ? placeLine(where.town, where.parish) : "Jamaica"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-2xl leading-tight font-bold tracking-tight">
                      {stillOpen > 0 ? (
                        <MoneyText amount={stillOpen} currency={currency} short suffix="still needed" />
                      ) : (
                        "The money they asked for is in"
                      )}
                    </p>
                    <p className="text-lg leading-relaxed">{match.note.body}</p>
                    <TrustBadges checks={match.project.checks} limit={2} />
                    <span className="inline-flex min-h-11 items-center font-semibold text-primary">
                      View project
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
