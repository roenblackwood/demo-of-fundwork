import { PlaceJump } from "@/components/place-jump";
import { Pending, Resolved } from "@/components/resolved";
import { sectorParams } from "@/lib/params";

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
        {({ parish, town, sector }) => <PlaceJump parish={parish} town={town} sector={sector} />}
      </Resolved>
    </Pending>
  );
}
