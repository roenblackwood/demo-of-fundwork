"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { ActionBar, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { WORK_PRESETS, workPresetLabel } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { workerUnits } from "@/lib/ownership";
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

  if (!demo.ready) return <PageBusy />;
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
                "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 text-left text-lg font-semibold",
                selected
                  ? "border-work bg-work/10 text-foreground"
                  : "border-border bg-card",
              )}
            >
              <span>{item.label}</span>
              {selected ? <Check className="size-6 shrink-0 text-work" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
      {preset ? (
        <p className="text-lg leading-relaxed">
          {workPresetLabel(preset)} becomes about {workerUnits(preset)} ownership units, once the organizer accepts it.
        </p>
      ) : null}
      <ActionBar>
        <Button
          size="lg"
          variant="work"
          className="w-full"
          disabled={!preset}
          onClick={save}
        >
          {preset ? "Log this work" : "Choose the work"}
        </Button>
      </ActionBar>
    </div>
  );
}

export function LoggedScreen({ id }: { id: string }) {
  const demo = useDemo();
  const project = getProject(id);
  const contribution = demo.contributions.find((item) => item.projectId === id);

  if (!demo.ready) return <PageBusy />;
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
      <SavedMark label="Saved on this phone" />
      <p className="text-3xl font-semibold">{workPresetLabel(contribution.preset)}</p>
      <p className="text-lg leading-relaxed">
        About {workerUnits(contribution.preset)} ownership units, waiting on the organizer.
      </p>
      <NextSteps
        items={[
          "Your work is saved on this phone.",
          "The organizer reviews it.",
          "If they accept it, it turns into ownership units.",
        ]}
      />
      <ActionBar>
        <Link href="/you/ownership" className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}>
          See your ownership units
        </Link>
      </ActionBar>
    </div>
  );
}
