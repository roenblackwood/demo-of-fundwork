import { notFound } from "next/navigation";
import { TownStep } from "@/components/place-steps";
import { Pending, Resolved } from "@/components/resolved";
import { parishParams } from "@/lib/params";
import { getParish } from "@/lib/seed";

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
          if (!getParish(parish)) notFound();
          return <TownStep parishId={parish} mode="investor" />;
        }}
      </Resolved>
    </Pending>
  );
}
