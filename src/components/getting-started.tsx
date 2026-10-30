"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Checklist, sectionTitle } from "@/components/parts";
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

export function GetStartedCard() {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className={sectionTitle}>Get started</h2>
      <p className="text-base">Tell us your role and where to look.</p>
      <Link href="/get-started" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
        Get started
      </Link>
    </div>
  );
}

export function GetStartedButton() {
  const demo = useDemo();
  if (!demo.ready || demo.profileSet) return null;
  return (
    <Link href="/get-started" className={cn(buttonVariants({ size: "sm" }), "w-full")}>
      Get started
    </Link>
  );
}

export function GettingStarted() {
  const demo = useDemo();

  if (!demo.role) return <GetStartedCard />;

  if (demo.role === "investor") {
    const placed = Boolean(demo.flow?.countryId || demo.homeCountryId);
    const posted =
      demo.requests.some((request) => request.userId === demo.userId) ||
      demo.openedProject ||
      demo.projects.some((project) => project.organizerId === demo.userId);
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
