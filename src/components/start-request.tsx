"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { PageBusy } from "@/components/busy";
import { BeforeYouStart, WhatThisNeeds } from "@/components/needs-panel";
import { FitFooter } from "@/components/place-fit";
import { ActionBar, CapitalChip, MoneyText, NextSteps, SavedMark, StepHeader } from "@/components/parts";
import { useSnackbar } from "@/components/snackbar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatItTakes } from "@/components/guide-card";
import {
  applySiteReadiness,
  defaultCounts,
  kindById,
  kindOptionLine,
  kindsFor,
  peopleCount,
  readinessFor,
  siteLabel,
  SITE_CHOICES,
  skillsFromCounts,
  teamLine,
} from "@/lib/blueprints";
import { SECTORS, SKILLS, isSector, sectorTitle, skillTitle } from "@/lib/catalog";
import { cn } from "cn";
import { savedLabel } from "@/lib/copy";
import { useDemo } from "@/lib/demo-store";
import { money, placeLine } from "@/lib/format";
import { priceRange } from "@/lib/guides";
import { aboutUsd } from "@/lib/rates";
import { sectorSources, suitedSector } from "@/lib/region-fit";
import { currencyOf, getCity, getCountry, getParish, getTown, requestPlace } from "@/lib/seed";
import { useProfileGate } from "@/components/profile-gate";
import type { Readiness, Sector, SiteStatus, Skill } from "@/lib/types";

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

function formatAmountInput(text: string): string {
  const digits = text.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-US");
}

const OPEN_PANEL: Step[] = ["kind", "site", "team", "budget"];

export function StartRequestScreen({ placeId, townId }: { placeId: string; townId: string }) {
  const demo = useDemo();
  const allowed = useProfileGate();
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
  const [shareText, setShareText] = useState("");
  const [shareTouched, setShareTouched] = useState(false);
  const [note, setNote] = useState("");
  const [readiness, setReadiness] = useState<Readiness>({});
  const [callerName, setCallerName] = useState("");
  const [panelStep, setPanelStep] = useState<Step | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const kind = sector ? kindById(sector, kindId) : null;
  const amount = readAmount(budgetText);
  const shareShown = shareTouched ? shareText : budgetText;
  const share = readAmount(shareShown);
  const workersNeeded = peopleCount(counts);
  const skills = skillsFromCounts(counts);

  const panelDefault = OPEN_PANEL.includes(step);
  const panelShown = panelStep === step ? panelOpen : panelDefault;

  function togglePanel() {
    const showing = panelStep === step ? panelOpen : panelDefault;
    setPanelStep(step);
    setPanelOpen(!showing);
  }

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (!town || !where) return null;
  if (!demo.ready || !allowed) return <PageBusy />;

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
    setReadiness(site ? applySiteReadiness(next, site, {}) : {});
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

  const needsName = !demo.name.trim() || demo.name.trim() === "You";

  async function post() {
    if (!sector || !kind || !site || !amount || !share || share > amount || workersNeeded < 1 || workersNeeded > 10 || skills.length === 0) return;
    if (!note.trim() || demo.saving) return;
    const called = callerName.trim();
    if (needsName && !called) return;
    if (needsName) await Promise.resolve(demo.setDisplayName(called));
    const id = await demo.addRequest({
      countryId,
      parishId,
      townId,
      sector,
      budget: amount,
      share,
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
            "Other investors can pledge what is left.",
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
        <section id="review-summary" className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-lg font-semibold text-primary">
            {sectorTitle(sector)}. {kind.title}
          </p>
          <p className="text-lg">{place}</p>
          <p className="text-lg">{siteLabel(site)}</p>
          <div>
            <p className="text-2xl font-bold">
              <MoneyText amount={amount} currency={currency} showAbout={false} />
            </p>
            {about ? <p className="text-base text-muted-foreground">{about}</p> : null}
          </div>
          <div>
            <p className="text-lg">Your share</p>
            <p className="text-2xl font-bold">
              <MoneyText amount={share ?? 0} currency={currency} showAbout={false} />
            </p>
          </div>
          <ul className="space-y-1">
            {skills.map((skill) => (
              <li key={skill} className="text-lg">
                {teamLine(skill, counts[skill] ?? 0)}
              </li>
            ))}
          </ul>
          <p className="text-lg leading-relaxed">{note.trim()}</p>
          <div id="review-capital">
            <CapitalChip />
          </div>
        </section>
        <BeforeYouStart
          kind={kind}
          site={site}
          readiness={readiness}
          onChoose={(key, state) => setReadiness((current) => ({ ...current, [key]: state }))}
        />
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Phases</h2>
          <ol className="list-decimal space-y-1 pl-5 text-lg">
            {kind.phases.map((phase) => (
              <li key={phase}>{phase}</li>
            ))}
          </ol>
        </section>
        <WhatItTakes
          countryId={countryId}
          countryName={countryName}
          sector={sector}
          placeName={town.name}
          projects={demo.projects}
          collapsed
        />
        {needsName ? (
          <div className="space-y-2">
            <Label htmlFor="caller-name">What should people call you?</Label>
            <Input
              id="caller-name"
              value={callerName}
              onChange={(event) => setCallerName(event.target.value)}
            />
          </div>
        ) : null}
      </div>
    );
    action = (
      <ActionBar>
        <Button
          size="lg"
          className="w-full"
          disabled={demo.saving || (needsName && !callerName.trim())}
          aria-busy={demo.saving}
          onClick={() => void post()}
        >
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
            inputMode="numeric"
            value={budgetText}
            onChange={(event) => setBudgetText(formatAmountInput(event.target.value))}
            placeholder="6,000,000"
          />
          {about ? <p className="text-base text-muted-foreground">{about}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="request-share">Your share</Label>
          <Input
            id="request-share"
            inputMode="numeric"
            value={shareShown}
            onChange={(event) => {
              setShareTouched(true);
              setShareText(formatAmountInput(event.target.value));
            }}
            placeholder="6,000,000"
          />
          <p className="text-base text-muted-foreground">
            This is the part you pledge. Other investors can pledge what is left.
          </p>
        </div>
        {rangeLine ? <p className="text-lg leading-relaxed">{rangeLine}</p> : null}
        {range && amount && (amount < range.low / 2 || amount > range.high * 2) ? (
          <p className="text-base text-muted-foreground">
            This is far from what similar projects asked for. Check your numbers.
          </p>
        ) : null}
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
        <Button
          size="lg"
          className="w-full"
          disabled={!amount || !share || share > amount}
          onClick={() => setStep("note")}
        >
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
              onClick={() => {
                setSite(choice.id);
                if (kind) setReadiness((current) => applySiteReadiness(kind, choice.id, current));
              }}
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
              <span className="mt-1 block text-base font-normal text-muted-foreground">{kindOptionLine(item)}</span>
            </span>
          </button>
          );
        })}
        <p className="text-base text-muted-foreground">Pick one to see everything it needs.</p>
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
        {SECTORS.map((item) => {
          const suited = suitedSector(parishId, countryId, item.id);
          return (
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
              {suited ? (
                <>
                  <span className="mt-2 inline-flex min-h-8 items-center rounded-full bg-secondary px-3 text-sm font-semibold text-secondary-foreground">
                    Suited here
                  </span>
                  <span className="mt-1 block text-base font-normal text-muted-foreground">{suited.why}</span>
                </>
              ) : null}
            </span>
          </button>
          );
        })}
        <FitFooter sources={sectorSources(parishId, countryId)} />
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
    <div className="min-[840px]:grid min-[840px]:grid-cols-[minmax(0,640px)_minmax(16rem,1fr)] min-[840px]:items-start min-[840px]:gap-8">
      <div className="min-w-0 space-y-6">
        {header(title, back)}
        <div className="min-[840px]:hidden">{panel}</div>
        {body}
        {action}
      </div>
      <div className="sticky top-20 hidden min-[840px]:block">{panel}</div>
    </div>
  );
}
