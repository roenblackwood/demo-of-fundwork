"use client";

import { useState } from "react";
import { REGIONS } from "@/lib/regions";
import { searchPlaces, type SearchHit } from "@/lib/openings";
import { SECTORS } from "@/lib/catalog";
import type { Sector } from "@/lib/types";
import { cn } from "cn";

const chip =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border-2 border-border bg-card px-3 text-base font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";
const chipOn = "border-primary bg-primary text-primary-foreground";

export function PlaceSearch({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [query, setQuery] = useState("");
  const hits = query.trim().length >= 2 ? searchPlaces(query) : [];

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a town or country"
        aria-label="Search a town or country"
        className="h-11 w-full rounded-full border-2 border-border bg-card px-4 text-base shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring"
      />
      {hits.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border-2 border-border bg-card py-1 shadow-sm">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="flex min-h-11 w-full flex-col justify-center px-4 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                onClick={() => {
                  onPick(hit);
                  setQuery("");
                }}
              >
                <span className="font-semibold">{hit.label}</span>
                <span className="text-sm text-muted-foreground">{hit.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RegionChipRow({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {REGIONS.map((region) => (
        <button
          key={region.id}
          type="button"
          aria-pressed={selected === region.id}
          onClick={() => onSelect(region.id)}
          className={cn(chip, selected === region.id && chipOn)}
        >
          {region.name}
        </button>
      ))}
    </div>
  );
}

export function FilterChips({
  lens,
  sector,
  onLens,
  onSector,
}: {
  lens: "invest" | "work" | null;
  sector: Sector | null;
  onLens: (lens: "invest" | "work" | null) => void;
  onSector: (sector: Sector | null) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        aria-pressed={lens === "invest"}
        className={cn(chip, lens === "invest" && chipOn)}
        onClick={() => onLens(lens === "invest" ? null : "invest")}
      >
        Invest
      </button>
      <button
        type="button"
        aria-pressed={lens === "work"}
        className={cn(chip, lens === "work" && "border-work bg-work text-work-foreground")}
        onClick={() => onLens(lens === "work" ? null : "work")}
      >
        Work
      </button>
      {SECTORS.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={sector === item.id}
          className={cn(chip, sector === item.id && chipOn)}
          onClick={() => onSector(sector === item.id ? null : item.id)}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}

export function ShowMapButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      Show the map
    </button>
  );
}
