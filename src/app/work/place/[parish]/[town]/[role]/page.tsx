import { notFound } from "next/navigation";
import { ProfileStep } from "@/components/profile-step";
import { Pending, Resolved } from "@/components/resolved";
import { isSkill } from "@/lib/catalog";
import { roleParams } from "@/lib/params";
import { getCity, getTown } from "@/lib/seed";

export function generateStaticParams() {
  return roleParams();
}

export default function Page({
  params,
}: {
  params: Promise<{ parish: string; town: string; role: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ parish, town, role }) => {
          if ((!getTown(parish, town) && !getCity(parish, town)) || !isSkill(role)) notFound();
          return <ProfileStep placeId={parish} townId={town} skill={role} />;
        }}
      </Resolved>
    </Pending>
  );
}
