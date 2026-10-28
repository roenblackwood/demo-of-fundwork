"use client";

import { REGIONS, type RegionId } from "@/lib/regions";
import { cn } from "cn";

export function RegionMap({
  selected,
  onSelect,
}: {
  selected: RegionId | null;
  onSelect: (id: RegionId) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[#c5ddd4] ring-1 ring-foreground/10">
      <svg viewBox="0 0 340 380" className="block w-full" aria-hidden>
        <circle cx="28" cy="36" r="5" fill="#9ec4b6" />
        <circle cx="52" cy="58" r="3.5" fill="#9ec4b6" />
        <circle cx="78" cy="28" r="2.5" fill="#9ec4b6" />
        <circle cx="250" cy="28" r="3" fill="#9ec4b6" />
        <circle cx="300" cy="250" r="4" fill="#9ec4b6" />
      </svg>
      {REGIONS.map((region) => {
        const active = selected === region.id;
        return (
          <button
            key={region.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(region.id)}
            className={cn(
              "absolute flex flex-col items-center justify-center rounded-2xl border-2 px-2 text-center text-base leading-tight font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring",
              region.open && active && "border-primary bg-primary text-primary-foreground",
              region.open && !active && "border-primary bg-card text-foreground",
              !region.open && active && "border-[#8c3418] bg-[#f4e4c8] text-foreground",
              !region.open && !active && "border-[#cfc8ba] bg-card/95 text-foreground",
            )}
            style={{
              left: region.left,
              top: region.top,
              width: region.width,
              height: region.height,
            }}
          >
            <span>{region.name}</span>
            {region.open ? (
              <span className={cn("mt-1 text-sm font-semibold", active ? "text-primary-foreground" : "text-primary")}>
                Open
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
