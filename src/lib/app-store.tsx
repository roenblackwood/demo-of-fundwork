"use client";

import { DemoProvider } from "@/lib/demo-store";
import { LiveProvider } from "@/lib/live-store";

export function AppStore({ live, children }: { live: boolean; children: React.ReactNode }) {
  if (live) return <LiveProvider>{children}</LiveProvider>;
  return <DemoProvider>{children}</DemoProvider>;
}
