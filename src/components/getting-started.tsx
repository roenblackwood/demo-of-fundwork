"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Checklist } from "@/components/parts";
import { cn } from "cn";
import { COMMIT_LINE } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";

function investHref(flow: {
  parishId?: string;
  townId?: string;
  sector?: string;
} | null): string {
  if (flow?.parishId && flow.townId && flow.sector) {
    return `/invest/${flow.parishId}/${flow.townId}/${flow.sector}`;
  }
  if (flow?.parishId && flow.townId) {
    return `/invest/${flow.parishId}/${flow.townId}`;
  }
  if (flow?.parishId) return `/invest/${flow.parishId}`;
  return "/invest";
}

function profileHref(flow: {
  parishId?: string;
  townId?: string;
  skill?: string;
} | null): string {
  if (flow?.parishId && flow.townId && flow.skill) {
    return `/work/${flow.parishId}/${flow.townId}/${flow.skill}`;
  }
  return "/work";
}

export function GettingStarted() {
  const demo = useDemo();

  if (!demo.role) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">What do you want to do?</h2>
        <Link
          href="/invest"
          onClick={() => demo.startPath("investor")}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          I want to invest
        </Link>
        <Link
          href="/work"
          onClick={() => demo.startPath("worker")}
          className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
        >
          I want to work
        </Link>
      </div>
    );
  }

  if (demo.role === "investor") {
    const picked = Boolean(demo.flow?.parishId) || demo.commitments.length > 0;
    const opened = demo.openedProject || demo.commitments.length > 0;
    const committed = demo.commitments.length > 0;
    return (
      <Checklist
        title="Get started"
        hint={COMMIT_LINE}
        steps={[
          {
            label: "Pick a region",
            done: picked,
            href: "/invest",
            action: "Choose a region",
          },
          {
            label: "Open a project",
            done: opened,
            href: investHref(demo.flow),
            action: "Choose a project",
          },
          {
            label: "Commit capital",
            done: committed,
            href: investHref(demo.flow),
            action: "Choose a project",
          },
        ]}
      />
    );
  }

  const picked = Boolean(demo.flow?.skill || demo.homeSkill) || demo.contributions.length > 0;
  const photo = Boolean(demo.proof || demo.proofLabel);
  const logged = demo.contributions.length > 0;
  return (
    <Checklist
      title="Get started"
      hint="You are paid in a stable unit. Your work can turn into ownership units."
      steps={[
        {
          label: "Pick a region and your work",
          done: picked,
          href: "/work",
          action: "Choose a region",
        },
        {
          label: "Add a photo of recent work",
          done: photo,
          href: profileHref(demo.flow),
          action: "Add a photo",
        },
        {
          label: "Log work on a project",
          done: logged,
          href: "/work/matches",
          action: "See projects for you",
        },
      ]}
    />
  );
}
