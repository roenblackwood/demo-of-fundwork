"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/lib/demo-store";
import { weekGoals } from "@/lib/lessons";
import type { Project } from "@/lib/types";
import type { WeekPlan } from "@/lib/progress";

export function ThisWeekCard({ project }: { project: Project }) {
  const demo = useDemo();
  const open = demo.weeks.find((week) => week.projectId === project.id && week.status === "open");
  const history = demo.weeks.filter((week) => week.projectId === project.id && week.status !== "open");
  const suggestions = weekGoals(project.sector, project.workStarted);

  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10" aria-label="This week">
      <h2 className="text-lg font-semibold">This week</h2>
      {open ? (
        <OpenWeek week={open} />
      ) : (
        <PickWeek projectId={project.id} suggestions={suggestions} />
      )}
      {history.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-base font-semibold">Earlier weeks</h3>
          {history.map((week) => (
            <p key={week.id} className="text-base leading-snug">
              {week.goal} {week.status === "done" ? "Done." : "Not done."} {week.happened}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function ThisWeekNeed({ project }: { project: Project }) {
  const demo = useDemo();
  const open = demo.weeks.find((week) => week.projectId === project.id && week.status === "open");
  return (
    <article className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <h3 className="text-lg font-semibold">This week</h3>
      <p className="text-base">{project.name}</p>
      <p className="text-base leading-snug">{open ? open.goal : "Pick one goal for this week."}</p>
      <Link href={`/projects/${project.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary">
        Open the project
      </Link>
    </article>
  );
}

function PickWeek({ projectId, suggestions }: { projectId: string; suggestions: string[] }) {
  const demo = useDemo();
  const [goal, setGoal] = useState(suggestions[0] ?? "");
  const [custom, setCustom] = useState("");
  const [stepOne, setStepOne] = useState("");
  const [stepTwo, setStepTwo] = useState("");

  function choose(next: string) {
    setGoal(next);
    setCustom("");
  }

  function save() {
    const picked = custom.trim() || goal.trim();
    if (!picked || !stepOne.trim() || !stepTwo.trim() || demo.saving) return;
    demo.saveWeek({ projectId, goal: picked, stepOne, stepTwo });
  }

  return (
    <div className="space-y-3">
      <p className="text-base leading-snug">Pick one goal for this week.</p>
      <div className="flex flex-col gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={goal === item && !custom.trim()}
            onClick={() => choose(item)}
            className="min-h-11 rounded-2xl border-2 border-border bg-background px-3 py-2 text-left text-base font-semibold aria-pressed:border-primary aria-pressed:bg-secondary"
          >
            {item}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`week-own-${projectId}`}>Or write your own</Label>
        <Input
          id={`week-own-${projectId}`}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`week-step-1-${projectId}`}>Step 1</Label>
        <Input
          id={`week-step-1-${projectId}`}
          value={stepOne}
          onChange={(event) => setStepOne(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`week-step-2-${projectId}`}>Step 2</Label>
        <Input
          id={`week-step-2-${projectId}`}
          value={stepTwo}
          onChange={(event) => setStepTwo(event.target.value)}
        />
      </div>
      <Button type="button" size="lg" className="w-full" onClick={save} disabled={!stepOne.trim() || !stepTwo.trim() || !(custom.trim() || goal.trim())}>
        Save this week
      </Button>
    </div>
  );
}

function OpenWeek({ week }: { week: WeekPlan }) {
  const demo = useDemo();
  const [happened, setHappened] = useState("");

  function close(status: "done" | "not-done") {
    if (!happened.trim() || demo.saving) return;
    demo.closeWeek({ id: week.id, status, happened });
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold leading-snug">{week.goal}</p>
      <p className="text-base leading-snug">1. {week.stepOne}</p>
      <p className="text-base leading-snug">2. {week.stepTwo}</p>
      <p className="text-base text-muted-foreground">Next week, say if you did it.</p>
      <div className="space-y-2">
        <Label htmlFor={`week-happened-${week.id}`}>What happened?</Label>
        <Input
          id={`week-happened-${week.id}`}
          value={happened}
          onChange={(event) => setHappened(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Button type="button" size="lg" className="w-full" disabled={!happened.trim()} onClick={() => close("done")}>
          Done
        </Button>
        <Button type="button" size="lg" variant="outline" className="w-full" disabled={!happened.trim()} onClick={() => close("not-done")}>
          Not done
        </Button>
      </div>
    </div>
  );
}
