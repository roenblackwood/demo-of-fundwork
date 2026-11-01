"use client";

import { useState } from "react";
import Link from "next/link";
import { countLine, openItems, type PlaceCounts } from "@/lib/place-counts";

export type DrillRow = {
  id: string;
  name: string;
  counts: PlaceCounts;
  suited: string[];
  chip?: string;
  region?: string;
};

const rowClass =
  "flex min-h-11 w-full flex-col items-start justify-center rounded-2xl border-2 border-border bg-card px-3 py-2 text-left hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

export function DrillBreadcrumb({
  parts,
}: {
  parts: { label: string; onClick?: () => void }[];
}) {
  return (
    <nav aria-label="Place" className="flex flex-wrap items-center gap-x-1 text-base">
      {parts.map((part, index) => {
        const last = index === parts.length - 1;
        return (
          <span key={`${part.label}-${index}`} className="inline-flex items-center gap-1">
            {index > 0 ? <span aria-hidden="true">›</span> : null}
            {last || !part.onClick ? (
              <span className="py-2 font-semibold">{part.label}</span>
            ) : (
              <button
                type="button"
                className="inline-flex min-h-11 items-center font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                onClick={part.onClick}
              >
                {part.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function DrillRows({
  rows,
  selectedId,
  onOpen,
  onHover,
}: {
  rows: DrillRow[];
  selectedId?: string | null;
  onOpen: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const [showQuiet, setShowQuiet] = useState(false);
  const ranked = [...rows].sort(
    (a, b) => openItems(b.counts) - openItems(a.counts) || a.name.localeCompare(b.name),
  );
  const quiet = ranked.filter((row) => row.counts.projects + row.counts.requests + row.counts.workers === 0);
  const quietIds = new Set(quiet.map((row) => row.id));
  const shown = ranked.filter((row) => !quietIds.has(row.id));
  return (
    <div className="space-y-2">
      {shown.map((row) => (
        <button
          key={row.id}
          type="button"
          className={selectedId === row.id ? `${rowClass} border-primary` : rowClass}
          onClick={() => onOpen(row.id)}
          onMouseEnter={() => onHover?.(row.id)}
          onMouseLeave={() => onHover?.(null)}
        >
          <span className="text-base font-semibold">{row.name}</span>
          {row.chip ? (
            <span className="mt-1 inline-flex items-center rounded-full border-2 border-border px-3 py-1 text-sm font-semibold">
              {row.chip}
            </span>
          ) : null}
          <span className="text-sm text-muted-foreground">{countLine(row.counts)}</span>
          {row.suited.length > 0 ? (
            <span className="text-sm">Suited here: {row.suited.join(", ")}</span>
          ) : null}
        </button>
      ))}
      {quiet.length > 0 ? (
        <button
          type="button"
          className={rowClass}
          aria-expanded={showQuiet}
          onClick={() => setShowQuiet((value) => !value)}
        >
          <span className="text-base font-semibold">{quiet.length} more with nothing open yet</span>
        </button>
      ) : null}
      {showQuiet
        ? quiet.map((row) => (
            <button
              key={row.id}
              type="button"
              className={selectedId === row.id ? `${rowClass} border-primary` : rowClass}
              onClick={() => onOpen(row.id)}
              onMouseEnter={() => onHover?.(row.id)}
              onMouseLeave={() => onHover?.(null)}
            >
              <span className="text-base font-semibold">{row.name}</span>
              {row.chip ? (
                <span className="mt-1 inline-flex items-center rounded-full border-2 border-border px-3 py-1 text-sm font-semibold">
                  {row.chip}
                </span>
              ) : null}
              <span className="text-sm text-muted-foreground">{countLine(row.counts)}</span>
              {row.suited.length > 0 ? (
                <span className="text-sm">Suited here: {row.suited.join(", ")}</span>
              ) : null}
            </button>
          ))
        : null}
    </div>
  );
}

export function EmptyPlace({
  startHref,
  postHref,
  watched,
  onWatch,
}: {
  startHref: string | null;
  postHref: string | null;
  watched: boolean;
  onWatch: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-base">Nothing here yet.</p>
      {startHref ? (
        <Link href={startHref} className="flex min-h-11 w-full items-center font-semibold text-primary">
          Start a project here
        </Link>
      ) : null}
      {postHref ? (
        <Link href={postHref} className="flex min-h-11 w-full items-center font-semibold text-primary">
          Post that you are available
        </Link>
      ) : null}
      <button
        type="button"
        className="inline-flex min-h-11 items-center font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        onClick={onWatch}
        disabled={watched}
      >
        {watched ? "We will tell you." : "Tell me when something opens"}
      </button>
    </div>
  );
}
