import type { Metadata } from "next";
import { StartProjectScreen } from "@/components/start-project";
import { Pending, Resolved } from "@/components/resolved";
import { requestParams } from "@/lib/params";

export function generateStaticParams() {
  return requestParams();
}

export const metadata: Metadata = {
  title: "Start the project - Fundwork",
};

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ id }) => <StartProjectScreen id={id} />}
      </Resolved>
    </Pending>
  );
}
