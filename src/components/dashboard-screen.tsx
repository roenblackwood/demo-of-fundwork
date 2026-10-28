"use client";

import Link from "next/link";
import { PageBusy } from "@/components/busy";
import { GettingStarted } from "@/components/getting-started";
import { ApplicationStatusLabel, StatusLabel } from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sectorTitle, skillTitle, workPresetLabel } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, money, placeLine } from "@/lib/format";
import { investorUnits, workerUnits } from "@/lib/ownership";
import { acceptedCount, waitingCount } from "@/lib/requests";
import { currencyOf, getUser, requestPlace } from "@/lib/seed";
import type { Application } from "@/lib/types";

export function DashboardScreen() {
  const demo = useDemo();
  if (!demo.ready) return <PageBusy />;

  const greeting =
    firstName(demo.name) === "You" ? "Hello" : `Hello, ${firstName(demo.name)}`;
  const hasMoney = demo.commitments.length > 0;
  const hasWork = demo.contributions.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl leading-tight">{greeting}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {demo.verified ? (
            <Badge className="border-transparent bg-trust text-trust-foreground">
              Verified ID
            </Badge>
          ) : (
            <Badge variant="outline">ID not checked yet</Badge>
          )}
          {demo.proof || demo.proofLabel ? (
            <Badge className="border-transparent bg-trust text-trust-foreground">
              Work photo on file
            </Badge>
          ) : demo.role === "worker" ? (
            <Badge variant="outline">No work photo yet</Badge>
          ) : null}
        </div>
      </div>

      <NeedsYou />

      {demo.role === "investor" ? <YourRequests /> : null}
      {demo.role === "worker" ? <YourApplications /> : null}
      {demo.role === "worker" ? <YourAvailability /> : null}

      {hasMoney ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Your commitments</h2>
            {demo.commitments.map((commitment) => {
              const project = demo.projects.find((item) => item.id === commitment.projectId);
              if (!project) return null;
              const units = investorUnits(commitment.amountJmd, project.goalJmd);
              return (
                <Link
                  key={commitment.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                      <StatusLabel status={commitment.status} kind="capital" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        {money(commitment.amountJmd, currencyOf(project.countryId))}
                      </p>
                      <p className="mt-1 text-base">
                        {commitment.status === "accepted"
                          ? `About ${units} ownership units`
                          : `About ${units} ownership units if accepted`}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
            {demo.role === "investor" ? (
              <Link href="/invest" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
                Look for another project
              </Link>
            ) : null}
          </section>
      ) : null}

      {hasWork ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Your work</h2>
            {demo.proof?.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={demo.proof.dataUrl}
                alt="Photo of your work"
                className="max-h-48 w-full rounded-2xl object-cover"
              />
            ) : demo.proofLabel ? (
              <p className="font-semibold">{demo.proofLabel}</p>
            ) : null}
            {demo.contributions.map((contribution) => {
              const project = demo.projects.find((item) => item.id === contribution.projectId);
              if (!project) return null;
              const units = workerUnits(contribution.preset);
              return (
                <Link
                  key={contribution.id}
                  href={`/projects/${project.id}`}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                      <StatusLabel status={contribution.status} kind="work" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        {workPresetLabel(contribution.preset)}
                      </p>
                      <p className="mt-1 text-base">
                        {contribution.status === "accepted"
                          ? `${units} ownership units`
                          : `${units} ownership units if accepted`}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
            {demo.role === "worker" ? (
              <Link
                href="/work"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
              >
                Find more work
              </Link>
            ) : null}
          </section>
      ) : null}

      {(hasMoney || hasWork) ? (
        <Link
          href="/you/ownership"
          className={cn(
            buttonVariants({ size: "lg" }),
            "w-full",
          )}
        >
          See your ownership units
        </Link>
      ) : null}

      <GettingStarted />

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Demo</h2>
        <Link
          href="/you/switch"
          className="inline-flex min-h-11 items-center font-semibold text-primary"
        >
          See an example person
        </Link>
      </section>
    </div>
  );
}

function personLabel(id: string, youId: string, youName: string): string {
  if (id === youId) return youName;
  return getUser(id)?.name ?? "A worker";
}

function NeedsYou() {
  const demo = useDemo();
  const show = useSnackbar();
  const waiting =
    demo.role === "investor"
      ? demo.applications.filter((item) => {
          if (item.origin !== "applied" || item.status !== "waiting") return false;
          if (item.requestId && demo.requests.some((request) => request.id === item.requestId && request.userId === demo.userId)) {
            return true;
          }
          return Boolean(
            item.projectId &&
              demo.projects.some((project) => project.id === item.projectId && project.organizerName === demo.name),
          );
        })
      : demo.role === "worker"
        ? demo.applications.filter(
            (item) => item.workerId === demo.userId && item.origin === "invited" && item.status === "waiting",
          )
        : [];
  if (waiting.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Needs you</h2>
      {waiting.map((application) => (
        <NeedRow key={application.id} application={application} show={show} />
      ))}
    </section>
  );
}

function NeedRow({
  application,
  show,
}: {
  application: Application;
  show: (text: string) => void;
}) {
  const demo = useDemo();
  const request = application.requestId
    ? demo.requests.find((item) => item.id === application.requestId)
    : undefined;
  const project = application.projectId
    ? demo.projects.find((item) => item.id === application.projectId)
    : undefined;
  const person = personLabel(application.workerId, demo.userId, demo.name);
  const href = request ? `/requests/${request.id}` : project ? `/projects/${project.id}` : "/you";
  const title = request
    ? `${sectorTitle(request.sector)} request`
    : project
      ? project.name
      : "An application";
  const open = request ? request.status === "open" : true;
  const work = demo.role === "worker";

  function accept() {
    if (!demo.setApplicationStatus(application.id, "accepted")) return;
    show(`${firstName(work ? demo.name : person)} is on the team.`);
  }

  function decline() {
    if (!demo.setApplicationStatus(application.id, "declined")) return;
    show("Declined.");
  }

  return (
    <article className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <Link href={href} className="text-lg font-semibold text-primary">
        {work ? title : person}
      </Link>
      <p className="text-base">{work ? "Invited. Waiting on you." : title}</p>
      {open ? (
        <div className="flex flex-col gap-2">
          <Button variant={work ? "work" : "default"} onClick={accept}>
            Accept
          </Button>
          <Button variant="outline" onClick={decline}>
            {work ? "Decline" : "Not this time"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-lg">The team is full.</p>
          <Button variant="outline" onClick={decline}>
            {work ? "Decline" : "Not this time"}
          </Button>
        </div>
      )}
    </article>
  );
}

function YourRequests() {
  const demo = useDemo();
  const mine = demo.requests.filter((request) => request.userId === demo.userId);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Your requests</h2>
      {mine.length === 0 ? (
        <>
          <p className="text-lg">You have not posted a request yet.</p>
          <Link href="/invest/start" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
            Start a project here
          </Link>
        </>
      ) : (
        mine.map((request) => {
          const where = requestPlace(request);
          const place = where ? placeLine(where.town, where.parish) : "This place";
          const waiting = waitingCount(demo.applications, request.id);
          const accepted = acceptedCount(demo.applications, request.id);
          return (
            <Link
              key={request.id}
              href={`/requests/${request.id}`}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <Card>
                <CardHeader>
                  <CardTitle>
                    {sectorTitle(request.sector)} in {place}
                  </CardTitle>
                  <Badge className="border-transparent bg-wait text-wait-foreground">
                    {waiting} waiting
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{money(request.budget, currencyOf(request.countryId))}</p>
                  <p className="mt-1 text-base">
                    {accepted} of {request.workersNeeded} workers
                  </p>
                  {request.status === "team-ready" ? <p className="mt-1 text-base">The team is ready.</p> : null}
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </section>
  );
}

function YourApplications() {
  const demo = useDemo();
  const mine = demo.applications.filter((item) => item.workerId === demo.userId);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Your applications</h2>
      {mine.length === 0 ? (
        <>
          <p className="text-lg">You have not applied yet.</p>
          <Link href="/work" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
            See open requests
          </Link>
        </>
      ) : (
        mine.map((application) => {
          const request = application.requestId
            ? demo.requests.find((item) => item.id === application.requestId)
            : undefined;
          const project = application.projectId
            ? demo.projects.find((item) => item.id === application.projectId)
            : undefined;
          if (!request && !project) return null;
          const where = request ? requestPlace(request) : null;
          const place = where ? placeLine(where.town, where.parish) : "";
          const title = request
            ? `${sectorTitle(request.sector)} in ${place}`
            : project?.name ?? "A project";
          const href = request ? `/requests/${request.id}` : `/projects/${project?.id}`;
          return (
            <Link
              key={application.id}
              href={href}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <Card>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                  <ApplicationStatusLabel
                    origin={application.origin}
                    status={application.status}
                    viewer="worker"
                  />
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold">{skillTitle(application.skill)}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </section>
  );
}

function YourAvailability() {
  const demo = useDemo();
  const mine = demo.availability.filter((item) => item.userId === demo.userId);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Your availability</h2>
      {mine.length === 0 ? (
        <>
          <p className="text-lg">You have not posted that you are available.</p>
          <Link
            href="/work/available"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}
          >
            Post that you are available
          </Link>
        </>
      ) : (
        mine.map((post) => {
          const where = requestPlace(post);
          const place = where ? placeLine(where.town, where.parish) : "This place";
          return (
            <Card key={post.id}>
              <CardHeader>
                <CardTitle>{place}</CardTitle>
                <Badge className="border-transparent bg-trust text-trust-foreground">Posted</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">
                  {post.skills.map((skill) => skillTitle(skill)).join(", ")}
                </p>
                {post.note ? <p className="mt-1 text-base">{post.note}</p> : null}
              </CardContent>
            </Card>
          );
        })
      )}
    </section>
  );
}
