"use client";

import Link from "next/link";
import { PageBusy } from "@/components/busy";
import {
  ActionBar,
  ApplicationStatusLabel,
  Avatar,
  CapitalChip,
  MoneyText,
  SectorTile,
  sectionTitle,
  StepHeader,
} from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { BeforeYouApply, YourPlan } from "@/components/guide-card";
import { sectorTitle, sectorWeekly, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, nameWithInitial, postedDate } from "@/lib/format";
import { matchWorkers } from "@/lib/match";
import { acceptedCount } from "@/lib/requests";
import { currencyOf, getCountry, getUser, requestPlace } from "@/lib/seed";
import type { Application } from "@/lib/types";

export function RequestScreen({ id }: { id: string }) {
  const demo = useDemo();
  const show = useSnackbar();
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

  return (
    <div className="space-y-6">
      <StepHeader backHref={backHref} />
      <SectorTile sector={request.sector} size="page" />
      <div>
        <h1 className="font-display text-3xl leading-tight">
          {where ? `${sectorTitle(request.sector)} in ${where.town}` : sectorTitle(request.sector)}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={posterName(request.userId, demo.userId, demo.name)} />
          <div>
            <p className="font-semibold">
              Posted by {nameWithInitial(posterName(request.userId, demo.userId, demo.name))}
            </p>
            <p className="text-sm text-muted-foreground">{postedDate(request.createdAt)}</p>
          </div>
        </div>
      </div>
      <p className="min-w-0 text-2xl font-semibold leading-snug">
        <MoneyText amount={request.budget} currency={currency} />
      </p>
      <div className="space-y-2">
        <p className="text-lg font-semibold">
          {accepted} of {request.workersNeeded} workers
        </p>
        <div className="flex flex-wrap gap-1.5" aria-hidden>
          {Array.from({ length: request.workersNeeded }, (_, index) => (
            <span
              key={index}
              className={cn(
                "size-3 rounded-full",
                index < accepted ? "bg-work" : "border-2 border-border bg-card",
              )}
            />
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
      {request.note ? <p className="text-lg leading-relaxed">{request.note}</p> : null}
      <CapitalChip />
      {isOwner ? (
        <YourPlan
          countryId={request.countryId}
          countryName={getCountry(request.countryId)?.name ?? "this country"}
          sector={request.sector}
          placeName={where?.town ?? "this place"}
          projects={demo.projects}
        />
      ) : null}
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
                youId={demo.userId}
                youName={demo.name}
                open={request.status === "open"}
                onStatus={(applicationId, status) => {
                  const person = personName(application.workerId, demo.userId, demo.name);
                  if (demo.saving) return;
                  void demo.setApplicationStatus(applicationId, status).then((ok) => {
                    if (!ok) return;
                    show(status === "accepted" ? `${firstName(person)} is on the team.` : "Declined.");
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
              const name = personName(post.userId, demo.userId, demo.name);
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

      {isOwner && request.status === "team-ready" && !request.projectId ? (
        <ActionBar>
          <Link href={`/requests/${request.id}/start`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            Start the project
          </Link>
        </ActionBar>
      ) : null}
      {isWorker && !active && request.status === "open" ? (
        <ActionBar>
          <Link
            href={`/requests/${request.id}/apply`}
            className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
          >
            Apply
          </Link>
        </ActionBar>
      ) : null}
      {demo.role === null ? (
        <ActionBar>
          {request.status === "open" ? (
            <Link
              href={`/requests/${request.id}/apply`}
              onClick={() => demo.startPath("worker")}
              className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
            >
              I can do this work
            </Link>
          ) : null}
          <Link
            href={`/invest/start/${request.parishId ?? request.countryId}/${request.townId}?sector=${request.sector}`}
            onClick={() => {
              demo.startPath("investor");
              demo.updateFlow({
                countryId: request.countryId,
                parishId: request.parishId ?? undefined,
                townId: request.townId,
                sector: request.sector,
              });
            }}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
          >
            Start one like this
          </Link>
        </ActionBar>
      ) : null}
    </div>
  );
}

function posterName(id: string, youId: string, youName: string): string {
  if (id === youId && youName.trim()) return youName;
  return getUser(id)?.name ?? "Someone";
}

function personName(id: string, youId: string, youName: string): string {
  if (id === youId) return youName;
  return getUser(id)?.name ?? "A worker";
}

function ApplicationRow({
  application,
  youId,
  youName,
  open,
  onStatus,
}: {
  application: Application;
  youId: string;
  youName: string;
  open: boolean;
  onStatus: (id: string, status: "accepted" | "declined") => void;
}) {
  const waitingApply = application.origin === "applied" && application.status === "waiting";
  const { saving } = useDemo();
  return (
    <article className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-lg font-semibold">{personName(application.workerId, youId, youName)}</p>
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
