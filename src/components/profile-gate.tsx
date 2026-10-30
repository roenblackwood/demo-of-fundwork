"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDemo } from "@/lib/demo-store";
import { gatePath } from "@/lib/start-gate";

/** True when this screen can show. Otherwise the person is sent to sign-up. */
export function useProfileGate(active = true): boolean {
  const demo = useDemo();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!active || !demo.ready || demo.profileSet) return;
    router.replace(gatePath(`${pathname}${window.location.search}`, false));
  }, [active, demo.ready, demo.profileSet, pathname, router]);

  if (!active) return true;
  return demo.ready && demo.profileSet;
}
