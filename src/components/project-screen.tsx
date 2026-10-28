"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ActionBar,
  FundingPills,
  LearnMore,
  OwnershipSplit,
  SectorTile,
  StepHeader,
  TrustBadges,
} from "@/components/parts";
import { buttonVariants } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { checkNote, projectNote } from "@/lib/ai";
import { canStillCommit, sectorTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { money, moneyShort, placeLine } from "@/lib/format";
import {
  INVESTOR_UNITS,
  PLATFORM_UNITS,
  WORKER_UNITS,
  fundingLabels,
  moneyStillOpen,
  projectCommitted,
} from "@/lib/ownership";
import { currencyOf, getProject, projectPlace } from "@/lib/seed";

export function ProjectScreen({ id }: { id: string }) {
  const demo = useDemo();
  const project = getProject(id);

  useEffect(() => {
    if (demo.ready && project) demo.markOpened();
  }, [demo, project]);

  if (!project) return null;
  const where = projectPlace(project);
  const place = where ? placeLine(where.town, where.parish) : "Jamaica";
  const currency = currencyOf(project.countryId);
  const committed = projectCommitted(
    project.committedJmd,
    demo.addedCommitments,
    project.id,
  );
  const stillOpen = moneyStillOpen(project.goalJmd, committed);
  const percent = project.goalJmd <= 0 ? 0 : Math.min(100, (committed / project.goalJmd) * 100);
  const note = projectNote(project);
  const notes = project.checks
    .map((check) => checkNote(check.id, check.state))
    .filter((item) => item !== null);
  const checksDone = project.checks.filter((check) => check.state === "yes").length;
  const showInvest = demo.role !== "worker";
  const showWork = demo.role !== "investor";
  const canCommit = showInvest && canStillCommit(stillOpen, project.goalJmd, currency);
  const backHref =
    demo.role === "worker" && (demo.flow?.skill || demo.homeSkill)
      ? "/work/matches"
      : `/invest/${demo.flow?.parishId || demo.flow?.countryId || project.parishId || project.countryId}/${demo.flow?.townId || project.townId}/${demo.flow?.sector || project.sector}`;
  const ownershipLine =
    demo.role === "worker"
      ? "Your work turns into ownership units."
      : demo.role === "investor"
        ? "Money you commit turns into ownership units once the organizer accepts it."
        : "Money and work both turn into ownership units.";

  return (
    <div className="space-y-6">
      <StepHeader backHref={backHref} />
      <SectorTile sector={project.sector} size="page" />
      <div>
        <h1 className="font-display text-3xl leading-tight">{project.name}</h1>
        <p className="mt-2 text-lg font-semibold text-primary">{sectorTitle(project.sector)}</p>
        <p className="mt-1 text-lg text-muted-foreground">{place}</p>
      </div>
      <section className="space-y-3">
        <h2 className="text-3xl font-semibold leading-tight">
          {stillOpen > 0
            ? `${moneyShort(stillOpen, currency)} still needed`
            : "The money they asked for is in"}
        </h2>
        <Progress value={percent} aria-label="Money committed">
          <ProgressLabel className="text-base">
            {moneyShort(committed, currency)} of {moneyShort(project.goalJmd, currency)}
          </ProgressLabel>
        </Progress>
        <FundingPills
          labels={fundingLabels(committed, project.goalJmd, project.workStarted)}
        />
      </section>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <p className="text-sm leading-snug text-muted-foreground">Workers</p>
          <p className="mt-1 text-base font-semibold leading-snug">
            {project.workersMatched} of {project.workersNeeded}
          </p>
        </div>
        <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <p className="text-sm leading-snug text-muted-foreground">Weekly pay</p>
          <p className="mt-1 text-base font-semibold leading-snug">
            {money(project.weeklyPayout, currency)}
          </p>
          <p className="text-sm leading-snug text-muted-foreground">Stable unit</p>
        </div>
        <div className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <p className="text-sm leading-snug text-muted-foreground">Checks</p>
          <p className="mt-1 text-base font-semibold leading-snug">
            {checksDone} of {project.checks.length}
          </p>
        </div>
      </div>
      <TrustBadges checks={project.checks} />
      <p className="border-l-4 border-primary pl-4 text-lg leading-relaxed">{note.body}</p>
      <section>
        <h2 className="text-xl font-semibold">What you get</h2>
        {showInvest ? (
          <p className="mt-2 text-lg leading-relaxed">{project.whatYouGet}</p>
        ) : null}
        {showWork ? (
          <p className="mt-2 text-lg leading-relaxed">
            Accepted work here turns into ownership units.
          </p>
        ) : null}
      </section>
      <p className="text-base">
        Organizer: <span className="font-semibold">{project.organizerName}</span>
      </p>
      {showInvest && !canCommit && stillOpen > 0 ? (
        <p className="text-lg">Almost there. What is left is less than the smallest amount.</p>
      ) : null}
      <p className="text-lg font-semibold">{ownershipLine}</p>
      <LearnMore title="How it works">
        <div className="space-y-3">
          <h3 className="font-semibold">Who this belongs to</h3>
          <OwnershipSplit />
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">How ownership is set aside</h3>
          <p>This project has 10,000 ownership units in this demo.</p>
          <p>{PLATFORM_UNITS.toLocaleString("en-US")} are set aside for Fundwork.</p>
          <p>{INVESTOR_UNITS.toLocaleString("en-US")} are set aside for people who fund it.</p>
          <p>{WORKER_UNITS.toLocaleString("en-US")} are set aside for people who do the work.</p>
          <p>
            Your amount is your part of the money goal, out of the{" "}
            {INVESTOR_UNITS.toLocaleString("en-US")} funder units. Accepted work comes out of the{" "}
            {WORKER_UNITS.toLocaleString("en-US")} build units.
          </p>
        </div>
        <div className="space-y-3">
          <h3 className="font-semibold">How the money works</h3>
          <p>Bitcoin is the capital for the project.</p>
          <p>People who do the work are paid in a stable unit.</p>
          <p>No Bitcoin moves in this demo.</p>
        </div>
        {notes.map((item) => (
          <div key={item.title} className="space-y-3">
            <h3 className="font-semibold">{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </LearnMore>
      {canCommit || showWork ? (
        <ActionBar>
          {canCommit ? (
            <Link
              href={`/projects/${project.id}/commit`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              Commit capital
            </Link>
          ) : null}
          {showWork ? (
            <Link
              href={`/projects/${project.id}/log`}
              className={cn(
                buttonVariants({ variant: canCommit ? "workOutline" : "work", size: "lg" }),
                "w-full",
              )}
            >
              Log work
            </Link>
          ) : null}
        </ActionBar>
      ) : null}
    </div>
  );
}
