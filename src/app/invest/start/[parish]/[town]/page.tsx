import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageBusy } from "@/components/busy";
import { StartRequestScreen } from "@/components/start-request";
import { Pending, Resolved } from "@/components/resolved";
import { townParams } from "@/lib/params";
import { getCity, getTown } from "@/lib/seed";

export function generateStaticParams() {
  return townParams();
}

export default function Page({
  params,
}: {
  params: Promise<{ parish: string; town: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ parish, town }) => {
          if (!getTown(parish, town) && !getCity(parish, town)) notFound();
          return (
            <Suspense fallback={<PageBusy />}>
              <StartRequestScreen placeId={parish} townId={town} />
            </Suspense>
          );
        }}
      </Resolved>
    </Pending>
  );
}
