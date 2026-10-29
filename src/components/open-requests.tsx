"use client";

import Link from "next/link";
import { sectionTitle } from "@/components/parts";
import { RequestCard } from "@/components/request-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { matchRequests } from "@/lib/match";
import type { Skill } from "@/lib/types";

function skillsFor(demo: ReturnType<typeof useDemo>): Skill[] {
  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  return [...new Set([primary, ...extras].filter((item): item is Skill => Boolean(item)))];
}

export function OpenRequests({
  emptyPlace = "Pick a place below to see requests near you.",
}: {
  emptyPlace?: string;
}) {
  const demo = useDemo();
  const usingFlow = Boolean(demo.flow?.townId && (demo.flow.parishId || demo.flow.countryId));
  const countryId = usingFlow
    ? demo.flow?.countryId || (demo.flow?.parishId ? "jamaica" : "")
    : (demo.homeCountryId ?? "");
  const parishId = usingFlow ? (demo.flow?.parishId ?? null) : demo.homeParishId;
  const townId = usingFlow ? (demo.flow?.townId ?? "") : (demo.homeTownId ?? "");
  const skills = skillsFor(demo);
  const matches =
    demo.ready && countryId && townId
      ? matchRequests({
          countryId,
          parishId,
          townId,
          skills,
          requests: demo.requests,
        })
      : [];

  if (!demo.ready) return null;

  return (
    <section className="space-y-4">
      <h2 className={sectionTitle}>Open requests near you</h2>
      {!countryId || !townId ? (
        <p className="text-lg leading-relaxed">{emptyPlace}</p>
      ) : skills.length === 0 ? (
        <p className="text-lg leading-relaxed">Pick a place and your work to see requests.</p>
      ) : matches.length === 0 ? (
        <p className="text-lg leading-relaxed">No open request near you yet.</p>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <RequestCard key={match.request.id} request={match.request} reason={match.reason} />
          ))}
        </div>
      )}
      <Link
        href="/work/available"
        className={cn(buttonVariants({ variant: "workOutline", size: "lg" }), "w-full")}
      >
        Post that you are available
      </Link>
    </section>
  );
}
