"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { ActionBar, CapitalChip, MoneyText, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WhatItTakes } from "@/components/guide-card";
import { SECTORS, SKILLS, isSector, requestBudgets, sectorTitle, skillPhrase, skillsForSector } from "@/lib/catalog";
import { cn } from "cn";
import { savedLabel } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { currencyOf, getCity, getCountry, getParish, getTown, requestPlace } from "@/lib/seed";
import type { Sector, Skill } from "@/lib/types";

type Step = "sector" | "budget" | "workers" | "skills" | "note" | "review" | "posted";

const choiceClass =
  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold shadow-sm";

export function StartRequestScreen({ placeId, townId }: { placeId: string; townId: string }) {
  const demo = useDemo();
  const show = useSnackbar();
  const parish = getParish(placeId);
  const countryId = parish ? "jamaica" : placeId;
  const parishId = parish?.id ?? null;
  const town = parish ? getTown(placeId, townId) : getCity(placeId, townId);
  const where = requestPlace({ countryId, parishId, townId });
  const place = where ? placeLine(where.town, where.parish) : "";
  const currency = currencyOf(countryId);
  const budgets = requestBudgets(currency);
  const sectorQuery = useSearchParams().get("sector");
  const presetSector = sectorQuery && isSector(sectorQuery) ? sectorQuery : null;
  const [step, setStep] = useState<Step>(presetSector ? "budget" : "sector");
  const [sector, setSector] = useState<Sector | null>(presetSector);
  const [budget, setBudget] = useState<number | null>(null);
  const [workersNeeded, setWorkersNeeded] = useState<number | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [note, setNote] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (step === "review") {
      document.getElementById("review-capital")?.scrollIntoView({ block: "center" });
      return;
    }
    window.scrollTo(0, 0);
  }, [step]);

  if (!town || !where) return null;
  if (!demo.ready) return <PageBusy />;

  const backPlace = `/invest/start/${placeId}`;

  function toggleSkill(skill: Skill) {
    setSkills((current) => {
      if (current.includes(skill)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== skill);
      }
      return [...current, skill];
    });
  }

  async function post() {
    if (!sector || !budget || !workersNeeded || skills.length === 0 || !note.trim() || demo.saving) return;
    const id = await demo.addRequest({
      countryId,
      parishId,
      townId,
      sector,
      budget,
      workersNeeded,
      skills,
      note,
    });
    if (!id) return;
    show("Request posted.");
    setSavedId(id);
    setStep("posted");
  }

  if (step === "posted" && savedId) {
    return (
      <div className="space-y-6">
        <StepHeader backHref={`/requests/${savedId}`} title="You posted a request" hint={place} />
        <SavedMark label={savedLabel()} />
        <CapitalChip />
        <p className="text-lg leading-relaxed">
          <MoneyText amount={budget ?? 0} currency={currency} /> for {workersNeeded} workers in {place}.
        </p>
        <NextSteps
          items={[
            "Workers near this place can apply.",
            "You accept the ones you want.",
            "When the team is full, the request says the team is ready.",
          ]}
        />
        <ActionBar>
          <Link href={`/requests/${savedId}`} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
            See the request
          </Link>
        </ActionBar>
      </div>
    );
  }

  if (step === "review" && sector && budget && workersNeeded) {
    return (
      <div className="space-y-6">
        <StepHeader onBack={() => setStep("note")} backHref={backPlace} title="Review" hint={place} />
        <p className="text-lg font-semibold text-primary">{sectorTitle(sector)}</p>
        <p className="text-2xl font-bold">
          <MoneyText amount={budget} currency={currency} />
        </p>
        <p className="text-lg">{workersNeeded} workers needed</p>
        <p className="text-lg">Needs {skills.map((skill) => skillPhrase(skill)).join(", ")}.</p>
        <p className="text-lg leading-relaxed">{note.trim()}</p>
        <div id="review-capital">
          <CapitalChip />
        </div>
        <WhatItTakes
          countryId={countryId}
          countryName={getCountry(countryId)?.name ?? "this country"}
          sector={sector}
          placeName={town.name}
          projects={demo.projects}
        />
        <ActionBar>
          <Button size="lg" className="w-full" disabled={demo.saving} aria-busy={demo.saving} onClick={() => void post()}>
            Post this request
          </Button>
        </ActionBar>
      </div>
    );
  }

  if (step === "note") {
    return (
      <div className="space-y-6">
        <StepHeader onBack={() => setStep("skills")} backHref={backPlace} title="A short note" hint={place} />
        <div className="space-y-2">
          <Label htmlFor="request-note">What do you want to start?</Label>
          <textarea
            id="request-note"
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-base text-muted-foreground">{note.length} of 240</p>
        </div>
        <ActionBar>
          <Button size="lg" className="w-full" disabled={!note.trim()} onClick={() => setStep("review")}>
            Review
          </Button>
        </ActionBar>
      </div>
    );
  }

  if (step === "skills") {
    return (
      <div className="space-y-6">
        <StepHeader
          onBack={() => setStep("workers")}
          backHref={backPlace}
          title="What skills do you need?"
          hint={place}
        />
        <div className="space-y-3">
          {SKILLS.map((skill) => {
            const on = skills.includes(skill.id);
            return (
              <button
                key={skill.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSkill(skill.id)}
                className={cn(choiceClass, on ? "border-primary bg-secondary" : "border-border bg-card")}
              >
                <span>
                  <span className="block">{skill.title}</span>
                  <span className="mt-1 block text-base font-normal text-muted-foreground">{skill.detail}</span>
                </span>
                {on ? <Check className="size-6 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        <ActionBar>
          <Button size="lg" className="w-full" disabled={skills.length === 0} onClick={() => setStep("note")}>
            Continue
          </Button>
        </ActionBar>
      </div>
    );
  }

  if (step === "workers") {
    return (
      <div className="space-y-6">
        <StepHeader
          onBack={() => setStep("budget")}
          backHref={backPlace}
          title="How many workers?"
          hint={place}
        />
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
            <button
              key={count}
              type="button"
              aria-pressed={workersNeeded === count}
              onClick={() => setWorkersNeeded(count)}
              className={cn(
                "min-h-14 rounded-2xl border-2 text-lg font-semibold",
                workersNeeded === count ? "border-primary bg-secondary" : "border-border bg-card",
              )}
            >
              {count}
            </button>
          ))}
        </div>
        <ActionBar>
          <Button
            size="lg"
            className="w-full"
            disabled={!workersNeeded}
            onClick={() => setStep("skills")}
          >
            Continue
          </Button>
        </ActionBar>
      </div>
    );
  }

  if (step === "budget") {
    return (
      <div className="space-y-6">
        <StepHeader onBack={() => setStep("sector")} backHref={backPlace} title="How much capital?" hint={place} />
        <div className="space-y-3">
          {budgets.map((amount) => {
            const selected = budget === amount;
            return (
              <button
                key={amount}
                type="button"
                aria-pressed={selected}
                onClick={() => setBudget(amount)}
                className={cn(choiceClass, selected ? "border-primary bg-secondary" : "border-border bg-card")}
              >
                <span>
                  <MoneyText amount={amount} currency={currency} />
                </span>
                {selected ? <Check className="size-6 shrink-0 text-primary" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        <ActionBar>
          <Button size="lg" className="w-full" disabled={!budget} onClick={() => setStep("workers")}>
            Continue
          </Button>
        </ActionBar>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref={backPlace} title="What kind of project?" hint={place} />
      <div className="space-y-3">
        {SECTORS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSector(item.id);
              setSkills(skillsForSector(item.id));
              setStep("budget");
            }}
            className={cn(choiceClass, "border-border bg-card")}
          >
            <span>
              <span className="block">{item.title}</span>
              <span className="mt-1 block text-base font-normal text-muted-foreground">{item.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
