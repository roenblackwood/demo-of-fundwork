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
import { guideFor, uncheckedNote } from "@/lib/guides";
import { sectionTitle } from "@/components/parts";
import type { CheckId, Readiness, ReadinessState, Sector, SiteStatus } from "@/lib/types";

const STATES: ReadinessState[] = ["have", "working", "not-yet"];

function checkLabel(id: string): string {
  return id in guideLabels ? guideLabels[id as CheckId] : id;
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

export function WhatThisNeeds({
  countryId,
  countryName,
  sector,
  kind,
  site,
  counts,
  open,
  onToggle,
  choices,
  onChoose,
}: {
  countryId: string;
  countryName: string;
  sector: Sector;
  kind: BlueprintKind;
  site: SiteStatus | null;
  counts: Record<string, number>;
  open: boolean;
  onToggle: () => void;
  choices?: Readiness | null;
  onChoose?: (key: string, state: ReadinessState) => void;
}) {
  const guide = guideFor(countryId, sector);
  const items = readinessItems(kind, site);
  const people = peopleCount(counts);
  const summary = needsSummary(kind.checks.length, people, site);
  const saved = choices ? readinessFor(kind, site, choices) : null;
  const keys = [
    ...items.map((item) => item.key),
    ...Object.entries(counts)
      .filter((entry) => isSkill(entry[0]) && entry[1] > 0)
      .map(([skill]) => `team:${skill}`),
    ...kind.phases.map((phase) => `phase:${phase}`),
    site && site !== "not-yet" ? `site:${site}` : "",
  ]
    .filter(Boolean)
    .join("|");
  const seen = useRef("");
  const first = useRef(true);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      seen.current = keys;
      return;
    }
    const previous = new Set(seen.current.split("|").filter(Boolean));
    const added = keys.split("|").filter((key) => key && !previous.has(key));
    seen.current = keys;
    if (added.length === 0) return;
    setFresh(added);
    const timer = window.setTimeout(() => setFresh([]), 1600);
    return () => window.clearTimeout(timer);
  }, [keys]);

  const team = Object.entries(counts).flatMap(([skill, count]) => {
    if (!isSkill(skill) || count < 1) return [];
    return [{ skill, count }];
  });

  return (
    <section className="rounded-2xl border bg-card" aria-label="What this needs">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-lg font-semibold">What this needs</span>
          <span className="mt-1 block text-base text-muted-foreground">{summary}</span>
        </span>
        <span aria-hidden className="text-2xl leading-none text-muted-foreground">
          {open ? "−" : "+"}
        </span>
      </button>
      {!guide ? (
        <p className="px-4 pb-3 text-base leading-relaxed text-muted-foreground">{uncheckedNote(countryName)}</p>
      ) : null}
      {open ? (
        <div className="space-y-4 px-4 pb-4">
          {/* Later: photos of the site. */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">First</h3>
            <ul className="space-y-2">
              {items
                .filter((item) => item.group === "need")
                .map((item) => (
                  <li
                    key={item.key}
                    className={cn("rounded-xl px-2 py-1 text-lg leading-relaxed", fresh.includes(item.key) && "bg-secondary")}
                  >
                    {saved && onChoose ? (
                      <ChoiceRow
                        label={item.label}
                        value={saved[item.key] ?? "not-yet"}
                        onChoose={(state) => onChoose(item.key, state)}
                      />
                    ) : (
                      item.label
                    )}
                  </li>
                ))}
              {site && site !== "not-yet" ? (
                <li className={cn("rounded-xl px-2 py-1 text-lg", fresh.includes(`site:${site}`) && "bg-secondary")}>
                  Site: {siteLabel(site)}
                </li>
              ) : null}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Checks</h3>
            <ul className="space-y-3">
              {kind.checks.map((id) => {
                const agency = guide?.agencies.find((item) => item.checkId === id)?.name ?? "";
                const key = `check:${id}`;
                return (
                  <li key={id} className={cn("rounded-xl px-2 py-1", fresh.includes(key) && "bg-secondary")}>
                    <p className="text-lg font-semibold">{checkLabel(id)}</p>
                    {agency ? <p className="text-base">Ask: {capitalStart(agency)}</p> : null}
                    {saved && onChoose ? (
                      <ChoiceRow
                        label={checkLabel(id)}
                        hideLabel
                        value={saved[key] ?? "not-yet"}
                        onChoose={(state) => onChoose(key, state)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Team</h3>
            <ul className="space-y-1">
              {team.map((row) => (
                <li
                  key={row.skill}
                  className={cn("rounded-xl px-2 py-1 text-lg", fresh.includes(`team:${row.skill}`) && "bg-secondary")}
                >
                  {teamLine(row.skill, row.count)}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Phases</h3>
            <ol className="list-decimal space-y-1 pl-5 text-lg">
              {kind.phases.map((phase) => (
                <li key={phase} className={cn("rounded-lg px-1", fresh.includes(`phase:${phase}`) && "bg-secondary")}>
                  {phase}
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
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
        Reported by {posterName}. Fundwork has not checked these.
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

