import { notFound } from "next/navigation";
import { CityStep, ParishStep, TownStep } from "@/components/place-steps";
import { Pending, Resolved } from "@/components/resolved";
import { parishParams } from "@/lib/params";
import { getCountry, getParish } from "@/lib/seed";

export function generateStaticParams() {
  return parishParams();
}

export default function Page({
  params,
}: {
  params: Promise<{ parish: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ parish }) => {
          if (parish === "jamaica") return <ParishStep mode="worker" />;
          if (getCountry(parish) && parish !== "jamaica") {
            return <CityStep countryId={parish} mode="worker" />;
          }
          if (!getParish(parish)) notFound();
          return <TownStep parishId={parish} mode="worker" />;
        }}
      </Resolved>
    </Pending>
  );
}
