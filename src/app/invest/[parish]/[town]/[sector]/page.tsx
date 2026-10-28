import { notFound } from "next/navigation";
import { ProjectList } from "@/components/project-list";
import { Pending, Resolved } from "@/components/resolved";
import { isSector } from "@/lib/catalog";
import { sectorParams } from "@/lib/params";
import { getCity, getCountry, getParish, getTown } from "@/lib/seed";

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
          if (!isSector(sector)) notFound();
          const place =
            Boolean(getParish(parish)) ||
            parish === "jamaica" ||
            Boolean(getCountry(parish));
          if (!place) notFound();
          if (town !== "all" && !getTown(parish, town) && !getCity(parish, town)) notFound();
          return <ProjectList placeId={parish} townId={town} sector={sector} />;
        }}
      </Resolved>
    </Pending>
  );
}
