import type { Metadata } from "next";
import { RequestScreen } from "@/components/request-screen";
import { Pending, Resolved } from "@/components/resolved";
import { requestParams } from "@/lib/params";

export function generateStaticParams() {
  return requestParams();
}

export const metadata: Metadata = {
  title: "Request - Fundwork",
};

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ id }) => <RequestScreen id={id} />}
      </Resolved>
    </Pending>
  );
}
