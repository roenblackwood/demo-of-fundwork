"use client";

import { useState } from "react";
import Link from "next/link";
import { RegionMap } from "@/components/region-map";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { CAPITAL_LINE } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { getRegion, type RegionId } from "@/lib/regions";

export default function HomePage() {
  const { startPath } = useDemo();
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const region = regionId ? getRegion(regionId) : undefined;

  return (
    <div className="flex flex-1 flex-col py-6">
      <h1 className="font-display text-4xl leading-tight">Where should we look?</h1>
      <div className="mt-6">
        <RegionMap selected={regionId} onSelect={setRegionId} />
      </div>
      {region?.open ? (
        <div className="mt-6 space-y-4">
          <p className="text-lg leading-relaxed">Jamaica is open in the Caribbean.</p>
          <Link
            href="/invest/caribbean"
            onClick={() => startPath("investor")}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            I want to invest
          </Link>
          <Link
            href="/work/caribbean"
            onClick={() => startPath("worker")}
            className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
          >
            I want to work
          </Link>
        </div>
      ) : region ? (
        <div className="mt-6 space-y-4">
          <p className="text-lg leading-relaxed">
            Nothing open in {region.name} yet. This demo starts in the Caribbean.
          </p>
          <button
            type="button"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
            onClick={() => setRegionId("caribbean")}
          >
            See the Caribbean
          </button>
        </div>
      ) : (
        <p className="mt-6 text-lg text-muted-foreground">Tap a region.</p>
      )}
      <p className="mt-8 text-lg leading-relaxed">{CAPITAL_LINE}</p>
      <p className="mt-3 text-base text-muted-foreground">A demo. No money moves.</p>
    </div>
  );
}
