"use client";

import { useEffect, useState } from "react";
import { amountsFor, phasesFor, splitPledge } from "@/lib/capital";
import { sectionTitle } from "@/components/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDemo } from "@/lib/demo-store";

export function PhasePlan({ projectId }: { projectId: string }) {
  const demo = useDemo();
  const project = demo.projects.find((item) => item.id === projectId);
  const show = Boolean(project?.kind) || Object.keys(project?.readiness ?? {}).length > 0;
  const organizing = project?.organizerId === demo.userId;

  useEffect(() => {
    if (!organizing || !show) return;
    demo.rememberPhaseBaseline(projectId);
  }, [demo, organizing, projectId, show]);

  if (!project || !organizing || !show) return null;

  return <Editor projectId={project.id} />;
}

function Editor({ projectId }: { projectId: string }) {
  const demo = useDemo();
  const project = demo.projects.find((item) => item.id === projectId);
  const pledge =
    demo.commitments.find((item) => item.projectId === projectId && item.userId === demo.userId && item.status === "pledged") ??
    demo.addedCommitments.find((item) => item.projectId === projectId && item.status === "pledged");
  const phases = project ? phasesFor(project) : ["Start"];
  const amounts =
    pledge && project?.phaseShares && project.phaseShares.length === phases.length
      ? amountsFor(pledge.amountJmd, project.phaseShares)
      : pledge
        ? splitPledge(pledge.amountJmd, phases).map((row) => row.amount)
        : phases.map(() => 0);
  const [values, setValues] = useState(() => amounts.map((amount) => String(amount)));
  const [note, setNote] = useState("");
  if (!project) return null;

  function save() {
    const shares = values.map((value) => Math.round(Number(value.replace(/,/g, ""))));
    const ok = demo.savePhaseSplit({ projectId, shares });
    setNote(ok ? "Saved." : "The split is fixed once work has started.");
  }

  function markDone() {
    const ok = demo.markPhaseDone(projectId);
    setNote(ok ? "This phase is done. The next one is open." : "Update a readiness item, then mark this phase done.");
  }

  return (
    <section className="space-y-3">
      <h2 className={sectionTitle}>How the money is split</h2>
      <p className="text-lg">The first phase takes 40 percent unless you change it. You can change it before work starts.</p>
      {pledge ? (
        phases.map((phase, index) => (
          <label key={`${index}-${phase}`} className="block space-y-1">
            <span className="font-semibold">{phase}</span>
            <Input
              value={values[index] ?? ""}
              inputMode="numeric"
              disabled={project.workStarted}
              aria-label={`${phase} amount`}
              onChange={(event) => {
                const next = [...values];
                next[index] = event.target.value;
                setValues(next);
              }}
            />
          </label>
        ))
      ) : (
        <p className="text-lg">No pledge yet.</p>
      )}
      {pledge ? (
        <Button type="button" variant="outline" disabled={project.workStarted} onClick={save}>
          Save the split
        </Button>
      ) : null}
      <Button type="button" onClick={markDone}>
        Mark this phase done
      </Button>
      {note ? <p className="text-lg">{note}</p> : null}
    </section>
  );
}
