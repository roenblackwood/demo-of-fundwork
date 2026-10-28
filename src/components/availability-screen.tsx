"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { ActionBar, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SKILLS, skillPhrase } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { placeLine } from "@/lib/format";
import { getCity, getParish, getTown, requestPlace } from "@/lib/seed";
import type { Skill } from "@/lib/types";

type Step = "skills" | "note" | "posted";

const choiceClass =
  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold shadow-sm";

export function AvailabilityScreen({ placeId, townId }: { placeId: string; townId: string }) {
  const demo = useDemo();
  const show = useSnackbar();
  const parish = getParish(placeId);
  const countryId = parish ? "jamaica" : placeId;
  const parishId = parish?.id ?? null;
  const town = parish ? getTown(placeId, townId) : getCity(placeId, townId);
  const where = requestPlace({ countryId, parishId, townId });
  const place = where ? placeLine(where.town, where.parish) : "";
  const [step, setStep] = useState<Step>("skills");
  const [picked, setPicked] = useState<Skill[] | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (!town || !where) return null;
  if (!demo.ready) return <PageBusy />;

  const primary = demo.flow?.skill || demo.homeSkill;
  const extras = demo.flow?.skill ? demo.flow.extraSkills : demo.homeExtraSkills;
  const profile = [...new Set([primary, ...extras].filter((item): item is Skill => Boolean(item)))];
  const skills = picked ?? profile;
  const backPlace = `/work/available/${placeId}`;

  function toggleSkill(skill: Skill) {
    setPicked((current) => {
      const base = current ?? profile;
      if (base.includes(skill)) {
        if (base.length === 1) return base;
        return base.filter((item) => item !== skill);
      }
      return [...base, skill];
    });
  }

  function post() {
    if (skills.length === 0) return;
    const id = demo.addAvailability({
      countryId,
      parishId,
      townId,
      skills,
      note,
    });
    if (!id) return;
    show("You are listed as available.");
    setSaved(true);
    setStep("posted");
  }

  if (step === "posted" && saved) {
    return (
      <div className="space-y-6">
        <StepHeader backHref="/you" title="You are available" hint={place} />
        <SavedMark label="Saved on this phone" />
        <p className="text-lg leading-relaxed">
          You can do {skills.map((skill) => skillPhrase(skill)).join(", ")} in {place}.
        </p>
        <NextSteps
          items={[
            "Investors near this place can invite you.",
            "You can still apply to open requests.",
          ]}
        />
        <ActionBar>
          <Link href="/you" className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}>
            See your availability
          </Link>
        </ActionBar>
      </div>
    );
  }

  if (step === "note") {
    return (
      <div className="space-y-6">
        <StepHeader onBack={() => setStep("skills")} backHref={backPlace} title="A short note" hint={place} />
        <div className="space-y-2">
          <Label htmlFor="available-note">What can you do here?</Label>
          <textarea
            id="available-note"
            value={note}
            maxLength={240}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-28 w-full rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <p className="text-base text-muted-foreground">{note.length} of 240</p>
        </div>
        <ActionBar>
          <Button variant="work" size="lg" className="w-full" onClick={post}>
            Post
          </Button>
        </ActionBar>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader backHref={backPlace} title="What work can you do?" hint={place} />
      <div className="space-y-3">
        {SKILLS.map((skill) => {
          const on = skills.includes(skill.id);
          return (
            <button
              key={skill.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggleSkill(skill.id)}
              className={cn(choiceClass, on ? "border-work bg-secondary" : "border-border bg-card")}
            >
              <span>
                <span className="block">{skill.title}</span>
                <span className="mt-1 block text-base font-normal text-muted-foreground">{skill.detail}</span>
              </span>
              {on ? <Check className="size-6 shrink-0 text-work" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
      <ActionBar>
        <Button
          variant="work"
          size="lg"
          className="w-full"
          disabled={skills.length === 0}
          onClick={() => setStep("note")}
        >
          Continue
        </Button>
      </ActionBar>
    </div>
  );
}
