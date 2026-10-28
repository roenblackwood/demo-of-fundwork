import { redirect } from "next/navigation";
import { parishParams } from "@/lib/params";

export function generateStaticParams() {
  return parishParams();
}

export default async function Page({
  params,
}: {
  params: Promise<{ parish: string }>;
}) {
  const { parish } = await params;
  redirect(`/invest/place/${parish}`);
}
