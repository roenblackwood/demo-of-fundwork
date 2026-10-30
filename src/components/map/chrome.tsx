"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Search, X } from "lucide-react";
import { REGIONS } from "@/lib/regions";
import { searchPlaces, type SearchHit } from "@/lib/openings";
import { SECTORS } from "@/lib/catalog";
import type { Sector } from "@/lib/types";
import { cn } from "cn";

const chip =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-border bg-card px-3 text-base font-semibold whitespace-nowrap hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";
const chipOn = "border-primary bg-primary text-primary-foreground hover:border-primary";

function useNarrow(max: number): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia(`(max-width: ${max}px)`);
      query.addEventListener("change", onStoreChange);
      return () => query.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(`(max-width: ${max}px)`).matches,
    () => false,
  );
}

export function PlaceSearch({
  onPick,
  collapsible = false,
}: {
  onPick: (hit: SearchHit) => void;
  collapsible?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const narrow = useNarrow(379);
  const hits = query.trim().length >= 2 ? searchPlaces(query) : [];
  const collapsed = collapsible && narrow && !open;

  if (collapsed) {
    return (
      <button
        type="button"
        aria-label="Search a town or country"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-full border-2 border-border bg-card shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <Search className="size-5" aria-hidden />
      </button>
    );
  }

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a town or country"
        aria-label="Search a town or country"
        className={cn(
          "h-11 w-full rounded-full border-2 border-border bg-card px-4 text-base shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring",
          collapsible && narrow && "pr-12",
        )}
      />
      {collapsible && narrow ? (
        <button
          type="button"
          aria-label="Close search"
          onClick={() => {
            setQuery("");
            setOpen(false);
          }}
          className="absolute top-0 right-1 inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden />
        </button>
      ) : null}
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
  regionId,
  onLens,
  onSector,
  onRegion,
  wrap = false,
}: {
  lens: "invest" | "work" | null;
  sector: Sector | null;
  regionId?: string | null;
  onLens: (lens: "invest" | "work" | null) => void;
  onSector: (sector: Sector | null) => void;
  onRegion?: (id: string) => void;
  wrap?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!menu) return;
    function close(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-regions]")) return;
      setMenu(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenu(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  return (
    <div className={cn("flex gap-2 pb-1", wrap && "flex-wrap")}>
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
        className={cn(chip, lens === "work" && "border-work bg-work text-work-foreground hover:border-work")}
        onClick={() => onLens(lens === "work" ? null : "work")}
      >
        Work
      </button>
      {onRegion ? (
        <div className="relative shrink-0" data-regions="">
          <button
            type="button"
            aria-expanded={menu}
            aria-controls={menuId}
            aria-pressed={Boolean(regionId)}
            className={cn(chip, regionId && chipOn)}
            onClick={() => setMenu((open) => !open)}
          >
            Regions
          </button>
          {menu ? (
            <div
              id={menuId}
              role="menu"
              className="absolute top-12 left-0 z-30 max-h-64 w-56 overflow-y-auto rounded-2xl border-2 border-border bg-card py-1 shadow-sm"
            >
              {REGIONS.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  role="menuitem"
                  className="flex min-h-11 w-full items-center px-4 text-left font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                  onClick={() => {
                    onRegion(region.id);
                    setMenu(false);
                  }}
                >
                  {region.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("flex gap-2", wrap ? "flex-wrap" : "min-w-0 flex-1 overflow-x-auto")}>
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
    </div>
  );
}

export function MapLoadNote({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="text-base">
      The map could not load. Showing the list.{" "}
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-11 items-center font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        Try again
      </button>
    </p>
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
