"use client";

import { useEffect, useRef, useState } from "react";
import { guideLabels } from "@/lib/ai";
import {
  READINESS_LABEL,
  kindById,
  needsSummary,
  peopleCount,
  phaseNames,
  readinessFor,
  readinessItems,
  siteLabel,
  teamLine,
  type BlueprintKind,
} from "@/lib/blueprints";
import { isSkill } from "@/lib/catalog";
import { cn } from "cn";
import { capitalStart } from "@/lib/format";
import { guideFor, uncheckedNote, type GuideAgency } from "@/lib/guides";
import { sectionTitle } from "@/components/parts";
import type { CheckId, Readiness, ReadinessState, Sector, SiteStatus } from "@/lib/types";

const STATES: ReadinessState[] = ["have", "working", "not-yet"];

const REVIEW_LABEL: Record<ReadinessState, string> = {
  have: "Have it",
  working: "Working",
  "not-yet": "Not yet",
};

type RowMark = {
  key: string;
  label: string;
  change: "new" | "removed";
};

function checkLabel(id: string): string {
  return id in guideLabels ? guideLabels[id as CheckId] : id;
}

function agenciesFor(agencies: GuideAgency[] | undefined, kindId: string, checkId: CheckId): GuideAgency[] {
  if (!agencies) return [];
  return agencies.filter((agency) => {
    if (agency.checkId !== checkId) return false;
    if (!agency.kindIds || agency.kindIds.length === 0) return true;
    return agency.kindIds.includes(kindId);
  });
}

function ChoiceRow({
  label,
  value,
  onChoose,
  hideLabel = false,
}: {
  label: string;
  value: ReadinessState;
  onChoose?: (state: ReadinessState) => void;
  hideLabel?: boolean;
}) {
  if (!onChoose) {
    return (
      <div className="text-lg leading-relaxed">
        <p className="font-semibold">{label}</p>
        <p className="text-base text-muted-foreground">{READINESS_LABEL[value]}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {hideLabel ? null : <p className="text-lg font-semibold leading-relaxed">{label}</p>}
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {STATES.map((state) => (
          <button
            key={state}
            type="button"
            aria-pressed={value === state}
            onClick={() => onChoose(state)}
            className={cn(
              "min-h-10 rounded-full border px-3 text-sm font-semibold",
              value === state ? "border-primary bg-secondary" : "border-border bg-card",
            )}
          >
            {READINESS_LABEL[state]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Segmented({
  label,
  value,
  onChoose,
}: {
  label: string;
  value: ReadinessState;
  onChoose: (state: ReadinessState) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold leading-relaxed">{label}</p>
      <div className="flex h-[44px] overflow-hidden rounded-xl border border-border" role="group" aria-label={label}>
        {STATES.map((state) => (
          <button
            key={state}
            type="button"
            aria-pressed={value === state}
            onClick={() => onChoose(state)}
            className={cn(
              "h-[44px] min-h-[44px] flex-1 whitespace-nowrap px-1 text-sm font-semibold",
              value === state ? "bg-secondary text-foreground" : "bg-card text-muted-foreground",
            )}
          >
            {REVIEW_LABEL[state]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Mark({ change }: { change?: "new" | "removed" }) {
  if (!change) return null;
  return <span className="text-sm font-semibold text-primary">{change === "new" ? "New" : "Removed"}</span>;
}

export function WhatThisNeeds({
  countryId,
  countryName,
  sector,
  kind,
  site,
  counts,
  open,
  onToggle,
}: {
  countryId: string;
  countryName: string;
  sector: Sector;
  kind: BlueprintKind;
  site: SiteStatus | null;
  counts: Record<string, number>;
  open: boolean;
  onToggle: () => void;
}) {
  const guide = guideFor(countryId, sector);
  const items = readinessItems(kind, site);
  const people = peopleCount(counts);
  const summary = needsSummary(kind.checks.length, people, site);
  const team = Object.entries(counts).flatMap(([skill, count]) => {
    if (!isSkill(skill) || count < 1) return [];
    return [{ skill, count }];
  });
  const rowList = [
    ...items.map((item) => ({
      key: item.key,
      label: item.group === "check" ? checkLabel(item.label) : item.label,
    })),
    ...(site && site !== "not-yet" ? [{ key: `site:${site}`, label: `Site: ${siteLabel(site)}` }] : []),
    ...team.map((row) => ({ key: `team:${row.skill}`, label: teamLine(row.skill, row.count) })),
    ...kind.phases.map((phase) => ({ key: `phase:${phase}`, label: phase })),
  ];
  const signature = JSON.stringify(rowList.map((row) => [row.key, row.label]));
  const seen = useRef<string | null>(null);
  const labelRef = useRef<Map<string, string>>(new Map());
  const [marks, setMarks] = useState<RowMark[]>([]);

  useEffect(() => {
    const rows = JSON.parse(signature) as [string, string][];
    const nextLabels = new Map(rows);
    const keys = rows.map((row) => row[0]).join("|");
    if (seen.current === null) {
      seen.current = keys;
      labelRef.current = nextLabels;
      return;
    }
    const previous = seen.current.split("|").filter(Boolean);
    const previousSet = new Set(previous);
    const nextKeys = keys.split("|").filter(Boolean);
    const nextSet = new Set(nextKeys);
    const added: RowMark[] = nextKeys
      .filter((key) => !previousSet.has(key))
      .map((key) => ({ key, label: nextLabels.get(key) ?? "", change: "new" }));
    const removed: RowMark[] = previous
      .filter((key) => !nextSet.has(key))
      .map((key) => ({ key, label: labelRef.current.get(key) ?? "", change: "removed" }));
    seen.current = keys;
    labelRef.current = nextLabels;
    if (added.length === 0 && removed.length === 0) return;
    setMarks([...added, ...removed]);
    const timer = window.setTimeout(() => setMarks([]), 1600);
    return () => window.clearTimeout(timer);
  }, [signature]);

  function changeFor(key: string): "new" | "removed" | undefined {
    return marks.find((mark) => mark.key === key)?.change;
  }

  function removedFor(prefix: string): RowMark[] {
    return marks.filter(
      (mark) => mark.change === "removed" && mark.key.startsWith(prefix) && !rowList.some((row) => row.key === mark.key),
    );
  }

  return (
    <section aria-label="What this needs">
      <div className="sticky top-14 z-20 -mx-5 border-b border-border bg-background px-5">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span className="sr-only">What this needs</span>
          <span className="truncate text-sm text-muted-foreground">{summary}</span>
          <span aria-hidden className="text-lg leading-none text-muted-foreground">
            {open ? "−" : "+"}
          </span>
        </button>
      </div>
      {!guide ? <p className="pt-3 text-base leading-relaxed text-muted-foreground">{uncheckedNote(countryName)}</p> : null}
      {open ? (
        <div className="space-y-4 pt-4">
          {/* Later: photos of the site. */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">First</h3>
            <ul className="space-y-2">
              {items
                .filter((item) => item.group === "need")
                .map((item) => (
                  <li
                    key={item.key}
                    className={cn(
                      "flex flex-wrap items-baseline gap-2 rounded-xl px-2 py-1 text-lg leading-relaxed",
                      changeFor(item.key) && "bg-secondary",
                    )}
                  >
                    <span>{item.label}</span>
                    <Mark change={changeFor(item.key)} />
                  </li>
                ))}
              {removedFor("need:").map((mark) => (
                <li key={mark.key} className="flex flex-wrap items-baseline gap-2 rounded-xl bg-secondary px-2 py-1 text-lg">
                  <span>{mark.label}</span>
                  <Mark change="removed" />
                </li>
              ))}
              {site && site !== "not-yet" ? (
                <li
                  className={cn(
                    "flex flex-wrap items-baseline gap-2 rounded-xl px-2 py-1 text-lg",
                    changeFor(`site:${site}`) && "bg-secondary",
                  )}
                >
                  <span>Site: {siteLabel(site)}</span>
                  <Mark change={changeFor(`site:${site}`)} />
                </li>
              ) : null}
              {removedFor("site:").map((mark) => (
                <li key={mark.key} className="flex flex-wrap items-baseline gap-2 rounded-xl bg-secondary px-2 py-1 text-lg">
                  <span>{mark.label}</span>
                  <Mark change="removed" />
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Checks</h3>
            <ul className="space-y-3">
              {kind.checks.map((id) => {
                const agencies = agenciesFor(guide?.agencies, kind.id, id);
                const key = `check:${id}`;
                return (
                  <li key={id} className={cn("rounded-xl px-2 py-1", changeFor(key) && "bg-secondary")}>
                    <p className="flex flex-wrap items-baseline gap-2 text-lg font-semibold">
                      <span>{checkLabel(id)}</span>
                      <Mark change={changeFor(key)} />
                    </p>
                    {agencies.map((agency) => (
                      <div key={`${id}:${agency.name}`}>
                        <p className="text-base">Ask: {capitalStart(agency.name)}</p>
                        {agency.does ? <p className="text-base text-muted-foreground">{agency.does}</p> : null}
                      </div>
                    ))}
                  </li>
                );
              })}
              {removedFor("check:").map((mark) => (
                <li key={mark.key} className="flex flex-wrap items-baseline gap-2 rounded-xl bg-secondary px-2 py-1 text-lg">
                  <span>{mark.label}</span>
                  <Mark change="removed" />
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Team</h3>
            <ul className="space-y-1">
              {team.map((row) => (
                <li
                  key={row.skill}
                  className={cn(
                    "flex flex-wrap items-baseline gap-2 rounded-xl px-2 py-1 text-lg",
                    changeFor(`team:${row.skill}`) && "bg-secondary",
                  )}
                >
                  <span>{teamLine(row.skill, row.count)}</span>
                  <Mark change={changeFor(`team:${row.skill}`)} />
                </li>
              ))}
              {removedFor("team:").map((mark) => (
                <li key={mark.key} className="flex flex-wrap items-baseline gap-2 rounded-xl bg-secondary px-2 py-1 text-lg">
                  <span>{mark.label}</span>
                  <Mark change="removed" />
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Phases</h3>
            <ol className="list-decimal space-y-1 pl-5 text-lg">
              {kind.phases.map((phase) => (
                <li
                  key={phase}
                  className={cn("flex flex-wrap items-baseline gap-2 rounded-lg px-1", changeFor(`phase:${phase}`) && "bg-secondary")}
                >
                  <span>{phase}</span>
                  <Mark change={changeFor(`phase:${phase}`)} />
                </li>
              ))}
            </ol>
            {removedFor("phase:").length > 0 ? (
              <ul className="space-y-1">
                {removedFor("phase:").map((mark) => (
                  <li key={mark.key} className="flex flex-wrap items-baseline gap-2 rounded-lg bg-secondary px-1 text-lg">
                    <span>{mark.label}</span>
                    <Mark change="removed" />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function BeforeYouStart({
  kind,
  site,
  readiness,
  onChoose,
}: {
  kind: BlueprintKind;
  site: SiteStatus;
  readiness: Readiness;
  onChoose: (key: string, state: ReadinessState) => void;
}) {
  const items = readinessItems(kind, site);
  const ready = items.filter((item) => readiness[item.key] === "have").length;
  return (
    <section className="space-y-3" aria-label="Before you start">
      <h2 className={sectionTitle}>Before you start</h2>
      <p className="text-lg font-semibold">
        Ready so far: {ready} of {items.length}
      </p>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.key}>
            <Segmented
              label={item.group === "check" ? checkLabel(item.label) : item.label}
              value={readiness[item.key] ?? "not-yet"}
              onChoose={(state) => onChoose(item.key, state)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReadinessReport({
  sector,
  kindId,
  site,
  readiness,
  posterName,
  canEdit,
  saving,
  onChange,
}: {
  sector: Sector;
  kindId?: string | null;
  site?: SiteStatus | null;
  readiness?: Readiness | null;
  posterName: string;
  canEdit: boolean;
  saving?: boolean;
  onChange?: (next: Readiness) => void;
}) {
  const kind = kindById(sector, kindId);
  if (!kind) return null;
  const saved = readinessFor(kind, site ?? null, readiness);
  const items = readinessItems(kind, site ?? null);
  const ready = Object.values(saved).filter((state) => state === "have").length;
  return (
    <section className="space-y-3" aria-label="Ready so far">
      {/* Later: photos of the site. */}
      {/* Later: document uploads for each readiness item. */}
      {/* Later: an organizer can ask a mentor to review this readiness list. */}
      <h2 className={sectionTitle}>
        Ready so far: {ready} of {items.length}
      </h2>
      <p className="text-base leading-relaxed text-muted-foreground">
        {posterName ? `Reported by ${posterName}. ` : ""}Fundwork has not checked these.
      </p>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.key}>
            <ChoiceRow
              label={item.group === "check" ? checkLabel(item.label) : item.label}
              value={saved[item.key] ?? "not-yet"}
              onChoose={
                canEdit && onChange && !saving
                  ? (state) => onChange({ ...saved, [item.key]: state })
                  : undefined
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProjectPhases({ sector, kindId }: { sector: Sector; kindId?: string | null }) {
  const phases = phaseNames(sector, kindId);
  if (phases.length === 0) return null;
  return (
    <section className="space-y-2">
      {/* Phase progress is not stored yet, so the first phase stays current. */}
      <h2 className={sectionTitle}>Phases</h2>
      <ol className="list-decimal space-y-1 pl-5 text-lg">
        {phases.map((phase, index) => (
          <li key={phase}>
            {phase}
            {index === 0 ? <span className="ml-2 text-sm font-semibold text-primary">Current</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
