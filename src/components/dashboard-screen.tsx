"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { GettingStarted } from "@/components/getting-started";
import { LessonList } from "@/components/lesson-card";
import { ApplicationStatusLabel, MoneyText, StatusLabel, sectionTitle } from "@/components/parts";
import { ThisWeekNeed } from "@/components/this-week";
import { useSnackbar } from "@/components/snackbar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sectorTitle, skillTitle, workPresetLabel } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { allLessons, growWorkLesson } from "@/lib/lessons";
import { isLive } from "@/lib/mode";
import { refreshLiveStore } from "@/lib/live-store";
import { browserSupabase } from "@/lib/supabase/browser";
import { firstName, placeLine } from "@/lib/format";
import { explorerUrl, sameAddress } from "@/lib/money";
import { investorUnits, workerUnits } from "@/lib/ownership";
import { acceptedCount, waitingCount } from "@/lib/requests";
import { currencyOf, getUser, requestPlace } from "@/lib/seed";
import type { Application } from "@/lib/types";

export function DashboardScreen() {
  const demo = useDemo();
  const router = useRouter();
  if (!demo.ready) return <PageBusy />;

  const greeting =
    firstName(demo.name) === "You" ? "Hello" : `Hello, ${firstName(demo.name)}`;
  const hasMoney = demo.commitments.length > 0;
  const hasWork = demo.contributions.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl leading-tight">{greeting}</h1>
        <Link href="/you/wallet" className="mt-3 inline-flex min-h-11 items-center font-semibold text-primary">
          Check a wallet
        </Link>
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
                        {paid ? <p className="mt-2 font-semibold">Paid</p> : null}
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
    <section className="space-y-4">
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
  const person = personLabel(application.workerId, demo.userId, demo.name);
  const href = request ? `/requests/${request.id}` : project ? `/projects/${project.id}` : "/you";
  const title = request
    ? `${sectorTitle(request.sector)} request`
    : project
      ? project.name
      : "An application";
  const open = request ? request.status === "open" : true;
  const work = demo.role === "worker";

  async function accept() {
    if (demo.saving) return;
    if (!(await demo.setApplicationStatus(application.id, "accepted"))) return;
    show(`${firstName(work ? demo.name : person)} is on the team.`);
  }

  async function decline() {
    if (demo.saving) return;
    if (!(await demo.setApplicationStatus(application.id, "declined"))) return;
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
          <Button variant={work ? "work" : "default"} disabled={demo.saving} aria-busy={demo.saving} onClick={() => void accept()}>
            Accept
          </Button>
          <Button variant="outline" disabled={demo.saving} aria-busy={demo.saving} onClick={() => void decline()}>
            {work ? "Decline" : "Not this time"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-lg">The team is full.</p>
          <Button variant="outline" disabled={demo.saving} aria-busy={demo.saving} onClick={() => void decline()}>
            {work ? "Decline" : "Not this time"}
          </Button>
        </div>
      )}
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
  const href = townId && place ? `/invest/start/${place}/${townId}` : "/invest/start";
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
