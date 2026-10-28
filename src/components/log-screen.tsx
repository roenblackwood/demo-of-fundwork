"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LearnMore, NextSteps, OwnershipSplit, StepHeader } from "@/components/parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { WORK_PRESETS, workPresetLabel } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { WORKER_UNITS, workerUnits } from "@/lib/ownership";
import { getProject } from "@/lib/seed";
import type { Skill, WorkPreset } from "@/lib/types";

export function LogScreen({ id }: { id: string }) {
  const router = useRouter();
  const demo = useDemo();
  const project = getProject(id);
  const [preset, setPreset] = useState<WorkPreset | null>(null);
  const skill: Skill =
    demo.flow?.skill ||
    demo.homeSkill ||
    project?.needs[0] ||
    "building";

  if (!demo.ready) return <p className="text-lg">One moment.</p>;
  if (!project) return null;

  function save() {
    if (!project || !preset) return;
    demo.addContribution({
      id: crypto.randomUUID(),
      userId: demo.userId,
      projectId: project.id,
      skill,
      preset,
      status: "logged",
      createdAt: new Date().toISOString(),
    });
    router.push(`/projects/${project.id}/logged`);
  }

  return (
    <div className="space-y-6">
      <StepHeader
        backHref={`/projects/${project.id}`}
        title="What did you do?"
        hint={project.name}
      />
      <p className="text-lg font-semibold">Your work turns into ownership units.</p>
      <p className="text-lg leading-relaxed">You are paid in a stable unit.</p>
      <div className="space-y-3">
        {WORK_PRESETS.map((item) => {
          const selected = preset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPreset(item.id)}
              className={cn(
                "min-h-14 w-full rounded-2xl border-2 px-4 text-left text-lg font-semibold",
                selected
                  ? "border-work bg-wait text-foreground"
                  : "border-border bg-card",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {preset ? (
        <p className="text-lg leading-relaxed">
          {workPresetLabel(preset)} becomes about {workerUnits(preset)} ownership units, once the organizer accepts it.
        </p>
      ) : null}
      <NextSteps
        items={[
          "Your work is saved on this phone.",
          "The organizer reviews it.",
          "If they accept it, it turns into ownership units.",
        ]}
      />
      <Button
        size="lg"
        variant="work"
        className="w-full"
        disabled={!preset}
        onClick={save}
      >
        {preset ? "Log this work" : "Choose the work"}
      </Button>
      <p className="text-base text-muted-foreground">This is a demo. No money moves.</p>
      <LearnMore title="Who this belongs to">
        <OwnershipSplit />
      </LearnMore>
      <LearnMore title="How work becomes units">
        <p>A day on site is {workerUnits("day")} ownership units.</p>
        <p>A few days is {workerUnits("few")} ownership units.</p>
        <p>A full week is {workerUnits("week")} ownership units.</p>
        <p>
          Units count after the organizer accepts the work. They come out of the{" "}
          {WORKER_UNITS.toLocaleString("en-US")} units set aside for people who build the project.
        </p>
      </LearnMore>
    </div>
  );
}

export function LoggedScreen({ id }: { id: string }) {
  const demo = useDemo();
  const project = getProject(id);
  const contribution = demo.contributions.find((item) => item.projectId === id);

  if (!demo.ready) return <p className="text-lg">One moment.</p>;
  if (!project || !contribution) {
    return (
      <div>
        <StepHeader backHref={`/projects/${id}`} title="No work saved" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref="/you" title="You logged work" hint={project.name} />
      <p className="text-3xl font-semibold">{workPresetLabel(contribution.preset)}</p>
      <p className="text-lg leading-relaxed">
        About {workerUnits(contribution.preset)} ownership units, waiting on the organizer.
      </p>
      <p className="text-lg font-semibold">Your work turns into ownership units.</p>
      <LearnMore title="Who this belongs to">
        <OwnershipSplit />
      </LearnMore>
      <NextSteps
        items={[
          "Your work is saved on this phone.",
          "The organizer reviews it.",
          "If they accept it, it turns into ownership units.",
        ]}
      />
      <Link href="/you/ownership" className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}>
        See your ownership units
      </Link>
    </div>
  );
}
