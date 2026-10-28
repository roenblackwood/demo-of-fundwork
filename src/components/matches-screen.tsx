"use client";

import Link from "next/link";
import { StepHeader, TrustBadges } from "@/components/parts";
import { CAPITAL_LINE } from "@/lib/copy";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { matchProjects } from "@/lib/match";
import { placeName } from "@/lib/seed";
import type { Skill } from "@/lib/types";

export function MatchesScreen() {
  const demo = useDemo();
  const usingFlow = Boolean(demo.flow?.parishId && demo.flow?.townId);
  const parishId = usingFlow ? demo.flow?.parishId ?? "" : demo.homeParishId ?? "";
  const townId = usingFlow ? demo.flow?.townId ?? "" : demo.homeTownId ?? "";
  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  const skills = [primary, ...extras].filter((item): item is Skill => Boolean(item));
  const uniqueSkills = [...new Set(skills)];
  const matches =
    parishId && townId
      ? matchProjects({ parishId, townId, skills: uniqueSkills })
      : [];

  if (!demo.ready) return <p className="text-lg">One moment.</p>;

  if (!primary || !parishId || !townId) {
    return (
      <div>
        <StepHeader backHref="/work" title="Pick your work first" />
        <Link href="/work" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Choose a region
        </Link>
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        backHref={`/work/${parishId}/${townId}/${primary}`}
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
            href="/work/caribbean"
            className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
          >
            Try another parish
          </Link>
          <Link
            href={`/work/${parishId}/${townId}`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
          >
            Try another kind of work
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => {
            const where = placeName(match.project.parishId, match.project.townId);
            return (
              <Link
                key={match.project.id}
                href={`/projects/${match.project.id}`}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle>{match.project.name}</CardTitle>
                    <p className="text-base text-muted-foreground">
                      {where ? placeLine(where.town, where.parish) : "Jamaica"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-lg leading-relaxed">{match.note.body}</p>
                    <p className="text-base leading-relaxed">{CAPITAL_LINE}</p>
                    <TrustBadges checks={match.project.checks} />
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
