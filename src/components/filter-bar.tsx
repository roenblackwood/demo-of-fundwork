"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, MapPin, X } from "lucide-react";
import { SECTORS, SKILLS, skillTitle } from "@/lib/catalog";
import type { AppliedFilters, ListOrder } from "@/lib/list-filters";
import { nearestTown, type PlacePick } from "@/lib/profile";
import type { Sector, Skill } from "@/lib/types";
import { cn } from "cn";

const chip =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-full border-2 border-border bg-card px-3 text-sm font-semibold whitespace-nowrap hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

const ORDER_LABEL: Record<ListOrder, string> = {
  "for-you": "For you",
  closest: "Closest",
  newest: "Newest",
};

function usePhone(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(max-width: 839px)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(max-width: 839px)").matches,
    () => false,
  );
}

export function FilterBar({
  placeLabel,
  placeHref,
  onTown,
  sector,
  onSector,
  order,
  onOrder,
  applied,
  onApply,
  skills,
  homeToggle,
  nearMe,
  seeEverywhere,
  onNearMe,
  onSeeEverywhere,
  placeChip,
  onClear,
}: {
  placeLabel: string;
  placeHref: string;
  onTown: (place: PlacePick) => void;
  sector: Sector | null;
  onSector: (sector: Sector | null) => void;
  order: ListOrder;
  onOrder: (order: ListOrder) => void;
  applied: AppliedFilters;
  onApply: (next: AppliedFilters) => void;
  skills?: Skill[];
  homeToggle?: "invest" | "work" | null;
  nearMe?: boolean;
  seeEverywhere?: boolean;
  onNearMe?: (value: boolean) => void;
  onSeeEverywhere?: (value: boolean) => void;
  placeChip?: { label: string; onRemove: () => void } | null;
  onClear: () => void;
}) {
  const sectorTitle = sector ? SECTORS.find((item) => item.id === sector)?.title ?? "Sector" : "Sector";
  const chips = activeChips({
    sector,
    onSector,
    applied,
    onApply,
    nearMe,
    seeEverywhere,
    onNearMe,
    onSeeEverywhere,
    placeChip,
  });

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {homeToggle !== undefined ? (
          <>
            <button
              type="button"
              aria-pressed={homeToggle === "invest"}
              className={cn(chip, homeToggle === "invest" && "border-primary bg-primary text-primary-foreground")}
              onClick={() =>
                onApply({ ...applied, kind: homeToggle === "invest" ? "all" : "project" })
              }
            >
              Invest
            </button>
            <button
              type="button"
              aria-pressed={homeToggle === "work"}
              className={cn(chip, homeToggle === "work" && "border-work bg-work text-work-foreground")}
              onClick={() =>
                onApply({ ...applied, kind: homeToggle === "work" ? "all" : "request" })
              }
            >
              Work
            </button>
          </>
        ) : null}
        <PlaceMenu
          label={placeLabel}
          placeHref={placeHref}
          onTown={onTown}
          nearMe={nearMe}
          seeEverywhere={seeEverywhere}
          onNearMe={onNearMe}
          onSeeEverywhere={onSeeEverywhere}
        />
        <MenuButton label={sectorTitle} pressed={Boolean(sector)}>
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  onSector(null);
                  close();
                }}
              >
                All sectors
              </MenuItem>
              {SECTORS.map((item) => (
                <MenuItem
                  key={item.id}
                  onClick={() => {
                    onSector(item.id);
                    close();
                  }}
                >
                  {item.title}
                </MenuItem>
              ))}
            </>
          )}
        </MenuButton>
        <MenuButton label={`Sort: ${ORDER_LABEL[order]}`} pressed={order !== "newest"}>
          {(close) =>
            (Object.keys(ORDER_LABEL) as ListOrder[]).map((id) => (
              <MenuItem
                key={id}
                onClick={() => {
                  onOrder(id);
                  close();
                }}
              >
                {ORDER_LABEL[id]}
              </MenuItem>
            ))
          }
        </MenuButton>
        <FiltersMenu applied={applied} skills={skills} onApply={onApply} />
      </div>
      {chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {chips.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onRemove}
              className="inline-flex min-h-11 items-center gap-1 rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              {item.label}
              <X className="size-4" aria-hidden />
              <span className="sr-only">Remove {item.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

function activeChips(input: {
  sector: Sector | null;
  onSector: (sector: Sector | null) => void;
  applied: AppliedFilters;
  onApply: (next: AppliedFilters) => void;
  nearMe?: boolean;
  seeEverywhere?: boolean;
  onNearMe?: (value: boolean) => void;
  onSeeEverywhere?: (value: boolean) => void;
  placeChip?: { label: string; onRemove: () => void } | null;
}): { id: string; label: string; onRemove: () => void }[] {
  const chips: { id: string; label: string; onRemove: () => void }[] = [];
  if (input.placeChip) chips.push({ id: "place", label: input.placeChip.label, onRemove: input.placeChip.onRemove });
  if (input.sector) {
    const title = SECTORS.find((item) => item.id === input.sector)?.title ?? "Sector";
    chips.push({ id: "sector", label: title, onRemove: () => input.onSector(null) });
  }
  if (input.applied.kind === "project") {
    chips.push({
      id: "kind",
      label: "Projects",
      onRemove: () => input.onApply({ ...input.applied, kind: "all" }),
    });
  }
  if (input.applied.kind === "request") {
    chips.push({
      id: "kind",
      label: "Requests",
      onRemove: () => input.onApply({ ...input.applied, kind: "all" }),
    });
  }
  if (input.applied.readiness === "ready") {
    chips.push({
      id: "ready",
      label: "Checks are done",
      onRemove: () => input.onApply({ ...input.applied, readiness: "any" }),
    });
  }
  if (input.applied.readiness === "open") {
    chips.push({
      id: "ready",
      label: "Checks still open",
      onRemove: () => input.onApply({ ...input.applied, readiness: "any" }),
    });
  }
  if (input.applied.confirmed) {
    chips.push({
      id: "confirmed",
      label: "Money already confirmed",
      onRemove: () => input.onApply({ ...input.applied, confirmed: false }),
    });
  }
  if (input.applied.skill) {
    const title = SKILLS.find((item) => item.id === input.applied.skill)?.title ?? skillTitle(input.applied.skill as Skill);
    chips.push({
      id: "skill",
      label: title,
      onRemove: () => input.onApply({ ...input.applied, skill: null }),
    });
  }
  if (input.nearMe && input.onNearMe) {
    chips.push({ id: "near", label: "Near me", onRemove: () => input.onNearMe?.(false) });
  }
  if (input.seeEverywhere && input.onSeeEverywhere) {
    chips.push({ id: "everywhere", label: "See everywhere", onRemove: () => input.onSeeEverywhere?.(false) });
  }
  return chips;
}

function PlaceMenu({
  label,
  placeHref,
  onTown,
  nearMe,
  seeEverywhere,
  onNearMe,
  onSeeEverywhere,
}: {
  label: string;
  placeHref: string;
  onTown: (place: PlacePick) => void;
  nearMe?: boolean;
  seeEverywhere?: boolean;
  onNearMe?: (value: boolean) => void;
  onSeeEverywhere?: (value: boolean) => void;
}) {
  const [note, setNote] = useState("");

  function ask(done: () => void) {
    setNote("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setNote("No problem. Pick your town instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = nearestTown(position.coords.latitude, position.coords.longitude);
        if (!place) {
          setNote("No problem. Pick your town instead.");
          return;
        }
        onTown(place);
        done();
      },
      () => setNote("No problem. Pick your town instead."),
      { enableHighAccuracy: false },
    );
  }

  return (
    <MenuButton
      label={label}
      icon={<MapPin className="size-4 shrink-0" aria-hidden />}
      pressed={label !== "Everywhere" && label !== "Place"}
    >
      {(close) => (
        <>
          <MenuItem
            onClick={() => {
              ask(() => close());
            }}
          >
            Use my location
          </MenuItem>
          {note ? <p className="px-4 py-2 text-sm leading-5">{note}</p> : null}
          {onNearMe ? (
            <MenuItem
              onClick={() => {
                onNearMe(!nearMe);
                close();
              }}
            >
              {nearMe ? "Everywhere" : "Near me"}
            </MenuItem>
          ) : null}
          {onSeeEverywhere ? (
            <MenuItem
              onClick={() => {
                onSeeEverywhere(!seeEverywhere);
                close();
              }}
            >
              {seeEverywhere ? "Stay in my reach" : "See everywhere"}
            </MenuItem>
          ) : null}
          <Link
            href={placeHref}
            className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            onClick={close}
          >
            Pick a place
          </Link>
        </>
      )}
    </MenuButton>
  );
}

function FiltersMenu({
  applied,
  skills,
  onApply,
}: {
  applied: AppliedFilters;
  skills?: Skill[];
  onApply: (next: AppliedFilters) => void;
}) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(applied);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function show() {
    setDraft(applied);
    setOpen(true);
  }

  const body = (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Project or request</legend>
        {(
          [
            ["all", "All"],
            ["project", "Projects"],
            ["request", "Requests"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="kind-filter"
              checked={draft.kind === id}
              onChange={() => setDraft((current) => ({ ...current, kind: id }))}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Readiness</legend>
        {(
          [
            ["any", "Any"],
            ["ready", "Checks are done"],
            ["open", "Checks still open"],
          ] as const
        ).map(([id, label]) => (
          <label key={id} className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="ready-filter"
              checked={draft.readiness === id}
              onChange={() => setDraft((current) => ({ ...current, readiness: id }))}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={draft.confirmed}
          onChange={(event) => setDraft((current) => ({ ...current, confirmed: event.target.checked }))}
        />
        Money already confirmed
      </label>
      {skills && skills.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Your work</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name="skill-filter"
              checked={!draft.skill}
              onChange={() => setDraft((current) => ({ ...current, skill: null }))}
            />
            All
          </label>
          {skills.map((skill) => (
            <label key={skill} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="radio"
                name="skill-filter"
                checked={draft.skill === skill}
                onChange={() => setDraft((current) => ({ ...current, skill }))}
              />
              {skillTitle(skill)}
            </label>
          ))}
        </fieldset>
      ) : null}
      <button
        type="button"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
        onClick={() => {
          onApply(draft);
          setOpen(false);
        }}
      >
        Apply
      </button>
    </div>
  );

  return (
    <div className="relative shrink-0">
      <button type="button" className={chip} aria-expanded={open} onClick={() => (open ? setOpen(false) : show())}>
        Filters
        <ChevronDown className="size-4" aria-hidden />
      </button>
      {open && phone && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-end bg-foreground/40">
              <div
                role="dialog"
                aria-labelledby={titleId}
                className="max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-background p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 id={titleId} className="text-lg font-semibold">
                    Filters
                  </h2>
                  <button
                    type="button"
                    className="inline-flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                    aria-label="Close filters"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-5" aria-hidden />
                  </button>
                </div>
                {body}
              </div>
            </div>,
            document.body,
          )
        : null}
      {open && !phone ? (
        <div className="absolute top-12 right-0 z-30 w-72 rounded-2xl border-2 border-border bg-card p-4 shadow-sm">
          {body}
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  label,
  pressed,
  icon,
  children,
}: {
  label: string;
  pressed?: boolean;
  icon?: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest(`[data-menu="${menuId}"]`)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, menuId]);

  return (
    <div className="relative shrink-0" data-menu={menuId}>
      <button
        type="button"
        className={cn(chip, pressed && "border-foreground")}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {label}
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute top-12 left-0 z-30 max-h-72 w-56 overflow-y-auto rounded-2xl border-2 border-border bg-card py-1 shadow-sm"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
