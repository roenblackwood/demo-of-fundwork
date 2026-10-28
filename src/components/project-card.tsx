"use client";

import Link from "next/link";
import { SectorTile, TrustBadges } from "@/components/parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sectorTitle } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { moneyShort, placeLine } from "@/lib/format";
import { moneyStillOpen, projectCommitted } from "@/lib/ownership";
import { currencyOf, projectPlace } from "@/lib/seed";
import type { Project } from "@/lib/types";

// Nice to have: a photo in place of the sector tile, the way YouTube leads with a thumbnail.

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
  const percent =
    project.goalJmd <= 0 ? 0 : Math.min(100, (committed / project.goalJmd) * 100);
  const place = where ? placeLine(where.town, where.parish) : "Jamaica";

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <Card className="h-full shadow-sm">
        <CardHeader>
          <SectorTile sector={project.sector} />
          <p className="text-base font-semibold text-primary">{sectorTitle(project.sector)}</p>
          <CardTitle>{project.name}</CardTitle>
          <p className="text-base text-muted-foreground">{place}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-2xl leading-tight font-bold tracking-tight">
            {stillOpen > 0
              ? `${moneyShort(stillOpen, currency)} still needed`
              : "The money they asked for is in"}
          </p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Money committed"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <TrustBadges checks={project.checks} limit={1} />
        </CardContent>
      </Card>
    </Link>
  );
}
