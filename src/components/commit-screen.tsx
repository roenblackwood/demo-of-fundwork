"use client";

import { useState } from "react";
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
import { capitalReserved, investorUnits, moneyStillOpen } from "@/lib/ownership";
import { convertedBacking } from "@/lib/pledges";
import { currencyOf } from "@/lib/seed";
import { useProfileGate } from "@/components/profile-gate";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CommitScreen({ id }: { id: string }) {
  const router = useRouter();
  const demo = useDemo();
  const allowed = useProfileGate();
  const project = demo.projects.find((item) => item.id === id);
  const [amount, setAmount] = useState<number | null>(null);
  const nameKey = `${demo.userId}:${demo.profile.showName ? "1" : "0"}`;
  const [showName, setShowName] = useState(demo.profile.showName);
  const [shownFor, setShownFor] = useState(nameKey);
  if (shownFor !== nameKey) {
    setShownFor(nameKey);
    setShowName(demo.profile.showName);
  }
  const learnHref = `/learn/investor?next=${encodeURIComponent(`/projects/${id}/commit`)}`;
  const needsRange = demo.profile.minUsd === null && demo.profile.maxUsd === null;
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [rangeNote, setRangeNote] = useState("");

  if (!demo.ready || !allowed) return <PageBusy />;
  if (!project) {
    return (
      <div className="space-y-4">
        <StepHeader backHref="/invest" />
        <p className="text-lg">This project is not on this phone.</p>
      </div>
    );
  }

  const reserved = Math.max(
    capitalReserved(project.committedJmd, demo.addedCommitments, project.id),
    convertedBacking(project.id, demo.requests, demo.pledges),
  );
  const stillOpen = moneyStillOpen(project.goalJmd, reserved);
  const currency = currencyOf(project.countryId);
  const choices = commitChoices(project.goalJmd, currency);
  const open = canStillCommit(stillOpen, project.goalJmd, currency);
  const units = amount ? investorUnits(amount, project.goalJmd) : 0;
  const hasProjectWallet = demo.projectWallets.some((item) => item.projectId === project.id);

  function saveRange(skip: boolean) {
    if (skip) {
      void demo.savePersonProfile({ ...demo.profile, minUsd: 0, maxUsd: 0 });
      return;
    }
    const min = Number(low.replace(/[^\d]/g, ""));
    const max = Number(high.replace(/[^\d]/g, ""));
    if (!low.trim() || !high.trim() || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      setRangeNote("Enter both amounts, or skip.");
      return;
    }
    void demo.savePersonProfile({ ...demo.profile, minUsd: min, maxUsd: max });
  }

  async function save() {
    if (!project || !amount || demo.saving) return;
    const ok = await demo.addCommitment({
      id: crypto.randomUUID(),
      userId: demo.userId,
      projectId: project.id,
      amountJmd: amount,
      status: "pledged",
      createdAt: new Date().toISOString(),
      showName,
    });
    if (!ok) return;
    router.push(`/projects/${project.id}/committed`);
  }

  return (
    <div className="space-y-6">
      <StepHeader
        backHref={`/projects/${project.id}`}
        title={needsRange ? "What do you usually put in?" : "How much?"}
        hint={project.name}
      />
      {needsRange ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="range-low">From, US$</Label>
            <Input id="range-low" inputMode="numeric" value={low} onChange={(event) => setLow(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="range-high">Up to, US$</Label>
            <Input id="range-high" inputMode="numeric" value={high} onChange={(event) => setHigh(event.target.value)} />
          </div>
          {rangeNote ? <p className="text-base">{rangeNote}</p> : null}
          <Button type="button" size="lg" className="w-full" onClick={() => saveRange(false)}>
            Save
          </Button>
          <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => saveRange(true)}>
            Skip
          </Button>
        </div>
      ) : null}
      {needsRange ? null : <p className="text-lg leading-relaxed">{COMMIT_LINE}</p>}
      {needsRange ? null : !open ? (
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
      {!needsRange && open ? (
        <p className="text-base text-muted-foreground">{moneyNote()}</p>
      ) : null}
      {amount ? (
        <p className="text-lg leading-relaxed">
          <MoneyText amount={amount} currency={currency} /> becomes about {units} ownership units,{" "}
          {hasProjectWallet ? "once a confirmed payment covers it." : "once the organizer accepts it."}
        </p>
      ) : null}
      {!needsRange && open ? (
        <ActionBar>
          {/* In demo mode the first commitment is saved right away. Live mode holds the first commitment of a new account for 24 hours before it counts. */}
          {isLive() && demo.commitments.length === 0 ? (
            <p className="text-base leading-snug">
              This is your first one. We hold it for 24 hours so you can think it over.
            </p>
          ) : null}
          <label className="flex min-h-11 items-center gap-3 text-base">
            <input
              type="checkbox"
              className="size-5"
              checked={showName}
              onChange={(event) => setShowName(event.target.checked)}
            />
            Show my name on projects I back
          </label>
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
