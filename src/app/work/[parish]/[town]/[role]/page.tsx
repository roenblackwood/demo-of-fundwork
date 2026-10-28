import { redirect } from "next/navigation";
import { roleParams } from "@/lib/params";

export function generateStaticParams() {
  return roleParams();
}

export default async function Page({
  params,
}: {
  params: Promise<{ parish: string; town: string; role: string }>;
}) {
  const { parish, town, role } = await params;
  redirect(`/work/place/${parish}/${town}/${role}`);
}
