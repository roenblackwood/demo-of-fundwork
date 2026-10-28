import type { Metadata } from "next";
import { ApplyScreen } from "@/components/apply-screen";
import { Pending, Resolved } from "@/components/resolved";
import { requestParams } from "@/lib/params";

export function generateStaticParams() {
  return requestParams();
}

export const metadata: Metadata = {
  title: "Apply - Fundwork",
};

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ id }) => <ApplyScreen id={id} />}
      </Resolved>
    </Pending>
  );
}
