import { redirect } from "next/navigation";
import { townParams } from "@/lib/params";

export function generateStaticParams() {
  return townParams();
}

export default async function Page({
  params,
}: {
  params: Promise<{ parish: string; town: string }>;
}) {
  const { parish, town } = await params;
  redirect(`/work/place/${parish}/${town}`);
}
