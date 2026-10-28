import { PlaceJump } from "@/components/place-jump";
import { Pending, Resolved } from "@/components/resolved";
import { townParams } from "@/lib/params";

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
        {({ parish, town }) => <PlaceJump parish={parish} town={town} />}
      </Resolved>
    </Pending>
  );
}
