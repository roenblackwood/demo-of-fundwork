"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FundingPills, OwnershipStrip, TrustBadges } from "@/components/parts";
import { projectNote } from "@/lib/ai";
import { CAPITAL_LINE } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { money, moneyShort, placeLine } from "@/lib/format";
import { fundingLabels, moneyStillOpen, projectCommitted } from "@/lib/ownership";
import { currencyOf, projectPlace } from "@/lib/seed";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  const { addedCommitments } = useDemo();
  const where = projectPlace(project);
  const currency = currencyOf(project.countryId);
  const committed = projectCommitted(
    project.committedJmd,
    addedCommitments,
    project.id,
  );
  const stillOpen = moneyStillOpen(project.goalJmd, committed);
  const note = projectNote(project);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <Card className="h-full shadow-sm">
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
          <p className="text-base text-muted-foreground">
            {where ? placeLine(where.town, where.parish) : "Jamaica"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <FundingPills
            labels={fundingLabels(committed, project.goalJmd, project.workStarted)}
          />
          <p className="text-base leading-relaxed">{note.body}</p>
          <p className="text-base leading-relaxed">{CAPITAL_LINE}</p>
          <p className="text-lg font-semibold">
            {stillOpen > 0
              ? `${moneyShort(stillOpen, currency)} still needed`
              : "The money they asked for is in"}
          </p>
          <p className="text-base">
            {project.workersMatched} of {project.workersNeeded} workers matched
          </p>
          <p className="text-base leading-relaxed">
            A week of work pays about {money(project.weeklyPayout, currency)} in the stable unit.
          </p>
          <TrustBadges checks={project.checks} />
          <OwnershipStrip />
          <p className="text-base leading-relaxed">Your work turns into ownership units.</p>
        </CardContent>
      </Card>
    </Link>
  );
}
