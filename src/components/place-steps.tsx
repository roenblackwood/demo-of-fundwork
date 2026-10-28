"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OpenRequests } from "@/components/open-requests";
import { ChoiceLink, StepHeader } from "@/components/parts";
import { RegionMap } from "@/components/region-map";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JAMAICA_SKILLS, SECTORS, SKILLS, sectorTitle } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { sectorsHere } from "@/lib/match";
import {
  FLOW_STEPS,
  countriesIn,
  getRegion,
  leadCountry,
  showcaseById,
  type RegionId,
} from "@/lib/regions";
import { getCity, getCountry, getParish, getParishes, getProjects, getTown } from "@/lib/seed";
import type { PathChoice, Skill } from "@/lib/types";

export type PlacePurpose = "browse" | "request" | "available";

function pathRoot(mode: PathChoice, purpose: PlacePurpose = "browse"): string {
  if (purpose === "request") return "/invest/start";
  if (purpose === "available") return "/work/available";
  return mode === "investor" ? "/invest" : "/work";
}

function regionBack(purpose: PlacePurpose): string {
  if (purpose === "request") return "/invest";
  if (purpose === "available") return "/work";
  return "/";
}

export function RegionStep({
  mode,
  purpose = "browse",
}: {
  mode: PathChoice;
  purpose?: PlacePurpose;
}) {
  const router = useRouter();
  const { startPath, updateFlow } = useDemo();
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const region = regionId ? getRegion(regionId) : undefined;
  const countries = regionId ? countriesIn(regionId) : [];

  function chooseRegion(id: RegionId) {
    setRegionId(id);
    updateFlow({ regionId: id });
  }

  function chooseCountry(id: string) {
    updateFlow({
      regionId: regionId ?? undefined,
      countryId: id,
      parishId: undefined,
      townId: undefined,
      sector: undefined,
      skill: undefined,
      extraSkills: [],
    });
    const root = pathRoot(mode, purpose);
    router.push(id === "jamaica" ? `${root}/jamaica` : `${root}/${id}`);
  }

  return (
    <div>
      <StepHeader
        backHref={regionBack(purpose)}
        step={1}
        total={FLOW_STEPS}
        title="Where should we look?"
      />
      {mode === "worker" && purpose === "browse" ? (
        <div className="mb-6">
          <OpenRequests />
        </div>
      ) : null}
      {mode === "investor" && purpose === "browse" ? (
        <Link
          href="/invest/start"
          onClick={() => startPath("investor")}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mb-6 w-full")}
        >
          Start a project here
        </Link>
      ) : null}
      <RegionMap
        selected={regionId}
        onSelect={chooseRegion}
        onSelectCountry={chooseCountry}
      />
      {region ? (
        <div className="mt-6 space-y-3">
          <p className="text-lg leading-relaxed">Tap a country in {region.name}.</p>
          {countries.map((country) => {
            const projects = getProjects().filter((project) => project.countryId === country.id);
            const detail =
              country.id === "jamaica"
                ? "Parishes and towns"
                : projects.length > 0
                  ? projects.map((project) => project.name).join(", ")
                  : "No project in this demo yet";
            return (
              <ChoiceLink
                key={country.id}
                href={
                  country.id === "jamaica"
                    ? `${pathRoot(mode, purpose)}/jamaica`
                    : `${pathRoot(mode, purpose)}/${country.id}`
                }
                title={country.name}
                detail={detail}
                onClick={() =>
                  updateFlow({
                    regionId: regionId ?? undefined,
                    countryId: country.id,
                    parishId: undefined,
                    townId: undefined,
                    sector: undefined,
                    skill: undefined,
                    extraSkills: [],
                  })
                }
              />
            );
          })}
        </div>
      ) : (
        <p className="mt-6 text-lg text-muted-foreground">Tap a region.</p>
      )}
    </div>
  );
}

export function CountryStep({
  regionId,
  mode,
  purpose = "browse",
}: {
  regionId: RegionId;
  mode: PathChoice;
  purpose?: PlacePurpose;
}) {
  const { updateFlow } = useDemo();
  const region = getRegion(regionId);
  const root = pathRoot(mode, purpose);

  return (
    <div>
      <StepHeader
        backHref={root}
        step={2}
        total={FLOW_STEPS}
        title="Which country?"
        hint={region?.name}
      />
      <div className="space-y-3">
        {countriesIn(regionId).map((country) => (
          <ChoiceLink
            key={country.id}
            href={country.id === "jamaica" ? `${root}/jamaica` : `${root}/${country.id}`}
            title={country.name}
            detail={country.id === "jamaica" ? "Parishes and towns" : undefined}
            onClick={() =>
              updateFlow({
                regionId,
                countryId: country.id,
                parishId: undefined,
                townId: undefined,
                sector: undefined,
                skill: undefined,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

export function ParishStep({
  mode,
  purpose = "browse",
}: {
  mode: PathChoice;
  purpose?: PlacePurpose;
}) {
  const { updateFlow } = useDemo();
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const parishes = getParishes();
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return parishes;
    return parishes.filter((parish) => parish.name.toLowerCase().includes(text));
  }, [parishes, query]);
  const title = mode === "investor" ? "Which parish?" : "Where do you want to work?";
  const root = pathRoot(mode, purpose);

  return (
    <div>
      <StepHeader
        backHref={root}
        step={2}
        total={FLOW_STEPS}
        title={title}
        hint="Caribbean, Jamaica"
      />
      <div className="space-y-3">
        {shown.map((parish) => (
          <ChoiceLink
            key={parish.id}
            href={`${root}/${parish.id}`}
            title={parish.name}
            onClick={() =>
              updateFlow({
                regionId: "caribbean",
                countryId: "jamaica",
                parishId: parish.id,
                townId: undefined,
                sector: undefined,
                skill: undefined,
              })
            }
          />
        ))}
        {shown.length === 0 ? (
          <p className="text-lg">No parish with that name.</p>
        ) : null}
      </div>
      <div className="mt-6">
        {finding ? (
          <div className="space-y-2">
            <Label htmlFor="parish-find">Find a parish</Label>
            <Input
              id="parish-find"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a parish"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            className="min-h-11 font-semibold text-primary"
            onClick={() => setFinding(true)}
          >
            Find a parish
          </button>
        )}
      </div>
    </div>
  );
}

export function TownStep({
  parishId,
  mode,
  purpose = "browse",
}: {
  parishId: string;
  mode: PathChoice;
  purpose?: PlacePurpose;
}) {
  const { updateFlow } = useDemo();
  const parish = getParish(parishId);
  if (!parish) return null;
  const root = pathRoot(mode, purpose);

  return (
    <div>
      <StepHeader
        backHref={`${root}/jamaica`}
        step={3}
        total={FLOW_STEPS}
        title="Which town?"
        hint={parish.name}
      />
      <div className="space-y-3">
        {parish.towns.map((town) => (
          <ChoiceLink
            key={town.id}
            href={`${root}/${parish.id}/${town.id}`}
            title={town.name}
            onClick={() =>
              updateFlow({
                countryId: "jamaica",
                parishId: parish.id,
                townId: town.id,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

export function CityStep({
  countryId,
  mode,
  purpose = "browse",
}: {
  countryId: string;
  mode: PathChoice;
  purpose?: PlacePurpose;
}) {
  const { updateFlow } = useDemo();
  const country = getCountry(countryId);
  if (!country) return null;
  const root = pathRoot(mode, purpose);
  const region = getRegion(country.regionId);

  return (
    <div>
      <StepHeader
        backHref={root}
        step={2}
        total={4}
        title={mode === "investor" ? "Which city?" : "Where do you want to work?"}
        hint={region ? `${region.name}, ${country.name}` : country.name}
      />
      <div className="space-y-3">
        {country.cities.map((city) => {
          const project = getProjects().find(
            (item) => item.countryId === country.id && item.townId === city.id,
          );
          return (
            <ChoiceLink
              key={city.id}
              href={`${root}/${country.id}/${city.id}`}
              title={city.name}
              detail={project ? sectorTitle(project.sector) : "No project yet"}
              onClick={() =>
                updateFlow({
                  regionId: region?.id,
                  countryId: country.id,
                  parishId: undefined,
                  townId: city.id,
                  sector: undefined,
                  skill: undefined,
                })
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function emptyPlaceLink(placeId: string, mode: PathChoice): { href: string; label: string } | null {
  const country = getCountry(placeId);
  const region = getRegion(country?.regionId ?? (getParish(placeId) ? "caribbean" : ""));
  if (!region) return null;
  const leadId = leadCountry(region.id);
  if (leadId === placeId || (leadId === "jamaica" && getParish(placeId))) return null;
  const lead = showcaseById(leadId);
  if (!lead) return null;
  const root = pathRoot(mode);
  return {
    href: leadId === "jamaica" ? `${root}/jamaica` : `${root}/${leadId}`,
    label: `See ${lead.name}`,
  };
}

export function SectorStep({ placeId, townId }: { placeId: string; townId: string }) {
  const { updateFlow } = useDemo();
  const parish = getParish(placeId);
  const country = parish ? undefined : getCountry(placeId);
  const town = parish ? getTown(placeId, townId) : getCity(placeId, townId);
  if (!town || (!parish && !country)) return null;
  const present = new Set(sectorsHere(placeId, townId));
  const sectors = parish
    ? SECTORS.filter(
        (sector) =>
          sector.id === "lodging" || sector.id === "agriculture" || present.has(sector.id),
      )
    : SECTORS.filter((sector) => present.has(sector.id));
  const hint = parish ? `${town.name}, ${parish.name}` : `${town.name}, ${country?.name}`;
  const elsewhere = sectors.length === 0 ? emptyPlaceLink(placeId, "investor") : null;

  return (
    <div>
      <StepHeader
        backHref={`/invest/${placeId}`}
        step={parish ? 4 : 3}
        total={parish ? FLOW_STEPS : 4}
        title="What kind of project?"
        hint={hint}
      />
      {sectors.length > 0 ? (
        <div className="space-y-3">
          {sectors.map((sector) => (
            <ChoiceLink
              key={sector.id}
              href={`/invest/${placeId}/${town.id}/${sector.id}`}
              title={sector.title}
              detail={sector.detail}
              onClick={() =>
                updateFlow({
                  countryId: parish ? "jamaica" : country?.id,
                  parishId: parish?.id,
                  townId: town.id,
                  sector: sector.id,
                })
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">No project in {town.name} yet.</p>
          {elsewhere ? (
            <Link href={elsewhere.href} className={cn(buttonVariants({ size: "lg" }), "w-full")}>
              {elsewhere.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function RoleStep({ placeId, townId }: { placeId: string; townId: string }) {
  const { updateFlow } = useDemo();
  const [more, setMore] = useState(false);
  const parish = getParish(placeId);
  const country = parish ? undefined : getCountry(placeId);
  const town = parish ? getTown(placeId, townId) : getCity(placeId, townId);
  if (!town || (!parish && !country)) return null;

  const needed = new Set<Skill>(
    getProjects()
      .filter((project) => {
        const here = parish ? project.parishId === placeId : project.countryId === placeId;
        return here && project.townId === townId;
      })
      .flatMap((project) => project.needs),
  );
  const lead = parish
    ? SKILLS.filter((skill) => JAMAICA_SKILLS.includes(skill.id))
    : SKILLS.filter((skill) => needed.has(skill.id));
  const rest = parish ? [] : SKILLS.filter((skill) => !needed.has(skill.id));
  const hint = parish ? `${town.name}, ${parish.name}` : `${town.name}, ${country?.name}`;
  const elsewhere = !parish && lead.length === 0 ? emptyPlaceLink(placeId, "worker") : null;

  function choose(skill: Skill) {
    updateFlow({
      countryId: parish ? "jamaica" : country?.id,
      parishId: parish?.id,
      townId: town?.id,
      skill,
      extraSkills: [],
    });
  }

  return (
    <div>
      <StepHeader
        backHref={`/work/${placeId}`}
        step={parish ? 4 : 3}
        total={parish ? FLOW_STEPS : 4}
        title="What work do you do?"
        hint={hint}
      />
      {lead.length > 0 ? (
        <div className="space-y-3">
          {lead.map((skill) => (
            <ChoiceLink
              key={skill.id}
              href={`/work/${placeId}/${town.id}/${skill.id}`}
              title={skill.title}
              detail={skill.detail}
              onClick={() => choose(skill.id)}
            />
          ))}
          {rest.length > 0 ? (
            <button
              type="button"
              className="min-h-11 font-semibold text-primary"
              onClick={() => setMore((open) => !open)}
            >
              {more ? "Fewer kinds of work" : "More work"}
            </button>
          ) : null}
          {more
            ? rest.map((skill) => (
                <ChoiceLink
                  key={skill.id}
                  href={`/work/${placeId}/${town.id}/${skill.id}`}
                  title={skill.title}
                  detail={skill.detail}
                  onClick={() => choose(skill.id)}
                />
              ))
            : null}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">No work open in {town.name} yet.</p>
          {elsewhere ? (
            <Link
              href={elsewhere.href}
              className={cn(buttonVariants({ variant: "work", size: "lg" }), "w-full")}
            >
              {elsewhere.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
