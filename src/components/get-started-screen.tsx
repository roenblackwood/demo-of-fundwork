"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { StepHeader } from "@/components/parts";
import { UseMyLocation } from "@/components/use-location";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { SECTORS, SKILLS } from "@/lib/catalog";
import { type StartDraft, useDemo } from "@/lib/demo-store";
import { isLive } from "@/lib/mode";
import {
  emptyProfile,
  LEVEL_CHOICES,
  REACH_CHOICES,
  type PlacePick,
  type ReachChoice,
  type SkillLevelName,
} from "@/lib/profile";
import { countriesIn, REGIONS, type RegionId } from "@/lib/regions";
import { getCity, getCountry, getParish, getParishes, getTown } from "@/lib/seed";
import { browserSupabase } from "@/lib/supabase/browser";
import type { PathChoice, Sector, Skill } from "@/lib/types";
import { cn } from "cn";

const DRAFT_KEY = "fundwork-start-draft";
const LINK_ERROR = "Could not send the link. Check the email and try again.";

const choice =
  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold";
const chip = "inline-flex min-h-11 items-center rounded-full border-2 px-4 text-base font-semibold";

type Phase = "pick" | "country" | "parish" | "town" | "reach";

type Stored = {
  name: string;
  role: PathChoice;
  places: string[];
  interests: Sector[];
  place: PlacePick | null;
  reach: ReachChoice;
  skillLevels: { skill: Skill; level: SkillLevelName }[];
  next: string | null;
  save: string | null;
  sector: string | null;
  ask: string | null;
};

function readReturn(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/sign-in") || value.startsWith("/get-started")) {
    return null;
  }
  return value;
}

function homeFor(role: PathChoice | null): string {
  if (role === "worker") return "/work";
  if (role === "investor") return "/invest";
  return "/you";
}

function pickedClass(on: boolean): string {
  return on ? "border-primary bg-secondary" : "border-border bg-card";
}

function readStored(raw: string): Stored | null {
  try {
    const value = JSON.parse(raw) as Stored;
    if (!value || (value.role !== "investor" && value.role !== "worker")) return null;
    if (typeof value.name !== "string" || !value.name.trim()) return null;
    return value;
  } catch {
    return null;
  }
}

function storedToDraft(stored: Stored): StartDraft {
  const profile = emptyProfile();
  profile.done = true;
  profile.reach = stored.reach === "town" || stored.reach === "parish" || stored.reach === "country" || stored.reach === "region" ? stored.reach : "town";
  profile.places = Array.isArray(stored.places) ? stored.places : [];
  profile.interests = Array.isArray(stored.interests) ? stored.interests : [];
  profile.skillLevels = Array.isArray(stored.skillLevels) ? stored.skillLevels : [];
  const first = profile.skillLevels[0]?.skill ?? null;
  return {
    name: stored.name,
    role: stored.role,
    profile,
    place: stored.role === "worker" ? stored.place : null,
    skill: stored.role === "worker" ? first : null,
    extraSkills: stored.role === "worker" ? profile.skillLevels.slice(1).map((item) => item.skill) : [],
  };
}

function placeHint(place: PlacePick | null): string {
  if (!place) return "";
  const town = place.parishId ? getTown(place.parishId, place.townId)?.name : getCity(place.countryId, place.townId)?.name;
  const area = place.parishId ? getParish(place.parishId)?.name : getCountry(place.countryId)?.name;
  if (town && area) return `${town}, ${area}`;
  return town || area || "";
}

export function GetStartedScreen() {
  const demo = useDemo();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const resumed = useRef(false);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<PathChoice | null>(null);
  const [regions, setRegions] = useState<string[]>([]);
  const [anywhere, setAnywhere] = useState(false);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [phase, setPhase] = useState<Phase>("pick");
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [parishId, setParishId] = useState<string | null>(null);
  const [place, setPlace] = useState<PlacePick | null>(null);
  const [pickedTown, setPickedTown] = useState(false);
  const [reach, setReach] = useState<ReachChoice>("parish");
  const [levels, setLevels] = useState<{ skill: Skill; level: SkillLevelName }[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!demo.ready || !demo.profileSet || leaving) return;
    const params = new URLSearchParams(window.location.search);
    router.replace(readReturn(params.get("next")) ?? homeFor(demo.role));
  }, [demo.ready, demo.profileSet, demo.role, leaving, router]);

  useEffect(() => {
    if (!demo.ready || !isLive() || demo.profileSet || resumed.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") return;
    const stored = readStored(sessionStorage.getItem(DRAFT_KEY) ?? "");
    if (!stored) return;
    resumed.current = true;
    void (async () => {
      const { data } = await browserSupabase().auth.getUser();
      if (!data.user) return;
      setLeaving(true);
      const ok = await demo.completeStart(storedToDraft(stored));
      if (!ok) {
        setLeaving(false);
        return;
      }
      sessionStorage.removeItem(DRAFT_KEY);
      if (stored.save && stored.sector) demo.saveItem(stored.save, stored.sector);
      if (stored.ask) await demo.askToJoin(stored.ask);
      router.push(readReturn(params.get("next")) ?? readReturn(stored.next) ?? homeFor(stored.role));
    })();
  }, [demo, router]);

  if (!demo.ready) return <PageBusy />;
  if (demo.profileSet && !leaving) return <PageBusy />;

  const towns = countryId === "jamaica" && parishId ? (getParish(parishId)?.towns ?? []) : (getCountry(countryId ?? "")?.cities ?? []);

  function goBack() {
    if (step === 1) {
      router.push("/");
      return;
    }
    if (step === 2 && role === "worker") {
      if (phase === "reach") setPhase(pickedTown ? "town" : "pick");
      else if (phase === "town") setPhase(countryId === "jamaica" ? "parish" : "country");
      else if (phase === "parish") setPhase("country");
      else if (phase === "country") setPhase("pick");
      else setStep(1);
      return;
    }
    if (step === 3 && role === "worker") setPhase("reach");
    setStep((value) => Math.max(1, value - 1));
  }

  function chooseRole(next: PathChoice) {
    setRole(next);
    setStep(2);
  }

  function toggleRegion(id: string) {
    setAnywhere(false);
    setRegions((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSector(id: Sector) {
    setSectors((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSkill(id: Skill) {
    setLevels((current) => {
      const picked = current.find((item) => item.skill === id);
      if (picked) return current.filter((item) => item.skill !== id);
      return [...current, { skill: id, level: "learning" }];
    });
  }

  function setLevel(id: Skill, level: SkillLevelName) {
    setLevels((current) => current.map((item) => (item.skill === id ? { ...item, level } : item)));
  }

  function draftFor(trimmed: string): StartDraft {
    const profile = emptyProfile();
    profile.done = true;
    if (role === "investor") {
      profile.places = anywhere || regions.length === 0 ? ["anywhere"] : regions;
      profile.interests = sectors;
    } else {
      profile.reach = reach;
      profile.skillLevels = levels;
    }
    const first = levels[0]?.skill ?? null;
    return {
      name: trimmed,
      role: role ?? "investor",
      profile,
      place: role === "worker" ? place : null,
      skill: role === "worker" ? first : null,
      extraSkills: role === "worker" ? levels.slice(1).map((item) => item.skill) : [],
    };
  }

  function destination(): string {
    const params = new URLSearchParams(window.location.search);
    return readReturn(params.get("next")) ?? homeFor(role);
  }

  async function finishAfter(trimmed: string) {
    const ok = await demo.completeStart(draftFor(trimmed));
    if (!ok) {
      setLeaving(false);
      setSaving(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const save = params.get("save");
    const sector = params.get("sector");
    const ask = params.get("ask");
    if (save && sector) demo.saveItem(save, sector);
    if (ask) await demo.askToJoin(ask);
    router.push(destination());
  }

  async function finish() {
    const trimmed = name.trim();
    if (!trimmed || !role || saving || leaving) return;
    if (role === "worker" && (!place || levels.length === 0)) return;
    setNotice("");
    if (isLive()) {
      const emailTrim = email.trim();
      if (!emailTrim.includes("@") || !emailTrim.includes(".")) {
        setNotice(LINK_ERROR);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const next = destination();
      const stored: Stored = {
        name: trimmed,
        role,
        places: role === "investor" ? (anywhere || regions.length === 0 ? ["anywhere"] : regions) : [],
        interests: sectors,
        place: role === "worker" ? place : null,
        reach,
        skillLevels: levels,
        next,
        save: params.get("save"),
        sector: params.get("sector"),
        ask: params.get("ask"),
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(stored));
      setSaving(true);
      const { error } = await browserSupabase().auth.signInWithOtp({
        email: emailTrim,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      setSaving(false);
      if (error) {
        setNotice(LINK_ERROR);
        return;
      }
      setSent(true);
      return;
    }
    setLeaving(true);
    setSaving(true);
    await finishAfter(trimmed);
  }

  const title =
    step === 1
      ? "What brings you here?"
      : step === 2 && role === "investor"
        ? "Which regions interest you?"
        : step === 2 && phase === "reach"
          ? "How far will you go?"
          : step === 2
            ? "Where do you live and work?"
            : step === 3 && role === "investor"
              ? "What kind of projects?"
              : step === 3
                ? "What can you do?"
                : "What should people call you?";

  return (
    <div className="space-y-6">
      <Progress value={(step / 4) * 100} aria-label={`Step ${step} of 4`}>
        <ProgressLabel>Step {step} of 4</ProgressLabel>
      </Progress>
      <StepHeader backHref="/" onBack={goBack} title={title} hint={step === 2 && phase === "reach" ? placeHint(place) : undefined} />
      {step === 1 ? (
        <div className="space-y-3">
          <button type="button" className="flex min-h-24 w-full flex-col items-start justify-center gap-1 rounded-2xl border-2 border-border bg-card px-4 py-4 text-left" onClick={() => chooseRole("investor")}>
            <span className="text-lg font-semibold">I want to invest</span>
            <span className="text-base text-muted-foreground">Put money into a project or a request.</span>
          </button>
          <button type="button" className="flex min-h-24 w-full flex-col items-start justify-center gap-1 rounded-2xl border-2 border-border bg-card px-4 py-4 text-left" onClick={() => chooseRole("worker")}>
            <span className="text-lg font-semibold">I want to work</span>
            <span className="text-base text-muted-foreground">Join a team and do the work.</span>
          </button>
        </div>
      ) : null}
      {step === 2 && role === "investor" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((region) => (
              <button key={region.id} type="button" aria-pressed={regions.includes(region.id)} className={cn(chip, pickedClass(regions.includes(region.id)))} onClick={() => toggleRegion(region.id)}>
                {region.name}
              </button>
            ))}
            <button type="button" aria-pressed={anywhere} className={cn(chip, pickedClass(anywhere))} onClick={() => { setAnywhere(true); setRegions([]); }}>
              Anywhere
            </button>
          </div>
          <p className="text-base text-muted-foreground">This sets what you see first. You can invest anywhere.</p>
          <Button type="button" size="lg" className="w-full" disabled={!anywhere && regions.length === 0} onClick={() => setStep(3)}>
            Continue
          </Button>
        </div>
      ) : null}
      {step === 2 && role === "worker" && phase === "pick" ? (
        <div className="space-y-4">
          <UseMyLocation
            className={cn(choice, "border-border bg-card")}
            onTown={(found) => {
              setPlace(found);
              setPickedTown(false);
              setPhase("reach");
            }}
          />
          <p className="text-base font-semibold">Or pick a place</p>
          <div className="space-y-3">
            {REGIONS.map((region) => (
              <button key={region.id} type="button" className={cn(choice, "border-border bg-card")} onClick={() => { setRegionId(region.id); setPhase("country"); }}>
                {region.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {step === 2 && role === "worker" && phase === "country" && regionId ? (
        <div className="space-y-3">
          {countriesIn(regionId).map((country) => (
            <button
              key={country.id}
              type="button"
              className={cn(choice, "border-border bg-card")}
              onClick={() => {
                setCountryId(country.id);
                setPhase(country.id === "jamaica" ? "parish" : "town");
              }}
            >
              {country.name}
            </button>
          ))}
        </div>
      ) : null}
      {step === 2 && role === "worker" && phase === "parish" ? (
        <div className="space-y-3">
          {getParishes().map((parish) => (
            <button key={parish.id} type="button" className={cn(choice, "border-border bg-card")} onClick={() => { setParishId(parish.id); setPhase("town"); }}>
              {parish.name}
            </button>
          ))}
        </div>
      ) : null}
      {step === 2 && role === "worker" && phase === "town" ? (
        <div className="space-y-3">
          {towns.length === 0 ? <p className="text-base">No towns in this demo yet.</p> : null}
          {towns.map((town) => (
            <button
              key={town.id}
              type="button"
              className={cn(choice, "border-border bg-card")}
              onClick={() => {
                if (!countryId) return;
                setPlace({ countryId, parishId: countryId === "jamaica" ? parishId : null, townId: town.id });
                setPickedTown(true);
                setPhase("reach");
              }}
            >
              {town.name}
            </button>
          ))}
        </div>
      ) : null}
      {step === 2 && role === "worker" && phase === "reach" ? (
        <div className="space-y-3">
          {REACH_CHOICES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(choice, "border-border bg-card")}
              onClick={() => {
                setReach(item.id);
                setStep(3);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {step === 3 && role === "investor" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((sector) => (
              <button key={sector.id} type="button" aria-pressed={sectors.includes(sector.id)} className={cn(chip, pickedClass(sectors.includes(sector.id)))} onClick={() => toggleSector(sector.id)}>
                {sector.title}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" className="w-full" disabled={sectors.length === 0} onClick={() => setStep(4)}>
              Continue
            </Button>
            <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => { setSectors([]); setStep(4); }}>
              Skip
            </Button>
          </div>
        </div>
      ) : null}
      {step === 3 && role === "worker" ? (
        <div className="space-y-4">
          {SKILLS.map((skill) => {
            const picked = levels.find((item) => item.skill === skill.id);
            return (
              <div key={skill.id} className="space-y-2">
                <button type="button" aria-pressed={Boolean(picked)} className={cn(choice, pickedClass(Boolean(picked)))} onClick={() => toggleSkill(skill.id)}>
                  {skill.title}
                </button>
                {picked ? (
                  <div className="flex flex-wrap gap-2">
                    {LEVEL_CHOICES.map((level) => (
                      <button key={level.id} type="button" aria-pressed={picked.level === level.id} className={cn(chip, pickedClass(picked.level === level.id))} onClick={() => setLevel(skill.id, level.id)}>
                        {level.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <Button type="button" size="lg" className="w-full" disabled={levels.length === 0} onClick={() => setStep(4)}>
            Continue
          </Button>
        </div>
      ) : null}
      {step === 4 ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void finish();
          }}
        >
          {sent ? (
            <p className="text-lg leading-relaxed">Check your email for the link.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="start-name">Name</Label>
                <Input id="start-name" value={name} autoComplete="name" onChange={(event) => setName(event.target.value)} />
              </div>
              {isLive() ? (
                <div className="space-y-2">
                  <Label htmlFor="start-email">Email</Label>
                  <Input id="start-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  <p className="text-base text-muted-foreground">We email you a link. No password.</p>
                </div>
              ) : null}
              {notice ? <p className="text-base">{notice}</p> : null}
              <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || saving} aria-busy={saving}>
                {isLive() ? "Email me a link" : "Continue"}
              </Button>
            </>
          )}
        </form>
      ) : null}
    </div>
  );
}
