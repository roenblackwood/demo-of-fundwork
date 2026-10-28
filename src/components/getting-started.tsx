"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Checklist } from "@/components/parts";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";

function placeKey(flow: { parishId?: string; countryId?: string } | null): string | undefined {
  return flow?.parishId || flow?.countryId;
}

function profileHref(flow: {
  parishId?: string;
  countryId?: string;
  townId?: string;
  skill?: string;
} | null): string {
  const place = placeKey(flow);
  if (place && flow?.townId && flow.skill) {
    return `/work/place/${place}/${flow.townId}/${flow.skill}`;
  }
  return "/work/place";
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
          className={cn(buttonVariants({ variant: "workOutline", size: "lg" }), "w-full")}
        >
          I want to work
        </Link>
      </div>
    );
  }

  if (demo.role === "investor") {
    const placed = Boolean(demo.flow?.countryId || demo.homeCountryId);
    const posted =
      demo.requests.some((request) => request.userId === demo.userId) ||
      demo.openedProject ||
      demo.projects.some((project) => project.organizerName === demo.name);
    const committed = demo.commitments.length > 0;
    if (placed && posted && committed) return null;
    return (
      <Checklist
        title="Get started"
        steps={[
          {
            label: "Pick your place",
            done: placed,
            href: "/invest/place",
            action: "Pick your place",
          },
          {
            label: "Post a request or open a project",
            done: posted,
            href: "/invest",
            action: "See projects here",
          },
          {
            label: "Commit capital or start a project",
            done: committed,
            href: "/invest",
            action: "See projects here",
          },
        ]}
      />
    );
  }

  const picked = Boolean(demo.flow?.skill || demo.homeSkill) || demo.contributions.length > 0;
  const photo = Boolean(demo.proof || demo.proofLabel);
  const logged = demo.contributions.length > 0;
  if (picked && photo && logged) return null;
  return (
    <Checklist
      title="Get started"
      steps={[
        {
          label: "Pick a region and your work",
          done: picked,
          href: "/work/place",
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
          href: "/work",
          action: "See work here",
        },
      ]}
    />
  );
}
