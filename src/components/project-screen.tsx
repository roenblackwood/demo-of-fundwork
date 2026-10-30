"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  ActionBar,
  ApplicationStatusLabel,
  Avatar,
  CapitalChip,
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
import { ProjectPhases, ReadinessReport } from "@/components/needs-panel";
import { PhasePlan } from "@/components/phase-plan";
import { LessonList } from "@/components/lesson-card";
import { ThisWeekCard } from "@/components/this-week";
import { checkNote, projectNote } from "@/lib/ai";
import { canStillCommit } from "@/lib/catalog";
import { SendCapital } from "@/components/send-capital";
import { NEVER_HOLDS_LINE, TEST_NETWORK_LINE, UNITS_PAYOUT_LINE } from "@/lib/copy";
import { ThisPlace } from "@/components/place-fit";
import { RulesChip, RulesHere } from "@/components/rules-panel";
import { isLive } from "@/lib/mode";
import { stageLessons, workerProjectLessons } from "@/lib/lessons";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, money, moneyShort, placeLine } from "@/lib/format";
import { aboutUsd } from "@/lib/rates";
import {
  INVESTOR_UNITS,
  PLATFORM_UNITS,
  WORKER_UNITS,
  capitalReserved,
  fundingLabels,
  moneyStillOpen,
  projectCommitted,
} from "@/lib/ownership";
import { convertedBacking } from "@/lib/pledges";
import { currencyOf, getCountry, projectPlace, seedCommitments } from "@/lib/seed";
import type { Skill } from "@/lib/types";

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
  const reserved = Math.max(
    capitalReserved(project.committedJmd, demo.addedCommitments, project.id),
    convertedBacking(project.id, demo.requests, demo.pledges),
  );
  const stillOpen = moneyStillOpen(project.goalJmd, reserved);
  const percent = project.goalJmd <= 0 ? 0 : Math.min(100, (reserved / project.goalJmd) * 100);
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
  const organizerShown =
    (project.organizerId ? demo.displayNameFor(project.organizerId) : "") || project.organizerName;
  const organizerFirst = organizerShown.trim() ? firstName(organizerShown) : "";
  const hasProjectWallet = demo.projectWallets.some((item) => item.projectId === project.id);
  const myPledge = demo.commitments.find((item) => item.projectId === project.id && item.status === "pledged");
  const ownershipLine =
    demo.role === "worker"
      ? "Your work turns into ownership units."
      : demo.role === "investor"
        ? hasProjectWallet
          ? "Money you commit turns into ownership units once a confirmed payment covers it."
          : "Money you commit turns into ownership units once the organizer accepts it."
        : "Money and work both turn into ownership units.";

  const backerRows = [...seedCommitments(), ...demo.addedCommitments].filter(
    (item) => item.projectId === project.id,
  );
  const backers = new Set(backerRows.map((item) => item.userId)).size;
  const backerNames = [
    ...new Set(
      backerRows.flatMap((item) => {
        if (item.showName === false) return [];
        const name = demo.displayNameFor(item.userId);
        return name ? [name] : [];
      }),
    ),
  ];
  const projectActions = (
    <>
      {canCommit ? (
        <Link href={`/projects/${project.id}/commit`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Commit capital
        </Link>
      ) : null}
      {showWork ? (
        <Link
          href={`/projects/${project.id}/log`}
          className={cn(buttonVariants({ variant: canCommit ? "workOutline" : "work", size: "lg" }), "w-full")}
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
    </>
  );

  return (
    <div className="min-[840px]:grid min-[840px]:grid-cols-[minmax(0,1fr)_20rem] min-[840px]:items-start min-[840px]:gap-8">
    <div className="min-w-0 space-y-6">
      <StepHeader backHref={backHref} />
      <SectorTile sector={project.sector} size="page" />
      <div>
        <h1 className="font-display text-3xl leading-tight">{project.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-lg text-muted-foreground">{place}</p>
          <RulesChip countryId={project.countryId} />
        </div>
      </div>
      <RulesHere countryId={project.countryId} />
      <ThisPlace countryId={project.countryId} parishId={project.parishId} />
      <section className="space-y-3">
        <div>
          <p className="text-2xl font-semibold leading-tight">
            {stillOpen > 0 ? `${money(stillOpen, currency)} still needed` : "The money they asked for is in"}
          </p>
          {stillOpen > 0 && aboutUsd(stillOpen, currency) ? (
            <p className="text-base text-muted-foreground">{aboutUsd(stillOpen, currency)}</p>
          ) : null}
        </div>
        <Progress value={percent} aria-label="Money committed">
          <ProgressLabel className="whitespace-nowrap text-sm">
            {moneyShort(reserved, currency)} of {moneyShort(project.goalJmd, currency)}
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
        {backers > 0 ? (
          <p className="text-base font-semibold">
            Backed by {backers} {backers === 1 ? "investor" : "investors"}
          </p>
        ) : null}
        {backerNames.length > 0 ? <p className="text-base">{backerNames.join(", ")}</p> : null}
        <Link href={`/projects/${project.id}/money`} className="inline-flex min-h-11 items-center font-semibold text-primary">
          See the money
        </Link>
        {organizing && hasProjectWallet ? (
          <p className="text-lg">You do not accept capital by hand. The chain check does.</p>
        ) : null}
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
      <ProjectPhases
        sector={project.sector}
        kindId={project.kind}
        phases={project.phases}
        openPhase={project.openPhase}
        phaseNote={project.phaseNote}
      />
      {organizing ? <PhasePlan projectId={project.id} /> : null}
      <ReadinessReport
        sector={project.sector}
        kindId={project.kind}
        site={project.site}
        readiness={project.readiness}
        posterName={organizerShown.trim() ? firstName(organizerShown) : ""}
        canEdit={organizing}
        saving={demo.saving}
        onChange={(next) => {
          if (demo.saving) return;
          void demo.setReadiness({ projectId: project.id, readiness: next }).then((ok) => {
            if (ok) show("Ready list saved.");
          });
        }}
      />
      <section className="space-y-2">
        <h2 className={sectionTitle}>What you get</h2>
        <p className="text-lg leading-relaxed">
          {showInvest ? `${project.whatYouGet} ` : null}
          {showWork ? "Accepted work here turns into ownership units. " : null}
          {ownershipLine}
        </p>
        <p className="text-lg leading-relaxed">{UNITS_PAYOUT_LINE}</p>
      </section>
      <div className="flex items-start gap-3">
        <Avatar name={organizerShown} />
        <div className="min-w-0">
          <p className="font-semibold">{organizerShown}</p>
          <p className="text-sm text-muted-foreground">Organizer</p>
          {project.mentorName ? (
            <>
              {/* Experienced organizers mentor new ones, matched by sector and parish. Messaging is not built. */}
              <p className="mt-2 font-semibold">Your mentor: {project.mentorName}</p>
              <p className="text-sm text-muted-foreground">Talk to them before big choices.</p>
            </>
          ) : null}
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
        <>
          <LessonList lessons={stageLessons(project.sector, project.workStarted)} />
          <ThisWeekCard project={project} />
        </>
      ) : null}
      {showWork ? (
        <LessonList
          lessons={workerProjectLessons(workerSkills(demo.homeSkill, demo.homeExtraSkills, project.needs))}
        />
      ) : null}
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
              const named = demo.displayNameFor(application.workerId);
              const person = named || "A worker";
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
                            if (ok) show(`${named ? firstName(named) : "A worker"} is on the team.`);
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
      {myPledge ? <SendCapital projectId={project.id} pledge={myPledge.amountJmd} /> : null}
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
          {isLive() ? (
            <>
              <p>{NEVER_HOLDS_LINE}</p>
              <p>{TEST_NETWORK_LINE}</p>
            </>
          ) : (
            <p>No Bitcoin moves in this demo.</p>
          )}
          <p>{UNITS_PAYOUT_LINE}</p>
        </div>
        {notes.map((item) => (
          <div key={item.title} className="space-y-3">
            <h3 className="font-semibold">{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </LearnMore>
      {canCommit || showWork || (askJoin && !join) ? <ActionBar hideExpanded>{projectActions}</ActionBar> : null}
    </div>
    <aside className="sticky top-20 hidden space-y-3 self-start rounded-2xl bg-card p-4 ring-1 ring-foreground/10 min-[840px]:block">
      <p className="text-2xl font-semibold leading-tight">
        {stillOpen > 0 ? `${money(stillOpen, currency)} still needed` : "The money they asked for is in"}
      </p>
      <Progress value={percent} aria-label="Money committed">
        <ProgressLabel className="text-sm">
          {moneyShort(reserved, currency)} of {moneyShort(project.goalJmd, currency)}
        </ProgressLabel>
      </Progress>
      {stillOpen > 0 && aboutUsd(stillOpen, currency) ? (
        <p className="text-base text-muted-foreground">{aboutUsd(stillOpen, currency)}</p>
      ) : null}
      {backers > 0 ? (
        <p className="text-base font-semibold">
          Backed by {backers} {backers === 1 ? "investor" : "investors"}
        </p>
      ) : null}
      {backerNames.length > 0 ? <p className="text-base">{backerNames.join(", ")}</p> : null}
      {projectActions}
      <CapitalChip />
    </aside>
    </div>
  );
}

function workerSkills(home: Skill | null, extra: Skill[], needs: Skill[]): Skill[] {
  const mine = [home, ...extra].filter((item): item is Skill => Boolean(item));
  const fitting = mine.filter((skill) => needs.includes(skill));
  return fitting.length > 0 ? fitting : mine;
}
