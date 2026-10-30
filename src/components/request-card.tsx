import Link from "next/link";
import { MoneyText } from "@/components/parts";
import { sectorTitle, SECTOR_MARKS } from "@/lib/catalog";
import { placeLine } from "@/lib/format";
import { currencyOf, requestPlace } from "@/lib/seed";
import type { CapitalRequest } from "@/lib/types";
import { cn } from "cn";

export function RequestCard({ request, reason }: { request: CapitalRequest; reason?: string }) {
  const where = requestPlace(request);
  const place = where ? placeLine(where.town, where.parish) : "This place";
  const currency = currencyOf(request.countryId);
  const title = where ? `${sectorTitle(request.sector)} in ${where.town}` : sectorTitle(request.sector);
  const mark = SECTOR_MARKS[request.sector];
  const Icon = mark.icon;

  return (
    <Link
      href={`/requests/${request.id}`}
      className="flex items-start gap-2 rounded-2xl bg-card px-2 py-1 ring-1 ring-foreground/10 hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <span className={cn("grid size-16 shrink-0 place-items-center rounded-xl", mark.tile)} aria-hidden>
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">
          Request · {sectorTitle(request.sector)}
        </span>
        <span className="line-clamp-2 text-sm font-semibold leading-4">{title}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">{place}</span>
        <span className="text-[11px] font-semibold leading-4">
          <MoneyText amount={request.budget} currency={currency} short suffix="needed" />
        </span>
        {reason ? <span className="block truncate text-xs leading-4 text-muted-foreground">{reason}</span> : null}
      </span>
    </Link>
  );
}
