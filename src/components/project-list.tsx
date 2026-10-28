"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { StepHeader } from "@/components/parts";
import { buttonVariants } from "@/components/ui/button";
import { sectorTitle } from "@/lib/catalog";
import { FLOW_STEPS } from "@/lib/regions";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { projectsForPlace } from "@/lib/match";
import { getParish, getTown } from "@/lib/seed";
import type { Sector } from "@/lib/types";

export function ProjectList({
  parishId,
  townId,
  sector,
}: {
  parishId: string;
  townId: string;
  sector: Sector;
}) {
  const { updateFlow } = useDemo();
  const parish = getParish(parishId);
  const town = townId === "all" ? null : getTown(parishId, townId);
  const projects = projectsForPlace(parishId, townId, sector);
  const sectorName = sectorTitle(sector).toLowerCase();

  useEffect(() => {
    updateFlow({ parishId, townId, sector });
  }, [parishId, townId, sector, updateFlow]);

  if (!parish || (townId !== "all" && !town)) return null;

  const place = town ? town.name : parish.name;
  const heading =
    projects.length === 1
      ? `1 project in ${place}`
      : `${projects.length} projects in ${place}`;

  return (
    <div>
      <StepHeader
        backHref={town ? `/invest/${parish.id}/${town.id}` : `/invest/${parish.id}`}
        step={5}
        total={FLOW_STEPS}
        title={projects.length === 0 ? `Nothing open in ${place} yet` : heading}
        hint={town ? `${sectorTitle(sector)} in ${parish.name}` : sectorTitle(sector)}
      />
      {projects.length > 0 ? (
        <div className="space-y-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg leading-relaxed">
            {town
              ? `There is no open project for ${sectorName} in ${town.name}.`
              : `There is no open project for ${sectorName} in ${parish.name}.`}
          </p>
          {town ? (
            <Link
              href={`/invest/${parish.id}/all/${sector}`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              See {sectorName} in {parish.name}
            </Link>
          ) : (
            <Link href="/invest/caribbean" className={cn(buttonVariants({ size: "lg" }), "w-full")}>
              Try another parish
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
