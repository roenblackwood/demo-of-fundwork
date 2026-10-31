import type { Metadata } from "next";
import dynamic from "next/dynamic";

const MoneyScreen = dynamic(() => import("@/components/money-screen").then((mod) => mod.MoneyScreen));
import { Pending, Resolved } from "@/components/resolved";
import { projectParams } from "@/lib/params";
import { getProject } from "@/lib/seed";

export function generateStaticParams() {
  return projectParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = getProject(id);
  return { title: project ? `Money - ${project.name} - Fundwork` : "Fundwork" };
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Pending>
      <Resolved params={params}>
        {({ id }) => <MoneyScreen id={id} />}
      </Resolved>
    </Pending>
  );
}
