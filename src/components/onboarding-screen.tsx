"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PlaceScreen } from "@/components/map/place-screen";
import { StepHeader } from "@/components/parts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfile } from "@/app/actions/live";
import { JAMAICA_SKILLS, SKILLS } from "@/lib/catalog";
import { cn } from "cn";
import { safeNext } from "@/lib/guard-paths";
import { refreshLiveStore } from "@/lib/live-store";
import { browserSupabase } from "@/lib/supabase/browser";
import type { PathChoice, Skill } from "@/lib/types";

const SAVE_ERROR = "Could not save. Check your connection and try again.";

type Step = "name" | "role" | "region" | "skill";

export function OnboardingScreen() {
  const [step, setStep] = useState<Step>("name");
  const [next, setNext] = useState("/you");
  const [name, setName] = useState("");
  const [role, setRole] = useState<PathChoice | null>(null);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [parishId, setParishId] = useState<string | null>(null);
  const [townId, setTownId] = useState<string | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dest = safeNext(params.get("next"));
    // The return path is only in the browser URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNext(dest);
    const supabase = browserSupabase();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace(`/sign-in?next=${encodeURIComponent(dest)}`);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle();
      if (!profile) return;
      router.replace(dest);
    });
  }, [router]);

  async function finish(
    picked: Skill | null,
    place: { townId: string; parishId: string | null; countryId: string },
  ) {
    if (!role || saving) return;
    if (role === "worker" && !picked) return;
    setCountryId(place.countryId);
    setTownId(place.townId);
    setParishId(place.parishId);
    setSaving(true);
    setError("");
    const ok = await saveProfile({
      name,
      role,
      countryId: place.countryId,
      parishId: place.parishId,
      townId: place.townId,
      skill: role === "worker" ? picked : null,
      extraSkills: [],
    });
    setSaving(false);
    if (!ok) {
      setError(SAVE_ERROR);
      return;
    }
    const dest = next === "/you" ? (role === "worker" ? "/work" : "/invest") : next;
    await refreshLiveStore();
    router.push(dest);
  }

  const leadSkills = countryId === "jamaica"
    ? SKILLS.filter((item) => JAMAICA_SKILLS.includes(item.id))
    : SKILLS;

  function back() {
    setError("");
    if (step === "role") setStep("name");
    else if (step === "region") setStep("role");
    else if (step === "skill") setStep("region");
  }

  return (
    <div className="space-y-6">
      {step === "name" ? (
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setStep("role");
          }}
        >
          <StepHeader backHref="/" title="Your name" />
          <div className="space-y-2">
            <Label htmlFor="your-name">Your name</Label>
            <Input
              id="your-name"
              value={name}
              autoComplete="name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
            Use this name
          </Button>
        </form>
      ) : null}

      {step === "role" ? (
        <div className="space-y-4">
          <StepHeader backHref="/" onBack={back} title="What do you want to do?" />
          <button
            type="button"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
            onClick={() => {
              setRole("investor");
              setStep("region");
            }}
          >
            I want to invest
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "workOutline", size: "lg" }), "w-full")}
            onClick={() => {
              setRole("worker");
              setStep("region");
            }}
          >
            I want to work
          </button>
        </div>
      ) : null}

      {step === "region" ? (
        <PlaceScreen
          title="Where should we look?"
          backHref="/"
          onBack={back}
          onTown={(place) => {
            setCountryId(place.countryId);
            setParishId(place.parishId);
            setTownId(place.townId);
            if (role === "worker") {
              setStep("skill");
              return;
            }
            void finish(null, place);
          }}
        />
      ) : null}

      {step === "skill" ? (
        <div className="space-y-4">
          <StepHeader backHref="/" onBack={back} title="What work do you do?" />
          {leadSkills.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex min-h-14 w-full flex-col justify-center rounded-2xl border-2 border-border bg-card px-4 py-3 text-left"
              onClick={() => setSkill(item.id)}
            >
              <span className="text-lg font-semibold">{item.title}</span>
              <span className="text-base text-muted-foreground">{item.detail}</span>
            </button>
          ))}
          {skill ? (
            <Button
              type="button"
              variant="work"
              size="lg"
              className="w-full"
              disabled={saving}
              aria-busy={saving}
              onClick={() => {
                if (!townId || !countryId) return;
                void finish(skill, {
                  townId,
                  parishId: countryId === "jamaica" ? parishId : null,
                  countryId,
                });
              }}
            >
              See work for me
            </Button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-lg">{error}</p> : null}
    </div>
  );
}
