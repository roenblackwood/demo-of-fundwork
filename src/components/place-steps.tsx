"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChoiceLink, StepHeader } from "@/components/parts";
import { RegionMap } from "@/components/region-map";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTORS, SKILLS } from "@/lib/catalog";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { FLOW_STEPS, getRegion, type RegionId } from "@/lib/regions";
import { getParish, getParishes } from "@/lib/seed";
import type { PathChoice } from "@/lib/types";

export function RegionStep({ mode }: { mode: PathChoice }) {
  const router = useRouter();
  const [regionId, setRegionId] = useState<RegionId | null>(null);
  const region = regionId ? getRegion(regionId) : undefined;
  const parishHref = mode === "investor" ? "/invest/caribbean" : "/work/caribbean";

  function choose(id: RegionId) {
    setRegionId(id);
    if (id === "caribbean") router.push(parishHref);
  }

  return (
    <div>
      <StepHeader
        backHref="/"
        step={1}
        total={FLOW_STEPS}
        title="Where should we look?"
      />
      <RegionMap selected={regionId} onSelect={choose} />
      {region && !region.open ? (
        <div className="mt-6 space-y-4">
          <p className="text-lg leading-relaxed">
            Nothing open in {region.name} yet. This demo starts in the Caribbean.
          </p>
          <button
            type="button"
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
            onClick={() => choose("caribbean")}
          >
            See the Caribbean
          </button>
        </div>
      ) : (
        <p className="mt-6 text-lg text-muted-foreground">Tap a region.</p>
      )}
    </div>
  );
}

export function ParishStep({ mode }: { mode: PathChoice }) {
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

  return (
    <div>
      <StepHeader
        backHref={mode === "investor" ? "/invest" : "/work"}
        step={2}
        total={FLOW_STEPS}
        title={title}
        hint="Caribbean, Jamaica"
      />
      <div className="space-y-3">
        {shown.map((parish) => (
          <ChoiceLink
            key={parish.id}
            href={mode === "investor" ? `/invest/${parish.id}` : `/work/${parish.id}`}
            title={parish.name}
            onClick={() =>
              updateFlow({
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
}: {
  parishId: string;
  mode: PathChoice;
}) {
  const { updateFlow } = useDemo();
  const parish = getParish(parishId);
  if (!parish) return null;
  const back = mode === "investor" ? "/invest/caribbean" : "/work/caribbean";

  return (
    <div>
      <StepHeader
        backHref={back}
        step={3}
        total={FLOW_STEPS}
        title="Which town?"
        hint={parish.name}
      />
      <div className="space-y-3">
        {parish.towns.map((town) => (
          <ChoiceLink
            key={town.id}
            href={
              mode === "investor"
                ? `/invest/${parish.id}/${town.id}`
                : `/work/${parish.id}/${town.id}`
            }
            title={town.name}
            onClick={() => updateFlow({ parishId: parish.id, townId: town.id })}
          />
        ))}
      </div>
    </div>
  );
}

export function SectorStep({
  parishId,
  townId,
}: {
  parishId: string;
  townId: string;
}) {
  const { updateFlow } = useDemo();
  const parish = getParish(parishId);
  const town = parish?.towns.find((item) => item.id === townId);
  if (!parish || !town) return null;

  return (
    <div>
      <StepHeader
        backHref={`/invest/${parish.id}`}
        step={4}
        total={FLOW_STEPS}
        title="What kind of project?"
        hint={`${town.name}, ${parish.name}`}
      />
      <div className="space-y-3">
        {SECTORS.map((sector) => (
          <ChoiceLink
            key={sector.id}
            href={`/invest/${parish.id}/${town.id}/${sector.id}`}
            title={sector.title}
            detail={sector.detail}
            onClick={() =>
              updateFlow({
                parishId: parish.id,
                townId: town.id,
                sector: sector.id,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

export function RoleStep({
  parishId,
  townId,
}: {
  parishId: string;
  townId: string;
}) {
  const { updateFlow } = useDemo();
  const parish = getParish(parishId);
  const town = parish?.towns.find((item) => item.id === townId);
  if (!parish || !town) return null;

  return (
    <div>
      <StepHeader
        backHref={`/work/${parish.id}`}
        step={4}
        total={FLOW_STEPS}
        title="What work do you do?"
        hint={`${town.name}, ${parish.name}`}
      />
      <div className="space-y-3">
        {SKILLS.map((skill) => (
          <ChoiceLink
            key={skill.id}
            href={`/work/${parish.id}/${town.id}/${skill.id}`}
            title={skill.title}
            detail={skill.detail}
            onClick={() =>
              updateFlow({
                parishId: parish.id,
                townId: town.id,
                skill: skill.id,
                extraSkills: [],
              })
            }
          />
        ))}
      </div>
    </div>
  );
}
