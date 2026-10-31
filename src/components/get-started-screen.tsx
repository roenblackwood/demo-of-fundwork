"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  cleanResidence,
  flagFor,
  residenceFor,
  residenceName,
  searchCountries,
} from "@/lib/residence";
import { countriesIn, REGIONS, type RegionId } from "@/lib/regions";
import { getCity, getCountry, getParish, getParishes, getTown } from "@/lib/seed";
import { browserSupabase } from "@/lib/supabase/browser";
import type { PathChoice, Sector, Skill } from "@/lib/types";
import { cn } from "cn";

const DRAFT_KEY = "fundwork-start-draft";
const FLOW_KEY = "fundwork-get-started";
const HINT_KEY = "fundwork-hint-asked";
const LEAVE_KEY = "fundwork-leave-to";
const LINK_ERROR = "Could not send the link. Check the email and try again.";
const WORK_CLOSED = "Fundwork is not open for work where you live yet. You can still look around or invest.";

const choice =
  "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold";
const chip = "inline-flex min-h-11 items-center rounded-full border-2 px-4 text-base font-semibold";

type Phase = "pick" | "country" | "parish" | "town" | "reach";

type Stored = {
  name: string;
  role: PathChoice;
  residence: string | null;
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

type FlowDraft = {
  role: PathChoice | null;
  residence: string | null;
  regions: string[];
  anywhere: boolean;
  sectors: Sector[];
  phase: Phase;
  regionId: RegionId | null;
  countryId: string | null;
  parishId: string | null;
  place: PlacePick | null;
  pickedTown: boolean;
  reach: ReachChoice;
  levels: { skill: Skill; level: SkillLevelName }[];
  name: string;
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

function stepNumber(value: string | null): number {
  if (value === "1" || value === "2" || value === "3" || value === "4") return Number(value);
  return 0;
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
  profile.residence = cleanResidence(stored.residence);
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

function isPhase(value: unknown): value is Phase {
  return value === "pick" || value === "country" || value === "parish" || value === "town" || value === "reach";
}

export function GetStartedScreen({ hintCountry }: { hintCountry: string | null }) {
  const demo = useDemo();
  const router = useRouter();
  const params = useSearchParams();
  const [leaving, setLeaving] = useState(false);
  const resumed = useRef(false);
  // Set before the profile exists, so the profile redirect does not fire
  // while finish is still collapsing the step history.
  const leavingRef = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [role, setRole] = useState<PathChoice | null>(null);
  const [residence, setResidence] = useState<string | null>(cleanResidence(hintCountry));
  const [query, setQuery] = useState("");
  const [hintAsked, setHintAsked] = useState(false);
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
  const step = stepNumber(params.get("step"));

  useEffect(() => {
    // Restore this flow's answers after mount so the server HTML matches the first paint.
    const raw = sessionStorage.getItem(FLOW_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<FlowDraft>;
        /* eslint-disable react-hooks/set-state-in-effect */
        if (saved.role === "investor" || saved.role === "worker") setRole(saved.role);
        const code = cleanResidence(saved.residence);
        if (code) setResidence(code);
        if (Array.isArray(saved.regions)) setRegions(saved.regions.filter((item): item is string => typeof item === "string"));
        if (saved.anywhere === true) setAnywhere(true);
        if (Array.isArray(saved.sectors)) setSectors(saved.sectors.filter((item): item is Sector => typeof item === "string"));
        if (isPhase(saved.phase)) setPhase(saved.phase);
        if (typeof saved.regionId === "string") setRegionId(saved.regionId as RegionId);
        if (typeof saved.countryId === "string") setCountryId(saved.countryId);
        if (typeof saved.parishId === "string") setParishId(saved.parishId);
        if (saved.place && typeof saved.place === "object" && typeof saved.place.townId === "string" && typeof saved.place.countryId === "string") {
          setPlace({
            countryId: saved.place.countryId,
            parishId: typeof saved.place.parishId === "string" ? saved.place.parishId : null,
            townId: saved.place.townId,
          });
        }
        if (saved.pickedTown === true) setPickedTown(true);
        if (saved.reach === "town" || saved.reach === "parish" || saved.reach === "country" || saved.reach === "region") setReach(saved.reach);
        if (Array.isArray(saved.levels)) setLevels(saved.levels);
        if (typeof saved.name === "string") setName(saved.name);
      } catch {
        sessionStorage.removeItem(FLOW_KEY);
      }
    }
    setHintAsked(sessionStorage.getItem(HINT_KEY) === "1");
    setDraftReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const draft: FlowDraft = {
      role,
      residence,
      regions,
      anywhere,
      sectors,
      phase,
      regionId,
      countryId,
      parishId,
      place,
      pickedTown,
      reach,
      levels,
      name,
    };
    sessionStorage.setItem(FLOW_KEY, JSON.stringify(draft));
  }, [anywhere, countryId, draftReady, levels, name, parishId, phase, pickedTown, place, reach, regionId, regions, residence, role, sectors]);

  useEffect(() => {
    if (!demo.ready || !demo.profileSet || leaving || leavingRef.current) return;
    router.replace(readReturn(params.get("next")) ?? homeFor(demo.role));
  }, [demo.ready, demo.profileSet, demo.role, leaving, params, router]);

  useEffect(() => {
    if (!demo.ready || demo.profileSet || leaving) return;
    const query = new URLSearchParams(window.location.search);
    const current = query.get("step");
    if (current === "1" || current === "2" || current === "3" || current === "4") {
      if (query.get("depth") === null) {
        query.set("depth", "0");
        router.replace(`/get-started?${query.toString()}`);
      }
      return;
    }
    query.set("step", "1");
    query.set("depth", "0");
    router.replace(`/get-started?${query.toString()}`);
  }, [demo.profileSet, demo.ready, leaving, params, router]);

  useEffect(() => {
    if (!leaving) return;
    function hop() {
      const dest = sessionStorage.getItem(LEAVE_KEY);
      if (!dest) return;
      const depth = Number(new URLSearchParams(window.location.search).get("depth") ?? "0");
      if (depth > 0) {
        if (sessionStorage.getItem("fundwork-hopped") === "1") return;
        sessionStorage.setItem("fundwork-hopped", "1");
        window.history.go(-depth);
        return;
      }
      sessionStorage.removeItem("fundwork-hopped");
      sessionStorage.removeItem(LEAVE_KEY);
      router.replace(dest);
    }
    hop();
    window.addEventListener("popstate", hop);
    return () => window.removeEventListener("popstate", hop);
  }, [leaving, params, router]);

  useEffect(() => {
    if (!demo.ready || !isLive() || demo.profileSet || resumed.current) return;
    if (params.get("resume") !== "1") return;
    const stored = readStored(sessionStorage.getItem(DRAFT_KEY) ?? "");
    if (!stored) return;
    resumed.current = true;
    leavingRef.current = true;
    void (async () => {
      const { data } = await browserSupabase().auth.getUser();
      if (!data.user) {
        leavingRef.current = false;
        return;
      }
      const ok = await demo.completeStart(storedToDraft(stored));
      if (!ok) {
        leavingRef.current = false;
        return;
      }
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(FLOW_KEY);
      if (stored.save && stored.sector) demo.saveItem(stored.save, stored.sector);
      if (stored.ask) await demo.askToJoin(stored.ask);
      sessionStorage.removeItem("fundwork-hopped");
      sessionStorage.setItem(LEAVE_KEY, readReturn(params.get("next")) ?? readReturn(stored.next) ?? homeFor(stored.role));
      setLeaving(true);
    })();
  }, [demo, params, router]);

  if (!demo.ready || !draftReady || step === 0) return <PageBusy />;
  if (demo.profileSet && !leaving) return <PageBusy />;

  const towns = countryId === "jamaica" && parishId ? (getParish(parishId)?.towns ?? []) : (getCountry(countryId ?? "")?.cities ?? []);
  const rule = residenceFor(residence);
  const investBlocked = Boolean(residence) && rule.invest === "blocked";
  const workClosed = role === "worker" && Boolean(residence) && rule.work === "blocked";
  const showHint = Boolean(
    draftReady &&
      !hintAsked &&
      hintCountry &&
      residence &&
      hintCountry !== residence &&
      step === 2,
  );
  const matches = searchCountries(query);

  function goTo(next: number) {
    const query = new URLSearchParams(window.location.search);
    const depth = Number(query.get("depth") ?? "0");
    query.set("step", String(next));
    query.set("depth", String(Number.isFinite(depth) ? depth + 1 : 1));
    router.push(`/get-started?${query.toString()}`);
  }

  function markHint() {
    sessionStorage.setItem(HINT_KEY, "1");
    setHintAsked(true);
  }

  function goBack() {
    if (step === 3 && role === "worker" && phase !== "pick") {
      if (phase === "reach") setPhase(pickedTown ? "town" : "pick");
      else if (phase === "town") setPhase(countryId === "jamaica" ? "parish" : "country");
      else if (phase === "parish") setPhase("country");
      else setPhase("pick");
      return;
    }
    if (step === 1) {
      // History first. `next` is often the commit page, and the profile gate
      // sends an unsigned person back here, so opening `next` would loop.
      if (window.history.length > 1) {
        router.back();
        return;
      }
      const next = readReturn(new URLSearchParams(window.location.search).get("next"));
      router.replace(next ?? "/");
      return;
    }
    router.back();
  }

  function chooseRole(next: PathChoice) {
    setRole(next);
    goTo(2);
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
    profile.residence = residence;
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
    return readReturn(new URLSearchParams(window.location.search).get("next")) ?? homeFor(role);
  }

  async function finishAfter(trimmed: string) {
    const search = new URLSearchParams(window.location.search);
    const save = search.get("save");
    const sector = search.get("sector");
    const ask = search.get("ask");
    leavingRef.current = true;
    const ok = await demo.completeStart(draftFor(trimmed));
    if (!ok) {
      leavingRef.current = false;
      setLeaving(false);
      setSaving(false);
      return;
    }
    if (save && sector) demo.saveItem(save, sector);
    if (ask) await demo.askToJoin(ask);
    sessionStorage.removeItem(FLOW_KEY);
    sessionStorage.removeItem("fundwork-hopped");
    sessionStorage.setItem(LEAVE_KEY, destination());
    setLeaving(true);
  }

  async function finish() {
    const trimmed = name.trim();
    if (!trimmed || !role || !residence || saving || leaving) return;
    if (investBlocked || workClosed) return;
    if (role === "worker" && (!place || levels.length === 0)) return;
    setNotice("");
    if (isLive()) {
      const emailTrim = email.trim();
      if (!emailTrim.includes("@") || !emailTrim.includes(".")) {
        setNotice(LINK_ERROR);
        return;
      }
      const search = new URLSearchParams(window.location.search);
      const next = destination();
      const stored: Stored = {
        name: trimmed,
        role,
        residence,
        places: role === "investor" ? (anywhere || regions.length === 0 ? ["anywhere"] : regions) : [],
        interests: sectors,
        place: role === "worker" ? place : null,
        reach,
        skillLevels: levels,
        next,
        save: search.get("save"),
        sector: search.get("sector"),
        ask: search.get("ask"),
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
    setSaving(true);
    await finishAfter(trimmed);
  }

  const title =
    step === 1
      ? "What brings you here?"
      : step === 2
        ? "Where do you live?"
        : step === 3 && role === "investor"
          ? "Which regions interest you?"
          : step === 3 && phase === "reach"
            ? "How far will you go?"
            : step === 3
              ? "Where do you work?"
              : role === "worker"
                ? "What can you do?"
                : "What kind of projects?";

  const hintLine = showHint && hintCountry && residence
    ? `Your connection looks like it is in ${residenceName(hintCountry)}. Is ${residenceName(residence)} where you live?`
    : "";

  return (
    <div className="space-y-6">
      <Progress value={(step / 4) * 100} aria-label={`Step ${step} of 4`}>
        <ProgressLabel>Step {step} of 4</ProgressLabel>
      </Progress>
      <StepHeader backHref="/" onBack={goBack} title={title} hint={step === 3 && phase === "reach" ? placeHint(place) : undefined} />
      {hintLine ? (
        <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="text-lg leading-relaxed">{hintLine}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={markHint}>
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                markHint();
                setResidence(null);
                setQuery("");
              }}
            >
              Change
            </Button>
          </div>
        </div>
      ) : null}
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
      {step === 2 ? (
        <div className="space-y-4">
          {residence ? (
            <p className="text-lg font-semibold">
              <span aria-hidden>{flagFor(residence)} </span>
              {residenceName(residence)}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="live-country">Country</Label>
            <Input
              id="live-country"
              value={query}
              autoComplete="off"
              placeholder="Search for a country"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {matches.length > 0 ? (
            <div className="space-y-2">
              {matches.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  className={cn(choice, pickedClass(residence === item.code))}
                  onClick={() => {
                    setResidence(item.code);
                    setQuery("");
                  }}
                >
                  <span>
                    <span aria-hidden>{item.flag} </span>
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {investBlocked ? <p className="text-lg leading-relaxed">{rule.note}</p> : null}
          {!investBlocked && workClosed ? <p className="text-lg leading-relaxed">{WORK_CLOSED}</p> : null}
          {!investBlocked && !workClosed && role === "investor" && rule.note ? (
            <p className="text-lg leading-relaxed">{rule.note}</p>
          ) : null}
          {investBlocked ? (
            <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => router.replace("/")}>
              Look around
            </Button>
          ) : null}
          {!investBlocked && workClosed ? (
            <div className="flex flex-col gap-3">
              <Button type="button" size="lg" className="w-full" onClick={() => setRole("investor")}>
                Switch to investing
              </Button>
              <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => router.replace("/")}>
                Look around
              </Button>
            </div>
          ) : null}
          {!investBlocked && !workClosed ? (
            <Button type="button" size="lg" className="w-full" disabled={!residence || !role} onClick={() => goTo(3)}>
              Continue
            </Button>
          ) : null}
        </div>
      ) : null}
      {step === 3 && role === "investor" ? (
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
          <Button type="button" size="lg" className="w-full" disabled={!anywhere && regions.length === 0} onClick={() => goTo(4)}>
            Continue
          </Button>
        </div>
      ) : null}
      {step === 3 && role === "worker" && phase === "pick" ? (
        <div className="space-y-4">
          <UseMyLocation
            who="worker"
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
      {step === 3 && role === "worker" && phase === "country" && regionId ? (
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
      {step === 3 && role === "worker" && phase === "parish" ? (
        <div className="space-y-3">
          {getParishes().map((parish) => (
            <button key={parish.id} type="button" className={cn(choice, "border-border bg-card")} onClick={() => { setParishId(parish.id); setPhase("town"); }}>
              {parish.name}
            </button>
          ))}
        </div>
      ) : null}
      {step === 3 && role === "worker" && phase === "town" ? (
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
      {step === 3 && role === "worker" && phase === "reach" ? (
        <div className="space-y-3">
          {REACH_CHOICES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(choice, "border-border bg-card")}
              onClick={() => {
                setReach(item.id);
                goTo(4);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {step === 4 && role === "investor" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void finish();
          }}
        >
          <div className="flex flex-wrap gap-2">
            {SECTORS.map((sector) => (
              <button key={sector.id} type="button" aria-pressed={sectors.includes(sector.id)} className={cn(chip, pickedClass(sectors.includes(sector.id)))} onClick={() => toggleSector(sector.id)}>
                {sector.title}
              </button>
            ))}
          </div>
          <p className="text-base text-muted-foreground">You can leave these unset.</p>
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
      {step === 4 && role === "worker" ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void finish();
          }}
        >
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
              <Button type="submit" size="lg" className="w-full" disabled={!name.trim() || levels.length === 0 || saving} aria-busy={saving}>
                {isLive() ? "Email me a link" : "Continue"}
              </Button>
            </>
          )}
        </form>
      ) : null}
    </div>
  );
}
