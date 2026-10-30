"use client";

import Link from "next/link";
import { MoneyText, TrustBadges } from "@/components/parts";
import { sectorTitle, SECTOR_MARKS } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { moneyStillOpen, projectCommitted } from "@/lib/ownership";
import { currencyOf, projectPlace } from "@/lib/seed";
import type { Project } from "@/lib/types";
import { cn } from "cn";

// Nice to have: a photo in place of the sector tile, the way YouTube leads with a thumbnail.

export function ProjectCard({ project }: { project: Project }) {
  const { addedCommitments } = useDemo();
  const where = projectPlace(project);
  const currency = currencyOf(project.countryId);
  const committed = projectCommitted(project.committedJmd, addedCommitments, project.id);
  const stillOpen = moneyStillOpen(project.goalJmd, committed);
  const percent = project.goalJmd <= 0 ? 0 : Math.min(100, (committed / project.goalJmd) * 100);
  const place = where ? placeLine(where.town, where.parish) : "Jamaica";
  const mark = SECTOR_MARKS[project.sector];
  const Icon = mark.icon;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex items-start gap-2 rounded-2xl bg-card px-2 py-1 ring-1 ring-foreground/10 hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <span className={cn("grid size-16 shrink-0 place-items-center rounded-xl", mark.tile)} aria-hidden>
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          Project · {sectorTitle(project.sector)}
        </span>
        <span className="line-clamp-2 text-sm font-semibold leading-4">{project.name}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">{place}</span>
        <span className="text-[11px] font-semibold leading-4">
          {stillOpen > 0 ? (
            <MoneyText amount={stillOpen} currency={currency} short suffix="needed" />
          ) : (
            "The money they asked for is in"
          )}
        </span>
        <span className="mt-px flex items-center gap-2">
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
  );
}
