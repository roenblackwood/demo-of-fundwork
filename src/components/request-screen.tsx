"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import {
  ActionBar,
  ApplicationStatusLabel,
  Avatar,
  CapitalChip,
  SectorTile,
  sectionTitle,
  StepHeader,
} from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { BeforeYouApply, WhatItTakes } from "@/components/guide-card";
import { ProjectPhases, ReadinessReport } from "@/components/needs-panel";
import { PageHero, PhotoAdder, usePhotos } from "@/components/photo-box";
import { ThisPlace } from "@/components/place-fit";
import { BackersRow, CapitalBar, TeamBar } from "@/components/pledge-bars";
import { kindById } from "@/lib/blueprints";
import { sectorTitle, sectorWeekly, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, nameWithInitial, placeLine, postedDate } from "@/lib/format";
import { matchWorkers } from "@/lib/match";
import { acceptedCount } from "@/lib/requests";
import { activePledges, backerMarks, pledgedAmount } from "@/lib/pledges";
import { currencyOf, getCountry, requestPlace } from "@/lib/seed";
import { gatePath } from "@/lib/start-gate";
import { RulesHere } from "@/components/rules-panel";
import type { Application } from "@/lib/types";

export function RequestScreen({ id }: { id: string }) {
  const demo = useDemo();
  const show = useSnackbar();
  const photos = usePhotos("request", id);
  const request = demo.requests.find((item) => item.id === id);

  if (!demo.ready) return <PageBusy />;
  if (!request) {
    return (
      <div className="space-y-4">
        <StepHeader backHref={demo.role === "worker" ? "/work" : "/invest"} />
        <p className="text-lg">This request is not on this phone.</p>
      </div>
    );
  }

  const where = requestPlace(request);
  const currency = currencyOf(request.countryId);
  const related = demo.applications.filter((item) => item.requestId === request.id);
  const accepted = acceptedCount(related, request.id);
  const isOwner = demo.userId === request.userId;
  const isWorker = demo.role === "worker" && !isOwner;
  const backHref = isOwner ? "/you" : isWorker ? "/work" : "/invest";
  const active = related.find((item) => item.workerId === demo.userId && item.status !== "declined");
  const declined = related.find((item) => item.workerId === demo.userId && item.status === "declined");
  const nearby = isOwner ? matchWorkers(request, demo.availability) : [];
  const postedBy = demo.displayNameFor(request.userId);
  const pledged = pledgedAmount(demo.pledges, request.id);
  const investors = activePledges(demo.pledges, request.id).length;
  const left = Math.max(0, request.budget - pledged);
  const mine = demo.pledges.find(
    (item) => item.requestId === request.id && item.userId === demo.userId && item.status === "pledged",
  );
  const openPledge = (request.status === "open" || request.status === "team-ready") && !request.projectId;
  const canJoin = demo.role === "investor" && openPledge && left >= 1 && !mine;
  const leadBlocked = Boolean(mine && mine.userId === request.userId && investors > 1);
  const canWithdraw = Boolean(mine && !request.projectId && !leadBlocked);
  const canClose = isOwner && openPledge && leadBlocked;
  const marks = backerMarks(request, demo.pledges, demo.displayNameFor);

  const requestActions = (
    <>
      {isOwner && request.status === "team-ready" && !request.projectId ? (
        <Link href={gatePath(`/requests/${request.id}/start`, demo.profileSet)} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Start the project
        </Link>
      ) : null}
      {canJoin ? (
        <Link href={gatePath(`/requests/${request.id}/join`, demo.profileSet)} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Join this request
        </Link>
      ) : null}
      {canWithdraw && mine ? (
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          disabled={demo.saving}
          aria-busy={demo.saving}
          onClick={() => {
            if (demo.saving) return;
            void demo.withdrawRequestPledge(mine.id).then((result) => {
              if (result === "ok") show("Pledge withdrawn.");
              else if (result === "lead") show("Close this request instead.");
            });
          }}
        >
          Withdraw your pledge
        </Button>
      ) : null}
      {canClose ? (
        <div className="space-y-2">
          <p className="text-base">You cannot withdraw while others are pledged. Close this request instead.</p>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={demo.saving}
            aria-busy={demo.saving}
            onClick={() => {
              if (demo.saving) return;
              void demo.closeRequest(request.id).then((ok) => {
                if (ok) show("Request closed.");
              });
            }}
          >
            Close this request
          </Button>
        </div>
      ) : null}
      {isWorker && !active && request.status === "open" ? (
        <Link
          href={gatePath(`/requests/${request.id}/apply`, demo.profileSet)}
          className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
        >
          Apply
        </Link>
      ) : null}
      {demo.role === null && request.status === "open" ? (
        <Link
          href={gatePath(`/requests/${request.id}/apply`, demo.profileSet)}
          className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
        >
          I can do this work
        </Link>
      ) : null}
      {demo.role === null ? (
        <Link
          href={gatePath(
            `/invest/start/${request.parishId ?? request.countryId}/${request.townId}?sector=${request.sector}`,
            demo.profileSet,
          )}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
        >
          Start one like this
        </Link>
      ) : null}
    </>
  );
  const hasRequestActions =
    (isOwner && request.status === "team-ready" && !request.projectId) ||
    canJoin ||
    canWithdraw ||
    canClose ||
    (isWorker && !active && request.status === "open") ||
    demo.role === null;

  return (
    <div className="min-[840px]:grid min-[840px]:grid-cols-[minmax(0,1fr)_20rem] min-[840px]:items-start min-[840px]:gap-8">
    <div className="min-w-0 space-y-6">
      <StepHeader backHref={backHref} />
      <PageHero
        photo={photos[0] ?? null}
        sectorTile={<SectorTile sector={request.sector} size="page" />}
      />
      <div>
        <h1 className="font-display text-3xl leading-tight">
          {where ? `${sectorTitle(request.sector)} in ${where.town}` : sectorTitle(request.sector)}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">{where ? placeLine(where.town, where.parish) : "This place"}</p>
        {kindById(request.sector, request.kind)?.title ? (
          <p className="text-base">{kindById(request.sector, request.kind)?.title}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={postedBy} />
          <div>
            {postedBy ? (
              <p className="font-semibold">Posted by {nameWithInitial(postedBy)}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">{postedDate(request.createdAt)}</p>
          </div>
        </div>
      </div>
      {request.note ? <p className="text-base leading-relaxed">{request.note}</p> : null}
      <div className="space-y-3">
        <CapitalBar pledged={pledged} budget={request.budget} investors={investors} currency={currency} />
        <TeamBar accepted={accepted} needed={request.workersNeeded} />
        <BackersRow people={marks} />
      </div>
      <div className="space-y-2">
        <p className="text-lg font-semibold">
          {accepted} of {request.workersNeeded} workers
        </p>
        <div className="flex flex-wrap gap-1.5" aria-hidden>
          {Array.from({ length: request.workersNeeded }, (_, index) => (
            <span
              key={index}
              className={cn(
                "grid size-[24px] place-items-center rounded-full",
                index < accepted ? "bg-work text-work-foreground" : "border-2 border-border",
              )}
            >
              {index < accepted ? <Check className="size-[14px]" strokeWidth={2.5} /> : null}
            </span>
          ))}
        </div>
      </div>
      {request.status === "team-ready" ? <p className="text-lg">The team is ready.</p> : null}
      {request.projectId ? (
        <div className="space-y-2">
          <p className="text-lg">This is now a project.</p>
          <Link href={`/projects/${request.projectId}`} className="inline-flex min-h-11 items-center font-semibold text-primary">
            See the project
          </Link>
        </div>
      ) : request.status === "closed" ? (
        <p className="text-lg">This request is closed.</p>
      ) : null}

      {isWorker && active ? (
        <div className="space-y-4">
          <ApplicationStatusLabel origin={active.origin} status={active.status} viewer="worker" />
          {active.origin === "applied" && active.status === "waiting" ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold text-primary"
              disabled={demo.saving}
              aria-busy={demo.saving}
              onClick={() => {
                if (demo.saving) return;
                void demo.withdrawApplication(active.id).then((ok) => {
                  if (ok) show("Application withdrawn.");
                });
              }}
            >
              Withdraw
            </button>
          ) : null}
          {active.origin === "invited" && active.status === "waiting" && request.status === "open" ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="work"
                disabled={demo.saving}
                aria-busy={demo.saving}
                onClick={() => {
                  if (demo.saving) return;
                  void demo.setApplicationStatus(active.id, "accepted").then((ok) => {
                    if (ok) show(`${firstName(demo.name)} is on the team.`);
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
                  void demo.setApplicationStatus(active.id, "declined").then((ok) => {
                    if (ok) show("Declined.");
                  });
                }}
              >
                Decline
              </Button>
            </div>
          ) : null}
          {active.origin === "invited" && active.status === "waiting" && request.status !== "open" ? (
            <div className="space-y-3">
              <p className="text-lg">The team is full.</p>
              <Button
                variant="outline"
                disabled={demo.saving}
                aria-busy={demo.saving}
                onClick={() => {
                  if (demo.saving) return;
                  void demo.setApplicationStatus(active.id, "declined").then((ok) => {
                    if (ok) show("Declined.");
                  });
                }}
              >
                Decline
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isWorker && !active && declined ? (
        <ApplicationStatusLabel origin={declined.origin} status={declined.status} viewer="worker" />
      ) : null}

      <ul className="flex flex-wrap gap-2">
        {request.skills.map((skill) => (
          <li
            key={skill}
            className="inline-flex min-h-8 items-center rounded-full bg-secondary px-3 text-sm font-semibold whitespace-nowrap text-secondary-foreground"
          >
            {skillTitle(skill)}
          </li>
        ))}
      </ul>
      <ProjectPhases sector={request.sector} kindId={request.kind} openPhase={0} />
      <ReadinessReport
        sector={request.sector}
        kindId={request.kind}
        site={request.site}
        readiness={request.readiness}
        posterName={postedBy ? firstName(postedBy) : ""}
        canEdit={isOwner}
        saving={demo.saving}
        onChange={(next) => {
          if (demo.saving) return;
          void demo.setReadiness({ requestId: request.id, readiness: next }).then((ok) => {
            if (ok) show("Ready list saved.");
          });
        }}
      />
      <WhatItTakes
        countryId={request.countryId}
        countryName={getCountry(request.countryId)?.name ?? "this country"}
        sector={request.sector}
        placeName={where?.town ?? "this place"}
        projects={demo.projects}
        collapsed
      />
      <ThisPlace countryId={request.countryId} parishId={request.parishId} collapsed />
      <RulesHere countryId={request.countryId} />
      {isOwner ? (
        <PhotoAdder
          subject="request"
          subjectId={request.id}
          ownerId={demo.userId}
        />
      ) : null}
      <CapitalChip audience={isOwner ? "own-request" : "request"} />
      {isWorker && !related.some((item) => item.workerId === demo.userId && item.status === "accepted") ? (
        <BeforeYouApply
          requestId={request.id}
          countryId={request.countryId}
          countryName={getCountry(request.countryId)?.name ?? "this country"}
          sector={request.sector}
          placeName={where?.town ?? "this place"}
          skills={request.skills}
          weekly={sectorWeekly(request.sector)}
          currency={currency}
        />
      ) : null}

      {isOwner ? (
        <section className="space-y-4">
          <h2 className={sectionTitle}>Applications</h2>
          {related.length === 0 ? (
            <p className="text-lg">No one has applied yet.</p>
          ) : (
            related.map((application) => (
              <ApplicationRow
                key={application.id}
                application={application}
                open={request.status === "open"}
                onStatus={(applicationId, status) => {
                  const named = demo.displayNameFor(application.workerId);
                  if (demo.saving) return;
                  void demo.setApplicationStatus(applicationId, status).then((ok) => {
                    if (!ok) return;
                    show(status === "accepted" ? `${named ? firstName(named) : "A worker"} is on the team.` : "Declined.");
                  });
                }}
              />
            ))
          )}
        </section>
      ) : null}

      {isOwner ? (
        <section className="space-y-4">
          <h2 className={sectionTitle}>Workers available nearby</h2>
          {nearby.length === 0 ? (
            <p className="text-lg leading-relaxed">No one has posted availability near this place yet.</p>
          ) : (
            nearby.map((match) => {
              const post = match.availability;
              const existing = related.find(
                (item) => item.workerId === post.userId && item.status !== "declined",
              );
              const name = demo.displayNameFor(post.userId) || "A worker";
              return (
                <article key={post.id} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
                  <p className="text-lg font-semibold">{name}</p>
                  <p className="text-base leading-relaxed">{match.reason}</p>
                  {existing?.status === "accepted" ? (
                    <p className="text-base font-semibold">Accepted</p>
                  ) : existing?.origin === "invited" && existing.status === "waiting" ? (
                    <p className="text-base font-semibold">Invited</p>
                  ) : existing?.origin === "applied" ? (
                    <p className="text-base font-semibold">Already applied</p>
                  ) : request.status === "open" ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={demo.saving}
                      aria-busy={demo.saving}
                      onClick={() => {
                        if (demo.saving) return;
                        void demo.inviteWorker(request.id, post.userId).then((ok) => {
                          if (ok) show(`Invited ${firstName(name)}.`);
                        });
                      }}
                    >
                      Invite
                    </Button>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      ) : null}

      {hasRequestActions ? <ActionBar hideExpanded>{requestActions}</ActionBar> : null}
    </div>
    <aside className="sticky top-20 hidden space-y-3 self-start rounded-2xl bg-card p-4 ring-1 ring-foreground/10 min-[840px]:block">
      <CapitalBar pledged={pledged} budget={request.budget} investors={investors} currency={currency} />
      <TeamBar accepted={accepted} needed={request.workersNeeded} />
      <BackersRow people={marks} />
      {requestActions}
      <CapitalChip audience={isOwner ? "own-request" : "request"} />
    </aside>
    </div>
  );
}

function ApplicationRow({
  application,
  open,
  onStatus,
}: {
  application: Application;
  open: boolean;
  onStatus: (id: string, status: "accepted" | "declined") => void;
}) {
  const { saving, displayNameFor } = useDemo();
  const waitingApply = application.origin === "applied" && application.status === "waiting";
  const person = displayNameFor(application.workerId) || "A worker";
  return (
    <article className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-lg font-semibold">{person}</p>
      <p className="text-base">{skillTitle(application.skill)}</p>
      {application.message ? <p className="text-base leading-relaxed">{application.message}</p> : null}
      <ApplicationStatusLabel origin={application.origin} status={application.status} viewer="investor" />
      {waitingApply && open ? (
        <div className="flex flex-col gap-2">
          <Button disabled={saving} aria-busy={saving} onClick={() => onStatus(application.id, "accepted")}>Accept</Button>
          <Button variant="outline" disabled={saving} aria-busy={saving} onClick={() => onStatus(application.id, "declined")}>
            Not this time
          </Button>
        </div>
      ) : null}
      {waitingApply && !open ? (
        <div className="space-y-3">
          <p className="text-lg">The team is full.</p>
          <Button variant="outline" disabled={saving} aria-busy={saving} onClick={() => onStatus(application.id, "declined")}>
            Not this time
          </Button>
        </div>
      ) : null}
    </article>
  );
}
