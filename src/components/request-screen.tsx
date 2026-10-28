"use client";

import Link from "next/link";
import { PageBusy } from "@/components/busy";
import {
  ActionBar,
  ApplicationStatusLabel,
  CapitalChip,
  SectorTile,
  StepHeader,
} from "@/components/parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { sectorTitle, skillPhrase, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { money, placeLine } from "@/lib/format";
import { matchWorkers } from "@/lib/match";
import { acceptedCount } from "@/lib/requests";
import { currencyOf, getUser, requestPlace } from "@/lib/seed";
import type { Application } from "@/lib/types";

export function RequestScreen({ id }: { id: string }) {
  const demo = useDemo();
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
  const place = where ? placeLine(where.town, where.parish) : "This place";
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
        <h1 className="font-display text-3xl leading-tight">{sectorTitle(request.sector)}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{place}</p>
      </div>
      <p className="text-3xl font-semibold leading-tight">{money(request.budget, currency)}</p>
      <p className="text-lg font-semibold">
        {accepted} of {request.workersNeeded} workers
      </p>
      {request.status === "team-ready" ? <p className="text-lg">The team is ready.</p> : null}
      {request.status === "closed" ? <p className="text-lg">This request is closed.</p> : null}

      {isWorker && active ? (
        <div className="space-y-4">
          <ApplicationStatusLabel origin={active.origin} status={active.status} viewer="worker" />
          {active.origin === "applied" && active.status === "waiting" ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold text-primary"
              onClick={() => demo.withdrawApplication(active.id)}
            >
              Withdraw
            </button>
          ) : null}
          {active.origin === "invited" && active.status === "waiting" ? (
            <div className="flex flex-col gap-2">
              <Button variant="work" onClick={() => demo.setApplicationStatus(active.id, "accepted")}>
                Accept
              </Button>
              <Button variant="outline" onClick={() => demo.setApplicationStatus(active.id, "declined")}>
                Decline
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isWorker && !active && declined ? (
        <ApplicationStatusLabel origin={declined.origin} status={declined.status} viewer="worker" />
      ) : null}

      <p className="text-lg leading-relaxed">Needs {request.skills.map((skill) => skillPhrase(skill)).join(", ")}.</p>
      {request.note ? <p className="text-lg leading-relaxed">{request.note}</p> : null}
      <CapitalChip />

      {isOwner ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Applications</h2>
          {related.length === 0 ? (
            <p className="text-lg">No one has applied yet.</p>
          ) : (
            related.map((application) => (
              <ApplicationRow
                key={application.id}
                application={application}
                youId={demo.userId}
                youName={demo.name}
                onStatus={demo.setApplicationStatus}
              />
            ))
          )}
        </section>
      ) : null}

      {isOwner ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Workers available nearby</h2>
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
                      onClick={() => demo.inviteWorker(request.id, post.userId)}
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
    </div>
  );
}

function personName(id: string, youId: string, youName: string): string {
  if (id === youId) return youName;
  return getUser(id)?.name ?? "A worker";
}

function ApplicationRow({
  application,
  youId,
  youName,
  onStatus,
}: {
  application: Application;
  youId: string;
  youName: string;
  onStatus: (id: string, status: "accepted" | "declined") => void;
}) {
  const waitingApply = application.origin === "applied" && application.status === "waiting";
  return (
    <article className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-lg font-semibold">{personName(application.workerId, youId, youName)}</p>
      <p className="text-base">{skillTitle(application.skill)}</p>
      {application.message ? <p className="text-base leading-relaxed">{application.message}</p> : null}
      <ApplicationStatusLabel origin={application.origin} status={application.status} viewer="investor" />
      {waitingApply ? (
        <div className="flex flex-col gap-2">
          <Button onClick={() => onStatus(application.id, "accepted")}>Accept</Button>
          <Button variant="outline" onClick={() => onStatus(application.id, "declined")}>
            Not this time
          </Button>
        </div>
      ) : null}
    </article>
  );
}
