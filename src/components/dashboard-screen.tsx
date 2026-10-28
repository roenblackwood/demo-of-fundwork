"use client";

import Link from "next/link";
import { PageBusy } from "@/components/busy";
import { GettingStarted } from "@/components/getting-started";
import { StatusLabel } from "@/components/parts";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { workPresetLabel } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName, money } from "@/lib/format";
import { investorUnits, workerUnits } from "@/lib/ownership";
import { currencyOf, getProject } from "@/lib/seed";

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

      {hasMoney ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Your commitments</h2>
            {demo.commitments.map((commitment) => {
              const project = getProject(commitment.projectId);
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
              const project = getProject(contribution.projectId);
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
                href="/work/matches"
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

      {demo.role === "investor" && !hasMoney ? <GettingStarted /> : null}
      {demo.role === "worker" && !hasWork ? <GettingStarted /> : null}
      {!demo.role ? <GettingStarted /> : null}

      <Link
        href="/you/switch"
        className="inline-flex min-h-11 items-center font-semibold text-primary"
      >
        See an example person
      </Link>
    </div>
  );
}
