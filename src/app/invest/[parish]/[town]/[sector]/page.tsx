import { notFound } from "next/navigation";
import { ProjectList } from "@/components/project-list";
import { Pending, Resolved } from "@/components/resolved";
import { isSector } from "@/lib/catalog";
import { sectorParams } from "@/lib/params";
import { getParish, getTown } from "@/lib/seed";

export function generateStaticParams() {
  return sectorParams();
}

export default function Page({
  params,
}: {
  params: Promise<{ parish: string; town: string; sector: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ parish, town, sector }) => {
          if (!getParish(parish) || !isSector(sector)) notFound();
          if (town !== "all" && !getTown(parish, town)) notFound();
          return <ProjectList parishId={parish} townId={town} sector={sector} />;
        }}
      </Resolved>
    </Pending>
  );
}
