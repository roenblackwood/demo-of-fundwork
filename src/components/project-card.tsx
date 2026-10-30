"use client";

import Link from "next/link";
import { CardNotes } from "@/components/card-notes";
import { usePhotos } from "@/components/photo-box";
import { MoneyText, TrustBadges } from "@/components/parts";
import { sectorTitle, SECTOR_MARKS } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { capitalReserved, moneyStillOpen } from "@/lib/ownership";
import type { ScorePart } from "@/lib/recommend";
import { currencyOf, projectPlace } from "@/lib/seed";
import type { Project } from "@/lib/types";
import { cn } from "cn";

export function ProjectCard({
  project,
  reason,
  parts,
}: {
  project: Project;
  reason?: string;
  parts?: ScorePart[];
}) {
  const { addedCommitments } = useDemo();
  const photos = usePhotos("project", project.id);
  const photo = photos[0] ?? null;
  const where = projectPlace(project);
  const currency = currencyOf(project.countryId);
  const reserved = capitalReserved(project.committedJmd, addedCommitments, project.id);
  const stillOpen = moneyStillOpen(project.goalJmd, reserved);
  const percent = project.goalJmd <= 0 ? 0 : Math.min(100, (reserved / project.goalJmd) * 100);
  const place = where ? placeLine(where.town, where.parish) : "Jamaica";
  const mark = SECTOR_MARKS[project.sector];
  const Icon = mark.icon;

  return (
    <div
      data-sector={project.sector}
      className="relative rounded-2xl bg-card ring-1 ring-foreground/10 hover:bg-secondary"
    >
      <Link
        href={`/projects/${project.id}`}
        className="flex items-start gap-2 px-2 py-2 pr-24 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={photo.alt} className="size-16 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className={cn("grid size-16 shrink-0 place-items-center rounded-xl", mark.tile)} aria-hidden>
            <Icon className="size-7" strokeWidth={1.75} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="block truncate text-sm leading-5 text-muted-foreground">
            Project · {sectorTitle(project.sector)}
          </span>
          <span className="line-clamp-2 text-base font-semibold leading-5">{project.name}</span>
          <span className="block truncate text-sm leading-5 text-muted-foreground">{place}</span>
          <span className="text-sm font-semibold leading-5">
            {stillOpen > 0 ? (
              <MoneyText amount={stillOpen} currency={currency} short suffix="needed" />
            ) : (
              "The money they asked for is in"
            )}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span
              className="block h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-label="Money committed"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
            >
              <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </span>
            <TrustBadges checks={project.checks} limit={1} compact />
          </span>
        </span>
      </Link>
      <CardNotes id={project.id} sector={project.sector} reason={reason} parts={parts} />
    </div>
  );
}
