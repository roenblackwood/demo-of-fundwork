"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ProjectCard } from "@/components/project-card";
import { StepHeader } from "@/components/parts";
import { buttonVariants } from "@/components/ui/button";
import { sectorTitle } from "@/lib/catalog";
import { getRegion, leadCountry, showcaseById } from "@/lib/regions";
import { cn } from "cn";
import { useDemo } from "@/lib/demo-store";
import { projectsForPlace } from "@/lib/match";
import { getCity, getCountry, getParish, getTown, projectPlace } from "@/lib/seed";
import type { Sector } from "@/lib/types";

export function ProjectList({
  placeId,
  townId,
  sector,
}: {
  placeId: string;
  townId: string;
  sector: Sector;
}) {
  const { updateFlow, projects: allProjects } = useDemo();
  const parish = getParish(placeId);
  const country = parish ? getCountry("jamaica") : getCountry(placeId);
  const town = townId === "all" ? null : parish ? getTown(placeId, townId) : getCity(placeId, townId);
  const projects = projectsForPlace(placeId, townId, sector, allProjects);
  const sectorName = sectorTitle(sector).toLowerCase();
  const jamaica = Boolean(parish);

  useEffect(() => {
    updateFlow({
      countryId: jamaica ? "jamaica" : country?.id,
      parishId: parish?.id,
      townId,
      sector,
    });
  }, [country?.id, jamaica, parish?.id, placeId, sector, townId, updateFlow]);

  if ((!parish && !country) || (townId !== "all" && !town)) return null;

  const areaName = parish?.name ?? country?.name ?? "this place";
  const place = town ? town.name : areaName;
  const heading =
    projects.length === 1 ? `1 project in ${place}` : `${projects.length} projects in ${place}`;
  const sibling = allProjects.find(
    (project) =>
      project.sector === sector &&
      project.townId !== townId &&
      (jamaica ? project.parishId === placeId : project.countryId === placeId),
  );
  const siblingWhere = sibling ? projectPlace(sibling) : null;
  const regionId = country?.regionId;
  const region = regionId ? getRegion(regionId) : undefined;
  const leadId = region ? leadCountry(region.id) : null;
  const lead = leadId ? showcaseById(leadId) : undefined;
  const leadIsHere = leadId === placeId || (jamaica && leadId === "jamaica");

  return (
    <div>
      <StepHeader
        backHref="/invest"
        title={projects.length === 0 ? `Nothing open in ${place} yet` : heading}
        hint={town ? `${sectorTitle(sector)} in ${areaName}` : sectorTitle(sector)}
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
              : `There is no open project for ${sectorName} in ${areaName}.`}
          </p>
          {town && jamaica ? (
            <Link
              href={`/invest/${placeId}/all/${sector}`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              See {sectorName} in {areaName}
            </Link>
          ) : sibling && siblingWhere ? (
            <Link
              href={`/invest/${placeId}/${sibling.townId}/${sector}`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              See {siblingWhere.town}
            </Link>
          ) : lead && region && !leadIsHere ? (
            <Link
              href={lead.id === "jamaica" ? "/invest/jamaica" : `/invest/${lead.id}`}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              See {lead.name}
            </Link>
          ) : (
            <Link
              href={jamaica ? "/invest/jamaica" : "/invest"}
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              {jamaica ? "Try another parish" : "Try another place"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
