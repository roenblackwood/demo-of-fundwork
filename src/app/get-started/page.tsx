import { Suspense } from "react";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import { connection } from "next/server";
import { PageBusy } from "@/components/busy";

const GetStartedScreen = dynamic(() =>
  import("@/components/get-started-screen").then((mod) => mod.GetStartedScreen),
);

function countryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  if (code === "XX" || !/^[A-Z]{2}$/.test(code)) return null;
  return code;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const headerList = await headers();
  const fromQuery = process.env.NODE_ENV === "development" && typeof params.hint === "string" ? countryCode(params.hint) : null;
  const hintCountry = fromQuery ?? countryCode(headerList.get("x-vercel-ip-country"));
  return (
    <Suspense fallback={<PageBusy />}>
      <GetStartedScreen hintCountry={hintCountry} />
    </Suspense>
  );
}
