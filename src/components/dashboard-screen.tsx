"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { GetStartedCard, GettingStarted } from "@/components/getting-started";
import { LessonList } from "@/components/lesson-card";
import { ProjectCard } from "@/components/project-card";
import { RequestCard } from "@/components/request-card";
import { ApplicationStatusLabel, Avatar, MoneyText, StatusLabel, sectionTitle } from "@/components/parts";
import { ThisWeekNeed } from "@/components/this-week";
import { WifiUploadSetting } from "@/components/video-proof";
import { useSnackbar } from "@/components/snackbar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sectorTitle, skillTitle, workPresetLabel } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { allLessons, growWorkLesson } from "@/lib/lessons";
import { isLive } from "@/lib/mode";
import { buildPortfolio, formatUsd } from "@/lib/portfolio";
import { refreshLiveStore } from "@/lib/live-store";
import { browserSupabase } from "@/lib/supabase/browser";
import { firstName, placeLine } from "@/lib/format";
import { explorerUrl, sameAddress } from "@/lib/money";
import { investorUnits, workerUnits } from "@/lib/ownership";
import { acceptedCount, waitingCount } from "@/lib/requests";
import { gatePath } from "@/lib/start-gate";
import { currencyOf, requestPlace } from "@/lib/seed";
import type { Application } from "@/lib/types";

export function DashboardScreen() {
  const demo = useDemo();
  const router = useRouter();
  if (!demo.ready) return <PageBusy />;
  if (!demo.profileSet && !demo.role) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-4xl leading-tight">Hello</h1>
        <GetStartedCard />
      </div>
    );
  }

  const greeting =
    firstName(demo.name) === "You" ? "Hello" : `Hello, ${firstName(demo.name)}`;
  const hasMoney = demo.commitments.length > 0;
  const hasWork = demo.contributions.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl leading-tight">{greeting}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4">
          {demo.role === "investor" ? (
            <Link href="/you/portfolio" className="inline-flex min-h-11 items-center font-semibold text-primary">
              Your portfolio
            </Link>
          ) : null}
          <Link href="/you/profile" className="inline-flex min-h-11 items-center font-semibold text-primary">
            Your profile
          </Link>
          <Link href="/you/wallet" className="inline-flex min-h-11 items-center font-semibold text-primary">
            Check a wallet
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {!isLive() && demo.userId !== "you" ? (
            <Badge variant="outline">Sample person</Badge>
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

      {demo.role === "investor" ? (
        <div className="space-y-6 min-[840px]:grid min-[840px]:grid-cols-2 min-[840px]:items-start min-[840px]:gap-6 min-[840px]:space-y-0">
          <SavedList />
          <PortfolioCard />
        </div>
      ) : (
        <SavedList />
      )}

      <NeedsYou />

      {demo.role === "investor" ? <YourRequests /> : null}
      {demo.role === "worker" ? <YourApplications /> : null}
      {demo.role === "worker" ? <YourAvailability /> : null}

      {hasMoney ? (
          <section className="space-y-4">
            <h2 className={sectionTitle}>Your commitments</h2>
            {demo.commitments.map((commitment) => {
              const project = demo.projects.find((item) => item.id === commitment.projectId);
              if (!project) return null;
              const units = investorUnits(commitment.amountJmd, project.goalJmd);
              const onChain = demo.projectWallets.some((item) => item.projectId === project.id);
              return (
                <Link
                  key={commitment.id}
                  href={onChain && commitment.status === "pledged" ? `/projects/${project.id}/committed#send` : `/projects/${project.id}`}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle>{project.name}</CardTitle>
                      <StatusLabel
                        status={commitment.status}
                        kind="capital"
                        waiting={onChain ? "Waiting on the chain" : undefined}
                      />
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        <MoneyText amount={commitment.amountJmd} currency={currencyOf(project.countryId)} />
                      </p>
                      <p className="mt-1 text-base">
                        {commitment.status === "accepted"
                          ? `About ${units} ownership units`
                          : onChain
                            ? `About ${units} ownership units once a confirmed payment covers it`
                            : `About ${units} ownership units if accepted`}
                      </p>
                      {onChain && commitment.status === "pledged" ? (
                        <p className="mt-2 font-semibold text-primary">Send it</p>
                      ) : null}
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
            <h2 className={sectionTitle}>Your work</h2>
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
              const paid = demo.payments.find(
                (payment) =>
                  payment.kind === "pay-out" &&
                  payment.status === "confirmed" &&
                  payment.projectId === contribution.projectId &&
                  demo.wallets.some(
                    (wallet) =>
                      wallet.verifiedAt &&
                      wallet.chain === payment.chain &&
                      sameAddress(wallet.address, payment.toAddress),
                  ),
              );
              const paidUrl = paid ? explorerUrl(paid.chain, paid.txId) : null;
              return (
                <div key={contribution.id} className="space-y-2">
                  <Link
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
                        {paid ? (
                          <>
                            <p className="mt-2 font-semibold">Paid</p>
                            <p className="mt-1 text-base text-muted-foreground">
                              This is in your own wallet. Fundwork cannot move or freeze it.
                            </p>
                          </>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Link>
                  {paid && paidUrl ? (
                    <a href={paidUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-semibold text-primary">
                      See it on the explorer
                    </a>
                  ) : null}
                </div>
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

      {demo.role === "worker" && hasWork ? <GrowYourWork /> : null}

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

      <YourLearning />

      <GettingStarted />

      <WifiUploadSetting />

      {isLive() ? (
        <button
          type="button"
          className="min-h-11 font-semibold text-primary"
          onClick={() => {
            void browserSupabase().auth.signOut().then(async () => {
              await refreshLiveStore();
              router.push("/");
            });
          }}
        >
          Sign out
        </button>
      ) : (
        <section className="space-y-3">
          <h2 className={sectionTitle}>Demo</h2>
          <Link
            href="/you/switch"
            className="inline-flex min-h-11 items-center font-semibold text-primary"
          >
            See an example person
          </Link>
        </section>
      )}
    </div>
  );
}

function PortfolioCard() {
  const demo = useDemo();
  const [now] = useState(() => Date.now());
  const view = buildPortfolio({
    userId: demo.userId,
    commitments: demo.commitments,
    projects: demo.projects,
    payments: demo.payments,
    weeks: demo.weeks,
    applications: demo.applications,
    nameFor: demo.displayNameFor,
    now,
  });
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>Your portfolio</h2>
      <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
        <p className="text-base">{formatUsd(view.pledged.usd)} pledged</p>
        <p className="text-base">{formatUsd(view.confirmed.usd)} confirmed on the chain</p>
        <Link href="/you/portfolio" className="inline-flex min-h-11 items-center font-semibold text-primary">
          See your portfolio
        </Link>
      </div>
    </section>
  );
}

function SavedList() {
  const demo = useDemo();
  return (
    <section id="saved" className="space-y-3">
      <h2 className={sectionTitle}>Saved</h2>
      {demo.savedIds.length === 0 ? <p className="text-base">Nothing saved yet.</p> : null}
      {demo.savedIds.map((id) => {
        const project = demo.projects.find((item) => item.id === id);
        if (project) return <ProjectCard key={id} project={project} />;
        const request = demo.requests.find((item) => item.id === id);
        if (request) return <RequestCard key={id} request={request} />;
        return null;
      })}
    </section>
  );
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
              demo.projects.some((project) => project.id === item.projectId && project.organizerId === demo.userId),
          );
        })
      : demo.role === "worker"
        ? demo.applications.filter(
            (item) => item.workerId === demo.userId && item.origin === "invited" && item.status === "waiting",
          )
        : [];
  const organized =
    demo.role === "investor"
      ? demo.projects.filter((project) => project.organizerId === demo.userId)
      : [];
  if (waiting.length === 0 && organized.length === 0) return null;

  return (
    <section id="needs-you" className="space-y-4">
      <h2 className={sectionTitle}>Needs you</h2>
      {waiting.map((application) => (
        <NeedRow key={application.id} application={application} show={show} />
      ))}
      {organized.map((project) => (
        <ThisWeekNeed key={project.id} project={project} />
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
  const named = demo.displayNameFor(application.workerId);
  const person = named || "A worker";
  const href = request ? `/requests/${request.id}` : project ? `/projects/${project.id}` : "/you";
  const title = request
    ? `${skillTitle(application.skill)} on ${sectorTitle(request.sector)} request`
    : project
      ? `${skillTitle(application.skill)} on ${project.name}`
      : skillTitle(application.skill);
  const open = request ? request.status === "open" : true;
  const work = demo.role === "worker";

  async function accept() {
    if (demo.saving) return;
    if (!(await demo.setApplicationStatus(application.id, "accepted"))) return;
    const who = work ? demo.name : named;
    show(`${who.trim() && who !== "You" ? firstName(who) : person} is on the team.`);
  }

  async function decline() {
    if (demo.saving) return;
    if (!(await demo.setApplicationStatus(application.id, "declined"))) return;
    show("Declined.");
  }

  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={named} size="sm" />
          <div className="min-w-0">
            <Link href={href} className="text-base font-semibold text-primary">
              {work ? title : person}
            </Link>
            <p className="text-sm">{work ? "Invited. Waiting on you." : title}</p>
          </div>
        </div>
        {open ? (
          <div className="flex shrink-0 gap-2">
            <Button variant={work ? "work" : "default"} disabled={demo.saving} aria-busy={demo.saving} onClick={() => void accept()}>
              Accept
            </Button>
            <Button variant="outline" disabled={demo.saving} aria-busy={demo.saving} onClick={() => void decline()}>
              {work ? "Decline" : "Not this time"}
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-sm">The team is full.</p>
            <Button variant="outline" disabled={demo.saving} aria-busy={demo.saving} onClick={() => void decline()}>
              {work ? "Decline" : "Not this time"}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function GrowYourWork() {
  const demo = useDemo();
  const lesson = growWorkLesson();
  if (!lesson) return null;
  const countryId = demo.flow?.countryId || demo.homeCountryId;
  const parishId = demo.flow?.countryId ? (demo.flow.parishId ?? null) : demo.homeParishId;
  const townId = (demo.flow?.countryId ? demo.flow.townId : demo.homeTownId) || "";
  const place = parishId || countryId;
  const href = gatePath(townId && place ? `/invest/start/${place}/${townId}` : "/invest/start", demo.profileSet);
  return (
    <section className="space-y-4">
      <h2 className={sectionTitle}>Grow your work</h2>
      <LessonList lessons={[lesson]} />
      <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
        Start a project here
      </Link>
    </section>
  );
}

function YourLearning() {
  const demo = useDemo();
  if (demo.role !== "investor" && demo.role !== "worker") return null;
  const audiences = demo.role === "worker" ? new Set(["worker"]) : new Set(["investor", "organizer"]);
  const mine = allLessons().filter((lesson) => audiences.has(lesson.audience));
  const seen = mine.filter((lesson) => demo.learningSeen.includes(lesson.id));
  const done = mine.filter((lesson) => demo.learningDone.includes(lesson.id));
  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>Your learning</h2>
      <div>
        <h3 className="font-semibold">Seen</h3>
        {seen.length === 0 ? (
          <p className="text-base">You have not opened a lesson yet.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {seen.map((lesson) => (
              <li key={lesson.id} className="text-base">
                {lesson.title}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-semibold">Done</h3>
        {done.length === 0 ? (
          <p className="text-base">None yet.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {done.map((lesson) => (
              <li key={lesson.id} className="text-base">
                {lesson.title}
              </li>
            ))}
          </ul>
        )}
      </div>
      {demo.role === "investor" ? (
        <Link href="/learn/investor" className="inline-flex min-h-11 items-center font-semibold text-primary">
          Review the investor basics
        </Link>
      ) : null}
    </section>
  );
}

function YourRequests() {
  const demo = useDemo();
  const mine = demo.requests.filter((request) => request.userId === demo.userId);
  return (
    <section className="space-y-4">
      <h2 className={sectionTitle}>Your requests</h2>
      {mine.length === 0 ? (
        <>
          <p className="text-lg">You have not posted a request yet.</p>
          <Link href={gatePath("/invest/start", demo.profileSet)} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
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
                  <p className="text-lg font-semibold">
                    <MoneyText amount={request.budget} currency={currencyOf(request.countryId)} />
                  </p>
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
      <h2 className={sectionTitle}>Your applications</h2>
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
      <h2 className={sectionTitle}>Your availability</h2>
      {mine.length === 0 ? (
        <>
          <p className="text-lg">You have not posted that you are available.</p>
          <Link
            href={gatePath("/work/available", demo.profileSet)}
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
