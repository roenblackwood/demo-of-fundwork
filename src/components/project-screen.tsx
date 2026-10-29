"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ActionBar,
  ApplicationStatusLabel,
  Avatar,
  FundingPills,
  LearnMore,
  MoneyText,
  OwnershipSplit,
  SectorTile,
  sectionTitle,
  StepHeader,
  TrustBadges,
} from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { BeforeYouApply, YourPlan } from "@/components/guide-card";
import { checkNote, projectNote } from "@/lib/ai";
import { canStillCommit } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, money, moneyShort, placeLine } from "@/lib/format";
import {
  INVESTOR_UNITS,
  PLATFORM_UNITS,
  WORKER_UNITS,
  fundingLabels,
  moneyStillOpen,
  projectCommitted,
} from "@/lib/ownership";
import { currencyOf, getCountry, getUser, projectPlace, seedCommitments } from "@/lib/seed";

export function ProjectScreen({ id }: { id: string }) {
  const demo = useDemo();
  const show = useSnackbar();
  const project = demo.projects.find((item) => item.id === id);

  useEffect(() => {
    if (demo.ready && project) demo.markOpened();
  }, [demo, project]);

  if (!demo.ready) return null;
  if (!project) {
    return (
      <div className="space-y-4">
        <StepHeader backHref={demo.role === "worker" ? "/work" : "/invest"} />
        <p className="text-lg">This project is not on this phone.</p>
      </div>
    );
  }
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
  const onTeam = project.team.includes(demo.userId);
  const showInvest = demo.role !== "worker";
  const showWork = demo.role === "worker" && onTeam;
  const organizerHere = project.organizerId !== null;
  const askJoin = demo.role === "worker" && !onTeam && organizerHere;
  const organizerMissing = demo.role === "worker" && !onTeam && !organizerHere;
  const join = demo.applications.find(
    (item) => item.projectId === project.id && item.workerId === demo.userId && item.status !== "declined",
  );
  const canCommit = showInvest && canStillCommit(stillOpen, project.goalJmd, currency);
  const backHref = demo.role === "worker" ? "/work" : "/invest";
  const joins = demo.applications.filter(
    (item) => item.projectId === project.id && item.origin === "applied",
  );
  const organizing = project.organizerId === demo.userId;
  const organizerPledged = [...seedCommitments(), ...demo.addedCommitments]
    .filter(
      (item) =>
        project.organizerId !== null &&
        item.projectId === project.id &&
        item.userId === project.organizerId &&
        item.status === "pledged",
    )
    .reduce((sum, item) => sum + item.amountJmd, 0);
  const organizerUser = project.organizerId ? getUser(project.organizerId) : undefined;
  const organizerFirst = firstName(organizerUser?.name ?? project.organizerName);
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
        <p className="mt-1 text-lg text-muted-foreground">{place}</p>
      </div>
      <section className="space-y-3">
        <p className="min-w-0 text-2xl font-semibold leading-snug">
          {stillOpen > 0 ? (
            <MoneyText amount={stillOpen} currency={currency} short suffix="still needed" />
          ) : (
            "The money they asked for is in"
          )}
        </p>
        <Progress value={percent} aria-label="Money committed">
          <ProgressLabel className="text-base">
            {moneyShort(committed, currency)} of{" "}
            <MoneyText amount={project.goalJmd} currency={currency} short />
          </ProgressLabel>
        </Progress>
        {organizerPledged > 0 ? (
          <p className="text-lg">
            <MoneyText amount={organizerPledged} currency={currency} /> pledged by {organizerFirst}. Waiting on a capital check.
          </p>
        ) : null}
        <FundingPills
          labels={fundingLabels(committed, project.goalJmd, project.workStarted)}
        />
      </section>
      <div className="grid grid-cols-3 items-stretch gap-2">
        <div className="flex h-full flex-col rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <p className="text-sm whitespace-nowrap text-muted-foreground">Workers</p>
          <p className="mt-1 text-base font-semibold whitespace-nowrap">
            {project.workersMatched} of {project.workersNeeded}
          </p>
        </div>
        <div className="flex h-full flex-col rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <p className="text-sm whitespace-nowrap text-muted-foreground">Pay a week</p>
          <p className="mt-1 text-sm font-semibold whitespace-nowrap">{money(project.weeklyPayout, currency)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Stable unit</p>
        </div>
        <div className="flex h-full flex-col rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
          <p className="text-sm whitespace-nowrap text-muted-foreground">Checks</p>
          <p className="mt-1 text-base font-semibold whitespace-nowrap">
            {checksDone} of {project.checks.length}
          </p>
        </div>
      </div>
      <TrustBadges checks={project.checks} />
      <p className="border-l-4 border-primary pl-4 text-lg leading-relaxed">{note.body}</p>
      <section className="space-y-2">
        <h2 className={sectionTitle}>What you get</h2>
        <p className="text-lg leading-relaxed">
          {showInvest ? `${project.whatYouGet} ` : null}
          {showWork ? "Accepted work here turns into ownership units. " : null}
          {ownershipLine}
        </p>
      </section>
      <div className="flex items-center gap-3">
        <Avatar name={project.organizerName} />
        <div className="min-w-0">
          <p className="font-semibold">{project.organizerName}</p>
          <p className="text-sm text-muted-foreground">Organizer</p>
        </div>
        {project.checks.some((check) => check.id === "organizer" && check.state === "yes") ? (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-trust px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-trust-foreground">
            <Check className="size-3" aria-hidden />
            Checked
          </span>
        ) : null}
      </div>
      {organizerMissing ? <p className="text-lg">This organizer is not on Fundwork yet.</p> : null}
      {organizing ? (
        <YourPlan
          countryId={project.countryId}
          countryName={getCountry(project.countryId)?.name ?? "this country"}
          sector={project.sector}
          placeName={where?.town ?? "this place"}
          projects={demo.projects}
        />
      ) : null}
      {demo.role === "worker" && !onTeam && !organizing ? (
        <BeforeYouApply
          projectId={project.id}
          countryId={project.countryId}
          countryName={getCountry(project.countryId)?.name ?? "this country"}
          sector={project.sector}
          placeName={where?.town ?? "this place"}
          skills={project.needs}
          weekly={project.weeklyPayout}
          currency={currency}
        />
      ) : null}
      {askJoin && join ? (
        <ApplicationStatusLabel origin={join.origin} status={join.status} viewer="worker" />
      ) : null}
      {organizing ? (
        <section className="space-y-4">
          <h2 className={sectionTitle}>People asking to join</h2>
          {joins.length === 0 ? (
            <p className="text-lg">No one has asked to join yet.</p>
          ) : (
            joins.map((application) => {
              const person = application.workerId === demo.userId ? demo.name : getUser(application.workerId)?.name ?? "A worker";
              const waiting = application.status === "waiting";
              return (
                <article key={application.id} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                  <p className="text-lg font-semibold">{person}</p>
                  <ApplicationStatusLabel origin={application.origin} status={application.status} viewer="investor" />
                  {waiting ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        disabled={demo.saving}
                        aria-busy={demo.saving}
                        onClick={() => {
                          if (demo.saving) return;
                          void demo.setApplicationStatus(application.id, "accepted").then((ok) => {
                            if (ok) show(`${firstName(person)} is on the team.`);
                          });
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        disabled={demo.saving}
                        aria-busy={demo.saving}
                        onClick={() => {
                          if (demo.saving) return;
                          void demo.setApplicationStatus(application.id, "declined").then((ok) => {
                            if (ok) show("Declined.");
                          });
                        }}
                      >
                        Not this time
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      ) : null}
      {showInvest && !canCommit && stillOpen > 0 ? (
        <p className="text-lg">Almost there. What is left is less than the smallest amount.</p>
      ) : null}
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
          <p>Dollar amounts are rough and fixed in this demo.</p>
          <p>No Bitcoin moves in this demo.</p>
        </div>
        {notes.map((item) => (
          <div key={item.title} className="space-y-3">
            <h3 className="font-semibold">{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </LearnMore>
      {canCommit || showWork || (askJoin && !join) ? (
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
          {askJoin && !join ? (
            <Button
              variant="work"
              size="lg"
              className="w-full"
              disabled={demo.saving}
              aria-busy={demo.saving}
              onClick={() => {
                if (demo.saving) return;
                void demo.askToJoin(project.id).then((ok) => {
                  if (ok) show("Asked to join.");
                });
              }}
            >
              Ask to join
            </Button>
          ) : null}
        </ActionBar>
      ) : null}
    </div>
  );
}
