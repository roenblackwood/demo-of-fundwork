import type { Metadata } from "next";
import { JoinScreen } from "@/components/join-screen";
import { Pending, Resolved } from "@/components/resolved";
import { requestParams } from "@/lib/params";

export function generateStaticParams() {
  return requestParams();
}

export const metadata: Metadata = {
  title: "Join this request - Fundwork",
};

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ id }) => <JoinScreen id={id} />}
      </Resolved>
    </Pending>
  );
}
