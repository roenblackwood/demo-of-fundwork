"use client";

import { useState } from "react";
import Link from "next/link";
import { PageBusy } from "@/components/busy";
import { FitFooter, SectorHint } from "@/components/place-fit";
import { MoneyText, StepHeader, sectionTitle } from "@/components/parts";
import { UseMyLocation } from "@/components/use-location";
import { Button, buttonVariants } from "@/components/ui/button";
import { SKILLS, SECTORS, skillTitle } from "@/lib/catalog";
import { kindsFor } from "@/lib/blueprints";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import {
  GOAL_CHOICES,
  HORIZON_CHOICES,
  LEVEL_CHOICES,
  REACH_CHOICES,
  START_CHOICES,
  cleanLanguages,
  localFromUsd,
  reachLabel,
  toolsForSkills,
  townName,
  type GoalChoice,
  type HorizonChoice,
  type PersonProfile,
  type PlacePick,
  type SkillLevelName,
  type StartWhen,
} from "@/lib/profile";
import { sourcesForPlaces } from "@/lib/region-fit";
import { currencyOf, getCountries, getParishes } from "@/lib/seed";

const choiceClass =
  "min-h-12 cursor-pointer rounded-xl border-2 px-3 text-left text-base font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

function onClass(on: boolean): string {
  return on ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card";
}

export function ProfileScreen() {
  const demo = useDemo();
  const [step, setStep] = useState<number | null>(null);
  const [draft, setDraft] = useState<PersonProfile | null>(null);
  const [language, setLanguage] = useState("");
  const [photoNote, setPhotoNote] = useState("");

  if (!demo.ready) return <PageBusy />;
  const profile = draft ?? demo.profile;
  const editing = step !== null;
  const worker = demo.role === "worker";
  const home = currentPlace(demo);
  const total = 6;

  function update(patch: Partial<PersonProfile>) {
    setDraft({ ...profile, ...patch });
  }

  function save(next: PersonProfile) {
    void demo.savePersonProfile(next);
    setDraft(next);
  }

  function finish(next: PersonProfile) {
    const done = { ...next, done: true };
    save(done);
    setStep(null);
  }

  if (!demo.role) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-4xl leading-tight">Your profile</h1>
        <p className="text-lg">Pick Invest or Work first. Then you can fill this in.</p>
        <Link href="/invest" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Invest
        </Link>
        <Link href="/work" className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}>
          Work
        </Link>
      </div>
    );
  }

  if (!editing && profile.done) {
    return (
      <div className="space-y-6">
        <StepHeader backHref="/you" title="Your profile" />
        <Summary profile={profile} worker={worker} home={home} track={demo.track} onEdit={setStep} />
      </div>
    );
  }

  const current = step ?? 0;

  return (
    <div className="space-y-6">
      <StepHeader
        backHref="/you"
        step={current + 1}
        total={total}
        title={stepTitle(worker, current)}
      />
      {worker ? (
        <WorkerStep
          step={current}
          profile={profile}
          home={home}
          photoNote={photoNote}
          language={language}
          track={demo.track}
          onLanguage={setLanguage}
          onPhotoNote={setPhotoNote}
          onPlace={(place) => {
            demo.setHomeTown(place);
            update(profile);
          }}
          onChange={update}
        />
      ) : (
        <InvestorStep
          step={current}
          profile={profile}
          home={home}
          onChange={update}
          onPlace={(place) => demo.setHomeTown(place)}
        />
      )}
      <div className="flex gap-2">
        {current > 0 ? (
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(current - 1)}>
            Back
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="flex-1"
          variant={worker ? "work" : "default"}
          disabled={!canContinue(worker, current, profile, home)}
          onClick={() => {
            const next = { ...profile, languages: cleanLanguages(profile.languages) };
            if (current === total - 1) finish(next);
            else {
              save(next);
              setStep(current + 1);
            }
          }}
        >
          {current === total - 1 ? "Save profile" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function stepTitle(worker: boolean, step: number): string {
  if (worker) {
    return ["Where you work", "Your skills", "Tools you own", "When you can work", "Languages", "Work photos"][step] ?? "Your profile";
  }
  return ["What you look for", "Places", "Usual amount", "Time", "Goals", "Your name"][step] ?? "Your profile";
}

function canContinue(worker: boolean, step: number, profile: PersonProfile, home: PlacePick | null): boolean {
  if (worker && step === 0) return Boolean(home?.townId);
  if (worker && step === 1) return profile.skillLevels.length > 0;
  if (!worker && step === 0) return profile.interests.length > 0;
  if (!worker && step === 2) {
    if (profile.minUsd === null || profile.maxUsd === null) return false;
    return profile.maxUsd >= profile.minUsd;
  }
  return true;
}

function currentPlace(demo: ReturnType<typeof useDemo>): PlacePick | null {
  if (demo.flow?.countryId && demo.flow.townId) {
    return {
      countryId: demo.flow.countryId,
      parishId: demo.flow.parishId ?? null,
      townId: demo.flow.townId,
    };
  }
  if (demo.homeCountryId && demo.homeTownId) {
    return {
      countryId: demo.homeCountryId,
      parishId: demo.homeParishId,
      townId: demo.homeTownId,
    };
  }
  return null;
}

function WorkerStep({
  step,
  profile,
  home,
  language,
  photoNote,
  track,
  onLanguage,
  onPhotoNote,
  onPlace,
  onChange,
}: {
  step: number;
  profile: PersonProfile;
  home: PlacePick | null;
  language: string;
  photoNote: string;
  track: { accepted: number; projects: number; payouts: number };
  onLanguage: (value: string) => void;
  onPhotoNote: (value: string) => void;
  onPlace: (place: PlacePick) => void;
  onChange: (patch: Partial<PersonProfile>) => void;
}) {
  if (step === 0) {
    return (
      <div className="space-y-4">
        <TownPick place={home} onPlace={onPlace} />
        <UseMyLocation onTown={onPlace} className={cn(choiceClass, "border-border bg-card")} />
        <div className="grid gap-2">
          {REACH_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={profile.reach === choice.id}
              className={cn(choiceClass, onClass(profile.reach === choice.id))}
              onClick={() => onChange({ reach: choice.id })}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="space-y-4">
        {SKILLS.map((skill) => {
          const picked = profile.skillLevels.find((item) => item.skill === skill.id);
          return (
            <div key={skill.id} className="space-y-2">
              <button
                type="button"
                aria-pressed={Boolean(picked)}
                className={cn(choiceClass, "w-full", onClass(Boolean(picked)))}
                onClick={() => {
                  const skillLevels = picked
                    ? profile.skillLevels.filter((item) => item.skill !== skill.id)
                    : [...profile.skillLevels, { skill: skill.id, level: "learning" as SkillLevelName }];
                  onChange({ skillLevels });
                }}
              >
                {skill.title}
              </button>
              {picked ? (
                <div className="flex flex-wrap gap-2">
                  {LEVEL_CHOICES.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      aria-pressed={picked.level === level.id}
                      className={cn(choiceClass, onClass(picked.level === level.id))}
                      onClick={() =>
                        onChange({
                          skillLevels: profile.skillLevels.map((item) =>
                            item.skill === skill.id ? { ...item, level: level.id } : item,
                          ),
                        })
                      }
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }
  if (step === 2) {
    const groups = toolsForSkills(profile.skillLevels.map((item) => item.skill));
    return (
      <div className="space-y-4">
        {groups.length === 0 ? <p>Pick a skill first.</p> : null}
        {groups.map((group) => (
          <div key={group.skill} className="space-y-2">
            <h2 className={sectionTitle}>{skillTitle(group.skill)}</h2>
            <div className="flex flex-wrap gap-2">
              {group.tools.map((tool) => {
                const on = profile.tools.includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    aria-pressed={on}
                    className={cn(choiceClass, onClass(on))}
                    onClick={() =>
                      onChange({
                        tools: on ? profile.tools.filter((item) => item !== tool) : [...profile.tools, tool],
                      })
                    }
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className="space-y-4">
        <p className="text-lg">Days each week</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={profile.daysPerWeek === day}
              className={cn(choiceClass, "min-w-12 text-center", onClass(profile.daysPerWeek === day))}
              onClick={() => onChange({ daysPerWeek: day })}
            >
              {day}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          {START_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={profile.startWhen === choice.id}
              className={cn(choiceClass, onClass(profile.startWhen === choice.id))}
              onClick={() => onChange({ startWhen: choice.id as StartWhen })}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (step === 4) {
    return (
      <LanguagePick
        languages={profile.languages}
        draft={language}
        onDraft={onLanguage}
        onChange={(languages) => onChange({ languages })}
      />
    );
  }
  return (
    <div className="space-y-4">
      <PhotoPick
        photos={profile.photos}
        note={photoNote}
        onNote={onPhotoNote}
        onChange={(photos) => onChange({ photos })}
      />
      <TrackList track={track} />
    </div>
  );
}

function InvestorStep({
  step,
  profile,
  home,
  onChange,
  onPlace,
}: {
  step: number;
  profile: PersonProfile;
  home: PlacePick | null;
  onChange: (patch: Partial<PersonProfile>) => void;
  onPlace: (place: PlacePick) => void;
}) {
  const currency = currencyOf(home?.countryId ?? "jamaica");
  if (step === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {SECTORS.map((sector) => {
            const on = profile.interests.includes(sector.id);
            return (
              <button
                key={sector.id}
                type="button"
                aria-pressed={on}
                className={cn(choiceClass, onClass(on))}
                onClick={() => {
                  const interests = on
                    ? profile.interests.filter((item) => item !== sector.id)
                    : [...profile.interests, sector.id];
                  const kinds = profile.kinds.filter((id) =>
                    interests.some((item) => kindsFor(item).some((kind) => kind.id === id)),
                  );
                  onChange({ interests, kinds });
                }}
              >
                {sector.title}
              </button>
            );
          })}
        </div>
        {profile.interests.map((sector) => (
          <div key={sector} className="space-y-2">
            <h2 className={sectionTitle}>{SECTORS.find((item) => item.id === sector)?.title}</h2>
            <div className="flex flex-wrap gap-2">
              {kindsFor(sector).map((kind) => {
                const on = profile.kinds.includes(kind.id);
                return (
                  <button
                    key={kind.id}
                    type="button"
                    aria-pressed={on}
                    className={cn(choiceClass, onClass(on))}
                    onClick={() =>
                      onChange({
                        kinds: on ? profile.kinds.filter((item) => item !== kind.id) : [...profile.kinds, kind.id],
                      })
                    }
                  >
                    {kind.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (step === 1) {
    const anywhere = profile.places.includes("anywhere");
    return (
      <div className="space-y-3">
        <button
          type="button"
          aria-pressed={anywhere}
          className={cn(choiceClass, onClass(anywhere))}
          onClick={() => onChange({ places: anywhere ? [] : ["anywhere"] })}
        >
          Anywhere
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={!anywhere && profile.places.includes("jamaica")}
            className={cn(choiceClass, "flex flex-col items-start", onClass(!anywhere && profile.places.includes("jamaica")))}
            onClick={() => onChange({ places: togglePlace(profile.places, "jamaica") })}
          >
            <span>Jamaica</span>
            {!anywhere && profile.places.includes("jamaica") ? <SectorHint placeId="jamaica" /> : null}
          </button>
          {getCountries()
            .filter((country) => country.id !== "jamaica")
            .map((country) => {
            const picked = !anywhere && profile.places.includes(country.id);
            return (
              <button
                key={country.id}
                type="button"
                aria-pressed={picked}
                className={cn(choiceClass, "flex flex-col items-start", onClass(picked))}
                onClick={() => onChange({ places: togglePlace(profile.places, country.id) })}
              >
                <span>{country.name}</span>
                {picked ? <SectorHint placeId={country.id} /> : null}
              </button>
            );
          })}
        </div>
        <TownPick place={home} onPlace={onPlace} />
        <UseMyLocation onTown={onPlace} className={cn(choiceClass, "border-border bg-card")} />
        <FitFooter sources={sourcesForPlaces(profile.places)} />
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="font-semibold">Minimum in US$</span>
          <input
            inputMode="numeric"
            value={profile.minUsd ?? ""}
            onChange={(event) => onChange({ minUsd: readUsd(event.target.value) })}
            className="min-h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-lg"
          />
        </label>
        <label className="block space-y-1">
          <span className="font-semibold">Maximum in US$</span>
          <input
            inputMode="numeric"
            value={profile.maxUsd ?? ""}
            onChange={(event) => onChange({ maxUsd: readUsd(event.target.value) })}
            className="min-h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-lg"
          />
        </label>
        <AmountLocal min={profile.minUsd} max={profile.maxUsd} currency={currency} />
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className="grid gap-2">
        {HORIZON_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            aria-pressed={profile.horizon === choice.id}
            className={cn(choiceClass, onClass(profile.horizon === choice.id))}
            onClick={() => onChange({ horizon: choice.id as HorizonChoice })}
          >
            {choice.label}
          </button>
        ))}
      </div>
    );
  }
  if (step === 4) {
    return (
      <div className="flex flex-wrap gap-2">
        {GOAL_CHOICES.map((goal) => {
          const on = profile.goals.includes(goal.id);
          return (
            <button
              key={goal.id}
              type="button"
              aria-pressed={on}
              className={cn(choiceClass, onClass(on))}
              onClick={() =>
                onChange({
                  goals: on ? profile.goals.filter((item) => item !== goal.id) : [...profile.goals, goal.id as GoalChoice],
                })
              }
            >
              {goal.label}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <label className="flex min-h-12 items-start gap-3 text-lg">
      <input
        type="checkbox"
        className="mt-1 size-5"
        checked={profile.showName}
        onChange={(event) => onChange({ showName: event.target.checked })}
      />
      <span>Show my name on projects I back</span>
    </label>
  );
}

function togglePlace(places: string[], id: string): string[] {
  const rest = places.filter((item) => item !== "anywhere");
  return rest.includes(id) ? rest.filter((item) => item !== id) : [...rest, id];
}

function readUsd(value: string): number | null {
  const digits = value.replace(/,/g, "").trim();
  if (!digits) return null;
  const amount = Number(digits);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount);
}

function AmountLocal({
  min,
  max,
  currency,
}: {
  min: number | null;
  max: number | null;
  currency: string;
}) {
  if (min === null && max === null) return null;
  const low = min === null ? null : localFromUsd(min, currency);
  const high = max === null ? null : localFromUsd(max, currency);
  return (
    <p className="text-base text-muted-foreground">
      {low !== null ? <MoneyText amount={low} currency={currency} /> : null}
      {low !== null && high !== null ? " to " : null}
      {high !== null ? <MoneyText amount={high} currency={currency} /> : null}
    </p>
  );
}

function TownPick({ place, onPlace }: { place: PlacePick | null; onPlace: (place: PlacePick) => void }) {
  const countryId = place?.countryId ?? "jamaica";
  const parishId = place?.parishId ?? "";
  const parish = parishId ? getParishes().find((item) => item.id === parishId) : undefined;
  const towns = countryId === "jamaica" ? parish?.towns ?? [] : [];
  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="font-semibold">Country</span>
        <select
          className="min-h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-lg"
          value={countryId}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "jamaica") onPlace({ countryId: "jamaica", parishId: null, townId: "" });
            else onPlace({ countryId: next, parishId: null, townId: "" });
          }}
        >
          <option value="jamaica">Jamaica</option>
          {getCountries().map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </select>
      </label>
      {countryId === "jamaica" ? (
        <label className="block space-y-1">
          <span className="font-semibold">Parish</span>
          <select
            className="min-h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-lg"
            value={parishId}
            onChange={(event) => onPlace({ countryId: "jamaica", parishId: event.target.value, townId: "" })}
          >
            <option value="">Pick a parish</option>
            {getParishes().map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block space-y-1">
        <span className="font-semibold">{countryId === "jamaica" ? "Town" : "City"}</span>
        <select
          className="min-h-12 w-full rounded-xl border-2 border-border bg-card px-3 text-lg"
          value={place?.townId ?? ""}
          onChange={(event) =>
            onPlace({
              countryId,
              parishId: countryId === "jamaica" ? parishId || null : null,
              townId: event.target.value,
            })
          }
        >
          <option value="">Pick one</option>
          {countryId === "jamaica"
            ? towns.map((town) => (
                <option key={town.id} value={town.id}>
                  {town.name}
                </option>
              ))
            : (getCountries().find((country) => country.id === countryId)?.cities ?? []).map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
        </select>
      </label>
    </div>
  );
}

function LanguagePick({
  languages,
  draft,
  onDraft,
  onChange,
}: {
  languages: string[];
  draft: string;
  onDraft: (value: string) => void;
  onChange: (languages: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {languages.map((item) => (
          <button
            key={item}
            type="button"
            className={cn(choiceClass, "border-primary bg-secondary")}
            onClick={() => onChange(languages.filter((language) => language !== item))}
          >
            {item}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onChange(cleanLanguages([...languages, draft]));
          onDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-border bg-card px-3 text-lg"
          aria-label="Add a language"
        />
        <Button type="submit" variant="outline" size="lg" disabled={languages.length >= 5 || !draft.trim()}>
          Add
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">Up to 5.</p>
    </div>
  );
}

function PhotoPick({
  photos,
  note,
  onNote,
  onChange,
}: {
  photos: PersonProfile["photos"];
  note: string;
  onNote: (value: string) => void;
  onChange: (photos: PersonProfile["photos"]) => void;
}) {
  return (
    <div className="space-y-3">
      {photos.map((photo) => (
        <div key={photo.fileName} className="space-y-2">
          {photo.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.dataUrl} alt="" className="max-h-40 w-full rounded-xl object-cover" />
          ) : (
            <p className="font-semibold">{photo.fileName}</p>
          )}
          <button
            type="button"
            className="min-h-11 font-semibold text-primary"
            onClick={() => onChange(photos.filter((item) => item !== photo))}
          >
            Remove
          </button>
        </div>
      ))}
      {note ? <p>{note}</p> : null}
      {photos.length < 4 ? (
        <label className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full cursor-pointer")}>
          Add a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!file.type.startsWith("image/")) {
                onNote("Choose a photo.");
                return;
              }
              if (file.size > 800_000) {
                onChange([...photos, { fileName: file.name, dataUrl: null }].slice(0, 4));
                onNote("That photo is large. We saved the name only in this demo.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                onChange(
                  [...photos, { fileName: file.name, dataUrl: typeof reader.result === "string" ? reader.result : null }].slice(0, 4),
                );
                onNote("");
              };
              reader.readAsDataURL(file);
            }}
          />
        </label>
      ) : (
        <p>4 photos is the limit.</p>
      )}
    </div>
  );
}

function TrackList({ track }: { track: { accepted: number; projects: number; payouts: number } }) {
  return (
    <section className="space-y-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className={sectionTitle}>Track record</h2>
      <p>{track.accepted === 1 ? "1 accepted work entry." : `${track.accepted} accepted work entries.`}</p>
      <p>{track.projects === 1 ? "1 project worked on." : `${track.projects} projects worked on.`}</p>
      <p>{track.payouts === 1 ? "1 confirmed pay-out." : `${track.payouts} confirmed pay-outs.`}</p>
    </section>
  );
}

function Summary({
  profile,
  worker,
  home,
  track,
  onEdit,
}: {
  profile: PersonProfile;
  worker: boolean;
  home: PlacePick | null;
  track: { accepted: number; projects: number; payouts: number };
  onEdit: (step: number) => void;
}) {
  const town = home ? townName(home.countryId, home.parishId, home.townId) : "";
  const currency = currencyOf(home?.countryId ?? "jamaica");
  if (worker) {
    return (
      <div className="space-y-4">
        <SummaryRow title="Home" body={`${town || "Pick a town"}. ${reachLabel(profile.reach, home)}.`} onEdit={() => onEdit(0)} />
        <SummaryRow
          title="Skills"
          body={profile.skillLevels.map((item) => `${skillTitle(item.skill)} (${levelLabel(item.level)})`).join(", ") || "None yet"}
          onEdit={() => onEdit(1)}
        />
        <SummaryRow title="Tools" body={profile.tools.join(", ") || "None yet"} onEdit={() => onEdit(2)} />
        <SummaryRow
          title="Availability"
          body={availabilityLine(profile)}
          onEdit={() => onEdit(3)}
        />
        <SummaryRow title="Languages" body={profile.languages.join(", ") || "None yet"} onEdit={() => onEdit(4)} />
        <SummaryRow title="Photos" body={profile.photos.length === 1 ? "1 photo" : `${profile.photos.length} photos`} onEdit={() => onEdit(5)} />
        <TrackList track={track} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SummaryRow
        title="Interests"
        body={profile.interests.map((id) => SECTORS.find((item) => item.id === id)?.title ?? id).join(", ") || "None yet"}
        onEdit={() => onEdit(0)}
      />
      <SummaryRow title="Places" body={profile.places.includes("anywhere") ? "Anywhere" : profile.places.join(", ") || "None yet"} onEdit={() => onEdit(1)} />
      <SummaryRow title="Usual amount" body={amountLine(profile, currency)} onEdit={() => onEdit(2)} />
      <SummaryRow
        title="Time"
        body={HORIZON_CHOICES.find((item) => item.id === profile.horizon)?.label ?? "Not set"}
        onEdit={() => onEdit(3)}
      />
      <SummaryRow
        title="Goals"
        body={profile.goals.map((id) => GOAL_CHOICES.find((item) => item.id === id)?.label ?? id).join(", ") || "None yet"}
        onEdit={() => onEdit(4)}
      />
      <SummaryRow title="Name" body={profile.showName ? "Shown on projects you back." : "Hidden on projects you back."} onEdit={() => onEdit(5)} />
    </div>
  );
}

function SummaryRow({ title, body, onEdit }: { title: string; body: string; onEdit: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <h2 className={sectionTitle}>{title}</h2>
        <button type="button" className="min-h-11 font-semibold text-primary" onClick={onEdit}>
          Edit
        </button>
      </div>
      <p className="mt-1 text-base">{body}</p>
    </div>
  );
}

function levelLabel(level: SkillLevelName): string {
  return LEVEL_CHOICES.find((item) => item.id === level)?.label ?? level;
}

function availabilityLine(profile: PersonProfile): string {
  const days = profile.daysPerWeek ? `${profile.daysPerWeek} days a week` : "Days not set";
  const start = START_CHOICES.find((item) => item.id === profile.startWhen)?.label ?? "Start not set";
  return `${days}. ${start}.`;
}

function amountLine(profile: PersonProfile, currency: string): string {
  if (profile.minUsd === null || profile.maxUsd === null) return "Not set";
  const low = localFromUsd(profile.minUsd, currency);
  const high = localFromUsd(profile.maxUsd, currency);
  const usd = `US$${profile.minUsd.toLocaleString("en-US")} to US$${profile.maxUsd.toLocaleString("en-US")}`;
  if (low === null || high === null) return usd;
  return `${usd}. About ${currency}${low.toLocaleString("en-US")} to ${currency}${high.toLocaleString("en-US")}.`;
}
