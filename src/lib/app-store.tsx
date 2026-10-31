"use client";

import dynamic from "next/dynamic";
import { DemoProvider } from "@/lib/demo-store";

const LiveProvider = dynamic(() => import("@/lib/live-store").then((mod) => mod.LiveProvider), {
  ssr: false,
});

export function AppStore({ live, children }: { live: boolean; children: React.ReactNode }) {
  if (live) return <LiveProvider>{children}</LiveProvider>;
  return <DemoProvider>{children}</DemoProvider>;
}
