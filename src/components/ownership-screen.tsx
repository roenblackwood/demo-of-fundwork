"use client";

import Link from "next/link";
import { PageBusy } from "@/components/busy";
import { GettingStarted } from "@/components/getting-started";
import { LearnMore, OwnershipSplit, StatusLabel, StepHeader } from "@/components/parts";
import { workPresetLabel } from "@/lib/catalog";
import { useDemo } from "@/lib/demo-store";
import { money } from "@/lib/format";
import {
  investorUnits,
  workerUnits,
  WORKER_UNITS,
} from "@/lib/ownership";
import { currencyOf, getProject } from "@/lib/seed";

export function OwnershipScreen() {
  const demo = useDemo();
  if (!demo.ready) return <PageBusy />;

  const moneyRows = demo.commitments.flatMap((commitment) => {
    const project = getProject(commitment.projectId);
    if (!project) return [];
    return [
      {
        id: commitment.id,
        projectId: project.id,
        name: project.name,
        status: commitment.status,
        units: investorUnits(commitment.amountJmd, project.goalJmd),
        detail: money(commitment.amountJmd, currencyOf(project.countryId)),
        kind: "capital" as const,
      },
    ];
  });
  const workRows = demo.contributions.flatMap((contribution) => {
    const project = getProject(contribution.projectId);
    if (!project) return [];
    return [
      {
        id: contribution.id,
        projectId: project.id,
        name: project.name,
        status: contribution.status,
        units: workerUnits(contribution.preset),
        detail: workPresetLabel(contribution.preset),
        kind: "work" as const,
      },
    ];
  });

  const accepted =
    moneyRows.filter((row) => row.status === "accepted").reduce((sum, row) => sum + row.units, 0) +
    workRows.filter((row) => row.status === "accepted").reduce((sum, row) => sum + row.units, 0);
  const waiting =
    moneyRows.filter((row) => row.status !== "accepted").reduce((sum, row) => sum + row.units, 0) +
    workRows.filter((row) => row.status !== "accepted").reduce((sum, row) => sum + row.units, 0);

  const line =
    demo.role === "investor"
      ? "Money you commit turns into ownership units once the organizer accepts it."
      : "Your work turns into ownership units.";

  return (
    <div className="space-y-6">
      <StepHeader backHref="/you" title="Your ownership units" />
      <p className="text-lg font-semibold">{line}</p>
      {accepted + waiting === 0 ? (
        <GettingStarted />
      ) : (
        <>
          <div>
            <p className="font-display text-5xl text-primary">{accepted}</p>
            <p className="text-lg">ownership units accepted</p>
            {waiting > 0 ? (
              <p className="mt-2 text-lg">{waiting} waiting on the organizer</p>
            ) : null}
          </div>
          {moneyRows.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">From capital you committed</h2>
              {moneyRows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </section>
          ) : null}
          {workRows.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xl font-semibold">From work you logged</h2>
              {workRows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </section>
          ) : null}
        </>
      )}
      <LearnMore title="Who this belongs to">
        <OwnershipSplit />
      </LearnMore>
      <LearnMore title="How units are counted">
        <p>Accepted units are counted as yours in this demo. Waiting units need the organizer to say yes.</p>
        <p>A day of work is {workerUnits("day")} units. A few days is {workerUnits("few")}. A full week is {workerUnits("week")}.</p>
        <p>
          Work units come out of {WORKER_UNITS.toLocaleString("en-US")} units set aside for people who build a project.
        </p>
        <p>This demo keeps the numbers on this phone.</p>
      </LearnMore>
    </div>
  );
}

function Row({
  row,
}: {
  row: {
    id: string;
    projectId: string;
    name: string;
    status: "pledged" | "accepted" | "logged";
    kind: "capital" | "work";
    units: number;
    detail: string;
  };
}) {
  return (
    <Link
      href={`/projects/${row.projectId}`}
      className="block rounded-2xl border bg-card px-4 py-3 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <p className="text-lg font-semibold">{row.name}</p>
      <p className="mt-1 text-base">{row.detail}</p>
      <p className="mt-1 text-base font-semibold">
        {row.status === "accepted"
          ? `${row.units} ownership units`
          : `${row.units} ownership units if accepted`}
      </p>
      <div className="mt-2">
        <StatusLabel status={row.status} kind={row.kind} />
      </div>
    </Link>
  );
}
