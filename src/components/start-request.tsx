"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { WhatThisNeeds } from "@/components/needs-panel";
import { ActionBar, CapitalChip, MoneyText, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatItTakes } from "@/components/guide-card";
import {
  defaultCounts,
  kindById,
  kindsFor,
  peopleCount,
  readinessFor,
  siteLabel,
  SITE_CHOICES,
  skillsFromCounts,
} from "@/lib/blueprints";
import { SECTORS, SKILLS, isSector, sectorTitle, skillPhrase, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { savedLabel } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { money, placeLine } from "@/lib/format";
import { priceRange } from "@/lib/guides";
import { aboutUsd } from "@/lib/rates";
import { currencyOf, getCity, getCountry, getParish, getTown, requestPlace } from "@/lib/seed";
import type { Readiness, ReadinessState, Sector, SiteStatus, Skill } from "@/lib/types";

type Step = "sector" | "kind" | "site" | "team" | "budget" | "note" | "review" | "posted";

const STEP_NUMBER: Record<Exclude<Step, "posted">, number> = {
  sector: 2,
  kind: 3,
  site: 4,
  team: 5,
  budget: 6,
  note: 7,
  review: 8,
};

const choiceClass =
  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold shadow-sm";

function readAmount(text: string): number | null {
  const cleaned = text.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

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
  const countryName = getCountry(countryId)?.name ?? "this country";
  const sectorQuery = useSearchParams().get("sector");
  const presetSector = sectorQuery && isSector(sectorQuery) ? sectorQuery : null;
  const [step, setStep] = useState<Step>(presetSector ? "kind" : "sector");
  const [sector, setSector] = useState<Sector | null>(presetSector);
  const [kindId, setKindId] = useState<string | null>(null);
  const [site, setSite] = useState<SiteStatus | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [budgetText, setBudgetText] = useState("");
  const [note, setNote] = useState("");
  const [readiness, setReadiness] = useState<Readiness>({});
  const [panelStep, setPanelStep] = useState<Step | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const kind = sector ? kindById(sector, kindId) : null;
  const amount = readAmount(budgetText);
  const workersNeeded = peopleCount(counts);
  const skills = skillsFromCounts(counts);

  const panelShown = panelStep === step ? panelOpen : step === "review";

  function togglePanel() {
    const showing = panelStep === step ? panelOpen : step === "review";
    setPanelStep(step);
    setPanelOpen(!showing);
  }

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
  const range = sector ? priceRange(countryId, sector, demo.projects) : null;
  const rangeLine = range
    ? `Other projects like this on Fundwork asked for ${money(range.low, currency)} to ${money(range.high, currency)}.`
    : null;
  const about = amount ? aboutUsd(amount, currency) : "";

  function chooseKind(id: string) {
    if (!sector) return;
    const next = kindById(sector, id);
    if (!next) return;
    setKindId(id);
    setCounts(defaultCounts(next));
  }

  function setSkillCount(skill: Skill, count: number) {
    setCounts((current) => {
      const next = { ...current };
      if (count < 1) delete next[skill];
      else next[skill] = count;
      return next;
    });
  }

  function toggleExtra(skill: Skill) {
    const on = (counts[skill] ?? 0) > 0;
    if (on) setSkillCount(skill, 0);
    else if (workersNeeded < 10) setSkillCount(skill, 1);
  }

  async function post() {
    if (!sector || !kind || !site || !amount || workersNeeded < 1 || workersNeeded > 10 || skills.length === 0) return;
    if (!note.trim() || demo.saving) return;
    const id = await demo.addRequest({
      countryId,
      parishId,
      townId,
      sector,
      budget: amount,
      workersNeeded,
      skills,
      note,
      kind: kind.id,
      site,
      readiness: readinessFor(kind, site, readiness),
    });
    if (!id) return;
    show("Request posted.");
    setSavedId(id);
    setStep("posted");
  }

  function insertHint(hint: string) {
    setNote((current) => {
      const next = current.trim() ? `${current.trim()} ${hint}` : hint;
      return next.slice(0, 240);
    });
  }

  const header = (title: string, onBack?: () => void) => (
    <StepHeader
      onBack={onBack}
      backHref={backPlace}
      step={STEP_NUMBER[step === "posted" ? "review" : step]}
      total={8}
      title={title}
      hint={place}
    />
  );

  const panel =
    kind && sector && step !== "posted" && step !== "sector" ? (
      <WhatThisNeeds
        countryId={countryId}
        countryName={countryName}
        sector={sector}
        kind={kind}
        site={site}
        counts={counts}
        open={panelShown}
        onToggle={togglePanel}
        choices={step === "review" ? readinessFor(kind, site, readiness) : null}
        onChoose={
          step === "review"
            ? (key, state: ReadinessState) =>
                setReadiness((current) => ({ ...readinessFor(kind, site, current), [key]: state }))
            : undefined
        }
      />
    ) : null;

  if (step === "posted" && savedId && amount) {
    return (
      <div className="space-y-6">
        <StepHeader backHref={`/requests/${savedId}`} title="You posted a request" hint={place} />
        <SavedMark label={savedLabel()} />
        <CapitalChip />
        <p className="text-lg leading-relaxed">
          <MoneyText amount={amount} currency={currency} /> for {workersNeeded} workers in {place}.
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

  let body: ReactNode = null;
  let action: ReactNode = null;

  if (step === "review" && sector && kind && site && amount && workersNeeded) {
    body = (
      <div className="space-y-6">
        <p className="text-lg font-semibold text-primary">
          {sectorTitle(sector)}. {kind.title}
        </p>
        <p className="text-lg">{siteLabel(site)}</p>
        <div>
          <p className="text-2xl font-bold">
            <MoneyText amount={amount} currency={currency} showAbout={false} />
          </p>
          {about ? <p className="text-base text-muted-foreground">{about}</p> : null}
        </div>
        <p className="text-lg">{workersNeeded} workers needed</p>
        <p className="text-lg">Needs {skills.map((skill) => skillPhrase(skill)).join(", ")}.</p>
        <p className="text-lg leading-relaxed">{note.trim()}</p>
        <div id="review-capital">
          <CapitalChip />
        </div>
      </div>
    );
    action = (
      <ActionBar>
        <Button size="lg" className="w-full" disabled={demo.saving} aria-busy={demo.saving} onClick={() => void post()}>
          Post this request
        </Button>
      </ActionBar>
    );
  } else if (step === "note" && kind) {
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {kind.noteHints.map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => insertHint(hint)}
              className="min-h-10 rounded-full border border-border bg-card px-3 text-left text-sm font-semibold"
            >
              {hint}
            </button>
          ))}
        </div>
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
      </div>
    );
    action = (
      <ActionBar>
        <Button size="lg" className="w-full" disabled={!note.trim()} onClick={() => setStep("review")}>
          Review
        </Button>
      </ActionBar>
    );
  } else if (step === "budget" && kind) {
    body = (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="request-budget">Amount in {currency}</Label>
          <Input
            id="request-budget"
            inputMode="decimal"
            value={budgetText}
            onChange={(event) => setBudgetText(event.target.value)}
            placeholder="6,000,000"
          />
          {about ? <p className="text-base text-muted-foreground">{about}</p> : null}
        </div>
        {rangeLine ? <p className="text-lg leading-relaxed">{rangeLine}</p> : null}
        <div className="space-y-2">
          <p className="text-lg">Your budget should cover these.</p>
          <ul className="flex flex-wrap gap-2">
            {kind.spend.map((item) => (
              <li
                key={item}
                className="inline-flex min-h-8 items-center rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
    action = (
      <ActionBar>
        <Button size="lg" className="w-full" disabled={!amount} onClick={() => setStep("note")}>
          Continue
        </Button>
      </ActionBar>
    );
  } else if (step === "team" && kind) {
    const suggested = new Set(kind.team.map((band) => band.skill));
    body = (
      <div className="space-y-4">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Suggested for {kind.title}</h2>
          {kind.team.map((band) => {
            const count = counts[band.skill] ?? 0;
            const on = count > 0;
            return (
              <div key={band.skill} className={cn(choiceClass, on ? "border-primary bg-secondary" : "border-border bg-card")}>
                <button type="button" aria-pressed={on} onClick={() => setSkillCount(band.skill, on ? 0 : band.min)} className="flex-1 text-left">
                  <span className="block">{skillTitle(band.skill)}</span>
                  <span className="mt-1 block text-base font-normal text-muted-foreground">{band.min} to {band.max}</span>
                </button>
                {on ? (
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Fewer ${skillTitle(band.skill)}`}
                      disabled={count <= band.min}
                      onClick={() => setSkillCount(band.skill, count - 1)}
                      className="grid size-10 place-items-center rounded-full border border-border text-lg"
                    >
                      −
                    </button>
                    <span className="min-w-6 text-center">{count}</span>
                    <button
                      type="button"
                      aria-label={`More ${skillTitle(band.skill)}`}
                      disabled={count >= band.max || workersNeeded >= 10}
                      onClick={() => setSkillCount(band.skill, count + 1)}
                      className="grid size-10 place-items-center rounded-full border border-border text-lg"
                    >
                      +
                    </button>
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
        <details className="rounded-2xl border bg-card">
          <summary className="flex min-h-14 cursor-pointer items-center px-4 py-3 text-lg font-semibold">Also useful</summary>
          <div className="space-y-3 px-4 pb-4">
            {SKILLS.filter((skill) => !suggested.has(skill.id)).map((skill) => {
              const on = (counts[skill.id] ?? 0) > 0;
              return (
                <button
                  key={skill.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && workersNeeded >= 10}
                  onClick={() => toggleExtra(skill.id)}
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
        </details>
      </div>
    );
    action = (
      <ActionBar>
        <Button
          size="lg"
          className="w-full"
          disabled={workersNeeded < 1 || workersNeeded > 10}
          onClick={() => setStep("budget")}
        >
          Continue
        </Button>
      </ActionBar>
    );
  } else if (step === "site") {
    body = (
      <div className="space-y-3">
        {SITE_CHOICES.map((choice) => {
          const selected = site === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setSite(choice.id)}
              className={cn(choiceClass, selected ? "border-primary bg-secondary" : "border-border bg-card")}
            >
              <span>{choice.label}</span>
              {selected ? <Check className="size-6 shrink-0 text-primary" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    );
    action = (
      <ActionBar>
        <Button size="lg" className="w-full" disabled={!site} onClick={() => setStep("team")}>
          Continue
        </Button>
      </ActionBar>
    );
  } else if (step === "kind" && sector) {
    body = (
      <div className="space-y-3">
        {kindsFor(sector).map((item) => {
          const selected = kindId === item.id;
          return (
          <button
            key={item.id}
            type="button"
            aria-pressed={selected}
            onClick={() => chooseKind(item.id)}
            className={cn(choiceClass, selected ? "border-primary bg-secondary" : "border-border bg-card")}
          >
            <span>
              <span className="block">{item.title}</span>
              <span className="mt-1 block text-base font-normal text-muted-foreground">{item.detail}</span>
            </span>
          </button>
          );
        })}
      </div>
    );
    action = (
      <ActionBar>
        <Button size="lg" className="w-full" disabled={!kind} onClick={() => setStep("site")}>
          Continue
        </Button>
      </ActionBar>
    );
  } else {
    body = (
      <div className="space-y-3">
        {SECTORS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSector(item.id);
              setKindId(null);
              setCounts({});
              setStep("kind");
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
    );
  }

  const title =
    step === "sector"
      ? "What kind of project?"
      : step === "kind"
        ? "What exactly?"
        : step === "site"
          ? "What do you have now?"
          : step === "team"
            ? "What skills do you need?"
            : step === "budget"
              ? "How much capital?"
              : step === "note"
                ? "A short note"
                : "Review";

  const back =
    step === "sector"
      ? undefined
      : step === "kind"
        ? () => setStep("sector")
        : step === "site"
          ? () => setStep("kind")
          : step === "team"
            ? () => setStep("site")
            : step === "budget"
              ? () => setStep("team")
              : step === "note"
                ? () => setStep("budget")
                : () => setStep("note");

  return (
    <div className="space-y-6">
      {header(title, back)}
      {panel}
      {step === "review" && sector ? (
        <WhatItTakes
          countryId={countryId}
          countryName={countryName}
          sector={sector}
          placeName={town.name}
          projects={demo.projects}
          collapsed
        />
      ) : null}
      {body}
      {action}
    </div>
  );
}
