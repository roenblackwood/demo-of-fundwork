"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePhotos } from "@/components/photo-box";
import { buttonVariants } from "@/components/ui/button";
import { sectorTitle, SECTOR_MARKS } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { moneyShort } from "@/lib/format";
import { capitalReserved, moneyStillOpen } from "@/lib/ownership";
import type { Opening } from "@/lib/openings";
import { leftToPledge } from "@/lib/pledges";
import { aboutUsd } from "@/lib/rates";
import { acceptedCount } from "@/lib/requests";
import { currencyOf } from "@/lib/seed";
import { cn } from "cn";

export function PreviewCard({
  row,
  reason,
  compact,
  onClose,
  onPrev,
  onNext,
}: {
  row: Opening;
  reason?: string;
  compact: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const demo = useDemo();
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const kind = row.project ? "project" : "request";
  const photos = usePhotos(kind, row.id);
  const photo = photos[0] ?? null;
  const sector = row.project?.sector ?? row.request?.sector;
  const mark = sector ? SECTOR_MARKS[sector] : null;
  const Icon = mark?.icon;
  const href = row.project ? `/projects/${row.id}` : `/requests/${row.id}`;
  const saved = demo.savedIds.includes(row.id);
  const currency = currencyOf(row.countryId);
  const money = row.project
    ? moneyStillOpen(
        row.project.goalJmd,
        capitalReserved(row.project.committedJmd, demo.addedCommitments, row.project.id),
      )
    : row.request
      ? leftToPledge(row.request.budget, demo.pledges, row.request.id)
      : 0;
  const goal = row.project ? row.project.goalJmd : row.request ? row.request.budget : 0;
  const filled = goal - money;
  const capital = goal <= 0 ? 0 : Math.max(0, Math.min(100, (filled / goal) * 100));
  const team =
    row.request && row.request.workersNeeded > 0
      ? Math.max(
          0,
          Math.min(100, (acceptedCount(demo.applications, row.request.id) / row.request.workersNeeded) * 100),
        )
      : null;
  const about = money > 0 ? aboutUsd(money, currency) : "";
  const label = sector ? `${row.project ? "Project" : "Request"} · ${sectorTitle(sector)}` : row.project ? "Project" : "Request";

  useEffect(() => {
    root.current?.focus();
  }, [row.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function save(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!demo.profileSet) {
      const params = new URLSearchParams();
      params.set("next", `${window.location.pathname}${window.location.search}`);
      params.set("save", row.id);
      if (sector) params.set("sector", sector);
      router.push(`/get-started?${params.toString()}`);
      return;
    }
    demo.saveItem(row.id, sector ?? "");
  }

  function openFromCard(event: React.MouseEvent) {
    if (!compact) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("a, button")) return;
    if (drag.current?.moved) return;
    router.push(href);
  }

  return (
    <article
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-label={row.name}
      className="relative w-full rounded-2xl bg-card p-3 shadow-lg ring-1 ring-foreground/10 outline-none"
      onClick={openFromCard}
      onPointerDown={(event) => {
        if (!compact) return;
        drag.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerUp={(event) => {
        const start = drag.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy)) {
          start.moved = true;
          if (dx < 0) onNext?.();
          else onPrev?.();
        }
      }}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <X className="size-5" aria-hidden />
      </button>
      <div className="flex items-start gap-3 pr-10">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={photo.alt} className="size-16 shrink-0 rounded-xl object-cover" />
        ) : mark && Icon ? (
          <span className={cn("grid size-16 shrink-0 place-items-center rounded-xl", mark.tile)} aria-hidden>
            <Icon className="size-7" strokeWidth={1.75} />
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <h2 className="text-base font-semibold leading-5">{row.name}</h2>
          <p className="text-sm text-muted-foreground">{row.place}</p>
        </div>
      </div>
      <p className="mt-3 text-base font-semibold">
        {money > 0 ? `${moneyShort(money, currency)} needed` : "The money they asked for is in"}
      </p>
      {about ? <p className="text-sm text-muted-foreground">{about}</p> : null}
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Money committed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(capital)}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${capital}%` }} />
      </div>
      {team !== null ? (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Team"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(team)}
        >
          <div className="h-full rounded-full bg-work" style={{ width: `${team}%` }} />
        </div>
      ) : null}
      {reason ? <p className="mt-2 line-clamp-1 text-sm">{reason}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        {compact && onPrev ? (
          <button
            type="button"
            aria-label="Previous"
            className="inline-flex size-11 items-center justify-center rounded-full border-2 border-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              onPrev();
            }}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
        ) : null}
        <Link href={href} className={cn(buttonVariants({ size: "sm" }), "min-w-24")}>
          View
        </Link>
        <button
          type="button"
          aria-label="Save"
          aria-pressed={saved}
          className="inline-flex size-11 items-center justify-center rounded-full border-2 border-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          onClick={save}
        >
          <Bookmark className={saved ? "size-5 fill-current" : "size-5"} aria-hidden />
        </button>
        {compact && onNext ? (
          <button
            type="button"
            aria-label="Next"
            className="inline-flex size-11 items-center justify-center rounded-full border-2 border-border focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  );
}
