import Link from "next/link";
import { SectorTile } from "@/components/parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sectorTitle } from "@/lib/catalog";
import { moneyShort, placeLine } from "@/lib/format";
import { currencyOf, requestPlace } from "@/lib/seed";
import type { CapitalRequest } from "@/lib/types";

export function RequestCard({
  request,
  reason,
}: {
  request: CapitalRequest;
  reason?: string;
}) {
  const where = requestPlace(request);
  const place = where ? placeLine(where.town, where.parish) : "This place";
  const currency = currencyOf(request.countryId);

  return (
    <Link
      href={`/requests/${request.id}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <Card className="h-full shadow-sm">
        <CardHeader>
          <SectorTile sector={request.sector} />
          <p className="text-base font-semibold text-primary">{sectorTitle(request.sector)}</p>
          <CardTitle>{place}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-2xl leading-tight font-bold tracking-tight">
            {moneyShort(request.budget, currency)}
          </p>
          <p className="text-lg font-semibold">{request.workersNeeded} workers needed</p>
          {reason ? <p className="text-base leading-relaxed text-muted-foreground">{reason}</p> : null}
        </CardContent>
      </Card>
    </Link>
  );
}
