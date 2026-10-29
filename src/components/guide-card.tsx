"use client";

import { useEffect, useState } from "react";
import { sectionTitle } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { sectorWeekly } from "@/lib/catalog";
import {
  acceptGuideRewrite,
  starterGuide,
  workerGuide,
  type StarterGuide,
  type StarterInput,
  type WorkerGuide,
  type WorkerInput,
} from "@/lib/ai";
import { currencyOf } from "@/lib/seed";
import type { CapitalRequest, Project, Sector } from "@/lib/types";

const ADVICE = "Fundwork does not give legal or investment advice.";
const AI_ON = process.env.NEXT_PUBLIC_FUNDWORK_AI === "on";

function mergeGuide<T extends StarterGuide | WorkerGuide>(template: T, incoming: unknown): T | null {
  if (!incoming || typeof incoming !== "object") return null;
  const row = incoming as Record<string, unknown>;
  if ("checks" in template) {
    const starter = template as StarterGuide;
    if (!Array.isArray(row.checks) || row.checks.length !== starter.checks.length) return null;
    const incomingChecks = row.checks as { why?: unknown }[];
    const candidate: StarterGuide = {
      ...starter,
      summary: typeof row.summary === "string" ? row.summary : starter.summary,
      checks: starter.checks.map((check, index) => {
        const next = incomingChecks[index];
        return { ...check, why: typeof next?.why === "string" ? next.why : check.why };
      }),
    };
    return acceptGuideRewrite(template, candidate);
  }
  const worker = template as WorkerGuide;
  const candidate: WorkerGuide = {
    ...worker,
    summary: typeof row.summary === "string" ? row.summary : worker.summary,
    standOut: Array.isArray(row.standOut) ? (row.standOut as string[]) : worker.standOut,
    draftMessage: typeof row.draftMessage === "string" ? row.draftMessage : worker.draftMessage,
  };
  return acceptGuideRewrite(template, candidate);
}

function useGuideText<T extends StarterGuide | WorkerGuide>(template: T, body: Record<string, string>): T {
  const serial = JSON.stringify(template);
  const bodySerial = JSON.stringify(body);
  const [state, setState] = useState<{ serial: string; guide: T } | null>(null);

  useEffect(() => {
    if (!AI_ON) return;
    const control = new AbortController();
    let gone = false;
    (async () => {
      try {
        const response = await fetch("/api/guide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: bodySerial,
          signal: control.signal,
        });
        if (!response.ok || gone) return;
        const payload = (await response.json()) as { guide?: unknown };
        const next = mergeGuide(JSON.parse(serial) as T, payload.guide);
        if (!gone && next) setState({ serial, guide: next });
      } catch {
        // Keep the template. Posting and sending do not wait on this.
      }
    })();
    return () => {
      gone = true;
      control.abort();
    };
  }, [serial, bodySerial]);

  return state && state.serial === serial ? state.guide : template;
}

function DraftNote({ children }: { children: string }) {
  return (
    <p className="rounded-xl bg-wait px-3 py-2 text-base leading-relaxed text-wait-foreground">{children}</p>
  );
}

function Advice() {
  return <p className="text-sm leading-relaxed text-muted-foreground">{ADVICE}</p>;
}

function StarterBody({ guide }: { guide: StarterGuide }) {
  return (
    <>
      <DraftNote>{guide.draftNote}</DraftNote>
      <p className="text-lg leading-relaxed">{guide.summary}</p>
      <ol className="list-decimal space-y-3 pl-5 text-lg leading-relaxed">
        {guide.checks.map((check) => (
          <li key={`${check.label}-${check.agency}`}>
            <p className="font-semibold">{check.label}</p>
            <p>{check.agency}</p>
            <p>{check.why}</p>
          </li>
        ))}
      </ol>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">First steps</h3>
        <ol className="list-decimal space-y-2 pl-5 text-lg leading-relaxed">
          {guide.firstSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
      {guide.costLine ? <p className="text-lg leading-relaxed">{guide.costLine}</p> : null}
      {guide.sourceNote !== guide.draftNote ? (
        <p className="text-base leading-relaxed text-muted-foreground">{guide.sourceNote}</p>
      ) : null}
      <Advice />
    </>
  );
}

function WorkerBody({ guide }: { guide: WorkerGuide }) {
  return (
    <>
      <DraftNote>{guide.draftNote}</DraftNote>
      <p className="text-lg leading-relaxed">{guide.summary}</p>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Skills</h3>
        <ul className="list-disc space-y-1 pl-5 text-lg leading-relaxed">
          {guide.skills.map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Tools</h3>
        <ul className="list-disc space-y-1 pl-5 text-lg leading-relaxed">
          {guide.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
      </div>
      <p className="text-lg leading-relaxed">{guide.weekLine}</p>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Two tips</h3>
        <ul className="list-disc space-y-1 pl-5 text-lg leading-relaxed">
          {guide.standOut.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
      <Advice />
    </>
  );
}

const summaryClass =
  "flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-lg font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

function starterBody(input: StarterInput): Record<string, string> {
  return {
    kind: "starter",
    countryId: input.countryId,
    sector: input.sector,
    placeName: input.placeName,
  };
}

export function WhatItTakes({
  countryId,
  countryName,
  sector,
  placeName,
  projects,
}: {
  countryId: string;
  countryName: string;
  sector: Sector;
  placeName: string;
  projects: Project[];
}) {
  const input = { countryId, countryName, sector, placeName, projects };
  const guide = useGuideText(starterGuide(input), starterBody(input));
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10" aria-label="What it takes">
      <h2 className={sectionTitle}>What it takes</h2>
      <StarterBody guide={guide} />
    </section>
  );
}

export function YourPlan({
  countryId,
  countryName,
  sector,
  placeName,
  projects,
}: {
  countryId: string;
  countryName: string;
  sector: Sector;
  placeName: string;
  projects: Project[];
}) {
  const input = { countryId, countryName, sector, placeName, projects };
  const guide = useGuideText(starterGuide(input), starterBody(input));
  return (
    <details className="rounded-2xl border bg-card">
      <summary className={summaryClass}>
        Your plan
        <span aria-hidden className="text-2xl leading-none text-muted-foreground">
          +
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <StarterBody guide={guide} />
      </div>
    </details>
  );
}

export function BeforeYouApply({
  requestId,
  projectId,
  ...rest
}: Omit<WorkerInput, "forProject"> & { requestId?: string; projectId?: string }) {
  const input: WorkerInput = { ...rest, forProject: Boolean(projectId) };
  const body: Record<string, string> = projectId
    ? { kind: "worker", projectId }
    : { kind: "worker", requestId: requestId ?? "" };
  const guide = useGuideText(workerGuide(input), body);
  return (
    <details className="rounded-2xl border bg-card">
      <summary className={summaryClass}>
        {guide.title}
        <span aria-hidden className="text-2xl leading-none text-muted-foreground">
          +
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <WorkerBody guide={guide} />
      </div>
    </details>
  );
}

export function UseDraftButton({
  request,
  placeName,
  countryName,
  onUse,
}: {
  request: CapitalRequest;
  placeName: string;
  countryName: string;
  onUse: (message: string) => void;
}) {
  const template = workerGuide({
    countryId: request.countryId,
    countryName,
    sector: request.sector,
    placeName,
    skills: request.skills,
    weekly: sectorWeekly(request.sector),
    currency: currencyOf(request.countryId),
    forProject: false,
  });
  const guide = useGuideText(template, { kind: "worker", requestId: request.id });
  return (
    <Button type="button" variant="outline" className="w-full" onClick={() => onUse(guide.draftMessage)}>
      Use a draft
    </Button>
  );
}
