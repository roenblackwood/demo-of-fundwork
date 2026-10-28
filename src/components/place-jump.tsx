"use client";

import { useEffect } from "react";
import { notFound, useRouter } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { isSector } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import type { RegionId } from "@/lib/regions";
import { getCity, getCountry, getParish, getTown } from "@/lib/seed";

export function PlaceJump({
  parish,
  town,
  sector,
}: {
  parish: string;
  town: string;
  sector?: string;
}) {
  const router = useRouter();
  const { ready, updateFlow } = useDemo();
  const valid = Boolean(getTown(parish, town) || getCity(parish, town));
  const sectorOk = !sector || isSector(sector);

  useEffect(() => {
    if (!ready || !valid || !sectorOk || (sector && !isSector(sector))) return;
    const jamaica = Boolean(getParish(parish));
    const country = getCountry(jamaica ? "jamaica" : parish);
    updateFlow({
      regionId: (jamaica ? "caribbean" : country?.regionId) as RegionId | undefined,
      countryId: jamaica ? "jamaica" : parish,
      parishId: jamaica ? parish : undefined,
      townId: town,
      sector: sector && isSector(sector) ? sector : undefined,
    });
    const query = sector && isSector(sector) ? `?sector=${sector}` : "";
    router.replace(`/invest${query}`);
  }, [parish, ready, router, sector, sectorOk, town, updateFlow, valid]);

  if (ready && (!valid || !sectorOk)) notFound();
  return <PageBusy />;
}
