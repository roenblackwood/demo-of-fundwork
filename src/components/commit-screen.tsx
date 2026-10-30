"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { ActionBar, MoneyText, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { canStillCommit, commitChoices } from "@/lib/catalog";
import { SendCapital } from "@/components/send-capital";
import { COMMIT_LINE, moneyNote, savedLabel } from "@/lib/copy";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { firstName } from "@/lib/format";
import { isLive } from "@/lib/mode";
import { investorUnits, moneyStillOpen, projectCommitted } from "@/lib/ownership";
import { currencyOf } from "@/lib/seed";

export function CommitScreen({ id }: { id: string }) {
  const router = useRouter();
  const demo = useDemo();
  const project = demo.projects.find((item) => item.id === id);
  const [amount, setAmount] = useState<number | null>(null);
  const learnHref = `/learn/investor?next=${encodeURIComponent(`/projects/${id}/commit`)}`;

  useEffect(() => {
    if (!demo.ready || demo.investorBasicsDone) return;
    router.replace(learnHref);
  }, [demo.ready, demo.investorBasicsDone, learnHref, router]);

  if (!demo.ready || !demo.investorBasicsDone) return <PageBusy />;
  if (!project) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/invest" />
        <p className="text-lg">This project is not on this phone.</p>
      </div>
    );
  }

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
  const hasProjectWallet = demo.projectWallets.some((item) => item.projectId === project.id);

  async function save() {
    if (!project || !amount || demo.saving) return;
    const ok = await demo.addCommitment({
      id: crypto.randomUUID(),
      userId: demo.userId,
      projectId: project.id,
      amountJmd: amount,
      status: "pledged",
      createdAt: new Date().toISOString(),
    });
    if (!ok) return;
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
          <div className="space-y-1">
            <p className="text-lg font-semibold leading-snug">
              {firstName(demo.name)}, this is high risk. You could lose all of this money.
            </p>
            <Link href={learnHref} className="inline-flex min-h-11 items-center font-semibold text-primary">
              Read the risks again
            </Link>
          </div>
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
                  <span className="block">
                    <MoneyText amount={preset} currency={currency} />
                  </span>
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
      {open ? (
        <p className="text-base text-muted-foreground">{moneyNote()}</p>
      ) : null}
      {amount ? (
        <p className="text-lg leading-relaxed">
          <MoneyText amount={amount} currency={currency} /> becomes about {units} ownership units,{" "}
          {hasProjectWallet ? "once a confirmed payment covers it." : "once the organizer accepts it."}
        </p>
      ) : null}
      {open ? (
        <ActionBar>
          {/* In demo mode the first commitment is saved right away. Live mode holds the first commitment of a new account for 24 hours before it counts. */}
          {isLive() && demo.commitments.length === 0 ? (
            <p className="text-base leading-snug">
              This is your first one. We hold it for 24 hours so you can think it over.
            </p>
          ) : null}
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            disabled={!amount || demo.saving}
            aria-busy={demo.saving}
            onClick={() => void save()}
          >
            Commit
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            Not now
          </Button>
        </ActionBar>
      ) : null}
    </div>
  );
}

export function CommittedScreen({ id }: { id: string }) {
  const demo = useDemo();
  const project = demo.projects.find((item) => item.id === id);
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
  const hasProjectWallet = isLive() && demo.projectWallets.some((item) => item.projectId === project.id);
  const savedLine = isLive() ? "Your commitment is saved." : "Your commitment is saved on this phone.";

  return (
    <div className="space-y-6">
      <StepHeader backHref="/you" title="You committed" hint={project.name} />
      <SavedMark label={savedLabel()} />
      <p className="text-3xl font-semibold">
        <MoneyText amount={commitment.amountJmd} currency={currency} />
      </p>
      <p className="text-lg leading-relaxed">
        {hasProjectWallet
          ? `About ${units} ownership units, once a confirmed payment covers this phase.`
          : `About ${units} ownership units, waiting on the organizer.`}
      </p>
      <NextSteps
        items={
          hasProjectWallet
            ? [
                savedLine,
                "Send the coins yourself to the project address.",
                "It counts when the confirmed amount covers this phase.",
              ]
            : [
                savedLine,
                "The organizer reviews it.",
                "If they accept it, it becomes ownership units.",
              ]
        }
      />
      <SendCapital projectId={project.id} pledge={commitment.amountJmd} />
      <ActionBar>
        <Link href="/you" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          See my commitments
        </Link>
      </ActionBar>
    </div>
  );
}
