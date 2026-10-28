import { notFound } from "next/navigation";
import { LogScreen } from "@/components/log-screen";
import { Pending, Resolved } from "@/components/resolved";
import { projectParams } from "@/lib/params";
import { getProject } from "@/lib/seed";

export function generateStaticParams() {
  return projectParams();
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ id }) => {
          if (!getProject(id)) notFound();
          return <LogScreen id={id} />;
        }}
      </Resolved>
    </Pending>
  );
}
