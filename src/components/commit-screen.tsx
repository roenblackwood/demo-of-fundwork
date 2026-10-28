"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { ActionBar, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { canStillCommit, commitChoices } from "@/lib/catalog";
import { COMMIT_LINE } from "@/lib/copy";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { money } from "@/lib/format";
import { investorUnits, moneyStillOpen, projectCommitted } from "@/lib/ownership";
import { currencyOf, getProject } from "@/lib/seed";

export function CommitScreen({ id }: { id: string }) {
  const router = useRouter();
  const demo = useDemo();
  const project = getProject(id);
  const [amount, setAmount] = useState<number | null>(null);

  if (!demo.ready) return <PageBusy />;
  if (!project) return null;

  const committed = projectCommitted(
    project.committedJmd,
    demo.addedCommitments,
    project.id,
  );
  const stillOpen = moneyStillOpen(project.goalJmd, committed);
  const currency = currencyOf(project.countryId);
  const choices = commitChoices(project.goalJmd, currency);
  const open = canStillCommit(stillOpen, project.goalJmd, currency);
  const units = amount ? investorUnits(amount, project.goalJmd) : 0;

  function save() {
    if (!project || !amount) return;
    demo.addCommitment({
      id: crypto.randomUUID(),
      userId: demo.userId,
      projectId: project.id,
      amountJmd: amount,
      status: "pledged",
      createdAt: new Date().toISOString(),
    });
    router.push(`/projects/${project.id}/committed`);
  }

  return (
    <div className="space-y-6">
      <StepHeader
        backHref={`/projects/${project.id}`}
        title="How much?"
        hint={project.name}
      />
      <p className="text-lg leading-relaxed">{COMMIT_LINE}</p>
      {!open ? (
        <p className="text-lg">The money they asked for is already in.</p>
      ) : (
        <div className="space-y-3">
          {choices.map((preset) => {
            const tooMuch = preset > stillOpen;
            const selected = amount === preset;
            return (
              <button
                key={preset}
                type="button"
                disabled={tooMuch}
                aria-pressed={selected}
                onClick={() => setAmount(preset)}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold",
                  selected
                    ? "border-primary bg-secondary text-secondary-foreground"
                    : "border-border bg-card",
                  tooMuch && "opacity-60",
                )}
              >
                <span>
                  <span className="block">{money(preset, currency)}</span>
                  {tooMuch ? (
                    <span className="mt-1 block text-base font-normal">
                      More than what is still open
                    </span>
                  ) : null}
                </span>
                {selected ? <Check className="size-6 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      )}
      {amount ? (
        <p className="text-lg leading-relaxed">
          {money(amount, currency)} becomes about {units} ownership units, once the organizer accepts it.
        </p>
      ) : null}
      {open ? (
        <ActionBar>
          <Button size="lg" className="w-full" disabled={!amount} onClick={save}>
            {amount ? `Commit ${money(amount, currency)}` : "Choose an amount"}
          </Button>
        </ActionBar>
      ) : null}
    </div>
  );
}

export function CommittedScreen({ id }: { id: string }) {
  const demo = useDemo();
  const project = getProject(id);
  const commitment = demo.commitments.find((item) => item.projectId === id);

  if (!demo.ready) return <PageBusy />;
  if (!project || !commitment) {
    return (
      <div>
        <StepHeader backHref={`/projects/${id}`} title="No commitment saved" />
      </div>
    );
  }

  const units = investorUnits(commitment.amountJmd, project.goalJmd);
  const currency = currencyOf(project.countryId);

  return (
    <div className="space-y-6">
      <StepHeader backHref="/you" title="You committed" hint={project.name} />
      <SavedMark label="Saved on this phone" />
      <p className="text-3xl font-semibold">{money(commitment.amountJmd, currency)}</p>
      <p className="text-lg leading-relaxed">
        About {units} ownership units, waiting on the organizer.
      </p>
      <NextSteps
        items={[
          "Your commitment is saved on this phone.",
          "The organizer reviews it.",
          "If they accept it, it becomes ownership units.",
        ]}
      />
      <ActionBar>
        <Link href="/you" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          See my commitments
        </Link>
      </ActionBar>
    </div>
  );
}
