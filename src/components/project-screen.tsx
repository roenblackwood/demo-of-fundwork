"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ActionBar,
  FundingPills,
  LearnMore,
  OwnershipSplit,
  StepHeader,
  TrustBadges,
} from "@/components/parts";
import { buttonVariants } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { checkNote, projectNote } from "@/lib/ai";
import { CAPITAL_LINE } from "@/lib/copy";
import { canStillCommit, sectorTitle, skillPhrase } from "@/lib/catalog";
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
      <StepHeader
        backHref={backHref}
        title={project.name}
        hint={`${sectorTitle(project.sector)} · ${place}`}
      />
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
      <p className="border-l-4 border-primary pl-4 text-lg leading-relaxed">{note.body}</p>
      <p className="text-lg leading-relaxed">{CAPITAL_LINE}</p>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What has been checked</h2>
        <p className="text-base">
          {checksDone === project.checks.length
            ? "Every check on this project is finished."
            : `${checksDone} of ${project.checks.length} checks are finished.`}
        </p>
        <TrustBadges checks={project.checks} />
      </section>
      <section className="space-y-3">
        <p className="text-base">
          Goal {money(project.goalJmd, currency)}. Needs{" "}
          {project.needs.map((need) => skillPhrase(need)).join(", ")}.
        </p>
        <p className="text-base">
          {project.workersMatched} of {project.workersNeeded} workers matched.
        </p>
        <p className="text-base leading-relaxed">
          A week of work pays about {money(project.weeklyPayout, currency)} in the stable unit.
        </p>
      </section>
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
      {showInvest && !canCommit ? (
        <p className="text-lg">The money they asked for is already in.</p>
      ) : null}
      <p className="text-lg font-semibold">{ownershipLine}</p>
      <LearnMore title="Who this belongs to">
        <OwnershipSplit />
      </LearnMore>
      {notes.map((item) => (
        <LearnMore key={item.title} title={item.title}>
          <p>{item.body}</p>
        </LearnMore>
      ))}
      <LearnMore title="How ownership is set aside">
        <p>This project has 10,000 ownership units in this demo.</p>
        <p>{PLATFORM_UNITS.toLocaleString("en-US")} are set aside for Fundwork.</p>
        <p>{INVESTOR_UNITS.toLocaleString("en-US")} are set aside for people who fund it.</p>
        <p>{WORKER_UNITS.toLocaleString("en-US")} are set aside for people who do the work.</p>
        <p>
          Your amount is your part of the money goal, out of the{" "}
          {INVESTOR_UNITS.toLocaleString("en-US")} funder units. Accepted work comes out of the{" "}
          {WORKER_UNITS.toLocaleString("en-US")} build units.
        </p>
        <p>This demo keeps the numbers on this phone.</p>
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
