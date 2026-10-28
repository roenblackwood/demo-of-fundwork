import { notFound } from "next/navigation";
import { SectorStep } from "@/components/place-steps";
import { Pending, Resolved } from "@/components/resolved";
import { townParams } from "@/lib/params";
import { getTown } from "@/lib/seed";

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
          if (!getTown(parish, town)) notFound();
          return <SectorStep parishId={parish} townId={town} />;
        }}
      </Resolved>
    </Pending>
  );
}
