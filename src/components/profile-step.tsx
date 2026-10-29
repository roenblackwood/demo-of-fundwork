"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ActionBar, LearnMore, StepHeader, sectionTitle } from "@/components/parts";
import { buttonVariants } from "@/components/ui/button";
import { proofTip } from "@/lib/ai";
import { skillTitle } from "@/lib/catalog";
import { SKILLS } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { FLOW_STEPS } from "@/lib/regions";
import { getCity, getCountry, getParish, getTown } from "@/lib/seed";
import type { Skill } from "@/lib/types";

export function ProfileStep({
  placeId,
  townId,
  skill,
}: {
  placeId: string;
  townId: string;
  skill: Skill;
}) {
  const { ready, updateFlow, flow, proof, proofLabel, setProof } = useDemo();
  const parish = getParish(placeId);
  const country = parish ? undefined : getCountry(placeId);
  const town = parish ? getTown(placeId, townId) : getCity(placeId, townId);
  const tip = proofTip(skill);
  const [message, setMessage] = useState("");
  const areaName = parish?.name ?? country?.name;

  useEffect(() => {
    if (!ready || !town) return;
    updateFlow({
      countryId: parish ? "jamaica" : country?.id,
      parishId: parish?.id,
      townId,
      skill,
    });
  }, [ready, country?.id, parish, placeId, town, townId, skill, updateFlow]);

  if ((!parish && !country) || !town) return null;

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose a photo.");
      return;
    }
    if (file.size > 800_000) {
      setProof({ fileName: file.name, dataUrl: null, tooBig: true });
      setMessage("That photo is large. We saved the name only in this demo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProof({
        fileName: file.name,
        dataUrl: typeof reader.result === "string" ? reader.result : null,
        tooBig: false,
      });
      setMessage("");
    };
    reader.readAsDataURL(file);
  }

  function toggleExtra(extra: Skill) {
    const current = flow?.extraSkills ?? [];
    const next = current.includes(extra)
      ? current.filter((item) => item !== extra)
      : [...current, extra];
    updateFlow({ extraSkills: next.filter((item) => item !== skill) });
  }

  const extras = (flow?.extraSkills ?? []).filter((item) => item !== skill);

  return (
    <div>
      <StepHeader
        backHref={`/work/place/${placeId}/${town.id}`}
        step={parish ? 5 : 4}
        total={parish ? FLOW_STEPS : 4}
        title="Show your work"
        hint={`${skillTitle(skill)} in ${town.name}${areaName ? `, ${areaName}` : ""}`}
      />
      <div className="space-y-6">
        <p className="text-lg leading-relaxed">
          You picked {skillTitle(skill).toLowerCase()}. A photo helps people trust you. You can add it now or later.
        </p>
        <details className="rounded-2xl border bg-card">
          <summary className="flex min-h-14 cursor-pointer items-center px-4 py-3 text-lg font-semibold">
            Add another skill
          </summary>
          <div className="space-y-2 px-4 pb-4">
            {SKILLS.filter((item) => item.id !== skill).map((item) => {
              const selected = extras.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleExtra(item.id)}
                  className={cn(
                    "min-h-12 w-full rounded-xl border-2 px-4 text-left text-base font-semibold",
                    selected
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  {item.title}
                </button>
              );
            })}
          </div>
        </details>
        <section className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className={sectionTitle}>{tip.title}</h2>
          <p className="text-base leading-relaxed">{tip.body}</p>
          {proof?.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={proof.dataUrl}
              alt="The photo you added"
              className="max-h-56 w-full rounded-xl object-cover"
            />
          ) : null}
          {proof && !proof.dataUrl ? (
            <p className="font-semibold">Photo added: {proof.fileName}</p>
          ) : null}
          {!proof && proofLabel ? (
            <p className="font-semibold">{proofLabel}</p>
          ) : null}
          {message ? <p>{message}</p> : null}
          <label
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full cursor-pointer",
            )}
          >
            {proof || proofLabel ? "Add another photo" : "Add a photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onFile}
            />
          </label>
        </section>
        <LearnMore title="Why a photo matters">
          <p>
            People deciding who to trust look for recent work they can see. A clear photo is enough for this demo. It stays on this phone.
          </p>
        </LearnMore>
        <ActionBar>
          <Link
            href="/work"
            className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
          >
            See work for me
          </Link>
        </ActionBar>
      </div>
    </div>
  );
}
