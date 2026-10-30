"use client";

import Link from "next/link";
import { CardNotes } from "@/components/card-notes";
import { usePhotos } from "@/components/photo-box";
import { CapitalBar } from "@/components/pledge-bars";
import { sectorTitle, SECTOR_MARKS } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { activePledges, pledgedAmount } from "@/lib/pledges";
import type { ScorePart } from "@/lib/recommend";
import { currencyOf, requestPlace } from "@/lib/seed";
import type { CapitalRequest } from "@/lib/types";
import { cn } from "cn";

export function RequestCard({
  request,
  reason,
  parts,
}: {
  request: CapitalRequest;
  reason?: string;
  parts?: ScorePart[];
}) {
  const demo = useDemo();
  const photos = usePhotos("request", request.id);
  const photo = photos[0] ?? null;
  const where = requestPlace(request);
  const place = where ? placeLine(where.town, where.parish) : "This place";
  const currency = currencyOf(request.countryId);
  const investors = activePledges(demo.pledges, request.id).length;
  const pledged = pledgedAmount(demo.pledges, request.id);
  const title = where ? `${sectorTitle(request.sector)} in ${where.town}` : sectorTitle(request.sector);
  const mark = SECTOR_MARKS[request.sector];
  const Icon = mark.icon;

  return (
    <div data-sector={request.sector} className="relative rounded-2xl bg-card ring-1 ring-foreground/10 hover:bg-secondary">
      <Link
        href={`/requests/${request.id}`}
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
            Request · {sectorTitle(request.sector)}
          </span>
          <span className="line-clamp-2 text-base font-semibold leading-5">{title}</span>
          <span className="block truncate text-sm leading-5 text-muted-foreground">{place}</span>
          <CapitalBar
            pledged={pledged}
            budget={request.budget}
            investors={investors}
            currency={currency}
            compact
          />
        </span>
      </Link>
      <CardNotes id={request.id} sector={request.sector} reason={reason} parts={parts} />
    </div>
  );
}
