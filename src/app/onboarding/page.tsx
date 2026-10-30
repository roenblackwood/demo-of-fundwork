import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next;
  const dest =
    next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/onboarding")
      ? `?next=${encodeURIComponent(next)}`
      : "";
  redirect(`/get-started${dest}`);
}
